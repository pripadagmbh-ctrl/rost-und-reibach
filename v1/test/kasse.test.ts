/**
 * DIE SCHICHT-KASSE (E-203, 21.10.2026) — feste Preise, Abzüge, Bilanz.
 *
 * Geld wird auf den Cent geprüft. Die Preise kommen aus dem Katalog
 * (Gegenprobe: Preis ändern → Erlös ändert sich), die Zuordnung aus den
 * Box-Datensätzen in `world/containers.ts` (dieselbe Regel wie die Boxen).
 */
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MATERIALS } from "../src/materials/catalog";
import { CONFIGS, gehoertHierhin } from "../src/world/containers";
import { REIN_GUT } from "../src/economy/shift";
import {
  Kasse,
  SCHICHTSTUFEN,
  VERDIENST_SCHWELLE_EUR,
  FEHLWURF_EUR,
  SCHADEN_EUR,
  STANDGELD_FREI_S,
  LAGER_ANTEIL,
  WARTE_GUT_S,
  schichtSterne,
  schichtLauf,
  sortenregelAus,
  standgeldSekunden,
  stufeFrei,
  type KassenTeil,
  type Schichtstufe,
} from "../src/economy/kasse";

/** Die Boxen am Bagger (nicht die Silos), aus denselben Datensätzen wie im Spiel. */
const BOXEN = CONFIGS.filter((c) => c.lager !== true);
const regel = sortenregelAus(BOXEN, gehoertHierhin);
const neueKasse = (stufe: Schichtstufe = "montag"): Kasse => new Kasse(stufe, regel);

const teil = (materialId: string, massKg: number): KassenTeil => ({ materialId, massKg });

/** Euro auf den Cent vergleichen. */
const aufCent = (eur: number): number => Math.round(eur * 100);

const preisVorher = MATERIALS.steel!.sellPricePerKg;
afterEach(() => {
  MATERIALS.steel!.sellPricePerKg = preisVorher;
});

describe("Preise kommen aus dem Katalog", () => {
  it("Stahl-Abholer: 1 000 kg Stahl × Katalogpreis", () => {
    const b = neueKasse().bucheAbfahrt("steel", [teil("steel", 1000)]);
    expect(aufCent(b.erloesEur)).toBe(aufCent(1000 * MATERIALS.steel!.sellPricePerKg));
    expect(b.erloesEur).toBe(250);
  });

  it("Gegenprobe: Katalogpreis geändert → Erlös ändert sich", () => {
    MATERIALS.steel!.sellPricePerKg = 0.31;
    const b = neueKasse().bucheAbfahrt("steel", [teil("steel", 1000)]);
    expect(b.erloesEur).toBe(310);
  });

  it("Müll hat negative Preise — er kostet", () => {
    for (const id of ["wood", "tires", "rubble", "plastic"]) {
      expect(MATERIALS[id]!.sellPricePerKg, id).toBeLessThan(0);
    }
  });
});

describe("Misch-Verlader", () => {
  it("Kupfer darauf bringt nur den Mischpreis (verschenkt), ist aber kein Fehlwurf", () => {
    const k = neueKasse();
    const b = k.bucheAbfahrt("mixed", [teil("mixed", 900), teil("copper", 100)]);
    expect(b.erloesEur).toBe(160); // 1 000 kg × 0,16
    expect(b.fehlwuerfe).toBe(0);
    expect(b.kg).toBe(1000);
    expect(b.richtigKg).toBe(900);
    // ohne Bestellung derselbe Verlader
    expect(neueKasse().bucheAbfahrt(null, [teil("mixed", 900), teil("copper", 100)]).erloesEur).toBe(160);
  });

  it("Müll darauf: Fehlwurf und Entsorgungspreis", () => {
    const b = neueKasse().bucheAbfahrt("mixed", [teil("mixed", 900), teil("wood", 100)]);
    expect(b.erloesEur).toBe(142); // 900 × 0,16 − 100 × 0,02
    expect(b.fehlwuerfe).toBe(1);
    expect(b.fehlwurfEur).toBe(FEHLWURF_EUR);
    expect(b.richtigKg).toBe(900);
  });
});

