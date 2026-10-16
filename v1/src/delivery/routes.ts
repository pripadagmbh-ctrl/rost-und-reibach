import * as THREE from "three";
import { GATE_X, WEIGH_X } from "../world/yard";
import { BAGGER_STAND, VERLADE_STAND } from "../world/baggerstand";
import {
  CONFIGS,
  bayOeffnung,
  bayVorderkante,
  lagerMuldeFuer,
  type ContainerConfig,
} from "../world/containers";

/**
 * Halteplatz auf der Brueckenwaage.
 *
 * Seit E-010 steht die Waage neben dem Buero auf x −27,5 statt mittig in der
 * Einfahrt. Jeder Weg auf den Platz beginnt und endet hier; deshalb steht der
 * Punkt einmal und wird ueberall eingesetzt.
 */
export const WAAGE_HALT: [number, number] = [WEIGH_X, 22.5];
/**
 * Erster Punkt suedlich der Waage, von dem aus sich die Wege verzweigen.
 *
 * Gesucht, nicht gegriffen: westlich davon steht das Buero (Front x −30,6),
 * oestlich Janines Kaffeewagen (ab x −25,0), noerdlich die Wiegeplatte. Bei
 * (−27,0 | 16,0) bleiben zu beiden Seiten ueber 1,6 m — mehr, als die
 * Blockadepruefung der LKW mit 1,4 m abtastet.
 */
export const VERTEILER: [number, number] = [-27.0, 16.0];

/**
 * Das Streckennetz des Platzes.
 *
 * Jede Fahrzeugart hat ihre eigene Anfahrt, Rangierstrecke und Ausfahrt.
 * Die Punkte sind bewusst hier gebündelt statt im Fahrzeugcode verstreut:
 * Sie hängen an der Platzgeometrie, und ein einziger blockierter Punkt legt
 * den ganzen Umschlag lahm. Der Kollisionstest prüft sie deshalb gegen die
 * Hindernisliste — gegen genau diese Werte, nicht gegen abgeschriebene.
 */

/**
 * Fahrspur (SW, Design-Fix 2026-08-29): Die Route läuft ausschließlich über die
 * östliche Spur und endet in einer Sackgasse — sie kreuzt WEDER die Haufen-Zonen
 * (z ≈ 8–12) NOCH den Bagger-Standplatz. Abfahrt erfolgt vorwärts über dieselbe
 * Spur, also weg vom frisch abgekippten Schrott.
 */
// ANLIEFERUNG: Nordspur über die Brückenwaage, dann rückwärts an den
// Abkippplatz vor dem Bagger. Ausfahrt vorwärts wieder über die Waage.
// Einfahrt → Brückenwaage (dort wird brutto gewogen)
export const ROUTE_IN_FWD: Array<[number, number]> = [
  [GATE_X, 40],
  [GATE_X, 28],
  WAAGE_HALT,
];
/**
 * DER ABLADEPLATZ — seit dem 14.09.2026 abends ein fester Ort in der
 * Suedostecke, und der Wagen steht mit der LAENGSSEITE zum Bagger.
 *
 * Ansage Patrick: „Ich haette gerne, dass ich LKWs nicht mehr von hinten,
 * sondern von der Seite ablade. Die Presse muss weg, da wo sie gerade steht,
 * und da kommt der LKW hin, da faehrt er rueckwaerts ran. Der Weg ist einfach
 * viel zu lang, wenn ich eine 180-Grad-Drehung machen muss."
 *
 * Was daran gemessen ist:
 *
 *  - VORHER hielt der Wagen vor dem Bagger, das Heck zum Sitz. Die
 *    Ladeflaeche lag damit RADIAL: ihre Ecken standen 8,0 bis 13,5 m vom
 *    Sitz, die hintere Haelfte ausserhalb der Reichweite (Grenze 9,2 m).
 *  - JETZT steht sie QUER. Bei Halt (6,3 | −24,0) liegt die Flaeche von
 *    z −24,0 bis −18,6 auf x 4,95 bis 7,65; ihre vier Ecken sind 5,65 · 8,35 ·
 *    6,94 · 9,04 m vom Sitz entfernt — die ganze Flaeche im Schwenkband.
 *  - Der Schwenkweg zur Mischschrott-Halde schrumpft von 180 auf 52 Grad:
 *    bei 14 Grad/s sind das 3,7 s statt 12,9 s je Griff. SEIT E-122
 *    (06.10.2026) liegt dort die STAHLSCHROTT-Halde; zum Mischschrott sind
 *    es jetzt 107 Grad (7,6 s).
 *
 * Die Stelle ist FEST, nicht mehr aus der Baggerstellung gerechnet. Sie haengt
 * an der Ecke, die die Presse geraeumt hat — und an der Muellmulde daneben:
 * Deren Nordflanke liegt auf z −25,8, die Blockadepruefung tastet mit 1,40 m,
 * also muessen zwischen Halt und Flanke mindestens 1,75 m liegen.
 */
export const ABLADE_SPUR_X = 6.3;
/*
 * VON −24,0 AUF −23,0 (15.09.2026) — gemessen, nicht verschoben.
 *
 * Befund Patrick: „Ich kann noch nicht mal die LKWs vollstaendig abladen, weil
 * ich in die Wand greife." Nachgerechnet mit dem echten Umriss aus
 * `vehicles.ts` (Ursprung = Muldenmitte, Ladeflaeche ± bedLen/2 = ± 2,70 m,
 * Standflaeche ± 4,30 m, Kipper ± 4,60 m):
 *
 *                              bei z −24,0        bei z −23,0
 *   Ladeflaeche (z)            −26,70 … −21,30    −25,70 … −20,30
 *   Suedkante bis Mauerinnen   2,00 m             3,00 m
 *     (Spinne offen 3,38 m, also 1,69 m Halbmass + Luft)
 *   Standflaeche Kipper bis Mauer  0,10 m         1,10 m
 *   naechste Ladeflaechenecke  5,58 m  ZU NAH     5,88 m  im Band
 *   fernste Ladeflaechenecke   9,17 m             8,76 m
 *
 * Bei −24,0 lag die vordere linke Ecke der Ladeflaeche mit 5,58 m UNTER der
 * inneren Grenze von 5,80 m — der Arm bekommt dort den Ausleger nicht mehr eng
 * genug zusammen. Ein Meter nach Norden bringt alle vier Ecken ins Band
 * (5,88 · 8,44 · 6,32 · 8,76 m) und schafft zugleich die Luft zur Suedmauer.
 */
