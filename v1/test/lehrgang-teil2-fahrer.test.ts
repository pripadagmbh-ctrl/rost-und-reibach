/**
 * LEHRGANG TEIL 2 (L8) KOPFLOS MIT ECHTEM BAGGER: Fuehrt der Lotse ans Ziel?
 *
 * Der „Lotse-Fahrer" drueckt NUR, was `lehrgang:richtung` gerade sagt (wie
 * ein Spieler, der dem Pfeil des Geisterdaumens folgt), ueber die Touch-
 * Achsen — Spinne also wie am Geraet: plus schliesst, minus oeffnet, Mitte
 * haelt. Das Drehen spielt die echte Wiedergabe vor. Stuetzen tippt er wie
 * der Spieler auf den Kranz (`toggleOutriggers`), der Kranz selbst ist am
 * PC null (= erfuellt).
 *
 * Die Station baut der Test wie main.ts beim `lehrgang:station`: aufraeumen,
 * `baueAufgabe`, Greifer setzen, `StationLauf` starten.
 *
 * Geprueft: Greifen, Drehen, Ablegen an "erster-griff" (Boiler in BUNT + VA)
 * und Kranz, Stuetzen, Last an "schwere-last" — jeder Schritt bekommt sein
 * Haekchen in der Zeit, die ein Mensch auch braucht.
 */
import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { LektionLauf, ruhePunkt, type LektionQuellen } from "../src/challenges/lektion";
import { LEKTIONEN } from "../src/challenges/lehrgang";
import { lektionQuellen, weltQuellen } from "../src/challenges/quellen";
import { StationLauf } from "../src/challenges/station";
import { challengeNach } from "../src/challenges/katalog";
import { baueAufgabe, grundbestandVon, raeumeAuf } from "../src/challenges/aufbau";
import { formZu, setzeGreifer } from "../src/excavator/greiferwahl";
import { SPUR_ACHSEN, Wiedergabe } from "../src/core/wiedergabe";
import type { TouchAxes } from "../src/core/touch";
import type { GameEvents } from "../src/core/events";
import { DT, platzLeinwand, werkbank } from "./aufgabenwerkbank";

const L = LEKTIONEN[0]!;
const nr = (sym: string): number => L.schritte.findIndex((s) => s.symbol === sym) + 1;

interface Fahrt {
  haekchen: number[];
  /** Spielzeit je Schritt bis zum Haekchen (s) */
  dauer: Record<number, number>;
  stationen: Array<string | null>;
}

/** Faehrt von Schritt `ab` (1-basiert) bis einschliesslich `bis`; hoechstens `maxS` Spielzeit. */
function fahre(ab: number, bis: number, maxS: number): Fahrt {
  const k = werkbank();
  const b = k.b;
  const achsen: TouchAxes = { cab: 0, stick: 0, boom: 0, rotator: 0, drive: 0, steer: 0, grab: false, grapple: 0 };
  b.touch = achsen;
  const grund = grundbestandVon(k);
  let station: StationLauf | null = null;
  const erg: Fahrt = { haekchen: [], dauer: {}, stationen: [] };
  k.bus.on("lehrgang:station", (e) => {
    erg.stationen.push(e.id);
    // wie main.ts: alte Station stumm, loslassen, aufraeumen, neu aufbauen
    station?.beenden();
    k.grip.releaseAll();
    raeumeAuf(grund, k);
    station = null;
    if (!e.id) return;
    const d = challengeNach(e.id)!;
    const obj = baueAufgabe(d, k);
    k.items.settle(k.world);
    if (d.aufbau.greifer) setzeGreifer(b, k.grip, formZu(d.aufbau.greifer));
    station = new StationLauf(d, weltQuellen({ bagger: b, grip: k.grip, containers: k.containers, items: k.items, press: k.press }), k.bus, obj);
    station.start();
  });
  const kamera = { blick: { modus: "orbit" as const, gier: Math.PI, nick: 0.42, abstand: 11 } };
  const q: LektionQuellen = {
    ...lektionQuellen({ bagger: b, kamera }),
    stationGesehen: (x) => station?.gesehen(x) ?? false,
    kranzOffen: () => null, // am PC kein Kranz
  };
  const lauf = new LektionLauf(L, 1, 1, q, k.bus);
  const kam = { orbitDX: 0, orbitDY: 0, zoomFactor: 1, camReset: false, shiftHeld: false, wheelDelta: 0, wasPressed: () => false };
  const wiedergabe = new Wiedergabe(k.bus, {
    achsen,
    kamera: kam,
    druecke: (t) => {
      if (t === "KeyO") b.toggleOutriggers();
    },
    eingriff: () => false,
  });
  let bedarf: GameEvents["lehrgang:richtung"]["bedarf"] = [];
  k.bus.on("lehrgang:richtung", (e) => (bedarf = e.bedarf));
  let beginn = 0;
  k.bus.on("lehrgang:schritt", (e) => {
    if (e.phase !== "du") return;
    bedarf = [];
    beginn = lauf.zeitS;
    // Stuetzen: der Spieler tippt STUETZEN im Kranz
    if (L.schritte[e.nr - 1]!.ziel.art === "zustand" && e.kranz?.code === "KeyO" && !b.abgestuetzt) b.toggleOutriggers();
  });
  k.bus.on("lehrgang:haekchen", (e) => {
    erg.haekchen.push(e.nr);
    erg.dauer[e.nr] = lauf.zeitS - beginn;
  });

  lauf.start(ab - 1);
  for (let n = 0; n < maxS / DT && !erg.haekchen.includes(bis); n++) {
    if (wiedergabe.laeuft) {
      wiedergabe.takt(DT);
      wiedergabe.schritt(DT);
    } else {
      for (const x of SPUR_ACHSEN) achsen[x] = 0;
      for (const f of bedarf) achsen[f.fn] = f.richtung === "plus" ? 1 : -1;
    }
    k.takt();
    (station as StationLauf | null)?.takt(DT);
    lauf.takt(DT);
  }
  k.world.free();
  return erg;
}

