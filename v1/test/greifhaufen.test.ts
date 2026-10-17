/**
 * Waechter fuers Greifen IM HAUFEN — nicht auf dem Beton.
 *
 * Anlass (Patrick, 15.09.2026, nach dem zweiten Geraetetest): „Kleinteile sind
 * sehr schwer zu greifen." Die erste Ursache war die zu kleine Sensorkugel
 * (E-030, `test/greiffenster.test.ts`); danach nimmt die Spinne vom Beton alles
 * auf. Im Haufen blieb es trotzdem schwierig.
 *
 * Die zweite Ursache ist die Kontaktbedingung. Gefasst wurde nur, was entweder
 * den Schwerpunkt mitten im Korb hatte oder an dem ZWEI Schalen anlagen. Zwei
 * Schalen sind fuer Kleinteile aber unerreichbar: Fuenf Schalen stehen im
 * Kreis, zwischen zwei benachbarten klafft selbst geschlossen eine Luecke von
 * 0,63 m, und im Greiffenster (Schliessgrad 0,60 bis 0,98) sind es bis zu
 * 1,30 m. Gemessen ueber 63 Griffe im Haufen: `krallenKontakte` meldet fuer
 * Teile bis 0,40 m hoechstens 2, meist 0 — auch wenn das Teil neun Bilder lang
 * nachweislich zwischen den Schalen liegt. Die Bedingung fiel damit immer auf
 * die Ausnahme „Schwerpunkt mittig" zurueck, und am Korbrand, wo die nicht
 * greift, blieb das Teil liegen.
 *
 * Gemessen wird am echten Bagger in einer echten Rapier-Welt, mit Nachbarn
 * ringsum, ueber MEHRERE Zufallssaaten — ein Waechter mit einer einzigen Saat
 * misst nur, ob er einen ruhigen Wurf erwischt hat.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { GripSystem, SCHALENLUECKE, noetigeKrallenFuer } from "../src/physics/gripSystem";
import { initPhysics } from "../src/physics/physicsWorld";
import { ItemManager } from "../src/world/scrapItems";
import {
  CLAW_CLOSED_SPLAY,
  CLAW_COUNT,
  CLAW_SEGMENTS,
  clawPoint,
} from "../src/excavator/clawGeometry";

/** Tastatur-Attrappe: nur `isDown` und `axis` werden vom Bagger gebraucht. */
class Tasten {
  down = new Set<string>();
  wheelDelta = 0;
  orbitDX = 0;
  orbitDY = 0;
  shiftHeld = false;
  isDown(c: string): boolean {
    return this.down.has(c);
  }
  wasPressed(): boolean {
    return false;
  }
  mouseHeld(): boolean {
    return false;
  }
  axis(neg: string, pos: string): number {
    return (this.down.has(pos) ? 1 : 0) - (this.down.has(neg) ? 1 : 0);
  }
  endFrame(): void {}
}

interface Stand {
  world: RAPIER.World;
  bagger: Excavator;
  grip: GripSystem;
  tasten: Tasten;
  massiv: Set<number>;
}

const DT = 1 / 60;

beforeAll(async () => {
  leinwandAttrappe();
  await initPhysics();
});

function aufbau(): Stand {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  const bagger = new Excavator(new THREE.Scene(), world);
  const grip = new GripSystem(world, bagger.grappleBody);
  // genau wie in main.ts verdrahtet
  grip.insideGrapple = (p) => bagger.isInsideGrapple(p);
  grip.krallenKontakte = (b) => bagger.krallenKontakte(b);
  const massiv = new Set<number>();
  bagger.clawBlockedBy = (b) => massiv.has(b.handle);
  return { world, bagger, grip, tasten: new Tasten(), massiv };
}

