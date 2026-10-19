/**
 * Verbundobjekt-Definitionen (Briefing Kap. 8): datengetrieben — ein neues
 * Wrack braucht nur eine neue Def + Maße, keinen Code.
 * Alle Zahlen Startwerte (SW).
 */

import { type Anteil } from "../materials/purity";

export interface PartDef {
  id: string;
  name: string;
  materialId: string;
  massKg: number;
  /** Woraus das Teil besteht — ein Rad ist Reifen plus Felge. */
  zusammensetzung?: Anteil[];
  /** Faellt beim Zerquetschen auseinander (Rad: Reifen und Felge). */
  trennbar?: boolean;
  /** Sekunden Ziehen über der Lösekraft bis zum Abriss */
  tearSeconds: number;
  /** Greifradius um den Ankerpunkt, in dem die Spinne die Part statt des Rumpfs fasst */
  grabRadius: number;
  /** Ankerpunkt lokal zum Rumpf */
  anchor: [number, number, number];
  /** Box-Maße der losgelösten Part [w,h,d] bzw. Rad [radius, breite] */
  size: number[];
  /**
   * `box` ein Kasten (mit `stuecke` mehrere), `wheel` ein Rad — immer mit
   * Felge (E-185) —, `haube` ein Deckel, der aus der Haut der Fassung
   * geschnitten wird (`WrackformDef.haube`). Gibt es an einer Fassung keine
   * Haube (A, B, Bestand), fällt das Teil weg.
   */
  kind: "box" | "wheel" | "haube";
  color: number;
  /**
   * DIE SPERRE (E-185, Zerstörungskonzept B1): Dieses Teil lässt sich erst
   * greifen oder abbeißen, wenn ALLE hier genannten Teile ab sind. Ein Teil,
   * das es an diesem Wrack nicht gibt, zählt als ab. Gefragt wird nur in
   * `findPartNear` — die eine Stelle, über die Greifen und Biss gehen.
   */
  sperre?: string[];
  /**
   * Weitere Kästen für das Bild, Mitte RELATIV zum Anker, Maße in m — das
   * Getriebe am Motor, die Pole der Batterie. Sie gehen mit dem Teil ab; der
   * lose Kollider ist der Quader um alles.
   */
  stuecke?: { size: [number, number, number]; at: [number, number, number]; farbe: number }[];
}

/**
 * EIN ANGEBAUTES TEIL — Stoßstange, Grill, Leuchte, Spiegel.
 *
 * Nichts davon geht je einzeln ab (anders als `PartDef`: Motor, Getriebe,
 * Räder). Alle Anbauteile landen deshalb in EINEM Netz mit Eckpunktfarben
 * (E-111) und sind im Szenengraph nicht mehr einzeln ansprechbar. Das ist der
 * Preis; dafür kostet ein Wrack 26 statt 50 Zeichenrufe.
 *
 * ANTEILE STATT METER — und zwar nur waagerecht. Damit ein neues Modell
 * (Kleinwagen, Kombi, Transporter) nur andere Maße braucht und keinen Code,
 * stehen x und z als Anteile: x vom HALBEN `chassis`-Breitenmaß, z von der
 * HALBEN `chassis`-Länge, die Breite eines Teils vom GANZEN Breitenmaß.
 *
 * Die HÖHE bleibt in Metern. Eine Stoßstange sitzt beim Kleinwagen so hoch wie
 * bei der Limousine — Stoßstangenhöhe und Scheinwerferhöhe sind in
 * Zulassungsvorschriften absolut festgelegt, nicht als Anteil der Fahrzeuglänge.
 * Wer das für ein Modell doch verschieben will, schreibt eine andere Zahl hin.
 */
export interface AnbauDef {
  name: string;
  /** [Breite als ANTEIL der Karosseriebreite, Höhe in m, Tiefe in m] */
  size: [number, number, number];
  /** [x als Anteil der HALBEN Breite, y in m, z als Anteil der HALBEN Länge] */
  anchor: [number, number, number];
  /** Auch spiegelbildlich auf der anderen Seite bauen (Leuchten, Spiegel). */
  paarweise?: boolean;
  /**
   * x kommt aus der Karosserie statt aus `anchor[0]` (E-127): Die Innenseite
   * liegt an der breitesten Stelle der Flanke, die das Teil auf seiner Höhe
   * berührt (`aufDieFlanke` in `wrackformen.ts`). Nur bei Fassungen mit
   * Längsschnitt; `anchor[0]` steht dann auf 0 und wird nicht gelesen.
   */
  amFlanke?: boolean;
  /** sRGB-Hex; wandert in die Eckpunktfarben des gemeinsamen Netzes. */
  farbe: number;
}

