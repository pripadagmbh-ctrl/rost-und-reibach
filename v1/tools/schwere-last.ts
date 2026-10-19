/**
 * MESSUNG M6 „Schwere Last" (19.10.2026) — geht Aufgabe 6 mit der Traglast E-156?
 *
 * Konzept `docs/aufgaben-konzept.md`, Abschnitt „6 · Schwere Last": Das
 * LKW-Wrack steht am Rand der Reichweite; ohne Pratzen meldet der erste
 * Hebeversuch Ueberlast (`greifer:ueberlast`, E-152), mit Pratzen und nah
 * heran geht es. „Vorher messen" — das tut dieses Werkzeug. Es aendert nichts
 * am Spiel und baut nichts ein.
 *
 * Echter Bagger, echtes Greifsystem (Fuenfschalengreifer, `setzeGreifer` wie
 * in main.ts), echtes LKW-Wrack (`CompositeManager`, `LKW_DEF`), Verdrahtung
 * und Schrittfolge wie `schrittInhalt` in main.ts (Bagger → Greifen →
 * Physik → `clampSpeeds` → Wracks). Boden: eine ebene Betonplatte.
 *
 * Ablauf je Lauf (Wrack-Mitte `ABSTAND` m vor dem Bagger, Blick +z):
 *   0. (mit Pratzen) Taste O, 2,5 s warten, bis sie ganz draussen sind.
 *   1. Arm ohne Last ueber die Greifstelle stellen (Winkel gesetzt, 3 s
 *      ausschwingen), Wrack liegt schon.
 *   2. Ausleger senken (F), bis die Spinne steht, 0,5 s nachdruecken.
 *   3. Zudruecken (Leertaste, bleibt ab hier gehalten) — gefasst?
 *   4. „weit": 1 s heben (R), 0,5 s ausfahren (T) — Meldung? gestoppt?
 *   5. Heranziehen am Boden (G) bis 6,0 m bzw. so weit es geht: Weg,
 *      Anheben ohne Ausleger, Tempo, Sperren.
 *   6. „nah": an jedem Halt 1 s heben (R) — Meldung? gestoppt?
 *   7. Geht es hoch: 1,5 s schwenken (Q), absenken, loslassen — Ausreisser?
 *      Geht es nicht hoch: 1 s schwenken am Boden — geht Schwenken weiter?
 * Ein Vorlauf misst, wie weit die Spinne beim Senken auf ihrem Bogen
 * wandert; der Hauptlauf stellt den Arm um genau so viel versetzt an.
 *
 * Aufrufe (unter PowerShell Umgebung als `$env:LAGE="quer"; npx vite-node …`):
 *   npx vite-node tools/schwere-last.ts                  alle Laeufe (7 t)
 *   (Umgebung) MASSE=rumpf                               ausgeschlachtet, 4 990 kg (`restoreState`, alle Teile ab)
 *   (Umgebung) LAGE=quer|laengs  ABSTAND=7,8,9  STELLE=dach,mitte,sattel,heck  PRATZEN=0|1
 *   (Umgebung) PLATZ=1                                   nur die Platzrechnung (Startplatz, Ablageflaeche)
 *   (Umgebung) SPUR=1                                    je Lauf eine Zeile pro Phase ausfuehrlich
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { GripSystem } from "../src/physics/gripSystem";
import { initPhysics, PhysicsWorld } from "../src/physics/physicsWorld";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager, type CarComposite } from "../src/dismantle/composites";
import { LKW_DEF } from "../src/dismantle/carDef";
import { EventBus, type GameEvents } from "../src/core/events";
import { setzeGreifer } from "../src/excavator/greiferwahl";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";
import { nutzlastKg } from "../src/excavator/traglast";
import { BAGGER_STAND } from "../src/world/baggerstand";
import { CONFIGS } from "../src/world/containers";
import { STATIC_OBSTACLES } from "../src/world/obstacles";
import { PRESS_CENTER, PRESS_INNER } from "../src/world/press";
import { BESEN_PLATZ } from "../src/world/startplatz";
import { naechsteSpur, SPUR_HALB } from "../src/world/fahrspuren";
import { YARD_MIN_X, YARD_MAX_X } from "../src/world/yard";
import { ABLADE_SPUR_X, ABLADE_HALT_Z } from "../src/delivery/routes";
/** PLATZ: Rand zu Bauwerken und Behaeltern (m), SW 0,5 wie beim Besen (startplatz.ts) */
const RAND = Number(process.env.RAND ?? 0.5);
/** PLATZ: Rand zusaetzlich zur halben Spurbreite (m); -1 = Spuren nicht pruefen (Simulator: keine Laster) */
const SPURRAND = Number(process.env.SPURRAND ?? 0.5);

const DT = 1 / 60;
const GRAD = 180 / Math.PI;
/** Armgeometrie, abgeschrieben aus `excavator.ts` (BOOM_PIVOT, BOOM_LEN, STICK_LEN, Grenzen) — nur fuer die Startstellung; der Lauf misst die echte Lage nach */
const PIV_Z = 0.55;
const PIV_Y = 2.95;
const BOOM_LEN = 5.2;
const STICK_LEN = 4.0;
const BOOM_MIN = 5 / GRAD;
const BOOM_MAX = 70 / GRAD;
const STICK_MIN = -140 / GRAD;
const STICK_MAX = -25 / GRAD;
/** Messziel aus dem Auftrag: „mit Pratzen nah (≤ 6 m)" */
const NAH_M = 6.0;
/** Ab hier gilt ein Koerper als Ausreisser (m/s) — Grenze aus der Bagger-Arbeitsweise (Griff/Spinne: „Ausreisser > 6 m/s") */
const AUSREISSER_MS = 6;

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

