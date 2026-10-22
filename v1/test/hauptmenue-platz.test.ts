/**
 * PASST DAS HAUPTMENÜ OHNE SCROLLEN? (E-196) — aus dem CSS gerechnet
 * (`test/cssmass.ts`), iPad quer und iPhone mini quer.
 *
 * Stufe 1: vier oder fünf Hauptknöpfe (SCHICHT kommt dazu). Stufe 2: zwölf
 * Lektionen bzw. die Prüfungen des Katalogs mit der längsten Sternzeile.
 * Dazu die Lektionskarte auf dem Telefon quer: Unterkante wie Aufgabe 1
 * (≤ 129, darunter ist das Arbeitsfeld frei — E-162 G2b).
 *
 * „normal" als Zeilenhöhe rechnet hier mit 1,2 (Consolas: 1,17).
 */
import { describe, expect, it } from "vitest";
import { FASSUNGEN, fassungInnen, px, schriftgroesse, wert, zeilen, type Fassung } from "./cssmass";
import { CHALLENGES } from "../src/challenges/katalog";
import { sterneText, uhrGenau, wort } from "../src/ui/aufgabentexte";
import type { Sprache } from "../src/challenges/texte";
import { schichtWort } from "../src/ui/schichttexte";

const NORMAL = 1.2;
const RAHMEN = 2; // border 2px der Knöpfe und des Felds
const quer = FASSUNGEN.filter((f) => f.w > f.h);

/** Erste Zahl einer Eigenschaft (Lücke, Rand) — wirft, wenn keine da ist. */
function zahl(sel: string[], prop: string, f: Fassung, stelle = 0): number {
  const v = wert(sel, prop, f);
  const z = v ? [...v.matchAll(/(-?\d+(?:\.\d+)?)(?:px)?/g)].map((m) => Number(m[1])) : [];
  if (!z.length) throw new Error(`${prop} fehlt fuer ${sel[0]} bei ${f.name}`);
  return z[Math.min(stelle, z.length - 1)]!;
}
function lh(sel: string[], f: Fassung): number {
  const v = wert(sel, "line-height", f);
  return v === null || v === "normal" ? NORMAL : Number(v);
}

const PANEL = ["#hauptmenue .panel"];
const H1 = ["#hauptmenue h1"];
const SUB = ["#hauptmenue .sub"];
const KNOPF = ["#hauptmenue button"];
const HKNOPF = [...KNOPF, "#hauptmenue #hm-haupt button"];
const HSMALL = ["#hauptmenue button small", "#hauptmenue #hm-haupt button small"];
const LKNOPF = [...KNOPF, "#hm-eintraege button", "#hauptmenue #hm-eintraege.lektionen button"];
const PKNOPF = [...KNOPF, "#hm-eintraege button", "#hauptmenue #hm-eintraege.pruefungen button"];
const PSMALL = ["#hauptmenue button small", "#hauptmenue #hm-eintraege.pruefungen small"];

const flach = (f: Fassung): boolean => f.h <= 430;
/** Nutzbare Höhe: sicherer Rand ab, auf dem iPad dazu `max-height: 88vh`. */
const hoehe = (f: Fassung): number => (flach(f) ? f.h - f.sa.t - f.sa.b : Math.min(f.h - f.sa.t - f.sa.b, f.h * 0.88));
/** Innenbreite des Felds */
function innenBreite(f: Fassung): number {
  const [, x] = fassungInnen(PANEL, f);
  return Math.min(f.w - f.sa.l - f.sa.r, px(PANEL, "max-width", f)) - 2 * x - 2 * RAHMEN;
}
/** Kopf des Felds: Rand + Titel + Unterzeile (in Stufe 2 auf dem Telefon quer ausgeblendet) */
function feldKopf(f: Fassung, liste: boolean): number {
  const [y] = fassungInnen(PANEL, f);
  const titel = liste && flach(f) ? 0 : Math.ceil(schriftgroesse(H1, f) * NORMAL) + zahl(H1, "margin", f, 2);
  const sub = liste && flach(f) ? 0 : Math.ceil(schriftgroesse(SUB, f) * NORMAL) + zahl(SUB, "margin", f, 2);
  return 2 * y + 2 * RAHMEN + titel + sub;
}
/** Höhe eines Rasters mit `n` Knöpfen in `spalten`, Knopfhöhe je Knopf */
function raster(hoehen: number[], spalten: number, luecke: number): number {
  let h = 0;
  for (let i = 0; i < hoehen.length; i += spalten) h += Math.max(...hoehen.slice(i, i + spalten));
  return h + (Math.ceil(hoehen.length / spalten) - 1) * luecke;
}

const HAUPT_TEXTE = (s: Sprache): string[] => [
  wort("lehrgangSchritt", s).replace("{n}", "60").replace("{m}", "60"), // L4: SW-Obergrenze, 12 Themen x 5 Schritte
  wort("pruefungenText", s),
  schichtWort("schichtText", s), // E-205
  wort("sandkastenText", s),
  "",
];

