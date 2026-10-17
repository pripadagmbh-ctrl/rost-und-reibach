import { describe, it, expect } from "vitest";
import {
  NACHSCHUB_FOLGE,
  NACHSCHUB_MELDUNG,
  nachschubMeldung,
  profilFuer,
} from "../src/delivery/nachschub";
import { rollCustomer } from "../src/delivery/customers";

/*
 * NACHSCHUB im Sandkasten (E-118): Kipper, Pritsche, Wrack reihum, mit einem
 * Profil, dessen Ladung zum Fahrzeug passt. Seit E-126 als vierte Art das
 * Großteil — ein Teil allein auf der flachen Pritsche.
 */
describe("Nachschub", () => {
  it("reihum Kipper, Pritsche, Wrack, Großteil, Absetzkipper (E-141)", () => {
    expect([...NACHSCHUB_FOLGE]).toEqual(["kipper", "pritsche", "wrack", "einzelstueck", "absetzer"]);
  });

  it("das Profil hat das verlangte Fahrzeug — 50 Mal je Art", () => {
    for (const art of NACHSCHUB_FOLGE) {
      for (let i = 0; i < 50; i++) {
        const c = profilFuer(art);
        if (art === "einzelstueck") {
          expect(c.einzelstueck, "das Großteil fehlt").toBeDefined();
          expect(c.vehicle).toBe("pritsche");
        } else {
          expect(c.vehicle).toBe(art);
          // Pritsche heißt Schüttgut-Pritsche — kein Großteil durch die Hintertür
          expect(c.einzelstueck).toBeUndefined();
        }
      }
    }
  });

  it("die Meldung zum Großteil sagt Großteil, nicht Pritsche", () => {
    expect(nachschubMeldung(profilFuer("einzelstueck"))).toBe(NACHSCHUB_MELDUNG.einzelstueck);
    expect(nachschubMeldung(profilFuer("kipper"))).toBe(NACHSCHUB_MELDUNG.kipper);
  });

  it("die Meldung nennt das Fahrzeug, keinen Kunden", () => {
    for (const art of NACHSCHUB_FOLGE) expect(NACHSCHUB_MELDUNG[art]).toMatch(/^Nachschub: /);
  });

  it("GEGENPROBE: passt nie eins, kommt trotzdem eine Fuhre — und die Suche endet", () => {
    let wuerfe = 0;
    const nurPkw = () => {
      wuerfe++;
      return { ...rollCustomer(), vehicle: "pkw" as const };
    };
    expect(profilFuer("wrack", nurPkw).vehicle).toBe("pkw");
    expect(wuerfe).toBe(200);
  });
});
