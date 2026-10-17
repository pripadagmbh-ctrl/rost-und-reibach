/**
 * Was in der Presskammer steht, muss man sehen — und die offene Spinne muss
 * daran vorbei.
 *
 * Befund Patrick (`docs/offene-punkte.md`, aus seinem Gerätetest): „Gelbes
 * Anbauteil der Presse verdeckt die Ballen und stört beim Greifen."
 *
 * Gemessen am 15.09.2026: Gelb war an der Maschine nichts mehr — die drei
 * gelben Stücke sind am 12.09. auf seine Ansage hin entfernt worden. Im Weg
 * stand etwas anderes, und zwar etwas, das man gar nicht sehen konnte: die
 * **zweite Deckelklappe**. Ihre vier Netze waren seit dem 12.09. auf
 * `visible = false` gesetzt und ihre Platte auf einen Millimeter geschrumpft,
 * ihr Kollider aber blieb in voller Größe stehen — 4,45 × 2,16 m, im
 * Ruhezustand auf x −6,88 bis −4,83 und damit **0,905 m weit in der
 * Kammermündung**, genau auf der Seite, von der die Spinne kommt.
 *
 * Deshalb prüft diese Datei zweierlei, und beides an den Zahlen der laufenden
 * Maschine statt an abgeschriebenen Maßen:
 *
 *  1. Jeder Kollider, der in die Kammermündung ragt, hat ein **sichtbares**
 *     Netz an derselben Stelle. Ein Hindernis, das man nicht sieht, kann der
 *     Spieler nicht einmal beschreiben.
 *  2. Die **offene Sichelkralle passt durch die Mündung** — am geparkten
 *     Stempel vorbei.
 *
 * Jede der beiden Schranken bekommt eine Gegenprobe: derselbe Prüfcode
 * bekommt den kaputten Stand von vorher (die Geisterklappe) vorgelegt und
 * MUSS melden.
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { PressManager, PRESS_CENTER, PRESS_KAMMER } from "../src/world/press";
import { clawSpan, CLAW_OPEN_SPLAY } from "../src/excavator/clawGeometry";

/** Ein achsparalleler Kasten in Weltkoordinaten. */
interface Kasten {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
  /** Hat das Ding ein sichtbares Netz? */
  sichtbar: boolean;
  name: string;
}

/** Die Kammermündung in Weltachsen. */
const MUENDUNG = {
  x0: PRESS_CENTER.x - PRESS_KAMMER.hw,
  x1: PRESS_CENTER.x + PRESS_KAMMER.hw,
  z0: PRESS_CENTER.z - PRESS_KAMMER.hd,
  z1: PRESS_CENTER.z + PRESS_KAMMER.hd,
};
/** Kammerboden 0,30 m, Wandkrone 0,30 + 1,90 = 2,20 m (`press.ts`). */
const BODEN = 0.3;
const KRONE = 2.2;
/** Überlappung, ab der zwei Kästen als „an derselben Stelle" gelten. */
const TOLERANZ = 0.02;

/** Wie weit ein Kasten waagerecht in die Mündung hineinragt (m², 0 = gar nicht). */
function muendungsAnteil(k: Kasten): number {
  const dx = Math.min(k.max.x, MUENDUNG.x1) - Math.max(k.min.x, MUENDUNG.x0);
  const dz = Math.min(k.max.z, MUENDUNG.z1) - Math.max(k.min.z, MUENDUNG.z0);
  if (dx <= TOLERANZ || dz <= TOLERANZ) return 0;
  // nur was im Höhenband zwischen Kammerboden und Wandkrone liegt
  if (k.max.y <= BODEN + TOLERANZ || k.min.y >= KRONE - TOLERANZ) return 0;
  return dx * dz;
}

/**
 * Prüfung 1: Steht in der Mündung etwas, das man nicht sieht?
 *
 * @returns die Namen der unsichtbaren Hindernisse (leer = alles in Ordnung)
 */
function unsichtbareHindernisse(kaesten: Kasten[]): string[] {
  return kaesten.filter((k) => !k.sichtbar && muendungsAnteil(k) > 0).map((k) => k.name);
}

/**
 * Prüfung 2: Die größte freie Quadratkante in der Mündung.
 *
 * Gesucht ist die größte Kantenlänge `s`, für die es noch eine Mittellage gibt,
 * an der ein Quadrat dieser Kante ganz in der Mündung liegt und keinen der
 * Kästen berührt. Gesucht wird auf einem Raster von 2 cm — feiner lohnt nicht,
 * weil die Maße der Maschine auf 5 mm gerundet sind.
 */
function groessteFreieKante(kaesten: Kasten[]): number {
  const stoerer = kaesten.filter((k) => muendungsAnteil(k) > 0);
  const RASTER = 0.02;
  const passt = (s: number): boolean => {
    const h = s / 2;
    for (let cx = MUENDUNG.x0 + h; cx <= MUENDUNG.x1 - h + 1e-9; cx += RASTER) {
      for (let cz = MUENDUNG.z0 + h; cz <= MUENDUNG.z1 - h + 1e-9; cz += RASTER) {
        let frei = true;
        for (const k of stoerer) {
          if (cx - h < k.max.x && cx + h > k.min.x && cz - h < k.max.z && cz + h > k.min.z) {
            frei = false;
            break;
          }
        }
        if (frei) return true;
      }
    }
    return false;
  };
  let unten = 0;
  let oben = Math.min(MUENDUNG.x1 - MUENDUNG.x0, MUENDUNG.z1 - MUENDUNG.z0);
  if (passt(oben)) return oben;
  for (let i = 0; i < 12; i++) {
    const mitte = (unten + oben) / 2;
    if (passt(mitte)) unten = mitte;
    else oben = mitte;
  }
  return unten;
}

