import { describe, it, expect, beforeEach, vi } from "vitest";
import { TouchControls } from "../src/core/touch";
import {
  FASSUNGEN,
  fassungInnen,
  knopfKasten,
  luft,
  pedalKasten,
  px,
  pxOderNull,
  schriftgroesse,
  wert,
  zeilenabstand,
  type Fassung,
  type Kasten,
} from "./cssmass";

/*
 * L7-A (Punkte 42a/42b, Ansage Patrick 22.10.2026): Der Funktionskranz geht
 * nur noch per Knopf auf — Stillhalten des rechten Daumens oeffnet nichts mehr.
 *
 * Teil 1 — Bedienung. Es gibt kein Browser-Dokument im Testlauf; wie in
 * test/kamerageste.test.ts wird die Seite mit Attrappen nachgebaut, und der
 * echte TouchControls-Code laeuft. Die Attrappe des Dokuments spielt dabei die
 * Fangphase nach: erst die Hoerer am Dokument, dann — wenn keiner
 * stopPropagation gerufen hat — die am Zielelement.
 *
 * Teil 2 — Lage, aus dem CSS gerechnet (cssmass.ts) auf iPhone mini quer,
 * iPad 1180 x 820 und iPad 1024 x 768.
 */

// ---------------------------------------------------------------------------
// Teil 1: Bedienung
// ---------------------------------------------------------------------------

type Handler = (e: Ereignis) => void;
interface Ereignis {
  type: string;
  pointerId: number;
  clientX: number;
  clientY: number;
  target: unknown;
  pointerType: string;
  pressure: number;
  touches?: { length: number };
  gestoppt: boolean;
  preventDefault(): void;
  stopPropagation(): void;
}
interface Attrappe {
  id: string;
  hidden: boolean;
  klassen: Set<string>;
  attr: Map<string, string>;
  kinder: Attrappe[];
  dataset: Record<string, string>;
  textContent: string;
  h: Record<string, Handler[]>;
  [k: string]: unknown;
}

function attrappe(id: string): Attrappe {
  const a: Attrappe = {
    id,
    hidden: true,
    klassen: new Set(),
    attr: new Map(),
    kinder: [],
    dataset: {},
    textContent: "",
    h: {},
    style: {},
    offsetWidth: 100,
    className: "",
    classList: {
      add: (k: string) => a.klassen.add(k),
      remove: (k: string) => a.klassen.delete(k),
      toggle: (k: string, an?: boolean) => ((an ?? !a.klassen.has(k)) ? a.klassen.add(k) : a.klassen.delete(k)),
      contains: (k: string) => a.klassen.has(k),
    },
    setAttribute: (k: string, v: string) => a.attr.set(k, v),
    addEventListener: (t: string, f: Handler) => (a.h[t] ??= []).push(f),
    setPointerCapture() {},
    releasePointerCapture() {},
    contains: (x: unknown) => x === a,
    querySelector: () => attrappe(`${id}-knob`),
    appendChild: (k: Attrappe) => a.kinder.push(k),
  };
  return a;
}

let seite: Map<string, Attrappe>;
let dok: Attrappe & { hidden: boolean };
/** Die Kranz-Eintraege auf der Seite (index.html, Traegerblock) — hier vier, wie in einer Aufgabe. */
let traeger: string[];

beforeEach(() => {
  seite = new Map();
  traeger = ["btn-cab", "btn-outrig", "btn-blade", "btn-press"];
  dok = attrappe("document") as Attrappe & { hidden: boolean };
  dok.hidden = false;
  const el = (id: string): Attrappe => {
    if (!seite.has(id)) seite.set(id, attrappe(id));
    return seite.get(id)!;
  };
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  dok.body = { classList: { add() {} } };
  dok.getElementById = el;
  dok.querySelectorAll = () =>
    traeger.map((id) => {
      const s = el(id);
      s.textContent = id.toUpperCase();
      return s;
    });
  dok.createElement = () => attrappe("neu");
  vi.stubGlobal("document", dok);
});

function bauen(): TouchControls {
  return new TouchControls(attrappe("canvas") as unknown as HTMLElement, {
    orbitDX: 0,
    orbitDY: 0,
    zoomFactor: 1,
    camReset: false,
  });
}

