import * as THREE from "three";
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
