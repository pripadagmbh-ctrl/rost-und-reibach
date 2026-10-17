/**
 * Waechter fuer den Kehrbesen — dritte Fassung (E-049, 15.09.2026).
 *
 * Drei Formen an einem Abend, jede aus einem Satz von Patrick:
 *
 * 1. **Trichter** (E-031): „ein Maschendrahtzaun, der quasi oben schon
 *    gequetscht ist und unten breit ist ... damit ich den Boden bzw. die
 *    Ladeflächen abkehren kann."
 * 2. **Ballen** (E-037): „viel zu klein ... fast so breit wie eine Pritsche und
 *    viel voluminöser ... ein bisschen wie ein Tee-Ei."
 * 3. **Rolle** (E-049): „besser, aber noch nicht gut. Stell dir grünen
 *    Maschendraht vor, der unten noch aufgerollt ist, und das obere Teil ist
 *    gequetscht. Sollte auch mindestens so breit sein wie die Ladefläche eines
 *    LKWs." Und zum Zielkonflikt mit dem Kehren der Ladefläche: „Breite so
 *    lassen, ich kann die Spinne ja drehen, damit es passt."
 *
 * Das ist ein WERKZEUG, kein Deko-Stueck. Darum misst dieser Test in der
 * echten Rapier-Welt:
 *
 * 1. **Die Form ist eine Rolle**: Achse quer, Querschnitt unten rund und oben
 *    flach, ueber die ganze Laenge derselbe — die Schleppkante ist eine
 *    Gerade. Keine Taille, eine Huelle.
 * 2. **Masse und Rauminhalt sind gerechnet**, nicht gesetzt.
 * 3. **Sie kehrt**, und zwar in beiden Zugrichtungen, und nirgends schlechter
 *    als der Ballen von vorhin.
 * 4. **Die Spinne bekommt sie** — auch mit 2,70 m Laenge.
 * 5. **Die Ladeflaeche wird quer gekehrt**, so wie Patrick es beschreibt.
 * 6. **Sie ist Platzinventar**: genau eine, wertlos, kommt wieder.
 * 7. **Ihr Fleck ist gesucht, nicht gewaehlt.**
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { PhysicsWorld, initPhysics } from "../src/physics/physicsWorld";
import { GripSystem, noetigeKrallenFuer, SCHALENLUECKE } from "../src/physics/gripSystem";
import {
  BESEN,
  ItemManager,
  besenForm,
  dampAng,
  dampLin,
  istPlatzinventar,
  quaderRaum,
  PLATZINVENTAR,
  SPECS,
  type ScrapItem,
} from "../src/world/scrapItems";
import { KATALOG_SPECS, KATALOG_BIG, KATALOG_HUGE } from "../src/world/objektkatalog";
import { baueGeometrie, punkteBis, BESEN_FORM } from "../src/world/objektbau";
import { BESEN_PLATZ, START_HAUFEN, START_STREU, START_AUTOS } from "../src/world/startplatz";
import {
  BAGGER_STAND,
  SCHWENK_AUSSEN,
  SCHWENK_INNEN,
  abstandVomStand,
} from "../src/world/baggerstand";
import { PRESS_CENTER, PRESS_INNER } from "../src/world/press";
import { CONFIGS } from "../src/world/containers";
import { hitsObstacle } from "../src/world/obstacles";
import { Daylight, DAY_LENGTH_S } from "../src/world/daylight";
import { Account } from "../src/economy/account";
import type { CompositeManager } from "../src/dismantle/composites";
import {
  ABKIPP_ZONE,
  ABLADE_HALT_Z,
  ABLADE_SPUR_X,
  BED_HALF_W,
  BED_LEN,
  BLOCKING_MASS_KG,
  WORK_ZONES,
} from "../src/delivery/routes";
import {
  CLAW_CLOSED_SPLAY,
  CLAW_COUNT,
  CLAW_OPEN_SPLAY,
  CLAW_RING_R,
  CLAW_RING_Y,
  CLAW_SEGMENTS,
  clawPoint,
  clawSpan,
  clawTipDepth,
} from "../src/excavator/clawGeometry";
import { endlich, mindestens } from "./zahl";

beforeAll(async () => {
  await initPhysics();
});

/** Laenge der Rolle (quer), Hoehe, Durchmesser (in Zugrichtung). */
const [LAENGE, HOEHE, TIEFE] = BESEN.dims;

/* ======================================================================== */
/* Werkzeug                                                                  */
/* ======================================================================== */

function platz(): { physics: PhysicsWorld; items: ItemManager } {
  const physics = new PhysicsWorld();
  const boden = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0)
  );
  // Genau wie im Spiel (`yard.ts`): grosse Platte, Rapier-Standardreibung.
  physics.world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  return { physics, items: new ItemManager(new THREE.Scene(), physics.world) };
}

/** Liegt der Punkt in irgendeinem Kollider des Koerpers? */
function innen(body: RAPIER.RigidBody, x: number, y: number, z: number): boolean {
  for (let i = 0; i < body.numColliders(); i++) {
    const p = body.collider(i).projectPoint({ x, y, z }, true);
    if (p && p.isInside) return true;
  }
  return false;
}

/**
 * Halbmesser des Kolliders auf Hoehe `y` in Richtung `theta`.
 *
 * Nicht die rohen Eckpunkte des Netzes messen: Zwischen zwei Drahtknoten
 * liegen Baender ganz ohne Eckpunkte, und was die Physik sieht, ist der
 * Kollider. Abgetastet wird mit `projectPoint(solid = true)`; die Kante wird
 * eingeschachtelt.
 */
function kolliderR(body: RAPIER.RigidBody, y: number, theta: number): number {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  if (!innen(body, 0, y, 0)) return 0;
  let lo = 0;
  let hi = 2.5;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (innen(body, m * c, y, m * s)) lo = m;
    else hi = m;
  }
  return lo;
}

/** Laenge (x) und Tiefe (z) des Kolliders auf einer Hoehe. */
function kolliderBei(body: RAPIER.RigidBody, y: number): { laenge: number; tiefe: number } {
  return {
    laenge: kolliderR(body, y, 0) + kolliderR(body, y, Math.PI),
    tiefe: kolliderR(body, y, Math.PI / 2) + kolliderR(body, y, -Math.PI / 2),
  };
}

/** Die Rolle als fester Koerper im Ursprung — so, wie das Spiel sie baut. */
function besenKoerper(): { physics: PhysicsWorld; body: RAPIER.RigidBody } {
  const { physics, items } = platz();
  const it = items.spawnScrap(
    BESEN.materialId,
    BESEN.massKg,
    besenForm(),
    new THREE.Vector3(0, 0, 0),
    new THREE.Quaternion()
  );
  it.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
  return { physics, body: it.body };
}

/**
 * Wie weit steht die konvexe Huelle vom gezeichneten Draht ab?
 *
 * DAS ist die Frage hinter „braucht sie eine oder zwei Huellen". Eine konvexe
 * Huelle kennt keine Einschnuerung; sie spannt sich ueber sie hinweg. Gemessen
 * wird parameterfrei: Auf der Oberflaeche der Huelle werden Punkte abgetastet,
 * und zu jedem wird der naechste Eckpunkt des Netzes gesucht.
 */
function huelleUeberDraht(
  body: RAPIER.RigidBody,
  ecken: Float32Array,
  hoehe: number
): number {
  let schlimmster = 0;
  let geprueft = 0;
  for (let i = 0; i <= 14; i++) {
    const y = -hoehe / 2 + 0.02 + (hoehe - 0.06) * (i / 14);
    for (let k = 0; k < 24; k++) {
      const theta = (k / 24) * Math.PI * 2;
      const r = kolliderR(body, y, theta);
      if (r <= 0) continue;
      geprueft++;
      const px = r * Math.cos(theta);
      const pz = r * Math.sin(theta);
      let naechster = Infinity;
      for (let e = 0; e + 2 < ecken.length; e += 3) {
        const d = (ecken[e] - px) ** 2 + (ecken[e + 1] - y) ** 2 + (ecken[e + 2] - pz) ** 2;
        if (d < naechster) naechster = d;
      }
      schlimmster = Math.max(schlimmster, Math.sqrt(naechster));
    }
  }
  mindestens(geprueft, 200, "abgetastete Huellpunkte");
  return endlich(schlimmster, "Abstand Huelle zu Draht");
}

/** Rauminhalt eines Koerpers, per Raster abgetastet. */
function rauminhalt(body: RAPIER.RigidBody, w: number, h: number, d: number, n = 44): number {
  let drin = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      for (let k = 0; k < n; k++)
        if (
          innen(
            body,
            -w / 2 + (w * (i + 0.5)) / n,
            -h / 2 + (h * (j + 0.5)) / n,
            -d / 2 + (d * (k + 0.5)) / n
          )
        )
          drin++;
  return endlich((drin / (n * n * n)) * w * h * d, "Rauminhalt");
}

/**
 * Eine Sanduhr als Attrappe — die Form, fuer die EINE Huelle nicht reicht.
 *
 * Sie dient zweimal: als Gegenprobe zu `huelleUeberDraht` und als Nachweis,
 * dass die Maschinerie fuer mehrteilige Kollider (`Bauteil.huellen`,
 * `punkteBis`, `quaderRaum`) noch funktioniert, obwohl sie seit E-037 von
 * keinem Bau mehr benutzt wird.
 */
function sanduhr(): THREE.BufferGeometry {
  const teile: THREE.BufferGeometry[] = [];
  const scheibe = (y: number, r: number, h: number): void => {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const g = new THREE.BoxGeometry(0.05, h, 0.05);
      g.translate(r * Math.cos(a), y, r * Math.sin(a));
      teile.push(g);
    }
  };
  scheibe(-0.6, 0.6, 0.2);
  scheibe(0.6, 0.6, 0.2);
  scheibe(0, 0.08, 0.9);
  const geo = new THREE.BufferGeometry();
  const alle: number[] = [];
  for (const t of teile) {
    const p = t.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) alle.push(p.getX(i), p.getY(i), p.getZ(i));
    t.dispose();
  }
  geo.setAttribute("position", new THREE.Float32BufferAttribute(alle, 3));
  return geo;
}