export const ABLADE_HALT_Z = -23.0;
/**
 * Nordende der Abladespur — von hier setzt der Wagen zurueck.
 *
 * VON z −10,0 AUF −17,5 (15.09.2026, E-029). GEMESSEN, und zwar am
 * Ladungs-Katapult: Waehrend des Rueckwaertssetzens ist die Fuhre auf der
 * Flaeche VERRIEGELT. Je laenger der Weg, desto tiefer arbeiten sich einzelne
 * Stuecke in den Schlitz am Kipplager — und der Loeser befreit ein
 * eingeklemmtes Teil mit einem einzigen sehr grossen Stoss.
 *
 * Nachgemessen ueber 16 Ladungen mit festen Zufallssaaten, jeweils die
 * hoechste Geschwindigkeit eines Stuecks zwischen Kippbeginn und Abfahrt
 * (`test/kipper.test.ts`, „schleudert die Ladung nicht davon"):
 *
 *   Rueckweg   Mittel   Hoechstwert   ueber 130 km/h
 *   13,0 m     154        424 km/h    8 von 16
 *    9,5 m     146        298 km/h    7 von 16
 *    5,5 m     109        255 km/h    3 von 16
 *
 * Zum Vergleich die ALTE Kipperspur (x 2,0, Halt −12,5), die ebenfalls 5,5 m
 * Rueckweg hatte: Mittel 117, Hoechstwert 305, 6 von 16. Der Umzug an den
 * Abladeplatz macht den Katapult mit kurzem Rueckweg also nicht schlimmer,
 * sondern etwas besser — mit dem alten 13-m-Rueckweg waere er deutlich
 * schlimmer geworden.
 *
 * Der Katapult selbst bleibt ein offener Punkt (`docs/offene-punkte.md`); hier
 * wird er nur nicht gefuettert.
 *
 * Was die Verlegung sonst noch aendert: Der letzte Knick vor der Spur wird
 * flacher (11 statt 30 Grad aus der Suedrichtung), der Wagen kommt der
 * Ostmauer also WENIGER nahe als vorher.
 */
const ABLADE_RANGIER: [number, number] = [ABLADE_SPUR_X, -17.5];

let abladeStelle: [number, number] = [ABLADE_SPUR_X, ABLADE_HALT_Z];
let baggerOrt: (() => { x: number; z: number }) | null = null;

/**
 * Woher die Baggerstellung kommt. Einmal beim Aufbau setzen.
 *
 * Bleibt bestehen, obwohl die Abladestelle nicht mehr daran haengt: `main.ts`
 * meldet die Maschine hier an, und wer den Abladeplatz eines Tages wieder
 * mitwandern lassen will, hat die Quelle dann schon.
 */
export function setBaggerOrt(f: () => { x: number; z: number }): void {
  baggerOrt = f;
}
/** Nur gelesen, damit der Verweis nicht als tot gilt. */
export function baggerStellung(): { x: number; z: number } | null {
  return baggerOrt?.() ?? null;
}
/**
 * Abladestelle bestimmen — beim Losfahren von der Waage aufzurufen.
 *
 * Sie steht fest; die Funktion bleibt, weil `vehicles.ts` sie zu genau dem
 * Zeitpunkt aufruft, an dem die Strecke festgelegt wird. Ein Ort, der sich
 * unter dem fahrenden Wagen verschiebt, ist keine Strecke.
 */
export function neueAbladestelle(): [number, number] {
  abladeStelle = [ABLADE_SPUR_X, ABLADE_HALT_Z];
  return abladeStelle;
}

/** Wo gerade abgeladen wird — für die Spurüberwachung. */
export function abladestelle(): [number, number] {
  return abladeStelle;
}

/*
 * Nach dem Wiegen quer ueber den Platz zum Rangierpunkt noerdlich der
 * Abladespur. Der Weg laeuft noerdlich an der Muldenreihe vorbei (deren
 * noerdlichste Mulde bei z −12,5 endet).
 *
 * Seit E-029 faehrt hier JEDER Anlieferer, auch der Kipper — seine eigene
 * Spur auf x 2,0 ist weg. Die Strecke ist damit einspurig; zwei Fahrzeuge
 * gleichzeitig auf dem Platz halten sich gegenseitig auf, statt sich zu
 * kreuzen (`test/einspurig.test.ts`).
 */
export function routeApproach(): Array<[number, number]> {
  /*
   * Der letzte Knick vor der Abladespur ist flach, und das ist gerechnet:
   * Ein LKW nimmt am Wegpunkt sofort die Richtung des naechsten Stuecks an —
   * er dreht sich auf der Stelle. Steht er dabei quer zur Ostmauer, schwenkt
   * seine Ecke darueber hinaus. Bei der alten Fuehrung (−4 | −2) → (6,3 | −8)
   * stand er 60 Grad schraeg und ragte 0,49 m in die Mauer.
   *
   * Aus (4 | −4) heraus sind es nur noch 30 Grad: Seine aeusserste Ecke liegt
   * dann auf x 9,93, die Mauer steht innen bei 10,20 — 0,27 m Luft. Und der
   * Zwischenpunkt (−4 | −4) haelt ihn beim Ausschwenken nach Osten 1,55 m
   * suedlich der Flanke des untersten Silos.
   */
  return [WAAGE_HALT, VERTEILER, [-21, 10], [-12, 4], [-4, -4], [4, -6], ABLADE_RANGIER];
}
export function routeInRev(): Array<[number, number]> {
  return [ABLADE_RANGIER, abladeStelle];
}
export function routeOut(): Array<[number, number]> {
  return [
    abladeStelle,
    ABLADE_RANGIER,
    [4, -6],
    [-4, -4],
    [-12, 4],
    [-21, 10],
    VERTEILER,
    WAAGE_HALT,
    [GATE_X, 28],
    [GATE_X, 40],
  ];
}

/*
 * ABHOLUNG — zum VERLADEPLATZ vor der Silo-Reihe.
 *
 * Das ist die Umkehrung dessen, was bis zum 14.09.2026 galt. Vorher kam der
 * Abholer an die Flanke des Baggers, weil sein Container dort stehen musste,
 * wo der Arm hinkommt. Seit E-010 gibt es dafuer einen eigenen Ort: den
 * Verladeplatz zwischen Silo-Reihe und LKW-Spur, mit einem zweiten
 * Baggerstand dazwischen (−25,5 | −12). Der Abholer setzt auf x −18 zurueck,
 * die Silo-Vorderkante liegt bei x −33 — 7,5 m nach jeder Seite.
 *
 * Damit haengt die Halteposition NICHT mehr am Bagger, sondern steht fest.
 * Das ist die Entscheidung von E-011: „Silo zu Abholer — der Spieler mit dem
 * Bagger am Verladeplatz." Wer laden will, faehrt hin; eine Fahrt hin und
 * zurueck dauert gemessen 22,6 s (E-012). Die alte Rechnung, die den LKW dem
 * Bagger hinterhertrug, ginge hier auch gar nicht auf: Steht die Maschine an
 * ihrem Hauptplatz, sind es 26 m bis zur Silo-Reihe.
 *
 * Der Weg kreuzt die Anlieferung nicht: Der Kipper faehrt oestlich an den
 * Bagger, der Abholer westlich an die Silos.
 */
