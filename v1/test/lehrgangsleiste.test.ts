/**
 * LEHRGANG OHNE TEXT IM BLICKFELD (L4, Patrick 21.10.2026: „grundsätzlich
 * sollte es mit kaum oder keinen text auskommen, weil der text die ganze sicht
 * verdeckt … sollte irgendwie gehighlighten sein, wenn eine aktion
 * erfolgreich war … sollte auch geskippt werden können").
 *
 * Teil 1 — aus dem CSS gerechnet (`test/cssmass.ts`), iPad quer und iPhone
 * mini quer:
 *  - DIE MITTELZONE: waagerecht zwischen den Innenkanten der beiden
 *    Geisterdaumen-Ringe, senkrecht 25–85 % der Höhe. Begründung: Links und
 *    rechts der Ringe liegt die Bedienung (Sticks, Pedale, Drehtasten), oben
 *    der Himmel über dem Bagger, unten die Pedale; dazwischen stehen in der
 *    Startkamera Bagger, Spinne und Arbeitsfeld (iPhone mini quer x 168..644
 *    = 59 % der Breite, iPad x 249..775 = 51 %). Dort darf im Lehrgang kein
 *    Buchstabe stehen.
 *    L4b (qa Q4 Befund 7: im Spiel gemessen mini 118..694, iPad rechts 931):
 *    Die Rechnung ist dieselbe, nur die Fassung nicht. Die Ringe sitzen
 *    `calc(var(--sa-l|r) + 38px)` vom Rand; auf dem echten iPhone mini meldet
 *    Safari quer 50 px sicheren Rand je Seite (`cssmass.ts`), headless
 *    Chromium 0 px — 50 + 38 + 80 = 168 statt 118, rechts 812 − 168 = 644
 *    statt 694. Das iPad der Messung war 1180 breit, die Fassung hier 1024:
 *    1180 − 111 − 138 = 931 statt 775. Mit Rand ist die Zone enger als
 *    headless — der Wächter prüft also den strengeren Fall auf dem Gerät.
 *    Beide gemessenen Fassungen stehen unten als eigene Prüfung.
 *  - Leiste, ⏭ und Rückfrage ✓/✕ liegen im Kamera-Mittelstreifen (dort setzt
 *    nie ein Stick auf), Knöpfe ≥ 44 px, frei vom Menüknopf, über der Zone.
 *  - Gegenprobe: Die alte Lektionskarte (E-196) reißt den Wächter.
 * Teil 2 — „kaum Text": Alles, was im Lehrgang sichtbar Buchstaben trägt, ist
 * höchstens EIN Wort. Gegenprobe: die alten Kartentexte.
 * Teil 3 — eine kleine Ersatz-Seite (kein Browser): Erfolgs-Signal bei
 * `lehrgang:haekchen`, Überspringen merkt sich und führt ins Menü.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { FASSUNGEN, knopfKasten, luft, px, pxOderNull, schriftgroesse, ueberlappt, wert, zeilenabstand, EM_BREITE, type Fassung, type Kasten, type Rand } from "./cssmass";
import { EventBus, type GameEvents } from "../src/core/events";
import { LEKTIONEN } from "../src/challenges/lehrgang";
import { tastenText } from "../src/ui/geisterdaumen";
import { WORTE } from "../src/ui/aufgabentexte";
import { LEHRGANG_KEY, leseLehrgang, leererLehrgang } from "../src/core/save";

const QUER = FASSUNGEN.filter((f) => f.w > f.h);
const L = ["#lehrgangsleiste"];
const KNOPF = ["#lehrgangsleiste button"];
const ZEILE = ["#lehrgangsleiste .zeile", "#lehrgangsleiste .frage"];
const PUNKTE = ["#lehrgangsleiste .punkte"];

/** Zahl aus einer Angabe „4px 6px 5px" an Stelle i (oben, rechts, unten, links wie CSS). */
function viererWert(sel: string[], prop: string, f: Fassung, i: 0 | 1 | 2 | 3): number {
  const v = wert(sel, prop, f);
  if (v === null) throw new Error(`${prop} fehlt fuer ${sel[0]}`);
  const z = [...v.matchAll(/(\d+(?:\.\d+)?)(?:px)?/g)].map((m) => Number(m[1]));
  const vier = z.length === 1 ? [z[0], z[0], z[0], z[0]] : z.length === 2 ? [z[0], z[1], z[0], z[1]] : z.length === 3 ? [z[0], z[1], z[2], z[1]] : z;
  return vier[i]!;
}
const rahmen = (f: Fassung): number => Number(/^(\d+)px/.exec(wert(L, "border", f) ?? "")?.[1] ?? NaN);