interface Stand {
  phys: PhysicsWorld;
  world: RAPIER.World;
  bagger: Excavator;
  grip: GripSystem;
  items: ItemManager;
  comps: CompositeManager;
  bus: EventBus;
  tasten: Tasten;
  meldungen: Array<GameEvents["greifer:ueberlast"]>;
  teile: string[];
  /** Physikschritt (ms), je Bild */
  physMs: number[];
  /** ganzer Takt (ms), je Bild */
  taktMs: number[];
  /** schnellster freier (dynamischer) Koerper, ueber den ganzen Lauf (m/s) */
  vFreiMax: number;
  /** in welcher Phase der schnellste freie Koerper gemessen wurde */
  vFreiPhase: string;
  phase: string;
  /** Bilder, in denen ein freier Koerper schneller als AUSREISSER_MS war */
  ausreisserBilder: number;
  nan: boolean;
}

function aufbau(): Stand {
  const phys = new PhysicsWorld();
  const world = phys.world;
  const scene = new THREE.Scene();
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  const bagger = new Excavator(scene, world);
  const grip = new GripSystem(world, bagger.grappleBody);
  const items = new ItemManager(scene, world);
  const bus = new EventBus();
  const comps = new CompositeManager(scene, world, items, bus);
  // Verdrahtung wie main.ts
  setzeGreifer(bagger, grip, FUENFSCHALEN);
  bagger.onClawBite = (e) => bus.emit("greifer:zugedrueckt", e);
  grip.partResolver = (pos) => comps.findPartNear(pos);
  grip.getViolence = () => bagger.tearViolence;
  grip.insideGrapple = (p) => bagger.isInsideGrapple(p);
  grip.krallenKontakte = (b) => bagger.krallenKontakte(b);
  grip.onReleaseGrace = () => bagger.startClawGrace();
  bagger.clawBlockedBy = (body) => {
    const it = items.itemByBody(body);
    return !it || !items.isCrushable(it);
  };
  const meldungen: Array<GameEvents["greifer:ueberlast"]> = [];
  // main.ts Z. 667: excavator.onUeberlast = (e) => bus.emit("greifer:ueberlast", e)
  bagger.onUeberlast = (e) => bus.emit("greifer:ueberlast", e);
  bus.on("greifer:ueberlast", (e) => meldungen.push(e));
  const teile: string[] = [];
  bus.on("partTorn", (e) => teile.push(e.name));
  return {
    phys, world, bagger, grip, items, comps, bus, tasten: new Tasten(), meldungen, teile,
    physMs: [], taktMs: [], vFreiMax: 0, vFreiPhase: "-", phase: "aufbau", ausreisserBilder: 0, nan: false,
  };
}

const sensor = new THREE.Vector3();
function takt(s: Stand): void {
  const t0 = performance.now();
  s.bagger.update(DT, s.tasten as never);
  s.grip.update(s.bagger.closure, s.bagger.closing, s.bagger.getSensorPosition(sensor), DT);
  s.bagger.carriedMassKg = s.grip.totalMassKg;
  s.bagger.carriedCount = s.grip.grippedCount;
  s.bagger.grippedHandles.clear();
  for (const b of s.grip.grippedBodies) s.bagger.grippedHandles.add(b.handle);
  for (const car of s.comps.cars) if (car.body.isValid()) s.bagger.obstacleBodies.add(car.body.handle);
  const p0 = performance.now();
  s.phys.step();
  s.physMs.push(performance.now() - p0);
  s.items.clampSpeeds(DT);
  s.comps.update();
  s.taktMs.push(performance.now() - t0);
  let schnell = false;
  s.world.forEachRigidBody((b) => {
    const t = b.translation();
    if (!Number.isFinite(t.x + t.y + t.z)) s.nan = true;
    if (!b.isDynamic()) return;
    const v = b.linvel();
    const vb = Math.hypot(v.x, v.y, v.z);
    if (vb > s.vFreiMax) {
      s.vFreiMax = vb;
      s.vFreiPhase = s.phase;
    }
    if (vb > AUSREISSER_MS) schnell = true;
  });
  if (schnell) s.ausreisserBilder++;
}

function halte(s: Stand, tasten: string[], bilder: number, jeBild?: () => boolean | void): number {
  for (const k of tasten) s.tasten.down.add(k);
  let i = 0;
  for (; i < bilder; i++) {
    takt(s);
    if (jeBild?.() === true) {
      i++;
      break;
    }
  }
  for (const k of tasten) s.tasten.down.delete(k);
  return i;
}

/** Ausleger/Stiel fuer ein Stielende in `r` m Ausladung und `y` m Hoehe (nach der Formel aus excavator.ts). */
function armFuer(r: number, y: number): { boom: number; stick: number; y: number } | null {
  let best: { boom: number; stick: number; y: number } | null = null;
  let bestScore = Infinity;
  for (let b = BOOM_MIN; b <= BOOM_MAX; b += 0.002) {
    for (let st = STICK_MIN; st <= STICK_MAX; st += 0.002) {
      const rr = PIV_Z + BOOM_LEN * Math.cos(b) + STICK_LEN * Math.cos(b + st);
      if (Math.abs(rr - r) > 0.02) continue;
      const yy = PIV_Y + BOOM_LEN * Math.sin(b) + STICK_LEN * Math.sin(b + st);
      // lieber darueber als darunter; darunter nur, wenn nichts anderes geht
      // nur haengender Stiel (Stielende nicht ueber dem Auslegerkopf) — so greift man von oben
      if (b + st > 0) continue;
      const score = yy >= y ? yy - y : 100 + (y - yy);
      if (score < bestScore) {
        bestScore = score;
        best = { boom: b, stick: st, y: yy };
      }
    }
  }
  return best;
}

/** Vorzeichen: Wohin dreht ein positiver `cabYaw` das Stielende? (+1: nach +x) */
let gierSinn = 0;

