/**
 * E-133 — Patrick, 17.10.2026: „Baue auch container auf dem schrottplatz mit
 * ein, aber mit pripada drauf", „ne, die mulden bleiben", „nur paar container
 * am rand verteilen".
 *
 *  1. Ein paar einzelne Mulden, am Rand, innerhalb der Mauern.
 *  2. Keine steht einem Bauwerk, dem Bagger oder einem Verladeplatz im Weg.
 *     Ob Laster, Lambert und Streife durchfahren, beweisen die Fahrweg-Wächter
 *     (`fahrumriss`, `durchfahrt`, `anstehen`, `engstellen`, `lambert*`,
 *     `police`): Sie fahren gegen dieselbe Hindernisliste.
 *  3. Zwei Netze für alle vier, fünf Kollider je Mulde, und was hineinfällt,
 *     landet auf dem Boden statt auf einem Deckel.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { GripSystem } from "../src/physics/gripSystem";
import { FIRMENMULDEN, firmenmuldenHindernisse, baueFirmenmulden } from "../src/world/firmenmulden";
import { alleHindernisse } from "../src/world/obstacles";
import { YARD_D, YARD_MIN_X, YARD_MAX_X } from "../src/world/yard";
import { BAGGER_STAND, VERLADE_STAND, SCHWENK_AUSSEN } from "../src/world/baggerstand";
import { alleAbholPlaetze } from "../src/delivery/routes";
import { CONFIGS } from "../src/world/containers";
import { leinwandMitVerlauf } from "../tools/engstellen-kern";

const HZ = YARD_D / 2;
/** Halbe Mauerdicke (drei Reihen à 0,6 m, `obstacles.WALL_T`) */
const MAUER = 0.3;
const hindernisse = firmenmuldenHindernisse();
const ecken = (o: (typeof hindernisse)[number]): Array<[number, number]> => [
  [o.x - o.hw, o.z - o.hd],
  [o.x + o.hw, o.z - o.hd],
  [o.x - o.hw, o.z + o.hd],
  [o.x + o.hw, o.z + o.hd],
];

describe("Firmenmulden am Rand (E-133)", () => {
  it("ein paar einzelne, keine Reihe", () => {
    expect(FIRMENMULDEN.length).toBeGreaterThanOrEqual(3);
    expect(FIRMENMULDEN.length).toBeLessThanOrEqual(5);
    // Einzeln: keine zwei näher als 5 m (SW) — sonst wäre es eine Reihe
    for (const a of FIRMENMULDEN) {
      for (const b of FIRMENMULDEN) {
        if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z), `${a.name}/${b.name}`).toBeGreaterThan(5);
      }
    }
  });

  it("jede innerhalb der Mauern", () => {
    for (const o of hindernisse) {
      for (const [x, z] of ecken(o)) {
        expect(x, o.label).toBeGreaterThan(YARD_MIN_X + MAUER);
        expect(x, o.label).toBeLessThan(YARD_MAX_X - MAUER);
        expect(z, o.label).toBeGreaterThan(-HZ + MAUER);
        expect(z, o.label).toBeLessThan(HZ - MAUER);
      }
    }
  });

  it("jede steht in der Hindernisliste, und keine überlappt ein anderes Bauwerk (≥ 0,1 m Luft)", () => {
    const alle = alleHindernisse();
    for (const m of hindernisse) {
      expect(alle.some((o) => o.label === m.label), m.label).toBe(true);
      for (const o of alle) {
        if (o.label.startsWith("Firmenmulde")) continue;
        const luft = Math.max(Math.abs(m.x - o.x) - (m.hw + o.hw), Math.abs(m.z - o.z) - (m.hd + o.hd));
        expect(luft, `${m.label} an ${o.label}`).toBeGreaterThanOrEqual(0.1);
      }
    }
  });

  it("keine Ecke im Schwenkbereich eines Baggerstands oder Verladeplatzes", () => {
    const staende = [BAGGER_STAND, VERLADE_STAND, ...alleAbholPlaetze().map((p) => p.stand)];
    for (const o of hindernisse) {
      for (const [x, z] of ecken(o)) {
        for (const st of staende) {
          expect(Math.hypot(x - st.x, z - st.z), `${o.label} von (${st.x} | ${st.z})`).toBeGreaterThan(SCHWENK_AUSSEN);
        }
      }
    }
  });

  it("weiter als 10 m vom MÜLL-Container", () => {
    const muell = CONFIGS.find((c) => c.label === "MUELL")!;
    expect(muell).toBeDefined();
    for (const o of hindernisse) {
      for (const [x, z] of ecken(o)) {
        expect(Math.hypot(x - muell.x, z - muell.z), o.label).toBeGreaterThan(10);
      }
    }
  });
});

