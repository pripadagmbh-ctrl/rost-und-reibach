import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ABSETZMULDE } from "./fuellgrad";

/**
 * DIE ABSETZMULDE DES ABSETZKIPPERS (E-141) — Bild und Kollider.
 *
 * Abgeschaut bei `world/firmenmulden.ts` (E-133, dort nicht exportiert und
 * nicht meine Datei): offener Trog, Boden 68 % der oberen Länge, schräge
 * Stirnwände, Kufen, dunkles Rahmenprofil, Aufnahmezapfen, rot-weiße
 * Warnfelder an den Stirnkanten. Anders als dort: in der Lackfarbe des Kunden
 * statt Pripada-Grün und ohne Aufkleber — es ist SEINE Mulde.
 *
 * DER RAHMEN DER MULDE: x quer (Mitte 0), y nach oben (0 = Unterkante der
 * Kufen), z längs von 0 (obere Hinterkante) bis `laenge` (obere Vorderkante).
 * So deckt sich der Raum mit dem einer Ladefläche (`vehicles.ts`: z von 0 bis
 * zur Flächenlänge), und Wiegen, Verriegeln und Abrutschen gelten unverändert.
 */

const STAHL_DUNKEL = 0x4a4642;
const ROST = 0x7a4a2c;
const WARN_ROT = 0xc8232c;
const WARN_WEISS = 0xf2f2ee;

/** Wo die Zapfen sitzen, an denen die Ketten angreifen (Muldenrahmen). */
export function zapfenLage(): { x: number; y: number; z: number } {
  const m = ABSETZMULDE;
  return {
    x: m.breite / 2,
    y: m.kufe + (m.hoehe - m.kufe) * m.zapfenAnteil,
    z: m.laenge / 2,
  };
}

/** Oberkante des Muldenbodens über der Kufenunterkante (m). */
export const MULDE_BODEN = ABSETZMULDE.kufe + ABSETZMULDE.blech;

export interface MuldenBau {
  /** EIN Netz, Vertexfarben — ein Zeichenruf je Mulde. */
  netz: THREE.Mesh;
  /** Fünf Kollider im Muldenrahmen: Boden, zwei Seiten, zwei schräge Stirnen. */
  kollider: RAPIER.ColliderDesc[];
}

/** Eine Absetzmulde in der Farbe `lack` bauen. */
export function baueAbsetzmulde(lack: number): MuldenBau {
  const m = ABSETZMULDE;
  const w = m.breite;
  const h = m.hoehe;
  const d = m.laenge;
  const t = m.blech;
  const kufe = m.kufe;
  const rand = m.rand;
  const lb = d * m.bodenAnteil;
  const y0 = kufe; // Bodenunterkante
  const hw = h - y0; // Wandhöhe
  const xw = w / 2 - rand;
  const z0 = d / 2; // Mitte längs
  const teile: Array<{ geo: THREE.BufferGeometry; farbe: number }> = [];
  const q = (bw: number, bh: number, bd: number, farbe: number, x: number, y: number, z: number): void => {
    teile.push({ geo: new THREE.BoxGeometry(bw, bh, bd).translate(x, y, z0 + z), farbe });
  };

  for (const sx of [-1, 1]) q(0.12, kufe, lb, STAHL_DUNKEL, sx * xw * 0.6, kufe / 2, 0); // Kufen
  q(xw * 2, t, lb, lack, 0, y0 + t / 2, 0); // Boden
  q(xw * 2 - 0.04, 0.01, lb * 0.95, ROST, 0, y0 + t + 0.005, 0); // Rost innen
  // Seitenwände: Trapez, unten so lang wie der Boden, oben volle Länge
  for (const sx of [-1, 1]) {
    const geo = new THREE.BoxGeometry(t, hw, 1);
    const p = geo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * (lb + (d - lb) * (p.getY(i) / hw + 0.5)));
    teile.push({ geo: geo.translate(sx * (xw - t / 2), y0 + hw / 2, z0), farbe: lack });
  }
  // Stirnwände schräg, mit Warnfeldern an beiden Kanten
  const lang = Math.hypot((d - lb) / 2, hw);
  const neig = Math.atan2((d - lb) / 2, hw);
  const felder = Math.max(4, Math.round(lang / 0.25)); // SW wie firmenmulden: Felder um 25 cm
  for (const sz of [-1, 1]) {
    const lage = new THREE.Matrix4()
      .makeTranslation(0, y0 + hw / 2, z0 + sz * ((lb + d) / 4 - t / 2))
      .multiply(new THREE.Matrix4().makeRotationX(sz * neig));
    teile.push({ geo: new THREE.BoxGeometry(xw * 2, lang, t).applyMatrix4(lage), farbe: lack });
    for (const sx of [-1, 1]) {
      for (let i = 0; i < felder; i++) {
        const geo = new THREE.BoxGeometry(0.14, (lang / felder) * 0.98, 0.01);
        geo.translate(sx * (xw - 0.07), -lang / 2 + ((i + 0.5) * lang) / felder, sz * (t / 2 + 0.005));
        teile.push({ geo: geo.applyMatrix4(lage), farbe: i % 2 === 0 ? WARN_ROT : WARN_WEISS });
      }
    }
  }
  // Rahmenprofil oben, Sicken, Zapfen
  const zapfen = zapfenLage();
  for (const sx of [-1, 1]) {
    q(0.08, 0.08, d - 0.04, STAHL_DUNKEL, sx * (xw - 0.04), h - 0.04, 0);
    for (const zr of [-0.33, 0, 0.33]) q(0.04, hw * 0.8, 0.08, lack, sx * (xw + 0.02), y0 + hw * 0.45, zr * lb);
    const zapf = new THREE.CylinderGeometry(0.07, 0.07, rand, 10).rotateZ(Math.PI / 2);
    teile.push({ geo: zapf.translate(sx * (w / 2 - rand / 2), zapfen.y, z0), farbe: STAHL_DUNKEL });
  }

  const farbe = new THREE.Color();
  for (const { geo, farbe: hex } of teile) {
    farbe.set(hex);
    const n = geo.getAttribute("position").count;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) farbe.toArray(c, i * 3);
    geo.setAttribute("color", new THREE.BufferAttribute(c, 3));
  }
  const geo = mergeGeometries(teile.map((x) => x.geo), false);
  geo.computeVertexNormals();
  for (const x of teile) x.geo.dispose();
  const netz = new THREE.Mesh(
    geo,
    // Wie Abroller und Firmenmulden: 0,75 / 0,35
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.35 })
  );
  netz.name = "Absetzmulde";
  netz.castShadow = true;
  netz.receiveShadow = true;

  /*
   * Kollider: Boden, zwei Seitenwände (Trapez als konvexe Hülle), zwei schräge
   * Stirnwände. Bleche 12 cm statt 4 (Rapier-Lehre: Mindestdicke), nach
   * außen aufgedickt, damit der Innenraum so groß bleibt, wie er aussieht —
   * dieselbe Bauart wie `firmenmulden.ts`.
   */
  const kollider: RAPIER.ColliderDesc[] = [];
  const quat = new THREE.Quaternion();
  kollider.push(RAPIER.ColliderDesc.cuboid(xw, 0.06, lb / 2).setTranslation(0, y0 + t - 0.06, z0));
  for (const sx of [-1, 1]) {
    const ecken: number[] = [];
    for (const x of [sx * (xw - t), sx * (xw - t + 0.12)]) {
      for (const [y, l] of [[y0, lb], [h, d]] as const) {
        for (const zz of [-l / 2, l / 2]) ecken.push(x, y, z0 + zz);
      }
    }
    kollider.push(RAPIER.ColliderDesc.convexHull(new Float32Array(ecken))!);
  }
  for (const sz of [-1, 1]) {
    quat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), sz * neig);
    const nY = -Math.sin(neig) * 0.04;
    const nZ = sz * Math.cos(neig) * 0.04;
    kollider.push(
      RAPIER.ColliderDesc.cuboid(xw, lang / 2, 0.06)
        .setTranslation(0, y0 + hw / 2 + nY, z0 + sz * ((lb + d) / 4 - t / 2) + nZ)
        .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
    );
  }
  return { netz, kollider };
}


