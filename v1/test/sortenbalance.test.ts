/**
 * Waechter E-181 — Patrick, 20.10.2026, woertlich:
 *
 * > „muldencontainer sind eher stahlschrott. Auch fehlt es an der balance
 * > zwischen misch und stahlschrott. Mischschrott ist häufiger. Reifenstapel
 * > gibt es nicht mehr, nur einzel reifen."
 *
 * Dazu aus derselben Woche (Aufgabenliste 20.10., Punkt 28a): „Reifen haben
 * immer felge."
 *
 * Drei Pruefungen, je mit Gegenprobe:
 *  1. Muldencontainer sind Stahlschrott — ueber die EINE Regel (`massiv` am
 *     Eintrag, begruendet in derselben Zeile), keine Sonderregel.
 *  2. Mischschrott ist haeufiger als Stahlschrott: im Starthaufen und im
 *     Streuschrott, nach Stueckzahl UND Masse, ueber 96 Saaten
 *     (`tools/sortenanteile.ts`, E-080: 24 reichen nicht).
 *  3. Kein Reifen ohne Felge, kein Stapel/Haufen/Bund aus Reifen; jedes Rad
 *     ist ein Netz mit Felge und rollt als Achtkant aus (v2 E-011).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import {
  BIG_SPECS,
  FRAKTIONSMIX,
  HUGE_SPECS,
  ItemManager,
  SPECS,
  radFelge,
  radGeometrie,
  randomCargo,
} from "../src/world/scrapItems";
import { fraktionVonTeil, istRad, wandstaerkeMm, WAND_AB_MM } from "../src/materials/purity";
import { CAR_DEF, LKW_DEF, WOHNWAGEN_DEF } from "../src/dismantle/carDef";
import { getMaterial } from "../src/materials/catalog";
import type { PileSpec } from "../src/world/objektkatalog";
import { festerZufall } from "./kipperlauf";

const ALLE: PileSpec[] = [...SPECS, ...BIG_SPECS, ...HUGE_SPECS];
const QUELLE = readFileSync(resolve(__dirname, "../src/world/objektkatalog.ts"), "utf8");

/* ------------------------------------------------------------------------ */
/* 1. Muldencontainer sind Stahlschrott                                       */
/* ------------------------------------------------------------------------ */

describe("Muldencontainer sind Stahlschrott (Patrick 20.10.2026)", () => {
  const MULDEN = ["Schuttcontainer (Absetzmulde)", "Kippbehälter (Stapler)", "Absetzmulde 5 m³ (Klappdeckel)"];

  it("alle drei Mulden sind nach der Regel Stahlschrott", () => {
    for (const n of MULDEN) {
      const sp = ALLE.find((s) => s.name === n);
      expect(sp, `${n} fehlt`).toBeDefined();
      expect(fraktionVonTeil(sp!), n).toBe("steel");
    }
  });

  it("jede ueber `massiv`, und die Begruendung steht in derselben Zeile (E-042)", () => {
    for (const n of MULDEN) {
      const zeile = QUELLE.split(/\r?\n/).find((z) => z.includes(`name: "${n}"`));
      expect(zeile, n).toBeDefined();
      expect(zeile!, `${n} ohne massiv`).toContain("massiv: true");
      expect(zeile!, `${n} ohne Begruendung`).toContain("Patrick 20.10.2026");
    }
  });

  it("GEGENPROBE: ohne `massiv` waeren sie Mischschrott — die Wandstaerke allein reicht nicht", () => {
    for (const n of MULDEN) {
      const sp = ALLE.find((s) => s.name === n)!;
      expect(wandstaerkeMm(sp.massKg, sp.kind, sp.dims), n).toBeLessThan(WAND_AB_MM);
      expect(fraktionVonTeil({ ...sp, materialId: "steel", massiv: undefined }), n).toBe("mixed");
    }
  });

  it("die Raumcontainer bleiben Mischschrott: ihr Fremdstoff liegt ueber `VERBUND_BIS`", () => {
    // Bau-, Buero-, Kuehl-, Werkstattcontainer haben Einbauten (24–32 %).
    // Sie sind keine Mulden; `massiv` aenderte daran nichts (Verbund zuerst).
    for (const n of ["Baustellencontainer", "Bürocontainer", "Kühlcontainer", "Werkstattcontainer"]) {
      const sp = ALLE.find((s) => s.name === n)!;
      expect(fraktionVonTeil({ ...sp, massiv: true }), n).toBe("mixed");
    }
  });
});

/* ------------------------------------------------------------------------ */
/* 2. Mischschrott ist haeufiger als Stahlschrott                             */
/* ------------------------------------------------------------------------ */

