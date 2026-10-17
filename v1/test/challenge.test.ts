/**
 * CHALLENGE 1: EIN AUTO IN DIE PRESSE (E-125, 06.10.2026).
 *
 * Patrick: „Mit Challenges soll das Spiel anfangen, damit die Steuerung klar
 * wird." Geprueft wird hier:
 *
 *  1. die Sterne — eine Stelle, aus gemessenen Werten, mit Gegenproben;
 *  2. die Bildschirmtexte — Bedienelemente aus der Stickbelegung, keine
 *     Tastenbuchstaben;
 *  3. der Ablauf — ein Schritt gilt erst, wenn er gesehen wurde; was schon
 *     richtig ist, wird uebersprungen; gepresst wird erst, wenn das Wrack
 *     losgelassen in der Kammer ist;
 *  4. am ECHTEN Wrack in der ECHTEN Presse, laengs und quer abgelegt: Die
 *     Pruefung der Presse sieht es, der Pressenstart schliesst die
 *     Fahrkunst-Messung ab, und der Stempel die Challenge;
 *  5. erster Start und beste Sternzahl im Speicher.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ChallengeLauf, sterne, type ChallengeDaten, type ChallengeQuellen } from "../src/challenges/challenge";
import { CHALLENGES } from "../src/challenges/katalog";
import { EventBus, type GameEvents } from "../src/core/events";
import { defaultConfig } from "../src/core/controlConfig";
import { bedientext } from "../src/ui/challengekarte";
import { challengeZeilen } from "../src/ui/abrechnung";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { PressManager, PRESS_CENTER } from "../src/world/press";
import { START_AUTOS } from "../src/world/startplatz";
import { leseChallenges, merkeChallenge } from "../src/core/save";
import { Fahrkunst } from "../src/skills/fahrkunst";

const VERLADEN = CHALLENGES[0]!;

beforeAll(async () => {
  await RAPIER.init();
});

describe("Die Sterne", () => {
  const w = VERLADEN.wertung;
  it("einer fuer geschafft, zwei fuer sauber, drei fuer sauber und zuegig", () => {
    expect(sterne(w, { zeitS: 600, ruheGrad: 20, praezisionCm: 200 })).toBe(1);
    expect(sterne(w, { zeitS: 600, ruheGrad: 8, praezisionCm: 90 })).toBe(2);
    expect(sterne(w, { zeitS: 100, ruheGrad: 2, praezisionCm: 30 })).toBe(3);
  });
  it("GEGENPROBE: eine verfehlte Schwelle kostet den Stern", () => {
    expect(sterne(w, { zeitS: 130, ruheGrad: 2, praezisionCm: 30 }), "zu langsam").toBe(2);
    expect(sterne(w, { zeitS: 100, ruheGrad: 2, praezisionCm: 101 }), "zu weit daneben").toBe(1);
  });
  it("ungemessen erfuellt keine Schwelle — es wird nichts erfunden", () => {
    expect(sterne(w, { zeitS: 10, ruheGrad: null, praezisionCm: 10 })).toBe(1);
  });
});

describe("Bildschirmtexte nennen die Bedienelemente, nicht Tasten", () => {
  it("Werkseinstellung: rechter Stick nach rechts schliesst", () => {
    const t = VERLADEN.schritte.map((s) => bedientext(s.text, defaultConfig())).join("\n");
    expect(t).toContain("Rechter Stick nach rechts: Spinne schließen");
    expect(t).toContain("Rechter Stick nach links: Spinne öffnen");
    expect(t).toContain("Linker Stick seitlich: Oberwagen drehen");
    expect(t).toContain("Linker Stick hoch/runter: Hauptarm heben/senken");
    expect(t).toContain("Rechter Stick hoch/runter: Ausleger heran/weg");
    expect(t).toContain("SCHERE");
    expect(t, "ein Platzhalter blieb stehen").not.toMatch(/[{}]/);
    expect(t, "Tastenbuchstabe im Text").not.toMatch(/\bTaste\b|\b[A-Z]\b(?![a-zäöü])/);
  });
  it("umgekehrte oder verlegte Spinne: der Text folgt der Belegung", () => {
    const c = defaultConfig();
    c.rightX.invert = true;
    expect(bedientext("{schliessen}", c)).toBe("Rechter Stick nach links");
    c.rightX.fn = "none";
    c.leftY.fn = "grapple";
    c.leftY.invert = false;
    expect(bedientext("{schliessen}", c)).toBe("Linker Stick nach unten");
    c.leftY.fn = "none";
    expect(bedientext("{oeffnen}", c)).toContain("Steuerung");
  });
});

/** Ablauf mit Attrappen: was greift, wo steht das Wrack, schlaeft es. */
function attrappe(): {
  q: ChallengeQuellen;
  stand: { gegriffen: boolean; ueber: boolean; drin: boolean };
} {
  const stand = { gegriffen: false, ueber: false, drin: false };
  const koerper = { handle: 7, translation: () => ({ x: 0, y: 0, z: 0 }) } as unknown as RAPIER.RigidBody;
  return {
    stand,
    q: {
      wrack: () => koerper,
      gegriffen: () => (stand.gegriffen ? [koerper] : []),
      ueberKammer: () => stand.ueber || stand.drin,
      inKammer: () => stand.drin,
    },
  };
}

