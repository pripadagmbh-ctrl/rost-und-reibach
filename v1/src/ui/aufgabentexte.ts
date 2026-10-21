/**
 * DIE WOERTER DER AUFGABEN-ANZEIGE (E-162, 19.10.2026) — Karte, Tafel, Menue.
 *
 * Eine Tabelle, zwei Sprachen je Zeile. Kein Uebersetzungssystem: Das baut
 * die Bedienung fuers ganze Spiel (`ui/sprache.ts`). Die Aufgaben-Anzeige
 * schreibt ihre Texte selbst in der Sprache, die `sprache()` aus
 * `challenges/texte.ts` meldet (dort haengt der Bauleiter spaeter die
 * Sprachwahl des Pausenmenues ein) — eine Sprachwahl, nicht zwei.
 *
 * Hier stehen auch die reinen Formatierer, die Karte und Tafel teilen: die
 * Sternziele („★★ 3:00 · ★★★ 1:30") und die Zeilen der Tafel. Ohne
 * DOM, damit sie pruefbar sind (`test/aufgabenanzeige.test.ts`).
 *
 * Ton (Regel 6): neutrale Systemtexte, kurz, keine Figurensprueche.
 */
import { waehle, type Sprache, type Zweisprachig } from "../challenges/texte";
import type { ChallengeMessung, ChallengeWertung } from "../challenges/challenge";

/** Alle festen Woerter der Aufgaben-Anzeige. Erweiterbar: eine Zeile, beide Sprachen. */
export const WORTE = {
  // --- Karte
  pause: { de: "Pause", en: "Pause" },
  weiter: { de: "weiter", en: "resume" },
  neustart: { de: "Aufgabe neu starten", en: "Restart task" },
  pressen: { de: "PRESSEN", en: "PRESS" },
  ziel: { de: "Ziel", en: "Goal" },
  platt: { de: "platt", en: "flattened" },
  karteEinklappen: { de: "Karte einklappen", en: "Collapse card" },
  karteAufklappen: { de: "Karte aufklappen", en: "Expand card" },
  // --- Stick-Woerter fuer `bedientext`
  linkerStick: { de: "linker Stick", en: "left stick" },
  rechterStick: { de: "rechter Stick", en: "right stick" },
  seitlich: { de: "seitlich", en: "sideways" },
  hochRunter: { de: "hoch/runter", en: "up/down" },
  nachRechts: { de: "nach rechts", en: "right" },
  nachLinks: { de: "nach links", en: "left" },
  nachOben: { de: "nach oben", en: "up" },
  nachUnten: { de: "nach unten", en: "down" },
  unbelegt: { de: "(im Menü unter Steuerung belegen)", en: "(assign it in the menu under Controls)" },
  // --- Tafel
  geschafft: { de: "GESCHAFFT", en: "COMPLETE" },
  nochmal: { de: "NOCHMAL", en: "AGAIN" },
  naechste: { de: "NÄCHSTE AUFGABE", en: "NEXT TASK" },
  zumMenue: { de: "ZUM MENÜ", en: "MAIN MENU" },
  nichtGemessen: { de: "nicht gemessen", en: "not measured" },
  dreiBis: { de: "★★★ bis", en: "★★★ max." },
  // --- Menue
  aufgabe: { de: "AUFGABE", en: "TASK" },
  nochNicht: { de: "Noch nicht geschafft.", en: "Not done yet." },
  gesperrt: { de: "erst Aufgabe {n} schaffen", en: "finish task {n} first" },
  sandkasten: { de: "SANDKASTEN", en: "SANDBOX" },
  sandkastenText: {
    de: "Der Platz voller Schrott und Wracks. Ohne Ziel, ohne Uhr — zum Üben und Kaputtmachen.",
    en: "The yard full of scrap and wrecks. No goal, no clock — for practice and smashing things.",
  },
  geschafftOhneSchwelle: { de: "geschafft", en: "completed" },
  // --- Bestenliste (E-195)
  bestenliste: { de: "BESTENLISTE", en: "LEADERBOARD" },
  zurueck: { de: "Zurück", en: "Back" },
  rang: { de: "Bestenliste", en: "Leaderboard" },
  neuerRekord: { de: "Neuer Rekord!", en: "New record!" },
  platzVon: { de: "Platz {n} von 5", en: "Rank {n} of 5" },
  nichtPlatziert: { de: "nicht unter den besten 5", en: "not in the top 5" },
  keinLauf: { de: "noch kein Lauf", en: "no run yet" },
  bestzeit: { de: "Bestzeit", en: "Best time" },
  spaltePlatz: { de: "Platz", en: "Rank" },
  spalteSterne: { de: "Sterne", en: "Stars" },
  spalteDatum: { de: "Datum", en: "Date" },
  sandkastenRekorde: { de: "SANDKASTEN-REKORDE", en: "SANDBOX RECORDS" },
  rekordSortiert: { de: "Sortiert in einer Sitzung", en: "Sorted in one session" },
  rekordQuote: { de: "Sortierquote ab {t} t", en: "Sorting accuracy from {t} t" },
  rekordWrack: { de: "Schnellstes Wrack ausgeweidet", en: "Fastest wreck stripped" },
} satisfies Record<string, Zweisprachig>;

