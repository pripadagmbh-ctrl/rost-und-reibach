import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { FIRMEN_GRUEN, werbeAtlas, atlasFeld } from "./werbung";
import type { Obstacle } from "./obstacles";

/**
 * FIRMEN-ABSETZMULDEN AM PLATZRAND (E-133, seit E-173 „Rost & Reibach",
 * seit E-184 hebbar).
 *
 * Patrick, 17.10.2026: „Baue auch container auf dem schrottplatz mit ein, aber
 * mit pripada drauf", dazu „ne, die mulden bleiben" und „nur paar container am
 * rand verteilen". Vier einzelne grüne Mulden, keine Reihe, kein Stapel; die
 * Sortiermulden, Lager, Halden und der MÜLL bleiben, wie sie sind.
 *
 * Geworfenes fällt hinein (offener Trog), Laster, Lambert und die Streife
 * fahren über die Hindernisliste drum herum.
 *
 * HEBBAR SEIT E-184. Patrick, 20.10.2026: „Absetzcontainer sollten hebbar
 * sein" — auf Nachfrage „alle Elemente, die nicht fest verankert sind wie
 * Gebäude und Mauern". Jede Mulde ist ein eigener beweglicher Körper wie der
 * MÜLL (`containers.ts`, rolloff): gedämpft, nur um die Hochachse drehbar, mit
 * der Leermasse einer echten Mulde. Die Spinne greift und hebt sie, solange
 * die Traglast reicht; was darin liegt, bleibt eigene Physik.
 */
export interface Firmenmulde {
  name: string;
  /** Mitte der Grundfläche */
  x: number;
  z: number;
  /** Länge oben, Breite über alles (mit Zapfen), Höhe (m) */
  laenge: number;
  breite: number;
  hoehe: number;
  /** Leermasse (kg) */
  leerKg: number;
  /** Welche Weltachse die Länge trägt */
  achse: "x" | "z";
}

/*
 * Maße: 5 m³ wie `objektkatalog` „Absetzmulde 5 m³" (E-123: 3,30 lang,
 * 1,75 breit, 1,35 hoch). 7 und 10 m³ als SW nach typischen Absetzmulden.
 */
/*
 * Leermasse (E-184, SW nach üblichen Herstellerangaben für Absetzmulden aus
 * 4-mm-Blech: 5 m³ rund 500–600 kg, 7 m³ 650–750, 10 m³ 850–950 kg).
 */
const M5 = { laenge: 3.3, breite: 1.75, hoehe: 1.35, leerKg: 550 };
const M7 = { laenge: 3.7, breite: 1.85, hoehe: 1.55, leerKg: 700 }; // SW
const M10 = { laenge: 4.0, breite: 1.95, hoehe: 1.75, leerKg: 900 }; // SW

/*
 * Orte: Vorgabe Bauleiter 17.10.2026, am Rand und außerhalb jedes
 * Schwenkbereichs; Abstand zur Mauerkante 0,22 … 0,38 m (Mauer 0,6 m dick auf
 * der Achse). Als Zahlen und nicht aus `yard.ts` gelesen: `yard.ts` lädt diese
 * Datei, und `obstacles.ts` liest die Liste beim Laden — so gibt es keinen
 * Ringschluss.
 */
export const FIRMENMULDEN: readonly Firmenmulde[] = [
  { name: "Nordmauer Ost", x: 5.5, z: 27.4, ...M10, achse: "x" },
  { name: "Nordmauer Mitte", x: -3.5, z: 27.6, ...M5, achse: "x" },
  { name: "Ostmauer", x: 9.0, z: 3.0, ...M7, achse: "z" },
  { name: "Südwest-Ecke", x: -37.0, z: -27.4, ...M7, achse: "x" },
];

/**
 * Volle Grundfläche je Mulde — so plant jeder Weg drum herum.
 *
 * Seit E-184 LEBENDE Einträge: `obstacles.ts` legt genau diese Objekte in
 * seine Liste, und `baueFirmenmulden` schreibt Lage und Umriss hinein, sobald
 * eine Mulde gezeichnet wird. Bis dahin (und in Vitest ohne Zeichnen) stehen
 * dort die Startplätze.
 */
const HINDERNISSE: Obstacle[] = FIRMENMULDEN.map((m) => {
  const inX = m.achse === "x";
  return {
    x: m.x,
    z: m.z,
    hw: (inX ? m.laenge : m.breite) / 2,
    hd: (inX ? m.breite : m.laenge) / 2,
    top: m.hoehe,
    label: `Firmenmulde ${m.name}`,
  };
});
export function firmenmuldenHindernisse(): Obstacle[] {
  return HINDERNISSE;
}

