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
  /** Die eigenen Koerper des Baggers — gegen sie stoesst eine Last nicht an (E-145) */
  selfHandles: Set<number>;
  /**
   * E-152: Tiefe der Pruefkugel unter dem Gelenk (m). Spinne: 1,35 (Korbmitte).
   * Magnet: so, dass die Kugel an der Unterseite der Scheibe endet — sonst
   * hielt sie den Arm 0,37 m ueber jedem Brocken an, und die Scheibe kam nie
   * an ihn heran.
   */
  pruefTiefe?: () => number;
}

/**
 * E-157: Woran die Spinne oder ein gehaltenes Teil gerade angeschlagen ist —
 * fuer den Klang. `koerper`: der getroffene Koerper (null bei Bauwerken aus
 * der Hindernisliste), `label`: deren Name, `punkt`: ungefaehrer Ort,
 * `tempoMs`: wie schnell die Bewegung ging, die gestoppt wurde.
 */
export interface Anschlag {
  koerper: RAPIER.RigidBody | null;
  label: string | null;
  punkt: THREE.Vector3;
  tempoMs: number;
}

/** Ein gehaltenes Teil mit seiner Pose relativ zur Spinne (`GripSystem.gehalten`) */
export interface GehaltenesTeil {
  body: RAPIER.RigidBody;
  vonPos: THREE.Vector3;
  vonQuat: THREE.Quaternion;
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
export const PROBE_R = 0.62;
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
/*
 * E-152: ZWEI KUENSTLICHE BREMSEN AN GROSSEN TEILEN.
 *
 * Gemessen (`tools/lastbremse.ts`): Auf einem 2,2-t-Seecontainer aufgesetzt
 * schwenkte die Maschine je nach Lauf mit 7,8 bis 30 °/s statt 30,7, der
 * Pflugfaktor fiel bis 0,20 — obwohl die Spinne nur auf dem Dach lag und der
 * Container sich nicht bewegte. Zwei Ursachen:
 *  1. Das Tor (`beruehrt`) liess jeden Kontakt durch, dessen Normale auch nur
 *     ein bisschen in Bewegungsrichtung zeigte. Wer auf einem Dach schwenkt,
 *     hat eine fast senkrechte Normale und eine waagrechte Bewegung — das ist
 *     Gleiten, kein Schieben.
 *  2. Die Kugel zaehlte dann die ganze Masse aller Koerper darin, auch die,
 *     die sich gar nicht bewegten.
 * Jetzt: Das Tor verlangt, dass die Bewegung wirklich in den Koerper geht
 * (`PLOW_RICHTUNG_COS`), und ein Brocken ueber `HEAVY_BLOCK_KG` zaehlt nur,
 * wenn er tatsaechlich mitgeht (`PLOW_BEWEGT_MS`). Zieht eine Schale einen
 * Container mit, bremst er wie bisher; liegt die Spinne nur auf, bremst er
 * nicht. Der Haufen aus Kleinteilen zaehlt wie am 11.09. abgestimmt ganz —
 * gemessen: nur Bewegtes zu zaehlen haette ihn von 26,9 auf 29,7 °/s (frei
 * 30,7) leichtgaengig gemacht. Seitlich an einen Brocken anfahren haelt
 * die Spinne an (`grappleSchiebtBrocken`): Vorher schob sie einen
 * 2,2-t-Container 1,3 m weit — gebremst, aber mit unendlicher Kraft.
 */
/** SW: cos 72° — so steil muss die Bewegung in den Koerper zeigen, damit es Schieben ist und nicht Gleiten */
const PLOW_RICHTUNG_COS = 0.3;
/** SW: Ab diesem Tempo (m/s) weicht ein Koerper — darunter liegt er (Zittern im Haufen bleibt darunter) */
const PLOW_BEWEGT_MS = 0.15;
/** So langsam wird es hoechstens — darunter steht die Maschine praktisch */
const PLOW_MIN = 0.2;
/** Ab dieser Masse ist ein Brocken nicht mehr wegzuschieben */
const HEAVY_BLOCK_KG = 700;
/**
 * E-145: So tief darf ein gehaltenes Teil in Festes druecken, bevor die
 * Bewegung zurueckgenommen wird (m). Vorschlag des Welt-Agenten (E-138): ein
 * wenig Einfedern wie beim geworfenen Wrack (gemessen Pkw bis 0,08 m), aber
 * kein Durchtauchen.
 */
const HALT_EINFEDERN_M = 0.05;
/**
 * Rechenrauschen beim Entlanggleiten an einer Wand (m, SW). Klein genug, dass
 * daraus kein Hineinkriechen wird: Schon das erste Bild der Schwenkrampe
 * bewegt ein Auto 4 mm.
 */
const HALT_RAUSCHEN_M = 0.0005;
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
  private hPos = new THREE.Vector3();
  private hQuat = new THREE.Quaternion();
  private hInv = new THREE.Quaternion();
  private hcPos = new THREE.Vector3();
  private hcQuat = new THREE.Quaternion();
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
      // E-152: ein ruhender Brocken ist kein Pflugmaterial — er zaehlt erst, wenn er mitgeht
      const v = b.linvel();
      if (b.mass() > HEAVY_BLOCK_KG && Math.hypot(v.x, v.y, v.z) < PLOW_BEWEGT_MS) return true;
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
    // E-152: Bewegung muss steiler als PLOW_RICHTUNG_COS in den Koerper gehen
    const schwelle = PLOW_RICHTUNG_COS * Math.hypot(vx, vy, vz);
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
          if (!beruehrt) return;
          if (!nurInRichtung || (n.x * vx + n.y * vy + n.z * vz) * (flipped ? -1 : 1) > schwelle) ja = b;
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

