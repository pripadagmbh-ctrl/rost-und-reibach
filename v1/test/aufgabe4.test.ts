/**
 * AUFGABE 4 „PLATT MACHEN" (G3, 20.10.2026; G5: Haemmern UND Zudruecken).
 *
 * Geprueft wird:
 *  1. die Lage: Wohnwagen vorn, Aufbau und Deichsel frei (0,3 m Rand zu
 *     MUELL-Mulde, Besenplatz, Mauern, Presse), im Schwenkband, im Bild;
 *  2. der Ablauf mit Attrappen: Balken = Knautschgrad, drei Schritte
 *     („Hau drauf", „Beiß zu", „Mach ihn platt"), Schlag und Biss je am
 *     Ereignis erkannt, fertig erst ab `plattAb` UND beidem, gelbe Marke bis
 *     dahin, Sterne;
 *  3. die MESSUNG am echten Bagger (G5, E-187 eingebaut): Zeit bis 80 %
 *     (a) nur beissen, (b) nur hauen, (c) gemischt — und dass Haemmern
 *     knautscht (Stolperdraht umgedreht: Wer es wieder abstellt, muss die
 *     Aufgabe aendern, sie lehrt Haemmern).
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { CHALLENGES } from "../src/challenges/katalog";
import { ChallengeLauf, sterne, type ChallengeQuellen } from "../src/challenges/challenge";
import { aufbauKonflikte } from "../src/challenges/aufbau";
import { WOHNWAGEN_DEF } from "../src/dismantle/carDef";
import { BAGGER_STAND, SCHWENK_AUSSEN, SCHWENK_INNEN, abstandVomStand } from "../src/world/baggerstand";
import { EventBus, type GameEvents } from "../src/core/events";
import type { CarComposite } from "../src/dismantle/composites";
import { grundrissBelegt } from "./aufgabenplatz";
import { DT, GRAD, bis, dreheAuf, koerperZahl, platzLeinwand, starteAufgabe, stelleArm, werkbank, type Werkbank } from "./aufgabenwerkbank";

const A4 = CHALLENGES.find((c) => c.id === "platt-machen")!;
const WW = A4.aufbau.wracks![0]!;
const [HALB_B, , HALB_L] = WOHNWAGEN_DEF.colliderHalf;
/** Deichsel bis zum Kupplungskopf: lokal z 2,10 … 3,40 m (`FORM_WOHNWAGEN`, Anbau „Deichsel": Anker 2,75, Laenge 1,3) */
const DEICHSEL = { mitte: 2.75, halb: 0.65 };

beforeAll(async () => {
  platzLeinwand();
  await RAPIER.init();
});

describe("Aufgabe 4: wo der Wohnwagen steht", () => {
  it("Wohnwagen, vierte Aufgabe, Balken ab 80 %", () => {
    expect(CHALLENGES[3]!.id).toBe("platt-machen");
    expect(WW.art).toBe("wohnwagen");
    expect(A4.plattAb).toBe(0.8);
    expect(aufbauKonflikte(A4)).toEqual([]);
  });

  it("vorn im Bild, im Schwenkband, Aufbau und Deichsel frei (0,3 m Rand; der Besenplatz ist in Aufgaben leer)", () => {
    const g = WW.gier ?? 0;
    const w = Math.atan2(WW.x - BAGGER_STAND.x, WW.z - BAGGER_STAND.z) * GRAD;
    const kamZ = BAGGER_STAND.z - 11 * Math.cos(0.42);
    expect(Math.abs(w)).toBeGreaterThan(6);
    expect(Math.abs(w)).toBeLessThan(30);
    expect(Math.abs(Math.atan2(WW.x - BAGGER_STAND.x, WW.z - kamZ) * GRAD)).toBeLessThan(20);
    const r = abstandVomStand(WW.x, WW.z);
    expect(r).toBeGreaterThanOrEqual(SCHWENK_INNEN);
    expect(r).toBeLessThanOrEqual(SCHWENK_AUSSEN);
    expect(grundrissBelegt(WW.x, WW.z, g, HALB_B + 0.1, HALB_L + 0.1, { rand: 0.3, ohneBesen: true }), "Aufbau").toBe("");
    const dx = WW.x + DEICHSEL.mitte * Math.sin(g);
    const dz = WW.z + DEICHSEL.mitte * Math.cos(g);
    expect(grundrissBelegt(dx, dz, g, 0.2, DEICHSEL.halb, { rand: 0.3, ohneBesen: true }), "Deichsel").toBe("");
    // Deichsel zum Bagger
    expect(abstandVomStand(dx, dz)).toBeLessThan(r);
  });

  it("nicht unter der Spinne der Startpose (G5): waagrecht ≥ 1,7 m vom Startort der Spinne bis zum Aufbau", () => {
    // Startpose: geradeaus, Ausladung 8,09 m (gemessen G5); offene Schalen ±1,29 m (Kollider-Mitten) + Blech + 0,3 m Luft
    const sp = { x: BAGGER_STAND.x, z: BAGGER_STAND.z + 8.09 };
    const g = WW.gier ?? 0;
    const c = Math.cos(g);
    const s = Math.sin(g);
    const lx = (sp.x - WW.x) * c - (sp.z - WW.z) * s;
    const lz = (sp.x - WW.x) * s + (sp.z - WW.z) * c;
    expect(Math.hypot(Math.max(0, Math.abs(lx) - HALB_B), Math.max(0, Math.abs(lz) - HALB_L))).toBeGreaterThanOrEqual(1.7);
  });
});

