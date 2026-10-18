/**
 * Waechter fuer das Greiffenster — welche Teilegroessen die Spinne fasst.
 *
 * Anlass (Patrick, 15.09.2026, nach einem Geraetetest): „Es ist sehr schwierig,
 * nahezu unmoeglich, kleine Teile mit der Spinne zu greifen … auch bei Teilen,
 * wo ich sagen wuerde, hey, das haette man greifen muessen, funktioniert
 * nicht."
 *
 * Nachgemessen war es keine Frage der Groesse, sondern der HOEHE: Die
 * Sensorkugel hing 1,50 m unter der Spinne und mass 1,05 m — sie reichte damit
 * 2,55 m tief. Die Schalen reichen 2,83 m tief, mit der Luft von
 * `isInsideGrapple` sogar 3,05 m. Die untersten 46 cm des Korbs waren blind.
 * Weil der Bodenanschlag den Arm beim Schliessen zusaetzlich um 0,548 m anhebt
 * (die geschlossene Spinne haengt tiefer als die offene), stand die Unterkante
 * der Kugel im ganzen Greiffenster 0,459 m ueber dem Beton: Alles, was flacher
 * als 46 cm auf dem Platz lag, war fuer den Sensor gar nicht da — auch dann
 * nicht, wenn alle fuenf Schalen daran anlagen.
 *
 * Gemessen wird hier NICHT an einer Nachbildung, sondern am echten Bagger in
 * einer echten Rapier-Welt: Arm absenken, bis die Spinne aufsitzt, Teil davor
 * legen, zupacken, zaehlen. Das ist langsam (rund eine Sekunde je Versuch) und
 * deshalb auf wenige, aussagekraeftige Groessen beschraenkt.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { GripSystem, SENSOR_UNTER_SPINNE } from "../src/physics/gripSystem";
import { initPhysics } from "../src/physics/physicsWorld";

/** Tastatur-Attrappe: nur `isDown` und `axis` werden vom Bagger gebraucht. */
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
  massiv: Set<number>;
}

const DT = 1 / 60;

beforeAll(async () => {
  leinwandAttrappe();
  await initPhysics();
});

function aufbau(): Stand {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  const bagger = new Excavator(new THREE.Scene(), world);
  const grip = new GripSystem(world, bagger.grappleBody);
  // genau wie in main.ts verdrahtet
  grip.insideGrapple = (p) => bagger.isInsideGrapple(p);
  grip.krallenKontakte = (b) => bagger.krallenKontakte(b);
  const massiv = new Set<number>();
  bagger.clawBlockedBy = (b) => massiv.has(b.handle);
  return { world, bagger, grip, tasten: new Tasten(), massiv };
}

function takt(s: Stand): void {
  const sensor = new THREE.Vector3();
  s.bagger.update(DT, s.tasten as never);
  s.grip.update(s.bagger.closure, s.bagger.closing, s.bagger.getSensorPosition(sensor), DT);
  s.world.step();
  s.bagger.carriedCount = s.grip.grippedCount;
  s.bagger.carriedMassKg = s.grip.totalMassKg;
  s.bagger.grippedHandles.clear();
  for (const b of s.grip.grippedBodies) s.bagger.grippedHandles.add(b.handle);
}

/** Arm senken, bis die offene Spinne auf dem Beton aufsitzt. */
function absetzen(s: Stand): void {
  s.tasten.down.add("KeyF"); // Ausleger ab
  s.tasten.down.add("KeyG"); // Stiel ab
  for (let i = 0; i < 260; i++) takt(s);
  s.tasten.down.clear();
  for (let i = 0; i < 30; i++) takt(s);
}

function quader(
  s: Stand,
  mitte: THREE.Vector3,
  dims: [number, number, number],
  massKg: number
): RAPIER.RigidBody {
  const b = s.world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(mitte.x, mitte.y, mitte.z)
  );
  s.world.createCollider(
    RAPIER.ColliderDesc.cuboid(dims[0] / 2, dims[1] / 2, dims[2] / 2).setMass(massKg),
    b
  );
  return b;
}

interface Versuch {
  gegriffen: boolean;
  /** groesster Abstand des Teils von der Spinnenachse nach dem Fassen (m) */
  achsabstand: number;
  /** wie weit das Teil relativ zur Spinne gewandert ist, nachdem es hing (m) */
  gewandert: number;
}

/**
 * Ein Greifversuch: Spinne offen absetzen, Teil mit dem Versatz `off` davor
 * legen, zupacken.
 */
