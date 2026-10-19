/**
 * AUFGABE 2: EIN AUTO IN DIE PRESSE (E-125, 06.10.2026; neue Formen E-162).
 *
 * Geprueft wird hier:
 *
 *  1. die Sterne — eine Stelle, aus gemessenen Werten, mit Gegenproben
 *     (Konzept 19.10.2026: Zeit, Abstand zur Kammermitte, harte Aufschlaege;
 *     keine Pendel-Ruhe mehr);
 *  2. der Ablauf — ein Schritt gilt erst, wenn er gesehen wurde; was schon
 *     richtig ist, wird uebersprungen; gepresst wird erst, wenn das Wrack
 *     losgelassen in der Kammer ist; der Knopf PRESSEN erscheint genau dann;
 *  3. am ECHTEN Wrack in der ECHTEN Presse, laengs und quer abgelegt: Die
 *     Pruefung der Presse sieht es, der Pressenstart schliesst die
 *     Fahrkunst-Messung ab, und der Stempel die Aufgabe;
 *  4. erster Start und beste Sternzahl im Speicher.
 *
 * Aufgabe 1 steht in `test/aufgabe1.test.ts`, Aufbau und Neustart in
 * `test/aufbau.test.ts`. Die Bildschirmtexte (Stickbelegung) und das
 * Abschlussbild prueft die Anzeige selbst — sie gehoeren zu `ui/`.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  ChallengeLauf,
  sterne,
  type ChallengeDaten,
  type ChallengeMessung,
  type ChallengeQuellen,
} from "../src/challenges/challenge";
import { CHALLENGES, challengeNach, challengeNr } from "../src/challenges/katalog";
import { EventBus, type GameEvents } from "../src/core/events";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { PressManager, PRESS_CENTER } from "../src/world/press";
import { START_AUTOS } from "../src/world/startplatz";
import { BAGGER_STAND } from "../src/world/baggerstand";
import { leseChallenges, merkeChallenge } from "../src/core/save";
import { Fahrkunst } from "../src/skills/fahrkunst";

const VERLADEN = CHALLENGES[1]!;

beforeAll(async () => {
  await RAPIER.init();
});

const M = (m: Partial<ChallengeMessung>): ChallengeMessung => ({
  zeitS: 60,
  fehlwuerfe: 0,
  harteAufschlaege: 0,
  praezisionCm: 20,
  ueberlasten: 0,
  fremdteile: 0,
  ...m,
});

describe("Der Katalog", () => {
  it("Aufgabe 1 vorn, die Presse an zweiter Stelle; Nummern ab 1", () => {
    expect(CHALLENGES.map((c) => c.id).slice(0, 2)).toEqual(["erster-griff", "verladen"]);
    expect(challengeNach("verladen")).toBe(VERLADEN);
    expect(challengeNr("erster-griff")).toBe(1);
    expect(challengeNr("verladen")).toBe(2);
    expect(challengeNr("gibt-es-nicht")).toBe(0);
    expect(new Set(CHALLENGES.map((c) => c.id)).size, "doppelte ID").toBe(CHALLENGES.length);
  });
});

describe("Die Sterne der Presse", () => {
  const w = VERLADEN.wertung;
  it("★ gepresst · ★★ unter 3:00 und 1 m · ★★★ unter 1:30, 40 cm, kein harter Aufschlag", () => {
    expect(sterne(w, M({ zeitS: 600, praezisionCm: 200 }))).toBe(1);
    expect(sterne(w, M({ zeitS: 170, praezisionCm: 90 }))).toBe(2);
    expect(sterne(w, M({ zeitS: 85, praezisionCm: 30 }))).toBe(3);
  });
  it("GEGENPROBE: eine verfehlte Schwelle kostet den Stern", () => {
    expect(sterne(w, M({ zeitS: 95, praezisionCm: 30 })), "zu langsam fuer drei").toBe(2);
    expect(sterne(w, M({ zeitS: 85, praezisionCm: 30, harteAufschlaege: 1 })), "ein harter Aufschlag").toBe(2);
    expect(sterne(w, M({ zeitS: 85, praezisionCm: 101 })), "zu weit daneben").toBe(1);
    expect(sterne(w, M({ zeitS: 181, praezisionCm: 30 })), "zu langsam fuer zwei").toBe(1);
  });
  it("ungemessen erfuellt keine Schwelle — es wird nichts erfunden", () => {
    expect(sterne(w, M({ zeitS: 10, praezisionCm: null }))).toBe(1);
  });
  it("Pendel-Ruhe ist keine Sternbedingung mehr (Patrick 19.10.2026)", () => {
    for (const c of CHALLENGES) {
      expect(Object.keys({ ...c.wertung.zwei, ...c.wertung.drei })).not.toContain("ruheGrad");
    }
  });
});

/** Ablauf mit Attrappen: was greift, wo steht das Wrack. */
function attrappe(): {
  q: ChallengeQuellen;
  stand: { gegriffen: boolean; ueber: boolean; drin: boolean; gueltig: boolean };
  koerper: { handle: number; translation(): { x: number; y: number; z: number }; isValid(): boolean };
} {
  const stand = { gegriffen: false, ueber: false, drin: false, gueltig: true };
  const koerper = { handle: 7, translation: () => ({ x: 0, y: 0, z: 0 }), isValid: () => stand.gueltig };
  return {
    stand,
    koerper,
    q: {
      gegriffen: () => (stand.gegriffen ? [koerper] : []),
      spinne: () => ({ x: 0, y: 5, z: 0 }),
      drehmitte: () => BAGGER_STAND,
      blickRad: () => 0,
      behaelter: () => null,
      ueberBehaelter: () => false,
      behaelterVon: () => null,
      ueberKammer: () => stand.ueber || stand.drin,
      inKammer: () => stand.drin,
    },
  };
}

