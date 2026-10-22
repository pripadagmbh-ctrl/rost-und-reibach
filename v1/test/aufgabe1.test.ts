/**
 * AUFGABE 1 „ERSTER GRIFF" (E-162, 19.10.2026).
 *
 * Patrick: Ein Fremder startet das Spiel und soll in zwei Minuten verstehen,
 * wie man greift. Geprueft wird hier:
 *
 *  1. die Geometrie gegen den ECHTEN Bagger: Ausladung in der Startpose und
 *     nach Absenken des Hauptarms, und dass das Kupferteil genau dort liegt —
 *     15° neben der Blickrichtung, auf Drehen + Hauptarm erreichbar, frei von
 *     Mulden, Spuren und Abkippstelle, die Box auf derselben Ausladung;
 *  2. Greifbarkeit: Der Fuenfschalengreifer packt das Teil auch mit 0,8 m
 *     Versatz (Herkunft von `SPINNE_WAAGRECHT_M`);
 *  3. der ganze Ablauf mit dem echten Bagger, echten Mulden und den echten
 *     Quellen (`weltQuellen`): drehen, senken, schliessen, heben, schwenken,
 *     oeffnen — sechs Schritte, jeder gesehen, am Ende im Ziel;
 *  4. der Ablauf mit Attrappen: Ueberspringen, Fehlwurf, harter Aufschlag nur
 *     eigener Koerper, beendeter Lauf stumm, Reihenfolge der Ereignisse;
 *  5. die Texte: zweisprachig, nicht leer, dieselben Platzhalter.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { GripSystem } from "../src/physics/gripSystem";
import { formZu, setzeGreifer } from "../src/excavator/greiferwahl";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { CONFIGS, ContainerManager } from "../src/world/containers";
import { PRESS_CENTER, PRESS_INNER } from "../src/world/press";
import { BESEN_PLATZ } from "../src/world/startplatz";
import { BESEN } from "../src/world/scrapItems";
import { BAGGER_STAND, SCHWENK_AUSSEN, SCHWENK_INNEN, abstandVomStand } from "../src/world/baggerstand";
import { hitsObstacle } from "../src/world/obstacles";
import { ABKIPP_ZONE, ABLADE_HALT_Z, ABLADE_SPUR_X, BED_LEN } from "../src/delivery/routes";
import { LaneWatch } from "../src/delivery/laneWatch";
import { EventBus, type GameEvents } from "../src/core/events";
import { CHALLENGES } from "../src/challenges/katalog";
import {
  BLICK_TOLERANZ_RAD,
  ChallengeLauf,
  HART_AB_MS,
  SPINNE_HOEHE_M,
  SPINNE_WAAGRECHT_M,
  sterne,
  type ChallengeQuellen,
  type Punkt,
} from "../src/challenges/challenge";
import { baueAufgabe, formAusSpec, teilSpec } from "../src/challenges/aufbau";
import { behaelterOberkante, weltQuellen } from "../src/challenges/quellen";
import { umkugelRadius } from "../src/world/scrapItems";
import type { Zweisprachig } from "../src/challenges/texte";

const DT = 1 / 60;
const GRAD = 180 / Math.PI;
const A1 = CHALLENGES[0]!;
const TEIL = A1.aufbau.teile![0]!;
const SPEC = teilSpec(TEIL.name)!;
const UMKREIS = umkugelRadius(formAusSpec(SPEC));

beforeAll(async () => {
  leinwandAttrappe();
  await RAPIER.init();
});

/* ======================================================================== */
/* Werkbank: der echte Bagger auf ebenem Beton                               */
/* ======================================================================== */

function werkbank(mitMulden = false) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = DT;
  // dieselben Kontaktwerte wie im Spiel (`physicsWorld.ts`), wie in `test/boden.test.ts`
  const p = world.integrationParameters;
  p.numSolverIterations = 6;
  p.contact_natural_frequency = 30;
  p.normalizedAllowedLinearError = 0.005;
  p.numAdditionalFrictionIterations = 2;
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(100, 0.5, 100).setTranslation(0, -0.5, 0), boden);
  const scene = new THREE.Scene();
  const bus = new EventBus();
  const items = new ItemManager(scene, world);
  const composites = new CompositeManager(scene, world, items, bus);
  const containers = mitMulden ? new ContainerManager(scene, world, bus) : null;
  const b = new Excavator(scene, world);
  const grip = new GripSystem(world, b.grappleBody);
  setzeGreifer(b, grip, formZu(A1.aufbau.greifer!));
  grip.insideGrapple = (q) => b.isInsideGrapple(q);
  grip.krallenKontakte = (x) => b.krallenKontakte(x);
  // wie main.ts: Aufschlaege mit Handle auf den Bus
  items.onAufprall = (it, wucht) => {
    const t = it.body.translation();
    bus.emit("schrott:aufprall", {
      materialId: it.materialId,
      massKg: it.massKg,
      wucht,
      blech: false,
      untergrund: "beton",
      handle: it.body.handle,
      x: t.x,
      y: t.y,
      z: t.z,
    });
  };
  const down = new Set<string>();
  const inp = {
    wheelDelta: 0,
    shiftHeld: false,
    isDown: (c: string) => down.has(c),
    wasPressed: () => false,
    mouseHeld: () => false,
    axis: (n: string, q: string) => (down.has(q) ? 1 : 0) - (down.has(n) ? 1 : 0),
    endFrame() {},
  };
  const sensor = new THREE.Vector3();
  let schritt = 0;
  const takt = (): void => {
    b.update(DT, inp as never);
    grip.update(b.closure, b.closing, b.getSensorPosition(sensor), DT);
    world.step();
    items.clampSpeeds(DT);
    b.carriedCount = grip.grippedCount;
    b.carriedMassKg = grip.totalMassKg;
    b.grippedHandles.clear();
    for (const g of grip.grippedBodies) b.grippedHandles.add(g.handle);
    // wie main.ts: Zonen-Zaehlung alle 10 Schritte
    if (containers && ++schritt % 10 === 0) containers.recount(items, new Set(grip.grippedBodies.map((g) => g.handle)));
  };
  return { world, bus, items, composites, containers, b, grip, down, takt, sensor };
}

