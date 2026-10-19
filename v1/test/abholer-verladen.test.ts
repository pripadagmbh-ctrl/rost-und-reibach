/**
 * E-177 — Patrick, 20.10.2026: „LKWs sollten verladen werden können, beim
 * Abholer" (Antwort: Schrott UND Wracks auf den Abholer), „Abholer kommt immer
 * zum bagger und fährt hinterher, wenn ich den verladeplatz wechsle", „es
 * können abholer für jede sorte und auch für müll bestellt werden. Inklusive
 * m hoch drei angabe, also manchmal einfach ein absetzkipper, und manchmal ein
 * grosser container", „fahrer hupen und funkspruch aus dem Büro".
 *
 * Die Wächter fahren den Fuhrpark mit echter Physik, wie im Sandkasten
 * (`vollFaehrtLos`, `sandkastenAbholer`). Gemessen wird am Körper, nicht an
 * einer Merkzahl: Was verladen ist, liegt während der ganzen Fahrt an
 * derselben Stelle der Fläche, nichts fliegt weg, nichts steckt in einer Wand.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager, bueroFunk } from "../src/delivery/vehicles";
import { ItemManager, type ScrapItem, type ScrapShape } from "../src/world/scrapItems";
import { CompositeManager, type CarComposite } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { BAGGER_STAND } from "../src/world/baggerstand";
import {
  abholPlaetzeEinmal,
  umsetzZug,
  fahrHindernisse,
  bedLenFor,
} from "../src/delivery/routes";
import { tiefsteDurchdringung, UMRISS_TOLERANZ } from "../src/delivery/umriss";
import { rollAnlieferung } from "../src/delivery/customers";
import type { Box } from "../src/world/boxen";

type Abholer = NonNullable<VehicleManager["pickupTruck"]>;
const DT = 1 / 60;

beforeAll(async () => {
  await initPhysics();
});
afterEach(() => {
  vi.restoreAllMocks();
});

function festerZufall(seed = 4242): void {
  let s = seed;
  vi.spyOn(Math, "random").mockImplementation(() => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  });
}

interface Platz {
  m: VehicleManager;
  items: ItemManager;
  composites: CompositeManager;
  world: RAPIER.World;
  scene: THREE.Scene;
  bagger: THREE.Vector3;
  gegriffen: RAPIER.RigidBody[];
}

function bauePlatz(): Platz {
  festerZufall();
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0), boden);
  const items = new ItemManager(scene, world);
  const composites = new CompositeManager(scene, world, items, new EventBus());
  const m = new VehicleManager(scene, world, items, composites);
  // Wie im Sandkasten (main.ts, Block „Simulator: abhängen")
  m.vollFaehrtLos = true;
  m.sandkastenAbholer = true;
  m.acceptDeliveries = false;
  const bagger = new THREE.Vector3(BAGGER_STAND.x, 0, BAGGER_STAND.z);
  m.getExcavatorPos = () => bagger;
  const gegriffen: RAPIER.RigidBody[] = [];
  m.gegriffen = () => gegriffen;
  return { m, items, composites, world, scene, bagger, gegriffen };
}

function takt(p: Platz): void {
  p.m.update(DT);
  p.items.clampSpeeds(DT);
  p.world.step();
  p.composites.update();
  p.scene.updateMatrixWorld(true);
}

function wartetBis(p: Platz, frage: () => boolean, sekunden: number, was: string): void {
  for (let i = 0; i < sekunden * 60 && !frage(); i++) takt(p);
  expect(frage(), was).toBe(true);
}

function bedGroup(t: Abholer): THREE.Group {
  return (t as unknown as { bedGroup: THREE.Group }).bedGroup;
}

function kiste(): ScrapShape {
  return { kind: "box", dims: [0.5, 0.4, 0.6], color: 0x8899aa };
}

/** Teile auf die Fläche fallen lassen — über die Physik, nicht per Zuweisung. */
function ladeAuf(p: Platz, t: Abholer, zs: number[], y = 1.2, kg = 300): ScrapItem[] {
  const drauf: ScrapItem[] = [];
  for (const z of zs) {
    const wo = bedGroup(t).localToWorld(new THREE.Vector3(0, y, z));
    drauf.push(p.items.spawnScrap("steel", kg, kiste(), wo, new THREE.Quaternion()));
    for (let i = 0; i < 40; i++) takt(p);
  }
  for (let i = 0; i < 120; i++) takt(p);
  return drauf;
}

