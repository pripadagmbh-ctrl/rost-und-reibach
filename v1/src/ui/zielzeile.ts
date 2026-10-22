/**
 * DIE ZIELZEILE DER PRUEFUNGEN (Auftrag 41-P2, ersetzt die Aufgabenkarte).
 *
 * Patrick 22.10.2026 (offene-punkte.md 41a–41f): „sehr viel Text … auch
 * Kinder müssen das Spiel intuitiv checken … kein Fan von diesen Textboxen".
 * Entschieden: oben nur eine schmale Zeile (index.html `#zielzeile`):
 *
 *   [0:42 ★★☆ ✓4/6]  [Teil → Ziel] [PRESSEN|Tipp] [↻]
 *                     Kupfer in BUNT + VA          ← nur 4 s, dann weg
 *
 *  - Teil → Ziel: zwei Bilder (Sorte = Farbe + Bild aus `materials/sorten.ts`,
 *    Ziel einer Sorte = Mulde in der Sortenfarbe mit dem Bild darin). Dazu
 *    hoechstens fuenf Woerter (`challenge:start.kurz`), nach `WOERTER_S`
 *    Aufgabenzeit nur noch die Bilder. Antippen zeigt die Woerter wieder.
 *  - Uhr (nur bei voller Sekunde neu geschrieben), Sterne: drei zu Beginn;
 *    ist die Zeit fuer ★★★ um, wird der dritte ein blasser Umriss, nach der
 *    ★★-Zeit der zweite (Fuellung UND Helligkeit, nie nur Farbe).
 *  - Zaehler als ✓ 4/6, Balken als schmale Spur; PRESSEN als Bild, nur bei
 *    `pressenBereit`; Tipp (Pruefung 6) als Stuetzen-Bild — sein Satz kommt
 *    nur auf Antippen, nie von selbst.
 *  - ↻ sendet `challenge:neustart`. Das ⏸ steht seit Auftrag 43a nicht mehr
 *    hier, sondern einmal fuers ganze Spiel neben ☰ (`ui/pausenknopf.ts`).
 *
 * Haengt nur am Bus (Regel 10). Die Lernschritte zeigen Geisterdaumen und
 * Zielmarke in der Welt; der Vorlesetext (aria-label) traegt das volle Ziel.
 */
import type { EventBus, GameEvents, ZielBild } from "../core/events";
import { sprache, waehle, type Sprache } from "../challenges/texte";
import type { ChallengeWertung } from "../challenges/challenge";
import { SORTEN, bildFarbe, farbeCss } from "../materials/sorten";
import { uhr, wort } from "./aufgabentexte";
import { BILD } from "./lektionskarte";
import { Klappe, tippKnopf, zeile } from "./challengekarte";

/** SW: Patrick 22.10.2026 — nach 4 s Aufgabenzeit nur noch die Bilder. */
export const WOERTER_S = 4;
/** SW: 0,8 s Sperre gegen den zweiten Tipp auf ↻ waehrend des Neustarts (wie die Karte, E-162) */
const NEUSTART_SPERRE_MS = 800;

/* Zeichnungen im 24er-Raster (wie `BILD` in ui/lektionskarte.ts), nur feste Zeichenketten */
const svg = (inhalt: string, strich = "currentColor"): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="${strich}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inhalt}</svg>`;
const pfade = (d: readonly string[]): string => d.map((x) => `<path d="${x}"/>`).join("");

/** Was es noch nicht gibt: Dinge ohne Sorte. SW: Bildwahl, am Geraet abzunehmen (41-P2). */
const DING: Record<Extract<ZielBild, { bild: string }>["bild"], string> = {
  // Pkw von der Seite, zwei Raeder
  wrack: pfade(["M2 16v-3l3-1 3-4h7l4 4 2 1v3z", "M5 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0", "M15 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0"]),
  // Wohnwagen: Kasten mit Fenster, ein Rad, Deichsel
  wohnwagen: pfade(["M3 6h14a4 4 0 0 1 4 4v7H3z", "M6 9h5v4H6z", "M8 19a2 2 0 1 0 4 0a2 2 0 1 0-4 0", "M21 16h2"]),
  // Lkw: Koffer und Fuehrerhaus
  lkw: pfade(["M2 6h12v11H2z", "M14 10h4l4 4v3h-8z", "M4 19a2 2 0 1 0 4 0a2 2 0 1 0-4 0", "M15 19a2 2 0 1 0 4 0a2 2 0 1 0-4 0"]),
  gemischt: pfade(SORTEN.misch.bild),
  eisen: pfade(SORTEN.stahl.bild),
  presse: "",
  kreis: "",
  // drei Mulden nebeneinander
  mulden: pfade(["M1 9h7l-1 9H2z", "M8.5 9h7l-1 9h-5z", "M16 9h7l-1 9h-5z"]),
  // flacher Block, Pfeil von oben
  platt: pfade(["M2 20h20v-3H2z", "M12 3v9M8.5 8.5L12 12l3.5-3.5"]),
};
/** Mulde von der Seite, gross genug fuer ein Sortenbild darin */
const MULDE = "M1 5h22l-3 17H4z";
const PFEIL = svg('<path d="M3 12h17M14 6l6 6-6 6"/>');
const NEU = svg('<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 3v5h-5"/>');
const STERN_D = "M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z";