/** Startpose und abgesenkte Pose, gemessen — die Zahlen im Kopf von `katalog.ts`. */
let MESSUNG: {
  start: { ausladung: number; gelenkY: number; sensorY: number };
  gesenkt: { ausladung: number; gelenkY: number; sensorY: number; boomGrad: number };
} | null = null;

function messePosen() {
  if (MESSUNG) return MESSUNG;
  const k = werkbank();
  for (let i = 0; i < 120; i++) k.takt();
  const lage = () => ({
    ausladung: k.b.ausladungM,
    gelenkY: k.b.grappleGroup.position.y,
    sensorY: k.b.getSensorPosition(k.sensor).y,
  });
  const start = lage();
  k.down.add("KeyF");
  let ruhig = 0;
  let yAlt = Infinity;
  for (let i = 0; i < 1200 && ruhig < 30; i++) {
    k.takt();
    const y = k.b.grappleGroup.position.y;
    ruhig = Math.abs(y - yAlt) < 0.0005 ? ruhig + 1 : 0;
    yAlt = y;
  }
  k.down.clear();
  for (let i = 0; i < 60; i++) k.takt();
  MESSUNG = { start, gesenkt: { ...lage(), boomGrad: k.b.boomAngle * GRAD } };
  k.world.free();
  return MESSUNG;
}

/* ======================================================================== */
/* 1 — Lage, gerechnet gegen den echten Bagger                               */
/* ======================================================================== */

/** Abstand eines Punktes zum Rand eines achsparallelen Rechtecks (negativ = drin) — wie `test/besen.test.ts`. */
function zuRechteck(x: number, z: number, cx: number, cz: number, sx: number, sz: number): number {
  const dx = Math.abs(x - cx) - sx / 2;
  const dz = Math.abs(z - cz) - sz / 2;
  return dx < 0 && dz < 0 ? Math.max(dx, dz) : Math.hypot(Math.max(dx, 0), Math.max(dz, 0));
}

const winkelZumTeil = (): number => Math.atan2(TEIL.x - BAGGER_STAND.x, TEIL.z - BAGGER_STAND.z);