/* ======================================================================== */
/* 1 — Die Form ist eine Rolle                                               */
/* ======================================================================== */

describe("Besen: Form und Kollider", () => {
  it("ist EIN Netz aus Draht, ohne Glas und ohne NaN", () => {
    const bau = baueGeometrie("besen", BESEN.dims, "box");
    expect(bau.glas, "ein Zaun hat keine Scheiben").toBeNull();
    const pos = bau.koerper.getAttribute("position") as THREE.BufferAttribute;
    // Genau eine Geometrie: alles ist verschmolzen, ein Zeichenruf.
    expect(bau.koerper.groups.length, "mehr als eine Materialgruppe").toBeLessThanOrEqual(1);
    const arr = pos.array as Float32Array;
    // Ein einziges NaN beendet nicht die Funktion, sondern das WebAssembly-
    // Modul beim Bau der Huelle (siehe scrapItems.ts, `sauber`).
    expect(arr.every((v) => Number.isFinite(v)), "NaN in der Geometrie").toBe(true);
    // eslint-disable-next-line no-console
    console.log(`Netz: ${pos.count / 3} Dreiecke, ${pos.count} Eckpunkte`);
    expect(pos.count / 3, "Dreiecke").toBeGreaterThan(2500);
    expect(pos.count / 3, "unnoetig viele Dreiecke").toBeLessThan(6500);
  });

  it("misst aussen genau die Katalogmasse", () => {
    const bau = baueGeometrie("besen", BESEN.dims, "box");
    bau.koerper.computeBoundingBox();
    const b = bau.koerper.boundingBox!;
    expect(b.max.x - b.min.x, "Laenge").toBeCloseTo(LAENGE, 3);
    expect(b.max.y - b.min.y, "Hoehe").toBeCloseTo(HOEHE, 3);
    expect(b.max.z - b.min.z, "Tiefe").toBeCloseTo(TIEFE, 3);
  });

  it("ist eine Walze: ueber die ganze Laenge derselbe Querschnitt", () => {
    /*
     * DER UNTERSCHIED ZUM BALLEN. Der Ballen war im Grundriss rund; seine
     * gerundeten Ecken haben Kleinteile zur Seite geschoben, und an der
     * Bordwand blieb immer eines liegen. Eine Rolle hat Stirnscheiben: Die
     * Laenge steht ueber die ganze Hoehe, und die Schleppkante ist eine
     * Gerade ueber die volle Breite.
     */
    const { body } = besenKoerper();
    expect(body.numColliders(), "die Rolle braucht keine zweite Huelle").toBe(1);

    const stufen: Array<{ y: number; laenge: number; tiefe: number }> = [];
    for (let i = 0; i <= 10; i++) {
      const y = -HOEHE / 2 + 0.03 + (HOEHE - 0.08) * (i / 10);
      stufen.push({ y, ...kolliderBei(body, y) });
    }
    // eslint-disable-next-line no-console
    console.log(
      "Kollider ueber die Hoehe (Laenge x Tiefe):\n" +
        stufen
          .map((s) => `  y ${s.y.toFixed(2).padStart(5)}  ${s.laenge.toFixed(2)} x ${s.tiefe.toFixed(2)} m`)
          .join("\n")
    );
    mindestens(stufen.length, 10, "Hoehenstufen");

    // Die Laenge steht: keine Stufe verliert mehr als 2 % gegen die laengste.
    const maxL = Math.max(...stufen.map((s) => s.laenge));
    for (const s of stufen) {
      expect(
        s.laenge / maxL,
        `auf y ${s.y.toFixed(2)} ist die Rolle ${(100 * (1 - s.laenge / maxL)).toFixed(1)} % kuerzer`
      ).toBeGreaterThan(0.98);
    }
    // Die Tiefe dagegen laeuft nach oben zusammen — das ist die Rolle.
    expect(stufen[0].tiefe, "unten nicht die volle Tiefe").toBeGreaterThan(TIEFE * 0.95);
    for (let i = 1; i < stufen.length; i++) {
      expect(
        stufen[i].tiefe,
        `zwischen y ${stufen[i - 1].y.toFixed(2)} und ${stufen[i].y.toFixed(2)} wird sie wieder tiefer`
      ).toBeLessThanOrEqual(stufen[i - 1].tiefe + 0.01);
    }
    // Und oben bleibt eine flache Deckflaeche stehen, keine Spitze.
    const oben = stufen[stufen.length - 1].tiefe / stufen[0].tiefe;
    // eslint-disable-next-line no-console
    console.log(`Kopf: ${(100 * oben).toFixed(0)} % der Tiefe (Tabelle: ${100 * BESEN_FORM.kopf} %)`);
    expect(oben, "oben laeuft sie spitz zu statt flach").toBeGreaterThan(0.45);
    expect(oben, "oben ist sie gar nicht gequetscht").toBeLessThan(0.8);
  });

  it("die Schleppkante ist die breiteste Stelle und steht senkrecht", () => {
    /*
     * DER FEHLER, DER DIESES PAKET FAST GEKOSTET HAETTE.
     *
     * Die erste Rollenfassung nahm Teile unter 12 cm nicht mit, obwohl ihre
     * Vorderflaeche gemessen STEILER stand als die des Ballen. Die Ursache lag
     * in den untersten drei Zentimetern: Dort stand die Huelle UEBER — von
     * 1,2 cm ueber dem Boden bis 3,2 cm wuchs sie um 5,6 mm nach aussen, weil
     * der Drall die unterste Laengsnaht um die Bodenkante herumspringen liess
     * und die konvexe Huelle die Kante abrundete. Ein 5-cm-Teil wurde darunter
     * gedrueckt statt geschoben.
     *
     * Deshalb wird hier feiner gemessen als irgendwo sonst: Zentimeter fuer
     * Zentimeter ueber die untersten zehn. Kein Zentimeter darf weiter
     * herausstehen als der darunter.
     */
    const { body } = besenKoerper();
    const profil: number[] = [];
    for (let i = 0; i <= 10; i++) profil.push(kolliderR(body, -HOEHE / 2 + 0.002 + 0.01 * i, Math.PI / 2));
    endlich(profil, "Kantenprofil");
    // eslint-disable-next-line no-console
    console.log(
      "Vorderkante Zentimeter fuer Zentimeter:\n" +
        profil.map((r, i) => `  ${(0.2 + i).toFixed(1)} cm ueber Boden → ${(r * 1000).toFixed(1)} mm`).join("\n")
    );
    for (let i = 1; i < profil.length; i++) {
      expect(
        profil[i],
        `auf ${(0.2 + i).toFixed(1)} cm steht die Kante ${((profil[i] - profil[i - 1]) * 1000).toFixed(1)} mm ueber`
      ).toBeLessThanOrEqual(profil[0] + 1e-4);
    }
    // Und sie zieht sich nicht zu schnell ein: hoechstens 5 % ueber 18 cm.
    const r0 = profil[0];
    const r18 = kolliderR(body, -HOEHE / 2 + 0.18, Math.PI / 2);
    // eslint-disable-next-line no-console
    console.log(`Schleppkante ${r0.toFixed(3)} m, auf 18 cm Hoehe ${r18.toFixed(3)} m`);
    expect(r18 / r0, "die Flanke zieht sich zu schnell ein").toBeGreaterThan(0.95);
  });

  it("Gegenprobe: eine Kugel derselben Tiefe haengt unten ueber", () => {
    /*
     * Ohne diese Probe misst der Test oben nur, dass irgendein Koerper da ist.
     * Eine Kugel ist auf halber Hoehe am breitesten; unten haengt sie ueber,
     * und genau das muss auffallen.
     */
    const { physics } = platz();
    const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    physics.world.createCollider(RAPIER.ColliderDesc.ball(TIEFE / 2), body);
    const profil: number[] = [];
    for (let i = 0; i <= 10; i++) profil.push(kolliderR(body, -TIEFE / 2 + 0.002 + 0.01 * i, Math.PI / 2));
    const waechst = profil.some((r, i) => i > 0 && r > profil[0] + 1e-4);
    // eslint-disable-next-line no-console
    console.log(
      `Kugel: unten ${(profil[0] * 1000).toFixed(0)} mm, auf 10 cm ${(profil[10] * 1000).toFixed(0)} mm — ` +
        `waechst nach oben: ${waechst}`
    );
    expect(waechst, "eine Kugel duerfte die Bedingung NICHT erfuellen").toBe(true);
  });

  it("eine Huelle genuegt: sie liegt auf dem Draht, statt ihn zu ueberbruecken", () => {
    const { body } = besenKoerper();
    const bau = baueGeometrie("besen", BESEN.dims, "box");
    const ecken = punkteBis(bau.koerper, -Infinity, Infinity);
    const ab = huelleUeberDraht(body, ecken, HOEHE);
    // eslint-disable-next-line no-console
    console.log(
      `Huelle steht hoechstens ${ab.toFixed(3)} m vom naechsten Drahtknoten ab (${ecken.length / 3} Knoten)`
    );
    /*
     * 0,25 m ist die Grenze, gemessen und nicht gewaehlt: Die Rolle kommt auf
     * 0,19 m (die groesste Facette liegt auf der flachen Deckflaeche, wo die
     * Draehte am weitesten auseinanderstehen), die Sanduhr auf 0,49 m. Der
     * Abstand zwischen beiden ist der Grund, warum die Zahl nicht gefeilscht
     * ist.
     */
    expect(ab, "die Huelle haengt frei ueber dem Draht").toBeLessThan(0.25);
  });

  it("Gegenprobe: bei einer Sanduhr faellt genau diese Messung durch", () => {
    const { physics } = platz();
    const geo = sanduhr();
    const punkte = (geo.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    physics.world.createCollider(RAPIER.ColliderDesc.convexHull(punkte)!, body);
    const ab = huelleUeberDraht(body, punkte, 1.1);
    // eslint-disable-next-line no-console
    console.log(`Sanduhr: Huelle steht ${ab.toFixed(3)} m vom naechsten Knoten ab`);
    expect(ab, "eine Sanduhr duerfte die Bedingung NICHT erfuellen").toBeGreaterThan(0.25);
  });

  it("die Maschinerie fuer Formen mit Taille lebt noch", () => {
    /*
     * Seit E-037 nutzt kein Bau mehr `Bauteil.huellen`. Weil der naechste
     * Gegenstand mit Hals sie wieder braucht, wird sie hier an der Sanduhr
     * durchgespielt.
     */
    const { physics } = platz();
    const geo = sanduhr();
    const oben = punkteBis(geo, 0.48, Infinity);
    const unten = punkteBis(geo, -Infinity, -0.48);
    expect(oben.length, "obere Wolke leer").toBeGreaterThan(12);
    expect(unten.length, "untere Wolke leer").toBeGreaterThan(12);
    const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic());
    const raeume = [quaderRaum(unten), quaderRaum(oben)];
    const summe = raeume[0] + raeume[1];
    for (const [i, wolke] of [unten, oben].entries()) {
      physics.world.createCollider(
        RAPIER.ColliderDesc.convexHull(wolke)!.setMass((100 * raeume[i]) / summe),
        body
      );
    }
    expect(body.numColliders(), "zwei Huellen an einem Koerper").toBe(2);
    expect(body.mass(), "die Masse verteilt sich nicht auf 100 kg").toBeCloseTo(100, 4);
    expect(Math.abs(body.localCom().y), "der Schwerpunkt haengt schief").toBeLessThan(0.05);
    const mitte = kolliderBei(body, 0);
    // eslint-disable-next-line no-console
    console.log(`Sanduhr mit zwei Huellen: Taille ${mitte.tiefe.toFixed(2)} m`);
    expect(mitte.tiefe, "die Taille ist doch ueberbrueckt").toBeLessThan(0.1);
  });

  it("der Schwerpunkt liegt unter der Mitte", () => {
    /*
     * Bei der Rolle faellt das schwaecher aus als beim Ballen (−0,035 statt
     * −0,149 m), und das ist richtig so: Eine Walze mit flachem Kopf hat ihre
     * Masse gleichmaessiger verteilt als eine Kuppel. Unter der Mitte muss er
     * trotzdem liegen — sonst kippt sie beim Absetzen nach hinten.
     */
    const { body } = besenKoerper();
    const cm = body.localCom();
    // eslint-disable-next-line no-console
    console.log(
      `Schwerpunkt lokal y = ${cm.y.toFixed(3)} m (Mitte 0, Schleppkante ${(-HOEHE / 2).toFixed(2)})`
    );
    expect(cm.y, "der Schwerpunkt sitzt nicht unten").toBeLessThan(-0.01);
    expect(body.mass(), "die Gesamtmasse stimmt nicht").toBeCloseTo(BESEN.massKg, 1);
  });
});

