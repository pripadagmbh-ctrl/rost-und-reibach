/**
 * LEHRGANG TEIL 2 (L8): Stationen, Ziele in der Welt, der Lotse.
 *
 *  1. `lehrgang:station`: beim ersten Schritt immer (auch null), danach nur
 *     beim Wechsel — auch beim Wiedereinstieg (Schritt 12 → "erster-griff");
 *  2. jede neue Zielart erfuellt / nicht erfuellt, mit Gegenproben:
 *     `ort` (sofort am Start, nicht nach 2 m), `station`, `ereignis` (nur ab
 *     „du"; Einwurf nur `correct`; Abriss nur "ab"), `zustand` (Kranz: null =
 *     erfuellt); `kranz` geht mit `lehrgang:schritt` hinaus;
 *  3. der Lotse an den Marken der Station: Teil links → cab plus, ueber dem
 *     Teil hoch → boom minus, tief → grapple plus; gefasst ueber dem Ziel →
 *     grapple minus; Wrack gefasst → boom plus; Rotator; leere Schritte;
 *  4. die Daten: jede Station gibt es, und jede Beobachtung eines
 *     Station-Ziels kommt in den Schritten DIESER Pruefung vor (sonst waere
 *     `gesehen` nie wahr).
 *
 * Rein, mit Attrappen wie `test/lehrgang-richtung.test.ts`. Mit echtem
 * Bagger: `test/lehrgang-teil2-fahrer.test.ts`.
 */
import { describe, expect, it } from "vitest";
import { EventBus, type GameEvents } from "../src/core/events";
import { ABWURF_MAX_M, HAEKCHEN_PAUSE_S, LektionLauf, abwurfPunkt, markeBedarf, ruhePunkt, stationVon, type LektionDaten, type LektionQuellen, type LektionSchritt, type LektionZiel, type LektionZustand } from "../src/challenges/lektion";
import { LEKTIONEN } from "../src/challenges/lehrgang";
import { challengeNach } from "../src/challenges/katalog";
import type { Beobachtung } from "../src/challenges/challenge";
import { CONFIGS, MUELL_START } from "../src/world/containers";
import { BAGGER_STAND } from "../src/world/baggerstand";

const G = Math.PI / 180;
const DT = 1 / 60;
const L = LEKTIONEN[0]!;

function zustand(): LektionZustand {
  return {
    cabYaw: 0,
    boom: 0.6,
    stick: -1.2,
    closure: 0,
    rotator: 0,
    x: 0,
    z: 0,
    heading: 0,
    abgestuetzt: false,
    spinne: { x: 0, y: 2, z: 8 },
    kamera: { modus: "orbit", gier: Math.PI, nick: 0.42, abstand: 11 },
  };
}

const schritt = (ziel: LektionZiel, mehr: Partial<LektionSchritt> = {}): LektionSchritt => ({
  titel: { de: "s", en: "s" },
  text: { de: "t", en: "t" },
  zeige: null,
  vorfuehrung: null,
  ziel,
  ...mehr,
});

function daten(schritte: LektionSchritt[]): LektionDaten {
  return { id: "probe", name: { de: "P", en: "P" }, ziel: { de: "Z", en: "Z" }, beschreibung: { de: "B", en: "B" }, schritte };
}

interface Probe {
  l: LektionLauf;
  z: LektionZustand;
  bus: EventBus;
  quelle: { gesehen: Set<Beobachtung>; kranz: boolean | null };
  log: string[];
  stationen: Array<string | null>;
  richtung: GameEvents["lehrgang:richtung"][];
  schritte: GameEvents["lehrgang:schritt"][];
}

