/**
 * Wächter für die Karosserieform des Wracks.
 *
 * ZWEI TEILE, seit E-116 (23.09.2026):
 *
 *   1. DER BESTAND — zwei Quader, deren Eckpunkte `formeKarosserie` verschiebt.
 *      Er ist weiter die Vorgabe, solange Patrick keine der drei Fassungen
 *      gewählt hat, und wird deshalb weiter geprüft: Schnauze schmaler als die
 *      Mitte, Heck eingezogen, Schweller schmaler als die Türhöhe.
 *
 *   2. DIE DREI FASSUNGEN A, B, C — jede mit ihrer eigenen Absicht. Geprüft
 *      wird nicht Schönheit (die entscheidet Patrick am Gerät), sondern genau
 *      das, was am Bestand geometrisch unmöglich war: ein durchgehender
 *      Längsschnitt mit geneigter Scheibe, ein eingezogenes Glashaus, echte
 *      Radlauf-Ausschnitte — und dass Beulen, Pressen und die Zeichenruf-Grenze
 *      dabei unberührt bleiben.
 *
 * Wenn eine Fassung gewonnen hat, fallen die beiden anderen Blöcke heraus und
 * der Block der Siegerin bleibt als Wächter ihrer Form stehen.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  CarComposite,
  CompositeManager,
  baueAnbauteile,
  formeKarosserie,
  wrackDaten,
  wrackform,
  VORGABE_FORM,
} from "../src/dismantle/composites";
import { CAR_DEF, type AnbauDef } from "../src/dismantle/carDef";
import { WRACKFORMEN, baueWrackform, type WrackformDef, type WrackformId } from "../src/dismantle/wrackformen";
import { ItemManager } from "../src/world/scrapItems";
import { initPhysics } from "../src/physics/physicsWorld";
import { EventBus } from "../src/core/events";

/** Größte halbe Breite in einem z-Band, optional nur oben oder unten. */
function halbbreite(geo: THREE.BufferGeometry, zVon: number, zBis: number, oben?: boolean): number {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  let max = 0;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const y = pos.getY(i);
    if (z < zVon || z > zBis) continue;
    if (oben === true && y <= 0) continue;
    if (oben === false && y > 0) continue;
    max = Math.max(max, Math.abs(pos.getX(i)));
  }
  return max;
}

function karosserie(): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(1.7, 0.55, 4.0, 4, 2, 9);
  formeKarosserie(geo);
  return geo;
}

