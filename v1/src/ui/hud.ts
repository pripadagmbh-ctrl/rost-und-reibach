import { getMaterial, istAbfall, normalizeMaterialId } from "../materials/catalog";
import { euroIndicator, masseText, preisProTonne } from "../materials/purity";
import type { ScrapItem } from "../world/scrapItems";
import type { AmpelState } from "../world/containers";
import { t } from "./sprache";
import { installSeiten } from "./seiten";

/**
 * HUD M1 (Briefing Kap. 14): Griff-Info (Material, Gewicht, €-Indikator),
 * Sortierwert-Anzeige mit Ticker, Abwurf-Ampel-Text.
 */
/**
 * Ab dieser Masse wird ein Stueck beim Namen genannt statt nur nach Fraktion
 * gezaehlt. Darunter sind es Bleche und Profile, bei denen der Name nichts
 * hilft.
 */
const GROSS_AB_KG = 60;
/** So viele Namen hoechstens — danach wird zusammengefasst. */
const GROSS_MAX = 3;

/**
 * Wann die Klammer hinter dem Namen schweigt (E-061, 15.09.2026).
 *
 * Patrick, woertlich:
 *
 * > „Ich muss natuerlich sehen, was ich greife. Wenn es Mischschrott ist, muss
 * > ich das sehen. Wenn es VA ist, muss ich das sehen. **Ausser es ist bei dem
 * > Objekt schon klar, was es ist** — eine Couch ist Muell, da brauche ich
 * > keine Materialbeschreibung zu."
 *
 * ## Die Regel, nach der entschieden wird
 *
 * Die Klammer beantwortet genau eine Frage: **Koennte dasselbe Ding auch aus
 * etwas anderem sein?** Wo die Antwort Ja ist, steht die Fraktion dabei; wo
 * sie Nein ist, waere sie doppelt gemoppelt und kostet nur Platz.
 *
 * Nein heisst sie in zwei Faellen, und beide sind aus den Daten ablesbar —
 * es gibt keine dritte Liste, die jemand pflegen muesste:
 *
 *  1. **Der Name sagt den Stoff schon.** „Alutafel (Aluminium)",
 *     „Kupferrohr-Bund (Kupfer)", „Kantholz (Holz)" — das Wort steht zweimal
 *     in derselben Zeile. Geprueft wird gegen `STOFFWORT` unten.
 *  2. **Der Gegenstand ist Muell, und das sieht man ihm an.** Alle vier
 *     Entsorgungsfraktionen (`ABFALL`: Holz, Reifen, Baumischabfall,
 *     Kunststoff) fallen darunter. Eine Couch, ein Matratzenstapel, ein
 *     Reifenhaufen, ein Betonrohr: Niemand rechnet damit, dass daraus noch
 *     Geld kommt, und welcher der vier Abfallcontainer es genau ist, aendert
 *     am Handgriff nichts.
 *
 * Alles andere behaelt die Klammer — und zwar ausdruecklich die, wo man sich
 * irren kann: Aluminium gegen Edelstahl, Stahlschrott gegen Mischschrott,
 * Kupfer in einem lackierten Motor. Das ist derselbe Wunsch wie am
 * 12.09.2026: „Fluggasttreppe sagt nichts ueber das Material aus."
 */
const STOFFWORT: Record<string, string[]> = {
  steel: ["stahl"],
  va: ["va-", "edelstahl", "v2a"],
  alu: ["alu"],
  copper: ["kupfer"],
  brass: ["messing"],
  // E-150: „verzinkt" ist kein Zink, sondern Stahl- oder Mischschrott — darum nicht hier
  zinc: ["zink"],
  cable: ["kabel"],
  battery: ["batterie", "akku"],
  wood: ["holz", "bohlen"],
  tires: ["reifen"],
  plastic: ["kunststoff", "gfk"],
  rubble: ["beton", "schutt"],
};

/**
 * Nennt der Name den Stoff schon? Kleinschreibung, damit „Alutafel" und
 * „ALU-RONDE" gleich behandelt werden.
 */