function takt(s: Stand): void {
  const sensor = new THREE.Vector3();
  s.bagger.update(DT, s.tasten as never);
  s.grip.update(s.bagger.closure, s.bagger.closing, s.bagger.getSensorPosition(sensor), DT);
  s.world.step();
  s.bagger.carriedCount = s.grip.grippedCount;
  s.bagger.carriedMassKg = s.grip.totalMassKg;
  s.bagger.grippedHandles.clear();
  for (const b of s.grip.grippedBodies) s.bagger.grippedHandles.add(b.handle);
}

function quader(
  s: Stand,
  mitte: THREE.Vector3,
  dims: [number, number, number],
  massKg: number,
  rot?: THREE.Quaternion
): RAPIER.RigidBody {
  const d = RAPIER.RigidBodyDesc.dynamic().setTranslation(mitte.x, mitte.y, mitte.z);
  if (rot) d.setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w });
  const b = s.world.createRigidBody(d);
  s.world.createCollider(
    RAPIER.ColliderDesc.cuboid(dims[0] / 2, dims[1] / 2, dims[2] / 2).setMass(massKg),
    b
  );
  s.massiv.add(b.handle); // massiver Stahl: die Zaehne bleiben daran stehen
  return b;
}

/**
 * Fester Zufall je Saat. Der Haufen wird gewuerfelt; mit `Math.random` waere
 * der Waechter mal gruen und mal rot — und mit EINER Saat misst er nur einen
 * einzigen Haufen (Befund 15.09.2026).
 */
function zufall(saat: number): () => number {
  let z = saat >>> 0;
  return () => {
    z = (z * 1664525 + 1013904223) >>> 0;
    return z / 4294967296;
  };
}

/** Arm senken, bis die offene Spinne aufsitzt. */
function absetzen(s: Stand): void {
  s.tasten.down.add("KeyF"); // Ausleger ab
  s.tasten.down.add("KeyG"); // Stiel ab
  for (let i = 0; i < 260; i++) takt(s);
  s.tasten.down.clear();
  for (let i = 0; i < 30; i++) takt(s);
}

/** Wo die abgesetzte Spinne steht — einmal gemessen, dann gemerkt. */
let GRIFFPUNKT: THREE.Vector3 | null = null;
function griffpunkt(): THREE.Vector3 {
  if (!GRIFFPUNKT) {
    const s = aufbau();
    absetzen(s);
    GRIFFPUNKT = s.bagger.grappleGroup.position.clone();
    s.world.free();
  }
  return GRIFFPUNKT.clone();
}

interface Versuch {
  gegriffen: boolean;
  /** Bilder, in denen das Teil nachweislich im Korb lag */
  imKorb: number;
  /** wie weit das Teil relativ zur Spinne gewandert ist, nachdem es hing (m) */
  gewandert: number;
  /** wie viele Teile am Ende in der Spinne haengen */
  korb: number;
  /** Bilder, in denen es im Korb lag, aber andere mitkamen und es nicht */
  verdraengt: number;
  /** wie viele Koerper je Bild die Greifbedingung erfuellten (Hoechstwert) */
  kandidaten: number;
  /** schnellster loser Koerper waehrend des Griffs (m/s) */
  maxV: number;
  /** lose Koerper unter dem Beton am Ende */
  unterBoden: number;
}

/**
 * Ein Greifversuch mitten im Haufen.
 *
 * Reihenfolge wie im Spiel: Haufen liegt und ruht, DANN faehrt der Arm hinein,
 * und gezielt wird auf das, was dann unter der Spinne liegt. (Wer das Zielteil
 * vorher legt, misst nur, wohin die Krallen es geschoben haben.)
 */