function probe(d: LektionDaten, ab = 0, mitQuellen = true): Probe {
  const z = zustand();
  const bus = new EventBus();
  const quelle = { gesehen: new Set<Beobachtung>(), kranz: false as boolean | null };
  const q: LektionQuellen = { zustand: () => ({ ...z, kamera: { ...z.kamera }, spinne: { ...z.spinne } }) };
  if (mitQuellen) {
    q.stationGesehen = (b) => quelle.gesehen.has(b);
    q.kranzOffen = () => quelle.kranz;
  }
  const p: Probe = { l: new LektionLauf(d, 1, 1, q, bus), z, bus, quelle, log: [], stationen: [], richtung: [], schritte: [] };
  bus.on("lehrgang:station", (e) => p.stationen.push(e.id));
  bus.on("lehrgang:haekchen", (e) => p.log.push(`haekchen ${e.nr}`));
  bus.on("lehrgang:geschafft", () => p.log.push("geschafft"));
  bus.on("lehrgang:richtung", (e) => p.richtung.push(e));
  bus.on("lehrgang:schritt", (e) => p.schritte.push(e));
  p.l.start(ab);
  return p;
}

/** Haekchen abwarten und in den naechsten Schritt */
function weiter(p: Probe): void {
  p.l.takt(DT);
  p.l.takt(HAEKCHEN_PAUSE_S + 0.01);
}

/* ------------------------------------------------------------------------ */
/* 1. Stationen                                                             */
/* ------------------------------------------------------------------------ */

describe("lehrgang:station", () => {
  it("stationVon: die letzte Station bei oder vor dem Schritt, Teil 1 ohne", () => {
    const i = (sym: string) => L.schritte.findIndex((s) => s.symbol === sym);
    expect(stationVon(L.schritte, 0)).toBeNull();
    expect(stationVon(L.schritte, i("zurueck"))).toBeNull();
    expect(stationVon(L.schritte, i("greifen"))).toBe("erster-griff");
    expect(stationVon(L.schritte, i("rotator"))).toBe("erster-griff");
    expect(stationVon(L.schritte, i("stuetzen"))).toBe("schwere-last");
    expect(stationVon(L.schritte, i("quetschen"))).toBe("platt-machen");
    expect(stationVon(L.schritte, i("pressen"))).toBe("verladen");
    expect(stationVon(L.schritte, i("hupe"))).toBe("sortieren");
  });

  it("von vorn: einmal null beim ersten Schritt, in Teil 1 keine weitere Meldung", () => {
    const p = probe(L);
    expect(p.stationen).toEqual([null]);
    for (let n = 0; n < 50; n++) p.l.takt(DT);
    expect(p.stationen).toEqual([null]);
  });

  it("Wiedereinstieg bei Schritt 12 (Drehen): sofort \"erster-griff\"; Wechsel nur bei neuer Station, nie doppelt", () => {
    const p = probe(L, 11);
    expect(p.l.schritt).toBe(11);
    expect(p.stationen).toEqual(["erster-griff"]);
    // Drehen (Vorfuehrung ueberspringen, dann 50° drehen)
    p.bus.emit("lehrgang:vorfuehrungEnde", { abgebrochen: true });
    p.z.rotator = 50 * G;
    weiter(p);
    expect(p.l.schritt).toBe(12); // Ablegen — dieselbe Station, keine Meldung
    expect(p.stationen).toEqual(["erster-griff"]);
    p.quelle.gesehen.add("teil_im_ziel");
    weiter(p);
    expect(p.l.schritt).toBe(13); // Kranz — neue Station
    expect(p.stationen).toEqual(["erster-griff", "schwere-last"]);
    // Kranz offen, Stuetzen unten: dieselbe Station
    p.quelle.kranz = true;
    weiter(p);
    p.z.abgestuetzt = true;
    weiter(p);
    expect(p.l.schritt).toBe(15);
    expect(p.stationen).toEqual(["erster-griff", "schwere-last"]);
  });

  it("die Station wird VOR dem Schritt gemeldet (main.ts baut auf, dann misst der Schritt)", () => {
    const bus = new EventBus();
    const reihe: string[] = [];
    bus.on("lehrgang:station", (e) => reihe.push(`station ${e.id}`));
    bus.on("lehrgang:schritt", (e) => reihe.push(`schritt ${e.nr} ${e.phase}`));
    new LektionLauf(L, 1, 1, { zustand }, bus).start(10);
    expect(reihe).toEqual(["station erster-griff", "schritt 11 du"]);
  });
});

