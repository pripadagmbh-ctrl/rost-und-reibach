/**
 * WAS PASSIERT, WENN DIE SPINNE AUF EIN WRACK DRUECKT? (E-124, 06.10.2026)
 *
 * Patrick, 06.10.2026: „Autos müssen hole elemente werden, die man zerdrücken
 * kann." Bevor gebaut wurde, wurde hiermit gemessen — und dasselbe Werkzeug
 * misst danach den Hohlkoerper.
 *
 * Echter Bagger, echtes Greifsystem, echtes Wrack (`CompositeManager`, Form C),
 * die Verdrahtung wie in `main.ts`: Biss ueber den Bus, `clawBlockedBy` ueber
 * den Schrottkatalog, das Wrack als Stoerer des Arms. Die Spinne wird
 * angehoben, das Wrack so daruntergestellt, dass die Ansatzstelle unter ihr
 * liegt (ein Vorlauf misst, wie weit sie beim Absenken auf ihrem Bogen
 * wandert), dann wird abgesenkt, bis sie steht, und dreimal zugedrueckt
 * (3 s, 2 s, 2 s, dazwischen losgelassen). Ein zweiter Lauf fasst zu und
 * hebt 1,5 s — damit ist nachgewiesen, dass das Wrack noch zu greifen ist.
 *
 * Abgelesen wird: wie tief die Spinne kommt, welche Kontakte Rapier zwischen
 * Schalen und Wrack meldet (an welchem Kollider, wo), was der Biss meldet
 * (Ort und Kraft), was am Wrack passiert (Stufe, Teile, Bleche, Beule), und
 * wie weit das Wrack dabei geschoben und gekippt wird.
 *
 * Aufrufe:
 *   npx vite-node tools/wrackdruck.ts                 drei Stellen ausfuehrlich
 *   (Umgebung) REIHE=1                                 sechs Stellen, je eine Zeile
 *   (Umgebung) VORHER=1                                dasselbe mit dem alten Quader
 *   (Umgebung) KNAUTSCH=0.5                            das Wrack vorher halb zusammendruecken (E-128)
 *   (Umgebung) ART=lkw | ART=wohnwagen                 dasselbe am LKW-Wrack bzw. Wohnwagen (E-135)
 * Unter PowerShell: `$env:REIHE=1; npx vite-node tools/wrackdruck.ts`
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { GripSystem } from "../src/physics/gripSystem";
import { initPhysics, PhysicsWorld } from "../src/physics/physicsWorld";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager, type CarComposite, type WrackArt } from "../src/dismantle/composites";
import { FORM_C } from "../src/dismantle/wrackformen";
import { EventBus } from "../src/core/events";

const DT = 1 / 60;
const GRAD = 180 / Math.PI;

/*
 * VORHER=1: die Fassung C ohne Hohlkoerper — genau der Stand vor E-124 (ein
 * Quader `colliderHalf`, der alte Biss). So laufen vorher und nachher in
 * derselben Welt mit denselben Handgriffen.
 */
if (process.env.VORHER === "1") delete (FORM_C as { bleche?: unknown }).bleche;

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
  phys: PhysicsWorld;
  world: RAPIER.World;
  bagger: Excavator;
  grip: GripSystem;
  items: ItemManager;
  composites: CompositeManager;
  bus: EventBus;
  tasten: Tasten;
}

function aufbau(): Stand {
  const phys = new PhysicsWorld();
  const world = phys.world;
  const scene = new THREE.Scene();
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  const bagger = new Excavator(scene, world);
  const grip = new GripSystem(world, bagger.grappleBody);
  const items = new ItemManager(scene, world);
  const bus = new EventBus();
  const composites = new CompositeManager(scene, world, items, bus);
  // Verdrahtung wie in main.ts
  bagger.onClawBite = (e) => bus.emit("greifer:zugedrueckt", e);
  grip.partResolver = (pos) => composites.findPartNear(pos);
  grip.insideGrapple = (p) => bagger.isInsideGrapple(p);
  grip.krallenKontakte = (b) => bagger.krallenKontakte(b);
  grip.onReleaseGrace = () => bagger.startClawGrace();
  bagger.clawBlockedBy = (body) => {
    const it = items.itemByBody(body);
    if (!it) return true;
    return !items.isCrushable(it);
  };
  return { phys, world, bagger, grip, items, composites, bus, tasten: new Tasten() };
}

