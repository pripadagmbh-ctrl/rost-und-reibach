/**
 * Waechter fuer die Geraeusche (E-121, 06.10.2026).
 *
 * Anlass: Patrick, 06.10.2026 — „geräusche beim greifen, schrott geräusche …
 * Geäusche entscheidend. Kehr geräusch der Spinne überarbeiten."
 *
 * Hoeren kann ein Test nicht. Pruefen kann er:
 *  1. dass jedes Ereignis aus der Bestandstabelle einen Klang ausloest,
 *  2. dass die Stimmenbegrenzung greift (ein Haufen wird kein Maschinengewehr),
 *  3. dass `greifer:zugedrueckt` mit steigender Kraft lauter wird,
 *  4. dass Kehren je Untergrund einen anderen Klangweg nimmt,
 *  5. was ein voller Haufen in Bewegung an Knoten und Rechenzeit kostet.
 *
 * Gespielt wird gegen einen nachgebauten AudioContext, der mitschreibt, welche
 * Knoten entstehen und welche Pegel gesetzt werden.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AudioManager } from "../src/audio/audioManager";
import { EventBus, type GameEvents } from "../src/core/events";
import {
  ABKLING_S,
  alleProben,
  Druckaufbau,
  knautschKlang,
  aufprallKlang,
  aufprallPegel,
  bissPegel,
  familieVon,
  kehrKlang,
  Rasselbett,
  SCHLAG_AB_MS,
  Stimmenbudget,
  stoehnen,
  DRUECK_ABSTAND_S,
  DRUECK_DAUER_S,
  spinnenDruecken,
} from "../src/audio/klangregeln";
import { LAUT_START, leseLautstaerken } from "../src/audio/lautstaerke";
import { FEIERABEND_KLANG } from "../src/audio/audioManager";

// ---------------------------------------------------------------- Attrappen

interface Param {
  value: number;
  /** groesster je geplante Wert */
  max: number;
  /** zuletzt geplantes Ziel */
  ziel: number;
}

function param(): Param & Record<string, unknown> {
  const p: Param & Record<string, unknown> = { value: 0, max: 0, ziel: 0 };
  const merk = (v: number): typeof p => {
    p.max = Math.max(p.max, v);
    p.ziel = v;
    return p;
  };
  p.setValueAtTime = merk;
  p.linearRampToValueAtTime = merk;
  p.exponentialRampToValueAtTime = merk;
  p.setTargetAtTime = merk;
  p.cancelScheduledValues = () => p;
  return p;
}

class FakeCtx {
  state = "running";
  currentTime = 0;
  sampleRate = 8000; // klein: die Knisterpuffer werden im Test nur einmal gerechnet
  onstatechange: (() => void) | null = null;
  destination = {};
  quellen = 0;
  oszillatoren = 0;
  gains: Param[] = [];
  /** Alle Pufferquellen — welche Aufnahme sie spielen, steht in `buffer.name` (E-130) */
  pufferQuellen: Array<{ buffer: { name?: string } | null }> = [];
  /** Jede Quelle (Puffer und Oszillator) — fuer die Gruppenpruefung (E-139) */
  alleQuellen: Array<Record<string, unknown>> = [];

  private knoten(quelle: boolean): Record<string, unknown> {
    if (quelle) this.quellen++;
    const k: Record<string, unknown> = {
      gain: param(),
      frequency: param(),
      Q: param(),
      detune: param(),
      playbackRate: param(),
      threshold: param(),
      knee: param(),
      ratio: param(),
      attack: param(),
      release: param(),
      type: "",
      buffer: null,
      loop: false,
      connect: (ziel: unknown) => {
        (k.ziele as unknown[]).push(ziel); // E-139: wohin jeder Knoten geht
        return ziel;
      },
      ziele: [] as unknown[],
      disconnect: () => {},
      start: (t?: number) => {
        k.startAt = t ?? 0; // E-148: wann eine Quelle einsetzt
      },
      stop: () => {},
    };
    if (quelle) this.alleQuellen.push(k);
    this.gains.push(k.gain as Param);
    return k;
  }
  createGain = (): unknown => this.knoten(false);
  createBiquadFilter = (): unknown => this.knoten(false);
  createDynamicsCompressor = (): unknown => this.knoten(false);
  createOscillator = (): unknown => {
    this.oszillatoren++;
    return this.knoten(true);
  };
  createBufferSource = (): unknown => {
    const k = this.knoten(true);
    this.pufferQuellen.push(k as { buffer: { name?: string } | null });
    return k;
  };
  /** E-130: „dekodiert" eine Aufnahme — die Attrappe von fetch legt den Namen in die Bytes */
  decodeAudioData = async (b: ArrayBuffer): Promise<unknown> => ({
    name: new TextDecoder().decode(b),
    duration: 0.5,
    length: 0.5 * 48000,
    numberOfChannels: 1,
  });
  createBuffer = (_k: number, len: number): unknown => {
    const d = new Float32Array(len);
    return { getChannelData: () => d };
  };
  async resume(): Promise<void> {}
  async close(): Promise<void> {}
}

let ctx: FakeCtx;
const g = globalThis as Record<string, unknown>;
const echt = { window: g.window, document: g.document, AudioContext: g.AudioContext };

