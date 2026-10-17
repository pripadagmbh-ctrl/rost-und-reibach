import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import RAPIER from "@dimforge/rapier3d-compat";
import { BED_HALF_W } from "./routes";
import { ladeHoeheGrenze } from "./fuellgrad";
import { werbeAtlas, atlasFeld, PRIPADA_GRUEN } from "../world/werbung";
import type { Fahrwerk } from "./lenkung";

/**
 * WO DIE ACHSEN DES DREIACHSERS SITZEN (E-140) — eine Quelle fuer Bau und Fahrt.
 *
 * Vorn eine lenkende Achse, hinten zwei starre mit Zwillingsreifen. Fuer das
 * Einspurmodell (`lenkung.ts`) zaehlt die Mitte der beiden Hinterachsen:
 *
 *   Pritsche, Abholer, Abschlepper (bedLen 5,4)  vorn 3,80  hinten −0,90  Radstand 4,70 m
 *   Kipper                         (bedLen 6,0)  vorn 4,10  hinten −1,05  Radstand 5,15 m
 */
export function lkwAchsen(bedLen: number): [number, number, number] {
  return [bedLen / 2 + 1.1, 0.1, -bedLen / 2 + 0.8];
}

export function lkwFahrwerk(bedLen: number): Fahrwerk {
  const [vorn, h1, h2] = lkwAchsen(bedLen);
  return { vorn, hinten: (h1 + h2) / 2, anhaenger: null };
}

/**
 * Das Gespann: Auto vorn, Anhaenger an der Kugel (E-140).
 *
 * Laengslagen im Wagenrahmen, Ursprung = Heck des geraden Anhaengers. Die
 * Kupplung sitzt `bedLen + 1,05` vor dem Ursprung, das Auto (Laenge `len`)
 * 0,35 m davor; seine Achsen 0,95 m von Front und Heck. Radstand des Autos
 * `len − 1,90` (2,40 bzw. 2,80 m), Kupplung 1,30 m hinter seiner Hinterachse,
 * Anhaengerachse `bedLen/2 + 1,05` = 2,25 m hinter der Kupplung.
 */
export function pkwFahrwerk(bedLen: number, len: number): Fahrwerk {
  const kupplung = bedLen + 1.05;
  const zugZ = kupplung + 0.35 + len / 2;
  return {
    vorn: zugZ + len / 2 - 0.95,
    hinten: zugZ - len / 2 + 0.95,
    anhaenger: { kupplung, deichsel: bedLen / 2 + 1.05, heck: bedLen / 2 },
  };
}

/** Der laengere der beiden Personenwagen — der groessere Wendekreis, fuer die Waechter. */
export const PKW_LAENGE_MAX = 4.7;

/**
 * Oberkante des Ladeflächen-KOLLIDERS in Flächenkoordinaten.
 *
 * Abgeschrieben aus `vehicles.ts`: Der Quader hat Halbhöhe 0,30 und sitzt auf
 * −0,26, seine Oberkante liegt also auf +0,04. Hier gespiegelt statt
 * importiert, weil der Modellbau keine Zustandsmaschine mitziehen soll;
 * `test/ladeflaeche.test.ts` hält beide Fassungen zusammen.
 */
export const FLAECHE_KOLLIDER_OBEN = 0.04;

/**
 * DIE TRAGENDEN TEILE HABEN NAMEN (15.09.2026).
 *
 * Bis heute hiess kein einziges Netz am LKW irgendwie. Wer messen wollte, ob
 * zwei Teile ineinanderstecken, musste sie an ihren Massen wiedererkennen —
 * und genau deshalb hat zwei Tage lang niemand gemessen, dass der Ladekran im
 * Muldenboden steht (Befund Patrick, 13.09.2026).
 *
 * Ein `name` kostet im Bild nichts: Er belegt kein Dreieck, keinen Zeichenruf
 * und keine Rechenzeit. Er kostet nur eine Zeichenkette je Netz. Dafuer kann
 * `tools/fahrzeug-durchdringung.ts` und der Waechter dazu jedes Paar
 * benennen, statt Zahlen zu vergleichen.
 *
 * Die Gruppe steht am Netz ODER an einem seiner Vaeter: Verriegelungsbuegel
 * und Rungen haengen an der Bordwand und erben so deren Gruppe.
 */
export const BAUGRUPPE = {
  rahmen: "rahmen",
  fahrerhaus: "fahrerhaus",
  flaeche: "flaeche",
  bordwand: "bordwand",
  stirnwand: "stirnwand",
  heckklappe: "heckklappe",
  kranbock: "kranbock",
  kransaeule: "kransaeule",
  rad: "rad",
  kotfluegel: "kotfluegel",
  auspuff: "auspuff",
} as const;

/** Alle Gruppennamen, die `sammleTeile` kennt. */
export const BAUGRUPPEN: ReadonlySet<string> = new Set(Object.values(BAUGRUPPE));

/* ------------------------------------------------------------------ *
 *  DER LADEKRAN UND DAS FAHRERHAUS — wo beide hinpassen (E-076)
 * ------------------------------------------------------------------ */

/**
 * DER KRAN STAND IN DER MULDE, UND ZWAR ÜBERALL.
 *
 * Befund Patrick, 13.09.2026: „dass die Ladefläche durch den Kran läuft, wenn
 * es einen Kran gibt." Gemessen mit `tools/fahrzeug-durchdringung.ts`, an
 * jedem Händler-LKW, in jeder Stellung:
 *
 *   Fahrerhaus × Kransäule   25,5 cm   (Säule schwenkt in die Kabine)
 *   Fahrerhaus × Kranbock    25,0 cm   (Bockplatte steckt in der Kabine)
 *   Ladefläche × Kranbock    12,0 cm   (Bockplatte im Muldenboden)
 *   Ladefläche × Kransäule   12,0 cm   (nur Kipper: Boden fährt beim Kippen
 *                                       durch die Säule, ab 6° Kippwinkel)
 *   Bordwand   × Kransäule   10,0 cm
 *   Stirnwand  × Kranbock     8,0 cm
 *
 * DIE URSACHE IST EINE ZAHL: `sockelZ = bedLen / 2 + 0,05`. Die Ladefläche
 * reicht bis `bedLen / 2`, der Bock ist 0,70 m tief — er beginnt also 0,30 m
 * VOR dem Muldenende und steht 12 cm tief im 12 cm dicken Bodenblech. Für den
 * Kran war schlicht kein Platz vorgesehen: Zwischen Muldenstirn
 * (`bedLen/2 + 0,04`) und Kabinenrückwand (`bedLen/2 + 0,15`) lagen genau
 * 11 Zentimeter.
 *
 * DIE LÖSUNG IST DIE, DIE ECHTE KRANWAGEN AUCH HABEN: ein kurzes
 * Nahverkehrshaus. Die Kabine wird nach HINTEN kürzer — die Schnauze bleibt,
 * wo sie ist, und damit bleibt auch der Umriss (`umriss.UMRISS_VORN` 1,90 m)
 * unverändert; keine Strecke, kein Halteplatz, keine Wegprüfung ändert sich.
 * In die gewonnene Lücke stellt sich der Kran.
 *
 * Die Zahlen sind gerechnet, nicht gegriffen. Maßgeblich ist das OBERE Haus:
 * Es steht 3 cm weiter nach hinten als das untere (so war es schon immer).
 *
 *   Bockplatte 0,50 m tief + 2 × 0,04 m Luft        =  0,58 m Lückenbedarf
 *   Lücke      = (Kabine hinten − 0,03) − 0,04      =  Kabine hinten − 0,07
 *   Kabine hinten ≥ 0,65  →  Kabinentiefe ≤ 1,65 − 0,65 = 1,00 m
 *
 * Die Bockmitte liegt dann in der Mitte dieser Lücke, auf `bedLen/2 + 0,33`.
 */
export const KABINE_VORN = 1.65;
/** Tiefe des Fernverkehrshauses (m) — unverändert, so stand es seit dem 12.09. */
export const KABINE_TIEFE = 1.5;
/** Tiefe des Nahverkehrshauses am Kranwagen (m) — siehe Rechnung oben. */
export const KABINE_TIEFE_KRAN = 1.0;
/** Wie weit das obere Haus hinter dem unteren zurücksteht (m). */
export const OBERHAUS_HINTEN = 0.03;
/** Wie weit das obere Haus hinter der Schnauze zurücksteht (m). */
export const OBERHAUS_VORN = 0.13;
/** Mitte des Kranbocks, gemessen ab Mitte der Ladefläche (m). */
export const KRAN_Z = 0.33;
/** Tiefe der Bockplatte (m) — von 0,70 gekürzt, damit sie in die Lücke passt. */
export const KRAN_BOCK_TIEFE = 0.5;
/**
 * Durchmesser der Kransäule (m).
 *
 * Sie war ein Quader von 0,46 m Kantenlänge. Ein Quader, der sich dreht,
 * braucht seine DIAGONALE an Platz (0,65 m) — ein Rundturm braucht immer nur
 * seinen Durchmesser. Deshalb ist die Säule jetzt ein Achtkant: Das spart
 * 19 cm Lücke, und ein Kranturm ist in Wirklichkeit auch rund.
 */
