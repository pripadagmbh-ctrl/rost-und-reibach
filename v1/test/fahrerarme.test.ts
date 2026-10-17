/**
 * Wächter für die Arme des Fahrers (E-142, Patrick 17.10.2026: „die arme des
 * baggerfahrers sind verformt. es sollen wie echte Hände anmuten, die die
 * joysticks umschliessen").
 *
 * Verformt waren sie, weil Oberarm (an der Schulter) und Unterarm (am Hebel)
 * nichts voneinander wussten: Der Unterarm stach durch den Rumpf, der Ellbogen
 * hing 20 cm daneben. Diese Prüfungen halten fest, was jetzt gilt — für jede
 * Hebelstellung, nicht nur in Ruhe.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import { fahrerArme } from "../src/excavator/driver";

let scene: THREE.Scene;
let kabine: THREE.Group;
let hebel: THREE.Object3D[];
let folge: () => void;
let cx: number;

/** Griffmitte im Hebel — `kabinenParts.ts` `joystick()`. */
const GRIFFMITTE = new THREE.Vector3(0, 0.29, -0.012);
/** Hebelausschlag wie in `excavator.ts` (tilt = 0,35 je Achse). */
const KIPP = 0.35;
const STELLUNGEN: Array<[number, number]> = [];
for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) STELLUNGEN.push([a * KIPP, b * KIPP]);

beforeAll(async () => {
  leinwandAttrappe();
  await initPhysics();
  scene = new THREE.Scene();
  new Excavator(scene, new RAPIER.World({ x: 0, y: -9.81, z: 0 }));
  scene.updateMatrixWorld(true);
  /*
   * Eigene Kabine mit Hebeln an denselben Stellen wie im Bagger — so prüft der
   * Test die Arme unabhängig davon, ob `excavator.ts` sie schon selbst baut.
   */
  const fahrer = scene.getObjectByName("06_FAHRER")!;
  cx = fahrer.position.x;
  kabine = new THREE.Group();
  hebel = ["06_JOYSTICK_L", "06_JOYSTICK_R"].map((n) => {
    const p = new THREE.Group();
    p.position.copy(scene.getObjectByName(n)!.position);
    kabine.add(p);
    return p;
  });
  folge = fahrerArme(kabine, cx, fahrer.position.z, hebel);
});

function arme(): THREE.SkinnedMesh[] {
  return kabine.children.filter((o): o is THREE.SkinnedMesh => (o as THREE.SkinnedMesh).isSkinnedMesh);
}

function stelle(nick: number, roll: number): void {
  for (const h of hebel) h.rotation.set(nick, 0, roll);
  folge();
  kabine.updateMatrixWorld(true);
}

/** Weltlage aller Ecken, die an Knochen `k` hängen. */
function ecken(arm: THREE.SkinnedMesh, k: number): THREE.Vector3[] {
  const si = arm.geometry.getAttribute("skinIndex");
  const raus: THREE.Vector3[] = [];
  for (let i = 0; i < si.count; i++) {
    if (si.getX(i) !== k) continue;
    raus.push(arm.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(arm.matrixWorld));
  }
  return raus;
}

function hebelZu(arm: THREE.SkinnedMesh): THREE.Object3D {
  return arm.skeleton.bones[2]!.parent!;
}

