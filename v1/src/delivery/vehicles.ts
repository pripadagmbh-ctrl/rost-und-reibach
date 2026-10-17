import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  randomCargo,
  type ItemManager,
  type ScrapItem,
  type ScrapShape,
} from "../world/scrapItems";
import type { CompositeManager, CarComposite } from "../dismantle/composites";
import { WRACKDATEN } from "../dismantle/carDef";
import { WEIGH_Z, KAFFEE_THEKE } from "../world/yard";
import { baueKundenfigur, baueHund, type Kundenfigur } from "../world/kundenfigur";
import { AUSSEHEN_NEUTRAL } from "./aussehen";
import type { Box } from "../world/boxen";
import { packeLadung, stueckMass, deckelVolumen } from "./ladung";
import { spaeneCargo, spaeneDrehung, spaeneSchuettung } from "../world/spaene";

/**
 * So lange haelt JEDER Laster bei der Ausfahrt auf der Waage (s).
 *
 * Bis E-119 nur der Abholer. Seit E-120 (Patrick, 06.10.2026: „Er soll immer
 * noch an der Waage halten") alle, in beiden Spielarten.
 */
const WIEGE_HALT_S = 6;
/**
 * Ab dieser Geschwindigkeit liegt Ladung NICHT ruhig (m/s).
 *
 * Eine Zahl fuer zwei Fragen: Hat sich die Fuhre des Anlieferers vor der
 * Einfahrt gesetzt (`cargoAtRest`)? Liegt die Ladung des Abholers ruhig,
 * bevor er voll losfaehrt (E-120)? Der Wert stand vorher nur in
 * `cargoAtRest`.
 */
const LADUNG_RUHIG_MS = 0.9;
/**
 * So lange muss der Abholer voll UND ruhig sein, bevor er von selbst
 * losfaehrt (s). SW (E-120): Drei Sekunden reichen, damit ein gerade
 * hineingeworfenes Teil zur Ruhe kommt und der Spieler sieht, dass der Wagen
 * voll ist — kurz genug, dass niemand auf ihn wartet.
 */
const VOLL_WARTE_S = 3;
/**
 * Wie oft „voll und ruhig" geprueft wird (s). SW (E-120), derselbe Takt wie
 * die Ladeanzeige des Abholers (`LADUNG_TAKT_S` in main.ts): viermal je
 * Sekunde ist schneller, als man ablaedt. Gemessen am 06.10.2026 kostet EINE
 * Pruefung bei 260 Teilen auf dem Platz rund 0,86 ms (Node, Desktop) — jedes
 * Bild gerechnet waere das so viel wie ein ganzer Physikschritt.
 */
const VOLL_PRUEF_S = 0.25;
/**
 * Leergewicht des Abrollcontainers, den der Abholer mitbringt (kg).
 *
 * DAS IST DIE TARA SEINES LIEFERSCHEINS (E-064). Ansage Patrick, 15.09.2026:
 * „auch abholer leer wiegen" — auf einem echten Platz wiegt der Abholer leer
 * rein und voll raus, und die Differenz ist, was er mitnimmt.
 *
 * Die Waage in diesem Spiel wiegt, WAS AUF DER LADEFLAECHE LIEGT, und nicht
 * den Lastwagen darunter (`cargoMassKg`: „Masse, die tatsaechlich AUF der
 * Ladeflaeche liegt"). Daran wird nichts geaendert — der Ankaufspreis der
 * Anlieferer haengt an genau dieser Zahl. Der Container aber LIEGT auf der
 * Flaeche, und er wiegt etwas; deshalb ist er die Tara, und beide Wiegungen
 * bleiben dieselbe Rechnung.
 *
 * Die Zahl (SW): Die Mulde ist 5,40 m lang, 2,70 m breit und 1,25 m hoch
 * (`vehicleModel.ts`, `bedLen` und die Wandhoehe des Abholers) — also rund
 * 18 m³. Ein offener 18-m³-Abrollcontainer aus 3-mm-Blech wiegt 1,6 bis 1,9 t;
 * 1.800 kg liegt mittig. Wer sie auf 0 setzt, bekommt einen Lieferschein, auf
 * dem „Tara 0 kg" steht — richtig gerechnet und trotzdem falsch gelesen.
 */
const ABHOLER_CONTAINER_KG = 1800;
/*
 * DER ABSETZKIPPER (E-141) — Tempi und Winkel, alle SW.
 *
 * Ein echter Absetzkipper braucht fuer Ab- und Aufnehmen je eine halbe
 * Minute; im Spiel ist es etwa ein Drittel davon, damit man zusieht, aber
 * nicht wartet.
 */
/** Schwenktempo der Arme (rad/s): 17 Grad/s, ein ganzer Schwenk rund 8 s. */
const ARM_TEMPO = 0.3;
/** Kipptempo der Mulde an den Ketten (rad/s): 100 Grad in 3,5 s. */
const KIPP_TEMPO = 0.5;
/**
 * So weit kippt die Mulde (rad): 110 Grad — ueber die Senkrechte hinaus, der
 * Boden haengt also ueber. Bei 100 Grad blieb gemessen ein Drittel der Stuecke
 * liegen (Reibung 2,2, „Schrott verhakt sich"). Die Oberkante bleibt dabei
 * 0,4 m ueber dem Boden (`muldenPose`).
 */
const MULDE_KIPP_MAX = (110 * Math.PI) / 180;
/**
 * Der Fahrer ruettelt die gekippte Mulde: bis 7 Grad zurueck, 1,5 Mal je
 * Sekunde, 3,5 s lang (SW). Am Rand der Mulde (1,9 m vom Zapfen) sind das
 * hoechstens 2,2 m/s — genug, dass verhakte Stuecke loskommen, zu wenig fuer
 * einen Wurf. Gemessen (`tools/absetzlauf.ts`): 4 Grad liessen in zwei von
 * drei Laeufen ein Viertel der Fuhre in der Mulde, 7 Grad 0 bis 20 %; das
 * schnellste Stueck dabei 32 km/h (der Kipper: Median 19, Spitze 279).
 */
const RUETTEL_AMPL = (7 * Math.PI) / 180;
const RUETTEL_HZ = 1.5;
/**
 * Armwinkel beim Auskippen (rad, gegen +z): 140 Grad. Die Mulde haengt dann
 * hinter dem Wagen mit der Unterkante 1,3 m ueber dem Boden, und auch gekippt
 * bleibt ihre Oberkante darueber (0,4 m) — gerechnet mit `muldenPose`.
 */
const KIPP_ARMWINKEL = (140 * Math.PI) / 180;
/** So lange haengt die gekippte Mulde, bis auch das Nachrutschende draussen ist (s). */
const MULDE_LEER_HALTEN_S = 3.5;

/**
 * EINE ABGESETZTE MULDE (E-141): Sie steht hinter dem Abladeplatz, bis der
 * Spieler sie leer hat — dann holt ein Absetzkipper sie ab.
 */
export interface AbgesetzteMulde {
  /** Rahmen der Mulde in der Szene (`absetzmulde.ts`), Netz darin. */
  group: THREE.Group;
  /** Ihr Koerper: kinematisch, steht still, fuenf Kollider. */
  body: RAPIER.RigidBody;
  /** Wem sie gehoert — derselbe Kunde holt sie wieder. */
  kunde: CustomerProfile | null;
  /** Wie lange sie steht (s). */
  standS: number;
  /** Wie lange sie schon leer ist (s). */
  leerS: number;
}

/**
 * Wie oft der Absetzkipper die Mulde absetzt statt sie auszukippen (E-141).
 *
 * SW 50 : 50. Beides gehoert zum Alltag eines Containerdienstes, und beides
 * ist eine eigene Aufgabe am Bagger: Ausgekippt liegt die Fuhre als Haufen auf
 * der Annahmeflaeche, abgesetzt muss man sie Stueck fuer Stueck aus einer
 * engen Mulde greifen. Eine Regel „nach Ladung" (etwa: sortenrein absetzen)
 * machte eine der beiden Aufgaben selten — und welche, haenge an der
 * Kundschaft statt am Spiel.
 */
const ABSETZEN_ANTEIL = 0.5;
/** So lange muss die abgesetzte Mulde leer sein, bevor sie geholt wird (s, SW). */
const MULDE_LEER_WARTE_S = 4;
/**
 * Spaetestens dann wird sie geholt, auch wenn noch etwas darin liegt (s, SW:
 * sechs Minuten). Solange sie steht, ist der Abladeplatz zu — ohne Frist
 * stuende der Hof still, wenn niemand sie leert. Was dann noch drin liegt,
 * faehrt mit ihr vom Hof (E-082: wer nicht abgeladen hat, nimmt mit).
 */
const MULDE_FRIST_S = 360;
/** Bis zu dieser Masse gilt die Mulde als leer (kg) — wie `isUnloaded`. */
const MULDE_LEER_KG = 20;

/** Rueckwaertstempo beim Einparken (m/s) — Schrittgeschwindigkeit. */
const PARK_RUECK_SPEED = 1.6;
/*
 * Hier stand `LADUNG_UEBERSTAND = 0.35` als zweite Abschrift. Seit E-126 gibt
 * es zwei Hoehenregeln (Schuettgut, Einzelstueck); beide stehen an EINER
 * Stelle: `fuellgrad.ladeHoeheGrenze`.
 */
/** Oberkante des Flaechenbodens im Ladeflaechen-System. */
const LADE_BODEN = 0.1;
/** Rand vorn und hinten, damit nichts ueber die Kante steht. */
const LADE_RAND = 0.2;
/** Gehtempo des Fahrers (m/s) */
const FAHRER_TEMPO = 1.5;
import { alleHindernisse } from "../world/obstacles";
import {
  fahrzeugUmriss,
  zugwagenUmriss,
  anhaengerUmriss,
  poseAuf,
  tiefsteDurchdringung,
  UMRISS_TOLERANZ,
} from "./umriss";
import {
  folgeSchritt,
  fortschrittsPunkt,
  LENK_RATE,
  type Fahrwerk,
  type Lage,
} from "./lenkung";
import { BAGGER_STAND } from "../world/baggerstand";
import { lagerMuldeFuer, type ContainerConfig } from "../world/containers";
import {
  rollCustomer,
  rollAnlieferung,
  vehicleForCustomer,
  fahrerfunk,
  anliefererfunk,
  ABHOLFAHRER,
  type Fahrerlage,
  type Anliefererlage,
  type CustomerProfile,
} from "./customers";
import {
  buildVehicleModel,
  wandHoehe,
  brueckenKeilEcken,
  type Rad,
  type LenkRad,
  type VehicleModelParts,
} from "./vehicleModel";
import { muldenPose, absetzSchwenk, imTrog, MULDE_BODEN } from "./absetzmulde";
import { Federung, federungsDatenFuer } from "./federung";
import {
  ANHAENGER_HALB_BREITE,
  ANHAENGER_WAND,
  WRACK_KG,
  FUELL_KLASSEN,
  NUTZLAST,
  ladeHoeheGrenze,
  ABSETZMULDE,
  ABSETZ_HALB_BREITE,
  ABSETZ_WAND,
  type Aufbau,
} from "./fuellgrad";
import { getMaterial } from "../materials/catalog";
import type { PlatzinventarPort } from "./platzinventarAbholung";

/**
 * Anlieferungen M3: Kundenfahrzeuge auf fester Route (kinematisch).
 * - KIPPER: Mulde hebt sich, die Ladung rutscht physisch herunter.
 * - PRITSCHE: parkt — der Spieler lädt selbst mit der Spinne ab; leer → Abfahrt.
 * - TIEFLADER: Pritsche mit Wrack (Auto), Spieler hebt es herunter.
 * Die Ladung liegt als echte Physik-Objekte auf der (kinematischen) Ladefläche
 * und fährt per Reibung mit.
 */

export type DeliveryKind = "kipper" | "pritsche" | "wrack" | "abholer" | "pkw" | "absetzer";

import {
  ROUTE_IN_FWD,
  neueAbladestelle,
  routeApproach,
  routeInRev,
  routeOut,
  PICKUP_IN_FWD,
  neueAbholstelle,
  abholPlatzFuer,
  type AbholPlatz,
  pickupApproach,
  pickupInRev,
  pickupOut,
  bayApproach,
  bayInRev,
  bayOut,
  PARK_SLOTS,
  routeToPark,
  routeParkRueck,
  routeParkRueckVon,
  parkAusfahrt,
  anfahrtVomPlatz,
  rangierAbsetzplatz,
  absetzAusfahrt,
  PARK_TIME_S,
  SPEED,
  FIRST_DELAY_S,
  ANSTEH_ERSTER_S,
  NEXT_DELAY_S,
  BLOCK_RADIUS,
  BLOCKING_MASS_KG,
  HONK_AFTER_S,
  BED_HALF_W,
  WORK_ZONES,
  BLOCK_GIVEUP_S,
  bedLenFor,
  faehrtInsSilo,
  TIP_ANGLE,
  TIP_CREEP_M,
  TIP_CREEP_SPEED,
  CRANE_SWING,
  ABLADE_SPUR_X,
  ABLADE_HALT_Z,
} from "./routes";

type Phase =
  | "settleCargo"
  | "in"
  | "weighIn"
  | "approach"
  | "shiftPause"
  | "reverseIn"
  | "pauseBeforeUnload"
  | "tipping"
  | "tipHold"
  | "tipCreep"
  | "tipBack"
  | "waitUnload"
  | "waitLoad"
  | "nudging"
  | "toPark"
  | "parkRueck"
  | "parked"
  | "ausfaedeln"
  | "out"
  // Absetzkipper (E-141)
  | "muldeHeben"
  | "muldeRuhe"
  | "muldeKippen"
  | "muldeLeeren"
  | "muldeSenken"
  | "muldeLoesen"
  | "armeEin"
  | "muldeHolen"
  | "muldeAufnehmen";

interface Cargo {
  items: ScrapItem[];
  car: CarComposite | null;
}

/** Ladung fährt während des Transports kinematisch verriegelt mit (kein
 *  Herunterfallen bei Kurven) und wird erst am Abladepunkt freigegeben. */
interface RidingBody {
  body: RAPIER.RigidBody;
  localPos: THREE.Vector3;
  localQuat: THREE.Quaternion;
}

class DeliveryVehicle {
  readonly group = new THREE.Group();
  private bedGroup = new THREE.Group();
  private chassisBody: RAPIER.RigidBody;
  private bedBody: RAPIER.RigidBody;
  private phase: Phase = "settleCargo";
  private routeS = 0;
  /**
   * Wie schnell dieser Wagen lenken darf (rad/s).
   *
   * Steht als Feld und nicht als Konstante da, weil jeder Waechter dieser
   * Reparatur seine GEGENPROBE braucht: `Infinity` ist Zeichen fuer Zeichen
   * der Sprungzustand von vor dem 16.09.2026. Ein Prueflauf, der den alten
   * Stand nicht mehr melden kann, prueft nichts (Lehre aus E-073).
   */
  lenkrate = LENK_RATE;
  /**
   * Faedelt dieser Wagen in eine Strecke EIN — oder springt er auf sie?
   *
   * `false` ist Zeichen fuer Zeichen der Zustand von vor dem 16.09.2026:
   * `nearestS` liefert die Bogenlaenge des naechstgelegenen Routenpunktes,
   * und der naechste Rechenschritt SETZT den Wagen dorthin — quer ueber den
   * Abstand, der dazwischen liegt. Gemessen (`tools/ausfaedeln.ts`) sind das
   * beim Abfahren vom Warteplatz 5,59 / 8,74 / 6,63 m in EINEM Bild, also bis
   * zu 524 m/s. Das ist dieselbe Bauart wie der Kipper-Katapult (E-073) und
   * der Rangierknick (E-084): ein Koerper wird VERSETZT statt BEWEGT, Rapier
   * leitet daraus eine Geschwindigkeit ab und raeumt die Durchdringung des
   * naechsten Bildes in einem Schlag aus.
   *
   * Es steht als Feld und nicht als Konstante da, weil jeder Waechter dieser
   * Reparatur seine GEGENPROBE braucht (Lehre aus E-062). Im Spiel wird es
   * nie umgestellt.
   */
  faedeltAus = true;
  /**
   * Lenkeinschlag der Vorderraeder (rad) — E-140. Er bleibt stehen, wenn der
   * Wagen haelt, und wird beim naechsten Anfahren weitergedreht.
   */
  private lenk = 0;
  /** Wo die Achsen sitzen; daraus faehrt das Einspurmodell (`lenkung.ts`). */
  private fahrwerk: Fahrwerk;
  /** Die Teile der Vorderraeder, die sichtbar einschlagen. */
  private lenkRaeder: LenkRad[] = [];
  private phaseT = 0;
  private tip = 0;
  cargo: Cargo = { items: [], car: null };
  /** Anhänger des PKW — eigener Körper, Gelenk an der Kupplung */
  private trailer: THREE.Group | null = null;
  private trailerYawRel = 0;
  /* ------------------------------------------- Absetzkipper (E-141) --- */
  /** Arme, Ketten und Mulde — nur beim Absetzkipper. */
  private absetz: VehicleModelParts["absetz"] = null;
  /**
   * Was dieser Absetzkipper mit seiner Mulde tut: auskippen, absetzen (der
   * Spieler leert sie) oder eine abgesetzte holen. Gesetzt vom Fuhrpark.
   */
  absetzModus: "kippen" | "absetzen" | "holen" = "kippen";
  /** Schwenk der Arme aus der Fahrstellung (rad). */
  private armSchwenk = 0;
  /** Kippwinkel der Mulde an den Ketten (rad). */
  private muldeKipp = 0;
  /** Haengt eine Mulde an den Ketten? */
  private muldeDran = true;
  /** Die abgesetzte Mulde, die dieser Wagen holt. */
  private holMulde: AbgesetzteMulde | null = null;
  /** Beim Holen: Ueberblendung von der Stand- in die Haengelage (0..1). */
  private muldeAnheben = 1;
  private muldeStandLage: { pos: THREE.Vector3; quat: THREE.Quaternion } | null = null;
  /**
   * Beim Absetzen: von der Haengelage auf den Boden (Wagenrahmen). Die
   * Haengelage stimmt im Wagenrahmen, aber der Wagen federt und nickt unter
   * der Last — gemessen schwebte die Mulde sonst 11 cm ueber dem Boden.
   */
  private muldeAufsetzen: { von: THREE.Vector3; vonQ: THREE.Quaternion; nach: THREE.Vector3; nachQ: THREE.Quaternion } | null = null;
  /** Meldet die abgesetzte Mulde an den Fuhrpark. */
  onMuldeAbgesetzt: ((m: AbgesetzteMulde) => void) | null = null;
  /** Meldet, dass sie wieder am Haken haengt. */
  onMuldeGeholt: (() => void) | null = null;

  /** Ein Absetzkipper, der nur eine Mulde holt: kein Ankauf, keine Verhandlung. */
  get holtNur(): boolean {
    return this.absetz !== null && this.absetzModus === "holen";
  }

  /** Ladekran der Händler — nur Bild, schwenkt beim Andocken zur Seite */
  private crane: THREE.Group | null = null;
  private craneSwing = 0;

  /**
   * Zu welcher Seite der Ladekran schwenkt: IMMER vom Bagger weg.
   *
   * Ansage Patrick, 15.09.2026: „LKW-Kran immer vom Bagger weg bewegen."
   * Vorher wurde die Seite beim Erzeugen gewürfelt — jede zweite Fuhre hängte
   * ihren Ausleger also in den Arbeitsbereich. Ein Fahrer dreht seinen Kran
   * zur Straßenseite, nicht dorthin, wo gearbeitet wird.
   *
   * Die Seite wird GERECHNET, nicht je Halteplatz eingetragen. Die Fahrzeuge
   * halten an vier verschiedenen Stellen (Abladeplatz, Silo-Gasse, Warteplätze,
   * Waage), und „weg vom Bagger" ist an jeder eine andere Richtung — als
   * Tabelle stünde sie beim nächsten Umzug des Baggers wieder falsch.
   *
   * DIE RECHNUNG, in drei Schritten und ohne gegriffene Vorzeichen.
   *
   * 1. Der Ausleger zeigt bei Schwenkwinkel 0 nach lokal −z (über die
   *    Ladefläche, Transportstellung). Eine Drehung um die Hochachse um φ
   *    bildet ihn auf (−sin φ, 0, −cos φ) ab: POSITIVER Schwenk bringt die
   *    Spitze nach lokal −x.
   * 2. Die Kabine schaut nach lokal +z, oben ist +y. Rechts ist damit
   *    vorwärts × oben = ẑ × ŷ = −x̂ — lokal −x ist die RECHTE Seite,
   *    lokal +x die linke. Positiver Schwenk heißt also: Kran nach rechts.
   * 3. Auf welcher Seite steht der Bagger? Der Vektor zu ihm, projiziert auf
   *    die lokale x-Achse (dieselbe Umrechnung wie in `steigeAus`):
   *
   *      d        = Bagger − Fahrzeug, in Weltkoordinaten
   *      d · x̂lok = d.x·cos(gier) − d.z·sin(gier)
   *
   *    Ist das positiv, steht der Bagger LINKS — dann schwenkt der Kran nach
   *    rechts, also mit positivem Winkel.
   */
  /**
   * STEHT DER KRAN AUS DEM WEG? Erst dann darf die Mulde steigen (E-076).
   *
   * Der Ausleger liegt im Transportzustand ÜBER der Ladeflaeche. Hebt sich
   * die Mulde, waehrend er dort noch liegt, faehrt ihr Boden mitten durch ihn
   * — gemessen mit `tools/fahrzeug-durchdringung.ts` 12,0 cm bei 20 Grad
   * Kippwinkel. Genau das war Patricks Befund vom 13.09.2026 („dass die
   * Ladeflaeche durch den Kran laeuft").
   *
   * Die Zeiten passten bis heute nicht zusammen: Der Schwenk um 78 Grad
   * dauert bei 0,5 rad/s ganze 2,7 s, die Pause vor dem Abladen aber nur
   * 1,2 s. Der Wagen fing also IMMER an zu kippen, waehrend der Kran noch
   * unterwegs war. Jetzt beginnt der Schwenk schon beim Zuruecksetzen, und
   * gekippt wird erst, wenn er steht.
   *
   * Wagen ohne Kran antworten sofort mit `true` — fuer sie aendert sich nichts.
   */
  private get kranSteht(): boolean {
    if (!this.crane) return true;
    // 0,02 rad = 1,1 Grad: der Schwenk laeuft in Schritten von dt x 0,5 rad/s
    return Math.abs(this.craneSwing) >= CRANE_SWING - 0.02;
  }

  private get craneSide(): 1 | -1 {
    const dx = BAGGER_STAND.x - this.group.position.x;
    const dz = BAGGER_STAND.z - this.group.position.z;
    const yaw = this.group.rotation.y;
    const baggerLinks = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    if (!Number.isFinite(baggerLinks)) return 1;
    return baggerLinks > 0 ? 1 : -1;
  }
  /** Restweg des gekippten Anziehens (Phase tipCreep) */
  private creepLeft = 0;
  /** true, solange die Mulde waehrend der Abfahrt noch heruntergefahren wird */
  private senken = false;
  done = false;
  private bedLen: number;
  /* ------------------------------------------------------- Federung ------ */
  /**
   * Die Federung dieses Wagens (siehe `federung.ts`).
   *
   * Sie bewegt nichts von sich aus. Der Ablauf füttert sie mit drei Dingen —
   * der Last auf der Fläche, den Stößen aufgesetzter Teile und dem eigenen
   * Tempo — und liest daraus zurück, wie tief der Wagen an welcher Längsstelle
   * liegt. Dass die Ladung mitfedert, kostet keine Zeile: Sie hängt
   * kinematisch an der Ladeflächengruppe und wird ohnehin jedes Bild aus deren
   * Weltlage nachgeführt.
   */
  private federung: Federung;
  /** Die Räder — sie bleiben stehen, wenn sich der gefederte Wagen senkt. */
  private raeder: Rad[] = [];
  /** Was die Federung senkt und neigt: der ganze LKW, beim Gespann der Anhänger. */
  private federZiel: THREE.Object3D;
  /** Hebt sich der Ursprung der gefederten Gruppe mit? (Beim Anhänger nicht — die Kupplung hält ihn.) */
  private federHebt: boolean;
  private federLetztePos = new THREE.Vector3();
  /** Restzeit bis zur nächsten Lastmessung */
  private lastProbeT = 0;
  /** Körper, die bei der letzten Messung auf der Fläche lagen — für die Stoßerkennung */
  private aufFlaeche = new Set<number>();
  private readonly bedInv = new THREE.Matrix4();
  private readonly probePos = new THREE.Vector3();
  private riding: RidingBody[] = [];
  private cargoReleased = false;
  private blockedT = 0;
  private honked = false;
  private gaveUpWaiting = false;
  /** Aufklappbare Bordwände (links/rechts) */
  private sideWalls: Array<{
    hinge: THREE.Group;
    mesh: THREE.Mesh;
    body: RAPIER.RigidBody;
    dir: -1 | 1;
  }> = [];
  private sideOpen = 0; // 0 = zu, 1 = ganz aufgeklappt
  private sideOpenTarget = 0;
  private tailGate: { hinge: THREE.Group; mesh: THREE.Mesh; body: RAPIER.RigidBody } | null = null;
  /** Bruttogewicht der Anlieferung (Wiegung bei der Einfahrt) */
  bruttoKg = 0;
  /**
   * Leergewicht dieses Abholers, gewogen bei der EINFAHRT (kg).
   *
   * Nur der Abholer hat eine: Er kommt leer herein, und erst beim Hinausfahren
   * steht fest, was er mitnimmt. Der Anlieferer macht es andersherum — der
   * wiegt brutto herein und tariert beim Hinausfahren.
   */
  taraKg = 0;
  private weighedOut = false;
  /** Restzeit des Kontrollhalts auf der Waage (nur Abholer) */
  private wiegeHaltS = 0;
  /** true, sobald der Abhol-LKW abfahrbereit ist (Spieler drückt V) */
  private releaseRequested = false;
  private justDeparted = false;

  /** einmalig true, wenn der Abholer gerade losgefahren ist (→ abrechnen) */
  consumeDeparted(): boolean {
    if (!this.justDeparted) return false;
    this.justDeparted = false;
    return true;
  }

  /**
   * Vom Hof schicken. Geht nur, solange noch nichts abgeladen ist — wer schon
   * gekippt hat, muss auch bezahlt werden.
   */
  /**
   * Ein Stück vorfahren, damit man an Schrott herankommt, der unter dem
   * Fahrzeug liegt. Fährt entlang der Ausfahrtsroute und hält wieder an.
   */
  nudgeForward(meters = 3.5): boolean {
    if (this.phase === "out" || this.phase === "nudging" || this.phase === "ausfaedeln") {
      return false;
    }
    if (this.absetz && this.armSchwenk > 0) return false; // Arme draussen (E-141)
    this.nudgeReturn = this.phase;
    /*
     * Das Ziel bleibt, wo es war. Der Punkt, auf den `nearestS` zeigt, liegt
     * definitionsgemaess AUF der Strecke — wer dorthin faehrt, bekommt beim
     * naechsten `nearestS` dieselbe Bogenlaenge zurueck. Das Ausfaedeln
     * verschiebt die Zielmarke also nicht, es holt nur den Weg dorthin nach.
     */
    this.nudgeTargetS = this.nearestS(this.routeOut) + meters;
    this.starteAusfaedeln(this.routeOut, "nudging", this.nearestS(this.routeOut));
    return true;
  }

