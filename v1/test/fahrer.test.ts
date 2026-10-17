/**
 * Wächter für den Fahrer — Paket 1 aus E-025, Frage 4 von Patrick am
 * 15.09.2026 bejaht (Warnjacke, eckige Schultern).
 *
 * Zwei Dinge können hier still verlorengehen:
 *
 *  1. DER PREIS. Daniel kostete 16 Netze und 4 648 Dreiecke — 30 % der ganzen
 *     Maschine für eine Figur, die von außen so groß ist wie eine Hand. Wer
 *     ihm ein Detail als eigenes Mesh anhängt, macht das rückgängig.
 *  2. DIE KABINENANSICHT. `setFirstPerson` blendet eine Liste von Körperteilen
 *     aus. Stünde da ein Netz zu wenig, säße dem Fahrer in der Ego-Sicht sein
 *     eigener Kopf im Bild; stünde eins zu viel darin, verschwänden die
 *     Unterarme an den Joysticks.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";

let bagger: Excavator;
let scene: THREE.Scene;

beforeAll(async () => {
  leinwandAttrappe();
  await initPhysics();
  scene = new THREE.Scene();
  bagger = new Excavator(scene, new RAPIER.World({ x: 0, y: -9.81, z: 0 }));
});

function fahrerTeile(): THREE.Mesh[] {
  const g = scene.getObjectByName("06_FAHRER")!;
  const raus: THREE.Mesh[] = [];
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) raus.push(o);
  });
  return raus;
}

describe("Fahrer Daniel", () => {
  it("besteht aus genau zwei Netzen: Haut und Kleidung", () => {
    expect(
      fahrerTeile()
        .map((m) => m.name)
        .sort(),
      "vorher waren es 16"
    ).toEqual(["06_FAHRER_HAUT", "06_FAHRER_KLEIDUNG"]);
  });

  it("nur die Kleidung wirft Schatten", () => {
    /*
     * Jedes schattenwerfende Netz wird zweimal gezeichnet. Der Kopf liegt in
     * der Silhouette der Jacke; sein Schatten wäre nicht zu sehen. Vorher
     * warfen alle 16 Teile Schatten — 32 Zeichenrufe für eine Figur hinter
     * getöntem Glas.
     */
    for (const m of fahrerTeile()) {
      expect(m.castShadow, `${m.name}`).toBe(m.name.endsWith("_KLEIDUNG"));
    }
  });

  it("die Kleidung trägt ihre Farben an den Ecken, nicht am Material", () => {
    /*
     * Fünf Farben (Warnorange, Reflexweiß, Hose, Stiefel, Haar) in EINEM Netz
     * — das geht nur über `vertexColors`. Fehlt das Attribut, ist die Figur
     * einfarbig weiß; fehlt das Materialflag, ist sie einfarbig orange.
     */
    const k = scene.getObjectByName("06_FAHRER_KLEIDUNG") as THREE.Mesh;
    expect(k.geometry.getAttribute("color"), "Eckfarben fehlen").toBeDefined();
    const mat = k.material as THREE.MeshStandardMaterial;
    expect(mat.vertexColors, "Material liest die Eckfarben nicht").toBe(true);
    expect(mat.color.getHex(), "Material muss weiß sein, sonst färbt es alles ein").toBe(0xffffff);
  });

  it("trägt Warnkleidung — es kommt mehr als eine Farbe vor", () => {
    const k = scene.getObjectByName("06_FAHRER_KLEIDUNG") as THREE.Mesh;
    const a = k.geometry.getAttribute("color") as THREE.BufferAttribute;
    const gefunden = new Set<string>();
    for (let i = 0; i < a.count; i++) {
      gefunden.add(`${a.getX(i).toFixed(3)},${a.getY(i).toFixed(3)},${a.getZ(i).toFixed(3)}`);
    }
    expect(gefunden.size, "Zahl der Farben an der Kleidung").toBeGreaterThanOrEqual(4);
  });

  it("die Ego-Sicht blendet genau diese zwei Netze aus", () => {
    const teile = fahrerTeile();
    bagger.setFirstPerson(true);
    for (const m of teile) expect(m.visible, `${m.name} in der Kabinensicht`).toBe(false);
    /*
     * Unterarm, Faust und Daumen hängen am Joystick und liegen seit dem
     * Kabinen-Paket in EINEM Netz je Seite (`06_FAHRER_HAND_R/L`). Sie stehen
     * nicht in der Liste und bleiben in der Kabinenansicht sichtbar — sonst
     * hätte der Fahrer keine Hände an den Hebeln.
     */
    for (const s of ["R", "L"]) {
      // E-142: die Arme heißen `06_FAHRER_ARM_*`, sobald `excavator.ts` sie baut.
      // ponytail: die Ausweichsuche nach `_HAND_` fällt mit diesem Einbau weg.
      const arm =
        scene.getObjectByName(`06_FAHRER_ARM_${s}`) ?? scene.getObjectByName(`06_FAHRER_HAND_${s}`)!;
      expect(arm.visible, `Hand ${s} verschwunden`).toBe(true);
    }
    bagger.setFirstPerson(false);
    for (const m of teile) expect(m.visible, `${m.name} von außen`).toBe(true);
  });

  it("er sitzt weiter da, wo er saß", () => {
    /*
     * Der Augpunkt der Kabinenkamera liegt bei y 3,28 und ist nicht Gegenstand
     * dieses Pakets. Daniel darf sich deshalb nicht verschieben — sonst säße
     * er plötzlich im Bild oder unter dem Sitz.
     */
    const haut = scene.getObjectByName("06_FAHRER_HAUT") as THREE.Mesh;
    haut.geometry.computeBoundingBox();
    const bb = haut.geometry.boundingBox!;
    // Kopfoberkante lokal, unverändert gegenüber dem 14.09.2026
    expect(bb.max.y, "Kopfoberkante").toBeCloseTo(1.999, 2);
    expect(scene.getObjectByName("06_FAHRER")!.position.x, "Sitzmitte x").toBeCloseTo(-1.05, 6);
  });
});
