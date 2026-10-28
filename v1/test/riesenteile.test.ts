/**
 * RIESENTEILE ÜBERALL GEDECKELT (45c, Patrick 22.10.2026: „höchstens 2×
 * Katalog-Gewicht", Konzept Fassung 3).
 *
 * Befund vorher (gemessen, `tools/riesenteile.ts`): Ein Cateringwagen-Aufbau
 * (Katalog 300 kg) kam mit 9 500 kg als EINZIGES Teil einer Kipperfuhre; im
 * Mittel trug jedes Teil das 5,7-Fache seines Katalog-Gewichts, das schwerste
 * das 38-Fache. Jetzt höchstens das Doppelte, und fehlt dann Masse, legt der
 * Kunde Teile nach.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { initPhysics } from "../src/physics/physicsWorld";
import { rollAnlieferung, rollSchichtKunde, vehicleForCustomer, type CustomerProfile } from "../src/delivery/customers";
import { KATALOG_FAKTOR_MAX } from "../src/delivery/vehicles";
import { katalogKg, beladeFuhre } from "./riesenteile-hilfe";

beforeAll(async () => {
  await initPhysics();
});

/**
 * Weniger Teile hat eine Kipperfuhre nie. SW aus der Messung: Unter 200
 * Montags-Kippern nach dem Deckel brachte der kleinste 5 Teile (vorher 1: der
 * Befund); 4 lässt dem Würfel einen Teil Luft und verbietet „ein Teil allein".
 */
const KIPPER_TEILE_MIN = 4;

function kunden(n: number, art: "schicht" | "sandkasten"): CustomerProfile[] {
  const echt = Math.random;
  let z = 4242;
  Math.random = () => {
    z = (z * 1664525 + 1013904223) >>> 0;
    return z / 4294967296;
  };
  try {
    const out: CustomerProfile[] = [];
    while (out.length < n) {
      const c = art === "schicht" ? rollSchichtKunde("kipper") : rollAnlieferung();
      if (vehicleForCustomer(c) !== "wrack") out.push(c);
    }
    return out;
  } finally {
    Math.random = echt;
  }
}

describe("Kein Teil wiegt mehr als das Doppelte seines Katalog-Gewichts", () => {
  for (const art of ["schicht", "sandkasten"] as const) {
    it(`${art}: jedes Teil auf der Fläche ≤ ${KATALOG_FAKTOR_MAX}× Katalog, die Waage sagt dasselbe`, () => {
      let teileGesamt = 0;
      kunden(40, art).forEach((c, i) => {
        const teile = beladeFuhre(c, 100 + i);
        for (const it of teile) {
          const k = katalogKg(it);
          // Gegenprobe gegen einen leeren Wächter: Jedes Teil muss im Katalog stehen
          expect(k, `${it.shape?.name} [${it.materialId}] ohne Katalog-Gewicht`).not.toBeNull();
          expect(it.massKg, `${it.shape?.name}: ${it.massKg} kg bei Katalog ${k} kg`).toBeLessThanOrEqual(
            KATALOG_FAKTOR_MAX * k! + 1
          );
        }
        // Was liegt, ist was angekündigt wird (die Waage zeigt es, E-044)
        const kg = teile.reduce((a, it) => a + it.massKg, 0);
        expect(Math.abs(kg - c.massKg), `Fuhre ${i}: ${kg} kg auf der Fläche, ${c.massKg} kg angekündigt`).toBeLessThan(
          teile.length + 1
        );
        teileGesamt += teile.length;
      });
      expect(teileGesamt).toBeGreaterThan(40);
    }, 120000);
  }

  it("Gegenprobe: ein Teil mit dreifachem Katalog-Gewicht fällt auf", () => {
    const it0 = { shape: { name: "Cateringwagen-Aufbau", kind: "box", dims: [1.7, 1.9, 2.4], color: 0 } } as Parameters<typeof katalogKg>[0];
    const k = katalogKg(it0);
    expect(k).toBe(300);
    expect(3 * k! > KATALOG_FAKTOR_MAX * k! + 1).toBe(true);
  });
});

describe("Eine Kipperfuhre ist eine Fuhre, kein Einzelteil", () => {
  it(`Montags-Kipper: mindestens ${KIPPER_TEILE_MIN} Teile, und Mischschrott ist dabei`, () => {
    let mitMisch = 0;
    const cs = kunden(40, "schicht");
    cs.forEach((c, i) => {
      const teile = beladeFuhre(c, 300 + i);
      expect(teile.length, `Fuhre ${i}: ${teile.map((t) => t.shape?.name).join(", ")}`).toBeGreaterThanOrEqual(
        KIPPER_TEILE_MIN
      );
      if (teile.some((t) => t.materialId === "mixed")) mitMisch++;
    });
    // Vorher 5 von 200 ohne jeden Misch, nachher 0 von 200 (gemessen)
    expect(mitMisch, `${mitMisch} von ${cs.length} mit Mischschrott`).toBe(cs.length);
  }, 120000);
});

/**
 * W0c — WIEDER MEHR AUF DER FLÄCHE (Patrick 22.10.2026: „mehr Teile je Fuhre,
 * bis wieder etwa 6–8 t drauf sind"; Nachtrag W0c zu E-210). Der Kunde lädt je
 * Sorte das Schwere (`vehicles.SCHWER_WAHL`). Gemessen 200 Montags-Kipper
 * (`tools/riesenteile.ts`): Mittel 3,35 → 4,85 t, Misch-Anteil der Masse
 * (Median) 39 → 53 %. Die Schranken liegen unter dem Gemessenen (SW: Rand für
 * den Würfel) und über dem Stand vor W0c — fällt die Wahl weg, reißen beide.
 */
const KIPPER_MITTEL_MIN_KG = 4_200;
const KIPPER_MISCH_MIN = 0.45;

describe("W0c — der Montags-Kipper bringt wieder Gewicht, und Misch trägt es mit", () => {
  it(`im Mittel ≥ ${KIPPER_MITTEL_MIN_KG} kg je Fuhre, Misch ≥ ${KIPPER_MISCH_MIN * 100} % der Masse`, () => {
    let kg = 0;
    let misch = 0;
    const cs = kunden(40, "schicht");
    cs.forEach((c, i) => {
      for (const t of beladeFuhre(c, 500 + i)) {
        kg += t.massKg;
        if (t.materialId === "mixed") misch += t.massKg;
      }
    });
    console.log(`[W0c] 40 Montags-Kipper: Mittel ${(kg / cs.length).toFixed(0)} kg, Misch ${((misch / kg) * 100).toFixed(1)} % der Masse`);
    expect(kg / cs.length).toBeGreaterThanOrEqual(KIPPER_MITTEL_MIN_KG);
    expect(misch / kg).toBeGreaterThanOrEqual(KIPPER_MISCH_MIN);
  }, 120000);
});
