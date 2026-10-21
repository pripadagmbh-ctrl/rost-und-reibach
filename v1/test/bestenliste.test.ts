/**
 * BESTENLISTE (E-195): Rangfolge, Speicher, Sandkasten-Rekorde, Texte, Platz.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  BESTENLISTE_KEY,
  GC_PRAEFIX,
  eintragen,
  laufAus,
  LEADERBOARD_IDS,
  leseBestenliste,
  merkeLauf,
  merkeRekord,
  REKORD_LEADERBOARD_IDS,
  SCHICHT_LEADERBOARD_IDS,
  besteSchichtSterne,
  eintragenSchicht,
  merkeSchicht,
  pruefeAblage,
  type Lauf,
  type RekordId,
} from "../src/core/bestenliste";
import { installSandkastenRekorde, QUOTE_AB_KG, WURF_FENSTER_S } from "../src/core/rekorde";
import { EventBus } from "../src/core/events";
import { CHALLENGES } from "../src/challenges/katalog";
import { detailTabelle, rekordZeilen, schichtKarte, schichtTabelle, tagText } from "../src/ui/bestenliste";
import { SCHICHTSTUFEN, schichtLauf as ausBilanz, type SchichtLauf, type Schichtstufe } from "../src/economy/kasse";
import { schichtWort } from "../src/ui/schichttexte";
import { rangZeile } from "../src/ui/abrechnung";
import { uhrGenau } from "../src/ui/aufgabentexte";
import { NUR_IM_BETRIEB } from "../src/core/spielart";
import { nachEnglisch, setzeSprache } from "../src/ui/sprache";
import { sprache as aufgabenSprache } from "../src/challenges/texte";
import { FASSUNGEN, fassungInnen, px, schriftgroesse, seite, wert, zeilen, type Fassung } from "./cssmass";
import { abrechnungsMass } from "./abrechnungsmass";

const lauf = (sterne: number, zeitS: number, datum = "2026-10-21T10:00:00.000Z"): Lauf => ({
  sterne,
  zeitHs: Math.round(zeitS * 100),
  werte: {},
  datum,
});

/** localStorage als Map — oder einer, der wirft (Safari privat). */
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

describe("Rangfolge: erst Sterne, dann Zeit, höchstens 5", () => {
  it("drei Sterne langsam schlagen einen Stern schnell", () => {
    const a = eintragen([], lauf(1, 30)).liste;
    const r = eintragen(a, lauf(3, 200));
    expect(r.platz).toBe(1);
    expect(r.liste.map((l) => l.sterne)).toEqual([3, 1]);
  });
  it("bei gleichen Sternen gewinnt die kürzere Zeit; Gleichstand: der ältere bleibt vorn", () => {
    let l: Lauf[] = [];
    for (const z of [90, 60, 120]) l = eintragen(l, lauf(2, z)).liste;
    expect(l.map((x) => x.zeitHs)).toEqual([6000, 9000, 12000]);
    const gleich = eintragen(l, lauf(2, 90, "2026-10-22T00:00:00.000Z"));
    expect(gleich.platz).toBe(3);
    expect(gleich.liste[1]!.datum).toBe("2026-10-21T10:00:00.000Z");
  });
  it("höchstens 5; der sechste fällt heraus, ein schlechterer kommt nicht hinein", () => {
    let l: Lauf[] = [];
    for (const z of [10, 20, 30, 40, 50]) l = eintragen(l, lauf(3, z)).liste;
    expect(eintragen(l, lauf(3, 60)).platz).toBeNull();
    expect(eintragen(l, lauf(3, 60)).liste).toHaveLength(5);
    const r = eintragen(l, lauf(3, 25));
    expect(r.platz).toBe(3);
    expect(r.liste.map((x) => x.zeitHs / 100)).toEqual([10, 20, 25, 30, 40]);
  });
  it("laufAus: Zeit in Hundertsteln, nur die gewerteten Messgrößen", () => {
    const presse = CHALLENGES.find((c) => c.id === "verladen")!;
    const l = laufAus(
      {
        sterne: 2,
        messung: { zeitS: 83.456, fehlwuerfe: 4, harteAufschlaege: 1, praezisionCm: 37.6, ueberlasten: 2, fremdteile: 0 },
        wertung: presse.wertung,
      },
      new Date("2026-10-21T12:00:00Z")
    );
    expect(l).toEqual({ sterne: 2, zeitHs: 8346, werte: { praezisionCm: 38, harteAufschlaege: 1 }, datum: "2026-10-21T12:00:00.000Z" });
    expect(Number.isInteger(l.zeitHs)).toBe(true);
  });
});

