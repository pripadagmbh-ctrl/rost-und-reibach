/**
 * LEHRGANG TEIL 2 — was der Spieler sieht (Auftrag L8-B2, ui, 22.10.2026).
 * (Die Daten und der Lauf von Teil 2 stehen in test/lehrgang-teil2.test.ts, B1.)
 *
 * Patrick 21.10.2026: „grundsätzlich sollte es mit kaum oder keinen text
 * auskommen". Teil 2 zeigt jede Funktion ohne Wort:
 *  1. Jedes Bildzeichen von Teil 2 ist ein eigenes SVG (24er-Raster), in der
 *     Form verschieden (Farbe ist für alle gleich — nie der einzige Kanal).
 *  2. Der Geisterfinger zeigt den Kranz: tippt auf #btn-kranz, solange er zu
 *     ist, dann auf den Eintrag mit dem Tastencode (`data-code`, core/touch.ts).
 *  3. Spinne (grapple) und Rotator aus `lehrgang:richtung`: grapple über die
 *     Belegung des Spielers (Grundbelegung rechter Stick quer: rechts
 *     schließen, links öffnen — Vorbild v2, Patrick „perfekt"), Rotator als
 *     Finger, der die Drehtaste HÄLT, solange er auf keinem Stick liegt.
 *  4. Die Strich-Reihe der Lehrgangsleiste bleibt bei 23 Schritten auf dem
 *     iPhone mini lesbar (jeder Strich ≥ 4 px).
 *  5. WEITER nach dem Lehrgang führt zum Montag (Platzhalter bis W1).
 *
 * Die Ersatz-Seite ist eine eigene kleine Attrappe (wie in
 * test/lehrgangsleiste.test.ts, dort liegt sie nicht exportiert).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventBus, type GameEvents } from "../src/core/events";
import { defaultConfig, type ControlConfig } from "../src/core/controlConfig";
import { FASSUNGEN, px, wert, type Fassung } from "./cssmass";
import type { LehrgangSymbol } from "../src/challenges/lektion";
import type { Spur } from "../src/core/spur";

/** Die Zeichen von Teil 2 (challenges/lektion.ts, L8). */
const TEIL2: LehrgangSymbol[] = ["zurueck", "greifen", "rotator", "ablegen", "kranz", "last", "haemmern", "quetschen", "zerlegen", "pressen", "sortieren"];

// ---------------------------------------------------------------- Attrappe
class El {
  children: El[] = [];
  parent: El | null = null;
  attrs: Record<string, string> = {};
  dataset: Record<string, string> = {};
  stil: Record<string, string> = {};
  style: Record<string, unknown> = { setProperty: (k: string, v: string) => void (this.stil[k] = v) };
  rect = { left: 0, top: 0, width: 0, height: 0 };
  getBoundingClientRect() {
    return this.rect;
  }
  hidden = false;
  textContent: string | null = "";
  innerHTML = "";
  private hoerer: Record<string, Array<(e: unknown) => void>> = {};
  private klassen = new Set<string>();
  classList = {
    add: (...k: string[]) => k.forEach((x) => this.klassen.add(x)),
    remove: (...k: string[]) => k.forEach((x) => this.klassen.delete(x)),
    contains: (k: string) => this.klassen.has(k),
    toggle: (k: string, an?: boolean) => {
      const soll = an ?? !this.klassen.has(k);
      if (soll) this.klassen.add(k);
      else this.klassen.delete(k);
      return soll;
    },
  };
  constructor(public tag = "div", public id = "", klassen = "") {
    for (const k of klassen.split(" ").filter(Boolean)) this.klassen.add(k);
  }
  get className(): string {
    return [...this.klassen].join(" ");
  }
  set className(v: string) {
    this.klassen = new Set(v.split(" ").filter(Boolean));
  }
  get childNodes(): El[] {
    return this.children;
  }
  get offsetWidth(): number {
    return 0;
  }
  setAttribute(k: string, v: string) {
    this.attrs[k] = v;
  }
  getAttribute(k: string) {
    return this.attrs[k] ?? null;
  }
  append(...k: El[]) {
    for (const c of k) {
      c.parent = this;
      this.children.push(c);
    }
  }
  appendChild(c: El) {
    this.append(c);
    return c;
  }
  replaceChildren(...k: El[]) {
    this.children = [];
    this.append(...k);
  }
  addEventListener(t: string, f: (e: unknown) => void) {
    (this.hoerer[t] ??= []).push(f);
  }
  klick() {
    for (const f of this.hoerer["click"] ?? []) f({ preventDefault() {} });
  }
  alle(): El[] {
    return this.children.flatMap((c) => [c, ...c.alle()]);
  }
  passt(sel: string): boolean {
    const m = /^([a-z]*)((?:\.[\w-]+)*)$/.exec(sel.trim());
    if (!m) return false;
    return (!m[1] || m[1] === this.tag) && m[2]!.split(".").filter(Boolean).every((k) => this.klassen.has(k));
  }
  querySelectorAll(sel: string): El[] {
    return this.alle().filter((e) => sel.split(",").some((s) => e.passt(s)));
  }
  querySelector(sel: string): El | null {
    return this.querySelectorAll(sel)[0] ?? null;
  }
}

