/**
 * WAECHTER E-145: Gehaltene Koerper bleiben an Waenden.
 *
 * Patrick, 17.10.2026: „Körper wie autos gehen durch Betonwände oder
 * scherenwände. Das fehlt offensichtlich eine sperre."
 *
 * Ein Wrack in der Spinne ist kinematisch (`GripSystem.attachBody`) — Rapier
 * haelt es an nichts Festem auf. Seit E-145 nimmt der Bagger die Bewegung
 * zurueck, die ein gehaltenes Teil tiefer als 5 cm in Festes druecken wuerde
 * (`ExcavatorCollision.gehaltenesStoesstAn`). Wegschwenken geht immer.
 *
 * Geprueft mit dem echten Bagger, dem echten Greifsystem und einem echten
 * Pkw-Wrack (`CompositeManager.spawnCar`), gegen vier Waende: Box-Betonwand
 * (Betonlego der Mulden, 0,55 m), die Ostwand der echten Presse, die
 * Aussenmauer (Bloecke wie `yard.ts`) und eine Ladeflaechen-Bordwand
 * (kinematisch, wie die Fahrzeuge).
 *
 * GEGENPROBE: derselbe Lauf mit abgeschalteter Sperre muss durchgehen —
 * sonst prueft der Waechter nichts.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { GripSystem } from "../src/physics/gripSystem";
import { setzeGreifer } from "../src/excavator/greiferwahl";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { PressManager, PRESS_CENTER, PRESS_KAMMER, ausdehnung } from "../src/world/press";
import { MULDE_STEIN } from "../src/world/containers";
import { MAUER_STEIN } from "../src/world/yard";

const DT = 1 / 60;
const X = new THREE.Vector3(1, 0, 0);

beforeAll(async () => {
  leinwandAttrappe();
  await RAPIER.init();
});

class Tasten {
  down = new Set<string>();
  wheelDelta = 0;
  shiftHeld = false;
  isDown(c: string): boolean {
    return this.down.has(c);
  }
  wasPressed(): boolean {
    return false;
  }
  mouseHeld(): boolean {
    return false;
  }
  axis(neg: string, pos: string): number {
    return (this.down.has(pos) ? 1 : 0) - (this.down.has(neg) ? 1 : 0);
  }
  endFrame(): void {}
}

/** Abstand Drehmitte → Spinne in der Startstellung (gemessen 8,09 m), Spinne vor dem Bagger in +z */
const REICH_Z = 8.09;

type Wand = "box" | "presse" | "mauer" | "bordwand";

/**
 * Baut die Wand so, dass ihre Ostflaeche bei x = 0 liegt, und gibt den Ort
 * zurueck, an dem die Spinne stehen soll (3,5 m oestlich, also Wagenmitte
 * 3,5 m vor der Wand, Wagennase 1,5 m davor). KeyE schwenkt die Spinne
 * nach −x, also in die Wand.
 */
function baueWand(art: Wand, world: RAPIER.World, scene: THREE.Scene, items: ItemManager, comps: CompositeManager): THREE.Vector3 {
  if (art === "presse") {
    new PressManager(scene, world, items, comps);
    const ost = PRESS_CENTER.x + PRESS_KAMMER.hw + 0.35;
    return new THREE.Vector3(ost + 3.5, 0, PRESS_CENTER.z);
  }
  if (art === "box") {
    const b = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(-MULDE_STEIN.dicke / 2, 0, 0));
    world.createCollider(RAPIER.ColliderDesc.cuboid(MULDE_STEIN.dicke / 2, 1.5, 6).setTranslation(0, 1.5, 0), b);
  } else if (art === "mauer") {
    // drei Reihen Bloecke wie `Yard.buildWalls`, jeder ein eigener Kollider
    const b = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const { laenge: L, hoehe: H, dicke: T } = MAUER_STEIN;
    for (let r = 0; r < 3; r++) {
      for (let z = -6; z <= 6; z += L) {
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(T / 2, H / 2, L / 2).setTranslation(-T / 2, H / 2 + r * H, z),
          b
        );
      }
    }
  } else {
    // Ladeflaeche mit Bordwand wie die Laster: kinematisch, 2,5 m hoch (Pritsche + Bordwand)
    const b = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(-0.05, 0, 0));
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.05, 1.25, 4).setTranslation(0, 1.25, 0), b);
  }
  return new THREE.Vector3(3.5, 0, 0);
}

interface Lauf {
  /** tiefstes Eindringen des Wracks in Festes waehrend des Schwenks (m) */
  tiefMax: number;
  /** wie weit die Spinne beim Wegschwenken zurueckkam (m) */
  zurueck: number;
  /** Wrack noch gehalten? */
  gehalten: boolean;
  /** kleinster Abstand Wagenmitte → Wand waehrend des Schwenks (m) */
  mitteMin: number;
}

