/**
 * CONTAINER, GERUESTE, KLEINE BAGGER — und woran man die Sorte sieht (E-123).
 *
 * Patrick, 06.10.2026: „Die Schrottsorten sollen mehr grossteile beinhalten,
 * container, gerüste, kleine bagger. … Kupfer, Va, Aluminium, misschrott und
 * stahlschrott müssen als solches besser erkennbar sein."
 *
 * Zwei Teile, zwei Fragen:
 *
 *  1. KOMMT ES AN? Ein Grossteil, das auf keinen Wagen passt, gibt es fuer
 *     Patrick nicht (E-106: 123 von 166 kamen nie an). Geprueft wird mit dem
 *     Packer selbst, gegen dieselben Flaechen wie `test/grossteile.test.ts`.
 *  2. SIEHT MAN DIE SORTE? Gemessen wie `tools/sortenbild.ts`: flaechen-
 *     gemittelte Eckfarbe aller gebauten Teile je Sorte, ΔE2000 zwischen den
 *     Sorten. Unter 10 gilt als dieselbe Farbe — vorher lagen Stahl- und
 *     Mischschrott bei 5,3 und Mischschrott und Alu bei 4,6.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { packeLadung, stueckMass } from "../src/delivery/ladung";
import { SPECS, BIG_SPECS, HUGE_SPECS } from "../src/world/scrapItems";
import type { PileSpec } from "../src/world/objektkatalog";
import { baueGeometrie, fraktionsbild } from "../src/world/objektbau";
import { BED_HALF_W, bedLenFor } from "../src/delivery/routes";
import {
  ANHAENGER_HALB_BREITE,
  ANHAENGER_WAND,
  LADE_RAND,
  LADUNG_UEBERSTAND,
  type Aufbau,
} from "../src/delivery/fuellgrad";
import { wandHoehe } from "../src/delivery/vehicleModel";
import { deltaEHex } from "../tools/farbabstand";
import { sortenMittel, SORTEN } from "../tools/sortenbild";

afterEach(() => vi.restoreAllMocks());

/** Dieselbe Flaechenrechnung wie `vehicles.loadCargo` (siehe `test/grossteile.test.ts`). */
function flaeche(kind: string, aufbau: Aufbau): { halbBreite: number; nutzLaenge: number; maxHoehe: number } {
  const anhaenger = kind === "pkw";
  return {
    halbBreite: anhaenger ? ANHAENGER_HALB_BREITE : BED_HALF_W - 0.08,
    nutzLaenge: bedLenFor(kind) - 2 * LADE_RAND,
    maxHoehe: (anhaenger ? ANHAENGER_WAND : wandHoehe(kind, aufbau)) + LADUNG_UEBERSTAND,
  };
}
const FLAECHEN = (["flach", "rungen", "koffer"] as const).flatMap((a) =>
  ["pritsche", "kipper"].map((k) => ({ name: `${k}/${a}`, ...flaeche(k, a) }))
);
function passtAuf(sp: PileSpec): string[] {
  const s = stueckMass(sp.kind, sp.dims);
  return FLAECHEN.filter((f) => packeLadung([s], f.halbBreite, f.nutzLaenge, f.maxHoehe)[0] !== null).map(
    (f) => f.name
  );
}

const ALLE = [...SPECS, ...BIG_SPECS, ...HUGE_SPECS];
const finde = (name: string): PileSpec => {
  const sp = ALLE.find((s) => s.name === name);
  expect(sp, `${name} fehlt im Katalog`).toBeDefined();
  return sp!;
};

/** Name -> Fraktion, wie `fraktionVonTeil` sie ausrechnet. Hier steht sie als Entscheidung. */
const NEU: Array<[string, string]> = [
  ["Werkzeugcontainer (Baustelle)", "mixed"],
  ["Kippbehälter (Stapler)", "mixed"],
  ["Absetzmulde 5 m³ (Klappdeckel)", "mixed"],
  ["Gerüstrahmen (Paket, verzinkt)", "zinc"],
  ["Alu-Rollgerüst (zerlegt, Paket)", "alu"],
  ["Gerüstrohre verzinkt (Bund)", "zinc"],
  ["Gerüstfeld (ausgerissen)", "mixed"],
  ["Minibagger-Raupenunterwagen", "mixed"],
  ["Minibagger-Ausleger mit Stiel", "steel"],
  // E-138: Stahl — massiv und 14 % Fremdstoff liegt unter `VERBUND_BIS` 0,15
  ["Minibagger 1,5 t (ohne Arm/Dach)", "steel"],
  ["Minibagger (ausgeschlachtet)", "steel"],
];

