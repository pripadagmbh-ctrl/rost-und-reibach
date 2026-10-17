import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { alleHindernisse, hitsObstacle } from "../world/obstacles";
import { umrissUeberlappung } from "../delivery/umriss";
import { UNTERWAGEN_HALB_B, UNTERWAGEN_HALB_L } from "./unterwagenParts";

/**
 * Kollisionsprüfung des Baggers.
 *
 * Unterwagen, Ausleger, Stiel und Spinne sind kinematische Körper: Die Physik
 * hält sie nicht auf, sie würden einfach durch Mauern, Mulden und Fahrzeuge
 * hindurchfahren. Deshalb prüft der Bagger vor jedem Bild selbst, ob seine
 * Bauteile irgendwo hineinragen, und nimmt die Bewegung dann zurück.
 *
 * Zwei Dinge sind dabei entscheidend und waren beide schon einmal falsch:
 *
 * 1. Fahrwerk und Arm werden getrennt geprüft. Sonst legt ein Hindernis neben
 *    den Rädern auch den Ausleger stillt.
 * 2. Es muss einen Fluchtweg geben. Steckt ein Bauteil wirklich fest, werden
 *    Bewegungen wieder durchgelassen — sonst verkantet der Arm unrettbar,
 *    weil auch die befreiende Bewegung zurückgenommen würde.
 */

/** Ein Armglied als Quader: Mesh für die Pose, Halbmaße für die Abfrage. */
export interface ArmShape {
  mesh: () => THREE.Mesh;
  half: [number, number, number];
}

export interface CollisionContext {
  world: RAPIER.World;
  /** Standort des Unterwagens */
  position: THREE.Vector3;
  /**
   * Blickrichtung des Unterwagens (rad, `Excavator.heading`).
   *
   * Nicht die des Oberwagens: Der schwenkt, das Fahrwerk nicht. Gebraucht
   * wird sie, seit `chassisHits()` den wirklichen Grundriss prueft statt eines
   * Punktes mit Rand.
   */
  getHeading: () => number;
  grappleGroup: THREE.Object3D;
  /** Koerper der Spinne (Korb und Schalen) — seine Kontakte entscheiden beim Pfluegen (E-137) */
  grappleBody: () => RAPIER.RigidBody;
  armShapes: ArmShape[];
  /** Körper des Fahrzeugs auf dem Platz */
  obstacleBodies: Set<number>;
  /** Was in der Spinne hängt, blockiert sie nicht selbst */
  grippedHandles: Set<number>;
  /** Position des Platzwarts, damit der Arm ihn verschont */
  getStaffPos: () => THREE.Vector3 | null;
}

