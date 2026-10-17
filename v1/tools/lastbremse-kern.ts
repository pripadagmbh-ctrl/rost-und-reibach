/**
 * MESSUNG E-152 (b): Was bremst den Bagger bei schweren und grossen Teilen?
 *
 * Patrick, 17.10.2026: „extrem schwere bzw. grosse objekte … verlangsamen
 * den bagger unnatürlich".
 *
 * Echter Bagger (Fuenfschalengreifer, die Vorgabe des Spiels), echtes
 * Greifsystem. Gemessen wird, was der Spieler spuert:
 *   - SCHWENK: mittleres Tempo in 2 s Vollausschlag (°/s) und die Zeit bis
 *     90 % des Endtempos (Anlauf, s).
 *   - HEBEN: wie weit die Spinne in 1 s Ausleger-hoch steigt (m).
 * In vier Lagen: leer in der Luft, mit 1 t und mit 3 t in der Spinne, und
 * auf einem 2,2-t-Seecontainer aufgesetzt (die Spinne liegt am Teil an, hat
 * es aber nicht gefasst).
 *
 *     npx vite-node tools/lastbremse.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { GripSystem } from "../src/physics/gripSystem";
import { initPhysics } from "../src/physics/physicsWorld";
import { ItemManager } from "../src/world/scrapItems";
import { setzeGreifer } from "../src/excavator/greiferwahl";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";

const DT = 1 / 60;

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

export type Lage = "leer" | "1t" | "3t" | "anliegend" | "seitlich";

export interface Bremsmessung {
  lage: Lage;
  /** mittleres Schwenktempo ueber 2 s Vollausschlag (°/s) */
  schwenkGradS: number;
  /** Zeit bis 90 % des hoechsten Schwenktempos (s) */
  anlaufS: number;
  /** Anstieg der Spinne in 1 s Ausleger-hoch (m) */
  hebenM: number;
  /** kleinster Pflugfaktor waehrend der Messung (1 = ungebremst) */
  pflugMin: number;
  /** nur „seitlich": wie weit der Container beim Hineinschwenken geschoben wurde (m) */
  geschobenM: number;
}

function aufbau() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = DT;
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(100, 0.5, 100).setTranslation(0, -0.5, 0), boden);
  const scene = new THREE.Scene();
  const bagger = new Excavator(scene, world);
  const items = new ItemManager(scene, world);
  const grip = new GripSystem(world, bagger.grappleBody);
  grip.insideGrapple = (p) => bagger.isInsideGrapple(p);
  grip.krallenKontakte = (b) => bagger.krallenKontakte(b);
  bagger.clawBlockedBy = (b) => {
    const it = items.itemByBody(b);
    return !it || !items.isCrushable(it);
  };
  setzeGreifer(bagger, grip, FUENFSCHALEN);
  const tasten = new Tasten();
  const sensor = new THREE.Vector3();
  const takt = (): void => {
    bagger.update(DT, tasten as never);
    grip.update(bagger.closure, bagger.closing, bagger.getSensorPosition(sensor), DT);
    world.step();
    items.clampSpeeds(DT);
    bagger.carriedCount = grip.grippedCount;
    bagger.carriedMassKg = grip.totalMassKg;
    bagger.grippedHandles.clear();
    for (const g of grip.grippedBodies) bagger.grippedHandles.add(g.handle);
  };
  return { world, bagger, items, grip, tasten, takt };
}

/**
 * Ein 20-Fuss-Seecontainer als nackter Quader: 2,4 × 2,6 × 4,8 m, 2 200 kg.
 * Bewusst nicht `spawnScrap` — dessen Katalogbau wuerfelt Form und Lage, und
 * die Messung soll Lauf fuer Lauf dieselbe sein.
 */
function containerKoerper(world: RAPIER.World, x: number, z: number): RAPIER.RigidBody {
  const b = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, 1.31, z));
  world.createCollider(RAPIER.ColliderDesc.cuboid(1.2, 1.3, 2.4).setMass(2200).setFriction(0.8), b);
  return b;
}