/* ------------------------------------------------------------ Bauart ----- */

/*
 * Farben: Grün aus `werbung.FIRMEN_GRUEN`; Stahl dunkel und Rost wie
 * `objektbau.ts` (STAHL_DUNKEL, ROST); Warnmarkierung rot #c8232c / weiß
 * (Vorgabe Bauleiter nach Patricks Vorlagebild).
 */
const STAHL_DUNKEL = 0x4a4642;
const ROST = 0x7a4a2c;
const WARN_ROT = 0xc8232c;
const WARN_WEISS = 0xf2f2ee; // SW: gebrochenes Weiß, reines Weiß blendet in der Sonne

/** Was `mulde()` je Mulde liefert, in ihren eigenen Achsen (Länge in z, Boden auf y 0). */
interface Bauplan {
  teile: Array<{ geo: THREE.BufferGeometry; farbe: number }>;
  aufkleber: THREE.BufferGeometry[];
  kollider: RAPIER.ColliderDesc[];
}

/**
 * Eine Absetzmulde nach dem Muster von `objektbau.mulde()` (dort abgeschaut,
 * nicht importiert — die Datei gehört einem anderen Bau): offener Trog, Boden
 * 68 % der oberen Länge, schräge Stirnwände, Kufen, dunkles Rahmenprofil oben,
 * Aufnahmezapfen. Neu nach Patricks Vorlagebild: die Sicken nur bei
 * ±0,33 · Bodenlänge (die Mitte bleibt fürs Logo), rot-weiße Warnfelder an
 * den schrägen Kanten jeder Stirnseite, Logo-Aufkleber auf beiden Längsseiten.
 */
