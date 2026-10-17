/**
 * Wächter für die Kabine — Paket 7 aus E-025.
 *
 * DIE KABINE IST PATRICKS ARBEITSPLATZ. Die Kabinenansicht (Taste C) braucht
 * er zum Sortieren; alles daran ist am 29.08.2026 eingestellt worden — der
 * Blick durch die Fußscheibe senkrecht nach unten auf den Greifer, die
 * Dachscheibe zum Ausleger, die Lage der Konsolen, der Augpunkt.
 *
 * Dieses Paket fasst 25 Netze zu fünf zusammen und hängt Anbauteile an. Es
 * darf KEIN Maß verschieben. Genau das prüft dieser Wächter: Jede Scheibe,
 * jede Säule und der Sitz stehen noch da, wo sie am 14.09.2026 standen.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import { DISPLAY_LAGE } from "../src/excavator/instruments";

let scene: THREE.Scene;

beforeAll(async () => {
  leinwandAttrappe();
  await initPhysics();
  scene = new THREE.Scene();
  new Excavator(scene, new RAPIER.World({ x: 0, y: -9.81, z: 0 }));
});

function finde(name: string): THREE.Object3D {
  const o = scene.getObjectByName(name);
  if (!o) throw new Error(`${name} nicht gefunden`);
  return o;
}

/** Alle Netze, die direkt im Kabinenschlitten hängen. */
function kabinenNetze(): string[] {
  const k = finde("06_KABINE");
  const raus: string[] = [];
  // E-142: die Fahrerarme (`06_FAHRER_ARM_*`) haengen als SkinnedMesh direkt am Schlitten — eigene Waechter in `fahrerarme.test.ts`
  for (const kind of k.children) if (kind instanceof THREE.Mesh && !(kind instanceof THREE.SkinnedMesh)) raus.push(kind.name);
  return raus.sort();
}

/** Ein Punkt liegt in der Geometrie, wenn ein Eckpunkt nah genug ist. */
function hatPunkt(m: THREE.Mesh, x: number, y: number, z: number, toleranz = 0.02): boolean {
  const pos = (m.geometry as THREE.BufferGeometry).getAttribute(
    "position"
  ) as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    if (
      Math.abs(pos.getX(i) - x) < toleranz &&
      Math.abs(pos.getY(i) - y) < toleranz &&
      Math.abs(pos.getZ(i) - z) < toleranz
    ) {
      return true;
    }
  }
  return false;
}

/** Kabinenmitte — unverändert seit dem Design-Fix vom 29.08.2026. */
const CX = -1.05;
const CZ = 0.6;

