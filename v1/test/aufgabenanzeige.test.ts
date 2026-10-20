/**
 * DIE AUFGABEN-ANZEIGE (E-162, 19.10.2026) — die reinen Teile:
 *
 *  1. Sternziele auf der Karte, Deutsch und Englisch (von Anfang an sichtbar);
 *  2. die Freischalt-Regel (nacheinander, 1 Stern reicht; Patrick Frage 1 A);
 *  3. `bedientext` auf Englisch, mit Werks- und umgekehrter Belegung;
 *  4. der Pfeil des Geisterdaumens aus der Belegung (Umkehr, verlegte Funktion);
 *  5. die Zeilen der Abschlusstafel mit ✓ / ✗.
 *
 * Gegen Zahlen aus dem Konzept (`docs/aufgaben-konzept.md`), nicht gegen den
 * Katalog — der wird parallel gebaut und darf seine Startwerte nachstellen.
 */
import { describe, it, expect } from "vitest";
import { sternZiele, schwelleText, sterneText, uhr } from "../src/ui/aufgabentexte";
import { aufgabeFrei, naechsteFreieAufgabe } from "../src/ui/hauptmenue";
import { bedientext, Klappe, ZUKLAPPEN_S } from "../src/ui/challengekarte";
import { daumenBild } from "../src/ui/geisterdaumen";
import { challengeZeilen } from "../src/ui/abrechnung";
import { defaultConfig, type ControlConfig } from "../src/core/controlConfig";
import type { GameEvents } from "../src/core/events";

type Wertung = GameEvents["challenge:start"]["wertung"];
type Messung = GameEvents["challenge:geschafft"]["messung"];

// Aufgabe 1, 2 und 3 aus dem Konzept
const ERSTER_GRIFF = { zwei: { zeitS: 180 }, drei: { zeitS: 90 } } as unknown as Wertung;
const PRESSE = {
  zwei: { zeitS: 180, praezisionCm: 100 },
  drei: { zeitS: 90, praezisionCm: 40, harteAufschlaege: 0 },
} as unknown as Wertung;
const SORTIEREN = {
  zwei: { zeitS: 240, fehlwuerfe: 1 },
  drei: { zeitS: 150, fehlwuerfe: 0 },
} as unknown as Wertung;

describe("Sternziele auf der Karte", () => {
  it("Aufgabe 1 auf Deutsch und Englisch: eine Zeile, Zeit ohne unter (G2b)", () => {
    expect(sternZiele(ERSTER_GRIFF, "de")).toBe("★★ 3:00 · ★★★ 1:30");
    expect(sternZiele(ERSTER_GRIFF, "en")).toBe("★★ 3:00 · ★★★ 1:30");
  });
  it("Aufgabe 2: Zeit, Abstand, Aufschlag in fester Reihenfolge", () => {
    expect(sternZiele(PRESSE, "de")).toBe("★★ 3:00 · auf 1 m genau · ★★★ 1:30 · auf 40 cm genau · kein harter Aufschlag");
    expect(sternZiele(PRESSE, "en")).toBe("★★ 3:00 · within 1 m · ★★★ 1:30 · within 40 cm · no hard drops");
  });
  it("Aufgabe 3: Einzahl und Null richtig", () => {
    expect(sternZiele(SORTIEREN, "de")).toBe("★★ 4:00 · max. 1 Fehlwurf · ★★★ 2:30 · 0 Fehlwürfe");
    expect(sternZiele(SORTIEREN, "en")).toBe("★★ 4:00 · max. 1 miss · ★★★ 2:30 · no misses");
  });
  it("Mehrzahl und die uebrigen Groessen", () => {
    expect(schwelleText("fehlwuerfe", 3, "de")).toBe("max. 3 Fehlwürfe");
    expect(schwelleText("ueberlasten", 1, "de")).toBe("max. 1 Überlast");
    expect(schwelleText("ueberlasten", 1, "en")).toBe("max. 1 overload");
    expect(schwelleText("fremdteile", 0, "de")).toBe("keine Fremdteile");
    expect(schwelleText("fremdteile", 0, "en")).toBe("no wrong parts");
    expect(schwelleText("harteAufschlaege", 2, "en")).toBe("max. 2 hard drops");
  });
  it("Aufgabe 1 und 3 passen in eine Zeile aufs iPhone mini quer (57 Zeichen, index.html)", () => {
    for (const w of [ERSTER_GRIFF, SORTIEREN])
      for (const s of ["de", "en"] as const) expect(sternZiele(w, s).length, sternZiele(w, s)).toBeLessThanOrEqual(57);
  });
  it("die Uhr springt nur auf ganze Sekunden und nie zurueck", () => {
    expect(uhr(0)).toBe("0:00");
    expect(uhr(59.9)).toBe("0:59");
    expect(uhr(60)).toBe("1:00");
    expect(uhr(605.2)).toBe("10:05");
  });
  it("Sternzeile mit Wort in beiden Sprachen", () => {
    expect(sterneText(2, "de")).toBe("★★☆  zwei von drei Sternen");
    expect(sterneText(2, "en")).toBe("★★☆  two of three stars");
  });
});

