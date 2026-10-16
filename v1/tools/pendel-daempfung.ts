/**
 * Pendel ohne Bremse: was macht es beim Anfahren, beim Anhalten, beim
 * Aufschaukeln — und wann steht es wieder still? (E-132, 16.10.2026)
 *
 * Gemessen wird am kopflosen Bagger mit 1/60 s, wie im Spiel:
 *
 *   1. Anfahren 2,5 s Schwenk, dann Hebel los. Hoechster Ausschlag im
 *      Anfahren, Beharrung (Mittel der letzten halben Sekunde), hoechster
 *      Ausschlag nach dem Anhalten, Ruhe (letztes Bild ueber 1 Grad).
 *   2. Aufschaukeln: 15 s lang im Takt der Eigenschwingung hin und her
 *      schwenken — der schlimmste Fall, den ein Spieler absichtlich baut.
 *      Hoechster Ausschlag, schnellster Korb, Ruhe danach.
 *
 * `v Korb` ist die waagerechte Geschwindigkeit des Korbes (Sensorsitz) aus
 * der Positionsdifferenz — das ist, was `releaseAll` einem Teil in der
 * Korbmitte mitgibt.
 *
 * Aufruf: npx vite-node tools/pendel-daempfung.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { GripSystem } from "../src/physics/gripSystem";
import { initPhysics } from "../src/physics/physicsWorld";

const DT = 1 / 60;
const GRAD = 180 / Math.PI;

class Tasten {
  down = new Set<string>();
  wheelDelta = 0;
  orbitDX = 0;
  orbitDY = 0;
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

function aufbau(lastKg: number) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(200, 0.5, 200), boden);
  const bagger = new Excavator(new THREE.Scene(), world);
  const grip = new GripSystem(world, bagger.grappleBody);
  const tasten = new Tasten();
  for (let i = 0; i < 240; i++) {
    bagger.update(DT, tasten as never);
    world.step();
  }
  if (lastKg > 0) {
    const p = korb(bagger);
    const b = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z));
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.1, 0.1, 1.0).setMass(lastKg), b);
    grip.attachBody(b);
  }
  return { world, bagger, grip, tasten };
}
type Stand = ReturnType<typeof aufbau>;

const korbP = new THREE.Vector3();
function korb(bagger: Excavator): THREE.Vector3 {
  return korbP
    .set(0, -bagger.greiferform.sensorSitz, 0)
    .applyQuaternion(bagger.grappleGroup.quaternion)
    .add(bagger.grappleGroup.position);
}

const achse = new THREE.Vector3();
function ausschlag(bagger: Excavator): number {
  achse.set(0, -1, 0).applyQuaternion(bagger.grappleGroup.quaternion);
  return Math.acos(THREE.MathUtils.clamp(-achse.y, -1, 1)) * GRAD;
}

/** Ein Bild wie in `main.ts`; gibt die waagerechte Korbgeschwindigkeit zurueck. */
const vorK = new THREE.Vector3();
function schritt(s: Stand, tasten: string[]): number {
  s.tasten.down.clear();
  for (const t of tasten) s.tasten.down.add(t);
  s.bagger.carriedMassKg = s.grip.totalMassKg;
  s.bagger.grippedHandles.clear();
  for (const b of s.grip.grippedBodies) s.bagger.grippedHandles.add(b.handle);
  vorK.copy(korb(s.bagger));
  s.bagger.update(DT, s.tasten as never);
  s.grip.update(1, true, korb(s.bagger), DT);
  s.world.step();
  const k = korb(s.bagger);
  return Math.hypot(k.x - vorK.x, k.z - vorK.z) / DT;
}

/** Ausschwingen bis 20 s; Ruhe = letztes Bild ueber 1 Grad. */
function ausschwingen(s: Stand): { hoechster: number; ruheS: number } {
  let hoechster = 0;
  let ruhe = 0;
  for (let i = 0; i < 1200; i++) {
    schritt(s, []);
    const a = ausschlag(s.bagger);
    hoechster = Math.max(hoechster, a);
    if (a > 1) ruhe = i + 1;
  }
  return { hoechster, ruheS: ruhe * DT };
}

function anfahren(lastKg: number) {
  const s = aufbau(lastKg);
  let anfahrt = 0;
  let beharr = 0;
  let vKorb = 0;
  for (let i = 0; i < 150; i++) {
    vKorb = Math.max(vKorb, schritt(s, ["KeyQ"]));
    const a = ausschlag(s.bagger);
    anfahrt = Math.max(anfahrt, a);
    if (i >= 120) beharr += a / 30;
  }
  const nach = ausschwingen(s);
  return { anfahrt, beharr, vKorb, nachStopp: nach.hoechster, ruheS: nach.ruheS };
}

/** Im Takt der Eigenschwingung hin und her: T = 2π·sqrt(L/g), L = 1,5 m. */
function aufschaukeln(lastKg: number) {
  const s = aufbau(lastKg);
  const halbT = Math.round((Math.PI * Math.sqrt(1.5 / 9.81)) / DT);
  let hoechster = 0;
  let vKorb = 0;
  for (let i = 0; i < 900; i++) {
    const taste = Math.floor(i / halbT) % 2 === 0 ? "KeyQ" : "KeyE";
    vKorb = Math.max(vKorb, schritt(s, [taste]));
    hoechster = Math.max(hoechster, ausschlag(s.bagger));
  }
  const nach = ausschwingen(s);
  return { hoechster, vKorb, ruheS: nach.ruheS };
}

async function main(): Promise<void> {
  leinwandAttrappe();
  await initPhysics();
  console.log("=== 1. Anfahren 2,5 s, dann Hebel los ===\n");
  console.log("  Last   | Anfahren | Beharrung | v Korb max | nach Stopp | Ruhe nach");
  for (const kg of [0, 900, 5000]) {
    const r = anfahren(kg);
    console.log(
      `  ${String(kg).padStart(4)}kg | ${r.anfahrt.toFixed(1).padStart(6)}°  | ${r.beharr.toFixed(1).padStart(6)}°   | ` +
        `${r.vKorb.toFixed(2).padStart(6)} m/s | ${r.nachStopp.toFixed(1).padStart(7)}°   | ${r.ruheS.toFixed(2).padStart(5)} s`
    );
  }
  console.log("\n=== 2. Aufschaukeln: 15 s im Takt der Eigenschwingung hin und her ===\n");
  console.log("  Last   | hoechster | v Korb max | Ruhe danach");
  for (const kg of [0, 900, 5000]) {
    const r = aufschaukeln(kg);
    console.log(
      `  ${String(kg).padStart(4)}kg | ${r.hoechster.toFixed(1).padStart(6)}°   | ${r.vKorb.toFixed(2).padStart(6)} m/s | ${r.ruheS.toFixed(2).padStart(5)} s`
    );
  }
}

void main();