export const KRAN_SAEULE_D = 0.46;

/** Tiefe des Fahrerhauses, je nachdem ob ein Kran dahinter steht (m). */
export function kabinenTiefe(mitKran: boolean): number {
  return mitKran ? KABINE_TIEFE_KRAN : KABINE_TIEFE;
}

/** Mitte des Fahrerhauses in Fahrzeugkoordinaten (m). */
export function kabinenMitte(bedLen: number, mitKran: boolean): number {
  return bedLen / 2 + KABINE_VORN - kabinenTiefe(mitKran) / 2;
}

/**
 * Höhe des Auslegergelenks über dem Boden (m) — und damit die Höhe der Säule.
 *
 * Der Ausleger liegt im Transportzustand über der Ladefläche. Er muss die
 * LADUNG überfahren, nicht nur die Bordwand: Gepackt wird bis
 * `1,05 (Flächenhöhe) + 0,10 (LADE_BODEN) + Bordwand + 0,35 (LADUNG_UEBERSTAND)`
 * (`vehicles.ts`). Darüber kommen 10 cm Luft.
 *
 * Vorher war es eine feste Zahl (2,27 m). Für den flachen Aufbau reichte das
 * knapp; bei Rungen lag der Ausleger 41 cm IN der Ladung.
 *
 * Die 0,20 m Reserve sind gemessen und nicht gegriffen: Der Ausleger steigt
 * nach hinten an, kreuzt die Muldenstirn aber schon 0,33 m hinter dem Gelenk
 * und liegt dort mit seiner halben Dicke (0,15 / cos 0,42 = 0,164 m) noch
 * 0,02 m UNTER dem Gelenk. Ohne Reserve stünde er also genau in der Ladung.
 */
export function auslegerHoehe(kind: string, bodyStyle?: string): number {
  // Die Ladungsgrenze kommt aus `fuellgrad.ladeHoeheGrenze` (E-126) — nicht
  // abgeschrieben. Ein Wagen mit Einzelstueck faehrt ohne Kran (`vehicles.ts`).
  return 1.05 + 0.1 + ladeHoeheGrenze(wandHoehe(kind, bodyStyle)) + 0.2;
}

/**
 * DIE KIPPBRÜCKE IST EIN KEIL, KEIN QUADER (E-071).
 *
 * Bis zum 15.09.2026 war der Kollider der Ladefläche ein Quader von 0,60 m
 * Dicke unter einem 0,12 m dünnen Blech. Beim Kippen dreht die Brücke um ihre
 * HINTERE Kante; die Rückwand dieses Quaders — 0,60 m hoch, 0,00 m vom
 * Drehpunkt entfernt — beschreibt dabei einen Kreissektor UNTER der Brücke:
 *
 *     Vorlauf der Unterkante nach vorn  =  Dicke × sin(Kippwinkel)
 *     Bei 0,60 m und 58°                =  0,509 m
 *     überstrichene Fläche              =  ½ × Dicke² × Winkel  =  0,182 m²
 *
 * Alles, was in diesem Sektor liegt — Material, das über die Heckkante
 * gerutscht ist und noch fällt —, wird von der aufschwenkenden Unterkante nach
 * vorn und oben geschaufelt. Die Fläche geht mit dem QUADRAT der hinteren
 * Dicke; das ist der Grund, warum ein dickerer Quader schlechter ist, und die
 * Rechnung dahinter, dass es keilförmig sein muss und nicht nur dünn.
 *
 * DIE BEIDEN MASSE SIND NICHT GEWÄHLT, SONDERN ABGELEITET:
 *
 *   HINTEN 0,12 m — genau die Dicke des sichtbaren Blechs (`BoxGeometry(bedW,
 *     0,12, bedLen)` weiter unten in dieser Datei). Dünner darf der Kollider
 *     nicht sein, sonst steht das Blech unten aus ihm heraus und die Ladung
 *     sinkt sichtbar ein; dicker muss er nicht sein. Zugleich ist 0,12 m über
 *     der Grenze, unter der dünne Platten in Rapier unzuverlässig greifen
 *     (v2-Lehre „Bleche mit Mindestdicke").
 *   VORN 0,60 m — unverändert. Die Unterkante liegt damit vorn weiter auf
 *     −0,56, also 4 cm über dem Rahmen (`chassisBody`, Oberkante lokal −0,60).
 *     Es entsteht keine neue Überschneidung zweier kinematischer Körper, und
 *     der Spalt zum Rahmen wird nach hinten größer statt kleiner.
 *
 * Damit schwenkt die Hinterkante nur noch 0,12 × sin 58° = 0,102 m vor, und
 * der überstrichene Sektor schrumpft von 0,182 auf 0,0073 m² — auf 4 %.
 *
 * Keilneigung: (0,60 − 0,12) / 6,00 = 0,08, also 4,57°.
 */
export const BRUECKE_DICKE_VORN = 0.6;
export const BRUECKE_DICKE_HINTEN = 0.12;

/**
 * Die keilförmige Kippbrücke als konvexe Hülle (acht Ecken).
 *
 * Deckfläche waagerecht auf `FLAECHE_KOLLIDER_OBEN` über die ganze Länge, die
 * Unterseite von `hinten` am Drehpunkt (lokal z 0) auf `vorn` an der Kabine
 * (lokal z = `bedLen`). Beide Dicken werden VON DER LADEFLÄCHE NACH UNTEN
 * gemessen.
 */
export function brueckenKeilEcken(
  halfW: number,
  bedLen: number,
  vorn = BRUECKE_DICKE_VORN,
  hinten = BRUECKE_DICKE_HINTEN
): Float32Array {
  const o = FLAECHE_KOLLIDER_OBEN;
  return new Float32Array([
    // Heck (z = 0), Drehpunkt
    -halfW, o, 0, halfW, o, 0, -halfW, o - hinten, 0, halfW, o - hinten, 0,
    // Kabinenseite (z = bedLen)
    -halfW, o, bedLen, halfW, o, bedLen, -halfW, o - vorn, bedLen, halfW, o - vorn, bedLen,
  ]);
}

/**
 * Wie weit die Unterkante der Brücke beim Kippen nach vorn schwenkt (m).
 * Genau das Maß, das die Ladung unter der Brücke aufschaufelt.
 */
export function heckVorlauf(dickeHinten: number, kippwinkelRad: number): number {
  return dickeHinten * Math.sin(kippwinkelRad);
}

/** Fläche, die die Rückwand der Brücke beim Kippen unter sich überstreicht (m²). */
export function heckSektor(dickeHinten: number, kippwinkelRad: number): number {
  return 0.5 * dickeHinten * dickeHinten * kippwinkelRad;
}

/**
 * Modellbau der Anlieferfahrzeuge.
 *
 * Hier entsteht, was man sieht: Fahrerhaus, Ladefläche, Bordwände,
 * Heckklappe, Räder — und für Privatkundschaft ein PKW mit Anhänger statt
 * eines LKW. Reine Geometrie ohne Ablauflogik; bewegliche Teile wie die
 * Bordwände bekommen eigene Körper und werden als Ergebnis zurückgereicht.
 */

/** Was das Fahrzeug dem Modellbau zur Verfügung stellt. */
export interface VehicleModelContext {
  kind: string;
  bedLen: number;
  /** Schrotthändler fahren ihren eigenen Ladekran mit */
  withCrane?: boolean;
  /**
   * Aufbau der Ladefläche. Händler fahren nicht alle denselben Wagen:
   *   flach   niedrige Bordwände, wie ein Baustellenpritsche
   *   rungen  hohe Seitenwände mit Rungen — der klassische Schrottaufbau
   *   koffer  geschlossener Kastenaufbau, fast schon ein Container
   */
  bodyStyle?: "flach" | "rungen" | "koffer";
  /**
   * Name des Kunden. Aus ihm kommt der Lackton — derselbe Händler fährt
   * damit immer denselben Wagen vor, ohne dass die Farbe gespeichert werden
   * müsste. Genauso macht es `lackton` beim Schrott (E-061).
   */
  halter?: string;
  group: THREE.Group;
  bedGroup: THREE.Group;
  world: RAPIER.World;
  sideWalls: Array<{ hinge: THREE.Group; mesh: THREE.Mesh; body: RAPIER.RigidBody; dir: number }>;
  tailGate: { hinge: THREE.Group; mesh: THREE.Mesh; body: RAPIER.RigidBody } | null;
}

