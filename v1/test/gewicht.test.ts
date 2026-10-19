/**
 * Waechter: Kein Gegenstand wiegt, was sein Werkstoff nicht hergibt (E-063).
 *
 * Anlass, woertlich (Patrick, 15.09.2026):
 *
 * > „Ganz oft sind Aluminium-Sachen, die haben dann zwei Tonnen. Aber
 * > Aluminium ist ja leicht, das ist ja die Eigenschaft von Aluminium … wenn
 * > so ein kleines Aluminiumteil nachher 1,8 Tonnen hat."
 *
 * Gewicht ist einer seiner drei Erkennungskanaele fuer einen Werkstoff — neben
 * Farbe und Zusammensetzung. Ein Kanal, der luegt, ist keiner.
 *
 * ## Die Regel
 *
 * Ein Koerper von V Kubikmetern aus einem Stoff der Dichte rho kann hoechstens
 * rho x V wiegen. Das ist keine Setzung und kein Geschmack, sondern Physik:
 * Alles darueber ist unmoeglich, nicht bloss ungewoehnlich. Die
 * Feststoffdichten stehen in `materials/schuettdichte.ts` und sind dort
 * **Obergrenzen** (Eiche statt Fichte, Beton statt Ziegel), damit der Waechter
 * nur das Unmoegliche anschlaegt und nicht das Ungewoehnliche.
 *
 * ## Warum dieser Waechter eine Gegenprobe hat
 *
 * In der Woche vor dem 15.09.2026 sind an diesem Projekt fuenf Waechter
 * aufgeflogen, die gruen waren und nichts geprueft haben (E-062, „Das Muster,
 * das dahintersteckt"). Ein Waechter ohne Gegenprobe ist eine Behauptung.
 * Darum steht die Pruefung hier als FUNKTION (`unmoeglich`), und dieselbe
 * Funktion laeuft zweimal: einmal ueber den echten Katalog — sie muss
 * schweigen — und einmal ueber denselben Katalog mit EINEM absichtlich
 * verdorbenen Eintrag — sie muss genau den melden.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { alleEintraege, huellVolumen, leitstoff } from "../tools/stahlschrott";
import { feststoffdichte } from "../src/materials/schuettdichte";
import { aussenflaeche, fraktionVonTeil } from "../src/materials/purity";
import type { PileSpec } from "../src/world/objektkatalog";

const wurzel = resolve(__dirname, "..");

interface Eintrag {
  spec: PileSpec;
  liste: string;
}
const ALLE: Eintrag[] = alleEintraege();

/* ------------------------------------------------------------------------ */
/* Die Pruefung als Funktion — damit man sie auf etwas Falsches werfen kann   */
/* ------------------------------------------------------------------------ */

/** Hoechstmasse eines Eintrags: Feststoffdichte seines Leitstoffs mal Huellraum. */
export function hoechstmasse(spec: PileSpec): number {
  return feststoffdichte(leitstoff(spec).id) * huellVolumen(spec.kind, spec.dims);
}

/**
 * Alle Eintraege, deren Masse ihr Volumen nicht hergibt — als lesbare Zeilen.
 *
 * Ein Prozent Toleranz, weil die Huellmasse gerundete Zentimeter sind und
 * niemand wegen 300 Gramm einen Katalog umschreibt.
 */
export function unmoeglich(eintraege: Eintrag[]): string[] {
  const raus: string[] = [];
  for (const { spec, liste } of eintraege) {
    const grenze = hoechstmasse(spec);
    if (spec.massKg > grenze * 1.001)
      raus.push(
        `${spec.name ?? "(ohne Namen)"} (${liste}): ${spec.massKg} kg, moeglich waeren ${grenze.toFixed(0)} kg`
      );
  }
  return raus;
}

/* ------------------------------------------------------------------------ */

