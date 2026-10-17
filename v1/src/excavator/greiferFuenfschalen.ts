import * as THREE from "three";
import { baueGreifer } from "../fuenfschalen/rig";
import {
  MASS,
  SCHALEN_ABSCHNITTE,
  OFFEN,
  STEMPEL_AUGE,
  ZU,
  schalenStationen,
  stoffe,
} from "../fuenfschalen/teile";
import {
  SICHELKRALLE,
  KORB_LUFT_OBEN,
  KORB_LUFT_SEITE,
  KORB_LUFT_UNTEN,
  type Greiferbau,
  type Greiferform,
  merkeMaxAusladung,
  schalenlueckeVon,
  sensorRadiusVon,
} from "./greiferform";

/**
 * Der FUENFSCHALENGREIFER am Bagger (E-058, 15.09.2026).
 *
 * Das Modell steht seit dem 14.09. in `src/fuenfschalen/` und war bis heute
 * nur in der Vorschau zu sehen (E-009). Hier bekommt es alles, was der Bagger
 * von einem Greifer braucht — und zwar aus derselben Quelle, aus der auch das
 * Netz gebaut wird: `teile.ts` gibt die Stationen der Schale, `rig.ts` baut
 * und bewegt sie.
 *
 * WAS ANDERS IST ALS BEI DER SICHELKRALLE, und warum es das sein muss:
 *
 * 1. DER KORB. `isInsideGrapple` verjuengte den Korb bisher GERADE vom
 *    Lagerkranz zur Spitze und legte 0,14 m Luft darum. Gegen den wirklichen
 *    Korb gehalten (`tools/greifer-gegenueber.ts`):
 *
 *      Anteil der Korbhoehe      0,0    0,2    0,4    0,6    0,8
 *      Sichelkralle echt       0,400  0,582  0,647  0,591  0,416
 *      … was der Kegel erlaubt 0,540  0,460  0,380  0,300  0,221
 *      Fuenfschalen echt       0,890  0,890  0,853  0,771  0,617
 *      … derselbe Kegel        0,730  0,624  0,518  0,412  0,306
 *
 *    Bei der Sichelkralle ist der Kegel eine vorsichtige Naeherung. Beim
 *    Fuenfschalengreifer waere er noch falscher: auf 60 % Hoehe 0,412 statt
 *    0,771 m — 28 % der Flaeche. Unveraendert uebernommen wuerde er deutlich
 *    schlechter greifen als die Sichelkralle, und niemand wuesste, warum.
 *    Deshalb rechnet `imKorb` hier gegen die WIRKLICHE Mittellinie der
 *    Schalen, mit denselben drei Lufttoleranzen. Die Sichelkralle bleibt
 *    unangetastet.
 *
 * 2. DIE VIER ZAHLEN DES SCHLIESSENS. Der Schliessweg ist 67 % laenger
 *    (1,6799 gegen 1,0055 rad). Dieselben absoluten Werte haetten hier ein
 *    Drittel weniger Wirkung. Ansage Patrick 15.09.2026: „als Anteil am
 *    Oeffnungsweg umrechnen, damit sich beide gleich anfuehlen." Genau das
 *    tut `ANTEIL` unten — jede der vier Zahlen ist die der Sichelkralle mal
 *    diesem Verhaeltnis, keine ist neu gewaehlt.
 *
 * 3. DIE GRABTIEFE ist GEMESSEN, nicht gerechnet: Die Unterkante des Zahns
 *    (`07_ZAHN`) wird am gebauten Modell abgegriffen und dann mitgeschwenkt.
 *    Am 14.09.2026 ist an dieser Baugruppe ein Messwerkzeug weggeworfen
 *    worden, weil es „aeusserster Punkt = Spitze" annahm — bei einer nach
 *    innen gekruemmten Schale ist der aeusserste Punkt die RUECKSEITE. Hier
 *    wird deshalb ueber den Knotennamen gemessen.
 *
 * WAS DIESE FASSUNG NICHT KANN: Die Krallen-Kollider sind dieselbe
 * Kapselkette wie bei der Sichelkralle — eine Reihe auf der Mittellinie,
 * 0,09 m dick. Die Schalen des Fuenfschalengreifers sind 0,40 m breite
 * gewoelbte Platten; physisch ist davon ein 18 cm dicker Draht da, und
 * Material kann seitlich daran vorbeifallen, obwohl man die Schale davor
 * sieht. Das ist bekannt und ein eigenes Paket nach dem ersten Geraetetest.
 */

