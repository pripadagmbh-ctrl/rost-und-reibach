import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { findeBox, type Box } from "../world/boxen";
import RAPIER from "@dimforge/rapier3d-compat";
import type { Input } from "../core/input";
import { Aufschlagmelder, SPINNE_WUCHT_VOLL_MS, DRUECK_AB, DRUECK_PAUSE_S, DRUECK_WEG_M } from "./aufschlag";
import { ExcavatorCollision, PROBE_R, type ArmShape } from "./collision";
import type { GripSystem } from "../physics/gripSystem";
import { nutzlastKg } from "./traglast";
import { FUENFSCHALEN } from "./greiferFuenfschalen";
import { InstrumentPanel, type InstrumentReadout } from "./instruments";
import { buildDriver, fahrerArme } from "./driver";
import { baueRad, radGeometrien, radStoffe, RAD_R } from "./wheelParts";
import { baueZylinder, type ZylinderMasse } from "./zylinderParts";
import {
  auslegerLack,
  auslegerLeuchten,
  auslegerSchlauch,
  auslegerStahl,
  stielLack,
  stielSchlauch,
  stielStahl,
} from "./armParts";
import { oberwagenLack, oberwagenLeuchten, oberwagenStahl } from "./oberwagenParts";
import { pratzeFuss, pratzeStempel, schildKoerper, schildSchneide } from "./schildParts";
import { farbstoff } from "./bauteile";
import {
  joystick,
  kabineGlas,
  kabineLack,
  kabineSitz,
  kabineStahl,
} from "./kabinenParts";
import {
  unterwagenLack,
  unterwagenStahl,
  PRATZE_X,
  PRATZE_Z,
  UNTERWAGEN_R,
} from "./unterwagenParts";
import {
  DREHPUNKT as HUB_DREHPUNKT,
  HUB_MAX as CAB_LIFT_MAX,
  ZYL_FUSS as CAB_ZYL_FUSS,
  ZYL_KOPF as CAB_ZYL_KOPF,
  ZYL_MASSE as CAB_ZYL_MASSE,
  hubVersatz,
  hubWinkel,
  kabinenlenker,
  kabinenmast,
} from "./kabinenhubParts";
import { BAGGER_STAND } from "../world/baggerstand";
import { naechsteSpreizung } from "./clawGeometry";
import type { GameEvents } from "../core/events";
import {
  SICHELKRALLE,
  type Greiferbau,
  type Greiferform,
  type GreiferId,
} from "./greiferform";

/**
 * Fuchsbagger (Umschlagbagger) — M0.
 * Kinematische Kette (Briefing Kap. 6.1): Der Arm ist animiert, NICHT physiksimuliert.
 * Chassis und Greifer haben kinematische Rapier-Körper, damit sie Schrott wegschieben können.
 * Der Greifer hängt in M0 immer lotrecht (Pendel/Auto-Nivellierung kommt später).
 */

// Geometrie (SW)
/**
 * Höchste Krallenspitze, die der Arm bei einem waagerechten Abstand vom
 * Baggermittelpunkt noch erreicht — in Metern über dem Boden.
 *
 * Damit lässt sich prüfen, ob eine Mulde überhaupt zu befüllen ist: Der Arm
 * hat einen scharfen Knick bei rund 6,5 m. Näher dran bleibt er eingeklappt
 * und kommt kaum über zwei Meter; jenseits von 9,5 m reicht er gar nicht mehr.
 * Ohne diese Rechnung stand die Sortierreihe bei 4,6 m mitten in der toten
 * Zone, und keine Mulde war von der Standposition aus erreichbar.
 *
 * Reine Geometrie, kein Zustand — absichtlich ohne die Klasse benutzbar.
 *
 * `tief` IST DIE AUSLADUNG IN WELTRICHTUNG −y, nicht die Laenge in der
 * Greiferachse. Bei lotrechtem Greifer sind das dieselbe Zahl, und deshalb
 * steht `SICHELKRALLE.maxTiefe` unveraendert als Vorgabe da. Wer nach der
 * Reichweite eines SCHRAEG haengenden Greifers fragt, uebergibt
 * `form.maxAusladung(neigung)`.
 *
 * Diese Funktion plant den PLATZ (wo Mulden stehen duerfen, ob die Presse
 * erreichbar ist) und laeuft nicht im Spiel mit. Ihre Vorgabe bleibt deshalb
 * die lotrecht haengende Sichelkralle: Was einmal als erreichbar geplant
 * wurde, soll sich nicht verschieben, weil das Pendel gerade ausschlaegt.
 */
export function hoechsteKrallenspitze(
  abstandM: number,
  /*
   * Die groesste Tiefe ueber alle Stellungen, nicht die der offenen Spinne.
   * Mit der Sichelkralle vom 12.09. mittags haengt die geschlossene Spinne
   * 13 cm tiefer als die offene — wer nur die offene rechnet, haelt den Arm
   * fuer hoeher, als er ist, und der Greifer streift die Wand.
   *
   * Vorgabe ist die Sichelkralle, nicht der gerade angehaengte Greifer: An
   * dieser Zahl haengt die Planung des Platzes (wo Mulden stehen duerfen), und
   * die soll sich nicht aendern, wenn Patrick im Menue den Greifer wechselt.
   * Wer wissen will, was der andere Greifer erreicht, gibt seine Tiefe mit —
   * gemessen sind es 0,2484 m mehr Hoehe (E-048).
   */
  tief: number = SICHELKRALLE.maxTiefe
): number {
  let best = -Infinity;
  for (let b = BOOM_MIN; b <= BOOM_MAX; b += 0.004) {
    for (let st = STICK_MIN; st <= STICK_MAX; st += 0.004) {
      const x = BOOM_PIVOT.z + BOOM_LEN * Math.cos(b) + STICK_LEN * Math.cos(b + st);
      if (Math.abs(x - abstandM) > 0.05) continue;
      const y = BOOM_PIVOT.y + BOOM_LEN * Math.sin(b) + STICK_LEN * Math.sin(b + st);
      best = Math.max(best, y - tief);
    }
  }
  return best;
}

const BOOM_LEN = 5.2;
const STICK_LEN = 4.0;
/*
 * Der Drehpunkt des Hauptarms sitzt hoeher als frueher (2,55 m), und der Arm
 * darf weiter aufrichten (Wunsch 11.09.2026: "etwas hoeher vom Hauptarm und
 * Ausleger"). Ein Umschlagbagger hat genau dieses Profil: hochgesetzter
 * Oberwagen, steil stehender Ausleger, damit er ueber Bordwaende und
 * Muldenraender langt.
 *
 * Nachgerechnet mit hoechsteKrallenspitze — so weit kommen die Krallenspitzen
 * ueber Grund, je nach Abstand vom Bagger:
 *
 *          4,6 m   6,0 m   6,5 m   7,5 m   8,5 m   9,5 m
 *   vorher  1,48    2,52    7,30    6,28    4,80    1,73
 *   nachher 2,55    8,11    7,70    6,68    5,20    2,13
 *
 * Der Knick wandert damit von 6,5 auf 6,0 m nach innen: Auch die naeheren
 * Mulden sind jetzt sauber zu befuellen, und ueber eine 3-m-Wand kommt der
 * Greifer ab 4,6 m statt erst ab 6,5 m.
 */
const BOOM_PIVOT = new THREE.Vector3(0, 2.95, 0.55); // relativ zum Chassis-Ursprung (Boden)
const GRAPPLE_LINK = 0.55; // Abstand Stielspitze → Palm-Oberkante

/*
 * Anlenkpunkte der Arbeitszylinder — unverändert seit dem Prototyp, hier nur
 * aus `buildHydraulics` herausgezogen.
 *
 * Sie stehen ab dem 15.09.2026 als Konstanten da, weil jetzt ZWEI Stellen sie
 * brauchen: der Zylinder selbst und der Lagerbock, an dem er hängt
 * (`armParts.ts`). Vorher hing jeder Zylinder an einem `Object3D` ohne Blech
 * darum — er kam buchstäblich aus dem Nichts.
 */
/** Fußanker des rechten Hubzylinders, im Oberwagenframe (m). */
const HUB_FUSS_R: [number, number, number] = [-0.52, 0.02, 1.05];
/** Fußanker des linken Hubzylinders, im Oberwagenframe (m). */
const HUB_FUSS_L: [number, number, number] = [0.52, 0.02, 1.05];
/** Kopfanker des rechten Hubzylinders, im Auslegerframe (m). */
const HUB_KOPF_R: [number, number, number] = [-0.28, -0.2, 2.6];
/** Kopfanker des linken Hubzylinders, im Auslegerframe (m). */
const HUB_KOPF_L: [number, number, number] = [0.28, -0.2, 2.6];
/** Fußanker des Stielzylinders, im Auslegerframe (m). */
const STIEL_ZYL_FUSS: [number, number, number] = [0, 0.34, 3.4];
/** Kopfanker des Stielzylinders, im Stielframe (m). */
const STIEL_ZYL_KOPF: [number, number, number] = [0, 0.2, 0.35];

// Räumschild vorn am Unterwagen
const BLADE_W = 2.9; // Schildbreite (SW) — deckt die Spur der Maschine ab
const BLADE_Z = 2.55; // Abstand vom Drehmittelpunkt nach vorn
const BLADE_UP_Y = 0.62; // Bodenfreiheit im angehobenen Zustand
const BLADE_TIME = 1.4; // s für einen vollen Hub

const UP_Y = new THREE.Vector3(0, 1, 0);

/**
 * Wo VORN, HINTEN, LINKS und RECHTS am Bagger sind — die Grundlage aller
 * Bauteilnamen mit Ecke (`02_RAD_VL`, `03_PRATZE_HR`, `06_SAEULE_VR`).
 *
 * +Z ist vorn: Dorthin zeigt der Ausleger (`boom.position.z = BOOM_LEN / 2`)
 * und dort sitzt das Raeumschild (`BLADE_Z = 2.55`, „nach vorn").
 *
 * −X ist RECHTS. Das ist keine Wahl, sondern folgt aus dem Rechtssystem von
 * three.js und steht so auch im Kabinenbau: „er blickt in +Z, seine rechte
 * Seite ist −X" (Platzierung des Bordinstruments). Wer nach vorn schaut und
 * oben +Y hat, dessen Rechte zeigt in −X.
 *
 * Achtung beim Lesen aelterer Kommentare: An der Kabine steht „deutlich weiter
 * nach links gesetzt" bei cx = −1,05 — nach dieser Regel ist das die rechte
 * Seite. Die Regel hier gilt, weil sie aus der Geometrie kommt; der Kommentar
 * dort ist eine beilaeufige Formulierung.
 */
const RAD_ECKEN: ReadonlyArray<readonly [number, number, string]> = [
  [-1.25, 1.5, "VR"],
  [1.25, 1.5, "VL"],
  [-1.25, -1.5, "HR"],
  [1.25, -1.5, "HL"],
];

/** Ecke aus den Vorzeichen: sx = +1 links, sz = +1 vorn (siehe RAD_ECKEN). */
function ecke(sx: number, sz: number): string {
  return `${sz > 0 ? "V" : "H"}${sx > 0 ? "L" : "R"}`;
}

/*
 * Der Sensorsitz stand hier als `PALM_TO_SENSOR = 0.75` („Palm-Zentrum →
 * Sensor in der Mitte des Schalenkorbs") und wurde zu
 * `GRAPPLE_LINK + 0.2 + PALM_TO_SENSOR` = 1,50 m zusammengerechnet. Seit E-057
 * gibt ihn die Form vor (`Greiferform.sensorSitz`) — fuer die Sichelkralle auf
 * die Zahl genau dieselben 1,50 m. `test/greiffenster.test.ts` misst sie am
 * gebauten Bagger nach.
 */

// Achsgrenzen (SW)
const BOOM_MIN = THREE.MathUtils.degToRad(5);
const BOOM_MAX = THREE.MathUtils.degToRad(70);
const STICK_MIN = THREE.MathUtils.degToRad(-140);
const STICK_MAX = THREE.MathUtils.degToRad(-25);

// Geschwindigkeiten (SW aus Briefing Kap. 5.1)
/*
 * Fahrtempo.
 *
 * Bis 14.09.2026 standen hier 1,4 m/s = 5 km/h. Das ist Kettenbagger-Tempo.
 * Der Fuchs ist ein RADbagger und faehrt auf dem Platz real 10 bis 15 km/h;
 * 1,4 war also kein bewusstes Spielgefuehl, sondern ein zu niedriger Wert.
 * Der Platz misst 50,5 x 58 m, und mit dem Verladeplatz an der Westwand
 * (E-010) wird zum ersten Mal ernsthaft gefahren: 35 m hin und zurueck
 * dauerten bei 1,4 m/s rund 50 s, bei 3,2 m/s rund 23 s.
 *
 * 3,2 m/s = 11,5 km/h, die Mitte des von E-010 freigegebenen Bandes 3,0-3,5.
 */
const DRIVE_MAX = 3.2; // m/s ≈ 11,5 km/h (E-010, 14.09.2026)
/*
 * Anlauf und Auslauf des Fahrwerks — eigene Rampe, nicht die des Arms.
 *
 * Bis 14.09. teilte sich das Fahrwerk RAMP_TIME (0,3 s) mit Ausleger, Stiel
 * und Oberwagen. Die Rampe ist aber eine ZEIT, und die Beschleunigung faellt
 * hinten raus: bei 1,4 m/s in 0,3 s sind das 4,7 m/s². Haette man nur
 * DRIVE_MAX angehoben, waeren daraus 10,7 m/s² geworden — 1,1 g, also die
 * Beschleunigung eines flotten Autos. Genau das soll der Bagger nicht sein.
 *
 * Darum wandert die Rampe mit: 3,2 / 0,7 = 4,6 m/s², praktisch dieselbe
 * Beschleunigung wie vorher. Geaendert wird das Endtempo, nicht das Anfahren.
 * RAMP_TIME bleibt unangetastet, der Arm merkt von alledem nichts.
 */
const DRIVE_RAMP_TIME = 0.7; // s bis Endtempo (= 4,6 m/s², wie vor E-010)
/*
 * Lenkrate — bewusst unveraendert bei 0,7 rad/s (40 °/s).
 *
 * Die Lenkung arbeitet mit fester Gierrate mal Tempofaktor (siehe unten),
 * und solange der Tempofaktor linear ist, kuerzt sich das Tempo heraus:
 * Der Bogen hat immer den Radius DRIVE_MAX / STEER_RATE.
 *   vorher: 1,4 / 0,7 = 2,00 m
 *   nachher: 3,2 / 0,7 = 4,57 m
 * Der Bogen wird also WEITER, nicht enger — bei gleicher Gierrate legt die
 * Maschine je Grad mehr Strecke zurueck.
 *
 * Und erst damit stimmt die Geometrie: Ein Radbagger dieser Klasse hat rund
 * 2,8 m Radstand und etwa 32° Lenkeinschlag, also 2,8 / tan(32°) = 4,5 m
 * Wenderadius. Fuer die alten 2,00 m haette die Achse 54° einschlagen
 * muessen — das kann keine gelenkte Achse. Eine mitgezogene Lenkrate
 * (1,6 rad/s fuer den alten 2-m-Bogen) waere ein Kreisel gewesen.
 *
 * Eng rangiert wird weiter im Stand: ohne Gas, nur Lenken, dreht sie mit
 * 0,35 * 0,7 = 0,245 rad/s = 14 °/s auf der Stelle. Das ist unveraendert.
 */
const STEER_RATE = 0.7; // rad/s

/** Radstand (m) — Abstand Vorder- zu Hinterachse, aus `RAD_ECKEN`. */
const RADSTAND = 3.0;
/**
 * Größter Lenkeinschlag der Vorderräder (rad).
 *
 * Nicht gesetzt, sondern GERECHNET: Bei Vollgas und vollem Ausschlag fährt die
 * Maschine einen Kreis mit `wenderadius()` = 3,2 / 0,7 = 4,57 m. Eine gelenkte
 * Vorderachse mit 3,00 m Radstand braucht dafür atan(3,00 / 4,57) = 33,3°.
 * Stünde hier eine eigene Zahl, liefe das Rad irgendwann anders als die
 * Maschine — man sähe es sofort, weil das Rad dann quer zur Bahn stünde.
 */
const LENK_MAX = Math.atan(RADSTAND / (DRIVE_MAX / STEER_RATE));
/** Zeit, in der die Lenkung von Anschlag zu Anschlag läuft (s). SW. */
const LENK_ZEIT = 0.35;
/*
 * Drehwerk.
 *
 * Das Datenblatt einer solchen Maschine nennt 7 bis 9 Umdrehungen je Minute,
 * also 42 bis 54 Grad je Sekunde. Das ist aber das **Hoechste, was sie kann**,
 * und ein Fahrer benutzt es fast nie: Er zieht den Hebel so weit, wie er die
 * Last noch im Griff hat. Im Spiel gibt es diesen Unterschied nicht — die
 * Taste kennt nur ganz oder gar nicht, und damit faehrt der Spieler staendig
 * Anschlag. Das Endtempo muss darum ein Arbeitstempo sein, nicht das Maximum
 * der Maschine.
 *
 * 45 Grad je Sekunde waren zu viel. Danach ging es auf 36 und dann auf 28 —
 * beides Reaktionen auf "zu schnell", beide falsch abgeleitet: Beurteilt
 * wurde eine Maschine, die 0,5 s zum Anlaufen brauchte und deren Rampe in
 * beide Richtungen weich war. Die kroch los und riss dann. Nicht das
 * Endtempo war zu hoch, die Reaktion war zu traege.
 *
 * Danach zurueck auf 36 gestellt mit der Begruendung, die traege Reaktion sei
 * die Ursache gewesen. War sie nicht: "das Drehwerk ist zu schnell, das merke
 * ich doch" (11.09.2026). Wer faehrt, hat recht. 28 Grad je Sekunde, knapp
 * fuenf Umdrehungen je Minute; die Spitze laeuft damit auf 8 m Radius mit
 * 3,8 m/s, also 14 km/h.
 *
 * Das frueher gemeldete "zu langsam" galt nicht dem Grundtempo, sondern der
 * Last: "alles bis vier, fuenf Tonnen sollte kein Problem sein". Dafuer
 * sorgt tempoFaktor, nicht CAB_MAX.
 *
 * NACHTRAG 15.09.2026: 28 -> 33 Grad je Sekunde. Patrick am Geraet: "Oberturm
 * etwas schneller machen." Das ist die Umkehr seines eigenen Befunds vom
 * 11.09. ("das Drehwerk ist zu schnell, das merke ich doch") — und sie gilt,
 * nach derselben Regel wie damals: Wer faehrt, hat recht.
 *
 * "Etwas" ist ernst genommen: +18 %, nicht zurueck auf die 36 oder 45, die er
 * zweimal abgelehnt hat. Die Spitze laeuft damit auf 8 m Radius mit 4,6 statt
 * 3,8 m/s, also 17 statt 14 km/h. Faellt es wieder zu hastig aus, ist der
 * naechste Schritt 30 oder 31 — und nicht zurueck auf 28, denn der Wunsch
 * nach "schneller" bleibt ja bestehen.
 */
export const CAB_MAX = THREE.MathUtils.degToRad(33);
const BOOM_RATE = THREE.MathUtils.degToRad(19);
const STICK_RATE = THREE.MathUtils.degToRad(24);
const ROTATOR_STEP = THREE.MathUtils.degToRad(15); // pro Mausrad-Raste
/**
 * Dauerdrehung des Rotators. Vorher wurde je Bild ein fester Winkel addiert,
 * nicht je Sekunde: Bei 60 Bildern ergab das 54°/s, bei 30 Bildern auf dem
 * Tablet nur 27 — der Rotator war dort halb so schnell wie am Rechner, ohne
 * dass es jemand so gebaut hätte. Jetzt zeitbasiert, und deutlich zügiger:
 * Ein Schrottgreifer dreht die Ladung flott in die Mulde, er zirkelt nicht.
 */
/*
 * Gemessen am 11.09.2026: 160 Grad je Sekunde drehen die Ladung so schnell
 * herum, dass jede Bewegung nach Zappeln aussieht. Ein Rotator unter Last
 * dreht spuerbar langsamer als frei; 105 Grad je Sekunde sind zuegig genug,
 * um die Mulde zu treffen, ohne dass die Ladung herumgeschleudert wird.
 */
const ROTATOR_SPEED = THREE.MathUtils.degToRad(120); // rad/s
/**
 * Last und Tempo.
 *
 * Die Hydraulik ist druckgeregelt: Bis zur Nennlast dreht das Drehwerk fast
 * genauso schnell wie leer, zu spueren ist die Last im Anlauf. Vorher war es
 * andersherum modelliert — zwei Tonnen halbierten das Tempo der ganzen
 * Maschine, und das Arbeiten wurde zaeh, obwohl zwei Tonnen fuer ein Geraet
 * dieser Groesse nichts sind (Befund 11.09.2026).
 */
const NENNLAST_KG = 5000;
/** Was bei Nennlast an Endtempo fehlt */
const LAST_TEMPO = 0.15;
/** Darueber wird es deutlich: bei doppelter Nennlast bleibt die Haelfte. */
const UEBERLAST_TEMPO = 0.35;
/** Um so viel laenger braucht der Anlauf bei Nennlast */
const LAST_ANLAUF = 0.9;

/** Endtempo-Faktor fuer eine Last (1 = leer). */
export function tempoFaktor(lastKg: number): number {
  const bisNenn = Math.min(Math.max(lastKg, 0) / NENNLAST_KG, 1);
  const ueber = Math.min(Math.max(lastKg - NENNLAST_KG, 0) / NENNLAST_KG, 1);
  return 1 - LAST_TEMPO * bisNenn - UEBERLAST_TEMPO * ueber;
}

/** Anlauf- und Auslauframpe (s) fuer eine Last. */
export function anlaufZeit(lastKg: number): number {
  const bisNenn = Math.min(Math.max(lastKg, 0) / NENNLAST_KG, 1);
  return RAMP_TIME * (1 + LAST_ANLAUF * bisNenn);
}

/*
 * Das Fahrwerk auf dem Papier — dieselben Konstanten und dieselbe Rampe wie
 * im Spiel, nur ohne Welt drumherum. Damit laesst sich das Fahrtempo kopflos
 * pruefen (test/fahrtempo.test.ts), ohne Three.js-Szene und ohne Rapier.
 */
export const FAHRWERK = { maxMS: DRIVE_MAX, rampeS: DRIVE_RAMP_TIME, lenkRadS: STEER_RATE };

/**
 * Wenderadius bei voller Fahrt und vollem Lenkausschlag (m).
 *
 * Die Gierrate ist STEER_RATE mal Tempofaktor; bei Vollgas ist der 1, also
 * r = v / omega.
 */
export function wenderadius(): number {
  return DRIVE_MAX / STEER_RATE;
}

/** Zeit (s) fuer eine gerade Strecke aus dem Stand bei Vollgas. */
export function fahrzeit(streckeM: number, dt = 1 / 60): number {
  let v = 0;
  let s = 0;
  let t = 0;
  const schritt = (DRIVE_MAX / DRIVE_RAMP_TIME) * dt;
  while (s < streckeM && t < 600) {
    v = ramp(v, DRIVE_MAX, schritt);
    s += v * dt;
    t += dt;
  }
  return t;
}

/** Ausrollweg (m) vom Endtempo bis zum Stillstand, wenn das Gas losgelassen wird. */
export function bremsweg(dt = 1 / 60): number {
  let v = DRIVE_MAX;
  let s = 0;
  const schritt = (DRIVE_MAX / DRIVE_RAMP_TIME) * dt;
  for (let i = 0; i < 6000 && v > 0; i++) {
    v = ramp(v, 0, schritt);
    s += v * dt;
  }
  return s;
}

/** Ab diesem Schliessgrad treffen sich die Krallenspitzen. */
/**
 * Kollider-Reihen je Kralle, quer zur Krallenrichtung.
 *
 * Eine. Am 12.09. abends waren es drei (E-117), weil die 0,90 m breite
 * Trogschale mit einer einzigen Kapselkette physisch ein 18 cm dicker Draht
 * war und Material links und rechts daran vorbeifiel. Mit der Rueckkehr zur
 * Sichelkralle vom Mittag ist das hinfaellig: Die ist an der Wurzel 0,40 m
 * breit und laeuft auf 0,15 m aus. Drei Reihen mit 0,30 rad Seitenversatz
 * laegen bei 0,7 m Radius rund 0,21 m neben der Mitte — also ausserhalb der
 * Kralle, die man sieht.
 */
const KOLLIDER_REIHEN = 1;
/** Seitenversatz der aeusseren Reihen (rad Umfangswinkel). */
const KOLLIDER_ABSTAND = 0.30; // rad — Seitenversatz der aeusseren Kollider-Reihen