describe("Firmenmulden bauen (E-133, E-184)", () => {
  beforeAll(async () => {
    await initPhysics();
  });

  const bauen = (): { scene: THREE.Scene; world: RAPIER.World } => {
    const scene = new THREE.Scene();
    const world = mitBoden();
    baueFirmenmulden(scene, world);
    return { scene, world };
  };
  /** Welt mit Boden wie `yard.ts` — seit E-184 stehen die Mulden auf ihm, statt fest zu sein. */
  const mitBoden = (): RAPIER.World => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(100, 0.5, 100).setTranslation(0, -0.5, 0),
      world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    );
    return world;
  };
  const netze = (s: THREE.Scene): THREE.Mesh[] => s.children.filter((o) => (o as THREE.Mesh).isMesh) as THREE.Mesh[];

  /*
   * E-184: Jede Mulde ist ein eigener beweglicher Körper und darum ein eigenes
   * Netz (vorher zwei Netze für alle, fest), der Aufkleber hängt als Kind
   * daran und wirft keinen Schatten.
   */
  it("ohne Leinwand: ein Netz je Mulde, keine Aufkleber", () => {
    expect(typeof (globalThis as Record<string, unknown>).document).toBe("undefined");
    const n = netze(bauen().scene);
    expect(n.length).toBe(FIRMENMULDEN.length);
    for (const m of n) expect(m.children.length).toBe(0);
  });

  it("mit Atlas: ein Netz je Mulde mit Körper und Aufkleber, fünf Kollider je Mulde", () => {
    leinwandMitVerlauf();
    const { scene, world } = bauen();
    const n = netze(scene);
    expect(n.map((m) => m.name)).toEqual(FIRMENMULDEN.map((m) => `Firmenmulde ${m.name}`));
    for (const m of n) {
      expect(m.castShadow).toBe(true);
      const logo = m.children[0] as THREE.Mesh;
      expect(logo.castShadow).toBe(false);
      expect((logo.material as THREE.MeshStandardMaterial).map).not.toBeNull();
      // Zwei Aufkleber, je 4 Ecken
      expect(logo.geometry.getAttribute("position").count).toBe(2 * 4);
    }
    let kollider = 0;
    world.forEachCollider(() => kollider++);
    expect(kollider).toBe(FIRMENMULDEN.length * 5 + 1); // + Boden
  });

  it("hebbar (E-184): beweglich, Leermasse einer echten Mulde, weit unter der Traglast", () => {
    const scene = new THREE.Scene();
    const world = mitBoden();
    const koerper = baueFirmenmulden(scene, world);
    expect(koerper.length).toBe(FIRMENMULDEN.length);
    koerper.forEach((b, i) => {
      expect(b.isDynamic(), FIRMENMULDEN[i]!.name).toBe(true);
      expect(b.mass()).toBeCloseTo(FIRMENMULDEN[i]!.leerKg, 3);
      // E-156: die große Maschine hebt bei 8 m Ausladung 5,5 t
      expect(b.mass()).toBeLessThan(5500);
    });
    // Sie stehen ruhig: nach 3 s Physik schlafen alle, keine ist gerutscht
    for (let i = 0; i < 180; i++) world.step();
    koerper.forEach((b, i) => {
      const m = FIRMENMULDEN[i]!;
      expect(Math.hypot(b.translation().x - m.x, b.translation().z - m.z), m.name).toBeLessThan(0.02);
      expect(b.isSleeping(), `${m.name} schläft nicht`).toBe(true);
    });
  });

  it("die Spinne fasst eine Mulde, hebt sie 1,5 m an, und losgelassen steht sie wieder (E-184)", () => {
    const scene = new THREE.Scene();
    const world = mitBoden();
    const koerper = baueFirmenmulden(scene, world);
    const m = FIRMENMULDEN[1]!; // 5 m³ an der Nordmauer
    const b = koerper[1]!;
    for (let i = 0; i < 30; i++) world.step();
    const greifer = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(m.x, m.hoehe + 0.5, m.z)
    );
    const grip = new GripSystem(world, greifer);
    expect(grip.attachBody(b), "die Mulde lässt sich fassen").toBe(true);
    const sensor = new THREE.Vector3();
    for (let i = 0; i < 90; i++) {
      const t = greifer.translation();
      greifer.setNextKinematicTranslation({ x: t.x, y: t.y + 1.5 / 90, z: t.z });
      grip.update(0.8, true, sensor.set(t.x, t.y, t.z), 1 / 60);
      world.step();
    }
    expect(b.translation().y, "sie ist mit hochgekommen").toBeGreaterThan(1.3);
    grip.update(0, false, sensor, 1 / 60); // loslassen
    for (let i = 0; i < 240; i++) {
      grip.update(0, false, sensor, 1 / 60);
      world.step();
    }
    expect(b.isDynamic(), "losgelassen wieder beweglich").toBe(true);
    expect(Math.abs(b.translation().y), "steht wieder auf dem Boden").toBeLessThan(0.05);
    expect(Math.hypot(b.translation().x - m.x, b.translation().z - m.z), "fällt senkrecht").toBeLessThan(0.3);
  });

  it("wird eine Mulde versetzt, wandert ihr Eintrag in der Hindernisliste mit (E-184)", () => {
    const scene = new THREE.Scene();
    const world = mitBoden();
    const koerper = baueFirmenmulden(scene, world);
    const netz = netze(scene)[2]!;
    const m = FIRMENMULDEN[2]!;
    const eintrag = alleHindernisse().find((o) => o.label === `Firmenmulde ${m.name}`)!;
    koerper[2]!.setTranslation({ x: m.x - 3, y: 0, z: m.z + 1 }, true);
    // Die Szene führt die Netze vor jedem Bild nach — hier von Hand ausgelöst
    scene.onBeforeRender(undefined as never, scene, undefined as never, null as never, undefined as never, null as never);
    expect(eintrag.x).toBeCloseTo(m.x - 3, 6);
    expect(eintrag.z).toBeCloseTo(m.z + 1, 6);
    expect(netz.position.x).toBeCloseTo(m.x - 3, 6);
    // zurückstellen, sonst rechnen spätere Wächter mit der versetzten Mulde
    koerper[2]!.setTranslation({ x: m.x, y: 0, z: m.z }, true);
    scene.onBeforeRender(undefined as never, scene, undefined as never, null as never, undefined as never, null as never);
    expect(eintrag.x).toBeCloseTo(m.x, 6);
  });

  it("offener Trog: von oben trifft man den Boden, nicht einen Deckel", () => {
    const { world } = bauen();
    world.step();
    for (const m of FIRMENMULDEN) {
      const treffer = world.castRay(new RAPIER.Ray({ x: m.x, y: 5, z: m.z }, { x: 0, y: -1, z: 0 }), 10, true);
      expect(treffer, m.name).not.toBeNull();
      // Bodenoberkante: Kufe 0,08 + Blech 0,04 — seit E-184 steht die Mulde auf
      // dem Boden und sackt um die Kontakttoleranz ein (gemessen 1,7 mm)
      expect(5 - treffer!.timeOfImpact, m.name).toBeCloseTo(0.12, 2);
    }
  });

  it("die Grundfläche des Baus passt zur Hindernisliste", () => {
    const { scene } = bauen();
    const box = new THREE.Box3();
    for (const n of netze(scene)) box.expandByObject(n); // mit Aufklebern (Kinder)
    const ausdehnung = hindernisse.reduce(
      (b, o) => ({
        x0: Math.min(b.x0, o.x - o.hw), x1: Math.max(b.x1, o.x + o.hw),
        z0: Math.min(b.z0, o.z - o.hd), z1: Math.max(b.z1, o.z + o.hd),
      }),
      { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity }
    );
    // Nichts Gebautes ragt über die verzeichnete Grundfläche hinaus (1 cm Rundung)
    expect(box.min.x).toBeGreaterThanOrEqual(ausdehnung.x0 - 0.01);
    expect(box.max.x).toBeLessThanOrEqual(ausdehnung.x1 + 0.01);
    expect(box.min.z).toBeGreaterThanOrEqual(ausdehnung.z0 - 0.01);
    expect(box.max.z).toBeLessThanOrEqual(ausdehnung.z1 + 0.01);
    expect(box.min.y).toBeGreaterThanOrEqual(-1e-6);
    // Die schräge Stirnwand ragt mit ihrer Blechkante 7 mm über die Oberkante
    expect(box.max.y).toBeLessThanOrEqual(Math.max(...hindernisse.map((o) => o.top)) + 0.01);
  });
});
