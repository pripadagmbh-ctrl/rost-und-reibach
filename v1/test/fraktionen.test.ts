/**
 * Wächter über die Sortierregel — und über den Abstand zwischen Schild und Kasse.
 *
 * Anlass (Patrick, 15.09.2026, nach dem Gerätetest): „Es ist nicht wirklich
 * erkennbar, was Stahlschrott ist und was Mischschrott ist. Auch die
 * Kategorisierung ist mir nicht ganz bewusst."
 *
 * Die Bestandsaufnahme dazu steht in `docs/fraktionen.md`. Sie hat zwei Löcher
 * gefunden, die dieser Wächter schließt:
 *
 *  1. `fraktionAus` und `SORTENREIN_AB` entscheiden für JEDES Teil im Spiel, ob
 *     es Stahlschrott oder Mischschrott ist — und hatten am 15.09.2026 **keinen
 *     einzigen Test**. Die Regel, an der Patricks Frage hängt, war ungewacht.
 *  2. Schild und Kasse rechnen verschieden (Befund W-1 bis W-10). Das ist NICHT
 *     behoben; dieser Wächter hält den Abstand als Zahl fest, damit er nicht
 *     stillschweigend wandert und damit auffällt, wenn ihn jemand schließt.
 *
 * Wo ein Abschnitt einen BEFUND festhält statt einer Soll-Eigenschaft, steht das
 * dabei. Solche Erwartungen sind grün, weil der Zustand heute so ist — sie
 * gehören angepasst, sobald der Befund behoben wird, und dann absichtlich.
 */
import { describe, it, expect } from "vitest";
import { MATERIALS, getMaterial } from "../src/materials/catalog";
import {
  SORTENREIN_AB,
  containerValueGemischt,
  fraktionAus,
  fraktionVonTeil,
  type Anteil,
} from "../src/materials/purity";
import { Account } from "../src/economy/account";
import { SPECS } from "../src/world/scrapItems";
import { KATALOG_BIG, KATALOG_HUGE, type PileSpec } from "../src/world/objektkatalog";
import { baueGeometrie } from "../src/world/objektbau";
import { CONFIGS, gehoertHierhin } from "../src/world/containers";
import { abrechnungsgruppe, zaehltZu } from "../src/economy/fraktionsgruppen";
import { deltaEHex, pruefeDeltaE } from "../tools/farbabstand";

const ALLE: PileSpec[] = [...SPECS, ...KATALOG_BIG, ...KATALOG_HUGE];
const preis = (id: string): number => getMaterial(id).sellPricePerKg;

/** Verkauf ohne Physik — dieselben Stummel wie in `upgradeEffects.test.ts`. */
const items = { remove: () => {} } as never;
const comps = { despawnByBody: () => false } as never;
function verkauf(inhalt: Array<[string, number]>, order?: string | null): number {
  const ladung = inhalt.map(([materialId, massKg]) => ({
    materialId,
    massKg,
    body: null,
    composition: undefined,
  }));
  return new Account().sellContainer(ladung as never, items, comps, order ?? null).eur;
}
function schild(containerId: string, inhalt: Array<[string, number]>): number {
  const cfg = CONFIGS.find((c) => c.id === containerId);
  if (!cfg) throw new Error(`kein Behaelter ${containerId}`);
  return containerValueGemischt(inhalt, (m) => gehoertHierhin(cfg, m), preis);
}

/* ------------------------------------------------------------------------ */