describe("Kein Katalogeintrag wiegt mehr, als sein Stoff in seinem Volumen kann", () => {
  it("der ganze Katalog haelt die Feststoffdichte ein", () => {
    expect(ALLE.length, "der Katalog ist leer — der Waechter prueft nichts").toBeGreaterThan(300);
    expect(unmoeglich(ALLE)).toEqual([]);
  });

  it("GEGENPROBE: derselbe Pruefcode meldet einen absichtlich falschen Eintrag", () => {
    /*
     * Patricks Beispiel, eins zu eins: ein kleines Aluminiumteil mit 1,8
     * Tonnen. 0,4 x 0,3 x 0,2 m Aluminium = 0,024 m³ x 2700 = 65 kg; 1800 kg
     * waeren das Achtundzwanzigfache.
     *
     * Wichtig ist die BAUFORM dieser Probe: Sie ruft `unmoeglich` auf — die
     * Funktion, die oben ueber den echten Katalog laeuft —, nicht eine
     * nachgebaute Rechnung. Waere die Pruefung abgeschrieben, koennten beide
     * auseinanderlaufen, und genau das ist die Fehlerklasse aus E-062.
     */
    const verdorben: Eintrag[] = [
      ...ALLE,
      {
        liste: "GEGENPROBE",
        spec: { materialId: "alu", massKg: 1800, kind: "box", dims: [0.4, 0.3, 0.2], name: "Alu-Klotz (erfunden)" },
      },
    ];
    const gemeldet = unmoeglich(verdorben);
    expect(gemeldet.length, "der Waechter hat den falschen Eintrag nicht gesehen").toBe(1);
    expect(gemeldet[0]).toContain("Alu-Klotz (erfunden)");
    expect(gemeldet[0]).toContain("1800 kg");
    expect(gemeldet[0]).toContain("65 kg");
  });

  it("GEGENPROBE 2: eine Messingarmatur von 900 kg faellt ebenfalls durch", () => {
    /*
     * Die zweite Gestalt desselben Fehlers, und die, die dem Auftrag den Namen
     * gegeben hat: „Eine Messingarmatur von 900 kg ist ein Fehler, keine
     * Armatur." Masse der echten Armatur im Katalog: 15 kg bei 0,0225 m³.
     * Messing hat 8700 kg/m³ — moeglich waeren 196 kg, 900 sind es nicht.
     */
    const echt = ALLE.find((e) => e.spec.name === "Messingarmaturen")!;
    expect(unmoeglich([echt])).toEqual([]);
    const verdorben: Eintrag = { ...echt, spec: { ...echt.spec, massKg: 900 } };
    expect(unmoeglich([verdorben]).length).toBe(1);
  });

  it("GEGENPROBE 3: die Grenze haengt am Werkstoff, nicht an einer festen Zahl", () => {
    /*
     * Waere `feststoffdichte` fest auf Stahl verdrahtet — der Fallwert der
     * Funktion —, wuerde der Alu-Klotz oben trotzdem auffallen (er ist absurd
     * genug), aber ein Alu-Teil knapp unter Stahldichte nicht. Diese Probe
     * misst deshalb den ABSTAND der beiden Grenzen: derselbe Koerper, zwei
     * Stoffe, und Alu muss knapp ein Drittel von Stahl ergeben.
     */
    const masse = { massKg: 1, kind: "box" as const, dims: [1, 1, 1] };
    const alu = hoechstmasse({ ...masse, materialId: "alu" });
    const stahl = hoechstmasse({ ...masse, materialId: "steel" });
    expect(alu).toBeCloseTo(2700, 0);
    expect(stahl).toBeCloseTo(7850, 0);
    // Und ein Stueck mit 3000 kg ist als Stahl moeglich und als Alu nicht.
    expect(unmoeglich([{ liste: "P", spec: { ...masse, massKg: 3000, materialId: "steel" } }])).toEqual([]);
    expect(unmoeglich([{ liste: "P", spec: { ...masse, massKg: 3000, materialId: "alu" } }]).length).toBe(1);
  });
});

