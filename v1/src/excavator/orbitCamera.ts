import * as THREE from "three";
import type { Input } from "../core/input";

/**
 * Kamerasystem (Briefing Kap. 5.2), Taste C / Ansicht-Eintrag wechselt zyklisch:
 * - Orbit: folgt dem Bagger, 3–18 m (SW)
 * - Draufsicht: Start 25 m hoch, 60° Neigung (SW)
 * - Kabine: Ego-Sicht vom Fahrersitz, Kopfblick ±180° / -66°…+46°
 * - Seite: flach und quer, zum Abschätzen von Höhe und Abstand
 *
 * E-136 (Gerätebefund 17.10.2026): Jede Ansicht ist frei drehbar — am Rechner
 * mit MMB-Ziehen, auf dem Tablet mit einem Finger im Mittelstreifen. Zoom per
 * Shift+Rad oder Kneifen wirkt in Orbit, Draufsicht und Seite. Der Knopf
 * springt immer auf den Startpunkt der nächsten Ansicht; Doppeltipp im
 * Mittelstreifen (`input.camReset`) setzt die aktuelle Ansicht zurück.
 */
export type ViewMode = "orbit" | "top" | "cabin" | "side";

interface Startpunkt {
  yaw: number;
  pitch: number;
  dist: number;
  pitchMin: number;
  pitchMax: number;
  distMin: number;
  distMax: number;
}

/**
 * Startpunkte der drei Außenansichten, alle auf derselben Kugel um den Bagger.
 * Draufsicht und Seite waren bis E-136 feste Versätze; die Startwerte sind
 * genau daraus umgerechnet, damit der Knopf dasselbe Bild zeigt wie vorher.
 */
const START: Record<Exclude<ViewMode, "cabin">, Startpunkt> = {
  orbit: { yaw: Math.PI, pitch: 0.42, dist: 11, pitchMin: 0.08, pitchMax: 1.35, distMin: 3, distMax: 18 },
  // war Versatz (0, 25, -14.4): 60° Neigung, 28,9 m. Grenzen SW
  top: {
    yaw: Math.PI, pitch: Math.atan2(25, 14.4), dist: Math.hypot(25, 14.4),
    pitchMin: 0.6, pitchMax: 1.5, distMin: 10, distMax: 40,
  },
  // war Versatz 15 m quer (yaw + 90°), 6,5 m hoch. Grenzen SW
  side: {
    yaw: Math.PI * 1.5, pitch: Math.atan2(6.5, 15), dist: Math.hypot(15, 6.5),
    pitchMin: 0.08, pitchMax: 1.2, distMin: 5, distMax: 28,
  },
};
const CABIN_HEAD_PITCH = -0.22; // leicht gesenkt: Joysticks + Arbeitsbereich im Bild

/*
 * Auftrag 41-P3b: Kameraflug zum Start einer Pruefung — Teil zeigen, Ziel
 * zeigen, zurueck. Der Flug ist eine voruebergehende Uebernahme: Die normale
 * Lage wird darunter weiter gerechnet (Ziel-Glaettung), Eingaben an die
 * Kamera werden verworfen, und der letzte Abschnitt mischt genau in die
 * normale Lage zurueck. Ohne Flug rechnet `update()` wie vorher.
 */
export const FLUG_S = 3; // SW: Patrick 22.10.2026 („Kameraflug Teil → Ziel, 3 s, kein Text")
const FLUG_NICK = 0.8; // SW: ~46° von oben — Teil und Ziel liegen frei, nicht hinter Kanten
const FLUG_ABSTAND_TEIL = 9; // SW: Teil (1–5 m) fuellt etwa ein Drittel der Bildhoehe
const FLUG_ABSTAND_ZIEL = 13; // SW: Mulde/Presse/Kreis sind groesser als ein Teil
const FLUG_MIN_HOEHE = 1.5; // SW: Auftrag 41-P3b — nie in den Boden oder knapp darueber
/**
 * SW: Ein Ruckler (bis 0,25 s Bildabstand, main.ts) spult hoechstens 33 ms
 * Flug vor — das Bild springt nicht, der Flug dauert dann etwas laenger.
 */
const FLUG_DT_MAX = 1 / 30;

