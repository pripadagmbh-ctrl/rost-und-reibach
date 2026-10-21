/**
 * DER LEHRGANG (E-196, L3): Lektions-Kern und der Lehrgang am Stueck.
 *
 *  1. der Ablauf mit Attrappen — zeigen → Vorfuehrung → du; Haekchen nur fuer
 *     die eigene Aenderung, die Vorfuehrung zaehlt nie; Abbruch geht gleich zu
 *     „du"; die Pause zaehlt nicht; beendet = stumm; Wiedereinstieg bei Schritt n;
 *  2. der Lehrgang kopflos mit echtem Bagger und echter Kamera: Die Spur jedes
 *     Schritts laeuft als Vorfuehrung (und muss in der Startlage enden) und
 *     dann noch einmal als „Spieler" — der Lehrgang muss geschafft werden,
 *     im Zeitbudget, auch beim Wiedereinstieg mitten drin und am letzten Schritt;
 *  3. die Texte: zweisprachig, dieselben Platzhalter, iPhone mini quer.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { EventBus, type GameEvents } from "../src/core/events";
import { spurDauer, type Spur, type SpurAbschnitt } from "../src/core/spur";
import { HAEKCHEN_PAUSE_S, LektionLauf, ORBIT_START, type LektionDaten, type LektionZustand } from "../src/challenges/lektion";
import { LEKTIONEN, lektionNr } from "../src/challenges/lehrgang";
import { lektionQuellen } from "../src/challenges/quellen";
import { OrbitCamera } from "../src/excavator/orbitCamera";
import { SPUR_ACHSEN, Wiedergabe } from "../src/core/wiedergabe";
import type { TouchAxes } from "../src/core/touch";
import { bedientext } from "../src/ui/challengekarte";
import { defaultConfig } from "../src/core/controlConfig";
import { DT, GRAD, platzLeinwand, werkbank } from "./aufgabenwerkbank";
import { FASSUNGEN, fassungInnen, px, pxOderNull, schriftgroesse, zeilen } from "./cssmass";

/* ------------------------------------------------------------------------ */
/* 1. Ablauf mit Attrappen                                                  */
/* ------------------------------------------------------------------------ */

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

const SPUR: Spur = [{ dauerS: 1, achsen: { cab: 1 } }];
const PROBE: LektionDaten = {
  id: "probe",
  name: { de: "P", en: "P" },
  ziel: { de: "Z", en: "Z" },
  beschreibung: { de: "B", en: "B" },
  schritte: [
    { titel: { de: "1", en: "1" }, text: { de: "t", en: "t" }, zeige: null, vorfuehrung: SPUR, ziel: { art: "aenderung", groesse: "cabYaw", richtung: "plus", ab: 0.3 } },
    { titel: { de: "2", en: "2" }, text: { de: "t", en: "t" }, zeige: null, vorfuehrung: null, ziel: { art: "aenderung", groesse: "fahrt", richtung: "minus", ab: 1 } },
  ],
};

function probe(): { lauf: LektionLauf; z: LektionZustand; bus: EventBus; log: string[]; schritte: GameEvents["lehrgang:schritt"][] } {
  const bus = new EventBus();
  const z = zustand();
  const log: string[] = [];
  const schritte: GameEvents["lehrgang:schritt"][] = [];
  bus.on("lehrgang:start", (e) => log.push(`start ${e.id} ${e.nr}/${e.von}`));
  bus.on("lehrgang:schritt", (e) => {
    schritte.push(e);
    log.push(`schritt ${e.nr} ${e.phase}`);
  });
  bus.on("lehrgang:vorfuehren", (e) => log.push(`vorfuehren ${e.spur.length}`));
  bus.on("lehrgang:haekchen", (e) => log.push(`haekchen ${e.nr}`));
  bus.on("lehrgang:geschafft", (e) => log.push(`geschafft ${e.nr}`));
  const lauf = new LektionLauf(PROBE, 2, 12, { zustand: () => ({ ...z, kamera: { ...z.kamera }, spinne: { ...z.spinne } }) }, bus);
  return { lauf, z, bus, log, schritte };
}

