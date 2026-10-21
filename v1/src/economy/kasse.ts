import { getMaterial, istAbfall, normalizeMaterialId } from "../materials/catalog";
import { REIN_GUT } from "./shift";

/**
 * DIE SCHICHT-KASSE (E-203, 21.10.2026) — feste Preise, Abzüge, Bilanz.
 *
 * Patrick, 21.10.2026 (`docs/schicht-konzept.md`, Abschnitte 2 und 4): Eine
 * Schicht hat eine Kasse mit festen Preisen je Sorte — Misch wenig, Stahl
 * mehr, Bunt viel —, dazu Abzüge für Standgeld, Fehlwürfe und Schäden. KEIN
 * Ankauf, KEIN Verhandeln, KEIN Ruf; die Kasse beginnt jede Schicht bei 0 €.
 *
 * Vergleich: eine Kasse auf dem Wochenmarkt mit Preisschildern. Was vom Hof
 * fährt, wird nach dem Schild abgerechnet; was am Ende noch in den Kisten
 * liegt, wird zu 70 % angeschrieben; was noch auf dem Abladeplatz liegt, zählt
 * gar nicht.
 *
 * WAS HIER NICHT GILT: „Erlös = kg × Preis × Reinheit²" (Briefing Kap. 7/10,
 * `materials/purity.ts`). Das ist die Rechnung des Sandkastens und der
 * Muldenschilder und bleibt dort. In der Schicht zahlt jedes Teil für sich:
 * Passt es zur Sorte des Abholers, bringt es SEINEN Preis; passt es nicht,
 * gibt es einen Fehlwurf-Abzug (25 €) und den Misch- bzw. Entsorgungspreis.
 * Ein falsches Teil drückt also nicht den Preis der ganzen Ladung, sondern
 * kostet einmal fest — das liest sich auf der Tafel, „Reinheit²" nicht.
 *
 * Reine Logik: kein three.js, kein DOM, kein Bus. Wer bucht, sagt S2
 * (Verdrahtung, eigenes Paket); wer die Bilanz zeigt, sagt die Tafel (ui/).
 */

// ------------------------------------------------------------------ Die Stufen

/**
 * Die drei Schichtstufen, ruhig bis voll (Konzept Abschnitt 2). Andere Pakete
 * importieren den Typ von hier.
 */
export type Schichtstufe = "montag" | "mittwoch" | "freitag";

/** In der Reihenfolge, in der sie freigeschaltet werden. */
export const SCHICHTSTUFEN: readonly Schichtstufe[] = ["montag", "mittwoch", "freitag"];

/**
 * Ist diese Stufe spielbar? Montag immer; jede weitere, sobald die vorige mit
 * mindestens einem Stern beendet wurde (Auftrag S3a: „nacheinander
 * freigeschaltet (ab 1 Stern)"). Ein Stern heißt „Schicht durchgehalten" —
 * wer den Montag zu Ende spielt, darf an den Mittwoch.
 *
 * @param besteSterne die besten Sterne je Stufe (fehlt = nie beendet)
 */
export function stufeFrei(
  stufe: Schichtstufe,
  besteSterne: Partial<Record<Schichtstufe, number>>
): boolean {
  const i = SCHICHTSTUFEN.indexOf(stufe);
  if (i <= 0) return true;
  return (besteSterne[SCHICHTSTUFEN[i - 1]!] ?? 0) >= 1;
}

// ------------------------------------------------------------- Die Kennzahlen

/**
 * Was am Schichtende noch in den Boxen liegt, zählt zu 70 % seines Werts.
 * SW (Patrick 21.10.2026, Konzept Frage 3): genug, dass Sortieren in den
 * letzten Minuten nicht umsonst ist, aber weniger als abgefahren — wer den
 * Abholer füllt, verdient mehr als wer hortet.
 *
 * Gilt nur für POSITIVE Werte. Entsorgungskosten (Müll in der Müllbox) zählen
 * voll: Wer den Müll stehen lässt, spart sich nicht 30 % der Entsorgung.
 */
export const LAGER_ANTEIL = 0.7;

