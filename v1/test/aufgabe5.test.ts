/**
 * AUFGABE 5 „MAGNET" (G3, 20.10.2026).
 *
 * Geprueft wird:
 *  1. die Teile: Was ins Ziel muss, ist genau das, was der Magnet haelt
 *     (`ferroAnteil` ≥ `MAGNET_AB`); das Kupfer liegt mit `bleibtLiegen`;
 *  2. die Lage: frei (0,3 m Rand, mit Besenplatz), im Schwenkband, im Bild;
 *  3. der Greifer: Aufgabe 5 beginnt mit dem Magnet, und ↻ in eine andere
 *     Aufgabe setzt den Fuenfschalengreifer wieder ein (`starteAufgabe`);
 *  4. der Ablauf mit Attrappen (G4, Patrick 20.10.2026): Zaehler „n/5
 *     richtig", Spaene gehoeren auf MISCH, Eisen auf STAHL — vertauscht ist
 *     ein Fehlwurf; Kupfer in einer der Halden ist ein Fremdteil; fertig erst,
 *     wenn alles Magnetische in seiner Halde liegt;
 *  5. der ganze Ablauf am ECHTEN Platz mit dem echten Magnet: Spaene in
 *     MISCHSCHROTT, Eisen in STAHLSCHROTT, das Kupfer bleibt liegen.
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
import { abwurf, belegt } from "./aufgabenplatz";
import { CONFIGS, gehoertHierhin } from "../src/world/containers";
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
  it("Magnet am Arm; Eisen auf STAHL, Spaene auf MISCH; 5 magnetische Teile (2 Spaene), 2 Kupfer bleiben liegen", () => {
    expect(A5.aufbau.greifer).toBe("magnet");
    expect(A5.zielBehaelter).toBe("c_steel");
    // Jedes Pflichtteil hat als Ziel genau die Halde, in der es laut Zonen-Zaehlung richtig ist (`gehoertHierhin`)
    for (const t of TEILE.filter((t) => !t.bleibtLiegen)) {
      const ziel = CONFIGS.find((c) => c.id === (t.ziel ?? A5.zielBehaelter))!;
      expect(gehoertHierhin(ziel, teilSpec(t.name)!.materialId), `${t.name} → ${ziel.id}`).toBe(true);
    }
    expect(TEILE.filter((t) => t.ziel === "c_mixed").map((t) => t.name)).toEqual([SPAENE_NAME, SPAENE_NAME]);
    expect(aufbauKonflikte(A5)).toEqual([]);
    for (const t of TEILE) expect(!!t.bleibtLiegen, `${t.name}: bleibtLiegen passt nicht zur Haftregel`).toBe(!haftet(t.name));
    expect(TEILE.filter((t) => haftet(t.name))).toHaveLength(5);
    expect(TEILE.filter((t) => t.name === SPAENE_NAME)).toHaveLength(2);
    expect(TEILE.filter((t) => t.bleibtLiegen).map((t) => teilSpec(t.name)!.materialId)).toEqual(["copper", "copper"]);
    // Spaene sind Mischschrott (E-147) — das ist der Grund fuer die Pflichtteil-Regel in challenge.ts
    expect(teilSpec(SPAENE_NAME)!.materialId).toBe("mixed");
  });

  it("beide Halden ohne Fahren: Abwurfstelle mit 1 m Luft im Schwenkband", () => {
    for (const id of ["c_steel", "c_mixed"]) {
      const a = abwurf(id, 1.0);
      // eslint-disable-next-line no-console
      console.log(`A5 Abwurf ${id}: ${a ? `(${a.x.toFixed(2)} | ${a.z.toFixed(2)}) ${a.r.toFixed(2)} m, ${(Math.atan2(a.x - BAGGER_STAND.x, a.z - BAGGER_STAND.z) * GRAD).toFixed(0)}°` : "keine"}`);
      expect(a, `${id} nicht ohne Fahren erreichbar`).not.toBeNull();
    }
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
      behaelter: (id) => ({ x: id === "c_mixed" ? -3 : 4, z: -32, oberkante: 5 }),
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
    /** Teil i in die Halde — gemeldet wie von der Zonen-Zaehlung (`gehoertHierhin`) */
    const wirf = (i: number, halde: "c_steel" | "c_mixed"): void => {
      const t = teile[i]!;
      const alt = w.behaelter.get(t.id);
      if (alt) bus.emit("itemLeft", { itemId: t.id, containerId: alt });
      w.behaelter.set(t.id, halde);
      const cfg = CONFIGS.find((c) => c.id === halde)!;
      bus.emit("itemEntered", { itemId: t.id, materialId: "x", containerId: halde, correct: gehoertHierhin(cfg, teilSpec(TEILE[i]!.name)!.materialId) });
      lauf.takt(1);
    };
    const halten = (i: number): void => {
      w.griff = [teile[i]!.body];
      lauf.takt(1);
      w.griff = [];
    };
    return { lauf, staende, wirf, halten, ende: () => ende as GameEvents["challenge:geschafft"] | null };
  }
  const SPAENE = TEILE.map((t, i) => (t.name === SPAENE_NAME ? i : -1)).filter((i) => i >= 0);
  const EISEN = TEILE.map((t, i) => (!t.bleibtLiegen && t.name !== SPAENE_NAME ? i : -1)).filter((i) => i >= 0);
  const KUPFER = TEILE.map((t, i) => (t.bleibtLiegen ? i : -1)).filter((i) => i >= 0);
  const richtig = (i: number): "c_steel" | "c_mixed" => (SPAENE.includes(i) ? "c_mixed" : "c_steel");

  it("Zaehler n/5 richtig; Spaene auf MISCH, Eisen auf STAHL; fertig erst mit allen fuenf — ★★★", () => {
    const a = attrappe();
    a.lauf.takt(1);
    expect(a.staende.at(-1)!.zaehler).toEqual({ ist: 0, von: 5, wort: A5.zaehlwort });
    // gelb sind nur die magnetischen Teile, nicht das Kupfer
    expect(a.staende.at(-1)!.marken.filter((m) => m.art === "teil")).toHaveLength(5);
    const alle = [...SPAENE, ...EISEN];
    alle.forEach((i, n) => {
      a.wirf(i, richtig(i));
      if (n < alle.length - 1) {
        expect(a.staende.at(-1)!.zaehler!.ist).toBe(n + 1);
        expect(a.ende(), "zu frueh fertig").toBeNull();
      }
    });
    expect(a.ende()).not.toBeNull();
    expect(a.ende()!.messung).toMatchObject({ fehlwuerfe: 0, fremdteile: 0 });
    expect(a.ende()!.sterne).toBe(3);
  });

  it("gruene Marke ueber der Halde des gehaltenen Teils: Spaene MISCH, Eisen STAHL", () => {
    const a = attrappe();
    a.halten(SPAENE[0]!);
    expect(a.staende.at(-1)!.marken.filter((m) => m.art === "ziel")).toEqual([{ x: -3, y: 5, z: -32, art: "ziel", sorte: "misch" }]);
    a.halten(EISEN[0]!);
    expect(a.staende.at(-1)!.marken.filter((m) => m.art === "ziel")).toEqual([{ x: 4, y: 5, z: -32, art: "ziel", sorte: "stahl" }]);
  });

  it("vertauscht ist ein Fehlwurf und zaehlt nicht — umgelegt geht es weiter, ★★★ ist weg", () => {
    const a = attrappe();
    a.wirf(SPAENE[0]!, "c_steel");
    expect(a.lauf.messung()).toMatchObject({ fehlwuerfe: 1, fremdteile: 0 });
    a.wirf(EISEN[0]!, "c_mixed");
    expect(a.lauf.messung()).toMatchObject({ fehlwuerfe: 2, fremdteile: 0 });
    expect(a.staende.at(-1)!.zaehler!.ist, "falsch liegend zaehlt nicht").toBe(0);
    // alle anderen richtig: noch nicht fertig, zwei liegen falsch
    for (const i of [...SPAENE, ...EISEN].filter((i) => i !== SPAENE[0] && i !== EISEN[0])) a.wirf(i, richtig(i));
    expect(a.ende(), "fertig, obwohl zwei falsch liegen").toBeNull();
    expect(a.staende.at(-1)!.zaehler!.ist).toBe(3);
    a.wirf(SPAENE[0]!, "c_mixed");
    a.wirf(EISEN[0]!, "c_steel");
    expect(a.ende()).not.toBeNull();
    expect(a.ende()!.messung.fehlwuerfe).toBe(2);
    expect(a.ende()!.sterne, "Fehlwurf kostet den dritten Stern").toBe(2);
  });

  it("Kupfer in STAHL oder MISCH ist ein Fremdteil (★★★ weg), kein Fehlwurf, zaehlt nicht", () => {
    for (const halde of ["c_steel", "c_mixed"] as const) {
      const a = attrappe();
      a.wirf(KUPFER[0]!, halde);
      expect(a.lauf.messung(), halde).toMatchObject({ fremdteile: 1, fehlwuerfe: 0 });
      expect(a.staende.at(-1)!.zaehler!.ist, "Kupfer zaehlt nicht").toBe(0);
    }
    const M = { fehlwuerfe: 0, harteAufschlaege: 0, praezisionCm: null, ueberlasten: 0 };
    expect(sterne(A5.wertung, { ...M, zeitS: 100, fremdteile: 1 })).toBe(2);
    expect(sterne(A5.wertung, { ...M, zeitS: 100, fremdteile: 0 })).toBe(3);
    expect(sterne(A5.wertung, { ...M, zeitS: 100, fremdteile: 0, fehlwuerfe: 1 })).toBe(2);
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
  it("Spaene in MISCHSCHROTT, Eisen in STAHLSCHROTT, das Kupfer bleibt liegen", () => {
    const k = werkbank();
    const { lauf, obj } = starteAufgabe(k, A5);
    expect(k.b.greiferform.id).toBe("magnet");
    const jb = (): void => lauf.takt(DT);
    let ende: GameEvents["challenge:geschafft"] | null = null;
    k.bus.on("challenge:geschafft", (e) => (ende = e));
    const koerperStart = koerperZahl(k.world);
    const sollVon = (i: number): string => TEILE[i]!.ziel ?? A5.zielBehaelter!;
    const gaenge: string[] = [];
    for (let n = 0; n < 12 && !ende; n++) {
      const offen = obj.teile.filter((t, i) => !TEILE[i]!.bleibtLiegen && t.containerId !== sollVon(i));
      if (offen.length === 0) break;
      const p = offen[0]!.body.translation();
      const zahl = magnetHole(k, p, jb);
      // Wohin die Ladung gehoert; haftet Gemischtes, wird abgeschuettelt und neu gegriffen (wie ein Spieler es auch muesste)
      const soll = new Set(obj.teile.flatMap((t, i) => (k.grip.grippedBodies.some((b) => b.handle === t.body.handle) ? [sollVon(i)] : [])));
      const halde = soll.size === 1 ? abwurf([...soll][0]!, 1.0)! : null;
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
      gaenge.push(`${n + 1}: ${zahl} gehaftet → ${[...soll].join("+") || "-"}, richtig ${obj.teile.filter((t, i) => !TEILE[i]!.bleibtLiegen && t.containerId === sollVon(i)).length}`);
    }
    bis(k, () => ende !== null, 120, jb);
    const kupfer = obj.teile.filter((_, i) => TEILE[i]!.bleibtLiegen);
    // eslint-disable-next-line no-console
    console.log(
      `A5: ${gaenge.join(" · ")}\n  Kupfer: ${kupfer.map((t) => `${t.shape?.name} ${t.containerId ?? "liegt"}`).join(", ")}, ` +
        `Messung ${JSON.stringify((ende as GameEvents["challenge:geschafft"] | null)?.messung)}, Koerper Start ${JSON.stringify(koerperStart)}, Ende ${JSON.stringify(koerperZahl(k.world))}`
    );
    expect(ende, "nicht alles Magnetische in seiner Halde").not.toBeNull();
    obj.teile.forEach((t, i) => {
      if (!TEILE[i]!.bleibtLiegen) expect(t.containerId, TEILE[i]!.name).toBe(sollVon(i));
    });
    for (const t of kupfer) expect(t.containerId, `${t.shape?.name} wurde mitgenommen`).toBeNull();
    const e = ende as unknown as GameEvents["challenge:geschafft"];
    expect(e.messung.fremdteile).toBe(0);
    expect(e.messung.fehlwuerfe).toBe(0);
    expect(koerperStart.gesamt).toBeLessThanOrEqual(35);
  }, 300_000);
});
