/**
 * BEDIENWOERTER UND KNOPF-HELFER DER PRUEFUNGEN (E-125/E-162).
 *
 * Hier stand bis Auftrag 41-P2 (22.10.2026) die Aufgabenkarte, die Fliesstext-
 * Karte in `#tutorial`. Sie ist ersetzt durch die Zielzeile
 * (`ui/zielzeile.ts`: Bild Teil → Bild Ziel, Uhr, Sterne, Zaehler). Was
 * weiterlebt, weil Geisterdaumen, Lehrgangsleiste und Zielzeile es teilen:
 *
 *  - `achseVon`, `stickRichtung`, `bedientext`: aus der Stickbelegung, die
 *    gerade gilt, Name und Richtung des Bedienelements — EINE Stelle fuer
 *    Vorlesetext und Geisterdaumen;
 *  - `Klappe`: auf/zu nach einer Frist auf der Aufgabenuhr (E-164; die
 *    Zielzeile blendet damit ihre Woerter aus);
 *  - `tippKnopf`, `zeile`: Knopf an Zeiger statt `click`, Text nur bei Aenderung.
 *
 * Der Dateiname bleibt, damit die Importe stehen bleiben koennen.
 */
import type { AxisId, ControlConfig, ControlFunction } from "../core/controlConfig";
import { sprache, type Sprache } from "../challenges/texte";
import { wort } from "./aufgabentexte";

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

/** SW: Patrick 20.10.2026, Entscheidung A „klappt nach 5 s auf die Kopfzeile zusammen" (E-164). */
export const ZUKLAPPEN_S = 5;

/**
 * AUF ODER ZU (E-164) — ohne DOM, damit es pruefbar ist.
 *
 * Auf kleinen Bildschirmen (`auto`, Telefon quer) zeigt die Karte jeden
 * neuen Schritt, jeden neuen Tipp und das Erscheinen von PRESSEN voll und
 * klappt nach `ZUKLAPPEN_S` von selbst auf ihren Kopf zusammen. Ein Tipp auf
 * den Klappknopf dreht um; aufgetippt gilt dieselbe Frist — der Daumen soll
 * zurueck an den Stick, nicht ein zweites Mal zur Karte.
 *
 * Die Zeit ist die Aufgabenuhr (`challenge:stand.zeitS`): Sie steht in der
 * Spielpause, und dann laeuft auch die Lesezeit nicht ab — wer aus dem Menue
 * zurueckkommt, sieht die Karte so, wie er sie verlassen hat.
 *
 * Ohne `auto` (iPad, Telefon hoch) bleibt es beim Knopf wie bisher: nur er
 * klappt, sonst nichts.
 */
export class Klappe {
  zu = false;
  private t = 0;
  private bis: number;
  /** `frist`: Sekunden offen — Karte `ZUKLAPPEN_S`, Zielzeile `WOERTER_S` (41-P2) */
  constructor(
    private readonly auto: () => boolean,
    private readonly frist = ZUKLAPPEN_S
  ) {
    this.bis = frist;
  }

  /** Neue Aufgabe oder ↻: Uhr von vorn, Karte auf. */
  neustart(): void {
    this.t = 0;
    this.zu = false;
    this.bis = this.frist;
  }

  /** Neuer Schritt, neuer Tipp, PRESSEN erscheint. */
  zeige(): void {
    if (!this.auto()) return;
    this.zu = false;
    this.bis = this.t + this.frist;
  }

  /** Der Klappknopf. */
  tippe(): void {
    if (!this.zu) this.zu = true;
    else {
      this.zu = false;
      this.bis = this.t + this.frist;
    }
  }

  /** Aufgabenuhr in Sekunden. */
  zeit(t: number): void {
    this.t = t;
    if (this.auto() && !this.zu && t >= this.bis) this.zu = true;
  }
}

/** Einen Knopf an Zeiger statt an `click` haengen (Begruendung im Rumpf). */
export function tippKnopf(el: HTMLElement, tu: () => void): void {
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
export function zeile(el: HTMLElement, leerVersteckt = true): (text: string) => void {
  let alt: string | null = null;
  return (text) => {
    if (text === alt) return;
    alt = text;
    el.textContent = text;
    if (leerVersteckt) el.hidden = text === "";
  };
}
