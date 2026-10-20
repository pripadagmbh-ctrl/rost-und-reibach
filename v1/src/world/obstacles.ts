import RAPIER from "@dimforge/rapier3d-compat";
import { pressWaende } from "./press";
import {
  YARD_D,
  YARD_MIN_X,
  YARD_MAX_X,
  SUED_HOCH,
  SUED_HOCH_VON,
  SUED_HOCH_RAMPE,
  OST_HOCH_BIS,
  GATE_X,
  KAFFEE_POS,
  KAFFEE_FUSS,
  BUCHT_X_VON,
  BUCHT_X_BIS,
  BUCHT_Z,
  TRENNSTEINE,
  TRENNSTEIN_X,
  TRENNSTEIN_L,
  TRENNSTEIN_T,
  BUCHT_FASE_WEST,
  BUCHT_FASE_OST,
  schraegeLaeufe,
} from "./yard";
import { officeFootprints, hallenWaende } from "./office";
import { CONFIGS, muldenWaendeWelt, type ContainerConfig } from "./containers";
import { firmenmuldenHindernisse } from "./firmenmulden";

/**
 * Feste Bauten auf dem Platz — alles, wodurch niemand hindurchlaufen oder
 * -fahren darf (Design-Fix 29.08.2026).
 *
 * Die Physik kennt diese Bauwerke als Kollider, aber Lambert und die LKW
 * bewegen sich kinematisch nach Skript: sie werden von Kollidern nicht
 * aufgehalten, sondern müssen ihre Wege selbst darum herum planen. Diese
 * Liste ist die gemeinsame Grundlage dafür.
 *
 * Achsenparallele Rechtecke, Maße als Halbweiten ab Mittelpunkt.
 */
export interface Obstacle {
  x: number;
  z: number;
  /** halbe Ausdehnung in x */
  hw: number;
  /** halbe Ausdehnung in z */
  hd: number;
  /** Oberkante über Grund — darüber darf der Baggerarm frei schwenken */
  top: number;
  label: string;
}

const HZ = YARD_D / 2;
/** Breite der Einfahrtslücke in der Nordwand */
const GATE_HALF = 4.5;
/** Dicke der Betonlego-Umrandung (drei Reihen à 0,6 m) */
const WALL_T = 0.6;
/** Höhe der Umrandung: drei Reihen */
const WALL_H = 1.8;

/**
 * Wände einer Mulde, aus ihrer eigenen Konfiguration gerechnet.
 *
 * Vorher stand die Muldengeometrie hier ein zweites Mal, von Hand gepflegt.
 * Beim Verschieben der Sortierreihe blieb sie zurück: Der Arm stiess gegen
 * unsichtbare Wände am alten Platz und fuhr durch die echten hindurch. Und die
 * Wände des Ballenlagers standen noch in der Liste, obwohl daraus längst eine
 * offene Fläche geworden war. Zwei Wahrheiten über dieselbe Sache halten nie.
 *
 * Die Öffnung bleibt frei — als Vollfläche eingetragen wäre der Innenraum
 * gesperrt und man käme mit der Spinne nicht mehr hinein.
 */