const SCHNAPP_AB = 0.93;
/**
 * Rechnet der Bodenanschlag gegen den GANZEN Schliessweg (true) oder gegen die
 * Momentanstellung der Schalen (false)? — E-046, 15.09.2026.
 *
 * Die eine Zeile zum Zurueckdrehen. Was daran haengt:
 *
 * Die geschlossene Kralle reicht 2,95 m tief, die offene nur 2,44 m
 * (`clawGeometry`, mit Zahnkegel). Wer gegen die Momentanstellung rechnet,
 * setzt die offene Spinne so tief ab, dass sie beim Zudruecken in den Beton
 * geraten wuerde — also hebt der Anschlag den Arm waehrend des Schliessens
 * nach. Gemessen (kopflos, Arm abgesetzt, dann zupacken): Die Spinne steigt
 * dabei um **0,548 m** und wandert 0,513 m zur Seite. Sie zieht sich in genau
 * den Bildern unter dem Teil weg, in denen sie zufassen soll.
 *
 * Mit `true` steht der Anschlag ueber den ganzen Weg fest: `CLAW_MAX_DEPTH`,
 * die groesste Tiefe, die ein gezeichneter Krallenpunkt in IRGENDEINER
 * Stellung erreicht. Der Preis ist bekannt und gewollt (Ansage Patrick
 * 15.09.2026): Die offene Spinne haengt beim Absetzen rund 0,56 m hoeher —
 * dafuer steht sie still, waehrend sie greift.
 */
const BODEN_UEBER_SCHLIESSWEG = true;
/** Bis hierher gilt eine Kralle als am Teil anliegend (m) */
const KONTAKT_NAH = 0.14;
/** So tief duerfen die Spitzen in Material beissen, bevor der Arm anhaelt (m) */
const EINDRING_OK = 0.18;
/** Erst ab dieser Masse gilt ein Teil als Brocken, der den Arm aufhaelt (kg) */
const EINDRING_SCHWER_KG = 350;
/** Totband des Bodenanschlags (m) — darunter wird nicht nachgeregelt */
const BODEN_TOLERANZ = 0.012;
/** So lange haelt die Abwaertssperre nach dem letzten Kontakt (s) */
const BODEN_SPERRE_S = 0.2;
/**
 * E-137: So weit (m) ueber der letzten Auflage ist die Spinne abgehoben, und
 * die Sperre faellt sofort. Dieselbe Grenze wie „liegt auf" (`resting`, 0,04)
 * im Bodenanschlag — darunter gilt sie als aufliegend, darueber als frei.
 */
const BODEN_FREI_M = 0.04;
/** So lange haelt eine einmal gefundene Sperre, statt neu zu regeln (s) */
const EINDRING_HALT_S = 0.35;
/**
 * E-152: So tief darf die Magnetscheibe in ein Teil sinken, bevor der Arm
 * anhaelt (m). SW: Kontaktabstand plus Einfedern. Ein Magnet beisst nicht —
 * er liegt auf. Vorher drueckte die kinematische Scheibe Teile unter 350 kg
 * durch den Boden (gemessen: 210-kg-Teil 0,20 m unter dem Beton).
 */
const MAGNET_AUFLAGE_M = 0.03;
/** E-152: Ab dieser Winkelaenderung (rad je Bild) gilt Heben/Ausfahren als versucht — Rechenrauschen darunter */
const UEBERLAST_TOT_RAD = 1e-6;
/** Wie weit die Schalen beim Anschlag zurueckfedern (rad) */
const ANSCHLAG_GRAD = THREE.MathUtils.degToRad(4.5);
/** Wie lange der Rueckprall nachschwingt (s) */
const ANSCHLAG_S = 0.22;

/** Um so viel traeger laeuft der Arm an, wenn er ganz im Material steckt */
const PFLUG_TRAEGHEIT = 1.5;
/** Zeitkonstante, mit der die Spitzenbeschleunigung fuers Pendel geglaettet wird (s) */
const ACC_GLAETTUNG_S = 0.09;
/**
 * Zusaetzliche Rueckstellung des Kardangelenks, als Vielfaches der
 * Schwerkraftrueckstellung. 1 halbiert den Ausschlag gegenueber einem frei
 * haengenden Pendel — deshalb stand hier bis zum 22.09.2026 eine 1.
 *
 * JETZT NULL: DER GREIFER HAENGT FREI (E-115, Ansage Patrick 22.09.2026,
 * „die spinne soll frei schwenken koennen"). Damit ist die seit dem
 * 17.09.2026 offene Frage aus E-105 entschieden — nicht auf einen Mittelwert,
 * sondern auf frei, weil genau das die Ansage war.
 *
 * GEMESSEN (`npx vite-node tools/wurf.ts`, 22.09.2026), Ausschlag der
 * Greiferachse gegen die Lotrechte:
 *
 *   |                          | 1.0 (vorher) | 0.0 (jetzt) |
 *   |--------------------------|--------------|-------------|
 *   | Antippen 1 s, leer       | 20,7° / 12,6°|24,1° / 16,1°|
 *   | Dauerschwenk 5 s, leer   | 20,3° /  7,8°|24,1° / 15,0°|
 *   | Dauerschwenk, 1800 kg    | 20,0° /  7,0°|24,4° / 13,7°|
 *   | Ruhe nach dem Stopp      | 1,38–1,98 s  | 2,38–2,55 s |
 *
 *   (erste Zahl: hoechster Ausschlag, zweite: Beharrung im Schwenk)
 *
 * WARUM DAS KEINE ABRISSBIRNE IST, und warum die 45-Grad-Rechnung im alten
 * Kommentar („frei haengend gut 27 Grad") nicht eingetreten ist: Der
 * Oberwagen dreht mit 33 Grad je Sekunde, nicht mit 45. Die Fliehkraft am
 * Korb reicht damit fuer 15 Grad Dauerschraeglage — das ist ein haengender
 * Greifer, kein Ausholen. Der Ueberschwinger beim Anfahren liegt bei 24 Grad
 * und ist nach zweieinhalb Sekunden weg.
 *
 * WAS DEN AUSSCHLAG JETZT NOCH BEGRENZT: nur `sin(Ausschlag)` in der
 * Schwerkraftrueckstellung und `PENDEL_DAEMPFUNG_*`. 30 s Dauerschwenk bleiben
 * damit unter 30 Grad — es gibt keinen Term, der mit dem Winkel waechst.
 * (Stand 22.09.; seit E-132 ist die Daempfung von 0,98 auf 0,4 gesenkt, die
 * Zahlen stehen bei `PENDEL_DAEMPFUNGSGRAD`.)
 *
 * DIE ZAHL BLEIBT ALS STELLSCHRAUBE STEHEN. Faellt das Nachpendeln auf dem
 * Geraet zu lang aus, ist der naechste Schritt 0,25 (Ausschlag dann rund
 * 22 Grad) — und nicht zurueck auf 1, denn der Wunsch nach „frei" bleibt.
 */
const GELENK_STEIFE = 0.0;
/**
 * Ab hier gilt der Greifer als schraeg haengend (rad).
 *
 * WOFUER ES DA IST: Ein gerechnetes Pendel steht nie exakt auf null. Es bleibt
 * immer ein Rest von Tausendstelgrad stehen. Ohne Totband waere
 * `neigung === 0` im laufenden Spiel nie wahr, die drei Vorabspruenge liefen
 * nie, und die Zusage „bei lotrechtem Greifer Ziffer fuer Ziffer wie vorher"
 * waere im Betrieb nie eingeloest.
 *
 * WARUM 0,5 GRAD. Was das Totband kostet, ist der Versatz, um den der
 * Messstrahl NICHT wandert: bei 0,5 Grad und 3,00 m Tiefe
 *     3,00 · sin 0,5° = 2,6 cm.
 * Der Strahl sucht damit den Boden 2,6 cm neben der wahren Korbmitte. Zum
 * Vergleich: Der Sensorradius der Sichelkralle ist 1,56 m, ein Muldenrand ist
 * 20 cm stark, und der Anschlag selbst arbeitet mit 12 mm Totband
 * (`BODEN_TOLERANZ`). Ein Unterschied, der erst bei einer Kante von unter
 * 3 cm Breite ueberhaupt messbar waere — und so eine Kante gibt es auf dem
 * Platz nicht.
 */
const NEIGUNG_TOTBAND = THREE.MathUtils.degToRad(0.5);

/**
 * Rechnet der BODENANSCHLAG mit der Schraeglage des Greifers?
 *
 * Nein — und das ist gemessen, nicht vergessen. Die Umstellung von der
 * Weltsenkrechten auf die Greiferachse (E-085) steckt vollstaendig in
 * `form.ausladung` / `form.maxAusladung` und ist bewacht; hier steht der
 * Schalter, der sie im Anschlag scharf stellt.
 *
 * WAS PASSIERT, WENN ER AUF `true` STEHT (gemessen am 17.09.2026):
 *
 *   - `maxAusladung` waechst mit der Schraeglage, und zwar mit dem HALBMESSER
 *     der tiefsten Schale, nicht mit dem Kosinus: 0,44 m · sin θ. Schon bei
 *     0,5 Grad sind das 3,8 mm, beim gewoehnlichen Pendelausschlag eines
 *     Schwenks (7,8 Grad) 5,1 cm (Sichelkralle) bzw. 7,3 cm
 *     (Fuenfschalengreifer).
 *   - Der Anschlag HEBT den Arm aktiv an, wenn die Spitzen zu tief stehen.
 *     Waehrend des Absenkens pendelt der Greifer immer ein paar Grad — der Arm
 *     wird also angehoben, waehrend man ihn senkt.
 *   - Und er bleibt oben: Sobald `bodenSperre` gegriffen hat, ist die
 *     Abwaertsrichtung gesperrt, solange Kontakt gemeldet wird. Gemessen mit
 *     `tools/bodenanschlag-hoehe.ts`: Der geschlossene Greifer stand danach
 *     auf **7,90 cm** statt 6,37 cm (Sichelkralle) und **21,21 cm** statt
 *     20,44 cm (Fuenfschalengreifer) — auch wenn man den Hebel bis zum Schluss
 *     unten haelt.
 *
 * Das ist eine Aenderung am Absetzen, und Absetzen ist das, was Patrick am
 * haeufigsten tut. Sie gehoert nicht als Nebenwirkung in ein Paket ueber das
 * Pendel, sondern in ein eigenes, mit eigener Abnahme — zusammen mit der
 * Frage, ob `bodenSperre` den Arm oben festhalten darf, nachdem der Grund
 * fuers Anheben weg ist.
 *
 * WAS DAGEGEN SCHON AN DER GREIFERACHSE HAENGT: der Messstrahl
 * (`surfaceUnderClaws`) und die Krallenlage (`syncMeshes`). Beide beantworten
 * „wo schaue ich hin", nicht „wie hoch halte ich an" — sie koennen den Arm
 * nicht anheben, und auf ebenem Beton aendern sie gar nichts.
 */
const ANSCHLAG_FOLGT_PENDEL = false;
/** Wirksame Pendellaenge Gelenk → Lastschwerpunkt (m). SW, seit dem Prototyp. */
const PENDEL_L = 1.5;
const PENDEL_G = 9.81;
/** Eigenkreisfrequenz des Pendels sqrt(g/L) = 2,56 rad/s (Schwingdauer 2,46 s). */
const PENDEL_OMEGA = Math.sqrt(PENDEL_G / PENDEL_L);
/**
 * Daempfungsgrad des Pendels (1 = kritisch: schwingt nie durch, 0 = ewig).
 *
 * BIS 16.10.2026 STANDEN HIER 5,0 / 4,0 je Sekunde — das ist ein
 * Daempfungsgrad von 5,0 / (2 · 2,56) = 0,98, also KRITISCH GEDAEMPFT. Ein
 * solches Pendel schwingt nie durch die Senkrechte; es kriecht in die Ruhelage
 * zurueck. Genau das war die Winkelbegrenzung, die Patrick nach E-105 und
 * E-115 weiter gespuert hat (16.10.2026: „die Winkelbegrenzung der Spinne
 * raus"): keine Sperre, sondern eine Bremse. Gemessen
 * (`npx vite-node tools/pendel-daempfung.ts`):
 *
 *   | Daempfungsgrad | Anfahren | Aufschaukeln* | Ruhe nach Stopp | v Korb |
 *   |----------------|----------|---------------|-----------------|--------|
 *   | 0,98 (vorher)  |  24,1°   |   42,8°       |  2,55 s         | 5,19   |
 *   | 0,5            |  35,5°   |   73,8°       |  2,93 s         | 5,80   |
 *   | **0,4**        |  39,3°   |   88,5°       |  4,00 s         | 6,06   |
 *   | 0,3            |  43,9°   |  106,2°       |  5,17 s         | 6,43   |
 *   | 0,2            |  49,6°   |  125,6°       |  8,53 s         | 6,97   |
 *   | 0,1            |  60,6°   |  161,6°       | 17,15 s         | 7,77   |
 *
 *   * 15 s im Takt der Eigenschwingung hin und her geschwenkt — der
 *     schlimmste Fall, den ein Spieler mit Absicht bauen kann.
 *
 * WARUM 0,4: das freieste Pendel, das sich auch mit Absicht nicht ueber die
 * Waagerechte schaukeln laesst (88,5° < 90°). Mit weniger Daempfung steht der
 * Korb beim Aufschaukeln ueber dem Gelenk — das sieht nach keinem haengenden
 * Greifer mehr aus, und der Freigang zum Stiel ist schon bei 30° in 22 von 62
 * Armstellungen weg (E-105, `tools/pendelfreigang.ts`). Ein Anschlag
 * ist es trotzdem nicht: Die Daempfung nimmt Energie aus der Bewegung, sie
 * setzt keine Wand an einen Winkel. Der Waechter dazu steht in
 * `test/wurfweite.test.ts`.
 *
 * Leer und unter Last: dasselbe Verhaeltnis 4/5 wie vorher (schwere Last
 * pendelt laenger nach, Prototyp 27.08.2026).
 */
const PENDEL_DAEMPFUNGSGRAD = 0.4;
/** Dämpfung des Pendels leer und bei Nennlast (1/s) */
const PENDEL_DAEMPFUNG_LEER = 2 * PENDEL_DAEMPFUNGSGRAD * PENDEL_OMEGA;
const PENDEL_DAEMPFUNG_LAST = 0.8 * PENDEL_DAEMPFUNG_LEER;
/*
 * KEINE WINKELSPERRE. Hier stand bis zum 17.09.2026 ein Deckel von 17 Grad je
 * Achse, und genau der ist auf Patricks Wort gefallen:
 *
 *   „Es ging eher drum, dass ein Greifer keine winkelsperre hat, soll auch
 *    nicht. Damit ueber das schwenken seitliche kraft erzeugt wird und teile
 *    geworfen werden koennen." (17.09.2026)
 *
 * Ein Greifer haengt frei am Kardangelenk. Wer den Oberwagen schwenkt, erzeugt
 * Fliehkraft, der Greifer schlaegt aus — und daraus wirft man Teile. Ein
 * Anschlag nimmt genau das weg: Er kappt die Spitze der Bewegung und macht
 * jeden Schwung ab 17 Grad gleich aussehend.
 *
 * WAS DEN AUSSCHLAG JETZT BEGRENZT, und warum das KEIN Anschlag ist:
 *
 *   - Die Rueckstellung `−(g/L)·(1+GELENK_STEIFE)·sin(Ausschlag)`. Sie waechst
 *     mit dem Ausschlag und haelt dem Antrieb irgendwann die Waage; wo das ist,
 *     haengt davon ab, wie schnell geschwenkt wird. Ein Anschlag stuende immer
 *     an derselben Stelle.
 *   - `PENDEL_DAEMPFUNG_*` — Reibung, kein Anschlag. Sie bremst die
 *     GESCHWINDIGKEIT, nicht den Winkel.
 *   - `CAP` in `integratePendulum` (15 m/s²) deckelt die ANTRIEBSGROESSE, nicht
 *     die Lage. Er sitzt dort seit dem 11.09.2026 gegen Zahlenrauschen aus der
 *     zweifachen Differenzenbildung und gegen Teleports (Tests, Spawns) — mit
 *     dem Ausschlag hat er nichts zu tun.
 *
 * GEMESSEN (`npx vite-node tools/pendelausschlag.ts`, 17.09.2026), voller
 * Oberwagenschwenk aus dem Stand:
 *
 *   |                        | vorher (17°-Deckel) | jetzt  |
 *   |------------------------|---------------------|--------|
 *   | hoechster Ausschlag    | 17,3°               | 20,2°  |
 *   | Beharrung im Schwenk   |  7,8°               |  7,8°  |
 *   | Ruhe nach dem Stopp    |  1,38 s             |  1,38 s|
 *
 * UND DAS IST DER EHRLICHE TEIL: Der Deckel hat nur die Spitze gekappt. Im
 * gleichmaessigen Schwenk stand der Greifer schon vorher auf 7,8 Grad und hat
 * den Anschlag nie beruehrt — angefasst hat er nur den Ueberschwinger beim
 * Anfahren und beim Stoppen.
 *
 * Was den Ausschlag damals wirklich klein hielt, war `GELENK_STEIFE` (siehe
 * oben): Sie verdoppelte die Rueckstellung und HALBIERTE damit den Ausschlag.
 * Der offene Punkt aus E-105 ist am 22.09.2026 entschieden — die Feder steht
 * auf 0, der Greifer haengt frei (E-115). Die Zahlen in der Tabelle oben sind
 * damit der Stand vom 17.09. und nicht mehr der von heute; die aktuellen
 * stehen bei `GELENK_STEIFE`.
 */


const CLOSE_TIME = 0.4; // s (SW)
const OPEN_TIME = 0.3; // s (SW)
/*
 * Anlauf- und Auslauframpe.
 *
 * War 0,38, wurde im Lauf des 11.09.2026 auf 0,5 erhoeht, um die Maschine
 * schwer wirken zu lassen. Zusammen mit einem halbierten Endtempo, weichen
 * Rampenecken und einem beissenden Pflugwiderstand wurde daraus aber zaeh
 * statt schwer ("die Mechanik ist im Verlauf schlechter geworden").
 *
 * Schwer heisst nicht langsam, sondern: sofort reagieren und dabei Masse
 * haben. Die Masse steckt im Pendel, im Pfluegen und im Auslauf — nicht
 * darin, dass der Hebel erst mal nichts tut. 0,3 s.
 */
const RAMP_TIME = 0.3;
/*
 * CAB_LIFT_MAX (2,60 m) steht seit E-040 in `kabinenhubParts.ts`: Dort hängt
 * die ganze Geometrie des Schwenkwerks daran, und zwei Kopien derselben Zahl
 * wären zwei Wahrheiten über dieselbe Sache.
 */
const CAB_LIFT_SPEED = 0.75; // m/s (SW)

export class Excavator {
  // Spielzustand
  // Standplatz mittig: Stahlhaufen links, Boxenreihe rechts, Presse hinten
  /**
  * Standplatz: vor der Presse, Blick nach Norden zu Janine (Ansage
  * 12.09.2026). Von hier liegt die Presse bei +180°, der Stahlcontainer bei
  * +93°, der Mischschrott bei −116°.
  */
  /*
   * So dicht an den Stahlcontainern, wie der Arm es zulaesst.
   *
   * Gewuenscht waren 20 bis 50 cm Luft (12.09.2026). Das geht nicht: Der Arm
   * hat einen Mindestradius von 4,0 m — naeher kommt die Krallenspitze gar
   * nicht auf den Boden. Bei 0,5 m Abstand stuende die Maschine am Container
   * und koennte ihn nicht befuellen. 4,0 m ist die Untergrenze, und genau
   * darauf steht sie jetzt.
   */
  /*
   * Der Standplatz kommt aus `world/baggerstand.ts`, nicht aus einer Zahl hier.
   *
   * Bis zum 14.09.2026 stand hier fest (−2,5 | −19,5). Als der Platz nach E-010
   * um (−0,5 | −22,5) herum neu gebaut wurde, blieb diese Zeile stehen — der
   * Bagger sass 3,6 m neben dem Platz, fuer den jede Entfernung der
   * Abnahmetabelle gerechnet war. Gefunden hat das nicht das Auge, sondern der
   * Bericht des Platzumbaus, der die Datei nicht anfassen durfte.
   */
  readonly position = new THREE.Vector3(BAGGER_STAND.x, 0, BAGGER_STAND.z);
  heading = 0; // rad, 0 = +Z
  cabYaw = 0;
  boomAngle = THREE.MathUtils.degToRad(35);
  stickAngle = THREE.MathUtils.degToRad(-70);
  rotatorYaw = 0;
  /**
   * Wie schraeg der Greifer haengt (rad, 0 = lotrecht) — der Winkel zwischen
   * seiner Achse und der Weltsenkrechten.
   *
   * ER KOMMT AUS DEM PENDEL, nicht aus einem Bedienelement. `integratePendulum`
   * schreibt ihn zusammen mit `pendelAchse` fort; `resolveGroundClamp`,
   * `surfaceUnderClaws` und `syncMeshes` lesen ihn.
   *
   * Warum das ueberhaupt jemanden angeht: `form.maxTiefe` ist eine Laenge
   * LAENGS DER GREIFERACHSE. Haengt der Greifer lotrecht, ist sie dasselbe wie
   * „so weit langt er nach unten"; haengt er schraeg, ist sie es nicht mehr.
   * Seit dem Pendel ohne Anschlag ist „schraeg" der Normalfall.
   *
   * An `neigung === 0` haengen drei Vorabspruenge. Sie sind die Zusage, dass
   * der lotrechte Greifer Ziffer fuer Ziffer dasselbe tut wie vor dem Umbau —
   * `test/greiferachse.test.ts` weist es nach.
   */
  neigung = 0;
  /**
   * Die Greiferachse als Einheitsvektor in Weltkoordinaten, nach UNTEN
   * zeigend.
   *
   * Lotrecht ist das (0, −1, 0). Der Fusspunkt der Achse in der Tiefe `t`
   * liegt bei `Gelenk + t · pendelAchse` — daraus holt sich `surfaceUnderClaws`
   * seinen Strahlansatz, ohne irgendwo einen Winkel und eine Himmelsrichtung
   * von Hand zusammenzurechnen.
   *
   * Es gilt `hypot(x, z) = sin(neigung)` und `−y = cos(neigung)`; beide
   * Groessen stammen aus derselben Drehung und koennen nicht auseinanderlaufen.
   */
  readonly pendelAchse = new THREE.Vector3(0, -1, 0);
  /** Drehgeschwindigkeit der Spinne (rad/s) — treibt das Herausreißen */
  private rotatorVel = 0;
  private lastRotatorYaw = 0;
  closure = 0; // 0 offen .. 1 zu
  closing = false;

  // gerampte Achsgeschwindigkeiten
  private driveVel = 0;
  private cabVel = 0;
  private boomVel = 0;
  private stickVel = 0;

  // Szene
  readonly root = new THREE.Group(); // Chassis (Ursprung am Boden)
  private cabGroup = new THREE.Group();
  private boomGroup = new THREE.Group();
  private stickGroup = new THREE.Group();
  private stickTip = new THREE.Object3D();
  readonly grappleGroup = new THREE.Group(); // top-level, hängt lotrecht
  /**
   * Die angehaengte Greiferform (E-057).
   *
   * Sie ist die einzige Stelle, an der der Bagger etwas ueber den Greifer
   * weiss: Schalenzahl, Anschlaege, Mittellinie, Korb, Sensorkugel. Vorgabe
   * ist seit E-155 der Fuenfschalengreifer (Patrick, 18.10.2026:
   * „sichelkralle aus spiel entfernen") — die Sichelkralle wird nie gebaut,
   * also auch nicht fuer ein Bild beim Start.
   */
  private form: Greiferform = FUENFSCHALEN;
  /** Das gebaute Modell der aktiven Form — Schalen drehen, Zylinder fuehren. */
  private greiferbau!: Greiferbau;
  /**
   * Alle bisher gebauten Greifer, nach Kennung.
   *
   * Beide haengen in der Szene, der inaktive unsichtbar (E-059). Three.js
   * ueberspringt unsichtbare Teilbaeume vollstaendig — Zeichenrufe kostet das
   * nicht. Gebaut wird der zweite erst beim ersten Wechsel: Der
   * Fuenfschalengreifer braucht dafuer rund 0,25 s (gemessen), und die soll
   * nicht jeder Spielstart zahlen, der ihn nie sieht. Danach ist das
   * Umschalten ein `visible`-Merker.
   */
  private greifer = new Map<GreiferId, Greiferbau>();
  private joyLeft!: THREE.Group;
  private joyRight!: THREE.Group;
  /** Arme des Fahrers nachführen, wenn die Hebel kippen (E-142). */
  private armeFolgen: () => void = () => {};
  private cabinEye = new THREE.Object3D();
  /** Hubschlitten der Fahrerkabine (Taste X) */
  private cabLiftGroup = new THREE.Group();
  /**
   * Die Lenkerwelle des Kabinenhubs (E-040). Sie dreht um die x-Achse durch
   * den Drehpunkt; an ihr hängen beide Lenker, der Hebel und damit der
   * Kopfanker des Kabinenhubzylinders.
   */
  private cabPivot = new THREE.Group();
  private cabLift = 0; // aktuelle Hubhöhe in m
  private cabLiftTarget = 0;
  // letzte Achseingaben (-1..1) für die Joystick-Animation in der Kabine
  private inCab = 0;
  private inBoom = 0;
  private inStick = 0;
  private inGrapple = 0;