describe("Container, Gerueste, kleine Bagger stehen im Katalog (E-123)", () => {
  it("jedes neue Teil traegt die Fraktion, die die Regel ausrechnet", () => {
    for (const [name, frak] of NEU) expect(finde(name).materialId, name).toBe(frak);
  });

  it("von jeder der drei Arten gibt es mindestens zwei", () => {
    // Patricks drei Woerter, je mindestens zwei Gegenstaende — sonst ist es ein
    // Einzelstueck und keine Sorte.
    const namen = ALLE.map((s) => s.name ?? "");
    expect(namen.filter((n) => /container|mulde|Kippbehälter/i.test(n)).length).toBeGreaterThanOrEqual(2);
    expect(namen.filter((n) => /Gerüst/i.test(n)).length).toBeGreaterThanOrEqual(4);
    expect(namen.filter((n) => /bagger/i.test(n) && !/ausleger$|löffel/i.test(n)).length).toBeGreaterThanOrEqual(2);
  });

  it("jedes passt allein auf mindestens eine Ladeflaeche", () => {
    const nie = NEU.filter(([n]) => passtAuf(finde(n)).length === 0).map(([n]) => n);
    expect(nie, "kommt nie an").toEqual([]);
  });

  it("die meisten passen schon auf Rungen, nicht erst in den Koffer", () => {
    // Koffer faehrt nur jeder vierte Haendler (`fuellgrad.rollAufbau`). Was erst
    // dort passt, kommt gemessen kaum an (Minibagger mit 1,55 m: 0 von 7).
    const nurKoffer = NEU.filter(([n]) => {
      const f = passtAuf(finde(n));
      return f.length > 0 && f.every((x) => x.endsWith("/koffer"));
    }).map(([n]) => n);
    expect(nurKoffer).toEqual([]);
  });

  it("GEGENPROBE: der alte Minibagger (2,2 m hoch) passte auf keinen Wagen", () => {
    const alt: PileSpec = { ...finde("Minibagger (ausgeschlachtet)"), dims: [2.2, 2.2, 3.4] };
    expect(passtAuf(alt)).toEqual([]);
  });
});

describe("Die neuen Bauten sind je EIN Netz und bleiben in ihren Massen", () => {
  const BAUTEN = new Set(["minibagger", "raupe", "geruest", "geruestfeld", "mulde", "deckelmulde"]);
  const traeger = ALLE.filter((s) => s.bau && BAUTEN.has(s.bau));

  it("alle sechs neuen Bauten haben Traeger", () => {
    expect(new Set(traeger.map((s) => s.bau)).size).toBe(BAUTEN.size);
  });

  for (const sp of traeger) {
    it(`${sp.name}: ein Netz, keine Scheiben, nichts ragt ueber die Katalogmasse`, () => {
      /*
       * Der Kollider ist die konvexe Huelle dieses Netzes, der Packer rechnet
       * mit den Katalogmassen. Ragt das Netz hinaus, raeumt der Packer einen
       * Platz frei, in den das Teil nicht passt. 1 cm Spiel fuer die schraeg
       * gestellten Bleche der Mulde und die Diagonale des Geruestfelds.
       */
      const t = baueGeometrie(sp.bau!, sp.dims, sp.kind, sp.materialId);
      expect(t.glas, "Scheiben kosten einen zweiten Zeichenruf").toBeNull();
      const p = t.koerper.getAttribute("position").array as Float32Array;
      expect(p.every((v) => Number.isFinite(v))).toBe(true);
      const [w, h, d] = sp.dims as [number, number, number];
      let mx = 0;
      let my = 0;
      let mz = 0;
      for (let i = 0; i < p.length; i += 3) {
        mx = Math.max(mx, Math.abs(p[i]!));
        my = Math.max(my, Math.abs(p[i + 1]!));
        mz = Math.max(mz, Math.abs(p[i + 2]!));
      }
      expect(mx).toBeLessThanOrEqual(w / 2 + 0.01);
      expect(my).toBeLessThanOrEqual(h / 2 + 0.01);
      expect(mz).toBeLessThanOrEqual(d / 2 + 0.01);
      // ...und fuellt sie auch: nicht mehr als 15 % Luft in einer Richtung.
      expect(my, "das Netz ist viel flacher als sein Packmass").toBeGreaterThan(h / 2 * 0.85);
      t.koerper.dispose();
    });
  }
});

