/**
 * Waechter fuer den Tonkanal.
 *
 * Anlass: Geraetetest 14.09.2026 auf dem iPad. Im Debug-Overlay stand
 * `Ton: interrupted · Musik an (laeuft)` — der Kanal stand still, das Spiel
 * meinte, es spiele. `interrupted` ist ein eigener WebKit-Zustand, den die
 * Typdefinition des Browsers nicht kennt. Diese Tests halten fest:
 *
 *  1. `interrupted` wird genau wie `suspended` behandelt (nie wieder ein
 *     Sonderfall, der durchs Raster faellt),
 *  2. der Ton kommt nach Rueckkehr aus dem Hintergrund zurueck,
 *  3. die Anzeige im Overlay luegt nicht.
 *
 * Gespielt wird gegen einen nachgebauten AudioContext, weil in Vitest weder
 * Browser noch Lautsprecher zur Verfuegung stehen.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { brauchtNeuaufbau, brauchtWeckruf, istHoerbar } from "../src/audio/tonzustand";
import { tonZeile } from "../src/core/debugOverlay";
import { AudioManager } from "../src/audio/audioManager";

// ---------------------------------------------------------------- Attrappen

/** Ein AudioParam, das alles annimmt und nichts tut. */
function param(): Record<string, unknown> {
  const p: Record<string, unknown> = { value: 0 };
  for (const m of [
    "setValueAtTime",
    "linearRampToValueAtTime",
    "exponentialRampToValueAtTime",
    "setTargetAtTime",
    "cancelScheduledValues",
  ]) {
    p[m] = () => p;
  }
  return p;
}

interface Zaehler {
  quellen: number;
  gestoppt: number;
}

/** Ein Tonknoten, der sich verketten laesst. */
function knoten(z: Zaehler, istQuelle: boolean): Record<string, unknown> {
  if (istQuelle) z.quellen++;
  return {
    gain: param(),
    frequency: param(),
    Q: param(),
    detune: param(),
    playbackRate: param(),
    // Begrenzer (E-121)
    threshold: param(),
    knee: param(),
    ratio: param(),
    attack: param(),
    release: param(),
    type: "",
    buffer: null,
    loop: false,
    oversample: "",
    curve: null,
    connect: (ziel: unknown) => ziel,
    disconnect: () => {},
    start: () => {},
    stop: () => {
      if (istQuelle) z.gestoppt++;
    },
  };
}

class FakeCtx {
  state = "suspended";
  currentTime = 0;
  sampleRate = 48000;
  onstatechange: (() => void) | null = null;
  resumeAufrufe = 0;
  /** Steuert, ob ein Weckruf greift — auf iOS greift er ohne Geste eben nicht */
  resumeErfolg = true;
  zaehler: Zaehler = { quellen: 0, gestoppt: 0 };
  destination = {};

  createGain = (): unknown => knoten(this.zaehler, false);
  createBiquadFilter = (): unknown => knoten(this.zaehler, false);
  createWaveShaper = (): unknown => knoten(this.zaehler, false);
  createDynamicsCompressor = (): unknown => knoten(this.zaehler, false);
  createOscillator = (): unknown => knoten(this.zaehler, true);
  createBufferSource = (): unknown => knoten(this.zaehler, true);
  createBuffer = (_k: number, len: number): unknown => ({
    getChannelData: () => new Float32Array(len),
  });

  async resume(): Promise<void> {
    this.resumeAufrufe++;
    if (this.resumeErfolg) this.setzeZustand("running");
  }
  async close(): Promise<void> {
    this.setzeZustand("closed");
  }
  /** Zustandswechsel wie im Browser: setzen UND melden. */
  setzeZustand(z: string): void {
    this.state = z;
    this.onstatechange?.();
  }
}

/** Alle im Testlauf angelegten Kanaele, in der Reihenfolge ihrer Entstehung. */
let kanaele: FakeCtx[] = [];
/** Vorgemerkte Nachsehen-Fristen — im Test von Hand ausgeloest, nie gewartet. */
let fristen: Array<() => void> = [];
/** Ereignisse, auf die AudioManager horcht. */
let horcher: Map<string, Array<() => void>>;