  /**
   * Abladeplatz räumen. Wer einen Warteplatz zugewiesen bekommen hat, stellt
   * sich dort ab und macht Pause; alle anderen fahren gleich vom Hof.
   */
  /**
   * Lenkung und Anhaenger ans Modell geben (E-140).
   *
   * Gerechnet wird beides in `lenkung.ts` (`rolle`): der Lenkeinschlag beim
   * Fahren, der Knick des Anhaengers aus seiner eigenen Achse. Hier wird nur
   * gezeigt — die Vorderraeder schwenken um die Hochachse durch ihre
   * Reifenmitte, Felge und Nabe gehen mit.
   */
  private zeigeLenkung(): void {
    if (this.trailer) this.trailer.rotation.y = this.trailerYawRel;
    const c = Math.cos(this.lenk);
    const sn = Math.sin(this.lenk);
    for (const r of this.lenkRaeder) {
      r.mesh.rotation.y = this.lenk;
      r.mesh.position.x = r.achseX + r.versatz * c;
      r.mesh.position.z = r.z - r.versatz * sn;
    }
  }

  /**
   * ARME, KETTEN UND MULDE NACH ARM- UND KIPPWINKEL STELLEN (E-141).
   *
   * Die Rechnung steht in `absetzmulde.muldenPose`: Arm um sein Lager, Kette
   * senkrecht, Mulde um die Zapfen. Haengt keine Mulde an den Ketten
   * (abgesetzt, oder noch nicht geholt), bewegen sich nur Arme und Ketten.
   */
  private stelleAbsetzanlage(): void {
    const a = this.absetz;
    if (!a) return;
    const p = muldenPose(a.geo, this.armSchwenk, this.muldeKipp);
    for (const arm of a.arme) arm.rotation.x = -(a.geo.winkel0 + this.armSchwenk);
    a.ketten.forEach((k, i) => {
      const sx = i === 0 ? -1 : 1;
      k.position.set(sx * (ABSETZMULDE.breite / 2 + 0.04), p.spitzeY - a.geo.kette / 2, p.spitzeZ);
      k.scale.set(1, a.geo.kette, 1);
    });
    if (!this.muldeDran) return;
    const auf = this.muldeAufsetzen;
    if (auf && this.phase === "muldeLoesen") {
      // Langsam auf den Boden: 1,0 s fuer die paar Zentimeter, die der Wagen nickt
      const w = Math.min(1, this.phaseT / 1.0);
      this.bedGroup.position.lerpVectors(auf.von, auf.nach, w);
      this.bedGroup.quaternion.slerpQuaternions(auf.vonQ, auf.nachQ, w);
      return;
    }
    this.bedGroup.position.set(0, p.y, p.z);
    this.bedGroup.rotation.set(-this.muldeKipp, 0, 0);
    // Beim Holen: aus der Lage, in der sie stand, in die Haengelage
    const st = this.muldeStandLage;
    if (st && this.muldeAnheben < 1) {
      const w = this.muldeAnheben;
      this.bedGroup.position.lerpVectors(st.pos, this.bedGroup.position.clone(), w);
      this.bedGroup.quaternion.slerpQuaternions(st.quat, this.bedGroup.quaternion.clone(), w);
    }
  }