/**
 * Ein Rad, so wie die Federung es braucht.
 *
 * Federt der Wagen ein, senkt sich die GEFEDERTE Masse — Rahmen, Haus,
 * Fläche, Ladung —, die Räder aber bleiben auf dem Boden stehen. Im Modell
 * hängen sie an derselben Gruppe wie alles andere; also hebt der Ablauf sie
 * um genau die Einfederung an ihrer Längsstelle gegen. Dafür braucht er die
 * Ausgangshöhe und die Längslage jedes Radteils.
 *
 * Kein neues Netz: Es sind dieselben Meshes, die ohnehin gebaut werden, nur
 * eingesammelt statt vergessen.
 */
export interface Rad {
  mesh: THREE.Object3D;
  /** Ausgangshöhe in der Gruppe, zu der das Rad gehört */
  y0: number;
  /** Längslage in derselben Gruppe */
  z: number;
}

/** Die beweglichen Teile, die der Ablauf danach ansteuert. */
/** Ein Teil eines lenkenden Rads: Es schwenkt um die Hochachse durch die Reifenmitte. */
export interface LenkRad {
  mesh: THREE.Object3D;
  /** Querlage der Reifenmitte (Drehachse) */
  achseX: number;
  /** Querversatz dieses Teils gegen die Reifenmitte (Felge, Nabe) */
  versatz: number;
  /** Laengslage */
  z: number;
}

export interface VehicleModelParts {
  /** Wo die Achsen sitzen — daraus faehrt das Einspurmodell (E-140). */
  fahrwerk: Fahrwerk;
  /** Die Teile der Vorderraeder, die beim Lenken einschlagen. */
  lenkRaeder: LenkRad[];
  tailGate: { hinge: THREE.Group; mesh: THREE.Mesh; body: RAPIER.RigidBody } | null;
  /** Drehbare Kransäule — der Ablauf schwenkt sie beim Andocken zur Seite */
  crane: THREE.Group | null;
  /** Anhänger des PKW — hängt gelenkig an der Kupplung und wird nachgeführt */
  trailer: THREE.Group | null;
  /**
   * Räder der gefederten Einheit — beim LKW in Fahrzeug-, beim Gespann in
   * Anhängerkoordinaten (dort federt nur der Anhänger, nicht der Zugwagen).
   */
  raeder: Rad[];
}

/**
 * Lacktöne, wie sie auf einem Schrottplatz vorfahren.
 *
 * Kein Weiß aus dem Prospekt und kein Metallic: Die Wagen sind alt, die Farbe
 * ist stumpf. Bisher war jeder LKW derselbe blaue Kasten (0x35618f) — bei
 * vier Fuhren am Tag sah der Platz aus wie ein Fuhrpark aus einer Hand.
 */
const LKW_LACK = [0xcfcdc6, 0x35618f, 0x8d3128, 0x3f6b34, 0xb08a3a, 0x6b6f73, 0x2f4f5e];

/** Lackton fest aus dem Halternamen — gleicher Händler, gleicher Wagen. */
function lackFuer(halter: string | undefined): number {
  if (!halter) return LKW_LACK[1];
  let k = 7;
  for (let i = 0; i < halter.length; i++) k = (k * 31 + halter.charCodeAt(i)) % 100003;
  return LKW_LACK[k % LKW_LACK.length];
}

/**
 * Ein Rad aus Reifen, Felge und Nabe — bei Bedarf als Zwilling.
 *
 * Vorher war jedes Rad eine schwarze Scheibe. Aus zehn Metern sieht man an
 * einem LKW vor allem zwei Dinge: die Farbe der Kabine und die Räder. Ein
 * Dreiachser hat hinten Zwillingsbereifung, und genau das macht ihn zum LKW
 * statt zum Lieferwagen.
 */
function baueRad(
  ziel: THREE.Group,
  x: number,
  y: number,
  z: number,
  r: number,
  breite: number,
  zwilling: boolean,
  /** Sammelstelle für die Federung — sie schiebt die Räder gegen die Einfederung */
  raeder?: Rad[],
  /** Sammelstelle der lenkenden Räder (E-140) */
  lenk?: LenkRad[]
): void {
  const gummi = new THREE.MeshStandardMaterial({ color: 0x1d1f21, roughness: 0.95 });
  const felge = new THREE.MeshStandardMaterial({
    color: 0x8b9197,
    roughness: 0.45,
    metalness: 0.65,
  });
  const reifen = new THREE.CylinderGeometry(r, r, breite, 14);
  reifen.rotateZ(Math.PI / 2);
  // Die Felge sass zuerst mittig im Reifen und ragte anderthalb Zentimeter
  // heraus — unsichtbar. Sie gehoert auf die Aussenseite, dort sieht man sie.
  const scheibe = new THREE.CylinderGeometry(r * 0.62, r * 0.62, breite * 0.4, 10);
  scheibe.rotateZ(Math.PI / 2);
  const nabe = new THREE.CylinderGeometry(r * 0.22, r * 0.22, breite * 0.5, 8);
  nabe.rotateZ(Math.PI / 2);
  const seite = Math.sign(x) || 1;
  const plaetze = zwilling ? [x, x - seite * (breite + 0.03)] : [x];
  for (const px of plaetze) {
    const rad = new THREE.Mesh(reifen, gummi);
    rad.name = BAUGRUPPE.rad;
    rad.position.set(px, y, z);
    rad.castShadow = true;
    ziel.add(rad);
    raeder?.push({ mesh: rad, y0: y, z });
    lenk?.push({ mesh: rad, achseX: x, versatz: px - x, z });
  }
  // Felge und Nabe nur aussen: innen sieht sie ohnehin niemand
  const rim = new THREE.Mesh(scheibe, felge);
  rim.name = BAUGRUPPE.rad;
  rim.position.set(x + seite * breite * 0.36, y, z);
  ziel.add(rim);
  raeder?.push({ mesh: rim, y0: y, z });
  lenk?.push({ mesh: rim, achseX: x, versatz: rim.position.x - x, z });
  const hub = new THREE.Mesh(nabe, felge);
  hub.name = BAUGRUPPE.rad;
  hub.position.set(x + seite * breite * 0.45, y, z);
  ziel.add(hub);
  raeder?.push({ mesh: hub, y0: y, z });
  lenk?.push({ mesh: hub, achseX: x, versatz: hub.position.x - x, z });
}

/**
 * Das Gesicht des Wagens: Stoßstange, Grill, Leuchten, Spiegel, Auspuff.
 *
 * Ein LKW-Fahrerhaus ist nie ein Quader. Es hat unten eine Stoßstange, davor
 * ein Nummernschild, oben ein Dachspoiler, seitlich Spiegel auf Auslegern und
 * hinten den Auspuffrohr-Stapel. Ohne das steht dort ein blauer Block, und
 * jede Fuhre sieht aus wie die vorige.
 */