describe("Aufgabe 1: wo das Kupferteil liegt", () => {
  it("Aufgabe 1 ist die erste im Katalog — erster Start und Freischalt-Reihenfolge", () => {
    expect(A1.id).toBe("erster-griff");
    expect(A1.zielBehaelter).toBe("r_bunt");
    expect(SPEC.materialId, "das Teil ist kein Kupfer").toBe("copper");
    expect(SPEC.massKg).toBeLessThan(200);
  });

  it("die Startpose und das Absenken: Zahlen wie im Kopf von katalog.ts", () => {
    const m = messePosen();
    // eslint-disable-next-line no-console
    console.log(
      `Startpose: Ausladung ${m.start.ausladung.toFixed(2)} m, Gelenk ${m.start.gelenkY.toFixed(2)} m, ` +
        `Sensor ${m.start.sensorY.toFixed(2)} m · gesenkt: Hauptarm ${m.gesenkt.boomGrad.toFixed(1)}°, ` +
        `Ausladung ${m.gesenkt.ausladung.toFixed(2)} m, Gelenk ${m.gesenkt.gelenkY.toFixed(2)} m, Sensor ${m.gesenkt.sensorY.toFixed(2)} m`
    );
    expect(m.start.ausladung).toBeCloseTo(8.09, 1);
    expect(m.start.gelenkY).toBeCloseTo(3.64, 1);
    expect(m.gesenkt.ausladung).toBeCloseTo(8.13, 1);
    expect(m.gesenkt.sensorY).toBeCloseTo(1.25, 1);
    expect(m.gesenkt.gelenkY, "der Hauptarm hat gar nicht gesenkt").toBeLessThan(m.start.gelenkY - 0.5);
  });

  it("(b) Drehen + Hauptarm senken reicht: das Teil liegt auf der abgesenkten Ausladung", () => {
    const m = messePosen();
    const r = abstandVomStand(TEIL.x, TEIL.z);
    expect(Math.abs(r - m.gesenkt.ausladung), `Teil ${r.toFixed(2)} m, Spinne ${m.gesenkt.ausladung.toFixed(2)} m`).toBeLessThan(
      SPINNE_WAAGRECHT_M / 2
    );
    // und tief genug: Sensor ueber der Teilmitte unter der Schwelle — aber in der Startpose nicht
    const mitte = SPEC.dims[0]!; // liegender Zylinder: Mitte = Halbmesser (0,35 m)
    expect(m.gesenkt.sensorY - mitte).toBeLessThanOrEqual(SPINNE_HOEHE_M);
    expect(m.start.sensorY - mitte, "Schritt 2 erledigte sich in der Startpose von selbst").toBeGreaterThan(SPINNE_HOEHE_M);
  });

  it("(a) im ersten Bild, 15–30° neben der Blickrichtung — Schritt 1 erledigt sich nicht selbst", () => {
    const w = winkelZumTeil() * GRAD;
    expect(w).toBeGreaterThanOrEqual(15 - 1e-6);
    expect(w).toBeLessThanOrEqual(30);
    expect((w / GRAD) > BLICK_TOLERANZ_RAD * 2, "zu nah an geradeaus").toBe(true);
    // Kamera (orbitCamera.ts): 11 m hinter dem Bagger, Neigung 0,42 rad — waagrecht 10,0 m dahinter
    const kamZ = BAGGER_STAND.z - 11 * Math.cos(0.42);
    const imBild = Math.atan2(TEIL.x - BAGGER_STAND.x, TEIL.z - kamZ) * GRAD;
    // eslint-disable-next-line no-console
    console.log(`Teil ${w.toFixed(1)}° neben der Blickrichtung, von der Kamera aus ${imBild.toFixed(1)}° neben der Bildmitte`);
    expect(Math.abs(imBild), "ausserhalb des ersten Bilds").toBeLessThan(20);
  });

  it("(c) frei: keine Mulde, keine Presse, keine Abkippstelle, keine Spur, kein Bauwerk, nicht auf dem Besen", () => {
    const r = abstandVomStand(TEIL.x, TEIL.z);
    expect(r).toBeGreaterThanOrEqual(SCHWENK_INNEN);
    expect(r).toBeLessThanOrEqual(SCHWENK_AUSSEN);
    let frei = Infinity;
    let grund = "";
    const merke = (ab: number, was: string): void => {
      if (ab < frei) [frei, grund] = [ab, was];
    };
    for (const c of CONFIGS) merke(zuRechteck(TEIL.x, TEIL.z, c.x, c.z, c.size[0], c.size[1]), c.label);
    merke(
      zuRechteck(TEIL.x, TEIL.z, PRESS_CENTER.x, PRESS_CENTER.z, PRESS_INNER.laenge + 0.7, PRESS_INNER.tiefe + 0.7),
      "Presskammer"
    );
    merke(Math.hypot(TEIL.x - ABKIPP_ZONE[0], TEIL.z - ABKIPP_ZONE[1]) - 3.0, "Abkippstelle");
    merke(zuRechteck(TEIL.x, TEIL.z, ABLADE_SPUR_X, ABLADE_HALT_Z, 3.0, BED_LEN.kipper! + 3.0), "Abladespur");
    // eslint-disable-next-line no-console
    console.log(`Teil (${TEIL.x.toFixed(2)} | ${TEIL.z.toFixed(2)}): naechstes ${grund} ${frei.toFixed(2)} m, Umkreis ${UMKREIS.toFixed(2)} m`);
    expect(frei, `zu nah an ${grund}`).toBeGreaterThan(UMKREIS + 0.5);
    expect(hitsObstacle(TEIL.x, TEIL.z, UMKREIS)).toBe(null);
    // Fahrspuren: die echte Spurwache, mit einem Teil, das schwer genug waere, um zu blockieren
    const lw = new LaneWatch({
      items: [{ massKg: 9999, body: { isValid: () => true, isDynamic: () => true, translation: () => ({ x: TEIL.x, y: 0.4, z: TEIL.z }) } }],
    } as never);
    lw.update(1);
    expect(lw.blocked, "das Teil laege auf einer Fahrspur").toBe(false);
    // Besen (nur im Sandkasten): die Umkreise beruehren sich nicht
    const besenR = Math.hypot(BESEN.dims[0]! / 2, BESEN.dims[2]! / 2);
    const zumBesen = Math.hypot(TEIL.x - BESEN_PLATZ.x, TEIL.z - BESEN_PLATZ.z);
    expect(zumBesen, "Teil laege auf dem Besen").toBeGreaterThan(besenR + UMKREIS);
  });

  it("(d) die Box BUNT + VA liegt auf derselben Ausladung — per Schwenk erreichbar", () => {
    const m = messePosen();
    const box = CONFIGS.find((c) => c.id === "r_bunt")!;
    let besterRand = -Infinity;
    let besterWinkel = 0;
    for (let g = -180; g <= 180; g += 0.5) {
      const a = g / GRAD;
      const x = BAGGER_STAND.x + m.gesenkt.ausladung * Math.sin(a);
      const z = BAGGER_STAND.z + m.gesenkt.ausladung * Math.cos(a);
      const rand = -zuRechteck(x, z, box.x, box.z, box.size[0], box.size[1]);
      if (rand > besterRand) [besterRand, besterWinkel] = [rand, g];
    }
    // eslint-disable-next-line no-console
    console.log(
      `Box auf ${m.gesenkt.ausladung.toFixed(2)} m: tiefster Punkt bei ${besterWinkel}° ${besterRand.toFixed(2)} m innerhalb, ` +
        `Schwenk ${(winkelZumTeil() * GRAD - besterWinkel).toFixed(0)}°, Wand ${behaelterOberkante(box).toFixed(2)} m`
    );
    expect(besterRand, "das Teil passt dort nicht hinein").toBeGreaterThan(UMKREIS);
    expect(besterWinkel, "die Box liegt nicht rechts vom Fahrer").toBeLessThan(0);
    expect(behaelterOberkante(box)).toBeCloseTo(2.0, 5);
  });
});

