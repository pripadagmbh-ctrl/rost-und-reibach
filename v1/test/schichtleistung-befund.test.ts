/**
 * S5 — BEFUND S5-1: Freitag Saat 3 — Verlader und Nachrücker hängen fest.
 *
 * Gemessen 21.10.2026 (`tools/schicht-lauf.ts` mit SAAT=3, Test-Fahrer
 * 1 Teil/4 s): Der volle Verlader fährt um 343 s los und bleibt bei
 * (−10,0 | −5,9) in "out" stehen; der Nachrücker (für Kupfer) steht ab
 * ~355 s in "approach" bei (−4,1 | 2,3), die Kupfer-Pritsche am Lager kommt
 * später nicht weg ("ausfaedeln" bei (−18,0 | −3,4)). Bis Feierabend bewegt
 * sich keiner mehr (254 s Stillstand).
 *
 * URSACHE (S2b, 21.10.2026, Lagen und Wartegründe protokolliert): Die
 * Ausfahrt des Verladers streifte die Pritsche am KUPFER-LAGER um 0,72 m. Er
 * nahm das Tor, wartete auf die Pritsche (die auf den Bagger), und als sie
 * leer hinauswollte, wartete sie aufs Tor — beide bis Feierabend; der
 * Nachrücker stand nur dahinter. Behoben in `routes.verladerVornAusfahrt`
 * (Weg um jede Pritsche am Lager) und `VehicleManager.torFuer` (wer das Tor
 * hält, aber auf den Fragenden wartet, gibt es ab). Seit E-202 Nachtrag S5-1
 * ein Wächter; `tools/schicht-stau.ts` fährt zehn Saaten. Eigene Datei, weil
 * der Stau nur auf frischem Modulzustand kam (nach einem anderen Lauf in
 * derselben Datei verlief Saat 3 anders: 17 s Stillstand).
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { initPhysics } from "../src/physics/physicsWorld";
import { setzeSchichtPlatzZurueck } from "../src/world/schichtplatz";
import { setBuildingObstacles } from "../src/world/obstacles";
import { festerZufall, leistungsLauf, LEISTUNGS_SCHRANKEN } from "./schichtlauf";

beforeAll(async () => {
  await initPhysics();
});
afterEach(() => {
  setzeSchichtPlatzZurueck();
  setBuildingObstacles([]);
});

describe("S5 — BEFUND S5-1: Freitag Saat 3 hängt nicht mehr", () => {
  it("kein Laster steckt > 60 s fest — Saat 3", { timeout: 600_000 }, () => {
    const zurueck = festerZufall(3 * 7919 + 13);
    try {
      // Bis 420 s reicht: Der Stau beginnt bei ~350 s
      const b = leistungsLauf({ stufe: "freitag", saat: 3, griffS: 4, sekunden: 420, ruheS: 0 });
      console.log(`Saat 3: längster Stillstand ${b.laengsterStand.toFixed(0)} s — ${b.wer}`);
      expect(b.laengsterStand).toBeLessThan(LEISTUNGS_SCHRANKEN.stillstandS);
    } finally {
      zurueck();
    }
  });
});
