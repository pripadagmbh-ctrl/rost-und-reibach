/**
 * PRUEFUNGSFAHRER IM BROWSER (Auftrag 41-Q, 22.10.2026) — die sechs
 * Pruefungen im echten Spiel durchfahren, mit denselben Test-Fahrern wie
 * `test/aufgabe1…6.test.ts` (Abschnitt „am echten Platz").
 *
 * Wird vom Rauchtest in die laufende Seite geladen
 * (`import("/tools/pruefungsfahrer.ts")`, nur Dev-Server). Statt der
 * kopflosen Werkbank steht hier das Spiel selbst: `window.__game` (Bagger,
 * Greifer, Physik, Bus) und die echte Tastatur-Eingabe (`input.down`). Ein
 * Takt ist `__game.step(1)` = `schrittInhalt` in main.ts; die Pruefungsuhr
 * laeuft wie im Test mit `lauf.takt(1/60)` je Schritt (Spielzeit, nicht die
 * Wanduhr des langsamen Headless-Browsers).
 *
 * Auf Touch haelt der Bagger die Spinne bei losgelassener Taste (Stick
 * neutral = Position halten, excavator.ts). Der Test-Fahrer kennt nur die
 * Tastatur (loslassen = oeffnen) — darum steht hier je Schritt ohne
 * Leertaste der rechte Stick auf „oeffnen" (`touch.axes.grapple = -1`), wie
 * ein Daumen, der nach links schiebt.
 *
 * Abweichungen vom Spieler, bewusst und gemeldet: Pratzen in Pruefung 6
 * ueber `toggleOutriggers()` (wie der Test; Taste O ist ein Einmal-Druck, den
 * nur die Bildschleife verbraucht). PRESSEN in Pruefung 2 tippt der
 * Rauchtest per Finger auf `#zz-pressen` (Phase 2 = `weiter()`).
 *
 * Nur fuer Messungen; nichts hier ist Spielcode.
 */
import * as THREE from "three";
import {
  DT,
  SCHWENK_R,
  SCHWENK_Y,
  bis,
  dreheAuf,
  fuehreUeber,
  greife,
  koerperZahl,
  legeAb,
  setzeAb,
  stelleArm,
  type Werkbank,
} from "../test/aufgabenwerkbank";
import { abwurf } from "../test/aufgabenplatz";
import { hoehenspanne } from "../src/challenges/quellen";
import { PRESS_CENTER, pressWaende } from "../src/world/press";
import { BAGGER_STAND, abstandVomStand } from "../src/world/baggerstand";
import { setBuildingObstacles } from "../src/world/obstacles";
import { umkugelRadius } from "../src/world/scrapItems";
import type { CarComposite } from "../src/dismantle/composites";
import type { ChallengeDaten, ChallengeLauf } from "../src/challenges/challenge";
import type { GameEvents } from "../src/core/events";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Spiel = any;
type Teil = { id: string; body: any; shape: any; containerId: string | null };

export interface Fahrt {
  id: string;
  geschafft: boolean;
  sterne: number | null;
  /** Pruefungsuhr beim Abschluss (s) */
  zeitS: number | null;
  messung: unknown;
  /** Schritte (1/60 s) dieses Fahrers */
  schritte: number;
  /** Laufzeit von `__game.step(1)` je Schritt (ms) */
  schrittMs: { mittel: number; p95: number; max: number };
  wandS: number;
  koerperStart: { wach: number; gesamt: number; dynamisch: number };
  koerperEnde: { wach: number; gesamt: number; dynamisch: number };
  /** schnellster beweglicher Koerper (m/s), alle 10 Schritte abgetastet */
  maxTempo: number;
  nan: boolean;
  schrittFolge: number[];
  notiz: string[];
  /** Pruefung 2: Phase 1 endet vor PRESSEN */
  wartetAufPressen?: boolean;
}

const g = (): Spiel => (window as any).__game;
const smoke = (): any => (window as any).__smoke;

