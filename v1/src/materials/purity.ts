import type { MaterialClass } from "./catalog";

/**
 * Reinheits- und Erlösrechnung (Briefing Kap. 7) — reine Funktionen, Vitest-geprüft.
 */

/** Reinheit = 1 − Fremdmasse/Gesamtmasse, geklemmt auf [0, 1]. Leerer Container = 1. */
export function computePurity(contentKg: number, contaminationKg: number): number {
  if (contentKg <= 0) return 1;
  return Math.min(Math.max(1 - contaminationKg / contentKg, 0), 1);
}

/**
 * Prognostizierter Erlös eines Containers:
 * Wert = Inhalt × Verkaufspreis × Reinheit².
 * Entsorgungsfraktionen (negativer Preis) kosten unabhängig von der Reinheit.
 */
export function containerValue(
  fraction: MaterialClass,
  contentKg: number,
  contaminationKg: number
): number {
  if (contentKg <= 0) return 0;
  if (fraction.sellPricePerKg < 0) return contentKg * fraction.sellPricePerKg;
  const purity = computePurity(contentKg, contaminationKg);
  return contentKg * fraction.sellPricePerKg * purity * purity;
}

/**
 * Erlös eines Behälters, der MEHRERE Fraktionen fasst — je Stoff zu seinem
 * eigenen Preis.
 *
 * `containerValue` rechnet den ganzen Inhalt zum Preis der Leitfraktion. Das
 * war richtig, solange eine Mulde eine Fraktion hatte; seit zwei Paare
 * zusammengelegt sind (Kupfer + Messing, Alu + Zink) zahlt es Messing zum
 * Kupferpreis und Zink zum Alupreis. Gemessen am Beispiel aus E-028 —
 * je 100 kg Alu, Zink, Kupfer, Messing, Kabel — sind das 1960 statt 1602 €:
 * **22 % zu viel**, und zwar auf dem Schild, an dem der Spieler entscheidet.
 *
 * Mit der Buntmetall-Mulde (fünf Fraktionen in einem Behälter) wäre aus dem
 * Fehler ein Sprung geworden: Derselbe Inhalt stünde je nach gewählter
 * Leitfraktion zwischen 410 € (Zink) und 3600 € (Kupfer) auf dem Schild.
 *
 * Diese Rechnung ist gegen das Zusammenlegen unempfindlich: Wer dieselben
 * Stücke auf eine oder auf fünf Mulden verteilt, liest dieselbe Summe. Was
 * Fremdmasse ist, drückt weiterhin quadratisch (Briefing Kap. 7).
 *
 * `gehoert` sagt, welche Fraktion hier richtig liegt (`gehoertHierhin`).
 */
export function containerValueGemischt(
  massen: Iterable<[string, number]>,
  gehoert: (materialId: string) => boolean,
  preis: (materialId: string) => number
): number {
  let gesamt = 0;
  let passend = 0;
  let brutto = 0;
  for (const [id, kg] of massen) {
    if (kg <= 0) continue;
    gesamt += kg;
    if (gehoert(id)) {
      passend += kg;
      brutto += kg * preis(id);
    }
  }
  if (gesamt <= 0) return 0;
  // Entsorgungsfraktionen kosten unabhängig von der Reinheit (wie oben).
  if (brutto < 0) return brutto;
  const reinheit = passend / gesamt;
  return brutto * reinheit * reinheit;
}

/**
 * Preis als Zahl, die im Handel benutzt wird: **Euro je Tonne**.
 *
 * Intern rechnet alles in Euro je Kilogramm, weil die Massen der Teile in
 * Kilogramm stehen. Nach aussen ist das die falsche Einheit: Schrott wird in
 * Tonnen gehandelt, und „0,25 €/kg" liest niemand, der mit dem Zeug zu tun hat
 * (Ansage 12.09.2026: „bitte mache Angaben immer pro Tonne").
 */
export function preisProTonne(mat: MaterialClass): string {
  const t = Math.round(mat.sellPricePerKg * 1000);
  return t < 0 ? `${t} €/t` : `${t} €/t`;
}