function mulde(w: number, h: number, d: number, feld: ReturnType<typeof atlasFeld> | null): Bauplan {
  const teile: Bauplan["teile"] = [];
  // Beim Bau gelesen, nicht beim Laden: werbung.ts lädt über yard.ts diese Datei mit
  const LACK = new THREE.Color(FIRMEN_GRUEN).getHex();
  const q = (bw: number, bh: number, bd: number, farbe: number, x: number, y: number, z: number): void => {
    teile.push({ geo: new THREE.BoxGeometry(bw, bh, bd).translate(x, y + h / 2, z), farbe });
  };
  const t = 0.04; // Blech als Bauteil: dicker als 5 mm, sonst flimmert es (wie objektbau)
  const kufe = 0.08;
  const rand = 0.12; // Platz für Zapfen und Sicken außerhalb der Wand
  const lb = d * 0.68; // Bodenlänge: DIN-Absetzmulde 5 m³ ≈ 2,25 m unten zu 3,30 m oben (objektbau, SW)
  const oben = h / 2;
  const y0 = -h / 2 + kufe;
  const hw = oben - y0;
  const xw = w / 2 - rand;

  for (const sx of [-1, 1]) q(0.12, kufe, lb, STAHL_DUNKEL, sx * xw * 0.6, -h / 2 + kufe / 2, 0); // Kufen
  q(xw * 2, t, lb, LACK, 0, y0 + t / 2, 0); // Boden
  q(xw * 2 - 0.04, 0.01, lb * 0.95, ROST, 0, y0 + t + 0.005, 0); // Rost innen
  // Seitenwände: Trapez, unten so lang wie der Boden, oben volle Länge
  for (const sx of [-1, 1]) {
    const geo = new THREE.BoxGeometry(t, hw, 1);
    const p = geo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * (lb + (d - lb) * (p.getY(i) / hw + 0.5)));
    teile.push({ geo: geo.translate(sx * (xw - t / 2), y0 + hw / 2 + h / 2, 0), farbe: LACK });
  }
  // Stirnwände, schräg von der Bodenkante zur Oberkante — mit Warnfeldern an beiden Kanten
  const lang = Math.hypot((d - lb) / 2, hw);
  const neig = Math.atan2((d - lb) / 2, hw);
  const felder = Math.max(4, Math.round(lang / 0.25)); // SW: Felder um 25 cm
  for (const sz of [-1, 1]) {
    const lage = new THREE.Matrix4()
      .makeTranslation(0, y0 + hw / 2 + h / 2, sz * ((lb + d) / 4 - t / 2))
      .multiply(new THREE.Matrix4().makeRotationX(sz * neig));
    teile.push({ geo: new THREE.BoxGeometry(xw * 2, lang, t).applyMatrix4(lage), farbe: LACK });
    for (const sx of [-1, 1]) {
      for (let i = 0; i < felder; i++) {
        const geo = new THREE.BoxGeometry(0.14, (lang / felder) * 0.98, 0.01);
        geo.translate(sx * (xw - 0.07), -lang / 2 + ((i + 0.5) * lang) / felder, sz * (t / 2 + 0.005));
        teile.push({ geo: geo.applyMatrix4(lage), farbe: i % 2 === 0 ? WARN_ROT : WARN_WEISS });
      }
    }
  }
  // Rahmenprofil oben, Sicken, Zapfen
  const zapfenY = y0 + hw * 0.62;
  for (const sx of [-1, 1]) {
    q(0.08, 0.08, d - 0.04, STAHL_DUNKEL, sx * (xw - 0.04), oben - 0.04, 0);
    for (const zr of [-0.33, 0.33]) q(0.04, hw * 0.8, 0.08, LACK, sx * (xw + 0.02), y0 + hw * 0.45, zr * lb);
    const zapfen = new THREE.CylinderGeometry(0.07, 0.07, rand, 10).rotateZ(Math.PI / 2);
    teile.push({ geo: zapfen.translate(sx * (w / 2 - rand / 2), zapfenY + h / 2, 0), farbe: STAHL_DUNKEL });
  }

  /*
   * Aufkleber 2 : 1, waagrecht mittig zwischen den Sicken (5 cm Luft), oben
   * 5 cm unter dem Zapfen. Er liegt 5 mm vor der Wand: Weil er zwischen die
   * Sicken passt, schneidet keine hinein, und er steht nicht 4 cm frei vor
   * dem Blech wie vor der Sickenkante.
   */
  const aufkleber: THREE.BufferGeometry[] = [];
  if (feld) {
    const frei = 2 * (0.33 * lb - 0.04 - 0.05);
    const oberkante = zapfenY - 0.07 - 0.05;
    const hoch = Math.min(frei / 2, oberkante - (y0 + 0.08));
    for (const sx of [-1, 1]) {
      const geo = new THREE.PlaneGeometry(hoch * 2, hoch);
      const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, feld.u0 + uv.getX(i) * (feld.u1 - feld.u0), feld.v0 + uv.getY(i) * (feld.v1 - feld.v0));
      }
      // Ebene schaut nach +z; um ±90° gedreht nach außen — von außen nicht gespiegelt
      geo.rotateY((sx * Math.PI) / 2).translate(sx * (xw + 0.005), oberkante - hoch / 2 + h / 2, 0);
      aufkleber.push(geo);
    }
  }

  /*
   * Kollider: Boden, zwei Seitenwände (Trapez als konvexe Hülle), zwei schräge
   * Stirnwände. Bleche 12 cm statt 4 (Rapier-Lehre: Mindestdicke), nach
   * außen aufgedickt, damit der Innenraum so groß bleibt wie er aussieht.
   */
  const kollider: RAPIER.ColliderDesc[] = [];
  const quat = new THREE.Quaternion();
  kollider.push(RAPIER.ColliderDesc.cuboid(xw, 0.06, lb / 2).setTranslation(0, kufe + t - 0.06, 0));
  for (const sx of [-1, 1]) {
    const ecken: number[] = [];
    for (const x of [sx * (xw - t), sx * (xw - t + 0.12)]) {
      for (const [y, l] of [[kufe, lb], [h, d]] as const) {
        for (const zz of [-l / 2, l / 2]) ecken.push(x, y, zz);
      }
    }
    kollider.push(RAPIER.ColliderDesc.convexHull(new Float32Array(ecken))!);
  }
  for (const sz of [-1, 1]) {
    quat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), sz * neig);
    // Mitte 4 cm nach außen (Normale (0, −sin, sz·cos)): Innenfläche wie das Blech
    const nY = -Math.sin(neig) * 0.04;
    const nZ = sz * Math.cos(neig) * 0.04;
    kollider.push(
      RAPIER.ColliderDesc.cuboid(xw, lang / 2, 0.06)
        .setTranslation(0, y0 + hw / 2 + h / 2 + nY, sz * ((lb + d) / 4 - t / 2) + nZ)
        .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
    );
  }
  return { teile, aufkleber, kollider };
}


/**
 * Alle Firmenmulden bauen (E-184): je Mulde ein Netz für den Körper
 * (Vertexfarben, wirft Schatten) mit dem Aufkleber als Kind (Atlas, ohne
 * Schatten) und ein beweglicher Körper mit fünf Kollidern. Ohne Atlas
 * (Vitest ohne Leinwand) keine Aufkleber. Liefert die Körper (für Wächter und
 * Messungen).
 *
 * NACHFÜHREN OHNE EIGENE BILDSCHLEIFE: Die Szene ruft vor jedem Bild
 * `onBeforeRender` — noch vor dem Aussortieren außerhalb des Bildes. Dort
 * holen sich die Netze ihre Lage vom Körper und schreiben den Umriss in die
 * Hindernisliste. So braucht `main.ts` keinen neuen Aufruf, und eine Mulde,
 * die ins Bild getragen wird, steht dort auch.
 */