interface Lage {
  k: Werkbank;
  lauf: ChallengeLauf;
  obj: { teile: Teil[]; wracks: CarComposite[] };
  daten: ChallengeDaten;
  jb: () => void;
  ende: GameEvents["challenge:geschafft"] | null;
  schrittFolge: number[];
  t0: number;
  maxTempo: number;
  nan: boolean;
  notiz: string[];
  koerperStart: { wach: number; gesamt: number; dynamisch: number };
}

let lage: Lage | null = null;

/** Die Werkbank aus dem laufenden Spiel. */
function bank(L: { maxTempo: number; nan: boolean }): Werkbank {
  const G = g();
  const down: Set<string> = G.input.down;
  const physMs: number[] = [];
  let n = 0;
  const k = {
    world: G.physics.world,
    bus: G.bus,
    items: G.items,
    composites: G.composites,
    containers: G.containers,
    press: G.press,
    b: G.excavator,
    grip: G.grip,
    fahrkunst: G.fahrkunst,
    tasten: { down },
    aufpralle: [],
    ueberlasten: [],
    abrisse: [],
    knautsch: [],
    physMs,
    takt(): void {
      // Touch: ohne Leertaste schiebt der Daumen den rechten Stick auf „oeffnen" (Kopf der Datei)
      if (G.excavator.touch) G.touch.axes.grapple = down.has("Space") ? 0 : -1;
      const t = performance.now();
      G.step(1);
      physMs.push(performance.now() - t);
      if (++n % 10 === 0) {
        const x = G.excavator;
        if (![x.position.x, x.position.z, x.cabinBaseYaw, x.boomAngle, x.stickAngle, x.closure].every(Number.isFinite)) L.nan = true;
        G.physics.world.forEachRigidBody((b: any) => {
          if (!b.isDynamic() || b.isSleeping()) return;
          const v = b.linvel();
          const s = Math.hypot(v.x, v.y, v.z);
          if (!Number.isFinite(s)) L.nan = true;
          else if (s > L.maxTempo) L.maxTempo = s;
        });
      }
    },
  };
  return k as unknown as Werkbank;
}

function beginne(id: string): Lage {
  const G = g();
  const lauf: ChallengeLauf = smoke().lauf;
  if (!lauf || (lauf as any).daten.id !== id) throw new Error(`kein laufender Lauf fuer ${id} (gesehen: ${(lauf as any)?.daten?.id})`);
  const L = { maxTempo: 0, nan: false } as Lage;
  L.k = bank(L);
  L.lauf = lauf;
  L.obj = (lauf as any).objekte;
  L.daten = (lauf as any).daten;
  L.jb = () => lauf.takt(DT);
  L.ende = null;
  L.schrittFolge = [];
  L.notiz = [];
  L.t0 = performance.now();
  // Der Bus kennt kein Abmelden: Die Hoerer schreiben in diese Lage, die nach der Fahrt verworfen wird
  G.bus.on("challenge:geschafft", (e: GameEvents["challenge:geschafft"]) => (L.ende = e));
  G.bus.on("challenge:schritt", (e: GameEvents["challenge:schritt"]) => L.schrittFolge.push(e.nr));
  L.koerperStart = koerperZahl(G.physics.world);
  G.autoStep(false);
  return L;
}

function bericht(L: Lage, wartet = false): Fahrt {
  const G = g();
  const ms = [...L.k.physMs].sort((a, b) => a - b);
  const r = (x: number): number => +x.toFixed(2);
  const e = L.ende;
  L.k.tasten.down.clear();
  if (G.excavator.touch) G.touch.axes.grapple = 0;
  if (!wartet) G.autoStep(true);
  return {
    id: L.daten.id,
    geschafft: !!e,
    sterne: e?.sterne ?? null,
    zeitS: e ? r(e.messung.zeitS) : null,
    messung: e?.messung ?? null,
    schritte: ms.length,
    schrittMs: { mittel: r(ms.reduce((a, b) => a + b, 0) / Math.max(1, ms.length)), p95: r(ms[Math.floor(ms.length * 0.95)] ?? 0), max: r(ms[ms.length - 1] ?? 0) },
    wandS: r((performance.now() - L.t0) / 1000),
    koerperStart: L.koerperStart,
    koerperEnde: koerperZahl(G.physics.world),
    maxTempo: r(L.maxTempo),
    nan: L.nan,
    schrittFolge: L.schrittFolge,
    notiz: L.notiz,
    wartetAufPressen: wartet || undefined,
  };
}