/**
 * Freie Standzeit je Laster in Sekunden. SW (Konzept Abschnitt 4).
 *
 * DIE KASSE ZIEHT SIE NICHT AB. Sie weiß nicht, welcher Laster wie lange
 * steht — das weiß nur die Verdrahtung (S2), je Laster. S2 rechnet mit
 * `standgeldSekunden(standzeit)` die Sekunden über der freien Zeit aus und
 * bucht nur diese mit `bucheStandgeld`. Die Kasse bucht, was sie bekommt.
 */
export const STANDGELD_FREI_S = 60;
/** Standgeld je Sekunde über der freien Zeit. SW (Konzept Abschnitt 4). */
export const STANDGELD_EUR_JE_S = 1;
/** Abzug je Fehlwurf (ein Teil, wo es nicht hingehört). SW (Konzept Abschnitt 4). */
export const FEHLWURF_EUR = 25;
/**
 * Abzug je hartem Aufschlag auf einen Laster oder Container. SW (Konzept
 * Abschnitt 4). Was „hart" ist, entscheidet der Aufrufer — vorgesehen ist
 * dieselbe Grenze wie in den Prüfungen (`HART_AB_MS`, E-163).
 */
export const SCHADEN_EUR = 50;
/** Höchste Wartezeit (Summe Standgeld-Sekunden) für den dritten Stern. SW (Konzept Abschnitt 4: „≤ 2 min"). */
export const WARTE_GUT_S = 120;

/**
 * Verdienst für den zweiten Stern, je Stufe. SW — werden mit dem Test-Fahrer
 * und auf dem Gerät gemessen (Etappe 2).
 *
 * HERLEITUNG. Grundlage ist eine Misch-Fuhre von 8 t wie heute (E-122) im
 * Platzmix aus `randomCargo` (gemessen 21.10.2026 über 96 Saaten, 85 Teile
 * je Saat, Großteilanteil 0,12): Misch 55,0 %, Stahl 28,6 %, Bunt mit Alu,
 * Kabel, Akkus, VA 10,3 %, Müll 6,2 % nach Masse; rund 62 Teile, davon gut 4
 * Müllteile. (E-181 nennt für den Starthaufen 48,9 / 32,6 % — dieselbe
 * Größenordnung.) Mit den Katalogpreisen:
 *
 *   eine Fuhre, alles auf den Misch-Verlader:  ≈ 1 180 € − 4,4 Fehlwürfe ≈ 1 070 €
 *   eine Fuhre, ganz sortiert und abgefahren:  ≈ 2 810 €
 *
 * Der Unterschied steckt fast ganz im Bunt (≈ 1,9 €/kg im Schnitt, rund zehn
 * Teile je Fuhre): Wer nur das Bunt herausfischt und den Rest auf den Verlader
 * wirft, holt den Großteil. Die Schwelle liegt deshalb bei „alles abgearbeitet,
 * alles auf Misch" plus gut der Hälfte des Bunt-Gewinns (mit Lagerrest zu
 * 70 %):
 *
 *   Stufe     Fuhren (S2)   alles Misch   sauber sortiert   Schwelle
 *   Montag        3          ≈ 3 200 €       ≈ 7 900 €        5 000 €
 *   Mittwoch      4          ≈ 4 300 €      ≈ 10 500 €        7 000 €
 *   Freitag     5–6          ≈ 5 900 €      ≈ 14 500 €       10 000 €
 *
 * `test/kasse.test.ts` prüft an einer Musterfuhre, dass jede Schwelle über
 * „alles Misch" und unter „sauber sortiert" liegt — ändert jemand die
 * Katalogpreise, meldet sich der Wächter.
 */
export const VERDIENST_SCHWELLE_EUR: Readonly<Record<Schichtstufe, number>> = {
  montag: 5000, // SW, Herleitung oben
  mittwoch: 7000, // SW, Herleitung oben
  freitag: 10000, // SW, Herleitung oben
};

/** Fraktion des Mischschrotts — ein Verlader mit dieser Bestellung ist ein Misch-Verlader. */
export const MISCH = "mixed";

