/**
 * Waechter: Ein Teil muss das sein, wonach es aussieht (E-061, 15.09.2026).
 *
 * Anlass, woertlich (Patrick):
 *
 * > „Was auch irgendwie nicht mehr aufgeht, sind die Beschreibungen und die
 * > Teile im Materialtypen und wie die aussehen. Ich habe jetzt eben eine
 * > Couch gehabt, da hat mir einer gesagt, das waere VA. Das passt ja
 * > natuerlich nicht zusammen. Da soll schon das Objekt beschreiben, was man
 * > da sieht."
 *
 * ## Woher die Couch kam
 *
 * Nicht aus `randomCargo` — der wuerfelt zwar die Fraktion vor dem Stueck,
 * gibt aber immer die Fraktion des gezogenen Stuecks zurueck und kann darum
 * nicht luegen (der Waechter „Was eine Fuhre ansagt" unten haelt das fest).
 *
 * Die Couch kam aus dem Katalog. `objektbau.ts` waehlt beim Bau `moebel`
 * seinen Zweig nach den MASSEN: flach und tief genug heisst Polster, sonst
 * Korpus. Der `Gastro-Spültisch` (1,20 × 0,85 × 0,70 m, Fraktion VA) erfuellte
 * die Bedingung und stand als Polstersofa auf dem Platz. Weil die VA-Auswahl
 * duenn ist — zehn erreichbare Eintraege —, war er in einer sortenreinen
 * VA-Fuhre zugleich das HAEUFIGSTE Stueck: gemessen 12,7 % von 3000 Zuegen.
 * Eine Couch, zu der die Waage „sortenrein Edelstahl" sagte.
 *
 * ## Was hier bewacht wird
 *
 * Nicht der Einzelfall, sondern die Regel dahinter: **Kein Stueck traegt eine
 * Fraktion, die seiner Bauart widerspricht.** Ein Polstermoebel ist kein
 * Metall, weisse Ware ist kein Premium-Stahlschrott, eine Karosserie ist nie
 * sortenrein, ein Betonteil ist kein Buntmetall.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { alleEintraege } from "../tools/stahlschrott";
import { baueGeometrie, metallton } from "../src/world/objektbau";
import { MATERIALS } from "../src/materials/catalog";
import { fraktionVonTeil } from "../src/materials/purity";
import { randomCargo } from "../src/world/scrapItems";
import { griffLadung, griffZiel } from "../src/ui/hud";
import type { PileSpec } from "../src/world/objektkatalog";

const wurzel = resolve(__dirname, "..");
const objektbau = readFileSync(resolve(wurzel, "src/world/objektbau.ts"), "utf8");

/** Jeder Eintrag des Spiels mit der Fraktion, die die Regel ihm gibt. */
interface Eintrag {
  spec: PileSpec;
  liste: string;
  frak: string;
  name: string;
}
const ALLE: Eintrag[] = alleEintraege().map(({ spec, liste }) => ({
  spec,
  liste,
  frak: fraktionVonTeil(spec),
  name: spec.name ?? "(ohne Namen)",
}));

/* ------------------------------------------------------------------------ */
/* Der Polsterzweig haengt nicht mehr an den Abmessungen (E-063)              */
/* ------------------------------------------------------------------------ */

/**
 * Wird dieses Stueck als Polstermoebel gebaut — in Stoff bezogen, mit Lehne?
 *
 * Bis E-063 war das eine RECHNUNG aus den Kantenlaengen: `moebel` waehlte
 * seinen Zweig mit `h < w*0,75 && d > h*0,7`, und wer zufaellig flach und tief
 * genug war, wurde zur Couch. Vier Gegenstaende traf es — Stahlschrank,
 * Holzkiste, Kuechenzeile, Fahrzeug-Sitzbank.
 *
 * Jetzt steht es am Eintrag. Das ist der ganze Punkt: Eine Eigenschaft, die
 * man am Katalog ABLESEN kann, laesst sich pruefen; eine, die aus drei Zahlen
 * herausfaellt, nicht.
 */
function istPolster(spec: PileSpec): boolean {
  return spec.bau === "polster";
}

