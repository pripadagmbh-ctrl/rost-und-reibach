/**
 * DIE SPÄNEMULDE, VIELE FUHREN (E-147) — Messwerkzeug, kein Wächter.
 *
 *     npx vite-node tools/spaenelauf.ts -- [Saaten, Vorgabe 12]
 *
 * Je Saat eine Spänefuhre „kippen" und eine „absetzen", echte Physik. Gedruckt
 * je Lauf: Knäuel, kg, schnellstes Stück (km/h), herausgekippt, Schritte bis
 * die ganze Fuhre schläft, Physik-ms je Schritt (Median und Spitze), am Ende
 * Körper wach/gesamt.
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { rollSpaenefuhre } from "../src/delivery/customers";
import { festerZufall } from "../test/kipperlauf";
import { pruefKunde } from "../test/pruefkunde";

await initPhysics();
const n = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 12);

/** Median statt Mittel: Der Dev-PC hat Ausreisser von 50–400 ms, auch ohne Spaene (Gegenprobe VERGLEICH=1). */
const median = (x: number[]): number => [...x].sort((a, b) => a - b)[Math.floor(x.length / 2)] ?? 0;

type Wagen = { absetzModus: string; cargo: { items: Array<{ body: RAPIER.RigidBody; massKg: number }> } };

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
    // VERGLEICH=1: eine gewoehnliche Absetzfuhre (wie tools/absetzlauf.ts) als Gegenprobe
    m.spawnNow(
      "absetzer",
      process.env.VERGLEICH
        ? pruefKunde({ gruppe: "gewerbe", vehicle: "absetzer", sortenrein: null, fuellgrad: 0.7 })
        : rollSpaenefuhre()
    );
    const v = (m as unknown as { active: Wagen | null }).active!;
    v.absetzModus = modus;
    const fuhre = [...v.cargo.items];
    const kg = fuhre.reduce((s, it) => s + it.massKg, 0);
    const eigene = new Set(fuhre.map((it) => it.body.handle));
    let vmax = 0;
    let spitze = 0;
    const jePhase = new Map<string, number[]>();
    const alle: number[] = [];
    let ruhigAb = -1;
    let freigabe = -1;
    let zuletztWach = -1;
    let frei = false;
    for (let i = 0; i < 60 * 180; i++) {
      m.update(1 / 60);
      items.clampSpeeds(1 / 60);
      const t0 = performance.now();
      world.step();
      const dt = performance.now() - t0;
      if (i > 60) spitze = Math.max(spitze, dt);
      const ph = (m as unknown as { active: { phaseName: string } | null }).active?.phaseName ?? "weg";
      const e = jePhase.get(ph) ?? [];
      e.push(dt);
      jePhase.set(ph, e);
      alle.push(dt);
      if (freigabe < 0 && (ph === "muldeLoesen" || ph === "muldeKippen")) freigabe = i;
      const aktiv = (m as unknown as { active: unknown }).active;
      let wach = 0;
      for (const it of items.items) {
        if (!eigene.has(it.body.handle) || !it.body.isValid() || !it.body.isDynamic()) continue;
        frei = true;
        const l = it.body.linvel();
        vmax = Math.max(vmax, Math.hypot(l.x, l.y, l.z));
        if (!it.body.isSleeping()) wach++;
      }
      if (!aktiv && frei && wach === 0 && ruhigAb < 0) ruhigAb = i;
      if (wach > 0) zuletztWach = i;
      if (!aktiv && ruhigAb >= 0 && i > ruhigAb + 60) break;
    }
    let wach = 0;
    let gesamt = 0;
    world.bodies.forEach((b) => {
      gesamt++;
      if (b.isDynamic() && !b.isSleeping()) wach++;
    });
    return {
      stueck: fuhre.length,
      kg,
      vmax: vmax * 3.6,
      raus: brutto > 0 ? netto / brutto : 0,
      ruhigAb,
      schlaeftNach: freigabe >= 0 ? (zuletztWach - freigabe) / 60 : -1,
      ms: median(alle),
      spitze,
      wach,
      gesamt,
      phasen: [...jePhase].map(([k, e]) => `${k} ${median(e).toFixed(2)}`).join(", "),
    };
  } finally {
    zurueck();
  }
}

for (const modus of ["kippen", "absetzen"] as const) {
  console.log(`--- ${modus} ---`);
  for (let i = 0; i < n; i++) {
    const r = lauf(modus, 7000 + i);
    console.log(
      `Saat ${7000 + i}: ${r.stueck} Knaeuel, ${r.kg} kg, vmax ${r.vmax.toFixed(0)} km/h, ` +
        `raus ${(r.raus * 100).toFixed(0)} %, ruhig ab Schritt ${r.ruhigAb} (${r.schlaeftNach.toFixed(1)} s nach der Freigabe), ` +
        `Physik Median ${r.ms.toFixed(2)} ms (Spitze ${r.spitze.toFixed(1)}), wach/gesamt ${r.wach}/${r.gesamt}`
    );
    if (process.env.PHASEN) console.log("   je Phase (ms Median): " + r.phasen);
  }
}