/** Sekunden Standgeld für einen Laster, der `standzeitS` gestanden hat. */
export function standgeldSekunden(standzeitS: number): number {
  return Math.max(0, standzeitS - STANDGELD_FREI_S);
}

// ------------------------------------------------------------ Die Zuordnung

/**
 * Gehört `materialId` auf einen Abholer mit dieser Bestellung?
 *
 * Die Kasse kennt keine Boxen — sie bekommt die Regel gereicht. Grund: Die
 * Regel steht in `world/containers.ts` (`gehoertHierhin` mit `mitFraktionen`
 * am Box-Datensatz), und diese Datei lädt three.js und Rapier. Eine zweite,
 * abgeschriebene Liste wäre genau die Fehlerklasse, die `fraktionsgruppen.ts`
 * (E-094) abgeschafft hat. Also: dieselbe Regel, von außen hereingereicht,
 * am einfachsten über `sortenregelAus(boxen, gehoertHierhin)`.
 *
 * NICHT `fraktionsgruppen.zaehltZu`: Das ist die Silo-Regel (Kupfer nimmt nur
 * Messing mit). Die BUNT + VA-Box nimmt sieben Sorten — und für die Schicht
 * zählt, was in der BOX richtig liegt (Auftrag S3a: „dieselbe Zuordnung wie
 * die Boxen").
 */
export type Sortenregel = (order: string, materialId: string) => boolean;

/**
 * Die Sortenregel aus den Box-Datensätzen des Platzes.
 *
 * Für eine Bestellung gilt die erste Box mit dieser Leitfraktion; gibt es
 * keine, passt nur genau dieselbe Sorte.
 *
 * @param gehoert die Regel der Boxen — im Spiel `containers.gehoertHierhin`
 */
export function sortenregelAus<B extends { fractionId: string }>(
  boxen: readonly B[],
  gehoert: (box: B, materialId: string) => boolean
): Sortenregel {
  return (order, materialId) => {
    const box = boxen.find((b) => b.fractionId === order);
    return box ? gehoert(box, materialId) : order === materialId;
  };
}

// ---------------------------------------------------------------- Die Teile

/** Ein Anteil eines Teils: Sorte und wirtschaftliche Masse. */
export interface KassenAnteil {
  materialId: string;
  massKg: number;
}

/**
 * Ein Teil auf einem Abholer oder in einer Box.
 *
 * `zusammensetzung` ist die WIRTSCHAFTLICHE Aufteilung, wie im Sandkasten an
 * der Kasse (`account.ts`, E-094): Ein Presspaket bringt mit, welche Sorten
 * hineingingen, und jede Sorte wird für sich gebucht. Die Stückliste eines
 * Teils („woraus ist es gemacht", z. B. die 18 % Kunststoff einer
 * Waschmaschine) gehört NICHT hierher — ein Teil zählt nach seiner Fraktion
 * (E-091: „wohin gehört das"). Ohne `zusammensetzung` ist das ganze Teil
 * seine `materialId`. Ein Teil mit 0 kg (Platzinventar, E-079) bucht nichts.
 */
export interface KassenTeil {
  materialId: string;
  massKg: number;
  zusammensetzung?: KassenAnteil[];
}

/** Ergebnis einer Abfahrt (oder einer Lagerbewertung). */
export interface Buchung {
  /** Erlös in €, auf den Cent; negativ, wenn Entsorgung überwiegt. */
  erloesEur: number;
  /** Teile, die nicht hierher gehören (je Teil einmal, auch bei mehreren falschen Anteilen). */
  fehlwuerfe: number;
  /** `fehlwuerfe × FEHLWURF_EUR` */
  fehlwurfEur: number;
  /** Abgefahrene Masse in kg. */
  kg: number;
  /** Davon richtig einsortiert (für die Sortierquote). */
  richtigKg: number;
}

/** Ist das ein Misch-Verlader (Bestellung „mixed" oder keine)? */
export function istMischVerlader(order: string | null): boolean {
  return order === null || normalizeMaterialId(order) === MISCH;
}

const preis = (id: string): number => getMaterial(id).sellPricePerKg;

/** Cent-genau runden — Geld wird auf den Cent geführt. */
const cent = (eur: number): number => Math.round(eur * 100);

