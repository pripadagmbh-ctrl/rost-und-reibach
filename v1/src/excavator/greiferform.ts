import * as THREE from "three";
import { baueSpinne } from "./grappleParts";
import {
  CLAW_CLOSED_SPLAY,
  CLAW_COUNT,
  CLAW_MAX_DEPTH,
  CLAW_OPEN_SPLAY,
  CLAW_RING_R,
  CLAW_RING_Y,
  CLAW_SEGMENTS,
  NACHDRUECK_RESERVE,
  WEICH_RESERVE,
  clawPoint,
  clawTipAusladung,
  clawTipDepth,
} from "./clawGeometry";

/**
 * Was ein Greifer koennen muss — die eine Wahrheit fuer Modell, Kollider,
 * Bodenanschlag und Greifsystem (E-057, 15.09.2026).
 *
 * WARUM ES DIESE DATEI GIBT. Bis heute hing alles, was den Greifer angeht,
 * unmittelbar an `clawGeometry.ts`: Der Bagger drehte `CLAW_COUNT` Krallen
 * ueber `clawPoint`, der Bodenanschlag rechnete mit `CLAW_MAX_DEPTH`, das
 * Greifsystem las `SENSOR_RADIUS` und `SCHALENLUECKE` aus Modulkonstanten.
 * Das war richtig, solange es EINEN Greifer gab. Mit dem
 * Fuenfschalengreifer daneben (E-058) wuerde daraus an einem Dutzend Stellen
 * ein „wenn … sonst", und jede dieser Stellen waere eine Gelegenheit, die
 * Sichelkralle zu veraendern, ohne es zu merken.
 *
 * DIE HAERTESTE BEDINGUNG dieses Umbaus lautet deshalb: Die Sichelkralle ist
 * danach Zeichen fuer Zeichen dieselbe. Nicht „aehnlich" — identisch. Der
 * Waechter dazu (`test/greiferform.test.ts`) haelt jede Zahl der Form gegen
 * die alte Rechnung, bis 1e−9, ueber den ganzen Schliessweg und ueber ein
 * Punktegitter im Korb. Alle Werte hier sind aus `clawGeometry.ts` GEHOLT,
 * keiner ist abgeschrieben.
 *
 * DIE WINKELKONVENTION. `winkel` ist bei beiden Formen so gerichtet, dass
 * GROESSER = WEITER OFFEN gilt, und `zu` ist immer der kleinere Anschlag. Bei
 * der Sichelkralle ist das die Spreizung (zu 0,5495 … offen 1,555), beim
 * Fuenfschalengreifer der Schwenk der Schalen (zu 0 … offen 1,6799). Damit
 * rechnet der Bagger fuer beide mit demselben Code.
 *
 * WAS HIER NICHT HINEINGEHOERT: alles, was zwischen Greifer und Welt liegt —
 * Bodenanschlag, Eindringtiefe, Greiffenster. Die Form sagt, wo ihre Schalen
 * stehen und was in ihrem Korb liegt; was der Bagger damit anstellt, steht
 * weiter in `excavator.ts` und `gripSystem.ts`.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * DIE GREIFERACHSE STEHT NICHT MEHR ZWANGSLAEUFIG SENKRECHT (E-083).
 *
 * Bis zum 15.09.2026 stand hier eine ANNAHME; sie ist mit dem Seitwaertskippen
 * gefallen (Wunsch Patrick 15.09.2026: „Greifer muss komplett zur seite kippen
 * können, zum kehren und schleudern.").
 *
 * WAS UNVERAENDERT TRAEGT, weil es im Frame des Greifers rechnet:
 *   `punkt`        Mittellinie im Greiferframe — dreht mit.
 *   `imKorb`       bekommt den Punkt bereits im Greiferframe (der Bagger
 *                  rechnet ihn mit `grappleGroup.quaternion` um). Kippt der
 *                  Greifer, kippt der Korb mit, ohne dass sich hier etwas
 *                  aendert.
 *   `sensorSitz`   wird in `getSensorPosition` mit derselben Drehung gelegt —
 *                  die Fuehlkugel kippt also mit.
 *   `sensorRadius`, `schalenluecke`, `kolliderRadius`, die vier Zahlen des
 *                  Schliessens: reine Bauteilmasse, richtungslos.
 *
 * WAS AN DER SENKRECHTEN HING — und jetzt `ausladung` heisst:
 *   `tiefe(winkel)`, `maxTiefe`   Beides ist eine Tiefe UNTER DEM URSPRUNG,
 *                  gemessen LAENGS DER GREIFERACHSE. Solange die Achse lotet,
 *                  ist das dasselbe wie „ueber dem Beton"; gekippt ist es das
 *                  nicht mehr. Wer wissen will, wie weit der Greifer WIRKLICH
 *                  nach unten langt, fragt `ausladung(winkel, kipp)`.
 *
 *                  `tiefe` und `maxTiefe` BLEIBEN, unveraendert und mit
 *                  unveraenderter Bedeutung — sie sind die Laenge in der
 *                  Greiferachse, und die braucht `imKorb` weiterhin.
 *
 * DIE EINE HARTE BEDINGUNG: `ausladung(winkel, 0)` liefert Ziffer fuer Ziffer
 * `tiefe(winkel)`. Nicht „fast" — dieselbe Zahl, garantiert durch einen
 * Vorabsprung in jeder der beiden Fassungen. Alles, was am Bodenanschlag und am
 * Greifgefuehl haengt, bleibt damit bei lotrechtem Greifer unberuehrt
 * (`test/kippen.test.ts`, mit Gegenprobe).
 *
 * Die drei Stellen im Bagger, die diese Zahl senkrecht verrechnet haben:
 * `resolveGroundClamp` und `surfaceUnderClaws` rechnen jetzt mit `ausladung`
 * bzw. schicken ihren Messstrahl die gekippte Achse entlang;
 * `hoechsteKrallenspitze` nimmt die Ausladung als Vorgabe entgegen (sie hat
 * sie immer schon als Parameter gehabt) und sagt es jetzt auch.
 * ──────────────────────────────────────────────────────────────────────────
 */

