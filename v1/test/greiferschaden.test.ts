/**
 * Waechter fuer den Schaden durch Zudruecken (E-114, 22.09.2026).
 *
 * ANLASS. Die Spinne hatte keine Kraft: Ein Griff war eine Sensorkugel plus ein
 * starres Gelenk, also "gefasst" oder "nicht gefasst". Man konnte ein Auto
 * kaputtWERFEN, aber nicht kaputtDRUECKEN. E-112 hat die Kraft gebaut, hier
 * haengt die Wirkung daran.
 *
 * PATRICKS ENTSCHEIDUNG, 22.09.2026, waehrend der Arbeit: "nein, kaputt machen
 * verliert keinen wert. warum auch, Motor entfernen durch rohe Gewalt ist eine
 * art sortierung, auch ein kaputtes auto bringt gleich viel geld." Der dritte
 * Fall unten ist genau dieser Satz als Zahl — und er ist der wichtigste in
 * dieser Datei.
 *
 * WAS HIER NICHT GEPRUEFT WIRD: wie es sich anfuehlt. Ob ein Biss je Druck
 * richtig getaktet ist und ob ein Wrack nach zwei Bissen flach sein DARF,
 * entscheidet Patrick am Geraet.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { CAR_DEF } from "../src/dismantle/carDef";
import { EventBus } from "../src/core/events";

/*
 * Die gemessenen Schliesskraefte aus E-112 (`tools/greifkraft.ts`). Sie stehen
 * hier als Zahlen, damit dieser Waechter rot wird, wenn der
 * Umrechnungsfaktor in `composites.ts` verschoben wird — und nicht still
 * mitwandert.
 */
const KRAFT_WRACK = 15.7; // kN, voller Biss auf ein Autowrack
const KRAFT_BLECH = 8.14; // kN, voller Biss auf ein 55-kg-Blech

/** Ein Platz mit Boden, Physik und einem Wrack. Jeder Fall bekommt seinen eigenen. */
function werkbank(): {
  composites: CompositeManager;
  items: ItemManager;
  bus: EventBus;
  car: ReturnType<CompositeManager["spawnCar"]>;
} {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const items = new ItemManager(scene, world);
  const bus = new EventBus();
  const composites = new CompositeManager(scene, world, items, bus);
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  );
  const car = composites.spawnCar(new THREE.Vector3(0, 1, 0));
  return { composites, items, bus, car };
}

/** Zudruecken, wie der Bagger es meldet — ueber den Bus, nicht als Aufruf. */
function beissen(
  bus: EventBus,
  handle: number,
  kraftKN: number,
  at: THREE.Vector3
): void {
  bus.emit("greifer:zugedrueckt", { handle, kraftKN, x: at.x, y: at.y, z: at.z });
}

/**
 * Wo der Motor sitzt — dort setzt die Spinne zum Herausdruecken an. Seit
 * E-185 ist das erste Teil der Liste die Haube über dem Motorraum.
 */
