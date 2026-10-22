/**
 * PAUSE = STILL (Auftrag 43a, Patrick 22.10.2026: „friert alles ein, auch
 * alle Töne"). Der AudioManager hoert nur auf `spiel:pause` (beide Arten) und
 * `spiel:weiter` und dreht die Hauptlautstaerke auf 0 und zurueck.
 *
 * Bewacht wird, was auf dem iPad schiefgehen wuerde:
 *  - beide Arten machen still, weiter macht genau so laut wie vorher,
 *  - Gruppenregler (E-139) und Stummschalter-Sitzung (E-172) bleiben, wie sie waren,
 *  - die drei Weckrufe (Geste, Rueckkehr, Kanal meldet sich) machen in der
 *    Pause NICHT laut — auch ein kompletter Neuaufbau des Kanals nicht,
 *  - eine Pause vor dem ersten Ton baut den Kanal still.
 * Gespielt gegen einen nachgebauten AudioContext wie in test/ton.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioManager } from "../src/audio/audioManager";
import { EventBus } from "../src/core/events";
import { alleProben } from "../src/audio/klangregeln";

interface Param {
  value: number;
  /** zuletzt geplantes Ziel, null = nie geplant */
  ziel: number | null;
  [k: string]: unknown;
}
function param(): Param {
  const p: Param = { value: 0, ziel: null };
  const merk = (v: number): Param => ((p.ziel = v), p);
  for (const m of ["setValueAtTime", "linearRampToValueAtTime", "exponentialRampToValueAtTime", "setTargetAtTime"]) p[m] = merk;
  p.cancelScheduledValues = () => p;
  return p;
}
const knoten = (): Record<string, unknown> => ({
  gain: param(), frequency: param(), Q: param(), detune: param(), playbackRate: param(),
  threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(),
  type: "", buffer: null, loop: false,
  connect: (z: unknown) => z, disconnect: () => {}, start: () => {}, stop: () => {},
});

class FakeCtx {
  state = "suspended";
  currentTime = 0;
  sampleRate = 48000;
  destination = {};
  onstatechange: (() => void) | null = null;
  createGain = knoten;
  createBiquadFilter = knoten;
  createDynamicsCompressor = knoten;
  createBufferSource = knoten;
  createBuffer = (_k: number, n: number): unknown => ({ getChannelData: () => new Float32Array(n) });
  async resume(): Promise<void> {
    this.setze("running");
  }
  async close(): Promise<void> {
    this.setze("closed");
  }
  setze(z: string): void {
    this.state = z;
    this.onstatechange?.();
  }
}

let kanaele: FakeCtx[];
let fristen: Array<() => void>;
let horcher: Map<string, Array<() => void>>;
const feuere = (t: string): void => (horcher.get(t) ?? []).forEach((f) => f());
const laufeFristen = (): void => {
  const f = fristen;
  fristen = [];
  f.forEach((x) => x());
};
const sitzung = { type: "auto" };

beforeEach(() => {
  kanaele = [];
  fristen = [];
  horcher = new Map();
  sitzung.type = "auto";
  const merke = (t: string, f: () => void): void => void horcher.set(t, [...(horcher.get(t) ?? []), f]);
  vi.stubGlobal("window", { addEventListener: merke, setTimeout: (f: () => void) => fristen.push(f), setInterval: () => 1, clearInterval: () => {} });
  vi.stubGlobal("document", { hidden: false, addEventListener: merke });
  vi.stubGlobal("navigator", { audioSession: sitzung });
  vi.stubGlobal("AudioContext", function (): FakeCtx {
    const c = new FakeCtx();
    kanaele.push(c);
    return c;
  });
});
afterEach(() => vi.unstubAllGlobals());

