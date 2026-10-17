/**
 * MESSUNG: Haemmern und Druecken mit der leeren Spinne (E-137, 17.10.2026).
 *
 * Patrick: „Hämmern und drücken soll und muss mit der Spinne möglich sein …
 * Aktuell hört man nichts. Auch wirkt es, dass die spinne beim hämmern
 * abbremst. Bremsen kann nur das material oder den boden die spinne."
 *
 * Echter Bagger wie in `lastaufschlag-kern.ts`. Je Untergrund (Beton, ein
 * 1,3-t-Minibagger, ein Haufen loser Kisten), offen oder zu:
 *   1. Spinne hoch, Untergrund dort, wo sie beim Senken aufsetzt.
 *   2. Fuenf Schlaege: `hebBilder` lang heben (R), dann Ausleger UND Stiel
 *      voll senken (F+G), bis 0,5 s nach dem Aufsetzen.
 *   3. 2 s aufgedrueckt halten (F+G).
 * Gemessen: Senktempo der Armspitze frei in der Luft (bestes) und beim
 * Aufsetzen, Bilder, in denen das Senken gesperrt war, OBWOHL nichts auflag,
 * der kleinste Pflugfaktor in der Luft (1 = ungebremst), die Meldungen
 * `onSpinneAufschlag` / `onSpinneDruecken`.
 *
 *     npx vite-node tools/haemmern.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { GripSystem } from "../src/physics/gripSystem";
import { initPhysics } from "../src/physics/physicsWorld";
import { ItemManager, BIG_SPECS, HUGE_SPECS } from "../src/world/scrapItems";

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

export type Untergrund = "beton" | "grossteil" | "haufen";

export interface Hammerlauf {
  untergrund: Untergrund;
  zu: boolean;
  /** schnellstes Senktempo der Spitze frei in der Luft (m/s) */
  vFrei: number;
  /** Senktempo im Bild vor dem Aufsetzen, je Schlag (m/s) */
  vAufsetzen: number[];
  /** Bilder: Spieler senkt, nichts liegt auf, und das Senken ist trotzdem gesperrt */
  gesperrtFrei: number;
  /** kleinster Pflugfaktor im ersten Anflug, bevor etwas auflag (1 = ungebremst) */
  pflugFreiMin: number;
  aufschlaege: Array<{ wucht: number; handle: number | null; bild: number }>;
  druecken: Array<{ staerke: number; handle: number | null; bild: number }>;
  /** Drueck-Meldungen in den 2 s Aufgedrueckt-Halten */
  drueckenHalten: number;
  /** wie weit sich das Ziel beim Halten bewegte (m) */
  untergrundWeg: number;
  /** Handle des Ziels (Grossteil, mittlere Kiste), sonst null */
  zielHandle: number | null;
}

interface Aufbau {
  world: RAPIER.World;
  bagger: Excavator;
  items: ItemManager;
  tasten: Tasten;
  takt: () => void;
  /** liegt die Spinne gerade wirklich auf (Bodenanschlag oder Rapier-Kontakt der Schalen) */
  kontakt: () => boolean;
}

function aufbau(nachTakt?: () => void): Aufbau {
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
  bagger.clawBlockedBy = (b) => {
    const it = items.itemByBody(b);
    return !it || !items.isCrushable(it);
  };
  const tasten = new Tasten();
  const sensor = new THREE.Vector3();
  const takt = (): void => {
    bagger.update(DT, tasten as never);
    grip.update(bagger.closure, bagger.closing, bagger.getSensorPosition(sensor), DT);
    world.step();
    items.clampSpeeds(DT);
    bagger.carriedCount = grip.grippedCount;
    bagger.carriedMassKg = grip.totalMassKg;
    bagger.grippedHandles.clear();
    for (const g of grip.grippedBodies) bagger.grippedHandles.add(g.handle);
    nachTakt?.();
  };
  const kontakt = (): boolean => {
    if (bagger.groundContact.active) return true;
    let ja = false;
    const g = bagger.grappleBody;
    for (let i = 0; i < g.numColliders() && !ja; i++) {
      const c = g.collider(i);
      if (!c.isEnabled()) continue;
      world.contactPairsWith(c, (o) => {
        if (ja || !o.parent()?.isDynamic()) return;
        world.contactPair(c, o, (m) => {
          for (let k = 0; k < m.numContacts(); k++) if (m.contactDist(k) < 0.02) ja = true;
        });
      });
    }
    return ja;
  };
  // Spinne vor und hoch
  tasten.down.add("KeyG");
  for (let i = 0; i < 120; i++) takt();
  tasten.down.clear();
  tasten.down.add("KeyR");
  for (let i = 0; i < 90; i++) takt();
  tasten.down.clear();
  for (let i = 0; i < 30; i++) takt();
  return { world, bagger, items, tasten, takt, kontakt };
}

/** Wo setzt die Spinne auf dem Beton auf, wenn man sie aus der Startlage voll senkt? */
function landestelle(): THREE.Vector3 {
  const a = aufbau();
  a.tasten.down.add("KeyF");
  a.tasten.down.add("KeyG");
  for (let i = 0; i < 300 && !a.bagger.groundContact.active; i++) a.takt();
  const p = a.bagger.grappleGroup.position.clone();
  a.world.free();
  return p;
}

