/**
 * P4b (Auftrag 41f, Patrick 22.10.2026: „kein Fan von diesen Textboxen"; Antwort 6:
 * Zeichen über dem Laster plus Funkton). Jede Fuhrpark-Meldung sagt nicht nur
 * WAS (Text für Bildschirmleser und Protokoll), sondern auch welche Art und WO —
 * daran hängt `ui/ortszeichen.ts`.
 *
 * Zwei Prüfungen: ein Quelltext-Wächter (jede `onMeldung`-Stelle in `delivery/`
 * reicht eine Lage weiter) und echte Fuhrparks, an denen Art und Ort stimmen.
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager, type FuhrparkLage } from "../src/delivery/vehicles";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { BAGGER_STAND } from "../src/world/baggerstand";
import { routeApproach, verladeHaltFuer } from "../src/delivery/routes";
import { lagerMuldeFuer } from "../src/world/containers";
import { setBuildingObstacles } from "../src/world/obstacles";
import { setzeSchichtPlatzZurueck } from "../src/world/schichtplatz";
import { BOX_SCHWELLE_KG, ANNAHME_ZU_KG } from "../src/delivery/schichtbetrieb";
import { baueSchichtPlatz, festerZufall, type SchichtPlatz } from "./schichtlauf";
import type { BoxOrder } from "../src/delivery/schichtfuhrpark";

const DT = 1 / 60;
/** SW: So nah muss das Zeichen am Laster bzw. am festen Platz sitzen (eine halbe Wagenbreite). */
const NAH_M = 1;

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

/* ------------------------------------------------ Quelltext-Wächter --- */

/** Alle Aufrufe `….onMeldung?.(…)` / `….onMeldung(…)` mit weniger als zwei Argumenten (Zeile, Text). */
function meldungenOhneLage(datei: string, quelle: string): string[] {
  const sf = ts.createSourceFile(datei, quelle, ts.ScriptTarget.Latest, true);
  const fehlt: string[] = [];
  const geh = (n: ts.Node): void => {
    if (ts.isCallExpression(n)) {
      const e = n.expression;
      const name = ts.isPropertyAccessExpression(e) ? e.name.text : ts.isIdentifier(e) ? e.text : "";
      if (name === "onMeldung" && n.arguments.length < 2) {
        const zeile = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
        fehlt.push(`${datei}:${zeile}  ${n.getText().slice(0, 80)}`);
      }
    }
    ts.forEachChild(n, geh);
  };
  geh(sf);
  return fehlt;
}

