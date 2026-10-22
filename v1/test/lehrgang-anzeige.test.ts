/**
 * LEHRGANG, BEDIENSEITE (E-196): Wiedergabe der Vorführung, Lektionskarte,
 * Fortschritt, Menü-Logik, Geisterdaumen-Folgen.
 *
 * Ohne DOM: geprüft werden die reinen Teile (`spurWerte`, `kameraZwischen`,
 * `leistenBild`, `lehrgangAus`, `startWahl`, `stickAusschlag` …) und
 * die Wiedergabe-Klasse an einem echten Bus mit einem Schreibziel aus Zahlen.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventBus, type GameEvents } from "../src/core/events";
import type { Spur } from "../src/core/spur";
import { KAMERA_ZURUECK, SPUR_ACHSEN, Wiedergabe, kameraZwischen, spurWerte, type WiedergabeZiel } from "../src/core/wiedergabe";
import { BILD, leistenBild, schrittSymbol } from "../src/ui/lektionskarte";
import {
  LEHRGANG_KEY,
  lehrgangAus,
  leererLehrgang,
  leseLehrgang,
  lehrgangEinstieg,
  merkeLehrgangBegonnen,
  merkeLehrgangFertig,
  merkeLehrgangSchritt,
  merkeLehrgangUebersprungen,
} from "../src/core/save";
import { ersterStart, lehrgangKlein, startWahl, wahlAusAdresse } from "../src/ui/hauptmenue";
import { daumenAusSpur, daumenBild, kameraAusSpur, kameraGeste, pedaleLeuchten, stickAusschlag, tastenText } from "../src/ui/geisterdaumen";
import { LEKTIONEN } from "../src/challenges/lehrgang";
import type { SpurAchse } from "../src/core/spur";
import { defaultConfig } from "../src/core/controlConfig";
import { WORTE } from "../src/ui/aufgabentexte";

// --- Eine Spur wie in einer Lektion: heben, Ansicht, drehen, zurück
const SPUR: Spur = [
  { dauerS: 1, achsen: { boom: 0.8 } },
  { dauerS: 0, tasten: ["KeyO"] },
  { dauerS: 2, achsen: { cab: -1, grapple: 2 }, kamera: { gierProS: 100 } },
  { dauerS: 1, kamera: { zoomProS: 0.5, zuruecksetzen: true } },
];

function ziel(): WiedergabeZiel & { gedrueckt: string[]; daumen: boolean } {
  const z = {
    achsen: { cab: 0, boom: 0, stick: 0, grapple: 0, rotator: 0, drive: 0, steer: 0, grab: true },
    kamera: { orbitDX: 0, orbitDY: 0, zoomFactor: 1, camReset: false },
    gedrueckt: [] as string[],
    daumen: false,
    druecke(code: string) {
      z.gedrueckt.push(code);
    },
    eingriff: () => z.daumen,
  };
  return z;
}

// Wie main.ts (FIXED_DT, MAX_STEPS_PER_FRAME)
const FIXED_DT = 1 / 60;
const MAX_STEPS = 5;

/**
 * Die Bildschleife von main.ts: `takt` je Bild, dann Physikschritte aus dem
 * Akkumulator (höchstens 5, Rest verworfen), je Schritt `schritt(FIXED_DT)`
 * und `beimSchritt` (liest, was die Physik bekäme). Am Bildende räumt
 * `input.endFrame` die Kamera-Deltas weg — hier summieren wir sie vorher.
 */
function schleife(w: Wiedergabe, z: ReturnType<typeof ziel>, bilder: number[], beimSchritt?: () => void) {
  const summe = { dx: 0, dy: 0, zoom: 1, resets: 0 };
  let acc = 0;
  for (const dt of bilder) {
    w.takt(dt);
    acc += dt;
    let n = 0;
    while (acc >= FIXED_DT && n < MAX_STEPS) {
      w.schritt(FIXED_DT);
      beimSchritt?.();
      acc -= FIXED_DT;
      n++;
    }
    if (n === MAX_STEPS) acc = 0;
    summe.dx += z.kamera.orbitDX;
    summe.dy += z.kamera.orbitDY;
    summe.zoom *= z.kamera.zoomFactor;
    if (z.kamera.camReset) summe.resets++;
    z.kamera.orbitDX = 0;
    z.kamera.orbitDY = 0;
    z.kamera.zoomFactor = 1;
    z.kamera.camReset = false;
  }
  return summe;
}

