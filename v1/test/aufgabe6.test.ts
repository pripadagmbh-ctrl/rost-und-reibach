/**
 * AUFGABE 6 „SCHWERE LAST" (G3, 20.10.2026) — das ausgeschlachtete
 * LKW-Wrack (Patrick 20.10.2026, Wahl B).
 *
 * Geprueft wird:
 *  1. das Wrack: ausgeschlachtet ueber `restoreState` (Teilnamen nach E-185),
 *     Masse 4,99 t ± 0,05, keine losen Teile;
 *  2. die Rechnung: Start ≤ 5,6 m (frei stehend hebbar), Ablagekreis
 *     ganz zwischen 6,5 und 8,2 m — mit Abstand zu beiden Traglastgrenzen
 *     (`nutzlastKg`, 4 990 kg: frei 5,61 m, mit Pratzen 8,68 m);
 *  3. die Lage: Start und Kreis frei (0,3 m Rand, mit Besenplatz), Start
 *     neben den Pratzen, beides im Bild;
 *  4. der Ablauf mit Attrappen: gehoben erst mit Unterkante ≥ 0,3 m,
 *     geschleift zaehlt nicht, Tipp erst nach Ueberlast OHNE Pratzen,
 *     Ueberlast-Meldungen dicht hintereinander = ein Versuch;
 *  5. der ganze Ablauf am ECHTEN Platz: greifen und heben ohne Pratzen,
 *     hinausfahren → Ueberlast und Tipp, Pratzen aus, hinaus, absetzen,
 *     loslassen — geschafft. GEGENPROBE: ohne Pratzen kommt das Wrack nicht
 *     in den Kreis. Beobachtet (nicht repariert, Bagger-Paket): wie tief das
 *     Wrack beim Zudruecken in den Beton sinkt (Befund M6).
 */
import { describe, it, expect, beforeAll } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { CHALLENGES } from "../src/challenges/katalog";
import { ChallengeLauf, UEBERLAST_PAUSE_S, WRACK_HUB_M, sterne, type ChallengeQuellen } from "../src/challenges/challenge";
import { aufbauKonflikte } from "../src/challenges/aufbau";
import { hoehenspanne } from "../src/challenges/quellen";
import { LKW_DEF } from "../src/dismantle/carDef";
import { nutzlastKg } from "../src/excavator/traglast";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";
import { PRATZE_X, PRATZE_Z } from "../src/excavator/unterwagenParts";
import { BAGGER_STAND, abstandVomStand } from "../src/world/baggerstand";
import { EventBus, type GameEvents } from "../src/core/events";
import { ecken, grundrissBelegt } from "./aufgabenplatz";
import { DT, GRAD, SCHWENK_R, SCHWENK_Y, bis, dreheAuf, koerperZahl, platzLeinwand, starteAufgabe, stelleArm, werkbank } from "./aufgabenwerkbank";

const A6 = CHALLENGES.find((c) => c.id === "schwere-last")!;
const WR = A6.aufbau.wracks![0]!;
const [HB, , HL] = LKW_DEF.colliderHalf;
const ZIEL = A6.ablageziel!;
const RADIUS = A6.ablageRadiusM!;

/** Bis zu welcher Ausladung die Maschine `kg` hebt (m) — dieselbe Tabelle wie der Bagger. */
function grenze(kg: number, abgestuetzt: boolean): number {
  let r = 3.7;
  while (r < 12 && nutzlastKg(r, FUENFSCHALEN.eigengewichtKg, 1, abgestuetzt) >= kg) r += 0.005;
  return r;
}

beforeAll(async () => {
  platzLeinwand();
  await RAPIER.init();
});