/**
 * Wie sich die Wege der beiden Greifer verhalten: 1,6799 / 1,0055 = 1,6707.
 *
 * Die eine Zahl, aus der die vier Umrechnungen unten kommen.
 */
export const ANTEIL = (OFFEN - ZU) / (SICHELKRALLE.offen - SICHELKRALLE.zu);

/**
 * Die Stuetzstellen EINER Schale im Frame ihres Drehpunkts — einmal gerechnet.
 *
 * `teile.schalenStationen()` baut die Liste bei jedem Aufruf neu; `punkt()`
 * laeuft aber je Bild rund vierzig Mal. Der Inhalt ist konstant.
 */
const STATIONEN = schalenStationen();

/**
 * Punkt auf der Mittellinie einer Schale, im Frame des Greifers.
 *
 * Wortgleich `teile.mittellinie(schwenk)[k]`, nur ohne die Liste dazwischen —
 * `test/greiferF5.test.ts` haelt beides gegeneinander.
 */
function punkt(a: number, schwenk: number, k: number, out: THREE.Vector3): THREE.Vector3 {
  const st = STATIONEN[Math.max(0, Math.min(SCHALEN_ABSCHNITTE, Math.round(k)))]!;
  const c = Math.cos(-schwenk);
  const sn = Math.sin(-schwenk);
  const r = STEMPEL_AUGE.r + (st.y * sn + st.z * c);
  return out.set(Math.sin(a) * r, STEMPEL_AUGE.y + (st.y * c - st.z * sn), Math.cos(a) * r);
}

/* ------------------------------------------------------------ Die Grabtiefe */

/**
 * Die Unterkante der SCHALE, abgegriffen am GEBAUTEN Modell.
 *
 * Bis zum 15.09.2026 stand hier nur der Knoten `07_ZAHN` — und das war um
 * 1,4 cm daneben. Gemessen (E-068, `tools/fuenfschalen/zahnknick.ts`): Der
 * Ruecken des Zinken reicht geschlossen 2,5127 m unter die Aufhaengung, der
 * Zahn nur 2,4988 m. Der Bodenanschlag rechnete also mit einer Schale, die
 * 14 mm hoeher endet, als sie es tut — und `imKorb` setzte seinen Korbboden
 * ebenso hoch an. Jetzt zaehlt jedes Netz der Schale.
 *
 * Gemessen in der geschlossenen Stellung (Schwenk 0, Schale also unverdreht,
 * ihr lokales +z zeigt in Welt-+z). Die Punkte werden in den Rahmen der
 * Schale umgerechnet und gemerkt; von da an laesst sich die Tiefe fuer jeden
 * Schwenk rechnen, ohne noch einmal ein Netz anzufassen.
 *
 * Der Bau kostet rund 0,25 s (gemessen auf dem Entwicklungsrechner) und
 * passiert genau einmal — beim ersten Mal, an dem jemand nach der Tiefe des
 * Fuenfschalengreifers fragt. Wer mit der Sichelkralle spielt, zahlt das nie.
 */
let zahnpunkte: Array<{ y: number; z: number }> | null = null;

/**
 * Die Schale an einem GESCHLOSSENEN Modell abgreifen und merken.
 *
 * Die erste Schale steht auf Umfangswinkel 0, ihr lokales +z zeigt also in
 * Welt-+z; bei Schwenk 0 ist sie unverdreht. Damit lassen sich die Weltpunkte
 * ohne Umweg in den Rahmen der Schale umrechnen.
 */
