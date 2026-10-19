import { describe, it, expect } from "vitest";
import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { ExcavatorCollision } from "../src/excavator/collision";
import {
  UNTERWAGEN_HALB_B,
  UNTERWAGEN_HALB_L,
  UNTERWAGEN_R,
} from "../src/excavator/unterwagenParts";
import { STATIC_OBSTACLES, hitsObstacle, type Obstacle } from "../src/world/obstacles";
import { umrissUeberlappung } from "../src/delivery/umriss";
import { CONFIGS } from "../src/world/containers";
import { BAGGER_STAND, SCHWENK_INNEN, SCHWENK_AUSSEN } from "../src/world/baggerstand";

/**
 * DER UNTERWAGEN UND SEIN TASTRAND — ein Waechter gegen zwei Zahlen fuer
 * dieselbe Maschine.
 *
 * Anlass (offener Punkt, bei E-093 mitgefunden): `CHASSIS_PAD` = 1,30 m in
 * `excavator/collision.ts` gegen `UNTERWAGEN_R` = 2,60 m in
 * `excavator/excavator.ts`. Die Bauwerkspruefung nahm die kleine, die
 * Fahrzeugsperre die grosse — und der Unterschied war die Tiefe, um die der
 * Unterwagen in den MUELL-Container hineinfuhr.
 *
 * Seit E-107 kommen beide aus `unterwagenParts.ts`. Dieser Waechter wird rot,
 * wenn sie wieder auseinanderlaufen, und er haelt die gemessene Eindringtiefe
 * fest. Gemessen wird am KAFFEEWAGEN: ein freistehendes Rechteck mitten auf
 * dem Vorplatz, von allen vier Seiten anfahrbar, und in der Hindernisliste
 * ohne Nachbarn, die das Ergebnis verfaelschen.
 *
 * ZU JEDER ZAHL GEHOERT DIE GEGENPROBE MIT DER ALTEN REGEL. Ein Waechter, der
 * nur meldet „null Eindringung", misst sonst seine eigene Definition: Jede
 * Lage, die `chassisHits()` durchlaesst, ist per Bauart ueberschneidungsfrei.
 * Erst der Vergleich mit dem Punkt-mit-Rand von frueher zeigt, dass hier
 * wirklich etwas anders geworden ist.
 */

/**
 * Eine Kollisionspruefung ohne Bagger.
 *
 * `chassisHits()` braucht nur Standort und Blickrichtung — Welt, Greifer und
 * Armglieder ruehrt es nicht an. Deshalb steht hier eine Attrappe statt eines
 * gebauten Baggers: Der bräuchte das Rapier-WASM, und dieser Fall hat mit
 * Physik nichts zu tun.
 */
function pruefung(pos: THREE.Vector3, heading: { rad: number }): ExcavatorCollision {
  return new ExcavatorCollision({
    world: null as unknown as RAPIER.World,
    position: pos,
    getHeading: () => heading.rad,
    grappleGroup: new THREE.Object3D(),
    armShapes: [],
    obstacleBodies: new Set<number>(),
    grippedHandles: new Set<number>(),
    getStaffPos: () => null,
    // chassisHits() fragt weder Greiferkoerper noch eigene Kollider (E-137)
    grappleBody: () => null as unknown as RAPIER.RigidBody,
    selfHandles: new Set<number>(),
  });
}

const LAGEN = 8;
const SCHRITT = 0.1;

/**
 * Abtasten rund um ein Bauwerk: Wie tief kommt der Unterwagen hinein, und wie
 * nah kommt er im schlimmsten Fall heran?
 *
 * `frei` sagt, welche Lagen die Pruefung durchlaesst — einmal die heutige,
 * einmal die alte Regel. Alles andere ist in beiden Faellen dieselbe Rechnung.
 */
function abtasten(
  o: Obstacle,
  frei: (x: number, z: number, rot: number) => boolean
): { tiefe: number; schlimmsteLuft: number } {
  const r = UNTERWAGEN_R + 0.6;
  let tiefe = 0;
  let schlimmsteLuft = 0;
  for (let g = 0; g < LAGEN; g++) {
    const rot = (g * Math.PI) / LAGEN;
    const c = Math.abs(Math.cos(rot));
    const s = Math.abs(Math.sin(rot));
    let luft = Infinity;
    for (let x = o.x - o.hw - r; x <= o.x + o.hw + r; x += SCHRITT) {
      for (let z = o.z - o.hd - r; z <= o.z + o.hd + r; z += SCHRITT) {
        if (!frei(x, z, rot)) continue;
        const d = umrissUeberlappung({ x, z, hw: UNTERWAGEN_HALB_B, hd: UNTERWAGEN_HALB_L, rot }, o);
        if (d > tiefe) tiefe = d;
        if (d > 0) continue;
        const ab = Math.max(
          Math.abs(x - o.x) - (UNTERWAGEN_HALB_B * c + UNTERWAGEN_HALB_L * s + o.hw),
          Math.abs(z - o.z) - (UNTERWAGEN_HALB_B * s + UNTERWAGEN_HALB_L * c + o.hd)
        );
        if (ab >= 0 && ab < luft) luft = ab;
      }
    }
    if (luft !== Infinity && luft > schlimmsteLuft) schlimmsteLuft = luft;
  }
  return { tiefe, schlimmsteLuft };
}

