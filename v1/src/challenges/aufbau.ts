import * as THREE from "three";
import type { CarComposite, CompositeManager } from "../dismantle/composites";
import { WRACKDATEN } from "../dismantle/carDef";
import { getMaterial } from "../materials/catalog";
import type { PileSpec } from "../world/objektkatalog";
import {
  BIG_SPECS,
  HUGE_SPECS,
  SPECS,
  umkugelRadius,
  type ItemManager,
  type ScrapItem,
  type ScrapShape,
} from "../world/scrapItems";
import type { ChallengeDaten } from "./challenge";

/**
 * DER PLATZ EINER AUFGABE (E-162) — aufbauen und wieder abraeumen.
 *
 * `baueAufgabe` legt hin, was die Daten nennen: Teile aus dem Teilekatalog
 * (mit ihrer Katalog-Form, Bau und Namen) und Wracks. `raeumeAuf` nimmt beim
 * Neustart (↻) ohne Neuladen alles wieder weg, was NICHT zum Grundbestand
 * gehoert — auch was waehrend der Aufgabe entstanden ist: abgerissene Teile,
 * Presspakete, Bruchstuecke.
 *
 * Kein Koerper wird hier bewegt, nur angelegt und entfernt. Die Physik setzt
 * danach `items.settle` (wie beim Spielstart).
 */

export interface AufgabenObjekte {
  teile: ScrapItem[];
  wracks: CarComposite[];
}

/** Was vor der Aufgabe da war: Item-IDs und Wrack-Handles. */
export interface Grundbestand {
  items: ReadonlySet<string>;
  wracks: ReadonlySet<number>;
}

export function grundbestandVon(w: { items: ItemManager; composites: CompositeManager }): Grundbestand {
  return {
    items: new Set(w.items.items.map((i) => i.id)),
    wracks: new Set(w.composites.cars.map((c) => c.body.handle)),
  };
}

/** Ein Teil nach Namen aus dem Katalog (Kleinteile, Grossteile, Schwergewichte). */
export function teilSpec(name: string): PileSpec | null {
  for (const liste of [SPECS, BIG_SPECS, HUGE_SPECS]) {
    const s = liste.find((x) => x.name === name);
    if (s) return s;
  }
  return null;
}

/** Die Form, wie `randomCargo` sie aus einem Katalogeintrag macht — dieselben Felder. */
export function formAusSpec(spec: PileSpec): ScrapShape {
  return {
    kind: spec.kind,
    dims: spec.dims,
    color: getMaterial(spec.materialId).color,
    bau: spec.bau,
    name: spec.name,
    zusammensetzung: spec.zusammensetzung,
    massiv: spec.massiv,
    trennbar: spec.trennbar,
    nurWerkzeug: spec.nurWerkzeug,
  };
}

/**
 * Luft zwischen den Umkreisen zweier Dinge im Aufbau. // SW: 0,3 m — Spawn
 * ohne Ueberlappung (v2 E-010) auch dann, wenn ein Teil beim Setzen etwas
 * rollt.
 */
export const AUFBAU_LUFT_M = 0.3;

/** Umkreis eines Wracks im Grundriss — halbe Diagonale des Chassis (`carDef.ts`). */
function wrackUmkreis(art: keyof typeof WRACKDATEN): number {
  const [b, , l] = WRACKDATEN[art].karosserie.chassis;
  return Math.hypot(b / 2, l / 2);
}

/**
 * Was am Aufbau nicht stimmt — leer heisst baubar. Unbekannte Teilnamen und
 * Ueberlappungen (Umkreis + `AUFBAU_LUFT_M`). Bewacht fuer jeden Katalog-
 * eintrag in `test/aufbau.test.ts`.
 */