/** Masse lesbar: unter einer Tonne in Kilogramm, darüber in Tonnen. */
export function masseText(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(kg >= 10000 ? 0 : 1)} t` : `${Math.round(kg)} kg`;
}

/** €-Indikator fürs Griff-Info-HUD (Briefing Kap. 14): 1–4 €-Symbole bzw. „Gebühr". */
export function euroIndicator(mat: MaterialClass): string {
  if (mat.sellPricePerKg <= 0) return "Gebühr";
  const n = mat.sellPricePerKg >= 5 ? 4 : mat.sellPricePerKg >= 2 ? 3 : mat.sellPricePerKg >= 1 ? 2 : 1;
  return "€".repeat(n);
}

/**
 * Ab diesem Anteil gilt ein Gemisch noch als sortenrein.
 *
 * Ein Objekt aus Verbundteilen ist nie sortenrein — es sei denn, das Fremde
 * faellt nicht ins Gewicht (Ansage 12.09.2026). Eine Baggerschaufel mit
 * Gumminoppen ist Stahlschrott, weil der Gummi ein paar Prozent ausmacht. Ein
 * Kuehlschrank ist es nicht: Blech, Alu, Kupfer, Styropor und Kunststoff
 * zusammen ergeben Mischschrott, solange sie niemand trennt.
 *
 * Derselbe Wert gilt fuer Presspakete — was zusammen in die Kammer geht, kommt
 * nach derselben Regel heraus.
 */
export const SORTENREIN_AB = 0.95;

/** Ein Stoffanteil an einem Objekt. */
export interface Anteil {
  materialId: string;
  /** Anteil an der Gesamtmasse, 0..1 */
  anteil: number;
}

/**
 * Welche Fraktion ein Objekt ist: die vorwiegende, wenn sie deutlich
 * ueberwiegt — sonst Mischschrott.
 */
export function fraktionAus(zusammensetzung: Anteil[], vorgabe = "steel"): string {
  if (zusammensetzung.length === 0) return vorgabe;
  let groesster = zusammensetzung[0];
  for (const a of zusammensetzung) if (a.anteil > groesster.anteil) groesster = a;
  return groesster.anteil >= SORTENREIN_AB ? groesster.materialId : "mixed";
}

/* ------------------------------------------------------------------------ */
/* Stahlschrott: was Premium ist (E-042, 15.09.2026)                          */
/* ------------------------------------------------------------------------ */

/**
 * Dichte von Stahl in kg/m³. Physik, keine Setzung.
 */
export const STAHL_KG_M3 = 7850;

/**
 * Aussenflaeche eines Teils in m², je Grundform.
 *
 * Die echte Aussenform, nicht der Quader drumherum: Ein Rohr, das man als
 * Quader rechnet, saehe 27 % huelliger aus, als es ist (1 − π/4).
 *
 * - `box`   dims = [a, b, c]                  → 2(ab + bc + ca)
 * - `cyl`   dims = [Radius, Laenge]           → 2πrl + 2πr²
 * - `torus` dims = [Ringradius, Rohrradius]   → 4π²Rr
 * - `wire`  dims = [Radius]                   → 4πr² (Kugel, wie der Kollider)
 *
 * Die Zuordnung der dims steht in `world/scrapItems.ts` beim Kollierbau.
 */
export function aussenflaeche(kind: string, dims: number[]): number {
  if (kind === "cyl") {
    const [r, l] = dims;
    return Math.max(2 * Math.PI * r * l + 2 * Math.PI * r * r, 1e-4);
  }
  if (kind === "torus") {
    const [R, r] = dims;
    return Math.max(4 * Math.PI * Math.PI * R * r, 1e-4);
  }
  if (kind === "wire") {
    const r = dims[0];
    return Math.max(4 * Math.PI * r * r, 1e-4);
  }
  const [a = 1, b = 1, c = 1] = dims;
  return Math.max(2 * (a * b + b * c + c * a), 1e-4);
}

/**
 * Die rechnerische Wandstaerke in Millimetern — das Mass, auf dem die
 * Stahlschrott-Regel steht.
 *
 * Gedankenexperiment: Man schmilzt das Stueck ein und streicht das Metall
 * gleichmaessig als Haut ueber seine eigene Aussenflaeche. Wie dick wird die
 * Haut?
 *
 *     t = Masse / (Dichte von Stahl × Aussenflaeche)
 *
 * Ein Elektroherd von 30 kg hat 3,03 m² Aussenflaeche — das ergibt 1,3 mm, und
 * genau so dick ist Herdblech. Ein Doppel-T-Traeger von 180 kg auf 3,40 m²
 * ergibt 6,7 mm, und genau so dick ist der Steg eines IPE 280. Das Mass raet
 * also nicht, es trifft.
 *
 * Warum nicht die Huellwichte (kg je m³), die es seit E-033 gibt: Sie bestraft
 * grosse Stuecke doppelt. Der Hohlraum waechst mit der dritten Potenz der
 * Groesse, das Blech nur mit der zweiten — ein Seecontainer kaeme auf
 * 73 kg/m³, ein Eisenbahn-Radsatz auf 516, ein Kuehlschrank auf 90. Die
 * Wandstaerke rechnet den Groesseneffekt heraus und sortiert einen kleinen und
 * einen grossen Klotz gleich ein.
 */
export function wandstaerkeMm(massKg: number, kind: string, dims: number[]): number {
  return (1000 * massKg) / (STAHL_KG_M3 * aussenflaeche(kind, dims));
}

/**
 * Ab dieser Wandstaerke ist Stahl Premium.
 *
 * Herkunft: die europaeische Sortenliste fuer Stahlschrott. Dort trennen 6 mm
 * den schweren Altschrott (Sorten E1/E3) vom Blechschrott. Das ist
 * Branchenwissen und im Projekt sonst nirgends belegt — `docs/02_Briefing.md`
 * Kap. 7 nennt Preise, keine Sortenliste. Wer eine Quelle findet, prueft die
 * Zahl gegen.
 *
 * Patrick, 15.09.2026: „Es geht da eher so um Bahnschwellen, Bremsscheiben,
 * Traeger — das ist so wirklich ganz gutes Material. … Ein Elektroherd, das
 * ist vor allem Blechschrott."
 */
export const WAND_AB_MM = 6;

/**
 * Hoechstens so viel Fremdstoff darf an einem Premium-Stueck haengen.
 *
 * Patrick, 15.09.2026: „Stahlschrott sind selten Verbundmaterialien.
 * Natuerlich hast du mal Tanks, wo dann noch was dran ist." Eine Regel, die an
 * einer einzigen Dichtung scheitert, bildet den Platz falsch ab — deshalb
 * nicht 0 %.
 *
 * 10 % statt der 5 % von `SORTENREIN_AB`, weil 5 % genau das verbietet, was er
 * ausdruecklich erlaubt: Ein Tank mit Kunststoff-Schauglas und Dichtungen
 * (8 %) waere nach der alten Schwelle Mischschrott. Gemessen am Katalog vom
 * 15.09.2026 aendert die Lockerung fuer sich genommen **gar nichts** — kein
 * Eintrag liegt zwischen 90 % und 95 %. Sie ist eine Regel fuer kuenftige
 * Eintraege.
 */
/*
 * 0,10 → 0,15 SEIT E-138 (Patrick, 17.10.2026: „Minibagger sind eher Stahl
 * als Mischschrott, weil viel Stahlblech oder Vollmaterial").
 *
 * Beide Minibagger im Katalog sind nach der Wandstaerke massiv (13,5 und
 * 15,3 mm, Schwelle 6 mm) und scheiterten nur am Verbund: 14 % Fremdstoff —
 * Gummiketten, Sitz und Schlaeuche, Alu-Kuehler, Kabelbaum. Das ist der Fall,
 * den diese Zahl von Anfang an abbilden sollte: Fremdes, das an einem
 * schweren Stahlstueck haengt, ohne es zum Verbund zu machen.
 *
 * Gemessen am ganzen Katalog (`tools/stahlschrott.ts`, 374 Eintraege) wechselt
 * mit 0,15 GENAU diese zwei Eintraege die Mulde. Was darueber liegt, bleibt
 * Mischschrott: Motorbloecke (16–18 % Alu und Kupfer), der Minibagger-
 * Raupenunterwagen (20 % Gummiketten), Rangierlok (16 %), Busse und
 * Buerocontainer (24–32 %).
 */
export const VERBUND_BIS = 0.15;

/**
 * Ein Teil, so weit die Sortierregel es kennen muss.
 *
 * `PileSpec` (world/objektkatalog.ts) erfuellt das von selbst; hier steht
 * bewusst kein Import in die Welt, damit `materials/` unten bleibt.
 */
export interface TeilMass {
  materialId: string;
  massKg: number;
  kind: string;
  dims: number[];
  zusammensetzung?: Anteil[];
  /**
   * Uebersteuerung, wenn Rechnung und Augenschein auseinandergehen.
   * `true` = massiv trotz duennem Huellmass, `false` = Blech trotz dickem.
   * Jede Setzung braucht eine Begruendung am Eintrag (E-042).
   */
  massiv?: boolean;
}

/**
 * Welche Fraktion ein Teil ist — die vollstaendige Regel (E-042).
 *
 * Zwei Faelle:
 *
 * 1. **Stahl fuehrt nicht.** Dann entscheidet `fraktionAus` wie bisher: Alu,
 *    VA, Kupfer, Holz bleiben unberuehrt. Ein Alu-Kessel ist Alu, ob massiv
 *    oder hohl — das ist eine Frage des Stoffs, nicht der Bauweise. Die
 *    Premium-Frage stellt sich nur dort, wo zwei Mulden dasselbe Metall
 *    nehmen.
 * 2. **Stahl fuehrt.** Dann ist es Stahlschrott, wenn es massiv ist
 *    (`WAND_AB_MM`, oder `massiv` sagt es ausdruecklich) UND hoechstens
 *    `VERBUND_BIS` Fremdstoff traegt. Sonst Mischschrott.
 *
 * Der Aufruf ist **mehrfach anwendbar**: Wer das Ergebnis in `materialId`
 * zurueckschreibt und die Funktion erneut aufruft, bekommt dasselbe heraus.
 * Darauf verlassen sich `scrapItems.ts` und `objektkatalog.ts`, die beide
 * ueber dieselben Objekte laufen.
 */
export function fraktionVonTeil(teil: TeilMass): string {
  const zus = teil.zusammensetzung ?? [];
  let leitId = teil.materialId;
  let leitAnteil = 1;
  if (zus.length > 0) {
    let groesster = zus[0];
    for (const a of zus) if (a.anteil > groesster.anteil) groesster = a;
    leitId = groesster.materialId;
    leitAnteil = groesster.anteil;
  }
  if (leitId !== "steel") return fraktionAus(zus, teil.materialId);
  if (1 - leitAnteil > VERBUND_BIS + 1e-9) return "mixed";
  const massiv =
    teil.massiv ?? wandstaerkeMm(teil.massKg, teil.kind, teil.dims) >= WAND_AB_MM;
  return massiv ? "steel" : "mixed";
}

/**
 * Laesst sich das Ding pressen?
 *
 * Ansage 12.09.2026: "Stahlschrott wie starre und massive Traeger sollte von
 * der Presse unberuehrt bleiben, wohingegen Kuehlschraenke, Waschmaschinen,
 * Kabinen mit viel Hohlraum zusammengepresst werden koennen."
 *
 * Das braucht kein neues Feld — es steht schon in Masse und Massen. Die Dichte
 * ueber die Huellmasse trennt hohl von massiv sauber: Ein Kuehlschrank kommt
 * auf 90 kg je Kubikmeter, eine Traktorkabine auf 78, ein Seecontainer auf 73;
 * ein Motorblock auf 452, ein Doppel-T-Traeger auf 790. Dazu die Ausnahme fuer
 * Duennes: Ein Blech ist nach Huellmass dicht wie Blei und laesst sich
 * trotzdem falten.
 */
export const HOHL_KG_JE_M3 = 260;
export const DUENN_M = 0.12;

export function istPressbar(massKg: number, dims: number[]): boolean {
  const [a, b, c] = dims;
  const volumen = Math.max((a ?? 1) * (b ?? 1) * (c ?? 1), 1e-4);
  if (Math.min(a ?? 1, b ?? 1, c ?? 1) < DUENN_M) return true;
  return massKg / volumen < HOHL_KG_JE_M3;
}
