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
import { SCHICHTSTUFEN, type SchichtLauf, type Schichtstufe } from "../economy/kasse";

export const BESTENLISTE_KEY = "schrottplatz_bestenliste";
/** Schema 2 (E-205): dazu der Abschnitt SCHICHTEN. Schema 1 wird beim Lesen übernommen (`pruefeAblage`). */
export const BESTENLISTE_SCHEMA = 2;
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
  /** E-205: je Schichtstufe die besten 5 nach Tagesverdienst */
  schichten: Partial<Record<Schichtstufe, SchichtLauf[]>>;
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
/** E-205: Tagesverdienst je Schichtstufe, ganze Euro (Konzept Abschnitt 4). Ausgeschrieben aus demselben Grund wie oben. */
export const SCHICHT_LEADERBOARD_IDS: Record<Schichtstufe, string> = {
  montag: `${GC_PRAEFIX}.schicht.montag.verdienst`,
  mittwoch: `${GC_PRAEFIX}.schicht.mittwoch.verdienst`,
  freitag: `${GC_PRAEFIX}.schicht.freitag.verdienst`,
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
const ganz = (x: unknown): x is number => zahl(x) && Number.isInteger(x);
/** Ein Schichtlauf, so wie `schichtLauf` (economy/kasse.ts) ihn baut — nur beendete (≥ 1 Stern) kommen in die Liste. */
function istSchichtLauf(x: unknown, stufe: Schichtstufe): x is SchichtLauf {
  const l = x as SchichtLauf;
  return (
    typeof l === "object" && l !== null && l.stufe === stufe && ganz(l.verdienstEur) &&
    zahl(l.tonnen) && l.tonnen >= 0 && ganz(l.quoteBp) && l.quoteBp >= 0 && l.quoteBp <= 10000 &&
    ganz(l.warteS) && l.warteS >= 0 && (l.sterne === 1 || l.sterne === 2 || l.sterne === 3) &&
    typeof l.datum === "string" && /^\d{4}-\d{2}-\d{2}$/.test(l.datum)
  );
}
const leer = (): Ablage => ({ v: BESTENLISTE_SCHEMA, aufgaben: {}, sandkasten: {}, schichten: {} });

/**
 * Rohdaten pruefen. Alles Unbrauchbare — kein Objekt, unbekannte Version,
 * falsche Form — ergibt die leere Liste; einzelne kaputte Eintraege fallen heraus.
 *
 * MIGRATION 1 → 2 (E-205): Schema 1 hatte nur Aufgaben und Sandkasten; beides
 * wird uebernommen, SCHICHTEN beginnt leer. Geschrieben wird Schema 2 erst beim
 * naechsten Lauf (`merkeLauf`, `merkeRekord`, `merkeSchicht`).
 */
export function pruefeAblage(raw: unknown): Ablage {
  const d = raw as Partial<Omit<Ablage, "v">> & { v?: unknown } | null;
  if (typeof d !== "object" || d === null || (d.v !== 1 && d.v !== BESTENLISTE_SCHEMA)) return leer();
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
  if (d.v === BESTENLISTE_SCHEMA && typeof d.schichten === "object" && d.schichten !== null) {
    for (const st of SCHICHTSTUFEN) {
      const liste = d.schichten[st];
      if (Array.isArray(liste)) {
        const gut = liste.filter((l) => istSchichtLauf(l, st));
        out.schichten[st] = gut.reduce<SchichtLauf[]>((a, l) => eintragenSchicht(a, l).liste, []);
      }
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

/* ------------------------------------------------------------ SCHICHTEN (E-205) */

/**
 * Einen Schichtlauf einreihen — nach Tagesverdienst, hoechstens 5.
 * Gleichstand: der aeltere bleibt vorn (wie bei den Aufgaben). `platz` ab 1,
 * null = nicht unter den besten 5.
 */
export function eintragenSchicht(liste: readonly SchichtLauf[], lauf: SchichtLauf): { liste: SchichtLauf[]; platz: number | null } {
  let i = liste.findIndex((x) => lauf.verdienstEur > x.verdienstEur);
  if (i < 0) i = liste.length;
  if (i >= PLAETZE) return { liste: liste.slice(0, PLAETZE), platz: null };
  return { liste: [...liste.slice(0, i), lauf, ...liste.slice(i)].slice(0, PLAETZE), platz: i + 1 };
}

/**
 * Schichtlauf speichern und seinen Platz liefern (auch wenn das Schreiben
 * scheitert). Eine abgebrochene Schicht (0 Sterne) kommt nicht hinein — die
 * Liste ist zugleich die Quelle fuers Freischalten (`besteSchichtSterne`).
 */
export function merkeSchicht(lauf: SchichtLauf): number | null {
  if (lauf.sterne < 1) return null;
  const d = leseBestenliste();
  const r = eintragenSchicht(d.schichten[lauf.stufe] ?? [], lauf);
  if (r.platz !== null) {
    d.schichten[lauf.stufe] = r.liste;
    schreibe(d);
  }
  return r.platz;
}

/**
 * Die besten Sterne je Stufe — fuer `stufeFrei` (economy/kasse.ts) und das Menue.
 * ponytail: aus den besten 5 nach Verdienst gelesen; ein 3-Sterne-Lauf, der von
 * fuenf reicheren verdraengt wurde, zaehlt hier nicht mehr. Fuers Freischalten
 * (≥ 1 Stern) egal; braucht das Menue die echten Beststerne, eigenes Feld je Stufe.
 */
export function besteSchichtSterne(d: Ablage): Partial<Record<Schichtstufe, number>> {
  const out: Partial<Record<Schichtstufe, number>> = {};
  for (const st of SCHICHTSTUFEN) {
    const l = d.schichten[st];
    if (l?.length) out[st] = Math.max(...l.map((x) => x.sterne));
  }
  return out;
}