/**
 * DIE KAROSSERIEMASSE — bis E-111 standen sie als `BoxGeometry(1.7, 0.55, 4.0)`
 * mitten im Code, dazu zwanzig feste Koordinaten in `baueAnbauteile`. Regel 3
 * (jede Zahl hat eine Herkunft) war damit nur halb erfüllt, und ein zweites
 * Modell hätte einen zweiten Codepfad gebraucht.
 */
export interface KarosserieDef {
  /** Chassis [Breite, Höhe, Länge] in m */
  chassis: [number, number, number];
  /** Mitte des Chassis über dem Rumpfursprung, in m */
  chassisY: number;
  /** Kabine [Breite, Höhe, Länge] in m */
  kabine: [number, number, number];
  /** Mitte der Kabine über dem Rumpfursprung, in m */
  kabineY: number;
  /** Längssitz der Kabine als Anteil der HALBEN Chassislänge (0 = Mitte) */
  kabineZ: number;
  /** Bogenradius eines Radlaufs = Radradius + diese Luft, in m */
  radlaufLuft: number;
  /** Rohrdicke des Bogens, in m */
  radlaufDicke: number;
  /** Der Bogen sitzt so viel weiter außen UND höher als die Radmitte, in m */
  radlaufVersatz: number;
  anbau: AnbauDef[];
}

export interface WindowDef {
  id: string;
  anchor: [number, number, number];
  /** [Breite, Höhe] */
  size: [number, number];
  rotY: number;
}

export interface CarDef {
  /** Physik-Gesamtmasse beim Spawn (Rumpf + Parts) */
  totalMassKg: number;
  /** Rumpf ohne Parts — zählt als Mischschrott auf dem Haufen */
  hullMassKg: number;
  hullMaterialId: string;
  /** Woraus der Rumpf besteht — ein Auto ist nie sortenrein. */
  hullZusammensetzung?: Anteil[];
  /** Kollider-Halbmaße [x,y,z] + y-Offset */
  colliderHalf: [number, number, number];
  colliderYOffset: number;
  /** Quetschstufen: Y-Skalierung der Karosse je Stufe (0 = heil) */
  crushScales: [number, number, number];
  /** Aufprall-Schwellen (Δv in m/s): Scheiben / Quetschstufe */
  glassImpactDv: number;
  crushImpactDv: number;
  /** Chassis, Kabine, Anbauteile — alles, was das Wrack aussehen lässt */
  karosserie: KarosserieDef;
  parts: PartDef[];
  windows: WindowDef[];
  /**
   * Grundtöne, aus denen der Standort den Lack zieht (E-135). Fehlt die Liste,
   * gilt die Autopalette (`AUTOLACK`). Ein Wohnwagen ist cremeweiß, kein Rot.
   */
  lackPalette?: number[];
  /**
   * So weit liegt die Wrackmitte auf dem Abschlepper VOR der Flächenmitte, m
   * (E-135). Fehlt es: mittig, wie jedes Auto.
   */
  ladeVersatz?: number;
  /** Rückwärts aufladen — Schnauze bzw. Deichsel zum Heck des Abschleppers (E-135). */
  ladeRueckwaerts?: boolean;
}

/**
 * Die Felge eines Rades (E-185, Patrick 20.10.2026: „Reifen haben immer
 * felge"): Stahlfelge, silbern lackiert. // SW: Farbe am Bild abzustimmen
 */
export const FELGE_FARBE = 0xa9adb2;

/**
 * Was ein Rad ist (E-185): Reifen mit Stahlfelge, immer zusammen. Anteile
 * Reifen 70 % / Felge 30 % (Zerstörungskonzept 20.10.2026, Ansage 12.09.).
 * Nach der einen Regel (`purity.fraktionVonTeil`, 95 % für sortenrein) ist
 * ein solches Rad MISCHSCHROTT — wie die losen Räder im Katalog (E-173).
 */
export const RAD_ZUSAMMENSETZUNG = [
  { materialId: "tires", anteil: 0.7 },
  { materialId: "steel", anteil: 0.3 },
];