function haufenversuch(
  dims: [number, number, number],
  massKg: number,
  versatz: number,
  saat: number,
  nachbarn = 14,
  ringVon = 0.5,
  ringBis = 2.0
): Versuch {
  const s = aufbau();
  const g = griffpunkt();
  const rnd = zufall(saat);
  for (let i = 0; i < nachbarn; i++) {
    const a = rnd() * Math.PI * 2;
    const rad = ringVon + rnd() * (ringBis - ringVon);
    const br = 0.25 + rnd() * 0.65;
    const ho = 0.2 + rnd() * 0.5;
    const y = 0.4 + Math.floor(i / 7) * 0.9 + rnd() * 0.3;
    const q = new THREE.Quaternion().setFromEuler(
      new THREE.Euler((rnd() - 0.5) * 1.2, rnd() * Math.PI * 2, (rnd() - 0.5) * 1.2)
    );
    quader(
      s,
      new THREE.Vector3(g.x + Math.cos(a) * rad, y, g.z + Math.sin(a) * rad),
      [br, ho, br * (0.6 + rnd())],
      20 + rnd() * 30,
      q
    );
  }
  for (let i = 0; i < 180; i++) takt(s); // Haufen setzen lassen
  absetzen(s);

  // Zielteil dorthin, wo der Spieler zielt: unter die Spinne, um `versatz`
  // daneben, auf das, was dort gerade obenauf liegt.
  const gp = s.bagger.grappleGroup.position;
  const zx = gp.x + versatz * 0.93;
  const zz = gp.z + versatz * 0.37;
  let unterlage = 0;
  s.world.bodies.forEach((b) => {
    if (!b.isDynamic()) return;
    const t = b.translation();
    if (Math.hypot(t.x - zx, t.z - zz) < 0.45) unterlage = Math.max(unterlage, t.y + 0.2);
  });
  const ziel = quader(s, new THREE.Vector3(zx, unterlage + dims[1] / 2 + 0.03, zz), dims, massKg);
  for (let i = 0; i < 45; i++) takt(s);

  s.tasten.down.add("Space");
  let imKorb = 0;
  let verdraengt = 0;
  let gewandert = 0;
  let haengtSeit = 0;
  let kandidaten = 0;
  let maxV = 0;
  let relBeimFassen: THREE.Vector3 | null = null;
  const probe = new THREE.Vector3();
  for (let i = 0; i < 110; i++) {
    takt(s);
    s.world.bodies.forEach((b) => {
      if (!b.isDynamic()) return;
      const v = b.linvel();
      maxV = Math.max(maxV, Math.hypot(v.x, v.y, v.z));
    });
    if (!ziel.isValid()) break;
    const haengt = s.grip.grippedBodies.some((x) => x.handle === ziel.handle);
    const c = s.bagger.closure;
    if (c >= 0.6 && c <= 0.98) kandidaten = Math.max(kandidaten, s.grip.letzteKandidaten);
    if (c >= 0.6 && c <= 0.98 && !haengt) {
      // Liegt das Teil im Korb? Geprueft wird wie in `tryGrab`: der Punkt der
      // Oberflaeche, der der Sensormitte am naechsten liegt.
      const sensor = s.bagger.getSensorPosition(new THREE.Vector3());
      const pr = ziel
        .collider(0)
        ?.projectPoint({ x: sensor.x, y: sensor.y, z: sensor.z }, true);
      if (pr && s.bagger.isInsideGrapple(probe.set(pr.point.x, pr.point.y, pr.point.z))) {
        imKorb++;
        // Andere kamen mit, dieses Teil nicht — obwohl es nachweislich im
        // Korb liegt. Genau das war die Verdraengung durch schwerere Nachbarn.
        if (s.grip.grippedCount > 0) verdraengt++;
      }
    }
    if (!haengt) continue;
    haengtSeit++;
    if (haengtSeit < 4) continue; // Kinematik wirkt erst im naechsten Schritt
    const p = ziel.translation();
    const q = s.bagger.grappleBody.translation();
    const r = s.bagger.grappleBody.rotation();
    const rel = new THREE.Vector3(p.x - q.x, p.y - q.y, p.z - q.z).applyQuaternion(
      new THREE.Quaternion(r.x, r.y, r.z, r.w).invert()
    );
    if (!relBeimFassen) relBeimFassen = rel.clone();
    else gewandert = Math.max(gewandert, rel.distanceTo(relBeimFassen));
  }
  const gegriffen = s.grip.grippedBodies.some((x) => x.handle === ziel.handle);
  const korb = s.grip.grippedCount;
  let unterBoden = 0;
  s.world.bodies.forEach((b) => {
    if (b.isDynamic() && b.translation().y < -0.6) unterBoden++;
  });
  s.world.free();
  return { gegriffen, imKorb, gewandert, korb, verdraengt, kandidaten, maxV, unterBoden };
}

