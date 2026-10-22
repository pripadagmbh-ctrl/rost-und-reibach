import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ABFALLFRAKTIONEN, getMaterial } from "../materials/catalog";
import { type Anteil, fraktionVonTeil, istPressbar } from "../materials/purity";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { baueGeometrie, fraktionsbild, type BauId } from "./objektbau";
import {
  KATALOG_BIG,
  KATALOG_HUGE,
  KATALOG_SPECS,
  type PileSpec,
} from "./objektkatalog";
import { BESEN_PLATZ } from "./startplatz";
import { spaeneGeometrie, spaeneHuelle } from "./spaene";

/**
 * Schrottteile mit materialtypischen Formen (Briefing Kap. 7).
 * Generische Form-Fabrik: dieselben Specs erzeugen Starthaufen, Fahrzeug-
 * Ladungen (M3) und beim Laden den gespeicherten Zustand.
 */

/** Serialisierbare Formbeschreibung eines Teils */
export interface ScrapShape {
  kind: "box" | "cyl" | "torus" | "wire";
  /** box: [w,h,d] · cyl: [radius, länge] · torus: [radius, rohrRadius] · wire (Drahtknäuel): [radius] */
  dims: number[];
  color: number;
  /** true = wurde in der Presse plattgedrückt (persistiert im Save) */
  flat?: boolean;
  /**
   * Aus welchen Bauteilen das Ding zusammengesetzt wird (world/objektbau.ts).
   * Ohne Angabe bleibt es der nackte Grundkörper mit Fraktionsfarbe — so
   * bleiben die alten Einträge unverändert.
   */
  bau?: BauId;
  /**
   * Wie das Ding heißt — „Kühlschrank", „Traktor-Hinterachse".
   *
   * Steht hier und nicht nur im Kommentar des Katalogs, weil der Spieler im
   * Greifer lesen soll, was er gefasst hat (Wunsch 12.09.2026). Liegt in der
   * Form und nicht am Teil, damit es ohne Zutun im Spielstand landet.
   */
  name?: string;
  /**
   * Braucht Werkzeug statt roher Gewalt.
   *
   * Manches trennt sich nicht durch Zusammendruecken, sondern nur mit Flex
   * oder Abdrueckmaschine — eine Alufelge etwa gibt man nicht mit der Spinne
   * vom Reifen frei, dabei ginge die Felge kaputt (Ansage 12.09.2026). Solche
   * Stuecke sind Arbeit fuer Lambert, nicht fuer den Bagger.
   */
  nurWerkzeug?: boolean;
  /**
   * Faellt es beim Zerquetschen in seine Bestandteile?
   *
   * Manche Verbundteile trennen sich von selbst, wenn man sie zusammendrueckt
   * (Ansage 12.09.2026): Bei einer Kabeltrommel ist das Holz zerbrochen, bevor
   * das Kabel auch nur nachgibt — danach liegt beides getrennt da. Aus einem
   * Mischschrott-Teil werden so sortenreine, und genau darin liegt der Gewinn.
   */
  trennbar?: boolean;
  /**
   * Sind die Scheiben schon hin?
   *
   * Fehlt der Wert, ist alles heil — so bleiben alte Spielstaende gueltig.
   * Steht er auf true, wird beim Anlegen gar kein Glas mehr gebaut: Ein Wrack,
   * das gestern die Scheiben verloren hat, hat sie heute immer noch nicht.
   */
  glasKaputt?: boolean;
  /**
   * Woraus es besteht, nach Massenanteilen.
   *
   * Ein Objekt aus Verbundteilen ist nie sortenrein (Ansage 12.09.2026): Ein
   * Kühlschrank ist Blech, Alu, Kupfer, Styropor und Kunststoff — das ist
   * Mischschrott, bis jemand es trennt. Eine Baggerschaufel mit Gumminoppen
   * bleibt dagegen Stahlschrott, weil der Gummi nicht ins Gewicht fällt.
   * Wo die Grenze liegt, steht in `SORTENREIN_AB`.
   */
  zusammensetzung?: Anteil[];
  /**
   * Nur Presspakete: aus welchen FRAKTIONEN das Paket gebuendelt ist (0..1).
   *
   * Dieselbe Begruendung wie bei `zusammensetzung` (E-092): Was ein Stueck
   * IST, gehoert an die Form und nicht an seine Entstehungsgeschichte — nur
   * so uebersteht es den Spielstand, denn `core/save.ts` sichert je Teil bloss
   * `materialId`, `massKg` und `shape`.
   *
   * `zusammensetzung` sagt, woraus das Paket gemacht ist (Farbe, Gewicht),
   * `fraktionsmix` sagt, welche Sortierarbeit darin steckt (Geld). Bei einem
   * Paket aus lauter Kuehlschraenken ist das erste vierteilig und das zweite
   * einteilig; bei einem Paket aus Kupfer und Messing ist es umgekehrt
   * dasselbe. Siehe `ScrapItem.fraktionsmix`.
   */
  fraktionsmix?: Anteil[];
  /**
   * Massiv trotz duennem Huellmass — die Uebersteuerung aus E-042.
   *
   * Sie stand bis zum 15.09.2026 nur im Katalog (`PileSpec`) und ging beim
   * Bauen des Stuecks verloren. Solange niemand die Fraktion nachrechnet, ist
   * das harmlos: `materialId` traegt das Ergebnis schon. Aber acht Stuecke —
   * LKW-Felge, Felgenstapel, Pflugschar, dickes Rohr, drei Schaufeln,
   * Seecontainer — waeren beim naechsten Nachrechnen still von Stahlschrott zu
   * Mischschrott gerutscht, und niemand haette gesehen, woran es lag.
   *
   * Sie wandert darum mit der Form. Das kostet ein Feld im Spielstand und
   * macht ein Stueck zu dem, was es ist, statt es von seiner Herkunft abhaengen
   * zu lassen. Gefunden hat es der Waechter in `test/bauart.test.ts`.
   */
  massiv?: boolean;
  /**
   * Platzinventar statt Ware.
   *
   * Eine Gattung, keine Ausnahme fuer ein einzelnes Stueck: Der Kehrbesen ist
   * das erste, der frei aufstellbare Muellcontainer soll dasselbe tragen.
   * Ansage Patrick, 15.09.2026: „Selbst wenn er mal aufgeladen wird, gibt es
   * kein Geld dafuer. Auch wenn er in der Presse mal verschwindet, gaebe es
   * kein Geld dafuer. Und er kommt jeden Tag wieder. Also wie auch der Besen
   * ist es ein fester Bestandteil des Platzes und erscheint am naechsten Tag
   * wieder."
   *
   * Drei Zusagen also — unverkaeuflich, wertlos, am Tagesanfang wieder da —
   * und alle drei haengen an dieser einen Marke. Sie steht an der FORM und
   * nicht am Teil, damit sie ohne Zutun im Spielstand landet.
   *
   * Wie daraus „wertlos" wird, steht nicht an fuenf Stellen, sondern an einer:
   * Ein Inventarstueck bekommt beim Anlegen die **Zusammensetzung
   * `[{ materialId, massKg: 0 }]`** — es besteht wirtschaftlich aus nichts.
   * Jede Geldformel im Spiel liest bereits `composition`, wenn sie da ist:
   * der Verkauf in `economy/account.ts` und das Presspaket in
   * `world/press.ts`. Beide rechnen damit null Kilo und null Euro, ohne dass
   * sie den Besen kennen muessten.
   *
   * Zusaetzlich:
   * - `ItemManager.isCrushable` sagt Nein — die Spinne macht keinen Fladen
   *   daraus.
   * - `randomCargo` kennt es nicht: Es steht in keiner Ladungsliste und wird
   *   deshalb nie angeliefert.
   * - `ItemManager.inventarNachtragen()` legt fehlendes Inventar beim
   *   Tageswechsel wieder hin.
   *
   * Der Wert ist die KENNUNG des Stuecks („besen"), kein blosses Ja. Daran
   * erkennt `inventarNachtragen` beim Tageswechsel, welches Stueck fehlt —
   * ueber den Namen ginge es auch, aber Namen aendert man leichtfertig.
   */
  inventar?: string;
  /**
   * Späneknäuel (E-147): Variante 0..2 in `world/spaene.ts`. Dann kommen Netz
   * (geteilt je Variante) und Kollider (Quader mit abgeschrägten Ecken) von dort; `kind` bleibt
   * `box` mit dem Hüllquader in `dims`, damit Packer und Fraktionsregel wie
   * bei jedem Teil rechnen.
   */
  spaene?: number;
}

/**
 * Gehoert das Stueck zum Platz statt zum Umschlag?
 *
 * Eine Frage, eine Antwort, ein Name — damit der Muellcontainer dieselbe
 * Fassung benutzen kann wie der Besen.
 */
export function istPlatzinventar(shape?: ScrapShape | null): boolean {
  return !!shape?.inventar;
}

/**
 * Ein Stueck Platzinventar, wie es der Tageswechsel wieder hinlegt.
 *
 * Die Liste ist der gemeinsame Ort fuer Besen und Muellcontainer. Wer ein
 * weiteres Stueck baut, haengt einen Eintrag an — mehr braucht es nicht, damit
 * es unverkaeuflich, wertlos und am naechsten Tag wieder da ist.
 */
export interface Inventarstueck {
  /** Kennung, dieselbe wie in `ScrapShape.inventar`. */
  id: string;
  /** Wie es im Greifer heisst. */
  name: string;
  /** Legt es an seinen Platz. Muss idempotent sein. */
  hinlegen: (items: ItemManager) => ScrapItem | null;
}

/** Alles, was dauerhaft zum Platz gehoert. Seit E-191 (Besen raus) leer. */
export const PLATZINVENTAR: Inventarstueck[] = [];

/**
 * Aufgerolltes Kabel: ein Strang, der sich mehrfach um sich selbst windet.
 * Der Radius schwankt leicht, damit die Rolle nicht wie gedrechselt wirkt.
 */
/**
 * Kabelbund, wie er auf dem Schrottplatz liegt.
 *
 * Die frühere Wicklung sah aus wie ein aufgerollter Gartenschlauch: zu
 * gleichmäßig, zu dünn, zu ordentlich. Ein Kabelbund ist ein grob
 * zusammengelegter Strang, der in mehreren Lagen übereinanderfällt, sich
 * kreuzt und an den Rändern ausbeult. Dafür bekommt die Kurve jetzt eine
 * unregelmäßige Wicklung mit wechselnder Höhe und ein deutlich dickeres
 * Rohr — Starkstromkabel haben Finger- bis Armdicke (Wunsch 02.09.2026).
 */
function cableCoilGeometry(r: number, tube: number): THREE.BufferGeometry {
  const TURNS = 2.7;
  const STEPS = 150;
  const pts: THREE.Vector3[] = [];
  // fester Zufall je Bund, damit nicht alle gleich aussehen
  let seed = Math.floor(r * 1000) % 97;
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648 - 0.5;
  };
  const wobbleA = rnd() * 0.9;
  const wobbleB = rnd() * 0.9;
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const a = t * Math.PI * 2 * TURNS;
    // Der Strang läuft nicht sauber spiralig, sondern legt sich in Lagen
    // übereinander und beult dabei aus
    const rad =
      r * (0.72 + 0.3 * Math.sin(t * Math.PI)) +
      Math.sin(a * 1.7 + wobbleA) * r * 0.16 +
      Math.cos(a * 2.9 + wobbleB) * r * 0.1;
    // Höhe schwingt: der Bund liegt in zwei, drei Lagen
    const y = Math.sin(t * Math.PI * 2.2 + wobbleA) * tube * 1.5 + (t - 0.5) * tube * 0.6;
    pts.push(new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  // Deutlich dicker: ein Kabel ist kein Draht
  return new THREE.TubeGeometry(curve, STEPS, tube * 0.78, 7, false);
}

/**
 * Ist das Teil ein Rad — Reifen auf Felge? Dann die Farbe der Felge, sonst null.
 *
 * E-181, Patrick 20.10.2026: „Reifen haben immer felge." (Fraktion: Reifen, E-186,
 * `purity.istRad`.) Erkannt wird das Rad
 * an seiner Stueckliste (Reifen plus Stahl oder Alu), nicht am Namen: Ein Rad
 * aus einem alten Spielstand bekommt die Stueckliste vom Katalog nachgetragen
 * (`katalogFuer`) und sieht dann genauso aus.
 */
export function radFelge(shape: ScrapShape): number | null {
  if (shape.kind !== "torus" && shape.kind !== "cyl") return null;
  const zus = shape.zusammensetzung ?? [];
  if (!zus.some((a) => a.materialId === "tires")) return null;
  const felge = zus.find((a) => a.materialId === "steel" || a.materialId === "alu");
  return felge ? getMaterial(felge.materialId).color : null;
}

/**
 * Ein Rad als EIN Netz: Reifen (Torus) und Felge (Scheibe), Farbe in den
 * Eckpunkten — ein Zeichenruf wie vorher der nackte Reifen.
 *
 * Die Felge reicht bis in die Rohrmitte des Reifens und ist schmaler als er;
 * man sieht sie im Loch und als Rand innen. Liegend gebaut (Achse senkrecht),
 * wie der Achtkant-Kollider (`achtkant(ring + rohr, rohr)`, v2 E-011).
 * Farben aus `MATERIALS`: Reifen in seiner Fraktionsfarbe, Felge in der von
 * Stahl bzw. Alu.
 */
export function radGeometrie(ring: number, rohr: number, felgenFarbe: number): THREE.BufferGeometry {
  const faerben = (g: THREE.BufferGeometry, hex: number): THREE.BufferGeometry => {
    const c = new THREE.Color(hex);
    const n = g.getAttribute("position").count;
    const f = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) f.set([c.r, c.g, c.b], i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(f, 3));
    return g;
  };
  const reifen = new THREE.TorusGeometry(ring, rohr, 8, 16);
  reifen.rotateX(Math.PI / 2);
  // Felgenbett: bis zur Rohrmitte, 70 % der Reifenbreite (SW, Augenmass)
  const felge = new THREE.CylinderGeometry(ring, ring, rohr * 1.4, 16);
  // Nabe: ein Drittel des Ringhalbmessers, steht etwas vor
  const nabe = new THREE.CylinderGeometry(ring * 0.33, ring * 0.33, rohr * 1.6, 8);
  const teile = [
    faerben(reifen, getMaterial("tires").color),
    faerben(felge, felgenFarbe),
    faerben(nabe, felgenFarbe),
  ];
  const rad = mergeGeometries(teile, false) ?? teile[0]!;
  for (const t of teile) if (t !== rad) t.dispose();
  return rad;
}

/** Kollider für ein plattgedrücktes Teil (flacher Quader über der Grundfläche). */
/**
 * Dämpfung nach Masse. Physikalisch bremst Luftwiderstand leichte Körper
 * viel stärker als schwere; eine feste Bremse für alles ließ 2-Tonnen-Teile
 * so zahm wirken wie Bleche.
 */
/**
 * Höchstgeschwindigkeit QUER nach Masse.
 *
 * Die Grenze gibt es, weil die Spinne ein kinematischer Körper ist: Sie
 * überträgt beim Anschlagen beliebig viel Schwung, und ohne Deckelung fliegt
 * ein Motorblock so weit wie ein Blech.
 *
 * Sie war aber viel zu eng und galt für JEDE Richtung, also auch fürs Fallen.
 * Gemessen (11.09.2026): Ein 180-kg-Teil fiel mit konstant 1,5 m/s statt mit
 * 9,81 m/s² zu beschleunigen — genau das Schweben, das im Spiel zu sehen war.
 * Und ein weggeschleudertes Teil verlor seinen Schwung sofort wieder, statt
 * seitlich davonzufliegen. Der alte Kommentar behauptete, Fallen bleibe
 * unberührt; das stimmte nicht.
 *
 * Jetzt gilt zusaetzlich eine harte Obergrenze: WERKZEUG_MAX.
 *
 * Ein geschobenes Teil kann nicht schneller sein als das, was es geschoben
 * hat — bei einem Stoss ohne Federung gibt es nichts, woraus mehr Tempo
 * kommen koennte. Gemessen am 11.09.2026 flog ein 7-kg-Stueck mit 9,33 m/s
 * (33,6 km/h), waehrend die Spitze der Spinne sich mit 3,8 m/s bewegte — das
 * Zweieinhalbfache des Werkzeugs. Der Grund ist kein Fehler in der Physik,
 * sondern die kinematische Spinne: Sie kann beliebig viel Schwung abgeben,
 * und der Loeser schiesst eingeklemmte Stuecke heraus.
 *
 * Die alte Formel gab leichten Teilen ausserdem MEHR Tempo — genau denen,
 * die als Geschosse auffallen. Physikalisch stimmt das fuer einen festen
 * Stoss; hier ist der Stoss aber ein Rechenartefakt, kein Impuls. Darum die
 * Deckelung.
 *
 * Nach unten gilt die Grenze weiterhin gar nicht (siehe FALL_MAX) — dort
 * arbeitet die Schwerkraft.
 */

/**
 * So schnell wird ein Teil hoechstens, wenn die Maschine es anstoesst (m/s).
 *
 * Die Spitze der Spinne laeuft im Schwenk mit 3,8 m/s, die Schalen beim
 * Schliessen mit gut 4. Schneller darf nichts werden, was sie beruehrt.
 */
export const WERKZEUG_MAX = 4.2;
/**
 * Wie eine Fraktion aussieht, wenn sie aus einem Verbundteil faellt.
 *
 * Kein Katalogeintrag, sondern eine Form nach Fraktion: Kabel rollt sich zum
 * Bund, Holz bricht in Latten, Blech bleibt Blech. Die Groesse kommt aus der
 * Masse — bei rund 900 kg je Kubikmeter losem Schrott.
 */
function trennForm(materialId: string, massKg: number, herkunft?: string): ScrapShape {
  const vol = Math.max(massKg / 900, 0.004);
  const w = Math.cbrt(vol);
  const farbe = getMaterial(materialId).color;
  if (materialId === "cable")
    return { kind: "torus", dims: [w * 1.1, w * 0.42], color: farbe, name: "Kabelbund" };
  if (materialId === "tires")
    return { kind: "torus", dims: [w * 1.0, w * 0.38], color: farbe, name: "Reifen" };
  // Was aus einem Rad faellt, ist eine Felge — nicht "Aluminium-Reste".
  if (/felge|rad/i.test(herkunft ?? "") && (materialId === "alu" || materialId === "steel"))
    return {
      kind: "cyl",
      dims: [w * 1.1, w * 0.7],
      color: farbe,
      name: materialId === "alu" ? "Alufelge" : "Stahlfelge",
    };
  if (materialId === "wood")
    return { kind: "box", dims: [w * 0.8, w * 0.7, w * 2.4], color: farbe, name: "Holzbruch" };
  if (materialId === "plastic")
    return { kind: "box", dims: [w * 1.6, w * 0.5, w * 1.4], color: farbe, name: "Kunststoffreste" };
  return {
    kind: "box",
    dims: [w * 1.2, w * 0.8, w * 1.3],
    color: farbe,
    name: `${getMaterial(materialId).name}-Reste`,
  };
}

/**
 * Ab diesem Tempoverlust in einem Schritt zerspringt Glas (m/s).
 *
 * Absichtlich niedrig (Ansage 12.09.2026: „je nach Einwirkung eigentlich
 * immer"). Ein Aufschlag, den man ueberhaupt hoert, reicht — Glas ist das
 * Erste, was auf einem Schrottplatz kaputtgeht, und ein Wrack mit heilen
 * Scheiben sieht falsch aus.
 */
