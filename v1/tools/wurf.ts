/**
 * Pendelausschlag und Wurfweite in Zahlen (22.09.2026, E-115).
 *
 * Drei Fragen, eine Messung:
 *
 *   1. Wie weit schlaegt der Greifer aus — beim Antippen und im Dauerschwenk,
 *      mit leerem und mit vollem Korb? (Vorlage fuer `GELENK_STEIFE`.)
 *   2. Fliegt, was AUSSEN im Korb liegt, weiter als das, was innen liegt?
 *      Gemessen werden drei Teile gleichzeitig, radial versetzt.
 *   3. Bleibt alles unter der Umfangsgeschwindigkeit, die die Maschine
 *      ueberhaupt liefern kann — und bleibt reines Absetzen ein Absetzen?
 *
 * Die OBERGRENZE wird hier nicht gesetzt, sondern gerechnet:
 *     v_max = CAB_MAX · r_max  +  ROTATOR_SPEED · r_Korb  +  DRIVE_MAX
 * Alle drei Zahlen stehen im Bagger; `r_max` wird am Modell abgegriffen.
 *
 * Aufruf: npx vite-node tools/wurf.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator, CAB_MAX } from "../src/excavator/excavator";
import { GripSystem } from "../src/physics/gripSystem";
import { initPhysics } from "../src/physics/physicsWorld";
import { ItemManager } from "../src/world/scrapItems";

const DT = 1 / 60;
const GRAD = 180 / Math.PI;
/** ROTATOR_SPEED aus excavator.ts (120°/s) — dort nicht exportiert. */
const ROTATOR_SPEED = THREE.MathUtils.degToRad(120);
/** DRIVE_MAX aus excavator.ts (3,2 m/s) — dort nicht exportiert. */
const DRIVE_MAX = 3.2;

class Tasten {
  down = new Set<string>();
  wheelDelta = 0;
  orbitDX = 0;
  orbitDY = 0;
  shiftHeld = false;
  isDown(c: string): boolean {
    return this.down.has(c);
  }
  wasPressed(): boolean {
    return false;
  }
  mouseHeld(): boolean {
    return false;
  }
  axis(neg: string, pos: string): number {
    return (this.down.has(pos) ? 1 : 0) - (this.down.has(neg) ? 1 : 0);
  }
  endFrame(): void {}
}

interface Stand {
  world: RAPIER.World;
  bagger: Excavator;
  grip: GripSystem;
  tasten: Tasten;
}

function aufbau(): Stand {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(200, 0.5, 200), boden);
  const bagger = new Excavator(new THREE.Scene(), world);
  const grip = new GripSystem(world, bagger.grappleBody);
  return { world, bagger, grip, tasten: new Tasten() };
}

/** Was `main.ts` je Bild tut, damit der Bagger von seiner Ladung weiss. */
function takt(s: Stand): void {
  s.bagger.carriedMassKg = s.grip.totalMassKg;
  s.bagger.grippedHandles.clear();
  for (const b of s.grip.grippedBodies) s.bagger.grippedHandles.add(b.handle);
}

const korbP = new THREE.Vector3();
/** Mitte des Korbes in Weltkoordinaten. */
function korb(bagger: Excavator): THREE.Vector3 {
  return korbP
    .set(0, -bagger.greiferform.sensorSitz, 0)
    .applyQuaternion(bagger.grappleGroup.quaternion)
    .add(bagger.grappleGroup.position);
}

const achse = new THREE.Vector3();
/** Ausschlag der Greiferachse gegen die Lotrechte (Grad). */
function ausschlag(bagger: Excavator): number {
  achse.set(0, -1, 0).applyQuaternion(bagger.grappleGroup.quaternion);
  return Math.acos(THREE.MathUtils.clamp(-achse.y, -1, 1)) * GRAD;
}

/** Waagerechte Richtung Drehmitte → Gelenk (die Ausladungsrichtung). */
function radial(bagger: Excavator, out: THREE.Vector3): THREE.Vector3 {
  const g = bagger.grappleGroup.position;
  const r = bagger.root.position;
  return out.set(g.x - r.x, 0, g.z - r.z).normalize();
}

/** Waagerechter Abstand Drehmitte → Punkt. */
function ausladung(bagger: Excavator, p: { x: number; z: number }): number {
  const r = bagger.root.position;
  return Math.hypot(p.x - r.x, p.z - r.z);
}

function schritt(s: Stand, tasten: string[]): void {
  s.tasten.down.clear();
  for (const t of tasten) s.tasten.down.add(t);
  takt(s);
  s.bagger.update(DT, s.tasten as never);
  s.grip.update(1, true, korb(s.bagger), DT);
  s.world.step();
}