describe("Die Regel: ab wann ist ein Teil sortenrein", () => {
  const a = (materialId: string, anteil: number): Anteil => ({ materialId, anteil });

  it("die Schwelle liegt bei 95 % und nirgends sonst", () => {
    expect(SORTENREIN_AB).toBe(0.95);
  });

  it("genau auf der Schwelle gilt noch als sortenrein", () => {
    expect(fraktionAus([a("steel", 0.95), a("plastic", 0.05)])).toBe("steel");
  });

  it("einen Hauch darunter ist es Mischschrott — das ist der Fehlerfall", () => {
    expect(fraktionAus([a("steel", 0.9499), a("plastic", 0.0501)])).toBe("mixed");
    // Und auch dann, wenn der Rest lächerlich klein verteilt ist.
    expect(fraktionAus([a("steel", 0.94), a("plastic", 0.03), a("wood", 0.03)])).toBe("mixed");
  });

  it("74 % Stahl sind Mischschrott — genau der Fall, der verwirrt", () => {
    // Kleinwagen-Karosserie, objektkatalog.ts:323
    expect(
      fraktionAus([
        a("steel", 0.74),
        a("plastic", 0.14),
        a("alu", 0.05),
        a("rubble", 0.04),
        a("copper", 0.03),
      ])
    ).toBe("mixed");
  });

  it("ohne Stückliste bleibt die Vorgabe stehen — auch das entscheidet mit", () => {
    expect(fraktionAus([], "va")).toBe("va");
    expect(fraktionAus([])).toBe("steel");
  });

  it("der größte gewinnt, nicht der erste", () => {
    expect(fraktionAus([a("steel", 0.02), a("copper", 0.98)])).toBe("copper");
  });

  it("die Regel gilt für jeden Stoff, nicht nur für Stahl", () => {
    expect(fraktionAus([a("alu", 0.96), a("steel", 0.04)])).toBe("alu");
    expect(fraktionAus([a("alu", 0.94), a("steel", 0.06)])).toBe("mixed");
  });
});