function lauf(art: Wand, opt: { sperreAus?: boolean; rotator?: boolean } = {}): Lauf {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = DT;
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(100, 0.5, 100).setTranslation(0, -0.5, 0), boden);
  const scene = new THREE.Scene();
  const bus = new EventBus();
  const items = new ItemManager(scene, world);
  const comps = new CompositeManager(scene, world, items, bus);
  const ziel = baueWand(art, world, scene, items, comps);
  const wandX = ziel.x - 3.5;

  const bagger = new Excavator(scene, world);
  bagger.position.set(ziel.x, 0, ziel.z - REICH_Z);
  const grip = new GripSystem(world, bagger.grappleBody);
  setzeGreifer(bagger, grip, FUENFSCHALEN);
  if (opt.sperreAus) bagger.greifsystem = null;
  const tasten = new Tasten();
  const takt = (): void => {
    bagger.update(DT, tasten as never);
    grip.update(bagger.closure, true, bagger.getSensorPosition(new THREE.Vector3()), DT);
    world.step();
    bagger.carriedCount = grip.grippedCount;
    bagger.carriedMassKg = grip.totalMassKg;
    bagger.grippedHandles.clear();
    for (const g of grip.grippedBodies) bagger.grippedHandles.add(g.handle);
  };
  for (let i = 0; i < 20; i++) takt();

  // Wrack laengs zur Schwenkrichtung unter die Spinne haengen und sofort
  // ankoppeln (vor dem naechsten Schritt, sonst schieben es die Schalen weg).
  // Der Ursprung des Wracks ist seine Unterkante: 0,6 m ueber dem Boden.
  const g = bagger.grappleGroup.position;
  const car = comps.spawnCar(new THREE.Vector3(g.x, 0.6, g.z), "pkw", Math.PI / 2);
  expect(grip.attachBody(car.body), "Wrack angekoppelt").toBe(true);
  takt();

  /*
   * Eindringen unabhaengig von der Sperre gemessen: wie weit die Kollider des
   * Wracks ueber die Wandflaeche (x = wandX) hinausragen. Das Wrack haengt in
   * Wandhoehe (0,6 bis 2,0 m), jede Ueberschreitung ist also ein Stecken.
   */
  const tiefe = (): number => Math.max(0, wandX - ausdehnung(car.body, X).min);
  let tiefMax = 0;
  let mitteMin = Infinity;
  if (opt.rotator) {
    // Rotator um 90° drehen, dann ueber die Spinnenachse in die Wand (das Mausrad, 15° je Raste)
    for (let i = 0; i < 12; i++) {
      tasten.wheelDelta = 1;
      bagger.handleDiscreteInput(tasten as never);
      tasten.wheelDelta = 0;
      takt();
      tiefMax = Math.max(tiefMax, tiefe());
    }
  }
  tasten.down.add("KeyE");
  for (let i = 0; i < 180; i++) {
    takt();
    tiefMax = Math.max(tiefMax, tiefe());
    mitteMin = Math.min(mitteMin, car.body.translation().x - wandX);
  }
  tasten.down.clear();
  for (let i = 0; i < 30; i++) takt();
  const fest = bagger.grappleGroup.position.clone();
  tasten.down.add("KeyQ");
  for (let i = 0; i < 60; i++) takt();
  tasten.down.clear();
  const zurueck = bagger.grappleGroup.position.distanceTo(fest);
  const gehalten = grip.grippedBodies.some((b) => b.handle === car.body.handle);
  world.free();
  if (process.env.MESSEN) console.log(art, opt, { tiefMax, zurueck, mitteMin });
  return { tiefMax, zurueck, gehalten, mitteMin };
}

/**
 * Was „davor" heisst: 5 cm Einfedern sind erlaubt (Vorschlag E-138), dazu der
 * Kontaktabstand, den Rapier beim Auflegen selbst stehen laesst.
 */
const DAVOR_M = 0.06;

describe("E-145 — ein Auto in der Spinne geht nicht durch Waende", () => {
  for (const art of ["box", "presse", "mauer", "bordwand"] as Wand[]) {
    it(`${art}: hineinschwenken bleibt davor, wegschwenken geht`, () => {
      const l = lauf(art);
      expect(l.tiefMax, `${art}: steckt im Bauwerk (m)`).toBeLessThan(DAVOR_M);
      expect(l.gehalten, "das Wrack haengt weiter in der Spinne").toBe(true);
      expect(l.zurueck, `${art}: Spinne kam beim Wegschwenken zurueck (m)`).toBeGreaterThan(0.5);
    }, 60_000);
  }

  it("Rotator: 90° in Rasten gedreht und dann in die Wand geschwenkt — bleibt davor", () => {
    const l = lauf("box", { rotator: true });
    expect(l.tiefMax).toBeLessThan(DAVOR_M);
    expect(l.zurueck).toBeGreaterThan(0.5);
  }, 60_000);

  it("Gegenprobe: ohne Sperre geht das Wrack durch die Box-Wand", () => {
    const l = lauf("box", { sperreAus: true });
    expect(l.tiefMax, "ohne Sperre muss es tief stecken — sonst prueft der Waechter nichts").toBeGreaterThan(0.3);
  }, 60_000);
});