  // Physik
  chassisBody!: RAPIER.RigidBody;
  grappleBody!: RAPIER.RigidBody;
  private clawColliders: RAPIER.Collider[] = [];
  private clawA = new THREE.Vector3();
  private clawB = new THREE.Vector3();
  private clawMid = new THREE.Vector3();
  private clawDir = new THREE.Vector3();
  private clawQuat = new THREE.Quaternion();
  /** Ausleger und Stiel bekommen eigene Kollider, damit der Kran nicht
   *  durch Schrott oder LKW hindurchtaucht (Design-Fix 2026-08-29) */
  private boomBody!: RAPIER.RigidBody;
  private stickBody!: RAPIER.RigidBody;
  private boomMesh!: THREE.Mesh;
  private stickMesh!: THREE.Mesh;

  /** Touch-Achsen (Tablet/Smartphone); null auf Desktop */
  touch: {
    cab: number;
    stick: number;
    boom: number;
    rotator: number;
    drive: number;
    steer: number;
    grab: boolean;
    grapple: number;
  } | null = null;
  /** gemerkter Spinnen-Zustand für die Stick-Steuerung (Stick neutral = halten) */
  private grappleHold = false;

  /** von außen gesetzt (GripSystem): getragene Masse → Achsen werden träger */
  carriedMassKg = 0;
  /** Anzahl der Teile im Greifer — bestimmt mit, wie weit die Spinne schließt */
  carriedCount = 0;

  /** Bodenkontakt der Zackenspitzen (Kap. 6.1: Boden ist immer harter Widerstand) */
  readonly groundContact = { active: false, intensity: 0, point: new THREE.Vector3() };

  /**
   * E-134: Senkgeschwindigkeit der Armspitze im letzten Schritt (m/s, nach
   * unten positiv), gemessen VOR dem Bodenanschlag — im Anschlagschritt also
   * das Tempo, mit dem sie ankam. Nur gelesen, nie geregelt.
   */
  spitzeAbwaerts = 0;
  private spitzeYAlt: number | null = null;
  private readonly aufschlag = new Aufschlagmelder();
  /**
   * E-134: Die Spinne schlaegt mit Last auf — auf tragenden Grund (Beton,
   * Ladeflaeche, Muldenboden) oder auf losen Schrott (`aufSchrott`). Gemeldet
   * wird nur der Einschlag, nicht das Aufliegen (`Aufschlagmelder`), und nur
   * mit Last: Die leere Spinne hat Zuschnappen und Kehren. Wie in
   * `onClawSnap`: Der Bagger kennt keinen Bus, main.ts macht das Ereignis.
   */
  onAufschlag: ((tempo: number, aufSchrott: boolean) => void) | null = null;
  /**
   * E-137: Die LEERE Spinne (offen oder zu) schlaegt auf — Haemmern. Einmal je
   * Schlag (`Aufschlagmelder`, dieselbe Regel wie E-134). `wucht` 0..1,
   * `handle` der beruehrte lose Koerper oder null fuer tragenden Grund,
   * `p` die Krallenspitze. Worauf genau (Wrack, Schrott, Beton, Stahl),
   * entscheidet main.ts — der Bagger kennt weder Platz noch Wracks.
   */
  onSpinneAufschlag: ((wucht: number, handle: number | null, p: THREE.Vector3) => void) | null = null;
  /**
   * E-137: Die leere Spinne drueckt auf etwas. Hoechstens alle
   * `DRUECK_PAUSE_S`, und nur, wenn sich etwas tut: beim Ansetzen auf ein
   * loses Teil einmal, danach nur, wenn die Spitze sinkt oder das Teil sich
   * bewegt. Auf Beton bleibt es still. `staerke` 0..1 = Senkbefehl.
   */
  onSpinneDruecken: ((staerke: number, handle: number | null, p: THREE.Vector3) => void) | null = null;
  private readonly spinnenSchlag = new Aufschlagmelder();
  /** Wie weit der Spieler gerade nach unten befiehlt (0..1), vor jeder Sperre */
  private senkBefehl = 0;
  private drueckt = false;
  private drueckPauseS = 0;
  private drueckRefY = 0;
  /** Worauf zuletzt gedrueckt wurde; `undefined` = noch nichts angesetzt */
  private drueckRefHandle: number | null | undefined = undefined;
  private readonly drueckRefPos = new THREE.Vector3();
  private readonly spinnenOrt = new THREE.Vector3();

  /**
   * Körper, in die der Arm nicht eintauchen darf (LKW). Sie sind kinematisch,
   * kollidieren also nicht von selbst mit dem ebenfalls kinematischen Arm —
   * deshalb wird die Achsbewegung bei Überlappung zurückgenommen.
   */
  obstacleBodies: Set<number> = new Set();
  /** Die eigenen Koerper des Baggers — ein Zielstrahl darf sie nicht treffen. */
  readonly selfHandles: Set<number> = new Set();
  /** true, solange der Arm gegen ein Fahrzeug drückt (fürs HUD/Audio) */
  armBlocked = false;
  /**
   * Das Greifsystem, dessen Teile die Spinne traegt (E-145) — verbunden in
   * `setzeGreifer`. Ohne es gibt es keine Wandsperre fuer gehaltene Teile.
   */
  greifsystem: GripSystem | null = null;
  /**
   * E-152: Ueberlast. `ueberlast` steht, solange die gehaltene Last schwerer
   * ist, als die Traglasttabelle bei dieser Ausladung erlaubt (fuers HUD).
   * `onUeberlast` meldet einmal je Versuch, eine gesperrte Bewegung zu fahren
   * — main legt es auf den Bus (`greifer:ueberlast`).
   */
  ueberlast = false;
  onUeberlast: ((e: GameEvents["greifer:ueberlast"]) => void) | null = null;
  private ueberlastGemeldet = false;
  /** E-146: Ist der Lasthebemagnet eingeschaltet? */
  magnetAn = false;
  /** E-146: Magnet ein- bzw. ausgeschaltet — main legt es auf den Bus (`magnet:an`, `magnet:aus`). */
  onMagnetAn: (() => void) | null = null;
  onMagnetAus: (() => void) | null = null;
  /** true, solange ein gehaltenes Teil an einer Wand ansteht (E-145) */
  lastAnWand = false;
  /** Rotator-Stellung, die zuletzt angenommen wurde — das Mausrad dreht zwischen den Schritten (E-145) */
  private rotatorOk = 0;
  /** Stand vor der Bewegung dieses Schritts, zum Zuruecknehmen (E-145) */
  private halt = {
    gPos: new THREE.Vector3(),
    gQuat: new THREE.Quaternion(),
    swing: new THREE.Vector2(),
    qPendel: new THREE.Quaternion(),
    neigung: 0,
    achse: new THREE.Vector3(),
    wheelSpin: 0,
  };

  // Pendel der Spinne am Kardan-Gelenk (x: Kippen um Welt-X, y: um Welt-Z)
  private swing = new THREE.Vector2();
  private swingVel = new THREE.Vector2();
  /** Geglaettete Beschleunigung der Stielspitze (m/s²) */
  private tipAcc = new THREE.Vector2();
  private prevTip = new THREE.Vector3();
  private prevTipVel = new THREE.Vector3();
  private pendulumInit = false;

  private hydraulics: Array<{
    a: THREE.Object3D;
    b: THREE.Object3D;
    barrel: THREE.Mesh;
    rod: THREE.Mesh;
    barrelLen: number;
  }> = [];

  private world!: RAPIER.World;

  constructor(scene: THREE.Scene, world: RAPIER.World) {
    this.world = world;
    this.buildMeshes();
    scene.add(this.root);
    scene.add(this.grappleGroup);
    this.buildHydraulics(scene);
    this.buildBodies(world);
    this.syncMeshes();
  }

