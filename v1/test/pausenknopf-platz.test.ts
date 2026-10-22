/**
 * WO ⏸ UND ▶ STEHEN (Auftrag 43a, Nacharbeit 43a-N) — aus dem CSS gerechnet.
 *
 * ⏸ (Id `btn-halt`) steht in der ☰-Reihe links von ☰. Bewacht je Fassung
 * (iPhone mini quer 812 x 375 mit Rand 50/50/0/21, iPad 1024 x 768, iPad
 * 1180 x 820) und je Spielart (Sandkasten, Schicht, Lehrgang, Pruefung):
 *  - Tippziel ≥ 44 px, im sicheren Bild, nicht im Kamera-Mittelstreifen,
 *  - ≥ 8 px Luft zu BEIDEN ☰-Fassungen: der aus dem CSS gelesenen und der
 *    vor L8-B2 (62 x 72, flach 56 x 66 — HEAD 63971ae, Kommentar am
 *    L8-B2-Block in index.html), dazu Kranz-Knopf, Drehtasten, Pedale und
 *    was die Spielart oben zeigt (Schicht-Anzeige, Lehrgangsleiste, Zielzeile),
 *  - Gegenprobe: 10 px weiter rechts laege ⏸ zu nah an ☰ vor L8-B2.
 * Die Knopfkaesten rechnet dieser Test selbst (`knopf` unten), nicht mit
 * `knopfKasten` aus cssmass.ts — das baut L8-B2 gerade auf border-box um,
 * und dieser Waechter soll in beiden Staenden dasselbe sagen.
 * Das ▶-Feld: ganzes Bild, Zeichen 120 px, ueber HUD und Zielzeile, unter dem Menue.
 */
import { describe, it, expect } from "vitest";
import {
  FASSUNGEN, fassungInnen, luft, pedalKasten, px, pxOderNull, schriftgroesse, wert, zeilenabstand,
  type Fassung, type Kasten,
} from "./cssmass";

const MINI = FASSUNGEN.find((f) => f.name === "iPhone mini quer")!;
const IPAD = FASSUNGEN.find((f) => f.name === "iPad quer")!;
const IPAD_GROSS: Fassung = { name: "iPad 1180 x 820", w: 1180, h: 820, sa: { l: 0, r: 0, t: 0, b: 0 } };
const QUER = [MINI, IPAD, IPAD_GROSS];
const LUFT = 8;
/** Unterkante der Lehrgangsleiste, gemessen 74 px (test/kranzknopf.test.ts, test/lehrgangsleiste.test.ts). */
const LEISTE_UNTEN = 74;
/** `#touch .btn`: 2 px Rahmen ringsum. */
const RAHMEN = 2;

const vonOben = (name: string, f: Fassung, x0: number, x1: number, oben: number, unten: number): Kasten => ({
  name, x0, x1, y0: f.h - unten, y1: f.h - oben,
});

/**
 * Ein `#touch .btn`-Knopf, wie der Browser ihn zeichnet: content-box =
 * width + Innenrand + Rahmen, border-box = width. Eigene Rechnung (s. Kopf).
 */
function knopf(id: string, f: Fassung, name = id): Kasten {
  const sel = ["#touch .btn", `#touch #${id}`, `#${id}`];
  const [py, pxx] = wert(sel, "box-sizing", f) === "border-box" ? [-RAHMEN, -RAHMEN] : fassungInnen(sel, f);
  const b = px(sel, "width", f) + 2 * (pxx + RAHMEN);
  const h = px(sel, "height", f) + 2 * (py + RAHMEN);
  const rechts = px(sel, "right", f);
  const oben = pxOderNull(sel, "top", f);
  const unten = oben === null ? px(sel, "bottom", f) : f.h - oben - h;
  return { name, x0: f.w - rechts - b, x1: f.w - rechts, y0: unten, y1: unten + h };
}

/** ☰ vor L8-B2, fest eingetragen: iPad 62 x 72 ab rechts/oben max(12, Rand + 8), flach 56 x 66 ab max(8, Rand + 8). */
function menueVorL8B2(f: Fassung): Kasten {
  const flach = f.h <= 430; // wie "@media (max-height: 430px)"
  const [b, h, min] = flach ? [56, 66, 8] : [62, 72, 12];
  const rechts = Math.max(min, f.sa.r + 8);
  const oben = Math.max(min, f.sa.t + 8);
  return vonOben("☰ vor L8-B2", f, f.w - rechts - b, f.w - rechts, oben, oben + h);
}

const menues = (f: Fassung): Kasten[] => [knopf("btn-menu", f, "☰ aus dem CSS"), menueVorL8B2(f)];

const pause = (f: Fassung, dx = 0): Kasten => {
  const k = knopf("btn-halt", f, "⏸");
  return { ...k, x0: k.x0 + dx, x1: k.x1 + dx };
};

/** Schicht-Anzeige oben links, acht Zeilen hoch (wie test/kranzknopf.test.ts). */
function schicht(f: Fassung): Kasten {
  const A = ["#schichtanzeige", "body.touch #schichtanzeige", ".hud"];
  const [py] = fassungInnen(A, f);
  const h = 8 * Math.ceil(schriftgroesse(A, f) * zeilenabstand(A, f)) + 2 * py + 2;
  const x0 = px(A, "left", f);
  const oben = px(A, "top", f);
  return vonOben("Schicht-Anzeige", f, x0, x0 + px(A, "width", f), oben, oben + h);
}

