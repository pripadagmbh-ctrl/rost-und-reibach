/**
 * E-204 — SCHÄDEN AM LASTER, mit echter Physik auf dem Schicht-Platz
 * (`test/schichtlauf.ts`, derselbe Prüfstand wie `schichtbetrieb.test.ts`).
 *
 * Gegenproben aus dem Auftrag S3b: 400 kg aus 0,5 m sanft in den leeren
 * Verlader → kein Schaden; aus 3 m → ein Schaden; 80 kg aus 3 m → keiner.
 * Dazu: die Sperre zählt einen Aufprall einmal, die Spinne nur voll auf
 * Stahl, und die Laster selbst (Kippen, Abladen) lösen nichts aus.
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import * as THREE from "three";
import { initPhysics } from "../src/physics/physicsWorld";
import { EventBus } from "../src/core/events";
import { SchadenMelder, SCHADEN_AB_KG, SCHADEN_SPERRE_S } from "../src/delivery/schichtschaden";
import { ANNAHME_ZU_KG } from "../src/delivery/schichtbetrieb";
import { setzeSchichtPlatzZurueck } from "../src/world/schichtplatz";
import { setBuildingObstacles } from "../src/world/obstacles";
import { baueSchichtPlatz, festerZufall, TestFahrer, DT, type SchichtPlatz } from "./schichtlauf";
import type { Schichtstufe } from "../src/economy/kasse";

beforeAll(async () => {
  await initPhysics();
});
let zurueck: (() => void) | null = null;
afterEach(() => {
  zurueck?.();
  zurueck = null;
  setzeSchichtPlatzZurueck();
  setBuildingObstacles([]);
});

interface Werkbank {
  p: SchichtPlatz;
  bus: EventBus;
  schaeden: Array<{ x: number; z: number; was: string; t: number }>;
  /** Größte gemeldete Wucht seit dem letzten Zurücksetzen. */
  maxWucht: { v: number };
}

/** Schicht-Platz mit Bus und Melder — die Teile melden wie in `main.ts` (`items.onAufprall`). */
function werkbank(stufe: Schichtstufe, loseKg?: () => number): Werkbank {
  const p = baueSchichtPlatz({ stufe, saat: 1, loseKg });
  const bus = new EventBus();
  const maxWucht = { v: 0 };
  p.items.onAufprall = (item, wucht) => {
    const t = item.body.translation();
    maxWucht.v = Math.max(maxWucht.v, wucht);
    bus.emit("schrott:aufprall", {
      materialId: item.materialId,
      massKg: item.massKg,
      wucht,
      blech: false,
      untergrund: "stahl",
      handle: item.body.handle,
      x: t.x,
      y: t.y,
      z: t.z,
    });
  };
  const melder = new SchadenMelder(bus, { boxen: () => p.vehicles.ladeBoxen(), jetztS: () => p.schichtS });
  const schaeden: Werkbank["schaeden"] = [];
  melder.onSchaden = (e) => schaeden.push({ ...e, t: p.schichtS });
  return { p, bus, schaeden, maxWucht };
}

function laufe(p: SchichtPlatz, s: number, fahrer?: TestFahrer): void {
  for (let i = 0; i < s * 60; i++) {
    p.takt();
    fahrer?.schritt(DT);
  }
}

/** Ein Teil `kg` aus `hoeheM` über dem Boden der Mulde fallen lassen; Ergebnis: Schäden und größte Wucht. */
function fallen(w: Werkbank, kg: number, hoeheM: number, bodenY: number): { schaeden: number; wucht: number } {
  const v = w.p.vehicles.schichtVerlader!;
  const bed = (v as unknown as { bedGroup: THREE.Group }).bedGroup;
  const wo = bed.localToWorld(new THREE.Vector3(0, 0, 2.7));
  wo.y = bodenY + 0.25 + hoeheM; // Unterkante `hoeheM` über dem Boden (Kiste 0,5 m hoch)
  const vorher = w.schaeden.length;
  w.maxWucht.v = 0;
  const it = w.p.items.spawnScrap("steel", kg, { kind: "box", dims: [0.8, 0.5, 0.8], color: 0x777777 }, wo, new THREE.Quaternion());
  laufe(w.p, 2.5);
  const ergebnis = { schaeden: w.schaeden.length - vorher, wucht: w.maxWucht.v };
  w.p.items.remove(it, true);
  laufe(w.p, 0.2);
  return ergebnis;
}

/** Wo liegt der Boden der leeren Mulde (Welt-y)? Eine Kiste ablegen und messen. */
function muldenBoden(w: Werkbank): number {
  const v = w.p.vehicles.schichtVerlader!;
  const bed = (v as unknown as { bedGroup: THREE.Group }).bedGroup;
  const wo = bed.localToWorld(new THREE.Vector3(0, 0.9, 2.7));
  const it = w.p.items.spawnScrap("steel", 50, { kind: "box", dims: [0.8, 0.5, 0.8], color: 0x777777 }, wo, new THREE.Quaternion());
  laufe(w.p, 2);
  const y = it.body.translation().y - 0.25;
  w.p.items.remove(it, true);
  laufe(w.p, 0.2);
  return y;
}

