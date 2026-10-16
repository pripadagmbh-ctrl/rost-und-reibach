import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SCHILD_POS, SCHILD_B, SCHILD_H, YARD_D, YARD_MAX_X } from "./yard";
import { HALLEN_X, HALLEN_Z, HALLE_TIEFE } from "./office";

/**
 * DER FIRMENNAME — die eine Stelle (E-131).
 *
 * Patrick, 16.10.2026: „mache anstelle von ROST&Reibach wieder Pripada.de
 * rein". PRIPADA ist seine eigene Firma; bis zum 12.09.2026 stand sie schon
 * auf dem Schild (damals „PRIPADA GMBH"). Wer den Namen zeigt — Tafel am Tor,
 * Hauptmenü —, liest ihn hier. Paketname, Ordner und alte Log-Einträge
 * bleiben, wie sie sind; das sind Bezeichner, keine Anzeige.
 */
export const FIRMA = "Pripada.de";

/* ------------------------------------------------------------ Bildinhalt -- */

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
  /** Das P-Signet über dem Namen — nur bei Pripada */
  signet?: boolean;
}

/*
 * ERFUNDENE BETRIEBE (Auftrag 16.10.2026: „Pripada.de und erfundene örtliche
 * Betriebe … keine echten fremden Marken"). Die Namen sind Wortspiele aus dem
 * Gewerbe, keine Familiennamen — ein gewöhnlicher Nachname mit Gewerbe gibt es
 * irgendwo in Deutschland bestimmt wirklich. Milieu aus Beruf und Geschäft
 * (Ton-Leitplanke, CLAUDE.md Regel 7). Gegen kein Register geprüft.
 */
const PRIPADA: Bild = {
  grund: "#e8e4db",
  schrift: "#20262c",
  neben: "#7d7565",
  name: FIRMA,
  zeilen: ["SCHROTT & METALLE", "ANKAUF · ABHOLUNG · CONTAINER"],
  signet: true,
};
const CONTAINER: Bild = {
  grund: "#e3b62c",
  schrift: "#1c1c1c",
  neben: "#3a3326",
  name: "ROLLMULDE",
  zeilen: ["CONTAINERDIENST", "ABSETZMULDEN 3–10 m³ · ABROLLER"],
};
const IMBISS: Bild = {
  grund: "#b7322a",
  schrift: "#f4efe4",
  neben: "#f1d9a8",
  name: "Imbiss zur Waage",
  zeilen: ["CURRYWURST · POMMES · FRIKADELLE", "200 m HINTER DEM TOR"],
};
const BAUSTOFFE: Bild = {
  grund: "#2c4f7a",
  schrift: "#f2f0ea",
  neben: "#c8d3df",
  name: "KIES & KLINKER",
  zeilen: ["BAUSTOFFE", "SAND · SPLITT · PFLASTER · LIEFERUNG"],
};
const PRIPADA_HALLE: Bild = {
  grund: "#e8e4db",
  schrift: "#20262c",
  neben: "#7d7565",
  name: FIRMA,
  zeilen: ["SORTIERHALLE"],
};
const WERKSTATT: Bild = {
  grund: "#33383d",
  schrift: "#f08a24",
  neben: "#d8d8d2",
  name: "SCHRAUBHALLE",
  zeilen: ["KFZ-MEISTERBETRIEB · HU/AU"],
};
const REIFEN: Bild = {
  grund: "#1e1e1e",
  schrift: "#f2c230",
  neben: "#e6e6e0",
  name: "REIFEN-ECKE",
  zeilen: ["REIFEN · FELGEN · EINLAGERUNG"],
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
 * große und vier flache Zellen; die achte flache bleibt frei.
 */
const ATLAS_B = 2048;
const ATLAS_H = 1536;

/** Pixelrechteck einer Zelle im Atlas. */
interface Zelle {
  x: number;
  y: number;
  b: number;
  h: number;
}
const gross = (i: number): Zelle => ({ x: (i % 2) * 1024, y: Math.floor(i / 2) * 512, b: 1024, h: 512 });
const flach = (i: number): Zelle => ({ x: (i % 2) * 1024, y: 1024 + Math.floor(i / 2) * 256, b: 1024, h: 256 });

/** Jedes Bild einmal im Atlas — zwei Tafeln mit demselben Bild teilen sich die Zelle. */
const ZELLEN: Array<[Bild, Zelle]> = [
  [PRIPADA, gross(0)],
  [CONTAINER, gross(1)],
  [IMBISS, gross(2)],
  [BAUSTOFFE, gross(3)],
  [PRIPADA_HALLE, flach(0)],
  [WERKSTATT, flach(1)],
  [REIFEN, flach(2)],
];

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
}

