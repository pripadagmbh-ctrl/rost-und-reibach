/**
 * Waechter E-137 (Patrick, Geraetebefund 17.10.2026, Punkte 3, 8, 9).
 *
 * A „er steigt schrittweise nach oben ohne den ausleger korrigieren zu
 *   können": Wer auf ein Grossteil senkt, darf nie angehoben werden.
 * B „die Zacken bei dem greifer sind zu spitz": abgerundet, Ende und Dicke wie
 *   vorher.
 * C „Hämmern und drücken … Aktuell hört man nichts. … Bremsen kann nur das
 *   material oder den boden die spinne." Kein Bremsen vor dem Kontakt, ein
 *   Ereignis je Schlag, Druecken nur, wenn sich etwas tut.
 * Die Messwerkzeuge: `tools/grossteil-greifen.ts`, `tools/haemmern.ts`.
 */
import { describe, it, expect } from "vitest";
import { ALLE_SPECS, messeGrossteil } from "../tools/grossteil-greifen-kern";
import { haemmere, pfluege } from "../tools/haemmern-kern";
import { ZAHN_STATIONEN } from "../src/fuenfschalen/teile";

describe("A — Grossteile: die Spinne steigt nicht von selbst", () => {
  /*
   * Vorher gemessen (E-137): Rumpfsegment +1,53 m, Gullefass +0,81, Kleinbus
   * +0,48, Baustellencontainer 0 von 5 Griffen — waehrend der Spieler den
   * Ausleger SENKTE. Die Brocken-Sperre setzte die Spitze alle 0,35 s um die
   * Eindringtiefe hoeher.
   */
  for (const name of ["Rumpfsegment", "Güllefass", "Kleinbus", "Baustellencontainer"]) {
    it(`${name}: beim Senken hoechstens 2 cm Anstieg, danach gegriffen und gehoben`, async () => {
      const sp = ALLE_SPECS().find((s) => s.name === name)!;
      const m = await messeGrossteil(sp);
      expect(m.stiegBeimSenken, "Anstieg der Spinne, waehrend gesenkt wird (m)").toBeLessThan(0.02);
      expect(m.gefasst, "gefasst").toBeGreaterThan(0);
      expect(m.gehoben, "gehoben (m)").toBeGreaterThan(1);
    }, 60_000);
  }
});

describe("B — die Zacken sind abgerundet", () => {
  it("breit bis kurz vor dem Ende, das Ende selbst wie vorher (Grabtiefe bleibt)", () => {
    const ende = ZAHN_STATIONEN.at(-1)!;
    expect(ende).toEqual([0.25, 0.62, 0.52]);
    for (const [x, breite] of ZAHN_STATIONEN.slice(0, -1)) {
      // vorher 0,90 bei 0,09 m und 0,76 bei 0,18 m — ein Keil
      expect(breite, `Breite bei ${x} m`).toBeGreaterThanOrEqual(0.84);
    }
  });
});

describe("C — Haemmern und Druecken", () => {
  it("auf Beton: jeder Schlag genau eine Meldung, Druecken bleibt still", async () => {
    const l = await haemmere("beton");
    expect(l.aufschlaege.length).toBe(5);
    expect(l.aufschlaege.every((a) => a.handle === null && a.wucht > 0 && a.wucht <= 1)).toBe(true);
    expect(l.druecken.length, "Druecken auf Beton").toBe(0);
    expect(l.pflugFreiMin).toBe(1);
  }, 60_000);

  it("ueber einem 1,3-t-Grossteil bremst nichts, bevor die Spinne es trifft", async () => {
    /* Vorher: Pflugfaktor 0,28 in der Luft, Aufsetzen mit 0,71 statt 2,25 m/s. */
    const beton = await haemmere("beton", true);
    const l = await haemmere("grossteil", true);
    expect(l.pflugFreiMin, "Pflugfaktor, solange nichts beruehrt wird").toBe(1);
    expect(l.vAufsetzen[0]!, "Tempo beim ersten Aufsetzen (m/s)").toBeGreaterThan(beton.vAufsetzen[0]! * 0.9);
    expect(l.aufschlaege[0]?.handle, "der erste Schlag trifft das Grossteil").toBe(l.zielHandle);
  }, 90_000);

  it("schnelles Haemmern: kein Bild in der Luft, in dem das Senken gesperrt ist", async () => {
    /* Vorher: 32 Bilder bei 8 Bildern Anheben je Schlag (Nachhaltezeit der Bodensperre). */
    const l = await haemmere("beton", false, 8);
    expect(l.gesperrtFrei).toBe(0);
  }, 60_000);

  it("Druecken meldet hoechstens alle 0,25 s und nur auf losen Teilen", async () => {
    const l = await haemmere("grossteil", false);
    for (const d of l.druecken) expect(d.handle).not.toBeNull();
    for (let i = 1; i < l.druecken.length; i++) {
      expect(l.druecken[i]!.bild - l.druecken[i - 1]!.bild).toBeGreaterThanOrEqual(15);
    }
  }, 60_000);

  it("Pfluegen durch den Haufen bremst weiter — Material, das die Spinne beruehrt, zaehlt", async () => {
    /* Vorher 25,3 °/s (Pflug min. 0,51), nachher 27,6 °/s (0,64); frei ~30,5 °/s. */
    const p = await pfluege();
    expect(p.pflugMin).toBeLessThan(0.8);
    expect(p.schwenkGradS).toBeLessThan(29.5);
  }, 60_000);
});
