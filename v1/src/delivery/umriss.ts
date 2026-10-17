/**
 * DER UMRISS EINES FAHRZEUGS — eine Quelle fuer Fahrt und Waechter.
 *
 * Bis zum 15.09.2026 gab es zwei Figuren fuer denselben Wagen, und sie waren
 * nicht dieselbe (Befund E-051):
 *
 *   | was          | Waechter (`test/fahrumriss.test.ts`) | Fahrt (`vehicles.ts`) |
 *   |--------------|--------------------------------------|-----------------------|
 *   | Figur        | Rechteck ±1,55 m breit, ~8 m lang    | Punkt, Radius 1,40 m  |
 *   | Stellen      | alle 50 cm, ganze Strecke            | vier Punkte 1,2–4,0 m |
 *   |              |                                      | VORAUS                |
 *
 * Zwei Loecher, die beide auf „es klemmt beim Zuruecksetzen" passen:
 *
 *  1. Der Pruefkorridor war SCHMALER als der Wagen — 1,40 m Radius gegen
 *     1,55 m Halbbreite. Die aeusseren 15 cm jeder Flanke wurden nie
 *     geprueft, die Ecken eines schraeg stehenden Wagens deutlich mehr: Ein
 *     Rechteck von 1,55 x 3,72 m ragt in der Diagonale 4,03 m aus seiner
 *     Mitte, der Kreis nur 1,40 m.
 *  2. Beim Rueckwaertssetzen wurde das FALSCHE ENDE geprueft. Abgetastet
 *     wurde die Lage des Fahrzeug-URSPRUNGS vier Meter weiter; beim
 *     Rueckwaertsfahren fuehrt aber das Heck, 3,14 m dahinter. Das Teil, das
 *     zuerst irgendwo hineinfaehrt, wurde nie abgetastet. Und der eigene
 *     Standplatz gar nicht: Die Abtastung begann erst 1,20 m vor dem
 *     Ursprung.
 *
 * Seitdem steht die Figur genau einmal da — hier. `vehicles.ts` baut damit
 * seine Standflaechen (`boxen`), prueft damit auf Bauwerke
 * (`isBlockedByBuilding`), und `test/fahrumriss.test.ts` faehrt damit jede
 * Strecke ab. Wer die Figur aendert, aendert beide.
 */

import type { Box } from "../world/boxen";

/**
 * Halbe Fahrzeugbreite (m).
 *
 * Gelesen aus `vehicleModel.ts`: Die Ladeflaeche ist 2,70 m breit, die
 * Bordwaende und Kotfluegel stehen darueber hinaus. 1,55 m ist das Mass, mit
 * dem `vehicles.boxen()` seit dem 11.09.2026 baut und gegen das der Bagger
 * seine Ausweichbewegung rechnet.
 */
export const UMRISS_HALB_B = 1.55;
/**
 * Wie weit der Wagen VOR die Mitte der Ladeflaeche reicht (m) — die Kabine.
 *
 * Der Ursprung liegt in der Mitte der Ladeflaeche (`vehicleModel.ts`:
 * `bedGroup.position.z = −bedLen/2`). Nach vorn kommen Kabine und Motor.
 */
export const UMRISS_VORN = 1.9;
/** Und wie weit dahinter: der Unterfahrschutz (m). */
export const UMRISS_HINTEN = 0.14;

/** Halbe Breite eines Anhaengers (m) — schmaler als das Zugfahrzeug. */
export const ANHAENGER_HALB_B = 1.35;
/** Wie weit der Anhaenger ueber seine Ladeflaechenmitte hinausragt (m). */
export const ANHAENGER_UEBERSTAND = 0.5;

/** Ab dieser Durchdringung steckt Blech in Beton; darunter ist es Rundung (m). */
export const UMRISS_TOLERANZ = 0.01;

/** Eine Lage auf einer Strecke: Ort und Blickrichtung. */
export interface Pose {
  x: number;
  z: number;
  /** Drehung um die Hochachse (three.js `rotation.y`) */
  rot: number;
}

/** Ein achsparalleles Bauwerk, wie es in `obstacles.ts` steht. */
export interface Rechteck {
  x: number;
  z: number;
  hw: number;
  hd: number;
}

/**
 * Die Standflaeche des Zugfahrzeugs an dieser Lage.
 *
 * Sie sitzt NICHT auf dem Ursprung: Der Wagen ist 2,04 m laenger als seine
 * Ladeflaeche, und davon liegen 1,90 m vorn. Ein symmetrischer Kasten um den
 * Ursprung war hinten 1,46 m zu lang und vorn 0,30 m zu kurz — genau das hat
 * Patrick am Abladeplatz gesehen („die fahren halb durch die Mulde").
 */