  /**
   * E-157: Der zuletzt erkannte Anschlag der Spinne (aus `armHits`) bzw. eines
   * gehaltenen Teils (aus `gehaltenesStoesstAn`). Nur gueltig im selben
   * Schritt, in dem die Abfrage `true` ergab.
   */
  readonly anschlag: Anschlag = { koerper: null, label: null, punkt: new THREE.Vector3(), tempoMs: 0 };
  /** E-157: Hat die letzte Abfrage (`armHits`/`gehaltenesStoesstAn`) einen Anschlag gemerkt? */
  anschlagFrisch = false;
  private merkeAnschlag(koerper: RAPIER.RigidBody | null, label: string | null, x: number, y: number, z: number, tempoMs: number): void {
    this.anschlagFrisch = true;
    this.anschlag.koerper = koerper;
    this.anschlag.label = label;
    this.anschlag.punkt.set(x, y, z);
    this.anschlag.tempoMs = tempoMs;
  }
  /** Tempo der Spinne im versuchten Schritt (m/s) — fuer den Anschlag */
  private spinnenTempo(): number {
    this.ctx.grappleGroup.getWorldPosition(this.pos);
    return this.pos.distanceTo(this.lastGrapple) * 60;
  }

  /** Ragt irgendein Teil des Arms in etwas hinein, wo es nicht hingehört? */
  armHits(): boolean {
    this.anschlagFrisch = false;
    if (this.grappleHitsBuilding()) return true;
    if (this.grappleHitsBody()) return true;
    if (this.grappleSchiebtBrocken()) return true;
    if (this.armHitsBuilding()) return true;
    if (this.armHitsStaff()) return true;
    return this.ctx.obstacleBodies.size > 0 && this.armHitsVehicle();
  }

  /**
   * E-145: Drueckte die Bewegung der Spinne von `vorher` nach `jetzt` ein
   * gehaltenes Teil tiefer in Festes, als es schon steckt?
   *
   * Patrick, 17.10.2026: „Körper wie autos gehen durch Betonwände oder
   * scherenwände." Ein Teil in der Spinne ist kinematisch und haelt an nichts
   * an. Darum wird fuer beide Posen gerechnet, wie tief es stuende — mit den
   * Waenden, wie sie JETZT stehen. Gesperrt ist nur, was tiefer hineinfuehrt
   * als `HALT_EINFEDERN_M`; alles, was die Tiefe haelt oder verkleinert,
   * geht durch. Das ist der Fluchtweg, und es gibt keinen Zustand, der ihn
   * verschliessen koennte (keine Ratsche wie in E-137): Faehrt ein Laster in
   * das gehaltene Auto, steigen beide Tiefen gleich, und der Bagger bleibt
   * bedienbar.
   */
  gehaltenesStoesstAn(
    gehalten: ReadonlyArray<GehaltenesTeil>,
    vorherPos: THREE.Vector3,
    vorherQuat: THREE.Quaternion,
    jetztPos: THREE.Vector3,
    jetztQuat: THREE.Quaternion
  ): boolean {
    this.anschlagFrisch = false;
    for (const t of gehalten) {
      if (!t.body.isValid()) continue;
      const neu = this.tiefeBei(t, gehalten, jetztPos, jetztQuat);
      if (neu <= HALT_EINFEDERN_M) continue;
      const fx = this.hPos.x;
      const fy = this.hPos.y;
      const fz = this.hPos.z;
      const fk = this.tiefeFund.koerper;
      const fp = this.tiefeFund.punkt.clone();
      const alt = this.tiefeBei(t, gehalten, vorherPos, vorherQuat);
      if (neu > Math.max(alt, HALT_EINFEDERN_M) + HALT_RAUSCHEN_M) {
        // E-157: Anschlag merken — Tempo des Teils im versuchten Schritt
        this.merkeAnschlag(fk, null, fp.x, fp.y, fp.z, Math.hypot(fx - this.hPos.x, fy - this.hPos.y, fz - this.hPos.z) * 60);
        return true;
      }
    }
    return false;
  }