describe("Der Polsterzweig haengt am Eintrag, nicht an den Massen (E-063)", () => {
  it("die alte Massenbedingung steht nicht mehr in objektbau.ts", () => {
    /*
     * Der eigentliche Waechter dieser Entscheidung. Solange diese Zeile im
     * Quelltext steht, kann jeder neue Eintrag in den falschen Massen wieder
     * zur Couch werden — egal, was im Katalog steht.
     */
    expect(objektbau).not.toMatch(/const weich = h < w \*/);
    expect(objektbau, "der Bau `polster` fehlt").toContain('case "polster":');
  });

  it("erkennt das Sofa als Polster und die Schrankwand als Korpus", () => {
    // Ohne diese beiden Proben koennte `istPolster` immer `false` liefern und
    // der Waechter waere gruen, ohne etwas zu pruefen.
    const sofa = ALLE.find((e) => e.name === "Couch (Dreisitzer)")!;
    const schrank = ALLE.find((e) => e.name === "Schrankwand-Segment")!;
    expect(istPolster(sofa.spec)).toBe(true);
    expect(istPolster(schrank.spec)).toBe(false);
  });

  it("die vier falschen Polster von E-061 sind keine mehr", () => {
    /*
     * Namentlich, weil es Patricks Befund ist: Ein Stahlschrank, eine
     * Holzkiste, eine Kuechenzeile und eine Fahrzeug-Sitzbank standen als
     * Polstersofa auf dem Platz. Die Sitzbank IST eins — sie behaelt den Bau,
     * jetzt aber, weil es am Eintrag steht, und nicht, weil ihre Masse
     * zufaellig passen.
     */
    const bauVon = (n: string) => ALLE.find((e) => e.name === n)!.spec.bau;
    expect(bauVon("Stahlschrank")).toBe("moebel");
    expect(bauVon("Küchenzeile (Segment)")).toBe("moebel");
    expect(bauVon("Holzkiste")).toBe("kiste");
    expect(bauVon("Fahrzeug-Sitzbank")).toBe("polster");
  });

  it("Polster und Korpus sehen verschieden aus", () => {
    /*
     * Gegenprobe zur Zeile darueber: Waeren `polster` und `moebel` derselbe
     * Bau unter zwei Namen, waere die Umstellung eine Umbenennung und kein
     * Umbau. Verglichen wird die Eckenzahl bei GLEICHEN Massen.
     */
    const masse = [2.1, 0.9, 0.95];
    const p = baueGeometrie("polster", masse, "box");
    const m = baueGeometrie("moebel", masse, "box");
    const ecken = (g: { koerper: { getAttribute: (n: string) => { count: number } } }) =>
      g.koerper.getAttribute("position").count;
    expect(ecken(p)).not.toBe(ecken(m));
  });
});

/* ------------------------------------------------------------------------ */
/* Die Regel: keine Fraktion, die der Bauart widerspricht                     */
/* ------------------------------------------------------------------------ */

/** Fraktionen, die kosten statt zu bringen — die Antwort auf Sperrmuell. */
const istAbfall = (f: string): boolean => (MATERIALS[f]?.sellPricePerKg ?? 1) < 0;

/**
 * Verbotene Paare aus Bauart und Fraktion.
 *
 * Eine Liste ist der einfachste Weg und ehrlicher als gar nichts: Sie faengt
 * nicht jeden denkbaren Widerspruch, aber jeden, den wir benennen koennen —
 * und sie waechst mit jedem, der auffaellt.
 */