/** Kästen der laufenden Maschine einsammeln: Kollider + sichtbare Netze. */
async function baueMaschine(): Promise<{ kaesten: Kasten[]; netze: number }> {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const scene = new THREE.Scene();
  new PressManager(scene, world, { items: [] } as never, { cars: [] } as never);
  world.step();
  scene.updateMatrixWorld(true);

  // Sichtbare Netze als Kästen — daran wird geprüft, ob ein Kollider zu sehen ist.
  const sichtbare: THREE.Box3[] = [];
  let netze = 0;
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    netze++;
    if (!m.visible) return;
    sichtbare.push(new THREE.Box3().setFromObject(m));
  });

  const kaesten: Kasten[] = [];
  let nr = 0;
  world.forEachCollider((c) => {
    const he = c.halfExtents();
    if (!he) return;
    const t = c.translation();
    const r = c.rotation();
    const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    const box = new THREE.Box3();
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        for (const sz of [-1, 1])
          box.expandByPoint(
            new THREE.Vector3(sx * he.x, sy * he.y, sz * he.z)
              .applyQuaternion(q)
              .add(new THREE.Vector3(t.x, t.y, t.z))
          );
    // Sichtbar heisst: irgendein sichtbares Netz deckt mindestens die Haelfte
    // der Grundflaeche dieses Kolliders ab.
    const flaeche = (box.max.x - box.min.x) * (box.max.z - box.min.z);
    const gedeckt = sichtbare.some((s) => {
      const dx = Math.min(s.max.x, box.max.x) - Math.max(s.min.x, box.min.x);
      const dz = Math.min(s.max.z, box.max.z) - Math.max(s.min.z, box.min.z);
      const dy = Math.min(s.max.y, box.max.y) - Math.max(s.min.y, box.min.y);
      return dx > 0 && dz > 0 && dy > -0.05 && dx * dz >= 0.5 * flaeche;
    });
    kaesten.push({
      min: { x: box.min.x, y: box.min.y, z: box.min.z },
      max: { x: box.max.x, y: box.max.y, z: box.max.z },
      sichtbar: gedeckt,
      name: `Kollider ${++nr}`,
    });
  });
  return { kaesten, netze };
}

/**
 * Der kaputte Stand von vorher: die Geisterklappe, wie sie bis zum 15.09.2026
 * im Ruhezustand stand. Gemessen, nicht erfunden (`tools`-Messlauf E-071).
 */
const GEISTERKLAPPE: Kasten = {
  min: { x: -6.88, y: 1.46, z: -28.23 },
  max: { x: -4.83, y: 2.74, z: -23.77 },
  sichtbar: false,
  name: "Geisterklappe (Stand vor E-071)",
};

describe("Presskammer: nichts Unsichtbares, und die Kralle passt", () => {
  it("kein Kollider ragt unsichtbar in die Mündung", async () => {
    const { kaesten } = await baueMaschine();
    expect(unsichtbareHindernisse(kaesten), "unsichtbares Hindernis in der Kammer").toEqual([]);
  });

  it("GEGENPROBE: der Prüfcode meldet die Geisterklappe von vorher", () => {
    const kaputt = [GEISTERKLAPPE];
    expect(
      muendungsAnteil(GEISTERKLAPPE),
      "die Geisterklappe ragte messbar in die Mündung"
    ).toBeGreaterThan(0);
    expect(
      unsichtbareHindernisse(kaputt),
      "der Wächter hätte den alten Stand durchgelassen"
    ).toEqual([GEISTERKLAPPE.name]);
  });

  it("die offene Sichelkralle passt am geparkten Stempel vorbei in die Kammer", async () => {
    const { kaesten } = await baueMaschine();
    const spanne = clawSpan(CLAW_OPEN_SPLAY);
    const frei = groessteFreieKante(kaesten);
    console.log(
      `freie Kante in der Mündung: ${frei.toFixed(3)} m · Kralle offen ${spanne.toFixed(3)} m · ` +
        `Freigang je Seite ${((frei - spanne) / 2).toFixed(3)} m`
    );
    expect(frei, "die offene Kralle passt nicht mehr durch die Mündung").toBeGreaterThan(spanne);
  });

  it("GEGENPROBE: mit der Geisterklappe ist die Mündung zu eng", async () => {
    const { kaesten } = await baueMaschine();
    const spanne = clawSpan(CLAW_OPEN_SPLAY);
    /*
     * Seit E-138 ist die Kammer 5,05 m tief: Die Geisterklappe in ihrer alten
     * Lage (0,905 m in der Muendung) liesse jetzt mehr als die Spanne frei
     * und pruefte nichts mehr. Dieselbe Klappe, an der Ostwand angesetzt und
     * so weit hineinragend, dass 5 cm weniger als die Spanne bleiben — das
     * MUSS der Waechter melden.
     */
    const ein = MUENDUNG.x1 - MUENDUNG.x0 - spanne + 0.05;
    const geist: Kasten = {
      ...GEISTERKLAPPE,
      min: { ...GEISTERKLAPPE.min, x: MUENDUNG.x1 - ein, z: MUENDUNG.z0 },
      max: { ...GEISTERKLAPPE.max, x: MUENDUNG.x1 + 1.15, z: MUENDUNG.z1 },
    };
    const frei = groessteFreieKante([...kaesten, geist]);
    expect(
      frei,
      "der Wächter hätte die eingeengte Mündung von vorher durchgelassen"
    ).toBeLessThan(spanne);
  });
});
