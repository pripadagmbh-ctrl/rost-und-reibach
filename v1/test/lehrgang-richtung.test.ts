/**
 * LEHRGANG, L5-B (Gerätebefund Patrick 22.10.2026, Punkte 40c und 40f).
 *
 * 40c „Zoom-Schritt: erst Rein- und Rauszoomen soll ihn erfüllen": Ziel
 * `hinUndZurueck` = zwei Teilziele, das erste meldet `lehrgang:teilziel`, das
 * zweite das Häkchen; Reihenfolge egal. Gegenprobe „beide": eins reicht.
 *
 * 40f „nicht klar, dass nach links geschwenkt werden muss": Der Lauf sagt in
 * „du", was gerade zum Ziel führt (`lehrgang:richtung`), der Geisterdaumen
 * übersetzt es über die Belegung des Spielers auf Stick und Pfeil.
 *
 * Rein, mit Attrappen wie `test/lehrgang.test.ts` Teil 1.
 */
import { describe, expect, it } from "vitest";
import { EventBus, type GameEvents } from "../src/core/events";
import { LektionLauf, markeBedarf, type LektionDaten, type LektionZiel, type LektionZustand } from "../src/challenges/lektion";
import { LEKTIONEN } from "../src/challenges/lehrgang";
import { daumenAusBedarf } from "../src/ui/geisterdaumen";
import { defaultConfig } from "../src/core/controlConfig";

const G = Math.PI / 180;
const DT = 1 / 60;

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
    spinne: { x: 0, y: 1, z: 8 },
    kamera: { modus: "orbit", gier: Math.PI, nick: 0.42, abstand: 11 },
  };
}

/** Ein Schritt ohne Vorfuehrung (gleich „du"), dahinter ein zweiter, damit nach dem Haekchen nichts endet */
function lauf(ziel: LektionZiel, z = zustand()) {
  const d: LektionDaten = {
    id: "probe",
    name: { de: "P", en: "P" },
    ziel: { de: "Z", en: "Z" },
    beschreibung: { de: "B", en: "B" },
    schritte: [
      { titel: { de: "1", en: "1" }, text: { de: "t", en: "t" }, zeige: null, vorfuehrung: null, ziel },
      { titel: { de: "2", en: "2" }, text: { de: "t", en: "t" }, zeige: null, vorfuehrung: null, ziel: { art: "ansicht", modus: "top" } },
    ],
  };
  const bus = new EventBus();
  const log: string[] = [];
  const richtung: GameEvents["lehrgang:richtung"][] = [];
  const schritte: GameEvents["lehrgang:schritt"][] = [];
  bus.on("lehrgang:schritt", (e) => schritte.push(e));
  bus.on("lehrgang:teilziel", (e) => log.push(`teil ${e.nr} ${e.teil}/${e.von}`));
  bus.on("lehrgang:haekchen", (e) => log.push(`haekchen ${e.nr}`));
  bus.on("lehrgang:richtung", (e) => richtung.push(e));
  const l = new LektionLauf(d, 1, 1, { zustand: () => ({ ...z, kamera: { ...z.kamera }, spinne: { ...z.spinne } }) }, bus);
  l.start();
  return { l, z, log, richtung, schritte };
}

const ZOOM: LektionZiel = { art: "aenderung", groesse: "zoom", richtung: "hinUndZurueck", ab: 0.25 };

