/**
 * Wächter für E-135 — der volle Start, das LKW-Wrack und der Wohnwagen.
 *
 * Patrick, 17.10.2026: „am anfang sollen auch mehr schrott schon da sein, die
 * zwei autos, ein lkw wrack und ab und zu bringt jmd auch nen wohnwagen zum
 * verschrotten".
 *
 * Geprüft wird, was sich kopflos prüfen lässt: Daten (Masse, Netze), dass
 * beide in derselben Bauweise wie Fassung C knautschen (E-128) und der Ton
 * mithört (E-130), dass Kaputtmachen keinen Wert kostet (E-114), wo der Lkw
 * steht, wie oft der Wohnwagen kommt — und dass er auf dem Abschlepper heil
 * am Abladeplatz ankommt.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager, type CarComposite, type WrackArt } from "../src/dismantle/composites";
import { LKW_DEF, WOHNWAGEN_DEF, WRACKDATEN } from "../src/dismantle/carDef";
import { FORM_LKW, FORM_WOHNWAGEN, knautschHoehe } from "../src/dismantle/wrackformen";
import { EventBus } from "../src/core/events";
import { START_AUTOS, START_HAUFEN, START_LKW, LEERER_START } from "../src/world/startplatz";
import { CONFIGS } from "../src/world/containers";
import { alleHindernisse } from "../src/world/obstacles";
import { YARD_MAX_X, YARD_MIN_X } from "../src/world/yard";
import {
  ROUTE_IN_FWD,
  PARK_SLOTS,
  routeApproach,
  routeInRev,
  routeOut,
  pickupApproach,
  pickupInRev,
  pickupOut,
  routeToPark,
  routeParkRueck,
  bayApproach,
  bayInRev,
  bayOut,
} from "../src/delivery/routes";
import {
  EINZELSTUECK_ANTEIL,
  WOHNWAGEN_ANTEIL,
  rollAnlieferung,
  rollWohnwagen,
} from "../src/delivery/customers";
import { VehicleManager } from "../src/delivery/vehicles";
import { NACHSCHUB_FOLGE } from "../src/delivery/nachschub";

beforeAll(async () => {
  await initPhysics();
});

/** Fester Zufall — eine Messung ohne Saat ist keine. */
function mitSaat<T>(saat: number, f: () => T): T {
  const echt = Math.random;
  let z = saat >>> 0;
  Math.random = () => {
    z = (z * 1664525 + 1013904223) >>> 0;
    return z / 4294967296;
  };
  try {
    return f();
  } finally {
    Math.random = echt;
  }
}

function wrack(art: WrackArt): { car: CarComposite; bus: EventBus; world: RAPIER.World } {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const bus = new EventBus();
  const comps = new CompositeManager(scene, world, new ItemManager(scene, world), bus);
  return { car: comps.spawnCar(new THREE.Vector3(0, 0.02, 0), art), bus, world };
}

function netze(car: CarComposite): number {
  let n = 0;
  car.group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) n++;
  });
  return n;
}

/** Höchster Punkt der Karosseriehaut, Wrack-lokal. */
function hautOben(car: CarComposite): number {
  const d = (car as unknown as { dentables: Array<{ mesh: THREE.Mesh; beult: boolean }> }).dentables.find((x) => x.beult)!;
  d.mesh.geometry.computeBoundingBox();
  return d.mesh.geometry.boundingBox!.max.y;
}

/**
 * Höchste Kolliderkante, Wrack-lokal (der Körper steht ungedreht). Rapier
 * meldet die Lage eines Kolliders erst nach einem Schritt, und die Maße nur
 * über `halfExtents()` frisch — `shape` liefert die vom Anlegen.
 */
function kolliderOben(car: CarComposite, world: RAPIER.World): number {
  world.step();
  let oben = -Infinity;
  const p = car.body.translation();
  for (let i = 0; i < car.body.numColliders(); i++) {
    const c = car.body.collider(i);
    const t = c.translation();
    const h = c.halfExtents();
    oben = Math.max(oben, t.y - p.y + h.y);
  }
  return oben;
}