function baueFahrerhaus(
  v: VehicleModelContext,
  lack: THREE.MeshStandardMaterial,
  dark: THREE.MeshStandardMaterial,
  glas: THREE.Material
): void {
  const chrom = new THREE.MeshStandardMaterial({
    color: 0xb9bec3,
    roughness: 0.3,
    metalness: 0.85,
  });
  const klar = new THREE.MeshStandardMaterial({
    color: 0xf2eddc,
    roughness: 0.25,
    emissive: 0x2a2418,
  });
  const bernstein = new THREE.MeshStandardMaterial({
    color: 0xd08a1e,
    roughness: 0.4,
    emissive: 0x3a2205,
  });
  /*
   * Alles am Gesicht haengt an ZWEI Zahlen: der Mitte des Fahrerhauses und
   * seiner Vorderkante. Beide kommen jetzt aus `kabinenMitte` und
   * `KABINE_VORN` statt aus abgeschriebenen Summanden — sonst bliebe der
   * Auspuff stehen, wo er stand, wenn die Kabine kuerzer wird (E-076).
   */
  const mitKran = v.withCrane === true;
  const kabTiefe = kabinenTiefe(mitKran);
  const cz = kabinenMitte(v.bedLen, mitKran); // Mitte des Fahrerhauses
  const front = v.bedLen / 2 + KABINE_VORN + 0.01; // Vorderkante
  const add = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    schatten = false
  ): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (schatten) m.castShadow = true;
    v.group.add(m);
    return m;
  };

  // Stoßstange, Nummernschild, Unterfahrschutz
  add(new THREE.BoxGeometry(2.16, 0.28, 0.18), dark, 0, 0.95, front + 0.06, true);
  add(new THREE.BoxGeometry(0.4, 0.13, 0.03), chrom, -0.55, 0.95, front + 0.16);
  // Kühlergrill: waagerechte Lamellen, nicht eine glatte Platte
  for (let i = 0; i < 4; i++) {
    add(new THREE.BoxGeometry(1.5, 0.07, 0.05), dark, 0, 1.18 + i * 0.12, front + 0.02);
  }
  // Scheinwerfer und Blinker
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.34, 0.2, 0.05), klar, sx * 0.86, 1.18, front + 0.03);
    add(new THREE.BoxGeometry(0.16, 0.1, 0.05), bernstein, sx * 0.86, 0.99, front + 0.05);
  }
  /*
   * Dachspoiler: vorn niedrig, hinten hoch — damit der Aufbau nicht anströmt.
   *
   * Beim Kranwagen sitzt er weiter VORN. Auf dem kurzen Haus (1,00 m Dach)
   * steht er sonst mit seiner Hinterkante auf `bedLen/2 + 0,54` und damit im
   * Kranturm, der auf `+0,10 … +0,56` steht. Mittig aufs Dach gesetzt endet
   * er auf `+0,80` — 24 cm Luft.
   *
   * Er wird NICHT weggelassen, obwohl ein echter Kranwagen selten einen
   * fährt: Jedes three-Objekt zieht beim Anlegen vier Zufallszahlen
   * (`MathUtils.generateUUID`). Ein Netz mehr oder weniger verschiebt damit
   * den ganzen Zufallsstrom — und `test/kipper.test.ts` würfelt dann 24
   * andere Ladungen und misst etwas anderes. Wer am Modell arbeitet, soll
   * nicht nebenbei eine Kippmessung verstellen.
   */
  const spoiler = add(
    new THREE.BoxGeometry(1.95, 0.42, 0.7),
    lack,
    0,
    2.28,
    mitKran ? cz : cz - 0.3,
    true
  );
  spoiler.rotation.x = -0.18;
  // Sonnenblende über der Frontscheibe
  const blende = add(new THREE.BoxGeometry(2.0, 0.1, 0.3), lack, 0, 2.12, front - 0.08, true);
  blende.rotation.x = 0.3;
  // Außenspiegel auf Auslegern — das Erkennungszeichen jedes LKW
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.24, 0.04, 0.04), dark, sx * 1.18, 1.98, front - 0.2);
    add(new THREE.BoxGeometry(0.07, 0.46, 0.16), dark, sx * 1.3, 1.78, front - 0.2, true);
    add(new THREE.BoxGeometry(0.07, 0.18, 0.13), dark, sx * 1.28, 1.42, front - 0.22);
  }
  // Türfuge und Griff — ohne sie ist die Seite eine Wand
  for (const sx of [-1, 1]) {
    // Anteilig statt fest: Beim kurzen Haus rutschte die Fuge sonst aus dem Blech
    add(new THREE.BoxGeometry(0.02, 1.1, 0.03), dark, sx * 1.06, 1.48, cz + kabTiefe * 0.28);
    add(new THREE.BoxGeometry(0.03, 0.06, 0.22), chrom, sx * 1.07, 1.45, cz + kabTiefe * 0.07);
    // Einstieg: zwei Tritte unter der Tür
    for (let i = 0; i < 2; i++) {
      add(
        new THREE.BoxGeometry(0.1, 0.04, 0.42),
        dark,
        sx * 0.98,
        0.62 + i * 0.24,
        cz + kabTiefe * 0.1
      );
    }
  }
  /*
   * AUSPUFFROHR AN DER HINTEREN KABINENECKE, AUSSEN (E-076).
   *
   * Es stand auf x 1,02 und damit ZWISCHEN Kabine und Muldenstirn — in einer
   * Lücke von 11 cm, in die es nicht passt. Gemessen steckte es 4,5 cm im
   * oberen Haus und 4,3 cm in der Stirnwand der Mulde.
   *
   * Beides löst dieselbe Verschiebung nach aussen: Das obere Haus ist 2,16 m
   * breit (x ±1,08), das Rohr misst 0,085 m im Halbmesser — ab x 1,175 ist es
   * frei. Auf 1,18 gesetzt steht es neben dem Haus statt darin, und in der
   * Länge an dessen Hinterkante. Das gilt für beide Kabinenlängen, der
   * Kranwagen braucht keine Sonderlage.
   *
   * ZWEITE ÄNDERUNG: Es beginnt jetzt auf y 1,10 statt auf 0,75. Draussen
   * neben dem Haus steht es nämlich im Vorderrad (Scheitel 0,96 m) und im
   * Rahmen (Oberkante 0,90 m) — gemessen 4,2 bzw. 0,5 cm. Über beiden ist es
   * frei, und ein Auspuffstapel, der hinter dem Haus aus dem Rahmen kommt,
   * sieht auch so aus.
   */
  const rohr = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 1.35, 8), chrom);
  rohr.name = BAUGRUPPE.auspuff;
  rohr.position.set(1.18, 1.775, cz - kabTiefe / 2 + 0.05);
  rohr.castShadow = true;
  v.group.add(rohr);
  // Dachleuchten als Reihe
  for (const sx of [-0.62, -0.21, 0.21, 0.62]) {
    add(new THREE.BoxGeometry(0.1, 0.06, 0.08), bernstein, sx, 2.14, front - 0.05);
  }
  void glas;
}

/**
 * Alles unterhalb der Ladefläche: Tank, Werkzeugkasten, Kotflügel, Rückleuchten.
 *
 * Der Rahmen war eine durchgehende dunkle Platte, und die Räder klebten daran
 * wie an einem Brett. Was einen LKW von unten ausmacht, hängt seitlich am
 * Rahmen — und ein Kotflügel über den Zwillingsrädern ist der Unterschied
 * zwischen Fahrzeug und Kiste.
 */
function baueFahrgestell(
  v: VehicleModelContext,
  dark: THREE.MeshStandardMaterial,
  bedMat: THREE.MeshStandardMaterial
): void {
  const alu = new THREE.MeshStandardMaterial({
    color: 0xa9aeb3,
    roughness: 0.4,
    metalness: 0.7,
  });
  const rot = new THREE.MeshStandardMaterial({
    color: 0x8e2318,
    roughness: 0.35,
    emissive: 0x2a0806,
  });
  // Kraftstofftank links, Werkzeugkasten rechts
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 1.1, 10), alu);
  tank.rotation.x = Math.PI / 2;
  tank.position.set(-1.08, 0.72, 0.55);
  tank.castShadow = true;
  v.group.add(tank);
  const kasten = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.85), dark);
  kasten.position.set(1.08, 0.74, 0.55);
  kasten.castShadow = true;
  v.group.add(kasten);
  // Kotflügel über den beiden hinteren Achsen
  for (const sx of [-1, 1]) {
    const kotfluegel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 2.3), dark);
    kotfluegel.name = BAUGRUPPE.kotfluegel;
    kotfluegel.position.set(sx * 1.02, 1.0, -v.bedLen / 2 + 1.45);
    v.group.add(kotfluegel);
    // Spritzlappen hinter der letzten Achse
    const lappen = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.03), dark);
    lappen.position.set(sx * 1.02, 0.78, -v.bedLen / 2 + 0.35);
    v.group.add(lappen);
  }
  // Unterfahrschutz und Rückleuchten am Heck
  // Buendig ans Rahmenende: 72 cm dahinter hing er in der Luft
  const heckZ = -v.bedLen / 2 - 0.14;
  const schutz = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.1), bedMat);
  schutz.position.set(0, 0.52, heckZ);
  v.group.add(schutz);
  for (const sx of [-1, 1]) {
    const leuchte = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.06), rot);
    leuchte.position.set(sx * 0.85, 0.78, heckZ);
    v.group.add(leuchte);
  }
}

/**
 * Ladekran hinter dem Fahrerhaus, wie ihn Schrotthändler auf dem LKW haben.
 *
 * Er lädt nichts ab — das macht der Spieler. Er steht da, weil ein
 * Schrotthändler ohne Kran nicht nach Schrotthändler aussieht. Beim Andocken
 * schwenkt der Ausleger zur Seite, damit er nicht über der Ladefläche hängt und
 * dem Baggerfahrer im Weg ist.
 *
 * Zurückgegeben wird die Säule: Alles darüber dreht mit, der Sockel bleibt stehen.
 */
