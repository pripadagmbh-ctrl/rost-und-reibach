/**
 * PLATZINVENTAR — der Müllcontainer und alles, was ihm gleicht (E-034).
 *
 * Ansage Patrick 15.09.2026, in vier Sätzen über den Tag verteilt:
 *
 *   „Nein, den Müll nehmen wir in einen frei platzierbaren Container."
 *   „Und der Container soll erstmal frei bleiben, damit ich auch testen kann,
 *    wo der am besten steht."
 *   „Selbst wenn er mal aufgeladen wird, gibt es kein Geld dafür. … Also wie
 *    auch der Besen ist es ein fester Bestandteil des Platzes."
 *   „Wenn mal Müll verschwindet, dann verschwindet er über Nacht nicht,
 *    sondern landet in dem Müllsilo. Da wird er dann gelagert."
 *
 * Daraus werden hier vier prüfbare Zusicherungen: Er ist zu tragen, er ist
 * nichts wert, sein Inhalt kommt vollständig im Silo an, und der Tageswechsel
 * löst das genau einmal aus.
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { describe, it, expect, beforeAll } from "vitest";
import { initPhysics } from "../src/physics/physicsWorld";
import { ItemManager } from "../src/world/scrapItems";
import { CONFIGS, bayHalb, lagerMuldeFuer } from "../src/world/containers";
import {
  Platzwache,
  inhaltInsLager,
  istPlatzinventar,
  PLATZINVENTAR_EUR,
} from "../src/world/platzinventar";
import { abstandVomStand, SCHWENK_INNEN, SCHWENK_AUSSEN } from "../src/world/baggerstand";
import { ABLADE_SPUR_X } from "../src/delivery/routes";
import { getMaterial } from "../src/materials/catalog";
import { nutzlastKg } from "../src/excavator/traglast";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";

beforeAll(async () => {
  await initPhysics();
});

const MUELL = CONFIGS.find((c) => c.id === "r_rubble")!;
/** Dichte der Container-Kollider (`containers.ts`, `rolloff`) */
const DICHTE = 300;
/** Kufe und Boden, wie sie dort gebaut werden */
const KUFE = 0.22;
const WAND_T = 0.09;
/**
 * Was der Fuenfschalengreifer heben darf — seit E-152 nach Ausladung
 * (`excavator/traglast.ts`), nicht mehr eine feste Zahl. Nah: kleinste
 * Ausladung des Arms (3,7 m), weit: 9 m (E-156: grosse Schrottmaschine).
 */
const NAH_KG = nutzlastKg(3.7, FUENFSCHALEN.eigengewichtKg);
const WEIT_KG = nutzlastKg(9, FUENFSCHALEN.eigengewichtKg);