/** Wo ein Körper auf der Fläche liegt (Flächenrahmen). */
function lokal(t: Abholer, b: RAPIER.RigidBody): THREE.Vector3 {
  const q = b.translation();
  return bedGroup(t).worldToLocal(new THREE.Vector3(q.x, q.y, q.z));
}

/**
 * Bis der Wagen vom Hof ist. Misst je Schritt, wie weit ein mitfahrender
 * Körper von seiner Stelle auf der Fläche wandert (Rutschen, Herunterfallen,
 * Katapult) und wie schnell er ist.
 */
function fahreMitLadung(
  p: Platz,
  t: Abholer,
  koerper: RAPIER.RigidBody[]
): { wanderM: number; spitzeMs: number; vomHof: boolean } {
  const start = koerper.map((b) => lokal(t, b));
  let wanderM = 0;
  let spitzeMs = 0;
  for (let i = 0; i < 60 * 240 && p.m.activeKind !== null; i++) {
    takt(p);
    if (p.m.activeKind === null) break;
    if (t.phaseName === "waitLoad") continue; // vor dem Losfahren darf es sich noch setzen
    koerper.forEach((b, k) => {
      if (!b.isValid()) return;
      wanderM = Math.max(wanderM, lokal(t, b).distanceTo(start[k]!));
      const v = b.linvel();
      spitzeMs = Math.max(spitzeMs, Math.hypot(v.x, v.y, v.z));
    });
  }
  return { wanderM, spitzeMs, vomHof: p.m.activeKind === null };
}

function holeAbholer(p: Platz, order: string | null, aufbau?: "abroller" | "absetzer"): Abholer {
  p.m.requestPickup(order, aufbau);
  wartetBis(p, () => !!p.m.pickupTruck?.waitingForLoad, 400, "der Abholer ist nie an seinem Platz angekommen");
  return p.m.pickupTruck!;
}

describe("E-177 — Schrott verladen", () => {
  it("was auf der Fläche liegt, fährt verriegelt mit und ist erst am Ende der Ausfahrt weg", () => {
    const p = bauePlatz();
    const koerperVorher = p.world.bodies.len();
    const t = holeAbholer(p, "steel", "abroller");
    const len = bedLenFor("abholer");
    const drauf = ladeAuf(p, t, [1.2, 2.2, 3.2, 4.2]);
    expect(t.containedItems(p.items).length).toBe(4);
    expect(p.m.requestPickup()).toBe("abgefahren"); // ABHOLEN = fertig
    const r = fahreMitLadung(p, t, drauf.map((d) => d.body));
    expect(r.vomHof).toBe(true);
    expect(r.wanderM, "ein Teil ist auf der Fläche gewandert").toBeLessThan(0.02);
    expect(r.spitzeMs, "ein Teil war schneller als der Wagen").toBeLessThan(6);
    for (const d of drauf) expect(p.items.items.includes(d)).toBe(false);
    expect(len).toBeGreaterThan(0);
    // Nichts bleibt in der Welt zurück — auch nicht die Heckklappe (bis E-177 blieb sie stehen)
    expect(p.world.bodies.len()).toBe(koerperVorher);
  });
});