/**
 * Liegt dieser Weltpunkt im Innenraum der Mulde? `inv` ist die Umkehrung der
 * Weltmatrix ihres Rahmens. Gemessen wird der Trog bis 0,4 m über den Rand —
 * was dort liegt, ist „noch in der Mulde".
 */
export function imTrog(inv: THREE.Matrix4, p: { x: number; y: number; z: number }, hilf: THREE.Vector3): boolean {
  hilf.set(p.x, p.y, p.z).applyMatrix4(inv);
  const m = ABSETZMULDE;
  return (
    Math.abs(hilf.x) < m.breite / 2 &&
    hilf.z > -0.2 &&
    hilf.z < m.laenge + 0.2 &&
    hilf.y > 0 &&
    hilf.y < m.hoehe + 0.4
  );
}

/** Was `muldenPose` braucht — dieselben Zahlen wie `vehicleModel.AbsetzGeometrie`. */
export interface ArmMass {
  lagerZ: number;
  lagerY: number;
  armLaenge: number;
  winkel0: number;
  kette: number;
}

/**
 * WO ARMSPITZE, ZAPFEN UND MULDE STEHEN (E-141) — im Wagenrahmen (y, z).
 *
 * `alpha` ist der Schwenk der Arme aus der Fahrstellung (rad, nach hinten
 * über das Lager), `kipp` die Drehung der Mulde um ihre Zapfen (rad, positiv:
 * das hintere Ende geht nach unten). Die Mulde hängt an senkrechten Ketten —
 * beim Schwenken bleibt sie waagrecht wie eine Gondel, und gekippt wird sie
 * um die Zapfenachse. Zurück kommt der Ursprung ihres Rahmens
 * (`absetzmulde.ts`: obere Hinterkante, Kufenunterkante).
 */
export function muldenPose(
  g: ArmMass,
  alpha: number,
  kipp: number
): { spitzeY: number; spitzeZ: number; zapfenY: number; zapfenZ: number; y: number; z: number } {
  const w = g.winkel0 + alpha;
  const spitzeZ = g.lagerZ + g.armLaenge * Math.cos(w);
  const spitzeY = g.lagerY + g.armLaenge * Math.sin(w);
  const zapfenY = spitzeY - g.kette;
  const zapfenZ = spitzeZ;
  const zp = zapfenLage();
  // Drehung um x mit −kipp (three.js: +z geht bei positivem Winkel nach unten)
  const a = -kipp;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return {
    spitzeY,
    spitzeZ,
    zapfenY,
    zapfenZ,
    y: zapfenY - (zp.y * c - zp.z * s),
    z: zapfenZ - (zp.y * s + zp.z * c),
  };
}

/**
 * Bei welchem Armschwenk die Mulde hinter dem Wagen auf dem Boden steht (rad):
 * Spitze so tief, dass die Kufen gerade aufsetzen.
 */
export function absetzSchwenk(g: ArmMass): number {
  const zy = zapfenLage().y;
  const sinW = (g.kette + zy - g.lagerY) / g.armLaenge;
  return Math.PI - Math.asin(Math.max(-1, Math.min(1, sinW))) - g.winkel0;
}