function feuere(name: string): void {
  for (const f of horcher.get(name) ?? []) f();
}

function laufeFristen(): void {
  const jetzt = fristen;
  fristen = [];
  for (const f of jetzt) f();
}

const echtesWindow = (globalThis as Record<string, unknown>).window;
const echtesDocument = (globalThis as Record<string, unknown>).document;
const echterCtx = (globalThis as Record<string, unknown>).AudioContext;

beforeEach(() => {
  kanaele = [];
  fristen = [];
  horcher = new Map();
  const merke = (t: string, f: () => void): void => {
    const liste = horcher.get(t) ?? [];
    liste.push(f);
    horcher.set(t, liste);
  };
  const g = globalThis as Record<string, unknown>;
  g.window = {
    addEventListener: merke,
    // Fristen sammeln statt wirklich warten
    setTimeout: (f: () => void) => fristen.push(f),
    // Der Musik-Taktgeber darf im Test nicht laufen (kein Kontext, keine Uhr)
    setInterval: () => 1,
    clearInterval: () => {},
  };
  g.document = { hidden: false, addEventListener: merke };
  g.AudioContext = function (): FakeCtx {
    const c = new FakeCtx();
    kanaele.push(c);
    return c;
  };
});

afterEach(() => {
  const g = globalThis as Record<string, unknown>;
  g.window = echtesWindow;
  g.document = echtesDocument;
  g.AudioContext = echterCtx;
});

/** Manager anlegen und mit einer ersten Geste in Betrieb nehmen. */
function starteSpiel(): { mgr: AudioManager; ctx: FakeCtx } {
  const mgr = new AudioManager();
  feuere("pointerdown");
  laufeFristen();
  return { mgr, ctx: kanaele[0]! };
}

// ------------------------------------------------------------- Zustandskunde

describe("Tonzustaende", () => {
  it("haelt nur einen laufenden Kanal fuer hoerbar", () => {
    expect(istHoerbar("running")).toBe(true);
    for (const z of ["suspended", "interrupted", "closed", "keiner"]) {
      expect(istHoerbar(z)).toBe(false);
    }
  });

  it("weckt bei interrupted genauso wie bei suspended", () => {
    expect(brauchtWeckruf("interrupted")).toBe(brauchtWeckruf("suspended"));
    expect(brauchtWeckruf("interrupted")).toBe(true);
  });

  it("haelt auch einen kuenftigen unbekannten Zustand fuer weckbar", () => {
    expect(brauchtWeckruf("irgendwas-neues")).toBe(true);
  });

  it("weckt nichts, was es nicht gibt oder was zu ist", () => {
    expect(brauchtWeckruf("running")).toBe(false);
    expect(brauchtWeckruf("closed")).toBe(false);
    expect(brauchtWeckruf("keiner")).toBe(false);
    expect(brauchtNeuaufbau("closed")).toBe(true);
    expect(brauchtNeuaufbau("interrupted")).toBe(false);
  });
});

// ------------------------------------------------------------------ Weckdienst

