/**
 * SPRACHE (E-170): Deutsch und Englisch.
 *
 * Der deutsche Text IST der Schlüssel — wie bei gettext. Darum muss kein
 * Aufruf im Spiel umgeschrieben werden: `t("Gespeichert.")` liefert auf
 * Deutsch den Text selbst, auf Englisch „Saved." aus `texte_en.ts`.
 *
 * Zwei Wege, auf denen übersetzt wird:
 *
 *  1. **Auf der Seite** (`index.html` und alles, was das Spiel später per
 *     `textContent` hineinschreibt — Meldungen, Knöpfe, Listen): Ein
 *     MutationObserver tauscht jeden deutschen Text, den er im Wörterbuch
 *     findet, gegen den englischen, BEVOR der Browser malt (Mikroaufgabe).
 *     So bleibt `main.ts` unberührt, und auch Texte anderer Bereiche werden
 *     erfasst, sobald ihr Satz im Wörterbuch steht.
 *  2. **Auf der Leinwand** (Muldenschilder, Kabinenanzeige) gibt es kein DOM —
 *     dort ruft der Zeichner `t()` selbst.
 *
 * Für andere Bereiche (Aufgaben): `sprache()` sagt "de" oder "en", `t(de)`
 * übersetzt, `onSprache(cb)` meldet den Wechsel im Pausenmenü.
 */
import { EN, MUSTER } from "./texte_en";
import { setzeSprachquelle } from "../challenges/texte";

export type Sprache = "de" | "en";

const SCHLUESSEL = "sprache";

/**
 * Welche Sprache beim Start gilt: die gemerkte, sonst die des Geräts.
 * Deutsch nur bei deutschem Gerät — alle anderen bekommen Englisch.
 */
export function ermittleSprache(gemerkt: string | null, geraet: string | undefined): Sprache {
  if (gemerkt === "de" || gemerkt === "en") return gemerkt;
  return /^de\b/i.test(geraet ?? "") ? "de" : "en";
}

function startSprache(): Sprache {
  // Ohne Seite (Vitest) gilt Deutsch: Die Quelltexte und ihre Tests sind deutsch.
  if (typeof document === "undefined") return "de";
  let gemerkt: string | null = null;
  try {
    gemerkt = localStorage.getItem(SCHLUESSEL);
  } catch {
    /* privater Modus / gesperrter Speicher: dann eben das Gerät fragen */
  }
  return ermittleSprache(gemerkt, navigator.language);
}

let aktuell: Sprache = startSprache();
/*
 * EINE Sprachwahl (E-195): Die Aufgaben-Texte (`challenges/texte.ts` — Menü,
 * Karte, Tafel, Bestenliste) fragten bis hier die Gerätesprache und blieben
 * nach „Sprache: English" deutsch. Jetzt fragen sie diese Stelle.
 */
setzeSprachquelle(() => aktuell);
const hoerer: Array<(s: Sprache) => void> = [];

export function sprache(): Sprache {
  return aktuell;
}

/** Wird bei jedem Wechsel gerufen (nicht beim Start). */
export function onSprache(cb: (s: Sprache) => void): void {
  hoerer.push(cb);
}

// ---------------------------------------------------------------------------
// Übersetzen
// ---------------------------------------------------------------------------

/** Ein Listenstück: „Kupfer + Kabel", „Reifen, Felge". */
const TRENNER = /( \+ |, )/;
const ZAHL = /^-?\d+(,\d+)?$/;

/** Ein Musterteil übersetzen: Zahl mit Punkt statt Komma, Name aus dem Wörterbuch, Liste stückweise. */
function teil(s: string): string {
  if (ZAHL.test(s)) return s.replace(",", ".");
  const ganz = EN[s] ?? muster(s);
  if (ganz !== undefined) return ganz;
  if (!TRENNER.test(s)) return s;
  return s
    .split(TRENNER)
    .map((x) => (x === " + " || x === ", " ? x : EN[x] ?? muster(x) ?? x))
    .join("");
}

function muster(kern: string): string | undefined {
  for (const [re, vorlage] of MUSTER) {
    const m = re.exec(kern);
    if (m) return vorlage.replace(/\$(\d)/g, (_, i: string) => teil(m[Number(i)] ?? ""));
  }
  return undefined;
}

/*
 * Merkzettel: Dieselbe Meldung kommt oft wieder (Griff-Info, Toasts). Ohne ihn
 * liefe je Schreibvorgang die ganze Musterliste durch.
 * ponytail: wird bei 2000 Einträgen geleert statt LRU — reicht für Meldungen.
 */