/** Kennung einer Greiferform — sie steht so auch im Spielstand. */
export type GreiferId = "sichel" | "fuenfschalen" | "magnet";

/** Der gebaute Greifer, wie der Bagger ihn bewegt. */
export interface Greiferbau {
  /** Haengt unter `grappleGroup`. */
  gruppe: THREE.Object3D;
  /** Schale `i` auf diesen Winkel stellen (rad, groesser = weiter offen). */
  setWinkel(i: number, winkel: number): void;
  /**
   * Nach allen Schalen aufzurufen: Zylinder und andere abhaengige Teile
   * nachfuehren. Getrennt von `setWinkel`, weil eine Hydraulik erst dann
   * stimmt, wenn alle Schalen stehen.
   */
  nachfuehren(): void;
  /** Nur der Magnet (E-146): Lampe „Magnet ein" schalten. */
  setAn?(an: boolean): void;
}

export interface Greiferform {
  readonly id: GreiferId;
  /** Klartext fuers Menue und fuers Ereignis. */
  readonly name: string;
  /** Zahl der Schalen. */
  readonly schalen: number;
  /** Stationen je Schale: 0 = Gelenk, `stationen` = Spitze. */
  readonly stationen: number;
  /** Anschlag geschlossen (rad). */
  readonly zu: number;
  /** Anschlag offen (rad). */
  readonly offen: number;
  /**
   * Punkt auf der Mittellinie einer Schale, im Frame des Greifers.
   * `a` ist der Umfangswinkel der Schale, `k` die Station.
   */
  punkt(a: number, winkel: number, k: number, out: THREE.Vector3): THREE.Vector3;
  /**
   * Tiefe des tiefsten GEZEICHNETEN Punktes unter dem Ursprung (m).
   * Setzt voraus, dass die Greiferachse lotet — siehe Kopf der Datei.
   */
  tiefe(winkel: number): number;
  /** Dieselbe Tiefe, ueber den ganzen Schliessweg genommen (m). */
  readonly maxTiefe: number;
  /**
   * Wie weit der Greifer WIRKLICH unter seine Aufhaengung langt, wenn er um
   * `kipp` (rad) zur Seite gekippt haengt — gemessen in Weltrichtung −y.
   *
   * Bei `kipp === 0` ist das Ziffer fuer Ziffer `tiefe(winkel)`. Jede Form
   * rechnet das selbst (`clawTipAusladung` bzw. `ausladung` im
   * Fuenfschalengreifer); warum, steht beim Abschnitt „DIE RECHNUNG, DIE DIE
   * GREIFERACHSE IN DIE WELTSENKRECHTE UMRECHNET" weiter unten.
   */
  ausladung(winkel: number, kipp: number): number;
  /** Dieselbe Ausladung, ueber den ganzen Schliessweg genommen (m). */
  maxAusladung(kipp: number): number;
  /** Liegt dieser Punkt (im Frame des Greifers) im Schalenkorb? */
  imKorb(p: THREE.Vector3, winkel: number): boolean;
  /** Abstand vom Ursprung des Greifers bis zur Sensormitte (m). */
  readonly sensorSitz: number;
  /** Radius der Sensorkugel (m) — gerechnet, siehe `sensorRadiusVon`. */
  readonly sensorRadius: number;
  /** Luft, die `imKorb` unter die Spitzen legt (m). */
  readonly korbLuftUnten: number;
  /** Abstand zweier benachbarter Schalen bei geschlossenem Greifer (m). */
  readonly schalenluecke: number;
  /** Nachdrueck-Reserve einer Schale an massivem Stahl (rad). */
  readonly nachdrueckReserve: number;
  /** Dieselbe Reserve an Nachgiebigem (rad). */
  readonly weichReserve: number;
  /** Wie weit Ladung den Greifer hoechstens offen haelt (rad). */
  readonly ladungOffen: number;
  /** Wie schnell eine freie Schale ihrem Sollwinkel folgt (rad/s). */
  readonly rate: number;
  /** Radius der Kapseln, die eine Schale physisch nachbilden (m). */
  readonly kolliderRadius: number;
  /**
   * Eigengewicht des Anbaugeraets (kg) — wird von der Traglast abgezogen
   * (E-152, `traglast.ts`): Die Tabelle gilt am Stielende, der Greifer haengt
   * dort mit.
   */
  readonly eigengewichtKg: number;
  /** Ein neues Modell bauen — je Bagger eines, nicht wiederverwendbar. */
  baue(): Greiferbau;
  /**
   * Nur der Lasthebemagnet (E-146): Scheibe statt Schalen, Masse im Frame des
   * Greifers (m). Ist das Feld da, zieht das Greifsystem an, statt zu greifen.
   */
  readonly magnet?: { radius: number; hoehe: number; unten: number };
}

