/**
 * Waechter fuer die Aufnahmen im Spiel (E-130, 16.10.2026; E-159, 18.10.2026).
 *
 * Patrick: „Die Geräuschkulisse muss viel viel besser werden, aktuell höre ich
 * beim greifen eher ein summen." Seitdem kommen die Klaenge aus geschnittenen
 * Aufnahmen unter `public/ton/` (Schnitt: `tools/tonwerk/`). Seit E-159 sind
 * die Einzelklaenge AAC in M4A (fuenfmal kleiner), die Schleifen bleiben WAV.
 * Hier steht, was ohne Lautsprecher pruefbar ist: Jede Datei, die das Spiel
 * laedt, ist da und lesbar; jede Datei hat ihre Herkunft in QUELLEN.md; Groesse
 * und Speicher bleiben im Rahmen; ueber 300 Hz ist genug fuer das iPhone.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { alleProben, dateiVon } from "../src/audio/klangregeln";

const ORDNER = resolve(__dirname, "../public/ton");
const dateien = readdirSync(ORDNER).filter((f) => /\.(wav|m4a)$/.test(f));

/**
 * ffmpeg aus `tools/tonwerk/werkzeug/` (E-159, `npm run ton:werkzeug`). Fehlt
 * es (frischer Klon), werden die Pruefungen, die dekodieren muessen,
 * uebersprungen — mit Hinweis. Alles andere laeuft ohne.
 */
const FFMPEG = ((): string | null => {
  try {
    const p = createRequire(resolve(__dirname, "../tools/tonwerk/werkzeug/package.json"))("ffmpeg-static") as string;
    return existsSync(p) ? p : null;
  } catch {
    return null;
  }
})();
if (!FFMPEG) console.warn("[tonaufnahmen] ffmpeg fehlt — Dekodier-Pruefungen uebersprungen (npm run ton:werkzeug)");

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

/** Kopf einer M4A-Datei: Codec AAC (mp4a), Kanaele, Abtastrate, Dauer aus mvhd. */
function m4aKopf(f: string): { aac: boolean; kanaele: number; rate: number; sekunden: number } {
  const b = readFileSync(resolve(ORDNER, f));
  expect(b.toString("ascii", 4, 8), f).toBe("ftyp");
  const a = b.indexOf("mp4a");
  const m = b.indexOf("mvhd");
  expect(a, `${f}: kein AAC`).toBeGreaterThan(0);
  expect(m, `${f}: kein mvhd`).toBeGreaterThan(0);
  const v1 = b[m + 4] === 1;
  const timescale = v1 ? b.readUInt32BE(m + 24) : b.readUInt32BE(m + 16);
  const dauer = v1 ? Number(b.readBigUInt64BE(m + 28)) : b.readUInt32BE(m + 20);
  return { aac: a > 0, kanaele: b.readUInt16BE(a + 20), rate: b.readUInt16BE(a + 28), sekunden: dauer / timescale };
}

const sekundenVon = (f: string): number => {
  if (f.endsWith(".wav")) {
    const k = wavKopf(f);
    return k.proben / k.rate;
  }
  return m4aKopf(f).sekunden;
};

/** Dekodiert mit ffmpeg zu 16-bit mono PCM (Abtastrate `rate`). */
function pcm(f: string, rate: number): Int16Array {
  const r = spawnSync(FFMPEG!, ["-v", "error", "-i", resolve(ORDNER, f), "-f", "s16le", "-ac", "1", "-ar", String(rate), "-"], {
    maxBuffer: 64 * 1024 * 1024,
  });
  expect(r.status, `${f}: ${r.stderr}`).toBe(0);
  const b = r.stdout as Buffer;
  return new Int16Array(b.buffer, b.byteOffset, b.length >> 1);
}

