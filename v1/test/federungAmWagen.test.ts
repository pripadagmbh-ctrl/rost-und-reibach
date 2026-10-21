/**
 * DIE FEDERUNG AM FAHRENDEN WAGEN (E-044, zweite Hälfte).
 *
 * `federung.test.ts` prüft die Rechnung. Hier wird geprüft, dass sie am
 * Modell auch ankommt — und zwar an den drei Stellen, an denen es schiefgehen
 * kann:
 *
 *   1. Die LADUNG federt mit. Federte die Fläche und die Teile darauf nicht,
 *      sähe es schlechter aus als vorher.
 *   2. Die RÄDER bleiben auf dem Boden. Gefedert ist alles ÜBER den Achsen;
 *      sänke der ganze Wagen, versänken die Reifen im Sand.
 *   3. Es kostet KEIN NEUES NETZ. Netze sind der Engpass — die Feder versetzt,
 *      was schon da ist.
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { describe, it, expect, beforeAll } from "vitest";
import { initPhysics } from "../src/physics/physicsWorld";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { VehicleManager } from "../src/delivery/vehicles";
import type { CustomerProfile } from "../src/delivery/customers";
import type { Federung } from "../src/delivery/federung";
import type { Rad } from "../src/delivery/vehicleModel";
import { AUSSEHEN_NEUTRAL } from "../src/delivery/aussehen";

beforeAll(async () => {
  await initPhysics();
});

/** Kundschaft von Hand, damit nicht der Zufall entscheidet, was gemessen wird. */
function kunde(massKg: number, fuellgrad: number): CustomerProfile {
  return {
    group: "haendler",
    name: "Pruefstand",
    subtitle: "Test",
    massKg,
    vehicle: "pritsche",
    aufbau: "rungen",
    fuellgrad,
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
  };
}

interface Innen {
  group: THREE.Group;
  bedGroup: THREE.Group;
  federung: Federung;
  bedLen: number;
  raeder: Rad[];
  cargo: { items: Array<{ body: RAPIER.RigidBody }> };
}

function platz(): {
  world: RAPIER.World;
  items: ItemManager;
  vm: VehicleManager;
  scene: THREE.Scene;
} {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0),
    boden
  );
  const items = new ItemManager(scene, world);
  const vm = new VehicleManager(scene, world, items, new CompositeManager(scene, world, items, new EventBus()));
  return { world, items, vm, scene };
}

/** Wagen erzeugen und das Setzen der Ladung abwarten (Phase `settleCargo`). */
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

function wagen(c: CustomerProfile | undefined, art: "pritsche" | "abholer", saat = 20260915): {
  v: Innen;
  schritt: (n?: number) => void;
  world: RAPIER.World;
  items: ItemManager;
} {
  const zurueck = festerZufall(saat);
  const { world, items, vm } = platz();
  vm.spawnNow(art, c);
  const v = (vm as unknown as { active: unknown }).active as Innen;
  const schritt = (n = 1): void => {
    for (let i = 0; i < n; i++) {
      vm.update(1 / 60);
      items.clampSpeeds(1 / 60);
      world.step();
    }
  };
  schritt(300); // 5 s: die Fuhre setzt sich, dann wird verriegelt
  zurueck();
  return { v, schritt, world, items };
}