describe("Speicher", () => {
  it("Lauf wird gespeichert und sein Platz kommt zurück", () => {
    const m = speicher();
    expect(merkeLauf("sortieren", lauf(2, 100))).toBe(1);
    expect(merkeLauf("sortieren", lauf(3, 150))).toBe(1);
    expect(merkeLauf("sortieren", lauf(2, 90))).toBe(2);
    expect(leseBestenliste().aufgaben.sortieren!.map((l) => l.sterne)).toEqual([3, 2, 2]);
    expect(JSON.parse(m.get(BESTENLISTE_KEY)!).v).toBe(2); // E-205: Schema 2
  });
  it("kaputter Speicher ergibt eine leere Liste, ohne Wurf", () => {
    const m = speicher();
    for (const roh of ["{kein json", "42", "null", '"text"', "[]", '{"v":0,"aufgaben":{"x":[]}}', '{"v":2}', '{"v":3,"aufgaben":{}}', '{"aufgaben":{}}']) {
      m.set(BESTENLISTE_KEY, roh);
      expect(leseBestenliste(), roh).toEqual({ v: 2, aufgaben: {}, sandkasten: {}, schichten: {} });
    }
    // falsche Form im Einzelnen: kaputte Einträge fallen heraus, gute bleiben — und Schema 1 wird übernommen (E-205)
    m.set(BESTENLISTE_KEY, JSON.stringify({ v: 1, aufgaben: { a: [lauf(3, 9), { sterne: "drei" }, null, lauf(7, 1)], b: "x" }, sandkasten: { quoteBp: { wert: "viel" } } }));
    expect(leseBestenliste()).toEqual({ v: 2, aufgaben: { a: [lauf(3, 9)] }, sandkasten: {}, schichten: {} });
  });
  it("localStorage wirft oder fehlt: leer lesen, Platz trotzdem melden", () => {
    speicher(true);
    expect(leseBestenliste().aufgaben).toEqual({});
    expect(merkeLauf("sortieren", lauf(1, 10))).toBe(1);
    expect(merkeRekord("sortiertKg", 500)).toBe(true);
    vi.unstubAllGlobals();
    expect(() => leseBestenliste()).not.toThrow();
  });
  it("Sandkasten-Rekord: höher ist besser, beim Ausweiden tiefer", () => {
    speicher();
    expect(merkeRekord("sortiertKg", 500)).toBe(true);
    expect(merkeRekord("sortiertKg", 400)).toBe(false);
    expect(merkeRekord("ausweidenHs", 9000)).toBe(true);
    expect(merkeRekord("ausweidenHs", 9500)).toBe(false);
    expect(merkeRekord("ausweidenHs", 8000)).toBe(true);
    expect(leseBestenliste().sandkasten).toMatchObject({ sortiertKg: { wert: 500 }, ausweidenHs: { wert: 8000 } });
  });
});

describe("Game-Center-Kennungen", () => {
  const alle = [...Object.values(LEADERBOARD_IDS), ...Object.values(REKORD_LEADERBOARD_IDS), ...Object.values(SCHICHT_LEADERBOARD_IDS)];
  it("E-205: je Schichtstufe eine Verdienst-Kennung, feste Form", () => {
    expect(Object.keys(SCHICHT_LEADERBOARD_IDS)).toEqual([...SCHICHTSTUFEN]);
    for (const st of SCHICHTSTUFEN) expect(SCHICHT_LEADERBOARD_IDS[st]).toBe(`de.rostundreibach.app.schicht.${st}.verdienst`);
  });
  it("jede Aufgabe aus CHALLENGES hat eine, keine überzählige", () => {
    expect(Object.keys(LEADERBOARD_IDS).sort()).toEqual(CHALLENGES.map((c) => c.id).sort());
  });
  it("eindeutig, nur Buchstaben, Ziffern, Punkt und Unterstrich", () => {
    expect(new Set(alle).size).toBe(alle.length);
    for (const id of alle) expect(id).toMatch(/^[a-z0-9_.]+$/);
  });
  it("beginnen mit der Bundle-ID der App (capacitor.config.json, seit E-194 de.rostundreibach.app)", () => {
    const appId = (JSON.parse(readFileSync(new URL("../capacitor.config.json", import.meta.url), "utf8")) as { appId: string }).appId;
    expect(GC_PRAEFIX).toBe(appId);
    for (const id of alle) expect(id.startsWith(appId + ".")).toBe(true);
  });
});

