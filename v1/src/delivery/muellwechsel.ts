/**
 * DER MÜLLWECHSEL (E-190) — wo der Abroller hält und wie er hinkommt.
 *
 * Patrick, 21.10.2026: „Voll weg, leer zurück" — der Abroller stellt erst
 * einen LEEREN Müll-Container ab, zieht dann den vollen hoch und fährt. So
 * steht auf dem Platz immer einer.
 *
 * WOHIN DER LEERE KOMMT. Am Müllplatz ist nur Platz für einen Container, und
 * solange der volle dort steht, kann der leere nicht dorthin. Es gibt deshalb
 * ZWEI Stellplätze nebeneinander: A an der Schwelle der BUNT + VA (der
 * Startplatz, `MUELL_START`, E-183) und B 0,7 m östlich daneben. Der leere
 * kommt auf den freien — steht der volle auf A, auf B, und beim nächsten
 * Wechsel wieder auf A. Jeder zweite Wechsel endet also genau am Platz, und
 * keiner braucht mehr als zwei Hakenfahrten. (Die Alternative „exakt am Platz"
 * hätte vier Hakenfahrten gekostet: leer abstellen, voll aufnehmen, voll
 * absetzen, leer umsetzen, voll wieder aufnehmen — Patrick hat zwei genannt.)
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
import { MUELL_START } from "../world/containers";

/** Wo ein Container steht: Mitte der Grundfläche und Richtung seines Hakenbügels (Gier, wie `rotation.y`). */
export interface WannenOrt {
  x: number;
  z: number;
  gier: number;
}

/** Die zwei Stellplätze am Müllplatz (siehe oben). Hakenbügel nach Norden, dort ist Platz zum Rangieren. */
export const MUELL_PLAETZE: readonly WannenOrt[] = [
  { x: MUELL_START.x, z: MUELL_START.z, gier: 0 },
  // SW: 0,7 m Luft zwischen beiden — genug, dass sich die Kufen nicht berühren
  { x: MUELL_START.x + MUELL_WANNE.breite + 0.7, z: MUELL_START.z, gier: 0 },
];

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
  /** Wohin der leere kommt */
  leer: WannenOrt;
  /** Wo der volle steht */
  voll: WannenOrt;
  /** Von der Waage zum Abstellen */
  hin: Rangierzug;
  /** Vom Abstellen zum Holen */
  zumVollen: Rangierzug;
  /** Vom Holen zum Tor */
  ausfahrt: Array<[number, number]>;
}

/**
 * Den Wechsel planen. `null`, wenn kein Stellplatz frei ist oder kein
 * Rangierzug frei hinkommt — dann funkt das Büro „Stell den Müll-Container an
 * seinen Platz".
 *
 * Geplant wird gegen die Bauwerke (mit Startplätzen von MÜLL, LKW-Wrack,
 * Baggerstand und den Warteplätzen, `planHindernisse`) und gegen BEIDE
 * Container: Der Wagen hält vor ihnen, nie auf ihnen.
 */
export function planeMuellwechsel(voll: WannenOrt): MuellPlan | null {
  const vollR = wannenRechteck(voll, 0.5);
  const fest = fahrHindernisse().filter((o) => !o.label.startsWith("MUELL"));
  const leer = MUELL_PLAETZE.find((p) => {
    const r = wannenRechteck(p);
    const frei = Math.abs(r.x - vollR.x) >= r.hw + vollR.hw || Math.abs(r.z - vollR.z) >= r.hd + vollR.hd;
    return frei && tiefsteDurchdringung([{ ...r, rot: 0 }], fest) <= 0;
  });
  if (!leer) return null;
  // Der Streifen zum Überrollen muss frei von Bauwerken sein (an beiden)
  for (const w of [leer, voll]) {
    const s = streifen(w);
    if (tiefsteDurchdringung([{ ...s, rot: 0 }], fest) > 0) return null;
  }
  const hind: Rechteck[] = [
    ...planHindernisse().filter((o) => !("label" in o) || !(o as { label: string }).label.startsWith("MUELL")),
    wannenRechteck(leer),
    wannenRechteck(voll),
  ];
  const hL = haltAn(leer);
  const hV = haltAn(voll);
  const hin = planeRangierzugOderNull(ANFAHRT_KOPF, [hL.x, hL.z], hL.gier, hind, true, undefined, BED);
  if (!hin) return null;
  const vor: Array<[number, number]> = [
    [hL.x - Math.sin(hL.gier), hL.z - Math.cos(hL.gier)],
    [hL.x, hL.z],
  ];
  const zumVollen = planeRangierzugOderNull(vor, [hV.x, hV.z], hV.gier, hind, true, undefined, BED);
  if (!zumVollen) return null;
  const ausfahrt = zumTor([
    [hV.x - Math.sin(hV.gier), hV.z - Math.cos(hV.gier)],
    [hV.x, hV.z],
  ]);
  return { leer, voll, hin, zumVollen, ausfahrt };
}

/** Steht der Bagger zu nah an diesem Container, um ihn abzusetzen oder zu holen (Rechteck + 2 m)? */
export function baggerImWeg(w: WannenOrt, bagger: { x: number; z: number } | null): boolean {
  if (!bagger) return false;
  const r = wannenRechteck(w, 2);
  return Math.abs(bagger.x - r.x) < r.hw && Math.abs(bagger.z - r.z) < r.hd;
}
