/**
 * DIE ZIELMARKE (E-162, 19.10.2026).
 *
 * Konzept: „eine Markierung am Ziel". Je Punkt aus `challenge:stand.marken`
 * schwebt ein nach unten zeigender Kegel ueber dem Punkt und liegt ein Ring
 * darauf: gelb ueber dem Teil, gruen ueber der Zielmulde (Farbe ist nicht der
 * einzige Kanal — der Kartentext nennt Teil und Mulde beim Namen).
 *
 * Sichtbar auch hinter einer Wand (`depthTest: false`, zuletzt gezeichnet):
 * Wer die Mulde nicht im Bild hat, soll trotzdem sehen, wohin.
 *
 * Sparsam: zwei Geometrien und zwei Materialien fuer alle Marken, einmal
 * angelegt. Je Marke zwei Netze (Kegel + Ring) = hoechstens zwei
 * Zeichenaufrufe; die Netze werden in einem Vorrat wiederverwendet, je Bild
 * wird nichts neu angelegt. Haengt nur am Bus.
 */
import * as THREE from "three";
import type { EventBus } from "../core/events";

/** Hoehe der Kegelspitze ueber dem Punkt (m). SW: ueber einem Auto (1,5 m) noch frei sichtbar. */
const SCHWEBE_M = 2.2;
/** Wippen: Ausschlag (m) und Takt (Hz). SW: ruhig genug, dass es nicht nervoes wirkt. */
const WIPP_M = 0.18;
const WIPP_HZ = 0.9;
/** Ring knapp ueber dem Punkt (m), damit er nicht im Boden flimmert. SW */
const RING_UEBER_M = 0.08;

const FARBE = { teil: 0xf0c020, ziel: 0x4fd06a } as const; // SW: Gelb wie die Karte, Gruen wie ✓

export interface Zielmarke {
  /** Alle Marken weg (auch von aussen, z. B. vor einem Neuaufbau). */
  leeren(): void;
}

export function installZielmarke(scene: THREE.Scene, bus: EventBus): Zielmarke {
  // Kegel: Spitze nach unten (ConeGeometry zeigt nach +y). Masse SW: aus 10 m Abstand gut zu sehen.
  const kegelGeo = new THREE.ConeGeometry(0.32, 0.75, 16);
  kegelGeo.rotateX(Math.PI);
  kegelGeo.translate(0, 0.375, 0); // Ursprung = Spitze
  const ringGeo = new THREE.TorusGeometry(0.6, 0.06, 8, 40);
  ringGeo.rotateX(Math.PI / 2);
  const material = (farbe: number): THREE.MeshBasicMaterial =>
    new THREE.MeshBasicMaterial({
      color: farbe,
      transparent: true,
      opacity: 0.85,
      depthTest: false,
      depthWrite: false,
      fog: false,
    });
  const mat = { teil: material(FARBE.teil), ziel: material(FARBE.ziel) };

  const vorrat: Array<{ kegel: THREE.Mesh; ring: THREE.Mesh }> = [];
  const neueMarke = (): { kegel: THREE.Mesh; ring: THREE.Mesh } => {
    const kegel = new THREE.Mesh(kegelGeo, mat.teil);
    const ring = new THREE.Mesh(ringGeo, mat.teil);
    for (const n of [kegel, ring]) {
      n.renderOrder = 999; // nach allem anderen, damit sie ueber Waenden liegt
      n.frustumCulled = false;
      n.visible = false;
      n.matrixAutoUpdate = true;
      scene.add(n);
    }
    const m = { kegel, ring };
    vorrat.push(m);
    return m;
  };

  let sichtbar = 0;
  const leeren = (): void => {
    for (let i = 0; i < sichtbar; i++) {
      vorrat[i]!.kegel.visible = false;
      vorrat[i]!.ring.visible = false;
    }
    sichtbar = 0;
  };
  let aus = false;

  bus.on("challenge:start", () => {
    aus = false;
    leeren();
  });
  bus.on("challenge:stand", (e) => {
    if (aus) return;
    const t = performance.now() / 1000;
    const wipp = WIPP_M * Math.sin(2 * Math.PI * WIPP_HZ * t);
    const n = e.marken.length;
    for (let i = 0; i < n; i++) {
      const p = e.marken[i]!;
      const mk = vorrat[i] ?? neueMarke();
      const m = mat[p.art];
      if (mk.kegel.material !== m) {
        mk.kegel.material = m;
        mk.ring.material = m;
      }
      mk.kegel.position.set(p.x, p.y + SCHWEBE_M + wipp, p.z);
      mk.ring.position.set(p.x, p.y + RING_UEBER_M, p.z);
      mk.kegel.visible = true;
      mk.ring.visible = true;
    }
    for (let i = n; i < sichtbar; i++) {
      vorrat[i]!.kegel.visible = false;
      vorrat[i]!.ring.visible = false;
    }
    sichtbar = n;
  });
  bus.on("challenge:geschafft", () => {
    aus = true;
    leeren();
  });

  return { leeren };
}
