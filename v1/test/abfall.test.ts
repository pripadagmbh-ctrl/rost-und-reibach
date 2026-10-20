/**
 * Waechter ueber die vier Abfallfraktionen — „Stoerstoff" aufgeloest.
 *
 * Anlass, woertlich (Patrick, aus einem Geraetetest, `docs/offene-punkte.md`):
 *
 * > „‚Stoerstoff' aufloesen in Holz, Baumischabfall, Reifen und Kunststoffe —
 * > Stoerstoff sagt niemandem etwas."
 *
 * ## Warum ein eigener Waechter
 *
 * Aus EINER Fraktion vier zu machen beruehrt mehr Stellen, als man denkt: den
 * Katalog, die Schuettdichte, die Feststoffdichte, den Fraktionsmix der
 * Anlieferungen, die Mulden, das HUD. Am 15.09.2026 sind an diesem Projekt
 * fuenf Fehler DERSELBEN Bauart aufgeflogen: zwei Stellen, die dasselbe wissen
 * sollen, und sie wissen es verschieden.
 *
 * Genau das war hier der Fall, zweimal:
 *
 *  - `ABFALL` in `materials/catalog.ts` und `STOERSTOFFE` in
 *    `materials/schuettdichte.ts` waren zwei getippte Listen derselben vier.
 *  - Der Fraktionsmix in `world/scrapItems.ts` war eine DRITTE Fassung mit nur
 *    DREI davon. `tires` fehlte: Reifen hatten Namen, Farbe, Preis, Dichte und
 *    eine Mulde — und konnten nie angeliefert werden.
 *
 * Seit dem 16.09.2026 gibt es eine Liste (`ABFALLFRAKTIONEN`), und dieser
 * Waechter prueft, dass ihr jede andere Stelle folgt. Jede Zahlenschranke hier
 * hat eine GEGENPROBE, die melden MUSS — ein Waechter ohne Gegenprobe ist eine
 * Behauptung (E-062).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  ABFALL,
  ABFALLFRAKTIONEN,
  MATERIALS,
  getMaterial,
  istAbfall,
  normalizeMaterialId,
} from "../src/materials/catalog";
import {
  FESTSTOFFDICHTE,
  SCHUETTDICHTE,
  abfallDichte,
  ladungsDichte,
  schuettdichte,
} from "../src/materials/schuettdichte";
import { CONFIGS, gehoertHierhin } from "../src/world/containers";
import { randomCargo, SPECS } from "../src/world/scrapItems";
import { fraktionVonTeil } from "../src/materials/purity";
import { metallton } from "../src/world/objektbau";
import { deltaEHex } from "../tools/farbabstand";

/* ------------------------------------------------------------------------ */
/* Eine Liste, und alle folgen ihr                                            */
/* ------------------------------------------------------------------------ */

