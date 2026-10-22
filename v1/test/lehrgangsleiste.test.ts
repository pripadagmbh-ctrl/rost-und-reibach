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
 * L7-W — das Wort je Schritt: eine Zeile, nichts abgeschnitten, in jeder
 * Fassung und Sprache; die Leiste wächst dafür nach links.
 * Teil 2 — „kaum Text": Kranzname EIN Wort, Schritt-Wort höchstens drei
 * (L7-W). Gegenprobe: die alten Kartentexte.
 * Teil 3 — eine kleine Ersatz-Seite (kein Browser): Erfolgs-Signal bei
 * `lehrgang:haekchen`, Überspringen merkt sich und führt ins Menü.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { FASSUNGEN, knopfKasten, luft, px, ueberlappt, wert, EM_BREITE, type Fassung, type Kasten, type Rand } from "./cssmass";
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

/*
 * L7-W: Auf iPhone und iPad gibt es kein Consolas — Safari nimmt fuer
 * `monospace` Courier, 1229/2048 = 0,6 em je Zeichen (Consolas 0,55,
 * `cssmass.ts` EM_BREITE). Das Wort wird mit beiden gemessen.
 */
const EM_IOS = 0.6;
const WORT_SCHRIFT = 14; // `font: 700 14px` (unten geprueft)
const PHASE_FN = ["#lehrgangsleiste .phase", "#lehrgangsleiste .fn"];

/** Was die Zeile ausser dem Wort braucht: Rahmen, Polster, Auge/Hand, Bildzeichen, ⏭, drei Luecken. */
function zeileFest(f: Fassung): number {
  const pl = viererWert(L, "padding", f, 3);
  const pr = viererWert(L, "padding", f, 1);
  return 2 * rahmen(f) + pl + pr + 2 * px(PHASE_FN, "width", f) + 3 * px(ZEILE, "gap", f) + px(KNOPF, "width", f);
}
const wortPx = (text: string, em: number): number => text.length * WORT_SCHRIFT * em;

/**
 * Die Leiste mit diesem Wort. Breite nach Inhalt (`min-width` .. `max-width`),
 * rechte Kante fest: `right: 50%` mit negativem `margin-right`.
 */