/* ======================================================================== */
/* 2 — Masse und Rauminhalt sind gerechnet                                   */
/* ======================================================================== */

describe("Besen: woher Masse und Rauminhalt kommen", () => {
  /** Draht je Quadratmeter Maschendraht: 2,8 mm Draht, 50 mm Masche. */
  const DRAHT_M_JE_M2 = 56.6;
  /** Gewicht von 2,8-mm-Stahldraht (kg/m). */
  const KG_JE_M = 0.048;
  /** Handelsuebliche Rolle: 1,25 m hoch, 25 m lang. */
  const ROLLE_M2 = 1.25 * 25;
  /** „Sehr viele Maschendraehte" — acht Rollen. */
  const ROLLEN = 8;

  it("die Masse ist die Drahtmenge, nicht eine Zahl", () => {
    const flaeche = ROLLEN * ROLLE_M2;
    const kgJeM2 = DRAHT_M_JE_M2 * KG_JE_M;
    const kg = endlich(flaeche * kgJeM2, "Drahtmasse");
    // eslint-disable-next-line no-console
    console.log(
      `${ROLLEN} Rollen = ${flaeche} m² x ${kgJeM2.toFixed(2)} kg/m² = ${kg.toFixed(1)} kg ` +
        `(im Katalog ${BESEN.massKg} kg)`
    );
    expect(BESEN.massKg, "die Masse passt nicht zur Drahtmenge").toBe(Math.ceil(kg));
  });

  it("die Breite ist die Ladeflaeche — das ist die einzige bestellte Zahl", () => {
    /*
     * „Sollte auch mindestens so breit sein wie die Ladeflaeche eines LKWs."
     * Also genau 2 x BED_HALF_W. Wer an `BED_HALF_W` dreht, merkt es hier.
     */
    // eslint-disable-next-line no-console
    console.log(`Ladeflaeche innen ${(2 * BED_HALF_W).toFixed(2)} m · Rolle ${LAENGE.toFixed(2)} m`);
    expect(LAENGE, "die Rolle ist schmaler als die Ladeflaeche").toBeGreaterThanOrEqual(
      2 * BED_HALF_W
    );
  });

  it("aus dem Rauminhalt folgt eine Rolle von rund einem Meter Durchmesser", () => {
    const { body } = besenKoerper();
    const raum = rauminhalt(body, LAENGE, HOEHE, TIEFE);
    const packung = BESEN.massKg / raum;
    /** Dichteste flache Lage: zwei Drahtdurchmesser je Maschenlage. */
    const flach = ROLLEN * ROLLE_M2 * (2 * 0.0028);
    /** Ungetreten war die Rolle rund — ein Kreis der gemessenen Querschnittsflaeche. */
    const querschnitt = raum / LAENGE;
    const durchmesser = Math.sqrt((4 * querschnitt) / Math.PI);
    // eslint-disable-next-line no-console
    console.log(
      `Rauminhalt ${raum.toFixed(3)} m³ · Querschnitt ${querschnitt.toFixed(3)} m² · ` +
        `ungetretene Rolle ${durchmesser.toFixed(2)} m Durchmesser · Packung ${packung.toFixed(0)} kg/m³ ` +
        `(flach gestapelt ${flach.toFixed(2)} m³ = ${(BESEN.massKg / flach).toFixed(0)} kg/m³)`
    );
    expect(raum, "dichter als flach gestapelter Draht").toBeGreaterThan(flach);
    expect(raum / flach, "die Rolle ist zu luftig").toBeLessThan(2.0);
    expect(packung, "Packung zu gering").toBeGreaterThan(150);
    expect(packung, "dichter als eine stramme Rolle (rund 700 kg/m³)").toBeLessThan(700);
    // Die Rolle war rund: Hoehe und Tiefe muessen zu ihrem Durchmesser passen.
    expect(durchmesser, "die ungetretene Rolle waere unglaubwuerdig klein").toBeGreaterThan(0.8);
    expect(durchmesser, "die ungetretene Rolle waere unglaubwuerdig gross").toBeLessThan(1.3);
    expect(HOEHE / TIEFE, "sie ist gar nicht getreten").toBeLessThan(0.85);
  });

  it("Gegenprobe: ein voller Quader derselben Masse waere viel dichter", () => {
    const { physics } = platz();
    const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(LAENGE / 2, HOEHE / 2, TIEFE / 2),
      body
    );
    const raum = rauminhalt(body, LAENGE, HOEHE, TIEFE);
    // eslint-disable-next-line no-console
    console.log(`Quader: ${raum.toFixed(3)} m³ (Huellquader ${(LAENGE * HOEHE * TIEFE).toFixed(3)})`);
    expect(raum, "Aufbau: der Quader fuellt seinen Huellquader").toBeCloseTo(
      LAENGE * HOEHE * TIEFE,
      1
    );
    const rolle = rauminhalt(besenKoerper().body, LAENGE, HOEHE, TIEFE);
    expect(rolle, "die Rolle fuellt ihren Huellquader genauso — dann misst hier nichts").toBeLessThan(
      raum * 0.9
    );
  });
});

/* ======================================================================== */
/* 3 — Kehren                                                                */
/* ======================================================================== */

/**
 * Ein Kehrzug — und das Mass, mit dem er beurteilt wird.
 *
 * Der Besen haengt am Haken und ist damit KINEMATISCH, genau so, wie das
 * Greifsystem ein gefasstes Teil fuehrt (`gripSystem.ts`, `attachBody`).
 *
 * BEURTEILT WIRD DIE LAGE AM ENDE, NICHT DIE WEGSTRECKE. Der Ballen von E-037
 * hat Kleinteile herausgeschossen — 2,80 m Weg bei nur 1,46 m moeglichem
 * Schub. Das ist ein Loeser-Artefakt und kein Kehren; eine Tabelle, die es
 * mitzaehlt, belohnt die falsche Eigenschaft. Gefragt ist: Liegt das Teil am
 * Ende noch VOR der Schleppkante, oder ist es ueberfahren worden?
 *
 * @param gier 0 = quer zur Rollenachse (die runde Flanke schiebt),
 *             PI/2 = laengs der Achse (die Stirnscheibe schiebt)
 */