const KNOPF_RECT = { left: 1120, top: 66, width: 48, height: 48 }; // iPad 1180: Mitte 1144, 90 (index.html)
const ROT_L_RECT = { left: 1114, top: 532, width: 54, height: 50 }; // Mitte 1141, 557
const ROT_R_RECT = { left: 1114, top: 590, width: 54, height: 50 }; // Mitte 1141, 615
const KRANZ_CODES = ["KeyX", "KeyV", "KeyB", "KeyO"];

function seite(touch = true): { body: El; byId: (id: string) => El | null } {
  const body = new El("body");
  const leiste = new El("div", "lehrgangsleiste");
  const zeile = new El("div", "", "zeile");
  zeile.append(new El("span", "", "phase"), new El("span", "", "fn"), new El("span", "", "wort"), new El("button", "lg-skip"));
  const frage = new El("div", "", "frage");
  frage.append(new El("span", "", "fsym"), new El("button", "lg-ja"), new El("button", "lg-nein"));
  leiste.append(zeile, frage, new El("div", "", "punkte"));
  leiste.hidden = true;
  const links = new El("div", "touch-left", "pad");
  links.hidden = true;
  const rechts = new El("div", "touch-right", "pad");
  rechts.hidden = true;
  const knopf = new El("div", "btn-kranz", "btn");
  knopf.rect = { ...KNOPF_RECT };
  const radial = new El("div", "radial");
  radial.hidden = true;
  KRANZ_CODES.forEach((code, i) => {
    const s = new El("div", "", "sektor");
    s.dataset["code"] = code;
    s.textContent = code;
    s.rect = { left: 900 + 70 * i, top: 300, width: 62, height: 34 };
    radial.append(s);
  });
  const rotL = new El("div", "btn-rot-l", "btn");
  rotL.rect = { ...ROT_L_RECT };
  const rotR = new El("div", "btn-rot-r", "btn");
  rotR.rect = { ...ROT_R_RECT };
  body.append(leiste, links, rechts, knopf, radial, rotL, rotR, new El("div", "pedals"));
  if (touch) body.classList.add("touch");
  const byId = (id: string): El | null => body.alle().find((e) => e.id === id) ?? null;
  vi.stubGlobal("document", {
    body,
    getElementById: byId,
    createElement: (tag: string) => new El(tag),
    querySelector: (s: string) => body.querySelector(s),
    querySelectorAll: (s: string) => body.querySelectorAll(s),
  });
  const m = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  });
  return { body, byId };
}
afterEach(() => vi.unstubAllGlobals());

const ID = "lehrgang";
const schrittEv = (nr: number, phase: "zeigen" | "du", mehr: Partial<GameEvents["lehrgang:schritt"]> = {}): GameEvents["lehrgang:schritt"] => ({
  id: ID,
  nr,
  von: 23,
  titel: { de: "Teil 2", en: "Part 2" },
  text: { de: "", en: "" },
  zeige: null,
  phase,
  marke: null,
  symbol: null,
  teile: 1,
  ...mehr,
});
const startEv: GameEvents["lehrgang:start"] = { id: ID, nr: 1, von: 1, name: { de: "Lehrgang", en: "Course" }, ziel: { de: "", en: "" } };
const mitte = (r: { left: number; top: number; width: number; height: number }): [string, string] => [
  `${(r.left + r.width / 2).toFixed(0)}px`,
  `${(r.top + r.height / 2).toFixed(0)}px`,
];

