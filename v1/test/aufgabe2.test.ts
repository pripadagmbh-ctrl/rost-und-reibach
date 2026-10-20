/**
 * AUFGABE 2 „AUTO IN DIE PRESSE" (G3, 20.10.2026) — neuer Standort schraeg
 * vorn, Zielmarke an der Kammer, und die Messung zum harten Aufschlag.
 *
 * Geprueft wird:
 *  1. die Lage: Der Pkw steht vorn im ersten Bild, im Schwenkband, sein
 *     Grundriss frei von Behaeltern, MUELL-Mulde, Mauern (E-182), Presse und
 *     Besenplatz; das Dach liegt auf der Ausladung, auf der die Spinne beim
 *     reinen Senken aufsetzt;
 *  2. der ganze Ablauf am ECHTEN Platz mit dem echten Bagger: drehen,
 *     senken, zudruecken (es reisst NICHTS ab, E-185), heben, schwenken,
 *     zentrieren, langsam absetzen, oeffnen, PRESSEN — vier Schritte,
 *     geschafft, kein harter Aufschlag;
 *  3. die Messung (Auftrag G3): Fallenlassen aus Wandhoehe der Presse ist
 *     ein harter Aufschlag (`HART_AB_MS`), langsames Absetzen nicht;
 *  4. Marken: erst das Wrack, gefasst die Kammer.
 */
import { describe, it, expect, beforeAll } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { CHALLENGES } from "../src/challenges/katalog";
import { HART_AB_MS, type ChallengeQuellen } from "../src/challenges/challenge";
import { hoehenspanne } from "../src/challenges/quellen";
import { aufbauKonflikte } from "../src/challenges/aufbau";
import { CAR_DEF } from "../src/dismantle/carDef";
import { PRESS_CENTER, pressWaende } from "../src/world/press";
import { BAGGER_STAND, SCHWENK_AUSSEN, SCHWENK_INNEN, abstandVomStand } from "../src/world/baggerstand";
import { EventBus, type GameEvents } from "../src/core/events";
import { ChallengeLauf } from "../src/challenges/challenge";
import { grundrissBelegt } from "./aufgabenplatz";
import { DT, GRAD, bis, dreheAuf, fuehreUeber, koerperZahl, platzLeinwand, setzeAb, starteAufgabe, stelleArm, werkbank } from "./aufgabenwerkbank";

const A2 = CHALLENGES.find((c) => c.id === "verladen")!;
const WRACK = A2.aufbau.wracks![0]!;
const [HALB_B, , HALB_L] = CAR_DEF.colliderHalf;
const KRONE = Math.max(...pressWaende().map((w) => w.top));

beforeAll(async () => {
  platzLeinwand();
  await RAPIER.init();
});