describe("Tonkanal aufwecken", () => {
  it("behandelt interrupted und suspended gleich — gleiche Weckrufe, gleicher Ausgang", () => {
    const lauf = (zustand: string): { rufe: number; hoerbar: boolean } => {
      const { mgr, ctx } = starteSpiel();
      const vorher = ctx.resumeAufrufe;
      ctx.setzeZustand(zustand);
      laufeFristen();
      return { rufe: ctx.resumeAufrufe - vorher, hoerbar: mgr.diagnostics.hoerbar };
    };
    const a = lauf("suspended");
    const b = lauf("interrupted");
    expect(b).toEqual(a);
    expect(b.rufe).toBeGreaterThan(0);
    expect(b.hoerbar).toBe(true);
  });

  it("holt den Ton zurueck, wenn die Seite aus dem Hintergrund kommt", () => {
    const { mgr, ctx } = starteSpiel();
    // Unterbrechung, und der Weckruf greift nicht (Seite ist ja im Hintergrund)
    ctx.resumeErfolg = false;
    ctx.setzeZustand("interrupted");
    laufeFristen();
    expect(mgr.diagnostics.hoerbar).toBe(false);
    expect(mgr.diagnostics.ctx).toBe("interrupted");

    // Zurueck im Vordergrund: jetzt darf geweckt werden
    ctx.resumeErfolg = true;
    (globalThis as Record<string, unknown>).document = {
      hidden: false,
      addEventListener: () => {},
    };
    feuere("visibilitychange");
    laufeFristen();
    expect(mgr.diagnostics.hoerbar).toBe(true);
    expect(mgr.diagnostics.weckversuche).toBe(0);
  });

  it("holt den Ton auch dann zurueck, wenn nur noch getippt wird", () => {
    const { mgr, ctx } = starteSpiel();
    ctx.resumeErfolg = false;
    ctx.setzeZustand("interrupted");
    laufeFristen();
    ctx.resumeErfolg = true;
    feuere("pointerdown");
    laufeFristen();
    expect(mgr.diagnostics.hoerbar).toBe(true);
  });

  it("weckt von selbst, wenn der Kanal mitten im Spiel ausfaellt", () => {
    const { mgr, ctx } = starteSpiel();
    const vorher = ctx.resumeAufrufe;
    // Anruf oder Kontrollzentrum: kein visibilitychange, keine Geste
    ctx.setzeZustand("interrupted");
    expect(ctx.resumeAufrufe).toBeGreaterThan(vorher);
    expect(mgr.diagnostics.hoerbar).toBe(true);
  });

  it("ersetzt die Dauertoene nach einer Unterbrechung", () => {
    const { ctx } = starteSpiel();
    const vorher = ctx.zaehler.quellen;
    ctx.resumeErfolg = false;
    ctx.setzeZustand("interrupted");
    ctx.resumeErfolg = true;
    ctx.setzeZustand("running");
    expect(ctx.zaehler.quellen).toBeGreaterThan(vorher);
    expect(ctx.zaehler.gestoppt).toBeGreaterThan(0);
  });

  it("baut den Kanal neu, wenn drei Weckrufe vergeblich waren", () => {
    const { ctx } = starteSpiel();
    ctx.resumeErfolg = false;
    ctx.setzeZustand("interrupted");
    laufeFristen();
    expect(kanaele.length).toBe(1);
    // drei vergebliche Weckrufe, dann greift die letzte Rettung
    for (let i = 0; i < 3; i++) {
      feuere("pointerdown");
      laufeFristen();
    }
    expect(kanaele.length).toBe(2);
    expect(kanaele[1]!.state).not.toBe("interrupted");
  });
});

// --------------------------------------------------------------- Ehrlichkeit

describe("Overlay-Anzeige", () => {
  it("meldet keine laufende Musik, solange der Kanal unterbrochen ist", () => {
    const { mgr, ctx } = starteSpiel();
    mgr.toggleMusic(); // E-139: Radio startet aus — hier eingeschaltet, um den Wunsch zu pruefen
    ctx.resumeErfolg = false;
    ctx.setzeZustand("interrupted");
    laufeFristen();
    const d = mgr.diagnostics;
    expect(d.musicWanted).toBe(true); // der Wunsch bleibt
    expect(d.musicRunning).toBe(false); // gehoert wird trotzdem nichts
    const zeile = tonZeile(d);
    expect(zeile).toContain("interrupted");
    expect(zeile).toContain("stumm");
    expect(zeile).not.toContain("laeuft"); // genau das stand am 14.09. da
  });

  it("meldet laufende Musik, wenn sie laeuft", () => {
    const zeile = tonZeile({
      ctx: "running",
      musicWanted: true,
      musicRunning: true,
      hoerbar: true,
      weckversuche: 0,
    });
    expect(zeile).toContain("hoerbar");
    expect(zeile).toContain("laeuft");
    expect(zeile).not.toContain("Weckruf");
  });

  it("zeigt vergebliche Weckrufe an", () => {
    const zeile = tonZeile({
      ctx: "interrupted",
      musicWanted: false,
      musicRunning: false,
      hoerbar: false,
      weckversuche: 2,
    });
    expect(zeile).toContain("2 Weckrufe");
    expect(zeile).toContain("Musik aus");
  });
});
