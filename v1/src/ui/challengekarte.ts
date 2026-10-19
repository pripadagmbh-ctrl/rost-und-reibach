/**
 * DIE AUFGABENKARTE (E-125, ausgebaut mit E-162 am 19.10.2026) — dieselbe
 * Karte wie der gefuehrte Einstieg des Betriebs (`#tutorial`): gleiche Stelle,
 * gleiche Bauart, kein zweites Kaertchen. In einer Aufgabe gehoert sie der
 * Aufgabe; der Handelskreislauf ist dort nicht angeschlossen.
 *
 * Was darauf steht (Konzept `docs/aufgaben-konzept.md`, abgenommen 19.10.2026):
 *
 *   2/6 · 0:42                    [PRESSEN] [Pause] [↻]
 *   Ziel: Leg das Kupferteil in die Box BUNT + VA.
 *   Senk die Spinne ab                       (der Mini-Schritt)
 *   Linker Stick nach unten: Hauptarm senken (SEINE Belegung)
 *   4/6 richtig  — oder —  platt ▓▓▓░░ 60 %
 *   Tipp (erst nach einem Ereignis)
 *   ★★ 3:00 · ★★★ 1:30 · 0 Fehlwürfe   (eine Zeile, E-162 G2b)
 *
 * Haengt nur am Bus (Regel 10): Sie liest `challenge:start/schritt/stand/
 * geschafft` und sendet `challenge:neustart` (↻) und `challenge:pressen`.
 * Ob ↻ neu laedt oder neu aufbaut, entscheidet main.ts.
 *
 * Die Karte schreibt nur, was sich geaendert hat: `challenge:stand` kommt
 * einmal je Bild, die Uhr springt aber nur jede ganze Sekunde.
 *
 * Die Platzhalter im Text werden HIER zu den Namen der Bedienelemente, und
 * zwar aus der Stickbelegung, die gerade gilt: Wer im Steuerungsmenue
 * umbelegt hat, liest seine eigene Belegung — in seiner Sprache.
 */
import type { EventBus, GameEvents } from "../core/events";
import type { AxisId, ControlConfig, ControlFunction } from "../core/controlConfig";
import { sprache, waehle, type Sprache } from "../challenges/texte";
import { sternZiele, uhr, wort } from "./aufgabentexte";

/** Welche Achse fuehrt die Funktion? (die erste, wenn doppelt belegt) */
export function achseVon(fn: ControlFunction, c: ControlConfig): AxisId | null {
  return (Object.keys(c) as AxisId[]).find((id) => c[id].fn === fn) ?? null;
}

/**
 * Wohin der Daumen auf dem Bildschirm schiebt, damit die Funktion in die
 * gewuenschte Richtung laeuft. EINE Stelle fuer Text und Geisterdaumen, damit
 * die Karte nie „nach rechts" sagt, waehrend der Daumen nach links zeigt.
 *
 * Positiv ist der Bildschirmausschlag nach rechts bzw. nach unten
 * (`core/touch.ts`: `raw * (invert ? -1 : 1)`), die Umkehr dreht ihn; fuer die
 * Spinne heisst positiv „schliessen".
 */
export function stickRichtung(
  id: AxisId,
  c: ControlConfig,
  plus: boolean
): { seite: "links" | "rechts"; quer: boolean; rechtsOderUnten: boolean } {
  return {
    seite: id.startsWith("left") ? "links" : "rechts",
    quer: id.endsWith("X"),
    rechtsOderUnten: plus !== c[id].invert,
  };
}

function stickName(id: AxisId, s: Sprache): string {
  return wort(id.startsWith("left") ? "linkerStick" : "rechterStick", s);
}

/** „rechter Stick nach rechts" / „right stick right". */
function richtungText(id: AxisId, c: ControlConfig, plus: boolean, s: Sprache): string {
  const r = stickRichtung(id, c, plus);
  const w = r.quer
    ? wort(r.rechtsOderUnten ? "nachRechts" : "nachLinks", s)
    : wort(r.rechtsOderUnten ? "nachUnten" : "nachOben", s);
  return `${stickName(id, s)} ${w}`;
}

