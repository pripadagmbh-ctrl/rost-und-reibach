/**
 * AUFBAU UND NEUSTART EINER AUFGABE OHNE NEULADEN (E-162).
 *
 * `baueAufgabe` legt hin, was die Daten nennen; `raeumeAuf` nimmt beim ↻
 * alles wieder weg, was nicht zum Grundbestand gehoert — auch, was waehrend
 * der Aufgabe entstanden ist (abgerissene Teile, Presspakete). Geprueft an
 * einer echten Rapier-Welt, mit den echten Mulden: Danach ist nur noch der
 * Grundbestand da, die Zonen-Zaehlung hat die entfernten Teile vergessen, und
 * die Aufgabe laesst sich gleich wieder bauen.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { ContainerManager } from "../src/world/containers";
import { EventBus, type GameEvents } from "../src/core/events";
import { CHALLENGES } from "../src/challenges/katalog";
import {
  aufbauKonflikte,
  baueAufgabe,
  formAusSpec,
  grundbestandVon,
  raeumeAuf,
  teilSpec,
} from "../src/challenges/aufbau";
import type { ChallengeDaten } from "../src/challenges/challenge";

beforeAll(async () => {
  leinwandAttrappe();
  await RAPIER.init();
});

function welt() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(100, 0.5, 100).setTranslation(0, -0.5, 0),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  );
  const scene = new THREE.Scene();
  const bus = new EventBus();
  const items = new ItemManager(scene, world);
  const composites = new CompositeManager(scene, world, items, bus);
  const containers = new ContainerManager(scene, world, bus);
  return { world, scene, bus, items, composites, containers };
}

describe("Aufbau: Daten", () => {
  it("jede Aufgabe im Katalog ist baubar — bekannte Teile, nichts ueberlappt", () => {
    for (const c of CHALLENGES) expect(aufbauKonflikte(c), c.id).toEqual([]);
  });

  it("GEGENPROBE: unbekanntes Teil und Ueberlappung werden gemeldet, baueAufgabe weigert sich", () => {
    const kaputt: ChallengeDaten = {
      ...CHALLENGES[0]!,
      aufbau: {
        teile: [
          { name: "Kupfer-Boiler", x: 0, z: 0 },
          { name: "Kupfer-Boiler", x: 0.5, z: 0 },
          { name: "Gibt es nicht", x: 9, z: 9 },
        ],
        wracks: [{ art: "pkw", x: 2, z: 0 }],
      },
    };
    const f = aufbauKonflikte(kaputt);
    expect(f.some((x) => x.includes("Gibt es nicht"))).toBe(true);
    expect(f.filter((x) => x.includes("ueberlappt")).length).toBeGreaterThanOrEqual(2);
    const w = welt();
    expect(() => baueAufgabe(kaputt, w)).toThrow(/ueberlappt/);
    expect(w.items.items, "trotz Fehler etwas gebaut").toHaveLength(0);
  });

  it("die Teile kommen mit ihrer Katalog-Form: Bau, Name, Fraktion", () => {
    const w = welt();
    const o = baueAufgabe(CHALLENGES[0]!, w);
    const s = teilSpec("Kupfer-Boiler")!;
    expect(o.teile).toHaveLength(1);
    expect(o.teile[0]!.materialId).toBe("copper");
    expect(o.teile[0]!.massKg).toBe(s.massKg);
    expect(o.teile[0]!.shape).toMatchObject({ kind: s.kind, dims: s.dims, bau: s.bau, name: s.name });
    expect(formAusSpec(s).bau).toBe("tank");
    // kein Kontakt mit dem Boden im ersten Schritt, danach liegt er still
    expect(o.teile[0]!.body.translation().y).toBeGreaterThan(0.69);
    w.items.settle(w.world);
    const y = o.teile[0]!.body.translation().y;
    expect(y, "liegt nicht auf dem Boden").toBeLessThan(0.45);
    expect(y).toBeGreaterThan(0.3);
  });
});

describe("Neustart ohne Neuladen: raeumeAuf", () => {
  it("nach dem Raeumen ist nur der Grundbestand da — auch Abrissteile, Pakete und Wracks sind weg", () => {
    const w = welt();
    // Grundbestand: drei Teile und ein Wrack weit draussen
    const s = teilSpec("Kupfer-Boiler")!;
    for (let i = 0; i < 3; i++) w.items.spawnScrap(s.materialId, s.massKg, formAusSpec(s), new THREE.Vector3(30 + i * 2, 0.8, 30));
    w.composites.spawnCar(new THREE.Vector3(30, 0.5, 40));
    w.items.settle(w.world);
    const grund = grundbestandVon(w);
    const koerper0 = w.world.bodies.len();
    const items0 = w.items.items.map((i) => i.id).sort();
    const autos0 = w.composites.cars.map((c) => c.body.handle);

    // Beide Aufgaben auf einmal: Teil und Wrack
    const a = baueAufgabe(CHALLENGES[0]!, w);
    const b = baueAufgabe(CHALLENGES[1]!, w);
    w.items.settle(w.world);
    expect(b.wracks).toHaveLength(1);
    // Was waehrend der Aufgabe entsteht: ein Abrissteil, ein Presspaket
    expect(b.wracks[0]!.tearPart("engine"), "kein Motor zum Abreissen").not.toBeNull();
    w.items.spawnBale("steel", 300, new THREE.Vector3(-20, 1, 20));
    // Das Kupferteil liegt in der Box BUNT + VA und ist gezaehlt
    const teil = a.teile[0]!;
    teil.body.setTranslation({ x: -7.6, y: 0.4, z: -19.8 }, true);
    w.containers.recount(w.items, new Set());
    const box = w.containers.byId("r_bunt");
    expect(box.itemIds.has(teil.id)).toBe(true);
    expect(box.contentKg).toBe(s.massKg);

    const verlassen: Array<GameEvents["itemLeft"]> = [];
    w.bus.on("itemLeft", (e) => verlassen.push(e));
    const weg = raeumeAuf(grund, w);
    expect(weg.wracks).toBe(1);
    expect(weg.teile, "Kupferteil, Motor, Paket").toBe(3);
    expect(w.items.items.map((i) => i.id).sort()).toEqual(items0);
    expect(w.composites.cars.map((c) => c.body.handle)).toEqual(autos0);
    expect(w.world.bodies.len(), "ein Koerper ist uebrig oder einer zu viel geloescht").toBe(koerper0);
    expect(teil.body.isValid()).toBe(false);

    // Die Zonen-Zaehlung vergisst das entfernte Teil — ohne dass sich sonst etwas bewegt
    w.containers.recount(w.items, new Set());
    expect(box.itemIds.size).toBe(0);
    expect(box.contentKg).toBe(0);
    expect(verlassen).toContainEqual({ itemId: teil.id, containerId: "r_bunt" });
    // das Wrack und sein Motor standen in der Stahlhalde (Platz des zweiten Startautos)
    expect(verlassen.filter((e) => e.containerId === "c_steel")).toHaveLength(2);
    for (const e of verlassen) expect(grund.items.has(e.itemId), "Grundbestand als verlassen gemeldet").toBe(false);
    // und meldet jedes nur einmal
    const n = verlassen.length;
    w.containers.recount(w.items, new Set());
    expect(verlassen).toHaveLength(n);

    // Gleich wieder bauen: geht, und die Welt laeuft weiter
    const neu = baueAufgabe(CHALLENGES[0]!, w);
    const neu2 = baueAufgabe(CHALLENGES[1]!, w);
    expect(neu.teile[0]!.body.isValid()).toBe(true);
    expect(neu.teile[0]!.id, "die alte ID kam wieder").not.toBe(teil.id);
    expect(neu2.wracks[0]!.body.isValid()).toBe(true);
    for (let i = 0; i < 60; i++) w.world.step();
    const p = neu.teile[0]!.body.translation();
    expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
    expect(w.world.bodies.len()).toBe(koerper0 + 2);
    // und der Grundbestand ist unberuehrt
    for (const id of grund.items) expect(w.items.items.some((i) => i.id === id)).toBe(true);
    w.world.free();
  });

  it("ein gepresstes (schon entsorgtes) Aufgaben-Wrack bringt raeumeAuf nicht durcheinander", () => {
    const w = welt();
    const grund = grundbestandVon(w);
    const b = baueAufgabe(CHALLENGES[1]!, w);
    // so entsorgt die Presse ein Wrack (`press.ts`): Karosse weg, Item ohne Koerper raus
    const it = w.items.itemByBody(b.wracks[0]!.body)!;
    w.composites.despawnByBody(b.wracks[0]!.body);
    w.items.remove(it, false);
    w.items.spawnBale("mixed", 900, new THREE.Vector3(-8, 1, -26));
    const weg = raeumeAuf(grund, w);
    expect(weg).toEqual({ teile: 1, wracks: 0 });
    expect(w.items.items).toHaveLength(0);
    expect(w.composites.cars).toHaveLength(0);
    w.world.free();
  });
});