/** Was `sensorRadiusVon` und `schalenlueckeVon` von einer Form brauchen. */
type Kernform = Pick<
  Greiferform,
  "zu" | "offen" | "stationen" | "schalen" | "punkt" | "korbLuftUnten" | "sensorSitz"
>;

/**
 * DIE RECHNUNG, DIE DIE GREIFERACHSE IN DIE WELTSENKRECHTE UMRECHNET.
 *
 * Gekippt wird um die LOKALE X-ACHSE des Greifers, danach dreht der Rotator um
 * die Weltsenkrechte (`integratePendulum`: `qPendel · qGier · qKipp`). Die
 * Drehung des Rotators aendert an der HOEHE eines Punktes nichts — sie dreht
 * nur um y. Fuer die Ausladung bleibt also allein das Kippen uebrig:
 *
 *     Welt-y eines Punktes p  =  p.y · cos θ − p.z · sin θ
 *     Ausladung(θ)            =  max über p von ( −p.y · cos θ + p.z · sin θ )
 *
 * Gerechnet wird ueber ALLE Schalen, nicht nur ueber die erste. Bei θ = 0
 * spielt das keine Rolle (alle Schalen sind gleich tief, deshalb reicht
 * `tiefe` mit einer Schale aus); gekippt schon: Die Schalen sitzen auf
 * verschiedenen Umfangswinkeln, und `p.z = cos(a)·r` ist fuer jede eine
 * andere Zahl.
 *
 * WARUM JEDE FORM DAS SELBST RECHNET, statt es hier gemeinsam zu tun. Ein
 * gemeinsamer Weg ueber `punkt` haette nur die MITTELLINIE gehabt; was die
 * Form darunter noch haengen hat — Zahnkegel bei der Sichelkralle, Ruecken
 * des Zinken beim Fuenfschalengreifer — steckt in `tiefe(winkel)`, aber nicht
 * in der Mittellinie. Er als festen Aufschlag mitzuschleppen, WAR die erste
 * Fassung, und sie lag beim Fuenfschalengreifer bis zu **153 mm** daneben
 * (`tools/greifer-ausladung.ts`): Der Bodenanschlag haette den gekippten
 * Greifer 15 cm ueber dem Beton gehalten, und Kehren waere nicht gegangen.
 * Jede Form kennt ihre Unterkante genau; also rechnet jede sie selbst.
 * Gemessen liegen beide jetzt unter einem Millimeter.
 *
 * DER VORABSPRUNG bei `kipp === 0` steht in beiden Fassungen und ist keine
 * Abkuerzung, sondern die Zusage: Bei lotrechtem Greifer kommt dieselbe Zahl
 * wie vor dem Umbau, Bit fuer Bit — keine Summe von Kosinus 0 dazwischen.
 */

