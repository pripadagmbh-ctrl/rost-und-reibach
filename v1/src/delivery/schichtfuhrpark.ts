/**
 * BAUSTEINE DES SCHICHT-FUHRPARKS (E-202) — Wege, Box-Zuordnung, Kassenteile.
 *
 * Was hier steht, braucht `vehicles.ts` (der Fuhrpark) und
 * `schichtbetrieb.ts` (der Disponent) gleichermaßen; es steht hier, damit
 * keiner den anderen importieren muss.
 *
 * Kein neuer Ort und kein neuer Wegsucher: Die beiden neuen Fahrten des
 * Nachrückers (Waage → Warteplatz an der Nordmauer, Warteplatz → Verladeplatz
 * vorn) rechnet derselbe Rangierplaner wie jede Fahrt seit E-140, gegen
 * dieselben Hindernisse wie die Nachbarfahrten (`planHindernisse`, beim Weg
 * nach vorn `verladerHindernisse` aus E-201).
 */
import {
  PARK_SLOTS,
  parkAnfahrt,
  planHindernisse,
  annahmeBelegung,
  ANFAHRT_KOPF,
  BED_LEN,
  VERLADER_VORN,
  zumTor,
} from "./routes";
import { fahrzeugUmriss } from "./umriss";
import { planeRangierzug, bahnTiefe, type Rangierzug } from "./rangierplan";
import type { Rechteck } from "./umriss";
import { beimUmschalten } from "../world/schichtplatz";
import { CONFIGS, type ContainerConfig } from "../world/containers";
import { istPlatzinventar, type ScrapItem } from "../world/scrapItems";
import type { KassenTeil } from "../economy/kasse";

/**
 * DER WARTEPLATZ DES NACHRÜCKERS: an der Nordmauer (−0,3 | 23), E-193.
 * Gemessen dort gegen alle Fahrpläne: berührt keine Strecke und kein Bauwerk.
 * Der Wächter in `test/schichtbetrieb.test.ts` hält die Lage fest.
 */
export const NACHRUECK_SLOT: [number, number] = PARK_SLOTS[2]!;

/**
 * So weit muss der abfahrende Verlader vom Halt weg sein, bevor der
 * Nachrücker losfährt (m). SW: eine Wagenlänge (8 m) plus Luft — so treffen
 * sie sich nicht im Rangierbogen vor dem Bagger.
 */
export const NACHRUECK_ABSTAND_M = 12;

/**
 * Ab hier „steht der Bagger am Lager" (m vom Baggerstand des Verladeplatzes).
 * Dieselben 4 m wie `FOLGE_RADIUS_M` (E-177): wer so nah steht, steht dort.
 */
export const BAGGER_AM_LAGER_M = 4;

/** Phasen, in denen ein Anlieferer an seinem Halt steht — Standzeit läuft (E-202). */
export const HALT_PHASEN: ReadonlySet<string> = new Set([
  "pauseBeforeUnload",
  "tipping",
  "tipHold",
  "tipCreep",
  "tipBack",
  "waitUnload",
  "nudging",
  "muldeHeben",
  "muldeRuhe",
  "muldeKippen",
  "muldeLeeren",
  "muldeSenken",
  "muldeLoesen",
  "armeEin",
  "muldeHolen",
  "muldeAufnehmen",
]);

/* ------------------------------------------------------------ Die Wege */

let vonWaage: Rangierzug | null = null;
let nachVorn: Rangierzug | null = null;
beimUmschalten(() => {
  vonWaage = null;
  nachVorn = null;
});

/**
 * Von der Waage rückwärts auf den Warteplatz an der Nordmauer — wie jeder
 * Wagen, der dort einparkt (Heck zur Mauer, Kabine zum Platz).
 * Gefunden: „LSR 23,0 m vorwärts, Bogen 45°, Gerade 12 m", frei.
 */
