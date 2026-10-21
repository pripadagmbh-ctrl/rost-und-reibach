/**
 * DIE WIEDERGABE EINER VORFÜHRUNG (E-196, Patrick 21.10.2026: „Vorführung im
 * Spiel statt Video").
 *
 * Spielt eine Eingabe-Spur (`core/spur.ts`) über DENSELBEN Eingabeweg ab, den
 * der Spieler benutzt: Achsenwerte in `touch.axes`, Tastendrücke als einmaliger
 * Druck in `Input` (wie eine echte Taste), Kamera-Gesten in
 * `Input.orbitDX/DY`, `zoomFactor`, `camReset` (wie der Mittelstreifen).
 * Spinne, Pendel und Kamera rechnen danach wie beim Spieler (Regel 2) — hier
 * wird nichts an der Maschine gesetzt.
 *
 * Zeit = Physikzeit (L2b): `schritt(FIXED_DT)` vor jedem Physikschritt legt
 * die Achsen an, `takt(frameDt)` einmal je Bild gibt Tasten und Kamera-Gesten
 * weiter und prüft den Eingriff. In der Pause ruft main.ts keins von beiden.
 *
 * Der Spieler greift ein → Abbruch. Begründung: Wer während der Vorführung
 * einen Daumen aufsetzt, will selbst ran. Würde die Berührung nur ignoriert,
 * wären die Sticks für ein paar Sekunden tot — genau das Gefühl „Steuerung
 * kaputt", das der Lehrgang verhindern soll. Gezählt wird das AUFSETZEN
 * (Flanke): Ein Daumen, der schon lag, als die Vorführung begann, bricht
 * nichts ab, bis er einmal gehoben wurde. Solange er liegt, überschreibt die
 * Spur seine Werte.
 *
 * Deterministisch und ohne DOM: `spurWerte`, `kameraZwischen` sind rein.
 */
import type { EventBus } from "./events";
import { spurDauer, type Spur, type SpurAbschnitt, type SpurAchse } from "./spur";
import type { KameraEingabe } from "./touch";

export const SPUR_ACHSEN: readonly SpurAchse[] = ["cab", "boom", "stick", "grapple", "rotator", "drive", "steer"];

/** Pseudo-Code für den Doppeltipp im Mittelstreifen (`kamera.zuruecksetzen`) in `gedrueckt`. */
export const KAMERA_ZURUECK = "camReset";

export interface SpurWerte {
  /** Was die Spur zur Zeit t an den Sticks anlegt (−1 … +1, fehlende = 0) */
  achsen: Record<SpurAchse, number>;
  /** Kamera-Gesten des laufenden Abschnitts (je Sekunde), sonst null */
  kamera: SpurAbschnitt["kamera"] | null;
  /** Index des laufenden Abschnitts; −1 nach dem Ende */
  abschnitt: number;
}

/**
 * Gleitkomma-Rest: 90 × (1/60) ist nicht genau 1,5. Ohne den Zuschlag fiele
 * ein Schritt mal in den alten, mal in den neuen Abschnitt; 1 µs ist weit
 * unter einem Schritt (16,7 ms) und weit über dem Rundungsfehler (~1e-15).
 */
const ZEIT_EPS = 1e-6;

const clamp1 = (v: number): number => Math.max(-1, Math.min(1, v));

function nullAchsen(): Record<SpurAchse, number> {
  return { cab: 0, boom: 0, stick: 0, grapple: 0, rotator: 0, drive: 0, steer: 0 };
}

/** Beginn jedes Abschnitts (s). */
function anfaenge(spur: Spur): number[] {
  let t = 0;
  return spur.map((a) => {
    const s = t;
    t += Math.max(0, a.dauerS);
    return s;
  });
}

/**
 * Die Werte der Spur zur Zeit t. Abschnitt i gilt für [Beginn, Beginn + Dauer);
 * Abschnitte der Dauer 0 tragen nur Tasten und sind nie „laufend".
 */