function bayObstacles(cfg: ContainerConfig): Obstacle[] {
  if (cfg.kind === "halde") {
    /*
     * Der Mischschrottplatz: drei doppelt gesetzte Wände, nach Norden offen.
     * Er steht hier, weil sonst Lambert, die Streife und die LKW quer
     * hindurchliefen — die Wände sind fünf Meter hoch und sehr real.
     */
    const [hw, hd, top] = cfg.size;
    const T = 0.55;
    const L = cfg.label;
    /*
     * Rückwand, Aussenwand und eine halbe Trennwand zur Maschine hin
     * (12.09.2026). Die vordere Hälfte bleibt frei — dort greift der Bagger
     * hinein und dort setzt der Kipper zurück.
     */
    const wnd = cfg.haldeWaende ?? { rueck: true, aussen: true, trenn: true };
    const out: Obstacle[] = [];
    /*
     * Die Eintraege muessen den Steinen folgen, die man sieht — sonst steht da
     * eine Mauer, die niemand erkennt.
     *
     * Befund 12.09.2026: „zwischen der Presse und dem Mischschrottplatz gibt es
     * eine unsichtbare Barriere." Nachgemessen war der Eintrag der angedeuteten
     * Trennwand z −28,00 bis −24,00 bei 5 m Hoehe, die Steine reichen aber nur
     * von −28,00 bis −25,00 und sind 2,50 m hoch. Einen Meter weiter und
     * doppelt so hoch wie das, was dasteht — und das genau in der Luecke
     * zwischen Presse und Halde, durch die der Arm schwenkt.
     *
     * Dasselbe galt fuer die auslaufenden Waende: Sie sind am offenen Ende nur
     * noch 40 % hoch (E-091), standen hier aber als ein Kasten auf voller
     * Hoehe. Der Kollider in containers.ts macht daraus laengst zwei Stufen;
     * diese Liste zieht jetzt nach.
     */
    const BL = 1.5; // Steinlaenge, wie in containers.ts
    const halb = top * 0.55; // dieselbe Stufe wie beim Kollider
    if (wnd.rueck !== false) {
      // Laeuft zur Maschinenseite (−x) hin aus
      out.push({ x: cfg.x + hw / 4, z: cfg.z - hd / 2 - T, hw: hw / 4 + T, hd: T, top, label: `${L} Rueck` });
      out.push({
        x: cfg.x - hw / 4,
        z: cfg.z - hd / 2 - T,
        hw: hw / 4 + T,
        hd: T,
        top: halb,
        label: `${L} Rueck flach`,
      });
    }
    if (wnd.aussen !== false) {
      // Laeuft nach vorn (+z) hin aus
      out.push({ x: cfg.x + hw / 2 + T, z: cfg.z - hd / 4, hw: T, hd: hd / 4 + T, top, label: `${L} Aussen` });
      out.push({
        x: cfg.x + hw / 2 + T,
        z: cfg.z + hd / 4,
        hw: T,
        hd: hd / 4 + T,
        top: halb,
        label: `${L} Aussen flach`,
      });
    }
    if (wnd.nord === true)
      out.push({
        x: cfg.x,
        z: cfg.z + hd / 2 + T,
        hw: hw / 2 + T,
        hd: T,
        // Halbe Hoehe — der Arm greift darueber hinweg (siehe containers.ts)
        top: top / 2,
        label: `${L} Nord`,
      });
    if (wnd.trenn !== false)
      out.push({
        x: cfg.x - hw / 2 - T,
        // Nur die zwei Steinlaengen ab der hinteren Ecke, halbe Hoehe — genau
        // die Andeutung, die gebaut wird.
        z: cfg.z - hd / 2 + BL,
        hw: T,
        hd: BL,
        top: top / 2,
        label: `${L} Trenn`,
      });
    return out;
  }
  if (cfg.kind !== "bay") return []; // Haufen, Container und offene Flächen haben keine Wände
  /*
   * NUR NOCH ABGESCHRIEBEN, NICHT MEHR GERECHNET (22.09.2026, E-110).
   *
   * Hier stand die Muldengeometrie zum dritten Mal: mit eigener Wandstaerke
   * `BAY_T = 0,35` (die Steine sind 0,55 dick) und mit den Mittellinien auf
   * der Muldenkante statt auf der Steinmitte. Befund Patrick am Gerät:
   * „Kollisionsprüfung ohne Mauer bei Buntmetallmulde?" — gemessen sperrte
   * jede Flanke 0,35 m INNEN in der Mulde, wo kein Stein steht, und 0,20 m
   * gebauter Stein nach aussen stand in keiner Liste. `shareEast`,
   * `shareNorth`, `shareSouth` und `niedrigeStirn` waren hier ein zweites Mal
   * ausgewertet.
   *
   * Jetzt kommt jede Wand aus `muldenWaendeWelt(cfg)` — derselben Liste, aus
   * der die Steine gesetzt und die Rapier-Kollider gebaut werden. Wer dort
   * eine Wand weglaesst, laesst sie hier weg.
   *
   * Die Namen bleiben Himmelsrichtungen, weil Tests und Messwerkzeuge sie so
   * ansprechen: `<Mulde> Nord/Süd` fuer die Flanken einer nach Westen oder
   * Osten offenen Mulde, `West/Ost` bei Nordoeffnung, und `Stirn` bzw.
   * `Schwelle` fuer die geschlossene Stirnseite (bei Nordoeffnung `Süd`).
   */
  const nord = cfg.facing === "north";
  const L = cfg.label;
  return muldenWaendeWelt(cfg).map((wand) => {
    const flankeNS = wand.z > cfg.z ? "Nord" : "Süd";
    const flankeWO = wand.x > cfg.x ? "Ost" : "West";
    const teil =
      wand.teil === "schwelle"
        ? "Schwelle"
        : wand.teil === "stirn"
          ? nord
            ? "Süd"
            : "Stirn"
          : nord
            ? flankeWO
            : flankeNS;
    return { x: wand.x, z: wand.z, hw: wand.hw, hd: wand.hd, top: wand.top, label: `${L} ${teil}` };
  });
}