describe("Was der Katalog daraus macht", () => {
  /*
   * BEFUND (docs/fraktionen.md, 1.1): Fast alle Teile sind sortenrein, weil
   * niemand ihre Stückliste eingetragen hat — nicht, weil sie es wären. Diese
   * Zahlen halten den Stand fest. Wandern sie, hat jemand den Katalog
   * umgebaut, und dann gehört die Bestandsaufnahme nachgezogen.
   */
  it("339 erreichbare Einträge, davon 64 mit Stückliste", () => {
    // 271 waren es bis E-042; neun massive Kleinteile sind dazugekommen
    // (Bremsscheibe, Bahnschwelle, Schienenabschnitt, Kurbelwelle …), weil
    // Patricks eigene Premium-Beispiele im Katalog fehlten.
    //
    // 56 waren es bis E-061. Die Couch hat ihre Stückliste verloren und ist
    // damit Kunststoff statt Mischschrott — „eine Couch ist Müll, dann ist es
    // kein VA" (Patrick, 15.09.2026). Eine Stückliste, die aus Sperrmüll eine
    // Fraktion macht, die Geld bringt, ist rechnerisch richtig und sachlich
    // falsch.
    //
    // 280 waren es bis E-063. Dreiunddreissig sind dazugekommen: sechs Kupfer,
    // sechs Messing, fuenf Kabel, sechs VA, vier Zink, vier Batterien und zwei
    // Polstermoebel („Auffuellen, mindestens acht je Fraktion", 15.09.2026).
    // Keiner davon hat eine Stueckliste — es sind sortenreine Einzelteile, und
    // genau deshalb bleibt die zweite Zahl stehen.
    //
    // 313 waren es bis E-067. Vierzehn sind dazugekommen, als „Stoerstoff"
    // aufgeloest wurde (16.09.2026): acht Baumischabfall (die Fraktion hatte
    // in der Kleinteil-Klasse **null** Gegenstaende), vier Reifen, zwei Holz.
    // Keiner davon hat eine Stueckliste — ein Reifen ist ein Reifen —, und
    // genau deshalb bleibt die zweite Zahl stehen.
    //
    // 327 waren es bis E-123. Zehn Grossteile sind dazugekommen — Container,
    // Gerueste, kleine Bagger (Patrick, 06.10.2026). Fuenf davon haben eine
    // Stueckliste: Werkzeugcontainer (Holzboden), Geruestfeld (Bordbrett),
    // Raupenunterwagen (Gummiketten), Minibagger 1,5 t und Minibagger-Ausleger.
    //
    // 337 waren es bis E-150. Verzinktes ist Stahl (Patrick, 17.10.2026:
    // „verzinkt ist kein buntmetall"): Gitterroste, Leitungsrinnen,
    // Geruestrahmen und Geruestrohre tragen jetzt die Stueckliste „Stahl 100 %"
    // (fuer den Magneten, E-146), und zwei echte Zinkteile ersetzen die
    // verlorenen (Kaminverwahrung, Zinkdruckguss) — ohne Stueckliste.
    //
    // E-181 (20.10.2026): gleich viele Eintraege, acht mehr mit Stueckliste.
    // Patrick: „nur einzel reifen" und „Reifen haben immer felge" — acht
    // Reifen ohne Stueckliste (zwei Stapel, Haufen, Bund, Vollgummi-Stapel,
    // LKW-, Erd- und Traktorreifen) sind acht Raeder mit Reifen + Felge.
    expect(ALLE.length).toBe(339);
    expect(ALLE.filter((s) => s.zusammensetzung).length).toBe(72);
  });

  it("von den 72 werden 66 zu Mischschrott, genau 6 bleiben sortenrein", () => {
    const mitZus = ALLE.filter((s) => s.zusammensetzung);
    // E-150: Gitterroste, Leitungsrinnen, Geruestrahmen sind duennwandig -> Misch;
    // die Geruestrohre (7,7 mm rechnerisch) sind Stahlschrott.
    // E-181: die acht Raeder sind Verbund -> Mischschrott (58 -> 66).
    expect(mitZus.filter((s) => s.materialId === "mixed").length).toBe(66);
    // E-123: Der Minibagger-Ausleger kommt dazu — 4 % Schlaeuche, massives Blech.
    // E-138: Beide Minibagger (14 % Fremdstoff, massiv) mit `VERBUND_BIS` 0,15
    // — Patrick, 17.10.2026: „Minibagger sind eher Stahl als Mischschrott."
    const rein = mitZus.filter((s) => s.materialId !== "mixed").map((s) => s.name);
    expect(rein.sort()).toEqual([
      "Baggerlöffel",
      "Gerüstrohre verzinkt (Bund)",
      "Minibagger (ausgeschlachtet)",
      "Minibagger 1,5 t (ohne Arm/Dach)",
      "Minibagger-Ausleger mit Stiel",
      "Seecontainer 20 Fuß",
    ]);
  });

  it("die abgeleitete Fraktion stimmt mit der Regel überein — bei jedem Eintrag", () => {
    // Der Fehlerfall wäre eine Liste, die nach dem Ableiten nicht mehr passt.
    // Seit E-042 ist die Regel `fraktionVonTeil` und nicht mehr `fraktionAus`:
    // Sie sieht auch Masse und Maß, nicht nur die Stückliste.
    for (const s of ALLE) {
      expect(fraktionVonTeil(s), s.name ?? "(ohne Namen)").toBe(s.materialId);
    }
  });

  it("derselbe Küchenherd, EINE Fraktion — der Widerspruch ist weg (E-042)", () => {
    /*
     * BEFUND BEHOBEN, und dieser Wächter ist dabei absichtlich rot geworden.
     *
     * Bis zum 15.09.2026 stand hier `herd === "steel"` und
     * `einbau === "mixed"`: derselbe Küchenherd, dieselbe Bauart, dieselbe
     * Farbe — und zwei Mulden, nur weil an einem Eintrag jemand eine
     * Stückliste getippt hatte und am anderen nicht. Seit die Regel aus Masse
     * und Maß rechnet, sind beide Blech (1,3 und 1,7 mm) und beide
     * Mischschrott.
     */
    const herd = ALLE.find((s) => s.name === "Elektroherd");
    const einbau = ALLE.find((s) => s.name === "Einbauherd mit Umluftofen");
    expect(herd?.materialId).toBe("mixed");
    expect(einbau?.materialId).toBe("mixed");
    expect(herd?.bau).toBe(einbau?.bau); // beide `weisseWare`, gleiche Farben
  });
});