export const PICKUP_IN_FWD: Array<[number, number]> = [
  [GATE_X, 40],
  [GATE_X, 28],
  WAAGE_HALT,
];
/**
 * Die LKW-Spur des Verladeplatzes und der Punkt, an dem der Abholer steht.
 *
 * 7,5 m vom zweiten Baggerstand, genau so weit, wie die Silo-Vorderkante auf
 * der anderen Seite liegt. Der Bagger steht in der Mitte und dreht sich
 * zwischen beiden — er muss nicht umsetzen.
 *
 * VORZEICHEN GEWECHSELT am 15.09.2026 (E-028): Die Silo-Reihe ist an die
 * WESTwand gezogen, ihre Vorderkante liegt auf x −33,0 und damit WESTlich des
 * Stands (−25,5). Der Abholer gehoert folglich nach Osten, auf −18,0. Mit dem
 * alten `− 7,5` waere er auf −33,0 gelandet, also mitten in der Silo-Reihe.
 */
export const VERLADE_ABSTAND = 7.5;
export const VERLADE_SPUR_X = VERLADE_STAND.x + VERLADE_ABSTAND;
/**
 * Wie weit der Abholer vor seinem Halt in der Verladespur anhaelt, bevor er
 * zurueckstoesst. Dieselben 8,0 m wie seit E-010; ein Fahrer setzt nicht aus
 * der Kurve heraus zurueck.
 */
export const VERLADE_RANGIER_M = 8.0;

/* ------------------------------ DER ABHOLER HAELT DORT, WO DAS ZEUG IST -- */

/*
 * ZWEIERLEI ABHOLUNG (E-056, 15.09.2026).
 *
 * Ansage Patrick am Geraet: „Der Abholer ist in der falschen Spur. Wenn ich
 * Stahlschrott oder Mischschrott beauftrage, soll er zu mir zum Baggerstand
 * kommen. Und wenn ich ein sortenreines Metall zur Abholung ausrufe, soll er
 * genau dahin fahren, wo die entsprechende Mulde ist."
 *
 * Die Regel dahinter ist keine Liste von Fraktionen, sondern EINE Frage, die
 * der Platz selbst beantwortet: Gibt es fuer diese Fraktion ein LAGERSILO?
 *
 *   Lagersilo vorhanden  →  Verladeplatz vor GENAU DIESEM Silo (seit E-063;
 *                           bis dahin vor der Mitte des Schenkels, und genau
 *                           das war „faehrt immer noch falsch").
 *                           Alu, Zink, Kupfer, Messing, Kabel, VA,
 *                           Batterien, Abfall.
 *   kein Lagersilo       →  ABLADEPLATZ beim Bagger (6,3 | −23,0).
 *                           Stahlschrott und Mischschrott — sie haben mit
 *                           E-010 ausdruecklich keins („Stahl entfaellt —
 *                           Stahlschrott wird direkt an der Halde
 *                           verladen"), und dasselbe gilt fuer eine
 *                           Bestellung ohne Fraktion („Gemischt").
 *
 * Damit ist die Regel datengetrieben: Wer eines Tages ein Stahlsilo baut,
 * bekommt den Abholer dorthin, ohne dass hier eine Zeile geaendert wird.
 *
 * WARUM DER ABLADEPLATZ UND KEIN EIGENER PLATZ. Nachgerechnet mit dem echten
 * Umriss: Bei Halt (6,3 | −23,0) liegt die Ladeflaeche auf x 4,95 … 7,65 und
 * z −25,70 … −20,30, ihre vier Ecken sind vom Sitz (−0,5 | −22,5)
 * 5,88 · 6,32 · 8,44 · 8,76 m entfernt — alle vier im Schwenkband 5,80 bis
 * 9,20 m (dieselbe Rechnung wie E-022/E-029). Ein zweiter Platz mit
 * derselben Eigenschaft waere eine zweite Wahrheit; und die Halden liegen
 * ohnehin genau dort: Mischschrott 6,96 m, Stahlschrott 7,91 m vom Sitz
 * (seit dem Tausch E-122; vorher umgekehrt).
 */

/** Wohin diese Fuhre gehoert: das Lagersilo der bestellten Fraktion — oder keins. */
export function abholZielSilo(order: string | null): ContainerConfig | null {
  return lagerMuldeFuer(order);
}

/**
 * Aus welcher Richtung der Abholer in die Verladespur eines Schenkels
 * einfaehrt, als Einheitsvektor entlang der Spur.
 *
 * Gerechnet, nicht gegriffen — es gibt je Schenkel nur zwei Moeglichkeiten,
 * und eine davon endet in einem Bauwerk:
 *
 *   WESTschenkel  Spur laeuft in z. Von Norden: Rangierpunkt (−18,0 | 0,0),
 *                 freier Platz zwischen Waage und Silo-Gasse. Von Sueden
 *                 laege er auf (−18,0 | −16,0) — dorthin fuehrt kein Weg,
 *                 ohne die ganze Suedwesthaelfte zu queren.
 *   SUEDschenkel  Spur laeuft in x. Von Osten: Rangierpunkt (−17,4 | −7,0),
 *                 freies Feld. Von Westen laege er auf (−33,4 | −7,0) und
 *                 damit MITTEN IM KABEL-LAGER (x −39,0 … −33,0, z −10,1 …
 *                 −5,9).
 */
const SPUR_ANFAHRT: Record<string, [number, number]> = {
  east: [0, 1],
  north: [1, 0],
};

