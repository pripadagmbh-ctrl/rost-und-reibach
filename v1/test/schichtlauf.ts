/**
 * PRÜFSTAND SCHICHT (E-202) — ein kopfloser Schicht-Platz mit echter Physik
 * und ein einfacher Test-Fahrer ohne Bagger.
 *
 * Gemeinsam für `test/schichtbetrieb.test.ts` und `tools/schicht-lauf.ts`, damit
 * Wächter und Messung denselben Platz fahren. Aufgebaut wie `tools/platzlast.ts`
 * (Platz, Büro, Boxen, Presse, die Kontaktwerte des Spiels aus `PhysicsWorld`)
 * und getaktet wie `main.ts` (`stepOnce`): Physikschritt, Trägheitsbremse,
 * Tempodeckel, gemeinsames Einschlafen, Verbunde, Fuhrpark, Presse — dann der
 * Schichtbetrieb mit der Uhr.
 *
 * DER TEST-FAHRER ersetzt Bagger und Spinne durch eine Hand: Alle `griffS`
 * Sekunden nimmt er EIN Teil von der Annahme und legt es dorthin, wo es
 * hingehört — Stahl in STAHL, Buntmetall in BUNT + VA, Müll in die MÜLL-Halde,
 * alles andere auf den Misch-Verlader. Steht ein Box-Abholer vorn, lädt er ihn
 * aus seiner Box und hupt, wenn sie leer ist. Wartet eine Pritsche am Lager,
 * „fährt" er hin (`lagerFahrtS`, in der Zeit greift er nichts), lädt sie in
 * das Silo ab und fährt zurück. Gelegt wird von oben, ein Stück über das, was
 * schon liegt; was an der alten Stelle darauf lag, wird geweckt (wie bei
 * einem Griff, sonst schliefe es in der Luft, E-158).
 *
 * `griffS = 0` heißt: niemand räumt.
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { PhysicsWorld } from "../src/physics/physicsWorld";
import { Yard } from "../src/world/yard";
import { OfficeBuilding } from "../src/world/office";
import { ContainerManager, CONFIGS, gehoertHierhin, type ContainerConfig } from "../src/world/containers";
import { ItemManager, type ScrapItem } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { PressManager } from "../src/world/press";
import { EventBus } from "../src/core/events";
import { VehicleManager } from "../src/delivery/vehicles";
import { SchichtBetrieb } from "../src/delivery/schichtbetrieb";
import { boxFuer, BOX_ORDERS, type BoxOrder } from "../src/delivery/schichtfuhrpark";
import { aktiviereSchichtPlatz } from "../src/world/schichtplatz";
import { setBuildingObstacles } from "../src/world/obstacles";
import { BAGGER_STAND } from "../src/world/baggerstand";
import { ABKIPP_ZONE, ABLADE_SPUR_X, ABLADE_HALT_Z } from "../src/delivery/routes";
import { ABSETZMULDE } from "../src/delivery/fuellgrad";
import type { Schichtstufe } from "../src/economy/kasse";

export const DT = 1 / 60;

/**
 * Leinwand-Attrappe wie in `tools/platzlast.ts`: Schilder und Platzboden
 * zeichnen auf eine Leinwand, die es ohne Seite nicht gibt.
 */
export function leinwandAttrappe(): void {
  if (typeof (globalThis as Record<string, unknown>).document !== "undefined") return;
  const attrappe = (): unknown =>
    new Proxy(
      {},
      {
        get: (ziel: Record<string, unknown>, feld: string) => (feld in ziel ? ziel[feld] : attrappe),
        set: (ziel: Record<string, unknown>, feld: string, wert: unknown) => {
          ziel[feld] = wert;
          return true;
        },
      }
    );
  const ctx = attrappe() as Record<string, unknown>;
  ctx.measureText = (): { width: number } => ({ width: 0 });
  (globalThis as Record<string, unknown>).requestAnimationFrame = (): number => 0;
  (globalThis as Record<string, unknown>).document = {
    createElement: (): unknown => ({ width: 0, height: 0, getContext: () => ctx, toDataURL: () => "", style: {} }),
  };
}

/** Fester Zufall (wie in den Wächtern), damit ein Lauf wiederholbar ist. */
export function festerZufall(seed: number): () => void {
  const alt = Math.random;
  let s = seed;
  Math.random = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  return () => {
    Math.random = alt;
  };
}