/**
 * Die groesste Ausladung ueber den ganzen Schliessweg (m) — die Zahl, mit der
 * `resolveGroundClamp` den Arm anhaelt.
 *
 * Bei `kipp === 0` kommt `maxTiefe` zurueck, unveraendert und ungerechnet.
 * Genau das haelt den Bodenanschlag bei lotrechtem Greifer auf seiner
 * heutigen Hoehe (Sichelkralle 6,7 cm, Fuenfschalengreifer 19,4 cm).
 *
 * 41 STUETZSTELLEN, nicht 201. Der tiefste Punkt liegt weder ganz offen noch
 * ganz zu, sondern dazwischen (E-046), also muss der Weg abgetastet werden.
 * Wie fein, ist eine Kostenfrage: Diese Zahl wird JEDES BILD gebraucht, und
 * 201 Stuetzstellen kosten ueber 9.000 Punktrechnungen je Bild. 41 kosten
 * 1.845. Was das an Genauigkeit kostet, ist gemessen:
 * `tools/zahnlage-spinne.ts` hat 21 Stuetzstellen mit 0,05 mm Abweichung
 * ausgewiesen; 41 sind feiner als das. Bei 0 Grad ist der Unterschied ohnehin
 * null, weil dort gar nicht abgetastet wird.
 */
export function maxAusladungVon(
  f: Pick<Greiferform, "zu" | "offen" | "ausladung">,
  kipp: number,
  maxTiefe: number
): number {
  if (kipp === 0) return maxTiefe;
  let weit = 0;
  for (let i = 0; i <= 40; i++) {
    weit = Math.max(weit, f.ausladung(f.zu + ((f.offen - f.zu) * i) / 40, kipp));
  }
  return weit + KIPP_ZUSCHLAG * Math.abs(Math.sin(kipp));
}

/**
 * `maxAusladung` mit EINEM Platz Gedaechtnis.
 *
 * `resolveGroundClamp` fragt die Zahl jedes Bild, und schraeg haengend rechnet
 * sie 41 Oeffnungsstellungen mal fuenf Schalen durch. Gemessen am 16.09.2026
 * kostete das **0,31 ms** (Sichelkralle) bzw. **0,45 ms**
 * (Fuenfschalengreifer) je Bild — auf einem iPad ist das ein spuerbarer
 * Anteil von 16,7 ms.
 *
 * Ein Platz reicht, obwohl der Winkel jetzt aus dem Pendel kommt und sich
 * damit je Bild aendert: Der Bagger fragt innerhalb eines Bildes mehrfach,
 * und zwischen den Bildern steht der Greifer die meiste Zeit lotrecht — dort
 * greift der Vorabsprung und es wird gar nicht gerechnet.
 *
 * Die Form kommt als Thunk herein, weil dieser Aufruf im Initialisierer der
 * Form selbst steht und sie zu diesem Zeitpunkt noch nicht existiert.
 */
export function merkeMaxAusladung(
  form: () => Pick<Greiferform, "zu" | "offen" | "ausladung">,
  maxTiefe: () => number
): (kipp: number) => number {
  let letzterKipp = NaN;
  let letzterWert = 0;
  return (kipp: number): number => {
    if (kipp === letzterKipp) return letzterWert;
    letzterKipp = kipp;
    letzterWert = maxAusladungVon(form(), kipp, maxTiefe());
    return letzterWert;
  };
}