describe("Große Wracks: Daten", () => {
  it("Masse = Rumpf + Teile, beim Lkw 7 t, beim Wohnwagen 820 kg", () => {
    for (const def of [LKW_DEF, WOHNWAGEN_DEF]) {
      const teile = def.parts.reduce((s, p) => s + p.massKg, 0);
      expect(def.hullMassKg + teile).toBe(def.totalMassKg);
    }
    expect(LKW_DEF.totalMassKg).toBe(7000);
    expect(WOHNWAGEN_DEF.totalMassKg).toBe(820);
  });

  it("jedes höchstens so viele Netze wie ein Auto (13, E-025/E-111)", () => {
    expect(netze(wrack("lkw").car)).toBeLessThanOrEqual(13);
    expect(netze(wrack("wohnwagen").car)).toBeLessThanOrEqual(13);
  });

  it("der Pkw ist Ziffer für Ziffer derselbe: Knautschfeld 3 x 17 im Abstand 0,25 m", () => {
    const { car } = wrack("pkw");
    const f = car as unknown as { feldX: number[]; feldNz: number; feldDz: number; halbL: number };
    expect(f.feldX).toEqual([-0.85, 0, 0.85]);
    expect(f.feldNz).toBe(17);
    expect(f.feldDz).toBeCloseTo(0.25, 12);
    expect(f.halbL).toBe(2);
    expect(car.art).toBe("pkw");
  });

  it("jede Art baut aus ihrem eigenen Datensatz (die Registry ist vollständig)", () => {
    for (const art of Object.keys(WRACKDATEN) as WrackArt[]) {
      const { car } = wrack(art);
      expect(car.art).toBe(art);
      expect(car.massKg).toBe(WRACKDATEN[art].totalMassKg);
    }
  });
});

describe("Große Wracks: knautschen wie Fassung C", () => {
  it.each([
    ["lkw", FORM_LKW],
    ["wohnwagen", FORM_WOHNWAGEN],
  ] as const)("%s: Presse = überall flach, Haut und Kollider auf der flachen Höhe", (art, form) => {
    const { car, world } = wrack(art);
    const flach = knautschHoehe(form.knautsch!, Math.max(...form.ebenen), 1);
    expect(hautOben(car)).toBeGreaterThan(flach + 0.5);
    car.pressCrush();
    expect(car.knautschgrad).toBe(1);
    expect(car.crushStage).toBe(2);
    // Haut: bis Knüllen und Deckelwelle (je wenige cm) über der flachen Höhe
    expect(hautOben(car)).toBeLessThan(flach + 0.15);
    // Kollider: höchstens 10 cm daneben (E-128)
    expect(Math.abs(kolliderOben(car, world) - flach)).toBeLessThan(0.15);
  });

  it("Lkw: Rahmen und Kabinenboden bleiben starr (unter 1,35 m knautscht nichts)", () => {
    expect(FORM_LKW.knautsch!.zonen[0]!.von).toBe(1.35);
    expect(knautschHoehe(FORM_LKW.knautsch!, 1.05, 1)).toBe(1.05);
  });

  it("der Ton hört mit: jeder Biss, der nachgibt, meldet wrack:geknautscht (E-130)", () => {
    for (const art of ["lkw", "wohnwagen"] as const) {
      const { car, bus } = wrack(art);
      const meldungen: number[] = [];
      bus.on("wrack:geknautscht", (e) => {
        if (e.handle === car.body.handle) meldungen.push(e.zuwachs);
      });
      const p = car.body.translation();
      car.beissen(15.7, new THREE.Vector3(p.x, p.y + 2.5, p.z + (art === "lkw" ? 1.85 : 0)));
      expect(meldungen.length, art).toBe(1);
      expect(meldungen[0]!, art).toBeGreaterThan(0);
    }
  });

  it("der Wohnwagen gibt je Biss mehr nach als das Auto (wegFaktor), der Lkw weniger", () => {
    const grad = (art: WrackArt, z: number): number => {
      const { car } = wrack(art);
      const p = car.body.translation();
      car.beissen(15.7, new THREE.Vector3(p.x, p.y + 2.5, p.z + z));
      return car.knautschgrad;
    };
    const pkw = grad("pkw", -0.05);
    expect(grad("wohnwagen", 0.2)).toBeGreaterThan(pkw);
    expect(grad("lkw", 1.85)).toBeLessThan(pkw);
  });

  it("Kaputtmachen kostet keinen Wert: Knautschen nimmt keine Masse, Abreißen verschiebt sie (E-114)", () => {
    const { car, world } = wrack("lkw");
    // Die Presse drückt zwei Räder heraus (Stufe 2) — sie leben als eigene Stücke weiter.
    car.pressCrush();
    car.tearPart("engine");
    world.step();
    let draussen = 0;
    world.bodies.forEach((b) => {
      if (b.handle !== car.body.handle && b.isDynamic()) draussen += b.mass();
    });
    expect(car.massKg).toBeLessThan(LKW_DEF.totalMassKg - 1050);
    expect(car.massKg + draussen).toBeCloseTo(LKW_DEF.totalMassKg, 1);
  });
});