  /**
   * Wie tief stuende ein gehaltenes Teil in Festem, wenn die Spinne an
   * (gPos, gQuat) haengt? Fest heisst: feste Koerper ausser dem Boden
   * (dieselbe Regel wie `eindringtiefeInBauwerk` in `world/obstacles.ts`) und
   * fremde kinematische — Laster samt Bordwand, Streifenwagen, Pressstempel.
   * Lose Teile und bewegliche Mulden sind dynamisch und werden geschoben.
   *
   * Treffer erst sammeln, dann messen (v2 E-044).
   */
  /** E-157: tiefster Fund der letzten `tiefeBei`-Rechnung (Koerper, Kontaktpunkt) */
  private tiefeFund = { koerper: null as RAPIER.RigidBody | null, punkt: new THREE.Vector3() };
  private tiefeBei(
    t: GehaltenesTeil,
    gehalten: ReadonlyArray<GehaltenesTeil>,
    gPos: THREE.Vector3,
    gQuat: THREE.Quaternion
  ): number {
    const body = t.body;
    this.tiefeFund.koerper = null;
    // Pose des Teils an dieser Spinnenstellung: Spinne · von (wie `carryHeld`)
    this.hPos.copy(t.vonPos).applyQuaternion(gQuat).add(gPos);
    this.hQuat.copy(gQuat).multiply(t.vonQuat);
    const bp = body.translation();
    const br = body.rotation();
    this.hInv.set(br.x, br.y, br.z, br.w).invert();
    let tiefe = 0;
    for (let i = 0; i < body.numColliders(); i++) {
      const c = body.collider(i);
      if (c.isSensor()) continue;
      // Lage des Kolliders im Teil, aus den aktuellen Posen
      const cp = c.translation();
      const cr = c.rotation();
      this.hcPos.set(cp.x - bp.x, cp.y - bp.y, cp.z - bp.z).applyQuaternion(this.hInv);
      this.hcQuat.set(cr.x, cr.y, cr.z, cr.w).premultiply(this.hInv);
      this.hcPos.applyQuaternion(this.hQuat).add(this.hPos);
      this.hcQuat.premultiply(this.hQuat);
      const treffer: RAPIER.Collider[] = [];
      this.ctx.world.intersectionsWithShape(
        this.hcPos,
        this.hcQuat,
        c.shape,
        (o) => {
          const b = o.parent();
          if (!b || o.isSensor() || b.isDynamic()) return true;
          if (this.ctx.selfHandles.has(b.handle)) return true;
          if (gehalten.some((g) => g.body.handle === b.handle)) return true;
          if (b.isFixed() && istBoden(o)) return true;
          treffer.push(o);
          return true;
        },
        undefined,
        undefined,
        undefined,
        body
      );
      for (const o of treffer) {
        const k = o.contactShape(c.shape, this.hcPos, this.hcQuat, 0);
        if (k && k.distance < 0 && -k.distance > tiefe) {
          tiefe = -k.distance;
          this.tiefeFund.koerper = o.parent();
          this.tiefeFund.punkt.set(k.point1.x, k.point1.y, k.point1.z);
        }
      }
    }
    return tiefe;
  }

  /** Spinne gegen Mauern, Mulden und Schere. */
  private grappleHitsBuilding(): boolean {
    this.ctx.grappleGroup.getWorldPosition(this.pos);
    const o = hitsObstacle(this.pos.x, this.pos.z, GRAPPLE_PAD, this.pos.y - 1.2);
    if (o) this.merkeAnschlag(null, o.label, this.pos.x, this.pos.y - 1.2, this.pos.z, this.spinnenTempo());
    return o !== null;
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
    this.pos.y -= this.ctx.pruefTiefe?.() ?? 1.35; // Mitte des Schalenkorbs
    let hit = false;
    let wer: RAPIER.RigidBody | null = null;
    this.ctx.world.intersectionsWithShape(this.pos, IDENT_QUAT, probe, (collider) => {
      const b = collider.parent();
      // Nie vorzeitig abbrechen: Rapier hält die Welt während der Abfrage
      // geborgt, und ein offener Borrow lässt den nächsten schreibenden
      // Zugriff mit "recursive use of an object" abstürzen.
      if (!b || hit) return true;
      if (this.ctx.obstacleBodies.has(b.handle)) {
        hit = true; // Fahrzeug auf dem Platz
        wer = b;
        return true;
      }
      if (this.ctx.grippedHandles.has(b.handle)) return true; // eigene Ladung
      // Feste Körper (Bauten) blockieren, nur der Boden zählt nicht mit
      if (b.isFixed() && collider.translation().y > -0.05) hit = true;
      else if (b.isDynamic() && b.mass() > HEAVY_BLOCK_KG) hit = true;
      if (hit) wer = b;
      return true;
    });
    if (hit) {
      const p = this.pos.clone();
      this.merkeAnschlag(wer, null, p.x, p.y, p.z, this.spinnenTempo());
    }
    return hit;
  }