/**
 * Der ZUSCHLAG fuer den gekippten Greifer (m) — und warum er noetig ist.
 *
 * `ausladung` rechnet mit der MITTELLINIE der Schalen und dem Ueberstand
 * darunter. Was sie nicht kennt, ist die BREITE der Schale: Eine Kralle ist
 * ein Kasten, kein Draht, und ihre Aussenkante liegt neben der Mittellinie.
 *
 * Lotrecht faellt das nicht ins Gewicht — die Breite steht dann waagerecht.
 * Gekippt steht sie schraeg und reicht nach unten. Und es kommt darauf an,
 * WOHIN gekippt wird: Nach der einen Seite steht eine Schale genau unten und
 * ihre Mittellinie ist der tiefste Punkt; nach der anderen steht eine LUECKE
 * unten, und dann gewinnt die Aussenkante der beiden Nachbarschalen. Der
 * Greifer ist fuenfzaehlig, nicht zweizaehlig.
 *
 * GEMESSEN am gezeichneten Netz (`tools/greifer-ausladung.ts`), in der
 * Richtung, in die der Bagger wirklich kippt:
 *
 *            −90°     −85°     −45°     −25°
 *   Sichel   29,4 mm  13,0 mm  −1,2 mm  −3,3 mm
 *   Fuenf    18,5 mm  18,7 mm   7,0 mm   1,3 mm
 *
 * Positiv heisst: Das Netz reicht weiter nach unten als die Rechnung, der
 * Greifer wuerde um so viel in den Beton sinken. 50 mm sind die naechste
 * runde Zahl ueber dem schlimmsten Wert; mit `|sin kipp|` skaliert, damit bei
 * 0 Grad nichts dazukommt und die Zusage „bei 0 Grad ist nichts anders"
 * nicht an einer Fallunterscheidung haengt, sondern an der Rechnung selbst.
 *
 * DER PREIS: Ganz zur Seite gelegt bleibt der Greifer rund 2 cm hoeher
 * stehen, als er muesste. Das ist die richtige Seite des Irrtums — E-046 hat
 * den umgekehrten Fall gemessen, und da pfluegte die Spinne durch den Beton.
 *
 * `test/kippen.test.ts` haelt beide Seiten fest: nie darunter, und nie mehr
 * als 55 mm darueber. Die Gegenprobe rechnet ohne Zuschlag und faellt durch.
 */
export const KIPP_ZUSCHLAG = 0.05;

/**
 * Der noetige Sensorradius einer Form — GERECHNET, nicht gewaehlt (E-030).
 *
 * Die Regel steht seit dem 15.09.2026 und gilt fuer jede Form gleich: Die
 * Kugel reicht so tief, wie die Schalenmittellinie in IRGENDEINER Stellung
 * reicht, plus der Luft, die `imKorb` darunter legt. In der Breite bleibt sie
 * Vorfilter — was seitlich noch als gefasst gilt, entscheidet `imKorb`.
 *
 * Der Grund dafuer steht ausfuehrlich in `gripSystem.ts`: Die alte Kugel war
 * 46 cm zu kurz, und genau die untersten 46 cm des Korbs sind der Boden, auf
 * dem das Material liegt.
 *
 * 201 Stuetzstellen ueber den Weg, weil der tiefste Punkt weder ganz offen
 * noch ganz zu liegt, sondern dazwischen.
 */
export function sensorRadiusVon(f: Kernform): number {
  const p = new THREE.Vector3();
  let tiefste = 0;
  for (let i = 0; i <= 200; i++) {
    const winkel = f.zu + ((f.offen - f.zu) * i) / 200;
    tiefste = Math.max(tiefste, -f.punkt(0, winkel, f.stationen, p).y);
  }
  return tiefste + f.korbLuftUnten - f.sensorSitz;
}

/**
 * Abstand zweier benachbarter Schalen beim geschlossenen Greifer (m).
 *
 * Gemessen an der Station, die `krallenKontakte` abtastet (60 % der
 * Schalenlaenge). Wofuer die Zahl gebraucht wird, steht bei `noetigeKrallen`
 * in `gripSystem.ts`: Ein Teil, das kleiner ist als die Luecke, kann zwei
 * Schalen gar nicht beruehren — von ihm zwei Kontakte zu verlangen ist eine
 * Bedingung, die es nie erfuellen kann (E-043).
 */