function lauf(a: ReturnType<typeof attrappe>, daten: ChallengeDaten = VERLADEN) {
  const bus = new EventBus();
  const schritte: number[] = [];
  const bereit: boolean[] = [];
  let ende: GameEvents["challenge:geschafft"] | null = null;
  bus.on("challenge:schritt", (e) => schritte.push(e.nr));
  bus.on("challenge:stand", (e) => bereit.push(e.pressenBereit));
  bus.on("challenge:geschafft", (e) => (ende = e));
  const l = new ChallengeLauf(daten, 2, a.q, bus, { teile: [], wracks: [{ body: a.koerper }] });
  l.start();
  return { l, bus, schritte, bereit, ende: () => ende as GameEvents["challenge:geschafft"] | null };
}

const ZYKLUS = {
  praezisionCm: 25,
  ruheGrad: 2,
  tempoProMin: null,
  wurfMS: 0.4,
  wurfweiteM: 0.1,
  kraftKN: 9,
  gefuehlKN: null,
  x: 0,
  z: 0,
};

describe("Der Ablauf an der Presse", () => {
  it("vier Schritte, jeder erst, wenn er gesehen wurde; PRESSEN erst, wenn es drin liegt", () => {
    const a = attrappe();
    const { l, bus, schritte, bereit, ende } = lauf(a);
    l.takt(1);
    expect(schritte).toEqual([1]);
    a.stand.gegriffen = true;
    l.takt(1);
    a.stand.ueber = true;
    l.takt(1);
    expect(schritte).toEqual([1, 2, 3]);
    // noch in der Spinne ueber der Kammer: nicht abgelegt, Presse gesperrt
    a.stand.drin = true;
    l.takt(1);
    expect(schritte).toEqual([1, 2, 3]);
    expect(l.pressenErlaubt(), "Presse, waehrend das Wrack noch haengt").toBe(false);
    expect(bereit.at(-1), "Knopf PRESSEN, waehrend das Wrack haengt").toBe(false);
    a.stand.gegriffen = false;
    l.takt(1);
    expect(schritte).toEqual([1, 2, 3, 4]);
    expect(bereit.at(-1), "Knopf PRESSEN fehlt").toBe(true);
    // der Zyklus kommt jetzt ueber den Bus — der Lauf hoert selbst zu
    bus.emit("fahrkunst:zyklus", ZYKLUS);
    expect(l.pressenErlaubt()).toBe(true);
    l.presseHatGestempelt();
    l.takt(1);
    expect(ende()).not.toBeNull();
    expect(ende()!.messung).toEqual({
      zeitS: 6,
      fehlwuerfe: 0,
      harteAufschlaege: 0,
      praezisionCm: 25,
      ueberlasten: 0,
      fremdteile: 0,
    });
    expect(ende()!.sterne).toBe(3);
    expect(ende()!.name).toEqual(VERLADEN.name);
  });

  it("was schon richtig ist, wird uebersprungen", () => {
    const a = attrappe();
    const { l, schritte } = lauf(a);
    // gleich ueber der Kammer gefasst: Schritt 2 erscheint nie
    a.stand.gegriffen = true;
    a.stand.ueber = true;
    l.takt(1);
    expect(schritte).toEqual([1, 3]);
  });

  it("GEGENPROBE: ein Stempel ohne Freigabe schliesst nichts ab", () => {
    const a = attrappe();
    const { l, ende } = lauf(a);
    l.presseHatGestempelt();
    l.takt(1);
    expect(ende()).toBeNull();
  });

  it("ein Zyklus neben der Kammer zaehlt nicht fuer die Praezision", () => {
    const a = attrappe();
    const { l, bus, ende } = lauf(a);
    bus.emit("fahrkunst:zyklus", ZYKLUS); // ueberKammer ist hier noch falsch
    a.stand.drin = true;
    l.takt(1);
    l.pressenErlaubt();
    l.presseHatGestempelt();
    l.takt(1);
    expect(ende()!.messung.praezisionCm).toBeNull();
    expect(ende()!.sterne).toBe(1);
  });

  it("ein harter Aufschlag des Wracks zaehlt, der eines fremden Wracks nicht", () => {
    const a = attrappe();
    const { l, bus } = lauf(a);
    const schlag = (handle: number): void =>
      bus.emit("schrott:aufprall", { materialId: "mixed", massKg: 900, wucht: 7, blech: true, untergrund: "beton", handle, x: 0, y: 0, z: 0 });
    schlag(7);
    schlag(8);
    expect(l.messung().harteAufschlaege).toBe(1);
    // Knautschgrad des eigenen Wracks wird mitgeschrieben (Aufgabe 4)
    bus.emit("wrack:geknautscht", { handle: 7, grad: 0.4, zuwachs: 0.2, x: 0, y: 0, z: 0 });
    bus.emit("wrack:geknautscht", { handle: 8, grad: 0.9, zuwachs: 0.2, x: 0, y: 0, z: 0 });
    expect(l.knautschgrad).toBe(0.4);
  });

  it("ein entsorgtes Wrack (Koerper ungueltig) wird nicht mehr gelesen", () => {
    const a = attrappe();
    const { l, schritte } = lauf(a);
    a.stand.gueltig = false;
    a.stand.gegriffen = true;
    expect(() => l.takt(1)).not.toThrow();
    expect(schritte).toEqual([1]);
  });
});

