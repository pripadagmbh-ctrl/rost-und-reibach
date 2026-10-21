import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { Excavator } from "../excavator/excavator";
import type { GripSystem } from "../physics/gripSystem";
import {
  muldenWaende,
  rolloffOberkante,
  type ContainerConfig,
  type ContainerManager,
} from "../world/containers";
import type { ItemManager } from "../world/scrapItems";
import type { PressManager } from "../world/press";
import type { ChallengeQuellen } from "./challenge";
import type { LektionQuellen, LektionZustand } from "./lektion";

/**
 * DIE QUELLEN EINER AUFGABE IM SPIEL (E-162).
 *
 * Was `ChallengeLauf` von der Welt liest, an EINER Stelle verdrahtet — damit
 * `main.ts` nur noch einen Aufruf braucht und `test/aufgabe1.test.ts` den
 * echten Bagger mit genau diesen Quellen durch die sechs Schritte fahren kann.
 *
 * NUR LESEN. Jede Zeile hier fragt ab; keine setzt etwas am Bagger, am
 * Greifer oder an einem Koerper (Regel 2).
 */
export function weltQuellen(w: {
  bagger: Excavator;
  grip: GripSystem;
  containers: ContainerManager;
  items: ItemManager;
  /** Ohne Presse (Werkbank im Test) ist nichts ueber oder in der Kammer */
  press: PressManager | null;
}): ChallengeQuellen {
  const sensor = new THREE.Vector3();
  const finde = (id: string) => w.containers.containers.find((c) => c.cfg.id === id) ?? null;
  return {
    gegriffen: () => w.grip.grippedBodies,
    spinne: () => w.bagger.getSensorPosition(sensor),
    drehmitte: () => w.bagger.position,
    /*
     * Weltgier des Oberwagens: Fahrwerk (`heading`) plus Drehkranz
     * (`cabYaw`). Daraus dreht der Bagger in `excavator.ts` den Ausleger
     * (`root.rotation.y = heading`, `cabGroup.rotation.y = cabYaw`); der
     * Ausleger liegt in der Mitte des Oberwagens (`BOOM_PIVOT.x = 0`), also
     * zeigt diese Richtung genau dorthin, wo die Spinne haengt.
     */
    blickRad: () => w.bagger.cabinBaseYaw,
    behaelter: (id) => {
      const c = finde(id);
      return c ? { ...c.ort, oberkante: behaelterOberkante(c.cfg) } : null;
    },
    ueberBehaelter: (id, p) => finde(id)?.isOverhead(p.x, p.z) ?? false,
    behaelterVon: (itemId) => w.items.items.find((i) => i.id === itemId)?.containerId ?? null,
    ueberKammer: (p) => w.press?.ueberKammer(p) ?? false,
    inKammer: (p) => w.press?.inChamber(p) ?? false,
    // Wracks stehen auch in der Itemliste (derselbe Koerper, `raeumeAuf` in `aufbau.ts`)
    hoehenspanne: (handle) => {
      const b = w.items.items.find((i) => i.body.handle === handle)?.body;
      return b && b.isValid() ? hoehenspanne(b) : null;
    },
  };
}

/**
 * Wie hoch die Wand ist, ueber die ein Teil hinein muss (m ueber Boden).
 *
 * Betonbox: die Flanken — dieselbe Zahl, mit der `containers.ts` sie baut
 * (`muldenWaende`, ganze Steinlagen). Die hohe Rueckwand zaehlt nicht: Ueber
 * sie wirft niemand ein. Absetzcontainer: Oberkante samt Kufe und Riegel
 * (`rolloffOberkante`). Sonst die Hoehe aus `size`.
 */
export function behaelterOberkante(cfg: ContainerConfig): number {
  if (cfg.kind === "rolloff") return rolloffOberkante(cfg.size[2]);
  const flanken = muldenWaende(cfg).filter((m) => m.teil === "flanke+" || m.teil === "flanke-");
  return flanken.length > 0 ? Math.max(...flanken.map((m) => m.top)) : cfg.size[2];
}

/**
 * Tiefster und hoechster Punkt eines Koerpers (m) — die Ecken seiner Quader-
 * Kollider, gedreht wie sie liegen (Wracks bestehen aus Quadern, E-128).
 * Andere Formen zaehlen nicht mit; ohne Quader null. Nur lesen.
 */
export function hoehenspanne(body: RAPIER.RigidBody): { unten: number; oben: number } | null {
  let unten = Infinity;
  let oben = -Infinity;
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  for (let i = 0; i < body.numColliders(); i++) {
    const c = body.collider(i);
    if (c.shapeType() !== RAPIER.ShapeType.Cuboid) continue;
    const h = c.halfExtents();
    const t = c.translation();
    const r = c.rotation();
    q.set(r.x, r.y, r.z, r.w);
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        for (const sz of [-1, 1]) {
          const y = t.y + v.set(sx * h.x, sy * h.y, sz * h.z).applyQuaternion(q).y;
          if (y < unten) unten = y;
          if (y > oben) oben = y;
        }
  }
  return unten <= oben ? { unten, oben } : null;
}

/**
 * DIE QUELLEN EINER LEKTION (E-196) — Bagger und Kamera, NUR LESEN.
 * Die Feldnamen sind die echten aus `excavator.ts` bzw. `OrbitCamera.blick`.
 */
export function lektionQuellen(w: { bagger: Excavator; kamera: { readonly blick: LektionZustand["kamera"] } }): LektionQuellen {
  const sensor = new THREE.Vector3();
  return {
    zustand: () => {
      const b = w.bagger;
      const s = b.getSensorPosition(sensor);
      return {
        cabYaw: b.cabYaw,
        boom: b.boomAngle,
        stick: b.stickAngle,
        closure: b.closure,
        rotator: b.rotatorYaw,
        x: b.position.x,
        z: b.position.z,
        heading: b.heading,
        abgestuetzt: b.abgestuetzt,
        spinne: { x: s.x, y: s.y, z: s.z },
        kamera: w.kamera.blick,
      };
    },
  };
}