describe("Lehrgang Teil 2: der Lotse fuehrt den echten Bagger ans Ziel", () => {
  beforeAll(async () => {
    platzLeinwand();
    await RAPIER.init();
  });

  it("Waechter: die Ruhelage (PIVOT_VOR_M + Armgeometrie) ist, wo der echte Sensor auspendelt", () => {
    for (const [boomG, stickG, cabG] of [
      [35, -70, 0],
      [55, -40, 40],
      [20, -110, -60],
    ]) {
      const k = werkbank();
      const b = k.b;
      b.boomAngle = (boomG * Math.PI) / 180;
      b.stickAngle = (stickG * Math.PI) / 180;
      b.cabYaw = (cabG * Math.PI) / 180;
      for (let i = 0; i < 600; i++) k.takt(); // 10 s auspendeln
      const z = lektionQuellen({ bagger: b, kamera: { blick: { modus: "orbit", gier: Math.PI, nick: 0.42, abstand: 11 } } }).zustand();
      const r = ruhePunkt(z);
      expect(Math.hypot(r.x - z.spinne.x, r.z - z.spinne.z), `${boomG}/${stickG}/${cabG}`).toBeLessThanOrEqual(0.05);
      k.world.free();
    }
  }, 60_000);

  it("erster-griff: Zurueck, Greifen, Drehen, Ablegen — nur nach dem Pfeil", () => {
    const von = nr("zurueck");
    const bis = nr("ablegen");
    const e = fahre(von, bis, 120);
    console.log(`Teil 2 erster-griff: ${JSON.stringify(e.dauer)} s je Schritt, Stationen ${JSON.stringify(e.stationen)}`);
    expect(e.stationen[0]).toBeNull(); // Schritt 10 gehoert noch zu keiner Station
    expect(e.stationen).toContain("erster-griff");
    expect(e.haekchen).toEqual([von, von + 1, von + 2, bis]);
    // SW: der Fahrer reagiert sofort; je Schritt hoechstens 40 s (ein Mensch etwa das Doppelte, Budget 30 s je Schritt)
    for (const [s, t] of Object.entries(e.dauer)) expect(t, `Schritt ${s}`).toBeLessThanOrEqual(40);
  }, 120_000);

  // Je Station ab ihrem ersten Lotsen-Schritt (Wiedereinstieg baut sie auf); Zerlegen und Pressen haben keinen Lotsen
  for (const [name, von, bis, station] of [
    ["schwere-last: Kranz, Stuetzen, Last heben", nr("kranz"), nr("last"), "schwere-last"],
    ["platt-machen: Haemmern, Quetschen", nr("haemmern"), nr("quetschen"), "platt-machen"],
    ["verladen: In die Presse", nr("presse"), nr("presse"), "verladen"],
    ["magnet: ein richtiger Einwurf", nr("magnet"), nr("magnet"), "magnet"],
    ["sortieren: zwei richtige Einwuerfe", nr("sortieren"), nr("sortieren"), "sortieren"],
  ] as const) {
    it(name, () => {
      const e = fahre(von, bis, 120);
      console.log(`Teil 2 ${station}: ${JSON.stringify(e.dauer)} s je Schritt`);
      expect(e.stationen).toEqual([station]);
      expect(e.haekchen).toEqual(Array.from({ length: bis - von + 1 }, (_, i) => von + i));
      for (const [s, t] of Object.entries(e.dauer)) expect(t, `Schritt ${s}`).toBeLessThanOrEqual(40);
    }, 120_000);
  }
});
