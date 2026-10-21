/**
 * LEKTION 3, SCHRITT 5 — DIE BODENMARKE IST AUS DER STARTKAMERA ZU SEHEN
 * (L1b, Geraetebefund 21.10.2026: Die Marke 1,2 m vor dem Bagger lag hinter
 * dem Oberwagen und erschien als Ring auf dem Kabinendach).
 *
 * Echter Bagger in Startlage, echte `OrbitCamera` auf ihrem Startpunkt, die
 * Marke so, wie `LektionLauf` sie beim Beginn des Schritts legt. Geprueft:
 *   - jeder Ringpunkt liegt im Bild (iPad quer, iPhone mini quer);
 *   - kein Strahl von der Kamera zu einem Ringpunkt trifft ein Netz des
 *     Baggers (`bildwurzeln()`: Unter-, Oberwagen, Ausleger, Spinne).
 * Gegenprobe: die alte Lage (−1,2 m geradeaus) ist verdeckt.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { EventBus } from "../src/core/events";
import { LektionLauf, type LektionZiel } from "../src/challenges/lektion";
import { LEKTIONEN } from "../src/challenges/lehrgang";
import { lektionQuellen } from "../src/challenges/quellen";
import { OrbitCamera } from "../src/excavator/orbitCamera";
import { FASSUNGEN } from "./cssmass";
import { DT, platzLeinwand, werkbank } from "./aufgabenwerkbank";

const L3 = LEKTIONEN.find((l) => l.id === "ausleger-stiel")!;
const S5 = L3.schritte[4]!;

/** Ringpunkte (Halbmesser wie gezeichnet, `ui/zielmarke.ts` RING_UEBER_M) und ihre Sichtbarkeit */
function blick(ziel: LektionZiel): { verdeckt: number; raus: Record<string, number>; n: number } {
  const k = werkbank();
  const b = k.b;
  for (let i = 0; i < 30; i++) k.takt(); // Spinne auspendeln lassen
  const orbit = new OrbitCamera(1);
  const kam = { orbitDX: 0, orbitDY: 0, zoomFactor: 1, camReset: false, shiftHeld: false, wheelDelta: 0, wasPressed: () => false };
  // Ziel wie main.ts (`getCameraTarget`); die Kamera zieht weich nach — 5 s reichen
  for (let i = 0; i < 300; i++) orbit.update(DT, kam as never, (o) => b.getCameraTarget(o), (o) => (o.copy(b.position).setY(3), b.cabinBaseYaw));

  const lauf = new LektionLauf({ ...L3, schritte: [{ ...S5, ziel }] }, 3, 12, lektionQuellen({ bagger: b, kamera: orbit }), new EventBus());
  lauf.start();
  const m = lauf.marke!;

  const netze: THREE.Object3D[] = [];
  for (const w of b.bildwurzeln()) {
    w.updateWorldMatrix(true, true);
    w.traverse((o) => (o as THREE.Mesh).isMesh && netze.push(o));
  }
  const cam = orbit.camera;
  const rc = new THREE.Raycaster();
  const N = 32;
  let verdeckt = 0;
  const raus: Record<string, number> = {};
  const punkte = Array.from({ length: N }, (_, i) => {
    const a = (i / N) * 2 * Math.PI;
    return new THREE.Vector3(m.x + m.radiusM * Math.cos(a), m.y + 0.08, m.z + m.radiusM * Math.sin(a));
  });
  for (const f of FASSUNGEN.filter((f) => f.w > f.h)) {
    orbit.resize(f.w / f.h);
    cam.updateMatrixWorld(true);
    raus[f.name] = punkte.filter((p) => {
      const q = p.clone().project(cam);
      return Math.abs(q.x) > 1 || Math.abs(q.y) > 1 || q.z > 1;
    }).length;
  }
  for (const p of punkte) {
    const d = p.clone().sub(cam.position);
    rc.set(cam.position, d.clone().normalize());
    rc.far = d.length() - 0.02;
    if (rc.intersectObjects(netze, false).length > 0) verdeckt++;
  }
  return { verdeckt, raus, n: N };
}

describe("Lektion 3, Schritt 5: Bodenmarke aus der Startkamera", () => {
  beforeAll(async () => {
    platzLeinwand();
    await RAPIER.init();
  });

  it("der Ring liegt ganz im Bild und frei von Oberwagen und Ausleger", () => {
    expect(S5.ziel.art).toBe("marke");
    const e = blick(S5.ziel);
    for (const [name, n] of Object.entries(e.raus)) expect(n, `${name}: Ringpunkte ausserhalb`).toBe(0);
    expect(e.verdeckt, "Ringpunkte hinter dem Bagger").toBe(0);
  }, 60_000);

  it("Gegenprobe: die alte Lage, 1,2 m geradeaus heran, ist verdeckt", () => {
    const e = blick({ art: "marke", radialM: -1.2, radiusM: 0.5 });
    expect(e.verdeckt).toBeGreaterThan(e.n / 2);
  }, 60_000);
});