/** Schaut nach −z (von der Nordmauer auf den Platz) */
const NACH_SUEDEN = Math.PI;
/** Schaut nach −x (von der Ostmauer auf den Platz) */
const NACH_WESTEN = -Math.PI / 2;
/** Schaut nach +x (Hallenfront, `office.TOR_RICHTUNG`) */
const NACH_OSTEN = Math.PI / 2;

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
      name: "Firmentafel am Tor", bild: PRIPADA,
      x: SCHILD_POS.x, y: SCHILD_POS.y, z: SCHILD_POS.z, b: SCHILD_B, h: SCHILD_H,
      rot: NACH_SUEDEN, pfosten: true, kollider: true,
    },
    /*
     * Nordmauer östlich des Tors: −17,5 … −8,5 steht über den beiden
     * Warteplätzen am Tor und Janines Wagen, 3 m neben der Zufahrt
     * (x −22 ± 1,55). 1,0 … 10,0 lässt den Flutlichtmast auf x 0
     * (`daylight.einmauern`) in der Lücke stehen.
     */
    frei("Containerdienst, Nordmauer am Tor", CONTAINER, -13.0, nord, NACH_SUEDEN),
    frei("Imbiss, Nordmauer Ost", IMBISS, 5.5, nord, NACH_SUEDEN),
    /*
     * Ostmauer: z −20 … −11 steht hinter dem Abladeplatz, rechts vom Sitz —
     * dorthin schaut, wer einen Laster leer macht. z 11,5 … 20,5 lässt die
     * Masten auf z 8 und z 26 frei.
     */
    frei("Baustoffe, Ostmauer am Abladeplatz", BAUSTOFFE, ost, -15.5, NACH_WESTEN),
    frei("Pripada, Ostmauer Nord", PRIPADA, ost, 16.0, NACH_WESTEN),
    // Die drei Hallen: Blende über dem Tor, auf den Platz hin.
    blende("Halle 1", PRIPADA_HALLE, 0),
    blende("Halle 2", WERKSTATT, 1),
    blende("Halle 3", REIFEN, 2),
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
  for (let i = 0; i < 90 * k; i++) {
    const r = (20 + zuf() * 90) * k;
    ctx.fillStyle = `rgba(150,142,126,${0.03 + zuf() * 0.06})`;
    ctx.beginPath();
    ctx.arc(zuf() * z.b, zuf() * z.h, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const mx = z.b / 2;
  const breitMax = z.b - 140 * Math.max(k, 0.6);
  ctx.textAlign = "center";
  if (k >= 1) {
    // Große Tafel: Signet (falls), Name, zwei Zeilen — Satz der Firmentafel
    if (bild.signet) maleSignet(ctx, mx, 150);
    ctx.fillStyle = "rgba(30,26,22,0.25)";
    ctx.letterSpacing = "2px";
    setzeSchrift(ctx, 700, bild.signet ? 108 : 150, bild.name, breitMax);
    const grund = bild.signet ? 330 : 250;
    ctx.fillText(bild.name, mx + 3, grund + 3);
    ctx.fillStyle = bild.schrift;
    ctx.fillText(bild.name, mx, grund);
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
    ctx.fillStyle = "rgba(30,26,22,0.25)";
    ctx.fillText(bild.name, mx + 3, 128 + 3);
    ctx.fillStyle = bild.schrift;
    ctx.fillText(bild.name, mx, 128);
    ctx.fillStyle = bild.neben;
    ctx.letterSpacing = "8px";
    if (bild.zeilen[0]) {
      setzeSchrift(ctx, 600, 46, bild.zeilen[0], breitMax);
      ctx.fillText(bild.zeilen[0], mx, 200);
    }
  }
  ctx.letterSpacing = "0px";

  verwittere(ctx, z, k, zuf);
  ctx.restore();
}

/**
 * Das P im Kreis — das Signet der PRIPADA-Tafel bis zum 12.09.2026 (Commit
 * a6cc90f), auf 71 % verkleinert (Radius 110 → 78), damit es über der
 * Wortmarke Platz hat wie der Ring der Rust’n’Reibach-Tafel.
 */
function maleSignet(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.strokeStyle = "#9a8f7c";
  ctx.fillStyle = "#9a8f7c";
  ctx.lineCap = "butt";
  ctx.lineWidth = 24;
  ctx.beginPath();
  ctx.arc(cx, cy, 78, -Math.PI / 2, Math.PI * 0.75);
  ctx.stroke();
  ctx.lineWidth = 21;
  ctx.beginPath();
  ctx.arc(cx - 13, cy - 4, 41, Math.PI * 0.5, Math.PI * 1.75);
  ctx.stroke();
  ctx.fillRect(cx - 23, cy - 4, 21, 92);
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

/**
 * Alle Tafeln bauen: ein Netz für die Schauflächen, eins für Rahmen und
 * Pfosten. Die Firmentafel behält ihre beiden Pfosten-Kollider (Bestand);
 * die neuen Tafeln stehen hinter der Mauer bzw. an der Hallenwand und
 * brauchen keinen — dorthin fährt und greift niemand.
 */
export function baueWerbeschilder(scene: THREE.Scene, world: RAPIER.World): void {
  const schilder = werbeschilder();

  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_B;
  canvas.height = ATLAS_H;
  const ctx = canvas.getContext("2d")!;
  // Dieselbe Saat wie die Firmentafel vom 12.09.2026, je Zelle weitergezählt
  ZELLEN.forEach(([bild, zelle], i) => maleTafel(ctx, bild, zelle, 20260912 + i));
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;

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
    const pfostenH = s.y;
    for (const px of [-s.b * 0.32, s.b * 0.32]) {
      const p = new THREE.BoxGeometry(0.45, pfostenH, 0.45);
      p.applyMatrix4(m.makeTranslation(px, pfostenH / 2 - s.y, -0.55));
      rahmen.push(p.applyMatrix4(lage));
      if (!s.kollider) continue;
      const w = new THREE.Vector3(px, pfostenH / 2, -0.55).applyAxisAngle(achse, s.rot);
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