describe("Kein Bau aus allen drei Listen liefert NaN (E-123, Ring)", () => {
  it("auch die alten Listen in scrapItems.ts — dort stand der Kupferrohr-Bund", () => {
    /*
     * `test/fraktionen.test.ts` (B-3) prueft nur die Katalogdatei. Der
     * „Kupferrohr-Bund" (`torus` mit `bau: "buendel"`) steht in BIG_SPECS und
     * war seit jeher ein NaN-Netz: unsichtbar im Spiel, und gemessen das
     * zweithaeufigste Grossteil auf den Wagen (E-106: 82 von 960 Fuhren).
     */
    const kaputt = ALLE.filter((s) => s.bau)
      .filter((s) => {
        const t = baueGeometrie(s.bau!, s.dims, s.kind, s.materialId);
        const ok = (t.koerper.getAttribute("position").array as Float32Array).every((v) => Number.isFinite(v));
        t.koerper.dispose();
        t.glas?.dispose();
        return !ok;
      })
      .map((s) => s.name);
    expect(kaputt).toEqual([]);
    expect(ALLE.some((s) => s.kind === "torus" && s.bau), "Gegenprobe: ein Ring mit Bau ist dabei").toBe(true);
  });
});

/* ------------------------------------------------------------------------ */
/* Das Fraktionsbild                                                          */
/* ------------------------------------------------------------------------ */

function farben(geo: { getAttribute(n: string): { array: ArrayLike<number> } }): Float32Array {
  return Float32Array.from(geo.getAttribute("color").array);
}
function verschiedene(c: Float32Array): number {
  const s = new Set<string>();
  for (let i = 0; i < c.length; i += 3) s.add(`${c[i]!.toFixed(4)},${c[i + 1]!.toFixed(4)},${c[i + 2]!.toFixed(4)}`);
  return s.size;
}
function mittel(c: Float32Array): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < c.length; i += 3) {
    r += c[i]!;
    g += c[i + 1]!;
    b += c[i + 2]!;
  }
  const n = c.length / 3;
  return [r / n, g / n, b / n];
}