export async function haemmere(untergrund: Untergrund, zu = false, hebBilder = 24): Promise<Hammerlauf> {
  leinwandAttrappe();
  await initPhysics();
  const lande = landestelle();
  let messen = false;
  let bild = 0;
  let yAlt = 0;
  let vAlt = 0;
  let kontaktAlt = true;
  const lauf: Hammerlauf = {
    untergrund,
    zu,
    vFrei: 0,
    vAufsetzen: [],
    gesperrtFrei: 0,
    pflugFreiMin: 1,
    aufschlaege: [],
    druecken: [],
    drueckenHalten: 0,
    untergrundWeg: 0,
    zielHandle: null,
  };
  let a: Aufbau | null = null;
  const nachTakt = (): void => {
    if (!a) return;
    bild++;
    const b = a.bagger as unknown as Record<string, unknown>;
    const y = a.bagger.grappleGroup.position.y;
    const v = (yAlt - y) / DT;
    const k = a.kontakt();
    if (messen) {
      if (a.tasten.down.has("KeyF") && !k) {
        lauf.vFrei = Math.max(lauf.vFrei, v);
        // nur im ersten Anflug: danach klingt der Widerstand des letzten Kontakts noch nach (Glaettung)
        if (lauf.vAufsetzen.length === 0) lauf.pflugFreiMin = Math.min(lauf.pflugFreiMin, b.plowFactor as number);
        if (b.bodenSperre === true) lauf.gesperrtFrei++;
      }
      if (k && !kontaktAlt) lauf.vAufsetzen.push(vAlt);
    }
    yAlt = y;
    vAlt = v;
    kontaktAlt = k;
  };
  const auf = aufbau(nachTakt);
  a = auf;
  const { world, bagger, items, tasten, takt } = auf;
  bagger.onSpinneAufschlag = (wucht, handle) => lauf.aufschlaege.push({ wucht, handle, bild });
  bagger.onSpinneDruecken = (staerke, handle) => lauf.druecken.push({ staerke, handle, bild });

  let ziel: RAPIER.RigidBody | null = null;
  if (untergrund === "grossteil") {
    const sp = [...BIG_SPECS, ...HUGE_SPECS].find((s) => s.name === "Minibagger 1,5 t (ohne Arm/Dach)")!;
    ziel = items.spawnScrap(
      sp.materialId,
      sp.massKg,
      { kind: sp.kind, dims: sp.dims, color: 0xffffff, bau: sp.bau, name: sp.name },
      new THREE.Vector3(lande.x, sp.dims[1]! / 2 + 0.02, lande.z)
    ).body;
  } else if (untergrund === "haufen") {
    for (let i = 0; i < 25; i++) {
      const x = lande.x + ((i % 5) - 2) * 0.62;
      const z = lande.z + (Math.floor(i / 5) - 2) * 0.62;
      const k = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, 0.21, z));
      world.createCollider(RAPIER.ColliderDesc.cuboid(0.3, 0.2, 0.3).setMass(60), k);
      if (i === 12) ziel = k;
    }
  }
  lauf.zielHandle = ziel?.handle ?? null;
  for (let i = 0; i < 60; i++) takt();
  if (zu) {
    tasten.down.add("Space");
    for (let i = 0; i < 60; i++) takt();
  }
  messen = true;
  for (let s = 0; s < 5; s++) {
    tasten.down.delete("KeyF");
    tasten.down.delete("KeyG");
    tasten.down.add("KeyR");
    for (let i = 0; i < hebBilder; i++) takt();
    tasten.down.delete("KeyR");
    tasten.down.add("KeyF");
    tasten.down.add("KeyG");
    let nach = -1;
    for (let i = 0; i < 240 && nach < 30; i++) {
      takt();
      if (nach >= 0 || auf.kontakt()) nach++;
    }
  }
  // aufgedrueckt halten
  const vorHalten = lauf.druecken.length;
  const p0 = ziel ? { ...ziel.translation() } : null;
  for (let i = 0; i < 120; i++) takt();
  lauf.drueckenHalten = lauf.druecken.length - vorHalten;
  if (ziel && p0) {
    const p1 = ziel.translation();
    lauf.untergrundWeg = Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z);
  }
  world.free();
  return lauf;
}

/**
 * Gegenprobe Pfluegen: Spinne offen in einen Haufen aus 48 Kisten (je 60 kg)
 * senken, dann 2 s voll schwenken. Gemessen wird das mittlere Schwenktempo
 * (°/s) — frei laeuft der Oberwagen 33 °/s (`CAB_MAX`) — und der kleinste
 * Pflugfaktor. Material, an dem die Spinne entlangschiebt, soll bremsen.
 */
export async function pfluege(): Promise<{ schwenkGradS: number; pflugMin: number }> {
  leinwandAttrappe();
  await initPhysics();
  const { world, bagger, tasten, takt } = aufbau();
  const b = bagger as unknown as Record<string, number>;
  const gp = bagger.grappleGroup.position.clone();
  // Haufen quer zur Schwenkbahn: 4 x 4 x 3 Kisten
  for (let i = 0; i < 48; i++) {
    const x = gp.x + 0.6 + (i % 4) * 0.62;
    const z = gp.z + (Math.floor(i / 4) % 4) * 0.62 - 0.9;
    const y = 0.21 + Math.floor(i / 16) * 0.42;
    const k = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z));
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.3, 0.2, 0.3).setMass(60).setFriction(0.8), k);
  }
  for (let i = 0; i < 90; i++) takt();
  tasten.down.add("KeyF");
  tasten.down.add("KeyG");
  for (let i = 0; i < 150; i++) takt();
  tasten.down.clear();
  const yaw0 = b.cabYaw;
  let pflugMin = 1;
  tasten.down.add("KeyE");
  for (let i = 0; i < 120; i++) {
    takt();
    pflugMin = Math.min(pflugMin, b.plowFactor);
  }
  const schwenkGradS = (Math.abs(b.cabYaw - yaw0) * 180) / Math.PI / 2;
  world.free();
  return { schwenkGradS, pflugMin };
}