describe("Freischalten nacheinander", () => {
  const ids = ["griff", "presse", "sortieren"];
  it("die erste ist immer offen, auch ohne Ablage", () => {
    expect(aufgabeFrei(0, ids, {})).toBe(true);
    expect(aufgabeFrei(1, ids, {})).toBe(false);
  });
  it("eine Aufgabe oeffnet sich, sobald die vorige einen Stern hat", () => {
    expect(aufgabeFrei(1, ids, { griff: { sterne: 1 } })).toBe(true);
    expect(aufgabeFrei(2, ids, { griff: { sterne: 3 } }), "uebernaechste bleibt zu").toBe(false);
    expect(aufgabeFrei(2, ids, { griff: { sterne: 3 }, presse: { sterne: 1 } })).toBe(true);
  });
  it("GEGENPROBE: begonnen (0 Sterne) ist nicht geschafft", () => {
    expect(aufgabeFrei(1, ids, { griff: { sterne: 0 } })).toBe(false);
  });
  it("ausserhalb der Liste ist nichts offen", () => {
    expect(aufgabeFrei(3, ids, { sortieren: { sterne: 3 } })).toBe(false);
    expect(aufgabeFrei(-1, ids, {})).toBe(false);
  });
  it("NÄCHSTE AUFGABE nur, wenn es eine gibt und sie frei ist", () => {
    expect(naechsteFreieAufgabe("griff", ids, { griff: { sterne: 1 } })).toBe("presse");
    expect(naechsteFreieAufgabe("griff", ids, {})).toBeNull();
    expect(naechsteFreieAufgabe("sortieren", ids, { sortieren: { sterne: 3 } }), "die letzte").toBeNull();
    expect(naechsteFreieAufgabe("gibtsnicht", ids, {})).toBeNull();
  });
});

/** Werkseinstellung, aber Querachsen umgekehrt — wie in challenge.test.ts. */
function umgekehrt(): ControlConfig {
  const c = defaultConfig();
  c.rightX.invert = true;
  c.leftX.invert = !c.leftX.invert;
  c.leftY.invert = !c.leftY.invert;
  return c;
}

describe("bedientext auf Englisch", () => {
  it("Werkseinstellung: right stick right closes", () => {
    const c = defaultConfig();
    expect(bedientext("{schliessen}: close grapple", c, "en")).toBe("Right stick right: close grapple");
    expect(bedientext("{oeffnen}: open grapple", c, "en")).toBe("Right stick left: open grapple");
    expect(bedientext("{schwenken}: turn", c, "en")).toBe("Left stick sideways: turn");
    expect(bedientext("{hauptarm}", c, "en")).toBe("Left stick up/down");
    expect(bedientext("{ausleger}", c, "en")).toBe("Right stick up/down");
  });
  it("Richtung je Funktion: {boom+} hebt (Stick nach oben), {boom-} senkt", () => {
    const c = defaultConfig();
    expect(bedientext("{boom+}: raise", c, "en")).toBe("Left stick up: raise");
    expect(bedientext("{boom-}: lower", c, "en")).toBe("Left stick down: lower");
    expect(bedientext("{boom-}: Hauptarm senken", c, "de")).toBe("Linker Stick nach unten: Hauptarm senken");
  });
  it("umgekehrte Belegung dreht die Richtung, nicht den Stick", () => {
    const c = umgekehrt();
    expect(bedientext("{schliessen}", c, "en")).toBe("Right stick left");
    expect(bedientext("{boom+}", c, "en")).toBe("Left stick down");
    expect(bedientext("{schliessen}", c, "de")).toBe("Rechter Stick nach links");
  });
  it("verlegte Funktion: die Spinne liegt links unten/oben", () => {
    const c = defaultConfig();
    c.leftY = { fn: "grapple", invert: false };
    c.rightX = { fn: "boom", invert: false };
    expect(bedientext("{schliessen}", c, "en")).toBe("Left stick down");
    expect(bedientext("{hauptarm}", c, "en")).toBe("Right stick sideways");
  });
  it("unbelegt: sagt, wo man es belegt — in der Sprache", () => {
    const c = defaultConfig();
    c.rightX = { fn: "none", invert: false };
    expect(bedientext("{oeffnen}", c, "en")).toContain("Controls");
    expect(bedientext("{oeffnen}", c, "de")).toContain("Steuerung");
  });
});