export const CAR_DEF: CarDef = {
  totalMassKg: 950,
  /*
   * 600 → 563 kg (E-185): Motorhaube 15, Batterie 15 und Kühler 7 kg kommen
   * aus der Karosse und gehen jetzt einzeln ab. Das Wrack wiegt weiter 950 kg
   * — umverteilt, nicht weggenommen (E-114).
   */
  hullMassKg: 563,
  /*
   * Ein Auto ist Mischschrott — auch gepresst (Ansage 12.09.2026: „ein Auto
   * ist immer Mischschrott, da sind so viele Komponenten dran mit Sitzen und
   * so was, das kann gar kein Stahlschrott sein, auch gepresst kein
   * Stahlschrott, es bleibt Mischschrott").
   *
   * Bisher stand hier „steel", und damit zaehlte eine ausgeschlachtete
   * Karosse als sortenreiner Stahl und ging als Stahlpaket aus der Presse.
   * Die Zusammensetzung sagt, warum das nicht stimmt: Unter dem Blech stecken
   * Sitze, Verkleidung, Daemmung, Scheiben und Kabelbaum. Nach der Regel aus
   * E-065 (sortenrein erst ab 95 %) faellt das Ganze auf Mischschrott — und
   * so bleibt es auch, wenn es durch die Presse geht.
   */
  hullMaterialId: "mixed",
  hullZusammensetzung: [
    { materialId: "steel", anteil: 0.68 },
    { materialId: "plastic", anteil: 0.14 },
    { materialId: "rubble", anteil: 0.08 },
    { materialId: "alu", anteil: 0.05 },
    { materialId: "cable", anteil: 0.03 },
    { materialId: "tires", anteil: 0.02 },
  ],
  colliderHalf: [0.85, 0.55, 2.0],
  colliderYOffset: 0.55,
  crushScales: [1, 0.76, 0.55],
  glassImpactDv: 4.5,
  crushImpactDv: 7,
  /*
   * ALLE ZAHLEN HIER SIND DIE, DIE VORHER IM CODE STANDEN (E-111, reiner
   * Umbau, Abweichung null). Die Anteile stehen absichtlich als Division da:
   * So ist links die Zahl von vorher zu lesen und rechts, worauf sie sich
   * bezieht — `1.94 / 2.0` heißt „1,94 m bei 2,0 m halber Länge".
   */
  karosserie: {
    chassis: [1.7, 0.55, 4.0],
    chassisY: 0.28,
    kabine: [1.5, 0.55, 2.0],
    kabineY: 0.83,
    kabineZ: -0.2 / 2.0,
    // 0,42 m Bogen über einem 0,33 m Rad; der Bogen sitzt 1 cm weiter außen
    // und höher als die Radmitte, sonst schneidet er den Reifen.
    radlaufLuft: 0.09,
    radlaufDicke: 0.055,
    radlaufVersatz: 0.01,
    anbau: [
      { name: "Stoßstange vorn", size: [1.5 / 1.7, 0.16, 0.16], anchor: [0, 0.22, 1.94 / 2.0], farbe: 0x24262a },
      { name: "Stoßstange hinten", size: [1.5 / 1.7, 0.16, 0.16], anchor: [0, 0.22, -1.94 / 2.0], farbe: 0x24262a },
      { name: "Kühlergrill", size: [1.0 / 1.7, 0.16, 0.06], anchor: [0, 0.42, 1.92 / 2.0], farbe: 0x9aa0a6 },
      /*
       * Leuchten: Vorher trugen sie ein eigenes Material mit schwachem
       * Eigenleuchten (0x2a2418 bzw. 0x2a0806). Eckpunktfarben können kein
       * Eigenleuchten tragen, deshalb ist es hier in die Farbe hineingerechnet
       * — aufgehellt um genau diesen Betrag. Aus der Entfernung, in der man ein
       * Wrack sieht, ist das derselbe Anblick (E-111).
       */
      { name: "Scheinwerfer", size: [0.3 / 1.7, 0.16, 0.06], anchor: [0.52 / 0.85, 0.44, 1.9 / 2.0], paarweise: true, farbe: 0xfffff4 },
      { name: "Rückleuchte", size: [0.26 / 1.7, 0.18, 0.06], anchor: [0.55 / 0.85, 0.42, -1.9 / 2.0], paarweise: true, farbe: 0xb82b1e },
      // Der Spiegel steht über die Karosserie hinaus, sein Anteil ist > 1.
      { name: "Außenspiegel", size: [0.16 / 1.7, 0.1, 0.08], anchor: [0.92 / 0.85, 1.0, 0.62 / 2.0], paarweise: true, farbe: 0x24262a },
    ],
  },
  /*
   * DER MOTORRAUM IN ECHTER REIHENFOLGE (E-185, Zerstörungskonzept 20.10.2026,
   * Patricks Antworten): erst die Haube, dann Batterie und Kühler, dann Motor
   * und Getriebe als EIN Block. „Um motor/getriebe zu entfernen, muss erst
   * motorhaube entfernt werden." Die Anker liegen alle im Vorderwagen der
   * Fassung C (z 0,80 … 2,00 m, Oberkante 0,86 m) und überschneiden sich
   * nicht; die Räder stehen bei x ±0,70 … 0,94 daneben.
   */
  parts: [
    {
      id: "haube",
      name: "Motorhaube",
      /*
       * Lackiertes Dünnblech: nach der einen Regel (`purity.fraktionVonTeil`,
       * Stahlschrott erst ab 6 mm Wand, E-042) Mischschrott — wie das „Blech"
       * im Katalog. Das Konzept schrieb „Stahl"; die Regel geht vor.
       */
      materialId: "mixed",
      // SW (Konzept): Stahlhaube eines Kompaktwagens 12–18 kg
      massKg: 15,
      // SW (Konzept): zwei Scharniere und ein Schloss, schneller als ein Rad
      tearSeconds: 1.0,
      // SW: deckt die Haube (1,46 x 1,09 m) bis kurz vor die Kotflügel
      grabRadius: 0.75,
      // Anker und Maße kommen aus der Haut der Fassung (`wrackDaten`); hier nur Platzhalter.
      anchor: [0, 0.87, 1.33],
      size: [1.46, 0.08, 1.09],
      kind: "haube",
      color: 0x6e5a4e,
    },
    {
      id: "batterie",
      name: "Batterie",
      // Starterbatterie: Blei, eigene BATTERIEN-Box (Konzept). // SW 15 kg: 60-Ah-Batterie 14–16 kg
      materialId: "battery",
      massKg: 15,
      tearSeconds: 0.8,
      grabRadius: 0.4,
      // Rechts hinten im Motorraum, vor der Spritzwand (0,80 m)
      anchor: [0.5, 0.66, 0.95],
      size: [0.24, 0.19, 0.17],
      kind: "box",
      color: 0x1f2124,
      sperre: ["haube"],
      stuecke: [
        // Pluspol und Minuspol // SW, Augenmaß
        { size: [0.035, 0.03, 0.035], at: [0.07, 0.11, 0.04], farbe: 0xa8322a },
        { size: [0.035, 0.03, 0.035], at: [-0.07, 0.11, 0.04], farbe: 0x8a8f95 },
      ],
    },
    {
      id: "kuehler",
      name: "Kühler",
      // Alu-Netz mit Kunststoffkästen; als Alu gerechnet wie im Konzept. // SW 7 kg
      materialId: "alu",
      massKg: 7,
      tearSeconds: 1.0,
      grabRadius: 0.45,
      // Ganz vorn hinter dem Grill (2,00 m), vor dem Motor
      anchor: [0, 0.56, 1.8],
      size: [0.64, 0.36, 0.04],
      kind: "box",
      color: 0x8a9096,
      sperre: ["haube"],
      stuecke: [
        // Wasserkasten oben und unten // SW
        { size: [0.66, 0.04, 0.06], at: [0, 0.2, 0], farbe: 0x26282b },
        { size: [0.66, 0.04, 0.06], at: [0, -0.2, 0], farbe: 0x26282b },
      ],
    },
    {
      /*
       * Die Kennung bleibt „engine": Spielstände, Aufgaben und Werkzeuge
       * reißen den Motor unter diesem Namen heraus.
       */
      id: "engine",
      name: "Motor mit Getriebe",
      /*
       * Alu, nicht Stahl (Ansage 12.09.2026: „einzelne Teile wie der Motor
       * sind Alubloecke, die, wenn man die rausreisst, hat man Aluminium").
       * Ein moderner Motorblock ist aus Aluminiumguss; das Stahlinnenleben
       * bleibt im Rumpf. „Getriebe ist eigentlich auch Alu" (12.09.2026).
       *
       * EIN BLOCK (Patrick, 20.10.2026, Frage 1 B): Motor und Getriebe kommen
       * zusammen heraus. Masse 150 + 70 = 220 kg wie die beiden Teile vorher.
       * Das Getriebe sitzt quer neben dem Motor (Frontantrieb), nicht mehr
       * unter der Frontscheibe — dort kam es beim Biss aufs Dach heraus
       * (E-124/E-128).
       */
      materialId: "alu",
      massKg: 220,
      // Zäher als ein Rad: der Block hängt an Lagern und Leitungen. Mit
      // gedrehter Spinne geht es deutlich schneller.
      tearSeconds: 2.6,
      grabRadius: 1.0,
      anchor: [0.12, 0.58, 1.36],
      size: [0.6, 0.4, 0.6],
      kind: "box",
      color: 0x3e4247,
      // Batterie sitzt über dem Getriebe, der Kühler davor (Konzept: echte Reihenfolge)
      sperre: ["haube", "batterie", "kuehler"],
      stuecke: [
        // Getriebe links daneben
        { size: [0.3, 0.36, 0.46], at: [-0.46, -0.02, -0.02], farbe: 0x9aa0a6 },
        // Ventildeckel oben
        { size: [0.46, 0.05, 0.34], at: [0, 0.225, 0], farbe: 0x24262a },
      ],
    },
    ...([
      [-0.82, 1.25],
      [0.82, 1.25],
      [-0.82, -1.25],
      [0.82, -1.25],
    ] as const).map(
      ([x, z], i): PartDef => ({
        id: `wheel_${i}`,
        name: "Rad",
        /*
         * Reifen mit Stahlfelge, ungetrennt (Ansage 12.09.2026: „Reifen
         * muessen nicht zerlegt werden, es sei denn, es ist ne Alufelge").
         * Seit E-185 mit Felge im Bild und in der Stückliste — und damit nach
         * der 95-%-Regel Mischschrott, wie die losen Räder im Katalog.
         */
        materialId: "mixed",
        zusammensetzung: RAD_ZUSAMMENSETZUNG,
        massKg: 25,
        tearSeconds: 1.2,
        grabRadius: 0.5,
        anchor: [x, 0.33, z],
        size: [0.33, 0.24],
        kind: "wheel",
        color: 0x1e2022,
      })
    ),
  ],
  windows: [
    { id: "front", anchor: [0, 1.0, 0.85], size: [1.3, 0.5], rotY: 0 },
    { id: "rear", anchor: [0, 1.0, -1.22], size: [1.3, 0.5], rotY: 0 },
    { id: "left", anchor: [-0.77, 0.98, -0.2], size: [1.8, 0.44], rotY: Math.PI / 2 },
    { id: "right", anchor: [0.77, 0.98, -0.2], size: [1.8, 0.44], rotY: Math.PI / 2 },
  ],
};

