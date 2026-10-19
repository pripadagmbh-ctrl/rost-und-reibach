/**
 * DREI KAROSSERIEFORMEN ZUR WAHL (E-116, 23.09.2026).
 *
 * ANLASS. Patrick, 23.09.2026: „grafisch sollten die autos viel besser werden.
 * können wir das komplett neu denken?" — und auf die Rückfrage nach der
 * Richtung: „Erst zeigen, dann entscheiden."
 *
 * WARUM DER BESTAND NICHT ZU RETTEN WAR. Ein Wrack war zwei Quader: Rumpf
 * 1,70 x 0,55 x 4,00 (Gitter 4x2x9) und Kabine 1,50 x 0,55 x 2,00 (4x2x5).
 * Zwei Unterteilungen in der Höhe heißt DREI Eckpunktreihen — unten, Mitte,
 * oben. Eine Gürtellinie, eine geneigte Windschutzscheibe und ein sich
 * verjüngendes Dach brauchen aber mindestens fünf. Sie waren also nicht
 * ungemacht, sondern geometrisch unmöglich; `formeKarosserie` konnte daran nur
 * noch Kosmetik machen (Schnauze 26 % schmaler, Haube 16 cm abfallend) und das
 * Ergebnis war ein Brotlaib auf Rädern.
 *
 * DIE FORM STECKT JETZT GANZ IN DEN DATEN, und zwar als LÄNGSSCHNITT:
 *
 *   Eine Fassung ist eine Liste von QUERSCHNITTEN entlang der Fahrzeugachse.
 *   Jeder Querschnitt gibt für jede EBENE (Schweller, Flanke, Gürtellinie,
 *   Dachkante, Dachmitte …) eine halbe Breite und eine Höhe an. Die Haut
 *   entsteht, indem benachbarte Querschnitte Ring an Ring verbunden werden.
 *
 * Damit ist alles, was am Bestand unmöglich war, eine Zahl in einer Tabelle:
 * Die Haube fällt ab, weil ihre Gürtelebene vorn tiefer liegt. Die
 * Windschutzscheibe ist geneigt, weil zwischen dem letzten Haubenschnitt und
 * dem ersten Dachschnitt 53 cm Länge und 42 cm Höhe liegen. Das Glashaus ist
 * eingezogen, weil die Dachkante schmaler ist als die Gürtellinie. Die
 * Radläufe sind ausgeschnitten, weil die unteren Ebenen über dem Rad
 * hochgezogen sind.
 *
 * WAS DAS FÜR DIE BEULMECHANIK BEDEUTET. Sie verschiebt Eckpunkte im Umkreis
 * des Druckpunkts (`CarComposite.dent`) und rechnet auf keinem besonderen
 * Gitter — sie wird mit jedem Eckpunkt feiner. Der Bestand hatte 316 Eckpunkte
 * in Rumpf und Kabine, diese Fassungen haben 152 bis 300, aber über die ganze
 * Karosserie verteilt statt in zwei Klötzen (Messung in `tools/wrackbild.ts`).
 *
 * WAS DAS FÜR DIE ZEICHENRUFE BEDEUTET. Aus zwei Netzen (Rumpf + Kabine) wird
 * EINES. Ein Wrack kostet damit 12 statt 13 Netze, also 24 statt 26
 * Zeichenrufe mit Schattenwurf — die Obergrenze aus E-111 bleibt unterboten.
 * Dreiecke wachsen dafür, und das ist die richtige Richtung: Zeichenrufe sind
 * der Engpass, nicht Dreiecke (E-025).
 */

import * as THREE from "three";
import type { AnbauDef } from "./carDef";

export type WrackformId = "bestand" | "a" | "b" | "c" | GrosswrackId;
/** Die Fassungen, die kein Pkw sind (E-135) — jede gehört zu genau einem `CarDef`. */
export type GrosswrackId = "lkw" | "wohnwagen";

/**
 * DAS GESICHT FÜR ALLE DREI FASSUNGEN — Stoßstangen, Grill, Leuchten, Spiegel.
 *
 * WARUM NICHT DIE LISTE AUS `CarDef`. Nachgemessen am 23.09.2026: Dort sitzen
 * Grill und Scheinwerfer bei z = 1,90 bis 1,95 m und damit INNERHALB der
 * Karosserie, die bis z = 2,00 m reicht. Beim Bestand fällt das kaum auf, weil
 * dessen Schnauze durch `formeKarosserie` 26 % schmaler wird und die Leuchten
 * seitlich ein, zwei Zentimeter hervorschauen. Die Fassungen aus E-116 haben
 * vorn einen geschlossenen Deckel — dort wären Grill und Leuchten vollständig
 * verschluckt, und „ein Kasten mit Rädern liest sich erst als Auto, wenn vorne
 * ein Gesicht dran ist" (E-111) gälte wieder nicht.
 *
 * Alle drei Fassungen teilen diese eine Liste: Ihre Deckel liegen alle bei
 * z = ±2,00 m, ihr Gesicht ist also dasselbe. Wird eine Fassung gewählt, ist
 * das der Ort, an dem ihr Gesicht feiner wird.
 *
 * Die Höhen sind absolute Meter (siehe `AnbauDef`): Stoßstange 0,30 m,
 * Leuchten 0,56 m. Beides liegt im Bereich, den die Zulassung vorschreibt
 * (Stoßstange 0,25–0,50 m, Scheinwerfer 0,50–1,20 m über der Fahrbahn) — der
 * Bestand hatte 0,22 und 0,44 m, also beide zu tief. // Quelle: ECE-R 48
 */
export const ANBAU_E116: AnbauDef[] = [
  { name: "Stoßstange vorn", size: [1.2 / 1.7, 0.18, 0.18], anchor: [0, 0.3, 1.96 / 2.0], farbe: 0x24262a },
  { name: "Stoßstange hinten", size: [1.2 / 1.7, 0.18, 0.18], anchor: [0, 0.3, -1.96 / 2.0], farbe: 0x24262a },
  // Der Deckel liegt bei 2,00 m, die Teile sind 6 cm tief: Sie stehen 3 cm vor.
  { name: "Kühlergrill", size: [0.56 / 1.7, 0.18, 0.06], anchor: [0, 0.55, 2.0 / 2.0], farbe: 0x9aa0a6 },
  // Farben mit eingerechnetem Eigenleuchten, wie in `CAR_DEF` (E-111).
  { name: "Scheinwerfer", size: [0.28 / 1.7, 0.14, 0.06], anchor: [0.44 / 0.85, 0.56, 2.0 / 2.0], paarweise: true, farbe: 0xfffff4 },
  { name: "Rückleuchte", size: [0.26 / 1.7, 0.2, 0.06], anchor: [0.46 / 0.85, 0.58, -2.0 / 2.0], paarweise: true, farbe: 0xb82b1e },
  /*
   * Der Spiegel sitzt AUF DER FLANKE, x folgt aus den Querschnitten (E-127).
   * Bis dahin stand er auf x = 0,92 m wie am Bestand-Kasten — das Glashaus
   * der Fassungen ist eingezogen, und auf Patricks Fotos vom 06.10.2026
   * schwebte er als schwarzer Würfel neben dem Auto. Höhe 1,0 m und Längslage
   * 0,62 m (Fuß der A-Säule) bleiben, wie sie waren.
   */
  { name: "Außenspiegel", size: [0.16 / 1.7, 0.1, 0.08], anchor: [0, 1.0, 0.62 / 2.0], paarweise: true, amFlanke: true, farbe: 0x24262a },
];

/**
 * Halbe Breite der Haut in m, auf Höhe `y` bei Längslage `z` (Wrack-lokal,
 * ungequetscht) — genau so, wie `baueWrackform` sie spannt: Zwischen zwei
 * Querschnitten ist die rechte Flanke aus Dreiecken (a, b, c) und (a, c, d)
 * gebaut; gesucht ist der äußerste Punkt, an dem die Waagerechte durch (y, z)
 * eines davon trifft. Ein Mischen der Querschnitte in z, dann in y, lag an
 * der A-Säule bis 9 cm daneben — so weit wie die Diagonale die Vierecke
 * knickt. Keine Haut auf dieser Höhe → 0.
 */
export function halbeBreiteBei(form: WrackformDef, y: number, z: number): number {
  const S = form.schnitte;
  const n = form.ebenen.length;
  const punkt = (k: number, e: number): [number, number, number] => {
    const s = S[k]!;
    return [s.b[e]! * (form.breite / 2), (s.y ?? form.ebenen)[e]!, s.z * (form.laenge / 2)];
  };
  let best = 0;
  for (let s = 0; s + 1 < S.length; s++) {
    for (let e = 0; e + 1 < n; e++) {
      const a = punkt(s, e);
      const b = punkt(s + 1, e);
      const c = punkt(s + 1, e + 1);
      const d = punkt(s, e + 1);
      for (const [p, q, r] of [[a, b, c], [a, c, d]] as const) {
        // Schwerpunktkoordinaten in der (y, z)-Ebene
        const det = (q[1] - p[1]) * (r[2] - p[2]) - (r[1] - p[1]) * (q[2] - p[2]);
        if (Math.abs(det) < 1e-12) continue;
        const u = ((y - p[1]) * (r[2] - p[2]) - (r[1] - p[1]) * (z - p[2])) / det;
        const v = ((q[1] - p[1]) * (z - p[2]) - (y - p[1]) * (q[2] - p[2])) / det;
        if (u < -1e-9 || v < -1e-9 || u + v > 1 + 1e-9) continue;
        best = Math.max(best, p[0] + u * (q[0] - p[0]) + v * (r[0] - p[0]));
      }
    }
  }
  return best;
}

/**
 * Ein Anbauteil mit `amFlanke` an die Karosserie dieser Fassung setzen: Seine
 * Innenseite liegt an der breitesten Stelle der Flanke über seiner ganzen Höhe
 * — so berührt es das Blech, statt zu schweben, und steckt nirgends darin.
 * Abgetastet in 21 Höhen (beim Spiegel alle 5 mm).
 */
export function aufDieFlanke(form: WrackformDef, a: AnbauDef): AnbauDef {
  if (!a.amFlanke) return a;
  const z = a.anchor[2] * (form.laenge / 2);
  const unten = a.anchor[1] - a.size[1] / 2;
  const oben = a.anchor[1] + a.size[1] / 2;
  let flanke = 0;
  for (let k = 0; k <= 20; k++) flanke = Math.max(flanke, halbeBreiteBei(form, unten + ((oben - unten) * k) / 20, z));
  const x = flanke + (a.size[0] * form.breite) / 2;
  return { ...a, anchor: [x / (form.breite / 2), a.anchor[1], a.anchor[2]] };
}

/**
 * EIN QUERSCHNITT durch die Karosserie.
 *
 * `b` und `y` haben so viele Einträge, wie die Fassung Ebenen hat — sonst wäre
 * das Gitter nicht rechteckig, und `baueWrackform` bricht ab.
 */
