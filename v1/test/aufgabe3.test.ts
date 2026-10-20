/**
 * AUFGABE 3 „SORTIEREN" (G3, 20.10.2026).
 *
 * Geprueft wird:
 *  1. die Teile: je Sorte die richtige Zahl (2 Stahl, 2 Misch, 1 Bunt, 1
 *     Muell) nach der Fraktion, die die Griff-Info zeigt; jedes greifbar;
 *  2. die Lage: frei (0,3 m Rand zu Behaeltern, MUELL-Mulde, Mauern samt
 *     E-182, Presse, Besenplatz), im Schwenkband, vorn im Bild;
 *  3. die Ziele ohne Fahren: Fuer jede Sorte gibt es im Schwenkband eine
 *     Abwurfstelle mit 1 m Luft zu den Zonenraendern — auch die Halden
 *     hinten (Vorderkante, E-182);
 *  4. der Ablauf mit Attrappen: Zaehler „n/6 richtig", Fehlwurf je falschem
 *     Einwurf, Herausholen erlaubt, fertig erst mit allen sechs, Sterne;
 *  5. der ganze Ablauf am ECHTEN Platz: sechs Teile in sechs Behaelter,
 *     `itemEntered` auch in der beweglichen MUELL-Mulde (E-184), und die
 *     Mulde wird dabei nicht weggeschoben.
 */
import { describe, it, expect, beforeAll } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { CHALLENGES } from "../src/challenges/katalog";
import { ChallengeLauf, sterne, type ChallengeQuellen, type Punkt } from "../src/challenges/challenge";
import { aufbauKonflikte, formAusSpec, teilSpec } from "../src/challenges/aufbau";
import { CONFIGS, gehoertHierhin, MUELL_START } from "../src/world/containers";
import { umkugelRadius } from "../src/world/scrapItems";
import { BAGGER_STAND, SCHWENK_AUSSEN, SCHWENK_INNEN, abstandVomStand } from "../src/world/baggerstand";
import { EventBus, type GameEvents } from "../src/core/events";
import { abwurf, belegt } from "./aufgabenplatz";
import { DT, GRAD, greife, koerperZahl, legeAb, platzLeinwand, starteAufgabe, werkbank } from "./aufgabenwerkbank";

const A3 = CHALLENGES.find((c) => c.id === "sortieren")!;
const TEILE = A3.aufbau.teile!;
/** Halbe Spannweite der offenen Fuenfschalen-Spinne: 3,02 m offen (`world/press.ts`, Kommentar zu INNER_D; `test/spinnenmass.test.ts`) */
const SPINNE_OFFEN_HALB = 1.51;

beforeAll(async () => {
  platzLeinwand();
  await RAPIER.init();
});

/** Wohin ein Teil gehoert — dieselbe Regel wie die Zonen-Zaehlung (`gehoertHierhin`), nur Behaelter im Schwenkband. */
function zielVon(name: string): string {
  const s = teilSpec(name)!;
  const ziele = CONFIGS.filter((c) => !c.nurHuelle && !c.lager && gehoertHierhin(c, s.materialId) && abstandVomStand(c.x, c.z) < SCHWENK_AUSSEN + 3);
  expect(ziele.length, `${name}: ${ziele.map((c) => c.id).join(",")}`).toBe(1);
  return ziele[0]!.id;
}