function nameNenntStoff(name: string, materialId: string): boolean {
  const klein = name.toLowerCase();
  return (STOFFWORT[materialId] ?? []).some((w) => klein.includes(w));
}

/**
 * Ein Stueck, soweit die Griff-Info es braucht.
 *
 * Absichtlich kein `ScrapItem`: Das traegt Netz und Starrkoerper mit sich und
 * laesst sich ausserhalb eines Browsers nicht bauen. Mit diesem schmalen
 * Ausschnitt sind die Textfunktionen ohne Fenster und ohne Physik pruefbar —
 * und genau das braucht der Waechter in `test/greifanzeige.test.ts`, der die
 * laengstmoegliche Zeile ausrechnet.
 */
export interface GriffStueck {
  materialId: string;
  massKg: number;
  shape?: { name?: string; zusammensetzung?: Array<{ materialId: string; anteil: number }> };
  composition?: Array<{ materialId: string; massKg: number }>;
}

/**
 * Die Griff-Info in zwei Zeilen.
 *
 * Anlass (Patrick, 15.09.2026, iPhone mini): „Bei iPhone Mini wird auch durch
 * die Greifanzeige, also was gegriffen worden ist, die Sicht verdeckt."
 *
 * Ursache war nicht die Position allein, sondern dass die Zeile keine Obergrenze
 * hatte: Drei benannte Teile mit Materialangabe, zwei Fraktionen, ein Rest und
 * die Ampel ergeben rund 210 Zeichen. Auf einem 375 px breiten Bildschirm sind
 * das sieben Zeilen — ein Textklotz mitten im Bild.
 *
 * Darum die Trennung: Der **Kopf** traegt, was nie verlorengehen darf (Zustand,
 * Gewicht, Preis, Ampelurteil) und darf umbrechen. Die **Liste** ist die
 * Aufzaehlung; sie steht auf genau einer Zeile und wird am Ende abgeschnitten,
 * wenn sie nicht passt. Verloren geht dabei immer nur der Schwanz der
 * Aufzaehlung — Gesamtgewicht und Ampel stehen im Kopf.
 */
export interface GriffZeilen {
  kopf: string;
  /** Leer = keine zweite Zeile (die CSS-Regel `#grip-liste:empty` blendet sie aus). */
  liste: string;
}

/**
 * Wie ein Stueck in der Griff-Info heisst.
 *
 * Der Name aus dem Katalog, und wenn keiner da ist, die Fraktion. Seit alle
 * Katalogstuecke Namen tragen (`world/scrapItems.ts`, E-061) greift der Ersatz
 * nur noch bei Presspaketen und Wrackteilen.
 */
function stueckName(item: GriffStueck): string {
  return item.shape?.name ?? getMaterial(item.materialId).name;
}

/**
 * Name plus Fraktion, wenn die Fraktion etwas beitraegt.
 *
 * Die Entscheidung faellt `nameNenntStoff` und `ABFALL` (siehe oben bei
 * `STOFFWORT`); hier steht nur noch, wie es gesetzt wird. Endet der Name
 * selbst auf einer Klammer, trennt ein Mittelpunkt statt einer zweiten
 * Klammer — „Wohnwagen-Kuehlschrank (Absorber) (Mischschrott)" liest sich wie
 * ein Tippfehler.
 */
function mitFraktion(item: GriffStueck): string {
  const name = stueckName(item);
  // Entschieden wird am deutschen Namen (STOFFWORT), gezeigt in der Spielsprache (E-170)
  if (!item.shape?.name) return t(name); // der Name IST schon die Fraktion
  const id = normalizeMaterialId(item.materialId);
  if (istAbfall(id) || nameNenntStoff(name, id)) return t(name);
  const frak = t(getMaterial(id).name);
  const gezeigt = t(name);
  return gezeigt.endsWith(")") ? `${gezeigt} · ${frak}` : `${gezeigt} (${frak})`;
}

