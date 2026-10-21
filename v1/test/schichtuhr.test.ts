/**
 * DIE SCHICHT-UHR (E-203, 21.10.2026).
 *
 * Eine Schicht läuft 06:00 bis 16:00 in 600 s (Patrick: „≈ 10 min"),
 * Torschluss 15:00 nach 540 s. Es bleibt EINE Uhr (E-113): `Daylight` mit
 * umschaltbarer Tageslänge. Der Sandkasten rechnet bitgleich wie vorher.
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  Daylight,
  DAY_LENGTH_S,
  START_TIME,
  SCHICHT_TAG_S,
  SCHICHT_START,
  SCHICHT_TORSCHLUSS,
  SCHICHT_FEIERABEND,
} from "../src/world/daylight";

function tagesuhr(): Daylight {
  const szene = new THREE.Scene();
  szene.background = new THREE.Color(0x000000);
  return new Daylight(szene, new THREE.HemisphereLight(), new THREE.DirectionalLight());
}

const DT = 1 / 60;

describe("Schicht-Uhr: 06:00 bis 16:00 in 600 s", () => {
  it("Konstanten: 06:00, 15:00, 16:00 als Tageszeit, 60 s je Spielstunde", () => {
    expect(SCHICHT_START).toBe(0.25);
    expect(SCHICHT_TORSCHLUSS * 24).toBeCloseTo(15, 10);
    expect(SCHICHT_FEIERABEND * 24).toBeCloseTo(16, 10);
    expect(SCHICHT_TAG_S / 24).toBe(60);
    expect((SCHICHT_FEIERABEND - SCHICHT_START) * SCHICHT_TAG_S).toBeCloseTo(600, 6);
    expect((SCHICHT_TORSCHLUSS - SCHICHT_START) * SCHICHT_TAG_S).toBeCloseTo(540, 6);
  });

  it("läuft im Spieltakt (60 Bilder/s) Torschluss bei 540 s ± 1 s und Feierabend bei 600 s ± 1 s", () => {
    const d = tagesuhr();
    d.schichtTag();
    expect(d.clock).toBe("06:00");
    expect(d.istSchicht).toBe(true);
    let s = 0;
    let torschluss: number | null = null;
    let feierabend: number | null = null;
    let uhrBeiFeierabend = "";
    let lichtBeiFeierabend = 0;
    while (s < 700 && feierabend === null) {
      d.update(DT);
      s += DT;
      if (torschluss === null && d.time >= SCHICHT_TORSCHLUSS) torschluss = s;
      if (feierabend === null && d.time >= SCHICHT_FEIERABEND) {
        feierabend = s;
        uhrBeiFeierabend = d.clock;
        lichtBeiFeierabend = d.daylight;
      }
    }
    expect(torschluss, "Torschluss kam nie").not.toBeNull();
    expect(feierabend, "Feierabend kam nie").not.toBeNull();
    expect(Math.abs(torschluss! - 540)).toBeLessThanOrEqual(1);
    expect(Math.abs(feierabend! - 600)).toBeLessThanOrEqual(1);
    expect(uhrBeiFeierabend).toBe("16:00");
    // Die Sonne steht noch: kein Flutlicht in der Schicht (Floodlights ab daylight < 0,45)
    expect(lichtBeiFeierabend).toBeGreaterThan(0.45);
    expect(d.schichtSekunden).toBeCloseTo(feierabend!, 6);
  });
});

describe("Sandkasten-Uhr unverändert (Gegenprobe)", () => {
  it("ohne schichtTag(): 900 s je Tag, Start 0,28 — bitgleich zur alten Rechnung", () => {
    const d = tagesuhr();
    expect(d.tageslaengeS).toBe(DAY_LENGTH_S);
    expect(DAY_LENGTH_S).toBe(900);
    expect(d.time).toBe(START_TIME);
    expect(d.istSchicht).toBe(false);
    let alt = START_TIME;
    let tage = 0;
    // 1000 s: über Mitternacht hinweg (Start 0,28 → nach 648 s ist Mitternacht)
    for (let i = 0; i < 60_000; i++) {
      const vorher = alt;
      alt = (alt + DT / 900) % 1;
      if (alt < vorher) tage++;
      d.update(DT);
      if (d.time !== alt) throw new Error(`Schritt ${i}: ${d.time} statt ${alt}`);
    }
    expect(d.time).toBe(alt);
    expect(d.tag).toBe(tage);
    expect(tage).toBe(1);
  });

  it("Gegenprobe: mit Schicht-Tag läuft die Uhr anders (der Wächter oben sieht den Unterschied)", () => {
    const sand = tagesuhr();
    const schicht = tagesuhr();
    schicht.schichtTag();
    schicht.time = sand.time;
    sand.update(1);
    schicht.update(1);
    expect(schicht.time).not.toBe(sand.time);
  });
});
