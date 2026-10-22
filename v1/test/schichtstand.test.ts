/**
 * E-204 — LAGEBILD, BUCHUNGEN, PRITSCHE NACH STANDZEIT.
 *
 * Lagebild und Buchungen sind reine Rechnung (`delivery/schichtbetrieb.ts`);
 * die Pritsche an der Annahme fährt mit echter Physik auf dem Schicht-Platz
 * (`test/schichtlauf.ts`).
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { initPhysics } from "../src/physics/physicsWorld";
import {
  baueSchichtStand,
  abfahrtBuchungen,
  standgeldBuchung,
  SCHADEN_BUCHUNG,
  BOX_SCHWELLE_KG,
  type StandPorts,
} from "../src/delivery/schichtbetrieb";
import { Kasse, sortenregelAus, FEHLWURF_EUR, SCHADEN_EUR } from "../src/economy/kasse";
import { CONFIGS, gehoertHierhin } from "../src/world/containers";
import { SCHICHT_FEIERABEND_S } from "../src/world/schichtzeit";
import { setzeSchichtPlatzZurueck } from "../src/world/schichtplatz";
import { setBuildingObstacles } from "../src/world/obstacles";
import { baueSchichtPlatz, festerZufall } from "./schichtlauf";

const ports = (o: Partial<StandPorts> = {}): StandPorts => ({
  uhr: "09:30",
  schichtS: 140,
  kasseEur: 1234.5,
  betrieb: { wartend: 2, torZu: false, annahmeVoll: true },
  verlader: null,
  boxKg: (b) => ({ steel: 3000, copper: 1600, rubble: 0 })[b],
  ...o,
});
const wagen = (kg: number, fuellgrad: number, warten = true): StandPorts["verlader"] => ({
  bestellung: "mixed",
  waitingForLoad: warten,
  ladeflaecheKg: () => kg,
  ladeflaecheFuellgrad: () => fuellgrad,
});

describe("E-204 — das Lagebild der Schicht", () => {
  it("Uhr, Restzeit, Kasse, Betrieb und Boxen kommen durch, Schwellen aus BOX_SCHWELLE_KG", () => {
    const s = baueSchichtStand(ports());
    expect(s).toEqual({
      uhr: "09:30",
      restS: SCHICHT_FEIERABEND_S - 140,
      torZu: false,
      kasseEur: 1234.5,
      wartend: 2,
      annahmeVoll: true,
      verlader: null,
      boxen: [
        { order: "steel", kg: 3000, schwelleKg: BOX_SCHWELLE_KG.steel },
        { order: "copper", kg: 1600, schwelleKg: BOX_SCHWELLE_KG.copper },
        { order: "rubble", kg: 0, schwelleKg: BOX_SCHWELLE_KG.rubble },
      ],
    });
    expect(baueSchichtStand(ports({ schichtS: 700 })).restS, "nach Feierabend nie negativ").toBe(0);
  });

  it("Verlader: Anteil = max(Füllgrad / 0,8 ; kg / 8 500), höchstens 1; unterwegs = null", () => {
    expect(baueSchichtStand(ports({ verlader: wagen(4250, 0.2) })).verlader).toEqual({ order: "mixed", kg: 4250, anteil: 0.5 });
    expect(baueSchichtStand(ports({ verlader: wagen(1000, 0.6) })).verlader?.anteil).toBeCloseTo(0.75, 9);
    expect(baueSchichtStand(ports({ verlader: wagen(9000, 0.9) })).verlader?.anteil).toBe(1);
    expect(baueSchichtStand(ports({ verlader: wagen(0, 0) })).verlader?.anteil).toBe(0);
    expect(baueSchichtStand(ports({ verlader: wagen(500, 0.1, false) })).verlader, "fährt gerade, steht nicht zum Laden").toBeNull();
  });
});

describe("E-204 — Buchungen für schicht:buchung", () => {
  const kasse = (): Kasse => new Kasse("montag", sortenregelAus(CONFIGS.filter((c) => !c.lager), gehoertHierhin));

  it("Abfahrt: Erlös mit Vorzeichen, kg und Sorte; Fehlwürfe als eine Zeile −25 € je Stück; Summe = Kasse", () => {
    const k = kasse();
    // Misch-Verlader: 1 t Misch (160 €) und zwei Reifen (Müll, Fehlwurf)
    const b = k.bucheAbfahrt("mixed", [
      { materialId: "mixed", massKg: 1000 },
      { materialId: "tires", massKg: 10 },
      { materialId: "tires", massKg: 10 },
    ]);
    const z = abfahrtBuchungen("mixed", b);
    expect(z[0]).toEqual({ art: "abfahrt", eur: b.erloesEur, kg: 1020, order: "mixed" });
    expect(z[1]).toEqual({ art: "fehlwurf", eur: -2 * FEHLWURF_EUR, order: "mixed" });
    expect(z.reduce((s, x) => s + x.eur, 0)).toBeCloseTo(k.bilanz(false).verdienstEur, 2);
    // Nur Müll: der Erlös ist negativ und bleibt es
    const m = abfahrtBuchungen("mixed", kasse().bucheAbfahrt("mixed", [{ materialId: "tires", massKg: 500 }]));
    expect(m[0]!.eur).toBeLessThan(0);
    // Ohne Fehlwurf nur die eine Zeile
    expect(abfahrtBuchungen("mixed", kasse().bucheAbfahrt("mixed", [{ materialId: "mixed", massKg: 100 }])).length).toBe(1);
  });

  it("Standgeld erst über 60 s, auf den Cent; Schaden −50 €", () => {
    expect(standgeldBuchung(60)).toBeNull();
    expect(standgeldBuchung(30)).toBeNull();
    expect(standgeldBuchung(100.256)).toEqual({ art: "standgeld", eur: -40.26 });
    expect(SCHADEN_BUCHUNG).toEqual({ art: "schaden", eur: -SCHADEN_EUR });
    // Gegenprobe mit der Kasse: dieselbe Standzeit kostet dort dasselbe
    const k = kasse();
    k.bucheStandgeld(40.256);
    expect(k.bilanz(false).standgeldEur).toBe(40.26);
  });
});

/** `STANDZEIT_S` (E-082) — die Klasse ist nicht exportiert, gelesen wird am Wagen. */
const standzeitVon = (w: object): number => (w.constructor as unknown as { STANDZEIT_S: number }).STANDZEIT_S;
type Wagen = NonNullable<ReturnType<typeof baueSchichtPlatz>["vehicles"]["schichtAnlieferer"]>;