/**
 * Was nur der Bestand (zwei Quader, E-116) liest — Kabinenmaße. Die großen
 * Wracks gibt es nur als Fassung mit Querschnitten; hier steht ihr Chassis,
 * weil die Anbauteile ihren Sitz als Anteil davon angeben.
 */
function nurChassis(b: number, l: number, anbau: AnbauDef[]): KarosserieDef {
  return { chassis: [b, 1, l], chassisY: 0.5, kabine: [b, 1, l], kabineY: 1.5, kabineZ: 0, radlaufLuft: 0.09, radlaufDicke: 0.055, radlaufVersatz: 0.01, anbau };
}

/**
 * DAS LKW-WRACK (E-135) — eine ausgediente Sattelzugmaschine, die von Anfang
 * an auf dem Platz steht. Form, Hohlkörper und Knautschen: `FORM_LKW`.
 *
 * MASSE 7 000 kg. // Quelle: Leergewicht einer 4x2-Sattelzugmaschine der
 * 18-t-Klasse 7,0–7,5 t (Herstellerangaben, z. B. MAN TGX 18.xxx um 7,2 t);
 * ein ausgedientes Fahrzeug ohne Diesel und AdBlue an der unteren Grenze.
 *
 * WAS ABGEHT (Masse je Teil // SW aus Bauteilgewichten dieser Klasse):
 *  - Motorblock 1 050 kg: 12-l-Reihensechszylinder, trocken um 1 t. Stahl,
 *    nicht Alu wie am Pkw — Lkw-Blöcke sind Grauguss.
 *  - Dieseltank 70 kg: 400-l-Alutank, leer.
 *  - Batteriekasten 110 kg: zwei 12-V-Starterbatterien à 55 kg (Blei).
 *  - Sattelkupplung 180 kg: Platte samt Lagerbock, Stahl.
 *  - Räder: vorn je 100 kg (315/80 R22.5 auf Stahlfelge), hinten je 200 kg
 *    (Zwillingsräder, als EIN Teil).
 * Bleibt der Rumpf mit 4 990 kg: Rahmen, Achsen, Fahrerhaus. Er ist über der
 * Traglast nah an der Maschine (6,35 t mit Fünfschalengreifer, E-152,
 * `excavator/traglast.ts`) — ganz geht der Lkw nicht hoch, und in die Presse (Kammer 4,05 x 4,20 m) passt
 * er mit 6 m auch nicht. Was mit ihm geschieht: zerdrücken und zerlegen.
 *
 * Kein Teil hat einen Kollider, solange es dranhängt (wie am Pkw); sie liegen
 * im Rahmen-Quader. Der Motor sitzt unter dem Fahrerhaus: Von oben auf dem
 * heilen Dach liegt er außerhalb des Greifradius, erst ein geknautschtes
 * Fahrerhaus bringt die Spinne nahe genug heran.
 */