describe("E-204 — ein schweres Teil hart auf den Verlader kostet", () => {
  it("400 kg aus 0,5 m: nichts · aus 3 m: ein Schaden · 80 kg aus 3 m: nichts", { timeout: 300_000 }, () => {
    zurueck = festerZufall(204);
    const w = werkbank("montag", () => ANNAHME_ZU_KG + 1); // Annahme zu: kein Anlieferer stört
    laufe(w.p, 0.5);
    const boden = muldenBoden(w);
    const reihe: string[] = [];
    const mess = (kg: number, h: number): { schaeden: number; wucht: number } => {
      const r = fallen(w, kg, h, boden);
      reihe.push(`${kg} kg aus ${h} m: Wucht ${r.wucht.toFixed(1)} m/s, Schäden ${r.schaeden}`);
      return r;
    };
    const sanft = mess(400, 0.5);
    const hart = mess(400, 3);
    const leicht = mess(80, 3);
    // Wo liegt die Grenze? Für den Bericht (Meldewert je Fallhöhe)
    for (const h of [1, 1.5, 2, 2.5]) mess(400, h);
    mess(SCHADEN_AB_KG, 3);
    console.log(`Muldenboden y=${boden.toFixed(2)} m\n  ${reihe.join("\n  ")}`);
    expect(sanft.schaeden, "sanft abgelegt, trotzdem Schaden").toBe(0);
    expect(hart.schaeden, "aus 3 m fallen gelassen, kein Schaden").toBe(1);
    expect(leicht.schaeden, "80 kg sind zu leicht für eine Delle").toBe(0);
    expect(leicht.wucht, "Gegenprobe: das leichte Teil schlug auch hart auf").toBeGreaterThanOrEqual(5);
  });
});

describe("E-204 — Sperre und Spinne (Ereignisse direkt)", () => {
  it(`derselbe Laster zählt binnen ${SCHADEN_SPERRE_S} s einmal; die Spinne nur voll und auf Stahl`, () => {
    const bus = new EventBus();
    let t = 0;
    const box = { x: 10, z: 5, hw: 1.3, hd: 4, rot: 0 };
    const melder = new SchadenMelder(bus, { boxen: () => [box], jetztS: () => t });
    const n: string[] = [];
    melder.onSchaden = (e) => n.push(e.was);
    const auf = (x: number, z: number, massKg = 500, wucht = 6): void =>
      bus.emit("schrott:aufprall", { materialId: "steel", massKg, wucht, blech: false, untergrund: "stahl", x, y: 1.5, z });
    auf(10, 5);
    auf(10.5, 7); // Bündel: zweites Teil im selben Bild
    t = 1.4;
    auf(10, 3); // Nachhüpfer
    expect(n.length).toBe(1);
    t = 3.0;
    auf(10, 5); // neuer Wurf
    expect(n.length).toBe(2);
    auf(20, 5); // daneben auf den Boden
    auf(10, 5, 299, 9); // zu leicht
    t = 6;
    auf(10, 5, 500, 4.9); // nicht hart genug
    expect(n.length).toBe(2);
    // Spinne
    const spinne = (wucht: number, untergrund: "stahl" | "schrott" | "wrack" | "beton", x = 10): void =>
      bus.emit("spinne:aufschlag", { wucht, untergrund, x, y: 1.4, z: 5 });
    spinne(0.95, "stahl");
    spinne(1, "schrott"); // aufs Teil gehämmert
    spinne(1, "wrack");
    spinne(1, "stahl", 30); // auf eine Mulde, nicht auf einen Laster
    expect(n.length).toBe(2);
    spinne(1, "stahl");
    expect(n.length).toBe(3);
    // Nach Feierabend zählt nichts mehr
    melder.aktiv = false;
    t = 20;
    auf(10, 5);
    expect(n.length).toBe(3);
  });
});

describe("E-204 — die Laster selbst lösen nichts aus", () => {
  it("Mittwoch, 5 min: niemand räumt → 0 Schäden; Test-Fahrer räumt → gezählt (Bericht)", { timeout: 900_000 }, () => {
    zurueck = festerZufall(205);
    const leer = werkbank("mittwoch");
    laufe(leer.p, 300);
    zurueck();
    setzeSchichtPlatzZurueck();
    zurueck = festerZufall(205);
    const voll = werkbank("mittwoch");
    const fahrer = new TestFahrer(voll.p, { griffS: 4, lagerFahrtS: 20 });
    laufe(voll.p, 300, fahrer);
    console.log(
      `Mittwoch 5 min — niemand räumt: ${leer.schaeden.length} Schäden (${leer.p.protokoll.standzeiten.length} Anlieferer fertig); ` +
        `Test-Fahrer (${fahrer.griffe} Griffe, legt aus ≥ 1,7 m über der Fläche ab): ${voll.schaeden.length} Schäden ` +
        voll.schaeden.map((s) => `[${s.t.toFixed(0)} s ${s.was}]`).join(" ")
    );
    expect(leer.schaeden.length, "Kippen/Abladen hat einen Schaden ausgelöst").toBe(0);
  });
});
