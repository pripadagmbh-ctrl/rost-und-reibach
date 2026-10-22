/**
 * SORTENFARBEN UND BILDSCHILDER (Auftrag 41, Paket P1).
 *
 * Patrick, 22.10.2026: „Farbe und Bildschild an jeder Mulde, im ganzen Spiel;
 * das Ziel-Teil leuchtet in derselben Farbe." Dieser Wächter hält fest:
 *
 *   1. Jeder Behälter hat eine Sorte — im Sandkasten und im Schicht-Platz.
 *   2. Jede Sorte hat Farbe, Namen DE/EN und ein eigenes, gültiges Bild.
 *   3. Die Farben sind auch mit Farbsehschwäche zu trennen (mit Gegenprobe).
 *   4. Das Bild hebt sich von seiner Schildfarbe ab (Kontrast).
 *   5. `sorteVonMaterial` zeigt auf eine Mulde, in der das Teil richtig liegt.
 *   6. Das Schild zeichnet das Bild, und die Ampel trägt ein Zeichen.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  AMPEL_ZEICHEN,
  SORTEN,
  SORTEN_IDS,
  bildFarbe,
  sorteVonBehaelter,
  sorteVonKonfig,
  sorteVonMaterial,
  type SorteId,
} from "../src/materials/sorten";
import {
  AMPEL_FARBE,
  CONFIGS,
  ContainerManager,
  ZEICHEN_GRUND,
  ZEICHEN_STRICH,
  gehoertHierhin,
} from "../src/world/containers";
import { ABFALLFRAKTIONEN, MATERIALS } from "../src/materials/catalog";
import { aktiviereSchichtPlatz, setzeSchichtPlatzZurueck } from "../src/world/schichtplatz";
import { EventBus } from "../src/core/events";
import { deltaEHex, deltaEHexBei, kontrast, type Sehschwaeche } from "../tools/farbabstand";

/*
 * SCHWELLEN.
 *
 * SW: ΔE2000 ≥ 20 zwischen zwei Farbgruppen bei normalem Farbsehen. Ab ΔE 10
 * gelten zwei Farben als „verschieden" (Kopf von `tools/farbabstand.ts`); das
 * Schild steht aber 10 bis 20 m weit im Halbschatten und ist ein paar Dutzend
 * Pixel gross — darum das Doppelte.
 * SW: ΔE2000 ≥ 10 in jeder der drei Simulationen (Machado et al. 2009,
 * Schweregrad 1,0): Dort reicht „verschieden", denn das Bild trägt die
 * Bedeutung mit — Farbe ist nicht der einzige Kanal.
 * Kontrast 4,5 : 1 = WCAG 2.1 Stufe AA für Text; das Bild ist ein Zeichen in
 * Strichstärke einer Schrift, also gilt dieselbe Stufe.
 */
const DE_NORMAL = 20;
const DE_SCHWAECHE = 10;
const KONTRAST_MIN = 4.5;
const SCHWAECHEN: readonly Sehschwaeche[] = ["deutan", "protan", "tritan"];

/** Alle Paare verschiedener Farben, die eine Schwelle reissen. Leer = gut. */
function abstandsFehler(farben: readonly number[]): string[] {
  const einzeln = [...new Set(farben)];
  const fehler: string[] = [];
  for (let i = 0; i < einzeln.length; i++) {
    for (let j = i + 1; j < einzeln.length; j++) {
      const a = einzeln[i]!;
      const b = einzeln[j]!;
      const name = `${a.toString(16)}/${b.toString(16)}`;
      const n = deltaEHex(a, b);
      if (n < DE_NORMAL) fehler.push(`${name} normal ΔE ${n.toFixed(1)}`);
      for (const s of SCHWAECHEN) {
        const d = deltaEHexBei(a, b, s);
        if (d < DE_SCHWAECHE) fehler.push(`${name} ${s} ΔE ${d.toFixed(1)}`);
      }
    }
  }
  return fehler;
}