describe("Aufgabe 2: wo das Wrack steht", () => {
  it("id bleibt „verladen“ (gespeicherte Sterne), an zweiter Stelle, Pkw, Fuenfschalengreifer", () => {
    expect(CHALLENGES[1]!.id).toBe("verladen");
    expect(WRACK.art).toBe("pkw");
    expect(A2.aufbau.greifer).toBe("fuenfschalen");
    expect(aufbauKonflikte(A2)).toEqual([]);
  });

  it("vorn im ersten Bild, nicht geradeaus, im Schwenkband", () => {
    const w = Math.atan2(WRACK.x - BAGGER_STAND.x, WRACK.z - BAGGER_STAND.z) * GRAD;
    const r = abstandVomStand(WRACK.x, WRACK.z);
    const kamZ = BAGGER_STAND.z - 11 * Math.cos(0.42); // Kamera wie in test/aufgabe1.test.ts
    const imBild = Math.atan2(WRACK.x - BAGGER_STAND.x, WRACK.z - kamZ) * GRAD;
    // eslint-disable-next-line no-console
    console.log(`Wrack ${w.toFixed(1)}° neben der Blickrichtung, ${r.toFixed(2)} m, von der Kamera ${imBild.toFixed(1)}°`);
    expect(Math.abs(w)).toBeGreaterThan(6); // Drehen nicht geschenkt (BLICK_TOLERANZ_RAD)
    expect(Math.abs(w)).toBeLessThan(30);
    expect(Math.abs(imBild)).toBeLessThan(20);
    expect(r).toBeGreaterThanOrEqual(SCHWENK_INNEN);
    expect(r).toBeLessThanOrEqual(SCHWENK_AUSSEN);
  });

  it("Grundriss frei: Behaelter, MUELL-Mulde, Mauern samt E-182, Presse, Besenplatz — 0,3 m Rand", () => {
    // Pkw-Kollider plus 0,1 m fuer Spiegel und Stossfaenger (`CAR_DEF.karosserie.anbau`)
    const frei = grundrissBelegt(WRACK.x, WRACK.z, WRACK.gier ?? 0, HALB_B + 0.1, HALB_L + 0.1, { rand: 0.3 });
    expect(frei, `Wrack steht in ${frei}`).toBe("");
    // Spuren und Abkippstelle: in Aufgaben faehrt kein Laster (main.ts) — nur festgehalten
    const betrieb = grundrissBelegt(WRACK.x, WRACK.z, WRACK.gier ?? 0, HALB_B + 0.1, HALB_L + 0.1, { rand: 0.3, betrieb: true });
    // eslint-disable-next-line no-console
    console.log(`mit Fahrspuren: ${betrieb || "frei"}`);
  });

  it("das Dach liegt dort, wo die Spinne beim reinen Senken aufsetzt (8,13 m, Aufgabe 1); Schnauze zum Bagger", () => {
    const kabineZ = CAR_DEF.karosserie.kabineZ * HALB_L; // Anteil der halben Laenge → m
    const g = WRACK.gier ?? 0;
    const dach = { x: WRACK.x + kabineZ * Math.sin(g), z: WRACK.z + kabineZ * Math.cos(g) };
    expect(abstandVomStand(dach.x, dach.z)).toBeCloseTo(8.13, 0);
    // lokales +z (Schnauze) zeigt zum Bagger: Haube hat seit E-185 Vorrang beim Greifen
    const vorn = { x: WRACK.x + Math.sin(g), z: WRACK.z + Math.cos(g) };
    expect(abstandVomStand(vorn.x, vorn.z)).toBeLessThan(abstandVomStand(WRACK.x, WRACK.z));
  });

  it("Ziel ist die Kammermitte, die Marke sitzt auf ihrer Krone", () => {
    expect(A2.ablageziel).toEqual({ x: PRESS_CENTER.x, z: PRESS_CENTER.z });
    expect(A2.zielMarke).toEqual({ x: PRESS_CENTER.x, y: KRONE, z: PRESS_CENTER.z });
    expect(A2.zielBehaelter, "ein Zielbehaelter verlegte die Praezision weg von der Kammer").toBeUndefined();
  });
});

describe("Aufgabe 2: Marken mit Attrappen", () => {
  it("erst das Wrack (Dachhoehe), gefasst die Kammer, in der Kammer keine gelbe mehr", () => {
    const st = { gegriffen: false, drin: false };
    const koerper = { handle: 7, translation: () => ({ x: WRACK.x, y: 0, z: WRACK.z }), isValid: () => true };
    const q: ChallengeQuellen = {
      gegriffen: () => (st.gegriffen ? [koerper] : []),
      spinne: () => ({ x: 0, y: 5, z: 0 }),
      drehmitte: () => BAGGER_STAND,
      blickRad: () => 0,
      behaelter: () => null,
      ueberBehaelter: () => false,
      behaelterVon: () => null,
      ueberKammer: () => st.drin,
      inKammer: () => st.drin,
      hoehenspanne: () => ({ unten: 0, oben: 1.41 }),
    };
    const bus = new EventBus();
    const staende: Array<GameEvents["challenge:stand"]> = [];
    bus.on("challenge:stand", (e) => staende.push(e));
    const l = new ChallengeLauf(A2, 2, q, bus, { teile: [], wracks: [{ body: koerper }] });
    l.start();
    l.takt(1);
    expect(staende.at(-1)!.marken).toEqual([{ x: WRACK.x, y: 1.41, z: WRACK.z, art: "teil" }]);
    st.gegriffen = true;
    l.takt(1);
    expect(staende.at(-1)!.marken).toEqual([{ ...A2.zielMarke!, art: "ziel" }]);
    st.gegriffen = false;
    st.drin = true;
    l.takt(1);
    expect(staende.at(-1)!.marken).toEqual([]);
    expect(staende.at(-1)!.pressenBereit).toBe(true);
  });
});

