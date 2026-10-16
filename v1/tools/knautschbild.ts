/**
 * DAS KNAUTSCHEN ALS BILDBLATT (E-128) — ohne Browser, ohne WebGL.
 *
 * Sechs Zustände untereinander (heil · ein Biss aufs Dach · drei Bisse ·
 * halb flach · Presse · zwei Bisse an der rechten vorderen Tür), je drei
 * Blickrichtungen nebeneinander. Gerastert mit `tools/fuenfschalen/png.ts`,
 * flach schattiert: Das zeigt die FORM, nicht Lack und Licht — wie es im
 * Spiel aussieht, zeigen die Fotos aus dem laufenden Spiel.
 *
 * Aufruf, aus `v1/`:   npx vite-node tools/knautschbild.ts
 * Ergebnis:            docs/vorschau/knautschen-riss.png
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager, type CarComposite } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { dreiecke } from "./riss";
import { Blatt, farbe } from "./fuenfschalen/png";

await initPhysics();

function wrack(): { car: CarComposite; bus: EventBus } {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const bus = new EventBus();
  const comps = new CompositeManager(scene, world, new ItemManager(scene, world), bus);
  return { car: comps.spawnCar(new THREE.Vector3(0, 0, 0)), bus };
}

/** Voller Biss (15,7 kN) mit dem Herd über (x, z), Wrack-lokal. */
function biss(z: { car: CarComposite; bus: EventBus }, x: number, zz: number): void {
  const p = z.car.body.translation();
  z.bus.emit("greifer:zugedrueckt", { handle: z.car.body.handle, kraftKN: 15.7, x: p.x + x, y: p.y + 2.5, z: p.z + zz });
}

/** Jedes Netz mit fester Farbe, damit der Rasterer nicht die weißen Eckfarben-Stoffe liest. */
function kopie(car: CarComposite): THREE.Group {
  const g = new THREE.Group();
  car.group.updateMatrixWorld(true);
  car.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const glas = (m.material as THREE.Material).transparent;
    const lack = !!m.geometry.getAttribute("color") && m.geometry.getAttribute("position").count > 300;
    const f = glas ? 0xb8d8e8 : lack ? 0xb0483a : m.geometry.getAttribute("color") ? 0x3a3c40 : 0x5a5a5a;
    const k = new THREE.Mesh(m.geometry, new THREE.MeshStandardMaterial({ color: f }));
    k.applyMatrix4(m.matrixWorld);
    g.add(k);
  });
  return g;
}

const BLICKE = [new THREE.Vector3(0.75, 0.45, 1), new THREE.Vector3(1, 0.05, 0.001), new THREE.Vector3(0.001, 0.08, 1)];
const zustaende: Array<[string, () => CarComposite]> = [
  ["heil", () => wrack().car],
  ["1 Biss Dach", () => { const w = wrack(); biss(w, 0, -0.05); return w.car; }],
  ["3 Bisse Dach", () => { const w = wrack(); for (let i = 0; i < 3; i++) biss(w, 0, -0.05); return w.car; }],
  ["halb flach", () => { const w = wrack(); w.car.zusammendruecken(0.5); return w.car; }],
  ["Presse", () => { const w = wrack(); w.car.pressCrush(); return w.car; }],
  ["2 Bisse Tür vorn rechts", () => { const w = wrack(); for (let i = 0; i < 2; i++) biss(w, 0.77, 0.34); return w.car; }],
];

const W = 420;
const H = 230;
const blatt = new Blatt(W * BLICKE.length, H * zustaende.length);
/* Gleicher Maßstab für alle Felder: 4,6 m Bildbreite. */
const S = (W - 30) / 4.6;
zustaende.forEach(([name, bau], zeile) => {
  const obj = kopie(bau());
  BLICKE.forEach((blick, spalte) => {
    const x = spalte * W;
    const y = zeile * H;
    blatt.rechteck(x, y, W, H, [0xff, 0xff, 0xff]);
    blatt.frei(x, y, W, H);
    for (const t of dreiecke(obj, blick)) {
      const p = t.p.map((q) => [x + W / 2 + q[0] * S, y + H - 30 - q[1] * S] as [number, number]);
      const e = t.ecken!;
      blatt.dreieck(p, farbe(t.farbe), [e[2], e[0], e[1]]);
    }
    blatt.linie(x, y + H - 1, x + W, y + H - 1, [0xcc, 0xcc, 0xcc]);
  });
  console.log(`${name}: Zeile ${zeile + 1}`);
});
blatt.schreibe("docs/vorschau/knautschen-riss.png");