const sensor = new THREE.Vector3();
function takt(s: Stand): void {
  s.bagger.update(DT, s.tasten as never);
  s.grip.update(s.bagger.closure, s.bagger.closing, s.bagger.getSensorPosition(sensor), DT);
  s.bagger.carriedCount = s.grip.grippedCount;
  s.bagger.carriedMassKg = s.grip.totalMassKg;
  s.bagger.grippedHandles.clear();
  for (const b of s.grip.grippedBodies) s.bagger.grippedHandles.add(b.handle);
  for (const car of s.composites.cars) {
    if (car.body.isValid()) s.bagger.obstacleBodies.add(car.body.handle);
  }
  s.phys.step();
  s.composites.update();
}

/** Innenleben fuer die Messung, nicht fuers Spiel. */
function innen(b: Excavator): { ist: number[]; art: number[] } {
  const x = b as unknown as { clawSplayIst: number[]; clawArt: number[] };
  return { ist: x.clawSplayIst, art: x.clawArt };
}
interface Beulbar {
  mesh: THREE.Mesh;
  base: Float32Array;
  beult?: boolean;
}
function beulen(car: CarComposite): Beulbar[] {
  return (car as unknown as { dentables: Beulbar[] }).dentables;
}

/** Tiefste Schalenspitze in Weltkoordinaten (y). */
function tiefsteSpitze(b: Excavator): number {
  const x = b as unknown as {
    form: { schalen: number; stationen: number; punkt: (a: number, s: number, st: number, out: THREE.Vector3) => THREE.Vector3 };
    clawSplayIst: number[];
  };
  b.grappleGroup.updateWorldMatrix(true, false);
  const v = new THREE.Vector3();
  let min = Infinity;
  for (let c = 0; c < x.form.schalen; c++) {
    x.form.punkt((c / x.form.schalen) * Math.PI * 2, x.clawSplayIst[c]!, x.form.stationen, v);
    b.grappleGroup.localToWorld(v);
    min = Math.min(min, v.y);
  }
  return min;
}

/** Alle Kontakte zwischen Wrack und Spinne, die Rapier gerade fuehrt (Wrack-lokal). */
function kontakte(s: Stand, car: CarComposite): { n: number; punkte: THREE.Vector3[]; kollider: Set<number> } {
  const g = s.bagger.grappleBody;
  const punkte: THREE.Vector3[] = [];
  const kollider = new Set<number>();
  const q = car.body.rotation();
  const p = car.body.translation();
  const inv = new THREE.Quaternion(q.x, q.y, q.z, q.w).invert();
  for (let i = 0; i < car.body.numColliders(); i++) {
    const ci = car.body.collider(i);
    for (let j = 0; j < g.numColliders(); j++) {
      s.world.contactPair(ci, g.collider(j), (mf) => {
        for (let k = 0; k < mf.numSolverContacts(); k++) {
          const w = mf.solverContactPoint(k)!;
          punkte.push(new THREE.Vector3(w.x - p.x, w.y - p.y, w.z - p.z).applyQuaternion(inv));
          kollider.add(i);
        }
      });
    }
  }
  return { n: punkte.length, punkte, kollider };
}

/** Groesste Verschiebung der Karosseriehaut: wie weit und wo (Wrack-lokal). */
function groessteBeule(car: CarComposite): { tief: number; ort: THREE.Vector3 } {
  let tief = 0;
  const ort = new THREE.Vector3();
  for (const d of beulen(car)) {
    if (d.beult === false) continue; // Scheiben zaehlen nicht
    const a = d.mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < a.count; i++) {
      const off = Math.hypot(a.getX(i) - d.base[i * 3]!, a.getY(i) - d.base[i * 3 + 1]!, a.getZ(i) - d.base[i * 3 + 2]!);
      if (off > tief) {
        tief = off;
        ort.set(a.getX(i), a.getY(i), a.getZ(i)).add(d.mesh.position);
      }
    }
  }
  return { tief, ort };
}