/**
 * Die Mitte eines Schenkels — das mittlere Silo.
 *
 * Bis zum 15.09.2026 abends hat hier das „Leitsilo" gestanden, und JEDER
 * Abholer dieses Schenkels hielt davor. Die Begruendung war die Reichweite:
 * Von der Mitte aus erreicht der Arm alle drei Silos (8,80 · 7,50 · 8,80 m),
 * vom Rand nur zwei.
 *
 * DAS WAR DER FEHLER, DEN PATRICK ZWEIMAL GEMELDET HAT („abholung faehrt
 * immer noch falsch", 15.09.2026). Gemessen mit `tools/abholfahrt.ts`, das
 * den Wagen wirklich faehrt statt seine Route auszurechnen: 10 von 12
 * bestellbaren Fraktionen liessen ihn 4,60 m neben ihrer Mulde halten — wer
 * Kupfer rief, bekam den Wagen vor das KABEL-LAGER, wer Edelstahl rief, vor
 * die BATTERIEN. Nur Kabel und Batterien selbst standen richtig, weil sie die
 * mittleren sind.
 *
 * Und die Reichweitenbegruendung traegt nicht: Halt und Baggerstand haengen
 * starr aneinander (7,5 m Silo→Stand, 7,5 m Stand→Spur). Wandern beide
 * gemeinsam vor die bestellte Mulde, bleiben die vier Ladeflaechenecken auf
 * genau denselben 6,72 · 6,72 · 9,25 · 9,25 m wie vorher — es aendert sich
 * nur, VOR WELCHEM Silo das Ganze steht. Verloren geht allein, dass man aus
 * drei Silos auf einmal laden koennte; bestellt wird aber immer EINE Fraktion.
 *
 * Geblieben ist die Funktion fuer die Arbeitszonen: Die decken den ganzen
 * Schenkel ab und haengen deshalb weiter an seiner Mitte.
 */
function schenkelMitte(c: ContainerConfig): ContainerConfig {
  const o = bayOeffnung(c);
  // Die Reihe steht quer zur Oeffnungsrichtung.
  const laengs = (s: ContainerConfig): number => (o.x !== 0 ? s.z : s.x);
  const schenkel = CONFIGS.filter((s) => s.lager === true && s.facing === c.facing).sort(
    (a, b) => laengs(a) - laengs(b)
  );
  return schenkel[Math.floor((schenkel.length - 1) / 2)] ?? c;
}

/**
 * Wo der Bagger steht, wenn er aus DIESEM Silo in den Container laedt.
 *
 * 7,5 m vor der Oeffnung der bestellten Mulde — seit E-063 vor ihrer eigenen
 * und nicht mehr vor der Schenkelmitte.
 */
export function verladeStandFuer(c: ContainerConfig): { x: number; z: number } {
  const o = bayOeffnung(c);
  const k = bayVorderkante(c);
  return { x: k.x + o.x * VERLADE_ABSTAND, z: k.z + o.z * VERLADE_ABSTAND };
}

/** Wo der Abholer dazu haelt — noch einmal dieselben 7,5 m weiter. */
export function verladeHaltFuer(c: ContainerConfig): [number, number] {
  const o = bayOeffnung(c);
  const k = bayVorderkante(c);
  return [k.x + o.x * VERLADE_ABSTAND * 2, k.z + o.z * VERLADE_ABSTAND * 2];
}

/** Von dort setzt er zurueck. */
function verladeRangierFuer(c: ContainerConfig): [number, number] {
  const halt = verladeHaltFuer(c);
  const r = SPUR_ANFAHRT[c.facing ?? "west"] ?? [0, 1];
  return [halt[0] + r[0] * VERLADE_RANGIER_M, halt[1] + r[1] * VERLADE_RANGIER_M];
}

/**
 * Ein Halteplatz des Abholers samt seinen drei Strecken.
 *
 * Er wird als Ganzes festgelegt, wenn der Wagen von der Waage losfaehrt, und
 * aendert sich danach nicht mehr: Ein Ziel, das unter dem rueckwaerts
 * setzenden Fahrer wegrutscht, ist keine Strecke.
 */
export interface AbholPlatz {
  /** Die bestellte Fraktion (null = gemischt). */
  order: string | null;
  /** Das Lagersilo dazu — null heisst: an der Halde beim Bagger. */
  ziel: ContainerConfig | null;
  /** Wie der Platz im HUD heisst. */
  name: string;
  /** Halteposition des Wagens (Wagenmitte). */
  halt: [number, number];
  /** Wo der Bagger dazu steht. */
  stand: { x: number; z: number };
  anfahrt: Array<[number, number]>;
  rueckweg: Array<[number, number]>;
  ausfahrt: Array<[number, number]>;
}

/** Der Halteplatz zu einer Bestellung. Reine Rechnung, ohne Nebenwirkung. */
export function abholPlatzFuer(order: string | null): AbholPlatz {
  const ziel = abholZielSilo(order);
  if (!ziel) {
    /*
     * Beim Bagger. Er benutzt die Strecken der Anlieferer unveraendert —
     * dieselbe Zufahrt, dieselbe Rangierstrecke, dieselbe Ausfahrt. Das ist
     * moeglich, weil auf dem Platz immer nur EIN Fahrzeug unterwegs ist
     * (einspurig seit E-029, `test/einspurig.test.ts`).
     */
    return {
      order,
      ziel: null,
      name: "Abladeplatz beim Bagger",
      halt: [ABLADE_SPUR_X, ABLADE_HALT_Z],
      stand: { x: BAGGER_STAND.x, z: BAGGER_STAND.z },
      anfahrt: routeApproach(),
      rueckweg: [ABLADE_RANGIER, [ABLADE_SPUR_X, ABLADE_HALT_Z]],
      ausfahrt: routeOut(),
    };
  }
  const halt = verladeHaltFuer(ziel);
  const rangier = verladeRangierFuer(ziel);
  /*
   * Von der Waage in die leere Suedwesthaelfte. Der Knick bei (−22 | 9) haelt
   * die Gerade oestlich der Hallenfront (x −30,6) und westlich der
   * Silo-Gasse; dazwischen steht auf dieser Haelfte des Platzes nichts.
   */
  const kopf: Array<[number, number]> = [WAAGE_HALT, VERTEILER, [-22, 9], rangier];
  return {
    order,
    ziel,
    name: `Verladeplatz ${ziel.label}`,
    halt,
    stand: verladeStandFuer(ziel),
    anfahrt: kopf,
    rueckweg: [rangier, halt],
    ausfahrt: [
      halt,
      rangier,
      [-22, 9],
      VERTEILER,
      WAAGE_HALT,
      [GATE_X, 28],
      [GATE_X, 40],
    ],
  };
}

/**
 * Alle Halteplaetze, die es ueberhaupt geben kann — fuer die Waechter.
 *
 * Erst die beiden Faelle ohne Silo (keine Bestellung, Stahlschrott), dann
 * einer je Lagersilo. Wer ein Silo dazustellt, bekommt seine Strecken
 * automatisch mitgeprueft; eine abgeschriebene Liste im Test wuerde das nicht.
 */
export function alleAbholPlaetze(): AbholPlatz[] {
  const out = [abholPlatzFuer(null), abholPlatzFuer("steel"), abholPlatzFuer("mixed")];
  for (const c of CONFIGS.filter((s) => s.lager === true)) {
    out.push(abholPlatzFuer(c.fractionId));
  }
  return out;
}