/** Kasten in Bildkoordinaten von OBEN gerechnet, für die Rechnung unten nach `Kasten` (von unten) umgesetzt. */
const vonOben = (name: string, f: Fassung, x0: number, x1: number, oben: number, unten: number): Kasten => ({
  name, x0, x1, y0: f.h - unten, y1: f.h - oben,
});

function leiste(f: Fassung): { kasten: Kasten; skip: Kasten; ja: Kasten; nein: Kasten; wort: Kasten } {
  expect(wert(L, "left", f)).toBe("50%");
  const breite = px(L, "width", f);
  const x0 = f.w / 2 + px(L, "margin-left", f);
  const b = rahmen(f);
  const [pt, pr, pb, pl] = ([0, 1, 2, 3] as const).map((i) => viererWert(L, "padding", f, i));
  const zeile = px(ZEILE, "height", f);
  const hoehe = 2 * b + pt! + zeile + px(PUNKTE, "margin-top", f) + px(PUNKTE, "height", f) + pb!;
  const oben = px(L, "top", f);
  const kasten = vonOben("Leiste", f, x0, x0 + breite, oben, oben + hoehe);
  const kw = px(KNOPF, "width", f);
  const kh = px(KNOPF, "height", f);
  const zOben = oben + b + pt!;
  const kOben = zOben + (zeile - kh) / 2; // align-items: center
  const ende = x0 + breite - b - pr!;
  const luecke = px(ZEILE, "gap", f);
  const jaRand = px(["#lehrgangsleiste #lg-ja"], "margin-right", f);
  const skip = vonOben("⏭", f, ende - kw, ende, kOben, kOben + kh);
  const nein = vonOben("✕", f, ende - kw, ende, kOben, kOben + kh);
  const jaEnde = ende - kw - luecke - jaRand;
  const ja = vonOben("✓", f, jaEnde - kw, jaEnde, kOben, kOben + kh);
  const wortAb = x0 + b + pl! + 2 * (px(["#lehrgangsleiste .phase", "#lehrgangsleiste .fn"], "width", f) + luecke);
  const wort = vonOben("Wort", f, wortAb, ende - kw - luecke, zOben, zOben + zeile);
  return { kasten, skip, ja, nein, wort };
}

function ring(seite: "links" | "rechts", f: Fassung): Kasten {
  const sel = ["#geisterdaumen .geist", `#geisterdaumen .geist.${seite}`];
  const w = px(sel, "width", f);
  const unten = px(sel, "bottom", f);
  const x0 = seite === "links" ? px(sel, "left", f) : f.w - px(sel, "right", f) - w;
  return { name: `Ring ${seite}`, x0, x1: x0 + w, y0: unten, y1: unten + px(sel, "height", f) };
}

/** Die Mittelzone (Begründung oben). */
function mittelzone(f: Fassung): Kasten {
  return { name: "Mittelzone", x0: ring("links", f).x1, x1: ring("rechts", f).x0, y0: 0.15 * f.h, y1: 0.75 * f.h };
}

