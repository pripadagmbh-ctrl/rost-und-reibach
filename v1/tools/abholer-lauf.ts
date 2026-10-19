/**
 * ABHOLER-LAUF — zehn Abholungen hintereinander, mit echter Physik (Messgerät,
 * kein Wächter). Gehört zu dem Eintrag „Abholer kommt zum Bagger, fährt nach,
 * Absetzkipper oder Abroller, Schrott und Wracks verladen".
 *
 * Je Fuhre: bestellen (abwechselnd Abroller und Absetzkipper), beladen
 * (Kisten, bei jeder dritten Fuhre ein Auto im Container), bei jeder zweiten
 * den Bagger an einen anderen Verladeplatz stellen (der Wagen fährt nach),
 * dann ABHOLEN. Gemessen:
 *
 *   - steckengeblieben: eine Fuhre, die nicht binnen 6 Minuten vom Hof ist
 *   - Ladung gewandert: größte Verschiebung eines verriegelten Körpers auf der
 *     Fläche während der Fahrt (m)
 *   - Physik-ms: Mittel und p95 je `world.step()`, solange der Wagen beladen
 *     wartet
 *   - Körper wach/gesamt, 10 s nach dem Beladen, und nach wie vielen Schritten
 *     die Ladung schläft
 *
 * Aufruf: npx vite-node tools/abholer-lauf.ts   (FUHREN=1 fuer eine einzelne)
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager, type ScrapItem } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { BAGGER_STAND } from "../src/world/baggerstand";
import { abholPlaetzeEinmal } from "../src/delivery/routes";

const DT = 1 / 60;

async function main(): Promise<void> {
  await initPhysics();
  let s = 777;
  Math.random = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0), boden);
  const items = new ItemManager(scene, world);
  const composites = new CompositeManager(scene, world, items, new EventBus());
  const m = new VehicleManager(scene, world, items, composites);
  m.vollFaehrtLos = true;
  m.sandkastenAbholer = true;
  m.acceptDeliveries = false;
  const bagger = new THREE.Vector3(BAGGER_STAND.x, 0, BAGGER_STAND.z);
  m.getExcavatorPos = () => bagger;
  let hupen = 0;
  m.onAnkunftHupe = () => hupen++;
  const meldungen: string[] = [];
  m.onMeldung = (t) => meldungen.push(t);

  const stepMs: number[] = [];
  const takt = (messen = false): void => {
    m.update(DT);
    items.clampSpeeds(DT);
    const t0 = performance.now();
    world.step();
    if (messen) stepMs.push(performance.now() - t0);
    items.settleSleep(DT); // wie in main.ts: lose Koerper schlafen nur gemeinsam (E-012)
    composites.update();
    scene.updateMatrixWorld(true);
  };
  // Ein Haufen auf dem Platz: Er muss schlafen, auch wenn auf dem Wagen etwas wach ist
  const haufen: RAPIER.RigidBody[] = [];
  for (let k = 0; k < 24; k++) {
    haufen.push(
      items.spawnScrap(
        "mixed",
        80,
        { kind: "box", dims: [0.5, 0.4, 0.6], color: 0x777777 },
        new THREE.Vector3(24 + (k % 4) * 0.7, 0.3 + Math.floor(k / 4) * 0.45, 26),
        new THREE.Quaternion()
      ).body
    );
  }
  console.log(`Körper vor der ersten Fuhre: ${world.bodies.len()}`);
  const plaetze = abholPlaetzeEinmal();
  const silos = plaetze.filter((p) => p.ziel !== null);

  for (let n = 0; n < Number(process.env.FUHREN ?? 10); n++) {
    bagger.set(BAGGER_STAND.x, 0, BAGGER_STAND.z);
    const aufbau = n % 2 === 0 ? "abroller" : "absetzer";
    m.requestPickup("steel", aufbau);
    let i = 0;
    for (; i < 60 * 300 && !m.pickupTruck?.waitingForLoad; i++) takt();
    const t = m.pickupTruck;
    if (!t?.waitingForLoad) {
      console.log(`Fuhre ${n + 1}: NIE ANGEKOMMEN (${aufbau})`);
      continue;
    }
    const bed = (t as unknown as { bedGroup: THREE.Group }).bedGroup;
    const drauf: RAPIER.RigidBody[] = [];
    const lang = aufbau === "absetzer" ? 3.0 : 4.6;
    for (let k = 0; k < 6; k++) {
      const wo = bed.localToWorld(new THREE.Vector3(((k % 2) - 0.5) * 0.6, 1.2, 0.5 + (k / 5) * (lang - 0.5)));
      const it: ScrapItem = items.spawnScrap(
        "steel",
        250,
        { kind: "box", dims: [0.5, 0.4, 0.6], color: 0x8899aa },
        wo,
        new THREE.Quaternion()
      );
      drauf.push(it.body);
      for (let j = 0; j < 30; j++) takt();
    }
    if (n % 3 === 0 && aufbau === "abroller") {
      const q = new THREE.Quaternion();
      bed.getWorldQuaternion(q);
      const gier = new THREE.Euler().setFromQuaternion(q, "YXZ").y;
      drauf.push(composites.spawnCar(bed.localToWorld(new THREE.Vector3(0, 1.6, 2.7)), "pkw", gier).body);
    }
    for (let j = 0; j < 600; j++) takt(true);
    const wach = drauf.filter((b) => !b.isSleeping()).length;
    const haufenWach = haufen.filter((b) => !b.isSleeping()).length;
    // Jede zweite Fuhre: der Bagger wechselt den Verladeplatz
    let umgesetzt = "";
    if (n % 2 === 1) {
      const z = silos[n % silos.length]!;
      bagger.set(z.stand.x, 0, z.stand.z);
      for (let j = 0; j < 60 * 240 && !(t.waitingForLoad && t.abholPlatzJetzt === z); j++) takt();
      umgesetzt = t.abholPlatzJetzt === z ? ` · nachgefahren zu ${z.name}` : " · NICHT NACHGEFAHREN";
      for (let j = 0; j < 120; j++) takt();
    }
    const inv = new THREE.Matrix4();
    const lokal = (b: RAPIER.RigidBody): THREE.Vector3 => {
      const p = b.translation();
      return new THREE.Vector3(p.x, p.y, p.z).applyMatrix4(inv.copy(bed.matrixWorld).invert());
    };
    const start = drauf.map(lokal);
    const auf = t.containedItems(items).length;
    m.requestPickup();
    let wander = 0;
    let j = 0;
    for (; j < 60 * 360 && m.activeKind !== null; j++) {
      takt();
      if (m.activeKind === null) break;
      drauf.forEach((b, k) => {
        if (b.isValid() && b.isKinematic()) wander = Math.max(wander, lokal(b).distanceTo(start[k]!));
      });
    }
    const weg = m.activeKind === null;
    console.log(
      `Fuhre ${String(n + 1).padStart(2)}: ${aufbau.padEnd(8)} Anfahrt ${(i * DT).toFixed(0)} s · ` +
        `${auf}/${drauf.length} auf der Fläche · Wagen wach ${wach}/${drauf.length} · Platzhaufen wach ${haufenWach}/${haufen.length}` +
        `${umgesetzt} · Abfahrt ${(j * DT).toFixed(0)} s · gewandert ${wander.toFixed(3)} m · ${weg ? "vom Hof" : "STECKT FEST"}`
    );
  }
  stepMs.sort((a, b) => a - b);
  const mittel = stepMs.reduce((a, b) => a + b, 0) / stepMs.length;
  console.log(
    `Physik je Schritt (wartend, beladen): Mittel ${mittel.toFixed(3)} ms · p95 ${stepMs[Math.floor(stepMs.length * 0.95)]!.toFixed(3)} ms`
  );
  console.log(`Körper am Ende: ${world.bodies.len()} · Hupen: ${hupen} · Meldungen: ${meldungen.length}`);
  console.log(meldungen.slice(0, 8).join("\n"));
}

void main();