/** „linker Stick seitlich" / „left stick sideways". */
function achsText(id: AxisId, s: Sprache): string {
  return `${stickName(id, s)} ${wort(id.endsWith("X") ? "seitlich" : "hochRunter", s)}`;
}

const ALTE_NAMEN: Record<string, { fn: ControlFunction; plus?: boolean }> = {
  schwenken: { fn: "cab" },
  hauptarm: { fn: "boom" },
  ausleger: { fn: "stick" },
  schliessen: { fn: "grapple", plus: true },
  oeffnen: { fn: "grapple", plus: false },
};

/**
 * Platzhalter durch die Bedienelemente ersetzen.
 *
 *  - die Namen aus E-125: `{schwenken}`, `{hauptarm}`, `{ausleger}` (Achse),
 *    `{schliessen}`, `{oeffnen}` (Richtung der Spinne);
 *  - neu mit E-162, fuer jede Funktion: `{boom}` = Achse, `{boom+}` / `{boom-}`
 *    = Richtung im Sinn des Befehls (dasselbe „plus" wie `zeige.richtung`).
 *    Funktionen: boom, stick, cab, grapple, rotator.
 */
export function bedientext(text: string, c: ControlConfig, s: Sprache = sprache()): string {
  const ersetze = (fn: ControlFunction, plus: boolean | undefined): string => {
    const id = achseVon(fn, c);
    if (!id) return wort("unbelegt", s);
    return plus === undefined ? achsText(id, s) : richtungText(id, c, plus, s);
  };
  const fertig = text.replace(
    /\{(schwenken|hauptarm|ausleger|schliessen|oeffnen|boom|stick|cab|grapple|rotator)([+-]?)\}/g,
    (_, name: string, vz: string) => {
      const alt = ALTE_NAMEN[name];
      if (alt) return ersetze(alt.fn, alt.plus);
      return ersetze(name as ControlFunction, vz === "" ? undefined : vz === "+");
    }
  );
  // Jede Zeile beginnt gross, auch wenn sie mit einem Platzhalter anfaengt
  return fertig.replace(/(^|\n)(\S)/g, (_, a: string, b: string) => a + b.toUpperCase());
}

/** Was die Karte von aussen braucht — mehr nicht. */
export interface KartenAnschluss {
  bus: EventBus;
  steuerung: () => ControlConfig;
  /** Ein Schritt ist geschafft: der Doppelklick aus `audioManager.playSchritt` */
  audio: { playSchritt(): void };
}

export interface ChallengeKarte {
  /** Nach einem Sprachwechsel: alles neu beschriften (der Bauleiter haengt es an die Sprachwahl). */
  neuBeschriften(): void;
}

/** Einen Knopf an Zeiger statt an `click` haengen (Begruendung im Rumpf). */
function tippKnopf(el: HTMLElement, tu: () => void): void {
  /*
   * Warum nicht `click`: `core/touch.ts` verhindert auf iOS jedes `touchend`,
   * das binnen 320 ms nach dem vorigen kommt (gegen den Doppeltipp-Zoom). Wer
   * gerade den Stick losgelassen hat und sofort ↻ tippt, bekaeme dann keinen
   * `click` — der Knopf taete nichts. Ausgeloest wird darum auf `pointerup`,
   * aber nur, wenn derselbe Finger auf DIESEM Knopf aufgesetzt hat; ein
   * Daumen, der vom Stick auf den Knopf rutscht, loest nichts aus.
   */
  let zeiger: number | null = null;
  el.addEventListener(
    "pointerdown",
    (e) => {
      zeiger = e.pointerId;
      e.preventDefault();
      e.stopPropagation();
    },
    { passive: false }
  );
  el.addEventListener("pointerup", (e) => {
    if (zeiger !== e.pointerId) return;
    zeiger = null;
    tu();
  });
  const ab = (): void => {
    zeiger = null;
  };
  el.addEventListener("pointercancel", ab);
  el.addEventListener("pointerleave", ab);
  // Tastatur (Eingabe/Leertaste auf dem Knopf) meldet einen `click` ohne Zeiger
  el.addEventListener("click", (e) => {
    if (e.detail === 0) tu();
  });
}

