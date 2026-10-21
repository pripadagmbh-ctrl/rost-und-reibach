/**
 * E-190 — Patrick, 21.10.2026: „Der Müllcontainer soll ein abholcontainer
 * werden der raufgezogen wird." Antworten: „Voll weg, leer zurück" (erst den
 * leeren abstellen, dann den vollen hochziehen), kleiner Abroller ca. 10 m³,
 * Platz vor dem Bagger an der BUNT + VA.
 *
 * Gefahren mit echter Physik und dem echten ContainerManager: Der volle fährt
 * samt Inhalt mit, nichts fällt, nichts fliegt, der leere steht danach am
 * Müllplatz, und in der Welt sind danach genau so viele Körper wie vorher —
 * minus dem Müll, der mitgefahren ist.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager, type ScrapItem } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { ContainerManager, CONFIGS, MUELL_START } from "../src/world/containers";
import { ContainerAbholung } from "../src/delivery/platzinventarAbholung";
import { EventBus } from "../src/core/events";
import { BAGGER_STAND, SCHWENK_INNEN, SCHWENK_AUSSEN } from "../src/world/baggerstand";
import { UNTERWAGEN_HALB_B } from "../src/excavator/unterwagenParts";
import {
  hakenGeometrie,
  wannenLage,
  alphaAmBoden,
  hakenSpitze,
  HAKEN_SCHUB_M,
  MUELL_WANNE,
} from "../src/delivery/hakenlift";
import { MUELL_PLAETZE, planeMuellwechsel, wannenRechteck } from "../src/delivery/muellwechsel";
import { fahrHindernisse, BED_LEN } from "../src/delivery/routes";
import { tiefsteDurchdringung, UMRISS_TOLERANZ } from "../src/delivery/umriss";
import type { Box } from "../src/world/boxen";

const DT = 1 / 60;

function papierstatBrowser(): void {
  if (typeof (globalThis as { document?: unknown }).document !== "undefined") return;
  const ctx = new Proxy(
    {},
    {
      get: (_t, p) => (p === "measureText" ? () => ({ width: 10 }) : () => undefined),
      set: () => true,
    }
  );
  const canvas = { width: 256, height: 128, getContext: () => ctx, style: {} };
  (globalThis as { document?: unknown }).document = { createElement: () => canvas };
}

beforeAll(async () => {
  papierstatBrowser();
  await initPhysics();
});
afterEach(() => vi.restoreAllMocks());

function festerZufall(seed = 1907): void {
  let s = seed;
  vi.spyOn(Math, "random").mockImplementation(() => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  });
}

interface Platz {
  m: VehicleManager;
  items: ItemManager;
  c: ContainerManager;
  world: RAPIER.World;
  scene: THREE.Scene;
  composites: CompositeManager;
  meldungen: string[];
  hupen: number;
  n: number;
}

function bauePlatz(): Platz {
  festerZufall();
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0), boden);
  const items = new ItemManager(scene, world);
  const composites = new CompositeManager(scene, world, items, new EventBus());
  const c = new ContainerManager(scene, world, new EventBus());
  c.nachtschichtAktiv = false;
  const m = new VehicleManager(scene, world, items, composites);
  m.platzinventar = new ContainerAbholung(c, items, world);
  m.vollFaehrtLos = true;
  m.sandkastenAbholer = true;
  m.acceptDeliveries = false;
  const bagger = new THREE.Vector3(BAGGER_STAND.x, 0, BAGGER_STAND.z);
  m.getExcavatorPos = () => bagger;
  const p: Platz = { m, items, c, world, scene, composites, meldungen: [], hupen: 0, n: 0 };
  m.onMeldung = (t) => p.meldungen.push(t);
  m.onAnkunftHupe = () => p.hupen++;
  return p;
}

function takt(p: Platz): void {
  p.m.update(DT);
  p.items.clampSpeeds(DT);
  p.c.bremseAlle();
  p.world.step();
  p.composites.update();
  p.items.settleSleep(DT);
  if (++p.n % 10 === 0) p.c.recount(p.items, new Set());
  p.scene.updateMatrixWorld(true);
}

/** Müll in den Container werfen — über die Physik, nicht per Zuweisung. */
function fuelle(p: Platz, n: number): ScrapItem[] {
  const ort = p.c.muell()!.ort;
  const out: ScrapItem[] = [];
  for (let i = 0; i < n; i++) {
    const wo = new THREE.Vector3(ort.x + ((i % 2) - 0.5) * 0.9, 1.6 + Math.floor(i / 2) * 0.5, ort.z - 1.5 + (i % 3) * 1.4);
    out.push(
      p.items.spawnScrap("rubble", 60, { kind: "box", dims: [0.5, 0.35, 0.6], color: 0x9a9083 }, wo, new THREE.Quaternion())
    );
  }
  for (let i = 0; i < 240; i++) takt(p);
  return out;
}