function zahnAusModell(g: ReturnType<typeof baueGreifer>): void {
  if (zahnpunkte) return;
  g.setOeffnung(0);
  g.wurzel.updateMatrixWorld(true);
  const roh: Array<{ y: number; z: number }> = [];
  const v = new THREE.Vector3();
  g.schalen[0]!.gelenk.traverse((m) => {
    const netz = m as THREE.Mesh;
    if (!netz.isMesh) return;
    const pos = netz.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k).applyMatrix4(netz.matrixWorld);
      roh.push({ y: v.y - STEMPEL_AUGE.y, z: v.z - STEMPEL_AUGE.r });
    }
  });
  if (roh.length === 0) throw new Error("Schale 0 hat keine Netze");
  zahnpunkte = tiefstenRand(roh);
}

/**
 * Nur die Punkte behalten, die ueberhaupt einmal der tiefste sein koennen.
 *
 * Im Bolzenrahmen liegt ein Punkt (y, z) beim Schwenk `s` genau
 *   T(s) = |y_Bolzen| − y·cos s + z·sin s
 * unter der Aufhaengung (E-065). Fuer jedes `s` gewinnt damit der Punkt, der
 * das Skalarprodukt mit (−cos s, sin s) maximiert — und das ist IMMER ein Punkt
 * auf der konvexen Huelle. Alles dazwischen kann weg.
 *
 * Aus 1.296 Netzpunkten werden so eine Handvoll. Das ist kein Sparen um des
 * Sparens willen: `tiefe()` laeuft in `imKorb` je Kandidat und Bild, und mit
 * dieser Kuerzung kostet der Wechsel von „nur der Zahn" auf „die ganze Schale"
 * nichts.
 */
function tiefstenRand(p: Array<{ y: number; z: number }>): Array<{ y: number; z: number }> {
  /*
   * Gesucht wird nicht die Huelle als Figur, sondern der SIEGER je Schwenk —
   * und den kann man einfach abfragen. 2.000 Schwenkstellungen ueber den
   * ganzen Weg, je Stellung der tiefste Punkt, doppelte weggelassen. Zwischen
   * zwei Stellungen liegen 0,05 Grad; der Fehler dabei ist kleiner als ein
   * Tausendstel Millimeter.
   *
   * Eine Huellenrechnung waere kuerzer und leichter falsch. Das hier ist
   * dieselbe Frage, wie `tiefe()` sie stellt, nur vorher.
   */
  /*
   * DER RICHTUNGSFAECHER IST SEIT E-083 BREITER — um 90 Grad nach jeder Seite.
   *
   * Solange der Greifer lotrecht hing, kamen nur die Richtungen (−cos s, −sin s)
   * mit s aus dem Schliessweg vor; das sind 96 Grad Faecher. Kippt der Greifer
   * um θ zur Seite, kommt je Schale ein Dreh dazu: Die gesuchte Richtung ist
   * dieselbe, gedreht um atan(tan θ · cos a) — und mit θ bis 90 Grad und
   * cos a von −1 bis +1 laeuft das ueber die vollen ±90 Grad.
   *
   * WARUM DAS `tiefe()` NICHT ANRUEHRT: Der breitere Faecher fuegt Punkte
   * HINZU, er nimmt keine weg. Ein hinzugekommener Punkt ist fuer die alten
   * Richtungen kein Sieger — sonst stuende er schon in der Liste. Das Maximum
   * fuer die alten Richtungen kann also nicht steigen. `tiefe(schwenk)`
   * liefert danach dieselbe Zahl wie vorher; `test/kippen.test.ts` misst das
   * gegen die eingefrorenen Werte nach.
   */
  const gewinner = new Set<number>();
  const N = 6000;
  const VON = ZU - Math.PI / 2;
  const BIS = OFFEN + Math.PI / 2;
  for (let i = 0; i <= N; i++) {
    const s = VON + ((BIS - VON) * i) / N;
    const c = Math.cos(s);
    const sn = Math.sin(s);
    let best = -Infinity;
    let wo = 0;
    for (let k = 0; k < p.length; k++) {
      const t = -p[k]!.y * c - p[k]!.z * sn;
      if (t > best) {
        best = t;
        wo = k;
      }
    }
    gewinner.add(wo);
  }
  return [...gewinner].map((i) => p[i]!);
}