describe("40c: Zoom mit zwei Teilzielen", () => {
  it("der Lehrgang verlangt beim Zoomen rein UND raus", () => {
    const st = LEKTIONEN[0]!.schritte.find((s) => s.ziel.art === "aenderung" && s.ziel.groesse === "zoom")!;
    expect(st.ziel).toMatchObject({ richtung: "hinUndZurueck" });
  });

  it("nur rein: Teilziel 1 von 2, kein Häkchen; dann raus: Häkchen — `teile` schon beim Schrittbeginn", () => {
    const { l, z, log, schritte } = lauf(ZOOM);
    expect(schritte[0]!.teile).toBe(2);
    z.kamera.abstand = 11 * 0.7; // 30 % näher
    l.takt(DT);
    l.takt(DT);
    expect(log).toEqual(["teil 1 1/2"]); // genau einmal
    z.kamera.abstand = 11 * 0.7 + 11 * 0.24; // zurück, aber noch kein Viertel
    l.takt(DT);
    expect(log).toEqual(["teil 1 1/2"]);
    z.kamera.abstand = 11 * 0.7 + 11 * 0.26;
    l.takt(DT);
    expect(log).toEqual(["teil 1 1/2", "haekchen 1"]);
  });

  it("Reihenfolge egal: erst raus, dann rein", () => {
    const { l, z, log } = lauf(ZOOM);
    z.kamera.abstand = 11 * 1.3;
    l.takt(DT);
    expect(log).toEqual(["teil 1 1/2"]);
    z.kamera.abstand = 11 * 1.3 - 11 * 0.26;
    l.takt(DT);
    expect(log).toEqual(["teil 1 1/2", "haekchen 1"]);
  });

  it("Gegenprobe „beide“: nur rein reicht, ohne Teilziel; `teile` = 1", () => {
    const { l, z, log, schritte } = lauf({ ...ZOOM, richtung: "beide" });
    expect(schritte[0]!.teile).toBe(1);
    z.kamera.abstand = 11 * 0.7;
    l.takt(DT);
    expect(log).toEqual(["haekchen 1"]);
  });

  it("der Kamera-Geist bekommt die fehlende Geste: erst spreizen (näher), nach Teilziel 1 kneifen", () => {
    const { l, z, richtung } = lauf(ZOOM);
    expect(richtung.map((r) => r.kamera)).toEqual(["zu"]); // ohne Spur: plus = weiter weg zuerst
    z.kamera.abstand = 11 * 0.85; // er zoomt rein — das zählt jetzt
    l.takt(DT);
    expect(richtung.at(-1)!.kamera).toBe("auf");
    z.kamera.abstand = 11 * 0.7;
    l.takt(DT);
    expect(richtung.at(-1)!.kamera).toBe("zu");
    expect(richtung.every((r) => r.bedarf.length === 0)).toBe(true);
  });

  it("am Zoom-Anschlag zuerst die andere Richtung", () => {
    const z = zustand();
    z.kamera.abstand = 3.2; // fast ganz nah (Grenze 3 m)
    const { richtung } = lauf({ ...ZOOM, richtung: "minus" }, z);
    expect(richtung[0]!.kamera).toBe("zu");
  });
});