describe("Jede Fraktion hat ein Ziel — und eine hat keins in Reichweite", () => {
  it("für jede Fraktion gibt es irgendwo einen Behälter", () => {
    for (const id of Object.keys(MATERIALS)) {
      const ziele = CONFIGS.filter((c) => gehoertHierhin(c, id));
      expect(ziele.length, `${id} hat nirgends ein Ziel`).toBeGreaterThan(0);
    }
  });

  it("jede Fraktion hat auch am Bagger ein Ziel — seit dem 15.09.2026 lückenlos", () => {
    /*
     * BEFUND V-6, behoben noch am selben Tag. Die ursprüngliche Fassung dieses
     * Wächters hielt den Mangel fest: Am Bagger stehen nur die Behälter ohne
     * `lager`, und wer eine Starterbatterie aus einem Wrack fischte, bekam dort
     * überall „falsche Zone" — derselbe offene Punkt, den VA bis zum Vormittag
     * desselben Tages hatte. Sie erwartete ausdrücklich `["battery"]` und trug
     * den Satz „wird das behoben, wird dieser Test rot, und dann gehört er
     * umgeschrieben, und zwar bewusst".
     *
     * Genau das ist passiert: E-029 hat Batterien in „BUNT + VA" gelegt
     * (Patricks Entscheidung, gegen die Empfehlung einer eigenen Mulde — die
     * Folgen lagen ihm vor). Beim Zusammenführen der beiden Pakete wurde dieser
     * Test rot, und das war die Meldung „der Mangel ist weg".
     *
     * Er bewacht jetzt die Lückenlosigkeit statt der Lücke. Fällt künftig eine
     * Fraktion am Bagger heraus, nennt er sie beim Namen.
     */
    const amBagger = CONFIGS.filter((c) => !c.lager);
    const ohneZiel = Object.keys(MATERIALS).filter(
      (id) => !amBagger.some((c) => gehoertHierhin(c, id))
    );
    expect(ohneZiel, `ohne Ziel am Bagger: ${ohneZiel.join(", ")}`).toEqual([]);
  });
});

