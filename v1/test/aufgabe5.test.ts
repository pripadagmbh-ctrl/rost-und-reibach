/**
 * AUFGABE 5 „MAGNET" (G3, 20.10.2026).
 *
 * Geprueft wird:
 *  1. die Teile: Was ins Ziel muss, ist genau das, was der Magnet haelt
 *     (`ferroAnteil` ≥ `MAGNET_AB`); das Kupfer liegt mit `bleibtLiegen`;
 *  2. die Lage: frei (0,3 m Rand, mit Besenplatz), im Schwenkband, im Bild;
 *  3. der Greifer: Aufgabe 5 beginnt mit dem Magnet, und ↻ in eine andere
 *     Aufgabe setzt den Fuenfschalengreifer wieder ein (`starteAufgabe`);
 *  4. der Ablauf mit Attrappen: Zaehler „n/5 Eisen", Spaene in der Stahlhalde
 *     sind weder Fehlwurf noch Fremdteil, Kupfer dort ist beides;
 *  5. der ganze Ablauf am ECHTEN Platz mit dem echten Magnet: alles Eisen in
 *     STAHLSCHROTT, das Kupfer bleibt liegen.
 */
import { describe, it, expect, beforeAll } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { CHALLENGES } from "../src/challenges/katalog";
import { ChallengeLauf, sterne, type ChallengeQuellen, type Punkt } from "../src/challenges/challenge";
import { aufbauKonflikte, formAusSpec, grundbestandVon, raeumeAuf, teilSpec } from "../src/challenges/aufbau";
import { MAGNET_AB, ferroAnteil } from "../src/excavator/magnet";
import { umkugelRadius } from "../src/world/scrapItems";
import { SPAENE_NAME } from "../src/world/spaene";
import { BAGGER_STAND, SCHWENK_AUSSEN, SCHWENK_INNEN, abstandVomStand } from "../src/world/baggerstand";
import { EventBus, type GameEvents } from "../src/core/events";
import { belegt } from "./aufgabenplatz";
import {
  DT,
  GRAD,
  SCHWENK_R,
  SCHWENK_Y,
  bis,
  dreheAuf,
  fuehreUeber,
  koerperZahl,
  platzLeinwand,
  starteAufgabe,
  stelleArm,
  werkbank,
  type Werkbank,
} from "./aufgabenwerkbank";

const A5 = CHALLENGES.find((c) => c.id === "magnet")!;
const TEILE = A5.aufbau.teile!;
const haftet = (name: string): boolean => {
  const s = teilSpec(name)!;
  return ferroAnteil({ materialId: s.materialId, shape: formAusSpec(s) } as never) >= MAGNET_AB;
};

beforeAll(async () => {
  platzLeinwand();
  await RAPIER.init();
});