export type Wort = keyof typeof WORTE;

/** Ein festes Wort in der Sprache `s`. */
export function wort(k: Wort, s: Sprache): string {
  return waehle(WORTE[k], s);
}

/** Minuten:Sekunden wie auf einer Stoppuhr, ganze Sekunden abgeschnitten (die Uhr springt nie zurueck). */
export function uhr(s: number): string {
  const r = Math.max(0, Math.floor(s));
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`;
}

/** Stoppuhr mit Hundertsteln: „1:23,45" (Englisch „1:23.45") — fuer die Bestenliste (E-195). */
export function uhrGenau(hs: number, s: Sprache): string {
  const r = Math.max(0, Math.round(hs));
  return `${uhr(r / 100)}${s === "de" ? "," : "."}${String(r % 100).padStart(2, "0")}`;
}

/** Die Messgroessen in fester Reihenfolge: so stehen sie auf Karte und Tafel. */
export const MESSGROESSEN = [
  "zeitS",
  "fehlwuerfe",
  "praezisionCm",
  "harteAufschlaege",
  "ueberlasten",
  "fremdteile",
] as const satisfies ReadonlyArray<keyof ChallengeMessung>;
export type Messgroesse = (typeof MESSGROESSEN)[number];

/**
 * Je Messgroesse ein Name und eine Schreibweise (E-125, neue Groessen mit
 * E-162) — Tafel und Bestenliste (E-195). `wort` steht nur hinter dem eigenen
 * Wert, nicht hinter der Schwelle — sonst wird die Zeile zu breit fuers iPhone mini.
 */
export const KRITERIEN: Record<
  Messgroesse,
  { name: Zweisprachig; zahl: (v: number) => string; wort?: Zweisprachig }
> = {
  zeitS: { name: { de: "Zeit", en: "Time" }, zahl: (v) => `${uhr(v)} min` },
  fehlwuerfe: { name: { de: "Fehlwürfe", en: "Misses" }, zahl: (v) => String(Math.round(v)) },
  praezisionCm: {
    name: { de: "Präzision", en: "Precision" },
    zahl: (v) => `${Math.round(v)} cm`,
    wort: { de: " daneben", en: " off" },
  },
  harteAufschlaege: { name: { de: "Harte Aufschläge", en: "Hard drops" }, zahl: (v) => String(Math.round(v)) },
  ueberlasten: { name: { de: "Überlast", en: "Overloads" }, zahl: (v) => String(Math.round(v)) },
  fremdteile: { name: { de: "Fremdteile", en: "Wrong parts" }, zahl: (v) => String(Math.round(v)) },
};

/** Zaehlwort mit Einzahl/Mehrzahl in beiden Sprachen. */
const ZAEHL: Record<Exclude<Messgroesse, "zeitS" | "praezisionCm">, { null: Zweisprachig; eins: Zweisprachig; viele: Zweisprachig }> = {
  fehlwuerfe: {
    null: { de: "0 Fehlwürfe", en: "no misses" },
    eins: { de: "max. 1 Fehlwurf", en: "max. 1 miss" },
    viele: { de: "max. {n} Fehlwürfe", en: "max. {n} misses" },
  },
  harteAufschlaege: {
    null: { de: "kein harter Aufschlag", en: "no hard drops" },
    eins: { de: "max. 1 harter Aufschlag", en: "max. 1 hard drop" },
    viele: { de: "max. {n} harte Aufschläge", en: "max. {n} hard drops" },
  },
  ueberlasten: {
    null: { de: "keine Überlast", en: "no overload" },
    eins: { de: "max. 1 Überlast", en: "max. 1 overload" },
    viele: { de: "max. {n} Überlasten", en: "max. {n} overloads" },
  },
  fremdteile: {
    null: { de: "keine Fremdteile", en: "no wrong parts" },
    eins: { de: "max. 1 Fremdteil", en: "max. 1 wrong part" },
    viele: { de: "max. {n} Fremdteile", en: "max. {n} wrong parts" },
  },
};

/** Abstand in cm als „40 cm" bzw. „1 m" (volle Meter ab 100 cm). */
function laenge(cm: number): string {
  const r = Math.round(cm);
  return r >= 100 && r % 100 === 0 ? `${r / 100} m` : `${r} cm`;
}

/**
 * Eine Obergrenze als Ziel in Worten: „unter 3:00", „0 Fehlwürfe",
 * „auf 40 cm genau". Kurz, weil die Sternziele in eine Kartenzeile sollen
 * (iPhone mini quer: 57 Zeichen, Rechnung in `index.html` bei `#tutorial.aufgabe`).
 */
export function schwelleText(k: Messgroesse, grenze: number, s: Sprache): string {
  if (k === "zeitS") return `${s === "de" ? "unter" : "under"} ${uhr(grenze)}`;
  if (k === "praezisionCm") return s === "de" ? `auf ${laenge(grenze)} genau` : `within ${laenge(grenze)}`;
  const n = Math.round(grenze);
  const z = ZAEHL[k];
  const t = n <= 0 ? z.null : n === 1 ? z.eins : z.viele;
  return waehle(t, s).replace("{n}", String(n));
}

type Schwellen = ChallengeWertung["zwei"];

/**
 * „★★ 3:00 · max. 1 Fehlwurf" — ein Sternziel, die Grenzen in fester
 * Reihenfolge. Die Zeit steht ohne „unter": Daneben laeuft die Uhr im
 * Kartenkopf, und jedes Wort weniger haelt die Karte auf dem iPhone mini
 * quer in einer Zeile (E-162, G2b).
 */
export function sternZielZeile(sterne: 2 | 3, schwellen: Schwellen, s: Sprache): string {
  const teile = MESSGROESSEN.filter((k) => schwellen[k] !== undefined).map((k) =>
    k === "zeitS" ? uhr(schwellen[k]!) : schwelleText(k, schwellen[k]!, s)
  );
  return `${"★".repeat(sterne)} ${teile.length ? teile.join(" · ") : wort("geschafftOhneSchwelle", s)}`;
}

/** Die Sternziele der Karte in EINER Zeile: „★★ 3:00 · ★★★ 1:30" — von Anfang an sichtbar (E-162, G2b). */
export function sternZiele(w: ChallengeWertung, s: Sprache): string {
  return `${sternZielZeile(2, w.zwei, s)} · ${sternZielZeile(3, w.drei, s)}`;
}

/**
 * Die Sternzeile: Zeichen UND Wort (Briefing Kap. 20 — Farbe und Symbol sind
 * nie der einzige Kanal). Deutsch wie seit E-113; Englisch fuer die Aufgaben.
 */
export function sterneText(sterne: number, s: Sprache = "de"): string {
  const n = Math.max(0, Math.min(3, Math.round(sterne)));
  const zahl = s === "de" ? ["kein", "ein", "zwei", "drei"][n]! : ["no", "one", "two", "three"][n]!;
  const rest = s === "de" ? "von drei Sternen" : "of three stars";
  return `${"★".repeat(n)}${"☆".repeat(3 - n)}  ${zahl} ${rest}`;
}