describe("Der Müllcontainer ist ein Container, kein Bauwerk", () => {
  it("er ist beweglich — und der Greifer hebt ihn leer gerade noch", () => {
    /*
     * Gerechnet mit denselben Kollidern, die `containers.ts` anlegt: eine
     * Bodenplatte (Kufe + Boden als ein Quader) und vier Wände, alle auf
     * Dichte 300 kg/m³.
     *
     * Das ist die Zahl, an der das Tragen hängt. Steigt sie über 3500 kg,
     * lässt sich der leere Container nicht mehr aufnehmen und das freie
     * Platzieren fällt aus — dann bliebe nur noch Schieben.
     */
    const [w, d, h] = MUELL.size;
    const boden = w * (KUFE + WAND_T) * d;
    const waende = 2 * (w * h * WAND_T) + 2 * (WAND_T * h * d);
    const leerKg = (boden + waende) * DICHTE;
    expect(MUELL.kind, "der MUELL ist kein Absetzcontainer").toBe("rolloff");
    expect(leerKg, `${leerKg.toFixed(0)} kg leer`).toBeCloseTo(1781, 0);
    expect(leerKg, "leer schon zu schwer für den Greifer, auch nah").toBeLessThan(NAH_KG);
    // E-156: Leer hebt ihn die grosse Schrottmaschine ueberall, auch weit
    // draussen ohne Pratzen (zwei Drittel). Voll wird er von selbst schwerer:
    // Das Ladegewicht kommt als Zusatzmasse an den Körper (`wiegeLadung`),
    // und die Ueberlastsperre greift, sobald es zu viel ist.
    expect(leerKg, "weit draussen ohne Pratzen hebt sie ihn leer").toBeLessThan((WEIT_KG * 2) / 3);
  });

  it("er kommt zur Ruhe und bleibt liegen — sonst zittert der Platz die ganze Zeit", () => {
    /*
     * Ein dynamischer Körper mehr auf dem Platz ist ein Versprechen: Er muss
     * einschlafen. Ein Behälter, der dauerhaft wach bleibt, kostet auf dem
     * Dev-PC (Intel HD 5500) jede Runde Physikzeit und hält obendrein seine
     * Nachbarn wach — genau das ist die Schranke aus dem Physik-Budget.
     *
     * Nachgebaut wird der Körper aus `containers.ts` mit denselben Kollidern,
     * derselben Dämpfung (6,0 / 8,0) und derselben Achsensperre.
     */
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(50, 0.5, 50).setTranslation(0, -0.5, 0),
      boden
    );
    const [w, d, h] = MUELL.size;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(MUELL.x, 0, MUELL.z)
        .setLinearDamping(6.0)
        .setAngularDamping(8.0)
        .enabledRotations(false, true, false)
    );
    const teil = (hx: number, hy: number, hz: number, x: number, y: number, z: number): void => {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(hx, hy, hz)
          .setDensity(DICHTE)
          .setFriction(1.4)
          .setTranslation(x, y, z),
        body
      );
    };
    const wandY = KUFE + WAND_T + h / 2;
    teil(w / 2, (KUFE + WAND_T) / 2, d / 2, 0, (KUFE + WAND_T) / 2, 0);
    for (const [wx, wz, sx, sz] of [
      [0, -(d / 2 - WAND_T / 2), w, WAND_T],
      [0, d / 2 - WAND_T / 2, w, WAND_T],
      [-(w / 2 - WAND_T / 2), 0, WAND_T, d],
      [w / 2 - WAND_T / 2, 0, WAND_T, d],
    ] as Array<[number, number, number, number]>) {
      teil(sx / 2, h / 2, sz / 2, wx, wandY, wz);
    }
    let schritte = 0;
    while (schritte < 300 && !body.isSleeping()) {
      world.step();
      schritte++;
    }
    expect(schritte, `erst nach ${schritte} Schritten ruhig`).toBeLessThan(200);
    const p = body.translation();
    expect(Math.hypot(p.x - MUELL.x, p.z - MUELL.z), "er ist weggerutscht").toBeLessThan(0.05);
  });

  it("die offene Spinne kommt hinein — sonst bekommt man nichts wieder heraus", () => {
    // Sichelkralle offen 3,38 m (`spinnenmass`), Wandstärke 0,09 m je Seite.
    const [w, d] = MUELL.size;
    expect(Math.min(w, d) - 2 * WAND_T, "lichte Weite quer").toBeGreaterThan(3.38);
  });

  it("sein Startplatz ist frei gewählt, aber begründet", () => {
    /*
     * Er hat kein Zuhause — aber einen Ort, an dem er morgens steht. Der muss
     * im Schwenkband liegen (sonst kann der Spieler am ersten Tag nichts
     * hineinwerfen) und darf keiner Fahrspur im Weg stehen.
     *
     * NACHTRAG beim Zusammenführen, 15.09.2026: Hier stand eine Prüfung gegen
     * `KIPP_SPUR_X` — die Spur, an der dieser Startplatz ausgerechnet worden
     * war. Sie gibt es nicht mehr: E-029 hat sie am selben Abend gelöscht, der
     * Kipper fährt jetzt an den Abladeplatz. Der Vergleich rechnete damit
     * gegen `undefined` und ergab `NaN` — **und jeder Vergleich mit NaN ist
     * falsch**, der Test wäre stillschweigend wirkungslos geworden, wenn er
     * nicht zufällig `toBeGreaterThan` benutzt hätte. Genau die Falle, die an
     * diesem Tag schon zweimal zugeschnappt ist.
     *
     * Bewacht wird jetzt die Spur, die es wirklich gibt.
     */
    const mitte = abstandVomStand(MUELL.x, MUELL.z);
    expect(mitte, `${mitte.toFixed(2)} m vom Sitz`).toBeGreaterThanOrEqual(SCHWENK_INNEN);
    expect(mitte).toBeLessThanOrEqual(SCHWENK_AUSSEN);

    const ostkante = MUELL.x + MUELL.size[0] / 2;
    // Erst prüfen, ob die Zahlen überhaupt Zahlen sind.
    expect(Number.isFinite(ABLADE_SPUR_X), "ABLADE_SPUR_X ist keine Zahl").toBe(true);
    expect(Number.isFinite(ostkante), "Ostkante ist keine Zahl").toBe(true);

    const wagenFlanke = ABLADE_SPUR_X - 1.55; // halbe Wagenbreite
    expect(
      wagenFlanke - ostkante,
      `nur ${(wagenFlanke - ostkante).toFixed(2)} m bis zur Rückfahrspur (Schranke 1,40)`
    ).toBeGreaterThan(1.4);
  });

  it("er trägt das Kennzeichen und ist damit unverkäuflich", () => {
    expect(istPlatzinventar(MUELL), "kein Platzinventar").toBe(true);
    expect(PLATZINVENTAR_EUR).toBe(0);
    /*
     * Die eine Stelle, an der es hängt: Die Hülle ist kein `ScrapItem`.
     * `Account.sellContainer` rechnet ausschließlich über die Liste des
     * `ItemManager` — ein Behälter steht dort nie drin, egal was mit ihm
     * geschieht. Es gibt also gar keinen Weg in eine Geldformel, und dieser
     * Wächter hält fest, dass niemand einen baut.
     */
    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const items = new ItemManager(scene, world);
    expect(items.items.length, "der Platz startet nicht leer").toBe(0);
  });
});

