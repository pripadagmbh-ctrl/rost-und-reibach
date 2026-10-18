/**
 * TRAGLAST NACH AUSLADUNG — wie bei einem echten Umschlagbagger (E-152).
 *
 * Patrick, 17.10.2026: „entweder kann ich mehr als 3,5 tonnen heben oder es
 * sollten keine teile über 3,5 tonnen ankommen. auch bezweifle ich, dass 3,5
 * tonnen die grenze sein sollte. hat eh was mit dem winkel zu tun und ein
 * umschlagbagger kann definitiv mehr heben".
 *
 * Bis hierher stand im Greifsystem eine feste Grenze `MAX_TOTAL_KG = 3500`
 * (SW). Eine echte Maschine hat keine Zahl, sondern eine TABELLE: Was sie
 * hebt, haengt am waagrechten Abstand der Last zur Drehmitte (Ausladung) und
 * an der Hoehe. Nah an der Maschine viel, weit draussen wenig — das
 * Kippmoment ist Last mal Hebel.
 *
 * HERKUNFT DER ZAHLEN.
 *  - Datenblatt Fuchs MHL 250 F (Service-Gewicht ~16 t, Reichweite 9,0 m),
 *    Traglast 4-Punkt abgestuetzt, nach ISO 10567 (75 % der statischen
 *    Kipplast bzw. 87 % der hydraulischen Hubkraft), in t:
 *
 *        Ausladung        3,0 m   4,5 m   6,0 m   7,5 m
 *        Lasthoehe 3,0 m   6,0     3,6     2,7     2,2
 *        Lasthoehe 1,5 m   5,0     3,4     2,7     2,2
 *
 *  - Unser Bagger hat Ausleger 5,2 m + Stiel 4,0 m, rund 10 m Reichweite —
 *    die Klasse Fuchs MHL 320 (21 t, 10,4 m Reichweite; KHL, „Terex Fuchs
 *    launches MHL320 D").
 *  - SW: Die MHL-250-Kurve wird auf diese Klasse gestreckt —
 *      Ausladung × 10,4 / 9,0 = 1,156 (gleiche Stellung des Arms liegt bei der
 *                                      groesseren Maschine weiter draussen),
 *      Last      × 21 / 16    = 1,3125 (Kippmoment waechst mit dem Gewicht).
 *    Das ist eine Herleitung, kein Datenblatt der MHL 320.
 *
 * Dazwischen wird linear gerechnet; naeher als die erste Stuetzstelle bleibt
 * der Wert stehen (dort begrenzt die Hydraulik, nicht das Kippen), weiter
 * draussen als die letzte wird die letzte Steigung fortgesetzt. Ueber 3 m
 * Lasthoehe gilt die 3-m-Zeile, unter 1,5 m die 1,5-m-Zeile.
 *
 * Abgezogen wird das Anbaugeraet (`Greiferform.eigengewichtKg`): Die Tabelle
 * gilt am Stielende, und der Greifer haengt dort mit.
 *
 * E-154: Die Tabelle gilt ABGESTUETZT (Pratzen draussen, Taste O). Frei
 * stehend hebt die Maschine `FREI_FAKTOR` davon.
 */

/**
 * E-154: Frei stehend hebt die Maschine zwei Drittel der abgestuetzten Last.
 * SW: Patricks Entscheidung vom 18.10.2026 („Ohne Pratzen ein Drittel
 * weniger"). Die Groessenordnung entspricht dem Verhaeltnis „frei" zu
 * „4-Punkt abgestuetzt" in Datenblaettern von Umschlagbaggern; die Spalte
 * „nicht abgestuetzt" des MHL 250 F liegt hier nicht vor, darum keine
 * hergeleitete Zahl.
 */
export const FREI_FAKTOR = 2 / 3;

/** SW: Streckung der Ausladung, Reichweite MHL 320 / MHL 250 = 10,4 / 9,0 */
const STRECKE_R = 10.4 / 9.0;
/** SW: Streckung der Last, Betriebsgewicht MHL 320 / MHL 250 = 21 / 16 t */
const STRECKE_LAST = 21 / 16;
/** Datenblatt Fuchs MHL 250 F, 4-Punkt abgestuetzt: Ausladung (m) */
const R_250 = [3.0, 4.5, 6.0, 7.5];
/** … Traglast (kg) bei 3,0 m Lasthoehe */
const LAST_250_H3 = [6000, 3600, 2700, 2200];
/** … Traglast (kg) bei 1,5 m Lasthoehe */
const LAST_250_H15 = [5000, 3400, 2700, 2200];

/** Traglast einer Zeile bei Ausladung r (kg), mit Streckung. */
function zeile(lasten: number[], r: number): number {
  const xs = R_250.map((x) => x * STRECKE_R);
  const ys = lasten.map((y) => y * STRECKE_LAST);
  if (r <= xs[0]!) return ys[0]!;
  for (let i = 1; i < xs.length; i++) {
    if (r <= xs[i]!) {
      const t = (r - xs[i - 1]!) / (xs[i]! - xs[i - 1]!);
      return ys[i - 1]! + (ys[i]! - ys[i - 1]!) * t;
    }
  }
  const n = xs.length - 1;
  const steigung = (ys[n]! - ys[n - 1]!) / (xs[n]! - xs[n - 1]!);
  return Math.max(0, ys[n]! + steigung * (r - xs[n]!));
}

/**
 * Was die MASCHINE am Stielende hebt (kg), Anbaugeraet noch nicht abgezogen.
 * `ausladungM`: waagrechter Abstand Stielende ↔ Drehmitte; `hoeheM`: Hoehe
 * des Stielendes ueber dem Boden.
 */
export function maschinenTraglastKg(ausladungM: number, hoeheM: number): number {
  const h3 = zeile(LAST_250_H3, ausladungM);
  const h15 = zeile(LAST_250_H15, ausladungM);
  const t = Math.min(Math.max((hoeheM - 1.5) / 1.5, 0), 1);
  return h15 + (h3 - h15) * t;
}

/**
 * Was an den Greifer gehaengt werden darf (kg): Maschinentraglast (frei
 * stehend × `FREI_FAKTOR`) mal Ausbau-Faktor, minus Eigengewicht des
 * Anbaugeraets. Nie unter null.
 */
export function nutzlastKg(
  ausladungM: number,
  hoeheM: number,
  anbauKg: number,
  ausbau = 1,
  abgestuetzt = true
): number {
  const stand = abgestuetzt ? 1 : FREI_FAKTOR;
  return Math.max(0, maschinenTraglastKg(ausladungM, hoeheM) * stand * ausbau - anbauKg);
}