/*
 * DER UNTERWAGEN HAT KEINEN EIGENEN TASTRAND MEHR (21.09.2026).
 *
 * Hier stand `CHASSIS_PAD = 1.3`, waehrend die Sperre gegen stehende
 * Fahrzeuge in `excavator.ts` mit `UNTERWAGEN_R = 2.6` rechnete — zwei Zahlen
 * fuer dieselbe Maschine, und gegen alles Gemauerte gewann die kleinere.
 * Gemessen (`tools/unterwagen-rand.ts`) fuhr der Unterwagen damit **1,35 m**
 * in den MUELL-Container, 1,35 m in den Kaffeewagen, 0,70 m in eine
 * Muldenstirnwand und 0,60 m in die Westmauer.
 *
 * WARUM NICHT EINFACH `CHASSIS_PAD = UNTERWAGEN_R`. Das war der erste
 * Versuch, und er ist gemessen gescheitert. `hitsObstacle` erweitert das
 * Bauwerk auf BEIDEN Achsen um `pad` — ein Rand von 2,663 m behandelt die
 * Maschine also als 5,33 x 5,33 m grosses Quadrat statt als 3,00 x 4,40 m
 * grosses Rechteck, das sich dreht. Die Folgen, beide gemessen:
 *
 *   - Sie haelt bis zu 0,76 m VOR dem Hindernis an (gemessene untere Schranke
 *     an der Westmauer; am MUELL-Container 0,49 m). Das ist derselbe Fehler
 *     nochmal, nur mit dem Vorzeichen andersherum — und ein Bagger, der einen
 *     Dreiviertelmeter vor der Wand steht, sieht aus, als haenge die Steuerung.
 *   - Fuer den MUELL-Container gibt es dann ueberhaupt keinen Startplatz mehr:
 *     Die vier Schranken aus E-041 haben zusammen KEINE Loesung
 *     (`tools/unterwagen-rand.ts`, Abschnitt TASCHE).
 *
 * JETZT: der wirkliche Grundriss, mitgedreht. Die beiden Halbmasse kommen aus
 * `unterwagenParts.ts` — derselben Quelle, aus der auch `UNTERWAGEN_R` fuer
 * die Fahrzeugsperre gerechnet wird (`UNTERWAGEN_R = hypot(HALB_B, HALB_L)`).
 * Eine Quelle, zwei Ableitungen, keine gepflegte Zweitzahl.
 *
 * Gerechnet mit `umrissUeberlappung` aus `delivery/umriss.ts`: gedrehtes
 * Rechteck gegen achsparalleles Bauwerk, Trennachsensatz — dieselbe Funktion,
 * mit der auch die LKW nach vorn schauen. Eine zweite Rechnung waere eine
 * zweite Wahrheit.
 *
 * WAS ES KOSTET, gemessen (`tools/unterwagen-rand.ts`, Abschnitt KOSTEN, 52
 * Bauwerke): 4,09 statt 0,90 µs je Aufruf. `chassisHits()` laeuft hoechstens
 * dreimal je Bild, also **0,0123 statt 0,0027 ms** — ein Hundertstel
 * Millisekunde bei einem Bildbudget von 21 ms auf Patricks Geraet.
 */
const UNTERWAGEN_UMRISS = {
  x: 0,
  z: 0,
  hw: UNTERWAGEN_HALB_B,
  hd: UNTERWAGEN_HALB_L,
  rot: 0,
};
/** Sicherheitsabstand von Ausleger und Stiel */
const ARM_PAD = 0.2;
/**
 * Sicherheitsabstand der Spinne zu Bauten.
 *
 * Frueher 0,9 m — die Spinne blieb einen knappen Meter vor jeder Muldenwand
 * stehen, ohne dass etwas zu sehen war. Das las sich als Haken in der
 * Steuerung, nicht als Anstossen. Seit die Krallen eigene Kollider haben und
 * der Bodenanschlag die Flaechen misst, braucht es den grossen Puffer nicht
 * mehr: Was wirklich anstoesst, haelt die Physik auf.
 */
const GRAPPLE_PAD = 0.25;
/** Radius der Prüfkugel im Schalenkorb */
const PROBE_R = 0.62;
/**
 * Radius, in dem die Spinne Material verdrängt. Größer als die Prüfkugel:
 * Beim Pflügen durch einen Haufen schiebt sie auch, was sie nur streift.
 * Seit E-137 zaehlt die Kugel erst, wenn die Spinne wirklich anstoesst.
 */
const PLOW_R = 1.15;
/** Ab diesem Abstand (m) gilt ein Rapier-Kontaktpunkt als Beruehrung — wie E-134 */
const PLOW_KONTAKT = 0.01;
/**
 * Masse, bei der die Achsen auf die Hälfte einbrechen. Am Bild abgestimmt:
 * Bei 750 kg war der Unterschied kaum zu merken, weil die Spinne beim
 * Schwenken ohnehin aus dem Haufen herausläuft und der Widerstand dabei
 * abfällt. Bei 350 kg pflügt man spürbar zäh.
 */
/**
 * Bei dieser verdraengten Masse halbiert sich das Tempo.
 *
 * Vorher 350 kg bei einem Tastradius von 1,45 m — in einem Haufen liegen darin
 * schnell ueber 1000 kg, und der Bagger kroch mit einem Fuenftel Tempo, sobald
 * die Spinne den Schrott auch nur beruehrte. Widerstand soll spuerbar sein,
 * nicht laehmend: 900 kg und eine hoehere Untergrenze lassen die Bewegung
 * schwer werden, ohne sie anzuhalten (Befund 10.09.2026).
 */