describe("Kabine", () => {
  it("besteht aus fünf Netzen, die Joysticks aus zweien je Seite", () => {
    /*
     * Direkt im Schlitten hängen vier Netze; das fünfte ist die Leinwand des
     * Bordinstruments (sie sitzt in ihrer eigenen kleinen Gruppe, weil sie
     * gedreht und geneigt ist). Fahrer, Joysticks und Hände hängen ebenfalls
     * darunter, haben aber ihre eigenen Wächter.
     */
    expect(kabinenNetze(), "Netze im Kabinenschlitten").toEqual([
      "06_KABINE_LACK",
      "06_KABINE_STAHL",
      "06_SCHEIBEN",
      "06_SITZ",
      // Das Namensschild an der Tür gehört zu den Kleinteilen (08) und fährt
      // mit der Kabine hoch. Es trägt eine eigene Leinwandtextur.
      "08_NAMENSSCHILD",
    ]);
    expect(finde("06_DISPLAY_BILD"), "Leinwand des Bordinstruments").toBeDefined();
    for (const seite of ["R", "L"]) {
      const j = finde(`06_JOYSTICK_${seite}`);
      const namen = j.children.filter((o) => o instanceof THREE.Mesh).map((o) => o.name);
      // E-142: die Hand ist kein eigenes Netz am Hebel mehr, sie gehoert zum Fahrerarm (Knochen am Hebel)
      expect(namen.sort(), `Joystick ${seite} — vorher sieben plus drei`).toEqual([`06_JOYSTICK_${seite}_HEBEL`]);
    }
  });

  it("alle sechs Scheiben stehen, wo sie standen", () => {
    /*
     * Gemessen an den Eckpunkten des verschmolzenen Glasnetzes. Die vier
     * senkrechten Scheiben lassen sich an ihren Mitten festmachen; für die
     * geneigte Fuß- und Dachscheibe genügt die Höhe ihrer Vorderkante.
     *
     * Die Fußscheibe ist die wichtigste: Durch sie sieht der Fahrer senkrecht
     * nach unten auf den Greifer (Design-Wunsch 29.08.2026).
     */
    const glas = finde("06_SCHEIBEN") as THREE.Mesh;
    const ecken: Array<[number, number, number, string]> = [
      [CX + 0.5, 1.28 + 0.76, CZ + 0.705, "Frontscheibe oben links"],
      [CX - 0.5, 1.33 - 0.71, CZ - 0.705, "Heckscheibe unten rechts"],
      [CX - 0.555, 1.33 + 0.71, CZ + 0.65, "rechte Scheibe oben vorn"],
      [CX + 0.555, 1.33 - 0.71, CZ - 0.65, "linke Scheibe unten hinten"],
    ];
    for (const [x, y, z, was] of ecken) {
      expect(hatPunkt(glas, x, y, z), `${was} verschoben`).toBe(true);
    }
    // Die Verglasung ist beidseitig — der Fahrer sitzt dahinter
    const mat = glas.material as THREE.MeshStandardMaterial;
    expect(mat.side, "Glas nur einseitig — man sähe hindurch ins Leere").toBe(THREE.DoubleSide);
    expect(mat.transparent, "Glas ist nicht durchsichtig").toBe(true);
  });

  it("die vier Säulen und das Dach stehen, wo sie standen", () => {
    const lack = finde("06_KABINE_LACK") as THREE.Mesh;
    for (const [px, pz] of [
      [-0.52, -0.66],
      [0.52, -0.66],
      [-0.52, 0.66],
      [0.52, 0.66],
    ] as const) {
      expect(
        hatPunkt(lack, CX + px + 0.04, 1.33 + 0.725, CZ + pz + 0.04),
        `Säule ${px},${pz} verschoben`
      ).toBe(true);
    }
    expect(hatPunkt(lack, CX + 0.6, 2.145, CZ - 0.32 + 0.425), "Dachkante").toBe(true);
  });

  it("Sitz, Konsolen und Display stehen, wo sie standen", () => {
    const sitz = finde("06_SITZ") as THREE.Mesh;
    expect(hatPunkt(sitz, CX + 0.25, 1.01, CZ - 0.2 + 0.25), "Sitzfläche vorn links").toBe(true);
    expect(hatPunkt(sitz, CX + 0.25, 1.3 + 0.31, CZ - 0.48 + 0.05), "Lehne oben links").toBe(true);
    const stahl = finde("06_KABINE_STAHL") as THREE.Mesh;
    expect(hatPunkt(stahl, CX + 0.36 + 0.08, 1.02 + 0.14, CZ + 0.02 + 0.22), "linke Konsole").toBe(
      true
    );
    // Die Leinwand des Bordinstruments bleibt eigen — sie trägt eine Textur
    const bild = finde("06_DISPLAY_BILD");
    const halter = bild.parent!;
    expect(halter.position.x, "Display x").toBeCloseTo(CX + DISPLAY_LAGE.dx, 6);
    expect(halter.position.y, "Display y").toBeCloseTo(DISPLAY_LAGE.y, 6);
    expect(halter.position.z, "Display z").toBeCloseTo(CZ + DISPLAY_LAGE.dz, 6);
  });

  it("das Displaygehäuse sitzt genau vor der Leinwand", () => {
    /*
     * Gehäuse und Bild standen bis zum 15.09.2026 in derselben Gruppe. Jetzt
     * liegt das Gehäuse im Stahl-Netz der Kabine und die Leinwand in ihrer
     * eigenen Gruppe — zwei Stellen, eine Zahl (`DISPLAY_LAGE`). Geht das
     * auseinander, hängt der Rahmen neben dem Bild.
     */
    const bild = finde("06_DISPLAY_BILD") as THREE.Mesh;
    bild.updateWorldMatrix(true, false);
    const mitte = new THREE.Vector3(0, 0, 0).applyMatrix4(bild.matrixWorld);
    const stahl = finde("06_KABINE_STAHL") as THREE.Mesh;
    stahl.updateWorldMatrix(true, false);
    const pos = (stahl.geometry as THREE.BufferGeometry).getAttribute(
      "position"
    ) as THREE.BufferAttribute;
    const p = new THREE.Vector3();
    let naechster = Infinity;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(stahl.matrixWorld);
      naechster = Math.min(naechster, p.distanceTo(mitte));
    }
    // Die nächste Gehäuseecke liegt eine halbe Rahmendiagonale entfernt
    expect(naechster, "Gehäuse zu weit vom Bild").toBeLessThan(0.25);
  });

  it("die Kabine hat jetzt Tür, Spiegel und Wischer", () => {
    /*
     * Der Kipper hat Türfuge, Griff, Tritte und Außenspiegel
     * (`delivery/vehicleModel.ts`); die Baggerkabine war ein Glaskasten mit
     * vier Säulen. Geprüft wird über die Ausdehnung: Der Spiegel steht weiter
     * außen als jede Säule, die Trittstufe tiefer als das Bodenblech.
     */
    const lack = finde("06_KABINE_LACK") as THREE.Mesh;
    const geo = lack.geometry as THREE.BufferGeometry;
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    expect(bb.min.y, "nichts reicht unter die Trittstufe").toBeLessThan(0.45);
    const stahl = finde("06_KABINE_STAHL") as THREE.Mesh;
    (stahl.geometry as THREE.BufferGeometry).computeBoundingBox();
    const bs = (stahl.geometry as THREE.BufferGeometry).boundingBox!;
    expect(bs.max.x - CX, "Spiegel steht nicht über die Kabine hinaus").toBeGreaterThan(0.6);
  });

  it("der Augpunkt der Kabinenkamera ist unverändert", () => {
    /*
     * y 3,28 und z 0,20 bei unten stehender Kabine (Konzept Abschnitt 5). Die
     * Kabinenansicht ist Patricks Arbeitsplatz; sie wird erst vom letzten
     * Paket (Kabinenhub) berührt, nicht von diesem.
     */
    const auge = finde("06_AUGPUNKT");
    expect(auge.position.y + 1.6, "Augpunkt über Grund").toBeCloseTo(3.28, 2);
  });
});
