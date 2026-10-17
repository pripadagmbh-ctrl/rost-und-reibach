/**
 * WAECHTER E-152: Traglast nach Ausladung und Ueberlastsperre.
 *
 * Patrick, 17.10.2026: „entweder kann ich mehr als 3,5 tonnen heben oder es
 * sollten keine teile über 3,5 tonnen ankommen … hat eh was mit dem winkel zu
 * tun und ein umschlagbagger kann definitiv mehr heben" — und zuvor: „beim
 * heben passiert nichts".
 *
 * Die feste Grenze 3 500 kg ist weg. Was die Maschine hebt, steht in einer
 * Tabelle nach Ausladung und Hoehe (`excavator/traglast.ts`, Herkunft dort).
 * Ist die Last zu schwer, stoppt der Arm Heben und Ausfahren und MELDET das,
 * einmal je Versuch; Absenken und Heranziehen gehen weiter.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { GripSystem } from "../src/physics/gripSystem";
import { setzeGreifer } from "../src/excavator/greiferwahl";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";
import { MAGNET } from "../src/excavator/magnet";
import { ItemManager } from "../src/world/scrapItems";
import { maschinenTraglastKg, nutzlastKg } from "../src/excavator/traglast";
import type { GameEvents } from "../src/core/events";
import { HUGE_SPECS, BIG_SPECS, SPECS } from "../src/world/scrapItems";

const DT = 1 / 60;

beforeAll(async () => {
  leinwandAttrappe();
  await RAPIER.init();
});

describe("Die Tabelle", () => {
  it("faellt mit der Ausladung, in beiden Hoehen, und haelt die Herleitung ein", () => {
    for (const h of [1.5, 2.2, 3, 6]) {
      let alt = Infinity;
      for (let r = 2; r <= 10.5; r += 0.25) {
        const t = maschinenTraglastKg(r, h);
        expect(t, `r ${r} h ${h}`).toBeLessThanOrEqual(alt + 1e-9);
        alt = t;
      }
    }
    // Stuetzstellen: MHL 250 F (6,0 t bei 3,0 m, 2,2 t bei 7,5 m, Hoehe 3 m), gestreckt auf die MHL-320-Klasse
    expect(maschinenTraglastKg(3.0 * (10.4 / 9), 3)).toBeCloseTo(6000 * (21 / 16), 6);
    expect(maschinenTraglastKg(7.5 * (10.4 / 9), 3)).toBeCloseTo(2200 * (21 / 16), 6);
    expect(maschinenTraglastKg(3.0 * (10.4 / 9), 1.5)).toBeCloseTo(5000 * (21 / 16), 6);
    // Auftrag: nah an der Maschine rund 7–8 t, bei 9 m rund 2,5–3 t
    expect(maschinenTraglastKg(3.0, 3)).toBeGreaterThan(7000);
    expect(maschinenTraglastKg(3.0, 3)).toBeLessThan(8000);
    expect(maschinenTraglastKg(9, 3)).toBeGreaterThan(2500);
    expect(maschinenTraglastKg(9, 3)).toBeLessThan(3000);
  });

  it("das Anbaugeraet geht ab: Magnet (1,7 t) hebt 600 kg weniger als der Fuenfschalengreifer (1,1 t)", () => {
    expect(nutzlastKg(5, 3, FUENFSCHALEN.eigengewichtKg) - nutzlastKg(5, 3, MAGNET.eigengewichtKg)).toBeCloseTo(600, 6);
  });

  it("kein Katalogteil ist schwerer, als die Maschine nah an sich heben kann", () => {
    // kleinste Ausladung des Arms: 3,7 m (gemessen am gebauten Bagger, Stiel ganz heran), Hoehe ueber 3 m
    const nahMagnet = nutzlastKg(3.7, 3, MAGNET.eigengewichtKg);
    const schwerstes = Math.max(...[...SPECS, ...BIG_SPECS, ...HUGE_SPECS].map((s) => s.massKg));
    expect(schwerstes, `schwerstes Katalogteil ${schwerstes} kg, nah mit Magnet ${Math.round(nahMagnet)} kg`).toBeLessThan(nahMagnet);
  });
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

/**
 * Bagger mit Fuenfschalengreifer; der Arm wird erst ohne Last in Stellung
 * gebracht (`vorher`: Tasten und Bilder), dann haengt eine Last von `kg` in
 * der Spinne — frei in der Luft, damit kein Bodenanschlag mitspielt.
 */