describe("Inhalt ins Abfall-Silo, Hülle bleibt", () => {
  /** Ein Platz mit `stueck` Müllteilen im Container. */
  function platz(stueck: number, materialId = "rubble") {
    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0),
      boden
    );
    const items = new ItemManager(scene, world);
    for (let i = 0; i < stueck; i++) {
      // Rasterweise im Container ablegen, nicht übereinander (v2 E-010).
      items.spawnScrap(
        materialId,
        40,
        // Farbe gehoert zur Form (ScrapShape.color) und fehlte hier — von der
        // Typpruefung von test/ gemeldet (E-038).
        { kind: "box", dims: [0.5, 0.4, 0.5], color: getMaterial(materialId).color },
        new THREE.Vector3(
          MUELL.x - 1.2 + (i % 3) * 1.2,
          0.6,
          MUELL.z - 1.2 + Math.floor(i / 3) * 1.2
        )
      );
    }
    return { world, items };
  }

  /** Dieselbe Zonenprobe, die `GameContainer.containsPoint` benutzt. */
  const imContainer = (p: { x: number; y: number; z: number }): boolean =>
    Math.abs(p.x - MUELL.x) < MUELL.size[0] / 2 &&
    Math.abs(p.z - MUELL.z) < MUELL.size[1] / 2 &&
    p.y < 2.8;

  it("jedes Kilo kommt im Silo an — nichts wird gelöscht", () => {
    const { items } = platz(6);
    const vorherKg = items.items.reduce((s, it) => s + it.massKg, 0);
    const bericht = inhaltInsLager(items, imContainer);
    expect(bericht.stueck, "nicht alle mitgenommen").toBe(6);
    expect(bericht.rest, "etwas ist liegengeblieben").toBe(0);
    expect(bericht.kg, "Kilogramm verloren").toBeCloseTo(vorherKg, 6);
    // Und die Stücke gibt es noch — versetzt, nicht entsorgt.
    expect(items.items.length).toBe(6);

    const silo = lagerMuldeFuer("rubble")!;
    expect(silo.id).toBe("c_rubble");
    const { hw, hd } = bayHalb(silo);
    let imSilo = 0;
    for (const it of items.items) {
      const p = it.body.translation();
      if (Math.abs(p.x - silo.x) <= hw && Math.abs(p.z - silo.z) <= hd) imSilo++;
      expect(it.containerId, "die Zuordnung zeigt noch auf den Container").toBe("c_rubble");
    }
    expect(imSilo, `nur ${imSilo} von 6 im ABFALL-Silo`).toBe(6);
  });

  it("nichts wird ineinander abgesetzt — sonst schleudert das Silo", () => {
    /*
     * Rapier drückt überlappende Körper mit voller Kraft auseinander (Lehre
     * aus v2, E-010: „Spawn ohne Überlappung"). Geprüft wird der Mindest-
     * abstand der abgesetzten Stücke in der Ebene.
     */
    const { items } = platz(9);
    inhaltInsLager(items, imContainer);
    const orte = items.items.map((it) => it.body.translation());
    for (let i = 0; i < orte.length; i++) {
      for (let j = i + 1; j < orte.length; j++) {
        const a = orte[i]!;
        const b = orte[j]!;
        const eben = Math.hypot(a.x - b.x, a.z - b.z);
        const hoch = Math.abs(a.y - b.y);
        expect(
          Math.max(eben, hoch),
          `zwei Stücke liegen ${eben.toFixed(2)} m auseinander`
        ).toBeGreaterThan(0.7);
      }
    }
  });

  it("die Reifen gehen denselben Weg wie der Bauschutt — ins selbe Silo", () => {
    const { items } = platz(3, "tires");
    const bericht = inhaltInsLager(items, imContainer);
    expect(bericht.stueck).toBe(3);
    for (const it of items.items) expect(it.containerId).toBe("c_rubble");
  });

  it("was außerhalb liegt, bleibt liegen", () => {
    const { items } = platz(3);
    // Eine Probe, die nie zutrifft: dann darf sich nichts bewegen.
    const vorher = items.items.map((it) => ({ ...it.body.translation() }));
    const bericht = inhaltInsLager(items, () => false);
    expect(bericht.stueck).toBe(0);
    items.items.forEach((it, i) => {
      const p = it.body.translation();
      expect(Math.hypot(p.x - vorher[i]!.x, p.z - vorher[i]!.z)).toBeLessThan(1e-9);
    });
  });
});

