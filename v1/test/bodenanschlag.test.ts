/**
 * Waechter fuer den Bodenanschlag — steht die Spinne still, waehrend sie
 * zupackt? (E-046, 15.09.2026)
 *
 * Der Anschlag haelt die Krallenspitzen ueber dem Beton. Bis heute rechnete er
 * mit der MOMENTANSTELLUNG der Schalen. Weil die geschlossene Kralle 2,95 m
 * tief reicht und die offene nur 2,44 m, setzte die offene Spinne so tief auf,
 * dass sie beim Zudruecken in den Beton geraten waere — also hob der Anschlag
 * den Arm waehrend des Schliessens nach.
 *
 * Gemessen am kopflosen Bagger: Die Spinne stieg beim Zupacken um 0,548 m und
 * wanderte 0,513 m zur Seite. Sie zog sich in genau den Bildern unter dem Teil
 * weg, in denen sie zufassen soll.
 *
 * Jetzt rechnet der Anschlag ueber den GANZEN Schliessweg (`CLAW_MAX_DEPTH`).
 * Der Preis steht als eigene Pruefung weiter unten: Die offene Spinne haengt
 * beim Absetzen rund 0,56 m hoeher. Beides gehoert zusammen — wer die eine
 * Zahl aendert, sieht die andere.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { GripSystem } from "../src/physics/gripSystem";
import { initPhysics } from "../src/physics/physicsWorld";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";

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

const DT = 1 / 60;

beforeAll(async () => {
  leinwandAttrappe();
  await initPhysics();
});

interface Absetzlauf {
  /** Hoehe der Spinnenmitte ueber dem Beton, nachdem der Arm aufgesetzt hat */
  absetzhoehe: number;
  /** Hoehe der Spitzen der OFFENEN Spinne ueber dem Beton */
  spitzenOffen: number;
  /** Wie weit die Spinne beim Zupacken steigt (m) */
  hub: number;
  /** Wie weit sie dabei zur Seite wandert (m) */
  seitwaerts: number;
  /** Tiefster Punkt, den eine Spitze waehrend des Griffs erreicht (m ueber Beton) */
  tiefsteSpitze: number;
}

/** Arm absetzen, dann zupacken — und dabei die Spinne beobachten. */
function absetzenUndZupacken(): Absetzlauf {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  const bagger = new Excavator(new THREE.Scene(), world);
  const grip = new GripSystem(world, bagger.grappleBody);
  grip.insideGrapple = (p) => bagger.isInsideGrapple(p);
  grip.krallenKontakte = (b) => bagger.krallenKontakte(b);
  const tasten = new Tasten();
  const sensor = new THREE.Vector3();
  const takt = (): void => {
    bagger.update(DT, tasten as never);
    grip.update(bagger.closure, bagger.closing, bagger.getSensorPosition(sensor), DT);
    world.step();
  };
  tasten.down.add("KeyF"); // Ausleger ab
  tasten.down.add("KeyG"); // Stiel ab
  for (let i = 0; i < 260; i++) takt();
  tasten.down.clear();
  for (let i = 0; i < 30; i++) takt();
  const ab = bagger.grappleGroup.position.clone();

  tasten.down.add("Space");
  let hoch = ab.y;
  let seitwaerts = 0;
  let tiefsteSpitze = Infinity;
  for (let i = 0; i < 80; i++) {
    takt();
    const p = bagger.grappleGroup.position;
    hoch = Math.max(hoch, p.y);
    seitwaerts = Math.max(seitwaerts, Math.hypot(p.x - ab.x, p.z - ab.z));
    tiefsteSpitze = Math.min(tiefsteSpitze, p.y - bagger.greiferform.tiefe(bagger.splay));
  }
  world.free();
  return {
    absetzhoehe: ab.y,
    spitzenOffen: ab.y - bagger.greiferform.tiefe(bagger.greiferform.offen),
    hub: hoch - ab.y,
    seitwaerts,
    tiefsteSpitze,
  };
}

describe("Bodenanschlag — die Spinne steht still, waehrend sie zupackt", () => {
  it(
    "hebt den Arm beim Schliessen nicht mehr an",
    () => {
      const r = absetzenUndZupacken();
      // Vorher 0,548 m. Die Schwelle ist bewusst klein: Es geht nicht um
      // „weniger", sondern um „gar nicht" — der Arm soll stehen.
      expect(r.hub, `die Spinne steigt beim Zupacken um ${r.hub.toFixed(3)} m`).toBeLessThan(0.05);
      // Vorher 0,513 m. Der Anschlag schiebt ueber Ausleger UND Stiel nach,
      // deshalb wandert die Spinne beim Nachheben auch nach vorn.
      expect(
        r.seitwaerts,
        `die Spinne wandert beim Zupacken ${r.seitwaerts.toFixed(3)} m zur Seite`
      ).toBeLessThan(0.05);
    },
    120000
  );

  it(
    "und die Schalen kommen beim Schliessen trotzdem auf den Beton",
    () => {
      // Sonst waere der stillstehende Arm teuer erkauft: Was auf dem Boden
      // liegt, muss weiter zwischen die Schalen kommen. Gemessen 0,013 m.
      const r = absetzenUndZupacken();
      expect(
        r.tiefsteSpitze,
        `tiefster Punkt einer Spitze waehrend des Griffs: ${r.tiefsteSpitze.toFixed(3)} m ueber dem Beton`
      ).toBeLessThan(0.05);
    },
    120000
  );

  it(
    "der Preis, als Zahl: die offene Spinne haengt um den Unterschied offen ↔ tiefste Stellung hoeher",
    () => {
      /*
       * Kein Fehler, sondern die andere Seite derselben Entscheidung — und
       * deshalb als Zahl festgehalten und nicht als Nebensatz: Weil der
       * Anschlag mit der groessten Tiefe ueber den ganzen Weg rechnet, steht
       * die OFFENE Spinne genau um den Unterschied hoeher, den offen und
       * tiefste Stellung ausmachen.
       */
      /*
       * E-155: gemessen am Fuenfschalengreifer, der Grundausstattung. Mit der
       * Sichelkralle waren es 0,557 m, mit ihm sind es 0,527 m.
       */
      const r = absetzenUndZupacken();
      const f = FUENFSCHALEN;
      const erwartet = f.maxTiefe - f.tiefe(f.offen);
      expect(erwartet).toBeCloseTo(0.527, 2);
      expect(
        r.spitzenOffen,
        `die offenen Spitzen stehen ${r.spitzenOffen.toFixed(3)} m ueber dem Beton`
      ).toBeCloseTo(erwartet, 1);
    },
    120000
  );
});