beforeEach(() => {
  const horcher: Array<() => void> = [];
  g.window = {
    addEventListener: (t: string, f: () => void) => {
      if (t === "pointerdown") horcher.push(f);
    },
    setTimeout: () => 0,
    setInterval: () => 1,
    clearInterval: () => {},
  };
  g.document = { hidden: false, addEventListener: () => {} };
  g.AudioContext = function (): FakeCtx {
    ctx = new FakeCtx();
    return ctx;
  };
  (g as { _geste?: () => void })._geste = () => horcher.forEach((f) => f());
});

afterEach(() => {
  g.window = echt.window;
  g.document = echt.document;
  g.AudioContext = echt.AudioContext;
});

/** Manager mit Bus, nach der ersten Geste. Musik aus, damit sie nicht mitzaehlt. */
function starte(): { mgr: AudioManager; bus: EventBus } {
  const bus = new EventBus();
  const mgr = new AudioManager(bus);
  if (mgr.musicOn) mgr.toggleMusic(); // E-139: startet ohnehin aus
  (g as { _geste: () => void })._geste();
  return { mgr, bus };
}

/** Was hat `f` an Quellen angelegt, und welcher Pegel war der lauteste? */
function miss(f: () => void): { quellen: number; lautester: number } {
  const q0 = ctx.quellen;
  const g0 = ctx.gains.length;
  f();
  const neu = ctx.gains.slice(g0);
  return { quellen: ctx.quellen - q0, lautester: Math.max(0, ...neu.map((p) => p.max)) };
}

function aufprall(
  materialId: string,
  wucht: number,
  untergrund: GameEvents["schrott:aufprall"]["untergrund"] = "beton",
  massKg = 80
): GameEvents["schrott:aufprall"] {
  return { materialId, massKg, wucht, blech: false, untergrund, x: 0, y: 0, z: 0 };
}

// ---------------------------------------------------- 1. jedes Ereignis klingt

describe("Bestandstabelle: jedes Ereignis loest einen Klang aus", () => {
  it("Aufprall, Biss und Loslassen ueber den Bus", () => {
    const { bus } = starte();
    for (const u of ["beton", "stahl", "schrott"] as const) {
      ctx.currentTime += 2; // frisches Kontingent
      expect(miss(() => bus.emit("schrott:aufprall", aufprall("steel", 5, u))).quellen).toBeGreaterThan(0);
    }
    expect(miss(() => bus.emit("greifer:zugedrueckt", { handle: 1, kraftKN: 20, x: 0, y: 0, z: 0 })).quellen).toBeGreaterThan(0);
    expect(miss(() => bus.emit("released", { count: 1 })).quellen).toBeGreaterThan(0);
  });

  it("jedes Material hat einen Aufprallklang", () => {
    const { bus } = starte();
    const materialien = ["steel", "va", "alu", "copper", "brass", "zinc", "battery", "cable", "mixed", "wood", "tires", "rubble", "plastic"];
    for (const m of materialien) {
      ctx.currentTime += 2;
      expect(miss(() => bus.emit("schrott:aufprall", aufprall(m, 5))).quellen, m).toBeGreaterThan(0);
    }
  });

  it("die bisherigen Klaenge bleiben (Zuschnappen, Zupacken, Quetschen, Glas, Zaun, Abriss)", () => {
    const { mgr } = starte();
    for (const f of [
      () => mgr.playClawSnap(1),
      () => mgr.playGrab("copper"),
      () => mgr.playCrash(1),
      () => mgr.playGlass(),
      () => mgr.playRattle(),
      () => mgr.playTear(),
    ]) {
      expect(miss(f).quellen).toBeGreaterThan(0);
    }
  });

  it("Zupacken klingt nach dem Material, das gefasst wird", () => {
    const { mgr } = starte();
    const ohne = miss(() => mgr.playGrab()).quellen;
    const mit = miss(() => mgr.playGrab("alu")).quellen;
    expect(mit).toBeGreaterThan(ohne);
  });

  // E-130: Der Druckklang haengt an der AENDERUNG der Kraft, nicht an ihrem
  // Wert (Befund 16.10.2026: Dauerton beim Zuhalten). Darum laeuft zwischen den
  // Bildern jetzt Zeit — ein Kraftsprung im selben Augenblick hat kein Tempo.
  it("Zudruecken und Schalenfahrt ziehen ihre Dauertoene hoch", () => {
    const { mgr } = starte();
    const m = mgr as unknown as {
      stoehnGain: { gain: Param };
      schalenGain: { gain: Param };
      ventilGain: { gain: Param };
    };
    mgr.setGreifer(0, 0);
    expect(m.stoehnGain.gain.ziel).toBe(0);
    ctx.currentTime += 1 / 60;
    mgr.setGreifer(1, 0.5);
    expect(m.stoehnGain.gain.ziel).toBeGreaterThan(0);
    expect(m.schalenGain.gain.ziel).toBeGreaterThan(0);
    expect(m.ventilGain.gain.ziel).toBe(0);
    ctx.currentTime += 1 / 60;
    mgr.setGreifer(0, 1);
    expect(m.ventilGain.gain.ziel).toBeGreaterThan(0); // Ventil zischt erst am Ende
  });
});

// -------------------------------------------------------------- 2. Begrenzung

