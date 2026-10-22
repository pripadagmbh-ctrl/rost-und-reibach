/**
 * WAS AUF DEM WAGEN LIEGT, IST DAS, WAS ANGEKÜNDIGT WAR (E-044).
 *
 * Seit E-033 wird die Anlieferungsmenge aus dem FÜLLGRAD der Ladefläche
 * gerechnet: Masse = Füllgrad × Laderaum × Schüttdichte. `vehicles.ts` wusste
 * davon nichts und würfelte seine eigene Zielfüllung — die ganze Änderung war
 * damit nur auf der Waage zu sehen und nie auf dem Wagen. Genauso beim
 * Aufbau: `customers.ts` zog ihn für die Masse, `vehicles.ts` unabhängig davon
 * für das Modell, und im Einzelfall kam ein Koffer-Aufbau mit einer
 * Flach-Masse an.
 *
 * Bewacht wird hier nicht die Rechnung (das tut `lademenge.test.ts`), sondern
 * die VERBINDUNG: Was der Kunde ankündigt, steht hinterher auf der Fläche.
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { describe, it, expect, beforeAll } from "vitest";
import { initPhysics } from "../src/physics/physicsWorld";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { VehicleManager, teilDeckelKg } from "../src/delivery/vehicles";
import type { ScrapItem } from "../src/world/scrapItems";
import { katalogKg } from "./riesenteile-hilfe";
import type { CustomerProfile } from "../src/delivery/customers";
import {
  ANHAENGER_HALB_BREITE,
  ANHAENGER_WAND,
  LADUNG_UEBERSTAND,
  type Aufbau,
} from "../src/delivery/fuellgrad";
import { AUSSEHEN_NEUTRAL } from "../src/delivery/aussehen";

beforeAll(async () => {
  await initPhysics();
});

function kunde(over: Partial<CustomerProfile>): CustomerProfile {
  return {
    group: "haendler",
    name: "Pruefstand",
    subtitle: "Test",
    massKg: 5000,
    vehicle: "pritsche",
    aufbau: "flach",
    fuellgrad: 0.9,
    dichte: 500,
    sortedMaterial: null,
    contaminantShare: 0.06,
    hardness: 1,
    greeting: "",
    /*
     * Neutrale Figur (`aussehen.ts`). Prueflaeufe messen nicht das
     * Aussehen, und eine gewuerfelte Statur wuerde hier nur streuen.
     */
    aussehen: AUSSEHEN_NEUTRAL,
    ...over,
  };
}

interface Innen {
  ladeFuellung: number;
  bodyStyleName: Aufbau;
  bedGroup: THREE.Group;
  group: THREE.Group;
  bedLen: number;
  cargo: { items: Array<{ body: RAPIER.RigidBody; massKg: number }> };
}

/**
 * Fester Zufall.
 *
 * Was auf der Fläche landet, wird gewürfelt. Ohne feste Saat misst dieser
 * Wächter Rauschen — und war beim ersten Durchlauf prompt einmal grün und
 * einmal rot. Dieselbe Lehre wie beim Kipper (E-029, E-044): Eine Messung ohne
 * Saat ist keine.
 */
function festerZufall(saat: number): () => void {
  const echt = Math.random;
  let z = saat >>> 0;
  Math.random = () => {
    z = (z * 1664525 + 1013904223) >>> 0;
    return z / 4294967296;
  };
  return () => {
    Math.random = echt;
  };
}

function beladen(
  art: "pritsche" | "pkw" | "kipper",
  c: CustomerProfile,
  saat = 20260915
): { v: Innen; items: ItemManager } {
  const zurueck = festerZufall(saat);
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0),
    boden
  );
  const items = new ItemManager(scene, world);
  const vm = new VehicleManager(scene, world, items, new CompositeManager(scene, world, items, new EventBus()));
  vm.spawnNow(art, c);
  zurueck();
  return { v: (vm as unknown as { active: unknown }).active as Innen, items };
}