describe("Pfeil des Geisterdaumens aus der Belegung", () => {
  it("Werkseinstellung", () => {
    const c = defaultConfig();
    expect(daumenBild({ fn: "grapple", richtung: "plus" }, c)).toEqual({ seite: "rechts", pfeil: "rechts" });
    expect(daumenBild({ fn: "grapple", richtung: "minus" }, c)).toEqual({ seite: "rechts", pfeil: "links" });
    expect(daumenBild({ fn: "boom", richtung: "plus" }, c)).toEqual({ seite: "links", pfeil: "hoch" });
    expect(daumenBild({ fn: "boom", richtung: "minus" }, c)).toEqual({ seite: "links", pfeil: "runter" });
    expect(daumenBild({ fn: "cab", richtung: "beide" }, c)).toEqual({ seite: "links", pfeil: "quer" });
    expect(daumenBild({ fn: "stick", richtung: "beide" }, c)).toEqual({ seite: "rechts", pfeil: "laengs" });
  });
  it("Umkehr dreht den Pfeil", () => {
    const c = umgekehrt();
    expect(daumenBild({ fn: "grapple", richtung: "plus" }, c)).toEqual({ seite: "rechts", pfeil: "links" });
    expect(daumenBild({ fn: "boom", richtung: "plus" }, c)).toEqual({ seite: "links", pfeil: "runter" });
  });
  it("verlegte Funktion wandert in die andere Zone", () => {
    const c = defaultConfig();
    c.leftY = { fn: "grapple", invert: true };
    c.rightX = { fn: "boom", invert: false };
    expect(daumenBild({ fn: "grapple", richtung: "plus" }, c)).toEqual({ seite: "links", pfeil: "hoch" });
    expect(daumenBild({ fn: "boom", richtung: "minus" }, c)).toEqual({ seite: "rechts", pfeil: "links" });
  });
  it("Text und Daumen sagen dasselbe", () => {
    for (const c of [defaultConfig(), umgekehrt()]) {
      const text = bedientext("{schliessen}", c, "de");
      const p = daumenBild({ fn: "grapple", richtung: "plus" }, c)!.pfeil;
      expect(text, `${text} / ${p}`).toContain(p === "rechts" ? "nach rechts" : "nach links");
    }
  });
  it("nichts zu zeigen: kein Daumen", () => {
    const c = defaultConfig();
    expect(daumenBild(null, c)).toBeNull();
    c.rightX = { fn: "none", invert: false };
    expect(daumenBild({ fn: "grapple", richtung: "plus" }, c), "unbelegt").toBeNull();
  });
});