describe("Sorten-Abholer", () => {
  it("Stahl-Abholer zahlt Stahl; ein Misch-Teil darauf ist Fehlwurf zum Mischpreis", () => {
    const b = neueKasse().bucheAbfahrt("steel", [teil("steel", 1000), teil("mixed", 100)]);
    expect(b.erloesEur).toBe(266); // 250 + 100 × 0,16
    expect(b.fehlwuerfe).toBe(1);
    expect(b.richtigKg).toBe(1000);
  });

  it("Müll auf dem Stahl-Abholer: Fehlwurf zum Entsorgungspreis", () => {
    const b = neueKasse().bucheAbfahrt("steel", [teil("steel", 1000), teil("rubble", 50)]);
    expect(b.erloesEur).toBe(248); // 250 − 50 × 0,04
    expect(b.fehlwuerfe).toBe(1);
  });

  it("BUNT + VA-Abholer (Leitfraktion Kupfer): jede der sieben Sorten zu IHREM Preis, wie die Box", () => {
    const bunt = CONFIGS.find((c) => c.id === "r_bunt")!;
    expect(bunt.fractionId).toBe("copper");
    const ladung = [teil("copper", 10), teil("brass", 10), teil("alu", 100), teil("zinc", 10), teil("cable", 10), teil("va", 10), teil("battery", 10)];
    for (const t of ladung) expect(gehoertHierhin(bunt, t.materialId), t.materialId).toBe(true);
    const b = neueKasse().bucheAbfahrt("copper", ladung);
    // 72 + 43 + 150 + 8,20 + 22 + 14 + 5,50
    expect(b.erloesEur).toBe(314.7);
    expect(b.fehlwuerfe).toBe(0);
    expect(b.richtigKg).toBe(160);
  });

  it("Stahl auf dem BUNT-Abholer ist Fehlwurf zum Mischpreis", () => {
    const b = neueKasse().bucheAbfahrt("copper", [teil("copper", 10), teil("steel", 50)]);
    expect(b.erloesEur).toBe(80); // 72 + 50 × 0,16
    expect(b.fehlwuerfe).toBe(1);
  });

  it("Müll-Abholer: alle vier Abfallsorten passen, kosten ihren Preis, kein Fehlwurf", () => {
    const b = neueKasse().bucheAbfahrt("rubble", [teil("rubble", 100), teil("wood", 100), teil("tires", 100), teil("plastic", 100)]);
    expect(b.erloesEur).toBe(-17); // −4 − 2 − 5 − 6
    expect(b.fehlwuerfe).toBe(0);
    expect(b.richtigKg).toBe(400);
  });

  it("Presspaket mit Zusammensetzung: jeder Anteil für sich, ein Fehlwurf je Teil", () => {
    const paket: KassenTeil = {
      materialId: "steel",
      massKg: 300,
      zusammensetzung: [
        { materialId: "steel", massKg: 280 },
        { materialId: "mixed", massKg: 15 },
        { materialId: "wood", massKg: 5 },
      ],
    };
    const b = neueKasse().bucheAbfahrt("steel", [paket]);
    expect(b.erloesEur).toBe(72.3); // 70 + 2,40 − 0,10
    expect(b.fehlwuerfe).toBe(1);
    expect(b.kg).toBe(300);
    expect(b.richtigKg).toBe(280);
  });

  it("Platzinventar (0 kg) bucht nichts", () => {
    const b = neueKasse().bucheAbfahrt("steel", [{ materialId: "steel", massKg: 14, zusammensetzung: [{ materialId: "steel", massKg: 0 }] }]);
    expect(b).toEqual({ erloesEur: 0, fehlwuerfe: 0, fehlwurfEur: 0, kg: 0, richtigKg: 0 });
  });
});

