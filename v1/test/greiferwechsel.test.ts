/**
 * Waechter fuer den Greiferwechsel im Pausenmenue (E-059, 15.09.2026).
 *
 * Zwei Fragen, und beide werden am ECHTEN Bagger in einer echten Rapier-Welt
 * beantwortet, nicht an einer Nachbildung:
 *
 *   1. Der Schalter selbst: Wann ist er gesperrt, was entsteht beim Wechsel
 *      neu, was steht danach in der Szene?
 *   2. Greift der Fuenfschalengreifer? Dieselben Pruefungen, die
 *      `greiffenster.test.ts` fuer die Sichelkralle stellt — das
 *      Groessenfenster, kein Greifen durch die Luft, kein Saugen.
 *
 * Die vier Befunde von heute gelten fuer BEIDE Formen und werden hier je
 * einzeln nachgeprueft: E-030 (Fuehlkugel bis zum Korbboden), E-043 (Schalen
 * nach Teilegroesse), E-045 (Auswahl nach Haltwert), E-046 (Bodenanschlag
 * ueber den ganzen Schliessweg).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { GripSystem, noetigeKrallenFuer } from "../src/physics/gripSystem";
import { initPhysics } from "../src/physics/physicsWorld";
import { SICHELKRALLE } from "../src/excavator/greiferform";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";
import {
  GREIFERFORMEN,
  formZu,
  knopfstand,
  naechsteForm,
  STANDARD_GREIFER,
  setzeGreifer,
  wechsleGreifer,
} from "../src/excavator/greiferwahl";

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

/** Arm senken, bis der offene Greifer auf dem Beton aufsitzt. */
function absetzen(s: Stand): void {
  s.tasten.down.add("KeyF");
  s.tasten.down.add("KeyG");
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
  achsabstand: number;
  gewandert: number;
  /** Hoehe der Greifermitte ueber dem Beton, nachdem der Arm aufgesetzt hat */
  absetzhoehe: number;
  /** Wie weit die Greifermitte beim Zupacken gestiegen ist (E-046) */
  hub: number;
}