  /** Wo die Mulde auf dem Boden stehen wird — gerade, Kufen auf y 0 (Welt). */
  private planeAufsetzen(): void {
    this.group.updateWorldMatrix(true, true);
    const g = this.bedGroup;
    const pos = new THREE.Vector3();
    const q = new THREE.Quaternion();
    g.getWorldPosition(pos);
    g.getWorldQuaternion(q);
    pos.y = 0;
    const gier = new THREE.Euler().setFromQuaternion(q, "YXZ").y;
    const nachWelt = new THREE.Matrix4().compose(
      pos,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, gier, 0)),
      new THREE.Vector3(1, 1, 1)
    );
    const lokal = new THREE.Matrix4().copy(this.group.matrixWorld).invert().multiply(nachWelt);
    const nach = new THREE.Vector3();
    const nachQ = new THREE.Quaternion();
    lokal.decompose(nach, nachQ, new THREE.Vector3());
    this.muldeAufsetzen = { von: g.position.clone(), vonQ: g.quaternion.clone(), nach, nachQ };
  }

  /**
   * WAS NACH DEM KIPPEN NOCH IN DER MULDE LIEGT, FAEHRT VERRIEGELT MIT (E-141).
   *
   * Gemessen: Ohne das flogen Reste beim Zurueckschwenken und in der ersten
   * Kurve heraus — bis 70 km/h, und sie lagen danach auf der Hofstrasse. Ein
   * Fahrer faehrt nicht mit loser Ladung los. Gefragt wird nur die eigene
   * Fuhre und nur der Trog selbst (`imTrog`), nicht das weite Fenster der
   * Ladeflaeche — sonst fasste es den frisch gekippten Haufen dahinter mit.
   * Die Reste wiegt die Ausfahrtswaage als Tara (nicht bezahlt), und sie
   * fahren mit vom Hof.
   */
  private verriegeleReste(): void {
    this.bedGroup.updateWorldMatrix(true, false);
    const inv = new THREE.Matrix4().copy(this.bedGroup.matrixWorld).invert();
    const hilf = new THREE.Vector3();
    for (const it of this.cargo.items) {
      if (!it.body.isValid() || !it.body.isDynamic()) continue;
      if (!imTrog(inv, it.body.translation(), hilf)) continue;
      this.lockToBed(it.body);
      this.ladungFaehrtMit = true;
    }
  }

  /**
   * DIE MULDE BLEIBT STEHEN (E-141): Ketten aus, sie gehoert jetzt dem Platz.
   *
   * Ihr Rahmen wandert in die Szene (Weltlage bleibt), ihr Koerper bekommt
   * ab jetzt keine Bewegung mehr und steht damit still. Der Wagen behaelt
   * einen leeren Rahmen dort, wo sonst die Mulde steht — so wiegt die
   * Ausfahrtswaage nichts, und alles, was an `bedGroup` haengt, laeuft weiter.
   */
  private gibMuldeAb(): void {
    const geo = this.absetz!.geo;
    const g = this.bedGroup;
    this.scene.attach(g);
    const m: AbgesetzteMulde = { group: g, body: this.bedBody, kunde: this.customer, standS: 0, leerS: 0 };
    /*
     * FEST STATT KINEMATISCH, solange sie steht. Gemessen
     * (`tools/absetzlauf.ts`): Auf dem stehenden kinematischen Koerper schlief
     * die Fuhre nicht ein — nach 10 s waren 9 von 9 Stuecken wach. Ein fester
     * Koerper laesst sie schlafen. Beim Holen wird er wieder kinematisch.
     */
    m.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
    this.bedGroup = new THREE.Group();
    this.bedGroup.position.set(0, geo.muldeY, geo.muldeZ - ABSETZMULDE.laenge / 2);
    this.group.add(this.bedGroup);
    this.bedBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    this.muldeDran = false;
    this.onMuldeAbgesetzt?.(m);
    this.onAnliefererlage?.("muldeAbgesetzt");
  }

  /**
   * DIE ABGESETZTE MULDE WIEDER EINHAENGEN (E-141).
   *
   * Ihr Rahmen wandert in den Wagen (Weltlage bleibt). Der Wagen steht nicht
   * auf den Zentimeter dort, wo der vorige stand; deshalb blendet
   * `muldeAufnehmen` erst von ihrer Standlage in die Haengelage ueber — die
   * Ketten ziehen sie die paar Zentimeter heran, statt dass sie springt.
   * Was noch darin liegt (die Frist ist abgelaufen), faehrt mit und ist vom Hof.
   */
  private nimmMulde(): void {
    const m = this.holMulde;
    if (!m) return;
    this.group.remove(this.bedGroup);
    this.world.removeRigidBody(this.bedBody);
    this.group.updateWorldMatrix(true, false);
    this.group.attach(m.group);
    this.bedGroup = m.group;
    this.bedBody = m.body;
    m.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    this.muldeStandLage = { pos: m.group.position.clone(), quat: m.group.quaternion.clone() };
    this.muldeAnheben = 0;
    this.muldeDran = true;
    this.holMulde = null;
    m.group.updateWorldMatrix(true, false);
    const inv = new THREE.Matrix4().copy(m.group.matrixWorld).invert();
    const hilf = new THREE.Vector3();
    for (const it of this.itemQuelle?.items ?? []) {
      if (!it.body.isValid() || !it.body.isDynamic()) continue;
      if (!imTrog(inv, it.body.translation(), hilf)) continue;
      this.cargo.items.push(it);
      this.lockToBed(it.body);
    }
    this.ladungFaehrtMit = true;
    this.onMuldeGeholt?.();
  }

  /** Die Lage des Wagens fuer das Einspurmodell. */
  private lage(): Lage {
    return {
      x: this.group.position.x,
      z: this.group.position.z,
      gier: this.group.rotation.y,
      lenk: this.lenk,
      knick: this.trailerYawRel,
    };
  }

  private setzeLage(l: Lage): void {
    this.group.position.x = l.x;
    this.group.position.z = l.z;
    this.group.rotation.y = l.gier;
    this.lenk = l.lenk;
    this.trailerYawRel = l.knick;
  }

  /**
   * Aussteigen und zum Kaffeewagen hinuebergehen (Wunsch 11.09.2026).
   *
   * Der Fahrer klettert an der Fahrerseite heraus, geht zur Theke, steht dort
   * mit seinem Becher und kommt zurueck, bevor die Pause endet. Erst wenn er
   * wieder im Haus ist, faehrt der LKW los — ein LKW faehrt nicht ohne Fahrer.
   */
  private steigeAus(): void {
    if (!this.fahrer) {
      /*
       * DIE FIGUR GEHOERT DEM KUNDEN (15.09.2026).
       *
       * Hier stand `buildPerson({ shirt: 0x3c4f63, ... })` — drei feste
       * Farben, also stieg aus jedem Wagen derselbe Mann. Jetzt kommt das
       * Aussehen aus `this.customer.aussehen`, und das steht in
       * `customers.ts` am Namen: Willi Baering ist immer Willi Baering.
       *
       * Der Abholer Achim hat keinen Kundendatensatz (er ist keine
       * Anlieferung) und bekommt das neutrale Aussehen — bis er ein eigenes
       * bekommt, siehe offene Frage im Log.
       *
       * Der Becher hing hier als EIGENES Netz an der Figur. Er steckt jetzt
       * im Kleidungsnetz (`kundenfigur.ts`) und kostet keinen Zeichenruf mehr.
       */
      this.fahrer = baueKundenfigur(this.customer?.aussehen ?? AUSSEHEN_NEUTRAL);
      this.scene.add(this.fahrer.group);
    }
    // Fahrerseite: links neben der Kabine, in Fahrtrichtung gesehen
    const seite = new THREE.Vector3(-1.9, 0, 1.6).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.group.rotation.y
    );
    this.fahrerTuer.set(
      this.group.position.x + seite.x,
      0,
      this.group.position.z + seite.z
    );
    // Platz an der Theke, leicht versetzt, damit sich zwei nicht überlagern
    this.fahrerTheke.set(
      KAFFEE_THEKE.x + (Math.random() - 0.5) * 2.4,
      0,
      KAFFEE_THEKE.z - Math.random() * 0.8
    );
    this.fahrer.group.position.copy(this.fahrerTuer);
    this.fahrer.group.visible = true;
    this.fahrerState = "raus";
    this.kaffeeGehabt = true;
  }

  /** Ein Schritt des Fahrers; ausserhalb der Pause ist nichts zu tun. */
  private updateFahrer(dt: number): void {
    const f = this.fahrer;
    if (!f || this.fahrerState === "drin") return;
    const ziel = this.fahrerState === "rein" ? this.fahrerTuer : this.fahrerTheke;
    const g = f.group;
    const dx = ziel.x - g.position.x;
    const dz = ziel.z - g.position.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.3 && this.fahrerState !== "kaffee") {
      const schritt = Math.min(FAHRER_TEMPO * dt, d);
      g.position.x += (dx / d) * schritt;
      g.position.z += (dz / d) * schritt;
      g.rotation.y = Math.atan2(dx, dz);
      /*
       * HIER SCHWANGEN BIS HEUTE ARME UND BEINE. Die Figur hat keine
       * beweglichen Glieder mehr — vier Schwingteile sind vier zusaetzliche
       * Netze, und Netze sind der gemessene Engpass (E-025). Sie wippt und
       * wiegt sich jetzt als Ganzes; die Rechnung dazu steht in
       * `kundenfigur.schritt`.
       */
      f.schritt(dt, true);
      return;
    }
    f.schritt(dt, false);
    if (this.fahrerState === "raus") {
      this.fahrerState = "kaffee";
      // zur Theke schauen; der Becher ist ohnehin in der Hand
      const zx = KAFFEE_THEKE.x - g.position.x;
      const zz = KAFFEE_THEKE.z + 1.2 - g.position.z;
      g.rotation.y = Math.atan2(zx, zz);
    } else if (this.fahrerState === "rein") {
      this.fahrerState = "drin";
      g.visible = false;
    }
  }

  private leaveUnloadingBay(): void {
    this.phaseT = 0;
    if (this.parkSpot) {
      /*
       * ZUM WARTEPLATZ AUF EINER STRECKE (E-098).
       *
       * Hier stand `this.phase = "toPark"`, und `toPark` rechnete sich von da
       * an seine eigene Luftlinie — an `advance()` und damit an der
       * Bauwerkspruefung vorbei. Jetzt bekommt der Wagen eine Strecke wie fuer
       * jede andere Etappe, und er faedelt darauf ein wie ueberall sonst
       * (E-094): Er faehrt den Weg zum Streckenanfang AB, statt zu springen.
       */
      this.meinParkweg = routeToPark(this.routeOut, this.parkSpot);
      this.meinParkRueck = routeParkRueckVon(this.routeOut, this.parkSpot);
      this.starteAusfaedeln(this.meinParkweg, "toPark", this.nearestS(this.meinParkweg));
      return;
    }
    /*
     * HIER SASS DER HAEUFIGSTE SPRUNG DES SPIELS, und er sass genau dort, wo
     * die frische Fuhre liegt (E-093). `routeS = 0` setzt den Wagen an den
     * ANFANG der Ausfahrt zurueck — das ist der Halteplatz. Der Kipper steht
     * da aber nicht mehr: `tipCreep` hat ihn gekippt `TIP_CREEP_M` = 1,4 m
     * nach vorn gezogen, damit der Rest ueber die Kante nachrutscht. Gemessen
     * sprang er dadurch bei JEDER Kipperfuhre 1,32 m zurueck, in einem Bild,
     * mitten in den eben abgekippten Haufen.
     *
     * `nearestS` statt Null ist hier nicht nur sprungfrei, sondern auch
     * richtiger: Der Kriechzug laeuft in Fahrtrichtung, also ENTLANG der
     * Ausfahrt — der Wagen hat den ersten Meter schon hinter sich.
     */
    this.starteAusfaedeln(this.routeOut, "out", 0);
  }

  /** true, solange über den Preis verhandelt wird — der Fahrer wartet dann. */
  awaitingDeal = false;
  /** Wird gerufen, wenn die Verhandlung in die Zeitgrenze läuft. */
  onDealTimeout: (() => void) | null = null;
  /** Bruttowiegung erledigt; verhindert, dass sie sich wiederholt */
  private weighedIn = false;

  /**
   * Der Fahrer. Er entsteht erst, wenn er gebraucht wird — also beim ersten
   * Halt auf dem Warteplatz. Fuer die meisten Fuhren gibt es ihn nie.
   */
  private fahrer: Kundenfigur | null = null;
  private fahrerState: "drin" | "raus" | "kaffee" | "rein" = "drin";
  /** Pause schon gemacht? Sonst steigt er endlos wieder aus. */
  private kaffeeGehabt = false;
  private readonly fahrerTuer = new THREE.Vector3();
  private readonly fahrerTheke = new THREE.Vector3();

  /**
   * Woher die Teile kommen, die auf der Flaeche liegen. Wird beim Anlegen
   * gesetzt; gebraucht wird sie erst beim Wegfahren.
   */
  itemQuelle: ItemManager | null = null;

  /**
   * Zugang zum Platzinventar — gesetzt, sobald es einen gibt.
   *
   * Ohne ihn verhält sich der Abholer wie bisher; mit ihm gibt er einen
   * mitgenommenen Container zurück (siehe `gibPlatzinventarZurueck`).
   */
  platzinventar: PlatzinventarPort | null = null;

  /**
   * Was zuletzt zurückgegeben wurde — Kennung und was ins Silo ging.
   *
   * Nur zum Melden und Prüfen. Ein Euro steht hier nicht und wird hier nie
   * stehen: Platzinventar ist unverkäuflich.
   */
  letzteRueckgabe: { id: string; kg: number; stueck: number; rest: number } | null = null;

  /**
   * Steht Platzinventar auf der Ladefläche? Dann leeren und beim Bagger absetzen.
   *
   * Ansage Patrick, 15.09.2026: „Wenn ein Abholer den Müllcontainer mitnimmt,
   * dann bringt er ihn auch wieder und kippt ihn einfach bei mir ab" — „mit
   * ohne Müll in dem Fall. Und der Müll landet natürlich bei uns im Silo."
   *
   * Gerufen wird das, BEVOR der Wagen losfährt und bevor die Fläche verriegelt
   * wird. Danach ist der Container nicht mehr auf der Fläche, sein Inhalt
   * liegt im ABFALL-Silo, und die Abrechnung des Abholers sieht ihn gar nicht
   * erst — sie kann ihn also auch nicht versehentlich verkaufen.
   *
   * Erkannt wird er an der HÖHE über der Fläche: Ein Container auf dem Boden
   * neben dem Wagen liegt in Flächenkoordinaten einen Meter tiefer, einer auf
   * der Fläche knapp darüber. Das unterscheidet „aufgeladen" von „steht
   * daneben" ohne jede weitere Abfrage.
   */
  private gibPlatzinventarZurueck(): void {
    const port = this.platzinventar;
    if (!port) return;
    this.bedGroup.updateWorldMatrix(true, false);
    this.bedInv.copy(this.bedGroup.matrixWorld).invert();
    for (const st of port.stellungen()) {
      if (!Number.isFinite(st.x) || !Number.isFinite(st.y) || !Number.isFinite(st.z)) continue;
      this.probePos.set(st.x, st.y, st.z).applyMatrix4(this.bedInv);
      if (Math.abs(this.probePos.x) > BED_HALF_W + 0.6) continue;
      if (this.probePos.z < -0.8 || this.probePos.z > this.bedLen + 0.8) continue;
      if (this.probePos.y < -0.2 || this.probePos.y > 3.0) continue;
      const bericht = port.leeren(st.id);
      port.absetzen(st.id, ABLADE_SPUR_X, ABLADE_HALT_Z);
      this.letzteRueckgabe = { id: st.id, ...bericht };
    }
  }

  /**
   * Aufbau der Ladeflaeche. Haendler fahren nicht alle denselben Wagen: mal
   * flache Bordwaende, mal Rungen, mal ein geschlossener Kasten. Gewerbe und
   * Privat bleiben flach — sie liefern kein Schuettgut. Die Ladung richtet
   * sich nach der Bordwandhoehe, deshalb steht der Aufbau als Feld.
   */
  private readonly bodyStyleName: Aufbau;

  /** Zugewiesener Warteplatz, null = fährt direkt vom Hof. */
  parkSpot: [number, number] | null = null;
  /** Wie lange die Pause dauert */
  parkSeconds = 60;

  /**
   * Standfläche für die Kollisionsprüfung: Zugfahrzeug und, falls vorhanden,
   * Anhänger einzeln — der knickt an der Kupplung ab und steht anders als
   * das Zugfahrzeug.
   */
  boxen(out: Box[]): void {
    this.figurenBei(this.lage(), out);
  }

  /**
   * Die Standflaechen in einer Lage: beim LKW eine, beim Gespann Auto und
   * Anhaenger (er knickt an der Kupplung ab). Gerechnet in `umriss.ts`, wie
   * im Waechter (`test/knicklauf.figurenFuer`).
   */
  private figurenBei(l: Lage, out: Box[]): void {
    /*
     * Die Standflaeche sitzt NICHT auf dem Ursprung, sondern dort, wo der
     * Wagen wirklich steht (15.09.2026, seit E-054 aus `umriss.ts`).
     *
     * Beim Gespann das AUTO (E-140): Der Rahmen hier ist das Zugfahrzeug, und
     * `fahrzeugUmriss` mit der Anhaengerlaenge lag nur dort, wo der Anhaenger
     * bei geradem Gespann steht — das Auto kam in keiner Pruefung vor.
     */
    const pose = { x: l.x, z: l.z, rot: l.gier };
    const a = this.fahrwerk.anhaenger;
    if (!this.trailer || !a) {
      out.push(fahrzeugUmriss(pose, this.bedLen));
      return;
    }
    out.push(zugwagenUmriss(pose, this.fahrwerk.vorn, this.fahrwerk.hinten));
    out.push(
      anhaengerUmriss(
        l.x + Math.sin(l.gier) * a.kupplung,
        l.z + Math.cos(l.gier) * a.kupplung,
        l.gier + l.knick,
        this.bedLen
      )
    );
  }


  /**
   * STEHT BELADEN AUF DEM WARTEPLATZ AN (E-131).
   *
   * Patrick, 16.10.2026: "Es sollen mehr LKWs kommen am Anfang". Beim Start
   * des Sandkastens stehen drei Fuhren schon auf den Warteplaetzen —
   * gewogen, beladen, und sie warten, bis der Abladeplatz frei ist. Der
   * Warteplatz, die Phase `parked` und die Liste `parked` sind dieselben wie
   * fuer die Kaffeepause nach dem Abladen; neu ist nur, dass dieser Wagen
   * VORHER dort steht und auf seinen Ruf wartet statt auf seine Uhr.
   */
  stehtAn = false;

  /** Gleich nach dem Bau: auf den Warteplatz stellen und dort beladen ansetzen. */
  stelleAnstehendAuf(slot: [number, number]): void {
    this.stehtAn = true;
    this.parkSpot = slot;
    this.kaffeeGehabt = true; // der Fahrer bleibt sitzen, er ist gleich dran
    this.weighedIn = true; // gewogen ist er schon (er kam vor Spielbeginn)
    // Dieselbe Endlage wie nach `parkRueck`: Heck zur Wand, Front zum Platz.
    // Gesetzt, bevor der erste Physikschritt laeuft und bevor Ladung da ist —
    // wie die Startpose im Konstruktor, nur an anderer Stelle (v2 E-058).
    const r = routeParkRueck(slot);
    this.placeAt(r, this.routeLength(r), true);
    this.wendeFederungAn();
    this.federLetztePos.copy(this.group.position);
    this.snapBodiesToPose();
  }

  /**
   * Vom Warteplatz an den Abladeplatz — wenn der Fuhrpark ruft.
   *
   * Kein neuer Weg: Der Wagen zieht aus der Bucht (`parkAnfahrt`, der Punkt,
   * von dem er sonst rueckwaerts hineinsetzt) und faedelt auf die gewohnte
   * Anfahrt von der Waage ein (`routeApproach`), `ANSTEH_EINFAEDEL_M` hinter
   * dem Punkt, der der Bucht am naechsten liegt. Ab da ist er ein Anlieferer
   * wie jeder andere; danach faehrt er vom Hof, nicht zurueck auf den Platz.
   */
  rueckeVor(): void {
    const slot = this.parkSpot!;
    this.stehtAn = false;
    this.parkSpot = null;
    this.legeAbladestelleFest();
    /*
     * E-140: Vom Warteplatz aus gibt es einen eigenen Rangierzug. Der Wagen
     * steht dort mit der Kabine zum Platz und faehrt einfach los — aus der
     * Bucht, vorbei, wenden, zuruecksetzen. Bis E-140 faedelte er hier auf
     * die gewohnte Anfahrt ein; das ging nur, solange er sich auf der Stelle
     * drehen konnte.
     */
    const zug = anfahrtVomPlatz(slot, this.zielMulde);
    this.meineAnfahrt = zug.anfahrt;
    this.meinRueckweg = zug.rueckweg;
    this.phase = "approach";
    this.phaseT = 0;
    this.routeS = 0;
  }

  /** Steht das Fahrzeug auf dem Warteplatz und macht Pause? */
  get isParked(): boolean {
    return this.phase === "parked" || this.phase === "toPark" || this.phase === "parkRueck";
  }

  private nudgeReturn: Phase = "waitUnload";
  private nudgeTargetS = 0;

  /**
   * DIE FRIST IST UM: Er faehrt mit dem, was er gebracht hat (E-082).
   *
   * Drei Dinge gehoeren zusammen, und alle drei aus demselben Grund — WAS
   * NICHT ABGELADEN WURDE, WIRD NICHT BEZAHLT:
   *
   *  1. Er sagt es. Ein Wagen, der klammheimlich verschwindet, sieht aus wie
   *     ein Fehler des Spiels.
   *  2. Die Fuhre wird fuer die Fahrt verriegelt (das erledigt `sendAway`),
   *     die Karosse eines Wracks dazu — sie liegt nicht in `itemQuelle` und
   *     wuerde sonst beim Anfahren vom Blech rutschen.
   *  3. `ladungFaehrtMit` merkt sich, dass sie den Hof verlaesst. Ohne das
   *     stellt `despawn()` sie an der Ausfahrt ab (dort ist das richtig: Wer
   *     abgeladen HAT, soll seine Reste nicht mitnehmen) — und der Spieler
   *     bekaeme eine ganze Fuhre geschenkt, indem er vier Minuten wartet.
   *
   * AM KREISLAUF WIRD NICHTS ANGEFASST. Die Ausfahrtswiegung rechnet weiter,
   * wie sie immer gerechnet hat: brutto minus dem, was noch oben liegt. Steht
   * alles noch auf der Flaeche, ist das Netto null und es fliesst kein Geld.
   * Wurde die Haelfte abgeladen, wird die Haelfte bezahlt. Kein neuer Satz
   * Regeln, nur ein Wagen, der endlich faehrt.
   */
  private faehrtUnverrichtet(): void {
    this.onAnliefererlage?.("faehrtUnverrichtet");
    /*
     * WAS DIE WAAGE GEZAEHLT HAT, FAEHRT MIT. Nicht `aufDerFlaeche`, sondern
     * `wiegtMit`: Das engere Fenster laesst eine hoch aufgetuermte Fuhre
     * oben offen. Gemessen am 16.09.2026 — eine Pritsche fuhr mit 56 kg
     * Differenz hinaus, weil ein Stueck ueber 3 m Hoehe nicht gekoppelt
     * wurde, unterwegs herunterfiel und an der Ausfahrt fehlte. Bezahlt
     * worden waere es trotzdem.
     */
    this.bedGroup.updateWorldMatrix(true, false);
    const schon = new Set(this.riding.map((r) => r.body.handle));
    for (const it of this.cargo.items) {
      if (schon.has(it.body.handle)) continue;
      if (this.wiegtMit(it.body)) this.lockToBed(it.body);
    }
    if (this.cargo.car && this.wiegtMit(this.cargo.car.body, 0.6)) {
      this.lockToBed(this.cargo.car.body);
    }
    this.ladungFaehrtMit = true;
    this.sendAway();
  }

  /**
   * Schon abgerechnet? Ein Abholer verlaesst den Hof genau einmal.
   *
   * `justDeparted` allein genuegt dafuer nicht: Es ist ein Einweg-Merker, der
   * im selben Takt wieder verbraucht wird (`consumeDeparted`). Wer zweimal
   * abfahren liesse, setzte ihn ein zweites Mal — und die Fuhre waere zweimal
   * bezahlt.
   */
  private abfahrtGemeldet = false;

  /**
   * DER ABHOLER VERLAESST DEN HOF (E-086) — und zwar auf JEDEM Weg dasselbe.
   *
   * Befund am 16.09.2026. Patrick: „hab eine fuhre abholen lassen, es gab aber
   * keine einzahlung auf dem konto durch verkauf, umgeschlagen war auch 0" —
   * und auf die Nachfrage, ob die Leermeldung kam: „Nein, gar keine Meldung."
   *
   * Gar keine Meldung heisst: Die Abrechnung ist nie GELAUFEN. Sie meldet in
   * beiden Faellen etwas (`main.ts`: „Verkauft: …" oder „Container war leer").
   * Der Grund stand hier: Ein Abholer konnte den Hof auf ZWEI Wegen verlassen,
   * und nur einer davon rechnete ab.
   *
   *   Taste V   `requestPickup()` -> `requestRelease()` -> Fall „waitLoad"
   *             setzte `justDeparted` und meldete den Funkspruch.
   *   Taste J   `zurWaage()` -> `sendAway()` setzte nur die Phase auf „out".
   *
   * Beim zweiten Weg lief `consumeDeparted()` leer, `onPickupDepart` feuerte
   * nie, `Account.sellContainer` wurde nie gefragt — und weil die Meldung an
   * derselben Stelle haengt, blieb auch das HUD stumm. Die Ladung war
   * unterdessen fuer die Fahrt verriegelt und fuhr bezahlungslos vom Hof.
   * Gemessen mit `tools/abholung-abrechnung.ts`, Abschnitt „Die Abfahrtswege":
   * acht von acht Faellen ueber Taste J gingen ohne einen Cent aus.
   *
   * DIESELBE FEHLERKLASSE WIE E-070: Dort gab es drei Fenster fuer eine Frage,
   * hier zwei Ausgaenge fuer ein Ereignis. Deshalb steht das Ereignis jetzt an
   * genau einer Stelle, und beide Wege gehen hindurch. Wer spaeter einen
   * dritten Weg baut, muss ihn nicht kennen — er muss nur `sendAway()` oder
   * den Fall „waitLoad" benutzen, und beide fragen hier nach.
   *
   * Ein Anlieferer laeuft hier absichtslos hindurch: Fuer ihn ist nichts zu
   * tun (`isPickup` ist falsch), er wird an der Ausfahrtswaage abgerechnet.
   */
  private abholerFaehrtRaus(): void {
    if (!this.isPickup || this.abfahrtGemeldet) return;
    this.abfahrtGemeldet = true;
    this.justDeparted = true; // Container wird jetzt abgerechnet
    // Zuerst das Platzinventar: Es faehrt nicht mit und wird nie bezahlt
    // (E-034). Das MUSS vor dem Verriegeln stehen, sonst wird der
    // Muellcontainer an die Flaeche gekoppelt und ist vom Hof.
    const vorher = this.letzteRueckgabe;
    this.gibPlatzinventarZurueck();
    if (this.letzteRueckgabe !== vorher) this.onFahrerlage?.("containerZurueck");
    this.verriegeleLadeflaeche();
    /*
     * Und dann sagt er, womit er faehrt. Gefragt wird DIESELBE QUELLE, aus der
     * die Ausfahrtswiegung ihr Brutto nimmt (`ladeflaecheKg`, E-064) — sonst
     * verabschiedet er sich mit einer vollen Fuhre, und die Waage meldet zwei
     * Meter weiter „0 kg abgeholt".
     *
     * Die Schranke ist 1 kg und keine Null: Jedes einzelne Teil des Spiels
     * wiegt mehr, und gegen Null zu vergleichen hiesse, sich auf Fliesskomma
     * zu verlassen.
     */
    const aufDerFlaeche = this.ladeflaecheKg();
    this.onFahrerlage?.(aufDerFlaeche > 1 ? "abfahrtVoll" : "abfahrtLeer");
  }

  sendAway(): boolean {
    if (this.phase === "out") return false;
    // Mit ausgeschwenkten Armen faehrt kein Absetzkipper los (E-141)
    if (this.absetz && this.armSchwenk > 0) return false;
    // Ein Abholer wird abgerechnet, EGAL welcher Befehl ihn losschickt (E-086).
    this.abholerFaehrtRaus();
    // Was noch oben liegt, faehrt mit — sonst verliert der Wagen es unterwegs
    this.verriegeleLadeflaeche();
    // Dort in die Ausfahrt einfädeln, wo der Wagen gerade steht — sonst
    // würde er an den Anfang der Ausfahrtsroute springen. Seit E-093 faehrt
    // er den Weg dorthin AB, statt ihn zu ueberspringen.
    this.starteAusfaedeln(this.routeOut, "out", this.nearestS(this.routeOut));
    this.sideOpenTarget = 0;
    return true;
  }

  /** Bogenlänge des Routenpunkts, der der aktuellen Position am nächsten liegt. */
  private nearestS(
    route: Array<[number, number]>,
    px = this.group.position.x,
    pz = this.group.position.z
  ): number {
    let best = 0;
    let bestD = Infinity;
    let s = 0;
    for (let i = 0; i < route.length - 1; i++) {
      const [ax, az] = route[i];
      const [bx, bz] = route[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 1e-6) continue;
      // Projektion des Fahrzeugs auf dieses Segment
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (len * len)));
      const d = Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
      if (d < bestD) {
        bestD = d;
        best = s + len * t;
      }
      s += len;
    }
    return best;
  }

  /* --------------------------------------------- AUSFAEDELN STATT SPRINGEN */

  /**
   * Die Punkte, die noch frei angefahren werden, bevor die Strecke gilt.
   *
   * Der LETZTE ist immer der Einfaedelpunkt, und er wird BEIM START gerechnet
   * und dann festgehalten. Das ist kein Detail: Wer ihn unterwegs neu rechnet,
   * bekommt beim Verlassen der Parkbucht einen ganz anderen — vom
   * Buchtausgang aus ist der naechste Punkt der Ausfahrt nicht mehr das Tor,
   * sondern die Waagenspur zwischen den Hallen, und dort kam der Wagen quer
   * an (gemessen 0,50 m in Halle 1 Sued, 0,63 m im Betriebsgebaeude).
   */
  private ausfaedelWeg: Array<[number, number]> = [];
  /** Der Weg vom Standort bis zum Einfaedelpunkt — beim ersten Schritt gelegt. */
  private ausfaedelBahn: Array<[number, number]> | null = null;
  /** Welche Phase laeuft, sobald die Strecke aufgenommen ist. */
  private ausfaedelFolge: Phase = "out";
  /** Auf welche Strecke eingefaedelt wird. */
  private ausfaedelRoute: Array<[number, number]> | null = null;

  /**
   * Wie lange ein Ausfaedeln hoechstens dauern darf (s).
   *
   * Gerechnet: Der laengste Weg ist Warteplatz 2 — 8,0 m aus der Bucht und
   * 8,7 m bis zur Ausfahrt, bei SPEED 4,8 m/s zusammen 3,5 s. Dazu zweimal
   * eine halbe Wendung, bei LENK_RATE 0,85 rad/s je 3,7 s. Macht 10,9 s;
   * 20 s sind knapp das Doppelte. Der Deckel ist kein Fahrgesetz, sondern
   * eine Notbremse: Ein Wagen, der sich hier festfaehrt, haelt den ganzen
   * Betrieb an — dann faedelt er lieber wie frueher ein.
   */
  private static readonly AUSFAEDEL_FRIST_S = 20;

  /**
   * FREI ZUR STRECKE FAHREN STATT AUF SIE ZU SPRINGEN.
   *
   * Der kleinste Eingriff, der den Ortssprung beseitigt — und er kommt ohne
   * einen einzigen verschobenen Streckenpunkt aus: Der Wagen faehrt die
   * Strecke zwischen seinem Standort und seinem Einfaedelpunkt AB, statt sie
   * zu ueberspringen. Das Fahrgesetz ist dasselbe wie in `toPark` (E-084):
   * begrenzte Drehrate, Tempo nach Restwinkel.
   *
   * `altS` ist die Bogenlaenge, die der alte Stand an dieser Stelle gesetzt
   * hat. Sie steht hier, damit die Gegenprobe (`faedeltAus = false`) Zeichen
   * fuer Zeichen das alte Verhalten liefert — die vier Aufrufstellen setzten
   * naemlich NICHT alle dieselbe: drei nahmen `nearestS`, zwei die Null.
   */
  private starteAusfaedeln(
    route: Array<[number, number]>,
    folge: Phase,
    altS: number,
    vorpunkte: Array<[number, number]> = [],
    /** Wo auf der Strecke eingefaedelt wird; ohne Angabe der naechste Punkt. */
    zielS: number = this.nearestS(route)
  ): void {
    this.phaseT = 0;
    if (!this.faedeltAus) {
      this.routeS = altS;
      this.phase = folge;
      return;
    }
    this.ausfaedelRoute = route;
    this.ausfaedelFolge = folge;
    this.ausfaedelWeg = [
      ...vorpunkte.map((p) => [p[0], p[1]] as [number, number]),
      this.punktAuf(route, zielS),
    ];
    this.ausfaedelBahn = null;
    this.phase = "ausfaedeln";
  }

  /** Der Punkt der Polylinie bei Bogenlaenge `s` — ohne das Fahrzeug zu setzen. */
  private punktAuf(route: Array<[number, number]>, s: number): [number, number] {
    const p = poseAuf(route, s, false);
    return [p.x, p.z];
  }

  /**
   * Ein Schritt des Ausfaedelns.
   *
   * Seit E-140 mit demselben Fahrgesetz wie jede Etappe: Der Weg vom
   * Standort ueber die Zwischenpunkte zum Einfaedelpunkt ist eine kleine
   * Strecke, und `advance` faehrt sie mit dem Einspurmodell ab — samt
   * Bauwerks- und Blockadepruefung. Vorher fuhr der Wagen hier eine
   * Luftlinie mit begrenzter Drehrate und setzte seine Koerper hart nach
   * (`snapBodiesToPose`): Rapier sah dabei keine Bewegung (E-098, „Gespenst").
   */
  private ausfaedelSchritt(dt: number): void {
    const route = this.ausfaedelRoute ?? this.routeOut;
    if (!this.ausfaedelBahn) {
      const [px, pz] = fortschrittsPunkt(this.lage(), this.fahrwerk);
      this.ausfaedelBahn = [[px, pz], ...this.ausfaedelWeg];
      this.ausfaedelWeg = [];
      this.routeS = 0;
    }
    const bahn = this.ausfaedelBahn;
    const laenge = this.routeLength(bahn);
    if (laenge > 0.05 && this.routeS < laenge && this.phaseT <= DeliveryVehicle.AUSFAEDEL_FRIST_S) {
      this.advance(bahn, SPEED * dt, false, dt);
      if (this.routeS < laenge) return;
    }
    this.ausfaedelBahn = null;
    this.routeS = this.nearestS(route);
    this.phase = this.ausfaedelFolge;
    this.phaseT = 0;
    this.ausfaedelRoute = null;
  }

  private get isPickup(): boolean {
    return this.kind === "abholer";
  }

  /**
   * Fuer welche Fraktion dieser Abholer bestellt wurde (null = gemischt).
   *
   * Steht am FAHRZEUG und nicht nur am Fuhrpark: Der Halteplatz wird beim
   * Losfahren von der Waage festgelegt, und bis dahin kann der Spieler laengst
   * eine neue Abholung vorgemerkt haben. Der Wagen, der schon faehrt, faehrt
   * zu dem Platz, fuer den er gerufen wurde.
   */
  bestellung: string | null = null;

  /**
   * Die Lage, in der der Abholfahrer etwas sagt.
   *
   * Gesetzt vom `VehicleManager`, der daraus den Funkspruch baut. Am Fahrzeug
   * steht nur der ZEITPUNKT und die LAGE — WAS Achim sagt, ist Sache der
   * Stimmen in `customers.ts`, und WO es erscheint, ist Sache des HUD.
   *
   * EIN KANAL FUER ALLE LAGEN, nicht fuenf Rueckrufe. Hiess bis zum
   * 15.09.2026 `onAngekommen` und kannte nur die Ankunft; seit der Abholer
   * ein Fahrer mit Namen ist, hat er auch fuers Warten, fuers Losfahren und
   * fuer die zurueckgegebene Wanne einen Satz.
   */
  onFahrerlage: ((lage: Fahrerlage) => void) | null = null;

  /**
   * Standzeit bis zum ersten „lass dir Zeit" — einmal je Fuhre.
   *
   * SW: 25 s. Kuerzer wirkt es wie Draengeln (der Spieler hat den Greifer
   * gerade erst am Haufen), laenger hoert man es nie: Eine Fuhre in Ruhe zu
   * laden dauert Minuten, und die Standzeit des Wagens laeuft nach 240 s ab.
   */
  private static readonly WARTE_FUNK_S = 25;
  /** Schon gesagt? Sonst redet er in jedem Bild. */
  private warteFunkGehabt = false;

  /**
   * WIE LANGE EIN FAHRZEUG AUF DIESEM HOF STEHT — eine Zahl, nicht zwei.
   *
   * Der Abholer hatte sie seit jeher (`phaseT > 240` im `waitLoad`, am Geraet
   * abgenommen); der Anlieferer hatte gar keine und stand unbegrenzt. Im
   * kopflosen Lauf zu E-070 blieb eine Pritsche ZEHN MINUTEN am Abladeplatz
   * und hielt dabei eine vorgemerkte Abholung auf — der Platz ist einspurig
   * (E-029), solange einer steht, kommt kein naechster.
   *
   * 240 s gelten ab jetzt fuer beide. Begruendung fuer genau diese Zahl:
   *
   *  - Sie ist NICHT neu. Sie steht seit dem Abholer im Spiel und hat sich am
   *    Geraet als „lang genug zum Arbeiten" erwiesen. Zwei verschiedene
   *    Standzeiten auf demselben Hof waeren zwei Regeln, die der Spieler
   *    nirgends nachlesen kann.
   *  - Sie liegt weit ueber dem, was Abladen kostet: Eine Pritsche ist mit
   *    einer Handvoll Griffen leer.
   *  - Sie liegt weit ueber den 32 s, nach denen die Preisverhandlung
   *    abbricht — Abladen ist Arbeit, Verhandeln ist ein Klick.
   *  - Und sie ist kurz genug, dass der Hof nicht steht: Nach der Abfahrt
   *    steht der naechste Wagen 34,4 s spaeter vor der Waage (E-070).
   */
  static readonly STANDZEIT_S = 240;

  /**
   * Die Mahnung kommt eine Minute vor Schluss. SW: 60 s — genug fuer zwei,
   * drei Griffe, also lang genug, dass die Ansage noch etwas nuetzt. Sie
   * haengt an der Standzeit und ist keine zweite Zahl: Wird oben gedreht,
   * wandert die Mahnung mit.
   */
  static readonly MAHNUNG_VOR_S = 60;
  /** Schon gemahnt? Sonst redet er in jedem Bild (wie `warteFunkGehabt`). */
  private abladeMahnungGehabt = false;
  /**
   * Faehrt er mit seiner Fuhre vom Hof? Dann wird sie beim Abraeumen NICHT
   * neben dem Wagen abgestellt (`despawn`) — sie war nie abgeladen und ist
   * folglich auch nie bezahlt worden.
   */
  private ladungFaehrtMit = false;

  /**
   * Der Anlieferer sagt etwas — derselbe Weg wie `onFahrerlage` bei Achim:
   * Am Fahrzeug steht der ZEITPUNKT, die Worte stehen in `customers.ts`, und
   * wo sie erscheinen, entscheidet das HUD.
   */
  onAnliefererlage: ((lage: Anliefererlage) => void) | null = null;

  /**
   * Die beiden Wiegungen des Abholers (E-064) — reine Meldungen.
   *
   * Sie gehen ABSICHTLICH nicht ueber `onWeighIn`/`onWeighOut`: An denen
   * haengt die Abrechnung der Anlieferung (Verhandlung beim Einfahren,
   * Auszahlung beim Ausfahren). Der Abholer verhandelt nichts und bekommt
   * nichts bezahlt — was er mitnimmt, ist beim Losfahren vom Verladeplatz
   * laengst abgerechnet (`onPickupDepart`). Hier wird nur gewogen und gesagt.
   */
  onTara: ((tara: number) => void) | null = null;
  onAbholungGewogen: ((tara: number, brutto: number) => void) | null = null;
  /**
   * Kippt selbst ab — der Einzige, der Material ohne Spielerarbeit auf den
   * Platz bringt. Seit E-029 sagt das nichts mehr ueber seinen WEG (er faehrt
   * dieselbe Strecke wie die Pritschen), nur noch ueber das, was am
   * Abladeplatz passiert.
   */
  get isSelfTipping(): boolean {
    return this.kind === "kipper";
  }

  /**
   * Wer da anliefert. Bestimmt Menge, Material, Störstoffanteil und den Ton
   * an der Waage. Abholer haben kein Profil — die kommen leer.
   */
  readonly customer: CustomerProfile | null;

  /** Sortenreine Ladung? Ergibt sich aus der Kundschaft. */
  get sortedMaterial(): string | null {
    return this.customer?.sortedMaterial ?? null;
  }

  /**
   * Das Lagersilo, in das diese Fuhre gehoert — oder null.
   *
   * Die Regel steht in `routes.ts` (`faehrtInsSilo`), damit sie kopflos zu
   * pruefen ist: Nur wer SELBST kippen kann und eine Fraktion mit Lagersilo
   * bringt, faehrt die Gasse hinunter. Alles andere haelt am Abladeplatz.
   */
  private get zielMulde(): ContainerConfig | null {
    const lager = lagerMuldeFuer(this.sortedMaterial);
    return faehrtInsSilo(this.kind, lager) ? lager : null;
  }
  private get routeIn(): Array<[number, number]> {
    return this.isPickup ? PICKUP_IN_FWD : ROUTE_IN_FWD;
  }
  /*
   * Die eigene Anfahrt. Sie wird einmal festgelegt, wenn der Wagen von der
   * Waage losfährt, und ändert sich danach nicht mehr — auch wenn der Bagger
   * inzwischen weiterfährt. Sonst rutschte dem rückwärts setzenden Fahrer das
   * Ziel unter den Rädern weg.
   */
  private meineAnfahrt: Array<[number, number]> | null = null;
  private meinRueckweg: Array<[number, number]> | null = null;
  private meineAusfahrt: Array<[number, number]> | null = null;
  /**
   * Der Weg zum Warteplatz. Wird beim Verlassen des Abladeplatzes EINMAL
   * gerechnet und danach nicht mehr angefasst — aus demselben Grund wie die
   * Anfahrt darueber: Sonst rutschte dem fahrenden Wagen die Strecke unter den
   * Raedern weg, sobald der Bagger den Abladeplatz versetzt.
   */
  private meinParkweg: Array<[number, number]> | null = null;
  /** Der Rueckweg in die Bucht, der zu `meinParkweg` gehoert (E-140). */
  private meinParkRueck: Array<[number, number]> | null = null;

  /**
   * Halteposition nach der aktuellen Baggerstellung festlegen.
   *
   * Gilt fuer beide Richtungen: Der Anlieferer setzt auf den Vorplatz vor der
   * Maschine, der Abholer in die Ostgasse daneben. Beide Stellen wandern mit
   * dem Bagger mit, beide werden hier eingefroren.
   */
  private legeAbladestelleFest(): void {
    if (this.isPickup) {
      /*
       * WO DER ABHOLER HAELT, HAENGT AN DER BESTELLUNG (E-056).
       *
       * Stahlschrott und Mischschrott haben kein Lagersilo — sie werden an
       * der Halde verladen, also kommt der Wagen zum Bagger. Alles mit
       * Lagersilo faehrt an den Verladeplatz vor dem Schenkel dieses Silos.
       * Die Rechnung steht in `routes.ts`, damit sie kopflos zu pruefen ist.
       */
      neueAbholstelle(this.bestellung);
      this.meineAnfahrt = pickupApproach();
      this.meinRueckweg = pickupInRev();
      this.meineAusfahrt = pickupOut();
      return;
    }
    if (this.absetz) {
      // Der Absetzkipper haelt 2,5 m vor dem Abladeplatz (E-141)
      neueAbladestelle();
      const zug = rangierAbsetzplatz();
      this.meineAnfahrt = zug.anfahrt;
      this.meinRueckweg = zug.rueckweg;
      this.meineAusfahrt = absetzAusfahrt();
      return;
    }
    const mulde = this.zielMulde;
    if (mulde) {
      this.meineAnfahrt = bayApproach(mulde);
      this.meinRueckweg = bayInRev(mulde);
      this.meineAusfahrt = bayOut(mulde);
      return;
    }
    neueAbladestelle();
    this.meineAnfahrt = routeApproach();
    this.meinRueckweg = routeInRev();
    this.meineAusfahrt = routeOut();
  }

  /*
   * ZWEI WEGE, EINE REGEL (E-029).
   *
   * Bis zum 15.09.2026 gab es DREI: Silo-Gasse, eigene Kipperspur vor dem
   * Bagger, Abladeplatz. Die mittlere ist weg — Patricks Ansage „Kipper
   * fahren die falsche Spur. Die sollen auch, wie die anderen LKWs, seitlich
   * von mir abgeladen werden." Was bleibt, entscheidet `faehrtInsSilo`:
   * sortenrein mit Lagersilo ins Lager, alles andere an den Abladeplatz.
   */
  /*
   * Seit E-140 gilt zuerst, was festgelegt ist (`legeAbladestelleFest`,
   * `rueckeVor`, Abfahrt vom Warteplatz) — auch fuer die Silo-Kipper. Die
   * Rechnung danach ist nur der Rueckfall fuer einen Wagen, der noch nicht
   * losgefahren ist.
   */
  private get routeApproach(): Array<[number, number]> {
    if (this.meineAnfahrt) return this.meineAnfahrt;
    if (this.isPickup) return pickupApproach();
    const mulde = this.zielMulde;
    return mulde ? bayApproach(mulde) : routeApproach();
  }
  private get routeRev(): Array<[number, number]> {
    if (this.meinRueckweg) return this.meinRueckweg;
    if (this.isPickup) return pickupInRev();
    const mulde = this.zielMulde;
    return mulde ? bayInRev(mulde) : routeInRev();
  }
  private get routeOut(): Array<[number, number]> {
    if (this.ausfahrtVomPlatz) return this.ausfahrtVomPlatz;
    if (this.meineAusfahrt) return this.meineAusfahrt;
    if (this.isPickup) return pickupOut();
    const mulde = this.zielMulde;
    return mulde ? bayOut(mulde) : routeOut();
  }
  /** Die Ausfahrt vom Warteplatz zum Tor (E-140) — gesetzt, wenn die Pause endet. */
  private ausfahrtVomPlatz: Array<[number, number]> | null = null;
  /** Die Strecke zum Warteplatz — Ausfahrt bis zum Abzweig, dann in die Bucht. */
  private get routeParken(): Array<[number, number]> {
    return this.meinParkweg ?? routeToPark(this.routeOut, this.parkSpot ?? PARK_SLOTS[0]!);
  }

  constructor(
    readonly kind: DeliveryKind,
    private scene: THREE.Scene,
    private world: RAPIER.World,
    /** Ist an (x,z) etwas im Weg (Bagger oder liegender Schrott)? Dann wird gewartet. */
    private getBlocker:
      | ((x: number, z: number, r: number, ignore: Set<number>) => boolean)
      | null = null,
    private onHonk: (() => void) | null = null,
    /** Wiegung bei Einfahrt (brutto) bzw. Ausfahrt (netto = brutto − tara) */
    private onWeighIn: ((kg: number) => void) | null = null,
    private onWeighOut: ((netKg: number) => void) | null = null,
    customer: CustomerProfile | null = null,
    /** Absetzkipper: Diese abgesetzte Mulde holt er ab (E-141). */
    holeMulde: AbgesetzteMulde | null = null
  ) {
    this.customer = kind === "abholer" ? null : (customer ?? rollCustomer());
    // Die Tabelle steht in routes.ts — dieselbe, gegen die die Waechter rechnen
    this.bedLen = bedLenFor(kind);
    /*
     * DER AUFBAU WIRD NUR EINMAL GEWUERFELT (15.09.2026).
     *
     * Bis heute stand er zweimal im Spiel: `customers.ts` zog ihn fuer die
     * MASSE (Koffer fasst mehr als flach, also wiegt die Fuhre mehr), und
     * hier wurde unabhaengig davon noch einmal gezogen fuer das MODELL.
     * Statistisch war das dasselbe, im Einzelfall kam ein Kofferaufbau mit
     * einer Flach-Masse an — man sah einen randvollen Kasten und die Waage
     * sagte zwei Tonnen.
     *
     * Jetzt gilt, was am Kunden steht. Der Wurf hier bleibt nur als Rueckfall
     * fuer den Abholer (der hat keinen Kunden) und fuer Pruefstaende, die ein
     * Kundenprofil von Hand bauen.
     */
    this.bodyStyleName =
      this.customer?.aufbau ??
      (this.customer?.group === "haendler"
        ? (["rungen", "rungen", "koffer", "flach"] as const)[Math.floor(Math.random() * 4)]
        : "flach");
    const teile = buildVehicleModel({
      kind: this.kind,
      bedLen: this.bedLen,
      // Schrotthändler fahren ihren eigenen Ladekran mit — Gewerbe und
      // Privatleute nicht. Der Kran laedt nichts ab, er gehoert zum Bild.
      // Ein Einzelstueck (E-126) ragt ueber die Hoehe, auf der der Ausleger
      // liegt (`vehicleModel.auslegerHoehe`) — dieser Wagen kommt ohne Kran.
      withCrane:
        this.customer?.group === "haendler" &&
        !this.customer.einzelstueck &&
        (this.kind === "kipper" || this.kind === "pritsche"),
      // Haendler fahren nicht alle denselben Wagen: mal flache Bordwaende, mal
      // der klassische Rungenaufbau, mal ein geschlossener Kasten. Gewerbe und
      // Privat bleiben flach — sie liefern kein Schuettgut.
      bodyStyle: this.bodyStyleName,
      // Der Lackton haengt am Halter: Derselbe Haendler faehrt denselben Wagen
      halter: this.customer?.name,
      group: this.group,
      bedGroup: this.bedGroup,
      world: this.world,
      sideWalls: this.sideWalls,
      tailGate: null,
      ohneMulde: holeMulde !== null,
    });
    this.tailGate = teile.tailGate;
    this.crane = teile.crane;
    this.trailer = teile.trailer;
    this.raeder = teile.raeder;
    this.fahrwerk = teile.fahrwerk;
    this.lenkRaeder = teile.lenkRaeder;
    this.absetz = teile.absetz;
    if (holeMulde) {
      this.holMulde = holeMulde;
      this.absetzModus = "holen";
      this.muldeDran = false;
    }
    /*
     * DER HUND AUF DEM BEIFAHRERSITZ (15.09.2026).
     *
     * Er haengt am WAGEN, nicht an der Figur: Er sitzt schon da, wenn der
     * Kipper durchs Tor rollt, und er bleibt sitzen, wenn sein Herrchen zum
     * Kaffeewagen geht. Er wird nicht simuliert, hat keinen Koerper und kein
     * Verhalten — er ist ein Netz, ohne Schatten (`kundenfigur.baueHund`).
     *
     * Der Platz ist der Beifahrersitz, gespiegelt zum sitzenden Fahrer in
     * `vehicleModel.ts` (x −0,45 / y 1,62 / z bedLen/2 + 0,75). Er sitzt
     * tiefer, weil seine Pfoten auf dem Sitz stehen.
     *
     * NUR IM LKW-FAHRERHAUS. Der PKW hat ein eigenes, in sich gerechnetes
     * Gehaeuse (`buildCarAndTrailer`), und das gehoert einem anderen Paket.
     * Ein Privatmann mit Hund faehrt deshalb heute ohne — offene Frage 2 im
     * Log.
     */
    const hund = this.kind === "pkw" ? null : baueHund(this.customer?.aussehen ?? AUSSEHEN_NEUTRAL);
    if (hund) {
      hund.position.set(0.45, 1.3, this.bedLen / 2 + 0.72);
      hund.scale.setScalar(0.95);
      hund.rotation.y = -0.22; // schaut leicht zur Tuer, nicht stur geradeaus
      this.group.add(hund);
    }
    this.federung = new Federung(federungsDatenFuer(this.kind, this.bedLen));
    /*
     * WER SICH SENKT. Beim LKW die ganze gefederte Einheit: Rahmen,
     * Fahrerhaus, Flaeche und Ladung — die Raeder bleiben stehen. Beim Gespann
     * nur der Anhaenger, und der hebt sich nicht, sondern NICKT um seine
     * Kupplung: Die haelt der Zugwagen fest.
     *
     * `YXZ` ist Pflicht und kein Geschmack. In der Vorgabe `XYZ` liegt die
     * Nickachse in der WELT — ein Wagen, der nach Osten faehrt, wuerde damit
     * nicht nicken, sondern sich zur Seite legen. Mit `YXZ` wird erst
     * gegiert und dann um die eigene Querachse genickt.
     */
    this.federZiel = teile.trailer ?? this.group;
    this.federHebt = teile.trailer === null;
    this.federZiel.rotation.order = "YXZ";
    scene.add(this.group);
    this.chassisBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    // Oberkante MUSS unter dem Muldenboden (0,99 m) liegen UND das Chassis darf
    // NICHT hinter das Muldenheck ragen — sonst landet abgekippte Ladung auf dem
    // Chassis und fährt mit dem LKW davon
    if (kind === "pkw") {
      // Nur das Zugfahrzeug haengt am starren Rahmen. Der LKW-Kollider entfaellt
      // hier: Er deckte die Anhaengerflaeche ab, und die schwenkt jetzt am
      // Gelenk weg — ein starrer Kasten darueber waere schlicht falsch. Der
      // Anhaenger ist ueber die Ladeflaechen-Koerper vorhanden, die dem Gelenk
      // folgen.
      const zugZ = this.bedLen + 1.05 + 0.35 + 2.15;
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.95, 0.8, 2.3).setTranslation(0, 0.9, zugZ),
        this.chassisBody
      );
    } else {
      /*
       * Der Rahmen liegt UNTER der Mulde und ist schmaler als sie.
       *
       * Vorher war er ein Kasten von 2,2 m Breite und reichte bis y 0,92 — der
       * Muldenboden beginnt aber schon bei y 0,49. Beide Koerper sind
       * kinematisch und ueberschnitten sich damit um 43 cm. Beim Kippen wurde
       * die Ladung zwischen ihnen eingeklemmt: Zwei kinematische Koerper haben
       * fuer den Loeser unendliche Masse, er drueckt das Teil mit Gewalt
       * heraus. Gemessen 258 km/h, und danach lag es auf dem Rahmendeck,
       * waehrend die Mulde darueber wegkippte — genau die Beanstandung
       * „das Material bleibt auf dem Chassis und taucht unter der Ladeflaeche".
       *
       * Jetzt endet der Rahmen 4 cm unter dem Muldenboden und ist mit 1,1 m
       * schmaler als die Mulde (2,7 m). Was ueber die Muldenkante rutscht,
       * faellt daran vorbei zu Boden, statt auf einem Deck liegenzubleiben.
       * Solide bleibt der LKW trotzdem: Darueber deckt der Muldenkoerper ab.
       */
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.55, 0.185, (this.bedLen + 1.6) / 2).setTranslation(
          0,
          0.265,
          0.8
        ),
        this.chassisBody
      );
    }
    this.bedBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setCcdEnabled(true)
    );
    // Ladefläche: Boden + Wände. Innenbreite MUSS über dem breitesten Großteil
    // liegen (Blechtafel 1,9 m), sonst klemmt die Ladung und die Physik explodiert.
    const halfW = BED_HALF_W;
    /*
     * DIE BRÜCKE IST EIN KEIL, KEIN QUADER (E-071).
     *
     * Hier stand `cuboid(halfW, 0.3, bedLen/2)` auf −0,26: ein 0,60 m dicker
     * Block unter einem 0,12 m dünnen Blech. Beim Kippen dreht die Brücke um
     * ihre hintere Kante, und die 0,60 m hohe Rückwand dieses Blocks schwenkt
     * dabei 0,60 × sin 58° = 0,51 m nach vorn UNTER die Brücke — genau durch
     * den Raum, durch den die abrutschende Fuhre fällt. Die überstrichene
     * Fläche geht mit dem Quadrat der hinteren Dicke.
     *
     * Der Keil läuft nach hinten auf die Blechdicke aus (0,12 m): Vorlauf
     * 0,10 m statt 0,51 m, überstrichener Sektor 0,0073 statt 0,182 m².
     * Herleitung und Maße stehen bei `brueckenKeilEcken` in `vehicleModel.ts`.
     *
     * Vorn bleibt es bei 0,60 m — die Unterkante liegt dort weiter auf −0,56
     * und damit 4 cm über dem Rahmen; nach hinten wächst der Abstand.
     */
    // Der Absetzkipper hat statt der Bruecke seine Mulde: fuenf Kollider im
    // Muldenrahmen (`absetzmulde.ts`). Holt er nur, faehrt er ohne.
    if (teile.absetz) {
      for (const k of teile.absetz.mulde?.kollider ?? []) world.createCollider(k, this.bedBody);
    }
    const keil = teile.absetz ? null : RAPIER.ColliderDesc.convexHull(brueckenKeilEcken(halfW, this.bedLen));
    if (keil) world.createCollider(keil, this.bedBody);
    else if (!teile.absetz) throw new Error("Kippbruecke: konvexe Huelle nicht baubar");
    // Abhol-LKW trägt einen hohen Container, damit geladenes Material hält
    const wh = kind === "abholer" ? 1.25 : 0.32;
    // Seitenwände sind eigene bewegliche Körper (siehe buildMeshes) — hier nur
    // die feste Stirnwand und ggf. die Heckklappe
    const walls: Array<[number, number, number, number, number]> = [
      [0, wh, this.bedLen, halfW, 0.05], // vordere Wand (zur Kabine)
    ];
    if (kind !== "kipper") walls.push([0, wh, 0, halfW, 0.05]); // Heckklappe nur bei Pritschen
    for (const [wx, wy, wz, hx, hz] of teile.absetz ? [] : walls) {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(hx, wh, hz).setTranslation(wx, wy, wz),
        this.bedBody
      );
    }
    if (this.absetz && !this.muldeDran) {
      // Holt er nur: der leere Rahmen steht dort, wo sonst die Mulde steht
      this.bedGroup.position.set(0, this.absetz.geo.muldeY, this.absetz.geo.muldeZ - ABSETZMULDE.laenge / 2);
    }
    this.stelleAbsetzanlage();
    this.placeAt(this.routeIn, 0);
    this.wendeFederungAn();
    this.federLetztePos.copy(this.group.position);
    // Kinematische Körper SOFORT an den Routenstart setzen. Ohne das stehen sie
    // einen Frame lang im Ursprung — mitten auf der Annahmefläche — und
    // schleudern den dort liegenden Schrott quer über den Platz.
    this.snapBodiesToPose();
  }

  /* ------------------------------------------------ Federung, Anwendung -- */

  /**
   * Die gerechnete Einfederung auf das Modell übertragen.
   *
   * Drei Zeilen Wirkung: Die gefederte Gruppe sinkt um die Einfederung an
   * ihrem Ursprung, sie nickt um die Steigung zwischen den beiden Achsfedern,
   * und jedes Radteil wird um genau das zurückgeschoben, was die Gruppe an
   * seiner Längsstelle abgesunken ist — deshalb bleiben die Räder auf dem
   * Boden.
   *
   * KEIN NEUES NETZ. Es sind dieselben Meshes wie vorher, nur um ein paar
   * Zentimeter versetzt. Die Ladung braucht überhaupt keine Zeile: Sie hängt
   * an der Ladeflächengruppe und wird ohnehin aus deren Weltlage nachgeführt.
   */
  private wendeFederungAn(): void {
    const hub = this.federHebt ? -this.federung.einfederung(0) : 0;
    const neigung = this.federung.neigung;
    this.federZiel.position.y = hub;
    this.federZiel.rotation.x = neigung;
    for (const rad of this.raeder) {
      rad.mesh.position.y = rad.y0 - hub + neigung * rad.z;
    }
  }

  /**
   * Was auf der Fläche liegt — Gewicht, Längsschwerpunkt, und wer neu
   * dazugekommen ist.
   *
   * Nicht jedes Bild, sondern alle 50 ms: Die Feder schwingt mit höchstens
   * 2,6 Hz, da reichen zwanzig Messungen je Sekunde, und die Schleife läuft
   * über alle Teile des Platzes.
   *
   * Der Stoß entsteht aus dem Unterschied zur vorigen Messung: Ein Körper, der
   * vorher nicht auf der Fläche lag und jetzt schon, überträgt seine
   * Abwärtsgeschwindigkeit. Wer sanft absetzt, gibt fast nichts — genau das
   * ist die „Kraftübertragung durch Bagger/Körper" aus der Ansage.
   */
  private messeLast(dt: number): void {
    this.lastProbeT -= dt;
    if (this.lastProbeT > 0) return;
    this.lastProbeT = 0.05; // s (SW) — 20 Messungen je Sekunde
    this.bedGroup.updateWorldMatrix(true, false);
    this.bedInv.copy(this.bedGroup.matrixWorld).invert();
    const reitend = new Set<number>();
    for (const r of this.riding) {
      if (r.body.isValid()) reitend.add(r.body.handle);
    }
    // Waehrend `settleCargo` faellt die frisch erzeugte Fuhre erst auf die
    // Flaeche. Das ist kein Abladen, sondern das Entstehen des Wagens — es
    // darf die Feder nicht anstossen.
    const stoesseZaehlen = this.phase !== "settleCargo";
    const neu = new Set<number>();
    let kg = 0;
    let moment = 0;
    const pruefe = (body: RAPIER.RigidBody, massKg: number): void => {
      if (!body.isValid() || !Number.isFinite(massKg) || massKg <= 0) return;
      // In der Spinne haengende Teile traegt der Bagger, nicht der LKW.
      // Mitfahrende Ladung ist ebenfalls kinematisch, zaehlt aber sehr wohl.
      if (!body.isDynamic() && !reitend.has(body.handle)) return;
      const p = body.translation();
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) return;
      this.probePos.set(p.x, p.y, p.z).applyMatrix4(this.bedInv);
      if (Math.abs(this.probePos.x) > BED_HALF_W + 0.35) return;
      if (this.probePos.z < -0.4 || this.probePos.z > this.bedLen + 0.4) return;
      if (this.probePos.y < -0.4 || this.probePos.y > 3.4) return;
      // Ladeflaechen-z in Fahrzeug-z: der Versatz der Flaeche in ihrer Gruppe
      const z = this.bedGroup.position.z + this.probePos.z;
      kg += massKg;
      moment += massKg * z;
      neu.add(body.handle);
      if (stoesseZaehlen && !this.aufFlaeche.has(body.handle)) {
        this.federung.stoss(massKg, -body.linvel().y, z);
      }
    };
    const quelle = this.itemQuelle?.items ?? this.cargo.items;
    for (const it of quelle) pruefe(it.body, it.massKg);
    if (this.cargo.car) pruefe(this.cargo.car.body, WRACK_KG);
    this.aufFlaeche = neu;
    this.federung.setzeLast(kg, kg > 0 ? moment / kg : 0);
  }

  /**
   * Ein Federschritt: Tempo melden, Last messen, rechnen, anwenden.
   *
   * Die Reihenfolge ist Absicht. Erst das Tempo (daraus wird das Nicken beim
   * Anfahren und Bremsen), dann die Last, dann der Zeitschritt — und erst ganz
   * zuletzt das Modell versetzen, damit die Körper, die gleich danach
   * nachgeführt werden, die neue Lage schon sehen.
   */
  private updateFederung(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    /*
     * ANGEHOBENE MULDE FEDERT NICHT.
     *
     * Ist die Mulde gekippt, steht sie auf dem Kipplager und dem Hubzylinder;
     * sie liegt nicht mehr frei auf dem Rahmen. Die Federung hält deshalb
     * ihre Stellung, bis die Mulde wieder unten ist.
     *
     * DAS IST EINE VORSICHTSMASSNAHME, KEINE GEMESSENE VERBESSERUNG — und der
     * Unterschied gehört hierher, weil er beim Messen fast falsch abgelesen
     * worden wäre.
     *
     * Der Kipper-Katapult (Spitzentempo der Ladung beim Abkippen) ist eine
     * CHAOTISCHE Größe: Bei identischem Quelltext und 24 Zufallssaaten liegen
     * die Einzelwerte zwischen 53 und 373 km/h. Der Standardfehler des Mittels
     * ist rund 16 km/h, der einer paarweisen Differenz ebenso. Über 24 Saaten,
     * paarweise gegen dieselben Ladungen gerechnet:
     *
     *   ohne Federung                   Mittel 123   Höchst 373 km/h
     *   Federung auch beim Kippen frei  Mittel 110   Höchst 347 km/h
     *   Federung beim Kippen gesperrt   Mittel 118   Höchst 293 km/h
     *
     * Paarweise Differenz gesperrt − ohne: −5 ± 16 km/h. Es gibt also KEINEN
     * nachweisbaren Unterschied zwischen den drei Ständen; wer hier eine
     * Verbesserung behauptet, liest Rauschen. Geblieben ist die Sperre aus
     * zwei Gründen, die nicht am Mittelwert hängen:
     *
     *   — Mechanik: Eine Fläche, die sich unter der abrutschenden Fuhre hebt
     *     und senkt, kann Stücke in den bekannten Schlitz am Kipplager
     *     schieben, und dort befreit der Löser sie mit einem einzigen sehr
     *     großen Stoß (zwei kinematische Körper haben für ihn unendliche
     *     Masse — E-029, `docs/offene-punkte.md`). Energie in genau diesem
     *     Moment zuzuführen ist das einzige, was man sicher vermeiden kann.
     *   — Der HÖCHSTWERT ist mit der Sperre in beiden Messreihen der
     *     niedrigste (231 und 293 gegen 546 und 347 ohne Sperre). Ein
     *     Höchstwert aus 24 Würfen ist schwach, aber er zeigt in dieselbe
     *     Richtung wie die Mechanik.
     *
     * Zu sehen ist von der Sperre nichts: Während des Kippens bewegt sich
     * ohnehin alles.
     */
    if (this.tip > 0.02) {
      this.wendeFederungAn();
      return;
    }
    const dx = this.group.position.x - this.federLetztePos.x;
    const dz = this.group.position.z - this.federLetztePos.z;
    const yaw = this.group.rotation.y;
    /*
     * Beim Wechsel der Route springt der Wagen gelegentlich ein Stueck (neue
     * Bogenlaenge auf einer anderen Polylinie). Ungedeckelt wuerde daraus eine
     * Beschleunigung von hundert m/s² und die Feder schluege an.
     */
    const roh = (Math.sin(yaw) * dx + Math.cos(yaw) * dz) / dt;
    const deckel = SPEED * 1.2;
    this.federung.meldeTempo(Math.min(Math.max(roh, -deckel), deckel), dt);
    this.federLetztePos.copy(this.group.position);
    this.messeLast(dt);
    this.federung.schritt(dt);
    this.wendeFederungAn();
  }

  /** Chassis + Ladefläche hart auf die aktuelle Mesh-Pose setzen (kein Interpolieren). */
  private snapBodiesToPose(): void {
    this.group.updateWorldMatrix(true, true);
    const cq = new THREE.Quaternion();
    this.group.getWorldQuaternion(cq);
    this.chassisBody.setTranslation(this.group.position, false);
    this.chassisBody.setRotation({ x: cq.x, y: cq.y, z: cq.z, w: cq.w }, false);
    const bp = new THREE.Vector3();
    const bq = new THREE.Quaternion();
    this.bedGroup.getWorldPosition(bp);
    this.bedGroup.getWorldQuaternion(bq);
    this.bedBody.setTranslation({ x: bp.x, y: bp.y, z: bp.z }, false);
    this.bedBody.setRotation({ x: bq.x, y: bq.y, z: bq.z, w: bq.w }, false);
  }

  /**
   * Privatleute kommen nicht mit dem LKW, sondern mit dem eigenen Wagen und
   * einem Anhänger — oder mit einem Kastenwagen. Das macht sie auf den ersten
   * Blick von Gewerbe und Händlern unterscheidbar (Wunsch 02.09.2026).
   */

  /**
   * Ladung auf der Fläche platzieren — DYNAMISCH: sie setzt sich in der
   * settleCargo-Phase erst physisch auf die Mulde (löst Überlappungen auf),
   * dann wird sie für die Fahrt verriegelt. Kinematisch spawnen würde beim
   * Freigeben explodieren.
   */
  /**
   * Wie voll die Ladefläche beladen wurde (0..1, Hüllvolumen der Stücke).
   *
   * Nach außen sichtbar, weil genau daran die Ansage hängt: „Händler kommen
   * erst, wenn der Wagen voll beladen ist, sollten aber nie unter 30 %
   * liegen" (12.09.2026). Ohne Messwert wäre das eine Behauptung.
   */
  ladeFuellung = 0;

  /**
   * Der Verbund-Verwalter, gemerkt beim Beladen. Gebraucht wird er genau
   * einmal: Faehrt ein Wrack unverrichtet wieder vom Hof (E-082), muss die
   * Karosse mit — und sie liegt nicht im `ItemManager`, sondern hier.
   */
  private composites: CompositeManager | null = null;

  /**
   * Der Laderaum dieses Wagens — EINE Rechnung fuer Beladen und „voll" (E-120).
   *
   * Stand bis zum 06.10.2026 mitten in `loadCargo`. Seit der Abholer im
   * Sandkasten von selbst losfaehrt, wenn er voll ist, fragt auch er danach;
   * zwei Abschriften derselben Formel waeren die Fehlerklasse aus E-044/E-070.
   *
   * DER PKW-ANHAENGER IST KEIN LKW (15.09.2026).
   *
   * Gepackt wurde er bis heute mit LKW-Massen: 2,54 m breit und bis 0,99 m
   * hoch. In Wirklichkeit ist er 1,74 m breit (Boden 1,86, Bordwaende 0,06
   * bei x = ±0,90) und hat 0,34 m Bordwand. Die Volumenrechnung in
   * `fuellgrad.ts` nimmt die echten Masse — diese Stelle noch nicht, und
   * damit standen die Teile eines „vollen" Anhaengers zur Haelfte neben ihm.
   * Beide lesen jetzt dieselben Konstanten.
   */
  private laderaum(): { halbBreite: number; nutzLaenge: number; maxHoehe: number; raum: number } {
    if (this.absetz) {
      // Die Mulde (E-141): gepackt wird auf ihrem Boden, die Stirnwaende
      // laufen nach aussen. Dieselbe Rechnung wie `fuellgrad.ladeVolumen`.
      const halbBreite = ABSETZ_HALB_BREITE;
      const nutzLaenge = ABSETZMULDE.laenge * ABSETZMULDE.bodenAnteil - 2 * LADE_RAND;
      const maxHoehe = ladeHoeheGrenze(ABSETZ_WAND, !!this.customer?.einzelstueck);
      return { halbBreite, nutzLaenge, maxHoehe, raum: halbBreite * 2 * nutzLaenge * maxHoehe };
    }
    const anhaenger = this.kind === "pkw";
    const halbBreite = anhaenger ? ANHAENGER_HALB_BREITE : BED_HALF_W - 0.08;
    const nutzLaenge = this.bedLen - 2 * LADE_RAND;
    const maxHoehe = ladeHoeheGrenze(
      anhaenger ? ANHAENGER_WAND : wandHoehe(this.kind, this.bodyStyleName),
      !!this.customer?.einzelstueck
    );
    return { halbBreite, nutzLaenge, maxHoehe, raum: halbBreite * 2 * nutzLaenge * maxHoehe };
  }

  loadCargo(items: ItemManager, composites: CompositeManager): void {
    this.composites = composites;
    this.group.updateWorldMatrix(true, true);
    if (this.isPickup) return; // Abholer kommt leer — der Spieler belädt ihn
    if (this.holtNur) return; // holt nur eine abgesetzte Mulde (E-141)
    if (this.kind === "wrack") {
      // E-135: Auch ein Wohnwagen kommt auf dem Abschlepper — rückwärts, der
      // Kasten an der Stirnwand, die Deichsel über das Heck (`ladeVersatz`).
      const art = this.customer?.wrackArt ?? "pkw";
      const lage = WRACKDATEN[art];
      const pos = new THREE.Vector3(0, 0.25, this.bedLen / 2 + (lage.ladeVersatz ?? 0));
      this.bedGroup.localToWorld(pos);
      this.cargo.car = composites.spawnCar(pos, art);
      const q = new THREE.Quaternion();
      this.group.getWorldQuaternion(q);
      if (lage.ladeRueckwaerts) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
      this.cargo.car.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
      return;
    }
    /*
     * Wie voll ein Wagen ankommt.
     *
     * Befund 12.09.2026: „die Schrott-LKW sind viel zu oft zu leer.
     * Normalerweise kommen Haendler erst, wenn der Wagen voll beladen ist,
     * sollten aber nie unter 30 % liegen."
     *
     * Vorher wurde eine feste Stueckzahl gewuerfelt — zehn bis dreizehn, davon
     * die Haelfte Grossteile — und danach gepackt. Was nicht passte, fiel weg.
     * Gemessen landeten so oft nur ein oder zwei Stuecke auf der Flaeche, und
     * weil die angekuendigte Menge hinterher auf das heruntergeschrieben wird,
     * was wirklich oben liegt, kam ein Haendler mit 251 kg an statt mit den
     * gewuerfelten 2,5 bis 9 Tonnen.
     *
     * Jetzt wird nicht mehr gewuerfelt, sondern geladen, bis der Wagen voll
     * ist: Erst ein paar Brocken, dann Nachschub in kleineren Stuecken, bis
     * der Fuellgrad stimmt. Ein Haendler faehrt nicht mit einem Blech auf der
     * Pritsche los.
     */
    const c = this.customer;
    const klein = c?.group === "privat";
    const einzel = c?.einzelstueck ?? null;
    // Jede vierte grosse Fuhre bringt ein Schwergewicht — Tank, Fahrerhaus,
    // Drehgestell. Dann passt weniger daneben, das ist gewollt.
    const schwer = !einzel && !klein && !this.sortedMaterial && Math.random() < 0.28;
    /*
     * DER FUELLGRAD KOMMT VOM KUNDEN (15.09.2026, E-033 zu Ende gebracht).
     *
     * Seit E-033 wird die angekuendigte Menge aus dem Fuellgrad gerechnet:
     * Masse = Fuellgrad × Laderaum × Schuettdichte. Diese Stelle hier wusste
     * nichts davon und wuerfelte ihre EIGENE Zielfuellung — also sah man die
     * ganze Aenderung nur auf der Waage und nie auf dem Wagen. Ein Haendler,
     * der laut Papier halb voll ankam, stand randvoll vor der Tuer.
     *
     * Jetzt gilt eine Zahl fuer beides. Der alte Wurf bleibt als Rueckfall
     * fuer Pruefstaende, die ein Kundenprofil von Hand bauen.
     */
    const MINDEST_FUELLUNG = 0.3;
    const zielFuellung =
      c && Number.isFinite(c.fuellgrad) && c.fuellgrad > 0
        ? Math.min(1, c.fuellgrad)
        : klein
          ? MINDEST_FUELLUNG + Math.random() * 0.3
          : c?.group === "gewerbe"
            ? 0.68 + Math.random() * 0.24
            : 0.78 + Math.random() * 0.18;
    /*
     * Die Mindestfuellung darf das Ziel nicht ueberholen.
     *
     * Sie stand als feste 0,3 in der Abbruchbedingung weiter unten. Mit einem
     * gewuerfelten Ziel von 0,78 aufwaerts fiel das nie auf; mit dem Fuellgrad
     * des Kunden schon: Eine viertelvolle Fuhre (0,22 bis 0,38, rund jede 30.)
     * waere von der alten Schranke wieder auf 0,3 hochgeladen worden — genau
     * die Fuhre, die selten sein SOLL, haette es nie gegeben.
     */
    const mindestFuellung = Math.min(MINDEST_FUELLUNG, zielFuellung);

    const { halbBreite, nutzLaenge, maxHoehe, raum } = this.laderaum();

    type Spec = { materialId: string; massKg: number; shape: ScrapShape };
    let specs: Spec[] = [];
    let stuecke = [] as ReturnType<typeof stueckMass>[];
    let plaetze: Array<ReturnType<typeof packeLadung>[number]> = [];
    let fuellung = 0;
    /*
     * Runde fuer Runde nachladen. Die erste Runde bringt die Brocken, jede
     * weitere kleineres Zeug, das in die Luecken geht — genau so packt man
     * einen Wagen auch in Wirklichkeit. `packeLadung` sortiert intern
     * ohnehin gross zuerst, deshalb wird jedes Mal neu gepackt statt
     * angestueckelt.
     */
    /*
     * DIE EINZELSTUECK-FUHRE (E-126): genau ein Teil, MITTEN auf die Flaeche.
     * `packeLadung` setzt ein Stueck an die erste tiefste Stelle, also in die
     * vordere linke Ecke — fuer eine Fuhre aus Kleinkram richtig, fuer einen
     * Minibagger nicht: Er soll mittig liegen, wo die Spinne ihn von oben
     * fasst und die Federung ihn gleich auf beide Achsen verteilt. Ob er
     * laengs oder quer liegt, sagt weiter `packeLadung`.
     */
    if (einzel) {
      specs = [
        {
          materialId: einzel.materialId,
          massKg: einzel.massKg,
          shape: {
            kind: einzel.kind,
            dims: einzel.dims,
            color: getMaterial(einzel.materialId).color,
            bau: einzel.bau,
            name: einzel.name,
            zusammensetzung: einzel.zusammensetzung,
            massiv: einzel.massiv,
            trennbar: einzel.trennbar,
            nurWerkzeug: einzel.nurWerkzeug,
          },
        },
      ];
      stuecke = [stueckMass(einzel.kind, einzel.dims)];
      const lage = packeLadung(stuecke, halbBreite, nutzLaenge, maxHoehe)[0];
      plaetze = [{ x: 0, y: 0, z: nutzLaenge / 2, quer: lage?.quer ?? false }];
      fuellung = raum > 0 ? deckelVolumen(einzel.kind, einzel.dims) / raum : 0;
    }
    /*
     * DIE SPÄNEMULDE (E-147): geschüttet statt gepackt. Der Packer rechnet mit
     * 0,20-m-Raster und 0,12 m Luft je Stück — für Knäuel von einem halben
     * Meter blieb die Mulde damit zu vier Fünfteln leer (gemessen: 21 Knäuel
     * auf dem Boden). Das Gitter in `spaeneSchuettung` setzt sie Lage für Lage
     * bis an den Rand, ohne Überlappung.
     */
    if (!einzel && c?.spaene) {
      const lagen = spaeneSchuettung(halbBreite, nutzLaenge, maxHoehe, zielFuellung);
      specs = spaeneCargo(lagen.length);
      stuecke = specs.map((sp) => stueckMass(sp.shape.kind, sp.shape.dims));
      plaetze = lagen.map((l) => ({ ...l, quer: false }));
      fuellung = raum > 0 ? specs.reduce((a2, sp) => a2 + deckelVolumen(sp.shape.kind, sp.shape.dims), 0) / raum : 0;
    }
    let leerlauf = 0;
    for (let runde = 0; !einzel && !c?.spaene && runde < 12 && fuellung < zielFuellung; runde++) {
      const erste = runde === 0;
      /*
       * Die erste Runde richtet sich nach dem ZIEL, nicht nach der Bauart.
       *
       * Sie warf bisher immer acht Brocken auf die Flaeche (vier beim
       * Privatmann) und pruefte erst danach, ob das Ziel schon ueberschritten
       * ist. Bei einer randvollen Fuhre faellt das nicht auf; bei einer
       * viertelvollen schon: Gemessen kam sie mit 43 % statt 25 % an — der
       * erste Wurf allein war groesser als die ganze Bestellung. Damit war
       * gerade die seltene, kleine Fuhre die einzige, die man nicht zu sehen
       * bekam.
       */
      const brocken = Math.max(2, Math.round((klein ? 4 : 8) * zielFuellung));
      const nachschub = randomCargo(
        erste ? brocken : Math.max(2, Math.round(6 * zielFuellung)),
        erste ? 0.5 : 0.08,
        erste && schwer ? 0.55 : 0,
        this.sortedMaterial ?? undefined
      );
      /*
       * DIE ERSTE RUNDE LEGT EINZELN AUF (E-105).
       *
       * Sie warf ihre Brocken bisher alle auf einmal und pruefte erst danach,
       * ob das Ziel ueberschritten ist. Solange die Haelfte davon ohnehin
       * wieder wegfiel, ist das nie aufgefallen. Seit sie liegenbleiben, tut
       * es das: Eine viertelvolle Fuhre kam mit 44 % an, obwohl sie 25 %
       * bestellt hatte — genau der Befund, den E-033/E-044 schon einmal
       * beseitigt haben, nur eine Stufe tiefer.
       *
       * Zwei Brocken sind bei einem Viertel eben schon die ganze Bestellung.
       * Also zwei Regeln, beide ohne gewaehlte Zahl:
       *
       *   1. Einzeln auflegen und aufhoeren, sobald das Ziel steht.
       *   2. EIN Stueck darf nicht allein groesser sein als die ganze
       *      Bestellung. Wer eine viertelvolle Fuhre ankuendigt, bringt keine
       *      Zwei-Tonnen-Maschine mit; er bringt Kleinkram.
       *
       * Bleibt danach nichts uebrig, kommt trotzdem das kleinste Stueck des
       * Wurfs drauf — eine Fuhre aus null Teilen gibt es nicht.
       */
      const anteil = (sp: (typeof nachschub)[number]): number =>
        raum > 0 ? deckelVolumen(sp.shape.kind, sp.shape.dims) / raum : 0;
      const kandidaten = [...specs];
      let steht = fuellung;
      for (const sp of nachschub) {
        // Was den Wagen ueber die Bestellung heben wuerde, bleibt beim Kunden
        // im Hof stehen. Uebersprungen, nicht abgebrochen: Vielleicht passt
        // das naechste Stueck noch.
        if (steht > 0 && steht + anteil(sp) > zielFuellung) continue;
        kandidaten.push(sp);
        const probe = packeLadung(
          kandidaten.map((k) => stueckMass(k.shape.kind, k.shape.dims)),
          halbBreite,
          nutzLaenge,
          maxHoehe
        );
        steht =
          raum > 0
            ? kandidaten.reduce(
                (a2, k, i) => a2 + (probe[i] ? deckelVolumen(k.shape.kind, k.shape.dims) : 0),
                0
              ) / raum
            : 0;
      }
      // Eine Fuhre aus null Teilen gibt es nicht: Passt gar nichts, kommt das
      // kleinste Stueck des Wurfs trotzdem drauf.
      if (erste && kandidaten.length === specs.length && nachschub.length > 0) {
        kandidaten.push(
          nachschub.reduce((a2, b) => (anteil(b) < anteil(a2) ? b : a2), nachschub[0]!)
        );
      }
      const st = kandidaten.map((sp) => stueckMass(sp.shape.kind, sp.shape.dims));
      const pl = packeLadung(st, halbBreite, nutzLaenge, maxHoehe);
      const liegen = pl.filter(Boolean).length;
      // Deckel auf die Stueckzahl: Jedes Stueck ist ein eigener Physikkoerper.
      // Bei sortenreinen Fuhren aus Kleinteilen kamen gemessen 42 auf eine
      // Flaeche — das fuellt zwar schoen, kostet aber jedes Bild Rechenzeit.
      if (liegen > 28 && !erste) break;
      /*
       * Der Fuellgrad rechnet mit `deckelVolumen`, nicht mit dem echten
       * Huellvolumen — siehe die Begruendung dort. Kurz: Mit dem echten
       * Volumen ist eine Fuhre erst bei doppelt so vielen Koerpern voll, und
       * das ist eine Budget- und Gestaltungsfrage, keine Reparatur.
       */
      const belegt = kandidaten.reduce(
        (a2, sp, i) =>
          a2 + (pl[i] ? deckelVolumen(sp.shape.kind, sp.shape.dims) : 0),
        0
      );
      const neueFuellung = raum > 0 ? belegt / raum : 0;
      const dazu = neueFuellung - fuellung;
      specs = kandidaten;
      stuecke = st;
      plaetze = pl;
      fuellung = neueFuellung;
      /*
       * Abbrechen erst, wenn zwei Runden hintereinander nichts mehr bringen
       * UND die Mindestfuellung steht. Mit nur einer Runde Geduld blieb es
       * gelegentlich bei fuenf Stuecken haengen: Der erste Wurf legte ein
       * Grossteil quer, und der naechste Nachschub fand zufaellig nichts, was
       * daneben passte (gemessen: ein Haendler mit 305 kg).
       */
      if (!erste && dazu < 0.01) {
        leerlauf++;
        if (leerlauf >= 2 && fuellung >= mindestFuellung) break;
        if (leerlauf >= 5) break;
      } else {
        leerlauf = 0;
      }
    }

    const bedQuat = new THREE.Quaternion();
    this.bedGroup.getWorldQuaternion(bedQuat);
    /*
     * Gewicht auf die angekuendigte Menge bringen — und zwar an den Stuecken,
     * die wirklich oben liegen.
     *
     * Vorher lief das in zwei Stufen: erst alle Specs auf die Kundenmenge
     * skalieren, dann das Fehlende der weggefallenen Stuecke auf die
     * liegenden umlegen. Beide Stufen waren gedeckelt, und beide rechneten
     * mit Stuecken, die nachher gar nicht auf der Flaeche lagen — gemessen
     * kam ein Haendler mit 1,7 t an statt mit den gewuerfelten 2,5 bis 9 t.
     *
     * Jetzt zaehlt nur, was liegt: Die Summe der liegenden Stuecke wird auf
     * die Kundenmenge gezogen. Der Deckel bleibt, damit kein Blech zwei
     * Tonnen wiegt — greift er, faehrt der Kunde eben mit weniger vor, und
     * die Waage sagt das auch.
     */
    this.ladeFuellung = fuellung;

    const draufIdx = specs.map((_, i) => i).filter((i) => plaetze[i]);
    const summeDrauf = draufIdx.reduce((a2, i) => a2 + specs[i]!.massKg, 0);
    /*
     * Der Deckel haengt an der Dichte, nicht an einem festen Faktor.
     *
     * Vorher stand hier ein Ausgleich von hoechstens 2,2 — und der reichte
     * nie: Zehn Stuecke wiegen von Natur aus rund eine Tonne, ein Haendler
     * bringt zwei bis neun. Gemessen kam er mit 1,7 t an. Ein fester Faktor
     * ist dafuer auch das falsche Mass; die Frage ist nicht, wie stark man
     * skaliert, sondern was ein Stueck dieser Groesse ueberhaupt wiegen kann.
     *
     * 2600 kg/m³ ist die Grenze: dichter Stahlschrott liegt bei 2000 bis
     * 2500, massiver Stahl bei 7850 — aber ein massiver Block dieser Groesse
     * waere kein Schrottstueck mehr, sondern ein Amboss. Der Faktor 0,55 auf
     * das Huellvolumen traegt dem Rechnung, dass kaum ein Stueck seinen
     * Quader ausfuellt.
     *
     * Das HUELLVOLUMEN ist keines: Es ist das Quadrat der Grundriss-Diagonale
     * mal Bauhoehe, nicht Breite mal Laenge mal Hoehe. Bei einem Blech von
     * 1,90 m x 1,50 m sind das 5,86 m² Grundflaeche statt 2,85 m². Das steht
     * seit E-105 in `ladung.deckelVolumen` — mit Absicht unveraendert, samt
     * der Messung, was eine Berichtigung kosten wuerde (rund 18 % Tagesgeld).
     * Es zu aendern ist eine Wirtschaftsentscheidung, keine Aufraeumarbeit.
     */
    const DICHTE_MAX = 2600;
    const grenze = (i: number): number =>
      DICHTE_MAX * deckelVolumen(specs[i]!.shape.kind, specs[i]!.shape.dims) * 0.55;
    const gewicht = new Map<number, number>();
    for (const i of draufIdx) gewicht.set(i, specs[i]!.massKg);
    // Ein Einzelstueck wiegt, was es wiegt — die Kundenmenge IST sein Gewicht.
    if (c && summeDrauf > 0 && !einzel) {
      /*
       * DAS UMLEGEN HAT DIE FUHRE AUFGEFRESSEN (Befund 15.09.2026, E-044).
       *
       * Gemeint war: erst die Kundenmenge proportional auf die liegenden
       * Stuecke verteilen, dann das, was am Dichte-Deckel haengengeblieben
       * ist, auf die Stuecke mit Luft umlegen. Der zweite Durchgang hat aber
       * `gewicht.set(i, neu2)` geschrieben statt dazugezaehlt — er ERSETZTE
       * also die volle Zuteilung aus dem ersten Durchgang durch den Anteil am
       * kleinen Restbetrag.
       *
       * Gemessen an zwanzig gewuerfelten Fuhren: Ein Haendler kuendigte 8500
       * kg an und lieferte 105 kg; einer mit 9500 kg brachte 821. Rund jede
       * vierte Fuhre verlor auf diesem Weg mehr als die Haelfte, und zwar
       * ausgerechnet die vollen — je mehr Stuecke am Deckel haengen, desto
       * kleiner der Rest, mit dem der zweite Durchgang die anderen ueberschrieb.
       *
       * Das ist genau der Fehler, den E-033 schon einmal beseitigen sollte
       * („gemessen kam ein Haendler mit 1,7 t an statt mit 2,5 bis 9 t") — er
       * sass nur eine Stufe tiefer und ist erst aufgefallen, seit die Waage
       * und der Anblick des Wagens dieselbe Zahl benutzen.
       *
       * Jetzt wird AUFGEFUELLT statt ueberschrieben: Jede Runde legt oben
       * drauf, der Deckel kappt, und was nicht untergebracht ist, geht in die
       * naechste Runde. Vier Runden reichen; danach haengt praktisch alles am
       * Deckel, und was dann noch offen ist, kann der Wagen wirklich nicht
       * tragen.
       */
      for (const i of draufIdx) gewicht.set(i, 0);
      let rest = c.massKg;
      for (let runde = 0; runde < 4 && rest > 1; runde++) {
        const offen = draufIdx.filter((i) => gewicht.get(i)! < grenze(i) - 1);
        if (offen.length === 0) break;
        const basis = offen.reduce((a2, i) => a2 + specs[i]!.massKg, 0) || 1;
        const zuVerteilen = rest;
        rest = 0;
        for (const i of offen) {
          const anteil = (specs[i]!.massKg / basis) * zuVerteilen;
          const roh = gewicht.get(i)! + anteil;
          const neu2 = Math.min(roh, grenze(i));
          gewicht.set(i, neu2);
          rest += roh - neu2;
        }
      }
      // Was die Flaeche wirklich traegt, ist die Wahrheit — die Waage sagt es
      // ohnehin, und der Kunde soll an der Waage nicht mehr versprechen.
      (c as { massKg: number }).massKg = Math.round(
        draufIdx.reduce((a2, i) => a2 + gewicht.get(i)!, 0)
      );
    }

    /*
     * Die Vierteldrehung, mit der ein langes Stueck laengs auf den Wagen
     * kommt (E-105). `packeLadung` raeumt den Platz dafuer frei; ohne diese
     * Drehung laege das Modell quer ueber der Luecke, in die es gehoert.
     */
    const quer = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      Math.PI / 2
    );
    const lage = new THREE.Quaternion();
    // In der Mulde (E-141) liegt der Boden hoeher und beginnt hinter der
    // schraegen Stirnwand; sonst wie auf jeder Ladeflaeche.
    const boden = this.absetz ? MULDE_BODEN + 0.02 : LADE_BODEN;
    const vorlauf = this.absetz
      ? (ABSETZMULDE.laenge * (1 - ABSETZMULDE.bodenAnteil)) / 2 + LADE_RAND
      : LADE_RAND;
    specs.forEach((sp, i) => {
      const platz = plaetze[i];
      if (!platz) return;
      sp.massKg = Math.max(1, Math.round(gewicht.get(i) ?? sp.massKg));
      const local = new THREE.Vector3(
        platz.x,
        boden + platz.y + stuecke[i].hoehe / 2,
        vorlauf + platz.z
      );
      this.bedGroup.localToWorld(local);
      lage.copy(bedQuat);
      if (platz.quer) lage.multiply(quer);
      if (c?.spaene) lage.multiply(spaeneDrehung()); // E-147: nicht alle Knaeuel gleich
      const it = items.spawnScrap(sp.materialId, sp.massKg, sp.shape, local, lage);
      // Das Setzen soll niemand sehen: erst wenn die Ladung ruhig liegt,
      // taucht der LKW fertig beladen auf.
      it.mesh.visible = false;
      this.cargo.items.push(it);
    });
  }

  /**
   * Masse, die tatsächlich AUF der Ladefläche liegt — das wiegt die Brückenwaage.
   * Abgekippter Schrott neben dem Fahrzeug darf nicht mitzählen, sonst fiele
   * das Nettogewicht zu niedrig aus.
   */
  /** Rechenhilfe fuer `wiegtMit` — kein neues Feld je Abfrage. */
  private waagePos = new THREE.Vector3();

  /**
   * DAS FENSTER DER BRUECKENWAAGE: Wiegt sie dieses Stueck mit?
   *
   * Stand bis E-082 als anonyme Hilfsfunktion IN `cargoMassKg` und war damit
   * von aussen nicht zu beantworten. Das war genau ein Stueck weit zu eng:
   * Wenn ein Wagen unverrichtet wieder abfaehrt, muss das, was die Waage beim
   * Hereinfahren gezaehlt hat, beim Hinausfahren noch oben liegen — sonst
   * faellt die Differenz an, und der Spieler bekaeme Geld fuer Schrott, der
   * unterwegs vom Blech gerutscht ist.
   *
   * Es ist ABSICHTLICH weiter als `aufDerFlaeche` (bis 5 m hoch statt 3 m):
   * Eine hoch aufgetuermte Fuhre wiegt vollstaendig, auch wenn nur der untere
   * Teil an die Mulde gekoppelt wird.
   */
  private wiegtMit(b: RAPIER.RigidBody, extra = 0): boolean {
    if (!b.isValid()) return false;
    const p = b.translation();
    this.waagePos.set(p.x, p.y, p.z);
    this.bedGroup.worldToLocal(this.waagePos);
    const l = this.waagePos;
    return (
      Math.abs(l.x) < BED_HALF_W + 0.5 + extra &&
      l.z > -0.5 - extra &&
      l.z < this.bedLen + 0.5 + extra &&
      l.y > -0.4 &&
      l.y < 5.0 // hoch aufgetürmte Ladung zählt mit
    );
  }

  cargoMassKg(): number {
    let sum = 0;
    for (const it of this.cargo.items) {
      if (this.wiegtMit(it.body)) sum += it.massKg;
    }
    if (this.cargo.car && this.wiegtMit(this.cargo.car.body, 0.6)) sum += 950;
    return sum;
  }

  /**
   * DIE EINE FRAGE: Liegt dieser Koerper auf meiner Ladeflaeche?
   *
   * Drei Stellen haben sie bis zum 15.09.2026 EINZELN beantwortet, und zwar
   * verschieden (gemessen mit `tools/abholung-abrechnung.ts`):
   *
   *   `verriegeleLadeflaeche()`  |x| < 1,70   z −0,40 … L+0,40   y −0,40 … 3,00
   *   `ladeflaecheKg()`          |x| < 1,85   z −0,50 … L+0,50   y −0,40 … 5,00
   *   `containedItems()`         |x| < 1,60   z −0,30 … L+0,30   y −0,40 … 2,60
   *
   * Das ist nicht dreimal dieselbe Sache mit etwas anderer Toleranz, sondern
   * es sind drei verschiedene Wahrheiten ueber EIN Stueck Schrott: Ein Blech
   * auf der Bordwandkante (x 1,65) wurde an die Flaeche gekoppelt, faehrt also
   * mit, wurde an der Ausfahrt gewogen — und war beim Verkauf nicht dabei. Es
   * verliess den Hof, ohne bezahlt zu werden. Dasselbe gilt fuer alles auf der
   * Heckklappe, alles an der Stirnwand und alles ueber 2,60 m.
   *
   * DIESELBE FEHLERKLASSE WIE E-044 UND E-064: Zwei Rechnungen ueber dieselbe
   * Ladung, und nur eine wurde in Ordnung gebracht. Deshalb gibt es sie jetzt
   * nur noch einmal, und die Regel dahinter ist ein Satz, den man einem
   * Spieler sagen kann: WAS MITFAEHRT, WIRD GEWOGEN UND BEZAHLT.
   *
   * Massgeblich ist das Fenster des Verriegelns — es entscheidet, was den Hof
   * ueberhaupt verlaesst. Ein Stueck, das nicht gekoppelt wird, bleibt beim
   * Anfahren liegen; es darf folglich weder auf die Waage noch auf die
   * Rechnung. Und eines, das gekoppelt wird, muss auf beide.
   */
  private static readonly FLAECHE_UEBER_X = 0.35;
  private static readonly FLAECHE_UEBER_Z = 0.4;
  private static readonly FLAECHE_UNTEN = -0.4;
  private static readonly FLAECHE_OBEN = 3.0;

  /** Rechenhilfe fuer `aufDerFlaeche` — kein neues Feld je Abfrage. */
  private flaechePos = new THREE.Vector3();

  /**
   * Liegt `body` auf der Ladeflaeche? Punktprobe am Schwerpunkt.
   *
   * @param extra zusaetzlicher Rand in Metern (nur fuer die Karosse, deren
   *              Schwerpunkt weit ueber dem Blech liegt)
   */
  private aufDerFlaeche(body: RAPIER.RigidBody, extra = 0): boolean {
    if (!body.isValid()) return false;
    const p = body.translation();
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) return false;
    this.flaechePos.set(p.x, p.y, p.z);
    this.bedGroup.worldToLocal(this.flaechePos);
    const l = this.flaechePos;
    return (
      Math.abs(l.x) <= BED_HALF_W + DeliveryVehicle.FLAECHE_UEBER_X + extra &&
      l.z >= -DeliveryVehicle.FLAECHE_UEBER_Z - extra &&
      l.z <= this.bedLen + DeliveryVehicle.FLAECHE_UEBER_Z + extra &&
      l.y >= DeliveryVehicle.FLAECHE_UNTEN &&
      l.y <= DeliveryVehicle.FLAECHE_OBEN + extra
    );
  }

  /**
   * Was in diesem Augenblick auf der Flaeche liegt — auch fremd Aufgeladenes.
   *
   * `cargoMassKg()` kennt nur die Fuhre, mit der der Wagen HEREINGEKOMMEN ist
   * (`this.cargo.items`). Der Abholer kommt leer; was er mitnimmt, hat der
   * Spieler mit der Spinne hineingelegt, und beim Losfahren wird es an die
   * Flaeche gekoppelt (`verriegeleLadeflaeche` → `riding`, kinematisch). In
   * `cargo.items` steht davon nichts — mit der alten Rechnung waere die
   * Ausfahrtswiegung eines vollen Abholers 0 kg gewesen.
   *
   * Gezaehlt wird ueber `aufDerFlaeche` — dasselbe Fenster wie beim
   * Verriegeln und beim Verkauf.
   */
  ladeflaecheKg(): number {
    // Die Weltmatrix der Flaeche frisch rechnen: Im Spiel besorgt das sonst
    // der Renderer, und der ist beim Messen und im Test nicht dabei.
    this.bedGroup.updateWorldMatrix(true, false);
    const gezaehlt = new Set<number>();
    let sum = 0;
    const pruefe = (b: RAPIER.RigidBody, massKg: number): void => {
      if (gezaehlt.has(b.handle) || !this.aufDerFlaeche(b)) return;
      gezaehlt.add(b.handle);
      sum += massKg;
    };
    for (const it of this.itemQuelle?.items ?? []) pruefe(it.body, it.massKg);
    for (const it of this.cargo.items) pruefe(it.body, it.massKg);
    if (this.cargo.car) pruefe(this.cargo.car.body, WRACK_KG);
    return sum;
  }

  /** Chassis + Ladefläche + Bordwände — Hindernisse für den Baggerarm. */
  collectBodyHandles(out: Set<number>): void {
    out.add(this.chassisBody.handle);
    out.add(this.bedBody.handle);
    for (const w of this.sideWalls) out.add(w.body.handle);
  }

  /** Abfahrt des Abhol-LKW freigeben (Taste V). */
  requestRelease(): void {
    this.releaseRequested = true;
  }

  get waitingForLoad(): boolean {
    return this.phase === "waitLoad";
  }

  get phaseName(): string {
    return this.phase;
  }

  /**
   * Teile, die im Container auf der Ladefläche liegen (Abhol-LKW).
   *
   * Daran haengt der Verkauf (`onPickupDepart` → `Account.sellContainer`) und
   * die Ladungsanzeige im HUD. Gefragt wird `aufDerFlaeche` — dasselbe
   * Fenster, mit dem verriegelt und gewogen wird: Was mitfaehrt, wird bezahlt.
   */
  containedItems(items: ItemManager): ScrapItem[] {
    if (!this.isPickup) return [];
    this.bedGroup.updateWorldMatrix(true, false);
    const out: ScrapItem[] = [];
    for (const it of items.items) {
      if (this.aufDerFlaeche(it.body)) out.push(it);
    }
    return out;
  }

  /**
   * Alles, was noch auf der Ladefläche liegt, für die Fahrt verriegeln.
   *
   * Ohne das verlor der Abhol-LKW seine Ladung, sobald er anfuhr: Die Fläche
   * ist kinematisch, die Teile darauf sind dynamisch — der Wagen fährt unter
   * ihnen weg, und sie bleiben auf dem Hof liegen (Befund 11.09.2026). Beim
   * Anlieferer gilt dasselbe für Reste, die nicht abgeladen wurden; die
   * fahren mit und zählen bei der Ausfahrtswiegung als Tara.
   */
  verriegeleLadeflaeche(): void {
    const quelle = this.itemQuelle;
    if (!quelle) return;
    this.bedGroup.updateWorldMatrix(true, false);
    const schon = new Set(this.riding.map((r) => r.body.handle));
    for (const it of quelle.items) {
      if (schon.has(it.body.handle)) continue;
      if (this.aufDerFlaeche(it.body)) this.lockToBed(it.body);
    }
    this.cargoReleased = false;
  }

  /** Ladung liegt ruhig? Erst dann wird für die Fahrt verriegelt. */
  private cargoAtRest(): boolean {
    for (const it of this.cargo.items) {
      if (!it.body.isValid()) continue;
      const v = it.body.linvel();
      if (Math.hypot(v.x, v.y, v.z) > LADUNG_RUHIG_MS) return false;
    }
    return true;
  }

  /* ------------------------------------- VOLL FAEHRT LOS (E-120) -------- */

  /**
   * Faehrt der Abholer von selbst los, sobald er voll ist? Gesetzt vom
   * `VehicleManager` beim Anlegen; der Schalter selbst steht in `main.ts`
   * (Block „Simulator: abhaengen"). Dieses Modul kennt keine Spielart.
   */
  vollFaehrtLos = false;
  /** Was die Spinne gerade haelt — gesetzt vom `VehicleManager`. */
  gegriffen: (() => readonly RAPIER.RigidBody[]) | null = null;
  /** Wie lange „voll und ruhig" schon ununterbrochen gilt (s). */
  private vollSeitS = 0;
  /** Restzeit bis zur naechsten Pruefung (s). */
  private vollPruefT = 0;

  /**
   * Wie voll ist die Flaeche (0 … 1 und darueber)? Fuer den Abholer.
   *
   * Dieselbe Rechnung, mit der eine Anlieferung beladen wird (E-033):
   * Σ `deckelVolumen` der Teile durch den Laderaum. Gezaehlt wird, was
   * `aufDerFlaeche` liegt — dasselbe Fenster wie Verriegeln, Waage und
   * Verkauf. Teile ohne Form (Karossen) haben hier kein Volumen.
   */
  ladeflaecheFuellgrad(): number {
    const { raum } = this.laderaum();
    if (raum <= 0) return 0;
    this.bedGroup.updateWorldMatrix(true, false);
    let belegt = 0;
    for (const it of this.itemQuelle?.items ?? []) {
      if (it.shape && this.aufDerFlaeche(it.body)) {
        belegt += deckelVolumen(it.shape.kind, it.shape.dims);
      }
    }
    return belegt / raum;
  }

  /**
   * Ist der Abholer voll? EINES genuegt (E-120):
   *
   *  - Fuellgrad ab `FUELL_KLASSEN.randvoll.von` (0,8) — ab da heisst eine
   *    Anlieferung „randvoll" (E-033).
   *  - Last ab `NUTZLAST.pritsche` (8 500 kg). `NUTZLAST` kennt keinen
   *    Abholer; die Pritsche hat dieselbe Flaechenlaenge (5,4 m, `routes.ts`)
   *    und ist der Wagen, dessen Nutzlast seiner am naechsten kommt. Ohne
   *    diese zweite Schranke wuerde ein Wagen voll Messing nie „voll".
   *
   * Gewogen wird mit `ladeflaecheKg` — derselben Zahl wie an der Waage.
   */
  abholerVoll(): boolean {
    return (
      this.ladeflaecheFuellgrad() >= FUELL_KLASSEN.randvoll.von ||
      this.ladeflaecheKg() >= NUTZLAST.pritsche
    );
  }

  /** Liegt alles auf der Flaeche ruhig? Mass wie `cargoAtRest`. */
  private ladeflaecheRuhig(): boolean {
    this.bedGroup.updateWorldMatrix(true, false);
    for (const it of this.itemQuelle?.items ?? []) {
      if (!this.aufDerFlaeche(it.body)) continue;
      const v = it.body.linvel();
      if (Math.hypot(v.x, v.y, v.z) > LADUNG_RUHIG_MS) return false;
    }
    return true;
  }

  /**
   * Haengt ein gegriffenes Teil ueber der Flaeche? Dann faehrt er NICHT.
   *
   * Sonst koppelte `verriegeleLadeflaeche` das Teil an den Wagen, waehrend
   * es noch am Fixed Joint der Spinne haengt — zwei Herren fuer einen
   * Koerper, und einer davon ist der Griff-Kern (Regel 2). Gefragt wird
   * dasselbe Fenster, mit dem verriegelt wird.
   */
  private greiferUeberFlaeche(): boolean {
    const g = this.gegriffen?.() ?? [];
    if (g.length === 0) return false;
    this.bedGroup.updateWorldMatrix(true, false);
    return g.some((b) => this.aufDerFlaeche(b));
  }

  /** Nach dem Setzen: alles für die Fahrt an die Mulde koppeln. */
  private lockAllCargo(): void {
    if (this.cargo.car) this.lockToBed(this.cargo.car.body);
    for (const it of this.cargo.items) {
      this.lockToBed(it.body);
      it.mesh.visible = true; // jetzt liegt sie sauber — ab hier sichtbar
    }
    /*
     * Die Federung an der fertigen Fuhre ausrichten und in ihre Ruhelage
     * springen lassen. Eine volle Fuhre steht am Tor, als waere sie laengst
     * geladen — sie soll nicht vor den Augen des Spielers erst durchsacken.
     */
    this.lastProbeT = 0;
    this.messeLast(0);
    this.federung.setzeRuhe();
    this.wendeFederungAn();
  }

  private lockToBed(body: RAPIER.RigidBody): void {
    const p = body.translation();
    const q = body.rotation();
    const worldPos = new THREE.Vector3(p.x, p.y, p.z);
    const localPos = this.bedGroup.worldToLocal(worldPos.clone());
    const bedQuat = new THREE.Quaternion();
    this.bedGroup.getWorldQuaternion(bedQuat);
    const localQuat = bedQuat.clone().invert().multiply(new THREE.Quaternion(q.x, q.y, q.z, q.w));
    body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, false);
    this.riding.push({ body, localPos, localQuat });
  }

  /** Ladung physisch freigeben (Kipper: beim Anheben; Pritsche: bei Ankunft). */
  private releaseCargo(): void {
    if (this.cargoReleased) return;
    this.cargoReleased = true;
    for (const r of this.riding) {
      if (r.body.isValid()) r.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    }
    this.riding = [];
    this.meldeMuldeNeuAn();
  }

  /**
   * DIE KOLLIDER DER MULDE NEU ANMELDEN — der eigentliche Fund zu E-071.
   *
   * Befund 15.09.2026, gemessen Bild für Bild: In dem Augenblick, in dem die
   * Mulde zu kippen anfing, fiel die GANZE Fuhre durch den Muldenboden hindurch
   * auf den Hof. Kein Katapult, kein Schaufeln — die Stücke waren im freien
   * Fall, Bild für Bild genau 9,81 m/s², und die Strahlprobe zeigte sie mitten
   * IM Kollider. Das ist Patricks Meldung „Teile fallen beim Kippen durch die
   * Ladefläche", wörtlich und messbar. Der Katapult war die Folge: Was unter
   * der Brücke landet, wird von der aufschwenkenden Unterkante wieder
   * herausgedrückt.
   *
   * WORAN ES LIEGT, EINGEGRENZT MIT EINEM SCHALTER NACH DEM ANDEREN
   * (`tools/kipper-messreihe.ts`, gepaart über dieselben Ladungen):
   *
   *   CCD an/aus, Rahmen weg, Bordwände weg, ein Stück statt vierzehn,
   *   Quader statt Bruchstück-Hülle, Reibung, Dämpfung, Solverwerte,
   *   ein FRISCHER Ladungskörper                    ändern NICHTS
   *   Kippen zehnmal langsamer                      hält
   *   IRGENDEIN Kollider der MULDE angefasst
   *   (`setEnabled`, `setHalfExtents`, `setTranslationWrtParent`)   hält
   *
   * Es ist also die Paarung zwischen Muldenkollider und Ladung, und sie ist
   * genau dann kaputt, wenn sie entstanden ist, WÄHREND beide Körper
   * kinematisch waren: Auf der Fahrt ist die Fuhre an die Mulde verriegelt
   * (`lockToBed`), kinematisch gegen kinematisch — dafür rechnet Rapier keine
   * Berührungen. Wird die Ladung am Halt wieder dynamisch, trägt die Mulde sie
   * zwar (sie liegt ruhig), aber sobald sich die Mulde BEWEGT, ist die Paarung
   * weg. Ein Kollider anzufassen setzt in Rapier sein Änderungskennzeichen; er
   * wird aus der Grobsuche genommen und neu eingetragen, und die Paarung
   * entsteht sauber neu.
   *
   * ES MUSS FRÜH GENUG PASSIEREN. Beim Übergang nach `tipping` gesetzt wirkt es
   * NICHT (gemessen) — ein frisch eingetragener Kollider braucht ein paar
   * Schritte, bis die Berührung steht. Hier, beim Freigeben, liegen 1,2 s
   * dazwischen; das reicht mit großem Abstand.
   *
   * Der Preis: nichts. Zwei Kollider werden einmal je Fuhre neu eingetragen.
   */
  private meldeMuldeNeuAn(): void {
    if (!this.bedBody.isValid()) return;
    for (let i = 0; i < this.bedBody.numColliders(); i++) {
      const c = this.bedBody.collider(i);
      if (!c.isEnabled()) continue;
      c.setEnabled(false);
      c.setEnabled(true);
    }
  }

  /**
   * true, wenn alle Ladungsteile von der Fläche herunter sind (>4 m vom Fahrzeug).
   * Bereits entfernte Körper (verkauft/gepresst) zählen als abgeladen — ihre
   * translation() abzufragen würde die Physik-Engine zum Absturz bringen.
   */
  /**
   * Ist die Ladeflaeche leer?
   *
   * Vorher galt der LKW erst als entladen, wenn JEDES Ladungsteil mehr als 4 m
   * vom Fahrzeug entfernt lag. Wer den Schrott gleich neben dem LKW ablegte —
   * und das tut man, der Haufen ist ja da —, sperrte ihn damit fest: Der
   * Fahrer wartete auf etwas, das laengst nicht mehr auf seiner Flaeche lag.
   * Genau das war "der LKW sieht leer aus und faehrt trotzdem nicht".
   *
   * Massgeblich ist jetzt, was auf der Flaeche liegt, nicht was daneben liegt.
   * Ein Rest von 20 kg bleibt zulaessig — ein einzelnes verklemmtes Blech soll
   * den Betrieb nicht anhalten.
   */
  private isUnloaded(): boolean {
    return this.cargoMassKg() <= 20;
  }

  private placeAt(route: Array<[number, number]>, s: number, reverse = false): void {
    // Punkt + Richtung entlang der Polylinie bei Bogenlänge s. Gerechnet in
    // `umriss.ts`, damit der Waechter dieselbe Bahn abfaehrt wie der Wagen.
    const p = poseAuf(route, s, reverse);
    this.group.position.set(p.x, 0, p.z);
    // Kabine (+Z) zeigt in Fahrtrichtung — rückwärts: Heck voran
    this.group.rotation.y = p.rot;
  }

  private routeLength(route: Array<[number, number]>): number {
    let len = 0;
    for (let i = 0; i < route.length - 1; i++) {
      len += Math.hypot(route[i + 1][0] - route[i][0], route[i + 1][1] - route[i][1]);
    }
    return len;
  }

  /**
   * Steht der Bagger (oder etwas anderes Blockierendes) auf dem nächsten
   * Streckenabschnitt? Dann hält der Fahrer an und hupt — er fährt nie hindurch.
   */
  /** Rechenhilfe fuer die Bauwerkspruefung — kein neues Feld je Bild. */
  private umrissCache: Box[] = [];

  /**
   * Steht ein festes Bauwerk im Weg? Das gilt immer — anders als loser Schrott
   * laesst es sich nicht wegraeumen, und hindurchfahren darf niemand.
   *
   * SEIT E-054 MIT DEM ECHTEN UMRISS. Vorher tastete diese Stelle mit einem
   * PUNKT und 1,40 m Radius auf der Mittellinie ab, an vier Stellen zwischen
   * 1,2 und 4,0 m VORAUS. Zwei Loecher steckten darin, und beide passen auf
   * „es klemmt beim Zuruecksetzen" (Befund E-051):
   *
   *  1. Der Korridor war schmaler als der Wagen (1,40 gegen 1,55 m
   *     Halbbreite) — die aeusseren 15 cm jeder Flanke wurden nie geprueft,
   *     die Ecken eines schraeg stehenden Wagens deutlich mehr.
   *  2. Beim Rueckwaertsfahren fuehrt das HECK, 3,14 m hinter dem Ursprung.
   *     Abgetastet wurde aber die Lage des Ursprungs — das Teil, das zuerst
   *     irgendwo hineinfaehrt, kam im Korridor gar nicht vor. Und die eigene
   *     Standflaeche schon gar nicht: Die Abtastung begann 1,20 m davor.
   *
   * Jetzt sind es Rechtecke: die AKTUELLE Standflaeche (samt Anhaenger, mit
   * seinem wirklichen Knickwinkel) und drei Lagen voraus bis `aheadS`. Ein
   * Rechteck ist 7,4 bis 8,0 m lang, die Lagen liegen 1,3 m auseinander —
   * dazwischen bleibt keine Luecke.
   *
   * DIE FLUCHTREGEL. Eine Wand ist nur dann eine Wand, wenn man in sie
   * hineinfaehrt: Blockiert wird nur, wenn die Lage VORAUS tiefer im Bauwerk
   * steckt als die jetzige. Ohne diese Regel stuende ein Wagen, dem jemand
   * einen Muellcontainer an die Flanke stellt, fuer immer — feste Bauten
   * kennen keine Aufgeben-Regel, und der Platz waere zu.
   */
  private isBlockedByBuilding(
    route: Array<[number, number]>,
    reverse: boolean,
    tempo: number
  ): boolean {
    const hind = alleHindernisse();
    this.umrissCache.length = 0;
    this.boxen(this.umrissCache);
    const tiefeJetzt = tiefsteDurchdringung(this.umrissCache, hind);
    this.umrissCache.length = 0;
    /*
     * VORAUS, WIE ER WIRKLICH FAEHRT (E-140). Bis E-140 stand hier die Lage,
     * die der Wagen auf der Strecke haette — Ursprung auf der Linie, Richtung
     * der Linie. Ein Wagen, der einlenkt, schneidet Boegen aber innen an, und
     * am Waagenbogen meldete die Linie 0,29 m Betriebsgebaeude, wo der Wagen
     * 0,8 m Luft hat: Er blieb fuer immer stehen. Jetzt faehrt eine Kopie
     * seiner Lage dasselbe Gesetz 4 m weit voraus, in groben Schritten von
     * 0,1 s, und geprueft werden die Lagen, die dabei herauskommen.
     */
    const l = this.lage();
    const laenge = this.routeLength(route);
    let s = this.routeS;
    let weg = 0;
    for (let i = 0; i < 40 && weg < 4; i++) {
      const r = folgeSchritt(l, this.fahrwerk, route, laenge, s, reverse, Math.max(tempo, 1), 0.1);
      s = r.s;
      weg += r.weg;
      if (i % 3 === 2 || r.fertig) this.figurenBei(l, this.umrissCache);
      if (r.fertig) break;
    }
    const tiefeVoraus = tiefsteDurchdringung(this.umrissCache, hind);
    return tiefeVoraus > UMRISS_TOLERANZ && tiefeVoraus > tiefeJetzt;
  }

  private isBlocked(route: Array<[number, number]>, aheadS: number, reverse: boolean): boolean {
    if (!this.getBlocker) return false;
    const ax = this.group.position.x;
    const az = this.group.position.z;
    const probe = this.probePoint(route, aheadS, reverse);
    const bx = probe.x;
    const bz = probe.z;
    // Strecke abtasten: Bagger ODER liegender Schrott stoppen den Fahrer.
    // Die eigene (verlorene) Ladung zählt nicht — sonst blockiert sich der
    // Fahrer selbst und käme nie vom Platz.
    const own = new Set<number>();
    for (const it of this.cargo.items) {
      if (it.body.isValid()) own.add(it.body.handle);
    }
    for (let t = 0.3; t <= 1.001; t += 0.235) {
      if (this.getBlocker(ax + (bx - ax) * t, az + (bz - az) * t, BLOCK_RADIUS, own)) return true;
    }
    return false;
  }

  private probeVec = new THREE.Vector3();

  /** Position, die das Fahrzeug bei Bogenlänge s einnehmen würde (ohne zu setzen). */
  private probePoint(route: Array<[number, number]>, s: number, reverse: boolean): THREE.Vector3 {
    const saveP = this.group.position.clone();
    const saveR = this.group.rotation.y;
    this.placeAt(route, s, reverse);
    this.probeVec.copy(this.group.position);
    this.group.position.copy(saveP);
    this.group.rotation.y = saveR;
    return this.probeVec;
  }

  /** Steht es gerade zur Kontrolle auf der Waage? (siehe VehicleManager) */
  get aufDerWaage(): boolean {
    if (this.phase === "weighIn") return true;
    return this.wiegeHaltS > 0; // seit E-120 haelt jeder bei der Ausfahrt
  }

  /** Fahrschritt mit Blockade-Prüfung; liefert true, wenn tatsächlich gefahren wurde. */
  private advance(route: Array<[number, number]>, step: number, reverse: boolean, dt: number): boolean {
    // Bauten zuerst und ohne Ausnahme: Die Aufgeben-Regel unten ist fuer losen
    // Schrott gedacht, der irgendwann weggeraeumt wird. Auf Mauern, Mulden und
    // das Betriebsgebaeude darf sie nicht durchschlagen — sonst faehrt der LKW
    // nach der Wartezeit einfach hindurch, und genau das war zu sehen.
    if (this.isBlockedByBuilding(route, reverse, step / Math.max(dt, 1e-6))) {
      this.blockedT += dt;
      if (this.blockedT > HONK_AFTER_S && !this.honked) {
        this.honked = true;
        this.onHonk?.();
      }
      return false;
    }
    // Sicherheitsabstand: 4 m vorausschauen (Heck bzw. Front)
    if (!this.gaveUpWaiting && this.isBlocked(route, this.routeS + 4, reverse)) {
      this.blockedT += dt;
      if (this.blockedT > HONK_AFTER_S && !this.honked) {
        this.honked = true;
        this.onHonk?.();
      }
      // Nach langer Blockade fährt der Fahrer vorsichtig weiter — sonst würde
      // ein liegen gebliebenes Teil das Fahrzeug für immer festsetzen.
      if (this.blockedT > BLOCK_GIVEUP_S) this.gaveUpWaiting = true;
      return false;
    }
    if (!this.gaveUpWaiting) {
      this.blockedT = 0;
      this.honked = false;
    }
    if (!Number.isFinite(this.lenkrate)) {
      /*
       * DER ALTE ZUSTAND, ausdruecklich erreichbar und nicht nachgebaut: Ort
       * UND Gierlage hart auf die Strecke setzen. Nur Gegenproben stellen
       * `lenkrate` auf `Infinity`; im Spiel kommt dieser Zweig nie vor.
       */
      this.routeS += step;
      this.placeAt(route, this.routeS, reverse);
      return true;
    }
    /*
     * DAS EINSPURMODELL (E-140). Der Fahrer zielt auf die Strecke, lenkt die
     * Vorderachse ein, und der Wagen faehrt den Kreis, den die Achsen
     * vorgeben — ohne Fahrt keine Drehung. Gesetz und Zahlen in `lenkung.ts`.
     */
    if (!(dt > 0)) return false;
    const l = this.lage();
    const r = folgeSchritt(
      l,
      this.fahrwerk,
      route,
      this.routeLength(route),
      this.routeS,
      reverse,
      step / dt,
      dt
    );
    this.setzeLage(l);
    this.routeS = r.s;
    return r.weg > 0;
  }

  update(dt: number): void {
    this.phaseT += dt;
    switch (this.phase) {
      case "settleCargo":
        // warten, bis sich der Ladungsberg gesetzt hat (max. 4 s)
        if (this.isPickup || (this.phaseT > 1.2 && this.cargoAtRest()) || this.phaseT > 4) {
          this.lockAllCargo();
          // Wer schon auf dem Warteplatz ansteht (E-131), bleibt dort stehen.
          this.phase = this.stehtAn ? "parked" : "in";
          this.phaseT = 0;
        }
        break;
      case "in":
        this.advance(this.routeIn, SPEED * dt, false, dt);
        if (this.routeS >= this.routeLength(this.routeIn)) {
          /*
           * JEDER HAELT AUF DER BRUECKENWAAGE — auch der Abholer (E-064).
           *
           * Bis zum 15.09.2026 fuhr er hier durch: „der Abholer kommt leer und
           * faehrt durch". Ansage Patrick am Geraet: „ausserdem muss auch
           * abholer leer wiegen." So ist es auf dem Platz auch: leer rein
           * (Tara), voll raus (Brutto), die Differenz ist der Lieferschein.
           *
           * Der Halteplatz wird damit nicht mehr hier festgelegt, sondern am
           * Ende der Wiegung — an derselben Stelle wie bei allen anderen.
           */
          this.phase = "weighIn";
          this.phaseT = 0;
          this.routeS = 0;
        }
        break;
      case "weighIn":
        // Der Fahrer gibt Mario an der Waage die Papiere — das dauert einen
        // Moment. Danach wird über den Preis geredet, und erst wenn man sich
        // einig ist, fährt er auf den Platz. Solange bleibt er auf der Waage
        // stehen (Design 02.09.2026).
        if (this.phaseT > 2.5 && !this.weighedIn) {
          this.weighedIn = true;
          if (this.isPickup) {
            /*
             * DER ABHOLER WIEGT LEER (E-064) — und verhandelt NICHT.
             *
             * `onWeighIn` bleibt unangetastet: Daran haengt in `main.ts` die
             * Preisverhandlung, und ueber einen leeren Wagen wird nicht
             * gefeilscht. Er meldet seine Tara und faehrt weiter; die Wiegung
             * ist ein kurzer Halt, keine Verhandlung.
             */
            this.taraKg = this.ladeflaecheKg() + ABHOLER_CONTAINER_KG;
            this.onTara?.(this.taraKg);
          } else if (this.holtNur) {
            // Er holt nur seine Mulde (E-141): nichts zu wiegen, nichts zu verhandeln
            this.bruttoKg = 0;
          } else {
            this.bruttoKg = this.cargoMassKg();
            this.onWeighIn?.(this.bruttoKg); // kann awaitingDeal setzen
          }
        }
        // Notausstieg: Bleibt die Antwort aus — weil der Spieler das Fenster
        // übersieht oder wegklickt —, fährt der Fahrer nach einer halben
        // Minute zum Marktpreis weiter. Ein wartender LKW darf den Betrieb
        // nicht dauerhaft anhalten (Design-Fix 02.09.2026).
        if (this.awaitingDeal && this.phaseT > 32) {
          this.awaitingDeal = false;
          this.onDealTimeout?.();
        }
        if (this.weighedIn && !this.awaitingDeal) {
          // Jetzt, kurz vor dem Losfahren, steht fest, wo der Bagger ist —
          // und damit, wo dieser Wagen abkippt.
          // Seit E-029 auch fuer den Kipper: Er haelt am selben Abladeplatz.
          this.legeAbladestelleFest();
          this.phase = "approach";
          this.phaseT = 0;
          this.routeS = 0;
        }
        break;
      case "approach": {
        const r = this.routeApproach;
        this.advance(r, SPEED * dt, false, dt);
        if (this.routeS >= this.routeLength(r)) {
          this.phase = "shiftPause";
          this.phaseT = 0;
          this.routeS = 0;
        }
        break;
      }
      case "shiftPause":
        if (this.phaseT > 0.5) {
          this.phase = "reverseIn";
          this.phaseT = 0;
        }
        break;
      case "reverseIn":
        this.advance(this.routeRev, SPEED * 0.6 * dt, true, dt); // rückwärts langsamer (SW)
        if (this.routeS >= this.routeLength(this.routeRev)) {
          this.phase = "pauseBeforeUnload";
          this.phaseT = 0;
        }
        break;
      case "pauseBeforeUnload":
        // Pritschen klappen die Bordwände auf — der Schrott darf herunter.
        // Kipper braucht das nicht (er kippt), der Container bleibt zu.
        if (this.kind === "pritsche" || this.kind === "wrack") this.sideOpenTarget = 1;
        // Der Absetzkipper gibt seine Fuhre erst frei, wenn die Mulde steht
        if (!this.isPickup && !this.absetz) this.releaseCargo();
        // Gekippt wird erst, wenn der Ladekran aus dem Weg ist (`kranSteht`)
        if (this.phaseT > 1.2 && this.absetz) {
          this.phase = this.absetzModus === "holen" ? "muldeHolen" : "muldeHeben";
          this.phaseT = 0;
          break;
        }
        if (this.phaseT > 1.2 && (this.kind !== "kipper" || this.isPickup || this.kranSteht)) {
          this.phase = this.isPickup ? "waitLoad" : this.kind === "kipper" ? "tipping" : "waitUnload";
          // Der Abholer funkt, sobald er steht — hier und nirgends sonst
          // (E-056). Einmal je Fuhre, danach ist der Kanal wieder still.
          if (this.isPickup) this.onFahrerlage?.("angekommen");
          this.phaseT = 0;
          this.routeS = 0;
        }
        break;
      case "nudging": {
        this.advance(this.routeOut, SPEED * 0.45 * dt, false, dt);
        // am Ziel oder am Ende der Route: wieder anhalten und weitermachen
        if (this.routeS >= this.nudgeTargetS || this.routeS >= this.routeLength(this.routeOut)) {
          this.phase = this.nudgeReturn;
          this.phaseT = 0;
        }
        break;
      }
      case "waitLoad":
        /*
         * Achim hat Standzeit und sagt das einmal (15.09.2026). Nicht als
         * Aufforderung, sondern als Entwarnung: Der Wagen steht hier bis zu
         * vier Minuten, und wer das weiss, laedt in Ruhe.
         */
        if (
          this.isPickup &&
          !this.warteFunkGehabt &&
          this.phaseT > DeliveryVehicle.WARTE_FUNK_S
        ) {
          this.warteFunkGehabt = true;
          this.onFahrerlage?.("wartet");
        }
        // Abhol-LKW wartet, bis der Spieler den Container beladen hat und
        // die Abfahrt freigibt (Taste V) — oder bis die Standzeit abläuft.
        // Die 240 s stehen seit E-082 als `STANDZEIT_S` oben; sie gelten
        // jetzt auch fuer den Anlieferer, und eine Zahl an zwei Stellen war
        // schon einmal der Anfang von zwei verschiedenen Zahlen.
        if (this.releaseRequested || this.phaseT > DeliveryVehicle.STANDZEIT_S) {
          /*
           * Abrechnen, Platzinventar zurueckgeben, verriegeln, funken — das
           * steht seit E-086 in `abholerFaehrtRaus()` und NICHT mehr hier.
           * Vorher stand es nur hier, und der zweite Ausgang (`sendAway`, also
           * Taste J „zur Waage schicken") ging daran vorbei.
           *
           * Die Ausfahrt bleibt, wie sie war: Von seinem Halteplatz aus faehrt
           * er den Ausfahrtsbogen von vorn (`routeS = 0`), waehrend `sendAway`
           * dort einfaedelt, wo der Wagen gerade steht. Am Verladeplatz ist
           * das fast dieselbe Stelle; angefasst wird die Lenkung (E-084) hier
           * trotzdem nicht.
           */
          this.abholerFaehrtRaus();
          /*
           * Auch hier wird eingefaedelt statt gesetzt (E-093). Am Verladeplatz
           * faellt das nicht ins Gewicht — der Anfang der Ausfahrt IST sein
           * Halteplatz, gemessen 0,00 m. Es steht trotzdem hier, weil sonst
           * eine von fuenf Stellen weiter springen wuerde und niemand wuesste,
           * welche.
           */
          this.starteAusfaedeln(this.routeOut, "out", 0);
        } else if (this.vollFaehrtLos) {
          /*
           * VOLL FAEHRT ER VON SELBST (E-120, Patrick 06.10.2026: „LKW faehrt
           * automatisch weg, sobald vollbeladen").
           *
           * KEIN DRITTER AUSGANG: Losgefahren wird ueber `sendAway()` — genau
           * den Weg, den ZUR WAAGE nimmt (`VehicleManager.zurWaage`). E-087:
           * Zwei Ausgaenge fuer ein Ereignis, und einer fuhr an der Abrechnung
           * vorbei. Wer hier ein eigenes `phase = …` setzt, baut ihn wieder.
           *
           * Erst wenn voll, ruhig und kein gegriffenes Teil ueber der Flaeche
           * — und das `VOLL_WARTE_S` lang am Stueck.
           */
          this.vollPruefT -= dt;
          if (this.vollPruefT <= 0) {
            this.vollPruefT += VOLL_PRUEF_S;
            const bereit =
              !this.greiferUeberFlaeche() && this.ladeflaecheRuhig() && this.abholerVoll();
            this.vollSeitS = bereit ? this.vollSeitS + VOLL_PRUEF_S : 0;
            if (this.vollSeitS >= VOLL_WARTE_S) this.sendAway();
          }
        }
        break;
      case "muldeHeben": {
        /*
         * DIE ARME SCHWENKEN NACH HINTEN (E-141). Die Mulde haengt an den
         * Ketten und bleibt dabei waagrecht; die Fuhre ist bis hierher
         * verriegelt und faehrt kinematisch mit — kein Stueck kann sich am
         * Rand verhaken, waehrend die Mulde ueber den Rahmen steigt.
         */
        const ziel =
          this.absetzModus === "absetzen" ? absetzSchwenk(this.absetz!.geo) : KIPP_ARMWINKEL - this.absetz!.geo.winkel0;
        this.armSchwenk = Math.min(this.armSchwenk + ARM_TEMPO * dt, ziel);
        if (this.armSchwenk >= ziel - 1e-9) {
          /*
           * Freigeben erst im Stand. Die Lehre aus E-071: Die Paarung
           * zwischen Mulde und Ladung muss neu entstehen, bevor sich die Mulde
           * wieder bewegt — `releaseCargo` meldet die Kollider neu an, und
           * `muldeRuhe` laesst ihnen 1,2 s.
           */
          this.releaseCargo();
          if (this.absetzModus === "absetzen") this.planeAufsetzen();
          this.phase = this.absetzModus === "absetzen" ? "muldeLoesen" : "muldeRuhe";
          this.phaseT = 0;
        }
        break;
      }
      case "muldeRuhe":
        if (this.phaseT > 1.2) {
          this.phase = "muldeKippen";
          this.phaseT = 0;
        }
        break;
      case "muldeKippen":
        // Um die Zapfen kippen, das hintere Ende nach unten. Die Fuhre liegt
        // lose darin und rutscht ueber die Kante — sie wird nicht versetzt.
        this.muldeKipp = Math.min(this.muldeKipp + KIPP_TEMPO * dt, MULDE_KIPP_MAX);
        if (this.muldeKipp >= MULDE_KIPP_MAX - 1e-9) {
          this.phase = "muldeLeeren";
          this.phaseT = 0;
        }
        break;
      case "muldeLeeren":
        // Ruetteln — die Kurve beginnt und endet bei null, ohne Sprung
        this.muldeKipp =
          MULDE_KIPP_MAX - RUETTEL_AMPL * Math.sin(Math.PI * 2 * RUETTEL_HZ * this.phaseT) ** 2;
        if (this.phaseT > MULDE_LEER_HALTEN_S) {
          this.muldeKipp = MULDE_KIPP_MAX;
          this.phase = "muldeSenken";
          this.phaseT = 0;
        }
        break;
      case "muldeSenken":
        this.muldeKipp = Math.max(this.muldeKipp - KIPP_TEMPO * dt, 0);
        if (this.muldeKipp <= 0) {
          this.verriegeleReste();
          this.phase = "armeEin";
          this.phaseT = 0;
        }
        break;
      case "muldeLoesen":
        // Die Mulde steht auf dem Boden, die Fuhre liegt lose darin. Kurz
        // warten, dann die Ketten aushaengen — ab da gehoert sie dem Platz.
        if (this.phaseT > 1.2) {
          this.gibMuldeAb();
          this.phase = "armeEin";
          this.phaseT = 0;
        }
        break;
      case "armeEin":
        this.armSchwenk = Math.max(this.armSchwenk - ARM_TEMPO * dt, 0);
        if (this.armSchwenk <= 0) this.leaveUnloadingBay();
        break;
      case "muldeHolen": {
        // Holen: Arme ausschwenken bis ueber die stehende Mulde, einhaengen
        const ziel = absetzSchwenk(this.absetz!.geo);
        this.armSchwenk = Math.min(this.armSchwenk + ARM_TEMPO * dt, ziel);
        if (this.armSchwenk >= ziel - 1e-9) {
          this.nimmMulde();
          this.phase = "muldeAufnehmen";
          this.phaseT = 0;
        }
        break;
      }
      case "muldeAufnehmen":
        // Erst die Ketten straff ziehen (Ueberblendung in die Haengelage),
        // dann die Mulde auf den Wagen schwenken
        this.muldeAnheben = Math.min(1, this.muldeAnheben + dt / 1.2);
        if (this.muldeAnheben >= 1) this.armSchwenk = Math.max(this.armSchwenk - ARM_TEMPO * dt, 0);
        if (this.armSchwenk <= 0) this.leaveUnloadingBay();
        break;
      case "tipping":
        this.tip = Math.min(this.tip + dt / 4.2, 1);
        if (this.tip >= 1) {
          this.phase = "tipHold";
          this.phaseT = 0;
        }
        break;
      case "tipHold":
        if (this.phaseT > 2.2) {
          this.phase = "tipCreep";
          this.creepLeft = TIP_CREEP_M;
        }
        break;
      case "tipCreep": {
        // Gekippt ein Stueck geradeaus ziehen, bevor die Mulde sinkt (v2-Vorbild).
        // Senkt der LKW im Stand, bleibt Schrott auf der Flaeche liegen, sobald
        // unten schon etwas im Weg ist — der Haufen wird ja mit jeder Fuhre
        // hoeher. Zieht er gekippt weg, rutscht der Rest ueber die Kante nach.
        const schritt = Math.min(TIP_CREEP_SPEED * dt, this.creepLeft);
        this.group.position.x += Math.sin(this.group.rotation.y) * schritt;
        this.group.position.z += Math.cos(this.group.rotation.y) * schritt;
        this.creepLeft -= schritt;
        this.snapBodiesToPose();
        if (this.creepLeft <= 1e-6) {
          // Die Mulde sinkt jetzt waehrend der Abfahrt weiter, nicht im Stand
          this.senken = true;
          this.leaveUnloadingBay();
        }
        break;
      }
      case "tipBack":
        this.tip = Math.max(this.tip - dt / 1.5, 0);
        if (this.tip <= 0) this.leaveUnloadingBay();
        break;
      case "waitUnload":
        if (this.phaseT > 1 && this.isUnloaded()) {
          this.leaveUnloadingBay();
          break;
        }
        /*
         * DIE FRIST (E-082). Bis heute stand hier nur die Zeile darueber —
         * wer nicht abgeladen wurde, stand fuer immer.
         *
         * Erst die Mahnung, dann die Abfahrt. Beides einmal je Fuhre, beides
         * ueber denselben Kanal wie Achims Funk.
         */
        if (
          !this.abladeMahnungGehabt &&
          this.phaseT > DeliveryVehicle.STANDZEIT_S - DeliveryVehicle.MAHNUNG_VOR_S
        ) {
          this.abladeMahnungGehabt = true;
          this.onAnliefererlage?.("wartetLange");
        }
        if (this.phaseT > DeliveryVehicle.STANDZEIT_S) this.faehrtUnverrichtet();
        break;
      case "toPark": {
        /*
         * ZUM WARTEPLATZ — UEBER `advance`, WIE JEDE ANDERE ETAPPE (E-098).
         *
         * HIER SASS PATRICKS BEFUND vom 17.09.2026: „LKWS fahren durch
         * Muellcontainer." Bis heute stand an dieser Stelle eine Luftlinie aus
         * `dx/dz`, direkt auf `group.position` geschrieben — an `advance()`
         * vorbei und damit an `isBlockedByBuilding()` vorbei. Gemessen
         * (E-097): 3,10 m Blech im Container, die volle Fahrzeugbreite, in
         * Phase `toPark`, Bild 2259. Der Container stand dabei still: Es lag
         * nie an fehlenden Kollidern, sondern daran, dass NIEMAND auf dem Weg
         * nachgesehen hat.
         *
         * Ueber `advance()` verhaelt sich der Wagen jetzt wie ueberall sonst
         * auf dem Hof: Er schaut 4 m voraus, haelt vor einem Bauwerk an und
         * hupt. Eine Sonderregel nur fuer den Weg zum Warteplatz waere eine
         * zweite Wahrheit gewesen.
         *
         * Und der zweite Fehler faellt damit mit weg: Die Luftlinie rief
         * `snapBodiesToPose()`, setzte also die JETZIGE Pose, waehrend das
         * Ende von `update()` dieselbe Pose als NAECHSTE meldet. Die Differenz
         * war null und damit auch das abgeleitete Tempo des kinematischen
         * Rahmens — 0,000 m/s statt 4,89 auf der Strecke. Rapier sah keinen
         * Stoss, sondern eine ruhende Ueberdeckung (E-073 mit umgekehrtem
         * Vorzeichen: dort Katapult, hier Gespenst).
         */
        this.sideOpenTarget = 0;
        const r = this.routeParken;
        this.advance(r, SPEED * dt, false, dt);
        if (this.routeS >= this.routeLength(r)) {
          this.phase = "parkRueck";
          this.phaseT = 0;
          this.routeS = 0;
        }
        break;
      }
      case "parkRueck": {
        /*
         * Rueckwaerts in die Bucht — auf den zwei Punkten, die
         * `test/strecken.ts` seit E-081 als „Parken n" fuehrt. Das Eindrehen
         * vor der Rueckwaertsfahrt macht `advance` selbst (E-081: „Rueckwaerts
         * wird IMMER erst ausgerichtet"), und `drehRichtung` waehlt dabei die
         * Seite mit der geringeren Durchdringung (E-084). Die Endlage ist
         * dieselbe wie vorher: `poseAuf(..., true)` auf einer Bahn nach Norden
         * ist genau `rotation.y = Math.PI` — Front zum Platz, Heck zur Wand.
         */
        const r = this.meinParkRueck ?? routeParkRueck(this.parkSpot!);
        this.advance(r, PARK_RUECK_SPEED * dt, true, dt);
        if (this.routeS >= this.routeLength(r)) {
          this.phase = "parked";
          this.phaseT = 0;
        }
        break;
      }
      case "parked":
        // Ansteher (E-131): wartet beladen, bis der Fuhrpark ihn vorruft.
        if (this.stehtAn) break;
        // Kaffeepause: Der Fahrer steigt aus und geht zu Janine hinueber.
        // Einmal pro Pause. Ohne diese Sperre stieg er sofort wieder aus,
        // sobald er drin war, und der LKW fuhr nie los.
        if (this.fahrerState === "drin" && !this.kaffeeGehabt && this.phaseT > 1.2) {
          this.steigeAus();
        }
        // Rechtzeitig zurueck, sonst faehrt der LKW ohne ihn los
        if (this.fahrerState === "kaffee" && this.phaseT > this.parkSeconds - 12) {
          this.fahrerState = "rein";
        }
        if (this.phaseT > this.parkSeconds && this.fahrerState === "drin") {
          /*
           * VOM WARTEPLATZ ZUM TOR (E-140). Bis hierher faedelte der Wagen auf
           * die Ausfahrt ein, von der er gekommen war (E-093) — am Punkt, der
           * ihm am naechsten lag. Dort zeigt die Ausfahrt aber Richtung Tor,
           * und der Wagen steht mit der Kabine zum Platz: Er haette sich auf
           * der Stelle umdrehen muessen. Jetzt hat jeder Warteplatz seine
           * eigene Ausfahrt: aus der Bucht nach vorn, im Bogen ueber den Platz
           * und von Suedosten auf die Waage, wie alle anderen auch
           * (`routes.parkAusfahrt`). Sie beginnt genau dort, wo er steht.
           */
          this.phase = "out";
          this.phaseT = 0;
          if (!this.faedeltAus) {
            // Die Gegenprobe der Waechter (E-093): der alte Sprung auf die
            // naechste Stelle der Ausfahrt. Im Spiel nie.
            this.routeS = this.nearestS(this.routeOut);
          } else {
            this.ausfahrtVomPlatz = parkAusfahrt(this.parkSpot!);
            this.routeS = 0;
          }
        }
        break;
      case "ausfaedeln":
        /*
         * Frei zur Strecke fahren, dann sie aufnehmen. Kein Streckenpunkt ist
         * dafuer verschoben worden; der Wagen holt nur den Weg nach, den er
         * bisher uebersprungen hat.
         */
        this.sideOpenTarget = 0;
        this.ausfaedelSchritt(dt);
        break;
      case "out":
        this.sideOpenTarget = 0; // Bordwände zu, bevor es vom Platz geht
        // Jeder Laster haelt auf der Waage, solange Mario die Ladung ansieht
        if (this.wiegeHaltS > 0) {
          this.wiegeHaltS -= dt;
          break;
        }
        this.advance(this.routeOut, SPEED * dt, false, dt);
        if (!this.weighedOut && this.group.position.z >= WEIGH_Z) {
          this.weighedOut = true;
          /*
           * JEDER HAELT AUCH BEI DER AUSFAHRT (E-120). Bis zum 06.10.2026 nur
           * der Abholer — „ein Anlieferer faehrt leer hinaus und hat nichts
           * vorzuzeigen". Patrick am selben Tag: „Er soll immer noch an der
           * Waage halten." Ohne Ausnahme, in beiden Spielarten: Auch ein
           * Anlieferer, der Reste mitnimmt, wird leer (Tara) gewogen.
           */
          this.wiegeHaltS = WIEGE_HALT_S;
          if (this.isPickup) {
            /*
             * Und jetzt die zweite Haelfte des Lieferscheins (E-064): Brutto
             * minus der Tara von der Einfahrt ist, was er mitnimmt. Gewogen
             * wird, was auf der Flaeche liegt — beim Abholer ist das die
             * Ladung des Spielers, die beim Losfahren an die Flaeche
             * gekoppelt wurde, plus der Container darunter.
             *
             * Nur eine Meldung: Bezahlt ist das laengst (`onPickupDepart`),
             * und am Kreislauf wird hier nichts angefasst.
             */
            this.bruttoKg = this.ladeflaecheKg() + ABHOLER_CONTAINER_KG;
            this.onAbholungGewogen?.(this.taraKg, this.bruttoKg);
          } else {
            // Ausfahrtswiegung: leer über die Brückenwaage → Netto steht fest
            const tara = this.cargoMassKg();
            // Wer nur seine Mulde holt (E-141), bekommt nichts und zahlt nichts
            if (!this.holtNur) this.onWeighOut?.(Math.max(this.bruttoKg - tara, 0));
          }
        }
        if (this.routeS >= this.routeLength(this.routeOut)) this.done = true;
        break;
    }

    this.zeigeLenkung();
    this.updateFahrer(dt);

    // Ladekran: beim Andocken zur Seite schwenken, damit der Ausleger nicht ueber
    // der Ladeflaeche haengt und dem Baggerfahrer die Sicht und den Weg nimmt.
    if (this.crane) {
      const amPlatz =
        // Schon beim Zuruecksetzen: Der Schwenk braucht 2,7 s, die Pause vor
        // dem Abladen dauert 1,2 s. Ein Fahrer dreht seinen Kran auch nicht
        // erst, wenn er steht (E-076).
        this.phase === "reverseIn" ||
        this.phase === "pauseBeforeUnload" ||
        this.phase === "waitUnload" ||
        this.phase === "waitLoad" ||
        this.phase === "tipping" ||
        this.phase === "tipHold";
      /*
       * Die Seite wird JEDES BILD neu gerechnet, nicht einmal gemerkt. Am
       * Halteplatz steht der Wagen still, also ist sie dort stabil; unterwegs
       * ist der Kran ohnehin eingeklappt (ziel = 0).
       */
      const ziel = amPlatz ? this.craneSide * CRANE_SWING : 0;
      // Langsam: ein Kran schwenkt nicht, er dreht sich gemaechlich
      this.craneSwing += THREE.MathUtils.clamp(ziel - this.craneSwing, -dt * 0.5, dt * 0.5);
      this.crane.rotation.y = this.craneSwing;
    }

    // Nach dem gekippten Anziehen sinkt die Mulde waehrend der Abfahrt, nicht im
    // Stand — der LKW haelt den Betrieb nicht auf, und der Rest rutscht unterwegs
    // noch nach.
    if (this.senken) {
      this.tip = Math.max(this.tip - dt / 2.4, 0);
      if (this.tip <= 0) this.senken = false;
    }

    // Kippwinkel: Fläche hebt sich vorn (Kabinenseite), Ladung rutscht hinten ab
    if (this.absetz) this.stelleAbsetzanlage();
    else this.bedGroup.rotation.x = -this.tip * TIP_ANGLE;

    // Bordwände auf-/zuklappen
    const openStep = dt / 1.6; // ~1,6 s für den vollen Weg (SW)
    this.sideOpen += THREE.MathUtils.clamp(this.sideOpenTarget - this.sideOpen, -openStep, openStep);
    // Klappen hängen im geöffneten Zustand senkrecht nach unten (90°)
    for (const w of this.sideWalls) {
      w.hinge.rotation.z = -w.dir * this.sideOpen * (Math.PI / 2);
    }
    if (this.tailGate) this.tailGate.hinge.rotation.x = this.sideOpen * (Math.PI / 2);

    // Federung: senkt und neigt den Wagen, bevor die Körper nachgeführt werden
    this.updateFederung(dt);

    // Kinematische Körper nachführen
    this.group.updateWorldMatrix(true, true);
    const cq = new THREE.Quaternion();
    this.group.getWorldQuaternion(cq);
    this.chassisBody.setNextKinematicTranslation(this.group.position);
    this.chassisBody.setNextKinematicRotation({ x: cq.x, y: cq.y, z: cq.z, w: cq.w });
    const bp = new THREE.Vector3();
    const bq = new THREE.Quaternion();
    this.bedGroup.getWorldPosition(bp);
    this.bedGroup.getWorldQuaternion(bq);
    this.bedBody.setNextKinematicTranslation({ x: bp.x, y: bp.y, z: bp.z });
    this.bedBody.setNextKinematicRotation({ x: bq.x, y: bq.y, z: bq.z, w: bq.w });

    // Bordwand- und Heckklappen-Kollider nachführen
    const flaps = this.tailGate ? [...this.sideWalls, this.tailGate] : this.sideWalls;
    for (const w of flaps) {
      w.mesh.updateWorldMatrix(true, false);
      w.mesh.getWorldPosition(bp);
      w.mesh.getWorldQuaternion(bq);
      w.body.setNextKinematicTranslation({ x: bp.x, y: bp.y, z: bp.z });
      w.body.setNextKinematicRotation({ x: bq.x, y: bq.y, z: bq.z, w: bq.w });
    }

    // mitfahrende Ladung nachführen
    if (this.riding.length > 0) {
      const wp = new THREE.Vector3();
      for (const r of this.riding) {
        if (!r.body.isValid()) continue;
        wp.copy(r.localPos);
        this.bedGroup.localToWorld(wp);
        const wq = bq.clone().multiply(r.localQuat);
        r.body.setNextKinematicTranslation({ x: wp.x, y: wp.y, z: wp.z });
        r.body.setNextKinematicRotation({ x: wq.x, y: wq.y, z: wq.z, w: wq.w });
      }
    }
  }

  despawn(): void {
    for (const w of this.sideWalls) this.world.removeRigidBody(w.body);
    this.sideWalls = [];
    /*
     * DER ABHOLER NIMMT SEINE LADUNG MIT — und zwar erst HIER, am Ende der
     * Ausfahrt, ausser Sicht (E-120, Patrick 06.10.2026: „Schrott soll auch
     * nicht direkt verschwinden").
     *
     * Bis dahin blieben die verriegelten Teile, wenn niemand sie verkaufte
     * (Sandkasten: `onPickupDepart` abgehaengt), als kinematische Leichen am
     * Ende der Ausfahrt und in `items.items` liegen. Im Betrieb hat der
     * Verkauf die meisten schon entfernt (`isValid` ist dann falsch); was er
     * nicht nahm — etwa den Besen —, geht jetzt ebenfalls, und das
     * Platzinventar kommt am naechsten Tag wieder (E-031).
     */
    if (this.isPickup) {
      for (const r of this.riding) {
        if (!r.body.isValid()) continue;
        const it = this.itemQuelle?.itemByBody(r.body);
        if (it) this.itemQuelle!.remove(it, true);
        else this.composites?.despawnByBody(r.body);
      }
      this.riding = [];
    }
    // Was noch auf der Ladeflaeche klemmt, stellt der Fahrer beim Wegfahren ab —
    // sonst fuehre er Material vom Platz und es waere fuer den Spieler weg.
    //
    // Frueher landete es auf einem FESTEN Punkt am Abladeplatz, in 0,6 bis 1,6 m
    // Hoehe. Wer gerade woanders arbeitete, sah dort unvermittelt Schrott vom
    // Himmel fallen — ohne Fahrzeug, ohne Zusammenhang. Jetzt wird nur abgesetzt,
    // was wirklich auf der Flaeche liegt, und zwar dicht neben dem Fahrzeug auf
    // dem Boden: Das liest sich als Abladen, nicht als Regen.
    //
    // ES SEI DENN, DIE FUHRE FAEHRT MIT (E-082): Wem die Frist am
    // Abladeplatz abgelaufen ist, der nimmt wieder mit, was er gebracht hat.
    // Bezahlt wurde davon nichts (Netto null an der Ausfahrtswaage) — bliebe
    // es liegen, waere es geschenkter Schrott.
    if (this.ladungFaehrtMit) {
      /*
       * MITGENOMMEN WIRD NUR, WAS AUCH AUF DER WAAGE STAND. Waehrend der vier
       * Minuten Standzeit liegen die Bordwaende offen; es kann von selbst
       * etwas heruntergerutscht sein. Das liegt dann auf dem Hof, die
       * Ausfahrtswaage hat es als abgeladen verbucht und es ist bezahlt — es
       * darf nicht mit verschwinden. Dieselbe Frage, dieselbe Antwort wie an
       * der Waage: `wiegtMit`.
       */
      this.bedGroup.updateWorldMatrix(true, false);
      const bleibtLiegen: ScrapItem[] = [];
      for (const it of this.cargo.items) {
        if (it.body.isValid() && this.wiegtMit(it.body)) this.itemQuelle?.remove(it, true);
        else bleibtLiegen.push(it);
      }
      this.cargo.items = bleibtLiegen;
      if (this.cargo.car && this.wiegtMit(this.cargo.car.body, 0.6)) {
        this.composites?.despawnByBody(this.cargo.car.body);
        this.cargo.car = null;
      }
    }
    const gp = this.group.position;
    const quer = { x: Math.cos(this.group.rotation.y), z: -Math.sin(this.group.rotation.y) };
    const local = new THREE.Vector3();
    let k = 0;
    for (const it of this.cargo.items) {
      if (!it.body.isValid()) continue;
      const p = it.body.translation();
      local.set(p.x, p.y, p.z);
      this.bedGroup.worldToLocal(local);
      const aufDerFlaeche =
        Math.abs(local.x) < BED_HALF_W + 0.5 &&
        local.z > -0.5 &&
        local.z < this.bedLen + 0.5 &&
        local.y > -0.4 &&
        local.y < 5.0;
      if (!aufDerFlaeche) continue; // liegt schon auf dem Platz — nicht anfassen
      // Seitlich neben das Fahrzeug, knapp ueber dem Boden
      const seite = 3.2 + (k % 3) * 0.9;
      it.body.setTranslation(
        { x: gp.x + quer.x * seite, y: 0.35, z: gp.z + quer.z * seite },
        true
      );
      it.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      it.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      k++;
    }
    this.group.removeFromParent();
    this.world.removeRigidBody(this.chassisBody);
    this.world.removeRigidBody(this.bedBody);
  }
}