describe("40f: Richtung zum Ziel (lehrgang:richtung)", () => {
  // Marke 30° links (cab+) auf 8 m — wie der Lehrgang sie legt
  const M = { x: 8 * Math.sin(30 * G), z: 8 * Math.cos(30 * G), radiusM: 0.5 };
  const bei = (winkel: number, r: number): LektionZustand => ({ ...zustand(), spinne: { x: r * Math.sin(winkel), y: 1, z: r * Math.cos(winkel) } });

  it("Spinne rechts neben der Marke: nach links schwenken (cab plus); links daneben: cab minus", () => {
    expect(markeBedarf(bei(0, 8), M, true).bedarf).toEqual([{ fn: "cab", richtung: "plus" }]);
    expect(markeBedarf(bei(50 * G, 8), M, true).bedarf).toEqual([{ fn: "cab", richtung: "minus" }]);
    // Die Drehmitte steht nicht im Ursprung, der Unterwagen ist gedreht — es zählt nur der Winkel um die Drehmitte
    const z = bei(0, 8);
    const v = { x: 5, z: -3 };
    const verschoben = { ...z, x: v.x, z: v.z, heading: 1.0, spinne: { ...z.spinne, x: z.spinne.x + v.x, z: z.spinne.z + v.z } };
    expect(markeBedarf(verschoben, { ...M, x: M.x + v.x, z: M.z + v.z }, true).bedarf).toEqual([{ fn: "cab", richtung: "plus" }]);
  });

  it("Winkel stimmt, Ausladung zu weit: heranholen = Stiel ein (minus), Hauptarm hoch (Höhe halten); zu nah: umgekehrt", () => {
    expect(markeBedarf(bei(30 * G, 9.5), M, false).bedarf).toEqual([
      { fn: "boom", richtung: "plus" },
      { fn: "stick", richtung: "minus" },
    ]);
    expect(markeBedarf(bei(30 * G, 6.5), M, false).bedarf).toEqual([
      { fn: "boom", richtung: "minus" },
      { fn: "stick", richtung: "plus" },
    ]);
  });

  it("Stiel waagrecht (größte Ausladung, Browserlauf 22.10.): nur der Hauptarm — senken schiebt hinaus", () => {
    // Hauptarm 68°, Stiel genau waagrecht: Der Stiel ändert die Ausladung nicht mehr, sein Pfeil kippte bei jedem Ruck
    const z = { ...bei(30 * G, 6.3), boom: 68 * G, stick: -68 * G };
    expect(markeBedarf(z, M, false).bedarf).toEqual([{ fn: "boom", richtung: "minus" }]);
  });

  it("Stiel am Anschlag: der Hauptarm allein; Hysterese hält das Schwenken bis 0,75 × Halbmesser seitlich", () => {
    const z = { ...bei(30 * G, 9.5), stick: -140 * G };
    expect(markeBedarf(z, M, false).bedarf.map((b) => b.fn)).toEqual(["boom"]);
    // 0,3 m seitlich (zwischen 0,25 und 0,375): wer schwenkt, schwenkt weiter; wer einfährt, fährt weiter ein
    const seitlich = bei(30 * G - 0.3 / 8, 9.5);
    expect(markeBedarf(seitlich, M, true).bedarf).toEqual([{ fn: "cab", richtung: "plus" }]);
    expect(markeBedarf(seitlich, M, false).bedarf.map((b) => b.fn)).toEqual(["boom", "stick"]);
  });

  it("der Lauf sendet in „du“ nur bei Änderung — Marke: erst schwenken, dann einfahren", () => {
    const z = bei(0, 9.5);
    const { l, richtung } = lauf({ art: "marke", radialM: 0, schwenkRad: 30 * G, radiusM: 0.5 }, z);
    expect(l.marke!.x).toBeCloseTo(9.5 * Math.sin(30 * G));
    expect(richtung.map((r) => r.bedarf)).toEqual([[{ fn: "cab", richtung: "plus" }]]);
    l.takt(DT);
    l.takt(DT);
    expect(richtung.length, "gleiche Lage, kein neues Ereignis").toBe(1);
    // auf den Winkel geschwenkt, aber 1 m zu weit draußen (die Marke liegt auf 9,5 m)
    z.spinne = { x: 10.5 * Math.sin(30 * G), y: 1, z: 10.5 * Math.cos(30 * G) };
    l.takt(DT);
    expect(richtung.at(-1)!.bedarf).toEqual([
      { fn: "boom", richtung: "plus" },
      { fn: "stick", richtung: "minus" },
    ]);
    expect(richtung.at(-1)).toMatchObject({ id: "probe", nr: 1, kamera: null });
  });

  it("Hauptarm „plus“ am Anschlag: erst senken (minus), sobald Platz ist heben", () => {
    const z = { ...zustand(), boom: 65 * G };
    const { l, richtung } = lauf({ art: "aenderung", groesse: "boom", richtung: "plus", ab: 10 * G }, z);
    expect(richtung[0]!.bedarf).toEqual([{ fn: "boom", richtung: "minus" }]);
    z.boom = 58 * G; // 58 + 10 = 68 < 70 − 1
    l.takt(DT);
    expect(richtung.at(-1)!.bedarf).toEqual([{ fn: "boom", richtung: "plus" }]);
  });

  it("„beide“: Einzelpfeil — erst die Richtung der Vorführung (ohne Spur plus), dann die, in die der Spieler schon fährt", () => {
    const z = zustand();
    const { l, richtung } = lauf({ art: "aenderung", groesse: "cabYaw", richtung: "beide", ab: 20 * G }, z);
    expect(richtung[0]!.bedarf).toEqual([{ fn: "cab", richtung: "plus" }]);
    z.cabYaw = -5 * G;
    l.takt(DT);
    expect(richtung.at(-1)!.bedarf).toEqual([{ fn: "cab", richtung: "minus" }]);
  });

  it("Schritte ohne Richtung (Fahren, Kamera drehen, Ansicht) senden nichts — der Geist bleibt bei der Spur", () => {
    for (const ziel of [
      { art: "aenderung", groesse: "fahrt", richtung: "beide", ab: 1.5 },
      { art: "aenderung", groesse: "kameraGier", richtung: "beide", ab: 0.4 },
      { art: "ansicht", modus: "gewechselt" },
    ] as LektionZiel[])
      expect(lauf(ziel).richtung).toEqual([]);
  });
});

