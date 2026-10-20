/**
 * Die Buchfuehrung der Presse: **Ein Paket ist so sortenrein wie das, was
 * hineinging.**
 *
 * Befund Patrick (`docs/offene-punkte.md`, Geraetetest): „Schere trennt nicht
 * sortenrein — was in die Presse geht, kommt als Mischschrott heraus."
 *
 * Das ist kein Schoenheitsfehler. Beim Verkauf zaehlt die Sortenreinheit hoch
 * drei (`economy/account.ts`, `sellContainer`): Eine zu 70 % saubere Fuhre
 * bringt 34 % des Kurses. Wenn die Presse aus sortenreinem Material
 * Mischschrott macht, vernichtet sie den Wert der Sortierarbeit.
 *
 * Nachgemessen am 16.09.2026 waren es ZWEI verschiedene Loecher (E-091):
 *
 *  1. **Die Presse rechnete in Rohstoffen, der Platz sortiert in Fraktionen.**
 *     `press.ts` legte `SORTENREIN_AB` (95 %) an die Stoffliste an. Auf dem
 *     Platz gilt aber `fraktionVonTeil` — und die laesst Stahl bis 10 %
 *     Fremdstoff (`VERBUND_BIS`, E-042). An der Presse galt also eine
 *     strengere Regel als ueberall sonst: Fuenf Stuecke, die jedes fuer sich
 *     Stahlschrott sind, kamen als Mischschrott heraus.
 *  2. **Das Paket verlor seine Zusammensetzung beim Speichern.** Sie stand nur
 *     am Teil (`ScrapItem.composition`); gesichert wird je Teil aber nur
 *     `materialId`, `massKg` und `shape` (`core/save.ts`). Ein Paket aus dem
 *     KUPFER-LAGER war nach dem Neuladen 44,96 € statt 556,46 € wert, ein
 *     Paket aus lauter Abfall brachte plus 12,48 € statt minus 0,60 €
 *     Gebuehr — man konnte Muell pressen, neu laden und dafuer bezahlt werden.
 *
 * Geprueft wird deshalb der ganze Weg mit echter Physik, und jede
 * Zahlenschranke bekommt eine GEGENPROBE — derselbe Pruefcode auf einen
 * absichtlich kaputten Eingang, der melden MUSS.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ItemManager, type ScrapItem, type ScrapShape } from "../src/world/scrapItems";
import { PressManager, PRESS_CENTER } from "../src/world/press";
import { CompositeManager } from "../src/dismantle/composites";
import { CAR_DEF } from "../src/dismantle/carDef";
import { EventBus } from "../src/core/events";
import { Account } from "../src/economy/account";
import { fraktionVonTeil, VERBUND_BIS } from "../src/materials/purity";

/** Stummel fuer den Verkauf — dieselben wie in `upgradeEffects.test.ts`. */
const OHNE_ITEMS = { remove: () => {} } as never;
const OHNE_COMPS = { despawnByBody: () => false } as never;

interface Ware {
  materialId: string;
  massKg: number;
  composition?: Array<{ materialId: string; massKg: number }>;
  fraktionsmix?: Array<{ materialId: string; massKg: number }>;
}

function erloes(ware: Ware[], order: string | null = null): number {
  return new Account().sellContainer(
    ware.map((w) => ({ ...w, body: null })) as never,
    OHNE_ITEMS,
    OHNE_COMPS,
    order
  ).eur;
}

function alsWare(it: ScrapItem): Ware {
  return {
    materialId: it.materialId,
    massKg: it.massKg,
    composition: it.composition,
    // Seit E-094 traegt ein Paket zwei Listen: woraus es gemacht ist
    // (`composition`, Farbe und Gewicht) und welche Fraktionen hineingingen
    // (`fraktionsmix`, das Geld). Wer hier eine davon vergisst, misst falsch.
    fraktionsmix: it.fraktionsmix,
  };
}

/** Massen je Stoff ueber eine ganze Fuhre — das, was die Kasse liest. */
function stoffe(ware: Ware[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of ware) {
    for (const c of w.composition ?? [{ materialId: w.materialId, massKg: w.massKg }]) {
      m.set(c.materialId, (m.get(c.materialId) ?? 0) + c.massKg);
    }
  }
  return m;
}

