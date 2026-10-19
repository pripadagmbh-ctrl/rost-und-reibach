import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SCHILD_POS, SCHILD_B, SCHILD_H, YARD_D, YARD_MAX_X, BUCHT_Z, TRENNSTEIN_X } from "./yard";
import { HALLEN_X, HALLEN_Z, HALLE_TIEFE, OFFICE_X, OFFICE_Z } from "./office";

/**
 * DER SPIELNAME — die eine Stelle (E-131, seit E-173 wieder Rost & Reibach).
 *
 * Patrick, 20.10.2026: „Nenn das Spiel wieder Rost&Reibach. Auch die
 * Werbetafeln entsprechend umbenennen." Auf Nachfrage: Im Store heißt es
 * „Rost & Reibach" (Anbieter bleibt die Pripada GmbH), und auf dem Platz wird
 * ALLES Rost & Reibach — Tafeln, grüne Mulden, Abholer, Waage, Halle.
 * Vom 16. bis 20.10.2026 stand hier „Pripada.de" (E-131/E-143), davor vom
 * 12.09. bis 16.10. „Rust’n’Reibach". Wer den Namen zeigt — Tafeln,
 * Mulden-Aufkleber, Abholer, Hauptmenü —, liest ihn hier. Paketname, Ordner,
 * Bezeichner (`PRIPADA_GRUEN`, `"pripadaGruen"`) und alte Log-Einträge
 * bleiben, wie sie sind; das sind Namen im Code, keine Anzeige.
 */
export const FIRMA = "Rost & Reibach";
/**
 * Unter dem App-Symbol auf dem Home-Bildschirm (`Info.plist`
 * CFBundleDisplayName, `manifest.webmanifest` short_name): ohne Leerzeichen.
 * Gemessen (Arial 12 px als Ersatz für SF Pro): „Rost & Reibach" 83 px,
 * „Rost&Reibach" 77 px — so breit wie „Kleinanzeigen" (75 px), das ein iPhone
 * ungekürzt zeigt; mit Leerzeichen würde es zu „Rost & Rei…".
 */
export const FIRMA_KURZ = "Rost&Reibach";

/* ------------------------------------------------------------ Bildinhalt -- */

/**
 * Das Grün der Firmenbehälter (Bezeichner aus E-133): der Abrollcontainer des Abholers
 * (`vehicleModel.ts`, seit jeher 0x2f7a4f) und die Firmenmulden
 * (`firmenmulden.ts`, E-133). Eine Zahl, damit Lack und Aufkleber nicht
 * auseinanderlaufen.
 */
export const PRIPADA_GRUEN = "#2f7a4f";

/** Was auf einer Tafel steht und in welchen Farben. */
interface Bild {
  /** Plattenfarbe — verwittert, nie reinweiß */
  grund: string;
  /** Farbe der Hauptzeile */
  schrift: string;
  /** Farbe der Nebenzeilen */
  neben: string;
  /** Die große Zeile */
  name: string;
  /** Kleinere Zeilen darunter (höchstens zwei) */
  zeilen: string[];
  /** Das Ring-Signet über dem Namen — nur auf der großen Tafel */
  signet?: boolean;
  /** Rost und Flecken */
  verwittert: boolean;
}

/*
 * NUR DER EIGENE NAME (E-143, seit E-173 Rost & Reibach). Patrick,
 * 17.10.2026: „nimm rent4ring und ledprofi raus. Mach nur pripada.de rein";
 * 20.10.2026: „Nenn das Spiel wieder Rost&Reibach. Auch die Werbetafeln
 * entsprechend umbenennen." Fremde Firmen und Logodateien sind weg.
 */
const TAFEL: Bild = {
  grund: "#e8e4db",
  schrift: "#20262c",
  neben: "#7d7565",
  name: FIRMA,
  zeilen: ["SCHROTT & METALLE", "ANKAUF · ABHOLUNG · CONTAINER"],
  signet: true,
  verwittert: true,
};
const HALLE_BILD: Bild = {
  grund: "#e8e4db",
  schrift: "#20262c",
  neben: "#7d7565",
  name: FIRMA,
  zeilen: ["SORTIERHALLE"],
  verwittert: true,
};
/* ------------------------------------------------------------- Der Atlas -- */