/** Wo liegt die Haut über diesem Punkt des Grundrisses (Wrack-lokal)? Strahl von oben auf die Karosserie. */
function hautBei(car: CarComposite, x: number, z: number): number {
  const d = beulen(car).find((b) => b.beult !== false)!;
  d.mesh.geometry.computeBoundingSphere();
  const strahl = new THREE.Raycaster(new THREE.Vector3(x, 5, z), new THREE.Vector3(0, -1, 0));
  const t = strahl.intersectObject(new THREE.Mesh(d.mesh.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })), false);
  return t.length ? t[0]!.point.y : NaN;
}

const f2 = (v: number): string => v.toFixed(2);
const vek = (v: { x: number; y: number; z: number }): string => `(${f2(v.x)}, ${f2(v.y)}, ${f2(v.z)})`;

interface Ansatz {
  name: string;
  x: number;
  z: number;
}
const DREI: Ansatz[] = [
  { name: "Dach", x: 0, z: -0.05 },
  { name: "Tuer (rechte Flanke)", x: 0.75, z: -0.05 },
  { name: "Haube (ueber dem Motor)", x: 0, z: 1.35 },
];
const ART = (process.env.ART ?? "pkw") as WrackArt;
/* E-135: die Stellen am LKW-Wrack und am Wohnwagen (Wrack-lokal, +z Schnauze). */
const REIHE_LKW: Ansatz[] = [
  { name: "Fahrerhausdach", x: 0, z: 1.85 },
  { name: "Tuer rechts", x: 1.17, z: 1.9 },
  { name: "Sattelkupplung", x: 0, z: -1.75 },
  { name: "Tank rechts", x: 1.0, z: -0.4 },
  { name: "Rad hinten rechts", x: 0.92, z: -2.0 },
];
const REIHE_WOHNWAGEN: Ansatz[] = [
  { name: "Dach", x: 0, z: 0.2 },
  { name: "Wand rechts", x: 0.97, z: 0.2 },
  { name: "Bug", x: 0, z: 1.6 },
  { name: "Heck", x: 0, z: -1.6 },
  { name: "Rad rechts", x: 0.8, z: -0.15 },
];
const REIHE_PKW: Ansatz[] = [
  { name: "Dach", x: 0, z: -0.05 },
  { name: "Tuer vorn rechts", x: 0.75, z: 0.35 },
  { name: "Tuer hinten rechts", x: 0.75, z: -0.6 },
  { name: "Haube", x: 0, z: 1.35 },
  { name: "Kofferraum", x: 0, z: -1.5 },
  { name: "Kotfluegel vorn rechts", x: 0.75, z: 1.35 },
];

interface Lauf {
  versatz: { x: number; z: number };
  zeilen: string[];
  /** fuer die Reihe */
  kurz: string;
}

/**
 * Ein Lauf an einer Stelle. `heben` = zufassen und heben statt dreimal beissen.
 * `korrektur` verschiebt das Wrack um den im Vorlauf gemessenen Bogen.
 */