export function baueFirmenmulden(scene: THREE.Scene, world: RAPIER.World): RAPIER.RigidBody[] {
  const atlas = werbeAtlas();
  const feld = atlas ? atlasFeld("firmenGruen", 2) : null;
  const farbe = new THREE.Color();
  const yAchse = new THREE.Vector3(0, 1, 0);
  // Grün, Rost und Stahl wie der Abroller (`vehicleModel.ts`: 0,75 / 0,35)
  const koerperMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.35 });
  const logoMat = atlas ? new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.75, metalness: 0.35 }) : null;
  const bodies: RAPIER.RigidBody[] = [];
  const folgen: Array<() => void> = [];

  FIRMENMULDEN.forEach((m, nr) => {
    const plan = mulde(m.breite, m.hoehe, m.laenge, feld);
    // Bauplan hat die Länge in z; Längsachse x heißt eine Vierteldrehung
    const rot = m.achse === "x" ? Math.PI / 2 : 0;
    const dreh = new THREE.Quaternion().setFromAxisAngle(yAchse, rot);

    // Körper an der Startlage erzeugen (Rapier-Lehre v2 E-058), wie der MÜLL:
    // gedämpft, kippt nicht, rutscht nach einem Stoß nicht über den Platz
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(m.x, 0, m.z)
        .setRotation({ x: dreh.x, y: dreh.y, z: dreh.z, w: dreh.w })
        .setLinearDamping(6.0)
        .setAngularDamping(8.0)
        .enabledRotations(false, true, false)
    );
    // Masse: Boden 40 %, jede der vier Wände 15 % (SW — der Boden ist das stärkste Blech)
    plan.kollider.forEach((desc, i) => {
      world.createCollider(desc.setMass(m.leerKg * (i === 0 ? 0.4 : 0.15)).setFriction(1.4), body);
    });
    bodies.push(body);

    for (const { geo, farbe: hex } of plan.teile) {
      farbe.set(hex);
      const n = geo.getAttribute("position").count;
      const c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) farbe.toArray(c, i * 3);
      geo.setAttribute("color", new THREE.BufferAttribute(c, 3));
    }
    const koerperGeo = mergeGeometries(plan.teile.map((t) => t.geo), false);
    koerperGeo.computeVertexNormals();
    for (const t of plan.teile) t.geo.dispose();
    const netz = new THREE.Mesh(koerperGeo, koerperMat);
    netz.name = `Firmenmulde ${m.name}`;
    netz.castShadow = true;
    if (logoMat && plan.aufkleber.length > 0) {
      // Ein flacher Aufkleber wirft keinen eigenen Schatten — spart den Schattenruf
      const logo = new THREE.Mesh(mergeGeometries(plan.aufkleber, false), logoMat);
      logo.name = `Firmenmulde ${m.name} Aufkleber`;
      netz.add(logo);
    }

    const h = HINDERNISSE[nr]!;
    const inX = m.achse === "x";
    const folge = (): void => {
      if (!body.isValid()) return;
      const t = body.translation();
      const r = body.rotation();
      netz.position.set(t.x, t.y, t.z);
      netz.quaternion.set(r.x, r.y, r.z, r.w);
      netz.updateMatrixWorld(true);
      // Umriss: gedreht wächst er auf den Hüllkreis, wie beim MÜLL — eine
      // achsenparallele Liste kann keinen schiefen Kasten führen
      const gier = Math.atan2(2 * r.w * r.y, 1 - 2 * r.y * r.y) - rot;
      const s = Math.abs(Math.sin(gier));
      const laengsX = s < 0.15 ? inX : Math.abs(Math.cos(gier)) < 0.15 ? !inX : null;
      h.x = t.x;
      h.z = t.z;
      h.hw = laengsX === null ? m.laenge / 2 : (laengsX ? m.laenge : m.breite) / 2;
      h.hd = laengsX === null ? m.laenge / 2 : (laengsX ? m.breite : m.laenge) / 2;
      h.top = t.y + m.hoehe;
    };
    folgen.push(folge);
    folge();
    scene.add(netz);
  });
  const vorher = scene.onBeforeRender;
  scene.onBeforeRender = function (...a) {
    vorher.apply(this, a);
    for (const f of folgen) f();
  };
  return bodies;
}