/**
 * Eine Presse mit Boden und Physik. Jeder Fall bekommt seine eigene — Koerper
 * aus einem frueheren Fall wuerden sonst mitgepresst.
 */
function werkbank(): { items: ItemManager; press: PressManager } {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const items = new ItemManager(scene, world);
  const composites = new CompositeManager(scene, world, items, new EventBus());
  const press = new PressManager(scene, world, items, composites);
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  );
  return { items, press };
}

/** Teile in die Kammer legen, Zyklus fahren, und zurueckgeben, was herauskam. */
function pressen(teile: Array<{ materialId: string; shape: ScrapShape; massKg: number }>): {
  vorher: Ware[];
  nachher: Ware[];
  ballen: ScrapItem[];
  items: ItemManager;
} {
  const { items, press } = werkbank();
  teile.forEach((t, i) => {
    items.spawnScrap(
      t.materialId,
      t.massKg,
      t.shape,
      new THREE.Vector3(PRESS_CENTER.x + (i - teile.length / 2) * 0.3, 1.0 + i * 0.05, PRESS_CENTER.z)
    );
  });
  const vorher = items.items.map(alsWare);
  press.start();
  for (let i = 0; i < 1500 && press.running; i++) {
    press.update(1 / 60);
    (items as unknown as { world: RAPIER.World }).world.step();
  }
  return { vorher, nachher: items.items.map(alsWare), ballen: [...items.items], items };
}

/** Eine schlichte Form ohne Bauart — Physik und Aussehen spielen hier keine Rolle. */
function form(extra: Partial<ScrapShape> = {}): ScrapShape {
  return { kind: "box", dims: [0.5, 0.4, 0.5], color: 0x808080, ...extra };
}

/**
 * Speichern und laden, genau wie `main.ts` es tut: gesichert wird je Teil nur
 * `materialId`, `massKg` und `shape`, hergestellt wird ueber `spawnScrap`.
 *
 * `kaputt` ist der Hebel fuer die Gegenprobe: Er darf die Form unterwegs
 * verstuemmeln.
 */
function speichernUndLaden(
  quelle: ItemManager,
  kaputt: (s: ScrapShape) => ScrapShape = (s) => s
): Ware[] {
  const stand = quelle.items
    .filter((i) => i.shape)
    .map((i) => ({
      materialId: i.materialId,
      massKg: i.massKg,
      shape: kaputt(JSON.parse(JSON.stringify(i.shape)) as ScrapShape),
    }));
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const neu = new ItemManager(scene, world);
  for (const s of stand) neu.spawnScrap(s.materialId, s.massKg, s.shape, new THREE.Vector3(0, 5, 0));
  return neu.items.map(alsWare);
}

beforeAll(async () => {
  await RAPIER.init();
});

/* ------------------------------------------------------------------------ */