function lauf(q: ChallengeQuellen, daten: ChallengeDaten = VERLADEN) {
  const bus = new EventBus();
  const schritte: number[] = [];
  let ende: GameEvents["challenge:geschafft"] | null = null;
  bus.on("challenge:schritt", (e) => schritte.push(e.nr));
  bus.on("challenge:geschafft", (e) => (ende = e));
  const l = new ChallengeLauf(daten, q, bus);
  l.start();
  return { l, schritte, ende: () => ende };
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

describe("Der Ablauf", () => {
  it("vier Schritte, jeder erst, wenn er gesehen wurde", () => {
    const { q, stand } = attrappe();
    const { l, schritte, ende } = lauf(q);
    l.takt(1);
    expect(schritte).toEqual([1]);
    stand.gegriffen = true;
    l.takt(1);
    stand.ueber = true;
    l.takt(1);
    expect(schritte).toEqual([1, 2, 3]);
    // noch in der Spinne ueber der Kammer: nicht abgelegt, Presse gesperrt
    stand.drin = true;
    l.takt(1);
    expect(schritte).toEqual([1, 2, 3]);
    expect(l.pressenErlaubt(), "Presse, waehrend das Wrack noch haengt").toBe(false);
    stand.gegriffen = false;
    l.takt(1);
    expect(schritte).toEqual([1, 2, 3, 4]);
    l.zyklusGemessen(ZYKLUS);
    expect(l.pressenErlaubt()).toBe(true);
    l.presseHatGestempelt();
    l.takt(1);
    expect(ende()).not.toBeNull();
    expect(ende()!.messung).toEqual({ zeitS: 6, ruheGrad: 2, praezisionCm: 25 });
    expect(ende()!.sterne).toBe(3);
  });

  it("was schon richtig ist, wird uebersprungen", () => {
    const { q, stand } = attrappe();
    const { l, schritte } = lauf(q);
    // gleich ueber der Kammer gefasst: Schritt 2 erscheint nie
    stand.gegriffen = true;
    stand.ueber = true;
    l.takt(1);
    expect(schritte).toEqual([1, 3]);
  });

  it("GEGENPROBE: ein Stempel ohne Freigabe schliesst nichts ab", () => {
    const { q } = attrappe();
    const { l, ende } = lauf(q);
    l.presseHatGestempelt();
    l.takt(1);
    expect(ende()).toBeNull();
  });

  it("ein Zyklus neben der Kammer zaehlt nicht fuer Ruhe und Praezision", () => {
    const { q, stand } = attrappe();
    const { l, ende } = lauf(q);
    l.zyklusGemessen(ZYKLUS); // ueberKammer ist hier noch falsch
    stand.drin = true;
    l.takt(1);
    l.pressenErlaubt();
    l.presseHatGestempelt();
    l.takt(1);
    expect(ende()!.messung.ruheGrad).toBeNull();
    expect(ende()!.sterne).toBe(1);
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
    expect(VERLADEN.aufbau.wracks).toEqual([START_AUTOS[1]]);
    expect(VERLADEN.ablageziel).toEqual({ x: PRESS_CENTER.x, z: PRESS_CENTER.z });
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
   * muessen die Challenge abschliessen, und beide muessen gemessen werden.
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
        {
          wrack: () => (car.body.isValid() ? car.body : null),
          gegriffen: () => (haengt ? [car.body] : []),
          ueberKammer: (p) => press.ueberKammer(p),
          inKammer: (p) => press.inChamber(p),
        },
        bus
      );
      fk.onZyklus = (e) => l.zyklusGemessen(e);
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
      expect(ende!.messung.ruheGrad, "Ruhe nicht gemessen").not.toBeNull();
      // gemessen wird, wo es lag — 30 cm neben der Mitte abgelegt.
      // Quer (Laenge im Pressweg) ist das Wrack laenger als der Raum vor dem
      // geparkten Stempel (4,45 − 0,56 = 3,89 m < 4,00 m, E-138): Es kippt mit
      // einem Ende auf den Stempel und rutscht — gemessen 0,76 m. Laengs liegt
      // es flach, und dort gilt die alte Schranke.
      expect(ende!.messung.praezisionCm!).toBeLessThan(lage === "laengs" ? 45 : 90);
      expect(world.bodies.len()).toBeGreaterThan(0);
    });
  }
});

describe("Abschlussbild", () => {
  it("eine Zeile je Messgroesse, mit Zeichen und dem Weg zu drei Sternen", () => {
    const z = challengeZeilen({
      id: "verladen",
      name: VERLADEN.name,
      sterne: 2,
      messung: { zeitS: 154, ruheGrad: 2.4, praezisionCm: 140 },
      wertung: VERLADEN.wertung,
    });
    expect(z.map((x) => x.name)).toEqual(["Zeit", "Ruhe", "Präzision"]);
    expect(z[0]!.wert).toBe("2:34 min (★★★ bis 2:00 min)");
    expect(z[1]!.wert).toMatch(/^✓ 2° Pendel/);
    expect(z[2]!.wert).toMatch(/^✗ 140 cm daneben/);
  });
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
