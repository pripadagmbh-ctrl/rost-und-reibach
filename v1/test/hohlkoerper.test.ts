/**
 * Waechter fuer den Hohlkoerper (E-124) und das Knautschen (E-128).
 *
 * Patrick, 06.10.2026: „Autos müssen hole elemente werden, die man zerdrücken
 * kann." Darauf wurde das Wrack der Fassung C ein Verbund aus acht Quadern
 * (`FORM_C.bleche`), und ein Biss drueckte EIN Blech ein (E-124).
 *
 * Patrick, 16.10.2026, zum zweiten Mal: „autos müssen holkörper werden" —
 * gewaehlt: „Wie eine Blechdose knautschen — beim Zudrücken faltet und knickt
 * das ganze Auto zusammen, Dach und Flanken klappen ein, statt dass nur
 * einzelne Bleche eindellen." Seitdem (E-128) gibt es kein Eindruecken je
 * Blech mehr, sondern EINE Knautschrechnung (`knautschPunkt`), gesteuert von
 * einem Knautschfeld ueber dem Grundriss. Ein Biss knautscht vom Herd aus das
 * ganze Auto, die Presse dasselbe ueberall bis flach.
 *
 * Gemessen am echten Bagger mit `tools/wrackdruck.ts`, ohne Bagger mit
 * `tools/knautschreihe.ts`. Hier steht, was ohne Bagger pruefbar ist.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager, CarComposite } from "../src/dismantle/composites";
import { CAR_DEF } from "../src/dismantle/carDef";
import { FORM_C, knautschHoehe, knautschWeg } from "../src/dismantle/wrackformen";
import { EventBus } from "../src/core/events";

/** Voller Biss auf ein Autowrack (E-112) — derselbe Wert wie in `greiferschaden`. */
const KRAFT_WRACK = 15.7;
const K = FORM_C.knautsch!;

function werkbank(form: "c" | "bestand" = "c"): {
  world: RAPIER.World;
  bus: EventBus;
  comps: CompositeManager;
  car: CarComposite;
} {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  );
  const items = new ItemManager(scene, world);
  const bus = new EventBus();
  const comps = new CompositeManager(scene, world, items, bus);
  const car = new CarComposite(CAR_DEF, scene, world, items, bus, new THREE.Vector3(0, 0.02, 0), form);
  comps.cars.push(car);
  return { world, bus, comps, car };
}

/**
 * Eine Attrappe der Spinne: ein kinematischer Koerper mit EINER Kapsel, die
 * von oben auf dem Wrack aufliegt — so meldet Rapier sie auch im Spiel (die
 * Schalen sind Kapseln am `grappleBody`). Das Gelenk steht 3 m ueber dem Boden,
 * die Achse zeigt senkrecht nach unten.
 */
function spinneAuf(world: RAPIER.World, x: number, z: number, oberkante: number): void {
  const b = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, 3, z));
  // Kapsel um 4 cm ins Blech: Rapier fuehrt dann einen Kontakt
  world.createCollider(RAPIER.ColliderDesc.capsule(0.1, 0.09).setTranslation(0, oberkante - 3 + 0.05, 0), b);
}

/** Der Biss, wie der Bagger ihn heute meldet: am URSPRUNG des Koerpers (E-112). */
function biss(bus: EventBus, car: CarComposite, kraftKN = KRAFT_WRACK): void {
  const p = car.body.translation();
  bus.emit("greifer:zugedrueckt", { handle: car.body.handle, kraftKN, x: p.x, y: p.y, z: p.z });
}

/** Die Netze, die knautschen: Karosserie (beult), Scheiben und Anbauteile. */
function knautschNetze(car: CarComposite): { mesh: THREE.Mesh; beult: boolean }[] {
  return (car as unknown as { dentables: { mesh: THREE.Mesh; beult: boolean }[] }).dentables;
}
function karosse(car: CarComposite): THREE.Mesh {
  return knautschNetze(car).find((d) => d.beult)!.mesh;
}