/** Was gemeldet wurde — für Wächter und Messung. */
export interface Protokoll {
  abfahrten: Array<{ t: number; order: string | null; kg: number; teile: number }>;
  standzeiten: Array<{ t: number; standzeitS: number; fahrzeug: string }>;
  meldungen: string[];
}

export interface SchichtPlatz {
  phys: PhysicsWorld;
  world: RAPIER.World;
  scene: THREE.Scene;
  items: ItemManager;
  composites: CompositeManager;
  containers: ContainerManager;
  vehicles: VehicleManager;
  betrieb: SchichtBetrieb;
  bagger: THREE.Vector3;
  protokoll: Protokoll;
  /** Schicht-Sekunden seit 06:00. */
  schichtS: number;
  /** Loser Schrott, wie `main.ts` ihn messen soll (ohne Boxen, ohne Ladeflächen). */
  loseKg: number;
  /** Physik-ms des letzten Schritts. */
  letzteMs: number;
  takt(): void;
}

export interface PlatzOptionen {
  stufe: Schichtstufe;
  saat: number;
  /** Feste Box-Inhalte statt gemessener (für Wächter). */
  boxKg?: Partial<Record<BoxOrder, number>>;
  /** Fester loser Schrott statt gemessener (für Wächter). */
  loseKg?: () => number;
}

/** Den Schicht-Platz bauen — `initPhysics()` muss vorher gelaufen sein. */
export function baueSchichtPlatz(o: PlatzOptionen): SchichtPlatz {
  leinwandAttrappe();
  aktiviereSchichtPlatz();
  const scene = new THREE.Scene();
  const phys = new PhysicsWorld();
  const world = phys.world;
  new Yard(scene, world);
  new OfficeBuilding(scene, world);
  const items = new ItemManager(scene, world);
  const bus = new EventBus();
  const composites = new CompositeManager(scene, world, items, bus);
  const containers = new ContainerManager(scene, world, bus);
  containers.nachtschichtAktiv = false;
  containers.preiseZeigen = false;
  const press = new PressManager(scene, world, items, composites);
  setBuildingObstacles(containers.hindernisse());
  const vehicles = new VehicleManager(scene, world, items, composites);
  vehicles.vollFaehrtLos = true;
  vehicles.sandkastenAbholer = true; // wie `main.ts` im Simulator — die Schicht stellt es für ihre Wagen selbst ab
  const bagger = new THREE.Vector3(BAGGER_STAND.x, 0, BAGGER_STAND.z);
  vehicles.getExcavatorPos = () => bagger;
  const protokoll: Protokoll = { abfahrten: [], standzeiten: [], meldungen: [] };
  vehicles.onMeldung = (t) => protokoll.meldungen.push(t);

  const boxKg = (b: BoxOrder): number => o.boxKg?.[b] ?? containers.byId(boxFuer(b).id).contentKg;
  const p = {} as SchichtPlatz;
  const betrieb = new SchichtBetrieb(o.stufe, vehicles, { looseKg: () => o.loseKg?.() ?? p.loseKg, boxKg }, o.saat);
  betrieb.onVerladerAbfahrt = (e) =>
    protokoll.abfahrten.push({
      t: p.schichtS,
      order: e.order,
      kg: e.teile.reduce((s, x) => s + x.massKg, 0),
      teile: e.teile.length,
    });
  betrieb.onStandzeit = (e) => protokoll.standzeiten.push({ t: p.schichtS, ...e });

  let bild = 0;
  const messeLose = (): number => {
    let kg = 0;
    for (const it of items.items) {
      if (it.containerId || !it.body.isValid() || !it.body.isDynamic()) continue;
      if (it.body.translation().y > 2.5) continue;
      if (vehicles.liegtAufLaster(it.body)) continue;
      kg += it.massKg;
    }
    return kg;
  };
  Object.assign(p, {
    phys,
    world,
    scene,
    items,
    composites,
    containers,
    vehicles,
    betrieb,
    bagger,
    protokoll,
    schichtS: 0,
    loseKg: 0,
    letzteMs: 0,
    takt(): void {
      const a = performance.now();
      phys.step();
      p.letzteMs = performance.now() - a;
      containers.bremseAlle();
      items.clampSpeeds(DT);
      items.settleSleep(DT);
      composites.update();
      vehicles.update(DT);
      press.update(DT);
      if (bild % 6 === 0) containers.recount(items, new Set());
      if (bild % 15 === 0) p.loseKg = messeLose();
      bild++;
      p.schichtS += DT;
      betrieb.takt(DT, p.schichtS);
    },
  });
  return p;
}