describe("Wrack-Karosserie, Bestand (zwei Quader)", () => {
  it("die Schnauze ist schmaler als die Mitte", () => {
    const g = karosserie();
    const mitte = halbbreite(g, -0.5, 0.5);
    const schnauze = halbbreite(g, 1.7, 2.0);
    expect(schnauze).toBeLessThan(mitte);
    // aber kein Bleistift — ein Auto laeuft vorn nicht spitz zu
    expect(schnauze).toBeGreaterThan(mitte * 0.6);
  });

  it("das Heck zieht sich ein, weniger als die Schnauze", () => {
    const g = karosserie();
    const mitte = halbbreite(g, -0.5, 0.5);
    const heck = halbbreite(g, -2.0, -1.7);
    const schnauze = halbbreite(g, 1.7, 2.0);
    expect(heck).toBeLessThan(mitte);
    expect(heck).toBeGreaterThan(schnauze);
  });

  it("die Schweller sind schmaler als die Türhöhe", () => {
    const g = karosserie();
    const unten = halbbreite(g, -0.5, 0.5, false);
    const oben = halbbreite(g, -0.5, 0.5, true);
    expect(unten, "das Auto steht sonst auf einem Brett").toBeLessThan(oben);
  });

  it("die Motorhaube fällt nach vorn ab", () => {
    const g = karosserie();
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    let hoechstesVorn = -Infinity;
    let hoechstesMitte = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      const y = pos.getY(i);
      if (z > 1.7) hoechstesVorn = Math.max(hoechstesVorn, y);
      if (Math.abs(z) < 0.5) hoechstesMitte = Math.max(hoechstesMitte, y);
    }
    expect(hoechstesVorn).toBeLessThan(hoechstesMitte);
  });

  it("die Länge bleibt, das Auto wird nicht gestaucht", () => {
    const g = karosserie();
    g.computeBoundingBox();
    const b = g.boundingBox!;
    expect(b.max.z - b.min.z).toBeCloseTo(4.0, 2);
  });

  it("Anbauteile sitzen am Auto, nicht daneben", () => {
    const gruppe = new THREE.Group();
    /*
     * Seit E-111 ist das EIN Netz mit Eckpunktfarben statt dreizehn Netzen —
     * gezählt wird deshalb nicht mehr in Kindern, sondern in Eckpunkten:
     * 9 Kästen à 24 plus 4 Halbtori à 91 = 580. Dass jedes Teil dabei genau da
     * sitzt, wo es vorher saß, prüft `test/wracknetze.test.ts` Eckpunkt für
     * Eckpunkt; hier geht es weiter nur darum, dass nichts neben dem Auto hängt.
     */
    baueAnbauteile(gruppe, CAR_DEF, 0x8c2f24);
    expect(gruppe.children.length, "kein Anbau-Netz gebaut").toBe(1);
    const ecken = (gruppe.children[0] as THREE.Mesh).geometry.getAttribute("position").count;
    expect(ecken, "es fehlen Anbauteile").toBe(580);
    const box = new THREE.Box3().setFromObject(gruppe);
    // innerhalb der Fahrzeughuelle (Laenge 4 m, Breite 1,7 m, Hoehe bis Dach)
    expect(box.min.z).toBeGreaterThan(-2.2);
    expect(box.max.z).toBeLessThan(2.2);
    expect(Math.max(Math.abs(box.min.x), Math.abs(box.max.x))).toBeLessThan(1.1);
    expect(box.min.y, "nichts haengt unter dem Auto").toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------------- */
/* DIE DREI FASSUNGEN AUS E-116                                              */
/* ------------------------------------------------------------------------- */

const LACK = 0x8c2f24;

/** Höchste und breiteste Stelle sowie Länge einer Geometrie. */
function huelle(geo: THREE.BufferGeometry): THREE.Box3 {
  geo.computeBoundingBox();
  return geo.boundingBox!.clone();
}

/**
 * Das eingeschlossene Volumen über den Divergenzsatz.
 *
 * Nur so lässt sich prüfen, dass die Dreiecke RICHTIG HERUM liegen: Bei
 * verkehrtem Umlauf kommt ein negatives Volumen heraus — und im Spiel wäre das
 * Auto von außen unsichtbar, weil man nur seine Rückseiten sähe. Das ist kein
 * theoretischer Fall, sondern der erste Fehler, den man beim Bauen einer Haut
 * aus Ringen macht.
 */
function volumen(geo: THREE.BufferGeometry): number {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const idx = geo.getIndex()!;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let v = 0;
  for (let t = 0; t < idx.count; t += 3) {
    a.fromBufferAttribute(pos, idx.getX(t));
    b.fromBufferAttribute(pos, idx.getX(t + 1));
    c.fromBufferAttribute(pos, idx.getX(t + 2));
    v += a.dot(b.clone().cross(c)) / 6;
  }
  return v;
}

/**
 * Liegt ein Punkt INNERHALB der Karosserie? Gezählt wird, wie oft ein Strahl
 * nach oben die Haut schneidet — ungerade heißt innen.
 */
function istInnen(koerper: THREE.Mesh, p: THREE.Vector3): boolean {
  const strahl = new THREE.Raycaster(p, new THREE.Vector3(0, 1, 0), 0.0001, 10);
  return strahl.intersectObject(koerper, false).length % 2 === 1;
}

function karosseriemesh(form: WrackformDef): THREE.Mesh {
  const bau = baueWrackform(form, LACK);
  // Eigenes Material: Der Strahlentest muss auch Rückseiten treffen, sonst
  // zählt er von innen nichts und hielte jeden Punkt für außen.
  return new THREE.Mesh(bau.koerper, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
}

describe.each(Object.entries(WRACKFORMEN))("Fassung %s", (id, form) => {
  it("die Querschnitte sind gültig: gleich viele Ebenen, von vorn nach hinten, von unten nach oben", () => {
    const n = form.ebenen.length;
    expect(n, "unter vier Ebenen kann es keine Gürtellinie geben").toBeGreaterThanOrEqual(5);
    let vorher = Infinity;
    for (const s of form.schnitte) {
      const y = s.y ?? form.ebenen;
      expect(s.b.length, `${s.name}: Breiten je Ebene`).toBe(n);
      expect(y.length, `${s.name}: Höhen je Ebene`).toBe(n);
      expect(s.z, `${s.name} liegt nicht hinter dem Schnitt davor`).toBeLessThan(vorher);
      vorher = s.z;
      for (let i = 1; i < n; i++) {
        expect(y[i]!, `${s.name}: Ebene ${i} liegt unter Ebene ${i - 1}`).toBeGreaterThanOrEqual(y[i - 1]!);
      }
      for (const b of s.b) expect(b, `${s.name}: Breite null`).toBeGreaterThan(0);
    }
  });

  it("hat die Maße eines Autos und ist höher als der Bestand", () => {
    const b = huelle(baueWrackform(form, LACK).koerper);
    expect(b.max.z - b.min.z, "Länge").toBeCloseTo(form.laenge, 2);
    // Der Bestand war 1,105 m hoch — ein 4-m-Auto mit 1,1 m Dach gibt es nicht.
    expect(b.max.y, "Dachhöhe").toBeGreaterThan(1.3);
    expect(b.max.y, "kein Kleinbus").toBeLessThan(1.7);
    // Die Karosserie darf über den Kollider (±0,85 m) hinausragen, aber nicht
    // über die Spiegel (±0,86 m) — sonst stimmt die Breite des Wracks nicht mehr.
    expect(Math.max(b.max.x, -b.min.x), "halbe Breite").toBeLessThan(0.95);
  });

  it("die Dreiecke liegen nach außen — sonst ist das Auto von außen unsichtbar", () => {
    expect(volumen(baueWrackform(form, LACK).koerper)).toBeGreaterThan(1);
  });

  it("der Längsschnitt ist durchgehend: die Haube liegt tiefer als das Dach", () => {
    const geo = baueWrackform(form, LACK).koerper;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    let haube = -Infinity;
    let dach = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      const y = pos.getY(i);
      if (z > 1.2) haube = Math.max(haube, y); // vor der A-Säule
      if (Math.abs(z) < 0.5) dach = Math.max(dach, y); // im Dachbereich
    }
    expect(haube, "die Haube ist so hoch wie das Dach — wieder ein Brotlaib").toBeLessThan(dach - 0.3);
  });

  it("die Windschutzscheibe ist geneigt, nicht senkrecht", () => {
    const front = baueWrackform(form, LACK).scheiben.find((s) => s.id === "front")!;
    const b = huelle(front.geo);
    /*
     * Eine senkrechte Scheibe hätte in z fast keine Ausdehnung — genau so
     * standen die vier Platten des Bestands (`CarDef.windows`: 1,3 x 0,5 x
     * 0,03 m, senkrecht). Hier muss die Scheibe sowohl in die Höhe als auch in
     * die Länge laufen.
     */
    expect(b.max.y - b.min.y, "Höhe der Scheibe").toBeGreaterThan(0.2);
    expect(b.max.z - b.min.z, "Neigung der Scheibe").toBeGreaterThan(0.2);
    expect(b.max.x - b.min.x, "Breite der Scheibe").toBeGreaterThan(1.0);
  });

  it("das Glashaus ist eingezogen, nicht bündig mit der Flanke", () => {
    const geo = baueWrackform(form, LACK).koerper;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const b = huelle(geo);
    let guertel = 0;
    let dachkante = 0;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getZ(i)) > 0.5) continue; // nur im Dachbereich
      const y = pos.getY(i);
      const x = Math.abs(pos.getX(i));
      if (Math.abs(y - b.max.y) < 0.2) dachkante = Math.max(dachkante, x);
      if (y > 0.8 && y < b.max.y - 0.3) guertel = Math.max(guertel, x);
    }
    expect(dachkante, "das Dach ist so breit wie der Wagen").toBeLessThan(guertel * 0.92);
  });

  it("über jedem Rad ist die Karosserie ausgeschnitten", () => {
    const def = wrackDaten(CAR_DEF, id as WrackformId);
    const geo = baueWrackform(form, LACK).koerper;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    for (const rad of def.parts.filter((p) => p.kind === "wheel")) {
      const [, ry, rz] = rad.anchor;
      const reifenOben = ry! + rad.size[0]!;
      let tiefsteFlanke = Infinity;
      for (let i = 0; i < pos.count; i++) {
        if (Math.abs(pos.getZ(i) - rz!) > 0.12) continue;
        if (Math.abs(pos.getX(i)) < 0.5) continue; // die Unterbodenmitte darf tief sein
        tiefsteFlanke = Math.min(tiefsteFlanke, pos.getY(i));
      }
      expect(tiefsteFlanke, `Rad bei z=${rz} steckt im Blech`).toBeGreaterThanOrEqual(reifenOben);
    }
  });

  it("Leuchten und Grill schauen aus der Karosserie heraus", () => {
    const koerper = karosseriemesh(form);
    koerper.updateMatrixWorld(true);
    const def = wrackDaten(CAR_DEF, id as WrackformId);
    const gesicht = def.karosserie.anbau.filter((a) =>
      ["Kühlergrill", "Scheinwerfer", "Rückleuchte"].includes(a.name)
    );
    expect(gesicht.length, "kein Gesicht in der Teileliste").toBe(3);
    const hb = def.karosserie.chassis[0] / 2;
    const hl = def.karosserie.chassis[2] / 2;
    for (const a of gesicht) {
      // Die vordere bzw. hintere Fläche des Teils, in der Mitte — dort muss es
      // vor dem Blech liegen, sonst ist es verschluckt.
      const z = a.anchor[2] * hl;
      const p = new THREE.Vector3(
        a.anchor[0] * hb,
        a.anchor[1],
        z + Math.sign(z) * (a.size[2] / 2)
      );
      expect(istInnen(koerper, p), `${a.name} steckt in der Karosserie`).toBe(false);
    }
  });

  it("jedes Anbauteil berührt die Haut, und die Spiegel stecken nicht darin (E-127)", () => {
    const koerper = karosseriemesh(form);
    koerper.updateMatrixWorld(true);
    const def = wrackDaten(CAR_DEF, id as WrackformId);
    const hb = def.karosserie.chassis[0] / 2;
    const hl = def.karosserie.chassis[2] / 2;
    /** Ein Teil als Quader in m: Mitte und halbe Maße (rechte Seite). */
    const quader = (a: AnbauDef): { m: THREE.Vector3; h: THREE.Vector3 } => ({
      m: new THREE.Vector3(a.anchor[0] * hb, a.anchor[1], a.anchor[2] * hl),
      h: new THREE.Vector3((a.size[0] * def.karosserie.chassis[0]) / 2, a.size[1] / 2, a.size[2] / 2),
    });
    /** Liegt irgendein Punkt des Teils, 1 cm aufgeweitet, im Blech? */
    const beruehrt = (a: AnbauDef): boolean => {
      const { m, h } = quader(a);
      const p = new THREE.Vector3();
      for (let i = 0; i <= 4; i++)
        for (let j = 0; j <= 4; j++)
          for (let k = 0; k <= 4; k++) {
            p.set(
              m.x + (h.x + 0.01) * (i / 2 - 1),
              m.y + (h.y + 0.01) * (j / 2 - 1),
              m.z + (h.z + 0.01) * (k / 2 - 1)
            );
            if (istInnen(koerper, p)) return true;
          }
      return false;
    };
    for (const a of def.karosserie.anbau) expect(beruehrt(a), `${a.name} schwebt neben dem Auto`).toBe(true);
    const spiegel = def.karosserie.anbau.filter((a) => a.amFlanke);
    expect(spiegel.map((a) => a.name)).toEqual(["Außenspiegel"]);
    for (const a of spiegel) {
      const { m, h } = quader(a);
      // Die Innenseite, 1 cm nach außen gerückt, liegt auf keiner Höhe im Blech
      for (let j = 0; j <= 4; j++) {
        const p = new THREE.Vector3(m.x - h.x + 0.01, m.y + h.y * (j / 2 - 1), m.z);
        expect(istInnen(koerper, p), `${a.name} steckt ${j} im Blech`).toBe(false);
      }
    }
    // Gegenprobe: der Spiegel am Anker des Bestand-Kastens (0,92 m) schwebte an C.
    if (id === "c") {
      const alt = { ...spiegel[0]!, anchor: [0.92 / 0.85, 1.0, 0.62 / 2.0] as [number, number, number] };
      expect(beruehrt(alt)).toBe(false);
    }
  });

  it("die vier Scheiben liegen auf dem Blech, nicht darin", () => {
    const bau = baueWrackform(form, LACK);
    expect(bau.scheiben.map((s) => s.id).sort()).toEqual(["front", "left", "rear", "right"]);
    const koerper = karosseriemesh(form);
    koerper.updateMatrixWorld(true);
    for (const s of bau.scheiben) {
      const pos = s.geo.getAttribute("position") as THREE.BufferAttribute;
      expect(pos.count, `${s.id}: leere Scheibe`).toBeGreaterThanOrEqual(4);
      for (let i = 0; i < pos.count; i++) {
        const p = new THREE.Vector3().fromBufferAttribute(pos, i);
        expect(istInnen(koerper, p), `${s.id}: Eckpunkt ${i} liegt im Blech`).toBe(false);
      }
    }
  });

  it("verträgt keine Fassung mit falscher Ebenenzahl — Gegenprobe", () => {
    const kaputt: WrackformDef = {
      ...form,
      schnitte: form.schnitte.map((s, i) => (i === 0 ? { ...s, b: s.b.slice(1) } : s)),
    };
    expect(() => baueWrackform(kaputt, LACK)).toThrow(/Ebenen erwartet/);
  });
});

