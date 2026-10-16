/**
 * WAECHTER FUER DIE FAHRKUNST (E-119, 06.10.2026).
 *
 * Je Fahrkunst ein nachgestellter Fall, dessen Ergebnis man von Hand
 * ausrechnen kann — echte Rapier-Koerper, aber ohne Schritt: Wo ein Teil
 * liegt und wie schnell es losfliegt, wird gesetzt, nicht simuliert. So
 * steht im Test genau die Zahl, die im Kopf steht.
 *
 * Dazu die Gegenprobe zu Regel 2: derselbe Greifzyklus wie
 * `tools/greifzyklus.ts` zweimal, einmal mit Messung, einmal ohne. Griffweite,
 * Haltedauer, Wurfweite, Pendelwinkel und Ruhelage muessen Ziffer fuer Ziffer
 * gleich sein — die Messung darf nichts veraendern.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { GripSystem } from "../src/physics/gripSystem";
import { initPhysics } from "../src/physics/physicsWorld";
import { SICHELKRALLE } from "../src/excavator/greiferform";
import { Fahrkunst } from "../src/skills/fahrkunst";
import type { GameEvents } from "../src/core/events";

type Zyklus = GameEvents["fahrkunst:zyklus"];
const GRAD = 180 / Math.PI;

beforeAll(async () => {
  leinwandAttrappe();
  await initPhysics();
});

/** Eine Messung an Attrappen von Greifer und Bagger — Takt 1 s je Aufruf. */
function stand() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const greifer = { grippedBodies: [] as RAPIER.RigidBody[], greiferform: SICHELKRALLE };
  const bagger = { neigung: 0, schliesskraftKN: 0 };
  const fk = new Fahrkunst(greifer, bagger);
  const zyklen: Zyklus[] = [];
  fk.onZyklus = (e) => zyklen.push(e);
  const teil = (x: number, z: number, kg = 100): RAPIER.RigidBody => {
    const b = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, 0.5, z));
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.3, 0.3, 0.3).setMass(kg), b);
    return b;
  };
  const takt = (n = 1): void => {
    for (let i = 0; i < n; i++) fk.update(1);
  };
  /** Greifen, ueber `los` loslassen (mit Geschwindigkeit `v`), bei `liegt` ablegen. */
  const umschlag = (
    teile: RAPIER.RigidBody[],
    los: [number, number],
    liegt: [number, number],
    v: [number, number, number] = [0, 0, 0],
    halten = 1
  ): void => {
    greifer.grippedBodies = teile;
    takt(halten);
    for (const b of teile) b.setTranslation({ x: los[0], y: 2, z: los[1] }, false);
    greifer.grippedBodies = [];
    for (const b of teile) b.setLinvel({ x: v[0], y: v[1], z: v[2] }, false);
    takt(); // Bild des Loslassens
    for (const b of teile) {
      b.setTranslation({ x: liegt[0], y: 0.3, z: liegt[1] }, false);
      b.sleep();
    }
    takt(); // liegt
  };
  return { world, greifer, bagger, fk, zyklen, teil, takt, umschlag };
}

