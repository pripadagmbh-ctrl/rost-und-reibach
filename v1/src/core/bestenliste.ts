/**
 * DIE BESTENLISTE AUF DEM GERAET (E-195, Patrick 21.10.2026: „eigene auf dem
 * Geraet", Game Center erst in 1.1, kein Pay-to-Win).
 *
 * Je Aufgabe die besten 5 Laeufe, dazu die Sandkasten-Rekorde. Ein eigener
 * Schluessel wie `CHALLENGE_KEY` (core/save.ts): Die Sternablage dort bleibt
 * unveraendert die Quelle fuers Freischalten — diese Liste ist nur Anzeige.
 *
 * Rangfolge: erst Sterne, dann Zeit. Gleichstand: der aeltere Lauf bleibt
 * vorn (wer eine Zeit zuerst fuhr, haelt sie).
 *
 * Alle gespeicherten Werte sind GANZE Zahlen in der Einheit, die Game Center
 * erwartet: Zeit in Hundertstelsekunden, Masse in kg, Anteil in
 * Hundertstelprozent (Basispunkte, 9730 = 97,30 %).
 */
import type { ChallengeMessung, ChallengeWertung } from "../challenges/challenge";

export const BESTENLISTE_KEY = "schrottplatz_bestenliste";
export const BESTENLISTE_SCHEMA = 1;
/** Auftrag B1: die besten 5 je Aufgabe */
export const PLAETZE = 5;

/** Messgroessen ausser der Zeit — die steht in `zeitHs`. */
export type Messwert = Exclude<keyof ChallengeMessung, "zeitS">;

export interface Lauf {
  /** 1–3 */
  sterne: number;
  /** Spielzeit in Hundertstelsekunden (ganze Zahl, Game-Center-Einheit) */
  zeitHs: number;
  /** Nur, was die Aufgabe wertet; null = nicht gemessen */
  werte: Partial<Record<Messwert, number | null>>;
  /** ISO-Zeitpunkt */
  datum: string;
}

export const REKORDE = {
  /** Richtig einsortierte Masse in einer Sitzung (kg) */
  sortiertKg: { besser: "hoch" },
  /** Anteil richtig, nach Masse, erst ab `QUOTE_AB_KG` (Basispunkte) */
  quoteBp: { besser: "hoch" },
  /** Erster Eingriff an einem Wrack bis zum letzten Teil ab (Hundertstel s) */
  ausweidenHs: { besser: "tief" },
} as const satisfies Record<string, { besser: "hoch" | "tief" }>;
export type RekordId = keyof typeof REKORDE;
export const REKORD_IDS = Object.keys(REKORDE) as RekordId[];

export interface Rekord {
  wert: number;
  datum: string;
}

export interface Ablage {
  v: typeof BESTENLISTE_SCHEMA;
  aufgaben: Record<string, Lauf[]>;
  sandkasten: Partial<Record<RekordId, Rekord>>;
}

/*
 * GAME-CENTER-KENNUNGEN (Vorbereitung 1.1, nur Datenform). Feste Liste statt
 * aus `CHALLENGES` gerechnet: Eine Kennung darf sich nie aendern, auch wenn
 * eine Aufgabe umbenannt wird — App Store Connect laesst sie nicht loeschen.
 * Form: Bundle-ID (`capacitor.config.json` appId) + Bereich + Groesse.
 * Bindestriche der Aufgaben-IDs werden `_`: Apple nennt fuer Kennungen nur
 * Buchstaben, Ziffern, Punkt und Unterstrich.
 */
export const GC_PRAEFIX = "de.rostundreibach.app"; // Bundle-ID seit E-194 (capacitor.config.json appId)
export const LEADERBOARD_IDS: Record<string, string> = {
  "erster-griff": `${GC_PRAEFIX}.erster_griff.zeit`,
  verladen: `${GC_PRAEFIX}.verladen.zeit`,
  sortieren: `${GC_PRAEFIX}.sortieren.zeit`,
  "platt-machen": `${GC_PRAEFIX}.platt_machen.zeit`,
  magnet: `${GC_PRAEFIX}.magnet.zeit`,
  "schwere-last": `${GC_PRAEFIX}.schwere_last.zeit`,
};
export const REKORD_LEADERBOARD_IDS: Record<RekordId, string> = {
  sortiertKg: `${GC_PRAEFIX}.sandkasten.sortiert_kg`,
  quoteBp: `${GC_PRAEFIX}.sandkasten.quote`,
  ausweidenHs: `${GC_PRAEFIX}.sandkasten.ausweiden.zeit`,
};

/** < 0: a steht vor b. Erst Sterne, dann Zeit. */
export function vergleiche(a: Lauf, b: Lauf): number {
  return b.sterne - a.sterne || a.zeitHs - b.zeitHs;
}