function buildCrane(v: VehicleModelContext, dark: THREE.MeshStandardMaterial): THREE.Group {
  const stahl = new THREE.MeshStandardMaterial({ color: 0x6d7276, roughness: 0.7, metalness: 0.5 });
  const gelb = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.6, metalness: 0.3 });
  /*
   * DER BOCK STEHT VOR DER MULDE, NICHT IN IHR (E-076).
   *
   * Bis zum 15.09.2026 sass er auf `bedLen/2 + 0,05` und war 0,70 m tief —
   * also 0,30 m innerhalb der Ladefläche und 12 cm tief im Bodenblech.
   * Jetzt liegt seine Mitte in der Lücke zwischen Muldenstirn und dem
   * verkürzten Fahrerhaus (`KRAN_Z`), und er ist nur noch `KRAN_BOCK_TIEFE`
   * tief. Beide Zahlen sind oben vorgerechnet.
   */
  const sockelZ = v.bedLen / 2 + KRAN_Z;
  /*
   * Die fünf Teile des Bocks bekommen einzeln ihren Gruppennamen, statt in
   * einer gemeinsamen `THREE.Group` zu hängen. Grund ist derselbe wie beim
   * Dachspoiler: Eine Gruppe mehr ist ein Objekt mehr, und jedes Objekt zieht
   * vier Zufallszahlen aus `MathUtils.generateUUID` — was die 24 Ladungen von
   * `test/kipper.test.ts` durcheinanderwürfelt. Ein Name kostet nichts.
   */
  const sockel = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.34, KRAN_BOCK_TIEFE), dark);
  sockel.name = BAUGRUPPE.kranbock;
  sockel.position.set(0, 1.05, sockelZ);
  sockel.castShadow = true;
  v.group.add(sockel);
  // Zwei Abstützungen seitlich — ohne die steht kein Kran auf einem LKW
  for (const sx of [-1, 1]) {
    const stuetze = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.22), stahl);
    stuetze.name = BAUGRUPPE.kranbock;
    stuetze.position.set(sx * 1.05, 0.95, sockelZ);
    v.group.add(stuetze);
    const fuss = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.1, 8), dark);
    fuss.name = BAUGRUPPE.kranbock;
    fuss.position.set(sx * 1.05, 0.72, sockelZ);
    v.group.add(fuss);
  }

  const saeule = new THREE.Group();
  saeule.name = BAUGRUPPE.kransaeule;
  saeule.position.set(0, 1.22, sockelZ);
  v.group.add(saeule);
  /*
   * DIE SÄULE IST EIN ACHTKANT, KEIN QUADER.
   *
   * Ein Quader von 0,46 m Kante braucht beim Drehen seine Diagonale — 0,65 m.
   * Genau daran scheiterte die Lücke: Der Schwenk beim Andocken hätte die
   * Ecken in Stirnwand und Kabine getrieben (gemessen 8,0 bzw. 25,5 cm). Ein
   * Rundturm braucht immer nur seinen Durchmesser, und ein Kranturm ist in
   * Wirklichkeit auch rund.
   */
  const auslegerY = auslegerHoehe(v.kind, v.bodyStyle) - 1.22;
  const turmH = auslegerY + 0.1;
  const turm = new THREE.Mesh(
    new THREE.CylinderGeometry(KRAN_SAEULE_D / 2, KRAN_SAEULE_D / 2, turmH, 8),
    gelb
  );
  turm.position.y = turmH / 2;
  turm.castShadow = true;
  saeule.add(turm);

  /*
   * Hauptausleger: schräg nach hinten über die Ladefläche, wie im
   * Transportzustand. Seine Höhe richtet sich nach der LADUNG und nicht nach
   * einer festen Zahl — bei Rungenaufbau lag er vorher 41 cm in der Fuhre
   * (`auslegerHoehe`).
   */
  const ausleger = new THREE.Group();
  ausleger.position.y = auslegerY;
  ausleger.rotation.x = 0.42;
  saeule.add(ausleger);
  const arm1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 2.5), gelb);
  arm1.position.z = -1.15;
  arm1.castShadow = true;
  ausleger.add(arm1);
  /*
   * KNICKARM: DER Z-KNICK, NICHT DER HÄNGENDE ARM (E-076).
   *
   * Er zeigte mit −1,15 rad nach unten und hinten — und hing damit 0,70 m
   * unter dem Auslegergelenk, also MITTEN IN DER FUHRE (gemessen: tiefster
   * Kranpunkt über der Fläche 1,54 m, Ladung bis 2,14 m). Die Rechnung dagegen
   * wäre eine um 0,70 m höhere Säule gewesen, und damit ein Kran von 4,4 m
   * Bauhöhe auf einem 2,5-m-Lastwagen.
   *
   * Jetzt klappt der Arm zurück nach VORN, so wie ein Knickarmkran im
   * Transportzustand wirklich steht: Er liegt auf dem Hauptarm auf und zeigt
   * zur Säule zurück. Gerechnet: Die Richtung des eingeklappten Arms soll
   * (0 | −0,25 | +0,97) sein — nach vorn und leicht abwärts. Mit der Neigung
   * des Hauptarms (0,42 rad) ergibt das einen Knickwinkel von
   * atan2(−0,25 ; −0,97) − 0,42 = −3,31 rad.
   */
  const knick = new THREE.Group();
  knick.position.z = -2.3;
  knick.rotation.x = -3.31;
  ausleger.add(knick);
  const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 1.9), gelb);
  arm2.position.z = -0.9;
  arm2.castShadow = true;
  knick.add(arm2);
  // Hydraulikzylinder am Hauptarm — das Detail, das den Kran erst glaubhaft macht
  const zylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.3, 8), stahl);
  zylinder.rotation.x = Math.PI / 2 - 0.25;
  zylinder.position.set(0, -0.26, -0.75);
  ausleger.add(zylinder);
  // Kleiner Sortiergreifer an der Spitze
  const greifer = new THREE.Group();
  greifer.position.z = -1.75;
  knick.add(greifer);
  const kopf = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.22, 8), stahl);
  greifer.add(kopf);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const schale = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.14), dark);
    schale.position.set(Math.cos(a) * 0.17, -0.28, Math.sin(a) * 0.17);
    schale.rotation.z = -Math.cos(a) * 0.45;
    schale.rotation.x = Math.sin(a) * 0.45;
    greifer.add(schale);
  }
  return saeule;
}

/**
 * PKW mit Anhänger — zwei Körper, gelenkig an der Kupplung.
 *
 * Vorher war beides ein starres Gebilde, und die Maße überlappten sogar: Das
 * Zugfahrzeug stand mit seinem Heck über dem Anhängerboden. Jetzt sitzt vorn
 * der Wagen, dahinter die Deichsel, und der Anhänger hängt in einer eigenen
 * Gruppe, deren Ursprung genau die Kupplung ist. Wer sie dreht, schwenkt den
 * Anhänger um den Kupplungspunkt — so, wie ein Anhänger es tut.
 *
 * Zurückgegeben wird diese Gruppe; der Ablauf führt sie beim Fahren nach.
 */
/**
 * Hoehe der Bordwand. Steht als eigene Funktion da, weil nicht nur der Aufbau
 * sie braucht: Auch die Ladung richtet sich danach — sie darf nur knapp
 * darueber hinausragen (Wunsch 11.09.2026).
 */
export function wandHoehe(kind: string, bodyStyle?: string): number {
  if (kind === "abholer") return 2.5;
  if (bodyStyle === "koffer") return 1.55;
  if (bodyStyle === "rungen") return 1.05;
  return 0.64;
}