function greifversuch(
  dims: [number, number, number],
  off: [number, number],
  massKg: number
): Versuch {
  const s = aufbau();
  absetzen(s);
  const g = s.bagger.grappleGroup.position;
  const b = quader(
    s,
    new THREE.Vector3(g.x + off[0], dims[1] / 2 + 0.02, g.z + off[1]),
    dims,
    massKg
  );
  s.massiv.add(b.handle); // massiver Stahl: die Zaehne bleiben daran stehen
  for (let i = 0; i < 20; i++) takt(s);

  s.tasten.down.add("Space");
  let relBeimFassen: THREE.Vector3 | null = null;
  let haengtSeit = 0;
  let gewandert = 0;
  for (let i = 0; i < 100; i++) {
    takt(s);
    if (!s.grip.grippedBodies.some((x) => x.handle === b.handle)) continue;
    haengtSeit++;
    // Die ersten Schritte zaehlen nicht: `setNextKinematicTranslation` wirkt
    // erst im naechsten Schritt, das Teil holt seine Sollpose also erst auf.
    if (haengtSeit < 4) continue;
    const p = b.translation();
    const gp = s.bagger.grappleBody.translation();
    const gr = s.bagger.grappleBody.rotation();
    const rel = new THREE.Vector3(p.x - gp.x, p.y - gp.y, p.z - gp.z).applyQuaternion(
      new THREE.Quaternion(gr.x, gr.y, gr.z, gr.w).invert()
    );
    if (!relBeimFassen) relBeimFassen = rel.clone();
    else gewandert = Math.max(gewandert, rel.distanceTo(relBeimFassen));
  }
  const gegriffen = s.grip.grippedBodies.some((x) => x.handle === b.handle);
  const p = b.translation();
  const gp = s.bagger.grappleBody.translation();
  const achsabstand = Math.hypot(p.x - gp.x, p.z - gp.z);
  s.world.free();
  return { gegriffen, achsabstand, gewandert };
}

describe("Sensorkugel — Herkunft der Zahl", () => {
  /*
   * Der Radius ist gerechnet, nicht gewaehlt. Er haengt an zwei Groessen aus
   * `excavator.ts`, die `gripSystem.ts` nicht lesen kann: wo die Sensormitte
   * sitzt und wie viel Luft `isInsideGrapple` unter die Spitzen legt. Beide
   * werden hier am echten Bagger nachgemessen.
   */
  it("die Sensormitte haengt dort, wo gripSystem sie annimmt", () => {
    const s = aufbau();
    for (let i = 0; i < 30; i++) takt(s);
    const sensor = s.bagger.getSensorPosition(new THREE.Vector3());
    const mitte = s.bagger.grappleGroup.position;
    expect(
      sensor.distanceTo(mitte),
      "SENSOR_UNTER_SPINNE in gripSystem.ts stimmt nicht mehr mit dem Bagger ueberein"
    ).toBeCloseTo(SENSOR_UNTER_SPINNE, 3);
    s.world.free();
  });

  it("die Kugel reicht bis zum tiefsten Punkt, den der Korb noch annimmt", () => {
    const s = aufbau();
    for (let i = 0; i < 30; i++) takt(s);
    // Ueber den GANZEN Schliessweg messen, nicht nur in der offenen Stellung:
    // Der Korb reicht auf halbem Weg am tiefsten, nicht an den Endlagen
    // (clawGeometry.ts). Wer nur eine Stellung prueft, misst 1,02 m statt
    // 1,56 m — und haelt die alte, zu kleine Kugel fuer ausreichend.
    let noetig = 0;
    s.tasten.down.add("Space");
    for (let i = 0; i < 90; i++) {
      takt(s);
      const mitte = s.bagger.grappleGroup.position.clone();
      const sensor = s.bagger.getSensorPosition(new THREE.Vector3());
      let tiefster = mitte.y;
      for (let d = 0; d <= 4; d += 0.005) {
        const p = new THREE.Vector3(mitte.x, mitte.y - d, mitte.z);
        if (s.bagger.isInsideGrapple(p)) tiefster = Math.min(tiefster, p.y);
      }
      noetig = Math.max(noetig, sensor.y - tiefster);
    }
    // E-155: die Kugel der Form, die haengt (Grundausstattung: Fuenfschalengreifer)
    const radius = s.bagger.greiferform.sensorRadius;
    expect(
      radius,
      `die Kugel muesste ${noetig.toFixed(3)} m weit reichen, misst aber nur ${radius.toFixed(3)} m`
    ).toBeGreaterThanOrEqual(noetig);
    // und sie soll nicht unnoetig gross sein — sonst sammelt sie den halben Haufen ein
    expect(radius, "die Kugel ist deutlich groesser als noetig").toBeLessThan(noetig + 0.1);
    s.world.free();
  });
});