/*
 * SVG-PFADE PRÜFEN — ein kleiner Leser für die Pfadsprache (SVG 1.1, Kap. 8.3).
 * Er kennt alle Befehle, prüft die Zahl der Werte je Befehl und verfolgt den
 * Stift, damit jeder Endpunkt im 24er-Raster liegt.
 */
const WERTE: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
function pruefePfad(d: string): string | null {
  const zeichen = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?|[\s,]+|./g) ?? [];
  const toks = zeichen.filter((z) => !/^[\s,]+$/.test(z));
  if (toks.some((z) => !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(z) && Number.isNaN(Number(z)))) return `fremdes Zeichen in „${d}"`;
  if (!/^[Mm]$/.test(toks[0] ?? "")) return `beginnt nicht mit M: „${d}"`;
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let i = 0;
  while (i < toks.length) {
    const cmd = toks[i++]!;
    const n = WERTE[cmd.toLowerCase()]!;
    const rel = cmd === cmd.toLowerCase();
    if (n === 0) {
      x = sx;
      y = sy;
      continue;
    }
    let erste = true;
    do {
      const w: number[] = [];
      for (let k = 0; k < n; k++) {
        const t = toks[i++];
        if (t === undefined || Number.isNaN(Number(t))) return `zu wenige Werte nach ${cmd} in „${d}"`;
        w.push(Number(t));
      }
      const c = cmd.toLowerCase();
      if (c === "a" && (![0, 1].includes(w[3]!) || ![0, 1].includes(w[4]!))) return `Bogen-Merker nicht 0/1 in „${d}"`;
      if (c === "h") x = rel ? x + w[0]! : w[0]!;
      else if (c === "v") y = rel ? y + w[0]! : w[0]!;
      else {
        const ex = w[n - 2]!;
        const ey = w[n - 1]!;
        x = rel ? x + ex : ex;
        y = rel ? y + ey : ey;
      }
      if (c === "m" && erste) {
        sx = x;
        sy = y;
      }
      erste = false;
      if (x < 0 || x > 24 || y < 0 || y > 24) return `Punkt (${x}|${y}) ausserhalb des 24er-Rasters in „${d}"`;
    } while (i < toks.length && !Number.isNaN(Number(toks[i])));
  }
  return null;
}

describe("Sorten — jeder Behälter hat eine", () => {
  afterEach(() => setzeSchichtPlatzZurueck());

  /*
   * Ausnahmen: keine. Gebaute Hüllen ohne Fraktion (`nurHuelle`, E-010/E-011)
   * hätten keine Sorte — es gibt zurzeit keine. Steht eine in CONFIGS, ist sie
   * hier ausgenommen, und der Test sagt es.
   */
  const AUSNAHMEN = CONFIGS.filter((c) => c.nurHuelle).map((c) => c.id);

  it("Sandkasten: jede Mulde, Halde, jedes Silo", () => {
    expect(AUSNAHMEN).toEqual([]);
    const tabelle = Object.fromEntries(CONFIGS.map((c) => [c.id, sorteVonBehaelter(c.id)]));
    expect(tabelle).toEqual({
      c_mixed: "misch",
      c_steel: "stahl",
      r_bunt: "bunt",
      r_rubble: "muell",
      c_copper_lager: "kupfer",
      c_cable_lager: "kabel",
      c_alu_lager: "alu",
      c_va_lager: "va",
      c_battery: "batterie",
      c_rubble: "muell",
    });
  });

  it("Schicht-Platz: die rechte Halde wird MÜLL und trägt das Müll-Schild (E-201)", () => {
    aktiviereSchichtPlatz();
    expect(sorteVonBehaelter("c_mixed")).toBe("muell");
    for (const c of CONFIGS) expect(sorteVonBehaelter(c.id), c.id).not.toBeNull();
    setzeSchichtPlatzZurueck();
    expect(sorteVonBehaelter("c_mixed")).toBe("misch");
  });

  it("Presse, Ablagekreis und Unbekanntes haben keine Sorte; eine leere Hülle auch nicht", () => {
    for (const id of ["presse", "kreis", "ablagekreis", "", "gibtsnicht"]) expect(sorteVonBehaelter(id)).toBeNull();
    expect(sorteVonKonfig({ fractionId: "copper", nurHuelle: true })).toBeNull();
  });
});