/* ---------------------------------------------------------------------- */
/* Der Startplatz                                                           */
/* ---------------------------------------------------------------------- */

/** Grundriss des Lkw-Wracks (Welt), aus Lage, Drehung und Maßen. */
function lkwGrundriss(): { x0: number; x1: number; z0: number; z1: number } {
  const hb = FORM_LKW.breite / 2;
  const hl = FORM_LKW.laenge / 2;
  const quer = Math.abs(Math.sin(START_LKW.gier)) > 0.5;
  const ex = quer ? hl : hb;
  const ez = quer ? hb : hl;
  return { x0: START_LKW.x - ex, x1: START_LKW.x + ex, z0: START_LKW.z - ez, z1: START_LKW.z + ez };
}

function abstandRechteck(r: { x0: number; x1: number; z0: number; z1: number }, x: number, z: number): number {
  const dx = Math.max(r.x0 - x, 0, x - r.x1);
  const dz = Math.max(r.z0 - z, 0, z - r.z1);
  return Math.hypot(dx, dz);
}

describe("Der volle Start (E-135)", () => {
  it("der Versuch vom 15.09. ist beendet: Haufen und Streugut sind zurück", () => {
    expect(LEERER_START).toBe(false);
    expect(START_HAUFEN.teile).toBe(85);
  });

  it("kein Auto steht im Starthaufen, und die Autos stehen nicht ineinander", () => {
    for (const [i, a] of START_AUTOS.entries()) {
      // Auto 1,70 x 4,00 m ungedreht: nächster Punkt des Rechtecks zur Haufenmitte
      const r = { x0: a.x - 0.85, x1: a.x + 0.85, z0: a.z - 2, z1: a.z + 2 };
      expect(abstandRechteck(r, START_HAUFEN.x, START_HAUFEN.z), `Auto ${i}`).toBeGreaterThan(START_HAUFEN.streuung + 0.3);
    }
    const [a, b] = START_AUTOS as [{ x: number; z: number }, { x: number; z: number }];
    expect(Math.abs(a.x - b.x) - 1.7, "Luft zwischen den Autos").toBeGreaterThan(0.8);
  });

  it("das Lkw-Wrack steht im Platz, in keinem Bauwerk und in keiner Mulde", () => {
    const r = lkwGrundriss();
    expect(r.x0).toBeGreaterThan(YARD_MIN_X + 1);
    expect(r.x1, "an der Ostmauer").toBeLessThan(YARD_MAX_X - 1.0);
    for (const o of alleHindernisse()) {
      const frei =
        r.x1 + 0.5 <= o.x - o.hw || r.x0 - 0.5 >= o.x + o.hw || r.z1 + 0.5 <= o.z - o.hd || r.z0 - 0.5 >= o.z + o.hd;
      expect(frei, `Lkw-Wrack in ${o.label}`).toBe(true);
    }
    for (const c of CONFIGS) {
      const frei =
        r.x1 <= c.x - c.size[0] / 2 || r.x0 >= c.x + c.size[0] / 2 || r.z1 <= c.z - c.size[1] / 2 || r.z0 >= c.z + c.size[1] / 2;
      expect(frei, `Lkw-Wrack in ${c.label}`).toBe(true);
    }
  });

  it("das Lkw-Wrack steht weit neben jeder Fahrspur (Spurbreite 2,6 m + 2 m Luft)", () => {
    const r = lkwGrundriss();
    const strecken: Array<[string, Array<[number, number]>]> = [
      ["Einfahrt", ROUTE_IN_FWD],
      ["Zufahrt", routeApproach()],
      ["Abladeplatz", routeInRev()],
      ["Ausfahrt", routeOut()],
      ["Abholerspur", pickupApproach()],
      ["Verladeplatz", pickupInRev()],
      ["Abholer raus", pickupOut()],
      ...PARK_SLOTS.flatMap((s, i): Array<[string, Array<[number, number]>]> => [
        [`Warteplatz ${i}`, routeToPark(routeOut(), s)],
        [`Warteplatz ${i} rückwärts`, routeParkRueck(s)],
      ]),
      ...CONFIGS.filter((c) => c.lager).flatMap((c): Array<[string, Array<[number, number]>]> => [
        [`${c.label} hin`, bayApproach(c)],
        [`${c.label} rein`, bayInRev(c)],
        [`${c.label} raus`, bayOut(c)],
      ]),
    ];
    for (const [name, pkt] of strecken) {
      for (let i = 0; i + 1 < pkt.length; i++) {
        const [ax, az] = pkt[i]!;
        const [bx, bz] = pkt[i + 1]!;
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.25));
        for (let k = 0; k <= n; k++) {
          const x = ax + ((bx - ax) * k) / n;
          const z = az + ((bz - az) * k) / n;
          expect(abstandRechteck(r, x, z), `${name}, Stück ${i}`).toBeGreaterThan(2.6 + 2.0);
        }
      }
    }
  });
});

