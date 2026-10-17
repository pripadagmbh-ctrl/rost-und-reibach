/**
 * Wächter für den Kabinenhub — Paket 8 und letztes aus E-025 (E-040).
 *
 * WARUM DIESER WÄCHTER SCHÄRFER IST ALS DIE ANDEREN: Dies ist die einzige
 * Änderung im ganzen Baggerumbau, die den **Augpunkt der Kabinenkamera**
 * berührt. Die Kabinenansicht ist Patricks Arbeitsplatz beim Sortieren, und an
 * der Augpunkthöhe 3,28 m hängt eine gebaute Entscheidung: die Sichtrechnung
 * über die Schwelle der Buntmetall-Mulde (E-034, zwei Lagen Sockel).
 *
 * Es gibt also zwei Sorten Prüfungen hier:
 *
 *   1. **Was gleich bleiben MUSS** — Augpunkt unten und ganz oben, auf den
 *      Millimeter. Wandert er, ist eine fremde Entscheidung still ungültig
 *      geworden.
 *   2. **Was neu ist und stimmen muss** — der Bogen dazwischen, die 861
 *      abgetasteten Lenkerstellungen, die Freigänge am Mast, die Aussparung in
 *      der Motorhaube, das Geländer, die Netzzahl.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import {
  DREHPUNKT,
  HUB_MAX,
  KABINE_UMRISS,
  LENKER_L,
  LENKER_X,
  MAST_HOEHE,
  NISCHE_BEDARF,
  WINKEL_OBEN,
  WINKEL_UNTEN,
  ZYL_MASSE,
  hubVersatz,
  hubWinkel,
} from "../src/excavator/kabinenhubParts";
import {
  DECK_OBEN,
  HAUBE_HALB,
  HAUBE_HINTEN,
  HAUBE_OBEN,
  HAUBE_STUFE,
  HAUBE_VORN,
  NISCHE,
} from "../src/excavator/oberwagenParts";

let scene: THREE.Scene;
let bagger: Excavator;

beforeAll(async () => {
  leinwandAttrappe();
  await initPhysics();
  scene = new THREE.Scene();
  bagger = new Excavator(scene, new RAPIER.World({ x: 0, y: -9.81, z: 0 }));
});

function finde(name: string): THREE.Object3D {
  const o = scene.getObjectByName(name);
  if (!o) throw new Error(`${name} nicht gefunden`);
  return o;
}

/** Hubhöhe setzen und die ganze Maschine nachziehen. */
function geheAuf(h: number): void {
  const b = bagger as unknown as { cabLift: number; syncMeshes(): void; updateHydraulics(): void };
  b.cabLift = h;
  b.syncMeshes();
  b.updateHydraulics();
}

/**
 * Augpunkt im Frame der MASCHINE.
 *
 * `getCabinEye` liefert Weltkoordinaten, und der Bagger steht auf
 * (−0,5 | −22,5). Ohne diese Umrechnung prüfte der Test den Standplatz mit.
 */
function augpunkt(): THREE.Vector3 {
  const p = new THREE.Vector3();
  bagger.getCabinEye(p);
  bagger.root.updateMatrixWorld(true);
  return p.applyMatrix4(new THREE.Matrix4().copy(bagger.root.matrixWorld).invert());
}

interface Kasten {
  name: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

/**
 * Abstand eines Punkts von einem Quader. Negativ heißt: er steckt darin, und
 * zwar so tief, wie die nächste Wand entfernt ist.
 */
function abstand(p: THREE.Vector3, k: Kasten): number {
  const dx = Math.max(k.x0 - p.x, p.x - k.x1);
  const dy = Math.max(k.y0 - p.y, p.y - k.y1);
  const dz = Math.max(k.z0 - p.z, p.z - k.z1);
  if (dx > 0 || dy > 0 || dz > 0)
    return Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0));
  return Math.max(dx, dy, dz);
}