function buildCarAndTrailer(
  v: VehicleModelContext,
  _paint: THREE.MeshStandardMaterial,
  dark: THREE.MeshStandardMaterial,
  bedMat: THREE.MeshStandardMaterial,
  teile: VehicleModelParts
): THREE.Group {
  const raeder = teile.raeder;
  const farben = [0x35618f, 0x7a2f2a, 0x2f5c3a, 0x8a8f95, 0xb08a3a, 0x2b2f36];
  const lack = new THREE.MeshStandardMaterial({
    color: farben[Math.floor(Math.random() * farben.length)],
    roughness: 0.45,
    metalness: 0.2,
  });
  /*
   * Getönt statt klar. Klarglas war hier unsichtbar: Die Scheibe liegt vor
   * dem Blech, und durch 82 % Transmission sah man genau dieses Blech —
   * die Kabine war ein einfarbiger Block ohne Fenster. Eine dunkle Scheibe
   * zeichnet sich gegen jeden Lackton ab, und der Fahrer bleibt sichtbar.
   */
  const glas = new THREE.MeshPhysicalMaterial({
    color: 0x30505e,
    roughness: 0.12,
    metalness: 0,
    transmission: 0.3,
    thickness: 0.05,
    transparent: true,
    opacity: 0.72,
  });
  const chrom = new THREE.MeshStandardMaterial({
    color: 0xb9bec3,
    roughness: 0.3,
    metalness: 0.85,
  });
  const klar = new THREE.MeshStandardMaterial({
    color: 0xf2eddc,
    roughness: 0.25,
    emissive: 0x2a2418,
  });
  const rotLicht = new THREE.MeshStandardMaterial({
    color: 0x8e2318,
    roughness: 0.35,
    emissive: 0x2a0806,
  });
  const kombi = Math.random() < 0.7;
  const len = kombi ? 4.3 : PKW_LAENGE_MAX;
  teile.fahrwerk = pkwFahrwerk(v.bedLen, len);
  // Kupplung: ein Stück vor der Anhängerfront, dort greift die Deichsel an
  const kupplungZ = teile.fahrwerk.anhaenger!.kupplung;
  // Zugfahrzeug steht davor, mit Luft zwischen Heck und Kupplung
  const zugZ = kupplungZ + 0.35 + len / 2;
  /** z in Wagenkoordinaten: 0 = Mitte, positiv nach vorn. */
  const w = (z: number): number => zugZ + z;

  /*
   * --- Zugfahrzeug ---
   *
   * Vorher waren das zwei Quader übereinander, und die Limousine war ein
   * 1,35 m hoher Block ohne Dach. Ein Auto liest sich aus der Entfernung an
   * drei Dingen: der Bordkante über den Rädern, dem abgesetzten Dachaufbau
   * und den Lichtern vorn und hinten. Genau die gibt es jetzt.
   */
  const add = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    schatten = false
  ): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (schatten) m.castShadow = true;
    v.group.add(m);
    return m;
  };

  // Wagenkasten bis Fensterunterkante
  add(new THREE.BoxGeometry(1.82, 0.62, len), lack, 0, 0.76, w(0), true);
  // Motorhaube vorn und — beim Stufenheck — der Kofferraum hinten
  add(new THREE.BoxGeometry(1.74, 0.14, len * 0.3), lack, 0, 1.13, w(len * 0.33), true);
  if (!kombi) {
    add(new THREE.BoxGeometry(1.74, 0.14, len * 0.24), lack, 0, 1.13, w(-len * 0.36), true);
  }
  // Dachaufbau: beim Kombi bis ans Heck, beim Stufenheck kürzer und mittiger
  const dachLen = kombi ? len * 0.62 : len * 0.46;
  const dachZ = kombi ? -len * 0.12 : -len * 0.06;
  add(new THREE.BoxGeometry(1.7, 0.56, dachLen), lack, 0, 1.42, w(dachZ), true);
  // Scheiben: Front geneigt, Seiten längs, hinten senkrecht
  const front = add(
    new THREE.BoxGeometry(1.62, 0.52, 0.05),
    glas,
    0,
    1.42,
    w(dachZ + dachLen / 2 + 0.06)
  );
  front.rotation.x = 0.36;
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.05, 0.4, dachLen - 0.5), glas, sx * 0.89, 1.44, w(dachZ));
  }
  add(new THREE.BoxGeometry(1.58, 0.44, 0.05), glas, 0, 1.42, w(dachZ - dachLen / 2 - 0.05));
  // Radläufe — ohne sie kleben die Räder am Kasten
  const bogen = new THREE.TorusGeometry(0.4, 0.05, 6, 10, Math.PI);
  const radZ = [len / 2 - 0.95, -len / 2 + 0.95];
  for (const sx of [-1, 1]) {
    for (const rz of radZ) {
      const m = new THREE.Mesh(bogen, lack);
      m.position.set(sx * 0.84, 0.46, w(rz));
      m.rotation.y = Math.PI / 2;
      v.group.add(m);
    }
  }
  // Stoßstangen, Kennzeichen, Leuchten
  add(new THREE.BoxGeometry(1.8, 0.2, 0.14), dark, 0, 0.56, w(len / 2 + 0.02), true);
  add(new THREE.BoxGeometry(1.8, 0.2, 0.14), dark, 0, 0.56, w(-len / 2 - 0.02), true);
  add(new THREE.BoxGeometry(0.4, 0.12, 0.03), chrom, 0, 0.56, w(len / 2 + 0.1));
  add(new THREE.BoxGeometry(0.9, 0.1, 0.05), dark, 0, 0.82, w(len / 2 + 0.01));
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.34, 0.16, 0.05), klar, sx * 0.66, 0.86, w(len / 2 + 0.01));
    add(new THREE.BoxGeometry(0.3, 0.18, 0.05), rotLicht, sx * 0.7, 0.88, w(-len / 2 - 0.01));
  }
  // Außenspiegel und Türfuge
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.14, 0.09, 0.07), dark, sx * 0.95, 1.2, w(dachZ + dachLen / 2 - 0.2));
    add(new THREE.BoxGeometry(0.02, 0.5, 0.03), dark, sx * 0.92, 0.8, w(0.15));
  }
  const haut = new THREE.MeshStandardMaterial({ color: 0xe3b18c, roughness: 0.8 });
  const kopf = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), haut);
  kopf.position.set(-0.42, 1.36, w(dachZ + dachLen / 2 - 0.45));
  v.group.add(kopf);
  // Anhängerkupplung am Heck des Wagens
  const kugel = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), dark);
  kugel.position.set(0, 0.5, kupplungZ);
  v.group.add(kugel);

  for (const rx of [-0.86, 0.86]) {
    for (const rz of radZ) {
      // Die Vorderräder lenken (E-140) — `radZ[0]` ist die Vorderachse.
      const lenk = rz === radZ[0] ? teile.lenkRaeder : undefined;
      baueRad(v.group, rx, 0.33, w(rz), 0.33, 0.2, false, undefined, lenk);
    }
  }

  // --- Anhänger (eigene Gruppe, Ursprung = Kupplung) ---
  const anhaenger = new THREE.Group();
  anhaenger.position.set(0, 0, kupplungZ);
  v.group.add(anhaenger);
  // Alles Folgende in Anhänger-Koordinaten: z = 0 ist die Kupplung,
  // der Anhänger liegt dahinter (negatives z).
  const zu = (zImRahmen: number): number => zImRahmen - kupplungZ;

  const deichsel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.05), dark);
  deichsel.position.set(0, 0.5, zu(v.bedLen + 0.525));
  anhaenger.add(deichsel);
  const rahmen = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.24, v.bedLen + 0.5), dark);
  rahmen.position.set(0, 0.72, zu(v.bedLen / 2 - 0.1));
  anhaenger.add(rahmen);
  const boden = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.08, v.bedLen), bedMat);
  boden.position.set(0, 0.86, zu(v.bedLen / 2));
  boden.castShadow = true;
  anhaenger.add(boden);
  // Bordwände — ohne sie ist es ein Brett, kein Anhänger
  for (const [bx, bz, bw, bd] of [
    [0, zu(0.02), 1.86, 0.06],
    [0, zu(v.bedLen - 0.02), 1.86, 0.06],
    [-0.9, zu(v.bedLen / 2), 0.06, v.bedLen],
    [0.9, zu(v.bedLen / 2), 0.06, v.bedLen],
  ] as Array<[number, number, number, number]>) {
    const wand = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.34, bd), bedMat);
    wand.position.set(bx, 1.07, bz);
    wand.castShadow = true;
    anhaenger.add(wand);
  }
  for (const rx of [-0.98, 0.98]) {
    baueRad(anhaenger, rx, 0.33, zu(v.bedLen / 2), 0.33, 0.2, false, raeder);
    // Kotflügel — ein Anhänger ohne sie ist ein Brett auf Rollen
    const kotfluegel = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.96), dark);
    kotfluegel.position.set(rx, 0.72, zu(v.bedLen / 2));
    anhaenger.add(kotfluegel);
  }
  // Stützrad an der Deichsel und Rückleuchten am Heck
  const stuetze = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.42, 6), dark);
  stuetze.position.set(0.18, 0.29, zu(v.bedLen + 0.35));
  anhaenger.add(stuetze);
  for (const sx of [-1, 1]) {
    const leuchte = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x8e2318, roughness: 0.35, emissive: 0x2a0806 })
    );
    leuchte.position.set(sx * 0.78, 0.82, zu(-0.06));
    anhaenger.add(leuchte);
  }

  // Die Ladefläche gehört an den Anhänger, nicht an den Rahmen: Sie muss beim
  // Einlenken mitschwenken, sonst bleibt die Ladung in der Luft stehen.
  // Höhe = Oberkante des Anhängerbodens; z = 0 des Bodens, der von 0 bis
  // bedLen reicht (beim LKW liegt er um bedLen/2 versetzt).
  v.bedGroup.position.set(0, 0.9, zu(0));
  anhaenger.add(v.bedGroup);

  return anhaenger;
}

/* --------------------------------------------------------------------- */
/* Leiterrahmen (E-108)                                                    */