function lauf(ansatz: Ansatz, korrektur: { x: number; z: number }, heben: boolean): Lauf {
  const s = aufbau();
  const zeilen: string[] = [];
  // 1. Spinne auf den Beton, dann anheben, damit ein Wrack darunter passt
  s.tasten.down.add("KeyF");
  s.tasten.down.add("KeyG");
  for (let i = 0; i < 260; i++) takt(s);
  s.tasten.down.clear();
  s.tasten.down.add("KeyR");
  for (let i = 0; i < 70; i++) takt(s);
  s.tasten.down.clear();
  for (let i = 0; i < 30; i++) takt(s);
  const gp = s.bagger.grappleGroup.position.clone();

  // 2. Wrack so hinstellen, dass die Ansatzstelle unter der Spinne liegt
  const car = s.composites.spawnCar(
    new THREE.Vector3(gp.x - ansatz.x - korrektur.x, 0.02, gp.z - ansatz.z - korrektur.z),
    ART
  );
  // KNAUTSCH=0.5: vorher so weit zusammendruecken (E-128) — greift die Spinne auch ein geknautschtes Wrack?
  if (process.env.KNAUTSCH) car.zusammendruecken(Number(process.env.KNAUTSCH));
  for (let i = 0; i < 120; i++) takt(s);
  const c0 = car.body.translation();
  const bisse: Array<{ kraftKN: number; x: number; y: number; z: number }> = [];
  s.bus.on("greifer:zugedrueckt", (e) => {
    if (e.handle === car.body.handle) bisse.push({ kraftKN: e.kraftKN, x: e.x, y: e.y, z: e.z });
  });
  const teile: string[] = [];
  s.bus.on("partTorn", (e) => teile.push(e.name));
  // E-185: Eine Haube, die nur aufspringt, ist nicht ab — sie steht trotzdem in der Zeile
  s.bus.on("wrack:abriss", (e) => e.art === "auf" && teile.push(`${e.name} auf`));

  // 3. Absenken, bis die Spinne steht
  s.tasten.down.add("KeyF");
  let gelenk = Infinity;
  let spitze = Infinity;
  for (let i = 0; i < 240; i++) {
    takt(s);
    gelenk = Math.min(gelenk, s.bagger.grappleGroup.position.y);
    spitze = Math.min(spitze, tiefsteSpitze(s.bagger));
  }
  const gNach = s.bagger.grappleGroup.position.clone();
  const versatz = { x: gNach.x - c0.x, z: gNach.z - c0.z };
  const k0 = kontakte(s, car);
  zeilen.push(`  Spinne ueber Wrack-lokal (${f2(versatz.x)}, ${f2(versatz.z)}) · ${car.kolliderZahl} Kollider am Wrack · Dach (Netz) 1,42 m`);
  zeilen.push(`  Absenken: Gelenk tiefstens ${f2(gelenk - c0.y)} m, Schalenspitze tiefstens ${f2(spitze - c0.y)} m ueber Wrackboden`);
  zeilen.push(
    `  Kontakte danach: ${k0.n} an Kollider ${[...k0.kollider].join(",") || "-"}` +
      (k0.n ? ` · z. B. ${k0.punkte.slice(0, 3).map(vek).join(" ")}` : "")
  );

  const v = innen(s.bagger);
  s.tasten.down.add("Space");
  let maxKippen = 0;
  const kippen = (): number => {
    const r = car.body.rotation();
    return 2 * Math.acos(Math.min(1, Math.abs(r.w))) * GRAD;
  };

  if (heben) {
    for (let i = 0; i < 90; i++) {
      takt(s);
      maxKippen = Math.max(maxKippen, kippen());
    }
    const gefasst = s.grip.grippedBodies.map((b) => (b.handle === car.body.handle ? "Wrack" : "Teil")).join("+") || "nichts";
    const y0 = car.body.translation().y;
    s.tasten.down.delete("KeyF");
    s.tasten.down.add("KeyR");
    for (let i = 0; i < 90; i++) takt(s);
    const gehoben = car.body.translation().y - y0;
    zeilen.push(`  HEBEN: gefasst ${gefasst}, Wrack nach 1,5 s um ${f2(gehoben)} m hoeher`);
    s.world.free();
    return { versatz, zeilen, kurz: `${gefasst} ${f2(gehoben)} m` };
  }

  let maxKraft = 0;
  let spitzeZu = Infinity;
  for (let i = 0; i < 180; i++) {
    takt(s);
    maxKraft = Math.max(maxKraft, s.bagger.schliesskraftKN);
    spitzeZu = Math.min(spitzeZu, tiefsteSpitze(s.bagger));
    maxKippen = Math.max(maxKippen, kippen());
  }
  const k1 = kontakte(s, car);
  zeilen.push(
    `  Zudruecken: Schalen ${v.ist.map((w) => (w * GRAD).toFixed(1)).join(" ")} ° · art ${v.art.join("")} · ` +
      `hoechste Kraft ${f2(maxKraft)} kN · gefasst ${s.grip.grippedCount}`
  );
  zeilen.push(
    `  Kontakte dabei: ${k1.n} an Kollider ${[...k1.kollider].join(",") || "-"}` +
      (k1.n ? ` · z. B. ${k1.punkte.slice(0, 3).map(vek).join(" ")}` : "")
  );
  const stufe1 = car.crushStage;
  const beule1 = groessteBeule(car);
  for (const runde of [1, 2]) {
    s.tasten.down.delete("Space");
    for (let i = 0; i < 40; i++) takt(s);
    s.tasten.down.add("Space");
    for (let i = 0; i < 120; i++) {
      takt(s);
      spitzeZu = Math.min(spitzeZu, tiefsteSpitze(s.bagger));
      maxKippen = Math.max(maxKippen, kippen());
    }
    void runde;
  }
  // Kommt die Spinne jetzt tiefer? Loslassen, kurz anheben, wieder absenken.
  s.tasten.down.clear();
  for (let i = 0; i < 40; i++) takt(s);
  s.tasten.down.add("KeyR");
  for (let i = 0; i < 20; i++) takt(s);
  s.tasten.down.clear();
  s.tasten.down.add("KeyF");
  let gelenk2 = Infinity;
  let spitze2 = Infinity;
  for (let i = 0; i < 150; i++) {
    takt(s);
    gelenk2 = Math.min(gelenk2, s.bagger.grappleGroup.position.y);
    spitze2 = Math.min(spitze2, tiefsteSpitze(s.bagger));
  }
  s.tasten.down.clear();
  const cJetzt = car.body.translation();
  const gNach2 = s.bagger.grappleGroup.position.clone();
  zeilen.push(
    `  danach erneut abgesenkt: Gelenk tiefstens ${f2(gelenk2 - cJetzt.y)} m ueber Wrackboden (beim ersten Mal ${f2(gelenk - c0.y)} m)`
  );
  const beule = groessteBeule(car);
  const c1 = car.body.translation();
  const schub = Math.hypot(c1.x - c0.x, c1.z - c0.z);
  zeilen.push(`  Schalenspitze beim Zudruecken tiefstens ${f2(spitzeZu - c0.y)} m ueber Wrackboden`);
  for (const b of bisse) {
    zeilen.push(`  Biss ${f2(b.kraftKN)} kN, gemeldet am Ort ${vek({ x: b.x - c0.x, y: b.y - c0.y, z: b.z - c0.z })} (Wrack-lokal)`);
  }
  zeilen.push(`  nach Biss 1: Stufe ${stufe1}, groesste Hautverschiebung ${f2(beule1.tief)} m bei ${vek(beule1.ort)}`);
  zeilen.push(`  am Ende: Stufe ${car.crushStage}, Teile heraus: ${teile.join(", ") || "-"}, Haut ${f2(beule.tief)} m bei ${vek(beule.ort)}`);
  // E-128: wie weit geknautscht, im Ganzen und unter der Spinne — und schwebt sie?
  const unter = new THREE.Vector3(gNach2.x - cJetzt.x, 0, gNach2.z - cJetzt.z).applyQuaternion(
    new THREE.Quaternion(car.body.rotation().x, car.body.rotation().y, car.body.rotation().z, car.body.rotation().w).invert()
  );
  const knautsch = `Grad ${f2(car.knautschgrad)}, unter der Spinne ${f2(car.knautschBei(unter.x, unter.z))}`;
  zeilen.push(`  Knautschen: ${knautsch}; Schalenspitze beim erneuten Absenken ${f2(spitze2 - cJetzt.y)} m, Haut darunter ${f2(hautBei(car, unter.x, unter.z))} m`);
  zeilen.push(`  Wrack geschoben ${f2(schub)} m, hoechstens gekippt ${f2(maxKippen)}°`);
  const kurz =
    `Stufe ${car.crushStage} · Teile ${teile.length ? teile.join("+") : "-"} · ` +
    (process.env.VORHER === "1" ? `Haut ${f2(beule.tief)} m bei ${vek(beule.ort)} · ` : `Knautschen ${knautsch} · `) +
    `Schub ${f2(schub)} m · Kippen ${maxKippen.toFixed(0)}°`;
  s.world.free();
  return { versatz, zeilen, kurz };
}