// ---------------------------------------------------------------- 1. Bildzeichen
describe("Teil 2: jedes Bildzeichen ist ein eigenes SVG", async () => {
  const { BILD, installLektionsKarte } = await import("../src/ui/lektionskarte");

  it("alle Teil-2-Zeichen gezeichnet, 24er-Raster, keine Schrift im Zeichen", () => {
    for (const s of TEIL2) {
      const svg = BILD[s];
      expect(svg, s).toMatch(/^<svg viewBox="0 0 24 24"/);
      expect(svg, s).toMatch(/aria-hidden="true"/);
      expect(svg, `${s}: kein <text>`).not.toMatch(/<text/);
    }
  });

  it("kein Zeichen gleicht einem anderen (Form unterscheidet, nicht Farbe)", () => {
    const alle = Object.entries(BILD);
    const inhalte = new Set(alle.map(([, v]) => v));
    expect(inhalte.size).toBe(alle.length);
  });

  it("die Leiste zeigt das Zeichen des Schritts als SVG (Leisten-DOM), 23 Striche", () => {
    const { byId } = seite();
    const bus = new EventBus();
    installLektionsKarte({ bus, steuerung: defaultConfig, audio: { playSchritt() {} } });
    bus.emit("lehrgang:start", startEv);
    TEIL2.forEach((symbol, i) => {
      bus.emit("lehrgang:schritt", schrittEv(10 + i, "du", { symbol }));
      const fn = byId("lehrgangsleiste")!.querySelector(".fn")!;
      expect(fn.hidden, symbol).toBe(false);
      expect(fn.innerHTML, symbol).toBe(BILD[symbol]);
    });
    expect(byId("lehrgangsleiste")!.querySelector(".punkte")!.children.length).toBe(23);
  });
});