describe("Die Federung kommt am Modell an", () => {
  it("ein beladener Wagen steht tiefer als ein leerer", () => {
    /*
     * Was auf der Fläche landet, wird gewürfelt — ohne feste Saat misst das
     * hier Rauschen, und beim ersten Durchlauf war es prompt einmal grün und
     * einmal rot. Geprüft wird über fünf Ladungen, nicht über eine.
     */
    /*
     * GEMESSEN WIRD IM STAND (nachgezogen 15.09.2026, E-064).
     *
     * Vorher wurde der leere Wagen nach 5 Sekunden abgelesen, wo immer er
     * dann gerade war. Seit dem Abholer auf der Bruecke wiegt, steht er zu
     * diesem Zeitpunkt nicht mehr in gleichmaessiger Fahrt, sondern faehrt
     * gerade wieder an — und die Feder nickt beim Anfahren, wie sie soll.
     * Gemessen wurden 2,0025 mm gegen eine Schranke von 2,00 mm: kein
     * Federfehler, sondern eine Messung zur falschen Zeit.
     *
     * Jetzt wird gewartet, bis er an seinem Platz steht. Das ist der Zustand,
     * um den es geht — ein leerer Wagen im Stand sitzt auf seiner Ruhelage.
     */
    const leerer = wagen(undefined, "abholer", 700);
    const phase = (): string => (leerer.v as unknown as { phaseName: string }).phaseName;
    for (let i = 0; i < 60 * 300 && phase() !== "waitLoad"; i++) leerer.schritt();
    expect(phase(), "der leere Abholer ist nie an seinem Platz angekommen").toBe("waitLoad");
    leerer.schritt(120); // zwei Sekunden ausschwingen
    const leer = leerer.v.group.position.y;
    expect(Number.isFinite(leer), "NaN in der Federung").toBe(true);
    expect(
      Math.abs(leer),
      `der LEERE Wagen steht ${(leer * 100).toFixed(2)} cm daneben`
    ).toBeLessThan(0.002);

    for (let i = 0; i < 5; i++) {
      const v = wagen(kunde(7000, 0.95), "pritsche", 600 + i).v;
      const kg = v.federung.last.kg;
      const y = v.group.position.y;
      expect(kg, `Fuhre ${i + 1} kam leer an`).toBeGreaterThan(100);
      expect(Number.isFinite(y), "NaN in der Pose").toBe(true);
      /*
       * Zwei Aussagen in einer: Der Wagen steht tiefer, UND das Modell folgt
       * genau der Rechnung. Ohne die zweite könnte die Feder rechnen, was sie
       * will — zu sehen wäre davon nichts.
       */
      expect(y, `Fuhre ${i + 1}: ${kg.toFixed(0)} kg, Wagen auf ${(y * 100).toFixed(2)} cm`)
        .toBeLessThan(leer - 0.0015);
      expect(y).toBeCloseTo(-v.federung.einfederung(0), 9);
    }
  }, 120000);

  it("die Ladung federt mit — sie bleibt an ihrem Platz auf der Fläche", () => {
    /*
     * Gemessen wird in FLÄCHENKOORDINATEN, nicht in Welthöhe. Die Fläche
     * senkt sich nicht nur, sie NICKT auch — ein Stück am Heck geht dabei
     * weiter herunter als eines an der Stirnwand. In Welthöhe müsste der
     * Abstand also auseinanderlaufen; auf der Fläche darf sich nichts rühren.
     */
    const { v, schritt } = wagen(kunde(7000, 0.95), "pritsche");
    const teil = v.cargo.items[0];
    expect(teil, "keine Ladung auf der Fläche").toBeTruthy();
    const aufDerFlaeche = (): THREE.Vector3 => {
      v.group.updateWorldMatrix(true, true);
      const p = teil!.body.translation();
      return v.bedGroup.worldToLocal(new THREE.Vector3(p.x, p.y, p.z));
    };
    const welt = (): number => {
      v.group.updateWorldMatrix(true, true);
      return v.bedGroup.getWorldPosition(new THREE.Vector3()).y;
    };
    const vorher = aufDerFlaeche();
    const hoeheVorher = welt();
    // Einen kräftigen Stoß auf das Heck geben und ein paar Bilder rechnen
    v.federung.stoss(2500, 3.0, -3.0);
    schritt(5);
    const bewegt = Math.abs(welt() - hoeheVorher);
    expect(bewegt, `die Fläche hat sich nur um ${(bewegt * 1000).toFixed(1)} mm bewegt`)
      .toBeGreaterThan(0.02);
    const nachher = aufDerFlaeche();
    expect(nachher.y, `Platz auf der Fläche y ${vorher.y.toFixed(4)} → ${nachher.y.toFixed(4)}`)
      .toBeCloseTo(vorher.y, 3);
    expect(nachher.z).toBeCloseTo(vorher.z, 3);
  }, 60000);

  it("die Räder bleiben auf dem Boden, egal wie tief der Wagen einfedert", () => {
    const { v, schritt } = wagen(kunde(9000, 1), "pritsche");
    expect(v.raeder.length, "keine Räder eingesammelt").toBeGreaterThan(8);
    v.federung.stoss(4000, 3.5, -3.0);
    for (let n = 0; n < 6; n++) {
      schritt(4);
      v.group.updateWorldMatrix(true, true);
      const p = new THREE.Vector3();
      for (const rad of v.raeder) {
        rad.mesh.getWorldPosition(p);
        expect(
          p.y,
          `Radmitte auf ${p.y.toFixed(3)} m statt 0,48 m (Einfederung ${(
            v.federung.einfederung(rad.z) * 100
          ).toFixed(1)} cm)`
        ).toBeCloseTo(0.48, 2);
      }
    }
  }, 60000);

  it("sie kostet kein einziges neues Netz", () => {
    /*
     * Die Radliste sammelt Meshes ein, die ohnehin gebaut werden — sie legt
     * keine an. Geprüft am Elternteil: Jedes Radteil hängt schon im
     * Fahrzeug-Baum, nicht in einer eigenen Gruppe daneben.
     */
    const { v } = wagen(kunde(3000, 0.6), "pritsche");
    for (const rad of v.raeder) {
      expect(rad.mesh.parent, "ein Radteil hängt nicht am Fahrzeug").toBe(v.group);
      expect(Number.isFinite(rad.y0) && Number.isFinite(rad.z)).toBe(true);
    }
  }, 60000);

  it("die angehobene Mulde federt nicht — sie steht auf dem Kipplager", () => {
    /*
     * Die Mulde steht im gekippten Zustand auf dem Kipplager und dem
     * Hubzylinder, nicht mehr frei auf dem Rahmen — sie federt deshalb nicht.
     *
     * Es ist eine Vorsichtsmaßnahme, keine gemessene Verbesserung: Über 24
     * Zufallssaaten ist die paarweise Differenz zum Stand ohne Federung
     * −5 ± 16 km/h, also nicht unterscheidbar. Der Grund ist Mechanik — eine
     * Fläche, die sich unter der abrutschenden Fuhre hebt und senkt, kann
     * Stücke in den bekannten Schlitz am Kipplager schieben, und dort befreit
     * der Löser sie mit einem einzigen sehr großen Stoß (E-029). Die
     * Höchstwerte zeigen in dieselbe Richtung (231 und 293 km/h mit Sperre
     * gegen 546 und 347 ohne), sind aber als Maß zu schwach, um allein zu
     * tragen.
     *
     * `test/kipper.test.ts` hält die Zahlen fest. HIER wird die Eigenschaft
     * geprüft, damit man beim Lesen sieht, warum es sie gibt.
     */
    const { world, items, vm } = platz();
    vm.spawnNow("kipper", kunde(6000, 0.9));
    let gemessen = 0;
    let groesste = 0;
    let vorher: number | null = null;
    for (let i = 0; i < 60 * 180; i++) {
      vm.update(1 / 60);
      items.clampSpeeds(1 / 60);
      world.step();
      const a = (vm as unknown as { active: (Innen & { tip: number }) | null }).active;
      if (!a) break;
      if (a.tip > 0.2 && a.tip < 0.9) {
        const jetzt = a.federung.einfederung(0);
        if (vorher !== null) groesste = Math.max(groesste, Math.abs(jetzt - vorher));
        vorher = jetzt;
        gemessen++;
      }
    }
    expect(gemessen, "der Kipper hat nie gekippt").toBeGreaterThan(30);
    expect(
      groesste,
      `die Federung bewegt sich im Kippen um ${(groesste * 1000).toFixed(3)} mm je Bild`
    ).toBeLessThan(1e-9);
  }, 300000);

  it("zehn Fuhren in Folge — keine bleibt stecken, keine sackt durch den Boden", () => {
    /*
     * Der Durchlauf, den jede Änderung an `vehicles.ts` bestehen muss. Die
     * Federung greift in die POSE des Wagens ein; ein Vorzeichenfehler dort
     * würde ihn durch den Boden ziehen oder ihn die Route verlieren lassen.
     *
     * Genommen wird der Kipper: Er ist der einzige, der seinen Zyklus ohne
     * Spieler zu Ende bringt — eine Pritsche wartet bis in alle Ewigkeit
     * darauf, dass jemand sie ausräumt.
     */
    const { world, items, vm } = platz();
    let tiefste = 0;
    let hoechste = 0;
    for (let fuhre = 0; fuhre < 10; fuhre++) {
      vm.spawnNow("kipper", kunde(5000, 0.9));
      // E-193: Der nächste rollt erst ein, wenn der vorige eingeparkt hat
      for (let w = 0; w < 60 * 120 && (vm as unknown as { active: Innen | null }).active === null; w++) {
        vm.update(1 / 60);
        items.clampSpeeds(1 / 60);
        world.step();
      }
      let schritte = 0;
      while ((vm as unknown as { active: Innen | null }).active !== null) {
        vm.update(1 / 60);
        items.clampSpeeds(1 / 60);
        world.step();
        const a = (vm as unknown as { active: Innen | null }).active;
        if (a) {
          const p = a.group.position;
          expect(Number.isFinite(p.x + p.y + p.z), `Fuhre ${fuhre + 1}: NaN in der Pose`).toBe(true);
          tiefste = Math.min(tiefste, p.y);
          hoechste = Math.max(hoechste, p.y);
        }
        schritte++;
        expect(schritte, `Fuhre ${fuhre + 1} steckt nach ${schritte} Schritten fest`).toBeLessThan(
          60 * 180
        );
      }
    }
    expect(vm.deliveries, "nicht alle zehn Fuhren sind angekommen").toBe(10);
    expect(
      tiefste,
      `tiefster Stand ${(tiefste * 100).toFixed(1)} cm, höchster ${(hoechste * 100).toFixed(1)} cm`
    ).toBeGreaterThan(-0.2);
    expect(hoechste).toBeLessThan(0.05);
  }, 600000);
});
