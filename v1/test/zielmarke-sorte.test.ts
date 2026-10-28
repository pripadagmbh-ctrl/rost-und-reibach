/**
 * AUFTRAG 41 (P3a, 22.10.2026): Pruefungen ohne Text — das Ziel-Teil leuchtet
 * in der Sortenfarbe, ein Pfeil darueber, ein gestrichelter Weg zum Ziel.
 *
 *  1. Je Pruefung am echten Platz (`aufgabenwerkbank.ts`): jede Teil-Marke
 *     traegt die Sorte ihres Ziels und `nach` auf dem Ziel; `challenge:vorschau`
 *     kommt genau einmal je Start, mit Punkten auf Teil und Ziel.
 *  2. `kurz` (≤ 5 Woerter, DE und EN) und `zeichen` fuer alle sechs.
 *  3. Die Zielmarke faerbt Kegel, Ring, Hof und Weg in `SORTEN[s].farbe`,
 *     ohne Sorte bleibt Gelb/Gruen; nach 600 Bildern keine neuen Netze.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { CHALLENGES } from "../src/challenges/katalog";
import { weltQuellen } from "../src/challenges/quellen";
import { EventBus, type GameEvents } from "../src/core/events";
import { SORTEN, sorteVonBehaelter, type SorteId } from "../src/materials/sorten";
import { installZielmarke } from "../src/ui/zielmarke";
import { DT, platzLeinwand, starteAufgabe, werkbank } from "./aufgabenwerkbank";

beforeAll(async () => {
  platzLeinwand();
  await RAPIER.init();
});

type Stand = GameEvents["challenge:stand"];
type Marke = Stand["marken"][number];

/** Eine Pruefung aufbauen, ein Bild laufen lassen: erste Marken, Vorschauen, Ziel-Punkte der Behaelter. */
function erstesBild(id: string) {
  const d = CHALLENGES.find((c) => c.id === id)!;
  const k = werkbank();
  const vorschau: Array<GameEvents["challenge:vorschau"]> = [];
  const staende: Stand[] = [];
  k.bus.on("challenge:vorschau", (e) => vorschau.push(e));
  k.bus.on("challenge:stand", (e) => staende.push(e));
  const { lauf, obj } = starteAufgabe(k, d);
  lauf.takt(DT);
  const q = weltQuellen({ bagger: k.b, grip: k.grip, containers: k.containers, items: k.items, press: k.press });
  const zielPunkt = (cid: string) => {
    const b = q.behaelter(cid)!;
    return { x: b.x, y: b.oberkante, z: b.z };
  };
  /** Die Teil-Marke ueber diesem Teil (gleiche Lage im Grundriss) */
  const markeAn = (i: number): Marke | undefined => {
    const p = obj.teile[i]!.body.translation();
    return staende[0]!.marken.find((m) => m.art === "teil" && Math.hypot(m.x - p.x, m.z - p.z) < 1e-6);
  };
  return { d, obj, vorschau, marken: staende[0]!.marken, zielPunkt, markeAn };
}

/** Erwartung je Teil: Behaelter, Sorte */
function pruefeTeile(a: ReturnType<typeof erstesBild>, soll: ReadonlyArray<[string, SorteId] | null>): void {
  soll.forEach((s, i) => {
    const m = a.markeAn(i);
    const name = a.d.aufbau.teile![i]!.name;
    if (!s) {
      expect(m, `${name}: bleibt liegen — keine Marke`).toBeUndefined();
      return;
    }
    expect(m, name).toBeDefined();
    expect(m!.sorte, name).toBe(s[1]);
    expect(sorteVonBehaelter(s[0]), `${name}: Sorte = Schild der Mulde`).toBe(s[1]);
    expect(m!.nach, `${name}: Weg endet auf ${s[0]}`).toEqual(a.zielPunkt(s[0]));
  });
}

