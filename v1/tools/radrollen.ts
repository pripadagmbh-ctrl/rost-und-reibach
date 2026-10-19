/**
 * Rollt ein Rad aus? (E-181, Lehre v2 E-011: Rundes als Achtkant.)
 *
 * Jedes Rad des Katalogs hochkant auf den Boden, Schubs quer zur Achse
 * (1,5 m/s), 10 s Physik. Ausgabe: Weg, Endlage (liegt/steht), Restgeschwindigkeit,
 * Schritt, ab dem es ruht.
 *
 * Aufruf, aus `v1/`:  npx vite-node tools/radrollen.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { BIG_SPECS, HUGE_SPECS, ItemManager, SPECS } from "../src/world/scrapItems";

await initPhysics();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.createCollider(RAPIER.ColliderDesc.cuboid(200, 0.5, 200).setTranslation(0, -0.5, 0));
const items = new ItemManager(new THREE.Scene(), world);
const raeder = [...SPECS, ...BIG_SPECS, ...HUGE_SPECS].filter((s) =>
  (s.zusammensetzung ?? []).some((a) => a.materialId === "tires" && a.anteil >= 0.4)
);
const gelegt = raeder.map((r, i) => {
  const aussen = r.kind === "torus" ? r.dims[0]! + r.dims[1]! : r.dims[0]!;
  const it = items.spawnScrap(
    r.materialId,
    r.massKg,
    { kind: r.kind, dims: r.dims, color: 0, name: r.name, zusammensetzung: r.zusammensetzung },
    new THREE.Vector3(0, aussen + 0.02, i * 4),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
  );
  it.body.applyImpulse({ x: r.massKg * 1.5, y: 0, z: 0 }, true);
  return { it, ruhig: -1 };
});
for (let s = 0; s < 600; s++) {
  world.step();
  for (const g of gelegt) {
    const v = g.it.body.linvel();
    const w = g.it.body.angvel();
    const still = Math.hypot(v.x, v.y, v.z) < 0.05 && Math.hypot(w.x, w.y, w.z) < 0.1;
    if (still && g.ruhig < 0) g.ruhig = s;
    if (!still) g.ruhig = -1;
  }
}
for (const g of gelegt) {
  const p = g.it.body.translation();
  const q = g.it.body.rotation();
  const achse = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
  const lage = Math.abs(achse.y) > 0.7 ? "liegt" : "steht";
  console.log(
    `${(g.it.shape?.name ?? "?").padEnd(32)} Weg ${p.x.toFixed(2)} m  ${lage}  ruhig ab Schritt ${g.ruhig}  ` +
      `wach: ${!g.it.body.isSleeping()}`
  );
}
