/**
 * Waechter fuer das Ereignis `wrack:geknautscht` (E-130, 16.10.2026).
 *
 * Das Wrack knautscht wie eine Blechdose (E-128); der Ton dazu haengt an
 * einem Ereignis mit Staerke. Es darf nur kommen, wenn das Wrack wirklich
 * nachgegeben hat: Ein Biss meldet genau einmal, ein Biss auf ein schon
 * flaches Wrack gar nicht — sonst knirscht es, wo nichts mehr nachgibt.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager, CarComposite } from "../src/dismantle/composites";
import { CAR_DEF } from "../src/dismantle/carDef";
import { EventBus, type GameEvents } from "../src/core/events";

/** Voller Biss auf ein Autowrack (E-112), wie in `hohlkoerper.test.ts`. */
const KRAFT_WRACK = 15.7;

function werkbank(): { bus: EventBus; car: CarComposite; meldungen: GameEvents["wrack:geknautscht"][] } {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const items = new ItemManager(scene, world);
  const bus = new EventBus();
  const comps = new CompositeManager(scene, world, items, bus);
  const car = new CarComposite(CAR_DEF, scene, world, items, bus, new THREE.Vector3(0, 0.02, 0), "c");
  comps.cars.push(car);
  const meldungen: GameEvents["wrack:geknautscht"][] = [];
  bus.on("wrack:geknautscht", (e) => meldungen.push(e));
  return { bus, car, meldungen };
}

function biss(bus: EventBus, car: CarComposite): void {
  const p = car.body.translation();
  bus.emit("greifer:zugedrueckt", { handle: car.body.handle, kraftKN: KRAFT_WRACK, x: p.x, y: p.y, z: p.z });
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("wrack:geknautscht (E-130)", () => {
  it("ein Biss meldet genau einmal, mit dem Zuwachs des mittleren Knautschgrads", () => {
    const { bus, car, meldungen } = werkbank();
    biss(bus, car);
    expect(meldungen).toHaveLength(1);
    expect(meldungen[0]!.grad).toBeCloseTo(car.knautschgrad, 6);
    expect(meldungen[0]!.zuwachs).toBeCloseTo(car.knautschgrad, 6); // vorher heil
    expect(meldungen[0]!.zuwachs).toBeGreaterThan(0.05);
    expect(meldungen[0]!.zuwachs).toBeLessThan(0.5);
    expect(meldungen[0]!.handle).toBe(car.body.handle);
  });

  it("die Presse meldet einmal mit grossem Zuwachs; danach meldet ein Biss nichts mehr", () => {
    const { bus, car, meldungen } = werkbank();
    car.pressCrush();
    expect(meldungen).toHaveLength(1);
    expect(meldungen[0]!.zuwachs).toBeGreaterThan(0.9);
    expect(meldungen[0]!.grad).toBeCloseTo(1, 6);
    biss(bus, car);
    expect(meldungen).toHaveLength(1);
  });

  it("ein geladenes, schon geknautschtes Wrack meldet beim naechsten Biss nur den neuen Zuwachs", () => {
    const { bus, car, meldungen } = werkbank();
    car.restoreState({ crushStage: 1, torn: [], brokenWindows: [] });
    expect(meldungen).toHaveLength(0);
    const vorher = car.knautschgrad;
    biss(bus, car);
    expect(meldungen).toHaveLength(1);
    expect(meldungen[0]!.zuwachs).toBeCloseTo(car.knautschgrad - vorher, 6);
  });
});