const sanft = (u: number): number => u * u * (3 - 2 * u); // smoothstep, 0…1

interface Flug {
  t: number;
  dauer: number;
  teil: THREE.Vector3;
  ziel: THREE.Vector3;
  augeTeil: THREE.Vector3;
  augeZiel: THREE.Vector3;
}

export class OrbitCamera {
  readonly camera: THREE.PerspectiveCamera;
  mode: ViewMode = "orbit";
  private yaw = START.orbit.yaw; // Blick von hinten auf den Bagger
  private pitch = START.orbit.pitch;
  private dist = START.orbit.dist;
  private headYaw = 0;
  private headPitch = 0;
  private smoothedTarget = new THREE.Vector3();
  private tmpTarget = new THREE.Vector3();
  private tmpEye = new THREE.Vector3();
  /** von main gesetzt, wenn der Ansicht-Button per Touch gedrückt wurde */
  touchViewPress = false;

  /**
   * E-196: Nur lesen — der Lehrgang (Lektion Kamera) beobachtet, ob der
   * Spieler gedreht, geneigt oder gezoomt hat. Aendert nichts an der Kamera.
   */
  get blick(): { modus: ViewMode; gier: number; nick: number; abstand: number } {
    return { modus: this.mode, gier: this.yaw, nick: this.pitch, abstand: this.dist };
  }

  /** Auftrag 41-P3b: laufender Kameraflug, null = normale Kamera */
  private flug: Flug | null = null;
  private flugAuge = new THREE.Vector3();
  private flugBlick = new THREE.Vector3();
  private normAuge = new THREE.Vector3();

  /** Auftrag 41-P3b: Solange true, ruht in main.ts die Simulation wie in der Pause. */
  get fliegt(): boolean {
    return this.flug !== null;
  }

