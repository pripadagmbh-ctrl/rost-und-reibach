import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { OrbitCamera, FLUG_S, type ViewMode } from "../src/excavator/orbitCamera";
import type { Input } from "../src/core/input";

/*
 * Auftrag 41-P3b: Kameraflug zum Start einer Pruefung (Teil → Ziel → zurueck,
 * 3 s). Bewacht wird: Nach dem Flug steht die Kamera exakt, wo sie ohne Flug
 * stuende; Eingaben im Flug bleiben folgenlos; Abbrechen landet im selben
 * Bild in der normalen Lage; nur in Orbit; bei 1 s ist das Teil, bei 2 s das
 * Ziel in der Bildmitte; nie unter 1,5 m; ohne Flug rechnet update() Bit fuer
 * Bit wie vor dem Auftrag.
 */

const DT = 1 / 60;

interface Ein {
  dx?: number;
  dy?: number;
  zoom?: number;
  rad?: number;
  shift?: boolean;
  reset?: boolean;
  tasten?: string[];
}
const eingabe = (e: Ein = {}): Input =>
  ({
    wasPressed: (c: string) => (e.tasten ?? []).includes(c),
    orbitDX: e.dx ?? 0,
    orbitDY: e.dy ?? 0,
    zoomFactor: e.zoom ?? 1,
    camReset: e.reset ?? false,
    shiftHeld: e.shift ?? false,
    wheelDelta: e.rad ?? 0,
  }) as unknown as Input;
const LEER = eingabe();

/** Der Bagger faehrt waehrend des Flugs weiter, damit die Ziel-Glaettung etwas zu tun hat. */
const baggerZiel = (zeit: { t: number }) => (out: THREE.Vector3): THREE.Vector3 =>
  out.set(Math.sin(zeit.t) * 2, 2.6, zeit.t * 0.8);
const kabine = (out: THREE.Vector3): number => (out.set(0, 2.2, 0.4), 0.3);

const TEIL = { x: 6, y: 0.4, z: 9 };
const ZIEL = { x: -9, y: 1.2, z: 16 };

function gleich(a: OrbitCamera, b: OrbitCamera, tol = 1e-9): void {
  expect(a.camera.position.distanceTo(b.camera.position)).toBeLessThanOrEqual(tol);
  expect(Math.abs(a.camera.quaternion.dot(b.camera.quaternion))).toBeGreaterThanOrEqual(1 - tol);
  for (const k of ["x", "y", "z", "w"] as const) {
    expect(Math.abs(a.camera.quaternion[k] - b.camera.quaternion[k])).toBeLessThanOrEqual(tol);
  }
}

/** Zwei Kameras mit gleicher Vorgeschichte (etwas gedreht, gezoomt). */
function paar(): { a: OrbitCamera; b: OrbitCamera; zeit: { t: number }; takt: (ea?: Input, eb?: Input) => void } {
  const a = new OrbitCamera(812 / 375);
  const b = new OrbitCamera(812 / 375);
  const zeit = { t: 0 };
  const ziel = baggerZiel(zeit);
  const takt = (ea: Input = LEER, eb: Input = ea): void => {
    zeit.t += DT;
    a.update(DT, ea, ziel, kabine);
    b.update(DT, eb, ziel, kabine);
  };
  for (let i = 0; i < 40; i++) takt(eingabe({ dx: i % 3, dy: -0.5, zoom: 0.995 }));
  return { a, b, zeit, takt };
}

function fliegeAus(p: ReturnType<typeof paar>, ea: (i: number) => Input = () => LEER): number {
  let n = 0;
  while (p.a.fliegt && n < 1000) {
    p.takt(ea(n), LEER);
    n++;
  }
  return n;
}