/** Stielende ueber (x, z) in Hoehe y stellen: Winkel setzen, ausschwingen, nachmessen, nachstellen. */
function stelleArm(s: Stand, x: number, z: number, y: number): boolean {
  const b = s.bagger;
  let zx = x;
  let zz = z;
  let zy = y;
  for (let it = 0; it < 3; it++) {
    const dx = zx - b.position.x;
    const dz = zz - b.position.z;
    const r = Math.hypot(dx, dz);
    const arm = armFuer(r, zy);
    if (!arm) return false;
    b.boomAngle = arm.boom;
    b.stickAngle = arm.stick;
    b.cabYaw = gierSinn * Math.atan2(dx, dz);
    for (let i = 0; i < (it === 2 ? 180 : 20); i++) takt(s);
    const g = b.grappleGroup.position;
    if (process.env.DEBUG === "1") console.log(`      IK ${it}: r ${r.toFixed(2)} y ${zy.toFixed(2)} -> Ausleger ${(arm.boom * GRAD).toFixed(1)} Stiel ${(arm.stick * GRAD).toFixed(1)} (y ${arm.y.toFixed(2)}); steht Ausleger ${(b.boomAngle * GRAD).toFixed(1)} Stiel ${(b.stickAngle * GRAD).toFixed(1)} bei (${g.x.toFixed(2)} | ${g.y.toFixed(2)} | ${g.z.toFixed(2)})`);
    zx += x - g.x;
    zz += z - g.z;
    zy += y - g.y;
  }
  const g = b.grappleGroup.position;
  const fehl = Math.hypot(g.x - x, g.z - z);
  if (fehl >= 0.1 && process.env.SPUR === "1") console.log(`    Arm: Ziel (${x.toFixed(2)} | ${y.toFixed(2)} | ${z.toFixed(2)}), steht (${g.x.toFixed(2)} | ${g.y.toFixed(2)} | ${g.z.toFixed(2)}), Ausleger ${(b.boomAngle * GRAD).toFixed(1)}°, Stiel ${(b.stickAngle * GRAD).toFixed(1)}°, blockiert ${b.armBlocked}`);
  return fehl < 0.1;
}

interface Stelle {
  id: string;
  name: string;
  /** Wrack-lokal, +z Schnauze */
  x: number;
  z: number;
  /** Oberkante dort (m) */
  oben: number;
}
/* Greifstellen: keine abreissbare Baugruppe im Greifradius (`findPartNear`), ausser „sattel" (Ladeflaeche). */
const STELLEN: Stelle[] = [
  { id: "dach", name: "Fahrerhausdach", x: 0, z: 1.9, oben: 3.0 },
  { id: "mitte", name: "Rahmen Mitte", x: 0, z: -0.8, oben: 1.05 },
  { id: "sattel", name: "Ladeflaeche/Sattel", x: 0, z: -1.75, oben: 1.25 },
  { id: "heck", name: "Rahmenende", x: 0, z: -2.85, oben: 1.05 },
];
/** quer: Laengsachse quer zum Blick, Schnauze nach +x; laengs: Schnauze zum Bagger (Fahrerhaus vorn); heck: Heck zum Bagger, Schnauze weg */
const LAGEN: Record<string, number> = { quer: Math.PI / 2, laengs: Math.PI, heck: 0 };

function weltpunkt(mitte: THREE.Vector3, gier: number, lx: number, lz: number): THREE.Vector3 {
  return new THREE.Vector3(lx, 0, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), gier).add(mitte);
}

interface Ergebnis {
  zeile: string;
  physMs: number[];
  koerper: number;
  kollider: number;
}

function legeWrack(s: Stand, mitte: THREE.Vector3, gier: number, rumpf: boolean): CarComposite {
  const car = s.comps.spawnCar(new THREE.Vector3(mitte.x, 0.02, mitte.z), "lkw", gier);
  if (rumpf) {
    // ausgeschlachtet wie aus dem Spielstand: alle Teile ab, keine Teilekoerper
    car.restoreState({ crushStage: 0, torn: LKW_DEF.parts.map((p) => p.id), brokenWindows: [] });
    const m = car.body.mass();
    if (Math.abs(m - LKW_DEF.hullMassKg) > 1) (car as unknown as { masseSetzen(): void }).masseSetzen();
  }
  for (let i = 0; i < 120; i++) takt(s);
  return car;
}

/**
 * Senken (F), bis die Spinne steht. Sanft (Vorgabe): aufhoeren, sobald der Arm
 * zum ersten Mal anhaelt oder das Wrack nachgibt (> 1 cm tiefer) — so setzt ein
 * Fahrer auf. DRUECKEN=1: halten, bis nichts mehr geht, und 0,5 s nachdruecken.
 */
function senken(s: Stand, car: CarComposite, yRuhe: number, spur: boolean): THREE.Vector3 {
  const b = s.bagger;
  const druecken = process.env.DRUECKEN === "1";
  let alt = b.grappleGroup.position.y;
  let ruhig = 0;
  let n = 0;
  halte(s, ["KeyF"], 480, () => {
    const y = b.grappleGroup.position.y;
    if (process.env.DEBUG === "1" && spur && n++ % 10 === 0)
      console.log(`      F: Stielende ${y.toFixed(2)} blockiert ${b.armBlocked} Knautsch ${car.knautschgrad.toFixed(2)} Wrack ${lageText(car, yRuhe)}`);
    if (!druecken && (b.armBlocked || car.body.translation().y < yRuhe - 0.01)) return true;
    ruhig = alt - y < 0.0005 ? ruhig + 1 : 0;
    alt = y;
    return ruhig >= 20;
  });
  if (druecken) halte(s, ["KeyF"], 30);
  else halte(s, [], 10);
  return b.grappleGroup.position.clone();
}