/** Ein Sandkasten mit Bus, Uhr und mitgeschriebenen Rekorden. */
function sandkasten(): { bus: EventBus; takt: (s: number) => void; rek: Partial<Record<RekordId, number>> } {
  const bus = new EventBus();
  const rek: Partial<Record<RekordId, number>> = {};
  const r = installSandkastenRekorde(bus, (id, w) => ((rek[id] = w), true));
  return { bus, takt: (s) => r.takt(s), rek };
}
const rein = (bus: EventBus, itemId: string, kg: number, correct = true, containerId = "steel"): void =>
  bus.emit("itemEntered", { itemId, materialId: "steel", containerId, correct, massKg: kg });
const abriss = (bus: EventBus, handle: number, rest: number | undefined, art: "ab" | "auf" = "ab"): void =>
  bus.emit("wrack:abriss", { art, handle, teil: "x", name: "x", massKg: 10, rest, x: 0, y: 0, z: 0 });

describe("Sandkasten-Rekorde", () => {
  it("ein Teil zählt nur einmal — heraus und wieder hinein", () => {
    const { bus, takt, rek } = sandkasten();
    takt(1);
    bus.emit("released", { count: 1 });
    rein(bus, "item_1", 300);
    bus.emit("itemLeft", { itemId: "item_1", containerId: "steel" });
    rein(bus, "item_1", 300);
    rein(bus, "item_2", 200);
    expect(rek.sortiertKg).toBe(500);
  });
  it("nur, was der Spieler hineintat: ohne Loslassen (Kipper, Laden) zählt nichts", () => {
    const { bus, takt, rek } = sandkasten();
    rein(bus, "beim_laden", 900); // vor dem ersten Takt
    takt(1);
    rein(bus, "kipper", 900);
    bus.emit("released", { count: 1 });
    takt(WURF_FENSTER_S + 0.1);
    rein(bus, "spaeter", 900);
    expect(rek.sortiertKg).toBeUndefined();
  });
  it("Anteil erst ab der Mindestmenge — ein Treffer ist keine 100 %", () => {
    const { bus, takt, rek } = sandkasten();
    takt(1);
    bus.emit("released", { count: 1 });
    rein(bus, "a", 100);
    expect(rek.quoteBp).toBeUndefined();
    rein(bus, "b", QUOTE_AB_KG - 300, true);
    rein(bus, "c", 200, false, "copper");
    expect(rek.quoteBp).toBe(Math.round(((QUOTE_AB_KG - 200) / QUOTE_AB_KG) * 10000));
  });
  it("ausgeweidet erst bei rest 0; Pause (kein Takt) zählt nicht", () => {
    const { bus, takt, rek } = sandkasten();
    takt(1);
    abriss(bus, 7, undefined, "auf"); // Haube springt auf: Uhr läuft
    takt(10);
    abriss(bus, 7, 2);
    takt(5);
    abriss(bus, 7, 1);
    expect(rek.ausweidenHs).toBeUndefined();
    // Pause: main.ts ruft takt() nicht — die Wanduhr läuft, die Spielzeit nicht
    takt(5);
    abriss(bus, 7, 0);
    expect(rek.ausweidenHs).toBe(2000);
  });
  it("ein Wrack, das schon beim Laden Teile verlor, zählt nicht", () => {
    const { bus, takt, rek } = sandkasten();
    abriss(bus, 9, 1); // Spielstand: Teile ab, vor dem ersten Takt
    takt(1);
    abriss(bus, 9, 0);
    expect(rek.ausweidenHs).toBeUndefined();
  });
});

