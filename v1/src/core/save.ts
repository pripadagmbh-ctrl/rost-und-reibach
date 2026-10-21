import type { ScrapShape } from "../world/scrapItems";
import { normalizeMaterialId } from "../materials/catalog";
import { STANDARD_SENDER } from "../audio/songs";

/**
 * Spielstand M3 (Briefing Kap. 18): JSON mit Schema-Version + Migrationspfad.
 * Strategie: Laden = Seite bootet aus dem Save statt aus den Defaults —
 * kein Welt-Teardown zur Laufzeit nötig.
 */

export interface SavedItem {
  materialId: string;
  massKg: number;
  shape: ScrapShape;
  pos: number[]; // [x,y,z]
  rot: number[]; // [x,y,z,w]
}

export interface SavedCar {
  pos: number[];
  rot: number[];
  crushStage: number;
  torn: string[];
  brokenWindows: string[];
}

/** Was das Kabinenradio sich merkt. */
export interface RadioState {
  /** Kennung des Senders aus `audio/songs.ts` */
  songId: string;
}

export interface SaveData {
  schemaVersion: 2;
  savedAt: string;
  moneyEur: number;
  /**
   * Betriebszahlen — fehlen in alten Ständen, dann wird bei null begonnen.
   *
   * Seit dem 22.09.2026 (E-113) stehen die TAGESZAHLEN mit drin: `heuteKg`,
   * `heuteReinKg`, `tag` und der Kontostand vom Morgen. Ohne sie bekäme ein
   * Stand, der mittags gespeichert wurde, abends eine andere Abrechnung als
   * derselbe Tag ohne Speichern.
   *
   * Ohne Schemawechsel, wie bei `greifer` (E-059): Alle neuen Felder sind
   * wahlfrei, und was fehlt, ergänzt `Shift.load()` an genau einer Stelle
   * (dort steht auch, warum `turnoverKg` der Karrierezähler bleibt). Ein Stand
   * vom 21.09. lädt damit unverändert weiter — geprüft in `test/save.test.ts`.
   */
  shift?: {
    t: number;
    turnoverKg: number;
    pickups: number;
    deliveries: number;
    heuteKg?: number;
    heuteReinKg?: number;
    tag?: number;
    startKontoEur?: number | null;
  };
  /** Tageszeit 0..1 (0,25 = Sonnenaufgang) */
  timeOfDay?: number;
  /** Wie weit der geführte Einstieg ist */
  tutorial?: { index?: number; finished?: boolean };
  /** Ruf bei den drei Kundengruppen */
  reputation?: { privat?: number; haendler?: number; gewerbe?: number };
  /** Gekaufte Ausbaustufen */
  upgrades?: string[];
  /** Gewaehlter Radiosender (ab Schema 2) */
  radio?: RadioState;
  /**
   * Welcher Greifer haengt — „fuenfschalen" oder „magnet" (E-059, E-146).
   *
   * Optional und ohne Schemawechsel. Seit E-155 (18.10.2026: „sichelkralle aus
   * spiel entfernen") laedt ein Stand mit „sichel" oder ohne dieses Feld mit
   * dem Fuenfschalengreifer.
   */
  greifer?: string;
  items: SavedItem[];
  cars: SavedCar[];
  fencesBroken: boolean[];
}

export const SAVE_KEY = "schrottplatz_save";

/** E-191: der Maschendraht-Besen (Platzinventar) und der Maschendraht-Ballen. */
function istMaschendraht(it: SavedItem): boolean {
  const s = it?.shape as Partial<ScrapShape> | undefined;
  return s?.inventar === "besen" || s?.name === "Maschendraht-Besen" || s?.name === "Maschendraht-Ballen";
}
export const CURRENT_SCHEMA = 2;

/**
 * Rohdaten validieren und auf das aktuelle Schema migrieren.
 * Liefert null bei unbrauchbaren Daten (dann: neues Spiel).
 */