let abholPlatz: AbholPlatz | null = null;

/** Der Platz, an dem gerade verladen wird. */
export function aktuellerAbholPlatz(): AbholPlatz {
  return (abholPlatz ??= abholPlatzFuer(null));
}

/**
 * Halteplatz des Abholers zu dieser Bestellung festlegen.
 *
 * Bis zum 15.09.2026 stand hier EIN Ort fuer alles. Seit E-056 haengt er an
 * der Bestellung — und damit auch die drei Strecken, die `pickupApproach`,
 * `pickupInRev` und `pickupOut` liefern.
 */
export function neueAbholstelle(order: string | null = null): [number, number] {
  abholPlatz = abholPlatzFuer(order);
  return abholPlatz.halt;
}

/** Wo gerade verladen wird — fuer die Spurueberwachung. */
export function abholstelle(): [number, number] {
  return aktuellerAbholPlatz().halt;
}

export function pickupApproach(): Array<[number, number]> {
  return aktuellerAbholPlatz().anfahrt;
}
export function pickupInRev(): Array<[number, number]> {
  return aktuellerAbholPlatz().rueckweg;
}
export function pickupOut(): Array<[number, number]> {
  return aktuellerAbholPlatz().ausfahrt;
}

/* ------------------------------------------- KIPPER: gemischte Ladung ---- */

/*
 * SEIT DEM 15.09.2026 KIPPT AUCH DER KIPPER AM ABLADEPLATZ (E-029).
 *
 * Ansage Patrick: „Kipper fahren die falsche Spur. Die sollen auch, wie die
 * anderen LKWs, seitlich von mir abgeladen werden."
 *
 * Vorher hatte er eine EIGENE Spur mitten im Arbeitsbereich: x 2,0, Halt auf
 * z −12,5, Abkippfleck (2,0 | −15,5). Sie lag 7,0 bis 7,4 m vom Sitz — beste
 * Lage, aber quer durch das Feld, in dem der Spieler schwenkt. Diese Spur
 * ist ersatzlos weg; rund 3 x 9 m mitten im Schwenkband sind frei geworden.
 *
 * Er faehrt jetzt dieselbe Strecke wie die Pritschen (`routeApproach`,
 * `routeInRev`, `routeOut`) und haelt an derselben Stelle: (6,3 | −23,0),
 * Laengsseite zum Bagger. Was bleibt, ist das Kippen — es ist der einzige
 * Weg, auf dem Material ohne Spielerarbeit auf den Platz kommt, und der
 * Spieler sortiert danach nach.
 *
 * WO DIE FUHRE LANDET — gerechnet, nicht geschaetzt. Der Wagen steht mit der
 * Kabine nach NORDEN (er ist von Norden nach Sueden zurueckgesetzt), die
 * Mulde kippt ueber ihre HINTERE Kante aus, und die liegt bei
 * Halt − bedLen/2. Danach zieht er `TIP_CREEP_M` gekippt nach vorn, der Rest
 * rutscht nach:
 *
 *   Abwurfkante   (6,3 | −26,0)   7,65 m vom Sitz (−0,5 | −22,5)
 *   nach Anziehen (6,3 | −24,6)   7,12 m
 *
 * Beides mitten im Schwenkband 5,8 bis 9,2 m und weit innerhalb der 9,5 m,
 * auf die der Arm ueberhaupt noch den Boden erreicht (`test/reach.test.ts`).
 * Nach Sueden bleiben bis zur Suedmauer (innen −28,7) noch 2,56 m Auslauf,
 * nach Norden liegt der Haufen hinter dem Wagen und nicht in seiner
 * Ausfahrt. Gezeichnet in `docs/messungen/2026-09-15_kipper.svg`.
 */

/**
 * Laenge der Ladeflaeche je Fahrzeugart (m).
 *
 * EINE Quelle fuer Bau (`vehicles.ts`), Abwurfrechnung und Waechter. Bis zum
 * 15.09.2026 stand dieselbe Tabelle dreimal abgeschrieben da — in
 * `vehicles.ts`, in `test/fahrumriss.test.ts` und in `test/vehicleModel.test.ts`.
 * Der Kipper ist der laengste Wagen; wer seine Zahl an einer Stelle aendert
 * und an der anderen nicht, prueft einen Umriss, den niemand faehrt.
 */
export const BED_LEN: Record<string, number> = {
  // Der PKW-Anhaenger ist kurz — ein Kofferraum voll, keine Fuhre
  pkw: 2.4,
  wrack: 5.4,
  pritsche: 5.4,
  abholer: 5.4,
  kipper: 6.0,
};

/** Ladeflaechenlaenge eines Fahrzeugs; Unbekanntes faehrt wie eine Pritsche. */
export function bedLenFor(kind: string): number {
  return BED_LEN[kind] ?? BED_LEN.pritsche!;
}

/**
 * Wo die gekippte Fuhre liegen bleibt — Ziel der Arbeitszonen und der
 * Wegpruefung von Lambert.
 *
 * Die hintere Muldenkante des Kippers im Halt. Frueher eine gegriffene Zahl
 * („Halt − 3,0"), jetzt aus derselben Ladeflaechenlaenge gerechnet, aus der
 * der Wagen gebaut wird.
 */
export const ABKIPP_ZONE: [number, number] = [
  ABLADE_SPUR_X,
  ABLADE_HALT_Z - BED_LEN.kipper! / 2,
];

/**
 * Faehrt diese Fuhre ins Lagersilo — oder auf den Abladeplatz?
 *
 * DIE ZWEITEILUNG, die seit E-028 im Code steht und die Patrick am
 * 15.09.2026 bestaetigt hat („sortenreine Kipper fahren weiterhin zu den
 * Silos"):
 *
 *   sortenrein UND es gibt ein Lagersilo  →  die Gasse hinunter ins Silo
 *   alles andere                          →  Abladeplatz, Laengsseite
 *                                            zum Bagger
 *
 * Nur wer SELBST kippen kann, faehrt ins Silo: Eine Pritsche wird vom Bagger
 * ausgeraeumt und muss dafuer in Reichweite stehen, auch wenn ihre Ladung
 * sortenrein ist.
 *
 * Steht hier und nicht in `vehicles.ts`, weil es die eine Regel ist, an der
 * der ganze Verkehr haengt — und weil sie so kopflos zu pruefen ist.
 */
export function faehrtInsSilo(kind: string, lagerMulde: ContainerConfig | null): boolean {
  if (kind !== "kipper") return false;
  return lagerMulde !== null;
}

/* ------------------------------------------ Sortenrein: die Silo-Reihe ---- */