export class VehicleManager {
  private active: DeliveryVehicle | null = null;
  /**
   * Fahrzeuge, die abgeladen haben und auf dem Warteplatz stehen. Sie
   * blockieren den Abladeplatz nicht mehr, sind aber weiter auf dem Hof —
   * so ist immer Betrieb, statt dass der Platz zwischen zwei Fuhren
   * leersteht (Wunsch 02.09.2026).
   */
  private parked: DeliveryVehicle[] = [];
  /**
   * DIE ABGESETZTE MULDE (E-141), solange eine hinter dem Abladeplatz steht.
   * Dann kommt kein Anlieferer an den Abladeplatz, bis sie geholt ist.
   */
  private mulde: AbgesetzteMulde | null = null;
  /** Eine Fuhre, die kommen sollte, waehrend die Mulde stand — sie faehrt danach. */
  private nachMulde: { k: DeliveryKind; kunde: CustomerProfile } | null = null;
  /** Fuer HUD und Waechter: steht eine Mulde, und wie lange schon? */
  get abgesetzteMulde(): Readonly<AbgesetzteMulde> | null {
    return this.mulde;
  }
  private nextSpawnT = FIRST_DELAY_S;
  private t = 0;
  /** Anlieferungs-Zähler (für Tests/Statistik) */
  deliveries = 0;
  /**
   * Während der Sortierphase macht die Einfahrt zu — es kommt kein Anlieferer
   * mehr, bis der Platz wieder aufgeräumt ist. Abholer ruft der Spieler
   * weiterhin selbst.
   */
  acceptDeliveries = true;
  /**
   * Faktor auf die Wartezeit bis zur nächsten Fuhre. Ein voller Platz
   * bekommt etwas Luft, ein leerer Nachschub im Minutentakt.
   */
  intervalFactor = 1;
  /**
   * Faehrt ein Abholer von selbst los, sobald er voll ist (E-120)?
   *
   * Der Schalter steht HIER und wird in `main.ts` im Block „Simulator:
   * abhaengen" gesetzt — so bleibt er eine Stelle, und dieses Modul muss die
   * Spielart nicht kennen. Im Betrieb bleibt es bei Taste V und Standzeit.
   */
  vollFaehrtLos = false;
  /**
   * Was die Spinne gerade haelt; von main gesetzt. Ein Abholer faehrt nicht
   * von selbst los, solange davon etwas ueber seiner Flaeche haengt (E-120).
   */
  gegriffen: (() => readonly RAPIER.RigidBody[]) | null = null;

