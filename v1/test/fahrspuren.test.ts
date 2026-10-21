/**
 * E-192 — Patrick, 21.10.2026: „Fahrspuren müssen frei bleiben, der
 * Zulieferer bleibt stecken an der Waage. Sortenreine lkws fahren zur
 * entsprechenden Mulde, muss Platz für Bagger bleiben und gute
 * Erreichbarkeit. Gilt auch für alle abholplätze."
 *
 * Gemessen, bevor etwas geändert wurde (Bericht E-192): In 100 Anlieferungen
 * blieb keine an der Waage hängen. Was einen Laster stehen lässt, war:
 *  - der Platz ist voll (`JAM_KG`): die Einfahrt macht zu, wer am Tor
 *    ansteht, wartet — ohne dass der Sandkasten es sagte;
 *  - der Bagger in der Spur: nach 35 s fuhr der Laster durch ihn HINDURCH
 *    und danach an jedem Hindernis vorbei (`gaveUpWaiting` blieb stehen);
 *  - ein versetzter Container in der Spur: der Laster wartet für immer, stumm.
 * Die Wächter hier halten die Antworten darauf fest.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { BAGGER_STAND } from "../src/world/baggerstand";
import { routeApproach, bayApproach, WAAGE_HALT } from "../src/delivery/routes";
import { lagerMuldeFuer } from "../src/world/containers";
import { setBuildingObstacles } from "../src/world/obstacles";
import { rollAnlieferung } from "../src/delivery/customers";

const DT = 1 / 60;

beforeAll(async () => {
  await initPhysics();
});
afterEach(() => {
  vi.restoreAllMocks();
  setBuildingObstacles([]);
});

function festerZufall(seed: number): void {
  let s = seed;
  vi.spyOn(Math, "random").mockImplementation(() => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  });
}

function bauePlatz(seed = 192) {
  festerZufall(seed);
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0), boden);
  const items = new ItemManager(scene, world);
  const composites = new CompositeManager(scene, world, items, new EventBus());
  const m = new VehicleManager(scene, world, items, composites);
  m.vollFaehrtLos = true;
  m.sandkastenAbholer = true;
  m.acceptDeliveries = false;
  const bagger = new THREE.Vector3(BAGGER_STAND.x, 0, BAGGER_STAND.z);
  m.getExcavatorPos = () => bagger;
  const meldungen: string[] = [];
  m.onMeldung = (t) => meldungen.push(t);
  const takt = (): void => {
    m.update(DT);
    items.clampSpeeds(DT);
    world.step();
    composites.update();
  };
  return { m, items, composites, world, bagger, meldungen, takt };
}

type Platz = ReturnType<typeof bauePlatz>;
const aktiv = (p: Platz): { phaseName: string; group: THREE.Group } | null =>
  (p.m as unknown as { active: { phaseName: string; group: THREE.Group } | null }).active;

describe("E-192 — der Bagger wird nie durchfahren", () => {
  it("steht er in der Spur, wartet der Laster, hupt, und das Büro sagt es — auch nach 2 Minuten", () => {
    const p = bauePlatz();
    let hupen = 0;
    p.m.onHonk = () => hupen++;
    // Mitten auf die Anfahrt zum Abladeplatz
    const r = routeApproach();
    const [bx, bz] = r[Math.floor(r.length * 0.6)]!;
    p.bagger.set(bx, 0, bz);
    p.m.spawnNow("pritsche");
    let naechste = Infinity;
    for (let i = 0; i < 60 * 180; i++) {
      p.takt();
      const a = aktiv(p);
      if (a) naechste = Math.min(naechste, Math.hypot(a.group.position.x - bx, a.group.position.z - bz));
    }
    expect(naechste, "der Laster ist in den Bagger gefahren").toBeGreaterThan(4);
    expect(aktiv(p)?.phaseName).toBe("approach");
    expect(hupen).toBeGreaterThanOrEqual(1);
    expect(p.meldungen).toContain("Büro an Bagger: Der Laster kommt nicht vorbei — Bagger aus der Fahrspur, bitte.");
    // Bagger weg — er fährt weiter
    p.bagger.set(BAGGER_STAND.x, 0, BAGGER_STAND.z);
    for (let i = 0; i < 60 * 120 && aktiv(p)?.phaseName === "approach"; i++) p.takt();
    expect(aktiv(p)?.phaseName, "er ist nach dem Wegfahren des Baggers nicht weitergefahren").not.toBe("approach");
  });

  it("ein versetzter Container in der Spur: Der Laster wartet, und das Büro nennt ihn", () => {
    const p = bauePlatz();
    const r = routeApproach();
    const [cx, cz] = r[Math.floor(r.length * 0.5)]!;
    setBuildingObstacles([{ x: cx, z: cz, hw: 1.25, hd: 2.25, top: 1.4, label: "MUELL" }]);
    p.m.spawnNow("pritsche");
    for (let i = 0; i < 60 * 90; i++) p.takt();
    expect(p.meldungen).toContain("Büro an Bagger: Der Laster kommt nicht weiter — MUELL steht im Weg.");
  });
});

describe("E-192 — sortenreine Fuhren ins Silo warten, solange der Bagger in der Silogasse steht", () => {
  it("die Kupferfuhre kommt erst, wenn der Bagger draußen ist — und das Büro sagt warum", () => {
    const p = bauePlatz();
    const silo = lagerMuldeFuer("copper")!;
    const gasse = bayApproach(silo);
    const [gx, gz] = gasse[gasse.length - 1]!;
    p.bagger.set(gx, 0, gz);
    let kunde = rollAnlieferung();
    for (let i = 0; i < 4000 && !(kunde.sortedMaterial === "copper" && kunde.vehicle === "kipper"); i++) kunde = rollAnlieferung();
    p.m.spawnNow("kipper", kunde);
    expect(p.m.activeKind, "er ist trotz Bagger in der Gasse losgefahren").toBeNull();
    expect(p.meldungen).toContain("Büro an Bagger: Kipper mit Kupfer wartet am Tor — der Bagger steht in der Silogasse.");
    for (let i = 0; i < 60 * 5; i++) p.takt();
    expect(p.m.activeKind).toBeNull();
    p.bagger.set(BAGGER_STAND.x, 0, BAGGER_STAND.z);
    p.takt();
    expect(p.m.activeKind, "nach dem Wegfahren kam er nicht").toBe("kipper");
  });
});

describe("E-192 — der volle Platz wird angesagt", () => {
  it("Einfahrt zu und wieder auf: je eine Zeile, beim Start keine", () => {
    const p = bauePlatz();
    p.m.acceptDeliveries = true;
    p.takt();
    p.m.acceptDeliveries = false;
    p.takt();
    p.takt();
    p.m.acceptDeliveries = true;
    p.takt();
    expect(p.meldungen).toEqual([
      "Büro an Bagger: Der Platz ist voll — neue Fuhren warten am Tor, bis aufgeräumt ist.",
      "Büro an Bagger: Platz wieder frei — die nächste Fuhre kommt.",
    ]);
  });
});

describe("E-192 — 50 Anlieferungen hintereinander, keine bleibt an der Waage hängen", () => {
  it("jede kommt über die Waage auf den Platz und wieder vom Hof", { timeout: 900_000 }, () => {
    const p = bauePlatz(5);
    p.m.acceptDeliveries = true;
    p.m.intervalFactor = 0.05;
    const anWaage = (a: { group: THREE.Group }): boolean =>
      Math.hypot(a.group.position.x - WAAGE_HALT[0], a.group.position.z - WAAGE_HALT[1]) < 8;
    let fuhren = 0;
    let letzte: unknown = null;
    let waageSeit = 0;
    let laengsteAnWaage = 0;
    for (let i = 0; i < 60 * 60 * 90 && fuhren < 50; i++) {
      p.takt();
      const a = (p.m as unknown as {
        active: { phaseName: string; phaseT: number; group: THREE.Group; cargo: { items: Array<{ body: RAPIER.RigidBody }>; car: unknown } } | null;
      }).active;
      if (a !== letzte) {
        if (letzte) fuhren++;
        letzte = a;
        waageSeit = 0;
      }
      if (!a) continue;
      // Abladen übernimmt hier der Prüfstand: Was oben liegt, ist weg
      if (a.phaseName === "waitUnload" && a.phaseT > 1) {
        for (const it of [...a.cargo.items]) {
          const e = p.items.itemByBody(it.body);
          if (e) p.items.remove(e, true);
        }
        a.cargo.items.length = 0;
        if (a.cargo.car) p.m.zurWaage();
      }
      // Gekipptes vom Abladeplatz räumen, sonst macht die Einfahrt zu (Platz dicht)
      if (i % 600 === 0) {
        for (const it of [...p.items.items]) {
          const q = it.body.isValid() ? it.body.translation() : null;
          if (!q || !it.body.isDynamic() || Math.hypot(q.x - 6.3, q.z + 25) >= 10) continue;
          // Ein Wrack geht über seinen Verwalter (E-177), sonst fragt der einen toten Körper
          if (p.composites.despawnByBody(it.body)) p.items.remove(it, false);
          else p.items.remove(it, true);
        }
      }
      if (anWaage(a) && a.phaseName !== "out" && a.phaseName !== "weighIn") waageSeit += DT;
      else waageSeit = 0;
      laengsteAnWaage = Math.max(laengsteAnWaage, waageSeit);
    }
    expect(fuhren, "nicht 50 Fuhren geschafft").toBeGreaterThanOrEqual(50);
    // An der Waage steht man zum Wiegen (2,5 s ein, 6 s aus) — sonst nie lange
    expect(laengsteAnWaage, "ein Laster hing an der Waage").toBeLessThan(20);
  });
});
