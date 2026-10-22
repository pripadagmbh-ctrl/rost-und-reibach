/*
 * Ein sehr kleines Stueck CSS-Kaskade — genug, um die HUD-Kaesten aus
 * `index.html` auszurechnen, ohne einen Browser zu haben.
 *
 * Warum ueberhaupt gerechnet wird: Die Anordnung des HUD steckt allein im CSS.
 * Ein echter Test dafuer braeuchte Safari auf einem iPhone; was hier geht, ist
 * nachzurechnen, was Safari daraus machen WIRD — mit Rahmen und Fassung, in
 * allen drei Fassungen, und mit den sicheren Raendern des jeweiligen Geraets.
 *
 * Warum als eigene Datei: Dieselbe Rechnung stand bis zum 15.09.2026 in
 * `test/greifanzeige.test.ts` UND in `docs/messungen/.../bild.mjs`. Zwei
 * Kopien einer Rechnung driften auseinander, und dann glaubt man der falschen.
 * Der Waechter ist ab jetzt die eine Fassung; das Zeichenskript bleibt
 * absichtlich getrennt (es ist .mjs und laeuft ohne Testlauf).
 *
 * Diese Datei traegt kein `.test.` im Namen und wird darum nicht als Testlauf
 * eingesammelt (`vite.config.ts`: include "test/**\/*.test.ts").
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const wurzel = resolve(__dirname, "..");
export const seite = readFileSync(resolve(wurzel, "index.html"), "utf8");
/** CSS ohne Kommentare — in den Kommentaren stehen Beispielwerte. */
export const css = seite
  .slice(seite.indexOf("<style>"), seite.indexOf("</style>"))
  .replace(/\/\*[\s\S]*?\*\//g, "");

interface Regel {
  media: string | null;
  selektoren: string[];
  decls: string;
  reihenfolge: number;
}

function parse(quelle: string): Regel[] {
  const out: Regel[] = [];
  let media: string | null = null;
  let n = 0;
  const re = /([^{}]+)\{|\}/g;
  for (let m = re.exec(quelle); m; m = re.exec(quelle)) {
    if (m[0] === "}") {
      media = null; // Ende einer Medienabfrage
      continue;
    }
    const kopf = m[1].trim();
    if (kopf.startsWith("@media")) {
      media = kopf.slice("@media".length).trim();
      continue;
    }
    const zu = quelle.indexOf("}", re.lastIndex);
    out.push({
      media,
      selektoren: kopf.split(",").map((s) => s.trim()),
      decls: quelle.slice(re.lastIndex, zu),
      reihenfolge: n++,
    });
    re.lastIndex = zu + 1;
  }
  return out;
}

const regeln = parse(css);

/** Sichere Raender eines Geraets in CSS-Pixeln: links, rechts, oben, unten. */
export interface Rand {
  l: number;
  r: number;
  t: number;
  b: number;
}

export interface Fassung {
  name: string;
  w: number;
  h: number;
  sa: Rand;
}

/*
 * Die drei Fassungen. DREI, nicht zwei — das war der Denkfehler bis zum
 * 15.09.2026: Die Abfrage "max-height: 430px" fasst nur das Querformat der
 * Telefone. Ein iPhone mini im HOCHFORMAT ist 812 px hoch und lief mit den
 * Tablet-Regeln, obwohl es nur 375 px breit ist.
 *
 * Die sicheren Raender sind keine Schaetzung, sondern die Werte, die Safari
 * bei `viewport-fit=cover` meldet:
 *  - iPad: ueberall 0. Deshalb muss die Fassung dort Pixel fuer Pixel dieselbe
 *    bleiben wie ohne sichere Raender — das prueft `sichererand.test.ts`.
 *  - iPhone 13 mini quer: WebKit meldet den seitlichen Rand auf BEIDEN Seiten
 *    gleich, damit sich beim Drehen des Geraets nichts verschiebt. 50 px ist
 *    der unguenstigste Fall; unten 21 px fuer den Home-Indicator.
 *  - iPhone 13 mini hoch: 50 px Statusleiste samt Notch, 34 px Home-Indicator.
 */
export const FASSUNGEN: Fassung[] = [
  { name: "iPad quer", w: 1024, h: 768, sa: { l: 0, r: 0, t: 0, b: 0 } },
  { name: "iPhone mini quer", w: 812, h: 375, sa: { l: 50, r: 50, t: 0, b: 21 } },
  { name: "iPhone mini hoch", w: 375, h: 812, sa: { l: 0, r: 0, t: 50, b: 34 } },
];

function mediaPasst(media: string | null, f: Fassung): boolean {
  if (!media) return true;
  return media.split(" and ").every((teil) => {
    const m = /\((max|min)-(width|height):\s*(\d+)px\)/.exec(teil);
    if (!m) throw new Error(`unbekannte Medienabfrage: ${teil}`);
    const ist = m[2] === "width" ? f.w : f.h;
    return m[1] === "max" ? ist <= Number(m[3]) : ist >= Number(m[3]);
  });
}

/** Grobes Selektorgewicht: Bezeichner vor Klassen vor allem anderen. */
function gewicht(sel: string): number {
  return (sel.match(/#/g) ?? []).length * 100 + (sel.match(/\.[a-zA-Z]/g) ?? []).length * 10;
}

/**
 * Wert einer Eigenschaft, so wie ihn der Browser fuer ein Element mit diesen
 * Selektoren in dieser Fassung nehmen wuerde: das schwerste, bei gleichem
 * Gewicht das spaeteste.
 */
export function wert(selektoren: string[], prop: string, f: Fassung): string | null {
  const treffer = regeln
    .filter((r) => mediaPasst(r.media, f) && r.selektoren.some((s) => selektoren.includes(s)))
    .map((r) => ({
      r,
      g: Math.max(...r.selektoren.filter((s) => selektoren.includes(s)).map(gewicht)),
    }))
    .sort((a, b) => a.g - b.g || a.r.reihenfolge - b.r.reihenfolge);
  let gefunden: string | null = null;
  for (const t of treffer) {
    const m = new RegExp(`(?:^|[;{\\s])${prop}:\\s*([^;]+)`).exec(t.r.decls);
    if (m) gefunden = m[1].trim();
  }
  return gefunden;
}

/** Kommas auf oberster Klammerebene. */
function spalte(s: string): string[] {
  const out: string[] = [];
  let tiefe = 0;
  let akt = "";
  for (const c of s) {
    if (c === "(") tiefe++;
    if (c === ")") tiefe--;
    if (c === "," && tiefe === 0) {
      out.push(akt);
      akt = "";
    } else akt += c;
  }
  out.push(akt);
  return out;
}

/**
 * Loest einen Laengenwert in Pixel auf — samt `max()`, `calc()` und
 * `var(--sa-*)`.
 *
 * `null` heisst „nicht gesetzt" (`auto`). Alles, was hier NICHT verstanden
 * wird, wirft — das ist Absicht: Ein Waechter, der unbekannte Werte
 * stillschweigend als NaN durchreicht, ist wertlos. Am 15.09.2026 war ein
 * Waechter zwei Stunden gruen, weil seine Eingaben NaN waren; jeder Vergleich
 * mit NaN ist falsch, also faellt kein Test.
 */
/*
 * Prozent (seit 22.10.2026, Pedale in der Bildmitte): nur mit `basis`, und
 * die Basis ist das BILD (Breite fuer waagrechte, Hoehe fuer senkrechte
 * Eigenschaften). Das stimmt fuer `position: fixed` und fuer Elemente in
 * `#touch` (inset 0) — fuer alles andere waere es falsch, darum ohne Basis
 * weiter ein Wurf.
 */
export function loese(v: string | null, sa: Rand, basis?: number): number | null {
  if (v === null) return null;
  const s = v.trim();
  if (s === "auto") return null;
  if (s.startsWith("max(")) {
    const teile = spalte(s.slice(4, s.lastIndexOf(")"))).map((t) => loese(t, sa, basis));
    if (teile.some((t) => t === null)) throw new Error(`max() mit auto: ${v}`);
    return Math.max(...(teile as number[]));
  }
  if (s.startsWith("calc(")) {
    const teile = s
      .slice(5, s.lastIndexOf(")"))
      .split("+")
      .map((t) => loese(t, sa, basis));
    if (teile.some((t) => t === null)) throw new Error(`calc() mit auto: ${v}`);
    return (teile as number[]).reduce((a, b) => a + b, 0);
  }
  const mv = /^var\(--sa-([lrtb])\)$/.exec(s);
  if (mv) return sa[mv[1] as keyof Rand];
  const mp = /^(-?\d+(?:\.\d+)?)px$/.exec(s);
  if (mp) return Number(mp[1]);
  const mpc = /^(-?\d+(?:\.\d+)?)%$/.exec(s);
  if (mpc && basis !== undefined) return (Number(mpc[1]) / 100) * basis;
  if (s === "0") return 0;
  throw new Error(`Laengenwert nicht verstanden: ${v}`);
}

/** Bezugsgroesse fuer Prozent: senkrechte Eigenschaften die Bildhoehe, sonst die Breite. */
const basis = (prop: string, f: Fassung): number => (/^(top|bottom|height|min-height|max-height)$/.test(prop) ? f.h : f.w);

/** Pixelwert einer Eigenschaft; wirft, wenn sie fehlt. */
export function px(selektoren: string[], prop: string, f: Fassung): number {
  const v = wert(selektoren, prop, f);
  if (v === null) throw new Error(`${prop} fehlt fuer ${selektoren[0]} bei ${f.name}`);
  const z = loese(v, f.sa, basis(prop, f));
  if (z === null) throw new Error(`${prop} ist "auto" fuer ${selektoren[0]} bei ${f.name}`);
  return z;
}

/** Pixelwert oder null, wenn die Eigenschaft fehlt oder `auto` ist. */
export function pxOderNull(selektoren: string[], prop: string, f: Fassung): number | null {
  const v = wert(selektoren, prop, f);
  return v === null ? null : loese(v, f.sa, basis(prop, f));
}

/** Innenrand als [oben/unten, links/rechts]. */
export function fassungInnen(selektoren: string[], f: Fassung): [number, number] {
  const v = wert(selektoren, "padding", f);
  if (v === null) throw new Error(`padding fehlt fuer ${selektoren[0]}`);
  // "0" steht ohne Einheit da — darum ist "px" hier freigestellt.
  const zahlen = [...v.matchAll(/(\d+)(?:px)?/g)].map((m) => Number(m[1]));
  return zahlen.length > 1 ? [zahlen[0], zahlen[1]] : [zahlen[0], zahlen[0]];
}

/**
 * Schriftgroesse — aus `font-size` oder aus der `font`-Kurzform.
 *
 * `.hud` setzt sie als Kurzform (`font: 13px/1.5 "Consolas"`). Wer nur nach
 * `font-size` sucht, findet fuer `#debug` nichts und rechnet mit NaN weiter.
 */
export function schriftgroesse(selektoren: string[], f: Fassung): number {
  const direkt = pxOderNull(selektoren, "font-size", f);
  if (direkt !== null) return direkt;
  const kurz = wert(selektoren, "font", f);
  const m = kurz ? /(\d+(?:\.\d+)?)px/.exec(kurz) : null;
  if (!m) throw new Error(`Schriftgroesse fehlt fuer ${selektoren[0]}`);
  return Number(m[1]);
}

/** Zeilenabstand als Vielfaches — aus `line-height` oder aus der `font`-Kurzform. */
export function zeilenabstand(selektoren: string[], f: Fassung): number {
  const lh = wert(selektoren, "line-height", f);
  if (lh !== null) return Number(lh.replace(/[^\d.]/g, ""));
  const kurz = wert(selektoren, "font", f);
  const m = kurz ? /\/([\d.]+)/.exec(kurz) : null;
  if (!m) throw new Error(`Zeilenabstand fehlt fuer ${selektoren[0]}`);
  return Number(m[1]);
}

/*
 * Consolas ist eine Festbreitenschrift: Jede Figur ist 1126 von 2048
 * Einheiten breit, also 0,5498 em. Bei 14 px sind das 7,70 px je Zeichen.
 * Damit laesst sich der Umbruch ohne Browser ausrechnen.
 */
export const EM_BREITE = 0.55;

/** Zeilen, die ein Text bei dieser Breite braucht — gierig an Leerzeichen umgebrochen. */
export function zeilen(text: string, breitePx: number, schriftPx: number): number {
  const proZeile = Math.floor(breitePx / (schriftPx * EM_BREITE));
  if (proZeile <= 0) throw new Error("Streifen zu schmal fuer auch nur ein Zeichen");
  let n = 1;
  let voll = 0;
  for (const wort of text.split(" ")) {
    const laenge = wort.length;
    if (voll === 0) {
      voll = laenge;
    } else if (voll + 1 + laenge <= proZeile) {
      voll += 1 + laenge;
    } else {
      n++;
      voll = laenge;
    }
    // Ein einzelnes Wort, das laenger ist als die Zeile, bricht hart um.
    while (voll > proZeile) {
      n++;
      voll -= proZeile;
    }
  }
  return n;
}

export interface Kasten {
  name: string;
  x0: number;
  x1: number;
  /** Abstand zur Unterkante des Bildes; y1 ist die Oberkante. */
  y0: number;
  y1: number;
}

export function ueberlappt(a: Kasten, b: Kasten): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/** Luft zwischen zwei Kaesten; negativ heisst Ueberlappung. */
export function luft(a: Kasten, b: Kasten): number {
  return Math.max(b.x0 - a.x1, a.x0 - b.x1, b.y0 - a.y1, a.y0 - b.y1);
}

/** Die Fahrpedale samt Fassung. */
export function pedalKasten(f: Fassung): Kasten {
  const halter = ["#pedals"];
  const pedal = ["#touch .pedal"];
  const [pad] = fassungInnen(halter, f);
  const breite = 2 * pad + 2 * px(pedal, "width", f) + px(halter, "gap", f);
  // .pedal steht auf border-box — width/height sind schon das Sichtbare.
  const hoehe = 2 * pad + px(pedal, "height", f);
  // Seit 22.10.2026 mittig: left 50 % + translateX(-50 %) zieht die halbe Breite ab.
  const mittig = /translateX\(-50%\)/.test(wert(halter, "transform", f) ?? "");
  const links = px(halter, "left", f) - (mittig ? breite / 2 : 0);
  const unten = px(halter, "bottom", f);
  return { name: "Pedale", x0: links, x1: links + breite, y0: unten, y1: unten + hoehe };
}

/**
 * Ein Knopf aus `#touch .btn`. Content-box: Der 2-px-Rahmen kommt auf
 * width/height obendrauf. Eine fruehere Fassung lag um genau diese 4 px
 * daneben (Messung 14.09.2026).
 */
export function knopfKasten(id: string, f: Fassung): Kasten {
  const sel = ["#touch .btn", `#touch #${id}`, `#${id}`];
  const rahmen = 2;
  const breite = px(sel, "width", f) + 2 * rahmen;
  const hoehe = px(sel, "height", f) + 2 * rahmen;
  const rechts = px(sel, "right", f);
  const oben = pxOderNull(sel, "top", f);
  const unten = oben === null ? px(sel, "bottom", f) : f.h - oben - hoehe;
  return { name: id, x0: f.w - rechts - breite, x1: f.w - rechts, y0: unten, y1: unten + hoehe };
}

/** Hoehe eines `.hud`-Kastens aus Texten, mit Rahmen und Fassung. */
export function hudHoehe(
  selektoren: string[],
  f: Fassung,
  breite: number,
  texte: Array<{ text: string; eineZeile?: boolean }>
): { hoehe: number; zeilen: number } {
  const rahmen = 1; // .hud: 1px Rand
  const schrift = schriftgroesse(selektoren, f);
  const [padY, padX] = fassungInnen(selektoren, f);
  const abstand = zeilenabstand(selektoren, f);
  const innen = breite - 2 * padX - 2 * rahmen;
  const n = texte.reduce(
    (a, t) => a + (t.eineZeile ? 1 : zeilen(t.text, innen, schrift)),
    0
  );
  return { hoehe: n * Math.ceil(schrift * abstand) + 2 * padY + 2 * rahmen, zeilen: n };
}