/** Wie viele `onMeldung`-Aufrufe stehen überhaupt drin (damit der Wächter nicht ins Leere prüft)? */
function zaehleAufrufe(quelle: string): number {
  return (quelle.match(/onMeldung\??\.?\(/g) ?? []).length;
}

describe("P4b — jede Fuhrpark-Meldung sagt, was und wo (Quelltext)", () => {
  const ordner = resolve(__dirname, "../src/delivery");
  const dateien = readdirSync(ordner).filter((f) => f.endsWith(".ts"));

  it("jede onMeldung-Stelle in delivery/ übergibt eine Lage", () => {
    let aufrufe = 0;
    const fehlt: string[] = [];
    for (const f of dateien) {
      const q = readFileSync(resolve(ordner, f), "utf8");
      aufrufe += zaehleAufrufe(q);
      fehlt.push(...meldungenOhneLage(f, q));
    }
    expect(aufrufe, "keine Meldungsstelle gefunden — prüft der Wächter die richtigen Dateien?").toBeGreaterThanOrEqual(15);
    expect(fehlt, "Meldung ohne Lage").toEqual([]);
  });

  it("Gegenprobe: eine Stelle ohne Lage fällt durch, mit Lage nicht", () => {
    const ohne = 'class A { f() { this.onMeldung?.(`Kipper fährt (${g(1, 2)}) los.`); v.onMeldung("x"); } }';
    expect(meldungenOhneLage("probe.ts", ohne)).toHaveLength(2);
    const mit = 'class A { f() { this.onMeldung?.("x", fuhrLage("faehrtLos", p)); w.onMeldung = (t, l) => this.onMeldung?.(t, l); } }';
    expect(meldungenOhneLage("probe.ts", mit)).toEqual([]);
  });
});

/* ------------------------------------------------- echte Fuhrparks --- */

interface Meldung {
  text: string;
  lage: FuhrparkLage;
}

/** Abstand einer Meldung zu einem Weltpunkt (nur Boden, x/z). */
const abstand = (l: FuhrparkLage, x: number, z: number): number => Math.hypot(l.x - x, l.z - z);

/** Der Sandkasten-Fuhrpark, wie `test/abholer-verladen.test.ts` und `test/fahrspuren.test.ts` ihn bauen. */
function baueSandkasten(saat: number) {
  zurueck = festerZufall(saat);
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0), boden);
  const items = new ItemManager(scene, world);
  const composites = new CompositeManager(scene, world, items, new EventBus());
  const m = new VehicleManager(scene, world, items, composites);
  m.vollFaehrtLos = true;
  m.sandkastenAbholer = true;
  m.acceptDeliveries = false;
  const bagger = new THREE.Vector3(BAGGER_STAND.x, 0, BAGGER_STAND.z);
  m.getExcavatorPos = () => bagger;
  m.gegriffen = () => [];
  const meldungen: Meldung[] = [];
  m.onMeldung = (text, lage) => meldungen.push({ text, lage });
  const takt = (): void => {
    m.update(DT);
    items.clampSpeeds(DT);
    world.step();
    composites.update();
  };
  const bis = (s: number, frage: () => boolean): void => {
    for (let i = 0; i < s * 60 && !frage(); i++) takt();
  };
  return { m, bagger, meldungen, bis };
}

/** Laufen lassen, bis `frage` wahr ist (höchstens `s` Sekunden); Luft holen wie in `test/boxabholer.test.ts`. */
async function bisSchicht(p: SchichtPlatz, s: number, frage: () => boolean): Promise<void> {
  for (let i = 0; i < s * 60 && !frage(); i++) {
    p.takt();
    if (i % 300 === 299) await new Promise((r) => setTimeout(r, 0));
  }
}

/** Meldungen des Schicht-Fuhrparks mitschreiben — mit dem Ort, an dem der gemeinte Laster in dem Moment stand. */
function hoerSchicht(p: SchichtPlatz, laster: () => THREE.Vector3 | null): Array<Meldung & { wo: THREE.Vector3 | null }> {
  const out: Array<Meldung & { wo: THREE.Vector3 | null }> = [];
  p.vehicles.onMeldung = (text, lage) => {
    p.protokoll.meldungen.push(text);
    out.push({ text, lage, wo: laster()?.clone() ?? null });
  };
  return out;
}

