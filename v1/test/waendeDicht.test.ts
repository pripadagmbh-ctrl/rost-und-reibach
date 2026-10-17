/**
 * WÄNDE SIND DICHT (E-138).
 *
 * Patrick, 17.10.2026: „Körper wie Autos gehen durch Betonwände oder
 * Scherenwände. Das fehlt offensichtlich eine Sperre."
 *
 * Gemessen, wo es wirklich durchging (`tools/wanddurchgang.ts`, vor dem Umbau):
 *
 *  1. GEWORFEN nie. Ein Wrack mit 6 bis 25 m/s gegen eine 0,55 m dicke
 *     Betonwand bleibt davor — es hat CCD, die Wand einen Kollider.
 *  2. IN DER PRESSE ja, und zwar von der Maschine selbst geschoben:
 *     - Der Stempel rechnete ein Wrack pauschal als 1,40 m dickes Paket und
 *       fuhr bis 1,94 m vor die Stirnwand. Ein laengs liegender Pkw (4,00 m)
 *       stand danach 1,3 m DURCH die Stirnwand.
 *     - Die Klappe schloss bis „Unterkante + 0,75 m" — ein Pkw ist 1,42 m
 *       hoch, ein Wohnwagen 2,40. Sie drueckte das Wrack durch den Kammerboden
 *       (gemessen y −0,30 m).
 *  3. IN DER SPINNE ja: Ein gehaltenes Wrack ist kinematisch und geht durch
 *     alles Feste. Das ist der Bagger (`excavator/collision.ts`); hier steht
 *     der Baustein dafuer, `eindringtiefeInBauwerk`, mit seinem Waechter.
 *
 * Jede Schranke hat eine GEGENPROBE: derselbe Pruefcode auf ein Wrack, das
 * absichtlich in der Wand steckt, MUSS melden.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager, type CarComposite, type WrackArt } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { PressManager, PRESS_CENTER, PRESS_KAMMER, ausdehnung } from "../src/world/press";
import { MULDE_STEIN } from "../src/world/containers";
import { eindringtiefeInBauwerk } from "../src/world/obstacles";

beforeAll(async () => {
  await RAPIER.init();
});

/** Eine Welt wie im Spiel: 60 Hz, dieselben Kontaktwerte (`physicsWorld.ts`), Boden wie `yard.ts`. */
function welt() {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;
  const p = world.integrationParameters;
  p.numSolverIterations = 6;
  p.contact_natural_frequency = 30;
  p.normalizedAllowedLinearError = 0.005;
  p.numAdditionalFrictionIterations = 2;
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(100, 0.5, 100).setTranslation(0, -0.5, 0), boden);
  const items = new ItemManager(scene, world);
  const bus = new EventBus();
  const comps = new CompositeManager(scene, world, items, bus);
  return { scene, world, items, comps };
}

/** Eine Betonlego-Wand wie an den Mulden: 0,55 m dick, sechs Lagen (3,00 m). */
const WAND_X = 5;
function betonwand(world: RAPIER.World): void {
  const b = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(WAND_X, 0, 0));
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(MULDE_STEIN.dicke / 2, 1.5, 6).setTranslation(0, 1.5, 0),
    b
  );
}

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);

describe("Geworfen bleibt ein Wrack vor der Wand", () => {
  for (const art of ["pkw", "wohnwagen", "lkw"] as WrackArt[]) {
    it(`${art}: 6 bis 25 m/s gegen Betonwand, laengs und quer`, () => {
      for (const v of [6, 15, 25]) {
        for (const gier of [0, Math.PI / 2]) {
          const w = welt();
          betonwand(w.world);
          const car = w.comps.spawnCar(new THREE.Vector3(0, 1.0, 0), art, gier);
          car.body.setLinvel({ x: v, y: 2, z: 0 }, true);
          let weitester = -Infinity;
          for (let i = 0; i < 240; i++) {
            w.world.step();
            weitester = Math.max(weitester, ausdehnung(car.body, X).max);
          }
          /*
           * Beim Aufprall federt der Kontakt kurz ein (weiche Kontaktwerte,
           * `physicsWorld.ts`): gemessen Pkw bis 0,08 m, Wohnwagen 0,01 m,
           * das 7-t-LKW-Wrack bei 25 m/s bis 0,35 m, ein bis zwei Bilder lang. Durch kommt nichts — die Rueckseite der Wand
           * wird nie erreicht, und danach steckt nichts mehr in ihr.
           */
          const rueckseite = WAND_X + MULDE_STEIN.dicke / 2;
          expect(weitester, `${art} ${v} m/s Gier ${gier}: durch die Wand`).toBeLessThan(rueckseite);
          expect(eindringtiefeInBauwerk(w.world, car.body), `${art} ${v} m/s: steckt danach`).toBeLessThan(0.05);
        }
      }
    });
  }

  it("gegen die Aussenwand der Presse (Ost) mit 15 m/s", () => {
    const w = welt();
    new PressManager(w.scene, w.world, w.items, w.comps);
    const ost = PRESS_CENTER.x + PRESS_KAMMER.hw + 0.35;
    const car = w.comps.spawnCar(new THREE.Vector3(ost + 3.0, 1.0, PRESS_CENTER.z), "pkw", 0);
    car.body.setLinvel({ x: -15, y: 2, z: 0 }, true);
    let naechster = Infinity;
    for (let i = 0; i < 240; i++) {
      w.world.step();
      naechster = Math.min(naechster, ausdehnung(car.body, X).min);
    }
    expect(naechster, "das Wrack kam durch die Presswand").toBeGreaterThan(ost - 0.1);
  });
});

