/**
 * WIEVIELE NETZE KOSTET EIN WRACK? — und sieht es nach dem Umbau gleich aus?
 *
 * Anlass (E-111): Ein Wrack bestand aus 25 Netzen, weil die dreizehn
 * Anbauteile — Stoßstangen, Grill, Leuchten, Radläufe, Spiegel — jedes ein
 * eigenes Netz mit eigenem Material waren. Mit Schattenwurf sind das 50
 * Zeichenrufe je Wrack, bei zwei Wracks 100, und damit 7,6 % der auf Patricks
 * Gerät gemessenen 1322. Zeichenrufe sind hier der Engpass, nicht Dreiecke
 * (E-025). Die dreizehn gehen nie einzeln ab, also gehören sie in EIN Netz mit
 * Eckpunktfarben.
 *
 * DIESER WÄCHTER PRÜFT DREI DINGE, und das dritte ist das eigentliche:
 *
 *   1. Die Netzzahl je Wrack bleibt bei 13. Wächst sie zurück, meldet er es.
 *   2. Die Zerlegemechanik ist unberührt: Motor, Getriebe und die vier Räder
 *      sind weiter EIGENE Netze und gehen weiter einzeln ab. Genau die dürfen
 *      NICHT verschmolzen werden.
 *   3. Das Auto sieht genauso aus wie vorher. Der Umbau hat die Maße nach
 *      `CarDef.karosserie` gehoben; die Prüfung baut die dreizehn Teile noch
 *      einmal nach dem ALTEN, fest verdrahteten Code und vergleicht jeden
 *      Eckpunkt. Erlaubt ist Rechenrauschen, nichts weiter.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { ItemManager } from "../src/world/scrapItems";
import { CarComposite, CompositeManager, baueAnbauteile, formeKarosserie } from "../src/dismantle/composites";
import { CAR_DEF } from "../src/dismantle/carDef";
import { EventBus } from "../src/core/events";

/** Gemessen mit `tools/wrackbild.ts` nach E-111. Vorher waren es 25. */
const NETZE_JE_WRACK = 13;

function netze(wurzel: THREE.Object3D): THREE.Mesh[] {
  const liste: THREE.Mesh[] = [];
  wurzel.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) liste.push(o as THREE.Mesh);
  });
  return liste;
}

/** Alle Eckpunkte einer Geometrie in Weltlage, sortiert — als Multimenge. */
function eckpunkte(geos: THREE.BufferGeometry[]): number[][] {
  const alle: number[][] = [];
  for (const g of geos) {
    const p = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) alle.push([p.getX(i), p.getY(i), p.getZ(i)]);
  }
  return alle.sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]! || a[2]! - b[2]!);
}

/** Größte Abweichung zweier Eckpunktmengen, in Metern. */
function abweichung(a: number[][], b: number[][]): number {
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    for (let k = 0; k < 3; k++) max = Math.max(max, Math.abs(a[i]![k]! - b[i]![k]!));
  }
  return max;
}

/**
 * DIE DREIZEHN ANBAUTEILE, GEBAUT WIE VOR E-111 — Zeile für Zeile aus dem
 * alten `baueAnbauteile` übernommen, mit allen zwanzig festen Koordinaten.
 * Diese Funktion ist der Maßstab; sie darf nie „nachgezogen" werden, sonst
 * prüft der Vergleich nichts mehr.
 */
function altesAnbauteil(): THREE.BufferGeometry[] {
  const raus: THREE.BufferGeometry[] = [];
  const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number): void => {
    geo.translate(x, y, z);
    raus.push(geo);
  };
  add(new THREE.BoxGeometry(1.5, 0.16, 0.16), 0, 0.22, 1.94);
  add(new THREE.BoxGeometry(1.5, 0.16, 0.16), 0, 0.22, -1.94);
  add(new THREE.BoxGeometry(1.0, 0.16, 0.06), 0, 0.42, 1.92);
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.3, 0.16, 0.06), sx * 0.52, 0.44, 1.9);
    add(new THREE.BoxGeometry(0.26, 0.18, 0.06), sx * 0.55, 0.42, -1.9);
  }
  for (const sx of [-1, 1]) {
    for (const z of [1.25, -1.25]) {
      const g = new THREE.TorusGeometry(0.42, 0.055, 6, 12, Math.PI);
      g.rotateY(Math.PI / 2);
      add(g, sx * 0.83, 0.34, z);
    }
  }
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.16, 0.1, 0.08), sx * 0.92, 1.0, 0.62);
  }
  return raus;
}

