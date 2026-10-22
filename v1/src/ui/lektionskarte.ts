/**
 * DIE LEHRGANGSLEISTE (L4, ersetzt die Lektionskarte von E-196).
 *
 * Patrick 21.10.2026: „grundsätzlich sollte es mit kaum oder keinen text
 * auskommen, weil der text die ganze sicht verdeckt, auch sollte irgendwie
 * gehighlighten sein, wenn eine aktion erfolgreich war … sollte auch geskippt
 * werden können."
 *
 * Darum steht im Lehrgang KEINE Karte mehr (`#tutorial` bleibt zu), sondern
 * oben in der Mitte über dem Kamera-Mittelstreifen eine schmale Leiste
 * (`#lehrgangsleiste`, index.html):
 *
 *   [Auge|Hand] [Bildzeichen] [Wort]                 [⏭]
 *   ▬ ▬ ▬ ▭ · · · · · · · · · · · ·      Schritt n von m als Striche
 *
 * Auge = „Schau zu" (Vorführung), Hand = „Jetzt du". Das Bildzeichen sagt,
 * welche Funktion der Schritt übt (Kamera, Fahren, Schwenken …); höchstens
 * ein Wort daneben, und nur, wenn der Schritt eins liefert. Die Hauptsprache
 * bleiben Geisterdaumen, Finger-Geist, Knopf-Schild und Zielmarke.
 *
 * Erfolg (`lehrgang:haekchen`): Das Auge/die Hand wird ein grünes ✓, der
 * Strich des Schritts füllt sich grün, die Leiste leuchtet kurz (CSS,
 * 0,8 s wie `HAEKCHEN_PAUSE_S`), dazu der Klack. Geisterdaumen und Zielmarke
 * leuchten selbst (`ui/geisterdaumen.ts`, `ui/zielmarke.ts`).
 *
 * Überspringen: ⏭ → Rückfrage ✓ / ✕ an derselben Stelle. ✕ sitzt genau dort,
 * wo ⏭ saß — ein versehentlicher Doppeltipp bricht ab, statt zu bestätigen.
 * ✓ merkt „übersprungen" und lädt ins Menü.
 *
 * Fortschritt (`core/save.ts`): `lehrgang:start` begonnen, `lehrgang:haekchen`
 * der Schritt, `lehrgang:geschafft` fertig. Hängt nur am Bus (Regel 10).
 * Der Bildschirmleser bekommt den vollen Schritttext als `aria-label`.
 */
import type { EventBus, GameEvents } from "../core/events";
import type { ControlConfig } from "../core/controlConfig";
import { merkeLehrgangBegonnen, merkeLehrgangFertig, merkeLehrgangSchritt, merkeLehrgangUebersprungen } from "../core/save";
import { sprache, waehle, type Sprache, type Zweisprachig } from "../challenges/texte";
import { LEKTIONEN } from "../challenges/lehrgang";
import type { LehrgangSymbol, LektionSchritt } from "../challenges/lektion";
import { wort } from "./aufgabentexte";
import { bedientext } from "./challengekarte";
import { zumMenue } from "./hauptmenue";

type Schritt = GameEvents["lehrgang:schritt"];

/*
 * Zeichnungen als SVG (24er-Raster, Strich in der Schriftfarbe): auf jedem
 * Gerät gleich, anders als Emoji. Nur feste Zeichenketten, nie Spielertext.
 */