/** Ein Zeigerereignis wie im Browser: Fangphase am Dokument, dann das Ziel. */
function zeiger(ziel: Attrappe, type: string, pointerId: number, x = 900, y = 300): Ereignis {
  const e: Ereignis = {
    type, pointerId, clientX: x, clientY: y, target: ziel, pointerType: "touch", pressure: 0,
    gestoppt: false,
    preventDefault() {},
    stopPropagation() {
      e.gestoppt = true;
    },
  };
  for (const f of dok.h[type] ?? []) f(e);
  if (!e.gestoppt) for (const f of ziel.h[type] ?? []) f(e);
  return e;
}
const tippe = (ziel: Attrappe, id: number, x?: number, y?: number): void => {
  zeiger(ziel, "pointerdown", id, x, y);
  zeiger(ziel, "pointerup", id, x, y);
};
/** Letzter Finger hebt ab: Safari schickt touchend mit leerer Fingerliste (Geister-Sicherung). */
function allesLos(): void {
  for (const f of dok.h["touchend"] ?? []) f({ touches: { length: 0 }, preventDefault() {} } as unknown as Ereignis);
}

const ALLE_CODES = ["KeyX", "KeyO", "KeyI", "KeyB", "KeyC", "Escape", "F3"];
const gedrueckt = (t: TouchControls): string[] => ALLE_CODES.filter((c) => t.consumePress(c));
const sektoren = (): Attrappe[] => seite.get("radial")!.kinder.filter((k) => k.className === "sektor");
const achsenSumme = (t: TouchControls): number => {
  const a = t.axes;
  return Math.abs(a.grapple) + Math.abs(a.boom) + Math.abs(a.stick) + Math.abs(a.cab);
};