describe("E-204 — die Pritsche an der Annahme fährt nach STANDZEIT_S mit Ladung (E-082)", () => {
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

  it("niemand lädt ab → nach 240 s (STANDZEIT_S) fährt sie, die Ladung geht mit vom Hof", { timeout: 600_000 }, () => {
    zurueck = festerZufall(206);
    const p = baueSchichtPlatz({ stufe: "montag", saat: 1, loseKg: () => 0 });
    // Vor den Kipper des Fahrplans gestellt: die Pritsche ist die erste an der Annahme
    p.vehicles.schichtFaellig({ tS: 0, art: "misch", fahrzeug: "pritsche" });
    let w: Wagen | null = null;
    let ankunft = -1;
    let abfahrt = -1;
    let ladung: number[] = [];
    let ladungKg = 0;
    for (let i = 0; i < 60 * 420; i++) {
      p.takt();
      const a = p.vehicles.schichtAnlieferer;
      if (!w && a?.kind === "pritsche") w = a;
      if (w && ankunft < 0 && w.phaseName === "waitUnload") {
        ankunft = p.schichtS;
        ladung = w.cargo.items.map((x) => x.body.handle);
        ladungKg = w.cargo.items.reduce((s, x) => s + x.massKg, 0);
      }
      /*
       * Was beim Losfahren auf der Fläche liegt, ist die Ladung — nicht, was
       * bei der Ankunft lag. Seit 45c (Teile höchstens 2× Katalog, also
       * leichter) rutschen beim Freigeben an der Annahme mehr Teile herunter
       * (gemessen 12 Pritschen, je 15 s nach Ankunft: 12 von 167 Teilen statt 3 von 123); sie liegen
       * dann an der Annahme, wo sie hingehören, und fahren nicht mit.
       */
      if (ankunft >= 0 && abfahrt < 0 && w!.phaseName === "waitUnload") {
        ladung = w!.cargo.items.filter((x) => w!.liegtAuf(x.body)).map((x) => x.body.handle);
      }
      if (ankunft >= 0 && abfahrt < 0 && w!.phaseName !== "waitUnload") abfahrt = p.schichtS;
      if (abfahrt >= 0 && p.vehicles.schichtAnlieferer !== w) break;
    }
    const STANDZEIT_S = standzeitVon(w!);
    expect(STANDZEIT_S).toBe(240);
    const st = p.protokoll.standzeiten.find((s) => s.fahrzeug === "pritsche");
    console.log(
      `Pritsche: an der Annahme ${ankunft.toFixed(0)} s, ${ladung.length} Teile / ${Math.round(ladungKg)} kg, ` +
        `fährt nach ${(abfahrt - ankunft).toFixed(1)} s, gemeldete Standzeit ${st?.standzeitS.toFixed(1)} s`
    );
    expect(ankunft, "nie an der Annahme angekommen").toBeGreaterThanOrEqual(0);
    expect(ladung.length).toBeGreaterThan(0);
    expect(abfahrt - ankunft).toBeGreaterThan(STANDZEIT_S - 1);
    expect(abfahrt - ankunft).toBeLessThan(STANDZEIT_S + 2);
    expect(p.vehicles.schichtAnlieferer, "nicht vom Hof gefahren").not.toBe(w);
    // Die Ladung fuhr mit: keins ihrer Teile liegt noch auf dem Platz
    const noch = p.items.items.filter((x) => ladung.includes(x.body.handle)).length;
    expect(noch, "Teile der Ladung blieben liegen").toBe(0);
    // Standzeit gemeldet: die 240 s an der Annahme (+ Rangieren), also Standgeld ab 60 s
    expect(st?.standzeitS).toBeGreaterThan(STANDZEIT_S - 1);
  });
});