/** Gleichmäßige Bilder über `sekunden` */
function laufe(w: Wiedergabe, z: ReturnType<typeof ziel>, sekunden: number, dt = 1 / 60) {
  return schleife(w, z, Array.from({ length: Math.round(sekunden / dt) }, () => dt));
}

describe("Wiedergabe: Werte zur Zeit t (rein)", () => {
  it("Abschnitt für Abschnitt, fehlende Achsen 0, Werte auf ±1 begrenzt", () => {
    expect(spurWerte(SPUR, 0.5).achsen).toEqual({ cab: 0, boom: 0.8, stick: 0, grapple: 0, rotator: 0, drive: 0, steer: 0 });
    const w = spurWerte(SPUR, 1.5);
    expect(w.abschnitt).toBe(2); // der Abschnitt der Dauer 0 ist nie „laufend"
    expect(w.achsen.cab).toBe(-1);
    expect(w.achsen.grapple).toBe(1);
    expect(w.kamera?.gierProS).toBe(100);
    expect(spurWerte(SPUR, 4).abschnitt).toBe(-1);
    expect(Object.values(spurWerte(SPUR, 4).achsen).every((v) => v === 0)).toBe(true);
  });
  it("Kamera über Abschnittsgrenzen genau aufsummiert, Zoom als Potenz", () => {
    expect(kameraZwischen(SPUR, 0, 4).dx).toBeCloseTo(200);
    expect(kameraZwischen(SPUR, 0.5, 1.5).dx).toBeCloseTo(50);
    expect(kameraZwischen(SPUR, 3, 4).zoom).toBeCloseTo(0.5);
    expect(kameraZwischen(SPUR, 3, 3.5).zoom).toBeCloseTo(Math.SQRT1_2);
  });
});

describe("Wiedergabe am Bus", () => {
  it("schreibt Achsen, drückt jede Taste genau einmal, Kamera-Gesten wie der Mittelstreifen", () => {
    const bus = new EventBus();
    const z = ziel();
    const w = new Wiedergabe(bus, z);
    const ende: boolean[] = [];
    bus.on("lehrgang:vorfuehrungEnde", (e) => ende.push(e.abgebrochen));
    bus.emit("lehrgang:vorfuehren", { spur: SPUR });
    expect(w.laeuft).toBe(true);
    laufe(w, z, 0.5);
    expect(z.achsen.boom).toBe(0.8);
    expect(z.achsen.grab).toBe(false);
    expect(z.gedrueckt).toEqual([]);
    laufe(w, z, 1);
    expect(z.gedrueckt).toEqual(["KeyO"]);
    expect(z.achsen.cab).toBe(-1);
    expect(z.achsen.boom).toBe(0);
    expect(w.gedrueckt?.codes).toEqual(["KeyO"]);
    const rest = laufe(w, z, 3);
    expect(z.gedrueckt).toEqual(["KeyO"]); // nicht ein zweites Mal
    expect(rest.resets).toBe(1);
    expect(ende).toEqual([false]);
    expect(w.laeuft).toBe(false);
    expect(w.werte).toBeNull();
    expect(Object.values(z.achsen).filter((v) => v !== 0 && v !== false)).toEqual([]);
  });
  it("die Kamera bekommt in Summe genau die Spur (60 Hz wie 30 Hz)", () => {
    for (const dt of [1 / 60, 1 / 30]) {
      const bus = new EventBus();
      const z = ziel();
      const w = new Wiedergabe(bus, z);
      bus.emit("lehrgang:vorfuehren", { spur: SPUR });
      const s = laufe(w, z, 4.2, dt);
      expect(s.dx).toBeCloseTo(200, 6);
      expect(s.zoom).toBeCloseTo(0.5, 6);
    }
  });
  it("Antippen der Karte (lehrgang:abbrechen) bricht ab: Achsen 0, Ende mit abgebrochen", () => {
    const bus = new EventBus();
    const z = ziel();
    const w = new Wiedergabe(bus, z);
    const ende: boolean[] = [];
    bus.on("lehrgang:vorfuehrungEnde", (e) => ende.push(e.abgebrochen));
    bus.emit("lehrgang:vorfuehren", { spur: SPUR });
    laufe(w, z, 0.5);
    bus.emit("lehrgang:abbrechen", {});
    expect(ende).toEqual([true]);
    expect(z.achsen.boom).toBe(0);
    bus.emit("lehrgang:abbrechen", {}); // zweimal ist kein zweites Ende
    expect(ende).toEqual([true]);
  });
  it("ein Daumen, der AUFSETZT, bricht ab — einer, der schon lag, erst nach dem Heben", () => {
    const bus = new EventBus();
    const z = ziel();
    const w = new Wiedergabe(bus, z);
    const ende: boolean[] = [];
    bus.on("lehrgang:vorfuehrungEnde", (e) => ende.push(e.abgebrochen));
    z.daumen = true; // lag schon
    bus.emit("lehrgang:vorfuehren", { spur: SPUR });
    laufe(w, z, 0.3);
    expect(ende).toEqual([]);
    expect(z.achsen.boom).toBe(0.8); // die Spur überschreibt ihn
    z.daumen = false;
    laufe(w, z, 0.1);
    z.daumen = true;
    laufe(w, z, 1 / 60);
    expect(ende).toEqual([true]);
    expect(z.achsen.boom).toBe(0);
  });
  it("Neustart der Lektion beendet still (kein Ende an den Lauf)", () => {
    const bus = new EventBus();
    const z = ziel();
    const w = new Wiedergabe(bus, z);
    const ende: boolean[] = [];
    bus.on("lehrgang:vorfuehrungEnde", (e) => ende.push(e.abgebrochen));
    bus.emit("lehrgang:vorfuehren", { spur: SPUR });
    laufe(w, z, 0.5);
    bus.emit("lehrgang:start", { id: "x", nr: 1, von: 12, name: { de: "", en: "" }, ziel: { de: "", en: "" } });
    expect(w.laeuft).toBe(false);
    expect(z.achsen.boom).toBe(0);
    expect(ende).toEqual([]);
  });
  it("der Lauf darf im Ende-Zuhörer gleich die nächste Spur schicken", () => {
    const bus = new EventBus();
    const z = ziel();
    const w = new Wiedergabe(bus, z);
    let n = 0;
    bus.on("lehrgang:vorfuehrungEnde", () => {
      if (n++ === 0) bus.emit("lehrgang:vorfuehren", { spur: [{ dauerS: 1, achsen: { stick: 0.5 } }] });
    });
    bus.emit("lehrgang:vorfuehren", { spur: [{ dauerS: 0.1, achsen: { boom: 1 } }] });
    laufe(w, z, 0.2);
    expect(w.laeuft).toBe(true);
    expect(z.achsen.stick).toBe(0.5);
  });
});