export async function messeBremse(lage: Lage): Promise<Bremsmessung> {
  leinwandAttrappe();
  await initPhysics();
  const a = aufbau();
  const { world, bagger, items, grip, tasten, takt } = a;
  const b = bagger as unknown as { cabYaw: number; plowFactor: number };
  // Spinne vor und hoch, frei ueber dem Beton (wie grossteil-greifen-kern)
  tasten.down.add("KeyG");
  for (let i = 0; i < 120; i++) takt();
  tasten.down.clear();
  tasten.down.add("KeyR");
  for (let i = 0; i < 40; i++) takt();
  tasten.down.clear();
  for (let i = 0; i < 30; i++) takt();
  const gp = bagger.grappleGroup.position.clone();
  if (lage === "1t" || lage === "3t") {
    // Stahlblock unter die Spinne haengen und ankoppeln (wie ein gefasstes Teil)
    const kg = lage === "1t" ? 1000 : 3000;
    const it = items.spawnScrap(
      "steel",
      kg,
      { kind: "box", dims: [0.8, 0.6, 0.8], color: 0x777777, name: `Prueflast ${kg} kg` },
      new THREE.Vector3(gp.x, gp.y - 2.2, gp.z)
    );
    // sofort ankoppeln, bevor es faellt; die Leertaste bleibt gehalten —
    // ohne „zu" laesst das Greifsystem los
    if (!grip.attachBody(it.body)) throw new Error("Prueflast nicht angekoppelt");
    tasten.down.add("Space");
    for (let i = 0; i < 30; i++) takt();
    if (grip.totalMassKg < kg - 1) throw new Error("Prueflast verloren");
  } else if (lage === "anliegend") {
    // Seecontainer (2,2 t, 2,4 x 2,6 x 4,8 m) unter die Spinne, dann aufsetzen
    containerKoerper(world, gp.x, gp.z);
    for (let i = 0; i < 60; i++) takt();
    tasten.down.add("KeyF");
    tasten.down.add("KeyG");
    for (let i = 0; i < 180; i++) takt();
    tasten.down.clear();
    for (let i = 0; i < 10; i++) takt();
  }
  let container: RAPIER.RigidBody | null = null;
  if (lage === "seitlich") {
    // Spinne absenken, bis die offenen Schalen auf Containerhoehe haengen,
    // dann den Container in die Schwenkbahn stellen (Schwenk E geht nach −x)
    tasten.down.add("KeyF");
    for (let i = 0; i < 70; i++) takt();
    tasten.down.clear();
    for (let i = 0; i < 30; i++) takt();
    const g = bagger.grappleGroup.position;
    container = containerKoerper(world, g.x - 3.0, g.z);
    for (let i = 0; i < 60; i++) takt();
  } else if (lage !== "anliegend") {
    for (let i = 0; i < 10; i++) takt();
  }
  const c0 = container?.translation();
  const cx0 = c0 ? { x: c0.x, z: c0.z } : null;
  let pflugMin = 1;
  // HEBEN: 1 s Ausleger hoch
  const haelt = tasten.down.has("Space");
  const halten = (): void => {
    tasten.down.clear();
    if (haelt) tasten.down.add("Space");
  };
  const y0 = bagger.grappleGroup.position.y;
  tasten.down.add("KeyR");
  for (let i = 0; i < 60; i++) {
    takt();
    pflugMin = Math.min(pflugMin, b.plowFactor);
  }
  halten();
  const hebenM = bagger.grappleGroup.position.y - y0;
  // zurueck in die Ausgangslage: wieder senken, ausrollen
  if (lage === "anliegend") {
    tasten.down.add("KeyF");
    for (let i = 0; i < 90; i++) takt();
    halten();
  }
  for (let i = 0; i < 40; i++) takt();
  // SCHWENK: 2 s Vollausschlag
  const yaw0 = b.cabYaw;
  let alt = yaw0;
  let vMax = 0;
  const v: number[] = [];
  tasten.down.add("KeyE");
  for (let i = 0; i < 120; i++) {
    takt();
    const w = Math.abs(b.cabYaw - alt) / DT;
    alt = b.cabYaw;
    v.push(w);
    vMax = Math.max(vMax, w);
    pflugMin = Math.min(pflugMin, b.plowFactor);
  }
  const traegt = grip.totalMassKg;
  tasten.down.clear();
  if ((lage === "1t" || lage === "3t") && traegt === 0) throw new Error("Prueflast verloren");
  const schwenkGradS = THREE.MathUtils.radToDeg(Math.abs(b.cabYaw - yaw0)) / 2;
  const i90 = v.findIndex((w) => w >= 0.9 * vMax);
  const c1 = container?.translation();
  const geschobenM = cx0 && c1 ? Math.hypot(c1.x - cx0.x, c1.z - cx0.z) : 0;
  world.free();
  return { lage, schwenkGradS, anlaufS: (i90 + 1) * DT, hebenM, pflugMin, geschobenM };
}
