/**
 * EINE QUELLE FÜR DIE PRÜF-KUNDSCHAFT — damit kein Wächter mehr seine eigene
 * Fuhre erfindet.
 *
 * ANLASS (15.09.2026, E-062). Zwei Messgeräte haben denselben Vorgang gemessen,
 * mit denselben 24 Saaten, und sich um den Faktor zwei widersprochen:
 *
 *   Bodendicke 0,60 m   `test/kipper.test.ts`  Mittel 149 / Höchst 463 km/h
 *                       das zweite Gerät       Mittel 122 / Höchst 228 km/h
 *
 * Nachgemessen mit EINEM Laufapparat und einem Schalter nach dem anderen war
 * der einzige wirksame Unterschied die **Fuhre**. Messfenster, Filter auf
 * dynamische Körper und Solver-Einstellungen änderten Zeichen für Zeichen
 * nichts; das zweite Gerät hatte `fuellgrad: 0.85, dichte: 500, massKg: 5000`
 * von Hand gesetzt.
 *
 * DAS IST IN SICH FALSCH. Seit E-033 gilt im Spiel eine einzige Regel
 * (`fuellgrad.baueFuhre`):
 *
 *     Masse = Füllgrad × Laderaum × Schüttdichte
 *
 * Ein Kipper mit flachem Aufbau hat 14,08 m³ Laderaum, Mischschrott mit 6 %
 * Störstoff wiegt 594,65 kg/m³. 0,85 voll sind damit **7.118 kg**, nicht 5.000
 * — und `dichte: 500` gibt es in `schuettdichte.ts` gar nicht. Der Wagen wurde
 * also 0,85 voll gepackt und die Fuhre anschließend auf 5.000 kg
 * heruntergerechnet: mehr Stücke, jedes zu leicht. `vehicles.ts` liest
 * `c.fuellgrad` (Menge und Größe der Brocken) und `c.massKg` (Gewicht je
 * Stück) an zwei verschiedenen Stellen und merkt nichts davon.
 *
 * DESHALB DIESE DATEI. Wer hier durchgeht, kann die beiden Zahlen nicht mehr
 * auseinanderlaufen lassen: Man gibt genau EINE davon vor, die andere wird
 * gerechnet — mit denselben Funktionen, die das Spiel benutzt.
 *
 * Bewacht von `test/kundenprofil.test.ts`.
 */
import type { CustomerProfile, CustomerGroup } from "../src/delivery/customers";
import { rollCustomer } from "../src/delivery/customers";
import { ladeVolumen, type Aufbau, type Fahrzeugart } from "../src/delivery/fuellgrad";
import { ladungsDichte, SPAENE_SCHUETTDICHTE } from "../src/materials/schuettdichte";
import { AUSSEHEN_NEUTRAL } from "../src/delivery/aussehen";

/**
 * Anteil Störstoff in einer Prüfladung.
 *
 * Ein Startwert (Projektregel 3), aber ein einziger: Er steht in der Dichte
 * UND im Profil, und beide müssen dieselbe Zahl sehen.
 */
export const PRUEF_STOER = 0.06; // SW

export interface PruefKundeWunsch {
  gruppe?: CustomerGroup;
  vehicle?: Fahrzeugart;
  aufbau?: Aufbau;
  sortenrein?: string | null;
  stoerstoffAnteil?: number;
  /** Entweder das hier … */
  fuellgrad?: number;
  /** … oder das hier. Beides zusammen wird abgelehnt. */
  massKg?: number;
  name?: string;
  hardness?: number;
}

/**
 * Ein Kundenprofil für Prüfstände — Füllgrad ODER Masse vorgeben, nie beides.
 *
 * Würfelt nichts. Das ist Absicht: Ein `Math.random()` hier würde den
 * Zufallsstrom jedes Wächters verschieben, der seine Saat selbst setzt, und
 * damit alle festgehaltenen Messreihen ungültig machen.
 */