/** Wo liegt die Haut ueber diesem Punkt des Grundrisses? Strahl von oben, Wrack-lokal. */
const strahl = new THREE.Raycaster();
const pruefstoff = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
function hautBei(car: CarComposite, x: number, z: number): number {
  /*
   * ANGEPASST MIT E-185 (20.10.2026): Die Motorhaube ist aus der Haut
   * geschnitten und ein eigenes Netz (Zerstörungskonzept B3) — geschlossen
   * gehört sie zur Haut. Gefragt werden deshalb alle Bleche, die beulen
   * (Karosserie und Haube), in ihrer Lage; die oberste Fläche zählt.
   */
  strahl.set(new THREE.Vector3(x, 5, z), new THREE.Vector3(0, -1, 0));
  let oben = -Infinity;
  for (const d of knautschNetze(car).filter((n) => n.beult)) {
    d.mesh.geometry.computeBoundingSphere();
    const m = new THREE.Mesh(d.mesh.geometry, pruefstoff);
    m.position.copy(d.mesh.position);
    m.quaternion.copy(d.mesh.quaternion);
    m.updateMatrixWorld(true);
    const t = strahl.intersectObject(m, false);
    if (t.length) oben = Math.max(oben, t[0]!.point.y);
  }
  return oben;
}

/** Oberkante eines Kolliders, Wrack-lokal (nach einem Physikschritt; das Wrack steht ungedreht). */
function kolliderOben(world: RAPIER.World, car: CarComposite, i: number): number {
  world.step();
  const c = car.body.collider(i);
  return c.translation().y - car.body.translation().y + c.halfExtents().y;
}

/** Hoehe eines Rings (Ebene e, rechts) im Querschnitt s, dazu seine Breite. */
function ring(car: CarComposite, s: number, e: number): { x: number; y: number } {
  const a = karosse(car).geometry.getAttribute("position") as THREE.BufferAttribute;
  const i = s * 2 * FORM_C.ebenen.length + e;
  return { x: a.getX(i), y: a.getY(i) };
}
const SCHNITT = (name: string): number => FORM_C.schnitte.findIndex((s) => s.name === name);

beforeAll(async () => {
  await RAPIER.init();
});

describe("Hohlkoerper (E-124)", () => {
  it("Fassung C ist ein Verbund aus acht Quadern, der Bestand bleibt EIN Quader", () => {
    expect(werkbank("c").car.kolliderZahl).toBe(FORM_C.bleche!.length);
    expect(FORM_C.bleche!.length).toBe(8);
    expect(werkbank("bestand").car.kolliderZahl).toBe(1);
    // Kollider 0 ist der Boden und traegt die Masse. Der Bagger fragt seit
    // E-127 in `krallenKontakte` alle Kollider, nicht mehr nur ihn.
    expect(FORM_C.bleche![0]!.name).toBe("Boden");
  });

  it("die Masse ist die des alten Quaders — Werfen und Fallen bleiben, wie sie waren", () => {
    const { world, car } = werkbank("c");
    // Vergleich: genau so, wie das Wrack vor E-124 gebaut wurde
    const alt = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(10, 0.02, 0));
    const [hx, hy, hz] = CAR_DEF.colliderHalf;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(0, CAR_DEF.colliderYOffset, 0).setMass(CAR_DEF.totalMassKg),
      alt
    );
    world.step();
    expect(car.body.mass()).toBeCloseTo(alt.mass(), 3);
    expect(car.body.localCom().y).toBeCloseTo(alt.localCom().y, 4);
    const a = alt.principalInertia();
    const n = car.body.principalInertia();
    expect(n.x).toBeCloseTo(a.x, 1);
    expect(n.y).toBeCloseTo(a.y, 1);
    expect(n.z).toBeCloseTo(a.z, 1);
    // und nach dem Herausreissen des Motors um genau dessen Masse leichter.
    // ANGEPASST MIT E-185: Motor und Getriebe sind EIN Block (Patrick
    // 20.10.2026, Frage 1 B) — die Masse kommt aus dem Datensatz, nicht 150.
    car.tearPart("engine");
    world.step();
    const motor = CAR_DEF.parts.find((p) => p.id === "engine")!.massKg;
    expect(motor).toBe(220);
    expect(car.body.mass()).toBeCloseTo(CAR_DEF.totalMassKg - motor, 3);
  });

  it("die Bodenwanne endet am Schweller (0,32 m), und alles Uebrige steht lueckenlos darauf (E-127)", () => {
    const [boden, ...rest] = FORM_C.bleche!;
    const oben = boden!.mitte[1] + boden!.halb[1];
    // Ebene 1 der Fassung C ist die Schwellerkante
    expect(oben).toBeCloseTo(FORM_C.ebenen[1]!, 9);
    for (const b of rest) {
      if (b.name === "Dach") continue; // liegt auf dem Glashaus, nicht auf dem Boden
      expect(b.mitte[1] - b.halb[1], `${b.name} steht auf dem Boden, ohne Spalt`).toBeCloseTo(oben, 9);
    }
  });
});