  /**
   * Auftrag 41-P3b: Flug normale Lage → Teil → Ziel → normale Lage, je ein
   * Drittel von `dauerS`. Nur in der Ansicht Orbit; sonst passiert nichts.
   * Die Blickrichtung (Gier) bleibt die des Spielers — nur Hoehe und
   * Abstand aendern sich, damit Norden nachher dort ist, wo er vorher war.
   */
  starteFlug(teil: { x: number; y: number; z: number }, ziel: { x: number; y: number; z: number }, dauerS = FLUG_S): void {
    if (this.mode !== "orbit" || !(dauerS > 0)) return;
    const richtung = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(FLUG_NICK),
      Math.sin(FLUG_NICK),
      Math.cos(this.yaw) * Math.cos(FLUG_NICK)
    );
    const t = new THREE.Vector3(teil.x, teil.y, teil.z);
    const z = new THREE.Vector3(ziel.x, ziel.y, ziel.z);
    this.flug = {
      t: 0,
      dauer: dauerS,
      teil: t,
      ziel: z,
      augeTeil: t.clone().addScaledVector(richtung, FLUG_ABSTAND_TEIL),
      augeZiel: z.clone().addScaledVector(richtung, FLUG_ABSTAND_ZIEL),
    };
  }

  /** Auftrag 41-P3b: Flug beenden — die Kamera steht im selben Bild in der normalen Lage. */
  abbrechenFlug(): void {
    if (!this.flug) return;
    this.flug = null;
    this.setzeNormalePose();
  }

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 300);
    this.camera.rotation.order = "YXZ";
  }

  /** Aktuelle Ansicht auf ihren Startpunkt stellen. */
  private zumStart(): void {
    if (this.mode === "cabin") {
      this.headYaw = 0;
      this.headPitch = CABIN_HEAD_PITCH;
      return;
    }
    const s = START[this.mode];
    this.yaw = s.yaw;
    this.pitch = s.pitch;
    this.dist = s.dist;
  }

  update(
    dt: number,
    input: Input,
    getTarget: (out: THREE.Vector3) => THREE.Vector3,
    getCabin: (out: THREE.Vector3) => number // füllt Augpunkt, liefert Basis-Yaw
  ): void {
    if (this.flug && this.mode !== "orbit") this.flug = null; // Ansicht von aussen umgestellt
    if (this.flug) {
      this.flugTakt(dt, getTarget);
      return;
    }
    if (input.wasPressed("KeyC") || this.touchViewPress) {
      this.touchViewPress = false;
      this.mode =
        this.mode === "orbit"
          ? "top"
          : this.mode === "top"
            ? "cabin"
            : this.mode === "cabin"
              ? "side"
              : "orbit";
      const fov = this.mode === "cabin" ? 80 : 55;
      if (this.camera.fov !== fov) {
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
      }
      this.zumStart();
    }
    if (input.camReset) this.zumStart();

    if (this.mode === "cabin") {
      this.headYaw = THREE.MathUtils.clamp(
        this.headYaw - input.orbitDX * 0.004,
        -3.2, // volle Rundumsicht (±180° + etwas Schulterblick)
        3.2
      );
      this.headPitch = THREE.MathUtils.clamp(
        this.headPitch - input.orbitDY * 0.004,
        -1.15, // weit genug nach unten, um auf die Konsolen zu schauen
        0.8
      );
      const baseYaw = getCabin(this.tmpEye);
      this.camera.position.copy(this.tmpEye);
      // Kamera schaut entlang -Z → π Versatz, damit Blick = Kabinenfront (+Z)
      this.camera.rotation.set(this.headPitch, baseYaw + this.headYaw + Math.PI, 0);
      return;
    }

    const s = START[this.mode];
    this.yaw -= input.orbitDX * 0.006;
    this.pitch = THREE.MathUtils.clamp(this.pitch + input.orbitDY * 0.005, s.pitchMin, s.pitchMax);
    let dist = this.dist * input.zoomFactor;
    if (input.shiftHeld && input.wheelDelta !== 0) dist += input.wheelDelta * 1.2;
    this.dist = THREE.MathUtils.clamp(dist, s.distMin, s.distMax);

    getTarget(this.tmpTarget);
    this.smoothedTarget.lerp(this.tmpTarget, Math.min(dt * 6, 1));
    this.setzeNormalePose();
  }

  /** Kugel um das geglaettete Ziel — die Rechnung, die vor 41-P3b am Ende von update() stand. */
  private setzeNormalePose(): void {
    this.tmpEye
      .set(
        Math.sin(this.yaw) * Math.cos(this.pitch),
        Math.sin(this.pitch),
        Math.cos(this.yaw) * Math.cos(this.pitch)
      )
      .multiplyScalar(this.dist);
    this.camera.position.copy(this.smoothedTarget).add(this.tmpEye);
    this.camera.lookAt(this.smoothedTarget);
  }

  /**
   * Ein Flugbild. Eingaben werden nicht gelesen (verworfen), ein gedrueckter
   * Ansicht-Knopf geloescht. Erst die normale Lage wie ohne Flug, dann der
   * Flug darueber; am Ende bleibt die normale Lage stehen.
   */
  private flugTakt(dt: number, getTarget: (out: THREE.Vector3) => THREE.Vector3): void {
    const f = this.flug!;
    this.touchViewPress = false;
    getTarget(this.tmpTarget);
    this.smoothedTarget.lerp(this.tmpTarget, Math.min(dt * 6, 1));
    this.setzeNormalePose();
    f.t += Math.min(dt, FLUG_DT_MAX);
    if (f.t >= f.dauer) {
      this.flug = null; // letztes Bild = normale Lage, genau wie ohne Flug
      return;
    }
    this.normAuge.copy(this.camera.position);
    const u = (f.t / f.dauer) * 3; // drei gleich lange Abschnitte
    if (u < 1) {
      const s = sanft(u);
      this.flugAuge.lerpVectors(this.normAuge, f.augeTeil, s);
      this.flugBlick.lerpVectors(this.smoothedTarget, f.teil, s);
    } else if (u < 2) {
      const s = sanft(u - 1);
      this.flugAuge.lerpVectors(f.augeTeil, f.augeZiel, s);
      this.flugBlick.lerpVectors(f.teil, f.ziel, s);
    } else {
      const s = sanft(u - 2);
      this.flugAuge.lerpVectors(f.augeZiel, this.normAuge, s);
      this.flugBlick.lerpVectors(f.ziel, this.smoothedTarget, s);
    }
    this.flugAuge.y = Math.max(this.flugAuge.y, FLUG_MIN_HOEHE);
    this.camera.position.copy(this.flugAuge);
    this.camera.lookAt(this.flugBlick);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
