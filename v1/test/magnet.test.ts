/**
 * WAECHTER E-146: Der Lasthebemagnet als dritter Greifer.
 *
 * Patrick, 17.10.2026: „magnet als greifer" — wie echt nur Eisen und Stahl.
 * Kupfer, Aluminium, Messing und Edelstahl (VA) bleiben liegen, ein Mischteil
 * haengt nach seinem Stahlanteil (Schwelle `MAGNET_AB`), Wracks haften.
 * „Schliessen" schaltet ein, „oeffnen" aus — dann faellt alles.
 *
 * Echter Bagger, echtes Greifsystem, echte Schrottteile (`spawnScrap`) und ein
 * echtes Pkw-Wrack. Der Magnet wird ueber den Teilen eingeschaltet und bis zum
 * Bodenanschlag gesenkt, dann gehoben.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { GripSystem } from "../src/physics/gripSystem";
import { GREIFERFORMEN, naechsteForm, setzeGreifer } from "../src/excavator/greiferwahl";
import { MAGNET, MAGNET_AB, ferroAnteil, ferroAnteilVon } from "../src/excavator/magnet";
import { ItemManager, type ScrapItem } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import type { Anteil } from "../src/materials/purity";

const DT = 1 / 60;

beforeAll(async () => {
  leinwandAttrappe();
  await RAPIER.init();
});

class Tasten {
  down = new Set<string>();
  wheelDelta = 0;
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

interface Teil {
  material: string;
  kg: number;
  zusammensetzung?: Anteil[];
  /** Versatz vom Magnetmittelpunkt (m, x | z) */
  dx?: number;
  dz?: number;
  groesse?: number;
}

function aufbau() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = DT;
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(100, 0.5, 100).setTranslation(0, -0.5, 0), boden);
  const scene = new THREE.Scene();
  const items = new ItemManager(scene, world);
  const comps = new CompositeManager(scene, world, items, new EventBus());
  const bagger = new Excavator(scene, world);
  const grip = new GripSystem(world, bagger.grappleBody);
  grip.insideGrapple = (p) => bagger.isInsideGrapple(p);
  grip.krallenKontakte = (b) => bagger.krallenKontakte(b);
  grip.ferroAnteil = (b) => ferroAnteilVon(b, items, comps.cars);
  expect(setzeGreifer(bagger, grip, MAGNET).id).toBe("magnet");
  const tasten = new Tasten();
  const haftet: number[] = [];
  const schalter: string[] = [];
  grip.onMagnetHaftet = (kg) => haftet.push(kg);
  bagger.onMagnetAn = () => schalter.push("an");
  bagger.onMagnetAus = () => schalter.push("aus");
  const sensor = new THREE.Vector3();
  let vMax = 0;
  const takt = (): void => {
    bagger.update(DT, tasten as never);
    grip.update(bagger.closure, bagger.closing, bagger.getSensorPosition(sensor), DT);
    world.step();
    items.clampSpeeds(DT);
    bagger.carriedCount = grip.grippedCount;
    bagger.carriedMassKg = grip.totalMassKg;
    bagger.grippedHandles.clear();
    for (const g of grip.grippedBodies) bagger.grippedHandles.add(g.handle);
    for (const it of items.items) {
      const v = it.body.linvel();
      vMax = Math.max(vMax, Math.hypot(v.x, v.y, v.z));
    }
  };
  for (let i = 0; i < 10; i++) takt();
  return { world, items, comps, bagger, grip, tasten, takt, haftet, schalter, vMax: () => vMax };
}

/** Unter die Scheibe legen (auf den Boden). */
function lege(a: ReturnType<typeof aufbau>, t: Teil): ScrapItem {
  const g = a.bagger.grappleGroup.position;
  const s = t.groesse ?? 0.3;
  return a.items.spawnScrap(
    t.material,
    t.kg,
    { kind: "box", dims: [s, 0.2, s], color: 0x777777, zusammensetzung: t.zusammensetzung, name: `Pruefstueck ${t.material}` },
    new THREE.Vector3(g.x + (t.dx ?? 0), 0.11, g.z + (t.dz ?? 0))
  );
}

/** Einschalten, absenken bis zum Bodenanschlag, heben. */
function hebe(a: ReturnType<typeof aufbau>): void {
  a.tasten.down.add("Space");
  a.tasten.down.add("KeyF");
  for (let i = 0; i < 150; i++) a.takt();
  a.tasten.down.delete("KeyF");
  for (let i = 0; i < 20; i++) a.takt();
  a.tasten.down.add("KeyR");
  for (let i = 0; i < 90; i++) a.takt();
  a.tasten.down.delete("KeyR");
  for (let i = 0; i < 20; i++) a.takt();
}

const gehoben = (it: ScrapItem): boolean => it.body.translation().y > 0.8;