/* ---------------------------------------------------------- Der Test-Fahrer */

/** Die Fläche, auf der etwas abgelegt wird: Mitte, Halbmaße, Drehung — und wie hoch man ansetzt. */
interface Ablage {
  mitte(): THREE.Vector3;
  /** Ein Punkt auf der Fläche (Welt, y = Boden der Fläche). */
  punkt(): THREE.Vector3;
  /** Liegt dieser Körper dort? */
  enthaelt(b: RAPIER.RigidBody): boolean;
  /** Mindesthöhe, auf der losgelassen wird (über Wänden). */
  ueber: number;
}

function boxAblage(c: ContainerConfig): Ablage {
  const [w, d, h] = c.size;
  return {
    mitte: () => new THREE.Vector3(c.x, 0, c.z),
    punkt: () =>
      new THREE.Vector3(
        c.x + (Math.random() - 0.5) * Math.max(0.2, w - 1.8),
        0,
        c.z + (Math.random() - 0.5) * Math.max(0.2, d - 1.8)
      ),
    enthaelt: (b) => {
      const t = b.translation();
      return Math.abs(t.x - c.x) < w / 2 && Math.abs(t.z - c.z) < d / 2 && t.y < Math.max(h, 2) + 1;
    },
    ueber: Math.min(h, 2.2) + 0.6,
  };
}

type Wagen = NonNullable<VehicleManager["schichtVerlader"]>;

function wagenAblage(v: Wagen): Ablage {
  const bed = (v as unknown as { bedGroup: THREE.Group }).bedGroup;
  const absetz = v.kind === "absetzer";
  const halbB = absetz ? ABSETZMULDE.breite / 2 - 0.45 : 1.0;
  const lang = absetz ? ABSETZMULDE.laenge : 5.4;
  return {
    mitte: () => bed.localToWorld(new THREE.Vector3(0, 0, lang / 2)),
    punkt: () =>
      bed.localToWorld(new THREE.Vector3((Math.random() - 0.5) * 2 * halbB, 0.2, 0.8 + Math.random() * (lang - 1.6))),
    enthaelt: (b) => v.liegtAuf(b),
    ueber: absetz ? 2.2 : 2.9,
  };
}

/** Ein Teil auf eine Ablage legen — von oben, ohne in etwas hineinzusetzen. */
function lege(p: SchichtPlatz, it: ScrapItem, ziel: Ablage): void {
  const von = it.body.translation();
  const pt = ziel.punkt();
  let oben = 0;
  for (const x of p.items.items) {
    if (x === it || !x.body.isValid()) continue;
    const t = x.body.translation();
    if (Math.hypot(t.x - pt.x, t.z - pt.z) < 1.6 && ziel.enthaelt(x.body)) oben = Math.max(oben, t.y);
  }
  const y = Math.max(ziel.ueber, oben + 1.1);
  it.body.setTranslation({ x: pt.x, y, z: pt.z }, true);
  it.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  it.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  // Was auf ihm lag, merkt den Griff — sonst hinge es schlafend in der Luft (E-158)
  for (const x of p.items.items) {
    if (!x.body.isValid() || !x.body.isDynamic()) continue;
    const t = x.body.translation();
    if (Math.hypot(t.x - von.x, t.z - von.z) < 2.5) x.body.wakeUp();
  }
}

export interface FahrerOptionen {
  /** Sekunden je Griff; 0 = niemand räumt. */
  griffS: number;
  /** So lange dauert die Fahrt zum Lager und zurück, je Richtung (s). SW: 20 s. */
  lagerFahrtS?: number;
}

/** Der Test-Fahrer. `schritt(dt)` einmal je Takt nach `platz.takt()`. */
export class TestFahrer {
  private uhr = 0;
  private modus: "annahme" | "hin" | "lager" | "zurueck" = "annahme";
  private fahrt = 0;
  griffe = 0;
  private readonly boxen: Record<BoxOrder, ContainerConfig>;

  constructor(
    private readonly p: SchichtPlatz,
    private readonly o: FahrerOptionen
  ) {
    this.boxen = { steel: boxFuer("steel"), copper: boxFuer("copper"), rubble: boxFuer("rubble") };
  }

