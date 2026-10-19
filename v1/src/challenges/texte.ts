/**
 * ZWEISPRACHIGE AUFGABEN-TEXTE (E-162, 19.10.2026).
 *
 * Version 1.0 erscheint auf Deutsch und Englisch. Jeder sichtbare Text einer
 * Aufgabe steht darum als Paar `{ de, en }` direkt neben seinen Daten — eine
 * Tabelle, keine Uebersetzungsdatei: Wer eine Aufgabe aendert, sieht beide
 * Sprachen in derselben Zeile und kann keine vergessen.
 *
 * Bewusst KEIN Uebersetzungssystem fuers ganze Spiel: Das baut die Bedienung
 * (`t(schluessel)`, Sprachwahl im Pausenmenue). Diese Datei haengt sich nur an
 * deren Sprachwert (`setzeSprachquelle`), damit es EINE Sprachwahl gibt.
 */
export type Sprache = "de" | "en";

/** Ein sichtbarer Text in beiden Sprachen. */
export interface Zweisprachig {
  de: string;
  en: string;
}

/** Bis die Sprachwahl der Bedienung da ist: die Sprache des Geraets, sonst Deutsch. */
let quelle: () => Sprache = () =>
  typeof navigator !== "undefined" && /^en\b/i.test(navigator.language ?? "") ? "en" : "de";

/** Die Bedienung haengt hier ihre Sprachwahl ein. */
export function setzeSprachquelle(q: () => Sprache): void {
  quelle = q;
}

export function sprache(): Sprache {
  return quelle();
}

/** Den Text in der gerade gewaehlten Sprache. */
export function waehle(t: Zweisprachig, s: Sprache = sprache()): string {
  return t[s];
}
