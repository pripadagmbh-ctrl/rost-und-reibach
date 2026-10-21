/**
 * SCHICHT IM HAUPTMENÜ (E-205): Knopf, zweite Stufe, Sperre mit Grund,
 * Adresse, Platz ohne Scrollen — und die Wörter der Schicht in beiden Sprachen.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FASSUNGEN, fassungInnen, px, schriftgroesse, seite, wert, wurzel, zeilen, type Fassung } from "./cssmass";
import { schichtAusAdresse, stufenKnopf } from "../src/ui/schichtmenue";
import { SCHICHT_WORTE, STUFEN_TEXT } from "../src/ui/schichttexte";
import { SCHICHTSTUFEN, type SchichtLauf } from "../src/economy/kasse";
import type { Ablage } from "../src/core/bestenliste";

const leer = (): Ablage => ({ v: 2, aufgaben: {}, sandkasten: {}, schichten: {} });
const lauf = (verdienstEur: number, sterne: 1 | 2 | 3): SchichtLauf => ({ stufe: "montag", verdienstEur, tonnen: 20, quoteBp: 9000, warteS: 30, sterne, datum: "2026-10-21" });

describe("Hauptmenü: SCHICHT", () => {
  it("der Knopf steht zwischen PRÜFUNGEN und SANDKASTEN und wird beschriftet", () => {
    const haupt = seite.slice(seite.indexOf('<div id="hm-haupt"'), seite.indexOf('<div id="hm-liste"'));
    const ids = [...haupt.matchAll(/<button id="([\w-]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(["hm-lehrgang", "hm-pruefungen", "hm-schicht", "hm-sandkasten", "hm-bestenliste"]);
    const menue = readFileSync(resolve(wurzel, "src/ui/hauptmenue.ts"), "utf8");
    expect(menue).toContain('haupt("hm-schicht"');
    expect(menue).toContain('"schichten"');
    expect(menue).toContain('{ art: "schicht"; stufe: Schichtstufe }');
  });

  it("Adresse #schicht=<stufe> führt hinein, nur mit einer echten Stufe", () => {
    expect(schichtAusAdresse("#schicht=montag")).toBe("montag");
    expect(schichtAusAdresse("#schicht=freitag")).toBe("freitag");
    expect(schichtAusAdresse("#schicht=sonntag")).toBeNull();
    expect(schichtAusAdresse("#schicht=")).toBeNull();
    expect(schichtAusAdresse("#challenge=verladen")).toBeNull();
    expect(schichtAusAdresse("#schicht=montag&x=1")).toBeNull();
    expect(schichtAusAdresse("")).toBeNull();
  });

  it("noch nichts gespielt: Montag frei, Mittwoch und Freitag mit Schloss UND Grund", () => {
    const mo = stufenKnopf("montag", leer(), "de");
    expect(mo).toMatchObject({ frei: true, kopf: "MONTAG", beschr: "ruhig – nur Kipper", stand: "Noch nicht gespielt." });
    const mi = stufenKnopf("mittwoch", leer(), "de");
    expect(mi.frei).toBe(false);
    expect(mi.kopf).toBe("🔒 MITTWOCH");
    expect(mi.stand).toBe("🔒 erst Montag zu Ende spielen");
    expect(stufenKnopf("freitag", leer(), "en").stand).toBe("🔒 finish Wednesday first");
  });

  it("nach einem Montag: Sterne und Bestverdienst, Mittwoch frei", () => {
    const d = leer();
    d.schichten.montag = [lauf(5240, 2), lauf(3000, 3)];
    const mo = stufenKnopf("montag", d, "de");
    // Bestverdienst vom besten Lauf, Sterne die besten unter den gespeicherten
    expect(mo.stand).toBe("★★★  drei von drei Sternen · Bestverdienst 5.240 €");
    expect(stufenKnopf("montag", d, "en").stand).toBe("★★★  three of three stars · Best earnings 5,240 €");
    expect(stufenKnopf("mittwoch", d, "de")).toMatchObject({ frei: true, kopf: "MITTWOCH", stand: "Noch nicht gespielt." });
    expect(stufenKnopf("freitag", d, "de").frei).toBe(false);
  });
});

/* ------------------------------------------------------------- Platz */

