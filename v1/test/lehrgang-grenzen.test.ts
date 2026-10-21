/**
 * LEHRGANG: JEDE VORFUEHRUNG ENDET IN DER STARTLAGE — AUCH AM ANSCHLAG
 * (L3b, qa 21.10.2026 Befunde 3 und 4).
 *
 * Gemessen: Stand der Hauptarm vor „Auf die Marke" bei 56,8°, endete die
 * Vorfuehrung 2,32° tiefer (Heben lief an den 70°-Anschlag). Schwenken endete
 * in allen Laeufen 0,51° daneben (ein langer Rueckweg statt zwei kurzer).
 *
 * Echter Bagger auf dem Aufgaben-Platz (`werkbank`), echte Kamera, echte
 * Wiedergabe, der echte `LektionLauf` steigt bei genau diesem Schritt ein
 * und schickt die Spur, wie er sie fuer die Lage richtet (`richteSpur`).
 * Lagen: Startlage, Hauptarm 56,8° (qa), 69°, Stiel ganz aus, ganz ein,
 * beides hoch; Zoom ganz nah und ganz weit. Je Schritt mit Spur:
 *   - Ende − Anfang unter 0,2° je Gelenk und Kamera, 1 cm Weg, 0,5 % Abstand;
 *   - „Auf die Marke": die Vorfuehrung bringt die Spinne in den Ring.
 * Gegenproben: die alte Marke-Spur bei hohem Arm, die alte Schwenk-Spur.
 * Waechter fuer die abgeschriebenen Grenzen (`GRENZEN`): der echte Bagger
 * steht nach langem Vollausschlag genau dort.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { Spur } from "../src/core/spur";
import { LEKTIONEN } from "../src/challenges/lehrgang";
import { GRENZEN, LektionLauf, richteSpur, type LektionZustand } from "../src/challenges/lektion";
import { lektionQuellen } from "../src/challenges/quellen";
import { OrbitCamera } from "../src/excavator/orbitCamera";
import { SPUR_ACHSEN, Wiedergabe } from "../src/core/wiedergabe";
import type { TouchAxes } from "../src/core/touch";
import { DT, GRAD, platzLeinwand, werkbank } from "./aufgabenwerkbank";

const L = LEKTIONEN[0]!;
/** SW: 0,2° (Auftrag L3b), 1 cm, 0,5 % — symmetrische Spuren landen kopflos auf 0,000 */
const TOL_RAD = 0.2 / GRAD;
const TOL_M = 0.01;
const TOL_REL = 0.005;

interface Lage {
  name: string;
  boomG?: number;
  stickG?: number;
  /** Kameraabstand (m), sonst Start 11 m */
  abstand?: number;
}
const LAGEN: Lage[] = [
  { name: "Startlage" },
  { name: "Hauptarm 56,8° (qa)", boomG: 56.8 },
  { name: "Hauptarm 69°", boomG: 69 },
  { name: "Stiel ganz aus", stickG: -26 },
  { name: "Stiel ganz ein", stickG: -139 },
  { name: "Hauptarm 69°, Stiel ganz aus", boomG: 69, stickG: -26 },
  { name: "Hauptarm 60°, Stiel −40°", boomG: 60, stickG: -40 },
  { name: "Zoom ganz nah", abstand: 3 },
  { name: "Zoom ganz weit", abstand: 18 },
];

interface Ergebnis {
  start: LektionZustand;
  ende: LektionZustand;
  spur: Spur;
  /** kleinster waagrechter Abstand Spinne – Marke waehrend der Vorfuehrung (m), sonst null */
  markeAbstand: number | null;
}

/**
 * Bagger in die Lage bringen (Winkel setzen, dann 1 s Physik — der
 * Bodenanschlag hebt, was im Boden stuende), Kamera zoomen, dann die
 * Vorfuehrung von Schritt `i` abspielen. Mit `spur`: genau diese Spur,
 * ungerichtet (Gegenprobe).
 */