/**
 * Wer sortenrein anliefert, kippt in das Silo seiner Fraktion.
 *
 * Ansage 13.09.2026: „sortenreine Kipper sollen direkt in den Mulden kippen,
 * nicht bei mir." Vorher ging jede Fuhre auf den Mischschrott vor dem Bagger
 * — auch die sauber getrennte, die dort nur wieder auseinandersortiert werden
 * musste.
 *
 * Seit E-028 ist die Reihe ein L, und die Gasse ist es auch: ein Schenkel
 * laengs der Westwand, einer laengs der Suedwand, verbunden ueber die Ecke.
 * Welcher Schenkel gilt, steht nicht in der Route, sondern am Silo
 * (`facing`) — `bayApproach` bekommt deshalb seit heute den ganzen Datensatz
 * und nicht mehr nur ein z. Mit der alten Signatur haette ein Suedsilo seine
 * Anfahrt an der falschen Wand bekommen, und zwar stumm.
 */

/**
 * Gassenmitte vor dem WESTschenkel (x) und vor dem SUEDschenkel (z).
 *
 * Beide liegen 5,0 m vor der Muldenoeffnung — dieselbe Zahl wie seit E-024,
 * und sie ist gemessen, nicht gegriffen: Ein LKW schaut vier Meter voraus, und
 * zwar auf der SEHNE von seinem Standort zum Vorausschaupunkt. Mit einer Gasse
 * dichter an der Reihe liegt dieser Punkt schon hinter der Ecke, die Sehne
 * schneidet sie ab und kommt der Flanke des Nachbarsilos auf 1,74 m nahe — die
 * Schranke liegt bei 1,75 m. Ein Zentimeter, und das Fahrzeug steht fuer immer
 * (gemessen 14.09.2026: 275 s ohne einen Meter Fortschritt).
 *
 * Westschenkel: Oeffnungen auf x −33,0 → Gasse −28,0.
 * Suedschenkel: Oeffnungen auf z −22,0 → Gasse −17,0.
 *
 * Die Ecke liegt auf (−28,0 | −17,0). Dort steht ein wartender Wagen mit der
 * Kabine auf z −21,6, also 0,40 m vor der Nordkante der Suedsilos.
 */
export const MULDEN_GASSE_X = -28.0;
export const MULDEN_GASSE_Z = -17.0;
/** Die Ecke, an der beide Schenkel ineinander uebergehen. */
const GASSEN_ECKE: [number, number] = [MULDEN_GASSE_X, MULDEN_GASSE_Z];
/** Wo die Gasse von der Waage her beginnt — suedlich der dritten Halle. */
const GASSEN_KOPF: [number, number] = [MULDEN_GASSE_X, -2.0];

/**
 * Wie weit der Wagen in das Silo zurueckstoesst (Wagenmitte).
 *
 * Mit dem RICHTIGEN Heckmass gerechnet: Der Wagen reicht nicht 3,0 m nach
 * hinten, sondern bedLen/2 + 0,14 = 3,14 m (Unterfahrschutz,
 * `vehicleModel.ts`). Die alte Rechnung nahm 3,0 m an und schickte den Wagen
 * 0,70 m in die Stirnwand — gefunden hat das erst `test/fahrumriss.test.ts`.
 *
 * WEST  Stirnwand innen auf x −39,00; bei −35,40 endet das Heck auf −38,54
 *       und bleibt 0,46 m davor.
 * SUED  Rueckwand innen auf z −28,00; bei −24,40 endet das Heck auf −27,54.
 *
 * DIE ZWEI WANDLAGEN SIND AM 22.09.2026 NACHGEZOGEN (E-110). Hier stand
 * −38,65 und −27,65: die Innenflaeche, wie die Hindernisliste sie mit 0,35 m
 * Wanddicke auf der Muldenkante ausrechnete. Gebaut stehen die Steine VOR der
 * Kante und sind 0,55 m dick (`MULDE_STEIN`), die Innenflaeche liegt also auf
 * der Muldenkante selbst. Der Wagen hat damit 0,35 m MEHR Luft als hier stand,
 * nicht weniger — die Zahl wird nachgezogen, die Fahrt bleibt, wie sie ist.
 *
 * Nach vorn reicht die Ladeflaeche damit bis 0,6 m vor die Muldenoeffnung.
 * Die Blockadepruefung laesst das zu: Sie tastet mit 1,40 m Radius, die
 * Flanken stehen mit ihrer Innenflaeche 2,10 m von der Mittellinie entfernt —
 * es bleiben 0,70 m Luft je Seite.
 */
const MULDE_TIEFE_X = -35.4;
const MULDE_TIEFE_Z = -24.4;

/** Steht dieses Silo am Suedschenkel? (Oeffnung nach Norden.) */
function amSuedschenkel(c: ContainerConfig): boolean {
  return c.facing === "north";
}

/** Halteplatz in der Gasse vor diesem Silo. */
function gassenHalt(c: ContainerConfig): [number, number] {
  return amSuedschenkel(c) ? [c.x, MULDEN_GASSE_Z] : [MULDEN_GASSE_X, c.z];
}
/** Wo die Wagenmitte beim Kippen steht. */
function muldenHalt(c: ContainerConfig): [number, number] {
  return amSuedschenkel(c) ? [c.x, MULDE_TIEFE_Z] : [MULDE_TIEFE_X, c.z];
}

export function bayApproach(c: ContainerConfig): Array<[number, number]> {
  /*
   * Von der Waage senkrecht nach Sueden in die Gasse. Der Knick bei (−27 | 6)
   * haelt den Wagen von der Hallenfront (x −30,6) weg: Er schwenkt dort nur
   * 7 Grad aus der Suedrichtung, seine westlichste Ecke liegt damit auf
   * −30,02 — 0,58 m Luft. Ein schaerferer Knick kostete pro Grad rund 7 cm.
   */
  const kopf: Array<[number, number]> = [WAAGE_HALT, VERTEILER, [-27, 6], GASSEN_KOPF];
  if (!amSuedschenkel(c)) return [...kopf, gassenHalt(c)];
  return [...kopf, GASSEN_ECKE, gassenHalt(c)];
}
export function bayInRev(c: ContainerConfig): Array<[number, number]> {
  return [gassenHalt(c), muldenHalt(c)];
}
export function bayOut(c: ContainerConfig): Array<[number, number]> {
  const zurueck: Array<[number, number]> = amSuedschenkel(c)
    ? [muldenHalt(c), gassenHalt(c), GASSEN_ECKE, GASSEN_KOPF]
    : [muldenHalt(c), gassenHalt(c), GASSEN_KOPF];
  return [...zurueck, [-27, 6], VERTEILER, WAAGE_HALT, [GATE_X, 28], [GATE_X, 40]];
}

