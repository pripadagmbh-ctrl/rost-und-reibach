/**
 * DER SCHICHT-PLATZ „Kreis in der Ecke" (E-201).
 *
 * Ein Schalter (`world/schichtplatz.ts`) stellt den Platz für die Schicht um:
 * kein Müll-Container vor dem Bagger, dafür hält dort quer der Verlader; die
 * rechte Halde ist die MÜLL-Halde. Ohne Schalter muss alles bitgleich bleiben.
 *
 * Geprüft wie im Werkzeug `tools/schicht-platz.ts` (Variante A), aber gegen
 * die gebauten Exporte statt gegen abgeschriebene Lagen.
 */
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CONFIGS, gehoertHierhin } from "../src/world/containers";
import { aktiviereSchichtPlatz, istSchichtPlatz, setzeSchichtPlatzZurueck } from "../src/world/schichtplatz";
import {
  BED_LEN,
  BLOCK_RADIUS,
  PARK_SLOTS,
  VERLADER_VORN,
  verladerHindernisse,
  abholPlatzFuer,
  abholPlaetzeEinmal,
  absetzAusfahrt,
  annahmeBelegung,
  anfahrtVomPlatz,
  bayApproach,
  bayInRev,
  bayOut,
  fahrHindernisse,
  parkAusfahrt,
  planHindernisse,
  rangierAbladeplatz,
  rangierAbsetzplatz,
  rangierVerladerVorn,
  routeOut,
  verladerVornAusfahrt,
  standflaeche,
} from "../src/delivery/routes";
import { lagerSperrt } from "../src/delivery/schichtfuhrpark";
import {
  boxUeberlappung,
  fahrzeugUmriss,
  tiefsteDurchdringung,
  umrissEcken,
  umrisseEntlang,
  UMRISS_TOLERANZ,
  type Rechteck,
} from "../src/delivery/umriss";
import { BAGGER_STAND, SCHWENK_AUSSEN, SCHWENK_INNEN } from "../src/world/baggerstand";

type P = [number, number];
const S = BAGGER_STAND;
const ABHOLER = BED_LEN.abholer!;
const KIPPER = BED_LEN.kipper!;

// Sandkasten-Stand vor jedem Umschalten, als Text — „bitgleich" heißt gleich bis aufs Komma
const configsVorher = JSON.stringify(CONFIGS);
const hindernisseVorher = JSON.stringify(fahrHindernisse());
const abladeVorher = JSON.stringify(rangierAbladeplatz());

afterEach(() => setzeSchichtPlatzZurueck());

/** Wagenumriss des stehenden Verladers. */
const verladerBox = () => fahrzeugUmriss({ x: VERLADER_VORN.x, z: VERLADER_VORN.z, rot: VERLADER_VORN.gier }, ABHOLER);

/** Wie tief der Wagenumriss entlang einer Strecke höchstens in einem Hindernis steckt (m). */
const tiefe = (w: P[], rueck: boolean, h: Rechteck[], bed = ABHOLER): number =>
  tiefsteDurchdringung(umrisseEntlang(w, bed, rueck), h);

/** Kleinster Abstand eines Punktes zu einer Polylinie. */
const abstandZuStrecke = (x: number, z: number, rt: P[]): number => {
  let b = Infinity;
  for (let i = 0; i < rt.length - 1; i++) {
    const [ax, az] = rt[i]!;
    const [bx, bz] = rt[i + 1]!;
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1e-9)));
    b = Math.min(b, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return b;
};

/** Wie tief streift eine Fahrt den stehenden Verlader (m, Kipper-Umriss — der längste)? */
const streift = (w: P[], rueck: boolean, bed = KIPPER): number =>
  w.length < 2 ? 0 : Math.max(...umrisseEntlang(w, bed, rueck).map((u) => boxUeberlappung(u, verladerBox())));

describe("Schicht-Platz: ohne Schalter bleibt der Sandkasten", () => {
  it("CONFIGS, Fahrhindernisse und Abladeplatz-Zug sind unverändert (Gegenprobe)", () => {
    expect(istSchichtPlatz()).toBe(false);
    aktiviereSchichtPlatz();
    rangierAbladeplatz();
    setzeSchichtPlatzZurueck();
    expect(JSON.stringify(CONFIGS)).toBe(configsVorher);
    expect(JSON.stringify(fahrHindernisse())).toBe(hindernisseVorher);
    expect(JSON.stringify(rangierAbladeplatz())).toBe(abladeVorher);
    expect(fahrHindernisse().some((o) => o.label.startsWith("MUELL"))).toBe(true);
    expect(abholPlatzFuer(null).name).toBe("Abladeplatz beim Bagger");
  });
});