/* ---------- Pruefung 1 (test/aufgabe1.test.ts, „sechs Schritte mit dem echten Bagger") */
function p1(L: Lage): void {
  const { k, jb } = L;
  const nr = (): number => L.schrittFolge.at(-1) ?? 1;
  const t = L.obj.teile[0]!.body.translation();
  dreheAuf(k, Math.atan2(t.x - BAGGER_STAND.x, t.z - BAGGER_STAND.z), jb);
  bis(k, () => false, 60, jb);
  k.tasten.down.add("KeyF");
  bis(k, () => nr() >= 3, 600, jb);
  bis(k, () => false, 40, jb);
  k.tasten.down.clear();
  k.tasten.down.add("Space");
  bis(k, () => nr() >= 4, 300, jb);
  k.tasten.down.add("KeyR");
  bis(k, () => nr() >= 5, 600, jb);
  bis(k, () => false, 20, jb);
  k.tasten.down.delete("KeyR");
  const box = k.containers.ortVon("r_bunt")!;
  dreheAuf(k, Math.atan2(box.x - BAGGER_STAND.x, box.z - BAGGER_STAND.z), jb, ["Space"]);
  bis(k, () => false, 60, jb);
  k.tasten.down.clear();
  bis(k, () => L.ende !== null, 600, jb);
}

/* ---------- Pruefung 2 (test/aufgabe2.test.ts `durchlauf("absetzen", "voll")`), Phase 1 bis vor PRESSEN */
function p2(L: Lage): void {
  const { k, jb } = L;
  const car = L.obj.wracks[0]!;
  const spanne = (): { unten: number; oben: number } => hoehenspanne(car.body)!;
  const krone = Math.max(...pressWaende().map((w) => w.top));
  const p0 = car.body.translation();
  dreheAuf(k, Math.atan2(p0.x - BAGGER_STAND.x, p0.z - BAGGER_STAND.z), jb);
  bis(k, () => false, 60, jb);
  bis(k, () => k.b.armBlocked, 1200, () => {
    k.tasten.down.clear();
    k.tasten.down.add("KeyF");
    jb();
  });
  k.tasten.down.clear();
  k.tasten.down.add("KeyF");
  bis(k, () => false, 20, jb);
  k.tasten.down.clear();
  k.tasten.down.add("Space");
  bis(k, () => false, 90, jb);
  L.notiz.push(`gefasst ${k.grip.grippedBodies.some((b) => b.handle === car.body.handle)}`);
  k.tasten.down.add("KeyR");
  bis(k, () => spanne().unten >= 3.0, 300, jb);
  k.tasten.down.delete("KeyR");
  dreheAuf(k, Math.atan2(PRESS_CENTER.x - BAGGER_STAND.x, PRESS_CENTER.z - BAGGER_STAND.z), jb, ["Space"]);
  let versatz = fuehreUeber(k, () => car.body.translation(), PRESS_CENTER, () => spanne().unten, krone + 0.3, jb);
  for (let i = 0; i < 3; i++) {
    k.tasten.down.clear();
    k.tasten.down.add("Space");
    bis(k, () => false, 240, jb);
    const p = car.body.translation();
    versatz = Math.hypot(p.x - PRESS_CENTER.x, p.z - PRESS_CENTER.z);
    if (versatz < 0.15) break;
    fuehreUeber(k, () => car.body.translation(), PRESS_CENTER, () => spanne().unten, krone + 0.3, jb);
  }
  const ueber = k.b.grappleGroup.position.y - spanne().unten;
  stelleArm(k, k.b.ausladungM, ueber + 0.8, jb, ["Space"], () => spanne().unten <= 0.8);
  setzeAb(k, () => spanne().unten, jb);
  L.notiz.push(`Versatz ueber der Kammer ${versatz.toFixed(2)} m, losgelassen ${spanne().unten.toFixed(2)} m`);
  k.tasten.down.clear();
  bis(k, () => false, 240, jb);
  L.notiz.push(`pressenBereit ${L.lauf.pressenBereit}`);
}