/* ---------------------------------------------------------------------- */
/* Der Wohnwagen kommt ab und zu                                            */
/* ---------------------------------------------------------------------- */

describe("Wohnwagen: wie oft und wer", () => {
  it("einer je Sandkastenstunde (24 Ankünfte, E-126)", () => {
    expect(WOHNWAGEN_ANTEIL * 24).toBeCloseTo(1, 12);
  });

  it("gewürfelt kommt der Anteil an, und die Einzelstücke bleiben bei 35 % (4 000 Ankünfte)", () => {
    const n = 4000;
    let ww = 0;
    let einzel = 0;
    mitSaat(1351, () => {
      for (let i = 0; i < n; i++) {
        const c = rollAnlieferung();
        if (c.wrackArt === "wohnwagen") ww++;
        if (c.einzelstueck) einzel++;
      }
    });
    expect(ww / n).toBeGreaterThan(WOHNWAGEN_ANTEIL * 0.7);
    expect(ww / n).toBeLessThan(WOHNWAGEN_ANTEIL * 1.3);
    expect(einzel / n).toBeGreaterThan(EINZELSTUECK_ANTEIL - 0.03);
    expect(einzel / n).toBeLessThan(EINZELSTUECK_ANTEIL + 0.03);
  });

  it("ein Privatmann auf dem Abschlepper, die Waage wiegt den Datensatz", () => {
    const c = mitSaat(7, rollWohnwagen);
    expect(c.group).toBe("privat");
    expect(c.vehicle).toBe("wrack");
    expect(c.wrackArt).toBe("wohnwagen");
    expect(c.massKg).toBe(WOHNWAGEN_DEF.totalMassKg);
  });

  it("NACHSCHUB kennt keinen Wohnwagen — der Wohnwagen ist der Zufall, nicht der Knopf", () => {
    // Seit E-141 ist der Absetzkipper die fuenfte Art; der Wohnwagen bleibt draussen.
    expect([...NACHSCHUB_FOLGE]).toEqual(["kipper", "pritsche", "wrack", "einzelstueck", "absetzer"]);
  });
});

