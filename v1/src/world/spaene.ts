import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { type Anteil, fraktionVonTeil } from "../materials/purity";
import { getMaterial } from "../materials/catalog";
import type { ScrapShape } from "./scrapItems";

/**
 * SPÄNEKNÄUEL (E-147) — Dreh- und Frässpäne aus der Dreherei, lose geknäuelt.
 *
 * Patrick, 17.10.2026: „Späne ins Spiel integrieren" — als lose Haufen aus
 * Knäueln (wie Stahlwolle, Drehspanbündel), im Absetzcontainer angeliefert,
 * und sie zählen als Mischschrott.
 *
 * Ein Knäuel ist im Spiel ein Quader-Teil (`kind: "box"`, `dims` = sein
 * Hüllquader). Damit gelten Packer (`ladung.stueckMass`), Umkugel, Fraktions-
 * regel und Spielstand unverändert. Neu ist nur, WIE es aussieht und welcher
 * Kollider es trägt — beides hängt an `ScrapShape.spaene` (Variante 0..2).
 */

/**
 * Woraus ein Knäuel besteht.
 *
 * Mischspäne: Auf derselben Drehbank laufen Stahl, Alu und Messing, und die
 * Späne landen in einem Behälter. SW: 82 % Stahl, 11 % Alu, 7 % Messing.
 * 18 % Fremdmetall liegt über `VERBUND_BIS` (15 %) — die EINE Regel in
 * `purity.fraktionVonTeil` macht daraus Mischschrott, ohne Sonderfall.
 * Zusätzlich ist ein Knäuel dünnwandig (rechnerisch rund 2 mm, Schwelle 6 mm):
 * Auch ohne Fremdmetall wäre es kein Stahlschrott.
 *
 * Das Öl bzw. der Kühlschmierstoff steht NICHT in der Liste: Es gibt dafür
 * keine Stoffklasse im Katalog (`getMaterial` wirft bei Unbekanntem), und eine
 * neue wäre eine neue Fraktion mit Mulde. Man sieht es an der Farbe.
 *
 * Der Stahlanteil bleibt abfragbar: `ScrapItem.composition` trägt ihn in kg.
 */
export const SPAENE_ZUSAMMENSETZUNG: Anteil[] = [
  { materialId: "steel", anteil: 0.82 },
  { materialId: "alu", anteil: 0.11 },
  { materialId: "brass", anteil: 0.07 },
];

/**
 * Drei Größen, je eine geteilte Geometrie.
 *
 * SW: Ø rund 0,40 / 0,44 / 0,47 m bei 11 / 14 / 18 kg. Ein loses Knäuel aus
 * Wirrspänen: 14 kg auf dem mittleren Hüllquader (0,068 m³) sind rund
 * 200 kg/m³, in der Größenordnung loser Wirrspäne (0,1–0,3 t/m³,
 * `schuettdichte.SPAENE_SCHUETTDICHTE`).
 *
 * Die Obergrenze 0,47 m kommt aus der Mulde: Drei Knäuel nebeneinander
 * passen in die 1,53 m Innenbreite nur mit höchstens 0,50 m Raster
 * (`SPAENE_RASTER`). Kleinere Knäuel (erster Entwurf 0,26–0,37 m) füllten
 * die Mulde mit 48 Körpern nur eine Handbreit hoch — Patrick will eine volle
 * Mulde sehen, und mehr Körper kosten Rechenzeit.
 *
 * Die Massen werden beim Beladen wie jede Fuhre auf die angekündigte Menge
 * gezogen (`vehicles.loadCargo`).
 */
export const SPAENE_VARIANTEN: ReadonlyArray<{ massKg: number; dims: [number, number, number] }> = [
  { massKg: 11, dims: [0.4, 0.34, 0.42] },
  { massKg: 14, dims: [0.44, 0.36, 0.43] },
  { massKg: 18, dims: [0.47, 0.39, 0.47] },
];

/**
 * Das Schüttgitter der Mulde. SW: 0,50 m quer und längs (3 × 4 in der
 * Mulde), 0,42 m hoch (4 Lagen bis 1,68 m, unter der Ladehöhe 1,78 m). Je
 * Gitterplatz ein Knäuel; der Spalt zum größten Knäuel (3 cm) verhindert
 * Überlappung beim Setzen (v2 E-010) — auch gedreht, weil `spaeneDrehung`
 * nur Vierteldrehungen und Kopfstand kennt.
 */
export const SPAENE_RASTER = { quer: 0.5, hoch: 0.42 };

/**
 * Gitterplätze für eine Spänefuhre, unten zuerst. Koordinaten wie beim
 * Packer (`ladung.LadePlatz`): x quer (0 = Mitte), y Unterkante über dem
 * Boden, z Mitte ab vorderem Rand. Wie viele: Gitter × Füllgrad, höchstens
 * `SPAENE_STUECK_MAX`.
 */