describe("Der Unterwagen und sein Tastrand", () => {
  const kaffee = STATIC_OBSTACLES.find((o) => o.label === "Kaffeewagen")!;

  it("ist EINE Quelle: der Huellkreis ist aus den Halbmassen gerechnet", () => {
    expect(kaffee, "der Kaffeewagen fehlt in der Hindernisliste").toBeTruthy();
    expect(UNTERWAGEN_R).toBeCloseTo(Math.hypot(UNTERWAGEN_HALB_B, UNTERWAGEN_HALB_L), 9);
    /*
     * Und die Halbmasse selbst sind die gebauten: Rad aussen (1,25 + 0,50/2)
     * quer, Rahmenhalblaenge (2,20) laengs. Stuende hier eine andere Zahl,
     * waere der Unterwagen woanders gebaut worden als er geprueft wird.
     */
    expect(UNTERWAGEN_HALB_B).toBeCloseTo(1.5, 6);
    expect(UNTERWAGEN_HALB_L).toBeCloseTo(2.2, 6);
  });

  it("faehrt in kein Bauwerk mehr hinein — und die alte Regel liess 1,30 m zu", () => {
    const pos = new THREE.Vector3();
    const heading = { rad: 0 };
    const col = pruefung(pos, heading);
    const jetzt = abtasten(kaffee, (x, z, rot) => {
      pos.set(x, 0, z);
      heading.rad = rot;
      return !col.chassisHits();
    });
    expect(jetzt.tiefe, "der Unterwagen steckt in einem Bauwerk").toBeLessThanOrEqual(0.001);

    /*
     * GEGENPROBE: dieselbe Abtastung mit dem Punkt-und-Rand von vor E-107.
     *
     * Die Schranke steht auf 1,20 und nicht auf 1,35: Bei diesem groben Raster
     * (10 cm, 8 Gierlagen) kommen 1,28 m heraus, `tools/unterwagen-rand.ts`
     * misst mit 5 cm und 24 Lagen 1,35 m. Der Waechter soll den FEHLER sehen,
     * nicht die Rasterweite nachpruefen.
     */
    const frueher = abtasten(kaffee, (x, z) => hitsObstacle(x, z, 1.3) === null);
    expect(
      frueher.tiefe,
      "die alte Regel laesst den Unterwagen nicht mehr ins Bauwerk — dann misst dieser Fall nichts"
    ).toBeGreaterThan(1.2);
  });

  it("bremst aber auch nicht zu frueh — kein Rand, der groesser ist als die Maschine", () => {
    /*
     * DIE ANDERE HAELFTE DES BEFUNDS, und sie ist nicht kosmetisch: Der erste
     * Reparaturversuch war `CHASSIS_PAD = UNTERWAGEN_R`. Er nimmt die
     * Eindringung weg, laesst die Maschine dafuer bis zu 0,76 m vor dem
     * Hindernis stehen (`tools/unterwagen-rand.ts`) — und nimmt dem
     * MUELL-Container seinen letzten Startplatz. Bliebe dieser Fall aus,
     * waere jeder zu grosse Rand eine gruene Reparatur.
     *
     * Die Schranke ist die Rasterweite plus ein Zentimeter Rechenluft: Naeher
     * als ein Rasterschritt kann keine abgetastete Lage sein.
     */
    const pos = new THREE.Vector3();
    const heading = { rad: 0 };
    const col = pruefung(pos, heading);
    const jetzt = abtasten(kaffee, (x, z, rot) => {
      pos.set(x, 0, z);
      heading.rad = rot;
      return !col.chassisHits();
    });
    expect(
      jetzt.schlimmsteLuft,
      `der Unterwagen haelt ${jetzt.schlimmsteLuft.toFixed(2)} m vor dem Kaffeewagen an`
    ).toBeLessThanOrEqual(SCHRITT + 0.01);

    // Gegenprobe: mit dem Huellkreis als Rand waere genau das nicht mehr so.
    const mitKreis = abtasten(kaffee, (x, z) => hitsObstacle(x, z, UNTERWAGEN_R) === null);
    expect(
      mitKreis.schlimmsteLuft,
      "auch ein Rand von 2,66 m bremst nicht zu frueh — dann misst dieser Fall nichts"
    ).toBeGreaterThan(0.4);
  });
});

