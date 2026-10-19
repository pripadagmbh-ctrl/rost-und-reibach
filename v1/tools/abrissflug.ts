/**
 * WIE WEIT FLIEGT EIN ABGERISSENES TEIL? (E-185)
 *
 * Ein abgerissenes Teil entsteht dort, wo es am Wrack saß — also mitten in
 * dessen Kollidern (Vorderwagen, Rahmen). Rapier drückt es heraus. Das darf
 * kein Katapult werden (Rapier-Lehre „Spawn ohne Überlappung"). Gemessen:
 * jedes Teil jedes Wracks einzeln abgerissen, mit dem Stoß des Bisses
 * (40 N·s quer vom Wrack weg, 40 hoch) bzw. ohne Stoß (wie beim Greifen,
 * bevor die Spinne es übernimmt) — höchstes Tempo, Flugweite, Ruhe.
 *
 * Aufruf (in v1/): npx vite-node tools/abrissflug.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics, PhysicsWorld } from "../src/physics/physicsWorld";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager, bissImpuls, type WrackArt } from "../src/dismantle/composites";
import { WRACKDATEN } from "../src/dismantle/carDef";
import { EventBus } from "../src/core/events";

async function main(): Promise<void> {
  await initPhysics();
  for (const stoss of [true, false]) {
    console.log(stoss ? "\nMIT STOSS (Biss)" : "\nOHNE STOSS (Greifen, vor der Übernahme)");
    for (const art of ["pkw", "lkw", "wohnwagen"] as WrackArt[]) {
      for (const p of WRACKDATEN[art].parts) {
        const phys = new PhysicsWorld();
        const world = phys.world;
        world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0), world.createRigidBody(RAPIER.RigidBodyDesc.fixed()));
        const scene = new THREE.Scene();
        const items = new ItemManager(scene, world);
        const comps = new CompositeManager(scene, world, items, new EventBus());
        const car = comps.spawnCar(new THREE.Vector3(0, 0, 0), art);
        for (let i = 0; i < 120; i++) phys.step(); // setzen
        const b = car.tearPart(p.id);
        if (!b) continue; // diese Fassung hat das Teil nicht
        const t0 = b.translation();
        if (stoss) {
          // wie im Spiel: Bissort = Teilmitte, Richtung Wrackmitte − Bissort
          const c = car.body.translation();
          b.applyImpulse(bissImpuls(p.massKg, { x: c.x - t0.x, z: c.z - t0.z }), true);
        }
        let vMax = 0;
        let ruhe = -1;
        for (let i = 0; i < 600; i++) {
          items.clampSpeeds(1 / 60);
          phys.step();
          const v = b.linvel();
          const s = Math.hypot(v.x, v.y, v.z);
          vMax = Math.max(vMax, s);
          if (ruhe < 0 && i > 10 && s < 0.05) ruhe = i;
        }
        const t1 = b.translation();
        const wrackWeg = Math.hypot(car.body.translation().x, car.body.translation().z);
        console.log(
          `  ${art.padEnd(9)} ${p.name.padEnd(20)} ${String(p.massKg).padStart(5)} kg · ` +
            `höchstens ${vMax.toFixed(2)} m/s · ${Math.hypot(t1.x - t0.x, t1.z - t0.z).toFixed(2)} m weit · ` +
            `${ruhe >= 0 ? `ruhig nach ${ruhe} Schritten` : "NICHT RUHIG"} · Wrack ${wrackWeg.toFixed(2)} m verschoben`
        );
        world.free();
      }
    }
  }
}

void main();