describe("LektionLauf (Attrappen)", () => {
  it("zeigen → Vorfuehrung → du; die Vorfuehrung zaehlt nicht, die eigene Aenderung schon", () => {
    const { lauf, z, bus, log } = probe();
    lauf.start();
    expect(log).toEqual(["start probe 2/12", "schritt 1 zeigen", "vorfuehren 1"]);
    // Waehrend der Vorfuehrung dreht der Bagger weit — kein Haekchen
    z.cabYaw = 0.5;
    lauf.takt(0.1);
    expect(log).not.toContain("haekchen 1");
    // Vorfuehrung bricht ab, bevor sie zurueckdreht: „du" misst ab hier
    bus.emit("lehrgang:vorfuehrungEnde", { abgebrochen: true });
    expect(log.at(-1)).toBe("schritt 1 du");
    lauf.takt(0.1);
    expect(log).not.toContain("haekchen 1");
    // Zurueckdrehen ist keine Drehung nach links
    z.cabYaw = 0.0;
    lauf.takt(0.1);
    expect(log).not.toContain("haekchen 1");
    // L3b: gemessen ab dem Wendepunkt (0,0), nicht ab dem Ausgang — sonst kaeme ein Arm am Anschlag nie zum Haekchen
    z.cabYaw = 0.29;
    lauf.takt(0.1);
    expect(log).not.toContain("haekchen 1");
    z.cabYaw = 0.31;
    lauf.takt(0.1);
    expect(log.at(-1)).toBe("haekchen 1");
  });

  it("nach dem Haekchen die Pause, dann ein Schritt ohne Vorfuehrung gleich in „du“; am Ende geschafft", () => {
    const { lauf, z, bus, log } = probe();
    lauf.start();
    bus.emit("lehrgang:vorfuehrungEnde", { abgebrochen: false });
    z.cabYaw = 0.4;
    lauf.takt(DT);
    expect(log.at(-1)).toBe("haekchen 1");
    const n = log.length;
    lauf.takt(HAEKCHEN_PAUSE_S / 2);
    expect(log.length).toBe(n);
    lauf.takt(HAEKCHEN_PAUSE_S / 2 + 1e-6);
    expect(log.slice(n)).toEqual(["schritt 2 du"]);
    // Ein verirrtes Ende der Vorfuehrung aendert nichts
    bus.emit("lehrgang:vorfuehrungEnde", { abgebrochen: false });
    expect(log.slice(n)).toEqual(["schritt 2 du"]);
    // rueckwaerts 1 m, laengs zum Unterwagen (heading 0 = +z)
    z.z = -0.6;
    lauf.takt(DT);
    expect(log.at(-1)).toBe("schritt 2 du");
    z.z = -1.01;
    lauf.takt(DT);
    expect(log.at(-1)).toBe("haekchen 2");
    lauf.takt(HAEKCHEN_PAUSE_S + 0.01);
    expect(log.at(-1)).toBe("geschafft 2");
    expect(lauf.geschafft).toBe(true);
  });

  it("die Spielpause zaehlt nicht: Zeit nur aus takt", () => {
    const { lauf, z, bus } = probe();
    let zeit = -1;
    bus.on("lehrgang:geschafft", (e) => (zeit = e.zeitS));
    lauf.start();
    lauf.takt(2);
    bus.emit("lehrgang:vorfuehrungEnde", { abgebrochen: false });
    z.cabYaw = 1;
    lauf.takt(0.5);
    // „Pause": kein takt, die Welt steht — nichts geschieht
    expect(lauf.zeitS).toBeCloseTo(2.5, 9);
    lauf.takt(1);
    z.z = -2;
    lauf.takt(0.5);
    lauf.takt(1);
    expect(zeit).toBeCloseTo(5, 9);
  });

  it("beendet = stumm: keine Ereignisse mehr, auch nicht nach Ende der Vorfuehrung", () => {
    const { lauf, z, bus, log } = probe();
    lauf.start();
    lauf.beenden();
    const n = log.length;
    bus.emit("lehrgang:vorfuehrungEnde", { abgebrochen: false });
    z.cabYaw = 2;
    lauf.takt(1);
    lauf.takt(1);
    expect(log.length).toBe(n);
    expect(lauf.beendet).toBe(true);
  });

  it("Wiedereinstieg: start(1) beginnt bei Schritt 2, die Uhr ab dort; jenseits des Endes = geschafft", () => {
    const { lauf, z, log } = probe();
    lauf.start(1);
    expect(log).toEqual(["start probe 2/12", "schritt 2 du"]);
    z.z = -1.01;
    lauf.takt(DT);
    lauf.takt(HAEKCHEN_PAUSE_S + 0.01);
    expect(log.slice(2)).toEqual(["haekchen 2", "geschafft 2"]);
    expect(lauf.zeitS).toBeCloseTo(DT + HAEKCHEN_PAUSE_S + 0.01, 9);
    for (const ab of [2, 99]) {
      const p = probe();
      p.lauf.start(ab);
      expect(p.log).toEqual(["start probe 2/12", "geschafft 2"]);
      expect(p.lauf.geschafft).toBe(true);
    }
    // Kaputter Speicherstand: von vorn
    for (const ab of [-3, Number.NaN]) {
      const p = probe();
      p.lauf.start(ab);
      expect(p.log.slice(0, 2)).toEqual(["start probe 2/12", "schritt 1 zeigen"]);
    }
  });

  it("eine Wiedergabe, die sofort fertig meldet, landet trotzdem in „du“", () => {
    const { lauf, bus, log } = probe();
    bus.on("lehrgang:vorfuehren", () => bus.emit("lehrgang:vorfuehrungEnde", { abgebrochen: false }));
    lauf.start();
    expect(log.at(-1)).toBe("schritt 1 du");
  });

  it("L3b: Hauptarm am Anschlag — Spur und Geist erst senken, Haekchen fuer Senken-dann-Heben", () => {
    const d = LEKTIONEN[0]!;
    const i = d.schritte.findIndex((s) => s.symbol === "arm");
    const bus = new EventBus();
    const z = { ...zustand(), boom: 69 / GRAD };
    const spuren: Spur[] = [];
    const zeige: GameEvents["lehrgang:schritt"]["zeige"][] = [];
    const hak: number[] = [];
    bus.on("lehrgang:vorfuehren", (e) => spuren.push(e.spur));
    bus.on("lehrgang:schritt", (e) => zeige.push(e.zeige));
    bus.on("lehrgang:haekchen", (e) => hak.push(e.nr));
    const lauf = new LektionLauf(d, 1, 1, { zustand: () => ({ ...z, kamera: { ...z.kamera }, spinne: { ...z.spinne } }) }, bus);
    lauf.start(i);
    expect(spuren[0]![0]!.achsen?.boom).toBe(-1);
    expect(zeige[0]).toEqual({ fn: "boom", richtung: "minus" });
    bus.emit("lehrgang:vorfuehrungEnde", { abgebrochen: false });
    z.boom = 70 / GRAD; // an den Anschlag: nur 1°
    lauf.takt(DT);
    z.boom = 55 / GRAD;
    lauf.takt(DT);
    z.boom = 64.9 / GRAD;
    lauf.takt(DT);
    expect(hak).toEqual([]);
    z.boom = 65.1 / GRAD; // 10,1° ueber dem Wendepunkt
    lauf.takt(DT);
    expect(hak).toEqual([i + 1]);
    // Aus der Startlage bleibt alles, wie es geschrieben ist
    const bus2 = new EventBus();
    const s2: Spur[] = [];
    bus2.on("lehrgang:vorfuehren", (e) => s2.push(e.spur));
    new LektionLauf(d, 1, 1, { zustand: () => ({ ...zustand(), boom: 35 / GRAD }) }, bus2).start(i);
    expect(s2[0]).toBe(d.schritte[i]!.vorfuehrung);
  });

  it("Kamera-Startpunkt: erst verstellt, dann zurueck", () => {
    const bus = new EventBus();
    const z = zustand();
    const d: LektionDaten = { ...PROBE, schritte: [{ ...PROBE.schritte[1]!, ziel: { art: "kameraStart" } }] };
    const lauf = new LektionLauf(d, 1, 1, { zustand: () => ({ ...z, kamera: { ...z.kamera } }) }, bus);
    const hak: number[] = [];
    bus.on("lehrgang:haekchen", (e) => hak.push(e.nr));
    lauf.start();
    lauf.takt(DT);
    expect(hak).toEqual([]); // steht schon am Start — das ist kein Zuruecksetzen
    z.kamera.gier += 0.5;
    lauf.takt(DT);
    z.kamera.gier = Math.PI + 4 * Math.PI; // derselbe Blick, zwei Runden weiter
    lauf.takt(DT);
    expect(hak).toEqual([1]);
  });
});