function messeZahn(): Array<{ y: number; z: number }> {
  if (zahnpunkte) return zahnpunkte;
  /*
   * Kein Modell zur Hand — dann eins bauen und gleich wieder wegwerfen. Das
   * passiert nur, wenn jemand nach der Tiefe fragt, ohne den Greifer je
   * angebaut zu haben (Werkzeuge, Waechter). Wird er angebaut, greift `baue()`
   * den Zahn an seinem eigenen Modell ab und dieser Fall tritt nie ein.
   */
  const g = baueGreifer(stoffe());
  zahnAusModell(g);
  g.wurzel.traverse((n) => {
    const m = n as THREE.Mesh;
    if (m.isMesh) m.geometry.dispose();
  });
  return zahnpunkte!;
}

/** Tiefe der Zahnunterkante unter dem Aufhaengepunkt, bei diesem Schwenk (m). */
let letzterSchwenk = NaN;
let letzteTiefe = 0;

function tiefe(schwenk: number): number {
  // Gemerkt, weil `imKorb` sie je Kandidat und Bild braucht und sich der
  // Schwenk innerhalb eines Bildes nicht aendert.
  if (schwenk === letzterSchwenk) return letzteTiefe;
  const c = Math.cos(-schwenk);
  const sn = Math.sin(-schwenk);
  let tief = 0;
  for (const p of messeZahn()) {
    tief = Math.max(tief, -(STEMPEL_AUGE.y + (p.y * c - p.z * sn)));
  }
  letzterSchwenk = schwenk;
  letzteTiefe = tief;
  return tief;
}

/**
 * Dieselbe Zahl fuer einen SEITLICH GEKIPPTEN Greifer (E-083) — wie weit die
 * Schalen in Weltrichtung −y unter die Aufhaengung langen.
 *
 * Exakt, nicht genaehert: Gerechnet wird ueber DIESELBEN Zahnpunkte, mit
 * denen `tiefe()` rechnet, nur mit dem Kippwinkel darin. Eine Schale auf
 * Umfangswinkel `a` liegt bei
 *     y = Bolzen.y + (p.y·cos s − p.z·sin s),   r = Bolzen.r + (p.y·sin s + p.z·cos s)
 * mit s = −schwenk, und ihr z ist cos(a)·r. Gefragt ist
 *     max über (p, a) von ( −y·cos θ + cos(a)·r·sin θ ).
 *
 * UEBER ALLE FUENF SCHALEN. Lotrecht sind sie gleich tief, deshalb rechnet
 * `tiefe()` mit einer; gekippt entscheidet `cos(a)`, und das ist fuer jede
 * eine andere Zahl.
 *
 * Erste Fassung war eine Naeherung: Mittellinie plus den Ueberstand, den die
 * Form bei 0 Grad ueber die Mittellinie hinaus haengt. Gemessen
 * (`tools/greifer-ausladung.ts`) lag sie beim Fuenfschalengreifer bis zu
 * **153 mm** daneben — der Bodenanschlag haette den gekippten Greifer 15 cm
 * ueber dem Beton gehalten, und damit waere Kehren nicht gegangen. Diese
 * Fassung liegt unter einem Millimeter.
 */