/**
 * Text fuer ein anvisiertes Stueck.
 *
 * `▼ Kühlschrank (Mischschrott) · 55 kg · 160 €/t €`
 *
 * Drei Aenderungen am 15.09.2026 (E-061), alle auf Ansage:
 *
 *  - **Die Prozente sind weg.** Dort stand „(Mischschrott · 34 % Kupfer)".
 *    Patrick: „Dann sind mir die Anteile, zu wie viel Prozent das Mischschrott
 *    ist, relativ egal."
 *  - **Die Fraktion bleibt.** „Ich muss natuerlich sehen, was ich greife."
 *  - **Bei eindeutigen Gegenstaenden faellt sie weg** — siehe `STOFFWORT`.
 *
 * Es ist ein einzelnes Stueck, also eine begrenzte Zeile — hier gibt es nichts
 * zu kuerzen.
 */
export function griffZiel(item: GriffStueck, mitPreis = true): GriffZeilen {
  const mat = getMaterial(item.materialId);
  // Im Simulator (E-118) gibt es kein Geld — dann endet die Zeile beim Gewicht
  const preis = mitPreis ? ` · ${preisProTonne(mat)} ${euroIndicator(mat)}` : "";
  return {
    kopf: `▼ ${mitFraktion(item)} · ${masseText(item.massKg)}${preis}`,
    liste: "",
  };
}

/**
 * Text fuer die getragene Ladung.
 *
 * Grosse Stuecke werden beim Namen genannt, kleine nach Fraktion
 * zusammengefasst (Wunsch 12.09.2026: „evtl. Listenbeschreibung einbauen, was
 * in Spinne liegt, zumindest fuer grosse Teile").
 *
 * **Ohne Zielhinweis seit E-061.** Hier stand „› ueber MISCHSCHROTT: ✓ passt".
 * Patrick am 15.09.2026: „Ich brauche jetzt nicht die Info, ob ich das zum
 * Mischschrott hinladen soll oder zum Stahlschrott. … Die Info brauche ich
 * nicht, weil ich sehe es ja quasi, weil es gruen aufleuchtet auf dem Feld."
 *
 * Damit haengt die Abwurfentscheidung allein an der Ampel an der Mulde. Der
 * Parameter `hover` bleibt in der Signatur: Die Zone wird weiterhin gemeldet
 * (`ContainerManager.updateHover` faerbt daran das Schild), und wer die Zeile
 * eines Tages zurueckwill, braucht dafuer keine Verdrahtung neu zu bauen.
 */
export function griffLadung(
  items: GriffStueck[],
  _hover: { container: string; ampel: AmpelState } | null
): GriffZeilen {
  const byMat = new Map<string, number>();
  const gross: string[] = [];
  let total = 0;
  for (const it of items) {
    total += it.massKg;
    const name = it.shape?.name;
    if (name && it.massKg >= GROSS_AB_KG && gross.length < GROSS_MAX) {
      gross.push(mitFraktion(it));
      continue;
    }
    byMat.set(it.materialId, (byMat.get(it.materialId) ?? 0) + 1);
  }
  const parts = [
    ...gross,
    ...[...byMat.entries()].map(([id, n]) => `${n}× ${t(getMaterial(id).name)}`),
  ];
  const gezeigt = parts.slice(0, GROSS_MAX + 2);
  if (parts.length > gezeigt.length) gezeigt.push(`+${parts.length - gezeigt.length} ${t("weitere")}`);
  // Gewicht in den Kopf, nicht ans Ende der Aufzaehlung: Es ist die Zahl, nach
  // der man den Abwurf entscheidet, und darf nie mit abgeschnitten werden.
  return { kopf: `${t("Greifer")}: ${masseText(total)}`, liste: gezeigt.join(", ") };
}

/**
 * Schreibt Text und Farbe nur, wenn sie sich geaendert haben.
 *
 * Befund 14.09.2026: Das HUD schrieb `textContent` und `style.color` in jedem
 * Bild neu — auch dann, wenn genau dieselbe Zeile schon dastand. Jedes
 * Schreiben zwingt den Browser, den Textknoten zu ersetzen und den Bereich neu
 * zu setzen. Bei 48 Bildern je Sekunde sind das rund 250 Schreibvorgaenge, von
 * denen die allermeisten nichts aendern: Das Konto steht still, sobald der
 * Ticker eingelaufen ist, und „Auftrag: Kupfer — Container ist leer" aendert
 * sich minutenlang nicht.
 *
 * Das Lesen von `textContent` und `style.color` waere selbst nicht umsonst,
 * darum merkt sich die Tabelle den letzten Stand, statt am Element
 * nachzuschauen.
 */
