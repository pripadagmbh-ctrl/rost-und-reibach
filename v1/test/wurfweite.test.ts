/**
 * WAECHTER FUERS WERFEN (E-115, 22.09.2026).
 *
 * Ansage Patrick: „die spinne soll frei schwenken koennen und teile zur seite
 * durch schwung geschleudert werden koennen aber realistisch". Die drei Saetze
 * hier sind die drei Teile dieser Ansage, als Zahlen:
 *
 * 1. GESCHLEUDERT: Was aussen im Korb liegt, fliegt schneller los als was
 *    innen liegt. Vorher bekam jedes Teil dieselbe Zahl (die Bahn des
 *    Kardangelenks) — dann war „durch Schwung" nur ein Wort.
 *
 * 2. REALISTISCH — Obergrenze. Sie ist GERECHNET, nicht gesetzt:
 *
 *      Oberwagen   33°/s = 0,576 rad/s  ·  9,67 m groesste Ausladung des
 *                                          Korbes = 5,57 m/s
 *      Rotator    120°/s = 2,094 rad/s  ·  0,80 m Abstand von der
 *                                          Greiferachse = 1,68 m/s
 *      Fahren                                         = 3,20 m/s
 *      ------------------------------------------------------------
 *      v_max                                          = 10,45 m/s
 *
 *    Die 9,67 m sind am Modell abgegriffen (`npx vite-node tools/wurf.ts`,
 *    Abschnitt 3), die drei Raten stehen in `excavator.ts` (`CAB_MAX`,
 *    `ROTATOR_SPEED`, `DRIVE_MAX`). Mehr kann die Maschine einem Teil nicht
 *    mitgeben. Der Grund fuer diesen Waechter heisst E-073: Dort verliess
 *    Ladung den Kipper mit 65,7 m/s, Faktor 220 ueber allem, was die Bewegung
 *    hergab. So etwas soll hier nicht unbemerkt entstehen.
 *
 * 3. ABSETZEN BLEIBT ABSETZEN: Ohne Schwenk fliegt nichts weg. Das ist die
 *    andere Haelfte der Trennung in `releaseAll` — der Abwaertszuschlag und
 *    das Loeschen des Dralls gelten nur noch fuer diesen Fall.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { Excavator, CAB_MAX } from "../src/excavator/excavator";
import { GripSystem } from "../src/physics/gripSystem";
import { initPhysics } from "../src/physics/physicsWorld";
import { ItemManager } from "../src/world/scrapItems";

const DT = 1 / 60;
/** Groesste waagerechte Ausladung des Korbes (m) — `tools/wurf.ts` Abschnitt 3 */
const KORB_AUSLADUNG_MAX = 9.67;
/** ROTATOR_SPEED und DRIVE_MAX aus excavator.ts — dort nicht exportiert */
const ROTATOR_SPEED = THREE.MathUtils.degToRad(120);
const DRIVE_MAX = 3.2;
/** Was die Maschine hoechstens mitgeben kann (m/s) — Herleitung im Kopf der Datei */
const V_MAX = CAB_MAX * KORB_AUSLADUNG_MAX + ROTATOR_SPEED * 0.8 + DRIVE_MAX;

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
  world: RAPIER.World;
  bagger: Excavator;
  grip: GripSystem;
  tasten: Tasten;
}

function aufbau(): Stand {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(200, 0.5, 200), boden);
  const bagger = new Excavator(new THREE.Scene(), world);
  const grip = new GripSystem(world, bagger.grappleBody);
  const s: Stand = { world, bagger, grip, tasten: new Tasten() };
  for (let i = 0; i < 240; i++) {
    bagger.update(DT, s.tasten as never);
    world.step();
  }
  return s;
}

const korbP = new THREE.Vector3();
function korb(bagger: Excavator): THREE.Vector3 {
  return korbP
    .set(0, -bagger.greiferform.sensorSitz, 0)
    .applyQuaternion(bagger.grappleGroup.quaternion)
    .add(bagger.grappleGroup.position);
}

function schritt(s: Stand, tasten: string[]): void {
  s.tasten.down.clear();
  for (const t of tasten) s.tasten.down.add(t);
  s.bagger.carriedMassKg = s.grip.totalMassKg;
  s.bagger.grippedHandles.clear();
  for (const b of s.grip.grippedBodies) s.bagger.grippedHandles.add(b.handle);
  s.bagger.update(DT, s.tasten as never);
  s.grip.update(1, true, korb(s.bagger), DT);
  s.world.step();
}

/** Teil radial (in Ausladungsrichtung) versetzt in den Korb haengen. */
function haenge(s: Stand, massKg: number, versatzM: number): RAPIER.RigidBody {
  const p = korb(s.bagger).clone();
  const g = s.bagger.grappleGroup.position;
  const r = s.bagger.root.position;
  p.addScaledVector(new THREE.Vector3(g.x - r.x, 0, g.z - r.z).normalize(), versatzM);
  const b = s.world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z)
  );
  s.world.createCollider(RAPIER.ColliderDesc.cuboid(0.12, 0.12, 0.6).setMass(massKg), b);
  expect(s.grip.attachBody(b)).toBe(true);
  return b;
}