describe("Schild und Kasse rechnen dieselbe Rechnung (E-094, war W-1 bis W-10)", () => {
  /**
   * Die Kasse, wie sie bis zum 16.09.2026 rechnete — nur für die Gegenprobe.
   *
   * Eine schwerste Fraktion, ihr Preis für die ganze Ladung, Reinheit hoch
   * drei, `mitFraktionen` unbekannt. Sie steht hier, damit der Wächter
   * beweisen kann, dass er Zähne hat: Wer die beiden Rechnungen wieder
   * auseinanderzieht, muss auffallen.
   */
  function alteKasse(inhalt: Array<[string, number]>, order?: string | null): number {
    let gesamt = 0;
    let dominant = "";
    let dominantKg = 0;
    for (const [, kg] of inhalt) gesamt += kg;
    if (order && inhalt.some(([id]) => id === order)) {
      dominant = order;
      dominantKg = inhalt.filter(([id]) => id === order).reduce((s, [, kg]) => s + kg, 0);
    } else {
      for (const [id, kg] of inhalt) {
        if (kg > dominantKg) {
          dominantKg = kg;
          dominant = id;
        }
      }
    }
    const r = dominantKg / gesamt;
    return gesamt * preis(dominant) * r * r * r;
  }

  /** Jede Mulde mit ihrer Fraktion und einer Fuhre, die genau hineingehört. */
  const faelle: Array<{ container: string; order: string; inhalt: Array<[string, number]> }> = [
    { container: "c_steel", order: "steel", inhalt: [["steel", 760], ["mixed", 240]] },
    { container: "c_copper_lager", order: "copper", inhalt: [["copper", 100], ["brass", 100]] },
    { container: "c_alu_lager", order: "alu", inhalt: [["alu", 100], ["zinc", 100]] },
    { container: "c_cable_lager", order: "cable", inhalt: [["cable", 250]] },
    { container: "c_va_lager", order: "va", inhalt: [["va", 180], ["steel", 20]] },
    { container: "c_battery", order: "battery", inhalt: [["battery", 300]] },
    {
      container: "c_rubble",
      order: "rubble",
      inhalt: [["rubble", 100], ["tires", 100], ["wood", 100], ["plastic", 100]],
    },
  ];

  it("für jede Lagermulde steht auf dem Schild, was die Kasse zahlt", () => {
    for (const f of faelle) {
      const a = schild(f.container, f.inhalt);
      const b = verkauf(f.inhalt, f.order);
      expect(b, `${f.container}: Schild ${a.toFixed(2)} €, Kasse ${b.toFixed(2)} €`).toBeCloseTo(
        a,
        2
      );
    }
  });

  it("GEGENPROBE: die alte Kasse fällt bei genau diesen Fuhren durch", () => {
    /*
     * Ohne diesen Test wäre der obige wertlos — er könnte trivial grün sein.
     * Hier steht, dass er die Abweichung wirklich sieht: Die Rechnung von
     * gestern weicht bei drei der sieben Fuhren ab, um bis zum 68-fachen.
     *
     * Die vier anderen stimmen auch mit der alten Rechnung überein, und das
     * ist kein Zufall: Fasst eine Mulde nur EINE Fraktion, sind beide Formeln
     * algebraisch dasselbe (`passend × r² = gesamt × r³`, weil `r =
     * passend/gesamt`). Genau deshalb ist der Fehler so lange unbemerkt
     * geblieben — er zeigt sich nur an den Sammelmulden.
     */
    const abweichungen = faelle
      .map((f) => ({
        container: f.container,
        schild: schild(f.container, f.inhalt),
        alt: alteKasse(f.inhalt, f.order),
      }))
      .filter((x) => Math.abs(x.schild - x.alt) > 0.005);
    expect(
      abweichungen.map((x) => x.container),
      "die alte Kasse muss auffallen"
    ).toEqual(["c_copper_lager", "c_alu_lager", "c_rubble"]);
    // Und zwar deutlich, nicht auf der letzten Stelle.
    const groesste = Math.max(...abweichungen.map((x) => Math.abs(x.schild - x.alt)));
    expect(groesste).toBeGreaterThan(900); // Kupfer+Messing: 1150 statt 180 €
  });

  it("W-3/W-4: die Sammelmulden sind sortenrein, nicht Mischschrott", () => {
    // Kupfer und Messing gehören in DIESELBE Mulde (E-010) — jedes zu seinem
    // eigenen Preis, keines drückt die Reinheit des anderen.
    expect(verkauf([["copper", 100], ["brass", 100]], "copper")).toBeCloseTo(1150, 2);
    expect(verkauf([["alu", 100], ["zinc", 100]], "alu")).toBeCloseTo(232, 2);
    // Und die Reinheit, die der Spieler dazu abliest, ist 100 %.
    const r = new Account().sellContainer(
      [
        { materialId: "copper", massKg: 100, body: null, composition: undefined },
        { materialId: "brass", massKg: 100, body: null, composition: undefined },
      ] as never,
      items,
      comps,
      "copper"
    );
    expect(r.purity).toBeCloseTo(1, 6);
  });

  it("W-9 behoben: gemischter Abfall kostet dieselbe Gebühr wie getrennter", () => {
    const sorten: Array<[string, number]> = [
      ["rubble", 100],
      ["tires", 100],
      ["wood", 100],
      ["plastic", 100],
    ];
    const einzeln = sorten.reduce((s, x) => s + verkauf([x]), 0);
    expect(verkauf(sorten)).toBeCloseTo(-17, 2);
    expect(verkauf(sorten)).toBeCloseTo(einzeln, 2);
  });

  it("W-10 behoben: die Ladereihenfolge ändert nichts mehr", () => {
    const kupferZuerst: Array<[string, number]> = [
      ["copper", 100],
      ["alu", 100],
      ["zinc", 100],
      ["brass", 100],
      ["cable", 100],
    ];
    const aluZuerst: Array<[string, number]> = [
      ["alu", 100],
      ["zinc", 100],
      ["copper", 100],
      ["brass", 100],
      ["cable", 100],
    ];
    expect(verkauf(kupferZuerst)).toBeCloseTo(verkauf(aluZuerst), 6);
    expect(verkauf(kupferZuerst)).toBeCloseTo(184, 2);
    // Gegenprobe: genau hier war die alte Kasse auseinandergelaufen.
    expect(alteKasse(kupferZuerst)).toBeCloseTo(28.8, 2);
    expect(alteKasse(aluZuerst)).toBeCloseTo(6, 2);
  });

  it("W-1/W-2 bleiben — die Buntmulde ist Durchgang, und ihr Schild sagt das Ziel", () => {
    /*
     * BUNT + VA nimmt sieben Fraktionen auf, ist aber ausdrücklich „Durchgang,
     * nicht Abrechnung" (E-028). Ihr Schild zeigt darum nicht, was die Mulde
     * in einem Zug gekippt bringt, sondern was ihr Inhalt SORTIERT wert ist —
     * und diese Zahl ist jetzt auf den Cent erreichbar.
     */
    const inhalt: Array<[string, number]> = [
      ["copper", 100],
      ["brass", 100],
      ["alu", 100],
      ["zinc", 100],
      ["cable", 100],
      ["va", 100],
    ];
    expect(schild("r_bunt", inhalt)).toBeCloseTo(1742, 2);
    const ueberDieSilos =
      verkauf([["copper", 100], ["brass", 100]], "copper") +
      verkauf([["alu", 100], ["zinc", 100]], "alu") +
      verkauf([["cable", 100]], "cable") +
      verkauf([["va", 100]], "va");
    expect(ueberDieSilos).toBeCloseTo(1742, 2);
    // In einem Zug gekippt ist es eine Mischung und bringt einen Bruchteil.
    expect(verkauf(inhalt)).toBeCloseTo(127.78, 2);
  });

  it("W-6 bleibt: ohne Bestellung kauft der Abnehmer, was dominiert", () => {
    const inhalt: Array<[string, number]> = [
      ["steel", 400],
      ["mixed", 600],
    ];
    // Als Stahlfuhre bestellt: genau der Schildwert.
    expect(schild("c_steel", inhalt)).toBeCloseTo(16, 2);
    expect(verkauf(inhalt, "steel")).toBeCloseTo(16, 2);
    // Ohne Bestellung ist es eine Mischschrottfuhre — andere Ware, anderer Preis.
    expect(verkauf(inhalt)).toBeCloseTo(34.56, 2);
  });

  it("ein Kühlschrank ist Mischschrott, an der Mulde wie an der Kasse", () => {
    /*
     * Der teuerste der zehn Befunde: Die Kasse las die ROHSTOFFE eines
     * Verbundteils (Blech, Alu, Kupfer, Kunststoff) und zahlte 1,93 €, das
     * Schild las die FRAKTION und versprach 8,80 €. Seit E-094 lesen beide die
     * Fraktion — das ist dieselbe Regel, nach der schon die Presse etikettiert
     * (E-091) und nach der Lambert sortiert.
     */
    const kuehlschrank = {
      materialId: "mixed",
      massKg: 55,
      body: null,
      composition: [
        { materialId: "steel", massKg: 55 * 0.52 },
        { materialId: "alu", massKg: 55 * 0.1 },
        { materialId: "copper", massKg: 55 * 0.06 },
        { materialId: "plastic", massKg: 55 * 0.32 },
      ],
    };
    const sale = new Account().sellContainer([kuehlschrank] as never, items, comps, null);
    expect(sale.eur).toBeCloseTo(8.8, 2);
    expect(schild("c_mixed", [["mixed", 55]])).toBeCloseTo(8.8, 2);
    // Und die Masse bleibt die wirtschaftliche Masse aus der Zusammensetzung.
    expect(sale.massKg).toBeCloseTo(55, 6);
  });

  it("Platzinventar wiegt weiter null und bringt weiter null (E-079)", () => {
    const besen = {
      materialId: "mixed",
      massKg: 14,
      body: null,
      composition: [{ materialId: "mixed", massKg: 0 }],
    };
    const sale = new Account().sellContainer([besen] as never, items, comps, null);
    expect(sale.eur).toBe(0);
    expect(sale.massKg).toBe(0);
  });
});