function kehrzug(
  kantenlaenge: number,
  abstand: number,
  gier = 0,
  versatzX = 0
): { weg: number; vorKante: boolean } {
  const { physics, items } = platz();
  const s = kantenlaenge;
  /*
   * Masse nach der Dichte, mit der das Spiel selbst rechnet: rund 900 kg je
   * Kubikmeter losem Schrott (`scrapItems.ts`, `trennForm`).
   */
  const teil = items.spawnScrap(
    "steel",
    Math.max(0.2, 900 * s * s * s),
    { kind: "box", dims: [s, s, s], color: 0x808080 },
    new THREE.Vector3(versatzX, s / 2 + 0.02, 0),
    // Ausdruecklich ohne Zufallsdrehung: `spawnScrap` wuerfelt sonst die
    // Gierung, und ein Waechter, der mal gruen und mal rot ist, taugt nichts.
    new THREE.Quaternion()
  );
  for (let i = 0; i < 90; i++) physics.step();
  const startZ = teil.body.translation().z;

  const START_Z = -1.9;
  const besen = items.spawnScrap(
    BESEN.materialId,
    BESEN.massKg,
    besenForm(),
    new THREE.Vector3(0, HOEHE / 2 + abstand, START_Z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, gier, 0))
  );
  besen.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);

  /** Kehrtempo (m/s) — so schnell, wie die Spinne im Schwenk laeuft. */
  const TEMPO = 0.7;
  const SCHRITTE = 320; // 5,33 s, also 3,73 m Weg
  const y = HOEHE / 2 + abstand;
  for (let i = 0; i < SCHRITTE; i++) {
    besen.body.setNextKinematicTranslation({ x: 0, y, z: START_Z + (TEMPO * (i + 1)) / 60 });
    physics.step();
  }
  for (let i = 0; i < 60; i++) physics.step();

  const halbTiefe = (gier === 0 ? TIEFE : LAENGE) / 2;
  const kante = besen.body.translation().z - halbTiefe;
  const teilZ = teil.body.translation().z;
  endlich([teilZ, kante], "Endlagen");
  return { weg: teilZ - startZ, vorKante: teilZ + s / 2 > kante - 0.08 };
}

describe("Besen: was die Schleppkante erfasst", () => {
  const GROESSEN = [0.05, 0.08, 0.12, 0.18, 0.25, 0.35, 0.5];
  const ABSTAENDE = [0.0, 0.05, 0.1];
  /**
   * Der Ballen von E-037 unter DEMSELBEN Mass, im selben Lauf gemessen.
   * `true` = das Teil blieb vor der Kante.
   */
  const BALLEN: Record<string, boolean[]> = {
    "0.05": [true, false, false],
    "0.08": [true, true, false],
    "0.12": [true, true, true],
    "0.18": [true, true, true],
    "0.25": [true, true, true],
    "0.35": [true, true, true],
    "0.5": [true, true, true],
  };

  for (const [name, gier] of [
    ["quer zur Achse (die runde Flanke schiebt)", 0],
    ["laengs der Achse (die Stirnscheibe schiebt)", Math.PI / 2],
  ] as Array<[string, number]>) {
    it(`nimmt ${name} alles ab 5 cm mit — und nirgends weniger als der Ballen`, () => {
      const zeilen: string[] = [];
      let geprueft = 0;
      for (const s of GROESSEN) {
        const reihe = ABSTAENDE.map((a) => kehrzug(s, a, gier));
        zeilen.push(
          `  ${(s * 100).toFixed(0).padStart(3)} cm : ` +
            reihe
              .map(
                (r, i) =>
                  `${(ABSTAENDE[i] * 100).toFixed(0)} cm ${r.vorKante ? "JA " : "nein"} ` +
                  `(${r.weg.toFixed(2)} m, Ballen ${BALLEN[String(s)][i] ? "JA" : "nein"})`
              )
              .join(" · ")
        );
        for (const [i, r] of reihe.entries()) {
          geprueft++;
          if (i === 0) {
            expect(r.vorKante, `${s} m bei aufliegender Kante wird ueberfahren`).toBe(true);
          }
          if (BALLEN[String(s)][i]) {
            expect(
              r.vorKante,
              `${s} m bei ${ABSTAENDE[i]} m Spalt kam beim Ballen mit und jetzt nicht mehr`
            ).toBe(true);
          }
        }
      }
      // eslint-disable-next-line no-console
      console.log(`Kehr-Tabelle ${name}\n` + zeilen.join("\n"));
      mindestens(geprueft, GROESSEN.length * ABSTAENDE.length, "Kehrzuege");
    });
  }

  it("Gegenprobe: was flacher ist als der Spalt, bleibt liegen", () => {
    /*
     * Der Waechter oben muss auch scheitern koennen. Ein 3-cm-Stueck bei 12 cm
     * Bodenabstand darf NICHT mitkommen — sonst misst der Test etwas anderes
     * als das, was er zu messen glaubt.
     */
    for (const gier of [0, Math.PI / 2]) {
      const r = kehrzug(0.03, 0.12, gier);
      // eslint-disable-next-line no-console
      console.log(
        `Gegenprobe ${gier === 0 ? "quer" : "laengs"}: 3 cm bei 12 cm Spalt → ` +
          `${r.vorKante ? "JA (schlecht)" : "nein (richtig)"}, ${r.weg.toFixed(2)} m`
      );
      expect(r.vorKante, "ein flaches Teil rutscht unter der Kante durch").toBe(false);
    }
  });

  it("raeumt in einem Zug fast seine volle Breite", () => {
    /*
     * DIE ZAHL, DIE DIE BREITE RECHTFERTIGT. Der Ballen (2,40 m) raeumte
     * gemessen 2,1 m: Seine gerundeten Ecken schoben die aeusseren Teile zur
     * Seite, statt sie mitzunehmen. Die Rolle hat Stirnscheiben statt Ecken —
     * hier wird nachgemessen, wie weit aussen sie noch greift.
     */
    const { physics, items } = platz();
    const xs = [0, 0.4, 0.8, 1.05, 1.2, 1.3, 1.34, 1.45];
    const teile: ScrapItem[] = [];
    for (const x of xs) {
      teile.push(
        items.spawnScrap(
          "steel",
          1.6,
          { kind: "box", dims: [0.12, 0.12, 0.12], color: 0x808080 },
          new THREE.Vector3(x, 0.08, 0),
          new THREE.Quaternion()
        )
      );
    }
    for (let i = 0; i < 90; i++) physics.step();
    const besen = items.spawnScrap(
      BESEN.materialId,
      BESEN.massKg,
      besenForm(),
      new THREE.Vector3(0, HOEHE / 2, -1.9),
      new THREE.Quaternion()
    );
    besen.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    for (let i = 0; i < 320; i++) {
      besen.body.setNextKinematicTranslation({ x: 0, y: HOEHE / 2, z: -1.9 + (0.7 * (i + 1)) / 60 });
      physics.step();
    }
    for (let i = 0; i < 60; i++) physics.step();
    const kante = besen.body.translation().z - TIEFE / 2;
    let aussen = -1;
    const zeilen: string[] = [];
    for (const [i, t] of teile.entries()) {
      const p = t.body.translation();
      const mit = p.z + 0.06 > kante - 0.08;
      if (mit) aussen = Math.max(aussen, xs[i]);
      zeilen.push(`  x ${xs[i].toFixed(2)} m: ${mit ? "mitgenommen" : "liegen geblieben"}`);
    }
    const bahn = 2 * aussen + 0.12;
    // eslint-disable-next-line no-console
    console.log(`Geraeumte Breite in EINEM Zug:\n${zeilen.join("\n")}\n  → ${bahn.toFixed(2)} m`);
    mindestens(teile.length, 8, "Proben ueber die Breite");
    // Mindestens vier Fuenftel der Rollenlaenge, und mehr als der Ballen konnte.
    expect(bahn, "die Rolle raeumt weniger als vier Fuenftel ihrer Laenge").toBeGreaterThan(
      LAENGE * 0.8
    );
    expect(bahn, "kein Gewinn gegenueber dem Ballen (2,10 m)").toBeGreaterThan(2.1);
    // Gegenprobe: ganz aussen ist Schluss, sonst misst der Test nur „irgendwas bewegt sich".
    expect(aussen, "selbst 1,45 m neben der Mitte kaeme noch mit").toBeLessThan(1.34);
  });

  it("kehrt eine Ladeflaeche QUER — so wie Patrick es beschreibt", () => {
    /*
     * DER ZIELKONFLIKT UND SEINE AUFLOESUNG.
     *
     * Bis E-049 war der Besen 2,40 m breit, damit er LAENGS zwischen die
     * Bordwaende passt (innen 2,70 m). Mit 2,70 m geht das nicht mehr — es
     * bliebe null Luft. Patrick hat es selbst entschieden: „Breite so lassen,
     * ich kann die Spinne ja drehen, damit es passt."
     *
     * Gekehrt wird die Ladeflaeche seitdem QUER: Die Rollenachse liegt LAENGS
     * der Flaeche, zwischen den Bordwaenden steht die Tiefe (1,12 m), und
     * geschoben wird mit der Stirnscheibe zum offenen Heck. Das ist der Fall,
     * der hier gemessen wird — der laengs gefuehrte gibt es nicht mehr.
     */
    const { physics, items } = platz();
    const WAND_H = 0.64; // delivery/vehicleModel.ts, `wandHoehe`
    const FLAECHE_Y = 1.1; // Ladehoehe einer Pritsche (SW, aus dem Modell)
    const LADE_LEN = BED_LEN.pritsche!;
    const luft = (2 * BED_HALF_W - TIEFE) / 2;
    // eslint-disable-next-line no-console
    console.log(
      `Ladeflaeche quer: innen ${(2 * BED_HALF_W).toFixed(2)} m, Rolle quer ${TIEFE.toFixed(2)} m → ` +
        `${luft.toFixed(2)} m Luft je Bordwand (laengs waeren es ${(2 * BED_HALF_W - LAENGE).toFixed(2)} m)`
    );
    expect(luft, "quer passt sie auch nicht mehr hinein").toBeGreaterThan(0.3);
    expect(
      2 * BED_HALF_W - LAENGE,
      "Aufbau: laengs muesste sie klemmen, sonst braucht es das Drehen gar nicht"
    ).toBeLessThan(0.05);

    const fest = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(BED_HALF_W, 0.05, LADE_LEN / 2).setTranslation(0, FLAECHE_Y - 0.05, 0),
      fest
    );
    for (const sx of [-1, 1])
      physics.world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.04, WAND_H / 2, LADE_LEN / 2).setTranslation(
          sx * (BED_HALF_W + 0.04),
          FLAECHE_Y + WAND_H / 2,
          0
        ),
        fest
      );
    physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(BED_HALF_W, WAND_H / 2, 0.04).setTranslation(
        0,
        FLAECHE_Y + WAND_H / 2,
        -LADE_LEN / 2
      ),
      fest
    );

    const reste: ScrapItem[] = [];
    for (let i = 0; i < 6; i++)
      reste.push(
        items.spawnScrap(
          "steel",
          6,
          { kind: "box", dims: [0.14, 0.12, 0.14], color: 0x808080 },
          new THREE.Vector3(-1.25 + i * 0.5, FLAECHE_Y + 0.2, -0.6),
          new THREE.Quaternion()
        )
      );
    for (let i = 0; i < 90; i++) physics.step();
    const runter = (): number => reste.filter((r) => r.body.translation().y < FLAECHE_Y - 0.2).length;
    expect(runter(), "Aufbau: vor dem Kehren liegt noch nichts unten").toBe(0);

    const zStart = -LADE_LEN / 2 + LAENGE / 2 + 0.05;
    const yOben = FLAECHE_Y + WAND_H + HOEHE / 2 + 0.3;
    const yUnten = FLAECHE_Y + HOEHE / 2 + 0.01;
    const besen = items.spawnScrap(
      BESEN.materialId,
      BESEN.massKg,
      besenForm(),
      new THREE.Vector3(0, yOben, zStart),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0))
    );
    besen.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    const setz = (x: number, y: number, z: number): void => {
      besen.body.setNextKinematicTranslation({ x, y, z });
      physics.step();
    };
    /** Drei Bahnen nebeneinander: die Rolle ist quer 1,12 m breit, die Flaeche 2,70. */
    const bahnen = [0, -(BED_HALF_W - TIEFE / 2), BED_HALF_W - TIEFE / 2];
    const nach: number[] = [];
    for (const bahn of bahnen) {
      for (let i = 0; i < 30; i++) setz(bahn, yOben, zStart);
      for (let i = 0; i < 60; i++) setz(bahn, yOben + ((yUnten - yOben) * (i + 1)) / 60, zStart);
      const weg = LADE_LEN + 1.4;
      const schritte = Math.round((weg / 0.7) * 60);
      for (let i = 0; i < schritte; i++) setz(bahn, yUnten, zStart + (weg * (i + 1)) / schritte);
      for (let i = 0; i < 60; i++) physics.step();
      nach.push(runter());
      for (let i = 0; i < 30; i++) setz(bahn, yOben, zStart + weg);
      for (let i = 0; i < 40; i++) setz(bahn, yOben, zStart + weg - ((weg + 0.2) * (i + 1)) / 40);
    }
    for (let i = 0; i < 120; i++) physics.step();
    // eslint-disable-next-line no-console
    console.log(`  ${nach.map((n, i) => `nach Bahn ${i + 1}: ${n}/6`).join(" · ")}`);
    // Der Ballen brauchte drei Bahnen und liess eines liegen. Die Rolle nicht.
    expect(runter(), "die Flaeche wurde nicht leer gekehrt").toBe(reste.length);
  });
});

