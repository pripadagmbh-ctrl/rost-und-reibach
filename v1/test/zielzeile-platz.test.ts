/**
 * WO DIE ZIELZEILE STEHT (Auftrag 41-P2) — aus dem CSS gerechnet
 * (`test/cssmass.ts`), ersetzt die Platzpruefung der Aufgabenkarte.
 *
 * Fassungen: iPhone mini quer (812 x 375, sicherer Rand 50/50/0/21), iPad
 * 1024 x 768 und iPad 1180 x 820 (die Messung Q4). Bewacht wird:
 *  - Knoepfe (Ziel, PRESSEN/Tipp, ↻; ⏸ steht seit 43a neben ☰) ganz im Kamera-Mittelstreifen
 *    (35–65 %): Ein Daumen, der einen Stick setzt, trifft nie einen Knopf.
 *    Tippziele ≥ 44 px (Briefing Kap. 20).
 *  - Kein Text in der Mittelzone (zwischen den Geisterdaumen-Ringen, 25–85 %
 *    der Hoehe, Begruendung in test/lehrgangsleiste.test.ts) — eingeklappt
 *    UND mit den Woertern.
 *  - frei von ☰, ⏸, Drehtasten und Pedalen; im sichtbaren Bild.
 *  - die Woerter aller Pruefungen passen in EINE Zeile unter den Knoepfen.
 *  - Gegenprobe: zwei Knoepfe mehr (2 x 48 px) fallen auf dem iPhone mini durch.
 * Dazu die Geisterdaumen-Ringe (umgezogen aus aufgabenkarte-platz.test.ts).
 */
import { describe, it, expect } from "vitest";
import { EM_BREITE, FASSUNGEN, fassungInnen, knopfKasten, luft, pedalKasten, px, schriftgroesse, ueberlappt, wert, type Fassung, type Kasten } from "./cssmass";
import { CHALLENGES } from "../src/challenges/katalog";
import { WORTE } from "../src/ui/aufgabentexte";

const MINI = FASSUNGEN.find((f) => f.name === "iPhone mini quer")!;
const IPAD = FASSUNGEN.find((f) => f.name === "iPad quer")!;
const IPAD_GROSS: Fassung = { name: "iPad 1180 x 820", w: 1180, h: 820, sa: { l: 0, r: 0, t: 0, b: 0 } };
const HOCH = FASSUNGEN.find((f) => f.h > f.w)!;
const QUER = [MINI, IPAD, IPAD_GROSS];

const INFO = ["#zielzeile .zz-info"];
const KN = ["#zielzeile .zz-knoepfe"];
const KNOPF = ["#zielzeile button"];
const ZIEL = ["#zielzeile button", "#zielzeile #zz-ziel"];
const SATZ = ["#zielzeile .zz-satz"];
const SATZ_TEXT = ["#zielzeile #zz-satz", "#zielzeile"];

const rahmenPx = (sel: string[], f: Fassung): number => {
  const m = /^(\d+)px/.exec(wert(sel, "border", f) ?? "");
  if (!m) throw new Error(`border fehlt fuer ${sel[0]}`);
  return Number(m[1]);
};
/** Kasten von OBEN gerechnet, umgesetzt nach `Kasten` (y von unten). */
const vonOben = (name: string, f: Fassung, x0: number, x1: number, oben: number, unten: number): Kasten => ({
  name, x0, x1, y0: f.h - unten, y1: f.h - oben,
});

/** Die Knopfreihe: Ziel, dann (hoechstens einer von) PRESSEN/Tipp, ↻. `mehr` = Gegenprobe. */
function knoepfe(f: Fassung, mitPressen = true, mehr = 0): { reihe: Kasten; einzeln: Kasten[] } {
  const oben = px(KN, "top", f);
  const h = px(KNOPF, "height", f);
  const gap = px(KN, "gap", f);
  const breiten = [px(ZIEL, "width", f), ...(mitPressen ? [px(KNOPF, "width", f)] : []), px(KNOPF, "width", f)];
  expect(wert(KNOPF, "box-sizing", f), "Breite inklusive Rahmen").toBe("border-box");
  const summe = breiten.reduce((a, b) => a + b, 0) + gap * (breiten.length - 1) + mehr;
  const links = wert(KN, "left", f) === "auto" ? f.w - px(KN, "right", f) - summe : px(KN, "left", f);
  const einzeln: Kasten[] = [];
  let x = links;
  for (const b of breiten) {
    einzeln.push(vonOben(`Knopf ${einzeln.length + 1}`, f, x, x + b, oben, oben + h));
    x += b + gap;
  }
  return { reihe: vonOben("Knopfreihe", f, links, links + summe, oben, oben + h), einzeln };
}