describe("Aufgabe 4: der Ablauf mit Attrappen", () => {
  const koerper = { handle: 9, translation: () => ({ x: WW.x, y: 0, z: WW.z }), isValid: () => true };
  const q: ChallengeQuellen = {
    gegriffen: () => [],
    spinne: () => ({ x: 0, y: 5, z: 0 }),
    drehmitte: () => BAGGER_STAND,
    blickRad: () => 0,
    behaelter: () => null,
    ueberBehaelter: () => false,
    behaelterVon: () => null,
    ueberKammer: () => false,
    inKammer: () => false,
    hoehenspanne: () => ({ unten: 0, oben: 2.4 }),
  };
  function lauf() {
    const bus = new EventBus();
    const staende: Array<GameEvents["challenge:stand"]> = [];
    const schritte: number[] = [];
    const ende: Array<GameEvents["challenge:geschafft"]> = [];
    bus.on("challenge:stand", (e) => staende.push(e));
    bus.on("challenge:schritt", (e) => schritte.push(e.nr));
    bus.on("challenge:geschafft", (e) => ende.push(e));
    const l = new ChallengeLauf(A4, 4, q, bus, { teile: [], wracks: [{ body: koerper }] });
    l.start();
    let grad = 0;
    const knautsch = (zuwachs: number, handle = 9): void => {
      if (handle === 9) grad += zuwachs;
      bus.emit("wrack:geknautscht", { handle, grad: handle === 9 ? grad : 0.9, zuwachs, x: 0, y: 0, z: 0 });
    };
    /** wie main.ts `onSpinneAufschlag`: erst der Aufschlag, dann knautscht es */
    const schlag = (zuwachs: number, untergrund: GameEvents["spinne:aufschlag"]["untergrund"] = "wrack"): void => {
      bus.emit("spinne:aufschlag", { wucht: 1, untergrund, x: 0, y: 0, z: 0 });
      if (zuwachs > 0) knautsch(zuwachs);
    };
    /** wie main.ts: Die Wracks hoeren den Biss zuerst (sie knautschen sofort), danach der Lauf */
    const biss = (zuwachs: number, handle = 9): void => {
      if (zuwachs > 0) knautsch(zuwachs, handle);
      bus.emit("greifer:zugedrueckt", { handle, kraftKN: 80, x: 0, y: 0, z: 0 });
    };
    return { l, staende, schritte, ende, schlag, biss, knautsch };
  }

  it("Hau drauf → Beiß zu → platt: Schlag und Biss am Ereignis erkannt, Balken = Knautschgrad, fertig ab 0,8", () => {
    const a = lauf();
    a.l.takt(1);
    expect(a.staende.at(-1)).toMatchObject({ balken01: 0, zaehler: null, tipp: null });
    expect(a.staende.at(-1)!.marken).toEqual([{ x: WW.x, y: 2.4, z: WW.z, art: "teil" }]);
    a.biss(0.9, 99); // fremdes Wrack
    a.schlag(0); // Schlag aufs Wrack ohne Knautschen
    a.l.takt(1);
    a.schlag(0, "beton"); // Schlag daneben …
    a.biss(0.2); // … und im selben Bild ein Biss: der zaehlt, der Schlag nicht
    a.l.takt(1);
    expect(a.schritte, "nichts davon ist ein Schlag aufs Wrack").toEqual([1]);
    a.schlag(0.13);
    a.l.takt(1);
    expect(a.schritte, "Biss schon gesehen: Beiß zu faellt mit").toEqual([1, 3]);
    expect(a.staende.at(-1)!.balken01).toBeCloseTo(0.33, 5);
    a.schlag(0.18);
    a.biss(0.26);
    a.l.takt(1);
    expect(a.ende, "bei 0,77 schon fertig").toEqual([]);
    expect(a.staende.at(-1)!.marken.length, "gelbe Marke bis platt").toBe(1);
    a.schlag(0.13);
    a.l.takt(1);
    expect(a.ende.length).toBe(1);
    expect(a.ende[0]!.sterne).toBe(3);
  });

  it("in Reihenfolge: Hau drauf (1) → Beiß zu (2) → Mach ihn platt (3)", () => {
    const a = lauf();
    a.l.takt(1);
    a.schlag(0.13);
    a.l.takt(1);
    expect(a.schritte).toEqual([1, 2]);
    a.biss(0.26);
    a.l.takt(1);
    expect(a.schritte).toEqual([1, 2, 3]);
  });

  it("nur beissen macht den Balken voll, aber nicht fertig: Die Karte bleibt bei „Hau drauf“, ein Schlag beendet", () => {
    const a = lauf();
    a.l.takt(1);
    for (let i = 0; i < 4; i++) {
      a.biss(0.26);
      a.l.takt(1);
    }
    expect(a.staende.at(-1)!.balken01).toBe(1);
    expect(a.schritte, "Hau drauf wird nicht uebersprungen").toEqual([1]);
    expect(a.ende).toEqual([]);
    expect(a.staende.at(-1)!.marken.length, "gelbe Marke steht noch").toBe(1);
    a.schlag(0.05);
    a.l.takt(1);
    expect(a.ende.length, "der Biss ist schon gesehen — Schritt 2 und 3 fallen mit").toBe(1);
  });

  it("nur hauen: nach dem ersten Schlag „Beiß zu“, dabei bleibt es bis zum ersten Biss — der zaehlt auch ohne Zuwachs, wenn er schon platt ist", () => {
    const a = lauf();
    a.l.takt(1);
    for (let i = 0; i < 7; i++) {
      a.schlag(0.13);
      a.l.takt(1);
    }
    expect(a.staende.at(-1)!.balken01).toBeGreaterThan(0.8);
    expect(a.schritte).toEqual([1, 2]);
    expect(a.ende).toEqual([]);
    a.biss(0); // schon platt: kein Zuwachs mehr, der Biss zaehlt trotzdem
    a.l.takt(1);
    expect(a.ende.length).toBe(1);
  });

  it("Anschlagen meldet erst das Knautschen, dann den Aufschlag (main.ts `onAnschlag`) — zaehlt trotzdem als Schlag", () => {
    const a = lauf();
    a.knautsch(0.1);
    a.schlag(0);
    a.l.takt(1);
    expect(a.schritte).toEqual([1, 2]);
  });

  it("Sterne nach der Zeit: ★★ und ★★★ an ihren Schwellen", () => {
    const M = { fehlwuerfe: 0, harteAufschlaege: 3, praezisionCm: null, ueberlasten: 0, fremdteile: 0 };
    const drei = A4.wertung.drei.zeitS!;
    const zwei = A4.wertung.zwei.zeitS!;
    expect(sterne(A4.wertung, { ...M, zeitS: drei })).toBe(3);
    expect(sterne(A4.wertung, { ...M, zeitS: drei + 1 })).toBe(2);
    expect(sterne(A4.wertung, { ...M, zeitS: zwei })).toBe(2);
    expect(sterne(A4.wertung, { ...M, zeitS: zwei + 1 })).toBe(1);
  });
});