describe("40f: Geisterdaumen übersetzt `bedarf` über die Belegung", () => {
  const MARKE_ARM: GameEvents["lehrgang:richtung"]["bedarf"] = [
    { fn: "boom", richtung: "plus" },
    { fn: "stick", richtung: "minus" },
  ];
  it("Grundbelegung: schwenken links = linker Stick nach links; heranholen = links hoch, rechts runter", () => {
    const c = defaultConfig();
    expect(daumenAusBedarf([{ fn: "cab", richtung: "plus" }], c)).toEqual([{ seite: "links", pfeil: "links" }]);
    expect(daumenAusBedarf([{ fn: "cab", richtung: "minus" }], c)).toEqual([{ seite: "links", pfeil: "rechts" }]);
    expect(daumenAusBedarf(MARKE_ARM, c)).toEqual([
      { seite: "links", pfeil: "hoch" },
      { seite: "rechts", pfeil: "runter" },
    ]);
    expect(daumenAusBedarf([], c)).toEqual([]);
  });

  it("umgedreht: Drehen ohne Umkehr = nach rechts, Hauptarm ohne Umkehr = runter", () => {
    const c = defaultConfig();
    c.leftX.invert = false;
    c.leftY.invert = false;
    expect(daumenAusBedarf([{ fn: "cab", richtung: "plus" }], c)).toEqual([{ seite: "links", pfeil: "rechts" }]);
    expect(daumenAusBedarf(MARKE_ARM, c)[0]).toEqual({ seite: "links", pfeil: "runter" });
  });

  it("getauscht: Drehkranz rechts quer, Spinne links — der Pfeil wandert mit; zwei Funktionen auf einem Stick: die erste", () => {
    const c = defaultConfig();
    c.leftX = { fn: "grapple", invert: false };
    c.rightX = { fn: "cab", invert: true };
    expect(daumenAusBedarf([{ fn: "cab", richtung: "plus" }], c)).toEqual([{ seite: "rechts", pfeil: "links" }]);
    const zwei = defaultConfig();
    zwei.leftX = { fn: "stick", invert: false };
    zwei.rightY = { fn: "grapple", invert: false };
    expect(daumenAusBedarf(MARKE_ARM, zwei)).toEqual([{ seite: "links", pfeil: "hoch" }]);
    // Funktion auf keinem Stick: fällt weg
    const ohne = defaultConfig();
    ohne.leftX = { fn: "none", invert: false };
    expect(daumenAusBedarf([{ fn: "cab", richtung: "plus" }], ohne)).toEqual([]);
  });
});
