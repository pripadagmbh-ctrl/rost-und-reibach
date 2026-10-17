import { describe, it, expect, beforeAll } from "vitest";
/**
 * DER ABSETZKIPPER (E-141) — Wächter.
 *
 * Patrick, 17.10.2026: „Auch sollen LKWs mit kleinen absetzcontainern kommen,
 * die durch ketten gekippt oder eben nur abgesetzt werden, damit ich sie leer
 * mache."
 *
 * Geprüft wird in zwei Schichten:
 *   1. Die Geometrie (`absetzmulde.muldenPose`): Fahrstellung auf dem Rahmen,
 *      abgesetzt auf dem Boden, gekippt nie im Boden.
 *   2. Der ganze Ablauf mit echter Physik und fester Saat: kippen (die Fuhre
 *      liegt hinter dem Wagen, nichts fliegt), absetzen (die Mulde steht, der
 *      Abladeplatz ist zu, leer wird sie geholt).
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { absetzGeometrie } from "../src/delivery/vehicleModel";
import { muldenPose, absetzSchwenk, zapfenLage, imTrog } from "../src/delivery/absetzmulde";
import { ABSETZMULDE, ladeVolumen } from "../src/delivery/fuellgrad";
import { ABSETZ_HALT, bedLenFor } from "../src/delivery/routes";
import { festerZufall } from "./kipperlauf";
import { pruefKunde } from "./pruefkunde";

beforeAll(async () => {
  await initPhysics();
});

const geo = absetzGeometrie(bedLenFor("absetzer"));
const L = ABSETZMULDE.laenge;
const zp = zapfenLage();

/** Die acht Ecken der Mulde (Muldenrahmen) im Wagenrahmen, (y, z). */
function ecken(alpha: number, kipp: number): Array<[number, number]> {
  const p = muldenPose(geo, alpha, kipp);
  const a = -kipp;
  const out: Array<[number, number]> = [];
  for (const [y, z] of [
    [0, (L * (1 - ABSETZMULDE.bodenAnteil)) / 2],
    [0, (L * (1 + ABSETZMULDE.bodenAnteil)) / 2],
    [ABSETZMULDE.hoehe, 0],
    [ABSETZMULDE.hoehe, L],
  ] as Array<[number, number]>) {
    out.push([p.y + y * Math.cos(a) - z * Math.sin(a), p.z + y * Math.sin(a) + z * Math.cos(a)]);
  }
  return out;
}

describe("Die Mulde an den Ketten", () => {
  it("steht zur Fahrt auf dem Rahmen, die Kette haengt senkrecht ueber dem Zapfen", () => {
    const p = muldenPose(geo, 0, 0);
    expect(p.y).toBeCloseTo(geo.muldeY, 9);
    expect(p.z + zp.z).toBeCloseTo(geo.muldeZ, 9);
    expect(p.spitzeZ).toBeCloseTo(p.zapfenZ, 9);
    expect(p.spitzeY - p.zapfenY).toBeCloseTo(geo.kette, 9);
  });

  it("steht abgesetzt mit den Kufen auf dem Boden, hinter dem Rahmenende", () => {
    const p = muldenPose(geo, absetzSchwenk(geo), 0);
    expect(p.y).toBeCloseTo(0, 6);
    // Vorderkante oben hinter dem Unterfahrschutz (bedLen/2 + 0,14)
    expect(p.z + L).toBeLessThan(-bedLenFor("absetzer") / 2 - 0.14);
    // ... und mit dem Halt in der Gasse 1,0 m vor der Suedmauer (innen −28,7)
    expect(ABSETZ_HALT[1] + p.z).toBeGreaterThan(-28.7 + 1.0);
  });

  it("bleibt beim Schwenken und Kippen ueber dem Boden und ueber dem Rahmen", () => {
    const ziel = absetzSchwenk(geo);
    let tiefst = Infinity;
    for (let a = 0; a <= ziel * 0.98; a += 0.01) {
      for (const [y, z] of ecken(a, 0)) {
        tiefst = Math.min(tiefst, y);
        // Ueber dem Rahmen (bis zum Unterfahrschutz) nie unter seine Oberkante
        if (z > -bedLenFor("absetzer") / 2 - 0.14) expect(y, `Schwenk ${a.toFixed(2)}`).toBeGreaterThan(geo.muldeY - 0.01);
      }
    }
    expect(tiefst).toBeGreaterThan(0);
    // Gekippt am Kipp-Armwinkel (140 Grad gegen +z) bis 110 Grad und etwas Ruetteln
    const kippArm = (140 * Math.PI) / 180 - geo.winkel0;
    for (let k = 0; k <= (117 * Math.PI) / 180; k += 0.01) {
      for (const [y] of ecken(kippArm, k)) expect(y, `Kipp ${k.toFixed(2)}`).toBeGreaterThan(0.2);
    }
  });

  it("fasst 7 m³ — der Laderaum rechnet mit dem Boden, nicht mit der Oberkante", () => {
    const v = ladeVolumen("absetzer");
    // Innenmass 1,53 x 2,12 m Boden, 1,78 m hoch mit Ueberstand: 5,8 m³ —
    // die schraegen Stirnwaende bringen die Mulde auf ihre 7 m³.
    expect(v).toBeGreaterThan(5);
    expect(v).toBeLessThan(7.5);
  });
});