describe("Wiedergabe in Physikzeit (L2b)", () => {
  /** SW: erst 10 Bilder à 0,25 s (Laden, qa 3–15 fps), dann 400 gemischte 0,016–0,1 s, fest gewürfelt */
  function ruckelnd(): number[] {
    let x = 12345;
    const zufall = (): number => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648;
    return [...Array<number>(10).fill(0.25), ...Array.from({ length: 400 }, () => 0.016 + zufall() * 0.084)];
  }
  const spuren = LEKTIONEN.flatMap((l) => l.schritte.flatMap((st, i) => (st.vorfuehrung ? [{ name: `${l.id}/${i + 1}`, spur: st.vorfuehrung }] : [])));

  for (const { name, spur } of spuren) {
    it(`Vorführung endet in der Startlage bei ungleichen Bildern: ${name}`, () => {
      const bus = new EventBus();
      const z = ziel();
      const w = new Wiedergabe(bus, z);
      let schritte = 0;
      const tasten: Array<{ code: string; nachSchritten: number }> = [];
      z.druecke = (code) => void tasten.push({ code, nachSchritten: schritte });
      const angelegt = Object.fromEntries(SPUR_ACHSEN.map((a) => [a, 0])) as Record<SpurAchse, number>;
      const jeAbschnitt = spur.map(() => 0);
      bus.emit("lehrgang:vorfuehren", { spur });
      const k = schleife(w, z, ruckelnd(), () => {
        schritte++;
        for (const a of SPUR_ACHSEN) angelegt[a] += z.achsen[a] * FIXED_DT;
        const i = w.werte?.abschnitt ?? -1;
        if (i >= 0) jeAbschnitt[i]!++;
      });
      expect(w.laeuft).toBe(false);
      // Jeder Abschnitt bekommt genau seine Dauer in Physikschritten
      expect(jeAbschnitt).toEqual(spur.map((a) => Math.round(a.dauerS / FIXED_DT)));
      // Summe der angelegten Achsen-Zeit = Spur; Hin- und Rückweg heben sich auf
      for (const a of SPUR_ACHSEN) {
        const soll = spur.reduce((s2, ab) => s2 + (ab.achsen?.[a] ?? 0) * ab.dauerS, 0);
        expect(angelegt[a], a).toBeCloseTo(soll, 9);
        expect(angelegt[a], a).toBeCloseTo(0, 9);
      }
      const kSoll = kameraZwischen(spur, 0, Infinity);
      expect(k.dx).toBeCloseTo(kSoll.dx, 9);
      expect(k.dy).toBeCloseTo(kSoll.dy, 9);
      expect(k.zoom).toBeCloseTo(kSoll.zoom, 9);
      // Tasten: jede genau einmal, spätestens ein Bild (≤ 5 Schritte) nach dem Beginn ihres Abschnitts
      let t = 0;
      const soll: Array<{ code: string; ab: number }> = [];
      for (const ab of spur) {
        for (const c of ab.tasten ?? []) soll.push({ code: c, ab: Math.round(t / FIXED_DT) });
        t += ab.dauerS;
      }
      expect(tasten.map((x) => x.code)).toEqual(soll.map((x) => x.code));
      tasten.forEach((x, i) => {
        expect(x.nachSchritten).toBeGreaterThanOrEqual(soll[i]!.ab);
        expect(x.nachSchritten - soll[i]!.ab).toBeLessThanOrEqual(MAX_STEPS);
      });
    });
  }

  it("in Bildern ohne Physikschritt läuft die Spur nicht weiter", () => {
    const bus = new EventBus();
    const z = ziel();
    const w = new Wiedergabe(bus, z);
    bus.emit("lehrgang:vorfuehren", { spur: [{ dauerS: 0.1, achsen: { boom: 1 } }] });
    for (let i = 0; i < 100; i++) w.takt(0.25); // Bilder ohne Schritt (autoStep aus)
    expect(w.laeuft).toBe(true);
  });

  it("Gesten des Spielers zählen während der Vorführung nicht (Spur überschreibt)", () => {
    const bus = new EventBus();
    const z = ziel();
    const w = new Wiedergabe(bus, z);
    z.daumen = true; // lag schon, bricht nicht ab
    bus.emit("lehrgang:vorfuehren", { spur: [{ dauerS: 1, kamera: { gierProS: 60 } }] });
    let summe = 0;
    for (let i = 0; i < 70 && w.laeuft; i++) {
      z.kamera.orbitDX = 5; // er wischt weiter
      z.kamera.zoomFactor = 1.1;
      w.takt(FIXED_DT);
      summe += z.kamera.orbitDX;
      expect(z.kamera.zoomFactor).toBe(1);
      w.schritt(FIXED_DT);
    }
    expect(summe).toBeCloseTo(60, 9);
  });
});