describe("Teil-Marken tragen Sorte und Ziel — je Pruefung am echten Platz", () => {
  it("1 Erster Griff: Kupfer → BUNT + VA; Vorschau Kupfer → Box", () => {
    const a = erstesBild("erster-griff");
    pruefeTeile(a, [["r_bunt", "bunt"]]);
    expect(a.vorschau).toHaveLength(1);
    const p = a.obj.teile[0]!.body.translation();
    expect(a.vorschau[0]).toEqual({ teil: { x: p.x, y: p.y, z: p.z }, ziel: a.zielPunkt("r_bunt") });
  });

  it("2 Presse: Wrack ohne Sorte, Weg zur Kammer; Vorschau Wrack → Kammer", () => {
    const a = erstesBild("verladen");
    const teil = a.marken.filter((m) => m.art === "teil");
    expect(teil).toHaveLength(1);
    expect(teil[0]).toMatchObject({ sorte: null, nach: a.d.zielMarke });
    expect(a.vorschau).toHaveLength(1);
    const p = a.obj.wracks[0]!.body.translation();
    expect(a.vorschau[0]).toEqual({ teil: { x: p.x, y: p.y, z: p.z }, ziel: a.d.zielMarke });
  });

  it("3 Sortieren: jedes der sechs Teile zu seiner Mulde; Vorschau erstes Teil → seine Mulde", () => {
    const a = erstesBild("sortieren");
    // Reihenfolge wie im Katalog: Boiler, Holzkiste, Schwungrad, Frontgewicht, Waschmaschine, Gefriertruhe
    pruefeTeile(a, [
      ["r_bunt", "bunt"],
      ["r_rubble", "muell"],
      ["c_steel", "stahl"],
      ["c_steel", "stahl"],
      ["c_mixed", "misch"],
      ["c_mixed", "misch"],
    ]);
    expect(a.marken.filter((m) => m.art === "teil")).toHaveLength(6);
    expect(a.vorschau).toHaveLength(1);
    expect(a.vorschau[0]!.ziel).toEqual(a.zielPunkt("r_bunt"));
  });

  it("4 Platt machen: Wohnwagen ohne Sorte und ohne Weg; Vorschau zeigt den Wohnwagen", () => {
    const a = erstesBild("platt-machen");
    expect(a.marken).toEqual([expect.objectContaining({ art: "teil", sorte: null, nach: null })]);
    expect(a.vorschau).toHaveLength(1);
    expect(a.vorschau[0]!.ziel).toEqual(a.vorschau[0]!.teil);
  });

  it("5 Magnet: Spaene → MISCH, Eisen → STAHL, Kupfer liegen lassen = keine Marke", () => {
    const a = erstesBild("magnet");
    // Spaene, Kupferbund, Knueppel, Kupferrohr, Spaene, Felge, Vierkant
    pruefeTeile(a, [["c_mixed", "misch"], null, ["c_steel", "stahl"], null, ["c_mixed", "misch"], ["c_steel", "stahl"], ["c_steel", "stahl"]]);
    expect(a.vorschau).toHaveLength(1);
    expect(a.vorschau[0]!.ziel, "erstes Pflichtteil sind Spaene").toEqual(a.zielPunkt("c_mixed"));
  });

  it("6 Schwere Last: Wrack ohne Sorte, Weg zum Kreis; der Kreis ohne Sorte", () => {
    const a = erstesBild("schwere-last");
    expect(a.marken.find((m) => m.art === "teil")).toMatchObject({ sorte: null, nach: a.d.zielMarke });
    expect(a.marken.find((m) => m.art === "ziel")).toMatchObject({ sorte: null });
    expect(a.vorschau).toHaveLength(1);
    expect(a.vorschau[0]!.ziel).toEqual(a.d.zielMarke);
  });
});

describe("Zielzeile: kurz und zeichen", () => {
  const woerter = (s: string): number => s.trim().split(/\s+/).length;
  it("alle sechs: kurz hoechstens 5 Woerter in DE und EN, zeichen Teil → Ziel", () => {
    expect(CHALLENGES).toHaveLength(6);
    for (const c of CHALLENGES) {
      expect(woerter(c.kurz.de), `${c.id} DE „${c.kurz.de}"`).toBeLessThanOrEqual(5);
      expect(woerter(c.kurz.en), `${c.id} EN „${c.kurz.en}"`).toBeLessThanOrEqual(5);
      expect(c.zeichen.teil, c.id).toBeDefined();
      expect(c.zeichen.ziel, c.id).toBeDefined();
      for (const b of [c.zeichen.teil, c.zeichen.ziel]) if ("sorte" in b) expect(SORTEN[b.sorte], c.id).toBeDefined();
    }
  });
});