/** Höhe der Rahmenmitte über Grund (m) — Bestand, war die Lage der Platte. */
const RAHMEN_Y = 0.65;

/** Bauhöhe eines Längsträgers (m) — Bestand, war die Dicke der Platte. */
const RAHMEN_H = 0.5;

/**
 * Mitte je Längsträger in x (m).
 *
 * Aus dem Rad gerechnet, nicht gegriffen: Der innere Zwillingsreifen der
 * Hinterachse steht auf x 0,67 und ist 0,30 m breit, liegt also zwischen 0,52
 * und 0,82. Ein Träger von 0,14 m Breite auf 0,43 reicht bis 0,50 — 2 cm Luft
 * zum Reifen. Das Verhältnis stimmt auch am echten Wagen: 0,86 m Spurweite
 * der Träger bei 2,50 m Fahrzeugbreite.
 */
const RAHMEN_TRAEGER_X = 0.43;

/** Breite eines Längsträgers (m) — so breit, dass 2 cm zum Reifen bleiben. */
const RAHMEN_TRAEGER_B = 0.14;

/**
 * Der Rahmen als Leiter statt als Platte — EIN Netz, wie vorher.
 *
 * Befund E-076: Der innere Zwillingsreifen steckte 30 cm im Rahmen, weil der
 * ein durchgehender Quader von 2,20 m Breite (x ±1,10) war und der Reifen bei
 * x 0,52 … 0,82 steht. Ein Fahrgestell ist aber ein Leiterrahmen: zwei
 * Längsträger, dazwischen Querträger, und die Räder laufen AUSSEN daran
 * vorbei. Von der Seite sieht man den Reifen jetzt über und unter dem
 * Rahmenblech stehen, statt halb darin zu verschwinden.
 *
 * Verschmolzen zu einem einzigen Netz, und das ist keine Kür: Zeichenrufe
 * sind auf dem iPhone mini der Engpass, Dreiecke nicht (E-025). Fünf Quader
 * einzeln wären vier Zeichenrufe mehr JE FAHRZEUG — die Netzzahl bleibt so
 * bei 79 bis 102 je Bauart, genau wie vorher.
 */
function leiterrahmen(laenge: number): THREE.BufferGeometry {
  const teile: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const g = new THREE.BoxGeometry(RAHMEN_TRAEGER_B, RAHMEN_H, laenge);
    g.translate(sx * RAHMEN_TRAEGER_X, 0, 0);
    teile.push(g);
  }
  /*
   * Drei Querträger — ohne sie ist es keine Leiter, sondern zwei Schienen.
   * Sie sitzen obenbündig und reichen nur bis zur Außenkante der Träger
   * (±0,50 m), kommen also keinem Rad nahe.
   */
  for (const t of [-0.34, 0, 0.34]) {
    const g = new THREE.BoxGeometry(2 * RAHMEN_TRAEGER_X + RAHMEN_TRAEGER_B, 0.12, 0.16);
    g.translate(0, RAHMEN_H / 2 - 0.06, t * laenge);
    teile.push(g);
  }
  const g = mergeGeometries(teile, false);
  if (!g) throw new Error("Leiterrahmen liess sich nicht verschmelzen");
  return g;
}

/**
 * DAS PRIPADA-ZEICHEN AM ABHOLER (E-133).
 *
 * Patrick, 17.10.2026: „abholer und eigene LKW sollen auch pripada Logo
 * tragen". Achims Abrollkipper ist der einzige Laster, der dem Hof gehört —
 * Anlieferer sind Kunden und bekommen nichts. Die beiden Seitenwände bekommen
 * statt des einfarbigen Grüns den gemeinsamen Atlas (`werbung.werbeAtlas`):
 * außen das Signet, sonst überall dasselbe Grün. Die Netzzahl bleibt (E-108).
 *
 * EIN Material je Programmlauf, nicht je Wagen: Jedes neue three-Objekt zieht
 * Zufallszahlen für seine UUID und verschöbe damit die gewürfelten Fuhren.
 * `null`, solange es keinen Atlas gibt (Vitest ohne Leinwand) — dann bleibt
 * alles wie bisher.
 */
let logoStoff: THREE.MeshStandardMaterial | null = null;
function pripadaLogoStoff(): THREE.MeshStandardMaterial | null {
  if (logoStoff) return logoStoff;
  const atlas = werbeAtlas();
  if (!atlas) return null;
  // Weiß × Atlasgrün = das Grün von `sideMat`; Rauheit und Metall wie dort
  logoStoff = new THREE.MeshStandardMaterial({ color: 0xffffff, map: atlas, roughness: 0.75, metalness: 0.35 });
  return logoStoff;
}

/**
 * Die Seitenwand als Quader mit Atlas-Koordinaten: Die Außenfläche (links
 * −x, rechts +x) zeigt das Signet im Seitenverhältnis der Wand, alle anderen
 * Flächen das reine Grün. `BoxGeometry` legt die Flächen in der Reihenfolge
 * +x, −x, +y, −y, +z, −z an, je vier Ecken, und richtet jede so aus, dass sie
 * von außen ungespiegelt liest.
 */
function logoWand(wallH: number, bedLen: number, dir: -1 | 1): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(0.08, wallH, bedLen);
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  const aussen = dir > 0 ? 0 : 1;
  const logo = atlasFeld("pripadaGruen", bedLen / wallH);
  const gruen = atlasFeld("pripadaGruenRand");
  for (let i = 0; i < uv.count; i++) {
    const f = Math.floor(i / 4) === aussen ? logo : gruen;
    uv.setXY(i, f.u0 + uv.getX(i) * (f.u1 - f.u0), f.v0 + uv.getY(i) * (f.v1 - f.v0));
  }
  return geo;
}

