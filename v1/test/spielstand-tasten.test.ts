import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * P4b (Orchestrator 22.10.2026, qa-Befund 41-P4a/1): In Schicht und Woche
 * wirken weder K (Speichern) noch N (Neues Spiel) — eine Schicht ist ein Lauf,
 * kein Spielstand (`core/spielart.ts`). Vorher prüfte main.ts nur
 * `!aufgabenPlatz`: K schrieb den Schichtplatz als Stand, N löschte den
 * Sandkasten-Stand.
 */
const main = readFileSync(resolve(__dirname, "../src/main.ts"), "utf8");

describe("K und N nur im Sandkasten", () => {
  it("eine Bedingung für beide Tasten, ohne Aufgabe und ohne Schicht", () => {
    expect(main).toMatch(/const spielstandErlaubt = !aufgabenPlatz && !schichtStufe/);
    expect(main).toContain('spielstandErlaubt && input.wasPressed("KeyK")');
    expect(main).toContain('spielstandErlaubt && input.wasPressed("KeyN")');
  });

  it("Gegenprobe: keine Taste K/N mehr hinter der alten Bedingung", () => {
    expect(main).not.toMatch(/!aufgabenPlatz && input\.wasPressed\("Key[KN]"\)/);
  });
});