function lauf(
  lageId: string,
  abstand: number,
  stelle: Stelle,
  pratzen: boolean,
  rumpf: boolean,
  korrektur: { x: number; z: number },
  vorlauf: boolean
): { ende: THREE.Vector3; ziel: THREE.Vector3; ergebnis: Ergebnis | null } {
  const s = aufbau();
  const b = s.bagger;
  const gier = LAGEN[lageId]!;
  for (let i = 0; i < 10; i++) takt(s);
  if (gierSinn === 0) {
    b.cabYaw = 0.3;
    takt(s);
    gierSinn = b.grappleGroup.position.x > b.position.x ? 1 : -1;
    b.cabYaw = 0;
    for (let i = 0; i < 30; i++) takt(s);
  }
  if (pratzen) {
    b.toggleOutriggers();
    for (let i = 0; i < 150; i++) takt(s);
  }
  // Wrack-Mitte `abstand` m vor dem Bagger (Blick +z)
  const mitte = new THREE.Vector3(b.position.x, 0, b.position.z + abstand);
  const ziel = weltpunkt(mitte, gier, stelle.x, stelle.z);
  const hoehe = stelle.oben + FUENFSCHALEN.maxTiefe + 0.5; // SW: offene Spinne 0,5 m ueber der Oberkante
  const ok = stelleArm(s, ziel.x - korrektur.x, ziel.z - korrektur.z, hoehe);
  const rStelle = Math.hypot(ziel.x - b.position.x, ziel.z - b.position.z);
  if (!ok) {
    s.world.free();
    return { ende: ziel, ziel, ergebnis: vorlauf ? null : { zeile: zeileKopf(lageId, abstand, stelle, pratzen, rStelle) + "  Stelle nicht erreichbar (Arm)", physMs: [], koerper: 0, kollider: 0 } };
  }
  const car = legeWrack(s, mitte, gier, rumpf);
  const yRuhe = car.body.translation().y;
  const masse = car.body.mass();
  s.phase = "senken";
  const ende = senken(s, car, yRuhe, !vorlauf);
  if (vorlauf) {
    s.world.free();
    return { ende, ziel, ergebnis: null };
  }
  const spur: string[] = [];
  const T = (t: string): void => {
    if (process.env.SPUR === "1") spur.push(`    ${t}`);
  };
  const versatz = Math.hypot(ende.x - ziel.x, ende.z - ziel.z);
  T(`gesenkt: Stielende ${ende.y.toFixed(2)} m hoch, ${versatz.toFixed(2)} m neben der Stelle, Ausladung ${b.ausladungM.toFixed(2)} m, Ausleger ${(b.boomAngle * GRAD).toFixed(1)}°, Stiel zur Waagrechten ${((b.boomAngle + b.stickAngle) * GRAD).toFixed(1)}°; Wrack ${lageText(car, yRuhe)}`);
  /** DEBUG=1: je 10. Bild beim Heben, was den Ausleger haelt */
  let bild = 0;
  const spurHeben = (): void => {
    if (process.env.DEBUG !== "1" || bild++ % 10 !== 0) return;
    const x = b as unknown as { boomVel: number; plowFactor: number };
    T(`  R: Ausleger ${(b.boomAngle * GRAD).toFixed(2)}° v ${(x.boomVel * GRAD).toFixed(2)}°/s Pflug ${x.plowFactor.toFixed(2)} blockiert ${b.armBlocked} anWand ${b.lastAnWand} ueberlast ${b.ueberlast} Wrack ${lageText(car, yRuhe)}`);
  };

  // 3. zudruecken
  s.phase = "zufassen";
  s.tasten.down.add("Space");
  let reissen = "";
  halte(s, [], 90, () => {
    if (s.grip.tearing) reissen = s.grip.tearing.name;
  });
  const gefasstRumpf = s.grip.grippedBodies.some((g) => g.handle === car.body.handle);
  const gefasst = gefasstRumpf ? "Rumpf" : s.grip.grippedCount > 0 ? `Teil (${s.teile.join(",") || "?"})` : reissen ? `reisst ${reissen}` : "nein";
  const rGriff = b.ausladungM;
  T(`zugedrueckt: ${gefasst}, Wrack ${lageText(car, yRuhe)}`);
  const kopf = zeileKopf(lageId, abstand, stelle, pratzen, rStelle);
  const fasst = `${gefasst.padEnd(9)} ${rGriff.toFixed(2).padStart(5)}`;
  if (!gefasstRumpf) {
    const kontakte = b.krallenKontakte(car.body);
    // Diagnose wie grossteil-greifen-kern: naechster Oberflaechenpunkt im Korb?
    const sp = b.getSensorPosition(new THREE.Vector3());
    let best = Infinity;
    const q = new THREE.Vector3();
    for (let i = 0; i < car.body.numColliders(); i++) {
      const pr = car.body.collider(i).projectPoint(sp, true);
      if (!pr) continue;
      const d = sp.distanceTo(new THREE.Vector3(pr.point.x, pr.point.y, pr.point.z));
      if (d < best) {
        best = d;
        q.set(pr.point.x, pr.point.y, pr.point.z);
      }
    }
    const zeile = `${kopf} ${fasst}  nicht gefasst: Sensor ${best.toFixed(2)}/${FUENFSCHALEN.sensorRadius.toFixed(2)} m, im Korb ${b.isInsideGrapple(q) ? "ja" : "nein"}, Schalen an ${kontakte}, Schluss ${b.closure.toFixed(2)}`;
    s.world.free();
    return { ende, ziel, ergebnis: { zeile: zeile + (spur.length ? "\n" + spur.join("\n") : ""), physMs: s.physMs, koerper: 0, kollider: 0 } };
  }

  // Ab dem Zufassen: wie tief steckt das Wrack hoechstens im Beton (m)?
  let sinkMax = Math.max(0, -tiefsterPunkt(car.body));
  const beobachte = (): void => {
    sinkMax = Math.max(sinkMax, -tiefsterPunkt(car.body));
  };
  /** haengt frei: tiefster Punkt mehr als 10 cm ueber dem Beton */
  const inLuft = (): boolean => tiefsterPunkt(car.body) > 0.1;
  interface Versuch {
    r: number;
    meld: number;
    hub: number;
    ansch: boolean;
    grenze: number;
  }
  /** 2 s Ausleger heben (R) — meldet er Ueberlast, steht er, kommt er an den Anschlag? */
  const hebeVersuch = (): Versuch => {
    const m = s.meldungen.length;
    const y0 = car.body.translation().y;
    const r = b.ausladungM;
    const grenze = b.traglastKg;
    halte(s, ["KeyR"], 120, () => {
      spurHeben();
      beobachte();
    });
    halte(s, [], 15, beobachte);
    return { r, meld: s.meldungen.length - m, hub: car.body.translation().y - y0, ansch: b.boomAngle >= BOOM_MAX - 0.002, grenze };
  };
  const zelle = (v: Versuch): string =>
    `${v.r.toFixed(2).padStart(5)} ${v.meld > 0 ? "ja" : "nein"}(${v.meld}) ${v.hub > 0.02 ? (v.ansch ? "ANSCH" : "HEBT ") : "steht"} ${(v.hub * 100).toFixed(0).padStart(4)}cm ${(v.grenze / 1000).toFixed(2)}t`;

  // 4. weit: heben, dann ausfahren
  s.phase = "weit";
  const w = hebeVersuch();
  T(`weit heben: Meldungen ${w.meld}, Hub ${w.hub.toFixed(3)} m, Anschlag ${w.ansch}, Grenze ${w.grenze.toFixed(0)} kg; Wrack ${lageText(car, yRuhe)}`);
  const r1 = b.ausladungM;
  const mT = s.meldungen.length;
  halte(s, ["KeyT"], 30, beobachte);
  halte(s, [], 15);
  T(`weit ausfahren (T 0,5 s): Ausladung ${(b.ausladungM - r1).toFixed(3)} m, Meldungen ${s.meldungen.length - mT}`);

  // 5./6. heranziehen am Boden (nur, solange es noch aufliegt), an jedem Halt heben
  const nah: string[] = [];
  let zieh = "—";
  if (!inLuft()) {
    s.phase = "heranziehen";
    const rStart = b.ausladungM;
    const xz0 = car.body.translation();
    let vZiehen = 0;
    let blockiert = 0;
    let anWand = 0;
    let sekGesamt = 0;
    for (const rZiel of [NAH_M, 0]) {
      if (inLuft()) break;
      let altR = b.ausladungM;
      let still = 0;
      const bild0 = s.physMs.length;
      halte(s, ["KeyG"], 600, () => {
        beobachte();
        const v = car.body.linvel();
        vZiehen = Math.max(vZiehen, Math.hypot(v.x, v.y, v.z));
        if (b.armBlocked) blockiert++;
        if (b.lastAnWand) anWand++;
        still = altR - b.ausladungM < 0.0005 ? still + 1 : 0;
        altR = b.ausladungM;
        return b.ausladungM <= rZiel || still >= 30;
      });
      halte(s, [], 15, beobachte);
      sekGesamt += (s.physMs.length - bild0) / 60;
      T(`heranziehen bis ${rZiel ? rZiel.toFixed(1) + " m" : "Anschlag"}: Ausladung ${b.ausladungM.toFixed(2)} m, ${blockiert} Bilder blockiert, davon Last an Boden/Wand (E-145/E-158) ${anWand}; Wrack ${lageText(car, yRuhe)}`);
      s.phase = "heben nah";
      const v = hebeVersuch();
      nah.push(zelle(v));
      T(`heben bei ${v.r.toFixed(2)} m: Meldungen ${v.meld}, Hub ${v.hub.toFixed(3)} m, Anschlag ${v.ansch}, Grenze ${v.grenze.toFixed(0)} kg`);
      s.phase = "heranziehen";
    }
    const xz1 = car.body.translation();
    zieh = `${rStart.toFixed(2)}→${b.ausladungM.toFixed(2)}m in ${sekGesamt.toFixed(0)}s, Wrack ${Math.hypot(xz1.x - xz0.x, xz1.z - xz0.z).toFixed(2)}m, v${vZiehen.toFixed(2)}, gesperrt ${blockiert}`;
  }

  // 7. schwenken — mit Last in der Luft bis zum Ablegen, sonst am Boden
  const yaw0 = b.cabYaw;
  let schwenk: string;
  let ablage = "";
  if (inLuft()) {
    s.phase = "schwenken mit Last";
    halte(s, ["KeyQ"], 90, beobachte);
    halte(s, [], 60, beobachte);
    schwenk = `${((b.cabYaw - yaw0) * GRAD).toFixed(0)}° in 1,5 s mit Last`;
    s.phase = "absetzen";
    // senken, bis das Wrack aufsetzt (tiefster Punkt am Beton) — nicht aus der Luft fallen lassen;
    // steht der Arm vorher 0,5 s still (nach mindestens 1,5 s), wird dort losgelassen
    let altY = car.body.translation().y;
    let ruhig = 0;
    let n = 0;
    halte(s, ["KeyF"], 600, () => {
      beobachte();
      n++;
      const y = car.body.translation().y;
      ruhig = altY - y < 0.0005 ? ruhig + 1 : 0;
      altY = y;
      return tiefsterPunkt(car.body) <= 0.03 || (n > 90 && ruhig >= 30);
    });
    halte(s, [], 20, beobachte);
    const hoeheLos = tiefsterPunkt(car.body);
    s.phase = "losgelassen";
    s.tasten.down.delete("Space");
    let vLos = 0;
    halte(s, [], 180, () => {
      beobachte();
      const v = car.body.linvel();
      vLos = Math.max(vLos, Math.hypot(v.x, v.y, v.z));
    });
    const tEnd = car.body.translation();
    ablage = `losgelassen ${(hoeheLos * 100).toFixed(0)} cm ueber Beton, abgelegt ${Math.hypot(tEnd.x - b.position.x, tEnd.z - b.position.z).toFixed(2)} m vom Bagger, v nach Loslassen ${vLos.toFixed(2)} m/s, ${lageText(car, yRuhe)}`;
  } else {
    s.phase = "schwenken am Boden";
    const p0 = car.body.translation();
    halte(s, ["KeyQ"], 60, beobachte);
    halte(s, [], 15, beobachte);
    const p1 = car.body.translation();
    schwenk = `${((b.cabYaw - yaw0) * GRAD).toFixed(0)}° in 1 s am Boden, Wrack ${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(2)} m geschleift`;
  }
  T(`schwenken: ${schwenk}${ablage ? "; " + ablage : ""}`);

  const zeile =
    `${kopf} ${fasst} ${(masse / 1000).toFixed(2)}t | WEIT ${zelle(w)} | NAH ${nah.join(" ; ") || "—"} | zieh ${zieh} | schw ${schwenk}` +
    `${ablage ? " | " + ablage : ""} | Beton max ${(sinkMax * 100).toFixed(0)}cm | frei-vmax ${s.vFreiMax.toFixed(2)} (${s.vFreiPhase}) ausr ${s.ausreisserBilder}${s.nan ? " NaN!" : ""}` +
    (spur.length ? "\n" + spur.join("\n") : "");
  const koerper = s.world.bodies.len();
  const kollider = s.world.colliders.len();
  const physMs = s.physMs.slice();
  s.world.free();
  return { ende, ziel, ergebnis: { zeile, physMs, koerper, kollider } };
}