/** Die Stelle `versatz` m entlang der Laengsachse des Wracks — wo sie gerade liegt */
function stelle(car: CarComposite, versatz: number): { x: number; z: number } {
  const p = car.body.translation();
  const r = car.body.rotation();
  const ax = new THREE.Vector3(0, 0, 1).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w));
  return { x: p.x + ax.x * versatz, z: p.z + ax.z * versatz };
}

/** Ueber die Stelle fahren, wie ein Fahrer: Spinne auf 4,8 m Hoehe, hindrehen. */
function hinUeber(k: Werkbank, car: CarComposite, versatz: number, jb: () => void): void {
  const z = stelle(car, versatz);
  const m = k.b.position;
  k.tasten.down.clear();
  stelleArm(k, Math.hypot(z.x - m.x, z.z - m.z), 4.8, jb);
  dreheAuf(k, Math.atan2(z.x - m.x, z.z - m.z), jb);
}

/**
 * Ein Biss: hin, senken bis aufgesetzt, 1,5 s zu, 0,5 s auf. `sanft`: nur
 * jedes vierte Bild gesenkt — so setzt die Spinne unter der Schlag-Schwelle
 * (0,8 m/s, `excavator/aufschlag.ts`) auf, es ist ein reiner Biss. Voll
 * gesenkt ist das Aufsetzen selbst schon ein Schlag (gemessen G5).
 */
