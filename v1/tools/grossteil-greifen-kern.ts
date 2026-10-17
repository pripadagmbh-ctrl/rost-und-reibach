/**
 * MESSUNG: Spinne auf ein Grossteil setzen, nachdruecken, zufassen (E-137).
 *
 * Patrick 17.10.2026: „Manche grossteile koennen nicht oder nur sehr schwer
 * gegriffen werden, auch verhaelt sich der Kran ungewoehnlich, er steigt
 * schrittweise nach oben ohne den ausleger korrigieren zu koennen."
 *
 * Ablauf je Teil, echter Bagger wie in `lastaufschlag-kern.ts`:
 *   1. Arm hoch, das Teil (echter Katalog-Bau, konvexe Huelle wie im Spiel)
 *      mittig unter die Spinne legen.
 *   2. 3 s Ausleger UND Stiel senken (F+G) — so wie man auf ein Teil zufaehrt.
 *   3. 2 s nur den Ausleger weiter senken (F) — „korrigieren".
 *   4. 1,5 s zudruecken (Leertaste), 1,5 s heben (R, Leertaste gehalten).
 * Ausgegeben: wie hoch die Spitze nach 2. und 3. steht, wie viel sie
 * waehrend 3. STIEG (Soll: nie), ob gefasst und ob gehoben.
 *
 *     npx vite-node tools/grossteil-greifen.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { GripSystem } from "../src/physics/gripSystem";
import { initPhysics } from "../src/physics/physicsWorld";
import { ItemManager, SPECS, BIG_SPECS, HUGE_SPECS } from "../src/world/scrapItems";
import type { PileSpec } from "../src/world/objektkatalog";

const DT = 1 / 60;

class Tasten {
  down = new Set<string>();
  wheelDelta = 0;
  orbitDX = 0;
  orbitDY = 0;
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

export interface GrossteilMessung {
  name: string;
  massKg: number;
  /** Oberkante des Teils (m) */
  oben: number;
  /** Krallenspitze (Armspitze) nach dem Absenken (m, Maschinenbasis) */
  spitzeAbgesenkt: number;
  /** groesster Anstieg der Armspitze, waehrend der Spieler SENKT (m) */
  stiegBeimSenken: number;
  /** Zahl der Bilder, in denen die Spitze trotz Senken stieg (> 1 mm) */
  bilderGestiegen: number;
  /** Armspitze nach 2 s weiter Senken (m) */
  spitzeKorrigiert: number;
  gefasst: number;
  /** wie hoch das Teil nach dem Heben gekommen ist (m, Schwerpunkt) */
  gehoben: number;
  /** schnellstes Tempo des Teils waehrend des ganzen Laufs (m/s) */
  vMax: number;
}

function form(sp: PileSpec) {
  return { kind: sp.kind, dims: sp.dims, color: 0xffffff, bau: sp.bau, name: sp.name, zusammensetzung: sp.zusammensetzung, massiv: sp.massiv };
}
function hoehe(sp: PileSpec): number {
  if (sp.kind === "box") return sp.dims[1]!;
  if (sp.kind === "torus") return sp.dims[1]! * 2;
  return sp.dims[0]! * 2;
}

export const ALLE_SPECS = (): PileSpec[] => [...SPECS, ...BIG_SPECS, ...HUGE_SPECS];