describe("Der Füllgrad des Kunden steht auf der Fläche", () => {
  it("eine viertelvolle Fuhre wird nicht heimlich aufgefüllt", () => {
    /*
     * Die alte Mindestfüllung von 0,3 stand als feste Zahl in der
     * Abbruchbedingung. Mit dem Füllgrad des Kunden hätte sie genau die Fuhre
     * wieder hochgeladen, die selten sein SOLL — „aber so ein Viertel voll ist
     * schon eher selten bis schwierig" heißt selten, nicht unmöglich.
     */
    const werte: number[] = [];
    for (let i = 0; i < 6; i++) {
      werte.push(beladen("pritsche", kunde({ fuellgrad: 0.25 }), 100 + i).v.ladeFuellung);
    }
    const mittel = werte.reduce((a, b) => a + b, 0) / werte.length;
    expect(werte.every((w) => Number.isFinite(w)), "NaN als Füllung").toBe(true);
    /*
     * Gemessen 29 %. Der erste Wurf legt mindestens zwei Brocken auf, weiter
     * herunter geht es nicht — eine Fuhre aus anderthalb Blechen gibt es
     * nicht. Vor dieser Änderung waren es 43 %: Der erste Wurf war größer als
     * die ganze Bestellung.
     */
    expect(mittel, `Füllung im Mittel ${(mittel * 100).toFixed(0)} %`).toBeLessThan(0.4);
  }, 60000);

  it("und eine randvolle bleibt randvoll", () => {
    const werte: number[] = [];
    for (let i = 0; i < 6; i++) {
      werte.push(beladen("pritsche", kunde({ fuellgrad: 0.95 }), 200 + i).v.ladeFuellung);
    }
    const mittel = werte.reduce((a, b) => a + b, 0) / werte.length;
    expect(mittel, `Füllung im Mittel ${(mittel * 100).toFixed(0)} %`).toBeGreaterThan(0.6);
  }, 60000);

  it("voll ist deutlich voller als ein Viertel — sonst sieht man den Unterschied nie", () => {
    const wenig: number[] = [];
    const viel: number[] = [];
    for (let i = 0; i < 6; i++) {
      wenig.push(beladen("pritsche", kunde({ fuellgrad: 0.25 }), 300 + i).v.ladeFuellung);
      viel.push(beladen("pritsche", kunde({ fuellgrad: 0.95 }), 300 + i).v.ladeFuellung);
    }
    const m = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length;
    expect(
      m(viel) / Math.max(m(wenig), 1e-6),
      `viertel ${(m(wenig) * 100).toFixed(0)} %, randvoll ${(m(viel) * 100).toFixed(0)} %`
    ).toBeGreaterThan(1.8);
  }, 60000);
});