describe("Der Startplatz des MUELL-Containers haengt an derselben Zahl", () => {
  /*
   * E-041 hat den Startplatz aus vier Schranken hergeleitet, und eine davon
   * ist die halbe Breite des Unterwagens. Sie stand dort als abgeschriebene
   * 1,30 — mit dem wirklichen Mass (1,50) lag der alte Platz (−3,79 | −14,11)
   * einen Zentimeter IN der Fahrlinie. Dieser Fall haelt die Rechnung an der
   * Quelle fest: Wer `UNTERWAGEN_HALB_B` aendert, sieht hier sofort, dass der
   * Container mitwandern muss.
   */
  const muell = CONFIGS.find((c) => c.id === "r_rubble")!;
  const HW = muell.size[0] / 2;
  const HD = muell.size[1] / 2;
  /** So viel Luft muss zu jeder der vier Schranken bleiben (E-041, silos.test). */
  const MINDESTLUFT = 0.15;
  /**
   * ZWEI SCHRANKEN TEILEN SICH SEIT E-110 EINE TASCHE VON 0,12 m.
   *
   * Die Nordflanke der Buntmetall-Mulde endet auf z −16,25 und nicht auf
   * −16,45: Die Hindernisliste fuehrte die Wand 0,35 m dick und auf der
   * Muldenkante, gebaut sind 0,55 m und davor (`MULDE_STEIN`, E-110). Damit
   * bleibt zwischen Wand (−16,25 + 2,15 halbe Containertiefe = −14,10) und dem
   * Schwenkbandrand (−13,98 bei x −3,96) nur noch eine Tasche von 0,12 m.
   *
   * 0,15 m an BEIDEN Enden sind darin nicht unterzubringen — nachgerechnet:
   * 0,15 m Wandluft verlangt z ≥ −13,95, das Schwenkband verlangt z ≤ −13,98.
   * Der Container steht deshalb in der MITTE der Tasche, mit 0,06 m zu jeder
   * Seite. Wer es weiter haben will, muss ihn aus der Tasche nehmen, und das
   * ist eine Gestaltungsfrage (Ansage war „Direkt neben Buntmetall-Mulde").
   *
   * Die anderen zwei Schranken behalten ihre 0,15 m: dort ist Platz.
   */
  const TASCHENLUFT = 0.05;

  it("1 — die Mitte liegt im Schwenkband des Baggers", () => {
    const d = Math.hypot(muell.x - BAGGER_STAND.x, muell.z - BAGGER_STAND.z);
    expect(d - SCHWENK_INNEN).toBeGreaterThanOrEqual(MINDESTLUFT);
    expect(SCHWENK_AUSSEN - d, `${d.toFixed(2)} m vom Sitz`).toBeGreaterThanOrEqual(TASCHENLUFT);
  });

  /*
   * SEIT E-183 STEHT ER MIT ABSICHT 0,80 m IN DER FAHRLINIE (Patrick: „direkt
   * vor dem Bagger an der Wand zum Buntmetall"). Die Rechnung haengt weiter an
   * `UNTERWAGEN_HALB_B`: Wird die Maschine breiter, waechst der Ueberstand,
   * und der Waechter meldet es.
   */
  it("3 — höchstens 0,80 m in der Fahrlinie nach vorn, gerechnet mit der halben Breite (E-183)", () => {
    const noetig = HW + UNTERWAGEN_HALB_B;
    const seitlich = Math.abs(muell.x - BAGGER_STAND.x);
    expect(
      seitlich - noetig,
      `${(noetig - seitlich).toFixed(2)} m in der Fahrlinie, erlaubt sind 0,80 m`
    ).toBeGreaterThanOrEqual(-0.8 - 1e-9);

    // Gegenprobe: mit der alten 1,30 waere die Schranke schwaecher.
    expect(UNTERWAGEN_HALB_B, "die halbe Breite ist wieder auf 1,30 gerutscht").toBeGreaterThan(1.3);
  });

  it("4 — die Rueckfahrspur der LKW bleibt frei", () => {
    // 6,30 − 1,55 (halbe LKW-Breite) − 1,40 (Halteabstand), siehe containers.ts
    expect(3.35 - (muell.x + HW)).toBeGreaterThanOrEqual(MINDESTLUFT);
  });

  it("2 — und er steht in keinem Bauwerk, auch nicht in der Nordwand der Mulde", () => {
    let engste = Infinity;
    let wo = "";
    for (const o of STATIC_OBSTACLES) {
      const d = Math.max(
        Math.abs(muell.x - o.x) - (HW + o.hw),
        Math.abs(muell.z - o.z) - (HD + o.hd)
      );
      if (d < engste) {
        engste = d;
        wo = o.label;
      }
    }
    expect(engste, `der MUELL kommt ${engste.toFixed(2)} m an „${wo}" heran`).toBeGreaterThanOrEqual(
      MINDESTLUFT - 1e-9
    );
    /*
     * E-183: Die Tasche aus E-110 ist verlassen. Er steht jetzt AN der
     * Schwelle der BUNT + VA — „an der Wand zum Buntmetall": der naechste
     * Bau ist die Mulde, und er ist hoechstens 0,20 m davon weg.
     */
    expect(wo.startsWith("BUNT + VA"), `naechster Bau ist ${wo}`).toBe(true);
    expect(engste, "er steht nicht an der Mulde").toBeLessThanOrEqual(0.2);
  });
});