  /** Baggerposition für die Blockade-Prüfung; von main gesetzt. */
  getExcavatorPos: (() => THREE.Vector3) | null = null;
  /** Hupe, wenn etwas zu lange im Weg steht. */
  onHonk: (() => void) | null = null;
  onWeighIn: ((kg: number) => void) | null = null;
  onWeighOut: ((netKg: number) => void) | null = null;
  /** Abhol-LKW fährt los → Containerinhalt abrechnen */
  onPickupDepart: ((truck: DeliveryVehicle) => void) | null = null;
  /**
   * DER FUNKKANAL DES HOFES. Achim funkt durch — wo er steht (E-056) und was
   * sonst gerade ist; seit E-082 meldet sich hier auch der Anlieferer, dem am
   * Abladeplatz die Zeit ausgeht.
   *
   * Eine Zeile je Lage, zum Ueberhoeren gedacht. Sie geht denselben Weg wie
   * die Begruessung eines Haendlers (`onCustomerArrived`): Das Fahrzeugmodul
   * sagt, WER was sagt — wo es steht, entscheidet das HUD. Der Name reist
   * mit, damit das HUD keine zweite Liste von Sprechern fuehren muss.
   *
   * Der Name blieb `onPickupFunk`, obwohl jetzt mehr als der Abholer darauf
   * spricht: Ein zweiter Rueckruf mit demselben Zweck waere genau die zweite
   * Liste, die beim naechsten Umbau zurueckbleibt.
   */
  onPickupFunk: ((wer: string, spruch: string) => void) | null = null;
  /**
   * Die beiden Wiegungen des Abholers (E-064).
   *
   * `onAbholerTara` beim Hereinfahren (er kommt leer), `onAbholerBrutto` beim
   * Hinausfahren — dort steht mit der Differenz fest, was vom Hof geht. Beide
   * sind reine Meldungen; sie ruehren weder Konto noch Preis an.
   */
  onAbholerTara: ((tara: number) => void) | null = null;
  onAbholerBrutto: ((tara: number, brutto: number) => void) | null = null;