export function spurWerte(spur: Spur, t: number): SpurWerte {
  const an = anfaenge(spur);
  for (let i = 0; i < spur.length; i++) {
    const a = spur[i]!;
    if (t >= an[i]! && t < an[i]! + a.dauerS) {
      const achsen = nullAchsen();
      for (const k of SPUR_ACHSEN) achsen[k] = clamp1(a.achsen?.[k] ?? 0);
      return { achsen, kamera: a.kamera ?? null, abschnitt: i };
    }
  }
  return { achsen: nullAchsen(), kamera: null, abschnitt: -1 };
}

/**
 * Kamera-Gesten zwischen t0 und t1, Abschnitt für Abschnitt aufsummiert —
 * ein langes Bild über eine Abschnittsgrenze rechnet genau. Zoom ist ein
 * Faktor je Sekunde, also Potenz der Dauer.
 */
export function kameraZwischen(spur: Spur, t0: number, t1: number): { dx: number; dy: number; zoom: number } {
  const an = anfaenge(spur);
  let dx = 0;
  let dy = 0;
  let zoom = 1;
  spur.forEach((a, i) => {
    const k = a.kamera;
    if (!k) return;
    const l = Math.min(t1, an[i]! + a.dauerS) - Math.max(t0, an[i]!);
    if (l <= 0) return;
    dx += (k.gierProS ?? 0) * l;
    dy += (k.nickProS ?? 0) * l;
    if (k.zoomProS !== undefined && k.zoomProS > 0) zoom *= Math.pow(k.zoomProS, l);
  });
  return { dx, dy, zoom };
}

/** Wohin die Wiedergabe schreibt — dieselben Stellen, die der Spieler beschreibt. */
export interface WiedergabeZiel {
  /** `touch.axes` */
  achsen: Record<SpurAchse, number> & { grab: boolean };
  /** `input` (orbitDX/DY, zoomFactor, camReset) */
  kamera: KameraEingabe;
  /** Einmaliger Tastendruck: `input.drueckeVirtuell(code)` */
  druecke(code: string): void;
  /** Greift der Spieler gerade ein? `touch.daumenAuf || input.aktiv` */
  eingriff(): boolean;
}

export class Wiedergabe {
  private spur: Spur | null = null;
  private t = 0;
  private dauer = 0;
  private naechster = 0;
  /** Bis hierher hat die Kamera ihre Gesten bekommen (Spurzeit) */
  private tKamera = 0;
  private anfang: number[] = [];
  private eingriffVorher = false;
  /** Werte des laufenden Bilds (für den Geisterdaumen); null = keine Vorführung */
  werte: SpurWerte | null = null;
  /** Zuletzt gedrückte Tasten und wie lange das her ist (s) — für das Aufleuchten im Bild */
  gedrueckt: { codes: string[]; seitS: number } | null = null;

  constructor(
    private readonly bus: EventBus,
    private readonly ziel: WiedergabeZiel
  ) {
    bus.on("lehrgang:vorfuehren", (e) => this.starte(e.spur));
    bus.on("lehrgang:abbrechen", () => this.ende(true));
    // Neustart der Lektion oder geschafft: still beenden, kein „Ende" an den Lauf
    bus.on("lehrgang:start", () => this.stoppe());
    bus.on("lehrgang:geschafft", () => this.stoppe());
  }

  get laeuft(): boolean {
    return this.spur !== null;
  }

  private starte(spur: Spur): void {
    this.spur = spur;
    this.t = 0;
    this.dauer = spurDauer(spur);
    this.naechster = 0;
    this.tKamera = 0;
    this.anfang = anfaenge(spur);
    this.eingriffVorher = this.ziel.eingriff();
    this.gedrueckt = null;
    this.werte = spurWerte(spur, 0);
  }