export function fahrzeugUmriss(p: Pose, bedLen: number): Box {
  const vorn = bedLen / 2 + UMRISS_VORN;
  const hinten = -(bedLen / 2 + UMRISS_HINTEN);
  const mitte = (vorn + hinten) / 2;
  return {
    x: p.x + Math.sin(p.rot) * mitte,
    z: p.z + Math.cos(p.rot) * mitte,
    hw: UMRISS_HALB_B,
    hd: (vorn - hinten) / 2,
    rot: p.rot,
  };
}

/**
 * Die vier Ecken einer Standflaeche in Weltkoordinaten.
 *
 * Gebraucht, seit der Knick einer Strecke in METERN gemessen wird und nicht
 * mehr nur in Grad (E-081): Wie weit ein Fahrzeug bei einer Drehung springt,
 * haengt nicht am Winkel allein, sondern daran, wie weit seine aeusserste Ecke
 * von der Drehachse absteht. Bei 1,55 x 4,90 m sind das 5,14 m Hebel — 119,9
 * Grad werden daraus 10,75 m.
 *
 * Dieselbe Drehkonvention wie `fahrzeugUmriss`: lokal +z zeigt in
 * Fahrtrichtung, also x += dz·sin(rot) und z += dz·cos(rot).
 */
export function umrissEcken(b: Box): Array<[number, number]> {
  const c = Math.cos(b.rot);
  const s = Math.sin(b.rot);
  const out: Array<[number, number]> = [];
  for (const dx of [-b.hw, b.hw]) {
    for (const dz of [-b.hd, b.hd]) {
      out.push([b.x + dx * c + dz * s, b.z - dx * s + dz * c]);
    }
  }
  return out;
}

/**
 * Wie weit die weiteste Umrissecke zwischen zwei Lagen springt (m).
 *
 * Nicht der Abstand der Mittelpunkte: Ein Wagen, der sich auf der Stelle
 * dreht, versetzt seine Mitte um null und seine Ecke um mehrere Meter — und
 * die Ecke ist es, die in den liegenden Schrott faehrt.
 */
export function eckenSprung(a: Box, b: Box): number {
  const ea = umrissEcken(a);
  const eb = umrissEcken(b);
  let weit = 0;
  for (let i = 0; i < ea.length; i++) {
    const d = Math.hypot(ea[i]![0] - eb[i]![0], ea[i]![1] - eb[i]![1]);
    if (d > weit) weit = d;
  }
  return weit;
}

/**
 * Die Standflaeche eines Anhaengers, gemessen an seiner Kupplungslage.
 *
 * `wx`/`wz` ist der Weltpunkt der Anhaengergruppe, `rot` ihre Weltdrehung —
 * sie knickt gegen das Zugfahrzeug ab und steht deshalb anders.
 */
export function anhaengerUmriss(wx: number, wz: number, rot: number, bedLen: number): Box {
  return {
    x: wx - Math.sin(rot) * (bedLen / 2),
    z: wz - Math.cos(rot) * (bedLen / 2),
    hw: ANHAENGER_HALB_B,
    hd: bedLen / 2 + ANHAENGER_UEBERSTAND,
    rot,
  };
}

/**
 * Der Umriss des ZUGWAGENS eines Gespanns (E-140).
 *
 * Bis E-140 stand fuer den PKW nur `fahrzeugUmriss` mit der Anhaengerlaenge
 * da: Er deckte den Anhaenger ab, wie er bei geradem Gespann steht — das Auto
 * davor kam in keiner Pruefung vor. Seit das Gespann wirklich knickt, braucht
 * es zwei Figuren: das Auto (hier, aus den Achslagen: 0,95 m Ueberhang vor
 * und hinter den Achsen, 1,90 m breit) und den Anhaenger (`anhaengerUmriss`).
 *
 * `vorn` und `hinten` sind die Achslagen des Autos im Wagenrahmen.
 */
export function zugwagenUmriss(p: Pose, vorn: number, hinten: number): Box {
  const mitte = (vorn + hinten) / 2;
  return {
    x: p.x + Math.sin(p.rot) * mitte,
    z: p.z + Math.cos(p.rot) * mitte,
    hw: 0.95,
    hd: (vorn - hinten) / 2 + 0.95,
    rot: p.rot,
  };
}

/**
 * Welche Lage ein Fahrzeug bei Bogenlaenge `s` auf dieser Strecke einnimmt.
 *
 * Dieselbe Rechnung, die `vehicles.placeAt` fuer die Fahrt benutzt — sie steht
 * hier, damit der Waechter nicht seine eigene Abschrift fuehrt. Rueckwaerts
 * heisst: dieselbe Bahn, Kabine um 180 Grad gedreht, Heck voran.
 */
