/**
 * Farbabstand messen — sRGB → CIELAB → CIEDE2000.
 *
 * Warum nicht im RGB-Raum: Der Abstand zweier Hexwerte sagt nichts darueber,
 * ob ein Mensch sie unterscheiden kann. 0x6e5a4e und 0x5f5a52 liegen in RGB
 * 15 Einheiten auseinander — in Gruen und Blau aber nur 0 und 4, und genau
 * dort ist das Auge am empfindlichsten. Wer in RGB misst, misst das falsche.
 *
 * ΔE2000 ist die Zahl, auf die sich die Farbmetrik geeinigt hat (CIE 142:2001):
 *
 *   ΔE < 1     mit blossem Auge nicht zu unterscheiden
 *   ΔE 1 … 2   nur im direkten Vergleich, Kante an Kante
 *   ΔE 2 … 10  erkennbarer Unterschied
 *   ΔE > 10    verschiedene Farben
 *
 * Die Schwellen stammen aus der Drucktechnik (ISO 12647 arbeitet mit ΔE 5 als
 * Toleranz fuer Sonderfarben). Sie sind hier als Massstab benutzt, nicht als
 * Gesetz: Ein Schrottteil liegt nicht Kante an Kante neben einem anderen,
 * sondern zehn Meter weiter im Halbschatten. Was unter 2 liegt, ist im Spiel
 * also erst recht nicht zu trennen.
 *
 * Die Umrechnung ist gegen die Pruefdaten von Sharma, Wu und Dalal (2005)
 * geprueft — siehe `pruefeDeltaE()`. Ein Messwerkzeug, das sich nicht selbst
 * prueft, hat auf diesem Projekt schon einmal falsch gemessen (14.09.2026).
 */

export interface Lab {
  L: number;
  a: number;
  b: number;
}

