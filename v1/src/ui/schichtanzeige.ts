/**
 * DIE SCHICHT-ANZEIGE (E-205) — Uhr, Kasse, Warteschlange, Verlader, Boxen.
 *
 * Haengt NUR an den Ereignissen `schicht:*` (Projektregel 10). Vergleich: das
 * Armaturenbrett eines Lasters — es misst nichts selbst, es zeigt, was die
 * Fuehler melden. Gemeldet wird viermal je Sekunde (`schicht:stand`); die
 * Kasse laeuft dazwischen weich hinterher wie das Konto im Betrieb
 * (`hud.updateMoney`).
 *
 * Ersetzt die Notanzeige `hud.updateSchicht` (die Methode bleibt, wird in der
 * Schicht aber nicht mehr gerufen).
 *
 * WO SIE STEHT (index.html `#schichtanzeige`): oben links, ganz im linken
 * Drittel — also nicht im Kamera-Mittelstreifen (E-136), weit weg vom
 * Funktionskranz (rechter Daumen) und ueber der Ruhelage des linken Daumens
 * und den Pedalen. Nachgerechnet in `test/schichtanzeige.test.ts`.
 *
 * Aufbau in zwei Teilen: `SchichtAnzeige` haelt das Bild als reine Daten
 * (pruefbar ohne Browser), `installSchichtAnzeige` malt es in die Seite.
 */
import type { EventBus, GameEvents } from "../core/events";
import { sprache, type Sprache } from "../challenges/texte";
import { uhr } from "./aufgabentexte";
import { euro, schichtWort, sorte, tonnenZahl } from "./schichttexte";

type Stand = GameEvents["schicht:stand"];
type Buchungsart = GameEvents["schicht:buchung"]["art"];

/** Ein Balken: Name links, Fuellung 0..1, Zahl oder Wort rechts (nie nur die Farbe, Kap. 20). */
export interface Balken {
  name: string;
  anteil: number;
  wert: string;
  voll: boolean;
}

export interface AnzeigeBild {
  sichtbar: boolean;
  uhr: string;
  kasse: string;
  /** Kurze Einblendung der letzten Buchung, null = keine */
  buchung: { text: string; minus: boolean } | null;
  /** „! …", wenn Fuhren warten oder die Annahme voll ist; sonst null */
  warn: string | null;
  verlader: Balken;
  boxen: Balken[];
}

/** So lange steht eine Buchung im Bild — wie `hud.toast` (2,6 s). */
export const BUCHUNG_MS = 2600;
/**
 * Zeitkonstante des Kassen-Tickers. `hud.updateMoney` rueckt je Bild 12 % nach;
 * bei 60 Bildern je Sekunde ist das τ = −1 / (60 · ln 0,88) ≈ 0,13 s. Hier
 * bildratenunabhaengig, damit ein iPhone mit 30 Bildern genauso tickt.
 */
export const TICKER_TAU_S = 0.13;

/** Ein Schritt des weichen Kassen-Tickers; rastet unter 0,5 € ein (wie updateMoney). */
export function tickerSchritt(angezeigt: number, ziel: number, dtS: number): number {
  const neu = angezeigt + (ziel - angezeigt) * (1 - Math.exp(-Math.max(0, dtS) / TICKER_TAU_S));
  return Math.abs(neu - ziel) < 0.5 ? ziel : neu;
}

/** „06:42 · noch 9:18", nach Torschluss „15:12 · Tor zu · 0:48". */
export function uhrZeile(st: Pick<Stand, "uhr" | "restS" | "torZu">, s: Sprache): string {
  const rest = uhr(Math.ceil(Math.max(0, st.restS)));
  if (st.torZu) return `${st.uhr} · ${schichtWort("torZu", s)} · ${rest}`;
  return `${st.uhr} · ${schichtWort("noch", s).replace("{r}", rest)}`;
}

/** Die Warnzeile — Zeichen „!" UND Wort, Farbe nur zur Bestaetigung. */
export function warnZeile(wartend: number, annahmeVoll: boolean, s: Sprache): string | null {
  const n = Math.max(0, Math.round(wartend));
  if (annahmeVoll && n > 0) return `! ${schichtWort("annahmeVoll", s)} · ${schichtWort("warteKurz", s).replace("{n}", String(n))}`;
  if (annahmeVoll) return `! ${schichtWort("annahmeVoll", s)}`;
  if (n === 1) return `! ${schichtWort("warteEine", s)}`;
  if (n > 1) return `! ${schichtWort("warteViele", s).replace("{n}", String(n))}`;
  return null;
}