/* ======================================================================== */
/* 2 — Greifbar auch mit Versatz                                             */
/* ======================================================================== */

describe("Aufgabe 1: das Teil ist gut greifbar", () => {
  for (const versatz of [0, SPINNE_WAAGRECHT_M]) {
    it(`Fuenfschalengreifer packt den ${TEIL.name} mit ${versatz} m Versatz quer zum Ausleger`, () => {
      const k = werkbank();
      for (let i = 0; i < 60; i++) k.takt();
      const m = messePosen();
      // Geradeaus statt 15° — dieselbe Lage relativ zum Ausleger (Rohrachse quer), ebener Boden
      const it0 = k.items.spawnScrap(
        SPEC.materialId,
        SPEC.massKg,
        formAusSpec(SPEC),
        new THREE.Vector3(BAGGER_STAND.x + versatz, UMKREIS + 0.02, BAGGER_STAND.z + m.gesenkt.ausladung),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
      );
      for (let i = 0; i < 90; i++) k.takt();
      k.down.add("KeyF");
      for (let i = 0; i < 240; i++) k.takt();
      k.down.clear();
      k.down.add("Space");
      for (let i = 0; i < 90; i++) k.takt();
      k.down.add("KeyR");
      for (let i = 0; i < 120; i++) k.takt();
      expect(k.grip.grippedBodies.some((g) => g.handle === it0.body.handle), "nicht gefasst").toBe(true);
      expect(it0.body.translation().y, "nicht angehoben").toBeGreaterThan(2.5);
      k.world.free();
    }, 60_000);
  }
});

/* ======================================================================== */
/* 3 — Der ganze Ablauf mit dem echten Bagger                                */
/* ======================================================================== */

