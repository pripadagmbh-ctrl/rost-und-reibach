/**
 * Waechter fuer die Aufnahmen im Spiel (E-130, 16.10.2026).
 *
 * Patrick: „Die Geräuschkulisse muss viel viel besser werden, aktuell höre ich
 * beim greifen eher ein summen." Seitdem kommen die Klaenge aus geschnittenen
 * Aufnahmen unter `public/ton/` (Schnitt: `tools/tonwerk/`). Hier steht, was
 * ohne Lautsprecher pruefbar ist: Jede Datei, die das Spiel laedt, ist da und
 * in Safari lesbar; jede Datei hat ihre Herkunft in QUELLEN.md; Groesse und
 * Speicher bleiben im Rahmen.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { alleProben } from "../src/audio/klangregeln";

const ORDNER = resolve(__dirname, "../public/ton");
const dateien = readdirSync(ORDNER).filter((f) => f.endsWith(".wav"));

/** Kopf einer WAV-Datei: Format, Kanaele, Abtastrate, Proben. */
function wavKopf(f: string): { pcm: number; kanaele: number; rate: number; bits: number; proben: number } {
  const b = readFileSync(resolve(ORDNER, f));
  expect(b.toString("ascii", 0, 4), f).toBe("RIFF");
  expect(b.toString("ascii", 8, 12), f).toBe("WAVE");
  return {
    pcm: b.readUInt16LE(20),
    kanaele: b.readUInt16LE(22),
    rate: b.readUInt32LE(24),
    bits: b.readUInt16LE(34),
    proben: b.readUInt32LE(40) / 2,
  };
}

describe("Aufnahmen (E-130)", () => {
  it("jede Aufnahme, die das Spiel laedt, liegt in public/ton — und keine liegt dort umsonst", () => {
    const namen = alleProben();
    for (const n of namen) expect(dateien, n).toContain(`${n}.wav`);
    for (const f of dateien) expect(namen, f).toContain(f.replace(/\.wav$/, ""));
  });

  it("alle sind 16-bit-PCM mono — das dekodiert Safari auf jedem iPhone", () => {
    for (const f of dateien) {
      const k = wavKopf(f);
      expect(k.pcm, f).toBe(1);
      expect(k.kanaele, f).toBe(1);
      expect(k.bits, f).toBe(16);
      expect([12000, 16000, 24000], f).toContain(k.rate);
      expect(k.proben, f).toBeGreaterThan(0);
    }
  });

  it("jede Datei hat ihre Herkunft in QUELLEN.md, und dort steht die Lizenz", () => {
    const q = readFileSync(resolve(ORDNER, "QUELLEN.md"), "utf8");
    for (const f of dateien) expect(q, f).toContain(`| ${f} |`);
    expect(q).toContain("CC0");
    // H (Pixabay) ist nicht CC0: Lizenz und Herkunft muessen dabeistehen (E-130)
    if (q.includes("| H/")) expect(q).toContain("Pixabay Content License");
  });

  /**
   * KLEINE LAUTSPRECHER (vorher in geraeusche.test.ts an gerechneten
   * Teiltoenen geprueft, seit E-153 an den Aufnahmen selbst): Ein
   * iPhone-mini-Lautsprecher gibt unter etwa 300 Hz fast nichts wieder. Jede
   * Datei braucht darum hoerbare Energie darueber. Gemessen mit einem
   * Hochpass 300 Hz (2. Ordnung): Anteil der Energie, der durchkommt.
   * SW-Schranke 1 % (−20 dB). Am knappsten (Stand E-153): Reifen 2 %,
   * Bauschutt 3–5 %, Kabel 9 % — auf dem iPhone leise, aber da.
   */
  it("jede Aufnahme hat hoerbare Anteile ueber 300 Hz (iPhone-Lautsprecher)", () => {
    for (const f of dateien) {
      const b = readFileSync(resolve(ORDNER, f));
      const rate = b.readUInt32LE(24);
      const n = b.readUInt32LE(40) / 2;
      const w = (2 * Math.PI * 300) / rate;
      const al = Math.sin(w) / (2 * Math.SQRT1_2);
      const c = Math.cos(w);
      const [b0, b1, b2, a0, a1, a2] = [(1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + al, -2 * c, 1 - al];
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0, hoch = 0, alle = 0;
      for (let i = 0; i < n; i++) {
        const x = b.readInt16LE(44 + 2 * i) / 32768;
        const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
        x2 = x1; x1 = x; y2 = y1; y1 = y;
        hoch += y * y;
        alle += x * x;
      }
      expect(hoch / alle, f).toBeGreaterThan(0.01);
    }
  });

  it("Groesse und Speicher bleiben im Rahmen (iPhone mini)", () => {
    let bytes = 0;
    let sekunden = 0;
    for (const f of dateien) {
      bytes += statSync(resolve(ORDNER, f)).size;
      const k = wavKopf(f);
      sekunden += k.proben / k.rate;
    }
    // Dekodiert legt WebAudio jede Probe als 32-bit-Zahl in der Rate des
    // Kanals ab — auf iOS 48 kHz. Dazu bleiben die Dateibytes im Speicher
    // (AudioManager.rohbytes), damit ein Neuaufbau des Kanals nicht neu laedt.
    const speicherMB = (sekunden * 48000 * 4 + bytes) / 1048576;
    console.info(
      `[E-130 Messung] ${dateien.length} Aufnahmen, ${sekunden.toFixed(1)} s, ` +
        `${(bytes / 1048576).toFixed(2)} MB Dateien, ${speicherMB.toFixed(1)} MB im Speicher (48 kHz)`
    );
    // SW-Deckel: 2 MB Download, 12 MB Speicher. Wer mehr will, braucht MP3/AAC (ffmpeg).
    // E-148: Speicher 10 → 12 MB fuer Hupe, Sirene, Klingel (8,4 s mehr, rund
    // 1,6 MB dekodiert). Ein iPhone mini hat 4 GB; der Deckel bewacht das
    // Wachstum, nicht eine Geraetegrenze. Der Download bleibt unter 2 MB.
    expect(bytes).toBeLessThan(2 * 1048576);
    expect(speicherMB).toBeLessThan(12);
  });
});