/*
 * Bei dieser verdraengten Masse halbiert sich das Tempo.
 *
 * Stand auf 900 kg. Gemessen am 11.09.2026 lagen beim Durchpfluegen des
 * Haufens 800 bis 1260 kg in der Pruefkugel — der Schwenk fiel damit von 36
 * auf rund 16 Grad je Sekunde. Das war immer noch zu flott ("es fliegt wie
 * nichts durch den Schrott"), und zwar zu Recht: Der Arm ist kinematisch, er
 * kann durch Kontakt gar nicht gebremst werden. Dieser Faktor ist der einzige
 * Ersatz fuer die Kraft, die eine Tonne verhakter Stahl einem Ausleger
 * entgegensetzt — und eine Tonne haelt einen Ausleger fast auf.
 */
const PLOW_HALF_KG = 500;
/** So langsam wird es hoechstens — darunter steht die Maschine praktisch */
const PLOW_MIN = 0.2;
/** Ab dieser Masse ist ein Brocken nicht mehr wegzuschieben */
const HEAVY_BLOCK_KG = 700;
/** So nah darf die tief hängende Spinne an den Platzwart heran */
const STAFF_CLEARANCE = 1.9;

const IDENT_QUAT = { x: 0, y: 0, z: 0, w: 1 };
/**
 * Prüfkugel im Schalenkorb, kleiner als die Spinne: Ein Stück weit dürfen
 * sich die Krallen eingraben — sie schneiden ja auch mal durch Blech —, aber
 * sie sollen nicht im Objekt verschwinden. Sie wird erst beim ersten Gebrauch
 * angelegt, weil beim Laden des Moduls das Rapier-WASM noch nicht
 * initialisiert ist.
 */
let probe: RAPIER.Ball | null = null;
let plowProbe: RAPIER.Ball | null = null;

export class ExcavatorCollision {
  /**
   * Zuletzt gültiger Zustand war frei. Ist das false, sitzt das Bauteil fest
   * und darf sich frei herausbewegen — der Fluchtweg.
   */
  armFree = true;
  chassisFree = true;

  private pos = new THREE.Vector3();
  private local = new THREE.Vector3();
  private armPos = new THREE.Vector3();
  private armQuat = new THREE.Quaternion();

  constructor(private ctx: CollisionContext) {}

  /**
   * Wie viel Masse die Spinne gerade vor sich herschiebt.
   *
   * Wer mit dem Greifer durch einen Schrottberg pflügt, muss den Widerstand
   * spüren: Gewicht und Reibung des verdrängten Materials summieren sich.
   * Ohne das gleitet die Spinne durch den Haufen, als wäre er Luft — sie ist
   * ja ein kinematischer Körper und wird von der Physik nicht gebremst.
   */
  plowMassKg(): number {
    /*
     * E-137: ERST WENN DIE SPINNE WIRKLICH ANSTOESST, UND NUR IN FAHRTRICHTUNG.
     *
     * Gezaehlt wurde immer alles, was in einer Kugel von 1,15 m um die
     * Korbmitte liegt — auch wenn die Schalen es noch gar nicht erreicht
     * hatten. Gemessen (`tools/haemmern.ts`): Ueber einem 1,3-t-Minibagger fiel
     * der Faktor auf 0,28, BEVOR eine Schale ihn traf, und die Spinne kam mit
     * 0,5–0,7 statt 2,3 m/s an. Das war Patricks „die spinne bremst beim
     * hämmern ab. Bremsen kann nur das material oder den boden die spinne."
     *
     * Die Kugel bleibt das Mass dafuer, WIE VIEL Material sich staut — damit
     * bleibt das Pfluegen durch den Haufen so zaeh, wie es am 11.09. abgestimmt
     * wurde. Neu ist das Tor davor (`stoesstAn`): Sie zaehlt erst, wenn Korb
     * oder Schalen einen losen Koerper beruehren und sich in ihn hineinbewegen.
     * Wer frei faellt oder aus dem Haufen heraushebt, wird nicht gebremst.
     */
    this.ctx.grappleGroup.getWorldPosition(this.pos);
    const vx = this.pos.x - this.lastGrapple.x;
    const vy = this.pos.y - this.lastGrapple.y;
    const vz = this.pos.z - this.lastGrapple.z;
    this.lastGrapple.copy(this.pos);
    if (!this.beruehrt(vx, vy, vz)) return 0;
    plowProbe ??= new RAPIER.Ball(PLOW_R);
    this.pos.y -= 1.35;
    let masse = 0;
    this.ctx.world.intersectionsWithShape(this.pos, IDENT_QUAT, plowProbe, (collider) => {
      const b = collider.parent();
      // Nie vorzeitig abbrechen — sonst bleibt der Rapier-Borrow offen
      if (!b || !b.isDynamic()) return true;
      // Was in der Spinne hängt, zählt separat als Traglast
      if (this.ctx.grippedHandles.has(b.handle)) return true;
      masse += b.mass();
      return true;
    });
    return masse;
  }
  private lastGrapple = new THREE.Vector3();