/**
 * Ein Griff in den ECHTEN Starthaufen — mit den Formen des Objektkatalogs,
 * nicht mit Quadern. Langsam (rund 15 s je Saat), deshalb nur dort benutzt, wo
 * es auf echtes Material ankommt.
 */
function starthaufenGriff(saat: number): {
  teile: number;
  korb: number;
  kg: number;
  kandidaten: number;
  unterBoden: number;
} {
  const s = aufbau();
  const szene = new THREE.Scene();
  const items = new ItemManager(szene, s.world);
  // wie in main.ts: was sich quetschen laesst, haelt die Zaehne nicht auf
  s.bagger.clawBlockedBy = (b) => {
    const it = items.itemByBody(b);
    if (!it) return true;
    return !items.isCrushable(it);
  };
  s.grip.onReleaseGrace = () => s.bagger.startClawGrace();
  absetzen(s);
  const g = s.bagger.grappleGroup.position.clone();

  // Fester Zufall: `spawnPile` wuerfelt Formen, Massen, Lage und Drehung.
  const echt = Math.random;
  let z = saat >>> 0;
  Math.random = () => {
    z = (z * 1664525 + 1013904223) >>> 0;
    return z / 4294967296;
  };
  items.spawnPile(new THREE.Vector3(g.x, 0, g.z), 150);
  Math.random = echt;
  for (let i = 0; i < 400; i++) {
    takt(s);
    items.clampSpeeds(1 / 60);
    items.settleSleep(1 / 60, s.bagger.grappleBody.translation());
  }
  absetzen(s); // jetzt liegt der Haufen unter der Spinne — noch einmal hinein
  s.tasten.down.add("Space");
  let kandidaten = 0;
  for (let i = 0; i < 80; i++) {
    takt(s);
    items.clampSpeeds(1 / 60);
    if (s.bagger.closure >= 0.6 && s.bagger.closure <= 0.98)
      kandidaten = Math.max(kandidaten, s.grip.letzteKandidaten);
  }
  const korb = s.grip.grippedCount;
  const kg = s.grip.totalMassKg;
  const teile = items.items.length;
  let unterBoden = 0;
  for (const it of items.items) if (it.body.translation().y < -0.6) unterBoden++;
  s.world.free();
  return { teile, korb, kg, kandidaten, unterBoden };
}

/**
 * Zwei schwere Teile, zusammen 4000 kg — mehr als die alte feste Grenze
 * `MAX_TOTAL_KG` (3500, bis E-152). Seit E-152 werden beide gefasst.
 *
 * `versatzB` legt den zweiten Brocken weiter nach aussen; beide liegen mit dem
 * Schwerpunkt im Korb, der zweite aber lockerer.
 */
function traglastProbe(versatzB: number): {
  aGefasst: boolean;
  bGefasst: boolean;
  kg: number;
  korb: number;
} {
  const s = aufbau();
  absetzen(s);
  const gp = s.bagger.grappleGroup.position;
  const a = quader(s, new THREE.Vector3(gp.x, 0.23, gp.z), [0.4, 0.4, 0.4], 2000);
  const b = quader(
    s,
    new THREE.Vector3(gp.x + versatzB * 0.93, 0.23, gp.z + versatzB * 0.37),
    [0.4, 0.4, 0.4],
    2000
  );
  for (let i = 0; i < 30; i++) takt(s);
  s.tasten.down.add("Space");
  for (let i = 0; i < 90; i++) takt(s);
  const aGefasst = s.grip.grippedBodies.some((x) => x.handle === a.handle);
  const bGefasst = s.grip.grippedBodies.some((x) => x.handle === b.handle);
  const kg = s.grip.totalMassKg;
  const korb = s.grip.grippedCount;
  s.world.free();
  return { aGefasst, bGefasst, kg, korb };
}