export function schalenlueckeVon(f: Kernform): number {
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const station = Math.round(f.stationen * 0.6);
  f.punkt(0, f.zu, station, a);
  f.punkt((1 / f.schalen) * Math.PI * 2, f.zu, station, b);
  return a.distanceTo(b);
}

/**
 * Wie weit ein Punkt unter den Spitzen noch als „im Korb" gilt (m).
 *
 * Gilt fuer beide Formen gleich: Es ist keine Eigenschaft des Greifers,
 * sondern die Toleranz, mit der wir „liegt zwischen den Schalen" meinen. Die
 * Zahl stammt aus `isInsideGrapple` und ist dort begruendet (vorher 0,35 m —
 * damit galt als gefasst, was einen halben Meter neben der Spinne schwebte).
 */
export const KORB_LUFT_UNTEN = 0.18;
/** Dasselbe zur Seite: So viel Luft legt `imKorb` um den Korbradius (m). */
export const KORB_LUFT_SEITE = 0.14;
/** Und nach oben, ueber den Korbrand hinaus (m). */
export const KORB_LUFT_OBEN = 0.22;

/* -------------------------------------------------------- Die Sichelkralle */

/** Kern der Sichelkralle — daraus werden Sensorradius und Luecke gerechnet. */
const SICHEL_KERN: Kernform = {
  zu: CLAW_CLOSED_SPLAY,
  offen: CLAW_OPEN_SPLAY,
  stationen: CLAW_SEGMENTS,
  schalen: CLAW_COUNT,
  punkt: clawPoint,
  korbLuftUnten: KORB_LUFT_UNTEN,
  /**
   * Sensorsitz 1,50 m unter dem Kardangelenk.
   *
   * Spiegelt `GRAPPLE_LINK + 0.2 + PALM_TO_SENSOR` aus `excavator.ts`
   * (0,55 + 0,20 + 0,75). Der Bagger setzt die Kugel ab jetzt aus dieser Zahl,
   * statt sie selbst zusammenzurechnen — `test/greiffenster.test.ts` misst sie
   * am gebauten Bagger nach und faellt um, sobald sie dort anders wird.
   */
  sensorSitz: 1.5,
};

const sichelTip = new THREE.Vector3();

/**
 * Sichelkralle — der Greifer des Prototyps, Stand 12.09.2026 mittags.
 *
 * Jede Zahl wird aus `clawGeometry.ts` geholt. Diese Datei fuegt der Form
 * NICHTS hinzu und nimmt ihr nichts weg; sie gibt ihr nur einen Namen, unter
 * dem eine zweite Form danebenstehen kann.
 */
