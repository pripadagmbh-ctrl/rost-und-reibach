/**
 * WAS AUF DEM AUFGABEN-PLATZ IM WEG STEHT (G3, 20.10.2026) — reine Geometrie
 * fuer die Aufbau-Waechter der Aufgaben 2–6.
 *
 * Gelesen wird nur aus den benannten Quellen, keine Zahl abgeschrieben:
 * Behaelter (`CONFIGS`, Weltmasse ueber `bayHalb`), alle festen Bauwerke samt
 * Muldenwaenden, Presse, Buchtmauern und schraeger Mauer (E-182) ueber
 * `hitsObstacle`, die Presskammer (`PRESS_CENTER`/`PRESS_KAMMER`), der
 * Besenplatz (`BESEN_PLATZ`, im Sandkasten belegt), die Abkippstelle
 * (`ABKIPP_ZONE`) und — wahlweise — die Fahrspuren (`naechsteSpur`). In
 * Aufgaben faehrt kein Laster (`vehicles.acceptDeliveries = false` in
 * main.ts), darum sind Spuren und Abkippstelle eine Frage, keine Pflicht.
 */
import { CONFIGS, MUELL_START, bayHalb } from "../src/world/containers";
import { SCHWENK_AUSSEN, SCHWENK_INNEN, abstandVomStand } from "../src/world/baggerstand";
import { hitsObstacle } from "../src/world/obstacles";
import { PRESS_CENTER, PRESS_KAMMER } from "../src/world/press";
import { BESEN_PLATZ } from "../src/world/startplatz";
import { BESEN } from "../src/world/scrapItems";
import { naechsteSpur, SPUR_HALB } from "../src/world/fahrspuren";
import { ABKIPP_ZONE } from "../src/delivery/routes";
import { YARD_MAX_X, YARD_MIN_X } from "../src/world/yard";

/** Halbmesser des Besens im Grundriss (wie `test/aufgabe1.test.ts`) */
export const BESEN_R = Math.hypot(BESEN.dims[0]! / 2, BESEN.dims[2]! / 2);

export interface Platzfrage {
  /** Sicherheitsrand um alles (m) */
  rand: number;
  /** den Besenplatz nicht zaehlen — in Aufgaben liegt kein Besen (er kommt nur mit `spawnPile` im Sandkasten) */
  ohneBesen?: boolean;
  /** auch die Fahrspuren und die Abkippstelle freihalten */
  betrieb?: boolean;
  /** diese Behaelter nicht als belegt zaehlen (z. B. das Ziel selbst) */
  ausser?: readonly string[];
}

/** Was liegt an (x, z)? Leer = frei. */
export function belegt(x: number, z: number, f: Platzfrage): string {
  const r = f.rand;
  if (x < YARD_MIN_X + 0.5 + r || x > YARD_MAX_X - 0.5 - r) return "Platzmauer";
  for (const c of CONFIGS) {
    if (f.ausser?.includes(c.id)) continue;
    const { hw, hd } = bayHalb(c);
    if (Math.abs(x - c.x) < hw + r && Math.abs(z - c.z) < hd + r) return c.label;
  }
  const o = hitsObstacle(x, z, r);
  if (o && !(f.ausser?.length && CONFIGS.some((c) => f.ausser!.includes(c.id) && o.label.startsWith(c.label)))) return o.label;
  if (Math.abs(x - PRESS_CENTER.x) < PRESS_KAMMER.hw + r && Math.abs(z - PRESS_CENTER.z) < PRESS_KAMMER.hd + r) return "Presskammer";
  if (!f.ohneBesen && Math.hypot(x - BESEN_PLATZ.x, z - BESEN_PLATZ.z) < BESEN_R + r) return "Besenplatz";
  if (f.betrieb) {
    if (Math.hypot(x - ABKIPP_ZONE[0], z - ABKIPP_ZONE[1]) < 3.0 + r) return "Abkippstelle";
    const s = naechsteSpur(x, z);
    if (s.abstand < SPUR_HALB + r) return `Spur ${s.name}`;
  }
  return "";
}

/**
 * Grundriss eines Rechtecks (Mitte, Gier wie `spawnCar`: lokales +z = Laenge
 * dreht mit der Gier) im 25-cm-Raster abtasten. Leer = frei.
 */
export function grundrissBelegt(mx: number, mz: number, gier: number, halbB: number, halbL: number, f: Platzfrage): string {
  const nb = Math.max(2, Math.ceil((2 * halbB) / 0.25));
  const nl = Math.max(2, Math.ceil((2 * halbL) / 0.25));
  const c = Math.cos(gier);
  const s = Math.sin(gier);
  for (let i = 0; i <= nb; i++) {
    const a = -halbB + (2 * halbB * i) / nb;
    for (let j = 0; j <= nl; j++) {
      const l = -halbL + (2 * halbL * j) / nl;
      // Drehung um +y (three.js): x' = x cos + z sin, z' = −x sin + z cos
      const w = belegt(mx + a * c + l * s, mz - a * s + l * c, f);
      if (w) return w;
    }
  }
  return "";
}

/** Ecken des Rechtecks (fuer Abstaende zur Drehmitte). */
export function ecken(mx: number, mz: number, gier: number, halbB: number, halbL: number): Array<{ x: number; z: number }> {
  const c = Math.cos(gier);
  const s = Math.sin(gier);
  return [-1, 1].flatMap((sa) =>
    [-1, 1].map((sl) => ({ x: mx + sa * halbB * c + sl * halbL * s, z: mz - sa * halbB * s + sl * halbL * c }))
  );
}

/**
 * Die Abwurfstelle eines Behaelters: im Schwenkband, mit `luft` Abstand zu
 * den Zonenraendern und zu jedem Bauwerk, moeglichst nah an 8,1 m
 * (Ausladung der Startpose). null = ohne Fahren nicht erreichbar.
 */
export function abwurf(id: string, luft: number): { x: number; z: number; r: number } | null {
  const c = CONFIGS.find((x) => x.id === id)!;
  const ort = id === "r_rubble" ? MUELL_START : c;
  const [w, d] = c.size;
  let best: { x: number; z: number; r: number } | null = null;
  for (let x = ort.x - w / 2 + luft; x <= ort.x + w / 2 - luft + 1e-6; x += 0.1)
    for (let z = ort.z - d / 2 + luft; z <= ort.z + d / 2 - luft + 1e-6; z += 0.1) {
      const r = abstandVomStand(x, z);
      if (r < SCHWENK_INNEN || r > SCHWENK_AUSSEN || hitsObstacle(x, z, luft)) continue;
      if (!best || Math.abs(r - 8.1) < Math.abs(best.r - 8.1)) best = { x, z, r };
    }
  return best;
}