describe("Schalenluecke — Herkunft der Zahl", () => {
  it("ist gerechnet, nicht gewaehlt", () => {
    // Nachgerechnet aus der Krallenform: zwei benachbarte Schalen an der
    // Station, die `krallenKontakte` abtastet, bei geschlossener Spinne.
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    clawPoint(0, CLAW_CLOSED_SPLAY, Math.round(CLAW_SEGMENTS * 0.6), a);
    clawPoint((1 / CLAW_COUNT) * Math.PI * 2, CLAW_CLOSED_SPLAY, Math.round(CLAW_SEGMENTS * 0.6), b);
    expect(SCHALENLUECKE).toBeCloseTo(a.distanceTo(b), 6);
    expect(SCHALENLUECKE).toBeCloseTo(0.629, 2);
  });

  it("kleiner als die Luecke heisst: keine Schale verlangen", () => {
    // Wer zwischen zwei geschlossene Schalen passt, kann sie nicht beide
    // beruehren — von dem zwei Kontakte zu verlangen ist unerfuellbar.
    expect(noetigeKrallenFuer(0.1)).toBe(0);
    expect(noetigeKrallenFuer(0.4)).toBe(0);
    expect(noetigeKrallenFuer(0.62)).toBe(0);
    // Ab einer Luecke eine Schale, ab zweien zwei — und dabei bleibt es.
    expect(noetigeKrallenFuer(0.7)).toBe(1);
    expect(noetigeKrallenFuer(1.3)).toBe(2);
    // Die Kiste, die nur mit einer Ecke hineinragt (2,40 m), bleibt bei zwei:
    // Sie ist der Grund, warum es die Bedingung ueberhaupt gibt.
    expect(noetigeKrallenFuer(2.4)).toBe(2);
  });
});

/*
 * Dieselben Groessen wie auf dem Beton (`test/greiffenster.test.ts`), damit
 * die beiden Tabellen vergleichbar sind: vom Kleinteil von 10 cm bis zum
 * Betonblock von 1,10 m, dazu das flache Blech und der lange Traeger.
 */
const GROESSEN: [string, [number, number, number], number][] = [
  ["Kleinteil 0,10 m", [0.1, 0.1, 0.1], 8],
  ["Kupferbund, flach 0,10 m", [0.38, 0.1, 0.38], 18],
  ["Messingarmatur 0,30 m", [0.3, 0.25, 0.3], 15],
  ["Motorblock-Rest 0,40 m", [0.4, 0.4, 0.4], 110],
  ["Blech, 6 cm dick", [0.7, 0.06, 0.9], 55],
  ["Traeger 2,90 m", [0.28, 0.28, 2.9], 180],
  ["Betonblock 1,10 m", [1.1, 1.1, 1.1], 130],
];

/** Zwei Haufen, nicht einer. */
const SAATEN = [20260915, 4711];