describe("Sorten — Tabelle", () => {
  it("jede Sorte hat Farbe, Namen DE/EN und ein nicht leeres Bild", () => {
    expect(SORTEN_IDS.length).toBeGreaterThanOrEqual(4);
    for (const id of SORTEN_IDS) {
      const s = SORTEN[id];
      expect(s.id).toBe(id);
      expect(Number.isInteger(s.farbe) && s.farbe >= 0 && s.farbe <= 0xffffff, id).toBe(true);
      expect(s.name.de.trim().length, id).toBeGreaterThan(0);
      expect(s.name.en.trim().length, id).toBeGreaterThan(0);
      expect(/[äöüÄÖÜß]/.test(s.name.en), `${id}: Umlaut im Englischen`).toBe(false);
      expect(s.bild.length, id).toBeGreaterThan(0);
      for (const d of s.bild) expect(d.trim().length, id).toBeGreaterThan(0);
    }
  });

  it("die vier Kern-Ids bleiben (andere Pakete benutzen sie)", () => {
    for (const id of ["stahl", "bunt", "misch", "muell"] as const) expect(SORTEN[id]).toBeDefined();
  });

  it("keine zwei Sorten mit gleichem Bild — auch nicht die Silos derselben Farbe", () => {
    const bilder = SORTEN_IDS.map((id) => SORTEN[id].bild.map((d) => d.replace(/\s+/g, " ").trim()).join("|"));
    expect(new Set(bilder).size).toBe(bilder.length);
  });

  it("jeder Pfad ist gültige SVG-Pfadsprache im 24er-Raster", () => {
    for (const id of SORTEN_IDS) for (const d of SORTEN[id].bild) expect(pruefePfad(d), `${id}: ${d}`).toBeNull();
    for (const [k, pfade] of Object.entries(AMPEL_ZEICHEN)) for (const d of pfade) expect(pruefePfad(d), k).toBeNull();
  });

  it("Gegenprobe des Pfadlesers: kaputte Pfade fallen durch", () => {
    expect(pruefePfad("L4 4")).not.toBeNull(); // kein M am Anfang
    expect(pruefePfad("M4 4L5")).not.toBeNull(); // Wert fehlt
    expect(pruefePfad("M4 4a2 2 0 2 1 4 4")).not.toBeNull(); // Merker 2
    expect(pruefePfad("M4 4h30")).not.toBeNull(); // aus dem Raster
    expect(pruefePfad("M4 4 X5")).not.toBeNull(); // fremder Befehl
  });
});