describe("Fahrkunst — fuenf Zahlen, von Hand nachzurechnen", () => {
  it("Praezision: 30 cm neben dem Ziel abgelegt sind 30 cm; ohne Ziel leer", () => {
    const s = stand();
    s.fk.ziel = { x: 10, z: 0 };
    s.umschlag([s.teil(0, 0)], [10, 0], [10.3, 0]);
    expect(s.zyklen).toHaveLength(1);
    expect(s.zyklen[0]!.praezisionCm).toBeCloseTo(30, 3); // Rapier rechnet in float32: 10,3 m liegt 0,2 µm daneben
    expect(s.zyklen[0]!.x).toBeCloseTo(10.3, 5);

    s.fk.ziel = null;
    s.umschlag([s.teil(0, 5)], [8, 5], [8, 5]);
    expect(s.zyklen[1]!.praezisionCm).toBeNull();
  });

  it("Ruhe: 10 Grad Ausschlag im Bild des Loslassens sind 10 Grad — danach zaehlt nichts mehr", () => {
    const s = stand();
    const b = s.teil(0, 0);
    s.greifer.grippedBodies = [b];
    s.bagger.neigung = 25 / GRAD; // waehrend des Tragens: zaehlt nicht
    s.takt();
    b.setTranslation({ x: 6, y: 2, z: 0 }, false);
    s.greifer.grippedBodies = [];
    s.bagger.neigung = 10 / GRAD;
    s.takt();
    s.bagger.neigung = 40 / GRAD; // nachschwingen: zaehlt nicht
    b.sleep();
    s.takt();
    expect(s.zyklen[0]!.ruheGrad).toBeCloseTo(10, 9);
  });

  it("Tempo: zwei Umschlaege 30 s auseinander sind 2 je Minute; Zappeln zaehlt nicht", () => {
    const s = stand();
    // Zyklus A: Loslassen im Bild 2 (Zeit 2 s) — ohne Vorgaenger leer
    s.umschlag([s.teil(0, 0)], [5, 0], [5, 0]);
    expect(s.zyklen[0]!.tempoProMin).toBeNull();
    s.takt(5);
    // Zappeln: am Ort gefasst und wieder fallen gelassen — kein Ereignis
    const z = s.teil(20, 20);
    s.umschlag([z], [20, 20], [20.4, 20]);
    expect(s.zyklen).toHaveLength(1);
    // Zyklus B: A loslassen bei 2 s; liegt 3, +5 = 8, Zappeln bis 11, +19 = 30,
    // greifen 31, loslassen 32 — 30 s nach A
    s.takt(19);
    s.umschlag([s.teil(0, 9)], [5, 9], [5, 9]);
    expect(s.zyklen).toHaveLength(2);
    expect(s.zyklen[1]!.tempoProMin).toBeCloseTo(2, 9);
  });

  it("Tempo: ab neuBeginnen gemessen — 20 s bis zum Loslassen sind 3 je Minute", () => {
    const s = stand();
    s.takt(7);
    s.fk.neuBeginnen();
    s.takt(18);
    s.umschlag([s.teil(0, 0)], [5, 0], [5, 0]); // 18 + 1 Halten + 1 Loslassen = 20 s
    expect(s.zyklen[0]!.tempoProMin).toBeCloseTo(3, 9);
  });

  it("Wurf: mit (3, 0, 4) m/s losgelassen sind 5 m/s; von (2, 0) bis (6, 3) sind 5 m Weite", () => {
    const s = stand();
    s.umschlag([s.teil(-5, 0)], [2, 0], [6, 3], [3, 0, 4]);
    expect(s.zyklen[0]!.wurfMS).toBeCloseTo(5, 9);
    expect(s.zyklen[0]!.wurfweiteM).toBeCloseTo(5, 9);
  });

  it("Wurf: zwei Teile, 100 kg mit 4 m/s und 300 kg in Ruhe — die Ladung fliegt mit 1 m/s", () => {
    const s = stand();
    const a = s.teil(0, 0, 100);
    const b = s.teil(0, 1, 300);
    s.greifer.grippedBodies = [a, b];
    s.takt();
    a.setTranslation({ x: 6, y: 2, z: 0 }, false);
    b.setTranslation({ x: 6, y: 2, z: 1 }, false);
    s.greifer.grippedBodies = [];
    a.setLinvel({ x: 4, y: 0, z: 0 }, false);
    b.setLinvel({ x: 0, y: 0, z: 0 }, false);
    s.takt();
    a.sleep();
    b.sleep();
    s.takt();
    expect(s.zyklen[0]!.wurfMS).toBeCloseTo(1, 9);
    // Ladungspunkt: z = (100·0 + 300·1) / 400
    expect(s.zyklen[0]!.z).toBeCloseTo(0.75, 9);
  });

  it("Gefuehl: Spitze 40 kN gegen Vorgabe 30 kN sind 10 kN; ohne Vorgabe leer, Spitze steht trotzdem da", () => {
    const s = stand();
    const b = s.teil(0, 0);
    s.fk.zielKraftKN = 30;
    s.greifer.grippedBodies = [b];
    for (const kn of [10, 40, 25]) {
      s.bagger.schliesskraftKN = kn;
      s.takt();
    }
    b.setTranslation({ x: 6, y: 0.3, z: 0 }, false);
    s.greifer.grippedBodies = [];
    s.bagger.schliesskraftKN = 0;
    s.takt();
    b.sleep();
    s.takt();
    expect(s.zyklen[0]!.kraftKN).toBe(40);
    expect(s.zyklen[0]!.gefuehlKN).toBe(10);

    s.fk.zielKraftKN = null;
    s.bagger.schliesskraftKN = 12;
    s.umschlag([s.teil(0, 9)], [6, 9], [6, 9]);
    expect(s.zyklen[1]!.kraftKN).toBe(12);
    expect(s.zyklen[1]!.gefuehlKN).toBeNull();
  });

  it("ein Teil verschwindet nach dem Loslassen (Presse) — kein Absturz, kein Ereignis (E-103)", () => {
    const s = stand();
    const b = s.teil(0, 0);
    s.greifer.grippedBodies = [b];
    s.takt();
    s.greifer.grippedBodies = [];
    s.takt();
    s.world.removeRigidBody(b);
    expect(() => s.takt(3)).not.toThrow();
    expect(s.zyklen).toHaveLength(0);
  });

  it("neuer Griff, waehrend die Ladung noch rollt: der alte Zyklus wird dort gemessen, wo sie ist", () => {
    const s = stand();
    const a = s.teil(0, 0);
    s.greifer.grippedBodies = [a];
    s.takt();
    a.setTranslation({ x: 7, y: 0.3, z: 0 }, false);
    s.greifer.grippedBodies = [];
    s.takt();
    a.wakeUp();
    s.takt(2); // rollt noch
    expect(s.zyklen).toHaveLength(0);
    s.greifer.grippedBodies = [s.teil(30, 30)];
    s.takt();
    expect(s.zyklen).toHaveLength(1);
    expect(s.zyklen[0]!.x).toBeCloseTo(7, 9);
  });
});