describe("Aufnahmen (E-130, E-159)", () => {
  it("jede Aufnahme, die das Spiel laedt, liegt in public/ton — und keine liegt dort umsonst", () => {
    const namen = alleProben();
    const erwartet = namen.map(dateiVon);
    for (const f of erwartet) expect(dateien, f).toContain(f);
    for (const f of dateien) expect(erwartet, f).toContain(f);
  });

  it("Schleifen sind 16-bit-PCM mono WAV, Einzelklaenge AAC mono in M4A — beides dekodiert Safari", () => {
    for (const f of dateien) {
      if (f.endsWith(".wav")) {
        const k = wavKopf(f);
        expect(k.pcm, f).toBe(1);
        expect(k.kanaele, f).toBe(1);
        expect(k.bits, f).toBe(16);
        expect([12000, 16000, 24000], f).toContain(k.rate);
        expect(k.proben, f).toBeGreaterThan(0);
      } else {
        const k = m4aKopf(f);
        expect(k.aac, f).toBe(true);
        expect(k.kanaele, f).toBe(1);
        expect([12000, 16000, 24000], f).toContain(k.rate);
        expect(k.sekunden, f).toBeGreaterThan(0.05);
      }
    }
  });

  it.skipIf(!FFMPEG)("jede M4A dekodiert vollstaendig und ist nicht still", () => {
    for (const f of dateien.filter((d) => d.endsWith(".m4a"))) {
      const d = pcm(f, 24000);
      expect(d.length / 24000, f).toBeGreaterThan(m4aKopf(f).sekunden * 0.9);
      let spitze = 0;
      for (const x of d) spitze = Math.max(spitze, Math.abs(x));
      expect(spitze / 32768, f).toBeGreaterThan(0.5); // geschnitten auf −1 dBFS
    }
  });

  it("jede Datei hat ihre Herkunft in QUELLEN.md, und dort steht die Lizenz", () => {
    const q = readFileSync(resolve(ORDNER, "QUELLEN.md"), "utf8");
    for (const f of dateien) expect(q, f).toContain(`| ${f} |`);
    expect(q).toContain("CC0");
    // H (Pixabay) ist nicht CC0: Lizenz und Herkunft muessen dabeistehen (E-130)
    if (q.includes("| H/")) expect(q).toContain("Pixabay Content License");
    // Keine Dose mehr (E-159: „wie eine Coladose") — nur Glas kommt noch aus F
    expect(q).not.toMatch(/F\/0118/);
  });

  /**
   * KLEINE LAUTSPRECHER (seit E-153 an den Aufnahmen selbst gemessen): Ein
   * iPhone-mini-Lautsprecher gibt unter etwa 300 Hz fast nichts wieder. Jede
   * Datei braucht darum hoerbare Energie darueber. Gemessen mit einem
   * Hochpass 300 Hz (2. Ordnung): Anteil der Energie, der durchkommt.
   * SW-Schranke 1 % (−20 dB). Am knappsten: Reifen, Bauschutt, Kabel — auf dem
   * iPhone leise, aber da.
   */
  it.skipIf(!FFMPEG)("jede Aufnahme hat hoerbare Anteile ueber 300 Hz (iPhone-Lautsprecher)", () => {
    const rate = 24000;
    for (const f of dateien) {
      const d = pcm(f, rate);
      const w = (2 * Math.PI * 300) / rate;
      const al = Math.sin(w) / (2 * Math.SQRT1_2);
      const c = Math.cos(w);
      const [b0, b1, b2, a0, a1, a2] = [(1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + al, -2 * c, 1 - al];
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0, hoch = 0, alle = 0;
      for (let i = 0; i < d.length; i++) {
        const x = d[i]! / 32768;
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
      sekunden += sekundenVon(f);
    }
    // Dekodiert legt WebAudio jede Probe als 32-bit-Zahl in der Rate des
    // Kanals ab — auf iOS 48 kHz. Dazu bleiben die Dateibytes im Speicher
    // (AudioManager.rohbytes), damit ein Neuaufbau des Kanals nicht neu laedt.
    const speicherMB = (sekunden * 48000 * 4 + bytes) / 1048576;
    console.info(
      `[E-159 Messung] ${dateien.length} Aufnahmen, ${sekunden.toFixed(1)} s, ` +
        `${(bytes / 1048576).toFixed(2)} MB Dateien, ${speicherMB.toFixed(1)} MB im Speicher (48 kHz)`
    );
    /*
     * DOWNLOAD 2 MB (unveraendert seit E-130): Auf dem iPhone mini im
     * Mobilnetz (gerechnet 5 Mbit/s) sind das gut 3 s — sie laufen parallel zum
     * Startbild. Seit AAC (E-159) liegt die Tonbank bei rund 1 MB, der Rest ist
     * Luft fuer weitere echte Aufnahmen.
     * SPEICHER 14 MB (E-159, vorher 12): Mehr echte Aufnahmen heissen mehr
     * Sekunden, und jede Sekunde kostet dekodiert 188 kB — unabhaengig vom
     * Dateiformat. Ein iPhone mini hat 4 GB; der Deckel bewacht das Wachstum,
     * keine Geraetegrenze.
     */
    expect(bytes).toBeLessThan(2 * 1048576);
    expect(speicherMB).toBeLessThan(14);
  });
});