describe("Aufgabe 1: sechs Schritte mit dem echten Bagger", () => {
  it("drehen, senken, schliessen, heben, schwenken, oeffnen — jeder gesehen, das Teil im Ziel", () => {
    const k = werkbank(true);
    const obj = baueAufgabe(A1, { items: k.items, composites: k.composites });
    k.items.settle(k.world);
    const q = weltQuellen({ bagger: k.b, grip: k.grip, containers: k.containers!, items: k.items, press: null });
    const ereignisse: string[] = [];
    let nr = 0;
    let ende: GameEvents["challenge:geschafft"] | null = null;
    let staende = 0;
    k.bus.on("challenge:start", () => ereignisse.push("start"));
    k.bus.on("challenge:schritt", (e) => {
      ereignisse.push(`schritt ${e.nr}`);
      nr = e.nr;
    });
    k.bus.on("challenge:stand", () => staende++);
    k.bus.on("challenge:geschafft", (e) => {
      ereignisse.push("geschafft");
      ende = e;
    });
    const lauf = new ChallengeLauf(A1, 1, q, k.bus, obj);
    lauf.start();
    let bilder = 0;
    const t = (): void => {
      k.takt();
      lauf.takt(DT);
      bilder++;
    };
    const fehler = (soll: number): number => {
      let d = (soll - k.b.cabinBaseYaw) % (2 * Math.PI);
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      return d;
    };
    /** Wie ein Mensch: drehen, kurz vorher loslassen, nachsteuern, warten. */
    const dreheAuf = (soll: number, halten: string[] = []): void => {
      let alt = k.b.cabinBaseYaw;
      for (let i = 0; i < 900; i++) {
        const d = fehler(soll);
        const dreht = Math.abs(k.b.cabinBaseYaw - alt) > 0.0002; // rad je Bild, nur lesend
        alt = k.b.cabinBaseYaw;
        k.down.clear();
        for (const h of halten) k.down.add(h);
        if (Math.abs(d) > 1.5 / GRAD) k.down.add(d > 0 ? "KeyQ" : "KeyE");
        else if (!dreht) break;
        t();
      }
      k.down.clear();
      for (const h of halten) k.down.add(h);
    };
    const bis = (bed: () => boolean, max: number): void => {
      for (let i = 0; i < max && !bed(); i++) t();
    };

    // 1 — Dreh dich zum Teil
    const teilP = obj.teile[0]!.body.translation();
    dreheAuf(Math.atan2(teilP.x - BAGGER_STAND.x, teilP.z - BAGGER_STAND.z));
    for (let i = 0; i < 60; i++) t(); // Pendel beruhigen
    expect(nr, "Schritt 1 nicht gesehen").toBe(2);
    // 2 — Senk die Spinne ab
    k.down.add("KeyF");
    bis(() => nr >= 3, 600);
    for (let i = 0; i < 40; i++) t();
    k.down.clear();
    expect(nr, "Schritt 2 nicht gesehen").toBe(3);
    // 3 — Schliess die Spinne
    k.down.add("Space");
    bis(() => nr >= 4, 300);
    expect(nr, "Schritt 3 nicht gesehen").toBe(4);
    // 4 — Heb an
    k.down.add("KeyR");
    bis(() => nr >= 5, 600);
    for (let i = 0; i < 20; i++) t();
    k.down.delete("KeyR");
    expect(nr, "Schritt 4 nicht gesehen").toBe(5);
    // 5 — Schwenk zur Box (Mitte, wie die Markierung zeigt)
    const box = q.behaelter("r_bunt")!;
    dreheAuf(Math.atan2(box.x - BAGGER_STAND.x, box.z - BAGGER_STAND.z), ["Space"]);
    for (let i = 0; i < 60; i++) t();
    expect(nr, "Schritt 5 nicht gesehen").toBe(6);
    // 6 — Oeffne die Spinne
    k.down.clear();
    bis(() => ende !== null, 600);

    const it0 = obj.teile[0]!;
    // eslint-disable-next-line no-console
    console.log(
      `Durchlauf: ${(bilder / 60).toFixed(1)} s Spielzeit, ${ereignisse.join(" · ")}, ` +
        `Teil liegt in ${it0.containerId}, Messung ${JSON.stringify(ende ? (ende as GameEvents["challenge:geschafft"]).messung : null)}`
    );
    expect(ereignisse).toEqual([
      "start",
      "schritt 1",
      "schritt 2",
      "schritt 3",
      "schritt 4",
      "schritt 5",
      "schritt 6",
      "geschafft",
    ]);
    expect(it0.containerId).toBe("r_bunt");
    expect(staende, "challenge:stand nicht je Bild").toBe(bilder);
    const e = ende as unknown as GameEvents["challenge:geschafft"];
    expect(e.messung.fehlwuerfe).toBe(0);
    expect(e.messung.fremdteile).toBe(0);
    expect(e.messung.praezisionCm).toBeNull();
    expect(e.sterne).toBe(3); // eine Maschine ist schneller als 1:30
    k.world.free();
  }, 120_000);
});

/* ======================================================================== */
/* 4 — Der Ablauf mit Attrappen                                              */
/* ======================================================================== */

interface Koerper {
  handle: number;
  p: Punkt;
  translation(): Punkt;
  isValid(): boolean;
}

function koerper(handle: number, p: Punkt): Koerper {
  return { handle, p, translation() { return this.p; }, isValid: () => true };
}

/** Eine Welt aus Attrappen: was die Quellen sagen, steht in `w`. */
function attrappe() {
  const teil = koerper(11, { x: TEIL.x, y: 0.35, z: TEIL.z });
  const w = {
    griff: [] as Array<{ handle: number }>,
    spinne: { x: BAGGER_STAND.x, y: 2.14, z: BAGGER_STAND.z + 8.09 } as Punkt,
    blick: 0,
    ueberBox: false,
    behaelter: null as string | null,
  };
  const q: ChallengeQuellen = {
    gegriffen: () => w.griff,
    spinne: () => w.spinne,
    drehmitte: () => BAGGER_STAND,
    blickRad: () => w.blick,
    behaelter: (id) => (id === "r_bunt" ? { x: -7.6, z: -19.8, oberkante: 2.0 } : null),
    ueberBehaelter: (id) => id === "r_bunt" && w.ueberBox,
    behaelterVon: () => w.behaelter,
    ueberKammer: () => false,
    inKammer: () => false,
  };
  const bus = new EventBus();
  const log: string[] = [];
  const schritte: number[] = [];
  const staende: Array<GameEvents["challenge:stand"]> = [];
  let ende: GameEvents["challenge:geschafft"] | null = null;
  bus.on("challenge:start", (e) => log.push(`start ${e.id} ${e.nr}`));
  bus.on("challenge:schritt", (e) => {
    log.push(`schritt ${e.nr}`);
    schritte.push(e.nr);
  });
  bus.on("challenge:stand", (e) => staende.push(e));
  bus.on("challenge:geschafft", (e) => {
    log.push("geschafft");
    ende = e;
  });
  const lauf = new ChallengeLauf(A1, 1, q, bus, { teile: [{ id: "item_7", body: teil }], wracks: [] });
  const zumTeil = Math.atan2(TEIL.x - BAGGER_STAND.x, TEIL.z - BAGGER_STAND.z);
  return {
    teil,
    w,
    bus,
    lauf,
    log,
    schritte,
    staende,
    ende: () => ende as GameEvents["challenge:geschafft"] | null,
    /** Blick und Spinne genau aufs Teil (abgesenkt) */
    ueberTeil(tief = true) {
      w.blick = zumTeil;
      w.spinne = { x: teil.p.x, y: tief ? teil.p.y + 0.9 : teil.p.y + 1.8, z: teil.p.z };
    },
    fassen() {
      w.griff = [teil];
    },
    heben(unterkante: number) {
      teil.p = { ...teil.p, y: 0.35 + unterkante };
    },
    loslassenInBox() {
      w.griff = [];
      w.ueberBox = false;
      teil.p = { x: -7.6, y: 0.35, z: -19.8 };
      w.behaelter = "r_bunt";
      bus.emit("itemEntered", { itemId: "item_7", materialId: "copper", containerId: "r_bunt", correct: true });
    },
  };
}

