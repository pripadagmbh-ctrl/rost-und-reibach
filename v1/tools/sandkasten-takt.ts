/**
 * Wie oft kommen im Sandkasten die Anlieferer von selbst? (E-122)
 *
 * Fährt den Hof ohne Spieler: VehicleManager mit dem Takt aus `shift.ts`, so
 * verdrahtet wie die Zeilen für `main.ts` (ohne Tageszeit, ohne Kasse, alle
 * Geld-Haken leer wie im Block „Simulator: abhängen"). Niemand lädt ab — die
 * Pritsche und der Wrackwagen stehen also ihre Standzeit (240 s) aus.
 *
 * Gemeldet wird jede Ankunft und jede Abfahrt mit losem Schrott und
 * Stau-Zustand, und ob ein Wagen steckt.
 *
 * Aufruf: npx vite-node tools/sandkasten-takt.ts      (MIN=20 für 20 Minuten,
 *        KIPPER=1 für nur Kipper, EINZEL=1 für nur Einzelstück-Fuhren (E-126),
 *        ABLADEN=20: ein „Spieler" nimmt nach 20 s am Abladeplatz alles von
 *        der Fläche — so faehrt die Fuhre ab, statt ihre Standzeit auszustehen,
 *        ANSTEHEN=0: ohne die Fuhren, die seit E-131 beim Start auf den
 *        Warteplätzen stehen — der Stand vor E-131)
 *
 * Seit E-131 wird zusätzlich jedes Bild gemessen, wie tief ein Wagen in ein
 * Bauwerk der Hindernisliste ragt (`tiefsteDurchdringung`, derselbe Umriss
 * wie `test/fahrumriss.test.ts`) — die Fahrt vom Warteplatz an den
 * Abladeplatz steht in keiner Streckenliste, sie ist ein Ausfädeln.
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { BAGGER_STAND } from "../src/world/baggerstand";
import { setBaggerOrt, ANSTEH_START_ANZAHL } from "../src/delivery/routes";
import { tiefsteDurchdringung } from "../src/delivery/umriss";
import { alleHindernisse } from "../src/world/obstacles";
import { Shift } from "../src/economy/shift";
import { rollEinzelstueck } from "../src/delivery/customers";

async function main(): Promise<void> {
  await initPhysics();
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0), boden);
  const items = new ItemManager(scene, world);
  const m = new VehicleManager(scene, world, items, new CompositeManager(scene, world, items, new EventBus()));
  m.getExcavatorPos = () => new THREE.Vector3(BAGGER_STAND.x, 0, BAGGER_STAND.z);
  setBaggerOrt(() => BAGGER_STAND);
  m.vollFaehrtLos = true;
  const shift = new Shift();
  /*
   * KIPPER=1: nur Kipper — sie laden selbst ab. Das ist der dichteste Takt,
   * den ein Spieler erleben kann, der jede Fuhre sofort leer macht.
   */
  if (process.env.KIPPER) {
    const spawn = m.spawnNow.bind(m);
    m.spawnNow = (kind, kunde) => spawn(kind ?? "kipper", kunde);
  }

  if (process.env.EINZEL) {
    const spawn = m.spawnNow.bind(m);
    m.spawnNow = (kind, kunde) => {
      if (kind === "abholer") return spawn(kind, kunde);
      const c = kunde ?? rollEinzelstueck();
      spawn(c.vehicle, c);
    };
  }
  if (process.env.ANSTEHEN !== "0") m.stelleAnstehendeAuf(ANSTEH_START_ANZAHL);
  const abladenS = Number(process.env.ABLADEN ?? 0);
  let tiefMax = 0;
  let tiefWo = "";
  let amPlatz = 0;

  // Wie `measureLoose` in main.ts
  const lose = (): number => {
    let kg = 0;
    for (const it of items.items) {
      if (it.containerId) continue;
      if (!it.body.isValid() || !it.body.isDynamic()) continue;
      if (it.body.translation().y > 2.5) continue;
      kg += it.massKg;
    }
    return kg;
  };

  const dt = 1 / 60;
  const dauer = Number(process.env.MIN ?? 15) * 60;
  let looseKg = 0;
  let takt = 0;
  let vorher: string | null = null;
  let seit = 0;
  let maxStand = 0;
  let ankuenfte = 0;
  console.log("   t [s]  Ereignis            lose kg  Faktor  Einfahrt");
  for (let i = 0; i < dauer * 60; i++) {
    const t = i * dt;
    m.update(dt);
    items.clampSpeeds(dt);
    world.step();
    takt += dt;
    if (takt >= 0.25) {
      takt = 0;
      looseKg = lose();
    }
    // Die Zeilen aus dem Bericht für main.ts
    shift.update(dt, looseKg);
    m.acceptDeliveries = !shift.jammed;
    m.intervalFactor = shift.intervalFactor(looseKg);

    if (abladenS > 0) {
      const v = (m as unknown as {
        active: { phaseName: string; cargo: { items: Parameters<typeof items.remove>[0][] } } | null;
      }).active;
      amPlatz = v?.phaseName === "waitUnload" ? amPlatz + dt : 0;
      if (v && amPlatz >= abladenS) {
        for (const it of [...v.cargo.items]) if (items.items.includes(it)) items.remove(it);
        amPlatz = 0;
      }
    }
    const tief = tiefsteDurchdringung(m.fahrzeugBoxen(), alleHindernisse());
    if (tief > tiefMax) {
      tiefMax = tief;
      tiefWo = `t ${t.toFixed(1)} s, ${(m as unknown as { active: { phaseName: string } | null }).active?.phaseName ?? "Warteplatz"}`;
    }
    const jetzt = m.activeKind;
    if (jetzt !== vorher) {
      const was = jetzt
        ? `kommt: ${jetzt}${process.env.ANSTEHEN !== "0" && ankuenfte < ANSTEH_START_ANZAHL ? " (" + m.anstehend + " stehen an)" : ""}`
        : `weg: ${vorher} (${(t - seit).toFixed(0)} s)`;
      if (jetzt) ankuenfte++;
      console.log(
        `${t.toFixed(1).padStart(8)}  ${was.padEnd(18)} ${looseKg.toFixed(0).padStart(7)}  ${m.intervalFactor
          .toFixed(2)
          .padStart(6)}  ${shift.jammed ? "ZU" : "offen"}`
      );
      vorher = jetzt;
      seit = t;
    }
    if (jetzt) maxStand = Math.max(maxStand, t - seit);
  }
  console.log(
    `\n${ankuenfte} Ankünfte in ${(dauer / 60).toFixed(0)} min · längste Zeit eines Wagens auf dem Platz ${maxStand.toFixed(0)} s` +
      ` · zuletzt lose ${looseKg.toFixed(0)} kg · Einfahrt ${shift.jammed ? "zu" : "offen"}` +
      `
tiefste Durchdringung eines Wagens in ein Bauwerk: ${tiefMax.toFixed(2)} m${tiefWo ? " (" + tiefWo + ")" : ""}`
  );
}

void main();