const gemerkt = new Map<string, string | null>();

/** Deutsch → Englisch, unabhängig von der eingestellten Sprache. Unbekanntes bleibt, wie es ist. */
export function nachEnglisch(text: string): string {
  const kern = text.replace(/\s+/g, " ").trim();
  if (!kern) return text;
  let treffer = gemerkt.get(kern);
  if (treffer === undefined) {
    treffer = EN[kern] ?? muster(kern) ?? null;
    if (gemerkt.size > 2000) gemerkt.clear();
    gemerkt.set(kern, treffer);
  }
  if (treffer === null) return text;
  // Leerraum am Rand erhalten — Textknoten zwischen Tags tragen ihn
  return (text.match(/^\s*/)?.[0] ?? "") + treffer + (text.match(/\s*$/)?.[0] ?? "");
}

let rueckwaerts: Map<string, string> | null = null;
/** Englisch → Deutsch für den Rückweg im laufenden Spiel; nur ganze Einträge, keine Muster. */
function nachDeutsch(text: string): string {
  if (!rueckwaerts) rueckwaerts = new Map(Object.entries(EN).map(([de, en]) => [en, de]));
  const kern = text.replace(/\s+/g, " ").trim();
  const de = rueckwaerts.get(kern);
  return de === undefined ? text : (text.match(/^\s*/)?.[0] ?? "") + de + (text.match(/\s*$/)?.[0] ?? "");
}

/** Der eine Aufruf für alle: deutscher Text rein, Text in der eingestellten Sprache raus. */
export function t(de: string): string {
  return aktuell === "de" ? de : nachEnglisch(de);
}

// ---------------------------------------------------------------------------
// Die Seite
// ---------------------------------------------------------------------------

const ATTRIBUTE = ["title", "aria-label", "placeholder"];

function wandle(text: string): string {
  return aktuell === "en" ? nachEnglisch(text) : nachDeutsch(text);
}

/** Ausgenommen: `translate="no"` (z. B. Eigennamen), Skripte, Stile. */
function ausgenommen(el: Element | null): boolean {
  return !!el && (el.tagName === "SCRIPT" || el.tagName === "STYLE" || el.closest('[translate="no"]') !== null);
}

function uebersetzeKnoten(n: Node): void {
  if (n.nodeType === 3) {
    if (ausgenommen(n.parentElement)) return;
    const alt = n.nodeValue ?? "";
    const neu = wandle(alt);
    if (neu !== alt) n.nodeValue = neu;
    return;
  }
  if (n.nodeType !== 1) return;
  const el = n as Element;
  if (ausgenommen(el)) return;
  for (const a of ATTRIBUTE) {
    const alt = el.getAttribute(a);
    if (!alt) continue;
    const neu = wandle(alt);
    if (neu !== alt) el.setAttribute(a, neu);
  }
  el.childNodes.forEach(uebersetzeKnoten);
}

function uebersetzeSeite(): void {
  document.documentElement.lang = aktuell;
  document.title = wandle(document.title);
  uebersetzeKnoten(document.body);
}

/** Umschalten im Pausenmenü: merken, Seite neu beschriften, Hörer rufen. */
export function setzeSprache(s: Sprache): void {
  if (s === aktuell) return;
  aktuell = s;
  try {
    localStorage.setItem(SCHLUESSEL, s);
  } catch {
    /* nicht gemerkt — gilt dann bis zum Neustart */
  }
  if (typeof document !== "undefined") uebersetzeSeite();
  for (const cb of hoerer) cb(s);
}

/*
 * Beim Laden des Moduls: Die Seite ist schon geparst (das Spiel ist ein
 * Modulskript am Ende von <body>), also gleich beschriften — vor dem
 * Hauptmenü und vor dem ersten Bild. Danach wacht der Beobachter.
 */
if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
  if (aktuell === "en") uebersetzeSeite();
  else document.documentElement.lang = "de";
  new MutationObserver((liste) => {
    if (aktuell === "de") return; // die Quelle ist deutsch — nichts zu tun
    for (const m of liste) {
      if (m.type === "childList") m.addedNodes.forEach(uebersetzeKnoten);
      else if (m.type === "characterData") uebersetzeKnoten(m.target);
      else if (m.attributeName && !ausgenommen(m.target as Element)) {
        const el = m.target as Element;
        const alt = el.getAttribute(m.attributeName) ?? "";
        const neu = nachEnglisch(alt);
        if (neu !== alt) el.setAttribute(m.attributeName, neu);
      }
    }
  }).observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRIBUTE,
  });
}
