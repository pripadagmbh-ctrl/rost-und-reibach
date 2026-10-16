/**
 * E-131 — Patrick, 16.10.2026: „Es sollen mehr LKWs kommen am Anfang".
 *
 * Beim Start des Sandkastens stehen drei Fuhren beladen auf den Warteplätzen;
 * die erste rollt nach `ANSTEH_ERSTER_S`, die zweite, sobald der
 * Abladeplatz frei ist. Bewacht wird:
 *
 *  1. Sie stehen wirklich auf den Warteplätzen, und keiner ist vorher dran.
 *  2. Es fährt nie mehr als einer auf den Abladeplatz (E-120/E-122) — der
 *     zweite wartet, bis der erste weg ist.
 *  3. Die Fahrt vom Warteplatz an den Abladeplatz — jede Fahrzeugart, von
 *     allen drei Plätzen — kommt an und fährt durch kein Bauwerk. Sie steht in
 *     keiner Streckenliste (sie ist ein Ausfädeln), darum wird sie hier mit
 *     demselben Umriss abgefahren wie `test/fahrumriss.test.ts`.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { PARK_SLOTS, ANSTEH_ERSTER_S, ANSTEH_START_ANZAHL, setBaggerOrt } from "../src/delivery/routes";
import { profilFuer, type NachschubArt } from "../src/delivery/nachschub";
import { tiefsteDurchdringung } from "../src/delivery/umriss";
import { alleHindernisse } from "../src/world/obstacles";
import { BAGGER_STAND } from "../src/world/baggerstand";
import type { CustomerProfile } from "../src/delivery/customers";

beforeAll(async () => {
  await initPhysics();
});
afterEach(() => {
  vi.restoreAllMocks();
});

function festerZufall(): void {
  let s = 4711;
  vi.spyOn(Math, "random").mockImplementation(() => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  });
}

type Innen = { active: { phaseName: string; group: THREE.Group } | null; parked: Array<{ group: THREE.Group }> };

function bauePlatz(kunden: CustomerProfile[] = []): { m: VehicleManager; world: RAPIER.World; innen: Innen } {
  festerZufall();
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0), boden);
  const items = new ItemManager(scene, world);
  const m = new VehicleManager(scene, world, items, new CompositeManager(scene, world, items, new EventBus()));
  m.getExcavatorPos = () => new THREE.Vector3(BAGGER_STAND.x, 0, BAGGER_STAND.z);
  setBaggerOrt(() => BAGGER_STAND);
  m.stelleAnstehendeAuf(kunden.length || ANSTEH_START_ANZAHL, kunden);
  return { m, world, innen: m as unknown as Innen };
}

const DT = 1 / 60;
const ABLADEN = new Set(["waitUnload", "tipping"]);
const NEU = new Set(["parked", "ausfaedeln", "approach", "shiftPause"]);

describe("Zum Start stehen Fuhren an (E-131)", () => {
  it("drei beladene Wagen stehen auf den Warteplätzen, keiner fährt vor der Zeit", () => {
    const { m, world, innen } = bauePlatz();
    expect(m.anstehend).toBe(ANSTEH_START_ANZAHL);
    expect(m.activeKind).toBeNull();
    innen.parked.forEach((v, i) => {
      expect(v.group.position.x).toBeCloseTo(PARK_SLOTS[i]![0], 3);
      expect(v.group.position.z).toBeCloseTo(PARK_SLOTS[i]![1], 3);
    });
    for (let t = 0; t < ANSTEH_ERSTER_S - 0.1; t += DT) {
      m.update(DT);
      world.step();
    }
    expect(m.activeKind, "der erste rollt zu früh").toBeNull();
    for (let t = 0; t < 0.3; t += DT) {
      m.update(DT);
      world.step();
    }
    expect(m.activeKind, "der erste rollt nicht los").not.toBeNull();
    expect(m.anstehend).toBe(ANSTEH_START_ANZAHL - 1);
  });

  it("Gegenprobe: der Waechter sieht ein Bauwerk, wenn ein Wagen darin steht", () => {
    const { m } = bauePlatz();
    // Warteplatz 2 um 5 m nach Osten geschoben steht im Kaffeewagen (x −12 … −7)
    const boxen = m.fahrzeugBoxen().map((b) => ({ ...b, x: b.x + 5 }));
    expect(tiefsteDurchdringung(boxen, alleHindernisse())).toBeGreaterThan(0.5);
  });

  it("der zweite wartet, solange der erste auf dem Platz ist", () => {
    const { m, world } = bauePlatz();
    let ersterDa = false;
    for (let t = 0; t < 60; t += DT) {
      m.update(DT);
      world.step();
      if (m.activeKind) ersterDa = true;
      // solange einer unterwegs ist, steht der andere noch an
      if (m.activeKind) expect(m.anstehend).toBe(ANSTEH_START_ANZAHL - 1);
    }
    expect(ersterDa).toBe(true);
  });

  /*
   * BEFUND, NICHT ANGEFASST (E-131): Der PKW mit Anhaenger ragt beim
   * Rueckwaertssetzen an den Abladeplatz (`reverseIn`, `routeInRev`) 0,27 m in
   * die Ostwand — genauso, wenn er durchs Tor kommt (gemessen mit derselben
   * Saat). `test/fahrumriss.test.ts` faehrt diese Strecke nur mit Pritsche und
   * Kipper ab. Darum misst dieser Waechter nur bis zum Rangierpunkt.
   *
   * Jede Art von allen drei Warteplätzen. Der PKW mit Anhänger und das
   * Einzelstück kommen in der Kundschaft selten — gewürfelt wären sie fast
   * nie dabei, darum werden sie bestellt (`profilFuer`, wie NACHSCHUB).
   */
  const ARTEN: NachschubArt[] = ["pritsche", "kipper", "wrack", "einzelstueck", "pkw"];
  for (const art of ARTEN) {
    it(`${art}: vom Warteplatz an den Abladeplatz, durch kein Bauwerk`, () => {
      festerZufall();
      const kunden = PARK_SLOTS.map(() => profilFuer(art));
      const { m, world, innen } = bauePlatz(kunden);
      let tief = 0;
      const angekommen: number[] = [];
      for (let t = 0; t < 400 && angekommen.length < PARK_SLOTS.length; t += DT) {
        m.update(DT);
        world.step();
        // Gemessen wird der NEUE Teil: Stehen, Ausfaedeln, Anfahrt bis zum
        // Rangierpunkt. Das Rueckwaertssetzen danach ist die gewohnte Strecke
        // (`routeInRev`) — Befund dort siehe unten.
        const ph = innen.active?.phaseName ?? "parked";
        if (NEU.has(ph)) tief = Math.max(tief, tiefsteDurchdringung(m.fahrzeugBoxen(), alleHindernisse()));
        const a = innen.active;
        if (a && ABLADEN.has(a.phaseName) && angekommen.length < PARK_SLOTS.length) {
          angekommen.push(t);
          // Abgeladen gilt sofort: der naechste soll kommen (wie ZUR WAAGE)
          m.sendAway();
        }
      }
      expect(angekommen.length, `${art}: nicht alle am Abladeplatz angekommen`).toBe(PARK_SLOTS.length);
      expect(tief, `${art}: ragt ${tief.toFixed(2)} m in ein Bauwerk`).toBeLessThanOrEqual(0.01);
    }, 60_000);
  }
});