const SVG = (inhalt: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inhalt}</svg>`;
export const BILD: Record<LehrgangSymbol | "auge" | "hand" | "haken" | "kreuz" | "skip", string> = {
  auge: SVG('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  hand: SVG(
    '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V12M17 12V8.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-2.7l-2.7-3.7a1.6 1.6 0 0 1 2.6-1.9L8 15"/>'
  ),
  haken: SVG('<path d="M4 12.5l5 5L20 6.5"/>'),
  kreuz: SVG('<path d="M6 6l12 12M18 6L6 18"/>'),
  skip: SVG('<path d="M3 5l8 7-8 7zM11 5l8 7-8 7z" fill="currentColor"/><path d="M21 5v14"/>'),
  ansicht: SVG('<rect x="3" y="4" width="13" height="10" rx="1.5"/><rect x="8" y="10" width="13" height="10" rx="1.5"/>'),
  kamera: SVG('<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8 7l1.5-3h5L16 7"/>'),
  // L4b: Mobilbagger von der Seite — zwei freie Raeder unter dem Rahmen, Oberwagen, Arm; kein Kettenband (qa Q4 Befund 5)
  fahren: SVG('<circle cx="6.5" cy="18" r="3"/><circle cx="17.5" cy="18" r="3"/><path d="M2 14h20"/><path d="M4 14v-4h7l2 4"/><path d="M12 11l5-6 3 3"/>'),
  // Draufsicht: Oberwagen mit Arm, Bogenpfeil darueber — kein Kreispfeil, der wie ↻ (Neustart) aussieht
  schwenken: SVG('<rect x="7" y="12" width="10" height="9" rx="1.5"/><path d="M12 12V7"/><path d="M4 8a10 10 0 0 1 16 0"/><path d="M20 4v4h-4"/>'),
  arm: SVG('<path d="M3 21h8"/><path d="M6 19L12 6l8 5" stroke-width="3"/><circle cx="12" cy="6" r="1.5"/>'),
  stiel: SVG('<path d="M3 13L10 4"/><path d="M10 4l6 10" stroke-width="3"/><path d="M13 16h6l-1 4h-4z"/>'),
  marke: SVG('<ellipse cx="12" cy="18" rx="7" ry="3"/><path d="M12 3v9M8.5 8.5L12 12l3.5-3.5"/>'),
  stuetzen: SVG('<rect x="7" y="5" width="10" height="6" rx="1"/><path d="M8 10L4 18M16 10l4 8M2 19h4M18 19h4"/>'),
  presse: SVG('<path d="M4 4h16M12 4v6M9 7.5l3 3 3-3"/><rect x="5" y="14" width="14" height="6"/>'),
  magnet: SVG('<path d="M6 4h3v8a3 3 0 0 0 6 0V4h3v8a6 6 0 0 1-12 0z"/><path d="M6 8h3M15 8h3"/>'),
  hupe: SVG('<path d="M3 10v4h4l6 4V6L7 10z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>'),
};

/** Was das Ereignis später mitbringen soll (Signatur an den Orchestrator) — bis dahin aus den Lektionsdaten. */
type MitSymbol = { symbol?: LehrgangSymbol; wort?: Zweisprachig };

/** Die Schrittdaten zu einem Ereignis (Symbol, Wort, Spur, Ziel). */
function datenZu(e: Pick<Schritt, "id" | "nr">): LektionSchritt | null {
  return LEKTIONEN.find((l) => l.id === e.id)?.schritte[e.nr - 1] ?? null;
}

/**
 * Rein: das Bildzeichen eines Schritts. Vorrang hat, was der Schritt selbst
 * sagt (Ereignis, dann Lektionsdaten); sonst geschlossen aus dem, was er übt
 * — Ersatz, solange welt das Feld `symbol` noch nicht liefert.
 */
export function schrittSymbol(e: Schritt, d: LektionSchritt | null = datenZu(e)): LehrgangSymbol | null {
  const eigenes = (e as Schritt & MitSymbol).symbol ?? d?.symbol;
  if (eigenes) return eigenes;
  if (e.marke) return "marke";
  if (e.zeige?.fn === "cab") return "schwenken";
  if (e.zeige?.fn === "boom") return "arm";
  if (e.zeige?.fn === "stick") return "stiel";
  const spur = d?.vorfuehrung ?? [];
  if (spur.some((a) => a.achsen?.drive || a.achsen?.steer)) return "fahren";
  if (spur.some((a) => a.tasten?.includes("KeyC")) || d?.ziel.art === "ansicht") return "ansicht";
  if (spur.some((a) => a.kamera) || d?.ziel.art === "kameraStart") return "kamera";
  return null;
}

export interface LeistenBild {
  nr: number;
  von: number;
  phase: "zeigen" | "du";
  haken: boolean;
  symbol: LehrgangSymbol | null;
  /** höchstens ein Wort, "" = keins */
  wort: string;
  /** Vorlesetext: „Schritt 3 von 16 · Schau zu: Kamera neigen. Den Finger …" */
  aria: string;
}

/** Rein: was die Leiste zeigt. */
export function leistenBild(e: Schritt, haken: boolean, c: ControlConfig, s: Sprache): LeistenBild {
  const d = datenZu(e);
  const w = (e as Schritt & MitSymbol).wort ?? d?.wort;
  const titel = waehle(e.titel, s);
  const kopf = `${wort("schritt", s)} ${e.nr} ${wort("von", s)} ${e.von}`;
  const was = haken ? `✓ ${titel}` : `${wort(e.phase === "zeigen" ? "schauZu" : "jetztDu", s)}: ${titel}`;
  return {
    nr: e.nr,
    von: e.von,
    phase: e.phase,
    haken,
    symbol: schrittSymbol(e, d),
    wort: w ? waehle(w, s) : "",
    aria: `${kopf} · ${was}. ${bedientext(waehle(e.text, s), c, s)}`,
  };
}

export interface LektionsKarteAnschluss {
  bus: EventBus;
  steuerung: () => ControlConfig;
  /** Häkchen: der Klack aus `audioManager.playSchritt` */
  audio: { playSchritt(): void };
}

export interface LektionsKarte {
  /** Einmal je Bild außerhalb der Pause (bleibt für main.ts; die Leiste braucht keine Uhr). */
  takt(dt: number): void;
  /** Nach einem Sprachwechsel. */
  neuBeschriften(): void;
}

export function installLektionsKarte(m: LektionsKarteAnschluss): LektionsKarte {
  // Der Fortschritt hängt am Bus, auch wenn die Leiste im Markup fehlen sollte
  m.bus.on("lehrgang:start", () => merkeLehrgangBegonnen());
  m.bus.on("lehrgang:haekchen", (e) => merkeLehrgangSchritt(e.nr));
  m.bus.on("lehrgang:geschafft", () => merkeLehrgangFertig());
  m.bus.on("lehrgang:haekchen", () => m.audio.playSchritt());

  const leiste = document.getElementById("lehrgangsleiste");
  const phaseEl = leiste?.querySelector<HTMLElement>(".phase");
  const fnEl = leiste?.querySelector<HTMLElement>(".fn");
  const wortEl = leiste?.querySelector<HTMLElement>(".wort");
  const punkte = leiste?.querySelector<HTMLElement>(".punkte");
  const skip = document.getElementById("lg-skip");
  const ja = document.getElementById("lg-ja");
  const nein = document.getElementById("lg-nein");
  const fsym = leiste?.querySelector<HTMLElement>(".fsym");
  const leer: LektionsKarte = { takt() {}, neuBeschriften() {} };
  if (!leiste || !phaseEl || !fnEl || !wortEl || !punkte || !skip || !ja || !nein || !fsym) return leer;

  skip.innerHTML = BILD.skip;
  ja.innerHTML = BILD.haken;
  nein.innerHTML = BILD.kreuz;
  fsym.innerHTML = `${BILD.skip}<b>?</b>`;

  let schritt: Schritt | null = null;
  let haken = false;
  /** L5-B (40c): erreichte Teilziele des laufenden Schritts */
  let teil = 0;
  let gebaut = -1; // so viele Striche stehen im DOM

  const beschrifteKnoepfe = (s: Sprache): void => {
    skip.setAttribute("aria-label", wort("ueberspringen", s));
    ja.setAttribute("aria-label", wort("ueberspringenJa", s));
    nein.setAttribute("aria-label", wort("ueberspringenNein", s));
  };
  const zeige = (): void => {
    const s = sprache();
    beschrifteKnoepfe(s);
    if (!schritt) return;
    const b = leistenBild(schritt, haken, m.steuerung(), s);
    leiste.setAttribute("aria-label", b.aria);
    leiste.dataset["phase"] = b.phase;
    leiste.classList.toggle("haken", b.haken);
    phaseEl.innerHTML = BILD[b.haken ? "haken" : b.phase === "zeigen" ? "auge" : "hand"];
    fnEl.innerHTML = b.symbol ? BILD[b.symbol] : "";
    fnEl.hidden = !b.symbol;
    wortEl.textContent = b.wort;
    if (gebaut !== b.von) {
      punkte.replaceChildren(...Array.from({ length: b.von }, () => document.createElement("i")));
      gebaut = b.von;
    }
    // ponytail: ein Strich je Schritt, bei mehr als ~40 Schritten werden sie haarduenn — dann Balken mit Fuellung
    punkte.childNodes.forEach((n, i) => {
      const el = n as HTMLElement;
      const ok = i < b.nr - 1 || (b.haken && i === b.nr - 1);
      el.className = ok ? (b.haken && i === b.nr - 1 ? "ok neu" : "ok") : i === b.nr - 1 ? "jetzt" : "";
      /*
       * L5-B (40c): Hat der Schritt Teilziele, ist sein Strich geteilt; die
       * erreichten Teile sind gruen (neu erreicht: kurzes Aufploppen wie beim
       * Haekchen). Das Haekchen fuellt dann den ganzen Strich.
       */
      const teile = !ok && i === b.nr - 1 ? (schritt?.teile ?? 1) : 1;
      if (teile > 1) {
        el.className = "jetzt geteilt";
        if (el.childNodes.length !== teile) el.replaceChildren(...Array.from({ length: teile }, () => document.createElement("b")));
        el.childNodes.forEach((t, j) => ((t as HTMLElement).className = j < teil ? (j === teil - 1 ? "ok neu" : "ok") : ""));
      } else if (el.childNodes.length) el.replaceChildren();
    });
  };

  const frage = (an: boolean): void => {
    leiste.classList.toggle("fragt", an);
  };
  const tipp = (el: HTMLElement, tu: () => void): void => {
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      tu();
    });
  };
  tipp(skip, () => frage(true));
  tipp(nein, () => frage(false));
  tipp(ja, () => {
    merkeLehrgangUebersprungen();
    zumMenue();
  });

  m.bus.on("lehrgang:start", () => {
    schritt = null;
    haken = false;
    teil = 0;
    frage(false);
    leiste.hidden = false;
    zeige();
  });
  m.bus.on("lehrgang:schritt", (e) => {
    if (schritt?.nr !== e.nr || schritt.id !== e.id) teil = 0;
    schritt = e;
    haken = false;
    leiste.classList.remove("teil");
    leiste.hidden = false;
    zeige();
  });
  m.bus.on("lehrgang:haekchen", () => {
    haken = true;
    leiste.classList.remove("teil");
    zeige();
  });
  // L5-B (40c): Teilziel — die Haelfte wird gruen, die Leiste leuchtet kurz, der Schritt laeuft weiter
  m.bus.on("lehrgang:teilziel", (e) => {
    if (!schritt || schritt.id !== e.id || schritt.nr !== e.nr) return;
    teil = e.teil;
    leiste.classList.add("teil");
    zeige();
  });
  m.bus.on("lehrgang:geschafft", () => {
    leiste.hidden = true;
    frage(false);
  });

  return { takt() {}, neuBeschriften: zeige };
}