/**
 * Warteplaetze: nach dem Abladen stellen sich vor allem die Haendler dort ab
 * und quatschen, bevor sie fahren. Das haelt Betrieb auf dem Platz — und macht
 * den Abladeplatz sofort fuer den Naechsten frei (Wunsch 02.09.2026).
 *
 * Der LKW faehrt dafuer auf (x | z − PARK_ANFAHRT_M) und setzt von dort nach
 * NORDEN zurueck; am Ende steht er mit dem Heck zur Wand (`vehicles.ts`).
 * Zwei der drei Plaetze liegen deshalb wieder an der Nordwand oestlich der
 * Einfahrt, wo sie bis E-010 schon standen — dort stehen seit dem 15.09.2026
 * keine Hallen mehr.
 *
 * Gesucht, nicht gegriffen. Eine Standflaeche misst 3,10 x 8,60 m:
 *
 *   (−18,5 | 24)  x −20,05 … −16,95 — 0,4 m neben der Torspur (x −22 ± 1,55)
 *   (−14,5 | 24)  x −16,05 … −12,95 — 0,95 m westlich von Janines Kaffeewagen
 *                 (der belegt x −12,0 … −7,0)
 *   (−26,0 |  6)  vor dem Tor der dritten Halle, 3,05 m davor; die Waagenspur
 *                 (x −27,5, z 14 … 26) bleibt frei, der Wagen endet auf z 10,3
 *
 * Warum nicht drei an der Nordwand: Oestlich von Janine bleibt zwischen ihr
 * und der Silo-Gasse (x −1,5, Wagenflanke bis 0,05) kein Streifen von 3,10 m
 * uebrig — nachgerechnet 3,45 m zwischen Gassenflanke und Silo-Wand, und
 * darin stuende der Wartende dann wieder im Weg.
 */
export const PARK_SLOTS: Array<[number, number]> = [
  [-18.5, 24],
  [-14.5, 24],
  [-26.0, 6],
];
/**
 * Wie weit suedlich des Platzes der LKW anhaelt, bevor er rueckwaerts an die
 * Wand setzt. Ein Fahrer stellt sich nicht mit der Schnauze an die Mauer.
 */
export const PARK_ANFAHRT_M = 8;
/** So lange bleibt ein Fahrzeug stehen (s) */
export const PARK_TIME_S: [number, number] = [45, 120];

/** Der Punkt, an dem der Fahrer anhaelt, bevor er rueckwaerts in die Bucht setzt. */
export function parkAnfahrt(slot: [number, number]): [number, number] {
  return [slot[0], slot[1] - PARK_ANFAHRT_M];
}

/**
 * DER WEG ZUM WARTEPLATZ — seit E-098 eine STRECKE wie jede andere.
 *
 * Bis zum 17.09.2026 rechnete `vehicles.toPark` mit `dx/dz` eine LUFTLINIE
 * vom Abladeplatz zur Bucht und schrieb sie direkt auf `group.position`. Das
 * ging an `advance()` vorbei und damit an `isBlockedByBuilding()` — was auf
 * dieser Linie stand, kam in keiner Liste vor, die irgendjemand prueft.
 * Gemessen (E-097): 3,10 m Blech im MUELL-Container, die volle Fahrzeugbreite,
 * und zwar schon an seinem STARTPLATZ. Die Linie vom Abladeplatz (6,3 | −23)
 * zum Anfahrtspunkt des Westwarteplatzes (−26 | −2) schneidet (−2,80 | −17,08).
 *
 * DIE REPARATUR IST KEIN NEUER WEG, SONDERN DER BEKANNTE. Der Wagen faehrt
 * die AUSFAHRT ab, die er ohnehin faehrt, und biegt an dem Punkt zur Bucht
 * ab, der ihr am naechsten liegt. So macht es ein Fahrer auf dem Hof auch: Er
 * faehrt die Spur und biegt ab, er schneidet nicht quer ueber die Flaeche.
 *
 * WARUM DER NAECHSTE PUNKT UND NICHT DER LETZTE. Abgetastet mit dem echten
 * Umriss (`tools/parkweg-probe.ts`, 17.09.2026) ueber alle fuenf Ausfahrten
 * und alle drei Buchten: Die Abzweigung am naechstgelegenen Streckenpunkt ist
 * in JEDEM der 15 Faelle frei (0,00 m). Der letzte Punkt waere es nicht — vom
 * Tor (−22 | 40) aus steckt die Ecke 0,60 m in der Nordwand Ost, von der
 * Waage (−27,5 | 22,5) aus 0,55 bis 0,60 m im Betriebsgebaeude. Geprueft
 * bleibt es trotzdem: Die Strecke steht seit E-098 in `test/strecken.ts` und
 * wird von `test/fahrumriss.test.ts` und `test/rangierknick.test.ts`
 * abgefahren.
 */
export function routeToPark(
  ausfahrt: Array<[number, number]>,
  slot: [number, number]
): Array<[number, number]> {
  const bucht = parkAnfahrt(slot);
  let abzweig = 0;
  let naechster = Infinity;
  for (let i = 0; i < ausfahrt.length; i++) {
    const d = Math.hypot(ausfahrt[i]![0] - bucht[0], ausfahrt[i]![1] - bucht[1]);
    if (d < naechster) {
      naechster = d;
      abzweig = i;
    }
  }
  const bis: Array<[number, number]> = ausfahrt
    .slice(0, abzweig + 1)
    .map((p) => [p[0], p[1]] as [number, number]);
  return [...bis, bucht];
}

/**
 * Die letzten acht Meter: rueckwaerts aus der Anfahrt in die Bucht.
 *
 * Dieselben zwei Punkte, die `test/strecken.ts` seit E-081 als „Parken n"
 * fuehrt — jetzt faehrt das Fahrzeug sie auch wirklich ab, statt sie mit
 * `dx/dz` nachzubilden. Rueckwaerts heisst `poseAuf(..., true)`: Die Bahn
 * zeigt nach Norden, die Kabine steht um 180 Grad gedreht, der Wagen endet
 * also mit dem Heck an der Wand — genau die Lage, die `parkRueck` bis heute
 * mit `rotation.y = Math.PI` hart gesetzt hat.
 */
export function routeParkRueck(slot: [number, number]): Array<[number, number]> {
  return [parkAnfahrt(slot), [slot[0], slot[1]]];
}