const zuletztGeschrieben = new WeakMap<HTMLElement, { text: string; farbe: string }>();
/**
 * DIE ZAHLUNGSLAGE DES HOFES (E-081).
 *
 * Es gibt zwei Tore, die Anlieferer aufhalten: der volle Platz
 * (`Shift.acceptsDeliveries`) und das leere Konto (`Account.canBuy`). Fuer den
 * vollen Platz stand seit jeher eine Zeile im Bild — „Platz dicht … erst
 * raeumen!". Fuer das leere Konto blitzte nur ein Toast auf, waehrend der
 * Zustand blieb: Der Spieler stand auf einem Hof, auf dem nichts mehr
 * passierte, und sah nirgends, warum (Befund E-070).
 *
 * Drei Stufen, eine Zeile:
 *
 *   ok      nichts steht da — das ist der Normalfall und braucht kein Wort
 *   knapp   `Account.lowOnCash` (800 EUR). Vorwarnung; gebaut war sie laengst,
 *           benutzt hat sie niemand.
 *   leer    `!Account.canBuy` (unter der Kreditgrenze). Es liefert niemand
 *           mehr, und das aendert sich erst, wenn der Spieler verkauft.
 *
 * ZEICHEN UND WORT, NICHT NUR FARBE (Briefing Kap. 20): „!" und „✗" sind
 * dieselben Zeichen wie in der Abwurf-Ampel, und der Satz sagt dasselbe noch
 * einmal in Worten. Auf einem Bildschirm in der Sonne bleibt die Farbe als
 * Erste weg.
 *
 * DIE SCHWELLEN STEHEN NICHT HIER. 800 EUR und −1500 EUR gehoeren dem
 * Wirtschaftsmodul (`economy/account.ts`); hier wird angezeigt, was ist.
 */
export type Zahlungslage = "ok" | "knapp" | "leer";

/**
 * Die Tagesablaufzeile in ihren zwei Grundfarben.
 *
 * `PLATZ_DICHT` ist dasselbe Orange wie die Warnstufe in `KASSENLAGE` — zwei
 * Aufforderungen, eine Farbe. `NORMAL` ist das Gelb, in dem die Zeile den
 * ganzen Tag ueber steht.
 */
const PLATZ_DICHT = "#e08a5a";
const NORMAL = "#f0d060";

/**
 * Ab hier ist eine Ladung sortenrein, darunter durchwachsen, darunter
 * zusammengekippt.
 *
 * DIESELBEN ZWEI ZAHLEN STEHEN IN `economy/shift.ts` (`REIN_GUT`,
 * `REIN_MITTEL`) — dort entscheiden sie über den Stern am Abend. Sie stehen
 * hier zum zweiten Mal, und zwar mit Absicht: Das HUD darf nichts aus dem
 * Wirtschaftsmodul importieren (Wächter „die Anzeige ruehrt den Kreislauf
 * nicht an" in `test/kassenlage.test.ts`, E-081). Damit sie nicht
 * auseinanderlaufen, liest `test/feierabend.test.ts` beide Quelltexte
 * gegeneinander — ändert einer sich, fällt es auf.
 */
const REIN_GUT = 0.9;
const REIN_MITTEL = 0.65;

/**
 * Das Urteil über eine Reinheit — Zeichen, Wort und Farbe, an einer Stelle.
 *
 * Die Ladezeile im Betrieb und die Sortierquote in der Abrechnung sagen
 * dasselbe über dieselbe Zahl; sie sollen es auch gleich sagen. Das Zeichen
 * ist der zweite Kanal (Briefing Kap. 20): Wer die Farben nicht
 * unterscheidet, liest ✓, ! oder ✗.
 */