describe("Aufgabe 6: Wrack, Rechnung, Lage", () => {
  it("ausgeschlachtet: alle Teile ab (E-185-Namen), 4,99 t ± 0,05, keine losen Teile", () => {
    expect(WR).toMatchObject({ art: "lkw", ausgeschlachtet: true });
    expect(LKW_DEF.parts.map((p) => p.id).sort()).toEqual(["batterie", "engine", "sattel", "tank", "wheel_0", "wheel_1", "wheel_2", "wheel_3"]);
    const k = werkbank();
    const n0 = k.items.items.length;
    const { obj, lauf } = starteAufgabe(k, A6);
    lauf.beenden();
    bis(k, () => false, 30);
    const car = obj.wracks[0]!;
    expect(car.body.mass() / 1000).toBeCloseTo(4.99, 1);
    expect(Math.abs(car.body.mass() - 4990)).toBeLessThan(50);
    expect(car.teileDran, "ein Teil haengt noch dran").toEqual([]);
    expect(k.items.items.length - n0, "lose Teile beim Ausschlachten").toBe(1); // nur das Wrack selbst
    expect(aufbauKonflikte(A6)).toEqual([]);
  });

  it("Start nah (≤ 5,6 m, frei hebbar), Kreis weit (6,5–8,2 m) — mit Abstand zu beiden Grenzen", () => {
    const frei = grenze(LKW_DEF.hullMassKg, false);
    const mitPratzen = grenze(LKW_DEF.hullMassKg, true);
    const start = abstandVomStand(WR.x, WR.z);
    const ziel = abstandVomStand(ZIEL.x, ZIEL.z);
    // eslint-disable-next-line no-console
    console.log(
      `A6 Traglast fuer ${LKW_DEF.hullMassKg} kg: frei bis ${frei.toFixed(2)} m, mit Pratzen bis ${mitPratzen.toFixed(2)} m · ` +
        `Start ${start.toFixed(2)} m (Dach ${Math.hypot(start, 1.9).toFixed(2)} m), Kreis ${(ziel - RADIUS).toFixed(2)}–${(ziel + RADIUS).toFixed(2)} m`
    );
    expect(frei).toBeCloseTo(5.61, 1);
    expect(mitPratzen).toBeCloseTo(8.68, 1);
    expect(start).toBeLessThanOrEqual(5.6);
    expect(frei - start, "Start zu nah an der freien Grenze").toBeGreaterThan(0.5);
    expect(ziel - RADIUS).toBeGreaterThanOrEqual(6.5 - 1e-6);
    expect(ziel + RADIUS).toBeLessThanOrEqual(8.2 + 1e-6);
    expect(ziel - RADIUS - frei, "Kreis zu nah an der freien Grenze").toBeGreaterThan(0.8);
    expect(mitPratzen - (ziel + RADIUS), "Kreis zu nah an der Grenze mit Pratzen").toBeGreaterThan(0.4);
    // Zielmarke = Kreismitte am Boden
    expect(A6.zielMarke).toEqual({ x: ZIEL.x, y: 0, z: ZIEL.z });
  });

  it("frei: Start in jeder Lage, Kreis quer (wie es ankommt) — 0,3 m Rand, mit Besenplatz; Start neben den Pratzen", () => {
    expect(grundrissBelegt(WR.x, WR.z, WR.gier ?? 0, HB + 0.1, HL + 0.1, { rand: 0.3 }), "Start").toBe("");
    for (let d = 0; d < 180; d += 15) expect(grundrissBelegt(WR.x, WR.z, (WR.gier ?? 0) + d / GRAD, HB, HL, { rand: 0.3 }), `Start gedreht ${d}°`).toBe("");
    const w = Math.atan2(ZIEL.x - BAGGER_STAND.x, ZIEL.z - BAGGER_STAND.z);
    for (const [dr, dt] of [[0, 0], [RADIUS, 0], [-RADIUS, 0], [0, RADIUS], [0, -RADIUS]] as const) {
      const x = ZIEL.x + dr * Math.sin(w) + dt * Math.cos(w);
      const z = ZIEL.z + dr * Math.cos(w) - dt * Math.sin(w);
      // quer, wie es ankommt; in der Mitte auch 15° verdreht (am Aussenrand steht dann die Ostmauer 0,3 m nah)
      for (const d of dr === 0 && dt === 0 ? [-15, 0, 15] : [0]) expect(grundrissBelegt(x, z, w - Math.PI / 2 + d / GRAD, HB, HL, { rand: 0.3 }), `Kreis (${dr}|${dt}) ${d}°`).toBe("");
    }
    // Pratzenteller (PRATZE_X/Z, Blick +z): mindestens 0,8 m bis zur Wrackkante
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const px = BAGGER_STAND.x + sx * PRATZE_X;
        const pz = BAGGER_STAND.z + sz * PRATZE_Z;
        const e = ecken(WR.x, WR.z, WR.gier ?? 0, HB, HL);
        // Abstand Punkt → Rechteck ueber die lokale Lage
        const g = WR.gier ?? 0;
        const lx = (px - WR.x) * Math.cos(g) - (pz - WR.z) * Math.sin(g);
        const lz = (px - WR.x) * Math.sin(g) + (pz - WR.z) * Math.cos(g);
        const ab = Math.hypot(Math.max(Math.abs(lx) - HB, 0), Math.max(Math.abs(lz) - HL, 0));
        expect(ab, `Pratze ${sx}/${sz} (Ecken ${e.length})`).toBeGreaterThan(0.8);
      }
    const kamZ = BAGGER_STAND.z - 11 * Math.cos(0.42);
    expect(Math.abs(Math.atan2(WR.x - BAGGER_STAND.x, WR.z - kamZ) * GRAD)).toBeLessThan(30);
  });
});