/* ------------------------------------------------------------------------ */
/* 2. Kopflos mit echtem Bagger und echter Kamera                            */
/* ------------------------------------------------------------------------ */

/**
 * Der SPIELER spielt die Spur Bild fuer Bild nach — wie die Wiedergabe
 * (`core/wiedergabe.ts`): Achsen liegen den ganzen Abschnitt an, Tasten und
 * `zuruecksetzen` einmal im ersten Bild, Kamera-Raten mal dt (Zoom: hoch dt).
 * Er hoert auf, sobald das Haekchen kommt. Die VORFUEHRUNG spielt die echte
 * `Wiedergabe`.
 */
function bilder(spur: Spur): Array<{ a: SpurAbschnitt; erstes: boolean }> {
  return spur.flatMap((a) => Array.from({ length: Math.max(1, Math.round(a.dauerS / DT)) }, (_, i) => ({ a, erstes: i === 0 })));
}

/** Loesung fuer Schritte ohne Vorfuehrung — was ein Spieler tut */
const LOESUNG: Record<string, Spur> = {
  // Weiter doppelt rechts tippen, alle halbe Sekunde, bis die Aussenansicht kommt
  "lehrgang/4": [{ dauerS: 0.5, tasten: ["KeyC"] }, { dauerS: 0.5, tasten: ["KeyC"] }, { dauerS: 0.5, tasten: ["KeyC"] }, { dauerS: 0.5, tasten: ["KeyC"] }],
};

