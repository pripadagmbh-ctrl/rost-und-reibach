import type { Schichtstufe } from "./kasse";
import { SCHICHT_TORSCHLUSS_S } from "../world/schichtzeit";

/**
 * DER SCHICHT-FAHRPLAN (E-202, 21.10.2026) — wann welche Fuhre ans Tor kommt.
 *
 * Patrick, 21.10.2026 (Antworten zum Schicht-Konzept, `docs/schicht-konzept.md`
 * Abschnitt 2): drei Stufen, nacheinander frei; Fuhren so groß wie heute
 * (Kipper rund 8 t, E-122 — NICHT verkleinern); zeitkritisch wird es über
 * Takt und Wellen; sortenreine Fuhren selten, als Pritsche am Lager.
 *
 * Vergleich: ein Busfahrplan. Er sagt, wann ein Bus an der Haltestelle
 * ANKOMMT — ob er gleich an den Bahnsteig kann oder hinter dem vorigen wartet,
 * entscheidet der Betrieb (`delivery/schichtbetrieb.ts`). Steht er, zählt
 * seine Standzeit.
 *
 * DIE WELLEN (Zeiten in Schicht-Sekunden ab 06:00, eine Spielstunde = 60 s):
 *
 *   0 … 180 s     Welle 1 (06:00–09:00): Grundtakt der Stufe.
 *   180 … 240 s   Frühstück (09:00–10:00): halber Takt — Zeit, den Haufen
 *                 abzuarbeiten.
 *   240 … 540 s   Welle 2 (10:00–15:00): Grundtakt, dazu um 11:00 die Spitze —
 *                 zwei Fuhren direkt hintereinander.
 *   ab 540 s      Torschluss (15:00): keine neue Fuhre (`SCHICHT_TORSCHLUSS_S`,
 *                 aus der einen Uhr gerechnet, E-113).
 *
 * Der Takt läuft als Zähler: In jeder Welle wächst er um 1/Takt je Sekunde, im
 * Frühstück um die Hälfte davon; bei jeder vollen Eins kommt eine Fuhre. Die
 * erste kommt um 06:00 („die erste Fuhre rollt durchs Tor", Konzept).
 *
 * Reine Logik: kein three.js, kein DOM, kein Bus (Wächter in
 * `test/schichtbetrieb.test.ts` liest die Importe).
 */

/** Womit eine Schicht-Fuhre kommt. Kipper kippen selbst, Pritsche und Absetzkipper räumt der Spieler aus. */
export type SchichtFahrzeug = "kipper" | "pritsche" | "absetzer";

/** Eine Zeile im Fahrplan. */
export interface Fahrt {
  /** Ankunft am Tor in Schicht-Sekunden ab 06:00. */
  tS: number;
  /** Misch an die Annahme — oder sortenrein, als Pritsche ans Lager ihrer Sorte. */
  art: "misch" | "sortenrein";
  fahrzeug: SchichtFahrzeug;
  /** Nur bei sortenrein: die Leitfraktion ihres Lagersilos (`copper`, `alu` …). */
  sorte?: string;
}

/* -------------------------------------------------------------- Stellschrauben */

/** Ende der Welle 1 (09:00), in Schicht-Sekunden. Konzept Abschnitt 2. */
export const WELLE1_ENDE_S = 180;
/** Ende des Frühstücks (10:00) = Beginn der Welle 2. Konzept Abschnitt 2. */
export const FRUEHSTUECK_ENDE_S = 240;
/** Im Frühstück läuft der Takt so viel langsamer (halber Takt). Konzept Abschnitt 2. */
export const FRUEHSTUECK_TEILER = 2;
/**
 * Die Spitze (11:00). SW, Auftrag S2: „zwei Fuhren direkt hintereinander um
 * ~300 s". Die reguläre Fuhre der Welle 2, die 300 s am nächsten liegt, wird
 * auf 300 s gezogen, die zweite folgt `SPITZE_ABSTAND_S` dahinter. Danach
 * läuft der Takt weiter, als wäre nichts gewesen.
 */
export const SPITZE_S = 300;
/**
 * SW: 20 s. Kürzer als jede Abladezeit — die zweite kommt also an, solange
 * die erste noch an der Annahme steht, und wartet am Tor. Genau das ist die
 * Spitze: zwei, die gleichzeitig wollen.
 */