function aufbau(geste = true): { mgr: AudioManager; bus: EventBus } {
  const bus = new EventBus();
  const mgr = new AudioManager(bus);
  const proben = (mgr as unknown as { proben: Map<string, unknown> }).proben;
  for (const n of alleProben()) proben.set(n, { duration: 0.5, length: 24000, numberOfChannels: 1 });
  if (geste) {
    feuere("pointerdown");
    laufeFristen();
  }
  return { mgr, bus };
}
/** Was am Ausgang ankommt: das zuletzt geplante Ziel der Hauptlautstaerke, sonst ihr Startwert. */
function haupt(mgr: AudioManager): number {
  const g = (mgr as unknown as { master: { gain: Param } | null }).master?.gain;
  if (!g) throw new Error("kein Tonkanal");
  return g.ziel ?? g.value;
}

describe("Pause macht still (Auftrag 43a)", () => {
  for (const art of ["still", "menue"] as const) {
    it(`spiel:pause "${art}" → Hauptlautstaerke 0, spiel:weiter → wie vorher`, () => {
      const { mgr, bus } = aufbau();
      const vorher = haupt(mgr);
      expect(vorher).toBeGreaterThan(0);
      bus.emit("spiel:pause", { art });
      expect(haupt(mgr)).toBe(0);
      bus.emit("spiel:weiter", {});
      expect(haupt(mgr)).toBe(vorher);
    });
  }

  it("Gruppenregler, Musikwunsch und Stummschalter-Sitzung bleiben unberuehrt", () => {
    const { mgr, bus } = aufbau();
    mgr.setLautstaerke("musik", 0.3);
    mgr.toggleMusic(); // an
    const gruppen = (mgr as unknown as { gruppen: Record<string, { gain: Param }> }).gruppen;
    const musikZiel = gruppen.musik!.gain.ziel;
    bus.emit("spiel:pause", { art: "still" });
    expect(gruppen.musik!.gain.ziel, "Gruppe in der Pause angefasst").toBe(musikZiel);
    bus.emit("spiel:weiter", {});
    expect(mgr.lautstaerke("musik")).toBe(0.3);
    expect(mgr.musicOn).toBe(true);
    expect(sitzung.type).toBe("ambient");
  });

  it("Weckrufe in der Pause machen nicht laut: Geste, Rueckkehr, Kanal meldet sich", () => {
    const { mgr, bus } = aufbau();
    bus.emit("spiel:pause", { art: "still" });
    const ctx = kanaele[0]!;
    ctx.setze("interrupted"); // Anruf, Kontrollzentrum
    laufeFristen();
    for (const ev of ["visibilitychange", "pageshow", "focus", "pointerdown", "keydown"]) feuere(ev);
    laufeFristen();
    expect(ctx.state).toBe("running");
    expect(haupt(mgr)).toBe(0);
    bus.emit("spiel:weiter", {});
    expect(haupt(mgr)).toBe(0.5);
  });

  it("ein Neuaufbau des Kanals in der Pause bleibt still", () => {
    const { mgr, bus } = aufbau();
    bus.emit("spiel:pause", { art: "menue" });
    kanaele[0]!.setze("closed");
    feuere("pointerdown");
    expect(kanaele.length).toBe(2);
    expect(haupt(mgr)).toBe(0);
    bus.emit("spiel:weiter", {});
    expect(haupt(mgr)).toBe(0.5);
  });

  it("Pause vor dem ersten Ton: der Kanal entsteht still", () => {
    const { mgr, bus } = aufbau(false);
    bus.emit("spiel:pause", { art: "still" });
    feuere("pointerdown");
    expect(haupt(mgr)).toBe(0);
    bus.emit("spiel:weiter", {});
    expect(haupt(mgr)).toBe(0.5);
  });

  it("GEGENPROBE: ohne Pause ist der Ausgang offen", () => {
    const { mgr, bus } = aufbau();
    bus.emit("spiel:weiter", {}); // weiter ohne Pause aendert nichts
    expect(haupt(mgr)).toBe(0.5);
  });
});