export function warteplatzZugVonWaage(): Rangierzug {
  return (vonWaage ??= planeRangierzug(
    ANFAHRT_KOPF,
    NACHRUECK_SLOT,
    Math.PI,
    planHindernisse(NACHRUECK_SLOT),
    BED_LEN.abholer
  ));
}

/** Wogegen der Nachrücker auf dem Weg nach vorn plant: wie der Verlader (E-201), ohne seinen eigenen Warteplatz. */
export function nachVornHindernisse(): Rechteck[] {
  return [
    ...planHindernisse(NACHRUECK_SLOT).filter(
      (o) => !String((o as { label?: string }).label ?? "").startsWith("MUELL")
    ),
    ...annahmeBelegung(),
  ];
}

/**
 * Vom Warteplatz an den Verladeplatz vorn: aus der Bucht nach vorn, dann der
 * Rangierzug, der quer vor dem Bagger zurücksetzt.
 * Gefunden: „RSR 31,4 m vorwärts, Bogen 30° r 7,5 m, Gerade 12 m", frei.
 */
export function verladerVomWarteplatz(): Rangierzug {
  const slot = NACHRUECK_SLOT;
  return (nachVorn ??= planeRangierzug(
    [[slot[0], slot[1]], parkAnfahrt(slot)],
    [VERLADER_VORN.x, VERLADER_VORN.z],
    VERLADER_VORN.gier,
    nachVornHindernisse(),
    BED_LEN.abholer
  ));
}

/**
 * Der stehende Verlader als achsparalleles Rechteck (seine gedrehte
 * Standfläche, umschlossen) — für Fahrten, die an ihm vorbeimüssen.
 */
export function verladerRechteck(zuschlag = SCHLEPP_ZUSCHLAG_M): Rechteck {
  const b = fahrzeugUmriss({ x: VERLADER_VORN.x, z: VERLADER_VORN.z, rot: VERLADER_VORN.gier }, BED_LEN.abholer!);
  const c = Math.abs(Math.cos(b.rot));
  const s = Math.abs(Math.sin(b.rot));
  return { x: b.x, z: b.z, hw: b.hw * c + b.hd * s + zuschlag, hd: b.hw * s + b.hd * c + zuschlag };
}

/**
 * Zuschlag um den Verlader (m) für die Planung: Der Bahnfolger schwenkt im
 * Bogen nach außen, gemessen bis 0,21 m über die Linie hinaus (siehe unten).
 * SW: 0,4 m — knapp das Doppelte, zusätzlich zum Planungsrand `RANGIER.rand`.
 */
export const SCHLEPP_ZUSCHLAG_M = 0.4;

/**
 * DIE AUSFAHRT VON DER ANNAHME IN DER SCHICHT (E-202).
 *
 * Gemessen mit dem Einspurmodell (gefahrene Bahn, echter Umriss): Die
 * Ausfahrt des Sandkastens (`routeOut`, `absetzAusfahrt`) streift den quer
 * vor dem Bagger stehenden Verlader um 0,17 bis 0,21 m — der Wagen schwenkt
 * im Bogen nach Nordwesten aus. Die S1-Prüfung (E-201) hatte die Linie der
 * Strecke geprüft, nicht die Schleppkurve. Hier wird der Weg zum Tor deshalb
 * mit dem Verlader als Hindernis neu gerechnet — dieselbe Rechnung
 * (`zumTor`), derselbe Anfang (Halt, dann die Gasse hinauf).
 */