/** Ein Element, das sich seinen letzten Text merkt — geschrieben wird nur bei Aenderung. */
function zeile(el: HTMLElement, leerVersteckt = true): (text: string) => void {
  let alt: string | null = null;
  return (text) => {
    if (text === alt) return;
    alt = text;
    el.textContent = text;
    if (leerVersteckt) el.hidden = text === "";
  };
}

export function installChallengeKarte(m: KartenAnschluss): ChallengeKarte {
  const karte = document.getElementById("tutorial");
  const innen = karte?.querySelector<HTMLElement>(".karte");
  const kopf = karte?.querySelector<HTMLElement>(".kopf");
  const knoepfe = karte?.querySelector<HTMLElement>(".knoepfe");
  const schritt = document.getElementById("tut-schritt");
  const titel = document.getElementById("tut-titel");
  const text = document.getElementById("tut-text");
  const pause = document.getElementById("tut-pause");
  const skip = document.getElementById("tut-skip");
  const leer: ChallengeKarte = { neuBeschriften() {} };
  if (!karte || !innen || !kopf || !knoepfe || !schritt || !titel || !text || !pause) return leer;

  // Die Karte gehoert hier der Aufgabe: eigene Fassung (index.html, `.aufgabe`),
  // eigene Sprache — die Seitenuebersetzung (`ui/sprache.ts`) laesst sie aus.
  karte.classList.add("aufgabe");
  karte.setAttribute("translate", "no");
  // Ueberspringen gibt es hier nicht: ein Schritt ist geschafft, wenn er gesehen wurde
  if (skip) skip.hidden = true;

  // --- Kopf: „2/6 · 0:42" links, Knoepfe rechts
  const links = document.createElement("span");
  links.className = "links";
  const uhrEl = document.createElement("span");
  uhrEl.className = "uhr";
  kopf.insertBefore(links, schritt);
  links.append(schritt, " · ", uhrEl);

  const pressen = document.createElement("button");
  pressen.type = "button";
  pressen.id = "tut-pressen";
  pressen.hidden = true;
  const neu = document.createElement("button");
  neu.type = "button";
  neu.id = "tut-neu";
  neu.textContent = "↻";
  knoepfe.insertBefore(pressen, pause);
  knoepfe.appendChild(neu);
  pause.setAttribute("type", "button");

  // --- Zeilen unter dem Kopf. `.zusatz` klappt mit der Karte ein (Pause).
  const neueZeile = (klasse: string): HTMLDivElement => {
    const d = document.createElement("div");
    d.className = `zusatz ${klasse}`;
    d.hidden = true;
    return d;
  };
  const zielEl = neueZeile("ziel");
  const zaehlerEl = neueZeile("zaehler");
  const balkenEl = neueZeile("balken");
  const balkenWort = document.createElement("span");
  const balkenSpur = document.createElement("span");
  balkenSpur.className = "spur";
  const balkenFuell = document.createElement("span");
  balkenFuell.className = "fuell";
  const balkenZahl = document.createElement("span");
  balkenSpur.appendChild(balkenFuell);
  balkenEl.append(balkenWort, balkenSpur, balkenZahl);
  const tippEl = neueZeile("tipp");
  const sternEl = neueZeile("stern");
  innen.insertBefore(zielEl, titel);
  innen.append(zaehlerEl, balkenEl, tippEl, sternEl);

  const setzeUhr = zeile(uhrEl);
  const setzeSchritt = zeile(schritt);
  const setzeTitel = zeile(titel);
  const setzeText = zeile(text);
  const setzeZiel = zeile(zielEl);
  const setzeZaehler = zeile(zaehlerEl);
  const setzeTipp = zeile(tippEl);
  const setzeSterne = zeile(sternEl);
  // Knoepfe: Sichtbarkeit steuert der Zustand, nicht der Text
  const setzePause = zeile(pause, false);
  const setzePressen = zeile(pressen, false);

  // --- Was zuletzt gemeldet wurde: daraus wird nach einem Sprachwechsel neu beschriftet
  let start: GameEvents["challenge:start"] | null = null;
  let letzterSchritt: GameEvents["challenge:schritt"] | null = null;
  let stand: GameEvents["challenge:stand"] | null = null;
  let balkenProzent = -1;
  let pressenSichtbar = false;
  let laeuft = false;

  const beschrifteFest = (s: Sprache): void => {
    setzePause(wort(karte.classList.contains("pausiert") ? "weiter" : "pause", s));
    pause.setAttribute("aria-label", wort("karteEinklappen", s));
    neu.setAttribute("aria-label", wort("neustart", s));
    neu.title = wort("neustart", s);
    setzePressen(wort("pressen", s));
    balkenWort.textContent = wort("platt", s);
  };

  const zeigeStart = (s: Sprache): void => {
    if (!start) return;
    setzeZiel(`${wort("ziel", s)}: ${waehle(start.ziel, s)}`);
    setzeSterne(sternZiele(start.wertung, s));
  };

  const zeigeSchritt = (s: Sprache): void => {
    const e = letzterSchritt;
    if (!e) return;
    setzeSchritt(`${e.nr}/${e.von}`);
    setzeTitel(waehle(e.titel, s));
    setzeText(bedientext(waehle(e.text, s), m.steuerung(), s));
  };

  const zeigeStand = (s: Sprache): void => {
    const e = stand;
    if (!e) return;
    setzeUhr(uhr(e.zeitS));
    setzeZaehler(e.zaehler ? `${e.zaehler.ist}/${e.zaehler.von} ${waehle(e.zaehler.wort, s)}` : "");
    const pct = e.balken01 === null ? -1 : Math.round(Math.max(0, Math.min(1, e.balken01)) * 100);
    if (pct !== balkenProzent) {
      balkenProzent = pct;
      balkenEl.hidden = pct < 0;
      if (pct >= 0) {
        balkenFuell.style.width = `${pct}%`;
        // Zahl UND Balken: Farbe/Laenge ist nie der einzige Kanal (Kap. 20)
        balkenZahl.textContent = `${pct} %`;
      }
    }
    setzeTipp(e.tipp ? waehle(e.tipp, s) : "");
    if (e.pressenBereit !== pressenSichtbar) {
      pressenSichtbar = e.pressenBereit;
      pressen.hidden = !pressenSichtbar;
    }
  };

  const allesNeu = (): void => {
    const s = sprache();
    beschrifteFest(s);
    zeigeStart(s);
    zeigeSchritt(s);
    zeigeStand(s);
  };

  // --- Knoepfe
  tippKnopf(pause, () => {
    karte.classList.toggle("pausiert");
    setzePause(wort(karte.classList.contains("pausiert") ? "weiter" : "pause", sprache()));
  });
  let zuletztNeu = -Infinity;
  tippKnopf(neu, () => {
    // Ein zweiter Tipp waehrend des Neustarts ist kein zweiter Neustart
    const jetzt = performance.now();
    if (jetzt - zuletztNeu < 800) return; // SW: 0,8 s Sperre
    zuletztNeu = jetzt;
    m.bus.emit("challenge:neustart", {});
  });
  tippKnopf(pressen, () => {
    if (pressenSichtbar && laeuft) m.bus.emit("challenge:pressen", {});
  });

  // --- Bus
  m.bus.on("challenge:start", (e) => {
    start = e;
    letzterSchritt = null;
    stand = null;
    balkenProzent = -1;
    balkenEl.hidden = true;
    pressenSichtbar = false;
    laeuft = true;
    const s = sprache();
    beschrifteFest(s);
    zeigeStart(s);
    setzeUhr(uhr(0));
    setzeZaehler("");
    setzeTipp("");
    karte.classList.add("open");
  });
  m.bus.on("challenge:schritt", (e) => {
    if (letzterSchritt && e.nr > letzterSchritt.nr) m.audio.playSchritt(); // der vorige Schritt ist geschafft
    letzterSchritt = e;
    laeuft = true;
    zeigeSchritt(sprache());
    karte.classList.add("open");
  });
  m.bus.on("challenge:stand", (e) => {
    stand = e;
    zeigeStand(sprache());
  });
  m.bus.on("challenge:geschafft", () => {
    laeuft = false;
    pressenSichtbar = false;
    pressen.hidden = true;
    karte.classList.remove("open");
  });

  beschrifteFest(sprache());
  return { neuBeschriften: allesNeu };
}
