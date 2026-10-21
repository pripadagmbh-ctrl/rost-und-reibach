/**
 * DIE FEIERABEND-TAFEL DER SCHICHT (E-205): Zeilen aus der Bilanz, Speicherung
 * beim Zeigen, Rang, Weiter-Stufe, Ton am Ereignis — und kein Scrollen.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventBus } from "../src/core/events";
import { leseBestenliste } from "../src/core/bestenliste";
import type { Schichtbilanz } from "../src/economy/kasse";
import { feierabend, installSchichtTafel, naechsteStufe, schichtTafelZeilen } from "../src/ui/schichttafel";
import { FASSUNGEN, fassungInnen, px, schriftgroesse, wert, wurzel, zeilen, type Fassung } from "./cssmass";

const bilanz = (x: Partial<Schichtbilanz> = {}): Schichtbilanz => ({
  stufe: "montag",
  tonnenUmgeschlagen: 31.27,
  sortierquote: 0.914,
  warteS: 74.6,
  erloesEur: 6120.4,
  standgeldEur: 14.6,
  fehlwurfEur: 75,
  schadenEur: 50,
  lagerwertEur: 840.3,
  verdienstEur: 6821.1,
  sterne: 2,
  ...x,
});

function speicher(wirft = false): Map<string, string> {
  const m = new Map<string, string>();
  const f = (): never => {
    throw new Error("QuotaExceededError");
  };
  vi.stubGlobal("localStorage", {
    getItem: wirft ? f : (k: string) => m.get(k) ?? null,
    setItem: wirft ? f : (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  });
  return m;
}
afterEach(() => vi.unstubAllGlobals());

describe("Zeilen aus der Bilanz", () => {
  it("Deutsch: Tonnen, Quote mit Zeichen und Wort, Wartezeit, Erlös, Rest, Abzüge, Tagesverdienst", () => {
    expect(schichtTafelZeilen(bilanz(), "de").map((z) => `${z.name}: ${z.wert}`)).toEqual([
      "Umgeschlagen: 31,3 t",
      "Sortierquote: ✓ 91 % sauber",
      "Wartezeit: 1:14",
      "Erlös: +6.120 €",
      "Boxen-Rest 70 %: +840 €",
      "Standgeld: −15 €",
      "Fehlwürfe: −75 €",
      "Schäden: −50 €",
      "Tagesverdienst: +6.821 €",
    ]);
  });
  it("Englisch", () => {
    expect(schichtTafelZeilen(bilanz(), "en").map((z) => `${z.name}: ${z.wert}`)).toEqual([
      "Handled: 31.3 t",
      "Sorting accuracy: ✓ 91 % clean",
      "Waiting time: 1:14",
      "Sales: +6,120 €",
      "Left in bins 70 %: +840 €",
      "Waiting fees: −15 €",
      "Wrong bins: −75 €",
      "Damage: −50 €",
      "Day's earnings: +6,821 €",
    ]);
  });
  it("Urteil nie nur Farbe: ! und ✗ mit Wort; ohne Abzug „0 €\"; Verlust mit Minus", () => {
    const z = schichtTafelZeilen(bilanz({ sortierquote: 0.7, standgeldEur: 0, verdienstEur: -320 }), "de");
    expect(z[1]!.wert).toBe("! 70 % durchwachsen");
    expect(z[5]!.wert).toBe("0 €");
    expect(z[8]).toEqual({ name: "Tagesverdienst", wert: "−320 €", farbe: "#e08a5a" });
    expect(schichtTafelZeilen(bilanz({ sortierquote: 0.3 }), "de")[1]!.wert).toBe("✗ 30 % zusammengekippt");
  });
});

describe("Feierabend: speichern beim Zeigen, Rang, nächste Stufe", () => {
  it("erster Lauf = neuer Rekord, ein schlechterer = Platz 2; Mittwoch wird frei", () => {
    speicher();
    const a = feierabend(bilanz(), "de", new Date(2026, 9, 21));
    expect(a.kopf).toBe("FEIERABEND · MONTAG");
    expect(a.sterne).toBe("★★☆  zwei von drei Sternen");
    expect(a.rang.wert).toBe("★ Neuer Rekord!");
    expect(a.naechste).toBe("mittwoch");
    const b = feierabend(bilanz({ verdienstEur: 2000, sterne: 1 }), "de");
    expect(b.rang.wert).toBe("Platz 2 von 5");
    expect(leseBestenliste().schichten.montag!.map((l) => l.verdienstEur)).toEqual([6821, 2000]);
  });
  it("abgebrochen (0 Sterne): nicht gespeichert, keine nächste Stufe", () => {
    speicher();
    const a = feierabend(bilanz({ sterne: 0 }), "de");
    expect(a.platz).toBeNull();
    expect(a.rang.wert).toBe("nicht unter den besten 5");
    expect(a.naechste).toBeNull();
    expect(leseBestenliste().schichten).toEqual({});
  });
  it("Freitag hat keine nächste Stufe", () => {
    speicher();
    expect(feierabend(bilanz({ stufe: "freitag" }), "en").naechste).toBeNull();
    expect(naechsteStufe("mittwoch", { mittwoch: 1 })).toBe("freitag");
    expect(naechsteStufe("mittwoch", {})).toBeNull();
  });
  it("Speicher gesperrt (Safari privat): Rang und Weiter trotzdem", () => {
    speicher(true);
    const a = feierabend(bilanz(), "de");
    expect(a.platz).toBe(1);
    expect(a.naechste).toBe("mittwoch");
  });
});

describe("Ton hängt am Ereignis (Regel 10)", () => {
  it("schicht:ende → Sirene und Sterntöne", () => {
    speicher();
    const bus = new EventBus();
    const audio = { playFeierabend: vi.fn(), playSterne: vi.fn() };
    const t = installSchichtTafel({ bus, audio });
    bus.emit("schicht:ende", { bilanz: bilanz({ sterne: 3 }) });
    expect(audio.playFeierabend).toHaveBeenCalledTimes(1);
    expect(audio.playSterne).toHaveBeenCalledWith(3);
    expect(t.offen).toBe(false); // ohne Seite kein Feld
  });
  it("und nirgends sonst: die Tafel ruft die Sirene nur im Zuhörer von schicht:ende", () => {
    const quelle = readFileSync(resolve(wurzel, "src/ui/schichttafel.ts"), "utf8");
    const an = quelle.indexOf('bus.on("schicht:ende"');
    expect(an).toBeGreaterThan(0);
    expect(quelle.indexOf("m.audio.playFeierabend()")).toBeGreaterThan(an);
    expect(quelle.split("m.audio.playFeierabend()").length - 1).toBe(1);
  });
});

/* ------------------------------------------------------------------ Platz */