function ausladung(schwenk: number, kipp: number): number {
  if (kipp === 0) return tiefe(schwenk);
  const c = Math.cos(-schwenk);
  const sn = Math.sin(-schwenk);
  const ck = Math.cos(kipp);
  const sk = Math.sin(kipp);
  let weit = -Infinity;
  for (const p of messeZahn()) {
    const y = STEMPEL_AUGE.y + (p.y * c - p.z * sn);
    const r = STEMPEL_AUGE.r + (p.y * sn + p.z * c);
    for (let i = 0; i < MASS.schalen; i++) {
      const d = -y * ck + Math.cos((i / MASS.schalen) * Math.PI * 2) * r * sk;
      if (d > weit) weit = d;
    }
  }
  return weit;
}

let maxTiefeGemerkt: number | null = null;

/**
 * Groesste Tiefe ueber den ganzen Schliessweg (m).
 *
 * Gemessen 2,7511 m, erreicht auf 42 % des Weges — also weder offen (2,217)
 * noch zu (2,499). Genau wie bei der Sichelkralle liegt die tiefste Stellung
 * dazwischen; wer nur die Endlagen vergleicht, setzt den Greifer 0,25 m zu
 * tief ab.
 */
function maxTiefe(): number {
  if (maxTiefeGemerkt !== null) return maxTiefeGemerkt;
  let tief = 0;
  for (let i = 0; i <= 200; i++) tief = Math.max(tief, tiefe(ZU + ((OFFEN - ZU) * i) / 200));
  maxTiefeGemerkt = tief;
  return tief;
}

/* ------------------------------------------------------------------ Der Korb */

const korbR: number[] = new Array(SCHALEN_ABSCHNITTE + 1).fill(0);
const korbY: number[] = new Array(SCHALEN_ABSCHNITTE + 1).fill(0);

/** Die Mittellinie bei diesem Schwenk in die beiden Felder oben legen. */
function bahn(schwenk: number): void {
  const c = Math.cos(-schwenk);
  const sn = Math.sin(-schwenk);
  for (let k = 0; k <= SCHALEN_ABSCHNITTE; k++) {
    const st = STATIONEN[k]!;
    korbR[k] = STEMPEL_AUGE.r + (st.y * sn + st.z * c);
    korbY[k] = STEMPEL_AUGE.y + (st.y * c - st.z * sn);
  }
}

/**
 * Radius des Korbs auf Hoehe `y` (m) — dieselbe Rechnung wie `korbRadius` in
 * `tools/greifer-modelle.ts`, mit der das Korbprofil in E-048 vermessen wurde.
 *
 * Der groesste Wert ueber alle Abschnitte, die diese Hoehe ueberspannen: Die
 * Mittellinie kann eine Hoehe mehrfach schneiden, sobald die Schale sich
 * einrollt.
 */
function korbRadiusBei(y: number): number {
  let r = 0;
  for (let k = 0; k + 1 <= SCHALEN_ABSCHNITTE; k++) {
    const y0 = korbY[k]!;
    const y1 = korbY[k + 1]!;
    if ((y <= y0 && y >= y1) || (y >= y0 && y <= y1)) {
      const t = Math.abs(y1 - y0) < 1e-9 ? 0 : (y - y0) / (y1 - y0);
      r = Math.max(r, korbR[k]! + (korbR[k + 1]! - korbR[k]!) * t);
    }
  }
  return r;
}

/* ---------------------------------------------------------------- Die Form */