const VERBOTEN: Array<{
  was: string;
  trifft: (e: Eintrag) => boolean;
  erlaubt: (frak: string) => boolean;
  warum: string;
}> = [
  {
    was: "Polstermoebel",
    trifft: (e) => istPolster(e.spec),
    /*
     * Schaerfer als „kein Metall" (E-063). Patrick, 15.09.2026: „Wenn etwas
     * wie eine Couch aussieht, dass es auch eine Couch ist. Und dann ist es
     * Muell." Mischschrott BRINGT Geld (0,16 €/kg) — er ist damit keine
     * gueltige Antwort auf ein Polstermoebel. Es muss eine Fraktion sein, die
     * kostet.
     */
    erlaubt: (f) => istAbfall(f),
    warum: "Ein Polstermoebel ist Muell, nicht Metall und auch nicht Mischschrott",
  },
  {
    was: "Bleiakku",
    trifft: (e) => e.spec.bau === "batterie",
    erlaubt: (f) => f === "battery",
    warum: "Was wie ein Akku gebaut wird, gehoert in die Batteriemulde (Sondermuell)",
  },
  {
    was: "Armatur",
    trifft: (e) => e.spec.bau === "armatur",
    erlaubt: (f) => f === "brass" || f === "copper" || f === "steel" || f === "va",
    warum: "Ein Ventilkoerper ist aus Rotguss, Messing oder Stahl — nie aus Holz",
  },
  {
    was: "weisse Ware",
    trifft: (e) => e.spec.bau === "weisseWare",
    erlaubt: (f) => f !== "steel",
    warum: "Haushaltsgeraete sind Blech, nie Premium-Stahlschrott (E-042)",
  },
  {
    was: "Karosserie, Kabine und Fahrzeug",
    trifft: (e) =>
      ["karosserie", "kabine", "kleinfahrzeug", "einspurig", "wasserfahrzeug", "kufenRaupe"].includes(
        e.spec.bau ?? ""
      ),
    erlaubt: (f) => f === "mixed" || f === "wood",
    warum: "Ein zusammengebautes Fahrzeug ist nie sortenrein, solange es niemand zerlegt",
  },
  {
    was: "Betonteil",
    trifft: (e) => e.spec.bau === "beton",
    erlaubt: (f) => f === "rubble" || f === "mixed",
    warum: "Ein Betonkoerper mit Bewehrungsstummeln ist kein Buntmetall",
  },
];

describe("Kein Stueck traegt eine Fraktion, die seiner Bauart widerspricht", () => {
  for (const regel of VERBOTEN) {
    it(`${regel.was}: ${regel.warum}`, () => {
      const betroffen = ALLE.filter(regel.trifft);
      expect(betroffen.length, `keine Eintraege der Bauart ${regel.was}`).toBeGreaterThan(0);
      const verstoesse = betroffen
        .filter((e) => !regel.erlaubt(e.frak))
        .map((e) => `${e.name} → ${e.frak} (${e.liste})`);
      expect(verstoesse).toEqual([]);
    });
  }

  it("der Gastro-Spueltisch steht nicht mehr als Couch da (E-061)", () => {
    /*
     * Der Einzelfall bekommt seinen eigenen Waechter, weil er Patricks Befund
     * ist. Faellt er, ist genau die Couch zurueck, ueber die er gestolpert
     * ist — und man muss nicht erst raten, welche Regel gemeint war.
     */
    const e = ALLE.find((x) => x.name === "Gastro-Spültisch")!;
    expect(e.frak).toBe("va");
    expect(istPolster(e.spec)).toBe(false);
    expect(e.spec.bau).toBe("weisseWare");
  });
});

describe("Wer als Polster gebaut wird, ist eins (E-063)", () => {
  it("die Liste enthaelt nur Polstermoebel und ist nicht leer", () => {
    /*
     * Frueher stand hier ein BEFUND mit vier falschen Namen. Jetzt ist es eine
     * Soll-Eigenschaft: Jeder Traeger des Baus heisst nach einem Polstermoebel.
     *
     * Wird die Liste laenger, ist das in Ordnung — solange jeder neue Name die
     * Probe besteht. Wird sie LEER, prueft dieser Test nichts mehr, und genau
     * dagegen steht die zweite Zeile.
     */
    const polster = ALLE.filter((e) => istPolster(e.spec)).map((e) => e.name).sort();
    expect(polster.length).toBeGreaterThanOrEqual(3);
    const keinPolstername = polster.filter((n) => !/Couch|Sofa|Sessel|Sitzbank|Polster/i.test(n));
    expect(keinPolstername).toEqual([]);
  });

  it("und umgekehrt: was nach Polstermoebel heisst, wird auch als eins gebaut", () => {
    /*
     * Die Gegenrichtung ist Patricks eigentlicher Satz: „Wenn etwas wie eine
     * Couch aussieht, dass es auch eine Couch ist." Ohne diese Zeile koennte
     * jemand ein „Sofa (Leder)" mit `bau: "tank"` eintragen, und alles waere
     * gruen.
     *
     * Ausnahme mit Namen: Der Matratzenstapel. Ein Stapel Matratzen ist
     * geschichtet, nicht bezogen — `stapel` trifft ihn besser als `polster`.
     */
    const AUSNAHMEN = new Set(["Matratzenstapel"]);
    const falsch = ALLE.filter(
      (e) => /\b(Couch|Sofa|Sessel|Sitzbank)\b/i.test(e.name) && !istPolster(e.spec) && !AUSNAHMEN.has(e.name)
    ).map((e) => `${e.name} wird als ${e.spec.bau ?? "(nackter Quader)"} gebaut`);
    expect(falsch).toEqual([]);
  });

  it("und jedes davon ist Muell, keine Fraktion, die Geld bringt", () => {
    for (const e of ALLE.filter((x) => istPolster(x.spec)))
      expect(MATERIALS[e.frak]!.sellPricePerKg, `${e.name} bringt Geld`).toBeLessThan(0);
  });
});