/** Tiefster Punkt aller Quader-Kollider (m) */
function tiefsterPunkt(body: RAPIER.RigidBody): number {
  let min = Infinity;
  const v = new THREE.Vector3();
  for (let i = 0; i < body.numColliders(); i++) {
    const c = body.collider(i);
    const he = (c as unknown as { halfExtents(): { x: number; y: number; z: number } | null }).halfExtents?.();
    if (!he) continue;
    const t = c.translation();
    const r = c.rotation();
    const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      v.set(sx * he.x, sy * he.y, sz * he.z).applyQuaternion(q);
      min = Math.min(min, t.y + v.y);
    }
  }
  return min;
}
/** Lage des Wracks: Hoehe des Ursprungs ueber Ruhe, Kippen, tiefster Punkt */
function lageText(car: CarComposite, yRuhe: number): string {
  const t = car.body.translation();
  const r = car.body.rotation();
  const oben = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w));
  return `${((t.y - yRuhe) * 100).toFixed(0)} cm ueber Ruhe, gekippt ${(Math.acos(Math.min(1, oben.y)) * GRAD).toFixed(1)}°, tiefster Punkt ${tiefsterPunkt(car.body).toFixed(2)} m`;
}

function zeileKopf(lageId: string, abstand: number, stelle: Stelle, pratzen: boolean, rStelle: number): string {
  return `${lageId.padEnd(6)} ${abstand.toFixed(1).padStart(4)}m ${stelle.id.padEnd(6)} ${pratzen ? "Pratzen" : "frei   "} ${rStelle.toFixed(2).padStart(5)}`;
}

