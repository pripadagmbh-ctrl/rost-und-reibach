/**
 * Die Stahlschrott-Regel (E-042, 15.09.2026).
 *
 * Patricks Ansage, wörtlich:
 *
 * > „Ich möchte ein bisschen strenger werden, was Stahlschrott ist. Das ist
 * > halt so das Premium. Es geht da eher so um Bahnschwellen, Bremsscheiben,
 * > Träger — das ist so wirklich ganz gutes Material. Auch bei so Gitterboxen
 * > bin ich mir nicht sicher, ob das dann wirklich Stahlschrott ist."
 *
 * Und nach dem Blick aufs Blatt:
 *
 * > „LKW-Felge, sind gehärteter Stahl und daher auf massiv setzen. Dicke
 * > Übersee-Container haben auch viel Masse, auch wenn es dünnes Blech ist.
 * > Drum Stahl."
 *
 * Die Regel steht in `src/materials/purity.ts` und gilt im Spiel. Dieser
 * Wächter prüft drei Dinge: dass das Maß die Wirklichkeit trifft, dass die
 * genannten Stücke auf der richtigen Seite landen — und dass die
 * Übersteuerungen die Ausnahme bleiben, die sie sein sollen.
 */
import { describe, it, expect } from "vitest";
import {
  STAHL_KG_M3,
  VERBUND_BIS,
  WAND_AB_MM,
  aussenflaeche,
  fraktionVonTeil,
  wandstaerkeMm,
} from "../src/materials/purity";
import { alleEintraege, alleUrteile, huellVolumen, urteile } from "../tools/stahlschrott";
import { SPECS } from "../src/world/scrapItems";
import { KATALOG_BIG, KATALOG_HUGE, type PileSpec } from "../src/world/objektkatalog";

const alle = alleUrteile();

function stueck(name: string) {
  const u = alle.find((x) => x.spec.name === name);
  if (!u) throw new Error(`Katalogeintrag „${name}" nicht gefunden`);
  return u;
}

describe("Das Maß: rechnerische Wandstärke", () => {
  it("rechnet die Fläche eines Würfels richtig", () => {
    expect(aussenflaeche("box", [1, 1, 1])).toBeCloseTo(6, 6);
    expect(huellVolumen("box", [1, 1, 1])).toBeCloseTo(1, 6);
  });

  it("gibt für einen Vollstahl-Würfel ein Sechstel der Kante zurück", () => {
    // Ein Würfel von 0,30 m Kante aus Vollstahl wiegt 7850 × 0,027 = 212 kg.
    // Über 6 × 0,09 m² verteilt sind das 0,30/6 = 50 mm.
    expect(wandstaerkeMm(STAHL_KG_M3 * 0.027, "box", [0.3, 0.3, 0.3])).toBeCloseTo(50, 6);
  });

  it("trifft bei Rohrform den Mantel plus die beiden Deckel", () => {
    // r = 0,5 m, l = 1 m → 2π·0,5·1 + 2π·0,25 = 1,5π m².
    expect(aussenflaeche("cyl", [0.5, 1])).toBeCloseTo(Math.PI * 1.5, 6);
  });

  it("misst Herdblech als Herdblech und einen Träger als Träger", () => {
    // Gegenprobe an der Wirklichkeit: Herdblech ist rund 1 mm dick, der Steg
    // eines IPE 280 ist 6,5 mm. Beides kommt aus Masse und Maß heraus, ohne
    // dass es jemand eingetragen hat.
    expect(stueck("Elektroherd").wand).toBeGreaterThan(1.0);
    expect(stueck("Elektroherd").wand).toBeLessThan(2.0);
    expect(stueck("Doppel-T-Träger").wand).toBeGreaterThan(6.0);
    expect(stueck("Doppel-T-Träger").wand).toBeLessThan(8.0);
  });
});