/**
 * Wie ein Anteil auf einem Abholer mit dieser Bestellung zählt.
 *
 *  Misch-Verlader:  Müll → eigener (negativer) Preis, Fehlwurf.
 *                   Alles andere → Mischpreis; „richtig" nur, wenn es Misch
 *                   ist. Stahl und Bunt dort sind KEIN Fehlwurf, nur
 *                   verschenktes Geld (Konzept Abschnitt 4).
 *  Sorten-Abholer:  passt → eigener Preis, richtig.
 *                   passt nicht → Fehlwurf; Müll zu seinem Entsorgungspreis,
 *                   alles andere zum Mischpreis.
 */
function bewerte(
  order: string | null,
  a: KassenAnteil,
  passt: Sortenregel
): { eur: number; fehl: boolean; richtig: boolean } {
  const id = normalizeMaterialId(a.materialId);
  const abfall = istAbfall(id);
  if (istMischVerlader(order)) {
    if (abfall) return { eur: a.massKg * preis(id), fehl: true, richtig: false };
    return { eur: a.massKg * preis(MISCH), fehl: false, richtig: id === MISCH };
  }
  if (passt(order!, id)) return { eur: a.massKg * preis(id), fehl: false, richtig: true };
  return { eur: a.massKg * preis(abfall ? id : MISCH), fehl: true, richtig: false };
}

function anteile(t: KassenTeil): KassenAnteil[] {
  return (t.zusammensetzung ?? [{ materialId: t.materialId, massKg: t.massKg }]).filter(
    (a) => a.massKg > 0
  );
}

/**
 * Eine Ladung bewerten, ohne zu buchen.
 *
 * @param lager true = Lagerbewertung: positive Werte zu `LAGER_ANTEIL`,
 *              Entsorgung voll
 */
function rechne(
  order: string | null,
  teile: readonly KassenTeil[],
  passt: Sortenregel,
  lager: boolean
): Buchung {
  let eur = 0;
  let fehlwuerfe = 0;
  let kg = 0;
  let richtigKg = 0;
  for (const t of teile) {
    let fehl = false;
    for (const a of anteile(t)) {
      const b = bewerte(order, a, passt);
      eur += lager && b.eur > 0 ? b.eur * LAGER_ANTEIL : b.eur;
      kg += a.massKg;
      if (b.richtig) richtigKg += a.massKg;
      if (b.fehl) fehl = true;
    }
    if (fehl) fehlwuerfe++;
  }
  return {
    erloesEur: cent(eur) / 100,
    fehlwuerfe,
    fehlwurfEur: fehlwuerfe * FEHLWURF_EUR,
    kg,
    richtigKg,
  };
}

// ---------------------------------------------------------------- Die Bilanz

/** Eine Box am Schichtende: ihre Sorte (= Bestellung ihres Abholers) und ihr Inhalt. */
export interface KassenBox {
  order: string | null;
  teile: readonly KassenTeil[];
}

/** Die Tafel am Feierabend (Konzept Abschnitt 4, „Ende und Tafel"). */
export interface Schichtbilanz {
  stufe: Schichtstufe;
  /** Was vom Hof gefahren ist (Verlader und Box-Abholer), in Tonnen. */
  tonnenUmgeschlagen: number;
  /** Masse richtig einsortiert / Masse abgefahren, 0..1 (0, wenn nichts fuhr). */
  sortierquote: number;
  /** Summe der gebuchten Standgeld-Sekunden (über der freien Zeit). */
  warteS: number;
  /** Verkauf, einschließlich Entsorgung (negativ). */
  erloesEur: number;
  standgeldEur: number;
  /** Fehlwürfe auf Abholern, im Lager und von außen gemeldete. */
  fehlwurfEur: number;
  schadenEur: number;
  /** Was noch in den Boxen liegt, zu `LAGER_ANTEIL`. */
  lagerwertEur: number;
  /** Erlös + Lagerwert − Standgeld − Fehlwürfe − Schäden. Geht in die Bestenliste. */
  verdienstEur: number;
  /** 0 = abgebrochen · 1 beendet · 2 dazu Verdienst ≥ Schwelle · 3 dazu Quote ≥ REIN_GUT und Wartezeit ≤ 120 s */
  sterne: 0 | 1 | 2 | 3;
}

