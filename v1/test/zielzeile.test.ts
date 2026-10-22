/**
 * DIE ZIELZEILE AUF EINER ERSATZ-SEITE (Auftrag 41-P2) — kein Browser, nur die
 * Elemente aus index.html `#zielzeile` und der Bus.
 *
 * Start: Bild Teil → Bild Ziel + Woerter; nach 4 s Aufgabenzeit nur Bilder;
 * Antippen zeigt die Woerter wieder (und nach 4 s wieder weg). Uhr schreibt
 * nur bei voller Sekunde, Sterne verblassen nach ihrer Zeitschwelle, Zaehler
 * und Balken, PRESSEN nur bei `pressenBereit`, ↻ sendet (⏸ seit 43a neben ☰), Tipp als Zeichen,
 * Sprachwechsel, alte Daten ohne `kurz`/`zeichen`, nach `challenge:geschafft` aus.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventBus, type GameEvents } from "../src/core/events";
import { setzeSprachquelle, type Sprache } from "../src/challenges/texte";
let spr: Sprache = "de";
const setzeSprache = (s: Sprache): void => void (spr = s);
setzeSprachquelle(() => spr);
import { installZielzeile, sterneMoeglich, zielBildSvg, WOERTER_S } from "../src/ui/zielzeile";
import { SORTEN, farbeCss } from "../src/materials/sorten";

class El {
  hidden = false;
  innerHTML = "";
  attrs: Record<string, string> = {};
  schreibungen = 0;
  private text = "";
  private klassen = new Set<string>();
  private hoerer: Record<string, Array<(e: unknown) => void>> = {};
  classList = {
    contains: (k: string) => this.klassen.has(k),
    toggle: (k: string, an?: boolean) => {
      const soll = an ?? !this.klassen.has(k);
      if (soll) this.klassen.add(k);
      else this.klassen.delete(k);
      return soll;
    },
  };
  constructor(public id: string) {}
  get textContent(): string {
    return this.text;
  }
  set textContent(v: string) {
    this.schreibungen++;
    this.text = v;
  }
  setAttribute(k: string, v: string) {
    this.attrs[k] = v;
  }
  getAttribute(k: string) {
    return this.attrs[k] ?? null;
  }
  addEventListener(t: string, f: (e: unknown) => void) {
    (this.hoerer[t] ??= []).push(f);
  }
  /** Ein Finger tippt: pointerdown und pointerup mit derselben Kennung. */
  tippe(id = 1) {
    const e = { pointerId: id, preventDefault() {}, stopPropagation() {} };
    for (const f of this.hoerer["pointerdown"] ?? []) f(e);
    for (const f of this.hoerer["pointerup"] ?? []) f(e);
  }
}

const IDS = ["zielzeile", "zz-uhr", "zz-sterne", "zz-mess", "zz-ziel", "zz-pressen", "zz-tipp", "zz-neu", "zz-satz"];
let el: Record<string, El>;
beforeEach(() => {
  el = Object.fromEntries(IDS.map((id) => [id, new El(id)]));
  el["zielzeile"]!.hidden = true;
  el["zz-pressen"]!.hidden = true;
  el["zz-tipp"]!.hidden = true;
  vi.stubGlobal("document", { getElementById: (id: string) => el[id] ?? null });
  setzeSprache("de");
});
afterEach(() => {
  vi.unstubAllGlobals();
  setzeSprache("de");
});

type Start = GameEvents["challenge:start"];
type Stand = GameEvents["challenge:stand"];
const wertung = { zwei: { zeitS: 180 }, drei: { zeitS: 90 } } as unknown as Start["wertung"];
const START: Start = {
  id: "erster-griff",
  nr: 1,
  name: { de: "Erster Griff", en: "First grip" },
  ziel: { de: "Leg das Kupferteil in die Box BUNT + VA.", en: "Put the copper part in the NON-FERROUS bay." },
  wertung,
  kurz: { de: "Kupfer in BUNT + VA", en: "Copper into NON-FERROUS" },
  zeichen: { teil: { sorte: "kupfer" }, ziel: { sorte: "bunt" } },
};
const stand = (zeitS: number, mehr: Partial<Stand> = {}): Stand => ({
  id: START.id, zeitS, zaehler: null, balken01: null, pressenBereit: false, tipp: null, marken: [], ...mehr,
});

