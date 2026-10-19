/**
 * DIE ZERLEGUNG IN ECHTER REIHENFOLGE (E-185, Zerstörungskonzept 1.0).
 *
 * Patrick, 20.10.2026: „Reifen haben immer felge. Um motor/getriebe zu
 * entfernen, muss erst motorhaube entfernt werden. Autos haben
 * innenausstattung." Seine Antworten: Motor und Getriebe als EIN Block (1 B),
 * Innenraum nur sichtbar (2 A), die leere Karosse bleibt Mischschrott (3 B),
 * die Haube springt beim ersten Biss auf und geht beim zweiten ab (4 A), der
 * Ruck nur am Teil (5 A).
 *
 * Bewacht wird:
 *   1. die Sperre — sie sitzt in `findPartNear` und gilt für Greifen UND Biss;
 *   2. kein Motor und kein Getriebe mehr durch geschlossenes Blech (Dach!);
 *   3. die Haube: auf, dann ab, verbeult, mit Mindestdicke;
 *   4. die Reihenfolge Haube → Batterie/Kühler → Motor mit Getriebe;
 *   5. Räder mit Felge, die rollen und liegen bleiben;
 *   6. der Innenraum: im Anbau-Netz, innen, knautscht mit;
 *   7. das Ereignis `wrack:abriss` für Funken, Staub und Knall;
 *   8. Masse wird nur umverteilt, Netze werden weniger.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager, type CarComposite } from "../src/dismantle/composites";
import { CAR_DEF, FELGE_FARBE, LKW_DEF, WOHNWAGEN_DEF, type WrackArt } from "../src/dismantle/carDef";
import { FORM_C, FORM_LKW, FORM_WOHNWAGEN, halbeBreiteBei } from "../src/dismantle/wrackformen";
import { EventBus, type GameEvents } from "../src/core/events";

/** Ein voller Biss auf ein Autowrack (E-112). */
const VOLL = 15.7;

function werkbank(art: WrackArt = "pkw"): {
  world: RAPIER.World;
  scene: THREE.Scene;
  items: ItemManager;
  bus: EventBus;
  comps: CompositeManager;
  car: CarComposite;
  abriss: GameEvents["wrack:abriss"][];
} {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  );
  const items = new ItemManager(scene, world);
  const bus = new EventBus();
  const abriss: GameEvents["wrack:abriss"][] = [];
  bus.on("wrack:abriss", (e) => abriss.push(e));
  const comps = new CompositeManager(scene, world, items, bus);
  const car = comps.spawnCar(new THREE.Vector3(0, 0, 0), art);
  return { world, scene, items, bus, comps, car, abriss };
}

/** Weltpunkt über einem Teil (das Wrack steht ungedreht im Ursprung). */
function ueber(id: string, hoch = 0): THREE.Vector3 {
  const a = (id === "haube" ? HAUBE_MITTE : CAR_DEF.parts.find((p) => p.id === id)!.anchor) as number[];
  return new THREE.Vector3(a[0]!, a[1]! + hoch, a[2]!);
}
const HAUBE_MITTE = [0, 0.87, 1.33];