describe("Aufgabe 3: die Teile", () => {
  it("sechs Teile: 2 Stahl, 2 Misch, 1 Bunt, 1 Muell — nach der Fraktion, die die Griff-Info zeigt", () => {
    expect(TEILE).toHaveLength(6);
    const ziele = TEILE.map((t) => zielVon(t.name));
    const zahl = (id: string): number => ziele.filter((z) => z === id).length;
    expect({ stahl: zahl("c_steel"), misch: zahl("c_mixed"), bunt: zahl("r_bunt"), muell: zahl("r_rubble") }).toEqual({ stahl: 2, misch: 2, bunt: 1, muell: 1 });
    expect(A3.zielBehaelter, "jedes Teil hat seine eigene Mulde").toBeUndefined();
    expect(A3.zaehlwort).toEqual({ de: "richtig", en: "correct" });
    expect(aufbauKonflikte(A3)).toEqual([]);
  });

  it("frei, im Schwenkband, vorn im Bild", () => {
    const kamZ = BAGGER_STAND.z - 11 * Math.cos(0.42);
    for (const t of TEILE) {
      const u = umkugelRadius(formAusSpec(teilSpec(t.name)!));
      const r = abstandVomStand(t.x, t.z);
      expect(r, t.name).toBeGreaterThanOrEqual(SCHWENK_INNEN);
      expect(r, t.name).toBeLessThanOrEqual(SCHWENK_AUSSEN);
      for (let a = 0; a < 360; a += 15) {
        const w = belegt(t.x + u * Math.cos(a / GRAD), t.z + u * Math.sin(a / GRAD), { rand: 0.3 });
        expect(w, `${t.name} liegt in ${w}`).toBe("");
      }
      expect(Math.abs(Math.atan2(t.x - BAGGER_STAND.x, t.z - kamZ) * GRAD), `${t.name} ausserhalb des ersten Bilds`).toBeLessThan(35);
      // Die offene Spinne darf beim Greifen die bewegliche MUELL-Mulde nicht streifen (gemessen: 1,6 m schob sie 0,21 m weg)
      const ml = CONFIGS.find((c) => c.id === "r_rubble")!;
      const dx = Math.abs(t.x - MUELL_START.x) - ml.size[0] / 2;
      const dz = Math.abs(t.z - MUELL_START.z) - ml.size[1] / 2;
      expect(Math.hypot(Math.max(dx, 0), Math.max(dz, 0)), `${t.name} zu nah an der MUELL-Mulde`).toBeGreaterThan(SPINNE_OFFEN_HALB + 0.3);
    }
  });

  it("jedes Ziel ist ohne Fahren erreichbar — Abwurfstelle mit 1 m Luft im Schwenkband (Halden hinten, E-182)", () => {
    for (const id of ["c_steel", "c_mixed", "r_bunt", "r_rubble"]) {
      const a = abwurf(id, 1.0);
      // eslint-disable-next-line no-console
      console.log(`Abwurf ${id}: ${a ? `(${a.x.toFixed(2)} | ${a.z.toFixed(2)}) ${a.r.toFixed(2)} m, ${(Math.atan2(a.x - BAGGER_STAND.x, a.z - BAGGER_STAND.z) * GRAD).toFixed(0)}°` : "keine"}`);
      expect(a, `${id} nicht ohne Fahren erreichbar`).not.toBeNull();
    }
  });
});