export function spaeneSchuettung(
  halbBreite: number,
  laenge: number,
  maxHoehe: number,
  fuellgrad: number
): Array<{ x: number; y: number; z: number }> {
  const nx = Math.floor((halbBreite * 2) / SPAENE_RASTER.quer);
  const nz = Math.floor(laenge / SPAENE_RASTER.quer);
  const ny = Math.floor(maxHoehe / SPAENE_RASTER.hoch);
  const anzahl = Math.min(SPAENE_STUECK_MAX, Math.round(nx * nz * ny * Math.min(1, Math.max(0, fuellgrad))));
  const x0 = -((nx - 1) * SPAENE_RASTER.quer) / 2;
  const z0 = (laenge - (nz - 1) * SPAENE_RASTER.quer) / 2;
  const out: Array<{ x: number; y: number; z: number }> = [];
  for (let iy = 0; iy < ny; iy++)
    for (let iz = 0; iz < nz; iz++)
      for (let ix = 0; ix < nx; ix++) {
        if (out.length >= anzahl) return out;
        out.push({ x: x0 + ix * SPAENE_RASTER.quer, y: iy * SPAENE_RASTER.hoch, z: z0 + iz * SPAENE_RASTER.quer });
      }
  return out;
}

export const SPAENE_NAME = "Späneknäuel";

/**
 * So viele Knäuel liegen höchstens in einer Mulde: das volle Schüttgitter
 * (3 × 4 × 4). Gewöhnliche Fuhren sind bei 28 Körpern gedeckelt
 * (`vehicles.loadCargo`); Späne sind leicht und schlafen schnell ein —
 * gemessen in E-147 (`tools/spaenelauf.ts`).
 */
export const SPAENE_STUECK_MAX = 48;

/** Fester Zufall je Variante — `Math.random` bleibt unberührt (E-123). */
function zufall(saat: number): () => number {
  let s = saat;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/*
 * Farben: stahlgrau, blau angelaufen, braun angelaufen, ölig dunkel.
 * Anlauffarben entstehen beim Zerspanen durch Hitze (Strohgelb → Braun →
 * Purpur → Blau, ab rund 220 °C) — Patrick: „blau angelaufen/stahlgrau/ölig".
 */
const STAHLGRAU = 0x8b9096;
const BLAU = 0x45578c;
const PURPUR = 0x6b4f66;
const OELIG = 0x3a3c3e;
const STRANG_FARBEN = [STAHLGRAU, BLAU, STAHLGRAU, PURPUR, BLAU];

/** SW: vier Stränge je Knäuel, 44 Abschnitte, Dreikant-Rohr (≈ 1 080 Dreiecke). */
const STRAENGE = 4;
const ABSCHNITTE = 44;

const geoCache = new Map<number, THREE.BufferGeometry>();
const huelleCache = new Map<number, Float32Array>();

function faerbe(geo: THREE.BufferGeometry, hex: number, rnd: () => number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.getAttribute("position").count;
  const c = new THREE.Color(hex);
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    // leichtes Flimmern im Ton, damit ein Strang nicht wie lackiert aussieht
    const k = 0.85 + rnd() * 0.3;
    arr[i * 3] = c.r * k;
    arr[i * 3 + 1] = c.g * k;
    arr[i * 3 + 2] = c.b * k;
  }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  g.deleteAttribute("uv");
  return g;
}

/**
 * Das Netz eines Knäuels — EIN Netz, Eckfarben, geteilt von allen Knäueln
 * derselben Variante (ein Zeichenruf je Knäuel, keine Geometrie je Knäuel).
 *
 * Jeder Strang ist ein Drehspan: eine Wendel (7 Windungen), deren Achse als
 * Lissajous-Schleife durch den Hüllquader läuft. Drei solche Stränge und ein
 * dunkler, öliger Kern ergeben das Bild eines verfilzten Knäuels.
 */