const GLAS_BRUCH_DV = 0.7;

/**
 * Eine Scheibe fuer alle: geteiltes Material, damit nicht jedes Objekt mit
 * Fenstern ein eigenes anlegt.
 */
let glasMaterial: THREE.MeshStandardMaterial | null = null;
function glasStoff(): THREE.MeshStandardMaterial {
  glasMaterial ??= new THREE.MeshStandardMaterial({
    color: 0x9fc2d2,
    roughness: 0.12,
    metalness: 0.05,
    transparent: true,
    opacity: 0.42,
  });
  return glasMaterial;
}

/** Was der Katalog zu einem geladenen Teil noch weiss. */
interface KatalogZusatz {
  bau?: BauId;
  name?: string;
  zusammensetzung?: Anteil[];
  trennbar?: boolean;
  nurWerkzeug?: boolean;
}

/** Fraktionen ohne metallischen Glanz — Abfall eben. */
const NICHTMETALLE = new Set(["wood", "tires", "rubble", "plastic"]);

/**
 * Wie schnell ein Koerper werden darf, den die Maschine anstoesst (m/s).
 *
 * Die Untergrenze lag bei 1,4 m/s — und damit bekam alles ab rund 250 kg
 * dasselbe Tempo. Ein 950-kg-Auto bewegte sich wie ein 250-kg-Blech, eine
 * 1,6-t-Wanne wie beides (Befund 12.09.2026: „Koerper wie Autos folgen nicht
 * wirklich der Traegheit, wenn sie von der Spinne erwischt werden").
 * Traegheit, die man nicht unterscheiden kann, ist keine.
 *
 * Jetzt laeuft die Kurve weiter durch:
 *
 *       50 kg   150    250    500    950   1637   4000
 *   alt   3,11   1,80   1,40   1,40   1,40   1,40   1,40
 *   neu   3,11   1,80   1,39   0,98   0,71   0,54   0,35
 *
 * Die Kurve ist 22/sqrt(m) — die Geschwindigkeit, die eine feste Stossenergie
 * bei dieser Masse ergibt. Unten deckelt das Werkzeugtempo (schneller als die
 * Spinne selbst kann nichts werden), oben eine kleine Restgrenze, damit auch
 * ein Kesselwagen noch beiseitezuschieben ist.
 */
export function maxSpeedFor(massKg: number): number {
  return Math.min(WERKZEUG_MAX, Math.max(0.35, 22 / Math.sqrt(Math.max(massKg, 1))));
}

/**
 * Wie viel Tempo ein Teil in EINEM Schritt dazugewinnen darf (m/s).
 *
 * Das ist die eigentliche Bremse gegen wegspringende Teile (Befund
 * 11.09.2026). Die Spinne ist kinematisch: Klemmt ein Stueck zwischen zwei
 * Schalen, loest der Loeser die Ueberlappung mit einem einzigen, sehr grossen
 * Stoss auf — das Teil schiesst weg wie ein Kern aus der Seife. Eine
 * Hoechstgeschwindigkeit faengt das schlecht ab: Sie muesste so niedrig sein,
 * dass auch Fallen und Werfen darunter leiden (genau das war bis heute Morgen
 * der Fall).
 *
 * Eine Grenze fuer den ZUWACHS trifft dagegen nur den Stoss. Die Schwerkraft
 * gibt je Schritt 0,16 m/s dazu und bleibt unberuehrt; ein Wurf behaelt seinen
 * Schwung, weil er beim Loslassen gesetzt und nicht gewonnen wird.
 */
const MAX_ZUWACHS = 0.35;

/** Ab diesem Tempoverlust in einem Schritt gilt es als Aufprall (m/s) */
const AUFPRALL_DV = 1.1;
/** So lange meldet dasselbe Teil keinen zweiten Aufprall (s) */
const AUFPRALL_PAUSE_S = 0.18;

/**
 * Deckelung nach unten — nur als Netz gegen Rechenausreisser. Aus 5 m freiem
 * Fall kommt ein Teil auf 10 m/s; hier ist viel Luft bis dahin.
 */
export const FALL_MAX = 35;

/**
 * Achtkant-Prisma statt Zylinder (v2 E-011).
 *
 * Rapier kennt keinen Rollwiderstand. Ein mathematisch perfekter Zylinder rollt
 * deshalb endlos weiter — v2 mass 0,45 m/s noch nach 40 s, auch mit hoher
 * Daempfung. Acht Kanten stoppen das von selbst und sehen an verbeultem
 * Altmetall ohnehin richtiger aus. Das Mesh bleibt 14-seitig, nur der Kollider
 * bekommt Ecken; die Masse wird ohnehin per setMass gesetzt.
 */
function achtkant(radius: number, halbHoehe: number): RAPIER.ColliderDesc {
  const punkte: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    punkte.push(x, halbHoehe, z, x, -halbHoehe, z);
  }
  return (
    RAPIER.ColliderDesc.convexHull(new Float32Array(punkte)) ??
    RAPIER.ColliderDesc.cylinder(halbHoehe, radius)
  );
}

/**
 * Drehdaempfung. Kurze runde Teile — Felge, Coil, Reifen — trudeln sonst wie
 * eine Muenze auf dem Tisch minutenlang aus und halten ueber die gemeinsame
 * Schlafregel den ganzen Haufen wach (v2 mass 128 Koerper).
 */
/**
 * Mindestdaempfung fuer Platzinventar — GEMESSEN, nicht gewaehlt.
 *
 * Befund 15.09.2026 (E-037): Der Kehrbesen kam auf dem gebauten Platz nicht
 * zur Ruhe. Er wanderte zwar nur 5 mm in 30 Sekunden, aber er blieb WACH —
 * und ein wacher Koerper rechnet in jedem Bild mit, auch wenn sich nichts
 * bewegt (Regel: „Wird der Haufen unruhig, ist das ein Blocker").
 *
 * Die Ursache ist nicht seine Form, sondern das Zusammenspiel aus weichen
 * Kontakten (`physicsWorld.ts`: Kontaktfrequenz 30, zugelassener Fehler
 * 0,005) und der sehr niedrigen Daempfung, die `dampLin` schweren Koerpern
 * gibt (Boden 0,02). Gemessen im gebauten Platz, je 30 s:
 *
 *   100 kg  wach (v 0,226)      400 kg  wach (v 0,040)
 *   200 kg  schlaeft ab 317     500 kg  wach (v 0,077)
 *   300 kg  schlaeft ab 145     680 kg  wach (v 0,050)
 *
 * Es haengt also nicht an der Masse, sondern ist ein Grenzzyklus des Loesers —
 * mal faellt er hinein, mal nicht. Sogar der Ort entscheidet mit, weil dort
 * andere Rundungsfehler anfallen. Ueber sechs Stellen gemessen:
 *
 *   0,1 / 0,2   an vier von sechs Stellen eingeschlafen
 *   0,2 / 0,3   an allen sechs, aber traege (bis 23 s)
 *   0,4 / 0,6   an allen sechs, nach 7,7 s — GENOMMEN
 *
 * Warum nur fuer Platzinventar und nicht fuer alles: Die niedrige Daempfung
 * schwerer Teile ist Absicht („Schweres behaelt seinen Schwung") und praegt,
 * wie sich ein Motorblock anfuehlt. Ein WERKZEUG soll dagegen genau dort
 * liegenbleiben, wo der Spieler es hinlegt — dieselbe Ansage wie beim
 * Muellcontainer (E-034: „bleibt er dort stehen, wo du ihn absetzt").
 */
const INVENTAR_DAMP_LIN = 0.4;
const INVENTAR_DAMP_ANG = 0.6;

function dampAngFuer(shape: ScrapShape, massKg: number): number {
  const rund =
    shape.kind === "torus" ||
    shape.kind === "wire" ||
    (shape.kind === "cyl" && shape.dims[1] <= shape.dims[0] * 2.5);
  return rund ? Math.max(dampAng(massKg), 4.0) : dampAng(massKg);
}

/** Luft zwischen zwei Teilen beim Setzen (v2: spawnGapM). */
const SPAWN_ABSTAND = 0.06;

/**
 * Radius der Umkugel einer Form. Beim Spawn wird jedes Teil zufaellig verdreht,
 * darum ist die Kugel das richtige Mass — ein Quader ragt in der Diagonale
 * weiter als seine laengste Kante halbiert.
 */
/*
 * Der Bau-Aufschlag steht hier als Befund, nicht als Rechnung.
 *
 * Gemessen am 12.09.2026 an allen Bauarten im laufenden Spiel, als Verhaeltnis
 * der echten Umkugel zur gerechneten: Kabelrolle 1,57, Motor 1,41, Rohr 1,36,
 * Tank 1,31, Buendel 1,30, Mittelwert 1,1. Der Bau haengt Sattel, Stutzen,
 * Rahmen und Fuesse an den Grundkoerper, und die ragen heraus — die Teile im
 * Haufen stehen also dichter, als diese Rechnung annimmt.
 *
 * Eingebaut wurde der Aufschlag trotzdem nicht: Er kostet mehr, als er bringt.
 * Gemessen fanden mit Faktor 1,6 nur noch 61 von ueber 90 Teilen Platz, mit
 * 1,25 noch 78; die Lagenzahl hochzusetzen fuellt den Haufen wieder, macht ihn
 * aber so hoch, dass beim Aufloesen ein Stueck 21,9 m weit flog. Der
 * eigentliche Grund fuer eingesunkene Teile war ohnehin ein anderer — der
 * Kollider stimmte nicht mit dem Aussehen ueberein, siehe weiter unten beim
 * Bau. Wer den Haufen spaeter dichter setzen will, faengt hier an.
 */

/**
 * Radius der Umkugel einer Form. Beim Spawn wird jedes Teil zufaellig verdreht,
 * darum ist die Kugel das richtige Mass — ein Quader ragt in der Diagonale
 * weiter als seine laengste Kante halbiert.
 */
export function umkugelRadius(shape: ScrapShape): number {
  const d = shape.dims;
  if (shape.kind === "box") return Math.hypot(d[0], d[1], d[2]) / 2;
  if (shape.kind === "cyl") return Math.hypot(d[0], d[1] / 2);
  if (shape.kind === "torus") return d[0] + d[1];
  return d[0];
}

/**
 * Rauminhalt des Huellquaders einer Punktwolke.
 *
 * Damit werden die Massen mehrteiliger Kollider aufgeteilt. Das ist eine
 * Naeherung — der echte Rauminhalt einer konvexen Huelle waere genauer —, aber
 * eine ehrliche: Sie trifft die Groessenordnung und stellt sicher, dass der
 * dicke Teil auch die Masse bekommt.
 *
 * Genutzt wird sie derzeit von keinem Bau: Der Kehrbesen war bis zum
 * 15.09.2026 der einzige mit Taille und kommt seit E-037 mit einer einzigen
 * Huelle aus. Die Rechnung bleibt fuer den naechsten Gegenstand mit Hals
 * stehen und wird in `test/besen.test.ts` an einer Attrappe nachgeprueft.
 */
export function quaderRaum(punkte: Float32Array): number {
  if (punkte.length < 3) return 0;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i + 2 < punkte.length; i += 3) {
    minX = Math.min(minX, punkte[i]);
    maxX = Math.max(maxX, punkte[i]);
    minY = Math.min(minY, punkte[i + 1]);
    maxY = Math.max(maxY, punkte[i + 1]);
    minZ = Math.min(minZ, punkte[i + 2]);
    maxZ = Math.max(maxZ, punkte[i + 2]);
  }
  return Math.max(maxX - minX, 1e-4) * Math.max(maxY - minY, 1e-4) * Math.max(maxZ - minZ, 1e-4);
}

export function dampLin(massKg: number): number {
  return Math.min(0.45, Math.max(0.02, 8 / Math.max(massKg, 1)));
}
export function dampAng(massKg: number): number {
  return Math.min(0.9, Math.max(0.05, 16 / Math.max(massKg, 1)));
}

function flatColliderDesc(shape: ScrapShape): RAPIER.ColliderDesc {
  const H = 0.18;
  if (shape.kind === "box") return RAPIER.ColliderDesc.cuboid(shape.dims[0] / 2, H, shape.dims[2] / 2);
  if (shape.kind === "cyl") {
    const [r, len] = shape.dims;
    return len > r * 2.5 ? RAPIER.ColliderDesc.cuboid(r, H, len / 2) : RAPIER.ColliderDesc.cuboid(r, H, r);
  }
  if (shape.kind === "torus") {
    const r = shape.dims[0] + shape.dims[1];
    return RAPIER.ColliderDesc.cuboid(r, H, r);
  }
  return RAPIER.ColliderDesc.cuboid(shape.dims[0], H * 2, shape.dims[0]); // wire
}

/**
 * Wie sich eine Fraktion pressen laesst.
 *
 * `dichte` in kg je Kubikmeter Paket — daraus ergibt sich die Groesse bei
 * gegebener Masse. `fransen` ist die Spanne, `lang` und `dick` sind Anteile
 * der Paketkante, `beule` die Unruhe der Oberflaeche.
 */
/**
 * Was man dem Paket noch ansieht — die Reste der Ursprungsform.
 *
 * Wunsch Patrick (`docs/offene-punkte.md`, Gerätetest): „Ballen sehen zu
 * sauber aus — Fransen, **Reste der Ursprungsform**, unterschiedliche Farben."
 * Fransen und Farben waren am 12.09. gebaut worden, die Ursprungsform nicht:
 * Ein Paket war ein gebeulter Quader mit Zipfeln, und man sah ihm nicht an,
 * was hineingegangen war.
 *
 * Vier Formen reichen für alles, was der Platz kennt — ein Schrottballen
 * zeigt nie mehr als das:
 *
 *  - `blech`  ein Stück Karosserie- oder Gehäuseblech, gefaltet
 *  - `rohr`   ein Rohrstummel, achtkantig (Regel: Rundes als Achtkant)
 *  - `felge`  ein Ring — Felge, Trommel, Riemenscheibe
 *  - `profil` ein Kantstück: Winkel, Vierkantrohr, Latte
 *
 * Alles davon wandert in DIESELBE Geometrie wie Körper und Fransen und kostet
 * deshalb keinen einzigen Zeichenruf (E-025).
 */
type RestArt = "blech" | "rohr" | "felge" | "profil";

interface Pressprofil {
  dichte: number;
  fransen: [number, number];
  lang: number;
  dick: number;
  beule: number;
  rauheit: number;
  glanz: number;
  /**
   * Woran man die Fraktion im Paket wiedererkennt. Leer heisst: an nichts —
   * ein Akkupaket, ein Kabelknäuel oder ein Reifenballen hat keine Form mehr,
   * die man benennen könnte.
   */
  reste: RestArt[];
}

const PRESSPROFIL: Record<string, Pressprofil> = {
  // Stahl federt zurueck: mittlere Dichte, viele Blechfetzen, kraeftig gebeult
  steel: { dichte: 1250, fransen: [7, 13], lang: 0.45, dick: 0.05, beule: 0.11, rauheit: 0.9, glanz: 0.3, reste: ["blech", "profil", "felge"] },
  // Mischschrott ist das Unruhigste, was aus der Kammer kommt
  mixed: { dichte: 1050, fransen: [10, 17], lang: 0.55, dick: 0.06, beule: 0.15, rauheit: 0.95, glanz: 0.25, reste: ["blech", "rohr", "felge", "profil"] },
  // Edelstahl ist stur: bleibt sperrig, spreizt lange Zipfel ab
  va: { dichte: 1150, fransen: [9, 15], lang: 0.6, dick: 0.04, beule: 0.12, rauheit: 0.55, glanz: 0.7, reste: ["rohr", "blech"] },
  /*
   * Alu geht weich zusammen — aber es bleibt Alu (E-061, 15.09.2026).
   *
   * Hier stand 1450, mehr als bei Stahl (1250). Das ist physikalisch verkehrt
   * herum: Aluminium wiegt ein Drittel von Stahl (2700 gegen 7850 kg/m³). Ein
   * Alupaket von 1,8 t kam damit auf 1,24 m³ heraus — ein Wuerfel von gut
   * einem Meter Kante, der 1,8 Tonnen wiegt.
   *
   * Das ist genau Patricks Befund vom 15.09.2026: „Ganz oft sind
   * Aluminium-Sachen, die haben dann zwei Tonnen. Aber Aluminium ist ja
   * leicht, das ist ja die Eigenschaft von Aluminium. Und dann wirkt das nicht
   * sehr authentisch, wenn so ein kleines Aluminiumteil nachher 1,8 Tonnen
   * hat." Und es zerstoert den Kanal, ueber den er Alu erkennen will: „an der
   * Farbe, an der Zusammensetzung, am Gewicht".
   *
   * Der neue Wert ist abgeleitet, nicht geraten — nach derselben Rechnung wie
   * `SCHUETTDICHTE.alu` (E-033):
   *
   *     Stahlpaket 1250 × (2700 / 7850) = 430 kg/m³
   *
   * Damit presst Alu auf denselben ANTEIL seines Feststoffs wie Stahl (16 %);
   * vorher waren es 54 %, und kein anderes Metall in dieser Tabelle liegt ueber
   * 21 %. Dasselbe Paket ist jetzt 4,2 statt 1,24 m³ gross — Alu nimmt Platz
   * weg und wiegt wenig, und das sieht man ihm endlich an.
   *
   * Die Masse aendert sich dabei nicht, nur das Volumen: am Verkaufserloes und
   * am Ankauf aendert dieser Wert **null Euro**.
   */
  alu: { dichte: 430, fransen: [3, 6], lang: 0.3, dick: 0.045, beule: 0.07, rauheit: 0.5, glanz: 0.55, reste: ["felge", "profil", "blech"] },
  // Kupfer noch dichter — das schwerste Paket bei gleichem Volumen
  copper: { dichte: 1900, fransen: [3, 7], lang: 0.28, dick: 0.05, beule: 0.06, rauheit: 0.45, glanz: 0.65, reste: ["rohr"] },
  brass: { dichte: 1800, fransen: [3, 6], lang: 0.26, dick: 0.055, beule: 0.05, rauheit: 0.4, glanz: 0.7, reste: ["rohr", "profil"] },
  zinc: { dichte: 1450, fransen: [4, 8], lang: 0.34, dick: 0.035, beule: 0.09, rauheit: 0.55, glanz: 0.4, reste: ["blech"] },
  battery: { dichte: 1600, fransen: [2, 4], lang: 0.18, dick: 0.09, beule: 0.03, rauheit: 0.7, glanz: 0.1, reste: [] },
  // Kabel bleibt ein Knaeuel: locker, ueberall Schwaenze
  cable: { dichte: 800, fransen: [14, 22], lang: 0.75, dick: 0.035, beule: 0.16, rauheit: 0.95, glanz: 0.1, reste: [] },
  // Nichtmetalle pressen sich schlecht und sehen zerfetzt aus
  wood: { dichte: 620, fransen: [12, 18], lang: 0.6, dick: 0.07, beule: 0.17, rauheit: 1.0, glanz: 0, reste: ["profil"] },
  plastic: { dichte: 540, fransen: [10, 16], lang: 0.5, dick: 0.06, beule: 0.15, rauheit: 0.85, glanz: 0.05, reste: ["blech"] },
  tires: { dichte: 700, fransen: [8, 14], lang: 0.4, dick: 0.09, beule: 0.13, rauheit: 1.0, glanz: 0, reste: [] },
  rubble: { dichte: 1400, fransen: [6, 11], lang: 0.3, dick: 0.08, beule: 0.14, rauheit: 1.0, glanz: 0, reste: [] },
};