describe("Lagerbestand am Schichtende", () => {
  it("zählt zu 70 % — Entsorgung voll", () => {
    expect(LAGER_ANTEIL).toBe(0.7);
    const k = neueKasse();
    const l = k.lagerbestand([
      { order: "steel", teile: [teil("steel", 1000)] },
      { order: "rubble", teile: [teil("wood", 100)] },
    ]);
    expect(l.erloesEur).toBe(173); // 250 × 0,7 − 2
    // bucht nichts
    expect(k.bilanz(true).erloesEur).toBe(0);
  });

  it("Fehlwürfe im Lager kosten in der Bilanz; das Lager bringt keine Tonnen und keine Quote", () => {
    const k = neueKasse();
    const b = k.bilanz(true, [{ order: "steel", teile: [teil("steel", 1000), teil("plastic", 10)] }]);
    expect(b.lagerwertEur).toBe(174.4); // 175 − 0,60
    expect(b.fehlwurfEur).toBe(FEHLWURF_EUR);
    expect(b.tonnenUmgeschlagen).toBe(0);
    expect(b.sortierquote).toBe(0);
  });
});

describe("Abzüge", () => {
  it("Standgeld: die ersten 60 s je Laster sind frei (rechnet S2), dann 1 €/s", () => {
    expect(STANDGELD_FREI_S).toBe(60);
    expect(standgeldSekunden(45)).toBe(0);
    expect(standgeldSekunden(90)).toBe(30);
  });

  it("Standgeld bildweise gebucht stimmt auf den Cent (30 s in 1 800 Bildern = 30,00 €)", () => {
    const k = neueKasse();
    for (let i = 0; i < 1800; i++) k.bucheStandgeld(1 / 60);
    const b = k.bilanz(true);
    expect(b.standgeldEur).toBe(30);
    expect(b.warteS).toBeCloseTo(30, 9);
    k.bucheStandgeld(-5);
    expect(k.bilanz(true).standgeldEur, "negative Sekunden zählen nicht").toBe(30);
  });

  it("Schaden 50 € je Aufschlag, Fehlwurf 25 € je Teil", () => {
    const k = neueKasse();
    k.bucheSchaden(2);
    k.bucheFehlwurf(3);
    const b = k.bilanz(true);
    expect(b.schadenEur).toBe(2 * SCHADEN_EUR);
    expect(b.schadenEur).toBe(100);
    expect(b.fehlwurfEur).toBe(75);
    expect(b.verdienstEur).toBe(-175);
  });
});

describe("Bilanz", () => {
  it("Sortierquote = richtig einsortiert / abgefahren", () => {
    const k = neueKasse();
    k.bucheAbfahrt("mixed", [teil("mixed", 900), teil("copper", 100)]);
    k.bucheAbfahrt("steel", [teil("steel", 1000)]);
    const b = k.bilanz(true);
    expect(b.tonnenUmgeschlagen).toBe(2);
    expect(b.sortierquote).toBeCloseTo(0.95, 12);
  });

  it("Verdienst = Erlös + Lagerwert − Standgeld − Fehlwürfe − Schäden, auf den Cent", () => {
    const k = neueKasse();
    k.bucheAbfahrt("mixed", [teil("mixed", 3333), teil("wood", 77)]); // 533,28 − 1,54 = 531,74; 1 Fehlwurf
    k.bucheAbfahrt("copper", [teil("copper", 12.5), teil("steel", 40)]); // 90 + 6,40 = 96,40; 1 Fehlwurf
    k.bucheStandgeld(12.345);
    k.bucheSchaden(1);
    const b = k.bilanz(true, [{ order: "steel", teile: [teil("steel", 777)] }]); // 194,25 × 0,7 = 135,975 → 135,98
    expect(b.erloesEur).toBe(628.14);
    expect(b.lagerwertEur).toBe(135.98);
    expect(b.standgeldEur).toBe(12.35);
    expect(b.fehlwurfEur).toBe(50);
    expect(b.schadenEur).toBe(50);
    expect(aufCent(b.verdienstEur)).toBe(aufCent(628.14 + 135.98 - 12.35 - 50 - 50));
    expect(b.verdienstEur).toBe(651.77);
  });
});