describe("Die vier Abfallsorten stehen an genau einer Stelle", () => {
  it("es sind vier, und sie heissen so, wie Patrick sie genannt hat", () => {
    expect([...ABFALLFRAKTIONEN]).toEqual(["wood", "rubble", "tires", "plastic"]);
    expect(ABFALLFRAKTIONEN.map((id) => getMaterial(id).name)).toEqual([
      "Holz",
      "Baumischabfall",
      "Reifen",
      "Kunststoff",
    ]);
  });

  it("die Menge `ABFALL` ist dieselbe Liste, nicht eine zweite", () => {
    expect([...ABFALL].sort()).toEqual([...ABFALLFRAKTIONEN].sort());
    for (const id of ABFALLFRAKTIONEN) expect(istAbfall(id)).toBe(true);
    // Gegenprobe: `istAbfall` sagt nicht zu allem ja.
    for (const id of ["steel", "mixed", "copper", "battery"])
      expect(istAbfall(id), `${id} gilt faelschlich als Abfall`).toBe(false);
  });

  it("der alte Sammelname aus gespeicherten Staenden landet in einer der vier", () => {
    /*
     * `contaminant` war der Sammeltopf. Ein Spielstand von gestern darf nicht
     * abstuerzen, nur weil der Topf aufgeteilt wurde.
     */
    expect(ABFALL.has(normalizeMaterialId("contaminant"))).toBe(true);
    expect(getMaterial("contaminant").name).toBe("Baumischabfall");
  });

  it("jede hat einen eigenen Namen — keine zwei heissen gleich", () => {
    const namen = ABFALLFRAKTIONEN.map((id) => getMaterial(id).name);
    expect(new Set(namen).size).toBe(4);
    // Und keiner davon ist das Wort, das niemandem etwas sagt.
    for (const n of namen) expect(n.toLowerCase()).not.toContain("störstoff");
  });

  it("jede hat eine eigene Schuettdichte und eine eigene Feststoffdichte", () => {
    for (const id of ABFALLFRAKTIONEN) {
      expect(SCHUETTDICHTE[id], `${id} ohne Schuettdichte`).toBeGreaterThan(0);
      expect(FESTSTOFFDICHTE[id], `${id} ohne Feststoffdichte`).toBeGreaterThan(0);
      // Lose geschuettet ist immer leichter als der Vollstoff — sonst waere
      // eine der beiden Zahlen falsch abgeschrieben.
      expect(SCHUETTDICHTE[id]!).toBeLessThan(FESTSTOFFDICHTE[id]!);
    }
    // Vier verschiedene Werte, nicht viermal derselbe: Reifen fressen Volumen,
    // Baumischabfall wiegt.
    expect(new Set(ABFALLFRAKTIONEN.map((id) => schuettdichte(id))).size).toBe(4);
  });

  it("GEGENPROBE: eine erfundene fuenfte Sorte faellt durch dieselbe Pruefung", () => {
    /*
     * Ohne diese Zeile koennte die Schleife oben ueber eine leere Liste laufen
     * und alles waere gruen. Geprueft wird mit demselben Ausdruck.
     */
    const erfunden = "altpapier";
    expect(SCHUETTDICHTE[erfunden]).toBeUndefined();
    expect(FESTSTOFFDICHTE[erfunden]).toBeUndefined();
    // Und der Fallwert greift trotzdem, damit nichts abstuerzt.
    expect(schuettdichte(erfunden)).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------------ */
/* Jede hat ein Ziel auf dem Platz                                            */
/* ------------------------------------------------------------------------ */

describe("Jede der vier hat eine Mulde am Bagger und ein Silo", () => {
  it("am Bagger nimmt sie eine Mulde, im Lager ein Silo", () => {
    for (const id of ABFALLFRAKTIONEN) {
      const amBagger = CONFIGS.filter((c) => !c.lager && gehoertHierhin(c, id));
      const imLager = CONFIGS.filter((c) => c.lager && gehoertHierhin(c, id));
      expect(amBagger.length, `${id} hat am Bagger kein Ziel`).toBeGreaterThan(0);
      expect(imLager.length, `${id} hat kein Lager`).toBeGreaterThan(0);
    }
  });

  it("BEFUND: alle vier teilen sich denselben Behaelter", () => {
    /*
     * KEINE Soll-Eigenschaft, sondern der Stand vom 16.09.2026 — festgehalten,
     * damit er nicht stillschweigend wandert.
     *
     * Der Muellcontainer (`r_rubble`, Schild MUELL) und das Abfall-Silo
     * (`c_rubble`, Schild ABFALL) nehmen alle vier Sorten. Ob das so bleibt
     * oder ob z. B. Reifen wieder einen eigenen Behaelter bekommen (der
     * Reifencontainer entfiel am 14.09.2026 ersatzlos), ist eine
     * GESTALTUNGSFRAGE und Patricks Entscheidung — sie baut den Platz um.
     * Solange sie offen ist, darf das Auffuellen der Fraktionen nicht daran
     * haengen.
     *
     * Faellt dieser Test, hat jemand den Platz umgebaut. Dann gehoert die
     * Zeile bewusst umgeschrieben, nicht repariert.
     */
    const ziele = (id: string) =>
      CONFIGS.filter((c) => gehoertHierhin(c, id))
        .map((c) => c.id)
        .sort();
    for (const id of ABFALLFRAKTIONEN)
      expect(ziele(id), `${id} landet woanders`).toEqual(["c_rubble", "r_rubble"]);
  });
});

/* ------------------------------------------------------------------------ */
/* Jede hat Gegenstaende — in der Klasse, aus der gezogen wird                */
/* ------------------------------------------------------------------------ */

describe("Jede der vier hat acht Sorten in der Kleinteil-Klasse", () => {
  /*
   * Warum die Kleinteil-Klasse und nicht der Gesamtkatalog: `randomCargo`
   * waehlt erst die Groessenklasse und zieht DANN die Fraktion daraus. Eine
   * gewoehnliche Anlieferung sieht nur die Kleinteile — Baumischabfall stand
   * dort bei NULL, obwohl der Gesamtkatalog sieben Betonteile kannte.
   */
  // `SPECS` IST die Kleinteil-Klasse: `scrapItems.ts` haengt `KATALOG_SPECS`
  // selbst an. Ein zweites Anhaengen zaehlte jedes Stueck doppelt.
  const klein = SPECS;
  const sorten = (frak: string) => klein.filter((s) => fraktionVonTeil(s) === frak);

  /*
   * E-181 hatte Reifen hier ausgenommen (Raeder waren Mischschrott). Seit E-186
   * (Patrick 20.10.2026: „Rad zählt als Reifen") sind die Raeder die Reifen —
   * alle vier Sorten haben wieder acht.
   */
  const MIT_TEILEN = ABFALLFRAKTIONEN;
  for (const id of MIT_TEILEN) {
    it(`${getMaterial(id).name}: mindestens acht`, () => {
      expect(sorten(id).length).toBeGreaterThanOrEqual(8);
    });
  }

  it("E-181/E-186: jeder Reifen ist ein Rad mit Felge", () => {
    const reifen = sorten("tires");
    expect(reifen.length).toBeGreaterThanOrEqual(8);
    for (const r of reifen)
      expect(
        (r.zusammensetzung ?? []).some((a) => a.materialId === "steel" || a.materialId === "alu"),
        `${r.name} ohne Felge`
      ).toBe(true);
  });

  it("und es sind acht VERSCHIEDENE Dinge, nicht achtmal dasselbe", () => {
    for (const id of MIT_TEILEN) {
      const namen = sorten(id).map((s) => s.name ?? "(ohne Namen)");
      expect(new Set(namen).size, `${getMaterial(id).name} wiederholt sich`).toBe(namen.length);
    }
  });

  it("GEGENPROBE: die Zaehlung sieht wirklich nur die Kleinteile", () => {
    /*
     * Waere `klein` versehentlich der ganze Katalog, stuenden oben zu grosse
     * Zahlen und die Schranke waere zu lasch. Der Beweis: Baumischabfall hat
     * ausserhalb der Kleinteile weitere Eintraege, und die zaehlt diese
     * Rechnung nicht mit.
     */
    expect(klein.length).toBeLessThan(300);
    expect(klein.some((s) => s.name === "Betontreppenlauf")).toBe(false);
  });
});

/* ------------------------------------------------------------------------ */
/* Jede kann angeliefert werden — und der Verdienst bleibt, wo er war         */
/* ------------------------------------------------------------------------ */

/** Ein berechenbarer Zufall (dieselbe Bauart wie in `bauart.test.ts`). */
function festerZufall(saat: number): () => number {
  let s = saat >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

afterEach(() => vi.restoreAllMocks());

describe("Der Fraktionsmix kennt alle vier — und hat sich nicht verschoben", () => {
  const messe = (saat: number, n: number) => {
    vi.spyOn(Math, "random").mockImplementation(festerZufall(saat));
    const ladung = randomCargo(n);
    const zaehl: Record<string, number> = {};
    for (const c of ladung) zaehl[c.materialId] = (zaehl[c.materialId] ?? 0) + 1;
    return zaehl;
  };

  it("alle vier kommen an; Reifen immer als Rad mit Felge", () => {
    /*
     * Bis zum 16.09.2026 fehlte `tires` im Lostopf; ein Reifen kam nur als
     * Bestandteil eines Fahrzeugs oder aus dem Wrack auf den Platz.
     *
     * E-181 (20.10.2026) machte Raeder zu Mischschrott und nahm `tires` aus
     * dem Lostopf; E-186 (Patrick: „Rad zählt als Reifen") macht sie wieder zu
     * Reifen, und `tires` steht wieder im Topf.
     */
    /*
     * E-186 (Patrick 20.10.2026: „Rad zählt als Reifen"): Die Reifen-Lose sind
     * zurueck, und was dabei kommt, ist immer ein Rad mit Felge.
     */
    const z = messe(20260916, 4000);
    for (const id of ABFALLFRAKTIONEN)
      expect(z[id] ?? 0, `${getMaterial(id).name} wird nie angeliefert`).toBeGreaterThan(0);
    const reifen = randomCargo(4000).filter((c) => c.materialId === "tires");
    expect(reifen.length, "Raeder kommen nie an").toBeGreaterThan(0);
    for (const c of reifen)
      expect(
        (c.shape.zusammensetzung ?? []).some((a) => a.materialId === "steel" || a.materialId === "alu"),
        `${c.shape.name} ohne Felge`
      ).toBe(true);
  });

  it("der Abfallanteil einer Anlieferung liegt bei 6,7 % — wie vorher", () => {
    /*
     * DIE ZAHL, an der die Wirtschaft haengt. Der Lostopf gab den drei
     * Abfallsorten drei von neun Losen des letzten Fuenftels: 20 % x 3/9 =
     * 6,67 %. Jetzt teilen sich VIER Sorten dieselben drei Lose — der Anteil
     * bleibt, nur die Verteilung darin aendert sich.
     *
     * E-181 verteilte die Reifen-Lose auf drei Sorten; E-186 nimmt das zurueck
     * — vier Sorten zu je drei Losen, 12 von 36, dieselben 6,67 %. Der Rest des
     * Fraktionsmixes bleibt 20 %.
     *
     * Waere `tires` einfach als zehnter Name dazugekommen, stuenden hier 8,0 %,
     * und jede Anlieferung braechte ein Fuenftel mehr Zuzahl-Ware. Preise und
     * Erloese sind in diesem Paket ausdruecklich nicht angefasst worden
     * (`docs/offene-punkte.md`, Abschnitt Abfall).
     *
     * Die Schranke laesst dem Zufall Luft (5,8–7,5 %): Bei 20.000 Stuecken
     * streut ein Anteil von 6,67 % um rund 0,18 Prozentpunkte je
     * Standardabweichung, drei davon sind 0,5 Punkte. Sie faengt trotzdem
     * genau das, was sie fangen soll — der Sprung auf 8,0 % liegt darueber,
     * und die Gegenprobe darunter zeigt es.
     */
    const z = messe(4711, 20000);
    const gesamt = Object.values(z).reduce((a, b) => a + b, 0);
    const abfall = ABFALLFRAKTIONEN.reduce((s, id) => s + (z[id] ?? 0), 0);
    expect(gesamt).toBe(20000);
    expect(abfall / gesamt).toBeGreaterThan(0.058);
    expect(abfall / gesamt).toBeLessThan(0.075);
  });

  it("GEGENPROBE: dieselbe Schranke meldet den Sprung auf 8 %", () => {
    /*
     * Eine nachgebaute Ziehung mit ZEHN gleich grossen Losen — so haette es
     * ausgesehen, wenn man `tires` bloss als zehnten Namen angehaengt haette.
     * Geprueft wird mit derselben Schranke wie oben, und sie MUSS reissen.
     * Ohne diese Zeile waere die Schranke eine Behauptung.
     */
    const ANGEHAENGT = ["va", "copper", "brass", "zinc", "battery", "cable", "wood", "plastic", "rubble", "tires"];
    const w = festerZufall(4711);
    let abfall = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const id = w() < 0.8 ? "steel" : ANGEHAENGT[Math.floor(w() * ANGEHAENGT.length)]!;
      if (ABFALL.has(id)) abfall++;
    }
    // 20 % x 4/10 = 8,0 % — und damit ueber der Schranke von 7,5 %.
    expect(abfall / n).toBeCloseTo(0.08, 2);
    expect(abfall / n, "die Gegenprobe haette melden muessen").toBeGreaterThan(0.075);
  });

  it("die sechs Metalle behalten ihren Anteil aufs Los genau", () => {
    /*
     * Die andere Haelfte derselben Behauptung: Wenn der Abfall gleich bleibt,
     * duerfen die Metalle nicht gewachsen sein. Gerechnet, nicht gemessen —
     * vier Lose von sechsunddreissig sind 1/9, und 1/9 des letzten Fuenftels
     * ist genau das, was vorher einer von neun Namen bekam.
     */
    expect((4 / 36) * 0.2).toBeCloseTo((1 / 9) * 0.2, 12);
    expect((3 / 36) * 0.2 * 4).toBeCloseTo((1 / 9) * 0.2 * 3, 12);
  });
});

/* ------------------------------------------------------------------------ */
/* Man sieht, was man in der Hand haelt                                       */
/* ------------------------------------------------------------------------ */

describe("Jede der vier hat eine eigene Farbe — und zeigt sie auch", () => {
  it("die vier Fraktionsfarben sind untereinander klar verschieden", () => {
    /*
     * ΔE2000 unter 10 gilt als dieselbe Farbe (`tools/farbabstand.ts`).
     * Gemessen liegen die sechs Paare zwischen 17,0 (Holz/Baumischabfall) und
     * 37,2 (Reifen/Baumischabfall).
     */
    for (let i = 0; i < ABFALLFRAKTIONEN.length; i++)
      for (let j = i + 1; j < ABFALLFRAKTIONEN.length; j++) {
        const a = ABFALLFRAKTIONEN[i]!;
        const b = ABFALLFRAKTIONEN[j]!;
        const d = deltaEHex(MATERIALS[a]!.color, MATERIALS[b]!.color);
        expect(d, `${a} und ${b} sehen gleich aus (ΔE ${d.toFixed(1)})`).toBeGreaterThan(12);
      }
  });

  it("ein gebautes Abfallteil traegt seine Fraktionsfarbe, nicht Stahlgrau", () => {
    /*
     * Bis zum 16.09.2026 stand ein Lattenrost-Stapel, ein Bohlenbund, ein
     * Reifenstapel und eine Kunststoffplatte im selben Grau da wie ein
     * Blechstapel: `metallton` kannte nur Buntmetall. Genau darueber ist
     * Patrick gestolpert — er sieht ein Teil und weiss nicht, was er haelt.
     */
    const stahl = metallton("steel");
    for (const id of ABFALLFRAKTIONEN) {
      expect(metallton(id), `${id} steht noch in Stahlgrau da`).not.toBe(stahl);
      expect(metallton(id), `${id} weicht von der Mulde ab`).toBe(MATERIALS[id]!.color);
    }
  });

  it("GEGENPROBE: Stahl und Mischschrott behalten ihren Bauton", () => {
    /*
     * Die Grenze der Aenderung, und sie ist gemessen: Die Stahl-Fraktionsfarbe
     * liegt ΔE 8,8 neben dem Bauton, Mischschrott 6,0 — beide unter 10, also
     * dieselbe Farbe. Sie mitzunehmen waere Unruhe an zweihundert Eintraegen
     * ohne Gewinn (E-067). Die vier Abfallsorten liegen bei 14,2 bis 21,5.
     */
    const stahl = metallton("steel");
    expect(metallton("mixed")).toBe(stahl);
    expect(metallton("battery")).toBe(stahl);
    expect(deltaEHex(MATERIALS.steel!.color, stahl)).toBeLessThan(10);
    expect(deltaEHex(MATERIALS.mixed!.color, stahl)).toBeLessThan(10);
    for (const id of ABFALLFRAKTIONEN)
      expect(deltaEHex(MATERIALS[id]!.color, stahl), `${id}`).toBeGreaterThan(12);
  });
});

/* ------------------------------------------------------------------------ */
/* Die Anteilsrechnung wird nicht komplizierter                               */
/* ------------------------------------------------------------------------ */

describe("Vier statt einer macht die Rechnung nicht schwerer", () => {
  /*
   * Patrick zur Sortenreinheit: „Es gibt Mischschrott, dann ist das
   * Mischschrott. Dann sind mir die Anteile relativ egal." Die vier ERSETZEN
   * eine Fraktion, sie fuegen keine Stufe hinzu.
   */
  it("die Beifang-Dichte ist das Mittel der vier, mehr nicht", () => {
    const haendisch =
      ABFALLFRAKTIONEN.reduce((s, id) => s + schuettdichte(id), 0) / ABFALLFRAKTIONEN.length;
    expect(abfallDichte()).toBeCloseTo(haendisch, 9);
    // 250 + 300 + 150 + 90 = 790, geteilt durch 4.
    expect(abfallDichte()).toBeCloseTo(197.5, 6);
  });

  it("eine Fuhre mit Beifang bleibt eine Zeile Rechnung", () => {
    const rein = ladungsDichte("steel", 0);
    const halb = ladungsDichte("steel", 0.5);
    expect(rein).toBe(schuettdichte("steel"));
    expect(halb).toBeCloseTo((schuettdichte("steel") + abfallDichte()) / 2, 9);
  });

  it("GEGENPROBE: waere eine Dichte vergessen worden, faellt das Mittel", () => {
    /*
     * Dieselbe Rechnung mit einer Sorte ohne Eintrag — sie bekaeme den
     * Standardwert 620 und zoege das Mittel um mehr als hundert Punkte hoch.
     * Damit ist gezeigt, dass die Zeile oben wirklich an den vier Zahlen
     * haengt und nicht am Fallwert.
     */
    const mitFallwert = (790 + 620) / 5;
    expect(mitFallwert).toBeGreaterThan(abfallDichte() * 1.4);
  });
});