function motorOrt(car: ReturnType<CompositeManager["spawnCar"]>): THREE.Vector3 {
  const ziel = CAR_DEF.parts.find((p) => p.kind !== "wheel")!;
  const p = car.body.translation();
  return new THREE.Vector3(p.x + ziel.anchor[0], p.y + ziel.anchor[1], p.z + ziel.anchor[2]);
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("Schaden durch Zudruecken", () => {
  it("ein Biss auf Luft richtet nichts an", () => {
    const { bus, car } = werkbank();
    const vorher = car.crushStage;
    // Handle, den es nicht gibt: gebissen wird viel, ein Wrack ist selten dabei
    beissen(bus, car.body.handle + 9999, KRAFT_WRACK, new THREE.Vector3(0, 1, 0));
    // Und ein Biss mit null Kraft auf das Wrack selbst
    beissen(bus, car.body.handle, 0, new THREE.Vector3(0, 1, 0));
    expect(car.crushStage, "ohne Kraft und ohne Treffer bleibt alles heil").toBe(vorher);
  });

  it("ein Blech-Biss beult, quetscht aber nicht", () => {
    const { bus, car } = werkbank();
    /*
     * 8,14 kN sind umgerechnet 3,63 m/s: ueber der Beulschwelle (3), unter der
     * Scheibenschwelle (4,5) und weit unter der Quetschschwelle (7). Gebissen
     * wird bewusst NICHT am Motor, sonst kommt die Sortierung dazwischen.
     */
    const p = car.body.translation();
    beissen(bus, car.body.handle, KRAFT_BLECH, new THREE.Vector3(p.x, p.y + 0.6, p.z - 1.5));
    expect(car.crushStage, "ein schwacher Biss quetscht nicht").toBe(0);
  });

  it("KERN DER ENTSCHEIDUNG: Kaputtdruecken kostet keine Masse", () => {
    const { bus, items, car } = werkbank();
    const vorher = car.massKg;
    const teileVorher = items.items.length;

    /*
     * Voller Biss auf den Motorraum: rohe Gewalt als Sortierung.
     *
     * ANGEPASST MIT E-185 (20.10.2026): Über dem Motor liegt jetzt die Haube
     * (Patrick, Frage 4 A: „erster Biss lässt sie aufspringen, zweiter reißt
     * sie ab"). Der erste Biss nimmt deshalb NICHTS heraus und kostet keine
     * Masse; erst der zweite bringt ein Stück — die Haube.
     */
    beissen(bus, car.body.handle, KRAFT_WRACK, motorOrt(car));
    expect(car.haubeOffen, "der erste Biss lässt die Haube aufspringen").toBe(true);
    expect(car.massKg, "aufgesprungen ist nicht ab").toBe(vorher);
    expect(items.items.length).toBe(teileVorher);
    beissen(bus, car.body.handle, KRAFT_WRACK, motorOrt(car));
    expect(car.teileDran, "der zweite Biss reißt sie ab").not.toContain("haube");

    const nachher = car.massKg;
    const teileNachher = items.items.length;

    expect(teileNachher, "das herausgedrueckte Teil lebt als eigenes Stueck weiter")
      .toBeGreaterThan(teileVorher);
    /*
     * Die Karosse wird leichter — aber nur um genau das, was jetzt daneben
     * liegt. Nichts loest sich in Luft auf. Das ist Patricks Satz als Zahl:
     * "auch ein kaputtes auto bringt gleich viel geld."
     */
    expect(nachher, "die Karosse verliert genau das herausgedrueckte Teil")
      .toBeLessThan(vorher);
    const verloren = vorher - nachher;
    const teilmassen = CAR_DEF.parts.map((p) => p.massKg);
    expect(
      teilmassen.some((m) => Math.abs(m - verloren) < 0.01),
      `verlorene ${verloren.toFixed(1)} kg sind kein Bauteil`
    ).toBe(true);
  });

  it("ohne Bauteil unter den Schalen trifft es die Karosse — sie knautscht Biss fuer Biss bis flach", () => {
    const { bus, car } = werkbank();
    /*
     * Weit weg von jedem Anker, ueber dem Dach: Dann gibt es nichts
     * herauszudruecken, und der Druck geht ins Blech.
     *
     * ANGEPASST MIT E-124 (06.10.2026): erst gab das Dach bis zu seinem `max`
     * nach, dann nahm jeder Biss eine Quetschstufe.
     *
     * ANGEPASST MIT E-128 (16.10.2026). Patrick: „Wie eine Blechdose
     * knautschen — beim Zudrücken faltet und knickt das ganze Auto zusammen
     * … statt dass nur einzelne Bleche eindellen." Seitdem knautscht jeder
     * Biss das ganze Auto ein Stueck weiter, vom Dach aus, und die
     * Quetschstufe folgt dem Knautschgrad (1 ab der Haelfte, 2 wenn flach).
     * Was bleibt wie vorher und hier bewacht wird: Der erste Biss macht das
     * Auto nicht flach, keiner nimmt zwei Stufen auf einmal — damit ein
     * Dauerdruck nicht in einem Bild durchquetscht —, und bei zwei ist Schluss.
     */
    const p = car.body.translation();
    const irgendwo = new THREE.Vector3(p.x, p.y + 2.5, p.z);
    beissen(bus, car.body.handle, KRAFT_WRACK, irgendwo);
    expect(car.crushStage, "der erste Biss knautscht das Dach, nicht das ganze Auto flach").toBe(0);
    let bisse = 1;
    while (car.crushStage < 2) {
      const vorher = car.crushStage;
      beissen(bus, car.body.handle, KRAFT_WRACK, irgendwo);
      bisse++;
      expect(car.crushStage - vorher, "eine Stufe je Biss, nie zwei").toBeLessThanOrEqual(1);
      expect(bisse, "flach nach endlich vielen Bissen").toBeLessThan(10);
    }
    beissen(bus, car.body.handle, KRAFT_WRACK, irgendwo);
    expect(car.crushStage, "und dann ist Schluss, nicht tiefer").toBe(2);
  });
});
