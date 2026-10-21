/**
 * WARTEN IM KREIS (E-193, Nachtrag S5-1 in E-202): `warteKreis` findet, ob ein
 * Laster über eine Kette auf den Fragenden wartet. E-193 kannte nur das Paar;
 * in der Schicht, Freitag Saat 3, warteten drei im Kreis (alter Verlader →
 * Pritsche am Lager → Nachrücker → alter Verlader) bis Feierabend.
 */
import { describe, it, expect } from "vitest";
import { warteKreis } from "../src/delivery/vehicles";

describe("warteKreis", () => {
  it("Paar: B wartet auf A → Kreis [B]", () => {
    expect(warteKreis(new Map([["B", "A"]]), "A", "B")).toEqual(["B"]);
  });

  it("drei wie in S5-1: Verlader wartet auf Pritsche, Pritsche auf Nachrücker, Nachrücker auf Verlader", () => {
    const w = new Map([
      ["verlader", "pritsche"],
      ["pritsche", "nachruecker"],
      ["nachruecker", "verlader"],
    ]);
    expect(warteKreis(w, "verlader", "pritsche")).toEqual(["pritsche", "nachruecker"]);
    expect(warteKreis(w, "pritsche", "nachruecker")).toEqual(["nachruecker", "verlader"]);
  });

  it("Kette ohne Rückweg ist kein Kreis — der vorn fährt ja", () => {
    expect(warteKreis(new Map([["B", "C"]]), "A", "B")).toBeNull();
    expect(warteKreis(new Map<string, string>(), "A", "B")).toBeNull();
  });

  it("ein Kreis, an dem der Fragende nicht hängt, hält die Suche nicht fest", () => {
    const w = new Map([
      ["B", "C"],
      ["C", "B"],
    ]);
    expect(warteKreis(w, "A", "B")).toBeNull();
  });
});
