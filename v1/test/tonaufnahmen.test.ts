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
    // SW-Deckel: 2 MB Download, 10 MB Speicher. Wer mehr will, braucht MP3/AAC (ffmpeg).
    expect(bytes).toBeLessThan(2 * 1048576);
    expect(speicherMB).toBeLessThan(10);
  });
});