  /**
   * Zugang zum Platzinventar (Müllcontainer). Bleibt er null, verhält sich
   * alles wie vorher — der Abholer gibt dann nichts zurück.
   */
  platzinventar: PlatzinventarPort | null = null;

  constructor(
    private scene: THREE.Scene,
    private world: RAPIER.World,
    private items: ItemManager,
    private composites: CompositeManager
  ) {}

  /**
   * Steht an (x,z) etwas im Weg? Der Bagger blockiert, und ebenso am Boden
   * liegender Schrott ab 25 kg — LKW fahren nicht darüber hinweg.
   */
  private blockedAt = (x: number, z: number, r: number, ignore: Set<number>): boolean => {
    // Feste Bauten pruefen NICHT mehr hier: Sie haengen an isBlockedByBuilding,
    // damit die Aufgeben-Regel nicht auf sie durchschlaegt.
    const ex = this.getExcavatorPos?.();
    if (ex && Math.hypot(ex.x - x, ex.z - z) < r) return true;
    // In den Arbeitszonen (Abkipp-/Verladeplatz) darf Schrott liegen — dorthin
    // muss das Fahrzeug ja gerade hin.
    for (const [zx, zz, zr] of WORK_ZONES) {
      if (Math.hypot(zx - x, zz - z) < zr) return false;
    }
    for (const it of this.items.items) {
      // Nur wirklich sperrige Brocken halten einen LKW auf. Vorher blockierte
      // schon jedes 25-kg-Teil, wodurch die Fahrspur nach dem Abkippen fast
      // immer als versperrt galt — kleineres Zeug wird jetzt überrollt.
      if (it.massKg < BLOCKING_MASS_KG || !it.body.isDynamic()) continue;
      if (ignore.has(it.body.handle)) continue; // eigene Ladung
      const p = it.body.translation();
      if (p.y > 1.3) continue; // auf einer Ladefläche, nicht auf dem Fahrweg
      if (Math.hypot(p.x - x, p.z - z) < r * 0.5) return true;
    }
    return false;
  };