function mitLast(kg: number, vorher: Array<[string, number]> = [["KeyR", 40]]) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = DT;
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(100, 0.5, 100).setTranslation(0, -0.5, 0), boden);
  const scene = new THREE.Scene();
  const bagger = new Excavator(scene, world);
  const items = new ItemManager(scene, world);
  const grip = new GripSystem(world, bagger.grappleBody);
  setzeGreifer(bagger, grip, FUENFSCHALEN);
  const meldungen: Array<GameEvents["greifer:ueberlast"]> = [];
  bagger.onUeberlast = (e) => meldungen.push(e);
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
  for (let i = 0; i < 10; i++) takt();
  for (const [taste, n] of vorher) {
    tasten.down.add(taste);
    for (let i = 0; i < n; i++) takt();
    tasten.down.clear();
  }
  for (let i = 0; i < 20; i++) takt();
  const g = bagger.grappleGroup.position;
  const it = items.spawnScrap("steel", kg, { kind: "box", dims: [0.9, 0.7, 0.9], color: 0x777777, name: `Prueflast ${kg} kg` }, new THREE.Vector3(g.x, g.y - 2.3, g.z));
  expect(grip.attachBody(it.body)).toBe(true);
  takt();
  const fahre = (taste: string, bilder: number): void => {
    tasten.down.add(taste);
    for (let i = 0; i < bilder; i++) takt();
    tasten.down.delete(taste);
    for (let i = 0; i < 15; i++) takt();
  };
  return { world, bagger, grip, meldungen, fahre };
}

describe("Ueberlast wie an der echten Maschine (EN 474-5)", () => {
  it("6 t weit draussen: Heben und Ausfahren stoppen und melden sich einmal je Versuch; Senken und Heranziehen gehen", () => {
    const s = mitLast(6000);
    const b = s.bagger;
    expect(b.ausladungM, "weit draussen").toBeGreaterThan(7);
    expect(b.ueberlast || b.traglastKg < 6000).toBe(true);
    const y0 = b.grappleGroup.position.y;
    s.fahre("KeyR", 60);
    expect(b.grappleGroup.position.y - y0, "Ausleger hebt nicht").toBeLessThan(0.002);
    expect(s.meldungen.length, "eine Meldung fuer einen Versuch, nicht eine je Bild").toBe(1);
    const m = s.meldungen[0]!;
    expect(m.massKg).toBeCloseTo(6000, -1);
    expect(m.grenzeKg).toBeLessThan(6000);
    expect(m.ausladungM).toBeGreaterThan(7);
    s.fahre("KeyR", 30);
    expect(s.meldungen.length, "neuer Versuch, neue Meldung").toBe(2);
    const r0 = b.ausladungM;
    s.fahre("KeyT", 40);
    expect(b.ausladungM - r0, "Stiel faehrt nicht aus").toBeLessThan(0.002);
    const y1 = b.grappleGroup.position.y;
    s.fahre("KeyF", 30);
    expect(b.grappleGroup.position.y, "Absenken geht").toBeLessThan(y1 - 0.1);
    const r1 = b.ausladungM;
    s.fahre("KeyG", 60);
    expect(b.ausladungM, "Heranziehen geht").toBeLessThan(r1 - 0.5);
    s.world.free();
  }, 60_000);

  it("6 t nah an der Maschine geht hoch", () => {
    // Arm heran: Ausleger fast ganz hoch (Luft bis zum Anschlag), Stiel ganz herein
    const s = mitLast(6000, [["KeyR", 80], ["KeyG", 300]]);
    const b = s.bagger;
    expect(b.ausladungM).toBeLessThan(4.2);
    expect(b.traglastKg, `Traglast bei ${b.ausladungM.toFixed(2)} m`).toBeGreaterThan(6000);
    const y0 = b.grappleGroup.position.y;
    s.fahre("KeyR", 60);
    expect(b.grappleGroup.position.y - y0, "nah hebt der Ausleger").toBeGreaterThan(0.3);
    s.world.free();
  }, 60_000);

  it("leicht (500 kg) weit draussen: keine Sperre, keine Meldung", () => {
    const s = mitLast(500);
    const y0 = s.bagger.grappleGroup.position.y;
    s.fahre("KeyR", 60);
    expect(s.bagger.grappleGroup.position.y - y0).toBeGreaterThan(0.5);
    expect(s.meldungen.length).toBe(0);
    s.world.free();
  }, 60_000);
});