describe("Zielmarke: Farben am Netz, Vorrat", () => {
  const stand = (marken: Stand["marken"]): Stand => ({
    id: "t",
    zeitS: 0,
    zaehler: null,
    balken01: null,
    pressenBereit: false,
    tipp: null,
    marken,
  });
  function aufbau() {
    const scene = new THREE.Scene();
    const bus = new EventBus();
    installZielmarke(scene, bus);
    const netze = () => scene.children as THREE.Mesh[];
    const sichtbar = () => netze().filter((n) => n.visible);
    const kegel = () => sichtbar().filter((n) => n.geometry instanceof THREE.ConeGeometry);
    const ring = () => sichtbar().filter((n) => n.geometry instanceof THREE.TorusGeometry);
    const inst = (g: abstract new (...a: never[]) => THREE.BufferGeometry) =>
      netze().find((n) => n instanceof THREE.InstancedMesh && n.geometry instanceof g) as THREE.InstancedMesh;
    const hof = () => inst(THREE.RingGeometry);
    const weg = () => inst(THREE.PlaneGeometry);
    const farbeVon = (n: THREE.Mesh) => (n.material as THREE.MeshBasicMaterial).color.getHex();
    const exemplar = (n: THREE.InstancedMesh, i: number) => {
      const c = new THREE.Color();
      n.getColorAt(i, c);
      return c.getHex();
    };
    return { scene, bus, kegel, ring, hof, weg, farbeVon, exemplar };
  }

  it("mit Sorte: Kegel, Ring, Hof und Weg in SORTEN[s].farbe; Ziel-Marke ebenso", () => {
    const z = aufbau();
    z.bus.emit("challenge:stand", stand([{ x: 0, y: 1, z: 0, art: "teil", sorte: "stahl", nach: { x: 0, y: 2, z: 10 } }]));
    const f = SORTEN.stahl.farbe;
    expect(z.kegel().map(z.farbeVon)).toEqual([f]);
    expect(z.ring().map(z.farbeVon)).toEqual([f]);
    expect(z.hof().count).toBe(1);
    expect(z.exemplar(z.hof(), 0)).toBe(f);
    // 10 m Weg ab dem Hofrand (1,2 m), alle 1 m ein Strich: 8 bis 9 Striche
    expect(z.weg().count).toBeGreaterThanOrEqual(8);
    expect(z.weg().count).toBeLessThanOrEqual(9);
    for (let i = 0; i < z.weg().count; i++) expect(z.exemplar(z.weg(), i)).toBe(f);
    // Striche liegen auf der Linie Teil → Ziel, am Boden, mit Laenge entlang der Linie
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    z.weg().getMatrixAt(0, m);
    p.setFromMatrixPosition(m);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeLessThan(0.1);
    expect(p.z).toBeGreaterThan(1.1);
    z.bus.emit("challenge:stand", stand([{ x: 0, y: 2, z: 10, art: "ziel", sorte: "misch" }]));
    expect(z.kegel().map(z.farbeVon)).toEqual([SORTEN.misch.farbe]);
    expect(z.hof().visible || z.weg().visible, "Ziel allein: kein Hof, kein Weg").toBe(false);
  });

  it("GEGENPROBE ohne Sorte: Gelb am Teil, Gruen am Ziel, kein Hof; der Weg gelb", () => {
    const z = aufbau();
    z.bus.emit("challenge:stand", stand([
      { x: 0, y: 1, z: 0, art: "teil", sorte: null, nach: { x: 6, y: 0, z: 0 } },
      { x: 6, y: 0, z: 0, art: "ziel", sorte: null },
    ]));
    expect(z.kegel().map(z.farbeVon)).toEqual([0xf0c020, 0x4fd06a]);
    expect(z.hof().visible).toBe(false);
    expect(z.weg().count).toBeGreaterThan(0);
    expect(z.exemplar(z.weg(), 0)).toBe(0xf0c020);
    // Ohne `nach` kein Weg
    z.bus.emit("challenge:stand", stand([{ x: 0, y: 1, z: 0, art: "teil", sorte: null, nach: null }]));
    expect(z.weg().visible).toBe(false);
  });

  it("Vorrat: nach 600 Bildern mit sechs Teilen keine neuen Netze, Materialien oder Geometrien", () => {
    const z = aufbau();
    const sorten: SorteId[] = ["stahl", "stahl", "misch", "misch", "bunt", "muell"];
    const bild = (k: number) =>
      z.bus.emit(
        "challenge:stand",
        stand(sorten.map((s, i) => ({ x: i + Math.sin(k / 30), y: 1, z: 5, art: "teil" as const, sorte: s, nach: { x: -8, y: 2, z: -20 + i } })))
      );
    bild(0);
    const zaehle = () => {
      const mats = new Set<THREE.Material>();
      const geos = new Set<THREE.BufferGeometry>();
      z.scene.traverse((o) => {
        const n = o as THREE.Mesh;
        if (n.material) mats.add(n.material as THREE.Material);
        if (n.geometry) geos.add(n.geometry);
      });
      return { netze: z.scene.children.length, mats: mats.size, geos: geos.size };
    };
    const vorher = zaehle();
    for (let k = 1; k <= 600; k++) bild(k);
    expect(zaehle()).toEqual(vorher);
    // Sechs Teile: 6 Kegel + 6 Ringe + 1 Hof + 1 Weg — gegenueber vorher (12) zwei Zeichenaufrufe mehr
    expect(z.scene.children.filter((n) => n.visible)).toHaveLength(14);
    expect(z.hof().count).toBe(6);
  });
});