function leiste(f: Fassung, text = "", em = EM_BREITE): { kasten: Kasten; skip: Kasten; ja: Kasten; nein: Kasten; wort: Kasten } {
  expect(wert(L, "right", f)).toBe("50%");
  expect(wert(L, "font", f)).toMatch(new RegExp(`\\b${WORT_SCHRIFT}px\\b`));
  const breite = Math.min(px(L, "max-width", f), Math.max(px(L, "min-width", f), zeileFest(f) + wortPx(text, em)));
  const x0 = f.w / 2 - px(L, "margin-right", f) - breite;
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

/**
 * Die alte Lektionskarte (E-196): Kopf, Ziel, Titel, Text zwei Zeilen, Hinweis.
 * Ihr CSS ist mit der Aufgabenkarte gegangen (41-P2); die Masse stehen hier
 * fest, wie sie aufgabenkarte-platz.test.ts gerechnet hat (iPhone mini quer:
 * x 58..524, oben 6, 2 x 2 + 2 x 3 + 28 + 5 x 17 = 123 hoch).
 */
function alteKarte(f: Fassung): Kasten {
  return vonOben("alte Lektionskarte", f, 58, 524, 6, 6 + 123);
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

/*
 * L7-W (Patrick 22.10.2026, Punkt 44a): „ein kurzes Wort je Schritt (1–3
 * Wörter)" neben dem Bildzeichen — in EINER Zeile, nichts abgeschnitten.
 * Die Leiste wächst dafür nach links (index.html, Begründung dort); ⏭/✓/✕
 * rücken nie. Gemessen wird JEDES Wort aller Schritte (auch künftiger Teile)
 * in DE und EN, mit Consolas (Windows/headless) und Courier (iOS), in den
 * Fassungen iPhone mini quer, iPad 1024 × 768 und iPad 1180 × 820.
 */
describe("L7-W: ein kurzes Wort je Schritt — eine Zeile, nichts abgeschnitten", async () => {
  const { WORT_MAX_ZEICHEN } = await import("../src/ui/lektionskarte");
  const SCHRITTE = LEKTIONEN.flatMap((l) => l.schritte);
  const IPAD_1180: Fassung = { name: "iPad quer 1180", w: 1180, h: 820, sa: { l: 0, r: 0, t: 0, b: 0 } };
  const ALLE = [...QUER, IPAD_1180];
  /** Platz fürs Wort bei voller Breite der Leiste */
  const platz = (f: Fassung): number => px(L, "max-width", f) - zeileFest(f);

  it("jeder Schritt hat ein Wort in DE und EN, höchstens WORT_MAX_ZEICHEN Zeichen", () => {
    for (const st of SCHRITTE) {
      expect(st.wort, st.titel.de).toBeDefined();
      for (const s of ["de", "en"] as const) {
        expect(st.wort![s].trim().length, st.titel.de).toBeGreaterThan(0);
        expect(st.wort![s].length, st.wort![s]).toBeLessThanOrEqual(WORT_MAX_ZEICHEN);
      }
    }
  });

  it("die Leiste ist für WORT_MAX_ZEICHEN bemessen: 21 Zeichen Courier passen, 22 nicht (Gegenprobe)", () => {
    for (const f of ALLE) {
      expect(wortPx("x".repeat(WORT_MAX_ZEICHEN), EM_IOS), f.name).toBeLessThanOrEqual(platz(f));
      expect(wortPx("x".repeat(WORT_MAX_ZEICHEN + 1), EM_IOS), f.name).toBeGreaterThan(platz(f));
    }
  });

  it("nur die Knöpfe nehmen Berührung an — die gewachsene Leiste über der Stick-Zone fängt keinen Finger", () => {
    const f = QUER[0]!;
    expect(wert(L, "pointer-events", f)).toBe("none");
    expect(wert(KNOPF, "pointer-events", f)).toBe("auto");
  });

  for (const f of ALLE) {
    for (const s of ["de", "en"] as const) {
      it(`${f.name}, ${s}: jedes Wort ganz zu sehen; Leiste im Bild, frei von ☰ und Mittelzone; ⏭/✓/✕ fest im Streifen`, () => {
        const zone = mittelzone(f);
        const streifen = { x0: f.w * 0.35, x1: f.w * 0.65 };
        const ohne = leiste(f);
        for (const st of SCHRITTE) {
          for (const em of [EM_BREITE, EM_IOS]) {
            const t = st.wort![s];
            const l = leiste(f, t, em);
            const was = `„${t}" (${em} em)`;
            expect(wortPx(t, em), `${was} abgeschnitten`).toBeLessThanOrEqual(l.wort.x1 - l.wort.x0 + 1e-9); // Rundung der Gleitkommazahl
            expect(l.kasten.x0, `${was}: Leiste links aus dem Bild`).toBeGreaterThanOrEqual(f.sa.l + 8);
            expect(luft(l.kasten, knopfKasten("btn-menu", f)), `${was}: ☰`).toBeGreaterThanOrEqual(4);
            for (const k of [l.kasten, l.wort]) expect(ueberlappt(k, zone), `${was}: ${k.name} in der Mittelzone`).toBe(false);
            expect([l.skip, l.ja, l.nein], `${was}: Knöpfe gerückt`).toEqual([ohne.skip, ohne.ja, ohne.nein]);
            for (const k of [l.skip, l.ja, l.nein]) {
              expect(k.x0).toBeGreaterThan(streifen.x0);
              expect(k.x1).toBeLessThan(streifen.x1);
            }
          }
        }
      });
    }
  }

  it("Gegenprobe: ein Wort über WORT_MAX_ZEICHEN würde abgeschnitten — der Wächter wird rot", () => {
    const f = QUER.find((q) => q.name === "iPhone mini quer")!;
    const t = "Hauptarm heben/senken!"; // 22 Zeichen
    const l = leiste(f, t, EM_IOS);
    expect(wortPx(t, EM_IOS)).toBeGreaterThan(l.wort.x1 - l.wort.x0);
  });

  it("die Zahlen im CSS-Kommentar (L7-W) stimmen: volle Breite 313, links 207 (mini) und 313 (iPad 1024)", () => {
    for (const f of QUER) {
      const l = leiste(f, "x".repeat(2 * WORT_MAX_ZEICHEN), EM_IOS); // gedeckelt: volle Breite
      expect(px(L, "max-width", f)).toBe(313);
      expect(l.kasten.x0).toBe(f.name === "iPad quer" ? 313 : 207);
    }
  });
});

// --- Teil 2: kaum Text
/** Buchstaben-Wörter (ein „2×" oder „✓" zählt nicht als Wort). */
const woerter = (t: string): string[] => t.split(/\s+/).filter((w) => /[A-Za-zÄÖÜäöüß]{2,}/.test(w));

/*
 * Kranzname: EIN Wort. Schritt-Wort der Leiste: höchstens DREI (L7-W, Patrick
 * 22.10.2026: „ein kurzes Wort je Schritt (1–3 Wörter)", z. B. „Hauptarm
 * heben/senken"). Ein Satz bleibt draußen — die Gegenprobe zeigt, dass jede
 * alte Kartenzeile beide Grenzen reißt.
 */
const SCHRITTWORT_MAX_WOERTER = 3;
describe("Lehrgang: kaum Text — Kranzname ein Wort, Schritt-Wort höchstens drei", () => {
  const kranz = (code: string) => (code === "KeyO" ? KRANZ_LAENGSTER : null);
  const schrittWoerter = (s: "de" | "en"): string[] => LEKTIONEN.flatMap((l) => l.schritte.flatMap((st) => (st.wort ? [st.wort[s]] : [])));
  for (const s of ["de", "en"] as const) {
    it(s, () => {
      const k = tastenText("KeyO", kranz, s)!.replace(" ", ""); // Kranzname = ein Eintrag, egal ob mit Leerzeichen
      expect(woerter(k).length, k).toBeLessThanOrEqual(1);
      for (const t of schrittWoerter(s)) expect(woerter(t).length, t).toBeLessThanOrEqual(SCHRITTWORT_MAX_WOERTER);
    });
  }
  it("Gegenprobe: die alten Kartenzeilen (Titel, Bedientext) hätten den Wächter gerissen", () => {
    const st = LEKTIONEN[0]!.schritte[0]!;
    expect(woerter(`Schau zu: ${st.titel.de}`).length).toBeGreaterThan(SCHRITTWORT_MAX_WOERTER);
    expect(woerter(st.text.de).length).toBeGreaterThan(SCHRITTWORT_MAX_WOERTER);
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
  stil: Record<string, string> = {};
  style = { setProperty: (k: string, v: string) => void (this.stil[k] = v) };
  /** L5-B: Lage im Bild (Pedal-Finger liest sie) */
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
  const pedale = new El("div", "pedals");
  const pedal = new El("div", "", "pedal");
  pedal.rect = { left: 400, top: 300, width: 60, height: 68 }; // L5-B: Mitte 430, 334
  pedale.append(pedal, new El("div", "", "pedal"));
  body.append(leiste, links, rechts, pedale);
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
  const teile = st.ziel.art === "aenderung" && st.ziel.richtung === "hinUndZurueck" ? 2 : 1;
  return { id: L1.id, nr, von: L1.schritte.length, titel: st.titel, text: st.text, zeige: st.zeige, phase, marke: null, symbol: st.symbol ?? null, teile };
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
    // L7-W: das Wort des Schritts steht neben dem Bildzeichen, das aria-label behält den Titel
    expect(l.querySelector(".wort")!.textContent).toBe(L1.schritte[2]!.wort!.de);
    expect(l.getAttribute("aria-label")).toContain(L1.schritte[2]!.titel.de);
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

  /* --- L5-B (Patrick 22.10.2026, Punkte 40b, 40c, 40d, 40f) --- */
  const nrVon = (f: (st: (typeof L1.schritte)[number]) => boolean): number => L1.schritte.findIndex(f) + 1;
  /** Schritt mit Vorfuehrung bis „du" — wie der Lauf: schritt(zeigen), vorfuehren, schritt(du) */
  const bisDu = (bus: EventBus, nr: number): void => {
    bus.emit("lehrgang:schritt", schrittEv(nr, "zeigen"));
    const spur = L1.schritte[nr - 1]!.vorfuehrung;
    if (spur) bus.emit("lehrgang:vorfuehren", { spur });
    bus.emit("lehrgang:schritt", schrittEv(nr, "du"));
  };

  it("40b: „Ansicht wechseln“ in „du“ — tippender Finger mit zwei Ringen in der rechten Zone, kein Text-Schild", () => {
    speicher();
    const { body, byId } = seite();
    byId("touch-left")!.hidden = true;
    const bus = new EventBus();
    installGeisterdaumen({ bus, steuerung: defaultConfig });
    bus.emit("lehrgang:start", startEv);
    const nr = nrVon((st) => st.symbol === "ansicht");
    bisDu(bus, nr);
    const tipp = body.querySelector(".tippgeist.ansicht")!;
    expect(tipp.classList.contains("an")).toBe(true);
    expect(tipp.querySelectorAll(".welle").length, "zwei Ringe").toBe(2);
    expect(tipp.querySelector(".finger")).not.toBeNull();
    expect(tipp.classList.contains("einmal"), "in „du“ in Schleife").toBe(false);
    const schild = body.querySelector(".tastengeist")!;
    expect(schild.classList.contains("an")).toBe(false);
    expect(schild.textContent).toBe("");
    // „Zurück nach draußen“ hat keine Vorführung — derselbe Finger
    bus.emit("lehrgang:schritt", schrittEv(nr + 1, "du"));
    expect(tipp.classList.contains("an")).toBe(true);
    // Gegenprobe: ein Stick-Schritt zeigt ihn nicht
    bisDu(bus, nrVon((st) => st.symbol === "stiel"));
    expect(tipp.classList.contains("an")).toBe(false);
  });

  it("40d: Fahren in „du“ bei Fahren aus — der Finger steht auf dem Pedal, kein Stick-Geist; Fahren an → Finger weg, Stick-Geist da", () => {
    speicher();
    const { body, byId } = seite();
    byId("touch-left")!.hidden = true;
    const bus = new EventBus();
    let fahren = false;
    const geist = installGeisterdaumen({ bus, steuerung: defaultConfig, fahrenAn: () => fahren });
    bus.emit("lehrgang:start", startEv);
    bisDu(bus, nrVon((st) => st.symbol === "fahren"));
    const tipp = body.querySelector(".tippgeist.pedal")!;
    const links = body.querySelector(".geist.links")!;
    expect(tipp.classList.contains("an")).toBe(true);
    expect(tipp.querySelectorAll(".welle").length).toBe(2); // die zweite blendet das CSS bei .einzel aus
    expect(tipp.classList.contains("einzel")).toBe(true);
    expect([tipp.stil["left"], tipp.stil["top"]], "Mitte des ersten Pedals").toEqual(["430px", "334px"]);
    expect(links.classList.contains("an"), "Stick-Geist erst nach dem Pedal").toBe(false);
    fahren = true; // Pedal angetippt
    geist.takt();
    expect(tipp.classList.contains("an")).toBe(false);
    expect(links.classList.contains("an")).toBe(true);
    expect(links.dataset["pfeil"]).toBe("hoch");
  });

  it("40d: In der Vorführung tippt der Finger einmal aufs Pedal, wenn der Fahrbetrieb nicht passt — sonst nicht", () => {
    for (const [fahren, soll] of [[false, true], [true, false]] as const) {
      speicher();
      const { body, byId } = seite();
      byId("touch-left")!.hidden = true;
      const bus = new EventBus();
      const spur = L1.schritte[nrVon((st) => st.symbol === "fahren") - 1]!.vorfuehrung!;
      installGeisterdaumen({
        bus,
        steuerung: defaultConfig,
        fahrenAn: () => fahren,
        vorfuehrung: { werte: { achsen: { cab: 0, boom: 0, stick: 0, grapple: 0, rotator: 0, drive: 0.5, steer: 0 }, kamera: null, abschnitt: 0 }, gedrueckt: null },
      });
      bus.emit("lehrgang:start", startEv);
      const nr = nrVon((st) => st.symbol === "fahren");
      bus.emit("lehrgang:schritt", schrittEv(nr, "zeigen"));
      bus.emit("lehrgang:vorfuehren", { spur });
      const tipp = body.querySelector(".tippgeist.pedal")!;
      expect(tipp.classList.contains("an"), `Fahren ${fahren ? "an" : "aus"}`).toBe(soll);
      if (soll) expect(tipp.classList.contains("einmal")).toBe(true);
    }
  });

  it("40f: lehrgang:richtung ersetzt in „du“ das Bild aus der Spur — Marke links: linker Stick nach links, rechts nichts", () => {
    speicher();
    const { body, byId } = seite();
    byId("touch-left")!.hidden = true;
    const bus = new EventBus();
    installGeisterdaumen({ bus, steuerung: defaultConfig });
    bus.emit("lehrgang:start", startEv);
    const nr = nrVon((st) => st.symbol === "marke");
    bisDu(bus, nr);
    const links = body.querySelector(".geist.links")!;
    const rechts = body.querySelector(".geist.rechts")!;
    expect(links.dataset["pfeil"], "vorher aus der Spur: Hauptarm hoch").toBe("hoch");
    bus.emit("lehrgang:richtung", { id: L1.id, nr, bedarf: [{ fn: "cab", richtung: "plus" }], kamera: null });
    expect(links.dataset["pfeil"]).toBe("links");
    expect(rechts.classList.contains("an")).toBe(false);
    bus.emit("lehrgang:richtung", { id: L1.id, nr, bedarf: [{ fn: "boom", richtung: "plus" }, { fn: "stick", richtung: "minus" }], kamera: null });
    expect(links.dataset["pfeil"]).toBe("hoch");
    expect(rechts.dataset["pfeil"]).toBe("runter");
    // Fremder Schritt: zählt nicht
    bus.emit("lehrgang:richtung", { id: L1.id, nr: nr - 1, bedarf: [], kamera: null });
    expect(links.classList.contains("an")).toBe(true);
  });

  it("40c: Zoom — Strich in zwei Hälften, Teilziel 1 macht eine grün und lässt die Leiste leuchten; Kamera-Geist zeigt die fehlende Geste", () => {
    speicher();
    const { body, byId } = seite();
    const bus = new EventBus();
    installLektionsKarte({ bus, steuerung: defaultConfig, audio: { playSchritt() {} } });
    installGeisterdaumen({ bus, steuerung: defaultConfig });
    bus.emit("lehrgang:start", startEv);
    const nr = nrVon((st) => st.ziel.art === "aenderung" && st.ziel.groesse === "zoom");
    bisDu(bus, nr);
    const l = byId("lehrgangsleiste")!;
    const strich = l.querySelector(".punkte")!.children[nr - 1]!;
    expect(strich.className).toBe("jetzt geteilt");
    expect(strich.children.map((b) => b.className)).toEqual(["", ""]);
    const kam = body.querySelector(".kamgeist")!;
    expect(kam.dataset["geste"], "erst spreizen wie die Vorführung").toBe("auf");
    bus.emit("lehrgang:teilziel", { id: L1.id, nr, teil: 1, von: 2 });
    bus.emit("lehrgang:richtung", { id: L1.id, nr, bedarf: [], kamera: "zu" });
    expect(strich.children.map((b) => b.className)).toEqual(["ok neu", ""]);
    expect(l.classList.contains("teil")).toBe(true);
    expect(l.classList.contains("haken"), "der Schritt läuft weiter").toBe(false);
    expect(kam.dataset["geste"]).toBe("zu");
    bus.emit("lehrgang:haekchen", { id: L1.id, nr });
    expect(strich.className).toBe("ok neu");
    expect(strich.children).toEqual([]);
    // Andere Schritte: ein ganzer Strich
    bisDu(bus, nr + 1);
    expect(l.querySelector(".punkte")!.children[nr]!.className).toBe("jetzt");
    expect(l.classList.contains("teil")).toBe(false);
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
