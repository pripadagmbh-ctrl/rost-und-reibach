import type { EventBus, GameEvents } from "../core/events";
import type { Spur, SpurAchse } from "../core/spur";
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
   * Ohne `radialM` (L3b): so weit, wie die Vorfuehrung die Spinne bis zum
   * ersten Halt traegt — auch wenn `richteSpur` den Arm umgedreht hat.
   */
  | { art: "marke"; radialM?: number; schwenkRad?: number; radiusM: number };

/**
 * Bildzeichen am Rand je Schritt (L3, Patrick 21.10.2026: „kaum oder keinen
 * Text"). Die Zeichen zeichnet ui; die Liste waechst mit Etappe 2b.
 */
export type LehrgangSymbol =
  | "kamera"
  | "ansicht"
  | "fahren"
  | "schwenken"
  | "arm"
  | "stiel"
  | "marke"
  | "stuetzen"
  | "presse"
  | "magnet"
  | "hupe";

export interface LektionSchritt {
  /** Bildzeichen am Rand (ui) */
  symbol?: LehrgangSymbol;
  /** Hoechstens EIN Wort neben dem Zeichen — nur, wo es ohne nicht geht */
  wort?: Zweisprachig;
  /** Seit L3 nur noch aria-label und Rueckfall */
  titel: Zweisprachig;
  /** Bedienzeile, Platzhalter wie bei Aufgaben (`{cab+}` …, `ui/challengekarte.ts`); seit L3 nur aria-label und Rueckfall */
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

/*
 * --- L3b: VORFUEHRUNG WEG VOM ANSCHLAG (qa 21.10.2026, Befund 3) ---
 * Stand der Hauptarm vor „Auf die Marke" bei 56,8°, lief die Vorfuehrung an
 * den 70°-Anschlag, und der Rueckweg brachte ihn 2,32° tiefer zurueck. Der
 * Spieler darf vor jedem Schritt stehen, wo er will; zuruecksetzen darf der
 * Lehrgang nichts (Regel 2). Darum richtet sich die Spur nach der Lage bei
 * Beginn: Liefe sie, wie sie geschrieben ist, an einen Anschlag, wird der Arm
 * (bzw. der Zoom) umgedreht — erst senken statt erst heben. Geschrieben sind
 * die Spuren „weg vom Boden" (erst heben, erst ausfahren); umgedreht wird
 * nur, wenn das nicht passt, und unter den passenden Umkehrungen die, bei der
 * die Stielspitze am hoechsten bleibt (Boden). Gerechnet wird nominell,
 * Befehl × Tempo × Dauer.
 *
 * Abgeschrieben (Waechter: `test/lehrgang-grenzen.test.ts` faehrt den echten
 * Bagger an die Anschlaege): `excavator.ts` BOOM_MIN/MAX, STICK_MIN/MAX,
 * BOOM_RATE, STICK_RATE, BOOM_LEN, STICK_LEN; `orbitCamera.ts` START.orbit
 * distMin/distMax.
 */
const G = Math.PI / 180;
export const GRENZEN = {
  boom: { min: 5 * G, max: 70 * G, radS: 19 * G, m: 5.2 },
  stick: { min: -140 * G, max: -25 * G, radS: 24 * G, m: 4.0 },
  abstand: { min: 3, max: 18 },
} as const;
/** SW: 1° bzw. 2 % Luft vor dem Anschlag — Anlauf und Auslauf der Rampe tragen nominell bis 0,4° mehr (Auslauf ist weicher) */
const RAND_RAD = 1 * G;
const RAND_REL = 0.02;
type Arm = "boom" | "stick";
const ARM: readonly Arm[] = ["boom", "stick"];

/** Gelenkwinkel an jedem Abschnittsende (Index 0 = Beginn), nominell */
function lagen(spur: Spur, z: Pick<LektionZustand, Arm>): Array<Record<Arm, number>> {
  const l = { boom: z.boom, stick: z.stick };
  const aus = [{ ...l }];
  for (const a of spur) {
    for (const x of ARM) l[x] += (a.achsen?.[x] ?? 0) * GRENZEN[x].radS * a.dauerS;
    aus.push({ ...l });
  }
  return aus;
}
/** Hoehe bzw. Ausladung der Stielspitze gegen den Hauptarm-Drehpunkt (m) */
const spitzeY = (l: Record<Arm, number>): number => GRENZEN.boom.m * Math.sin(l.boom) + GRENZEN.stick.m * Math.sin(l.boom + l.stick);
const spitzeR = (l: Record<Arm, number>): number => GRENZEN.boom.m * Math.cos(l.boom) + GRENZEN.stick.m * Math.cos(l.boom + l.stick);

/** Die Spur mit umgekehrten `achsen`, bei `zoom` auch umgekehrtem Zoom */
function umgekehrt(spur: Spur, achsen: readonly SpurAchse[], zoom: boolean): Spur {
  if (achsen.length === 0 && !zoom) return spur;
  return spur.map((a) => {
    const n = { ...a };
    if (a.achsen) n.achsen = Object.fromEntries(Object.entries(a.achsen).map(([k, v]) => [k, achsen.includes(k as SpurAchse) ? -(v ?? 0) : v]));
    if (zoom && a.kamera?.zoomProS) n.kamera = { ...a.kamera, zoomProS: 1 / a.kamera.zoomProS };
    return n;
  });
}

/**
 * Rein: die Spur, so gerichtet, dass sie aus der Lage `z` an keinen
 * Anschlag laeuft, und welche Achsen dafuer umgedreht sind. Passt keine
 * Umkehrung, bleibt sie, wie sie ist.
 */
export function richteSpur(spur: Spur, z: Pick<LektionZustand, Arm | "kamera">): { spur: Spur; umgedreht: Array<Arm | "zoom"> } {
  // Zoom: Abstand an jedem Abschnittsende; wer schon am Anschlag steht, darf dort bleiben
  let f = 1;
  const faktoren = [1, ...spur.map((a) => (f *= Math.pow(a.kamera?.zoomProS ?? 1, a.dauerS)))];
  const d = z.kamera.abstand;
  const A = GRENZEN.abstand;
  const zoomPasst = (fs: number[]): boolean =>
    fs.every((x) => d * x >= Math.min(A.min * (1 + RAND_REL), d) && d * x <= Math.max(A.max * (1 - RAND_REL), d));
  const zoom = !zoomPasst(faktoren) && zoomPasst(faktoren.map((x) => 1 / x));
  // Arm: wie geschrieben, ganz umgedreht, je eine Achse umgedreht
  const da = ARM.filter((x) => spur.some((a) => a.achsen?.[x]));
  const kandidaten: Arm[][] = [[], ...(da.length > 0 ? [da] : []), ...(da.length > 1 ? da.map((x) => [x]) : [])];
  const bewertet = kandidaten.map((k) => {
    const ls = lagen(umgekehrt(spur, k, false), z);
    const passt = ls.every((l) => ARM.every((x) => l[x] >= Math.min(GRENZEN[x].min + RAND_RAD, z[x]) && l[x] <= Math.max(GRENZEN[x].max - RAND_RAD, z[x])));
    return { k, passt, tiefste: Math.min(...ls.map(spitzeY)) };
  });
  const wahl = bewertet[0]!.passt ? bewertet[0]! : (bewertet.filter((b) => b.passt).sort((a, b) => b.tiefste - a.tiefste)[0] ?? bewertet[0]!);
  return { spur: umgekehrt(spur, wahl.k, zoom), umgedreht: zoom ? [...wahl.k, "zoom"] : wahl.k };
}

/** Rein: wie weit die Spur die Stielspitze bis zum ersten Halt (Abschnitt ohne Achsen) hinausschiebt (+) bzw. heranholt (−), m */
export function ausladungBisHalt(spur: Spur, z: Pick<LektionZustand, Arm>): number {
  const i = spur.findIndex((a, j) => j > 0 && !a.achsen);
  const ls = lagen(spur, z);
  return spitzeR(ls[i < 0 ? ls.length - 1 : i]!) - spitzeR(ls[0]!);
}

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
  /** `zeige` des laufenden Schritts, gerichtet wie seine Spur (L3b) */
  private zeige: LektionSchritt["zeige"] = null;
  /** L3b: Wendepunkte der Messgroesse seit Beginn von "du" */
  private tief = 0;
  private hoch = 0;

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