  /**
   * Sichtbare Hydraulik: Hubzylinder Oberwagen→Ausleger (2×), Stielzylinder auf
   * dem Ausleger, zwei Kabinenhubzylinder, dazu das Schlauchpaket am Arm.
   *
   * SEIT DEM 15.09.2026 (E-029, Paket 5 aus E-025) ist ein Zylinder ein
   * Zylinder: Rohr und Kolbenstange behalten ihre Länge, die Stange taucht ins
   * Rohr ein. Vorher wurde die Stange zwischen den Ankern GEDEHNT — am
   * Hubzylinder von 0,97 auf 2,21 m, also um 128 %. Der Aufbau steht Teil für
   * Teil in `zylinderParts.ts`.
   */
  private buildHydraulics(scene: THREE.Scene): void {
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x2b2e31, roughness: 0.6 });
    const rodMat = new THREE.MeshStandardMaterial({ color: 0xb8bec4, roughness: 0.25, metalness: 0.8 });
    /** Die beiden Anker eines Zylinders anlegen — Fuß am einen Teil, Kopf am anderen. */
    const anker = (
      name: string,
      parentA: THREE.Object3D,
      la: [number, number, number],
      parentB: THREE.Object3D,
      lb: [number, number, number]
    ): { a: THREE.Object3D; b: THREE.Object3D } => {
      const a = new THREE.Object3D();
      a.position.set(...la);
      a.name = `${name}_FUSS`;
      parentA.add(a);
      const b = new THREE.Object3D();
      b.position.set(...lb);
      b.name = `${name}_KOPF`;
      parentB.add(b);
      return { a, b };
    };

    /**
     * Ein echter Zylinder: Rohr und Stange mit FESTER Länge.
     *
     * `kurz` und `lang` sind die gemessenen Ankerabstände über den ganzen
     * Bewegungsbereich (`npx vite-node tools/zylinderhub.ts`, 14.09.2026).
     * Aus ihnen folgt alles Weitere in `zylinderParts.ts`.
     */
    const addCyl = (
      name: string,
      parentA: THREE.Object3D,
      la: [number, number, number],
      parentB: THREE.Object3D,
      lb: [number, number, number],
      masse: ZylinderMasse
    ): void => {
      const { a, b } = anker(name, parentA, la, parentB, lb);
      const form = baueZylinder(masse);
      const barrel = new THREE.Mesh(form.rohr, barrelMat);
      const rod = new THREE.Mesh(form.stange, rodMat);
      barrel.castShadow = true;
      barrel.name = `${name}_ROHR`;
      rod.name = `${name}_STANGE`;
      scene.add(barrel);
      scene.add(rod);
      this.hydraulics.push({ a, b, barrel, rod, barrelLen: form.auge + form.rohrLaenge });
    };

    // Hubzylinder des Auslegers: sitzen tief am Oberwagen-Deck links und rechts
    // neben dem Auslegerfuß (nicht an der Kabine) und greifen nach oben an den
    // Ausleger — so sieht es an echten Umschlagbaggern aus.
    // Gemessen: Ankerabstand 2,518 … 3,757 m (Hub 1,239 m, Verhältnis 1,49).
    const HUB_MASS: ZylinderMasse = { kurz: 2.518, lang: 3.757, rRohr: 0.1 };
    addCyl("07_ZYLINDER_HUB_R", this.cabGroup, HUB_FUSS_R, this.boomGroup, HUB_KOPF_R, HUB_MASS);
    addCyl("07_ZYLINDER_HUB_L", this.cabGroup, HUB_FUSS_L, this.boomGroup, HUB_KOPF_L, HUB_MASS);
    /*
     * Kabinenhub (E-040): EIN Zylinder statt zwei — er drückt nicht mehr die
     * Kabine, sondern einen Hebel auf der Lenkerwelle. Dadurch fällt das
     * unmögliche Hubverhältnis von 5,18 : 1 auf 1,47 : 1, und der Zylinder
     * darf endlich einer sein. Rechnung in `kabinenhubParts.ts`.
     */
    addCyl(
      "06_ZYLINDER_KABINE",
      this.cabGroup,
      [CAB_ZYL_FUSS.x, CAB_ZYL_FUSS.y, CAB_ZYL_FUSS.z],
      this.cabPivot,
      CAB_ZYL_KOPF,
      CAB_ZYL_MASSE
    );
    // Stielzylinder: Ausleger-Oberseite → Stiel-Anlenkung
    // Gemessen: Ankerabstand 1,809 … 2,235 m (Hub 0,426 m, Verhältnis 1,24).
    addCyl("07_ZYLINDER_STIEL", this.boomGroup, STIEL_ZYL_FUSS, this.stickGroup, STIEL_ZYL_KOPF, {
      kurz: 1.809,
      lang: 2.235,
      rRohr: 0.08,
    });

    /*
     * Schlauchpaket: EIN Netz auf dem Ausleger (zwei Schläuche plus vier
     * Klemmschellen), EIN Netz auf dem Stiel (Schlauch plus zwei Schellen).
     * Vorher waren es drei Netze ohne Schellen, die frei über dem Kasten
     * schwebten.
     */
    const hoseMat = new THREE.MeshStandardMaterial({ color: 0x1c1e20, roughness: 0.9 });
    const hose = new THREE.Mesh(auslegerSchlauch(BOOM_LEN), hoseMat);
    hose.name = "07_SCHLAUCH_AUSLEGER";
    this.boomGroup.add(hose);
    const stickHose = new THREE.Mesh(stielSchlauch(), hoseMat);
    stickHose.name = "07_SCHLAUCH_STIEL";
    this.stickGroup.add(stickHose);
  }

  private armPos = new THREE.Vector3();
  private armQuat = new THREE.Quaternion();
  private tmpPrevPos = new THREE.Vector3();
  private armShapes: ArmShape[] = [];

  /**
   * Geglätteter Widerstand des Materials, durch das die Spinne pflügt.
   * Ohne Glättung ruckelt die Bewegung, weil die verdrängte Masse von Bild
   * zu Bild springt.
   */
  private plowFactor = 1;

  /** Handles der gerade gegriffenen Körper — die blockieren die Spinne nicht. */
  grippedHandles = new Set<number>();
  /** Faktor aus dem Baggerausbau — von main gesetzt (1 = ohne Ausbau) */
  getSpeedBonus: (() => number) | null = null;

  /** Position des Platzwarts — von main gesetzt, damit der Arm ihn verschont */
  getStaffPos: (() => THREE.Vector3 | null) | null = null;
  /** Prüfung von Fahrwerk, Arm und Spinne gegen alles Festinstallierte */
  private collision!: ExcavatorCollision;

  // Rechenpuffer für die Hydraulik-Zylinder
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpDir = new THREE.Vector3();
  private static UP = new THREE.Vector3(0, 1, 0);

  private updateHydraulics(): void {
    // Weltmatrizen frisch berechnen — sonst sitzen die Zylinder auf den
    // Posen des letzten Frames
    this.root.updateWorldMatrix(true, true);
    this.grappleGroup.updateWorldMatrix(true, true);
    for (const h of this.hydraulics) {
      h.a.getWorldPosition(this.tmpA);
      h.b.getWorldPosition(this.tmpB);
      this.tmpDir.copy(this.tmpB).sub(this.tmpA);
      this.tmpDir.normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(Excavator.UP, this.tmpDir);
      /*
       * Beide Netze sind um IHREN Anker herum gebaut (Rohr um den Fuß nach
       * +Y, Stange um den Kopf nach −Y). Es bleibt nichts zu tun, als jedem
       * seinen Ankerpunkt und dieselbe Drehung zu geben.
       *
       * KEIN `scale` — und seit E-040 gibt es dafür auch keine Ausnahme mehr.
       * Der Kabinenhub war die letzte; er ist jetzt ein Schwenkwerk mit
       * Hebel, und `test/zylinder.test.ts` prüft ihn wie jeden anderen.
       */
      h.barrel.position.copy(this.tmpA);
      h.barrel.quaternion.copy(q);
      h.rod.position.copy(this.tmpB);
      h.rod.quaternion.copy(q);
    }
  }

  // ---------- Aufbau ----------

  private buildMeshes(): void {
    // Firmenfarbe PRIPADA: helles Umschlagbagger-Grün (Art Direction Kap. 16)
    const machineBlue = new THREE.MeshStandardMaterial({ color: 0x5bbf46, roughness: 0.55 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b2e31, roughness: 0.8 });
    // Greifer-Farbgebung nach Vorbild: dunkle Hardox-Schalen, fast schwarze Kanten
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fc4d8, roughness: 0.2 });

    /*
     * UNTERWAGEN (Paket 2 aus E-025, Frage 1 von Patrick bejaht).
     *
     * Bis zum 15.09.2026 war das EIN Quader 2,40 × 0,90 × 4,40 bei y 1,15 —
     * und in ihm steckten die obersten 54 cm jedes Rades. Jetzt: schmaler
     * Mittelträger, Seitenwangen ab der Radoberkante (1,24 m), sichtbare
     * Achsbrücken darunter, Kotflügel darüber. Teil für Teil in
     * `unterwagenParts.ts`; der Drehkranzring liegt jetzt im Stahl-Netz.
     *
     * Der KOLLIDER bleibt unverändert (Quader 2,4 × 1,5 × 4,4, Mitte y 1,15).
     * Er war noch nie deckungsgleich mit dem sichtbaren Kasten.
     */
    const chassis = new THREE.Mesh(unterwagenLack(), machineBlue);
    chassis.castShadow = true;
    chassis.name = "01_UNTERWAGEN_LACK";
    this.root.add(chassis);
    const chassisStahl = new THREE.Mesh(unterwagenStahl(), dark);
    chassisStahl.castShadow = true;
    chassisStahl.name = "01_UNTERWAGEN_STAHL";
    this.root.add(chassisStahl);
    /*
     * Räder: Reifen, Felge, Nabe — drei Bauteile je Rad statt eines Zylinders
     * mit 20 Ecken. Die Form steht in `wheelParts.ts`, samt Begründung für
     * jedes Maß und für die Budgetregel, aus der die Bauweise folgt.
     *
     * Hier bleibt nur, was der Bagger davon wissen muss: wo die Räder sitzen
     * und welche Seite außen ist. Die Geometrie wird EINMAL gebaut und von
     * allen vier Rädern geteilt; nur die Drehung unterscheidet links von
     * rechts, damit Felgenscheibe und Nabenkappe nach außen zeigen.
     *
     * NEU AM 15.09.2026, und es kostet kein einziges Netz: Die Räder DREHEN
     * sich beim Fahren, und die vorderen LENKEN mit. Vorher rutschte die
     * Maschine bei 3,2 m/s auf vier stillstehenden Klötzen über den Platz —
     * im ganzen Quelltext gab es keine Zeile, die je eine Radgruppe drehte.
     *
     * Die Drehreihenfolge `YXZ` ist dafür der ganze Trick: Three rechnet dann
     * R = RY · RX · RZ. RZ stellt das Rad auf seine Seite (wie bisher), RX
     * dreht es um die Achse (das Rollen), RY schwenkt den Achsschenkel (das
     * Lenken). In der voreingestellten Reihenfolge XYZ säße das Lenken INNEN
     * und drehte das Rad um seine eigene Achse statt um die Hochachse.
     */
    const radGeo = radGeometrien();
    const radSt = radStoffe(machineBlue);
    for (const [x, z, ecke] of RAD_ECKEN) {
      const rad = baueRad(radGeo, radSt, ecke, x > 0);
      rad.position.set(x, RAD_R, z);
      rad.rotation.order = "YXZ";
      this.root.add(rad);
      this.wheelGroups.push({ gruppe: rad, vorn: z > 0, seite: x > 0 ? 1 : -1 });
    }

    // Oberwagen: verglaste Hochkabine + Gegengewicht
    this.cabGroup.position.set(0, 1.6, 0);
    this.cabGroup.name = "05_OBERWAGEN";
    this.root.add(this.cabGroup);
    /*
     * OBERWAGEN (Paket 3 aus E-025, Frage 2 von Patrick bejaht).
     *
     * Vorher: 10 Netze für 120 Dreiecke — Motorhaube 12, Gegengewicht 12, acht
     * Lüftungsschlitze à 12. Jetzt drei Netze für 29 Teile, mit gestufter
     * Haube, Wartungsklappe, umlaufendem Geländer, Auspuff, Laufblech,
     * Hydrauliktank und Leuchten. Teil für Teil in `oberwagenParts.ts`.
     *
     * Das Stahl-Netz heißt weiter `04_DREHKRANZ`: Darin steckt der
     * Drehkranzdeckel, und die Deckplatte des Oberwagens gehört dazu.
     */
    /*
     * Die Achse des AUSLEGERBOCKS (E-050) kommt aus `BOOM_PIVOT` selbst, nur
     * in den Frame des Oberwagens umgerechnet (dessen Ursprung liegt auf
     * y 1,60). So gibt es keine zweite Zahl für den Drehpunkt, die davonlaufen
     * könnte: Wer BOOM_PIVOT ändert, verschiebt den Bock mit.
     */
    const deck = new THREE.Mesh(
      oberwagenStahl([HUB_FUSS_R, HUB_FUSS_L], { y: BOOM_PIVOT.y - 1.6, z: BOOM_PIVOT.z }),
      dark
    );
    deck.castShadow = true;
    deck.name = "04_DREHKRANZ";
    this.cabGroup.add(deck);
    this.buildCabin(machineBlue, dark, glass);
    const haube = new THREE.Mesh(oberwagenLack(), machineBlue);
    haube.castShadow = true;
    haube.name = "05_MOTORHAUBE";
    this.cabGroup.add(haube);
    const heckLicht = new THREE.Mesh(
      oberwagenLeuchten(),
      new THREE.MeshStandardMaterial({
        color: 0xfff3d0,
        emissive: 0xffe9a8,
        emissiveIntensity: 0.55, // SW: etwas schwächer als am Ausleger
        roughness: 0.3,
      })
    );
    heckLicht.name = "05_LEUCHTEN";
    this.cabGroup.add(heckLicht);
    this.buildOutriggers(machineBlue, dark);

    // Ausleger
    this.boomGroup.position.copy(BOOM_PIVOT).sub(new THREE.Vector3(0, 1.6, 0)); // relativ zum Oberwagen
    this.boomGroup.name = "07_AUSLEGER";
    this.cabGroup.add(this.boomGroup);
    /*
     * Ausleger: verjüngter Kastenträger statt eines Quaders mit 12 Dreiecken.
     * Teil für Teil in `armParts.ts` (Paket 6 aus E-025).
     *
     * Das Lack-Netz bleibt bei `z = BOOM_LEN / 2` — an IHM hängt der
     * Arm-Kollider (`armShapes`, `syncMeshes`). Reichweite, Drehpunkt und
     * Kollider-Halbmaße sind unverändert.
     */
    const boom = new THREE.Mesh(auslegerLack(BOOM_LEN), machineBlue);
    boom.position.z = BOOM_LEN / 2;
    boom.castShadow = true;
    boom.name = "07_AUSLEGER_KASTEN";
    this.boomGroup.add(boom);
    this.boomMesh = boom;
    const boomStahl = new THREE.Mesh(
      auslegerStahl(
        BOOM_LEN,
        { y: STIEL_ZYL_FUSS[1], z: STIEL_ZYL_FUSS[2] },
        { x: HUB_KOPF_L[0], y: HUB_KOPF_L[1], z: HUB_KOPF_L[2] }
      ),
      dark
    );
    boomStahl.name = "07_AUSLEGER_STAHL";
    this.boomGroup.add(boomStahl);
    /*
     * Arbeitsscheinwerfer am Auslegerfuß. Der Kipper hat Scheinwerfer,
     * Rückleuchten und Dachleuchten — der Bagger hatte kein einziges Licht.
     * Eigenes Material, weil es als einziges am Arm selbst leuchtet.
     */
    const leuchtMat = new THREE.MeshStandardMaterial({
      color: 0xfff3d0,
      emissive: 0xffe9a8,
      emissiveIntensity: 0.65, // SW: sichtbar, ohne die Nachtstimmung zu kippen
      roughness: 0.3,
    });
    const leuchten = new THREE.Mesh(auslegerLeuchten(), leuchtMat);
    leuchten.name = "07_AUSLEGER_LEUCHTEN";
    this.boomGroup.add(leuchten);
    this.buildBoomLogo();

    // Stiel
    this.stickGroup.position.z = BOOM_LEN;
    this.stickGroup.name = "07_STIEL";
    this.boomGroup.add(this.stickGroup);
    const stick = new THREE.Mesh(stielLack(STICK_LEN), machineBlue);
    stick.position.z = STICK_LEN / 2;
    stick.castShadow = true;
    stick.name = "07_STIEL_KASTEN";
    this.stickGroup.add(stick);
    this.stickMesh = stick;
    this.stickTip.position.z = STICK_LEN;
    this.stickTip.name = "07_STIELSPITZE";
    this.stickGroup.add(this.stickTip);

    /*
     * STAHL AM STIEL — Fußlaschen, Lagerbock des Stielzylinders und die
     * BEFESTIGUNG DES GREIFERS (Ansage 13.09.2026: „Greifer braucht
     * Befestigung am Ausleger").
     *
     * Der Gusskopf, die beiden Laschen, der Bolzen und die zwei
     * Sicherungsscheiben sind Teil für Teil erhalten geblieben — sie stehen
     * jetzt in `armParts.ts` unter `stielStahl()` statt hier als acht einzelne
     * Meshes. Im Szenengraph ist daraus EIN Netz geworden; auffindbar bleiben
     * sie über die benannten Funktionen im Quelltext (E-025, „der Preis des
     * Verschmelzens").
     *
     * Der Halter haengt im Stielframe und kippt deshalb mit dem Stiel mit —
     * genau wie beim Vorbild, wo darunter das Pendelgelenk sitzt. Er
     * gehoert zum Stiel, nicht zur Spinne, und haengt an keiner ihrer Formen.
     */
    const stickStahl = new THREE.Mesh(
      stielStahl(STICK_LEN, { y: STIEL_ZYL_KOPF[1], z: STIEL_ZYL_KOPF[2] }),
      dark
    );
    stickStahl.castShadow = true;
    stickStahl.name = "07_STIEL_STAHL";
    this.stickGroup.add(stickStahl);

    // Kardan-Aufhängung: zwei ineinandergreifende Gelenkgabeln (90° verdreht)
    // zwischen Stielspitze und Spinne — statt eines schlichten Zylinders.
    const buildYoke = (y: number, alongX: boolean): void => {
      const yoke = new THREE.Group();
      yoke.position.y = y;
      if (!alongX) yoke.rotation.y = Math.PI / 2;
      for (const side of [-1, 1]) {
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.16), dark);
        plate.position.set(side * 0.1, -0.09, 0);
        plate.castShadow = true;
        yoke.add(plate);
      }
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 10), dark);
      pin.rotation.z = Math.PI / 2;
      pin.position.y = -0.16;
      yoke.add(pin);
      this.grappleGroup.add(yoke);
    };
    const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 10), dark);
    stub.position.y = -0.05;
    this.grappleGroup.add(stub);
    buildYoke(-0.1, true); // obere Gabel: Bolzen quer
    buildYoke(-0.3, false); // untere Gabel: 90° verdreht — greift in die obere
    /*
     * Die Spinne steht Bauteil fuer Bauteil in `grappleParts.ts`.
     *
     * Hier stand sie als ein Block von 270 Zeilen mitten im Baggermodell. Das
     * war der eigentliche Grund, warum die Formarbeit am 12.09.2026 fuenfmal
     * hintereinander danebenging: Es liess sich nie ein Teil allein aendern
     * und nie zuordnen, welche Aenderung was bewirkt hat (Ansage: „baue
     * erstmal die einzelnen Bauteile").
     */
    this.greiferbau = this.form.baue();
    this.greifer.set(this.form.id, this.greiferbau);
    this.grappleGroup.add(this.greiferbau.gruppe);
  }

  /** Welcher Greifer haengt gerade? */
  get greiferform(): Greiferform {
    return this.form;
  }

  /**
   * Darf der Greifer jetzt gewechselt werden?
   *
   * Nur mit leerer, ganz offener Spinne (E-059). Der Grund ist gemessen, nicht
   * vorsichtshalber: Die gefassten Teile ueberleben den Wechsel technisch,
   * aber die Schalen stehen danach woanders — das Teil haengt sichtbar frei in
   * der Luft. Genau das „Schweben" ist am 11.09.2026 abgestellt worden. Und
   * „beim Wechseln loslassen" wuerfe bis zu 3,5 t aus beliebiger Armhoehe ab
   * (v2 E-018: „Teile fliegen umher").
   *
   * `carriedCount` setzt main aus dem Greifsystem; es ist dieselbe Zahl, die
   * im HUD steht.
   */
  get greiferWechselBereit(): boolean {
    if (this.carriedCount > 0) return false;
    if (this.closure > 0.02) return false;
    for (const w of this.clawSplayIst) {
      if (w < this.form.offen - 0.02) return false;
    }
    return true;
  }

  /**
   * Greifer wechseln. Liefert false, wenn gerade etwas haengt oder die Spinne
   * nicht offen ist — dann bleibt alles, wie es ist.
   *
   * Was dabei neu entsteht: das Modell (einmal je Form), die Krallen-Kollider
   * (Zahl und Radius kommen von der Form) und die Stellung der Schalen. Die
   * Sensorkugel haengt am Greifsystem und wird von dort gesetzt
   * (`GripSystem.setForm`) — der Bagger kennt sie nicht.
   */
  setGreifer(form: Greiferform): boolean {
    if (form.id === this.form.id) return true;
    if (!this.greiferWechselBereit) return false;
    let bau = this.greifer.get(form.id);
    if (!bau) {
      bau = form.baue();
      this.greifer.set(form.id, bau);
      this.grappleGroup.add(bau.gruppe);
    }
    this.greiferbau.gruppe.visible = false;
    bau.gruppe.visible = true;
    this.form = form;
    this.greiferbau = bau;
    /*
     * Die Stellung geht auf „ganz offen" der NEUEN Form — die Anschlaege sind
     * andere (Sichelkralle 0,5495 … 1,555, Fuenfschalen 0 … 1,6799). Wer die
     * alten Winkel stehen liesse, haette Schalen, die 30 Grad zu weit zu
     * stehen.
     */
    this.closure = 0;
    this.clawSplayIst = new Array(form.schalen).fill(form.offen);
    this.clawReserve = new Array(form.schalen).fill(form.nachdrueckReserve);
    this.clawArt = new Array(form.schalen).fill(0);
    this.baueKrallenKollider();
    this.updateClawColliders();
    for (let i = 0; i < form.schalen; i++) this.greiferbau.setWinkel(i, form.offen);
    this.greiferbau.nachfuehren();
    return true;
  }

  /**
   * Verglaste Hochkabine mit Innenausbau (Kabinensicht, Briefing Kap. 5.2):
   * Rahmen + Glasflächen, Sitz, zwei Konsolen mit ISO-Joysticks, die die
   * Achseingaben live mitbewegen. Kabinenzentrum lokal (-0.6, *, 0.6).
   */
  /** Alles am Fahrer außer Unterarmen/Händen — in der Ego-Sicht unsichtbar */
  private driverBody: THREE.Object3D[] = [];

  /**
   * Ego-Perspektive: In der Kabinenansicht sieht der Fahrer nur seine eigenen
   * Unterarme an den Joysticks, sonst nichts von sich selbst.
   */
  setFirstPerson(active: boolean): void {
    for (const o of this.driverBody) o.visible = !active;
  }
  /**
   * Die vier Radgruppen — sie rollen beim Fahren, die vorderen lenken mit.
   *
   * Bis zum 15.09.2026 gab es diese Liste nicht, und im ganzen Quelltext auch
   * keine Zeile, die je ein Rad gedreht hätte: Bei 3,2 m/s rutschte die
   * Maschine auf vier stillstehenden Klötzen über den Platz (E-025, Befund 1).
   */
  private wheelGroups: Array<{ gruppe: THREE.Group; vorn: boolean; seite: number }> = [];
  /** Aufgelaufener Rollwinkel der Räder (rad) = Fahrstrecke / Radhalbmesser. */
  private wheelSpin = 0;
  /** Lenkeinschlag der Vorderräder (rad), geglättet gegen `LENK_MAX`. */
  private steerAngle = 0;

  /** Abstützpratzen: eingefahren (0) bis ausgefahren (1), Taste O */
  private outriggerGroups: THREE.Group[] = [];
  /*
   * Eingefahren beim Start (Ansage 12.09.2026: „die Stützen sollen immer oben
   * sein, damit man grade am Anfang des Spiels direkt losfahren kann"). Auf
   * ausgefahrenen Stützen ist das Fahren gesperrt — wer neu anfängt, drückte
   * sonst auf Gas und verstand nicht, warum nichts passiert.
   */
  private outriggerDown = 0;
  private outriggerTarget = 0;
  /** true, solange der Spieler auf Stützen zu fahren versucht (für HUD/Ton) */
  blockedByOutriggers = false;
  /** Aufbockhöhe: so weit hebt sich die Maschine auf den Stützen (m) */
  static readonly JACK_UP_M = 0.34;
  /** Räumschild: 0 = angehoben, 1 = am Boden */
  private bladeDown = 0;
  private bladeTarget = 0;
  private bladeGroup!: THREE.Group;
  private bladeBody!: RAPIER.RigidBody;
  private tmpQuat = new THREE.Quaternion();

  /** Schild heben/senken (Taste G bzw. Knopf). */
  toggleBlade(): boolean {
    this.bladeTarget = this.bladeTarget > 0.5 ? 0 : 1;
    return this.bladeTarget > 0.5;
  }

  get bladeIsDown(): boolean {
    return this.bladeDown > 0.5;
  }

  private buildCabin(
    frameMat: THREE.MeshStandardMaterial,
    _darkMat: THREE.MeshStandardMaterial,
    glassBase: THREE.MeshStandardMaterial
  ): void {
    // Kabine deutlich weiter nach links gesetzt, damit der Ausleger nicht ins
    // Blickfeld ragt (Design-Fix 2026-08-29)
    const cx = -1.05;
    const cz = 0.6;
    /*
     * DAS KABINENHUBWERK (E-040, Paket 8 und letztes aus E-025).
     *
     * Vorher: zwei „Lenker", deren Ankerabstand von 0,65 auf 3,14 m gedehnt
     * wurde, und zwei Zylinder, deren Rohr länger war als der Spalt, in dem
     * sie standen. Jetzt: ein Mast hinter der Kabine mit einer Welle, zwei
     * Lenkern von 1,88 m und einem Hebel, an dem EIN echter Zylinder zieht.
     *
     * Der Mast steht fest am Oberwagen, die Lenkergruppe dreht darin. Teil
     * für Teil in `kabinenhubParts.ts`; dort steht auch, warum der Drehpunkt
     * genau bei y 2,213 | z −0,894 liegen MUSS und nirgends sonst.
     */
    const mast = new THREE.Mesh(kabinenmast(), frameMat);
    mast.castShadow = true;
    mast.name = "06_KABINENMAST";
    this.cabGroup.add(mast);

    this.cabPivot.position.set(0, HUB_DREHPUNKT.y, HUB_DREHPUNKT.z);
    this.cabPivot.name = "06_KABINENHUBWERK";
    this.cabGroup.add(this.cabPivot);
    const lenker = new THREE.Mesh(kabinenlenker(), frameMat);
    lenker.castShadow = true;
    lenker.name = "06_KABINENLENKER";
    this.cabPivot.add(lenker);
    // Alles Weitere sitzt im Hubschlitten und fährt mit der Kabine hoch
    this.cabLiftGroup.name = "06_KABINE";
    this.cabGroup.add(this.cabLiftGroup);
    const glass = new THREE.MeshStandardMaterial({
      color: glassBase.color,
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
    });

    /*
     * KABINE (Paket 7 aus E-025). Fünf Netze statt 25, Teil für Teil in
     * `kabinenParts.ts`.
     *
     * KEIN MASS WANDERT. Dach, Säulen, Scheiben, Sitz, Konsolen und Display
     * liegen, wo sie lagen — die Kabinenansicht ist Patricks Arbeitsplatz beim
     * Sortieren. Neu sind nur Anbauteile, die der Kipper längst hat: Tür mit
     * Rahmen, Scharnieren und Griff, Trittstufe, zwei Außenspiegel,
     * Scheibenwischer, Sonnenblende, Regenrinne, zwei Armlehnen, Gurt.
     */
    const kabineBlech = new THREE.Mesh(kabineLack(cx, cz), frameMat);
    kabineBlech.castShadow = true;
    kabineBlech.name = "06_KABINE_LACK";
    this.cabLiftGroup.add(kabineBlech);
    const kabineStahlMesh = new THREE.Mesh(kabineStahl(cx, cz), farbstoff(0.7, 0.2));
    kabineStahlMesh.name = "06_KABINE_STAHL";
    this.cabLiftGroup.add(kabineStahlMesh);
    /*
     * Alle sechs Scheiben in EINEM Netz. `side: DoubleSide` bleibt: Der Fahrer
     * sitzt hinter ihnen und sähe sonst durch sie hindurch ins Leere.
     */
    const scheiben = new THREE.Mesh(kabineGlas(cx, cz), glass);
    scheiben.name = "06_SCHEIBEN";
    this.cabLiftGroup.add(scheiben);

    // Bordinstrument rechts vorn an der Säule — zeigt Achswinkel, Hydraulik
    // und Greiferstatus, wie das Display in der echten Maschine.
    // Sein GEHÄUSE liegt im Stahl-Netz oben; hier hängt nur die Leinwand.
    this.instruments = new InstrumentPanel(this.cabLiftGroup, cx, cz);
    this.instruments.draw(this.readout());

    const sitz = new THREE.Mesh(kabineSitz(cx, cz), farbstoff(0.9));
    sitz.castShadow = true;
    sitz.name = "06_SITZ";
    this.cabLiftGroup.add(sitz);

    /*
     * Die beiden ISO-Joysticks. Sie kippen mit der Achseingabe und sind
     * deshalb eigene Starrkörper — aber je Seite EIN Netz statt sieben, und
     * die Hand daran eines statt drei. Vorher: 20 Netze und 40 Zeichenrufe für
     * zwei Hebel von 40 cm Höhe.
     */
    const joyGeo = joystick();
    const joyStoff = farbstoff(0.6);
    for (const side of [-1, 1] as const) {
      const seite = side > 0 ? "L" : "R";
      const pivot = new THREE.Group();
      pivot.position.set(cx + side * 0.36, 1.16, cz + 0.1);
      pivot.name = `06_JOYSTICK_${seite}`;
      const hebel = new THREE.Mesh(joyGeo, joyStoff);
      hebel.castShadow = true;
      hebel.name = `06_JOYSTICK_${seite}_HEBEL`;
      pivot.add(hebel);
      this.cabLiftGroup.add(pivot);
      // Linker Stick bewegt den linken Hebel (E-144, Patrick 17.10.2026: „Tauschen"). Seit
      // dem Prototyp war es umgekehrt: side < 0 ist die rechte Hand des Fahrers.
      if (side > 0) this.joyLeft = pivot;
      else this.joyRight = pivot;
    }

    this.driverBody = buildDriver(this.cabLiftGroup, cx, cz);
    this.armeFolgen = fahrerArme(this.cabLiftGroup, cx, cz, [this.joyLeft, this.joyRight]);
    this.buildNamePlate(cx, cz);

    // Augpunkt der Kabinenkamera: Kopf an der Lehne, Konsolen liegen im Blickfeld
    this.cabinEye.position.set(cx, 1.68, cz - 0.4);
    this.cabinEye.name = "06_AUGPUNKT";
    this.cabLiftGroup.add(this.cabinEye);
  }

  /**
   * Fahrerfigur „Daniel" im Sitz — stilisierte Low-Poly-Figur im Artstyle des
   * Spiels. In der Kabinenansicht wird der Kopf ausgeblendet, damit er nicht
   * vor der Kamera steht.
   */

  /**
   * Abstützpratzen (Design nach Vorbildfoto 2026-08-29): vier ausgestellte
   * Stützbeine mit Hydraulikzylinder und Tellerfuß — das prägende Merkmal
   * eines Umschlagbaggers. Rein visuell, das Abstützen wird nicht simuliert.
   */
  private buildOutriggers(
    frameMat: THREE.MeshStandardMaterial,
    darkMat: THREE.MeshStandardMaterial
  ): void {
    const rodMat = new THREE.MeshStandardMaterial({
      color: 0xb8bec4,
      roughness: 0.25,
      metalness: 0.8,
    });
    this.buildBlade(darkMat, frameMat, rodMat);

    /*
     * Die Geometrie eines Pratzenfußes wird EINMAL gebaut und von allen vier
     * Füßen geteilt — wie beim Rad. Das spart Speicher, nicht Zeichenrufe:
     * Die kostet jedes Netz einzeln, gleich welche Geometrie darin steckt.
     */
    const pratzenGeo = { fuss: pratzeFuss(), stempel: pratzeStempel() };
    const pratzenStoff = farbstoff(0.7);

    const UP = new THREE.Vector3(0, 1, 0);
    for (const [sx, sz] of [
      [-1, 1],
      [1, 1],
      [-1, -1],
      [1, -1],
    ] as const) {
      /*
       * WO DIE PRATZE STEHT, steht in `unterwagenParts.ts` (`PRATZE_X`,
       * `PRATZE_Z`) — dort, wo auch der Ausleger gebaut wird. EINE Quelle für
       * beide: Der Fuß sitzt am Kopf des Auslegers, und nichts wäre leichter
       * übersehen, als die eine Zahl zu verschieben und die andere nicht.
       *
       * Seit E-047 (15.09.2026) stehen sie vor und hinter den Rädern statt
       * quer daneben: Bei z ±1,35 lief der Ausleger 25 cm tief durch das
       * Vorderrad. Die Begründung der Zahlen steht bei `PRATZE_X`.
       *
       * Der AUSLEGER der Pratze steht seit dem 15.09.2026 nicht mehr hier: Er
       * bewegt sich nicht und liegt deshalb im Netz des Unterwagens
       * (`unterwagenParts.ts`, Funktion `pratzenausleger`). Das sparte vier
       * Netze und acht Zeichenrufe. Nur der FUSS fährt aus — der bleibt.
       */
      const to = new THREE.Vector3(sx * PRATZE_X, 0.7, sz * PRATZE_Z);
      const e = ecke(sx, sz);
      // Stempel + Tellerfuß in einer Gruppe — fahren gemeinsam ein und aus
      const foot = new THREE.Group();
      foot.position.set(to.x, 0, to.z);
      foot.name = `03_PRATZE_${e}`;
      this.root.add(foot);
      this.outriggerGroups.push(foot);
      /*
       * Eckig statt rund (Ansage 12.09.2026: „nicht so runde Stuetzen,
       * sondern schmale herausstehende Stuetzen mit eckigen Bodenplatten").
       * Ein Zylinder liest sich als Hydraulikstempel; hier soll es nach
       * angeschweisstem Stahl aussehen, also ein schlankes Kastenprofil, das
       * nach unten leicht zulaeuft.
       */
      /*
       * ZWEI Netze je Fuß statt drei (Konzept 03): Kasten, Teller, Lagerböcke,
       * Bolzen und Schläuche fahren gemeinsam aus und liegen deshalb in einem
       * bunten Netz; nur der blanke Stempel bleibt eigen, weil blanker Stahl
       * eine andere Oberfläche hat und nicht nur eine andere Farbe.
       * Teil für Teil in `schildParts.ts`.
       */
      const fuss = new THREE.Mesh(pratzenGeo.fuss, pratzenStoff);
      fuss.castShadow = true;
      fuss.name = `03_PRATZE_${e}_FUSS`;
      foot.add(fuss);
      const stempel = new THREE.Mesh(pratzenGeo.stempel, rodMat);
      stempel.name = `03_PRATZE_${e}_STEMPEL`;
      foot.add(stempel);
      void UP;
      void frameMat;
      void darkMat;
    }
  }

  /** Dezentes Fahrerschild außen an der Kabinentür: „BAGGERFAHRER — DANIEL". */
  private buildNamePlate(cx: number, cz: number): void {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#1b1f22";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#c8cdd1";
    ctx.lineWidth = 5;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
    ctx.textAlign = "center";
    ctx.fillStyle = "#9aa2a8";
    ctx.font = "bold 30px 'Arial Black', Impact, sans-serif";
    ctx.fillText("BAGGERFAHRER", canvas.width / 2, 58);
    ctx.fillStyle = "#eef1f3";
    ctx.font = "bold 58px 'Arial Black', Impact, sans-serif";
    ctx.fillText("DANIEL", canvas.width / 2, 118);
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.19),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })
    );
    plate.position.set(cx - 0.56, 1.0, cz - 0.12);
    plate.rotation.y = -Math.PI / 2;
    plate.name = "08_NAMENSSCHILD";
    this.cabLiftGroup.add(plate);
  }

  /** „PRIPADA" in weißer Blockschrift auf beiden Auslegerflanken. */
  private buildBoomLogo(): void {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 160px 'Arial Black', Impact, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = "12px";
    ctx.fillText("PRIPADA", 40, canvas.height / 2 + 6);
    // Signet rechts neben der Wortmarke
    const sx0 = 880;
    const sy0 = canvas.height / 2;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.arc(sx0, sy0, 78, -Math.PI / 2, Math.PI * 0.75);
    ctx.stroke();
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.arc(sx0 - 13, sy0 - 7, 40, Math.PI * 0.5, Math.PI * 1.75);
    ctx.stroke();
    ctx.fillRect(sx0 - 35, sy0 - 7, 22, 92);
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      roughness: 0.55,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    /*
     * Beide Flanken tragen dieselbe Wortmarke auf derselben Leinwand — also
     * EIN Netz statt zwei (E-025, Budgetregel). Die Spiegelung steckt in der
     * Geometrie: Jede Fläche wird vor dem Verschmelzen an ihren Platz gedreht,
     * die UV-Koordinaten bleiben dabei unberührt, und das Logo steht auf
     * beiden Seiten richtig herum.
     */
    const flaechen: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1] as const) {
      const g = new THREE.PlaneGeometry(2.7, 0.52);
      g.rotateY((side * Math.PI) / 2);
      g.translate(side * 0.216, 0.03, BOOM_LEN * 0.46);
      flaechen.push(g);
    }
    const logo = mergeGeometries(flaechen, false);
    if (!logo) throw new Error("Auslegerlogo liess sich nicht verschmelzen");
    const plane = new THREE.Mesh(logo, mat);
    plane.name = "08_LOGO_AUSLEGER";
    this.boomGroup.add(plane);
  }

  private buildBodies(world: RAPIER.World): void {
    this.chassisBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        this.position.x,
        this.position.y + 1.15,
        this.position.z
      )
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(1.2, 0.75, 2.2), this.chassisBody);

    // Räumschild als eigener kinematischer Körper: abgesenkt schiebt es
    // Schrott vor sich her, angehoben liegt es über allem
    this.bladeBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 5, 0)
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(BLADE_W / 2, 0.42, 0.16)
        .setTranslation(0, 0.42, 0)
        .setFriction(0.9),
      this.bladeBody
    );

    // Ausleger + Stiel als kinematische Kollider — der Kran schiebt Schrott
    // beiseite, statt hindurchzutauchen
    this.boomBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.21, 0.31, BOOM_LEN / 2 - 0.1),
      this.boomBody
    );
    this.stickBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.16, 0.225, STICK_LEN / 2 - 0.1),
      this.stickBody
    );

    this.armShapes = [
      { mesh: () => this.boomMesh, half: [0.21, 0.31, BOOM_LEN / 2 - 0.1] },
      { mesh: () => this.stickMesh, half: [0.16, 0.225, STICK_LEN / 2 - 0.1] },
    ];
    this.collision = new ExcavatorCollision({
      world,
      position: this.position,
      getHeading: () => this.heading,
      grappleGroup: this.grappleGroup,
      grappleBody: () => this.grappleBody,
      armShapes: this.armShapes,
      obstacleBodies: this.obstacleBodies,
      grippedHandles: this.grippedHandles,
      getStaffPos: () => this.getStaffPos?.() ?? null,
      selfHandles: this.selfHandles,
      // E-152: am Magneten endet die Pruefkugel an der Scheibe
      pruefTiefe: () => (this.form.magnet ? this.form.magnet.unten - PROBE_R : 1.35),
    });

    for (const b of [this.chassisBody, this.bladeBody, this.boomBody, this.stickBody]) {
      this.selfHandles.add(b.handle);
    }
    this.grappleBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 5, 0)
    );
    world.createCollider(
      RAPIER.ColliderDesc.cylinder(0.22, 0.5).setTranslation(0, -GRAPPLE_LINK - 0.2, 0),
      this.grappleBody
    );
    this.selfHandles.add(this.grappleBody.handle);
    // Die Krallen bekommen eigene Kollider — je zwei Kapseln bilden die Sichel
    // grob nach. Ohne sie fuhr die Spinne sichtbar durch Schrottteile hindurch.
    /*
     * Drei Kollider-Reihen je Schale statt einer.
     *
     * Eine Schale ist oben 0,90 m breit. Mit einer einzigen Kapselkette auf
     * der Mittellinie war sie physisch ein 20 cm dicker Draht — Material fiel
     * links und rechts daran vorbei, obwohl man die Schale davor sah. Die
     * Reihen liegen auf der Mitte und auf 60 % der halben Breite zu jeder
     * Seite; an der Spitze laufen sie ohnehin zusammen, weil die Schale dort
     * schmal wird.
     */
    this.baueKrallenKollider();
  }

  /**
   * Die Kapselketten der Schalen anlegen — je Schale `KOLLIDER_REIHEN` Reihen
   * zu zwei Kapseln. Eigene Methode, weil sie beim Greiferwechsel neu
   * entstehen muessen: Die Form gibt Zahl und Radius vor.
   */
  private baueKrallenKollider(): void {
    for (const c of this.clawColliders) this.world.removeCollider(c, false);
    this.clawColliders.length = 0;
    for (let i = 0; i < this.form.schalen * KOLLIDER_REIHEN * 2; i++) {
      this.clawColliders.push(
        this.world.createCollider(
          RAPIER.ColliderDesc.capsule(0.16, this.form.kolliderRadius),
          this.grappleBody
        )
      );
    }
    /*
     * E-146: Der Magnet hat keine Schalen, aber eine Scheibe — sie haelt
     * angezogene Teile auf und schiebt Schrott beiseite wie die Krallen. Sie
     * steht in derselben Liste, damit sie beim Wechsel mit verschwindet;
     * `updateClawColliders` beruehrt sie nicht (sie haengt hinter den Schalen).
     */
    const m = this.form.magnet;
    if (m) {
      this.clawColliders.push(
        this.world.createCollider(
          RAPIER.ColliderDesc.cylinder(m.hoehe / 2, m.radius)
            .setTranslation(0, -m.unten + m.hoehe / 2, 0)
            .setFriction(0.9),
          this.grappleBody
        )
      );
    }
  }

  /**
   * Krallen-Kollider der aktuellen Öffnung nachführen. Beim Tragen werden sie
   * abgeschaltet: die Last hängt am Gelenk und würde sonst herausgequetscht.
   */
  private updateClawColliders(): void {
    const carrying = this.carriedCount > 0 || this.clawGraceS > 0;
    for (let c = 0; c < this.form.schalen; c++) {
      const a = (c / this.form.schalen) * Math.PI * 2;
      // Jede Kralle mit ihrem eigenen Winkel — sonst stuenden die Kollider
      // woanders als die Zacken, die man sieht
      const splay = this.clawSplayIst[c] ?? this.currentSplay();
      for (let reihe = 0; reihe < KOLLIDER_REIHEN; reihe++) {
      /*
       * Die Reihe sitzt um `u` neben der Mittellinie. `clawPoint` nimmt den
       * Umfangswinkel als ersten Parameter — ein Punkt der Schale bei
       * Seitenversatz u ist deshalb schlicht `clawPoint(a + u, …)`. Der Radius
       * haengt nicht vom Winkel ab, also stimmt das ohne Umrechnung.
       */
      const u = (reihe - (KOLLIDER_REIHEN - 1) / 2) * KOLLIDER_ABSTAND;
      for (let h = 0; h < 2; h++) {
        const col = this.clawColliders[(c * KOLLIDER_REIHEN + reihe) * 2 + h];
        col.setEnabled(!carrying);
        if (carrying) continue;
        this.form.punkt(a + u, splay, h * (this.form.stationen / 2), this.clawA);
        this.form.punkt(a + u, splay, (h + 1) * (this.form.stationen / 2), this.clawB);
        this.clawMid.addVectors(this.clawA, this.clawB).multiplyScalar(0.5);
        this.clawDir.subVectors(this.clawB, this.clawA);
        const len = this.clawDir.length();
        if (len < 1e-4) continue;
        this.clawDir.divideScalar(len);
        this.clawQuat.setFromUnitVectors(UP_Y, this.clawDir);
        col.setHalfHeight(Math.max(len / 2 - 0.1, 0.03));
        col.setTranslationWrtParent(this.clawMid);
        col.setRotationWrtParent(this.clawQuat);
      }
      }
    }
  }

  // ---------- Simulation ----------

  /** Einmal pro Render-Frame: diskrete Eingaben (Mausrad-Rotator, Kabinenhub). */
  handleDiscreteInput(input: Input): void {
    if (!input.shiftHeld && input.wheelDelta !== 0) {
      this.rotatorYaw += input.wheelDelta * ROTATOR_STEP;
    }
    
    if (input.wasPressed("KeyX")) this.toggleCabLift();
    if (input.wasPressed("KeyO")) this.toggleOutriggers();
  }

  /** Kabine hoch-/runterfahren (Taste X oder Touch-Knopf). */
  toggleCabLift(): void {
    this.cabLiftTarget = this.cabLiftTarget > 0.1 ? 0 : CAB_LIFT_MAX;
  }

  /** Abstützpratzen aus-/einfahren (Taste O oder Touch-Knopf). */
  toggleOutriggers(): void {
    this.outriggerTarget = this.outriggerTarget > 0.5 ? 0 : 1;
  }

  /**
   * Standflaechen der Fahrzeuge auf dem Hof — von main gesetzt. Solange das
   * nicht gesetzt ist, faehrt der Bagger wie bisher ungebremst.
   */
  getVehicleBoxes: (() => Box[]) | null = null;
  /** Stand der letzte Fahrversuch vor einem LKW? Fuers HUD. */
  blockedByVehicle = false;

  /** Aktuelle Kabinenhöhe (0 = unten) — fürs HUD. */
  get cabLiftHeight(): number {
    return this.cabLift;
  }

  /** Ein fester Physik-Step (dt = 1/60). Reihenfolge: Achsen → Meshes → kinematische Körper. */
  update(dt: number, input: Input): void {
    // Last: kostet kaum Endtempo, aber Anlauf (siehe tempoFaktor/anlaufZeit).
    // Dazu kommt der Widerstand des Materials, durch das die Spinne gerade
    // pflügt — der bremst wirklich, denn dagegen arbeitet die Maschine.
    // Der Baggerausbau macht die Hydraulik schneller
    /*
     * Der Ausbau macht die Maschine wacher, nicht schneller.
     *
     * Vorher ging der Ausbaubonus aufs Endtempo. Gemessen am 11.09.2026 drehte
     * das Drehwerk damit 60,8 statt der eingestellten 45 Grad je Sekunde, und
     * die Spinne lief mit 9,2 m/s — 33 km/h auf 8,7 m Radius. Das war das
     * "zu wild". Das Endtempo ist eine Eigenschaft der Maschine und bleibt
     * darum, wo es hingehoert (42 bis 54 Grad je Sekunde, siehe CAB_MAX); der
     * Bonus verkuerzt stattdessen die Rampe, die Maschine spricht also
     * schneller an.
     */
    const ausbau = this.getSpeedBonus?.() ?? 1;
    const carried = tempoFaktor(this.carriedMassKg);
    /*
     * Im Material kommt die Maschine auch langsamer in Fahrt, nicht nur
     * langsamer voran. Vorher bremste das Pfluegen nur das Endtempo — der
     * Arm sprang also genauso munter an und war bloss frueher fertig. Das
     * las sich wie ein Spielzeug, das durch Watte faehrt.
     */
    const rampe =
      (anlaufZeit(this.carriedMassKg) / ausbau) *
      THREE.MathUtils.lerp(1, PFLUG_TRAEGHEIT, 1 - this.plowFactor);
    this.plowFactor += (this.collision.plowFactor() - this.plowFactor) * Math.min(dt * 6, 1);
    const loadFactor = carried * this.plowFactor;
    // Zustand vor der Bewegung merken (für die Fahrzeug-Sperre unten)
    const prevBoom = this.boomAngle;
    const prevStick = this.stickAngle;
    const prevCabYaw = this.cabYaw;
    const prevPos = this.tmpPrevPos.copy(this.position);
    const traegt = (this.greifsystem?.gehalten.length ?? 0) > 0;
    if (traegt) {
      const h = this.halt;
      h.gPos.copy(this.grappleGroup.position);
      h.gQuat.copy(this.grappleGroup.quaternion);
      h.swing.copy(this.swing);
      h.qPendel.copy(this.qPendel);
      h.neigung = this.neigung;
      h.achse.copy(this.pendelAchse);
      h.wheelSpin = this.wheelSpin;
    }

    // --- Fahrwerk ---
    // Auf ausgefahrenen Stützen steht die Maschine aufgebockt — dann wird
    // nicht gefahren, so wie es sich gehört.
    const wantsDrive = clamp1(input.axis("KeyS", "KeyW") + (this.touch?.drive ?? 0));
    const rawSteer = clamp1(input.axis("KeyA", "KeyD") + (this.touch?.steer ?? 0));
    this.blockedByOutriggers =
      this.outriggerDown > 0.15 && (wantsDrive !== 0 || rawSteer !== 0);
    const locked = this.outriggerDown > 0.15;
    const driveTarget = (locked ? 0 : wantsDrive) * DRIVE_MAX;
    this.driveVel = ramp(this.driveVel, driveTarget, (DRIVE_MAX / DRIVE_RAMP_TIME) * dt);
    const steer = locked ? 0 : rawSteer;
    if (Math.abs(this.driveVel) > 0.05 || steer !== 0) {
      const dir = this.driveVel >= 0 ? 1 : -1;
      const speedFactor = THREE.MathUtils.clamp(Math.abs(this.driveVel) / DRIVE_MAX, 0.35, 1);
      this.heading -= steer * STEER_RATE * speedFactor * dir * dt;
    }
    /*
     * Lenkung (E-025, Befund 1): Der Ausschlag folgt der Lenkeingabe mit einer
     * eigenen kleinen Rampe — eine Achse schlägt nicht in einem Bild ein.
     * Das Rollen steht weiter unten, es hängt an der wirklich gefahrenen
     * Strecke.
     */
    const lenkZiel = locked ? 0 : -steer * LENK_MAX;
    this.steerAngle = ramp(this.steerAngle, lenkZiel, (LENK_MAX / LENK_ZEIT) * dt);

    const naechstesX = this.position.x + Math.sin(this.heading) * this.driveVel * dt;
    const naechstesZ = this.position.z + Math.cos(this.heading) * this.driveVel * dt;
    /*
     * Nicht durch stehende LKW fahren (Befund 11.09.2026). Der Unterwagen
     * ueberstreicht beim Rangieren einen Kreis von `UNTERWAGEN_R` = 2,66 m
     * (3,00 m breit, 4,40 m lang); genau darum wird die Standflaeche des
     * Fahrzeugs erweitert. Ist der Schritt belegt, bleibt die Maschine stehen
     * und das Tempo faellt auf null — sie schiebt keinen LKW vor sich her.
     *
     * DIESELBE QUELLE gilt seit dem 21.09.2026 auch gegen Bauwerke: `chassisHits`
     * in `collision.ts` prueft dort das gedrehte Rechteck aus denselben zwei
     * Halbmassen. Vorher stand da ein eigener Rand von 1,30 m, und die
     * Maschine fuhr 1,35 m in den MUELL-Container hinein.
     */
    const boxen = this.getVehicleBoxes?.();
    if (boxen && findeBox(naechstesX, naechstesZ, boxen, UNTERWAGEN_R)) {
      this.driveVel = 0;
      this.blockedByVehicle = true;
    } else {
      this.blockedByVehicle = false;
      this.position.x = naechstesX;
      this.position.z = naechstesZ;
    }

    // --- Oberwagen / Ausleger / Stiel (mit Last-Trägheit) ---
    // Zweitbelegung Pfeil-Block (einhändiges Testen): ←/→ Oberwagen,
    // ↑/↓ Stiel, Bild↑/Bild↓ Ausleger
    // Tastatur + Touch-Sticks auf dieselben Achsen
    const t = this.touch;
    if (t?.rotator) this.rotatorYaw += t.rotator * ROTATOR_SPEED * dt;
    this.inCab = clamp1(axis2(input, "KeyE", "KeyQ", "ArrowRight", "ArrowLeft") + (t?.cab ?? 0));
    this.inBoom = clamp1(axis2(input, "KeyF", "KeyR", "PageDown", "PageUp") + (t?.boom ?? 0));
    this.inStick = clamp1(axis2(input, "KeyG", "KeyT", "ArrowDown", "ArrowUp") + (t?.stick ?? 0));
    const cabTarget = this.inCab * CAB_MAX * loadFactor;
    this.cabVel = ramp(this.cabVel, cabTarget, (CAB_MAX / rampe) * dt);
    this.cabYaw += this.cabVel * dt;

    /*
     * Liegt die Spinne auf, wird die Abwaertsrichtung gar nicht erst
     * kommandiert. Welche Achsrichtung "abwaerts" ist, haengt von der
     * Armstellung ab: Beim Ausleger senkt ein negativer Winkel die Spitze nur,
     * solange er vor der Senkrechten steht.
     */
    const gesamtWinkel = this.boomAngle + this.stickAngle;
    const dBoomTip = BOOM_LEN * Math.cos(this.boomAngle) + STICK_LEN * Math.cos(gesamtWinkel);
    const dStickTip = STICK_LEN * Math.cos(gesamtWinkel);
    let boomEingabe = this.inBoom;
    let stickEingabe = this.inStick;
    // E-137: fuers Druecken — wie weit nach unten befohlen wird, vor der Sperre
    this.senkBefehl = Math.max(
      boomEingabe * dBoomTip < 0 ? Math.abs(boomEingabe) : 0,
      stickEingabe * dStickTip < 0 ? Math.abs(stickEingabe) : 0
    );
    if (this.bodenSperre) {
      if (boomEingabe * dBoomTip < 0) boomEingabe = 0;
      if (stickEingabe * dStickTip < 0) stickEingabe = 0;
    }

    const boomTarget = boomEingabe * BOOM_RATE * loadFactor;
    this.boomVel = ramp(this.boomVel, boomTarget, (BOOM_RATE / rampe) * dt);
    this.boomAngle = THREE.MathUtils.clamp(this.boomAngle + this.boomVel * dt, BOOM_MIN, BOOM_MAX);

    const stickTarget = stickEingabe * STICK_RATE * loadFactor;
    this.stickVel = ramp(this.stickVel, stickTarget, (STICK_RATE / rampe) * dt);
    this.stickAngle = THREE.MathUtils.clamp(
      this.stickAngle + this.stickVel * dt,
      STICK_MIN,
      STICK_MAX
    );

    // --- Spinne ---
    // Spinne: Tastatur, Maus und Druckgriff schließen mit voller Kraft.
    // Der rechte Stick arbeitet stufenlos — je weiter der Ausschlag, desto
    // schneller schließt bzw. öffnet die Spinne; neutral hält den Zustand.
    const cmd = this.touch?.grapple ?? 0;
    const held = input.mouseHeld(0) || input.isDown("Space") || (this.touch?.grab ?? false);
    // für die Hebelanimation in der Kabine
    this.inGrapple = held ? 1 : THREE.MathUtils.clamp(cmd, -1, 1);
    let closeRate: number;
    if (held) {
      closeRate = dt / CLOSE_TIME;
      this.grappleHold = true;
    } else if (cmd !== 0) {
      const intensity = Math.min(Math.abs(cmd), 1);
      closeRate = cmd > 0 ? (intensity * dt) / CLOSE_TIME : (-intensity * dt) / OPEN_TIME;
      this.grappleHold = cmd > 0;
    } else if (this.touch) {
      closeRate = 0; // Stick neutral: Position halten
    } else {
      closeRate = -dt / OPEN_TIME; // Tastatur losgelassen: öffnet
      this.grappleHold = false;
    }
    const closureVorher = this.closure;
    this.closure = THREE.MathUtils.clamp(this.closure + closeRate, 0, 1);
    /*
     * Zuschnappen: Wenn die Zaehne aufeinandertreffen, klingt das metallisch —
     * am deutlichsten, wenn nichts dazwischen ist (Wunsch 11.09.2026). Der
     * Moment ist genau der, in dem die Spinne die Schliessgrenze erreicht und
     * keine Kralle von Material blockiert wird; dann treffen sich die Spitzen
     * tatsaechlich.
     */
    if (
      this.form.schalen > 0 && // E-146: ein Magnet schnappt nicht
      closeRate > 0 &&
      closureVorher < SCHNAPP_AB &&
      this.closure >= SCHNAPP_AB &&
      !this.krallenBlockiert
    ) {
      const haerte = held ? 0.55 : 1;
      this.anschlagStaerke = haerte;
      this.anschlag(haerte);
      this.onClawSnap?.(haerte);
    }
    this.updateAnschlag(dt);
    // „closing" steuert das Greifsystem: Zupacken solange die Spinne schließt
    // oder geschlossen gehalten wird
    this.closing = held || closeRate > 0 || (this.grappleHold && this.closure > 0.5);
    /*
     * E-146: Am Magneten ist „schliessen" EIN und „oeffnen" AUS — derselbe
     * Eingang, dieselbe Zeile wie oben. Gemeldet wird nur das Umschalten.
     */
    const magnetAn = !!this.form.magnet && this.closing;
    if (magnetAn !== this.magnetAn) {
      this.magnetAn = magnetAn;
      if (magnetAn) this.onMagnetAn?.();
      else this.onMagnetAus?.();
      this.greiferbau.setAn?.(magnetAn);
    }

    // Kabinenhub fährt gleichmäßig auf die Zielhöhe
    const liftStep = CAB_LIFT_SPEED * dt;
    this.cabLift += THREE.MathUtils.clamp(this.cabLiftTarget - this.cabLift, -liftStep, liftStep);
    // Abstützpratzen ein-/ausfahren
    const outStep = dt / 2.2;
    this.outriggerDown += THREE.MathUtils.clamp(
      this.outriggerTarget - this.outriggerDown,
      -outStep,
      outStep
    );
    // Aufbocken: die ganze Maschine steigt auf den Stützen. Über position.y
    // wandern Arm, Greifer und Physikkörper mit — nur die Optik anzuheben
    // würde den Greifer von seinem Kollider trennen.
    this.position.y = this.outriggerDown * Excavator.JACK_UP_M;

    // Räumschild heben und senken
    const bladeStep = dt / BLADE_TIME;
    this.bladeDown += THREE.MathUtils.clamp(
      this.bladeTarget - this.bladeDown,
      -bladeStep,
      bladeStep
    );

    // Drehgeschwindigkeit der Spinne für das Herausreißen festhalten
    this.rotatorVel = (this.rotatorYaw - this.lastRotatorYaw) / Math.max(dt, 1e-4);
    this.lastRotatorYaw = this.rotatorYaw;

    // Erst die Pose dieses Bildes herstellen, dann aufsetzen: Die Strahlen
    // gehen von den Krallenspitzen aus, und die stehen sonst noch dort, wo sie
    // im letzten Bild waren — beim Schwenken misst man dann die falsche Stelle.
    this.clawGraceS = Math.max(0, this.clawGraceS - dt);
    this.syncMeshes();
    this.resolveGroundClamp();
    this.updateClawBlocking(dt);
    // Erst wenn die Schalen dieses Bildes stehen, steht auch der Druck (E-112).
    this.updateSchliesskraft(dt);
    this.syncMeshes();

    // Fahrwerk und Arm werden getrennt geprüft: ein Hindernis neben den
    // Rädern darf den Ausleger nicht mit stilllegen.
    const col = this.collision;
    if (col.chassisHits() && col.chassisFree) {
      this.position.copy(prevPos);
      this.driveVel = 0;
      this.syncMeshes();
      col.chassisFree = !col.chassisHits();
    } else if (!col.chassisHits()) {
      col.chassisFree = true;
    }

    // Arm, Stiel und Spinne. Wichtig ist der Fluchtweg: Steckt der Arm
    // wirklich einmal fest, werden Bewegungen wieder durchgelassen — sonst
    // verkantet er sich unrettbar, weil auch die befreiende Bewegung
    // zurückgenommen würde.
    if (col.armHits()) {
      this.armBlocked = true;
      if (col.armFree) {
        this.boomAngle = prevBoom;
        this.stickAngle = prevStick;
        this.cabYaw = prevCabYaw;
        this.boomVel = 0;
        this.stickVel = 0;
        this.cabVel = 0;
        this.syncMeshes();
        // Hilft das Zurücknehmen überhaupt? Wenn nicht, sitzt er fest und
        // darf sich im nächsten Bild frei herausbewegen.
        col.armFree = !col.armHits();
      }
    } else {
      this.armBlocked = false;
      col.armFree = true;
    }

    // E-152: Ueberlastsperre — schwerer als die Tabelle hier erlaubt: nicht heben, nicht ausfahren
    this.ueberlastSperre(prevBoom, prevStick, prevPos, traegt);

    /*
     * Räder rollen — nach der Kollisionsprüfung, und aus der WIRKLICH
     * gefahrenen Strecke: Winkel = Strecke / Radhalbmesser.
     *
     * Der erste Versuch am 15.09.2026 rechnete mit `driveVel · dt`. Das ist
     * fast immer dasselbe, aber eben nicht immer: Stösst das Fahrwerk an, wird
     * `position` oben auf den Stand vor dem Schritt zurückgenommen — die Räder
     * hätten sich dann weitergedreht, obwohl die Maschine steht. Gemessen war
     * das über zwei Sekunden Fahrt ein Fehler von 5,8 cm; an einer Wand wäre
     * daraus ein durchdrehendes Rad geworden.
     *
     * Gestutzt auf einen Umlauf, damit der Wert in einer langen Schicht nicht
     * ins Grobe wächst und die Drehung anfängt zu springen.
     */
    const gefahren = Math.hypot(this.position.x - prevPos.x, this.position.z - prevPos.z);
    this.wheelSpin =
      (this.wheelSpin + (Math.sign(this.driveVel) * gefahren) / RAD_R) % (Math.PI * 2);

    this.integratePendulum(dt);
    this.lastAnWand = false;
    if (traegt) this.haltAnWand(prevBoom, prevStick, prevCabYaw, prevPos);
    this.rotatorOk = this.rotatorYaw;
    this.syncBodies();

    if (this.groundContact.active) {
      this.groundContact.point.set(
        this.grappleGroup.position.x,
        0.05,
        this.grappleGroup.position.z
      );
    }
  }

  /**
   * Boden ist immer harter Widerstand (Kap. 6.1): Ausleger/Stiel werden so
   * geklemmt, dass die Zackenspitzen nie unter den Boden geraten. Kontakt bei
   * gleichzeitiger Dreh-/Fahrbewegung liefert die Kratz-Intensität für
   * Sound + Staub/Funken.
   */
  /**
   * Aktuelle Spreizung der Schalen. Geschlossen legen sie sich zur Kalotte
   * zusammen — es sei denn, es liegt Material darin: dann bleibt die Spinne
   * so weit offen, wie die Ladung Platz braucht.
   */
  /** Aktuelle Spreizung — die Zielhilfe braucht sie fuer den Ringdurchmesser. */
  get splay(): number {
    return this.currentSplay();
  }

  private currentSplay(): number {
    /*
     * Geschlossen ist nicht mehr Spreizung 0, sondern CLAW_CLOSED_SPLAY.
     * Ladung haelt die Schalen darueber hinaus offen — das kommt oben drauf.
     */
    /*
     * Die drei Zahlen der Ladung stehen als ANTEIL am Oeffnungsweg da
     * (Ansage Patrick 15.09.2026, E-058): Der Fuenfschalengreifer hat einen
     * 67 % laengeren Weg, und dieselbe absolute Zahl hiesse dort ein Drittel
     * weniger Wirkung. Fuer die Sichelkralle kommen wieder genau 0,50 / 0,06 /
     * 0,28 heraus, weil ihr Weg der Massstab ist.
     */
    const weg = (this.form.offen - this.form.zu) / (SICHELKRALLE.offen - SICHELKRALLE.zu);
    const minSplay =
      this.form.zu +
      Math.min(
        this.form.ladungOffen,
        (this.carriedCount * 0.06 + Math.min(this.carriedMassKg / NENNLAST_KG, 1) * 0.28) * weg
      );
    // Der Anschlag federt kurz zurueck — siehe anschlag().
    return THREE.MathUtils.lerp(this.form.offen, minSplay, this.closure) + this.anschlagWinkel;
  }

  /*
   * Leeres Zuschnappen mit sichtbarem Anschlag (Auftrag 11.09.2026, Phase 1.4).
   *
   * Treffen die Zaehne ohne Material aufeinander, gingen sie bisher lautlos
   * und weich in die Endlage. Echte Schalen schlagen auf und federn ein Stueck
   * zurueck. Der Rueckprall ist eine gedaempfte Feder auf dem Spreizwinkel:
   * Er springt um ANSCHLAG_GRAD auf und klingt in ANSCHLAG_S ab. Der Klang
   * dazu haengt am selben Ereignis.
   */
  private anschlagWinkel = 0;
  private anschlagRest = 0;

  private anschlag(haerte: number): void {
    this.anschlagWinkel = ANSCHLAG_GRAD * haerte;
    this.anschlagRest = ANSCHLAG_S;
  }

  private updateAnschlag(dt: number): void {
    if (this.anschlagRest <= 0) {
      this.anschlagWinkel = 0;
      return;
    }
    this.anschlagRest = Math.max(0, this.anschlagRest - dt);
    // Abklingende Schwingung: einmal auf, einmal zurueck, dann ruhig
    const t = 1 - this.anschlagRest / ANSCHLAG_S;
    // Nur nach OBEN federn: Weiter zu als bis zum Anschlag geht nicht, das
    // ist ja gerade der Anschlag. Ohne die Klemmung schwang der Winkel in die
    // Gegenrichtung und die Schalen gingen kurz zu weit zu (gemessen: -0,8°).
    this.anschlagWinkel = Math.max(
      0,
      ANSCHLAG_GRAD * Math.cos(t * Math.PI * 1.5) * (1 - t) * (1 - t) * this.anschlagStaerke
    );
  }

  private anschlagStaerke = 1;

  /**
   * Spreizung je Kralle. Bisher bekamen alle fuenf denselben Winkel — die
   * Spinne ging immer gleichmaessig zu, auch wenn eine Stange zwischen zwei
   * Zaehnen steckte. Jede Kralle hat jetzt ihren eigenen Weg: Was blockiert
   * ist, bleibt stehen, der Rest geht weiter zu.
   */
  private clawSplayIst: number[] = new Array(FUENFSCHALEN.schalen).fill(FUENFSCHALEN.offen);
  /**
   * Schonfrist nach dem Loslassen: Solange sie laeuft, sind die Krallen-Kollider
   * abgeschaltet. Beim Oeffnen sind die Zacken noch fast zu und die Spinne sinkt
   * noch — ohne die Frist quetschen die kinematischen Krallen das eben
   * losgelassene Teil gegen den Boden, und es schiesst weg (v2 E-018).
   */
  private clawGraceS = 0;
  /** Verbleibendes Nachdruecken je Kralle, damit sie nicht schlagartig steht */
  private clawReserve: number[] = new Array(FUENFSCHALEN.schalen).fill(
    FUENFSCHALEN.nachdrueckReserve
  );
  /** Was jeder Zahn zuletzt vorgefunden hat: 0 frei, 1 weich, 2 hart. */
  private clawArt: Array<0 | 1 | 2> = new Array(FUENFSCHALEN.schalen).fill(0);
  private blockTmp = new THREE.Vector3();
  // Feine Tastkugel: Mit 0,14 blieb der Zahn sichtbar auf Abstand stehen,
  // als griffe er ins Leere. Er soll bis fast an das Teil heran.
  private blockShape = new RAPIER.Ball(0.08);
  private static readonly IDENT = { x: 0, y: 0, z: 0, w: 1 };
  /*
   * Wie schnell eine freie Kralle ihrem Sollwinkel folgt, steht seit E-057 an
   * der Form (`Greiferform.rate`) — sie haengt am Oeffnungsweg und der ist je
   * Greifer verschieden. Fuer die Sichelkralle sind es unveraendert 4,0 rad/s.
   */

  /**
   * Sitzt diese Kralle bei der angepeilten Spreizung auf etwas auf?
   *
   * Geprüft wird nur gegen bewegliche Koerper — Schrott, Wracks, Ladung. Beton,
   * Waende und Muldenboeden sind fest und duerfen die Zaehne nicht festhalten:
   * Auf ebenem Boden schliesst ein Greifer sehr wohl, die Spitzen schleifen
   * dann ueber die Platte.
   */
  /**
   * Gibt dieser Koerper unter den Zaehnen nach? Von aussen gesetzt, weil der
   * Bagger den Schrottkatalog nicht kennt. Ohne Zuordnung blockiert alles
   * Bewegliche — die vorsichtige Annahme.
   */
  clawBlockedBy: ((body: RAPIER.RigidBody) => boolean) | null = null;

  /** Schonfrist starten — vom Greifsystem beim Loslassen gerufen. */
  startClawGrace(sekunden = 0.6): void {
    this.clawGraceS = Math.max(this.clawGraceS, sekunden);
  }
  /**
   * Ein Zahn ist in ein nachgiebiges Teil eingedrungen. Wer sich aufspiessen
   * laesst, soll es hinterher ansehen — sonst steckt das Teil unversehrt auf
   * der Zacke und nichts erklaert, warum.
   */
  onClawPierce: ((body: RAPIER.RigidBody) => void) | null = null;
  /**
   * Die Zaehne schlagen aufeinander. Der Parameter sagt, wie hart: 1 = leer
   * durchgeschnappt, weniger, wenn Material dazwischenliegt.
   */
  onClawSnap: ((haerte: number) => void) | null = null;

  /**
   * Was ein Zahn an dieser Stelle vorfindet.
   *
   * FREI: nichts im Weg. WEICH: etwas Nachgiebiges — Blech, ein Fass, eine
   * Waschmaschine. HART: massiver Stahl, ein Traeger, ein Motorblock.
   *
   * Der Unterschied zwischen WEICH und HART ist nicht mehr „geht hindurch"
   * gegen „steht", sondern nur noch, wie weit der Zahn eindringt (Ansage
   * 12.09.2026: „die Spinne soll die Zaehne bei Bedarf dem Objekt angepasst
   * schliessen, aber eine gewisse Starre bzw. Kraft muss jeder Zahn haben").
   */
  private clawBlocked(a: number, splay: number): { art: 0 | 1 | 2; koerper: RAPIER.RigidBody | null } {
    this.form.punkt(a, splay, this.form.stationen, this.blockTmp);
    this.grappleGroup.localToWorld(this.blockTmp);
    let art: 0 | 1 | 2 = 0;
    let koerper: RAPIER.RigidBody | null = null;
    this.world.intersectionsWithShape(
      this.blockTmp,
      Excavator.IDENT,
      this.blockShape,
      (c) => {
        const b = c.parent();
        if (!b) return true;
        if (this.selfHandles.has(b.handle)) return true;
        if (!b.isDynamic()) return true;
        if (this.clawBlockedBy ? this.clawBlockedBy(b) : true) {
          art = 2;
          koerper = b;
          return false; // massiv — weitersuchen bringt nichts
        }
        // Nachgiebig: Der Zahn drueckt sich hinein, aber er faehrt nicht mehr
        // glatt hindurch. Ein weiches Teil bleibt der weichste Fund, falls
        // nebenan noch etwas Massives liegt — darum weitersuchen.
        if (art === 0) {
          art = 1;
          koerper = b;
        }
        return true;
      }
    );
    return { art, koerper };
  }

  /**
   * Krallen einzeln nachfuehren. Oeffnen geht immer — sonst bliebe eine Kralle
   * fuer immer stecken, sobald sie einmal aufsitzt. Schliessen nur so weit, wie
   * Platz ist.
   */
  private updateClawBlocking(dt: number): void {
    // Der Merker gilt je Schritt. Die Schnappabfrage weiter oben liest den
    // Stand des Vorschritts — bei 60 Hz ist das ein Sechzigstel Versatz.
    this.krallenBlockiert = false;
    this.clawFunde.clear();
    const ziel = this.currentSplay();
    const schritt = this.form.rate * dt;
    const frei = this.form.nachdrueckReserve;
    for (let c = 0; c < this.form.schalen; c++) {
      const ist = this.clawSplayIst[c]!;
      if (ziel >= ist) {
        const auf = naechsteSpreizung(ist, ziel, schritt, false, this.clawReserve[c]!, frei);
        this.clawSplayIst[c] = auf.winkel;
        this.clawReserve[c] = auf.reserve;
        // Beim Oeffnen hat der Zahn nichts mehr vor sich; sonst behielte er
        // seinen alten Fund und bekaeme beim naechsten Schliessen kein
        // frisches Weggeld.
        this.clawArt[c] = 0;
        continue;
      }
      const naechste = Math.max(ziel, ist - schritt);
      const a = (c / this.form.schalen) * Math.PI * 2;
      const fund = this.clawBlocked(a, naechste);
      if (fund.art !== 0) this.krallenBlockiert = true;
      /*
       * Jeder Zahn hat sein eigenes Weggeld. Trifft er auf etwas anderes als
       * eben noch, bekommt er den Vorrat dieser Haerte: an massivem Stahl
       * einen Ruck, an Nachgiebigem gut das Dreifache — so weit drueckt er
       * sich hinein, und dann steht er. Vorher gab es fuer Nachgiebiges gar
       * keine Grenze: Der Zahn lief durch das Teil hindurch bis zum Anschlag,
       * und das Objekt sah aus, als haette es der Greifer gar nicht beruehrt.
       */
      if (fund.art !== this.clawArt[c]) {
        this.clawArt[c] = fund.art;
        this.clawReserve[c] = fund.art === 1 ? this.form.weichReserve : frei;
      }
      const vorher = this.clawReserve[c]!;
      const zu = naechsteSpreizung(ist, ziel, schritt, fund.art !== 0, vorher, frei);
      this.clawSplayIst[c] = zu.winkel;
      this.clawReserve[c] = zu.reserve;
      /*
       * Die Beule kommt erst, wenn der Zahn sein Weggeld aufgebraucht hat —
       * also wirklich hineingedrueckt hat. Ein Antippen soll noch nichts
       * verformen.
       */
      if (fund.art === 1 && vorher > 0 && zu.reserve <= 0 && fund.koerper) {
        this.onClawPierce?.(fund.koerper);
      }
      // Wer vor der Schale steht, steht auch unter ihrem Druck — die
      // Schliesskraft weiter unten braucht die Handles (E-112).
      if (fund.koerper) this.clawFunde.add((fund.koerper as RAPIER.RigidBody).handle);
    }
  }

  /**
   * Was die Schalen in diesem Schritt vor sich hatten (Rapier-Handles).
   *
   * Wird in `updateClawBlocking` gefuellt und in `updateSchliesskraft`
   * gelesen — gesammelt, nicht im Abfrage-Callback verarbeitet (v2 E-044).
   */
  private clawFunde = new Set<number>();

  /**
   * Hat in diesem Schritt eine Kralle Material vor sich gehabt?
   *
   * Das war der Grund, warum das Schnappgeraeusch nie zu hoeren war: Die
   * Bedingung fragte `!this.clawBlocked` ab — und das ist die METHODE, also
   * immer wahr. Die Verneinung war damit immer falsch, und der Anschlag hat
   * nie ausgeloest (gemessen im Labor 11.09.2026: null Ausloesungen in
   * 40 Schritten bis zum vollen Schliessen).
   */
  private krallenBlockiert = false;

  /** Wie weit die Spinne tatsaechlich zu ist — die am weitesten offene Kralle zaehlt. */
  get clawSplayMax(): number {
    let max = 0;
    for (const v of this.clawSplayIst) max = Math.max(max, v);
    return max;
  }

  /*
   * ===== SCHLIESSKRAFT (E-112, 22.09.2026) =================================
   *
   * Bis hierher gab es am Greifer nur „gefasst" oder „nicht gefasst". Man
   * konnte ein Auto kaputtWERFEN (die Quetschstufen haengen am Delta v des
   * Wrackkoerpers), aber nicht kaputtDRUECKEN — es gab keine Kraft, die man
   * lesen konnte.
   *
   * WAS GEMESSEN WURDE, BEVOR DAS HIER STAND (`tools/greifkraft.ts`):
   * Die Spinne wird auf einen Gegenstand gesetzt und die Leertaste 3 s
   * gehalten. Abgelesen wird die befohlene gegen die erreichte Spreizung.
   *
   *   Gegenstand                       Schalen stehen bei   ueber „ganz zu"
   *   Autowrack 4,2 m / 1100 kg        38,45°               6,97°
   *   Brocken 0,85 m / 400 kg          36,21°               4,73°
   *   Traeger 2,4 m / 180 kg           35,50°               4,02°
   *   Blech 1,2 m / 55 kg              35,10°               3,62°
   *   Luft                             31,48°               0,00°
   *
   * Gegen `currentSplay()` gemessen ist die Differenz in ALLEN fuenf Faellen
   * exakt 0,00° — auch beim Wrack. Der Vorschlag „Differenz zwischen
   * befohlener und erreichter Stellung" trifft also etwas Echtes, aber nur,
   * wenn man gegen den ROHEN Befehl misst: `currentSplay()` gibt unter Last
   * selbst nach (`ladungOffen`), der Befehl laeuft der Schale hinterher, und
   * die Differenz verschwindet. Deshalb rechnet die Kraft gegen
   * `befohleneSpreizung()` — dieselbe Formel ohne das Nachgeben.
   *
   * WARUM NICHT DIE DIFFERENZ ALLEIN DIE KRAFT IST: Sie ist ein Weg, keine
   * Kraft. In einer Hydraulik steigt der Druck, wenn der Zylinder ANSTEHT,
   * und zwar unabhaengig davon, wo er ansteht; wie weit er noch fahren
   * wollte, sagt nur, wieviel Material zwischen den Schalen liegt. Die Kraft
   * ist deshalb das Produkt aus beidem: der Stau (wieviel dazwischen ist) und
   * der Druckaufbau (wie lange der Spieler draufhaelt).
   *
   * AM GRIFF SELBST WURDE NICHTS GEAENDERT: kein Fixed Joint, keine
   * Sensorkugel, kein Schliessweg, keine Reserve. Diese Rechnung liest nur
   * mit.
   */

  /**
   * Befohlene Spreizung OHNE das Nachgeben unter Last (rad).
   *
   * Wortweise `currentSplay()`, nur mit `form.zu` statt des von der Ladung
   * angehobenen `minSplay`: Was die Hydraulik verlangt, weiss nichts davon,
   * dass etwas dazwischen liegt. Der Anschlagsprung ist mit drin, sonst waere
   * nach einem leeren Zuschnappen 0,22 s lang eine Kraft da, wo nichts ist.
   */
  private befohleneSpreizung(): number {
    return THREE.MathUtils.lerp(this.form.offen, this.form.zu, this.closure) + this.anschlagWinkel;
  }

  /**
   * Wieviel Winkel die Schalen dem Befehl schulden (rad) — die weiteste zaehlt.
   *
   * 0, wenn die Spinne frei durchfaehrt oder offen ist. Grundmass fuer die
   * Schliesskraft und der Grund, warum Zudruecken auf Luft keine Kraft macht.
   */
  get schalenStau(): number {
    const befohlen = this.befohleneSpreizung();
    let stau = 0;
    for (const w of this.clawSplayIst) stau = Math.max(stau, w - befohlen);
    return Math.max(stau, 0);
  }

  /**
   * Aufgebauter Zylinderdruck, 0 .. 1. Steigt, solange die Spinne gegen etwas
   * zudrueckt, und faellt sofort, sobald der Befehl aufhoert oder der Weg frei
   * wird.
   */
  private druck = 0;
  /** Ist der Biss noch nicht gemeldet? Verhindert ein Ereignis je Bild. */
  private bissScharf = true;

  /**
   * Schliesskraft der Spinne in Kilonewton — 0, wenn sie nichts drueckt.
   *
   * Der Wert, den andere Module lesen (HUD, Schaden, Ton). Er ist abgestuft:
   * mehr Material zwischen den Schalen und laenger gehaltener Hebel ergeben
   * mehr.
   */
  get schliesskraftKN(): number {
    return (
      this.druck *
      Math.min(this.schalenStau / this.form.nachdrueckReserve, 1) *
      Excavator.MAX_SCHLIESSKRAFT_KN
    );
  }

  /**
   * Volle Schliesskraft der Spinne (kN) — 49,05.
   *
   * Nicht gewaehlt, sondern von der Maschine abgeleitet: Spinne und Hubwerk
   * haengen an derselben Hydraulik, also am selben Druck. Bei Nennlast
   * (`NENNLAST_KG` = 5000 kg) stemmt sie 5000 · 9,81 N = 49,05 kN; dieselbe
   * Groessenordnung steht an den Schliesszylindern. Die Zahl ist der MASSSTAB,
   * nicht die Wirkung — wo die Schwelle fuer einen Schaden liegt, entscheidet
   * der Zuhoerer des Ereignisses. (SW: ueber den Faktor 1 zur Nennlast laesst
   * sich am Geraet drehen, ohne dass sich die Abstufung aendert.)
   */
  static readonly MAX_SCHLIESSKRAFT_KN = (NENNLAST_KG * 9.81) / 1000;
  /**
   * Wie lange voller Hebel braucht, bis der Druck steht (s).
   *
   * 0,7 s: laenger als der Anschlagsprung (0,22 s) und als das Schliessen
   * selbst (`CLOSE_TIME` 0,4 s), damit kein Durchschnappen und kein
   * Vorbeistreifen als Biss durchgeht; kuerzer als das Quetschen im
   * Greifsystem (`CRUSH_TIME` 1,1 s), damit die Kraft VOR der Wirkung da ist.
   */
  private static readonly DRUCK_S = 0.7;

  /**
   * Der Biss: Ein Ereignis je Koerper, sobald der Druck steht.
   *
   * Dieselbe Bauart wie `onClawSnap` und `onClawPierce` — der Bagger kennt
   * keinen Ereignisbus, main.ts haengt die eine Zeile daran:
   * `excavator.onClawBite = (e) => bus.emit("greifer:zugedrueckt", e)`.
   * Die Nutzlast IST die des Ereignisses, damit es nicht zwei Formen fuer
   * dieselbe Meldung gibt.
   *
   * Nachgelegt wird erst, wenn der Spieler den Hebel loslaesst und wieder
   * zudrueckt — pumpen statt halten, wie an der echten Maschine.
   */
  onClawBite: ((e: GameEvents["greifer:zugedrueckt"]) => void) | null = null;

  private updateSchliesskraft(dt: number): void {
    const stau = this.schalenStau;
    // Druck steht nur, solange der Spieler zudrueckt UND etwas ansteht.
    if (!this.closing || stau <= 0) {
      this.druck = 0;
      this.bissScharf = true;
      return;
    }
    this.druck = Math.min(1, this.druck + dt / Excavator.DRUCK_S);
    if (this.druck < 1 || !this.bissScharf || !this.onClawBite) return;
    this.bissScharf = false;
    const kraftKN = this.schliesskraftKN;
    // Gedrueckt wird auf alles, was vor den Schalen steht oder in ihnen haengt.
    for (const handle of this.clawFunde) this.biss(handle, kraftKN);
    for (const handle of this.grippedHandles) {
      if (!this.clawFunde.has(handle)) this.biss(handle, kraftKN);
    }
  }

  private biss(handle: number, kraftKN: number): void {
    const b = this.world.getRigidBody(handle);
    // Ein entfernter Koerper darf nicht befragt werden — das zerlegt die ganze
    // Physikwelt (E-103).
    if (!b || !b.isValid()) return;
    const p = b.translation();
    this.onClawBite?.({ handle, kraftKN, x: p.x, y: p.y, z: p.z });
  }

  private aufsetzRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });

  /**
   * Höhe der Fläche unter den Krallenspitzen — Beton, Ladefläche, Muldenboden,
   * was auch immer dort liegt.
   *
   * Vorher rechnete der Bodenanschlag gegen eine gedachte Ebene bei y = 0. Auf
   * dem Betonplatz stimmte das ungefähr; über einer Ladefläche gar nicht, und
   * die Spinne sank sichtbar durch die Mulde. Jetzt wird gemessen statt
   * angenommen: ein Strahl je Spitze, senkrecht nach unten. Maßgeblich ist die
   * höchste getroffene Fläche — an ihr setzt die Spinne auf, auch wenn nur eine
   * Kralle über der Mulde steht.
   *
   * Ausgenommen sind die eigenen Körper und die Ladung: Sonst setzte die Spinne
   * auf ihrer eigenen Kralle oder auf dem Teil auf, das sie gerade trägt.
   */
  /*
   * DER STRAHL LAEUFT DIE GREIFERACHSE ENTLANG, NICHT DIE WELTSENKRECHTE.
   *
   * Bis zum 16.09.2026 ging er senkrecht aus dem Kardangelenk nach unten. Das
   * ist dasselbe, solange der Greifer lotrecht haengt — und das tut ein frei
   * pendelnder Greifer selten. Bei 17 Grad Schraeglage und 2,75 m Tiefe liegt
   * die Korbmitte 80 cm neben dem Gelenk; der Bagger mass dort den Beton
   * neben der Mulde statt den Muldenboden und blieb ueber der Ladeflaeche
   * stehen — oder umgekehrt, er fuhr in die Bordwand.
   *
   * WAS SICH NICHT AENDERT: Der Strahl kommt weiter aus der MITTE, nicht von
   * der tiefsten Krallenspitze. Das ist eine Entscheidung von E-046 und sie
   * bleibt: „Eine Spitze, die ueber den Muldenrand hinausragt, ist eine Frage
   * der Darstellung, nicht des Anschlags." Schraeg haengend ist die Mitte nur
   * nicht mehr senkrecht unter dem Gelenk, sondern um
   *     Tiefe · sin(Neigung)
   * versetzt, in der Richtung, in die das Pendel ausschlaegt.
   *
   * Steht der Greifer lotrecht, ist der Versatz null und dieser Zweig wird
   * nicht einmal betreten: Der Strahl steht Ziffer fuer Ziffer dort, wo er
   * immer stand.
   */
  private surfaceUnderClaws(splay: number): number {
    this.grappleGroup.updateWorldMatrix(true, false);
    // EIN Strahl, aus der Mitte der Spinne senkrecht nach unten.
    //
    // Vorher waren es fuenf, einer je Spitze, und massgeblich war die hoechste
    // getroffene Flaeche. Das laesst die Spinne schweben: Steht eine einzige
    // Spitze ueber einer Bordwand, dem Chassis oder gar der Kabine, haengt der
    // ganze Greifer an dieser Hoehe fest und kommt nicht mehr an das Material
    // auf der Ladeflaeche heran. Der Kontakt soll aber hart sein — man soll das
    // Gewicht des Arms spueren, nicht ueber der Fuhre gebremst werden.
    //
    // Die Mitte ist der Punkt, mit dem der Greifer aufsetzt. Eine Spitze, die
    // ueber den Muldenrand hinausragt, ist eine Frage der Darstellung, nicht
    // des Anschlags. Nebenbei kostet das ein Fuenftel der Strahlen.
    this.aufsetzRay.origin.x = this.grappleGroup.position.x;
    this.aufsetzRay.origin.y = this.grappleGroup.position.y;
    this.aufsetzRay.origin.z = this.grappleGroup.position.z;
    if (this.neigung !== 0) {
      /*
       * Haengt der Greifer schraeg, zeigt seine Achse nicht mehr nach unten.
       * Ihr Fusspunkt — die Korbmitte in der Tiefe `tief` — liegt dann bei
       *     Gelenk + tief · pendelAchse,
       * und der Strahl soll von dort nach unten gehen, nicht vom Gelenk.
       *
       * Genommen werden nur x und z: Die HOEHE des Ansatzes bleibt die des
       * Gelenks, weil der Strahl ohnehin von oben kommt und der erste Treffer
       * derselbe ist. Eine hoehere oder tiefere Quelle waere ein zweiter
       * Eingriff in denselben Wert.
       *
       * Waagerecht versetzt ist das `tief · sin(neigung)` — bei 17 Grad und
       * 2,75 m Tiefe also 80 cm. Ohne diese Zeile fragte der Bodenanschlag im
       * Schwenk nach dem Beton, ueber dem der Greifer gar nicht mehr haengt.
       */
      const tief = BODEN_UEBER_SCHLIESSWEG ? this.form.maxTiefe : this.form.tiefe(splay);
      this.aufsetzRay.origin.x += tief * this.pendelAchse.x;
      this.aufsetzRay.origin.z += tief * this.pendelAchse.z;
    }
    const treffer = this.world.castRay(
      this.aufsetzRay,
      20,
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      (c) => {
        const b = c.parent();
        if (!b) return false;
        if (this.selfHandles.has(b.handle)) return false;
        // Die eigene Ladung ist kein Boden. Seit gefasste Teile kinematisch
        // mitgefuehrt werden, sind sie nicht mehr dynamisch — ohne diese Zeile
        // setzt die Spinne auf dem Teil auf, das sie gerade traegt, und wird
        // beim Zupacken nach oben gedrueckt.
        if (this.grippedHandles.has(b.handle)) return false;
        // NUR tragender Grund: Beton, Waende, Muldenboeden, Ladeflaechen.
        // Loser Schrott zaehlt ausdruecklich nicht — sonst setzt die Spinne
        // auf dem Haufen auf, statt hineinzugreifen.
        return !b.isDynamic();
      }
    );
    return treffer ? this.aufsetzRay.origin.y - treffer.timeOfImpact : 0;
  }

  /**
   * Wie tief stecken die Krallenspitzen gerade in losem Material?
   * (Auftrag 11.09.2026, Phase 1.4: "nicht in Materialkoerper eintauchen")
   *
   * Der Bodenanschlag oben zaehlt nur tragenden Grund — loser Schrott bleibt
   * bewusst aussen vor, sonst setzt die Spinne auf dem Haufen auf, statt
   * hineinzugreifen. Gemessen im Labor (11.09.2026) steckte dadurch eine
   * Kralle 22,8 cm tief in einem liegenden Teil, dauerhaft: Der Kontakt loest
   * sich nicht, weil das Teil am Boden liegt, hohe Reibung hat und die weichen
   * Kontaktwerte den Rest tun.
   *
   * Der erste Versuch hat den Arm bei jedem Eintauchen ueber fuenf Zentimeter
   * angehoben — und zwar je Schritt neu. Das ergab einen Regelkreis, der
   * schwingt: gemessen 39 Richtungswechsel je Sekunde bei 13 mm Ausschlag.
   * Im Spiel war das eine Naehmaschine (Befund 11.09.2026: "sie ist mehr wie
   * ein Presslufthammer beim Reingreifen").
   *
   * Jetzt gilt die Sperre nur noch gegen BROCKEN, die sich nicht beiseite
   * schieben lassen (ab EINDRING_SCHWER_KG), und sie haelt ihren Wert kurz
   * fest, statt ihn jeden Schritt neu zu suchen. In losen Haufen woehlt die
   * Spinne wieder, wie sie soll: Kleinteile werden verdraengt, nicht
   * umfahren.
   */
  private eindringtiefe(splay: number): number {
    if (this.grippedHandles.size > 0) return 0; // beim Tragen sind die Krallen aus
    this.grappleGroup.updateWorldMatrix(true, false);
    const mitte = this.grappleGroup.position;
    let tiefste = 0;
    // Teile im Umkreis einsammeln — nur die koennen ueberhaupt getroffen sein
    this.world.intersectionsWithShape(
      { x: mitte.x, y: mitte.y, z: mitte.z },
      { x: 0, y: 0, z: 0, w: 1 },
      this.eindringShape,
      (col) => {
        const b = col.parent();
        if (!b || !b.isDynamic()) return true;
        if (this.selfHandles.has(b.handle) || this.grippedHandles.has(b.handle)) return true;
        const m = this.form.magnet;
        if (m) {
          /*
           * E-152: Der Magnet hat keine Spitzen, er hat eine Unterseite — und
           * er liegt auf ALLEM auf, auch auf leichten Teilen (nichts wird
           * beiseitegeschoben, eine Scheibe drueckt flach nach unten). Geprueft
           * werden Mitte und acht Punkte am Rand der Unterseite.
           */
          for (let k = 0; k <= 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            const r = k === 8 ? 0 : m.radius * 0.9;
            this.clawA.set(Math.sin(a) * r, -m.unten, Math.cos(a) * r).applyMatrix4(this.grappleGroup.matrixWorld);
            const pr = col.projectPoint({ x: this.clawA.x, y: this.clawA.y, z: this.clawA.z }, false);
            if (!pr || !pr.isInside) continue;
            const d = Math.hypot(pr.point.x - this.clawA.x, pr.point.y - this.clawA.y, pr.point.z - this.clawA.z);
            if (d > tiefste) tiefste = d;
          }
          return true;
        }
        // Was sich schieben laesst, wird geschoben — nicht umfahren
        if (b.mass() < EINDRING_SCHWER_KG) return true;
        for (let c = 0; c < this.form.schalen; c++) {
          const a = (c / this.form.schalen) * Math.PI * 2;
          this.form.punkt(a, this.clawSplayIst[c] ?? splay, this.form.stationen, this.clawA);
          this.clawA.applyMatrix4(this.grappleGroup.matrixWorld);
          const pr = col.projectPoint(
            { x: this.clawA.x, y: this.clawA.y, z: this.clawA.z },
            false
          );
          if (!pr || !pr.isInside) continue;
          const d = Math.hypot(
            pr.point.x - this.clawA.x,
            pr.point.y - this.clawA.y,
            pr.point.z - this.clawA.z
          );
          if (d > tiefste) tiefste = d;
        }
        return true;
      }
    );
    return tiefste;
  }

  private eindringShape = new RAPIER.Ball(2.0);
  /** Liegt die Spinne auf? Dann sperrt die Abwaertsrichtung im naechsten Schritt. */
  private bodenSperre = false;
  private bodenSperreS = 0;
  /** E-137: Hoehe der Spitze, als sie zuletzt auflag */
  private sperreY = -Infinity;
  /** Festgehaltener Anschlag gegen Brocken und seine Restzeit */
  private eindringGrenze = 0;
  private eindringHaltS = 0;

  private resolveGroundClamp(): void {
    // Spitzentiefe direkt aus der Krallengeometrie — so bleibt der Bodenanschlag
    // richtig, auch wenn sich Form oder Öffnungswinkel ändern.
    /*
     * DIE AUSLADUNG, NICHT DIE TIEFE.
     *
     * `form.maxTiefe` ist eine Laenge LAENGS DER GREIFERACHSE. Solange der
     * Greifer lotrecht haengt, ist sie dasselbe wie „so weit langt er nach
     * unten"; haengt er schraeg, ist sie es nicht. Gemessen: Bei 90 Grad
     * Schraeglage faellt die wirkliche Ausladung der Sichelkralle von 3,00 auf
     * 1,77 m — mit `maxTiefe` bliebe der Arm 1,23 m zu hoch stehen.
     *
     * OB der Winkel aus dem Pendel kommt, entscheidet
     * `ANSCHLAG_FOLGT_PENDEL` — dort steht auch, was es kostet, und warum es
     * heute auf `false` steht.
     *
     * `maxAusladung(0)` gibt `maxTiefe` zurueck, ungerechnet. Der
     * Bodenanschlag bei lotrechtem Greifer bleibt damit auf seiner Hoehe —
     * Sichelkralle 6,37 cm, Fuenfschalengreifer 20,44 cm.
     *
     * DIE NAEHERUNG, die dabei steckt, und warum sie nach der sicheren Seite
     * faellt: `ausladung(winkel, θ)` legt die Schraeglage in die LOKALE
     * x-Achse des Greifers, das Pendel kann aber in jede Himmelsrichtung
     * ausschlagen. Der Unterschied ist, welche Schale dabei unten liegt.
     * Gerechnet wird ueber alle Schalen mit `cos(Umfangswinkel)`, und der
     * groesste Beitrag faellt auf die Schale bei 0° — das ist der GROESSTE
     * Wert ueber alle Himmelsrichtungen. Der Arm haelt damit hoechstens zu
     * frueh an, nie zu spaet. Die Spanne ist der Umfangsabstand der Schalen:
     * zwischen `cos 0° = 1` und `cos 36° = 0,809`, also hoechstens ein
     * Fuenftel des Schraeglagenanteils.
     */
    const splay = this.currentSplay();
    const achswinkel = ANSCHLAG_FOLGT_PENDEL ? this.neigung : 0;
    const tipDepth = BODEN_UEBER_SCHLIESSWEG
      ? this.form.maxAusladung(achswinkel)
      : this.form.ausladung(splay, achswinkel);
    // Gemessene Fläche statt angenommener Ebene: darauf setzt die Spinne auf.
    const flaeche = this.surfaceUnderClaws(splay);
    // tipY() rechnet ab der Maschinenbasis; steht die Maschine aufgebockt,
    // ist der Boden entsprechend weiter unten
    let minTipY = flaeche + tipDepth + 0.02 - this.position.y;
    /*
     * Brocken unter den Spitzen: ein Stueck Biss ja, durchtauchen nein. Der
     * gefundene Anschlag wird kurz festgehalten (EINDRING_HALT_S) — sonst
     * sucht die Regelung ihn jeden Schritt neu und faengt an zu schwingen.
     */
    const tipYJetzt =
      BOOM_PIVOT.y +
      BOOM_LEN * Math.sin(this.boomAngle) +
      STICK_LEN * Math.sin(this.boomAngle + this.stickAngle);
    /*
     * E-137: ANHALTEN, NICHT ANHEBEN. Hier stand `tipYJetzt + (tief -
     * EINDRING_OK)`: Der Arm wurde um die Eindringtiefe HOCHGESETZT, alle
     * 0,35 s neu. `tief` ist aber der Abstand zur NAECHSTEN Flaeche der Huelle
     * — oft eine Seitenwand, die das Anheben nicht naeher bringt —, und die
     * kinematischen Krallen lupfen das Teil dabei mit. Gemessen
     * (`tools/grossteil-greifen.ts`, Rumpfsegment 800 kg): Grenze 3,01 → 3,08
     * → 3,12 → 3,22 → 3,36 → 3,43 → 3,51 m, Spinne +1,53 m, waehrend der
     * Spieler den Ausleger SENKTE — die Sperre liess ihn nicht. Jetzt haelt
     * der Brocken die Spinne dort an, wo sie ihn trifft; hoeher setzt er sie
     * nie.
     */
    let eindringStopp = false;
    if (this.eindringHaltS > 0) {
      this.eindringHaltS -= 1 / 60;
      minTipY = Math.max(minTipY, this.eindringGrenze);
    } else {
      const tief = this.eindringtiefe(splay);
      if (tief > (this.form.magnet ? MAGNET_AUFLAGE_M : EINDRING_OK)) {
        this.eindringGrenze = tipYJetzt;
        this.eindringHaltS = EINDRING_HALT_S;
        minTipY = Math.max(minTipY, this.eindringGrenze);
        eindringStopp = true;
      }
    }
    const tipY = () =>
      BOOM_PIVOT.y +
      BOOM_LEN * Math.sin(this.boomAngle) +
      STICK_LEN * Math.sin(this.boomAngle + this.stickAngle);

    /*
     * Totband: Erst ab gut einem Zentimeter Verletzung wird nachgeregelt.
     * Ohne das korrigiert die Mechanik jede Kleinigkeit, die der Messstrahl
     * zwischen zwei Schritten anders sieht — und genau daraus entsteht das
     * Zittern (gemessen 39, danach noch 15 Richtungswechsel je Sekunde).
     */
    let clamped = false;
    let guard = 0;
    while (tipY() < minTipY - BODEN_TOLERANZ && guard++ < 80) {
      clamped = true;
      const total = this.boomAngle + this.stickAngle;
      const dStick = STICK_LEN * Math.cos(total);
      const canStick =
        Math.abs(dStick) > 0.4 &&
        ((dStick > 0 && this.stickAngle < STICK_MAX - 0.002) ||
          (dStick < 0 && this.stickAngle > STICK_MIN + 0.002));
      if (canStick) {
        this.stickAngle += Math.sign(dStick) * 0.004;
      } else if (this.boomAngle < BOOM_MAX - 0.002) {
        this.boomAngle += 0.004;
      } else {
        break;
      }
    }

    /*
     * Aufliegen heisst: nicht weiter nach unten. Bisher wurde erst
     * integriert und danach zurueckgeschoben — das ergab je Schritt einen
     * Ruck von einigen Millimetern hin und zurueck, gemessen 39
     * Richtungswechsel je Sekunde bei 13 mm Ausschlag. Im Spiel war das eine
     * Naehmaschine (Befund 11.09.2026).
     *
     * Jetzt merkt sich die Maschine den Anschlag, und die Achsen kommen im
     * naechsten Schritt gar nicht erst in diese Richtung los — so wie ein
     * Zylinder am Ende seines Hubs steht.
     */
    // Die Sperre haelt kurz nach, damit sie nicht im Sekundentakt auf- und
    // zugeht, wenn der Messstrahl mal danebentrifft.
    if (clamped || tipY() < minTipY + BODEN_TOLERANZ) {
      this.bodenSperreS = BODEN_SPERRE_S;
      this.sperreY = tipY();
    } else this.bodenSperreS = Math.max(0, this.bodenSperreS - 1 / 60);
    /*
     * E-137: WER WIRKLICH ABGEHOBEN HAT, DARF SOFORT WIEDER SENKEN. Die
     * Nachhaltezeit gilt dem Messstrahl, der mal danebentrifft — dabei steht
     * die Spitze still. Ist sie dagegen `BODEN_FREI_M` ueber der Stelle, an
     * der sie zuletzt auflag, liegt nichts mehr auf. Gemessen
     * (`tools/haemmern.ts 8`, 8 Bilder heben je Schlag): 32 Bilder war das
     * Senken in der Luft gesperrt — Patricks „die spinne bremst beim
     * hämmern ab". Dasselbe fuer den festgehaltenen Brocken-Anschlag.
     */
    if (tipY() > this.sperreY + BODEN_FREI_M) this.bodenSperreS = 0;
    if (this.eindringHaltS > 0 && tipY() > this.eindringGrenze + BODEN_FREI_M) this.eindringHaltS = 0;
    this.bodenSperre = this.bodenSperreS > 0;
    if (clamped || eindringStopp) {
      // abwärts gerichtete Achsgeschwindigkeiten hart stoppen
      const total = this.boomAngle + this.stickAngle;
      const dBoom = BOOM_LEN * Math.cos(this.boomAngle) + STICK_LEN * Math.cos(total);
      const dStick = STICK_LEN * Math.cos(total);
      if (this.boomVel * dBoom < 0) this.boomVel = 0;
      if (this.stickVel * dStick < 0) this.stickVel = 0;
    }
    // Kontakt gilt auch beim Aufliegen (Spitzen ruhen auf dem Boden), nicht nur
    // beim aktiven Hineindrücken — sonst bleibt das Kratzen beim Drehen stumm.
    const resting = tipY() < minTipY + 0.04;
    this.groundContact.active = clamped || resting;
    this.groundContact.intensity = this.groundContact.active
      ? Math.min(1, (Math.abs(this.cabVel) * 9 + Math.abs(this.driveVel) * 1.5) / 3)
      : 0;
    // E-134: Aufschlag mit Last erkennen — liest nur, aendert nichts am Arm
    this.spitzeAbwaerts = this.spitzeYAlt === null ? 0 : (this.spitzeYAlt - tipYJetzt) * 60;
    this.spitzeYAlt = tipY();
    const traegt = this.grippedHandles.size > 0;
    const aufSchrott = traegt && !this.groundContact.active && this.ladungAufSchrott();
    const tempo = this.aufschlag.schritt(1 / 60, traegt && (this.groundContact.active || aufSchrott), this.spitzeAbwaerts);
    if (tempo !== null) this.onAufschlag?.(tempo, aufSchrott);
    if (!traegt) this.meldeSpinne(tipDepth);
  }

  /**
   * E-137: Haemmern und Druecken mit der leeren Spinne melden. Liest nur —
   * Kontakt ist der Bodenanschlag (tragender Grund) oder ein Rapier-Kontakt
   * der Schalen mit einem losen Koerper (`collision.beruehrt`).
   */
  private meldeSpinne(tipDepth: number): void {
    const dt = 1 / 60;
    const koerper = this.groundContact.active ? null : this.collision.beruehrt(0, 0, 0, false);
    const kontakt = this.groundContact.active || koerper !== null;
    const g = this.grappleGroup.position;
    const ort = this.spinnenOrt.set(g.x, g.y - tipDepth, g.z);
    const tempo = this.spinnenSchlag.schritt(dt, kontakt, this.spitzeAbwaerts);
    if (tempo !== null) {
      this.onSpinneAufschlag?.(Math.min(tempo / SPINNE_WUCHT_VOLL_MS, 1), koerper?.handle ?? null, ort);
    }
    this.drueckPauseS = Math.max(0, this.drueckPauseS - dt);
    // Gedrueckt wird auf lose Teile; tragender Grund gibt nicht nach — dort bleibt es still
    if (koerper === null || this.senkBefehl < DRUECK_AB) {
      this.drueckt = false;
      this.drueckRefHandle = undefined;
      return;
    }
    const h = koerper?.handle ?? null;
    let melden = false;
    if (!this.drueckt) {
      // Ansetzen: auf ein loses Teil einmal — nicht im selben Bild wie ein
      // Schlag (der knallt schon) —, auf tragendem Grund nie
      this.drueckt = true;
      melden = h !== null && tempo === null && this.drueckPauseS <= 0;
      if (tempo !== null) this.drueckPauseS = DRUECK_PAUSE_S;
    } else if (this.drueckPauseS <= 0) {
      // Danach nur, wenn das Material nachgibt: die Spitze sinkt, das Teil
      // wandert oder die Spinne liegt jetzt auf einem anderen
      const t = koerper?.translation();
      melden =
        this.drueckRefY - ort.y > DRUECK_WEG_M ||
        h !== this.drueckRefHandle ||
        (!!t && Math.hypot(t.x - this.drueckRefPos.x, t.y - this.drueckRefPos.y, t.z - this.drueckRefPos.z) > DRUECK_WEG_M);
    } else return;
    if (!melden && this.drueckRefHandle !== undefined) return;
    // Bezug fuer „gibt nach": hier und jetzt
    this.drueckRefY = ort.y;
    this.drueckRefHandle = h;
    const t = koerper?.translation();
    if (t) this.drueckRefPos.set(t.x, t.y, t.z);
    if (melden) {
      this.drueckPauseS = DRUECK_PAUSE_S;
      this.onSpinneDruecken?.(Math.min(this.senkBefehl, 1), h, ort);
    }
  }

  /**
   * E-134: Beruehrt die Last gerade losen Schrott? Gefragt werden die
   * Kontakte, die Rapier im letzten Schritt ohnehin berechnet hat (kinematisch
   * gegen dynamisch) — keine zweite Kontaktrechnung. Nur lesen (v2 E-044).
   */
  private ladungAufSchrott(): boolean {
    let ja = false;
    for (const h of this.grippedHandles) {
      const b = this.world.getRigidBody(h);
      if (!b) continue;
      for (let i = 0; i < b.numColliders() && !ja; i++) {
        const c = b.collider(i);
        this.world.contactPairsWith(c, (o) => {
          if (ja) return;
          const ob = o.parent();
          if (!ob || !ob.isDynamic() || this.grippedHandles.has(ob.handle)) return;
          this.world.contactPair(c, o, (m) => {
            for (let k = 0; k < m.numContacts(); k++) if (m.contactDist(k) < 0.01) ja = true;
          });
        });
      }
      if (ja) break;
    }
    return ja;
  }

  private syncMeshes(): void {
    this.root.position.copy(this.position);
    this.root.rotation.y = this.heading;
    this.cabGroup.rotation.y = this.cabYaw;
    /*
     * Kabine: hoch UND ein Stück nach vorn — seit E-040 auf einem Kreisbogen
     * um die Lenkerwelle statt auf einer Geraden.
     *
     * `hubVersatz` liefert in `y` exakt die Hubhöhe zurück; unten und ganz
     * oben steht die Kabine deshalb auf den Millimeter da, wo sie stand.
     * Nur dazwischen läuft sie den Bogen (bis 0,60 m Abweichung, E-025
     * Frage 3, von Patrick mitentschieden).
     */
    this.cabLiftGroup.position.copy(hubVersatz(this.cabLift, this.tmpA));
    this.cabPivot.rotation.x = -hubWinkel(this.cabLift);
    /*
     * Räder: rollen (X) und lenken (Y). Die Seitenlage (Z) steht seit dem Bau
     * fest. Die Drehreihenfolge `YXZ` ist dafür Voraussetzung — sie wird beim
     * Anlegen gesetzt, siehe `buildMeshes`.
     */
    for (const w of this.wheelGroups) {
      w.gruppe.rotation.x = this.wheelSpin;
      w.gruppe.rotation.y = w.vorn ? this.steerAngle : 0;
    }
    for (const g of this.outriggerGroups) {
      g.position.y = (1 - this.outriggerDown) * 0.72; // eingefahren = angehoben
    }
    // Schild: gesenkt sitzt die Schneide knapp über dem Beton
    if (this.bladeGroup) {
      this.bladeGroup.position.y = (1 - this.bladeDown) * BLADE_UP_Y;
      this.bladeGroup.rotation.x = (1 - this.bladeDown) * 0.35; // gehoben angewinkelt
    }
    this.boomGroup.rotation.x = -this.boomAngle;
    this.stickGroup.rotation.x = -this.stickAngle;

    // Greifer lotrecht unter die Stielspitze setzen
    const tip = new THREE.Vector3();
    this.stickTip.getWorldPosition(tip);
    this.grappleGroup.position.copy(tip);
    this.grappleGroup.rotation.set(0, this.heading + this.cabYaw + this.rotatorYaw, 0);
    /*
     * Die Schraeglage des Pendels muss AUCH HIER stehen, nicht nur in
     * `integratePendulum`. Zwischen `syncMeshes` und dem Pendel laeuft
     * `resolveGroundClamp`, und darin fragt `eindringtiefe` die Weltmatrix des
     * Greifers ab, um die Krallenspitzen in Brocken zu suchen. Ohne diese
     * Zeile suchte sie dort, wo die Spitzen bei lotrechtem Greifer waeren.
     *
     * Genommen wird die Drehung des LETZTEN Bildes (`qPendel`) — das Pendel
     * rechnet erst am Ende von `update`. Ein Bild Verzug sind 17 ms; die
     * Alternative waere, das Pendel vorzuziehen und damit die Reihenfolge
     * „erst Pose, dann Aufsetzen" umzudrehen, die den Bodenanschlag ueberhaupt
     * erst ruhig gemacht hat.
     *
     * Bei `neigung === 0` bleibt die Zeile aus, und `syncMeshes` tut Ziffer
     * fuer Ziffer dasselbe wie vor dem Umbau.
     */
    if (this.neigung !== 0) this.grappleGroup.quaternion.premultiply(this.qPendel);

    // Zacken: offen weit gespreizt. Geschlossen fügen sich die Schalen zur
    // dichten Kalotte — es sei denn, es liegt Material darin: dann bleibt die
    // Spinne so weit offen, wie die Ladung Platz braucht.
    /*
     * Jede Schale bekommt ihren eigenen Winkel; wie er in eine Drehung
     * umgesetzt wird, weiss nur die Form (`Greiferbau.setWinkel`). Bei der
     * Sichelkralle ist das -Spreizung, nicht -(Spreizung - ZU): Die
     * Segmentkette ist bei Spreizung 0 gebaut. Solange „zu" die Spreizung 0
     * war, war beides dasselbe und der Abzug fiel nicht auf. Am Zapfen ist
     * „zu" 0,5495 — die gezeichnete Kralle stand damit 31 Grad weiter zu als
     * die gerechnete.
     */
    for (let i = 0; i < this.form.schalen; i++) {
      this.greiferbau.setWinkel(i, this.clawSplayIst[i] ?? this.currentSplay());
    }
    this.updateClawColliders();

    this.updateHydraulics();

    this.greiferbau.nachfuehren();

    // Joysticks samt Unterarmen kippen genau so, wie der Spieler steuert:
    // links Hauptarm und Oberwagen, rechts Ausleger und Spinne. Vorher stand
    // hier noch die alte Belegung, weshalb die Hände nicht zur Bewegung passten.
    if (this.joyLeft && this.joyRight) {
      const tilt = 0.35;
      // Achse hoch (+1) → Hebel nach vorn, wie beim Wischen nach oben
      this.joyLeft.rotation.x = this.inBoom * tilt;
      this.joyLeft.rotation.z = this.inCab * tilt; // rechts = Oberwagen rechts
      this.joyRight.rotation.x = this.inStick * tilt;
      this.joyRight.rotation.z = this.inGrapple * tilt; // rechts = schließen
      this.armeFolgen();
    }
  }

  /**
   * Gedämpftes Pendel am Kardan-Gelenk (Design-Wunsch 2026-08-27): Die Spinne
   * schwenkt aus, angetrieben von der Beschleunigung der Stielspitze —
   * Fliehkraft beim Drehen, Ruck beim Anfahren/Stoppen. Schwere Last pendelt
   * länger nach (weniger Dämpfung). Am Boden aufliegend beruhigt sie sich sofort.
   */
  private integratePendulum(dt: number): void {
    const tip = this.grappleGroup.position;
    if (!this.pendulumInit) {
      this.prevTip.copy(tip);
      this.pendulumInit = true;
    }
    const velX = (tip.x - this.prevTip.x) / dt;
    const velZ = (tip.z - this.prevTip.z) / dt;
    // Teleport (Tests/Spawns): Pendel nicht mit Riesenimpuls füttern
    if (Math.hypot(velX, velZ) > 30) {
      this.swingVel.set(0, 0);
      this.prevTipVel.set(velX, 0, velZ);
      this.prevTip.copy(tip);
      return;
    }
    const CAP = 15; // m/s² (SW)
    const ax = THREE.MathUtils.clamp((velX - this.prevTipVel.x) / dt, -CAP, CAP);
    const az = THREE.MathUtils.clamp((velZ - this.prevTipVel.z) / dt, -CAP, CAP);
    this.prevTipVel.set(velX, 0, velZ);
    this.prevTip.copy(tip);

    /*
     * Die Beschleunigung wird zweimal aus Positionsdifferenzen gebildet, und
     * das rauscht: Gemessen am 11.09.2026 zitterte die Spinne im gleichmaessigen
     * Schwenk um ±3,5 Grad, obwohl ein gedaempftes Pendel unter
     * gleichbleibender Fliehkraft ruhig stehen muss. Das war Zahlenrauschen,
     * keine Physik. Darum wird die Beschleunigung geglaettet, bevor sie das
     * Pendel antreibt.
     */
    const glatt = Math.min(dt / ACC_GLAETTUNG_S, 1);
    this.tipAcc.x += (ax - this.tipAcc.x) * glatt;
    this.tipAcc.y += (az - this.tipAcc.y) * glatt;

    const L = PENDEL_L;
    const G = PENDEL_G;
    /*
     * Rueckstellung: Schwerkraft **und** Gelenk.
     *
     * Ein frei haengendes Pendel stellt sich bei 45 Grad Schwenk auf gut
     * 27 Grad schraeg (gemessen) — rechnerisch richtig, sieht aber aus wie
     * eine Abrissbirne. Eine echte Spinne haengt nicht frei: Im Kardangelenk
     * sitzt Reibung, und der Schlauchbaum zieht sie zurueck. Das ist hier als
     * zusaetzliche Rueckstellung modelliert; sie halbiert den Ausschlag,
     * ohne das Pendeln als solches wegzunehmen.
     */
    const rueck = (G / L) * (1 + GELENK_STEIFE);
    // schwere Last: weniger Dämpfung → längeres Nachpendeln (SW)
    const damping = THREE.MathUtils.lerp(
      PENDEL_DAEMPFUNG_LEER,
      PENDEL_DAEMPFUNG_LAST,
      Math.min(this.carriedMassKg / NENNLAST_KG, 1)
    );
    this.swingVel.x +=
      (-rueck * Math.sin(this.swing.x) - damping * this.swingVel.x + this.tipAcc.y / L) * dt;
    this.swingVel.y +=
      (-rueck * Math.sin(this.swing.y) - damping * this.swingVel.y - this.tipAcc.x / L) * dt;
    /*
     * OHNE DECKEL (17.09.2026, Ansage Patrick). Hier stand ein `clamp` auf
     * ±17 Grad je Achse; der Begruendungstext steht oben bei den Konstanten.
     *
     * Dass die Zahl trotzdem nicht davonlaeuft, steckt in der Zeile darueber:
     * Die Rueckstellung geht mit `sin(Ausschlag)` und ist damit periodisch —
     * es gibt keinen Term, der mit dem Winkel waechst und ihn aufschaukeln
     * koennte. Gemessen (`tools/pendelausschlag.ts`) bleibt der groesste
     * Ausschlag im vollen Schwenk bei 20,2 Grad, und 30 s Dauerschwenk bleiben
     * unter 60.
     */
    this.swing.x += this.swingVel.x * dt;
    this.swing.y += this.swingVel.y * dt;
    if (this.groundContact.active) {
      this.swing.multiplyScalar(0.75);
      this.swingVel.multiplyScalar(0.5);
    }

    const yaw = this.heading + this.cabYaw + this.rotatorYaw;
    const qYaw = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
    this.qPendel.setFromEuler(this.pendelEuler.set(this.swing.x, 0, this.swing.y));
    this.grappleGroup.quaternion.copy(this.qPendel).multiply(qYaw);
    /*
     * Und die Greiferachse fortschreiben — EINMAL, aus derselben Drehung, die
     * gerade den Greifer gedreht hat.
     *
     * Der Rotator (`qYaw`) steht rechts und dreht nur um die Hochachse; auf
     * die Richtung der Greiferachse hat er keinen Einfluss. Deshalb reicht
     * `qPendel`.
     *
     * DAS TOTBAND ist die Stelle, an der der lotrechte Greifer entsteht.
     * Ein gerechnetes Pendel trifft die Null nie exakt: Es bleibt immer ein
     * Rest von Tausendstelgrad stehen, und ohne Totband liefe der Bagger
     * dauerhaft durch den schraegen Rechenweg — teurer, und die Zusage „bei
     * lotrechtem Greifer Ziffer fuer Ziffer wie vorher" waere im laufenden
     * Spiel nie eingeloest. Was das Totband kostet, steht bei
     * `NEIGUNG_TOTBAND`.
     */
    this.pendelAchse.set(0, -1, 0).applyQuaternion(this.qPendel);
    const roh = Math.acos(THREE.MathUtils.clamp(-this.pendelAchse.y, -1, 1));
    if (roh < NEIGUNG_TOTBAND) {
      this.pendelAchse.set(0, -1, 0);
      this.neigung = 0;
    } else {
      this.neigung = roh;
    }
  }

  private qPendel = new THREE.Quaternion();
  private pendelEuler = new THREE.Euler();

  /** E-152: waagrechter Abstand Stielende ↔ Drehmitte (m) — die Ausladung der Traglasttabelle. */
  get ausladungM(): number {
    const g = this.grappleGroup.position;
    return Math.hypot(g.x - this.position.x, g.z - this.position.z);
  }

  /**
   * E-152/E-156: Was jetzt an den Greifer darf (kg) — Traglasttabelle bei
   * dieser Ausladung, mal Ausbau, minus Anbaugeraet; frei stehend zwei
   * Drittel davon (E-154). Ausladung: Stielende (Kardangelenk, an dem die
   * Last haengt) zur Drehmitte (`traglast.ts`).
   */
  get traglastKg(): number {
    return nutzlastKg(
      this.ausladungM,
      this.form.eigengewichtKg,
      this.greifsystem?.getCapacityBonus?.() ?? 1,
      this.abgestuetzt
    );
  }

  /**
   * E-154: Steht die Maschine auf den Pratzen? Erst ganz ausgefahren — auf
   * halbem Weg traegt noch das Fahrwerk. Die Grenze wechselt damit in einem
   * Bild, und weil die Ueberlastsperre jedes Bild neu rechnet (kein
   * gespeicherter Zustand), wird beim Ausfahren sofort mehr frei und beim
   * Einfahren sofort gesperrt.
   */
  get abgestuetzt(): boolean {
    return this.outriggerDown >= 1 - 1e-6;
  }

  /**
   * E-152: Die Ueberlastsperre einer echten Umschlagmaschine (EN 474-5).
   *
   * Haengt mehr in der Spinne, als die Tabelle hier erlaubt, stoppt die
   * Hydraulik Ausleger-Heben und Stiel-Ausfahren. Absenken, Heranziehen,
   * Schwenken und Fahren bleiben: So holt man eine schwere Last naeher an die
   * Maschine und hebt sie dort. Zurueckgenommen werden nur Ausleger und
   * Stiel, auf die Stellung des letzten Bildes.
   *
   * Vorher (E-137-Stand): Die Spinne griff ein Teil ueber 3,5 t gar nicht erst
   * und sagte nichts — „beim heben passiert nichts".
   */
  private ueberlastSperre(prevBoom: number, prevStick: number, prevPos: THREE.Vector3, traegt: boolean): void {
    const last = this.carriedMassKg;
    if (!traegt || last <= 0) {
      this.ueberlast = false;
      this.ueberlastGemeldet = false;
      return;
    }
    const grenze = this.traglastKg;
    this.ueberlast = last > grenze;
    /*
     * Gesperrt wird je Achse, wie an der Maschine: der Ausleger HEBT nicht
     * (Winkel steigt), der Stiel FAEHRT NICHT AUS (Winkel steigt). Ausleger
     * senken und Stiel heranziehen gehen immer — auch wenn das Heranziehen
     * das Stielende dabei etwas hebt; das Kippmoment wird kleiner.
     */
    const hebt = this.boomAngle > prevBoom + UEBERLAST_TOT_RAD;
    const aus = this.stickAngle > prevStick + UEBERLAST_TOT_RAD;
    if (!this.ueberlast || (!hebt && !aus)) {
      this.ueberlastGemeldet = false;
      return;
    }
    const h = this.halt;
    const rAlt = Math.hypot(h.gPos.x - prevPos.x, h.gPos.z - prevPos.z);
    if (hebt) {
      this.boomAngle = prevBoom;
      this.boomVel = 0;
    }
    if (aus) {
      this.stickAngle = prevStick;
      this.stickVel = 0;
    }
    this.armBlocked = true;
    this.syncMeshes();
    if (this.ueberlastGemeldet) return;
    this.ueberlastGemeldet = true;
    this.onUeberlast?.({ massKg: last, grenzeKg: grenze, ausladungM: rAlt, abgestuetzt: this.abgestuetzt });
  }

  /**
   * E-145: Gehaltene Teile bleiben an Waenden.
   *
   * Erst wenn die Pose des Bildes ganz feststeht — Fahrwerk, Arm, Rotator und
   * Pendel —, wird gefragt, ob ein gehaltenes Teil dadurch tiefer in Festes
   * kaeme (`ExcavatorCollision.gehaltenesStoesstAn`). Zwei Stufen:
   *
   *  1. Nur das Pendel zuruecknehmen. Die Last lehnt dann an der Wand und
   *     schwingt nicht hinein, der Arm folgt weiter dem Hebel. Ohne diese
   *     Stufe hielte das zurueckschwingende Pendel jede Bewegung fest — auch
   *     das Wegschwenken (gemessen: Spinne kam 4 mm statt Meter zurueck).
   *  2. Reicht das nicht, ALLES zuruecknehmen, was die Spinne bewegt hat:
   *     Arm, Oberwagen, Rotator, Fahrwerk. Das Auto schlaegt an und bleibt
   *     davor.
   *
   * Nur angehalten, nie angehoben (vgl. E-137): Die Spinne geht hoechstens
   * auf die Stellung des letzten Bildes zurueck.
   */
  private haltAnWand(
    prevBoom: number,
    prevStick: number,
    prevCabYaw: number,
    prevPos: THREE.Vector3
  ): void {
    const h = this.halt;
    const gehalten = this.greifsystem!.gehalten;
    const stoesstAn = (): boolean =>
      this.collision.gehaltenesStoesstAn(
        gehalten,
        h.gPos,
        h.gQuat,
        this.grappleGroup.position,
        this.grappleGroup.quaternion
      );
    if (!stoesstAn()) return;
    this.lastAnWand = true;
    // Stufe 1: das Pendel steht, die Last lehnt an
    this.swing.copy(h.swing);
    this.swingVel.set(0, 0);
    this.qPendel.copy(h.qPendel);
    this.neigung = h.neigung;
    this.pendelAchse.copy(h.achse);
    this.pendelNachsetzen();
    if (!stoesstAn()) return;
    // Stufe 2: die ganze Bewegung des Bildes zurueck
    this.armBlocked = true;
    this.boomAngle = prevBoom;
    this.stickAngle = prevStick;
    this.cabYaw = prevCabYaw;
    this.rotatorYaw = this.rotatorOk;
    this.lastRotatorYaw = this.rotatorYaw;
    this.position.x = prevPos.x;
    this.position.z = prevPos.z;
    this.wheelSpin = h.wheelSpin;
    this.boomVel = 0;
    this.stickVel = 0;
    this.cabVel = 0;
    this.driveVel = 0;
    this.syncMeshes();
    this.pendelNachsetzen();
  }

  /** Greiferdrehung wie `integratePendulum` (Pendel mal Gierung, auch im Totband); die Last steht. */
  private pendelNachsetzen(): void {
    this.grappleGroup.quaternion
      .setFromEuler(this.pendelEuler.set(0, this.heading + this.cabYaw + this.rotatorYaw, 0))
      .premultiply(this.qPendel);
    // kein Ruck fuers Pendel im naechsten Bild
    this.prevTip.copy(this.grappleGroup.position);
    this.prevTipVel.set(0, 0, 0);
    this.tipAcc.set(0, 0);
  }

  private syncBodies(): void {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.heading, 0));
    this.chassisBody.setNextKinematicTranslation({
      x: this.position.x,
      y: this.position.y + 1.15,
      z: this.position.z,
    });
    this.chassisBody.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });

    // Schildkörper der Weltpose des Schildmeshes nachführen
    this.bladeGroup.updateWorldMatrix(true, false);
    this.bladeGroup.getWorldPosition(this.tmpA);
    this.bladeGroup.getWorldQuaternion(this.tmpQuat);
    this.bladeBody.setNextKinematicTranslation({
      x: this.tmpA.x,
      y: this.tmpA.y,
      z: this.tmpA.z,
    });
    this.bladeBody.setNextKinematicRotation({
      x: this.tmpQuat.x,
      y: this.tmpQuat.y,
      z: this.tmpQuat.z,
      w: this.tmpQuat.w,
    });

    // Arm-Kollider den Meshes nachführen
    for (const [mesh, body] of [
      [this.boomMesh, this.boomBody],
      [this.stickMesh, this.stickBody],
    ] as const) {
      mesh.updateWorldMatrix(true, false);
      mesh.getWorldPosition(this.armPos);
      mesh.getWorldQuaternion(this.armQuat);
      body.setNextKinematicTranslation(this.armPos);
      body.setNextKinematicRotation({
        x: this.armQuat.x,
        y: this.armQuat.y,
        z: this.armQuat.z,
        w: this.armQuat.w,
      });
    }

    const gq = this.grappleGroup.quaternion;
    this.grappleBody.setNextKinematicTranslation({
      x: this.grappleGroup.position.x,
      y: this.grappleGroup.position.y,
      z: this.grappleGroup.position.z,
    });
    this.grappleBody.setNextKinematicRotation({ x: gq.x, y: gq.y, z: gq.z, w: gq.w });
  }

  /**
   * Wie viel Gewalt gerade auf eine gefasste Baugruppe wirkt (0..1).
   *
   * Das Drehen der Spinne zählt am stärksten — genau damit reißt man einen
   * Motor aus seiner Aufhängung. Dazu kommt die Bewegung von Ausleger, Stiel
   * und Oberwagen, also das Reißen mit dem ganzen Arm.
   */
  get tearViolence(): number {
    const dreh = Math.min(Math.abs(this.rotatorVel) / 0.9, 1);
    const arm =
      (Math.abs(this.boomVel) / BOOM_RATE +
        Math.abs(this.stickVel) / STICK_RATE +
        Math.abs(this.cabVel) / CAB_MAX) /
      3;
    return Math.min(1, dreh * 0.7 + arm * 0.5);
  }

  /** Achs-Aktivität 0..1 — treibt Motor-/Hydrauliksound (Kap. 15). */
  get activity(): number {
    return Math.min(
      1,
      Math.abs(this.driveVel) / DRIVE_MAX +
        Math.abs(this.cabVel) / CAB_MAX +
        Math.abs(this.boomVel) / BOOM_RATE +
        Math.abs(this.stickVel) / STICK_RATE
    );
  }

  /** Weltposition des Greif-Sensors (zwischen den Fingerspitzen) — pendelt mit. */
  private instruments!: InstrumentPanel;

  /**
   * Bordinstrument: eine Leinwand-Textur auf einer Platte an der rechten
   * Säule. Sie wird viermal je Sekunde neu gezeichnet — häufiger bringt nichts
   * und kostet nur Zeit.
   */
  /**
   * Räumschild vorn am Unterwagen (Design-Wunsch 29.08.2026).
   *
   * Abgesenkt lässt sich damit loser Schrott vor der Maschine
   * zusammenschieben — das spart viele Einzelgriffe beim Aufräumen. Gehoben
   * hängt es angewinkelt über dem Boden und stört nicht.
   */
  private buildBlade(
    dark: THREE.Material,
    frame: THREE.Material,
    rod: THREE.Material
  ): void {
    const g = new THREE.Group();
    g.position.set(0, 0, BLADE_Z);
    g.name = "01_RAEUMSCHILD";
    this.root.add(g);
    this.bladeGroup = g;

    /*
     * Schild und Schneide — ZWEI Netze für 16 Teile (Konzept 01x).
     *
     * Vorher waren es zehn: Blatt, Schneide, zwei Wangen, zwei Streben, zwei
     * Zylinder, zwei Kolbenstangen. Alle schwenken gemeinsam auf und ab; keins
     * bewegt sich gegen ein anderes. Neu sind vier Augen und zwei Bolzen an
     * den Anlenkpunkten. Teil für Teil in `schildParts.ts`.
     */
    const blatt = new THREE.Mesh(schildKoerper(BLADE_W), farbstoff(0.8));
    blatt.castShadow = true;
    blatt.name = "01_RAEUMSCHILD_BLATT";
    g.add(blatt);
    const schneide = new THREE.Mesh(schildSchneide(BLADE_W), rod);
    schneide.name = "01_RAEUMSCHILD_SCHNEIDE";
    g.add(schneide);
    void dark;
    void frame;
  }

  /** Zustand fürs Bordinstrument zusammenstellen. */
  private readout(): InstrumentReadout {
    return {
      boomAngle: this.boomAngle,
      stickAngle: this.stickAngle,
      cabYaw: this.cabYaw,
      closure: this.closure,
      carriedMassKg: this.carriedMassKg,
      carriedCount: this.carriedCount,
      outriggerDown: this.outriggerDown,
      activity: this.activity,
    };
  }

  /** Anzeigen auffrischen (aus der Hauptschleife, gedrosselt). */
  updateInstruments(dt: number): void {
    this.instruments.update(dt, this.readout());
  }

  getSensorPosition(out: THREE.Vector3): THREE.Vector3 {
    /*
     * Der Sitz kommt von der Form (E-057). Fuer die Sichelkralle ist er auf
     * die Zahl genau `GRAPPLE_LINK + 0.2 + PALM_TO_SENSOR` = 1,50 m; die
     * beiden Konstanten stehen weiter oben und bleiben die Herkunft.
     */
    return out
      .set(0, -this.form.sensorSitz, 0)
      .applyQuaternion(this.grappleGroup.quaternion)
      .add(this.grappleGroup.position);
  }

  private basketTmp = new THREE.Vector3();
  private basketQuatInv = new THREE.Quaternion();

  /**
   * Liegt der Weltpunkt wirklich im Schalenkorb?
   *
   * Vorher genügte eine Kugel um den Greifer, wodurch Material angehoben wurde,
   * das gar nicht zwischen den Schalen lag — es schwebte sichtbar darunter.
   * Jetzt wird gegen die tatsächliche Krallengeometrie geprüft: oben der
   * Gelenkring, unten die Spitzen, seitlich der Kreis, den die Krallen bei der
   * aktuellen Öffnung aufspannen.
   */
  isInsideGrapple(worldPoint: THREE.Vector3): boolean {
    const p = this.basketTmp
      .copy(worldPoint)
      .sub(this.grappleGroup.position)
      .applyQuaternion(this.basketQuatInv.copy(this.grappleGroup.quaternion).invert());
    /*
     * Wie der Korb aussieht, weiss die Form (E-057). Bei der Sichelkralle ist
     * es unveraendert der gerade Kegel vom Lagerkranz zur Spitze mit 0,14 m
     * Luft, wie er bis zum 15.09.2026 hier stand; der Fuenfschalengreifer
     * bringt seine eigene Korbform mit (E-058), weil derselbe Kegel bei ihm
     * nur 28 % der Korbflaeche treffen wuerde.
     *
     * Wenig Luft nach oben und unten. Vorher waren es 0,45 bzw. 0,35 m — damit
     * galt als gefasst, was gut einen halben Meter neben der Spinne schwebte,
     * ohne jede Beruehrung. Der Zuschlag stammt aus der Zeit vor der
     * Oberflaechen-Projektion in `tryGrab`: Damals wurde der Schwerpunkt
     * geprueft, und sperrige Teile waren sonst nicht zu fassen.
     */
    return this.form.imKorb(p, this.currentSplay());
  }

  /**
   * Wie viele Krallen beruehren diesen Koerper gerade?
   *
   * Der Korbtest oben fragt nur, ob der naechstgelegene Oberflaechenpunkt im
   * Schalenraum liegt. Eine Kiste, die mit einer Ecke hineinragt, besteht ihn —
   * und hing dann sichtbar halb neben der Spinne in der Luft (Befund
   * 11.09.2026: "Teile werden mit hochgehoben, obwohl sie gar nicht richtig in
   * der Spinne liegen"). Wer wirklich gefasst ist, hat mehrere Schalen an sich.
   *
   * Geprueft werden Spitze und Mitte jeder Kralle gegen die Oberflaeche.
   *
   * ALLE Kollider des Koerpers, nicht nur Kollider 0 (E-127): Das Wrack der
   * Fassung C ist ein Verbund aus acht Blechen (E-124), und eine Schale an der
   * Tuer liegt an der Tuer an, nicht an der Bodenwanne. Eine Kralle zaehlt,
   * wenn sie irgendeinem Kollider nahe ist. Bei einem Kollider ist das
   * dieselbe Rechnung wie vorher, Abfrage fuer Abfrage
   * (`test/krallenkontakte.test.ts`).
   */
  krallenKontakte(body: RAPIER.RigidBody): number {
    // Ein entfernter Koerper zerstoert sonst die ganze Physikwelt (E-103).
    if (!body.isValid()) return 0;
    const n = body.numColliders();
    if (n === 0) return 0;
    this.grappleGroup.updateWorldMatrix(true, false);
    let treffer = 0;
    for (let c = 0; c < this.form.schalen; c++) {
      const a = (c / this.form.schalen) * Math.PI * 2;
      const splay = this.clawSplayIst[c] ?? this.currentSplay();
      let nah = false;
      for (const seg of [this.form.stationen, Math.round(this.form.stationen * 0.6)]) {
        this.form.punkt(a, splay, seg, this.clawA);
        this.clawA.applyMatrix4(this.grappleGroup.matrixWorld);
        for (let i = 0; i < n && !nah; i++) {
          const col = body.collider(i);
          if (!col.isValid()) continue;
          const pr = col.projectPoint({ x: this.clawA.x, y: this.clawA.y, z: this.clawA.z }, false);
          if (!pr) continue;
          const d = Math.hypot(
            pr.point.x - this.clawA.x,
            pr.point.y - this.clawA.y,
            pr.point.z - this.clawA.z
          );
          nah = pr.isInside || d <= KONTAKT_NAH;
        }
        if (nah) break;
      }
      if (nah) treffer++;
    }
    return treffer;
  }

  /**
   * Alles, was von der Maschine lose in der Szene haengt — fuer die
   * Bildinterpolation (core/zwischenbild.ts).
   *
   * Die Selbsterkennung des Zwischenbilds nimmt nur Baugruppen mit eigenen
   * Kindern; einzelne Netze bleiben aussen vor, sonst wuerde jedes Schrottteil
   * einen Eintrag kosten. Die Hydraulikzylinder rechnen aber in
   * Weltkoordinaten und haengen darum als einzelne Netze direkt in der Szene
   * (siehe buildHydraulics). Ohne diese Liste blieben genau sie ruckelig,
   * waehrend der Rest der Maschine glatt laeuft — die Zylinder wuerden
   * sichtbar neben ihren Ankerpunkten zittern.
   *
   * Die Kabinenlenker stehen seit E-040 NICHT mehr hier: Sie haengen als
   * gedrehte Gruppe unter `root` und laufen damit ueber dessen Eintrag mit.
   */
  bildwurzeln(): THREE.Object3D[] {
    const raus: THREE.Object3D[] = [this.root, this.grappleGroup];
    for (const h of this.hydraulics) raus.push(h.barrel, h.rod);
    return raus;
  }

  /**
   * Zielpunkt für die Kamera (Oberwagen).
   *
   * Bewusst `this.root.position` und nicht `this.position`: Beide sind im
   * Normalfall dieselbe Zahl (syncMeshes kopiert die eine in die andere), aber
   * waehrend des Zeichnens steht in `root.position` die Zwischenpose der
   * Bildinterpolation. Haengt die Kamera am gerechneten Stand, waehrend die
   * Maschine gemischt gezeichnet wird, wackeln beide gegeneinander — der
   * Bagger zittert dann vor einem ruhigen Hintergrund.
   */
  getCameraTarget(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.root.position).add(new THREE.Vector3(0, 2.6, 0));
  }

  /** Augpunkt der Kabinenkamera (Weltkoordinaten). */
  getCabinEye(out: THREE.Vector3): THREE.Vector3 {
    return this.cabinEye.getWorldPosition(out);
  }

  /** Blickrichtungs-Basis der Kabine (Fahrwerk + Oberwagen). */
  get cabinBaseYaw(): number {
    return this.heading + this.cabYaw;
  }
}