describe("Kameraflug zum Pruefungsstart (Auftrag 41-P3b)", () => {
  it("(1) nach dem Flug steht die Kamera exakt wie ohne Flug — und verhaelt sich danach gleich", () => {
    const p = paar();
    p.a.starteFlug(TEIL, ZIEL);
    expect(p.a.fliegt).toBe(true);
    const bilder = fliegeAus(p);
    expect(p.a.fliegt).toBe(false);
    expect(bilder * DT).toBeGreaterThan(FLUG_S - 2 * DT);
    expect(bilder * DT).toBeLessThan(FLUG_S + 2 * DT);
    gleich(p.a, p.b);
    expect(p.a.blick).toEqual(p.b.blick);
    for (let i = 0; i < 60; i++) {
      p.takt(eingabe({ dx: 3, dy: 1, zoom: 1.01, tasten: i === 30 ? ["KeyC"] : [] }));
      gleich(p.a, p.b);
    }
  });

  it("(2) Eingaben waehrend des Flugs aendern nichts an der Lage danach", () => {
    const p = paar();
    p.a.starteFlug(TEIL, ZIEL);
    fliegeAus(p, (i) => {
      if (i === 20) p.a.touchViewPress = true;
      return eingabe({
        dx: 40,
        dy: -25,
        zoom: 0.7,
        rad: 3,
        shift: true,
        reset: i % 17 === 0,
        tasten: i % 25 === 0 ? ["KeyC"] : [],
      });
    });
    expect(p.a.mode).toBe("orbit");
    expect(p.a.touchViewPress).toBe(false); // verworfen, nicht fuer spaeter gespeichert
    expect(p.a.blick).toEqual(p.b.blick);
    gleich(p.a, p.b);
  });

  it("(3) abbrechenFlug mitten drin: im selben Bild exakt die normale Lage", () => {
    for (const nach of [1, 45, 90, 150]) {
      const p = paar();
      p.a.starteFlug(TEIL, ZIEL);
      for (let i = 0; i < nach; i++) p.takt(eingabe({ dx: 9 }), LEER);
      expect(p.a.fliegt).toBe(true);
      p.a.abbrechenFlug();
      expect(p.a.fliegt).toBe(false);
      gleich(p.a, p.b);
      p.a.abbrechenFlug(); // zweimal schadet nicht
      gleich(p.a, p.b);
      p.takt();
      gleich(p.a, p.b);
    }
  });

  it("(4) in Draufsicht, Kabine und Seite kein Flug", () => {
    const folge: ViewMode[] = ["top", "cabin", "side"];
    const p = paar();
    for (const m of folge) {
      p.takt(eingabe({ tasten: ["KeyC"] }));
      expect(p.a.mode).toBe(m);
      p.a.starteFlug(TEIL, ZIEL);
      expect(p.a.fliegt).toBe(false);
      p.takt();
      gleich(p.a, p.b);
    }
  });

  it("(4b) wird die Ansicht von aussen umgestellt, endet der Flug", () => {
    const p = paar();
    p.a.starteFlug(TEIL, ZIEL);
    p.takt();
    p.a.mode = "top";
    p.b.mode = "top";
    p.takt();
    expect(p.a.fliegt).toBe(false);
    gleich(p.a, p.b);
  });

  it("(5) bei 1 s liegt das Teil, bei 2 s das Ziel in der Bildmitte", () => {
    for (const aspekt of [812 / 375, 1180 / 820]) {
      const p = paar();
      p.a.resize(aspekt);
      p.a.starteFlug(TEIL, ZIEL);
      const pruefe = (punkt: { x: number; y: number; z: number }): number => {
        const cam = p.a.camera;
        cam.updateMatrixWorld();
        const frustum = new THREE.Frustum().setFromProjectionMatrix(
          new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)
        );
        const v = new THREE.Vector3(punkt.x, punkt.y, punkt.z);
        expect(frustum.containsPoint(v)).toBe(true);
        const ndc = v.clone().project(cam);
        return Math.hypot(ndc.x, ndc.y);
      };
      for (let i = 0; i < 60; i++) p.takt();
      const mitteTeil = pruefe(TEIL);
      for (let i = 0; i < 60; i++) p.takt();
      const mitteZiel = pruefe(ZIEL);
      expect(mitteTeil).toBeLessThan(0.05);
      expect(mitteZiel).toBeLessThan(0.05);
      console.log(`[41-P3b] Aspekt ${aspekt.toFixed(2)}: Teil bei 1 s ${mitteTeil.toFixed(4)}, Ziel bei 2 s ${mitteZiel.toFixed(4)} (NDC-Abstand zur Mitte)`);
    }
  });

  it("(6) die Kamera kommt nie unter 1,5 m — auch tief gelegene Punkte und flache Startlage", () => {
    const faelle: [typeof TEIL, typeof ZIEL][] = [
      [TEIL, ZIEL],
      [{ x: 2, y: 0, z: 3 }, { x: 25, y: 0, z: -20 }],
      [{ x: 0, y: -8, z: 4 }, { x: 4, y: -12, z: 0 }], // erzwungen: Punkte unter dem Boden
    ];
    for (const [teil, ziel] of faelle) {
      const p = paar();
      for (let i = 0; i < 80; i++) p.takt(eingabe({ dy: -40, zoom: 0.9 })); // flach und nah
      p.a.starteFlug(teil, ziel);
      let tiefste = Infinity;
      while (p.a.fliegt) {
        p.takt();
        tiefste = Math.min(tiefste, p.a.camera.position.y);
      }
      expect(tiefste).toBeGreaterThanOrEqual(1.5);
    }
  });

  it("(7) Gegenprobe: ohne Rueckkehr-Abschnitt laege die Kamera weit daneben; die Rueckkehr ist ein Blend, kein Schnitt", () => {
    const p = paar();
    p.a.starteFlug(TEIL, ZIEL);
    let n = 0;
    const abstaende: number[] = [];
    let maxSchritt = 0;
    let maxDreh = 0;
    let vorher = p.a.camera.position.clone();
    let vorherQ = p.a.camera.quaternion.clone();
    let abstandBei2s = 0;
    while (p.a.fliegt) {
      p.takt();
      n++;
      if (n === 120) abstandBei2s = p.a.camera.position.distanceTo(p.b.camera.position);
      abstaende.push(p.a.camera.position.distanceTo(p.b.camera.position));
      maxSchritt = Math.max(maxSchritt, p.a.camera.position.distanceTo(vorher));
      maxDreh = Math.max(maxDreh, p.a.camera.quaternion.angleTo(vorherQ));
      vorher = p.a.camera.position.clone();
      vorherQ = p.a.camera.quaternion.clone();
    }
    // Ein Flug, der nach dem Ziel-Abschnitt aufhoerte, fiele in (1) durch:
    expect(abstandBei2s).toBeGreaterThan(5);
    // 50 ms vor dem Ende ist die Kamera schon fast zurueck, aber noch unterwegs — ein Blend, kein Schnitt
    const letzterAbstand = abstaende[abstaende.length - 4];
    expect(letzterAbstand).toBeGreaterThan(0);
    expect(letzterAbstand).toBeLessThan(0.1);
    expect(abstaende[abstaende.length - 1]).toBe(0);
    // Je Bild (60 Hz) hoechstens 0,5 m und 3° — keine Spruenge
    expect(maxSchritt).toBeLessThan(0.5);
    expect(maxDreh).toBeLessThan(THREE.MathUtils.degToRad(3));
    console.log(
      `[41-P3b] Abstand zur normalen Lage bei 2 s ${abstandBei2s.toFixed(2)} m, letztes Flugbild ${(letzterAbstand * 1000).toFixed(1)} mm (3 Bilder vor Ende), ` +
        `groesster Schritt je Bild ${(maxSchritt * 100).toFixed(1)} cm, groesste Drehung je Bild ${THREE.MathUtils.radToDeg(maxDreh).toFixed(2)}°`
    );
  });

  it("(7b) ein Ruckler (0,25 s Bildabstand) laesst den Flug nicht springen", () => {
    const p = paar();
    p.a.starteFlug(TEIL, ZIEL);
    for (let i = 0; i < 50; i++) p.takt();
    const vorher = p.a.camera.position.clone();
    const zeit = p.zeit;
    zeit.t += 0.25;
    p.a.update(0.25, LEER, baggerZiel(zeit), kabine);
    const schritt = p.a.camera.position.distanceTo(vorher);
    expect(p.a.fliegt).toBe(true);
    expect(schritt).toBeLessThan(1);
    console.log(`[41-P3b] Ruckler 0,25 s: Schritt ${(schritt * 100).toFixed(1)} cm`);
  });

  it("Messung: Flugbahn (Hoehen, Abstand der Punkte zur Bildmitte)", () => {
    const p = paar();
    p.a.starteFlug(TEIL, ZIEL);
    const zeilen: string[] = [];
    let n = 0;
    while (p.a.fliegt) {
      p.takt();
      n++;
      if (n % 15 === 0) {
        const cam = p.a.camera;
        cam.updateMatrixWorld();
        const m = (q: typeof TEIL): string => {
          const v = new THREE.Vector3(q.x, q.y, q.z).project(cam);
          return Math.hypot(v.x, v.y).toFixed(2);
        };
        zeilen.push(`t=${(n * DT).toFixed(2)} s  y=${cam.position.y.toFixed(2)} m  Teil ${m(TEIL)}  Ziel ${m(ZIEL)}`);
      }
    }
    console.log("[41-P3b] Flugbahn (NDC-Abstand zur Bildmitte, 1 = Bildrand):\n" + zeilen.join("\n"));
    expect(zeilen.length).toBeGreaterThan(10);
  });

  it("Messung: weiter Fall — Teil und Ziel 40 m auseinander", () => {
    const p = paar();
    p.a.starteFlug({ x: 5, y: 0.3, z: 6 }, { x: -30, y: 1, z: 26 });
    let vorher = p.a.camera.position.clone();
    let vorherQ = p.a.camera.quaternion.clone();
    let maxSchritt = 0;
    let maxDreh = 0;
    while (p.a.fliegt) {
      p.takt();
      maxSchritt = Math.max(maxSchritt, p.a.camera.position.distanceTo(vorher));
      maxDreh = Math.max(maxDreh, p.a.camera.quaternion.angleTo(vorherQ));
      vorher = p.a.camera.position.clone();
      vorherQ = p.a.camera.quaternion.clone();
    }
    gleich(p.a, p.b);
    console.log(
      `[41-P3b] weit: groesster Schritt je Bild ${(maxSchritt * 100).toFixed(1)} cm (${(maxSchritt * 60).toFixed(1)} m/s), ` +
        `groesste Drehung je Bild ${THREE.MathUtils.radToDeg(maxDreh).toFixed(2)}°`
    );
  });
});