  /** Sofort ein Fahrzeug schicken (Tests, Tutorial). */
  /** Meldung, wenn ein Kunde eintrifft — für Begrüßung und HUD. */
  onCustomerArrived: ((c: CustomerProfile) => void) | null = null;

  spawnNow(kind?: DeliveryKind, kunde?: CustomerProfile): void {
    if (this.active) return;
    // Erst die Kundschaft, dann das Fahrzeug dazu: ein Privatmann kommt nicht
    // mit dem Sattelzug, und ein Abbruchbetrieb nicht mit dem PKW-Anhänger.
    // Zweimal zu würfeln hätte Fahrzeug und Kunde entkoppelt.
    // Ohne verlangtes Fahrzeug kommt, wer ans Tor kommt — auch die
    // Einzelstueck-Fuhre (E-126). Wer ein Fahrzeug verlangt (Pruefstaende,
    // Tutorial), bekommt die gewohnte Schuettgut-Kundschaft dazu.
    const gezogen = kunde ?? (kind ? rollCustomer() : rollAnlieferung());
    const k: DeliveryKind =
      kind ?? vehicleForCustomer(gezogen);
    /*
     * Steht eine Mulde am Abladeplatz (E-141), wartet jede Fuhre dorthin, bis
     * sie geholt ist — auch der Nachschub auf Knopfdruck. Ins Silo darf man.
     */
    if (
      this.mulde &&
      k !== "abholer" &&
      !faehrtInsSilo(k, lagerMuldeFuer(gezogen.sortedMaterial ?? null))
    ) {
      this.nachMulde = { k, kunde: gezogen };
      return;
    }
    const c = k === "abholer" ? null : gezogen;
    this.active = this.baueWagen(k, c);
    if (k === "absetzer") {
      // Kippen oder absetzen (E-141) — abgesetzt nur, wenn keine andere steht
      this.active.absetzModus = !this.mulde && Math.random() < ABSETZEN_ANTEIL ? "absetzen" : "kippen";
    }
    // Die Bestellung reist mit dem Wagen mit — daran haengt sein Halteplatz.
    this.active.bestellung = k === "abholer" ? this.pickupOrder : null;
    /*
     * Und daran haengt auch, was er funkt, wenn er steht (E-056). Der Ort
     * kommt aus dem Schild des Behaelters, an dem er haelt — dieselbe Quelle,
     * aus der auch der Halteplatz gerechnet wird. Zwei Listen, eine fuer die
     * Fahrt und eine fuer den Text, wuerden beim naechsten Umzug der Reihe
     * auseinanderlaufen. DIESE KOPPLUNG BLEIBT, auch jetzt, wo ein Fahrer mit
     * Namen spricht: Der Name kommt aus der Figur, der Ort aus dem Schild.
     */
    if (k === "abholer") {
      const wagen = this.active;
      wagen.onFahrerlage = (lage) => {
        const ziel = abholPlatzFuer(wagen.bestellung).ziel;
        this.onPickupFunk?.(ABHOLFAHRER.funkname, fahrerfunk(lage, ziel?.label ?? null));
      };
      // Die beiden Wiegungen (E-064) — leer herein, voll hinaus.
      wagen.onTara = (tara) => this.onAbholerTara?.(tara);
      wagen.onAbholungGewogen = (tara, brutto) => this.onAbholerBrutto?.(tara, brutto);
      // Voll faehrt er von selbst (E-120) — nie mit einem Teil in der Spinne.
      wagen.vollFaehrtLos = this.vollFaehrtLos;
      wagen.gegriffen = () => this.gegriffen?.() ?? [];
    } else {
      /*
       * Und der Anlieferer spricht ebenfalls (E-082) — derselbe Kanal zum
       * HUD, aber mit seinem eigenen Namen und seinen eigenen Saetzen. Der
       * Name kommt aus dem Kundenprofil, das ohnehin schon am Wagen haengt;
       * eine zweite Liste von Sprechern gibt es nicht.
       */
      // (verdrahtet in `baueWagen`)
    }
    if (c) this.onCustomerArrived?.(c);
    // Händler bleiben gern noch auf einen Kaffee; Gewerbe hat es eilig.
    // Nur freie Plätze vergeben, sonst stünde einer im anderen.
    if (c && c.group !== "gewerbe" && Math.random() < (c.group === "haendler" ? 0.75 : 0.35)) {
      const frei = PARK_SLOTS.filter(
        (p) => !this.parked.some((v) => v.parkSpot?.[0] === p[0] && v.parkSpot?.[1] === p[1])
      );
      if (frei.length > 0) {
        this.active.parkSpot = frei[Math.floor(Math.random() * frei.length)];
        this.active.parkSeconds =
          PARK_TIME_S[0] + Math.random() * (PARK_TIME_S[1] - PARK_TIME_S[0]);
      }
    }
    this.active.loadCargo(this.items, this.composites);
    if (k !== "abholer") this.deliveries++;
  }

