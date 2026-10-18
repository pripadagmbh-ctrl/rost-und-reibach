/**
 * TRAGLAST NACH AUSLADUNG — wie bei einem echten Umschlagbagger.
 *
 * Was eine Umschlagmaschine hebt, haengt am waagrechten Abstand der Last zur
 * Drehmitte (Ausladung): nah viel, weit draussen wenig — das Kippmoment ist
 * Last mal Hebel. Eine feste Zahl (bis E-152: `MAX_TOTAL_KG = 3500`) ist das
 * nicht.
 *
 * E-156 — DIE GROSSE SCHROTTMASCHINE. Patrick, 18.10.2026: „also die
 * leistungsgrenzen, dass scheint nicht so zu funktionieren, ein
 * umschlagbagger sollte grundsätzlich mit mehreren Tonnen klarkommen". Auf
 * Rueckfrage: „Große Schrottmaschine: wie ein Fuchs MHL 335/340 (25–40 t):
 * nah etwa 10 t, bei 8 m etwa 5–6 t, mit Pratzen; ohne Pratzen ein Drittel
 * weniger".
 *
 * WARUM E-152 ZU WENIG WAR. Die Kurve kam aus dem Datenblatt des Fuchs
 * MHL 250 F (16 t), gestreckt auf die MHL-320-Klasse. Das Datenblatt nennt
 * die Werte EINSCHLIESSLICH Anbaugeraet („Gewichte angebauter
 * Lastaufnahmemittel sind abzuziehen"); nach Abzug des Greifers blieben bei
 * 8 m frei stehend 0,99 t — fuer eine Schrottmaschine viel zu wenig.
 *
 * HERKUNFT JETZT. Fuer MHL 335/340 gibt es keine oeffentliche
 * Herstellertabelle (MHL 335: ~25 t, 12 m Reichweite, breitere Abstuetzung
 * „for higher lift capacities", recyclingproductnews.com/article/10612). Die
 * Kurve ist darum ein SW nach Patricks Vorgabe, als NETTO-Werte des
 * Fuenfschalengreifers (so erlebt sie der Spieler), abgestuetzt:
 *
 *        Ausladung       ≤ 3,7 m   5 m    8 m    9 m
 *        netto (Fuenf)    10,0 t  8,0 t  5,5 t  4,75 t
 *
 * Gespeichert wird die MASCHINENTRAGLAST am Stielende (netto + 1 100 kg
 * Fuenfschalengreifer), denn die Maschine ist eine, und jedes Anbaugeraet
 * zieht sein eigenes Gewicht ab: Der Magnet (1,7 t) hebt so 600 kg weniger
 * als der Fuenfschalengreifer. Zwischen den Stuetzstellen linear, innen
 * konstant (dort begrenzt die Hydraulik), aussen mit der letzten Steigung.
 * Die Lasthoehe spielt keine Rolle mehr: Patricks Vorgabe nennt keine, und
 * im Datenblatt unterscheiden sich die Zeilen nur unter 4,5 m.
 */

/**
 * E-154: Ohne Pratzen ein Drittel weniger. SW: Patricks Entscheidung vom
 * 18.10.2026, bestaetigt in E-156 („Pratzen-Regel bleibt"). Angewendet auf
 * die NETTO-Last — so, wie er es formuliert hat und wie der Spieler es
 * erlebt: Was mit Pratzen 6 t sind, sind ohne 4 t.
 */
export const FREI_FAKTOR = 2 / 3;

/** SW E-156: Eigengewicht des Fuenfschalengreifers, auf das die Netto-Ziele bezogen sind (`greiferFuenfschalen.ts`) */
const BEZUG_ANBAU_KG = 1100;
/** SW E-156: Ausladung der Stuetzstellen (m) — 3,7 m ist die kleinste, die unser Arm erreicht */
const R_STUETZ = [3.7, 5, 8, 9];
/** SW E-156: Netto-Ziele mit Fuenfschalengreifer, abgestuetzt (kg) — Patrick 18.10.2026, MHL-335/340-Klasse */
const NETTO_ZIEL = [10000, 8000, 5500, 4750];

/**
 * Was die MASCHINE am Stielende hebt (kg), abgestuetzt, Anbaugeraet noch
 * nicht abgezogen. `ausladungM`: waagrechter Abstand Stielende ↔ Drehmitte.
 */
export function maschinenTraglastKg(ausladungM: number): number {
  const ys = NETTO_ZIEL.map((y) => y + BEZUG_ANBAU_KG);
  const xs = R_STUETZ;
  if (ausladungM <= xs[0]!) return ys[0]!;
  for (let i = 1; i < xs.length; i++) {
    if (ausladungM <= xs[i]!) {
      const t = (ausladungM - xs[i - 1]!) / (xs[i]! - xs[i - 1]!);
      return ys[i - 1]! + (ys[i]! - ys[i - 1]!) * t;
    }
  }
  const n = xs.length - 1;
  const steigung = (ys[n]! - ys[n - 1]!) / (xs[n]! - xs[n - 1]!);
  return Math.max(0, ys[n]! + steigung * (ausladungM - xs[n]!));
}

/**
 * Was an den Greifer gehaengt werden darf (kg): Maschinentraglast mal
 * Ausbau-Faktor, minus Eigengewicht des Anbaugeraets, frei stehend davon
 * `FREI_FAKTOR`. Nie unter null.
 */
export function nutzlastKg(ausladungM: number, anbauKg: number, ausbau = 1, abgestuetzt = true): number {
  const netto = Math.max(0, maschinenTraglastKg(ausladungM) * ausbau - anbauKg);
  return abgestuetzt ? netto : netto * FREI_FAKTOR;
}