/** Alle Eckpunkte eines Netzes im Frame des Oberwagens. */
function eckpunkteImOberwagen(name: string): THREE.Vector3[] {
  const ober = finde("05_OBERWAGEN");
  ober.updateWorldMatrix(true, true);
  const m = finde(name) as THREE.Mesh;
  m.updateWorldMatrix(true, false);
  const mat = new THREE.Matrix4()
    .copy(ober.matrixWorld)
    .invert()
    .multiply(m.matrixWorld);
  const pos = (m.geometry as THREE.BufferGeometry).getAttribute("position") as THREE.BufferAttribute;
  const raus: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i++) {
    raus.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mat));
  }
  return raus;
}

describe("Kabinenhub — der Augpunkt, der bleiben muss", () => {
  it("unten steht der Augpunkt auf y 3,28 | z 0,20, wie seit dem 29.08.2026", () => {
    /*
     * Diese beiden Zahlen stehen in `docs/baggerkonzept.md` Abschnitt 5 UND in
     * der Sichtrechnung der Buntmetall-Mulde (E-034): „Bei Augpunkt 3,28 m
     * (abgesenkte Kabine) streift der Blick die Wandkrone." Wandert der
     * Augpunkt, ist der doppelte Sockel dort still falsch berechnet.
     */
    geheAuf(0);
    const a = augpunkt();
    expect(a.y, "Augpunkt über Grund, Kabine unten").toBeCloseTo(3.28, 3);
    expect(a.z, "Augpunkt vor der Drehmitte, Kabine unten").toBeCloseTo(0.2, 3);
  });

  it("ganz oben steht er auf y 5,88 | z 1,084, wie vor dem Umbau", () => {
    /*
     * ZAHLEN, NICHT KONSTANTEN. Stünde hier `3.28 + HUB_MAX` und
     * `0.2 + HUB_MAX * VORLAUF`, liefe der Wächter jeder Änderung an Hub oder
     * Vorlauf brav hinterher und prüfte nichts mehr. 5,88 und 1,084 sind die
     * Werte, die vor dem Umbau im Bild standen.
     */
    geheAuf(HUB_MAX);
    const a = augpunkt();
    expect(a.y, "Augpunkt über Grund, Kabine oben").toBeCloseTo(5.88, 3);
    expect(a.z, "Augpunkt vor der Drehmitte, Kabine oben").toBeCloseTo(1.084, 3);
  });

  it("die Hubhöhe bleibt eine Höhe in Metern — daran hängt das HUD", () => {
    /*
     * `cabLiftHeight` geht ans HUD und die Hubgeschwindigkeit (0,75 m/s)
     * rechnet damit. Würde `cabLift` zum Winkel, führe die Kabine plötzlich
     * verschieden schnell und die Anzeige zeigte Bogenmaß.
     */
    for (const h of [0, 0.7, 1.3, 2.1, HUB_MAX]) {
      geheAuf(h);
      expect(bagger.cabLiftHeight, "cabLiftHeight").toBeCloseTo(h, 9);
      expect(augpunkt().y - 3.28, `Augpunkt bei Hub ${h}`).toBeCloseTo(h, 9);
    }
  });

  it("dazwischen läuft die Kabine einen Bogen — gemessen, nicht geschätzt", () => {
    /*
     * Das ist der bewusst in Kauf genommene Unterschied (E-025, Frage 3, von
     * Patrick am Bild entschieden): Die Kabine weicht auf halbem Weg von der
     * heutigen geraden Bahn ab. Gemessen 0,627 m waagerecht bei Hub 1,20 m;
     * senkrecht zur Geraden sind es 0,596 m.
     *
     * Der Wächter hält BEIDE Enden fest: Unter 0,55 m wäre der Lenker länger
     * geworden (andere Maschine), über 0,70 m schwenkte die Kabine weiter
     * nach vorn als besprochen.
     */
    let groesste = 0;
    let bei = 0;
    let letztesY = -Infinity;
    for (let i = 0; i <= 26; i++) {
      const h = (HUB_MAX * i) / 26;
      geheAuf(h);
      const a = augpunkt();
      expect(a.y, "die Kabine fährt nicht durchweg aufwärts").toBeGreaterThan(letztesY);
      letztesY = a.y;
      const dz = a.z - (0.2 + h * 0.34); // 0,34 = Vorlauf der alten geraden Bahn
      expect(dz, "die Kabine weicht nach HINTEN aus").toBeGreaterThan(-1e-9);
      if (dz > groesste) {
        groesste = dz;
        bei = h;
      }
    }
    expect(groesste, "größte waagerechte Abweichung").toBeGreaterThan(0.55);
    expect(groesste, "größte waagerechte Abweichung").toBeLessThan(0.7);
    expect(bei, "sie liegt etwa auf halbem Weg").toBeGreaterThan(0.9);
    expect(bei, "sie liegt etwa auf halbem Weg").toBeLessThan(1.7);
  });
});