/**
 * ALLE TAFELN AUF EINER TEXTUR (E-131).
 *
 * Bis zum 16.10.2026 war die Firmentafel vier Netze (Tafel, Rahmen, zwei
 * Pfosten) und damit vier Zeichenrufe — der Engpass auf dem iPad (E-025).
 * Acht Tafeln auf dieselbe Art wären 32. Jetzt liegen alle Bilder in einem
 * Atlas, alle Tafeln in EINEM Netz, alle Rahmen und Pfosten in einem zweiten:
 * zwei Zeichenrufe für den ganzen Platz.
 *
 * Eine große Zelle ist 1024 × 512 Pixel — dieselbe Dichte, mit der die
 * Firmentafel seit dem 12.09.2026 auf dem Gerät gelesen wird. Eine Hallenzelle
 * ist 1024 × 256 (4 : 1 wie die Blende über dem Tor). 2048 × 1536 fasst vier
 * große und vier flache Zellen.
 *
 * SEIT E-143 NUR NOCH 1024 × 1024. Mit den fremden Logos sind fünf Zellen
 * weggefallen; übrig sind die große Tafel (oben), die Hallenblende
 * und das grüne Feld für Abholer und Firmenmulden (`atlasFeld`).
 * Ein Viertel der Fläche heißt rund 5,6 statt 16 MB Grafikspeicher mit
 * Mipmaps — die Sorge um das iPhone mini aus E-131.
 */
const ATLAS_B = 1024;
const ATLAS_H = 1024;

/** Pixelrechteck einer Zelle im Atlas. */
interface Zelle {
  x: number;
  y: number;
  b: number;
  h: number;
}
const gross = (): Zelle => ({ x: 0, y: 0, b: 1024, h: 512 });
const flach = (i: number): Zelle => ({ x: 0, y: 512 + i * 256, b: 1024, h: 256 });

/** Jedes Bild einmal im Atlas — zwei Tafeln mit demselben Bild teilen sich die Zelle. */
const ZELLEN: Array<[Bild, Zelle]> = [
  [TAFEL, gross()],
  [HALLE_BILD, flach(0)],
];
/** Das grüne Feld: ganze Zelle Grün, Signet und Name nur im mittleren 512 × 256. */
const GRUEN = flach(1);
const GRUEN_MITTE_B = 512;