/*
 * P4b (E-213 Offen 1, Patrick: „klein mit rein"): In Pruefung 1 lief der
 * gerade Weg vom Kupfer zur Mulde unter dem Bagger durch. Mit `um` (Drehmitte)
 * fuehrt er als Schwenkbogen herum — der Weg, den das Teil in der Spinne reist.
 */
describe("Weg als Schwenkbogen um die Drehmitte (P4b)", () => {
  /** Auftrag P4b: kein Strich naeher als 3 m an der Drehmitte. SW: 3 m — Oberwagen des Mobilbaggers (Heck rund 2,5 m) plus Luft */
  const ABSTAND_MIN_M = 3;
  const striche = (marken: Stand["marken"]) => {
    const scene = new THREE.Scene();
    const bus = new EventBus();
    installZielmarke(scene, bus);
    bus.emit("challenge:stand", { id: "t", zeitS: 0, zaehler: null, balken01: null, pressenBereit: false, tipp: null, marken });
    const weg = scene.children.find((n) => n instanceof THREE.InstancedMesh && n.geometry instanceof THREE.PlaneGeometry) as THREE.InstancedMesh;
    const m = new THREE.Matrix4();
    return Array.from({ length: weg.count }, (_, i) => {
      weg.getMatrixAt(i, m);
      return new THREE.Vector3().setFromMatrixPosition(m);
    });
  };

  it("Pruefung 1: die Teil-Marke traegt die Drehmitte; der Bogen bleibt auf Reichweite, gerade schnitte er unter dem Arm durch", () => {
    const a = erstesBild("erster-griff");
    const t = a.marken.find((m) => m.art === "teil")!;
    expect(t.um, "Drehmitte mitgegeben").toBeDefined();
    const um = t.um!;
    const r = (p: { x: number; z: number }) => Math.hypot(p.x - um.x, p.z - um.z);
    // Gemessen 22.10.2026: Kupfer 8,1 m vor der Drehmitte, BUNT + VA 7,6 m links davon
    const innen = Math.min(r(t), r(t.nach!));
    const bogen = striche(a.marken);
    expect(bogen.length).toBeGreaterThan(3);
    for (const p of bogen) {
      expect(r(p)).toBeGreaterThanOrEqual(ABSTAND_MIN_M);
      expect(r(p), "nie naeher als Teil oder Ziel").toBeGreaterThanOrEqual(innen - 1e-6);
    }
    // Gegenprobe: derselbe Weg gerade (ohne `um`) kommt dem Bagger naeher (gemessen 5,8 m — ueber Vorderwagen und unter dem Arm)
    const gerade = striche(a.marken.map((m) => ({ ...m, um: null })));
    expect(Math.min(...gerade.map(r))).toBeLessThan(innen - 1);
    // Der Bogen endet am Ziel: letzter Strich hoechstens einen Takt vor der Mulde
    const ende = bogen.at(-1)!;
    expect(Math.hypot(ende.x - t.nach!.x, ende.z - t.nach!.z)).toBeLessThanOrEqual(1.0 + 0.55);
  });

  it("Bogen: Halbmesser gleitet vom Teil zum Ziel, Drehsinn der kuerzere, Striche liegen tangential", () => {
    // Teil 6 m vor der Drehmitte (+z), Ziel 10 m rechts (+x): Viertelkreis, nicht drei Viertel
    const um = { x: 0, z: 0 };
    const p = striche([{ x: 0, y: 1, z: 6, art: "teil", sorte: "stahl", nach: { x: 10, y: 2, z: 0 }, um }]);
    for (const s of p) {
      const r = Math.hypot(s.x, s.z);
      expect(r).toBeGreaterThanOrEqual(6 - 1e-6);
      expect(r).toBeLessThanOrEqual(10 + 1e-6);
      expect(s.x, "kuerzerer Weg: nur im Viertel x ≥ 0, z ≥ 0").toBeGreaterThanOrEqual(-1e-6);
      expect(s.z).toBeGreaterThanOrEqual(-1e-6);
    }
    // Viertelkreis mit mittlerem Halbmesser 8 m ≈ 12,6 m, ab 1,2 m alle 1 m: 11 bis 12 Striche
    expect(p.length).toBeGreaterThanOrEqual(10);
    expect(p.length).toBeLessThanOrEqual(12);
  });
});
