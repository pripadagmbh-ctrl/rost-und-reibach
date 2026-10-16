/**
 * BISS FÜR BISS: WIE KNAUTSCHT DAS WRACK? (E-128, 16.10.2026)
 *
 * Ohne Bagger — die Bisse kommen über den Bus wie im Spiel, mit der Kraft
 * eines vollen Bisses (15,7 kN, E-112) und dem Ort, den der Bagger meldet.
 * Je Biss: Knautschgrad, Quetschstufe, wie hoch Haut und Kollider über Dach,
 * Haube und Heck stehen, und was das Nachführen kostet. Danach dieselben
 * Zahlen für die Presse und der Abstand Haut ↔ Kollider über jedem Blech.
 *
 * Aufruf, aus `v1/`:
 *     npx vite-node tools/knautschreihe.ts
 * Unter PowerShell mit Herd an der rechten Tür: `$env:HERD="0.77,0.34"; npx vite-node tools/knautschreihe.ts`
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager, type CarComposite } from "../src/dismantle/composites";
import { FORM_C } from "../src/dismantle/wrackformen";
import { EventBus } from "../src/core/events";

const f2 = (v: number): string => v.toFixed(2);

function werkbank(): { world: RAPIER.World; bus: EventBus; car: CarComposite; comps: CompositeManager } {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0), world.createRigidBody(RAPIER.RigidBodyDesc.fixed()));
  const items = new ItemManager(scene, world);
  const bus = new EventBus();
  const comps = new CompositeManager(scene, world, items, bus);
  const car = comps.spawnCar(new THREE.Vector3(0, 0.02, 0));
  return { world, bus, car, comps };
}

interface Beulbar {
  mesh: THREE.Mesh;
  beult: boolean;
}
function karosse(car: CarComposite): THREE.Mesh {
  return (car as unknown as { dentables: Beulbar[] }).dentables.find((d) => d.beult)!.mesh;
}

/** Höchster Punkt der Haut in einem Grundriss-Rechteck (Wrack-lokal). */
function hautOben(car: CarComposite, x0: number, x1: number, z0: number, z1: number): number {
  const a = karosse(car).geometry.getAttribute("position") as THREE.BufferAttribute;
  let m = -Infinity;
  for (let i = 0; i < a.count; i++) {
    const x = a.getX(i);
    const z = a.getZ(i);
    if (x >= x0 && x <= x1 && z >= z0 && z <= z1) m = Math.max(m, a.getY(i));
  }
  return m;
}

/** Oberkante eines Kolliders, Wrack-lokal — so, wie er Rapier übergeben wird. */
function kolliderOben(car: CarComposite, i: number): number {
  const q = (car as unknown as { blechQuader: (i: number) => { mitte: number[]; halb: number[] } }).blechQuader(i);
  return q.mitte[1]! + q.halb[1]!;
}

function zeile(car: CarComposite, n: string, ms: number): string {
  const dach = hautOben(car, -0.6, 0.6, -0.3, 0.2);
  const haube = hautOben(car, -0.6, 0.6, 1.0, 1.8);
  const heck = hautOben(car, -0.6, 0.6, -1.9, -1.2);
  return (
    `${n.padEnd(8)} Grad ${f2(car.knautschgrad)} · Stufe ${car.crushStage} · Haut oben Dach ${f2(dach)} / Haube ${f2(haube)} / Heck ${f2(heck)}` +
    ` · Kollider Dach ${f2(kolliderOben(car, 7))} Vorderwagen ${f2(kolliderOben(car, 1))} Heck ${f2(kolliderOben(car, 2))}` +
    ` · ${ms.toFixed(2)} ms`
  );
}

/**
 * Wo liegt die Haut über diesem Punkt des Grundrisses? Ein Strahl von oben
 * auf die Karosserie (Wrack-lokal) — das, worauf eine Schale aufsetzen würde.
 */
