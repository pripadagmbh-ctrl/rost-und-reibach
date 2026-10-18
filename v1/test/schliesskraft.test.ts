/**
 * WAECHTER FUER DIE SCHLIESSKRAFT (E-112, 22.09.2026).
 *
 * Zwei Fragen, und beide muessen dauerhaft beantwortet bleiben:
 *
 * 1. Zudruecken auf ein Hindernis macht eine Kraft > 0 und GENAU EIN Ereignis;
 *    Zudruecken auf Luft macht keins. Sonst schlaegt der Schaden entweder nie
 *    zu oder in jedem Bild.
 * 2. GEGENPROBE zu Projektregel 2: Greifen, Halten, Loslassen und Werfen
 *    haben sich nicht geaendert. Die vier Zahlen unten sind am Stand VOR der
 *    Schliesskraft gemessen (Vergleichsbaum auf 1cf347f, `tools/greifzyklus.ts`)
 *    und stimmten danach Ziffer fuer Ziffer:
 *
 *      Griffweite    54,5336°
 *      Haltedauer    256 Bilder
 *      Wurfweite     3,1813 m
 *      Pendelwinkel  19,0810°
 *
 *    Wer an der Kraft dreht und eine dieser Zahlen bewegt, hat das Greifen
 *    angefasst — und das darf nur auf ausdruecklichen Wunsch passieren.
 *
 *    Griffweite und Haltedauer gelten bis heute Ziffer fuer Ziffer. Wurfweite
 *    und Pendelwinkel sind seither zweimal absichtlich gewandert (E-115, E-132);
 *    die gueltigen Werte und ihre Herkunft stehen unten im Test.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { GripSystem } from "../src/physics/gripSystem";
import { initPhysics } from "../src/physics/physicsWorld";
import type { GameEvents } from "../src/core/events";

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

interface Stand {
  world: RAPIER.World;
  bagger: Excavator;
  grip: GripSystem;
  tasten: Tasten;
  hart: Set<number>;
  bisse: GameEvents["greifer:zugedrueckt"][];
  takt(): void;
}

beforeAll(async () => {
  leinwandAttrappe();
  await initPhysics();
});

function aufbau(): Stand {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  const bagger = new Excavator(new THREE.Scene(), world);
  const grip = new GripSystem(world, bagger.grappleBody);
  grip.insideGrapple = (p) => bagger.isInsideGrapple(p);
  grip.krallenKontakte = (b) => bagger.krallenKontakte(b);
  const hart = new Set<number>();
  bagger.clawBlockedBy = (b) => hart.has(b.handle);
  const bisse: GameEvents["greifer:zugedrueckt"][] = [];
  bagger.onClawBite = (e) => bisse.push(e);
  const sensor = new THREE.Vector3();
  const s: Stand = {
    world,
    bagger,
    grip,
    tasten: new Tasten(),
    hart,
    bisse,
    takt(): void {
      bagger.update(DT, s.tasten as never);
      grip.update(bagger.closure, bagger.closing, bagger.getSensorPosition(sensor), DT);
      world.step();
      bagger.carriedCount = grip.grippedCount;
      bagger.carriedMassKg = grip.totalMassKg;
      bagger.grippedHandles.clear();
      for (const b of grip.grippedBodies) bagger.grippedHandles.add(b.handle);
    },
  };
  return s;
}

/** Arm senken, bis die offene Spinne aufsitzt. */
function absetzen(s: Stand): void {
  s.tasten.down.add("KeyF");
  s.tasten.down.add("KeyG");
  for (let i = 0; i < 260; i++) s.takt();
  s.tasten.down.clear();
  for (let i = 0; i < 30; i++) s.takt();
}

function traeger(s: Stand): RAPIER.RigidBody {
  const gp = s.bagger.grappleGroup.position;
  const b = s.world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(gp.x, 0.17, gp.z)
  );
  s.world.createCollider(RAPIER.ColliderDesc.cuboid(1.2, 0.15, 0.15).setMass(180), b);
  s.hart.add(b.handle);
  for (let i = 0; i < 40; i++) s.takt();
  return b;
}