// --- Geisterdaumen in „du" aus der Spur (qa-Befunde 4, 5)
describe("Geisterdaumen in „du“: aus der Spur des Schritts", () => {
  const c = defaultConfig();
  // L3: ein Lehrgang — Schritte ueber ihr Symbol finden
  const schritt = (sym: string) => LEKTIONEN[0]!.schritte.find((st) => st.symbol === sym)!;
  it("Schritt „Auf die Marke“: beide Sticks, je Richtung des ersten Ausschlags", () => {
    const st = schritt("marke");
    const b = daumenAusSpur(st.vorfuehrung, st.zeige, c);
    expect(b.map((x) => x.seite).sort()).toEqual(["links", "rechts"]);
    // Werk: Hauptarm links längs umgekehrt → heben = hoch (nicht das Vorab-Schwenken links quer); Stiel aus zeige
    expect(b.find((x) => x.seite === "links")!.pfeil).toBe("hoch");
    expect(b.find((x) => x.seite === "rechts")).toEqual(daumenBild(st.zeige, c));
  });
  it("zeige behält seine Seite (Doppelpfeil bei „beide“), ohne Spur nur zeige", () => {
    const st = schritt("schwenken");
    expect(daumenAusSpur(st.vorfuehrung, st.zeige, c)).toEqual([daumenBild(st.zeige, c)]);
    expect(daumenAusSpur(null, { fn: "boom", richtung: "plus" }, c)).toEqual([daumenBild({ fn: "boom", richtung: "plus" }, c)]);
    expect(daumenAusSpur(null, null, c)).toEqual([]);
  });
  it("Fahren ohne zeige: linker Stick nach oben bzw. unten", () => {
    expect(daumenAusSpur(schritt("fahren").vorfuehrung, null, c)).toEqual([{ seite: "links", pfeil: "hoch" }]);
    // Rueckwaerts zuerst (seit L3 kein eigener Schritt mehr): runter
    expect(daumenAusSpur([{ dauerS: 1.2, achsen: { drive: -0.5 } }], null, c)).toEqual([{ seite: "links", pfeil: "runter" }]);
  });
  it("Kamera-Schritte: Geste aus der Spur, Doppeltipp hat Vorrang", () => {
    const s = LEKTIONEN[0]!.schritte.filter((st) => st.symbol === "kamera" || st.symbol === "ansicht");
    expect(s.map((st) => kameraAusSpur(st.vorfuehrung))).toEqual(["rechts", "auf", "", ""]);
    // Neigen und Zuruecksetzen sind seit L3 keine Schritte mehr — die Ableitung gilt weiter
    expect(kameraAusSpur([{ dauerS: 1, kamera: { nickProS: 80 } }])).toBe("runter");
    expect(kameraAusSpur([{ dauerS: 0.8, kamera: { gierProS: 150 } }, { dauerS: 0.8, kamera: { zuruecksetzen: true } }])).toBe("doppeltipp");
  });
});