const NORMAL = 1.2;
const RAHMEN = 2;
const flach = (f: Fassung): boolean => f.h <= 430;
const hoehe = (f: Fassung): number => (flach(f) ? f.h - f.sa.t - f.sa.b : Math.min(f.h - f.sa.t - f.sa.b, f.h * 0.88));
const zahl = (sel: string[], prop: string, f: Fassung, stelle = 0): number => {
  const z = [...(wert(sel, prop, f) ?? "").matchAll(/(-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  if (!z.length) throw new Error(`${prop} fehlt fuer ${sel[0]}`);
  return z[Math.min(stelle, z.length - 1)]!;
};

describe("Hauptmenü Stufe 2: drei Schichtstufen ohne Scrollen", () => {
  const PANEL = ["#hauptmenue .panel"];
  const KNOPF = ["#hauptmenue button", "#hm-eintraege button"];
  const SMALL = ["#hauptmenue button small"];
  for (const f of FASSUNGEN.filter((x) => x.w > x.h)) {
    for (const s of ["de", "en"] as const) {
      it(`${f.name} (${s})`, () => {
        expect(wert(["#hm-eintraege"], "grid-template-columns", f), "eine Spalte").toBe("1fr");
        const [, pxx] = fassungInnen(PANEL, f);
        const innen = Math.min(f.w - f.sa.l - f.sa.r, px(PANEL, "max-width", f)) - 2 * pxx - 2 * RAHMEN;
        const [py, kx] = fassungInnen(KNOPF, f);
        const breite = innen - 2 * kx - 2 * RAHMEN;
        const fs = schriftgroesse(KNOPF, f);
        const sfs = schriftgroesse(SMALL, f);
        const lh = Number(wert(SMALL, "line-height", f));
        const d = leer();
        d.schichten.montag = [{ ...lauf(-12345, 3) }];
        const hoehen = SCHICHTSTUFEN.map((st) => {
          const k = stufenKnopf(st, d, s);
          expect(zeilen(k.kopf, breite, fs), k.kopf).toBe(1);
          const klein = `${flach(f) ? "" : `${k.beschr} · `}${k.stand}`; // .beschr ist auf dem Telefon quer aus
          return 2 * py + Math.ceil(fs * NORMAL) + zahl(SMALL, "margin-top", f) + Math.ceil(zeilen(klein, breite, sfs) * sfs * lh) + 2 * RAHMEN;
        });
        const [y] = fassungInnen(PANEL, f);
        const titel = flach(f) ? 0 : Math.ceil(schriftgroesse(["#hauptmenue h1"], f) * NORMAL) + 4 + Math.ceil(13 * NORMAL) + 16;
        const h = 2 * y + 2 * RAHMEN + titel + 44 + 10 + hoehen.reduce((a, b) => a + b, 0) + 2 * zahl(["#hm-eintraege"], "gap", f);
        if (process.env["MASS"]) console.log(f.name, s, "Schichten", h, hoehen, hoehe(f));
        expect(h, `${Math.round(h)} px`).toBeLessThanOrEqual(hoehe(f));
        for (const k of hoehen) expect(k).toBeGreaterThanOrEqual(44);
      });
    }
  }
});

/* ------------------------------------------------------------- Sprache */

/** Wie `test/sprache.test.ts`: Sieht ein Text deutsch aus? */
const DEUTSCH = /[äöüÄÖÜß]|\b(der|das|und|nicht|ist|mit|für|ein|eine|zum|zur|auf|wird|noch|erst|kein|oder|Fuhre|Fuhren|Kasse|Schicht|Teile?)\b/;

describe("Wörter der Schicht: DE und EN", () => {
  const alle = [...Object.entries(SCHICHT_WORTE), ...Object.entries(STUFEN_TEXT).flatMap(([k, v]) => [[`${k}.name`, v.name], [`${k}.beschr`, v.beschr]] as const)];
  it("jede Zeile hat beide Sprachen, Englisch ohne Deutsch, dieselben Platzhalter", () => {
    for (const [k, t] of alle) {
      expect(t.de.trim(), k).not.toBe("");
      expect(t.en.trim(), k).not.toBe("");
      expect(DEUTSCH.test(t.en), `${k}: ${t.en}`).toBe(false);
      const platz = (x: string): string[] => [...x.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort();
      expect(platz(t.en), k).toEqual(platz(t.de));
    }
  });
  it("Hinweise kurz: höchstens acht Wörter (Rolle, Regel 6)", () => {
    for (const [k, t] of alle) for (const x of [t.de, t.en]) expect(x.split(/\s+/).length, `${k}: ${x}`).toBeLessThanOrEqual(8);
  });
});