describe("Stimmenbegrenzung", () => {
  it("ein Haufen mit 200 Aufprallen im selben Moment gibt hoechstens 4 leise Schlaege", () => {
    const { mgr, bus } = starte();
    ctx.currentTime = 10;
    const schlaegeVorher = mgr.stimmen;
    for (let i = 0; i < 200; i++) bus.emit("schrott:aufprall", aufprall("steel", 2.5, "schrott", 20));
    expect(schlaegeVorher).toBe(0);
    expect(mgr.stimmen).toBe(4);
  });

  it("laute Schlaege kommen am Kontingent vorbei, aber nie ueber sechs Stimmen", () => {
    const { mgr, bus } = starte();
    ctx.currentTime = 10;
    for (let i = 0; i < 50; i++) bus.emit("schrott:aufprall", aufprall("steel", 7, "stahl", 800));
    expect(mgr.stimmen).toBe(6);
  });

  it("nach einem klappernden Haufen kommt ein lauter Schlag trotzdem durch", () => {
    const b = new Stimmenbudget();
    for (let i = 0; i < 20; i++) b.darf(0, 0.01, 0.2); // Kontingent leer
    expect(b.darf(0.02, 0.3, 0.2)).toBe(false); // leise: nein
    expect(b.darf(0.02, 0.3, 0.9)).toBe(true); // laut: ja
  });

  it("was abgewiesen wird, rasselt — gedeckelt", () => {
    const { mgr, bus } = starte();
    const bett = (mgr as unknown as { bettGain: { gain: Param } }).bettGain.gain;
    ctx.currentTime = 10;
    for (let i = 0; i < 500; i++) bus.emit("schrott:aufprall", aufprall("steel", 3, "schrott", 20));
    expect(bett.max).toBeGreaterThan(0);
    expect(bett.max).toBeLessThanOrEqual(0.12 + 1e-9);
  });

  it("das Kontingent fuellt sich wieder auf (4 je Sekunde)", () => {
    const b = new Stimmenbudget();
    let n = 0;
    for (let t = 0; t < 10; t += 0.01) if (b.darf(t, 0.05, 0.3)) n++;
    // 4 Vorrat + 4/s ueber 10 s = 44, Rundung an den Raendern
    expect(n).toBeGreaterThanOrEqual(42);
    expect(n).toBeLessThanOrEqual(45);
  });

  it("das Rasselbett klingt ab und bleibt unter dem Deckel", () => {
    const r = new Rasselbett();
    for (let i = 0; i < 100; i++) r.dazu(0, 0.5);
    expect(r.stand(0)).toBe(1);
    expect(r.stand(1)).toBeLessThan(0.1);
  });
});

// ----------------------------------------------------------------- 3. Kraft

describe("Zudruecken: haerter = lauter", () => {
  it("bissPegel steigt mit der Kraft", () => {
    let vorher = -1;
    for (const kn of [0, 5, 15, 25, 35, 49.05]) {
      expect(bissPegel(kn)).toBeGreaterThan(vorher);
      vorher = bissPegel(kn);
    }
    expect(bissPegel(0)).toBeGreaterThan(0); // auch ein leichter Biss ist hoerbar
  });

  it("greifer:zugedrueckt mit 45 kN ist lauter als mit 5 kN", () => {
    const { bus } = starte();
    const biss = (kn: number): number => {
      ctx.currentTime += 1;
      return miss(() => bus.emit("greifer:zugedrueckt", { handle: 1, kraftKN: kn, x: 0, y: 0, z: 0 })).lautester;
    };
    const leise = biss(5);
    const mittel = biss(25);
    const laut = biss(45);
    expect(mittel).toBeGreaterThan(leise);
    expect(laut).toBeGreaterThan(mittel);
  });

  it("mehrere Koerper im selben Biss knirschen nur einmal", () => {
    const { bus } = starte();
    ctx.currentTime = 5;
    const erst = miss(() => bus.emit("greifer:zugedrueckt", { handle: 1, kraftKN: 30, x: 0, y: 0, z: 0 })).quellen;
    const zweit = miss(() => bus.emit("greifer:zugedrueckt", { handle: 2, kraftKN: 30, x: 0, y: 0, z: 0 })).quellen;
    expect(erst).toBeGreaterThan(0);
    expect(zweit).toBe(0);
  });

  it("das Stoehnen wird mit der Kraft lauter und hoeher", () => {
    const a = stoehnen(0.2);
    const b = stoehnen(0.8);
    expect(b.laut).toBeGreaterThan(a.laut);
    // E-130: auf der Aufnahme heisst „hoeher" schnelleres Abspielen (vorher Oszillator-Hz)
    expect(b.rate).toBeGreaterThan(a.rate);
    expect(stoehnen(0).laut).toBe(0);
  });
});

// ----------------------------------------------------------------- 4. Kehren

describe("Kehren je Untergrund", () => {
  it("nimmt je Untergrund einen eigenen Klangweg, die anderen schweigen", () => {
    const { mgr } = starte();
    const kehr = (mgr as unknown as { kehr: Record<string, { gain: { gain: Param } }> }).kehr;
    for (const u of ["beton", "stahl", "schrott"] as const) {
      mgr.setScrape(0.7, u);
      for (const v of ["beton", "stahl", "schrott"]) {
        if (v === u) expect(kehr[v]!.gain.gain.ziel, `${u}`).toBeGreaterThan(0);
        else expect(kehr[v]!.gain.gain.ziel, `${u}→${v}`).toBe(0);
      }
    }
    mgr.setScrape(0);
    for (const v of ["beton", "stahl", "schrott"]) expect(kehr[v]!.gain.gain.ziel).toBe(0);
  });

  it("schneller = lauter und heller", () => {
    for (const u of ["beton", "stahl", "schrott"] as const) {
      const a = kehrKlang(0.2, u);
      const b = kehrKlang(0.9, u);
      expect(b.laut).toBeGreaterThan(a.laut);
      expect(b.hz).toBeGreaterThan(a.hz);
    }
  });

  it("die drei Untergruende liegen in verschiedenen Lagen (Stahl am hoechsten)", () => {
    const hz = (u: "beton" | "stahl" | "schrott"): number => kehrKlang(0.5, u).hz;
    expect(hz("stahl")).toBeGreaterThan(hz("schrott"));
    expect(hz("schrott")).toBeGreaterThan(hz("beton"));
  });
});