describe("Mischschrott ist haeufiger als Stahlschrott (Patrick 20.10.2026)", () => {
  it("der Fraktionsmix setzt Misch vor Stahl, der Rest bleibt bei 20 %", () => {
    expect(FRAKTIONSMIX.mixed).toBeGreaterThan(2 * FRAKTIONSMIX.steel);
    expect(1 - FRAKTIONSMIX.mixed - FRAKTIONSMIX.steel - FRAKTIONSMIX.alu).toBeCloseTo(0.2, 9);
  });

  /** Starthaufen wie `spawnPile` (85 Teile, Grossteil-Anteil 0,12) und Streuschrott (10). */
  const messe = (saaten: number) => {
    const z = { stahl: 0, misch: 0, kgStahl: 0, kgMisch: 0, alle: 0 };
    for (let s = 0; s < saaten; s++) {
      // setzt Math.random selbst und gibt das Zuruecksetzen zurueck
      const zurueck = festerZufall(1000 + s);
      try {
        for (const t of [...randomCargo(85, 0.12), ...randomCargo(10)]) {
          z.alle++;
          if (t.materialId === "steel") {
            z.stahl++;
            z.kgStahl += t.massKg;
          } else if (t.materialId === "mixed") {
            z.misch++;
            z.kgMisch += t.massKg;
          }
        }
      } finally {
        zurueck();
      }
    }
    return z;
  };

  it("ueber 96 Saaten: Misch vor Stahl nach Stueck und Masse, in der Zielspanne", () => {
    const z = messe(96);
    // SW-Ziel E-181: Misch rund die Haelfte, Stahl rund ein Fuenftel der Stuecke.
    expect(z.misch / z.alle).toBeGreaterThan(0.44);
    expect(z.misch / z.alle).toBeLessThan(0.56);
    expect(z.stahl / z.alle).toBeGreaterThan(0.17);
    expect(z.stahl / z.alle).toBeLessThan(0.27);
    expect(z.misch, "Stueckzahl").toBeGreaterThan(1.6 * z.stahl);
    // Stahlteile sind im Mittel schwerer — nach Masse bleibt Misch trotzdem vorn.
    expect(z.kgMisch, "Masse").toBeGreaterThan(1.2 * z.kgStahl);
  });

  it("GEGENPROBE: mit dem alten Mix (42 % Stahl, 22 % Misch) faellt dieselbe Pruefung durch", () => {
    const alt = { mixed: FRAKTIONSMIX.mixed, steel: FRAKTIONSMIX.steel, alu: FRAKTIONSMIX.alu };
    const m = FRAKTIONSMIX as { mixed: number; steel: number; alu: number };
    try {
      m.mixed = 0.22;
      m.steel = 0.42;
      m.alu = 0.16;
      const z = messe(24);
      expect(z.misch > 1.6 * z.stahl, "die Pruefung haette melden muessen").toBe(false);
    } finally {
      Object.assign(m, alt);
    }
  });
});

/* ------------------------------------------------------------------------ */
/* 3. Nur Einzelreifen, immer mit Felge                                       */
/* ------------------------------------------------------------------------ */