function tempo(b: RAPIER.RigidBody): number {
  const v = b.linvel();
  return Math.hypot(v.x, v.y, v.z);
}

beforeAll(async () => {
  leinwandAttrappe();
  await initPhysics();
});

describe("Werfen durch Schwung", () => {
  it("aussen im Korb fliegt schneller los als innen", () => {
    const s = aufbau();
    const teile = [-0.5, 0, 0.5].map((v) => haenge(s, 200, v));
    for (let i = 0; i < 300; i++) schritt(s, ["KeyQ"]);
    s.grip.releaseAll();
    const [innen, mitte, aussen] = teile.map(tempo) as [number, number, number];
    // Hebelarm 0,5 m bei 33°/s macht 0,29 m/s Unterschied — mindestens 0,15
    // davon muss ankommen, sonst rechnet `releaseAll` wieder mit einem Punkt
    expect(mitte - innen).toBeGreaterThan(0.15);
    expect(aussen - mitte).toBeGreaterThan(0.15);
    for (const v of [innen, mitte, aussen]) expect(Number.isFinite(v)).toBe(true);
  });

  it("der Drall bleibt beim Wurf erhalten", () => {
    const s = aufbau();
    const teil = haenge(s, 200, 0.5);
    for (let i = 0; i < 300; i++) schritt(s, ["KeyQ"]);
    s.grip.releaseAll();
    const w = teil.angvel();
    // Der Oberwagen dreht mit 0,576 rad/s; das Teil dreht mit ihm weiter
    expect(Math.hypot(w.x, w.y, w.z)).toBeGreaterThan(0.2);
  });

  it("schwer fliegt langsamer los als leicht", () => {
    const tempi = [80, 900].map((kg) => {
      const s = aufbau();
      const teil = haenge(s, kg, 0.5);
      for (let i = 0; i < 300; i++) schritt(s, ["KeyQ"]);
      s.grip.releaseAll();
      return tempo(teil);
    });
    expect(tempi[1]!).toBeLessThan(tempi[0]!);
  });

  it("kein Teil wird schneller, als die Maschine hergibt", () => {
    const s = aufbau();
    const teile = [-0.5, 0, 0.5].map((v) => haenge(s, 200, v));
    /*
     * Oberwagen und Stiel gleichzeitig. Der Rotator fehlt, weil er nur am
     * Mausrad und am Touchknopf haengt (keine Taste) — sein Anteil steckt
     * trotzdem in `V_MAX`, die Grenze ist also eher zu weit als zu eng.
     */
    for (let i = 0; i < 600; i++) schritt(s, ["KeyQ", "KeyT"]);
    s.grip.releaseAll();
    for (const t of teile) expect(tempo(t)).toBeLessThan(V_MAX);
    /*
     * Und im Flug auch nicht. Geprueft wird WAAGERECHT: Nach unten darf die
     * Schwerkraft beliebig beschleunigen, das ist kein Wurf. Seitlich darf
     * nichts dazukommen — sonst schiebt irgendetwas nach (E-073).
     */
    for (let i = 0; i < 300; i++) {
      s.bagger.carriedMassKg = 0;
      s.bagger.grippedHandles.clear();
      s.bagger.update(DT, s.tasten as never);
      s.world.step();
      for (const t of teile) {
        const v = t.linvel();
        expect(Math.hypot(v.x, v.z)).toBeLessThan(V_MAX);
      }
    }
  });

  it("reines Absetzen wirft nichts weg", () => {
    const s = aufbau();
    const teil = haenge(s, 400, 0.4);
    for (let i = 0; i < 180; i++) schritt(s, []);
    const vor = teil.translation();
    const start = new THREE.Vector3(vor.x, vor.y, vor.z);
    s.grip.releaseAll();
    const v = teil.linvel();
    // waagerecht praktisch null, und nach unten hoechstens der Zuschlag
    expect(Math.hypot(v.x, v.z)).toBeLessThan(0.2);
    expect(v.y).toBeLessThan(0);
    const w = teil.angvel();
    expect(Math.hypot(w.x, w.y, w.z)).toBe(0);
    for (let i = 0; i < 300; i++) {
      s.bagger.carriedMassKg = 0;
      s.bagger.grippedHandles.clear();
      s.bagger.update(DT, s.tasten as never);
      s.world.step();
    }
    const e = teil.translation();
    // es faellt hin, es fliegt nicht: unter einem halben Meter zur Seite
    expect(Math.hypot(e.x - start.x, e.z - start.z)).toBeLessThan(0.5);
  });
});

/*
 * E-132 (16.10.2026). Patrick: „ich will auch mehr schleudern koennen. Dafuer
 * muss die Winkelbegrenzung der Spinne raus und ich muss in der Lage sein,
 * Teile zur Seite zu schleudern."
 *
 * Die Bremse war die Daempfung des Pendels (Daempfungsgrad 0,98, kritisch);
 * sie steht jetzt auf 0,4. Der Wert ist das freieste Pendel, das sich auch mit
 * Absicht nicht ueber die Waagerechte schaukeln laesst — DAS bewacht der erste
 * Fall. Wer die Daempfung weiter senkt, sieht ihn rot werden (0,3: 106°).
 */