describe("Aufgabe 1: der Ablauf mit Attrappen", () => {
  it("challenge:start kommt vor dem ersten Schritt, mit Nummer, Name, Ziel und Sternzielen", () => {
    const a = attrappe();
    let start: GameEvents["challenge:start"] | null = null;
    a.bus.on("challenge:start", (e) => (start = e));
    a.lauf.start();
    expect(a.log).toEqual(["start erster-griff 1", "schritt 1"]);
    expect(start!).toMatchObject({ id: "erster-griff", nr: 1, name: A1.name, ziel: A1.ziel, wertung: A1.wertung });
  });

  it("geschafft erst, wenn das Teil unter der Wandkrone liegt — nicht schon im Fallen darueber (qa 19.10.)", () => {
    const a = attrappe();
    a.lauf.start();
    a.loslassenInBox();
    a.teil.p = { ...a.teil.p, y: 2.6 }; // Zone zaehlt schon, Teil faellt noch ueber der 2-m-Wand
    a.lauf.takt(1);
    expect(a.ende(), "zu frueh geschafft").toBeNull();
    a.teil.p = { ...a.teil.p, y: 0.35 };
    a.lauf.takt(1);
    expect(a.ende()).not.toBeNull();
  });

  it("sechs Schritte, jeder erst, wenn er gesehen wurde; challenge:stand je takt", () => {
    const a = attrappe();
    a.lauf.start();
    a.lauf.takt(1);
    expect(a.schritte, "Startpose: noch nichts gesehen").toEqual([1]);
    a.w.blick = Math.atan2(TEIL.x - BAGGER_STAND.x, TEIL.z - BAGGER_STAND.z);
    a.lauf.takt(1);
    expect(a.schritte).toEqual([1, 2]);
    a.ueberTeil(false); // ueber dem Teil, aber noch nicht abgesenkt
    a.lauf.takt(1);
    expect(a.schritte, "nicht tief genug").toEqual([1, 2]);
    a.ueberTeil(true);
    a.lauf.takt(1);
    expect(a.schritte).toEqual([1, 2, 3]);
    a.fassen();
    a.lauf.takt(1);
    expect(a.schritte).toEqual([1, 2, 3, 4]);
    a.heben(2.2); // unter Wand + Luft (2,3 m)
    a.lauf.takt(1);
    expect(a.schritte, "nicht hoch genug fuer die Boxwand").toEqual([1, 2, 3, 4]);
    a.heben(2.4);
    a.lauf.takt(1);
    expect(a.schritte).toEqual([1, 2, 3, 4, 5]);
    a.w.ueberBox = true;
    a.lauf.takt(1);
    expect(a.schritte).toEqual([1, 2, 3, 4, 5, 6]);
    a.loslassenInBox();
    a.lauf.takt(1);
    expect(a.ende()).not.toBeNull();
    expect(a.ende()!.messung).toEqual({
      zeitS: 9,
      fehlwuerfe: 0,
      harteAufschlaege: 0,
      praezisionCm: null,
      ueberlasten: 0,
      fremdteile: 0,
    });
    expect(a.ende()!.sterne).toBe(3);
    expect(a.ende()!.name).toEqual(A1.name);
    expect(a.staende, "challenge:stand je takt").toHaveLength(9);
    // nach geschafft: kein Stand, keine Zeit mehr
    a.lauf.takt(1);
    expect(a.staende).toHaveLength(9);
    expect(a.lauf.zeitS).toBe(9);
  });

  it("Markierungen: das Teil, solange es nicht gefasst ist — dann die Box, auf Wandhoehe", () => {
    const a = attrappe();
    a.lauf.start();
    a.lauf.takt(1);
    const m0 = a.staende.at(-1)!.marken;
    expect(m0).toHaveLength(1);
    expect(m0[0]).toMatchObject({ art: "teil", x: TEIL.x, z: TEIL.z });
    expect(m0[0]!.y, "Oberkante des liegenden Teils").toBeCloseTo(0.7, 5);
    a.ueberTeil();
    a.fassen();
    a.lauf.takt(1);
    expect(a.staende.at(-1)!.marken).toEqual([{ x: -7.6, y: 2.0, z: -19.8, art: "ziel", sorte: "bunt" }]); // Auftrag 41: in der Farbe von BUNT + VA
    expect(a.staende.at(-1)!).toMatchObject({ zaehler: null, balken01: null, pressenBereit: false, tipp: null });
  });

  it("was schon richtig ist, wird uebersprungen: gleich gefasst und gehoben → Schritt 5", () => {
    const a = attrappe();
    a.lauf.start();
    a.ueberTeil();
    a.fassen();
    a.heben(2.5);
    a.lauf.takt(1);
    expect(a.schritte).toEqual([1, 5]);
  });

  it("Fehlwurf: ein Aufgaben-Teil in falscher Mulde zaehlt je Einwurf einmal; Herausholen macht ihn nicht ungeschehen", () => {
    const a = attrappe();
    a.lauf.start();
    const falsch = { itemId: "item_7", materialId: "copper", containerId: "r_rubble", correct: false };
    a.bus.emit("itemEntered", falsch);
    a.bus.emit("itemLeft", { itemId: "item_7", containerId: "r_rubble" });
    a.bus.emit("itemEntered", falsch); // springt heraus und wieder hinein: derselbe Einwurf
    a.lauf.takt(1);
    expect(a.lauf.messung().fehlwuerfe).toBe(1);
    // wieder gegriffen, wieder falsch hineingeworfen: zweiter Einwurf
    a.fassen();
    a.lauf.takt(1);
    a.w.griff = [];
    a.bus.emit("itemEntered", falsch);
    expect(a.lauf.messung().fehlwuerfe).toBe(2);
    // GEGENPROBE: ein fremdes Teil und ein richtiger Einwurf zaehlen nicht
    a.bus.emit("itemEntered", { ...falsch, itemId: "item_99" });
    a.bus.emit("itemEntered", { ...falsch, containerId: "r_bunt", correct: true });
    expect(a.lauf.messung().fehlwuerfe).toBe(2);
  });

  it("Fremdteile: falsche Teile, die beim Abschluss im Zielbehaelter liegen", () => {
    const a = attrappe();
    a.lauf.start();
    a.bus.emit("itemEntered", { itemId: "item_50", materialId: "steel", containerId: "r_bunt", correct: false });
    a.bus.emit("itemEntered", { itemId: "item_51", materialId: "steel", containerId: "r_bunt", correct: false });
    a.bus.emit("itemLeft", { itemId: "item_51", containerId: "r_bunt" });
    expect(a.lauf.messung().fremdteile).toBe(1);
  });

  it("harter Aufschlag: nur eigene Koerper, nur ab HART_AB_MS", () => {
    const a = attrappe();
    a.lauf.start();
    const schlag = (handle: number | undefined, wucht: number): void =>
      a.bus.emit("schrott:aufprall", {
        materialId: "copper",
        massKg: 65,
        wucht,
        blech: false,
        untergrund: "beton",
        handle,
        x: 0,
        y: 0,
        z: 0,
      });
    schlag(11, HART_AB_MS + 0.5);
    schlag(11, HART_AB_MS - 0.5); // sanft abgesetzt
    schlag(99, 9); // fremdes Teil
    schlag(undefined, 9); // ohne Handle
    expect(a.lauf.messung().harteAufschlaege).toBe(1);
  });

  it("Ueberlast-Meldungen werden gezaehlt — dicht hintereinander als ein Versuch (G3, UEBERLAST_PAUSE_S)", () => {
    const a = attrappe();
    a.lauf.start();
    a.bus.emit("greifer:ueberlast", { massKg: 9000, grenzeKg: 5000, ausladungM: 8, abgestuetzt: false });
    a.bus.emit("greifer:ueberlast", { massKg: 9000, grenzeKg: 5000, ausladungM: 8, abgestuetzt: false });
    expect(a.lauf.messung().ueberlasten, "im selben Augenblick").toBe(1);
    a.lauf.takt(2);
    a.bus.emit("greifer:ueberlast", { massKg: 9000, grenzeKg: 5000, ausladungM: 8, abgestuetzt: true });
    expect(a.lauf.messung().ueberlasten).toBe(2);
  });

  it("vor start und nach beenden ist der Lauf stumm — nach ↻ zaehlt nur der neue", () => {
    const a = attrappe();
    const hart = { materialId: "copper", massKg: 65, wucht: 9, blech: false, untergrund: "beton" as const, handle: 11, x: 0, y: 0, z: 0 };
    a.bus.emit("schrott:aufprall", hart); // vor start
    a.lauf.start();
    a.lauf.beenden();
    const vorher = a.log.length;
    a.bus.emit("schrott:aufprall", hart);
    a.bus.emit("itemEntered", { itemId: "item_7", materialId: "copper", containerId: "r_rubble", correct: false });
    a.ueberTeil();
    a.fassen();
    a.heben(3);
    a.w.ueberBox = true;
    a.lauf.takt(1);
    a.loslassenInBox();
    a.lauf.takt(1);
    expect(a.log.length, "der alte Lauf meldet noch").toBe(vorher);
    expect(a.staende).toHaveLength(0);
    expect(a.lauf.messung()).toMatchObject({ zeitS: 0, fehlwuerfe: 0, harteAufschlaege: 0 });
    expect(a.lauf.beendet).toBe(true);
    // Der neue Lauf am selben Bus zaehlt
    const neu = new ChallengeLauf(A1, 1, { ...dummyQuellen() }, a.bus, { teile: [{ id: "item_7", body: a.teil }], wracks: [] });
    neu.start();
    a.bus.emit("schrott:aufprall", hart);
    expect(neu.messung().harteAufschlaege).toBe(1);
  });
});