/* ------------------------------------------------------------------------ */
/* Bau und Name decken sich — nicht nur bei Polstermoebeln                    */
/* ------------------------------------------------------------------------ */

describe("Wer einen Bau traegt, heisst auch danach (E-063)", () => {
  /**
   * Fuer jeden Bau, dessen Name diagnostisch ist: Welche Woerter muss ein
   * Eintrag im Namen fuehren, um ihn tragen zu duerfen?
   *
   * Absichtlich nicht vollstaendig. `maschine`, `stapel` oder `buendel`
   * beschreiben eine Bauform, keinen Gegenstand — da sagt der Name nichts
   * vorher. Diese sieben tun es: Ein Motorblock, ein Boot und eine
   * Autobatterie sehen nicht gleich aus, und ihre Namen sagen es auch.
   */
  const NAMENSBAU: Array<[string, RegExp]> = [
    ["motor", /Motor|Triebwerk|Aggregat/i],
    ["batterie", /Batterie|Akku|Traktionszellen|Solarspeicher/i],
    ["boot", /Boot|Rumpf|Ponton/i],
    ["armatur", /Armatur|Ventil|Schieber|Hahn/i],
    ["propeller", /Schraube|Propeller/i],
    ["kiste", /Kiste|Kasten/i],
    ["anker", /Anker/i],
    ["beton", /Beton|Schacht|Hohlkammer|Ballast/i],
    // E-123: die Bauten der neuen Grossteile
    ["minibagger", /bagger/i],
    ["raupe", /bagger|Raupe/i],
    ["geruest", /Gerüst/i],
    ["geruestfeld", /Gerüst/i],
    ["mulde", /Mulde|Kippbehälter/i],
    ["deckelmulde", /Mulde/i],
  ];

  for (const [bau, re] of NAMENSBAU) {
    it(`${bau}: jeder Traeger heisst danach`, () => {
      const traeger = ALLE.filter((e) => e.spec.bau === bau);
      expect(traeger.length, `kein Eintrag traegt den Bau ${bau}`).toBeGreaterThan(0);
      const falsch = traeger.filter((e) => !re.test(e.name)).map((e) => e.name);
      expect(falsch).toEqual([]);
    });
  }

  it("der Waechter greift wirklich — ein Stahlschrank als Motorblock faellt durch", () => {
    /*
     * Die Gegenprobe. Ohne sie koennte jedes Muster oben auf alles passen und
     * die Liste bliebe leer, weil nichts geprueft wird. Geprueft wird mit
     * demselben Code, mit dem der echte Katalog geprueft wird.
     */
    const erfunden = { name: "Stahlschrank", bau: "motor" };
    const regel = NAMENSBAU.find(([b]) => b === erfunden.bau)!;
    expect(regel[1].test(erfunden.name)).toBe(false);
    // Und ein echter Motorblock kommt durch — sonst meldet die Regel immer.
    expect(regel[1].test("Motorblock (V8, ausgebaut)")).toBe(true);
  });
});