describe("Greifen im Haufen — was die Spinne aus dem Haufen holt", () => {
  it(
    "holt jede Groesse aus dem Haufen, auch 0,40 m neben der Achse",
    () => {
      const fehlt: string[] = [];
      for (const [name, dims, kg] of GROESSEN) {
        for (const saat of SAATEN) {
          const r = haufenversuch(dims, kg, 0.4, saat);
          if (!r.gegriffen) fehlt.push(`${name} (Saat ${saat}, ${r.imKorb} Bilder im Korb)`);
        }
      }
      expect(fehlt, `blieb im Haufen liegen: ${fehlt.join(", ")}`).toEqual([]);
    },
    180000
  );

  it(
    "holt auch vom Korbrand (0,80 m neben der Achse) das meiste heraus",
    () => {
      /*
       * Der Rand ist der Fall, an dem die alte Bedingung scheiterte: Dort
       * liegt der Schwerpunkt nicht mehr im Korbkegel, und zwei anliegende
       * Schalen gibt es bei Kleinteilen nie. Gemessen (je drei Saaten,
       * vier Groessen): vorher 6 von 12, nachher 11 von 12.
       *
       * Keine 12 von 12: Am Rand schiebt die schliessende Schale ein
       * leichtes Teil auch mal aus dem Korb, bevor sie es fasst. Das ist
       * Physik, keine Bedingung — deshalb steht die Schwelle bei 9.
       */
      const rand: [string, [number, number, number], number][] = GROESSEN.slice(0, 4);
      let ja = 0;
      let gesamt = 0;
      const bericht: string[] = [];
      for (const [name, dims, kg] of rand) {
        for (const saat of [20260915, 4711, 99991]) {
          const r = haufenversuch(dims, kg, 0.8, saat);
          gesamt++;
          if (r.gegriffen) ja++;
          else bericht.push(`${name}/${saat}: ${r.imKorb} Bilder im Korb, nicht gefasst`);
        }
      }
      expect(ja, `nur ${ja} von ${gesamt} — ${bericht.join(" | ")}`).toBeGreaterThanOrEqual(9);
    },
    180000
  );

  it(
    "ein im Haufen gefasstes Teil bleibt, wo es gefasst wurde (kein Saugen)",
    () => {
      // Der v2-Fehler, den Patrick ausdruecklich nicht will: Das Teil wanderte
      // nach dem Zupacken in die Korbmitte. Schwelle wie auf dem Beton.
      for (const saat of SAATEN) {
        const r = haufenversuch([0.4, 0.4, 0.4], 110, 0.4, saat);
        expect(r.gegriffen).toBe(true);
        expect(r.gewandert, "das Teil wandert nach dem Fassen — das ist Saugen").toBeLessThan(
          0.05
        );
      }
    },
    120000
  );

  it(
    "nimmt auch im Haufen keine Kiste mit, die nur mit einer Ecke hineinragt",
    () => {
      /*
       * Die Gegenprobe zur gelockerten Bedingung: Eine grosse Kiste, deren
       * Mitte weit neben der Spinne liegt, ist groesser als zwei
       * Schalenluecken und braucht deshalb weiter zwei anliegende Schalen.
       *
       * 2,12 m Versatz wie auf dem Beton (`test/greiffenster.test.ts`): Nur
       * eine Ecke der Kiste ragt in den Korb. Naeher heran gelegt ist die
       * Kiste wirklich gefasst — zwei Schalen liegen dann an, und dass sie
       * dann mitkommt, ist richtig und war vor dieser Aenderung ebenso.
       */
      for (const saat of SAATEN) {
        const r = haufenversuch([2.4, 0.9, 2.4], 600, 2.12, saat);
        expect(r.gegriffen, "eine Kiste mit einer Ecke im Korb wurde gefasst").toBe(false);
      }
    },
    120000
  );
});

/**
 * E-045 — worauf du zielst, das bekommst du.
 *
 * Ansage Patrick 15.09.2026: „Alles mitnehmen, was in der Spinne liegt und wo
 * der Greifer sich festkrallt oder was verkantet ist. Nicht nach Gewicht
 * gehen." Vorher entschied das Gewicht: `candidates.sort` nahm das Schwerste
 * zuerst, und eine Stueckzahlgrenze von 5 schnitt ab — im dichten Nest
 * erfuellten 7 bis 12 Koerper die Bedingung, die fuenf schwersten kamen mit,
 * das anvisierte Kleinteil nie.
 *
 * Seit E-052 gibt es die Stueckzahlgrenze gar nicht mehr („Deckel ganz weg"),
 * die einzige Grenze ist die Traglast.
 */