/* ======================================================================== */
/* 4 — Greifen und Schwenken                                                 */
/* ======================================================================== */

/**
 * Der Schalenkorb, wie ihn `excavator.ts` (`isInsideGrapple`) rechnet — hier
 * nachgebaut, weil der Bagger sich kopflos nicht bauen laesst.
 */
function korbTest(splay: number): (p: THREE.Vector3) => boolean {
  const spitze = clawPoint(0, splay, CLAW_SEGMENTS, new THREE.Vector3());
  const tipY = spitze.y;
  const tipR = Math.max(spitze.z, 0);
  return (p: THREE.Vector3): boolean => {
    if (p.y > CLAW_RING_Y + 0.22 || p.y < tipY - 0.18) return false;
    const t = THREE.MathUtils.clamp(
      (CLAW_RING_Y - p.y) / Math.max(CLAW_RING_Y - tipY, 0.01),
      0,
      1
    );
    return Math.hypot(p.x, p.z) <= THREE.MathUtils.lerp(CLAW_RING_R, tipR, t) + 0.14;
  };
}

/** Wie viele Schalen liegen an? Nachbau von `excavator.krallenKontakte`. */
function krallen(body: RAPIER.RigidBody, splay: number, greiferPos: THREE.Vector3): number {
  const col = body.collider(0);
  if (!col) return 0;
  const KONTAKT_NAH = 0.14; // excavator.ts
  let treffer = 0;
  const p = new THREE.Vector3();
  for (let c = 0; c < CLAW_COUNT; c++) {
    const a = (c / CLAW_COUNT) * Math.PI * 2;
    for (const seg of [CLAW_SEGMENTS, Math.round(CLAW_SEGMENTS * 0.6)]) {
      clawPoint(a, splay, seg, p).add(greiferPos);
      const pr = col.projectPoint({ x: p.x, y: p.y, z: p.z }, false);
      if (!pr) continue;
      const d = Math.hypot(pr.point.x - p.x, pr.point.y - p.y, pr.point.z - p.z);
      if (pr.isInside || d <= KONTAKT_NAH) {
        treffer++;
        break;
      }
    }
  }
  return treffer;
}

/** Sensormitte unter dem Spinnenursprung (`excavator.ts`). */
const SENSOR_LOKAL = -(0.55 + 0.2 + 0.75);