describe("E-177 — Wracks verladen", () => {
  function wrackAuf(p: Platz, t: Abholer, art: "pkw" | "lkw" | "wohnwagen", y: number): CarComposite {
    const g = bedGroup(t);
    const wo = g.localToWorld(new THREE.Vector3(0, y, bedLenFor("abholer") / 2));
    const q = new THREE.Quaternion();
    g.getWorldQuaternion(q);
    const gier = new THREE.Euler().setFromQuaternion(q, "YXZ").y;
    const car = p.composites.spawnCar(wo, art, gier);
    for (let i = 0; i < 240; i++) takt(p);
    return car;
  }

  it("ein Auto im Container fährt mit, ohne Katapult, und ist danach sauber weg", () => {
    const p = bauePlatz();
    const t = holeAbholer(p, "mixed", "abroller");
    const car = wrackAuf(p, t, "pkw", 0.6);
    expect(t.ladeflaecheKg(), "das Wrack liegt nicht auf der Fläche").toBeGreaterThan(500);
    p.m.requestPickup();
    const r = fahreMitLadung(p, t, [car.body]);
    expect(r.vomHof).toBe(true);
    expect(r.wanderM).toBeLessThan(0.02);
    expect(r.spitzeMs).toBeLessThan(6);
    // Weg aus beiden Verwaltern — und der nächste Schritt stürzt nicht ab
    expect(p.composites.cars.includes(car)).toBe(false);
    expect(p.items.itemByBody(car.body)).toBeUndefined();
    for (let i = 0; i < 30; i++) takt(p);
  });

  it("das LKW-Wrack auf dem Container füllt ihn — er fährt von selbst und nimmt es mit", () => {
    const p = bauePlatz();
    const t = holeAbholer(p, "mixed", "abroller");
    const car = wrackAuf(p, t, "lkw", 2.8);
    expect(t.ladeflaecheFuellgrad(), "ein LKW-Wrack belegt den Container").toBeGreaterThan(0.8);
    const r = fahreMitLadung(p, t, [car.body]);
    expect(r.vomHof, "er ist mit dem Wrack nicht von selbst losgefahren").toBe(true);
    expect(r.wanderM).toBeLessThan(0.02);
    expect(r.spitzeMs).toBeLessThan(6);
    expect(p.composites.cars.includes(car)).toBe(false);
  });

  it("was die Spinne hält, wird nie an den Wagen gekoppelt", () => {
    const p = bauePlatz();
    const t = holeAbholer(p, "steel", "abroller");
    const [a, b] = ladeAuf(p, t, [1.5, 3.5]);
    p.gegriffen.push(b!.body);
    t.verriegeleLadeflaeche();
    expect(a!.body.isKinematic()).toBe(true);
    expect(b!.body.isKinematic(), "das gegriffene Teil hängt jetzt an zwei Herren").toBe(false);
  });
});

describe("E-177 — Absetzkipper oder Abroller, mit m³", () => {
  it("wenig da: der Absetzkipper mit 7 m³; viel da: der Abroller mit 34 m³", () => {
    const p = bauePlatz();
    expect(p.m.abholAngebot("copper").fahrzeug).toBe("Absetzkipper 7 m³");
    // Mehr als in die Mulde passt (ihr Laderaum rund 5,8 m³)
    for (let i = 0; i < 40; i++) {
      p.items.spawnScrap(
        "copper",
        100,
        { kind: "box", dims: [0.6, 0.6, 0.5], color: 0xc7622b },
        new THREE.Vector3(30 + (i % 8) * 1.2, 0.5, 30 + Math.floor(i / 8) * 1.2),
        new THREE.Quaternion()
      );
    }
    expect(p.m.abholAngebot("copper").fahrzeug).toBe("Abroller 34 m³");
    // Kupfer und Messing teilen ein Lager (`zaehltZu`), Stahl zählt nicht mit
    expect(p.m.abholAngebot("brass").bereitM3).toBeCloseTo(p.m.abholAngebot("copper").bereitM3, 6);
    expect(p.m.abholAngebot("steel").bereitM3).toBe(0);
  });

  it("die Liste bietet jede Sorte, Müll und gemischt an — jede mit Fahrzeug und m³", () => {
    const p = bauePlatz();
    const liste = p.m.abholListe();
    const titel = liste.map((e) => e.titel);
    for (const s of ["Stahlschrott", "Mischschrott", "Kupfer", "Kabel", "Aluminium", "Edelstahl VA", "Batterien", "Müll"]) {
      expect(titel).toContain(s);
    }
    expect(liste[liste.length - 1]!.order).toBeNull();
    for (const e of liste) expect(e.zeile).toMatch(/^(Absetzkipper 7|Abroller 34) m³ · \d+,\d m³ da$/);
  });

  it("der Absetzkipper wird in seine Mulde beladen, voll fährt er, die Fuhre fährt mit", () => {
    const p = bauePlatz();
    const t = holeAbholer(p, "copper");
    expect(t.kind).toBe("absetzer");
    // Die Mulde muss im Schwenkband des Baggers liegen (5,8 … 9,2 m, Boden bis 9,5 m)
    const g = bedGroup(t);
    for (const [x, z] of [[-0.9, 0], [0.9, 0], [-0.9, 3.7], [0.9, 3.7]] as const) {
      const w = g.localToWorld(new THREE.Vector3(x, 1.5, z));
      const d = Math.hypot(w.x - BAGGER_STAND.x, w.z - BAGGER_STAND.z);
      expect(d, `Muldenecke ${x}|${z} außer Reichweite`).toBeLessThan(9.5);
      expect(d).toBeGreaterThan(4.5);
    }
    const drauf = ladeAuf(p, t, [0.8, 1.6, 2.4, 3.0], 1.0, 200);
    expect(t.containedItems(p.items).length).toBe(4);
    p.m.requestPickup();
    const r = fahreMitLadung(p, t, drauf.map((d) => d.body));
    expect(r.vomHof).toBe(true);
    expect(r.wanderM).toBeLessThan(0.02);
    for (const d of drauf) expect(p.items.items.includes(d)).toBe(false);
  });
});