/** Vorlauf + Lauf: das Wrack so stellen, dass die Stelle wirklich unter der Spinne liegt. */
function anStelle(a: Ansatz, heben: boolean): Lauf {
  const vor = lauf(a, { x: 0, z: 0 }, false);
  return lauf(a, { x: a.x - vor.versatz.x, z: a.z - vor.versatz.z }, heben);
}

/**
 * WAS KOSTET EIN WRACK? (LAST=1) — fuenf Wracks nebeneinander, so viele wie
 * hoechstens auf dem Platz stehen. Erst fallen sie und setzen sich, dann
 * werden sie 600 Schritte lang in jedem Schritt geweckt (der schlimmste Fall:
 * alle wach, etwa wenn die Spinne in einer Reihe wuehlt), dann duerfen sie
 * einschlafen. Gemessen mit `performance.now()`, nicht mit `Date.now()` — bei
 * Zehntelmillisekunden zaehlt die Aufloesung.
 */
function last(): void {
  const s = aufbau();
  const N = 5;
  for (let i = 0; i < N; i++) s.composites.spawnCar(new THREE.Vector3(-6 + i * 2.6, 0.5, -20));
  const schritt = (wecken: boolean): { physik: number; wracks: number } => {
    if (wecken) for (const c of s.composites.cars) c.body.wakeUp();
    const a = performance.now();
    s.phys.step();
    const b = performance.now();
    s.composites.update();
    return { physik: b - a, wracks: performance.now() - b };
  };
  for (let i = 0; i < 120; i++) schritt(false); // setzen, Aufwaermen
  let physik = 0;
  let wracks = 0;
  const M = 600;
  for (let i = 0; i < M; i++) {
    const t = schritt(true);
    physik += t.physik;
    wracks += t.wracks;
  }
  let ruhe = -1;
  for (let i = 0; i < 600 && ruhe < 0; i++) {
    schritt(false);
    if (s.phys.counts().dynAwake === 0) ruhe = i;
  }
  const kollider = s.composites.cars.reduce((n, c) => n + c.kolliderZahl, 0);
  console.log(
    `${N} Wracks, ${kollider} Kollider (${kollider / N} je Wrack) · alle wach: Physik ${(physik / M).toFixed(3)} ms, ` +
      `Wrack-Update ${(wracks / M).toFixed(3)} ms je Schritt · danach schlafen alle ab Schritt ${ruhe}`
  );
  s.world.free();
}

async function main(): Promise<void> {
  leinwandAttrappe();
  await initPhysics();
  console.log(process.env.VORHER === "1" ? "VORHER: Fassung C als Quader" : "NACHHER: Fassung C als Hohlkoerper");
  if (process.env.LAST === "1") {
    for (let r = 0; r < 3; r++) last();
    return;
  }
  const REIHE = ART === "lkw" ? REIHE_LKW : ART === "wohnwagen" ? REIHE_WOHNWAGEN : REIHE_PKW;
  if (process.env.REIHE === "1" || (ART !== "pkw" && !process.env.STELLEN)) {
    for (const a of REIHE) {
      console.log(`${a.name.padEnd(24)} ${anStelle(a, false).kurz}`);
      console.log(`${"".padEnd(24)} Heben: ${anStelle(a, true).kurz}`);
    }
    return;
  }
  const wahl = process.env.STELLEN?.split(",");
  for (const a of wahl ? REIHE.filter((r) => wahl.includes(r.name)) : DREI) {
    console.log(`\n=== ${a.name}`);
    for (const z of anStelle(a, false).zeilen) console.log(z);
    console.log(anStelle(a, true).zeilen.at(-1));
  }
}

void main();