/* ------------------------------------------------------------------------ */
/* 2. Ziele                                                                 */
/* ------------------------------------------------------------------------ */

const DAHINTER = schritt({ art: "ansicht", modus: "top" });

describe("Ziel ort: zurueck an den Startplatz", () => {
  const ORT = schritt({ art: "ort", radiusM: 1.0, gierTolRad: 10 * G });
  it("wer dort steht, hat das Haekchen sofort; die Marke liegt unter der Drehmitte bei start()", () => {
    const p = probe(daten([ORT, DAHINTER]));
    expect(p.schritte[0]!.marke).toEqual({ x: 0, y: 0, z: 0, radiusM: 1.0 });
    p.l.takt(DT);
    expect(p.log).toEqual(["haekchen 1"]);
  });
  it("GEGENPROBE: 2 m daneben nicht, verdreht nicht — zurueck und gerade schon", () => {
    const p = probe(daten([schritt({ art: "kameraStart" }), ORT, DAHINTER]));
    // Startlage gemerkt bei start(); im ersten Schritt faehrt er weg
    p.z.x = 2;
    p.l.takt(DT);
    p.z.kamera.gier += 1;
    p.l.takt(DT);
    p.z.kamera.gier -= 1;
    weiter(p);
    expect(p.l.schritt).toBe(1);
    p.l.takt(DT);
    expect(p.log).toEqual(["haekchen 1"]);
    p.z.x = 0.5;
    p.z.heading = 15 * G;
    p.l.takt(DT);
    expect(p.log, "15° verdreht").toEqual(["haekchen 1"]);
    p.z.heading = -5 * G + 2 * Math.PI; // eine Runde weiter, 5° daneben
    p.l.takt(DT);
    expect(p.log).toEqual(["haekchen 1", "haekchen 2"]);
  });
});

describe("Ziel station", () => {
  const ST = schritt({ art: "station", beobachtet: "teil_gefasst" }, { station: "erster-griff" });
  it("erst, wenn die Station es gesehen hat", () => {
    const p = probe(daten([ST, DAHINTER]));
    p.l.takt(DT);
    p.quelle.gesehen.add("teil_gehoben");
    p.l.takt(DT);
    expect(p.log).toEqual([]);
    p.quelle.gesehen.add("teil_gefasst");
    p.l.takt(DT);
    expect(p.log).toEqual(["haekchen 1"]);
  });
  it("GEGENPROBE: ohne Quelle (Attrappe) nie — und nichts stuerzt", () => {
    const p = probe(daten([ST, DAHINTER]), 0, false);
    for (let n = 0; n < 30; n++) p.l.takt(DT);
    expect(p.log).toEqual([]);
  });
});