/** sRGB-Byte (0..255) → linearer Anteil (0..1). IEC 61966-2-1. */
export function srgbZuLinear(v255: number): number {
  const v = v255 / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** Linearer Anteil (0..1) → sRGB-Byte (0..255). */
export function linearZuSrgb(v: number): number {
  const c = Math.min(Math.max(v, 0), 1);
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  return s * 255;
}

/** Hexwert aufteilen, wie ihn der Quelltext schreibt (0xrrggbb). */
export function hexZuRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

export function rgbZuHex(r: number, g: number, b: number): number {
  const k = (v: number): number => Math.min(255, Math.max(0, Math.round(v)));
  return (k(r) << 16) | (k(g) << 8) | k(b);
}

/** sRGB (0..255) → CIELAB, Bezugsweiss D65. */
export function rgbZuLab(r: number, g: number, b: number): Lab {
  const R = srgbZuLinear(r);
  const G = srgbZuLinear(g);
  const B = srgbZuLinear(b);
  // sRGB-Matrix nach D65 (IEC 61966-2-1)
  const X = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
  const Y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const Z = R * 0.0193339 + G * 0.119192 + B * 0.9503041;
  // Normweiss D65 bei 2°
  const xn = 0.95047;
  const yn = 1.0;
  const zn = 1.08883;
  const f = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  const fx = f(X / xn);
  const fy = f(Y / yn);
  const fz = f(Z / zn);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function hexZuLab(hex: number): Lab {
  const [r, g, b] = hexZuRgb(hex);
  return rgbZuLab(r, g, b);
}

const grad = (x: number): number => (x * 180) / Math.PI;
const bogen = (x: number): number => (x * Math.PI) / 180;

/**
 * ΔE2000 nach CIE 142:2001, in der Fassung von Sharma/Wu/Dalal (2005).
 * kL = kC = kH = 1 (Bezugsbedingungen).
 */
export function deltaE2000(p: Lab, q: Lab): number {
  const C1 = Math.hypot(p.a, p.b);
  const C2 = Math.hypot(q.a, q.b);
  const Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1 = (1 + G) * p.a;
  const a2 = (1 + G) * q.a;
  const Cs1 = Math.hypot(a1, p.b);
  const Cs2 = Math.hypot(a2, q.b);
  const h1 = Cs1 === 0 ? 0 : (grad(Math.atan2(p.b, a1)) + 360) % 360;
  const h2 = Cs2 === 0 ? 0 : (grad(Math.atan2(q.b, a2)) + 360) % 360;

  const dL = q.L - p.L;
  const dC = Cs2 - Cs1;

  let dh: number;
  if (Cs1 * Cs2 === 0) dh = 0;
  else if (Math.abs(h2 - h1) <= 180) dh = h2 - h1;
  else if (h2 - h1 > 180) dh = h2 - h1 - 360;
  else dh = h2 - h1 + 360;
  const dH = 2 * Math.sqrt(Cs1 * Cs2) * Math.sin(bogen(dh) / 2);

  const Lm = (p.L + q.L) / 2;
  const Csm = (Cs1 + Cs2) / 2;
  let hm: number;
  if (Cs1 * Cs2 === 0) hm = h1 + h2;
  else if (Math.abs(h1 - h2) <= 180) hm = (h1 + h2) / 2;
  else if (h1 + h2 < 360) hm = (h1 + h2 + 360) / 2;
  else hm = (h1 + h2 - 360) / 2;

  const T =
    1 -
    0.17 * Math.cos(bogen(hm - 30)) +
    0.24 * Math.cos(bogen(2 * hm)) +
    0.32 * Math.cos(bogen(3 * hm + 6)) -
    0.2 * Math.cos(bogen(4 * hm - 63));
  const dTheta = 30 * Math.exp(-(((hm - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(Csm ** 7 / (Csm ** 7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2);
  const SC = 1 + 0.045 * Csm;
  const SH = 1 + 0.015 * Csm * T;
  const RT = -Math.sin(bogen(2 * dTheta)) * RC;

  return Math.sqrt(
    (dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH)
  );
}

/** Bequem: Abstand zweier Hexwerte aus dem Quelltext. */
export function deltaEHex(a: number, b: number): number {
  return deltaE2000(hexZuLab(a), hexZuLab(b));
}

/**
 * Selbstpruefung gegen die veroeffentlichten Pruefpaare von Sharma, Wu und
 * Dalal (2005), „The CIEDE2000 Color-Difference Formula: Implementation Notes,
 * Supplementary Test Data, and Mathematical Observations", Color Res. Appl. 30.
 *
 * Gibt die groesste Abweichung zurueck. Alles ueber 0,0001 heisst: Die
 * Umrechnung ist falsch, und jede Zahl, die damit gemessen wurde, ist wertlos.
 */
export function pruefeDeltaE(): { maxFehler: number; faelle: number } {
  const paare: Array<[Lab, Lab, number]> = [
    [{ L: 50, a: 2.6772, b: -79.7751 }, { L: 50, a: 0, b: -82.7485 }, 2.0425],
    [{ L: 50, a: 3.1571, b: -77.2803 }, { L: 50, a: 0, b: -82.7485 }, 2.8615],
    [{ L: 50, a: 2.8361, b: -74.02 }, { L: 50, a: 0, b: -82.7485 }, 3.4412],
    [{ L: 50, a: -1.3802, b: -84.2814 }, { L: 50, a: 0, b: -82.7485 }, 1.0],
    [{ L: 50, a: -0.9009, b: -85.5211 }, { L: 50, a: 0, b: -82.7485 }, 1.0],
    [{ L: 50, a: 0, b: 0 }, { L: 50, a: -1, b: 2 }, 2.3669],
    [{ L: 50, a: 2.49, b: -0.001 }, { L: 50, a: -2.49, b: 0.0009 }, 7.1792],
    [{ L: 50, a: 2.5, b: 0 }, { L: 50, a: 0, b: -2.5 }, 4.3065],
    [{ L: 60.2574, a: -34.0099, b: 36.2677 }, { L: 60.4626, a: -34.1751, b: 39.4387 }, 1.2644],
    [{ L: 63.0109, a: -31.0961, b: -5.8663 }, { L: 62.8187, a: -29.7946, b: -4.0864 }, 1.263],
    [{ L: 61.2901, a: 3.7196, b: -5.3901 }, { L: 61.4292, a: 2.248, b: -4.962 }, 1.8731],
    [{ L: 35.0831, a: -44.1164, b: 3.7933 }, { L: 35.0232, a: -40.0716, b: 1.5901 }, 1.8645],
    [{ L: 22.7233, a: 20.0904, b: -46.694 }, { L: 23.0331, a: 14.973, b: -42.5619 }, 2.0373],
    [{ L: 36.4612, a: 47.858, b: 18.3852 }, { L: 36.2715, a: 50.5065, b: 21.2231 }, 1.4146],
    [{ L: 90.8027, a: -2.0831, b: 1.441 }, { L: 91.1528, a: -1.6435, b: 0.0447 }, 1.4441],
    [{ L: 2.0776, a: 0.0795, b: -1.135 }, { L: 0.9033, a: -0.0636, b: -0.5514 }, 0.9082],
  ];
  let maxFehler = 0;
  for (const [p, q, soll] of paare) {
    const ist = deltaE2000(p, q);
    maxFehler = Math.max(maxFehler, Math.abs(ist - soll));
  }
  return { maxFehler, faelle: paare.length };
}

/**
 * Wie eine Farbe unter einer Beleuchtung aussieht.
 *
 * Der Renderer laeuft ohne Tonwertabbildung (`main.ts` setzt weder
 * `toneMapping` noch `outputColorSpace`, three r169 nimmt dann NoToneMapping
 * und sRGB-Ausgabe). Diffuses Licht ist damit schlicht Grundfarbe mal
 * Lichtfarbe mal Staerke — im LINEAREN Raum, nicht im Hexwert. Genau das
 * rechnet diese Funktion.
 *
 * Was sie NICHT kann: Glanz, Metallanteil, Schatten, Verdeckung. Ein
 * `MeshStandardMaterial` mit `metalness: 0.4` gibt 40 % seiner diffusen
 * Rueckstrahlung an die Spiegelung ab; die haengt am Blickwinkel und ist
 * darum nicht als eine Zahl anzugeben. Die Werte hier sind deshalb die
 * OBERGRENZE des Unterschieds — im Spiel ist er kleiner, nie groesser.
 */
export function unterLicht(hex: number, licht: number, staerke: number): number {
  const [lr, lg, lb] = hexZuRgb(licht).map(srgbZuLinear);
  const [r, g, b] = hexZuRgb(hex).map(srgbZuLinear);
  return rgbZuHex(
    linearZuSrgb(r * lr * staerke),
    linearZuSrgb(g * lg * staerke),
    linearZuSrgb(b * lb * staerke)
  );
}

/* ------------------------------------------- Farbsehschwaeche (Auftrag 41) ---- */

export type Sehschwaeche = "deutan" | "protan" | "tritan";

/**
 * Simulationsmatrizen fuer Farbsehschwaechen nach Machado, Oliveira und
 * Fernandes (2009), „A Physiologically-based Model for Simulation of Color
 * Vision Deficiency", IEEE TVCG 15(6), 1291–1298 — Tabelle der Autoren
 * (Projektseite UFRGS, „matrices for simulating CVD"), Schweregrad 1,0, also
 * Deuteranopie, Protanopie und Tritanopie. Angewendet auf LINEARES RGB, so wie
 * die Autoren und die gaengigen Umsetzungen (DaltonLens, colorspacious) es tun.
 *
 * Zeilen = Ausgabe R, G, B; Spalten = Eingabe R, G, B.
 */
export const MACHADO_2009: Readonly<Record<Sehschwaeche, readonly (readonly number[])[]>> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

/** Wie eine Farbe (0xrrggbb) mit dieser Farbsehschwaeche erscheint. */
export function simuliereSehschwaeche(hex: number, art: Sehschwaeche): number {
  const lin = hexZuRgb(hex).map(srgbZuLinear);
  const m = MACHADO_2009[art];
  const aus = m.map((zeile) => zeile[0]! * lin[0]! + zeile[1]! * lin[1]! + zeile[2]! * lin[2]!);
  return rgbZuHex(linearZuSrgb(aus[0]!), linearZuSrgb(aus[1]!), linearZuSrgb(aus[2]!));
}

/** ΔE2000 zweier Farben, wie sie jemand mit dieser Farbsehschwaeche sieht. */
export function deltaEHexBei(a: number, b: number, art: Sehschwaeche): number {
  return deltaEHex(simuliereSehschwaeche(a, art), simuliereSehschwaeche(b, art));
}

/** Relative Leuchtdichte nach WCAG 2.1 (sRGB, 0 … 1). */
export function leuchtdichte(hex: number): number {
  const [r, g, b] = hexZuRgb(hex).map(srgbZuLinear);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** Kontrastverhaeltnis nach WCAG 2.1, 1 … 21. 4,5 : 1 ist die Stufe AA fuer Text. */
export function kontrast(a: number, b: number): number {
  const la = leuchtdichte(a);
  const lb = leuchtdichte(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