describe("Was angekündigt war, kommt auch an — bis an den Deckel jedes Teils", () => {
  it("die Kilogramm auf der Fläche sind die des Kunden, oder jedes Teil trägt schon, was es tragen darf", () => {
    /*
     * BEFUND 15.09.2026 (E-044), aufgefallen erst, als Waage und Anblick
     * dieselbe Zahl benutzen. `loadCargo` verteilt die Kundenmenge auf die
     * Stücke, die wirklich liegen, gedeckelt durch die Dichte. Der zweite
     * Durchgang dieser Verteilung hat dabei ÜBERSCHRIEBEN statt aufgefüllt —
     * er ersetzte die volle Zuteilung durch den Anteil am kleinen Restbetrag.
     * Gemessen vorher: 8500 kg angekündigt, 105 kg geliefert.
     *
     * SEIT 45c (Patrick 22.10.2026: „höchstens 2× Katalog-Gewicht") kommt die
     * Kundenmenge nicht mehr immer ganz an — ein Teil trägt höchstens
     * `teilDeckelKg`, fehlt Masse, wird nachgelegt, und reicht auch das nicht,
     * fährt der Kunde mit weniger vor. Bewacht wird deshalb die Regel selbst:
     * Fehlt etwas, steht JEDES Teil an seinem Deckel. Ein Überschreiben wie
     * E-044 ließe Teile darunter und fiele hier auf.
     */
    let voll = 0;
    for (let i = 0; i < 12; i++) {
      const c = kunde({ massKg: 2000 + i * 600, fuellgrad: 0.9 });
      const angekuendigt = c.massKg;
      const { v } = beladen("pritsche", c, 800 + i);
      expect(c.massKg, `Fuhre ${i + 1}`).toBeLessThanOrEqual(angekuendigt);
      const teile = v.cargo.items as unknown as ScrapItem[];
      const kg = teile.reduce((a, t) => a + t.massKg, 0);
      expect(Math.abs(kg - c.massKg), `Fuhre ${i + 1}: Waage ${c.massKg}, Fläche ${kg}`).toBeLessThan(teile.length + 1);
      if (c.massKg >= angekuendigt - 1) {
        voll++;
        continue;
      }
      for (const t of teile) {
        const k = katalogKg(t)!;
        expect(
          t.massKg,
          `Fuhre ${i + 1}: ${angekuendigt} kg angekündigt, ${c.massKg} kg geliefert — ${t.shape?.name} unter seinem Deckel`
        ).toBeGreaterThanOrEqual(Math.round(teilDeckelKg(t.shape!, k)) - 1);
      }
    }
    console.log(`45c: ${voll} von 12 Pritschen (2,0–8,6 t angekündigt) kamen vollständig an`);
  }, 120000);
});

describe("Der Aufbau wird nur einmal gewürfelt", () => {
  it("das Modell trägt den Aufbau, für den der Kunde bezahlt wurde", () => {
    for (const aufbau of ["flach", "rungen", "koffer"] as const) {
      const { v } = beladen("pritsche", kunde({ aufbau }), 400);
      expect(v.bodyStyleName, `Kunde: ${aufbau}, Wagen: ${v.bodyStyleName}`).toBe(aufbau);
    }
  }, 60000);
});

describe("Der PKW-Anhänger wird mit seinen eigenen Maßen gepackt", () => {
  it("nichts steht über die Bordwand hinaus in der Luft", () => {
    /*
     * Gepackt wurde er bis zum 15.09.2026 wie ein LKW: 2,54 m breit und bis
     * 0,99 m hoch, obwohl er 1,74 m breit ist und 0,34 m Bordwand hat. Geprüft
     * wird am Ergebnis: Kein Stück liegt beim Aufsetzen weiter außen oder
     * höher, als der Anhänger zulässt.
     */
    const grenzeH = ANHAENGER_WAND + LADUNG_UEBERSTAND;
    let geprueft = 0;
    for (let i = 0; i < 5; i++) {
      const { v } = beladen("pkw", kunde({ group: "privat", vehicle: "pkw", fuellgrad: 0.9 }), 500 + i);
      v.group.updateWorldMatrix(true, true);
      for (const it of v.cargo.items) {
        const p = it.body.translation();
        const l = v.bedGroup.worldToLocal(new THREE.Vector3(p.x, p.y, p.z));
        expect(Number.isFinite(l.x + l.y + l.z), "NaN in der Ladung").toBe(true);
        expect(
          Math.abs(l.x),
          `Stück ${Math.abs(l.x).toFixed(2)} m aus der Mitte, erlaubt ${ANHAENGER_HALB_BREITE.toFixed(2)}`
        ).toBeLessThan(ANHAENGER_HALB_BREITE + 0.25);
        expect(l.y, `Stück ${l.y.toFixed(2)} m hoch, erlaubt ${grenzeH.toFixed(2)}`).toBeLessThan(
          grenzeH + 0.25
        );
        geprueft++;
      }
    }
    expect(geprueft, "kein einziges Stück auf dem Anhänger").toBeGreaterThan(4);
  }, 60000);
});