describe("E-190 — der Hakenarm", () => {
  const g = hakenGeometrie(BED_LEN.abholer!);
  const voll = alphaAmBoden(g);

  it("aufgeladen liegt der Container flach auf dem Rahmen, abgesetzt flach auf dem Boden", () => {
    const auf = wannenLage(g, 0, 0);
    expect(auf.neigung).toBeCloseTo(0, 5);
    expect(auf.y).toBeCloseTo(g.rahmenOben, 4);
    expect(auf.z - MUELL_WANNE.laenge / 2, "das Heck schliesst mit dem Rahmen ab").toBeCloseTo(-BED_LEN.abholer! / 2, 4);
    const ab = wannenLage(g, voll);
    expect(ab.neigung).toBeCloseTo(0, 3);
    expect(Math.abs(ab.y)).toBeLessThan(0.01);
    // und mit Luft hinter dem Wagen
    expect(ab.z + MUELL_WANNE.laenge / 2).toBeLessThan(-BED_LEN.abholer! / 2 - 1.5);
  });

  it("dazwischen: nie im Boden, nie steiler als 45°, kein Sprung, Haken nie über 4,5 m", () => {
    let vorher = wannenLage(g, 0, 0);
    let sprung = 0;
    const schritte: Array<[number, number]> = [];
    for (let i = 0; i <= 200; i++) schritte.push([0, (HAKEN_SCHUB_M * i) / 200]);
    for (let i = 1; i <= 600; i++) schritte.push([(voll * i) / 600, HAKEN_SCHUB_M]);
    for (const [a, s] of schritte) {
      const l = wannenLage(g, a, s);
      const hinten = l.y - (MUELL_WANNE.laenge / 2) * Math.sin(l.neigung);
      expect(hinten, `Heck im Boden bei ${((a * 180) / Math.PI).toFixed(0)}°`).toBeGreaterThan(-1e-6);
      expect(l.neigung).toBeLessThan((45 * Math.PI) / 180);
      expect(hakenSpitze(g, a, s)[1]).toBeLessThan(4.5);
      sprung = Math.max(sprung, Math.hypot(l.z - vorher.z, l.y - vorher.y));
      vorher = l;
    }
    // 800 Stellungen auf rund 14 s — je Bild höchstens ein paar Zentimeter
    expect(sprung).toBeLessThan(0.05);
  });
});

describe("E-190 — der Müllplatz", () => {
  const muell = CONFIGS.find((c) => c.id === "r_rubble")!;

  it("ist ein 10-m³-Abrollcontainer an der Schwelle der BUNT + VA", () => {
    const [w, d, h] = muell.size;
    expect([w, d, h]).toEqual([MUELL_WANNE.breite, MUELL_WANNE.laenge, MUELL_WANNE.wand]);
    expect(Math.round((w - 0.18) * (d - 0.18) * h)).toBe(10);
    expect(muell.x).toBe(MUELL_START.x);
    expect(muell.x - w / 2, "Westkante wie in E-183").toBeCloseTo(-4.8, 6);
  });

  it("beide Stellplätze liegen im Schwenkband und frei von Bauwerken; A ist nicht in der Fahrlinie", () => {
    for (const s of MUELL_PLAETZE) {
      const d = Math.hypot(s.x - BAGGER_STAND.x, s.z - BAGGER_STAND.z);
      expect(d).toBeGreaterThanOrEqual(SCHWENK_INNEN);
      expect(d).toBeLessThanOrEqual(SCHWENK_AUSSEN);
      expect(tiefsteDurchdringung([{ ...wannenRechteck(s, 0.05), rot: 0 }], fahrHindernisse().filter((o) => !o.label.startsWith("MUELL")))).toBe(0);
    }
    const a = MUELL_PLAETZE[0]!;
    expect(Math.abs(a.x - BAGGER_STAND.x) - (MUELL_WANNE.breite / 2 + UNTERWAGEN_HALB_B)).toBeGreaterThan(0);
  });

  it("von beiden Stellplätzen aus ist der Wechsel planbar — der leere kommt auf den anderen", () => {
    const vonA = planeMuellwechsel(MUELL_PLAETZE[0]!);
    const vonB = planeMuellwechsel(MUELL_PLAETZE[1]!);
    expect(vonA?.leer).toBe(MUELL_PLAETZE[1]);
    expect(vonB?.leer).toBe(MUELL_PLAETZE[0]);
    for (const pl of [vonA!, vonB!]) {
      expect(pl.hin.wahl).not.toMatch(/^NICHT FREI/);
      expect(pl.zumVollen.wahl).not.toMatch(/^NICHT FREI/);
    }
  });
});