export interface SchnittDef {
  /** Wofür dieser Schnitt steht — Schnauze, Radlauf, A-Säule. Nur zum Lesen. */
  name: string;
  /** Längslage als Anteil der HALBEN Fahrzeuglänge: +1 Schnauze … −1 Heck */
  z: number;
  /** Halbe Breite je Ebene, als Anteil der HALBEN Fahrzeugbreite */
  b: number[];
  /**
   * Höhe je Ebene über dem Boden, in m — muss von unten nach oben steigen,
   * sonst schlägt der Querschnitt um. Fehlt sie, gelten die `ebenen` der
   * Fassung unverändert.
   */
  y?: number[];
  /** Schattenfuge: die Eckpunkte dieses Schnitts werden abgedunkelt. */
  fuge?: boolean;
}

/**
 * EINE SCHEIBE — als Feld im Gitter, nicht als eigene Kiste mit eigenen Maßen.
 *
 * Bis E-116 war jede Scheibe ein Quader mit vier handgesetzten Zahlen
 * (`CarDef.windows`). Bei einer geneigten Windschutzscheibe stimmt so etwas nie
 * lange: Ändert man die Dachhöhe um zwei Zentimeter, steht das Glas im Nichts.
 * Deshalb ist eine Scheibe hier nur noch die ANGABE, WELCHES STÜCK HAUT Glas
 * ist — ein rechteckiger Bereich von Querschnitten und Ringpunkten. Die
 * Geometrie dazu kommt aus derselben Rechnung wie die Karosserie und passt
 * damit immer.
 *
 * Die Haut darunter bleibt stehen. Zerspringt die Scheibe, sieht man also
 * lackiertes Blech — genau wie vorher, und nicht durch das Auto hindurch.
 */
export interface ScheibeDef {
  id: string;
  /** Erster und letzter Querschnitt (Index in `schnitte`, einschließlich) */
  vonSchnitt: number;
  bisSchnitt: number;
  /** Erster und letzter Ringpunkt (einschließlich), siehe Ringordnung unten */
  vonRing: number;
  bisRing: number;
}

export interface WrackformDef {
  /** Name für die Bildunterschrift */
  name: string;
  /** Ein Satz, was an dieser Fassung anders gedacht ist */
  absicht: string;
  /**
   * Breite und Länge in m. Beide stehen absichtlich auf den Maßen von
   * `karosserie.chassis` (1,70 x 4,00): An ihnen hängen die Anbauteile (deren
   * Sitz als Anteil der halben Breite/Länge angegeben ist), der Kollider und
   * die Radanker. Eine Fassung, die daran dreht, braucht eine
   * Erreichbarkeits- und Kollider-Rechnung obendrauf — das wäre ein eigener
   * Auftrag.
   */
  breite: number;
  laenge: number;
  /** Grundhöhe je Ebene über dem Boden, in m — unten zuerst. */
  ebenen: number[];
  schnitte: SchnittDef[];
  scheiben: ScheibeDef[];
  /** Lack glatt schattieren statt flächig (weiche Übergänge). */
  glatt?: boolean;
  /**
   * Halbtori über den Rädern bauen. Nur für den Bestand sinnvoll: Wo die
   * Karosserie einen echten Radlauf-Ausschnitt hat, läge der Bogen im Blech.
   */
  radlaufBogen?: boolean;
  /** Räder dieser Fassung [Radius, Breite] in m; fehlt → wie in `CarDef`. */
  rad?: [number, number];
  /** Anbauteile dieser Fassung; fehlt → die Liste aus `CarDef.karosserie`. */
  anbau?: AnbauDef[];
  /** Wie stark eine Schattenfuge abdunkelt, 0…1. */
  fugeDunkel?: number;
  /**
   * Der hohle Körper für die Physik (E-124): ein Verbund aus Quadern statt
   * EINES Klotzes. Fehlt die Liste, bleibt das Wrack der Quader aus
   * `CarDef.colliderHalf` (Bestand, A, B). Der ERSTE Eintrag ist der Boden: Er
   * trägt die Masse. Der Bagger fragt beim Zufassen alle Kollider (E-127).
   * Eine Fassung mit `bleche` braucht `knautsch` — danach gehen die Quader in
   * der Höhe mit (E-128).
   */
  bleche?: BlechDef[];
  /** Wie die Karosserie zusammenknautscht (E-128). */
  knautsch?: KnautschDef;
  /**
   * DIE MOTORHAUBE (E-185) — ein Feld der Haut wie eine Scheibe, nur aus
   * Blech: Es wird aus der Karosserie geschnitten und ist ein eigenes Netz,
   * das aufspringt und abgeht. Die hintere Kante (`bisSchnitt`) ist das
   * Scharnier. Fehlt es, hat die Fassung keine Haube als Teil.
   */
  haube?: ScheibeDef;
  /**
   * DIE INNENAUSSTATTUNG (E-185) — Sitze, Rückbank, Armaturenbrett. Nur zum
   * Ansehen (Zerstörungskonzept Frage 2 A): Sie liegt im Anbau-Netz, knautscht
   * mit und kostet kein Netz. Maße und Sitz wie `AnbauDef`, aber INNEN — sie
   * berührt die Haut nicht.
   */
  innen?: AnbauDef[];
}

/**
 * EIN STÜCK HOHLKÖRPER (E-124) — ein Quader im Verbund. Seit E-128 gibt er
 * nicht mehr einzeln nach, sondern folgt in der Höhe derselben Knautschrechnung
 * wie die Haut (`knautschHoehe`). Maße in m, Wrack-lokal (Ursprung Mitte
 * Unterkante, +z Schnauze), am heilen Wrack.
 */
export interface BlechDef {
  name: string;
  mitte: [number, number, number];
  halb: [number, number, number];
}

/**
 * EINE KNAUTSCHZONE (E-128) — ein Höhenband der Karosserie, das als Ganzes
 * zusammengeht und dabei EINE Falte wirft.
 *
 * Wie eine Blechdose unter dem Stiefel: Die Wand wird nicht gleichmäßig
 * kürzer, sie knickt. Das Blech behält seine Länge; was in der Höhe fehlt,
 * steht als Falte zur Seite heraus (`nach` +1) oder knickt hinein (−1), und
 * zwar am Knick, an dem ein Ring der Haut liegt.
 *
 * `ab` und `voll` sagen, in welcher Reihenfolge die Zonen nachgeben: Der
 * örtliche Knautschgrad h (0 heil … 1 flach) muss erst `ab` überschreiten,
 * bevor diese Zone sich rührt, und bei `voll` ist sie auf `rest`
 * zusammengelegt. Darunter (unter dem `von` der ersten Zone) ist alles starr.
 */
export interface KnautschZone {
  name: string;
  /** Unterkante und Oberkante des Bandes am heilen Wrack, m */
  von: number;
  bis: number;
  /** Höhe, auf die das Band ganz zusammengelegt wird, m */
  rest: number;
  /** Knautschgrad, ab dem das Band nachgibt und bei dem es flach ist */
  ab: number;
  voll: number;
  /** Höhe des Knicks, m — dort muss ein Ring der Haut liegen */
  knick: number;
  /** +1 die Falte steht nach außen, −1 sie knickt nach innen */
  nach: 1 | -1;
}

export interface KnautschDef {
  /** Von unten nach oben, lückenlos: `bis` einer Zone ist `von` der nächsten. */
  zonen: KnautschZone[];
  /**
   * In welcher Höhe eine Spinne, die NEBEN dem Wrack steht, seitlich
   * hineindrückt, m — mitten in die Türen. Fehlt es, gilt 0,75 m (Pkw, E-124).
   */
  seitenHoehe?: number;
  /**
   * Wie viel weiter ein Biss das Blech mitnimmt als am Pkw (E-135). Ein Biss
   * drückt das Auto um höchstens 0,2 m ein; eine Wohnwagenwand aus Alublech,
   * Styropor und Sperrholz trägt die Schale nicht so lange — sie geht weiter
   * mit. Fehlt es, gilt 1.
   */
  wegFaktor?: number;
}

/**
 * Wie weit eine Falte zur Seite steht, als Anteil dessen, was die Blechlänge
 * erzwingen würde (½·√(L² − l²)). Ganz ausgeschöpft stünden die Säulen 24 cm
 * heraus — über die Spiegel hinaus. // SW
 */
const FALTE = 0.75;
/** Längs gesehen läuft eine Falte nicht gerade: ihre Tiefe schwankt mit dieser Wellenlänge, m. // SW */
const FALTE_WELLE = 0.9;
/** Haube, Dach und Klappe werfen beim Knautschen Wellen: so hoch, m … // SW */
const DECKEL_HUB = 0.05;
/** … in diesem Abstand, m. // SW */
const DECKEL_WELLE = 0.7;
/**
 * Der Deckel gibt in der Mitte mehr nach als an den Kanten, wo die Säulen und
 * Kotflügel ihn halten: so viel tiefer in der Mitte, m — der Abdruck des
 * Stiefels. // SW
 */
const DECKEL_MULDE = 0.06;
/** Was so weit unter der Oberkante seines Querschnitts liegt, gehört zum Deckel, m. // SW */
const DECKEL_TIEFE = 0.15;
/**
 * Nur Flanken falten sich zur Seite, nicht die Mitte von Haube und Dach:
 * voll ab diesem Anteil der halben Breite, gar nicht unter `SEITE_AB`. // SW
 */
const SEITE_AB = 0.53;
const SEITE_VOLL = 0.88;
/**
 * Wie uneben eine Falte wird: Ihre Tiefe schwankt von Ort zu Ort um bis zu
 * diesen Anteil. // SW
 */
const KNITTER = 0.5;
/**
 * Wie weit ein ganz zusammengelegtes Stück Blech in alle Richtungen
 * zerknüllt, m. Ohne das liegen die Falten als gerade Linien da — wie
 * gezogen, nicht wie gedrückt. // SW
 */
const KNUELL = 0.05;
/** Wie groß eine Knülle ist, m — etwa der Abstand zweier Querschnitte. // SW */
const KNUELL_ZELLE = 0.3;

/**
 * Ein glattes Rauschen über den ORT, −1…1, Kanal `k` (0, 1, 2).
 *
 * Über den Ort und nicht je Eckpunkt-Nummer, und das ist Absicht: Haut,
 * Scheiben und Anbauteile sind drei Netze mit eigener Zählung. Liegen zwei
 * ihrer Eckpunkte 12 mm auseinander (die Scheibe über dem Blech), bekommen sie
 * so fast denselben Wert und knüllen zusammen, statt auseinanderzulaufen.
 * Fest, nicht gewürfelt — am Zufallsstrom der anderen Wächter ändert sich
 * nichts (Regel aus E-124).
 */
function rauschen(x: number, y: number, z: number, k: number): number {
  const fx = x / KNUELL_ZELLE;
  const fy = y / KNUELL_ZELLE;
  const fz = z / KNUELL_ZELLE;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const iz = Math.floor(fz);
  const tx = glatt(fx - ix);
  const ty = glatt(fy - iy);
  const tz = glatt(fz - iz);
  return mische(
    mische(mische(gitter(ix, iy, iz, k), gitter(ix + 1, iy, iz, k), tx), mische(gitter(ix, iy + 1, iz, k), gitter(ix + 1, iy + 1, iz, k), tx), ty),
    mische(mische(gitter(ix, iy, iz + 1, k), gitter(ix + 1, iy, iz + 1, k), tx), mische(gitter(ix, iy + 1, iz + 1, k), gitter(ix + 1, iy + 1, iz + 1, k), tx), ty),
    tz
  );
}
const glatt = (t: number): number => t * t * (3 - 2 * t);
const mische = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Fester Wert −1…1 je Gitterpunkt und Kanal. */
function gitter(a: number, b: number, c: number, k: number): number {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(c, 2147483647) ^ Math.imul(k + 1, 2654435761);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 2147483647.5 - 1;
}