/**
 * Ein Sechstel: ab diesem Massenanteil darf eine Fraktion ein Stück von sich
 * im Paket zeigen.
 *
 * Darunter wäre das Stück eine Behauptung — bei 5 % Kupfer in einem
 * Stahlpaket sieht man kein Kupferrohr, man sieht Stahl. Bei zwei gleich
 * starken Fraktionen sind es je 50 %, bei sechs gleich starken je 16,7 %; die
 * Schwelle liegt also genau dort, wo eine Fraktion aufhört, Beimischung zu
 * sein. (SW, 15.09.2026)
 */
export const REST_SCHWELLE = 1 / 6;
/** Mehr als zwei erkennbare Stücke machen aus dem Paket ein Mobile. (SW) */
export const REST_HOECHSTENS = 2;

/**
 * Welche Fraktionen eines Pakets ein Stück ihrer Ursprungsform zeigen.
 *
 * Steht als eigene Funktion da, damit `test/ballen.test.ts` dieselbe Regel
 * prüfen kann, die gebaut wird — die Geometrie selbst braucht eine Szene und
 * ist kopflos nicht zu messen.
 *
 * @returns Fraktions-IDs, die stärkste zuerst; leer heisst „nichts zu erkennen"
 */
export function resteFuerPaket(anteile: Array<{ materialId: string; massKg: number }>): string[] {
  const echte = anteile.filter((c) => c.massKg > 0);
  const summe = echte.reduce((a, c) => a + c.massKg, 0);
  if (summe <= 0) return [];
  return echte
    .map((c) => ({ id: c.materialId, anteil: c.massKg / summe }))
    .filter(
      (f) => f.anteil >= REST_SCHWELLE && (PRESSPROFIL[f.id] ?? PRESSPROFIL.steel).reste.length > 0
    )
    .sort((a, b) => b.anteil - a.anteil)
    .slice(0, REST_HOECHSTENS)
    .map((f) => f.id);
}

/**
 * Absolute Massen (`ScrapItem.composition`, in kg) in relative Anteile
 * (`ScrapShape.zusammensetzung`, 0..1) umrechnen — die Form eines Presspakets.
 *
 * Warum zwei Schreibweisen fuer dieselbe Sache: Am TEIL stehen Kilogramm, weil
 * die Wirtschaft in Kilogramm rechnet. An der FORM stehen Anteile, weil eine
 * Form nicht weiss, wie schwer das Stueck ist, das aus ihr gebaut wird — der
 * Katalog beschreibt so einen Kuehlschrank, egal ob er 55 oder 62 kg wiegt.
 * `spawnScrap` rechnet beim Anlegen zurueck (`anteil × massKg`), und weil die
 * Masse des Pakets genau die Summe seiner Bestandteile ist, kommt dabei wieder
 * exakt dasselbe heraus.
 *
 * Null Kilo bleiben null Kilo: Platzinventar, das in der Presse verschwindet,
 * bringt auch als Teil eines Pakets kein Geld (E-079).
 */
export function zusammensetzungAus(
  composition: Array<{ materialId: string; massKg: number }> | undefined,
  vorgabe: string
): Anteil[] | undefined {
  if (!composition || composition.length === 0) return undefined;
  const summe = composition.reduce((a, c) => a + c.massKg, 0);
  // Ein Paket ganz ohne Masse — nur Platzinventar. Es behaelt seine Null.
  if (summe <= 0) return [{ materialId: vorgabe, anteil: 0 }];
  return composition
    .filter((c) => c.massKg > 0)
    .map((c) => ({ materialId: c.materialId, anteil: c.massKg / summe }));
}

/**
 * Ein Rest der Ursprungsform, roh und ungefärbt — der Aufrufer setzt Farbe,
 * Drehung und Sitz.
 *
 * `kante` ist die Würfelkante des Pakets (die dritte Wurzel seines Volumens);
 * alle Maße hängen daran, damit ein kleines Kupferpaket ein kleines Rohr
 * zeigt und ein großes Stahlpaket ein großes Blech. Die Anteile sind
 * Startwerte (SW, 15.09.2026), am Netz nachgemessen in `test/ballen.test.ts`.
 *
 * Rundes wird achtkantig gebaut — dieselbe Regel wie bei den Rollkörpern
 * (v2 E-011). Acht Segmente sind der Punkt, an dem ein Rohr als Rohr lesbar
 * wird und trotzdem nur achtzehn Eckpunkte kostet.
 */
function baueRest(art: RestArt, kante: number): THREE.BufferGeometry {
  if (art === "rohr") {
    // Rohrstummel: offener Achtkant, damit man in ihn hineinsieht
    return new THREE.CylinderGeometry(kante * 0.1, kante * 0.1, kante * 0.62, 8, 1, true);
  }
  if (art === "felge") {
    // Ring: Felge, Bremstrommel, Riemenscheibe — flach und weit
    return new THREE.CylinderGeometry(kante * 0.27, kante * 0.27, kante * 0.13, 8, 1, true);
  }
  if (art === "profil") {
    // Kantstück: Winkeleisen, Vierkantrohr, Dachlatte
    return new THREE.BoxGeometry(kante * 0.11, kante * 0.11, kante * 0.72);
  }
  /*
   * Blech: eine Platte, die einmal geknickt ist. Der Knick entsteht, indem
   * die eine Hälfte der Eckpunkte angehoben wird — ein flaches Blech sähe
   * aus wie ein Bierdeckel, und genau das soll es nicht.
   */
  const blech = new THREE.BoxGeometry(kante * 0.52, kante * 0.035, kante * 0.4, 2, 1, 1);
  const pos = blech.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    if (x > kante * 0.13) pos.setY(i, pos.getY(i) + kante * 0.14);
  }
  blech.computeVertexNormals();
  return blech;
}

/**
 * Wie stark ein Teil beim Quetschen zusammengeht. 0,18 hat die Ursprungsform
 * völlig ausgelöscht — aus allem wurde eine Platte. 0,55 verbeult das Stück
 * sichtbar, man erkennt aber noch, was es einmal war.
 */
const FLAT_SCALE_Y = 0.55;


/* ------------------------------------------------------------------------ */
/* Der Kehrbesen — Platzinventar, kein Handelsgut                            */
/* ------------------------------------------------------------------------ */

/**
 * Der Kehrbesen: eine getretene Rolle gruener Maschendraht.
 *
 * Wunsch Patrick, 15.09.2026 vormittags: „Ich bräuchte einen Maschendrahtzaun,
 * der quasi oben schon gequetscht ist und unten breit ist, der quasi wie ein
 * Besen fungiert ... Damit ich quasi mit dem Maschendrahtzaun den Boden bzw.
 * die Ladeflächen abkehren kann."
 *
 * Zwei Befunde am Geraet am selben Abend haben die Form zweimal gedreht:
 * erst vom Trichter zum Ballen (E-037: „viel zu klein ... wie ein Tee-Ei"),
 * dann vom Ballen zur Rolle (E-049): „Stell dir gruenen Maschendraht vor, der
 * unten noch aufgerollt ist, und das obere Teil ist gequetscht. Sollte auch
 * mindestens so breit sein wie die Ladeflaeche eines LKWs."
 *
 * Die Form steht in `world/objektbau.ts` (`BESEN_FORM`), hier stehen die Masse.
 *
 * Er steht mit Absicht NICHT in `SPECS`, `KATALOG_SPECS`, `BIG_SPECS` oder
 * `HUGE_SPECS`. Alles, was dort steht, kann `randomCargo` auf einen Lkw laden;
 * der Besen soll aber nie angeliefert werden (Entscheidung 15.09.2026: „Es
 * gibt genau einen Besen"). Gesetzt wird er einmal beim Neuen Spiel,
 * `ItemManager.spawnBesen()`.
 *
 * ## Woher die Zahlen kommen — jede einzeln gerechnet
 *
 * **Breite 2,70 m.** Ansage: „mindestens so breit wie die Ladeflaeche eines
 * LKWs." Die Ladeflaeche ist innen 2 x `BED_HALF_W` = **2,70 m**
 * (`delivery/routes.ts`), und genau das ist die Zahl. Sie ist damit die
 * einzige der drei Kantenlaengen, die nicht gerechnet, sondern bestellt ist.
 *
 * Bis E-049 waren es 2,40 m — bewusst schmaler, damit der Besen LAENGS
 * zwischen die Bordwaende passt. Patrick hat den Zielkonflikt selbst
 * aufgeloest: „Breite so lassen, ich kann die Spinne ja drehen, damit es
 * passt." Gekehrt wird die Ladeflaeche seitdem QUER — dann steht die Tiefe
 * (1,12 m) zwischen den Bordwaenden und nicht die Breite, und der Besen
 * schiebt mit seiner Stirnscheibe statt mit der runden Flanke. Gemessen in
 * `test/besen.test.ts`.
 *
 * **Masse 680 kg — aus der Drahtmenge, nicht gegriffen.**
 * 2,8-mm-Draht bei 50-mm-Masche ergibt rund 56,6 m Draht je Quadratmeter;
 * 2,8-mm-Stahldraht wiegt 0,048 kg/m, also **2,72 kg/m²**. Eine handelsuebliche
 * Rolle ist 1,25 m hoch und 25 m lang = 31,25 m². „Sehr viele Maschendraehte"
 * sind hier **acht Rollen** = 250 m² = **679,2 kg**, aufgerundet 680 kg.
 * Der Kunststoffmantel ist darin nicht gerechnet; er wiegt bei 2,8-mm-Draht
 * rund ein Fuenftel des Kerns und ist gegen die Rundung auf zehn Kilo klein.
 *
 * **Tiefe 1,12 m und Hoehe 0,80 m — die getretene Rolle.** Aus der Drahtmenge
 * folgt der Rauminhalt (2,04 m³, gemessen; siehe unten), aus Rauminhalt und
 * Breite die Querschnittsflaeche: 2,04 / 2,70 = **0,76 m²**. Ungetreten war
 * die Rolle rund, und ein Kreis dieser Flaeche hat **0,98 m Durchmesser** —
 * ein glaubwuerdiges Mass fuer eine Rolle Zaun, die jemand auf dem Platz
 * liegen gelassen hat. Treten aendert die Flaeche nicht, nur die Form: Sie
 * geht auf 0,80 m Hoehe zusammen und quillt dabei auf 1,12 m Tiefe
 * auseinander (Stauchung 0,71). Nachgemessen am fertigen Kollider:
 * **2,04 m³**.
 *
 * Gegenprobe zur Packung: 680 kg auf 2,04 m³ sind **333 kg/m³**. Eine stramm
 * gewickelte Rolle liegt bei rund 700 kg/m³, die dichteste flache Lage bei
 * 486 kg/m³ — die getretene Rolle ist also lockerer als beides und hat noch
 * Luft zwischen den Windungen. Genau so sieht plattgetretener Draht aus.
 *
 * **Was die Masse bedeutet.** Am Haken ist der Besen kinematisch und folgt der
 * Spinne ohne Ruecksicht auf sein Gewicht — beim Kehren spielt sie keine
 * Rolle. Sie spielt eine Rolle, wenn er losgelassen am Boden liegt (bei 680 kg
 * schiebt ihn nichts mehr weg, was auf dem Platz herumliegt) und beim
 * Traglimit der Spinne (seit E-152 nach Ausladung, `excavator/traglast.ts`,
 * bei 8 m rund 2 t — 680 kg lassen Platz fuer weitere Teile, `MAX_ITEMS` 5).
 *
 * ## Warum Mischschrott und nicht Zink oder Stahl
 *
 * Ansage Patrick zur Fraktion: „Egal, er wird nie verkauft." Das stimmt — er
 * ist Platzinventar, seine Zusammensetzung ist null Kilo, und damit rechnet
 * jede Geldformel null Euro. Die Fraktion steht nur noch an EINER Stelle: in
 * der Zeile, die der Spieler liest, wenn der Besen in der Spinne haengt.
 * Genau deshalb soll sie ehrlich sein.
 *
 * **Zink war falsch.** Der Wert stammt aus E-031, als der Besen aus blankem
 * verzinktem Draht war. Gezeichnet ist seit E-049 kunststoffummantelter
 * Gartenzaun: Stahlkern, gruener PVC-Mantel. Das dominierende Metall ist
 * Stahl, nicht Zink.
 *
 * **Stahlschrott waere nach der neuen Regel sofort wieder falsch.** Die
 * Stahlschrott-Regel (E-042, `tools/stahlschrott.ts`) verlangt zweierlei:
 * rechnerische Wandstaerke ab 6 mm UND hoechstens 10 % Fremdstoff. Gerechnet:
 *
 *   Aussenflaeche 12,16 m², 680 kg auf Stahldichte verteilt → **7,1 mm**
 *     — die Wandstaerke reisst die Schwelle also NICHT, weil das Stueck gross
 *       und schwer ist.
 *   2,8-mm-Draht mit Mantel auf 3,8 mm: 48,3 g/m Stahl gegen 7,3 g/m PVC
 *     → **13,1 % Fremdstoff** — und daran scheitert es.
 *
 * Bleibt **Mischschrott**: die Fraktion fuer alles, was nicht sortenrein ist.
 * Ein Draht mit Kunststoffmantel ist genau das — ein Verbund, den man erst
 * trennen muesste. Dieselbe Einordnung, die `urteile()` in E-042 einem
 * Verbundstueck gibt.
 *
 * Die Farbe des Modells kommt aus dem Bau und ist gruen; der Farbfleck der
 * Fraktion ist grau. Das ist kein Widerspruch, sondern derselbe Unterschied
 * wie zwischen einem lackierten Kuehlschrank und seinem Schrottwert.
 */
export const BESEN: PileSpec = {
  materialId: "mixed",
  massKg: 680,
  kind: "box",
  dims: [2.7, 0.8, 1.12],
  bau: "besen",
  name: "Maschendraht-Besen",
};

/*
 * E-191: DER BESEN IST AUS DEM SPIEL. Patrick, 21.10.2026: „Maschendraht
 * verschwindet." — gemeint ist der Maschendraht-Besen (die gruene Rolle vom
 * 15.09.) samt Maschendraht-Ballen; die Zaunfelder bleiben. Bis hierhin stand
 * er als Platzinventar in `PLATZINVENTAR` und lag damit beim Neuen Spiel und
 * an jedem Tagesanfang auf `BESEN_PLATZ`. Ohne den Eintrag kommt er nie mehr.
 *
 * ponytail: `BESEN`, `besenForm` und `spawnBesen` bleiben stehen — sie sind
 * der Pruefling, an dem `test/besen.test.ts` und `test/abfahrtswege.test.ts`
 * die Gattung Platzinventar (wertlos, gedaempft, faehrt nicht mit) messen.
 * Ganz loeschen, wenn ein anderes Inventarstueck diese Rolle uebernimmt.
 */

/** Die Form des Besens, so wie sie im Spielstand steht. */
export function besenForm(): ScrapShape {
  return {
    kind: BESEN.kind,
    dims: [...BESEN.dims],
    color: getMaterial(BESEN.materialId).color,
    bau: BESEN.bau,
    name: BESEN.name,
    inventar: "besen",
  };
}

// Basis-Sortiment (SW) — Starthaufen und Zufalls-Ladungen speisen sich hieraus
/** Die Schrottteile des Platzes. Exportiert, damit Waechter die Zuordnung von
 *  Bauform zu Teil pruefen koennen — genau dort lag der Vier-Reifen-Fehler. */