describe("Die Regel", () => {
  it("nimmt Patricks Premium-Beispiele auf — alle drei", () => {
    // „Bahnschwellen, Bremsscheiben, Träger". Die ersten beiden gab es im
    // Katalog nicht; sie sind mit E-042 dazugekommen.
    for (const name of [
      "Bahnschwelle (Stahl, Y-Form)",
      "Bremsscheibe (LKW)",
      "Bremsscheiben (Palette)",
      "Doppel-T-Träger",
      "Profilstahl",
      "Schienenabschnitt",
      "Schienenbündel",
      "LKW-Achse",
    ]) {
      expect(stueck(name).jetzt, name).toBe("steel");
    }
  });

  it("wirft Dünnblech heraus, so schwer es auch ist", () => {
    // „Ein Elektroherd, das ist vor allem Blechschrott. Das ist nicht massiv."
    for (const name of ["Elektroherd", "Blech", "Blechtafel", "Badewanne", "Stahltür/Tor"]) {
      expect(stueck(name).jetzt, name).toBe("mixed");
    }
  });

  it("antwortet auf die Gitterbox: Mischschrott, mit 3,0 mm", () => {
    const box = stueck("Gitterbox");
    expect(box.wand).toBeLessThan(WAND_AB_MM);
    expect(box.wand).toBeCloseTo(3.0, 1);
    expect(box.vorher).toBe("steel");
    expect(box.jetzt).toBe("mixed");
  });

  it("trennt dasselbe Blech nach seiner Dicke", () => {
    // Blech (55 kg) und Grobblech-Zuschnitt (150 kg) haben dieselbe Bauform
    // `platte` und fast dasselbe Maß — und gehen in zwei Mulden. Das ist der
    // Fall, an dem man die Regel im Spiel lernen kann.
    expect(stueck("Blech").jetzt).toBe("mixed");
    expect(stueck("Grobblech-Zuschnitt (20 mm)").jetzt).toBe("steel");
    expect(stueck("Blech").spec.bau).toBe(stueck("Grobblech-Zuschnitt (20 mm)").spec.bau);
  });

  it("räumt den Widerspruch Elektroherd / Einbauherd weg", () => {
    // Der Befund aus `docs/fraktionen.md`: derselbe Küchenherd, zwei Mulden,
    // nur weil an einem Eintrag eine Stückliste stand und am anderen nicht.
    expect(stueck("Elektroherd").vorher).not.toBe(stueck("Einbauherd mit Umluftofen").vorher);
    expect(stueck("Elektroherd").jetzt).toBe(stueck("Einbauherd mit Umluftofen").jetzt);
  });

  it("lässt ein Stück Premium sein, an dem noch etwas dranhängt", () => {
    // „Natürlich hast du mal Tanks, wo dann noch was dran ist."
    const tank: PileSpec = {
      materialId: "steel",
      massKg: 900,
      kind: "cyl",
      dims: [0.8, 3.0],
      zusammensetzung: [
        { materialId: "steel", anteil: 0.92 },
        { materialId: "plastic", anteil: 0.08 },
      ],
    };
    expect(urteile(tank).wand).toBeGreaterThan(WAND_AB_MM);
    expect(urteile(tank).vorher).toBe("mixed"); // 8 % rissen die alten 5 %
    expect(urteile(tank).jetzt).toBe("steel");
  });

  it("wirft echten Verbund heraus, auch wenn er dickwandig ist", () => {
    const motor = stueck("Motorblock-Rest"); // 18 % Alu und Kupfer
    expect(motor.wand).toBeGreaterThan(WAND_AB_MM);
    expect(motor.fremd).toBeGreaterThan(VERBUND_BIS);
    expect(motor.jetzt).toBe("mixed");
  });

  it("fasst Buntmetall, VA und Abfall nicht an", () => {
    for (const u of alle) {
      if (u.grund !== "kein-stahl") continue;
      expect(u.jetzt, u.spec.name ?? u.spec.materialId).toBe(u.vorher);
    }
  });

  it("E-186: ein Rad (Reifen + Felge) zählt als Reifen, nicht als Verbund", () => {
    // Patrick, 20.10.2026: „Rad zählt als Reifen" (`purity.istRad`).
    const raeder = alle.filter((u) => u.grund === "rad");
    expect(raeder.length).toBe(9);
    for (const u of raeder) expect(u.jetzt, u.spec.name).toBe("tires");
  });
});