describe("Kabinenhub — nichts läuft durch die Kabine", () => {
  it("861 abgetastete Lenkerstellungen, null Durchdringungen des Umrisses", () => {
    /*
     * Dieselbe Abtastung, mit der `tools/kabinenhub.ts` am 15.09.2026 die
     * beiden Bauformen verglichen hat: 41 Stellungen × 21 Punkte je Lenker.
     * Die verworfene Variante B („Lenker vor der Kabine") kam dort auf 186
     * Treffer — DAS war ihr Ausschlussgrund. Variante A muss auf 0 kommen,
     * sonst ist der Vergleich hinfällig.
     */
    let treffer = 0;
    const versatz = new THREE.Vector3();
    for (let i = 0; i <= 40; i++) {
      const h = (HUB_MAX * i) / 40;
      const w = hubWinkel(h);
      hubVersatz(h, versatz);
      for (let t = 0; t <= 20; t++) {
        const y = DREHPUNKT.y + Math.sin(w) * LENKER_L * (t / 20);
        const z = DREHPUNKT.z + Math.cos(w) * LENKER_L * (t / 20);
        if (
          y > KABINE_UMRISS.yVon + versatz.y &&
          y < KABINE_UMRISS.yBis + versatz.y &&
          z > KABINE_UMRISS.zVon + versatz.z &&
          z < KABINE_UMRISS.zBis + versatz.z
        ) {
          treffer++;
        }
      }
    }
    expect(treffer, "Lenkerpunkte im Kabinenumriss (Variante B hatte 186)").toBe(0);
  });

  it("der Umriss, gegen den geprüft wird, ist wirklich die gebaute Kabine", () => {
    /*
     * Sonst prüft der Test oben gegen eine Wunschkabine. Alle Netze im
     * Kabinenschlitten müssen in `KABINE_UMRISS` passen — und der Umriss darf
     * nicht wesentlich größer sein als sie, sonst wäre er zu großzügig
     * geschnitten und ließe einen Lenker durchs Blech.
     */
    geheAuf(0);
    const schlitten = finde("06_KABINE");
    const ober = finde("05_OBERWAGEN");
    ober.updateWorldMatrix(true, true);
    const nachOberwagen = new THREE.Matrix4().copy(ober.matrixWorld).invert();
    const box = new THREE.Box3();
    schlitten.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      if (o.name === "08_NAMENSSCHILD") return; // hängt außen an der Tür
      // E-142: Fahrerarme sind SkinnedMesh — ihre Ecken liegen im Raum der Knochen, die Huellbox des Netzes sagt nichts
      if (o instanceof THREE.SkinnedMesh) return;
      const g = o.geometry as THREE.BufferGeometry;
      g.computeBoundingBox();
      box.union(
        g.boundingBox!
          .clone()
          .applyMatrix4(new THREE.Matrix4().multiplyMatrices(nachOberwagen, o.matrixWorld))
      );
    });
    /*
     * `06_KABINE` sitzt im Oberwagen, der bei y 1,60 liegt. Nach OBEN steht
     * die Ecke der 40° geneigten Dachscheibe 8,6 cm über dem Umriss — dort
     * kommt kein Lenker je hin (er hängt UNTER der Kabine), deshalb genügt
     * hier ein Fenster von 10 cm. Nach vorn, hinten und unten ist der Umriss
     * dagegen eng: Genau dort schwenkt der Lenker vorbei.
     */
    expect(box.min.y, "Kabine reicht unter den Umriss").toBeGreaterThan(KABINE_UMRISS.yVon - 0.06);
    expect(box.max.y, "Kabine reicht über den Umriss").toBeLessThan(KABINE_UMRISS.yBis + 0.1);
    expect(box.min.z, "Kabine reicht hinter den Umriss").toBeGreaterThan(KABINE_UMRISS.zVon - 0.06);
    expect(box.max.z, "Kabine reicht vor den Umriss").toBeLessThan(KABINE_UMRISS.zBis + 0.06);
  });

  it("kein Teil des Hubwerks steckt in Haube, Tank, Geländer oder Kabinenboden", () => {
    /*
     * Die harte Prüfung: 41 Hubstellungen, und zwar mit den WIRKLICHEN
     * Eckpunkten der gebauten Netze statt mit einer Mittellinie. Die
     * Hindernisse sind die Quader, aus denen `oberwagenParts.ts` und
     * `kabinenParts.ts` bestehen.
     *
     * Der engste Punkt der ganzen Mechanik ist der Lenkerkopf am
     * Kabinenbodenblech: In der untersten Stellung steht der Lenker 65,7°
     * steil und läuft dicht an dessen Hinterkante vorbei. Deshalb läuft er zur
     * Kabine hin flach aus (4,2 cm statt 16 cm); gemessen bleiben 17 mm.
     */
    const kabinenboden: Kasten = {
      name: "Kabinenbodenblech",
      x0: -1.6,
      x1: -0.5,
      y0: 0.545,
      y1: 0.615,
      z0: -0.105,
      z1: 0.645,
    };
    const fest: Kasten[] = [
      { name: "Haube unten links", x0: -HAUBE_HALB, x1: NISCHE.xVon, y0: DECK_OBEN, y1: HAUBE_STUFE, z0: HAUBE_HINTEN, z1: HAUBE_VORN },
      { name: "Haube unten rechts", x0: NISCHE.xBis, x1: HAUBE_HALB, y0: DECK_OBEN, y1: HAUBE_STUFE, z0: HAUBE_HINTEN, z1: HAUBE_VORN },
      { name: "Haube unten hinter der Nische", x0: NISCHE.xVon, x1: NISCHE.xBis, y0: DECK_OBEN, y1: HAUBE_STUFE, z0: HAUBE_HINTEN, z1: NISCHE.zHinten },
      { name: "Haube oben links", x0: -(HAUBE_HALB - 0.17), x1: NISCHE.xVon, y0: HAUBE_STUFE, y1: HAUBE_OBEN, z0: -1.76, z1: -0.36 },
      { name: "Haube oben rechts", x0: NISCHE.xBis, x1: HAUBE_HALB - 0.17, y0: HAUBE_STUFE, y1: HAUBE_OBEN, z0: -1.76, z1: -0.36 },
      { name: "Haube oben hinter der Nische", x0: NISCHE.xVon, x1: NISCHE.xBis, y0: HAUBE_STUFE, y1: HAUBE_OBEN, z0: -1.76, z1: NISCHE.zHinten },
      { name: "Hydrauliktank", x0: -1.4, x1: -1.24, y0: DECK_OBEN, y1: DECK_OBEN + 0.44, z0: -1.81, z1: -1.09 },
      { name: "Tankdeckel", x0: -1.42, x1: -1.22, y0: DECK_OBEN + 0.44, y1: DECK_OBEN + 0.48, z0: -1.83, z1: -1.07 },
      { name: "Geländer-Handlauf", x0: -1.108, x1: -1.052, y0: HAUBE_STUFE, y1: HAUBE_STUFE + 0.93, z0: -1.8, z1: -0.35 },
      { name: "Auspuff", x0: -0.955, x1: -0.765, y0: HAUBE_OBEN, y1: HAUBE_OBEN + 0.5, z0: -0.645, z1: -0.455 },
    ];
    let engster = Infinity;
    let engstesPaar = "";
    for (let i = 0; i <= 40; i++) {
      const h = (HUB_MAX * i) / 40;
      geheAuf(h);
      const v = hubVersatz(h, new THREE.Vector3());
      const boden: Kasten = {
        ...kabinenboden,
        y0: kabinenboden.y0 + v.y,
        y1: kabinenboden.y1 + v.y,
        z0: kabinenboden.z0 + v.z,
        z1: kabinenboden.z1 + v.z,
      };
      const teile = i === 0 ? ["06_KABINENMAST", "06_KABINENLENKER", "06_ZYLINDER_KABINE_ROHR", "06_ZYLINDER_KABINE_STANGE"] : ["06_KABINENLENKER", "06_ZYLINDER_KABINE_ROHR", "06_ZYLINDER_KABINE_STANGE"];
      for (const name of teile) {
        for (const p of eckpunkteImOberwagen(name)) {
          for (const k of [...fest, boden]) {
            const d = abstand(p, k);
            if (d < engster) {
              engster = d;
              engstesPaar = `${name} ↔ ${k.name} bei Hub ${h.toFixed(2)} m`;
            }
          }
        }
      }
    }
    expect(engster, `engste Stelle: ${engstesPaar}`).toBeGreaterThan(0.01);
  });
});