/** Teil radial versetzt in den Korb haengen. */
function haenge(s: Stand, massKg: number, versatzM: number): RAPIER.RigidBody {
  const p = korb(s.bagger).clone();
  const dir = radial(s.bagger, new THREE.Vector3());
  p.addScaledVector(dir, versatzM);
  const b = s.world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z)
  );
  s.world.createCollider(RAPIER.ColliderDesc.cuboid(0.12, 0.12, 0.6).setMass(massKg), b);
  s.grip.attachBody(b);
  return b;
}

function einschwingen(s: Stand): void {
  for (let i = 0; i < 240; i++) {
    s.bagger.update(DT, s.tasten as never);
    s.world.step();
  }
}

// ---------------------------------------------------------------- 1. Ausschlag

interface Schwung {
  hoechster: number;
  beharrung: number;
  ruheS: number;
}

/** `bilder` lang schwenken, dann 12 s ausschwingen lassen. */
function schwenken(bilder: number, lastKg: number): Schwung {
  const s = aufbau();
  einschwingen(s);
  if (lastKg > 0) for (const v of [-0.5, 0, 0.5]) haenge(s, lastKg / 3, v);
  let hoechster = 0;
  let summe = 0;
  let zaehl = 0;
  for (let i = 0; i < bilder; i++) {
    schritt(s, ["KeyQ"]);
    const a = ausschlag(s.bagger);
    if (a > hoechster) hoechster = a;
    if (i >= bilder - 60) {
      summe += a;
      zaehl++;
    }
  }
  let ruheBild = 0;
  for (let i = 0; i < 720; i++) {
    schritt(s, []);
    const a = ausschlag(s.bagger);
    if (a > hoechster) hoechster = a;
    if (a > 1) ruheBild = i;
  }
  return { hoechster, beharrung: summe / Math.max(1, zaehl), ruheS: (ruheBild + 1) * DT };
}

// ------------------------------------------------------------------- 2. Werfen

interface Flug {
  versatz: number;
  vAbwurf: number;
  weite: number;
}

/**
 * Drei Teile gleichzeitig, radial versetzt, nach `bilder` Schwenk loslassen.
 *
 * Alle drei haengen dieselbe Zeit am selben Greifer — der Unterschied in der
 * Weite kann also nur aus dem Hebelarm kommen.
 */
function werfen(bilder: number, massKg: number, versaetze: number[]): {
  fluege: Flug[];
  ausschlagAb: number;
  ausladungAb: number;
} {
  const s = aufbau();
  einschwingen(s);
  const teile = versaetze.map((v) => ({ v, b: haenge(s, massKg, v) }));
  for (let i = 0; i < bilder; i++) schritt(s, ["KeyQ"]);
  const ausschlagAb = ausschlag(s.bagger);
  const gp = s.bagger.grappleBody.translation();
  const ausladungAb = ausladung(s.bagger, gp);
  const start = teile.map((t) => {
    const p = t.b.translation();
    return new THREE.Vector3(p.x, p.y, p.z);
  });
  s.grip.releaseAll();
  const vAb = teile.map((t) => {
    const v = t.b.linvel();
    return Math.hypot(v.x, v.y, v.z);
  });
  // Flugbahn austragen — Spinne nicht mehr bedienen, sonst fasst sie nach
  for (let i = 0; i < 720; i++) {
    s.bagger.carriedMassKg = 0;
    s.bagger.grippedHandles.clear();
    s.bagger.update(DT, s.tasten as never);
    s.world.step();
  }
  const fluege = teile.map((t, i) => {
    const e = t.b.translation();
    return {
      versatz: t.v,
      vAbwurf: vAb[i]!,
      weite: Math.hypot(e.x - start[i]!.x, e.z - start[i]!.z),
    };
  });
  return { fluege, ausschlagAb, ausladungAb };
}

// -------------------------------------------------------- 3. Obergrenze, Ruhe

/** Groesste waagerechte Ausladung des Korbes, die der Arm erreicht. */
function maxAusladung(): { gelenk: number; korb: number } {
  const s = aufbau();
  einschwingen(s);
  let gelenk = 0;
  let korbMax = 0;
  // Ausleger heben, Stiel ausstrecken — jede Achse in beide Richtungen fahren
  // R/F = Ausleger, T/G = Stiel — alle vier Ecken des Arbeitsfeldes anfahren
  for (const paar of [["KeyR", "KeyT"], ["KeyF", "KeyT"], ["KeyF", "KeyG"], ["KeyR", "KeyG"]]) {
    for (let i = 0; i < 240; i++) {
      schritt(s, paar);
      gelenk = Math.max(gelenk, ausladung(s.bagger, s.bagger.grappleGroup.position));
      korbMax = Math.max(korbMax, ausladung(s.bagger, korb(s.bagger)));
    }
  }
  return { gelenk, korb: korbMax };
}