export function buildVehicleModel(v: VehicleModelContext): VehicleModelParts {
  const paint = new THREE.MeshStandardMaterial({ color: lackFuer(v.halter), roughness: 0.62 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2e31, roughness: 0.8 });
  const bedMat = new THREE.MeshStandardMaterial({ color: 0x5c6166, roughness: 0.7, metalness: 0.4 });

  // Was der Ablauf danach ansteuert, wird hier gesammelt und zurückgegeben
  const teile: VehicleModelParts = {
    fahrwerk: lkwFahrwerk(v.bedLen),
    lenkRaeder: [],
    tailGate: null,
    crane: null,
    trailer: null,
    raeder: [],
  };

  if (v.kind === "pkw") {
    teile.trailer = buildCarAndTrailer(v, paint, dark, bedMat, teile);
    return teile;
  }
  const chassis = new THREE.Mesh(leiterrahmen(v.bedLen + 1.6), dark);
  chassis.name = BAUGRUPPE.rahmen;
  chassis.position.set(0, RAHMEN_Y, 0.8);
  v.group.add(chassis);
  /*
   * Fahrerhaus in zwei Höhen: unten schmaler als oben, so wie ein Fernfahrer-
   * haus über dem Rahmen auskragt. Ein einzelner Quader sieht aus wie ein
   * Container mit Fenstern.
   *
   * MIT KRAN WIRD ES EIN NAHVERKEHRSHAUS (E-076): Die Schnauze bleibt, wo sie
   * ist (`KABINE_VORN`), die Rückwand rückt nach vorn. Der Umriss des Wagens
   * ändert sich dadurch nicht — nur der Kran bekommt seinen Platz.
   */
  const kabTiefe = kabinenTiefe(v.withCrane === true);
  const cz = kabinenMitte(v.bedLen, v.withCrane === true);
  const kabHinten = cz - kabTiefe / 2;
  /*
   * Die Kabine sass mit ihrer Unterkante auf 0,92 m, der Scheitel des
   * Vorderrads liegt auf 0,96 m — gemessen 2,8 cm Reifen im Blech
   * (`tools/fahrzeug-durchdringung.ts`, 15.09.2026). Ein Radhaus hat dieser
   * Quader nicht, also wird er um 4 cm angehoben statt ausgeschnitten.
   */
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.72, kabTiefe), paint);
  cab.name = BAUGRUPPE.fahrerhaus;
  cab.position.set(0, 1.32, cz);
  cab.castShadow = true;
  v.group.add(cab);
  // Das obere Haus steht hinter der Frontscheibe zurück, damit die Scheibe
  // eine Fläche für sich ist und nicht mit dem Blech in einer Ebene liegt.
  const obenVorn = v.bedLen / 2 + KABINE_VORN - OBERHAUS_VORN;
  const obenTiefe = obenVorn - (kabHinten - OBERHAUS_HINTEN);
  const cabOben = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.62, obenTiefe), paint);
  cabOben.name = BAUGRUPPE.fahrerhaus;
  cabOben.position.set(0, 1.92, obenVorn - obenTiefe / 2);
  cabOben.castShadow = true;
  v.group.add(cabOben);
  // Verglasung: Frontscheibe und zwei Seitenfenster
  // Klar durchsichtig, damit man den Fahrer dahinter sitzen sieht
  // Getönt, aus demselben Grund wie beim PKW: Klarglas vor Blech ist kein Fenster.
  const windowMat = new THREE.MeshPhysicalMaterial({
    color: 0x30505e,
    roughness: 0.12,
    metalness: 0,
    transmission: 0.3,
    thickness: 0.05,
    transparent: true,
    opacity: 0.72,
  });
  /*
   * Verglasung. Sie sass bis 12.09.2026 im Blech: Die Frontscheibe lag zwei
   * Zentimeter hinter der Kabinenvorderkante und war schlicht nicht zu sehen.
   * Jetzt sitzt sie auf der Flucht des oberen Hauses, und zwar dort, wo sie
   * hingehoert — in dessen oberer Haelfte, nicht auf halber Kabinenhoehe.
   */
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.56, 0.06), windowMat);
  windshield.position.set(0, 1.94, v.bedLen / 2 + KABINE_VORN + 0.05);
  v.group.add(windshield);
  for (const sx of [-1, 1]) {
    // Seitenfenster: so lang wie das obere Haus es zulässt, mittig darin
    const sideWin = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.46, Math.min(1.1, obenTiefe - 0.3)),
      windowMat
    );
    sideWin.position.set(sx * 1.11, 1.92, obenVorn - obenTiefe / 2 + 0.1);
    v.group.add(sideWin);
  }
  // Fahrer hinterm Steuer
  const driverSkin = new THREE.MeshStandardMaterial({ color: 0xe3b18c, roughness: 0.8 });
  const driverShirt = new THREE.MeshStandardMaterial({ color: 0x35506b, roughness: 0.85 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.28, 4, 10), driverShirt);
  torso.position.set(-0.45, 1.62, cz - 0.15);
  v.group.add(torso);
  const dHead = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), driverSkin);
  dHead.position.set(-0.45, 1.92, v.bedLen / 2 + 0.75);
  v.group.add(dHead);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.116, 12, 10), driverShirt);
  cap.scale.set(1, 0.6, 1);
  cap.position.set(-0.45, 1.97, v.bedLen / 2 + 0.74);
  v.group.add(cap);
  // Dreiachser: vorn Einzelrad und lenkbar, hinten Zwillinge auf beiden Achsen
  const [vorn, h1, h2] = lkwAchsen(v.bedLen);
  const achsen: Array<[number, boolean]> = [
    [vorn, false],
    [h1, true],
    [h2, true],
  ];
  for (const [z, zwilling] of achsen) {
    for (const x of [-1.0, 1.0]) {
      const lenk = z === vorn ? teile.lenkRaeder : undefined;
      baueRad(v.group, x, 0.48, z, 0.48, 0.3, zwilling, teile.raeder, lenk);
    }
  }
  baueFahrerhaus(v, paint, dark, windowMat);
  baueFahrgestell(v, dark, bedMat);

  // Ladefläche: Ursprung am Heck-Kipp-Gelenk (Boden-Höhe der Fläche)
  const bedW = BED_HALF_W * 2;
  v.bedGroup.position.set(0, 1.05, -v.bedLen / 2); // schließt bündig mit dem Heck ab
  v.group.add(v.bedGroup);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(bedW, 0.12, v.bedLen), bedMat);
  /*
   * Die Oberkante des Blechs liegt auf der Oberkante des KOLLIDERS (+0,04),
   * nicht zwei Zentimeter darueber (E-051).
   *
   * Vorher stand das Blech mittig auf 0 und damit mit seiner Oberkante auf
   * +0,06 — alles, was auf der Flaeche lag, wurde grundsaetzlich zwei
   * Zentimeter eingesunken gezeichnet. Bei 12 cm Blechdicke ist das ein
   * Sechstel, und zusammen mit dem, was schwere Stapel zusaetzlich
   * durchdruecken, schaute ein Stueck unten heraus.
   *
   * Angeglichen wird hier und nicht am Kollider: Den Quader dicker zu machen
   * hat den Kipper-Katapult messbar verschlechtert (Mittel 122 → 160 km/h ueber
   * 24 Saaten), weil seine Rueckwand am Kipplager hoeher wird.
   */
  floor.name = BAUGRUPPE.flaeche;
  floor.position.set(0, FLAECHE_KOLLIDER_OBEN - 0.06, v.bedLen / 2);
  floor.castShadow = true;
  v.bedGroup.add(floor);
  const isContainer = v.kind === "abholer";
  const aufbau = v.bodyStyle ?? "flach";
  const wallH = wandHoehe(v.kind, v.bodyStyle);
  const sideMat = isContainer
    ? new THREE.MeshStandardMaterial({ color: PRIPADA_GRUEN, roughness: 0.75, metalness: 0.35 })
    : aufbau === "koffer"
      ? new THREE.MeshStandardMaterial({ color: 0x53585d, roughness: 0.8, metalness: 0.3 })
      : bedMat;
  // Bordwände links und rechts als aufklappbare Klappen (Scharnier unten
  // außen). Beim Abladen fallen sie zur Seite — der Schrott darf herunter.
  for (const dir of [-1, 1] as const) {
    const hinge = new THREE.Group();
    hinge.name = BAUGRUPPE.bordwand;
    hinge.position.set(dir * (BED_HALF_W + 0.05), 0.02, v.bedLen / 2);
    const logo = isContainer ? pripadaLogoStoff() : null;
    const side = new THREE.Mesh(
      logo ? logoWand(wallH, v.bedLen, dir) : new THREE.BoxGeometry(0.08, wallH, v.bedLen),
      logo ?? sideMat
    );
    side.position.y = wallH / 2;
    side.castShadow = true;
    hinge.add(side);
    // Verriegelungsbügel als Detail
    for (const lz of [-v.bedLen * 0.3, v.bedLen * 0.3]) {
      const latch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.1), bedMat);
      latch.position.set(dir * 0.06, wallH - 0.2, lz);
      hinge.add(latch);
    }
    // Rungen: senkrechte Steher aussen an der Wand — daran erkennt man den
    // Schrottaufbau schon von weitem
    if (aufbau === "rungen") {
      for (let i = 0; i < 4; i++) {
        const rz = -v.bedLen / 2 + 0.5 + (i / 3) * (v.bedLen - 1.0);
        const runge = new THREE.Mesh(new THREE.BoxGeometry(0.1, wallH + 0.3, 0.12), dark);
        runge.position.set(dir * 0.1, (wallH + 0.3) / 2, rz);
        runge.castShadow = true;
        hinge.add(runge);
      }
    }
    v.bedGroup.add(hinge);
    const wallBody = v.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setCcdEnabled(true)
    );
    // 12 cm statt 6: dünne Wände liessen die Ladung beim Kippen
    // durchschlagen, als wäre der Wagen Luft
    v.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.12, wallH / 2, v.bedLen / 2),
      wallBody
    );
    v.sideWalls.push({ hinge, mesh: side, body: wallBody, dir });
  }
  const front = new THREE.Mesh(new THREE.BoxGeometry(bedW, wallH, 0.08), sideMat);
  front.name = BAUGRUPPE.stirnwand;
  front.position.set(0, wallH / 2, v.bedLen);
  v.bedGroup.add(front);
  if (v.kind !== "kipper") {
    // Heckklappe sitzt ganz am hinteren Rand und klappt nach unten weg
    const hinge = new THREE.Group();
    hinge.name = BAUGRUPPE.heckklappe;
    hinge.position.set(0, 0.02, -0.04);
    const rear = new THREE.Mesh(new THREE.BoxGeometry(bedW, wallH, 0.08), sideMat);
    rear.position.y = wallH / 2;
    rear.castShadow = true;
    hinge.add(rear);
    v.bedGroup.add(hinge);
    const rearBody = v.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setCcdEnabled(true)
    );
    v.world.createCollider(
      RAPIER.ColliderDesc.cuboid(bedW / 2, wallH / 2, 0.12),
      rearBody
    );
    teile.tailGate = { hinge, mesh: rear, body: rearBody };
  }
  if (isContainer) {
    // Sicken auf den Containerwänden
    for (const sx of [-BED_HALF_W - 0.11, BED_HALF_W + 0.11]) {
      for (let z = 0.6; z < v.bedLen; z += 1.0) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.06, wallH - 0.2, 0.12), sideMat);
        rib.position.set(sx, wallH / 2, z);
        v.bedGroup.add(rib);
      }
    }
  }

  if (v.withCrane) teile.crane = buildCrane(v, dark);

  return teile;
}