/** Seit E-189 enden die Südmauer und die Buchtschenkel an den Fasen. */
const SUED_WEST_BIS = BUCHT_X_VON - BUCHT_FASE_WEST;
const SUED_OST_VON = BUCHT_X_BIS + BUCHT_FASE_OST;

/**
 * Eine schräge Mauer als Treppe aus achsparallelen Stücken (E-189).
 *
 * `hitsObstacle` und die Fahrzeugwächter rechnen mit Rechtecken. Die Strecke
 * wird in Stücke von höchstens `TREPPE_M` Länge geteilt; jedes Stück ist das
 * Rechteck um seinen Abschnitt der Mauer (Mittellinie ± halbe Dicke). Bei 45°
 * ragt eine Stufenecke damit gut 0,1 m über die Mauerfläche (mit 0,5 m waren
 * es über 0,2 m — die Spinne schlug bei 9,2 m Ausladung an den Stufen der
 * westlichen Fase an, nicht an der Mauer) — gerechnet in `tools/schwenkanschlag.ts`, der genau diese
 * Liste fragt. Der Kollider in `yard.ts` ist ein gedrehter Quader und genau.
 */
const TREPPE_M = 0.2; // SW, Herleitung oben
function schraegeHindernisse(): Obstacle[] {
  const out: Obstacle[] = [];
  for (const sl of schraegeLaeufe()) {
    const dx = sl.x1 - sl.x0;
    const dz = sl.z1 - sl.z0;
    const l = Math.hypot(dx, dz);
    const n = Math.ceil(l / TREPPE_M);
    const qx = (Math.abs(dz) / l) * (WALL_T / 2);
    const qz = (Math.abs(dx) / l) * (WALL_T / 2);
    for (let i = 0; i < n; i++) {
      out.push({
        x: sl.x0 + (dx * (i + 0.5)) / n,
        z: sl.z0 + (dz * (i + 0.5)) / n,
        hw: Math.abs(dx) / n / 2 + qx,
        hd: Math.abs(dz) / n / 2 + qz,
        top: sl.hoehe,
        label: `Buchtfase ${sl.name === "fase-west" ? "West" : "Ost"} ${i + 1}`,
      });
    }
  }
  return out;
}

