/**
 * Waechter: gehaltener Schrott schlaegt auf (E-134, 17.10.2026).
 *
 * Patrick: „schrott krach auch wenn ich mit der spinne schrott auf den boden
 * haue ohne loszulassen". Erkannt wird der Einschlag, nicht das Aufliegen —
 * und es bleibt nichts stehen (E-130).
 */
import { describe, it, expect } from "vitest";
import { Aufschlagmelder, AUFSCHLAG_AB_MS, AUFSCHLAG_FREI_S } from "../src/excavator/aufschlag";
import { aufprallKlang, lastAufschlagWucht, SCHLAG_AB_MS } from "../src/audio/klangregeln";
import { messe } from "../tools/lastaufschlag-kern";

const DT = 1 / 60;

/** Ein Ablauf aus (Kontakt, Senktempo) je Bild; liefert alle Aufschlaege. */
function lauf(bilder: Array<[boolean, number]>): number[] {
  const m = new Aufschlagmelder();
  const r: number[] = [];
  for (const [k, v] of bilder) {
    const t = m.schritt(DT, k, v);
    if (t !== null) r.push(t);
  }
  return r;
}
const frei = (n: number, v: number): Array<[boolean, number]> => Array.from({ length: n }, () => [false, v]);
const auf = (n: number): Array<[boolean, number]> => Array.from({ length: n }, () => [true, 0]);

describe("Aufschlagmelder (E-134)", () => {
  it("schnell aufgeschlagen → genau ein Schlag, aufgesetzt halten → kein weiterer", () => {
    expect(lauf([...frei(30, 2.5), [true, 2.5], ...auf(180)])).toEqual([2.5]);
  });

  it("langsames Absetzen → kein Krach", () => {
    expect(lauf([...frei(60, AUFSCHLAG_AB_MS * 0.5), [true, AUFSCHLAG_AB_MS * 0.5], ...auf(60)])).toEqual([]);
  });

  it("anheben und wieder draufhauen → noch einer; kurzes Flackern → keiner", () => {
    const flackern = Math.floor((AUFSCHLAG_FREI_S / DT) * 0.5);
    expect(
      lauf([...frei(30, 2), [true, 2], ...auf(30), ...frei(flackern, 2), [true, 2], ...auf(30), ...frei(30, 2), [true, 2]])
    ).toHaveLength(2);
  });

  it("wer im Kontakt anfaengt, hat nicht aufgeschlagen", () => {
    expect(lauf([[true, 3], ...auf(10)])).toEqual([]);
  });

  it("was erkannt wird, bekommt einen eigenen Schlag (kein Rasseln)", () => {
    expect(lastAufschlagWucht(AUFSCHLAG_AB_MS)).toBeGreaterThanOrEqual(SCHLAG_AB_MS);
    const r = aufprallKlang({ materialId: "steel", massKg: 180, wucht: lastAufschlagWucht(AUFSCHLAG_AB_MS), blech: false, untergrund: "beton" });
    expect(r).not.toBeNull();
    expect(lastAufschlagWucht(3)).toBeGreaterThan(lastAufschlagWucht(1));
  });
});

describe("am echten Bagger (tools/lastaufschlag-kern.ts)", () => {
  it("draufhauen: einer; 2 s aufgedrueckt: keiner mehr; behutsam: keiner; auf Schrott: einer, als Schrott", async () => {
    const l = await messe();
    const s = l.szenen;
    expect(s["A voll auf Beton, 2 s halten"]!.schlaege).toHaveLength(1);
    expect(s["A voll auf Beton, 2 s halten"]!.schlaege[0]!.aufSchrott).toBe(false);
    expect(s["B behutsam absetzen"]!.schlaege).toHaveLength(0);
    expect(s["B2 nur Ausleger gesenkt"]!.schlaege).toHaveLength(1);
    expect(s["C voll auf losen Schrott"]!.schlaege).toHaveLength(1);
    expect(s["C voll auf losen Schrott"]!.schlaege[0]!.aufSchrott).toBe(true);
  }, 60_000);
});