describe("P4b — Art und Ort am echten Fuhrpark", () => {
  it("bereit: der Abholer steht bereit — das Zeichen sitzt am Laster", () => {
    const p = baueSandkasten(4242);
    p.m.requestPickup("steel", "abroller");
    p.bis(400, () => !!p.m.pickupTruck?.waitingForLoad);
    const t = p.m.pickupTruck!;
    expect(t.waitingForLoad, "der Abholer ist nie angekommen").toBe(true);
    const b = p.meldungen.find((x) => x.lage.art === "bereit");
    expect(b, "keine Bereit-Meldung").toBeDefined();
    expect(b!.text).toMatch(/steht bereit — laden, dann ABHOLEN/);
    expect(abstand(b!.lage, t.group.position.x, t.group.position.z)).toBeLessThanOrEqual(NAH_M);
    // Die Bestellung davor: unterwegs (am Laster, beim Losfahren noch draußen vor dem Tor)
    expect(p.meldungen[0]!.lage.art).toBe("unterwegs");
  });

  it("blockiertBagger: der Bagger steht in der Spur — das Zeichen sitzt am wartenden Laster", () => {
    const p = baueSandkasten(192);
    const r = routeApproach();
    const [bx, bz] = r[Math.floor(r.length * 0.6)]!;
    p.bagger.set(bx, 0, bz);
    p.m.spawnNow("pritsche");
    p.bis(180, () => p.meldungen.some((x) => x.lage.art === "blockiertBagger"));
    const b = p.meldungen.find((x) => x.lage.art === "blockiertBagger");
    expect(b, "keine Meldung „Bagger aus der Fahrspur“").toBeDefined();
    expect(b!.text).toBe("Büro an Bagger: Der Laster kommt nicht vorbei — Bagger aus der Fahrspur, bitte.");
    const a = (p.m as unknown as { active: { group: THREE.Group } | null }).active!;
    // Er wartet: Er steht noch dort, wo er gemeldet hat
    expect(abstand(b!.lage, a.group.position.x, a.group.position.z)).toBeLessThanOrEqual(NAH_M);
  });

  it("abholerKommt: eine volle Box ruft ihren Abholer — das Zeichen sitzt am Verlader, der vorfährt", { timeout: 300_000 }, async () => {
    zurueck = festerZufall(18 * 7919 + 13);
    const box: Partial<Record<BoxOrder, number>> = { copper: 0, steel: 0, rubble: 0 };
    const p = baueSchichtPlatz({ stufe: "montag", saat: 18, loseKg: () => 0, boxKg: box });
    const gehoert = hoerSchicht(p, () => p.vehicles.schichtVerlader?.group.position ?? null);
    await bisSchicht(p, 5, () => false);
    box.copper = BOX_SCHWELLE_KG.copper + 8_000;
    await bisSchicht(p, 60, () => gehoert.some((x) => x.lage.art === "abholerKommt"));
    const k = gehoert.find((x) => x.lage.art === "abholerKommt");
    expect(k, "keine Meldung „Abholer kommt“").toBeDefined();
    expect(k!.text).toMatch(/Abholer für BUNT \+ VA kommt — der Verlader fährt vor/);
    expect(abstand(k!.lage, k!.wo!.x, k!.wo!.z)).toBeLessThanOrEqual(NAH_M);
  });

  it("wartetLager: die sortenreine Pritsche wartet am Lager — das Zeichen sitzt an ihrem festen Platz", { timeout: 300_000 }, async () => {
    zurueck = festerZufall(16);
    const p = baueSchichtPlatz({ stufe: "montag", saat: 1, loseKg: () => ANNAHME_ZU_KG + 1 });
    const gehoert = hoerSchicht(p, () => p.vehicles.schichtSiloWagen?.group.position ?? null);
    p.vehicles.schichtFaellig({ tS: 0, art: "sortenrein", fahrzeug: "pritsche", sorte: "copper" });
    p.takt();
    const w0 = p.vehicles.schichtSiloWagen!;
    p.bagger.set(w0.festerPlatz!.stand.x, 0, w0.festerPlatz!.stand.z);
    await bisSchicht(p, 120, () => gehoert.some((x) => x.lage.art === "wartetLager"));
    const m = gehoert.find((x) => x.lage.art === "wartetLager");
    expect(m, "keine Meldung „wartet am Lager“").toBeDefined();
    expect(m!.text).toBe("Büro an Bagger: Pritsche mit Kupfer wartet am KUPFER-LAGER — fahr hin und lad ab.");
    const halt = verladeHaltFuer(lagerMuldeFuer("copper")!);
    expect(abstand(m!.lage, halt[0], halt[1]), "nicht am festen Platz").toBeLessThanOrEqual(NAH_M);
    expect(abstand(m!.lage, m!.wo!.x, m!.wo!.z), "nicht an der Pritsche").toBeLessThanOrEqual(NAH_M);
  });
});