describe("Texte DE + EN", () => {
  const d = {
    v: 2 as const,
    schichten: {},
    aufgaben: { verladen: [{ ...lauf(3, 83.45), werte: { praezisionCm: 38, harteAufschlaege: null } }] },
    sandkasten: { sortiertKg: { wert: 3450, datum: "2026-10-21T10:00:00.000Z" }, quoteBp: { wert: 9730, datum: "2026-10-21T10:00:00.000Z" } },
  };
  it("Stoppuhr mit Hundertsteln, Komma auf Deutsch", () => {
    expect(uhrGenau(8345, "de")).toBe("1:23,45");
    expect(uhrGenau(8345, "en")).toBe("1:23.45");
    expect(uhrGenau(5, "de")).toBe("0:00,05");
  });
  it("Tabelle einer Aufgabe: nur ihre Messgrößen, ungemessen als –", () => {
    expect(detailTabelle("verladen", d, "de")).toEqual({
      kopf: ["Platz", "Sterne", "Zeit", "Präzision", "Harte Aufschläge", "Datum"],
      zeilen: [["1.", "★★★", "1:23,45", "38 cm", "–", "21.10.2026"]],
    });
    expect(detailTabelle("verladen", d, "en").kopf).toEqual(["Rank", "Stars", "Time", "Precision", "Hard drops", "Date"]);
    expect(detailTabelle("verladen", d, "en").zeilen[0]![5]).toBe("21/10/2026");
  });
  it("Sandkasten-Rekorde in beiden Sprachen", () => {
    expect(rekordZeilen(d, "de").map((r) => `${r.name}: ${r.wert}`)).toEqual([
      "Sortiert in einer Sitzung: 3,5 t",
      "Sortierquote ab 1 t: 97,3 %",
      "Schnellstes Wrack ausgeweidet: –",
    ]);
    expect(rekordZeilen(d, "en").map((r) => `${r.name}: ${r.wert}`)).toEqual([
      "Sorted in one session: 3.5 t",
      "Sorting accuracy from 1 t: 97.3 %",
      "Fastest wreck stripped: –",
    ]);
  });
  it("eine Sprachwahl: Aufgaben-Texte folgen dem Pausenmenü", () => {
    setzeSprache("en");
    expect(aufgabenSprache()).toBe("en");
    setzeSprache("de");
    expect(aufgabenSprache()).toBe("de");
  });
  it("Rang auf der Tafel", () => {
    expect(rangZeile(1, "de").wert).toBe("★ Neuer Rekord!");
    expect(rangZeile(3, "de").wert).toBe("Platz 3 von 5");
    expect(rangZeile(3, "en").wert).toBe("Rank 3 of 5");
    expect(rangZeile(null, "en")).toEqual({ name: "Leaderboard", wert: "not in the top 5", farbe: undefined });
  });
});

/* ------------------------------------------------------------------------ */
/* Platz — aus dem CSS gerechnet wie test/aufgabenkarte-platz.test.ts        */
/* ------------------------------------------------------------------------ */

/** "0 0 18px" → [0, 0, 18] */
const zahlen = (v: string | null): number[] => (v ?? "").replace("!important", "").trim().split(/\s+/).map((t) => parseFloat(t));
const NORMAL = 1.2;
const hoehe = (f: Fassung): number => f.h - f.sa.t - f.sa.b;
const breite = (f: Fassung): number => f.w - f.sa.l - f.sa.r;