  /**
   * E-137: Welchen losen Koerper beruehrt die Spinne (Korb oder eine Schale)
   * gerade? Mit `v` (Bewegung des Gelenks) nur einen, in den sie sich
   * hineinbewegt; ohne irgendeinen. Gelesen werden die Kontakte, die Rapier im
   * letzten Schritt ohnehin berechnet hat — nur lesend (v2 E-044). Auch vom
   * Haemmern und Druecken benutzt (`Excavator.meldeSpinne`).
   */
  beruehrt(vx = 0, vy = 0, vz = 0, nurInRichtung = true): RAPIER.RigidBody | null {
    const g = this.ctx.grappleBody();
    const world = this.ctx.world;
    let ja: RAPIER.RigidBody | null = null;
    for (let i = 0; i < g.numColliders() && !ja; i++) {
      const c = g.collider(i);
      if (!c.isEnabled()) continue;
      world.contactPairsWith(c, (o) => {
        const b = o.parent();
        if (ja || !b || !b.isDynamic() || this.ctx.grippedHandles.has(b.handle)) return;
        world.contactPair(c, o, (m, flipped) => {
          let beruehrt = false;
          for (let k = 0; k < m.numContacts(); k++) if (m.contactDist(k) < PLOW_KONTAKT) beruehrt = true;
          // Die Normale zeigt vom ersten Kollider zum zweiten
          const n = m.normal();
          if (beruehrt && (!nurInRichtung || (n.x * vx + n.y * vy + n.z * vz) * (flipped ? -1 : 1) > 0)) ja = b;
        });
      });
    }
    return ja;
  }

  /**
   * Faktor auf die Achsgeschwindigkeit durch verdrängtes Material.
   * 1 = freie Luft, gegen 0,2 = tief im Haufen.
   */
  plowFactor(): number {
    const m = this.plowMassKg();
    return Math.max(PLOW_MIN, 1 / (1 + m / PLOW_HALF_KG));
  }

  /**
   * Steht der Unterwagen in einem festen Bauwerk? Rein zweidimensional.
   *
   * Der Grundriss dreht mit der Maschine mit: Laengs an einer Mauer entlang
   * darf sie naeher heran als quer davor. `alleHindernisse()` enthaelt die
   * beweglichen Behaelter zuerst — dieselbe Liste in derselben Reihenfolge,
   * die auch `hitsObstacle` durchgeht.
   */
  chassisHits(): boolean {
    const p = this.ctx.position;
    UNTERWAGEN_UMRISS.x = p.x;
    UNTERWAGEN_UMRISS.z = p.z;
    UNTERWAGEN_UMRISS.rot = this.ctx.getHeading();
    for (const o of alleHindernisse()) {
      if (umrissUeberlappung(UNTERWAGEN_UMRISS, o) > 0) return true;
    }
    return false;
  }