// ------------------------------------------------------- Klangregeln, pur

describe("Aufprall-Regeln", () => {
  it("unter der Schwelle kein Schlag, nur Rasseln", () => {
    expect(aufprallKlang(aufprall("steel", SCHLAG_AB_MS - 0.01))).toBeNull();
    expect(aufprallKlang(aufprall("steel", SCHLAG_AB_MS))).not.toBeNull();
  });

  it("haerter und schwerer = lauter", () => {
    expect(aufprallPegel(5, 80)).toBeGreaterThan(aufprallPegel(2, 80));
    expect(aufprallPegel(5, 800)).toBeGreaterThan(aufprallPegel(5, 8));
  });

  it("Stahl dumpf, Blech scheppert, Alu und Kupfer heller", () => {
    const grund = (m: string, kg = 200, blech = false): number =>
      aufprallKlang({ materialId: m, massKg: kg, wucht: 5, blech, untergrund: "stahl" })!.teil.teiltoene[0]!;
    expect(familieVon("steel", 200, false)).toBe("stahl");
    expect(familieVon("steel", 200, true)).toBe("blech");
    expect(familieVon("steel", 10, false)).toBe("blech");
    expect(grund("steel")).toBeLessThan(grund("steel", 200, true));
    expect(grund("alu")).toBeGreaterThan(grund("steel"));
    expect(grund("copper")).toBeGreaterThan(grund("steel"));
    const blech = aufprallKlang({ materialId: "steel", massKg: 20, wucht: 5, blech: true, untergrund: "beton" })!;
    expect(blech.teil.scheppern).toBeGreaterThan(0);
  });

  it("jeder Klang hat Anteile ueber 300 Hz — sonst stumm auf dem iPhone-Lautsprecher", () => {
    for (const m of ["steel", "va", "alu", "copper", "cable", "battery", "wood", "tires", "rubble", "plastic"]) {
      for (const u of ["beton", "stahl", "schrott"] as const) {
        const r = aufprallKlang({ materialId: m, massKg: 500, wucht: 5, blech: false, untergrund: u })!;
        expect(Math.max(...r.teil.teiltoene), m).toBeGreaterThan(300);
        expect(Math.max(...r.grund.teiltoene), u).toBeGreaterThan(300);
      }
    }
  });
});

// ------------------------------------------------------------- 5. Rechenzeit

describe("Rechenzeit: voller Haufen in Bewegung", () => {
  it("300 Teile, jedes meldet so oft es darf (alle 0,18 s), 5 s lang", () => {
    const { mgr, bus } = starte();
    const TEILE = 300;
    const FPS = 60;
    const SEK = 5;
    const JE_BILD = Math.ceil(TEILE / 11); // 0,18 s Sperre je Teil bei 60 Hz
    const lauf = (start: number): { ereignisse: number; stimmen: number } => {
      let ereignisse = 0;
      let stimmen = 0;
      for (let bild = 0; bild < FPS * SEK; bild++) {
        ctx.currentTime = start + bild / FPS;
        for (let i = 0; i < JE_BILD; i++) {
          const wucht = 1.1 + Math.random() * 5;
          const m = ["steel", "alu", "copper", "mixed"][i % 4]!;
          bus.emit("schrott:aufprall", aufprall(m, wucht, "schrott", 5 + Math.random() * 200));
          ereignisse++;
        }
        stimmen = Math.max(stimmen, mgr.stimmen);
      }
      return { ereignisse, stimmen };
    };
    lauf(20); // Aufwaermen: der erste Lauf misst den Uebersetzer, nicht den Ton
    const q0 = ctx.quellen;
    const k0 = ctx.gains.length;
    const t0 = performance.now();
    const { ereignisse, stimmen } = lauf(40);
    const ms = performance.now() - t0;
    const quellenJeS = (ctx.quellen - q0) / SEK;
    const knotenJeS = (ctx.gains.length - k0) / SEK;
    console.info(
      `[E-121 Messung] ${ereignisse} Aufpralle in ${SEK} s (${(ereignisse / SEK).toFixed(0)}/s): ` +
        `${ms.toFixed(1)} ms JS gesamt = ${((ms / (FPS * SEK)) * 1000).toFixed(1)} µs je Bild; ` +
        `${quellenJeS.toFixed(0)} neue Quellen/s, ${knotenJeS.toFixed(0)} neue Knoten/s, ` +
        `hoechstens ${stimmen} Schlaege gleichzeitig`
    );
    expect(stimmen).toBeLessThanOrEqual(6);
    // 4 Schlaege/s plus laute: grosszuegige Obergrenze, damit ein Fehler im
    // Budget auffaellt (ohne Budget waeren es ueber 40 000 Knoten/s)
    expect(knotenJeS).toBeLessThan(1500);
  });
});