/**
 * Die Sterne einer Schicht (Konzept Abschnitt 4). Ein Stern ist der Boden für
 * eine beendete Schicht — kein Scheitern (Briefing Kap. 11, „Kein Game Over");
 * eine abgebrochene Schicht hat keinen.
 */
export function schichtSterne(
  stufe: Schichtstufe,
  beendet: boolean,
  verdienstEur: number,
  sortierquote: number,
  warteS: number
): 0 | 1 | 2 | 3 {
  if (!beendet) return 0;
  if (verdienstEur < VERDIENST_SCHWELLE_EUR[stufe]) return 1;
  if (sortierquote >= REIN_GUT && warteS <= WARTE_GUT_S) return 3;
  return 2;
}

/**
 * Die Kasse einer Schicht. Eine je Schicht, beginnt bei 0 €.
 *
 * Geld wird in ganzen Cent geführt, damit die Tafel auf den Cent stimmt.
 */
export class Kasse {
  private erloesCt = 0;
  private fehlwuerfe = 0;
  private schaeden = 0;
  private warteSumme = 0;
  private kgAbgefahren = 0;
  private kgRichtig = 0;

  /**
   * @param stufe  die Schichtstufe (für die Sterne)
   * @param passt  die Zuordnung der Boxen, siehe `Sortenregel`
   */
  constructor(
    readonly stufe: Schichtstufe,
    private readonly passt: Sortenregel
  ) {}

  /**
   * Ein Verlader oder Box-Abholer fährt vom Hof. Bucht Erlös, Fehlwürfe und
   * die Masse für Tonnen und Quote.
   *
   * Die Fehlwürfe, die hier gezählt werden, NICHT zusätzlich über
   * `bucheFehlwurf` melden — sonst zählen sie doppelt.
   *
   * @param order Sorte des Abholers (Leitfraktion der Box), `"mixed"` oder
   *              `null` für den Misch-Verlader
   */
  bucheAbfahrt(order: string | null, teile: readonly KassenTeil[]): Buchung {
    const b = rechne(order, teile, this.passt, false);
    this.erloesCt += cent(b.erloesEur);
    this.fehlwuerfe += b.fehlwuerfe;
    this.kgAbgefahren += b.kg;
    this.kgRichtig += b.richtigKg;
    return b;
  }

  /**
   * Fehlwürfe, die nicht über eine Abfahrt oder das Lager laufen (z. B. ein
   * Teil, das beim Einwerfen erkannt und gleich gemeldet wird). Wer das nutzt,
   * sorgt dafür, dass dasselbe Teil nicht noch einmal abgefahren wird.
   */
  bucheFehlwurf(n = 1): void {
    if (n > 0) this.fehlwuerfe += Math.floor(n);
  }

  /** Harte Aufschläge auf Laster oder Container. */
  bucheSchaden(n = 1): void {
    if (n > 0) this.schaeden += Math.floor(n);
  }

  /**
   * Standgeld-Sekunden, schon ÜBER der freien Zeit (`standgeldSekunden`).
   * Darf jeden Frame mit Bruchteilen gerufen werden: Die Kasse summiert die
   * Sekunden und rechnet das Geld erst in der Bilanz — sonst runden 60
   * Buchungen zu 1,67 Cent je Sekunde auf 1,20 € statt 1,00 €.
   */
  bucheStandgeld(sekunden: number): void {
    if (sekunden > 0) this.warteSumme += sekunden;
  }

  /**
   * Was noch in den Boxen liegt, bewertet wie eine Abfahrt, positive Werte zu
   * `LAGER_ANTEIL`. Bucht nichts — die Bilanz nimmt es mit. Was auf der
   * Annahme liegt, gehört nicht hierher und zählt nichts.
   */
  lagerbestand(boxen: readonly KassenBox[]): Buchung {
    let eur = 0;
    let fehlwuerfe = 0;
    let kg = 0;
    let richtigKg = 0;
    for (const box of boxen) {
      const b = rechne(box.order, box.teile, this.passt, true);
      eur += cent(b.erloesEur);
      fehlwuerfe += b.fehlwuerfe;
      kg += b.kg;
      richtigKg += b.richtigKg;
    }
    return { erloesEur: eur / 100, fehlwuerfe, fehlwurfEur: fehlwuerfe * FEHLWURF_EUR, kg, richtigKg };
  }