describe("Wohnwagen: gefahren bis zum Abladeplatz", () => {
  interface Befund {
    ankunftS: number;
    immerDrauf: boolean;
    lokal: THREE.Vector3;
    dynamisch: boolean;
    kippGrad: number;
    tempo: number;
    art: string;
  }
  let befunde: Befund[] = [];

  function fahre(saat: number): Befund {
    return mitSaat(saat, () => {
      const scene = new THREE.Scene();
      const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
      const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
      world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0), boden);
      const items = new ItemManager(scene, world);
      const comps = new CompositeManager(scene, world, items, new EventBus());
      const m = new VehicleManager(scene, world, items, comps);
      const kunde = rollWohnwagen();
      m.spawnNow(kunde.vehicle, kunde);
      m.acceptDeliveries = false;
      const v = (m as unknown as {
        active: { phase: string; bedGroup: THREE.Group; bedLen: number; cargo: { car: CarComposite | null } };
      }).active;
      const car = v.cargo.car!;
      const lokal = new THREE.Vector3();
      const drauf = (): boolean => {
        const p = car.body.translation();
        lokal.set(p.x, p.y, p.z);
        v.bedGroup.worldToLocal(lokal);
        // Der Kasten (±2,10 m) liegt ganz auf der Fläche (0 … bedLen), quer mittig.
        return Math.abs(lokal.x) < 0.3 && lokal.z - 2.1 > -0.3 && lokal.z + 2.1 < v.bedLen + 0.3 && lokal.y > -0.2;
      };
      const dt = 1 / 60;
      let t = 0;
      let ankunft = Infinity;
      let immerDrauf = true;
      for (let i = 0; i < 60 * 240; i++) {
        m.update(dt);
        items.clampSpeeds(dt);
        world.step();
        comps.update();
        scene.updateMatrixWorld(true);
        t += dt;
        if (ankunft === Infinity && !drauf()) immerDrauf = false;
        if (ankunft === Infinity && v.phase === "waitUnload") ankunft = t;
        if (ankunft !== Infinity && t > ankunft + 8) break;
      }
      drauf();
      const q = car.body.rotation();
      const oben = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
      const lv = car.body.linvel();
      return {
        ankunftS: ankunft,
        immerDrauf,
        lokal: lokal.clone(),
        dynamisch: car.body.isDynamic(),
        kippGrad: (Math.acos(Math.min(1, Math.abs(oben.y))) * 180) / Math.PI,
        tempo: Math.hypot(lv.x, lv.y, lv.z),
        art: car.art,
      };
    });
  }

  beforeAll(() => {
    befunde = [4711, 1351, 99].map(fahre);
  }, 240_000);

  it("er kommt an, liegt die ganze Fahrt auf der Fläche und ist ein Wohnwagen", () => {
    expect(befunde.length).toBe(3);
    if (process.env.BEFUNDE) console.log(befunde);
    for (const b of befunde) {
      expect(b.art).toBe("wohnwagen");
      expect(b.ankunftS).toBeLessThan(150);
      expect(b.immerDrauf).toBe(true);
    }
  });

  it("am Abladeplatz liegt er frei, still und gerade — greifbar für die Spinne", () => {
    for (const b of befunde) {
      expect(b.dynamisch, "nicht freigegeben").toBe(true);
      expect(b.tempo).toBeLessThan(0.05);
      expect(b.kippGrad).toBeLessThan(5);
    }
  });
});