function aufbau() {
  const bus = new EventBus();
  const ton = { tick: 0, schritt: 0 };
  const zz = installZielzeile({ bus, audio: { playTick: () => ton.tick++, playSchritt: () => ton.schritt++ } });
  const gesendet: string[] = [];
  bus.on("challenge:neustart", () => gesendet.push("neustart"));
  bus.on("challenge:pressen", () => gesendet.push("pressen"));
  bus.on("spiel:pause", () => gesendet.push("pause"));
  return { bus, zz, ton, gesendet };
}
const zu = () => el["zielzeile"]!.classList.contains("zu");
const ausSterne = () => (el["zz-sterne"]!.innerHTML.match(/stern aus/g) ?? []).length;

describe("Zielzeile", () => {
  it("Start: Teilbild → Zielbild und die Woerter; nach 4 s nur die Bilder", () => {
    const { bus } = aufbau();
    bus.emit("challenge:start", START);
    expect(el["zielzeile"]!.hidden).toBe(false);
    const ziel = el["zz-ziel"]!;
    expect(ziel.hidden).toBe(false);
    expect(ziel.innerHTML).toContain(farbeCss(SORTEN.kupfer.farbe)); // Teil in Kupferfarbe …
    expect(ziel.innerHTML.indexOf(SORTEN.kupfer.bild[0]!)).toBeLessThan(ziel.innerHTML.indexOf(SORTEN.bunt.bild[0]!)); // … vor dem Ziel
    expect(el["zz-satz"]!.textContent).toBe("Kupfer in BUNT + VA");
    expect(zu()).toBe(false);
    expect(el["zielzeile"]!.getAttribute("aria-label")).toBe("Ziel: Leg das Kupferteil in die Box BUNT + VA.");
    bus.emit("challenge:stand", stand(WOERTER_S - 0.1));
    expect(zu()).toBe(false);
    bus.emit("challenge:stand", stand(WOERTER_S));
    expect(zu(), "nach 4 s nur Bilder").toBe(true);
  });

  it("Antippen zeigt die Woerter wieder, mit Tick, und nach 4 s sind sie wieder weg", () => {
    const { bus, ton } = aufbau();
    bus.emit("challenge:start", START);
    bus.emit("challenge:stand", stand(10));
    expect(zu()).toBe(true);
    el["zz-ziel"]!.tippe();
    expect(zu()).toBe(false);
    expect(ton.tick).toBe(1);
    bus.emit("challenge:stand", stand(13.9));
    expect(zu()).toBe(false);
    bus.emit("challenge:stand", stand(14));
    expect(zu()).toBe(true);
  });

  it("Uhr schreibt nur, wenn eine volle Sekunde um ist", () => {
    const { bus } = aufbau();
    bus.emit("challenge:start", START);
    const uhr = el["zz-uhr"]!;
    const vorher = uhr.schreibungen;
    for (let t = 0; t < 2; t += 1 / 60) bus.emit("challenge:stand", stand(t));
    expect(uhr.textContent).toBe("0:01");
    expect(uhr.schreibungen - vorher, "0:00 steht schon, dann einmal 0:01").toBe(1);
  });

  it("Sterne: drei zu Beginn, nach 90 s verblasst der dritte, nach 180 s der zweite", () => {
    const { bus } = aufbau();
    bus.emit("challenge:start", START);
    expect(ausSterne()).toBe(0);
    bus.emit("challenge:stand", stand(90));
    expect(ausSterne(), "genau auf der Schwelle zaehlt noch").toBe(0);
    bus.emit("challenge:stand", stand(90.5));
    expect(ausSterne()).toBe(1);
    expect(el["zz-sterne"]!.getAttribute("aria-label")).toBe("2 von 3 Sternen möglich");
    bus.emit("challenge:stand", stand(181));
    expect(ausSterne()).toBe(2);
    // ↻: wieder drei
    bus.emit("challenge:start", START);
    expect(ausSterne()).toBe(0);
  });

  it("sterneMoeglich: nur Zeitschwellen, ohne Zeit bleibt es bei drei", () => {
    expect(sterneMoeglich(wertung, 0)).toBe(3);
    expect(sterneMoeglich(wertung, 100)).toBe(2);
    expect(sterneMoeglich(wertung, 200)).toBe(1);
    const ohneZeit = { zwei: { fehlwuerfe: 1 }, drei: { fehlwuerfe: 0 } } as unknown as Start["wertung"];
    expect(sterneMoeglich(ohneZeit, 9999)).toBe(3);
  });

  it("Zaehler als ✓ 4/6, Balken als Spur; schreibt nur bei Aenderung", () => {
    const { bus } = aufbau();
    bus.emit("challenge:start", START);
    expect(el["zz-mess"]!.hidden).toBe(true);
    const zaehler = { ist: 4, von: 6, wort: { de: "richtig", en: "correct" } };
    bus.emit("challenge:stand", stand(1, { zaehler }));
    const m = el["zz-mess"]!;
    expect(m.hidden).toBe(false);
    expect(m.innerHTML).toContain("<b>4/6</b>");
    expect(m.innerHTML).not.toContain("richtig");
    expect(m.getAttribute("aria-label")).toBe("4/6 richtig");
    m.innerHTML = "unberuehrt";
    bus.emit("challenge:stand", stand(1.5, { zaehler }));
    expect(m.innerHTML, "gleicher Stand: nicht neu geschrieben").toBe("unberuehrt");
    bus.emit("challenge:stand", stand(2, { balken01: 0.6 }));
    expect(m.innerHTML).toContain("width:60%");
    expect(m.getAttribute("aria-label")).toBe("platt 60 %");
  });

  it("PRESSEN nur bei pressenBereit und sendet challenge:pressen; ↻ sendet, kein ⏸ mehr in der Zeile (43a)", () => {
    const { bus, gesendet } = aufbau();
    bus.emit("challenge:start", { ...START, zeichen: { teil: { bild: "wrack" }, ziel: { bild: "presse" } } });
    const p = el["zz-pressen"]!;
    expect(p.hidden).toBe(true);
    p.tippe();
    expect(gesendet).toEqual([]);
    bus.emit("challenge:stand", stand(5, { pressenBereit: true }));
    expect(p.hidden).toBe(false);
    p.tippe();
    expect(gesendet).toEqual(["pressen"]);
    bus.emit("challenge:stand", stand(6, { pressenBereit: false }));
    expect(p.hidden).toBe(true);
    el["zz-neu"]!.tippe();
    el["zz-neu"]!.tippe(2); // zweiter Tipp waehrend des Neustarts zaehlt nicht
    expect(gesendet).toEqual(["pressen", "neustart"]); // "pause" sendet nur noch ui/pausenknopf.ts
  });

  it("Tipp als Zeichen; der Satz kommt nur auf Antippen, nie von selbst", () => {
    const { bus } = aufbau();
    bus.emit("challenge:start", START);
    bus.emit("challenge:stand", stand(10));
    expect(el["zz-tipp"]!.hidden).toBe(true);
    const tipp = { de: "Erst die Stützen setzen.", en: "Set the outriggers first." };
    bus.emit("challenge:stand", stand(11, { tipp }));
    expect(el["zz-tipp"]!.hidden).toBe(false);
    expect(zu(), "kein Text poppt von selbst auf").toBe(true);
    el["zz-tipp"]!.tippe();
    expect(zu()).toBe(false);
    expect(el["zz-satz"]!.textContent).toBe("Erst die Stützen setzen.");
    bus.emit("challenge:stand", stand(15, { tipp }));
    expect(zu()).toBe(true);
    // Antippen des Ziels zeigt wieder die Ziel-Woerter
    el["zz-ziel"]!.tippe();
    expect(el["zz-satz"]!.textContent).toBe("Kupfer in BUNT + VA");
    // PRESSEN und Tipp teilen einen Platz: PRESSEN geht vor
    bus.emit("challenge:stand", stand(16, { tipp, pressenBereit: true }));
    expect(el["zz-tipp"]!.hidden).toBe(true);
  });

  it("Sprachwechsel: Woerter und Vorlesetexte auf Englisch", () => {
    const { bus, zz } = aufbau();
    bus.emit("challenge:start", START);
    bus.emit("challenge:stand", stand(1, { zaehler: { ist: 1, von: 6, wort: { de: "richtig", en: "correct" } } }));
    setzeSprache("en");
    zz.neuBeschriften();
    expect(el["zz-satz"]!.textContent).toBe("Copper into NON-FERROUS");
    expect(el["zielzeile"]!.getAttribute("aria-label")).toBe("Goal: Put the copper part in the NON-FERROUS bay.");
    expect(el["zz-neu"]!.getAttribute("aria-label")).toBe("Restart test");
    expect(el["zz-mess"]!.getAttribute("aria-label")).toBe("1/6 correct");
    expect(el["zz-sterne"]!.getAttribute("aria-label")).toBe("3 of 3 stars possible");
  });

  it("alte Daten ohne kurz/zeichen: kein Absturz, kein Zielknopf, keine Woerter", () => {
    const { bus } = aufbau();
    const { kurz: _k, zeichen: _z, ...alt } = START;
    expect(() => bus.emit("challenge:start", alt)).not.toThrow();
    expect(el["zz-ziel"]!.hidden).toBe(true);
    expect(el["zz-satz"]!.textContent).toBe("");
    expect(zu()).toBe(true);
    expect(() => bus.emit("challenge:stand", stand(3))).not.toThrow();
    expect(el["zz-uhr"]!.textContent).toBe("0:03");
  });

  it("nach challenge:geschafft aus; ein Lernschritt weiter gibt den Doppelklick", () => {
    const { bus, ton } = aufbau();
    bus.emit("challenge:start", START);
    const schritt = (nr: number): GameEvents["challenge:schritt"] => ({ id: START.id, nr, von: 2, titel: START.name, text: START.ziel, zeige: null });
    bus.emit("challenge:schritt", schritt(1));
    bus.emit("challenge:schritt", schritt(2));
    expect(ton.schritt).toBe(1);
    bus.emit("challenge:stand", stand(5, { pressenBereit: true }));
    bus.emit("challenge:geschafft", { id: START.id } as GameEvents["challenge:geschafft"]);
    expect(el["zielzeile"]!.hidden).toBe(true);
  });
});

describe("Bilder", () => {
  it("Ziel einer Sorte: Mulde in der Sortenfarbe, das Bild darin im Kontrast", () => {
    const s = zielBildSvg({ sorte: "stahl" }, "ziel");
    expect(s).toContain(`fill="${farbeCss(SORTEN.stahl.farbe)}"`);
    expect(s).toContain(SORTEN.stahl.bild[0]);
  });
  it("jedes Ding ohne Sorte hat ein Bild", () => {
    for (const bild of ["wrack", "wohnwagen", "lkw", "gemischt", "eisen", "presse", "kreis", "mulden", "platt"] as const)
      expect(zielBildSvg({ bild }, "teil"), bild).toMatch(/<path d="/);
  });
});