export const SPITZE_ABSTAND_S = 20;
/**
 * Wann sortenreine Pritschen kommen dürfen, je eine in einem Fenster (SW).
 * Nicht in der ersten Minute (der Spieler soll erst den Kreis kennen) und
 * nicht nach 480 s (eine Pritsche am Lager braucht Fahrt hin, Abladen, Fahrt
 * zurück — bis Torschluss soll das gehen). Bei einer Pritsche gilt das
 * letzte Fenster, bei zweien beide.
 */
export const SORTENREIN_FENSTER: ReadonlyArray<readonly [number, number]> = [
  [60, 170],
  [250, 480],
];
/**
 * Welche Sorten sortenrein kommen: die Metall-Lagersilos (`world/containers.ts`,
 * `lager: true`), ohne ABFALL — Müll bringt niemand sortenrein, er wird
 * aussortiert. Hier stehen sie als Liste, weil `containers.ts` three.js lädt;
 * der Wächter in `test/schichtbetrieb.test.ts` vergleicht sie mit den Silos,
 * damit sie nicht auseinanderlaufen (E-094).
 */
export const SORTENREIN_SORTEN: readonly string[] = ["copper", "cable", "alu", "va", "battery"];

/** Was eine Stufe ausmacht. */
export interface Stufenplan {
  /** Grundtakt der Misch-Fuhren (s). */
  grundtaktS: number;
  /** Anteile der Fahrzeuge an den Misch-Fuhren (Summe beliebig, wird geteilt). */
  fahrzeuge: Readonly<Partial<Record<SchichtFahrzeug, number>>>;
  /** Wie viele sortenreine Pritschen je Schicht. */
  sortenrein: number;
}

/**
 * DIE DREI STUFEN (alle SW, Auftrag S2, 21.10.2026).
 *
 * Die Fuhrengröße bleibt wie heute: ein Kipper mit Mischschrott rund 8 t
 * (E-122; die Schwellen der Kasse sind aus einer 8-t-Musterfuhre gerechnet,
 * E-203). Der Auftrag nannte dazu rund 62 Teile — das ist die Musterfuhre aus
 * `randomCargo`. AUF DEM WAGEN sind es gemessen 10 bis 26 Teile
 * (`tools/schicht-lauf.ts`, E-202): `loadCargo` legt höchstens rund 28 Stück
 * auf die Fläche und verteilt die Masse darauf (E-033/E-044), ein Stück wiegt
 * also oft 300 bis 900 kg. Bei einem Griff je 4–6 s ist ein Kipper damit in
 * ein bis zwei Minuten geräumt; zeitkritisch wird es über die Pritschen und
 * Absetzkipper (ausräumen statt kippen), über die Spitze und darüber, dass
 * Misch nur auf einen bereitstehenden Misch-Verlader darf. Die Stufen werden
 * über den Takt enger (200 → 160 → 130 s) und über die Arbeit je Fuhre
 * schwerer, nicht über größere Fuhren.
 *
 * Die Anteile (SW): Mittwoch zwei Drittel Kipper, Freitag gut ein Drittel
 * Kipper, je ein knappes Drittel Pritsche und Absetzkipper — so wie die
 * Gewerbekundschaft heute ruft (`customers.rollFahrzeug`: 30 % Absetzkipper).
 */
export const STUFEN: Readonly<Record<Schichtstufe, Stufenplan>> = {
  montag: { grundtaktS: 200, fahrzeuge: { kipper: 1 }, sortenrein: 0 },
  mittwoch: { grundtaktS: 160, fahrzeuge: { kipper: 2, pritsche: 1 }, sortenrein: 1 },
  freitag: { grundtaktS: 130, fahrzeuge: { kipper: 0.4, pritsche: 0.3, absetzer: 0.3 }, sortenrein: 2 },
};

/* ---------------------------------------------------------------- Rechnung */