export const LKW_DEF: CarDef = {
  totalMassKg: 7000,
  hullMassKg: 4990,
  hullMaterialId: "mixed",
  // SW: Rahmen und Achsen sind Stahl, im Fahrerhaus Verkleidung, Sitze, Glas, Kabel.
  hullZusammensetzung: [
    { materialId: "steel", anteil: 0.82 },
    { materialId: "plastic", anteil: 0.06 },
    { materialId: "alu", anteil: 0.04 },
    { materialId: "cable", anteil: 0.03 },
    { materialId: "rubble", anteil: 0.03 },
    { materialId: "tires", anteil: 0.02 },
  ],
  // Für Schwerpunkt und Trägheit: ein Klotz 2,50 x 2,00 x 6,00 m, Schwerpunkt 1,0 m hoch. // SW
  colliderHalf: [1.25, 1.0, 3.0],
  colliderYOffset: 1.0,
  crushScales: [1, 0.76, 0.55],
  glassImpactDv: 4.5,
  crushImpactDv: 7,
  karosserie: nurChassis(2.5, 6.0, []),
  parts: [
    {
      id: "engine",
      name: "Motorblock",
      materialId: "steel",
      massKg: 1050,
      // SW: fester als ein Pkw-Motor (2,6 s) — mehr Lager, mehr Leitungen.
      tearSeconds: 4.0,
      // SW: kleiner als der Abstand vom heilen Dach (Spinne 3,2 m, Motor 0,95 m).
      grabRadius: 0.9,
      anchor: [0, 0.95, 1.75],
      size: [0.9, 0.9, 1.3],
      kind: "box",
      color: 0x3e4247,
    },
    {
      id: "tank",
      name: "Dieseltank",
      materialId: "alu",
      massKg: 70,
      tearSeconds: 1.8,
      grabRadius: 0.8,
      anchor: [1.0, 0.75, -0.4],
      size: [0.6, 0.6, 1.3],
      kind: "box",
      color: 0xb8bcc0,
    },
    {
      id: "batterie",
      name: "Batteriekasten",
      materialId: "battery",
      massKg: 110,
      tearSeconds: 1.4,
      grabRadius: 0.7,
      anchor: [-1.0, 0.75, -0.3],
      size: [0.6, 0.5, 0.7],
      kind: "box",
      color: 0x2a2c30,
    },
    {
      id: "sattel",
      name: "Sattelkupplung",
      materialId: "steel",
      massKg: 180,
      tearSeconds: 2.6,
      grabRadius: 0.9,
      anchor: [0, 1.15, -1.75],
      size: [1.2, 0.2, 1.2],
      kind: "box",
      color: 0x24262a,
    },
    ...([
      [-1.03, 1.6, 0.315, 100],
      [1.03, 1.6, 0.315, 100],
      [-0.92, -2.0, 0.62, 200],
      [0.92, -2.0, 0.62, 200],
    ] as const).map(
      ([x, z, breite, kg], i): PartDef => ({
        id: `wheel_${i}`,
        name: "Rad",
        // E-185: Stahlfelge, dieselben Anteile wie am Pkw. // SW: bei Lkw-Rädern trägt die Felge eher 35–40 %
        materialId: "mixed",
        zusammensetzung: RAD_ZUSAMMENSETZUNG,
        massKg: kg,
        // SW: zehn Radmuttern statt vier oder fünf
        tearSeconds: 2.0,
        grabRadius: 0.7,
        anchor: [x, 0.535, z],
        size: [0.535, breite],
        kind: "wheel",
        color: 0x1e2022,
      })
    ),
  ],
  windows: [],
};