export const STATIC_OBSTACLES: Obstacle[] = [
  /*
   * --- Umrandung aus Betonlego, Einfahrt im Nordwesten ausgespart ---
   *
   * Die Suedmauer steht seit E-010 in ZWEI Stuecken: Zwischen `BUCHT_X_VON`
   * und `BUCHT_X_BIS` geht die Ausbuchtung nach Sueden auf. Als ein Eintrag
   * ueber die ganze Breite laege quer vor ihrer Oeffnung eine unsichtbare
   * Wand, und der Bagger kaeme nicht in die Bucht.
   */
  {
    x: (YARD_MIN_X + SUED_WEST_BIS) / 2,
    z: -HZ,
    hw: (SUED_WEST_BIS - YARD_MIN_X) / 2,
    hd: WALL_T / 2,
    top: WALL_H,
    label: "Südwand West",
  },
  {
    x: (SUED_OST_VON + YARD_MAX_X) / 2,
    z: -HZ,
    hw: (YARD_MAX_X - SUED_OST_VON) / 2,
    hd: WALL_T / 2,
    top: WALL_H,
    label: "Südwand Ost",
  },
  /*
   * Hinter den Mulden steht die Suedmauer hoeher (yard.ts). Ohne diesen
   * Eintrag liesse `hitsObstacle` den Greifer auf 2 m durch sie hindurch, weil
   * die Mauer dort nur mit 1,8 m verzeichnet waere.
   */
  {
    x: (SUED_HOCH_VON - SUED_HOCH_RAMPE + SUED_WEST_BIS) / 2,
    z: -HZ,
    hw: (SUED_WEST_BIS - (SUED_HOCH_VON - SUED_HOCH_RAMPE)) / 2,
    hd: WALL_T / 2,
    top: SUED_HOCH,
    label: "Südwand hoch",
  },
  {
    x: (SUED_OST_VON + YARD_MAX_X) / 2,
    z: -HZ,
    hw: (YARD_MAX_X - SUED_OST_VON) / 2,
    hd: WALL_T / 2,
    top: SUED_HOCH,
    label: "Südwand hoch Ost",
  },
  /*
   * Die Ausbuchtung: zwei Schenkel nach Sueden und die Rueckwand quer dazu,
   * alle auf `SUED_HOCH` — „rundum mit hoher Wand" (E-010).
   */
  {
    x: BUCHT_X_VON,
    z: (-HZ - BUCHT_FASE_WEST + BUCHT_Z) / 2,
    hw: WALL_T / 2,
    hd: (-HZ - BUCHT_FASE_WEST - BUCHT_Z) / 2,
    top: SUED_HOCH,
    label: "Buchtwand West",
  },
  {
    x: BUCHT_X_BIS,
    z: (-HZ - BUCHT_FASE_OST + BUCHT_Z) / 2,
    hw: WALL_T / 2,
    hd: (-HZ - BUCHT_FASE_OST - BUCHT_Z) / 2,
    top: SUED_HOCH,
    label: "Buchtwand Ost",
  },
  // Die Fasen an den vorderen Ecken (E-189), als Treppe
  ...schraegeHindernisse(),
  {
    x: (BUCHT_X_VON + BUCHT_X_BIS) / 2,
    z: BUCHT_Z,
    hw: (BUCHT_X_BIS - BUCHT_X_VON) / 2,
    hd: WALL_T / 2,
    top: SUED_HOCH,
    label: "Buchtwand Süd",
  },
  /*
   * Die Trennsteine zwischen den beiden Halden. Sie stehen hier mit ihrer
   * WIRKLICHEN Hoehe je Saeule (0,6 bis 2,4 m) — `hitsObstacle` laesst den
   * Arm ueber alles hinweg, was niedriger ist als er selbst, und genau das
   * soll hier passieren: „sodass der Zugriff von Mischschrott zu
   * Stahlschrott fluessig laeuft."
   */
  ...TRENNSTEINE.map((s, i) => ({
    x: TRENNSTEIN_X,
    z: s.z,
    hw: TRENNSTEIN_T / 2,
    hd: TRENNSTEIN_L / 2,
    top: s.hoehe,
    label: `Trennstein ${i + 1}`,
  })),
  /* Dasselbe an der Ostmauer, hinter der Presse (yard.ts). */
  {
    x: YARD_MAX_X,
    z: (-HZ + OST_HOCH_BIS) / 2,
    hw: WALL_T / 2,
    hd: (OST_HOCH_BIS + HZ) / 2,
    top: SUED_HOCH,
    label: "Ostwand hoch",
  },
  { x: YARD_MIN_X, z: 0, hw: WALL_T / 2, hd: HZ, top: WALL_H, label: "Westwand" },
  { x: YARD_MAX_X, z: 0, hw: WALL_T / 2, hd: HZ, top: WALL_H, label: "Ostwand" },
  // Nordwand in zwei Stücken links und rechts der Einfahrt
  {
    x: (YARD_MIN_X + (GATE_X - GATE_HALF)) / 2,
    z: HZ,
    hw: (GATE_X - GATE_HALF - YARD_MIN_X) / 2,
    hd: WALL_T / 2,
    top: WALL_H,
    label: "Nordwand West",
  },
  {
    x: (GATE_X + GATE_HALF + YARD_MAX_X) / 2,
    z: HZ,
    hw: (YARD_MAX_X - GATE_X - GATE_HALF) / 2,
    hd: WALL_T / 2,
    top: WALL_H,
    label: "Nordwand Ost",
  },

  // --- Mulden: aus CONFIGS erzeugt, damit sie nicht auseinanderlaufen ---
  ...CONFIGS.flatMap(bayObstacles),

  /*
   * PRESSE — WAENDE JA, DECKEL NEIN (15.09.2026, E-029).
   *
   * Befund Patrick: „Es war auch nicht moeglich, ein zusammengepresstes Auto
   * wieder aus der Presse zu holen." Hier stand die Maschine als EIN volles
   * Rechteck von 4,75 x 4,90 m auf 2,20 m Hoehe. `hitsObstacle` laesst alles
   * ueber `top` hinweg und nichts darunter hindurch — der Greifer galt damit
   * als „im Bauwerk steckend", sobald er unter die Wandkrone kam, und das
   * fertige Paket lag unerreichbar in der eigenen Kammer.
   *
   * Jetzt genau wie bei den Sortiermulden: nur der Wandring sperrt, der
   * Innenraum ist offen. Die Eintraege kommen aus `pressWaende()` und damit
   * aus derselben Rechnung wie die Rapier-Kollider — physisch war die Kammer
   * die ganze Zeit richtig gebaut (Boden plus vier Waende, oben offen), nur
   * diese Liste sagte etwas anderes.
   *
   * FUER FAHRZEUGE BLEIBT SIE ZU: Der Ring ist lueckenlos, und die lichte
   * Kammer ist 4,05 x 4,20 m — ein LKW ist 3,10 m breit und 8,04 m lang, er
   * bekommt seinen Umriss dort nicht hinein, ohne eine Wand zu schneiden
   * (`test/presse.test.ts`, `test/fahrumriss.test.ts`).
   *
   * Bis 13.09.2026 stand hier fest (−3,0 | −26,0) mit 7,8 x 5,0 m. Als die
   * Presse morgens in die Ecke gezogen ist, blieb dieser Eintrag stehen: eine
   * unsichtbare Wand mitten auf dem Platz. Seitdem kommen Lage und Mass aus
   * press.ts.
   */
  ...pressWaende().map((w) => ({
    x: w.x,
    z: w.z,
    hw: w.hw,
    hd: w.hd,
    top: w.top,
    label: `Presse ${w.teil}`,
  })),


  // --- Betriebsgebäude: Büro und Halle, hinten rechts an der Wand ---
  // Der Grundriss kommt aus office.ts, damit Bau, Kollider und Hindernis
  // nicht auseinanderlaufen.
  // Janines Kaffeewagen steht auf dem Vorplatz — ein Anhaenger ist ein
  // Hindernis wie jedes andere.
  {
    x: KAFFEE_POS.x,
    z: KAFFEE_POS.z,
    hw: KAFFEE_FUSS[0],
    hd: KAFFEE_FUSS[1],
    top: 2.6,
    label: "Kaffeewagen",
  },

  ...officeFootprints().map(([x, z, hw, hd]) => ({
    x,
    z,
    hw,
    hd,
    top: 5.4,
    label: "Betriebsgebäude",
  })),

  /*
   * Die drei Sortierhallen — nur ihre WAENDE, nicht ihre Grundflaeche.
   *
   * Bis zum 15.09.2026 stand hier je ein Vollrechteck von 7,5 x 9,0 m. Damit
   * war eine Halle nicht anfahrbar: Jeder LKW haelt 1,4 m vor einem Hindernis
   * an und hupt, und der ganze Weg aus E-011 („Haendler fahren ueber die Waage
   * in ihre Halle und laden selbst ab") lief ins Leere. Jetzt ist es wie bei
   * den Sortiermulden: drei Waende, das Tor bleibt frei.
   *
   * Die Waende kommen aus `hallenWaende()` — derselben Quelle, aus der auch
   * der Rapier-Kollider gebaut wird. Vorher waren es zwei Listen, und sie
   * zeigten in entgegengesetzte Richtungen.
   */
  ...hallenWaende().map((w) => ({
    x: w.x,
    z: w.z,
    hw: w.hw,
    hd: w.hd,
    top: 6.9,
    label: `Halle ${w.nr} ${w.teil}`,
  })),

  // Die vier Pripada-Mulden am Platzrand (E-133): volle Grundfläche, Höhe = Oberkante
  ...firmenmuldenHindernisse(),
];