  /** Liegt es auf der Annahme (Haufen, Ladefläche des Anlieferers, abgesetzte Mulde)? */
  private aufAnnahme(it: ScrapItem): boolean {
    if (!it.body.isValid() || !it.body.isDynamic() || it.containerId) return false;
    const t = it.body.translation();
    const nah =
      Math.hypot(t.x - ABKIPP_ZONE[0], t.z - ABKIPP_ZONE[1]) < 7 ||
      Math.hypot(t.x - ABLADE_SPUR_X, t.z - ABLADE_HALT_Z) < 6;
    if (!nah) return false;
    const vl = this.p.vehicles.schichtVerlader;
    return !(vl && vl.liegtAuf(it.body));
  }

  /** Wohin gehört dieses Teil? Eine Box, sonst Misch (null). */
  private boxFuer(it: ScrapItem): BoxOrder | null {
    for (const o of BOX_ORDERS) if (gehoertHierhin(this.boxen[o], it.materialId)) return o;
    return null;
  }

  /** Das oberste Teil einer Auswahl — man greift von oben. */
  private oberstes(teile: ScrapItem[]): ScrapItem | null {
    let best: ScrapItem | null = null;
    for (const it of teile) if (!best || it.body.translation().y > best.body.translation().y) best = it;
    return best;
  }

  schritt(dt: number): void {
    if (this.o.griffS <= 0) return;
    const v = this.p.vehicles;
    const silo = v.schichtSiloWagen;
    const lagerPlatz = silo?.festerPlatz ?? null;
    // Fahrten zum Lager und zurück: in der Zeit wird nichts gegriffen
    if (this.modus === "hin" || this.modus === "zurueck") {
      this.fahrt -= dt;
      if (this.fahrt > 0) return;
      if (this.modus === "hin" && lagerPlatz) {
        this.p.bagger.set(lagerPlatz.stand.x, 0, lagerPlatz.stand.z);
        this.modus = "lager";
      } else {
        this.p.bagger.set(BAGGER_STAND.x, 0, BAGGER_STAND.z);
        this.modus = "annahme";
      }
      return;
    }
    if (this.modus === "annahme" && silo?.phaseName === "waitUnload") {
      this.modus = "hin";
      this.fahrt = this.o.lagerFahrtS ?? 20;
      return;
    }
    if (this.modus === "lager" && (!silo || silo.phaseName !== "waitUnload")) {
      this.modus = "zurueck";
      this.fahrt = this.o.lagerFahrtS ?? 20;
      return;
    }
    this.uhr += dt;
    if (this.uhr < this.o.griffS) return;
    this.uhr -= this.o.griffS;

    if (this.modus === "lager" && silo && lagerPlatz?.ziel) {
      const it = this.oberstes(this.p.items.items.filter((x) => x.body.isValid() && x.body.isDynamic() && silo.liegtAuf(x.body)));
      if (it) {
        lege(this.p, it, boxAblage(lagerPlatz.ziel));
        this.griffe++;
      }
      return;
    }
    const vl = v.schichtVerlader;
    const bereit = vl && vl.waitingForLoad ? vl : null;
    // Ein Box-Abholer vorn: aus seiner Box laden, leer → hupen
    if (bereit && bereit.bestellung && bereit.bestellung !== "mixed") {
      const box = this.boxen[bereit.bestellung as BoxOrder];
      if (box) {
        const ablage = boxAblage(box);
        const it = this.oberstes(this.p.items.items.filter((x) => x.body.isValid() && x.body.isDynamic() && ablage.enthaelt(x.body) && !bereit.liegtAuf(x.body)));
        if (it) {
          lege(this.p, it, wagenAblage(bereit));
          this.griffe++;
          return;
        }
        v.requestPickup(); // Box leer: hupen (ab 1 kg, E-191)
      }
    }
    // Von der Annahme: Box-Teile immer, Misch nur, wenn ein Misch-Verlader bereitsteht
    const misch = bereit && (bereit.bestellung === "mixed" || !bereit.bestellung) ? bereit : null;
    const kandidaten = this.p.items.items.filter((x) => this.aufAnnahme(x) && (this.boxFuer(x) !== null || misch));
    const it = this.oberstes(kandidaten);
    if (!it) return;
    const box = this.boxFuer(it);
    lege(this.p, it, box ? boxAblage(this.boxen[box]) : wagenAblage(misch!));
    this.griffe++;
  }
}

/** Alle Lagersilos — für Wächter, die die sortenreinen Sorten gegen die Silos halten. */
export function lagerSorten(): string[] {
  return CONFIGS.filter((c) => c.lager === true).map((c) => c.fractionId);
}