export const SPECS: PileSpec[] = [
  { materialId: "steel", massKg: 60, kind: "box", dims: [0.15, 0.15, 1.3], bau: "buendel", name: "Profilstahl" },
  { materialId: "steel", massKg: 45, kind: "cyl", dims: [0.09, 1.1], bau: "rohrFlansch", name: "Rohr" },
  /*
   * E-061: Die namenlosen Stuecke haben Namen bekommen.
   *
   * Solange die Griff-Info die Fraktion nannte, hatte ein Stueck ohne Namen
   * immer noch etwas zu lesen — "Mischschrott". Seit die Sortierklasse dort
   * nicht mehr steht (E-061), stuende bei diesen elf Eintraegen gar nichts
   * oder ein Platzhalter. Ein Name ist billiger als ein Platzhalter und sagt
   * mehr: Der Spieler sieht ein Ding und liest, was es ist.
   *
   * Die Namen beschreiben die Form, nicht die Sortierklasse — "Vierkantstahl"
   * ist ein Gegenstand, "Stahlschrott" ein Muldenschild.
   */
  { materialId: "steel", massKg: 35, kind: "box", dims: [0.12, 0.12, 0.9], name: "Vierkantstahl" },
  { materialId: "steel", massKg: 55, kind: "box", dims: [0.7, 0.06, 0.9], bau: "platte", name: "Blech" },
  { materialId: "steel", massKg: 90, kind: "box", dims: [0.7, 0.5, 0.15], bau: "platte", name: "Heizkörper (früher Guss)" },
  { materialId: "steel", massKg: 110, kind: "box", dims: [0.4, 0.4, 0.4], bau: "motor", name: "Motorblock-Rest", zusammensetzung: [{ materialId: "steel", anteil: 0.82 }, { materialId: "alu", anteil: 0.14 }, { materialId: "copper", anteil: 0.04 }] },
  { materialId: "steel", massKg: 70, kind: "box", dims: [0.18, 0.18, 1.1], name: "Stahlknüppel" },
  { materialId: "va", massKg: 26, kind: "box", dims: [0.9, 0.18, 0.6], bau: "weisseWare", name: "Spülbecken" },
  { materialId: "va", massKg: 34, kind: "cyl", dims: [0.34, 0.8], bau: "tank", name: "VA-Behälter" },
  { materialId: "va", massKg: 18, kind: "box", dims: [0.06, 0.06, 1.5], bau: "buendel", name: "VA-Geländerrohr" },
  { materialId: "alu", massKg: 12, kind: "cyl", dims: [0.32, 0.22], name: "Felge" },
  { materialId: "alu", massKg: 8, kind: "box", dims: [0.08, 0.08, 1.4], name: "Profil" },
  { materialId: "alu", massKg: 10, kind: "box", dims: [0.6, 0.04, 0.8], bau: "platte", name: "Tafel" },
  { materialId: "alu", massKg: 11, kind: "cyl", dims: [0.3, 0.2], name: "Alu-Ronde" },
  { materialId: "copper", massKg: 12, kind: "cyl", dims: [0.05, 0.8], bau: "buendel", name: "Kupferrohr" },
  { materialId: "copper", massKg: 18, kind: "torus", dims: [0.14, 0.05], name: "Kupferbund" },
  // E-063: war `maschine` — mit Bedienpult und Lackverkleidung. Eine Armatur
  // ist ein Ventilkoerper mit Flanschen und Handrad, und zwar in Messing.
  { materialId: "brass", massKg: 15, kind: "box", dims: [0.3, 0.25, 0.3], bau: "armatur", name: "Messingarmaturen" },
  { materialId: "cable", massKg: 9, kind: "torus", dims: [0.18, 0.07], name: "Kabelring" },
  { materialId: "cable", massKg: 7, kind: "torus", dims: [0.15, 0.06], name: "Kabelrest" },
  { materialId: "cable", massKg: 12, kind: "torus", dims: [0.2, 0.08], name: "Kabelrolle" },
  { materialId: "wood", massKg: 14, kind: "box", dims: [0.12, 0.12, 1.2], name: "Kantholz" },
  { materialId: "plastic", massKg: 8, kind: "box", dims: [0.5, 0.05, 0.9], name: "Kunststoffplatte" },
  // E-191: Der Maschendraht-Ballen (Stahl, 22 kg, „Kehrbesen" vom 27.08.)
  // ist raus — Patrick, 21.10.2026: „Maschendraht verschwindet."

  // Was auf einem Schrottplatz sonst noch liegt (Wunsch 10.09.2026). Vorher
  // war das Sortiment sehr nach Baustelle: Profile, Rohre, Bleche. Ein Platz
  // lebt aber von dem, was die Leute anschleppen — Hausrat, Zweiraeder,
  // Landmaschinen, ausgeschlachtete Fahrzeugteile.
  { materialId: "steel", massKg: 42, kind: "box", dims: [0.55, 0.85, 0.55], bau: "weisseWare", name: "Waschmaschine", zusammensetzung: [{ materialId: "steel", anteil: 0.62 }, { materialId: "rubble", anteil: 0.18 }, { materialId: "copper", anteil: 0.08 }, { materialId: "plastic", anteil: 0.12 }] },
  { materialId: "steel", massKg: 38, kind: "box", dims: [0.6, 0.85, 0.6], bau: "weisseWare", name: "Spuelmaschine", zusammensetzung: [{ materialId: "steel", anteil: 0.6 }, { materialId: "plastic", anteil: 0.28 }, { materialId: "copper", anteil: 0.06 }, { materialId: "alu", anteil: 0.06 }] },
  { materialId: "steel", massKg: 30, kind: "box", dims: [0.65, 0.9, 0.6], bau: "weisseWare", name: "Elektroherd" },
  { materialId: "steel", massKg: 52, kind: "cyl", dims: [0.28, 1.4], bau: "tank", name: "Warmwasserspeicher" },
  { materialId: "steel", massKg: 48, kind: "box", dims: [1.6, 0.55, 0.7], name: "Badewanne" },
  { materialId: "steel", massKg: 26, kind: "box", dims: [0.6, 0.9, 1.9], bau: "einspurig", name: "Motorradrahmen" },
  { materialId: "steel", massKg: 14, kind: "box", dims: [0.5, 0.7, 1.6], bau: "einspurig", name: "Mopedrahmen" },
  { materialId: "steel", massKg: 120, kind: "box", dims: [1.1, 0.35, 0.9], bau: "schaufel", name: "Pflugschar", massiv: true }, // E-042: die Schar ist gehaertetes Verschleissblech, gerechnet nur 4,5 mm
  { materialId: "steel", massKg: 85, kind: "cyl", dims: [0.34, 1.7], bau: "trommel", name: "Eggenwalze" },
  // E-063: war `motor` — ein Frontgewicht hat weder Zylinderkopf noch Kruemmer.
  { materialId: "steel", massKg: 160, kind: "box", dims: [0.5, 0.5, 1.4], bau: "klotz", name: "Traktor-Frontgewicht" },
  { materialId: "steel", massKg: 95, kind: "box", dims: [2.1, 0.25, 0.35], bau: "ausleger", name: "Heuwender-Ausleger" },
  { materialId: "steel", massKg: 210, kind: "cyl", dims: [0.16, 2.2], bau: "achse", name: "LKW-Achse" },
  // E-063: Getriebe ist kein Motor (kein Zylinderkopf, keine Kruemmer); der
  // Kuehler ist ein Lamellenblock und damit naeher an `platte` als an einer
  // Maschine mit Bedienpult.
  { materialId: "steel", massKg: 130, kind: "box", dims: [0.8, 0.7, 0.9], bau: "maschine", name: "LKW-Getriebe" },
  { materialId: "steel", massKg: 75, kind: "box", dims: [0.9, 0.75, 0.12], bau: "platte", name: "LKW-Kuehler" },
  { materialId: "steel", massKg: 46, kind: "cyl", dims: [0.28, 0.32], name: "LKW-Felge", massiv: true }, // E-042, Patrick 15.09.2026: "LKW-Felge, sind gehaerteter Stahl und daher auf massiv setzen."
  { materialId: "alu", massKg: 16, kind: "box", dims: [0.7, 0.5, 0.15], bau: "motor", name: "Motorradmotor" },
  { materialId: "copper", massKg: 22, kind: "box", dims: [0.45, 0.4, 0.35], bau: "elektromotor", name: "Elektromotor", trennbar: true, zusammensetzung: [{ materialId: "steel", anteil: 0.58 }, { materialId: "copper", anteil: 0.38 }, { materialId: "alu", anteil: 0.04 }] },
  // E-181 (Patrick 20.10.2026: „Reifen haben immer felge"): war „Traktorreifen", 11 kg
  // ohne Felge. Traktor-Vorderrad 7.50-16: Aussen-Ø 0,80 m, Breite 0,20 m; Reifen
  // rund 25 kg + Felge 5.50x16 12 kg = 37 kg (SW).
  { materialId: "tires", massKg: 37, kind: "torus", dims: [0.3, 0.1], name: "Traktor-Vorderrad", trennbar: true, nurWerkzeug: true, zusammensetzung: [{ materialId: "tires", anteil: 0.68 }, { materialId: "steel", anteil: 0.32 }] },

  // Erweiterung 12.09.2026 — siehe world/objektkatalog.ts
  ...KATALOG_SPECS,
];

/**
 * Großteile für Händler-Anlieferungen (Design-Wunsch 2026-08-29): sperrig und
 * schwer — genau das Material, für das sich Schere und Presse lohnen.
 */
/**
 * Schwergewichte, die einen ganzen Auflieger füllen: Tanks, Fahrzeugteile,
 * Zug- und Flugzeugbauteile. Sie sind absichtlich sperrig — so ein Stück
 * einzufädeln ist die eigentliche Aufgabe am Bagger (Wunsch 29.08.2026).
 */
export const HUGE_SPECS: PileSpec[] = [
  { materialId: "steel", massKg: 2400, kind: "box", dims: [2.4, 1.1, 1.9], bau: "achse", name: "Waggon-Drehgestell" },
  { materialId: "steel", massKg: 2200, kind: "box", dims: [3.2, 0.9, 0.8], bau: "fahrgestell", name: "Kettenlaufwerk" },
  { materialId: "steel", massKg: 1800, kind: "cyl", dims: [1.1, 3.6], bau: "tank", name: "Kesselwagen-Segment" },
  { materialId: "steel", massKg: 1400, kind: "cyl", dims: [1.2, 3.1], bau: "tank", name: "Lagertank" },
  { materialId: "steel", massKg: 1100, kind: "cyl", dims: [0.9, 2.0], bau: "tank", name: "Turbinengehäuse" },
  { materialId: "steel", massKg: 900, kind: "box", dims: [2.2, 1.9, 1.8], bau: "karosserie", name: "LKW-Fahrerhaus" },
  // E-063: ein Rahmen ist ein Traegerwerk, kein Motorblock.
  { materialId: "steel", massKg: 1600, kind: "box", dims: [2.8, 1.2, 1.1], bau: "traeger", name: "Pressenrahmen" },
  { materialId: "va", massKg: 950, kind: "cyl", dims: [1.0, 2.8], bau: "tank", name: "VA-Prozesstank" },
  { materialId: "va", massKg: 700, kind: "box", dims: [2.6, 0.9, 1.2], bau: "tank", name: "VA-Behälter" },
  { materialId: "alu", massKg: 700, kind: "box", dims: [3.5, 0.35, 1.6], bau: "platte", name: "Tragflächenstück" },
  { materialId: "alu", massKg: 800, kind: "cyl", dims: [1.3, 3.0], bau: "rohrFlansch", name: "Rumpfsegment" },
  { materialId: "alu", massKg: 550, kind: "box", dims: [2.9, 1.1, 0.9], bau: "container", name: "Aufbau/Kofferaufbau" },

  // Erweiterung 12.09.2026 — siehe world/objektkatalog.ts
  ...KATALOG_HUGE,
];

export const BIG_SPECS: PileSpec[] = [
  { materialId: "steel", massKg: 180, kind: "box", dims: [0.28, 0.28, 2.9], bau: "traeger", name: "Doppel-T-Träger" },
  { materialId: "steel", massKg: 220, kind: "box", dims: [1.9, 0.08, 1.5], bau: "platte", name: "Blechtafel" },
  { materialId: "steel", massKg: 160, kind: "cyl", dims: [0.22, 2.6], bau: "rohrFlansch", name: "dickes Rohr", massiv: true }, // E-042: die Wand eines 440-mm-Rohres ist 8-12 mm, gerechnet nur 5,2 mm
  { materialId: "steel", massKg: 140, kind: "box", dims: [1.2, 0.9, 0.75], bau: "tank", name: "Kessel" },
  { materialId: "steel", massKg: 95, kind: "box", dims: [0.75, 1.5, 0.7], bau: "weisseWare", name: "Waschmaschine", zusammensetzung: [{ materialId: "steel", anteil: 0.62 }, { materialId: "rubble", anteil: 0.18 }, { materialId: "copper", anteil: 0.08 }, { materialId: "plastic", anteil: 0.12 }] },
  // E-063: ein „Block" ist ein Klotz, kein Verbrennungsmotor.
  { materialId: "steel", massKg: 420, kind: "box", dims: [0.9, 0.7, 0.95], bau: "klotz", name: "Maschinenblock" },
  { materialId: "steel", massKg: 300, kind: "cyl", dims: [0.6, 0.9], bau: "trommel", name: "Schwungrad" },
  /*
   * E-063: Dieser Eintrag ist unveraendert — und genau das ist die Aenderung.
   *
   * 1,50 x 1,10 x 0,80 m erfuellte die alte Polsterbedingung von `moebel`
   * (`h < w*0,75 && d > h*0,7`) auf zwei Zentimeter genau, und ein Stahlschrank
   * stand als Sofa auf dem Platz. `moebel` hat den Zweig nicht mehr; der
   * Schrank ist jetzt ein Korpus mit Tuerfronten, ohne dass hier etwas
   * umgestellt werden musste.
   */
  { materialId: "steel", massKg: 260, kind: "box", dims: [1.5, 1.1, 0.8], bau: "moebel", name: "Stahlschrank" },
  { materialId: "steel", massKg: 195, kind: "box", dims: [2.4, 0.9, 0.12], bau: "platte", name: "Stahltür/Tor" },
  { materialId: "steel", massKg: 240, kind: "cyl", dims: [0.75, 1.9], bau: "tank", name: "Öltank/Boiler" },
  { materialId: "steel", massKg: 150, kind: "wire", dims: [1.15], bau: "haufen", name: "Drahtballen" },
  { materialId: "va", massKg: 210, kind: "cyl", dims: [0.7, 1.8], bau: "tank", name: "VA-Tank" },
  { materialId: "va", massKg: 130, kind: "box", dims: [1.8, 0.1, 1.1], bau: "platte", name: "VA-Tafel" },
  /*
   * E-061: war `bau: "moebel"` — und stand damit als POLSTERSOFA auf dem Platz.
   *
   * `moebel` waehlt seinen Zweig nach den Massen (objektbau.ts): flach und
   * tief genug (`h < w*0,75 && d > h*0,7`) heisst Polster, sonst Korpus.
   * 1,20 x 0,85 x 0,70 m erfuellt beides — der Spueltisch wurde in Stoff
   * bezogen. Zusammen mit der duennen VA-Auswahl (zehn erreichbare Eintraege)
   * war er in einer sortenreinen VA-Fuhre das HAEUFIGSTE Stueck, gemessen
   * 12,7 % von 3000 Zuegen: eine Couch, zu der die Waage "sortenrein
   * Edelstahl" sagte (Patricks Befund 15.09.2026).
   *
   * `weisseWare` ist der Bau, den die drei anderen VA-Geraete schon tragen
   * (Spuelbecken, Dunstabzugshaube, Krankenhaus-Sterilisator): Korpus mit
   * Tuerfront und dunklem Sockel. Kein neuer Bau, keine geaenderten Masse —
   * Fraktion, Pressbarkeit und Packmass bleiben, wie sie waren.
   */
  { materialId: "va", massKg: 95, kind: "box", dims: [1.2, 0.85, 0.7], bau: "weisseWare", name: "Gastro-Spültisch" },
  { materialId: "va", massKg: 70, kind: "box", dims: [0.14, 0.14, 2.6], bau: "buendel", name: "VA-Rohrbündel" },
  { materialId: "alu", massKg: 60, kind: "box", dims: [0.3, 0.3, 2.8], bau: "buendel", name: "Profilbündel" },
  { materialId: "alu", massKg: 45, kind: "box", dims: [1.6, 0.06, 1.2], bau: "platte", name: "Alutafel" },
  { materialId: "alu", massKg: 85, kind: "box", dims: [1.4, 1.2, 0.25], bau: "fensterflaeche", name: "Alu-Fensterrahmen" },
  { materialId: "alu", massKg: 110, kind: "cyl", dims: [0.55, 1.4], bau: "tank", name: "Alu-Kessel" },
  { materialId: "copper", massKg: 65, kind: "cyl", dims: [0.35, 1.2], bau: "tank", name: "Kupfer-Boiler" },
  { materialId: "copper", massKg: 48, kind: "torus", dims: [0.45, 0.16], bau: "buendel", name: "Kupferrohr-Bund" },
  { materialId: "cable", massKg: 55, kind: "torus", dims: [0.55, 0.22], name: "Kabelbund" },
  { materialId: "cable", massKg: 120, kind: "cyl", dims: [0.85, 0.9], bau: "trommel", name: "Kabeltrommel", trennbar: true, zusammensetzung: [{ materialId: "cable", anteil: 0.62 }, { materialId: "wood", anteil: 0.38 }] },
  // E-063: stand als Polstersofa da (1,40 x 0,50 x 0,90 erfuellte den alten
  // Massenzweig). Eine Kiste ist Bretterwand mit Eckleisten — eigener Bau.
  { materialId: "wood", massKg: 90, kind: "box", dims: [1.4, 0.5, 0.9], bau: "kiste", name: "Holzkiste" },
  { materialId: "rubble", massKg: 130, kind: "box", dims: [1.1, 1.1, 1.1], bau: "beton", name: "Betonblock" },

  // Erweiterung 12.09.2026 — siehe world/objektkatalog.ts
  ...KATALOG_BIG,
];

/*
 * Auch die drei urspruenglichen Listen bekommen ihre Fraktion aus der
 * Zusammensetzung. Sonst stuende die Kabeltrommel als "cable" im Katalog und
 * waere zugleich Mischschrott — die Ableitung lief zuerst nur ueber den neuen
 * Katalog (Befund 12.09.2026).
 */
for (const liste of [SPECS, BIG_SPECS, HUGE_SPECS]) {
  for (const sp of liste) sp.materialId = fraktionVonTeil(sp);
}

const CABLE_COLORS = [0xb0682a, 0x71646a, 0x315e75];

function colorFor(spec: PileSpec, seed: number): number {
  return spec.materialId === "cable"
    ? CABLE_COLORS[seed % CABLE_COLORS.length]
    : getMaterial(spec.materialId).color;
}

/**
 * Das letzte Fuenftel des Fraktionsmix, als Lostopf.
 *
 * Bis zum 16.09.2026 stand hier eine Liste aus neun Namen, aus der gleich
 * verteilt gezogen wurde — sechs Metalle und DREI Abfallsorten. Die vierte,
 * `tires`, fehlte: Reifen waren eine Fraktion mit Namen, Farbe, Preis und
 * eigener Mulde, die **nie angeliefert werden konnte**. Sie kamen nur als
 * Bestandteil von Fahrzeugen und aus dem Wrack.
 *
 * Der Topf haelt die Anteile der neun Lose EXAKT fest, obwohl jetzt zehn
 * Fraktionen darin sind. Jedes Metall bekommt VIER Lose, jede Abfallsorte
 * DREI: 6 x 4 = 24 gegen 4 x 3 = 12, zusammen 36. Das sind zwei Drittel Metall
 * und ein Drittel Abfall — genau das Verhaeltnis 6:3 von vorher. Ein Metall
 * zieht 4/36 = 11,11 % des Topfes wie vorher 1/9, und die vier Abfallsorten
 * teilen sich die drei Lose, die vorher drei von ihnen hatten.
 *
 * Warum das wichtig ist: Abfall KOSTET Geld (negativer Preis). Waere `tires`
 * einfach als zehnter Name dazugekommen, waere der Abfallanteil einer
 * Anlieferung von 6,67 % auf 8,0 % gestiegen und damit der Verdienst gesunken —
 * eine Wirtschaftsaenderung, die niemand bestellt hat (E-067 hat genau deshalb
 * die Finger davon gelassen). `test/abfall.test.ts` misst den Anteil.
 */
/*
 * E-181 (20.10.2026): Reifen gibt es nur noch als Rad mit Felge. E-181 hatte
 * die Raeder zu Mischschrott gemacht und die Reifen-Lose verteilt; E-186
 * (Patrick 20.10.2026: „Rad zählt als Reifen", `purity.istRad`) macht sie
 * wieder zu Reifen — damit gilt der Topf wieder wie seit dem 16.09.: vier
 * Abfallsorten mit je drei Losen, 12 von 36.
 */
const REST_LOSE: string[] = [
  ...["va", "copper", "brass", "zinc", "battery", "cable"].flatMap((f) => [f, f, f, f]),
  ...ABFALLFRAKTIONEN.flatMap((f) => [f, f, f]),
];

/**
 * Wie sich eine gemischte Ladung auf die Sorten verteilt — Starthaufen,
 * Streuschrott, Privatleute und gemischte Haendlerfuhren ziehen hieraus.
 *
 * E-181, Patrick 20.10.2026: „Auch fehlt es an der balance zwischen misch und
 * stahlschrott. Mischschrott ist häufiger." Bis dahin 42 % Stahl gegen 22 %
 * Misch — gemessen kam Stahlschrott im Starthaufen 2,5-mal so oft wie
 * Mischschrott (`tools/sortenanteile.ts`).
 *
 * SW, nach dem Bild des echten Altschrotthandels: Was gesammelt ankommt, ist
 * zum groessten Teil Misch- und Sammelschrott (Blech, Geraete, Verbund);
 * sauberer schwerer Stahlschrott ist das Seltenere und das Teurere (E-042:
 * „das ist halt so das Premium"). Branchenbild, keine nachgeschlagene Zahl.
 *
 *   Misch 50 % · Stahl 22 % · Alu 8 % · Rest 20 % (`REST_LOSE`)
 *
 * Der Rest bleibt bei 20 %: Buntmetall, Kabel, Akkus und Abfall kommen so oft
 * wie vorher (`test/abfall.test.ts`). Alu gibt die Haelfte ab (16 -> 8 %),
 * weil Alu im Sammelschrott ebenfalls ein Nebenbestandteil ist und der Abstand
 * Misch : Stahl sonst nur aus dem Stahl kaeme.
 */
export const FRAKTIONSMIX = { mixed: 0.5, steel: 0.22, alu: 0.08 } as const;

/**
 * Zufalls-Ladung für Anlieferungen.
 * @param bigShare 0..1 — Anteil Großteile (Händler liefern überwiegend groß)
 */