describe("Der Tageswechsel", () => {
  /*
   * `economy/shift.ts` führt keinen Tagesablauf: Es zählt Sekunden, Umschlag
   * und Fuhren und macht die Einfahrt zu, wenn der Platz zusteht — einen
   * Morgen gibt es dort nicht. Der einzige Tageswechsel des Spiels ist die
   * Uhr in `world/daylight.ts`. Daran hängt die Nachtschicht, und dieser
   * Wächter hält fest, dass sie genau einmal je Tag zuschlägt.
   */
  it("meldet sich genau einmal, und beim Spielstart gar nicht", () => {
    const w = new Platzwache();
    expect(w.tag).toBe(1);
    expect(w.tagGewechselt("container"), "der Spielstart ist kein Tageswechsel").toBe(false);
    expect(w.tagGewechselt("container"), "zweite Frage am selben Tag").toBe(false);
    w.neuerTag();
    expect(w.tag).toBe(2);
    expect(w.tagGewechselt("container"), "der Wechsel wird nicht gemeldet").toBe(true);
    expect(w.tagGewechselt("container"), "er wird zweimal gemeldet").toBe(false);
  });

  it("jeder Frager bekommt ihn für sich — der eine nimmt ihn dem anderen nicht weg", () => {
    // Der Besen im Nachbarpaket hängt an derselben Wache wie der Container.
    const w = new Platzwache();
    w.tagGewechselt("container");
    w.tagGewechselt("besen");
    w.neuerTag();
    expect(w.tagGewechselt("container")).toBe(true);
    expect(w.tagGewechselt("besen")).toBe(true);
  });

  it("die Uhr zählt den Tag hoch, wenn sie über Mitternacht läuft", () => {
    /*
     * Gemessen an der echten Uhr: `Daylight.update` rechnet `time` modulo 1.
     * Der Sprung von 0,99 auf 0,01 ist der Morgen — und der einzige Ort, an
     * dem im Spiel ein neuer Tag beginnt.
     */
    const zeiten = [0.98, 0.99, 0.995, 0.0005, 0.01];
    let tage = 1;
    for (let i = 1; i < zeiten.length; i++) {
      if (zeiten[i]! < zeiten[i - 1]!) tage++;
    }
    expect(tage, "die Uhr erkennt den Tageswechsel nicht").toBe(2);
  });
});
