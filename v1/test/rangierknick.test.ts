import { describe, it, expect } from "vitest";
/**
 * KEIN FAHRZEUG SPRINGT, KEINES DREHT SICH AUF DER STELLE — und keines faehrt
 * durch eine Mauer.
 *
 * DIE GESCHICHTE IN ZWEI SCHRITTEN.
 *
 *   E-073/E-084  `placeAt` setzte die Gier hart: bis 168,7 Grad in EINEM
 *                Rechenschritt, die Umrissecke sprang 10,23 m — der Katapult
 *                an der Lenkung. Repariert mit begrenzter Drehrate.
 *   E-140        Die begrenzte Drehrate drehte den Wagen trotzdem um seine
 *                Mitte, auch im Stand (Patrick: „lkws drehen sich
 *                unrealistisch um ihren mittelpunkt"). Jetzt faehrt jeder
 *                Wagen das Einspurmodell aus `lenkung.ts`: Drehung nur aus
 *                Fahrt und Lenkeinschlag, Kehren als Rangierzug
 *                (`rangierplan.ts`).
 *
 * DIESER WAECHTER FAEHRT JEDEN FAHRPLAN AB (`test/strecken.ts`, Lkw und
 * Gespann) und prueft, jedes mit Gegenprobe:
 *
 *   1. Kein Rechenschritt dreht mehr als ein Grad, keine Ecke springt.
 *   2. Kein Wagen faehrt einen engeren Kreis, als seine Achsen erlauben.
 *   3. Keiner dreht sich im Stand.
 *   4. Keiner faehrt in ein Bauwerk (mit Muellcontainer, Wrack und Bagger
 *      an ihren Startplaetzen), keiner bleibt stecken, jeder haelt dort, wo
 *      seine Strecke endet.
 *
 * Die Gegenprobe kostet keinen nachgebauten Fehler: `lenkrate = Infinity` IST
 * der alte Sprungzustand.
 */
import { fahrplaene } from "./strecken";
import { fahre, fahrwerkFuer, ALT, NEU, type Fahrt } from "./knicklauf";
import { mindestens } from "./zahl";
import { lkwFahrwerk } from "../src/delivery/vehicleModel";
import { ursprungVorAchse } from "../src/delivery/umriss";
import {
  folgeSchritt,
  lenkeEin,
  rolle,
  wendeRadius,
  winkelRest,
  LENK_MAX,
  LENK_RATE,
  type Lage,
} from "../src/delivery/lenkung";

/**
 * Wieviel Grad ein Rechenschritt hoechstens drehen darf: `LENK_RATE` rad/s
 * (4,8 m/s · tan 40° / 4,70 m) mal 1/60 s, mit 25 % Luft — 1,0 Grad.
 */
const MAX_GRAD = ((LENK_RATE * (180 / Math.PI)) / 60) * 1.25;

/** Wie weit die weiteste Umrissecke in einem Rechenschritt springen darf (m). */
const MAX_SPRUNG_M = 0.25;

/** Ab dieser Durchdringung steckt Blech in Beton (m) — `UMRISS_TOLERANZ`. */
const MAX_TIEFE_M = 0.01;

/**
 * So weit darf der Wagen am Ende einer Etappe neben ihrem Endpunkt stehen (m).
 * Gemessen hoechstens 0,41 m (Gespann, Warteplatz 3): Der Bahnfolger zieht in
 * der letzten Geraden nach, bis der Halt erreicht ist.
 */
const MAX_ENDE_M = 0.5;

let fahrtenNeu: Array<{ name: string; kind: string; f: Fahrt }> | null = null;
/** Alle Fahrplaene einmal mit dem gebauten Gesetz — teuer, deshalb gemerkt. */
function alleFahrten(): Array<{ name: string; kind: string; f: Fahrt }> {
  return (fahrtenNeu ??= fahrplaene().map((p) => ({ name: p.name, kind: p.kind, f: fahre(p, NEU) })));
}