describe("Aufgabe 6: der Ablauf mit Attrappen", () => {
  function attrappe() {
    const w = { griff: false, p: { x: WR.x, y: 0, z: WR.z }, unten: 0 };
    const koerper = { handle: 5, translation: () => w.p, isValid: () => true };
    const q: ChallengeQuellen = {
      gegriffen: () => (w.griff ? [koerper] : []),
      spinne: () => ({ x: 0, y: 5, z: 0 }),
      drehmitte: () => BAGGER_STAND,
      blickRad: () => 0,
      behaelter: () => null,
      ueberBehaelter: () => false,
      behaelterVon: () => null,
      ueberKammer: () => false,
      inKammer: () => false,
      hoehenspanne: () => ({ unten: w.unten, oben: w.unten + 3 }),
    };
    const bus = new EventBus();
    const staende: Array<GameEvents["challenge:stand"]> = [];
    const schritte: number[] = [];
    let ende: GameEvents["challenge:geschafft"] | null = null;
    bus.on("challenge:stand", (e) => staende.push(e));
    bus.on("challenge:schritt", (e) => schritte.push(e.nr));
    bus.on("challenge:geschafft", (e) => (ende = e));
    const lauf = new ChallengeLauf(A6, 6, q, bus, { teile: [], wracks: [{ body: koerper }] });
    lauf.start();
    const ueberlast = (abgestuetzt: boolean): void => bus.emit("greifer:ueberlast", { massKg: 4990, grenzeKg: 4800, ausladungM: 5.7, abgestuetzt });
    return { w, lauf, staende, schritte, ueberlast, ende: () => ende as GameEvents["challenge:geschafft"] | null };
  }
  const imKreis = { x: ZIEL.x, y: 0, z: ZIEL.z };

  it("gruener Kreis ab dem ersten Stand, gelbe Marke am Wrack nur bis zum Greifen (Patrick 20.10.2026, G4)", () => {
    const a = attrappe();
    const ziel = { ...A6.zielMarke!, art: "ziel" };
    a.lauf.takt(1);
    expect(a.staende).toHaveLength(1);
    expect(a.staende[0]!.marken).toContainEqual(ziel);
    expect(a.staende[0]!.marken.filter((m) => m.art === "teil")).toHaveLength(1);
    a.w.griff = true;
    a.w.unten = 1.0;
    a.lauf.takt(1);
    expect(a.staende.at(-1)!.marken).toEqual([ziel]);
  });

  it("greifen → heben (Unterkante ≥ 0,3 m) → im Kreis absetzen → loslassen: geschafft", () => {
    const a = attrappe();
    a.lauf.takt(1);
    a.w.griff = true;
    a.w.unten = WRACK_HUB_M - 0.05;
    a.lauf.takt(1);
    expect(a.schritte, "zu wenig gehoben").toEqual([1, 2]);
    a.w.unten = WRACK_HUB_M + 0.2;
    a.lauf.takt(1);
    expect(a.schritte).toEqual([1, 2, 3]);
    a.w.p = imKreis;
    a.lauf.takt(1);
    a.w.unten = 0.02; // im Kreis aufgesetzt, noch gefasst
    a.lauf.takt(1);
    expect(a.ende(), "gefasst zaehlt nicht").toBeNull();
    a.w.griff = false;
    a.lauf.takt(1);
    expect(a.ende()).not.toBeNull();
    expect(a.ende()!.messung.harteAufschlaege).toBe(0);
  });

  it("GEGENPROBE: geschleift zaehlt nicht — gehoben, ausserhalb aufgesetzt, am Boden in den Kreis gezogen", () => {
    const a = attrappe();
    a.w.griff = true;
    a.w.unten = 1.0;
    a.lauf.takt(1);
    a.w.unten = 0.0; // ausserhalb des Kreises wieder aufgesetzt
    a.lauf.takt(1);
    a.w.p = imKreis; // am Boden hineingeschleift
    a.lauf.takt(1);
    a.w.griff = false;
    a.lauf.takt(1);
    expect(a.ende()).toBeNull();
    // und nie gehoben, nur geschleift
    const b = attrappe();
    b.w.griff = true;
    b.lauf.takt(1);
    b.w.p = imKreis;
    b.lauf.takt(1);
    b.w.griff = false;
    b.lauf.takt(1);
    expect(b.ende()).toBeNull();
  });

  it("Tipp erst nach Ueberlast OHNE Pratzen; dicht folgende Meldungen sind ein Versuch", () => {
    const a = attrappe();
    a.lauf.takt(1);
    expect(a.staende.at(-1)!.tipp).toBeNull();
    a.ueberlast(true); // mit Pratzen: kein Tipp
    a.lauf.takt(1);
    expect(a.staende.at(-1)!.tipp).toBeNull();
    a.lauf.takt(UEBERLAST_PAUSE_S + 0.1);
    a.ueberlast(false);
    a.ueberlast(false); // gleicher Druck, flackert
    a.lauf.takt(0.1);
    a.ueberlast(false);
    a.lauf.takt(1);
    expect(a.staende.at(-1)!.tipp).toEqual(A6.tippNachUeberlast);
    expect(a.lauf.messung().ueberlasten).toBe(2);
  });

  it("Sterne: ★★ unter 3:00 · ★★★ unter 2:00 und hoechstens eine Ueberlast", () => {
    const M = { fehlwuerfe: 0, harteAufschlaege: 1, praezisionCm: null, fremdteile: 0 };
    expect(sterne(A6.wertung, { ...M, zeitS: 110, ueberlasten: 1 })).toBe(3);
    expect(sterne(A6.wertung, { ...M, zeitS: 110, ueberlasten: 2 })).toBe(2);
    expect(sterne(A6.wertung, { ...M, zeitS: 181, ueberlasten: 0 })).toBe(1);
  });
});