function vorfuehrung(i: number, lage: Lage, spur?: Spur): Ergebnis {
  const k = werkbank();
  const b = k.b;
  const achsen: TouchAxes = { cab: 0, stick: 0, boom: 0, rotator: 0, drive: 0, steer: 0, grab: false, grapple: 0 };
  b.touch = achsen;
  if (lage.boomG !== undefined) b.boomAngle = lage.boomG / GRAD;
  if (lage.stickG !== undefined) b.stickAngle = lage.stickG / GRAD;
  const orbit = new OrbitCamera(16 / 9);
  const kam = { orbitDX: 0, orbitDY: 0, zoomFactor: (lage.abstand ?? 11) / 11, camReset: false, shiftHeld: false, wheelDelta: 0, wasPressed: () => false };
  const kamera = (): void => orbit.update(DT, kam as never, (o) => o.copy(b.position), (o) => (o.copy(b.position).setY(3), b.cabinBaseYaw));
  kamera(); // Zoom ueber den Eingabeweg, wie ein Kneifen
  kam.zoomFactor = 1;
  for (let n = 0; n < 60; n++) {
    k.takt();
    kamera();
  }
  const q = lektionQuellen({ bagger: b, kamera: orbit });
  const druecke = (t: string): void => {
    if (t === "KeyC") orbit.touchViewPress = true;
  };
  const w = new Wiedergabe(k.bus, { achsen, kamera: kam as never, druecke, eingriff: () => false });
  let gesendet: Spur | null = null;
  k.bus.on("lehrgang:vorfuehren", (e) => (gesendet = e.spur));
  const start = q.zustand();
  let marke: { x: number; z: number } | null = null;
  if (spur) k.bus.emit("lehrgang:vorfuehren", { spur });
  else {
    const lauf = new LektionLauf(L, 1, 1, q, k.bus);
    lauf.start(i);
    expect(lauf.phase).toBe("zeigen");
    marke = lauf.marke;
  }
  const sensor = new THREE.Vector3();
  let markeAbstand: number | null = marke ? Infinity : null;
  for (let n = 0; n < 60 * 10 && w.laeuft; n++) {
    kam.orbitDX = 0;
    kam.orbitDY = 0;
    kam.zoomFactor = 1;
    kam.camReset = false;
    w.takt(DT);
    w.schritt(DT);
    k.takt();
    kamera();
    if (marke) {
      b.getSensorPosition(sensor);
      markeAbstand = Math.min(markeAbstand!, Math.hypot(sensor.x - marke.x, sensor.z - marke.z));
    }
  }
  expect(w.laeuft).toBe(false);
  for (const x of SPUR_ACHSEN) achsen[x] = 0;
  return { start, ende: q.zustand(), spur: gesendet!, markeAbstand };
}

function abweichungen(e: Ergebnis): Array<{ was: string; wert: number; tol: number }> {
  const { start: a, ende: z } = e;
  return [
    { was: "Drehkranz", wert: z.cabYaw - a.cabYaw, tol: TOL_RAD },
    { was: "Hauptarm", wert: z.boom - a.boom, tol: TOL_RAD },
    { was: "Stiel", wert: z.stick - a.stick, tol: TOL_RAD },
    { was: "Fahrtrichtung", wert: z.heading - a.heading, tol: TOL_RAD },
    { was: "Ort", wert: Math.hypot(z.x - a.x, z.z - a.z), tol: TOL_M },
    { was: "Kamera Gier", wert: z.kamera.gier - a.kamera.gier, tol: TOL_RAD },
    { was: "Kamera Abstand", wert: z.kamera.abstand / a.kamera.abstand - 1, tol: TOL_REL },
  ];
}

/** Schritte mit Spur, die nicht die Ansicht wechseln (der Umlauf endet ohnehin auf dem Startpunkt) */
const SCHRITTE = L.schritte.flatMap((s, i) => (s.vorfuehrung && !s.vorfuehrung.some((a) => a.tasten?.length) ? [i] : []));
/** Kamera-Schritte an den Zoom-Anschlaegen, Arm-Schritte an den Arm-Anschlaegen; Startlage immer */
const lagenFuer = (i: number): Lage[] => {
  const kamera = L.schritte[i]!.vorfuehrung!.some((a) => a.kamera);
  return LAGEN.filter((l) => l.name === "Startlage" || (l.abstand !== undefined) === kamera);
};