describe("Schicht-Platz: Verlader vorn", () => {
  it("alle vier Ecken der Ladefläche liegen im Schwenkband 5,8 … 9,2 m", () => {
    aktiviereSchichtPlatz();
    const ecken = umrissEcken({ x: VERLADER_VORN.x, z: VERLADER_VORN.z, hw: 1.27, hd: ABHOLER / 2, rot: VERLADER_VORN.gier });
    for (const [x, z] of ecken) {
      const d = Math.hypot(x - S.x, z - S.z);
      expect(d, `Ecke (${x.toFixed(2)} | ${z.toFixed(2)})`).toBeGreaterThanOrEqual(SCHWENK_INNEN);
      expect(d).toBeLessThanOrEqual(SCHWENK_AUSSEN);
    }
  });

  it("hält außerhalb des Tastbereichs (≥ 5,5 m vom Sitz), auch mit dem ganzen Wagen", () => {
    aktiviereSchichtPlatz();
    const b = verladerBox();
    // Sitz in Wagenkoordinaten, dann Abstand zum Rechteck
    const dx = S.x - b.x;
    const dz = S.z - b.z;
    const c = Math.cos(b.rot);
    const s = Math.sin(b.rot);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    const d = Math.hypot(Math.max(0, Math.abs(lx) - b.hw), Math.max(0, Math.abs(lz) - b.hd));
    expect(d).toBeGreaterThanOrEqual(BLOCK_RADIUS);
  });

  it("der Müll-Container ist weg; sein Platz bleibt für alle außer dem Verlader gesperrt", () => {
    aktiviereSchichtPlatz();
    expect(CONFIGS.some((c) => c.id === "r_rubble")).toBe(false);
    // Fahrhindernisse bitgleich: alle anderen Strecken bleiben, wie sie geprüft sind
    expect(JSON.stringify(fahrHindernisse())).toBe(hindernisseVorher);
    expect(verladerHindernisse().some((o) => String((o as { label?: string }).label ?? "").startsWith("MUELL"))).toBe(false);
  });

  it("die Annahme fährt im Schicht-Platz bitgleich wie im Sandkasten (E-140)", () => {
    aktiviereSchichtPlatz();
    expect(JSON.stringify(rangierAbladeplatz())).toBe(abladeVorher);
  });

  it("rangierVerladerVorn ist frei gegen planHindernisse (Tiefe 0), auch mit Kipper und Haufen an der Annahme", () => {
    aktiviereSchichtPlatz();
    const z = rangierVerladerVorn();
    expect(z).toBe(rangierVerladerVorn()); // gemerkt
    // planHindernisse ohne den Müllplatz (dort steht er), dazu Kipper und Haufen an der Annahme
    const h = [...planHindernisse().filter((o) => !String((o as { label?: string }).label ?? "").startsWith("MUELL")), ...annahmeBelegung()];
    expect(h).toEqual(verladerHindernisse());
    expect(tiefe(z.anfahrt, false, h), "Anfahrt").toBeLessThanOrEqual(UMRISS_TOLERANZ);
    expect(tiefe(z.rueckweg, true, h), "Rückweg").toBeLessThanOrEqual(UMRISS_TOLERANZ);
    const halt = z.rueckweg[z.rueckweg.length - 1]!;
    expect(Math.hypot(halt[0] - VERLADER_VORN.x, halt[1] - VERLADER_VORN.z)).toBeLessThan(0.01);
    // Keine seiner Strecken kommt dem Sitz näher als der Tastbereich
    for (const w of [z.anfahrt, z.rueckweg, verladerVornAusfahrt()]) {
      expect(abstandZuStrecke(S.x, S.z, w)).toBeGreaterThanOrEqual(BLOCK_RADIUS);
    }
  });

  it("seine Ausfahrt streift weder Bauwerke noch den Anlieferer an der Annahme", () => {
    aktiviereSchichtPlatz();
    const aus = verladerVornAusfahrt();
    const bau = fahrHindernisse().filter((o) => o.label !== "Baggerstand" && !o.label.startsWith("MUELL"));
    expect(tiefe(aus, false, bau)).toBeLessThanOrEqual(UMRISS_TOLERANZ);
    const um = umrisseEntlang(aus, ABHOLER, false);
    for (const a of annahmeBelegung()) {
      expect(Math.max(...um.map((u) => boxUeberlappung(u, { ...a, rot: 0 })))).toBeLessThanOrEqual(0.01);
    }
  });

  it("keine andere Fahrt streift den stehenden Verlader (Silos, Abholer, Absetzkipper, Warteplätze, Annahme)", () => {
    aktiviereSchichtPlatz();
    const fahrten: Array<[string, P[], boolean]> = [];
    for (const c of CONFIGS.filter((k) => k.lager === true)) {
      fahrten.push([`Kipper ${c.label} hin`, bayApproach(c), false], [`Kipper ${c.label} zurück`, bayInRev(c), true], [`Kipper ${c.label} raus`, bayOut(c), false]);
    }
    for (const p of abholPlaetzeEinmal()) {
      if (!p.ziel) continue; // der Verlader selbst
      fahrten.push([`${p.name} hin`, p.anfahrt, false], [`${p.name} zurück`, p.rueckweg, true], [`${p.name} raus`, p.ausfahrt, false]);
    }
    const abs = rangierAbsetzplatz();
    fahrten.push(["Absetzkipper hin", abs.anfahrt, false], ["Absetzkipper zurück", abs.rueckweg, true], ["Absetzkipper raus", absetzAusfahrt(), false]);
    for (const sl of PARK_SLOTS) {
      fahrten.push([`Warteplatz ${sl.join("|")} zur Annahme`, anfahrtVomPlatz(sl, null).anfahrt, false], [`Warteplatz ${sl.join("|")} raus`, parkAusfahrt(sl), false]);
    }
    const ann = rangierAbladeplatz();
    fahrten.push(["Annahme hin", ann.anfahrt, false], ["Annahme zurück", ann.rueckweg, true], ["Annahme raus", routeOut(), false]);
    expect(fahrten.length).toBe(48); // 45 wie im Werkzeug, dazu die Annahme
    const treffer = fahrten.filter(([, w, r]) => streift(w, r) > 0.01).map(([n, w, r]) => `${n} (${streift(w, r).toFixed(2)} m)`);
    expect(treffer).toEqual([]);
  });

  it("Abholung ohne Silo (gemischt, Stahl, Misch) hält vorn, nicht an der Annahme", () => {
    aktiviereSchichtPlatz();
    for (const o of [null, "steel", "mixed"]) {
      const p = abholPlatzFuer(o);
      expect(p.name).toBe("Verladeplatz vorn");
      expect(p.halt).toEqual([VERLADER_VORN.x, VERLADER_VORN.z]);
      expect(p.stand).toEqual({ x: S.x, z: S.z });
    }
    expect(abholPlaetzeEinmal().filter((p) => p.name === "Abladeplatz beim Bagger")).toEqual([]);
  });

  it("S5-1: seine Ausfahrt geht an jeder Pritsche am Lager vorbei (vorher 0,72 m in der am KUPFER-LAGER)", () => {
    aktiviereSchichtPlatz();
    const um = umrisseEntlang(verladerVornAusfahrt(), ABHOLER, false);
    for (const c of CONFIGS.filter((k) => k.lager === true)) {
      const steht = { ...standflaeche(abholPlatzFuer(c.fractionId), 0.2), rot: 0 };
      expect(Math.max(...um.map((u) => boxUeberlappung(u, steht))), c.label).toBeLessThanOrEqual(0.01);
    }
  });

  it("S5-1: nur eine Pritsche am ALU-LAGER sperrt den Weg nach vorn und den Absetzkipper (dann wartet, wer zuletzt käme)", () => {
    aktiviereSchichtPlatz();
    const sperrt = CONFIGS.filter((k) => k.lager === true)
      .filter((c) => lagerSperrt(abholPlatzFuer(c.fractionId), "nachVorn") || lagerSperrt(abholPlatzFuer(c.fractionId), "absetzer"))
      .map((c) => c.label);
    expect(sperrt).toEqual(["ALU-LAGER"]);
  });
});

