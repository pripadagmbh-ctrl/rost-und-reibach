/**
 * DIE WERKBANK FUER DIE AUFGABEN 2–6 (G3, 20.10.2026) — der Aufgaben-Platz
 * kopflos, so wie `main.ts` ihn fuer eine Aufgabe baut.
 *
 * Echter Platz (`Yard`: Boden, Mauern, Bucht, schraege Mauer, Quermauer —
 * E-182), echte Behaelter samt beweglicher MUELL-Mulde (`ContainerManager`),
 * echte Presse, echter Bagger mit Greifsystem, Fahrkunst und die echten
 * Quellen (`weltQuellen`). Verdrahtung und Schrittfolge wie `main.ts`
 * (`schrittInhalt`, Haken an Greifer und Bagger, Aufschlaege auf den Bus).
 * Kein Startauto, kein Haufen, kein Besen — wie im Aufgaben-Zweig von main.ts.
 *
 * Nur fuer Tests und Messungen; nichts hier ist Spielcode.
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Excavator } from "../src/excavator/excavator";
import { GripSystem } from "../src/physics/gripSystem";
import { PhysicsWorld } from "../src/physics/physicsWorld";
import { formZu, setzeGreifer } from "../src/excavator/greiferwahl";
import { ferroAnteilVon } from "../src/excavator/magnet";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { ContainerManager } from "../src/world/containers";
import { PressManager } from "../src/world/press";
import { Yard } from "../src/world/yard";
import { EventBus, type GameEvents } from "../src/core/events";
import { lastAufschlagWucht } from "../src/audio/klangregeln";
import { Fahrkunst } from "../src/skills/fahrkunst";
import { ChallengeLauf, type ChallengeDaten } from "../src/challenges/challenge";
import { baueAufgabe, type AufgabenObjekte } from "../src/challenges/aufbau";
import { weltQuellen } from "../src/challenges/quellen";
import { challengeNr } from "../src/challenges/katalog";

export const DT = 1 / 60;
export const GRAD = 180 / Math.PI;

/**
 * Leinwand-Attrappe fuer Platz UND Bagger — wie die in `tools/platzlast.ts`:
 * Der Platzboden ruft auf dem Farbverlauf `addColorStop`, die einfache
 * Attrappe (`tools/leinwand-attrappe.ts`) liefert dort `undefined`. Hier
 * kommt fuer jeden Aufruf wieder eine Attrappe zurueck. Vor `RAPIER.init`
 * oder spaetestens vor `werkbank()` aufrufen.
 */
export function platzLeinwand(): void {
  if (typeof (globalThis as Record<string, unknown>).document !== "undefined") return;
  const attrappe = (): unknown =>
    new Proxy(
      {},
      {
        get: (ziel: Record<string, unknown>, feld: string) => (feld in ziel ? ziel[feld] : attrappe),
        set: (ziel: Record<string, unknown>, feld: string, wert: unknown) => {
          ziel[feld] = wert;
          return true;
        },
      }
    );
  const ctx = attrappe() as Record<string, unknown>;
  ctx.measureText = (): { width: number } => ({ width: 0 });
  (globalThis as Record<string, unknown>).requestAnimationFrame = (): number => 0;
  (globalThis as Record<string, unknown>).document = {
    createElement: (): unknown => {
      const leinwand = {
        width: 0,
        height: 0,
        getContext: () => ctx,
        toDataURL: () => "",
        style: {},
        addEventListener: () => {},
        removeEventListener: () => {},
      };
      ctx.canvas = leinwand;
      return leinwand;
    },
  };
}