export function randomCargo(
  count: number,
  bigShare = 0,
  /** Anteil Schwergewichte (Tanks, Zug-/Flugzeugteile) an der Ladung */
  hugeShare = 0,
  /**
   * Sortenrein: Händler liefern ihre Ware oft schon getrennt an. Ist eine
   * Fraktion gesetzt, besteht die ganze Ladung daraus.
   */
  onlyMaterial?: string
): Array<{ materialId: string; massKg: number; shape: ScrapShape }> {
  const out = [];
  for (let i = 0; i < count; i++) {
    const pool =
      Math.random() < hugeShare
        ? HUGE_SPECS
        : Math.random() < bigShare
          ? BIG_SPECS
          : SPECS;
    /*
     * Fraktionsmix der Anlieferungen.
     *
     * "mixed" musste dazu (Befund 12.09.2026): Seit ein Objekt aus
     * Verbundteilen als Mischschrott gilt — Kuehlschrank, Karosserie, Kabine,
     * Wohnwagen —, haengen daran neunundvierzig Eintraege. Ohne die Fraktion
     * in dieser Liste wurde keiner davon je gezogen, und sie waren mit einem
     * Schlag aus dem Spiel.
     *
     * Die Anteile stehen in `FRAKTIONSMIX` (E-181: Misch vor Stahl), der
     * Rest verteilt sich ueber `REST_LOSE` (siehe dort, gerechnet).
     */
    const r = Math.random();
    const m = FRAKTIONSMIX;
    const wanted =
      onlyMaterial ??
      (r < m.mixed
        ? "mixed"
        : r < m.mixed + m.steel
          ? "steel"
          : r < m.mixed + m.steel + m.alu
            ? "alu"
            : REST_LOSE[Math.floor(Math.random() * REST_LOSE.length)]);
    let matching = pool.filter((s) => s.materialId === wanted);
    // Sortenreine Ladung: notfalls in der anderen Größenklasse suchen, damit
    // die Fraktion auf jeden Fall stimmt
    if (onlyMaterial && matching.length === 0) {
      matching = [...SPECS, ...BIG_SPECS].filter((s) => s.materialId === wanted);
    }
    const spec =
      matching.length > 0
        ? matching[Math.floor(Math.random() * matching.length)]
        : pool[Math.floor(Math.random() * pool.length)];
    out.push({
      materialId: spec.materialId,
      massKg: spec.massKg,
      shape: {
        kind: spec.kind,
        dims: spec.dims,
        color: colorFor(spec, i),
        bau: spec.bau,
        name: spec.name,
        zusammensetzung: spec.zusammensetzung,
        massiv: spec.massiv,
        trennbar: spec.trennbar,
        nurWerkzeug: spec.nurWerkzeug,
      },
    });
  }
  return out;
}

export interface ScrapItem {
  id: string;
  materialId: string;
  massKg: number;
  mesh: THREE.Object3D;
  body: RAPIER.RigidBody;
  /** aktuell zugeordneter Container (per Zonen-Zählung), null = lose */
  containerId: string | null;
  /** Form für Save/Load — Objekte ohne shape (Karossen) sichert das Composite-System */
  shape?: ScrapShape;
  /**
   * Nur bei Presspaketen: woraus das Paket besteht. Ein Mischpaket bleibt
   * damit auch nach dem Pressen als Mischung erkennbar und bringt beim
   * Verkauf weniger als ein sortenrein gepresstes.
   */
  composition?: Array<{ materialId: string; massKg: number }>;
  /**
   * Nur bei Presspaketen: welche FRAKTIONEN hineingegangen sind, in Kilogramm.
   *
   * Der Unterschied zu `composition` ist derselbe, den E-091 an der Presse
   * schon benannt hat: „woraus ist das gemacht" gegen „wohin gehoert das".
   * Ein Paket aus fuenf Kuehlschraenken BESTEHT aus Blech, Alu, Kupfer und
   * Kunststoff (`composition` — daraus kommen die Farbflecken); es ist aber
   * 275 kg MISCHSCHROTT (`fraktionsmix` — danach zahlt die Kasse).
   *
   * Warum das Paket beides braucht: Seit E-094 rechnet die Kasse in
   * Fraktionen. Ein Paket ist aber kein Stueck mit einer Fraktion, sondern
   * ein Buendel — 64 kg Kupfer und 217 kg Messing gehoeren in dieselbe Mulde
   * und sind zusammen 1393,90 € wert, waehrend das Paket als Ganzes
   * „Mischschrott" heisst (keine Fraktion hat 95 %). Ohne dieses Feld kaeme es
   * auf 44,96 € — Pressen wuerde Sortierarbeit vernichten, genau das, was
   * E-091 abgestellt hat.
   */
  fraktionsmix?: Array<{ materialId: string; massKg: number }>;
}

/**
 * Schwellen der Schlafhilfe. Rapiers eigene Werte (0,4 m/s) sind nicht
 * einstellbar und greifen erst, wenn eine ganze Kontakt-Insel ruht — bei einem
 * Haufen ist das nie der Fall, weil immer irgendwo ein Teil zittert.
 */
/**
 * Die Werte aus v2 (0,06 / 0,12) passen dort zu weichen Kontakten (6 Iterationen,
 * Frequenz 30). Der Prototyp rechnet bewusst haerter (12 Iterationen, Frequenz 40,
 * zugelassener Fehler 0,001), damit Teile nicht ineinander einsinken — das
 * erzeugt aber ein Grundrauschen: gemessen bleiben einzelne Teile dauerhaft bei
 * rund 0,007 m/s und 0,25 rad/s stehen, ohne sich wirklich zu bewegen. Die
 * Schwellen liegen darum ueber diesem Rauschen und nicht darunter.
 */
const SCHLAF_LIN = 0.09; // m/s
const SCHLAF_ANG = 0.45; // rad/s
/** So oft hintereinander muss alles unter den Schwellen liegen (à 0,25 s). */
const SCHLAF_PRUEFUNGEN = 4;
/**
 * Anteil der Teile, der still liegen muss, damit der Stapel schlafen geht.
 * Gemessen: bei Einstimmigkeit schlief je nach Haufen gar nichts, weil immer
 * genau ein (wechselndes) Teil zuckte.
 */
const SCHLAF_MEHRHEIT = 0.92;
/**
 * Darueber ist es echte Bewegung — etwas faellt, rollt oder wird getragen.
 * Ein einziges solches Teil haelt den ganzen Haufen wach, und das ist richtig so.
 */
const BEWEGUNG_LIN = 0.5; // m/s
const BEWEGUNG_ANG = 2.5; // rad/s
const SCHLAF_TAKT_S = 0.25;
/** Teile so nah an der Spinne bleiben wach (v2 E-041: schlafend durch den Boden gesackt). */
const SCHLAF_ABSTAND_SPINNE = 3.0;

/**
 * Bauarten, deren Geometrie NaN-Punkte enthaelt — fuer die Diagnose.
 *
 * Sie sind ein echter Fehler im Bau, kein Sonderfall: Ein Netz mit NaN hat
 * keine Ausdehnung, wirft keinen Schatten richtig und liesse sich nicht
 * picken. Solange die Liste nicht leer ist, gibt es etwas zu reparieren.
 */
export const unsaubereBauten = new Set<string>();

export class ItemManager {
  readonly items: ScrapItem[] = [];
  private byHandle = new Map<number, ScrapItem>();
  private highlighted: ScrapItem | null = null;
  private nextId = 0;
  private schlafUhr = 0;
  private schlafZaehler = 0;
  /** Lage bei der vorigen Schlafprüfung (Griff → Ort und Drehung), für die gemittelte Bewegung. */
  private schlafLage = new Map<number, { x: number; y: number; z: number; qx: number; qy: number; qz: number; qw: number }>();

  constructor(
    private scene: THREE.Scene,
    private world: RAPIER.World
  ) {}

  register(params: {
    materialId: string;
    massKg: number;
    mesh: THREE.Object3D;
    body: RAPIER.RigidBody;
    shape?: ScrapShape;
    composition?: Array<{ materialId: string; massKg: number }>;
    fraktionsmix?: Array<{ materialId: string; massKg: number }>;
  }): ScrapItem {
    const item: ScrapItem = {
      id: `item_${this.nextId++}`,
      materialId: params.materialId,
      massKg: params.massKg,
      mesh: params.mesh,
      body: params.body,
      containerId: null,
      shape: params.shape,
      composition: params.composition,
      fraktionsmix: params.fraktionsmix,
    };
    this.items.push(item);
    this.byHandle.set(params.body.handle, item);
    return item;
  }

  /**
   * Schlafhilfe (v2 E-012): legt lose Körper **nur gemeinsam** schlafen.
   *
   * Einzeln schlafen zu legen klingt naheliegend, zerstört aber den Haufen: Ein
   * Körper unter Last, den man allein stilllegt, verliert den Kontakt zum Boden
   * und sinkt durch den Platz. Deshalb die Alles-oder-nichts-Regel — erst wenn
   * jedes lose Teil drei Prüfungen lang unter den Schwellen liegt, schlafen alle
   * zusammen ein. Danach weckt sie jede Berührung von selbst wieder.
   *
   * `spinnePos` schützt die Umgebung des Greifers: Teile dort bleiben wach,
   * sonst sackt ein „schlafendes" Teil unter der arbeitenden Spinne weg.
   */
  settleSleep(dt: number, spinnePos?: { x: number; y: number; z: number }): void {
    this.schlafUhr += dt;
    if (this.schlafUhr < SCHLAF_TAKT_S) return;
    this.schlafUhr = 0;

    const kandidaten: RAPIER.RigidBody[] = [];
    let still = 0;
    for (const item of this.items) {
      const b = item.body;
      if (!b.isValid()) continue; // entfernter Koerper: `isDynamic` wuerde abstuerzen
      if (!b.isDynamic()) continue; // auf der Mulde mitgefuehrte Teile sind kinematisch
      if (spinnePos) {
        const t = b.translation();
        const d = Math.hypot(t.x - spinnePos.x, t.y - spinnePos.y, t.z - spinnePos.z);
        // Teile am Greifer bleiben aussen vor — sie schlafen nicht mit ein, und
        // ihre Bewegung darf den Rest des Haufens nicht wachhalten. Sonst
        // schliefe nie etwas, weil die Spinne fast immer ueber dem Haufen steht.
        if (d < SCHLAF_ABSTAND_SPINNE) continue;
      }
      if (b.isSleeping()) continue;
      const v = b.linvel();
      const w = b.angvel();
      const lin = Math.hypot(v.x, v.y, v.z);
      const ang = Math.hypot(w.x, w.y, w.z);

      // Echte Bewegung: etwas faellt, rollt oder wird getragen. Dann schlaeft
      // niemand — der Haufen ist in Arbeit.
      if (lin > BEWEGUNG_LIN || ang > BEWEGUNG_ANG) {
        this.schlafZaehler = 0;
        return;
      }
      kandidaten.push(b);
      /*
       * Still ist, wer sich über den Prüftakt nicht vom Fleck bewegt — nicht
       * nur, wessen Augenblicks-Tempo klein ist. Ein leichtes Teil auf einem
       * schweren zittert im Kontakt (gemessen Freitag Saat 5: Kabelring 18 kg
       * auf Kabelbund, 0,3 m/s nach unten bei gleicher Höhe, 80 s lang); es
       * zählte nie als still, und ein Grüppchen von elf hielt sich gegenseitig
       * wach. Gemittelt aus dem Weg seit der letzten Prüfung ist es still.
       */
      const t = b.translation();
      const q = b.rotation();
      const vorher = this.schlafLage.get(b.handle);
      this.schlafLage.set(b.handle, { x: t.x, y: t.y, z: t.z, qx: q.x, qy: q.y, qz: q.z, qw: q.w });
      let linMittel = lin;
      let angMittel = ang;
      if (vorher) {
        linMittel = Math.hypot(t.x - vorher.x, t.y - vorher.y, t.z - vorher.z) / SCHLAF_TAKT_S;
        const dot = Math.min(1, Math.abs(q.x * vorher.qx + q.y * vorher.qy + q.z * vorher.qz + q.w * vorher.qw));
        angMittel = (2 * Math.acos(dot)) / SCHLAF_TAKT_S;
      }
      if (Math.min(lin, linMittel) <= SCHLAF_LIN && Math.min(ang, angMittel) <= SCHLAF_ANG) still++;
    }

    if (kandidaten.length === 0) return;
    // Mehrheitsregel statt Einstimmigkeit: Gemessen ist bei jeder Pruefung genau
    // ein Teil ueber der Schwelle — aber jedes Mal ein anderes. Die Restenergie
    // wandert durch den Stapel, also wird nie alles gleichzeitig still, und mit
    // Einstimmigkeit schlief je nach Haufen gar nichts (bis 98 von 113 wach).
    // E-012 verbietet, ein *einzelnes* Teil unter Last schlafen zu legen; hier
    // geht der ganze Stapel gemeinsam schlafen, die Zucker eingeschlossen.
    if (still / kandidaten.length < SCHLAF_MEHRHEIT) {
      this.schlafZaehler = 0;
      return;
    }
    if (++this.schlafZaehler < SCHLAF_PRUEFUNGEN) return;
    this.schlafZaehler = 0;
    for (const b of kandidaten) {
      // Restgeschwindigkeit vorher wegnehmen, sonst traegt ein Zucker seinen
      // Schwung mit in den Schlaf und stoesst beim Aufwachen den Nachbarn an.
      b.setLinvel({ x: 0, y: 0, z: 0 }, false);
      b.setAngvel({ x: 0, y: 0, z: 0 }, false);
      b.sleep();
    }
  }

  /**
   * Vorsimulation: den Haufen sich setzen lassen, bevor das erste Bild steht.
   * Ohne das beginnt jede Partie mit einem zappelnden Berg, und der Spieler
   * sieht die Teile erst zurechtrutschen (v2: `Simulation.settle()`).
   */
  /**
   * Den Platz setzen lassen, bevor das erste Bild kommt.
   *
   * Der erste Durchgang allein genuegte nicht. Gemessen am 12.09.2026 hing
   * nach dem Setzen ein 75-kg-Stueck in **7,01 m Hoehe** und fiel 6,66 m,
   * sobald es geweckt wurde. Der Grund steckt in der gemeinsamen Schlafregel:
   * Wird eine Gruppe als ruhig eingestuft, schlaeft auch ein Stueck ein, das
   * noch faellt — und wer in der Luft einschlaeft, bleibt in der Luft, bis
   * ihn zufaellig etwas weckt. Im Spiel sah das aus, als fiele Schrott vom
   * Himmel.
   *
   * Darum wird nach dem Setzen noch einmal alles geweckt und weitergerechnet,
   * bis nichts mehr faellt. Wer wirklich liegt, schlaeft sofort wieder ein;
   * wer in der Luft hing, faellt jetzt. Das kostet nur Ladezeit, keine
   * Bildzeit.
   */
  settle(world: RAPIER.World, schritte = 240): void {
    // Vor dem Beruhigen einmal aufraeumen: Was hier faellt, wird gleich
    // dutzendfach gefragt (siehe `raeumeVerwaiste`).
    this.raeumeVerwaiste();
    const runde = (n: number) => {
      for (let i = 0; i < n; i++) {
        world.step();
        this.settleSleep(1 / 60);
      }
    };
    runde(schritte);
    for (let durchgang = 0; durchgang < 4; durchgang++) {
      let geweckt = 0;
      for (const item of this.items) {
        if (item.body.isDynamic() && item.body.isSleeping()) {
          item.body.wakeUp();
          geweckt++;
        }
      }
      if (geweckt === 0) break;
      runde(90);
      // Faellt noch etwas nennenswert? Dann noch eine Runde.
      let faellt = 0;
      for (const item of this.items) {
        if (!item.body.isDynamic()) continue;
        const v = item.body.linvel();
        if (Math.abs(v.y) > 0.25) faellt++;
      }
      if (faellt === 0) break;
    }
    for (const item of this.items) if (item.body.isDynamic()) item.body.sleep();
    this.syncMeshes();
  }

  /** Teil aus Form-Spec erzeugen (Haufen, Ladung, Save-Restore). */
  /**
   * Bau aus dem Katalog nachtragen.
   *
   * Ein Spielstand speichert die Form eines Teils, wie sie beim Anlegen war —
   * und aeltere Staende kennen das Feld `bau` noch nicht. Ohne diesen Nachtrag
   * blieben auf jedem vorhandenen Platz alle Teile Quader, egal wie viele
   * Bauten es gibt (Befund 12.09.2026: "ich seh sie nicht auf dem iPad").
   *
   * Gesucht wird ueber Fraktion, Masse, Form und Masse — genau die vier Werte,
   * mit denen das Teil einmal aus dem Katalog gezogen wurde. Findet sich nichts,
   * bleibt es der Grundkoerper; falsch wird dadurch nichts.
   */
  private static katalogKarte: Map<string, KatalogZusatz> | null = null;

  private static katalogFuer(
    materialId: string,
    massKg: number,
    shape: ScrapShape
  ): KatalogZusatz | undefined {
    if (!ItemManager.katalogKarte) {
      const karte = new Map<string, KatalogZusatz>();
      for (const liste of [SPECS, BIG_SPECS, HUGE_SPECS]) {
        for (const sp of liste) {
          if (!sp.bau && !sp.name) continue;
          karte.set(`${sp.materialId}|${sp.massKg}|${sp.kind}|${sp.dims.join(",")}`, {
            bau: sp.bau,
            name: sp.name,
            zusammensetzung: sp.zusammensetzung,
            trennbar: sp.trennbar,
            nurWerkzeug: sp.nurWerkzeug,
          });
        }
      }
      ItemManager.katalogKarte = karte;
    }
    return ItemManager.katalogKarte.get(
      `${materialId}|${massKg}|${shape.kind}|${shape.dims.join(",")}`
    );
  }

