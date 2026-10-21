/**
 * LEHRGANG, BEDIENSEITE (E-196): Wiedergabe der Vorführung, Lektionskarte,
 * Fortschritt, Menü-Logik, Geisterdaumen-Folgen.
 *
 * Ohne DOM: geprüft werden die reinen Teile (`spurWerte`, `kameraZwischen`,
 * `lektionsKartenText`, `lehrgangAus`, `startWahl`, `stickAusschlag` …) und
 * die Wiedergabe-Klasse an einem echten Bus mit einem Schreibziel aus Zahlen.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventBus, type GameEvents } from "../src/core/events";
import type { Spur } from "../src/core/spur";
import { KAMERA_ZURUECK, SPUR_ACHSEN, Wiedergabe, kameraZwischen, spurWerte, type WiedergabeZiel } from "../src/core/wiedergabe";
import { lektionsKartenText } from "../src/ui/lektionskarte";
import {
  LEHRGANG_KEY,
  lehrgangAus,
  leererLehrgang,
  leseLehrgang,
  merkeLehrgangBegonnen,
  merkeLektion,
} from "../src/core/save";
import { ersterStart, lektionKnopf, startWahl, wahlAusAdresse } from "../src/ui/hauptmenue";
import { daumenAusSpur, daumenBild, kameraAusSpur, kameraGeste, stickAusschlag, tastenText } from "../src/ui/geisterdaumen";
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
  const lektion = (id: string) => LEKTIONEN.find((l) => l.id === id)!;
  it("Lektion 3 Schritt 5: beide Sticks, je Richtung des ersten Ausschlags", () => {
    const st = lektion("ausleger-stiel").schritte[4]!;
    const b = daumenAusSpur(st.vorfuehrung, st.zeige, c);
    expect(b.map((x) => x.seite).sort()).toEqual(["links", "rechts"]);
    // Werk: Hauptarm links längs umgekehrt → heben = hoch (nicht das Vorab-Schwenken links quer); Stiel aus zeige
    expect(b.find((x) => x.seite === "links")!.pfeil).toBe("hoch");
    expect(b.find((x) => x.seite === "rechts")).toEqual(daumenBild(st.zeige, c));
  });
  it("zeige behält seine Seite (Doppelpfeil bei „beide“), ohne Spur nur zeige", () => {
    const st = lektion("fahren-schwenken").schritte[4]!;
    expect(daumenAusSpur(st.vorfuehrung, st.zeige, c)).toEqual([daumenBild(st.zeige, c)]);
    expect(daumenAusSpur(null, { fn: "boom", richtung: "plus" }, c)).toEqual([daumenBild({ fn: "boom", richtung: "plus" }, c)]);
    expect(daumenAusSpur(null, null, c)).toEqual([]);
  });
  it("Fahren ohne zeige: linker Stick nach oben bzw. unten", () => {
    const l = lektion("fahren-schwenken");
    expect(daumenAusSpur(l.schritte[2]!.vorfuehrung, null, c)).toEqual([{ seite: "links", pfeil: "hoch" }]);
    expect(daumenAusSpur(l.schritte[3]!.vorfuehrung, null, c)).toEqual([{ seite: "links", pfeil: "runter" }]);
  });
  it("Kamera-Schritte: Geste aus der Spur, Doppeltipp hat Vorrang", () => {
    const s = lektion("kamera").schritte;
    expect(s.map((st) => kameraAusSpur(st.vorfuehrung))).toEqual(["rechts", "runter", "auf", "", "", "doppeltipp"]);
  });
});

// --- Karte
const START: GameEvents["lehrgang:start"] = {
  id: "hauptarm",
  nr: 2,
  von: 12,
  name: { de: "Hauptarm", en: "Boom" },
  ziel: { de: "Den Hauptarm heben und senken.", en: "Raise and lower the boom." },
};
const schritt = (phase: "zeigen" | "du"): GameEvents["lehrgang:schritt"] => ({
  id: "hauptarm",
  nr: 1,
  von: 4,
  titel: { de: "Hauptarm heben", en: "Raise the boom" },
  text: { de: "{boom-}", en: "{boom-}" },
  zeige: { fn: "boom", richtung: "minus" },
  phase,
});

describe("Lektionskarte: Phasen", () => {
  const c = defaultConfig();
  it("Kopf Lektion n · Schritt k/m, Ziel", () => {
    const x = lektionsKartenText(START, schritt("zeigen"), false, c, "de", true);
    expect(x.kopf).toBe("Lektion 2 · Schritt 1/4");
    expect(x.ziel).toBe("Ziel: Den Hauptarm heben und senken.");
    expect(lektionsKartenText(START, schritt("zeigen"), false, c, "en", true).kopf).toBe("Lesson 2 · Step 1/4");
  });
  it("zeigen: Schau zu, Hinweis Antippen (Touch) bzw. Klicken (Rechner)", () => {
    const x = lektionsKartenText(START, schritt("zeigen"), false, c, "de", true);
    expect(x.titel).toBe("Schau zu: Hauptarm heben");
    expect(x.hinweis).toBe("Antippen überspringt");
    expect(lektionsKartenText(START, schritt("zeigen"), false, c, "de", false).hinweis).toBe("Klicken überspringt");
    expect(lektionsKartenText(START, schritt("zeigen"), false, c, "en", true).hinweis).toBe("Tap to skip");
  });
  it("du: Jetzt du und die Bedienzeile aus SEINER Belegung, kein Hinweis", () => {
    const x = lektionsKartenText(START, schritt("du"), false, c, "de", true);
    expect(x.titel).toBe("Jetzt du: Hauptarm heben");
    // Werkseinstellung: Hauptarm links längs, umgekehrt — „minus" = senken? Hier zählt nur, dass bedientext greift
    expect(x.text).toMatch(/^Linker Stick nach (oben|unten)$/);
    expect(x.hinweis).toBe("");
  });
  it("Häkchen: ✓ vor dem Titel, kein Hinweis", () => {
    const x = lektionsKartenText(START, schritt("du"), true, c, "de", true);
    expect(x.titel).toBe("✓ Hauptarm heben");
    expect(x.hinweis).toBe("");
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

describe("Fortschritt im Lehrgang", () => {
  it("kaputt, fremde Schemanummer oder falsche Form ergibt leer", () => {
    for (const t of [null, "", "{", "null", "[]", '{"v":2,"begonnen":true,"geschafft":[]}', '{"v":1,"geschafft":"a"}']) {
      expect(lehrgangAus(t), String(t)).toEqual(leererLehrgang());
    }
    expect(lehrgangAus('{"v":1,"begonnen":true,"geschafft":["a",3,"b"]}').geschafft).toEqual(["a", "b"]);
  });
  it("begonnen, geschafft (einmal je Lektion), Roundtrip über den Speicher", () => {
    const m = speicher();
    expect(leseLehrgang()).toEqual(leererLehrgang());
    merkeLehrgangBegonnen();
    expect(leseLehrgang().begonnen).toBe(true);
    merkeLektion("sticks");
    merkeLektion("sticks");
    merkeLektion("kamera");
    expect(leseLehrgang().geschafft).toEqual(["sticks", "kamera"]);
    m.set(LEHRGANG_KEY, "kaputt{");
    expect(leseLehrgang()).toEqual(leererLehrgang());
  });
  it("gesperrter Speicher (Safari privat): leer lesen, nichts wirft", () => {
    speicher(true);
    expect(leseLehrgang()).toEqual(leererLehrgang());
    expect(() => merkeLektion("sticks")).not.toThrow();
  });
});

// --- Menü
describe("Menü: erster Start, Adresse, Lektionsliste", () => {
  const L = ["sticks", "kamera", "stuetzen"];
  const P = ["erster-griff", "verladen"];
  it("erster Start → Lektion 1; danach Menü", () => {
    const leer = leererLehrgang();
    expect(startWahl(null, {}, leer, L, P)).toEqual({ art: "lektion", id: "sticks" });
    expect(startWahl(null, {}, { ...leer, begonnen: true }, L, P)).toBeNull();
    // Wer schon Prüfungen gespielt hat (vor E-196), kommt nicht in den Lehrgang gezwungen
    expect(startWahl(null, { "erster-griff": { sterne: 0 } }, leer, L, P)).toBeNull();
    expect(ersterStart({}, { ...leer, geschafft: ["sticks"] })).toBe(false);
  });
  it("ohne Lektionen wie bisher Prüfung 1", () => {
    expect(startWahl(null, {}, leererLehrgang(), [], P)).toEqual({ art: "challenge", id: "erster-griff" });
  });
  it("Adresse #lektion= und #challenge= vor allem anderen, Unbekanntes zählt nicht", () => {
    expect(wahlAusAdresse("#lektion=kamera", L, P)).toEqual({ art: "lektion", id: "kamera" });
    expect(wahlAusAdresse("#challenge=verladen", L, P)).toEqual({ art: "challenge", id: "verladen" });
    expect(wahlAusAdresse("#lektion=gibtsnicht", L, P)).toBeNull();
    expect(wahlAusAdresse("#lektion=verladen", L, P)).toBeNull();
    expect(wahlAusAdresse("", L, P)).toBeNull();
    const a = wahlAusAdresse("#lektion=stuetzen", L, P);
    expect(startWahl(a, { x: { sterne: 3 } }, { ...leererLehrgang(), begonnen: true }, L, P)).toEqual(a);
  });
  it("Lektionsknopf: ✓ UND Wort für geschafft, Nummer und Name", () => {
    const l = { id: "kamera", name: { de: "Kamera", en: "Camera" } };
    expect(lektionKnopf(2, l, true, "de")).toEqual({ kopf: "✓ 2 · Kamera", aria: "Lektion 2 · Kamera · geschafft" });
    expect(lektionKnopf(2, l, false, "en").kopf).toBe("   2 · Camera");
    expect(lektionKnopf(2, l, false, "en").aria).toBe("Lesson 2 · Camera");
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
  it("Tasten-Schild: Ansicht = 2× tippen, Kranz-Funktionen mit ihrem Namen", () => {
    const kranz = (code: string) => ({ KeyO: "STÜTZEN" })[code] ?? null;
    expect(tastenText("KeyC", kranz, "de")).toBe("ANSICHT: 2× tippen");
    expect(tastenText("KeyO", kranz, "de")).toBe("STÜTZEN: halten, ziehen");
    expect(tastenText("KeyO", kranz, "en")).toBe("STÜTZEN: hold, swipe"); // der Kranzname kommt übersetzt aus der Seite
    expect(tastenText(KAMERA_ZURUECK, kranz, "de")).toBeNull();
    expect(tastenText("KeyQ", kranz, "de")).toBeNull();
  });
});