describe("Die Abrechnungsgruppe kommt aus der Silo-Reihe, nicht aus einer Liste", () => {
  /*
   * Die Regel in einem Satz: Was in DASSELBE Lagersilo darf, wird zusammen
   * abgerechnet. `containers.ts` weiß das bereits (`lager: true` +
   * `mitFraktionen`) — `economy/fraktionsgruppen.ts` fragt nur nach.
   *
   * Diese Wächter prüfen die Ableitung gegen die Quelle, nicht gegen eine
   * abgeschriebene Kopie: Wer künftig ein Silo umwidmet, verschiebt damit
   * automatisch die Abrechnung, und wenn nicht, fällt es hier auf.
   */
  const silos = CONFIGS.filter((c) => c.lager);

  it("jedes Silo definiert genau eine Gruppe, und alle seine Fraktionen sind darin", () => {
    expect(silos.length, "die Silo-Reihe ist leer").toBeGreaterThanOrEqual(6);
    for (const silo of silos) {
      const fraktionen = [silo.fractionId, ...(silo.mitFraktionen ?? [])];
      for (const a of fraktionen) {
        expect(
          abrechnungsgruppe(a).slice().sort(),
          `${silo.label}: ${a} muss dieselbe Gruppe sehen`
        ).toEqual(fraktionen.slice().sort());
        for (const b of fraktionen) expect(zaehltZu(a, b), `${a} ↔ ${b}`).toBe(true);
      }
    }
  });

  it("Fraktionen aus verschiedenen Silos gehören NICHT zusammen", () => {
    // Die Gegenprobe zur Zeile darüber: Alu ins Kupferlager wäre Fremdstoff.
    expect(zaehltZu("copper", "alu")).toBe(false);
    expect(zaehltZu("alu", "copper")).toBe(false);
    expect(zaehltZu("copper", "steel")).toBe(false);
    expect(zaehltZu("rubble", "steel")).toBe(false);
    // Und eine Fraktion ohne Silo steht für sich allein.
    expect(abrechnungsgruppe("steel")).toEqual(["steel"]);
    expect(abrechnungsgruppe("mixed")).toEqual(["mixed"]);
  });

  it("die Buntmulde am Bagger stiftet KEINE Gruppe — sie ist Durchgang", () => {
    /*
     * Würde die Abrechnung auch die Sortiermulden lesen, hinge alles
     * Nichteisen in einer einzigen Gruppe, und eine in einem Zug gekippte
     * BUNT+VA-Mulde brächte 1742 statt 127,78 €. Die Mulde am Bagger ist aber
     * „Durchgang, nicht Abrechnung" (E-028) — sortiert wird auf dem Weg ins
     * Silo.
     */
    const bunt = CONFIGS.find((c) => c.id === "r_bunt")!;
    expect(bunt.mitFraktionen, "die Buntmulde fasst mehrere Fraktionen").toContain("alu");
    expect(bunt.lager, "sie ist kein Lagersilo").not.toBe(true);
    expect(zaehltZu("copper", "cable"), "Kabel gehört nicht ins Kupferlager").toBe(false);
    expect(zaehltZu("copper", "va")).toBe(false);
  });

  it("es ist gleich, ob je Fraktion oder je Mulde verladen wird", () => {
    /*
     * Die Eigenschaft, die die ganze Reparatur trägt: Dieselben Stücke bringen
     * dasselbe Geld, egal auf wie viele Fuhren sie verteilt werden. Genau das
     * konnte die alte Kasse nicht — dort war es 437,50 € über drei Silos
     * gegen 28,80 € in einem Zug (W-2).
     */
    const zusammen = verkauf([["copper", 120], ["brass", 80]], "copper");
    const getrennt = verkauf([["copper", 120]], "copper") + verkauf([["brass", 80]], "brass");
    expect(zusammen).toBeCloseTo(getrennt, 6);
    expect(zusammen).toBeCloseTo(120 * 7.2 + 80 * 4.3, 2);
  });
});