describe("E-190 — voll weg, leer zurück", () => {
  function wechsel(p: Platz): {
    wander: number;
    spitze: number;
    tief: number;
    sekunden: number;
  } {
    const drin = p.items.items.filter((it) => p.c.muell()!.containsPoint(it.body.translation()));
    expect(p.m.requestPickup("rubble")).toBe("gerufen");
    expect(p.m.activeKind).toBe("abholer");
    let wander = 0;
    let spitze = 0;
    let tief = 0;
    const start = new Map<number, THREE.Vector3>();
    const boxen: Box[] = [];
    let i = 0;
    for (; i < 60 * 600 && p.m.activeKind !== null; i++) {
      takt(p);
      const t = p.m.pickupTruck;
      if (!t) break;
      boxen.length = 0;
      t.boxen(boxen);
      tief = Math.max(tief, tiefsteDurchdringung(boxen, fahrHindernisse()));
      // Sobald der volle am Haken hängt: Inhalt bleibt, wo er im Container liegt
      const w = (t as unknown as { tragWanne: { group: THREE.Group } | null }).tragWanne;
      if (w && t.holtVollen) {
        const inv = new THREE.Matrix4().copy(w.group.matrixWorld).invert();
        for (const it of drin) {
          if (!it.body.isValid()) continue;
          const q = it.body.translation();
          const l = new THREE.Vector3(q.x, q.y, q.z).applyMatrix4(inv);
          if (!start.has(it.body.handle)) start.set(it.body.handle, l);
          else wander = Math.max(wander, l.distanceTo(start.get(it.body.handle)!));
          const v = it.body.linvel();
          spitze = Math.max(spitze, Math.hypot(v.x, v.y, v.z));
        }
      }
    }
    expect(p.m.activeKind, "der Abroller ist nicht vom Hof gekommen").toBeNull();
    for (const it of drin) expect(p.items.items.includes(it), "Müll ist auf dem Platz geblieben").toBe(false);
    return { wander, spitze, tief, sekunden: i * DT };
  }

  it("der leere steht danach auf B, der volle ist samt Inhalt weg, keine Körper übrig", () => {
    const p = bauePlatz();
    const drin = fuelle(p, 6);
    for (let i = 0; i < 30; i++) takt(p);
    expect(p.c.muell()!.contentKg, "der Müll liegt nicht im Container").toBeGreaterThan(300);
    const koerper = p.world.bodies.len();
    const r = wechsel(p);
    expect(r.wander, "Inhalt hat sich im Container bewegt").toBeLessThan(0.02);
    expect(r.spitze, "Katapult").toBeLessThan(8);
    expect(r.tief, "durch ein Bauwerk gefahren").toBeLessThanOrEqual(UMRISS_TOLERANZ);
    // Der leere ist jetzt der Müll-Container des Platzes
    for (let i = 0; i < 120; i++) takt(p);
    const neu = p.c.muell()!;
    const b = MUELL_PLAETZE[1]!;
    expect(Math.hypot(neu.ort.x - b.x, neu.ort.z - b.z), "der leere steht nicht auf B").toBeLessThan(0.7);
    expect(neu.wanne!.body.isDynamic()).toBe(true);
    expect(neu.wanne!.body.translation().y).toBeLessThan(0.05);
    expect(neu.contentKg).toBe(0);
    expect(p.world.bodies.len(), "Körperzahl").toBe(koerper - drin.length);
    expect(p.meldungen[0]).toBe("Büro an Bagger: Abroller 10 m³ für Müll ist unterwegs.");
    expect(p.meldungen).toContain("Abroller tauscht den Müll-Container.");
    expect(p.meldungen).toContain("Abroller fährt mit dem vollen Müll-Container los.");
    expect(p.hupen).toBeGreaterThanOrEqual(1);
    console.log(`Wechsel A→B: ${r.sekunden.toFixed(0)} s bis vom Hof`);
  });

  it("beim nächsten Wechsel kommt der leere wieder auf A — genau an den Platz", () => {
    const p = bauePlatz();
    wechsel(p);
    for (let i = 0; i < 120; i++) takt(p);
    fuelle(p, 4);
    wechsel(p);
    for (let i = 0; i < 120; i++) takt(p);
    const a = MUELL_PLAETZE[0]!;
    const neu = p.c.muell()!;
    expect(Math.hypot(neu.ort.x - a.x, neu.ort.z - a.z)).toBeLessThan(0.7);
  });

  it("steht der Container so, dass keiner hinkommt, funkt das Büro und es kommt niemand", () => {
    const p = bauePlatz();
    const w = p.c.muell()!.wanne!;
    // quer in die Ecke vor der BUNT + VA gedreht
    w.body.setTranslation({ x: -3.0, y: 0, z: -17.5 }, true);
    w.body.setRotation({ x: 0, y: Math.sin(Math.PI / 4), z: 0, w: Math.cos(Math.PI / 4) }, true);
    for (let i = 0; i < 30; i++) takt(p);
    expect(p.m.requestPickup("rubble")).toBe("unmoeglich");
    expect(p.m.activeKind).toBeNull();
    expect(p.meldungen).toContain("Büro an Bagger: Stell den Müll-Container an seinen Platz.");
  });
});