describe("Pendel ohne Bremse (E-132)", () => {
  const achse = new THREE.Vector3();
  const ausschlag = (b: Excavator): number => {
    achse.set(0, -1, 0).applyQuaternion(b.grappleGroup.quaternion);
    return Math.acos(THREE.MathUtils.clamp(-achse.y, -1, 1)) * (180 / Math.PI);
  };

  it("Aufschaukeln im Eigentakt: nie ueber die Waagerechte, Korb nie schneller als die Maschine, danach Ruhe", () => {
    const s = aufbau();
    // halbe Schwingdauer des Pendels pi·sqrt(L/g), L = 1,5 m
    const halbT = Math.round((Math.PI * Math.sqrt(1.5 / 9.81)) / DT);
    let hoechster = 0;
    let vKorb = 0;
    const vor = new THREE.Vector3();
    for (let i = 0; i < 900; i++) {
      vor.copy(korb(s.bagger));
      schritt(s, [Math.floor(i / halbT) % 2 === 0 ? "KeyQ" : "KeyE"]);
      const k = korb(s.bagger);
      vKorb = Math.max(vKorb, Math.hypot(k.x - vor.x, k.z - vor.z) / DT);
      hoechster = Math.max(hoechster, ausschlag(s.bagger));
    }
    // gemessen 88,5° und 6,03 m/s (tools/pendel-daempfung.ts)
    expect(hoechster).toBeGreaterThan(60); // das Pendel ist frei
    expect(hoechster).toBeLessThan(90);
    expect(vKorb).toBeLessThan(V_MAX);
    // Ruhe: gemessen 4,07 s bis unter 1°
    let ruhe = 0;
    for (let i = 0; i < 600; i++) {
      schritt(s, []);
      if (ausschlag(s.bagger) > 1) ruhe = (i + 1) * DT;
    }
    expect(ruhe).toBeLessThan(5);
    expect(ruhe).toBeGreaterThan(3); // und es schwingt wirklich nach
  });
});

/*
 * WURF IM SPIELTAKT (E-132). `main.ts` ruft nach jedem Physikschritt
 * `items.clampSpeeds`; die Faelle oben lassen das aus. Dort wurde ein
 * geworfenes Teil eine Bildzeit nach dem Loslassen auf `maxSpeedFor(m)`
 * gedeckelt — 900 kg von 4,73 auf 0,73 m/s, Weite 0,55 statt 2,70 m.
 */
describe("Wurf im Spieltakt, mit clampSpeeds (E-132)", () => {
  function wurfImTakt(massKg: number): { vAb: number; vFlug: number[] } {
    const s = aufbau();
    const items = new ItemManager(new THREE.Scene(), s.world);
    const teil = haenge(s, massKg, 0);
    items.register({ materialId: "steel", massKg, mesh: new THREE.Object3D(), body: teil });
    for (let i = 0; i < 150; i++) {
      schritt(s, ["KeyQ"]);
      items.clampSpeeds(DT);
    }
    s.grip.releaseAll();
    const v0 = teil.linvel();
    const vAb = Math.hypot(v0.x, v0.z);
    const vFlug: number[] = [];
    // 20 Bilder: das Teil ist noch in der Luft (Abwurfhoehe gut 2 m)
    for (let i = 0; i < 20; i++) {
      s.bagger.carriedMassKg = 0;
      s.bagger.grippedHandles.clear();
      s.bagger.update(DT, s.tasten as never);
      s.world.step();
      items.clampSpeeds(DT);
      const v = teil.linvel();
      vFlug.push(Math.hypot(v.x, v.z));
    }
    return { vAb, vFlug };
  }

  it("kein Katapult: auch im Spieltakt nie schneller als beim Loslassen", () => {
    for (const kg of [80, 900]) {
      const { vAb, vFlug } = wurfImTakt(kg);
      expect(vAb).toBeLessThan(V_MAX);
      for (const v of vFlug) expect(v).toBeLessThanOrEqual(vAb + 0.35); // MAX_ZUWACHS
    }
  });

  /*
   * BEHOBEN IN E-132 (16.10.2026): `clampSpeeds` in `src/world/scrapItems.ts`
   * bremste jedes geworfene Teil ein Bild nach dem Loslassen auf die
   * Schutzgrenze `maxSpeedFor` herunter — 900 kg von 4,73 auf 0,73 m/s. Ein
   * Teil, das im letzten Bild getragen wurde, darf jetzt so schnell bleiben,
   * wie es getragen wurde (plus `MAX_ZUWACHS`). Bis dahin stand hier
   * `it.fails`; wird dieser Fall wieder rot, ist die Bremse zurueck.
   */
  it("ein geworfenes Teil behaelt im Flug seinen Schwung (900 kg)", () => {
    const { vAb, vFlug } = wurfImTakt(900);
    for (const v of vFlug) expect(v).toBeGreaterThan(0.9 * vAb);
  });
});