  /**
   * Beginnt bei Schritt `ab` (0-basiert, L3 Wiedereinstieg: der gespeicherte
   * `nr` aus `lehrgang:haekchen` ist genau der naechste). Jenseits des Endes
   * = gleich geschafft; Unsinn (negativ, NaN) = von vorn. Die Uhr laeuft ab hier.
   */
  start(ab = 0): void {
    if (this.phase !== null || this.aus) return;
    const d = this.daten;
    this.bus.emit("lehrgang:start", { id: d.id, nr: this.nr, von: this.von, name: d.name, ziel: d.ziel });
    this.beginne(Number.isFinite(ab) ? Math.max(0, Math.floor(ab)) : 0);
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
    const z = this.q.zustand();
    const g = s.vorfuehrung ? richteSpur(s.vorfuehrung, z) : null;
    // Der Geist zeigt die erste Bewegung der Vorfuehrung — ist sie umgedreht, er auch
    const zf = s.zeige;
    this.zeige =
      zf && zf.richtung !== "beide" && g?.umgedreht.includes(zf.fn as Arm) ? { ...zf, richtung: zf.richtung === "plus" ? "minus" : "plus" } : zf;
    if (s.ziel.art === "marke") {
      const b = z.heading + z.cabYaw;
      const radial = s.ziel.radialM ?? (g ? ausladungBisHalt(g.spur, z) : 0);
      // Von der Drehmitte aus: laengs zum Oberwagen verschoben, dann geschwenkt
      const vx = z.spinne.x + Math.sin(b) * radial - z.x;
      const vz = z.spinne.z + Math.cos(b) * radial - z.z;
      const w = s.ziel.schwenkRad ?? 0;
      this.markeOrt = {
        x: z.x + vx * Math.cos(w) + vz * Math.sin(w),
        y: 0,
        z: z.z + vz * Math.cos(w) - vx * Math.sin(w),
        radiusM: s.ziel.radiusM,
      };
    }
    if (!g) {
      this.du();
      return;
    }
    // Phase vor dem Senden: Eine Wiedergabe, die sofort fertig meldet, landet schon in "zeigen"
    this.phase = "zeigen";
    this.melde("zeigen");
    this.bus.emit("lehrgang:vorfuehren", { spur: g.spur });
  }

  private du(): void {
    const z = this.q.zustand();
    this.basis = z;
    this.fahrt = 0;
    this.letzt = { x: z.x, z: z.z };
    this.kameraWeg = !amStart(z.kamera);
    this.tief = 0;
    this.hoch = 0;
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
      zeige: this.zeige,
      phase,
      marke: this.markeOrt, // E-196: Bodenmarke (Lektion 3), in beiden Phasen gleich
      symbol: s.symbol ?? null, // E-197: Bildzeichen statt Text
      wort: s.wort ?? null,
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
        /*
         * L3b: gemessen ab dem Wendepunkt, nicht ab dem Beginn. Steht der
         * Hauptarm bei 65°, kommt er keine 10° hoeher — erst senken, dann
         * heben zaehlt. Wer am Wendepunkt beginnt, merkt keinen Unterschied.
         */
        const d = aenderung(ziel.groesse, b, z, this.fahrt);
        this.tief = Math.min(this.tief, d);
        this.hoch = Math.max(this.hoch, d);
        const plus = d - this.tief;
        const minus = this.hoch - d;
        return (ziel.richtung === "minus" ? minus : ziel.richtung === "plus" ? plus : Math.max(plus, minus)) >= ziel.ab;
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