// ---------------------------------------------------------------- 2. Kranz
describe("Teil 2: Geisterfinger am Funktionskranz", async () => {
  const { installGeisterdaumen, kranzZiel } = await import("../src/ui/geisterdaumen");

  it("rein: zu → Knopf; offen → Eintrag; offen ohne Code → nichts; ohne Kranz → nichts", () => {
    expect(kranzZiel({ code: "KeyX" }, false)).toBe("knopf");
    expect(kranzZiel({ code: "KeyX" }, true)).toEqual({ code: "KeyX" });
    expect(kranzZiel({ code: null }, false)).toBe("knopf");
    expect(kranzZiel({ code: null }, true)).toBeNull();
    expect(kranzZiel(null, false)).toBeNull();
    expect(kranzZiel(undefined, true)).toBeNull();
  });

  it("Kranz zu → Finger tippt auf #btn-kranz; offen → auf den Sektor mit data-code; Schritt vorbei → weg", () => {
    const { body } = seite();
    const bus = new EventBus();
    let offen = false;
    const geist = installGeisterdaumen({ bus, steuerung: defaultConfig, kranzOffen: () => offen });
    bus.emit("lehrgang:start", startEv);
    bus.emit("lehrgang:schritt", schrittEv(14, "du", { symbol: "kranz", kranz: { code: "KeyB" } }));
    const f = body.querySelector(".tippgeist.kranz")!;
    expect(f.classList.contains("an")).toBe(true);
    expect(f.classList.contains("einzel"), "tippt einmal je Durchgang, kommt angewandert").toBe(true);
    expect([f.stil["left"], f.stil["top"]]).toEqual(mitte(KNOPF_RECT));
    offen = true; // Spieler tippt den Knopf
    geist.takt();
    const sektor = body.querySelectorAll(".sektor").find((s) => s.dataset["code"] === "KeyB")!;
    expect([f.stil["left"], f.stil["top"]], "auf dem Eintrag KeyB").toEqual(mitte(sektor.rect));
    expect(f.classList.contains("an")).toBe(true);
    offen = false; // Eintrag ausgeloest, Kranz zu → wieder Knopf
    geist.takt();
    expect([f.stil["left"], f.stil["top"]]).toEqual(mitte(KNOPF_RECT));
    bus.emit("lehrgang:schritt", schrittEv(15, "du", { symbol: "greifen" }));
    expect(f.classList.contains("an"), "naechster Schritt ohne Kranz").toBe(false);
  });

  it("code null: Finger nur auf dem Knopf, offen kein Finger", () => {
    const { body } = seite();
    const bus = new EventBus();
    let offen = false;
    const geist = installGeisterdaumen({ bus, steuerung: defaultConfig, kranzOffen: () => offen });
    bus.emit("lehrgang:start", startEv);
    bus.emit("lehrgang:schritt", schrittEv(14, "du", { kranz: { code: null } }));
    const f = body.querySelector(".tippgeist.kranz")!;
    expect(f.classList.contains("an")).toBe(true);
    offen = true;
    geist.takt();
    expect(f.classList.contains("an")).toBe(false);
  });

  it("auf Touch kein Schild mit dem Kranznamen, wenn der Finger ihn zeigt", () => {
    const { body } = seite();
    const bus = new EventBus();
    installGeisterdaumen({ bus, steuerung: defaultConfig, kranzOffen: () => false });
    const spur: Spur = [{ dauerS: 1, tasten: ["KeyB"] }];
    bus.emit("lehrgang:start", startEv);
    bus.emit("lehrgang:schritt", schrittEv(14, "zeigen", { kranz: { code: "KeyB" } }));
    bus.emit("lehrgang:vorfuehren", { spur });
    bus.emit("lehrgang:schritt", schrittEv(14, "du", { kranz: { code: "KeyB" } }));
    const schild = body.querySelector(".tastengeist")!;
    expect(schild.classList.contains("an")).toBe(false);
    expect(body.querySelector(".tippgeist.kranz")!.classList.contains("an")).toBe(true);
  });

  it("GEGENPROBE: Schritt ohne Kranz → kein Kranz-Finger; am PC (kein Touch) → kein Finger", () => {
    for (const touch of [true, false]) {
      const { body } = seite(touch);
      const bus = new EventBus();
      installGeisterdaumen({ bus, steuerung: defaultConfig, kranzOffen: () => false });
      bus.emit("lehrgang:start", startEv);
      bus.emit("lehrgang:schritt", schrittEv(14, "du", touch ? {} : { kranz: { code: "KeyB" } }));
      expect(body.querySelector(".tippgeist.kranz")!.classList.contains("an"), `touch ${touch}`).toBe(false);
    }
  });

  it("L8-Nachtrag: am PC steht bei Kranz-Schritten die Taste als Schild (O, B, 2) — auf Touch nicht, ohne Kranz nicht", async () => {
    const { pcTaste } = await import("../src/ui/geisterdaumen");
    expect(["KeyO", "KeyB", "Digit2"].map(pcTaste)).toEqual(["O", "B", "2"]);
    for (const [touch, kranz, soll] of [
      [false, { code: "KeyO" }, "O"],
      [false, { code: "Digit2" }, "2"],
      [false, null, ""], // GEGENPROBE: Schritt ohne Kranz
      [true, { code: "KeyO" }, ""], // GEGENPROBE: Touch zeigt den Finger, kein Schild
    ] as const) {
      const { body } = seite(touch);
      const bus = new EventBus();
      const geist = installGeisterdaumen({ bus, steuerung: defaultConfig, kranzOffen: () => false });
      bus.emit("lehrgang:start", startEv);
      bus.emit("lehrgang:schritt", schrittEv(15, "du", kranz ? { kranz } : {}));
      geist.takt();
      const schild = body.querySelector(".tastengeist")!;
      expect(schild.classList.contains("pc"), `touch ${touch}, ${kranz?.code}`).toBe(soll !== "");
      if (soll) expect(schild.textContent).toBe(soll);
    }
  });

  it("ohne kranzOffen-Anschluss gilt der Kranz als zu (Finger bleibt am Knopf)", () => {
    const { body } = seite();
    const bus = new EventBus();
    installGeisterdaumen({ bus, steuerung: defaultConfig });
    bus.emit("lehrgang:start", startEv);
    bus.emit("lehrgang:schritt", schrittEv(14, "du", { kranz: { code: "KeyX" } }));
    const f = body.querySelector(".tippgeist.kranz")!;
    expect([f.stil["left"], f.stil["top"]]).toEqual(mitte(KNOPF_RECT));
  });
});