export function annahmeAusfahrt(standard: ReadonlyArray<[number, number]>): Array<[number, number]> {
  const key = JSON.stringify([standard[0], standard[1]]);
  const schon = ausfahrten.get(key);
  if (schon) return schon;
  const [hx, hz] = standard[0]!;
  const [rx, rz] = standard[1]!;
  const extra = [verladerRechteck()];
  const hind = [...planHindernisse(), ...extra];
  /*
   * Jeder Dubins-Weg beginnt mit einem Bogen — von der Gasse aus biegt er
   * also sofort nach Westen ab, mitten in den Verlader. Deshalb fährt der
   * Wagen erst geradeaus die Gasse hinauf (in Fahrtrichtung, 1-m-Schritte)
   * und biegt am ersten Punkt ab, von dem aus der ganze Weg frei ist.
   */
  const lang = Math.hypot(rx - hx, rz - hz) || 1;
  const [ux, uz] = [(rx - hx) / lang, (rz - hz) / lang];
  let weg = zumTor([standard[0]!, standard[1]!], null, false, extra);
  for (let m = 0; m <= 14 && streckenTiefe(weg, hind) > 0; m++) {
    weg = zumTor([standard[0]!, standard[1]!, [rx + ux * m, rz + uz * m]], null, false, extra);
  }
  ausfahrten.set(key, weg);
  return weg;
}
const ausfahrten = new Map<string, Array<[number, number]>>();
beimUmschalten(() => ausfahrten.clear());

/** Wie tief der Umriss entlang dieser Punktkette (Hinterachse) in den Hindernissen steckt. */
export function streckenTiefe(r: ReadonlyArray<readonly [number, number]>, hind: readonly Rechteck[]): number {
  const lagen = [];
  for (let i = 0; i + 1 < r.length; i++) {
    const [ax, az] = r[i]!;
    const [bx, bz] = r[i + 1]!;
    if (Math.hypot(bx - ax, bz - az) < 1e-6) continue;
    lagen.push({ x: ax, z: az, gier: Math.atan2(bx - ax, bz - az) });
  }
  // Die Torausfahrt selbst ist seit E-140 geprüft; gemessen wird bis zur Waage
  return bahnTiefe(lagen.filter((l) => l.z < 14), hind);
}

/* ---------------------------------------------------- Boxen und Kasse */

/** Die Bestellungen, für die eine Box einen eigenen Abholer ruft (Konzept Abschnitt 4). */
export type BoxOrder = "steel" | "copper" | "rubble";
export const BOX_ORDERS: readonly BoxOrder[] = ["steel", "copper", "rubble"];

/**
 * Die Box am Bagger zu einer Bestellung: STAHL (`c_steel`), BUNT + VA
 * (`r_bunt`, Leitfraktion Kupfer), im Schicht-Platz die MÜLL-Halde
 * (`c_mixed`, E-201). Gesucht nach Leitfraktion, ohne die Lagersilos —
 * so steht keine zweite Liste neben `containers.ts`.
 */
export function boxFuer(order: BoxOrder): ContainerConfig {
  const c = CONFIGS.find((k) => k.fractionId === order && k.lager !== true);
  if (!c) throw new Error(`Schicht: keine Box für ${order}`);
  return c;
}

/**
 * Ein Teil so, wie die Schicht-Kasse es bucht (`economy/kasse.ts`, `KassenTeil`).
 *
 * Dieselbe Lesart wie der Verkauf im Sandkasten (`account.sellContainer`,
 * E-094): Das GEWICHT kommt aus `composition` (Platzinventar wiegt darin
 * nichts, E-079), die SORTEN aus `fraktionsmix` (Presspaket). Die Stückliste
 * eines gewöhnlichen Teils (`composition` aus `shape.zusammensetzung`, „woraus
 * ist es gemacht") geht NICHT an die Kasse — ein Teil zählt nach seiner
 * Fraktion (E-091).
 */
export function kassenTeilAus(it: Pick<ScrapItem, "materialId" | "massKg" | "composition" | "fraktionsmix" | "shape">): KassenTeil {
  if (istPlatzinventar(it.shape)) return { materialId: it.materialId, massKg: 0 };
  const wirtKg = (it.composition ?? [{ massKg: it.massKg }]).reduce((s, c) => s + c.massKg, 0);
  if (it.fraktionsmix && it.fraktionsmix.length > 0) {
    return {
      materialId: it.materialId,
      massKg: wirtKg,
      zusammensetzung: it.fraktionsmix.map((f) => ({ materialId: f.materialId, massKg: f.massKg })),
    };
  }
  return { materialId: it.materialId, massKg: wirtKg };
}