describe("Sorten — Farben farbenblind-tauglich", () => {
  it("Silos teilen die Farbe ihrer Gruppe: Kupfer, Kabel, Alu, VA = Bunt", () => {
    for (const id of ["kupfer", "kabel", "alu", "va"] as const) expect(SORTEN[id].farbe).toBe(SORTEN.bunt.farbe);
  });

  it(`zwei Farbgruppen: ΔE ≥ ${DE_NORMAL} normal und ≥ ${DE_SCHWAECHE} bei Deuteranopie, Protanopie, Tritanopie`, () => {
    const farben = SORTEN_IDS.map((id) => SORTEN[id].farbe);
    expect(new Set(farben).size, "fünf Farbgruppen").toBe(5);
    expect(abstandsFehler(farben)).toEqual([]);
  });

  it("Gegenprobe: ähnliche Farben fallen durch, Rot/Grün fällt nur in der Simulation durch", () => {
    // Zweimal Himmelblau, kaum verschieden: ΔE 3,6
    expect(abstandsFehler([0x56b4e9, 0x4fa8e0]).some((f) => f.includes("normal"))).toBe(true);
    // Rot gegen Grün: normal ΔE 71,8, deuteranop 4,8 — genau der Fall, den die Simulation fangen muss
    const rg = abstandsFehler([0xd62728, 0x2ca02c]);
    expect(rg.some((f) => f.includes("normal"))).toBe(false);
    expect(rg.some((f) => f.includes("deutan"))).toBe(true);
  });

  it(`Bild schwarz oder weiss, Kontrast ≥ ${KONTRAST_MIN} : 1 zur Schildfarbe`, () => {
    for (const id of SORTEN_IDS) {
      const strich = bildFarbe(id);
      expect([0x000000, 0xffffff]).toContain(strich);
      expect(kontrast(strich, SORTEN[id].farbe), id).toBeGreaterThanOrEqual(KONTRAST_MIN);
    }
    // Gegenprobe: Weiss auf Gelb wäre 1,3 : 1
    expect(kontrast(0xffffff, SORTEN.batterie.farbe)).toBeLessThan(KONTRAST_MIN);
  });

  it(`Ampelzeichen ✓ / ! / ✕: Strich gegen Scheibe ≥ ${KONTRAST_MIN} : 1`, () => {
    const hex = (css: string): number => parseInt(css.slice(1), 16);
    expect(kontrast(hex(ZEICHEN_STRICH), hex(ZEICHEN_GRUND))).toBeGreaterThanOrEqual(KONTRAST_MIN);
    expect(Object.keys(AMPEL_FARBE).sort()).toEqual(Object.keys(AMPEL_ZEICHEN).sort());
  });

  it("die Müll-Farbe liegt nah am Enzianblau des Müll-Lacks (E-138), näher als jede andere Sorte", () => {
    const lack = CONFIGS.find((c) => c.id === "r_rubble")!.bemalung!.lack;
    const abstand = (id: SorteId): number => deltaEHex(SORTEN[id].farbe, lack);
    for (const id of SORTEN_IDS) if (id !== "muell") expect(abstand("muell")).toBeLessThan(abstand(id));
  });
});

describe("sorteVonMaterial — die Sorte einer Mulde, in der das Teil richtig liegt", () => {
  afterEach(() => setzeSchichtPlatzZurueck());

  const pruefeAlle = (): void => {
    for (const m of Object.keys(MATERIALS)) {
      const s = sorteVonMaterial(m);
      expect(s, m).not.toBeNull();
      const mulden = CONFIGS.filter((c) => gehoertHierhin(c, m));
      if (mulden.length === 0) continue; // keine Mulde dafür (Schicht: Misch geht auf den Verlader)
      expect(
        mulden.some((c) => sorteVonKonfig(c) === s),
        `${m} → ${s}, aber keine Mulde dieser Sorte nimmt es`
      ).toBe(true);
      // und zwar eine am Bagger, wenn es dort eine gibt
      const amBagger = mulden.filter((c) => c.lager !== true);
      if (amBagger.length > 0) expect(amBagger.some((c) => sorteVonKonfig(c) === s), m).toBe(true);
    }
  };

  it("für alle Fraktionen des Katalogs (Sandkasten)", () => {
    pruefeAlle();
    expect(sorteVonMaterial("copper")).toBe("bunt");
    expect(sorteVonMaterial("brass")).toBe("bunt");
    expect(sorteVonMaterial("va")).toBe("bunt");
    expect(sorteVonMaterial("battery")).toBe("bunt"); // E-029: Akkus liegen in BUNT + VA
    expect(sorteVonMaterial("steel")).toBe("stahl");
    expect(sorteVonMaterial("mixed")).toBe("misch");
    for (const m of ABFALLFRAKTIONEN) expect(sorteVonMaterial(m), m).toBe("muell");
  });

  it("für alle Fraktionen im Schicht-Platz; Misch behält seine Farbe", () => {
    aktiviereSchichtPlatz();
    pruefeAlle();
    for (const m of ABFALLFRAKTIONEN) expect(sorteVonMaterial(m), m).toBe("muell");
    expect(sorteVonMaterial("mixed")).toBe("misch");
  });

  it("unbekannte Ids → null (nicht still Stahl)", () => {
    expect(sorteVonMaterial("gibtsnicht")).toBeNull();
    expect(sorteVonMaterial("")).toBeNull();
  });
});