export function migrate(raw: unknown): SaveData | null {
  if (typeof raw !== "object" || raw === null) return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.schemaVersion !== "number" || d.schemaVersion < 1 || d.schemaVersion > CURRENT_SCHEMA) {
    return null;
  }
  if (
    typeof d.moneyEur !== "number" ||
    !Array.isArray(d.items) ||
    !Array.isArray(d.cars) ||
    !Array.isArray(d.fencesBroken)
  ) {
    return null;
  }
  /*
   * E-191 (21.10.2026, Patrick: „Maschendraht verschwindet."): Besen und
   * Ballen aus alten Ständen fliegen beim Laden raus. Kein neues Schema — das
   * Format bleibt, nur zwei Teile gibt es nicht mehr.
   */
  d.items = (d.items as SavedItem[]).filter((it) => !istMaschendraht(it));
  // Fraktionen aus älteren Ständen umschlüsseln (Guss → Stahlschrott usw.)
  for (const it of d.items as SavedItem[]) {
    it.materialId = normalizeMaterialId(it.materialId);
  }
  /*
   * v1 → v2 (14.09.2026): Das Kabinenradio hat mehrere Sender bekommen und
   * merkt sich, welcher läuft. Alte Stände kannten nur ein Stück — sie
   * bekommen den Standardsender. Bewusst nicht den, der zuletzt lief: Ein
   * Stand ohne gespeicherte Wahl hat nie eine getroffen, und er soll sich
   * anhören wie ein neuer. Welcher das ist, steht an genau einer Stelle
   * (`STANDARD_SENDER`) und ist seit dem 17.09.2026 Werkhof 90,4.
   */
  if (d.schemaVersion === 1) {
    d.schemaVersion = 2;
    d.radio = { songId: STANDARD_SENDER };
  }
  // Ein unbekannter Sender (Stand aus einer neueren Fassung, Tippfehler von
  // Hand) darf nicht ins Leere greifen — dann eben der Standard.
  const r = d.radio as Record<string, unknown> | undefined;
  if (!r || typeof r.songId !== "string") d.radio = { songId: STANDARD_SENDER };
  return d as unknown as SaveData;
}

/**
 * Die Senderwahl im vorhandenen Stand nachtragen, ohne sonst etwas anzufassen.
 *
 * Zweiter Speicherort wäre der falsche Weg: Es gibt genau einen Spielstand mit
 * genau einem Schema. Existiert noch keiner, wird auch keiner angelegt — die
 * Wahl steht dann im Arbeitsspeicher und wandert beim nächsten Speichern mit.
 * Liefert true, wenn sie auf der Platte gelandet ist.
 */
export function speichereRadio(radio: RadioState): boolean {
  const d = readSave();
  if (!d) return false;
  d.radio = radio;
  return storeSave(d);
}

/**
 * Die Greiferwahl im vorhandenen Stand nachtragen, ohne sonst etwas
 * anzufassen — genau wie `speichereRadio` (E-059).
 *
 * Existiert noch kein Spielstand, wird auch keiner angelegt: Die Wahl steht
 * dann im Arbeitsspeicher und wandert beim naechsten Speichern mit. Liefert
 * true, wenn sie auf der Platte gelandet ist.
 */
export function speichereGreifer(greifer: string): boolean {
  const d = readSave();
  if (!d) return false;
  d.greifer = greifer;
  return storeSave(d);
}

export function storeSave(data: SaveData): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function readSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * WAS DER SPIELER IN DEN CHALLENGES GESCHAFFT HAT (E-125) — je Challenge die
 * beste Sternzahl; 0 heisst „begonnen, nicht geschafft".
 *
 * Daraus folgt der ERSTE START: Steht hier noch nichts, hat der Spieler nie
 * eine Challenge begonnen, und das Spiel faengt mit der ersten an.
 *
 * Bewusst NICHT im Spielstand (`SAVE_KEY`): Den gibt es erst, wenn jemand im
 * Sandkasten speichert, und ein Stand ohne Welt liesse den Sandkasten leer
 * booten (Laden = Seite bootet aus dem Save). „Neues Spiel" raeumt den Platz,
 * nicht die Sterne. Derselbe Weg wie die Stickbelegung
 * (`schrottplatz.controls.v3`): ein eigener Schluessel, hier in save.ts, mit
 * denselben Schutzhuellen gegen gesperrten Speicher.
 */
export const CHALLENGE_KEY = "schrottplatz_challenges";
export type ChallengeStand = Record<string, { sterne: number }>;

export function leseChallenges(): ChallengeStand {
  try {
    const d = JSON.parse(localStorage.getItem(CHALLENGE_KEY) ?? "{}") as unknown;
    return typeof d === "object" && d !== null ? (d as ChallengeStand) : {};
  } catch {
    return {};
  }
}

/** Ergebnis merken — die bessere Sternzahl bleibt. */
export function merkeChallenge(id: string, sterne: number): void {
  const d = leseChallenges();
  d[id] = { sterne: Math.max(sterne, d[id]?.sterne ?? 0) };
  try {
    localStorage.setItem(CHALLENGE_KEY, JSON.stringify(d));
  } catch {
    /* privates Fenster: gilt fuer diese Sitzung nicht — dann eben wieder Challenge 1 */
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* egal */
  }
}
