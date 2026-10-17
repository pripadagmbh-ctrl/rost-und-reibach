/**
 * WAECHTER E-152 (b): Was den Bagger bei schweren Teilen bremst, soll echt
 * sein — nicht kuenstlich.
 *
 * Patrick, 17.10.2026: „extrem schwere bzw. grosse objekte … verlangsamen den
 * bagger unnatürlich". Gemessen mit `tools/lastbremse-kern.ts` (echter
 * Bagger, Fuenfschalengreifer, 2,2-t-Container als nackter Quader, damit
 * jeder Lauf gleich ist), vorher (Stand aa77cbd) → nachher:
 *
 *   Lage          Schwenk °/s    Anlauf s     Heben 1 s     geschoben
 *   leer          30,7 → 30,7    0,28 → 0,28  1,79 → 1,79
 *   1 t           29,4 → 29,4    0,32 → 0,32  1,70 → 1,70
 *   3 t           27,0 → 27,0    0,38 → 0,38  1,53 → 0,00 (Ueberlast bei 8 m, E-152)
 *   auf Container 30,7 → 30,7    0,28 → 0,28  1,77 → 1,77
 *   seitlich rein 27,5 → 28,0                               3,74 → 1,88 m
 *
 * Die Last-Rechnung (`tempoFaktor`/`anlaufZeit`) ist echt und bleibt: Eine
 * 20-t-Maschine wird mit 3 t etwas traeger, nicht zaeh.
 */
import { describe, it, expect } from "vitest";
import { messeBremse } from "../tools/lastbremse-kern";

describe("E-152 — Last bremst wie echt, Brocken bremsen nicht kuenstlich", () => {
  it("3 t in der Spinne: Schwenk hoechstens 15 % langsamer, Anlauf unter 0,45 s", async () => {
    const leer = await messeBremse("leer");
    const last = await messeBremse("3t");
    expect(last.schwenkGradS).toBeGreaterThan(0.85 * leer.schwenkGradS);
    expect(last.anlaufS).toBeLessThan(0.45);
    expect(last.pflugMin, "eine Last in der Spinne ist kein Pflugmaterial").toBe(1);
  }, 120_000);

  it("auf einem 2,2-t-Container aufgesetzt: Schwenken und Abheben ungebremst", async () => {
    const leer = await messeBremse("leer");
    const m = await messeBremse("anliegend");
    expect(m.schwenkGradS).toBeGreaterThan(0.9 * leer.schwenkGradS);
    expect(m.hebenM).toBeGreaterThan(0.9 * leer.hebenM);
  }, 120_000);

  it("seitlich in einen 2,2-t-Container geschwenkt: er wird nicht mehr meterweit geschoben", async () => {
    const m = await messeBremse("seitlich");
    expect(m.geschobenM, "vorher 3,74 m").toBeLessThan(2.5);
  }, 120_000);
});
