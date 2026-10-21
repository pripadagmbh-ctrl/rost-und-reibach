/**
 * S5 — LEISTUNGS-WÄCHTER DER SCHICHT, Freitag Saat 5 (zweite feste Saat).
 * Wie `schichtleistung.test.ts`; eigene Datei, damit Vitest beide Läufe
 * parallel fährt. Schranken und Herkunft: `LEISTUNGS_SCHRANKEN`.
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { initPhysics } from "../src/physics/physicsWorld";
import { setzeSchichtPlatzZurueck } from "../src/world/schichtplatz";
import { setBuildingObstacles } from "../src/world/obstacles";
import { freitagLauf, leistungsVerstoesse } from "./schichtlauf";

beforeAll(async () => {
  await initPhysics();
});
afterEach(() => {
  setzeSchichtPlatzZurueck();
  setBuildingObstacles([]);
});

describe("S5 — Freitag, volle Welle, Saat 5", () => {
  it("Körper ≤ 160, beweglich ≤ 110, Haufen schläft, keiner steckt fest, Feierabend, Verlader fährt", { timeout: 600_000 }, () => {
    const b = freitagLauf(5);
    expect(leistungsVerstoesse(b)).toEqual([]);
    expect(b.koerperMax - b.koerperStart).toBeGreaterThanOrEqual(40); // gemessen +86
  });
});