/* ---------------- Gegenprobe zu Regel 2 ---------------- */

class Tasten {
  down = new Set<string>();
  wheelDelta = 0;
  orbitDX = 0;
  orbitDY = 0;
  shiftHeld = false;
  isDown(c: string): boolean {
    return this.down.has(c);
  }
  wasPressed(): boolean {
    return false;
  }
  mouseHeld(): boolean {
    return false;
  }
  axis(neg: string, pos: string): number {
    return (this.down.has(pos) ? 1 : 0) - (this.down.has(neg) ? 1 : 0);
  }
  endFrame(): void {}
}

/**
 * Wortgleich der Ablauf von `tools/greifzyklus.ts` — nur dass die Messung
 * auf Wunsch zwischen `grip.update` und `world.step` mitlaeuft, genau an der
 * Stelle, an der sie in main.ts steht.
 */
function greifzyklus(mitMessung: boolean) {
  const DT = 1 / 60;
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  const bagger = new Excavator(new THREE.Scene(), world);
  const grip = new GripSystem(world, bagger.grappleBody);
  grip.insideGrapple = (p) => bagger.isInsideGrapple(p);
  grip.krallenKontakte = (b) => bagger.krallenKontakte(b);
  const hart = new Set<number>();
  bagger.clawBlockedBy = (b) => hart.has(b.handle);
  const tasten = new Tasten();
  const sensor = new THREE.Vector3();

  const fk = mitMessung ? new Fahrkunst(grip, bagger) : null;
  const zyklen: Zyklus[] = [];
  if (fk) fk.onZyklus = (e) => zyklen.push(e);
  let neigungBeimLoslassen = NaN;
  let vorher = 0;

  const takt = (): void => {
    bagger.update(DT, tasten as never);
    grip.update(bagger.closure, bagger.closing, bagger.getSensorPosition(sensor), DT);
    fk?.update(DT);
    if (vorher > 0 && grip.grippedCount === 0) neigungBeimLoslassen = bagger.neigung;
    vorher = grip.grippedCount;
    world.step();
    bagger.carriedCount = grip.grippedCount;
    bagger.carriedMassKg = grip.totalMassKg;
    bagger.grippedHandles.clear();
    for (const b of grip.grippedBodies) bagger.grippedHandles.add(b.handle);
  };

  tasten.down.add("KeyF");
  tasten.down.add("KeyG");
  for (let i = 0; i < 260; i++) takt();
  tasten.down.clear();
  for (let i = 0; i < 30; i++) takt();

  const gp = bagger.grappleGroup.position.clone();
  const teil = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(gp.x, 0.17, gp.z));
  world.createCollider(RAPIER.ColliderDesc.cuboid(1.2, 0.15, 0.15).setMass(180), teil);
  hart.add(teil.handle);
  for (let i = 0; i < 40; i++) takt();

  tasten.down.add("Space");
  let griffweite = -1;
  let haltedauer = 0;
  for (let i = 0; i < 90; i++) {
    takt();
    if (griffweite < 0 && grip.grippedCount > 0) griffweite = bagger.clawSplayMax;
    if (grip.grippedCount > 0) haltedauer++;
  }
  tasten.down.add("KeyR");
  for (let i = 0; i < 60; i++) {
    takt();
    if (grip.grippedCount > 0) haltedauer++;
  }
  tasten.down.delete("KeyR");
  tasten.down.add("KeyE");
  let pendel = 0;
  for (let i = 0; i < 120; i++) {
    takt();
    pendel = Math.max(pendel, bagger.neigung);
    if (grip.grippedCount > 0) haltedauer++;
  }
  const los = teil.translation();
  const losX = los.x;
  const losZ = los.z;
  tasten.down.delete("Space");
  for (let i = 0; i < 240; i++) {
    takt();
    pendel = Math.max(pendel, bagger.neigung);
  }
  tasten.down.clear();
  for (let i = 0; i < 120; i++) takt();
  const liegt = teil.translation();
  const wurf = Math.hypot(liegt.x - losX, liegt.z - losZ);
  const zahlen = {
    griffweite,
    haltedauer,
    wurf,
    pendel,
    ruhelage: [liegt.x, liegt.y, liegt.z],
    spreizungZu: bagger.clawSplayMax,
  };
  // Nur im Lauf mit Messung: weiterlaufen, bis das Teil schlaeft (nach den Zahlen)
  for (let i = 0; i < 600 && fk && zyklen.length === 0; i++) takt();
  return { zahlen, zyklen, neigungBeimLoslassen, teil };
}