describe("Sortenrein hinein, sortenrein heraus", () => {
  it("fünf Kupferteile ergeben EIN Kupferpaket zum vollen Kurs", () => {
    const { vorher, nachher } = pressen(
      Array.from({ length: 5 }, () => ({ materialId: "copper", massKg: 40, shape: form() }))
    );
    expect(nachher.length, "aus fünf Teilen muss ein Paket werden").toBe(1);
    expect(nachher[0]!.materialId, "ein Kupferpaket ist Kupfer, nicht Mischschrott").toBe("copper");
    expect(nachher[0]!.massKg).toBeCloseTo(200, 6);
    // 200 kg × 7,20 €/kg (catalog.ts) × Reinheit 1 — der volle Kurs.
    expect(erloes(nachher)).toBeCloseTo(1440, 2);
    expect(erloes(nachher)).toBeCloseTo(erloes(vorher), 2);
  });

  it("GEGENPROBE: ein Kupferteil zu viel Fremdes dabei, und es ist Mischschrott", () => {
    const { nachher } = pressen([
      ...Array.from({ length: 4 }, () => ({ materialId: "copper", massKg: 40, shape: form() })),
      { materialId: "steel", massKg: 40, shape: form() },
    ]);
    expect(
      nachher[0]!.materialId,
      "vier Teile Kupfer und eines Stahl sind kein Kupferpaket"
    ).toBe("mixed");
  });

  it("was jedes für sich Stahlschrott ist, bleibt es auch als Paket (E-042/E-091)", () => {
    /*
     * DAS war das Loch. `fraktionVonTeil` laesst Stahl bis `VERBUND_BIS`
     * (10 %) Fremdstoff — ein Tank mit Dichtungen ist Stahlschrott. Die Presse
     * verlangte 95 % und machte aus fuenf Stahlteilen Mischschrott.
     *
     * Der Fall liegt absichtlich in der Luecke zwischen beiden Schwellen: 9 %
     * Fremdstoff ist mehr als die 5 % von `SORTENREIN_AB` und weniger als die
     * 10 % von `VERBUND_BIS`.
     */
    const zus = [
      { materialId: "steel", anteil: 0.91 },
      { materialId: "plastic", anteil: 0.09 },
    ];
    const teil = { materialId: "steel", massKg: 300, kind: "box", dims: [0.5, 0.4, 0.5], massiv: true };
    expect(fraktionVonTeil({ ...teil, zusammensetzung: zus })).toBe("steel");
    expect(1 - 0.91).toBeLessThanOrEqual(VERBUND_BIS + 1e-9);

    const { vorher, nachher } = pressen(
      Array.from({ length: 5 }, () => ({
        materialId: "steel",
        massKg: 300,
        shape: form({ zusammensetzung: zus, massiv: true }),
      }))
    );
    expect(nachher.length).toBe(1);
    expect(
      nachher[0]!.materialId,
      "fünf Stahlteile ergeben ein Stahlpaket — die Presse darf nicht strenger sein als der Platz"
    ).toBe("steel");
    // Der Erlös ändert sich dabei NICHT: er hängt an der Zusammensetzung.
    expect(erloes(nachher)).toBeCloseTo(erloes(vorher), 2);
  });
});

describe("Gemischt hinein, dieselbe Mischung heraus", () => {
  const fuhre = [
    { materialId: "steel", massKg: 200, shape: form() },
    { materialId: "copper", massKg: 50, shape: form() },
    {
      materialId: "mixed",
      massKg: 100,
      shape: form({
        zusammensetzung: [
          { materialId: "steel", anteil: 0.5 },
          { materialId: "plastic", anteil: 0.3 },
          { materialId: "alu", anteil: 0.2 },
        ],
      }),
    },
  ];

  it("jedes Kilo jedes Stoffes steht nach dem Pressen noch da", () => {
    const { vorher, nachher } = pressen(fuhre);
    expect(nachher.length).toBe(1);
    const a = stoffe(vorher);
    const b = stoffe(nachher);
    expect([...b.keys()].sort()).toEqual([...a.keys()].sort());
    for (const [id, kg] of a) expect(b.get(id), `${id} fehlt oder hat sich geändert`).toBeCloseTo(kg, 6);
  });

  it("und der Erlös stimmt auf den Cent — vor und nach dem Pressen", () => {
    const { vorher, nachher } = pressen(fuhre);
    expect(erloes(nachher)).toBeCloseTo(erloes(vorher), 2);
    expect(erloes(nachher, "steel")).toBeCloseTo(erloes(vorher, "steel"), 2);
  });

  it("GEGENPROBE: verschwindet ein Stoff, meldet der Vergleich es", () => {
    const a = stoffe([{ materialId: "steel", massKg: 100 }, { materialId: "copper", massKg: 50 }]);
    const b = stoffe([{ materialId: "steel", massKg: 150 }]);
    // Genau der Fehler, den die Presse machte: gleiche Masse, falscher Stoff.
    expect([...a.keys()].sort()).not.toEqual([...b.keys()].sort());
    expect(erloes([{ materialId: "steel", massKg: 150 }])).not.toBeCloseTo(
      erloes([{ materialId: "steel", massKg: 100 }, { materialId: "copper", massKg: 50 }]),
      2
    );
  });
});