/** Ein kleiner Zufall mit Saat (mulberry32) — derselbe Fahrplan für dieselbe Saat. */
function zufall(saat: number): () => number {
  let a = saat >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wie schnell der Takt-Zähler zur Zeit `t` wächst (Fuhren je Sekunde). */
function rate(t: number, taktS: number): number {
  return t >= WELLE1_ENDE_S && t < FRUEHSTUECK_ENDE_S ? 1 / (taktS * FRUEHSTUECK_TEILER) : 1 / taktS;
}

/** Die nächste reguläre Fuhre nach `t`: dort, wo der Zähler um eins gewachsen ist. */
function naechsteNach(t: number, taktS: number): number {
  let rest = 1;
  let x = t;
  for (const grenze of [WELLE1_ENDE_S, FRUEHSTUECK_ENDE_S, Infinity]) {
    if (x >= grenze) continue;
    const r = rate(x, taktS);
    const moeglich = (grenze - x) * r;
    if (moeglich >= rest) return x + rest / r;
    rest -= moeglich;
    x = grenze;
  }
  return Infinity;
}

/** Die Ankunftszeiten der Misch-Fuhren: Takt, Frühstück, Spitze, nichts nach Torschluss. */
export function mischZeiten(taktS: number): number[] {
  const regulaer: number[] = [];
  for (let t = 0; t <= SCHICHT_TORSCHLUSS_S; t = naechsteNach(t, taktS)) regulaer.push(Math.round(t));
  // Die Spitze: die Fuhre der Welle 2, die SPITZE_S am nächsten liegt, kommt um SPITZE_S
  const welle2 = regulaer.filter((t) => t >= FRUEHSTUECK_ENDE_S);
  const naechste = welle2.reduce<number | null>(
    (best, t) => (best === null || Math.abs(t - SPITZE_S) < Math.abs(best - SPITZE_S) ? t : best),
    null
  );
  const ohne = regulaer.filter((t) => t !== naechste);
  const spitze = [SPITZE_S, SPITZE_S + SPITZE_ABSTAND_S];
  // Keine reguläre Fuhre mitten in die Spitze hinein (bei sehr kurzem Takt)
  const rest = ohne.filter((t) => t < SPITZE_S - SPITZE_ABSTAND_S || t > SPITZE_S + 2 * SPITZE_ABSTAND_S);
  return [...rest, ...spitze].filter((t) => t <= SCHICHT_TORSCHLUSS_S).sort((a, b) => a - b);
}

/**
 * DER FAHRPLAN EINER SCHICHT.
 *
 * Gleiche Stufe und gleiche Saat → derselbe Fahrplan (für Bestenliste und
 * Wächter). Welche Fahrzeuge kommen, würfelt die Saat nach den Anteilen der
 * Stufe; jede Fahrzeugart der Stufe kommt mindestens einmal vor (sonst wäre
 * ein Mittwoch ohne Pritsche ein Montag). Sortenreine Pritschen bekommen je
 * ein Fenster und eine Sorte, zwei verschiedene, wenn es zwei sind.
 *
 * @param sorten welche Sorten sortenrein kommen können (Vorgabe: die Metall-Lagersilos)
 */
export function fahrplan(stufe: Schichtstufe, saat: number, sorten: readonly string[] = SORTENREIN_SORTEN): Fahrt[] {
  const plan = STUFEN[stufe];
  const z = zufall(saat);
  const arten = (Object.keys(plan.fahrzeuge) as SchichtFahrzeug[]).filter((k) => (plan.fahrzeuge[k] ?? 0) > 0);
  const summe = arten.reduce((s, k) => s + plan.fahrzeuge[k]!, 0);
  const ziehe = (): SchichtFahrzeug => {
    let r = z() * summe;
    for (const k of arten) {
      r -= plan.fahrzeuge[k]!;
      if (r < 0) return k;
    }
    return arten[arten.length - 1]!;
  };
  const misch: Fahrt[] = mischZeiten(plan.grundtaktS).map((tS) => ({ tS, art: "misch", fahrzeug: ziehe() }));
  // Jede Art der Stufe mindestens einmal: Fehlt eine, ersetzt sie eine Fuhre der häufigsten
  for (const k of arten) {
    if (misch.length < arten.length || misch.some((f) => f.fahrzeug === k)) continue;
    const zaehl = (a: SchichtFahrzeug): number => misch.filter((f) => f.fahrzeug === a).length;
    const haeufig = arten.reduce((a, b) => (zaehl(b) > zaehl(a) ? b : a));
    const kandidaten = misch.filter((f) => f.fahrzeug === haeufig);
    kandidaten[Math.floor(z() * kandidaten.length)]!.fahrzeug = k;
  }
  const rein: Fahrt[] = [];
  const frei = [...sorten];
  const fenster = SORTENREIN_FENSTER.slice(Math.max(0, SORTENREIN_FENSTER.length - plan.sortenrein));
  for (let i = 0; i < plan.sortenrein && frei.length > 0; i++) {
    const [von, bis] = fenster[i % fenster.length]!;
    const sorte = frei.splice(Math.floor(z() * frei.length), 1)[0]!;
    rein.push({ tS: Math.round(von + z() * (bis - von)), art: "sortenrein", fahrzeug: "pritsche", sorte });
  }
  return [...misch, ...rein].filter((f) => f.tS <= SCHICHT_TORSCHLUSS_S).sort((a, b) => a.tS - b.tS);
}
