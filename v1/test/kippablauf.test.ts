/**
 * WIE DER KIPPER SEINE BRÜCKE LEERT (E-149) — kopflos, ohne Fahrt.
 *
 * Die eigentliche Messung („wird die Brücke frei, ohne zu schleudern?")
 * steht in `test/kipper.test.ts` und fährt 48 ganze Fuhren. Dieser Wächter
 * hält die Zahlen fest, aus denen die Energierechnung dort entsteht, und
 * dass der Wagen den richtigen Ablauf wählt — beides in Millisekunden.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { KIPP_ABLAUF, KIPP_ABLAUF_SILO, TIP_ANGLE, bedLenFor, type KippAblauf } from "../src/delivery/routes";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { pruefKunde } from "./pruefkunde";
import { festerZufall } from "./kipperlauf";

const grad = (x: number): number => (x * 180) / Math.PI;
/** Höhe des Kippgelenks über dem Boden (m) — `vehicleModel.ts`, `bedGroup.position.y`. */
const GELENK_Y = 1.05;
/** Reibung von Schrott, Regel MAX (`scrapItems.ts`) — gegen sie wird gekippt. */
const SCHROTT_REIBUNG = 2.2;

/** Die Rüttelkurve, wie `vehicles.ts` sie im `tipHold` fährt. */
function ruettel(k: KippAblauf, t: number): number {
  const s = t - k.ruettelAbS;
  const dauer = k.ruettelStoesse / k.ruettelHz;
  return s > 0 && s < dauer ? k.ruettelAmpl * Math.sin(Math.PI * k.ruettelHz * s) ** 2 : 0;
}

/** Höchstes Tempo, das ein Stück aus diesem Ablauf mitnehmen kann (m/s). */
function energiegrenze(k: KippAblauf): number {
  const laenge = bedLenFor("kipper");
  const hoehe = GELENK_Y + laenge * Math.sin(k.winkel);
  const heben = k.tempo * laenge;
  const ruetteln = k.ruettelAmpl * Math.PI * k.ruettelHz * laenge;
  return Math.sqrt(2 * 9.81 * hoehe) + Math.max(heben, ruetteln);
}

describe("Kippablauf (E-149)", () => {
  beforeAll(async () => {
    await initPhysics();
  });

  it("kippt steiler als 58° und so steil, dass die Reibung fast nicht mehr hält", () => {
    expect(grad(KIPP_ABLAUF.winkel)).toBeGreaterThan(58);
    // tan 65° = 2,14: höchstens 5 % unter der Reibung — den Rest löst das Rütteln
    expect(Math.tan(KIPP_ABLAUF.winkel)).toBeGreaterThan(SCHROTT_REIBUNG * 0.95);
    expect(TIP_ANGLE).toBe(KIPP_ABLAUF.winkel);
  });

  it("die Energiegrenze aus dem Kopf von kipper.test.ts stimmt: 48 km/h", () => {
    expect(energiegrenze(KIPP_ABLAUF) * 3.6).toBeCloseTo(47.7, 0);
    // und der alte Ablauf (= Silo) liefert die alte Zahl, 45 km/h
    expect(energiegrenze(KIPP_ABLAUF_SILO) * 3.6).toBeCloseTo(44.8, 0);
  });

  it("die Rüttelkurve beginnt und endet bei null, ohne Sprung, und sinkt nie unter den Endwinkel minus Hub", () => {
    const k = KIPP_ABLAUF;
    expect(k.ruettelStoesse).toBeGreaterThan(0);
    expect(Number.isInteger(k.ruettelStoesse)).toBe(true);
    const dauer = k.ruettelAbS + k.ruettelStoesse / k.ruettelHz;
    const dt = 1 / 60;
    let vorher = 0;
    let groessterSchritt = 0;
    for (let t = 0; t <= dauer + 0.5; t += dt) {
      const r = ruettel(k, t);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(k.ruettelAmpl + 1e-12);
      groessterSchritt = Math.max(groessterSchritt, Math.abs(r - vorher));
      vorher = r;
    }
    expect(vorher, "nach dem Rütteln steht die Brücke wieder auf dem Endwinkel").toBe(0);
    // je Bild höchstens π·f·A·dt — die Kurve hat keinen Sprung
    expect(groessterSchritt).toBeLessThanOrEqual(Math.PI * k.ruettelHz * k.ruettelAmpl * dt + 1e-9);
    // Vorderkante beim Rütteln höchstens 2 m/s (6 m vom Gelenk)
    expect(k.ruettelAmpl * Math.PI * k.ruettelHz * bedLenFor("kipper")).toBeLessThan(2.0);
  });

  it("GEGENPROBE: eine Kurve, die mitten im Stoß aufhört, fällt auf", () => {
    const halb: KippAblauf = { ...KIPP_ABLAUF, ruettelStoesse: 0.5 };
    // bei einem halben Stoß endet sie oben, nicht bei null
    const t = halb.ruettelAbS + halb.ruettelStoesse / halb.ruettelHz - 1e-6;
    expect(ruettel(halb, t)).toBeGreaterThan(halb.ruettelAmpl * 0.99);
  });

  it("im Silo kippt er wie vor E-149: 58°, 2,2 s, kein Rütteln", () => {
    expect(grad(KIPP_ABLAUF_SILO.winkel)).toBeCloseTo(58, 6);
    expect(KIPP_ABLAUF_SILO.haltS).toBe(2.2);
    expect(KIPP_ABLAUF_SILO.ruettelStoesse * KIPP_ABLAUF_SILO.ruettelAmpl).toBe(0);
    expect(KIPP_ABLAUF_SILO.tempo).toBe(KIPP_ABLAUF.tempo);
  });

  it("der Wagen wählt: Abladeplatz steil mit Rütteln, Lagersilo wie früher", () => {
    const ablaufFuer = (sortenrein: string | null): KippAblauf => {
      const zurueck = festerZufall(7);
      try {
        const scene = new THREE.Scene();
        const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
        const items = new ItemManager(scene, world);
        const m = new VehicleManager(scene, world, items, new CompositeManager(scene, world, items, new EventBus()));
        m.spawnNow("kipper", pruefKunde({ fuellgrad: 0.6, sortenrein, vehicle: "kipper", aufbau: "flach" }));
        const v = (m as unknown as { active: { ablauf: KippAblauf } }).active;
        return v.ablauf;
      } finally {
        zurueck();
      }
    };
    expect(ablaufFuer(null)).toBe(KIPP_ABLAUF);
    expect(ablaufFuer("alu")).toBe(KIPP_ABLAUF_SILO);
  });
});