export function spaeneGeometrie(variante: number): THREE.BufferGeometry {
  const v = Math.max(0, Math.min(SPAENE_VARIANTEN.length - 1, Math.round(variante)));
  const fertig = geoCache.get(v);
  if (fertig) return fertig;
  const [w, h, d] = SPAENE_VARIANTEN[v].dims;
  const rnd = zufall(4711 + v * 977);
  const teile: THREE.BufferGeometry[] = [];
  const achse = new THREE.Vector3();
  const tang = new THREE.Vector3();
  const u = new THREE.Vector3();
  const vv = new THREE.Vector3();
  const OBEN = new THREE.Vector3(0, 1, 0);
  const wendel = Math.min(w, h, d) * 0.12; // Windungsradius des Spans
  const rohr = Math.min(w, h, d) * 0.022; // überzeichnet: ein echter Span ist 1–3 mm
  for (let s = 0; s < STRAENGE; s++) {
    const f = [1 + Math.floor(rnd() * 3), 2 + Math.floor(rnd() * 3), 1 + Math.floor(rnd() * 3)];
    const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
    const ax = (t: number, out: THREE.Vector3): THREE.Vector3 =>
      out.set(
        Math.sin(f[0] * t + ph[0]) * (w / 2 - wendel - rohr) * 0.95,
        Math.sin(f[1] * t + ph[1]) * (h / 2 - wendel - rohr) * 0.95,
        Math.cos(f[2] * t + ph[2]) * (d / 2 - wendel - rohr) * 0.95
      );
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= ABSCHNITTE; i++) {
      const t = (i / ABSCHNITTE) * Math.PI * 2;
      ax(t, achse);
      ax(t + 0.01, tang).sub(achse).normalize();
      u.crossVectors(tang, OBEN);
      if (u.lengthSq() < 1e-6) u.set(1, 0, 0);
      u.normalize();
      vv.crossVectors(tang, u).normalize();
      const a = (i / ABSCHNITTE) * Math.PI * 2 * 7;
      pts.push(achse.clone().addScaledVector(u, Math.cos(a) * wendel).addScaledVector(vv, Math.sin(a) * wendel));
    }
    const kurve = new THREE.CatmullRomCurve3(pts, false);
    teile.push(faerbe(new THREE.TubeGeometry(kurve, ABSCHNITTE, rohr, 3, false), STRANG_FARBEN[(s + v) % STRANG_FARBEN.length], rnd));
  }
  // Der dichte Kern — ohne ihn sähe man durch das Knäuel hindurch.
  const kern = new THREE.IcosahedronGeometry(1, 0);
  kern.scale(w * 0.24, h * 0.24, d * 0.24);
  teile.push(faerbe(kern, OELIG, rnd));
  const geo = mergeGeometries(teile) ?? new THREE.BoxGeometry(w, h, d);
  for (const t of teile) t.dispose();
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  geoCache.set(v, geo);
  return geo;
}

/**
 * Die Punktwolke des Kolliders: ein Quader mit abgeschrägten Ecken (24
 * Punkte) im Hüllquader. Keine Kugel — die rollte endlos (v2 E-011). Auch
 * kein Ikosaeder (erster Entwurf): Vier Lagen davon in der Mulde schaukelten
 * sich gegenseitig wach, gemessen 41 von 42 Knäueln noch 10 s nach der
 * Abfahrt. Mit großen ebenen Flächen liegen sie wie Ziegel — und verhaken
 * sich ja auch in Wirklichkeit, statt zu rollen.
 */
export function spaeneHuelle(variante: number): Float32Array {
  const v = Math.max(0, Math.min(SPAENE_VARIANTEN.length - 1, Math.round(variante)));
  const fertig = huelleCache.get(v);
  if (fertig) return fertig;
  const [w, h, d] = SPAENE_VARIANTEN[v].dims;
  const rnd = zufall(815 + v * 31);
  const SCHRAEG = 0.7; // SW: Ecken auf 70 % abgeschrägt
  const out: number[] = [];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1])
        for (let achse = 0; achse < 3; achse++) {
          // SW: 92–100 % — verbeult, aber nie größer als der Hüllquader
          const k = 0.92 + rnd() * 0.08;
          const f = [SCHRAEG, SCHRAEG, SCHRAEG];
          f[achse] = 1;
          out.push((sx * f[0]! * w * k) / 2, (sy * f[1]! * h * k) / 2, (sz * f[2]! * d * k) / 2);
        }
  const arr = new Float32Array(out);
  huelleCache.set(v, arr);
  return arr;
}

/**
 * Eine zufällige der acht Lagen, in denen ein Knäuel seinen Hüllquader nicht
 * verlässt (Vierteldrehungen um die Hochachse, wahlweise kopfüber) — sonst
 * lägen alle Knäuel einer Variante gleich in der Mulde.
 */
export function spaeneDrehung(): THREE.Quaternion {
  const r = Math.floor(Math.random() * 8);
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(r >= 4 ? Math.PI : 0, (r % 4) * (Math.PI / 2), 0));
}

/**
 * Eine Fuhre Späne — `n` Knäuel in gemischter Größe, für `vehicles.loadCargo`.
 * Dieselbe Form wie `randomCargo`. Die Fraktion rechnet `fraktionVonTeil`.
 */
export function spaeneCargo(n: number): Array<{ materialId: string; massKg: number; shape: ScrapShape }> {
  const out = [];
  for (let i = 0; i < n; i++) {
    const v = Math.floor(Math.random() * SPAENE_VARIANTEN.length);
    const { massKg, dims } = SPAENE_VARIANTEN[v];
    const materialId = fraktionVonTeil({ materialId: "steel", massKg, kind: "box", dims, zusammensetzung: SPAENE_ZUSAMMENSETZUNG });
    out.push({
      materialId,
      massKg,
      shape: {
        kind: "box" as const,
        dims: [...dims],
        color: getMaterial(materialId).color,
        name: SPAENE_NAME,
        zusammensetzung: SPAENE_ZUSAMMENSETZUNG,
        spaene: v,
      },
    });
  }
  return out;
}