describe("Greifen im Haufen — worauf du zielst, das bekommst du", () => {
  it(
    "nimmt das leichte Teil mit, auch zwischen schwereren Nachbarn",
    () => {
      /*
       * Der Fall, an dem es scheiterte: dichtes Nest (30 Nachbarn, Ring 0,3
       * bis 1,2 m, je 20 bis 50 kg), Zielteil 8 kg mitten darin. Gemessen
       * vorher: 0 von 5 — in JEDEM Bild des Greiffensters lag es im Korb und
       * wurde vom vollen Korb abgewiesen. Nachher: 5 von 5.
       */
      for (const saat of [20260915, 4711, 99991]) {
        const r = haufenversuch([0.1, 0.1, 0.1], 8, 0, saat, 30, 0.3, 1.2);
        expect(
          r.gegriffen,
          `8-kg-Teil blieb liegen (Saat ${saat}: ${r.imKorb} Bilder im Korb, ${r.verdraengt} davon verdraengt, Korb ${r.korb}, ${r.kandidaten} Kandidaten)`
        ).toBe(true);
        expect(r.verdraengt, "im Korb, aber andere kamen mit und es nicht").toBe(0);
      }
    },
    180000
  );

  it(
    "der Deckel waehlt nicht mehr aus: es kommt mehr mit, als frueher Platz hatte",
    () => {
      // Gegenprobe zur Zahl oben: Im dichten Nest erfuellen mehr als fuenf
      // Koerper die Bedingung. Waere der Deckel noch 5, MUESSTE etwas
      // liegenbleiben, das gehalten wird.
      const r = haufenversuch([0.1, 0.1, 0.1], 8, 0, 20260915, 30, 0.3, 1.2);
      expect(r.kandidaten, "im dichten Nest erfuellen mehr als fuenf die Bedingung").toBeGreaterThan(
        5
      );
      expect(r.korb, "und sie kommen auch mit").toBeGreaterThan(5);
    },
    120000
  );

  it(
    "und trotzdem bleibt die Physik ruhig, wenn viel auf einmal haengt",
    () => {
      // „Alles mitnehmen" darf nicht heissen: alles fliegt. Gemessen bleiben
      // die losen Koerper unter 10 m/s (der Deckel des Spiels liegt bei 28),
      // und keiner sackt durch den Beton.
      for (const saat of [20260915, 4711]) {
        const r = haufenversuch([0.1, 0.1, 0.1], 8, 0, saat, 30, 0.3, 1.2);
        expect(r.korb, "es haengt spuerbar mehr als frueher").toBeGreaterThan(5);
        expect(r.maxV, `schnellster loser Koerper ${r.maxV.toFixed(1)} m/s`).toBeLessThan(10);
        expect(r.unterBoden, "ein Koerper ist durch den Beton gesackt").toBe(0);
        expect(r.gewandert, "das Teil wandert nach dem Fassen — das ist Saugen").toBeLessThan(
          0.05
        );
      }
    },
    120000
  );
});

describe("Traglast — seit E-152 keine Grenze beim Greifen mehr", () => {
  it(
    "zwei 2-t-Brocken im Korb: beide werden gefasst",
    () => {
      /*
       * Bis E-152 schnitt `MAX_TOTAL_KG` (3 500 kg) hier einen der beiden ab,
       * und welcher, entschied der Haltwert. Patrick, 17.10.2026: „beim heben
       * passiert nichts … ein umschlagbagger kann definitiv mehr heben". Jetzt
       * greift die Spinne alles, was im Korb liegt; ob es hochgeht, entscheidet
       * der Arm nach der Traglasttabelle (`test/traglast.test.ts`).
       */
      const r = traglastProbe(0.5);
      expect(r.korb, "beide Brocken haengen").toBe(2);
      expect(r.aGefasst && r.bGefasst).toBe(true);
      expect(r.kg).toBeCloseTo(4000, -1);
    },
    120000
  );
});