// ---------------------------------------------------------------- 3. Spinne und Rotator
describe("Teil 2: Spinne und Rotator aus lehrgang:richtung", async () => {
  const { installGeisterdaumen, drehtasteAus } = await import("../src/ui/geisterdaumen");

  const richtung = (bus: EventBus, nr: number, bedarf: GameEvents["lehrgang:richtung"]["bedarf"]): void =>
    bus.emit("lehrgang:richtung", { id: ID, nr, bedarf, kamera: null });
  const lauf = (c: () => ControlConfig) => {
    const { body, byId } = seite();
    const bus = new EventBus();
    const geist = installGeisterdaumen({ bus, steuerung: c });
    bus.emit("lehrgang:start", startEv);
    bus.emit("lehrgang:schritt", schrittEv(15, "du", { symbol: "greifen" }));
    return { body, byId, bus, geist };
  };

  it("grapple plus (schließen) → rechter Stick nach rechts; minus (öffnen) → nach links (Grundbelegung)", () => {
    const { body, bus } = lauf(defaultConfig);
    const rechts = body.querySelector(".geist.rechts")!;
    richtung(bus, 15, [{ fn: "grapple", richtung: "plus" }]);
    expect(rechts.classList.contains("an")).toBe(true);
    expect(rechts.dataset["pfeil"]).toBe("rechts");
    expect(body.querySelector(".geist.links")!.classList.contains("an")).toBe(false);
    richtung(bus, 15, [{ fn: "grapple", richtung: "minus" }]);
    expect(rechts.dataset["pfeil"]).toBe("links");
  });

  it("umgelegte Belegung: rechte Querachse umgekehrt → schließen zeigt nach links; Spinne auf dem linken Stick → linke Seite", () => {
    const umgekehrt = (): ControlConfig => {
      const c = defaultConfig();
      c.rightX = { ...c.rightX, invert: true };
      return c;
    };
    const a = lauf(umgekehrt);
    richtung(a.bus, 15, [{ fn: "grapple", richtung: "plus" }]);
    expect(a.body.querySelector(".geist.rechts")!.dataset["pfeil"]).toBe("links");

    const getauscht = (): ControlConfig => {
      const c = defaultConfig();
      const l = c.leftX;
      c.leftX = c.rightX;
      c.rightX = l;
      return c;
    };
    const b = lauf(getauscht);
    richtung(b.bus, 15, [{ fn: "grapple", richtung: "plus" }]);
    expect(b.body.querySelector(".geist.links")!.dataset["pfeil"]).toBe(getauscht().leftX.invert ? "links" : "rechts");
    expect(b.body.querySelector(".geist.rechts")!.classList.contains("an")).toBe(false);
  });

  it("rotator plus → Finger hält ↻ (#btn-rot-r), minus → ↺ (#btn-rot-l); kein Stick-Geist", () => {
    const { body, bus, byId } = lauf(defaultConfig);
    const f = body.querySelector(".tippgeist.halten")!;
    richtung(bus, 15, [{ fn: "rotator", richtung: "plus" }]);
    expect(f.classList.contains("an")).toBe(true);
    expect([f.stil["left"], f.stil["top"]]).toEqual(mitte(ROT_R_RECT));
    expect(byId("btn-rot-r")!.classList.contains("geist-zeigt")).toBe(true);
    expect(body.querySelector(".geist.rechts")!.classList.contains("an")).toBe(false);
    richtung(bus, 15, [{ fn: "rotator", richtung: "minus" }]);
    expect([f.stil["left"], f.stil["top"]]).toEqual(mitte(ROT_L_RECT));
    expect(byId("btn-rot-l")!.classList.contains("geist-zeigt")).toBe(true);
    expect(byId("btn-rot-r")!.classList.contains("geist-zeigt")).toBe(false);
  });

  it("hält der Spieler die Drehtaste selbst, tritt der Finger zurück; loslassen → wieder da", () => {
    const { body, bus, byId, geist } = lauf(defaultConfig);
    const f = body.querySelector(".tippgeist.halten")!;
    richtung(bus, 15, [{ fn: "rotator", richtung: "plus" }]);
    byId("btn-rot-r")!.classList.add("down");
    geist.takt();
    expect(f.classList.contains("an")).toBe(false);
    byId("btn-rot-r")!.classList.remove("down");
    geist.takt();
    expect(f.classList.contains("an")).toBe(true);
  });

  it("GEGENPROBE: Rotator auf einem Stick → Stick-Geist statt Finger", () => {
    const aufStick = (): ControlConfig => {
      const c = defaultConfig();
      c.rightY = { ...c.rightY, fn: "rotator" };
      return c;
    };
    const { body, bus } = lauf(aufStick);
    richtung(bus, 15, [{ fn: "rotator", richtung: "plus" }]);
    expect(body.querySelector(".tippgeist.halten")!.classList.contains("an")).toBe(false);
    // plus = Bildschirm unten, ausser die Achse ist umgekehrt (stickRichtung)
    expect(body.querySelector(".geist.rechts")!.dataset["pfeil"]).toBe(aufStick().rightY.invert ? "hoch" : "runter");
    expect(drehtasteAus([{ fn: "rotator", richtung: "plus" }], null, aufStick())).toBe(0);
  });

  it("GEGENPROBE: andere Bedarfe (Hauptarm) → kein Halte-Finger", () => {
    const { body, bus } = lauf(defaultConfig);
    richtung(bus, 15, [{ fn: "boom", richtung: "plus" }]);
    expect(body.querySelector(".tippgeist.halten")!.classList.contains("an")).toBe(false);
  });

  it("rein: ohne Richtungsmeldung zählt die Spur; die Meldung hat Vorrang", () => {
    const spur: Spur = [{ dauerS: 1 }, { dauerS: 1, achsen: { rotator: -0.8 } }];
    expect(drehtasteAus(null, spur, defaultConfig())).toBe(-1);
    expect(drehtasteAus([{ fn: "rotator", richtung: "plus" }], spur, defaultConfig())).toBe(1);
    expect(drehtasteAus([], spur, defaultConfig()), "Lauf sagt: gerade nichts").toBe(0);
    expect(drehtasteAus(null, null, defaultConfig())).toBe(0);
  });

  it("Vorführung mit Rotator-Spur: der Finger hält die Drehtaste, solange die Spur dreht", () => {
    const { body, byId } = seite();
    const bus = new EventBus();
    const werte = { achsen: { cab: 0, boom: 0, stick: 0, grapple: 0, rotator: 0.8, drive: 0, steer: 0 }, kamera: null, abschnitt: 0 };
    const vorf = { werte: werte as typeof werte | null, gedrueckt: null };
    const geist = installGeisterdaumen({ bus, steuerung: defaultConfig, vorfuehrung: vorf });
    bus.emit("lehrgang:start", startEv);
    bus.emit("lehrgang:schritt", schrittEv(16, "zeigen", { symbol: "rotator" }));
    bus.emit("lehrgang:vorfuehren", { spur: [{ dauerS: 1, achsen: { rotator: 0.8 } }] });
    const f = body.querySelector(".tippgeist.halten")!;
    expect(f.classList.contains("an")).toBe(true);
    expect([f.stil["left"], f.stil["top"]]).toEqual(mitte(ROT_R_RECT));
    expect(byId("btn-rot-r")!.classList.contains("geist-zeigt")).toBe(true);
    werte.achsen.rotator = 0; // Spur dreht nicht mehr
    geist.takt();
    expect(f.classList.contains("an")).toBe(false);
  });
});