/* ------------------------------------------------------------------------ */
/* Buntmetall zeigt seine Farbe (E-063)                                       */
/* ------------------------------------------------------------------------ */

describe("Ein Kupferkessel ist kupfern, ein Stahltank bleibt grau", () => {
  it("der Grundton der Bauten kommt bei Buntmetall aus der Fraktion", () => {
    for (const id of ["copper", "brass", "va", "zinc", "alu", "cable"])
      expect(metallton(id), `${id} zeigt seine Fraktionsfarbe nicht`).toBe(MATERIALS[id]!.color);
  });

  it("Stahl, Mischschrott und Batterien bleiben, wie sie waren", () => {
    /*
     * Die Gegenprobe zur Zeile darueber — und der Grund, warum diese Aenderung
     * an rund zweihundert Eintraegen kein Pixel bewegt. Der Stahlton der
     * Fraktion (0x6e5a4e) liegt ΔE2000 = 8,8 neben dem Bauton (0x6f6a63);
     * haette man ihn mitgenommen, waere jeder Stahltank auf dem Platz brauner
     * geworden, ohne dass es jemand bestellt hat (`tools/metallton.ts`).
     */
    const stahlton = metallton("steel");
    expect(stahlton).not.toBe(MATERIALS.steel!.color);
    for (const id of ["steel", "mixed", "battery"])
      expect(metallton(id), `${id} sollte den Stahlton behalten`).toBe(stahlton);
  });

  it("die vier Abfallsorten zeigen dagegen ihre Farbe (16.09.2026)", () => {
    /*
     * Bis zum 16.09.2026 standen Holz, Kunststoff, Reifen und Baumischabfall
     * mit in der Zeile darueber. Sie sind ausgezogen: Ihre Fraktionsfarben
     * liegen ΔE2000 = 14,2 bis 21,5 vom Bauton weg — das ist der Unterschied
     * zwischen „unauffaellig" und „nicht erkennbar", und Patricks Befund war
     * genau der zweite Fall („Stoerstoff sagt niemandem etwas"). Die Messung
     * steht in `test/abfall.test.ts`.
     */
    for (const id of ["wood", "rubble", "tires", "plastic"])
      expect(metallton(id), `${id} steht noch in Stahlgrau da`).toBe(MATERIALS[id]!.color);
  });
});

/* ------------------------------------------------------------------------ */
/* Der Name nennt einen Stoff — dann muss die Fraktion dazu passen            */
/* ------------------------------------------------------------------------ */