describe("Das Paket führt seine Zusammensetzung, nicht nur seine Farbe", () => {
  /** Ein Paket aus dem KUPFER-LAGER: Kupfer und Messing gehören in dieselbe Mulde. */
  const kupferLager = [
    { materialId: "copper", massKg: 64, shape: form() },
    { materialId: "brass", massKg: 217, shape: form() },
  ];

  it("die Zusammensetzung steht an der FORM und übersteht damit den Spielstand", () => {
    const { nachher, ballen } = pressen(kupferLager);
    const ballenForm = ballen[0]!.shape!;
    expect(ballenForm.zusammensetzung, "ohne das hier ist sie nach dem Laden weg").toBeDefined();
    const summe = ballenForm.zusammensetzung!.reduce((a, c) => a + c.anteil, 0);
    expect(summe, "die Anteile eines Pakets müssen sich zu eins addieren").toBeCloseTo(1, 9);
    // 64 kg Kupfer von 281 kg = 22,78 %
    const cu = ballenForm.zusammensetzung!.find((c) => c.materialId === "copper")!;
    expect(cu.anteil).toBeCloseTo(64 / 281, 9);
    expect(nachher[0]!.massKg).toBeCloseTo(281, 6);
  });

  it("nach Speichern und Laden ist der Ballen auf den Cent so viel wert wie vorher", () => {
    const { nachher, items } = pressen(kupferLager);
    const geladen = speichernUndLaden(items);
    /*
     * 64 kg Kupfer + 217 kg Messing gehören beide ins KUPFER-LAGER (E-010).
     * Seit E-094 zahlt die Kasse dieselbe Rechnung wie das Muldenschild: jede
     * Fraktion zu ihrem eigenen Preis, Reinheit 100 % →
     * 64 × 7,20 + 217 × 4,30 = 460,80 + 933,10 = 1393,90 €.
     *
     * Bis zum 16.09.2026 stand hier 556,46 € — die Kasse nahm damals die
     * schwerste Fraktion (Messing), zahlte das Kupfer zum Messingpreis und
     * bestrafte es zusätzlich mit Reinheit hoch drei. Das war Befund W-3.
     */
    expect(erloes(nachher)).toBeCloseTo(1393.9, 2);
    expect(erloes(geladen), "der Spielstand darf den Wert nicht verändern").toBeCloseTo(
      erloes(nachher),
      2
    );
  });

  it("GEGENPROBE: ein Ballen ohne Zusammensetzung an der Form MUSS auffallen", () => {
    /*
     * Genau der Stand bis zum 16.09.2026. Hier wird die Zusammensetzung beim
     * „Speichern" absichtlich entfernt — wenn der Waechter das nicht meldet,
     * bewacht er nichts.
     */
    const { nachher, items } = pressen(kupferLager);
    const verstuemmelt = speichernUndLaden(items, (s) => {
      delete s.zusammensetzung;
      delete s.fraktionsmix;
      return s;
    });
    expect(verstuemmelt[0]!.composition, "die Verstümmelung hat nicht gewirkt").toBeUndefined();
    expect(verstuemmelt[0]!.fraktionsmix, "die Verstümmelung hat nicht gewirkt").toBeUndefined();
    // 281 kg als reiner Mischschrott zu 0,16 €/kg statt 1393,90 € — Faktor 31.
    expect(erloes(verstuemmelt)).toBeCloseTo(44.96, 2);
    expect(
      Math.abs(erloes(verstuemmelt) - erloes(nachher)),
      "der Vergleich hätte den Verlust durchgelassen"
    ).toBeGreaterThan(1);
  });

  it("GEGENPROBE: gepresster Abfall darf nach dem Laden keine Prämie werden", () => {
    /*
     * Der haesslichste Fall des alten Standes: Vier Abfallsorten zusammen
     * gepresst kosten Entsorgungsgebuehr. Ohne Zusammensetzung galt das Paket
     * als Mischschrott — und Mischschrott hat einen POSITIVEN Preis. Aus einer
     * Gebuehr wurde eine Gutschrift, allein durchs Neuladen.
     */
    const { nachher, items } = pressen([
      { materialId: "wood", massKg: 14, shape: form() },
      { materialId: "rubble", massKg: 45, shape: form() },
      { materialId: "tires", massKg: 11, shape: form() },
      { materialId: "plastic", massKg: 8, shape: form() },
    ]);
    expect(erloes(nachher), "Abfall kostet").toBeLessThan(0);
    expect(erloes(speichernUndLaden(items)), "und kostet auch nach dem Laden").toBeLessThan(0);
    const alterStand = speichernUndLaden(items, (s) => {
      delete s.zusammensetzung;
      delete s.fraktionsmix;
      return s;
    });
    expect(erloes(alterStand), "so sah die Geldquelle aus, die zugemacht wurde").toBeGreaterThan(0);
  });
});