/** Das Knopf-Schild mit dem längsten Text, der vorkommen kann. */
function schild(f: Fassung, text: string): Kasten {
  const sel = ["#geisterdaumen .tastengeist"];
  const schrift = 14; // `font: 700 14px` (Kurzform, siehe unten geprueft)
  expect(wert(sel, "font", f)).toMatch(/\b14px\b/);
  const [py, pxx] = [6, 10]; // `padding: 6px 10px`
  expect(wert(sel, "padding", f)).toBe("6px 10px");
  const b = 2; // `border: 2px solid`
  const w = text.length * schrift * EM_BREITE + 2 * pxx + 2 * b;
  const h = Math.ceil(schrift * 1.2) + 2 * py + 2 * b;
  const rechts = px(sel, "right", f);
  const unten = px(sel, "bottom", f);
  return { name: `Schild „${text}"`, x0: f.w - rechts - w, x1: f.w - rechts, y0: unten, y1: unten + h };
}

/*
 * Die längste Aufschrift eines Kranzeintrags: 9 Zeichen („ZUR WAAGE") — so
 * breit ist ein Kranz-Sektor gebaut (index.html `#radial .sektor`, 62 px).
 */
const KRANZ_LAENGSTER = "ZUR WAAGE";

/** Die alte Lektionskarte (E-196): Kopf, Ziel, Titel, Text zwei Zeilen, Hinweis — wie in aufgabenkarte-platz gerechnet. */
function alteKarte(f: Fassung): Kasten {
  const HALTER = ["#tutorial", "#tutorial.aufgabe", "body.touch #tutorial", "body.touch #tutorial.aufgabe"];
  const KARTE = ["#tutorial .karte", "#tutorial.aufgabe .karte"];
  const ZUSATZ = ["#tutorial.aufgabe .zusatz"];
  const links = px(HALTER, "left", f);
  const breite = pxOderNull(HALTER, "width", f)!;
  const oben = px(HALTER, "top", f);
  const padY = viererWert(KARTE, "padding", f, 0);
  const zeile = Math.ceil(schriftgroesse(ZUSATZ, f) * zeilenabstand(ZUSATZ, f));
  const hoehe = 2 * 2 + 2 * padY + px(["#tutorial .kopf", "#tutorial.aufgabe .kopf"], "min-height", f) + 5 * zeile;
  return vonOben("alte Lektionskarte", f, links, links + breite, oben, oben + hoehe);
}

describe("Mittelzone nachgerechnet: die Fassungen der Messung Q4 (headless, ohne sicheren Rand)", () => {
  const OHNE: Rand = { l: 0, r: 0, t: 0, b: 0 };
  const GEMESSEN: Array<{ f: Fassung; zone: [number, number]; geraet: Fassung }> = [
    { f: { name: "iPhone mini quer, headless", w: 812, h: 375, sa: OHNE }, zone: [118, 694], geraet: QUER.find((f) => f.name === "iPhone mini quer")! },
    { f: { name: "iPad quer 1180, headless", w: 1180, h: 820, sa: OHNE }, zone: [249, 931], geraet: QUER.find((f) => f.name === "iPad quer")! },
  ];
  for (const { f, zone, geraet } of GEMESSEN) {
    it(`${f.name}: Ringe wie im Spiel gemessen, kein Text in der Zone`, () => {
      const z = mittelzone(f);
      expect([Math.round(z.x0), Math.round(z.x1)]).toEqual(zone);
      const l = leiste(f);
      for (const k of [l.kasten, l.wort, ...["2× ANSICHT", "2× VIEW", KRANZ_LAENGSTER].map((t) => schild(f, t))])
        expect(ueberlappt(k, z), `${k.name}: ${JSON.stringify([k, z])}`).toBe(false);
      // Abstand der Ringe vom Rand: auf dem Gerät um den sicheren Rand weiter innen, sonst gleich
      const g = mittelzone(geraet);
      expect(z.x0 + geraet.sa.l).toBe(g.x0);
      expect(f.w - z.x1 + geraet.sa.r).toBe(geraet.w - g.x1);
    });
  }
});

