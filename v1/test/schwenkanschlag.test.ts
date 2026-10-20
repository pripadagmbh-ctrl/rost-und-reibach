/**
 * E-189 — Patrick, 20.10.2026: „… jeweils die außenwände der ausbuchtung etwas
 * angeschrägt sein, sodass man beim schwenken nicht immer anschlägt".
 *
 * Die offene Spinne (Halbmesser 1,51 m) schwenkt einmal ganz herum, in jeder
 * Ausladung bis zum Rand des Schwenkbands (9,2 m) und in jeder Höhe unter der
 * Mauerkrone — und berührt dabei keine Mauer der Bucht und keine Südmauer.
 * Vorher (gemessen mit `tools/schwenkanschlag.ts`): westlich ab 8,0 m, östlich
 * ab 9,0 m; mit der schrägen Mauer aus E-182 schon ab 7,0 m.
 */
import { describe, it, expect } from "vitest";
import { anschlaege } from "../tools/schwenkanschlag";
import { BUCHT_FASE_WEST, BUCHT_FASE_OST, BUCHT_X_VON, BUCHT_X_BIS, BUCHT_Z, YARD_D } from "../src/world/yard";
import { CONFIGS } from "../src/world/containers";
import { SCHWENK_AUSSEN } from "../src/world/baggerstand";

describe("Schwenken an der Bucht (E-189)", () => {
  for (const a of [6, 7, 8, 8.5, 9, SCHWENK_AUSSEN]) {
    it(`frei bei ${a} m Ausladung, in 1, 3 und 4,5 m Höhe`, () => {
      for (const h of [1, 3, 4.5]) expect(anschlaege(a, h), `${a} m · ${h} m`).toEqual([]);
    });
  }

  it("Gegenprobe: knapp über das Band hinaus schlägt sie an der Ecke an — der Wächter misst etwas", () => {
    expect(anschlaege(10.5, 3).length).toBeGreaterThan(0);
  });

  it("die Bucht ist nicht kleiner geworden: Halden wie vor E-182, Fasen außerhalb der Schenkel", () => {
    const misch = CONFIGS.find((c) => c.id === "c_mixed")!;
    const stahl = CONFIGS.find((c) => c.id === "c_steel")!;
    expect([misch.x, misch.size[0], stahl.x, stahl.size[0]]).toEqual([-3.0, 6.8, 4.0, 6.8]);
    expect([BUCHT_X_VON, BUCHT_X_BIS, BUCHT_Z]).toEqual([-6.5, 7.5, -35.5]);
    // Die Fasen enden auf der Südmauerachse außerhalb der alten Ecken
    expect(BUCHT_FASE_WEST).toBeGreaterThan(0);
    expect(BUCHT_FASE_OST).toBeGreaterThan(0);
    expect(-YARD_D / 2 - BUCHT_FASE_WEST).toBeGreaterThan(BUCHT_Z);
  });
});