/** Absetzen ohne Schwenk: wie schnell ist das Teil im Moment des Loslassens? */
function absetzen(massKg: number): number {
  const s = aufbau();
  einschwingen(s);
  const b = haenge(s, massKg, 0.4);
  for (let i = 0; i < 120; i++) schritt(s, []);
  s.grip.releaseAll();
  const v = b.linvel();
  return Math.hypot(v.x, v.z);
}

// ---------------------------------------- 5. Seitwurf im Spieltakt (E-132)

interface Seitwurf {
  vAb: number;
  vNachTakt: number;
  weite: number;
  seitlich: number;
  vorn: number;
}

/**
 * Seitwurf so, wie das Spiel ihn rechnet — MIT `clampSpeeds`.
 *
 * Abschnitt 2 laesst `clampSpeeds` aus, `main.ts` ruft es aber nach jedem
 * Physikschritt (E-132: genau dort verlor ein geworfenes Teil seinen Schwung).
 * `seitlich` ist der Versatz QUER zur Armrichtung im Moment des Loslassens,
 * `vorn` der Anteil laengs des Arms.
 *
 * `bester`: Der Korb schwingt im Schwenk ueber die Bahn des Gelenks hinaus
 * und wieder zurueck. Gesucht wird das Bild, in dem das Teil am schnellsten
 * ist — 2,5 s Schwenk und 2 s nach dem Anhalten. Ein erster Durchgang sucht,
 * der zweite wirft dort (die Rechnung ist gleich, also auch das Bild).
 * Ohne `bester` wird nach 2,5 s gleichmaessigem Schwenk geworfen.
 */
function seitwurf(massKg: number, bester: boolean, mitClamp: boolean, abBild = -1): Seitwurf & { bestBild: number } {
  const s = aufbau();
  einschwingen(s);
  const items = new ItemManager(new THREE.Scene(), s.world);
  const b = haenge(s, massKg, 0);
  items.register({ materialId: "steel", massKg, mesh: new THREE.Object3D(), body: b });
  const bilder = !bester ? 150 : abBild >= 0 ? abBild : 270;
  let best = 0;
  let bestBild = 0;
  let prev = b.translation();
  for (let i = 0; i < bilder; i++) {
    schritt(s, i < 150 ? ["KeyQ"] : []);
    if (mitClamp) items.clampSpeeds(DT);
    const p = b.translation();
    const v = Math.hypot(p.x - prev.x, p.z - prev.z) / DT;
    prev = p;
    if (v > best) {
      best = v;
      bestBild = i + 1;
    }
  }
  const gp = s.bagger.grappleGroup.position;
  const rp = s.bagger.root.position;
  const rad = new THREE.Vector3(gp.x - rp.x, 0, gp.z - rp.z).normalize();
  const tan = new THREE.Vector3(-rad.z, 0, rad.x);
  const a = b.translation();
  const start = new THREE.Vector3(a.x, a.y, a.z);
  s.grip.releaseAll();
  const v0 = b.linvel();
  const vAb = Math.hypot(v0.x, v0.z);
  let vNachTakt = 0;
  for (let i = 0; i < 720; i++) {
    s.bagger.carriedMassKg = 0;
    s.bagger.grippedHandles.clear();
    s.bagger.update(DT, s.tasten as never);
    s.world.step();
    if (mitClamp) items.clampSpeeds(DT);
    if (i === 0) {
      const v = b.linvel();
      vNachTakt = Math.hypot(v.x, v.z);
    }
  }
  const e = b.translation();
  const d = new THREE.Vector3(e.x - start.x, 0, e.z - start.z);
  return {
    vAb,
    vNachTakt,
    weite: d.length(),
    seitlich: Math.abs(d.dot(tan)),
    vorn: d.dot(rad),
    bestBild,
  };
}