/**
 * Rein: das Bild eines Teils oder Ziels als SVG. Teil einer Sorte = ihr Bild
 * in ihrer Farbe; Ziel einer Sorte = die Mulde in der Sortenfarbe, darin das
 * Bild in Schwarz oder Weiss (`bildFarbe`, Kontrast ≥ 4,5 : 1).
 */
export function zielBildSvg(b: ZielBild, rolle: "teil" | "ziel"): string {
  if ("sorte" in b) {
    const s = SORTEN[b.sorte];
    if (!s) return "";
    const farbe = farbeCss(s.farbe);
    if (rolle === "teil") return svg(pfade(s.bild), farbe);
    return svg(
      `<path d="${MULDE}" fill="${farbe}"/><g transform="translate(6 8) scale(0.5)" stroke="${farbeCss(bildFarbe(b.sorte))}" stroke-width="4">${pfade(s.bild)}</g>`,
      farbe
    );
  }
  if (b.bild === "presse") return BILD.presse;
  if (b.bild === "kreis") return BILD.marke;
  return svg(DING[b.bild] ?? "");
}

/** Rein: wie viele Sterne die Uhr noch erlaubt (andere Schwellen sieht erst die Tafel). */
export function sterneMoeglich(w: ChallengeWertung, zeitS: number): 1 | 2 | 3 {
  if (w.zwei.zeitS !== undefined && zeitS > w.zwei.zeitS) return 1;
  if (w.drei.zeitS !== undefined && zeitS > w.drei.zeitS) return 2;
  return 3;
}

/** Drei Sterne; die verlorenen als blasser Umriss (`.aus`). */
function sterneSvg(n: number): string {
  return [1, 2, 3]
    .map((i) => `<span class="stern${i > n ? " aus" : ""}">${svg(`<path d="${STERN_D}"${i > n ? "" : ' fill="currentColor"'}/>`)}</span>`)
    .join("");
}

export interface ZielzeileAnschluss {
  bus: EventBus;
  /** Tick beim Antippen (`playTick`), Doppelklick, wenn ein Lernschritt geschafft ist (`playSchritt`) */
  audio?: { playTick(): void; playSchritt(): void };
}

export interface Zielzeile {
  /** Nach einem Sprachwechsel (der Bauleiter haengt es an die Sprachwahl). */
  neuBeschriften(): void;
}