describe("Aufgabe 5: die Teile und der Greifer", () => {
  it("Magnet am Arm, Ziel Stahlhalde; 5 magnetische Teile (2 Spaene), 2 Kupfer bleiben liegen", () => {
    expect(A5.aufbau.greifer).toBe("magnet");
    expect(A5.zielBehaelter).toBe("c_steel");
    expect(aufbauKonflikte(A5)).toEqual([]);
    for (const t of TEILE) expect(!!t.bleibtLiegen, `${t.name}: bleibtLiegen passt nicht zur Haftregel`).toBe(!haftet(t.name));
    expect(TEILE.filter((t) => haftet(t.name))).toHaveLength(5);
    expect(TEILE.filter((t) => t.name === SPAENE_NAME)).toHaveLength(2);
    expect(TEILE.filter((t) => t.bleibtLiegen).map((t) => teilSpec(t.name)!.materialId)).toEqual(["copper", "copper"]);
    // Spaene sind Mischschrott (E-147) — das ist der Grund fuer die Pflichtteil-Regel in challenge.ts
    expect(teilSpec(SPAENE_NAME)!.materialId).toBe("mixed");
  });

  it("frei, im Schwenkband, im Bild", () => {
    const kamZ = BAGGER_STAND.z - 11 * Math.cos(0.42);
    for (const t of TEILE) {
      const u = umkugelRadius(formAusSpec(teilSpec(t.name)!));
      const r = abstandVomStand(t.x, t.z);
      expect(r).toBeGreaterThanOrEqual(SCHWENK_INNEN);
      expect(r).toBeLessThanOrEqual(SCHWENK_AUSSEN);
      for (let a = 0; a < 360; a += 15) expect(belegt(t.x + u * Math.cos(a / GRAD), t.z + u * Math.sin(a / GRAD), { rand: 0.3 }), t.name).toBe("");
      expect(Math.abs(Math.atan2(t.x - BAGGER_STAND.x, t.z - kamZ) * GRAD), t.name).toBeLessThan(35);
    }
  });

  it("Wechsel Magnet ↔ Fuenfschalen ueber starteAufgabe (Aufgabe 1 setzt zurueck)", () => {
    const k = werkbank();
    const grund = grundbestandVon(k);
    starteAufgabe(k, A5).lauf.beenden();
    expect(k.b.greiferform.id).toBe("magnet");
    raeumeAuf(grund, k);
    starteAufgabe(k, CHALLENGES[0]!).lauf.beenden();
    expect(k.b.greiferform.id).toBe("fuenfschalen");
    for (const c of CHALLENGES) expect(c.aufbau.greifer, `${c.id} nennt keinen Startgreifer — nach dem Magnet bliebe er dran`).toBeDefined();
  });
});

describe("Aufgabe 5: der Ablauf mit Attrappen", () => {
  function attrappe() {
    const teile = TEILE.map((t, i) => {
      const k = { handle: 200 + i, p: { x: t.x, y: 0.3, z: t.z } as Punkt, translation() { return this.p; }, isValid: () => true };
      return { id: `item_${i}`, body: k };
    });
    const w = { griff: [] as Array<{ handle: number }>, behaelter: new Map<string, string>() };
    const q: ChallengeQuellen = {
      gegriffen: () => w.griff,
      spinne: () => ({ x: 0, y: 5, z: 0 }),
      drehmitte: () => BAGGER_STAND,
      blickRad: () => 0,
      behaelter: () => ({ x: 3.2, z: -32, oberkante: 5 }),
      ueberBehaelter: () => false,
      behaelterVon: (id) => w.behaelter.get(id) ?? null,
      ueberKammer: () => false,
      inKammer: () => false,
    };
    const bus = new EventBus();
    const staende: Array<GameEvents["challenge:stand"]> = [];
    let ende: GameEvents["challenge:geschafft"] | null = null;
    bus.on("challenge:stand", (e) => staende.push(e));
    bus.on("challenge:geschafft", (e) => (ende = e));
    const lauf = new ChallengeLauf(A5, 5, q, bus, { teile, wracks: [] });
    lauf.start();
    const inHalde = (i: number): void => {
      const t = teile[i]!;
      w.behaelter.set(t.id, "c_steel");
      // so meldet die Halde: Stahl richtig, Spaene (Misch) und Kupfer falsch
      bus.emit("itemEntered", { itemId: t.id, materialId: "x", containerId: "c_steel", correct: teilSpec(TEILE[i]!.name)!.materialId === "steel" });
      lauf.takt(1);
    };
    return { lauf, staende, inHalde, ende: () => ende as GameEvents["challenge:geschafft"] | null };
  }

  it("Zaehler n/5 Eisen; Spaene in der Stahlhalde zaehlen, ohne Fehlwurf oder Fremdteil; fertig mit allen fuenf", () => {
    const a = attrappe();
    a.lauf.takt(1);
    expect(a.staende.at(-1)!.zaehler).toEqual({ ist: 0, von: 5, wort: A5.zaehlwort });
    // gelb sind nur die Eisenteile, nicht das Kupfer
    expect(a.staende.at(-1)!.marken.filter((m) => m.art === "teil")).toHaveLength(5);
    const eisen = TEILE.map((t, i) => (t.bleibtLiegen ? -1 : i)).filter((i) => i >= 0);
    eisen.forEach((i, n) => {
      a.inHalde(i);
      if (n < eisen.length - 1) expect(a.staende.at(-1)!.zaehler!.ist).toBe(n + 1);
    });
    expect(a.ende()).not.toBeNull();
    expect(a.ende()!.messung).toMatchObject({ fehlwuerfe: 0, fremdteile: 0 });
    expect(a.ende()!.sterne).toBe(3);
  });

  it("Kupfer in der Stahlhalde ist ein Fremdteil (★★★ weg) und ein Fehlwurf", () => {
    const a = attrappe();
    const kupfer = TEILE.findIndex((t) => t.bleibtLiegen);
    a.inHalde(kupfer);
    expect(a.lauf.messung()).toMatchObject({ fremdteile: 1, fehlwuerfe: 1 });
    expect(a.staende.at(-1)!.zaehler!.ist, "Kupfer zaehlt nicht als Eisen").toBe(0);
    const M = { fehlwuerfe: 1, harteAufschlaege: 0, praezisionCm: null, ueberlasten: 0 };
    expect(sterne(A5.wertung, { ...M, zeitS: 100, fremdteile: 1 })).toBe(2);
    expect(sterne(A5.wertung, { ...M, zeitS: 100, fremdteile: 0 })).toBe(3);
    expect(sterne(A5.wertung, { ...M, zeitS: 181, fremdteile: 0 })).toBe(1);
  });
});