/*
 * Ohne Flug muss update() Bit fuer Bit rechnen wie vor dem Auftrag. Hier
 * steht eine Kopie der alten Rechnung (orbitCamera.ts, Stand E-136/E-196,
 * vor 41-P3b) und laeuft gegen die echte Klasse.
 */
const START_ALT = {
  orbit: { yaw: Math.PI, pitch: 0.42, dist: 11, pitchMin: 0.08, pitchMax: 1.35, distMin: 3, distMax: 18 },
  top: { yaw: Math.PI, pitch: Math.atan2(25, 14.4), dist: Math.hypot(25, 14.4), pitchMin: 0.6, pitchMax: 1.5, distMin: 10, distMax: 40 },
  side: { yaw: Math.PI * 1.5, pitch: Math.atan2(6.5, 15), dist: Math.hypot(15, 6.5), pitchMin: 0.08, pitchMax: 1.2, distMin: 5, distMax: 28 },
};
class AlteKamera {
  readonly camera = new THREE.PerspectiveCamera(55, 1.5, 0.1, 300);
  mode: ViewMode = "orbit";
  yaw = START_ALT.orbit.yaw;
  pitch = START_ALT.orbit.pitch;
  dist = START_ALT.orbit.dist;
  headYaw = 0;
  headPitch = 0;
  smoothedTarget = new THREE.Vector3();
  tmpTarget = new THREE.Vector3();
  tmpEye = new THREE.Vector3();
  touchViewPress = false;
  constructor() {
    this.camera.rotation.order = "YXZ";
  }
  zumStart(): void {
    if (this.mode === "cabin") {
      this.headYaw = 0;
      this.headPitch = -0.22;
      return;
    }
    const s = START_ALT[this.mode];
    this.yaw = s.yaw;
    this.pitch = s.pitch;
    this.dist = s.dist;
  }
  update(dt: number, input: Input, getTarget: (o: THREE.Vector3) => THREE.Vector3, getCabin: (o: THREE.Vector3) => number): void {
    if (input.wasPressed("KeyC") || this.touchViewPress) {
      this.touchViewPress = false;
      this.mode = this.mode === "orbit" ? "top" : this.mode === "top" ? "cabin" : this.mode === "cabin" ? "side" : "orbit";
      const fov = this.mode === "cabin" ? 80 : 55;
      if (this.camera.fov !== fov) {
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
      }
      this.zumStart();
    }
    if (input.camReset) this.zumStart();
    if (this.mode === "cabin") {
      this.headYaw = THREE.MathUtils.clamp(this.headYaw - input.orbitDX * 0.004, -3.2, 3.2);
      this.headPitch = THREE.MathUtils.clamp(this.headPitch - input.orbitDY * 0.004, -1.15, 0.8);
      const baseYaw = getCabin(this.tmpEye);
      this.camera.position.copy(this.tmpEye);
      this.camera.rotation.set(this.headPitch, baseYaw + this.headYaw + Math.PI, 0);
      return;
    }
    const s = START_ALT[this.mode];
    this.yaw -= input.orbitDX * 0.006;
    this.pitch = THREE.MathUtils.clamp(this.pitch + input.orbitDY * 0.005, s.pitchMin, s.pitchMax);
    let dist = this.dist * input.zoomFactor;
    if (input.shiftHeld && input.wheelDelta !== 0) dist += input.wheelDelta * 1.2;
    this.dist = THREE.MathUtils.clamp(dist, s.distMin, s.distMax);
    getTarget(this.tmpTarget);
    this.smoothedTarget.lerp(this.tmpTarget, Math.min(dt * 6, 1));
    this.tmpEye
      .set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch))
      .multiplyScalar(this.dist);
    this.camera.position.copy(this.smoothedTarget).add(this.tmpEye);
    this.camera.lookAt(this.smoothedTarget);
  }
}