  /**
   * E-152: Stoesst die Spinne seitlich an einen Brocken und faehrt weiter
   * hinein? Dann haelt der Arm an — wie an einer Wand.
   *
   * Ein Brocken ist, was mehr als `HEAVY_BLOCK_KG` wiegt („nicht mehr
   * wegzuschieben", dieselbe Zahl wie in `grappleHitsBody`). Gezaehlt wird
   * nur die WAAGRECHTE Bewegung der Spinne, und sie muss steil in den Brocken
   * gehen (`PLOW_RICHTUNG_COS`). Von oben auf einen Brocken senken bleibt
   * damit Sache der Brocken-Sperre im Bodenanschlag (E-137) — dort ist „ein
   * Stueck Biss" gewollt —, und flach ueber ein Dach gleiten bleibt frei
   * (die Normale steht dort fast senkrecht). Steckt eine Schale im Dach und
   * zieht den Brocken mit, kippt die Normale zur Seite: Das haelt an.
   * Ob der Brocken mitlaeuft, zaehlt hier bewusst NICHT: Beim Abheben laeuft
   * ein eingehakter Brocken immer ein Stueck mit, und das Abheben muss gehen
   * (gemessen: Heben vom Container 1,77 → 0,67 m in 1 s, solange es zaehlte).
   * Rapier-Kontakte des letzten Schritts, nur gelesen (v2 E-044). Wegfahren
   * und Heben gehen durch: Das ist der Fluchtweg.
   */
  private grappleSchiebtBrocken(): boolean {
    this.ctx.grappleGroup.getWorldPosition(this.pos);
    const vx = this.pos.x - this.lastGrapple.x;
    const vz = this.pos.z - this.lastGrapple.z;
    // Abheben ist immer der Fluchtweg — auch wenn der Ausleger das Ende dabei etwas heranzieht
    if (this.pos.y > this.lastGrapple.y) return false;
    const schwelle = PLOW_RICHTUNG_COS * Math.hypot(vx, vz);
    if (schwelle <= 0) return false;
    const g = this.ctx.grappleBody();
    const world = this.ctx.world;
    let ja = false;
    let wer: RAPIER.RigidBody | null = null;
    for (let i = 0; i < g.numColliders() && !ja; i++) {
      const c = g.collider(i);
      if (!c.isEnabled()) continue;
      world.contactPairsWith(c, (o) => {
        const b = o.parent();
        if (ja || !b || !b.isDynamic() || b.mass() <= HEAVY_BLOCK_KG) return;
        if (this.ctx.grippedHandles.has(b.handle)) return;
        world.contactPair(c, o, (m, flipped) => {
          const s = flipped ? -1 : 1;
          const n = m.normal();
          let beruehrt = false;
          for (let k = 0; k < m.numContacts(); k++) if (m.contactDist(k) < PLOW_KONTAKT) beruehrt = true;
          if (!beruehrt) return;
          if ((n.x * vx + n.z * vz) * s > schwelle) {
            ja = true;
            wer = b;
          }
        });
      });
    }
    if (ja) {
      const p = this.pos.clone();
      this.merkeAnschlag(wer, null, p.x, p.y - 1.35, p.z, this.spinnenTempo());
    }
    return ja;
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

/**
 * Der Boden: ein fester Quader, dessen Oberkante auf Hoehe 0 liegt — dieselbe
 * Regel wie `istBoden` in `world/obstacles.ts` (dort nicht exportiert).
 */
function istBoden(c: RAPIER.Collider): boolean {
  if (c.shapeType() !== RAPIER.ShapeType.Cuboid) return false;
  const he = c.halfExtents();
  return Math.abs(c.translation().y + he.y) < 0.02 && he.x > 20;
}
