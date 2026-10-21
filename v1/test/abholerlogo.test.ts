/**
 * E-133 — Patrick, 17.10.2026: „abholer und eigene LKW sollen auch pripada
 * Logo tragen". Nur Achims Abroller gehört dem Hof; Anlieferer sind Kunden.
 *
 *  1. Die Netzzahl bleibt (E-108): Das Logo ist ein anderes Material auf
 *     denselben Seitenwänden, kein zusätzliches Netz.
 *  2. Beide Seitenwände des Abholers tragen den Atlas; Kipper und Pritsche nicht.
 *  3. Ein Material für alle Abholer — jedes neue three-Objekt zieht
 *     Zufallszahlen und verschöbe die gewürfelten Fuhren.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { buildVehicleModel, type VehicleModelContext } from "../src/delivery/vehicleModel";
import { initPhysics } from "../src/physics/physicsWorld";
import { leinwandMitVerlauf } from "../tools/engstellen-kern";

beforeAll(async () => {
  await initPhysics();
});

function bauen(kind: string, bedLen: number): VehicleModelContext {
  const ctx: VehicleModelContext = {
    kind,
    bedLen,
    group: new THREE.Group(),
    bedGroup: new THREE.Group(),
    world: new RAPIER.World({ x: 0, y: -9.81, z: 0 }),
    sideWalls: [],
    tailGate: null,
  };
  buildVehicleModel(ctx);
  return ctx;
}
function netze(ctx: VehicleModelContext): number {
  let n = 0;
  ctx.group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) n++;
  });
  return n;
}
const karte = (m: THREE.Mesh): THREE.Texture | null => (m.material as THREE.MeshStandardMaterial).map;

describe("Firmenzeichen am Abholer (E-133)", () => {
  it("gleiche Netzzahl mit und ohne Atlas; beide Seitenwände tragen ihn", () => {
    // Längen aus `vehicles.ts` (wie test/vehicleModel.test.ts)
    const ohne = bauen("abholer", 5.4);
    expect(ohne.sideWalls.every((w) => karte(w.mesh) === null)).toBe(true);
    leinwandMitVerlauf();
    const mit = bauen("abholer", 5.4);
    expect(netze(mit)).toBe(netze(ohne));
    expect(mit.sideWalls.length).toBe(2);
    for (const w of mit.sideWalls) expect(karte(w.mesh), `Wand ${w.dir}`).not.toBeNull();
    // Ein Material für alle Abholer
    const zweiter = bauen("abholer", 5.4);
    expect(zweiter.sideWalls[0]!.mesh.material).toBe(mit.sideWalls[0]!.mesh.material);
  });

  it("Kipper und Pritsche tragen kein Logo", () => {
    leinwandMitVerlauf();
    for (const [kind, len] of [["kipper", 6.0], ["pritsche", 5.4]] as const) {
      const v = bauen(kind, len);
      for (const w of v.sideWalls) expect(karte(w.mesh), kind).toBeNull();
    }
  });

  it("die Außenfläche zeigt das Signet, ungespiegelt von außen", () => {
    leinwandMitVerlauf();
    const v = bauen("abholer", 5.4);
    for (const w of v.sideWalls) {
      const geo = w.mesh.geometry as THREE.BufferGeometry;
      const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
      const pos = geo.getAttribute("position") as THREE.BufferAttribute;
      const nor = geo.getAttribute("normal") as THREE.BufferAttribute;
      // Die Fläche, deren Normale nach außen zeigt (dir), trägt das breite Feld
      const aussen = [0, 1, 2, 3, 4, 5].find((f) => Math.sign(nor.getX(f * 4)) === w.dir)!;
      const us = [0, 1, 2, 3].map((k) => uv.getX(aussen * 4 + k));
      expect(Math.max(...us) - Math.min(...us), "Außenfeld zu schmal").toBeGreaterThan(0.2);
      // Von außen gesehen läuft u nach rechts: rechts ist −z bei +x-Blick, +z bei −x-Blick
      const rechts = -w.dir;
      const a = aussen * 4;
      const du = uv.getX(a + 1) - uv.getX(a);
      const dz = pos.getZ(a + 1) - pos.getZ(a);
      expect(Math.sign(du) * Math.sign(dz), `Wand ${w.dir} gespiegelt`).toBe(rechts);
      // Alle anderen Flächen sind schmal: das reine Grün (128 px auf dem
      // 1024 breiten Atlas seit E-143 = 0,125)
      for (let f = 0; f < 6; f++) {
        if (f === aussen) continue;
        const u = [0, 1, 2, 3].map((k) => uv.getX(f * 4 + k));
        expect(Math.max(...u) - Math.min(...u)).toBeLessThan(0.15);
      }
    }
  });
});