/**
 * Toleranzen „endet in der Startlage". // SW: 1,2° an Gelenken und Kamera =
 * zwei Bilder Drehkranz bei vollem Ausschlag (33°/s ÷ 60 = 0,55°). So viel
 * Schlupf hat die echte Wiedergabe: Sie tastet am Bildende ab (`spurWerte(t + dt)`),
 * der erste Abschnitt bekommt darum ein Bild weniger als der Rueckweg
 * (gemessen 0,55° Drehkranz, 0,63° Hauptarm); auf dem Geraet schwankt dt
 * ohnehin. 5 cm Fahrt (ein Bild halbes Gas = 2,7 cm), 1 % Abstand.
 */
const END_TOL_RAD = 1.2 / GRAD;
const END_TOL_M = 0.05;

interface Durchlauf {
  geschafft: boolean;
  zeitS: number;
  haekchen: number[];
  /** Lehrgangszeit bei jedem Haekchen (s) */
  bei: number[];
  /** je Vorfuehrung: Abweichung Ende − Anfang */
  abweichung: Array<{ schritt: number; was: string; wert: number; tol: number }>;
  marken: Array<{ schritt: number; abstand: number }>;
}

/** `ab`: Wiedereinstieg bei diesem Schritt (0-basiert), aus der Startpose */
function durchlauf(d: LektionDaten, ab = 0): Durchlauf {
  const k = werkbank();
  const b = k.b;
  const achsen: TouchAxes = { cab: 0, stick: 0, boom: 0, rotator: 0, drive: 0, steer: 0, grab: false, grapple: 0 };
  b.touch = achsen;
  const orbit = new OrbitCamera(16 / 9);
  const kam = { orbitDX: 0, orbitDY: 0, zoomFactor: 1, camReset: false, shiftHeld: false, wheelDelta: 0, wasPressed: () => false };
  const q = lektionQuellen({ bagger: b, kamera: orbit });
  const lauf = new LektionLauf(d, lektionNr(d.id), LEKTIONEN.length, q, k.bus);
  const aug = new THREE.Vector3();

  const erg: Durchlauf = { geschafft: false, zeitS: 0, haekchen: [], bei: [], abweichung: [], marken: [] };
  /** Wer gerade die Sticks fuehrt: die Wiedergabe (Vorfuehrung) oder der Spieler */
  const fuehrt: {
    vorfuehrung: { anfang: LektionZustand; ansicht: boolean } | null;
    spieler: { bilder: ReturnType<typeof bilder>; i: number } | null;
  } = { vorfuehrung: null, spieler: null };
  // Tasten wie main.ts: touch.consumePress("KeyC") → orbit.touchViewPress, "KeyO" → toggleOutriggers
  const druecke = (t: string): void => {
    if (t === "KeyC") orbit.touchViewPress = true;
    else if (t === "KeyO") b.toggleOutriggers();
    else throw new Error(`Taste ${t} kennt der Test nicht`);
  };
  const wiedergabe = new Wiedergabe(k.bus, { achsen, kamera: kam, druecke, eingriff: () => false });
  // L3b: Der Lauf richtet die Spur nach der Lage — der Spieler macht genau die nach, die er sah
  let gesehen: Spur | null = null;
  k.bus.on("lehrgang:vorfuehren", (e) => {
    gesehen = e.spur;
    fuehrt.vorfuehrung = { anfang: q.zustand(), ansicht: e.spur.some((a) => a.tasten?.includes("KeyC")) };
  });
  k.bus.on("lehrgang:vorfuehrungEnde", () => {
    const v = fuehrt.vorfuehrung;
    if (!v) return;
    fuehrt.vorfuehrung = null;
    // Der Ansicht-Wechsel springt immer auf den Startpunkt (`orbitCamera.ts` zumStart) — dort muss er enden
    const a = v.ansicht ? { ...v.anfang, kamera: { modus: "orbit" as const, ...ORBIT_START } } : v.anfang;
    const e = q.zustand();
    const nr = lauf.schritt + 1;
    const w = (was: string, wert: number, tol: number): void => {
      erg.abweichung.push({ schritt: nr, was, wert, tol });
    };
    w("cabYaw", e.cabYaw - a.cabYaw, END_TOL_RAD);
    w("boom", e.boom - a.boom, END_TOL_RAD);
    w("stick", e.stick - a.stick, END_TOL_RAD);
    w("heading", e.heading - a.heading, END_TOL_RAD);
    w("ort", Math.hypot(e.x - a.x, e.z - a.z), END_TOL_M);
    w("gier", e.kamera.gier - a.kamera.gier, END_TOL_RAD);
    w("nick", e.kamera.nick - a.kamera.nick, END_TOL_RAD);
    w("abstand", e.kamera.abstand / a.kamera.abstand - 1, 0.01);
    w("ansicht", e.kamera.modus === a.kamera.modus ? 0 : 1, 0);
  });
  k.bus.on("lehrgang:schritt", (e) => {
    if (e.phase !== "du") return;
    const s = d.schritte[e.nr - 1]!;
    const spur = (s.vorfuehrung ? gesehen : null) ?? LOESUNG[`${d.id}/${e.nr}`];
    if (!spur) throw new Error(`${d.id}/${e.nr}: keine Loesung`);
    fuehrt.spieler = { bilder: bilder(spur), i: 0 };
  });
  k.bus.on("lehrgang:haekchen", (e) => {
    erg.haekchen.push(e.nr);
    erg.bei.push(lauf.zeitS);
    if (lauf.marke) erg.marken.push({ schritt: e.nr, abstand: Math.hypot(b.getSensorPosition(aug).x - lauf.marke.x, aug.z - lauf.marke.z) });
    fuehrt.spieler = null; // geschafft — Daumen weg
  });
  k.bus.on("lehrgang:geschafft", (e) => {
    erg.geschafft = true;
    erg.zeitS = e.zeitS;
  });

  lauf.start(ab);
  for (let n = 0; n < 60 * 600 && !erg.geschafft; n++) {
    kam.orbitDX = 0;
    kam.orbitDY = 0;
    kam.zoomFactor = 1;
    kam.camReset = false;
    // L2b: wie main.ts — takt je Bild, schritt vor jedem Physikschritt (hier 1 Schritt je Bild)
    if (wiedergabe.laeuft) {
      wiedergabe.takt(DT);
      wiedergabe.schritt(DT);
    } else {
      const p = fuehrt.spieler;
      const bild = p?.bilder[p.i++];
      for (const x of SPUR_ACHSEN) achsen[x] = bild?.a.achsen?.[x] ?? 0;
      const c = bild?.a.kamera;
      kam.orbitDX = (c?.gierProS ?? 0) * DT;
      kam.orbitDY = (c?.nickProS ?? 0) * DT;
      kam.zoomFactor = Math.pow(c?.zoomProS ?? 1, DT);
      kam.camReset = !!(bild?.erstes && c?.zuruecksetzen);
      if (bild?.erstes) for (const t of bild.a.tasten ?? []) druecke(t);
    }
    k.takt();
    orbit.update(DT, kam as never, (o) => o.copy(b.position), (o) => (o.copy(b.position).setY(3), b.cabinBaseYaw));
    lauf.takt(DT);
  }
  return erg;
}