describe("Nur Einzelreifen, und jeder mit Felge (Patrick 20.10.2026)", () => {
  const hatReifen = (s: PileSpec) =>
    (s.zusammensetzung ?? []).some((a) => a.materialId === "tires" && a.anteil >= 0.4);

  it("kein Katalogeintrag ist ein nackter Reifen — jeder Reifen ist ein Rad", () => {
    const nackt = ALLE.filter((s) => s.materialId === "tires" && !istRad(s.zusammensetzung ?? []));
    expect(nackt.map((s) => s.name)).toEqual([]);
  });

  it("kein Stapel, Haufen oder Bund aus Reifen", () => {
    const sammel = ALLE.filter(
      (s) => /reifen/i.test(s.name ?? "") || (hatReifen(s) && ["stapel", "haufen", "buendel"].includes(s.bau ?? ""))
    );
    expect(sammel.map((s) => s.name)).toEqual([]);
  });

  it("jedes Rad hat eine Felge, zaehlt als Reifen (E-186) und ist mit Werkzeug trennbar", () => {
    const raeder = ALLE.filter(hatReifen);
    expect(raeder.length).toBeGreaterThanOrEqual(9);
    for (const r of raeder) {
      const shape = { kind: r.kind, dims: r.dims, color: 0, zusammensetzung: r.zusammensetzung };
      expect(radFelge(shape), `${r.name} ohne Felge`).not.toBeNull();
      // E-186, Patrick 20.10.2026: „Rad zählt als Reifen"
      expect(fraktionVonTeil(r), r.name).toBe("tires");
      expect(r.trennbar && r.nurWerkzeug, `${r.name} nicht trennbar`).toBe(true);
      expect(r.bau, `${r.name}: ein Bau ersetzte die Radform`).toBeUndefined();
    }
  });

  it("E-186: Wrackraeder sind Reifen, die Motorhaube bleibt Mischschrott", () => {
    for (const d of [CAR_DEF, LKW_DEF, WOHNWAGEN_DEF]) {
      const raeder = d.parts.filter((p) => p.kind === "wheel");
      expect(raeder.length).toBeGreaterThan(0);
      for (const p of raeder) expect(p.materialId, p.id).toBe("tires");
    }
    const haube = CAR_DEF.parts.find((p) => p.name === "Motorhaube");
    expect(haube, "Motorhaube fehlt").toBeDefined();
    expect(haube!.materialId).toBe("mixed");
  });

  it("GEGENPROBE: zwei Stoffe mit wenig Gummi sind kein Rad, ein Quad auch nicht", () => {
    // Raupenunterwagen (Gummiketten 20 %) und Baggerloeffel (Noppen 3 %)
    for (const n of ["Minibagger-Raupenunterwagen", "Baggerlöffel"]) {
      const s = ALLE.find((x) => x.name === n)!;
      expect(istRad(s.zusammensetzung ?? []), n).toBe(false);
      expect(fraktionVonTeil(s), n).not.toBe("tires");
    }
    const quad = ALLE.find((x) => x.name === "Quad")!;
    expect(fraktionVonTeil(quad)).toBe("mixed");
  });

  it("GEGENPROBE: Kabelring und Kupferbund sind keine Raeder", () => {
    for (const n of ["Kabelring", "Kupferbund"]) {
      const s = ALLE.find((x) => x.name === n)!;
      expect(radFelge({ kind: s.kind, dims: s.dims, color: 0, zusammensetzung: s.zusammensetzung })).toBeNull();
    }
  });

  it("das Rad ist EIN Netz mit Reifen- und Felgenfarbe, unter 600 Dreiecken", () => {
    const g = radGeometrie(0.215, 0.1, getMaterial("steel").color);
    const farbe = g.getAttribute("color");
    expect(farbe, "keine Eckfarben").toBeDefined();
    const dreiecke = (g.index ? g.index.count : g.getAttribute("position").count) / 3;
    expect(dreiecke).toBeLessThan(600);
    const farben = new Set<string>();
    for (let i = 0; i < farbe.count; i++)
      farben.add(`${farbe.getX(i).toFixed(3)},${farbe.getY(i).toFixed(3)},${farbe.getZ(i).toFixed(3)}`);
    expect(farben.size, "Reifen und Felge in derselben Farbe").toBe(2);
    // innerhalb des Kolliders: Aussenhalbmesser = Ring + Rohr, Hoehe = 2 x Rohr
    g.computeBoundingBox();
    const b = g.boundingBox!;
    expect(b.max.x).toBeLessThanOrEqual(0.315 + 1e-6);
    expect(b.max.y - b.min.y).toBeLessThanOrEqual(0.2 * 0.8 + 1e-6 + 0.2 * 0.2); // Nabe ragt nicht ueber den Reifen
  });
});

describe("Ein Rad auf der Kante rollt aus (v2 E-011: Achtkant statt Zylinder)", () => {
  beforeAll(async () => {
    await initPhysics();
  });

  it("jedes Rad: hochkant angestossen, nach 10 s in Ruhe", () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(RAPIER.ColliderDesc.cuboid(200, 0.5, 200).setTranslation(0, -0.5, 0));
    const items = new ItemManager(new THREE.Scene(), world);
    const raeder = ALLE.filter((s) => (s.zusammensetzung ?? []).some((a) => a.materialId === "tires" && a.anteil >= 0.4));
    const gelegt = raeder.map((r, i) => {
      const aussen = r.kind === "torus" ? r.dims[0]! + r.dims[1]! : r.dims[0]!;
      const it = items.spawnScrap(
        r.materialId,
        r.massKg,
        { kind: r.kind, dims: r.dims, color: 0, name: r.name, zusammensetzung: r.zusammensetzung },
        new THREE.Vector3(0, aussen + 0.02, i * 4),
        // hochkant: Achse waagerecht
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
      );
      // ein Schubs in Rollrichtung (quer zur Achse, die jetzt in z liegt), wie vom Greifer
      it.body.applyImpulse({ x: r.massKg * 1.5, y: 0, z: 0 }, true);
      return it;
    });
    for (let i = 0; i < 600; i++) world.step();
    for (const it of gelegt) {
      const v = it.body.linvel();
      const w = it.body.angvel();
      const tempo = Math.hypot(v.x, v.y, v.z);
      const dreh = Math.hypot(w.x, w.y, w.z);
      expect(tempo, `${it.shape?.name} rollt noch`).toBeLessThan(0.05);
      expect(dreh, `${it.shape?.name} dreht noch`).toBeLessThan(0.1);
    }
  });
});