async function einLauf(
  sp: PileSpec,
  spur?: (phase: string, bagger: Excavator, teil: RAPIER.RigidBody | null) => void,
  /** Teil so weit neben die Spinnenmitte legen (m, Welt) */
  versatz = { x: 0, z: 0 }
): Promise<GrossteilMessung & { endeX: number; endeZ: number; teilX: number; teilZ: number }> {
  let phase = "vorbereiten";
  leinwandAttrappe();
  await initPhysics();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = DT;
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  const scene = new THREE.Scene();
  const bagger = new Excavator(scene, world);
  const items = new ItemManager(scene, world);
  const grip = new GripSystem(world, bagger.grappleBody);
  grip.insideGrapple = (p) => bagger.isInsideGrapple(p);
  grip.krallenKontakte = (b) => bagger.krallenKontakte(b);
  // wie main.ts: was sich quetschen laesst, gibt nach
  bagger.clawBlockedBy = (b) => {
    const it = items.itemByBody(b);
    return !it || !items.isCrushable(it);
  };
  const tasten = new Tasten();
  const sensor = new THREE.Vector3();
  let teil: RAPIER.RigidBody | null = null;
  let vMax = 0;
  const takt = (): void => {
    bagger.update(DT, tasten as never);
    grip.update(bagger.closure, bagger.closing, bagger.getSensorPosition(sensor), DT);
    world.step();
    items.clampSpeeds(DT);
    bagger.carriedCount = grip.grippedCount;
    bagger.carriedMassKg = grip.totalMassKg;
    bagger.grippedHandles.clear();
    for (const b of grip.grippedBodies) bagger.grippedHandles.add(b.handle);
    spur?.(phase, bagger, teil);
    if (teil) {
      const v = teil.linvel();
      vMax = Math.max(vMax, Math.hypot(v.x, v.y, v.z));
    }
  };
  // Arm vor und hoch: Spinne steht frei ueber dem Beton
  tasten.down.add("KeyG");
  for (let i = 0; i < 120; i++) takt();
  tasten.down.clear();
  // hoch genug, dass auch ein 2,8 m hohes Teil die offenen Schalen nicht
  // beruehrt — sonst schiesst es beim Anlegen weg (v2 E-010)
  tasten.down.add("KeyR");
  for (let i = 0; i < 110; i++) takt();
  tasten.down.clear();
  for (let i = 0; i < 30; i++) takt();
  const gp = bagger.grappleGroup.position.clone();
  const h = hoehe(sp);
  const it = items.spawnScrap(sp.materialId, sp.massKg, form(sp), new THREE.Vector3(gp.x + versatz.x, h / 2 + 0.02, gp.z + versatz.z));
  teil = it.body;
  for (let i = 0; i < 60; i++) takt(); // liegt
  // oberste Kante messen: Strahl von oben
  const ray = new RAPIER.Ray({ x: gp.x, y: 20, z: gp.z }, { x: 0, y: -1, z: 0 });
  const hit = world.castRay(ray, 40, true, undefined, undefined, undefined, undefined, (c) => c.parent()?.handle === teil!.handle);
  const oben = hit ? 20 - hit.timeOfImpact : h;

  // 2. auf das Teil zufahren
  phase = "absenken";
  tasten.down.add("KeyF");
  tasten.down.add("KeyG");
  for (let i = 0; i < 180; i++) takt();
  const spitzeAbgesenkt = bagger.grappleGroup.position.y;
  const endeX = bagger.grappleGroup.position.x;
  const endeZ = bagger.grappleGroup.position.z;
  const teilX = gp.x + versatz.x;
  const teilZ = gp.z + versatz.z;
  // 3. nur mit dem Ausleger weiter senken
  phase = "korrigieren";
  tasten.down.delete("KeyG");
  let stieg = 0;
  let bilder = 0;
  let tiefste = bagger.grappleGroup.position.y;
  let alt = tiefste;
  for (let i = 0; i < 120; i++) {
    takt();
    const y = bagger.grappleGroup.position.y;
    if (y > alt + 0.001) bilder++;
    tiefste = Math.min(tiefste, y);
    stieg = Math.max(stieg, y - tiefste);
    alt = y;
  }
  const spitzeKorrigiert = bagger.grappleGroup.position.y;
  // 4. zudruecken und heben
  phase = "greifen";
  tasten.down.clear();
  tasten.down.add("Space");
  for (let i = 0; i < 90; i++) takt();
  const gefasst = grip.grippedCount;
  const y0 = teil.translation().y;
  tasten.down.add("KeyR");
  for (let i = 0; i < 90; i++) takt();
  const gehoben = teil.isValid() ? teil.translation().y - y0 : 0;
  world.free();
  return {
    name: sp.name ?? sp.bau ?? "?",
    massKg: sp.massKg,
    oben,
    spitzeAbgesenkt,
    stiegBeimSenken: stieg,
    bilderGestiegen: bilder,
    spitzeKorrigiert,
    gefasst,
    gehoben,
    vMax,
    endeX,
    endeZ,
    teilX,
    teilZ,
  };
}

/**
 * Zwei Laeufe: Der erste findet, wo die Spinne beim Absenken auf dem Teil zum
 * Stehen kommt (Ausleger und Stiel ziehen sie dabei zur Maschine), der zweite
 * legt das Teil so, dass seine Mitte um `versatz` neben DIESER Stelle liegt.
 */
export async function messeGrossteil(
  sp: PileSpec,
  spur?: (phase: string, bagger: Excavator, teil: RAPIER.RigidBody | null) => void,
  versatz = { x: 0, z: 0 }
): Promise<GrossteilMessung> {
  const a = await einLauf(sp);
  return einLauf(sp, spur, { x: a.endeX - a.teilX + versatz.x, z: a.endeZ - a.teilZ + versatz.z });
}