describe("Ziel ereignis: gezaehlt ab Beginn von „du“", () => {
  const VORHER = schritt({ art: "aenderung", groesse: "cabYaw", richtung: "plus", ab: 0.3 });
  it("Abriss: was im Schritt davor und in der Haekchen-Pause abging, zaehlt nicht; „auf“ ist kein Abriss", () => {
    const p = probe(daten([VORHER, schritt({ art: "ereignis", ereignis: "abriss", anzahl: 1 }), DAHINTER]));
    const abriss = (art: "ab" | "auf") => p.bus.emit("wrack:abriss", { art, handle: 1, teil: "haube", name: "Haube", massKg: 20, x: 0, y: 0, z: 0 });
    abriss("ab");
    p.z.cabYaw = 0.4;
    p.l.takt(DT);
    expect(p.log).toEqual(["haekchen 1"]);
    abriss("ab"); // in der Pause
    p.l.takt(HAEKCHEN_PAUSE_S + 0.01);
    expect(p.l.schritt).toBe(1);
    p.l.takt(DT);
    expect(p.log).toEqual(["haekchen 1"]);
    abriss("auf");
    p.l.takt(DT);
    expect(p.log, "aufgesprungen ist nicht ab").toEqual(["haekchen 1"]);
    abriss("ab");
    p.l.takt(DT);
    expect(p.log).toEqual(["haekchen 1", "haekchen 2"]);
  });
  it("Einwurf: nur richtige, und so viele wie verlangt", () => {
    const p = probe(daten([schritt({ art: "ereignis", ereignis: "einwurf", anzahl: 2 }), DAHINTER]));
    const ein = (correct: boolean) => p.bus.emit("itemEntered", { itemId: "i", materialId: "steel", containerId: "c", correct });
    ein(false);
    ein(false);
    ein(true);
    p.l.takt(DT);
    expect(p.log).toEqual([]);
    ein(true);
    p.l.takt(DT);
    expect(p.log).toEqual(["haekchen 1"]);
  });
  it("Hupe", () => {
    const p = probe(daten([schritt({ art: "ereignis", ereignis: "hupe", anzahl: 1 }), DAHINTER]));
    p.l.takt(DT);
    expect(p.log).toEqual([]);
    p.bus.emit("bagger:hupe", {});
    p.l.takt(DT);
    expect(p.log).toEqual(["haekchen 1"]);
  });
  it("GEGENPROBE: ein beendeter Lauf zaehlt nichts", () => {
    const p = probe(daten([schritt({ art: "ereignis", ereignis: "hupe", anzahl: 1 }), DAHINTER]));
    p.l.beenden();
    p.bus.emit("bagger:hupe", {});
    p.l.takt(DT);
    expect(p.log).toEqual([]);
  });
});

describe("Ziel zustand", () => {
  it("abgestuetzt: erst mit Pratzen unten", () => {
    const p = probe(daten([schritt({ art: "zustand", was: "abgestuetzt" }), DAHINTER]));
    p.l.takt(DT);
    expect(p.log).toEqual([]);
    p.z.abgestuetzt = true;
    p.l.takt(DT);
    expect(p.log).toEqual(["haekchen 1"]);
  });
  it("kranzOffen: zu → nein, offen → ja; null (kein Touch) und ohne Quelle = sofort erfuellt", () => {
    const K = schritt({ art: "zustand", was: "kranzOffen" });
    const p = probe(daten([K, DAHINTER]));
    p.l.takt(DT);
    expect(p.log).toEqual([]);
    p.quelle.kranz = true;
    p.l.takt(DT);
    expect(p.log).toEqual(["haekchen 1"]);
    const pc = probe(daten([K, DAHINTER]));
    pc.quelle.kranz = null;
    pc.l.takt(DT);
    expect(pc.log).toEqual(["haekchen 1"]);
    const ohne = probe(daten([K, DAHINTER]), 0, false);
    ohne.l.takt(DT);
    expect(ohne.log).toEqual(["haekchen 1"]);
  });
  it("kranz geht mit lehrgang:schritt hinaus, sonst null", () => {
    const p = probe(daten([schritt({ art: "zustand", was: "abgestuetzt" }, { kranz: { code: "KeyO" } }), DAHINTER]));
    expect(p.schritte[0]!.kranz).toEqual({ code: "KeyO" });
    p.z.abgestuetzt = true;
    weiter(p);
    expect(p.schritte.at(-1)!.kranz).toBeNull();
  });
});

/* ------------------------------------------------------------------------ */
/* 3. Der Lotse                                                             */
/* ------------------------------------------------------------------------ */