describe("Aufgabe 2: Fallhoehe als harter Aufschlag (Attrappen)", () => {
  function lauf() {
    const st = { griff: true, unten: 2.0 };
    const koerper = { handle: 7, translation: () => ({ x: 0, y: 0, z: 0 }), isValid: () => true };
    const q: ChallengeQuellen = {
      gegriffen: () => (st.griff ? [koerper] : []),
      spinne: () => ({ x: 0, y: 5, z: 0 }),
      drehmitte: () => BAGGER_STAND,
      blickRad: () => 0,
      behaelter: () => null,
      ueberBehaelter: () => false,
      behaelterVon: () => null,
      ueberKammer: () => false,
      inKammer: () => false,
      hoehenspanne: () => ({ unten: st.unten, oben: st.unten + 1.4 }),
    };
    const bus = new EventBus();
    const l = new ChallengeLauf(A2, 2, q, bus, { teile: [], wracks: [{ body: koerper }] });
    l.start();
    l.takt(DT);
    const schlag = (wucht: number): void =>
      bus.emit("schrott:aufprall", { materialId: "steel", massKg: 950, wucht, blech: true, untergrund: "beton", handle: 7, x: 0, y: 0, z: 0 });
    return { st, l, schlag };
  }

  it("aus 2 m losgelassen: ein harter Aufschlag — auch wenn der Melder nur 2,8 m/s sieht", () => {
    const a = lauf();
    a.st.griff = false;
    a.l.takt(DT);
    a.st.unten = 0.3;
    a.schlag(2.8);
    a.l.takt(DT);
    expect(a.l.messung().harteAufschlaege, "schon waehrend des Falls in der Messung").toBe(1);
    for (let i = 0; i < 150; i++) a.l.takt(DT);
    expect(a.l.messung().harteAufschlaege).toBe(1);
  });

  it("aufgesetzt losgelassen: kein harter Aufschlag; hart gemeldet und hoch gefallen zaehlt einmal", () => {
    const a = lauf();
    a.st.unten = 0.25;
    a.l.takt(DT);
    a.st.griff = false;
    a.l.takt(DT);
    a.st.unten = 0.3;
    for (let i = 0; i < 150; i++) a.l.takt(DT);
    expect(a.l.messung().harteAufschlaege).toBe(0);
    // wieder gefasst, aus 3,5 m fallen gelassen: Melder sieht es (6,7) UND die Fallhoehe — eins
    a.st.griff = true;
    a.st.unten = 3.5;
    a.l.takt(DT);
    a.st.griff = false;
    a.l.takt(DT);
    a.st.unten = 0.3;
    a.schlag(6.7);
    a.schlag(9.4);
    for (let i = 0; i < 150; i++) a.l.takt(DT);
    expect(a.l.messung().harteAufschlaege).toBe(1);
  });
});

/**
 * Der ganze Ablauf am echten Platz. `ablegen`: langsam absetzen oder aus
 * Wandhoehe fallen lassen. `griff`: mit vollem Tempo aufs Dach (die Spinne
 * schlaegt auf und knautscht es, E-187) oder sanft (F nur jedes vierte Bild).
 */