describe("Schicht-Platz: die rechte Halde ist der MÜLL", () => {
  it("c_mixed nimmt Bauschutt, Reifen, Holz, Kunststoff — Mischschrott nicht", () => {
    aktiviereSchichtPlatz();
    const h = CONFIGS.find((c) => c.id === "c_mixed")!;
    for (const f of ["rubble", "tires", "wood", "plastic"]) expect(gehoertHierhin(h, f), f).toBe(true);
    expect(gehoertHierhin(h, "mixed")).toBe(false);
    expect(h.label).toBe("MÜLL"); // Schild wie die Bemalung des Containers, EN „WASTE" (ui/texte_en.ts)
  });
});

/*
 * DER LEERE STARTPLATZ hängt an `main.ts` (Starthaufen, Autos, LKW-Wrack,
 * Streuschrott, Ansteher, Müll-Abroller). Dieser Wächter schärft sich selbst,
 * sobald `main.ts` den Schalter kennt — vorher gibt es nichts zu bewachen.
 */
const main = readFileSync(resolve(__dirname, "../src/main.ts"), "utf8");
describe("Schicht-Platz: Startplatz leer (Verdrahtung in main.ts)", () => {
  // main.ts liest die Stufe aus der Wahl (`schichtStufe`) und schaltet damit den Platz um
  it("Starthaufen, Ansteher und Müll-Abroller hängen am Schalter", () => {
    expect(main).toMatch(/if \(schichtStufe\) aktiviereSchichtPlatz\(\)/);
    expect(main).toMatch(/\} else if \(schichtStufe\) \{/);
    expect(main).toMatch(/!schichtStufe\) vehicles\.stelleAnstehendeAuf/);
    expect(main).toMatch(/!schichtStufe\) \{\s*\n[^\n]*\n?\s*containers\.raeumeMuell/);
  });
});