describe("Hauptmenü Stufe 1: fünf Hauptknöpfe ohne Scrollen", () => {
  for (const f of quer) {
    for (const s of ["de", "en"] as const) {
      it(`${f.name} (${s})`, () => {
        const spalten = flach(f) ? 2 : 1;
        const luecke = zahl(["#hm-haupt"], "gap", f);
        const spalte = (innenBreite(f) - (spalten - 1) * luecke) / spalten;
        const [py, pxx] = fassungInnen(HKNOPF, f);
        const breite = spalte - 2 * pxx - 2 * RAHMEN;
        const fs = schriftgroesse(KNOPF, f);
        const sfs = zahl(HSMALL, "font-size", f);
        const einzeilig = wert(HSMALL, "white-space", f) === "nowrap";
        // L2b: einzeilig heißt hier auch „nichts mit … gekürzt" (qa 21.10.2026) — seit E-205 auch SCHICHT
        if (einzeilig) {
          for (const t of HAUPT_TEXTE(s).slice(0, 4)) expect(zeilen(t, breite, sfs), t).toBe(1);
        }
        const hoehen = HAUPT_TEXTE(s).map((t) => {
          const kleinZeilen = t === "" ? 0 : einzeilig ? 1 : zeilen(t, breite, sfs);
          const klein = kleinZeilen ? zahl(HSMALL, "margin-top", f) + Math.ceil(kleinZeilen * sfs * lh(HSMALL, f)) : 0;
          return 2 * py + Math.ceil(fs * NORMAL) + klein + 2 * RAHMEN;
        });
        // der fünfte Knopf liegt auf dem Telefon über beide Spalten (eigene Reihe)
        const h = feldKopf(f, false) + zahl(["#hm-haupt"], "margin-top", f) + raster(hoehen, spalten, luecke);
        if (process.env["MASS"]) console.log(f.name, s, "Stufe 1", h, hoehen, hoehe(f));
        expect(h, `Stufe 1 ${Math.round(h)} px`).toBeLessThanOrEqual(hoehe(f));
        for (const k of hoehen) expect(k).toBeGreaterThanOrEqual(44); // Kap. 20
      });
    }
  }
});

describe("Hauptmenü Stufe 2: 12 Lektionen und alle Prüfungen ohne Scrollen", () => {
  // SW: so lang darf ein Lektionsname werden (DE und EN) — zwei Zeilen im Raster des iPhone mini
  const LANGER_NAME = "Hauptarm und Stiel zusammen";
  const listenKopf = (f: Fassung): number => feldKopf(f, true) + 44 + zahl(["#hm-haupt", "#hm-eintraege"], "margin-top", f);

  for (const f of quer) {
    it(`${f.name}: Lektionen (Name bis ${LANGER_NAME.length} Zeichen)`, () => {
      const spalten = 3;
      const luecke = zahl(["#hm-eintraege.lektionen"], "gap", f);
      const spalte = (innenBreite(f) - (spalten - 1) * luecke) / spalten;
      const [py, pxx] = fassungInnen(LKNOPF, f);
      const fs = zahl(LKNOPF, "font-size", f);
      const z = zeilen(`✓ 12 · ${LANGER_NAME}`, spalte - 2 * pxx - 2 * RAHMEN, fs);
      expect(z, "Lektionsname höchstens zwei Zeilen").toBeLessThanOrEqual(2);
      const k = Math.max(44, 2 * py + Math.ceil(z * fs * lh(LKNOPF, f)) + 2 * RAHMEN);
      const h = listenKopf(f) + raster(Array(12).fill(k), spalten, luecke);
      if (process.env["MASS"]) console.log(f.name, "Lektionen", h, k, z, spalte);
      expect(h, `Lektionen ${Math.round(h)} px`).toBeLessThanOrEqual(hoehe(f));
    });
    for (const s of ["de", "en"] as const) {
      it(`${f.name}: Prüfungen (${s}, längste Sternzeile)`, () => {
        const spalten = 2;
        const luecke = zahl(["#hm-eintraege.pruefungen"], "gap", f);
        const spalte = (innenBreite(f) - (spalten - 1) * luecke) / spalten;
        const [py, pxx] = fassungInnen(PKNOPF, f);
        const breite = spalte - 2 * pxx - 2 * RAHMEN;
        const fs = zahl(PKNOPF, "font-size", f);
        const sfs = zahl(PSMALL, "font-size", f);
        const ohneBeschr = flach(f); // `.beschr` ist auf dem Telefon quer aus
        const hoehen = CHALLENGES.map((c, i) => {
          const kopf = `🔒 ${wort("aufgabe", s)} ${i + 1} · ${c.name[s]}`;
          const klein = `${ohneBeschr ? "" : `${c.beschreibung[s]} `}${sterneText(2, s)} · ${wort("bestzeit", s)} ${uhrGenau(599999, s)}`;
          const kz = zeilen(kopf, breite, fs);
          if (flach(f)) expect(kz, kopf).toBe(1);
          const sz = zeilen(klein, breite, sfs);
          return 2 * py + Math.ceil(kz * fs * lh(PKNOPF, f)) + zahl(PSMALL, "margin-top", f) + Math.ceil(sz * sfs * lh(PSMALL, f)) + 2 * RAHMEN;
        });
        const h = listenKopf(f) + raster(hoehen, spalten, luecke);
        if (process.env["MASS"]) console.log(f.name, s, "Pruefungen", h, hoehen);
        expect(h, `Prüfungen ${Math.round(h)} px`).toBeLessThanOrEqual(hoehe(f));
      });
    }
  }
});
