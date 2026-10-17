/**
 * SPÄNEKNÄUEL ALS BILD (E-147) — drei Knäuel nah, eine abgesetzte und eine
 * ausgekippte Spänemulde nach echter Physik.
 *
 *     npx vite-node tools/spaenebild.ts -- [Zielordner]
 *
 * Orthogonal, flach schattiert, mit Eckfarben (anders als `tools/riss.ts`,
 * das nur die Materialfarbe kennt). Zeigt Form und Farbe; wie es im Licht des
 * Spiels aussieht, entscheidet Patrick am Gerät.
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { rollSpaenefuhre } from "../src/delivery/customers";
import { spaeneGeometrie, SPAENE_VARIANTEN } from "../src/world/spaene";
import { Blatt } from "./fuenfschalen/png";
import { festerZufall } from "../test/kipperlauf";

leinwandAttrappe();
await initPhysics();
const ordner = process.argv.slice(2).find((a) => !a.startsWith("-")) ?? ".";

const LICHT = new THREE.Vector3(0.45, 0.82, 0.36).normalize();

/** Alle Netze unter `wurzel` in ein Feld zeichnen; Massstab passt sich an. */
function zeichne(blatt: Blatt, wurzel: THREE.Object3D, blick: THREE.Vector3, x0: number, y0: number, w: number, h: number): void {
  wurzel.updateMatrixWorld(true);
  const d = blick.clone().normalize();
  const rechts = new THREE.Vector3(0, 1, 0).cross(d).normalize();
  const hoch = d.clone().cross(rechts).normalize();
  const tris: Array<{ p: Array<[number, number]>; z: [number, number, number]; f: [number, number, number] }> = [];
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const n = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const c = new THREE.Color();
  wurzel.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    const geo = m.geometry as THREE.BufferGeometry;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const col = geo.getAttribute("color") as THREE.BufferAttribute | undefined;
    const idx = geo.getIndex();
    const mat = m.material as THREE.MeshStandardMaterial;
    const anzahl = idx ? idx.count : pos.count;
    for (let i = 0; i < anzahl; i += 3) {
      const ii = [0, 1, 2].map((k) => (idx ? idx.getX(i + k) : i + k));
      ii.forEach((j, k) => v[k]!.fromBufferAttribute(pos, j).applyMatrix4(m.matrixWorld));
      n.copy(e1.copy(v[1]!).sub(v[0]!)).cross(e2.copy(v[2]!).sub(v[0]!));
      if (n.lengthSq() < 1e-14) continue;
      n.normalize();
      if (n.dot(d) < 0) n.negate();
      const hell = 0.3 + 0.7 * Math.max(0, n.dot(LICHT));
      if (col && mat.vertexColors) c.setRGB(col.getX(ii[0]!), col.getY(ii[0]!), col.getZ(ii[0]!));
      else c.copy(mat.color);
      tris.push({
        p: v.map((q) => [q.dot(rechts), q.dot(hoch)] as [number, number]),
        z: [v[1]!.dot(d), v[2]!.dot(d), v[0]!.dot(d)],
        f: [c.r, c.g, c.b].map((k) => Math.min(255, Math.round(Math.sqrt(k) * hell * 255))) as [number, number, number],
      });
    }
  });
  let ax = Infinity, bx = -Infinity, ay = Infinity, by = -Infinity;
  for (const t of tris) for (const [px, py] of t.p) {
    ax = Math.min(ax, px); bx = Math.max(bx, px); ay = Math.min(ay, py); by = Math.max(by, py);
  }
  const s = Math.min((w - 20) / (bx - ax), (h - 20) / (by - ay));
  const cx = x0 + w / 2 - ((ax + bx) / 2) * s;
  const cy = y0 + h / 2 + ((ay + by) / 2) * s;
  blatt.rechteck(x0, y0, w, h, [0xf4, 0xf4, 0xf2]);
  blatt.frei(x0, y0, w, h);
  for (const t of tris) blatt.dreieck(t.p.map(([px, py]) => [cx + px * s, cy - py * s] as [number, number]), t.f, t.z);
}

// 1) Drei Knaeuel nah, je von schraeg oben
{
  const blatt = new Blatt(1500, 520);
  SPAENE_VARIANTEN.forEach((_, i) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(spaeneGeometrie(i), new THREE.MeshStandardMaterial({ vertexColors: true })));
    zeichne(blatt, g, new THREE.Vector3(0.7, 0.55, 1), 10 + i * 495, 10, 485, 500);
  });
  blatt.schreibe(`${ordner}/knaeuel.png`);
}

// 2) und 3) Abgesetzt und ausgekippt, echte Physik, Saat 7001
for (const modus of ["absetzen", "kippen"] as const) {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0), boden);
  const items = new ItemManager(scene, world);
  const m = new VehicleManager(scene, world, items, new CompositeManager(scene, world, items, new EventBus()));
  m.acceptDeliveries = false;
  const zurueck = festerZufall(7001);
  try {
    m.spawnNow("absetzer", rollSpaenefuhre());
    (m as unknown as { active: { absetzModus: string } }).active.absetzModus = modus;
  } finally {
    zurueck();
  }
  for (let i = 0; i < 60 * 100; i++) {
    m.update(1 / 60);
    items.clampSpeeds(1 / 60);
    world.step();
    if (!(m as unknown as { active: unknown }).active) break;
  }
  items.syncMeshes();
  const g = new THREE.Group();
  for (const it of items.items) {
    it.mesh.visible = true;
    g.add(it.mesh.clone());
  }
  if (m.abgesetzteMulde) {
    m.abgesetzteMulde.group.updateMatrixWorld(true);
    g.add(m.abgesetzteMulde.group.clone());
  }
  const blatt = new Blatt(1200, 800);
  zeichne(blatt, g, new THREE.Vector3(0.9, 1.1, -0.7), 0, 0, 1200, 800);
  blatt.schreibe(`${ordner}/mulde-${modus}.png`);
  console.log(modus, items.items.length, "Knaeuel gezeichnet");
}
