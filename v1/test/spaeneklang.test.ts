import { describe, it, expect } from "vitest";
import { aufprallKlang, FAMILIEN } from "../src/audio/klangregeln";

/** E-147: Späneknäuel rascheln wie Draht, nicht wie Blech. */
describe("Späne-Aufprall", () => {
  // Tonhoehe und Daempfung skalieren die Teiltoene; die Verhaeltnisse bleiben die der Familie
  const form = (t: number[]): string => t.map((f) => (f / t[0]!).toFixed(3)).join(",");
  it("nimmt die Kabel-Familie statt Blech", () => {
    const e = { materialId: "mixed", massKg: 14, wucht: 4, blech: true, untergrund: "beton" as const };
    const span = aufprallKlang({ ...e, spaene: true })!;
    const blech = aufprallKlang(e)!;
    expect(form(span.teil.teiltoene)).toBe(form(FAMILIEN["kabel"]!.teiltoene));
    expect(form(blech.teil.teiltoene)).not.toBe(form(span.teil.teiltoene));
  });
});
