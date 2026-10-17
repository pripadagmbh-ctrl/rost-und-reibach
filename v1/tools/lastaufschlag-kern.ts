/**
 * MESSUNG: Wie schlaegt gehaltener Schrott auf? (E-134, 17.10.2026)
 *
 * Patrick: „schrott krach auch wenn ich mit der spinne schrott auf den boden
 * haue ohne loszulassen". Gemessen am echten Bagger (wie `greifzyklus.ts`):
 *   A  Traeger greifen, heben, mit Ausleger UND Stiel voll auf den Beton hauen,
 *      dann 2 s aufgedrueckt halten
 *   B  heben, behutsam absetzen (Ausleger-Taste nur jedes zweite Bild)
 *   B2 heben, nur mit dem Ausleger senken (durchgehend)
 *   C  heben, voll auf einen Haufen loser Kisten hauen
 * Ausgegeben: Senkgeschwindigkeit der Spitze vor dem Kontakt, wie oft
 * `onAufschlag` kam, und wann.
 *
 * Aufruf: npx vite-node tools/lastaufschlag.ts (dieser Kern laeuft auch im Waechter
 * test/lastaufschlag.test.ts)
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { GripSystem } from "../src/physics/gripSystem";
import { initPhysics } from "../src/physics/physicsWorld";

const DT = 1 / 60;

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

export interface Lauf {
  /** je Szene: Aufschlaege (Tempo m/s, aufSchrott) und hoechstes Senktempo */
  szenen: Record<string, { schlaege: { tempo: number; aufSchrott: boolean; bild: number }[]; hoechstAbwaerts: number }>;
}

export async function messe(): Promise<Lauf> {
  leinwandAttrappe();
  await initPhysics();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  const bagger = new Excavator(new THREE.Scene(), world);
  const grip = new GripSystem(world, bagger.grappleBody);
  grip.insideGrapple = (p) => bagger.isInsideGrapple(p);
  grip.krallenKontakte = (b) => bagger.krallenKontakte(b);
  const hart = new Set<number>();
  bagger.clawBlockedBy = (b) => hart.has(b.handle);
  const tasten = new Tasten();
  const sensor = new THREE.Vector3();
  const lauf: Lauf = { szenen: {} };
  let szene = "vorbereiten";
  let bild = 0;
  const neu = (n: string): void => {
    szene = n;
    lauf.szenen[n] = { schlaege: [], hoechstAbwaerts: 0 };
  };
  bagger.onAufschlag = (tempo, aufSchrott) => lauf.szenen[szene]?.schlaege.push({ tempo, aufSchrott, bild });

  const takt = (): void => {
    bagger.update(DT, tasten as never);
    grip.update(bagger.closure, bagger.closing, bagger.getSensorPosition(sensor), DT);
    world.step();
    bagger.carriedCount = grip.grippedCount;
    bagger.carriedMassKg = grip.totalMassKg;
    bagger.grippedHandles.clear();
    for (const b of grip.grippedBodies) bagger.grippedHandles.add(b.handle);
    bild++;
    const s = lauf.szenen[szene];
    if (s) s.hoechstAbwaerts = Math.max(s.hoechstAbwaerts, bagger.spitzeAbwaerts);
  };
  const heben = (): void => {
    tasten.down.clear();
    tasten.down.add("Space");
    tasten.down.add("KeyR");
    for (let i = 0; i < 70; i++) takt();
    tasten.down.delete("KeyR");
    for (let i = 0; i < 40; i++) takt();
  };

  // Wie greifzyklus.ts: senken, Traeger unterlegen, zufassen
  tasten.down.add("KeyF");
  tasten.down.add("KeyG");
  for (let i = 0; i < 260; i++) takt();
  tasten.down.clear();
  for (let i = 0; i < 30; i++) takt();
  const gp = bagger.grappleGroup.position.clone();
  const teil = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(gp.x, 0.17, gp.z));
  world.createCollider(RAPIER.ColliderDesc.cuboid(1.2, 0.15, 0.15).setMass(180), teil);
  hart.add(teil.handle);
  for (let i = 0; i < 40; i++) takt();
  tasten.down.add("Space");
  for (let i = 0; i < 90; i++) takt();
  if (grip.grippedCount === 0) throw new Error("nicht gegriffen");

  // A: voll draufhauen und aufgedrueckt halten
  heben();
  neu("A voll auf Beton, 2 s halten");
  tasten.down.add("KeyF");
  tasten.down.add("KeyG");
  for (let i = 0; i < 90 + 120; i++) takt();
  tasten.down.delete("KeyF");
  tasten.down.delete("KeyG");
  for (let i = 0; i < 60; i++) takt();

  // B: behutsam absetzen
  heben();
  neu("B behutsam absetzen");
  for (let i = 0; i < 600 && !bagger.groundContact.active; i++) {
    if (i % 2 === 0) tasten.down.add("KeyF");
    else tasten.down.delete("KeyF");
    takt();
  }
  tasten.down.delete("KeyF");
  for (let i = 0; i < 60; i++) takt();

  // B2: nur der Ausleger, durchgehend
  heben();
  neu("B2 nur Ausleger gesenkt");
  tasten.down.add("KeyF");
  for (let i = 0; i < 600 && !bagger.groundContact.active; i++) takt();
  for (let i = 0; i < 60; i++) takt();
  tasten.down.delete("KeyF");
  for (let i = 0; i < 30; i++) takt();

  // C: auf losen Schrott
  heben();
  const unten = bagger.grappleGroup.position.clone();
  for (let k = 0; k < 6; k++) {
    const kiste = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(unten.x + (k % 3) * 0.5 - 0.5, 0.25 + Math.floor(k / 3) * 0.5, unten.z)
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.25, 0.25, 0.25).setMass(40), kiste);
  }
  for (let i = 0; i < 60; i++) takt();
  neu("C voll auf losen Schrott");
  tasten.down.add("KeyF");
  tasten.down.add("KeyG");
  for (let i = 0; i < 150; i++) takt();
  tasten.down.delete("KeyF");
  tasten.down.delete("KeyG");
  for (let i = 0; i < 30; i++) takt();
  return lauf;
}