describe("E-190 — die Meldungen gibt es auch auf Englisch", () => {
  it("Tausch, Abfahrt, Büro", async () => {
    const { nachEnglisch } = await import("../src/ui/sprache");
    expect(nachEnglisch("Büro an Bagger: Abroller 10 m³ für Müll ist unterwegs.")).toBe(
      "Office to loader: Hook-lift truck 10 m³ for Waste is on its way."
    );
    expect(nachEnglisch("Abroller tauscht den Müll-Container.")).toBe("Hook-lift truck is swapping the waste container.");
    expect(nachEnglisch("Abroller fährt mit dem vollen Müll-Container los.")).toBe(
      "Hook-lift truck is leaving with the full waste container."
    );
    expect(nachEnglisch("Büro an Bagger: Stell den Müll-Container an seinen Platz.")).toBe(
      "Office to loader: Put the waste container back in its place."
    );
  });
});

describe("E-190 zu E-191 — die Bagger-Hupe schickt einen wartenden Anlieferer zur Waage", () => {
  it("anliefererWartet nur, solange er am Abladeplatz aufs Abladen wartet — nie beim Abholer", () => {
    const p = bauePlatz();
    p.m.spawnNow("pritsche");
    expect(p.m.anliefererWartet, "schon unterwegs gilt er als wartend").toBe(false);
    for (let i = 0; i < 60 * 300 && !p.m.anliefererWartet; i++) takt(p);
    expect(p.m.anliefererWartet, "die Pritsche kam nie zum Warten").toBe(true);
    // Was main.ts auf `bagger:hupe` tut
    expect(p.m.zurWaage()).toBe("geschickt");
    takt(p);
    expect(p.m.anliefererWartet).toBe(false);
    for (let i = 0; i < 60 * 300 && p.m.activeKind !== null; i++) takt(p);
    expect(p.m.activeKind, "er ist nicht vom Hof gefahren").toBeNull();
    // Ein wartender Abholer zählt nicht als Anlieferer
    p.m.requestPickup("steel", "abroller");
    for (let i = 0; i < 60 * 300 && !p.m.pickupTruck?.waitingForLoad; i++) takt(p);
    expect(p.m.pickupTruck?.waitingForLoad).toBe(true);
    expect(p.m.anliefererWartet).toBe(false);
  });
});