function beissen(w: ReturnType<typeof werkbank>, at: THREE.Vector3, kraft = VOLL): void {
  w.bus.emit("greifer:zugedrueckt", { handle: w.car.body.handle, kraftKN: kraft, x: at.x, y: at.y, z: at.z });
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("Die Sperre sitzt in findPartNear (B1)", () => {
  it("über der geschlossenen Haube meldet die Suche die Haube, nicht den Motor", () => {
    const { car } = werkbank();
    const t = car.findPartNear(ueber("engine", 0.3));
    expect(t?.name).toBe("Motorhaube");
  });

  it("Haube ab: über dem Motor kommt nichts, solange Batterie und Kühler drin sind — und die Griff-Info sagt warum", () => {
    const { car, comps } = werkbank();
    car.tearPart("haube");
    const ort = ueber("engine", 0.3);
    expect(car.findPartNear(ort), "der Motor ist noch gesperrt").toBeNull();
    expect(comps.sperrHinweis(ort)).toEqual({ name: "Motor mit Getriebe", erst: ["Batterie", "Kühler"] });
    // Batterie und Kühler sind jetzt frei, jeder an seiner Stelle
    expect(car.findPartNear(ueber("batterie", 0.2))?.name).toBe("Batterie");
    expect(car.findPartNear(ueber("kuehler", 0.2))?.name).toBe("Kühler");
    car.tearPart("batterie");
    car.tearPart("kuehler");
    expect(car.findPartNear(ort)?.name).toBe("Motor mit Getriebe");
    expect(comps.sperrHinweis(ort)).toBeNull();
  });

  it("die Sperre gilt nur, wo der Spieler ansetzt: tearPart selbst (Presse, Spielstand, Aufgaben) reißt jedes Teil", () => {
    const { car } = werkbank();
    expect(car.tearPart("engine")).not.toBeNull();
  });

  it("an einer Fassung ohne Haube (A, B, Bestand) gilt die Sperre auf die Haube als erfüllt", () => {
    const { comps } = werkbank();
    comps.zeigeForm("a");
    const a = comps.cars[0]!;
    expect(a.teileDran).not.toContain("haube");
    a.tearPart("batterie");
    a.tearPart("kuehler");
    const p = a.body.translation();
    const ziel = a.findPartNear(new THREE.Vector3(p.x + 0.12, p.y + 0.9, p.z + 1.36));
    expect(ziel?.name).toBe("Motor mit Getriebe");
    comps.zeigeForm("c");
  });
});

describe("Kein Motor und kein Getriebe mehr durch geschlossenes Blech (28b)", () => {
  it("bis flach aufs Dach gebissen: es kommt kein einziges Teil heraus", () => {
    const w = werkbank();
    const vorher = w.car.teileDran;
    for (let i = 0; i < 10 && w.car.crushStage < 2; i++) {
      // Die Spinne steht dort, wo das Dach gerade ist (E-128: es sinkt je Biss)
      const dach = 1.42 - (1.42 - 0.62) * w.car.knautschBei(0, -0.06);
      beissen(w, new THREE.Vector3(0, dach, -0.06));
    }
    expect(w.car.crushStage).toBe(2);
    // Stufe 2 drückt zwei Räder heraus (E-114, unverändert) — sonst nichts.
    const raus = vorher.filter((id) => !w.car.teileDran.includes(id));
    expect(raus.every((id) => id.startsWith("wheel_")), `aus dem Dach kam ${raus.join(", ")}`).toBe(true);
    expect(w.car.teileDran).toContain("engine");
    expect(w.car.teileDran).toContain("haube");
  });

  it("GEGENPROBE: das alte Getriebe (unter der Frontscheibe) läge vom flachen Dach aus in Reichweite", () => {
    // Anker und Greifradius des Getriebes bis E-185 (carDef, 0,85 m)
    const alt = new THREE.Vector3(0, 0.5, 0.55);
    const dachFlach = new THREE.Vector3(0, 0.62, -0.06);
    const d = Math.hypot(dachFlach.x - alt.x, (dachFlach.y - alt.y) * 0.5, dachFlach.z - alt.z);
    expect(d).toBeLessThan(0.85);
    // … der neue Block sitzt im Motorraum, außer Reichweite vom Dach
    const motor = CAR_DEF.parts.find((p) => p.id === "engine")!;
    const n = Math.hypot(dachFlach.x - motor.anchor[0], (dachFlach.y - motor.anchor[1]) * 0.5, dachFlach.z - motor.anchor[2]);
    expect(n).toBeGreaterThan(motor.grabRadius);
  });
});

describe("Die Motorhaube (B3): erster Biss auf, zweiter ab", () => {
  it("auf, dann ab — mit Ereignis, ohne Masse zu verlieren, verbeult und mit Mindestdicke", () => {
    const w = werkbank();
    const vorher = w.car.massKg;
    const haube = (w.car as unknown as { parts: { def: { id: string }; mesh: THREE.Mesh | null }[] }).parts.find(
      (p) => p.def.id === "haube"
    )!.mesh!;
    const heil = new Float32Array((haube.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array);

    beissen(w, ueber("haube"));
    expect(w.car.haubeOffen).toBe(true);
    expect(w.car.massKg, "aufgesprungen ist nicht ab").toBe(vorher);
    expect(w.abriss.map((e) => e.art)).toEqual(["auf"]);
    // Sie steht schief am Scharnier: vorn hoch, eine Seite tiefer
    expect(haube.rotation.x).toBeLessThan(-0.2);
    expect(Math.abs(haube.rotation.z)).toBeGreaterThan(0.02);

    beissen(w, ueber("haube"));
    expect(w.car.teileDran).not.toContain("haube");
    expect(w.abriss.map((e) => `${e.art} ${e.teil}`)).toEqual(["auf haube", "ab haube"]);
    expect(w.abriss[1]!.massKg).toBe(15);
    expect(w.car.massKg).toBe(vorher - 15);

    const stueck = w.items.items.find((i) => i.shape?.name === "Motorhaube")!;
    expect(stueck.massKg).toBe(15);
    expect(stueck.mesh.parent).toBe(w.scene);
    // verbeult: Die Bisse haben ihre Eckpunkte verschoben
    // (verglichen wird die Lage jedes Eckpunkts zum ersten — das lose Netz ist als Ganzes verschoben)
    const jetzt = (stueck.mesh as THREE.Mesh).geometry.getAttribute("position") as THREE.BufferAttribute;
    let beule = 0;
    for (let i = 1; i < jetzt.count; i++) {
      for (let k = 0; k < 3; k++) {
        const neu = jetzt.getComponent(i, k) - jetzt.getComponent(0, k);
        const alt = heil[i * 3 + k]! - heil[k]!;
        beule = Math.max(beule, Math.abs(neu - alt));
      }
    }
    expect(beule, "die Haube fliegt glatt weg statt verbeult").toBeGreaterThan(0.01);
    // Rapier-Lehre: Bleche mit Mindestdicke
    const c = stueck.body.collider(0);
    expect(2 * c.halfExtents().y).toBeGreaterThanOrEqual(0.08 - 1e-6);
  });

  it("Greifen und Ziehen reißt eine geschlossene Haube direkt ab (der Biss ist nur ein Weg)", () => {
    const { car } = werkbank();
    const t = car.findPartNear(ueber("haube", 0.3))!;
    expect(t.tearSeconds).toBe(1.0);
    t.tear();
    expect(car.teileDran).not.toContain("haube");
  });
});

describe("Die Reihenfolge Haube → Batterie, Kühler → Motor mit Getriebe (B4)", () => {
  it("fünf volle Bisse an den Stellen der Teile holen sie in genau dieser Reihenfolge", () => {
    const w = werkbank();
    beissen(w, ueber("engine")); // Haube springt auf
    beissen(w, ueber("engine")); // Haube ab
    beissen(w, ueber("engine")); // Motor gesperrt: nichts kommt heraus
    expect(w.car.teileDran).toContain("engine");
    beissen(w, ueber("batterie"));
    beissen(w, ueber("kuehler"));
    beissen(w, ueber("engine"));
    // Sechs volle Bisse knautschen das Auto flach (E-128) — Stufe 2 drückt
    // dabei zwei Räder heraus (E-114). Die zählen hier nicht.
    expect(w.abriss.filter((e) => !e.teil.startsWith("wheel_")).map((e) => `${e.art} ${e.teil}`)).toEqual([
      "auf haube",
      "ab haube",
      "ab batterie",
      "ab kuehler",
      "ab engine",
    ]);
    const motor = w.items.items.find((i) => i.shape?.name === "Motor mit Getriebe")!;
    expect(motor.massKg, "Motor und Getriebe als ein Block (Frage 1 B)").toBe(220);
    expect(motor.materialId).toBe("alu");
    expect(w.items.items.find((i) => i.shape?.name === "Batterie")!.materialId).toBe("battery");
  });

  it("die Teile im Motorraum überschneiden sich nicht und stehen unter der Haube", () => {
    const box = (id: string): THREE.Box3 => {
      const p = CAR_DEF.parts.find((q) => q.id === id)!;
      const a = new THREE.Vector3(...p.anchor);
      const b = new THREE.Box3().setFromCenterAndSize(a, new THREE.Vector3(p.size[0], p.size[1], p.size[2]));
      for (const s of p.stuecke ?? []) {
        b.union(new THREE.Box3().setFromCenterAndSize(a.clone().add(new THREE.Vector3(...s.at)), new THREE.Vector3(...s.size)));
      }
      return b;
    };
    const ids = ["batterie", "kuehler", "engine"];
    for (const x of ids) {
      for (const y of ids) if (x < y) expect(box(x).intersectsBox(box(y)), `${x} steckt in ${y}`).toBe(false);
      // unter der Haube (0,86 m an ihrer tiefsten Stelle) und hinter der Spritzwand (0,80 m)
      expect(box(x).max.y, `${x} ragt durch die Haube`).toBeLessThan(0.86);
      expect(box(x).min.z, `${x} steckt im Innenraum`).toBeGreaterThan(0.8);
      // zwischen den Vorderrädern (innen ab 0,70 m)
      expect(Math.max(-box(x).min.x, box(x).max.x)).toBeLessThan(0.7);
    }
  });
});

describe("Räder mit Felge (B2)", () => {
  it("jedes Rad an jedem Wrack ist Reifen mit Stahlfelge, 70 / 30, und damit Mischschrott", () => {
    for (const def of [CAR_DEF, LKW_DEF, WOHNWAGEN_DEF]) {
      for (const p of def.parts.filter((q) => q.kind === "wheel")) {
        expect(p.zusammensetzung).toEqual([
          { materialId: "tires", anteil: 0.7 },
          { materialId: "steel", anteil: 0.3 },
        ]);
        expect(p.materialId).toBe("mixed");
      }
    }
  });

  it("die Felge ist im Bild: silberne Eckpunkte an jedem Radanker im Sammelnetz", () => {
    for (const art of ["pkw", "lkw", "wohnwagen"] as WrackArt[]) {
      const { car } = werkbank(art);
      const sammel = car.group.children.find((o) => o.name === "Wrackteile") as THREE.Mesh;
      const pos = sammel.geometry.getAttribute("position") as THREE.BufferAttribute;
      const col = sammel.geometry.getAttribute("color") as THREE.BufferAttribute;
      const silber = new THREE.Color(FELGE_FARBE);
      const def = car.art === "pkw" ? CAR_DEF : art === "lkw" ? LKW_DEF : WOHNWAGEN_DEF;
      for (const p of def.parts.filter((q) => q.kind === "wheel")) {
        let n = 0;
        for (let i = 0; i < pos.count; i++) {
          const nah = Math.hypot(pos.getX(i) - p.anchor[0], pos.getY(i) - p.anchor[1], pos.getZ(i) - p.anchor[2]) < p.size[0]!;
          if (nah && Math.abs(col.getX(i) - silber.r) < 1e-3 && Math.abs(col.getY(i) - silber.g) < 1e-3) n++;
        }
        expect(n, `${art} ${p.id} hat keine Felge`).toBeGreaterThan(10);
      }
    }
  });

  it("ein abgerissenes Rad ist ein Achtkant und rollt ein Stück — und bleibt dann liegen", () => {
    const w = werkbank();
    const rad = w.car.tearPart("wheel_1")!;
    expect(rad.collider(0).shapeType()).toBe(RAPIER.ShapeType.ConvexPolyhedron);
    // aufrecht neben das Wrack stellen und anschubsen, quer zur Achse
    rad.setTranslation({ x: 4, y: 0.34, z: 0 }, true);
    rad.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    rad.applyImpulse({ x: 0, y: 0, z: 25 * 2 }, true); // 2 m/s
    const start = rad.translation().z;
    let ruhig = -1;
    for (let i = 0; i < 900; i++) {
      w.world.step();
      const v = rad.linvel();
      if (ruhig < 0 && i > 30 && Math.hypot(v.x, v.y, v.z) < 0.05) ruhig = i;
    }
    expect(rad.translation().z - start, "es rollt ein Stück").toBeGreaterThan(0.5);
    expect(ruhig, "und bleibt von selbst liegen (Achtkant, v2 E-011)").toBeGreaterThan(0);
  });
});

describe("Innenausstattung (B5a): sichtbar, im Anbau-Netz, knautscht mit", () => {
  function anbau(car: CarComposite): THREE.Mesh {
    return car.group.getObjectByName("Anbauteile") as THREE.Mesh;
  }

  it("jedes Stück liegt ganz in der Karosserie, über dem Boden und unter dem Dach", () => {
    for (const [form, art] of [[FORM_C, "pkw"], [FORM_LKW, "lkw"], [FORM_WOHNWAGEN, "wohnwagen"]] as const) {
      expect(form.innen!.length, `${art} hat keinen Innenraum`).toBeGreaterThan(0);
      for (const a of form.innen!) {
        for (const seite of a.paarweise ? [-1, 1] : [1]) {
          const x = seite * a.anchor[0] * (form.breite / 2);
          const z = a.anchor[2] * (form.laenge / 2);
          const hb = (a.size[0] * form.breite) / 2;
          for (const dy of [-1, 1]) {
            for (const dz of [-1, 1]) {
              const y = a.anchor[1] + (dy * a.size[1]) / 2;
              const zz = z + (dz * a.size[2]) / 2;
              expect(halbeBreiteBei(form, y, zz), `${art} ${a.name} ragt seitlich aus der Haut`).toBeGreaterThan(Math.abs(x) + hb);
            }
          }
        }
      }
    }
  });

  it("der Innenraum kostet kein Netz und geht beim Pressen mit: nichts ragt über das flache Wrack", () => {
    const { car } = werkbank();
    const netz = anbau(car);
    const pos = netz.geometry.getAttribute("position") as THREE.BufferAttribute;
    // Eckpunkte in der Fahrgastzelle (zwischen Spritzwand und Heckklappe, innen)
    const innen = (): number[] => {
      const ys: number[] = [];
      for (let i = 0; i < pos.count; i++) {
        if (Math.abs(pos.getX(i)) < 0.7 && pos.getZ(i) < 0.75 && pos.getZ(i) > -1.06 && pos.getY(i) > 0.4) ys.push(pos.getY(i));
      }
      return ys;
    };
    const heil = innen();
    expect(heil.length, "keine Sitze im Anbau-Netz").toBeGreaterThan(40);
    expect(Math.max(...heil)).toBeGreaterThan(1.0); // Lehnen der Vordersitze
    car.pressCrush();
    expect(Math.max(...innen()), "ein Sitz steht aus dem flachen Wrack").toBeLessThan(0.72);
  });
});

describe("Masse und Netze", () => {
  it("die Masse wird nur umverteilt: Haube, Batterie und Kühler kommen aus der Karosse (600 → 563 kg)", () => {
    const teile = (ids: string[]): number => CAR_DEF.parts.filter((p) => ids.includes(p.id)).reduce((s, p) => s + p.massKg, 0);
    expect(CAR_DEF.hullMassKg + teile(["haube", "batterie", "kuehler"])).toBe(600);
    expect(teile(["engine"]), "Motor 150 + Getriebe 70").toBe(220);
    expect(CAR_DEF.totalMassKg).toBe(950);
  });

  it("Netze je Wrack: Pkw 8 (vorher 12), LKW 6 (vorher 13), Wohnwagen 7 (vorher 9)", () => {
    const netze = (car: CarComposite): number => {
      let n = 0;
      car.group.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) n++;
      });
      return n;
    };
    expect(netze(werkbank("pkw").car)).toBe(8);
    expect(netze(werkbank("lkw").car)).toBe(6);
    expect(netze(werkbank("wohnwagen").car)).toBe(7);
  });

  it("jedes Abreißen meldet sich, auch der Radauswurf der Presse", () => {
    const w = werkbank();
    w.car.pressCrush();
    expect(w.abriss.filter((e) => e.art === "ab" && e.teil.startsWith("wheel_")).length).toBe(2);
    for (const e of w.abriss) {
      expect(e.handle).toBe(w.car.body.handle);
      expect(e.massKg).toBe(25);
      expect(Number.isFinite(e.x + e.y + e.z)).toBe(true);
    }
  });
});