/** Tastatur-Attrappe wie in `test/aufgabe1.test.ts` */
export class Tasten {
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

export interface Werkbank {
  world: RAPIER.World;
  bus: EventBus;
  items: ItemManager;
  composites: CompositeManager;
  containers: ContainerManager;
  press: PressManager;
  b: Excavator;
  grip: GripSystem;
  fahrkunst: Fahrkunst;
  tasten: Tasten;
  /** Alle Ereignisse, die eine Messung braucht */
  aufpralle: Array<GameEvents["schrott:aufprall"]>;
  ueberlasten: Array<GameEvents["greifer:ueberlast"]>;
  abrisse: Array<GameEvents["wrack:abriss"]>;
  knautsch: Array<GameEvents["wrack:geknautscht"]>;
  /** Physik-ms je Schritt */
  physMs: number[];
  /** ein Schritt wie `schrittInhalt` in main.ts */
  takt(): void;
}

export function werkbank(): Werkbank {
  const phys = new PhysicsWorld();
  const world = phys.world;
  const scene = new THREE.Scene();
  const bus = new EventBus();
  new Yard(scene, world);
  const items = new ItemManager(scene, world);
  const containers = new ContainerManager(scene, world, bus);
  const composites = new CompositeManager(scene, world, items, bus);
  const press = new PressManager(scene, world, items, composites);
  const b = new Excavator(scene, world);
  const grip = new GripSystem(world, b.grappleBody);
  setzeGreifer(b, grip, formZu("fuenfschalen"));
  // --- Haken wie main.ts ---
  grip.ferroAnteil = (body) => ferroAnteilVon(body, items, composites.cars);
  b.onUeberlast = (e) => bus.emit("greifer:ueberlast", e);
  b.onClawBite = (e) => bus.emit("greifer:zugedrueckt", e);
  grip.partResolver = (pos) => composites.findPartNear(pos);
  grip.getViolence = () => b.tearViolence;
  grip.insideGrapple = (pos) => b.isInsideGrapple(pos);
  grip.krallenKontakte = (body) => b.krallenKontakte(body);
  grip.onReleaseGrace = () => b.startClawGrace();
  b.clawBlockedBy = (body) => {
    const it = items.itemByBody(body);
    return !it || !items.isCrushable(it);
  };
  const fahrkunst = new Fahrkunst(grip, b);
  fahrkunst.onZyklus = (e) => bus.emit("fahrkunst:zyklus", e);
  // Aufschlaege auf den Bus (main.ts: items.onAufprall, composites.onAufprall, onAufschlag, onAnschlag)
  const auf = (materialId: string, massKg: number, wucht: number, handle: number | undefined, p: { x: number; y: number; z: number }): void =>
    bus.emit("schrott:aufprall", { materialId, massKg, wucht, blech: true, untergrund: "beton", handle, x: p.x, y: p.y, z: p.z });
  items.onAufprall = (it, wucht) => auf(it.materialId, it.massKg, wucht, it.body.handle, it.body.translation());
  composites.onAufprall = (car, wucht) => auf("steel", car.body.mass(), wucht, car.body.handle, car.body.translation());
  const schwerstes = (): { materialId: string; handle: number } | null => {
    let best: { materialId: string; handle: number; kg: number } | null = null;
    for (const g of grip.grippedBodies) {
      const it = items.itemByBody(g);
      if (it && (!best || it.massKg > best.kg)) best = { materialId: it.materialId, handle: it.body.handle, kg: it.massKg };
    }
    return best;
  };
  b.onAufschlag = (tempo) => {
    const it = schwerstes();
    if (it) auf(it.materialId, grip.totalMassKg, lastAufschlagWucht(tempo), it.handle, b.grappleBody.translation());
  };
  b.onAnschlag = (e) => {
    if (!e.traegt) return;
    const it = schwerstes();
    auf(it?.materialId ?? "steel", grip.totalMassKg, lastAufschlagWucht(e.tempoMs), it?.handle ?? grip.grippedBodies[0]?.handle, e);
  };
  const aufpralle: Werkbank["aufpralle"] = [];
  const ueberlasten: Werkbank["ueberlasten"] = [];
  const abrisse: Werkbank["abrisse"] = [];
  const knautsch: Werkbank["knautsch"] = [];
  bus.on("schrott:aufprall", (e) => aufpralle.push(e));
  bus.on("greifer:ueberlast", (e) => ueberlasten.push(e));
  bus.on("wrack:abriss", (e) => abrisse.push(e));
  bus.on("wrack:geknautscht", (e) => knautsch.push(e));

  const tasten = new Tasten();
  const sensor = new THREE.Vector3();
  const physMs: number[] = [];
  let schritt = 0;
  const takt = (): void => {
    b.update(DT, tasten as never);
    b.getSensorPosition(sensor);
    grip.update(b.closure, b.closing, sensor, DT);
    fahrkunst.update(DT);
    b.carriedMassKg = grip.totalMassKg;
    b.carriedCount = grip.grippedCount;
    b.grippedHandles.clear();
    for (const g of grip.grippedBodies) b.grippedHandles.add(g.handle);
    for (const car of composites.cars) if (car.body.isValid()) b.obstacleBodies.add(car.body.handle);
    const t0 = performance.now();
    phys.step();
    physMs.push(performance.now() - t0);
    containers.bremseAlle();
    items.clampSpeeds(DT);
    items.settleSleep(DT, b.grappleBody.translation());
    composites.update();
    press.update(DT);
    if (++schritt % 10 === 0) containers.recount(items, new Set(grip.grippedBodies.map((g) => g.handle)));
  };
  for (let i = 0; i < 10; i++) takt();
  return { world, bus, items, composites, containers, press, b, grip, fahrkunst, tasten, aufpralle, ueberlasten, abrisse, knautsch, physMs, takt };
}

/** Wie `starteAufgabe` in main.ts: aufbauen, setzen, Greifer, Lauf. */
export function starteAufgabe(k: Werkbank, d: ChallengeDaten): { lauf: ChallengeLauf; obj: AufgabenObjekte } {
  const obj = baueAufgabe(d, { items: k.items, composites: k.composites });
  k.items.settle(k.world);
  if (d.aufbau.greifer) setzeGreifer(k.b, k.grip, formZu(d.aufbau.greifer));
  k.fahrkunst.ziel = d.ablageziel;
  k.fahrkunst.neuBeginnen();
  const lauf = new ChallengeLauf(
    d,
    challengeNr(d.id),
    weltQuellen({ bagger: k.b, grip: k.grip, containers: k.containers, items: k.items, press: k.press }),
    k.bus,
    obj
  );
  lauf.start();
  return { lauf, obj };
}

/** Koerper wach / gesamt — die Physik-Last einer Aufgabe. */
export function koerperZahl(world: RAPIER.World): { wach: number; gesamt: number; dynamisch: number } {
  let wach = 0;
  let dynamisch = 0;
  world.forEachRigidBody((body) => {
    if (!body.isDynamic()) return;
    dynamisch++;
    if (!body.isSleeping()) wach++;
  });
  return { wach, gesamt: world.bodies.len(), dynamisch };
}

/** Kleinster Winkel a − b, −π … π */
export function winkelDiff(a: number, b: number): number {
  let d = (a - b) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/**
 * Wie ein Mensch drehen (aus `test/aufgabe1.test.ts`): Taste halten, kurz
 * vorher loslassen, nachsteuern, bis der Oberwagen steht. `halten` bleibt
 * gedrueckt (z. B. die Leertaste, damit nichts herausfaellt).
 */
export function dreheAuf(k: Werkbank, soll: number, jeBild: () => void = () => {}, halten: string[] = []): void {
  let alt = k.b.cabinBaseYaw;
  for (let i = 0; i < 1200; i++) {
    const d = winkelDiff(soll, k.b.cabinBaseYaw);
    const dreht = Math.abs(k.b.cabinBaseYaw - alt) > 0.0002;
    alt = k.b.cabinBaseYaw;
    k.tasten.down.clear();
    for (const h of halten) k.tasten.down.add(h);
    if (Math.abs(d) > 1.5 / GRAD) k.tasten.down.add(d > 0 ? "KeyQ" : "KeyE");
    else if (!dreht) break;
    k.takt();
    jeBild();
  }
  k.tasten.down.clear();
  for (const h of halten) k.tasten.down.add(h);
}

/** Bilder laufen lassen, bis `bed` gilt (hoechstens `max`); `jeBild` nach jedem Schritt (z. B. `lauf.takt`). */
export function bis(k: Werkbank, bed: () => boolean, max: number, jeBild: () => void = () => {}): number {
  let i = 0;
  for (; i < max && !bed(); i++) {
    k.takt();
    jeBild();
  }
  return i;
}

/**
 * Eine gehaltene Last waagrecht ueber `ziel` fuehren, wie ein Fahrer es tut:
 * seitlich mit kurzen Dreh-Tipps (Q/E), radial mit Ausleger weg (T) bzw.
 * Hauptarm senken (F, wenn der Ausleger schon draussen ist) und heran (G);
 * faellt die Unterkante unter `minUnten`, erst heben (R). `halten` bleibt
 * gedrueckt (Leertaste: Spinne zu). Liefert den Restfehler (m).
 */
export function fuehreUeber(
  k: Werkbank,
  last: () => { x: number; z: number },
  ziel: { x: number; z: number },
  unten: () => number,
  minUnten: number,
  jeBild: () => void,
  halten: string[] = ["Space"],
  toleranz = 0.12
): number {
  const m = k.b.position;
  const zielR = Math.hypot(ziel.x - m.x, ziel.z - m.z);
  const zielW = Math.atan2(ziel.x - m.x, ziel.z - m.z);
  let fehler = Infinity;
  for (let i = 0; i < 1800; i++) {
    const p = last();
    const r = Math.hypot(p.x - m.x, p.z - m.z);
    const tang = winkelDiff(zielW, Math.atan2(p.x - m.x, p.z - m.z)) * r;
    const fehlR = zielR - r;
    fehler = Math.hypot(fehlR, tang);
    k.tasten.down.clear();
    for (const h of halten) k.tasten.down.add(h);
    if (Math.abs(fehlR) < toleranz && Math.abs(tang) < toleranz) break;
    if (unten() < minUnten) k.tasten.down.add("KeyR");
    else if (Math.abs(tang) > toleranz && i % 3 === 0) k.tasten.down.add(tang > 0 ? "KeyQ" : "KeyE");
    else if (fehlR > toleranz) k.tasten.down.add(k.b.stickAngle < -0.65 ? "KeyT" : "KeyF");
    else if (fehlR < -toleranz) k.tasten.down.add("KeyG");
    k.takt();
    jeBild();
  }
  k.tasten.down.clear();
  for (const h of halten) k.tasten.down.add(h);
  for (let i = 0; i < 60; i++) {
    k.takt();
    jeBild();
  }
  return fehler;
}

/**
 * Absenken, bis die Last aufsitzt: voll mit F, unter `langsamAb` m nur
 * noch getippt (jedes vierte Bild) — so setzt ein Fahrer ab, der kein
 * Krachen will. Fertig, wenn sich die Unterkante 40 Bilder nicht mehr
 * bewegt.
 */
export function setzeAb(k: Werkbank, unten: () => number, jeBild: () => void, halten: string[] = ["Space"], langsamAb = 1.0): void {
  let alt = unten();
  let still = 0;
  for (let i = 0; i < 1800 && still < 40; i++) {
    k.tasten.down.clear();
    for (const h of halten) k.tasten.down.add(h);
    if (unten() >= langsamAb || i % 4 === 0) k.tasten.down.add("KeyF");
    k.takt();
    jeBild();
    const u = unten();
    still = Math.abs(u - alt) < 0.002 ? still + 1 : 0;
    alt = u;
  }
  k.tasten.down.clear();
  for (const h of halten) k.tasten.down.add(h);
}

/*
 * Armgeometrie fuer den Test-Fahrer, abgeschrieben aus `excavator.ts`
 * (BOOM_PIVOT, BOOM_LEN, STICK_LEN, Grenzen; dort nicht exportiert) — nur, um
 * Zielwinkel zu schaetzen. Gestellt wird mit den Tasten, und nachgemessen
 * wird an der echten Lage (`grappleGroup`), wie `tools/schwere-last.ts`.
 */
const ARM = { pivZ: 0.55, pivY: 2.95, boom: 5.2, stick: 4.0, boomMin: 5, boomMax: 70, stickMin: -140, stickMax: -25 };

/** Hauptarm/Ausleger (Grad) fuer ein Gelenk in `r` m Ausladung und `y` m Hoehe; Ausleger haengend. */
export function armZiel(r: number, y: number): { boom: number; stick: number } | null {
  let best: { boom: number; stick: number } | null = null;
  let bestF = Infinity;
  for (let b = ARM.boomMin; b <= ARM.boomMax; b += 0.25)
    for (let st = ARM.stickMin; st <= ARM.stickMax; st += 0.25) {
      if (b + st > 0) continue;
      const bw = b / GRAD;
      const sw = (b + st) / GRAD;
      const rr = ARM.pivZ + ARM.boom * Math.cos(bw) + ARM.stick * Math.cos(sw);
      const yy = ARM.pivY + ARM.boom * Math.sin(bw) + ARM.stick * Math.sin(sw);
      const f = Math.hypot(rr - r, yy - y);
      if (f < bestF) [bestF, best] = [f, { boom: b, stick: st }];
    }
  return bestF < 0.15 ? best : null;
}

/**
 * Den Arm mit den Tasten auf ein Gelenk-Ziel (Ausladung, Hoehe) fahren — wie
 * ein Fahrer, der nach Augenmass nachsteuert: Zielwinkel schaetzen, hin
 * (nah am Ziel nur getippt), echte Lage messen, Ziel nachziehen. `stopp`
 * bricht ab (z. B. aufgesetzt). `halten` bleibt gedrueckt.
 */
export function stelleArm(k: Werkbank, r: number, y: number, jeBild: () => void, halten: string[] = [], stopp: () => boolean = () => false): boolean {
  let zr = r;
  let zy = y;
  const g = k.b.grappleGroup.position;
  const m = k.b.position;
  for (let runde = 0; runde < 3; runde++) {
    // Zu tief fuer diese Ausladung: so tief, wie der Arm dort kommt
    let z = armZiel(zr, zy);
    for (let h = 0.1; !z && h < 4; h += 0.1) z = armZiel(zr, zy + h);
    if (!z) return false;
    for (let i = 0; i < 600; i++) {
      const eb = z.boom - k.b.boomAngle * GRAD;
      const es = z.stick - k.b.stickAngle * GRAD;
      k.tasten.down.clear();
      for (const h of halten) k.tasten.down.add(h);
      if (Math.abs(eb) > 0.6 && (Math.abs(eb) > 4 || i % 3 === 0)) k.tasten.down.add(eb > 0 ? "KeyR" : "KeyF");
      if (Math.abs(es) > 0.6 && (Math.abs(es) > 4 || i % 3 === 0)) k.tasten.down.add(es > 0 ? "KeyT" : "KeyG");
      if (k.tasten.down.size === halten.length && i > 0) break;
      k.takt();
      jeBild();
      if (stopp()) return true;
    }
    k.tasten.down.clear();
    for (const h of halten) k.tasten.down.add(h);
    for (let i = 0; i < 20; i++) {
      k.takt();
      jeBild();
    }
    const ist = Math.hypot(g.x - m.x, g.z - m.z);
    if (Math.abs(ist - r) < 0.1 && Math.abs(g.y - y) < 0.15) return true;
    zr += r - ist;
    zy += y - g.y;
  }
  return true;
}

/** Schwenkhaltung des Test-Fahrers: Gelenk 7,0 m draussen, 5,6 m hoch — ueber allen Waenden bis 4,8 m, innerhalb der Suedost-Ecke der Bucht (9,1 m) */
export const SCHWENK_R = 7.0;
export const SCHWENK_Y = 5.6;

/**
 * Ein loses Teil holen, wie ein Fahrer: die leere Spinne hoch ueber die
 * Ausladung des Teils stellen, hindrehen, auf dieselbe Ausladung senken, bis
 * sie aufsitzt, zudruecken, `hubBilder` lang heben. Liefert, ob es haengt.
 */
export function greife(k: Werkbank, body: { handle: number; translation(): { x: number; y: number; z: number } }, jeBild: () => void, hubBilder = 90): boolean {
  const p = body.translation();
  const m = k.b.position;
  const r = Math.hypot(p.x - m.x, p.z - m.z);
  k.tasten.down.clear();
  // Schwenkhaltung: nah und hoch — weiter draussen streift die Spinne bei 120–150° die 4,8-m-Suedmauer an der Stahlhalde (E-182)
  stelleArm(k, SCHWENK_R, SCHWENK_Y, jeBild);
  dreheAuf(k, Math.atan2(p.x - m.x, p.z - m.z), jeBild);
  stelleArm(k, r, p.y + 3.2, jeBild);
  // senken, bis die Spinne aufsitzt (der Arm meldet die Sperre)
  stelleArm(k, r, Math.max(0.6, p.y + 0.4), jeBild, [], () => k.b.armBlocked);
  k.tasten.down.clear();
  k.tasten.down.add("KeyF");
  bis(k, () => false, 20, jeBild);
  k.tasten.down.clear();
  k.tasten.down.add("Space");
  bis(k, () => false, 90, jeBild);
  k.tasten.down.add("KeyR");
  bis(k, () => false, hubBilder, jeBild);
  k.tasten.down.delete("KeyR");
  return k.grip.grippedBodies.some((b) => b.handle === body.handle);
}

/**
 * Die gefasste Last ueber `ziel` bringen (Unterkante dabei mindestens
 * `minUnten` — ueber die Wand), dort `fallM` ueber dem Boden loslassen und
 * 2 s warten. `unten` misst die Unterkante der Last.
 */
export function legeAb(k: Werkbank, last: () => { x: number; y: number; z: number }, unten: () => number, ziel: { x: number; z: number }, minUnten: number, jeBild: () => void): void {
  const m = k.b.position;
  k.tasten.down.add("KeyR");
  bis(k, () => unten() >= minUnten, 300, jeBild);
  k.tasten.down.delete("KeyR");
  stelleArm(k, SCHWENK_R, SCHWENK_Y, jeBild, ["Space"]);
  dreheAuf(k, Math.atan2(ziel.x - m.x, ziel.z - m.z), jeBild, ["Space"]);
  fuehreUeber(k, last, ziel, unten, minUnten, jeBild);
  k.tasten.down.clear();
  bis(k, () => false, 120, jeBild);
}