describe("Am echten Wrack in der echten Presse", () => {
  function werkbank() {
    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const items = new ItemManager(scene, world);
    const composites = new CompositeManager(scene, world, items, new EventBus());
    const press = new PressManager(scene, world, items, composites);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0),
      world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    );
    const takt = (): void => {
      world.step();
      composites.update();
      press.update(1 / 60);
    };
    return { world, items, composites, press, takt };
  }

  it("der Startplatz ist der des zweiten Startautos, das Ziel die Kammermitte", () => {
    expect(VERLADEN.aufbau.wracks).toEqual([{ art: "pkw", ...START_AUTOS[1] }]);
    expect(VERLADEN.ablageziel).toEqual({ x: PRESS_CENTER.x, z: PRESS_CENTER.z });
    expect(VERLADEN.zielBehaelter, "ein Zielbehaelter verlegte die Praezision weg von der Kammer").toBeUndefined();
  });

  it("ueberKammer ist inChamber ohne Hoehe — eine Pruefung, nicht zwei", () => {
    const { press } = werkbank();
    const c = PRESS_CENTER;
    expect(press.inChamber({ x: c.x, y: 1, z: c.z })).toBe(true);
    expect(press.inChamber({ x: c.x, y: 6, z: c.z }), "hoch ueber der Kammer").toBe(false);
    expect(press.ueberKammer({ x: c.x, z: c.z })).toBe(true);
    const a = START_AUTOS[1]!;
    expect(press.ueberKammer(a)).toBe(false);
  });

  /*
   * Laengs (Gier 90 Grad) faellt es auf den Kammerboden und schlaeft ein; quer
   * (0 Grad) bleibt es auf Wandkrone und offener Klappe liegen und schlaeft
   * NIE ein (gemessen 06.10.2026, `tools/challenge-ruhe.ts`). Beide Faelle
   * muessen die Aufgabe abschliessen, und beide muessen gemessen werden.
   */
  for (const [lage, gier] of [
    ["laengs", 90],
    ["quer", 0],
  ] as const) {
    it(`${lage} abgelegt: in der Kammer erkannt, gemessen, gepresst`, () => {
      const { world, composites, press, takt } = werkbank();
      const car = composites.spawnCar(new THREE.Vector3(PRESS_CENTER.x, 2.6, PRESS_CENTER.z + 0.3));
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (gier * Math.PI) / 180);
      car.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
      const bus = new EventBus();
      let ende: GameEvents["challenge:geschafft"] | null = null;
      bus.on("challenge:geschafft", (e) => (ende = e));
      // Die echte Fahrkunst, mit einer Spinne aus Attrappen: erst haengt das Wrack, dann nicht mehr
      let haengt = true;
      const fk = new Fahrkunst(
        { grippedBodies: [] as RAPIER.RigidBody[], greiferform: { sensorRadius: 1.555 } } as never,
        { neigung: 0.02, schliesskraftKN: 9 } as never
      );
      const greifer = fk as unknown as { greifer: { grippedBodies: RAPIER.RigidBody[] } };
      fk.ziel = VERLADEN.ablageziel;
      const l = new ChallengeLauf(
        VERLADEN,
        2,
        {
          gegriffen: () => (haengt ? [car.body] : []),
          spinne: () => ({ x: 0, y: 5, z: 0 }),
          drehmitte: () => BAGGER_STAND,
          blickRad: () => 0,
          behaelter: () => null,
          ueberBehaelter: () => false,
          behaelterVon: () => null,
          ueberKammer: (p) => press.ueberKammer(p),
          inKammer: (p) => press.inChamber(p),
        },
        bus,
        { teile: [], wracks: [car] }
      );
      // wie main.ts: die Fahrkunst meldet ueber den Bus, der Lauf hoert zu
      fk.onZyklus = (e) => bus.emit("fahrkunst:zyklus", e);
      l.start();
      // Ein Schritt vorweg: Erst danach kennt Rapier die Masse des Wracks
      takt();
      // gefasst weit weg (am Startplatz), dann ueber der Kammer losgelassen
      greifer.greifer.grippedBodies = [car.body];
      const griffOrt = (fk as unknown as { griffOrt: Map<number, { x: number; z: number }> }).griffOrt;
      fk.update(1 / 60);
      griffOrt.set(car.body.handle, { x: START_AUTOS[1]!.x, z: START_AUTOS[1]!.z });
      l.takt(1 / 60);
      haengt = false;
      greifer.greifer.grippedBodies = [];
      fk.update(1 / 60);
      for (let i = 0; i < 180; i++) {
        takt();
        fk.update(1 / 60);
        l.takt(1 / 60);
      }
      expect(l.pressenErlaubt(), "die Presse sieht das Wrack nicht in der Kammer").toBe(true);
      expect(l.pressenBereit, "der Knopf PRESSEN fehlt").toBe(true);
      // Bis E-138 blieb das Wrack quer auf der Wandkrone liegen und der Zyklus
      // offen — der Befund, der `jetztLiegtSie` noetig machte. In der
      // groesseren Kammer (4,45 x 5,05 m) faellt es auch quer hinein; ob der
      // Zyklus dann schon zu ist, haengt am Einschlafen. `jetztLiegtSie`
      // bleibt der Weg fuer beide Faelle.
      press.onStart = () => fk.jetztLiegtSie();
      press.onStamp = () => l.presseHatGestempelt();
      expect(press.start()).toBe(true);
      for (let i = 0; i < 600 && !ende; i++) {
        takt();
        l.takt(1 / 60);
      }
      expect(ende, "die Presse hat nie gestempelt").not.toBeNull();
      expect(car.crushStage, "das Wrack wurde nicht gepresst").toBeGreaterThan(0);
      const m = (ende as unknown as GameEvents["challenge:geschafft"]).messung;
      expect(m.praezisionCm, "Praezision nicht gemessen").not.toBeNull();
      // gemessen wird, wo es lag — 30 cm neben der Mitte abgelegt.
      // Quer (Laenge im Pressweg) ist das Wrack laenger als der Raum vor dem
      // geparkten Stempel (4,45 − 0,56 = 3,89 m < 4,00 m, E-138): Es kippt mit
      // einem Ende auf den Stempel und rutscht — gemessen 0,76 m. Laengs liegt
      // es flach, und dort gilt die alte Schranke.
      expect(m.praezisionCm!).toBeLessThan(lage === "laengs" ? 45 : 90);
      expect(world.bodies.len()).toBeGreaterThan(0);
    });
  }
});

describe("Erster Start und Sterne im Speicher", () => {
  it("leer heisst erster Start; die bessere Sternzahl bleibt", () => {
    const ablage = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (k: string) => ablage.get(k) ?? null,
      setItem: (k: string, v: string) => void ablage.set(k, v),
      removeItem: (k: string) => void ablage.delete(k),
    };
    try {
      expect(Object.keys(leseChallenges())).toHaveLength(0);
      merkeChallenge("verladen", 0);
      expect(leseChallenges()).toEqual({ verladen: { sterne: 0 } });
      merkeChallenge("verladen", 2);
      merkeChallenge("verladen", 1);
      expect(leseChallenges().verladen!.sterne).toBe(2);
    } finally {
      delete (globalThis as Record<string, unknown>).localStorage;
    }
  });
});