/**
 * Zeitbudget der Grundsteuerung (Patrick 21.10.2026: Lehrgang gesamt 8–12 min,
 * davon dieser Teil rund 3 min). Der Wiedergabe-Fahrer reagiert sofort und
 * trifft jede Bewegung beim ersten Mal; ein Mensch braucht je Schritt etwa
 * doppelt so lange (hinschauen, Daumen finden). // SW: Faktor 2 — darum
 * darf der Fahrer hoechstens 90 s brauchen.
 */
const FAHRER_BUDGET_S = 180 / 2;

describe("Der Lehrgang ist vom Wiedergabe-Fahrer schaffbar (echter Bagger, echte Kamera)", () => {
  beforeAll(async () => {
    platzLeinwand();
    await RAPIER.init();
  });

  const d = LEKTIONEN[0]!;
  const n = d.schritte.length;
  // Von vorn, mitten drin (ab „Fahren") und am letzten Schritt — jeweils aus der Startpose
  for (const ab of [0, d.schritte.findIndex((s) => s.symbol === "fahren"), n - 1]) {
    it(`${d.id} ab Schritt ${ab + 1} von ${n}`, () => {
      expect(ab).toBeGreaterThanOrEqual(0);
      const e = durchlauf(d, ab);
      const je = e.bei.map((t, i) => `${e.haekchen[i]}:${(t - (e.bei[i - 1] ?? 0)).toFixed(1)}`).join(" ");
      console.log(`Lehrgang ab Schritt ${ab + 1}: ${e.zeitS.toFixed(1)} s (Fahrer) · je Schritt bis Haekchen ${je}`);
      expect(e.haekchen).toEqual(d.schritte.map((_, i) => i + 1).slice(ab));
      expect(e.geschafft).toBe(true);
      for (const a of e.abweichung) expect(Math.abs(a.wert), `Schritt ${a.schritt}: ${a.was} endet nicht in der Startlage`).toBeLessThanOrEqual(a.tol);
      for (const m of e.marken) expect(m.abstand).toBeLessThanOrEqual(0.5);
      expect(e.zeitS).toBeLessThanOrEqual(FAHRER_BUDGET_S);
    }, 120_000);
  }
});