/**
 * Bauwerke, die im Spiel dazukommen können. Zurzeit keine — die Ausbaustufen
 * verändern nur noch die Einrichtung, nicht den Bau (Stand 10.09.2026).
 */
let dynamicObstacles: Obstacle[] = [];

/** Gebäude-Hindernisse austauschen (Ausbaustufe geändert). */
export function setBuildingObstacles(list: Obstacle[]): void {
  dynamicObstacles = list;
}

/**
 * ALLE Bauwerke, bewegliche zuerst — fuer alles, was mit Flaechen statt mit
 * Punkten rechnet.
 *
 * `hitsObstacle` beantwortet „liegt DIESER Punkt drin?"; die Fahrzeuge
 * brauchen seit E-054 „schneidet DIESES Rechteck eines davon?", und dafuer
 * muessen sie die Liste selbst sehen. Genau dieselbe Liste, in genau
 * derselben Reihenfolge — sonst prueft der Waechter wieder etwas anderes als
 * die Fahrt. Der versetzbare Muellcontainer steht in `dynamicObstacles` und
 * ist damit eingeschlossen.
 */
export function alleHindernisse(): readonly Obstacle[] {
  return dynamicObstacles.length === 0
    ? STATIC_OBSTACLES
    : [...dynamicObstacles, ...STATIC_OBSTACLES];
}