export function reinheitsUrteil(reinheit: number): {
  zeichen: string;
  wort: string;
  farbe: string;
} {
  if (reinheit >= REIN_GUT) return { zeichen: "✓", wort: "sortenrein", farbe: "#7ec96a" };
  if (reinheit >= REIN_MITTEL) return { zeichen: "!", wort: "durchwachsen", farbe: NORMAL };
  return { zeichen: "✗", wort: "zusammengekippt", farbe: PLATZ_DICHT };
}

const KASSENLAGE: Record<Zahlungslage, { text: string; farbe?: string }> = {
  ok: { text: "" },
  // Orange wie eine Ladung unter 65 % sortenrein: „noch kein Fehler, aber sieh hin."
  knapp: { text: "! Kasse wird knapp", farbe: "#e08a5a" },
  // Der einzige rote Text im HUD — es gibt auch nur diesen einen Stillstand.
  leer: { text: "✗ Konto leer — niemand liefert", farbe: "#e2705a" },
};

function schreib(el: HTMLElement, text: string, farbe = ""): void {
  const alt = zuletztGeschrieben.get(el);
  if (alt && alt.text === text && alt.farbe === farbe) return;
  el.textContent = text;
  if (farbe) el.style.color = farbe;
  zuletztGeschrieben.set(el, { text, farbe });
}

/**
 * Nachlauf, bevor die Griff-Info verschwindet.
 *
 * Ohne ihn klappt der Kasten bei jedem Ueberstreichen eines Teils auf und zu —
 * beim Schwenken ueber eine Halde waere das ein Flackern, und das ist
 * schlimmer als ein ruhiger Kasten. 400 ms ueberbruecken einen Schwenk,
 * bleiben aber kurz genug, dass dort nie lange etwas steht, was nicht mehr
 * stimmt.
 */
// SW: am Geraet zu bestaetigen (Schwenktempo des Oberwagens)
const GRIFF_NACHLAUF_MS = 400;

export class Hud {
  private gripEl = document.getElementById("gripinfo")!;
  /*
   * Die Griff-Info hat seit dem 15.09.2026 zwei Zeilen: Kopf und Liste (siehe
   * `GriffZeilen`). Beide werden einzeln geschrieben, damit die Liste ihre
   * eigene CSS-Regel bekommt — eine Zeile, am Ende abgeschnitten.
   */
  private gripKopfEl = document.getElementById("grip-kopf")!;
  private gripListeEl = document.getElementById("grip-liste")!;
  /** Startwert passend zum Markup: Dort traegt die Griff-Info noch kein `ruhig`. */
  private ruhig = false;
  /** Startwert passend zum Markup: Dort traegt die Griff-Info schon `weg`. */
  private weg = true;
  /** Zeitpunkt, seit dem der Greifer nichts zu melden hat; 0 = hat etwas. */
  private stillSeitMs = 0;
  private moneyEl = document.getElementById("money")!;
  /*
   * Einmal geholt statt in jedem Bild neu gesucht (Befund 14.09.2026):
   * `updateLoad` und `updateShift` riefen `getElementById` je Bild auf,
   * waehrend `gripEl` und `moneyEl` seit jeher hier stehen. Beide Elemente
   * stehen fest im `index.html` und koennen nicht verschwinden.
   */
  private loadEl = document.getElementById("load");
  private shiftEl = document.getElementById("shift");
  private displayedValue = 0;
  /** Preis in der Griff-Info zeigen? Im Simulator (E-118) setzt `main.ts` das auf false. */
  preiseZeigen = true;

  /**
   * Schreibt beide Zeilen der Griff-Info.
   *
   * `ruhig` heisst: Der Greifer hat gerade nichts zu melden. Dann faellt der
   * Kasten optisch zurueck (blasser Grund, kaum Rand) — er bleibt lesbar, tritt
   * aber nicht mehr als Meldung auf. Die Klasse wird nur bei Wechsel gesetzt,
   * aus demselben Grund, aus dem `schreib()` existiert: kein Schreiben je Bild.
   */
  private setzeGriff(z: GriffZeilen, ruhig: boolean): void {
    this.stillSeitMs = 0;
    if (this.weg) {
      this.weg = false;
      this.gripEl.classList.remove("weg");
    }
    schreib(this.gripKopfEl, z.kopf);
    schreib(this.gripListeEl, z.liste);
    if (ruhig !== this.ruhig) {
      this.ruhig = ruhig;
      this.gripEl.classList.toggle("ruhig", ruhig);
    }
  }