describe("Pausenmenü: ein Knopf mehr, und nichts scrollt", () => {
  const panel = seite.slice(seite.indexOf('<div id="pause">'), seite.indexOf('<div id="pickup">'));
  const knoepfe = [...panel.matchAll(/<button id="(pause-[\w-]+)"/g)].map((m) => m[1]!);
  it("der Knopf steht im Pausenfeld", () => expect(knoepfe).toContain("pause-bestenliste"));

  const P = ["#pause .panel"];
  const B = ["#pause button", "#pause .panel button"];
  const n = knoepfe.filter((k) => !NUR_IM_BETRIEB.includes(k)).length;
  const spaltenVon = (f: Fassung): number => Number(/repeat\((\d+)/.exec(wert(P, "grid-template-columns", f) ?? "")?.[1] ?? 2);
  /** Höhe des Felds bei `spalten` Spalten: Polster, Überschrift, Knopfreihen, Hinweis (5 Zeilen). */
  function pauseHoehe(f: Fassung, spalten: number): { gebraucht: number; platz: number; knopf: number } {
    const reihen = Math.ceil(n / spalten);
    const [lueckeY] = zahlen(wert(P, "gap", f));
    const [padY] = fassungInnen(P, f);
    const knopf = 2 * fassungInnen(B, f)[0] + schriftgroesse(B, f) * NORMAL + 4;
    const h1 = schriftgroesse(["#pause h1"], f) * NORMAL + zahlen(wert(["#pause h1"], "margin", f))[2]!;
    const hintSel = ["#pause .hint"];
    const hint = zahlen(wert(hintSel, "margin", f))[0]! + 5 * schriftgroesse(hintSel, f) * Number(wert(hintSel, "line-height", f));
    const gebraucht = 2 * padY + 4 + h1 + lueckeY! + reihen * knopf + (reihen - 1) * lueckeY! + lueckeY! + hint;
    const vh = Number(/([\d.]+)vh/.exec(wert(P, "max-height", f) ?? "")?.[1]);
    return { gebraucht, platz: Math.min((vh * f.h) / 100, hoehe(f)), knopf };
  }

  for (const f of FASSUNGEN) {
    it(`${f.name}: Sandkasten (alle Knöpfe ohne Betrieb) passt ins Feld`, () => {
      const sp = spaltenVon(f);
      const m = pauseHoehe(f, sp);
      expect(m.gebraucht, `${n} Knöpfe in ${sp} Spalten`).toBeLessThanOrEqual(m.platz);
      expect(m.knopf).toBeGreaterThanOrEqual(f.h <= 430 ? 34 : 44); // Telefon quer: wie bisher (E-170)
      // und quer in der Breite: längster Knopftext (DE oder EN) je Spalte — hochkant bricht er um wie bisher
      if (f.h > f.w) return;
      const texte = [...panel.matchAll(/<button id="pause-[\w-]+">([^<]+)<\/button>/g)].flatMap((m) => [m[1]!.trim(), nachEnglisch(m[1]!).trim()]);
      const laengster = Math.max(...texte.map((t) => t.length));
      const spalteB = laengster * schriftgroesse(B, f) * 0.55 + 2 * fassungInnen(B, f)[1] + 4;
      const lueckeX = zahlen(wert(P, "gap", f))[1]!;
      expect(sp * spalteB + (sp - 1) * lueckeX + 2 * fassungInnen(P, f)[1] + 4).toBeLessThanOrEqual(breite(f));
    });
  }
  it("GEGENPROBE: zweispaltig passte es auf dem iPad quer nicht mehr", () => {
    const m = pauseHoehe(FASSUNGEN[0]!, 2);
    expect(m.gebraucht).toBeGreaterThan(m.platz);
  });
});

describe("Ansicht BESTENLISTE passt ohne Scrollen", () => {
  const S = ["#bestenliste"];
  const KN = ["#bestenliste button"];
  const kopf = (f: Fassung): number => 2 * fassungInnen(["#bestenliste .kopf"], f)[0] + px(KN, "min-height", f);
  const innenB = (f: Fassung): number => breite(f) - 2 * zahlen(wert(["#bl-inhalt"], "padding", f))[1]!;

  for (const f of FASSUNGEN.filter((x) => x.w > x.h)) {
    it(`${f.name}: Übersicht — Karten, Rekorde, Zurück`, () => {
      const fs = schriftgroesse(S, f);
      const lh = 1.35;
      const luecke = zahlen(wert([".bl-karten", "#bestenliste .bl-karten"], "gap", f))[0]!;
      const spalteB = (innenB(f) - 2 * luecke) / 3;
      const [kPadY, kPadX] = fassungInnen(KN, f);
      let karte = 0;
      for (const s of ["de", "en"] as const) {
        CHALLENGES.forEach((c, i) => {
          const t = `${i + 1} · ${c.name[s]}`;
          const z = zeilen(t, spalteB - 2 * kPadX - 4, fs) + zeilen("★★★ 12:34,56", spalteB - 2 * kPadX - 4, fs);
          karte = Math.max(karte, Math.max(44, 2 * kPadY + 4 + z * fs * lh));
        });
      }
      // E-205: auf dem Telefon quer stehen Wert und Datum in einer Zeile (`.bl-rekord b` inline)
      const wertZeilen = wert(["#bestenliste .bl-rekord b"], "display", f) === "inline" ? 1 : 2;
      const rek = Math.max(
        ...(["de", "en"] as const).flatMap((s) =>
          rekordZeilen({ v: 2, aufgaben: {}, sandkasten: {}, schichten: {} }, s).map((r) => (zeilen(r.name, spalteB - 20, fs) + wertZeilen) * fs * lh + 12)
        )
      );
      const h3 = schriftgroesse(["#bestenliste h3"], f) * NORMAL + 18;
      // E-205: Reihe SCHICHTEN — Überschrift als erste Zelle, drei einzeilige Karten
      const schichtSp = (innenB(f) - schichtWort("schichten", "de").length * schriftgroesse(["#bestenliste h3"], f) * 0.55 - 4 - 3 * luecke) / 3;
      for (const s of ["de", "en"] as const) {
        for (const st of SCHICHTSTUFEN) {
          const t = schichtKarte(st, { v: 2, aufgaben: {}, sandkasten: {}, schichten: { [st]: [{ ...schichtLauf(st), verdienstEur: -12345 }] } }, s);
          expect(zeilen(t, schichtSp - 2 * kPadX - 4, fs), t).toBe(1);
        }
      }
      const schichtReihe = px(["#bestenliste .bl-schichten"], "margin-top", f) + Math.max(44, 2 * kPadY + 4 + fs * lh);
      const gebraucht = kopf(f) + 2 * karte + luecke + schichtReihe + h3 + rek + 12;
      if (process.env["MASS"]) console.log(f.name, "Bestenliste", gebraucht, hoehe(f));
      expect(gebraucht, `Karte ${karte.toFixed(0)} px, Rekord ${rek.toFixed(0)} px`).toBeLessThanOrEqual(hoehe(f));
      expect(fs).toBeGreaterThanOrEqual(14);
      expect(px(KN, "min-height", f)).toBeGreaterThanOrEqual(44);
    });

    it(`${f.name}: die besten 5 einer Aufgabe — Höhe und Breite`, () => {
      const fs = schriftgroesse(S, f);
      const [padY, padX] = fassungInnen(["#bestenliste th", "#bestenliste td"], f);
      const voll = {
        v: 2 as const,
    schichten: {},
        aufgaben: Object.fromEntries(
          CHALLENGES.map((c) => [c.id, Array.from({ length: 5 }, () => ({ ...lauf(3, 754.56), werte: { praezisionCm: 120, harteAufschlaege: 10, fehlwuerfe: 10, ueberlasten: 10, fremdteile: 10 } }))])
        ),
        sandkasten: {},
      };
      for (const c of CHALLENGES) {
        for (const s of ["de", "en"] as const) {
          const t = detailTabelle(c.id, voll, s);
          const spaltenB = t.kopf.map((k, i) => Math.max(k.length, ...t.zeilen.map((z) => z[i]!.length)) * fs * 0.55 + 2 * padX);
          expect(spaltenB.reduce((a, b) => a + b, 0), `${c.id} ${s}`).toBeLessThanOrEqual(innenB(f));
          const h = kopf(f) + 6 * (fs * 1.35 + 2 * padY + 1) + 12;
          expect(h).toBeLessThanOrEqual(hoehe(f));
        }
      }
    });
  }
});

describe("Abschlusstafel mit Rang-Zeile und drei Knöpfen passt", () => {
  const meisteKriterien = Math.max(...CHALLENGES.map((c) => Object.keys({ ...c.wertung.zwei, ...c.wertung.drei }).length));
  for (const f of FASSUNGEN) {
    it(`${f.name}: ${meisteKriterien} Messzeilen + Rang + NOCHMAL/NÄCHSTE/MENÜ`, () => {
      const m = abrechnungsMass(f);
      const ohneZeilen = m.gebraucht - m.bloecke.find((b) => b.name.includes("Zahlenzeilen"))!.hoehe;
      const gebraucht = ohneZeilen + (meisteKriterien + 1) * m.zeilenHoehe + 2 * (m.knopfHoehe + 7);
      expect(gebraucht).toBeLessThanOrEqual(m.platz);
    });
  }
});

/* ------------------------------------------------------------------------ */
/* SCHICHTEN (E-205): Schema 2, Migration, Sortierung, Gegenproben           */
/* ------------------------------------------------------------------------ */

/** Ein beendeter Schichtlauf — die Form, die `schichtLauf` (economy/kasse.ts) baut. */
function schichtLauf(stufe: Schichtstufe, verdienstEur = 5000, sterne: 0 | 1 | 2 | 3 = 2, datum = "2026-10-21"): SchichtLauf {
  return { stufe, verdienstEur, tonnen: 24.5, quoteBp: 8800, warteS: 95, sterne, datum };
}

describe("SCHICHTEN: Rangfolge nach Tagesverdienst", () => {
  it("höher vor tiefer, höchstens 5, Gleichstand: der ältere bleibt vorn", () => {
    let l: SchichtLauf[] = [];
    for (const e of [3000, 7000, 5000, -200, 9000]) l = eintragenSchicht(l, schichtLauf("montag", e)).liste;
    expect(l.map((x) => x.verdienstEur)).toEqual([9000, 7000, 5000, 3000, -200]);
    expect(eintragenSchicht(l, schichtLauf("montag", -300)).platz).toBeNull();
    const gleich = eintragenSchicht(l, schichtLauf("montag", 5000, 3, "2026-10-22"));
    expect(gleich.platz).toBe(4);
    expect(gleich.liste[2]!.datum).toBe("2026-10-21");
    expect(gleich.liste).toHaveLength(5);
  });
  it("aus der Bilanz: ganze Euro, Tonnen eine Stelle, Quote in Basispunkten, Tag in Ortszeit", () => {
    const l = ausBilanz(
      {
        stufe: "mittwoch", tonnenUmgeschlagen: 31.27, sortierquote: 0.91234, warteS: 74.6, erloesEur: 9000,
        standgeldEur: 14.6, fehlwurfEur: 50, schadenEur: 0, lagerwertEur: 600, verdienstEur: 9535.4, sterne: 3,
      },
      new Date(2026, 9, 21, 23, 30)
    );
    expect(l).toEqual({ stufe: "mittwoch", verdienstEur: 9535, tonnen: 31.3, quoteBp: 9123, warteS: 75, sterne: 3, datum: "2026-10-21" });
  });
});

describe("SCHICHTEN: Speicher", () => {
  it("Lauf wird gespeichert, sein Platz kommt zurück; geschrieben wird Schema 2", () => {
    const m = speicher();
    expect(merkeSchicht(schichtLauf("montag", 4000))).toBe(1);
    expect(merkeSchicht(schichtLauf("montag", 6000))).toBe(1);
    expect(merkeSchicht(schichtLauf("montag", 5000))).toBe(2);
    expect(merkeSchicht(schichtLauf("freitag", 100, 1))).toBe(1);
    const d = leseBestenliste();
    expect(d.schichten.montag!.map((l) => l.verdienstEur)).toEqual([6000, 5000, 4000]);
    expect(JSON.parse(m.get(BESTENLISTE_KEY)!).v).toBe(2);
    expect(besteSchichtSterne(d)).toEqual({ montag: 2, freitag: 1 });
  });
  it("eine abgebrochene Schicht (0 Sterne) kommt nicht hinein", () => {
    speicher();
    expect(merkeSchicht(schichtLauf("montag", 99999, 0))).toBeNull();
    expect(leseBestenliste().schichten).toEqual({});
  });
  it("MIGRATION: ein Stand aus Schema 1 behält Aufgaben und Rekorde, SCHICHTEN beginnt leer", () => {
    const m = speicher();
    const alt = { v: 1, aufgaben: { sortieren: [lauf(2, 80)] }, sandkasten: { sortiertKg: { wert: 900, datum: "2026-10-20T10:00:00.000Z" } } };
    m.set(BESTENLISTE_KEY, JSON.stringify(alt));
    expect(leseBestenliste()).toEqual({ ...alt, v: 2, schichten: {} });
    // der nächste Lauf schreibt Schema 2 — die Aufgaben sind noch da
    merkeSchicht(schichtLauf("montag"));
    const neu = JSON.parse(m.get(BESTENLISTE_KEY)!);
    expect(neu.v).toBe(2);
    expect(neu.aufgaben.sortieren).toHaveLength(1);
    expect(neu.schichten.montag).toHaveLength(1);
  });
  it("Schema 1 mit einem (fremden) Feld schichten: wird nicht übernommen", () => {
    const d = pruefeAblage({ v: 1, aufgaben: {}, sandkasten: {}, schichten: { montag: [schichtLauf("montag")] } });
    expect(d.schichten).toEqual({});
  });
  it("GEGENPROBEN: kaputte Schichtläufe fallen heraus, gute bleiben und werden sortiert", () => {
    const gut = schichtLauf("mittwoch", 7000);
    const besser = schichtLauf("mittwoch", 8000);
    const d = pruefeAblage({
      v: 2,
      aufgaben: {},
      sandkasten: {},
      schichten: {
        mittwoch: [
          gut,
          { ...gut, verdienstEur: 1.5 }, // keine ganze Zahl
          { ...gut, stufe: "freitag" }, // falsche Stufe im Fach
          { ...gut, quoteBp: 10001 },
          { ...gut, sterne: 0 },
          { ...gut, sterne: 4 },
          { ...gut, warteS: -1 },
          { ...gut, tonnen: Number.NaN },
          { ...gut, datum: "21.10.2026" },
          null,
          "x",
          besser,
        ],
        montag: "keine Liste",
        sonntag: [schichtLauf("montag")],
      },
    });
    expect(d.schichten).toEqual({ mittwoch: [besser, gut] });
  });
  it("GEGENPROBE: mehr als 5 im Speicher — es bleiben die besten 5", () => {
    const viele = [1, 6, 2, 5, 3, 4, 7].map((k) => schichtLauf("freitag", k * 1000));
    const d = pruefeAblage({ v: 2, aufgaben: {}, sandkasten: {}, schichten: { freitag: viele } });
    expect(d.schichten.freitag!.map((l) => l.verdienstEur)).toEqual([7000, 6000, 5000, 4000, 3000]);
  });
  it("Speicher wirft: Platz kommt trotzdem, Lesen bleibt leer", () => {
    speicher(true);
    expect(merkeSchicht(schichtLauf("montag"))).toBe(1);
    expect(leseBestenliste().schichten).toEqual({});
  });
});

describe("SCHICHTEN: Ansicht", () => {
  const d = { v: 2 as const, aufgaben: {}, sandkasten: {}, schichten: { montag: [schichtLauf("montag", 12345, 3), schichtLauf("montag", -250, 1, "2026-10-02")] } };
  it("Übersicht: eine Zeile je Stufe, „–\" ohne Lauf", () => {
    expect(schichtKarte("montag", d, "de")).toBe("MONTAG 12.345 €");
    expect(schichtKarte("montag", d, "en")).toBe("MONDAY 12,345 €");
    expect(schichtKarte("freitag", d, "de")).toBe("FREITAG –");
  });
  it("die besten 5 einer Stufe: Verdienst, Tonnen, Quote, Wartezeit, Datum", () => {
    expect(schichtTabelle("montag", d, "de")).toEqual({
      kopf: ["Platz", "Sterne", "Verdienst", "Tonnen", "Quote", "Wartezeit", "Datum"],
      zeilen: [
        ["1.", "★★★", "12.345 €", "24,5 t", "88 %", "1:35", "21.10.2026"],
        ["2.", "★☆☆", "−250 €", "24,5 t", "88 %", "1:35", "02.10.2026"],
      ],
    });
    expect(schichtTabelle("montag", d, "en").kopf).toEqual(["Rank", "Stars", "Earnings", "Tonnes", "Accuracy", "Waiting", "Date"]);
    expect(schichtTabelle("montag", d, "en").zeilen[0]!.slice(2, 4)).toEqual(["12,345 €", "24.5 t"]);
  });
  it("Kalendertag ohne Zeitzonen-Verschiebung; Unsinn wird „–\"", () => {
    expect(tagText("2026-01-01", "de")).toBe("01.01.2026");
    expect(tagText("2026-01-01", "en")).toBe("01/01/2026");
    expect(tagText("gestern", "de")).toBe("–");
  });

  for (const f of FASSUNGEN.filter((x) => x.w > x.h)) {
    it(`${f.name}: die besten 5 einer Stufe passen — Höhe und Breite`, () => {
      const fs = schriftgroesse(["#bestenliste"], f);
      const [padY, padX] = fassungInnen(["#bestenliste th", "#bestenliste td"], f);
      const breit = schichtLauf("mittwoch", -12345, 3);
      const voll = { v: 2 as const, aufgaben: {}, sandkasten: {}, schichten: { mittwoch: Array.from({ length: 5 }, () => ({ ...breit, tonnen: 123.4, quoteBp: 10000, warteS: 3599 })) } };
      for (const s of ["de", "en"] as const) {
        const t = schichtTabelle("mittwoch", voll, s);
        const spaltenB = t.kopf.map((k, i) => Math.max(k.length, ...t.zeilen.map((z) => z[i]!.length)) * fs * 0.55 + 2 * padX);
        const innen = f.w - f.sa.l - f.sa.r - 2 * zahlen(wert(["#bl-inhalt"], "padding", f))[1]!;
        expect(spaltenB.reduce((a, b) => a + b, 0), s).toBeLessThanOrEqual(innen);
        const kopf = 2 * fassungInnen(["#bestenliste .kopf"], f)[0] + px(["#bestenliste button"], "min-height", f);
        expect(kopf + 6 * (fs * 1.35 + 2 * padY + 1) + 12).toBeLessThanOrEqual(f.h - f.sa.t - f.sa.b);
      }
    });
  }
});
