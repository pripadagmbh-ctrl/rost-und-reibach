import type { EventBus, GameEvents } from "../core/events";
import type { Spur } from "../core/spur";
import type { ViewMode } from "../excavator/orbitCamera";
import type { ChallengeAufbau } from "./challenge";
import type { Zweisprachig } from "./texte";

/**
 * DER LEHRGANG — EINE LEKTION UND IHR LAUF (E-196, Patrick 21.10.2026:
 * „ein ausfuehrliches Intro zu allen Funktionalitaeten … genau so bauen wir
 * die ersten Challenges auf").
 *
 * Eine Lektion ist DATEN (`lehrgang.ts`). Jeder Schritt hat zwei Phasen:
 *   "zeigen"  der Bagger macht es vor — der Lauf schickt die Eingabe-Spur
 *             (`lehrgang:vorfuehren`), die Wiedergabe spielt sie ueber den
 *             Eingabeweg des Spielers ab und meldet `lehrgang:vorfuehrungEnde`;
 *   "du"      der Spieler macht es nach. Gemessen wird ab Beginn SEINER Phase
 *             (Ausgangswerte), die Vorfuehrung zaehlt also nie mit.
 * Ist das Ziel gesehen: `lehrgang:haekchen`, kurze Pause, naechster Schritt;
 * nach dem letzten `lehrgang:geschafft`.
 *
 * NUR BEOBACHTEN wie `ChallengeLauf` (Regel 2): Nichts hier bewegt den
 * Bagger oder die Kamera. Die Zeit laeuft nur in `takt` — in der Spielpause
 * steht sie.
 */

/** Was der Lauf vom Spiel liest — verdrahtet in `quellen.ts` (`lektionQuellen`). */
export interface LektionZustand {
  /** Drehkranz (rad), steigt nach links (`cab+`) */
  cabYaw: number;
  /** Hauptarm (rad), steigt beim Heben (`boom+`) */
  boom: number;
  /** Ausleger/Stiel (rad), steigt beim Ausfahren (`stick+`) */
  stick: number;
  /** Spinne 0 offen … 1 zu */
  closure: number;
  /** Rotator (rad) */
  rotator: number;
  /** Drehmitte (m) und Fahrtrichtung des Unterwagens (rad, 0 = +z) */
  x: number;
  z: number;
  heading: number;
  abgestuetzt: boolean;
  /** Sensorpunkt der Spinne (m) */
  spinne: { x: number; y: number; z: number };
  kamera: { modus: ViewMode; gier: number; nick: number; abstand: number };
}

export interface LektionQuellen {
  zustand(): LektionZustand;
}

/**
 * Messgroessen fuer `aenderung` — je Groesse die Einheit von `ab`:
 *   cabYaw, boom, stick, rotator, kameraGier, kameraNick   rad
 *   closure                                                 0 … 1
 *   zoom      relativ: Abstand / Abstand bei Beginn − 1 (plus = weiter weg)
 *   fahrt     m, laengs zum Unterwagen aufsummiert (plus = vorwaerts)
 */
export type Groesse = "cabYaw" | "boom" | "stick" | "rotator" | "closure" | "kameraGier" | "kameraNick" | "zoom" | "fahrt";

/**
 * Was der Spieler in Phase "du" zeigen muss.
 *
 * Etappe 2 (weltbezogen: gegriffen, gepresst …) kommt als weitere Zeile
 * `{ art: "welt"; beobachtet: Beobachtung }` dazu und liest die Beobachtungen
 * aus `challenge.ts` — die Quellen dann wie `ChallengeQuellen`.
 */
export type LektionZiel =
  /** um mindestens `ab` geaendert (in `richtung` des Befehls, "beide" = Betrag) */
  | { art: "aenderung"; groesse: Groesse; richtung: "plus" | "minus" | "beide"; ab: number }
  /** Ansicht: "gewechselt" = eine andere als bei Beginn, sonst genau diese */
  | { art: "ansicht"; modus: ViewMode | "gewechselt" }
  /** Kamera war verstellt und steht wieder auf dem Startpunkt der Aussenansicht (Doppeltipp) */
  | { art: "kameraStart" }
  /**
   * Spinne waagrecht ueber eine Bodenmarke. Die Marke entsteht beim Beginn
   * des Schritts `radialM` von der Spinne entfernt, laengs zum Oberwagen
   * (minus = zum Bagger hin), dann `schwenkRad` um die Drehmitte gedreht
   * (plus wie `cab+`) — so trifft die Vorfuehrung sie aus jeder
   * Armstellung. `lauf.marke` sagt, wo sie liegt.
   */
  | { art: "marke"; radialM: number; schwenkRad?: number; radiusM: number };