describe("Was aus einem zerlegten Wrack fällt, trägt seine Fraktion", () => {
  it("jedes Anbauteil der Wrack-Definition ist die Fraktion, die die Regel ihm gibt", () => {
    /*
     * Im Objektkatalog wird die Fraktion aus der Stueckliste ABGELEITET
     * (`objektkatalog.ts`, letzte Zeilen). In `carDef.ts` steht sie von Hand
     * daneben. Zwei Stellen, die dasselbe wissen sollen — und genau daran ist
     * am 15.09.2026 schon einmal ein Widerspruch aufgefallen (E-042).
     *
     * Dieser Waechter haelt beide zusammen. Wer einem Anbauteil eine
     * Stueckliste gibt, ohne die Fraktion nachzuziehen, wird gemeldet.
     */
    let geprueft = 0;
    for (const p of CAR_DEF.parts) {
      geprueft++;
      const dims = p.kind === "wheel" ? [p.size[0]!, p.size[1]!] : [...p.size];
      expect(
        fraktionVonTeil({
          materialId: p.materialId,
          massKg: p.massKg,
          kind: p.kind === "wheel" ? "cyl" : "box",
          dims,
          zusammensetzung: p.zusammensetzung,
        }),
        `${p.name} (${p.id}) steht als ${p.materialId} im Datensatz`
      ).toBe(p.materialId);
    }
    // Ohne diese Zeile wäre der Wächter grün, wenn die Liste leer wäre.
    expect(geprueft, "die Wrack-Definition hat keine Anbauteile mehr").toBeGreaterThanOrEqual(6);
    // E-186, Patrick 20.10.2026: „Rad zählt als Reifen" (`purity.istRad`) —
    // ein abgerissenes Rad (Reifen 70 % / Stahlfelge 30 %) gehört zu Reifen;
    // die Motorhaube (Lackblech) bleibt Mischschrott.
    const raeder = CAR_DEF.parts.filter((p) => p.kind === "wheel");
    expect(raeder.length).toBe(4);
    for (const p of raeder) expect(p.materialId, p.id).toBe("tires");
    expect(CAR_DEF.parts.find((p) => p.name === "Motorhaube")?.materialId).toBe("mixed");
  });

  it("GEGENPROBE: ein Anbauteil mit falschem Etikett wird gemeldet", () => {
    // Ein „Kupfer"-Teil, das zu 80 % aus Stahl besteht — das ist Mischschrott.
    expect(
      fraktionVonTeil({
        materialId: "copper",
        massKg: 30,
        kind: "box",
        dims: [0.4, 0.3, 0.4],
        zusammensetzung: [
          { materialId: "steel", anteil: 0.8 },
          { materialId: "copper", anteil: 0.2 },
        ],
      })
    ).not.toBe("copper");
  });

  it("der Rumpf bringt seine Stückliste mit und ist damit Mischschrott", () => {
    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const items = new ItemManager(scene, world);
    const composites = new CompositeManager(scene, world, items, new EventBus());
    composites.spawnCar(new THREE.Vector3(0, 1, 0));
    const rumpf = items.items[0]!;
    expect(rumpf.materialId).toBe("mixed");
    expect(rumpf.composition, "ohne Stückliste wäre ein Auto sortenrein").toBeDefined();
    const summe = rumpf.composition!.reduce((a, c) => a + c.massKg, 0);
    expect(summe, "die Stückliste muss die ganze Rumpfmasse abdecken").toBeCloseTo(
      CAR_DEF.hullMassKg,
      6
    );
  });
});