  /** Ragt irgendein Teil des Arms in etwas hinein, wo es nicht hingehört? */
  armHits(): boolean {
    if (this.grappleHitsBuilding()) return true;
    if (this.grappleHitsBody()) return true;
    if (this.armHitsBuilding()) return true;
    if (this.armHitsStaff()) return true;
    return this.ctx.obstacleBodies.size > 0 && this.armHitsVehicle();
  }

  /** Spinne gegen Mauern, Mulden und Schere. */
  private grappleHitsBuilding(): boolean {
    this.ctx.grappleGroup.getWorldPosition(this.pos);
    return hitsObstacle(this.pos.x, this.pos.z, GRAPPLE_PAD, this.pos.y - 1.2) !== null;
  }

  /**
   * Steckt die Spinne in einem Fahrzeug oder einem schweren Brocken?
   *
   * Leichter Schrott wird bewusst nicht geprüft, sonst käme man nicht mehr in
   * einen Haufen hinein; den schieben die Krallen-Kollider ohnehin beiseite.
   */
  private grappleHitsBody(): boolean {
    probe ??= new RAPIER.Ball(PROBE_R);
    this.ctx.grappleGroup.getWorldPosition(this.pos);
    this.pos.y -= 1.35; // Mitte des Schalenkorbs
    let hit = false;
    this.ctx.world.intersectionsWithShape(this.pos, IDENT_QUAT, probe, (collider) => {
      const b = collider.parent();
      // Nie vorzeitig abbrechen: Rapier hält die Welt während der Abfrage
      // geborgt, und ein offener Borrow lässt den nächsten schreibenden
      // Zugriff mit "recursive use of an object" abstürzen.
      if (!b || hit) return true;
      if (this.ctx.obstacleBodies.has(b.handle)) {
        hit = true; // Fahrzeug auf dem Platz
        return true;
      }
      if (this.ctx.grippedHandles.has(b.handle)) return true; // eigene Ladung
      // Feste Körper (Bauten) blockieren, nur der Boden zählt nicht mit
      if (b.isFixed() && collider.translation().y > -0.05) hit = true;
      else if (b.isDynamic() && b.mass() > HEAVY_BLOCK_KG) hit = true;
      return true;
    });
    return hit;
  }

  /** Ausleger und Stiel an mehreren Punkten entlang abtasten. */
  private armHitsBuilding(): boolean {
    for (const s of this.ctx.armShapes) {
      const mesh = s.mesh();
      mesh.updateWorldMatrix(true, false);
      for (const t of [-0.8, -0.3, 0.2, 0.7]) {
        this.local.set(0, 0, s.half[2] * 2 * t);
        this.pos.copy(this.local).applyMatrix4(mesh.matrixWorld);
        if (hitsObstacle(this.pos.x, this.pos.z, ARM_PAD, this.pos.y - s.half[1])) return true;
      }
    }
    return false;
  }

  /** Der Platzwart darf nicht vom Ausleger überfahren werden. */
  private armHitsStaff(): boolean {
    const lam = this.ctx.getStaffPos();
    if (!lam) return false;
    this.ctx.grappleGroup.getWorldPosition(this.pos);
    if (this.pos.y - 2.2 >= 2.4) return false; // Spinne hängt hoch genug
    return Math.hypot(this.pos.x - lam.x, this.pos.z - lam.z) < STAFF_CLEARANCE;
  }

  /** Schneidet Ausleger oder Stiel das Fahrzeug auf dem Platz? */
  private armHitsVehicle(): boolean {
    for (const s of this.ctx.armShapes) {
      const mesh = s.mesh();
      mesh.updateWorldMatrix(true, false);
      mesh.getWorldPosition(this.armPos);
      mesh.getWorldQuaternion(this.armQuat);
      const shape = new RAPIER.Cuboid(s.half[0], s.half[1], s.half[2]);
      let hit = false;
      this.ctx.world.intersectionsWithShape(this.armPos, this.armQuat, shape, (collider) => {
        const b = collider.parent();
        if (b && this.ctx.obstacleBodies.has(b.handle)) hit = true;
        return true; // nie vorzeitig abbrechen, siehe grappleHitsBody
      });
      if (hit) return true;
    }
    return false;
  }
}