interface Platz {
  m: VehicleManager;
  items: ItemManager;
  world: RAPIER.World;
}

function bauePlatz(): Platz {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0), boden);
  const items = new ItemManager(scene, world);
  const m = new VehicleManager(scene, world, items, new CompositeManager(scene, world, items, new EventBus()));
  m.acceptDeliveries = false;
  return { m, items, world };
}

function takt(p: Platz): void {
  p.m.update(1 / 60);
  p.items.clampSpeeds(1 / 60);
  p.world.step();
}

type Wagen = { absetzModus: string; phaseName: string; cargo: { items: Array<{ body: RAPIER.RigidBody; massKg: number }> } };
const aktiv = (p: Platz): Wagen | null => (p.m as unknown as { active: Wagen | null }).active;

/** Einen Absetzkipper mit fester Saat schicken; liefert seine Fuhre. */
function schicke(p: Platz, modus: "kippen" | "absetzen", saat: number): Wagen["cargo"]["items"] {
  const zurueck = festerZufall(saat);
  try {
    p.m.spawnNow("absetzer", pruefKunde({ gruppe: "gewerbe", vehicle: "absetzer", sortenrein: null, fuellgrad: 0.7 }));
    const v = aktiv(p)!;
    v.absetzModus = modus;
    return [...v.cargo.items];
  } finally {
    zurueck();
  }
}

describe("Der Absetzkipper kippt die Mulde an den Ketten aus", () => {
  for (const saat of [141, 1410]) {
    it(`Saat ${saat}: die Fuhre liegt hinter ihm, nichts fliegt, er faehrt vom Hof`, () => {
      const p = bauePlatz();
      let brutto = -1;
      let netto = -1;
      p.m.onWeighIn = (kg) => (brutto = kg);
      p.m.onWeighOut = (kg) => (netto = kg);
      const fuhre = schicke(p, "kippen", saat);
      expect(fuhre.length).toBeGreaterThan(0);
      const handles = new Set(fuhre.map((it) => it.body.handle));
      let vmax = 0;
      const phasen = new Set<string>();
      for (let i = 0; i < 60 * 150 && aktiv(p); i++) {
        takt(p);
        phasen.add(aktiv(p)?.phaseName ?? "");
        for (const it of p.items.items) {
          if (!handles.has(it.body.handle) || !it.body.isValid() || !it.body.isDynamic()) continue;
          const l = it.body.linvel();
          vmax = Math.max(vmax, Math.hypot(l.x, l.y, l.z));
        }
      }
      expect(aktiv(p), "der Absetzkipper ist nicht vom Hof gekommen").toBeNull();
      for (const ph of ["muldeHeben", "muldeKippen", "muldeLeeren", "armeEin", "out"]) expect(phasen).toContain(ph);
      // Kein Katapult: 60 km/h (SW) — gemessen hoechstens 32 km/h; der Kipper hat Spitzen bis 279.
      expect(vmax * 3.6, "ein Stueck wurde geschleudert").toBeLessThan(60);
      // Was auf dem Hof liegt, liegt hinter dem Halt in der Gasse, nicht verstreut
      let kgHof = 0;
      for (const it of p.items.items) {
        if (!handles.has(it.body.handle) || !it.body.isValid()) continue;
        const q = it.body.translation();
        expect(q.z, "ein Stueck liegt nicht hinter dem Wagen").toBeLessThan(ABSETZ_HALT[1] - 3);
        expect(Math.abs(q.x - ABSETZ_HALT[0])).toBeLessThan(3.5);
        kgHof += it.massKg;
      }
      // Bezahlt wird, was auf dem Hof liegt — auf das Kilo (Ankauf wie bei jedem Anlieferer)
      expect(brutto).toBeGreaterThan(0);
      expect(Math.abs(netto - kgHof), `netto ${netto} kg, auf dem Hof ${kgHof} kg`).toBeLessThan(1.5);
      // Und das meiste kam heraus (gemessen 79 bis 100 %)
      expect(kgHof / brutto).toBeGreaterThan(0.6);
    });
  }
});