describe("Besen: die Spinne bekommt ihn", () => {
  /**
   * So, wie der Spieler es tut: Spinne offen ueber die Rolle, bis zum
   * Bodenanschlag herunter, dann zufahren. Der Arm steigt dabei mit, weil die
   * Schalen im Zufahren tiefer reichen (`clawTipDepth`).
   */
  function zufahren(versatzX = 0): {
    gefasst: number;
    beiClosure: number | null;
    krallenDann: number;
    gehoben: number;
  } {
    const { physics, items } = platz();
    const rolle = items.spawnScrap(
      BESEN.materialId,
      BESEN.massKg,
      besenForm(),
      new THREE.Vector3(0, HOEHE / 2 + 0.05, 0),
      new THREE.Quaternion()
    );
    for (let i = 0; i < 90; i++) physics.step();
    const vorher = rolle.body.translation().y;

    const gp = new THREE.Vector3(versatzX, clawTipDepth(CLAW_OPEN_SPLAY), 0);
    const greifer = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(gp.x, gp.y, gp.z)
    );
    const grip = new GripSystem(physics.world, greifer);
    let splay = CLAW_OPEN_SPLAY;
    const lokal = new THREE.Vector3();
    grip.insideGrapple = (welt) => korbTest(splay)(lokal.copy(welt).sub(gp));
    grip.krallenKontakte = (b) => krallen(b, splay, gp);

    let beiClosure: number | null = null;
    let krallenDann = 0;
    for (let i = 0; i <= 48; i++) {
      const closure = Math.min(i / 48, 1);
      splay = THREE.MathUtils.lerp(CLAW_OPEN_SPLAY, CLAW_CLOSED_SPLAY, closure);
      gp.set(versatzX, clawTipDepth(splay), 0);
      greifer.setNextKinematicTranslation({ x: gp.x, y: gp.y, z: gp.z });
      grip.update(closure, true, new THREE.Vector3(gp.x, gp.y + SENSOR_LOKAL, gp.z), 1 / 60);
      if (grip.grippedCount > 0 && beiClosure === null) {
        beiClosure = closure;
        krallenDann = krallen(rolle.body, splay, gp);
      }
      physics.step();
    }
    for (let i = 0; i < 120; i++) {
      const y = clawTipDepth(CLAW_CLOSED_SPLAY) + (3.0 * (i + 1)) / 120;
      gp.set(versatzX, y, 0);
      greifer.setNextKinematicTranslation({ x: gp.x, y, z: gp.z });
      grip.update(1, true, new THREE.Vector3(gp.x, y + SENSOR_LOKAL, gp.z), 1 / 60);
      physics.step();
    }
    return {
      gefasst: grip.grippedCount,
      beiClosure,
      krallenDann,
      gehoben: rolle.body.translation().y - vorher,
    };
  }

  it("passt sie unter die Spinne? Die Zahlen dazu", () => {
    /*
     * Drei Masse, und keines davon heisst „sie passt in den Korb":
     *
     *  - OFFEN spannt die Spinne 3,38 m. Die Rolle ist 2,70 m lang, sie kann
     *    also von oben ueber sie kommen, ohne anzustossen — 0,68 m Luft.
     *  - IM GREIFFENSTER (Schliessgrad 0,60 bis 0,98) ist der Korb hoechstens
     *    1,46 m weit. UMFASSEN kann sie die Rolle also nicht; sie drueckt auf
     *    den gequetschten Kopf und haelt sie mit den Schalen.
     *  - NOETIGE SCHALEN nach E-043: `min(2, floor(Groesse / 0,629 m))`. Bei
     *    2,70 m sind das zwei — die Rolle muss also wirklich anliegen und
     *    nicht nur mit einer Ecke im Korb haengen.
     */
    const offen = clawSpan(CLAW_OPEN_SPLAY);
    const beiGriff = clawSpan(THREE.MathUtils.lerp(CLAW_OPEN_SPLAY, CLAW_CLOSED_SPLAY, 0.6));
    const noetig = noetigeKrallenFuer(LAENGE);
    endlich([offen, beiGriff, SCHALENLUECKE], "Spinnenmasse");
    // eslint-disable-next-line no-console
    console.log(
      `Spinne offen ${offen.toFixed(2)} m · im Greiffenster ${beiGriff.toFixed(2)} m · ` +
        `Schalenluecke ${SCHALENLUECKE.toFixed(3)} m · noetige Schalen fuer ${LAENGE.toFixed(2)} m: ${noetig}`
    );
    expect(LAENGE, "die offene Spinne kommt nicht mehr ueber sie").toBeLessThan(offen - 0.3);
    expect(noetig, "bei dieser Groesse muessen zwei Schalen anliegen").toBe(2);
  });

  it("wird vom Bodenanschlag aus gefasst und kommt hoch", () => {
    const r = zufahren();
    // eslint-disable-next-line no-console
    console.log(
      `Greifen vom Bodenanschlag: gefasst ab Schliessgrad ${r.beiClosure?.toFixed(2)} ` +
        `mit ${r.krallenDann} Schalen an der Rolle, ${r.gehoben.toFixed(2)} m angehoben`
    );
    expect(r.gefasst, "die Rolle wird nicht gefasst").toBe(1);
    expect(r.krallenDann, "sie haengt an weniger Schalen als E-043 verlangt").toBeGreaterThanOrEqual(
      noetigeKrallenFuer(LAENGE)
    );
    expect(r.gehoben, "sie kommt nicht mit hoch").toBeGreaterThan(2.0);
  });

  it("Gegenprobe: dreieinhalb Meter daneben bekommt sie sie nicht", () => {
    const r = zufahren(3.6);
    // eslint-disable-next-line no-console
    console.log(`Gegenprobe 3,6 m daneben: gefasst ${r.gefasst}`);
    expect(r.gefasst, "drei Meter daneben darf nichts gefasst werden").toBe(0);
  });

  it("sie ist tragbar — die Spinne nimmt sie ans Gelenk", () => {
    const { physics, items } = platz();
    const rolle = items.spawnScrap(
      BESEN.materialId,
      BESEN.massKg,
      besenForm(),
      new THREE.Vector3(0, HOEHE / 2 + 0.05, 0),
      new THREE.Quaternion()
    );
    for (let i = 0; i < 30; i++) physics.step();
    const greifer = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 3, 0)
    );
    expect(
      new GripSystem(physics.world, greifer).attachBody(rolle.body),
      "die Spinne verweigert die Rolle"
    ).toBe(true);

    /*
     * Gegenprobe: Auch vier Tonnen nimmt die Spinne ans Gelenk — seit E-152
     * gibt es beim Greifen keine Massengrenze mehr; ob es hochgeht,
     * entscheidet der Arm nach der Traglasttabelle (`test/traglast.test.ts`).
     * Vorher: `MAX_TOTAL_KG` 3 500 kg lehnte hier ab.
     */
    const { physics: p2, items: i2 } = platz();
    const brocken = i2.spawnScrap(
      "steel",
      4000,
      { kind: "box", dims: [2, 1, 3], color: 0x808080 },
      new THREE.Vector3(0, 2, 0),
      new THREE.Quaternion()
    );
    const g2 = p2.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 3, 0)
    );
    expect(
      new GripSystem(p2.world, g2).attachBody(brocken.body),
      "vier Tonnen: Greifen geht, Heben entscheidet der Arm"
    ).toBe(true);
  });

  it("schwenkt sie am Arm, ohne an den Unterwagen zu schlagen — quer ja, laengs knapp nicht", () => {
    /*
     * Frage des Bauleiters: „Ein 2,70 m breites Teil quer am Arm schlaegt beim
     * Schwenken weiter aus als ein 1,20 m breites. Miss, ob er dabei irgendwo
     * anschlaegt."
     *
     * Gerechnet, nicht simuliert — der Bagger laesst sich kopflos nicht bauen.
     * Die Zahlen stammen aus `excavator.ts`: Ausleger 5,20 m, Stiel 4,00 m,
     * Drehpunkt (0 | 2,95 | 0,55), Spinne 0,55 m unter der Stielspitze,
     * Chassis-Kollider `cuboid(1.2, 0.75, 2.2)`.
     */
    const BOOM_LEN = 5.2;
    const STICK_LEN = 4.0;
    const PIVOT_Z = 0.55;
    const PIVOT_Y = 2.95;
    const GRAPPLE_LINK = 0.55;
    const BOOM_MIN = THREE.MathUtils.degToRad(5);
    const BOOM_MAX = THREE.MathUtils.degToRad(70);
    const STICK_MIN = THREE.MathUtils.degToRad(-140);
    const STICK_MAX = THREE.MathUtils.degToRad(-25);
    const CHASSIS_ECKE = Math.hypot(1.2, 2.2);

    /** Engster Spinnenradius, wenn die Spinne auf dieser Hoehe steht. */
    function engsterRadius(yZiel: number): number {
      let r = Infinity;
      let gesehen = 0;
      for (let b = BOOM_MIN; b <= BOOM_MAX; b += 0.004) {
        for (let st = STICK_MIN; st <= STICK_MAX; st += 0.004) {
          const y = PIVOT_Y + BOOM_LEN * Math.sin(b) + STICK_LEN * Math.sin(b + st) - GRAPPLE_LINK;
          if (Math.abs(y - yZiel) > 0.05) continue;
          gesehen++;
          r = Math.min(r, PIVOT_Z + BOOM_LEN * Math.cos(b) + STICK_LEN * Math.cos(b + st));
        }
      }
      mindestens(gesehen, 1, `Armstellungen auf ${yZiel.toFixed(2)} m`);
      return endlich(r, "engster Radius");
    }

    const TIEF = clawTipDepth(CLAW_OPEN_SPLAY);
    const zeilen: string[] = [];
    let schlimmsteQuer = Infinity;
    let schlimmsteLaengs = Infinity;
    for (const unten of [0, 0.5, 1.0]) {
      const r = engsterRadius(unten + TIEF);
      const quer = r - TIEFE / 2;
      const laengs = r - LAENGE / 2;
      schlimmsteQuer = Math.min(schlimmsteQuer, quer);
      schlimmsteLaengs = Math.min(schlimmsteLaengs, laengs);
      zeilen.push(
        `  Last ${unten.toFixed(1)} m ueber Grund: Spinne bei ${r.toFixed(2)} m → ` +
          `Rolle quer ab ${quer.toFixed(2)} m, laengs ab ${laengs.toFixed(2)} m`
      );
    }
    // eslint-disable-next-line no-console
    console.log(
      `Schwenken mit haengender Rolle (Chassis-Ecke ${CHASSIS_ECKE.toFixed(2)} m von der Drehachse)\n` +
        zeilen.join("\n")
    );
    // QUER gehalten geht es immer — das ist die Lage, in der er sie auch fuehrt.
    expect(schlimmsteQuer, "quer gehalten schlaegt sie an den Unterwagen").toBeGreaterThan(
      CHASSIS_ECKE
    );
    /*
     * LAENGS gehalten reicht sie bei ganz eingezogenem Arm 15 cm ueber die
     * Chassis-Ecke. Das ist ein Befund und kein Fehler: Es passiert nur am
     * Anschlag, weit innerhalb des Schwenkbands 5,8 bis 9,2 m. Der Waechter
     * haelt die Zahl fest, damit sie auffaellt, wenn jemand den Arm verlaengert.
     */
    expect(schlimmsteLaengs, "laengs gehalten ist es ploetzlich frei — Zahl pruefen").toBeLessThan(
      CHASSIS_ECKE
    );
    expect(
      CHASSIS_ECKE - schlimmsteLaengs,
      "die Ueberdeckung ist groesser geworden als die gemessenen 15 cm"
    ).toBeLessThan(0.25);
  });
});

/* ======================================================================== */
/* 5 — Platzinventar: eine, wertlos, kommt wieder                            */
/* ======================================================================== */

function tagesuhr(): Daylight {
  const szene = new THREE.Scene();
  szene.background = new THREE.Color(0x000000);
  return new Daylight(szene, new THREE.HemisphereLight(), new THREE.DirectionalLight());
}