export function aufbauKonflikte(daten: ChallengeDaten): string[] {
  const fehler: string[] = [];
  const kreise: Array<{ was: string; x: number; z: number; r: number }> = [];
  for (const t of daten.aufbau.teile ?? []) {
    const s = teilSpec(t.name);
    if (!s) {
      fehler.push(`unbekanntes Teil „${t.name}"`);
      continue;
    }
    kreise.push({ was: t.name, x: t.x, z: t.z, r: umkugelRadius(formAusSpec(s)) });
  }
  for (const w of daten.aufbau.wracks ?? []) kreise.push({ was: `Wrack ${w.art}`, x: w.x, z: w.z, r: wrackUmkreis(w.art) });
  for (let i = 0; i < kreise.length; i++) {
    for (let j = i + 1; j < kreise.length; j++) {
      const a = kreise[i]!;
      const b = kreise[j]!;
      if (Math.hypot(a.x - b.x, a.z - b.z) < a.r + b.r + AUFBAU_LUFT_M) fehler.push(`${a.was} ueberlappt ${b.was}`);
    }
  }
  return fehler;
}

/**
 * Die Aufgabe hinlegen. Teile auf ihre Umkugel ueber den Boden gesetzt (sie
 * fallen ein paar Zentimeter und kommen mit `items.settle` zur Ruhe), Wracks
 * auf 0,5 m wie beim Spielstart (`main.ts`). Den Startgreifer setzt `main.ts`
 * (`setzeGreifer`), weil er Bagger und Greifsystem braucht.
 */
export function baueAufgabe(
  daten: ChallengeDaten,
  w: { items: ItemManager; composites: CompositeManager }
): AufgabenObjekte {
  const fehler = aufbauKonflikte(daten);
  if (fehler.length > 0) throw new Error(`Aufgabe ${daten.id}: ${fehler.join("; ")}`);
  const wracks = (daten.aufbau.wracks ?? []).map((a) =>
    w.composites.spawnCar(new THREE.Vector3(a.x, 0.5, a.z), a.art, a.gier ?? 0)
  );
  const teile = (daten.aufbau.teile ?? []).map((t) => {
    const s = teilSpec(t.name)!;
    const form = formAusSpec(s);
    const dreh = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.gier ?? 0);
    // SW: 2 cm ueber der Umkugel — kein Kontakt mit dem Boden im ersten Schritt
    const y = umkugelRadius(form) + 0.02;
    return w.items.spawnScrap(s.materialId, s.massKg, form, new THREE.Vector3(t.x, y, t.z), dreh);
  });
  return { teile, wracks };
}

/**
 * Alles weg, was nicht zum Grundbestand gehoert. Vorher ruft `main.ts`
 * `grip.releaseAll()` — ein gehaltener Koerper haengt am Fixed Joint.
 *
 * Erst sammeln, dann entfernen (v2 E-044): Waehrend des Durchgangs aendern
 * sich die Listen, ueber die gelaufen wird. Ein Wrack steht als Karosse in
 * `composites.cars` UND als Eintrag in `items.items` (derselbe Koerper) —
 * es wird wie beim Verkauf (`economy/account.ts`) einmal ueber das Composite
 * entsorgt und aus der Itemliste genommen, ohne den Koerper zweimal zu loeschen.
 *
 * Die Zonen-Zaehlung vergisst entfernte Teile in `ContainerManager.recount`
 * (seit E-162: ein gezaehltes Teil, das es nicht mehr gibt, loest die
 * Neuzaehlung aus und meldet `itemLeft`).
 */
export function raeumeAuf(
  grund: Grundbestand,
  w: { items: ItemManager; composites: CompositeManager }
): { teile: number; wracks: number } {
  w.items.raeumeVerwaiste();
  const wegWracks = w.composites.cars.filter((c) => !grund.wracks.has(c.body.handle));
  const wrackHandles = new Set(wegWracks.map((c) => c.body.handle));
  const wegItems = w.items.items.filter((i) => !grund.items.has(i.id));
  let teile = 0;
  for (const it of wegItems) {
    if (wrackHandles.has(it.body.handle)) {
      w.items.remove(it, false); // der Koerper gehoert der Karosse — die raeumt unten
    } else {
      w.items.remove(it, true);
      teile++;
    }
  }
  for (const c of wegWracks) w.composites.despawnByBody(c.body);
  return { teile, wracks: wegWracks.length };
}