describe("Kranz-Knopf: Bedienung (L7-A)", () => {
  it("rechten Stick aufsetzen und über 1 s stillhalten: der Kranz bleibt zu", () => {
    // Gegenprobe ist die alte Mechanik selbst: Sie klappte nach 0,4 s auf.
    const t = bauen();
    const zone = seite.get("zone-right")!;
    zeiger(zone, "pointerdown", 1);
    for (let i = 0; i < 90; i++) t.update(1 / 60); // 1,5 s
    expect(t.kranzOffen).toBe(false);
    expect(seite.get("radial")!.hidden).toBe(true);
    zeiger(zone, "pointerup", 1);
    expect(t.kranzOffen).toBe(false);
    expect(gedrueckt(t)).toEqual([]);
  });

  it("Knopf antippen öffnet — und der Kranz bleibt offen, wenn kein Finger mehr liegt", () => {
    // Gegenprobe: Bis L7-A klappte releaseAll() den Kranz zu; hier waere er dann sofort wieder weg.
    const t = bauen();
    const knopf = seite.get("btn-kranz")!;
    expect(knopf.hidden, "Knopf sichtbar bei vier Eintraegen").toBe(false);
    tippe(knopf, 1, 980, 110);
    allesLos();
    expect(t.kranzOffen).toBe(true);
    expect(seite.get("radial")!.hidden).toBe(false);
    expect(knopf.klassen.has("down"), "Knopf zeigt den offenen Zustand").toBe(true);
    expect(knopf.attr.get("aria-expanded")).toBe("true");
    expect(seite.get("touch")!.klassen.has("kranz-offen"), "Drehtasten/Pedale treten zurueck").toBe(true);
    expect(sektoren().length).toBe(4);
  });

  it("Eintrag antippen löst genau diesen aus und schliesst", () => {
    const t = bauen();
    tippe(seite.get("btn-kranz")!, 1);
    allesLos();
    const schild = sektoren()[2]; // dritter Traeger: btn-blade = Taste I
    zeiger(schild, "pointerdown", 2);
    expect(schild.klassen.has("sel"), "gedrueckter Eintrag ist scharfgestellt").toBe(true);
    zeiger(schild, "pointerup", 2);
    expect(gedrueckt(t)).toEqual(["KeyI"]);
    expect(t.kranzOffen).toBe(false);
    expect(seite.get("btn-kranz")!.attr.get("aria-expanded")).toBe("false");
  });

  it("Eintrag drücken, auf den Nachbarn rutschen, loslassen: nichts, Kranz bleibt offen", () => {
    const t = bauen();
    tippe(seite.get("btn-kranz")!, 1);
    const [a, b] = sektoren();
    zeiger(a, "pointerdown", 2);
    zeiger(b, "pointerup", 2); // Freigabe des Zeigers: pointerup kommt dort an, wo der Finger liegt
    expect(gedrueckt(t)).toEqual([]);
    expect(t.kranzOffen).toBe(true);
    expect(a.klassen.has("sel")).toBe(false);
  });

  it("daneben tippen schliesst folgenlos: kein Code, kein Stick, keine Kamera, kein Doppeltipp", () => {
    const t = bauen();
    tippe(seite.get("btn-kranz")!, 1);
    const zone = seite.get("zone-right")!;
    zeiger(zone, "pointerdown", 2, 900, 300);
    zeiger(zone, "pointermove", 2, 960, 340);
    t.update();
    expect(t.kranzOffen).toBe(false);
    expect(t.daumenAuf, "der verschluckte Finger hat keinen Stick gestartet").toBe(false);
    expect(achsenSumme(t)).toBe(0);
    zeiger(zone, "pointerup", 2, 960, 340);
    // Gleich danach ein echter Tipp am selben Ort: der verschluckte zaehlte nicht mit
    tippe(zone, 3, 900, 300);
    expect(gedrueckt(t), "kein Doppeltipp-Ansichtswechsel").toEqual([]);
    // Kamera-Streifen und ☰ ebenso
    tippe(seite.get("btn-kranz")!, 4);
    tippe(seite.get("btn-menu")!, 5);
    expect(t.kranzOffen).toBe(false);
    expect(gedrueckt(t), "☰ hat bei offenem Kranz nicht ausgeloest").toEqual([]);
  });

  it("die Nabe zählt als daneben", () => {
    const t = bauen();
    tippe(seite.get("btn-kranz")!, 1);
    const nabe = seite.get("radial")!.kinder.find((k) => k.className === "nabe")!;
    tippe(nabe, 2);
    expect(t.kranzOffen).toBe(false);
    expect(gedrueckt(t)).toEqual([]);
  });

  it("und auch der click danach wird verschluckt (Karten hören auf click)", () => {
    bauen();
    tippe(seite.get("btn-kranz")!, 1);
    tippe(seite.get("zone-mitte")!, 2);
    const klick = zeiger(attrappe("lektionskarte"), "click", 2);
    expect(klick.gestoppt).toBe(true);
  });

  it("erneuter Tipp auf den Knopf schliesst", () => {
    const t = bauen();
    const knopf = seite.get("btn-kranz")!;
    tippe(knopf, 1);
    tippe(knopf, 2);
    expect(t.kranzOffen).toBe(false);
    expect(knopf.klassen.has("down")).toBe(false);
    expect(gedrueckt(t)).toEqual([]);
  });

  it("ein Stick, der schon lag, läuft bei offenem Kranz weiter", () => {
    const t = bauen();
    const zone = seite.get("zone-right")!;
    zeiger(zone, "pointerdown", 1, 900, 300);
    tippe(seite.get("btn-kranz")!, 2, 980, 110);
    zeiger(zone, "pointermove", 1, 900, 360); // gefangener Zeiger: nicht verschluckt
    t.update();
    expect(t.kranzOffen).toBe(true);
    expect(achsenSumme(t)).toBeGreaterThan(0);
  });

  it("schliesst, wenn die Seite verschwindet, und bei der Fünf-Finger-Geste", () => {
    const t = bauen();
    tippe(seite.get("btn-kranz")!, 1);
    dok.hidden = true;
    for (const f of dok.h["visibilitychange"] ?? []) f({} as Ereignis);
    expect(t.kranzOffen).toBe(false);
    dok.hidden = false;
    tippe(seite.get("btn-kranz")!, 2);
    for (const f of dok.h["touchstart"] ?? []) f({ touches: { length: 5 } } as unknown as Ereignis);
    expect(t.kranzOffen).toBe(false);
  });

  it("leerer Kranz (alles per Spielart entfernt): kein Knopf", () => {
    traeger = [];
    bauen();
    expect(seite.get("btn-kranz")!.hidden).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Teil 2: Lage
// ---------------------------------------------------------------------------

const IPAD_AIR: Fassung = { name: "iPad quer 1180", w: 1180, h: 820, sa: { l: 0, r: 0, t: 0, b: 0 } };
const QUER = [IPAD_AIR, ...FASSUNGEN.filter((f) => f.w > f.h)];
/** Mindestluft zu jedem Nachbarn — wie test/pedalmitte.test.ts. */
const LUFT = 8;
/** Halbmesser des Kranzes — RADIAL_R in touch.ts, bewacht in test/funktionskranz.test.ts. */
const R = 112;
/** Eintraege, die je nach Spielart im Kranz stehen koennen (Aufgabe 4 … Seite 9). */
const ANZAHLEN = [4, 5, 6, 7, 8, 9];
/**
 * Unterkante der Lehrgangsleiste: gemessen 74 px (index.html, Kommentar
 * „#lehrgangsleiste", gerechnet in test/lehrgangsleiste.test.ts).
 */
const LEISTE_UNTEN = 74;

const vonOben = (name: string, f: Fassung, x0: number, x1: number, oben: number, unten: number): Kasten => ({
  name, x0, x1, y0: f.h - unten, y1: f.h - oben,
});

const KNOPF = ["#touch .btn", "#touch #btn-kranz", "#btn-kranz"];
const MENUE = ["#touch .btn", "#touch #btn-menu", "#btn-menu"];

function kranzKnopf(f: Fassung, dx = 0, dy = 0): Kasten {
  expect(wert(KNOPF, "box-sizing", f), "Kranz-Knopf nicht border-box").toBe("border-box");
  expect(wert(KNOPF, "padding", f), "Kranz-Knopf hat einen Innenrand").toBe("0");
  const w = px(KNOPF, "width", f);
  const x1 = f.w - px(KNOPF, "right", f) + dx;
  const oben = px(KNOPF, "top", f) + dy;
  return vonOben("Kranz-Knopf", f, x1 - w, x1, oben, oben + px(KNOPF, "height", f));
}

/**
 * ☰, wie es wirklich gezeichnet wird. Bis L8-B2 content-box, und "#touch
 * .btn" setzte seinen Innenrand 11/6 px durch (Nebenbefund E-206) — 62 x 72,
 * flach 56 x 66. Seit L8-B2 border-box mit padding 0: 46 x 46, flach 44 x 44.
 * Die Rechnung nimmt beides, damit ein Rueckfall wieder auffaellt.
 */
function menue(f: Fassung): Kasten {
  const box = wert(MENUE, "box-sizing", f) === "border-box";
  const [py, pxx] = box ? [0, 0] : fassungInnen(MENUE, f);
  const w = px(MENUE, "width", f) + (box ? 0 : 2 * pxx + 4);
  const h = px(MENUE, "height", f) + (box ? 0 : 2 * py + 4);
  const x1 = f.w - px(MENUE, "right", f);
  const oben = px(MENUE, "top", f);
  return vonOben("☰", f, x1 - w, x1, oben, oben + h);
}

function hudOben(f: Fassung): Kasten {
  const A = ["#hudoben", "body.touch #hudoben"];
  const rechts = pxOderNull(A, "right", f);
  const breit = px(A, "max-width", f);
  const x0 = rechts === null ? px(A, "left", f) : f.w - rechts - breit;
  // Wie hoch der Stapel waechst, haengt am Text — schlimmster Fall bis zur Bildmitte.
  return vonOben("HUD oben", f, x0, x0 + breit, px(A, "top", f), f.h / 2);
}

function hudUnten(f: Fassung): Kasten {
  const hu = ["#hudunten", "body.touch #hudunten"];
  const y0 = px(hu, "bottom", f);
  return { name: "HUD unten", x0: px(hu, "left", f), x1: f.w - px(hu, "right", f), y0, y1: f.h / 2 };
}

/** Schicht-Anzeige oben links, acht Zeilen hoch (wie test/pedalmitte.test.ts). */
function schicht(f: Fassung): Kasten {
  const A = ["#schichtanzeige", "body.touch #schichtanzeige", ".hud"];
  const [py] = fassungInnen(A, f);
  const h = 8 * Math.ceil(schriftgroesse(A, f) * zeilenabstand(A, f)) + 2 * py + 2;
  const x0 = px(A, "left", f);
  const oben = px(A, "top", f);
  return vonOben("Schicht-Anzeige", f, x0, x0 + px(A, "width", f), oben, oben + h);
}

/** Lehrgangsleiste: im Kamera-Mittelstreifen, oben, Unterkante gemessen. */
const leiste = (f: Fassung): Kasten => vonOben("Lehrgangsleiste", f, 0.35 * f.w, 0.65 * f.w, 0, LEISTE_UNTEN);

/** Pruefungszeile (#zielzeile, Auftrag 41) — nur, solange sie im CSS steht. */
function zielzeile(f: Fassung): Kasten[] {
  if (wert(["#zielzeile .zz-knoepfe"], "left", f) === null) return [];
  const knL = px(["#zielzeile .zz-knoepfe"], "left", f);
  const knO = px(["#zielzeile .zz-knoepfe"], "top", f);
  const S = ["#zielzeile .zz-satz"];
  const satzO = px(S, "top", f);
  const ZS = ["#zielzeile #zz-satz"];
  const [py] = fassungInnen(ZS, f);
  const satzH = schriftgroesse(["#zielzeile"], f) * zeilenabstand(ZS, f) + 2 * py + 2;
  const infoR = f.w - px(["#zielzeile .zz-info"], "right", f);
  return [
    vonOben("Pruefung Knoepfe", f, knL, knL + 224, knO, knO + 44), // 80 + 3 x 44 + 3 x 4 (index.html)
    vonOben("Pruefung Satz", f, px(S, "left", f), f.w - px(S, "right", f), satzO, satzO + satzH),
    vonOben("Pruefung Anzeige", f, f.sa.l, infoR, knO, knO + 44),
  ];
}

function nachbarn(f: Fassung): Kasten[] {
  return [
    menue(f),
    hudOben(f),
    hudUnten(f),
    schicht(f),
    leiste(f),
    ...zielzeile(f),
    knopfKasten("btn-rot-l", f),
    knopfKasten("btn-rot-r", f),
    pedalKasten(f),
  ];
}

/** Mittelpunkt des Kranzes (von unten gerechnet) und seine Sektoren, scharfgestellt (x 1,10). */
function kranz(f: Fassung, n: number, dx = 0, dy = 0): { cx: number; cy: number; sektoren: Kasten[] } {
  const cx = f.w - px(["#radial"], "right", f) + dx;
  const oben = pxOderNull(["#radial"], "top", f);
  const cy = (oben === null ? px(["#radial"], "bottom", f) : f.h - oben) + dy;
  const s = Number(/scale\(([\d.]+)\)/.exec(wert(["#radial .sektor.sel"], "transform", f) ?? "")![1]);
  const w = px(["#radial .sektor"], "width", f) * s;
  const h = px(["#radial .sektor"], "height", f) * s;
  const sektoren: Kasten[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2; // wie buildRadial: 0 = oben, im Uhrzeigersinn
    const x = cx + Math.sin(a) * R;
    const y = cy + Math.cos(a) * R; // von unten gerechnet: oben = groesseres y
    sektoren.push({ name: `E${i}/${n}`, x0: x - w / 2, x1: x + w / 2, y0: y - h / 2, y1: y + h / 2 });
  }
  return { cx, cy, sektoren };
}

function knopfFehler(k: Kasten, f: Fassung): string[] {
  const out: string[] = [];
  if (k.x1 - k.x0 < 44 || k.y1 - k.y0 < 44) out.push(`kleiner als 44 px: ${k.x1 - k.x0} x ${k.y1 - k.y0}`);
  if (k.x1 > f.w - f.sa.r || k.y1 > f.h - f.sa.t) out.push("im sicheren Rand");
  for (const n of nachbarn(f)) if (luft(k, n) < LUFT) out.push(`${n.name}: ${luft(k, n).toFixed(1)} px Luft`);
  return out;
}

function kranzFehler(f: Fassung, dx = 0, dy = 0): string[] {
  const out: string[] = [];
  const frei = [menue(f), kranzKnopf(f)];
  for (const n of ANZAHLEN) {
    for (const s of kranz(f, n, dx, dy).sektoren) {
      if (s.x0 < f.sa.l || s.x1 > f.w - f.sa.r || s.y0 < f.sa.b || s.y1 > f.h - f.sa.t) out.push(`${s.name} ragt aus dem Bild`);
      for (const k of frei) if (luft(s, k) < LUFT) out.push(`${s.name} auf ${k.name}: ${luft(s, k).toFixed(1)} px`);
    }
  }
  return out;
}

describe("Kranz-Knopf und Kranz: Lage (L7-A)", () => {
  for (const f of QUER) {
    describe(f.name, () => {
      const k = kranzKnopf(f);
      const m = menue(f);
      if (process.env["MASS"]) {
        const kz = kranz(f, 8);
        console.log(f.name, { knopf: k, menue: m, kranzMitte: { x: kz.cx, yVonOben: f.h - kz.cy } });
        for (const n of nachbarn(f)) console.log("  Luft", n.name, luft(k, n).toFixed(1));
        for (const n of nachbarn(f)) {
          const min = Math.min(...ANZAHLEN.flatMap((a) => kranz(f, a).sektoren.map((s) => luft(s, n))));
          console.log("  Kranz-Luft", n.name, min.toFixed(1));
        }
      }

      it("Knopf: mindestens 44 px, im Bild, 8 px Luft zu allen Nachbarn", () => {
        expect(knopfFehler(k, f), JSON.stringify(k)).toEqual([]);
        if (f !== FASSUNGEN[1]) expect(k.x1 - k.x0, "auf dem iPad 48 px").toBe(48);
      });

      it("senkrecht unter ☰, rechtsbuendig in dessen Spalte — links neben ☰ bleibt frei", () => {
        expect(k.y1).toBeLessThan(m.y0);
        expect(k.x1).toBe(m.x1);
        // L8-B2: Seit ☰ wirklich 46 misst, ist der iPad-Knopf (48) 2 px breiter als ☰ — er steht darunter, nicht daneben
        expect(k.x0).toBeGreaterThanOrEqual(m.x0 - 2);
      });

      it("offener Kranz ganz im sicheren Bild, kein Sektor auf ☰ oder dem Knopf (4 bis 9 Eintraege)", () => {
        expect(kranzFehler(f)).toEqual([]);
      });

      it("offener Kranz laesst Lehrgangsleiste und Pruefungszeile lesbar", () => {
        for (const n of ANZAHLEN)
          for (const s of kranz(f, n).sektoren)
            for (const z of [leiste(f), ...zielzeile(f)])
              expect(luft(s, z), `${s.name} auf ${z.name}`).toBeGreaterThanOrEqual(LUFT);
      });

      it("GEGENPROBE: Knopf 40 px hoeher stoesst an ☰; Kranz am Knopf aufgeklappt deckt ihn", () => {
        expect(knopfFehler(kranzKnopf(f, 0, -40), f).length).toBeGreaterThan(0);
        // Die alte Art — Ring um den Finger, hier um den Knopf — faellt durch
        const kz = kranz(f, 8);
        expect(kranzFehler(f, (k.x0 + k.x1) / 2 - kz.cx, (k.y0 + k.y1) / 2 - kz.cy).length).toBeGreaterThan(0);
      });

      if (f.w === 812)
        it("GEGENPROBE iPhone: 130 px weiter rechts liegt der obere Sektor am Kranz-Knopf", () => {
          // L8-B2: Der Knopf sitzt seit dem echten 44er-☰ 22 px hoeher (60 statt 82) — nur noch der obere Sektor reicht an ihn heran
          expect(kranzFehler(f, 50).some((t) => t.includes("auf Kranz-Knopf"))).toBe(false);
          expect(kranzFehler(f, 130).some((t) => t.includes("auf Kranz-Knopf"))).toBe(true);
        });
    });
  }

  it("L8-B2: ☰ misst 46 x 46 (iPad) bzw. 44 x 44 (Telefon quer), Knopf 8 px darunter, Zahlen wie im CSS-Kommentar", () => {
    for (const f of QUER) {
      const m = menue(f);
      const k = kranzKnopf(f);
      const soll = f.h <= 430 ? 44 : 46;
      expect([m.x1 - m.x0, m.y1 - m.y0], f.name).toEqual([soll, soll]);
      expect(m.y0 - k.y1, `${f.name}: Luft ☰ → Knopf`).toBe(LUFT);
      expect(f.h - k.y1, `${f.name}: Knopf oben`).toBe(f.h <= 430 ? 60 : 66);
      expect(f.w - px(["#radial"], "right", f), `${f.name}: Kranz-Mitte`).toBe(f.h <= 430 ? 812 - 50 - 204 : f.w - 216);
    }
    // Die alte Fassung: content-box mit dem Innenrand von "#touch .btn" — 62 x 72 (Gegenprobe der Rechnung)
    expect(46 + 2 * 6 + 4).toBe(62);
    expect(46 + 2 * 11 + 4).toBe(72);
    expect(wert(MENUE, "padding", FASSUNGEN[0]!)).toBe("0");
  });

  it("Telefon hoch (kein Spielformat): Knopf und Kranz bleiben trotzdem im Bild und frei", () => {
    const f = FASSUNGEN.find((x) => x.name === "iPhone mini hoch")!;
    expect(kranzFehler(f)).toEqual([]);
    expect(kranzKnopf(f).y1).toBeLessThan(menue(f).y0);
  });
});