describe("Lehrgang: kein Text im Blickfeld (aus dem CSS)", () => {
  for (const f of QUER) {
    describe(f.name, () => {
      const zone = mittelzone(f);
      const l = leiste(f);
      const streifen = { x0: f.w * 0.35, x1: f.w * 0.65 }; // index.html `#touch #zone-mitte`

      it("die Mittelzone ist so breit, wie oben begründet", () => {
        expect([Math.round(zone.x0), Math.round(zone.x1)]).toEqual(f.name === "iPad quer" ? [249, 775] : [168, 644]);
      });

      it("Leiste, ⏭, ✓ und ✕ im Kamera-Mittelstreifen — keine Stick-Zone", () => {
        for (const k of [l.kasten, l.skip, l.ja, l.nein]) {
          expect(k.x0, `${k.name} ragt in die linke Stick-Zone`).toBeGreaterThan(streifen.x0);
          expect(k.x1, `${k.name} ragt in die rechte Stick-Zone`).toBeLessThan(streifen.x1);
        }
      });

      it("Knöpfe 44 × 44 px; ✕ genau unter ⏭, ✓ mit Abstand daneben", () => {
        for (const k of [l.skip, l.ja, l.nein]) {
          expect(k.x1 - k.x0, k.name).toBeGreaterThanOrEqual(44);
          expect(k.y1 - k.y0, k.name).toBeGreaterThanOrEqual(44);
        }
        expect(l.nein).toEqual({ ...l.skip, name: "✕" });
        expect(luft(l.ja, l.nein), "✓ und ✕ auseinander").toBeGreaterThanOrEqual(12);
      });

      it("Leiste über der Mittelzone, frei vom Menüknopf, im sichtbaren Bild", () => {
        expect(ueberlappt(l.kasten, zone), JSON.stringify([l.kasten, zone])).toBe(false);
        expect(f.h - l.kasten.y0, "Unterkante").toBeLessThanOrEqual(0.25 * f.h);
        expect(luft(l.kasten, knopfKasten("btn-menu", f))).toBeGreaterThanOrEqual(4);
        expect(f.h - l.kasten.y1).toBeGreaterThanOrEqual(f.sa.t);
      });

      it("die Zahlen im CSS-Kommentar stimmen", () => {
        const r = (k: Kasten) => [k.x0, k.x1, f.h - k.y1, f.h - k.y0];
        if (f.name === "iPhone mini quer") {
          expect(r(l.kasten)).toEqual([292, 520, 8, 74]);
          expect([l.skip.x0, l.skip.x1, l.ja.x0, l.ja.x1]).toEqual([469, 513, 411, 455]);
        } else {
          expect(r(l.kasten)).toEqual([398, 626, 8, 74]);
        }
      });

      it("kein Buchstabe in der Mittelzone: Wort der Leiste, Knopf-Schild mit dem längsten Text", () => {
        const texte = [l.wort, ...["2× ANSICHT", "2× VIEW", KRANZ_LAENGSTER].map((t) => schild(f, t))];
        for (const k of texte) expect(ueberlappt(k, zone), `${k.name}: ${JSON.stringify([k, zone])}`).toBe(false);
      });

      if (f.name === "iPhone mini quer") {
        it("Gegenprobe: die alte Lektionskarte reißt den Wächter", () => {
          expect(ueberlappt(alteKarte(f), zone)).toBe(true);
        });
      }
    });
  }
});

// --- Teil 2: kaum Text
/** Buchstaben-Wörter (ein „2×" oder „✓" zählt nicht als Wort). */
const woerter = (t: string): string[] => t.split(/\s+/).filter((w) => /[A-Za-zÄÖÜäöüß]{2,}/.test(w));

describe("Lehrgang: höchstens ein Wort je sichtbarem Text", () => {
  const kranz = (code: string) => (code === "KeyO" ? KRANZ_LAENGSTER : null);
  const sichtbar = (s: "de" | "en"): string[] => [
    tastenText("KeyC", kranz, s)!,
    tastenText("KeyO", kranz, s)!.replace(" ", ""), // Kranzname = ein Eintrag, egal ob mit Leerzeichen
    ...LEKTIONEN.flatMap((l) => l.schritte.flatMap((st) => (st.wort ? [st.wort[s]] : []))),
  ];
  for (const s of ["de", "en"] as const) {
    it(s, () => {
      for (const t of sichtbar(s)) expect(woerter(t).length, t).toBeLessThanOrEqual(1);
    });
  }
  it("Gegenprobe: die alten Kartenzeilen (Titel, Bedientext) hätten den Wächter gerissen", () => {
    const st = LEKTIONEN[0]!.schritte[0]!;
    expect(woerter(`Schau zu: ${st.titel.de}`).length).toBeGreaterThan(1);
    expect(woerter(st.text.de).length).toBeGreaterThan(1);
    expect(woerter("ANSICHT: 2× tippen").length).toBeGreaterThan(1);
  });
});