describe("Man sieht dem Teil seine Sorte an (E-123)", () => {
  it("ohne Fraktion bleibt alles, wie es war — Batterien haben kein Bild", () => {
    // Batterien bekommen denselben Grundton wie Stahl und kein Fraktionsbild:
    // Ihr Bau muss Eck fuer Eck derselbe sein wie ganz ohne Angabe.
    expect(fraktionsbild("battery")).toBeUndefined();
    const ohne = baueGeometrie("tank", [0.5, 1.6], "cyl");
    const akku = baueGeometrie("tank", [0.5, 1.6], "cyl", "battery");
    expect(farben(akku.koerper)).toEqual(farben(ohne.koerper));
  });

  it("dasselbe Stueck sieht zweimal gleich aus, und gewuerfelt wird nicht", () => {
    // Jeder Zufallszug verschiebt die Folge fuer alle Waechter dahinter. Die
    // Geometrien selbst ziehen schon immer welche (je vier fuer ihre UUID) —
    // das Fraktionsbild darf keinen einzigen dazulegen.
    const zug = vi.spyOn(Math, "random");
    baueGeometrie("weisseWare", [0.6, 1.7, 0.6], "box");
    const ohneBild = zug.mock.calls.length;
    zug.mockClear();
    const a = baueGeometrie("weisseWare", [0.6, 1.7, 0.6], "box", "mixed");
    expect(zug.mock.calls.length).toBe(ohneBild);
    const b = baueGeometrie("weisseWare", [0.6, 1.7, 0.6], "box", "mixed");
    expect(farben(a.koerper)).toEqual(farben(b.koerper));
  });

  it("Stahlschrott ist rostbraun und dunkler als derselbe Bau ohne Sorte", () => {
    const ohne = mittel(farben(baueGeometrie("traeger", [0.28, 0.28, 2.9], "box").koerper));
    const stahl = mittel(farben(baueGeometrie("traeger", [0.28, 0.28, 2.9], "box", "steel").koerper));
    expect(stahl[0] + stahl[1] + stahl[2]).toBeLessThan(ohne[0] + ohne[1] + ohne[2]);
    expect(stahl[0] / stahl[2], "nicht roetlicher als vorher").toBeGreaterThan((ohne[0] / ohne[2]) * 1.3);
  });

  it("Mischschrott ist gemischt: mehr verschiedene Farben als derselbe Bau ohne Sorte", () => {
    const ohne = verschiedene(farben(baueGeometrie("weisseWare", [0.6, 1.7, 0.6], "box").koerper));
    const misch = verschiedene(farben(baueGeometrie("weisseWare", [0.6, 1.7, 0.6], "box", "mixed").koerper));
    expect(misch).toBeGreaterThan(ohne * 2);
  });

  it("Kupfer setzt Gruenspan an, VA bleibt blank", () => {
    const kupfer = farben(baueGeometrie("tank", [0.35, 1.2], "cyl", "copper").koerper);
    let gruen = 0;
    for (let i = 0; i < kupfer.length; i += 3) if (kupfer[i + 1]! > kupfer[i]!) gruen++;
    expect(gruen, "keine einzige gruene Ecke").toBeGreaterThan(0);
    // VA: keine Ecke weicht von den Bauteilfarben ab — so viele Farben wie Bauteiltoene
    const va = farben(baueGeometrie("tank", [0.35, 1.2], "cyl", "va").koerper);
    expect(verschiedene(va)).toBeLessThanOrEqual(3);
  });

  it("VA ist die glatteste Metallsorte, Alu die matteste — und nichts glaenzt ueber 0,5", () => {
    // Ohne Umgebungskarte wird ein Metall mit hohem Glanz schwarz (siehe `Fraktionsbild.glanz`).
    const ids = ["steel", "mixed", "va", "alu", "copper", "brass"];
    const b = ids.map((id) => fraktionsbild(id)!);
    for (const x of b) expect(x.glanz).toBeLessThanOrEqual(0.5);
    expect(Math.min(...b.map((x) => x.rauheit))).toBe(fraktionsbild("va")!.rauheit);
    expect(fraktionsbild("alu")!.rauheit).toBeGreaterThan(0.8);
  });

  it("je zwei der sechs Sorten liegen im Mittel mehr als ΔE 11 auseinander (vorher 4,6)", () => {
    /*
     * GEMESSEN 06.10.2026 (`tools/sortenbild.ts`): kleinster Abstand 11,5
     * (Misch/Alu), vorher 4,6. Die Schranke steht knapp darunter: Sie bewacht,
     * dass keine Sorte wieder in die Farbe einer anderen rutscht — nicht die
     * letzte Stelle.
     */
    const m = sortenMittel();
    let min = Infinity;
    let paar = "";
    for (let i = 0; i < SORTEN.length; i++)
      for (let j = i + 1; j < SORTEN.length; j++) {
        const d = deltaEHex(m[SORTEN[i]!]!.diffus, m[SORTEN[j]!]!.diffus);
        if (d < min) {
          min = d;
          paar = `${SORTEN[i]}/${SORTEN[j]}`;
        }
      }
    expect(min, `am naechsten: ${paar}`).toBeGreaterThan(11);
    // Und Mischschrott ist am Muster zu erkennen, Stahlschrott nicht
    expect(m.mixed!.bunt).toBeGreaterThan(0.2);
    expect(m.steel!.bunt).toBeLessThan(0.05);
  });

  it("GEGENPROBE: die Vorher-Farben fallen durch dieselbe Schranke", () => {
    // Diffuse Mittel vor E-123 (`tools/sortenbild.ts` auf dem alten Stand):
    // Mischschrott #5b534d, Alu #635f59.
    expect(deltaEHex(0x5b534d, 0x635f59)).toBeLessThan(11);
  });
});