// ---------------------------------------------------------------- 4. Strich-Reihe
/**
 * Die Striche teilen sich die Innenbreite der schmalsten Leiste (`min-width`,
 * die Rückfrage schrumpft genau darauf) nach `flex`; ein geteilter Strich
 * (Teilziele, Zoom) zählt seit L8-B2 doppelt.
 */
function strichBreiten(f: Fassung, n: number, geteilt: boolean): { strich: number; haelfte: number } {
  const L = ["#lehrgangsleiste"];
  const P = ["#lehrgangsleiste .punkte"];
  const G = ["#lehrgangsleiste .punkte i.geteilt"];
  const pad = [...(wert(L, "padding", f) ?? "").matchAll(/(\d+)px/g)].map((m) => Number(m[1]));
  const seitlich = pad[1]!; // "4px 6px 5px": links = rechts = 6
  const rahmen = Number(/^(\d+)px/.exec(wert(L, "border", f) ?? "")![1]);
  const innen = px(L, "min-width", f) - 2 * rahmen - 2 * seitlich;
  const luecke = px(P, "gap", f);
  const flexGeteilt = geteilt ? Number(wert(G, "flex", f) ?? 1) : 1;
  const einheit = (innen - (n - 1) * luecke) / (n - 1 + flexGeteilt);
  return { strich: einheit, haelfte: (einheit * flexGeteilt - px(G, "gap", f)) / 2 };
}