/** Rechteck im Atlas als Texturkoordinaten (v nach oben, wie three es liest). */
export interface AtlasFeld {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

/**
 * Wo im Atlas das grüne Firmenfeld liegt.
 *
 * „pripadaGruen": zentrierter Ausschnitt der grünen Zelle mit dem gewünschten
 * Seitenverhältnis (Breite/Höhe), Höhe = volle Zellhöhe; das Signet steht in
 * der Mitte. Breiter als die Zelle (4 : 1) geht nicht — dann bleibt es 4 : 1.
 * „pripadaGruenRand": ein kleines Feld nur Grün am linken Zellrand, für
 * Flächen, die einfarbig grün sein sollen. 64 px Abstand zu den Nachbarzellen,
 * damit die Mipmaps kein Weiß hereinziehen (SW).
 */
export function atlasFeld(feld: "pripadaGruen" | "pripadaGruenRand", seitenverhaeltnis = 2): AtlasFeld {
  const px = (x0: number, y0: number, x1: number, y1: number): AtlasFeld => ({
    u0: x0 / ATLAS_B, u1: x1 / ATLAS_B, v0: 1 - y1 / ATLAS_H, v1: 1 - y0 / ATLAS_H,
  });
  if (feld === "pripadaGruenRand") return px(GRUEN.x + 64, GRUEN.y + 64, GRUEN.x + 192, GRUEN.y + GRUEN.h - 64);
  const b = Math.min(GRUEN.h * seitenverhaeltnis, GRUEN.b);
  const mx = GRUEN.x + GRUEN.b / 2;
  return px(mx - b / 2, GRUEN.y, mx + b / 2, GRUEN.y + GRUEN.h);
}

/* ------------------------------------------------------------ Die Tafeln -- */

/** Eine Tafel: wo, wie groß, wohin sie schaut, was darauf steht. */
export interface Werbeschild {
  name: string;
  bild: Bild;
  /** Mitte der Schaufläche */
  x: number;
  y: number;
  z: number;
  /** Breite und Höhe (m) */
  b: number;
  h: number;
  /** Drehung um y; 0 = Schaufläche nach +z */
  rot: number;
  /** Steht auf zwei Pfosten (freistehend) oder hängt an einer Wand */
  pfosten: boolean;
  /** Pfosten mit Kollider — nur die Firmentafel am Tor (Bestand) */
  kollider?: boolean;
  /** Unterkante der Pfosten (m) — 0 am Boden, > 0 auf einem Dach */
  fuss?: number;
}

/** Schaut nach −z (von der Nordmauer auf den Platz) */
const NACH_SUEDEN = Math.PI;
/** Schaut nach −x (von der Ostmauer auf den Platz) */
const NACH_WESTEN = -Math.PI / 2;
/** Schaut nach +x (Hallenfront, `office.TOR_RICHTUNG`) */
const NACH_OSTEN = Math.PI / 2;
/** Schaut nach +z (von hinter der Bucht auf den Platz) */
const NACH_NORDEN = 0;

/**
 * Die freistehenden Tafeln stehen HINTER der Mauer, 1,5 m hinter ihrer Achse
 * (SW): außerhalb jeder Fahrspur, jeder Mulde, jedes Schwenkbereichs — auf dem
 * Platz steht nichts Neues. 1,5 m und nicht 3 m wie die Firmentafel, weil die
 * Baumreihe hinter der Nordmauer bei z +34 anfängt und eine Krone bis 2,5 m
 * nach vorn reicht (`Yard.buildLandscape`, Maßstab bis 1,65 × `KRONE_R`) —
 * weiter hinten stünden Äste vor der Schrift. An der Ostmauer gilt dasselbe
 * (Bäume ab x +15,5).
 */
const HINTER_MAUER = 1.5;

/**
 * 9,0 × 4,5 m, Unterkante 4,55 m (SW). Gelesen wird aus der Kabine, und die
 * hat 80 Grad Bildhöhe (`orbitCamera`): Eine Tafel an der Nordmauer steht
 * 53 m vor dem Sitz, ihr Name (150 von 512 Pixeln, 1,3 m) ist auf dem iPad
 * dann rund 14 Bildpunkte hoch — die 8 × 4 m der Firmentafel mit 108 Pixeln
 * kämen auf 9. Die Unterkante: Ein beladener Laster ist bis 4,00 m hoch
 * (E-126, StVZO § 32); aus dem Sitz sieht man über einen Laster auf dem
 * Warteplatz hinweg noch die Unterkante. Mitte damit auf 6,8 m — so hoch wie
 * die Firmentafel (`SCHILD_POS.y`).
 */
const FREI_B = 9.0;
const FREI_H = 4.5;
const FREI_Y = 4.55 + FREI_H / 2;

/**
 * Die Blende über dem Hallentor: von der Unterkante des Sturzes (4,475 m,
 * `office.buildHalle`: Sturz 0,45 hoch auf 4,70) nach oben, 4,4 × 1,1 m. So
 * engt sie das Tor nicht ein, und ihre oberen Ecken (5,58 m bei ±2,2 m)
 * bleiben unter der Dachlinie (5,88 m dort). Sie sitzt 3 cm vor dem Giebel —
 * dessen Front liegt 0,18 m vor der Hallenkante.
 */
const BLENDE_B = 4.4;
const BLENDE_H = 1.1;
const BLENDE_Y = 4.475 + BLENDE_H / 2;
const BLENDE_X = HALLEN_X + HALLE_TIEFE / 2 + 0.18 + 0.03;

/**
 * DIE TAFEL AUF DEM BÜRODACH, DIREKT AN DER WAAGE (E-133).
 *
 * Patrick, 17.10.2026: „Pripada prominent direkt an der waage". Ein
 * Dachaufsteller auf dem Büro, Schaufläche nach Osten zur Waage und auf den
 * Platz. 7,0 × 3,5 m = 2 : 1 wie die Zelle (Vorgabe Bauleiter). Mitte 2,5 m
 * östlich der Gebäudemitte, also über der Ostfront-Hälfte (SW), wo man sie von
 * der Waage aus über die Traufe hinweg sieht.
 *
 * Höhen aus `office.ts`: Traufe 6,2 m (2 Geschosse à 3,1), First 1,7 m darüber
 * auf 7,9 m, halbe Gebäudebreite 3,1 m, First läuft in x. Die Unterkante liegt
 * 0,2 m über dem First (SW) auf 8,1 m. Die Pfosten (bei ±0,32 · 7,0 = ±2,24 m)
 * stehen auf der Dachfläche: Dort liegt die Mittelebene der Deckung auf
 * 6,2 + 1,7 · (1 − 2,24/3,1) = 6,67 m, ihre Oberseite 0,09 m höher (Platte
 * 0,16 m, 29° geneigt). Ein Pfosten ist 0,45 m tief; seine talseitige Kante
 * liegt 0,12 m tiefer als die Mitte. 6,6 m lässt alle Kanten im Dach stecken
 * statt darüber zu schweben.
 */
const DACH_B = 7.0;
const DACH_H = 3.5;
const DACH_UNTERKANTE = 7.9 + 0.2;
const DACH_FUSS = 6.6;

/**
 * DIE TAFEL HINTER DER BUCHT (E-133): „da wo gearbeitet wird". Wer an den Halden
 * greift, schaut nach Süden auf die Buchtrückwand (`SUED_HOCH` = 4,8 m). Die
 * Tafel steht `HINTER_MAUER` dahinter, Unterkante 5,0 m — knapp über der Wand
 * (SW). Mitte x 0,5 = über der Fuge zwischen den Halden (`TRENNSTEIN_X`).
 * Nachgerechnet mit dem festen Zufall aus `buildLandscape`: Kein Baum steht
 * zwischen Tafel und Bucht; der nächste (6,1 | −40,4) steht 3,4 m dahinter,
 * seine Krone (Radius 2,1 m) endet 1,3 m hinter der Tafel und 1,8 m unter
 * ihrer Oberkante.
 */
const BUCHT_UNTERKANTE = 5.0;

/**
 * Alle Tafeln des Platzes. Gerechnet beim Aufruf, nicht beim Laden: `yard.ts`
 * baut sie, und diese Datei liest Zahlen aus `yard.ts` — so entsteht kein
 * Ringschluss beim Laden der Module.
 */
export function werbeschilder(): Werbeschild[] {
  const nord = YARD_D / 2 + HINTER_MAUER;
  const ost = YARD_MAX_X + HINTER_MAUER;
  const frei = (name: string, bild: Bild, x: number, z: number, rot: number): Werbeschild => ({
    name, bild, x, y: FREI_Y, z, b: FREI_B, h: FREI_H, rot, pfosten: true,
  });
  const blende = (name: string, bild: Bild, halle: number): Werbeschild => ({
    name, bild, x: BLENDE_X, y: BLENDE_Y, z: HALLEN_Z[halle]!, b: BLENDE_B, h: BLENDE_H, rot: NACH_OSTEN, pfosten: false,
  });
  return [
    // Die Firmentafel am Tor bleibt, wo sie seit E-010 steht (kulisse.test.ts).
    {
      name: "Firmentafel am Tor", bild: TAFEL,
      x: SCHILD_POS.x, y: SCHILD_POS.y, z: SCHILD_POS.z, b: SCHILD_B, h: SCHILD_H,
      rot: NACH_SUEDEN, pfosten: true, kollider: true,
    },
    /*
     * Nordmauer östlich des Tors: −17,5 … −8,5 steht über den beiden
     * Warteplätzen am Tor und Janines Wagen, 3 m neben der Zufahrt
     * (x −22 ± 1,55). 1,0 … 10,0 lässt den Flutlichtmast auf x 0
     * (`daylight.einmauern`) in der Lücke stehen.
     */
    frei("Tafel, Nordmauer am Tor", TAFEL, -13.0, nord, NACH_SUEDEN),
    frei("Tafel, Nordmauer Ost", TAFEL, 5.5, nord, NACH_SUEDEN),
    /*
     * Ostmauer: z −20 … −11 steht hinter dem Abladeplatz, rechts vom Sitz —
     * dorthin schaut, wer einen Laster leer macht; seit E-133 der eigene Name („da wo
     * gearbeitet wird"). z 11,5 … 20,5 lässt die Masten auf z 8 und z 26 frei.
     */
    frei("Tafel, Ostmauer am Abladeplatz", TAFEL, ost, -15.5, NACH_WESTEN),
    frei("Tafel, Ostmauer Nord", TAFEL, ost, 16.0, NACH_WESTEN),
    {
      name: "Tafel, Dach Büro an der Waage", bild: TAFEL,
      x: OFFICE_X + 2.5, y: DACH_UNTERKANTE + DACH_H / 2, z: OFFICE_Z, b: DACH_B, h: DACH_H,
      rot: NACH_OSTEN, pfosten: true, fuss: DACH_FUSS,
    },
    {
      name: "Tafel, hinter der Bucht", bild: TAFEL,
      x: TRENNSTEIN_X, y: BUCHT_UNTERKANTE + FREI_H / 2, z: BUCHT_Z - HINTER_MAUER, b: FREI_B, h: FREI_H,
      rot: NACH_NORDEN, pfosten: true,
    },
    // Die drei Hallen: Blende über dem Tor, auf den Platz hin.
    blende("Halle 1", HALLE_BILD, 0),
    blende("Halle 2", HALLE_BILD, 1),
    blende("Halle 3", HALLE_BILD, 2),
  ];
}

/* ------------------------------------------------------------- Malen ----- */

/** Fester Zufall je Tafelbild: dasselbe Schild bei jedem Start. */
function festerZufall(saat: number): () => number {
  let s = saat;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/** Schrift so setzen, dass sie in `max` Pixel passt — notfalls kleiner. */
function setzeSchrift(ctx: CanvasRenderingContext2D, gewicht: number, px: number, text: string, max: number): void {
  let g = px;
  ctx.font = `${gewicht} ${g}px 'Segoe UI', Helvetica, Arial, sans-serif`;
  const w = ctx.measureText(text).width;
  if (w > max && w > 0) {
    g = Math.floor((g * max) / w);
    ctx.font = `${gewicht} ${g}px 'Segoe UI', Helvetica, Arial, sans-serif`;
  }
}

/**
 * Ein Tafelbild in seine Zelle malen. Satz und Verwitterung sind die der
 * Firmentafel vom 12.09.2026 („kann leichte Rostspuren haben"), auf die
 * Zellgröße umgerechnet: Rostfahnen unter den Schraubenlöchern, fleckige
 * Verwitterung, angefressene Kanten.
 */
function maleTafel(ctx: CanvasRenderingContext2D, bild: Bild, z: Zelle, saat: number): void {
  const zuf = festerZufall(saat);
  const k = z.h / 512; // Maßstab gegen die große Zelle
  ctx.save();
  ctx.beginPath();
  ctx.rect(z.x, z.y, z.b, z.h);
  ctx.clip();
  ctx.translate(z.x, z.y);

  ctx.fillStyle = bild.grund;
  ctx.fillRect(0, 0, z.b, z.h);
  for (let i = 0; bild.verwittert && i < 90 * k; i++) {
    const r = (20 + zuf() * 90) * k;
    ctx.fillStyle = `rgba(150,142,126,${0.03 + zuf() * 0.06})`;
    ctx.beginPath();
    ctx.arc(zuf() * z.b, zuf() * z.h, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const mx = z.b / 2;
  const breitMax = z.b - 140 * Math.max(k, 0.6);
  ctx.textAlign = "center";
  // Schlagschatten nur auf den verwitterten Blechtafeln; die saubere Platte bleibt sauber
  const schatten = bild.verwittert ? "rgba(30,26,22,0.25)" : "rgba(0,0,0,0)";
  if (k >= 1) {
    // Große Tafel: Signet (falls), Name, zwei Zeilen — Satz der Firmentafel
    if (bild.signet) maleSignet(ctx, mx, 150);
    ctx.fillStyle = schatten;
    ctx.letterSpacing = "2px";
    setzeSchrift(ctx, 700, bild.signet ? 108 : 150, bild.name, breitMax);
    // Ohne Zeilen steht der Name in der Mitte: Grundlinie 0,7 × 150 / 2 unter der Zellmitte
    const grund = bild.signet ? 330 : bild.zeilen.length > 0 ? 250 : 256 + 52;
    ctx.fillText(bild.name, mx + 3, grund + 3);
    schreibeName(ctx, bild.name, mx, grund, bild.schrift);
    ctx.fillStyle = bild.neben;
    ctx.letterSpacing = bild.signet ? "16px" : "10px";
    if (bild.zeilen[0]) {
      setzeSchrift(ctx, bild.signet ? 300 : 600, bild.signet ? 40 : 60, bild.zeilen[0], breitMax);
      ctx.fillText(bild.zeilen[0], mx, bild.signet ? 400 : 345);
    }
    ctx.letterSpacing = bild.signet ? "10px" : "4px";
    if (bild.zeilen[1]) {
      setzeSchrift(ctx, bild.signet ? 300 : 500, bild.signet ? 30 : 40, bild.zeilen[1], breitMax);
      ctx.fillText(bild.zeilen[1], mx, bild.signet ? 445 : 420);
    }
  } else {
    // Hallenblende: Name groß, eine Zeile darunter
    ctx.letterSpacing = "2px";
    setzeSchrift(ctx, 700, 112, bild.name, breitMax);
    ctx.fillStyle = schatten;
    ctx.fillText(bild.name, mx + 3, 128 + 3);
    schreibeName(ctx, bild.name, mx, 128, bild.schrift);
    ctx.fillStyle = bild.neben;
    ctx.letterSpacing = "8px";
    if (bild.zeilen[0]) {
      setzeSchrift(ctx, 600, 46, bild.zeilen[0], breitMax);
      ctx.fillText(bild.zeilen[0], mx, 200);
    }
  }
  ctx.letterSpacing = "0px";

  if (bild.verwittert) verwittere(ctx, z, k, zuf);
  ctx.restore();
}

/** Heller Ton für Signet und Namen auf Grün (SW: gebrochenes Weiß wie die Tafelplatte). */
const GRUEN_SCHRIFT = "#f2efe6";

/**
 * Die grüne Zelle: überall `PRIPADA_GRUEN`, im mittleren 512 × 256-Feld das
 * Signet über dem Namen (`FIRMA`). Links und rechts davon je 256 px reines Grün —
 * dort tastet `atlasFeld("pripadaGruenRand")` die Flächenfarbe ab. Keine
 * Verwitterung: Das ist Lack auf einem Behälter, kein Blechschild.
 */
function maleGruen(ctx: CanvasRenderingContext2D, z: Zelle): void {
  ctx.save();
  ctx.fillStyle = PRIPADA_GRUEN;
  ctx.fillRect(z.x, z.y, z.b, z.h);
  const mx = z.x + z.b / 2;
  // Signet auf 55 % (gut 100 px hoch), darunter der Name — Satz wie die große Tafel
  ctx.save();
  ctx.translate(mx, z.y + 72);
  ctx.scale(0.55, 0.55);
  maleSignet(ctx, 0, 0, GRUEN_SCHRIFT);
  ctx.restore();
  ctx.fillStyle = GRUEN_SCHRIFT;
  ctx.textAlign = "center";
  ctx.letterSpacing = "2px";
  setzeSchrift(ctx, 700, 90, FIRMA, GRUEN_MITTE_B - 52);
  schreibeName(ctx, FIRMA, mx, z.y + 222, GRUEN_SCHRIFT, UND_AUF_GRUEN);
  ctx.letterSpacing = "0px";
  ctx.restore();
}

/**
 * Rostbraun für das „&" und das Signet (SW): die Farbe der Rostfahnen unter den
 * Schraubenlöchern (`verwittere`, 140/76/38), etwas dunkler, damit es auf der
 * hellen Platte steht. Auf Grün ein heller Rostton — das dunkle verschwände.
 */
const ROST = "#8a4524";
const UND_AUF_GRUEN = "#e0a070";

/**
 * Den Namen zentriert schreiben, das „&" in Rost (E-173): „Rost" und
 * „Reibach" in der Schriftfarbe, das Zeichen dazwischen rostbraun — so wie
 * auf der Rust’n’Reibach-Tafel bis 16.10.2026 die beiden Apostrophe um das n
 * abgesetzt waren. Schrift (`ctx.font`) ist vorher gesetzt; ohne „&" ist es
 * ein gewöhnliches `fillText`.
 */
function schreibeName(
  ctx: CanvasRenderingContext2D, text: string, mx: number, y: number, farbe: string, und = ROST
): void {
  const i = text.indexOf("&");
  ctx.fillStyle = farbe;
  if (i < 0) {
    ctx.fillText(text, mx, y);
    return;
  }
  const teile: Array<[string, string]> = [[text.slice(0, i), farbe], ["&", und], [text.slice(i + 1), farbe]];
  const breite = ctx.measureText(text).width;
  const ausrichtung = ctx.textAlign;
  ctx.textAlign = "left";
  let x = mx - breite / 2;
  for (const [t, f] of teile) {
    ctx.fillStyle = f;
    ctx.fillText(t, x, y);
    x += ctx.measureText(t).width;
  }
  ctx.textAlign = ausrichtung;
}

/**
 * Das Signet: ein offener Ring mit einem kleineren darin — das Zeichen der
 * Rust’n’Reibach-Tafel vom 12.09. bis 16.10.2026 (Stand vor Commit 1a1b51a,
 * `yard.buildBillboard`), Maße unverändert. Seit E-173 wieder in Gebrauch,
 * jetzt rostbraun statt grau (Patrick: „Rost & Reibach", kein fremdes Logo).
 */
function maleSignet(ctx: CanvasRenderingContext2D, cx: number, cy: number, farbe = ROST): void {
  ctx.strokeStyle = farbe;
  ctx.lineCap = "butt";
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.arc(cx, cy, 78, -Math.PI * 0.62, Math.PI * 1.28);
  ctx.stroke();
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.arc(cx, cy, 40, Math.PI * 0.38, Math.PI * 2.28);
  ctx.stroke();
}

/** Schraubenlöcher mit Rostfahnen, angefressene Ränder, Rostnester. */
function verwittere(ctx: CanvasRenderingContext2D, z: Zelle, k: number, zuf: () => number): void {
  const rand = 60 * Math.max(k, 0.6);
  const loecher: Array<[number, number]> = [
    [70, rand], [z.b - 70, rand], [70, z.h - rand], [z.b - 70, z.h - rand],
  ];
  if (k >= 1) loecher.push([z.b / 2, 46]);
  for (const [lx, ly] of loecher) {
    const lang = (140 + zuf() * 240) * k;
    const fahne = ctx.createLinearGradient(0, ly, 0, ly + lang);
    fahne.addColorStop(0, "rgba(104,50,22,0.75)");
    fahne.addColorStop(0.3, "rgba(140,76,38,0.45)");
    fahne.addColorStop(1, "rgba(150,84,44,0)");
    ctx.fillStyle = fahne;
    const w = 14 + zuf() * 14;
    ctx.fillRect(lx - w / 2, ly, w, lang);
    for (let n = 0; n < 2; n++) {
      const dx = (zuf() - 0.5) * 34;
      ctx.fillRect(lx + dx - 2, ly + 8, 3 + zuf() * 3, lang * (0.4 + zuf() * 0.5));
    }
    ctx.fillStyle = "#4a4a46";
    ctx.beginPath();
    ctx.arc(lx, ly, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  const rostTon = (a: number): string => {
    const t = zuf();
    return `rgba(${Math.round(120 + t * 50)},${Math.round(62 + t * 34)},${Math.round(28 + t * 20)},${a})`;
  };
  // Rost frisst von der Kante nach innen, in Flecken, nie in geraden Kanten
  const tiefMax = 120 * Math.max(k, 0.6);
  for (let i = 0; i < 900 * Math.max(k, 0.6); i++) {
    const kante = Math.floor(zuf() * 4);
    const t = zuf();
    const tief = Math.pow(zuf(), 2.2) * tiefMax;
    const r = 3 + zuf() * 13;
    const deck = 0.5 * (1 - tief / tiefMax) * (0.35 + zuf() * 0.65);
    let px: number;
    let py: number;
    if (kante === 0) { px = t * z.b; py = tief; }
    else if (kante === 1) { px = t * z.b; py = z.h - tief; }
    else if (kante === 2) { px = tief; py = t * z.h; }
    else { px = z.b - tief; py = t * z.h; }
    ctx.fillStyle = rostTon(deck);
    ctx.beginPath();
    ctx.ellipse(px, py, r, r * (0.5 + zuf()), zuf() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // Ein paar Rostnester mitten auf der Fläche, mit Fahne nach unten
  for (let n = 0; n < 7 * k; n++) {
    const nx = 60 + zuf() * (z.b - 120);
    const ny = 60 * k + zuf() * (z.h - 120 * k);
    const gr = (14 + zuf() * 26) * Math.max(k, 0.6);
    for (let i = 0; i < 45; i++) {
      const w = zuf() * Math.PI * 2;
      const d = Math.pow(zuf(), 0.6) * gr;
      ctx.fillStyle = rostTon(0.5 * (1 - d / gr) * (0.4 + zuf() * 0.6));
      ctx.beginPath();
      ctx.ellipse(nx + Math.cos(w) * d, ny + Math.sin(w) * d, 2 + zuf() * 6, 2 + zuf() * 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const lauf = ctx.createLinearGradient(0, ny, 0, ny + (70 + zuf() * 150) * k);
    lauf.addColorStop(0, "rgba(130,68,32,0.34)");
    lauf.addColorStop(1, "rgba(150,84,44,0)");
    ctx.fillStyle = lauf;
    ctx.fillRect(nx - gr * 0.35, ny, gr * 0.7, 220 * k);
  }
}

/* ------------------------------------------------------------- Bauen ----- */

/** Rahmen- und Pfostenfarbe der Firmentafel (seit 02.09.2026). */
const RAHMEN_FARBE = 0x3a4045;

/** Der eine Atlas für Tafeln, Abholer und Firmenmulden. */
let atlas: THREE.CanvasTexture | null = null;

/**
 * DER GEMEINSAME ATLAS (E-133): einmal angelegt, von allen benutzt — Tafeln,
 * Abholer-Container, Firmenmulden. `null`, solange es kein `document` gibt
 * (Vitest ohne Leinwand-Attrappe); dann wird beim nächsten Aufruf neu gefragt.
 */
export function werbeAtlas(): THREE.CanvasTexture | null {
  if (atlas) return atlas;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_B;
  canvas.height = ATLAS_H;
  const ctx = canvas.getContext("2d")!;
  /*
   * Kopflose Attrappen, die Zeichenbefehle nur schlucken (`leinwandAttrappe`,
   * die in `containerrueckgabe.test.ts`), liefern keinen Farbverlauf — damit
   * lässt sich keine Tafel malen. Dort gibt es keinen Atlas, und Abholer und
   * Mulden bleiben, wie sie ohne Leinwand sind. Ein Browser hat immer einen.
   */
  if (typeof ctx.createLinearGradient(0, 0, 0, 1)?.addColorStop !== "function") return null;
  // Dieselbe Saat wie die Firmentafel vom 12.09.2026, je Zelle weitergezählt
  ZELLEN.forEach(([bild, zelle], i) => maleTafel(ctx, bild, zelle, 20260912 + i));
  maleGruen(ctx, GRUEN);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  atlas = tex;
  return tex;
}

/**
 * Alle Tafeln bauen: ein Netz für die Schauflächen, eins für Rahmen und
 * Pfosten. Die Firmentafel behält ihre beiden Pfosten-Kollider (Bestand);
 * die anderen stehen hinter der Mauer, auf dem Bürodach bzw. an der
 * Hallenwand und brauchen keinen — dorthin fährt und greift niemand.
 */
export function baueWerbeschilder(scene: THREE.Scene, world: RAPIER.World): void {
  const schilder = werbeschilder();
  const tex = werbeAtlas()!;

  const tafeln: THREE.BufferGeometry[] = [];
  const rahmen: THREE.BufferGeometry[] = [];
  const m = new THREE.Matrix4();
  const lage = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const achse = new THREE.Vector3(0, 1, 0);
  const pfostenBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());

  for (const s of schilder) {
    const zelle = ZELLEN.find(([b]) => b === s.bild)![1];
    q.setFromAxisAngle(achse, s.rot);
    lage.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(1, 1, 1));

    // Schaufläche mit den Atlas-Koordinaten ihrer Zelle
    const tafel = new THREE.PlaneGeometry(s.b, s.h);
    const uv = tafel.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(
        i,
        (zelle.x + uv.getX(i) * zelle.b) / ATLAS_B,
        1 - (zelle.y + (1 - uv.getY(i)) * zelle.h) / ATLAS_H
      );
    }
    tafeln.push(tafel.applyMatrix4(lage));

    // Rahmen hinter der Tafel (lokal −z = hinter der Schaufläche)
    const rand = s.pfosten ? 0.4 : 0.16;
    const tiefe = s.pfosten ? 0.22 : 0.06;
    const r = new THREE.BoxGeometry(s.b + rand, s.h + rand, tiefe);
    r.applyMatrix4(m.makeTranslation(0, 0, -(s.pfosten ? 0.2 : 0.035)));
    rahmen.push(r.applyMatrix4(lage));

    if (!s.pfosten) continue;
    // Pfosten hinter der Tafel, nicht davor: sonst schneiden ihre Kanten in
    // die Schrift. Die Schaufläche bleibt plan (Wunsch 02.09.2026).
    const fuss = s.fuss ?? 0;
    const pfostenH = s.y - fuss;
    for (const px of [-s.b * 0.32, s.b * 0.32]) {
      const p = new THREE.BoxGeometry(0.45, pfostenH, 0.45);
      p.applyMatrix4(m.makeTranslation(px, fuss + pfostenH / 2 - s.y, -0.55));
      rahmen.push(p.applyMatrix4(lage));
      if (!s.kollider) continue;
      const w = new THREE.Vector3(px, fuss + pfostenH / 2, -0.55).applyAxisAngle(achse, s.rot);
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.225, pfostenH / 2, 0.225).setTranslation(s.x + w.x, w.y, s.z + w.z),
        pfostenBody
      );
    }
  }

  const flaechen = new THREE.Mesh(
    mergeGeometries(tafeln, false),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, side: THREE.DoubleSide })
  );
  flaechen.name = "Werbeschilder";
  scene.add(flaechen);
  const gestell = new THREE.Mesh(
    mergeGeometries(rahmen, false),
    new THREE.MeshStandardMaterial({ color: RAHMEN_FARBE, roughness: 0.8 })
  );
  gestell.name = "Werbeschilder Gestell";
  gestell.castShadow = true;
  scene.add(gestell);
}