describe("Greifen im echten Starthaufen — es kommt kein halber Haufen mit", () => {
  it(
    "ein Griff in den gewuerfelten Starthaufen nimmt eine Handvoll, nicht den Haufen",
    () => {
      /*
       * DIESER WAECHTER ERSETZT DIE STUECKZAHLGRENZE (E-052).
       *
       * Bis heute stand im Greifsystem ein Deckel — erst 5, dann 24 —, damit
       * eine kaputte Greifbedingung nicht unbemerkt den halben Platz anhaengt.
       * Ansage Patrick: „Deckel ganz weg." Der Einwand bleibt trotzdem
       * richtig, nur ist ein stiller Deckel die falsche Antwort: Er VERDECKT
       * den Fehler (die Maschine nimmt dann 24 statt 200 Teile, und niemand
       * merkt etwas). Ein Waechter, der rot wird, ist mehr wert.
       *
       * Gemessen wird deshalb nicht an Quadern, sondern am echten Starthaufen
       * (`ItemManager.spawnPile`, 150 gewuerfelte Teile mit den Formen des
       * Objektkatalogs): Der Arm faehrt hinein und packt zu.
       *
       * Gemessen 15.09.2026 (drei Saaten): 2 bis 4 Koerper erfuellen je Griff
       * die Bedingung, 2 bis 4 kommen mit, 160 bis 250 kg, aus 105 bis 123
       * Teilen. Der Grund fuer den Unterschied zum kuenstlichen Nest oben ist
       * die Groesse: Echter Schrott ist groesser als ein 25-cm-Wuerfel, es
       * passt schlicht weniger in den Korb.
       *
       * NACHGEMESSEN am 15.09.2026 nach E-061: 2 bis 5 Koerper erfuellen die
       * Bedingung, 4 bis 7 kommen mit, 480 bis 740 kg, aus 124 bis 142 Teilen.
       *
       * Der Grund ist NICHT die Greifbedingung — an ihr wurde nichts geaendert.
       * Es sind andere Wuerfel: Die Saat steht fest, der Katalog aber nicht.
       * E-061 hat die Couch von Mischschrott nach Kunststoff verschoben, und
       * damit verschieben sich alle Listenplaetze innerhalb dieser beiden
       * Fraktionen. `randomCargo` zieht mit derselben Zahlenfolge ab da andere
       * Stuecke — ein schwereres Sortiment, dieselbe Mechanik.
       *
       * Das ist die Schwaeche dieses Waechters: Seine Zahlen haengen am
       * Katalog, obwohl er die Greifbedingung bewachen soll. Der Deckel auf der
       * STUECKZAHL (8) ist der belastbare Teil und bleibt, wo er war — er sass
       * beim Nachmessen mit 7 von 8 knapp, und das ist ein ehrliches Signal.
       *
       * Die Schwellen liegen beim Doppelten des Gemessenen. Wer sie reissen
       * sieht, sucht den Fehler nicht hier, sondern in der Greifbedingung:
       * Sensorkugel, `insideGrapple`, `noetigeKrallen`.
       */
      for (const saat of [20260915, 4711, 99991]) {
        const r = starthaufenGriff(saat);
        expect(r.teile, "der Haufen ist gespawnt").toBeGreaterThan(90);
        expect(
          r.kandidaten,
          `${r.kandidaten} Koerper erfuellten gleichzeitig die Greifbedingung — gemessen sind 2 bis 4. Das riecht nach einem Fehler in der Bedingung, nicht nach einem fehlenden Deckel.`
        ).toBeLessThanOrEqual(8);
        expect(
          r.korb,
          `${r.korb} von ${r.teile} Teilen auf einmal gegriffen (${r.kg.toFixed(0)} kg)`
        ).toBeLessThanOrEqual(8);
        expect(
          r.kg,
          `${r.kg.toFixed(0)} kg an einem Griff — gemessen sind 480 bis 740 (E-061)`
        ).toBeLessThan(1500);
        expect(r.unterBoden, "ein Teil ist durch den Beton gesackt").toBe(0);
      }
    },
    300000
  );
});