describe("Die Farbe trägt die Fraktion nicht", () => {
  it("das Messwerkzeug misst richtig — gegen Sharma/Wu/Dalal (2005)", () => {
    /*
     * Zuerst das Werkzeug, dann die Messung. Am 14.09.2026 ist an diesem
     * Projekt ein Messwerkzeug weggeworfen worden, weil es falsch maß.
     */
    const p = pruefeDeltaE();
    expect(p.faelle).toBeGreaterThanOrEqual(16);
    expect(p.maxFehler).toBeLessThan(1e-4);
  });

  it("Stahlschrott und Mischschrott liegen unter ΔE 10", () => {
    const d = deltaEHex(MATERIALS.steel!.color, MATERIALS.mixed!.color);
    expect(d).toBeCloseTo(7.58, 1);
    expect(d, "über 10 wäre eine klar andere Farbe").toBeLessThan(10);
  });

  it("28 Teile ohne Bau (23 bis E-181; die Raeder zeigen Reifen und Felge)", () => {
    /*
     * Alles mit `bau` wird nach Zweck gefärbt (objektbau.ts:22-30).
     * 16 waren es bis E-042; Bremsscheibe und Großzahnrad sind absichtlich
     * ohne `bau` dazugekommen — zwei Stücke mehr, an denen man die
     * Fraktionsfarbe überhaupt sieht. 21 seit E-063: die drei neuen
     * Kupfer- und Kabelringe.
     *
     * Der BEFUND daran ist seit E-063 entschärft, aber nicht durch diese Zahl:
     * Buntmetall zeigt seine Farbe jetzt auch DURCH den Bau (`metallton` in
     * `objektbau.ts`). Ein Kupferkessel ist kupfern, obwohl er `bau: "tank"`
     * trägt. Was dieser Wächter zählt, ist nur noch der unmittelbare Weg.
     *
     * 23 seit dem 16.09.2026: LKW-Reifen und Erdbaureifen sind wie der
     * Traktorreifen nackte Ringe. Und `metallton` trägt seither auch die vier
     * Abfallsorten — ein Lattenrost-Stapel ist braun, ein Reifenstapel
     * schwarz (`test/abfall.test.ts`).
     *
     * 28 seit E-181 (20.10.2026): Die drei nackten Reifen sind Raeder, dazu
     * fuenf Raeder statt Stapel, Haufen und Bund — alle ohne `bau`, das Rad
     * zeichnet `scrapItems.radGeometrie` (Reifen und Felge in einem Netz).
     */
    expect(ALLE.filter((s) => !s.bau).length).toBe(28);
  });

  it("Aluminium ist nicht mehr mit Edelstahl zu verwechseln (E-042)", () => {
    /*
     * Patrick am 15.09.2026: „Aluminium ist in den meisten Fällen grau."
     *
     * Der messbare Teil dahinter: Alu und VA lagen bei ΔE 6,98 — zwei Farben
     * unter 10 sind dieselbe Farbe, und die beiden gehen in VERSCHIEDENE
     * Silos. Zink darf dagegen nah sein: ALU-LAGER nimmt es mit.
     */
    const alu = MATERIALS.alu!.color;
    expect(deltaEHex(alu, MATERIALS.va!.color)).toBeGreaterThan(20);
    expect(deltaEHex(alu, MATERIALS.steel!.color)).toBeGreaterThan(15);
    expect(deltaEHex(alu, MATERIALS.mixed!.color)).toBeGreaterThan(15);
    // Und Alu muss dunkler sein als Zink, sonst ist es wieder das helle Blech.
    const hell = (c: number) => 0.2126 * ((c >> 16) & 0xff) + 0.7152 * ((c >> 8) & 0xff) + 0.0722 * (c & 0xff);
    expect(hell(alu)).toBeLessThan(hell(MATERIALS.zinc!.color));
  });

  it("B-3 behoben: kein Bau liefert mehr ein Netz mit NaN-Ecken (E-063)", () => {
    /*
     * BEFUND bis E-063: `baueGeometrie` las `dims[1]` und `dims[2]`; bei
     * `kind: "wire"` hat `dims` aber nur EINEN Wert — den Kugelradius. Drei
     * Haufen (Ankerkette, Reifenhaufen, Stahlteile-Haufen) bekamen dadurch
     * `undefined` als Kantenlänge und ein Netz voller NaN. Der Kollider fing
     * das ab, das Netz nicht.
     *
     * Behoben, weil der neue „Datenkabel-Verhau" denselben Weg geht — und weil
     * ein Gegenstand, den man nicht sieht, die schärfste Form von „Aussehen und
     * Name gehen auseinander" ist. Bei `wire` ist die Kantenlänge jetzt der
     * Durchmesser.
     */
    const kaputt: string[] = [];
    let geprueft = 0;
    for (const s of ALLE) {
      if (!s.bau) continue;
      geprueft++;
      const t = baueGeometrie(s.bau, s.dims, s.kind);
      const p = t.koerper.getAttribute("position").array as Float32Array;
      if (!p.every((v) => Number.isFinite(v))) kaputt.push(s.name ?? "(ohne Namen)");
      t.koerper.dispose();
      t.glas?.dispose();
    }
    // Ohne diese Zeile wäre der Wächter grün, wenn die Schleife nichts fände.
    expect(geprueft).toBeGreaterThan(250);
    expect(kaputt.sort()).toEqual([]);
  });

  it("die Gegenprobe: ein `wire` mit einer einzigen Kante ergibt einen Würfel", () => {
    /*
     * Beweist, dass die Behebung wirkt und nicht bloß der Zufall. Ein Ballen
     * mit Radius 0,55 m muss 1,10 m Kantenlänge bekommen — und keine NaN.
     */
    const t = baueGeometrie("haufen", [0.55], "wire");
    const p = t.koerper.getAttribute("position").array as Float32Array;
    expect(p.every((v) => Number.isFinite(v))).toBe(true);
    let max = 0;
    for (let i = 0; i < p.length; i += 3) max = Math.max(max, Math.abs(p[i]!));
    expect(max).toBeGreaterThan(0.2);
    expect(max).toBeLessThan(0.75);
    t.koerper.dispose();
  });
});