const zuEins = (v: number): number => Math.min(1, Math.max(0, v));

/** Wie weit eine Zone bei Knautschgrad h zusammengelegt ist, 0…1. */
function zonenGrad(z: KnautschZone, h: number): number {
  return zuEins((h - z.ab) / (z.voll - z.ab));
}

/**
 * DIE HÖHE NACH DEM KNAUTSCHEN — für Haut UND Kollider (E-128).
 *
 * Eine Stelle, die heil auf Höhe `y` liegt, liegt bei Knautschgrad `h` hier.
 * Jede Zone wird für sich auf ihre neue Höhe gestaucht, und was darüber liegt,
 * rückt um genau so viel nach unten. Damit ist die Rechnung monoton: Keine
 * Ebene der Haut kann durch eine andere hindurchrutschen.
 */
export function knautschHoehe(k: KnautschDef, y: number, h: number): number {
  let neu = k.zonen[0]!.von;
  if (y <= neu) return y;
  for (const z of k.zonen) {
    const p = zonenGrad(z, h);
    const hoehe = (z.bis - z.von) * (1 - p) + z.rest * p;
    if (y <= z.bis) return neu + ((y - z.von) / (z.bis - z.von)) * hoehe;
    neu += hoehe;
  }
  return neu + (y - k.zonen[k.zonen.length - 1]!.bis);
}

/** Wie weit die Oberkante herunterkommt, wenn alles flach ist, m — der Weg, den ein Biss zurücklegt. */
export function knautschWeg(k: KnautschDef): number {
  return k.zonen.reduce((s, z) => s + (z.bis - z.von - z.rest), 0);
}

/**
 * Die Oberkante der Haut bei Längslage z (m, heil): die höchste Ebene der
 * beiden Querschnitte daneben, dazwischen gemischt. Darunter liegt der
 * „Deckel" — Haube, Dach, Klappe.
 */
export function oberkanteBei(form: WrackformDef, z: number): number {
  let oben = OBERKANTEN.get(form);
  if (!oben) OBERKANTEN.set(form, (oben = form.schnitte.map((s) => Math.max(...(s.y ?? form.ebenen)))));
  const S = form.schnitte;
  const hl = form.laenge / 2;
  if (z >= S[0]!.z * hl) return oben[0]!;
  for (let i = 0; i + 1 < S.length; i++) {
    const a = S[i]!.z * hl;
    const b = S[i + 1]!.z * hl;
    if (z <= a && z >= b) {
      const t = a === b ? 0 : (a - z) / (a - b);
      return oben[i]! * (1 - t) + oben[i + 1]! * t;
    }
  }
  return oben[S.length - 1]!;
}
/** Höchste Ebene je Querschnitt, einmal je Fassung gerechnet (wird je Eckpunkt und Biss gefragt). */
const OBERKANTEN = new WeakMap<WrackformDef, number[]>();

/**
 * DIE KNAUTSCHFUNKTION (E-128) — EIN Punkt der Haut bei Knautschgrad h.
 *
 * Patrick, 16.10.2026: „autos müssen holkörper werden" — gewählt: „Wie eine
 * Blechdose knautschen — beim Zudrücken faltet und knickt das ganze Auto
 * zusammen, Dach und Flanken klappen ein, statt dass nur einzelne Bleche
 * eindellen."
 *
 * Vier Bewegungen, alle aus derselben Zahl h:
 *  1. die Höhe (`knautschHoehe`) — Glashaus zuerst, dann die Türen, zuletzt
 *     Schweller und Sicke;
 *  2. die Falte — in jeder Zone steht das Blech am Knick so weit zur Seite,
 *     wie die verlorene Höhe es erzwingt: Säulen heraus, Türen hinein, Sicke
 *     heraus; längs schwankt die Tiefe, damit es nach Blech aussieht und
 *     nicht nach einer gezogenen Linie;
 *  3. der Deckel — Haube, Dach und Klappe werfen Wellen quer zur Fahrtrichtung
 *     und geben in der Mitte nach, zwischen den Kanten, die sie halten;
 *  4. das Knüllen — was zusammengelegt ist, verrutscht ein Stück in alle
 *     Richtungen, so weit, wie es schon zusammengelegt ist.
 *
 * Dieselbe Funktion gilt für Karosserie, Scheiben und Anbauteile, für den Biss
 * der Spinne und für die Presse. Ergebnis nach `out`, Wrack-lokal.
 */
export function knautschPunkt(
  form: WrackformDef,
  x: number,
  y: number,
  z: number,
  h: number,
  out: THREE.Vector3
): THREE.Vector3 {
  const k = form.knautsch!;
  out.set(x, knautschHoehe(k, y, h), z);
  if (h <= 0) return out;
  const i = k.zonen.findIndex((zo) => y > zo.von && y <= zo.bis);
  if (i < 0) return out;
  const zo = k.zonen[i]!;
  const p = zonenGrad(zo, h);
  if (p <= 0) return out;
  const r0 = rauschen(x, y, z, 0);
  const r1 = rauschen(x, y, z, 1);
  const r2 = rauschen(x, y, z, 2);
  const knitter = 1 + KNITTER * r0;
  const seite = zuEins((Math.abs(x) / (form.breite / 2) - SEITE_AB) / (SEITE_VOLL - SEITE_AB));
  if (seite > 0) {
    const L = zo.bis - zo.von;
    const l = L * (1 - p) + zo.rest * p;
    const tiefe = 0.5 * Math.sqrt(L * L - l * l) * FALTE;
    const amKnick = y < zo.knick ? (y - zo.von) / (zo.knick - zo.von) : (zo.bis - y) / (zo.bis - zo.knick);
    const laengs = 0.6 + 0.4 * Math.sin((z * 2 * Math.PI) / FALTE_WELLE + i * 2.1);
    out.x += Math.sign(x) * zo.nach * tiefe * amKnick * seite * laengs * knitter;
  }
  // Der Deckel wellt sich mit der Zone, in der er liegt
  const deckel = zuEins(1 - (oberkanteBei(form, z) - y) / DECKEL_TIEFE);
  if (deckel > 0) {
    const quer = 1 - Math.min(1, (x / (form.breite / 2)) ** 2);
    out.y += p * deckel * (DECKEL_HUB * Math.sin((z * 2 * Math.PI) / DECKEL_WELLE) * knitter - DECKEL_MULDE * quer);
  }
  // Knüllen: in der Höhe nur halb, sonst stäche ein Deckel über den Kollider
  out.x += KNUELL * p * r1;
  out.y += 0.5 * KNUELL * p * r2;
  out.z += KNUELL * p * r0;
  return out;
}

/**
 * Wie eine Scheibe über dem Blech liegt, in m.
 *
 * 12 mm: genug, dass die beiden Flächen sich auf dem iPhone nicht ins
 * Z-Gefecht begeben (dort reichten bei der Abrechnungstafel 8 mm nicht immer),
 * wenig genug, dass die Scheibe nicht als Platte aufliegt. // SW
 */
const SCHEIBEN_LUFT = 0.012;

export interface Wrackbau {
  /** Die ganze Karosserie als EIN Netz, Farbe an den Eckpunkten. */
  koerper: THREE.BufferGeometry;
  scheiben: { id: string; geo: THREE.BufferGeometry }[];
  /**
   * Die Motorhaube (E-185), Wrack-lokal wie die Haut, mit Lack an den
   * Eckpunkten; `scharnier` ist die Mitte ihrer hinteren Kante, `mitte` der
   * Schwerpunkt ihrer Eckpunkte. Fehlt, wenn die Fassung keine Haube hat.
   */
  haube?: { geo: THREE.BufferGeometry; scharnier: THREE.Vector3; mitte: THREE.Vector3 };
}

/**
 * Mitte und Scharnier der Motorhaube einer Fassung (E-185), ohne ein Netz zu
 * bauen — `wrackDaten` braucht den Anker, bevor das Wrack gebaut ist.
 * Dieselben Eckpunkte wie `baueWrackform`.
 */
export function haubeLage(form: WrackformDef): { mitte: THREE.Vector3; scharnier: THREE.Vector3; groesse: THREE.Vector3 } | null {
  const h = form.haube;
  if (!h) return null;
  const n = form.ebenen.length;
  const mitte = new THREE.Vector3();
  const scharnier = new THREE.Vector3();
  const box = new THREE.Box3();
  const p = new THREE.Vector3();
  let k = 0;
  let ks = 0;
  for (let s = h.vonSchnitt; s <= h.bisSchnitt; s++) {
    const sch = form.schnitte[s]!;
    const y = sch.y ?? form.ebenen;
    for (let r = h.vonRing; r <= h.bisRing; r++) {
      const { ebene, seite } = ringEbene(r, n);
      p.set(seite * sch.b[ebene]! * (form.breite / 2), y[ebene]!, sch.z * (form.laenge / 2));
      mitte.add(p);
      box.expandByPoint(p);
      k++;
      if (s === h.bisSchnitt) {
        scharnier.add(p);
        ks++;
      }
    }
  }
  return { mitte: mitte.divideScalar(k), scharnier: scharnier.divideScalar(ks), groesse: box.getSize(new THREE.Vector3()) };
}

/**
 * DIE RINGORDNUNG — sie ist der Schlüssel zu den Scheiben-Indizes.
 *
 * Ein Querschnitt mit n Ebenen hat 2n Ringpunkte:
 *
 *   r = 0 … n−1    rechte Seite, von der untersten Ebene nach oben
 *   r = n … 2n−1   linke Seite, von der obersten Ebene nach unten
 *
 * Bei fünf Ebenen ist also r = 2 die rechte Gürtellinie, r = 3 die rechte
 * Dachkante, r = 4 und r = 5 die Dachmitte rechts und links, r = 6 die linke
 * Dachkante, r = 7 die linke Gürtellinie. Der Ring ist geschlossen: die
 * Strecke von r = 2n−1 zurück zu r = 0 ist der Unterboden.
 */
function ringEbene(r: number, n: number): { ebene: number; seite: number } {
  return r < n ? { ebene: r, seite: 1 } : { ebene: 2 * n - 1 - r, seite: -1 };
}

/**
 * Aus einer Fassung die Karosserie und ihre Scheiben bauen.
 *
 * Der Lack sitzt an den Eckpunkten, nicht am Material (Regel aus E-025/E-105):
 * Damit kommen alle Wracks mit EINEM Karosseriematerial je Fassung aus, und
 * jedes trägt trotzdem seinen eigenen Standortlack.
 */
