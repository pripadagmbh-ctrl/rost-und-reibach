/**
 * HÄMMERN KNAUTSCHT (E-187). Patrick, 20.10.2026: „Hämmern knautscht auch".
 * Gemessen vorher (Aufgaben-Agent): Zudrücken knautscht, Hämmern 0,00.
 * Ein voller Spinnen-Schlag ist ein halber voller Biss, an der Trefferstelle.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";

function werkbank() {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0), boden);
  const bus = new EventBus();
  const geknautscht: number[] = [];
  bus.on("wrack:geknautscht", (e) => geknautscht.push(e.zuwachs));
  const comps = new CompositeManager(scene, world, new ItemManager(scene, world), bus);
  const car = comps.spawnCar(new THREE.Vector3(0, 0, 0));
  return { world, boden, comps, car, geknautscht };
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("Hämmern mit der Spinne knautscht das Wrack (E-187)", () => {
  it("vier volle Schläge aufs Dach: mindestens 30 % platt, jeder meldet sich für den Ton", () => {
    const w = werkbank();
    for (let i = 0; i < 4; i++) w.comps.schlag(w.car.body.handle, 1, { x: 0, y: 1.42, z: -0.06 });
    expect(w.car.knautschgrad).toBeGreaterThanOrEqual(0.3);
    expect(w.geknautscht.length).toBe(4);
    // halb so stark wie ein Biss: vier Schläge bleiben unter vier Bissen (flach nach sechs)
    expect(w.car.knautschgrad).toBeLessThan(0.6);
  });

  it("die Trefferstelle zählt: ein Schlag auf die Haube drückt vorn mehr als hinten", () => {
    const w = werkbank();
    w.comps.schlag(w.car.body.handle, 1, { x: 0, y: 0.88, z: 1.4 });
    expect(w.car.knautschBei(0, 1.4)).toBeGreaterThan(w.car.knautschBei(0, -1.6) + 0.02);
  });

  it("ein Schlag auf Beton (oder ohne Wucht) richtet am Wrack nichts an — Gegenprobe", () => {
    const w = werkbank();
    w.comps.schlag(w.boden.handle, 1, { x: 3, y: 0, z: 0 });
    w.comps.schlag(w.car.body.handle, 0, { x: 0, y: 1.42, z: 0 });
    expect(w.car.knautschgrad).toBe(0);
    expect(w.geknautscht.length).toBe(0);
  });

  it("kein Katapult, nicht durch den Boden: nach acht Schlägen liegt das Wrack still auf dem Boden", () => {
    const w = werkbank();
    for (let i = 0; i < 120; i++) w.world.step();
    for (let i = 0; i < 8; i++) w.comps.schlag(w.car.body.handle, 1, { x: 0.4, y: 1.4, z: 0.2 });
    let vMax = 0;
    for (let i = 0; i < 180; i++) {
      w.world.step();
      const v = w.car.body.linvel();
      vMax = Math.max(vMax, Math.hypot(v.x, v.y, v.z));
    }
    expect(vMax).toBeLessThan(1);
    expect(w.car.body.translation().y).toBeGreaterThan(-0.05);
  });
});
