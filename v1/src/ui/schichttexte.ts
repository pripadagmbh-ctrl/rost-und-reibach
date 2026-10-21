/**
 * DIE WOERTER DER SCHICHT (E-205, 21.10.2026) — Menue, Anzeige, Tafel, Bestenliste.
 *
 * Eigene Tabelle neben `aufgabentexte.ts`, gleiches Muster: eine Zeile, beide
 * Sprachen. Eigene Datei, damit Schicht und Lehrgang sich beim Zusammenfuehren
 * nicht in derselben Tabelle treffen. Die Sprache kommt aus `sprache()`
 * (`challenges/texte.ts`) — dieselbe eine Wahl wie im Pausenmenue (E-195).
 *
 * Ton (Regel 6): neutrale Systemtexte, 2–8 Woerter, keine Figurensprueche.
 * Laengen: Die Anzeige hat auf dem iPhone mini quer 26 Zeichen je Zeile
 * (`test/schichtanzeige.test.ts` rechnet nach).
 */
import { waehle, type Sprache, type Zweisprachig } from "../challenges/texte";
import type { Schichtstufe } from "../economy/kasse";

export const SCHICHT_WORTE = {
  // --- Menue
  schicht: { de: "SCHICHT", en: "SHIFT" },
  // einzeilig im 2er-Raster des iPhone mini quer (≤ 38 Zeichen, test/hauptmenue-platz.test.ts)
  schichtText: { de: "Fuhren sortieren, verladen – 10 Min.", en: "Sort loads, load trucks – 10 min." },
  schichten: { de: "SCHICHTEN", en: "SHIFTS" },
  bestVerdienst: { de: "Bestverdienst {e}", en: "Best earnings {e}" },
  nochNichtGespielt: { de: "Noch nicht gespielt.", en: "Not played yet." },
  gesperrt: { de: "erst {tag} zu Ende spielen", en: "finish {tag} first" },
  // --- Anzeige
  noch: { de: "noch {r}", en: "{r} left" },
  torZu: { de: "Tor zu", en: "gate shut" },
  kasse: { de: "Kasse", en: "Cash" },
  warteEine: { de: "1 Fuhre wartet", en: "1 load waiting" },
  warteViele: { de: "{n} Fuhren warten", en: "{n} loads waiting" },
  warteKurz: { de: "{n} warten", en: "{n} waiting" },
  annahmeVoll: { de: "Annahme voll", en: "Intake full" },
  verlader: { de: "VERLADER", en: "OUTBOUND" },
  verladerKommt: { de: "kommt …", en: "coming …" },
  abholerKommt: { de: "Abholer kommt", en: "pickup coming" },
  standgeld: { de: "Standgeld", en: "waiting fee" },
  fehlwurf: { de: "Fehlwurf", en: "wrong bin" },
  schaden: { de: "Schaden", en: "damage" },
  // --- Tafel
  feierabend: { de: "FEIERABEND", en: "END OF SHIFT" },
  tonnen: { de: "Umgeschlagen", en: "Handled" },
  quote: { de: "Sortierquote", en: "Sorting accuracy" },
  wartezeit: { de: "Wartezeit", en: "Waiting time" },
  erloes: { de: "Erlös", en: "Sales" },
  lager: { de: "Boxen-Rest {p} %", en: "Left in bins {p} %" },
  standgelder: { de: "Standgeld", en: "Waiting fees" },
  fehlwuerfe: { de: "Fehlwürfe", en: "Wrong bins" },
  schaeden: { de: "Schäden", en: "Damage" },
  verdienst: { de: "Tagesverdienst", en: "Day's earnings" },
  weiterZu: { de: "WEITER: {tag}", en: "NEXT: {tag}" },
  // Urteil der Quote — Zeichen UND Wort (Kap. 20), Schwellen aus economy/shift (REIN_GUT, REIN_MITTEL)
  sauber: { de: "sauber", en: "clean" },
  durchwachsen: { de: "durchwachsen", en: "mixed" },
  zusammengekippt: { de: "zusammengekippt", en: "dumped" },
  // --- Bestenliste
  spalteVerdienst: { de: "Verdienst", en: "Earnings" },
  spalteTonnen: { de: "Tonnen", en: "Tonnes" },
  spalteQuote: { de: "Quote", en: "Accuracy" },
  spalteWarte: { de: "Wartezeit", en: "Waiting" },
} satisfies Record<string, Zweisprachig>;
export type SchichtWort = keyof typeof SCHICHT_WORTE;

export function schichtWort(k: SchichtWort, s: Sprache): string {
  return waehle(SCHICHT_WORTE[k], s);
}

/** Die Stufen beim Namen, mit einer Zeile Beschreibung (Konzept Abschnitt 2, Fahrzeuge aus economy/schichtplan STUFEN). */
export const STUFEN_TEXT: Record<Schichtstufe, { name: Zweisprachig; beschr: Zweisprachig }> = {
  montag: { name: { de: "Montag", en: "Monday" }, beschr: { de: "ruhig – nur Kipper", en: "quiet – tippers only" } },
  mittwoch: { name: { de: "Mittwoch", en: "Wednesday" }, beschr: { de: "mehr los – auch Pritschen", en: "busier – flatbeds too" } },
  freitag: { name: { de: "Freitag", en: "Friday" }, beschr: { de: "voll – dazu Absetzkipper", en: "packed – skip loaders too" } },
};
export const stufenName = (st: Schichtstufe, s: Sprache): string => waehle(STUFEN_TEXT[st].name, s);

/** Sorten der Schicht: kurz (Balken) und lang (Buchung). `null` = Misch-Verlader. Muldenschild EN „NON-FERROUS + SS". */
const SORTE: Record<string, { kurz: Zweisprachig; lang: Zweisprachig }> = {
  mixed: { kurz: { de: "Misch", en: "Mixed" }, lang: { de: "Mischschrott", en: "Mixed scrap" } },
  steel: { kurz: { de: "STAHL", en: "STEEL" }, lang: { de: "Stahlschrott", en: "Steel scrap" } },
  copper: { kurz: { de: "BUNT+VA", en: "NF+SS" }, lang: { de: "Bunt + VA", en: "Non-ferrous" } },
  rubble: { kurz: { de: "MÜLL", en: "WASTE" }, lang: { de: "Müll", en: "Waste" } },
};
export function sorte(order: string | null | undefined, s: Sprache, lang = false): string {
  const e = SORTE[order ?? "mixed"] ?? SORTE["mixed"]!;
  return waehle(lang ? e.lang : e.kurz, s);
}

/** Ganze Euro mit Tausenderpunkt (de) bzw. -komma (en); `vorzeichen` setzt + und − (U+2212). */
export function euro(eur: number, s: Sprache, vorzeichen = false): string {
  const r = Math.round(eur);
  const betrag = Math.abs(r).toLocaleString(s === "de" ? "de-DE" : "en-GB");
  const zeichen = r < 0 ? "−" : vorzeichen && r > 0 ? "+" : "";
  return `${zeichen}${betrag} €`;
}

/** Tonnen mit einer Stelle: „4,2" / „4.2". */
export function tonnenZahl(t: number, s: Sprache): string {
  const x = (Math.round(t * 10) / 10).toFixed(1);
  return s === "de" ? x.replace(".", ",") : x;
}