/* ------------------------------------------------------------------------ */
/* 3. Daten und Texte                                                        */
/* ------------------------------------------------------------------------ */

const MINI = FASSUNGEN.find((f) => f.name === "iPhone mini quer")!;
const HALTER = ["#tutorial", "#tutorial.aufgabe", "body.touch #tutorial", "body.touch #tutorial.aufgabe"];
const KARTE = ["#tutorial .karte", "#tutorial.aufgabe .karte"];
const ZUSATZ = ["#tutorial.aufgabe .zusatz"];
const TEXT = ["#tutorial p", "#tutorial.aufgabe p"];
/** Innenbreite der Aufgabenkarte (wie `test/aufgabenkatalog.test.ts`) — bis die Lehrgang-Karte eigene Masse hat */
function innen(): number {
  const links = px(HALTER, "left", MINI);
  const breite = pxOderNull(HALTER, "width", MINI);
  const rechts = breite === null ? MINI.w - px(HALTER, "right", MINI) : links + breite;
  return rechts - links - 5 - 2 - 2 * fassungInnen(KARTE, MINI)[1];
}

function platzhalter(t: string): string[] {
  return (t.match(/\{[a-z]+[+-]?\}/g) ?? []).sort();
}
const BEKANNT = ["boom", "stick", "cab", "grapple", "rotator"].flatMap((f) => [`{${f}}`, `{${f}+}`, `{${f}-}`]);