// -------------------------------------------------- 6. Aufnahmen (E-130)

/** fetch-Attrappe: jede Aufnahme ist da, ihr Name steckt in den Bytes. */
async function starteMitAufnahmen(): Promise<{ mgr: AudioManager; bus: EventBus }> {
  const alt = g.fetch;
  g.fetch = async (url: string) => ({
    ok: true,
    arrayBuffer: async () => new TextEncoder().encode(String(url).replace(/^.*\/(.+)\.wav$/, "$1")).buffer,
  });
  const r = starte();
  g.fetch = alt;
  for (let i = 0; i < 10; i++) await new Promise((f) => setTimeout(f, 0));
  return r;
}

/** Welche Aufnahmen hat `f` angestossen? */
function gespielt(f: () => void): string[] {
  const n0 = ctx.pufferQuellen.length;
  f();
  return ctx.pufferQuellen.slice(n0).map((q) => q.buffer?.name ?? "?");
}

describe("Aufnahmen statt Oszillatoren (E-130)", () => {
  it("alle Aufnahmen werden geholt und dekodiert, die Dauerklaenge laufen danach ohne einen Oszillator", async () => {
    const { mgr } = await starteMitAufnahmen();
    expect(mgr.aufnahmenBericht.geladen).toBe(alleProben().length);
    const o0 = ctx.oszillatoren;
    (mgr as unknown as { baueDauertoene: () => void }).baueDauertoene();
    expect(ctx.oszillatoren - o0).toBe(0);
  });

  it("ein Stahlteil auf der Ladeflaeche spielt eine Stahl-Aufnahme und das Wummern der Platte", async () => {
    const { bus } = await starteMitAufnahmen();
    ctx.currentTime += 2;
    const namen = gespielt(() => bus.emit("schrott:aufprall", aufprall("steel", 5, "stahl", 300)));
    expect(namen.some((n) => n.startsWith("stahl_"))).toBe(true);
    expect(namen.some((n) => n.startsWith("grund_stahl"))).toBe(true);
  });

  it("Biss, Zupacken, Loslassen und Zuschnappen klingen aus Aufnahmen", async () => {
    const { mgr, bus } = await starteMitAufnahmen();
    ctx.currentTime += 1;
    expect(gespielt(() => bus.emit("greifer:zugedrueckt", { handle: 1, kraftKN: 30, x: 0, y: 0, z: 0 }))[0]).toMatch(/^biss_/);
    expect(gespielt(() => mgr.playGrab())).toContain("zupacken");
    expect(gespielt(() => bus.emit("released", { count: 1 }))).toContain("ventil");
    expect(gespielt(() => mgr.playClawSnap(1))[0]).toMatch(/^anschlag_/);
  });
});

describe("Kein Greifklang bleibt stehen (E-130, Befund 16.10.2026)", () => {
  /*
   * Patrick: „beim greifen ein durchgängiger ton …, der sollte nie durchgängig
   * sein wie in einem ufo oder spaceship". Probe: in 0,3 s auf 90 % zudruecken,
   * dann 3 s zuhalten (Schalen stehen). Nach STUMM_NACH_S muss es still sein.
   * 1 s: Der Druck klingt mit 0,15 s ab (nach 1 s bei 0,1 %), das Ventil mit
   * 0,3 s (4 % von 0,1); dazu 0,05 s Glaettung im Manager. Was nach einer
   * Sekunde Zuhalten noch klingt, ist ein Dauerton.
   */
  const STUMM_NACH_S = 1;
  const STILL = 0.005; // Pegel: rund ein Zwanzigstel des Zupackens

  /** Hoechster Pegel nach STUMM_NACH_S Zuhalten, fuer eine Rechnung (t, kraft) → Pegel. */
  function zuhalten(pegel: (t: number, k: number) => number): number {
    let letzter = 0;
    for (let i = 0; i < 60 * 3.3; i++) {
      const t = i / 60;
      const p = pegel(t, Math.min(0.9, (t / 0.3) * 0.9));
      if (t >= 0.3 + STUMM_NACH_S) letzter = Math.max(letzter, p);
    }
    return letzter;
  }

  it("die Rechnung: Druck und Ventil sind nach einer Sekunde Zuhalten still", () => {
    const d = new Druckaufbau();
    expect(zuhalten((t, k) => d.schritt(t, k).laut)).toBeLessThan(STILL);
    const v = new Druckaufbau();
    expect(zuhalten((t, k) => v.schritt(t, k).zischen)).toBeLessThan(STILL);
    expect(ABKLING_S).toBeLessThan(STUMM_NACH_S / 4);
  });

  it("Gegenprobe: das alte Verhalten (Pegel am Wert der Kraft, E-121) faellt durch", () => {
    expect(zuhalten((_t, k) => stoehnen(k).laut)).toBeGreaterThan(STILL);
    expect(zuhalten((_t, k) => stoehnen(k).zischen)).toBeGreaterThan(STILL);
  });

  it("aber Zudruecken ist zu hoeren: waehrend die Kraft steigt, schwillt der Druck an", () => {
    const d = new Druckaufbau();
    let hoechst = 0;
    for (let i = 0; i < 18; i++) hoechst = Math.max(hoechst, d.schritt(i / 60, (i / 18) * 0.9).laut);
    expect(hoechst).toBeGreaterThan(0.05);
  });

  it("im Manager: Schalen zu, Kraft konstant → nach einer Sekunde ist jeder Greifkanal still", async () => {
    for (const mitAufnahmen of [false, true]) {
      const { mgr } = mitAufnahmen ? await starteMitAufnahmen() : starte();
      const m = mgr as unknown as { stoehnGain: { gain: Param }; schalenGain: { gain: Param }; ventilGain: { gain: Param } };
      const t0 = ctx.currentTime;
      for (let i = 0; i < 60 * 3.3; i++) {
        const t = i / 60;
        ctx.currentTime = t0 + t;
        mgr.setGreifer(t < 0.3 ? 1 : 0, Math.min(0.9, (t / 0.3) * 0.9)); // Schalen fahren zu, dann stehen sie
        mgr.updateEngine(0, 0.3);
      }
      const name = mitAufnahmen ? "mit Aufnahmen" : "ohne";
      expect(m.stoehnGain.gain.ziel, name).toBeLessThan(STILL);
      expect(m.ventilGain.gain.ziel, name).toBeLessThan(STILL);
      expect(m.schalenGain.gain.ziel, name).toBe(0);
    }
  });
});