/** Attrappen-Welt: sechs Teile, Behaelter nach Ansage. */
function attrappe() {
  const teile = TEILE.map((t, i) => {
    const k = { handle: 100 + i, p: { x: t.x, y: 0.4, z: t.z } as Punkt, translation() { return this.p; }, isValid: () => true };
    return { id: `item_${i}`, body: k };
  });
  const w = { griff: [] as Array<{ handle: number }>, behaelter: new Map<string, string>() };
  const q: ChallengeQuellen = {
    gegriffen: () => w.griff,
    spinne: () => ({ x: 0, y: 5, z: 0 }),
    drehmitte: () => BAGGER_STAND,
    blickRad: () => 0,
    behaelter: (id) => ({ x: 0, z: 0, oberkante: id.startsWith("c_") ? 5 : 2 }),
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
  const lauf = new ChallengeLauf(A3, 3, q, bus, { teile, wracks: [] });
  lauf.start();
  /** Teil i greifen (einmal takt), dann in Behaelter c fallen lassen */
  const wirf = (i: number, c: string): void => {
    const t = teile[i]!;
    w.griff = [t.body];
    lauf.takt(1);
    w.griff = [];
    w.behaelter.set(t.id, c);
    bus.emit("itemEntered", { itemId: t.id, materialId: "x", containerId: c, correct: c === zielVon(TEILE[i]!.name) });
    lauf.takt(1);
  };
  const raus = (i: number): void => {
    const t = teiles(i);
    const c = w.behaelter.get(t.id)!;
    w.behaelter.delete(t.id);
    bus.emit("itemLeft", { itemId: t.id, containerId: c });
  };
  const teiles = (i: number) => teile[i]!;
  return { lauf, staende, ende: () => ende as GameEvents["challenge:geschafft"] | null, wirf, raus };
}

describe("Aufgabe 3: der Ablauf mit Attrappen", () => {
  it("Zaehler n/6 richtig; fertig erst mit allen sechs; ohne Fehlwurf drei Sterne", () => {
    const a = attrappe();
    a.lauf.takt(1);
    expect(a.staende.at(-1)!.zaehler).toEqual({ ist: 0, von: 6, wort: A3.zaehlwort });
    // Startmarken: alle sechs gelb
    expect(a.staende.at(-1)!.marken.filter((m) => m.art === "teil")).toHaveLength(6);
    TEILE.forEach((t, i) => {
      a.wirf(i, zielVon(t.name));
      expect(a.staende.at(-1)?.zaehler?.ist ?? 6, `nach Teil ${i + 1}`).toBe(i + 1);
    });
    expect(a.ende()).not.toBeNull();
    expect(a.ende()!.messung.fehlwuerfe).toBe(0);
    expect(a.ende()!.sterne).toBe(3);
  });

  it("Fehlwurf zaehlt je Einwurf; herausholen und richtig einwerfen geht, der Fehlwurf bleibt", () => {
    const a = attrappe();
    a.wirf(0, "c_steel"); // Kupfer in die Stahlhalde
    expect(a.lauf.messung().fehlwuerfe).toBe(1);
    expect(a.staende.at(-1)!.zaehler!.ist).toBe(0);
    a.raus(0);
    a.wirf(0, "r_bunt");
    expect(a.staende.at(-1)!.zaehler!.ist).toBe(1);
    expect(a.lauf.messung().fehlwuerfe).toBe(1);
    // ein zweiter falscher Einwurf eines anderen Teils
    a.wirf(1, "c_mixed");
    expect(a.lauf.messung().fehlwuerfe).toBe(2);
    // GEGENPROBE: richtig hineingeworfen und wieder herausgeholt zaehlt nicht mehr
    a.wirf(2, "c_steel");
    expect(a.staende.at(-1)!.zaehler!.ist).toBe(2);
    a.raus(2);
    a.lauf.takt(1);
    expect(a.staende.at(-1)!.zaehler!.ist).toBe(1);
    expect(a.ende()).toBeNull();
  });

  it("Sterne: ★ alle richtig · ★★ 4:00 und ≤ 1 Fehlwurf · ★★★ 2:30 und 0 — mit Gegenproben", () => {
    const M = { harteAufschlaege: 0, praezisionCm: null, ueberlasten: 0, fremdteile: 0 };
    const w = A3.wertung;
    expect(sterne(w, { ...M, zeitS: 150, fehlwuerfe: 0 })).toBe(3);
    expect(sterne(w, { ...M, zeitS: 151, fehlwuerfe: 0 })).toBe(2);
    expect(sterne(w, { ...M, zeitS: 100, fehlwuerfe: 1 })).toBe(2);
    expect(sterne(w, { ...M, zeitS: 240, fehlwuerfe: 2 })).toBe(1);
    expect(sterne(w, { ...M, zeitS: 241, fehlwuerfe: 0 })).toBe(1);
  });
});

describe("Aufgabe 3: am echten Platz mit dem echten Bagger", () => {
  it("sechs Teile in ihre Mulden, ohne zu fahren — MUELL zaehlt, die Mulde bleibt stehen", () => {
    const k = werkbank();
    const { lauf, obj } = starteAufgabe(k, A3);
    const jb = (): void => lauf.takt(DT);
    let ende: GameEvents["challenge:geschafft"] | null = null;
    k.bus.on("challenge:geschafft", (e) => (ende = e));
    const eingang: Array<GameEvents["itemEntered"]> = [];
    k.bus.on("itemEntered", (e) => eingang.push(e));
    const muell = k.containers.byId("r_rubble");
    const muell0 = { ...muell.ort };
    const koerperStart = koerperZahl(k.world);
    const ergebnis: string[] = [];
    TEILE.forEach((t, i) => {
      const it0 = obj.teile[i]!;
      const ziel = zielVon(t.name);
      const u = umkugelRadius(it0.shape!);
      const gefasst = greife(k, it0.body, jb);
      const a = abwurf(ziel, 1.0)!;
      if (gefasst) legeAb(k, () => it0.body.translation(), () => it0.body.translation().y - u, a, 2.6, jb);
      ergebnis.push(`${t.name}: ${gefasst ? "gefasst" : "NICHT gefasst"} → ${it0.containerId ?? "-"} (Soll ${ziel}), MUELL ${Math.hypot(muell.ort.x - muell0.x, muell.ort.z - muell0.z).toFixed(2)} m`);
    });
    for (let i = 0; i < 60 && !ende; i++) {
      k.takt();
      jb();
    }
    const versatz = Math.hypot(muell.ort.x - muell0.x, muell.ort.z - muell0.z);
    const physMittel = k.physMs.reduce((s, x) => s + x, 0) / k.physMs.length;
    // eslint-disable-next-line no-console
    console.log(
      `A3: ${ergebnis.join(" · ")}\n  MUELL versetzt ${versatz.toFixed(3)} m, itemEntered r_rubble: ${JSON.stringify(eingang.filter((e) => e.containerId === "r_rubble"))}\n` +
        `  Messung ${JSON.stringify((ende as GameEvents["challenge:geschafft"] | null)?.messung)}, Koerper Start ${JSON.stringify(koerperStart)}, Ende ${JSON.stringify(koerperZahl(k.world))}, Physik ${physMittel.toFixed(2)} ms/Schritt`
    );
    TEILE.forEach((t, i) => expect(obj.teile[i]!.containerId, t.name).toBe(zielVon(t.name)));
    expect(eingang.some((e) => e.containerId === "r_rubble" && e.correct && e.itemId === obj.teile[1]!.id), "Holzkiste nicht als richtig in MUELL gemeldet").toBe(true);
    expect(versatz, "die MUELL-Mulde wurde weggeschoben").toBeLessThan(0.1);
    expect(ende, "nicht geschafft").not.toBeNull();
    const e = ende as unknown as GameEvents["challenge:geschafft"];
    expect(e.messung.fehlwuerfe).toBe(0);
    expect(koerperStart.gesamt, "Physik-Last").toBeLessThanOrEqual(35);
  }, 240_000);
});