/* ------------------------------------------------------------------------ */
/* Die neuen Eintraege im Einzelnen (E-063)                                   */
/* ------------------------------------------------------------------------ */

describe("Die Wandstaerke, die aus Masse und Mass folgt, ist eine, die es gibt", () => {
  /**
   * Gedankenexperiment (aus `purity.ts`, dort nur fuer Stahl): Man schmilzt das
   * Stueck ein und streicht das Metall gleichmaessig ueber seine eigene
   * Aussenflaeche. Wie dick wird die Haut?
   *
   *     t = Masse / (Dichte des Werkstoffs x Aussenflaeche)
   *
   * Der Unterschied zu `wandstaerkeMm`: Dort steht immer Stahl im Nenner, weil
   * die Stahlschrott-Regel nur Stahl sortiert. Hier steht der eigene Werkstoff,
   * sonst sieht ein Kupferkessel dreimal so dickwandig aus, wie er ist.
   *
   * Warum das der bessere Waechter ist als „hoechstens X Prozent Feststoff":
   * Die Prozentzahl haengt an der Bauform (ein Bund ist luftiger als ein
   * Klotz), die Wandstaerke nicht. 1,3 mm sind 1,3 mm, ob am Fallrohr oder an
   * der Regentonne — und man kann nachschlagen, ob es das gibt.
   */
  const wandMm = (spec: PileSpec): number =>
    (1000 * spec.massKg) /
    (feststoffdichte(leitstoff(spec).id) * aussenflaeche(spec.kind, spec.dims));

  /**
   * Das Band, in dem ein Schrottteil liegen kann.
   *
   * Unten 0,5 mm: Duenner wird kein Blech gewalzt, das auf einem Schrottplatz
   * ankommt (Dachblech 0,6–0,8, Karosserieblech 0,7, Weissblech 0,2 — aber
   * Konservendosen liefert niemand tonnenweise an).
   *
   * Oben 60 mm: Darueber ist es kein hohler Koerper mehr, sondern ein Klotz,
   * und dann ist der Huellquader die falsche Beschreibung. Beide Werte sind
   * Startwerte (SW), weit genug gesetzt, dass sie nur das Unglaubwuerdige
   * treffen — gemessen am Katalog vom 15.09.2026 liegen 347 von 350
   * Eintraegen dazwischen.
   */
  const DUENNSTE_MM = 0.5;
  const DICKSTE_MM = 60;

  /**
   * Die drei, die draussen liegen — mit Grund, nicht mit Achselzucken.
   *
   * Offene Rahmen haben viel Huellflaeche und wenig Material: Ein
   * Motorradrahmen ist ein Gitter aus Rohren, kein Kasten. Die Kranballast-
   * Platten sind das Gegenteil und wirklich ein Klotz.
   */
  const AUSNAHMEN = new Map([
    ["Motorradrahmen", "offenes Rohrgitter, kein Blechkasten"],
    ["Mopedrahmen", "offenes Rohrgitter, kein Blechkasten"],
    ["Kranballast-Platten", "massiver Stahlbetonklotz, kein hohler Koerper"],
  ]);

  /** Die Pruefung als Funktion — damit die Gegenprobe dieselbe benutzt. */
  const ausserhalb = (eintraege: Eintrag[]): string[] =>
    eintraege
      .filter((e) => !AUSNAHMEN.has(e.spec.name ?? ""))
      .filter((e) => wandMm(e.spec) < DUENNSTE_MM || wandMm(e.spec) > DICKSTE_MM)
      .map((e) => `${e.spec.name}: ${wandMm(e.spec).toFixed(2)} mm`);

  it("der ganze Katalog liegt zwischen 0,5 und 60 mm", () => {
    expect(ausserhalb(ALLE)).toEqual([]);
  });

  it("die drei Ausnahmen liegen wirklich draussen — sonst waere die Liste Zierrat", () => {
    /*
     * Ohne diese Zeile koennte jemand die Ausnahmeliste voll Namen schreiben,
     * die laengst im Band liegen, und der Waechter waere weicher, als er
     * aussieht.
     */
    for (const [name] of AUSNAHMEN) {
      const e = ALLE.find((x) => x.spec.name === name);
      expect(e, `Ausnahme ${name} steht nicht mehr im Katalog`).toBeTruthy();
      const t = wandMm(e!.spec);
      expect(t < DUENNSTE_MM || t > DICKSTE_MM, `${name} liegt bei ${t.toFixed(2)} mm im Band`).toBe(true);
    }
  });

  it("GEGENPROBE: ein Blech von 0,05 mm und ein Klotz von 300 mm fallen durch", () => {
    /*
     * Beide Richtungen, mit demselben Code wie oben. 0,05 mm waere Alufolie;
     * 300 mm waere ein Gegenstand, der dreissig Zentimeter Vollmaterial in
     * jede Richtung hat und trotzdem als Blechtafel im Katalog stuende.
     */
    const duenn: Eintrag = {
      liste: "GEGENPROBE",
      spec: { materialId: "steel", massKg: 4, kind: "box", dims: [1.0, 0.06, 1.7], name: "Folienblech (erfunden)" },
    };
    const dick: Eintrag = {
      liste: "GEGENPROBE",
      spec: { materialId: "steel", massKg: 3000, kind: "box", dims: [0.7, 0.3, 0.7], name: "Superklotz (erfunden)" },
    };
    expect(ausserhalb([duenn]).length).toBe(1);
    expect(ausserhalb([dick]).length).toBe(1);
    expect(ausserhalb([duenn])[0]).toContain("Folienblech");
    // Und ein echtes Blech dazwischen kommt durch — sonst meldet die Regel immer.
    const echt = ALLE.find((e) => e.spec.name === "Grobblech-Zuschnitt (20 mm)")!;
    expect(ausserhalb([echt])).toEqual([]);
  });

  it("die aufgefuellten Fraktionen stehen vollstaendig im Katalog", () => {
    /*
     * Der Wächter oben lauft ueber alles; diese Zeile stellt sicher, dass „alles"
     * auch die dreiunddreissig neuen Stuecke enthaelt. Faellt einer heraus,
     * merkt man es hier und nicht daran, dass eine Mulde wieder eintoenig wird.
     */
    const NEU = [
      "Wickeldraht (Kupferspule)", "Stromschienen-Bund (Kupfer)", "Kupferkessel (Waschkessel)",
      "Kupfer-Fallrohr (Bund)", "Kupfer-Lamellenblock", "Erdungsband (Kupfer, Rolle)",
      "Absperrschieber (Messing)", "Messing-Ventilblock", "Wasserzähler (Messing, Palette)",
      "Messing-Lagerschalen (Stapel)", "Messing-Türbeschläge (Haufen)", "Messing-Rohrbogen (Bund)",
      "Erdkabel-Ring (NYY)", "Steuerleitung (Ring)", "Kabellitze (Bund)",
      "Starkstromkabel (Bund)", "Datenkabel-Verhau (Ballen)",
      "VA-Rohrbogen (DN200)", "Gastro-Kochkessel (VA)", "VA-Geländerstäbe (Bund)",
      "Milchkanne (VA)", "VA-Lochblech (Tafel)", "VA-Plattenwärmetauscher",
      "Zinkblech-Rolle", "Verzinkte Leitungsrinnen (Bund)", "Zink-Opferanoden (Stapel)",
      "Zink-Regentonne",
      "Motorrad-Batterie", "USV-Batterieblock", "Traktionszellen (Bund)", "Solarspeicher-Batterie",
      "Sessel (Polster)", "Couch (Zweisitzer)",
    ];
    expect(NEU.length).toBe(33);
    expect(NEU.filter((n) => !ALLE.some((e) => e.spec.name === n))).toEqual([]);
  });
});