describe("Das Einspurmodell auf jeder Strecke", () => {
  it("dreht auf keiner Strecke mehr als ein Grad je Rechenschritt", () => {
    const fahrten = alleFahrten();
    mindestens(fahrten.length, 100, "Fahrplaene");
    const schlimm = fahrten
      .filter(({ f }) => f.maxGrad > MAX_GRAD || f.maxSprungM > MAX_SPRUNG_M)
      .map(({ f }) => `${f.plan}: ${f.maxGrad.toFixed(2)} Grad, ${f.maxSprungM.toFixed(2)} m`);
    expect(schlimm, ["zu scharfe Knicke:", ...schlimm].join(" / ")).toEqual([]);
  });

  it("GEGENPROBE: derselbe Pruefcode meldet den alten Sprungzustand", () => {
    const plaene = fahrplaene().filter((p) => p.kind !== "pkw").slice(0, 17);
    let maxGrad = 0;
    let maxSprung = 0;
    let gemeldet = 0;
    for (const p of plaene) {
      const f = fahre(p, ALT);
      maxGrad = Math.max(maxGrad, f.maxGrad);
      maxSprung = Math.max(maxSprung, f.maxSprungM);
      if (f.maxGrad > MAX_GRAD || f.maxSprungM > MAX_SPRUNG_M) gemeldet++;
    }
    expect(gemeldet, "der alte Sprungzustand faellt nicht auf").toBe(plaene.length);
    // Auf den dichten Bogenstrecken seit E-140 sind die Ecken klein; der
    // alte Stand springt trotzdem zig Grad in einem Bild (gemessen 43).
    expect(maxGrad).toBeGreaterThan(20);
  });

  it("faehrt keinen engeren Kreis, als die Achsen erlauben", () => {
    const zuEng = alleFahrten()
      .filter(({ kind, f }) => f.minRadiusM < wendeRadius(fahrwerkFuer(kind)) * 0.99)
      .map(({ kind, f }) => `${f.plan}: ${f.minRadiusM.toFixed(2)} m < ${wendeRadius(fahrwerkFuer(kind)).toFixed(2)} m`);
    expect(zuEng, ["engerer Kreis als der Wendekreis:", ...zuEng].join(" / ")).toEqual([]);
  });

  it("GEGENPROBE: der alte Sprungzustand faehrt Ecken mit Radius null", () => {
    const p = fahrplaene().find((x) => x.name === "kipper zum Abladeplatz")!;
    expect(fahre(p, ALT).minRadiusM).toBeLessThan(1);
  });

  it("dreht sich nie im Stand", () => {
    const drehen = alleFahrten()
      .filter(({ f }) => f.standDrehGrad > 0)
      .map(({ f }) => `${f.plan}: ${f.standDrehGrad.toFixed(3)} Grad ohne Fahrt`);
    expect(drehen).toEqual([]);
  });

  it("faehrt durch kein Bauwerk, bleibt nicht stecken und haelt am Ende seiner Strecke", () => {
    const treffer: string[] = [];
    for (const { f } of alleFahrten()) {
      for (const a of f.anstoesse) {
        if (a.tiefeM > MAX_TIEFE_M) {
          treffer.push(`${a.tiefeM.toFixed(2)} m  ${a.etappe} | ${a.bauwerk} bei (${a.x.toFixed(1)} | ${a.z.toFixed(1)})`);
        }
      }
      for (const st of f.stecken) treffer.push(`steckt: ${st}`);
      if (f.maxEndAbweichungM > MAX_ENDE_M) {
        treffer.push(`${f.plan}: haelt ${f.maxEndAbweichungM.toFixed(2)} m neben dem Streckenende`);
      }
    }
    expect(treffer, ["Befunde:", ...treffer].join(" / ")).toEqual([]);
  });

  it("der Anhaenger knickt nie bis an die Deichsel", () => {
    const gespanne = alleFahrten().filter(({ kind }) => kind === "pkw");
    mindestens(gespanne.length, 10, "Gespann-Fahrplaene");
    for (const { f } of gespanne) {
      // Gemessen hoechstens 33 Grad; die Deichsel schlaegt bei 57 Grad an.
      expect(f.maxKnickGrad, f.plan).toBeLessThan(45);
      expect(f.maxKnickGrad, `${f.plan}: knickt gar nicht — rechnet der Anhaenger mit?`).toBeGreaterThan(5);
    }
  });
});