/**
 * `abwurf` (test/aufgabenplatz.ts) prueft gegen `hitsObstacle` — im Spiel steht dort auch die bewegliche
 * MUELL-Mulde selbst (main.ts `setBuildingObstacles(containers.hindernisse())`), in der Werkbank nicht.
 * Fuer ihr eigenes Innere zaehlt sie nicht: kurz ohne bewegliche Behaelter rechnen, dann zurueck.
 */
function abwurfImSpiel(ziel: string): { x: number; z: number; r: number } | null {
  const a = abwurf(ziel, 1.0);
  if (a) return a;
  setBuildingObstacles([]);
  try {
    return abwurf(ziel, 1.0);
  } finally {
    setBuildingObstacles(g().containers.hindernisse());
  }
}

/* ---------- Pruefung 3 (test/aufgabe3.test.ts) — Ziel je Teil aus dem Lauf (`wegZiel`) */
function p3(L: Lage): void {
  const { k, jb } = L;
  const wegZiel: Map<string, string> = (L.lauf as any).wegZiel;
  for (const t of L.obj.teile) {
    const ziel = wegZiel.get(t.id);
    const a = ziel ? abwurfImSpiel(ziel) : null;
    if (!a) {
      L.notiz.push(`${t.shape?.name}: kein Abwurf fuer ${ziel}`);
      continue;
    }
    const u = umkugelRadius(t.shape);
    const gefasst = greife(k, t.body, jb);
    if (gefasst) legeAb(k, () => t.body.translation(), () => t.body.translation().y - u, a, 2.6, jb);
    L.notiz.push(`${t.shape?.name}: ${gefasst ? "gefasst" : "NICHT gefasst"} → ${t.containerId ?? "-"} (Soll ${ziel})`);
  }
  bis(k, () => L.ende !== null, 120, jb);
}

/* ---------- Pruefung 4 (test/aufgabe4.test.ts `durchlauf` (c) gemischt) */
function stelle(car: CarComposite, versatz: number): { x: number; z: number } {
  const p = car.body.translation();
  const r = car.body.rotation();
  const ax = new THREE.Vector3(0, 0, 1).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w));
  return { x: p.x + ax.x * versatz, z: p.z + ax.z * versatz };
}
function hinUeber(k: Werkbank, car: CarComposite, versatz: number, jb: () => void): void {
  const z = stelle(car, versatz);
  const m = k.b.position;
  k.tasten.down.clear();
  stelleArm(k, Math.hypot(z.x - m.x, z.z - m.z), 4.8, jb);
  dreheAuf(k, Math.atan2(z.x - m.x, z.z - m.z), jb);
}
function p4(L: Lage): void {
  const { k, jb } = L;
  const car = L.obj.wracks[0]!;
  let schlaege = 0;
  g().bus.on("spinne:aufschlag", (e: GameEvents["spinne:aufschlag"]) => {
    if (e.untergrund === "wrack") schlaege++;
  });
  const STELLEN = [0, 1.3, -1.3];
  const SCHLAEGE_JE_ANFAHRT = 2; // wie test/aufgabe4.test.ts
  for (let n = 0; n < 16 && !L.ende; n++) {
    const v = STELLEN[n % 3]!;
    if (n % 2 === 0) {
      hinUeber(k, car, v, jb);
      for (let i = 0; i < SCHLAEGE_JE_ANFAHRT; i++) {
        k.tasten.down.clear();
        k.tasten.down.add("KeyR");
        bis(k, () => false, 30, jb);
        k.tasten.down.clear();
        k.tasten.down.add("KeyF");
        const vorher = schlaege;
        bis(k, () => schlaege > vorher || k.b.armBlocked, 120, jb);
        k.tasten.down.clear();
        bis(k, () => false, 10, jb);
      }
      k.tasten.down.clear();
    } else {
      hinUeber(k, car, v, jb);
      bis(k, () => k.b.armBlocked, 960, () => {
        k.tasten.down.clear();
        k.tasten.down.add("KeyF");
        jb();
      });
      k.tasten.down.add("KeyF");
      k.tasten.down.add("Space");
      bis(k, () => false, 90, jb);
      k.tasten.down.clear();
      bis(k, () => false, 30, jb);
    }
    L.notiz.push(`${n % 2 === 0 ? "schlag" : "biss"} ${car.knautschgrad.toFixed(2)}@${L.lauf.zeitS.toFixed(0)}s`);
  }
}

