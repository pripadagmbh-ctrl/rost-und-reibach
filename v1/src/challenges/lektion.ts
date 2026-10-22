import type { EventBus, GameEvents } from "../core/events";
import type { Spur, SpurAchse } from "../core/spur";
import type { ViewMode } from "../excavator/orbitCamera";
import { SPINNE_HOEHE_M, SPINNE_WAAGRECHT_M, type Beobachtung, type ChallengeAufbau } from "./challenge";
import type { Zweisprachig } from "./texte";
import { SCHWENK_AUSSEN } from "../world/baggerstand";

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
  /**
   * L8: Die Spinne sitzt auf — der Arm drueckt gegen ein Fahrzeug
   * (`excavator.armBlocked`) oder die Spitze liegt auf (`groundContact`).
   * Der Lotse packt am Wrack erst dann zu: Dessen Marke steht auf dem
   * hoechsten Punkt (Fahrerhaus), gegriffen wird oft tiefer (Rahmen). Fehlt
   * (Attrappen) = nein.
   */
  aufgesessen?: boolean;
  /** Sensorpunkt der Spinne (m) */
  spinne: { x: number; y: number; z: number };
  kamera: { modus: ViewMode; gier: number; nick: number; abstand: number };
}

export interface LektionQuellen {
  zustand(): LektionZustand;
  /**
   * L8: Hat die Station (`StationLauf.gesehen`, verdrahtet in main.ts) diese
   * Beobachtung schon gesehen? Ohne Quelle (Attrappen) nie.
   */
  stationGesehen?(b: Beobachtung): boolean;
  /** L8: Ist der Funktionskranz offen? null = kein Touch (am PC gibt es keinen Kranz) — das Ziel gilt dann als erfuellt; ohne Quelle ebenso. */
  kranzOffen?(): boolean | null;
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
 * Teil 2 (L8, weltbezogen) liest die Beobachtungen nicht selbst: Die Station
 * (`station.ts`, eine stumm gefahrene Pruefung) sieht sie, der Lauf fragt
 * `LektionQuellen.stationGesehen`.
 */
export type LektionZiel =
  /**
   * um mindestens `ab` geaendert (in `richtung` des Befehls, "beide" = Betrag).
   * "hinUndZurueck" (L5-B, Patrick 22.10. Punkt 40c): plus UND minus je
   * mindestens `ab`, Reihenfolge egal — zwei Teilziele, das erste meldet
   * `lehrgang:teilziel`.
   */
  | { art: "aenderung"; groesse: Groesse; richtung: "plus" | "minus" | "beide" | "hinUndZurueck"; ab: number }
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
  | { art: "marke"; radialM?: number; schwenkRad?: number; radiusM: number }
  /*
   * --- Teil 2 (Etappe 2b, L8) — Ziele in der Welt ---
   * "ort": Die Drehmitte steht wieder hoechstens `radiusM` neben der Lage bei
   * `start()` und der Unterwagen hoechstens `gierTolRad` verdreht — die
   * Stationen liegen fest auf dem Platz wie in den Pruefungen. Wer schon dort
   * steht, hat das Haekchen sofort.
   */
  | { art: "ort"; radiusM: number; gierTolRad: number }
  /** Die Station dieses Schritts (Pruefung aus `katalog.ts`, stumm gefahren) hat `beobachtet` gesehen — auch spaeter im Ablauf der Pruefung. */
  | { art: "station"; beobachtet: Beobachtung }
  /**
   * So viele Ereignisse seit Beginn von "du": "abriss" = `wrack:abriss`,
   * "einwurf" = `itemEntered` mit `correct`, "hupe" = `bagger:hupe`.
   */
  | { art: "ereignis"; ereignis: "abriss" | "einwurf" | "hupe"; anzahl: number }
  /** Ein Zustand ist an: Pratzen unten, Funktionskranz offen (ohne Touch gilt er als erfuellt — am PC gibt es keinen Kranz). */
  | { art: "zustand"; was: "abgestuetzt" | "kranzOffen" };

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
  | "hupe"
  // Teil 2 (L8)
  | "zurueck"
  | "greifen"
  | "rotator"
  | "ablegen"
  | "kranz"
  | "last"
  | "haemmern"
  | "quetschen"
  | "zerlegen"
  | "pressen"
  | "sortieren";

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
  /**
   * L8: Ab diesem Schritt steht diese Station auf dem Platz (Pruefungs-ID aus
   * `katalog.ts`); sie gilt bis zum naechsten Schritt mit `station`. Ohne =
   * die Station des Schritts davor (Teil 1: keine).
   */
  station?: string;
  /** L8: Der Geist tippt auf den Kranz-Knopf und dann auf diesen Eintrag (Tastencode, z. B. "KeyO"); `code: null` = nur aufklappen. */
  kranz?: { code: string | null };
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

/*
 * --- L5-B (Patrick 22.10.2026 Punkt 40f): WAS IST GERADE NOETIG? ---
 * „bei der letzten Aufgabe … nicht ganz klar, dass man nach links schwenken
 * muss, weil quasi die Pfeiltasten nur nach oben und nach unten zeigen". Der
 * Lauf kennt Ziel, Marke und Wendepunkte; er sagt, welche Funktion in welche
 * Richtung gerade zaehlt (`lehrgang:richtung`), der Geisterdaumen uebersetzt
 * das auf Stick und Pfeil.
 */
type Richtung = "plus" | "minus";
export type Bedarf = GameEvents["lehrgang:richtung"]["bedarf"];
const gegen = (r: Richtung): Richtung => (r === "plus" ? "minus" : "plus");
/**
 * Marke: Seitenfehler (Bogen um die Drehmitte), ab dem geschwenkt statt
 * ein-/ausgefahren wird, als Anteil des Markenhalbmessers.
 * SW: ins Ein-/Ausfahren ab 0,5, zurueck ins Schwenken erst ab 0,75 (das
 * Pendel der Spinne soll den Pfeil nicht flackern lassen). Bei 0,75 seitlich
 * bleiben bis zum Rand noch sqrt(1 − 0,75²) = 0,66 radial — wer dort steht und
 * nicht drin ist, liegt radial daneben, der Arm-Pfeil stimmt also.
 */
const SEITE_REIN = 0.5;
const SEITE_RAUS = 0.75;
/** Ein Gelenk „hilft spuerbar" ab dieser Ausladungsaenderung (m je rad). // SW: 0,5 m/rad ≈ 1 cm je Grad; aus der Startlage tragen Stiel 2,3 und Hauptarm 0,7 */
const WIRKUNG_MIN = 0.5;
/** „beide": die andere Richtung gilt erst, wenn sie um so viel (Anteil von `ab`) vorn liegt. // SW: 10 % — Zittern am Stick dreht den Pfeil nicht */
const BEIDE_VORSPRUNG = 0.1;

/*
 * --- L8: DER LOTSE FUER DIE SCHRITTE IN DER WELT ---
 * Die Station meldet ihre Marken (`challenge:stand`, wie fuer die Zielmarke):
 * "teil" = was zu holen ist, "ziel" = wohin, solange etwas haengt. Daraus
 * dieselbe Sprache wie bei der Bodenmarke (`markeBedarf`): erst schwenken,
 * dann Ausladung, dann senken und zupacken — bzw. mit Last hoch, hinueber,
 * oeffnen. Jede Schwelle mit Ruecklauf (Hysterese), sonst kippt der Pfeil
 * beim Pendeln der Spinne.
 */
/** „Nah am Teil" ab `SPINNE_WAAGRECHT_M` (dieselbe Zahl wie `spinne_am_teil`), weg erst ab dem 1,25-fachen. // SW: 0,8 → 1,0 m, mehr als das Pendeln der Spinne beim Anhalten */
const NAH_RAUS = 1.25;
/**
 * „Ueber dem Ziel" ab diesem waagrechten Abstand Spinne – Zielmitte. // SW: 1,0 m —
 * die kleinste Zielflaeche, der Ablagekreis der schweren Last, hat 0,85 m
 * Halbmesser (`katalog.ts`); Mulden und Presskammer sind 4–6 m breit.
 */
const UEBER_ZIEL_M = 1.0;
/**
 * Wrack: Hoehe Sensor ueber der Marke (Dach), ab der erst gesenkt wird.
 * // SW: 1,5 m — offen aufgesetzt steht der Sensor 1,25 m ueber der Auflage
 * (`katalog.ts` Kopf, gemessen), dazu 0,25 m Luft. Teile rechnen wie
 * `spinne_am_teil` mit `SPINNE_HOEHE_M` ueber der Mitte.
 */
const WRACK_GREIF_HOEHE_M = 1.5;
/** Wrack: erst ab so viel Abstand wieder ueber das Dach heben. // SW: 2,0 m — naeher ist es Nachfuehren, kein Anschwenken */
const WRACK_ANFAHRT_M = 2.0;
/** Haemmern: nach weichem Aufsetzen so hoch ueber `WRACK_GREIF_HOEHE_M` ausholen. // SW: 1,0 m — mit vollem Senktempo (3,15 m/s, E-134) ist `HAU_AB` (1,9 m/s) nach der Anlauframpe weit vorher erreicht */
const HAU_HUB_M = 1.0;
/** Spinne gilt als zu bzw. wieder offen. // SW: 0,95 / 0,1 — ein gefasstes Teil haelt sie gemessen bei 0,5–0,65 (kopflos), leer laeuft sie bis 1 */
const ZU_AB = 0.95;
const OFFEN_BIS = 0.1;
/** Ruecklauf aller Hoehenschwellen. // SW: 0,3 m — eine Handbreit, mehr als das Wippen beim Anhalten des Arms */
const HOEHE_HYST_M = 0.3;
/**
 * Mit Last zuerst so hoch (Sensor ueber der Oberkante des Ziels), dann
 * hinueber. // SW: Teil 2,0 m — es haengt bis zum Sensorradius (1,24 m)
 * unter dem Sensor, dazu `HUB_LUFT_M` 0,3 m und Reserve. Wrack 3,2 m — ein
 * Pkw ist 1,5 m hoch, der Sensor steht 1,25 m ueber dem Dach, dazu 0,3 m Luft
 * und Reserve.
 */
const HUB_TEIL_M = 2.0;
const HUB_WRACK_M = 3.2;
/** Ueber dem Ziel ein Teil erst bis so hoch (Sensor ueber Oberkante) absenken, dann oeffnen. // SW: 1,6 m — das Teil haengt bis 1,24 m unter dem Sensor, die Unterkante bleibt also eine Handbreit ueber der Wand */
const ABLEGEN_TEIL_M = 1.6;
/**
 * Hoechstens so hoch (Sensor) — die Halden sind 5 m hoch, aber nach Norden,
 * zum Bagger hin, offen (`containers.ts` halde); ueber ihre Oberkante muss
 * keiner. // SW: 4,5 m — in `ABWURF_MAX_M` (8,5 m) Ausladung reicht der
 * Sensor mit waagrechtem Stiel nur gut 5 m hoch (Hauptarm 45°: Spitze 6,6 m,
 * Sensor 1,5 m darunter; `GRENZEN`, `katalog.ts` Kopf). Mit 6,0 m stand der
 * Pfeil kopflos am 70°-Anschlag fest auf „hoch".
 */
const HUB_MAX_M = 4.5;
/**
 * Ziele ausser Reichweite (die Halden-Mitten liegen 9,8 und 10,5 m vom
 * Standplatz): Abwurf auf der Linie zur Mitte, hoechstens so weit draussen.
 * // SW: `SCHWENK_AUSSEN` − 0,7 m — der Stiel hat noch Weg; nachgerechnet
 * liegt der Punkt in STAHL und MISCH 1,2 bzw. 1,7 m innerhalb der Zone
 * (Waechter `test/lehrgang-teil2.test.ts`).
 */
export const ABWURF_MAX_M = SCHWENK_AUSSEN - 0.7;

/** Rein: wohin der Lotse eine Last bringt — die Zielmitte, liegt sie weiter als `ABWURF_MAX_M`, der Punkt auf der Linie dorthin. */
export function abwurfPunkt(mitte: { x: number; z: number }, ziel: { x: number; z: number }): { x: number; z: number } {
  const dx = ziel.x - mitte.x;
  const dz = ziel.z - mitte.z;
  const r = Math.hypot(dx, dz);
  if (r <= ABWURF_MAX_M) return { x: ziel.x, z: ziel.z };
  return { x: mitte.x + (dx / r) * ABWURF_MAX_M, z: mitte.z + (dz / r) * ABWURF_MAX_M };
}

/** Was der Lotse je Beobachtung tut. Fehlt eine (z. B. `wrack_gepresst`: Knopf), schweigt er (leerer Bedarf). */
type Modus = "greifen" | "ablegen" | "heben" | "hauen";
const MODUS: Partial<Record<Beobachtung, Modus>> = {
  blick_auf_teil: "greifen",
  spinne_am_teil: "greifen",
  teil_gefasst: "greifen",
  wrack_gefasst: "greifen",
  teil_gehoben: "heben",
  wrack_gehoben: "heben",
  teil_ueber_ziel: "ablegen",
  teil_im_ziel: "ablegen",
  wrack_ueber_kammer: "ablegen",
  wrack_in_kammer: "ablegen",
  wrack_abgelegt: "ablegen",
  wrack_gehauen: "hauen",
  // Zubeissen = zupacken wie Greifen
  wrack_geknautscht: "greifen",
  wrack_beides: "greifen",
  wrack_platt: "greifen",
};
type StandMarke = GameEvents["challenge:stand"]["marken"][number];
/** Schwellen des Lotsen mit Ruecklauf — je Schritt neu (Beginn von „du") */
function neuerLotse(): { nah: boolean; hoch: boolean; ueber: boolean; niedrig: boolean; tiefGenug: boolean; sitzY: number | null; oeffnen: boolean; ausholen: boolean } {
  return { nah: false, hoch: true, ueber: false, niedrig: true, tiefGenug: false, sitzY: null, oeffnen: false, ausholen: false };
}

/** L8: Station des Schritts `i` — die letzte `station` bei oder vor `i`; null = keine (Teil 1). */
export function stationVon(schritte: readonly LektionSchritt[], i: number): string | null {
  for (let j = Math.min(i, schritte.length - 1); j >= 0; j--) {
    const s = schritte[j]!.station;
    if (s !== undefined) return s;
  }
  return null;
}

/** Erste Richtung, in die die (gerichtete) Spur diese Groesse bewegt — sonst plus. */
function ersteRichtung(spur: Spur | null, g: Groesse): Richtung {
  for (const a of spur ?? []) {
    if (g === "zoom") {
      const f = a.kamera?.zoomProS ?? 1;
      if (Math.abs(f - 1) > 1e-3) return f > 1 ? "plus" : "minus"; // zoom plus = weiter weg
    } else if (g === "cabYaw" || g === "boom" || g === "stick" || g === "rotator") {
      const v = a.achsen?.[g === "cabYaw" ? "cab" : g] ?? 0;
      if (Math.abs(v) > 1e-3) return v > 0 ? "plus" : "minus";
    }
  }
  return "plus";
}

/**
 * Liegt `rest` in Richtung `r` noch vor dem Anschlag (mit Luft wie
 * `richteSpur`)? Geprueft wird nur der Anschlag, auf den es zugeht — weg vom
 * Anschlag ist immer frei (L8, kopflos gefunden: Am 70°-Anschlag galt sonst
 * auch Senken als gesperrt, der Lotse kam mit Last nicht mehr hinaus). Der
 * Drehkranz hat keinen.
 */
function frei(g: Groesse, r: Richtung, rest: number, z: LektionZustand, b: LektionZustand): boolean {
  const s = r === "plus" ? 1 : -1;
  if (g === "boom" || g === "stick") {
    const ziel = z[g] + s * rest;
    return r === "plus" ? ziel <= GRENZEN[g].max - RAND_RAD : ziel >= GRENZEN[g].min + RAND_RAD;
  }
  if (g === "zoom") {
    const ziel = z.kamera.abstand + s * rest * b.kamera.abstand; // `zoom` ist relativ zum Abstand bei Beginn
    return r === "plus" ? ziel <= GRENZEN.abstand.max * (1 - RAND_REL) : ziel >= GRENZEN.abstand.min * (1 + RAND_REL);
  }
  return true;
}

/**
 * Rein: Was bringt die Spinne jetzt zur Marke? Erst der Winkel um die
 * Drehmitte (Schwenken; `cab+` dreht nach links, der Winkel atan2(x, z)
 * steigt — wie `schwenkRad` in `beginne`), dann die Ausladung: Hauptarm und
 * Stiel je in die Richtung, die die Spitze zur Marke hin schiebt (s. u.). Am
 * Anschlag faellt ein Gelenk weg. `seitlich` = zuletzt wurde geschwenkt
 * (Hysterese, s. o.).
 */
export function markeBedarf(
  z: LektionZustand,
  m: { x: number; z: number; radiusM: number },
  seitlich: boolean
): { bedarf: Bedarf; seitlich: boolean } {
  const sx = z.spinne.x - z.x;
  const sz = z.spinne.z - z.z;
  const mx = m.x - z.x;
  const mz = m.z - z.z;
  const rM = Math.hypot(mx, mz);
  let dw = Math.atan2(mx, mz) - Math.atan2(sx, sz);
  dw = Math.atan2(Math.sin(dw), Math.cos(dw)); // auf −π … π
  const seite = Math.abs(dw) * rM; // Bogen auf dem Kreis der Marke, m
  if (seite > m.radiusM * (seitlich ? SEITE_REIN : SEITE_RAUS)) return { bedarf: [{ fn: "cab", richtung: dw > 0 ? "plus" : "minus" }], seitlich: true };
  const raus = Math.hypot(sx, sz) < rM; // Spinne naeher als die Marke → hinaus
  /*
   * Je Gelenk die Ausladungsaenderung je rad (Spitze gegen den Drehpunkt des
   * Hauptarms, wie `spitzeR`): dR/dStiel = −S·sin(w), dR/dboom = −(Hoehe der
   * Spitze). Jedes Gelenk, das spuerbar hilft, bekommt seine Richtung — aus
   * der Startlage heranholen = Hauptarm hoch + Stiel ein, wie die
   * Vorfuehrung. Liegt der Stiel waagrecht (w ≈ 0), ist die Ausladung dort am
   * groessten und er hilft nicht mehr; dann fuehrt der Hauptarm allein
   * (Browserlauf 22.10.: Hauptarm am 70°-Anschlag, Stiel waagrecht — der
   * Stiel-Pfeil kippte bei jedem Ruck um, die Spinne kam nicht weiter hinaus).
   */
  const w = z.boom + z.stick;
  const wirkung: Record<Arm, number> = {
    boom: -(GRENZEN.boom.m * Math.sin(z.boom) + GRENZEN.stick.m * Math.sin(w)),
    stick: -GRENZEN.stick.m * Math.sin(w),
  };
  const kandidaten = ARM.map((g) => {
    const richtung: Richtung = wirkung[g] > 0 === raus ? "plus" : "minus";
    return { fn: g, richtung, m: Math.abs(wirkung[g]), frei: frei(g, richtung, 0, z, z) };
  }).filter((k) => k.frei);
  const spuerbar = kandidaten.filter((k) => k.m >= WIRKUNG_MIN);
  const wahl = spuerbar.length ? spuerbar : kandidaten.sort((a, b) => b.m - a.m).slice(0, 1);
  return { bedarf: wahl.map(({ fn, richtung }) => ({ fn, richtung })), seitlich: false };
}

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

/**
 * L8: Drehpunkt des Hauptarms vor der Drehmitte (m) — abgeschrieben aus
 * `excavator.ts` BOOM_PIVOT z; der Ausleger sitzt mittig (x 0). Waechter:
 * `test/lehrgang-teil2-fahrer.test.ts` (Ruhelage = Sensor des echten Baggers).
 */
export const PIVOT_VOR_M = 0.55;
/**
 * Rein: wohin die Spinne auspendelt — lotrecht unter der Stielspitze, in
 * Blickrichtung `heading + cabYaw`. Startpose: 0,55 + 7,54 = 8,09 m, wie
 * gemessen (`katalog.ts` Kopf).
 */
export function ruhePunkt(z: Pick<LektionZustand, "x" | "z" | "heading" | "cabYaw" | Arm>): { x: number; z: number } {
  const a = z.heading + z.cabYaw;
  const r = PIVOT_VOR_M + spitzeR(z);
  return { x: z.x + r * Math.sin(a), z: z.z + r * Math.cos(a) };
}

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
  /** L5-B: die gerichtete Spur des Schritts (erste Richtung fuer den Geist) */
  private spur: Spur | null = null;
  /** L5-B (40c): Teilziele „hinUndZurueck" — plus bzw. minus schon erreicht */
  private teilPlus = false;
  private teilMinus = false;
  /** L5-B (40f): zuletzt gesendete Richtung (gesendet wird nur bei Aenderung), Hysterese der Marke */
  private richtungKey = "";
  private seitlich = true;
  /** L8: zuletzt gemeldete Station; undefined = noch nie gemeldet (der erste Schritt meldet immer) */
  private station: string | null | undefined = undefined;
  /** L8: Lage bei `start()` — Ziel `ort` */
  private startLage = { x: 0, z: 0, heading: 0 };
  /** L8: Ereignisse seit Beginn von „du" */
  private zahl = { abriss: 0, einwurf: 0, hupe: 0 };
  /** L8: letzte Marken der Station (`challenge:stand`) und die Schwellen des Lotsen (Hysterese) */
  private marken: readonly StandMarke[] = [];
  private lotse = neuerLotse();

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
    // L8: gezaehlt wird nur in „du" — was vorher geschah (Vorfuehrung, voriger Schritt), zaehlt nicht
    const zaehle = (k: Extract<LektionZiel, { art: "ereignis" }>["ereignis"]): void => {
      if (!this.aus && this.phase === "du") this.zahl[k]++;
    };
    // Aufgesprungen ist nicht ab (`composites.ts` haubeAuf): nur "ab" ist zerlegt
    bus.on("wrack:abriss", (e) => e.art === "ab" && zaehle("abriss"));
    bus.on("itemEntered", (e) => e.correct && zaehle("einwurf"));
    bus.on("bagger:hupe", () => zaehle("hupe"));
    bus.on("challenge:stand", (e) => {
      if (!this.aus && this.station && e.id === this.station) this.marken = e.marken;
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
    const z = this.q.zustand();
    this.startLage = { x: z.x, z: z.z, heading: z.heading };
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
    if (!this.erreicht(z)) {
      this.richtung(z);
      return;
    }
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
    // L8: Station vor allem anderen — main.ts baut sie im Zuhoerer auf, der Schritt sieht sie schon
    const st = stationVon(d.schritte, i);
    if (this.station === undefined || st !== this.station) {
      this.station = st;
      this.marken = [];
      this.bus.emit("lehrgang:station", { id: st });
    }
    const z = this.q.zustand();
    const g = s.vorfuehrung ? richteSpur(s.vorfuehrung, z) : null;
    this.spur = g?.spur ?? null;
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
    // L8: Zurueck an den Startplatz — die Marke liegt unter der Drehmitte bei `start()`
    if (s.ziel.art === "ort") this.markeOrt = { x: this.startLage.x, y: 0, z: this.startLage.z, radiusM: s.ziel.radiusM };
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
    this.teilPlus = false;
    this.teilMinus = false;
    this.richtungKey = "";
    this.seitlich = true;
    this.zahl = { abriss: 0, einwurf: 0, hupe: 0 };
    this.lotse = neuerLotse();
    this.phase = "du";
    this.melde("du");
    this.richtung(z);
  }

  /** L5-B (40f): `lehrgang:richtung` senden, wenn sich der Bedarf geaendert hat. Schritte ohne Meinung senden nichts. */
  private richtung(z: LektionZustand): void {
    const r = this.bedarf(z);
    if (!r) return;
    const key = JSON.stringify(r);
    if (key === this.richtungKey) return;
    this.richtungKey = key;
    this.bus.emit("lehrgang:richtung", { id: this.daten.id, nr: this.schritt + 1, ...r });
  }

  private bedarf(z: LektionZustand): Pick<GameEvents["lehrgang:richtung"], "bedarf" | "kamera"> | null {
    const ziel = this.daten.schritte[this.schritt]!.ziel;
    if (ziel.art === "marke") {
      const r = markeBedarf(z, this.markeOrt!, this.seitlich);
      this.seitlich = r.seitlich;
      return { bedarf: r.bedarf, kamera: null };
    }
    // L8: Welt-Schritte — der Lotse an den Marken der Station; ohne sinnvollen Lotsen (Hupe, Kranz, Stuetzen, Zerlegen, Zurueck) ein leerer Bedarf
    if (ziel.art === "station") {
      const m = MODUS[ziel.beobachtet];
      return { bedarf: m ? this.welt(z, m, ziel.beobachtet.startsWith("wrack_")) : [], kamera: null };
    }
    if (ziel.art === "ereignis") return { bedarf: ziel.ereignis === "einwurf" ? this.welt(z, "ablegen", false) : [], kamera: null };
    if (ziel.art === "ort" || ziel.art === "zustand") return { bedarf: [], kamera: null };
    if (ziel.art !== "aenderung") return null;
    const g = ziel.groesse;
    const fn = g === "cabYaw" ? "cab" : g === "boom" || g === "stick" || g === "rotator" ? g : null;
    if (!fn && g !== "zoom") return null; // Fahren, Kamera drehen …: der Geist bleibt bei der Spur
    const b = this.basis!;
    const d = aenderung(g, b, z, this.fahrt);
    // Wie `erreicht`, ohne die Wendepunkte zu schreiben (hier vor dem ersten `erreicht` aus `du`)
    const plus = d - Math.min(this.tief, d);
    const minus = Math.max(this.hoch, d) - d;
    const fest = ziel.richtung === "plus" || ziel.richtung === "minus" ? ziel.richtung : null;
    const fehlt = ziel.richtung === "hinUndZurueck" ? (this.teilPlus ? "minus" : this.teilMinus ? "plus" : null) : null;
    const v = BEIDE_VORSPRUNG * ziel.ab;
    let soll: Richtung = fest ?? fehlt ?? (plus > minus + v ? "plus" : minus > plus + v ? "minus" : ersteRichtung(this.spur, g));
    // Laege der Rest hinter dem Anschlag: erst die Gegenrichtung (Wendepunkt), wie `richteSpur` die Vorfuehrung dreht
    if (!frei(g, soll, ziel.ab - (soll === "plus" ? plus : minus), z, b)) soll = gegen(soll);
    if (fn) return { bedarf: [{ fn, richtung: soll }], kamera: null };
    return { bedarf: [], kamera: soll === "minus" ? "auf" : "zu" }; // naeher = Finger auseinander (`ui/geisterdaumen.ts` kameraGeste)
  }

  /**
   * L8: Was in der Welt gerade zum Ziel fuehrt, aus den Marken der Station.
   * Haengt etwas (Ziel-Marke da; beim Wrack ausserdem keine Teil-Marke mehr —
   * die schwere Last zeigt ihren Kreis schon vor dem Greifen): heben, bzw.
   * hoch genug, hinueber, oeffnen. Sonst zum ersten Teil, senken, zupacken
   * (Haemmern: nur senken — mit Schwung).
   */
  private welt(echt: LektionZustand, modus: Modus, wrack: boolean): Bedarf {
    const L = this.lotse;
    // Waagrecht zaehlt die Ruhelage unter der Stielspitze, nicht der pendelnde Sensor (sonst kippt der Pfeil mit jedem Ausschlag); die Hoehe ist die echte
    const z: LektionZustand = { ...echt, spinne: { ...echt.spinne, ...ruhePunkt(echt) } };
    const s = z.spinne;
    const teile = this.marken.filter((m) => m.art === "teil");
    const ziel = this.marken.find((m) => m.art === "ziel") ?? null;
    const haengt = !!ziel && (!wrack || teile.length === 0);
    if (haengt) {
      if (modus === "heben") return [{ fn: "boom", richtung: "plus" }];
      if (modus !== "ablegen") return [];
      const ab = abwurfPunkt(z, ziel);
      const d = Math.hypot(s.x - ab.x, s.z - ab.z);
      L.ueber = L.ueber ? d <= UEBER_ZIEL_M * NAH_RAUS : d <= UEBER_ZIEL_M;
      if (L.ueber) {
        // Teil: erst absenken bis knapp ueber die Wand — aus 4,6 m Sensorhoehe prallte der Boiler kopflos ueber die 2-m-Wand der Box wieder hinaus
        if (!wrack) L.tiefGenug = L.tiefGenug ? s.y <= ziel.y + ABLEGEN_TEIL_M + HOEHE_HYST_M : s.y <= ziel.y + ABLEGEN_TEIL_M;
        return [!wrack && !L.tiefGenug ? { fn: "boom", richtung: "minus" } : { fn: "grapple", richtung: "minus" }];
      }
      const hub = Math.min(ziel.y + (wrack ? HUB_WRACK_M : HUB_TEIL_M), HUB_MAX_M);
      // Am Anschlag des Hauptarms ist hoeher nicht drin — dann gilt die Hoehe als genug (sonst stuende der Pfeil fuer immer auf „hoch")
      L.niedrig = frei("boom", "plus", 0, z, z) && (L.niedrig ? s.y < hub + HOEHE_HYST_M : s.y < hub);
      const r = markeBedarf(z, { x: ab.x, z: ab.z, radiusM: UEBER_ZIEL_M }, this.seitlich);
      this.seitlich = r.seitlich;
      // Mit Last nie senken, solange es hinueber geht (die Wand) — hinaus dann mit dem Stiel
      const ohneSenken = r.bedarf.filter((b) => !(b.fn === "boom" && b.richtung === "minus"));
      if (L.niedrig) return [{ fn: "boom", richtung: "plus" }, ...ohneSenken.filter((b) => b.fn !== "boom")];
      return ohneSenken.length > 0 ? ohneSenken : r.bedarf;
    }
    const t = teile[0];
    if (!t) return [];
    const d = Math.hypot(s.x - t.x, s.z - t.z);
    L.nah = L.nah ? d <= SPINNE_WAAGRECHT_M * NAH_RAUS : d <= SPINNE_WAAGRECHT_M;
    if (!L.nah) {
      L.sitzY = null;
      const r = markeBedarf(z, { x: t.x, z: t.z, radiusM: SPINNE_WAAGRECHT_M }, this.seitlich);
      this.seitlich = r.seitlich;
      if (!wrack) return r.bedarf;
      /*
       * Zum Wrack ueber sein Dach hinweg: Die offenen Schalen haengen gut 1 m
       * unter dem Sensor — wer tiefer anschwenkt, schiebt das Wrack weg
       * (kopflos gemessen: der LKW der schweren Last 1,4 m verschoben).
       */
      // Nah dran (eben vom Senken ausgependelt) nur seitlich nachfuehren, nicht wieder heben
      L.niedrig = d > WRACK_ANFAHRT_M && (L.niedrig ? s.y < t.y + WRACK_GREIF_HOEHE_M + HOEHE_HYST_M : s.y < t.y + WRACK_GREIF_HOEHE_M);
      const ohneSenken = r.bedarf.filter((b) => !(b.fn === "boom" && b.richtung === "minus"));
      if (L.niedrig) return [{ fn: "boom", richtung: "plus" }, ...ohneSenken.filter((b) => b.fn !== "boom")];
      return ohneSenken.length > 0 ? ohneSenken : r.bedarf;
    }
    // Aufgesessen bleibt „aufgesessen", bis die Spinne wieder eine Handbreit hoeher steht (beim Schliessen hebt sie sich, der Arm drueckt nicht mehr)
    if (z.aufgesessen) L.sitzY = s.y;
    const sitzt = L.sitzY !== null && s.y <= L.sitzY + HOEHE_HYST_M;
    if (modus === "hauen") {
      // Hau drauf: senken mit Schwung; sass sie nur weich auf (kein Schlag gezaehlt), erst wieder ausholen
      if (z.aufgesessen) L.ausholen = true;
      if (L.ausholen && s.y >= t.y + WRACK_GREIF_HOEHE_M + HAU_HUB_M) L.ausholen = false;
      return [{ fn: "boom", richtung: L.ausholen ? "plus" : "minus" }];
    }
    // Leer zu (sonst haette das Ziel gezaehlt bzw. etwas hinge): erst ganz auf, dann neu ansetzen — auch nach einem Biss
    if (L.oeffnen && z.closure <= OFFEN_BIS) L.oeffnen = false;
    if (!L.oeffnen && z.closure >= ZU_AB) L.oeffnen = true;
    if (L.oeffnen) return [{ fn: "grapple", richtung: "minus" }];
    /*
     * Wann zupacken? Am Spiel: sobald die Spinne aufsitzt (Boden, Teil oder
     * Wrack) — wie die Pruefungs-Fahrer (`test/aufgabenwerkbank.ts` greife).
     * Eine Hoehe ueber der Marke taugt nicht: Am Wrack steht sie auf dem
     * hoechsten Punkt (Fahrerhaus), gegriffen wird am Rahmen; der Sensor des
     * Magneten sitzt unter der Scheibe. Ohne Quelle (Attrappen) die Hoehe wie
     * `spinne_am_teil` (Teil: Marke = 2 × Mitte, `challenge.ts` beobachte).
     */
    const ueber = wrack ? s.y - t.y : s.y - t.y / 2;
    const grenze = wrack ? WRACK_GREIF_HOEHE_M : SPINNE_HOEHE_M;
    L.hoch = L.hoch ? ueber > grenze : ueber > grenze + HOEHE_HYST_M;
    const zupacken = z.aufgesessen === undefined ? !L.hoch : sitzt;
    return [zupacken ? { fn: "grapple", richtung: "plus" } : { fn: "boom", richtung: "minus" }];
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
      teile: s.ziel.art === "aenderung" && s.ziel.richtung === "hinUndZurueck" ? 2 : 1, // L5-B (40c)
      kranz: s.kranz ?? null, // L8: der Geist tippt auf den Kranz
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
        if (ziel.richtung === "hinUndZurueck") {
          const vorher = Number(this.teilPlus) + Number(this.teilMinus);
          this.teilPlus ||= plus >= ziel.ab;
          this.teilMinus ||= minus >= ziel.ab;
          const n = Number(this.teilPlus) + Number(this.teilMinus);
          if (n === 2) return true;
          if (n > vorher) this.bus.emit("lehrgang:teilziel", { id: this.daten.id, nr: this.schritt + 1, teil: n, von: 2 });
          return false;
        }
        return (ziel.richtung === "minus" ? minus : ziel.richtung === "plus" ? plus : Math.max(plus, minus)) >= ziel.ab;
      }
      // --- L8, Teil 2 ---
      case "ort": {
        const a = this.startLage;
        return Math.hypot(z.x - a.x, z.z - a.z) <= ziel.radiusM && Math.abs(winkelDiff(z.heading, a.heading)) <= ziel.gierTolRad;
      }
      case "station":
        return this.q.stationGesehen?.(ziel.beobachtet) ?? false;
      case "ereignis":
        return this.zahl[ziel.ereignis] >= ziel.anzahl;
      case "zustand":
        if (ziel.was === "abgestuetzt") return z.abgestuetzt;
        return this.q.kranzOffen?.() ?? true; // null/ohne Quelle: kein Kranz, nichts zu zeigen
    }
  }
}

/** Kleinster Winkel von b nach a, −π … π. */
function winkelDiff(a: number, b: number): number {
  const d = (a - b) % (2 * Math.PI);
  return d > Math.PI ? d - 2 * Math.PI : d < -Math.PI ? d + 2 * Math.PI : d;
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