describe("Die Fassungen im laufenden Spiel", () => {
  beforeAll(async () => {
    await initPhysics();
  });

  function werkbank(form: WrackformId) {
    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const comps = new CompositeManager(scene, world, new ItemManager(scene, world), new EventBus());
    comps.zeigeForm(form);
    return { comps, car: comps.spawnCar(new THREE.Vector3(0, 1, 0)) };
  }

  function netze(wurzel: THREE.Object3D): THREE.Mesh[] {
    const liste: THREE.Mesh[] = [];
    wurzel.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) liste.push(o as THREE.Mesh);
    });
    return liste;
  }

  for (const id of ["a", "b", "c"] as const) {
    it(`Fassung ${id} bleibt unter dreizehn Netzen (E-111) und hat EINE Karosserie`, () => {
      const { car } = werkbank(id);
      const alle = netze(car.group);
      expect(alle.length, "das Zeichenruf-Budget aus E-111").toBeLessThanOrEqual(13);
      /*
       * Karosserie 1 + 4 Scheiben + 1 Anbaunetz (mit Innenraum) + 1
       * Sammelnetz der Teile, an C dazu die Haube.
       *
       * ANGEPASST MIT E-185 (20.10.2026): Vorher 12 — Motor, Getriebe und
       * vier Räder waren sechs eigene Netze. Mit Batterie, Kühler und Haube
       * wären es 15 gewesen, über dem Wächter; jetzt liegen alle angebauten
       * Teile in EINEM Netz (Zerstörungskonzept B7). Gezählt in
       * `tools/wrackbild.ts`.
       */
      expect(alle.length).toBe(id === "c" ? 8 : 7);
    });

    it(`Fassung ${id} beult sichtbar`, () => {
      const { car } = werkbank(id);
      // Alle Netze merken, nicht nur eines: So haengt die Pruefung nicht daran,
      // in welcher Reihenfolge die Karosserie im Szenengraph steht.
      const vorher = netze(car.group).map((m) => ({
        attr: m.geometry.getAttribute("position") as THREE.BufferAttribute,
        kopie: new Float32Array((m.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array),
      }));
      /*
       * Ein voller Biss (15,70 kN, E-112) VON DER SEITE auf die hintere Flanke:
       * weit weg von jedem Bauteilanker, damit der Druck ins Blech geht und
       * nicht in eine Sortierung.
       *
       * Absichtlich nicht von oben. `dent` setzt den Druckpunkt dort an, wo die
       * Druckachse den Kolliderquader VERLÄSST — von oben ist das der
       * Unterboden, und der hat bei diesen Fassungen (wie das Dach) nur an
       * seinen Rändern Eckpunkte. Die Beule fällt dort deshalb klein aus;
       * sichtbar wird sie, weil die Fläche dazwischen mitkippt. Gemessen wird
       * hier der Fall, der im Spiel zählt: seitlich zufassen.
       */
      const p = car.body.translation();
      car.beissen(15.7, new THREE.Vector3(p.x + 1.6, p.y + 0.8, p.z - 1.2));
      let groesste = 0;
      for (const { attr, kopie } of vorher) {
        for (let i = 0; i < attr.count; i++) {
          groesste = Math.max(
            groesste,
            Math.hypot(
              attr.getX(i) - kopie[i * 3]!,
              attr.getY(i) - kopie[i * 3 + 1]!,
              attr.getZ(i) - kopie[i * 3 + 2]!
            )
          );
        }
      }
      expect(groesste, "kein Eckpunkt hat sich bewegt — die Beulmechanik greift nicht").toBeGreaterThan(0.02);
    });

    it(`Fassung ${id} lässt sich zerlegen und pressen`, () => {
      const { car } = werkbank(id);
      // ANGEPASST MIT E-185: Die Haube gibt es nur an C (aus der Haut
      // geschnitten); A und B haben sie nicht — zerlegt wird, was dran ist.
      const dran = car.teileDran;
      expect(dran.length).toBe(CAR_DEF.parts.length - (id === "c" ? 0 : 1));
      for (const pid of dran) {
        expect(car.tearPart(pid), `${pid} ließ sich nicht abreißen`).not.toBeNull();
      }
      expect(car.teileDran).toEqual([]);
      car.pressCrush();
      expect(car.crushStage).toBe(2);
    });
  }

  it("zeigeForm baut die Wracks an ihrer Stelle neu und schaltet neue Anlieferungen um", () => {
    const { comps, car } = werkbank("a");
    const vorher = car.body.translation();
    const meldung = comps.zeigeForm("c");
    expect(meldung).toMatch(/1 Wrack/);
    expect(comps.cars.length, "aus einem Wrack wurden zwei").toBe(1);
    const neu = comps.cars[0]!;
    expect(neu.formId).toBe("c");
    const jetzt = neu.body.translation();
    expect(jetzt.x).toBeCloseTo(vorher.x, 5);
    expect(jetzt.z).toBeCloseTo(vorher.z, 5);
    // und der nächste Lkw bringt auch eine C
    expect(comps.spawnCar(new THREE.Vector3(6, 1, 0)).formId).toBe("c");
  });

  it("C ist die Vorgabe, seit Patrick gewählt hat (E-117)", () => {
    /*
     * Geprueft wird die VORGABE des Bauplans, nicht die gerade eingestellte
     * Fassung: `zeigeForm` schaltet modulweit um, und in dieser Datei ist es
     * vorher schon ein paar Mal aufgerufen worden. Ein Wrack, das ohne Angabe
     * gebaut wird, ist seit dem 01.10.2026 eine C — Patrick hat sie am Bild
     * gewaehlt. Bis dahin war es der Bestand.
     */
    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const items = new ItemManager(scene, world);
    const car = new CarComposite(
      CAR_DEF, scene, world, items, new EventBus(), new THREE.Vector3(0, 1, 0)
    );
    expect(car.formId).toBe("c");
    expect(car.formId, "Bauplan und Startwert lesen dieselbe Konstante").toBe(VORGABE_FORM);
    expect(wrackform(car.formId), "C hat eine Formbeschreibung").not.toBeNull();
  });
});