// --- Teil 3: Ersatz-Seite
/** Genug DOM für Leiste, Geisterdaumen und Menüweg — einfache Selektoren (#id, .a.b, tag), Listen mit Komma. */
class El {
  children: El[] = [];
  parent: El | null = null;
  attrs: Record<string, string> = {};
  dataset: Record<string, string> = {};
  style = { setProperty() {} };
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

function seite(): { body: El; byId: (id: string) => El | null } {
  const body = new El("body");
  const leiste = new El("div", "lehrgangsleiste");
  const zeile = new El("div", "", "zeile");
  zeile.append(new El("span", "", "phase"), new El("span", "", "fn"), new El("span", "", "wort"), new El("button", "lg-skip"));
  const frage = new El("div", "", "frage");
  frage.append(new El("span", "", "fsym"), new El("button", "lg-ja"), new El("button", "lg-nein"));
  leiste.append(zeile, frage, new El("div", "", "punkte"));
  leiste.hidden = true;
  const links = new El("div", "touch-left", "pad");
  links.hidden = false; // der echte Daumen liegt noch auf dem linken Stick
  const rechts = new El("div", "touch-right", "pad");
  rechts.hidden = true;
  body.append(leiste, links, rechts, new El("div", "pedals"));
  body.classList.add("touch");
  const byId = (id: string): El | null => (body.id === id ? body : (body.alle().find((e) => e.id === id) ?? null));
  vi.stubGlobal("document", {
    body,
    getElementById: byId,
    createElement: (tag: string) => new El(tag),
    querySelector: (s: string) => body.querySelector(s),
    querySelectorAll: (s: string) => body.querySelectorAll(s),
  });
  return { body, byId };
}

function speicher(): Map<string, string> {
  const m = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  });
  return m;
}
afterEach(() => vi.unstubAllGlobals());

const L1 = LEKTIONEN[0]!;
const schrittEv = (nr: number, phase: "zeigen" | "du"): GameEvents["lehrgang:schritt"] => {
  const st = L1.schritte[nr - 1]!;
  return { id: L1.id, nr, von: L1.schritte.length, titel: st.titel, text: st.text, zeige: st.zeige, phase, marke: null };
};
const startEv: GameEvents["lehrgang:start"] = { id: L1.id, nr: 1, von: 1, name: L1.name, ziel: L1.ziel };

