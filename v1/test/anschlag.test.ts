/**
 * WAECHTER E-157: Jedes Anschlagen klingt — einmal.
 *
 * Patrick, 18.10.2026: „anschlagen soll immer geräusche erzeugen, also auto
 * vor schere oder wand" und „greifer vor lkw container wand".
 *
 * Echter Bagger, echtes Greifsystem. Gezaehlt wird `Excavator.onAnschlag`,
 * der Untergrund kommt aus `anschlagUntergrund` (dieselbe Funktion, die
 * main.ts benutzt).
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { GripSystem } from "../src/physics/gripSystem";
import { setzeGreifer } from "../src/excavator/greiferwahl";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";
import { anschlagUntergrund } from "../src/excavator/aufschlag";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { PressManager, PRESS_CENTER, PRESS_KAMMER } from "../src/world/press";
import { MULDE_STEIN } from "../src/world/containers";

const DT = 1 / 60;
/** Abstand Drehmitte → Spinne in der Startstellung (gemessen 8,09 m) */
const REICH_Z = 8.09;

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

type Ziel = "box" | "presse" | "bordwand" | "container";

interface Meldung {
  untergrund: string;
  tempoMs: number;
  traegt: boolean;
  bild: number;
}

/**
 * Wand mit der Ostflaeche bei x = wandX; die Spinne steht `abstand` m oestlich
 * davon. KeyE schwenkt nach −x, also hinein.
 */
function lauf(ziel: Ziel, opt: { wrack?: boolean; abstand?: number; schwenk?: number; bilder?: number; rotator?: boolean } = {}) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = DT;
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(100, 0.5, 100).setTranslation(0, -0.5, 0), boden);
  const scene = new THREE.Scene();
  const items = new ItemManager(scene, world);
  const comps = new CompositeManager(scene, world, items, new EventBus());
  const abstand = opt.abstand ?? 3.5;
  let wandX = 0;
  let mitte = new THREE.Vector3(abstand, 0, 0);
  const fahrzeuge = new Set<number>();
  if (ziel === "presse") {
    new PressManager(scene, world, items, comps);
    wandX = PRESS_CENTER.x + PRESS_KAMMER.hw + 0.35;
    mitte = new THREE.Vector3(wandX + abstand, 0, PRESS_CENTER.z);
  } else if (ziel === "box") {
    const b = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(-MULDE_STEIN.dicke / 2, 0, 0));
    world.createCollider(RAPIER.ColliderDesc.cuboid(MULDE_STEIN.dicke / 2, 1.5, 6).setTranslation(0, 1.5, 0), b);
  } else if (ziel === "bordwand") {
    // Ladeflaeche mit Bordwand wie die Laster: kinematisch, 2,5 m hoch
    const b = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(-0.05, 0, 0));
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.05, 1.25, 4).setTranslation(0, 1.25, 0), b);
    fahrzeuge.add(b.handle);
  } else {
    // Abrollcontainer: beweglich, 2,4 t, Wand 2,5 m hoch
    const b = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(-1.2, 1.25, 0).setLinearDamping(6));
    world.createCollider(RAPIER.ColliderDesc.cuboid(1.2, 1.25, 3).setMass(2400).setFriction(0.8), b);
  }
  const bagger = new Excavator(scene, world);
  bagger.position.set(mitte.x, 0, mitte.z - REICH_Z);
  const grip = new GripSystem(world, bagger.grappleBody);
  setzeGreifer(bagger, grip, FUENFSCHALEN);
  for (const h of fahrzeuge) bagger.obstacleBodies.add(h);
  const tasten = new Tasten();
  let bild = 0;
  const meldungen: Meldung[] = [];
  bagger.onAnschlag = (e) =>
    meldungen.push({
      untergrund: anschlagUntergrund(e, {
        istWrack: (h) => comps.cars.some((c) => c.body.handle === h),
        istSchrott: (h) => items.items.some((i) => i.body.handle === h),
        stahlPunkt: () => false,
      }),
      tempoMs: e.tempoMs,
      traegt: e.traegt,
      bild,
    });
  const takt = (): void => {
    bagger.update(DT, tasten as never);
    grip.update(bagger.closure, true, bagger.getSensorPosition(new THREE.Vector3()), DT);
    world.step();
    bagger.carriedCount = grip.grippedCount;
    bagger.carriedMassKg = grip.totalMassKg;
    bagger.grippedHandles.clear();
    for (const g of grip.grippedBodies) bagger.grippedHandles.add(g.handle);
    bild++;
  };
  // Spinne auf Wandhoehe absenken (Schalen offen bleiben ueber dem Boden)
  tasten.down.add("KeyF");
  for (let i = 0; i < 25; i++) takt();
  tasten.down.clear();
  for (let i = 0; i < 20; i++) takt();
  if (opt.wrack) {
    const g = bagger.grappleGroup.position;
    const car = comps.spawnCar(new THREE.Vector3(g.x, 0.6, g.z), "pkw", Math.PI / 2);
    expect(grip.attachBody(car.body)).toBe(true);
    takt();
  }
  meldungen.length = 0;
  if (opt.schwenk !== undefined) {
    bagger.touch = { cab: opt.schwenk, stick: 0, boom: 0, rotator: 0, drive: 0, steer: 0, grab: false, grapple: 0 };
  } else tasten.down.add("KeyE");
  for (let i = 0; i < (opt.bilder ?? 180); i++) {
    if (opt.rotator && i % 6 === 0) {
      tasten.wheelDelta = i % 12 === 0 ? 1 : -1;
      bagger.handleDiscreteInput(tasten as never);
      tasten.wheelDelta = 0;
    }
    takt();
  }
  world.free();
  return meldungen;
}