describe("Besen: Platzinventar, kein Handelsgut", () => {
  it("wird beim Neuen Spiel genau einmal gesetzt", () => {
    const { items } = platz();
    expect(items.inventarNachtragen(), "der erste Aufruf legt ihn hin").toEqual([BESEN.name]);
    expect(items.inventarNachtragen(), "der zweite legt keinen zweiten an").toEqual([]);
    const inventar = items.items.filter((it) => istPlatzinventar(it.shape));
    expect(inventar.length, "es liegt nicht genau einer auf dem Platz").toBe(1);
    expect(inventar[0].shape?.inventar).toBe("besen");
  });

  it("die Fraktion ist Mischschrott — und nach der Stahlschrott-Regel auch richtig", () => {
    /*
     * Ansage Patrick: „Egal, er wird nie verkauft." Stimmt — die Fraktion
     * steht nur in der Griff-Info. Gerade deshalb soll sie stimmen.
     *
     * Gruener, kunststoffummantelter Draht ist ein Verbund: 2,8-mm-Stahlkern
     * mit Mantel auf 3,8 mm ergibt 48,3 g/m Stahl gegen 7,3 g/m PVC, also
     * 13,1 % Fremdstoff. Die Stahlschrott-Regel (E-042) laesst hoechstens
     * 10 % zu — „steel" waere also sofort wieder falsch. „zinc" war es schon
     * vorher, seit der Draht ummantelt ist. Bleibt Mischschrott.
     */
    const kern = Math.PI * 1.4 * 1.4 * 1e-6 * 7850;
    const mantel = Math.PI * (1.9 * 1.9 - 1.4 * 1.4) * 1e-6 * 1400;
    const fremd = mantel / (kern + mantel);
    // eslint-disable-next-line no-console
    console.log(
      `Draht: ${(kern * 1000).toFixed(1)} g/m Stahl + ${(mantel * 1000).toFixed(1)} g/m PVC ` +
        `= ${(100 * fremd).toFixed(1)} % Fremdstoff (Stahlschrott laesst 10 % zu)`
    );
    expect(fremd, "Aufbau: dann waere Stahlschrott doch zulaessig").toBeGreaterThan(0.1);
    expect(BESEN.materialId, "die Fraktion passt nicht zur Begruendung").toBe("mixed");
  });

  it("bleibt liegen, wo er hingelegt wird — und kommt dabei zur Ruhe", () => {
    /*
     * BEFUND E-037: Die Vorgaengerform kam auf dem gebauten Platz nicht zur
     * Ruhe. Sie wanderte nur Millimeter, blieb aber WACH — und ein wacher
     * Koerper rechnet in jedem Bild mit. Ursache waren die weichen Kontakte
     * zusammen mit der sehr niedrigen Daempfung, die `dampLin` schweren
     * Koerpern gibt. Platzinventar bekommt seitdem eine Mindestdaempfung.
     */
    const { physics, items } = platz();
    const besen = items.spawnBesen()!;
    expect(
      besen.body.linearDamping(),
      "Platzinventar bekommt keine Mindestdaempfung"
    ).toBeGreaterThan(dampLin(BESEN.massKg));
    expect(besen.body.angularDamping(), "dasselbe fuer die Drehung").toBeGreaterThan(
      dampAng(BESEN.massKg)
    );

    // Gegenprobe: dasselbe Stueck OHNE die Inventarmarke behaelt die niedrige
    // Daempfung — „Schweres behaelt seinen Schwung" gilt weiter fuer Ware.
    const ware = items.spawnScrap(
      BESEN.materialId,
      BESEN.massKg,
      { ...besenForm(), inventar: undefined },
      new THREE.Vector3(12, 2, 12),
      new THREE.Quaternion()
    );
    expect(ware.body.linearDamping(), "Aufbau: Ware wird auch gebremst").toBeCloseTo(
      dampLin(BESEN.massKg),
      6
    );

    let einschlafen = -1;
    for (let i = 0; i < 1800 && einschlafen < 0; i++) {
      physics.step();
      if (besen.body.isSleeping()) einschlafen = i;
    }
    // eslint-disable-next-line no-console
    console.log(`eingeschlafen nach ${(einschlafen / 60).toFixed(1)} s`);
    expect(einschlafen, "er schlaeft in dreissig Sekunden nicht ein").toBeGreaterThanOrEqual(0);

    const p0 = besen.body.translation();
    const start = { x: p0.x, z: p0.z };
    for (let i = 0; i < 1800; i++) physics.step();
    const p1 = besen.body.translation();
    const gewandert = endlich(Math.hypot(p1.x - start.x, p1.z - start.z), "Wanderweg");
    // eslint-disable-next-line no-console
    console.log(`nach weiteren 30 s: ${(gewandert * 1000).toFixed(1)} mm gewandert`);
    expect(gewandert, "er wandert vom Fleck").toBeLessThan(0.005);
    expect(besen.body.isSleeping(), "er ist wieder aufgewacht").toBe(true);
  });

  it("liegt in seiner Gebrauchslage, nicht auf der Flanke", () => {
    /*
     * Seit E-037 ist die Bauform schon die Liegelage: unten die Rolle, oben
     * der gequetschte Kopf. Nach dem Hinlegen darf sie sich nicht umlegen.
     */
    const { physics, items } = platz();
    const besen = items.spawnBesen()!;
    const y0 = besen.body.translation().y;
    for (let i = 0; i < 240; i++) physics.step();
    const rot = besen.body.rotation();
    const hoch = new THREE.Vector3(0, 1, 0).applyQuaternion(
      new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w)
    );
    // eslint-disable-next-line no-console
    console.log(
      `nach 4 s: y ${besen.body.translation().y.toFixed(3)} (gesetzt ${y0.toFixed(3)}), ` +
        `Neigung ${((Math.acos(Math.min(1, hoch.y)) * 180) / Math.PI).toFixed(1)} Grad`
    );
    expect(hoch.y, "sie ist umgekippt").toBeGreaterThan(0.97);
    expect(besen.body.translation().y, "sie ist eingesunken").toBeGreaterThan(HOEHE / 2 - 0.06);
  });

  it("steht als Gattung in der Inventarliste, nicht als Sonderfall", () => {
    expect(
      PLATZINVENTAR.some((st) => st.id === "besen"),
      "der Besen fehlt in der Liste"
    ).toBe(true);
    for (const st of PLATZINVENTAR) {
      expect(st.id.length, "ein Inventarstueck ohne Kennung").toBeGreaterThan(0);
      expect(st.name.length, `${st.id} hat keinen Namen`).toBeGreaterThan(0);
    }
  });

  it("steht in keiner Ladungsliste — er wird nie angeliefert", () => {
    const listen = [SPECS, KATALOG_SPECS, KATALOG_BIG, KATALOG_HUGE];
    mindestens(listen.length, 4, "gepruefte Ladungslisten");
    for (const liste of listen) {
      mindestens(liste.length, 1, "Eintraege in der Ladungsliste");
      expect(
        liste.some((sp) => sp.bau === "besen"),
        "ein Besen steht in einer Ladungsliste und wuerde angeliefert"
      ).toBe(false);
    }
  });

  it("geht in der Spinne nicht kaputt — und die Marke ist der Grund", () => {
    /*
     * Zwei Sicherungen, und der Test trennt sie sauber.
     *
     * Die eine ist die Inventarmarke: Ein Werkzeug wird nicht zerdrueckt.
     * Die andere ist die Dichteregel (`istPressbar`, Grenze 260 kg/m³ im
     * Huellquader). Seit der Rolle greift ZUFAELLIG auch die zweite — mit
     * 2,70 x 0,80 x 1,12 m kommt sie auf 281 kg/m³ und gilt schon deshalb als
     * zu massiv zum Quetschen. Beim Ballen waren es 198 kg/m³, da griff nur
     * die Marke.
     *
     * Ein Waechter, der beide zugleich prueft, misst nichts. Also wird die
     * Marke an einem Stueck geprueft, das die Dichteregel eindeutig passieren
     * WUERDE.
     */
    const { items } = platz();
    const besen = items.spawnBesen()!;
    expect(items.isCrushable(besen), "der Besen laesst sich zerdruecken").toBe(false);

    const locker = [LAENGE, HOEHE + 0.4, TIEFE + 0.3];
    const dichte = BESEN.massKg / (locker[0] * locker[1] * locker[2]);
    // eslint-disable-next-line no-console
    console.log(
      `Rolle im Huellquader: ${(BESEN.massKg / (LAENGE * HOEHE * TIEFE)).toFixed(0)} kg/m³ · ` +
        `Probestueck ${dichte.toFixed(0)} kg/m³ (Grenze 260)`
    );
    expect(dichte, "Aufbau: das Probestueck muesste die Dichteregel passieren").toBeLessThan(260);

    const mitMarke = items.spawnScrap(
      BESEN.materialId,
      BESEN.massKg,
      { ...besenForm(), dims: [...locker] },
      new THREE.Vector3(9, 2, 9)
    );
    const ohneMarke = items.spawnScrap(
      BESEN.materialId,
      BESEN.massKg,
      { ...besenForm(), dims: [...locker], inventar: undefined },
      new THREE.Vector3(14, 2, 14)
    );
    expect(items.isCrushable(mitMarke), "mit Marke doch zerdrueckbar").toBe(false);
    expect(items.isCrushable(ohneMarke), "Aufbau: ohne Marke waere es pressbar").toBe(true);
  });

  it("wiegt fuer die Wirtschaft nichts — an genau einer Stelle", () => {
    const { items } = platz();
    const besen = items.spawnBesen()!;
    expect(besen.composition, "der Besen hat keine Zusammensetzung").toEqual([
      { materialId: BESEN.materialId, massKg: 0 },
    ]);
    expect(besen.massKg, "physikalisch wiegt er sehr wohl etwas").toBe(BESEN.massKg);
  });

  it("bringt beim Abholer kein Geld — auch nicht in gemischter Ladung", () => {
    const leer = { despawnByBody: () => false } as unknown as CompositeManager;

    const a = (() => {
      const { items } = platz();
      const teil = items.spawnScrap(
        "steel",
        100,
        { kind: "box", dims: [0.4, 0.4, 0.4], color: 0x808080 },
        new THREE.Vector3(0, 2, 0),
        new THREE.Quaternion()
      );
      return new Account().sellContainer([teil], items, leer);
    })();

    const b = (() => {
      const { items } = platz();
      const besen = items.spawnBesen()!;
      const teil = items.spawnScrap(
        "steel",
        100,
        { kind: "box", dims: [0.4, 0.4, 0.4], color: 0x808080 },
        new THREE.Vector3(0, 2, 0),
        new THREE.Quaternion()
      );
      return new Account().sellContainer([teil, besen], items, leer);
    })();

    // eslint-disable-next-line no-console
    console.log(
      `Verkauf ohne Besen ${a.eur.toFixed(2)} EUR / ${a.massKg} kg · ` +
        `mit Besen ${b.eur.toFixed(2)} EUR / ${b.massKg} kg`
    );
    expect(b.eur, "der Besen aendert den Erloes").toBeCloseTo(a.eur, 6);
    expect(b.massKg, "der Besen zaehlt als Umschlag").toBe(a.massKg);
    expect(b.purity, "der Besen verunreinigt die Ladung").toBeCloseTo(a.purity, 6);
  });

  it("und wenn NUR er auf dem Wagen liegt, bleibt das Spiel trotzdem stehen? Nein.", () => {
    const { items } = platz();
    const besen = items.spawnBesen()!;
    const account = new Account();
    const vorher = account.moneyEur;
    const leer = { despawnByBody: () => false } as unknown as CompositeManager;
    const sale = account.sellContainer([besen], items, leer);
    expect(sale.eur, "fuer Inventar gibt es kein Geld").toBe(0);
    expect(sale.massKg, "Inventar zaehlt nicht als Umschlag").toBe(0);
    expect(account.moneyEur, "das Konto hat sich bewegt").toBe(vorher);
  });

  it("Gegenprobe: gewoehnlicher Schrott wird sehr wohl verkauft", () => {
    const { items } = platz();
    const teil = items.spawnScrap(
      "steel",
      100,
      { kind: "box", dims: [0.4, 0.4, 0.4], color: 0x808080 },
      new THREE.Vector3(0, 2, 0),
      new THREE.Quaternion()
    );
    const account = new Account();
    const leer = { despawnByBody: () => false } as unknown as CompositeManager;
    const sale = account.sellContainer([teil], items, leer);
    expect(sale.massKg, "Aufbau: normaler Schrott zaehlt").toBe(100);
    expect(sale.eur, "Aufbau: normaler Schrott bringt Geld").toBeGreaterThan(0);
  });

  it("ist am naechsten Tag wieder da", () => {
    const { items } = platz();
    items.remove(items.spawnBesen()!);
    expect(
      items.items.some((it) => istPlatzinventar(it.shape)),
      "weg ist weg"
    ).toBe(false);

    const uhr = tagesuhr();
    let wechsel = 0;
    for (let i = 0; i < DAY_LENGTH_S * 60; i++) {
      uhr.update(1 / 60);
      if (uhr.neuerTag) {
        uhr.neuerTag = false;
        wechsel++;
        items.inventarNachtragen();
      }
    }
    expect(wechsel, "die Uhr ist in einem Tag nicht genau einmal umgelaufen").toBe(1);
    expect(
      items.items.filter((it) => istPlatzinventar(it.shape)).length,
      "der Besen ist am naechsten Tag nicht wieder da"
    ).toBe(1);
  });

  it("Gegenprobe: ohne Tageswechsel bleibt er weg", () => {
    const { items } = platz();
    items.remove(items.spawnBesen()!);
    const uhr = tagesuhr();
    for (let i = 0; i < 600; i++) uhr.update(1 / 60);
    expect(uhr.neuerTag, "so schnell ist kein Tag um").toBe(false);
    expect(
      items.items.filter((it) => istPlatzinventar(it.shape)).length,
      "er kam ohne Tageswechsel zurueck"
    ).toBe(0);
  });
});