function dummyQuellen(): ChallengeQuellen {
  return {
    gegriffen: () => [],
    spinne: () => ({ x: 0, y: 5, z: 0 }),
    drehmitte: () => BAGGER_STAND,
    blickRad: () => Math.PI,
    behaelter: () => null,
    ueberBehaelter: () => false,
    behaelterVon: () => null,
    ueberKammer: () => false,
    inKammer: () => false,
  };
}

/* ======================================================================== */
/* 5 — Sterne und Texte                                                      */
/* ======================================================================== */

const LEER = { fehlwuerfe: 0, harteAufschlaege: 0, praezisionCm: null, ueberlasten: 0, fremdteile: 0 };

describe("Aufgabe 1: die Sterne", () => {
  it("★ geschafft · ★★ unter 3:00 · ★★★ unter 1:30 — mit Gegenproben", () => {
    const w = A1.wertung;
    expect(sterne(w, { ...LEER, zeitS: 400 })).toBe(1);
    expect(sterne(w, { ...LEER, zeitS: 181 }), "knapp ueber 3:00").toBe(1);
    expect(sterne(w, { ...LEER, zeitS: 180 })).toBe(2);
    expect(sterne(w, { ...LEER, zeitS: 91 }), "knapp ueber 1:30").toBe(2);
    expect(sterne(w, { ...LEER, zeitS: 90 })).toBe(3);
    // Fehler kosten hier nichts — Aufgabe 1 wertet nur die Zeit (Konzept)
    expect(sterne(w, { ...LEER, zeitS: 60, fehlwuerfe: 3, harteAufschlaege: 2 })).toBe(3);
  });
});