/** Zielzeile der Pruefungen: Knoepfe (Ziel, PRESSEN, ↻ = 176), Satz, Anzeige. */
function zielzeile(f: Fassung): Kasten[] {
  const knL = px(["#zielzeile .zz-knoepfe"], "left", f);
  const knO = px(["#zielzeile .zz-knoepfe"], "top", f);
  const S = ["#zielzeile .zz-satz"];
  const satzO = px(S, "top", f);
  const infoR = f.w - px(["#zielzeile .zz-info"], "right", f);
  return [
    vonOben("Pruefung Knoepfe", f, knL, knL + 176, knO, knO + 44),
    vonOben("Pruefung Satz", f, px(S, "left", f), f.w - px(S, "right", f), satzO, satzO + 25),
    vonOben("Pruefung Anzeige", f, f.sa.l, infoR, knO, knO + 44),
  ];
}

function nachbarn(f: Fassung, art: "Sandkasten" | "Schicht" | "Lehrgang" | "Pruefung"): Kasten[] {
  const immer = [
    ...menues(f),
    knopf("btn-kranz", f, "Kranz-Knopf"),
    knopf("btn-rot-l", f),
    knopf("btn-rot-r", f),
    pedalKasten(f),
  ];
  if (art === "Schicht") return [...immer, schicht(f)];
  if (art === "Lehrgang") return [...immer, vonOben("Lehrgangsleiste", f, 0.35 * f.w, 0.65 * f.w, 0, LEISTE_UNTEN)];
  if (art === "Pruefung") return [...immer, ...zielzeile(f)];
  return immer;
}

describe("⏸: Platz neben ☰ (aus dem CSS)", () => {
  for (const f of QUER) {
    describe(f.name, () => {
      it("Tippziel ≥ 44 px, border-box ohne Innenrand, im sicheren Bild, nicht im Kamera-Mittelstreifen", () => {
        const sel = ["#touch .btn", "#touch #btn-halt", "#btn-halt"];
        expect(wert(sel, "box-sizing", f)).toBe("border-box");
        expect(wert(sel, "padding", f)).toBe("0");
        const k = pause(f);
        expect(k.x1 - k.x0).toBeGreaterThanOrEqual(44);
        expect(k.y1 - k.y0).toBeGreaterThanOrEqual(44);
        expect(f.w - k.x1, "rechter Rand").toBeGreaterThanOrEqual(f.sa.r);
        expect(f.h - k.y1, "oberer Rand").toBeGreaterThanOrEqual(f.sa.t);
        expect(k.x0, "im Kamera-Mittelstreifen").toBeGreaterThanOrEqual(0.65 * f.w);
      });

      it("in derselben Reihe wie ☰ (beide Fassungen), links davon", () => {
        for (const m of menues(f)) {
          expect(pause(f).y1, m.name).toBe(m.y1);
          expect(pause(f).x1, m.name).toBeLessThan(m.x0);
        }
      });

      for (const art of ["Sandkasten", "Schicht", "Lehrgang", "Pruefung"] as const) {
        it(`${art}: ≥ ${LUFT} px Luft zu allen Nachbarn`, () => {
          for (const n of nachbarn(f, art))
            expect(luft(pause(f), n), `${n.name}: ${JSON.stringify([pause(f), n])}`).toBeGreaterThanOrEqual(LUFT);
        });
      }

      it("GEGENPROBE: 10 px weiter rechts waere ⏸ zu nah an ☰ vor L8-B2", () => {
        expect(luft(pause(f, 10), menueVorL8B2(f))).toBeLessThan(LUFT);
      });
    });
  }

  it("GEGENPROBE: die eigene Knopfrechnung misst content-box mit Innenrand (Drehtaste 54 x 50 + Rahmen)", () => {
    const k = knopf("btn-rot-l", IPAD);
    expect([k.x1 - k.x0, k.y1 - k.y0]).toEqual([58, 54]);
  });

  it("die Zahlen im CSS-Kommentar stimmen", () => {
    const r = (k: Kasten, f: Fassung) => [k.x0, k.x1, f.h - k.y1, f.h - k.y0];
    expect(r(pause(IPAD), IPAD)).toEqual([896, 942, 12, 58]);
    expect(r(pause(MINI), MINI)).toEqual([646, 690, 8, 52]);
    expect(r(menueVorL8B2(IPAD), IPAD)).toEqual([950, 1012, 12, 84]);
    expect(r(menueVorL8B2(MINI), MINI)).toEqual([698, 754, 8, 74]);
  });
});

describe("▶-Feld (aus dem CSS)", () => {
  for (const f of QUER) {
    it(`${f.name}: ganzes Bild, Zeichen 120 px, ueber HUD/Zielzeile/Leiste, unter dem Menue`, () => {
      const F = ["#weiterfeld"];
      expect(wert(F, "position", f)).toBe("fixed");
      expect(wert(F, "inset", f)).toBe("0");
      expect(wert(F, "touch-action", f)).toBe("none");
      expect(px(["#weiterfeld svg"], "width", f)).toBe(120);
      expect(px(["#weiterfeld svg"], "height", f)).toBe(120);
      const z = (sel: string): number => Number(wert([sel], "z-index", f));
      expect(z("#weiterfeld")).toBeGreaterThan(Math.max(z("#zielzeile"), z("#lehrgangsleiste"), z("#hoerprobe-zeile")));
      expect(z("#weiterfeld")).toBeLessThan(z("#pause"));
      expect(pxOderNull(F, "top", f), "kein Versatz").toBeNull();
    });
  }
});