type Marke = GameEvents["challenge:stand"]["marken"][number];
const stand = (id: string, marken: Marke[]): GameEvents["challenge:stand"] => ({ id, zeitS: 0, zaehler: null, balken01: null, pressenBereit: false, tipp: null, marken });
/** Ein Teil (Boiler: Mitte 0,38 m → Marke 0,76 m) bei `w` (rad, plus = links) auf 8 m */
const teilBei = (w: number): Marke => ({ x: 8 * Math.sin(w), y: 0.76, z: 8 * Math.cos(w), art: "teil", sorte: "bunt", nach: { x: -7.6, y: 2, z: 2.7 } });
const letzte = (p: Probe) => p.richtung.at(-1)!.bedarf;
/** Ruhelage der Attrappe (Arm 0,6 / −1,2 rad): `ruhePunkt` */
const R0 = ruhePunkt(zustand()).z;

describe("Lotse an den Marken der Station", () => {
  const GREIFEN = schritt({ art: "station", beobachtet: "teil_gefasst" }, { station: "s1" });
  it("Teil links → schwenken nach links; ueber dem Teil, hoch → senken; tief → zupacken", () => {
    const p = probe(daten([GREIFEN, DAHINTER]));
    expect(letzte(p), "ohne Marken: kein Pfeil").toEqual([]);
    p.bus.emit("challenge:stand", stand("s1", [teilBei(20 * G)]));
    p.l.takt(DT);
    expect(letzte(p)).toEqual([{ fn: "cab", richtung: "plus" }]);
    // drueber, 2,5 m hoch: Mitte 0,38 → 2,12 m > SPINNE_HOEHE_M
    const t = teilBei(20 * G);
    p.z.cabYaw = 20 * G;
    p.z.spinne = { x: t.x + 0.2, y: 2.5, z: t.z };
    p.l.takt(DT);
    expect(letzte(p)).toEqual([{ fn: "boom", richtung: "minus" }]);
    p.z.spinne.y = 1.4; // 1,02 ueber der Mitte
    p.l.takt(DT);
    expect(letzte(p)).toEqual([{ fn: "grapple", richtung: "plus" }]);
    // Ruecklauf: ein Wippen um 0,2 m kippt den Pfeil nicht zurueck
    p.z.spinne.y = 1.75;
    p.l.takt(DT);
    expect(letzte(p)).toEqual([{ fn: "grapple", richtung: "plus" }]);
  });

  it("Teil rechts → schwenken nach rechts; Marken einer anderen Station zaehlen nicht", () => {
    const p = probe(daten([GREIFEN, DAHINTER]));
    p.bus.emit("challenge:stand", stand("andere", [teilBei(20 * G)]));
    p.l.takt(DT);
    expect(letzte(p)).toEqual([]);
    p.bus.emit("challenge:stand", stand("s1", [teilBei(-30 * G)]));
    p.l.takt(DT);
    expect(letzte(p)).toEqual([{ fn: "cab", richtung: "minus" }]);
  });

  it("gefasst (Ziel-Marke da): erst hoch, dann hinueber, ueber dem Ziel oeffnen", () => {
    const p = probe(daten([schritt({ art: "station", beobachtet: "teil_im_ziel" }, { station: "s1" }), DAHINTER]));
    // Box rechts hinten (−70°), Oberkante 2 m
    const ziel: Marke = { x: 8 * Math.sin(-70 * G), y: 2.0, z: 8 * Math.cos(-70 * G), art: "ziel", sorte: "bunt" };
    p.bus.emit("challenge:stand", stand("s1", [ziel]));
    p.z.spinne.y = 2.5; // zu tief fuer die 2-m-Wand
    p.l.takt(DT);
    expect(letzte(p)).toEqual([{ fn: "boom", richtung: "plus" }, { fn: "cab", richtung: "minus" }]);
    p.z.spinne.y = 4.5;
    p.l.takt(DT);
    expect(letzte(p)).toEqual([{ fn: "cab", richtung: "minus" }]);
    p.z.cabYaw = -70 * G;
    p.z.spinne = { x: ziel.x, y: 4.5, z: ziel.z + 0.3 };
    p.l.takt(DT);
    // drueber, aber 2,5 m ueber der Wand: erst absenken (aus der Hoehe prallt ein Teil wieder heraus), dann oeffnen
    expect(letzte(p)).toEqual([{ fn: "boom", richtung: "minus" }]);
    p.z.spinne.y = 3.5;
    p.l.takt(DT);
    expect(letzte(p)).toEqual([{ fn: "grapple", richtung: "minus" }]);
  });

  it("Ziel ausser Reichweite (Halde 10,5 m): Abwurf auf der Linie dorthin, hoechstens ABWURF_MAX_M draussen", () => {
    const m = { x: -0.5, z: -22.5 };
    const nah = abwurfPunkt(m, { x: -7.6, z: -19.8 });
    expect(nah).toEqual({ x: -7.6, z: -19.8 });
    const fern = abwurfPunkt(m, { x: 4, z: -32 });
    expect(Math.hypot(fern.x - m.x, fern.z - m.z)).toBeCloseTo(ABWURF_MAX_M, 9);
    expect(Math.atan2(fern.x - m.x, fern.z - m.z)).toBeCloseTo(Math.atan2(4.5, -9.5), 9);
  });

  it("Waechter: der Abwurfpunkt jeder Mulde am Bagger liegt mindestens 0,5 m innerhalb ihrer Flaeche (auch Halden ausser Reichweite)", () => {
    for (const c of CONFIGS.filter((x) => !x.nurHuelle && x.lager !== true)) {
      const ort = c.id === "r_rubble" ? MUELL_START : c; // die MUELL-Mulde steht seit E-183 vorn
      const p = abwurfPunkt(BAGGER_STAND, ort);
      const rand = Math.min(c.size[0] / 2 - Math.abs(p.x - ort.x), c.size[1] / 2 - Math.abs(p.z - ort.z));
      expect(rand, c.id).toBeGreaterThanOrEqual(0.5);
    }
  });

  it("Hauptarm am 70°-Anschlag: senken ist frei (vorher galt am Anschlag beides als gesperrt)", () => {
    // Stiel waagrecht, Ausladung zu klein: hinaus geht nur mit dem Hauptarm — und der darf vom Anschlag weg
    const z = { ...zustand(), boom: 70 * G, stick: -70 * G, spinne: { x: 0, y: 6, z: 6.3 } };
    expect(markeBedarf(z, { x: 0, z: 8.5, radiusM: 1 }, false).bedarf).toEqual([{ fn: "boom", richtung: "minus" }]);
  });

  it("Wrack: der Kreis von Anfang an ist kein „gefasst“ — erst greifen; gefasst → heben", () => {
    const p = probe(daten([schritt({ art: "station", beobachtet: "wrack_gehoben" }, { station: "s1" }), DAHINTER]));
    const kreis: Marke = { x: 7.2, y: 0, z: 1.3, art: "ziel", sorte: null };
    // Wrack 30° links auf der Ruhelage der Attrappe (8,14 m: 0,55 + Arm 0,6 / −1,2 rad)
    const wrack: Marke = { x: R0 * Math.sin(30 * G), y: 2.6, z: R0 * Math.cos(30 * G), art: "teil", sorte: null, nach: kreis };
    p.bus.emit("challenge:stand", stand("s1", [wrack, kreis]));
    p.l.takt(DT);
    // weit weg und tiefer als das Dach + 1,5 m: erst hoch, dann hinueber (sonst schiebt die Spinne das Wrack weg)
    expect(letzte(p)).toEqual([{ fn: "boom", richtung: "plus" }, { fn: "cab", richtung: "plus" }]);
    // drueber, Sensor 1,3 m ueber dem Dach → zupacken (Wrack-Schwelle 1,5 m, Attrappe ohne `aufgesessen`)
    p.z.cabYaw = 30 * G;
    p.z.spinne = { x: wrack.x, y: 3.9, z: wrack.z };
    p.l.takt(DT);
    expect(letzte(p)).toEqual([{ fn: "grapple", richtung: "plus" }]);
    // gefasst: die Teil-Marke ist weg, der Kreis bleibt
    p.bus.emit("challenge:stand", stand("s1", [kreis]));
    p.l.takt(DT);
    expect(letzte(p)).toEqual([{ fn: "boom", richtung: "plus" }]);
  });

  it("am Spiel (mit `aufgesessen`): zupacken erst, wenn die Spinne aufsitzt — nicht nach der Hoehe der Marke", () => {
    const p = probe(daten([schritt({ art: "station", beobachtet: "wrack_gefasst" }, { station: "s1" }), DAHINTER]));
    p.bus.emit("challenge:stand", stand("s1", [{ x: 0, y: 2.9, z: R0, art: "teil", sorte: null, nach: null }]));
    p.z.aufgesessen = false;
    p.z.spinne.y = 3.6; // nur 0,7 m ueber dem hoechsten Punkt (Fahrerhaus) — der Rahmen liegt tiefer
    p.l.takt(DT);
    expect(letzte(p)).toEqual([{ fn: "boom", richtung: "minus" }]);
    p.z.aufgesessen = true;
    p.z.spinne.y = 2.4;
    p.l.takt(DT);
    expect(letzte(p)).toEqual([{ fn: "grapple", richtung: "plus" }]);
    // beim Schliessen hebt sie sich, der Arm drueckt nicht mehr: bleibt „zupacken"
    p.z.aufgesessen = false;
    p.z.spinne.y = 2.6;
    p.l.takt(DT);
    expect(letzte(p)).toEqual([{ fn: "grapple", richtung: "plus" }]);
  });

  it("leer zu: erst ganz oeffnen, dann neu ansetzen", () => {
    const p = probe(daten([schritt({ art: "station", beobachtet: "teil_gefasst" }, { station: "s1" }), DAHINTER]));
    p.bus.emit("challenge:stand", stand("s1", [teilBei(0)]));
    p.z.spinne.y = 1.2;
    p.z.closure = 1;
    p.l.takt(DT);
    expect(letzte(p)).toEqual([{ fn: "grapple", richtung: "minus" }]);
    p.z.closure = 0.5;
    p.l.takt(DT);
    expect(letzte(p), "halb offen reicht nicht").toEqual([{ fn: "grapple", richtung: "minus" }]);
    p.z.closure = 0.05;
    p.l.takt(DT);
    expect(letzte(p)).toEqual([{ fn: "grapple", richtung: "plus" }]);
  });

  it("Haemmern: ueber dem Wrack senken; sass sie weich auf, erst ausholen, dann wieder runter", () => {
    const p = probe(daten([schritt({ art: "station", beobachtet: "wrack_gehauen" }, { station: "s1" }), DAHINTER]));
    p.bus.emit("challenge:stand", stand("s1", [{ x: 0, y: 2.4, z: R0, art: "teil", sorte: null, nach: null }]));
    p.z.spinne.y = 5.0;
    p.l.takt(DT);
    expect(letzte(p)).toEqual([{ fn: "boom", richtung: "minus" }]);
    p.z.aufgesessen = true; // aufgesetzt, kein Schlag gezaehlt
    p.z.spinne.y = 3.6;
    p.l.takt(DT);
    expect(letzte(p)).toEqual([{ fn: "boom", richtung: "plus" }]);
    p.z.aufgesessen = false;
    p.z.spinne.y = 4.8; // 2,4 + 1,5 + 1,0 = 4,9 noch nicht
    p.l.takt(DT);
    expect(letzte(p)).toEqual([{ fn: "boom", richtung: "plus" }]);
    p.z.spinne.y = 5.0;
    p.l.takt(DT);
    expect(letzte(p)).toEqual([{ fn: "boom", richtung: "minus" }]);
  });

  it("Einwurf-Schritte (Magnet, Sortieren) lotsen wie Ablegen", () => {
    const p = probe(daten([schritt({ art: "ereignis", ereignis: "einwurf", anzahl: 1 }, { station: "s1" }), DAHINTER]));
    p.bus.emit("challenge:stand", stand("s1", [teilBei(55 * G)]));
    p.l.takt(DT);
    expect(letzte(p)).toEqual([{ fn: "cab", richtung: "plus" }]);
  });

  it("Drehen: der Rotator in Richtung der Vorfuehrung", () => {
    const i = L.schritte.findIndex((s) => s.symbol === "rotator");
    const p = probe(L, i);
    p.bus.emit("lehrgang:vorfuehrungEnde", { abgebrochen: true });
    expect(letzte(p)).toEqual([{ fn: "rotator", richtung: "plus" }]);
    p.z.rotator = -10 * G;
    p.l.takt(DT);
    expect(letzte(p)).toEqual([{ fn: "rotator", richtung: "minus" }]);
  });

  it("Zurueck, Kranz, Stuetzen, Zerlegen, Pressen, Hupe: leerer Bedarf", () => {
    for (const sym of ["zurueck", "kranz", "stuetzen", "zerlegen", "pressen", "hupe"]) {
      const i = L.schritte.findIndex((s) => s.symbol === sym);
      const p = probe(L, i);
      p.bus.emit("challenge:stand", stand(stationVon(L.schritte, i) ?? "-", [teilBei(20 * G)]));
      p.l.takt(DT);
      // `zurueck` steht gleich am Start und hat das Haekchen; der Bedarf kam vorher
      expect(p.richtung.length, sym).toBeGreaterThan(0);
      for (const r of p.richtung) expect(r.bedarf, sym).toEqual([]);
    }
  });
});