describe("Lehrgangsleiste auf einer Ersatz-Seite", async () => {
  const { installLektionsKarte, BILD } = await import("../src/ui/lektionskarte");
  const { installGeisterdaumen } = await import("../src/ui/geisterdaumen");
  const { defaultConfig } = await import("../src/core/controlConfig");

  it("Start zeigt die Leiste, #tutorial bleibt unberührt; Striche = Schritte", () => {
    speicher();
    const { byId } = seite();
    const bus = new EventBus();
    installLektionsKarte({ bus, steuerung: defaultConfig, audio: { playSchritt() {} } });
    bus.emit("lehrgang:start", startEv);
    bus.emit("lehrgang:schritt", schrittEv(3, "zeigen"));
    const l = byId("lehrgangsleiste")!;
    expect(l.hidden).toBe(false);
    expect(l.querySelector(".phase")!.innerHTML).toBe(BILD.auge);
    expect(l.getAttribute("aria-label")).toMatch(/^Schritt 3 von \d+ · Schau zu: /);
    const striche = l.querySelector(".punkte")!.children.map((c) => c.className);
    expect(striche.length).toBe(L1.schritte.length);
    expect(striche.slice(0, 3)).toEqual(["ok", "ok", "jetzt"]);
    bus.emit("lehrgang:schritt", schrittEv(3, "du"));
    expect(l.querySelector(".phase")!.innerHTML).toBe(BILD.hand);
    expect(byId("tutorial")).toBeNull(); // die Leiste fragt nie nach der Karte
  });

  it("Erfolgs-Signal bei lehrgang:haekchen: ✓, gruener Strich, Klack, Geist und echter Stick leuchten, Fortschritt gespeichert", () => {
    const m = speicher();
    const { byId, body } = seite();
    const bus = new EventBus();
    let klack = 0;
    installLektionsKarte({ bus, steuerung: defaultConfig, audio: { playSchritt: () => klack++ } });
    installGeisterdaumen({ bus, steuerung: defaultConfig });
    bus.emit("lehrgang:start", startEv);
    const nr = L1.schritte.findIndex((st) => st.zeige?.fn === "cab") + 1; // ein Stick-Schritt
    bus.emit("lehrgang:schritt", schrittEv(nr, "du"));
    bus.emit("lehrgang:haekchen", { id: L1.id, nr });
    const l = byId("lehrgangsleiste")!;
    expect(klack).toBe(1);
    expect(l.classList.contains("haken")).toBe(true);
    expect(l.querySelector(".phase")!.innerHTML).toBe(BILD.haken);
    expect(l.querySelector(".punkte")!.children[nr - 1]!.className).toBe("ok neu");
    expect(byId("touch-left")!.classList.contains("erfolg"), "echter Stickkreis").toBe(true);
    expect(body.querySelectorAll(".erfolg").length).toBeGreaterThanOrEqual(1);
    expect(JSON.parse(m.get(LEHRGANG_KEY)!)).toMatchObject({ v: 2, schritt: nr, begonnen: true });
    // naechster Schritt: alles wieder normal
    bus.emit("lehrgang:schritt", schrittEv(nr + 1, "zeigen"));
    expect(l.classList.contains("haken")).toBe(false);
    expect(body.querySelectorAll(".erfolg")).toEqual([]);
    bus.emit("lehrgang:geschafft", { id: L1.id, nr: 1, name: L1.name, zeitS: 60 });
    expect(l.hidden).toBe(true);
    expect(leseLehrgang().fertig).toBe(true);
  });

  it("L4b: Erfolg hält in der Häkchen-Pause — losgelassen kein gelber Geist mit Pfeil, sondern grün und still", () => {
    speicher();
    const { byId, body } = seite();
    const bus = new EventBus();
    const geist = installGeisterdaumen({ bus, steuerung: defaultConfig });
    const links = byId("touch-left")!;
    const g = body.querySelector(".geist.links")!;
    bus.emit("lehrgang:start", startEv);
    const nr = L1.schritte.findIndex((st) => st.zeige?.fn === "cab") + 1; // Drehkranz: linker Stick
    bus.emit("lehrgang:schritt", schrittEv(nr, "du"));
    expect(g.classList.contains("an"), "Daumen liegt: kein Geist").toBe(false);
    // Gegenprobe vor dem Häkchen: Loslassen zeigt die gelbe Aufforderung mit Pfeil
    links.hidden = true;
    geist.takt();
    expect(g.classList.contains("an")).toBe(true);
    expect(g.querySelector(".pfeil")!.textContent).not.toBe("");
    links.hidden = false;
    geist.takt();
    bus.emit("lehrgang:haekchen", { id: L1.id, nr });
    expect(links.classList.contains("erfolg")).toBe(true);
    // In der Pause loslassen: grüner Geist ohne Pfeil und ohne Bewegung
    links.hidden = true;
    geist.takt();
    expect(g.classList.contains("an")).toBe(true);
    expect(g.classList.contains("erfolg")).toBe(true);
    expect(g.querySelector(".pfeil")!.textContent).toBe("");
    expect(g.dataset["pfeil"]).toBeUndefined();
    expect(body.querySelector(".geist.rechts")!.classList.contains("an"), "rechts war nicht beteiligt").toBe(false);
    // Der nächste Schritt beendet die Pause
    bus.emit("lehrgang:schritt", schrittEv(nr + 1, "zeigen"));
    expect(body.querySelectorAll(".erfolg")).toEqual([]);
  });

  it("L4b: Pedale leuchten in „du“, solange der Fahrbetrieb nicht zum Schritt passt", () => {
    speicher();
    const { byId } = seite();
    const bus = new EventBus();
    let fahren = true; // aus dem Fahren-Schritt noch an
    const geist = installGeisterdaumen({ bus, steuerung: defaultConfig, fahrenAn: () => fahren });
    const pedale = byId("pedals")!;
    const nr = L1.schritte.findIndex((st) => st.zeige?.fn === "cab") + 1;
    bus.emit("lehrgang:start", startEv);
    bus.emit("lehrgang:schritt", schrittEv(nr, "zeigen"));
    bus.emit("lehrgang:vorfuehren", { spur: L1.schritte[nr - 1]!.vorfuehrung! });
    bus.emit("lehrgang:schritt", schrittEv(nr, "du"));
    expect(pedale.classList.contains("geist-zeigt"), "Schwenken bei Fahren an").toBe(true);
    fahren = false; // Pedal angetippt
    geist.takt();
    expect(pedale.classList.contains("geist-zeigt")).toBe(false);
  });

  it("Überspringen: ⏭ fragt, ✕ bricht ab, ✓ merkt „übersprungen“ und lädt ins Menü", () => {
    speicher();
    const { byId } = seite();
    const neu = vi.fn();
    const ersetzt = vi.fn();
    vi.stubGlobal("location", { pathname: "/v1/", search: "", hash: "#lektion=lehrgang", reload: neu });
    vi.stubGlobal("history", { replaceState: ersetzt });
    const bus = new EventBus();
    installLektionsKarte({ bus, steuerung: defaultConfig, audio: { playSchritt() {} } });
    bus.emit("lehrgang:start", startEv);
    bus.emit("lehrgang:schritt", schrittEv(2, "du"));
    const l = byId("lehrgangsleiste")!;
    expect(byId("lg-skip")!.getAttribute("aria-label")).toBe(WORTE.ueberspringen.de);
    byId("lg-skip")!.klick();
    expect(l.classList.contains("fragt")).toBe(true);
    byId("lg-nein")!.klick();
    expect(l.classList.contains("fragt")).toBe(false);
    expect(leseLehrgang()).toEqual({ ...leererLehrgang(), begonnen: true });
    byId("lg-skip")!.klick();
    byId("lg-ja")!.klick();
    expect(leseLehrgang().uebersprungen).toBe(true);
    expect(ersetzt).toHaveBeenCalledWith(null, "", "/v1/"); // Adresse #lektion= weg …
    expect(neu).toHaveBeenCalledTimes(1); // … und neu laden = Menü
  });
});

describe("Zielmarke leuchtet beim Häkchen", () => {
  it("Material wechselt auf das helle Erfolgsgrün, der naechste Schritt setzt zurueck", async () => {
    const { installZielmarke } = await import("../src/ui/zielmarke");
    const scene = new THREE.Scene();
    const bus = new EventBus();
    installZielmarke(scene, bus);
    const marke = { x: 1, y: 0, z: 2, radiusM: 0.5 };
    bus.emit("lehrgang:schritt", { ...schrittEv(1, "du"), marke });
    const ring = scene.children.find((c) => (c as THREE.Mesh).geometry instanceof THREE.TorusGeometry) as THREE.Mesh;
    const farbe = () => (ring.material as THREE.MeshBasicMaterial).color.getHex();
    expect(farbe()).toBe(0x4fd06a);
    bus.emit("lehrgang:haekchen", { id: L1.id, nr: 1 });
    expect(farbe()).toBe(0xc8ffd4);
    bus.emit("lehrgang:schritt", { ...schrittEv(2, "zeigen"), marke });
    expect(farbe()).toBe(0x4fd06a);
  });
});
