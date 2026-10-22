/**
 * Gemeinsam für `test/riesenteile.test.ts` und `tools/riesenteile.ts` (45c):
 * eine Fuhre kopflos beladen und das Katalog-Gewicht eines Teils nachschlagen.
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ItemManager, SPECS, BIG_SPECS, HUGE_SPECS, type ScrapItem } from "../src/world/scrapItems";
import { SPAENE_VARIANTEN } from "../src/world/spaene";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { VehicleManager } from "../src/delivery/vehicles";
import { vehicleForCustomer, type CustomerProfile } from "../src/delivery/customers";

const KATALOG = new Map<string, number>();
// Name UND Maße: „Waschmaschine" und „VA-Behälter" stehen zweimal mit verschiedenem Gewicht im Katalog
const schluessel = (name: string | undefined, dims: readonly number[] | undefined): string => `${name}|${dims?.join(",")}`;
for (const s of [...SPECS, ...BIG_SPECS, ...HUGE_SPECS]) KATALOG.set(schluessel(s.name, s.dims), s.massKg);

/** Katalog-Gewicht eines Teils (Name + Maße; Späne nach Variante), sonst null. */
export function katalogKg(it: Pick<ScrapItem, "shape">): number | null {
  if (it.shape?.spaene !== undefined) return SPAENE_VARIANTEN[it.shape.spaene]?.massKg ?? null;
  return KATALOG.get(schluessel(it.shape?.name, it.shape?.dims)) ?? null;
}

/** Ein frischer Fuhrpark, ein Kunde, ein `loadCargo` (fester Zufall). Liefert die Teile auf der Fläche. */
export function beladeFuhre(c: CustomerProfile, saat: number): ScrapItem[] {
  const echt = Math.random;
  let z = saat >>> 0;
  Math.random = () => {
    z = (z * 1664525 + 1013904223) >>> 0;
    return z / 4294967296;
  };
  try {
    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const items = new ItemManager(scene, world);
    const vm = new VehicleManager(scene, world, items, new CompositeManager(scene, world, items, new EventBus()));
    vm.spawnNow(vehicleForCustomer(c), c);
    const v = (vm as unknown as { active: { cargo: { items: ScrapItem[] } } | null }).active;
    const teile = [...(v?.cargo.items ?? [])];
    world.free();
    return teile;
  } finally {
    Math.random = echt;
  }
}