/** Gemeinsamer Anfang am echten Platz: greifen und heben ohne Pratzen. */
function greifenUndHeben() {
  const k = werkbank();
  const { lauf, obj } = starteAufgabe(k, A6);
  const car = obj.wracks[0]!;
  const jb = (): void => lauf.takt(DT);
  const schritte: number[] = [1];
  let ende: GameEvents["challenge:geschafft"] | null = null;
  let tipp: GameEvents["challenge:stand"]["tipp"] = null;
  k.bus.on("challenge:schritt", (e) => schritte.push(e.nr));
  k.bus.on("challenge:geschafft", (e) => (ende = e));
  k.bus.on("challenge:stand", (e) => (tipp = e.tipp));
  const sp = (): { unten: number; oben: number } => hoehenspanne(car.body)!;
  const wrackR = (): number => abstandVomStand(car.body.translation().x, car.body.translation().z);
  let sinkMax = 0;
  const jbs = (): void => {
    jb();
    sinkMax = Math.max(sinkMax, -sp().unten);
  };
  const koerperStart = koerperZahl(k.world);
  const p = car.body.translation();
  const m = k.b.position;
  stelleArm(k, SCHWENK_R, SCHWENK_Y, jbs);
  dreheAuf(k, Math.atan2(p.x - m.x, p.z - m.z), jbs);
  stelleArm(k, wrackR(), 3.0, jbs);
  stelleArm(k, wrackR(), 0.8, jbs, [], () => k.b.armBlocked);
  k.tasten.down.clear();
  k.tasten.down.add("KeyF");
  bis(k, () => false, 20, jbs);
  k.tasten.down.clear();
  k.tasten.down.add("Space");
  bis(k, () => false, 90, jbs);
  const griffAusladung = k.b.ausladungM;
  const gefasst = k.grip.grippedBodies.some((b) => b.handle === car.body.handle);
  k.tasten.down.add("KeyR");
  bis(k, () => sp().unten > 0.6, 300, jbs);
  k.tasten.down.delete("KeyR");
  bis(k, () => false, 30, jbs);
  const ueberlastBeimHeben = k.ueberlasten.length;
  return {
    k, lauf, car, jbs, sp, wrackR, schritte, koerperStart, griffAusladung, gefasst, ueberlastBeimHeben,
    ende: () => ende as GameEvents["challenge:geschafft"] | null,
    tipp: () => tipp,
    sinkMax: () => sinkMax,
  };
}