export interface LektionSchritt {
  titel: Zweisprachig;
  /** Bedienzeile, Platzhalter wie bei Aufgaben (`{cab+}` …, `ui/challengekarte.ts`) */
  text: Zweisprachig;
  zeige: GameEvents["lehrgang:schritt"]["zeige"];
  /** null = ohne Vorfuehrung, gleich "du" */
  vorfuehrung: Spur | null;
  ziel: LektionZiel;
}

export interface LektionDaten {
  id: string;
  name: Zweisprachig;
  ziel: Zweisprachig;
  beschreibung: Zweisprachig;
  /** Wie bei Aufgaben — erst fuer spaetere Lektionen (Greifen, Presse …) */
  aufbau?: ChallengeAufbau;
  schritte: readonly LektionSchritt[];
}

/** So lange steht das Haekchen, bevor der naechste Schritt kommt. // SW: 0,8 s — lang genug zum Sehen, kurz genug, dass keiner wartet */
export const HAEKCHEN_PAUSE_S = 0.8;

/**
 * Startpunkt der Aussenansicht — abgeschrieben aus `orbitCamera.ts`
 * (`START.orbit`, dort nicht exportiert). Waechter: der Kopflos-Durchlauf in
 * `test/lehrgang.test.ts` mit der echten Kamera — aendert sich der Start,
 * wird die Lektion 1 dort nicht mehr geschafft.
 */
export const ORBIT_START = { gier: Math.PI, nick: 0.42, abstand: 11 };
/** Toleranz „steht auf dem Startpunkt". // SW: 0,5° und 1 % — Doppeltipp trifft ihn exakt, ein Ziehen von Hand nie */
const START_TOL_RAD = (0.5 * Math.PI) / 180;
const START_TOL_REL = 0.01;

type Phase = "zeigen" | "du" | "pause";

export class LektionLauf {
  zeitS = 0;
  geschafft = false;
  /** Index des laufenden Schritts */
  schritt = 0;
  phase: Phase | null = null;
  private aus = false;
  private basis: LektionZustand | null = null;
  private fahrt = 0;
  private letzt = { x: 0, z: 0 };
  private kameraWeg = false;
  private pauseS = 0;
  private markeOrt: { x: number; y: number; z: number; radiusM: number } | null = null;

  constructor(
    readonly daten: LektionDaten,
    /** Stelle im Lehrgang, ab 1 */
    readonly nr: number,
    /** Lektionen im Lehrgang */
    readonly von: number,
    private q: LektionQuellen,
    private bus: EventBus
  ) {
    bus.on("lehrgang:vorfuehrungEnde", () => {
      if (!this.aus && this.phase === "zeigen") this.du();
    });
  }

  start(): void {
    if (this.phase !== null || this.aus) return;
    const d = this.daten;
    this.bus.emit("lehrgang:start", { id: d.id, nr: this.nr, von: this.von, name: d.name, ziel: d.ziel });
    this.beginne(0);
  }

  /** Nach ↻ oder Verlassen: ab jetzt stumm. */
  beenden(): void {
    this.aus = true;
  }

  get beendet(): boolean {
    return this.aus;
  }

  /** Wo die Bodenmarke des laufenden Schritts liegt (Ziel `marke`), sonst null. */
  get marke(): { x: number; y: number; z: number; radiusM: number } | null {
    return this.markeOrt;
  }

  /** Einmal je Bild, ausserhalb der Pause. */
  takt(dt: number): void {
    if (this.phase === null || this.aus || this.geschafft) return;
    this.zeitS += dt;
    if (this.phase === "pause") {
      this.pauseS -= dt;
      if (this.pauseS <= 0) this.beginne(this.schritt + 1);
      return;
    }
    if (this.phase !== "du") return;
    const z = this.q.zustand();
    // Laengs zum Unterwagen aufsummiert: vor und zurueck heben sich auf, Lenken nicht
    this.fahrt += (z.x - this.letzt.x) * Math.sin(z.heading) + (z.z - this.letzt.z) * Math.cos(z.heading);
    this.letzt = { x: z.x, z: z.z };
    if (!amStart(z.kamera)) this.kameraWeg = true;
    if (!this.erreicht(z)) return;
    this.bus.emit("lehrgang:haekchen", { id: this.daten.id, nr: this.schritt + 1 });
    this.phase = "pause";
    this.pauseS = HAEKCHEN_PAUSE_S;
  }