/** Wert schrittweise Richtung Ziel bewegen (lineare Rampe). */
/**
 * Rampe mit weichen Ecken.
 *
 * Eine reine Gerade springt beim Loslassen von voller Beschleunigung auf
 * null — genau dieser Knick liest sich als Ruck. Nahe am Ziel wird die
 * Schrittweite darum kleiner: ein S statt einer Geraden. Die letzten rund
 * zwoelf Schritte (0,2 s) laufen mit gedrosseltem Schritt aus, der Rest der
 * Rampe bleibt unveraendert schnell.
 */
function ramp(current: number, target: number, maxStep: number): number {
  const diff = target - current;
  if (Math.abs(diff) <= maxStep) return target;
  /*
   * Weiche Ecke nur beim Ausrollen, nicht beim Anfahren.
   *
   * Zuerst wurde in beide Richtungen gedaempft — damit fuehlte sich auch der
   * Hebeldruck weich an, und die Maschine wirkte teigig statt schwer. Beim
   * Anfahren soll sie sofort anliegen; nur der letzte Rest beim Ausrollen
   * wird weich, denn dort sitzt der Ruck.
   */
  const bremst = Math.abs(target) < Math.abs(current);
  if (!bremst) return current + Math.sign(diff) * maxStep;
  const naehe = Math.min(1, Math.abs(diff) / (maxStep * 10));
  return current + Math.sign(diff) * maxStep * (0.4 + 0.6 * naehe);
}

function clamp1(v: number): number {
  return THREE.MathUtils.clamp(v, -1, 1);
}

/** Zwei Tastenpaare auf eine Achse summieren (Haupt- + Zweitbelegung). */
function axis2(input: Input, n1: string, p1: string, n2: string, p2: string): number {
  return THREE.MathUtils.clamp(input.axis(n1, p1) + input.axis(n2, p2), -1, 1);
}