const anteil01 = (x: number): number => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);
/** Schwelle ohne „,0": 6 000 kg → „6", 1 500 kg → „1,5". */
const schwelleT = (kg: number, s: Sprache): string => tonnenZahl(kg / 1000, s).replace(/[.,]0$/, "");

export function verladerBalken(v: Stand["verlader"], s: Sprache): Balken {
  const name = schichtWort("verlader", s);
  if (!v) return { name, anteil: 0, wert: schichtWort("verladerKommt", s), voll: false };
  const a = anteil01(v.anteil);
  return { name, anteil: a, wert: `${sorte(v.order, s)} ${Math.round(a * 100)} %`, voll: a >= 1 };
}

export function boxBalken(b: Stand["boxen"][number], s: Sprache): Balken {
  const voll = b.schwelleKg > 0 && b.kg >= b.schwelleKg; // ohne Schwelle (vor dem ersten Stand) nie „voll"
  return {
    name: sorte(b.order, s),
    anteil: b.schwelleKg > 0 ? anteil01(b.kg / b.schwelleKg) : 0,
    wert: voll ? schichtWort("abholerKommt", s) : `${tonnenZahl(b.kg / 1000, s)}/${schwelleT(b.schwelleKg, s)} t`,
    voll,
  };
}

/** „+1.240 € Mischschrott", „−25 € Fehlwurf", „−12 € Standgeld", „−50 € Schaden". */
export function buchungText(art: Buchungsart, eur: number, order: string | null | undefined, s: Sprache): string {
  const was = art === "abfahrt" ? sorte(order, s, true) : schichtWort(art, s);
  return `${euro(eur, s, true)} ${was}`;
}

/** Leere Boxen in der Reihenfolge des Platzes — bis der erste Stand kommt. */
const OHNE_STAND: Stand["boxen"] = [
  { order: "steel", kg: 0, schwelleKg: 0 },
  { order: "copper", kg: 0, schwelleKg: 0 },
  { order: "rubble", kg: 0, schwelleKg: 0 },
];

/** Das Bild der Anzeige als Daten — haengt am Bus, malt nichts. */
export class SchichtAnzeige {
  bild: AnzeigeBild;
  private stand: Stand | null = null;
  private kasseZiel = 0;
  private kasseAngezeigt = 0;
  /**
   * Buchungen der Reihe nach, je 2,6 s: Eine Abfahrt mit Fehlwurf meldet zwei
   * Zeilen im selben Augenblick (E-204) — der Spieler soll beide lesen, nicht
   * nur die letzte. Die erste steht im Bild (`bisMs` gesetzt), der Rest wartet.
   */
  private flashes: Array<{ art: Buchungsart; order: string | null; eur: number; bisMs: number }> = [];
  private get flash(): (typeof this.flashes)[number] | null {
    return this.flashes[0] ?? null;
  }

  constructor(
    bus: EventBus,
    private jetztMs: () => number = () => Date.now(),
    private s: () => Sprache = sprache
  ) {
    this.bild = this.male(false);
    bus.on("schicht:start", () => {
      this.stand = null;
      this.kasseZiel = this.kasseAngezeigt = 0;
      this.flashes = [];
      this.bild = this.male(true);
    });
    bus.on("schicht:stand", (st) => {
      this.stand = st;
      this.kasseZiel = st.kasseEur;
      this.bild = this.male(true);
    });
    bus.on("schicht:buchung", (b) => {
      const order = b.order ?? null;
      const t = this.jetztMs();
      const letzte = this.flashes[this.flashes.length - 1];
      // Dieselbe Art kurz hintereinander zaehlt in derselben Zeile weiter, statt zu flackern
      if (letzte && letzte.art === b.art && letzte.order === order) {
        letzte.eur += b.eur;
        if (letzte === this.flash) letzte.bisMs = t + BUCHUNG_MS;
      } else {
        // ponytail: hoechstens drei warten; was aelter ist, faellt heraus (die Kasse zaehlt es trotzdem)
        this.flashes.push({ art: b.art, order, eur: b.eur, bisMs: this.flashes.length ? 0 : t + BUCHUNG_MS });
        if (this.flashes.length > 4) this.flashes.splice(1, 1);
      }
      this.bild = this.male(this.bild.sichtbar);
    });
  }