  /**
   * Vor JEDEM Physikschritt mit dessen Schrittweite (`FIXED_DT`): schiebt die
   * Spurzeit vor und legt die Achsen an, die für diesen Schritt gelten. So
   * bekommt jeder Abschnitt genau so viele Schritte, wie er lang ist — egal,
   * wie die Bilder fallen und ob main.ts Zeit verwirft (L2b, qa 21.10.2026:
   * bei 3–15 fps endete der Drehkranz bis 13° neben der Startlage).
   */
  schritt(dt: number): void {
    const spur = this.spur;
    if (!spur) return;
    // Nach dem Ende liefert spurWerte Nullen; das Ende meldet erst `takt` (einmal je Bild)
    const w = spurWerte(spur, this.t + ZEIT_EPS);
    for (const a of SPUR_ACHSEN) this.ziel.achsen[a] = w.achsen[a];
    this.ziel.achsen.grab = false;
    this.werte = w;
    this.t += Math.max(0, dt);
  }

  /**
   * Einmal je Bild, außerhalb der Pause; NACH `touch.update`, VOR den
   * Tastenabfragen und dem ersten Physikschritt. Gibt weiter, was die Physik
   * seit dem letzten Bild fällig gemacht hat: Tasten, deren Abschnitt begann
   * (also höchstens ein Bild später, nie verloren — `input.endFrame` räumt erst
   * am Bildende), und die Kamera-Gesten dieser Spurzeit. `dt` (Bildzeit) zählt
   * nur das Aufleuchten im Bild.
   */
  takt(dt: number): void {
    const spur = this.spur;
    if (!spur) return;
    const ein = this.ziel.eingriff();
    if (ein && !this.eingriffVorher) {
      this.ende(true);
      return;
    }
    this.eingriffVorher = ein;
    if (this.gedrueckt) this.gedrueckt.seitS += dt;

    // Tasten: genau einmal je Abschnitt, sobald die Physik seinen Beginn erreicht hat
    while (this.naechster < spur.length && this.anfang[this.naechster]! <= this.t + ZEIT_EPS) {
      const a = spur[this.naechster]!;
      const codes = [...(a.tasten ?? [])];
      for (const c of codes) this.ziel.druecke(c);
      if (a.kamera?.zuruecksetzen) {
        this.ziel.kamera.camReset = true;
        codes.push(KAMERA_ZURUECK);
      }
      if (codes.length) this.gedrueckt = { codes, seitS: 0 };
      this.naechster++;
    }
    /*
     * Kamera: ÜBERSCHREIBEN statt addieren (qa-Befund 3). Ein Finger, der
     * schon lag, als die Vorführung begann, bricht nicht ab (siehe oben) —
     * wischt er weiter, darf er die Spur nicht verdrehen, sonst endet sie
     * nicht in der Startlage. Wie bei den Achsen: Die Spur gewinnt.
     */
    const bis = Math.min(this.t, this.dauer);
    const k = kameraZwischen(spur, this.tKamera, bis);
    this.tKamera = bis;
    this.ziel.kamera.orbitDX = k.dx;
    this.ziel.kamera.orbitDY = k.dy;
    this.ziel.kamera.zoomFactor = k.zoom;

    if (this.t + ZEIT_EPS >= this.dauer) this.ende(false);
  }

  /** Achsen auf 0, ohne Meldung. */
  private stoppe(): boolean {
    if (!this.spur) return false;
    this.spur = null;
    this.werte = null;
    this.gedrueckt = null;
    for (const a of SPUR_ACHSEN) this.ziel.achsen[a] = 0;
    this.ziel.achsen.grab = false;
    return true;
  }

  private ende(abgebrochen: boolean): void {
    // Erst aufräumen, dann melden: Der Lauf darf im Zuhörer gleich die nächste Spur schicken
    if (this.stoppe()) this.bus.emit("lehrgang:vorfuehrungEnde", { abgebrochen });
  }
}