const IPAD_AIR: Fassung = { name: "iPad quer 1180", w: 1180, h: 820, sa: { l: 0, r: 0, t: 0, b: 0 } };
const NORMAL = 1.2;
const P = ["#schichttafel .panel"];
const Z = ["#schichttafel .zeile"];
const KN = ["#schichttafel button"];
const zahlen = (v: string | null): number[] => (v ?? "").trim().split(/\s+/).map((t) => parseFloat(t));
/** Zeilen bei Sperrschrift: jede Figur ist um `letter-spacing` breiter. */
const zeilenGesperrt = (t: string, breite: number, fs: number, sperr: number): number => zeilen(t, breite, fs + sperr / 0.55);

describe("Die Tafel passt ohne Scrollen", () => {
  // die längsten Texte, die sie schreiben kann
  const lang = bilanz({ stufe: "mittwoch", sortierquote: 0.12, erloesEur: -12345, lagerwertEur: 12345, standgeldEur: 12345, fehlwurfEur: 12345, schadenEur: 12345, verdienstEur: -12345, tonnenUmgeschlagen: 123.4, warteS: 3599 });
  for (const f of [IPAD_AIR, ...FASSUNGEN]) {
    it(`${f.name}: zehn Zeilen, Sterne, drei Knöpfe`, () => {
      speicher();
      const [py, pxx] = fassungInnen(P, f);
      const breite = Math.min(f.w - f.sa.l - f.sa.r, px(P, "max-width", f));
      const innen = breite - 2 * pxx - 4;
      const spalten = /repeat\((\d+)/.exec(wert(["#st-zahlen"], "grid-template-columns", f) ?? "")?.[1];
      const n = spalten ? Number(spalten) : 1;
      const spalteB = (innen - (n - 1) * px(["#st-zahlen"], "column-gap", f)) / n;
      const fs = schriftgroesse(Z, f);
      expect(fs).toBeGreaterThanOrEqual(14);
      const [zy, zx] = fassungInnen(Z, f);
      const zeile = fs * Number(wert(Z, "line-height", f)) + 2 * zy + 1;
      const summeFs = schriftgroesse(["#schichttafel .zeile", "#schichttafel .zeile.summe"], f);
      const luecke = px(Z, "gap", f);

      let hoehe = 0;
      for (const s of ["de", "en"] as const) {
        const a = feierabend(lang, s);
        // Breite: Name + Zahl in einer Zeile, in ihrer Spalte
        for (const z of a.zeilen.slice(0, -1)) expect((z.name.length + z.wert.length) * fs * 0.55 + luecke + 2 * zx, `${z.name} ${z.wert}`).toBeLessThanOrEqual(spalteB);
        const v = a.zeilen[a.zeilen.length - 1]!;
        expect((v.name.length + v.wert.length) * summeFs * 0.55 + luecke + 2 * zx).toBeLessThanOrEqual(innen);
        expect((a.rang.name.length + a.rang.wert.length) * fs * 0.55 + luecke + 2 * zx).toBeLessThanOrEqual(innen);
        // Höhe
        const h2 = ["#schichttafel h2"];
        const st = ["#st-sterne"];
        const kopfZ = zeilenGesperrt(a.kopf, innen, schriftgroesse(h2, f), px(h2, "letter-spacing", f));
        const sternZ = zeilenGesperrt(a.sterne, innen, schriftgroesse(st, f), px(st, "letter-spacing", f));
        const knoepfeNeben = wert(["#st-knoepfe"], "display", f) === "flex";
        const knopf = Math.max(px(KN, "min-height", f), 2 * fassungInnen(KN, f)[0] + 4 + 14 * NORMAL);
        const knopfB = knoepfeNeben ? (innen - 2 * px(["#st-knoepfe"], "gap", f)) / 3 : innen;
        for (const t of ["NOCHMAL", "WEITER: MITTWOCH", "NEXT: WEDNESDAY", "ZUM MENÜ", "MAIN MENU"]) {
          expect(t.length * schriftgroesse(KN, f) * 0.55 + 2 * fassungInnen(KN, f)[1] + 4, t).toBeLessThanOrEqual(knopfB);
        }
        const h =
          2 * py + 4 +
          kopfZ * schriftgroesse(h2, f) * NORMAL + zahlen(wert(h2, "margin", f))[2]! +
          sternZ * schriftgroesse(st, f) * NORMAL + zahlen(wert(st, "margin", f))[2]! +
          Math.ceil(8 / n) * zeile +
          (summeFs * Number(wert(Z, "line-height", f)) + 2 * zy + 1) +
          zeile +
          px(["#st-knoepfe"], "margin-top", f) +
          (knoepfeNeben ? knopf : 3 * (knopf + zahlen(wert(KN, "margin", f))[0]!));
        hoehe = Math.max(hoehe, h);
        expect(knopf).toBeGreaterThanOrEqual(44);
      }
      const platz = f.h - f.sa.t - f.sa.b;
      if (process.env["MASS"]) console.log(f.name, "Tafel", Math.round(hoehe), platz, n, Math.round(spalteB));
      expect(hoehe, `${Math.round(hoehe)} px von ${platz}`).toBeLessThanOrEqual(platz);
    });
  }
  it("GEGENPROBE: einspaltig mit Knöpfen untereinander passte es auf dem iPhone mini quer nicht", () => {
    const f = FASSUNGEN.find((x) => x.name === "iPhone mini quer")!;
    const zeile = 14 * 1.5 + 4 + 1;
    const h = 24 + 22 + 28 + 10 * zeile + 8 + 3 * 52;
    expect(h).toBeGreaterThan(f.h - f.sa.t - f.sa.b);
  });
});