describe("Die Übersteuerungen — Patricks zwei Korrekturen und die Folgefälle", () => {
  it("LKW-Felge: gehärteter Stahl, also massiv", () => {
    const felge = stueck("LKW-Felge");
    expect(felge.wand).toBeLessThan(WAND_AB_MM); // gerechnet 5,6 mm
    expect(felge.spec.massiv).toBe(true);
    expect(felge.jetzt).toBe("steel");
    // Derselbe Gegenstand gestapelt muss dieselbe Seite haben.
    expect(stueck("Felgenstapel (Stahl)").jetzt).toBe("steel");
  });

  it("Seecontainer: viel Masse trotz dünnem Blech", () => {
    const c = stueck("Seecontainer 20 Fuß");
    expect(c.wand).toBeLessThan(WAND_AB_MM); // gerechnet 4,6 mm
    expect(c.spec.massiv).toBe(true);
    expect(c.jetzt).toBe("steel");
  });

  it("Verschleißstahl-Werkzeuge hängen zusammen", () => {
    // Wenn der Baggerlöffel massiv ist, sind es die anderen Schaufeln auch —
    // sonst ist die Übersteuerung Geschmackssache statt Begründung.
    for (const name of [
      "Baggerlöffel",
      "Frontlader-Schaufel",
      "Radlader-Schaufel",
      "Pflugschar",
    ]) {
      expect(stueck(name).spec.massiv, name).toBe(true);
      expect(stueck(name).jetzt, name).toBe("steel");
    }
  });

  it("bleiben eine Handvoll und keine Hintertür", () => {
    // Die Übersteuerung ist der Ort für Produktwissen, nicht für Bequemlichkeit.
    // Wächst diese Zahl über ein Zwanzigstel des Katalogs, ist die Regel falsch
    // und nicht der Katalog.
    const ueber = alle.filter((u) => u.spec.massiv !== undefined);
    expect(ueber.length).toBeLessThanOrEqual(Math.round(alle.length / 20));
    expect(ueber.every((u) => u.spec.massiv === true)).toBe(true);
  });

  it("BEFUND: eine Massenschwelle wäre keine Regel, sondern eine Ausnahme", () => {
    /*
     * Geprüft am 15.09.2026, weil Patricks Begründung für den Container die
     * Masse war und nicht die Wand. Eine Massenschwelle müsste, um den
     * Seecontainer zu fassen, bei höchstens 2200 kg liegen — und der
     * Seecontainer IST das schwerste dünnwandige Stück ohne Verbund im ganzen
     * Katalog. Jede Schwelle zwischen dem zweitschwersten und ihm nimmt genau
     * ein Stück mit: das, für das sie gemacht wurde.
     *
     * Wandert dieser Wächter, hat jemand ein schweres dünnwandiges Stück
     * hinzugefügt — dann gehört die Frage neu gestellt.
     */
    const duennOhneVerbund = alle
      .filter((u) => u.grund === "duennwandig" || (u.grund === "uebersteuert" && u.wand < WAND_AB_MM))
      .sort((a, b) => b.spec.massKg - a.spec.massKg);
    expect(duennOhneVerbund[0].spec.name).toBe("Seecontainer 20 Fuß");
    expect(duennOhneVerbund[0].spec.massKg).toBe(2200);
    // Der Abstand zum nächsten ist so groß, dass die Schwelle nichts anderes trifft.
    expect(duennOhneVerbund[1].spec.massKg).toBeLessThanOrEqual(1900);
  });
});

describe("Spiel und Werkzeug sagen dasselbe", () => {
  it("jeder Katalogeintrag trägt im Spiel die Fraktion, die die Regel ausrechnet", () => {
    // `scrapItems.ts` und `objektkatalog.ts` schreiben `materialId` beim Laden
    // um. Hier wird geprüft, dass dabei genau die Regel herauskommt — und dass
    // ein zweiter Durchlauf nichts mehr ändert.
    for (const spec of [...SPECS, ...KATALOG_BIG, ...KATALOG_HUGE]) {
      expect(fraktionVonTeil(spec), spec.name ?? "(ohne Namen)").toBe(spec.materialId);
    }
  });

  it("findet auch die nicht exportierten Listen", () => {
    const listen = new Set(alleEintraege().map((e) => e.liste));
    expect(listen.has("BIG_SPECS")).toBe(true);
    expect(listen.has("HUGE_SPECS")).toBe(true);
    expect(alle.length).toBeGreaterThan(271);
  });

  it("wird strenger, nicht lockerer", () => {
    const vorher = alle.filter((u) => u.vorher === "steel").length;
    const jetzt = alle.filter((u) => u.jetzt === "steel").length;
    expect(jetzt).toBeLessThan(vorher);
  });

  it("schickt kein Stück aus Mischschrott zurück in den Stahl, das nicht Stahl war", () => {
    for (const u of alle) {
      if (u.jetzt !== "steel") continue;
      expect(u.spec.materialId === "steel" || u.vorher === "mixed", u.spec.name).toBe(true);
    }
  });
});
