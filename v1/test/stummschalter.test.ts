/**
 * Stummschalter (E-172): Audio-Sitzung „ambient" — lautlos heißt still,
 * fremde Musik läuft weiter. Web-Teil und App-Teil.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { folgeStummschalter } from "../src/audio/stummschalter";

const wurzel = resolve(__dirname, "..");

describe("Web: navigator.audioSession.type", () => {
  it("setzt ambient, wo es die Sitzung gibt (Safari 16.4+)", () => {
    const nav = { audioSession: { type: "auto" } };
    expect(folgeStummschalter(nav)).toBe(true);
    expect(nav.audioSession.type).toBe("ambient");
  });
  it("ohne Sitzung (älteres Safari, andere Browser) passiert nichts", () => {
    expect(folgeStummschalter({})).toBe(false);
    expect(folgeStummschalter(undefined)).toBe(false);
  });
  it("verweigert der Browser den Wert, bricht nichts", () => {
    const nav = {
      audioSession: {
        get type(): string {
          return "auto";
        },
        set type(_: string) {
          throw new Error("nein");
        },
      },
    };
    expect(folgeStummschalter(nav)).toBe(false);
  });
  it("AudioManager setzt die Sitzung, BEVOR er den Tonkanal baut", () => {
    const quelle = readFileSync(resolve(wurzel, "src/audio/audioManager.ts"), "utf8");
    const a = quelle.indexOf("folgeStummschalter()");
    const b = quelle.indexOf("new AudioContext()");
    expect(a, "folgeStummschalter() wird nie gerufen").toBeGreaterThan(0);
    expect(a, "erst nach dem Tonkanal").toBeLessThan(b);
  });
});

describe("App: AVAudioSession", () => {
  it("AppDelegate setzt die Kategorie .ambient beim Start", () => {
    const swift = readFileSync(resolve(wurzel, "ios/App/App/AppDelegate.swift"), "utf8");
    expect(swift).toContain("import AVFoundation");
    expect(swift).toMatch(/AVAudioSession\.sharedInstance\(\)\.setCategory\(\.ambient/);
    const start = swift.indexOf("didFinishLaunchingWithOptions");
    expect(swift.indexOf("setCategory(.ambient")).toBeGreaterThan(start);
  });
});
