/**
 * Kabinenansicht als Bild, ohne Browser und ohne WebGL (E-142).
 *
 * Perspektivisch vom Augpunkt aus (fov 80°, Blick leicht gesenkt wie
 * `orbitCamera.ts` CABIN_HEAD_PITCH), dazu ein Blick von außen schräg vorn auf
 * Fahrer, Sitz und Hebel. Flache Schattierung, Tiefenpuffer (`fuenfschalen/png`).
 * Das zeigt Form und Proportion, nicht die echte Beleuchtung.
 *
 * Aufruf:  npx vite-node tools/fahrerhand-bild.ts -- <zielordner> <name> [kipp]
 *   kipp: Hebelauslenkung −1..1 auf allen vier Achsen (prüft das Mitgehen).
 *
 * Solange `excavator.ts` die Arme aus E-142 noch nicht selbst baut, setzt das
 * Werkzeug sie hier ein (alte Unterarme raus, `fahrerArme` rein) — so lässt
 * sich vorher/nachher vergleichen. Mit Name "vorher" bleibt alles wie gebaut.
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { mkdirSync } from "node:fs";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import { fahrerArme } from "../src/excavator/driver";
import { Blatt } from "./fuenfschalen/png";

const args = process.argv.slice(2).filter((a) => a !== "--");
const ziel = args[0] ?? "docs/messungen";
const name = args[1] ?? "fahrerhand";
const kipp = Number(args[2] ?? 0);

leinwandAttrappe();
await initPhysics();
const scene = new THREE.Scene();
const bagger = new Excavator(scene, new RAPIER.World({ x: 0, y: -9.81, z: 0 }));
const b = bagger as unknown as Record<string, unknown>;
let folge: (() => void) | undefined;
if (name !== "vorher" && !scene.getObjectByName("06_FAHRER_ARM_L")) {
  const joys = ["06_JOYSTICK_L", "06_JOYSTICK_R"].map((n) => scene.getObjectByName(n)!);
  for (const j of joys) for (const k of [...j.children]) if (k.name.startsWith("06_FAHRER_HAND_")) j.remove(k);
  const fahrer = scene.getObjectByName("06_FAHRER")!;
  folge = fahrerArme(joys[0]!.parent!, fahrer.position.x, fahrer.position.z, joys);
}
if (kipp !== 0) {
  for (const k of ["inBoom", "inCab", "inStick", "inGrapple"]) b[k] = kipp;
  const l = b.joyLeft as THREE.Group;
  const r = b.joyRight as THREE.Group;
  l.rotation.set(kipp * 0.35, 0, kipp * 0.35);
  r.rotation.set(kipp * 0.35, 0, kipp * 0.35);
  folge?.();
}
bagger.root.updateMatrixWorld(true);

const LICHT = new THREE.Vector3(0.45, 0.82, 0.36).normalize();

function sichtbar(o: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

function zeichne(
  blatt: Blatt,
  kamera: THREE.PerspectiveCamera,
  wurzel: THREE.Object3D,
  nur?: (m: THREE.Mesh) => boolean
): void {
  kamera.updateMatrixWorld(true);
  kamera.updateProjectionMatrix();
  const view = kamera.matrixWorldInverse;
  const a = new THREE.Vector3();
  const bb = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const farbeA = new THREE.Color();
  wurzel.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !sichtbar(m)) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (Array.isArray(mat) || mat.transparent || (nur && !nur(m))) return;
    const geo = m.geometry as THREE.BufferGeometry;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const col = geo.getAttribute("color") as THREE.BufferAttribute | undefined;
    const idx = geo.getIndex();
    const anzahl = idx ? idx.count : pos.count;
    for (let i = 0; i < anzahl; i += 3) {
      const i0 = idx ? idx.getX(i) : i;
      const i1 = idx ? idx.getX(i + 1) : i + 1;
      const i2 = idx ? idx.getX(i + 2) : i + 2;
      m.getVertexPosition(i0, a).applyMatrix4(m.matrixWorld);
      m.getVertexPosition(i1, bb).applyMatrix4(m.matrixWorld);
      m.getVertexPosition(i2, c).applyMatrix4(m.matrixWorld);
      n.copy(e1.copy(bb).sub(a)).cross(e2.copy(c).sub(a));
      if (n.lengthSq() < 1e-14) continue;
      n.normalize();
      const zuKamera = kamera.position.clone().sub(a);
      if (n.dot(zuKamera) < 0) n.negate();
      const hell = 0.3 + 0.7 * Math.max(0, n.dot(LICHT));
      if (col) farbeA.setRGB(col.getX(i0), col.getY(i0), col.getZ(i0), THREE.LinearSRGBColorSpace);
      else farbeA.copy(mat.color);
      const f = farbeA.clone().multiplyScalar(hell);
      const vs = [a, bb, c].map((v) => v.clone().applyMatrix4(view));
      if (vs.some((v) => v.z > -kamera.near)) continue;
      const p = vs.map((v) => {
        const q = v.clone().applyMatrix4(kamera.projectionMatrix);
        return [((q.x + 1) / 2) * blatt.breite, ((1 - q.y) / 2) * blatt.hoehe] as [number, number];
      });
      const h = f.getHex();
      blatt.dreieck(p, [(h >> 16) & 255, (h >> 8) & 255, h & 255], [vs[1]!.z, vs[2]!.z, vs[0]!.z]);
    }
  });
}

mkdirSync(ziel, { recursive: true });

// 1) Kabinenansicht wie im Spiel (Ego-Sicht: Kopf und Rumpf ausgeblendet)
bagger.setFirstPerson(true);
{
  // Preis der Fahrerteile in der Ego-Sicht: Netze, Zeichenrufe (Schatten zählt doppelt), Dreiecke
  let netze = 0;
  let rufe = 0;
  let dreiecke = 0;
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !/^06_FAHRER/.test(m.name) || !sichtbar(m)) return;
    netze++;
    rufe += m.castShadow ? 2 : 1;
    const g = m.geometry as THREE.BufferGeometry;
    dreiecke += (g.getIndex()?.count ?? g.getAttribute("position").count) / 3;
  });
  console.log(`Fahrer in der Kabinenansicht: ${netze} Netze, ${rufe} Zeichenrufe, ${dreiecke} Dreiecke`);
}
const auge = bagger.getCabinEye(new THREE.Vector3());
const kam = new THREE.PerspectiveCamera(80, 4 / 3, 0.1, 300);
kam.rotation.order = "YXZ";
kam.position.copy(auge);
kam.rotation.set(-0.22, bagger.cabinBaseYaw + Math.PI, 0);
const blatt = new Blatt(1024, 768, [0xb8, 0xcc, 0xdc]);
zeichne(blatt, kam, scene);
blatt.schreibe(`${ziel}/${name}-kabine.png`);

// 1b) Blick nach unten auf die Hände (Kopf gesenkt, wie Patrick auf die Konsole schaut)
kam.rotation.set(-0.85, bagger.cabinBaseYaw + Math.PI, 0);
const blatt2 = new Blatt(1024, 768, [0xb8, 0xcc, 0xdc]);
zeichne(blatt2, kam, scene);
blatt2.schreibe(`${ziel}/${name}-kabine-unten.png`);

// 2) von außen schräg vorn: nur Fahrer, Sitz, Hebel, Hände
bagger.setFirstPerson(false);
const innen = (m: THREE.Mesh): boolean => /^06_(FAHRER|SITZ|JOYSTICK)/.test(m.name);
const mitte = auge.clone().add(new THREE.Vector3(0, -0.35, 0));
const blatt3 = new Blatt(1024, 768, [0xee, 0xf0, 0xf3]);
const k3 = new THREE.PerspectiveCamera(40, 4 / 3, 0.05, 50);
const vorn = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), bagger.cabinBaseYaw);
const seit = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), bagger.cabinBaseYaw);
k3.position.copy(mitte).addScaledVector(vorn, 1.7).addScaledVector(seit, 1.0).add(new THREE.Vector3(0, 0.6, 0));
k3.lookAt(mitte);
zeichne(blatt3, k3, scene, innen);
blatt3.schreibe(`${ziel}/${name}-aussen.png`);

// 3) von der Seite
const blatt4 = new Blatt(1024, 768, [0xee, 0xf0, 0xf3]);
k3.position.copy(mitte).addScaledVector(seit, 2.2).addScaledVector(vorn, 0.2);
k3.lookAt(mitte.clone().addScaledVector(vorn, 0.2));
zeichne(blatt4, k3, scene, innen);
blatt4.schreibe(`${ziel}/${name}-seite.png`);