describe("Knautschen (E-130)", () => {
  it("mehr Zuwachs = lauter, laenger, tiefer, dichter", () => {
    const biss = knautschKlang(0.17);
    const presse = knautschKlang(1);
    expect(presse.pegel).toBeGreaterThan(biss.pegel);
    expect(presse.dauer).toBeGreaterThan(biss.dauer);
    expect(presse.rate).toBeLessThan(biss.rate);
    expect(presse.schlaege).toBeGreaterThan(biss.schlaege);
  });

  it("wrack:geknautscht klingt, und ein crushed im selben Moment knallt nicht noch einmal darueber", async () => {
    for (const mitAufnahmen of [false, true]) {
      const { mgr, bus } = mitAufnahmen ? await starteMitAufnahmen() : starte();
      ctx.currentTime += 2;
      expect(miss(() => bus.emit("wrack:geknautscht", { handle: 1, grad: 0.5, zuwachs: 0.5, x: 0, y: 0, z: 0 })).quellen).toBeGreaterThan(0);
      expect(miss(() => mgr.playCrash(1)).quellen, "crushed direkt danach").toBe(0);
      ctx.currentTime += 1;
      expect(miss(() => mgr.playCrash(1)).quellen, "crushed allein").toBeGreaterThan(0);
    }
  });

  it("die Presse (Zuwachs 1) schichtet mehr Metallschlaege als ein Biss", async () => {
    const { mgr } = await starteMitAufnahmen();
    ctx.currentTime += 2;
    const biss = gespielt(() => mgr.playKnautsch(0.17));
    ctx.currentTime += 2;
    const presse = gespielt(() => mgr.playKnautsch(1));
    expect(biss[0]).toMatch(/^knautsch_/);
    expect(presse.length).toBeGreaterThan(biss.length);
  });
});

// ------------------------------------- 7. Keine Tonkette, kein Dauerton (E-139)

/**
 * Die Spinnen-Ereignisse (Vertrag E-139) kommen vom Bagger-Bereich nach
 * core/events.ts; bis dahin hier ohne Typpruefung gesendet.
 */
type SpinnenGrund = "beton" | "stahl" | "schrott" | "wrack";
function hieb(bus: EventBus, wucht: number, untergrund: SpinnenGrund): void {
  (bus as unknown as { emit(n: string, p: unknown): void }).emit("spinne:aufschlag", { wucht, untergrund, x: 0, y: 0, z: 0 });
}
function druck(bus: EventBus, staerke: number, untergrund: SpinnenGrund): void {
  (bus as unknown as { emit(n: string, p: unknown): void }).emit("spinne:druecken", { staerke, untergrund, x: 0, y: 0, z: 0 });
}