export function installZielzeile(m: ZielzeileAnschluss): Zielzeile {
  const leiste = document.getElementById("zielzeile");
  const uhrEl = document.getElementById("zz-uhr");
  const sterneEl = document.getElementById("zz-sterne");
  const messEl = document.getElementById("zz-mess");
  const zielKnopf = document.getElementById("zz-ziel");
  const pressen = document.getElementById("zz-pressen");
  const tippEl = document.getElementById("zz-tipp");
  const neu = document.getElementById("zz-neu");
  const satzEl = document.getElementById("zz-satz");
  if (!leiste || !uhrEl || !sterneEl || !messEl || !zielKnopf || !pressen || !tippEl || !neu || !satzEl)
    return { neuBeschriften() {} };

  pressen.innerHTML = BILD.presse;
  tippEl.innerHTML = BILD.stuetzen;
  neu.innerHTML = NEU;

  let start: GameEvents["challenge:start"] | null = null;
  let stand: GameEvents["challenge:stand"] | null = null;
  let schrittNr = 0;
  let laeuft = false;
  let sterne = 0;
  let mess = "";
  let pressenSichtbar = false;
  /** Was die Woerter-Zeile gerade traegt: das Ziel oder (angetippt) den Tipp */
  let quelle: "kurz" | "tipp" = "kurz";
  const klappe = new Klappe(() => true, WOERTER_S);
  const setzeUhr = zeile(uhrEl, false);
  const setzeSatz = zeile(satzEl, false);
  const tick = (): void => m.audio?.playTick();

  const beschrifte = (s: Sprache): void => {
    pressen.setAttribute("aria-label", wort("pressen", s));
    tippEl.setAttribute("aria-label", wort("tipp", s));
    neu.setAttribute("aria-label", wort("neustart", s));
    zielKnopf.setAttribute("aria-label", wort("zielZeigen", s));
    if (start) leiste.setAttribute("aria-label", `${wort("ziel", s)}: ${waehle(start.ziel, s)}`);
  };

  const zeigeSatz = (s: Sprache): void => {
    const tipp = quelle === "tipp" ? stand?.tipp : null;
    const text = tipp ? waehle(tipp, s) : start?.kurz ? waehle(start.kurz, s) : "";
    setzeSatz(text);
    leiste.classList.toggle("zu", klappe.zu || text === "");
  };

  const zeigeStand = (s: Sprache): void => {
    const e = stand;
    if (!e || !start) return;
    setzeUhr(uhr(e.zeitS));
    const n = sterneMoeglich(start.wertung, e.zeitS);
    if (n !== sterne) {
      sterne = n;
      sterneEl.innerHTML = sterneSvg(n);
    }
    sterneEl.setAttribute("aria-label", wort("sterneMoeglich", s).replace("{n}", String(n)));
    // ponytail: Zaehler und Balken teilen einen Platz, der Zaehler geht vor — gleichzeitig hat sie keine Pruefung
    const pct = e.balken01 === null ? -1 : Math.round(Math.max(0, Math.min(1, e.balken01)) * 100);
    const neuMess = e.zaehler ? `z${e.zaehler.ist}/${e.zaehler.von}` : pct >= 0 ? `b${pct}` : "";
    if (neuMess !== mess) {
      mess = neuMess;
      messEl.hidden = mess === "";
      messEl.innerHTML = e.zaehler
        ? `${BILD.haken}<b>${e.zaehler.ist}/${e.zaehler.von}</b>`
        : pct >= 0
          ? `<i class="spur"><i style="width:${pct}%"></i></i>`
          : "";
    }
    messEl.setAttribute(
      "aria-label",
      e.zaehler ? `${e.zaehler.ist}/${e.zaehler.von} ${waehle(e.zaehler.wort, s)}` : pct >= 0 ? `${wort("platt", s)} ${pct} %` : ""
    );
    if (e.pressenBereit !== pressenSichtbar) {
      pressenSichtbar = e.pressenBereit;
      pressen.hidden = !pressenSichtbar;
    }
    // Ein Platz fuer PRESSEN und Tipp (iPhone mini, test/zielzeile-platz.test.ts); PRESSEN geht vor
    tippEl.hidden = !e.tipp || pressenSichtbar;
    klappe.zeit(e.zeitS);
    zeigeSatz(s);
  };

  const allesNeu = (): void => {
    const s = sprache();
    beschrifte(s);
    zeigeSatz(s);
    zeigeStand(s);
  };

  // --- Knoepfe
  tippKnopf(zielKnopf, () => {
    tick();
    quelle = "kurz";
    klappe.tippe();
    zeigeSatz(sprache());
  });
  tippKnopf(tippEl, () => {
    if (!stand?.tipp) return;
    tick();
    quelle = "tipp";
    klappe.zeige();
    zeigeSatz(sprache());
  });
  tippKnopf(pressen, () => {
    if (!pressenSichtbar || !laeuft) return;
    tick();
    m.bus.emit("challenge:pressen", {});
  });
  let zuletztNeu = -Infinity;
  tippKnopf(neu, () => {
    const jetzt = performance.now();
    if (jetzt - zuletztNeu < NEUSTART_SPERRE_MS) return;
    zuletztNeu = jetzt;
    tick();
    m.bus.emit("challenge:neustart", {});
  });

  // --- Bus
  m.bus.on("challenge:start", (e) => {
    start = e;
    stand = null;
    schrittNr = 0;
    laeuft = true;
    sterne = 3;
    mess = "";
    quelle = "kurz";
    pressenSichtbar = false;
    pressen.hidden = true;
    tippEl.hidden = true;
    messEl.hidden = true;
    messEl.innerHTML = "";
    sterneEl.innerHTML = sterneSvg(3);
    zielKnopf.hidden = !e.zeichen;
    zielKnopf.innerHTML = e.zeichen
      ? `<span class="bild">${zielBildSvg(e.zeichen.teil, "teil")}</span><span class="pfeil">${PFEIL}</span><span class="bild">${zielBildSvg(e.zeichen.ziel, "ziel")}</span>`
      : "";
    klappe.neustart();
    setzeUhr(uhr(0));
    leiste.hidden = false;
    const s = sprache();
    beschrifte(s);
    zeigeSatz(s);
  });
  m.bus.on("challenge:schritt", (e) => {
    if (schrittNr && e.nr > schrittNr) m.audio?.playSchritt(); // der vorige Schritt ist geschafft
    schrittNr = e.nr;
  });
  m.bus.on("challenge:stand", (e) => {
    stand = e;
    zeigeStand(sprache());
  });
  m.bus.on("challenge:geschafft", () => {
    laeuft = false;
    pressenSichtbar = false;
    leiste.hidden = true;
  });

  return { neuBeschriften: allesNeu };
}