/* ------------------------------------------------------------------------ */
/* Acht Sorten je Fraktion — in der Groessenklasse, aus der gezogen wird      */
/* ------------------------------------------------------------------------ */

describe("Eine sortenreine Fuhre wiederholt sich nicht sofort (E-063)", () => {
  /*
   * Patrick, 15.09.2026: „Auffuellen, mindestens acht je Fraktion."
   *
   * Warum je GROESSENKLASSE gezaehlt wird und nicht ueber den ganzen Katalog:
   * `randomCargo` waehlt erst eine Klasse (SPECS, BIG_SPECS oder HUGE_SPECS)
   * und zieht DANN die Fraktion daraus. Eine sortenreine Kleinteil-Fuhre sieht
   * also nur die Kleinteile ihrer Fraktion. Gemessen am Gesamtkatalog waere
   * Kupfer am 15.09. bei vier Sorten gewesen und haette „reicht" gemeldet —
   * auf der Pritsche lagen zwei.
   */
  const klasse = (l: string) =>
    l === "SPECS" || l === "KATALOG_SPECS" ? "klein" : l === "BIG_SPECS" || l === "KATALOG_BIG" ? "gross" : "riesig";

  /*
   * `alleEintraege` liest den Quelltext und liefert die materialId, wie sie
   * DA STEHT — nicht, was die Regel daraus macht (Kabeltrommel steht als
   * `cable` und ist Mischschrott). Gezaehlt wird die abgeleitete Fraktion,
   * denn die entscheidet, was `randomCargo` in eine sortenreine Fuhre legt.
   */
  const sorten = (frak: string, kl: string) =>
    ALLE.filter((e) => fraktionVonTeil(e.spec) === frak && klasse(e.liste) === kl).length;

  for (const frak of ["copper", "brass", "cable", "va", "zinc", "battery"]) {
    it(`${frak}: mindestens acht Kleinteile`, () => {
      expect(sorten(frak, "klein")).toBeGreaterThanOrEqual(8);
    });
  }

  it("GEGENPROBE: die Zaehlung sieht wirklich nur eine Klasse", () => {
    /*
     * Waere `klasse` kaputt und lieferte fuer alles dasselbe, stuenden oben
     * die Gesamtzahlen und die Pruefung waere zu lasch. Der Beweis: Stahl hat
     * in allen drei Klassen Eintraege, und die drei Zahlen sind verschieden
     * — und ihre Summe ist die Gesamtzahl.
     */
    const k = sorten("steel", "klein");
    const g = sorten("steel", "gross");
    const r = sorten("steel", "riesig");
    expect(k).toBeGreaterThan(0);
    expect(g).toBeGreaterThan(0);
    expect(r).toBeGreaterThan(0);
    expect(new Set([k, g, r]).size, "alle drei Klassen gleich gross — verdaechtig").toBe(3);
    expect(k + g + r).toBe(ALLE.filter((e) => fraktionVonTeil(e.spec) === "steel").length);
  });

  it("BEFUND BEHOBEN: auch Reifen, Holz und Baumischabfall haben acht", () => {
    /*
     * Diese Zeile stand bis zum 16.09.2026 als BEFUND da und hielt den Mangel
     * als Zahl fest: Reifen 4, Holz 6, Baumischabfall **0** Kleinteile. Der
     * Satz dazu lautete „Ob sie aufgefuellt werden … ist Patricks
     * Entscheidung, nicht Aufraeumarbeit".
     *
     * Patrick hat entschieden: „‚Stoerstoff' aufloesen in Holz,
     * Baumischabfall, Reifen und Kunststoffe." Damit ist der Test bewusst rot
     * geworden, und das war die Meldung „der Mangel ist weg" — dieselbe
     * Bauart wie bei V-6 in `fraktionen.test.ts`.
     *
     * Die Sorge von E-067 (mehr Abfall im Katalog = weniger Verdienst) ist
     * NICHT eingetreten und auch nicht ignoriert: Der Fraktionsmix zieht aus
     * einem Lostopf mit festen Anteilen, nicht aus der Katalogzahl. Gemessen
     * in `test/abfall.test.ts` — der Abfallanteil einer Anlieferung liegt
     * unveraendert bei 6,7 %.
     */
    /*
     * E-181 (20.10.2026): Reifen sind seither Raeder. Patrick: „Reifenstapel
     * gibt es nicht mehr, nur einzel reifen" und „Reifen haben immer felge".
     * Ein Rad ist Gummi + Felge, also Verbund und nach der einen Regel
     * Mischschrott — `tires` hat darum keinen Katalogeintrag mehr, und die acht
     * stehen jetzt bei den Raedern (naechster Test). Reifen als Fraktion gibt
     * es weiter: aus dem Rad getrennt oder vom Wrack.
     */
    for (const frak of ["wood", "rubble", "plastic"])
      expect(sorten(frak, "klein"), `${frak} ist weiter duenn`).toBeGreaterThanOrEqual(8);
    expect(sorten("tires", "klein"), "ein Reifen ohne Felge ist zurueck").toBe(0);
  });

  it("E-181: acht Raeder in der Kleinteil-Klasse, jedes mit Felge", () => {
    /*
     * Die acht Sorten, die Reifen bis zum 20.10.2026 hatten, als Raeder:
     * Pkw, Transporter, Anhaenger, LKW, Motorrad, Stapler, Traktor, dazu das
     * Rad mit Alufelge. Jedes traegt Reifen UND Felge (Stahl oder Alu) in der
     * Stueckliste — daran erkennt `scrapItems.radFelge` das Rad und zeichnet
     * die Felge.
     */
    const raeder = ALLE.filter(
      (e) =>
        klasse(e.liste) === "klein" &&
        (e.spec.zusammensetzung ?? []).some((a) => a.materialId === "tires" && a.anteil >= 0.4)
    );
    expect(raeder.length).toBeGreaterThanOrEqual(8);
    for (const e of raeder) {
      const zus = e.spec.zusammensetzung ?? [];
      expect(zus.some((a) => a.materialId === "steel" || a.materialId === "alu"), `${e.spec.name} ohne Felge`).toBe(true);
      expect(fraktionVonTeil(e.spec), `${e.spec.name}`).toBe("mixed");
      expect(["torus", "cyl"], `${e.spec.name} rollt nicht als Achtkant`).toContain(e.spec.kind);
    }
  });
});

/* ------------------------------------------------------------------------ */
/* Das Presspaket: Alu darf nicht schwerer sein als Stahl (aus E-061)         */
/* ------------------------------------------------------------------------ */

describe("Ein Alupaket ist leichter als ein Stahlpaket gleicher Groesse", () => {
  const quelle = readFileSync(resolve(wurzel, "src/world/scrapItems.ts"), "utf8");
  const dichteVon = (frak: string): number => {
    const m = new RegExp(`^\\s*${frak}: \\{ dichte: (\\d+)`, "m").exec(quelle);
    if (!m) throw new Error(`Pressprofil ${frak} nicht gefunden`);
    return Number(m[1]);
  };

  it("das Verhaeltnis der Paketdichten folgt dem der Feststoffe (E-061)", () => {
    const stahl = dichteVon("steel");
    const alu = dichteVon("alu");
    expect(alu, "ein Alupaket war schwerer als ein Stahlpaket").toBeLessThan(stahl);
    const erwartet = stahl * (feststoffdichte("alu") / feststoffdichte("steel"));
    expect(alu).toBeGreaterThan(erwartet * 0.8);
    expect(alu).toBeLessThan(erwartet * 1.25);
  });
});