  /** Ein Fahrzeug bauen und an den Fuhrpark anschliessen — fuer Tor und Warteplatz. */
  private baueWagen(
    k: DeliveryKind,
    c: CustomerProfile | null,
    holeMulde: AbgesetzteMulde | null = null
  ): DeliveryVehicle {
    const v = new DeliveryVehicle(
      k,
      this.scene,
      this.world,
      this.blockedAt,
      () => this.onHonk?.(),
      (kg) => this.onWeighIn?.(kg),
      (kg) => this.onWeighOut?.(kg),
      c,
      holeMulde
    );
    v.itemQuelle = this.items;
    v.platzinventar = this.platzinventar;
    // Der Anlieferer spricht (E-082) — hier, damit auch ein Ansteher spricht.
    if (k !== "abholer") {
      v.onAnliefererlage = (lage) => this.onPickupFunk?.(v.customer?.name ?? "Fahrer", anliefererfunk(lage));
    }
    // Die abgesetzte Mulde geht an den Fuhrpark (E-141)
    v.onMuldeAbgesetzt = (m) => (this.mulde = m);
    v.onMuldeGeholt = () => (this.mulde = null);
    return v;
  }

  /** Abholung anfordern bzw. wartenden Abhol-LKW abfahren lassen. */
  /**
   * Fraktion, für die der Abholer bestellt wurde (null = gemischte Ladung).
   * Danach richtet sich die Abrechnung: Wer Alu bestellt und Alu lädt,
   * bekommt den vollen Preis.
   */
  pickupOrder: string | null = null;

  /**
   * Wo ein Abholer fuer diese Bestellung halten wuerde.
   *
   * Fuers HUD: Seit E-056 steht er nicht mehr immer an derselben Stelle, und
   * „wo ist er?" ist damit eine echte Frage. Gerechnet wird sie hier einmal,
   * damit Anzeige und Fahrt nicht zweierlei sagen.
   */
  abholPlatz(order: string | null = this.pickupOrder): AbholPlatz {
    return abholPlatzFuer(order);
  }

  /** Der Platz, an dem der Abholer gerade wirklich steht bzw. hinfaehrt. */
  get aktuellerAbholPlatz(): AbholPlatz | null {
    const a = this.active;
    if (!a || a.kind !== "abholer") return null;
    return abholPlatzFuer(a.bestellung);
  }

  /**
   * Eine bestellte Abholung, die noch nicht fahren konnte.
   *
   * `null` heisst: nichts vorgemerkt. Sonst steht hier die bestellte Fraktion
   * (die ihrerseits `null` sein darf, wenn gemischt geladen wird) — darum das
   * Objekt drumherum statt eines blanken Strings.
   */
  private vorgemerkt: { order: string | null } | null = null;

  /** Ist eine Abholung vorgemerkt? Fuer HUD und Tests. */
  get abholungVorgemerkt(): boolean {
    return this.vorgemerkt !== null;
  }

  /**
   * Abholung anfordern bzw. wartenden Abhol-LKW abfahren lassen.
   *
   * Die Abholung hat Vorrang (Ansage 12.09.2026: „Abholung soll Vorrang
   * bekommen“). Frueher fiel eine Bestellung ersatzlos aus, solange noch ein
   * Anlieferer auf dem Hof war — man drueckte V, bekam „erst muss das Fahrzeug
   * fertig werden“ und musste sich selbst merken, es spaeter nochmal zu
   * versuchen. Jetzt wird sie vorgemerkt und faehrt als naechstes los, ohne die
   * uebliche Wartezeit und noch vor jedem weiteren Anlieferer.
   *
   * Den laufenden Anlieferer schickt sie nicht weg. Der steht mit bezahlter
   * Ladung auf dem Platz; ihn abzuwuergen waere kein Vorrang, sondern ein
   * Verlust.
   */
  requestPickup(order?: string | null): "gerufen" | "abgefahren" | "vorgemerkt" {
    // An den Abladeplatz kann er nicht, solange dort eine Mulde steht (E-141)
    if (!this.active && this.mulde && !abholPlatzFuer(order ?? null).ziel) {
      this.vorgemerkt = { order: order ?? null };
      return "vorgemerkt";
    }
    if (this.active) {
      if (this.active.kind === "abholer" && this.active.waitingForLoad) {
        this.active.requestRelease();
        return "abgefahren";
      }
      this.vorgemerkt = { order: order ?? null };
      return "vorgemerkt";
    }
    this.pickupOrder = order ?? null;
    this.spawnNow("abholer");
    return "gerufen";
  }

  /**
   * Alle Fahrzeuge sofort vom Hof nehmen.
   *
   * Gebraucht beim harten Szenenwechsel — Spielstand laden, Schicht neu
   * beginnen —, wo ein halb abgeladener LKW aus dem alten Zustand stehen
   * bliebe. Eine vorgemerkte Abholung bleibt bestehen: Die hat der Spieler
   * bestellt, und sie gehoert nicht zum Fuhrpark, sondern zu seinem Auftrag.
   */
  raeumePlatz(): void {
    this.active?.despawn();
    this.active = null;
    for (const v of this.parked) v.despawn();
    this.parked.length = 0;
    if (this.mulde) {
      this.mulde.group.removeFromParent();
      this.world.removeRigidBody(this.mulde.body);
      this.mulde = null;
    }
    this.nachMulde = null;
    this.t = 0;
    this.nextSpawnT = FIRST_DELAY_S;
  }

  /** Position des Fahrzeugs, solange es auf dem Platz rangiert/ablädt (für den Platzwart). */
  maneuveringTruck(): THREE.Vector3 | null {
    if (!this.active) return null;
    const p = this.active.phaseName;
    if (
      p === "reverseIn" ||
      p === "shiftPause" ||
      p === "pauseBeforeUnload" ||
      p === "tipping" ||
      p.startsWith("mulde") ||
      p === "armeEin"
    ) {
      return this.active.group.position;
    }
    return null;
  }

  /**
   * Steht gerade ein Fahrzeug zur Kontrolle auf der Waage? Dann kommt Mario
   * aus dem Büro und sieht sich die Ladung an (Wunsch 11.09.2026).
   *
   * Bei der Einfahrt gilt das für jedes Fahrzeug — seit E-064 auch für den
   * Abholer, der dort leer gewogen wird. Bei der Ausfahrt seit E-120 ebenfalls
   * für jedes (Patrick, 06.10.2026: „Er soll immer noch an der Waage halten").
   */
  wiegeKontrolle(): THREE.Vector3 | null {
    for (const v of [this.active, ...this.parked]) {
      if (v && v.aufDerWaage) return v.group.position;
    }
    return null;
  }

  /**
   * Standflächen aller Fahrzeuge auf dem Hof. Bagger und Radlader fragen das
   * ab, bevor sie einen Schritt machen — vorher fuhren beide mitten durch
   * stehende LKW hindurch (Befund 11.09.2026).
   */
  fahrzeugBoxen(): Box[] {
    this.boxCache.length = 0;
    if (this.active) this.active.boxen(this.boxCache);
    for (const v of this.parked) v.boxen(this.boxCache);
    // Die abgesetzte Mulde steht wie ein Fahrzeug im Weg (E-141)
    if (this.mulde) {
      const g = this.mulde.group;
      g.updateWorldMatrix(true, false);
      const mitte = new THREE.Vector3(0, 0, ABSETZMULDE.laenge / 2).applyMatrix4(g.matrixWorld);
      const q = new THREE.Quaternion();
      g.getWorldQuaternion(q);
      const rot = new THREE.Euler().setFromQuaternion(q, "YXZ").y;
      this.boxCache.push({ x: mitte.x, z: mitte.z, hw: ABSETZMULDE.breite / 2, hd: ABSETZMULDE.laenge / 2, rot });
    }
    return this.boxCache;
  }
  private boxCache: Box[] = [];

  /** Der wartende Abhol-LKW (für Beladung/Verkauf), sonst null. */
  get pickupTruck(): DeliveryVehicle | null {
    return this.active && this.active.kind === "abholer" ? this.active : null;
  }

  /**
   * Anlieferer vom Hof schicken — etwa wenn der Wagen offensichtlich leer ist
   * oder man gerade keinen Platz hat. Er dreht ab und fährt zur Ausfahrt.
   */
  sendAway(): "weggeschickt" | "zuSpaet" | "niemandDa" {
    if (!this.active || this.active.kind === "abholer") return "niemandDa";
    return this.active.sendAway() ? "weggeschickt" : "zuSpaet";
  }

  /**
   * „Mach mal Platz": Vor dem Abladen dreht der Fahrer ab, danach fährt er
   * nur ein Stück vor — so kommt man an Schrott heran, der unter dem
   * Fahrzeug liegt.
   */
  /**
   * Den Wagen zur Waage schicken (Wunsch 11.09.2026).
   *
   * Vorher hiess der Befehl "Vorfahren" und ruckelte den LKW ein Stueck nach
   * vorn. Gebraucht wird er aber, wenn hinten unsichtbar Reste liegen, die
   * sich nicht greifen lassen — dann ist Vorfahren nur ein Umweg. Jetzt faehrt
   * der Wagen ueber die Waage vom Hof, die Reste zaehlen als Tara, und
   * bezahlt wird, was tatsaechlich abgeladen wurde.
   */
  zurWaage(): "geschickt" | "niemandDa" {
    if (!this.active) return "niemandDa";
    return this.active.sendAway() ? "geschickt" : "niemandDa";
  }

  /** Körper-Handles des aktiven Fahrzeugs — der Baggerarm taucht da nicht ein. */
  obstacleHandles(out: Set<number>): Set<number> {
    out.clear();
    if (this.active) this.active.collectBodyHandles(out);
    // Auch die Wartenden stehen im Weg — der Arm darf nicht hindurchfahren
    for (const v of this.parked) v.collectBodyHandles(out);
    if (this.mulde?.body.isValid()) out.add(this.mulde.body.handle);
    return out;
  }

  /** Verhandlung läuft: Das Fahrzeug wartet an der Waage. */
  set dealPending(v: boolean) {
    if (this.active) this.active.awaitingDeal = v;
  }

  /** Rückmeldung, wenn die Verhandlung in die Zeitgrenze läuft. */
  set onDealTimeout(fn: () => void) {
    if (this.active) this.active.onDealTimeout = fn;
  }

  /** Wer gerade an der Waage steht — für die Verhandlung. */
  get activeCustomer(): CustomerProfile | null {
    return this.active?.customer ?? null;
  }

  get activeKind(): DeliveryKind | null {
    return this.active?.kind ?? null;
  }

  /** Fraktion der laufenden Anlieferung, falls sie sortenrein ist. */
  get activeSortedMaterial(): string | null {
    return this.active?.sortedMaterial ?? null;
  }

  /**
   * Zusammensetzung der wartenden Ladung nach Fraktion, absteigend nach
   * Masse. Sichtbar wird das erst mit dem Büro — ohne Marktkenntnis sieht man
   * einem gemischten Haufen auf der Ladefläche nicht an, was drinsteckt.
   */
  get activeCargoMix(): Array<{ materialId: string; kg: number; share: number }> {
    const items = this.active?.cargo.items ?? [];
    if (items.length === 0) return [];
    const kgJe = new Map<string, number>();
    let gesamt = 0;
    for (const it of items) {
      kgJe.set(it.materialId, (kgJe.get(it.materialId) ?? 0) + it.massKg);
      gesamt += it.massKg;
    }
    if (gesamt <= 0) return [];
    return [...kgJe.entries()]
      .map(([materialId, kg]) => ({ materialId, kg, share: kg / gesamt }))
      .sort((a, b) => b.kg - a.kg);
  }

  /**
   * Zum Start Fuhren auf die Warteplaetze stellen (E-131, nur Sandkasten).
   *
   * Je eine auf die ersten `anzahl` Warteplaetze, beladen wie vom Tor. Wer
   * ins Lagersilo kippen wuerde, wird neu gewuerfelt: Die Fahrt vom
   * Warteplatz in die Silo-Gasse ist nie abgetastet worden, die zum
   * Abladeplatz schon (`test/anstehen.test.ts`, E-131). Der erste rollt
   * nach `ANSTEH_ERSTER_S`, die naechsten im ueblichen Takt; erst wenn keiner
   * mehr ansteht, kommt wieder einer durchs Tor.
   */
  stelleAnstehendeAuf(anzahl: number, kunden: CustomerProfile[] = []): void {
    for (const [n, slot] of PARK_SLOTS.slice(0, anzahl).entries()) {
      // `kunden`: fuer Pruefstaende, wie bei `spawnNow` — sonst wer kommt
      let kunde = kunden[n] ?? rollAnlieferung();
      // Hoechstens 20 Wuerfe (SW): Silo-Fuhren sind ein kleiner Teil der
      // Kundschaft; bleibt es danach eine, kippt er eben ins Silo.
      // Und kein Absetzkipper (E-141): Seine Fahrt vom Warteplatz ist nicht gerechnet
      const insSilo = (c: CustomerProfile): boolean =>
        vehicleForCustomer(c) === "absetzer" ||
        faehrtInsSilo(vehicleForCustomer(c), lagerMuldeFuer(c.sortedMaterial ?? null));
      for (let i = 0; i < 20 && !kunden[n] && insSilo(kunde); i++) kunde = rollAnlieferung();
      const v = this.baueWagen(vehicleForCustomer(kunde), kunde);
      v.stelleAnstehendAuf(slot);
      v.loadCargo(this.items, this.composites);
      this.deliveries++;
      this.parked.push(v);
    }
    this.t = 0;
    this.nextSpawnT = ANSTEH_ERSTER_S;
  }

  /** Wie viele stehen noch beladen auf einem Warteplatz an? */
  get anstehend(): number {
    return this.parked.filter((v) => v.stehtAn).length;
  }

  /**
   * DIE ABGESETZTE MULDE BEOBACHTEN (E-141): Wie lange steht sie, und wie
   * lange ist sie schon leer? Leer heisst: hoechstens `MULDE_LEER_KG` in
   * ihrem Trog — gefragt wird nur alle 0,25 s (wie `VOLL_PRUEF_S`).
   */
  private muldePruefT = 0;
  private pruefeMulde(dt: number): void {
    const m = this.mulde;
    if (!m) return;
    m.standS += dt;
    this.muldePruefT -= dt;
    if (this.muldePruefT > 0) return;
    this.muldePruefT = 0.25;
    m.group.updateWorldMatrix(true, false);
    const inv = new THREE.Matrix4().copy(m.group.matrixWorld).invert();
    const hilf = new THREE.Vector3();
    let kg = 0;
    for (const it of this.items.items) {
      if (!it.body.isValid()) continue;
      if (imTrog(inv, it.body.translation(), hilf)) kg += it.massKg;
    }
    m.leerS = kg <= MULDE_LEER_KG ? m.leerS + 0.25 : 0;
  }

  /** Ist die Mulde abholbereit — leer, oder ist ihre Frist um? */
  private muldeAbholbereit(): boolean {
    const m = this.mulde;
    return !!m && (m.leerS >= MULDE_LEER_WARTE_S || m.standS >= MULDE_FRIST_S);
  }

  /** Ein Absetzkipper holt die abgesetzte Mulde (E-141) — derselbe Kunde. */
  private holeMulde(): void {
    const m = this.mulde!;
    this.active = this.baueWagen("absetzer", m.kunde, m);
    this.active.loadCargo(this.items, this.composites);
  }

  update(dt: number): void {
    this.t += dt;
    this.pruefeMulde(dt);
    // Wartende Fahrzeuge weiterlaufen lassen: Pause, dann Ausfahrt
    for (let i = this.parked.length - 1; i >= 0; i--) {
      const v = this.parked[i];
      v.update(dt);
      if (v.done) {
        v.despawn();
        this.parked.splice(i, 1);
      }
    }
    if (!this.active) {
      /*
       * STEHT EINE MULDE (E-141), IST DER ABLADEPLATZ ZU. Sie steht genau
       * dort, wo jeder andere Wagen zuruecksetzt. Geholt wird sie, sobald sie
       * leer ist (oder ihre Frist um ist); bis dahin kommt kein Anlieferer,
       * und ein Abholer nur, wenn er an ein Silo faehrt.
       */
      if (this.mulde) {
        if (this.muldeAbholbereit()) {
          this.holeMulde();
          return;
        }
        const v = this.vorgemerkt;
        if (v && abholPlatzFuer(v.order).ziel) {
          this.pickupOrder = v.order;
          this.vorgemerkt = null;
          this.spawnNow("abholer");
        }
        return;
      }
      // Vorrang: Eine vorgemerkte Abholung faehrt sofort, ohne Wartezeit und
      // auch dann, wenn die Einfahrt fuer Anlieferer gerade zu ist.
      if (this.vorgemerkt) {
        this.pickupOrder = this.vorgemerkt.order;
        this.vorgemerkt = null;
        this.spawnNow("abholer");
        return;
      }
      // Was waehrend der Mulde warten musste, kommt jetzt (E-141)
      if (this.nachMulde) {
        const n = this.nachMulde;
        this.nachMulde = null;
        this.spawnNow(n.k, n.kunde);
        return;
      }
      if (this.acceptDeliveries && this.t >= this.nextSpawnT) {
        // Wer auf dem Warteplatz ansteht, ist vor dem naechsten am Tor dran (E-131)
        const i = this.parked.findIndex((v) => v.stehtAn);
        if (i < 0) {
          this.spawnNow();
          return;
        }
        this.active = this.parked.splice(i, 1)[0]!;
        this.active.rueckeVor();
      }
      return;
    }
    this.active.update(dt);
    if (this.active.consumeDeparted()) this.onPickupDepart?.(this.active);
    // Sobald das Fahrzeug den Abladeplatz Richtung Warteplatz verlässt, ist
    // der Platz frei und der Nächste darf kommen — auch wenn der Vorige noch
    // beim Kaffee steht.
    if (this.active.isParked) {
      this.parked.push(this.active);
      this.active = null;
      this.t = 0;
      this.nextSpawnT =
        (NEXT_DELAY_S[0] + Math.random() * (NEXT_DELAY_S[1] - NEXT_DELAY_S[0])) *
        this.intervalFactor;
      return;
    }
    if (this.active.done) {
      this.active.despawn();
      this.active = null;
      this.t = 0;
      this.nextSpawnT =
        (NEXT_DELAY_S[0] + Math.random() * (NEXT_DELAY_S[1] - NEXT_DELAY_S[0])) *
        this.intervalFactor;
    }
  }
}