describe("Fahrkunst — Gegenprobe zu Regel 2", () => {
  it(
    "der Greifzyklus aus tools/greifzyklus.ts gibt mit und ohne Messung dieselben Zahlen",
    () => {
      const ohne = greifzyklus(false);
      const mit = greifzyklus(true);
      // Ziffer fuer Ziffer: toEqual vergleicht die Gleitkommazahlen exakt
      expect(mit.zahlen).toEqual(ohne.zahlen);
      // Greifen: Stand vor E-119 (tools/greifzyklus.ts, 06.10.2026) — darf
      // sich nie aendern (Projektregel 2)
      expect((ohne.zahlen.griffweite * GRAD).toFixed(4)).toBe("54.5336");
      expect(ohne.zahlen.haltedauer).toBe(256);
      // Pendel und Wurf: absichtlich gewandert mit E-132 (16.10.2026,
      // Daempfungsgrad 0,98 -> 0,4): 3,6187 -> 4,2764 m, 22,8533 -> 36,9631°
      expect(ohne.zahlen.wurf.toFixed(4)).toBe("4.2764");
      expect((ohne.zahlen.pendel * GRAD).toFixed(4)).toBe("36.9631");

      // Und die Messung hat den Zyklus gesehen — mit den Zahlen des Baggers
      expect(mit.zyklen).toHaveLength(1);
      const z = mit.zyklen[0]!;
      expect(z.ruheGrad).toBe(mit.neigungBeimLoslassen * GRAD);
      const p = mit.teil.translation();
      expect(z.x).toBeCloseTo(p.x, 9);
      expect(z.z).toBeCloseTo(p.z, 9);
      expect(z.praezisionCm).toBeNull();
      expect(z.gefuehlKN).toBeNull();
      expect(z.tempoProMin).toBeNull();
      for (const v of [z.ruheGrad, z.wurfMS, z.wurfweiteM, z.kraftKN]) {
        expect(Number.isFinite(v)).toBe(true);
      }
    },
    180_000
  );
});