/* ---------------------------------------------------------------------- */
/* Platzrechnung: Startplatz und Ablageflaeche (reine Geometrie)           */
/* ---------------------------------------------------------------------- */

const KAMMER = {
  x0: PRESS_CENTER.x - (PRESS_INNER.laenge + 0.7) / 2,
  x1: PRESS_CENTER.x + (PRESS_INNER.laenge + 0.7) / 2,
  z0: PRESS_CENTER.z - (PRESS_INNER.tiefe + 0.7) / 2,
  z1: PRESS_CENTER.z + (PRESS_INNER.tiefe + 0.7) / 2,
};

/** Was liegt an (x, z)? Leer = frei. `rand`: Sicherheitsabstand (m). */
function belegt(x: number, z: number, rand: number): string {
  if (x < YARD_MIN_X + 0.5 + rand || x > YARD_MAX_X - 0.5 - rand) return "Mauer";
  for (const c of CONFIGS) {
    if (Math.abs(x - c.x) < c.size[0] / 2 + rand && Math.abs(z - c.z) < c.size[1] / 2 + rand) return c.label;
  }
  for (const o of STATIC_OBSTACLES) {
    if (Math.abs(x - o.x) < o.hw + rand && Math.abs(z - o.z) < o.hd + rand) return o.label ?? "Hindernis";
  }
  if (x > KAMMER.x0 - rand && x < KAMMER.x1 + rand && z > KAMMER.z0 - rand && z < KAMMER.z1 + rand) return "Presse";
  // Besenrolle 2,70 x 1,12 m, Umkreis 1,46 m (startplatz.ts)
  if (Math.hypot(x - BESEN_PLATZ.x, z - BESEN_PLATZ.z) < 1.46 + rand) return "Besen";
  // Kipper am Abladeplatz: Spur endet im Halt (6,3 | -23,0), der Wagen steht bis z -27,6 (startplatz.ts, E-135); Abkippstelle davor
  // 1,35 m = halbe Ladeflaeche (BED_HALF_W, fahrspuren.ts); SW: +0,6 m Kabine/Spiegel, +1 m vor dem Halt, +2 m hinter dem Heck (Abkippstelle)
  if (Math.abs(x - ABLADE_SPUR_X) < 1.35 + 0.6 + rand && z < ABLADE_HALT_Z + 1 && z > -27.6 - 2.0 - rand) return "Abladeplatz";
  const sp = naechsteSpur(x, z);
  if (sp.abstand < SPUR_HALB + SPURRAND && SPURRAND >= 0) return `Spur ${sp.name}`;
  return "";
}

/** Grundriss eines Rechtecks (Mitte, Gier, halbe Masse) abtasten. */
function grundrissFrei(mx: number, mz: number, gier: number, hb: number, hl: number, rand: number): string {
  for (let a = -hb; a <= hb + 1e-6; a += hb / 2) {
    for (let l = -hl; l <= hl + 1e-6; l += hl / 4) {
      const p = weltpunkt(new THREE.Vector3(mx, 0, mz), gier, a, l);
      const w = belegt(p.x, p.z, rand);
      if (w) return w;
    }
  }
  return "";
}