describe("Ein Wrack im Zeichenruf-Budget", () => {
  beforeAll(async () => {
    await initPhysics();
  });

  function wrack() {
    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const comps = new CompositeManager(scene, world, new ItemManager(scene, world), new EventBus());
    return { comps, car: comps.spawnCar(new THREE.Vector3(0, 1, 0)) };
  }

  it(`besteht aus ${NETZE_JE_WRACK} Netzen, nicht mehr`, () => {
    /*
     * Eine OBERGRENZE, und zwar fuer das Auto, das das Spiel wirklich baut.
     * Bis E-117 war das der Bestand mit genau 13 Netzen; seit Patrick die
     * Karosserieform C gewaehlt hat (01.10.2026), sind es 12 — die Radlaeufe
     * sind in die Haut geschnitten statt aufgesteckt. Weniger ist erlaubt,
     * mehr nicht: Zeichenrufe sind der Engpass (E-025).
     */
    const { car } = wrack();
    expect(netze(car.group).length).toBeLessThanOrEqual(NETZE_JE_WRACK);
  });

  it("hat die dreizehn Anbauteile in EINEM Netz", () => {
    const gruppe = new THREE.Group();
    baueAnbauteile(gruppe, CAR_DEF, 0x8c2f24);
    expect(netze(gruppe).length, "die Anbauteile sind wieder einzelne Netze").toBe(1);
    // 9 Kästen à 24 Ecken + 4 Halbtori à 91 = 580. Weniger heißt: ein Teil fehlt.
    const p = netze(gruppe)[0]!.geometry.getAttribute("position");
    expect(p.count).toBe(580);
  });

  it("zeigt jedes Anbauteil genau da, wo es vor dem Umbau war", () => {
    const gruppe = new THREE.Group();
    baueAnbauteile(gruppe, CAR_DEF, 0x8c2f24);
    const neu = eckpunkte([netze(gruppe)[0]!.geometry]);
    const alt = eckpunkte(altesAnbauteil());
    expect(neu.length).toBe(alt.length);
    /*
     * 1e-9 m = ein Nanometer. Mehr als Rundungsrauschen der Gleitkommazahlen
     * kann nicht herauskommen: Die Anteile in `CarDef` stehen als Division da
     * (`1.94 / 2.0`) und werden mit demselben Nenner wieder multipliziert.
     */
    expect(abweichung(neu, alt), "die Anbauteile sitzen nicht mehr wie vorher").toBeLessThan(1e-9);
  });

  it("hat Chassis und Kabine unverändert, obwohl die Maße jetzt in CarDef stehen", () => {
    /*
     * Ein Waechter fuer den BESTAND, ausdruecklich als solcher gebaut: Er
     * vergleicht Eckpunkt fuer Eckpunkt mit dem Stand vor E-111. Seit E-117
     * ist der Bestand nicht mehr die Vorgabe, aber weiter erreichbar
     * (`?wrackform=bestand`) — und dort muss er unveraendert sein. Deshalb wird
     * er hier ausdruecklich als Bestand gebaut, statt die Vorgabe zu nehmen.
     */
    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const car = new CarComposite(
      CAR_DEF, scene, world, new ItemManager(scene, world), new EventBus(),
      new THREE.Vector3(0, 1, 0), "bestand"
    );
    const alleNetze = netze(car.group);
    // Chassis: 5x3x10 = 150 Ecken -> BoxGeometry(…,4,2,9) hat 190; Kabine 126.
    const chassisNeu = alleNetze.find((m) => m.geometry.getAttribute("position").count === 190)!;
    const kabineNeu = alleNetze.find((m) => m.geometry.getAttribute("position").count === 126)!;
    expect(chassisNeu, "kein Chassis gefunden").toBeTruthy();
    expect(kabineNeu, "keine Kabine gefunden").toBeTruthy();

    const chassisAlt = new THREE.BoxGeometry(1.7, 0.55, 4.0, 4, 2, 9);
    formeKarosserie(chassisAlt);
    chassisAlt.translate(0, 0.28, 0);
    const kabineAlt = new THREE.BoxGeometry(1.5, 0.55, 2.0, 4, 2, 5);
    kabineAlt.translate(0, 0.83, -0.2);

    for (const [neuMesh, altGeo] of [
      [chassisNeu, chassisAlt],
      [kabineNeu, kabineAlt],
    ] as const) {
      const g = neuMesh.geometry.clone();
      g.translate(neuMesh.position.x, neuMesh.position.y, neuMesh.position.z);
      expect(abweichung(eckpunkte([g]), eckpunkte([altGeo]))).toBeLessThan(1e-9);
    }
  });
});