describe("Lehrgang: Vorführung endet in der Startlage, auch am Anschlag (L3b)", () => {
  beforeAll(async () => {
    platzLeinwand();
    await RAPIER.init();
  });

  for (const i of SCHRITTE) {
    it(`Schritt ${i + 1} (${L.schritte[i]!.titel.de}) aus ${lagenFuer(i).length} Lagen`, () => {
      const zeilen: string[] = [];
      const fehler: string[] = [];
      for (const lage of lagenFuer(i)) {
        const e = vorfuehrung(i, lage);
        const ab = abweichungen(e);
        const um = richteSpur(L.schritte[i]!.vorfuehrung!, e.start).umgedreht;
        zeilen.push(
          `  ${lage.name} (Hauptarm ${(e.start.boom * GRAD).toFixed(1)}°, Stiel ${(e.start.stick * GRAD).toFixed(1)}°, ${e.start.kamera.abstand.toFixed(1)} m)` +
            `${um.length ? ` umgedreht ${um.join("+")}` : ""}: ` +
            ab.map((x) => `${x.was} ${(x.was === "Ort" ? x.wert : x.was.endsWith("Abstand") ? x.wert * 100 : x.wert * GRAD).toFixed(3)}`).join(" · ") +
            (e.markeAbstand !== null ? ` · Marke ${e.markeAbstand.toFixed(2)} m` : "")
        );
        for (const x of ab) if (Math.abs(x.wert) > x.tol) fehler.push(`${lage.name}: ${x.was} ${x.wert}`);
        if (e.markeAbstand !== null && L.schritte[i]!.ziel.art === "marke" && e.markeAbstand > L.schritte[i]!.ziel.radiusM) fehler.push(`${lage.name}: Marke verfehlt ${e.markeAbstand}`);
      }
      console.log(`Schritt ${i + 1}:\n${zeilen.join("\n")}`);
      expect(fehler).toEqual([]);
    }, 300_000);
  }

  it("Gegenprobe: die alte Marke-Spur (ungerichtet) reißt bei hohem Arm", () => {
    const i = L.schritte.findIndex((s) => s.ziel.art === "marke");
    const alt: Spur = [
      { dauerS: 0.9, achsen: { cab: 1 } },
      { dauerS: 0.8, achsen: { boom: 1, stick: -1 } },
      { dauerS: 1.0 },
      { dauerS: 0.8, achsen: { boom: -1, stick: 1 } },
      { dauerS: 0.9, achsen: { cab: -1 } },
      { dauerS: 0.5 },
    ];
    const e = vorfuehrung(i, { name: "Hauptarm 69°", boomG: 69 }, alt);
    expect(Math.abs(e.ende.boom - e.start.boom) * GRAD).toBeGreaterThan(1);
    // … gerichtet waere sie umgedreht worden
    expect(richteSpur(alt, e.start).umgedreht.length).toBeGreaterThan(0);
  }, 60_000);

  it("Gegenprobe: die alte Schwenk-Spur (ein langer Rückweg) endet daneben", () => {
    const i = L.schritte.findIndex((s) => s.symbol === "schwenken");
    const alt: Spur = [
      { dauerS: 0.8, achsen: { cab: 1 } },
      { dauerS: 0.5 },
      { dauerS: 1.6, achsen: { cab: -1 } },
      { dauerS: 0.5 },
      { dauerS: 0.8, achsen: { cab: 1 } },
      { dauerS: 0.5 },
    ];
    // Arm hoch: die Spinne schwenkt ueber die MUELL-Mulde hinweg, uebrig bleibt nur die Rampe
    const e = vorfuehrung(i, { name: "Hauptarm 69°", boomG: 69 }, alt);
    expect(Math.abs(e.ende.cabYaw - e.start.cabYaw)).toBeGreaterThan(TOL_RAD);
  }, 60_000);

  it("Wächter: die abgeschriebenen Anschläge und Tempi stimmen mit dem echten Bagger", () => {
    const k = werkbank();
    const b = k.b;
    const achsen: TouchAxes = { cab: 0, stick: 0, boom: 1, rotator: 0, drive: 0, steer: 0, grab: false, grapple: 0 };
    b.touch = achsen;
    achsen.stick = 1;
    for (let n = 0; n < 60 * 6; n++) k.takt();
    expect(b.boomAngle).toBeCloseTo(GRENZEN.boom.max, 6);
    expect(b.stickAngle).toBeCloseTo(GRENZEN.stick.max, 6);
    // Je 1 s voll aus der Ruhe, dann auslaufen — hoch oben, fern vom Boden: nominell Tempo × 1 s
    const eineSekunde = (x: "boom" | "stick"): number => {
      achsen.boom = 0;
      achsen.stick = 0;
      for (let n = 0; n < 60; n++) k.takt(); // am Anschlag bleibt das Tempo stehen — erst auslaufen
      const w0 = x === "boom" ? b.boomAngle : b.stickAngle;
      achsen[x] = -1;
      for (let n = 0; n < 60; n++) k.takt();
      achsen[x] = 0;
      for (let n = 0; n < 60; n++) k.takt();
      return (w0 - (x === "boom" ? b.boomAngle : b.stickAngle)) * GRAD;
    };
    const proS = { boom: eineSekunde("boom"), stick: eineSekunde("stick") };
    console.log(`1 s voll: Hauptarm ${proS.boom.toFixed(2)}°, Stiel ${proS.stick.toFixed(2)}°`);
    expect(Math.abs(proS.boom - GRENZEN.boom.radS * GRAD)).toBeLessThan(0.5);
    expect(Math.abs(proS.stick - GRENZEN.stick.radS * GRAD)).toBeLessThan(0.5);
    achsen.stick = -1;
    for (let n = 0; n < 60 * 7; n++) k.takt();
    expect(b.stickAngle).toBeCloseTo(GRENZEN.stick.min, 6);
    const orbit = new OrbitCamera(16 / 9);
    const kam = { orbitDX: 0, orbitDY: 0, zoomFactor: 0.01, camReset: false, shiftHeld: false, wheelDelta: 0, wasPressed: () => false };
    const z = (): void => orbit.update(DT, kam as never, (o) => o.copy(b.position), (o) => (o.copy(b.position).setY(3), b.cabinBaseYaw));
    z();
    expect(orbit.blick.abstand).toBeCloseTo(GRENZEN.abstand.min, 6);
    kam.zoomFactor = 100;
    z();
    expect(orbit.blick.abstand).toBeCloseTo(GRENZEN.abstand.max, 6);
  }, 60_000);
});