export function poseAuf(route: Array<[number, number]>, s: number, reverse: boolean): Pose {
  let rest = s;
  for (let i = 0; i < route.length - 1; i++) {
    const [ax, az] = route[i]!;
    const [bx, bz] = route[i + 1]!;
    const segLen = Math.hypot(bx - ax, bz - az);
    if (rest <= segLen || i === route.length - 2) {
      const t = segLen > 1e-9 ? Math.min(rest / segLen, 1) : 0;
      return {
        x: ax + (bx - ax) * t,
        z: az + (bz - az) * t,
        rot: Math.atan2(bx - ax, bz - az) + (reverse ? Math.PI : 0),
      };
    }
    rest -= segLen;
  }
  const [ax, az] = route[0]!;
  return { x: ax, z: az, rot: reverse ? Math.PI : 0 };
}

/**
 * Wie weit der Ursprung (Mitte der Ladeflaeche) vor der Mitte der
 * Hinterachsen liegt (m) — beim Dreiachser `bedLen/4 − 0,45`: 0,90 bei
 * 5,40 m Ladeflaeche, 1,05 beim Kipper. Dieselbe Zahl wie
 * `−vehicleModel.lkwFahrwerk(bedLen).hinten`; `test/vehicleModel.test.ts`
 * haelt beide zusammen.
 */
export function ursprungVorAchse(bedLen: number): number {
  return bedLen / 4 - 0.45;
}

/**
 * DIE LAGE, IN DER DER WAGEN BEI FORTSCHRITT `s` WIRKLICH STEHT (E-140).
 *
 * Gefahren wird mit der Hinterachse auf der Strecke — dort lenkt das
 * Einspurmodell hin (`lenkung.folgeSchritt`), und dort steht der Wagen immer
 * tangential. Der Ursprung liegt `vor` Meter davor (in Blickrichtung der
 * Kabine), seine Bogenlaenge ist `s`. Vorwaerts laeuft die Hinterachse also
 * `vor` hinterher, rueckwaerts voraus. Vor dem Anfang und hinter dem Ende
 * ist die Strecke geradeaus verlaengert.
 */
export function lageAuf(
  route: Array<[number, number]>,
  s: number,
  reverse: boolean,
  bedLen: number,
  vor = ursprungVorAchse(bedLen)
): Pose {
  const sa = reverse ? s + vor : s - vor;
  const n = route.length;
  let rest = sa;
  let i = 0;
  // Stueck suchen; vor dem Anfang das erste, hinter dem Ende das letzte.
  for (; i < n - 2; i++) {
    const l = Math.hypot(route[i + 1]![0] - route[i]![0], route[i + 1]![1] - route[i]![1]);
    if (rest <= l) break;
    rest -= l;
  }
  const [ax, az] = route[i]!;
  const [bx, bz] = route[i + 1]!;
  const l = Math.hypot(bx - ax, bz - az) || 1;
  const t = rest / l;
  const rot = Math.atan2(bx - ax, bz - az) + (reverse ? Math.PI : 0);
  return {
    x: ax + (bx - ax) * t + Math.sin(rot) * vor,
    z: az + (bz - az) * t + Math.cos(rot) * vor,
    rot,
  };
}

/** Laenge einer Polylinie (m). */
export function streckenLaenge(route: Array<[number, number]>): number {
  let len = 0;
  for (let i = 0; i < route.length - 1; i++) {
    len += Math.hypot(route[i + 1]![0] - route[i]![0], route[i + 1]![1] - route[i]![1]);
  }
  return len;
}

/**
 * Kern der Pruefung, mit schon ausgerechnetem Sinus und Cosinus.
 *
 * Getrennt, weil `tiefsteDurchdringung` sie je Umriss EINMAL ausrechnet und
 * dann gegen alle 52 Bauwerke haelt. Das ist gemessen, nicht vermutet: mit
 * Winkelfunktion je Paar 0,070 ms fuer einen Fahrzeugtakt, ohne 0,025 ms.
 */