const KERN = {
  zu: ZU,
  offen: OFFEN,
  stationen: SCHALEN_ABSCHNITTE,
  schalen: MASS.schalen,
  punkt,
  korbLuftUnten: KORB_LUFT_UNTEN,
  /**
   * Der Sensorsitz bleibt bei 1,50 m — wie bei der Sichelkralle.
   *
   * E-048 hat vorgeschlagen, ihn mit dem Greifer wandern zu lassen: Der Korb
   * des Fuenfschalengreifers reicht von −1,53 bis −2,55, seine Mitte liegt
   * also auf −2,04, und die Kugel haette dort nur noch 0,689 m Radius
   * gebraucht. NACHGEMESSEN ist das die schlechtere Wahl:
   *
   *   Sitz −1,50: der geschlossene Korb liegt bis 0,962 m von der Kugelmitte
   *               entfernt. Mit 1,229 m Radius steckt er ganz in der Kugel.
   *   Sitz −2,04: derselbe Korb reicht bis 1,025 m — die Kugel muesste also
   *               1,205 m messen, nicht 0,689. Mit 0,689 m waere alles
   *               abgeschnitten, was weiter als 69 cm von der Achse im Korb
   *               liegt; der Korbrand misst aber 0,89 m.
   *
   * Das waere der Fehler von E-030 in einer neuen Richtung: damals war die
   * Kugel 46 cm zu kurz, hier waere sie 34 cm zu schmal. Der tiefere Sitz
   * spart also nichts (1,205 gegen 1,229 m) und kostet Deckung. Er bleibt,
   * wo er ist — und die Kugel ist damit dieselbe Rechnung wie bei der
   * Sichelkralle: 2,5489 + 0,18 − 1,50 = 1,2289 m.
   */
  sensorSitz: SICHELKRALLE.sensorSitz,
};