/*
 * Das Groessenfenster.
 *
 * Die Liste deckt den ganzen Bereich ab, den `world/scrapItems.ts` erzeugt:
 * vom Kleinteil von 10 cm bis zum Betonblock von 1,10 m, dazu die flachen
 * (Blech 6 cm dick) und die langen (Traeger 2,90 m) Formen. Jedes davon muss
 * die Spinne fassen, wenn es mittig unter ihr liegt.
 *
 * Die Schwelle als Zahl: Ein Teil ab 0,10 m Kantenlaenge, das flach auf dem
 * Beton mittig unter der abgesetzten Spinne liegt, wird gefasst. Vor dem
 * 15.09.2026 lag die Schwelle bei 0,46 m HOEHE — darunter ging gar nichts.
 */
const GROESSEN: [string, [number, number, number], number][] = [
  ["Kleinteil 0,10 m", [0.1, 0.1, 0.1], 8],
  ["Kupferbund, flach 0,10 m", [0.38, 0.1, 0.38], 18],
  ["Messingarmatur 0,30 m", [0.3, 0.25, 0.3], 15],
  ["Motorblock-Rest 0,40 m", [0.4, 0.4, 0.4], 110],
  ["Blech, 6 cm dick", [0.7, 0.06, 0.9], 55],
  ["Traeger 2,90 m", [0.28, 0.28, 2.9], 180],
  ["Betonblock 1,10 m", [1.1, 1.1, 1.1], 130],
];

describe("Greiffenster — was die Spinne vom Beton aufnimmt", () => {
  for (const [name, dims, kg] of GROESSEN) {
    it(`fasst ${name}`, () => {
      const r = greifversuch(dims, [0, 0], kg);
      expect(r.gegriffen, `${name} blieb liegen`).toBe(true);
    });
  }

  it("fasst auch, was nicht genau mittig liegt (0,25 m daneben)", () => {
    const r = greifversuch([0.4, 0.4, 0.4], [0.238, 0.077], 110);
    expect(r.gegriffen, "ein Teil 25 cm neben der Achse blieb liegen").toBe(true);
  });
});

describe("Greiffenster — was die Spinne NICHT nimmt", () => {
  /*
   * Die beiden alten Fehler, die nicht zurueckkommen duerfen.
   */
  it("nimmt nichts mit, was neben der Spinne liegt", () => {
    // 1,40 m neben der Achse: ausserhalb des Korbs, aber innerhalb der
    // vergroesserten Sensorkugel. Genau dafuer gibt es `insideGrapple`.
    const r = greifversuch([0.4, 0.4, 0.4], [1.4, 0], 110);
    expect(r.gegriffen, "ein Teil 1,40 m neben der Spinne wurde gefasst").toBe(false);
  });

  it("nimmt keine Kiste mit, die nur mit einer Ecke hineinragt", () => {
    // Grosse Kiste, deren Mitte weit neben der Spinne liegt — nur eine Ecke
    // ragt in den Korb. Der Befund vom 11.09.2026: Sie hing danach halb
    // neben der Spinne in der Luft.
    const r = greifversuch([2.4, 0.9, 2.4], [1.5, 1.5], 600);
    expect(r.gegriffen, "eine Kiste mit einer Ecke im Korb wurde gefasst").toBe(false);
  });
});

describe("Greifen — kein Saugen, kein Schweben", () => {
  it("ein gefasstes Teil bleibt, wo es gefasst wurde", () => {
    // Der v2-Fehler, den Patrick ausdruecklich nicht will: Das Teil wanderte
    // nach dem Zupacken in die Korbmitte. Es soll nur mitfahren.
    const r = greifversuch([0.4, 0.4, 0.4], [0.238, 0.077], 110);
    expect(r.gegriffen).toBe(true);
    /*
     * Schwelle 0,05 m, nicht 0. Gemessen bleiben 0,016 m uebrig, und die sind
     * kein Wandern: `setNextKinematicTranslation` wirkt erst im naechsten
     * Schritt, das Teil sitzt also je Schritt an der Pose der Spinne von
     * VORHIN. Solange der Arm beim Schliessen noch steigt (0,548 m), ist das
     * sichtbar. Der v2-Fehler war eine Groessenordnung groesser: bis 0,35 m,
     * und zwar einsinnig in die Korbmitte.
     */
    expect(r.gewandert, "das Teil wandert nach dem Fassen — das ist Saugen").toBeLessThan(0.05);
  });

  it("was gefasst ist, haengt im Korb und nicht daneben", () => {
    for (const [name, dims, kg] of GROESSEN) {
      const r = greifversuch(dims, [0, 0], kg);
      expect(r.gegriffen, name).toBe(true);
      // Die Spinne misst geschlossen rund 1,30 m im Durchmesser; ein gefasstes
      // Teil darf mit seiner Mitte nicht weiter als der halbe Korb von der
      // Achse weg sein, sonst haengt es sichtbar daneben.
      expect(r.achsabstand, `${name} haengt neben der Spinne`).toBeLessThan(0.7);
    }
  }, 60000);
});