describe("Kabinenhub — Mast, Aussparung und Geländer", () => {
  it("der Drehpunkt ist gerechnet und liegt HINTER der Kabine", () => {
    /*
     * Er ist keine Setzung: Aus Lenkerlänge 1,88 m, Hub 2,60 m, Vorlauf 0,34
     * und dem unveränderten Anlenkpunkt folgt er eindeutig. Stimmt er nicht,
     * stimmen auch die Endlagen des Augpunkts nicht mehr.
     */
    expect(DREHPUNKT.y, "Drehpunkt über dem Oberwagenboden").toBeCloseTo(2.213, 3);
    expect(DREHPUNKT.z, "Drehpunkt hinter der Kabine").toBeCloseTo(-0.894, 3);
    expect(MAST_HOEHE, "Masthöhe über der Deckplatte").toBeCloseTo(1.858, 3);
    expect(((WINKEL_OBEN - WINKEL_UNTEN) * 180) / Math.PI, "Schwenkweg").toBeCloseTo(93.9, 0);
    // Die Endlagen müssen auf dem Kreis liegen — sonst wäre es kein Lenker
    for (const h of [0, HUB_MAX]) {
      const v = hubVersatz(h, new THREE.Vector3());
      expect(Math.hypot(0.5 + v.y - DREHPUNKT.y, -0.12 + v.z - DREHPUNKT.z), "Lenkerlänge").toBeCloseTo(LENKER_L, 9);
    }
  });

  it("die Aussparung ist wirklich aus der Motorhaube geschnitten", () => {
    /*
     * Ohne diese Prüfung könnte jemand `NISCHE` ändern, ohne die Haube
     * mitzuziehen — die Zahlen stimmten dann, und der Mast stünde trotzdem im
     * Blech. Geprüft wird an den Eckpunkten des gebauten Netzes.
     */
    const pos = ((finde("05_MOTORHAUBE") as THREE.Mesh).geometry as THREE.BufferGeometry).getAttribute(
      "position"
    ) as THREE.BufferAttribute;
    let drin = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (
        x > NISCHE.xVon + 1e-6 &&
        x < NISCHE.xBis - 1e-6 &&
        z > NISCHE.zHinten + 1e-6 &&
        z < HAUBE_VORN - 1e-6 &&
        y > DECK_OBEN + 1e-6 &&
        y < HAUBE_OBEN - 1e-6
      ) {
        drin++;
      }
    }
    expect(drin, "Haubenblech steht noch in der Aussparung").toBe(0);
    // ... und sie ist groß genug für Säule und Lenker
    expect(NISCHE.xVon, "Aussparung zu schmal (außen)").toBeLessThan(NISCHE_BEDARF.xVon - 0.05);
    expect(NISCHE.xBis, "Aussparung zu schmal (innen)").toBeGreaterThan(NISCHE_BEDARF.xBis + 0.05);
    expect(NISCHE.zHinten, "Aussparung zu flach").toBeLessThan(NISCHE_BEDARF.zHinten - 0.02);
  });

  it("die Silhouette der Haube bleibt, wo sie war", () => {
    /*
     * Die Aussparung darf nicht als Verkleinerung durchgehen. Gemessen wird
     * der Umriss des ganzen Lack-Netzes: Oberkante, Vorder- und Hinterkante
     * und die größte Breite (das Laufblech, ±1,43). Nur INNEN fehlt ein Stück.
     */
    const geo = (finde("05_MOTORHAUBE") as THREE.Mesh).geometry as THREE.BufferGeometry;
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    expect(bb.max.y, "Oberkante der Haube").toBeCloseTo(HAUBE_OBEN, 3);
    expect(bb.min.y, "Unterkante der Haube").toBeCloseTo(DECK_OBEN, 3);
    expect(bb.max.z, "Vorderkante der Haube").toBeCloseTo(HAUBE_VORN, 3);
    expect(bb.min.z, "Hinterkante der Haube").toBeCloseTo(HAUBE_HINTEN, 3);
    expect(bb.max.x, "größte Breite (Laufblech)").toBeCloseTo(1.43, 2);
    expect(bb.min.x, "größte Breite (Laufblech)").toBeCloseTo(-1.43, 2);
    /*
     * Und die Flanke bei x −1,25 steht noch: An ihr sitzen die fünf
     * Lüftungslamellen, und auf ihrer Schulter steht der Geländerpfosten. Eine
     * Aussparung bis zur Flanke hätte beide mitgenommen.
     */
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const hatFlanke = (x: number): boolean => {
      for (let i = 0; i < pos.count; i++) {
        if (Math.abs(pos.getX(i) - x) > 0.002) continue;
        if (pos.getY(i) > HAUBE_STUFE + 0.01 || pos.getY(i) < DECK_OBEN - 0.01) continue;
        if (pos.getZ(i) > HAUBE_VORN + 0.01 || pos.getZ(i) < HAUBE_HINTEN - 0.01) continue;
        return true;
      }
      return false;
    };
    expect(hatFlanke(-HAUBE_HALB), "die äußere Haubenflanke fehlt").toBe(true);
    expect(hatFlanke(NISCHE.xVon), "die äußere Wand der Aussparung fehlt").toBe(true);
  });

  it("das Geländer braucht keine Umleitung — es läuft an der Aussparung vorbei", () => {
    /*
     * Erwartet worden war, dass der innere Mastfuß das umlaufende Geländer
     * (x ±1,08, Paket 3) sprengt. Gemessen ist das Gegenteil: Die Aussparung
     * endet bei x −0,80, die Fußplatte des Geländerpfostens beginnt bei
     * x −1,03 — dazwischen liegen 23 cm Blech, auf dem der Pfosten steht. Das
     * Geländer wird dadurch sogar zum Schutz gegen den Schacht.
     *
     * Deshalb steht diese Zahl als Wächter da: Wer die Aussparung breiter
     * schneidet, nimmt dem vorderen Pfosten den Boden weg.
     */
    const GELAENDER_FUSSPLATTE_INNEN = -1.03; // x −1,08 + halbe Platte 0,05
    expect(
      GELAENDER_FUSSPLATTE_INNEN - NISCHE.xVon,
      "die Aussparung reicht unter den Geländerpfosten"
    ).toBeLessThan(-0.15);
    // Der Mast kreuzt das Geländer nur OBERHALB des Handlaufs (1,995)
    let tiefstesUeberGelaender = Infinity;
    for (const p of eckpunkteImOberwagen("06_KABINENMAST")) {
      if (p.x > -1.14 && p.x < -1.0) tiefstesUeberGelaender = Math.min(tiefstesUeberGelaender, p.y);
    }
    expect(tiefstesUeberGelaender, "der Mast kreuzt das Geländer auf Handlaufhöhe").toBeGreaterThan(
      HAUBE_STUFE + 0.93
    );
  });

  it("der Mast bleibt innerhalb der Maschinenbreite", () => {
    /*
     * Die äußere Mastsäule steht über der Deckkante (±1,45) — das ist bekannt
     * und mitentschieden. Entscheidend ist nur, dass sie nicht das breiteste
     * Teil der Maschine wird: Die Räder stehen bei ±1,75, die ausgefahrenen
     * Pratzen bei ±2,61.
     */
    const geo = (finde("06_KABINENMAST") as THREE.Mesh).geometry as THREE.BufferGeometry;
    geo.computeBoundingBox();
    const aussen = -geo.boundingBox!.min.x;
    expect(aussen, "Mast über der Deckkante").toBeGreaterThan(1.45);
    expect(aussen, "Mast steht weiter außen als die Räder").toBeLessThan(1.7);
  });
});