/**
 * Ist das Wrack durch eine Presswand oder den Kammerboden gegangen?
 *
 * Nicht im Grundriss gerechnet: Ein Wrack, das mit einem Ende auf der
 * Wandkrone liegt, ragt im Grundriss ueber die Wand und ist trotzdem nicht
 * hindurch. Durch ist es, wenn es IN einem festen Kollider steckt, wenn seine
 * Mitte ausserhalb der Kammer unter der Krone liegt, oder wenn es unter den
 * Kammerboden gerutscht ist.
 */
function durchgegangen(world: RAPIER.World, car: CarComposite): string | null {
  const T = 0.1; // Toleranz: Kontaktabstand und Knautschfaltung
  const tief = eindringtiefeInBauwerk(world, car.body);
  if (tief > T) return `steckt ${tief.toFixed(2)} m in Presswand oder Boden`;
  const p = car.body.translation();
  const y = ausdehnung(car.body, Y);
  const draussen =
    Math.abs(p.x - PRESS_CENTER.x) > PRESS_KAMMER.hw || Math.abs(p.z - PRESS_CENTER.z) > PRESS_KAMMER.hd;
  if (draussen && y.min < 2.2) return `Mitte (${p.x.toFixed(2)} | ${p.z.toFixed(2)}) ausserhalb der Kammer`;
  if (y.min < 0.3 - T) return `Unterkante ${y.min.toFixed(2)} unter dem Kammerboden (0,30)`;
  return null;
}

describe("Die Presse schiebt nichts durch ihre eigenen Waende", () => {
  /*
   * Laengs = so, wie die Kammer gedacht ist: das Wrack quer zum Pressweg
   * (Gier 90°, Laenge in x). Quer = mit der Laenge im Pressweg — passt nicht
   * ganz hinein (3,89 m vor dem geparkten Stempel) und darf trotzdem nicht
   * durch die Wand. Abgeworfen wird von oben (Unterkante 2,5 m, ueber der
   * Wandkrone), wie aus der Spinne — nicht in die Kammer hineingezaubert:
   * Ein Wrack, das schon beim Anlegen im Stempel steckt, misst Rapiers
   * Herausdruecken, nicht die Presse.
   */
  for (const art of ["pkw", "wohnwagen"] as WrackArt[]) {
    for (const [lage, gier, dz] of [
      ["laengs", Math.PI / 2, 0],
      ["laengs, versetzt", Math.PI / 2, 0.5],
      ["quer", 0, 0],
      ["schief", 0.3, 0.3],
    ] as const) {
      it(`${art} ${lage}: ganzer Presszyklus, danach in der Kammer`, () => {
        const w = welt();
        const press = new PressManager(w.scene, w.world, w.items, w.comps);
        const car = w.comps.spawnCar(
          new THREE.Vector3(PRESS_CENTER.x, 2.5, PRESS_CENTER.z + dz),
          art,
          gier
        );
        for (let i = 0; i < 150; i++) w.world.step();
        expect(durchgegangen(w.world, car), `${art} ${lage}: schon beim Ablegen`).toBeNull();
        expect(press.start()).toBe(true);
        let schlimmster: string | null = null;
        for (let i = 0; i < 620; i++) {
          press.update(1 / 60);
          w.world.step();
          if (i % 10 === 0) schlimmster ??= durchgegangen(w.world, car);
        }
        expect(schlimmster, `${art} ${lage}`).toBeNull();
        expect(car.crushStage, "gepresst wurde trotzdem").toBe(2);
      });
    }
  }

  it("GEGENPROBE: ein Wrack, das 1 m in der Stirnwand steckt, wird gemeldet", () => {
    const w = welt();
    new PressManager(w.scene, w.world, w.items, w.comps);
    const car = w.comps.spawnCar(
      new THREE.Vector3(PRESS_CENTER.x, 0.35, PRESS_CENTER.z + PRESS_KAMMER.hd - 1.0),
      "pkw",
      0
    );
    w.world.step();
    expect(durchgegangen(w.world, car)).toMatch(/steckt/);
    expect(eindringtiefeInBauwerk(w.world, car.body)).toBeGreaterThan(0.3);
  });
});

describe("eindringtiefeInBauwerk: der Baustein fuer die Spinne", () => {
  function gehalten(x: number): { world: RAPIER.World; car: CarComposite } {
    const w = welt();
    betonwand(w.world);
    // Quer zur Wand (Laenge in x), so wie ein Wrack in der Spinne haengt
    const car = w.comps.spawnCar(new THREE.Vector3(x, 0.5, 0), "pkw", Math.PI / 2);
    car.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    w.world.step();
    return { world: w.world, car };
  }
  const vorderseite = WAND_X - MULDE_STEIN.dicke / 2;

  it("frei vor der Wand: 0", () => {
    const { world, car } = gehalten(vorderseite - 2.0 - 0.2);
    expect(eindringtiefeInBauwerk(world, car.body)).toBe(0);
  });

  it("0,40 m in der Wand: gemessen 0,40 m", () => {
    const { world, car } = gehalten(vorderseite - 2.0 + 0.4);
    expect(eindringtiefeInBauwerk(world, car.body)).toBeCloseTo(0.4, 1);
  });

  it("der Boden zaehlt nicht — ein Wrack, das aufsteht, steckt nicht", () => {
    const w = welt();
    const car = w.comps.spawnCar(new THREE.Vector3(0, -0.05, 0), "pkw", 0);
    car.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    w.world.step();
    expect(eindringtiefeInBauwerk(w.world, car.body)).toBe(0);
  });
});