export function baueWrackform(form: WrackformDef, lack: number): Wrackbau {
  const n = form.ebenen.length;
  const R = 2 * n;
  const S = form.schnitte.length;
  if (S < 2) throw new Error(`${form.name}: eine Fassung braucht mindestens zwei Querschnitte`);
  const hb = form.breite / 2;
  const hl = form.laenge / 2;

  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const grund = new THREE.Color(lack);
  const dunkel = grund.clone().multiplyScalar(1 - (form.fugeDunkel ?? 0.45));

  for (const s of form.schnitte) {
    const y = s.y ?? form.ebenen;
    if (s.b.length !== n || y.length !== n) {
      throw new Error(`${form.name}, Schnitt "${s.name}": ${n} Ebenen erwartet`);
    }
    const c = s.fuge ? dunkel : grund;
    for (let r = 0; r < R; r++) {
      const { ebene, seite } = ringEbene(r, n);
      pos.push(seite * s.b[ebene]! * hb, y[ebene]!, s.z * hl);
      col.push(c.r, c.g, c.b);
    }
  }

  /*
   * Die Haut: je zwei benachbarte Querschnitte und je zwei benachbarte
   * Ringpunkte spannen ein Viereck auf. Die Umlaufrichtung ist nicht beliebig
   * — mit den Querschnitten von der Schnauze zum Heck geordnet zeigen die
   * Normalen so nach AUSSEN (nachgerechnet in `test/carShape.test.ts`, sonst
   * wäre das Auto von außen unsichtbar).
   */
  /*
   * HINTER DEM GLAS IST NICHTS (E-138, Patrick 17.10.2026: „wenn die
   * Glasscheiben splittern, soll es dahinter halt auch leerer Raum sein").
   *
   * Bis hierher lief die lackierte Haut UNTER jeder Scheibe durch — die
   * Scheibe lag 12 mm davor. Splitterte sie, sah man auf Blech in Wagenfarbe:
   * ein voller Klotz. Jetzt bleibt das Feld der Scheibe in der Haut offen,
   * und der Lackstoff ist beidseitig (`lackStoff`), damit man von innen die
   * Rueckseite der Bleche sieht: Boden, Stirnwaende, die Innenseite der
   * gegenueberliegenden Tuer. Die Eckpunkte bleiben alle (Knautschen und
   * Beulen rechnen je Eckpunkt), es fallen nur Dreiecke weg.
   */
  const offen = new Set<number>();
  // E-185: Auch das Feld der Motorhaube bleibt in der Haut offen — die Haube ist ein eigenes Netz.
  for (const sch of form.haube ? [...form.scheiben, form.haube] : form.scheiben) {
    for (let s = sch.vonSchnitt; s < sch.bisSchnitt; s++) {
      for (let r = sch.vonRing; r < sch.bisRing; r++) offen.add(s * R + r);
    }
  }
  for (let s = 0; s + 1 < S; s++) {
    for (let r = 0; r < R; r++) {
      if (offen.has(s * R + r)) continue;
      const r1 = (r + 1) % R;
      const a = s * R + r;
      const b = (s + 1) * R + r;
      const c = (s + 1) * R + r1;
      const d = s * R + r1;
      idx.push(a, b, c, a, c, d);
    }
  }

  /*
   * Deckel vorn und hinten. Ohne sie wäre die Karosserie ein offenes Rohr —
   * man sähe von vorn in das Auto hinein. Der Fächer läuft von der Ringmitte
   * aus; hinten in der Gegenrichtung, damit die Normale nach hinten zeigt.
   */
  for (const vorn of [true, false]) {
    const s = vorn ? 0 : S - 1;
    let mx = 0;
    let my = 0;
    let mz = 0;
    for (let r = 0; r < R; r++) {
      mx += pos[(s * R + r) * 3]!;
      my += pos[(s * R + r) * 3 + 1]!;
      mz += pos[(s * R + r) * 3 + 2]!;
    }
    const mitte = pos.length / 3;
    pos.push(mx / R, my / R, mz / R);
    const c = form.schnitte[s]!.fuge ? dunkel : grund;
    col.push(c.r, c.g, c.b);
    for (let r = 0; r < R; r++) {
      const r1 = (r + 1) % R;
      if (vorn) idx.push(mitte, s * R + r, s * R + r1);
      else idx.push(mitte, s * R + r1, s * R + r);
    }
  }

  const koerper = new THREE.BufferGeometry();
  koerper.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  koerper.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  koerper.setIndex(idx);
  koerper.computeVertexNormals();

  /*
   * Die Scheiben liegen auf derselben Haut, nur ein Stück nach außen gerückt —
   * entlang der Normalen, die gerade berechnet wurde. Deshalb passt eine
   * Scheibe automatisch auf jede Wölbung und jede Neigung, ohne eine einzige
   * eigene Zahl.
   */
  const norm = koerper.getAttribute("normal") as THREE.BufferAttribute;
  const scheiben = form.scheiben.map((sch) => {
    const sp: number[] = [];
    const si: number[] = [];
    const schnitte = sch.bisSchnitt - sch.vonSchnitt + 1;
    const ringe = sch.bisRing - sch.vonRing + 1;
    if (schnitte < 2 || ringe < 2) {
      throw new Error(`${form.name}, Scheibe "${sch.id}": leeres Feld im Gitter`);
    }
    for (let s = sch.vonSchnitt; s <= sch.bisSchnitt; s++) {
      for (let r = sch.vonRing; r <= sch.bisRing; r++) {
        const i = s * R + r;
        sp.push(
          pos[i * 3]! + norm.getX(i) * SCHEIBEN_LUFT,
          pos[i * 3 + 1]! + norm.getY(i) * SCHEIBEN_LUFT,
          pos[i * 3 + 2]! + norm.getZ(i) * SCHEIBEN_LUFT
        );
      }
    }
    for (let s = 0; s + 1 < schnitte; s++) {
      for (let r = 0; r + 1 < ringe; r++) {
        const a = s * ringe + r;
        const b = (s + 1) * ringe + r;
        const c = (s + 1) * ringe + r + 1;
        const d = s * ringe + r + 1;
        si.push(a, b, c, a, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    geo.setIndex(si);
    geo.computeVertexNormals();
    return { id: sch.id, geo };
  });

  /*
   * DIE MOTORHAUBE (E-185): dasselbe Feld wie eine Scheibe, aber GENAU auf
   * der Haut (keine Luft) und mit dem Lack der Eckpunkte — samt der dunklen
   * Fuge an der Hinterkante, an der sie aus der Haut geschnitten ist. Zwei
   * Netze teilen hier keine Eckpunkte: Die Spalte zwischen Haube und Kotflügel
   * schattiert dadurch eigen, wie an einem echten Auto.
   */
  let haube: Wrackbau["haube"];
  const h = form.haube;
  if (h) {
    const hp: number[] = [];
    const hc: number[] = [];
    const hi: number[] = [];
    const schnitte = h.bisSchnitt - h.vonSchnitt + 1;
    const ringe = h.bisRing - h.vonRing + 1;
    for (let s = h.vonSchnitt; s <= h.bisSchnitt; s++) {
      for (let r = h.vonRing; r <= h.bisRing; r++) {
        const i = s * R + r;
        hp.push(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!);
        hc.push(col[i * 3]!, col[i * 3 + 1]!, col[i * 3 + 2]!);
      }
    }
    for (let s = 0; s + 1 < schnitte; s++) {
      for (let r = 0; r + 1 < ringe; r++) {
        const a = s * ringe + r;
        const b = (s + 1) * ringe + r;
        const c = (s + 1) * ringe + r + 1;
        const d = s * ringe + r + 1;
        hi.push(a, b, c, a, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(hp, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(hc, 3));
    geo.setIndex(hi);
    geo.computeVertexNormals();
    const lage = haubeLage(form)!;
    haube = { geo, scharnier: lage.scharnier, mitte: lage.mitte };
  }

  return { koerper, scheiben, haube };
}

/* ------------------------------------------------------------------------- */
/* FASSUNG A — kantig gebaut, glaubwürdige Proportionen                      */
/* ------------------------------------------------------------------------- */

/**
 * Fünf Ebenen: Schwellerunterkante, breiteste Flanke, Gürtellinie,
 * Dachkante, Dachmitte.
 *
 * Über der Haube und über dem Kofferraum gibt es kein Dach — dort liegen die
 * beiden oberen Ebenen FLACH AUF DER HAUBE, nach innen gestaffelt. Das ist der
 * Trick, der den durchgehenden Längsschnitt möglich macht: Das Gitter bleibt
 * rechteckig (jeder Schnitt hat fünf Ebenen), und trotzdem hat das Auto vorn
 * eine Haube und in der Mitte ein Dach. Die Windschutzscheibe ist genau das
 * Stück Haut zwischen dem letzten Haubenschnitt und dem ersten Dachschnitt.
 *
 * Höhe 1,40 m, Breite 1,70 m, Länge 4,00 m — die Proportion eines Kompaktwagens
 * (Briefing Kap. 8 nennt keine Maße; die 1,70 x 4,00 kommen aus `CarDef`,
 * 1,40 m Dachhöhe ist der Wert, der dazu passt // SW).
 */
export const FORM_A: WrackformDef = {
  name: "A — kantige Limousine",
  absicht:
    "Echte Autoproportionen, flächig schattiert: Haube, geneigte Scheibe, " +
    "eingezogenes Glashaus, ausgeschnittene Radläufe.",
  breite: 1.7,
  laenge: 4.0,
  ebenen: [0.2, 0.5, 0.9, 1.3, 1.4],
  anbau: ANBAU_E116,
  fugeDunkel: 0.45,
  schnitte: [
    // z            Schweller  Flanke  Gürtel  Dachkante  Dachmitte
    { name: "Schnauze", z: 1.0, b: [0.6, 0.86, 0.8, 0.58, 0.28], y: [0.24, 0.5, 0.78, 0.78, 0.78] },
    { name: "Haube vorn", z: 0.9, b: [0.78, 0.97, 0.94, 0.7, 0.35], y: [0.21, 0.5, 0.83, 0.83, 0.83] },
    { name: "Radlauf vorn, Kante", z: 0.835, b: [0.82, 1.0, 0.97, 0.73, 0.36], y: [0.2, 0.5, 0.85, 0.85, 0.85] },
    // Über dem Rad ist die Karosserie ausgeschnitten: die beiden unteren
    // Ebenen steigen über den Reifen (Radmitte 0,33 m + Radius 0,33 m = 0,66 m
    // Reifenoberkante, der Bogen läuft 4 cm darüber).
    { name: "Radlauf vorn, Flanke", z: 0.73, b: [0.84, 1.0, 0.98, 0.74, 0.37], y: [0.46, 0.56, 0.86, 0.86, 0.86] },
    { name: "Radmitte vorn", z: 0.625, b: [0.84, 1.0, 0.99, 0.74, 0.37], y: [0.7, 0.76, 0.87, 0.87, 0.87] },
    { name: "Radlauf vorn, hinten", z: 0.52, b: [0.84, 1.0, 0.99, 0.74, 0.37], y: [0.46, 0.56, 0.87, 0.87, 0.87] },
    { name: "Haube hinten", z: 0.415, b: [0.84, 1.0, 0.99, 0.74, 0.37], y: [0.2, 0.5, 0.88, 0.88, 0.88] },
    // Hier steigt das Dach: 53 cm Länge auf 42 cm Höhe — eine
    // Windschutzscheibe, die 52° aus der Senkrechten liegt.
    { name: "Dach vorn", z: 0.15, b: [0.84, 1.0, 1.0, 0.8, 0.6], y: [0.2, 0.5, 0.9, 1.3, 1.4] },
    { name: "Dach Mitte", z: -0.15, b: [0.84, 1.0, 1.0, 0.81, 0.61], y: [0.2, 0.5, 0.9, 1.31, 1.41] },
    { name: "Dach hinten", z: -0.34, b: [0.84, 1.0, 1.0, 0.79, 0.59], y: [0.2, 0.5, 0.9, 1.28, 1.38] },
    { name: "C-Säule", z: -0.415, b: [0.84, 1.0, 0.99, 0.76, 0.57], y: [0.2, 0.5, 0.9, 1.22, 1.31] },
    { name: "Kofferraum vorn", z: -0.52, b: [0.83, 0.99, 0.98, 0.72, 0.36], y: [0.46, 0.56, 0.93, 0.95, 0.95] },
    { name: "Radmitte hinten", z: -0.625, b: [0.83, 0.99, 0.98, 0.72, 0.36], y: [0.7, 0.76, 0.93, 0.94, 0.94] },
    { name: "Radlauf hinten, Kante", z: -0.835, b: [0.8, 0.96, 0.95, 0.7, 0.35], y: [0.2, 0.5, 0.91, 0.92, 0.92] },
    { name: "Heck", z: -1.0, b: [0.66, 0.88, 0.84, 0.6, 0.3], y: [0.24, 0.5, 0.88, 0.88, 0.88] },
  ],
  scheiben: [
    // Ringpunkte 3…6 = rechte Dachkante über die Dachmitte zur linken
    // Dachkante: die Bahn, die zwischen Haube und Dach die Scheibe bildet.
    { id: "front", vonSchnitt: 6, bisSchnitt: 7, vonRing: 3, bisRing: 6 },
    { id: "rear", vonSchnitt: 10, bisSchnitt: 11, vonRing: 3, bisRing: 6 },
    // Seitenscheiben: die Flanke zwischen Gürtellinie (2) und Dachkante (3).
    { id: "right", vonSchnitt: 7, bisSchnitt: 9, vonRing: 2, bisRing: 3 },
    { id: "left", vonSchnitt: 7, bisSchnitt: 9, vonRing: 6, bisRing: 7 },
  ],
};

/* ------------------------------------------------------------------------- */
/* FASSUNG B — grob und wuchtig, bewusst stilisiert                          */
/* ------------------------------------------------------------------------- */

/**
 * Dieselben fünf Ebenen wie A, aber übertrieben: Dach auf 1,56 m,
 * Gürtellinie auf 1,04 m, die breiteste Flanke 6 % ÜBER der nominellen
 * Breite (1,80 m statt 1,70 m) und dicke Räder mit 0,40 m Radius statt 0,33 m.
 *
 * Nur zehn Querschnitte, dafür mit harten Sprüngen: Schweller 0,88, Flanke
 * 1,06, Gürtel 1,03, Dachkante 0,92, Dachmitte 0,68 — das sind vier starke
 * Fasen übereinander, die auf kleinem Schirm sofort als Auto lesbar sind. Die
 * Radläufe sind V-Kerben statt Bögen, weil je Rad nur drei Schnitte da sind;
 * das ist hier Absicht und nicht Sparsamkeit. // SW, Formfindung
 */
export const FORM_B: WrackformDef = {
  name: "B — Klotz",
  absicht:
    "Kantige Blöcke mit starken Fasen, übertriebene Proportionen, dicke " +
    "Reifen — liest sich auf kleinem Schirm sofort, Beulen wirken stark.",
  breite: 1.7,
  laenge: 4.0,
  ebenen: [0.28, 0.6, 1.04, 1.5, 1.56],
  anbau: ANBAU_E116,
  rad: [0.4, 0.34],
  fugeDunkel: 0.45,
  schnitte: [
    { name: "Schnauze", z: 1.0, b: [0.7, 1.0, 0.96, 0.76, 0.4], y: [0.3, 0.62, 1.0, 1.0, 1.0] },
    { name: "Radlauf vorn, Kante", z: 0.87, b: [0.86, 1.06, 1.02, 0.8, 0.42], y: [0.28, 0.6, 1.02, 1.02, 1.02] },
    // Reifenoberkante bei 0,80 m (Radmitte 0,40 + Radius 0,40), Kerbe 6 cm darüber.
    { name: "Radmitte vorn", z: 0.625, b: [0.88, 1.06, 1.03, 0.81, 0.42], y: [0.86, 0.92, 1.03, 1.03, 1.03] },
    { name: "Radlauf vorn, hinten", z: 0.38, b: [0.88, 1.06, 1.03, 0.82, 0.42], y: [0.28, 0.6, 1.04, 1.04, 1.04] },
    // Kurze, steile Scheibe: 30 cm Länge auf 46 cm Höhe — 33° aus der Senkrechten.
    { name: "Dach vorn", z: 0.23, b: [0.88, 1.06, 1.04, 0.92, 0.68], y: [0.28, 0.6, 1.06, 1.5, 1.56] },
    { name: "Dach hinten", z: -0.23, b: [0.88, 1.06, 1.04, 0.92, 0.68], y: [0.28, 0.6, 1.06, 1.5, 1.56] },
    { name: "Radlauf hinten, Kante", z: -0.38, b: [0.88, 1.06, 1.03, 0.82, 0.42], y: [0.28, 0.6, 1.06, 1.06, 1.06] },
    { name: "Radmitte hinten", z: -0.625, b: [0.88, 1.06, 1.03, 0.81, 0.42], y: [0.86, 0.92, 1.05, 1.05, 1.05] },
    { name: "Radlauf hinten, hinten", z: -0.87, b: [0.86, 1.0, 0.98, 0.78, 0.4], y: [0.28, 0.6, 1.04, 1.04, 1.04] },
    { name: "Heck", z: -1.0, b: [0.7, 1.0, 0.96, 0.76, 0.4], y: [0.3, 0.62, 1.02, 1.02, 1.02] },
  ],
  scheiben: [
    { id: "front", vonSchnitt: 3, bisSchnitt: 4, vonRing: 3, bisRing: 6 },
    { id: "rear", vonSchnitt: 5, bisSchnitt: 6, vonRing: 3, bisRing: 6 },
    { id: "right", vonSchnitt: 4, bisSchnitt: 5, vonRing: 2, bisRing: 3 },
    { id: "left", vonSchnitt: 4, bisSchnitt: 5, vonRing: 6, bisRing: 7 },
  ],
};

/* ------------------------------------------------------------------------- */
/* FASSUNG C — so echt, wie das Netzbudget erlaubt                           */
/* ------------------------------------------------------------------------- */

/**
 * NEUN Ebenen und achtzehn Querschnitte, glatt schattiert.
 *
 * Bis E-128 waren es sieben und siebzehn. Die zwei Ebenen „Türmitte" (0,75 m)
 * und „Säule" (1,11 m) und der Querschnitt „B-Säule" liegen genau auf halbem
 * Weg zwischen ihren Nachbarn — an der Form ändern sie nichts. Sie sind da,
 * damit die Karosserie knicken kann: Gemessen lag zwischen Gürtellinie und
 * Dachkante (38 cm) und auf der Tür über der Sicke (34 cm) kein einziger
 * Eckpunkt, und das Dach hatte auf 60 cm Länge keinen Querschnitt. Wo kein
 * Eckpunkt ist, kann kein Blech falten.
 *
 * Die zwei zusätzlichen Ebenen sind eine SICKE: Ebene 2 ist die breiteste
 * Stelle (0,46 m Höhe), Ebene 3 zieht sich 4 cm zurück (0,58 m), Ebene 4 ist
 * die Gürtellinie. Über diesen Knick läuft glatt schattiert eine Lichtkante
 * von vorn nach hinten — das, was ein Auto von einem Kasten unterscheidet.
 *
 * SCHATTENFUGEN: Zwei Paare von Querschnitten liegen nur 3 cm auseinander und
 * tragen einen abgedunkelten Lack (`fuge`). Daraus wird ein schmaler dunkler
 * Streifen quer über die Karosserie — die Trennlinie von Haube und Kotflügel
 * bzw. von Heckklappe und Seitenteil. Eine Fuge ist damit eine Zeile in dieser
 * Tabelle, kein Textur-Bild.
 *
 * GEWÖLBTE SCHEIBEN kommen von selbst: Windschutz und Heckscheibe laufen über
 * DREI Querschnitte statt über zwei, der mittlere liegt dazwischen nach außen
 * — die Scheibe ist also gekrümmt, weil das Blech darunter gekrümmt ist.
 */
export const FORM_C: WrackformDef = {
  name: "C — weich, mit Sicken",
  absicht:
    "Weichere Übergänge, Sicken in den Flanken, Schattenfugen zwischen den " +
    "Bauteilen, gewölbte Scheiben — so echt, wie das Netzbudget erlaubt.",
  breite: 1.7,
  laenge: 4.0,
  ebenen: [0.2, 0.32, 0.46, 0.58, 0.75, 0.92, 1.11, 1.3, 1.42],
  anbau: ANBAU_E116,
  glatt: true,
  fugeDunkel: 0.45,
  schnitte: [
    // z           Schweller Flanke Sicke  Sicke  Türmitte Gürtel Säule  Dachkante Dachmitte
    { name: "Nase", z: 1, b: [0.56, 0.68, 0.76, 0.74, 0.73, 0.72, 0.61, 0.5, 0.25], y: [0.26, 0.36, 0.48, 0.58, 0.66, 0.74, 0.75, 0.76, 0.78] },
    { name: "Stoßfänger", z: 0.945, b: [0.72, 0.84, 0.9, 0.88, 0.88, 0.88, 0.76, 0.64, 0.32], y: [0.22, 0.34, 0.46, 0.58, 0.69, 0.8, 0.81, 0.82, 0.83] },
    { name: "Haube vorn", z: 0.88, b: [0.8, 0.92, 0.97, 0.94, 0.94, 0.94, 0.82, 0.7, 0.35], y: [0.2, 0.32, 0.46, 0.58, 0.71, 0.84, 0.845, 0.85, 0.86] },
    { name: "Radlauf vorn, Kante", z: 0.8, b: [0.82, 0.94, 1, 0.96, 0.965, 0.97, 0.845, 0.72, 0.36], y: [0.3, 0.4, 0.5, 0.6, 0.73, 0.86, 0.865, 0.87, 0.87] },
    { name: "Radmitte vorn", z: 0.625, b: [0.82, 0.94, 1, 0.96, 0.97, 0.98, 0.855, 0.73, 0.36], y: [0.7, 0.74, 0.78, 0.82, 0.845, 0.87, 0.875, 0.88, 0.88] },
    { name: "Radlauf vorn, hinten", z: 0.45, b: [0.82, 0.94, 1, 0.96, 0.97, 0.98, 0.86, 0.74, 0.37], y: [0.3, 0.4, 0.5, 0.6, 0.74, 0.88, 0.885, 0.89, 0.89] },
    { name: "Fuge Haube, vorn", z: 0.4, b: [0.82, 0.94, 1, 0.96, 0.97, 0.98, 0.86, 0.74, 0.37], y: [0.2, 0.32, 0.46, 0.58, 0.73, 0.88, 0.885, 0.89, 0.89], fuge: true },
    { name: "Fuge Haube, hinten", z: 0.385, b: [0.82, 0.94, 1, 0.96, 0.97, 0.98, 0.86, 0.74, 0.37], y: [0.2, 0.32, 0.46, 0.58, 0.735, 0.89, 0.895, 0.9, 0.9], fuge: true },
    { name: "Windschutz Mitte", z: 0.27, b: [0.83, 0.95, 1, 0.96, 0.975, 0.99, 0.875, 0.76, 0.48], y: [0.2, 0.32, 0.46, 0.58, 0.74, 0.9, 0.98, 1.06, 1.14] },
    { name: "Dach vorn", z: 0.12, b: [0.83, 0.95, 1, 0.96, 0.98, 1, 0.895, 0.79, 0.6], y: [0.2, 0.32, 0.46, 0.58, 0.75, 0.92, 1.11, 1.3, 1.42] },
    { name: "B-Säule", z: -0.03, b: [0.83, 0.95, 1, 0.96, 0.98, 1, 0.895, 0.79, 0.6], y: [0.2, 0.32, 0.46, 0.58, 0.75, 0.92, 1.11, 1.3, 1.42] },
    { name: "Dach hinten", z: -0.18, b: [0.83, 0.95, 1, 0.96, 0.98, 1, 0.895, 0.79, 0.6], y: [0.2, 0.32, 0.46, 0.58, 0.75, 0.92, 1.11, 1.3, 1.42] },
    { name: "Heckscheibe Mitte", z: -0.42, b: [0.82, 0.94, 1, 0.96, 0.975, 0.99, 0.875, 0.76, 0.52], y: [0.2, 0.32, 0.46, 0.58, 0.75, 0.92, 1.03, 1.14, 1.24] },
    { name: "Fuge Klappe, vorn", z: -0.52, b: [0.82, 0.94, 0.99, 0.95, 0.965, 0.98, 0.86, 0.74, 0.4], y: [0.3, 0.4, 0.5, 0.6, 0.77, 0.94, 0.965, 0.99, 1], fuge: true },
    { name: "Fuge Klappe, hinten", z: -0.535, b: [0.82, 0.94, 0.99, 0.95, 0.965, 0.98, 0.86, 0.74, 0.4], y: [0.3, 0.4, 0.5, 0.6, 0.77, 0.94, 0.96, 0.98, 0.99], fuge: true },
    { name: "Radmitte hinten", z: -0.625, b: [0.82, 0.94, 0.99, 0.95, 0.965, 0.98, 0.86, 0.74, 0.39], y: [0.7, 0.74, 0.78, 0.82, 0.88, 0.94, 0.955, 0.97, 0.98] },
    { name: "Radlauf hinten, Kante", z: -0.82, b: [0.8, 0.92, 0.97, 0.93, 0.945, 0.96, 0.84, 0.72, 0.37], y: [0.3, 0.4, 0.5, 0.6, 0.765, 0.93, 0.94, 0.95, 0.96] },
    { name: "Heck", z: -1, b: [0.62, 0.74, 0.82, 0.8, 0.8, 0.8, 0.68, 0.56, 0.28], y: [0.26, 0.36, 0.48, 0.58, 0.73, 0.88, 0.89, 0.9, 0.9] },
  ],
  scheiben: [
    // Neun Ebenen (E-128): r = 5 rechte Gürtellinie, 6 rechte Säule, 7 rechte
    // Dachkante, 8 Dachmitte rechts, 9 Dachmitte links, 10 linke Dachkante,
    // 11 linke Säule, 12 linke Gürtellinie. Querschnitt 10 ist die B-Säule.
    { id: "front", vonSchnitt: 7, bisSchnitt: 9, vonRing: 7, bisRing: 10 },
    { id: "rear", vonSchnitt: 11, bisSchnitt: 13, vonRing: 7, bisRing: 10 },
    { id: "right", vonSchnitt: 9, bisSchnitt: 12, vonRing: 5, bisRing: 7 },
    { id: "left", vonSchnitt: 9, bisSchnitt: 12, vonRing: 10, bisRing: 12 },
  ],
  /*
   * DIE MOTORHAUBE (E-185, Zerstörungskonzept B3): vom Stoßfänger-Schnitt
   * (1,89 m) bis zur Haubenfuge (Schnitt 6, 0,80 m), quer zwischen den
   * beiden Säulen-Ringen (6 und 11, je 0,65–0,73 m von der Mitte) — außen
   * bleibt der Rand der Kotflügel stehen. Die Fuge, die die Kante schon seit
   * E-116 zeichnet, ist die Hinterkante und das Scharnier. 1,46 x 1,09 m.
   */
  haube: { id: "haube", vonSchnitt: 1, bisSchnitt: 6, vonRing: 6, bisRing: 11 },
  /*
   * DIE INNENAUSSTATTUNG (E-185, Patrick 20.10.2026: „Autos haben
   * innenausstattung"; Frage 2 A: sichtbar ab 1.0, herausholbar ab 1.1).
   * x als Anteil der halben Breite (0,85 m), z als Anteil der halben Länge
   * (2,00 m), Höhen in m über dem Boden (Boden-Kollider bis 0,32 m). Abgelesen
   * an der Tabelle oben: Windschutzscheibe ab 0,77 m, B-Säule bei −0,06 m,
   * Heckscheibe bis −1,04 m, Dach innen ab 1,30 m. // SW, Maße eines
   * Kompaktwagens nach Augenmaß; Farben: dunkler Sitzstoff, schwarzes
   * Armaturenbrett
   */
  innen: [
    // Vordersitze: Sitzfläche 0,48–0,60 m, Lehne bis 1,10 m
    { name: "Vordersitz", size: [0.46 / 1.7, 0.12, 0.48], anchor: [0.36 / 0.85, 0.54, 0.11 / 2.0], paarweise: true, farbe: 0x3b3d42 },
    { name: "Vordersitz", size: [0.44 / 1.7, 0.6, 0.12], anchor: [0.36 / 0.85, 0.8, -0.19 / 2.0], paarweise: true, farbe: 0x3b3d42 },
    // Rückbank: Sitzfläche über die ganze Breite, Lehne unter der Heckscheibe
    { name: "Rückbank", size: [1.3 / 1.7, 0.12, 0.45], anchor: [0, 0.54, -0.72 / 2.0], farbe: 0x3b3d42 },
    { name: "Rückbank", size: [1.3 / 1.7, 0.43, 0.12], anchor: [0, 0.735, -1.0 / 2.0], farbe: 0x3b3d42 },
    // Armaturenbrett unter der Windschutzscheibe, 0,71–0,87 m
    { name: "Armaturenbrett", size: [1.4 / 1.7, 0.16, 0.22], anchor: [0, 0.79, 0.61 / 2.0], farbe: 0x232527 },
  ],
  /*
   * DER HOHLKÖRPER (E-124). Acht Quader, abgelesen an der Tabelle oben
   * (z = Anteil · 2,00 m): Boden bis zur Schwellerkante 0,32 m, Ebene 1 (die
   * Räder sind nur Netze, der Wagen steht wie bisher auf y = 0); alles Weitere
   * steht lückenlos darauf — Vorderwagen von der Haubenfuge (0,80) bis zur
   * Nase, oben auf Haubenhöhe 0,86; Heck ab der Klappenfuge (−1,04), oben 0,97;
   * dazwischen die Fahrgastzelle — vier Türen vom Schweller bis zur Gürtellinie
   * 0,92 und das Dach zwischen „Dach vorn" (0,24) und „Dach hinten" (−0,36) auf
   * 1,30…1,42 m, so breit wie die Dachkante (0,79 · 0,85 m). Wo Glas ist, ist
   * KEIN Kollider: Durch Windschutz-, Heck- und Seitenscheiben kommt eine
   * Schale in den Innenraum.
   *
   * Bis E-127 reichte der Boden bis 0,58 m (Sicke), weil der Bagger beim
   * Zufassen nur Kollider 0 fragte. Seit E-128 gibt kein Quader mehr einzeln
   * nach: Ober- und Unterkante jedes Quaders gehen durch `knautschHoehe`,
   * dieselbe Rechnung wie die Haut.
   */
  bleche: [
    { name: "Boden", mitte: [0, 0.16, 0], halb: [0.85, 0.16, 2.0] },
    { name: "Vorderwagen", mitte: [0, 0.59, 1.4], halb: [0.8, 0.27, 0.6] },
    { name: "Heck", mitte: [0, 0.645, -1.52], halb: [0.8, 0.325, 0.48] },
    { name: "Tür vorn rechts", mitte: [0.77, 0.62, 0.34], halb: [0.08, 0.3, 0.46] },
    { name: "Tür vorn links", mitte: [-0.77, 0.62, 0.34], halb: [0.08, 0.3, 0.46] },
    { name: "Tür hinten rechts", mitte: [0.77, 0.62, -0.58], halb: [0.08, 0.3, 0.46] },
    { name: "Tür hinten links", mitte: [-0.77, 0.62, -0.58], halb: [0.08, 0.3, 0.46] },
    { name: "Dach", mitte: [0, 1.36, -0.06], halb: [0.67, 0.06, 0.3] },
  ],
  /*
   * WIE DIE FASSUNG C ZUSAMMENKNAUTSCHT (E-128) — drei Bänder über dem starren
   * Boden, jedes mit einem Knick genau auf einem Ring der Haut.
   *
   * Reihenfolge wie bei einer Dose unter dem Stiefel: zuerst gibt das
   * Schwächste nach, das Glashaus (Säulen, nur Glas dazwischen) — die Säulen
   * knicken auf halber Höhe (1,11 m) HERAUS. Dann die Türen: Sie knicken auf
   * halber Höhe (0,75 m) HINEIN. Zuletzt das steife Stück zwischen Schweller
   * und Sicke, das auf der Sicke (0,46 m) wieder HERAUS knickt. Raus, rein,
   * raus: eine Ziehharmonika wie an einer zertretenen Dose. (Erster Entwurf:
   * Säulen hinein — im Riss verschwand die Falte unter dem sinkenden Dach.)
   *
   * Ganz flach: 0,32 + 0,12 + 0,10 + 0,08 = 0,62 m — ein gepresstes Auto vom
   * Schrottplatz, Boden und Schweller plus drei Lagen gefaltetes Blech. Bis
   * hierher machte die Presse das Wrack 0,55-mal so hoch (Dach 0,78 m).
   * Alle Zahlen: SW, am Bild abzustimmen.
   */
  knautsch: {
    zonen: [
      { name: "Schweller bis Sicke", von: 0.32, bis: 0.58, rest: 0.12, ab: 0.55, voll: 1, knick: 0.46, nach: 1 },
      { name: "Tür", von: 0.58, bis: 0.92, rest: 0.1, ab: 0.25, voll: 0.9, knick: 0.75, nach: -1 },
      { name: "Glashaus", von: 0.92, bis: 1.42, rest: 0.08, ab: 0, voll: 0.6, knick: 1.11, nach: 1 },
    ],
  },
};

export const WRACKFORMEN: Record<"a" | "b" | "c", WrackformDef> = {
  a: FORM_A,
  b: FORM_B,
  c: FORM_C,
};

/* ------------------------------------------------------------------------- */
/* GROSSE WRACKS (E-135) — dieselbe Bauweise wie Fassung C, andere Daten     */
/* ------------------------------------------------------------------------- */

/*
 * Patrick, 17.10.2026: „am anfang sollen auch mehr schrott schon da sein, die
 * zwei autos, ein lkw wrack und ab und zu bringt jmd auch nen wohnwagen zum
 * verschrotten".
 *
 * Beide sind KEIN neuer Mechanismus: Querschnitte für die Haut, Felder darin
 * für die Scheiben, Quader für den Hohlkörper, Knautschzonen für das
 * Zusammengehen — genau die Tabellen, aus denen Fassung C besteht (E-117,
 * E-124, E-128). Was sie von einem Auto unterscheidet, steht in Zahlen.
 */

/**
 * DER AUSGEDIENTE LASTWAGEN — eine Sattelzugmaschine, zwei Achsen.
 *
 * Warum eine Zugmaschine und kein Kipper: Eine Kipperbrücke wäre ein Teil,
 * das abgeht (wie Motor und Räder), aber zugleich eine Wand, auf der die
 * Spinne steht — also ein Kollider, der beim Abreißen mitgehen müsste. Das
 * kann der Verbund nicht (seine Quader sind fest, nur ihre Höhe folgt dem
 * Knautschen); es wäre neuer Code. Eine Zugmaschine hat hinter dem
 * Fahrerhaus nur den Rahmen mit Sattelkupplung — alles, was dort abgeht,
 * steckt im Rahmen-Quader wie der Motor im Auto.
 *
 * Maße (Wrack-lokal, +z Schnauze): 6,00 m lang, 2,50 m breit, Dach 3,00 m.
 * Vorbild 4x2-Zugmaschine mit Fahrerhaus ohne Hochdach: Länge um 5,9–6,1 m,
 * Radstand 3,6 m, Breite 2,50 m (zulässig 2,55, StVZO § 32), Fahrerhaus
 * 2,2 m lang. // SW: 3,00 m ist ein flaches Fahrerhaus — ein Hochdach
 * (3,6–3,9 m) wäre echter, aber noch höher über der Spinne.
 * Räder 315/80 R22.5: Durchmesser 1,07 m. Vorderachse z +1,60, Hinterachse
 * z −2,00 (Radstand 3,60).
 *
 * Acht Ebenen: Unterkante · Trittstufe · Kabinenboden · Türmitte (Knick) ·
 * Brüstung · Scheibenmitte (Knick) · Dachkante · Dachmitte. Hinter dem
 * Fahrerhaus liegen alle acht als RAHMEN zusammen — 0,86 m breit, 0,72 bis
 * 1,05 m hoch, dunkel (Schattenfuge). Die Windschutzscheibe ist der Trick aus
 * Fassung A: Im vordersten Schnitt liegen die oberen Ebenen flach auf der
 * Brüstung, das Stück Haut von dort zum zweiten Schnitt ist das Glas.
 */
export const FORM_LKW: WrackformDef = {
  name: "LKW — ausgediente Sattelzugmaschine",
  absicht:
    "Fahrerhaus, das knautscht, auf einem starren Rahmen; Motor, Tank, " +
    "Batterien, Sattelkupplung und Räder gehen einzeln ab.",
  breite: 2.5,
  laenge: 6.0,
  ebenen: [0.45, 0.95, 1.35, 1.7, 2.05, 2.45, 2.85, 3.0],
  fugeDunkel: 0.6,
  schnitte: [
    // z (m) / 3,00     Unterk. Tritt Boden Türm. Brüst. Scheib. Dachk. Dachm.
    { name: "Stoßfänger", z: 3.0 / 3, b: [0.94, 0.97, 0.97, 0.97, 0.96, 0.93, 0.88, 0.45], y: [0.45, 0.95, 1.35, 1.7, 2.0, 2.005, 2.01, 2.015] },
    { name: "A-Säule", z: 2.82 / 3, b: [0.97, 0.99, 0.99, 0.99, 0.99, 0.97, 0.93, 0.6], y: [0.45, 0.95, 1.35, 1.7, 2.05, 2.45, 2.85, 2.98] },
    // Über dem Vorderrad (Oberkante 1,07 m) steigen die unteren Ebenen: Radlauf.
    { name: "Radlauf vorn, Kante", z: 2.2 / 3, b: [0.98, 1, 1, 1, 1, 0.98, 0.94, 0.62], y: [0.5, 0.95, 1.35, 1.7, 2.05, 2.45, 2.85, 3.0] },
    { name: "Radlauf vorn, oben", z: 2.1 / 3, b: [0.98, 1, 1, 1, 1, 0.98, 0.94, 0.62], y: [0.95, 1.05, 1.35, 1.7, 2.05, 2.45, 2.85, 3.0] },
    { name: "Radmitte vorn", z: 1.6 / 3, b: [0.98, 1, 1, 1, 1, 0.98, 0.94, 0.62], y: [1.15, 1.22, 1.35, 1.7, 2.05, 2.45, 2.85, 3.0] },
    { name: "Radlauf hinten, oben", z: 1.1 / 3, b: [0.98, 1, 1, 1, 1, 0.98, 0.94, 0.62], y: [0.95, 1.05, 1.35, 1.7, 2.05, 2.45, 2.85, 3.0] },
    { name: "Einstieg", z: 1.0 / 3, b: [0.98, 1, 1, 1, 1, 0.98, 0.94, 0.62], y: [0.5, 0.95, 1.35, 1.7, 2.05, 2.45, 2.85, 3.0] },
    { name: "Rückwand", z: 0.8 / 3, b: [0.98, 1, 1, 1, 1, 0.98, 0.94, 0.62], y: [0.5, 0.95, 1.35, 1.7, 2.05, 2.45, 2.85, 3.0] },
    // Rahmen: zwei Längsträger, 0,86 m über alles, Oberkante 1,05 m.
    { name: "Rahmen vorn", z: 0.76 / 3, b: [0.34, 0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.3], y: [0.72, 0.76, 0.8, 0.85, 0.9, 0.95, 1.0, 1.05], fuge: true },
    { name: "Rahmenende", z: -1, b: [0.34, 0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.3], y: [0.72, 0.76, 0.8, 0.85, 0.9, 0.95, 1.0, 1.05], fuge: true },
  ],
  scheiben: [
    // Acht Ebenen: r = 6 rechte Dachkante, 7 Dachmitte rechts, 8 links, 9 linke Dachkante.
    { id: "front", vonSchnitt: 0, bisSchnitt: 1, vonRing: 6, bisRing: 9 },
    // Seitenscheiben in der Tür: Brüstung (4) bis Dachkante (6), A-Säule bis Radmitte.
    { id: "right", vonSchnitt: 1, bisSchnitt: 4, vonRing: 4, bisRing: 6 },
    { id: "left", vonSchnitt: 1, bisSchnitt: 4, vonRing: 9, bisRing: 11 },
  ],
  anbau: [
    { name: "Stoßfänger", size: [2.4 / 2.5, 0.35, 0.2], anchor: [0, 0.62, 3.02 / 3], farbe: 0x24262a },
    { name: "Kühlergrill", size: [1.4 / 2.5, 0.55, 0.05], anchor: [0, 1.32, 3.01 / 3], farbe: 0x30333a },
    { name: "Scheinwerfer", size: [0.35 / 2.5, 0.18, 0.06], anchor: [0.82 / 1.25, 0.95, 3.02 / 3], paarweise: true, farbe: 0xfffff4 },
    { name: "Außenspiegel", size: [0.12 / 2.5, 0.45, 0.25], anchor: [0, 2.3, 2.7 / 3], paarweise: true, amFlanke: true, farbe: 0x24262a },
    { name: "Kotflügel hinten", size: [0.7 / 2.5, 0.06, 1.2], anchor: [0.92 / 1.25, 1.12, -2.0 / 3], paarweise: true, farbe: 0x24262a },
    { name: "Heckträger", size: [2.3 / 2.5, 0.12, 0.1], anchor: [0, 0.9, -2.95 / 3], farbe: 0x24262a },
    { name: "Rückleuchte", size: [0.3 / 2.5, 0.12, 0.06], anchor: [1.0 / 1.25, 0.9, -3.01 / 3], paarweise: true, farbe: 0xb82b1e },
    // Senkrechtes Auspuffrohr hinter dem Fahrerhaus
    { name: "Auspuff", size: [0.16 / 2.5, 1.6, 0.16], anchor: [-1.0 / 1.25, 2.2, 0.68 / 3], farbe: 0x5a5a5a },
  ],
  /*
   * Innenausstattung (E-185), nur zum Ansehen wie am Pkw: zwei Sitze auf
   * dem Kabinenboden (1,35 m), das Armaturenbrett unter der Frontscheibe
   * (Brüstung 2,05 m). Das Fahrerhaus bleibt für die Physik ein Block
   * (E-135) — man sieht hinein, die Spinne kommt nicht hinein. // SW
   */
  innen: [
    { name: "Vordersitz", size: [0.55 / 2.5, 0.14, 0.5], anchor: [0.62 / 1.25, 1.62, 1.85 / 3], paarweise: true, farbe: 0x3b3d42 },
    { name: "Vordersitz", size: [0.52 / 2.5, 0.66, 0.14], anchor: [0.62 / 1.25, 1.95, 1.55 / 3], paarweise: true, farbe: 0x3b3d42 },
    { name: "Armaturenbrett", size: [2.2 / 2.5, 0.3, 0.3], anchor: [0, 2.0, 2.62 / 3], farbe: 0x232527 },
  ],
  /*
   * Der Verbund: Rahmen samt Achsen bis 1,05 m über die ganze Grundfläche
   * (er trägt die Masse und steht auf dem Boden, die Räder sind Netze darin —
   * wie am Pkw), darauf das Fahrerhaus als EIN Block von 1,05 bis 2,99 m.
   * Seine Oberkante geht beim Knautschen mit der Haut herunter (E-128).
   *
   * WARUM KEINE HOHLE SCHALE WIE AM PKW — gemessen (`tools/wrackdruck.ts`,
   * ART=lkw). Am Auto kommt der Biss über das Greifen: Die Spinne fasst das
   * Wrack, und gedrückt wird, was in ihr hängt. Einen 7-t-Lkw fasst sie nicht
   * (Traglast), also zählt nur, was vor den Zähnen STEHT. Mit dünnen
   * Wänden (16 cm) wie am Auto standen die Zähne 0,3 s an der Wand, stießen
   * hindurch und schlossen im leeren Fahrerhaus — der Druck braucht 0,7 s,
   * der Biss kam nie; über die offenen Fenster hakten sie unter der
   * Dachkante ein. Am Block bleiben sie stehen, und der Biss kommt.
   */
  bleche: [
    { name: "Rahmen", mitte: [0, 0.525, 0], halb: [1.25, 0.525, 3.0] },
    { name: "Fahrerhaus", mitte: [0, 2.02, 1.9], halb: [1.22, 0.97, 1.1] },
  ],
  /*
   * Das Fahrerhaus knautscht über dem Kabinenboden (1,35 m); Rahmen und
   * Kabinenboden bleiben starr. Erst das Glashaus (Säulen knicken heraus),
   * dann die Türen (knicken hinein) — wie am Pkw. Ganz flach:
   * 1,35 + 0,15 + 0,12 = 1,62 m. // SW, am Bild abzustimmen
   */
  knautsch: {
    seitenHoehe: 1.7,
    zonen: [
      { name: "Tür", von: 1.35, bis: 2.05, rest: 0.15, ab: 0.25, voll: 0.9, knick: 1.7, nach: -1 },
      { name: "Glashaus", von: 2.05, bis: 3.0, rest: 0.12, ab: 0, voll: 0.6, knick: 2.45, nach: 1 },
    ],
  },
};

/**
 * DER WOHNWAGEN — ein Blechkasten auf einer Achse.
 *
 * Vorbild: kleiner Einachser der 80er/90er Jahre, Aufbaulänge 4,20 m, Breite
 * 2,05 m, Höhe 2,40 m über der Straße, Aufbau ab 0,45 m. Davor die Deichsel,
 * 1,55 m mit dem Kupplungskopf — über alles 5,75 m. // SW, Maße aus
 * Prospektwerten dieser Klasse (Aufbau 4,0–4,5 m, Breite 2,0–2,2 m).
 *
 * Neun Ebenen wie Fassung C: Unterkante · Boden · Wandmitte (Knick) ·
 * Fensterunterkante · Fenstermitte (Knick) · Fensteroberkante · Oberwand
 * (Knick) · Dachkante · Dachmitte. Bug und Heck sind gerundet; Bug- und
 * Heckfenster sind wieder der Trick aus Fassung A (obere Ebenen im
 * äußersten Schnitt flach auf der Fensterunterkante).
 */
export const FORM_WOHNWAGEN: WrackformDef = {
  name: "Wohnwagen",
  absicht:
    "Ein leichter Kasten mit dünnen Wänden: knautscht schneller als ein " +
    "Auto, Achse und Räder gehen ab.",
  breite: 2.05,
  laenge: 4.2,
  ebenen: [0.45, 0.6, 0.88, 1.15, 1.45, 1.75, 2.05, 2.3, 2.4],
  glatt: true,
  fugeDunkel: 0.3,
  schnitte: [
    // z (m) / 2,10      Unterk. Boden Wandm. Fenst.u Fenst.m Fenst.o Oberw. Dachk. Dachm.
    { name: "Bug unten", z: 1, b: [0.92, 0.95, 0.95, 0.95, 0.94, 0.92, 0.88, 0.8, 0.45], y: [0.45, 0.6, 0.88, 1.15, 1.4, 1.405, 1.41, 1.415, 1.42] },
    { name: "Bugfenster oben", z: 2.05 / 2.1, b: [0.93, 0.96, 0.96, 0.96, 0.96, 0.95, 0.92, 0.85, 0.5], y: [0.45, 0.6, 0.88, 1.15, 1.45, 1.75, 1.95, 1.99, 2.02] },
    { name: "Bugkante", z: 1.92 / 2.1, b: [0.95, 0.98, 0.98, 0.98, 0.98, 0.98, 0.96, 0.92, 0.58] },
    { name: "Wand vorn", z: 1.4 / 2.1, b: [0.97, 1, 1, 1, 1, 1, 0.99, 0.96, 0.62] },
    { name: "Fenster vorn", z: 0.85 / 2.1, b: [0.97, 1, 1, 1, 1, 1, 0.99, 0.96, 0.62] },
    { name: "Wandmitte", z: 0.2 / 2.1, b: [0.97, 1, 1, 1, 1, 1, 0.99, 0.96, 0.62] },
    { name: "Fenster hinten", z: -0.45 / 2.1, b: [0.97, 1, 1, 1, 1, 1, 0.99, 0.96, 0.62] },
    { name: "Wand hinten", z: -1.2 / 2.1, b: [0.97, 1, 1, 1, 1, 1, 0.99, 0.96, 0.62] },
    { name: "Heckkante", z: -1.92 / 2.1, b: [0.95, 0.98, 0.98, 0.98, 0.98, 0.98, 0.96, 0.92, 0.58] },
    { name: "Heckfenster oben", z: -2.05 / 2.1, b: [0.93, 0.96, 0.96, 0.96, 0.96, 0.95, 0.92, 0.85, 0.5], y: [0.45, 0.6, 0.88, 1.15, 1.45, 1.75, 1.95, 1.99, 2.02] },
    { name: "Heck unten", z: -1, b: [0.92, 0.95, 0.95, 0.95, 0.94, 0.92, 0.88, 0.8, 0.45], y: [0.45, 0.6, 0.88, 1.15, 1.4, 1.405, 1.41, 1.415, 1.42] },
  ],
  scheiben: [
    // Neun Ebenen: r = 6 rechte Oberwand … 11 linke Oberwand; 3–5 rechts, 12–14 links.
    { id: "front", vonSchnitt: 0, bisSchnitt: 1, vonRing: 6, bisRing: 11 },
    { id: "rear", vonSchnitt: 9, bisSchnitt: 10, vonRing: 6, bisRing: 11 },
    { id: "right", vonSchnitt: 4, bisSchnitt: 6, vonRing: 3, bisRing: 5 },
    { id: "left", vonSchnitt: 4, bisSchnitt: 6, vonRing: 12, bisRing: 14 },
  ],
  anbau: [
    // Deichsel bis zum Kupplungskopf, verzinkt; Stützrad vorn rechts daneben.
    { name: "Deichsel", size: [0.12 / 2.05, 0.12, 1.3], anchor: [0, 0.42, 2.75 / 2.1], farbe: 0x9aa0a6 },
    { name: "Deichselquerträger", size: [1.4 / 2.05, 0.1, 0.1], anchor: [0, 0.42, 2.12 / 2.1], farbe: 0x9aa0a6 },
    { name: "Kupplungskopf", size: [0.14 / 2.05, 0.14, 0.3], anchor: [0, 0.45, 3.5 / 2.1], farbe: 0x24262a },
    { name: "Stützrad", size: [0.08 / 2.05, 0.36, 0.2], anchor: [0.15 / 1.025, 0.18, 3.2 / 2.1], farbe: 0x1e2022 },
    // Aufbautür rechts (Beifahrerseite), hinter dem Fenster.
    { name: "Aufbautür", size: [0.03 / 2.05, 1.7, 0.6], anchor: [0, 1.5, -0.9 / 2.1], amFlanke: true, farbe: 0xd9d4c6 },
    { name: "Rückleuchte", size: [0.18 / 2.05, 0.12, 0.05], anchor: [0.82 / 1.025, 0.55, -2.12 / 2.1], paarweise: true, farbe: 0xb82b1e },
    { name: "Dachluke", size: [0.5 / 2.05, 0.08, 0.5], anchor: [0, 2.43, 0.3 / 2.1], farbe: 0xd8dcde },
  ],
  /*
   * Innenausstattung (E-185), nur zum Ansehen: Sitzgruppe mit Tisch am Bug
   * (hinter dem Bugfenster), Küchenzeile links (hinter dem linken Fenster),
   * Bett im Heck. Boden bei 0,60 m, Wände innen bei ±0,90 m, Bug- und
   * Heckwand innen bei ±1,92 m. Möbel aus Holz, Polster braun — die Farben der
   * Achtziger. // SW
   */
  innen: [
    { name: "Sitzbank", size: [0.6 / 2.05, 0.44, 0.9], anchor: [0.55 / 1.025, 0.82, 1.45 / 2.1], paarweise: true, farbe: 0x6a5a4a },
    { name: "Tisch", size: [0.5 / 2.05, 0.05, 0.8], anchor: [0, 1.05, 1.45 / 2.1], farbe: 0x9a7a55 },
    { name: "Küchenzeile", size: [0.5 / 2.05, 0.9, 1.2], anchor: [-0.62 / 1.025, 1.05, 0.2 / 2.1], farbe: 0x9a7a55 },
    { name: "Bett", size: [1.75 / 2.05, 0.5, 1.0], anchor: [0, 0.85, -1.4 / 2.1], farbe: 0x8a7f6c },
  ],
  /*
   * Ein geschlossener Kasten: Fahrgestell mit Boden bis 0,60 m (trägt die
   * Masse, die Räder stehen darin wie am Pkw), zwei Seitenwände, Bug- und
   * Heckwand, Dach. Die Wände laufen über die Fenster durch — anders als am
   * Pkw gibt es keine offene Fahrgastzelle, in die eine Schale greifen könnte.
   */
  bleche: [
    { name: "Fahrgestell und Boden", mitte: [0, 0.3, 0], halb: [1.025, 0.3, 2.1] },
    { name: "Wand rechts", mitte: [0.965, 1.45, 0], halb: [0.06, 0.85, 1.95] },
    { name: "Wand links", mitte: [-0.965, 1.45, 0], halb: [0.06, 0.85, 1.95] },
    { name: "Dach", mitte: [0, 2.34, 0], halb: [0.95, 0.06, 1.9] },
    { name: "Bugwand", mitte: [0, 1.45, 1.98], halb: [0.95, 0.85, 0.06] },
    { name: "Heckwand", mitte: [0, 1.45, -1.98], halb: [0.95, 0.85, 0.06] },
  ],
  /*
   * Drei Bänder über dem Boden (0,60 m): oben zuerst (Dach und Oberwand),
   * dann das Fensterband, zuletzt die Wand unter den Fenstern. Raus, rein,
   * raus wie am Pkw. Ganz flach: 0,60 + 0,10 + 0,08 + 0,08 = 0,86 m. // SW
   */
  knautsch: {
    seitenHoehe: 1.45,
    // SW: dreifacher Weg je Biss — die Wand gibt unter der Schale nach, wo
    // Autoblech trägt. Mit 2 knautschte er gemessen so langsam wie ein Auto
    // (drei Bisse, Grad 0,52); mit 3 ist er nach etwa vier Bissen flach.
    wegFaktor: 3,
    zonen: [
      { name: "Wand unten", von: 0.6, bis: 1.15, rest: 0.1, ab: 0.4, voll: 1, knick: 0.88, nach: 1 },
      { name: "Fensterband", von: 1.15, bis: 1.75, rest: 0.08, ab: 0.15, voll: 0.85, knick: 1.45, nach: -1 },
      { name: "Oberwand und Dach", von: 1.75, bis: 2.4, rest: 0.08, ab: 0, voll: 0.6, knick: 2.05, nach: 1 },
    ],
  },
};

export const GROSSWRACK_FORMEN: Record<GrosswrackId, WrackformDef> = {
  lkw: FORM_LKW,
  wohnwagen: FORM_WOHNWAGEN,
};