/** Mit dem Magnet ueber `p` senken (an), heben; liefert, was haftet. */
function magnetHole(k: Werkbank, p: { x: number; z: number }, jb: () => void): number {
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
  return k.grip.grippedCount;
}

describe("Aufgabe 5: am echten Platz mit dem echten Magnet", () => {
  it("alles Eisen in STAHLSCHROTT, das Kupfer bleibt liegen", () => {
    const k = werkbank();
    const { lauf, obj } = starteAufgabe(k, A5);
    expect(k.b.greiferform.id).toBe("magnet");
    const jb = (): void => lauf.takt(DT);
    let ende: GameEvents["challenge:geschafft"] | null = null;
    k.bus.on("challenge:geschafft", (e) => (ende = e));
    const koerperStart = koerperZahl(k.world);
    const halde = { x: 2.3, z: -30.1 }; // Abwurfstelle wie in test/aufgabe3.test.ts (abwurf "c_steel")
    const gaenge: string[] = [];
    for (let n = 0; n < 10 && !ende; n++) {
      const offen = obj.teile.filter((t, i) => !TEILE[i]!.bleibtLiegen && t.containerId !== "c_steel");
      if (offen.length === 0) break;
      const p = offen[0]!.body.translation();
      const zahl = magnetHole(k, p, jb);
      if (zahl > 0) {
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
      gaenge.push(`${n + 1}: ${zahl} gehaftet, im Ziel ${obj.teile.filter((t) => t.containerId === "c_steel").length}`);
    }
    bis(k, () => ende !== null, 120, jb);
    const kupfer = obj.teile.filter((_, i) => TEILE[i]!.bleibtLiegen);
    // eslint-disable-next-line no-console
    console.log(
      `A5: ${gaenge.join(" · ")}\n  Kupfer: ${kupfer.map((t) => `${t.shape?.name} ${t.containerId ?? "liegt"}`).join(", ")}, ` +
        `Messung ${JSON.stringify((ende as GameEvents["challenge:geschafft"] | null)?.messung)}, Koerper Start ${JSON.stringify(koerperStart)}, Ende ${JSON.stringify(koerperZahl(k.world))}`
    );
    expect(ende, "nicht alles Eisen in der Halde").not.toBeNull();
    for (const t of kupfer) expect(t.containerId, `${t.shape?.name} wurde mitgenommen`).toBeNull();
    const e = ende as unknown as GameEvents["challenge:geschafft"];
    expect(e.messung.fremdteile).toBe(0);
    expect(e.messung.fehlwuerfe).toBe(0);
    expect(koerperStart.gesamt).toBeLessThanOrEqual(35);
  }, 300_000);
});
