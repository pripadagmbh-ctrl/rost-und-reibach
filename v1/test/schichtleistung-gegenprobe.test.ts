/**
 * S5 — GEGENPROBE zum Leistungs-Wächter: Misst er etwas?
 *
 * Derselbe Freitag (Saat 1), aber jede Fuhre des Fahrplans kommt zweimal
 * (`leistungsLauf({ doppelt })` meldet jede fällige Fahrt doppelt an — Fuhren
 * selbst bleiben ~8 t, wie Patrick es will). Erwartet: Die Körperzahl liegt
 * nachweislich über allem, was einfache Läufe erreichen (S5: höchstens 124,
 * Saaten 1–5). Die Annahme macht ab 10 t losem Schrott zu (E-202) — deshalb
 * wird es nicht doppelt so viel, sondern gedeckelt mehr.
 *
 * Der Befund S5-1 (Saat 3 hängt) steht in `schichtleistung-befund.test.ts`.
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { initPhysics } from "../src/physics/physicsWorld";
import { setzeSchichtPlatzZurueck } from "../src/world/schichtplatz";
import { setBuildingObstacles } from "../src/world/obstacles";
import { freitagLauf } from "./schichtlauf";

beforeAll(async () => {
  await initPhysics();
});
afterEach(() => {
  setzeSchichtPlatzZurueck();
  setBuildingObstacles([]);
});

/** Höchststand der einfachen Freitage, S5 gemessen (Saaten 1–5, 1 Teil/4 s). */
const EINFACH_KOERPER_MAX = 124;
const EINFACH_BEWEGLICH_MAX = 87;

describe("S5 — Gegenprobe: doppelter Fahrplan", () => {
  it("Körper und bewegliche Körper steigen nachweislich über jeden einfachen Freitag", { timeout: 600_000 }, () => {
    const b = freitagLauf(1, 4, true);
    expect(b.fuhren, "es kamen nicht mehr Fuhren als einfach (6)").toBeGreaterThan(6);
    expect(b.koerperMax).toBeGreaterThanOrEqual(EINFACH_KOERPER_MAX + 10); // gemessen 139
    expect(b.dynMax).toBeGreaterThanOrEqual(EINFACH_BEWEGLICH_MAX + 10); // gemessen 107
  });
});