describe("Ohne Flug: update() bit-gleich zur Rechnung vor 41-P3b", () => {
  it("1500 Bilder mit zufaelligen Eingaben, Ansichtswechseln und Ruecksetzern", () => {
    let saat = 41;
    const zufall = (): number => {
      saat = (saat * 1103515245 + 12345) % 2147483648;
      return saat / 2147483648;
    };
    const neu = new OrbitCamera(1.5);
    const alt = new AlteKamera();
    const zeit = { t: 0 };
    const ziel = baggerZiel(zeit);
    for (let i = 0; i < 1500; i++) {
      const dt = zufall() < 0.05 ? 0.25 : 1 / 60 + zufall() * 0.01;
      zeit.t += dt;
      const e = eingabe({
        dx: (zufall() - 0.5) * 60,
        dy: (zufall() - 0.5) * 40,
        zoom: 0.95 + zufall() * 0.1,
        rad: zufall() < 0.1 ? (zufall() - 0.5) * 6 : 0,
        shift: zufall() < 0.5,
        reset: zufall() < 0.01,
        tasten: zufall() < 0.02 ? ["KeyC"] : [],
      });
      const knopf = zufall() < 0.01;
      neu.touchViewPress = knopf;
      alt.touchViewPress = knopf;
      neu.update(dt, e, ziel, kabine);
      alt.update(dt, e, ziel, kabine);
      expect(neu.mode).toBe(alt.mode);
      expect(neu.camera.fov).toBe(alt.camera.fov);
      for (const k of ["x", "y", "z"] as const) expect(neu.camera.position[k]).toBe(alt.camera.position[k]);
      for (const k of ["x", "y", "z", "w"] as const) expect(neu.camera.quaternion[k]).toBe(alt.camera.quaternion[k]);
    }
  });
});