// --- L4b: Pedale in „du" (qa Q4 Befund 1) — Spur × Fahrbetrieb
describe("Pedale leuchten in „du“, wenn der Fahrbetrieb nicht zum Schritt passt", () => {
  const c = defaultConfig();
  const st = (sym: string) => LEKTIONEN[0]!.schritte.find((x) => x.symbol === sym)!.vorfuehrung ?? null;
  it("Tabelle über die echten Lehrgangsschritte", () => {
    const tabelle = (["fahren", "schwenken", "arm", "stiel", "marke", "kamera"] as const).map((sym) => [
      sym,
      pedaleLeuchten(st(sym), false, c),
      pedaleLeuchten(st(sym), true, c),
    ]);
    expect(tabelle).toEqual([
      ["fahren", true, false], // fährt, Fahren aus → antippen
      ["schwenken", false, true], // Drehkranz links, Fahren noch an (aus Schritt 5) → antippen
      ["arm", false, true],
      ["stiel", false, false], // Stiel liegt rechts: der Fahrbetrieb stört nicht
      ["marke", false, true],
      ["kamera", false, false], // nur Kamera: egal
    ]);
  });
  it("Gegenprobe: ohne Spur nie; liegt der Stiel links, leuchtet auch der Stiel-Schritt", () => {
    expect(pedaleLeuchten(null, true, c)).toBe(false);
    expect(pedaleLeuchten(null, false, c)).toBe(false);
    const getauscht = defaultConfig();
    getauscht.leftY = { fn: "stick", invert: true };
    getauscht.rightY = { fn: "boom", invert: true };
    expect(pedaleLeuchten(st("stiel"), true, getauscht)).toBe(true);
    expect(pedaleLeuchten(st("arm"), true, getauscht)).toBe(false);
  });
  it("Fährt die Spur und arbeitet links, gewinnt das Fahren; Rauschen unter der Ruhe zählt nicht", () => {
    expect(pedaleLeuchten([{ dauerS: 1, achsen: { drive: 0.5, cab: 1 } }], false, c)).toBe(true);
    expect(pedaleLeuchten([{ dauerS: 1, achsen: { drive: 0.5, cab: 1 } }], true, c)).toBe(false);
    expect(pedaleLeuchten([{ dauerS: 1, achsen: { boom: 0.01 } }], true, c)).toBe(false);
  });
});

// --- Leiste (L4): Zeichen statt Text
const schritt = (phase: "zeigen" | "du", nr = 1): GameEvents["lehrgang:schritt"] => ({
  id: "fremd",
  nr,
  von: 9,
  titel: { de: "Hauptarm heben", en: "Raise the boom" },
  text: { de: "{boom-}", en: "{boom-}" },
  zeige: { fn: "boom", richtung: "minus" },
  phase,
  teile: 1,
});