/* ======================================================================== */
/* 6 — Sein Fleck auf dem Hof                                                */
/* ======================================================================== */

/** Abstand eines Punktes zum Rand eines achsparallelen Rechtecks (negativ = drin). */
function zuRechteck(
  x: number,
  z: number,
  cx: number,
  cz: number,
  sx: number,
  sz: number
): number {
  const dx = Math.abs(x - cx) - sx / 2;
  const dz = Math.abs(z - cz) - sz / 2;
  return dx < 0 && dz < 0 ? Math.max(dx, dz) : Math.hypot(Math.max(dx, 0), Math.max(dz, 0));
}

/** Wie viel Luft hat ein Fleck? Alles, was ihn verbieten wuerde, in EINER Rechnung. */
function luftAm(x: number, z: number): { frei: number; grund: string } {
  let frei = Infinity;
  let grund = "";
  const merke = (ab: number, was: string): void => {
    if (ab < frei) {
      frei = ab;
      grund = was;
    }
  };
  for (const c of CONFIGS) merke(zuRechteck(x, z, c.x, c.z, c.size[0], c.size[1]), c.label);
  merke(
    zuRechteck(
      x,
      z,
      PRESS_CENTER.x,
      PRESS_CENTER.z,
      PRESS_INNER.laenge + 0.7,
      PRESS_INNER.tiefe + 0.7
    ),
    "Presskammer"
  );
  merke(Math.hypot(x - START_HAUFEN.x, z - START_HAUFEN.z) - START_HAUFEN.streuung, "Starthaufen");
  merke(Math.hypot(x - START_STREU.x, z - START_STREU.z) - START_STREU.radius, "Streuschrott");
  for (const a of START_AUTOS) merke(Math.hypot(x - a.x, z - a.z) - 2.5, "Altfahrzeug");
  merke(Math.hypot(x - ABKIPP_ZONE[0], z - ABKIPP_ZONE[1]) - 3.0, "Abkippstelle");
  merke(
    zuRechteck(x, z, ABLADE_SPUR_X, ABLADE_HALT_Z, 3.0, BED_LEN.kipper! + 3.0),
    "Abladespur"
  );
  return { frei: endlich(frei, `Luft bei ${x}|${z}`), grund };
}

describe("Besen: wo er liegt", () => {
  /** Der Umkreis der Rolle — im schlimmsten Fall steht sie verdreht. */
  const UMKREIS = Math.hypot(LAENGE / 2, TIEFE / 2);
  const d = abstandVomStand(BESEN_PLATZ.x, BESEN_PLATZ.z);

  it("liegt im Schwenkband des Baggers", () => {
    // eslint-disable-next-line no-console
    console.log(
      `Besenplatz (${BESEN_PLATZ.x} | ${BESEN_PLATZ.z}) — ${d.toFixed(2)} m vom Sitz ` +
        `(${BAGGER_STAND.x} | ${BAGGER_STAND.z}), Umkreis ${UMKREIS.toFixed(2)} m`
    );
    expect(d, "zu nah am Sitz").toBeGreaterThanOrEqual(SCHWENK_INNEN);
    expect(d, "ausser Reichweite").toBeLessThanOrEqual(SCHWENK_AUSSEN);
  });

  it("hat rundum Luft — Mulden, Halden, Presse, Haufen, Fahrspur", () => {
    const { frei, grund } = luftAm(BESEN_PLATZ.x, BESEN_PLATZ.z);
    // eslint-disable-next-line no-console
    console.log(`naechstes Hindernis: ${grund}, ${frei.toFixed(2)} m entfernt`);
    expect(frei, `zu nah an ${grund}`).toBeGreaterThan(UMKREIS + 0.5);
    expect(hitsObstacle(BESEN_PLATZ.x, BESEN_PLATZ.z, UMKREIS), "er steckt in einem Bauwerk").toBe(
      null
    );
  });

  it("liegt nicht dort, wo der Kipper abkippt — und der alte Fleck tat es", () => {
    const neu = Math.hypot(BESEN_PLATZ.x - ABKIPP_ZONE[0], BESEN_PLATZ.z - ABKIPP_ZONE[1]);
    const alt = Math.hypot(5.0 - ABKIPP_ZONE[0], -27.0 - ABKIPP_ZONE[1]);
    // eslint-disable-next-line no-console
    console.log(
      `Abkippstelle (${ABKIPP_ZONE[0]} | ${ABKIPP_ZONE[1]}): neuer Fleck ${neu.toFixed(2)} m, ` +
        `alter Fleck ${alt.toFixed(2)} m`
    );
    expect(neu, "er liegt wieder unter der Abkippstelle").toBeGreaterThan(4.0);
    expect(alt, "Aufbau: der alte Fleck lag nicht an der Abkippstelle").toBeLessThan(2.0);
  });

  it("liegt in einer Arbeitszone — sonst hupen die Fahrer davor", () => {
    expect(BESEN.massKg, "unter der Blockadegrenze — dann ist dieser Test unnoetig").toBeGreaterThan(
      BLOCKING_MASS_KG
    );
    const zone = WORK_ZONES.find(
      ([wx, wz, wr]) => Math.hypot(BESEN_PLATZ.x - wx, BESEN_PLATZ.z - wz) <= wr
    );
    // eslint-disable-next-line no-console
    console.log(
      `Arbeitszone: ${zone ? `(${zone[0]} | ${zone[1]}) r ${zone[2]}` : "KEINE"} bei ${BESEN.massKg} kg`
    );
    expect(zone, "die Rolle liegt ausserhalb jeder Arbeitszone").toBeDefined();
  });

  it("und es gibt ueberhaupt keinen besseren Fleck — die Suche als Waechter", () => {
    const frei: Array<{ x: number; z: number }> = [];
    let geprueft = 0;
    for (let x = -14; x <= 14; x += 0.25) {
      for (let z = -34; z <= -8; z += 0.25) {
        const ab = abstandVomStand(x, z);
        if (ab < SCHWENK_INNEN || ab > SCHWENK_AUSSEN) continue;
        geprueft++;
        if (hitsObstacle(x, z, UMKREIS)) continue;
        if (luftAm(x, z).frei > UMKREIS + 0.5) frei.push({ x, z });
      }
    }
    mindestens(geprueft, 500, "abgesuchte Punkte");
    const xs = frei.map((f) => f.x);
    const zs = frei.map((f) => f.z);
    // eslint-disable-next-line no-console
    console.log(
      `${frei.length} freie Punkte, alle zwischen x ${Math.min(...xs).toFixed(2)} und ` +
        `${Math.max(...xs).toFixed(2)}, z ${Math.min(...zs).toFixed(2)} und ${Math.max(...zs).toFixed(2)}`
    );
    expect(frei.length, "es gibt gar keinen freien Fleck mehr").toBeGreaterThan(20);
    expect(
      frei.some(
        (f) => Math.abs(f.x - BESEN_PLATZ.x) < 0.13 && Math.abs(f.z - BESEN_PLATZ.z) < 0.13
      ),
      "der Besenplatz kommt in der eigenen Suche nicht vor"
    ).toBe(true);
    expect(
      frei.some((f) => Math.abs(f.x - 5.0) < 0.13 && Math.abs(f.z + 27.0) < 0.13),
      "Aufbau: der alte Fleck muesste durchgefallen sein"
    ).toBe(false);
  });

  it("die Formtabelle beschreibt eine Rolle, keinen Ballen", () => {
    /*
     * `BESEN_FORM` ist die Tabelle, aus der die Form entsteht. Wer an ihr
     * dreht, soll hier merken, ob er die Geschichte noch erzaehlt: unten am
     * breitesten, oben ein flacher Kopf, Stirnscheiben statt Kuppen, und eine
     * Spirale, die die Rolle als Rolle erkennbar macht.
     */
    const g = (v: number): number =>
      Math.sqrt(Math.max(1 - v * v * (1 - BESEN_FORM.kopf * BESEN_FORM.kopf), 0));
    expect(g(0), "unten nicht die volle Tiefe").toBeCloseTo(1, 6);
    expect(g(0.2), "die Flanke faellt zu schnell ein").toBeGreaterThan(0.97);
    expect(g(1), "oben laeuft sie nicht auf den flachen Kopf zu").toBeCloseTo(BESEN_FORM.kopf, 6);
    expect(BESEN_FORM.kopf, "ohne Kopfflaeche waere es keine gequetschte Rolle").toBeGreaterThan(0.4);
    expect(BESEN_FORM.kopf, "so flach ist es keine Rolle mehr, sondern ein Kasten").toBeLessThan(0.8);
    expect(BESEN_FORM.endeEinzug, "Stirnscheiben, keine Kuppen").toBeLessThan(0.05);
    expect(BESEN_FORM.spiraleWindungen, "ohne Spirale sieht man keine Rolle").toBeGreaterThan(1.5);
    expect(BESEN_FORM.dellen.length, "ohne Dellen waere es sauber").toBeGreaterThanOrEqual(3);
  });
});
