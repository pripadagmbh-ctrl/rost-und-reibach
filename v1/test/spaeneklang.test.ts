import { describe, it, expect } from "vitest";
import { aufprallKlang, FAMILIEN } from "../src/audio/klangregeln";

/** E-147: Späneknäuel rascheln wie Draht, nicht wie Blech. */
describe("Späne-Aufprall", () => {
  it("nimmt die Kabel-Familie statt Blech", () => {
    const e = { materialId: "mixed", massKg: 14, wucht: 4, blech: true, untergrund: "beton" as const };
    const span = aufprallKlang({ ...e, spaene: true })!;
    const blech = aufprallKlang(e)!;
    expect(span.teil).toEqual(FAMILIEN["kabel"]);
    expect(blech.teil).not.toEqual(span.teil);
  });
});