export function pruefKunde(w: PruefKundeWunsch = {}): CustomerProfile {
  if (w.fuellgrad !== undefined && w.massKg !== undefined) {
    throw new Error(
      "pruefKunde: Fuellgrad UND Masse gesetzt — genau eine der beiden Zahlen " +
        "ist frei, die andere folgt aus Masse = Fuellgrad x Laderaum x Schuettdichte."
    );
  }
  const vehicle = w.vehicle ?? "kipper";
  const aufbau = w.aufbau ?? "flach";
  const sortenrein = w.sortenrein ?? null;
  const stoer = w.stoerstoffAnteil ?? PRUEF_STOER;
  const dichte = ladungsDichte(sortenrein, stoer);
  const raum = ladeVolumen(vehicle, aufbau);
  let fuellgrad: number;
  let massKg: number;
  if (w.massKg !== undefined) {
    massKg = w.massKg;
    /*
     * PASST DIESE MASSE UEBERHAUPT AUF DEN WAGEN?
     *
     * Hier stand `Math.min(1, ...)`, abgeschrieben aus `kipper.test.ts`, und
     * genau das war eine zweite stille Falschfuhre (gefunden 15.09.2026 beim
     * Umbau, E-062): 5.000 kg Alu haben bei 246,85 kg/m3 ein Volumen von
     * 20,3 m3, der flache Kipper fasst 14,08. Der Deckel machte daraus
     * `fuellgrad: 1` NEBEN `massKg: 5000` — dieselbe Unvereinbarkeit um 44 %,
     * wegen der das zweite Messgeraet weggeworfen wurde, nur von der anderen
     * Seite.
     *
     * Eine Fuhre, die nicht auf die Flaeche passt, ist keine Fuhre. Wer ein
     * leichtes Material pruefen will, gibt den Fuellgrad vor; die Kilogramm
     * folgen dann von selbst.
     */
    const fasst = raum * dichte;
    if (massKg > fasst) {
      throw new Error(
        `pruefKunde: ${massKg} kg passen nicht auf ${vehicle}/${aufbau} — ` +
          `${raum.toFixed(2)} m3 mal ${dichte.toFixed(0)} kg/m3 sind ${fasst.toFixed(0)} kg ` +
          `randvoll. Statt der Masse den Fuellgrad vorgeben.`
      );
    }
    fuellgrad = massKg / fasst;
  } else {
    fuellgrad = w.fuellgrad ?? 0.85;
    massKg = Math.round(fuellgrad * raum * dichte);
  }
  return {
    group: w.gruppe ?? "haendler",
    name: w.name ?? "Pruefstand",
    subtitle: "Test",
    massKg,
    vehicle,
    aufbau,
    fuellgrad,
    dichte,
    sortedMaterial: sortenrein,
    contaminantShare: stoer,
    hardness: w.hardness ?? 1,
    greeting: "",
    /*
     * Neutrale Figur (`aussehen.ts`). Prueflaeufe messen nicht das
     * Aussehen, und eine gewuerfelte Statur wuerde hier nur streuen.
     */
    aussehen: AUSSEHEN_NEUTRAL,
  };
}

/**
 * Eine Fuhre, wie das SPIEL sie würfelt — Händler mit Kipper.
 *
 * Kein Gegenentwurf zu `pruefKunde`, sondern die Ergänzung dazu: `pruefKunde`
 * baut eine FESTE Fuhre für Rückschritt-Wächter, `spielFuhre` nimmt die, mit
 * der der Spieler es wirklich zu tun hat. Gewürfelt wird mit `rollCustomer()`,
 * also aus derselben Quelle wie im Spiel — von Hand gebaut wird hier gar
 * nichts (das war der Fehler aus E-062).
 *
 * Gewürfelt wird, bis ein Händler mit Kipper kommt; alles andere fährt einen
 * anderen Wagen und gehört nicht in eine Kipper-Messung. Über die 24 Saaten
 * von `tools/kipper-messreihe.ts` ergibt das im Mittel Füllgrad 0,70 und
 * 8.479 kg — deutlich mehr als die 0,60 / 5.000 kg der festen Prüfladung.
 *
 * Verbraucht Zufall. Wer eine Saat setzt, muss das wissen: Zwei Aufrufe
 * hintereinander liefern verschiedene Fuhren.
 */
export function spielFuhre(): CustomerProfile {
  for (let i = 0; i < 2000; i++) {
    const c = rollCustomer();
    if (c.group === "haendler" && c.vehicle === "kipper") return c;
  }
  throw new Error("spielFuhre: in 2000 Wuerfen kein Haendler mit Kipper");
}

/**
 * Wie weit weicht ein Profil von der Spielregel ab — als Anteil, 0 = genau.
 *
 * Getrennt von `pruefKunde`, damit auch Profile geprüft werden können, die
 * NICHT von hier stammen: `rollCustomer()` aus dem Spiel und die von Hand
 * gebauten in anderen Wächtern.
 *
 * Ein Wrack ist ausgenommen — es ist keine Schüttung, sondern wiegt, was es
 * wiegt (`fuellgrad.baueFuhre`, `WRACK_KG`).
 */
export function fuhrenAbweichung(c: CustomerProfile): number {
  if (c.vehicle === "wrack") return 0;
  const erwartet = c.fuellgrad * ladeVolumen(c.vehicle, c.aufbau) * c.dichte;
  if (!(erwartet > 0)) return Number.POSITIVE_INFINITY;
  return Math.abs(c.massKg - erwartet) / erwartet;
}

/** Schüttdichte, die zu Fraktion und Störstoffanteil eines Profils gehört. */
export function erwarteteDichte(c: CustomerProfile): number {
  // E-147: Eine Spaenemulde hat ihre eigene Schuettdichte (lose Wirrspaene)
  if (c.spaene) return SPAENE_SCHUETTDICHTE;
  return ladungsDichte(c.sortedMaterial, c.contaminantShare);
}