describe("Teil 2: Strich-Reihe der Leiste bei 23 Schritten", () => {
  const MINI = FASSUNGEN.find((f) => f.name === "iPhone mini quer")!;
  const MIN_PX = 4; // Auftrag L8-B2: jeder Strich mindestens 4 px

  it("iPhone mini quer: jeder Strich ≥ 4 px, auch die Hälften eines geteilten Strichs", () => {
    const b = strichBreiten(MINI, 23, true);
    expect(b.strich).toBeGreaterThanOrEqual(MIN_PX);
    expect(b.haelfte).toBeGreaterThanOrEqual(MIN_PX);
    // Zahlen wie im CSS-Kommentar (index.html, i.geteilt): 6,2 px je Strich, 5,2 px je Haelfte
    expect(b.strich.toFixed(1)).toBe("6.2");
    expect(b.haelfte.toFixed(1)).toBe("5.2");
  });

  it("die Schritte, die der Lehrgang gerade wirklich hat (Daten B1), bleiben ebenfalls ≥ 4 px", async () => {
    const { LEKTIONEN } = await import("../src/challenges/lehrgang");
    const n = Math.max(23, ...LEKTIONEN.map((l) => l.schritte.length));
    const b = strichBreiten(MINI, n, true);
    expect(b.strich, `${n} Schritte`).toBeGreaterThanOrEqual(MIN_PX);
    expect(b.haelfte, `${n} Schritte, Haelfte`).toBeGreaterThanOrEqual(MIN_PX);
  });

  it("GEGENPROBE: ohne den doppelt breiten geteilten Strich wäre die Hälfte unter 4 px; bei 40 Schritten der Strich", () => {
    const ohneFlex = strichBreiten(MINI, 23, false);
    expect((ohneFlex.strich - 2) / 2).toBeLessThan(MIN_PX);
    expect(strichBreiten(MINI, 40, false).strich).toBeLessThan(MIN_PX);
  });
});

// ---------------------------------------------------------------- 5. Nach dem Lehrgang
describe("Teil 2: nach dem Lehrgang → Montag (Platzhalter bis W1)", async () => {
  const { tagNachDemLehrgang, nachDemLehrgang } = await import("../src/ui/schichtmenue");
  const { installAbrechnung } = await import("../src/ui/abrechnung");
  const { setzeSprachquelle } = await import("../src/challenges/texte");

  it("der erste freie Tag ist Montag; nachDemLehrgang lädt mit #schicht=montag wie das Hauptmenü", () => {
    expect(tagNachDemLehrgang()).toBe("montag");
    const neu = vi.fn();
    const ort = { hash: "#lektion=lehrgang", reload: neu };
    vi.stubGlobal("location", ort);
    nachDemLehrgang();
    expect(ort.hash).toBe("schicht=montag");
    expect(neu).toHaveBeenCalledTimes(1);
  });

  for (const [s, text] of [["de", "MONTAG"], ["en", "MONDAY"]] as const) {
    it(`Tafel LEHRGANG GESCHAFFT (${s}): WEITER heißt ${text}, kein „Prüfung", und startet die Montag-Schicht`, () => {
      const { body } = seite();
      for (const id of ["abrechnung", "abr-kopf", "abr-sterne", "abr-zahlen", "abr-weiter", "abr-menue", "abr-naechste"]) body.append(new El("div", id));
      vi.stubGlobal("window", { addEventListener() {} });
      setzeSprachquelle(() => s);
      const neu = vi.fn();
      const ort = { hash: "", reload: neu, pathname: "/v1/", search: "" };
      vi.stubGlobal("location", ort);
      const bus = new EventBus();
      installAbrechnung({
        bus,
        shift: {} as never,
        hud: { toast() {} },
        audio: { playFeierabend() {}, playSterne() {} },
        funk: { torschluss() {}, neuerTag() {} },
        konto: () => 0,
        ruf: { get: () => 0 },
        daylight: { time: 0, neuerTag: false },
        lektionen: [{ id: ID }],
      });
      bus.emit("lehrgang:geschafft", { id: ID, nr: 1, name: { de: "Lehrgang", en: "Course" }, zeitS: 120 });
      const weiter = body.alle().find((e) => e.id === "abr-weiter")!;
      expect(weiter.textContent).toBe(text);
      expect(weiter.textContent).not.toMatch(/PRÜFUNG|TEST/);
      // L8-Nachtrag: keine Zeitzeile — der Lehrgang hat keine Uhr (nach Wiedereinstieg zaehlte sie nur ab dort)
      expect(body.alle().find((e) => e.id === "abr-zahlen")!.children).toHaveLength(0);
      weiter.klick();
      expect(ort.hash).toBe("schicht=montag");
      expect(neu).toHaveBeenCalledTimes(1);
      setzeSprachquelle(() => "de");
    });
  }
});