/* ---------- Pruefung 5 (test/aufgabe5.test.ts) */
function p5(L: Lage): void {
  const { k, jb } = L;
  const TEILE = L.daten.aufbau.teile!;
  const sollVon = (i: number): string => TEILE[i]!.ziel ?? L.daten.zielBehaelter!;
  const teile = L.obj.teile;
  for (let n = 0; n < 12 && !L.ende; n++) {
    const offen = teile.filter((t, i) => !TEILE[i]!.bleibtLiegen && t.containerId !== sollVon(i));
    if (offen.length === 0) break;
    const p = offen[0]!.body.translation();
    const m = k.b.position;
    const r = Math.hypot(p.x - m.x, p.z - m.z);
    k.tasten.down.clear();
    stelleArm(k, SCHWENK_R, SCHWENK_Y, jb);
    dreheAuf(k, Math.atan2(p.x - m.x, p.z - m.z), jb);
    stelleArm(k, r, 3.2, jb);
    k.tasten.down.add("Space");
    k.tasten.down.add("KeyF");
    bis(k, () => k.b.armBlocked, 300, jb);
    bis(k, () => false, 30, jb);
    k.tasten.down.delete("KeyF");
    k.tasten.down.add("KeyR");
    bis(k, () => false, 90, jb);
    k.tasten.down.delete("KeyR");
    const zahl = k.grip.grippedCount;
    const soll = new Set(teile.flatMap((t, i) => (k.grip.grippedBodies.some((b) => b.handle === t.body.handle) ? [sollVon(i)] : [])));
    const halde = soll.size === 1 ? abwurfImSpiel([...soll][0]!) : null;
    if (zahl > 0 && !halde) {
      k.tasten.down.clear();
      bis(k, () => false, 90, jb);
    }
    if (zahl > 0 && halde) {
      const tief = (): number => Math.min(...k.grip.grippedBodies.map((b) => b.translation().y)) - 0.4;
      k.tasten.down.add("KeyR");
      bis(k, () => tief() >= 2.6, 300, jb);
      k.tasten.down.delete("KeyR");
      stelleArm(k, SCHWENK_R, SCHWENK_Y, jb, ["Space"]);
      dreheAuf(k, Math.atan2(halde.x - BAGGER_STAND.x, halde.z - BAGGER_STAND.z), jb, ["Space"]);
      fuehreUeber(k, () => k.b.grappleGroup.position, halde, tief, 2.6, jb, ["Space"], 0.4);
      k.tasten.down.clear(); // Magnet aus
      bis(k, () => false, 150, jb);
    }
    L.notiz.push(`${n + 1}: ${zahl} gehaftet → ${[...soll].join("+") || "-"}`);
  }
  bis(k, () => L.ende !== null, 120, jb);
}