function durchlauf(ablegen: "absetzen" | "fallen", griff: "voll" | "sanft" = "voll") {
  const k = werkbank();
  const { lauf, obj } = starteAufgabe(k, A2);
  const car = obj.wracks[0]!;
  const schritte: number[] = [1];
  let ende: GameEvents["challenge:geschafft"] | null = null;
  k.bus.on("challenge:schritt", (e) => schritte.push(e.nr));
  k.bus.on("challenge:geschafft", (e) => (ende = e));
  const jb = (): void => lauf.takt(DT);
  const spanne = (): { unten: number; oben: number } => hoehenspanne(car.body)!;
  const koerperStart = koerperZahl(k.world);
  // 1 — drehen, senken, zudruecken
  const p0 = car.body.translation();
  dreheAuf(k, Math.atan2(p0.x - BAGGER_STAND.x, p0.z - BAGGER_STAND.z), jb);
  bis(k, () => false, 60, jb);
  let bild = 0;
  bis(k, () => k.b.armBlocked, 1200, () => {
    k.tasten.down.clear();
    if (griff === "voll" || bild++ % 4 === 0) k.tasten.down.add("KeyF");
    jb();
  });
  k.tasten.down.clear();
  k.tasten.down.add("KeyF");
  bis(k, () => false, 20, jb);
  k.tasten.down.clear();
  const knautschVorGriff = car.knautschgrad;
  const ausladungGriff = k.b.ausladungM;
  k.tasten.down.add("Space");
  bis(k, () => false, 90, jb);
  const gefasst = k.grip.grippedBodies.some((g) => g.handle === car.body.handle);
  const abrisseBeimGreifen = k.abrisse.length;
  // 2 — heben, zur Presse, ueber die Kammermitte
  k.tasten.down.add("KeyR");
  bis(k, () => spanne().unten >= 3.0, 300, jb);
  k.tasten.down.delete("KeyR");
  dreheAuf(k, Math.atan2(PRESS_CENTER.x - BAGGER_STAND.x, PRESS_CENTER.z - BAGGER_STAND.z), jb, ["Space"]);
  /*
   * G6: Erst auspendeln lassen, dann nachmessen und nachziehen — wie E-188 in
   * `aufgabe6.test.ts`. Gemessen (G6, 21.10.2026): Wer gleich nach dem
   * Zentrieren absenkt, laesst ein schwingendes Wrack hinunter — einmal
   * 0,89 m neben der Mitte statt 0,14, und es blieb auf Westwand und offener
   * Klappe liegen (Unterkante 1,95 m).
   */
  let versatz = fuehreUeber(k, () => car.body.translation(), PRESS_CENTER, () => spanne().unten, KRONE + 0.3, jb);
  for (let i = 0; i < 3; i++) {
    k.tasten.down.clear();
    k.tasten.down.add("Space");
    bis(k, () => false, 240, jb); // das freie Pendel braucht rund 4 s (E-132)
    const p = car.body.translation();
    versatz = Math.hypot(p.x - PRESS_CENTER.x, p.z - PRESS_CENTER.z);
    if (versatz < 0.15) break;
    fuehreUeber(k, () => car.body.translation(), PRESS_CENTER, () => spanne().unten, KRONE + 0.3, jb);
  }
  // 3 — ablegen
  const harteVorher = k.aufpralle.filter((a) => a.handle === car.body.handle && a.wucht >= HART_AB_MS).length;
  const n0 = k.aufpralle.length;
  if (ablegen === "absetzen") {
    /*
     * G6: SENKRECHT hinunter — gleiche Ausladung, Hauptarm und Ausleger
     * zusammen, bis die Unterkante 0,8 m ueber dem Boden ist; erst dann wird
     * getippt (`setzeAb`). Nur mit F zu senken faehrt den Arm dabei aus: Das
     * Wrack wanderte von der Krone bis 1,1 m um 0,44 m auf die Westwand zu,
     * laengs, wo ihm quer in der Kammer nur 0,37/0,42 m Luft bleiben, und
     * streifte die Krone mit vollem Senktempo (3,4 m/s → 6,8, hart).
     */
    const ueberUnterkante = k.b.grappleGroup.position.y - spanne().unten;
    stelleArm(k, k.b.ausladungM, ueberUnterkante + 0.8, jb, ["Space"], () => spanne().unten <= 0.8);
    setzeAb(k, () => spanne().unten, jb);
  }
  const untenBeimLoslassen = spanne().unten;
  k.tasten.down.clear();
  bis(k, () => false, 240, jb);
  const wucht = Math.max(0, ...k.aufpralle.slice(n0).filter((a) => a.handle === car.body.handle).map((a) => a.wucht));
  // 4 — pressen (der Knopf PRESSEN macht in main.ts genau das)
  const bereit = lauf.pressenBereit;
  k.press.onStart = () => k.fahrkunst.jetztLiegtSie();
  k.press.onStamp = () => lauf.presseHatGestempelt();
  const gestartet = lauf.pressenErlaubt() && k.press.start();
  bis(k, () => ende !== null, 900, jb);
  return {
    k, lauf, schritte, gefasst, abrisseBeimGreifen, ausladungGriff, versatz, harteVorher, untenBeimLoslassen, wucht, bereit, gestartet, knautschVorGriff,
    ende: ende as GameEvents["challenge:geschafft"] | null,
    koerperStart,
  };
}

