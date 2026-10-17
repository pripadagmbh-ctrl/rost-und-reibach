import { describe, it, expect, beforeAll } from "vitest";
/**
 * SPÄNEKNÄUEL (E-147) — Wächter.
 *
 * Patrick, 17.10.2026: „Späne ins Spiel integrieren" — lose Knäuel, im
 * Absetzcontainer angeliefert, als Mischschrott; Magnet und Spinne nehmen sie.
 *
 * Geprüft: Fraktion aus der einen Regel, Stahlanteil abfragbar, ein Netz je
 * Knäuel mit geteilter Geometrie, die Kundschaft bringt sie, und eine
 * abgesetzte Spänemulde schläft ein.
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { fraktionVonTeil, VERBUND_BIS } from "../src/materials/purity";
import {
  SPAENE_VARIANTEN,
  SPAENE_ZUSAMMENSETZUNG,
  SPAENE_STUECK_MAX,
  SPAENE_NAME,
  spaeneCargo,
} from "../src/world/spaene";
import { rollCustomer, rollSpaenefuhre, TRADES } from "../src/delivery/customers";
import { NACHSCHUB_FOLGE, nachschubMeldung, profilFuer } from "../src/delivery/nachschub";
import { imTrog } from "../src/delivery/absetzmulde";
import { festerZufall } from "./kipperlauf";

beforeAll(async () => {
  await initPhysics();
});

describe("Ein Späneknäuel ist Mischschrott", () => {
  it("nach der einen Regel — Fremdmetall über der Verbundgrenze, auch wenn es schwerer wird", () => {
    const fremd = 1 - SPAENE_ZUSAMMENSETZUNG.find((a) => a.materialId === "steel")!.anteil;
    expect(fremd).toBeGreaterThan(VERBUND_BIS);
    for (const v of SPAENE_VARIANTEN) {
      // Die Fuhre zieht die Massen auf die angekuendigte Menge — auch das Dreifache bleibt Misch
      for (const k of [1, 3]) {
        expect(
          fraktionVonTeil({ materialId: "steel", massKg: v.massKg * k, kind: "box", dims: v.dims, zusammensetzung: SPAENE_ZUSAMMENSETZUNG })
        ).toBe("mixed");
      }
    }
    for (const sp of spaeneCargo(20)) expect(sp.materialId).toBe("mixed");
  });

  it("der Stahlanteil steht am Teil (Zusammensetzung in kg) — fuer den Magneten", () => {
    const items = new ItemManager(new THREE.Scene(), new RAPIER.World({ x: 0, y: -9.81, z: 0 }));
    const sp = spaeneCargo(1)[0]!;
    const it = items.spawnScrap(sp.materialId, 15, sp.shape, new THREE.Vector3(0, 1, 0));
    const stahl = it.composition?.find((c) => c.materialId === "steel")?.massKg ?? 0;
    expect(stahl).toBeCloseTo(15 * 0.82, 6);
    expect(it.shape?.name).toBe(SPAENE_NAME);
    // Die Spinne macht keinen Fladen daraus
    expect(items.isCrushable(it)).toBe(false);
  });
});

describe("Zeichenrufe: ein Netz je Knäuel, Geometrie geteilt", () => {
  it("jedes Knäuel ist genau ein Netz ohne Kinder, gleiche Variante = gleiche Geometrie", () => {
    const items = new ItemManager(new THREE.Scene(), new RAPIER.World({ x: 0, y: -9.81, z: 0 }));
    const geos = new Map<number, THREE.BufferGeometry>();
    for (let v = 0; v < SPAENE_VARIANTEN.length; v++) {
      for (let k = 0; k < 2; k++) {
        const sp = spaeneCargo(1)[0]!;
        const shape = { ...sp.shape, spaene: v, dims: [...SPAENE_VARIANTEN[v].dims] };
        const it = items.spawnScrap("mixed", 14, shape, new THREE.Vector3(v * 2, 1, k * 2));
        const mesh = it.mesh as THREE.Mesh;
        expect(mesh.isMesh).toBe(true);
        expect(mesh.children.length).toBe(0);
        if (geos.has(v)) expect(mesh.geometry).toBe(geos.get(v));
        geos.set(v, mesh.geometry);
        // Dreiecke sind auf dem Geraet fast gratis, aber nicht ganz (E-025): unter 1 100
        expect(mesh.geometry.getAttribute("position").count / 3).toBeLessThan(1100);
      }
    }
  });
});

describe("Die Kundschaft bringt Späne im Absetzkipper", () => {
  it("rund jede vierte Absetzkipper-Fuhre des Gewerbes, nur aus Dreherei und Maschinenbau", () => {
    const zurueck = festerZufall(147);
    try {
      let absetzer = 0;
      let spaene = 0;
      const metall = new Set(TRADES.filter((t) => (t.spaene ?? 0) > 0).map((t) => t.name));
      for (let i = 0; i < 20000; i++) {
        const c = rollCustomer();
        if (c.spaene) {
          expect(c.vehicle).toBe("absetzer");
          expect(metall.has(c.name), c.name).toBe(true);
          expect(c.sortedMaterial).toBe("mixed");
          expect(c.massKg).toBeGreaterThanOrEqual(600);
        }
        if (c.group === "gewerbe" && c.vehicle === "absetzer") {
          absetzer++;
          if (c.spaene) spaene++;
        }
      }
      // SW 25 % (Dreherei 1 + Maschinenbau 0,75 von 7 Betrieben)
      expect(spaene / absetzer).toBeGreaterThan(0.2);
      expect(spaene / absetzer).toBeLessThan(0.3);
    } finally {
      zurueck();
    }
  });

  it("NACHSCHUB hat eine eigene Art „Späne“, die sicher eine Spänemulde bringt", () => {
    expect(NACHSCHUB_FOLGE).toContain("spaene");
    for (let i = 0; i < 20; i++) {
      const c = profilFuer("spaene");
      expect(c.vehicle).toBe("absetzer");
      expect(c.spaene).toBe(true);
      expect(nachschubMeldung(c)).toMatch(/Spänen/);
    }
  });
});

describe("Die abgesetzte Spänemulde", () => {
  it("bringt 30 bis 48 Knäuel, alle in der Mulde, und der Haufen schläft ein", () => {
    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = 1 / 60;
    const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0), boden);
    const items = new ItemManager(scene, world);
    const m = new VehicleManager(scene, world, items, new CompositeManager(scene, world, items, new EventBus()));
    m.acceptDeliveries = false;
    type Wagen = { absetzModus: string; cargo: { items: Array<{ body: RAPIER.RigidBody; shape?: { name?: string } }> } };
    const aktiv = (): Wagen | null => (m as unknown as { active: Wagen | null }).active;
    const zurueck = festerZufall(7001);
    let fuhre: Wagen["cargo"]["items"];
    try {
      m.spawnNow("absetzer", rollSpaenefuhre());
      aktiv()!.absetzModus = "absetzen";
      fuhre = [...aktiv()!.cargo.items];
    } finally {
      zurueck();
    }
    expect(fuhre.length).toBeGreaterThanOrEqual(30);
    expect(fuhre.length).toBeLessThanOrEqual(SPAENE_STUECK_MAX);
    for (const it of fuhre) expect(it.shape?.name).toBe(SPAENE_NAME);
    const handles = new Set(fuhre.map((it) => it.body.handle));
    let weg = -1;
    for (let i = 0; i < 60 * 150; i++) {
      m.update(1 / 60);
      items.clampSpeeds(1 / 60);
      world.step();
      if (weg < 0 && !aktiv()) weg = i;
      if (weg >= 0 && i > weg + 60 * 10) break;
    }
    expect(weg, "der Absetzkipper ist nicht vom Hof gekommen").toBeGreaterThan(0);
    const mulde = m.abgesetzteMulde!;
    mulde.group.updateWorldMatrix(true, false);
    const inv = new THREE.Matrix4().copy(mulde.group.matrixWorld).invert();
    const h = new THREE.Vector3();
    const eigene = items.items.filter((it) => handles.has(it.body.handle));
    expect(eigene.filter((it) => imTrog(inv, it.body.translation(), h)).length).toBe(fuhre.length);
    // 10 s nach der Abfahrt: alles schlaeft (gemessen ab Abfahrt schon nach 0 Schritten)
    expect(eigene.filter((it) => !it.body.isSleeping()).length).toBe(0);
  });
});