  /**
   * Der Greifer hat nichts zu melden: offen, leer, nichts in Reichweite.
   *
   * Patrick am 15.09.2026: „Ich weiss nicht, wofuer wir ‚Greifer offen'
   * ueberhaupt brauchen. Also kann ganz verschwinden." Also steht dort nichts
   * mehr — kein blasser Kasten, kein Platzhalter. Der Zustand des Greifers ist
   * am Greifer selbst zu sehen; ein Kasten, der nur sagt, dass nichts los ist,
   * verdeckt Platz, ohne etwas zu sagen.
   *
   * Der Aufruf kommt aus jedem Bild, darum wird hier die Zeit genommen statt
   * ein Zeitgeber gestellt: Erst nach dem Nachlauf faellt der Kasten weg.
   */
  private verbergeGriff(): void {
    if (this.weg) return;
    const jetzt = performance.now();
    if (this.stillSeitMs === 0) {
      this.stillSeitMs = jetzt;
      return;
    }
    if (jetzt - this.stillSeitMs < GRIFF_NACHLAUF_MS) return;
    this.weg = true;
    this.gripEl.classList.add("weg");
  }

  /** Griff-Info bei offenem Greifer: anvisiertes Objekt. */
  showTarget(item: ScrapItem | null): void {
    if (!item) {
      this.verbergeGriff();
      return;
    }
    this.setzeGriff(griffZiel(item, this.preiseZeigen), false);
  }

  /** Griff-Info beim Tragen: Ladungsliste + Ampel. */
  showCarry(items: ScrapItem[], hover: { container: string; ampel: AmpelState } | null): void {
    this.setzeGriff(griffLadung(items, hover), false);
  }

  /**
   * Greifer zu und leer — daneben gegriffen.
   *
   * Das bleibt stehen, obwohl „Greifer: offen" verschwunden ist: Es ist keine
   * Zustandsmeldung, sondern die Antwort auf einen Handgriff. Wer zupackt und
   * nichts bekommt, soll das erfahren; ohne die Zeile sieht man nur eine
   * geschlossene Spinne und weiss nicht, ob sie leer ist oder ob das Teil
   * hinter der Schale steckt. Patrick hat am 15.09.2026 ausdruecklich nur
   * „offen" genannt — und gerade gemeldet, dass mittlere Teile schwer zu
   * fassen sind.
   */
  showClosedEmpty(): void {
    this.setzeGriff({ kopf: t("Greifer: geschlossen (leer)"), liste: "" }, true);
  }

  /** Hinweis bei offener Spinne über einer abreißbaren Baugruppe. */
  showPartHint(name: string): void {
    this.setzeGriff({ kopf: `▼ ${t(name)} — ${t("greifen + halten zum Abreißen")}`, liste: "" }, false);
  }

  /** Reiß-Fortschritt während des Abreißens. */
  showTearing(name: string, progress01: number): void {
    const blocks = Math.round(progress01 * 10);
    this.setzeGriff(
      {
        kopf: `${t(name)} ${t("abreißen")} ${"█".repeat(blocks)}${"░".repeat(10 - blocks)} ${(progress01 * 100).toFixed(0)} %`,
        liste: "",
      },
      false
    );
  }

  /** Konto (echtes Geld) + Haufen-Prognose, Konto mit weichem Ticker. */
  updateMoney(kontoEur: number, pilesValue: number): void {
    this.displayedValue += (kontoEur - this.displayedValue) * 0.12;
    if (Math.abs(this.displayedValue - kontoEur) < 0.5) this.displayedValue = kontoEur;
    schreib(
      this.moneyEl,
      `Konto: ${this.displayedValue.toFixed(0)} € · Haufen ≈ ${pilesValue.toFixed(0)} €`
    );
  }

