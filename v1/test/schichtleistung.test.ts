/**
 * S5 — LEISTUNGS-WÄCHTER DER SCHICHT, Freitag Saat 1 (Auftrag S5, E-202).
 *
 * Patrick, über den Orchestrator: „Fuhrengröße wie heute (~8 t) — miss die
 * Leistung auf dem Weg zum iPhone mini (Körperzahl/Physik-ms bei voller
 * Freitag-Welle) besonders sorgfältig."
 *
 * Eine ganze Freitagsschicht mit echter Physik und dem Test-Fahrer
 * (`test/schichtlauf.ts`, derselbe Prüfstand wie `tools/schicht-lauf.ts`).
 * Schranken und Herkunft: `LEISTUNGS_SCHRANKEN`. Physik-ms ist rechnerabhängig
 * und deshalb KEINE Schranke — es wird nur ausgegeben.
 *
 * Eine Saat je Datei, damit Vitest die Läufe parallel fährt (je ~60–90 s);
 * Saat 5 in `schichtleistung-saat5.test.ts`, Gegenprobe in
 * `schichtleistung-gegenprobe.test.ts`.
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { initPhysics } from "../src/physics/physicsWorld";
import { setzeSchichtPlatzZurueck } from "../src/world/schichtplatz";
import { setBuildingObstacles } from "../src/world/obstacles";
import { freitagLauf as freitag, leistungsVerstoesse, LEISTUNGS_SCHRANKEN } from "./schichtlauf";

beforeAll(async () => {
  await initPhysics();
});
afterEach(() => {
  setzeSchichtPlatzZurueck();
  setBuildingObstacles([]);
});

describe("S5 — Freitag, volle Welle, Saat 1", () => {
  it("Körper ≤ 160, beweglich ≤ 110, Haufen schläft, keiner steckt fest, Feierabend, Verlader fährt", { timeout: 600_000 }, () => {
    const b = freitag(1);
    expect(leistungsVerstoesse(b)).toEqual([]);
    // Gegenprobe im selben Lauf: Die Zähler sehen die Fuhren und die Bewegung.
    // Ein Zähler, der nichts misst (falsche Welt, nur feste Körper), bestünde
    // jede Obergrenze — er bliebe hier beim Startwert und bei 0 wach stehen.
    expect(b.koerperMax - b.koerperStart, "Körperzahl wächst nicht mit den Fuhren").toBeGreaterThanOrEqual(40); // gemessen +91
    expect(b.wachMax, "wach-Zähler sieht keine Bewegung").toBeGreaterThanOrEqual(4 * LEISTUNGS_SCHRANKEN.wachNachRuhe); // gemessen 40
    expect(b.fuhren).toBeGreaterThanOrEqual(6);
  });
});