  spawnScrap(
    materialId: string,
    massKg: number,
    shape: ScrapShape,
    pos: THREE.Vector3,
    rot?: THREE.Quaternion
  ): ScrapItem {
    /*
     * Bei einem Bau steckt die Farbe in den Eckpunkten, nicht im Material —
     * darum Grundfarbe weiss und `vertexColors`. Nur so bleibt ein Objekt aus
     * zwoelf Bauteilen ein einziger Zeichenruf mit einem einzigen Material.
     */
    // Aus einem alten Spielstand geladen? Dann fehlt alles, was der Katalog
    // seither dazubekommen hat — nachtragen.
    if (!shape.bau || !shape.name || !shape.zusammensetzung) {
      const k = ItemManager.katalogFuer(materialId, massKg, shape);
      if (k) {
        shape = {
          ...shape,
          bau: shape.bau ?? k.bau,
          name: shape.name ?? k.name,
          zusammensetzung: shape.zusammensetzung ?? k.zusammensetzung,
          trennbar: shape.trennbar ?? k.trennbar,
          nurWerkzeug: shape.nurWerkzeug ?? k.nurWerkzeug,
        };
      }
    }
    // Oberflaeche nach Sorte (E-123, `objektbau.fraktionsbild`): VA blank,
    // Alu matt, Stahlschrott rau. Ohne Eintrag gilt die alte Regel.
    const bild = fraktionsbild(materialId);
    const material = new THREE.MeshStandardMaterial({
      color: shape.bau ? 0xffffff : shape.color,
      vertexColors: !!shape.bau,
      roughness:
        bild?.rauheit ??
        (materialId === "copper" || materialId === "brass" || materialId === "alu" ? 0.35 : 0.75),
      metalness: bild?.glanz ?? (NICHTMETALLE.has(materialId) || materialId === "cable" ? 0 : 0.4),
    });
    let geo: THREE.BufferGeometry;
    let collider: RAPIER.ColliderDesc;
    /** Mehrteiliger Kollider (Formen mit Taille) — leer heisst: einer reicht. */
    let teilKollider: RAPIER.ColliderDesc[] = [];
    /** Massenanteile der Teilkollider, in derselben Reihenfolge. */
    let teilAnteile: number[] = [];
    if (shape.spaene !== undefined) {
      // E-147: geteilte Geometrie, darum Eckfarben auf weissem Grund
      geo = spaeneGeometrie(shape.spaene);
      material.color.setHex(0xffffff);
      material.vertexColors = true;
      // SW: oelig glatter als Stahlschrott (0,9), Glanz unter 0,5 (E-123)
      material.roughness = 0.5;
      material.metalness = 0.45;
      const [w, h, d] = shape.dims;
      collider =
        RAPIER.ColliderDesc.convexHull(spaeneHuelle(shape.spaene)) ??
        RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2);
    } else if (shape.kind === "box") {
      const [w, h, d] = shape.dims;
      geo = new THREE.BoxGeometry(w, h, d);
      collider = RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2);
    } else if (shape.kind === "cyl") {
      const [r, len] = shape.dims;
      // E-181: ein kurzes Rad (Rad mit Alufelge) sieht aus wie die Raeder als Torus
      const felge = len <= r * 2.5 ? radFelge(shape) : null;
      geo = felge !== null ? radGeometrie(r - len / 2, len / 2, felge) : new THREE.CylinderGeometry(r, r, len, 14);
      if (felge !== null) {
        material.color.setHex(0xffffff);
        material.vertexColors = true;
      }
      if (len > r * 2.5) {
        geo.rotateX(Math.PI / 2); // langes Rohr, liegend
        collider = RAPIER.ColliderDesc.cuboid(r, r, len / 2);
      } else {
        collider = achtkant(r, len / 2); // Felge/Scheibe
      }
    } else if (shape.kind === "torus") {
      const [r, tube] = shape.dims;
      // E-181: Reifen gibt es nur noch mit Felge
      const felge = materialId === "cable" ? null : radFelge(shape);
      // Kabel wird als mehrfach gewickelter Strang gebaut — ein glatter Ring
      // sah aus wie ein Donut, nicht wie aufgerolltes Kabel.
      geo =
        materialId === "cable"
          ? cableCoilGeometry(r, tube)
          : felge !== null
            ? radGeometrie(r, tube, felge)
            : (() => {
                const g = new THREE.TorusGeometry(r, tube, 8, 16);
                g.rotateX(Math.PI / 2);
                return g;
              })();
      if (felge !== null) {
        material.color.setHex(0xffffff);
        material.vertexColors = true;
      }
      collider = achtkant(r + tube, tube);
    } else {
      // Drahtknäuel: verrauschte Kugel im Wireframe liest sich als Maschendraht
      const [r] = shape.dims;
      geo = new THREE.IcosahedronGeometry(r, 2);
      const pos = geo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const n = 0.75 + Math.random() * 0.45;
        pos.setXYZ(i, pos.getX(i) * n, pos.getY(i) * n, pos.getZ(i) * n);
      }
      // Kollider aus genau den verbeulten Ecken, die man auch sieht. Als glatte
      // Kugel rollte das Knaeuel endlos weiter (gemessen: 0,44 m/s nach 10 s bei
      // 150 kg) und hielt ueber die gemeinsame Schlafregel den ganzen Haufen
      // wach — dieselbe Ursache wie bei den Zylindern, E-011. Federn darf es
      // weiterhin, die Restitution bleibt.
      collider =
        RAPIER.ColliderDesc.convexHull(pos.array as Float32Array) ??
        RAPIER.ColliderDesc.ball(r * 0.95);
    }
    /*
     * Der Bau ersetzt nur das Aussehen. Der Kollider bleibt der Grundkoerper
     * aus dem Katalog — Physik und Aussehen sind getrennt, und das Aussehen
     * darf darum beliebig fein werden, ohne dass die Physik teurer wird.
     */
    let glasGeo: THREE.BufferGeometry | null = null;
    if (shape.bau) {
      geo.dispose();
      // Die Fraktion geht mit: Blanke Bauteile bekommen daraus ihren
      // Metallton (E-063). Fuer Stahl und Mischschrott aendert das nichts.
      const bauteil = baueGeometrie(shape.bau, shape.dims, shape.kind, materialId);
      geo = bauteil.koerper;
      glasGeo = bauteil.glas;
      /*
       * Der Kollider kommt aus dem gebauten Koerper, nicht mehr aus dem
       * Grundkoerper des Katalogs.
       *
       * Befund 12.09.2026: „die Objekte tauchen ein." Nachgemessen steckten 20
       * von 71 Teilen im Boden, das schlimmste 1,14 m tief. Die Ursache stand
       * als Absicht im Code — der Bau ersetzte nur das Aussehen, der Kollider
       * blieb der Quader oder Zylinder aus dem Katalog. Ein Tank mit den Massen
       * [0,85 | 0,90] wird als Behaelter mit Sattel und Stutzen gebaut und ist
       * dann 2,37 m hoch: Er liegt auf seinem 0,9-m-Zylinder auf, und
       * anderthalb Meter Blech ragen durch die Platte.
       *
       * Die konvexe Huelle der gebauten Ecken trifft genau das, was man sieht.
       * Sie ist teurer als ein Quader, aber nur beim Bauen — im Lauf ist sie
       * eine Form wie jede andere. Faellt sie aus (zu wenige Punkte), bleibt es
       * beim Grundkoerper.
       */
      const ecken = geo.getAttribute("position") as THREE.BufferAttribute | null;
      const punkte = ecken && ecken.count >= 4 ? (ecken.array as Float32Array) : null;
      /*
       * Vorher pruefen, ob ueberhaupt Zahlen drinstehen. Rapier rechnet die
       * Huelle in WebAssembly, und ein einziges NaN beendet dort nicht die
       * Funktion, sondern das Modul: „RuntimeError: unreachable", und das
       * ganze Spiel startet nicht mehr. Drei.js meldet dieselben Geometrien
       * seit jeher nur als Warnung („Computed radius is NaN") — harmlos beim
       * Zeichnen, toedlich beim Kollider. Wer NaN mitbringt, behaelt seinen
       * Grundkoerper.
       */
      const sauber = punkte !== null && punkte.every((v) => Number.isFinite(v));
      const huelle = sauber ? RAPIER.ColliderDesc.convexHull(punkte) : null;
      if (huelle) collider = huelle;
      else if (!sauber) unsaubereBauten.add(shape.bau);
      /*
       * Formen mit Taille liefern mehrere Punktwolken (objektbau.ts,
       * `Bauteil.huellen`). Eine einzige konvexe Huelle wuerde die Taille
       * ueberbruecken; getrennt bleibt sie erhalten. Faellt eine der Wolken
       * aus, bleibt es bei der einen Huelle von oben — lieber ein zu voller
       * Kollider als gar keiner.
       */
      const wolken = bauteil.huellen;
      if (wolken && wolken.length > 1) {
        const stuecke: Array<{ desc: RAPIER.ColliderDesc; raum: number }> = [];
        for (const wolke of wolken) {
          if (wolke.length < 12 || !wolke.every((v) => Number.isFinite(v))) continue;
          const d = RAPIER.ColliderDesc.convexHull(wolke);
          if (!d) continue;
          stuecke.push({ desc: d, raum: quaderRaum(wolke) });
        }
        if (stuecke.length === wolken.length) {
          const summe = stuecke.reduce((a, t) => a + t.raum, 0) || 1;
          teilKollider = stuecke.map((t) => t.desc);
          teilAnteile = stuecke.map((t) => t.raum / summe);
        }
      }
    }

    const isWire = shape.kind === "wire";
    const mesh = new THREE.Mesh(
      geo,
      isWire
        ? new THREE.MeshStandardMaterial({ color: shape.color, roughness: 0.6, metalness: 0.5, wireframe: true })
        : material
    );
    if (isWire) {
      // zweites, kleineres Knäuel innen für Dichte
      const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(shape.dims[0] * 0.7, 1), mesh.material);
      inner.rotation.set(0.7, 1.3, 0.4);
      mesh.add(inner);
    }
    /*
     * Scheiben haengen als eigenes Kind am Teil — nicht verschmolzen, sonst
     * liessen sie sich nie entfernen. Das kostet einen zweiten Zeichenruf,
     * aber nur bei Objekten, die ueberhaupt Fenster haben.
     */
    if (glasGeo) {
      if (shape.glasKaputt) {
        glasGeo.dispose();
      } else {
        const scheibe = new THREE.Mesh(glasGeo, glasStoff());
        scheibe.name = "glas";
        mesh.add(scheibe);
      }
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    if (shape.flat) {
      mesh.scale.y = shape.kind === "wire" ? 0.5 : FLAT_SCALE_Y;
      collider = flatColliderDesc(shape);
    }
    const q = rot ?? new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.random() * Math.PI, 0));
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(pos.x, pos.y, pos.z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        // Dämpfung nach Masse: eine feste Bremse für alles nahm schweren
        // Teilen ihr Gewicht — ein Motorblock kam so schnell zur Ruhe wie ein
        // Blech. Leichtes bremst stark, Schweres behält seinen Schwung.
        .setLinearDamping(Math.max(dampLin(massKg), istPlatzinventar(shape) ? INVENTAR_DAMP_LIN : 0))
        .setAngularDamping(
          Math.max(dampAngFuer(shape, massKg), istPlatzinventar(shape) ? INVENTAR_DAMP_ANG : 0)
        )
        // Ohne durchgehende Prüfung schlagen schnelle Teile durch Boden,
        // Bordwände und Bagger hindurch
        .setCcdEnabled(true)
    );
    // Restitution 0: Metall auf Beton springt nicht, es klatscht und liegt
    // Sperrig ineinander: viel Reibung, und bei zwei Teilen zählt der
    // höhere Wert. Schrott rutscht nicht auseinander, er verhakt sich.
    //
    // Meist ist es genau ein Kollider. Formen mit Taille bringen mehrere mit
    // (siehe oben); dann bekommt jeder seinen Massenanteil, und der
    // Schwerpunkt sitzt dort, wo das Material ist. Derzeit nutzt das kein
    // Bau — der Kehrbesen, der es gebraucht hatte, ist seit E-037 taillenlos,
    // und sein Schwerpunkt sitzt schon von der Huelle her unter der Mitte
    // (als Rolle gemessen: y −0,035 m bei 0,80 m Hoehe).
    const teile = shape.flat || teilKollider.length === 0 ? [collider] : teilKollider;
    const anteile = teile.length === 1 ? [1] : teilAnteile;
    for (let i = 0; i < teile.length; i++) {
      this.world.createCollider(
        teile[i]
          .setMass(massKg * anteile[i])
          .setFriction(2.2)
          .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
          // Nur Drahtknäuel federn — die sind elastisch. Alles andere ist
          // Metall auf Beton: das klatscht und bleibt liegen.
          .setRestitution(shape.kind === "wire" ? 0.55 : 0)
          .setRestitutionCombineRule(
            shape.kind === "wire"
              ? RAPIER.CoefficientCombineRule.Max
              : RAPIER.CoefficientCombineRule.Min
          ),
        body
      );
    }
    /*
     * Die Zusammensetzung wandert als absolute Massen ans Teil. Sie stand
     * bisher nur im Katalog, und damit wusste ein Kuehlschrott-Teil im Spiel
     * nicht, woraus es besteht — die Presse rechnete die Reinheit eines
     * Pakets aus lauter Einzelstuecken, als waere jedes sortenrein.
     */
    /*
     * Platzinventar besteht wirtschaftlich aus nichts.
     *
     * Das ist die EINE Stelle, an der aus der Marke „Inventar" Wertlosigkeit
     * wird (Ansage 15.09.2026: „Selbst wenn er mal aufgeladen wird, gibt es
     * kein Geld dafuer. Auch wenn er in der Presse mal verschwindet ...").
     * Jede Geldformel im Spiel liest bereits die Zusammensetzung, wenn eine da
     * ist — der Verkauf in `economy/account.ts` und das Presspaket in
     * `world/press.ts`. Mit null Kilo rechnen beide null Euro, ohne dass sie
     * den Besen kennen muessten.
     *
     * Nicht die leere Liste, sondern ein Eintrag mit null Kilo: `press.ts`
     * ruft `reduce` ohne Startwert auf, und das wirft bei einer leeren Liste.
     */
    const composition = shape.inventar
      ? [{ materialId, massKg: 0 }]
      : shape.zusammensetzung
        ? shape.zusammensetzung.map((a) => ({ materialId: a.materialId, massKg: a.anteil * massKg }))
        : undefined;
    // Presspakete bringen zusaetzlich ihren Fraktionsmix mit (E-094) — ohne
    // ihn waere ein geladenes Paket aus Kupfer und Messing Mischschrott.
    const fraktionsmix = shape.inventar
      ? undefined
      : shape.fraktionsmix?.map((a) => ({ materialId: a.materialId, massKg: a.anteil * massKg }));
    return this.register({ materialId, massKg, mesh, body, shape, composition, fraktionsmix });
  }

  /**
   * Großer Schrottberg zum Spielstart. Liegt auf der Stahlschrottfläche, nicht
   * auf der Annahmefläche — dort müssen die Pritschen abladen können.
   *
   * Die Teile werden überlappungsfrei gesetzt: klemmen sie beim Spawn
   * ineinander, schleudert die Physik sie über den halben Platz.
   */
  /*
   * `spread` ist der Radius, ueber den der Haufen verteilt wird. Er stand auf
   * 4,0 m. Mit dem erweiterten Sortiment sind die Stuecke im Mittel sperriger,
   * und bei gleicher Flaeche fand ein Fuenftel keinen Platz mehr. Die
   * Stahlschrottflaeche misst 11 x 12 m — fuer 5,2 m Radius ist also Platz.
   *
   * `count` stand auf 150. Die Stuecke aus dem Objektkatalog haben realistische
   * Massen, und damit wog der Starthaufen ploetzlich 17,6 t — ueber der
   * Stauschwelle von 16 t. Der Platz waere mit geschlossener Einfahrt
   * gestartet, und nicht einmal der Tutorial-Kunde waere hereingekommen.
   * Weniger Stuecke, dafuer schwerere: Das Gesamtgewicht bleibt, wo die
   * Wirtschaft es erwartet, ohne dass an ihr gedreht wird.
   */
  spawnPile(pileCenter: THREE.Vector3, count = 85, spread = 5.2): void {
    const placed: Array<{ x: number; y: number; z: number; r: number }> = [];
    /*
     * Anteil Grossteile im Starthaufen.
     *
     * Stand auf 0,45. Seit der Objektkatalog dazugekommen ist, enthaelt
     * BIG_SPECS auch Baggerausleger, Schuttmulden und Kipperbruecken — Stuecke
     * von ueber drei Metern. Mit 45 Prozent davon fand fast die Haelfte der
     * Teile keinen Platz mehr (gemessen: 64 statt ueber 90 von 150), und der
     * Haufen sah aus wie ein Maschinenfriedhof statt wie ein Schrotthaufen.
     * Grossteile kommen jetzt vor allem mit den Anlieferungen; im Starthaufen
     * liegen ein paar davon, nicht die Haelfte.
     */
    const specs = randomCargo(count, 0.12);
    for (const s of specs) {
      // Umkugel, nicht halbe Kantenlaenge: Ein Teil wird zufaellig verdreht
      // gesetzt, also zaehlt der groesste Abstand von der Mitte zur Ecke. Die
      // alte Rechnung (max(dims)/2) war bei jeder Kiste zu klein — bei einem
      // 1,2-m-Blech um 40 % —, deshalb klemmten Teile trotz Pruefung
      // ineinander und der Solver trieb sie auseinander (v2 E-010).
      const r = umkugelRadius(s.shape) + SPAWN_ABSTAND;
      let spot: { x: number; y: number; z: number; r: number } | null = null;
      // Mehr Lagen und Versuche als frueher: seit der Abstand ehrlich gerechnet
      // wird, braucht dieselbe Teilezahl mehr Raum. Mit den alten 14 Lagen
      // blieben 69 von 150 Teilen auf der Strecke.
      for (let layer = 0; layer < 24 && !spot; layer++) {
        const y = 0.5 + layer * 0.62;
        // innen dichter, außen weiter — das ergibt die Kegelform eines Haufens
        const maxRad = spread * (1 - layer * 0.03);
        for (let attempt = 0; attempt < 90; attempt++) {
          const a = Math.random() * Math.PI * 2;
          const rad = Math.sqrt(Math.random()) * maxRad;
          const x = pileCenter.x + Math.cos(a) * rad;
          const z = pileCenter.z + Math.sin(a) * rad;
          // echter Abstand: der Faktor 1,2 auf der Hochachse hat den Abstand
          // groesser gerechnet, als er war, und Ueberlappungen durchgelassen
          const clash = placed.some(
            (p) => Math.hypot(p.x - x, p.y - y, p.z - z) < p.r + r
          );
          if (!clash) {
            spot = { x, y, z, r };
            break;
          }
        }
      }
      if (!spot) continue;
      placed.push(spot);
      // zufällig verdreht spawnen: nichts liegt sauber ausgerichtet auf dem Hof
      const q = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          (Math.random() - 0.5) * 1.6,
          Math.random() * Math.PI * 2,
          (Math.random() - 0.5) * 1.6
        )
      );
      this.spawnScrap(
        s.materialId,
        s.massKg,
        s.shape,
        new THREE.Vector3(spot.x, spot.y, spot.z),
        q
      );
    }
    /*
     * Und zuletzt das Platzinventar.
     *
     * Es liegt hier und nicht im Aufbau von `main.ts`, weil `spawnPile` der
     * eine Aufruf ist, der genau einmal laeuft: beim Neuen Spiel. Wer aus
     * einem Spielstand startet, bekommt seinen Besen aus dem Save — dort steht
     * er als gewoehnliches Teil mit `inventar: "besen"` an der Form.
     *
     * NICHT in den Haufen: Unter fuenfzig Teilen begraben waere er kein
     * Werkzeug mehr, sondern eine Suchaufgabe.
     */
    this.inventarNachtragen();
  }

  /**
   * Den einen Kehrbesen auf seinen Platz legen.
   *
   * Idempotent: Liegt schon einer auf dem Hof, passiert nichts. So kann der
   * Aufruf an mehreren Stellen stehen, ohne dass zwei Besen entstehen — und
   * der Waechter „beim Start existiert genau einer" bleibt wahr.
   */
  spawnBesen(): ScrapItem | null {
    if (this.items.some((it) => it.shape?.inventar === "besen")) return null;
    /*
     * Er liegt so, wie er gebaut ist — und das ist seit E-037 schon die
     * Gebrauchslage.
     *
     * Der Trichter von vormittags musste auf die Flanke gelegt werden
     * (`Euler(PI/2, 0, 0)`), sonst haette er wie ein Besen an der Wand
     * gestanden und waere beim ersten Anstossen umgefallen. Die Rolle hat
     * diese Frage nicht: Ihre Form IST die Lage, in der sie entstanden ist —
     * unten die Wicklung auf dem Beton, oben der gequetschte Kopf. Sie wird
     * hingelegt, nicht gekippt, und steht damit sofort richtig zum Kehren.
     *
     * `gier` dreht sie nur um die Hochachse: 0 heisst, die Rollenachse und
     * damit die 2,70 m lange Schleppkante liegen quer (Ost–West) — man sieht
     * beim Start, wie breit sie kehrt.
     */
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, BESEN_PLATZ.gier, 0));
    return this.spawnScrap(
      BESEN.materialId,
      BESEN.massKg,
      besenForm(),
      // Halbe Hoehe hoch plus fuenf Zentimeter: er ruht auf seinem platten Boden.
      new THREE.Vector3(BESEN_PLATZ.x, BESEN.dims[1] / 2 + 0.05, BESEN_PLATZ.z),
      q
    );
  }

  /**
   * Fehlendes Platzinventar wieder hinlegen — der Tageswechsel.
   *
   * Ansage Patrick, 15.09.2026: „Und er kommt jeden Tag wieder. Also wie auch
   * der Besen ist es ein fester Bestandteil des Platzes und erscheint am
   * naechsten Tag wieder." Ein Werkzeug, das in der Presse verschwindet oder
   * mit dem Abholer wegfaehrt, ist damit ein Aergernis bis Mitternacht und
   * kein Verlust.
   *
   * Idempotent: Was noch da ist, bleibt liegen, wo es liegt. Der Spieler darf
   * seinen Besen also dort abstellen, wo er ihn braucht.
   *
   * @returns die Namen der Stuecke, die nachgelegt wurden — fuer eine Meldung.
   */
  inventarNachtragen(): string[] {
    const nachgelegt: string[] = [];
    for (const stueck of PLATZINVENTAR) {
      if (this.items.some((it) => it.shape?.inventar === stueck.id)) continue;
      if (stueck.hinlegen(this)) nachgelegt.push(stueck.name);
    }
    return nachgelegt;
  }

  /**
   * Lässt sich das Teil in der Spinne zusammendrücken?
   *
   * Bleche, Kabel, Fässer, Buntmetall und Draht geben nach. Massiver
   * Stahlschrott — Träger und dicke Platten — nicht: den bekommt man nur in
   * der Presse klein.
   */
  /**
   * Laesst sich das Ding zusammendruecken — in der Spinne wie in der Presse?
   *
   * Die Regel steht in materials/purity.ts und rechnet mit Dichte und Dicke:
   * Was hohl ist, geht zusammen; was massiv ist, bleibt (Ansage 12.09.2026:
   * "starre und massive Traeger sollten von der Presse unberuehrt bleiben").
   */
  /** Faellt das Ding beim Zusammendruecken auseinander? */
  istTrennbar(item: ScrapItem): boolean {
    return (
      !!item.shape?.trennbar &&
      !item.shape?.nurWerkzeug &&
      (item.composition?.length ?? 0) >= 2
    );
  }

  /** Trennbar, aber nur mit Werkzeug — Arbeit fuer den Platzwart. */
  brauchtWerkzeug(item: ScrapItem): boolean {
    return !!item.shape?.trennbar && !!item.shape?.nurWerkzeug;
  }

  isCrushable(item: ScrapItem): boolean {
    if (!item.shape || item.shape.flat) return false;
    /*
     * Ein Werkzeug wird nicht zerdrueckt. Ohne diese Zeile waere der Besen
     * das erste Opfer seiner eigenen Bauart: Ein Drahtgeflecht ist duenn und
     * leicht, `istPressbar` sagt also Ja — und die Spinne macht beim
     * Festhalten nach 1,1 Sekunden einen Fladen daraus.
     */
    if (istPlatzinventar(item.shape)) return false;
    // E-147: Ein Knaeuel wird kein Fladen — sein flacher Kollider waere hoeher als es selbst
    if (item.shape.spaene !== undefined) return false;
    return istPressbar(item.massKg, item.shape.dims);
  }

  /**
   * Gepresstes Paket: ein fester Ballen aus mehreren Teilen. Die Kantenlänge
   * wächst mit der Masse, bleibt aber im Rahmen dessen, was ein Container
   * fasst. Die zerknautschte Oberfläche entsteht aus einem verrauschten
   * Quader — glatt sähe es aus wie ein Umzugskarton.
   */
  /**
   * Presspaket.
   *
   * Ein Paket ist kein Quader von der Stange (Wunsch 12.09.2026): „Je Material
   * und Stauchung sollten die farblich anders fransen, aussehen und
   * unterschiedlich gross sein." Drei Dinge richten sich deshalb nach dem, was
   * hineingegangen ist:
   *
   * - **Dichte** — Alu und Kupfer lassen sich weich zusammenschieben und
   *   ergeben ein dichtes, kleines Paket. Stahl federt zurueck, VA ist stur,
   *   Kabel bleibt ein Knaeuel. Bei gleicher Masse kommt darum ein sehr
   *   unterschiedlich grosser Wuerfel heraus.
   * - **Fransen** — wie viele, wie lang, wie duenn. Ein Kabelpaket haengt
   *   ueberall voll Schwaenze, ein Alupaket ist fast glatt.
   * - **Farbe** — nicht die dominante Fraktion, sondern Flecken aus allem, was
   *   drin ist, gewichtet nach Masse. Ein gemischtes Paket ist auch bunt.
   *
   * Dazu eine Toleranz von rund einem Zehntel auf Groesse und Seitenverhaeltnis:
   * Zwei Pakete aus derselben Fuhre sehen nie gleich aus.
   *
   * Alles wird zu **einer** Geometrie verschmolzen, die Farben stecken in den
   * Eckpunkten. Ein Paket mit vierzehn Fransen kostet damit einen Zeichenruf
   * statt fuenfzehn.
   */
  spawnBale(
    materialId: string,
    massKg: number,
    pos: THREE.Vector3,
    composition?: Array<{ materialId: string; massKg: number }>,
    /**
     * Wie stark diese Presse verdichtet. 1 = Grundausbau.
     *
     * Der Ausbau „Groessere Presse" verspricht im Kaufmenue (`upgrades.ts`)
     * „Schwerere Pakete, mehr Ladung je Abholung" — und genau das ist es:
     * dieselbe Masse in einem kleineren Wuerfel. Kein Euro aendert sich, nur
     * das Volumen (E-094).
     */
    dichteFaktor = 1,
    /**
     * Welche FRAKTIONEN in dieses Paket gegangen sind, in Kilogramm.
     *
     * Ohne Angabe gilt das Paket als ein Klumpen seiner eigenen Fraktion —
     * das ist richtig fuer `consolidate()` (Lambert fasst Gleiches zusammen)
     * und falsch fuer die Presse, die Verschiedenes buendelt.
     */
    fraktionsmix?: Array<{ materialId: string; massKg: number }>
  ): ScrapItem {
    const profil = PRESSPROFIL[materialId] ?? PRESSPROFIL.steel;
    const streu = (a: number): number => (Math.random() - 0.5) * 2 * a;

    /*
     * Groesse aus Dichte und Masse, mit Toleranz.
     *
     * Die Toleranz war zuerst zu breit: plus/minus zwoelf Prozent auf jede
     * Kante ergeben zusammen einen Faktor zwei aufs Volumen — damit kam ein
     * Alupaket groesser heraus als ein Stahlpaket, obwohl Alu dichter presst
     * (gemessen 12.09.2026: 0,86 gegen 0,54 Kubikmeter bei je 900 kg). Die
     * Streuung soll zwei Pakete derselben Fuhre unterscheiden, nicht die
     * Materialien vertauschen. Jetzt rund plus/minus fuenfzehn Prozent aufs
     * Volumen, waehrend die Dichten von 540 bis 1900 reichen.
     *
     * **Der Deckel auf 1,8 m³ war die zweite Haelfte des Alu-Fehlers**
     * (E-061, 15.09.2026). Er ist keine Dichte, er ist eine Abschneidekante:
     * Ueber 2250 kg Stahl (und, mit der alten Zahl, ueber 2610 kg Alu) sah
     * jedes Paket gleich gross aus, egal wie schwer es war. Ein Alupaket von
     * 1,8 t — das `consolidate()` aus vierzig Kleinteilen ohne weiteres baut —
     * kam damit als Wuerfel von 1,2 m Kante heraus. Genau das Stueck, das
     * Patrick gemeldet hat.
     *
     * Der neue Deckel 4,5 m³ ist an einem Gegenstand gemessen, nicht geraten:
     * Es ist die Kantenlaenge, ab der ein Paket kein Paket mehr ist. Bei
     * 4,5 m³ misst es 2,06 × 1,40 × 1,65 m — so gross wie ein Ballen aus einer
     * grossen Schrottschere, und immer noch kleiner als der Seecontainer
     * (2,4 × 2,6 × 4,8 m), der im Katalog steht und den die Spinne bewegt.
     *
     * Was das in Kilogramm heisst: Erst ab 5625 kg Stahl bzw. 1935 kg Alu
     * greift er ueberhaupt noch. Darunter folgt die Groesse jetzt der Masse.
     */
    const vol = THREE.MathUtils.clamp(
      massKg / (profil.dichte * Math.max(dichteFaktor, 0.1) * (1 + streu(0.05))),
      0.1,
      4.5
    );
    const w = Math.cbrt(vol);
    const dims: [number, number, number] = [
      w * (1.25 + streu(0.06)),
      w * (0.85 + streu(0.06)),
      w * (1.0 + streu(0.05)),
    ];

    // Farbanteile nach Masse — daraus werden die Flecken und die Fransen
    const anteile = (composition ?? [{ materialId, massKg }]).filter((c) => c.massKg > 0);
    const summe = anteile.reduce((a, c) => a + c.massKg, 0) || 1;
    const paletteFarben = anteile.map((c) => getMaterial(c.materialId).color);
    const paletteAnteil = anteile.map((c) => c.massKg / summe);
    const waehleFarbe = (r: number): number => {
      let acc = 0;
      for (let i = 0; i < paletteFarben.length; i++) {
        acc += paletteAnteil[i];
        if (r <= acc) return paletteFarben[i];
      }
      return paletteFarben[paletteFarben.length - 1] ?? getMaterial(materialId).color;
    };

    const stuecke: THREE.BufferGeometry[] = [];
    const farbeHilf = new THREE.Color();
    const faerbe = (geo: THREE.BufferGeometry, waehler: (i: number) => number): void => {
      const p2 = geo.getAttribute("position");
      const c = new Float32Array(p2.count * 3);
      for (let i = 0; i < p2.count; i++) {
        farbeHilf.set(waehler(i));
        c[i * 3] = farbeHilf.r;
        c[i * 3 + 1] = farbeHilf.g;
        c[i * 3 + 2] = farbeHilf.b;
      }
      geo.setAttribute("color", new THREE.BufferAttribute(c, 3));
      geo.deleteAttribute("uv1");
      stuecke.push(geo);
    };

    // Koerper: gebeult, und die Beule ist materialabhaengig
    const geo = new THREE.BoxGeometry(dims[0], dims[1], dims[2], 4, 3, 4);
    const p = geo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const n = profil.beule * w;
      p.setXYZ(i, p.getX(i) + streu(n), p.getY(i) + streu(n), p.getZ(i) + streu(n));
    }
    geo.computeVertexNormals();
    // Flecken: benachbarte Eckpunkte bekommen dieselbe Farbe, sonst flimmert es
    faerbe(geo, (i) => {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const k = Math.abs(Math.sin(x * 12.1 + y * 7.3 + z * 9.7) * 43758.5);
      return waehleFarbe(k - Math.floor(k));
    });

    // Fransen: Zahl, Laenge und Dicke nach Profil
    const fransen = profil.fransen[0] + Math.floor(Math.random() * (profil.fransen[1] - profil.fransen[0] + 1));
    const [hx, hy, hz] = [dims[0] / 2, dims[1] / 2, dims[2] / 2];
    const rand = (a: number): number => (Math.random() - 0.5) * a;
    for (let i = 0; i < fransen; i++) {
      const lang = w * profil.lang * (0.6 + Math.random() * 0.8);
      const duenn = w * profil.dick * (0.6 + Math.random() * 0.9);
      const zipfel = new THREE.BoxGeometry(duenn, duenn * (0.5 + Math.random()), lang);
      zipfel.rotateX(Math.random() * Math.PI);
      zipfel.rotateY(Math.random() * Math.PI);
      zipfel.rotateZ(Math.random() * Math.PI);
      const punkte: Array<[number, number, number]> = [
        [hx, rand(dims[1]), rand(dims[2])],
        [-hx, rand(dims[1]), rand(dims[2])],
        [rand(dims[0]), hy, rand(dims[2])],
        [rand(dims[0]), -hy, rand(dims[2])],
        [rand(dims[0]), rand(dims[1]), hz],
        [rand(dims[0]), rand(dims[1]), -hz],
      ];
      const [px, py, pz] = punkte[Math.floor(Math.random() * 6)];
      zipfel.translate(px * 0.92, py * 0.92, pz * 0.92);
      const farbe = waehleFarbe(Math.random());
      faerbe(zipfel, () => farbe);
    }

    /*
     * Reste der Ursprungsform — man sieht dem Paket an, was hineingegangen ist.
     *
     * Wunsch Patrick (Gerätetest, `docs/offene-punkte.md`): „Ballen sehen zu
     * sauber aus — Fransen, **Reste der Ursprungsform**, unterschiedliche
     * Farben." Fransen und Farben standen seit dem 12.09.; die Ursprungsform
     * fehlte ganz.
     *
     * Welche Reste erscheinen, wird NICHT gewürfelt, sondern aus der
     * Zusammensetzung gelesen: Jede Fraktion mit mindestens einem Sechstel der
     * Masse darf ein Stück von sich zeigen, höchstens zwei Fraktionen je
     * Paket. Ein Kupferballen zeigt damit ein Kupferrohr, ein Paket aus Stahl
     * und Kupfer zeigt ein Stahlblech UND ein Kupferrohr — und ein Paket, in
     * dem nur Kabel oder nur Reifen waren, zeigt gar nichts, weil daran keine
     * Form mehr zu erkennen ist.
     *
     * Die Schwelle und die Auswahl stehen in `resteFuerPaket` — dieselbe
     * Regel, die `test/ballen.test.ts` prüft.
     */
    for (const fraktionId of resteFuerPaket(anteile)) {
      const eigen = PRESSPROFIL[fraktionId] ?? PRESSPROFIL.steel;
      const art = eigen.reste[Math.floor(Math.random() * eigen.reste.length)];
      const rest = baueRest(art, w);
      // Frei im Raum drehen, aber flach genug, dass die Form lesbar bleibt
      rest.rotateY(Math.random() * Math.PI * 2);
      rest.rotateX(rand(0.9));
      rest.rotateZ(rand(0.9));
      /*
       * Sitz: auf einer der sechs Flächen, drei Viertel draussen.
       * Bei 0,75 der halben Kante steht das Stück je nach Form 8 bis 14 % der
       * Paketkante über — sichtbar, aber es bleibt ein Paket und wird kein
       * Mobile. (SW, am Netz nachgemessen: `test/ballen.test.ts`)
       */
      const sitz: Array<[number, number, number]> = [
        [hx, rand(dims[1] * 0.7), rand(dims[2] * 0.7)],
        [-hx, rand(dims[1] * 0.7), rand(dims[2] * 0.7)],
        [rand(dims[0] * 0.7), hy, rand(dims[2] * 0.7)],
        [rand(dims[0] * 0.7), -hy, rand(dims[2] * 0.7)],
        [rand(dims[0] * 0.7), rand(dims[1] * 0.7), hz],
        [rand(dims[0] * 0.7), rand(dims[1] * 0.7), -hz],
      ];
      const [px, py, pz] = sitz[Math.floor(Math.random() * 6)];
      rest.translate(px * 0.75, py * 0.75, pz * 0.75);
      const farbe = getMaterial(fraktionId).color;
      faerbe(rest, () => farbe);
    }

    const gesamt = mergeGeometries(stuecke, false) ?? geo;
    gesamt.computeVertexNormals();
    for (const g2 of stuecke) if (g2 !== gesamt) g2.dispose();

    const mat = getMaterial(materialId);
    const mesh = new THREE.Mesh(
      gesamt,
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: profil.rauheit,
        metalness: profil.glanz,
      })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(pos.x, pos.y, pos.z)
        .setLinearDamping(dampLin(massKg))
        .setAngularDamping(dampAng(massKg))
        .setCcdEnabled(true)
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(dims[0] / 2, dims[1] / 2, dims[2] / 2)
        .setMass(massKg)
        .setFriction(2.4)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
        .setRestitution(0),
      body
    );
    // `flat` markiert es als gepresst: es geht nicht noch einmal durch die Presse
    return this.register({
      materialId,
      massKg,
      mesh,
      body,
      shape: {
        kind: "box",
        dims,
        color: mat.color,
        flat: true,
        /*
         * Die Zusammensetzung wandert MIT DER FORM, nicht nur am Teil.
         *
         * Sie hing bis zum 16.09.2026 allein an `ScrapItem.composition`, und
         * das ueberlebt keinen Spielstand: Gesichert wird je Teil nur
         * `materialId`, `massKg` und `shape` (`core/save.ts`, `SavedItem`),
         * und wiederhergestellt wird ueber `spawnScrap`, das die
         * Zusammensetzung ausschliesslich aus `shape.zusammensetzung` liest
         * (oben in dieser Datei). Ein Presspaket hatte dort nichts stehen —
         * also war es nach jedem Laden ein Klumpen aus einem einzigen Stoff.
         *
         * Was das kostete, ist gemessen (`tools/pressbilanz.ts`): Ein Paket
         * aus dem KUPFER-LAGER (64 kg Kupfer + 217 kg Messing, zusammen
         * 281 kg) brachte 556,46 € — nach einem Neuladen 44,96 €, weil die
         * ganze Masse als Mischschrott zaehlte. Faktor 12,4, und zwar
         * unsichtbar: Am Paket war nichts zu sehen, was sich geaendert haette.
         *
         * Dieselbe Loesung wie bei `massiv` (E-042): Was ein Stueck IST,
         * gehoert an das Stueck und nicht an seine Entstehungsgeschichte.
         * Kostet ein Feld im Spielstand und keine Zeile in `save.ts`.
         */
        zusammensetzung: zusammensetzungAus(composition, materialId),
        /*
         * Und derselbe Weg fuer den Fraktionsmix (E-094): an die FORM, damit
         * er den Spielstand ueberlebt. Ein Paket aus 64 kg Kupfer und 217 kg
         * Messing heisst „Mischschrott" (keine Fraktion hat 95 %), ist aber
         * 1393,90 € wert — ohne dieses Feld waeren es nach dem Laden 44,96 €.
         */
        fraktionsmix: zusammensetzungAus(fraktionsmix, materialId),
      },
      composition,
      fraktionsmix,
    });
  }

  /** Teil in der Presse plattdrücken: Mesh stauchen, Kollider tauschen. */
  flattenItem(item: ScrapItem): boolean {
    if (!item.shape || item.shape.flat) return false;
    // Was in die Presse geht, hat danach keine Scheiben mehr.
    this.zerbrichGlas(item);
    item.shape.flat = true;
    // Zusätzlich leicht in die Breite gehen — gequetschtes Metall quillt aus
    item.mesh.scale.y = item.shape.kind === "wire" ? 0.5 : FLAT_SCALE_Y;
    item.mesh.scale.x *= 1.12;
    item.mesh.scale.z *= 1.12;
    while (item.body.numColliders() > 0) {
      this.world.removeCollider(item.body.collider(0), false);
    }
    this.world.createCollider(flatColliderDesc(item.shape).setMass(item.massKg), item.body);
    item.body.wakeUp();
    return true;
  }

  /**
   * Teil entfernen (Verkauf/Despawn).
   * @param destroyBody false, wenn Körper+Mesh schon anderweitig entsorgt wurden (Karosse)
   */
  /**
   * Kleinkram zusammenfassen, wenn zu viele Einzelteile herumliegen.
   *
   * Der Umschlagbetrieb füllt den Platz laufend, und jedes Teil kostet
   * Rechenzeit — bei 400 Körpern wäre auf einem Mittelklasse-Handy Schluss.
   * Statt die Bildrate einbrechen zu lassen, werden die leichtesten Teile
   * eines Haufens zu einem Bündel verschmolzen: gleiche Masse, gleiche
   * Fraktion, ein Körper statt vieler. Große Stücke bleiben unangetastet,
   * die machen den Reiz aus (Design 02.09.2026).
   *
   * @param limit    ab so vielen losen Teilen wird zusammengefasst
   * @param maxKg    nur Teile bis zu dieser Masse
   * @returns wie viele Teile eingespart wurden
   */
  consolidate(limit = 260, maxKg = 45): number {
    const klein = this.items.filter(
      (it) => it.body.isValid() && it.body.isDynamic() && it.massKg <= maxKg && !it.composition
    );
    if (this.items.length <= limit || klein.length < 6) return 0;

    // Nach Fraktion UND Zone gruppieren: Verschmolzen wird nur Gleiches mit
    // Gleichem am selben Ort — sonst ginge Sortenreinheit oder Zuordnung
    // verloren. Auch einsortierte Teile werden zusammengefasst; sie kosten
    // dieselbe Rechenzeit wie lose.
    const nachMaterial = new Map<string, ScrapItem[]>();
    for (const it of klein) {
      const key = `${it.materialId}|${it.containerId ?? "lose"}`;
      const l = nachMaterial.get(key);
      if (l) l.push(it);
      else nachMaterial.set(key, [it]);
    }
    let gespart = 0;
    for (const [key, list] of nachMaterial) {
      if (list.length < 6) continue;
      const materialId = key.split("|")[0];
      // Nur so viele zusammenfassen, wie über dem Limit liegen
      const nehmen = Math.min(list.length, Math.max(6, this.items.length - limit));
      const gruppe = list.slice(0, nehmen);
      const kg = gruppe.reduce((a, it) => a + it.massKg, 0);
      const p = gruppe[0].body.translation();
      const pos = new THREE.Vector3(p.x, p.y + 0.3, p.z);
      for (const it of gruppe) this.remove(it, true);
      this.spawnBale(materialId, kg, pos);
      gespart += gruppe.length - 1;
      if (this.items.length <= limit) break;
    }
    return gespart;
  }

  remove(item: ScrapItem, destroyBody = true): void {
    const idx = this.items.indexOf(item);
    if (idx < 0) return;
    this.items.splice(idx, 1);
    this.byHandle.delete(item.body.handle);
    if (this.highlighted === item) this.highlighted = null;
    if (destroyBody) {
      this.world.removeRigidBody(item.body);
      item.mesh.removeFromParent();
    }
  }

  itemByBody(body: RAPIER.RigidBody): ScrapItem | undefined {
    return this.byHandle.get(body.handle);
  }

  /** Nächstes greifbares Item am Sensor (für Highlight + Griff-Info). */
  findNearest(pos: THREE.Vector3, maxDist: number): ScrapItem | null {
    let best: ScrapItem | null = null;
    let bestD = maxDist;
    for (const item of this.items) {
      if (!item.body.isValid()) continue; // siehe `raeumeVerwaiste`
      const p = item.body.translation();
      const d = Math.hypot(p.x - pos.x, p.y - pos.y, p.z - pos.z);
      if (d < bestD) {
        bestD = d;
        best = item;
      }
    }
    return best;
  }

  /** Highlight (Greif-Hilfe Briefing Kap. 5.3): dezentes Aufhellen des Zielobjekts. */
  setHighlight(item: ScrapItem | null): void {
    if (this.highlighted === item) return;
    if (this.highlighted) setEmissive(this.highlighted.mesh, 0x000000);
    if (item) setEmissive(item.mesh, 0x2a2a1a);
    this.highlighted = item;
  }

  /**
   * Sicherheitsnetz gegen Physik-Explosionen: Klemmt ein Teil (Greifer, Presse,
   * Spawn in einem Kollider), löst Rapier das mit extremem Impuls auf und das
   * Teil verlässt den Platz. Harte Deckelung hält alles im Spiel.
   */
  /**
   * Geschwindigkeiten deckeln. Vorher flogen Teile beim Aufprall der Spinne
   * weit durch die Gegend — schwerer Schrott springt nicht, er rutscht.
   */
  private tempoVorher = new Map<number, number>();
  /** Wann ein Teil zuletzt einen Aufprall gemeldet hat (Sekunden seit Start) */
  private letzterAufprall = new Map<number, number>();
  private aufprallUhr = 0;
  private gesamtVorher = new Map<number, number>();
  /**
   * WURF (E-132). Tempo, mit dem ein Teil gerade GETRAGEN wird (quer, nach
   * oben), und der Schwung, den ein losgelassenes Teil behalten darf.
   *
   * `maxSpeedFor` bremst, was die Maschine ANSTOESST — dafuer ist es da. Ein
   * geworfenes Teil wird aber nicht angestossen, es wird losgelassen: Sein
   * Tempo hatte es schon, als es in der Spinne hing. Ohne diese Ausnahme fiel
   * ein 900-kg-Teil eine Bildzeit nach dem Loslassen von 4,73 auf 0,73 m/s
   * (Weite 0,55 statt 2,70 m, `tools/wurf.ts` Abschnitt 5).
   *
   * Die Grenze ist das Tempo, mit dem es zuletzt getragen wurde (plus die
   * gewohnte Zuwachsgrenze) — mehr als die Bewegung von Arm und Pendel gibt
   * es also nie. Sie kann nur fallen; sobald das Teil langsamer ist als
   * `maxSpeedFor`, gilt wieder die gewohnte Regel.
   */
  private getragen = new Map<number, { quer: number; hoch: number }>();
  private wurf = new Map<number, { quer: number; hoch: number }>();

  /**
   * Aufprall eines Teils (Wunsch 11.09.2026: Kollisionen mit Ladeflaeche,
   * Bordwaenden, Fallenlassen).
   *
   * Erkannt wird an der Vollbremsung: Wer in einem Schritt viel Tempo
   * verliert, ist auf etwas getroffen. Das braucht keine Kontaktereignisse in
   * der Physik — die kosten fuer jedes Teil im Haufen, und gebraucht wird nur
   * der eine Moment.
   *
   * @param wucht Tempoverlust in m/s — daraus macht der Ton die Lautstaerke
   */
  onAufprall: ((item: ScrapItem, wucht: number) => void) | null = null;
  /** Eine Scheibe ist zersprungen — Ort fuer Klang und Splitter. */
  onGlasBruch: ((x: number, y: number, z: number) => void) | null = null;

  /**
   * Ein Verbundteil in seine Fraktionen zerlegen.
   *
   * Das Stueck verschwindet und an seiner Stelle liegen so viele neue, wie es
   * Bestandteile hatte — jedes sortenrein und darum mehr wert. Anteile unter
   * fuenf Prozent fallen unter den Tisch: Ein Gramm Kupfer als eigenes Teil
   * herumliegen zu lassen, hilft niemandem.
   */
  zerlege(item: ScrapItem): ScrapItem[] | null {
    const shape = item.shape;
    if (!shape?.trennbar || !item.composition || item.composition.length < 2) return null;
    const p = item.body.translation();
    const summe = item.composition.reduce((a, c) => a + c.massKg, 0);
    if (summe <= 0) return null;
    const grosse = item.composition.filter((c) => c.massKg / summe >= 0.05);
    if (grosse.length < 2) return null;
    /*
     * Die Reste werden auf die verbleibenden Fraktionen verteilt, nicht
     * weggeworfen: Sonst verschwaende beim Zerlegen stillschweigend Masse —
     * beim Elektromotor waeren das die vier Prozent Alu. Was zu klein fuer ein
     * eigenes Stueck ist, bleibt eben am groesseren haengen.
     */
    const rest = grosse.reduce((a, c) => a + c.massKg, 0);
    const teile: Array<{ materialId: string; massKg: number }> = grosse.map((c) => ({
      materialId: c.materialId,
      massKg: (c.massKg / rest) * item.massKg,
    }));

    this.remove(item);
    const neu: ScrapItem[] = [];
    teile.forEach((c, i) => {
      const winkel = (i / teile.length) * Math.PI * 2;
      const ort = new THREE.Vector3(
        p.x + Math.cos(winkel) * 0.45,
        p.y + 0.25,
        p.z + Math.sin(winkel) * 0.45
      );
      neu.push(
        this.spawnScrap(c.materialId, c.massKg, trennForm(c.materialId, c.massKg, shape.name), ort)
      );
    });
    return neu;
  }

  /**
   * Scheiben zerspringen lassen. Gibt true zurueck, wenn tatsaechlich etwas
   * kaputtgegangen ist — sonst wuerde bei jedem Anstossen ein Klirren kommen,
   * auch beim zwanzigsten Mal am selben Wrack.
   */
  zerbrichGlas(item: ScrapItem): boolean {
    if (!item.shape || item.shape.glasKaputt) return false;
    const scheibe = item.mesh.getObjectByName("glas") as THREE.Mesh | undefined;
    if (!scheibe) return false;
    const ort = new THREE.Vector3();
    scheibe.getWorldPosition(ort);
    scheibe.removeFromParent();
    scheibe.geometry.dispose();
    item.shape.glasKaputt = true;
    this.onGlasBruch?.(ort.x, ort.y, ort.z);
    return true;
  }
  /**
   * Messschalter: Mit `true` gilt die Zuwachsgrenze nicht mehr. Nur fuer den
   * Vorher-Nachher-Vergleich im Labor; im Spiel bleibt sie an.
   */
  zuwachsGrenzeAus = false;

  /**
   * EINTRAEGE WEGRAEUMEN, DEREN KOERPER ES NICHT MEHR GIBT.
   *
   * DER HAERTESTE EINZELFEHLER AUS E-097, und er ist kein Grenzfall: Rapier
   * beantwortet `isDynamic()` auf einem entfernten Koerper nicht mit `false`,
   * sondern mit `RuntimeError: unreachable`. Gemessen am 17.09.2026
   * (`tools/absturz-probe.ts`): Danach ist die ganze Welt hin — der naechste
   * `world.step()` meldet „recursive use of an object detected which would
   * lead to unsafe aliasing in rust". Das Spiel steht, nicht nur das Teil.
   * Aufgetreten ist es bei Bild 19.766 eines kopflosen Dauerlaufs, also nach
   * rund 5,5 Minuten.
   *
   * WARUM DAS UEBERHAUPT VORKOMMEN KANN: `remove(item, false)` nimmt den
   * Eintrag aus der Liste und LAESST den Koerper stehen — das ist richtig so,
   * bei Wracks gehoert er dem Verbundteil, das ihn selbst abraeumt
   * (`composites.ts`). Der umgekehrte Fall darf es nicht geben, und trotzdem
   * gibt es ihn: Ein Koerper, der anderswo entfernt wurde, waehrend sein
   * Eintrag noch in `items` steht. Solange das so ist, fragt hier NIEMAND
   * mehr einen Koerper, ohne vorher `isValid()` gefragt zu haben.
   *
   * Die Frage kostet einen Aufruf je Teil und Bild. Gemessen ist sie nicht
   * spuerbar: `translation()` und `rotation()` laufen in `syncMeshes` ohnehin
   * zweimal je Teil.
   *
   * @returns wieviele Eintraege weggeraeumt wurden (0 ist der Normalfall)
   */
  raeumeVerwaiste(): number {
    let weg = 0;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i]!;
      if (item.body.isValid()) continue;
      this.items.splice(i, 1);
      /*
       * DIE NUMMER KOMMT AUS DER KARTE, NICHT AUS DEM KOERPER. `body.handle`
       * eines entfernten Koerpers liest Speicher, der nicht mehr ihm gehoert
       * — gemessen kam 2,1e−314 heraus, wo 0 stehen sollte. Wer damit
       * loeschte, traefe nichts oder das Falsche. Ueber die Karte ist es die
       * Nummer, unter der dieses Teil wirklich eingetragen war.
       */
      for (const [h, it] of this.byHandle) {
        if (it !== item) continue;
        this.byHandle.delete(h);
        this.tempoVorher.delete(h);
        this.gesamtVorher.delete(h);
        this.getragen.delete(h);
        this.wurf.delete(h);
        this.letzterAufprall.delete(h);
      }
      if (this.highlighted === item) this.highlighted = null;
      item.mesh.removeFromParent();
      weg++;
    }
    return weg;
  }

  clampSpeeds(dt = 1 / 60): void {
    this.aufprallUhr += dt;
    // Erst die Leichen aus der Liste, dann rechnen — sonst stuerzt die
    // Physik in der naechsten Zeile ab (siehe `raeumeVerwaiste`).
    this.raeumeVerwaiste();
    for (const item of this.items) {
      if (!item.body.isDynamic()) {
        // Getragene Teile sind kinematisch. Beim Loslassen sollen sie ihren
        // Schwung behalten, also faengt die Zuwachsregel bei ihnen neu an.
        this.tempoVorher.delete(item.body.handle);
        this.gesamtVorher.delete(item.body.handle);
        // E-132: so schnell wird es getragen — das ist beim Loslassen der Wurf
        const vt = item.body.linvel();
        this.getragen.set(item.body.handle, { quer: Math.hypot(vt.x, vt.z), hoch: Math.max(vt.y, 0) });
        this.wurf.delete(item.body.handle);
        continue;
      }
      // Trägheit nach Masse: Die Spinne ist ein kinematischer Körper und
      // überträgt beim Anschlagen praktisch beliebig viel Schwung — ohne
      // Grenze fliegt ein Motorblock so weit wie ein Blech. Ein schwerer
      // Brocken darf sich deshalb nur langsam bewegen lassen, ein leichter
      // schneller. Das erzeugt den Widerstand, den Masse haben muss.
      const maxLinear = maxSpeedFor(item.massKg);
      const maxAngular = maxLinear * 1.4;
      const v = item.body.linvel();
      // Zuwachs deckeln: nur was in diesem Schritt dazukommt, nicht der Stand.
      // Frisch losgelassene Teile stehen noch nicht in der Liste — ihr Schwung
      // ist gewollt und geht ungebremst durch.
      const handle = item.body.handle;
      // E-132: eben noch getragen, jetzt frei — losgelassen, also ein Wurf
      const trug = this.getragen.get(handle);
      if (trug) {
        this.getragen.delete(handle);
        this.wurf.set(handle, { quer: trug.quer + MAX_ZUWACHS, hoch: trug.hoch + MAX_ZUWACHS });
      }
      /*
       * Nur QUER deckeln, nie senkrecht.
       *
       * Die erste Fassung bremste den Zuwachs in alle Richtungen — und
       * verhinderte damit genau das, was ein steckengebliebenes Teil rettet:
       * Der Loeser drueckt es mit einem kraeftigen Stoss nach oben aus dem
       * Boden heraus. Gebremst sank es stattdessen weiter ein (Befund
       * 11.09.2026: "Objekte verschwinden im Boden").
       *
       * Weggeschleudert wird ohnehin quer, nicht nach oben — die Bremse trifft
       * also weiterhin den Fall, um den es geht.
       */
      const quer0 = Math.hypot(v.x, v.z);
      const vorher = this.tempoVorher.get(handle);
      if (
        !this.zuwachsGrenzeAus &&
        vorher !== undefined &&
        quer0 > vorher + MAX_ZUWACHS &&
        quer0 > 1e-4
      ) {
        const f = (vorher + MAX_ZUWACHS) / quer0;
        item.body.setLinvel({ x: v.x * f, y: v.y, z: v.z * f }, true);
      }
      // Quer und nach oben wird gedeckelt, nach unten nicht: Fallen ist
      // Schwerkraft und keine Uebertragung aus der Spinne.
      const quer = Math.hypot(v.x, v.z);
      let grenzeQuer = maxLinear;
      let grenzeHoch = Math.max(maxLinear * 0.55, 1.2);
      const wurf = this.wurf.get(handle);
      if (wurf) {
        // nur fallend: Was es im Flug verliert, bekommt es nicht wieder
        wurf.quer = Math.min(wurf.quer, Math.max(quer, maxLinear));
        wurf.hoch = Math.min(wurf.hoch, Math.max(v.y, 0));
        if (wurf.quer <= maxLinear) {
          this.wurf.delete(handle);
        } else {
          grenzeQuer = wurf.quer;
          grenzeHoch = Math.max(grenzeHoch, wurf.hoch);
        }
      }
      const f = quer > grenzeQuer ? grenzeQuer / quer : 1;
      /*
       * Nach oben noch enger als quer. Ein geschobenes Teil rutscht und
       * kippt; es huepft nicht auf. Die Aufwaertsspitzen kamen fast alle aus
       * dem Loeser, nicht aus dem Spiel — zusammen mit dem Querwert ergaben
       * zwei volle Grenzen die gemessenen 9,33 m/s.
       */
      /*
       * Die Aufwaertsgrenze haengt NICHT mehr an `maxLinear`.
       *
       * Seit die Massenkurve bis 0,35 m/s durchlaeuft, waere sie fuer schwere
       * Teile auf 0,19 m/s gefallen — und genau damit kaeme ein eingesunkenes
       * Stueck nie wieder heraus. Der Loeser drueckt es mit einem kraeftigen
       * Stoss nach oben; das war schon einmal ein Fehler (Befund 11.09.2026:
       * „Objekte verschwinden im Boden"). 1,2 m/s bleiben immer uebrig.
       */
      const y = Math.min(Math.max(v.y, -FALL_MAX), grenzeHoch);
      if (f < 1 || y !== v.y) {
        item.body.setLinvel({ x: v.x * f, y, z: v.z * f }, true);
      }
      const w = item.body.angvel();
      const a = Math.hypot(w.x, w.y, w.z);
      if (a > maxAngular) {
        const f = maxAngular / a;
        item.body.setAngvel({ x: w.x * f, y: w.y * f, z: w.z * f }, true);
      }
      const jetzt = item.body.linvel();
      // Aufprall: In einem Schritt viel Tempo verloren. Der Betrag zaehlt in
      // alle Richtungen — ein Teil faellt senkrecht auf die Ladeflaeche.
      if (this.onAufprall) {
        const vorherGesamt = this.gesamtVorher.get(handle);
        const jetztGesamt = Math.hypot(jetzt.x, jetzt.y, jetzt.z);
        if (vorherGesamt !== undefined) {
          const verlust = vorherGesamt - jetztGesamt;
          const letzte = this.letzterAufprall.get(handle) ?? -9;
          if (verlust > AUFPRALL_DV && this.aufprallUhr - letzte > AUFPRALL_PAUSE_S) {
            this.letzterAufprall.set(handle, this.aufprallUhr);
            this.onAufprall(item, verlust);
          }
          // Glas ist empfindlicher als das Ohr: Es bricht schon darunter.
          if (verlust > GLAS_BRUCH_DV) this.zerbrichGlas(item);
        }
        this.gesamtVorher.set(handle, jetztGesamt);
      }
      this.tempoVorher.set(handle, Math.hypot(jetzt.x, jetzt.z));
      // Ausreißer einsammeln: Material geht nie verloren, es landet auf der
      // Annahmefläche. Die Grenzen liegen weit außerhalb der LKW-Route.
      const p = item.body.translation();
      if (
        !isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z) ||
        Math.abs(p.x) > 45 || Math.abs(p.z) > 60 || p.y < -5 || p.y > 60
      ) {
        item.body.setTranslation(
          { x: (Math.random() - 0.5) * 4, y: 3 + Math.random() * 2, z: 1 + (Math.random() - 0.5) * 4 },
          true
        );
        item.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        item.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
    }
  }

  syncMeshes(): void {
    for (const item of this.items) {
      if (!item.body.isValid()) continue; // siehe `raeumeVerwaiste`
      const p = item.body.translation();
      const r = item.body.rotation();
      item.mesh.position.set(p.x, p.y, p.z);
      item.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }
}

/** Emissive auf allen Standard-Materialien eines Objekts setzen (Glas auslassen). */
function setEmissive(obj: THREE.Object3D, hex: number): void {
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
      if (!o.material.transparent) o.material.emissive.setHex(hex);
    }
  });
}