/** Alle Platzhalter eines Texts, sortiert. */
function platzhalter(t: string): string[] {
  return (t.match(/\{[a-z]+[+-]?\}/g) ?? []).sort();
}

// E-162: dazu je Funktion Achse {boom} und Richtung {boom+}/{boom-} (ui/challengekarte.ts bedientext)
const BEKANNT = [
  "{schwenken}",
  "{hauptarm}",
  "{ausleger}",
  "{schliessen}",
  "{oeffnen}",
  ...["boom", "stick", "cab", "grapple", "rotator"].flatMap((f) => [`{${f}}`, `{${f}+}`, `{${f}-}`]),
];

describe("Alle Aufgaben: zweisprachig, nicht leer, dieselben Platzhalter", () => {
  for (const c of CHALLENGES) {
    it(c.id, () => {
      const texte: Array<[string, Zweisprachig]> = [
        ["name", c.name],
        ["beschreibung", c.beschreibung],
        ["ziel", c.ziel],
        ...c.schritte.flatMap((s, i): Array<[string, Zweisprachig]> => [
          [`schritt ${i + 1} titel`, s.titel],
          [`schritt ${i + 1} text`, s.text],
        ]),
      ];
      for (const [wo, t] of texte) {
        expect(t.de.trim(), `${wo} de leer`).not.toBe("");
        expect(t.en.trim(), `${wo} en leer`).not.toBe("");
        expect(platzhalter(t.en), `${wo}: Platzhalter verschieden`).toEqual(platzhalter(t.de));
        for (const p of platzhalter(t.de)) expect(BEKANNT, `${wo}: unbekannter Platzhalter ${p}`).toContain(p);
        expect(t.de + t.en, `${wo}: Tastenbuchstabe`).not.toMatch(/\bTaste\b|\bkey\b/i);
        expect(t.de, `${wo}: unvollstaendige Klammer`).not.toMatch(/\{(?![a-z]+[+-]?\})|(?<!\{[a-z]+[+-]?)\}/);
      }
    });
  }
  it("jeder Geisterdaumen nennt eine Funktion, die es gibt", () => {
    for (const c of CHALLENGES)
      for (const s of c.schritte) {
        if (!s.zeige) continue;
        expect(["boom", "stick", "cab", "grapple", "rotator"]).toContain(s.zeige.fn);
        expect(["plus", "minus", "beide"]).toContain(s.zeige.richtung);
      }
  });
  it("Text und Geisterdaumen nennen dieselbe Richtung (E-162)", () => {
    for (const c of CHALLENGES)
      for (const s of c.schritte) {
        if (!s.zeige || s.zeige.richtung === "beide") continue;
        const vz = s.zeige.richtung === "plus" ? "+" : "-";
        for (const p of platzhalter(s.text.de)) {
          const m = /^\{([a-z]+)([+-])\}$/.exec(p);
          if (m && m[1] === s.zeige.fn) expect(m[2], `${c.id}/${s.titel.de}`).toBe(vz);
        }
      }
  });
});