describe("Echte Klaenge statt Tonketten (E-139, Befund 17.10.2026)", () => {
  /*
   * Patrick: „kindliche Klänge und Tonketten … eher mit echten Klängen
   * arbeiten." Und: Hämmern und Drücken mit der Spinne muss man hören.
   */
  it("das Radio ist beim Start aus", () => {
    expect(new AudioManager().musicOn).toBe(false);
  });

  it("Rueckmeldungen, Abriss, Zaun, Glocke und Sterne spielen Aufnahmen — kein einziger Oszillator", async () => {
    const { mgr, bus } = await starteMitAufnahmen();
    ctx.currentTime += 2;
    const o0 = ctx.oszillatoren;
    const namen = gespielt(() => {
      mgr.playSale();
      mgr.playCorrect();
      mgr.playWrong();
      mgr.playTick();
      mgr.playSterne(3);
      mgr.playFeierabend();
      mgr.playHupe();
      mgr.playTear();
      mgr.playRattle();
      bus.emit("released", { count: 1 });
      hieb(bus, 1, "beton");
      druck(bus, 1, "wrack");
    });
    expect(ctx.oszillatoren - o0).toBe(0);
    expect(namen.length).toBeGreaterThan(8);
  });

  it("Sterne: so viele Hammerschlaege wie Sterne, alle Stahl", async () => {
    const { mgr } = await starteMitAufnahmen();
    const namen = gespielt(() => mgr.playSterne(3));
    expect(namen).toHaveLength(3);
    for (const n of namen) expect(n).toMatch(/^stahl_/);
  });

  it("Hammerschlag: Untergrund hoerbar, haerter = lauter, nie Trommelfeuer", async () => {
    const { bus } = await starteMitAufnahmen();
    const schlag = (wucht: number, untergrund: SpinnenGrund): string[] => {
      ctx.currentTime += 1;
      return gespielt(() => hieb(bus, wucht, untergrund));
    };
    expect(schlag(1, "beton")).toContain("grund_beton");
    expect(schlag(1, "stahl").some((n) => n.startsWith("grund_stahl"))).toBe(true);
    expect(schlag(1, "schrott").some((n) => n.startsWith("grund_schrott"))).toBe(true);
    expect(schlag(1, "wrack").some((n) => n.startsWith("knautsch_"))).toBe(true);
    ctx.currentTime += 1;
    const leise = miss(() => hieb(bus, 0.1, "beton")).lautester;
    ctx.currentTime += 1;
    const laut = miss(() => hieb(bus, 1, "beton")).lautester;
    expect(laut).toBeGreaterThan(leise);
    // gleich danach noch einer: still
    ctx.currentTime += 0.05;
    expect(gespielt(() => hieb(bus, 1, "beton"))).toHaveLength(0);
  });

  it("Druecken: ein Stoss ist immer kuerzer als die Pause danach", () => {
    expect(DRUECK_DAUER_S).toBeLessThan(DRUECK_ABSTAND_S);
    for (let i = 0; i < 500; i++) {
      for (const u of ["beton", "stahl", "schrott", "wrack"] as const) {
        expect(spinnenDruecken(Math.random(), u).dauer!).toBeLessThanOrEqual(DRUECK_DAUER_S);
      }
    }
  });

  it("Druecken: 3 s lang jedes Bild gemeldet → einzelne Stoesse, nie ein Dauerton", async () => {
    const { bus } = await starteMitAufnahmen();
    const t0 = ctx.currentTime + 1;
    const starts: number[] = [];
    for (let i = 0; i < 180; i++) {
      ctx.currentTime = t0 + i / 60;
      if (gespielt(() => druck(bus, 0.8, "schrott")).length) {
        starts.push(ctx.currentTime);
      }
    }
    // hoerbar: mehrere Stoesse; nie dichter als Stoss + Pause
    expect(starts.length).toBeGreaterThanOrEqual(6);
    expect(starts.length).toBeLessThanOrEqual(Math.ceil(3 / DRUECK_ABSTAND_S));
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i]! - starts[i - 1]!).toBeGreaterThanOrEqual(DRUECK_ABSTAND_S - 1e-9);
    }
  });
});

// --------------------------------------- 8. Lautstaerke je Gruppe (E-139)

