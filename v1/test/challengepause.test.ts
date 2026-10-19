/**
 * Waechter fuer den Schalter der Aufgaben (E-129 pausiert, E-162 wieder an).
 *
 * Patrick, 19.10.2026: Version 1.0 = Aufgaben + Sandkasten, und „erster Start
 * direkt in Aufgabe 1 (ohne Menü, danach Menü)". Der Schalter steht darum
 * wieder auf `false`, und ein Geraet ohne Ablage landet in `CHALLENGES[0]`.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { CHALLENGES_PAUSIERT } from "../src/core/spielart";
import { waehleSpielart } from "../src/ui/hauptmenue";
import { CHALLENGES } from "../src/challenges/katalog";

afterEach(() => vi.unstubAllGlobals());

describe("Aufgaben sind an (E-162)", () => {
  it("der Schalter steht nicht mehr auf Pause", () => {
    expect(CHALLENGES_PAUSIERT).toBe(false);
  });

  it("erster Start (leere Ablage, keine Adresse) geht ohne Menue direkt in Aufgabe 1", async () => {
    vi.stubGlobal("location", { hash: "", pathname: "/", search: "" });
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
    await expect(waehleSpielart()).resolves.toEqual({ art: "challenge", id: CHALLENGES[0]!.id });
    expect(CHALLENGES[0]!.id).toBe("erster-griff");
  });
});
