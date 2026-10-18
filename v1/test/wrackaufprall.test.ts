/**
 * EIN WRACK, DAS AUFSCHLÄGT, MELDET SICH (E-160).
 *
 * Patrick, 18.10.2026: „Autos fallen lassen, das muss wie Blech klingen und
 * nicht wie eine Coladose." Ein loses Wrack, das hart aufschlug, ohne zu
 * knautschen, war stumm. Jetzt meldet `CompositeManager.onAufprall` einmal je
 * Aufschlag; `main.ts` macht daraus `schrott:aufprall` (derselbe Vertrag wie
 * lose Teile, E-121), den Untergrund rechnet `wrackUntergrund`.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ItemManager } from "../src/world/scrapItems";
import {
  CompositeManager,
  WRACK_AUFPRALL_AB_MS,
  wrackUntergrund,
  type CarComposite,
  type WrackArt,
} from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { SCHLAG_AB_MS } from "../src/audio/klangregeln";

beforeAll(async () => {
  await RAPIER.init();
});

/** Ladeflaeche als Stand-in: fester Quader, Oberkante 1,20 m, um (10 | 0). */
const BETT = { x: 10, z: 0, hw: 1.2, hd: 3.0, top: 1.2 };
const aufBett = (x: number, y: number, z: number): boolean =>
  Math.abs(x - BETT.x) < BETT.hw && Math.abs(z - BETT.z) < BETT.hd && y > BETT.top - 0.3;

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
  const bett = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(BETT.x, 0, BETT.z));
  world.createCollider(RAPIER.ColliderDesc.cuboid(BETT.hw, BETT.top / 2, BETT.hd).setTranslation(0, BETT.top / 2, 0), bett);
  const items = new ItemManager(scene, world);
  const comps = new CompositeManager(scene, world, items, new EventBus());
  const meldungen: Array<{ wucht: number; masse: number; untergrund: string }> = [];
  comps.onAufprall = (car, wucht) =>
    meldungen.push({ wucht, masse: car.body.mass(), untergrund: wrackUntergrund(car, aufBett) });
  const takt = (n: number): void => {
    for (let i = 0; i < n; i++) {
      world.step();
      comps.update();
    }
  };
  return { world, comps, meldungen, takt };
}

/** Wrack anlegen, setzen lassen (Schonfrist nach dem Anlegen), dann um `hoch` anheben. */
function abwurf(w: ReturnType<typeof welt>, art: WrackArt, x: number, hoch: number, sockel = 0): CarComposite {
  const car = w.comps.spawnCar(new THREE.Vector3(x, sockel + 0.05, 0), art);
  w.takt(120);
  w.meldungen.length = 0;
  const p = car.body.translation();
  car.body.setTranslation({ x: p.x, y: p.y + hoch, z: p.z }, true);
  car.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  return car;
}

describe("Ein loses Wrack meldet seinen Aufschlag", () => {
  it("die Schwelle ist die des Tons", () => {
    expect(WRACK_AUFPRALL_AB_MS).toBe(SCHLAG_AB_MS);
  });

  for (const art of ["pkw", "wohnwagen", "lkw"] as WrackArt[]) {
    it(`${art} aus 1,5 m auf Beton: genau ein Aufschlag, mit Masse und Wucht`, () => {
      const w = welt();
      const car = abwurf(w, art, 0, 1.5);
      w.takt(180);
      expect(w.meldungen, JSON.stringify(w.meldungen)).toHaveLength(1);
      const m = w.meldungen[0]!;
      // freier Fall aus 1,5 m: sqrt(2 g h) = 5,4 m/s
      expect(m.wucht).toBeGreaterThan(4);
      expect(m.wucht).toBeLessThan(6.5);
      expect(m.masse).toBeCloseTo(car.body.mass(), 3);
      expect(m.untergrund).toBe("beton");
    });
  }

  it("Pkw aus 1,0 m auf die Ladeflaeche: Untergrund Stahl", () => {
    const w = welt();
    abwurf(w, "pkw", BETT.x, 1.0, BETT.top);
    w.takt(180);
    expect(w.meldungen).toHaveLength(1);
    expect(w.meldungen[0]!.untergrund).toBe("stahl");
  });

  it("Pkw rutscht mit 6 m/s gegen eine Wand: ein Aufschlag", () => {
    const w = welt();
    const car = w.comps.spawnCar(new THREE.Vector3(-8, 0.05, 0), "pkw", Math.PI / 2);
    w.takt(120);
    w.meldungen.length = 0;
    const wand = w.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(-3, 0, 0));
    w.world.createCollider(RAPIER.ColliderDesc.cuboid(0.275, 1.5, 4).setTranslation(0, 1.5, 0), wand);
    car.body.setLinvel({ x: 6, y: 0, z: 0 }, true);
    w.takt(120);
    expect(w.meldungen.length).toBeGreaterThanOrEqual(1);
    expect(w.meldungen.length, "rattert").toBeLessThanOrEqual(2);
  });

  it("ein ruhig liegendes Wrack meldet nichts", () => {
    const w = welt();
    w.comps.spawnCar(new THREE.Vector3(0, 0.05, 0), "pkw");
    w.takt(600);
    expect(w.meldungen).toEqual([]);
  });

  it("ein gehaltenes (kinematisches) Wrack meldet nichts — das macht der Bagger", () => {
    const w = welt();
    const car = w.comps.spawnCar(new THREE.Vector3(0, 0.05, 0), "pkw");
    w.takt(120);
    car.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    // ruckartig hoch und wieder herunter, wie eine Spinne, die aufschlaegt
    for (let i = 0; i < 60; i++) {
      car.body.setNextKinematicTranslation({ x: 0, y: i % 20 < 10 ? 2 : 0.3, z: 0 });
      w.takt(1);
    }
    expect(w.meldungen).toEqual([]);
  });

  it("GEGENPROBE: der Wurf beim Loslassen ist kein Aufprall", () => {
    const w = welt();
    const car = w.comps.spawnCar(new THREE.Vector3(0, 0.05, 0), "pkw");
    w.takt(120);
    car.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    w.takt(5);
    car.body.setTranslation({ x: 0, y: 3, z: 0 }, true);
    w.takt(1);
    car.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    car.body.setLinvel({ x: 4, y: 0, z: 0 }, true); // Wurf, 4 m/s seitlich
    w.takt(2);
    expect(w.meldungen, "das Loslassen selbst darf nicht knallen").toEqual([]);
    w.takt(120);
    expect(w.meldungen.length, "der Aufschlag danach muss kommen").toBeGreaterThanOrEqual(1);
  });
});
