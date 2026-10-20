/**
 * WAECHTER E-158: Nichts versinkt im Boden.
 *
 * Patrick, 18.10.2026: „auch soll es nicht mehr möglich sein, dass körper im
 * boden versinken können, wie aktuell bei autos der fall".
 *
 * Gemessen vorher (Kontakttiefe im Beton, Spielwerte von `physicsWorld.ts`):
 * gehaltenes Pkw-Wrack abgesenkt 0,69 m; Wohnwagen am Boden, Spinne von oben
 * gedrueckt 1,13 m (bleibend); zugedrueckt einmal ganz hindurch (−5 m);
 * Magnet auf Pkw 0,30 m. Ursachen: Die Wandsperre (E-145) zaehlte den Boden
 * nicht, und die Brocken-Sperre (E-137) sah hohle Wracks nicht.
 *
 * GEGENPROBE je Fall: ohne die jeweilige Sperre sinkt es ein.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { GripSystem } from "../src/physics/gripSystem";
import { setzeGreifer } from "../src/excavator/greiferwahl";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";
import { MAGNET, ferroAnteilVon } from "../src/excavator/magnet";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import type { WrackArt } from "../src/dismantle/carDef";
import { EventBus } from "../src/core/events";
import type { Greiferform } from "../src/excavator/greiferform";

const DT = 1 / 60;

beforeAll(async () => {
  leinwandAttrappe();
  await RAPIER.init();
});

type Schritte = Array<[string[], number]>;

function lauf(form: Greiferform, art: WrackArt, schritte: Schritte, ohne?: "boden" | "druck" | "zu", haengt = false) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = DT;
  // dieselben Kontaktwerte wie im Spiel (`physicsWorld.ts`)
  const p = world.integrationParameters;
  p.numSolverIterations = 6;
  p.contact_natural_frequency = 30;
  p.normalizedAllowedLinearError = 0.005;
  p.numAdditionalFrictionIterations = 2;
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(100, 0.5, 100).setTranslation(0, -0.5, 0), boden);
  const scene = new THREE.Scene();
  const items = new ItemManager(scene, world);
  const comps = new CompositeManager(scene, world, items, new EventBus());
  const b = new Excavator(scene, world);
  const grip = new GripSystem(world, b.grappleBody);
  setzeGreifer(b, grip, form);
  grip.insideGrapple = (q) => b.isInsideGrapple(q);
  grip.krallenKontakte = (x) => b.krallenKontakte(x);
  grip.ferroAnteil = (x) => ferroAnteilVon(x, items, comps.cars);
  if (ohne === "boden") b.greifsystem = null; // Gegenprobe: ohne Sperre fuer gehaltene Teile
  if (ohne === "druck") (b as unknown as { collision: { drueckeInBoden(): null } }).collision.drueckeInBoden = () => null;
  if (ohne === "zu") (b as unknown as { collision: { bodenTiefeBeruehrt(): number } }).collision.bodenTiefeBeruehrt = () => 0;
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
  const t = (): void => {
    b.update(DT, inp as never);
    grip.update(b.closure, b.closing, b.getSensorPosition(new THREE.Vector3()), DT);
    world.step();
    items.clampSpeeds(DT);
    b.carriedCount = grip.grippedCount;
    b.carriedMassKg = grip.totalMassKg;
    b.grippedHandles.clear();
    for (const g of grip.grippedBodies) b.grippedHandles.add(g.handle);
  };
  down.add("KeyR");
  for (let i = 0; i < 40; i++) t();
  down.clear();
  for (let i = 0; i < 20; i++) t();
  const g = b.grappleGroup.position;
  // `haengt`: das Wrack haengt 0,5 m UNTER den Krallenspitzen in der Spinne — so setzt es vor ihnen auf
  const unten = haengt ? g.y - form.maxAusladung(0) - 0.5 - 1.5 : 0.02;
  const car = comps.spawnCar(new THREE.Vector3(g.x, unten, g.z), art, 0);
  b.obstacleBodies.add(car.body.handle); // wie main.ts
  if (haengt) {
    expect(grip.attachBody(car.body)).toBe(true);
    down.add("Space");
  }
  for (let i = 0; i < 90; i++) t();
  /** wie tief das Wrack im Beton steckt (m) */
  const imBoden = (): number => {
    let d = 0;
    for (let i = 0; i < car.body.numColliders(); i++) {
      const k = boden.collider(0).contactCollider(car.body.collider(i), 0);
      if (k && k.distance < 0) d = Math.max(d, -k.distance);
    }
    return d;
  };
  let tiefste = 0;
  let gehalten = false;
  for (const [tasten, n] of schritte) {
    down.clear();
    for (const k of tasten) down.add(k);
    for (let i = 0; i < n; i++) {
      t();
      tiefste = Math.max(tiefste, imBoden());
      if (grip.grippedBodies.some((x) => x.handle === car.body.handle)) gehalten = true;
    }
  }
  const yEnde = car.body.translation().y;
  world.free();
  return { tiefste, gehalten, yEnde };
}