  /**
   * Ladezustand des wartenden Abholers. Sortenrein zu laden entscheidet über
   * den Erlös — deshalb steht es dauerhaft im Bild, solange einer wartet.
   */
  updateLoad(kg: number | null, purity: number, bestellt: string | null): void {
    const el = this.loadEl;
    if (!el) return;
    if (kg === null) {
      if (el.style.display !== "none") el.style.display = "none";
      return;
    }
    if (el.style.display !== "block") el.style.display = "block";
    const p = Math.round(purity * 100);
    const ziel = bestellt ? getMaterial(bestellt).name : "Gemischt";
    if (kg === 0) {
      schreib(el, `Auftrag: ${ziel} — Container ist leer`, "#9aa2a8");
      return;
    }
    const balken = "█".repeat(Math.round(p / 10)) + "░".repeat(10 - Math.round(p / 10));
    // Ab 90 % lohnt das Abfahren, darunter drückt die Reinheit den Preis.
    // Zeichen und Farbe kommen aus `reinheitsUrteil` — dieselbe Schwelle, die
    // abends über den Stern entscheidet (E-113).
    const u = reinheitsUrteil(purity);
    schreib(el, `${ziel}: ${masseText(kg)} · ${balken} ${p} % sortenrein`, u.farbe);
  }

  /**
   * Phase des Tagesablaufs samt Fortschritt — und davor die Zahlungslage.
   *
   * `lage` steht VORNE, nicht hinten: Wenn niemand mehr liefert, ist das die
   * Nachricht des Bildschirms, und der Umschlag von heute ist die Fussnote.
   * Faerbung und Wortlaut kommen aus `KASSENLAGE`; die Lage selbst wird hier
   * nicht entschieden, sie wird uebergeben (Projektregel 10).
   *
   * ZUGESTELLT HEISST NICHT IN ORDNUNG (Patrick, 17.09.2026).
   *
   * Der zweite Wert hiess `sortierphase` und faerbte GRUEN — ein Rest der
   * abgeschafften Sortierphase. Uebergeben wird dort seit langem
   * `shift.jammed`, also „Platz dicht, erst raeumen!". Gruen fuer eine
   * Aufforderung ist das falsche Signal; der Spieler liest Gruen als „laeuft".
   *
   * Jetzt heisst der Wert, was er ist, und faerbt ORANGE: dieselbe Warnstufe
   * wie „Kasse wird knapp", eine Stufe unter dem Rot des leeren Kontos. Rot
   * ist dem vorbehalten, was den Betrieb anhaelt.
   */
  updateShift(text: string, platzDicht: boolean, lage: Zahlungslage = "ok"): void {
    const el = this.shiftEl;
    if (!el) return;
    const k = KASSENLAGE[lage];
    schreib(el, k.text ? `${k.text} · ${text}` : text, k.farbe ?? (platzDicht ? PLATZ_DICHT : NORMAL));
  }

  /**
   * SCHICHT (E-202): Uhr, Kasse und Wartende in der Zeile des Tagesablaufs —
   * dasselbe Feld wie im Betrieb, eigene Methode, damit die Schicht nicht am
   * Betriebs-Aufruf haengt (`test/spielart.test.ts`). Die volle Anzeige kommt mit S4.
   */
  updateSchicht(text: string, annahmeVoll: boolean): void {
    if (this.shiftEl) schreib(this.shiftEl, text, annahmeVoll ? PLATZ_DICHT : NORMAL);
  }

  /** Kurze Einblendung (Verkauf, Speichern, Anlieferung). */
  toast(msg: string): void {
    const el = document.getElementById("toast")!;
    el.textContent = msg;
    el.style.opacity = "1";
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (el.style.opacity = "0"), 2600);
  }
  private toastTimer = 0;

  /** Sprachwahl und Datenschutz/Lizenzen/Support im Pausenmenü (E-170, E-171). */
  constructor() {
    installSeiten();
  }
}