describe("Schliesskraft der Spinne", () => {
  it("Zudruecken auf ein Hindernis: Kraft > 0 und genau ein Ereignis", () => {
    const s = aufbau();
    absetzen(s);
    const teil = traeger(s);
    expect(s.bagger.schliesskraftKN).toBe(0); // vor dem Zudruecken nichts
    s.tasten.down.add("Space");
    for (let i = 0; i < 180; i++) s.takt(); // 3 s voller Hebel
    expect(s.bagger.schalenStau).toBeGreaterThan(0);
    expect(s.bagger.schliesskraftKN).toBeGreaterThan(0);
    expect(s.bisse.length).toBe(1);
    const e = s.bisse[0]!;
    expect(e.handle).toBe(teil.handle);
    expect(e.kraftKN).toBeGreaterThan(0);
    expect(e.kraftKN).toBeLessThanOrEqual(Excavator.MAX_SCHLIESSKRAFT_KN);
    const p = teil.translation();
    expect(Math.hypot(e.x - p.x, e.y - p.y, e.z - p.z)).toBeLessThan(0.3);
    s.world.free();
  });

  it("Zudruecken auf Luft: keine Kraft, kein Ereignis", () => {
    const s = aufbau();
    absetzen(s);
    s.tasten.down.add("Space");
    let maxKraft = 0;
    for (let i = 0; i < 180; i++) {
      s.takt();
      maxKraft = Math.max(maxKraft, s.bagger.schliesskraftKN);
    }
    expect(s.bagger.closure).toBe(1); // sie war wirklich ganz zu
    expect(maxKraft).toBe(0);
    expect(s.bisse.length).toBe(0);
    s.world.free();
  });

  it("pumpen statt halten: erst Loslassen macht den zweiten Biss", () => {
    const s = aufbau();
    absetzen(s);
    traeger(s);
    s.tasten.down.add("Space");
    for (let i = 0; i < 180; i++) s.takt();
    expect(s.bisse.length).toBe(1);
    for (let i = 0; i < 120; i++) s.takt(); // weiter halten: nichts Neues
    expect(s.bisse.length).toBe(1);
    s.tasten.down.delete("Space");
    for (let i = 0; i < 30; i++) s.takt();
    s.tasten.down.add("Space");
    for (let i = 0; i < 90; i++) s.takt();
    expect(s.bisse.length).toBe(2);
    s.world.free();
  });

  it("Gegenprobe: Greifen, Halten, Werfen und Pendeln sind unveraendert", () => {
    const s = aufbau();
    absetzen(s);
    const teil = traeger(s);
    s.tasten.down.add("Space");
    let griffweite = -1;
    let haltedauer = 0;
    for (let i = 0; i < 90; i++) {
      s.takt();
      if (griffweite < 0 && s.grip.grippedCount > 0) griffweite = s.bagger.clawSplayMax;
      if (s.grip.grippedCount > 0) haltedauer++;
    }
    s.tasten.down.add("KeyR"); // heben
    for (let i = 0; i < 60; i++) {
      s.takt();
      if (s.grip.grippedCount > 0) haltedauer++;
    }
    s.tasten.down.delete("KeyR");
    s.tasten.down.add("KeyE"); // schwenken — daraus kommt der Pendelausschlag
    let pendel = 0;
    for (let i = 0; i < 120; i++) {
      s.takt();
      pendel = Math.max(pendel, s.bagger.neigung);
      if (s.grip.grippedCount > 0) haltedauer++;
    }
    const los = teil.translation();
    const losX = los.x;
    const losZ = los.z;
    s.tasten.down.delete("Space"); // werfen: mitten im Schwenk loslassen
    for (let i = 0; i < 240; i++) {
      s.takt();
      pendel = Math.max(pendel, s.bagger.neigung);
    }
    s.tasten.down.clear();
    for (let i = 0; i < 120; i++) s.takt();
    const liegt = teil.translation();

    // E-155: Fuenfschalengreifer (Grundausstattung); Sichelkralle war 54,5336°
    expect(griffweite * GRAD).toBeCloseTo(40.9238, 2);
    expect(haltedauer).toBe(256);
    /*
     * ZWEI ZAHLEN SIND AM 22.09.2026 ABSICHTLICH GEWANDERT (E-115): Patrick
     * hat das Pendel freigegeben (`GELENK_STEIFE` 1.0 -> 0.0) und das
     * Loslassen auf `v = v_Gelenk + ω × r` umgestellt.
     *
     *   Wurfweite     3,1813 m  ->  3,6187 m   (+13,7 %)
     *   Pendelwinkel  19,0810°  ->  22,8533°
     *
     * Die zwei DARUEBER sind unveraendert geblieben, Ziffer fuer Ziffer — und
     * genau das war der Zweck dieser Gegenprobe: Am GREIFEN wurde nichts
     * angefasst.
     *
     * UND NOCH EINMAL AM 16.10.2026 (E-132): Patrick will mehr schleudern,
     * die Daempfung des Pendels ging von 0,98 (kritisch) auf 0,4. Gemessen mit
     * `npx vite-node tools/greifzyklus.ts`, alte gegen neue excavator.ts:
     *
     *   Wurfweite     3,6187 m  ->  4,2764 m   (+18,2 %)
     *   Pendelwinkel  22,8533°  ->  36,9631°
     *   Griffweite    54,5336°  ->  54,5336°   (gleich, Greifen unberuehrt)
     *   Haltedauer    256       ->  256        (gleich)
     */
    /*
     * E-155 (18.10.2026): Die Grundausstattung ist der Fuenfschalengreifer —
     * gemessen mit `npx vite-node tools/greifzyklus.ts`, Sichelkralle →
     * Fuenfschalen: Griffweite 54,5336° → 40,9238°, Haltedauer 256 → 256,
     * Wurfweite 4,2764 → 4,4715 m, Pendelwinkel 36,9631° → 37,0428°.
     */
    expect(Math.hypot(liegt.x - losX, liegt.z - losZ)).toBeCloseTo(4.4715, 2);
    expect(pendel * GRAD).toBeCloseTo(37.0428, 2);
    s.world.free();
  });
});