/**
 * Liegt (x,z) in einem festen Bauwerk? `pad` erweitert es um einen
 * Sicherheitsrand. Mit `y` wird die Höhe geprüft: Der Baggerarm darf über
 * eine Mauer schwenken, nur eben nicht hindurch.
 */
export function hitsObstacle(x: number, z: number, pad = 0, y?: number): Obstacle | null {
  for (const o of dynamicObstacles) {
    if (Math.abs(x - o.x) >= o.hw + pad || Math.abs(z - o.z) >= o.hd + pad) continue;
    if (y !== undefined && y > o.top) continue;
    return o;
  }
  for (const o of STATIC_OBSTACLES) {
    if (Math.abs(x - o.x) >= o.hw + pad || Math.abs(z - o.z) >= o.hd + pad) continue;
    if (y !== undefined && y > o.top) continue;
    return o;
  }
  return null;
}

/**
 * Richtung so ablenken, dass sie an einem Bauwerk vorbeiführt statt hinein.
 * Geliefert wird ein Ausweichvektor entlang der Wand — an der Seite, an der
 * das Hindernis am nächsten endet.
 */
export function slideAround(
  x: number,
  z: number,
  dirX: number,
  dirZ: number,
  pad: number,
  out: { x: number; z: number }
): boolean {
  const o = hitsObstacle(x + dirX * pad, z + dirZ * pad, pad);
  if (!o) return false;
  // An der schmaleren Seite herauslaufen: das ist der kürzere Weg heraus
  const dx = x - o.x;
  const dz = z - o.z;
  const outX = o.hw + pad - Math.abs(dx);
  const outZ = o.hd + pad - Math.abs(dz);
  if (outX < outZ) {
    out.x = Math.sign(dx) || 1;
    out.z = dirZ * 0.35;
  } else {
    out.x = dirX * 0.35;
    out.z = Math.sign(dz) || 1;
  }
  const len = Math.hypot(out.x, out.z) || 1;
  out.x /= len;
  out.z /= len;
  return true;
}