function ueberlappungMitTrig(
  b: Box,
  o: Rechteck,
  cr: number,
  sr: number,
  c: number,
  s: number
): number {
  const dx = b.x - o.x;
  const dz = b.z - o.z;
  /*
   * Auf jeder Achse: Die Ueberlappung zweier Strecken ist die Summe ihrer
   * halben Laengen minus dem Abstand der Mitten — HOECHSTENS aber die ganze
   * Laenge der kuerzeren. Der Deckel fehlte am 15.09.2026 in der ersten
   * Fassung, und bei tiefer Ueberdeckung kam 4,05 statt 3,10 m heraus
   * (gegengerechnet gegen die Eckenfassung ueber 500.000 Zufallslagen).
   */
  const ueb = (extA: number, extB: number, d: number): number =>
    Math.min(extA + extB - Math.abs(d), 2 * extA, 2 * extB);

  // Achse (1,0) und (0,1) — die des Bauwerks.
  const uebX = ueb(b.hw * c + b.hd * s, o.hw, dx);
  if (uebX <= 0) return 0;
  const uebZ = ueb(b.hw * s + b.hd * c, o.hd, dz);
  if (uebZ <= 0) return 0;
  // Die beiden Achsen des gedrehten Rechtecks: (cos, −sin) und (sin, cos).
  const uebU = ueb(b.hw, o.hw * c + o.hd * s, dx * cr - dz * sr);
  if (uebU <= 0) return 0;
  const uebV = ueb(b.hd, o.hw * s + o.hd * c, dx * sr + dz * cr);
  if (uebV <= 0) return 0;
  return Math.min(uebX, uebZ, uebU, uebV);
}

/**
 * Wie tief dieser Umriss in ein achsparalleles Bauwerk steckt (m); 0 = frei.
 *
 * Trennachsensatz ueber vier Achsen: die beiden des Bauwerks und die beiden
 * des gedrehten Rechtecks. Findet sich eine Achse ohne Ueberlappung, beruehren
 * sie sich nicht.
 */
export function umrissUeberlappung(b: Box, o: Rechteck): number {
  /*
   * Ohne eine einzige Zwischenliste gerechnet, und das ist gemessen: Die
   * Fassung mit vier Eckenfeldern je Paar kostete 0,142 ms fuer einen
   * Fahrzeugtakt gegen 52 Bauwerke, diese hier 0,025 ms. Bei bis zu vier
   * Fahrzeugen je Bild ist das der Unterschied zwischen 0,57 und 0,10 ms —
   * auf dem iPhone mini spuerbar.
   *
   * Ein gedrehtes Rechteck gegen ein achsparalleles: Auf jeder der vier
   * Achsen wird die halbe Ausdehnung beider Figuren addiert und mit dem
   * Abstand der Mitten verglichen. Ist der Abstand groesser, liegt eine
   * Trennachse vor und die beiden beruehren sich nicht.
   */
  const cr = Math.cos(b.rot);
  const sr = Math.sin(b.rot);
  return ueberlappungMitTrig(b, o, cr, sr, Math.abs(cr), Math.abs(sr));
}

/** Tiefste Durchdringung dieser Umrisse in dieser Hindernisliste (m). */
export function tiefsteDurchdringung(
  umrisse: readonly Box[],
  hindernisse: readonly Rechteck[]
): number {
  let tief = 0;
  for (const u of umrisse) {
    // Sinus und Cosinus EINMAL je Umriss, nicht einmal je Bauwerk.
    const cr = Math.cos(u.rot);
    const sr = Math.sin(u.rot);
    const c = Math.abs(cr);
    const s = Math.abs(sr);
    for (const o of hindernisse) {
      const d = ueberlappungMitTrig(u, o, cr, sr, c, s);
      if (d > tief) tief = d;
    }
  }
  return tief;
}

/**
 * Alle Fahrzeuglagen entlang einer Strecke, im festen Raster.
 *
 * `schritt` 0,5 m ist gemessen und nicht gegriffen: Der schmalste Pfosten auf
 * dem Platz ist 0,30 m breit; wer weiter springt, kann daran vorbeizielen.
 */
export function umrisseEntlang(
  route: Array<[number, number]>,
  bedLen: number,
  reverse: boolean,
  schritt = 0.5
): Box[] {
  /*
   * Seit E-140 mit der HINTERACHSE auf der Strecke (`lageAuf`): So faehrt der
   * Wagen wirklich. Vorher stand der Ursprung darauf, mit der Richtung der
   * Strecke an DIESER Stelle — im Bogen von 7,5 m ist das 7,6 Grad zu frueh
   * gedreht, und die Heckecke stand 0,4 m neben der Wirklichkeit.
   */
  const out: Box[] = [];
  const laenge = streckenLaenge(route);
  const n = Math.max(1, Math.ceil(laenge / schritt));
  for (let i = 0; i <= n; i++) {
    out.push(fahrzeugUmriss(lageAuf(route, (laenge * i) / n, reverse, bedLen), bedLen));
  }
  return out;
}