describe("Aufgabe 6: am echten Platz mit dem echten Bagger (Messung)", () => {
  it("ohne Pratzen greifen und heben, hinaus → Ueberlast + Tipp; Pratzen aus, in den Kreis, ablegen: geschafft", () => {
    const d = greifenUndHeben();
    const { k, jbs, sp } = d;
    expect(d.gefasst, "Wrack nicht gefasst").toBe(true);
    expect(d.ueberlastBeimHeben, "schon beim Heben Ueberlast — Start zu weit").toBe(0);
    expect(d.schritte).toEqual([1, 2, 3]);
    // hinaus ohne Pratzen: 1,5 s Ausleger weg
    const n0 = k.ueberlasten.length;
    const t0 = d.lauf.zeitS;
    k.tasten.down.add("KeyT");
    bis(k, () => false, 90, jbs);
    k.tasten.down.delete("KeyT");
    bis(k, () => false, 30, jbs);
    const meldungen = k.ueberlasten.slice(n0);
    const ueberlastBei = meldungen[0]?.ausladungM ?? NaN;
    const tippDa = d.tipp() !== null;
    const gezaehlt = d.lauf.messung().ueberlasten;
    // Pratzen aus (Taste O / Kranz STUETZEN)
    k.b.toggleOutriggers();
    bis(k, () => k.b.abgestuetzt, 300, jbs);
    bis(k, () => false, 30, jbs);
    // Gelenk ueber den Kreis: das Wrack haengt ~0,25 m innerhalb des Gelenks — nachmessen und nachziehen
    const zielR = abstandVomStand(ZIEL.x, ZIEL.z);
    let gR = zielR + 0.25;
    for (let i = 0; i < 3; i++) {
      stelleArm(k, gR, Math.max(k.b.grappleGroup.position.y, 4.8), jbs, ["Space"]);
      /*
       * G5: Erst auspendeln lassen, dann messen — sonst jagt die Korrektur
       * dem Pendel nach (gemessen: 7,34 m bei Ziel 7,35, dann 6,80 und 8,12;
       * das freie Pendel braucht rund 4 s, E-132). Liegt das Wrack ueber dem
       * Kreis, nicht weiter nachziehen.
       */
      k.tasten.down.clear();
      k.tasten.down.add("Space");
      bis(k, () => false, 240, jbs);
      if (Math.abs(zielR - d.wrackR()) < 0.25) break;
      gR += zielR - d.wrackR();
    }
    const gelenkUeberZiel = k.b.ausladungM;
    const n1 = k.ueberlasten.length;
    // absetzen: Hoehe herunter bei gleicher Ausladung, bis es aufsitzt
    stelleArm(k, k.b.ausladungM, 2.0, jbs, ["Space"], () => sp().unten <= 0.05);
    bis(k, () => false, 30, jbs);
    k.tasten.down.clear();
    bis(k, () => d.ende() !== null, 300, jbs);
    const e = d.ende();
    // eslint-disable-next-line no-console
    console.log(
      `A6: Griff bei ${d.griffAusladung.toFixed(2)} m ohne Ueberlast · hinaus ohne Pratzen: ${meldungen.length} Meldung(en) ab ${ueberlastBei.toFixed(2)} m ` +
        `(${meldungen.map((m) => `${m.ausladungM.toFixed(2)}/${(m.grenzeKg / 1000).toFixed(2)} t`).join(", ")}), gezaehlt ${gezaehlt}, Tipp ${tippDa} · ` +
        `mit Pratzen Gelenk ${gelenkUeberZiel.toFixed(2)} m, Wrack ${d.wrackR().toFixed(2)} m, weitere Meldungen ${k.ueberlasten.length - n1} · ` +
        `im Beton beim Zudruecken bis ${(d.sinkMax() * 100).toFixed(0)} cm (Befund M6) · Messung ${JSON.stringify(e?.messung)} ${e?.sterne} Sterne · ` +
        `Koerper ${JSON.stringify(d.koerperStart)}, Zeit ab Hinausfahren ${(d.lauf.zeitS - t0).toFixed(0)} s`
    );
    expect(meldungen.length, "ohne Pratzen keine Ueberlast").toBeGreaterThan(0);
    expect(ueberlastBei).toBeGreaterThan(5.3);
    expect(ueberlastBei).toBeLessThan(5.9);
    expect(tippDa, "Tipp fehlt nach der Ueberlast").toBe(true);
    expect(gezaehlt, "ein Druck, eine Ueberlast").toBe(1);
    expect(e, "nicht abgelegt").not.toBeNull();
    expect(d.schritte).toEqual([1, 2, 3]);
    expect(e!.messung.ueberlasten).toBe(1);
    expect(d.koerperStart.gesamt).toBeLessThanOrEqual(30);
  }, 300_000);

  it("GEGENPROBE: ohne Pratzen kommt das Wrack nicht in den Kreis — weder hinausfahren noch Hauptarm senken", () => {
    const d = greifenUndHeben();
    const { k, jbs } = d;
    for (let i = 0; i < 6; i++) {
      k.tasten.down.clear();
      k.tasten.down.add("Space");
      k.tasten.down.add(i % 2 ? "KeyF" : "KeyT");
      bis(k, () => false, 60, jbs);
    }
    k.tasten.down.clear();
    bis(k, () => false, 180, jbs);
    // eslint-disable-next-line no-console
    console.log(`A6 Gegenprobe: Wrack ${d.wrackR().toFixed(2)} m (Kreis ab ${(abstandVomStand(ZIEL.x, ZIEL.z) - RADIUS).toFixed(2)} m), Meldungen ${k.ueberlasten.length}`);
    expect(d.wrackR()).toBeLessThan(abstandVomStand(ZIEL.x, ZIEL.z) - RADIUS);
    expect(d.ende()).toBeNull();
  }, 300_000);
});