/**
 * DER WOHNWAGEN (E-135) — kommt ab und zu auf dem Abschlepper zum
 * Verschrotten. Form, Hohlkörper und Knautschen: `FORM_WOHNWAGEN`.
 *
 * MASSE 820 kg. // SW: Leergewicht kleiner Einachser mit 4,2 m Aufbau,
 * Baujahre 80er/90er, laut Prospekten 750–900 kg — leicht für seine Größe,
 * weil die Wand aus Alublech, Styropor und Sperrholz besteht.
 *
 * Was abgeht: zwei Räder (185/70 R13 auf Stahlfelge, je 16 kg) und die
 * Achse (Gummifederachse bis 1 t, 45 kg). // SW
 */
export const WOHNWAGEN_DEF: CarDef = {
  totalMassKg: 820,
  hullMassKg: 743,
  hullMaterialId: "mixed",
  // SW, aus der Bauweise: Holzrahmen und Möbel, Alu-Außenhaut, Styropor und
  // Kunststoff (Fenster, Bug), Stahlfahrgestell, Dämmung, Kabel.
  hullZusammensetzung: [
    { materialId: "wood", anteil: 0.35 },
    { materialId: "plastic", anteil: 0.2 },
    { materialId: "steel", anteil: 0.2 },
    { materialId: "alu", anteil: 0.15 },
    { materialId: "rubble", anteil: 0.07 },
    { materialId: "cable", anteil: 0.03 },
  ],
  // Schwerpunkt tief (Fahrgestell, Boden, Möbel unten): 0,9 m. // SW
  colliderHalf: [1.025, 0.9, 2.1],
  colliderYOffset: 0.9,
  crushScales: [1, 0.76, 0.55],
  glassImpactDv: 4.5,
  crushImpactDv: 7,
  karosserie: nurChassis(2.05, 4.2, []),
  parts: [
    {
      id: "achse",
      name: "Achse",
      materialId: "steel",
      massKg: 45,
      tearSeconds: 2.0,
      grabRadius: 0.7,
      anchor: [0, 0.3, -0.15],
      size: [1.45, 0.12, 0.14],
      kind: "box",
      color: 0x5a5a5a,
    },
    ...([-0.8, 0.8] as const).map(
      (x, i): PartDef => ({
        id: `wheel_${i}`,
        name: "Rad",
        // E-185: Stahlfelge wie am Pkw
        materialId: "mixed",
        zusammensetzung: RAD_ZUSAMMENSETZUNG,
        massKg: 16,
        tearSeconds: 1.2,
        grabRadius: 0.5,
        anchor: [x, 0.295, -0.15],
        size: [0.295, 0.185],
        kind: "wheel",
        color: 0x1e2022,
      })
    ),
  ],
  windows: [],
  // SW: cremeweiß, weiß, beige — die Farben, in denen Wohnwagen gebaut werden.
  lackPalette: [0xece8dc, 0xf2f2ee, 0xe4dccb],
  /*
   * Auf dem Abschlepper (Fläche 5,40 m, Stirnwand und Heckklappe innen bei
   * 0,05 und 5,35): rückwärts, der Kasten 10 cm vor der Stirnwand (Mitte
   * 0,45 m vor der Flächenmitte), die Deichsel 0,5 m über das Heck hinaus.
   * Gemessen: Mit der Deichsel nach vorn lag der Kasten auf der Heckklappe,
   * wurde in die Mitte gedrückt, und die Deichsel stand 1 m im Fahrerhaus.
   */
  ladeVersatz: 0.45,
  ladeRueckwaerts: true,
};

/**
 * Welche Wracks es gibt (E-135) — ein neues Fahrzeug ist ein neuer Datensatz
 * und eine Zeile hier (dazu seine Fassung in `wrackformen.ts`).
 */
export type WrackArt = "pkw" | "lkw" | "wohnwagen";
export const WRACKDATEN: Record<WrackArt, CarDef> = {
  pkw: CAR_DEF,
  lkw: LKW_DEF,
  wohnwagen: WOHNWAGEN_DEF,
};