function platz(): void {
  const st = BAGGER_STAND;
  console.log(`\nPLATZ (Stand ${st.x} | ${st.z}, Blick +z). LKW 6,00 x 2,50 m, Rand ${RAND} m zu allem, Spurrand ${SPURRAND < 0 ? "aus" : SPUR_HALB + " + " + SPURRAND + " m"}.`);
  const f = FUENFSCHALEN.eigengewichtKg;
  const grenze = (kg: number, abg: boolean): number => {
    let r = 3.7;
    while (r < 12 && nutzlastKg(r, f, 1, abg) >= kg) r += 0.01;
    return r - 0.01;
  };
  console.log(`Traglast (gerechnet, traglast.ts): 7 000 kg frei ${nutzlastKg(3.7, f, 1, false) >= 7000 ? grenze(7000, false).toFixed(2) + " m" : "nie (nah " + (nutzlastKg(3.7, f, 1, false) / 1000).toFixed(2) + " t)"}, mit Pratzen bis ${grenze(7000, true).toFixed(2)} m`);
  console.log(`                                   4 990 kg frei bis ${grenze(4990, false).toFixed(2)} m, mit Pratzen bis ${grenze(4990, true).toFixed(2)} m`);
  // Stahlhalde
  const halde = CONFIGS.find((c) => c.id === "c_steel")!;
  let haldeNah = Infinity;
  for (let x = halde.x - halde.size[0] / 2; x <= halde.x + halde.size[0] / 2; x += 0.05)
    for (let z = halde.z - halde.size[1] / 2; z <= halde.z + halde.size[1] / 2; z += 0.05)
      haldeNah = Math.min(haldeNah, Math.hypot(x - st.x, z - st.z));
  console.log(`STAHLSCHROTT x ${halde.x - halde.size[0] / 2}…${halde.x + halde.size[0] / 2}, z ${halde.z - halde.size[1] / 2}…${halde.z + halde.size[1] / 2}: naechster Punkt ${haldeNah.toFixed(2)} m von der Drehmitte, Mitte ${Math.hypot(halde.x - st.x, halde.z - st.z).toFixed(2)} m`);

  // Startplaetze: Mitte 7,5…9,0 m, frei, je Lage
  console.log(`\nStartplatz-Kandidaten (Mitte 7,0–9,0 m vom Stand, Wrack frei mit 0,5 m Rand; Winkel 0° = geradeaus, + = rechts/−x? siehe Spalte x):`);
  const kand: Array<{ x: number; z: number; gier: string; r: number; w: number }> = [];
  for (let r = 7.0; r <= 9.01; r += 0.25) {
    for (let w = -180; w < 180; w += 5) {
      const x = st.x + r * Math.sin(w / GRAD);
      const z = st.z + r * Math.cos(w / GRAD);
      for (const [name, rel] of [["quer", Math.PI / 2], ["laengs", Math.PI]] as const) {
        const g = w / GRAD + rel; // quer: tangential, laengs: Schnauze zum Bagger
        if (!grundrissFrei(x, z, g, 1.25, 3.0, RAND)) kand.push({ x, z, gier: name, r, w });
      }
    }
  }
  const nachWinkel = new Map<string, typeof kand>();
  for (const k of kand) {
    const key = `${k.gier} ${k.w}`;
    if (!nachWinkel.has(key)) nachWinkel.set(key, []);
    nachWinkel.get(key)!.push(k);
  }
  for (const [key, ks] of [...nachWinkel].sort((a, b) => Math.abs(Number(a[0].split(" ")[1])) - Math.abs(Number(b[0].split(" ")[1])))) {
    console.log(`  ${key.padEnd(12)}°: r ${ks.map((k) => k.r.toFixed(2)).join(" ")}  (z. B. ${ks[0]!.x.toFixed(1)} | ${ks[0]!.z.toFixed(1)})`);
  }

  // Ablageflaechen: Wrack-Mitte 4,5…6,0 m, frei, je Lage
  console.log(`\nAblageflaeche-Kandidaten (Wrack-Mitte 4,5–8,0 m vom Stand, frei mit 0,5 m Rand):`);
  const abl = new Map<string, string[]>();
  for (let r = 4.5; r <= 8.01; r += 0.25) {
    for (let w = -180; w < 180; w += 5) {
      const x = st.x + r * Math.sin(w / GRAD);
      const z = st.z + r * Math.cos(w / GRAD);
      for (const [name, rel] of [["quer", Math.PI / 2], ["laengs", Math.PI]] as const) {
        const g = w / GRAD + rel;
        const grund = grundrissFrei(x, z, g, 1.25, 3.0, RAND);
        // die Maschine selbst: Unterwagen-Umkreis 2,66 m (excavator.ts UNTERWAGEN_R) + Pratzen (~3 m) — Wrackgrundriss darf nicht hinein
        let zuNah = false;
        for (let a = -1.25; a <= 1.25; a += 0.625)
          for (let l = -3; l <= 3; l += 0.75) {
            const p = weltpunkt(new THREE.Vector3(x, 0, z), g, a, l);
            if (Math.hypot(p.x - st.x, p.z - st.z) < 3.2) zuNah = true; // SW: 2,66 m Unterwagen + 0,5 m Rand
          }
        if (!grund && !zuNah) {
          const key = `${name} ${w}`;
          if (!abl.has(key)) abl.set(key, []);
          abl.get(key)!.push(`${r.toFixed(2)}`);
        }
      }
    }
  }
  for (const [key, rs] of [...abl].sort((a, b) => Math.abs(Number(a[0].split(" ")[1])) - Math.abs(Number(b[0].split(" ")[1])))) {
    const w = Number(key.split(" ")[1]);
    const r0 = Number(rs[0]);
    console.log(`  ${key.padEnd(12)}°: r ${rs.join(" ")}  (z. B. ${(st.x + r0 * Math.sin(w / GRAD)).toFixed(1)} | ${(st.z + r0 * Math.cos(w / GRAD)).toFixed(1)})`);
  }
  // Karte: was liegt in welcher Richtung (Punkt, ohne Rand)
  console.log(`\nKarte um den Stand (Winkel: 0° = +z geradeaus, +90° = +x; je Radius, was dort liegt, „·" = frei):`);
  const rs = [4, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5];
  console.log(`  Winkel  ${rs.map((r) => r.toFixed(1).padStart(10)).join("")}`);
  for (let w = -180; w < 180; w += 15) {
    const zellen = rs.map((r) => {
      const x = st.x + r * Math.sin(w / GRAD);
      const z = st.z + r * Math.cos(w / GRAD);
      return (belegt(x, z, 0).slice(0, 9) || "·").padStart(10);
    });
    console.log(`  ${String(w).padStart(5)}°  ${zellen.join("")}`);
  }
  // Einzelpruefung bekannter Punkte
  console.log(`\nBelegt-Pruefung einzelner Punkte (Wrack-Grundriss, Rand 0,5 m):`);
  for (const [n, x, z, g] of [
    ["geradeaus 8 m quer", st.x, st.z + 8, Math.PI / 2],
    ["geradeaus 8 m laengs", st.x, st.z + 8, Math.PI],
    ["Stahlhalde vorn, laengs x", 4.0, -30.35, Math.PI / 2],
  ] as const) {
    console.log(`  ${n.padEnd(28)} (${x.toFixed(1)} | ${z.toFixed(1)}) r ${Math.hypot(x - st.x, z - st.z).toFixed(2)} m: ${grundrissFrei(x, z, g, 1.25, 3.0, RAND) || "frei"}`);
  }
}