/** Ein Greifversuch mit dem Fuenfschalengreifer. */
function greifversuch(
  dims: [number, number, number],
  off: [number, number],
  massKg: number,
  f5 = true
): Versuch {
  const s = aufbau();
  if (f5) setzeGreifer(s.bagger, s.grip, FUENFSCHALEN);
  absetzen(s);
  const g = s.bagger.grappleGroup.position;
  const absetzhoehe = g.y;
  const b = quader(
    s,
    new THREE.Vector3(g.x + off[0], dims[1] / 2 + 0.02, g.z + off[1]),
    dims,
    massKg
  );
  s.massiv.add(b.handle);
  for (let i = 0; i < 20; i++) takt(s);

  s.tasten.down.add("Space");
  let relBeimFassen: THREE.Vector3 | null = null;
  let haengtSeit = 0;
  let gewandert = 0;
  let hoechste = g.y;
  for (let i = 0; i < 100; i++) {
    takt(s);
    hoechste = Math.max(hoechste, s.bagger.grappleGroup.position.y);
    if (!s.grip.grippedBodies.some((x) => x.handle === b.handle)) continue;
    haengtSeit++;
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
  return { gegriffen, achsabstand, gewandert, absetzhoehe, hub: hoechste - absetzhoehe };
}

describe("Der Schalter", () => {
  it("drei Greifer reihum, und der Fuenfschalengreifer ist die Vorgabe (E-105, E-146)", () => {
    /*
     * Ansage Patrick, 17.09.2026: „ansonsten fuenfschalengreifer als default".
     * Bis dahin war es die Sichelkralle (E-059).
     *
     * ZWEI VERSCHIEDENE DINGE, und sie stehen absichtlich nebeneinander:
     *
     *   - `STANDARD_GREIFER` ist die Vorgabe DES SPIELS. Damit faengt eine
     *     neue Runde an, und darauf faellt eine unbekannte Kennung zurueck.
     *   - `new Excavator(...)` haengt sich weiter die SICHELKRALLE an. Das ist
     *     der Grundzustand der Maschine, und an ihm haengen die Planungszahlen
     *     des Platzes (`hoechsteKrallenspitze`) und rund hundert Waechter, die
     *     einen Bagger bauen und sofort messen. Wer das verschiebt, verschiebt
     *     den Platz.
     *
     * `main.ts` setzt die Vorgabe beim Start; welcher Greifer beim Laden eines
     * alten Standes haengt, steht dort.
     */
    // E-146: der Lasthebemagnet ist der dritte; der Knopf schaltet reihum
    expect(GREIFERFORMEN.map((f) => f.id)).toEqual(["sichel", "fuenfschalen", "magnet"]);
    expect(naechsteForm("sichel")).toBe(FUENFSCHALEN);
    expect(naechsteForm("fuenfschalen").id).toBe("magnet");
    expect(naechsteForm("magnet")).toBe(SICHELKRALLE);
    // Was im Spielstand steht und was nicht
    expect(formZu("fuenfschalen")).toBe(FUENFSCHALEN);
    expect(formZu("sichel")).toBe(SICHELKRALLE);
    expect(STANDARD_GREIFER, "die Vorgabe ist nicht der Fuenfschalengreifer").toBe(FUENFSCHALEN);
    expect(formZu("gibtsnicht"), "unbekannt → Vorgabe").toBe(STANDARD_GREIFER);
    const s = aufbau();
    expect(s.bagger.greiferform, "der Grundzustand der Maschine ist verrutscht").toBe(SICHELKRALLE);
    s.world.free();
  });

  it("main.ts setzt die Vorgabe beim Start und laesst alte Staende in Ruhe", () => {
    /*
     * Die Zeile, an der es sonst haengenbliebe. `STANDARD_GREIFER` allein tut
     * gar nichts \u2014 er muss beim Start auch gesetzt werden, sonst faengt jede
     * Runde weiter mit dem Grundzustand der Maschine an und die Ansage waere
     * gebaut, aber unwirksam. Dieselbe Fehlerklasse wie beim Kranzknopf
     * (E-088): fertig gebaut, nirgends verdrahtet.
     *
     * Geprueft wird am Quelltext, weil `main.ts` ein Browserstart ist und sich
     * kopflos nicht aufrufen laesst.
     */
    const mainTs = readFileSync(resolve(__dirname, "../src/main.ts"), "utf8");
    expect(mainTs, "main.ts setzt STANDARD_GREIFER nie").toContain("STANDARD_GREIFER");
    expect(
      /save \? formZu\(save\.greifer \?\? SICHELKRALLE\.id\) : STANDARD_GREIFER/.test(mainTs),
      "main.ts entscheidet nicht mehr zwischen neuer Runde und altem Stand"
    ).toBe(true);
  });

  it("wechselt Modell, Kollider und Sensorkugel in einem Zug", () => {
    const s = aufbau();
    for (let i = 0; i < 10; i++) takt(s);
    const netzeVorher = zaehleSichtbareNetze(s.bagger.grappleGroup);
    const kolliderVorher = s.bagger.grappleBody.numColliders();

    expect(wechsleGreifer(s.bagger, s.grip)).toBe(FUENFSCHALEN);
    expect(s.bagger.greiferform).toBe(FUENFSCHALEN);
    expect(s.grip.greiferform).toBe(FUENFSCHALEN);

    // Beide haengen in der Szene, der inaktive unsichtbar.
    let gruppen = 0;
    for (const k of s.bagger.grappleGroup.children) if (k.type === "Group") gruppen++;
    expect(gruppen, "beide Greifer bleiben in der Szene").toBeGreaterThanOrEqual(2);
    const netzeNachher = zaehleSichtbareNetze(s.bagger.grappleGroup);
    /*
     * 105 bzw. 58 Netze des Greifers, dazu sieben fuer die Kardanaufhaengung
     * (Stumpf und zwei Gabeln) — die gehoeren zum Stiel und haengen an
     * beiden Formen gleich.
     */
    expect(netzeVorher, "Sichelkralle 105 + 7 Netze").toBe(112);
    expect(netzeNachher, "Fuenfschalengreifer 58 + 7 Netze").toBe(65);

    // Kollider: dieselbe Zahl (beide haben fuenf Schalen), aber neu angelegt.
    expect(s.bagger.grappleBody.numColliders()).toBe(kolliderVorher);
    // Und der Greifer laeuft weiter, ohne dass etwas durchschlaegt.
    for (let i = 0; i < 60; i++) takt(s);
    expect(Number.isFinite(s.bagger.grappleGroup.position.y)).toBe(true);
    s.world.free();
  }, 60000);

  it("ist gesperrt, solange etwas haengt — und sagt warum", () => {
    const s = aufbau();
    absetzen(s);
    const g = s.bagger.grappleGroup.position;
    const b = quader(s, new THREE.Vector3(g.x, 0.22, g.z), [0.4, 0.4, 0.4], 110);
    s.massiv.add(b.handle);
    for (let i = 0; i < 20; i++) takt(s);
    s.tasten.down.add("Space");
    for (let i = 0; i < 60; i++) takt(s);
    expect(s.grip.grippedCount, "der Versuchsaufbau haelt nichts").toBeGreaterThan(0);

    expect(s.bagger.greiferWechselBereit).toBe(false);
    const st = knopfstand(s.bagger);
    expect(st.moeglich).toBe(false);
    expect(st.grund).toBe("erst ablegen");
    expect(st.text).toContain("Fünfschalengreifer");
    // Der Wechsel passiert NICHT — und die Ladung haengt unveraendert weiter.
    expect(wechsleGreifer(s.bagger, s.grip)).toBe(SICHELKRALLE);
    expect(s.grip.grippedCount).toBeGreaterThan(0);

    // Loslassen, Spinne aufmachen — dann geht es.
    s.tasten.down.clear();
    for (let i = 0; i < 90; i++) takt(s);
    expect(s.grip.grippedCount).toBe(0);
    expect(s.bagger.greiferWechselBereit, "nach dem Ablegen ist der Knopf frei").toBe(true);
    expect(wechsleGreifer(s.bagger, s.grip)).toBe(FUENFSCHALEN);
    s.world.free();
  }, 60000);

  it("die halb geschlossene Spinne laesst sich nicht wechseln", () => {
    const s = aufbau();
    for (let i = 0; i < 20; i++) takt(s);
    s.tasten.down.add("Space");
    for (let i = 0; i < 12; i++) takt(s); // 0,2 s von 0,4 s Schliesszeit
    expect(s.bagger.closure).toBeGreaterThan(0.1);
    expect(s.bagger.closure).toBeLessThan(0.99);
    expect(s.bagger.greiferWechselBereit, "halb zu ist nicht offen").toBe(false);
    s.world.free();
  });
});

/** Netze unter der Spinne, die wirklich gezeichnet werden. */
function zaehleSichtbareNetze(wurzel: THREE.Object3D): number {
  let n = 0;
  wurzel.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    let sichtbar = true;
    let k: THREE.Object3D | null = o;
    while (k && k !== wurzel) {
      if (!k.visible) sichtbar = false;
      k = k.parent;
    }
    if (sichtbar) n++;
  });
  return n;
}