function beisse(k: Werkbank, car: CarComposite, versatz: number, jb: () => void, sanft = false): void {
  hinUeber(k, car, versatz, jb);
  let i = 0;
  bis(k, () => k.b.armBlocked, 960, () => {
    k.tasten.down.clear();
    if (!sanft || ++i % 4 === 0) k.tasten.down.add("KeyF");
    jb();
  });
  k.tasten.down.add("KeyF");
  // zudruecken: 0,4 s Schliessen + 0,7 s Druck bis zum Biss (`Excavator.DRUCK_S`), etwas Luft
  k.tasten.down.add("Space");
  bis(k, () => false, 90, jb);
  k.tasten.down.clear();
  bis(k, () => false, 30, jb);
}

/**
 * Schlaege, wie die Karte sie lehrt („Hau drauf": Spinne hoch, dann
 * {boom-}): hin, dann je Schlag 0,5 s heben (R), Hauptarm voll senken (F),
 * bis die Spinne aufschlaegt (`gezaehlt` steigt) oder aufsitzt, kurz liegen.
 * Nur der Hauptarm: Mit dem Ausleger dazu (F+G wie `tools/haemmern-kern.ts`)
 * zieht die Spinne zum Bagger und trifft die Deichsel oder den Boden davor
 * (gemessen G5).
 */
function haue(k: Werkbank, car: CarComposite, versatz: number, schlaege: number, jb: () => void, gezaehlt: () => number): void {
  hinUeber(k, car, versatz, jb);
  for (let i = 0; i < schlaege; i++) {
    k.tasten.down.clear();
    k.tasten.down.add("KeyR");
    bis(k, () => false, 30, jb);
    k.tasten.down.clear();
    k.tasten.down.add("KeyF");
    const vorher = gezaehlt();
    bis(k, () => gezaehlt() > vorher || k.b.armBlocked, 120, jb);
    k.tasten.down.clear();
    bis(k, () => false, 10, jb);
  }
  k.tasten.down.clear();
}

type Zug = "biss" | "sanft" | "schlag";
interface Messlauf {
  zeitBis80: number | null;
  zeitFertig: number | null;
  sterne: number | null;
  schritte: number[];
  bisse: number;
  schlaege: number;
  verlauf: string;
}

/** Schlaege je Anfahrt beim Hauen — ein Fahrer haut mehrmals auf dieselbe Stelle, bevor er umsetzt. // SW: 2 */
const SCHLAEGE_JE_ANFAHRT = 2;

/**
 * Ein ganzer Durchlauf am echten Platz: `plan(n)` sagt je Zug, was der Fahrer
 * tut, bis 80 % erreicht sind; danach `danach` (der fehlende Weg), bis die
 * Aufgabe fertig ist.
 */
