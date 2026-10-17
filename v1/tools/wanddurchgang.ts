/**
 * Wo geht ein Wrack durch eine Wand? (E-138) — Wurf gegen Betonwand,
 * Loslassen in der Wand, ganzer Presszyklus. Aufruf aus `v1/`:
 *     npx vite-node tools/wanddurchgang.ts          (ART=pkw|wohnwagen|lkw)
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { PressManager, PRESS_CENTER } from "../src/world/press";

await RAPIER.init();
function welt() {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;
  const p = world.integrationParameters;
  p.numSolverIterations = 6; p.contact_natural_frequency = 30; p.normalizedAllowedLinearError = 0.005; p.numAdditionalFrictionIterations = 2;
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(200, 0.5, 200).setTranslation(0, -0.5, 0), ground);
  const items = new ItemManager(scene, world);
  const bus = new EventBus();
  const comps = new CompositeManager(scene, world, items, bus);
  return { scene, world, items, bus, comps };
}
const art = (process.env.ART ?? "pkw") as any;
// A: Wurf gegen Betonwand (x = 5, 0,55 dick, 3 m hoch)
for (const v of [6, 10, 15, 25]) {
  for (const yaw of [0, Math.PI / 2]) {
    const w = welt();
    const wall = w.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(5, 0, 0));
    w.world.createCollider(RAPIER.ColliderDesc.cuboid(0.275, 1.5, 6).setTranslation(0, 1.5, 0), wall);
    const car = w.comps.spawnCar(new THREE.Vector3(0, 1.0, 0), art, yaw);
    car.body.setLinvel({ x: v, y: 2, z: 0 }, true);
    let maxX = -99;
    for (let i = 0; i < 300; i++) { w.world.step(); maxX = Math.max(maxX, car.body.translation().x); }
    console.log(`Wurf ${v} m/s gier ${(yaw*57.3).toFixed(0)}: Ende x ${car.body.translation().x.toFixed(2)} (max ${maxX.toFixed(2)}) ${car.body.translation().x > 5 ? "DURCH" : "davor"}`);
  }
}
// C: losgelassen, waehrend es in der Wand steckt
for (const tief of [0.1, 0.3, 0.6, 1.0, 1.5]) {
  const w = welt();
  const wall = w.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(5, 0, 0));
  w.world.createCollider(RAPIER.ColliderDesc.cuboid(0.275, 1.5, 6).setTranslation(0, 1.5, 0), wall);
  // Pkw quer (gier 90 Grad): halbe Laenge 2,0 in x
  const car = w.comps.spawnCar(new THREE.Vector3(5 - 0.275 - 2.0 + tief, 0.05, 0), art, Math.PI / 2);
  for (let i = 0; i < 240; i++) w.world.step();
  const x = car.body.translation().x;
  console.log(`losgelassen ${tief} m in der Wand: Ende x ${x.toFixed(2)} ${x > 5 ? "DURCH" : "davor"}`);
}
// D: Presse mit Auto
{
  const w = welt();
  const press = new PressManager(w.scene, w.world, w.items, w.comps);
  for (const [dz, yaw] of [[0, 0], [0.4, 0], [0, Math.PI / 2], [0.6, 0.3]] as const) {
    const w2 = welt();
    const pr = new PressManager(w2.scene, w2.world, w2.items, w2.comps);
    const car = w2.comps.spawnCar(new THREE.Vector3(PRESS_CENTER.x, 2.5, PRESS_CENTER.z + dz), art, yaw);
    for (let i = 0; i < 150; i++) w2.world.step();
    pr.start();
    let raus = 0; let maxAbw = 0;
    for (let i = 0; i < 600; i++) {
      pr.update(1 / 60);
      w2.world.step();
      const t = car.body.isValid() ? car.body.translation() : null;
      if (!t) break;
      const ab = Math.max(Math.abs(t.x - PRESS_CENTER.x), Math.abs(t.z - PRESS_CENTER.z));
      maxAbw = Math.max(maxAbw, ab);
    }
    const t = car.body.translation();
    console.log(`Presse dz ${dz} gier ${(yaw*57.3).toFixed(0)}: Ende (${(t.x-PRESS_CENTER.x).toFixed(2)} | ${t.y.toFixed(2)} | ${(t.z-PRESS_CENTER.z).toFixed(2)}) max Abw ${maxAbw.toFixed(2)} drin=${pr.inChamber(t)}`);
    void raus;
  }
  void press;
}