  /** Je Bild: Kasse nachziehen, abgelaufene Buchung entfernen. true = etwas hat sich geaendert. */
  takt(dtS: number): boolean {
    if (!this.bild.sichtbar) return false;
    const alt = this.kasseAngezeigt;
    this.kasseAngezeigt = tickerSchritt(alt, this.kasseZiel, dtS);
    const jetzt = this.jetztMs();
    const abgelaufen = this.flash !== null && this.flash.bisMs <= jetzt;
    if (abgelaufen) {
      this.flashes.shift();
      if (this.flash) this.flash.bisMs = jetzt + BUCHUNG_MS;
    }
    if (!abgelaufen && Math.round(alt) === Math.round(this.kasseAngezeigt)) return false;
    this.bild = this.male(true);
    return true;
  }

  private male(sichtbar: boolean): AnzeigeBild {
    const s = this.s();
    const st = this.stand;
    const f = this.flash;
    return {
      sichtbar,
      uhr: st ? uhrZeile(st, s) : "06:00",
      kasse: `${schichtWort("kasse", s)} ${euro(this.kasseAngezeigt, s)}`,
      buchung: f ? { text: buchungText(f.art, f.eur, f.order, s), minus: f.eur < 0 } : null,
      warn: st ? warnZeile(st.wartend, st.annahmeVoll, s) : null,
      verlader: verladerBalken(st ? st.verlader : null, s),
      boxen: (st ? st.boxen : OHNE_STAND).map((b) => boxBalken(b, s)),
    };
  }
}

/* ------------------------------------------------------------------ Seite */

const neu = (tag: string, klasse: string, eltern: HTMLElement): HTMLElement => {
  const e = document.createElement(tag);
  e.className = klasse;
  eltern.append(e);
  return e;
};
/** Nur schreiben, was sich geaendert hat — die Anzeige laeuft je Bild. */
const text = (e: HTMLElement, t: string): void => {
  if (e.textContent !== t) e.textContent = t;
};

function balkenZeile(eltern: HTMLElement): (b: Balken) => void {
  const zeile = neu("div", "sa-balken", eltern);
  const name = neu("span", "name", zeile);
  const bahn = neu("span", "bahn", zeile);
  const fuellung = neu("i", "", bahn);
  const wert = neu("span", "wert", zeile);
  return (b) => {
    text(name, b.name);
    text(wert, b.wert);
    const w = `${Math.round(b.anteil * 100)}%`;
    if (fuellung.style.width !== w) fuellung.style.width = w;
    zeile.classList.toggle("voll", b.voll);
  };
}

/** Anzeige in `#schichtanzeige` (index.html) anschliessen. Ohne Seite (Vitest) nur das Datenbild. */
export function installSchichtAnzeige(bus: EventBus): SchichtAnzeige {
  const a = new SchichtAnzeige(bus);
  const el = typeof document === "undefined" ? null : document.getElementById("schichtanzeige");
  if (!el) return a;
  el.replaceChildren();
  const uhrEl = neu("div", "uhr", el);
  const kasseEl = neu("div", "kasse", el);
  const buchungEl = neu("div", "buchung", el);
  const warnEl = neu("div", "warn", el);
  const verlader = balkenZeile(el);
  const boxen = [balkenZeile(el), balkenZeile(el), balkenZeile(el)];

  const male = (): void => {
    const b = a.bild;
    el.hidden = !b.sichtbar;
    text(uhrEl, b.uhr);
    text(kasseEl, b.kasse);
    buchungEl.hidden = !b.buchung;
    text(buchungEl, b.buchung?.text ?? "");
    buchungEl.classList.toggle("minus", !!b.buchung?.minus);
    warnEl.hidden = !b.warn;
    text(warnEl, b.warn ?? "");
    verlader(b.verlader);
    b.boxen.forEach((x, i) => boxen[i]?.(x));
  };

  let letztes = 0;
  const bild = (t: number): void => {
    if (a.takt(letztes ? (t - letztes) / 1000 : 0)) male();
    letztes = t;
    if (a.bild.sichtbar) requestAnimationFrame(bild);
  };
  for (const e of ["schicht:stand", "schicht:buchung"] as const) bus.on(e, male);
  bus.on("schicht:start", () => {
    male();
    letztes = 0;
    requestAnimationFrame(bild);
  });
  // Feierabend: die Tafel deckt ab; die Anzeige bleibt dahinter stehen, wie sie war
  male();
  return a;
}
