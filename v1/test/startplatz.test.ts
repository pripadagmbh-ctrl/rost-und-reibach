/**
 * Wächter für den Anfangszustand des Platzes.
 *
 * Ansage 13.09.2026: „achtet darauf, dass kein Schrott am Anfang in der Presse
 * liegt." Er lag dort, seit die Presse morgens in die Ecke gezogen ist: Der
 * Starthaufen stand auf (6,0 | −24,0) mit 2,9 m Streuung, also von z −26,9 bis
 * −21,1, und die Kammer geht von −28,2 bis −23,8. Gut die Hälfte des Haufens
 * lag darin, ein Altfahrzeug mit (8,0 | −26,0) mittendrin.
 *
 * Auffallen musste das im Spiel — im Quelltext stehen an beiden Stellen nur
 * Zahlen, und die eine bewegt sich unabhängig von der anderen. Deshalb rechnet
 * dieser Test sie gegeneinander.
 */
import { describe, it, expect } from "vitest";
import { START_HAUFEN, START_AUTOS, START_STREU } from "../src/world/startplatz";
import { PRESS_CENTER, PRESS_INNER } from "../src/world/press";
import { CONFIGS } from "../src/world/containers";

/** Die Presskammer von aussen, so wie press.ts sie baut (Boden + 0,7 m). */
const KAMMER = {
  x0: PRESS_CENTER.x - (PRESS_INNER.laenge + 0.7) / 2,
  x1: PRESS_CENTER.x + (PRESS_INNER.laenge + 0.7) / 2,
  z0: PRESS_CENTER.z - (PRESS_INNER.tiefe + 0.7) / 2,
  z1: PRESS_CENTER.z + (PRESS_INNER.tiefe + 0.7) / 2,
};

/** Abstand eines Punktes zur Kammer; 0 heisst „liegt darin". */
function abstandZurKammer(x: number, z: number): number {
  const dx = Math.max(KAMMER.x0 - x, 0, x - KAMMER.x1);
  const dz = Math.max(KAMMER.z0 - z, 0, z - KAMMER.z1);
  return Math.hypot(dx, dz);
}

describe("Anfangszustand des Platzes", () => {
  it("der Starthaufen reicht nicht in die Presskammer", () => {
    /*
     * Geprueft wird der Rand des Streukreises, nicht seine Mitte — ein Haufen
     * von 2,9 m Radius liegt eben 2,9 m weit.
     */
    expect(
      abstandZurKammer(START_HAUFEN.x, START_HAUFEN.z),
      "Haufenmitte zu nah an der Presse"
    ).toBeGreaterThan(START_HAUFEN.streuung);
  });

  it("der Streuschrott ringsum auch nicht", () => {
    for (let i = 0; i < START_STREU.teile; i++) {
      const a = (i / START_STREU.teile) * Math.PI * 2;
      const x = START_STREU.x + Math.cos(a) * START_STREU.radius;
      const z = START_STREU.z + Math.sin(a) * START_STREU.radius;
      expect(abstandZurKammer(x, z), `Streuteil ${i} liegt in der Presse`).toBeGreaterThan(0);
    }
  });

  it("kein Altfahrzeug steht in der Presse", () => {
    for (const [i, a] of START_AUTOS.entries()) {
      // Ein Auto ist rund 4 m lang — es braucht mehr als nur „nicht im Punkt".
      expect(abstandZurKammer(a.x, a.z), `Altfahrzeug ${i} steht in der Presse`).toBeGreaterThan(
        2.0
      );
    }
  });

  it("alles Anfaengliche liegt in einer der beiden Halden", () => {
    /*
     * Sonst faengt das Spiel damit an, dass Material ausserhalb jeder Zone
     * liegt und nirgends gezaehlt wird.
     *
     * Seit E-010 (14.09.2026) sind es ZWEI Halden statt einer: Mischschrott
     * und Stahlschrott liegen nebeneinander in der Ausbuchtung, nur durch die
     * Trennsteine geschieden. Der Haufen gehoert weiter in den Mischschrott;
     * die beiden Wracks duerfen in beiden stehen, und eines steht mit Absicht
     * in der noch leeren Stahlhalde — in der Mischschrotthalde waere es
     * entweder im Haufen begraben oder 10,4 m vom Sitz und damit ausser
     * Reichweite.
     */
    const halden = CONFIGS.filter((c) => c.kind === "halde");
    expect(halden.length, "es gibt nicht mehr zwei Halden").toBe(2);
    const inHalde = (x: number, z: number): boolean =>
      halden.some(
        (h) => Math.abs(x - h.x) <= h.size[0] / 2 && Math.abs(z - h.z) <= h.size[1] / 2
      );
    const misch = CONFIGS.find((c) => c.id === "c_mixed")!;
    expect(
      Math.abs(START_HAUFEN.x - misch.x) <= misch.size[0] / 2 &&
        Math.abs(START_HAUFEN.z - misch.z) <= misch.size[1] / 2,
      "Haufenmitte nicht in der Mischschrotthalde"
    ).toBe(true);
    for (const [i, a] of START_AUTOS.entries()) {
      expect(inHalde(a.x, a.z), `Altfahrzeug ${i} steht in keiner Halde`).toBe(true);
    }
  });
});
