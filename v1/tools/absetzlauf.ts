/**
 * DER ABSETZKIPPER, VIELE FUHREN (E-141) — Messwerkzeug, kein Wächter.
 *
 *     npx vite-node tools/absetzlauf.ts -- [Saaten, Vorgabe 24]
 *
 * Je Saat eine Fuhre „kippen" und eine „absetzen", echte Physik. Gedruckt:
 * schnellstes Stück (km/h), Anteil, der beim Kippen herauskam, wie viele
 * Körper es gibt und wie viele davon wach sind, sobald die abgesetzte Mulde
 * steht, und die Rechenzeit eines Physikschritts dabei.
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { festerZufall } from "../test/kipperlauf";
import { pruefKunde } from "../test/pruefkunde";

await initPhysics();
const n = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 24);

function lauf(modus: "kippen" | "absetzen", saat: number) {
  const zurueck = festerZufall(saat);
  try {
    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = 1 / 60;
    const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0), boden);
    const items = new ItemManager(scene, world);
    const m = new VehicleManager(scene, world, items, new CompositeManager(scene, world, items, new EventBus()));
    m.acceptDeliveries = false;
    let brutto = 0;
    let netto = 0;
    m.onWeighIn = (kg) => (brutto = kg);
    m.onWeighOut = (kg) => (netto = kg);
    m.spawnNow("absetzer", pruefKunde({ gruppe: "gewerbe", vehicle: "absetzer", sortenrein: null, fuellgrad: 0.7 }));
    const v = (m as unknown as { active: { absetzModus: string; cargo: { items: Array<{ body: RAPIER.RigidBody }> } } | null }).active!;
    v.absetzModus = modus;
    const eigene = new Set(v.cargo.items.map((it) => it.body.handle));
    let vmax = 0;
    let wach = -1;
    let gesamt = -1;
    let ms = 0;
    let msN = 0;
    for (let i = 0; i < 60 * 150; i++) {
      m.update(1 / 60);
      items.clampSpeeds(1 / 60);
      const t0 = performance.now();
      world.step();
      const aktiv = (m as unknown as { active: unknown }).active;
      if (!aktiv && m.abgesetzteMulde) {
        ms += performance.now() - t0;
        msN++;
      }
      for (const it of items.items) {
        if (!eigene.has(it.body.handle) || !it.body.isValid() || !it.body.isDynamic()) continue;
        const l = it.body.linvel();
        vmax = Math.max(vmax, Math.hypot(l.x, l.y, l.z));
      }
      if (!aktiv && (modus === "kippen" || msN > 600)) break;
    }
    if (modus === "absetzen") {
      gesamt = 0;
      wach = 0;
      world.bodies.forEach((b) => {
        gesamt++;
        if (b.isDynamic() && !b.isSleeping()) wach++;
      });
    }
    return { vmax: vmax * 3.6, raus: brutto > 0 ? netto / brutto : 0, wach, gesamt, ms: msN ? ms / msN : 0 };
  } finally {
    zurueck();
  }
}

const k = [...Array(n).keys()].map((i) => lauf("kippen", 5000 + i));
const a = [...Array(Math.min(n, 6)).keys()].map((i) => lauf("absetzen", 6000 + i));
const s = (x: number[]) => [...x].sort((p, q) => p - q);
const med = (x: number[]) => s(x)[Math.floor(x.length / 2)]!;
console.log(`KIPPEN, ${n} Saaten: schnellstes Stueck Median ${med(k.map((r) => r.vmax)).toFixed(0)} km/h, ` +
  `Hoechst ${Math.max(...k.map((r) => r.vmax)).toFixed(0)} km/h; herausgekippt Median ${(med(k.map((r) => r.raus)) * 100).toFixed(0)} %, ` +
  `schlechtester ${(Math.min(...k.map((r) => r.raus)) * 100).toFixed(0)} %`);
console.log(`ABSETZEN, ${a.length} Saaten: schnellstes Stueck Hoechst ${Math.max(...a.map((r) => r.vmax)).toFixed(0)} km/h; ` +
  `nach 10 s Stand: Koerper wach/gesamt ${a.map((r) => `${r.wach}/${r.gesamt}`).join(" ")}; ` +
  `Physikschritt ${med(a.map((r) => r.ms)).toFixed(2)} ms (Median)`);