/* ---------- Pruefung 6 (test/aufgabe6.test.ts, „ohne Pratzen … Pratzen aus, in den Kreis") */
function p6(L: Lage): void {
  const { k, jb } = L;
  const car = L.obj.wracks[0]!;
  const ziel = L.daten.ablageziel!;
  const sp = (): { unten: number; oben: number } => hoehenspanne(car.body)!;
  const wrackR = (): number => abstandVomStand(car.body.translation().x, car.body.translation().z);
  const p = car.body.translation();
  const m = k.b.position;
  stelleArm(k, SCHWENK_R, SCHWENK_Y, jb);
  dreheAuf(k, Math.atan2(p.x - m.x, p.z - m.z), jb);
  stelleArm(k, wrackR(), 3.0, jb);
  stelleArm(k, wrackR(), 0.8, jb, [], () => k.b.armBlocked);
  k.tasten.down.clear();
  k.tasten.down.add("KeyF");
  bis(k, () => false, 20, jb);
  k.tasten.down.clear();
  k.tasten.down.add("Space");
  bis(k, () => false, 90, jb);
  L.notiz.push(`gefasst ${k.grip.grippedBodies.some((b) => b.handle === car.body.handle)} bei ${k.b.ausladungM.toFixed(2)} m`);
  k.tasten.down.add("KeyR");
  bis(k, () => sp().unten > 0.6, 300, jb);
  k.tasten.down.delete("KeyR");
  bis(k, () => false, 30, jb);
  // hinaus ohne Pratzen → Ueberlast + Tipp
  const b = k.b as any;
  const lageT = (): string =>
    `${k.b.ausladungM.toFixed(2)} m, Last ${Math.round(b.carriedMassKg)} kg, Grenze ${Math.round(b.traglastKg)} kg, abgestuetzt ${b.abgestuetzt}, armBlocked ${b.armBlocked}, Stiel ${((b.stickAngle * 180) / Math.PI).toFixed(1)}°`;
  L.notiz.push(`vor T: ${lageT()}`);
  let grenzeMin = Infinity;
  k.tasten.down.add("KeyT");
  bis(k, () => false, 90, () => {
    jb();
    grenzeMin = Math.min(grenzeMin, b.traglastKg);
  });
  L.notiz.push(`nach T: ${lageT()}, kleinste Grenze waehrend T ${Math.round(grenzeMin)} kg`);
  k.tasten.down.delete("KeyT");
  bis(k, () => false, 30, jb);
  L.notiz.push(`Ueberlasten nach Hinausfahren ${L.lauf.messung().ueberlasten}`);
  k.b.toggleOutriggers(); // Abweichung: wie der Test, nicht ueber Taste O / Kranz (Kopf der Datei)
  bis(k, () => k.b.abgestuetzt, 300, jb);
  bis(k, () => false, 30, jb);
  const zielR = abstandVomStand(ziel.x, ziel.z);
  let gR = zielR + 0.25;
  for (let i = 0; i < 3; i++) {
    stelleArm(k, gR, Math.max(k.b.grappleGroup.position.y, 4.8), jb, ["Space"]);
    k.tasten.down.clear();
    k.tasten.down.add("Space");
    bis(k, () => false, 240, jb);
    if (Math.abs(zielR - wrackR()) < 0.25) break;
    gR += zielR - wrackR();
  }
  stelleArm(k, k.b.ausladungM, 2.0, jb, ["Space"], () => sp().unten <= 0.05);
  bis(k, () => false, 30, jb);
  k.tasten.down.clear();
  bis(k, () => L.ende !== null, 300, jb);
}

const FAHRER: Record<string, (L: Lage) => void> = {
  "erster-griff": p1,
  verladen: p2,
  sortieren: p3,
  "platt-machen": p4,
  magnet: p5,
  "schwere-last": p6,
};

/** Pruefung `id` durchfahren (Pruefung 2: bis vor PRESSEN, dann `weiter()`). */
export function fahre(id: string): Fahrt {
  const f = FAHRER[id];
  if (!f) throw new Error(`kein Fahrer fuer ${id}`);
  lage = beginne(id);
  try {
    f(lage);
  } catch (e) {
    lage.notiz.push(`Abbruch: ${String(e)}`);
  }
  if (id === "verladen" && !lage.ende) return bericht(lage, true);
  const b = bericht(lage);
  lage = null;
  return b;
}

/** Pruefung 2, Phase 2: nach dem Tipp auf PRESSEN bis geschafft (wie der Test: 900 Schritte). */
export function weiter(): Fahrt {
  if (!lage) throw new Error("keine Fahrt offen");
  const L = lage;
  L.notiz.push(`Presse laeuft ${g().press.running}`);
  bis(L.k, () => L.ende !== null, 900, L.jb);
  const b = bericht(L);
  lage = null;
  return b;
}
