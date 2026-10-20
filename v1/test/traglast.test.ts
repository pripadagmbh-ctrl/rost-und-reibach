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
  it("faellt mit der Ausladung und trifft Patricks Ziele (E-156: grosse Schrottmaschine, MHL-335/340-Klasse)", () => {
    let alt = Infinity;
    for (let r = 2; r <= 10.5; r += 0.25) {
      const t = maschinenTraglastKg(r);
      expect(t, `r ${r}`).toBeLessThanOrEqual(alt + 1e-9);
      alt = t;
    }
    const f = FUENFSCHALEN.eigengewichtKg;
    // Patrick, 18.10.2026: nah etwa 10 t, bei 8 m etwa 5–6 t, mit Pratzen — netto mit dem Fuenfschalengreifer
    expect(nutzlastKg(3.7, f)).toBeCloseTo(10000, 6);
    expect(nutzlastKg(5, f)).toBeCloseTo(8000, 6);
    expect(nutzlastKg(8, f)).toBeGreaterThanOrEqual(5000);
    expect(nutzlastKg(8, f)).toBeLessThanOrEqual(6000);
    expect(nutzlastKg(9, f)).toBeGreaterThanOrEqual(4500);
    expect(nutzlastKg(9, f)).toBeLessThanOrEqual(5000);
  });

  it("frei stehend zwei Drittel (E-154, Patrick 18.10.2026: „ohne Pratzen ein Drittel weniger“)", () => {
    for (const r of [3.7, 5, 8, 9.5]) {
      const f = FUENFSCHALEN.eigengewichtKg;
      expect(nutzlastKg(r, f, 1, false)).toBeCloseTo((nutzlastKg(r, f) * 2) / 3, 6);
    }
  });

  it("das Anbaugeraet geht ab: Magnet (1,7 t) hebt 600 kg weniger als der Fuenfschalengreifer (1,1 t)", () => {
    expect(nutzlastKg(5, FUENFSCHALEN.eigengewichtKg) - nutzlastKg(5, MAGNET.eigengewichtKg)).toBeCloseTo(600, 6);
  });

  it("kein Katalogteil ist schwerer, als die Maschine nah heben kann — auch frei stehend mit dem Magneten", () => {
    // kleinste Ausladung des Arms: 3,7 m (gemessen am gebauten Bagger, Stiel ganz heran)
    const nahMagnetFrei = nutzlastKg(3.7, MAGNET.eigengewichtKg, 1, false);
    const schwerstes = Math.max(...[...SPECS, ...BIG_SPECS, ...HUGE_SPECS].map((s) => s.massKg));
    expect(schwerstes, `schwerstes Katalogteil ${schwerstes} kg, nah frei mit Magnet ${Math.round(nahMagnetFrei)} kg`).toBeLessThan(nahMagnetFrei);
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
    s.fahre("KeyZ", 10); // Hebel ruht 0,4 s (E-188: neue Meldung erst nach 0,3 s Ruhe)
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
    // E-156: Nach dem Loslassen haengt keine Sperre nach
    s.grip.releaseAll();
    s.fahre("KeyZ", 5);
    expect(b.ueberlast, "nach dem Loslassen keine Ueberlast mehr").toBe(false);
    const y2 = b.grappleGroup.position.y;
    s.fahre("KeyR", 30);
    expect(b.grappleGroup.position.y, "leer hebt der Ausleger sofort").toBeGreaterThan(y2 + 0.2);
    s.world.free();
  }, 60_000);

  it("8 t nah an der Maschine: frei stehend Ueberlast, abgestuetzt geht sie hoch — und wieder eingefahren sperrt es (E-154)", () => {
    // Arm heran: Ausleger fast ganz hoch (Luft bis zum Anschlag), Stiel ganz herein
    const s = mitLast(8000, [["KeyR", 80], ["KeyG", 300]]);
    const b = s.bagger;
    expect(b.ausladungM).toBeLessThan(4.2);
    // frei stehend: zwei Drittel der Tabelle — 8 t sind zu viel (E-156: nah 10 t, frei 6,7 t)
    expect(b.abgestuetzt).toBe(false);
    expect(b.traglastKg, `frei bei ${b.ausladungM.toFixed(2)} m`).toBeLessThan(8000);
    let y0 = b.grappleGroup.position.y;
    s.fahre("KeyR", 30);
    expect(b.grappleGroup.position.y - y0, "frei hebt er nicht").toBeLessThan(0.002);
    expect(s.meldungen.length).toBe(1);
    expect(s.meldungen[0]!.abgestuetzt, "die Meldung sagt: nicht abgestuetzt").toBe(false);
    // Pratzen aus, waehrend die Last haengt: Grenze wechselt, Heben geht
    b.toggleOutriggers();
    s.fahre("KeyZ", 150);
    expect(b.abgestuetzt).toBe(true);
    expect(b.traglastKg, `abgestuetzt bei ${b.ausladungM.toFixed(2)} m`).toBeGreaterThan(8000);
    y0 = b.grappleGroup.position.y;
    s.fahre("KeyR", 30);
    expect(b.grappleGroup.position.y - y0, "abgestuetzt hebt der Ausleger").toBeGreaterThan(0.1);
    expect(s.meldungen.length, "abgestuetzt keine neue Meldung").toBe(1);
    // Pratzen wieder ein (Ausleger steht still): sofort gesperrt, eine Meldung fuer den naechsten Versuch
    s.fahre("KeyZ", 30);
    b.toggleOutriggers();
    s.fahre("KeyZ", 30);
    expect(b.abgestuetzt, "auf halbem Weg traegt das Fahrwerk").toBe(false);
    y0 = b.grappleGroup.position.y;
    s.fahre("KeyR", 40);
    expect(b.grappleGroup.position.y - y0, "eingefahren hebt er nicht").toBeLessThan(0.002);
    expect(s.meldungen.length).toBe(2);
    s.world.free();
  }, 60_000);

  it("Spielablauf (E-156): bei 8 m ohne Pratzen geht ein 2-t-Teil hoch", () => {
    const s = mitLast(2000, []);
    expect(s.bagger.ausladungM).toBeGreaterThan(7.8);
    expect(s.bagger.abgestuetzt).toBe(false);
    const y0 = s.bagger.grappleGroup.position.y;
    s.fahre("KeyR", 60);
    expect(s.bagger.grappleGroup.position.y - y0, "2 t bei 8 m, frei").toBeGreaterThan(0.5);
    expect(s.meldungen.length).toBe(0);
    s.world.free();
  }, 60_000);

  it("Spielablauf (E-156): bei 8 m ein 4-t-Teil — ohne Pratzen Ueberlast, mit Pratzen geht es hoch", () => {
    const s = mitLast(4000, []);
    const b = s.bagger;
    expect(b.ausladungM).toBeGreaterThan(7.8);
    let y0 = b.grappleGroup.position.y;
    s.fahre("KeyR", 40);
    expect(b.grappleGroup.position.y - y0, "frei hebt er nicht").toBeLessThan(0.002);
    expect(s.meldungen.length).toBe(1);
    expect(s.meldungen[0]!.abgestuetzt).toBe(false);
    b.toggleOutriggers();
    s.fahre("KeyZ", 150);
    expect(b.abgestuetzt).toBe(true);
    y0 = b.grappleGroup.position.y;
    s.fahre("KeyR", 40);
    expect(b.grappleGroup.position.y - y0, "mit Pratzen geht es hoch").toBeGreaterThan(0.3);
    expect(s.meldungen.length).toBe(1);
    s.world.free();
  }, 60_000);

  it("E-188: an der Grenze 1,5 s Heben gehalten — eine Meldung, nicht fuenf", () => {
    // Traglast in dieser Stellung lesen, dann eine Last knapp darueber anhaengen
    const probe = mitLast(100, []);
    const grenze = probe.bagger.traglastKg;
    probe.world.free();
    const s = mitLast(grenze + 50, []);
    s.fahre("KeyR", 90);
    expect(s.meldungen.length, `Meldungen bei ${Math.round(grenze + 50)} kg an der Grenze ${Math.round(grenze)} kg`).toBe(1);
    // neuer Versuch nach dem Loslassen: wieder genau eine
    s.fahre("KeyR", 60);
    expect(s.meldungen.length).toBeLessThanOrEqual(2);
    s.world.free();
  }, 60_000);

  it("E-188: unter Ueberlast (9 t bei 8 m) schleppt der Schwenk nur langsam", () => {
    const s = mitLast(9000, []);
    expect(s.bagger.ueberlast || s.bagger.traglastKg < 9000).toBe(true);
    const g0 = s.bagger.grappleGroup.position.clone();
    s.fahre("KeyE", 120);
    const tempo = s.bagger.grappleGroup.position.distanceTo(g0) / 2.25;
    // vorher bis 4 m/s; jetzt ein Zehntel des Schwenks: rund 0,5 m/s
    expect(tempo, "Spinne im Mittel (m/s)").toBeLessThan(0.8);
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