describe("Greiffenster des Fuenfschalengreifers", () => {
  const GROESSEN: [string, [number, number, number], number][] = [
    ["Kleinteil 0,10 m", [0.1, 0.1, 0.1], 8],
    ["Kupferbund, flach 0,10 m", [0.38, 0.1, 0.38], 18],
    ["Messingarmatur 0,30 m", [0.3, 0.25, 0.3], 15],
    ["Motorblock-Rest 0,40 m", [0.4, 0.4, 0.4], 110],
    ["Blech, 6 cm dick", [0.7, 0.06, 0.9], 55],
    ["Traeger 2,90 m", [0.28, 0.28, 2.9], 180],
    ["Betonblock 1,10 m", [1.1, 1.1, 1.1], 130],
  ];

  for (const [name, dims, kg] of GROESSEN) {
    it(`fasst ${name}`, () => {
      const r = greifversuch(dims, [0, 0], kg);
      expect(r.gegriffen, `${name} blieb liegen`).toBe(true);
      expect(r.achsabstand, `${name} haengt neben dem Greifer`).toBeLessThan(0.9);
    }, 60000);
  }

  it("fasst auch, was nicht genau mittig liegt (0,25 m daneben)", () => {
    const r = greifversuch([0.4, 0.4, 0.4], [0.238, 0.077], 110);
    expect(r.gegriffen).toBe(true);
  }, 60000);

  it("nimmt nichts mit, was 1,40 m neben der Achse liegt", () => {
    const r = greifversuch([0.4, 0.4, 0.4], [1.4, 0], 110);
    expect(r.gegriffen, "ein Teil 1,40 m neben dem Greifer wurde gefasst").toBe(false);
  }, 60000);

  it("nimmt keine Kiste mit, die nur mit einer Ecke hineinragt", () => {
    const r = greifversuch([2.4, 0.9, 2.4], [1.5, 1.5], 600);
    expect(r.gegriffen, "eine Kiste mit einer Ecke im Korb wurde gefasst").toBe(false);
  }, 60000);

  it("kein Saugen: ein gefasstes Teil bleibt, wo es gefasst wurde", () => {
    const r = greifversuch([0.4, 0.4, 0.4], [0.238, 0.077], 110);
    expect(r.gegriffen).toBe(true);
    expect(r.gewandert, "das Teil wandert nach dem Fassen — das ist Saugen").toBeLessThan(0.05);
  }, 60000);

  it("E-046: der Greifer steht still, waehrend er zupackt", () => {
    // Der Bodenanschlag rechnet ueber den ganzen Schliessweg, also darf der
    // Arm beim Zupacken nicht nachsteigen. Bei der Sichelkralle waren es
    // vorher 0,548 m.
    const r = greifversuch([0.4, 0.4, 0.4], [0, 0], 110);
    expect(r.hub, "der Greifer steigt beim Zupacken").toBeLessThan(0.05);
  }, 60000);

  it("E-043: die Schalenzahl richtet sich nach der Groesse des Teils", () => {
    // Die Luecke ist beim Fuenfschalengreifer 0,5954 m statt 0,6293 m — die
    // Schwellen wandern also mit, ohne dass jemand eine Zahl anfasst.
    const l = FUENFSCHALEN.schalenluecke;
    expect(noetigeKrallenFuer(0.4, l)).toBe(0);
    expect(noetigeKrallenFuer(l * 1.1, l)).toBe(1);
    expect(noetigeKrallenFuer(l * 2.1, l)).toBe(2);
    expect(noetigeKrallenFuer(2.4, l)).toBe(2);
  });

  it("E-030: die Fuehlkugel reicht bis zum Korbboden", () => {
    const s = aufbau();
    setzeGreifer(s.bagger, s.grip, FUENFSCHALEN);
    for (let i = 0; i < 30; i++) takt(s);
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
    expect(
      FUENFSCHALEN.sensorRadius,
      `die Kugel muesste ${noetig.toFixed(3)} m weit reichen`
    ).toBeGreaterThanOrEqual(noetig);
    expect(FUENFSCHALEN.sensorRadius, "die Kugel ist deutlich groesser als noetig").toBeLessThan(
      noetig + 0.1
    );
    s.world.free();
  }, 60000);
});