/* ------------------------------------------------------- Das Schild selbst ---- */

/** Eine Leinwand, die mitschreibt, welche Pfade gestrichen werden. */
function schreibendeLeinwand(): { gestrichen: string[]; flaechen: string[] } {
  const protokoll = { gestrichen: [] as string[], flaechen: [] as string[] };
  const ctx: Record<string, unknown> = {};
  const proxy: Record<string, unknown> = new Proxy(ctx, {
    get: (t, k: string) => {
      if (k in t) return t[k];
      if (k === "measureText") return () => ({ width: 100 });
      if (k === "stroke") return (p?: { d?: string }) => p?.d && protokoll.gestrichen.push(p.d);
      if (k === "fill") return () => protokoll.flaechen.push(String(t.fillStyle));
      return () => undefined;
    },
    set: (t, k: string, v) => {
      t[k] = v;
      return true;
    },
  });
  (globalThis as Record<string, unknown>).Path2D = class {
    constructor(readonly d: string) {}
  };
  (globalThis as Record<string, unknown>).document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => proxy, style: {} }),
  };
  return protokoll;
}

describe("Bildschild am Behälter", () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it("zeigt Bild und Farbe der Sorte; ein Sprite je Behälter, wie vorher", () => {
    const protokoll = schreibendeLeinwand();
    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const cm = new ContainerManager(scene, world, new EventBus());
    // Jedes Bild jeder Sorte, die auf dem Platz steht, wurde gestrichen
    for (const c of CONFIGS) {
      const s = sorteVonBehaelter(c.id)!;
      for (const d of SORTEN[s].bild) expect(protokoll.gestrichen, `${c.id}: ${d}`).toContain(d);
      expect(protokoll.flaechen, c.id).toContain(`#${SORTEN[s].farbe.toString(16).padStart(6, "0")}`);
    }
    let sprites = 0;
    scene.traverse((o) => {
      if ((o as THREE.Sprite).isSprite) sprites++;
    });
    expect(sprites).toBe(cm.containers.length);
  });

  it("die Ampel trägt beim Darüberschwenken ihr Zeichen ✓ / ! / ✕", () => {
    const protokoll = schreibendeLeinwand();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const cm = new ContainerManager(new THREE.Scene(), world, new EventBus());
    const bunt = CONFIGS.find((c) => c.id === "r_bunt")!;
    const faelle: Array<[string[], "green" | "yellow" | "red"]> = [
      [["copper"], "green"],
      [["copper", "steel"], "yellow"],
      [["steel"], "red"],
    ];
    for (const [ladung, ampel] of faelle) {
      protokoll.gestrichen.length = 0;
      cm.updateHover(9, 9, []); // erst weg, damit das Schild neu zeichnet
      const r = cm.updateHover(bunt.x, bunt.z, ladung);
      expect(r?.ampel).toBe(ampel);
      for (const d of AMPEL_ZEICHEN[ampel]) expect(protokoll.gestrichen, ampel).toContain(d);
      for (const andere of (["green", "yellow", "red"] as const).filter((a) => a !== ampel)) {
        for (const d of AMPEL_ZEICHEN[andere]) expect(protokoll.gestrichen, `${ampel} zeigt ${andere}`).not.toContain(d);
      }
    }
  });
});