const DRUECKEN: Schritte = [[["KeyF", "KeyG"], 240]];
const GREIFEN_ABSENKEN: Schritte = [
  [["KeyF", "KeyG"], 200],
  [["Space"], 60],
  [["Space", "KeyR"], 60],
  [["Space", "KeyF"], 200],
];
/** Ein Wrack, das tiefer haengt als die Krallen, absenken — es setzt zuerst auf */
const HAENGT_ABSENKEN: Schritte = [[["Space", "KeyF", "KeyG"], 240]];

describe("E-188 — Zudruecken quetscht das LKW-Wrack nicht in den Boden", () => {
  const ZU: Schritte = [[["KeyF", "KeyG"], 200], [["Space"], 120]];
  it("LKW-Wrack (7 t) absenken und zudruecken: unter 15 cm im Beton (vorher 0,40 m)", () => {
    // 0,10 m davon kommen vom Absenken (weicher Bodenkontakt unter 7 t), das Zudruecken legt kaum etwas drauf
    const r = lauf(FUENFSCHALEN, "lkw", ZU);
    expect(r.tiefste, "im Beton (m)").toBeLessThan(0.15);
  }, 60_000);

  it("Gegenprobe: ohne die Regel quetscht das Zudruecken es tief hinein", () => {
    const r = lauf(FUENFSCHALEN, "lkw", ZU, "zu");
    expect(r.tiefste).toBeGreaterThan(0.3);
  }, 60_000);
});

describe("E-158 — nichts versinkt im Boden", () => {
  it("Auto vom Boden greifen und wieder absenken: < 5 cm im Beton", () => {
    const r = lauf(FUENFSCHALEN, "pkw", GREIFEN_ABSENKEN);
    expect(r.gehalten, "das Wrack war gegriffen").toBe(true);
    expect(r.tiefste, "im Beton (m)").toBeLessThan(0.05);
  }, 60_000);

  it("gehaltenes Auto, das unter den Krallen haengt, absenken: setzt auf (< 5 cm), statt einzusinken", () => {
    const r = lauf(FUENFSCHALEN, "pkw", HAENGT_ABSENKEN, undefined, true);
    expect(r.gehalten).toBe(true);
    expect(r.tiefste, "im Beton (m)").toBeLessThan(0.05);
  }, 60_000);

  it("Gegenprobe: ohne Bodensperre sinkt das gehaltene Auto ein", () => {
    const r = lauf(FUENFSCHALEN, "pkw", HAENGT_ABSENKEN, "boden", true);
    expect(r.tiefste).toBeGreaterThan(0.2);
  }, 60_000);

  it("Spinne von oben auf einen liegenden Wohnwagen gedrueckt: er bleibt oben (< 8 cm)", () => {
    const r = lauf(FUENFSCHALEN, "wohnwagen", DRUECKEN);
    expect(r.tiefste, "im Beton (m)").toBeLessThan(0.08);
  }, 60_000);

  it("Gegenprobe: ohne die Sperre drueckt die Spinne ihn in den Boden", () => {
    const r = lauf(FUENFSCHALEN, "wohnwagen", DRUECKEN, "druck");
    expect(r.tiefste).toBeGreaterThan(0.5);
  }, 60_000);

  it("Magnet auf einen liegenden Pkw gesenkt: bleibt oben (< 8 cm)", () => {
    const r = lauf(MAGNET, "pkw", DRUECKEN);
    expect(r.tiefste).toBeLessThan(0.08);
  }, 60_000);

  it("zugedrueckt von oben auf den Wohnwagen: nie hindurch (vorher −5 m), nach dem Loslassen wieder oben", () => {
    const r = lauf(FUENFSCHALEN, "wohnwagen", [[["Space"], 30], [["Space", "KeyF", "KeyG"], 240], [[], 60]]);
    // gemessen 0,13–0,21 m, solange die geschlossene Spinne drueckt (weicher Bodenkontakt), danach wieder oben
    expect(r.tiefste, "im Beton (m)").toBeLessThan(0.25);
    expect(r.yEnde, "liegt wieder auf").toBeGreaterThan(-0.05);
  }, 60_000);
});