export const SPEED = 4.8; // m/s (SW) — zuegiger Umschlag
export const FIRST_DELAY_S = 12; // (SW)
/**
 * DER START IM SANDKASTEN (E-131). Patrick, 16.10.2026: "Es sollen mehr LKWs
 * kommen am Anfang". Drei Fuhren stehen beim Start schon beladen auf den
 * drei Warteplaetzen (`PARK_SLOTS`), und die erste rollt nach 3 s statt nach
 * `FIRST_DELAY_S`. Die Fahrt von jedem Platz an den Abladeplatz faehrt
 * `test/anstehen.test.ts` mit jeder Fahrzeugart ab. Beide SW.
 */
export const ANSTEH_START_ANZAHL = 3;
export const ANSTEH_ERSTER_S = 3;
export const NEXT_DELAY_S: [number, number] = [7, 15]; // (SW) — dichter Umschlag
/** Sicherheitsabstand zum Bagger: darunter wartet der Fahrer (Briefing Kap. 13) */
export const BLOCK_RADIUS = 5.5;
/** Ab diesem Gewicht gilt ein liegendes Teil als echtes Hindernis (SW) */
export const BLOCKING_MASS_KG = 120;
export const HONK_AFTER_S = 10;
/** Halbe Innenbreite der Ladefläche (SW) — größer als das breiteste Großteil */
export const BED_HALF_W = 1.35;
/**
 * Je Silo-Schenkel eine Arbeitszone, mittig zwischen Bagger und Abholer.
 *
 * 3,5 m vom Stand in Richtung der Muldenoeffnung, Radius 11 m — dieselben
 * Zahlen, mit denen der Westschenkel seit E-028 laeuft, nur nicht mehr
 * abgeschrieben.
 */
function verladeZonen(): Array<[number, number, number]> {
  const gesehen = new Set<string>();
  const out: Array<[number, number, number]> = [];
  for (const c of CONFIGS.filter((s) => s.lager === true)) {
    const seite = c.facing ?? "west";
    if (gesehen.has(seite)) continue;
    gesehen.add(seite);
    /*
     * Ein Kreis JE SCHENKEL, um dessen Mitte — nicht um den Stand der
     * bestellten Mulde. Seit E-063 wandert der Verladeplatz laengs des
     * Schenkels mit der Bestellung; die Zone bleibt, wo sie war, und deckt
     * mit ihren 11 m beide Enden mit ab (das aeusserste Silo liegt 4,60 m
     * neben der Mitte, der Halt damit 6,12 m vom Zonenmittelpunkt).
     */
    const stand = verladeStandFuer(schenkelMitte(c));
    const o = bayOeffnung(c);
    out.push([stand.x + o.x * 3.5, stand.z + o.z * 3.5, 11]);
  }
  return out;
}

/**
 * Arbeitszonen, in denen liegender Schrott NICHT als Blockade gilt: Genau
 * dorthin wird abgekippt bzw. verladen — dort muss das Fahrzeug hin.
 * [x, z, radius]
 */
export const WORK_ZONES: Array<[number, number, number]> = [
  /*
   * Der Vorplatz vor dem Bagger. Hier kippte bis zum 15.09.2026 der
   * Selbstabkipper ab; seit E-029 faehrt er an den Abladeplatz. Der Kreis
   * bleibt, weil hier weiterhin liegt, was dem Spieler aus der Spinne
   * faellt — ohne ihn haelt der naechste Wagen davor an und hupt.
   */
  [0, -13, 11],
  /*
   * Der Abladeplatz in der Suedostecke (seit 14.09.2026 abends): Dort steht
   * der Haendler quer, und dort liegt zwangslaeufig Material, waehrend der
   * Spieler ihn ausraeumt. Ohne diese Zone haelt der naechste Wagen davor an
   * und hupt, weil sein eigener Vorgaenger etwas hat liegen lassen.
   */
  [ABLADE_SPUR_X, ABLADE_HALT_Z, 9],
  /*
   * Die Verladeplaetze vor den Silo-Schenkeln: Dort steht der Abholer, und
   * dort liegt zwangslaeufig Material, waehrend der Bagger ihn belaedt. Der
   * Mittelpunkt liegt jeweils zwischen Bagger und LKW-Spur.
   *
   * Seit E-056 sind es ZWEI — einer je Schenkel. Sie werden aus derselben
   * Rechnung erzeugt wie die Halteplaetze selbst; eine abgeschriebene Zone
   * bliebe beim naechsten Umzug der Reihe an der alten Stelle liegen, und
   * dann haelt der Abholer vor seinem eigenen Verladeplatz an und hupt.
   */
  ...verladeZonen(),
  /*
   * Die L-foermige Silo-Reihe samt Gasse. Dorthin kippt der sortenreine
   * Kipper; was dort liegt, ist Ziel und nicht Hindernis. Ein Kreis je
   * Schenkel, damit kein Radius quer ueber den halben Platz greift:
   *
   *   WEST  Silos auf x −36,0 von z −3,4 bis −12,6, Gasse auf x −28,0.
   *         Von (−32,0 | −8,0) sind es 6,9 m in die entfernteste Ecke.
   *   SUED  Silos auf z −25,0 von x −30,0 bis −20,8, Gasse auf z −17,0.
   *         Von (−25,4 | −21,0) sind es 10,1 m in die entfernteste Ecke.
   */
  [-32.0, -8.0, 9],
  [-25.4, -21.0, 11],
];
/** Nach so langer Blockade fährt der Fahrer vorsichtig weiter (kein Deadlock) */
export const BLOCK_GIVEUP_S = 35;

export const TIP_ANGLE = THREE.MathUtils.degToRad(58); // (SW) steil genug für sperrige Großteile
/**
 * Wie weit der Kipper mit oben stehender Mulde anzieht, bevor er sie senkt.
 * Senkt er im Stand, bleibt Schrott auf der Fläche liegen, sobald unten schon
 * etwas im Weg liegt — und das wird mit jeder Fuhre wahrscheinlicher.
 *
 * Kurz gehalten mit Absicht. Der Bagger erreicht den Boden nur zwischen 3,0
 * und 9,5 m (gemessen aus der Armgeometrie). Seit E-029 zieht der Wagen am
 * Abladeplatz nach NORDEN an, also auf den Bagger zu: Die Abwurfkante wandert
 * von 7,65 auf 7,12 m. Weiter anziehen hiesse, den Rest der Fuhre unter die
 * 5,8-m-Grenze zu schieben, wo der Arm nicht mehr eng genug zusammenkommt.
 */
export const TIP_CREEP_M = 1.4;
export const TIP_CREEP_SPEED = 1.1; // m/s — Schritttempo, damit man das Abrutschen sieht
/** Wie weit der Händlerkran beim Andocken zur Seite schwenkt (aus dem Weg). */
export const CRANE_SWING = THREE.MathUtils.degToRad(78);