/* ------------------------------------------------------------------------ */
/* 4. Daten                                                                 */
/* ------------------------------------------------------------------------ */

describe("Lehrgang Teil 2: Daten", () => {
  it("24 Schritte: 9 Grundsteuerung, 15 in der Welt; Teil 2 ohne Vorfuehrung ausser Drehen", () => {
    expect(L.schritte.length).toBe(24);
    const t2 = L.schritte.slice(9);
    expect(t2[0]!.symbol).toBe("zurueck");
    expect(L.schritte.slice(0, 9).every((s) => s.station === undefined && s.kranz === undefined)).toBe(true);
    expect(t2.filter((s) => s.vorfuehrung).map((s) => s.symbol)).toEqual(["rotator"]);
  });

  it("jede Station gibt es im Katalog, und jede Station-Beobachtung kommt in DIESER Pruefung vor", () => {
    L.schritte.forEach((s, i) => {
      const id = stationVon(L.schritte, i);
      if (s.station) expect(challengeNach(s.station), s.station).not.toBeNull();
      if (s.ziel.art !== "station") return;
      expect(id, `Schritt ${i + 1}: Station-Ziel ohne Station`).not.toBeNull();
      const c = challengeNach(id!)!;
      expect(c.schritte.map((x) => x.beobachtet), `Schritt ${i + 1} (${s.symbol}) in ${id}`).toContain(s.ziel.beobachtet);
    });
  });

  it("Kranz-Schritte tippen auf den Kranz: aufklappen, STUETZEN, PRESSE, HUPE (Tastencodes wie core/touch.ts)", () => {
    const k = L.schritte.filter((s) => s.kranz).map((s) => [s.symbol, s.kranz!.code]);
    expect(k).toEqual([
      ["kranz", null],
      ["stuetzen", "KeyO"],
      ["pressen", "KeyB"],
      ["hupe", "Digit2"],
    ]);
  });

  it("der Magnet kommt mit seinem Aufbau, danach wieder die Fuenfschalen", () => {
    const greifer = L.schritte.filter((s) => s.station).map((s) => [s.station, challengeNach(s.station!)!.aufbau.greifer]);
    expect(greifer).toContainEqual(["magnet", "magnet"]);
    expect(greifer.at(-1)).toEqual(["sortieren", "fuenfschalen"]);
  });
});
