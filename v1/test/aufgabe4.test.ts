/**
 * AUFGABE 4 „PLATT MACHEN" (G3, 20.10.2026).
 *
 * Geprueft wird:
 *  1. die Lage: Wohnwagen vorn, Aufbau und Deichsel frei (0,3 m Rand zu
 *     MUELL-Mulde, Besenplatz, Mauern, Presse), im Schwenkband, im Bild;
 *  2. der Ablauf mit Attrappen: Balken = Knautschgrad, zwei Schritte, fertig
 *     ab `plattAb`, gelbe Marke bis dahin, Sterne;
 *  3. die MESSUNG am echten Bagger (Auftrag G3): Zudruecken knautscht +0,26
 *     je Biss, 0,8 nach vier Bissen; Haemmern mit der leeren Spinne knautscht
 *     gar nicht — Stolperdraht: Wer Haemmern wirksam macht, muss den
 *     Schritttext der Aufgabe aendern (er lehrt heute Zudruecken).
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { CHALLENGES } from "../src/challenges/katalog";
import { ANGEKNAUTSCHT_AB, ChallengeLauf, sterne, type ChallengeQuellen } from "../src/challenges/challenge";
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

  it("vorn im Bild, im Schwenkband, Aufbau und Deichsel frei (0,3 m Rand, mit Besenplatz)", () => {
    const g = WW.gier ?? 0;
    const w = Math.atan2(WW.x - BAGGER_STAND.x, WW.z - BAGGER_STAND.z) * GRAD;
    const kamZ = BAGGER_STAND.z - 11 * Math.cos(0.42);
    expect(Math.abs(w)).toBeGreaterThan(6);
    expect(Math.abs(w)).toBeLessThan(30);
    expect(Math.abs(Math.atan2(WW.x - BAGGER_STAND.x, WW.z - kamZ) * GRAD)).toBeLessThan(20);
    const r = abstandVomStand(WW.x, WW.z);
    expect(r).toBeGreaterThanOrEqual(SCHWENK_INNEN);
    expect(r).toBeLessThanOrEqual(SCHWENK_AUSSEN);
    expect(grundrissBelegt(WW.x, WW.z, g, HALB_B + 0.1, HALB_L + 0.1, { rand: 0.3 }), "Aufbau").toBe("");
    const dx = WW.x + DEICHSEL.mitte * Math.sin(g);
    const dz = WW.z + DEICHSEL.mitte * Math.cos(g);
    expect(grundrissBelegt(dx, dz, g, 0.2, DEICHSEL.halb, { rand: 0.3 }), "Deichsel").toBe("");
    // Deichsel zum Bagger
    expect(abstandVomStand(dx, dz)).toBeLessThan(r);
  });
});

describe("Aufgabe 4: der Ablauf mit Attrappen", () => {
  it("Balken = Knautschgrad; Schritt 1 beim ersten Biss, fertig ab 0,8; gelbe Marke bis dahin", () => {
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
    const bus = new EventBus();
    const staende: Array<GameEvents["challenge:stand"]> = [];
    const schritte: number[] = [];
    let ende: GameEvents["challenge:geschafft"] | null = null;
    bus.on("challenge:stand", (e) => staende.push(e));
    bus.on("challenge:schritt", (e) => schritte.push(e.nr));
    bus.on("challenge:geschafft", (e) => (ende = e));
    const l = new ChallengeLauf(A4, 4, q, bus, { teile: [], wracks: [{ body: koerper }] });
    l.start();
    l.takt(1);
    expect(staende.at(-1)).toMatchObject({ balken01: 0, zaehler: null, tipp: null });
    expect(staende.at(-1)!.marken).toEqual([{ x: WW.x, y: 2.4, z: WW.z, art: "teil" }]);
    const knautsch = (grad: number, handle = 9): void => bus.emit("wrack:geknautscht", { handle, grad, zuwachs: 0.26, x: 0, y: 0, z: 0 });
    knautsch(0.9, 99); // fremdes Wrack
    knautsch(ANGEKNAUTSCHT_AB / 2);
    l.takt(1);
    expect(schritte).toEqual([1]);
    knautsch(0.26);
    l.takt(1);
    expect(schritte).toEqual([1, 2]);
    expect(staende.at(-1)!.balken01).toBeCloseTo(0.26, 5);
    knautsch(0.77);
    l.takt(1);
    expect(ende, "bei 0,77 schon fertig").toBeNull();
    knautsch(1.0);
    l.takt(1);
    expect(ende).not.toBeNull();
    expect(ende!.sterne).toBe(3);
  });

  it("Sterne: ★★ unter 2:00 · ★★★ unter 1:00", () => {
    const M = { fehlwuerfe: 0, harteAufschlaege: 3, praezisionCm: null, ueberlasten: 0, fremdteile: 0 };
    expect(sterne(A4.wertung, { ...M, zeitS: 60 })).toBe(3);
    expect(sterne(A4.wertung, { ...M, zeitS: 61 })).toBe(2);
    expect(sterne(A4.wertung, { ...M, zeitS: 121 })).toBe(1);
  });
});

/** Ein Biss wie ein Fahrer: ueber die Stelle `versatz` m entlang der Laengsachse, senken, 1,5 s zu, 0,5 s auf. */
function beisse(k: Werkbank, car: CarComposite, versatz: number, jb: () => void): void {
  const p = car.body.translation();
  const r = car.body.rotation();
  const ax = new THREE.Vector3(0, 0, 1).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w));
  const zx = p.x + ax.x * versatz;
  const zz = p.z + ax.z * versatz;
  const m = k.b.position;
  k.tasten.down.clear();
  stelleArm(k, Math.hypot(zx - m.x, zz - m.z), 4.8, jb);
  dreheAuf(k, Math.atan2(zx - m.x, zz - m.z), jb);
  k.tasten.down.add("KeyF");
  bis(k, () => k.b.armBlocked, 240, jb);
  // zudruecken: 0,4 s Schliessen + 0,7 s Druck bis zum Biss (`Excavator.DRUCK_S`), etwas Luft
  k.tasten.down.add("Space");
  bis(k, () => false, 90, jb);
  k.tasten.down.clear();
  bis(k, () => false, 30, jb);
}

