/**
 * DER MÜLL-ABROLLER VON SCHRÄG HINTEN (E-190) — vier Stellungen als PNG.
 *
 *     npx vite-node tools/muellbild.ts -- [ziel.png]
 *
 * Fahrstellung, Teleskop geschoben, halb gekippt, abgesetzt — gerechnet mit
 * `hakenlift.wannenLage` (derselben Rechnung wie im Spiel), gezeichnet mit dem
 * Rasterer aus `tools/riss.ts`. Zeigt die FORM: ob Container, Arm und Rahmen
 * sich durchdringen und ob der Container den Boden trifft. Wie es im Spiel
 * aussieht, zeigt `tools/muell-bild.mjs` im Browser.
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { ContainerManager } from "../src/world/containers";
import { ContainerAbholung } from "../src/delivery/platzinventarAbholung";
import { EventBus } from "../src/core/events";
import { alphaAmBoden, HAKEN_SCHUB_M } from "../src/delivery/hakenlift";
import { dreiecke } from "./riss";
import { Blatt, farbe } from "./fuenfschalen/png";

leinwandAttrappe();
await initPhysics();
const ziel = process.argv.slice(2).find((a) => a.endsWith(".png")) ?? "muellbild.png";
const scene = new THREE.Scene();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
const items = new ItemManager(scene, world);
const c = new ContainerManager(scene, world, new EventBus());
const m = new VehicleManager(scene, world, items, new CompositeManager(scene, world, items, new EventBus()));
m.platzinventar = new ContainerAbholung(c, items, world);
m.sandkastenAbholer = true;
m.requestPickup("rubble", "muell");
type Intern = {
  hakenAlpha: number;
  hakenSchub: number;
  haken: { geo: Parameters<typeof alphaAmBoden>[0] };
  tragWanne: { group: THREE.Group } | null;
  fuehreHakenNach(sofort?: boolean): void;
  group: THREE.Group;
};
const v = (m as unknown as { active: Intern }).active;
v.group.position.set(0, 0, 0);
v.group.rotation.set(0, 0, 0);
v.group.updateWorldMatrix(true, true);

const W = 1600;
const H = 900;
const blatt = new Blatt(W, H);
// Schräg von hinten links und etwas von oben
const BLICK = new THREE.Vector3(0.75, 0.3, -0.6);
const voll = alphaAmBoden(v.haken.geo);
const stellungen: Array<[string, number, number]> = [
  ["Fahrt", 0, 0],
  ["Teleskop geschoben", 0, HAKEN_SCHUB_M],
  ["halb gekippt", voll * 0.45, HAKEN_SCHUB_M],
  ["abgesetzt", voll, HAKEN_SCHUB_M],
];
const M = 40;
stellungen.forEach(([name, a, s], i) => {
  v.hakenAlpha = a;
  v.hakenSchub = s;
  v.fuehreHakenNach(true);
  const g = new THREE.Group();
  const kopie = (wurzel: THREE.Object3D): void =>
    wurzel.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.updateWorldMatrix(true, false);
      const k = new THREE.Mesh(o.geometry, o.material);
      k.applyMatrix4(o.matrixWorld);
      g.add(k);
    });
  kopie(v.group);
  if (v.tragWanne) kopie(v.tragWanne.group);
  // Boden als flache Platte
  const boden = new THREE.Mesh(new THREE.BoxGeometry(6, 0.02, 22), new THREE.MeshStandardMaterial({ color: 0xc8c2b8 }));
  boden.position.set(0, -0.01, -4);
  g.add(boden);
  const x0 = (i % 2) * (W / 2);
  const y0 = Math.floor(i / 2) * (H / 2);
  blatt.rechteck(x0 + 4, y0 + 4, W / 2 - 8, H / 2 - 8, [0xff, 0xff, 0xff]);
  blatt.frei(x0 + 4, y0 + 4, W / 2 - 8, H / 2 - 8);
  const cx = x0 + W / 4;
  const cy = y0 + H / 4 + 60;
  for (const t of dreiecke(g, BLICK)) {
    const p = t.p.map((q) => [cx + q[0] * M, cy - q[1] * M] as [number, number]);
    const e = t.ecken;
    blatt.dreieck(p, farbe(t.farbe), e ? [e[1], e[2], e[0]] : undefined);
  }
  console.log(name, "Arm", ((a * 180) / Math.PI).toFixed(0), "Schub", s.toFixed(2));
});
blatt.schreibe(ziel);