  /**
   * Die Bilanz am Feierabend.
   *
   * Sortierquote und Tonnen zählen nur, was vom Hof fuhr — das Lager bringt
   * Geld (70 %), aber keine Tonnen. Fehlwürfe im Lager kosten trotzdem: Ein
   * Teil liegt, wo es nicht hingehört (Konzept Abschnitt 4).
   *
   * @param beendet  Schicht bis Feierabend gespielt (sonst 0 Sterne)
   * @param boxen    Inhalt der Boxen bei Feierabend
   */
  bilanz(beendet: boolean, boxen: readonly KassenBox[] = []): Schichtbilanz {
    const lager = this.lagerbestand(boxen);
    const lagerCt = cent(lager.erloesEur);
    const fehlwurfCt = (this.fehlwuerfe + lager.fehlwuerfe) * FEHLWURF_EUR * 100;
    const schadenCt = this.schaeden * SCHADEN_EUR * 100;
    const standgeldCt = cent(this.warteSumme * STANDGELD_EUR_JE_S);
    const verdienstCt = this.erloesCt + lagerCt - standgeldCt - fehlwurfCt - schadenCt;
    const sortierquote = this.kgAbgefahren > 0 ? this.kgRichtig / this.kgAbgefahren : 0;
    const verdienstEur = verdienstCt / 100;
    return {
      stufe: this.stufe,
      tonnenUmgeschlagen: this.kgAbgefahren / 1000,
      sortierquote,
      warteS: this.warteSumme,
      erloesEur: this.erloesCt / 100,
      standgeldEur: standgeldCt / 100,
      fehlwurfEur: fehlwurfCt / 100,
      schadenEur: schadenCt / 100,
      lagerwertEur: lagerCt / 100,
      verdienstEur,
      sterne: schichtSterne(this.stufe, beendet, verdienstEur, sortierquote, this.warteSumme),
    };
  }
}

// ------------------------------------------------------------ Bestenliste

/**
 * Ein Schicht-Lauf in der Form, die die Bestenliste speichert (E-195,
 * Abschnitt SCHICHTEN; `core/` gehört dem ui-Bereich — dort wird er
 * eingebaut). Alles ganze Zahlen außer den Tonnen, damit Game Center (1.1)
 * den Verdienst ohne Umrechnung nimmt.
 */
export interface SchichtLauf {
  stufe: Schichtstufe;
  /** Tagesverdienst in ganzen Euro (gerundet; kann negativ sein). Sortierschlüssel. */
  verdienstEur: number;
  /** Umgeschlagene Tonnen, eine Nachkommastelle. */
  tonnen: number;
  /** Sortierquote in Basispunkten, 0..10 000 (9 000 = 90,00 %). */
  quoteBp: number;
  /** Wartezeit (Standgeld-Sekunden), ganze Sekunden. */
  warteS: number;
  sterne: 0 | 1 | 2 | 3;
  /** Kalendertag, `JJJJ-MM-TT` in Ortszeit. */
  datum: string;
}

/** Aus der Bilanz den Eintrag für die Bestenliste machen. */
export function schichtLauf(b: Schichtbilanz, wann: Date): SchichtLauf {
  const zwei = (n: number): string => String(n).padStart(2, "0");
  return {
    stufe: b.stufe,
    verdienstEur: Math.round(b.verdienstEur),
    tonnen: Math.round(b.tonnenUmgeschlagen * 10) / 10,
    quoteBp: Math.round(b.sortierquote * 10000),
    warteS: Math.round(b.warteS),
    sterne: b.sterne,
    datum: `${wann.getFullYear()}-${zwei(wann.getMonth() + 1)}-${zwei(wann.getDate())}`,
  };
}