/** Die Anzeige links: Uhr, drei Sterne, Zaehler — im breitesten Fall. */
function info(f: Fassung): Kasten {
  const [, padX] = fassungInnen(INFO, f);
  const gap = px(INFO, "gap", f);
  const stern = px(["#zielzeile .stern"], "width", f);
  const sterne = 3 * stern + 2 * px(["#zielzeile .zz-sterne"], "gap", f);
  const breite = 2 * rahmenPx(INFO, f) + 2 * padX + px(["#zielzeile .zz-uhr"], "width", f) + gap + sterne + gap + px(["#zielzeile .zz-mess"], "width", f);
  const oben = px(INFO, "top", f);
  const h = px(INFO, "height", f);
  if (wert(INFO, "right", f) === "auto") {
    const l = px(INFO, "left", f);
    return vonOben("Anzeige", f, l, l + breite, oben, oben + h);
  }
  const r = f.w - px(INFO, "right", f);
  return vonOben("Anzeige", f, r - breite, r, oben, oben + h);
}

/** Der Satz unter den Knoepfen (eine Zeile, volle Breite des Halters). */
function satz(f: Fassung): { kasten: Kasten; zeichen: number } {
  const l = px(SATZ, "left", f);
  const r = f.w - px(SATZ, "right", f);
  const oben = px(SATZ, "top", f);
  const schrift = schriftgroesse(SATZ_TEXT, f);
  const lh = Number(wert(SATZ_TEXT, "line-height", f));
  const [padY, padX] = fassungInnen(SATZ_TEXT, f);
  const b = rahmenPx(SATZ_TEXT, f);
  const h = 2 * b + 2 * padY + Math.ceil(schrift * lh);
  const zeichen = Math.floor((r - l - 2 * b - 2 * padX) / (schrift * EM_BREITE));
  return { kasten: vonOben("Satz", f, l, r, oben, oben + h), zeichen };
}

function ring(seite: "links" | "rechts", f: Fassung): Kasten {
  const sel = ["#geisterdaumen .geist", `#geisterdaumen .geist.${seite}`];
  const w = px(sel, "width", f);
  const unten = px(sel, "bottom", f);
  const x0 = seite === "links" ? px(sel, "left", f) : f.w - px(sel, "right", f) - w;
  return { name: `Ring ${seite}`, x0, x1: x0 + w, y0: unten, y1: unten + px(sel, "height", f) };
}
/** Mittelzone wie test/lehrgangsleiste.test.ts: zwischen den Ringen, 25–85 % der Hoehe (von oben). */
const mittelzone = (f: Fassung): Kasten => ({ name: "Mittelzone", x0: ring("links", f).x1, x1: ring("rechts", f).x0, y0: 0.15 * f.h, y1: 0.75 * f.h });

const woerter = (t: string): string[] => t.split(/\s+/).filter((w) => /[A-Za-zÄÖÜäöüß]{2,}/.test(w));
const KURZ = CHALLENGES.flatMap((c) => (c.kurz ? [c.kurz] : []));