describe("E-157 — Anschlagen klingt, einmal", () => {
  it("Auto in der Spinne gegen Box-Betonwand: genau ein Anschlag, Beton", () => {
    const m = lauf("box", { wrack: true });
    expect(m.length).toBe(1);
    expect(m[0]!.untergrund).toBe("beton");
    expect(m[0]!.traegt).toBe(true);
    expect(m[0]!.tempoMs).toBeGreaterThan(0.8);
  }, 60_000);

  it("Auto in der Spinne gegen die Scherenwand: genau ein Anschlag, Stahl", () => {
    const m = lauf("presse", { wrack: true });
    expect(m.length).toBe(1);
    expect(m[0]!.untergrund).toBe("stahl");
  }, 60_000);

  it("leere Spinne seitlich gegen eine LKW-Bordwand: genau ein Anschlag, Stahl", () => {
    const m = lauf("bordwand", { abstand: 2.2 });
    expect(m.length).toBe(1);
    expect(m[0]!.untergrund).toBe("stahl");
    expect(m[0]!.traegt).toBe(false);
  }, 60_000);

  it("leere Spinne seitlich gegen eine Containerwand: genau ein Anschlag, Stahl", () => {
    const m = lauf("container", { abstand: 2.2 });
    expect(m.length).toBe(1);
    expect(m[0]!.untergrund).toBe("stahl");
  }, 60_000);

  it("langsames Anlehnen bleibt still", () => {
    // Touch-Stick zu einem Zehntel: 3,3 °/s, an der Spitze rund 0,5 m/s
    const m = lauf("box", { wrack: true, schwenk: 0.1, bilder: 900 });
    expect(m.length).toBe(0);
  }, 60_000);

  it("Entlangschrammen (Rotator ruckelt das Auto an der Wand) rattert nicht: hoechstens 4 je Sekunde", () => {
    const m = lauf("box", { wrack: true, rotator: true, bilder: 180 });
    expect(m.length, "3 s an der Wand").toBeLessThanOrEqual(12);
    for (let i = 1; i < m.length; i++) expect(m[i]!.bild - m[i - 1]!.bild, "Abstand in Bildern").toBeGreaterThanOrEqual(9);
  }, 60_000);
});