describe("Der Absetzkipper setzt die Mulde ab, und sie wird geholt, wenn sie leer ist", () => {
  it("die Mulde steht hinter dem Halt, die Fuhre liegt darin; geleert holt sie derselbe Kunde", () => {
    const p = bauePlatz();
    let netto = -1;
    let brutto = -1;
    p.m.onWeighIn = (kg) => (brutto = kg);
    p.m.onWeighOut = (kg) => (netto = kg);
    const fuhre = schicke(p, "absetzen", 2141);
    const handles = new Set(fuhre.map((it) => it.body.handle));
    for (let i = 0; i < 60 * 150 && aktiv(p); i++) takt(p);
    expect(aktiv(p), "der Absetzkipper ist nicht vom Hof gekommen").toBeNull();
    const mulde = p.m.abgesetzteMulde;
    expect(mulde, "keine Mulde abgesetzt").not.toBeNull();
    // Wo sie steht: hinter dem Halt, in der Gasse, auf dem Boden
    mulde!.group.updateWorldMatrix(true, false);
    const mitte = new THREE.Vector3(0, 0, L / 2).applyMatrix4(mulde!.group.matrixWorld);
    expect(Math.abs(mitte.x - ABSETZ_HALT[0])).toBeLessThan(0.4);
    expect(mitte.z).toBeLessThan(ABSETZ_HALT[1] - 4);
    expect(mitte.z).toBeGreaterThan(-28.7 + L / 2 + 0.5);
    expect(Math.abs(mitte.y)).toBeLessThan(0.05);
    // Die Fuhre liegt darin — und ist trotzdem bezahlt (sie gehoert jetzt dem Platz)
    const inv = new THREE.Matrix4().copy(mulde!.group.matrixWorld).invert();
    const h = new THREE.Vector3();
    const drin = p.items.items.filter((it) => handles.has(it.body.handle) && imTrog(inv, it.body.translation(), h));
    expect(drin.length).toBe(fuhre.length);
    expect(netto).toBe(brutto);

    // Solange sie steht, kommt keine Fuhre an den Abladeplatz — sie wartet
    p.m.spawnNow("pritsche", pruefKunde({ gruppe: "gewerbe", vehicle: "pritsche", sortenrein: null, fuellgrad: 0.4 }));
    expect(aktiv(p), "ein Wagen faehrt in die stehende Mulde").toBeNull();
    for (let i = 0; i < 60 * 10; i++) takt(p);
    expect(aktiv(p), "geholt, obwohl noch alles darin liegt").toBeNull();

    // Der Spieler leert sie
    for (const it of drin) p.items.remove(it, true);
    let geholt = false;
    for (let i = 0; i < 60 * 200; i++) {
      takt(p);
      if (aktiv(p)?.absetzModus === "holen" && aktiv(p)?.phaseName === "muldeAufnehmen") geholt = true;
      if (geholt && !p.m.abgesetzteMulde && aktiv(p)?.absetzModus !== "holen") break;
    }
    expect(geholt, "die leere Mulde wurde nicht geholt").toBe(true);
    expect(p.m.abgesetzteMulde).toBeNull();
    // Und jetzt kommt die Pritsche, die gewartet hat
    for (let i = 0; i < 120 && !aktiv(p); i++) takt(p);
    expect((aktiv(p) as unknown as { kind: string } | null)?.kind ?? "niemand").toBe("pritsche");
  });
});