describe("Aufgabe 4: am echten Platz mit dem echten Bagger (Messung)", () => {
  it("Zudruecken: +0,26 je Biss, platt (≥ 0,8) nach vier Bissen, unter einer Minute", () => {
    const k = werkbank();
    const { lauf, obj } = starteAufgabe(k, A4);
    const car = obj.wracks[0]!;
    const jb = (): void => lauf.takt(DT);
    let ende: GameEvents["challenge:geschafft"] | null = null;
    const schritte: number[] = [1];
    k.bus.on("challenge:geschafft", (e) => (ende = e));
    k.bus.on("challenge:schritt", (e) => schritte.push(e.nr));
    let bisse = 0;
    k.bus.on("greifer:zugedrueckt", (e) => {
      if (e.handle === car.body.handle) bisse++;
    });
    const koerperStart = koerperZahl(k.world);
    const verlauf: string[] = [];
    let erster = -1;
    let n = 0;
    for (; n < 8 && !ende; n++) {
      beisse(k, car, [0, 1.3, -1.3][n % 3]!, jb);
      if (erster < 0 && bisse > 0) erster = lauf.zeitS;
      verlauf.push(`${n + 1}: Grad ${car.knautschgrad.toFixed(2)} (${bisse} Bisse, ${lauf.zeitS.toFixed(0)} s)`);
    }
    // eslint-disable-next-line no-console
    console.log(
      `A4 zudruecken: ${verlauf.join(" · ")}\n  Messung ${JSON.stringify((ende as GameEvents["challenge:geschafft"] | null)?.messung)}, ` +
        `Koerper Start ${JSON.stringify(koerperStart)}, Ende ${JSON.stringify(koerperZahl(k.world))}, abgerissen ${k.abrisse.length}`
    );
    expect(ende, "nicht platt geworden").not.toBeNull();
    expect(schritte).toEqual([1, 2]);
    expect(bisse, "mehr als fuenf Bisse noetig").toBeLessThanOrEqual(5);
    expect(lauf.zeitS - erster, "vom ersten Biss bis platt").toBeLessThan(60);
    expect(koerperStart.gesamt).toBeLessThanOrEqual(30);
  }, 240_000);

  it("Haemmern mit der leeren Spinne knautscht nicht (Stolperdraht fuer den Schritttext)", () => {
    const k = werkbank();
    const { lauf, obj } = starteAufgabe(k, A4);
    const car = obj.wracks[0]!;
    const jb = (): void => lauf.takt(DT);
    const p0 = car.body.translation();
    const m = k.b.position;
    dreheAuf(k, Math.atan2(p0.x - m.x, p0.z - m.z), jb);
    stelleArm(k, Math.hypot(p0.x - m.x, p0.z - m.z), 4.8, jb);
    let schlaege = 0;
    for (let i = 0; i < 10; i++) {
      // wie `tools/haemmern-kern.ts`: heben, dann Hauptarm UND Ausleger voll senken
      k.tasten.down.clear();
      k.tasten.down.add("KeyR");
      bis(k, () => false, 30, jb);
      k.tasten.down.clear();
      k.tasten.down.add("KeyF");
      k.tasten.down.add("KeyG");
      if (bis(k, () => k.b.armBlocked, 120, jb) < 120) schlaege++;
      bis(k, () => false, 10, jb);
      k.tasten.down.clear();
      k.tasten.down.add("KeyT");
      bis(k, () => false, 12, jb);
    }
    const p1 = car.body.translation();
    // eslint-disable-next-line no-console
    console.log(`A4 haemmern: ${schlaege} Schlaege aufgesetzt, Grad ${car.knautschgrad.toFixed(2)}, Wrack ${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(2)} m verschoben`);
    expect(schlaege).toBeGreaterThan(5);
    expect(car.knautschgrad, "Haemmern knautscht jetzt — Schritttext in katalog.ts (lehrt Zudruecken) anpassen").toBeLessThan(ANGEKNAUTSCHT_AB);
  }, 240_000);
});