describe("Zielzeile: Platz (aus dem CSS)", () => {
  for (const f of QUER) {
    describe(f.name, () => {
      const streifen = { x0: 0.35 * f.w, x1: 0.65 * f.w };
      const fest = [knopfKasten("btn-menu", f), knopfKasten("btn-halt", f), knopfKasten("btn-rot-l", f), knopfKasten("btn-rot-r", f), pedalKasten(f)];
      const zone = mittelzone(f);

      it("Text in mindestens 14 px", () => {
        expect(schriftgroesse(["#zielzeile"], f)).toBeGreaterThanOrEqual(14);
        expect(schriftgroesse(SATZ_TEXT, f)).toBeGreaterThanOrEqual(14);
      });

      for (const mitPressen of [false, true]) {
        it(`Knoepfe ${mitPressen ? "mit PRESSEN/Tipp" : "ohne"}: 44 x 44, ganz im Kamera-Mittelstreifen`, () => {
          const { reihe, einzeln } = knoepfe(f, mitPressen);
          for (const k of einzeln) {
            expect(k.x1 - k.x0, k.name).toBeGreaterThanOrEqual(44);
            expect(k.y1 - k.y0, k.name).toBeGreaterThanOrEqual(44);
          }
          expect(reihe.x0, "ragt in die linke Stick-Zone").toBeGreaterThan(streifen.x0);
          expect(reihe.x1, "ragt in die rechte Stick-Zone").toBeLessThan(streifen.x1);
        });
      }

      it("Anzeige im sichtbaren Bild, mit Luft vor den Knoepfen", () => {
        const a = info(f);
        expect(a.x0).toBeGreaterThanOrEqual(f.sa.l);
        expect(f.h - a.y1, "oben").toBeGreaterThanOrEqual(f.sa.t);
        expect(luft(a, knoepfe(f).reihe)).toBeGreaterThanOrEqual(8);
      });

      it("kein Text in der Mittelzone — eingeklappt und mit Woertern", () => {
        const zu = [info(f), knoepfe(f).reihe];
        const auf = [...zu, satz(f).kasten];
        for (const k of [...zu, ...auf]) expect(ueberlappt(k, zone), `${k.name}: ${JSON.stringify([k, zone])}`).toBe(false);
        expect(f.h - satz(f).kasten.y0, "Unterkante des Satzes").toBeLessThanOrEqual(0.25 * f.h);
      });

      it("frei von ☰, ⏸, Drehtasten, Pedalen und Geisterdaumen", () => {
        for (const k of [info(f), knoepfe(f).reihe, satz(f).kasten])
          for (const g of [...fest, ring("links", f), ring("rechts", f)])
            expect(luft(k, g), `${k.name} an ${g.name}: ${JSON.stringify([k, g])}`).toBeGreaterThanOrEqual(4);
      });

      it("die Woerter jeder Pruefung passen in eine Zeile (Deutsch und Englisch)", () => {
        const { zeichen } = satz(f);
        for (const k of KURZ) for (const t of [k.de, k.en]) expect(t.length, t).toBeLessThanOrEqual(zeichen);
        // laengerer Text (Tipp) bricht nicht um, er wird abgeschnitten — nie hinunter in die Mittelzone
        expect(wert(SATZ_TEXT, "white-space", f)).toBe("nowrap");
        expect(wert(SATZ_TEXT, "text-overflow", f)).toBe("ellipsis");
      });

      it("Geisterdaumen liegen in ihrer Stick-Zone, frei von Pedalen, Drehtasten, Menue", () => {
        const l = ring("links", f);
        const r = ring("rechts", f);
        expect(l.x0).toBeGreaterThanOrEqual(f.sa.l);
        expect(l.x1).toBeLessThanOrEqual(streifen.x0);
        expect(r.x0).toBeGreaterThanOrEqual(streifen.x1);
        expect(r.x1).toBeLessThanOrEqual(f.w - f.sa.r);
        for (const g of [l, r]) for (const k of fest) expect(luft(g, k), `${g.name} an ${k.name}`).toBeGreaterThanOrEqual(4);
      });
    });
  }

  it("die Zahlen im CSS-Kommentar stimmen", () => {
    const r = (k: Kasten, f: Fassung) => [Math.round(k.x0), Math.round(k.x1), Math.round(f.h - k.y1), Math.round(f.h - k.y0)];
    expect(r(knoepfe(MINI).reihe, MINI)).toEqual([290, 466, 8, 52]);
    expect(r(info(MINI), MINI)).toEqual([98, 278, 8, 52]);
    expect(r(satz(MINI).kasten, MINI)).toEqual([290, 522, 56, 81]);
    expect(satz(MINI).zeichen, "Zeichen je Zeile auf dem iPhone mini").toBe(28);
    expect(r(knoepfe(IPAD).reihe, IPAD).slice(0, 2)).toEqual([364, 540]);
    expect(Math.round(info(IPAD).x0)).toBe(172);
    expect(r(knoepfe(IPAD_GROSS).reihe, IPAD_GROSS).slice(0, 2)).toEqual([419, 595]);
  });

  it("GEGENPROBE: zwei Knoepfe mehr (2 x 48 px) reissen auf dem iPhone mini den Streifen", () => {
    expect(knoepfe(MINI, true, 96).reihe.x1).toBeGreaterThan(0.65 * MINI.w);
  });

  it("Telefon hoch: Knoepfe vor ⏸ und ☰, alles im Bild, nichts uebereinander", () => {
    const f = HOCH;
    const kn = knoepfe(f).reihe;
    const a = info(f);
    const s = satz(f).kasten;
    expect(luft(kn, knopfKasten("btn-menu", f))).toBeGreaterThanOrEqual(4);
    expect(luft(kn, knopfKasten("btn-halt", f)), "an ⏸").toBeGreaterThanOrEqual(4);
    for (const k of [kn, a, s]) {
      expect(k.x0, k.name).toBeGreaterThanOrEqual(f.sa.l);
      expect(k.x1, k.name).toBeLessThanOrEqual(f.w - f.sa.r);
      expect(f.h - k.y1, k.name).toBeGreaterThanOrEqual(f.sa.t);
    }
    expect(luft(kn, a)).toBeGreaterThanOrEqual(0);
    expect(luft(a, s)).toBeGreaterThanOrEqual(0);
  });
});

describe("Zielzeile: hoechstens fuenf Woerter, Englisch ohne Deutsch", () => {
  it("jede Pruefung hat ihre Woerter (≤ 5) in beiden Sprachen", () => {
    expect(KURZ.length).toBe(CHALLENGES.length);
    for (const k of KURZ) {
      for (const t of [k.de, k.en]) expect(woerter(t).length, t).toBeLessThanOrEqual(5);
      expect(k.en, k.de).not.toMatch(/[äöüßÄÖÜ]/);
      expect(k.en).not.toBe(k.de);
    }
  });
  it("Vorlesetexte der Zielzeile: Englisch ohne Umlaut", () => {
    for (const k of ["pause", "neustart", "pressen", "ziel", "platt", "zielZeigen", "tipp", "sterneMoeglich"] as const)
      expect(WORTE[k].en, k).not.toMatch(/[äöüßÄÖÜ]/);
  });
});