function durchlauf(plan: (n: number) => Zug, danach: Zug | null, maxZuege = 16): Messlauf {
  const k = werkbank();
  const { lauf, obj } = starteAufgabe(k, A4);
  const car = obj.wracks[0]!;
  const jb = (): void => lauf.takt(DT);
  let ende: GameEvents["challenge:geschafft"] | null = null;
  const schritte: number[] = [1];
  k.bus.on("challenge:geschafft", (e) => (ende = e));
  k.bus.on("challenge:schritt", (e) => schritte.push(e.nr));
  let bisse = 0;
  let schlaege = 0;
  k.bus.on("greifer:zugedrueckt", (e) => {
    if (e.handle === car.body.handle) bisse++;
  });
  k.bus.on("spinne:aufschlag", (e) => {
    if (e.untergrund === "wrack") schlaege++;
  });
  const verlauf: string[] = [];
  let zeitBis80: number | null = null;
  const STELLEN = [0, 1.3, -1.3];
  for (let n = 0; n < maxZuege && !ende; n++) {
    const zug = zeitBis80 === null ? plan(n) : danach;
    if (!zug) break;
    if (zug === "schlag") haue(k, car, STELLEN[n % 3]!, SCHLAEGE_JE_ANFAHRT, jb, () => schlaege);
    else beisse(k, car, STELLEN[n % 3]!, jb, zug === "sanft");
    verlauf.push(`${zug} ${car.knautschgrad.toFixed(2)}@${lauf.zeitS.toFixed(0)}s`);
    if (zeitBis80 === null && car.knautschgrad >= A4.plattAb!) zeitBis80 = lauf.zeitS;
  }
  const e = ende as GameEvents["challenge:geschafft"] | null;
  return {
    zeitBis80,
    zeitFertig: e?.messung.zeitS ?? null,
    sterne: e?.sterne ?? null,
    schritte,
    bisse,
    schlaege,
    verlauf: `${verlauf.join(" · ")} | Koerper ${JSON.stringify(koerperZahl(k.world))}, abgerissen ${k.abrisse.length}`,
  };
}

function zeige(name: string, m: Messlauf): void {
  // eslint-disable-next-line no-console
  console.log(
    `A4 ${name}: 80 % nach ${m.zeitBis80?.toFixed(1)} s, fertig nach ${m.zeitFertig?.toFixed(1)} s (${m.sterne} Sterne), ` +
      `${m.bisse} Bisse, ${m.schlaege} Schlaege aufs Wrack, Schritte ${m.schritte.join(",")}\n  ${m.verlauf}`
  );
}

describe("Aufgabe 4: am echten Platz mit dem echten Bagger (Messung G5)", () => {
  it("die Spinne der Startpose steckt nicht im Wohnwagen: 1 s heben bewegt ihn nicht", () => {
    const k = werkbank();
    const { lauf, obj } = starteAufgabe(k, A4);
    const car = obj.wracks[0]!;
    const y0 = car.body.translation().y;
    k.tasten.down.add("KeyR");
    bis(k, () => false, 60, () => lauf.takt(DT));
    expect(car.body.translation().y - y0).toBeLessThan(0.02);
    expect(k.b.armBlocked).toBe(false);
  }, 120_000);

  it("(a) nur beissen: 80 % nach hoechstens fuenf Bissen, Karte bleibt bei „Hau drauf“, ein Schlag danach beendet", () => {
    const m = durchlauf(() => "sanft", "schlag");
    zeige("(a) nur beissen", m);
    expect(m.zeitBis80, "nicht platt geworden").not.toBeNull();
    expect(m.bisse).toBeLessThanOrEqual(5);
    expect(m.schritte, "Hau drauf nicht uebersprungen").toEqual([1]);
    expect(m.zeitFertig, "der Schlag danach beendet nicht").not.toBeNull();
  }, 300_000);

  it("(b) nur hauen: Haemmern knautscht (Stolperdraht umgedreht), Karte springt auf „Beiß zu“, ein Biss danach beendet", () => {
    const m = durchlauf(() => "schlag", "biss");
    zeige("(b) nur hauen", m);
    expect(m.zeitBis80, "Haemmern knautscht nicht (mehr) — die Aufgabe lehrt es aber (G5, E-187)").not.toBeNull();
    expect(m.schritte).toEqual([1, 2]);
    expect(m.zeitFertig, "der Biss danach beendet nicht").not.toBeNull();
  }, 300_000);

  it("(c) gemischt (hauen, beissen, …): Schritte 1-2-3, fertig in der ★★★-Zeit", () => {
    const m = durchlauf((n) => (n % 2 === 0 ? "schlag" : "biss"), null);
    zeige("(c) gemischt", m);
    expect(m.zeitFertig, "nicht fertig").not.toBeNull();
    expect(m.schritte).toEqual([1, 2, 3]);
    expect(m.zeitFertig!).toBeLessThanOrEqual(A4.wertung.drei.zeitS!);
  }, 300_000);
});