describe("Zeilen der Abschlusstafel", () => {
  const geschafft = (messung: Partial<Record<string, number | null>>, wertung: Wertung): GameEvents["challenge:geschafft"] => ({
    id: "presse",
    name: { de: "AUTO IN DIE PRESSE", en: "CAR INTO THE BALER" },
    sterne: 2,
    messung: { zeitS: 0, fehlwuerfe: 0, harteAufschlaege: 0, praezisionCm: null, ueberlasten: 0, fremdteile: 0, ...messung } as unknown as Messung,
    wertung,
  });
  it("✓ reicht fuer drei, ✗ nicht einmal fuer zwei, ohne Zeichen dazwischen", () => {
    const z = challengeZeilen(geschafft({ zeitS: 80, praezisionCm: 70, harteAufschlaege: 2 }, PRESSE), "de");
    expect(z.map((r) => r.name)).toEqual(["Zeit", "Präzision", "Harte Aufschläge"]);
    expect(z[0]!.wert).toBe("✓ 1:20 min (★★★ bis 1:30 min)");
    // zwischen 40 und 100 cm: reicht fuer zwei, nicht fuer drei — kein Zeichen
    expect(z[1]!.wert).toBe("70 cm daneben (★★★ bis 40 cm)");
    // nur fuer drei verlangt und verfehlt: kein ✓, aber auch kein ✗ (zwei verlangt es nicht)
    expect(z[2]!.wert).toBe("2 (★★★ bis 0)");
    expect(z[2]!.farbe).toBeUndefined();
  });
  it("✗ wenn die Zwei-Sterne-Grenze verfehlt ist", () => {
    const z = challengeZeilen(geschafft({ zeitS: 200, praezisionCm: 30 }, PRESSE), "de");
    expect(z[0]!.wert.startsWith("✗"), z[0]!.wert).toBe(true);
    expect(z[1]!.wert.startsWith("✓"), z[1]!.wert).toBe(true);
  });
  it("ungemessen: ✗ mit Wort, keine erfundene Zahl", () => {
    const z = challengeZeilen(geschafft({ zeitS: 60 }, PRESSE), "en");
    expect(z[1]).toEqual({ name: "Precision", wert: "✗ not measured", farbe: "#e08a5a" });
  });
  it("Englisch: Namen und Woerter", () => {
    const z = challengeZeilen(geschafft({ zeitS: 140, fehlwuerfe: 0 }, SORTIEREN), "en");
    expect(z.map((r) => r.name)).toEqual(["Time", "Misses"]);
    expect(z[0]!.wert).toBe("✓ 2:20 min (★★★ max. 2:30 min)");
    expect(z[1]!.wert).toBe("✓ 0 (★★★ max. 0)");
  });
});

describe("Aufgabenkarte klappt auf dem Telefon quer zusammen (E-164)", () => {
  const telefon = (): Klappe => {
    const k = new Klappe(() => true);
    k.neustart();
    return k;
  };
  it("neuer Schritt offen, nach 5 s Aufgabenzeit zu", () => {
    const k = telefon();
    k.zeige();
    k.zeit(4.9);
    expect(k.zu).toBe(false);
    k.zeit(ZUKLAPPEN_S);
    expect(k.zu).toBe(true);
  });
  it("ein neuer Schritt, Tipp oder PRESSEN oeffnet und gibt wieder 5 s", () => {
    const k = telefon();
    k.zeit(12);
    expect(k.zu).toBe(true);
    k.zeige(); // z. B. Schritt 2 bei 12 s
    expect(k.zu).toBe(false);
    k.zeit(16.9);
    expect(k.zu, "noch innerhalb der 5 s").toBe(false);
    k.zeit(17);
    expect(k.zu).toBe(true);
  });
  it("Tipp auf den Klappknopf: zu → auf fuer 5 s, auf → zu", () => {
    const k = telefon();
    k.zeit(6);
    expect(k.zu).toBe(true);
    k.tippe();
    expect(k.zu).toBe(false);
    k.zeit(10.9);
    expect(k.zu).toBe(false);
    k.zeit(11);
    expect(k.zu, "aufgetippt gilt dieselbe Frist").toBe(true);
    k.tippe();
    k.tippe();
    expect(k.zu, "zweiter Tipp klappt sofort zu").toBe(true);
  });
  it("Spielpause: die Uhr steht, die Karte bleibt offen", () => {
    const k = telefon();
    k.zeit(3); // dann Pause — es kommt kein challenge:stand
    expect(k.zu).toBe(false);
  });
  it("↻: die Aufgabenuhr beginnt bei 0, die Karte ist wieder 5 s offen", () => {
    const k = telefon();
    k.zeit(40);
    k.neustart();
    k.zeige();
    k.zeit(0.5);
    expect(k.zu).toBe(false);
    k.zeit(5);
    expect(k.zu).toBe(true);
  });
  it("GEGENPROBE iPad: nichts klappt von selbst, nur der Knopf", () => {
    const k = new Klappe(() => false);
    k.neustart();
    k.zeit(60);
    expect(k.zu).toBe(false);
    k.tippe();
    k.zeige();
    k.zeit(61);
    expect(k.zu, "ein neuer Schritt oeffnet auf dem iPad nicht (wie bisher)").toBe(true);
  });
});