describe("Das Lenkgesetz selbst", () => {
  const lkw = fahrwerkFuer("pritsche");
  const gespann = fahrwerkFuer("pkw");

  it("ohne Fahrt keine Drehung — auch mit eingeschlagenen Raedern", () => {
    const l: Lage = { x: 0, z: 0, gier: 0.3, lenk: LENK_MAX, knick: 0.2 };
    rolle(l, gespann, 0);
    expect(l.gier).toBe(0.3);
    expect(l.knick).toBe(0.2);
    // Der Fahrer kurbelt im Stand: Lenkeinschlag aendert sich, Gier nicht.
    const m: Lage = { x: 0, z: 0, gier: 0, lenk: 0, knick: 0 };
    const quer: Array<[number, number]> = [[0, 0], [10, 0.5], [20, 1]];
    folgeSchritt(m, lkw, quer, 20, 0, false, 4.8, 1 / 60);
    expect(m.lenk).not.toBe(0);
    expect(m.gier).toBe(0);
  });

  it("faehrt mit vollem Einschlag genau den Wendekreis — vorwaerts wie rueckwaerts", () => {
    const r = wendeRadius(lkw);
    // 4,70 / tan 40° = 5,60 m (Herleitung in `lenkung.ts`)
    expect(r).toBeCloseTo(4.7 / Math.tan(LENK_MAX), 9);
    expect(r).toBeCloseTo(5.6, 1);
    for (const richtung of [1, -1]) {
      const l: Lage = { x: 0, z: 0, gier: 0, lenk: LENK_MAX, knick: 0 };
      const umfang = 2 * Math.PI * r;
      for (let i = 0; i < 1000; i++) rolle(l, lkw, (richtung * umfang) / 1000);
      // Einmal herum: wieder am Start, wieder in derselben Richtung
      expect(Math.hypot(l.x, l.z)).toBeLessThan(1e-6);
      expect(Math.abs(winkelRest(0, l.gier))).toBeLessThan(1e-6);
    }
  });

  it("der Anhaenger laeuft vorwaerts von selbst gerade, rueckwaerts schaukelt er auf", () => {
    const vor: Lage = { x: 0, z: 0, gier: 0, lenk: 0, knick: 0.4 };
    for (let i = 0; i < 400; i++) rolle(vor, gespann, 0.05);
    expect(Math.abs(vor.knick)).toBeLessThan(0.02);
    const rueck: Lage = { x: 0, z: 0, gier: 0, lenk: 0, knick: 0.05 };
    for (let i = 0; i < 100; i++) rolle(rueck, gespann, -0.05);
    expect(Math.abs(rueck.knick)).toBeGreaterThan(0.2);
  });

  it("Fahrwerk und Umriss nennen dieselbe Hinterachse", () => {
    for (const b of [5.4, 6.0]) {
      expect(-lkwFahrwerk(b).hinten).toBeCloseTo(ursprungVorAchse(b), 12);
    }
    // Pritsche 4,70 m Radstand, Kipper 5,15 m (Herleitung in `vehicleModel.ts`)
    expect(lkwFahrwerk(5.4).vorn - lkwFahrwerk(5.4).hinten).toBeCloseTo(4.7, 9);
    expect(lkwFahrwerk(6.0).vorn - lkwFahrwerk(6.0).hinten).toBeCloseTo(5.15, 9);
  });

  it("nimmt immer den kuerzeren Weg und ueberschiesst nie", () => {
    expect(winkelRest(3.05, -3.05)).toBeCloseTo(2 * Math.PI - 6.1, 9);
    expect(lenkeEin(0, 0.3, 10)).toBe(0.3);
    expect(lenkeEin(0, 0.3, 0.1)).toBeCloseTo(0.1, 12);
    expect(lenkeEin(0, -0.3, 0.1)).toBeCloseTo(-0.1, 12);
  });
});