describe("Sterne an den Schwellen", () => {
  it("abgebrochen 0 · beendet 1 · Verdienst ≥ Schwelle 2 · dazu Quote ≥ REIN_GUT und Wartezeit ≤ 120 s 3", () => {
    expect(REIN_GUT).toBe(0.9);
    expect(WARTE_GUT_S).toBe(120);
    for (const st of SCHICHTSTUFEN) {
      const s = VERDIENST_SCHWELLE_EUR[st];
      expect(schichtSterne(st, false, s * 10, 1, 0), st).toBe(0);
      expect(schichtSterne(st, true, s - 0.01, 1, 0), st).toBe(1);
      expect(schichtSterne(st, true, s, 0.89, 0), st).toBe(2);
      expect(schichtSterne(st, true, s, REIN_GUT, WARTE_GUT_S), st).toBe(3);
      expect(schichtSterne(st, true, s, REIN_GUT, WARTE_GUT_S + 0.01), st).toBe(2);
      expect(schichtSterne(st, true, s, REIN_GUT - 0.0001, 0), st).toBe(2);
    }
  });

  it("die Kasse vergibt sie aus ihrer eigenen Bilanz", () => {
    const k = neueKasse("montag");
    // 20 t Stahl sortenrein = 5 000 € genau
    k.bucheAbfahrt("steel", [teil("steel", 20000)]);
    expect(k.bilanz(true).sterne).toBe(3);
    k.bucheStandgeld(WARTE_GUT_S + 1); // kostet 121 € → unter der Schwelle
    expect(k.bilanz(true).sterne).toBe(1);
    expect(k.bilanz(false).sterne).toBe(0);
  });
});

/* -------------------------------------------- Die Schwellen und die Musterfuhre */

/**
 * Eine Musterfuhre von 8 t im Platzmix, gemessen am 21.10.2026 mit
 * `randomCargo(85, 0.12)` über 96 Saaten: Masseanteil in % und mittleres
 * Stückgewicht in kg (Herleitung bei `VERDIENST_SCHWELLE_EUR`).
 */
const PLATZMIX: Array<[string, number, number]> = [
  ["mixed", 55.0, 139],
  ["steel", 28.6, 166],
  ["alu", 4.4, 70],
  ["rubble", 2.9, 179],
  ["battery", 2.1, 121],
  ["wood", 1.5, 113],
  ["plastic", 1.0, 78],
  ["brass", 1.0, 70],
  ["va", 0.9, 50],
  ["tires", 0.8, 58],
  ["cable", 0.7, 47],
  ["zinc", 0.6, 48],
  ["copper", 0.6, 33],
];
function musterfuhre(): KassenTeil[] {
  const out: KassenTeil[] = [];
  for (const [id, prozent, stk] of PLATZMIX) {
    const kg = (8000 * prozent) / 100;
    const n = Math.max(1, Math.round(kg / stk));
    for (let i = 0; i < n; i++) out.push(teil(id, kg / n));
  }
  return out;
}
/** Wer bekommt welches Teil, wenn sauber sortiert wird (Schicht-Boxen: Stahl, BUNT + VA, Müll). */
function sorteFuer(id: string): string {
  if (id === "mixed" || id === "steel") return id;
  if (["rubble", "wood", "plastic", "tires"].includes(id)) return "rubble";
  return "copper";
}

