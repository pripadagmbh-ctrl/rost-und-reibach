/**
 * Waechter fuer die Pause der Challenges (E-129).
 *
 * Patrick am Geraet, 16.10.2026: "Und die Challenges sind noch nicht
 * ausgereift, pausieren". Pausiert heisst: Das Spiel startet direkt im
 * Sandkasten, ohne Menue und ohne Challenge — und zwar auch dann, wenn die
 * Ablage leer ist (erster Start) oder die Adresse eine Challenge verlangt
 * (NOCHMAL aus E-125). Geloescht ist nichts: Die Wächter in challenge.test.ts
 * pruefen Rahmen, Katalog und Wertung weiter.
 */
import { describe, it, expect } from "vitest";
import { CHALLENGES_PAUSIERT } from "../src/core/spielart";
import { waehleSpielart } from "../src/ui/hauptmenue";

describe("Challenges pausiert", () => {
  it("der Schalter steht auf Pause", () => {
    expect(CHALLENGES_PAUSIERT).toBe(true);
  });

  it("das Spiel startet direkt im Sandkasten, ohne Menue und ohne Challenge", async () => {
    // Kein document, keine Ablage, keine Adresse: Wer pausiert, fragt nichts davon.
    await expect(waehleSpielart()).resolves.toEqual({ art: "sandkasten" });
  });
});