  private beginne(i: number): void {
    const d = this.daten;
    this.schritt = i;
    this.markeOrt = null;
    if (i >= d.schritte.length) {
      this.geschafft = true;
      this.phase = null;
      this.bus.emit("lehrgang:geschafft", { id: d.id, nr: this.nr, name: d.name, zeitS: this.zeitS });
      return;
    }
    const s = d.schritte[i]!;
    if (s.ziel.art === "marke") {
      const z = this.q.zustand();
      const b = z.heading + z.cabYaw;
      // Von der Drehmitte aus: laengs zum Oberwagen verschoben, dann geschwenkt
      const vx = z.spinne.x + Math.sin(b) * s.ziel.radialM - z.x;
      const vz = z.spinne.z + Math.cos(b) * s.ziel.radialM - z.z;
      const w = s.ziel.schwenkRad ?? 0;
      this.markeOrt = {
        x: z.x + vx * Math.cos(w) + vz * Math.sin(w),
        y: 0,
        z: z.z + vz * Math.cos(w) - vx * Math.sin(w),
        radiusM: s.ziel.radiusM,
      };
    }
    if (!s.vorfuehrung) {
      this.du();
      return;
    }
    // Phase vor dem Senden: Eine Wiedergabe, die sofort fertig meldet, landet schon in "zeigen"
    this.phase = "zeigen";
    this.melde("zeigen");
    this.bus.emit("lehrgang:vorfuehren", { spur: s.vorfuehrung });
  }

  private du(): void {
    const z = this.q.zustand();
    this.basis = z;
    this.fahrt = 0;
    this.letzt = { x: z.x, z: z.z };
    this.kameraWeg = !amStart(z.kamera);
    this.phase = "du";
    this.melde("du");
  }

  private melde(phase: "zeigen" | "du"): void {
    const d = this.daten;
    const s = d.schritte[this.schritt]!;
    this.bus.emit("lehrgang:schritt", {
      id: d.id,
      nr: this.schritt + 1,
      von: d.schritte.length,
      titel: s.titel,
      text: s.text,
      zeige: s.zeige,
      phase,
      marke: this.markeOrt, // E-196: Bodenmarke (Lektion 3), in beiden Phasen gleich
    });
  }

  private erreicht(z: LektionZustand): boolean {
    const ziel = this.daten.schritte[this.schritt]!.ziel;
    const b = this.basis!;
    switch (ziel.art) {
      case "ansicht":
        return ziel.modus === "gewechselt" ? z.kamera.modus !== b.kamera.modus : z.kamera.modus === ziel.modus;
      case "kameraStart":
        return this.kameraWeg && amStart(z.kamera);
      case "marke": {
        const m = this.markeOrt!;
        return Math.hypot(z.spinne.x - m.x, z.spinne.z - m.z) <= m.radiusM;
      }
      case "aenderung": {
        const d = aenderung(ziel.groesse, b, z, this.fahrt);
        return (ziel.richtung === "minus" ? -d : ziel.richtung === "plus" ? d : Math.abs(d)) >= ziel.ab;
      }
    }
  }
}

function aenderung(g: Groesse, b: LektionZustand, z: LektionZustand, fahrt: number): number {
  switch (g) {
    case "fahrt":
      return fahrt;
    case "zoom":
      return z.kamera.abstand / b.kamera.abstand - 1;
    case "kameraGier":
      return z.kamera.gier - b.kamera.gier;
    case "kameraNick":
      return z.kamera.nick - b.kamera.nick;
    default:
      return z[g] - b[g];
  }
}

function amStart(k: LektionZustand["kamera"]): boolean {
  let d = (k.gier - ORBIT_START.gier) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return (
    k.modus === "orbit" &&
    Math.abs(d) <= START_TOL_RAD &&
    Math.abs(k.nick - ORBIT_START.nick) <= START_TOL_RAD &&
    Math.abs(k.abstand / ORBIT_START.abstand - 1) <= START_TOL_REL
  );
}