describe("E-177 — der Abholer kommt zum Bagger und fährt hinterher", () => {
  const kupfer = (): ReturnType<typeof abholPlaetzeEinmal>[number] =>
    abholPlaetzeEinmal().find((q) => q.ziel?.fractionId === "copper")!;

  it("jeder Platz ist von jedem aus frei erreichbar (Rangierzug ohne Bauwerk)", () => {
    const plaetze = abholPlaetzeEinmal();
    expect(plaetze.length).toBeGreaterThanOrEqual(7);
    for (const len of [bedLenFor("abholer"), bedLenFor("absetzer")]) {
      for (const a of plaetze) {
        for (const b of plaetze) {
          if (a === b) continue;
          expect(umsetzZug(a, b, len).wahl, `${a.name} → ${b.name}`).not.toMatch(/^NICHT FREI/);
        }
      }
    }
  });

  it("steht der Bagger am Kupfer-Lager, kommt er dorthin — egal, was bestellt ist", () => {
    const p = bauePlatz();
    const k = kupfer();
    p.bagger.set(k.stand.x, 0, k.stand.z);
    const t = holeAbholer(p, "steel", "abroller");
    expect(Math.hypot(t.group.position.x - k.halt[0], t.group.position.z - k.halt[1])).toBeLessThan(0.6);
  });

  it("wechselt der Bagger den Verladeplatz, setzt er mit verriegelter Ladung um", () => {
    const p = bauePlatz();
    const t = holeAbholer(p, "steel", "abroller");
    const drauf = ladeAuf(p, t, [1.5, 2.7, 3.9]);
    let hupen = 0;
    p.m.onAnkunftHupe = () => hupen++;
    const meldungen: string[] = [];
    p.m.onMeldung = (s) => meldungen.push(s);
    const k = kupfer();
    p.bagger.set(k.stand.x + 0.5, 0, k.stand.z);
    // Unterwegs: nichts wandert auf der Fläche, nichts steckt in einem Bauwerk
    const start = drauf.map((d) => lokal(t, d.body));
    let wander = 0;
    let tief = 0;
    let losgefahren = false;
    const boxen: Box[] = [];
    for (let i = 0; i < 60 * 240; i++) {
      takt(p);
      if (t.setztUm) {
        losgefahren = true;
        drauf.forEach((d, n) => (wander = Math.max(wander, lokal(t, d.body).distanceTo(start[n]!))));
        boxen.length = 0;
        t.boxen(boxen);
        tief = Math.max(tief, tiefsteDurchdringung(boxen, fahrHindernisse()));
      }
      if (losgefahren && t.waitingForLoad) break;
    }
    expect(losgefahren, "er ist dem Bagger nicht nachgefahren").toBe(true);
    expect(t.waitingForLoad).toBe(true);
    expect(Math.hypot(t.group.position.x - k.halt[0], t.group.position.z - k.halt[1])).toBeLessThan(0.6);
    expect(wander, "Ladung hat sich unterwegs bewegt").toBeLessThan(0.02);
    expect(tief, "durch ein Bauwerk gefahren").toBeLessThanOrEqual(UMRISS_TOLERANZ);
    for (let i = 0; i < 180; i++) takt(p);
    // Am neuen Platz wieder frei und alles noch auf der Fläche
    expect(t.containedItems(p.items).length).toBe(3);
    for (const d of drauf) expect(d.body.isDynamic()).toBe(true);
    expect(meldungen).toContain("Abroller fährt dir nach.");
    expect(meldungen[meldungen.length - 1]).toBe("Abroller steht bereit — laden, dann ABHOLEN drücken (V).");
    // Gehupt wird höchstens einmal — innerhalb von 30 s nach der ersten Ankunft gar nicht (Hupabstand)
    expect(hupen).toBeLessThanOrEqual(1);
  });

  it("nicht bei jedem Rangieren: daneben stehen oder durchfahren reicht nicht", () => {
    const p = bauePlatz();
    const t = holeAbholer(p, "steel", "abroller");
    // Am eigenen Stand herumrangieren
    p.bagger.set(BAGGER_STAND.x + 2.5, 0, BAGGER_STAND.z + 1);
    for (let i = 0; i < 60 * 8; i++) takt(p);
    expect(t.waitingForLoad).toBe(true);
    // Am Kupfer-Lager vorbeifahren (2 m/s quer durch den Kreis)
    const k = kupfer();
    for (let i = 0; i < 60 * 5; i++) {
      p.bagger.set(k.stand.x - 5 + (i / 60) * 2, 0, k.stand.z);
      takt(p);
    }
    expect(t.waitingForLoad, "er ist schon beim Vorbeifahren umgesetzt").toBe(true);
  });
});