describe("Was NICHT verschmolzen werden darf", () => {
  beforeAll(async () => {
    await initPhysics();
  });

  it("Motor, Getriebe und vier Räder bleiben sechs eigene Netze und gehen einzeln ab", () => {
    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const comps = new CompositeManager(scene, world, new ItemManager(scene, world), new EventBus());
    const car = comps.spawnCar(new THREE.Vector3(0, 1, 0));

    const zerlegbar = CAR_DEF.parts.map((p) => p.id);
    expect(zerlegbar.length, "Motor, Getriebe und vier Räder").toBe(6);
    const vorher = netze(car.group).length;
    for (const id of zerlegbar) {
      expect(car.tearPart(id), `${id} ließ sich nicht abreißen`).not.toBeNull();
    }
    // Jedes abgerissene Teil verlässt die Wrackgruppe: sechs Netze weniger.
    expect(netze(car.group).length).toBe(vorher - 6);
  });

  it("Pressen bringt das Wrack weiter auf Stufe 2, mit Radauswurf", () => {
    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const comps = new CompositeManager(scene, world, new ItemManager(scene, world), new EventBus());
    const car = comps.spawnCar(new THREE.Vector3(0, 1, 0));
    const raederVorher = netze(car.group).filter((m) => m.parent === car.group).length;
    car.pressCrush();
    expect(car.crushStage).toBe(2);
    expect(netze(car.group).filter((m) => m.parent === car.group).length, "zwei Raeder fliegen heraus").toBe(raederVorher - 2);
    /*
     * ALLES, was zur Karosserie gehoert, muss mitgequetscht werden — nicht nur
     * ein bestimmtes Netz. Bis E-117 suchte diese Zeile die Anbauteile an genau
     * 580 Eckpunkten; das ist die Zahl des Bestands. In der Form C sind die
     * Radlaeufe in die Haut geschnitten, die Zahl stimmt nicht mehr, die
     * Absicht schon. Zerlegbare Teile (Motor, Getriebe, Raeder) haengen direkt
     * an der Wrackgruppe und werden nicht gequetscht; alles andere schon.
     *
     * ANGEPASST MIT E-128 (16.10.2026). Bis dahin hiess „gequetscht": der
     * crushGroup hat den y-Massstab der Stufe 2 (0,55). Seitdem knautscht die
     * Fassung C Eckpunkt fuer Eckpunkt (Patrick: „wie eine Blechdose … statt
     * dass nur einzelne Bleche eindellen"), und der Massstab bleibt 1. Die
     * Absicht wird deshalb an der Hoehe geprueft, und strenger als vorher:
     * KEIN Netz der Karosserie — Haut, Scheiben, Stossstangen, Leuchten,
     * Spiegel — ragt hoeher als 10 cm ueber das flache Wrack (0,62 m). Mit der
     * alten Skalierung stand das Dach auf 0,78 m.
     */
    const karosserie = netze(car.group).filter((m) => m.parent !== car.group);
    expect(karosserie.length, "nichts hängt mehr im crushGroup").toBeGreaterThan(0);
    const entkommen = karosserie.filter((m) => {
      m.geometry.computeBoundingBox();
      return m.geometry.boundingBox!.max.y * m.parent!.scale.y + m.position.y > 0.62 + 0.1;
    });
    expect(entkommen.length, "ein Teil der Karosserie entkommt dem Quetschen").toBe(0);
  });

  it("der Bestand quetscht weiter mit dem Massstab seiner Stufe — Ziffer fuer Ziffer wie vor E-128", () => {
    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const car = new CarComposite(CAR_DEF, scene, world, new ItemManager(scene, world), new EventBus(), new THREE.Vector3(0, 1, 0), "bestand");
    car.pressCrush();
    const karosserie = netze(car.group).filter((m) => m.parent !== car.group);
    expect(karosserie.filter((m) => m.parent!.scale.y !== CAR_DEF.crushScales[2]).length).toBe(0);
  });
});

/**
 * GEGENPROBE — der Eckpunktvergleich muss auch melden. Ohne diese Zeilen wäre
 * „Abweichung unter einem Nanometer" ein Satz, der auch bei einem Vergleich
 * zweier leerer Listen grün wird.
 */
describe("Gegenprobe: der Eckpunktvergleich meldet", () => {
  it("einen um einen Zentimeter verrutschten Anbau", () => {
    const echt = altesAnbauteil();
    const schief = altesAnbauteil();
    schief[0]!.translate(0, 0.01, 0);
    expect(abweichung(eckpunkte(echt), eckpunkte(schief))).toBeGreaterThan(1e-9);
  });

  it("und zählt nicht null Eckpunkte als Übereinstimmung", () => {
    expect(eckpunkte(altesAnbauteil()).length).toBe(580);
  });
});