describe("Was der Name verspricht, haelt die Fraktion", () => {
  const NAMENSSTOFF: Array<[RegExp, string[], string]> = [
    [/\bHolz(?!bruch)|Lattenrost|Bohlen|Dachstuhl/i, ["wood", "mixed"], "Holz"],
    [/\bAlu(?!minium-?frei)/i, ["alu", "mixed"], "Aluminium"],
    [/\bVA-|Edelstahl|V2A/i, ["va"], "Edelstahl"],
    [/Kupfer/i, ["copper", "mixed"], "Kupfer"],
    [/Messing/i, ["brass"], "Messing"],
    // E-150: „verzinkt ist kein buntmetall" — „Verzinkte …" verspricht keinen Zink
    // mehr. `\b`, damit „Verzinkt" nicht ueber das „zink" darin anschlaegt.
    [/\bZink/i, ["zinc", "mixed"], "Zink"],
    [/Reifen(?!haufen)|Reifenhaufen/i, ["tires"], "Reifen"],
    [/Kunststoff|GFK/i, ["plastic", "mixed"], "Kunststoff"],
    [/Batterie|Starterbatterie/i, ["battery"], "Batterie"],
    [/Kabel(?!trommel)/i, ["cable", "mixed"], "Kabel"],
  ];

  it("kein Stueck nennt im Namen einen Stoff, den es nicht ist", () => {
    const verstoesse: string[] = [];
    for (const e of ALLE)
      for (const [re, ok, stoff] of NAMENSSTOFF)
        if (re.test(e.name) && !ok.includes(e.frak))
          verstoesse.push(`${e.name} verspricht ${stoff}, ist aber ${e.frak}`);
    expect(verstoesse).toEqual([]);
  });

  it("der Waechter greift wirklich — eine erfundene Couch aus VA faellt durch", () => {
    // Die Probe aufs Exempel: Ohne sie koennte jeder Ausdruck oben ins Leere
    // laufen und die Liste waere leer, weil nichts geprueft wird.
    const erfunden = { name: "VA-Sofa", frak: "mixed" };
    const treffer = NAMENSSTOFF.filter(([re, ok]) => re.test(erfunden.name) && !ok.includes(erfunden.frak));
    expect(treffer.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------------ */
/* Die Ladung: was angesagt wird, liegt auch drauf                            */
/* ------------------------------------------------------------------------ */

/**
 * Ein berechenbarer Zufall.
 *
 * `randomCargo` greift direkt auf `Math.random`. Ein Waechter, der mit echtem
 * Zufall misst, ist mal gruen und mal rot — und ein Test, dem man nicht
 * glaubt, ist keiner. Der Generator hier ist ein gewoehnlicher linearer
 * Kongruenzgenerator; auf seine Zahlenqualitaet kommt es nicht an, nur darauf,
 * dass jeder Lauf dieselbe Folge sieht.
 */
function festerZufall(saat: number): () => number {
  let s = saat >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

afterEach(() => vi.restoreAllMocks());

describe("Was eine Fuhre ansagt, liegt auch drauf", () => {
  it("jedes Stueck traegt die Fraktion, die die Regel ihm gibt", () => {
    vi.spyOn(Math, "random").mockImplementation(festerZufall(20260915));
    const ladung = randomCargo(2000, 0.4, 0.1);
    for (const c of ladung) {
      const gerechnet = fraktionVonTeil({
        materialId: c.materialId,
        massKg: c.massKg,
        kind: c.shape.kind,
        dims: c.shape.dims,
        zusammensetzung: c.shape.zusammensetzung,
        massiv: c.shape.massiv,
      });
      expect(gerechnet, `${c.shape.name ?? "(ohne Namen)"} luegt ueber seine Fraktion`).toBe(
        c.materialId
      );
    }
  });

  it("eine sortenreine VA-Fuhre bringt nur VA — und keine Polstermoebel", () => {
    /*
     * Genau der Fall aus Patricks Befund: Der Haendler sagt „sortenrein
     * Edelstahl", und die Waage sagt es ihm nach. Was dann auf der Pritsche
     * liegt, darf ihm nicht widersprechen — weder im Stoff noch im Anblick.
     */
    vi.spyOn(Math, "random").mockImplementation(festerZufall(4711));
    const ladung = randomCargo(1500, 0.5, 0, "va");
    expect(new Set(ladung.map((c) => c.materialId))).toEqual(new Set(["va"]));
    const polster = ladung.filter((c) =>
      ALLE.some((e) => e.name === c.shape.name && istPolster(e.spec))
    );
    expect(polster.map((c) => c.shape.name)).toEqual([]);
  });

  it("BEFUND BEHOBEN: die Fraktionstabelle liefert jetzt auch Baumischabfall aus", () => {
    /*
     * Diese Zeile hielt bis zum 16.09.2026 einen Mangel als Zahl fest und
     * lautete `expect(anteil("rubble")).toBe(0)`.
     *
     * Der Grund war nicht die Tabelle, sondern der leere Katalog: In der
     * Kleinteil-Klasse — der einzigen, aus der eine gewoehnliche Anlieferung
     * zieht — stand KEIN EINZIGER Eintrag der Fraktion `rubble`. Dann greift
     * der Notausgang in `randomCargo` (`pool[Math.random() …]`) und zieht
     * irgendetwas; er luegt dabei nicht, aber die Mischung stimmt nicht mit
     * dem ueberein, was daneben als Absicht steht.
     *
     * Acht Gegenstaende spaeter stimmt sie. Der Verdienst hat sich dabei NICHT
     * verschoben — das war die Sorge, unter der der Befund stehen blieb: Die
     * Tabelle zieht aus einem Lostopf mit festen Anteilen (`REST_LOSE`), und
     * der Abfallanteil einer Anlieferung liegt unveraendert bei 6,7 %
     * (gemessen in `test/abfall.test.ts`).
     */
    vi.spyOn(Math, "random").mockImplementation(festerZufall(1));
    const ladung = randomCargo(4000, 0, 0);
    const anteil = (id: string) => ladung.filter((c) => c.materialId === id).length / ladung.length;
    // Ein Sechsunddreissigstel des letzten Fuenftels x 3 Lose = 1,67 %.
    expect(anteil("rubble")).toBeGreaterThan(0.008);
    expect(anteil("rubble")).toBeLessThan(0.026);
    // Und dasselbe fuer die Fraktion, die es bis heute gar nicht gab.
    expect(anteil("tires"), "Reifen werden weiter nicht angeliefert").toBeGreaterThan(0.008);
    // Der Stahlanteil dagegen sitzt wie eh: Stahl gibt es in jeder Klasse.
    expect(anteil("steel")).toBeGreaterThan(0.38);
    expect(anteil("steel")).toBeLessThan(0.47);
  });
});

/* ------------------------------------------------------------------------ */
/* Die Griff-Info sagt die Sortierklasse nicht mehr an                        */
/* ------------------------------------------------------------------------ */

/* ------------------------------------------------------------------------ */
/* Die Griff-Info: Fraktion ja, Prozente nein, Zielhinweis nein               */
/* ------------------------------------------------------------------------ */

describe("Was die Griff-Info sagt und was nicht (E-061)", () => {
  const kopfVon = (e: Eintrag): string =>
    griffZiel({
      materialId: e.frak,
      massKg: e.spec.massKg,
      shape: { name: e.spec.name, zusammensetzung: e.spec.zusammensetzung },
    }).kopf;

  it("nennt die Fraktion, wo man sich irren kann", () => {
    /*
     * Patrick, 15.09.2026: „Ich muss natuerlich sehen, was ich greife. Wenn es
     * Mischschrott ist, muss ich das sehen. Wenn es VA ist, muss ich das
     * sehen." Genau diese drei Faelle stehen hier — Verwechslungsgefahr in
     * Person: Alu gegen VA, Blech gegen Traeger, ein Name ohne jeden Hinweis.
     */
    expect(kopfVon(ALLE.find((e) => e.name === "Fluggasttreppe")!)).toContain(
      "Fluggasttreppe (Aluminium)"
    );
    expect(kopfVon(ALLE.find((e) => e.name === "Kühlschrank")!)).toContain(
      "Kühlschrank (Mischschrott)"
    );
    expect(kopfVon(ALLE.find((e) => e.name === "Doppel-T-Träger")!)).toContain(
      "Doppel-T-Träger (Stahlschrott)"
    );
  });

  it("schweigt, wo der Gegenstand schon alles sagt", () => {
    /*
     * „Ausser es ist bei dem Objekt schon klar, was es ist — eine Couch ist
     * Muell, da brauche ich keine Materialbeschreibung zu."
     *
     * Zwei Gruende, nie ein dritter: Abfall braucht keine Klasse, und ein
     * Name, der den Stoff schon nennt, braucht ihn nicht zweimal.
     */
    for (const n of ["Couch (Dreisitzer)", "Matratzenstapel", "Reifenhaufen", "Betonblock"]) {
      const kopf = kopfVon(ALLE.find((e) => e.name === n)!);
      expect(kopf, `${n} sollte ohne Klammer stehen`).toContain(`▼ ${n} ·`);
    }
    expect(kopfVon(ALLE.find((e) => e.name === "Alutafel")!)).toContain("▼ Alutafel ·");
    expect(kopfVon(ALLE.find((e) => e.name === "Kupferrohr-Bund")!)).toContain(
      "▼ Kupferrohr-Bund ·"
    );
  });

  it("der Waechter greift wirklich — die Regel unterscheidet die Faelle", () => {
    // Waeren beide Zweige gleich, stuende oben und hier dasselbe. Der
    // Gegenbeweis: derselbe Aufruf, zwei verschiedene Ergebnisse.
    const mitKlammer = kopfVon(ALLE.find((e) => e.name === "Fluggasttreppe")!);
    const ohneKlammer = kopfVon(ALLE.find((e) => e.name === "Matratzenstapel")!);
    expect(mitKlammer).toContain("(");
    expect(ohneKlammer.split(" · ")[0]).not.toContain("(");
  });

  it("nennt nirgends im Katalog eine Prozentzahl", () => {
    // „Dann sind mir die Anteile, zu wie viel Prozent das Mischschrott ist,
    // relativ egal." Auch nicht bei den 56 Stuecken mit Stueckliste.
    const mitProzent = ALLE.filter((e) => kopfVon(e).includes("%")).map((e) => e.name);
    expect(mitProzent).toEqual([]);
  });

  it("sagt beim Tragen nicht mehr, in welche Mulde es gehoert", () => {
    /*
     * „Ich brauche jetzt nicht die Info, ob ich das zum Mischschrott hinladen
     * soll oder zum Stahlschrott. … weil ich sehe es ja quasi, weil es gruen
     * aufleuchtet auf dem Feld."
     *
     * Der Parameter bleibt in der Signatur — die Zone wird weiter gemeldet,
     * nur nicht mehr geschrieben. Darum wird hier ausdruecklich MIT Zone
     * gerufen und geprueft, dass trotzdem nichts davon ankommt.
     */
    const z = griffLadung(
      [{ materialId: "steel", massKg: 180, shape: { name: "Doppel-T-Träger" } }],
      { container: "MISCHSCHROTT", ampel: "red" }
    );
    expect(z.kopf).toBe("Greifer: 180 kg");
    for (const wort of ["MISCHSCHROTT", "passt", "falsche Zone", "gemischt", "über", "›"])
      expect(z.kopf, `„${wort}" steht wieder im Kopf`).not.toContain(wort);
  });
});

/* Das Gewicht: siehe test/gewicht.test.ts (E-063)                            */
/* ------------------------------------------------------------------------ */
/*
 * Der Waechter ueber unmoegliche Gewichte stand bis E-063 hier. Er ist nach
 * `test/gewicht.test.ts` gezogen und dort um drei Gegenproben und die
 * Sortenzahl je Fraktion gewachsen. Zwei Haeuser fuer dieselbe Regel waeren
 * genau die Bauform, aus der E-062 gelernt hat: zwei Abschriften, die
 * auseinanderlaufen.
 */


/* ------------------------------------------------------------------------ */
/* Die Ampel an der Mulde ist der letzte Kanal — sie muss zu sehen sein       */
/* ------------------------------------------------------------------------ */

describe("Die Ampel leuchtet auch aus der Naehe (E-061)", () => {
  const containers = readFileSync(resolve(wurzel, "src/world/containers.ts"), "utf8");

  it("das Schild blendet sich nicht aus, solange es ein Urteil traegt", () => {
    /*
     * Patrick, 15.09.2026: „Die Info brauche ich nicht, weil ich sehe es ja
     * quasi, weil es gruen aufleuchtet auf dem Feld." Genau darauf hin ist der
     * Zielhinweis aus dem HUD verschwunden — und damit haengt alles an diesem
     * Rahmen.
     *
     * Der Fehler, den das hier verhindert: `updateDistance` blendete das
     * Schild unter 4,5 m Kameraabstand vollstaendig aus. Wer die Spinne ueber
     * eine Mulde schwenkt, steht nah dran. Es gab also genau dann keine
     * Antwort, wenn man sie braucht.
     */
    expect(containers).toMatch(/this\.zeigtAmpel \? 1 : THREE\.MathUtils\.smoothstep\(d, 4\.5, 9\)/);
    // Und die Marke wird beim Zeichnen gesetzt, nicht irgendwo nebenbei.
    expect(containers).toContain("this.zeigtAmpel = ampel !== null;");
  });

  it("der Rahmen ist im Urteilsfall dreimal so dick wie sonst", () => {
    // Ein duenner Rahmen in Ampelfarbe ist aus zehn Metern kein Signal.
    expect(containers).toContain("ctx.lineWidth = ampel ? 12 : 4;");
  });

  it("die Fernausblendung bleibt — sonst kostet jedes Schild in jedem Bild Zeit", () => {
    expect(containers).toContain("1 - THREE.MathUtils.smoothstep(d, 38, 52)");
  });
});