describe("Kabinenhub — was er kostet", () => {
  it("das ganze Hubwerk kostet vier Netze, der Bagger steht bei 57", () => {
    /*
     * Vorher sechs: zwei gedehnte Lenker und zwei Zylinder à zwei Netze.
     * Jetzt vier: Mast, Lenker (beide Seiten plus Welle und Hebel in EINEM
     * Netz, weil sich darin nichts gegeneinander bewegt) und ein Zylinder.
     *
     * 57 ist die Zahl aus E-025. Sie steht hier, damit sie nicht beim nächsten
     * Detail leise wieder steigt.
     */
    const namen: string[] = [];
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === bagger.grappleGroup) return;
      namen.push(o.name);
    });
    expect(
      namen.filter((n) => /^06_(KABINENMAST|KABINENLENKER|ZYLINDER_KABINE)/.test(n)).sort(),
      "Netze des Kabinenhubwerks"
    ).toEqual([
      "06_KABINENLENKER",
      "06_KABINENMAST",
      "06_ZYLINDER_KABINE_ROHR",
      "06_ZYLINDER_KABINE_STANGE",
    ]);
    expect(namen.length, "Netze am ganzen Bagger ohne Spinne").toBe(57);
  });

  it("der Zylinder ist jetzt einer, der gebaut werden könnte", () => {
    /*
     * Der Kern des Befunds aus E-025: 5,18 : 1 kann kein einstufiger Zylinder.
     * Über den Hebel auf der Welle sind daraus 1,47 : 1 geworden — dieselbe
     * Größenordnung wie beim Hubzylinder des Auslegers (1,49).
     */
    expect(ZYL_MASSE.lang / ZYL_MASSE.kurz, "Hubverhältnis").toBeLessThan(1.6);
    expect(ZYL_MASSE.lang - ZYL_MASSE.kurz, "sichtbarer Hub").toBeGreaterThan(0.3);
    expect(ZYL_MASSE.kurz, "eingefahrene Baulänge").toBeGreaterThan(2 * ZYL_MASSE.rRohr * 1.1 + 0.3);
  });

  it("die beiden Lenker sitzen auf EINER Welle — deshalb genügt ein Netz", () => {
    /*
     * Beide drehen um denselben Winkel um denselben Punkt. Hingen sie an zwei
     * Gruppen, wäre es wieder ein Netz mehr, ohne dass sich etwas bewegte.
     */
    const lenker = finde("06_KABINENLENKER");
    expect(lenker.parent!.name, "Lenker hängen nicht an der Welle").toBe("06_KABINENHUBWERK");
    geheAuf(1.3);
    expect(lenker.parent!.rotation.x, "die Welle dreht nicht mit der Hubhöhe").toBeCloseTo(
      -hubWinkel(1.3),
      9
    );
    // x-Lage: einer je Kabinenflanke, unverändert seit dem Prototyp
    expect(LENKER_X[0], "x-Lage des äußeren Lenkers").toBeCloseTo(-1.47, 9);
    expect(LENKER_X[1], "x-Lage des inneren Lenkers").toBeCloseTo(-0.63, 9);
  });
});