describe("E-146 — der Magnet nimmt Eisen und Stahl, sonst nichts", () => {
  it("steht als dritter Greifer im Pausenmenue und wird reihum geschaltet", () => {
    expect(GREIFERFORMEN.map((f) => f.id)).toEqual(["sichel", "fuenfschalen", "magnet"]);
    expect(naechsteForm("fuenfschalen").id).toBe("magnet");
    expect(naechsteForm("magnet").id).toBe("sichel");
  });

  it("Stahl wird angezogen und gehoben", () => {
    const a = aufbau();
    const st = lege(a, { material: "steel", kg: 40 });
    hebe(a);
    expect(gehoben(st), `Stahl liegt bei y ${st.body.translation().y.toFixed(2)}`).toBe(true);
    expect(a.grip.grippedBodies.some((b) => b.handle === st.body.handle)).toBe(true);
    expect(a.vMax(), "kein Katapult beim Anziehen (m/s)").toBeLessThan(6);
    a.world.free();
  }, 60_000);

  for (const m of ["copper", "alu", "va", "brass"]) {
    it(`${m} bleibt liegen`, () => {
      const a = aufbau();
      const st = lege(a, { material: m, kg: 40 });
      hebe(a);
      expect(gehoben(st)).toBe(false);
      expect(a.grip.grippedCount).toBe(0);
      a.world.free();
    }, 60_000);
  }

  it("Mischteil nach Stahlanteil: 62 % haftet, 30 % nicht", () => {
    const a = aufbau();
    const viel = lege(a, {
      material: "steel",
      kg: 41,
      dx: -0.3,
      zusammensetzung: [{ materialId: "steel", anteil: 0.62 }, { materialId: "copper", anteil: 0.08 }, { materialId: "plastic", anteil: 0.3 }],
    });
    const wenig = lege(a, {
      material: "copper",
      kg: 23,
      dx: 0.3,
      zusammensetzung: [{ materialId: "steel", anteil: 0.3 }, { materialId: "copper", anteil: 0.7 }],
    });
    expect(ferroAnteil(viel)).toBeGreaterThanOrEqual(MAGNET_AB);
    expect(ferroAnteil(wenig)).toBeLessThan(MAGNET_AB);
    hebe(a);
    expect(gehoben(viel), "62 % Stahl haftet").toBe(true);
    expect(gehoben(wenig), "30 % Stahl bleibt liegen").toBe(false);
    a.world.free();
  }, 60_000);

  it("Spaene-Knaeuel (Mischschrott, 82 % Stahl) haftet — ueber die Zusammensetzung, ohne Sonderliste", () => {
    // Zusammensetzung wie `SPAENE_ZUSAMMENSETZUNG` des Welt-Agenten (world/spaene.ts, E-147)
    const a = aufbau();
    const sp = lege(a, {
      material: "mixed",
      kg: 27,
      zusammensetzung: [{ materialId: "steel", anteil: 0.82 }, { materialId: "alu", anteil: 0.11 }, { materialId: "brass", anteil: 0.07 }],
    });
    hebe(a);
    expect(gehoben(sp)).toBe(true);
    a.world.free();
  }, 60_000);

  it("Buendel aus Stahl und Kupfer: nur der Stahl kommt mit", () => {
    const a = aufbau();
    const st = lege(a, { material: "steel", kg: 30, dx: -0.3 });
    const cu = lege(a, { material: "copper", kg: 30, dx: 0.3 });
    hebe(a);
    expect(gehoben(st)).toBe(true);
    expect(gehoben(cu)).toBe(false);
    a.world.free();
  }, 60_000);

  it("Ausschalten laesst alles fallen, und An/Aus/Haftet melden sich", () => {
    const a = aufbau();
    const s1 = lege(a, { material: "steel", kg: 40, dx: -0.3 });
    const s2 = lege(a, { material: "steel", kg: 60, dx: 0.3 });
    hebe(a);
    expect(gehoben(s1) && gehoben(s2), "beide Stahlteile haengen").toBe(true);
    expect(a.grip.totalMassKg).toBeCloseTo(100, 0);
    expect(a.haftet.reduce((s, x) => s + x, 0), "magnet:haftet meldet die Masse").toBeCloseTo(100, 0);
    a.tasten.down.delete("Space");
    for (let i = 0; i < 120; i++) a.takt();
    expect(a.grip.grippedCount).toBe(0);
    expect(gehoben(s1) || gehoben(s2), "nach dem Ausschalten liegt alles unten").toBe(false);
    expect(a.schalter).toEqual(["an", "aus"]);
    expect(a.bagger.greiferWechselBereit, "aus und leer: Greifer darf gewechselt werden").toBe(true);
    a.world.free();
  }, 60_000);

  it("Traglast: von drei 1,5-t-Platten kommen zwei mit (3 500 kg)", () => {
    const a = aufbau();
    const p = [-0.4, 0, 0.4].map((dx) => lege(a, { material: "steel", kg: 1500, dx, groesse: 0.35 }));
    hebe(a);
    expect(a.grip.totalMassKg).toBeLessThanOrEqual(3500);
    expect(p.filter(gehoben).length).toBe(2);
    a.world.free();
  }, 60_000);

  it("ein Pkw-Wrack haftet", () => {
    const a = aufbau();
    const g = a.bagger.grappleGroup.position;
    const car = a.comps.spawnCar(new THREE.Vector3(g.x, 0, g.z), "pkw", 0);
    for (let i = 0; i < 30; i++) a.takt();
    const y0 = car.body.translation().y;
    hebe(a);
    expect(a.grip.grippedBodies.some((b) => b.handle === car.body.handle), "Wrack angeheftet").toBe(true);
    expect(car.body.translation().y - y0, "Wrack gehoben (m)").toBeGreaterThan(0.5);
    a.world.free();
  }, 60_000);
});