describe("E-178 — Hupe und Büro-Funk", () => {
  it("die Bestellung bestätigt das Büro mit Fahrzeug und m³, bei der Ankunft hupt er einmal", () => {
    const p = bauePlatz();
    const meldungen: string[] = [];
    let hupen = 0;
    p.m.onMeldung = (s) => meldungen.push(s);
    p.m.onAnkunftHupe = () => hupen++;
    holeAbholer(p, "copper");
    expect(meldungen[0]).toBe("Büro an Bagger: Absetzkipper 7 m³ für Kupfer ist unterwegs.");
    expect(meldungen).toContain("Absetzkipper steht bereit — laden, dann ABHOLEN drücken (V).");
    expect(hupen).toBe(1);
  });

  it("eine sortenreine Kupferfuhre kippt ins Kupfer-Lager, und das Büro sagt es", () => {
    const p = bauePlatz();
    const meldungen: string[] = [];
    p.m.onMeldung = (s) => meldungen.push(s);
    let kunde = rollAnlieferung();
    for (let i = 0; i < 4000 && !(kunde.sortedMaterial === "copper" && kunde.vehicle === "kipper"); i++) {
      kunde = rollAnlieferung();
    }
    expect(kunde.sortedMaterial).toBe("copper");
    p.m.spawnNow("kipper", kunde);
    wartetBis(p, () => meldungen.length > 0, 120, "kein Büro-Funk zur Fuhre");
    expect(meldungen[0]).toBe("Büro an Bagger: Kipper mit Kupfer kommt, kippt ins KUPFER-LAGER.");
    const v = (p.m as unknown as { active: Parameters<typeof bueroFunk>[0] }).active;
    expect(bueroFunk(v)).toBe(meldungen[0]);
  });
});

describe("E-178 — sortenrein kommt im Kipper", () => {
  it("keine sortenreine Fuhre kommt mehr auf der Pritsche", () => {
    festerZufall(99);
    let sortenrein = 0;
    for (let i = 0; i < 3000; i++) {
      const k = rollAnlieferung();
      if (!k.sortedMaterial) continue;
      sortenrein++;
      expect(k.vehicle, `${k.name}: ${k.sortedMaterial}`).not.toBe("pritsche");
    }
    expect(sortenrein).toBeGreaterThan(300);
  });
});

describe("E-177 — die Meldungen gibt es auch auf Englisch", () => {
  it("Büro-Funk, Bestellliste und Abholer-Zeilen sind übersetzt", async () => {
    const { nachEnglisch } = await import("../src/ui/sprache");
    const paare: Array<[string, string]> = [
      ["Büro an Bagger: Absetzkipper 7 m³ für Kupfer ist unterwegs.", "Office to loader: Skip loader 7 m³ for Copper is on its way."],
      ["Büro an Bagger: Abroller 34 m³ für gemischte Ladung ist unterwegs.", "Office to loader: Hook-lift truck 34 m³ for a mixed load is on its way."],
      ["Büro an Bagger: Kipper mit Kupfer kommt, kippt ins KUPFER-LAGER.", "Office to loader: Tipper truck with Copper coming, tipping into the COPPER STORE."],
      ["Büro an Bagger: Pritsche mit gemischter Ladung kommt an den Abladeplatz.", "Office to loader: Flatbed truck with a mixed load coming to the unloading bay."],
      ["Abroller steht bereit — laden, dann ABHOLEN drücken (V).", "Hook-lift truck is ready — load it, then press PICKUP (V)."],
      ["Abroller fährt dir nach.", "Hook-lift truck is following you."],
      ["Absetzkipper ist voll und fährt los.", "Skip loader is full and leaving."],
      ["Abroller 34 m³ · 12,5 m³ da", "Hook-lift truck 34 m³ · 12.5 m³ ready"],
      ["Müll", "Waste"],
    ];
    for (const [de, en] of paare) expect(nachEnglisch(de)).toBe(en);
  });
});