export const SICHELKRALLE: Greiferform = {
  id: "sichel",
  name: "Sichelkralle",
  ...SICHEL_KERN,
  tiefe: clawTipDepth,
  maxTiefe: CLAW_MAX_DEPTH,
  ausladung: clawTipAusladung,
  maxAusladung: merkeMaxAusladung(
    () => SICHELKRALLE,
    () => CLAW_MAX_DEPTH
  ),
  sensorRadius: sensorRadiusVon(SICHEL_KERN),
  schalenluecke: schalenlueckeVon(SICHEL_KERN),
  /**
   * Der Korb der Sichelkralle — unveraendert die Rechnung, die bis zum
   * 15.09.2026 in `Excavator.isInsideGrapple` stand: oben der Lagerkranz,
   * unten die Spitzen, dazwischen ein GERADER Kegel mit 0,14 m Luft.
   *
   * Dass dieser Kegel den wirklichen Korb unterschaetzt, ist gemessen und
   * bekannt (`tools/greifer-gegenueber.ts`, „Korbprofil"): Auf halber
   * Korbhoehe laesst er 0,340 m zu, wo die Schalen 0,630 m umschliessen. Bei
   * DIESER Form ist das die vorsichtige Seite des Irrtums — es wird nur
   * gefasst, was sicher drin liegt. Es bleibt deshalb, wie es ist (Regel 2:
   * Das Spielgefuehl des Prototyps ist der Massstab). Der Fuenfschalengreifer
   * bekommt eine eigene Korbform, weil derselbe Kegel bei ihm nur 28 % der
   * Korbflaeche treffen wuerde (E-058).
   */
  imKorb(p: THREE.Vector3, winkel: number): boolean {
    clawPoint(0, winkel, CLAW_SEGMENTS, sichelTip);
    const tipY = sichelTip.y;
    const tipR = Math.max(sichelTip.z, 0);
    if (p.y > CLAW_RING_Y + KORB_LUFT_OBEN || p.y < tipY - KORB_LUFT_UNTEN) return false;
    const t = THREE.MathUtils.clamp((CLAW_RING_Y - p.y) / Math.max(CLAW_RING_Y - tipY, 0.01), 0, 1);
    const r = THREE.MathUtils.lerp(CLAW_RING_R, tipR, t) + KORB_LUFT_SEITE;
    return Math.hypot(p.x, p.z) <= r;
  },
  nachdrueckReserve: NACHDRUECK_RESERVE,
  weichReserve: WEICH_RESERVE,
  /**
   * Ladung haelt die Schalen bis zu 0,50 rad offen.
   *
   * Stand aus `Excavator.currentSplay`, dort seit dem Prototyp. Als Anteil am
   * Oeffnungsweg sind das 49,7 % — so wird der Wert fuer die zweite Form
   * umgerechnet (Ansage Patrick 15.09.2026: „als Anteil am Oeffnungsweg,
   * damit sich beide gleich anfuehlen").
   */
  ladungOffen: 0.5,
  /**
   * 4,0 rad/s. Bewusst hoch: Eine unbehinderte Spinne soll sich anfuehlen wie
   * vorher, sichtbar werden soll nur, was haengen bleibt. Der Befehl selbst
   * verlangt ueber `CLOSE_TIME` = 0,4 s nur 1,0055 / 0,4 = 2,514 rad/s — die
   * Schale hat also das 1,591-fache an Spielraum.
   */
  rate: 4.0,
  /**
   * 0,09 m. Der Wert der Kapseln, die seit dem 13.09.2026 an jeder Kralle
   * haengen; er steht hier, weil die zweite Form ihn ebenfalls braucht.
   */
  kolliderRadius: 0.09,
  /**
   * SW: 900 kg. Groessenordnung eines Mehrschalen-Schrottgreifers um 0,4 m³
   * fuer 20-t-Umschlagbagger nach Herstellerangaben (0,8–1,0 t); nicht
   * einzeln belegt.
   */
  eigengewichtKg: 900,
  baue(): Greiferbau {
    const s = baueSpinne();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const hoch = new THREE.Vector3(0, 1, 0);
    return {
      gruppe: s.gruppe,
      setWinkel(i: number, winkel: number): void {
        /*
         * Um -Spreizung, nicht um -(Spreizung - ZU) — die Begruendung steht
         * unveraendert in `excavator.ts` bei `updateFingers`: Die Segmentkette
         * ist bei Spreizung 0 gebaut.
         */
        const g = s.gelenke[i];
        if (g) g.rotation.x = -winkel;
      },
      /*
       * Zylinder zwischen Traversen-Gelenk und Schale ausrichten — alles im
       * lokalen Spinnenraum, damit sie beim Pendeln nicht nachhinken.
       * Wortweise die Rechnung, die bis zum 15.09.2026 als
       * `Excavator.updateGrappleCylinders` dastand.
       */
      nachfuehren(): void {
        for (const c of s.zylinder) {
          a.copy(c.obenLokal);
          b.copy(c.untenAmGelenk).applyEuler(c.gelenk.rotation).add(c.gelenk.position);
          dir.copy(b).sub(a);
          const dist = Math.max(dir.length(), 0.2);
          dir.normalize();
          q.setFromUnitVectors(hoch, dir);
          c.rohr.position.copy(a).addScaledVector(dir, c.rohrLaenge / 2);
          c.rohr.quaternion.copy(q);
          c.rohr.scale.set(1, c.rohrLaenge, 1);
          const stangeLang = Math.max(dist - c.rohrLaenge + 0.08, 0.08);
          c.stange.position.copy(b).addScaledVector(dir, -stangeLang / 2);
          c.stange.quaternion.copy(q);
          c.stange.scale.set(1, stangeLang, 1);
        }
      },
    };
  },
};