describe("Arme des Fahrers (E-142)", () => {
  it("je Seite EIN Netz mit Schatten — so teuer wie vorher die Unterarme", () => {
    const a = arme();
    expect(a.map((m) => m.name).sort()).toEqual(["06_FAHRER_ARM_L", "06_FAHRER_ARM_R"]);
    for (const m of a) {
      expect(m.castShadow, m.name).toBe(true);
      expect((m.material as THREE.MeshStandardMaterial).vertexColors, m.name).toBe(true);
      expect(m.skeleton.bones.length, "Oberarm, Unterarm, Hand").toBe(3);
    }
  });

  it("kein Knoten auf dem Weg vom Arm bis zur Szene ist ungleich skaliert", () => {
    const pruefe = (o: THREE.Object3D | null): void => {
      for (; o; o = o.parent) {
        const s = o.scale;
        expect(Math.abs(s.x - s.y) + Math.abs(s.y - s.z), `${o.name || o.type}`).toBeLessThan(1e-9);
      }
    };
    for (const m of arme()) {
      pruefe(m);
      for (const b of m.skeleton.bones) pruefe(b);
    }
    // … und im echten Bagger vom Hebel bis zur Szene
    for (const n of ["06_JOYSTICK_L", "06_JOYSTICK_R", "06_FAHRER"]) pruefe(scene.getObjectByName(n)!);
  });

  it("die Handmitte sitzt in jeder Hebelstellung am Griff (< 3 cm)", () => {
    for (const [nick, roll] of STELLUNGEN) {
      stelle(nick, roll);
      for (const arm of arme()) {
        const e = ecken(arm, 2);
        const mitte = e.reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(1 / e.length);
        const griff = hebelZu(arm).localToWorld(GRIFFMITTE.clone());
        expect(mitte.distanceTo(griff), `${arm.name} bei ${nick}/${roll}`).toBeLessThan(0.03);
      }
    }
    stelle(0, 0);
  });

  it("die Finger umschließen den Griff — mindestens drei Viertel rundum", () => {
    stelle(0, 0);
    for (const arm of arme()) {
      const h = hebelZu(arm);
      const sektoren = new Set<number>();
      for (const v of ecken(arm, 2)) {
        // in den Griffraum: Hebel-lokal, dann um die Griffmitte
        const p = h.worldToLocal(v.clone()).sub(GRIFFMITTE);
        p.applyAxisAngle(new THREE.Vector3(1, 0, 0), 0.22);
        const r = Math.hypot(p.x, p.z);
        if (Math.abs(p.y) > 0.04 || r > 0.085) continue;
        sektoren.add(Math.floor(((Math.atan2(p.z, p.x) + 2 * Math.PI) % (2 * Math.PI)) / (Math.PI / 6)));
      }
      expect(sektoren.size, `${arm.name}: 30°-Sektoren mit Hand`).toBeGreaterThanOrEqual(9);
    }
  });

  it("Ober- und Unterarm behalten ihre Länge und bleiben an der Hand", () => {
    stelle(0, 0);
    const ruhe = arme().map((arm) => {
      const [ober, unter, hand] = arm.skeleton.bones as [THREE.Bone, THREE.Bone, THREE.Bone];
      // Unterarmlänge = weiteste Ecke des Unterarms im Knochenraum (Bind = Einheit)
      const pos = arm.geometry.getAttribute("position");
      const si = arm.geometry.getAttribute("skinIndex");
      let len = 0;
      for (let i = 0; i < pos.count; i++) if (si.getX(i) === 1) len = Math.max(len, pos.getY(i));
      const spitze = (): THREE.Vector3 => hand.worldToLocal(unter.localToWorld(new THREE.Vector3(0, len, 0)));
      return { ober, unter, oberLen: ober.position.distanceTo(unter.position), spitze, an: spitze() };
    });
    for (const [nick, roll] of STELLUNGEN) {
      stelle(nick, roll);
      for (const r of ruhe) {
        expect(r.ober.position.distanceTo(r.unter.position), `Oberarm bei ${nick}/${roll}`).toBeCloseTo(
          r.oberLen,
          3
        );
        // Das Ärmelende sitzt immer an derselben Stelle im Handschuh
        expect(r.spitze().distanceTo(r.an), `Handgelenk bei ${nick}/${roll}`).toBeLessThan(0.003);
      }
    }
    stelle(0, 0);
  });

  it("der Ellbogen hängt unter der Schulter und neben dem Rumpf", () => {
    for (const [nick, roll] of STELLUNGEN) {
      stelle(nick, roll);
      for (const arm of arme()) {
        const [ober, unter] = arm.skeleton.bones as [THREE.Bone, THREE.Bone];
        expect(unter.position.y, `${arm.name} Ellbogen zu hoch`).toBeLessThan(ober.position.y - 0.15);
        // Rumpf: Sechskant r 0,175 um die Sitzmitte, Ärmel r 0,05
        expect(Math.abs(unter.position.x - cx), `${arm.name} Ellbogen im Rumpf`).toBeGreaterThan(0.225);
      }
    }
    stelle(0, 0);
  });
});