export const FUENFSCHALEN: Greiferform = {
  id: "fuenfschalen",
  name: "Fünfschalengreifer",
  ...KERN,
  tiefe,
  get maxTiefe(): number {
    return maxTiefe();
  },
  ausladung,
  maxAusladung: merkeMaxAusladung(
    () => FUENFSCHALEN,
    () => maxTiefe()
  ),
  /*
   * Die Kugel reicht bis zum Korbboden — und der geht bis an die gezeichneten
   * Zaehne (siehe `imKorb`). Also der tiefere der beiden Werte:
   * Mittellinie + Luft = 1,2289 m, Zahn = 2,7511 − 1,50 = 1,2511 m.
   */
  get sensorRadius(): number {
    return Math.max(sensorRadiusVon(KERN), maxTiefe() - KERN.sensorSitz);
  },
  schalenluecke: schalenlueckeVon(KERN),
  /**
   * Der Korb aus der wirklichen Mittellinie — siehe Kopf dieser Datei.
   *
   * Dieselben drei Lufttoleranzen wie bei der Sichelkralle (0,22 m ueber dem
   * Korbrand, 0,18 m unter den Spitzen, 0,14 m zur Seite). Neu ist nur, dass
   * der Radius dazwischen der gemessene ist und nicht der einer geraden
   * Verjuengung.
   *
   * Oben zaehlt die hoechste Station, nicht die Bolzenebene: Beim Oeffnen
   * schwenken die Schalen ueber ihren Bolzen hinauf (bei halb offen steht die
   * erste Station auf −1,35 statt −1,53). Mit der festen Bolzenebene waere
   * genau der Rand des offenen Korbs abgeschnitten.
   */
  imKorb(p: THREE.Vector3, winkel: number): boolean {
    bahn(winkel);
    let yO = -Infinity;
    let yU = Infinity;
    for (let k = 0; k <= SCHALEN_ABSCHNITTE; k++) {
      yO = Math.max(yO, korbY[k]!);
      yU = Math.min(yU, korbY[k]!);
    }
    /*
     * DER KORBBODEN REICHT BIS AN DIE GEZEICHNETEN ZAEHNE.
     *
     * Die Mittellinie endet dort, wo die Schale in ihre Spitze uebergeht; der
     * ZAHN haengt noch darunter. Bei der Sichelkralle sind das 0,124 m, und die
     * 0,18 m Luft decken sie mit 5,6 cm Rest ab — der Korbboden liegt dort
     * ohnehin unter den Zaehnen. Beim Fuenfschalengreifer sind es 0,202 m: Die
     * Luft reicht NICHT, der Korb endete 2,2 cm ueber den eigenen Zaehnen.
     *
     * Gemessen hat das der Waechter: Ein 6 cm dickes Blech auf dem Beton
     * blieb liegen, obwohl die Zaehne daran standen (`greiferwechsel.test.ts`,
     * „fasst Blech, 6 cm dick"). Deshalb der tiefere der beiden Boeden. Fuer
     * die Sichelkralle waere das dieselbe Zahl wie bisher — sie rechnet
     * trotzdem weiter mit ihrer eigenen, unveraenderten Fassung.
     */
    const boden = Math.min(yU - KORB_LUFT_UNTEN, -tiefe(winkel));
    if (p.y > yO + KORB_LUFT_OBEN || p.y < boden) return false;
    const r =
      korbRadiusBei(Math.max(yU, Math.min(yO, p.y))) + KORB_LUFT_SEITE;
    return Math.hypot(p.x, p.z) <= r;
  },
  /** 0,38 rad an der Sichelkralle — als Anteil am Weg hier 0,635 rad. */
  nachdrueckReserve: SICHELKRALLE.nachdrueckReserve * ANTEIL,
  /** 0,96 rad an der Sichelkralle — als Anteil am Weg hier 1,604 rad. */
  weichReserve: SICHELKRALLE.weichReserve * ANTEIL,
  /** 0,50 rad an der Sichelkralle — als Anteil am Weg hier 0,835 rad. */
  ladungOffen: SICHELKRALLE.ladungOffen * ANTEIL,
  /**
   * 4,0 rad/s an der Sichelkralle — als Anteil am Weg hier 6,683 rad/s.
   *
   * Das ist die stille vierte Zahl aus E-048, und sie ist ein Fehler in
   * Wartestellung: Der Befehl selbst verlangt ueber `CLOSE_TIME` = 0,4 s hier
   * 1,6799 / 0,4 = 4,200 rad/s. Mit den unveraenderten 4,0 wuerde jede Schale
   * dem Befehl ueber den GANZEN Weg hinterherhinken und der Greifer 0,42 s
   * statt 0,40 s schliessen — sichtbar nie, spuerbar als Traegheit, und jede
   * Messung am Schliessweg waere daneben.
   *
   * 4,20 waere das Minimum. Genommen ist der Anteil (6,683), weil damit auch
   * der SPIELRAUM ueber den Befehl derselbe ist wie bei der Sichelkralle
   * (Faktor 1,591) — und an dem haengt, wie schnell eine Schale nach einem
   * Hindernis wieder aufholt und wie weit sie je Schritt nachdrueckt
   * (`NACHDRUECK_TEMPO` rechnet mit `schritt`). Mit 4,20 waere der Spielraum
   * 1,000: Jede Beruehrung haette den Greifer dauerhaft zurueckfallen lassen.
   */
  rate: SICHELKRALLE.rate * ANTEIL,
  /**
   * 0,09 m wie an der Sichelkralle — die einfachste tragfaehige Fassung.
   * Was sie nicht kann, steht im Kopf dieser Datei.
   */
  kolliderRadius: SICHELKRALLE.kolliderRadius,
  /**
   * SW: 1 100 kg. Fuenfschalen-Polypgreifer um 0,6 m³ fuer die 20-t-Klasse
   * wiegen nach Herstellerangaben rund 1,0–1,3 t; nicht einzeln belegt.
   */
  eigengewichtKg: 1100,
  baue(): Greiferbau {
    const g = baueGreifer(stoffe());
    // Die Grabtiefe an DIESEM Modell abgreifen, statt dafuer ein zweites zu
    // bauen — das sparte beim ersten Anbauen eine halbe Sekunde.
    zahnAusModell(g);
    return {
      gruppe: g.wurzel,
      setWinkel(i: number, winkel: number): void {
        g.stelleSchale(i, winkel);
      },
      /* Die Zylinder haengen an der einzelnen Schale und stehen schon. */
      nachfuehren(): void {},
    };
  },
};
