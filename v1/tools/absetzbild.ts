/**
 * DER ABSETZKIPPER VON DER SEITE (E-141) — vier Stellungen als PNG.
 *
 *     npx vite-node tools/absetzbild.ts -- [ziel.png]
 *
 * Fahrstellung, halb geschwenkt, gekippt (110 Grad) und abgesetzt — gerechnet
 * mit `absetzmulde.muldenPose`, gezeichnet mit dem Rasterer aus
 * `tools/riss.ts`. Zeigt die FORM: ob Arme, Ketten, Mulde und Rahmen sich
 * durchdringen, ob die Mulde den Boden trifft. Wie es auf dem iPad aussieht,
 * entscheidet Patrick am Gerät.
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { absetzSchwenk } from "../src/delivery/absetzmulde";
import { dreiecke } from "./riss";
import { Blatt, farbe } from "./fuenfschalen/png";
import { pruefKunde } from "../test/pruefkunde";

leinwandAttrappe();
await initPhysics();
const ziel = process.argv.slice(2).find((a) => a.endsWith(".png")) ?? "absetzbild.png";
const scene = new THREE.Scene();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
const items = new ItemManager(scene, world);
const m = new VehicleManager(scene, world, items, new CompositeManager(scene, world, items, new EventBus()));
m.spawnNow("absetzer", pruefKunde({ gruppe: "gewerbe", vehicle: "absetzer", fuellgrad: 0.0001 }));
type Intern = {
  armSchwenk: number;
  muldeKipp: number;
  absetz: { geo: Parameters<typeof absetzSchwenk>[0] & { winkel0: number } };
  stelleAbsetzanlage(): void;
  group: THREE.Group;
};
const v = (m as unknown as { active: Intern }).active;
v.group.position.set(0, 0, 0);
v.group.rotation.set(0, 0, 0);

/** Mesh in Weltlage kopieren; Netze mit Eckfarben in Farbflächen zerlegen. */
function farbtreu(o: THREE.Mesh, ziel: THREE.Group): void {
  o.updateWorldMatrix(true, false);
  const geo = o.geometry as THREE.BufferGeometry;
  const col = geo.getAttribute("color") as THREE.BufferAttribute | undefined;
  if (!col) {
    const k = new THREE.Mesh(geo, o.material);
    k.applyMatrix4(o.matrixWorld);
    ziel.add(k);
    return;
  }
  const idx = geo.getIndex()!;
  const gruppen = new Map<string, number[]>();
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i);
    const s = `${col.getX(a).toFixed(3)},${col.getY(a).toFixed(3)},${col.getZ(a).toFixed(3)}`;
    const liste = gruppen.get(s) ?? [];
    liste.push(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
    gruppen.set(s, liste);
  }
  for (const [s, liste] of gruppen) {
    const teil = new THREE.BufferGeometry();
    teil.setAttribute("position", geo.getAttribute("position"));
    teil.setIndex(liste);
    const [r, g, b] = s.split(",").map(Number) as [number, number, number];
    const k = new THREE.Mesh(teil, new THREE.MeshStandardMaterial({ color: new THREE.Color(r, g, b) }));
    k.applyMatrix4(o.matrixWorld);
    ziel.add(k);
  }
}

const W = 1600;
const H = 900;
const blatt = new Blatt(W, H);
const SEITE = new THREE.Vector3(1, 0.04, 0.0);
const geo = v.absetz.geo;
const stellungen: Array<[string, number, number]> = [
  ["Fahrt", 0, 0],
  ["halb", (60 * Math.PI) / 180, 0],
  ["gekippt", (140 * Math.PI) / 180 - geo.winkel0, (110 * Math.PI) / 180],
  ["abgesetzt", absetzSchwenk(geo), 0],
];
// Gemeinsamer Massstab: 52 Pixel je Meter, Boden auf derselben Zeile
const M = 52;
stellungen.forEach(([name, a, k], i) => {
  v.armSchwenk = a;
  v.muldeKipp = k;
  v.stelleAbsetzanlage();
  const g = new THREE.Group();
  v.group.traverse((o) => {
    if (o instanceof THREE.Mesh) farbtreu(o, g);
  });
  const x0 = (i % 2) * (W / 2);
  const y0 = Math.floor(i / 2) * (H / 2);
  blatt.rechteck(x0 + 4, y0 + 4, W / 2 - 8, H / 2 - 8, [0xff, 0xff, 0xff]);
  blatt.frei(x0 + 4, y0 + 4, W / 2 - 8, H / 2 - 8);
  // Boden (y = 0) als Linie, Massstab gleich in allen Feldern
  const bodenY = y0 + H / 2 - 40;
  blatt.linie(x0 + 10, bodenY, x0 + W / 2 - 10, bodenY, [0x88, 0x77, 0x66], 0, 2);
  const cx = x0 + W / 4 + 60;
  for (const t of dreiecke(g, SEITE)) {
    const p = t.p.map((q) => [cx + q[0] * M, bodenY - q[1] * M] as [number, number]);
    const e = t.ecken;
    blatt.dreieck(p, farbe(t.farbe), e ? [e[1], e[2], e[0]] : undefined);
  }
  console.log(name, "Arm", ((a * 180) / Math.PI).toFixed(0), "Kipp", ((k * 180) / Math.PI).toFixed(0));
});
blatt.schreibe(ziel);