/**
 * Wie tief steckt ein Koerper in festem Bauwerk? Meter, 0 = frei (E-138).
 *
 * WOFUER. Patrick, 17.10.2026: „Körper wie Autos gehen durch Betonwände oder
 * Scherenwände." Gemessen: Ein GEWORFENES Wrack bleibt an jeder Wand stehen
 * (CCD, 6 bis 25 m/s, `test/waendeDicht.test.ts`). Durch die Wand kommt es,
 * solange es in der Spinne HAENGT: Dann ist es kinematisch
 * (`gripSystem.attachBody`), und einen kinematischen Koerper haelt Rapier
 * an nichts Festem auf. Der Bagger prueft heute nur die Spinne selbst gegen
 * die Bauwerke (`excavator/collision.ts`) — das Auto in ihr ist 4 m lang und
 * ragt links und rechts zwei Meter hinaus. Laesst man es los, waehrend es in
 * der Wand steckt, drueckt Rapier es heraus, oft auf die falsche Seite.
 *
 * Diese Abfrage ist der Baustein fuer den Bagger: Je gehaltenem Koerper
 * fragen, und eine Bewegung, die die Tiefe wachsen laesst, zuruecknehmen —
 * genau wie heute bei der Spinne.
 *
 * Gezaehlt werden nur FESTE Koerper (Waende, Mulden, Presse, Gebaeude). Der
 * Boden zaehlt nicht mit (ein Kollider, dessen Oberkante auf Hoehe 0 liegt) —
 * das Absetzen auf dem Boden regelt der Bodenanschlag des Baggers.
 * Gesammelt, dann gemessen (v2 E-044).
 */
export function eindringtiefeInBauwerk(world: RAPIER.World, body: RAPIER.RigidBody): number {
  const paare: Array<[RAPIER.Collider, RAPIER.Collider]> = [];
  for (let i = 0; i < body.numColliders(); i++) {
    const c = body.collider(i);
    world.intersectionsWithShape(
      c.translation(),
      c.rotation(),
      c.shape,
      (o) => {
        const b = o.parent();
        if (b && b.isFixed() && !istBoden(o)) paare.push([c, o]);
        return true;
      },
      undefined,
      undefined,
      undefined,
      body
    );
  }
  let tiefe = 0;
  for (const [c, o] of paare) {
    const k = c.contactCollider(o, 0);
    if (k && k.distance < 0) tiefe = Math.max(tiefe, -k.distance);
  }
  return tiefe;
}

/** Der Boden: ein fester Quader, dessen Oberkante auf Hoehe 0 liegt. */
function istBoden(c: RAPIER.Collider): boolean {
  if (c.shapeType() !== RAPIER.ShapeType.Cuboid) return false;
  const he = c.halfExtents();
  return Math.abs(c.translation().y + he.y) < 0.02 && he.x > 20;
}