describe("Die Geldschwellen liegen zwischen „alles auf Misch“ und „sauber sortiert“", () => {
  const FUHREN: Record<Schichtstufe, [number, number]> = {
    montag: [3, 3],
    mittwoch: [4, 4],
    freitag: [5, 6], // S2: 5–6 Fuhren
  };

  it("je Stufe: alles Misch (meiste Fuhren) < Schwelle < sortiert mit Lager zu 70 % (wenigste Fuhren)", () => {
    for (const st of SCHICHTSTUFEN) {
      const [wenig, viel] = FUHREN[st];
      // alles auf den Misch-Verlader, mit Fehlwürfen für den Müll
      const faul = neueKasse(st);
      for (let f = 0; f < viel; f++) faul.bucheAbfahrt("mixed", musterfuhre());
      const faulEur = faul.bilanz(true).verdienstEur;
      // sauber sortiert; Misch fährt ab, alles Sortierte bleibt (schlechtester Fall) im Lager
      const fleissig = neueKasse(st);
      const boxen = new Map<string, KassenTeil[]>();
      for (let f = 0; f < wenig; f++) {
        const fuhre = musterfuhre();
        fleissig.bucheAbfahrt("mixed", fuhre.filter((t) => t.materialId === "mixed"));
        for (const t of fuhre.filter((t) => t.materialId !== "mixed")) {
          const o = sorteFuer(t.materialId);
          boxen.set(o, [...(boxen.get(o) ?? []), t]);
        }
      }
      const fleissigBilanz = fleissig.bilanz(true, [...boxen].map(([order, teile]) => ({ order, teile })));
      expect(fleissigBilanz.fehlwurfEur, "sauber sortiert hat keine Fehlwürfe").toBe(0);
      const schwelle = VERDIENST_SCHWELLE_EUR[st];
      expect(faulEur, `${st}: alles Misch bringt schon die Schwelle`).toBeLessThan(schwelle);
      expect(fleissigBilanz.verdienstEur, `${st}: sauber sortiert erreicht die Schwelle nicht`).toBeGreaterThan(schwelle);
    }
  });

  it("Beispielrechnung einer Fuhre: sauber sortiert und abgefahren gut 2,5-mal so viel wie alles auf Misch", () => {
    const faul = neueKasse();
    const b1 = faul.bucheAbfahrt("mixed", musterfuhre());
    const faulEur = faul.bilanz(true).verdienstEur;
    const sauber = neueKasse();
    const nachSorte = new Map<string, KassenTeil[]>();
    for (const t of musterfuhre()) {
      const o = sorteFuer(t.materialId);
      nachSorte.set(o, [...(nachSorte.get(o) ?? []), t]);
    }
    for (const [o, teile] of nachSorte) sauber.bucheAbfahrt(o, teile);
    const s = sauber.bilanz(true);
    expect(b1.fehlwuerfe).toBe(4); // je ein Teil Bauschutt, Holz, Kunststoff, Reifen
    expect(s.sortierquote).toBe(1);
    expect(s.verdienstEur / faulEur).toBeGreaterThan(2.5);
    expect(s.verdienstEur / faulEur).toBeLessThan(3);
  });
});

/* --------------------------------------------------------- Stufen, Liste, Reinheit */

describe("Stufen und Bestenliste", () => {
  it("SCHICHTSTUFEN in Reihenfolge, freigeschaltet ab einem Stern der vorigen", () => {
    expect(SCHICHTSTUFEN).toEqual(["montag", "mittwoch", "freitag"]);
    expect(stufeFrei("montag", {})).toBe(true);
    expect(stufeFrei("mittwoch", {})).toBe(false);
    expect(stufeFrei("mittwoch", { montag: 0 })).toBe(false);
    expect(stufeFrei("mittwoch", { montag: 1 })).toBe(true);
    expect(stufeFrei("freitag", { montag: 3 })).toBe(false);
    expect(stufeFrei("freitag", { montag: 3, mittwoch: 1 })).toBe(true);
  });

  it("Datenform für die Bestenliste: ganze Euro, Tonnen, Quote in Basispunkten, Sekunden, Datum", () => {
    const k = neueKasse("mittwoch");
    k.bucheAbfahrt("mixed", [teil("mixed", 9000), teil("steel", 1234)]);
    k.bucheStandgeld(61.6);
    const lauf = schichtLauf(k.bilanz(true), new Date(2026, 9, 21, 16, 0));
    expect(lauf).toEqual({
      stufe: "mittwoch",
      verdienstEur: 1576, // 1 637,44 − 61,60 = 1 575,84
      tonnen: 10.2,
      quoteBp: 8794, // 9 000 / 10 234
      warteS: 62,
      sterne: 1,
      datum: "2026-10-21",
    });
  });

  it("kasse.ts ist reine Logik: kein three.js, kein Rapier, kein DOM, keine Welt", () => {
    const wurzel = resolve(__dirname, "..");
    for (const p of ["src/economy/kasse.ts", "src/economy/shift.ts", "src/materials/catalog.ts"]) {
      const q = readFileSync(resolve(wurzel, p), "utf8");
      const importe = q.match(/^import .*$/gm) ?? [];
      for (const z of importe) {
        expect(z, p).not.toMatch(/three|rapier|\/world\/|\/ui\/|\/core\//);
      }
      expect(q.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""), p).not.toMatch(/\bdocument\.|\bwindow\./);
    }
  });
});