describe("Aufgabe 2: am echten Platz mit dem echten Bagger", () => {
  /*
   * G6 (21.10.2026): ★★★ in beiden Griffarten. Mit vollem Tempo aufs Dach
   * knautscht der Aufschlag das Wrack schon vor dem Biss (E-187, Grad 0,057);
   * es passt trotzdem quer in die Kammer (0,35/0,44 m Luft gegen 0,38/0,45
   * sanft gegriffen). Fuenf um ±10 cm verschobene Zentrierziele je Griff:
   * 10 von 10 ★★★, Praezision 8–25 cm, Melder hoechstens 3,3 m/s.
   */
  it.each(["voll", "sanft"] as const)("Griff %s: drehen, senken, zu, heben, schwenken, absetzen, PRESSEN — nichts reisst ab, kein harter Aufschlag, ★★★", (griff) => {
    const d = durchlauf("absetzen", griff);
    const physMittel = d.k.physMs.reduce((a, b) => a + b, 0) / d.k.physMs.length;
    // eslint-disable-next-line no-console
    console.log(
      `A2 absetzen, Griff ${griff}: Knautschgrad vor dem Biss ${d.knautschVorGriff.toFixed(3)}, ` +
        `Griff bei ${d.ausladungGriff.toFixed(2)} m, Versatz ueber der Kammer ${d.versatz.toFixed(2)} m, ` +
        `losgelassen ${d.untenBeimLoslassen.toFixed(2)} m, Wucht ${d.wucht.toFixed(2)} m/s, Schritte ${d.schritte.join(",")}, ` +
        `Messung ${JSON.stringify(d.ende?.messung)}, ${d.ende?.sterne} Sterne · Koerper Start ${JSON.stringify(d.koerperStart)}, ` +
        `Ende ${JSON.stringify(koerperZahl(d.k.world))}, Physik ${physMittel.toFixed(2)} ms/Schritt`
    );
    expect(d.gefasst, "die Spinne fasst das Wrack am Dach nicht").toBe(true);
    expect(d.abrisseBeimGreifen, "beim Greifen am Dach reisst etwas ab (E-185)").toBe(0);
    expect(d.versatz).toBeLessThan(0.3);
    expect(d.bereit, "Knopf PRESSEN fehlt").toBe(true);
    expect(d.gestartet).toBe(true);
    expect(d.ende, "nicht geschafft").not.toBeNull();
    expect(d.schritte).toEqual([1, 2, 3, 4]);
    expect(d.wucht, "langsam abgesetzt und doch hart").toBeLessThan(HART_AB_MS);
    expect(d.ende!.messung.harteAufschlaege).toBe(0);
    expect(d.ende!.messung.praezisionCm).not.toBeNull();
    expect(d.ende!.messung.praezisionCm!).toBeLessThanOrEqual(A2.wertung.drei.praezisionCm!);
    expect(d.ende!.sterne, "sauber abgesetzt und mittig, und doch kein ★★★").toBe(3);
    if (griff === "voll") expect(d.knautschVorGriff, "voller Aufschlag aufs Dach knautscht (E-187)").toBeGreaterThan(0);
    else expect(d.knautschVorGriff).toBe(0);
    expect(d.koerperStart.gesamt, "Physik-Last der Aufgabe").toBeLessThanOrEqual(30);
  }, 120_000);

  /*
   * Die Messung zur Schwelle (Kopf von `challenge.ts`): Aus der Wandkrone
   * meldet der Aufprall-Melder das 950-kg-Wrack nur mit 2,6–2,9 m/s, obwohl
   * es mit rund 6 m/s auftrifft — gezaehlt wird es ueber die Fallhoehe.
   */
  it("MESSUNG: aus Wandhoehe fallen gelassen ist hart — ueber die Fallhoehe, der Melder allein saehe es nicht", () => {
    const d = durchlauf("fallen");
    // eslint-disable-next-line no-console
    console.log(
      `A2 fallen: losgelassen ${d.untenBeimLoslassen.toFixed(2)} m (Krone ${KRONE.toFixed(2)} m), Melder ${d.wucht.toFixed(2)} m/s ` +
        `(Schwelle ${HART_AB_MS}), harte Aufschlaege ${d.ende?.messung.harteAufschlaege}, ${d.ende?.sterne} Sterne`
    );
    expect(d.untenBeimLoslassen).toBeGreaterThanOrEqual(KRONE - 0.05);
    expect(d.ende!.messung.harteAufschlaege).toBe(1);
    expect(d.ende!.sterne).toBeLessThan(3);
  }, 120_000);
});
