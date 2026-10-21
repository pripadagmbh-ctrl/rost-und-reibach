/**
 * DER MÜLLWECHSEL (E-190, seit E-192 in zwei Fahrten) — wo der Abroller hält
 * und wie er hinkommt.
 *
 * E-190 tauschte an Ort und Stelle: den leeren neben den vollen, den vollen
 * hoch. Dafür braucht es zwei Stellplätze. Seit E-192 steht der Müll vor dem
 * Bagger, ohne Spur und Fahrlinie zu berühren — und dort ist nur für EINEN
 * Platz (`world/containers.ts`, `MUELL_PLAETZE`, mit Messung). Darum jetzt
 * wörtlich „voll weg, leer zurück":
 *
 *   holen    Der Abroller kommt ohne Container, zieht den vollen hoch und
 *            fährt vom Hof.
 *   bringen  Gleich danach kommt er mit einem leeren zurück und stellt ihn
 *            auf den Müllplatz. So auch beim ersten Mal (im Sandkasten steht
 *            zum Start keiner).
 *
 * Steht der volle woanders (versetzt, gehoben), holt der Abroller ihn dort,
 * wenn ein Rangierzug frei hinkommt; sonst funkt das Büro.
 */
import {
  ANFAHRT_KOPF,
  BED_LEN,
  fahrHindernisse,
  planHindernisse,
  zumTor,
} from "./routes";
import { planeRangierzugOderNull, type Rangierzug } from "./rangierplan";
import { tiefsteDurchdringung, type Rechteck } from "./umriss";
import { abstandAmBoden, hakenGeometrie, MUELL_WANNE } from "./hakenlift";
import { MUELL_PLAETZE as MUELL_PLAETZE_WELT } from "../world/containers";

/** Wo ein Container steht: Mitte der Grundfläche und Richtung seines Hakenbügels (Gier, wie `rotation.y`). */
export interface WannenOrt {
  x: number;
  z: number;
  gier: number;
}

/**
 * Die zwei Stellplätze — seit E-192 links und rechts vor dem Bagger, nicht
 * mehr nebeneinander (Platz B stand in seiner Fahrlinie). Eine Quelle:
 * `world/containers.ts`, dort mit Herleitung.
 */
export const MUELL_PLAETZE: readonly WannenOrt[] = MUELL_PLAETZE_WELT;

/** Rahmenlänge des Abrollers — derselbe Wagen wie der Abholer. */
const BED = BED_LEN.abholer!;

/** Achsparalleles Rechteck um einen Container (gedreht: um seine Hülle). */
export function wannenRechteck(w: WannenOrt, rand = 0): Rechteck {
  const c = Math.abs(Math.cos(w.gier));
  const s = Math.abs(Math.sin(w.gier));
  const hb = MUELL_WANNE.breite / 2;
  const hl = MUELL_WANNE.laenge / 2;
  return { x: w.x, z: w.z, hw: hb * c + hl * s + rand, hd: hb * s + hl * c + rand };
}

/** Wo der Wagen hält, um diesen Container abzusetzen oder zu holen: Ursprung und Gier der Kabine. */
export function haltAn(w: WannenOrt): { x: number; z: number; gier: number } {
  const a = abstandAmBoden(hakenGeometrie(BED));
  return { x: w.x + Math.sin(w.gier) * a, z: w.z + Math.cos(w.gier) * a, gier: w.gier };
}

/** Der freie Streifen zwischen Wagenheck und Container — dort rollt er über. */
function streifen(w: WannenOrt): Rechteck {
  const a = abstandAmBoden(hakenGeometrie(BED));
  const vonC = MUELL_WANNE.laenge / 2;
  const bisC = a - BED / 2;
  const mitte = (vonC + bisC) / 2;
  const halb = (bisC - vonC) / 2;
  const c = Math.abs(Math.cos(w.gier));
  const s = Math.abs(Math.sin(w.gier));
  const hb = MUELL_WANNE.breite / 2;
  return {
    x: w.x + Math.sin(w.gier) * mitte,
    z: w.z + Math.cos(w.gier) * mitte,
    hw: hb * c + halb * s,
    hd: hb * s + halb * c,
  };
}

export interface MuellPlan {
  /** Wohin er einen leeren stellt — null, wenn er holt */
  leer: WannenOrt | null;
  /** Welchen vollen er holt — null, wenn er bringt */
  voll: WannenOrt | null;
  /** Von der Waage zum Halt am Container */
  hin: Rangierzug;
  /** Vom Halt zum Tor */
  ausfahrt: Array<[number, number]>;
}

/**
 * Die Fahrt planen: steht ein Container (`voll`), holen; sonst einen leeren
 * auf den Müllplatz bringen. `null`, wenn kein Rangierzug frei hinführt oder
 * der Streifen hinter dem Wagen verbaut ist — dann funkt das Büro „Stell den
 * Müll-Container an seinen Platz".
 *
 * Geplant wird gegen die Bauwerke (mit Startplätzen von MÜLL, LKW-Wrack,
 * Baggerstand und den Warteplätzen, `planHindernisse`) und gegen den
 * Container selbst: Der Wagen hält vor ihm, nie auf ihm.
 */
export function planeMuellwechsel(voll: WannenOrt | null): MuellPlan | null {
  const fest = fahrHindernisse().filter((o) => !o.label.startsWith("MUELL"));
  const ziel = voll ?? MUELL_PLAETZE[0]!;
  if (!voll && tiefsteDurchdringung([{ ...wannenRechteck(ziel), rot: 0 }], fest) > 0) return null;
  // Der Streifen zum Überrollen muss frei von Bauwerken sein
  const st = streifen(ziel);
  if (tiefsteDurchdringung([{ ...st, rot: 0 }], fest) > 0) return null;
  const hind: Rechteck[] = [
    ...planHindernisse().filter((o) => !("label" in o) || !(o as { label: string }).label.startsWith("MUELL")),
    ...MUELL_PLAETZE.map((p) => wannenRechteck(p)),
    wannenRechteck(ziel),
  ];
  const h = haltAn(ziel);
  const hin = planeRangierzugOderNull(ANFAHRT_KOPF, [h.x, h.z], h.gier, hind, true, undefined, BED);
  if (!hin) return null;
  const ausfahrt = zumTor([
    [h.x - Math.sin(h.gier), h.z - Math.cos(h.gier)],
    [h.x, h.z],
  ]);
  return voll ? { leer: null, voll, hin, ausfahrt } : { leer: ziel, voll: null, hin, ausfahrt };
}

/** Steht der Bagger zu nah an diesem Container, um ihn abzusetzen oder zu holen (Rechteck + 2 m)? */
export function baggerImWeg(w: WannenOrt, bagger: { x: number; z: number } | null): boolean {
  if (!bagger) return false;
  const r = wannenRechteck(w, 2);
  return Math.abs(bagger.x - r.x) < r.hw && Math.abs(bagger.z - r.z) < r.hd;
}