const strahl = new THREE.Raycaster();
const prüfstoff = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
function hautBei(car: CarComposite, x: number, z: number): number {
  const geo = karosse(car).geometry;
  geo.computeBoundingSphere();
  strahl.set(new THREE.Vector3(x, 5, z), new THREE.Vector3(0, -1, 0));
  const treffer = strahl.intersectObject(new THREE.Mesh(geo, prüfstoff), false);
  return treffer.length ? treffer[0]!.point.y : -Infinity;
}

/** Wie hoch liegt die Gürtellinie (Ebene 5) zwischen z0 und z1, rechts oder links? (Mittel) */
function guertel(car: CarComposite, rechts: boolean, z0: number, z1: number): number {
  const a = karosse(car).geometry.getAttribute("position") as THREE.BufferAttribute;
  const R = 2 * FORM_C.ebenen.length;
  const r = rechts ? 5 : R - 1 - 5;
  let s = 0;
  let n = 0;
  for (let k = 0; k < FORM_C.schnitte.length; k++) {
    const i = k * R + r;
    if (a.getZ(i) < z0 || a.getZ(i) > z1) continue;
    s += a.getY(i);
    n++;
  }
  return s / n;
}

/**
 * Haut gegen Oberkante je Blech, in cm (+ Haut höher als der Kollider, die
 * Spinne sänke ein; − Haut tiefer, die Spinne schwebte). Haube, Heck, Dach:
 * schlimmster Wert unter 15 Strahlen über der inneren Fläche. Türen: die
 * Gürtellinie darüber — darüber ist Glas, und dort ist absichtlich kein Kollider.
 */
function abgleich(car: CarComposite): string {
  return FORM_C.bleche!
    .map((b, i) => {
      if (i === 0) return null;
      let schlimmst = 0;
      if (b.name.startsWith("Tür")) {
        schlimmst = guertel(car, b.mitte[0] > 0, b.mitte[2] - b.halb[2], b.mitte[2] + b.halb[2]) - kolliderOben(car, i);
      } else {
        for (const fx of [-0.8, 0, 0.8]) {
          for (const fz of [-0.8, -0.4, 0, 0.4, 0.8]) {
            const d = hautBei(car, b.mitte[0] + fx * b.halb[0], b.mitte[2] + fz * b.halb[2]) - kolliderOben(car, i);
            if (Math.abs(d) > Math.abs(schlimmst)) schlimmst = d;
          }
        }
      }
      return `${b.name} ${schlimmst >= 0 ? "+" : ""}${(schlimmst * 100).toFixed(0)}`;
    })
    .filter(Boolean)
    .join(" · ");
}

async function main(): Promise<void> {
  await initPhysics();
  const herd = (process.env.HERD ?? "0,-0.05").split(",").map(Number) as [number, number];
  const { bus, car } = werkbank();
  console.log(`Herd (Wrack-lokal) x ${herd[0]} z ${herd[1]} · Eckpunkte Karosserie ${karosse(car).geometry.getAttribute("position").count}`);
  console.log(zeile(car, "heil", 0));
  const p = car.body.translation();
  for (let n = 1; n <= 9 && car.crushStage < 2; n++) {
    const t = performance.now();
    // Ein Ort über dem Herd: ohne Spinnengedächtnis zählt der gemeldete Ort
    bus.emit("greifer:zugedrueckt", { handle: car.body.handle, kraftKN: 15.7, x: p.x + herd[0], y: p.y + 2.5, z: p.z + herd[1] });
    console.log(zeile(car, `Biss ${n}`, performance.now() - t));
    console.log(`         Haut gegen Kollider (cm): ${abgleich(car)}`);
  }
  const presse = werkbank().car;
  const t = performance.now();
  presse.pressCrush();
  console.log(zeile(presse, "Presse", performance.now() - t));
  console.log(`         Haut gegen Kollider (cm): ${abgleich(presse)}`);
  const halb = werkbank().car;
  halb.zusammendruecken(0.5);
  console.log(zeile(halb, "halb", 0));
  console.log(`         Haut gegen Kollider (cm): ${abgleich(halb)}`);
}

void main();