describe("Die Knautschrechnung (E-128)", () => {
  it("die Zonen liegen lueckenlos uebereinander, jeder Knick auf einem Ring der Haut", () => {
    for (let i = 1; i < K.zonen.length; i++) expect(K.zonen[i]!.von).toBeCloseTo(K.zonen[i - 1]!.bis, 9);
    // Ueber dem Boden beginnt das Knautschen, darunter ist alles starr
    expect(K.zonen[0]!.von).toBeCloseTo(FORM_C.bleche![0]!.mitte[1] + FORM_C.bleche![0]!.halb[1], 9);
    for (const z of K.zonen) {
      expect(FORM_C.ebenen, `${z.name}: kein Ring am Knick ${z.knick} — dort kann nichts falten`).toContain(z.knick);
      expect(z.knick).toBeGreaterThan(z.von);
      expect(z.knick).toBeLessThan(z.bis);
    }
  });

  it("die Hoehe bleibt monoton: keine Ebene rutscht durch eine andere, bei keinem Knautschgrad", () => {
    for (let h = 0; h <= 1.0001; h += 0.05) {
      let vorher = -Infinity;
      for (let y = 0; y <= 1.5; y += 0.01) {
        const neu = knautschHoehe(K, y, h);
        expect(neu, `h ${h.toFixed(2)}, y ${y.toFixed(2)}`).toBeGreaterThanOrEqual(vorher - 1e-12);
        vorher = neu;
      }
      // der Boden ist starr
      expect(knautschHoehe(K, 0.32, h)).toBeCloseTo(0.32, 12);
    }
    // ganz flach: Boden und Schweller plus drei Lagen Blech
    expect(knautschHoehe(K, 1.42, 1)).toBeCloseTo(0.62, 9);
    expect(knautschWeg(K)).toBeCloseTo(0.8, 9);
  });

  it("der Druck beginnt, wo die Spinne zielt: Dach, Kofferraum, Haube, rechte Tuer", () => {
    const faelle: Array<[string, number, number, number]> = [
      // Stelle, x, z der Spinne, Oberkante darunter (aus FORM_C.bleche)
      ["Dach", 0, -0.05, 1.42],
      ["Heck", 0, -1.5, 0.97],
      ["Vorderwagen", 0, 1.6, 0.86],
      ["Tür vorn rechts", 0.77, 0.34, 0.92],
    ];
    for (const [name, x, z, oben] of faelle) {
      const { world, bus, comps, car } = werkbank("c");
      for (let i = 0; i < 30; i++) world.step();
      spinneAuf(world, x, z, oben);
      car.body.wakeUp();
      world.step();
      comps.update();
      biss(bus, car);
      const hier = car.knautschBei(x, z);
      // Unter der Spinne (fast) voll: ein voller Biss sind 0,2 m von 0,80 m Weg = 0,25;
      // zwischen zwei Rasterpunkten gemischt etwas weniger
      expect(hier, `unter der Spinne ueber ${name}`).toBeGreaterThan(0.23);
      expect(hier).toBeLessThanOrEqual(0.25 + 1e-6);
      for (const [anderer, ax, az] of faelle) {
        if (anderer === name) continue;
        expect(car.knautschBei(ax, az), `${anderer} weniger als ${name}`).toBeLessThan(hier);
      }
      expect(car.crushStage, `ein Biss auf ${name} quetscht nicht das ganze Auto flach`).toBe(0);
    }
  });

  it("ohne Spinne in der Naehe und mit dem Koerperursprung als Ort wird von oben gedrueckt (E-114): auf die Dachmitte", () => {
    const { bus, car } = werkbank("c");
    biss(bus, car);
    expect(car.knautschBei(0, 0)).toBeCloseTo(0.25, 6);
    expect(car.knautschBei(0, 1.9)).toBeLessThan(0.2);
    expect(car.knautschBei(0, -1.9)).toBeLessThan(0.2);
  });

  it("aber der Druck bleibt nicht unter dem Stiefel: auch das andere Ende des Autos gibt etwas nach", () => {
    const { bus, car } = werkbank("c");
    biss(bus, car);
    expect(car.knautschBei(0, 1.9), "die Haube").toBeGreaterThan(0);
    expect(car.knautschBei(-0.85, -1.9), "das Heck links").toBeGreaterThan(0);
  });

  it("schrittweise: jeder volle Biss knautscht weiter, die Stufe steigt nie um zwei, und flach ist flach", () => {
    const { bus, car } = werkbank("c");
    let grad = car.knautschgrad;
    let dach = hautBei(car, 0, -0.05);
    let stufe = car.crushStage;
    let bisse = 0;
    while (car.crushStage < 2) {
      biss(bus, car);
      bisse++;
      expect(car.knautschgrad, `Biss ${bisse}: kein Fortschritt`).toBeGreaterThan(grad);
      expect(car.crushStage - stufe, `Biss ${bisse}: zwei Stufen auf einmal`).toBeLessThanOrEqual(1);
      expect(hautBei(car, 0, -0.05), `Biss ${bisse}: das Dach kommt nicht tiefer`).toBeLessThan(dach + 1e-6);
      grad = car.knautschgrad;
      dach = hautBei(car, 0, -0.05);
      stufe = car.crushStage;
      expect(bisse, "flach nach endlich vielen Bissen").toBeLessThan(10);
    }
    /*
     * Gemessen 16.10.2026 (`tools/knautschreihe.ts`): sechs volle Bisse aufs
     * Dach bis flach — vier, bis das Dach unten ist, zwei weitere fuer den
     * Rest. Vorher (E-124) waren es fuenf: drei fuers Dach, zwei Stufen.
     */
    expect(bisse).toBe(6);
    expect(car.knautschgrad).toBe(1);
    const flach = new Float32Array(karosse(car).geometry.getAttribute("position").array as Float32Array);
    biss(bus, car);
    const danach = karosse(car).geometry.getAttribute("position").array as Float32Array;
    expect(Array.from(danach), "flach ist flach: ein weiterer Biss aendert nichts").toEqual(Array.from(flach));
  });

  it("Spinne und Presse benutzen DIESELBE Verformung: flach gebissen ist Eckpunkt fuer Eckpunkt flach gepresst", () => {
    const gebissen = werkbank("c");
    while (gebissen.car.crushStage < 2) biss(gebissen.bus, gebissen.car);
    const gepresst = werkbank("c").car;
    gepresst.pressCrush();
    const a = knautschNetze(gebissen.car);
    const b = knautschNetze(gepresst);
    expect(a.length).toBe(b.length);
    let verglichen = 0;
    for (let n = 0; n < a.length; n++) {
      const pa = a[n]!.mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
      const pb = b[n]!.mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < pa.array.length; i++) expect(pa.array[i]).toBeCloseTo(pb.array[i]!, 5);
      verglichen += pa.count;
    }
    expect(verglichen, "Karosserie, vier Scheiben, Anbauteile").toBeGreaterThan(500);
    // und die Kollider sind dieselben
    for (let i = 0; i < gebissen.car.kolliderZahl; i++) {
      expect(gebissen.car.body.collider(i).halfExtents().y).toBeCloseTo(gepresst.body.collider(i).halfExtents().y, 6);
    }
  });

  it("die Kollider folgen der Haut: halb geknautscht ist das Wrack fuer die Physik halb so hoch", () => {
    /*
     * In E-124 standen die Schalen 32 cm im Dach, weil Kollider und Haut
     * verschiedene Hoehen hatten. Hier: ueber Dach, Haube und Kofferraum die
     * Haut gegen die Oberkante des Kolliders darunter, an 15 Stellen je Blech;
     * an den Tueren die Guertellinie (darueber ist Glas, und dort ist
     * absichtlich kein Kollider). Gemessen 16.10.2026: hoechstens 8 cm
     * Abstand, meist 0–6 (`tools/knautschreihe.ts`).
     */
    const zustaende: Array<[string, (w: ReturnType<typeof werkbank>) => void]> = [
      ["heil", () => {}],
      ["ein Biss", (w) => biss(w.bus, w.car)],
      ["drei Bisse", (w) => { for (let i = 0; i < 3; i++) biss(w.bus, w.car); }],
      ["halb", (w) => w.car.zusammendruecken(0.5)],
      ["Presse", (w) => w.car.pressCrush()],
    ];
    for (const [name, mach] of zustaende) {
      const w = werkbank("c");
      mach(w);
      FORM_C.bleche!.forEach((b, i) => {
        if (i === 0) return;
        const oben = kolliderOben(w.world, w.car, i);
        if (b.name.startsWith("Tür")) {
          const s = SCHNITT("B-Säule");
          const g = ring(w.car, s, 5).y; // die Guertellinie rechts
          expect(Math.abs(g - oben), `${name}: ${b.name}`).toBeLessThan(0.03);
          return;
        }
        for (const fx of [-0.8, 0, 0.8]) {
          for (const fz of [-0.8, -0.4, 0, 0.4, 0.8]) {
            const haut = hautBei(w.car, b.mitte[0] + fx * b.halb[0], b.mitte[2] + fz * b.halb[2]);
            expect(Math.abs(haut - oben), `${name}: ${b.name} bei ${fx}/${fz}`).toBeLessThan(0.1);
          }
        }
      });
    }
    // halb so hoch, auch fuer die Physik
    const halb = werkbank("c");
    halb.car.zusammendruecken(0.5);
    const dach = FORM_C.bleche!.findIndex((b) => b.name === "Dach");
    expect(kolliderOben(halb.world, halb.car, dach)).toBeLessThan(1.42 - 0.4);
  });

  it("die Haut faltet wie eine Dose: Saeule heraus, Tuer hinein — und die Guertellinie haelt beim ersten Biss", () => {
    const heil = werkbank("c").car;
    const s = SCHNITT("B-Säule");
    const { bus, car } = werkbank("c");
    biss(bus, car);
    expect(Math.abs(ring(car, s, 5).y - ring(heil, s, 5).y), "die Guertellinie bleibt beim ersten Biss").toBeLessThan(0.01);
    biss(bus, car);
    expect(ring(car, s, 6).x - ring(heil, s, 6).x, "die Saeule knickt heraus").toBeGreaterThan(0.05);
    biss(bus, car);
    biss(bus, car);
    expect(ring(heil, s, 4).x - ring(car, s, 4).x, "die Tuer knickt hinein").toBeGreaterThan(0.03);
    // Das Dach liegt in der Mitte tiefer als an der Kante: der Abdruck
    const mitte = ring(car, s, 8).y;
    const kante = ring(car, s, 7).y;
    expect(mitte, "das Dach ist eingedellt, nicht nur gesenkt").toBeLessThan(kante + 0.12 - 0.02);
  });

  it("ein Biss von der Seite knautscht diese Seite zuerst: das Auto sackt nach rechts", () => {
    const { world, bus, comps, car } = werkbank("c");
    for (let i = 0; i < 30; i++) world.step();
    spinneAuf(world, 0.77, 0.34, 0.92);
    car.body.wakeUp();
    world.step();
    comps.update();
    biss(bus, car);
    biss(bus, car);
    expect(car.knautschBei(0.85, 0.34)).toBeGreaterThan(car.knautschBei(-0.85, 0.34));
    const s = SCHNITT("Dach vorn");
    const links = ring(car, s, 2 * FORM_C.ebenen.length - 1 - 7).y;
    expect(ring(car, s, 7).y, "die rechte Dachkante liegt tiefer").toBeLessThan(links);
  });

  it("Knautschen kostet keine Masse (E-114): nur herausgerissene Teile machen das Wrack leichter", () => {
    const { bus, car } = werkbank("c");
    const vorher = car.massKg;
    /*
     * 10 kN = 4,46 m/s: ueber der Beulschwelle, unter der Quetschschwelle.
     * Ein VOLLER Biss ueber dem Dach reisst das Getriebe heraus (E-114, rohe
     * Gewalt als Sortierung) — das ist gewollt und steht in `greiferschaden`.
     */
    for (let i = 0; i < 3; i++) biss(bus, car, 10);
    expect(car.knautschgrad).toBeGreaterThan(0);
    expect(car.massKg).toBe(vorher);
    car.pressCrush();
    expect(car.massKg, "auch die Presse nimmt nichts weg — Raeder fallen heraus und liegen daneben").toBe(
      CAR_DEF.totalMassKg - CAR_DEF.parts.filter((p) => p.kind === "wheel").slice(0, 2).reduce((s, p) => s + p.massKg, 0)
    );
  });

  it("der Spielstand stellt die Stufe als gleichmaessigen Knautschgrad wieder her", () => {
    const eins = werkbank("c").car;
    eins.restoreState({ crushStage: 1, torn: [], brokenWindows: [] });
    expect(eins.knautschgrad).toBeCloseTo(0.5, 6);
    const zwei = werkbank("c").car;
    zwei.restoreState({ crushStage: 2, torn: [], brokenWindows: [] });
    expect(zwei.knautschgrad).toBe(1);
    expect(hautBei(zwei, 0, -0.05)).toBeLessThan(0.7);
  });
});