describe("Lehrgang: Daten und Texte", () => {
  it("ein Lehrgang am Stueck (L3): jeder Schritt mit Symbol, hoechstens ein Wort, Spuren 2–5 s", () => {
    expect(LEKTIONEN.map((l) => l.id)).toEqual(["lehrgang"]);
    expect(lektionNr("lehrgang")).toBe(1);
    const l = LEKTIONEN[0]!;
    // Reihenfolge laut Patrick: Kamera, Fahren, Schwenken, Arm/Stiel
    expect(l.schritte.map((s) => s.symbol)).toEqual(["kamera", "kamera", "ansicht", "ansicht", "fahren", "schwenken", "arm", "stiel", "marke"]);
    for (const s of l.schritte) {
      if (s.wort) for (const t of [s.wort.de, s.wort.en]) expect(t.trim(), s.titel.de).toMatch(/^\S+$/);
      if (!s.vorfuehrung) continue;
      expect(spurDauer(s.vorfuehrung), s.titel.de).toBeGreaterThanOrEqual(2);
      expect(spurDauer(s.vorfuehrung), s.titel.de).toBeLessThanOrEqual(5);
    }
  });

  for (const l of LEKTIONEN) {
    it(`${l.id}: zweisprachig, dieselben Platzhalter, iPhone mini quer (Ziel 1 Zeile, Schritt hoechstens 2)`, () => {
      const texte = [l.name, l.ziel, l.beschreibung, ...l.schritte.flatMap((s) => [s.titel, s.text])];
      for (const t of texte) {
        expect(t.de.trim()).not.toBe("");
        expect(t.en.trim()).not.toBe("");
        expect(platzhalter(t.en), t.de).toEqual(platzhalter(t.de));
        for (const p of platzhalter(t.de)) expect(BEKANNT, `${t.de}: unbekannter Platzhalter`).toContain(p);
        expect(t.de + t.en, t.de).not.toMatch(/\bTaste\b|\bkey\b/i);
      }
      const breite = innen();
      for (const s of ["de", "en"] as const) {
        expect(zeilen(l.ziel[s], breite, schriftgroesse(ZUSATZ, MINI)), `${s} Ziel: ${l.ziel[s]}`).toBe(1);
        for (const st of l.schritte) {
          const text = bedientext(st.text[s], defaultConfig(), s);
          expect(zeilen(text, breite, schriftgroesse(TEXT, MINI)), `${s} ${st.titel[s]}: ${text}`).toBeLessThanOrEqual(2);
        }
      }
    });
  }
});