/* ---------------------------------------------------------------------- */

async function main(): Promise<void> {
  leinwandAttrappe();
  await initPhysics();
  // PRUEFE="x,z,gierGrad;…": Grundriss des LKW (6,00 x 2,50 m) an dieser Stelle gegen den Platz pruefen
  if (process.env.PRUEFE) {
    for (const teil of process.env.PRUEFE.split(";")) {
      const [x, z, g] = teil.split(",").map(Number) as [number, number, number];
      const st = BAGGER_STAND;
      const ecken = [-1.25, 1.25].flatMap((a) => [-3, 3].map((l) => weltpunkt(new THREE.Vector3(x, 0, z), g / GRAD, a, l)));
      const rs = ecken.map((p) => Math.hypot(p.x - st.x, p.z - st.z));
      let spurMin = Infinity;
      for (let a = -1.25; a <= 1.25; a += 0.25)
        for (let l = -3; l <= 3; l += 0.25) {
          const p = weltpunkt(new THREE.Vector3(x, 0, z), g / GRAD, a, l);
          spurMin = Math.min(spurMin, naechsteSpur(p.x, p.z).abstand);
        }
      const winkel = (Math.atan2(x - st.x, z - st.z) * GRAD).toFixed(0);
      console.log(
        `(${x} | ${z}) Gier ${g}°: Mitte ${Math.hypot(x - st.x, z - st.z).toFixed(2)} m bei ${winkel}°, Ecken ${Math.min(...rs).toFixed(2)}–${Math.max(...rs).toFixed(2)} m · ` +
          `Rand 0,5: ${grundrissFrei(x, z, g / GRAD, 1.25, 3.0, 0.5) || "frei"} · Rand 0,3: ${grundrissFrei(x, z, g / GRAD, 1.25, 3.0, 0.3) || "frei"} · naechste Spur(mitte) ${spurMin.toFixed(2)} m (halbe Spurbreite ${SPUR_HALB})`
      );
    }
    return;
  }
  if (process.env.PLATZ === "1") {
    platz();
    return;
  }
  const rumpf = process.env.MASSE === "rumpf";
  const lagen = (process.env.LAGE ?? "quer,laengs").split(",");
  const abstaende = (process.env.ABSTAND ?? "7,8,9").split(",").map(Number);
  const stellen = STELLEN.filter((st) => !process.env.STELLE || process.env.STELLE.split(",").includes(st.id));
  const pratzenListe = process.env.PRATZEN ? [process.env.PRATZEN === "1"] : [false, true];
  console.log(`LKW-Wrack ${rumpf ? "ausgeschlachtet (Rumpf 4 990 kg)" : "ganz (7 000 kg)"}, Fuenfschalengreifer ${FUENFSCHALEN.eigengewichtKg} kg, Stand (${BAGGER_STAND.x} | ${BAGGER_STAND.z})`);
  console.log("Spalten: Lage Abstand(Mitte) Stelle Pratzen r(Stelle) | gefasst r(Griff) | WEIT: Meldung(n) Hub Grenze | je Halt beim Heranziehen: r Meldung Hub Grenze | Heranziehen: r von→bis, Weg des Wracks, groesstes Anheben ueber Ruhe, v | Schwenk | Masse | freie Koerper");
  const alleMs: number[] = [];
  let koerper = 0;
  let kollider = 0;
  for (const lageId of lagen)
    for (const abstand of abstaende)
      for (const stelle of stellen)
        for (const pratzen of pratzenListe) {
          const v = lauf(lageId, abstand, stelle, pratzen, rumpf, { x: 0, z: 0 }, true);
          const korrektur = { x: v.ende.x - v.ziel.x, z: v.ende.z - v.ziel.z };
          const h = lauf(lageId, abstand, stelle, pratzen, rumpf, korrektur, false);
          if (!h.ergebnis) continue;
          console.log(h.ergebnis.zeile);
          alleMs.push(...h.ergebnis.physMs);
          koerper = Math.max(koerper, h.ergebnis.koerper);
          kollider = Math.max(kollider, h.ergebnis.kollider);
        }
  if (alleMs.length) {
    const sortiert = alleMs.slice().sort((a, b) => a - b);
    const mittel = alleMs.reduce((a, b) => a + b, 0) / alleMs.length;
    console.log(
      `\nPhysik je Schritt (PC, Node): Mittel ${mittel.toFixed(3)} ms, Median ${sortiert[Math.floor(sortiert.length / 2)]!.toFixed(3)} ms, p95 ${sortiert[Math.floor(sortiert.length * 0.95)]!.toFixed(3)} ms, p99 ${sortiert[Math.floor(sortiert.length * 0.99)]!.toFixed(3)} ms, max ${sortiert[sortiert.length - 1]!.toFixed(2)} ms ueber ${alleMs.length} Schritte · Koerper ${koerper} · Kollider ${kollider}`
    );
  }
}

await main();