async function main(): Promise<void> {
  leinwandAttrappe();
  await initPhysics();

  console.log("=== 1. Ausschlag des Greifers (Grad gegen die Lotrechte) ===\n");
  console.log("  Schwenk        | Korb      | hoechster | Beharrung | Ruhe nach");
  console.log("  ---------------+-----------+-----------+-----------+----------");
  for (const [name, bilder] of [["antippen 1,0 s", 60], ["voll 5,0 s", 300]] as const) {
    for (const [korbName, last] of [["leer", 0], ["voll 1800 kg", 1800]] as const) {
      const r = schwenken(bilder, last);
      console.log(
        `  ${name.padEnd(14)} | ${korbName.padEnd(9)} | ` +
          `${r.hoechster.toFixed(1).padStart(6)}°   | ${r.beharrung.toFixed(1).padStart(6)}°   | ` +
          `${r.ruheS.toFixed(2).padStart(5)} s`
      );
    }
  }

  console.log("\n=== 2. Wurfweite je Teil (drei Teile gleichzeitig im Korb) ===\n");
  console.log(
    "  Schwenk     | Stueck  | Versatz | v Abwurf | Weite  | Ausschlag | Ausladung"
  );
  console.log(
    "  ------------+---------+---------+----------+--------+-----------+----------"
  );
  for (const [name, bilder] of [["halb 2,5 s", 150], ["voll 5,0 s", 300]] as const) {
    for (const [stueck, kg] of [["leicht", 80], ["schwer", 900]] as const) {
      const r = werfen(bilder, kg, [-0.5, 0, 0.5]);
      for (const f of r.fluege) {
        console.log(
          `  ${name.padEnd(11)} | ${stueck.padEnd(4)}${String(kg).padStart(3)} | ` +
            `${f.versatz.toFixed(2).padStart(6)}m | ${f.vAbwurf.toFixed(2).padStart(5)} m/s | ` +
            `${f.weite.toFixed(2).padStart(5)} m | ${r.ausschlagAb.toFixed(1).padStart(6)}°   | ` +
            `${r.ausladungAb.toFixed(2).padStart(6)} m`
        );
      }
    }
  }
  // halbvoller Korb: nur zwei Teile, damit der Vergleich zum vollen steht
  console.log("");
  const halb = werfen(300, 300, [-0.5, 0.5]);
  for (const f of halb.fluege) {
    console.log(
      `  ${"voll 5,0 s".padEnd(11)} | halbvoll| ${f.versatz.toFixed(2).padStart(6)}m | ` +
        `${f.vAbwurf.toFixed(2).padStart(5)} m/s | ${f.weite.toFixed(2).padStart(5)} m`
    );
  }

  console.log("\n=== 3. Obergrenze, gerechnet aus den Zahlen der Maschine ===\n");
  const a = maxAusladung();
  const vSchwenk = CAB_MAX * a.korb;
  const vRotator = ROTATOR_SPEED * 0.8; // Teil 0,8 m neben der Greiferachse
  const vMax = vSchwenk + vRotator + DRIVE_MAX;
  console.log(`  groesste Ausladung Gelenk  ${a.gelenk.toFixed(2)} m`);
  console.log(`  groesste Ausladung Korb    ${a.korb.toFixed(2)} m`);
  console.log(
    `  Oberwagen ${(CAB_MAX * GRAD).toFixed(0)}°/s · ${a.korb.toFixed(2)} m = ${vSchwenk.toFixed(2)} m/s`
  );
  console.log(
    `  Rotator ${(ROTATOR_SPEED * GRAD).toFixed(0)}°/s · 0,80 m      = ${vRotator.toFixed(2)} m/s`
  );
  console.log(`  Fahren                          = ${DRIVE_MAX.toFixed(2)} m/s`);
  console.log(`  ------------------------------------------------`);
  console.log(`  v_max                           = ${vMax.toFixed(2)} m/s`);

  console.log("\n=== 4. Reines Absetzen (kein Schwenk) ===\n");
  for (const kg of [80, 900]) {
    console.log(`  ${String(kg).padStart(4)} kg: ${absetzen(kg).toFixed(3)} m/s waagerecht`);
  }

  console.log("\n=== 5. Seitwurf im Spieltakt (ein Teil, Korbmitte; mit/ohne clampSpeeds) ===\n");
  console.log("  Wurf          | Stueck | Takt   | v Abwurf | v nach 1 Bild | Weite  | seitlich | laengs");
  console.log("  --------------+--------+--------+----------+---------------+--------+----------+-------");
  for (const [name, vor] of [["im Schwenk", false], ["bester Moment", true]] as const) {
    for (const kg of [80, 900]) {
      for (const clamp of [false, true]) {
        const such = seitwurf(kg, vor, clamp);
        const r = vor ? seitwurf(kg, vor, clamp, such.bestBild) : such;
        console.log(
          `  ${name.padEnd(13)} | ${String(kg).padStart(4)}kg | ${clamp ? "Spiel " : "Werkz."} | ` +
            `${r.vAb.toFixed(2).padStart(5)} m/s | ${r.vNachTakt.toFixed(2).padStart(9)} m/s | ` +
            `${r.weite.toFixed(2).padStart(5)} m | ${r.seitlich.toFixed(2).padStart(6)} m | ${r.vorn.toFixed(2).padStart(5)} m` +
            (vor ? `   (Bild ${r.bestBild}, Stopp bei 150)` : "")
        );
      }
    }
  }
}

void main();