describe("Lautstaerke je Gruppe (E-139, Wunsch 17.10.2026)", () => {
  /** Welche Gruppen erreicht ein Knoten, wenn man seinen Verbindungen folgt? */
  function gruppenVon(start: Record<string, unknown>, gruppen: Map<unknown, string>): Set<string> {
    const gefunden = new Set<string>();
    const offen: unknown[] = [start];
    const gesehen = new Set<unknown>();
    while (offen.length) {
      const k = offen.pop() as Record<string, unknown>;
      if (gesehen.has(k)) continue;
      gesehen.add(k);
      const name = gruppen.get(k);
      if (name) {
        gefunden.add(name);
        continue;
      }
      offen.push(...((k.ziele as unknown[] | undefined) ?? []));
    }
    return gefunden;
  }
  const karteVon = (mgr: AudioManager): Map<unknown, string> => {
    const gr = (mgr as unknown as { gruppen: Record<string, unknown> }).gruppen;
    return new Map<unknown, string>(Object.entries(gr).map(([n, k]) => [k, n]));
  };

  it("jeder Klang haengt an genau einer Gruppe — Dauertoene, Ereignisse, Radio", async () => {
    for (const mitAufnahmen of [false, true]) {
      const { mgr, bus } = mitAufnahmen ? await starteMitAufnahmen() : starte();
      mgr.toggleMusic(); // Radio an, damit es mitzaehlt
      ctx.currentTime += 2;
      bus.emit("schrott:aufprall", aufprall("steel", 5, "stahl", 300));
      bus.emit("greifer:zugedrueckt", { handle: 1, kraftKN: 30, x: 0, y: 0, z: 0 });
      bus.emit("released", { count: 1 });
      bus.emit("wrack:geknautscht", { handle: 1, grad: 0.5, zuwachs: 0.5, x: 0, y: 0, z: 0 });
      hieb(bus, 1, "wrack");
      druck(bus, 1, "beton");
      mgr.playGrab("copper");
      mgr.playClawSnap(1);
      mgr.playTear();
      mgr.playRattle();
      mgr.playGlass();
      mgr.playDrop("steel");
      mgr.playCorrect();
      mgr.playWrong();
      mgr.playTick();
      mgr.playSterne(2);
      mgr.playFeierabend();
      mgr.playHupe();
      ctx.currentTime += 1;
      mgr.playCrash(1);
      const karte = karteVon(mgr);
      expect(ctx.alleQuellen.length).toBeGreaterThan(20);
      for (const q of ctx.alleQuellen) {
        const gr = gruppenVon(q, karte);
        const name = (q.buffer as { name?: string } | null)?.name ?? "Rauschen/Oszillator";
        expect(gr.size, `${name} (${mitAufnahmen ? "mit" : "ohne"} Aufnahmen) haengt an ${[...gr].join("+") || "keiner"}`).toBe(1);
      }
    }
  });

  it("Motor und Hydraulik an Bagger, Aufprall und Kratzen an Metall", async () => {
    const { mgr, bus } = await starteMitAufnahmen();
    const karte = karteVon(mgr);
    ctx.currentTime += 2;
    bus.emit("schrott:aufprall", aufprall("steel", 5, "stahl", 300));
    const gruppeVon = (name: string): Set<string> =>
      new Set(
        ctx.alleQuellen
          .filter((q) => (q.buffer as { name?: string } | null)?.name === name)
          .flatMap((q) => [...gruppenVon(q, karte)])
      );
    expect(gruppeVon("motor")).toEqual(new Set(["bagger"]));
    expect(gruppeVon("hyd_druck")).toEqual(new Set(["bagger"]));
    expect(gruppeVon("hyd_fahrt")).toEqual(new Set(["bagger"]));
    expect(gruppeVon("kehr_beton")).toEqual(new Set(["metall"]));
    const grund = new Set([...gruppeVon("grund_stahl_1"), ...gruppeVon("grund_stahl_2")]);
    expect(grund).toEqual(new Set(["metall"]));
  });

  it("der Regler wirkt sofort auf die Gruppe und wird gemerkt", () => {
    const speicher = new Map<string, string>();
    g.localStorage = { getItem: (k: string) => speicher.get(k) ?? null, setItem: (k: string, v: string) => speicher.set(k, v) };
    try {
      const { mgr } = starte();
      mgr.setLautstaerke("metall", 0.3);
      const gr = (mgr as unknown as { gruppen: Record<string, { gain: Param }> }).gruppen;
      expect(gr.metall!.gain.ziel).toBeCloseTo(0.3);
      expect(mgr.lautstaerke("metall")).toBeCloseTo(0.3);
      const zweiter = new AudioManager(new EventBus()); // naechster Start
      expect(zweiter.lautstaerke("metall")).toBeCloseTo(0.3);
      expect(zweiter.lautstaerke("bagger")).toBe(1);
    } finally {
      delete g.localStorage;
    }
  });

  it("kaputter oder fehlender Speicher: Startwerte, kein Absturz", () => {
    expect(leseLautstaerken(null)).toEqual(LAUT_START);
    expect(leseLautstaerken("{kaputt")).toEqual(LAUT_START);
    expect(leseLautstaerken('{"bagger":7,"metall":-1,"musik":"laut"}')).toEqual({ bagger: 1, metall: 0, musik: 1 });
    // Safari-Privatmodus: localStorage wirft
    const wirft = (): never => {
      throw new Error("privat");
    };
    g.localStorage = { getItem: wirft, setItem: wirft };
    try {
      const mgr = new AudioManager();
      expect(mgr.lautstaerke("musik")).toBe(1);
      expect(() => mgr.setLautstaerke("musik", 0.5)).not.toThrow();
    } finally {
      delete g.localStorage;
    }
  });
});

// ------------------------------------------- 9. Hupe und Feierabend (E-148)

describe("Echte Signale: Hupe, Sirene, Klingel (E-148)", () => {
  it("Feierabend ruft die Sirene (Vorgabe), die Klingel ist die Alternative", async () => {
    expect(FEIERABEND_KLANG).toBe("sirene");
    const { mgr } = await starteMitAufnahmen();
    expect(gespielt(() => mgr.playFeierabend())).toEqual([FEIERABEND_KLANG]);
    expect(alleProben()).toEqual(expect.arrayContaining(["sirene", "klingel", "hupe"]));
  });

  it("der Fahrer hupt zweimal mit der echten Hupe, an der Gruppe Bagger", async () => {
    const { mgr } = await starteMitAufnahmen();
    const n0 = ctx.alleQuellen.length;
    expect(gespielt(() => mgr.playHupe())).toEqual(["hupe", "hupe"]);
    const gr = (mgr as unknown as { gruppen: Record<string, unknown> }).gruppen;
    for (const q of ctx.alleQuellen.slice(n0)) {
      // jede Hupen-Quelle fuehrt ueber ihren Pegel direkt in die Gruppe Bagger
      const pegel = (q.ziele as Array<Record<string, unknown>>)[0]!;
      expect(pegel.ziele as unknown[]).toContain(gr.bagger);
    }
  });

  it("die Sterne warten, bis die Sirene ausgeklungen ist", async () => {
    const { mgr } = await starteMitAufnahmen();
    // Attrappe: jede Aufnahme dauert 0,5 s → Sterne ab 0,7 s nach dem Signal, aber nie vor 0,95 s
    const m = mgr as unknown as { feierabendBis: number };
    mgr.playFeierabend();
    expect(m.feierabendBis).toBeCloseTo(ctx.currentTime + 0.5);
    m.feierabendBis = ctx.currentTime + 4.9; // echte Sirenenlaenge
    const vorher = ctx.alleQuellen.length;
    mgr.playSterne(1);
    const stern = ctx.alleQuellen.slice(vorher);
    expect(stern).toHaveLength(1);
    expect(stern[0]!.startAt as number).toBeGreaterThanOrEqual(ctx.currentTime + 4.9);
  });
});