/**
 * Einen Lauf in die Liste stellen — rein, fuer Tafel und Speicher dieselbe.
 * `platz` ab 1, null = nicht unter den besten 5.
 */
export function eintragen(liste: readonly Lauf[], lauf: Lauf): { liste: Lauf[]; platz: number | null } {
  let i = liste.findIndex((x) => vergleiche(lauf, x) < 0);
  if (i < 0) i = liste.length;
  if (i >= PLAETZE) return { liste: liste.slice(0, PLAETZE), platz: null };
  return { liste: [...liste.slice(0, i), lauf, ...liste.slice(i)].slice(0, PLAETZE), platz: i + 1 };
}

/** Der Lauf aus `challenge:geschafft`: nur die Messgroessen, nach denen die Aufgabe wertet. */
export function laufAus(
  e: { sterne: number; messung: ChallengeMessung; wertung: ChallengeWertung },
  jetzt: Date = new Date()
): Lauf {
  const werte: Lauf["werte"] = {};
  for (const k of Object.keys({ ...e.wertung.zwei, ...e.wertung.drei }) as Array<keyof ChallengeMessung>) {
    if (k === "zeitS") continue;
    const v = e.messung[k];
    werte[k] = v === null || v === undefined ? null : Math.round(v);
  }
  return { sterne: e.sterne, zeitHs: Math.round(e.messung.zeitS * 100), werte, datum: jetzt.toISOString() };
}

const zahl = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
function istLauf(x: unknown): x is Lauf {
  const l = x as Lauf;
  return (
    typeof l === "object" && l !== null && zahl(l.sterne) && l.sterne >= 1 && l.sterne <= 3 &&
    zahl(l.zeitHs) && l.zeitHs >= 0 && typeof l.werte === "object" && l.werte !== null &&
    typeof l.datum === "string"
  );
}
const leer = (): Ablage => ({ v: BESTENLISTE_SCHEMA, aufgaben: {}, sandkasten: {} });

/**
 * Rohdaten pruefen. Alles Unbrauchbare — kein Objekt, andere Version, falsche
 * Form — ergibt die leere Liste; einzelne kaputte Eintraege fallen heraus.
 * Kommt einmal Schema 2, steht hier die Migration von 1.
 */
export function pruefeAblage(raw: unknown): Ablage {
  const d = raw as Partial<Ablage> | null;
  if (typeof d !== "object" || d === null || d.v !== BESTENLISTE_SCHEMA) return leer();
  const out = leer();
  if (typeof d.aufgaben === "object" && d.aufgaben !== null) {
    for (const [id, liste] of Object.entries(d.aufgaben)) {
      if (Array.isArray(liste)) out.aufgaben[id] = liste.filter(istLauf).sort(vergleiche).slice(0, PLAETZE);
    }
  }
  if (typeof d.sandkasten === "object" && d.sandkasten !== null) {
    for (const k of REKORD_IDS) {
      const r = d.sandkasten[k];
      if (r && zahl(r.wert) && typeof r.datum === "string") out.sandkasten[k] = { wert: r.wert, datum: r.datum };
    }
  }
  return out;
}

export function leseBestenliste(): Ablage {
  try {
    return pruefeAblage(JSON.parse(localStorage.getItem(BESTENLISTE_KEY) ?? "null"));
  } catch {
    return leer(); // kein JSON, gesperrter Speicher (Safari privat), kein localStorage
  }
}

function schreibe(d: Ablage): void {
  try {
    localStorage.setItem(BESTENLISTE_KEY, JSON.stringify(d));
  } catch {
    /* privates Fenster: gilt dann nur fuer diese Anzeige */
  }
}

/** Lauf speichern und seinen Platz liefern (auch wenn das Schreiben scheitert). */
export function merkeLauf(id: string, lauf: Lauf): number | null {
  const d = leseBestenliste();
  const r = eintragen(d.aufgaben[id] ?? [], lauf);
  if (r.platz !== null) {
    d.aufgaben[id] = r.liste;
    schreibe(d);
  }
  return r.platz;
}

/** Ist `wert` besser als `alt` (oder gibt es noch keinen)? */
export function besser(id: RekordId, wert: number, alt: Rekord | undefined): boolean {
  if (!alt) return true;
  return REKORDE[id].besser === "hoch" ? wert > alt.wert : wert < alt.wert;
}

/** Sandkasten-Rekord merken, wenn er besser ist. true = neuer Rekord. */
export function merkeRekord(id: RekordId, wert: number, jetzt: Date = new Date()): boolean {
  const d = leseBestenliste();
  if (!besser(id, wert, d.sandkasten[id])) return false;
  d.sandkasten[id] = { wert, datum: jetzt.toISOString() };
  schreibe(d);
  return true;
}