describe("Lehrgangsleiste: Phase, Zeichen, Vorlesetext", () => {
  const c = defaultConfig();
  it("Phase und Häkchen kommen durch, Nummer n von m", () => {
    expect(leistenBild(schritt("zeigen"), false, c, "de")).toMatchObject({ phase: "zeigen", haken: false, nr: 1, von: 9 });
    expect(leistenBild(schritt("du", 4), true, c, "de")).toMatchObject({ phase: "du", haken: true, nr: 4 });
  });
  it("aria-label trägt den vollen Schritt — sichtbar ist davon nichts", () => {
    expect(leistenBild(schritt("zeigen"), false, c, "de").aria).toMatch(/^Schritt 1 von 9 · Schau zu: Hauptarm heben\. Linker Stick nach (oben|unten)$/);
    expect(leistenBild(schritt("du"), false, c, "en").aria).toMatch(/^Step 1 of 9 · Your turn: Raise the boom\. /);
    expect(leistenBild(schritt("du"), true, c, "de").aria).toContain("✓ Hauptarm heben");
    expect(leistenBild(schritt("du"), false, c, "de").wort).toBe("");
  });
  it("jeder Schritt des Lehrgangs hat ein Zeichen, für das es eine Zeichnung gibt", () => {
    for (const l of LEKTIONEN) {
      l.schritte.forEach((st, i) => {
        const e = { ...schritt("du", i + 1), id: l.id, zeige: st.zeige, titel: st.titel, text: st.text };
        const sym = schrittSymbol(e);
        expect(sym, `${l.id} ${i + 1}`).not.toBeNull();
        expect(BILD[sym!], `${l.id} ${i + 1}: ${sym}`).toMatch(/^<svg /);
      });
    }
  });
  it("Ersatz ohne Datenfeld: aus dem, was der Schritt übt", () => {
    const ohne = (zeige: GameEvents["lehrgang:schritt"]["zeige"], marke = false) =>
      schrittSymbol({ ...schritt("du"), zeige, marke: marke ? { x: 0, y: 0, z: 0, radiusM: 1 } : null }, null);
    expect(ohne({ fn: "cab", richtung: "plus" })).toBe("schwenken");
    expect(ohne({ fn: "boom", richtung: "plus" })).toBe("arm");
    expect(ohne({ fn: "stick", richtung: "minus" })).toBe("stiel");
    expect(ohne({ fn: "stick", richtung: "minus" }, true)).toBe("marke");
    expect(ohne(null)).toBeNull();
  });
  it("höchstens EIN Wort neben dem Zeichen (Daten, beide Sprachen)", () => {
    for (const st of LEKTIONEN.flatMap((l) => l.schritte)) {
      for (const s of ["de", "en"] as const) if (st.wort) expect(st.wort[s], st.wort[s]).toMatch(/^\S+$/);
    }
  });
});

// --- Fortschritt
function speicher(wirft = false): Map<string, string> {
  const m = new Map<string, string>();
  const f = (): never => {
    throw new Error("QuotaExceededError");
  };
  vi.stubGlobal("localStorage", {
    getItem: wirft ? f : (k: string) => m.get(k) ?? null,
    setItem: wirft ? f : (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  });
  return m;
}
afterEach(() => vi.unstubAllGlobals());

describe("Fortschritt im Lehrgang (Schema 2)", () => {
  it("kaputt, fremde Schemanummer oder falsche Form ergibt leer", () => {
    for (const t of [
      null,
      "",
      "{",
      "null",
      "[]",
      '{"v":3,"schritt":2,"fertig":false,"uebersprungen":false,"begonnen":true}',
      '{"v":2,"schritt":-1,"fertig":false,"uebersprungen":false,"begonnen":true}',
      '{"v":2,"schritt":1.5,"fertig":false,"uebersprungen":false,"begonnen":true}',
      '{"v":2,"schritt":"3","fertig":false,"uebersprungen":false,"begonnen":true}',
      '{"v":2,"schritt":3,"fertig":"ja","uebersprungen":false,"begonnen":true}',
      '{"v":1,"geschafft":"a"}',
    ]) {
      expect(lehrgangAus(t), String(t)).toEqual(leererLehrgang());
    }
  });
  it("Schema 1 → 2: begonnen bleibt, fertig nur mit allen drei alten Lektionen", () => {
    expect(lehrgangAus('{"v":1,"begonnen":true,"geschafft":["kamera"]}')).toEqual({ ...leererLehrgang(), begonnen: true });
    expect(lehrgangAus('{"v":1,"begonnen":true,"geschafft":["kamera","ausleger-stiel","fahren-schwenken"]}')).toEqual({
      ...leererLehrgang(),
      begonnen: true,
      fertig: true,
    });
    expect(lehrgangAus('{"v":1,"begonnen":false,"geschafft":[]}')).toEqual(leererLehrgang());
  });
  it("Roundtrip: begonnen, je Häkchen der Schritt, geschafft = fertig; Einstieg danach von vorn", () => {
    const m = speicher();
    expect(leseLehrgang()).toEqual(leererLehrgang());
    expect(lehrgangEinstieg()).toBe(0);
    merkeLehrgangBegonnen();
    merkeLehrgangSchritt(1);
    merkeLehrgangSchritt(2);
    expect(leseLehrgang()).toEqual({ ...leererLehrgang(), begonnen: true, schritt: 2 });
    expect(lehrgangEinstieg(9)).toBe(2); // Index 2 = dritter Schritt, genau der naechste
    expect(lehrgangEinstieg(2)).toBe(0); // Lehrgang kuerzer geworden: von vorn
    merkeLehrgangFertig();
    expect(leseLehrgang().fertig).toBe(true);
    expect(lehrgangEinstieg(9)).toBe(0);
    expect(JSON.parse(m.get(LEHRGANG_KEY)!)).toMatchObject({ v: 2 });
    m.set(LEHRGANG_KEY, "kaputt{");
    expect(leseLehrgang()).toEqual(leererLehrgang());
  });
  it("Überspringen merkt sich und behält die Stelle", () => {
    speicher();
    merkeLehrgangSchritt(3);
    merkeLehrgangUebersprungen();
    expect(leseLehrgang()).toEqual({ ...leererLehrgang(), begonnen: true, schritt: 3, uebersprungen: true });
    expect(lehrgangEinstieg(9)).toBe(3);
  });
  it("gesperrter Speicher (Safari privat): leer lesen, nichts wirft", () => {
    speicher(true);
    expect(leseLehrgang()).toEqual(leererLehrgang());
    expect(() => merkeLehrgangSchritt(2)).not.toThrow();
    expect(() => merkeLehrgangUebersprungen()).not.toThrow();
    expect(lehrgangEinstieg()).toBe(0);
  });
});

// --- Menü
describe("Menü: erster Start, Adresse, LEHRGANG-Knopf", () => {
  const L = ["lehrgang"];
  const P = ["erster-griff", "verladen"];
  it("erster Start → Lehrgang; begonnen, übersprungen oder fertig → Menü", () => {
    const leer = leererLehrgang();
    expect(startWahl(null, {}, leer, L, P)).toEqual({ art: "lektion", id: "lehrgang" });
    expect(startWahl(null, {}, { ...leer, begonnen: true }, L, P)).toBeNull();
    expect(startWahl(null, {}, { ...leer, uebersprungen: true }, L, P)).toBeNull();
    expect(startWahl(null, {}, { ...leer, fertig: true }, L, P)).toBeNull();
    // Wer schon Prüfungen gespielt hat (vor E-196), kommt nicht in den Lehrgang gezwungen
    expect(startWahl(null, { "erster-griff": { sterne: 0 } }, leer, L, P)).toBeNull();
    expect(ersterStart({}, { ...leer, schritt: 2 })).toBe(false);
  });
  it("ohne Lektionen wie bisher Prüfung 1", () => {
    expect(startWahl(null, {}, leererLehrgang(), [], P)).toEqual({ art: "challenge", id: "erster-griff" });
  });
  it("Adresse #lektion=lehrgang und #challenge= vor allem anderen, Unbekanntes zählt nicht", () => {
    expect(wahlAusAdresse("#lektion=lehrgang", L, P)).toEqual({ art: "lektion", id: "lehrgang" });
    expect(wahlAusAdresse("#challenge=verladen", L, P)).toEqual({ art: "challenge", id: "verladen" });
    expect(wahlAusAdresse("#lektion=gibtsnicht", L, P)).toBeNull();
    expect(wahlAusAdresse("#lektion=verladen", L, P)).toBeNull();
    expect(wahlAusAdresse("", L, P)).toBeNull();
    const a = wahlAusAdresse("#lektion=lehrgang", L, P);
    expect(startWahl(a, { x: { sterne: 3 } }, { ...leererLehrgang(), fertig: true }, L, P)).toEqual(a);
    // die echte Lektion heisst so, wie die Adresse sie nennt
    expect(LEKTIONEN.map((l) => l.id)).toContain("lehrgang");
  });
  it("Kleingedrucktes: „Schritt n von m“ (n = der nächste) bzw. „✓ geschafft“", () => {
    const leer = leererLehrgang();
    expect(lehrgangKlein(leer, 9, "de")).toBe("Schritt 1 von 9");
    expect(lehrgangKlein({ ...leer, schritt: 4 }, 9, "en")).toBe("Step 5 of 9");
    expect(lehrgangKlein({ ...leer, schritt: 9 }, 9, "de")).toBe("Schritt 9 von 9");
    expect(lehrgangKlein({ ...leer, fertig: true }, 9, "de")).toBe("✓ geschafft");
    expect(lehrgangKlein({ ...leer, fertig: true }, 9, "en")).toBe("✓ done");
  });
  it("Prüfungen heißen PRÜFUNG / TEST", () => {
    expect(WORTE.aufgabe).toEqual({ de: "PRÜFUNG", en: "TEST" });
    expect(WORTE.pruefungen).toEqual({ de: "PRÜFUNGEN", en: "TESTS" });
  });
});

// --- Geisterdaumen
describe("Geisterdaumen folgt der Vorführung", () => {
  const c = defaultConfig();
  const achsen = (a: Partial<Record<"cab" | "boom" | "stick" | "grapple" | "rotator" | "drive" | "steer", number>>) => ({
    cab: 0, boom: 0, stick: 0, grapple: 0, rotator: 0, drive: 0, steer: 0, ...a,
  });
  it("Ausschlag = Befehl über die Belegung zurückgerechnet (Umkehr beachtet)", () => {
    // Werk: leftY = boom, umgekehrt → boom +1 heißt Daumen nach OBEN (dy −1)
    expect(stickAusschlag(achsen({ boom: 1 }), c)).toEqual({ links: { dx: 0, dy: -1 }, rechts: null });
    // rightX = grapple, nicht umgekehrt → schließen = rechts
    expect(stickAusschlag(achsen({ grapple: 0.6 }), c).rechts).toEqual({ dx: 0.6, dy: 0 });
    // umgelegt: Spinne auf linke Querachse
    const um = { ...c, leftX: { fn: "grapple" as const, invert: true }, rightX: { fn: "cab" as const, invert: false } };
    expect(stickAusschlag(achsen({ grapple: 1 }), um).links).toEqual({ dx: -1, dy: 0 });
    // Fahren: links, vorwärts = Daumen nach oben
    expect(stickAusschlag(achsen({ drive: 1, steer: -0.5 }), c).links).toEqual({ dx: -0.5, dy: -1 });
    expect(stickAusschlag(achsen({}), c)).toEqual({ links: null, rechts: null });
  });
  it("Kamera-Geste aus der Spur: ziehen, kneifen", () => {
    expect(kameraGeste({ gierProS: 100 })).toBe("rechts");
    expect(kameraGeste({ gierProS: -10, nickProS: 5 })).toBe("links");
    expect(kameraGeste({ nickProS: -30 })).toBe("hoch");
    expect(kameraGeste({ zoomProS: 0.5 })).toBe("auf"); // näher = Finger auseinander
    expect(kameraGeste({ zoomProS: 2 })).toBe("zu");
    expect(kameraGeste({ zuruecksetzen: true })).toBeNull();
    expect(kameraGeste(null)).toBeNull();
  });
  it("Tasten-Schild: Kranz-Funktionen mit ihrem Namen; die Ansicht zeigt der tippende Finger, kein Schild (L5-B)", () => {
    const kranz = (code: string) => ({ KeyO: "STÜTZEN" })[code] ?? null;
    // L4: Zeichen plus hoechstens ein Wort
    expect(tastenText("KeyC", kranz, "de")).toBeNull();
    expect(tastenText("KeyC", kranz, "en")).toBeNull();
    expect(tastenText("KeyO", kranz, "de")).toBe("STÜTZEN"); // der Kranzname kommt übersetzt aus der Seite
    expect(tastenText(KAMERA_ZURUECK, kranz, "de")).toBeNull();
    expect(tastenText("KeyQ", kranz, "de")).toBeNull();
  });
});
