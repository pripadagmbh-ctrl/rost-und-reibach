/**
 * Erzeugt die App-Icons aus reinem Code — kein Grafikprogramm, keine Assets.
 *
 * Motiv: die geöffnete Spinne über einem Schrotthaufen, in den Hausfarben
 * (Anthrazit, Firmengrün, Warngelb). Aufruf:
 *
 *   node tools/make-icons.mjs
 */
import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "prototype", "public");

const BG = "#1a1c1e";
const GREEN = "#4f9c3a";
const STEEL = "#2b3033";
const EDGE = "#8d979d";
const YELLOW = "#f0b429";

/**
 * @param size Kantenlänge in Pixeln
 * @param safe Randanteil, den maskierbare Icons freilassen müssen (Android
 *             schneidet je nach Gerät einen Kreis oder abgerundetes Quadrat aus)
 */
function drawIcon(size, safe = 0) {
  const c = createCanvas(size, size);
  const x = c.getContext("2d");
  const S = size;

  x.fillStyle = BG;
  x.fillRect(0, 0, S, S);

  // Inhalt skaliert in den sicheren Bereich
  const inset = S * safe;
  const w = S - inset * 2;
  x.save();
  x.translate(inset, inset);

  // Schrotthaufen als grobe Silhouette
  x.fillStyle = STEEL;
  x.beginPath();
  x.moveTo(w * 0.06, w * 0.9);
  x.lineTo(w * 0.26, w * 0.66);
  x.lineTo(w * 0.4, w * 0.78);
  x.lineTo(w * 0.56, w * 0.6);
  x.lineTo(w * 0.74, w * 0.8);
  x.lineTo(w * 0.94, w * 0.9);
  x.closePath();
  x.fill();
  // ein paar helle Kanten im Haufen
  x.strokeStyle = EDGE;
  x.lineWidth = Math.max(1, w * 0.012);
  for (const [ax, ay, bx, by] of [
    [0.2, 0.82, 0.34, 0.72],
    [0.5, 0.84, 0.6, 0.68],
    [0.68, 0.86, 0.82, 0.79],
  ]) {
    x.beginPath();
    x.moveTo(w * ax, w * ay);
    x.lineTo(w * bx, w * by);
    x.stroke();
  }

  // Aufhängung und Rotator
  const cx = w * 0.5;
  x.fillStyle = GREEN;
  x.fillRect(cx - w * 0.045, w * 0.06, w * 0.09, w * 0.16);
  x.fillStyle = STEEL;
  x.fillRect(cx - w * 0.09, w * 0.2, w * 0.18, w * 0.09);

  // Traverse
  x.fillStyle = STEEL;
  x.beginPath();
  x.moveTo(cx - w * 0.2, w * 0.29);
  x.lineTo(cx + w * 0.2, w * 0.29);
  x.lineTo(cx + w * 0.14, w * 0.38);
  x.lineTo(cx - w * 0.14, w * 0.38);
  x.closePath();
  x.fill();

  // Fünf Sichelschalen: vom Gelenkring nach außen ausholend, Spitze wieder
  // nach innen — so liest sich die Spinne auch als kleines Symbol
  const top = w * 0.37;
  x.lineCap = "round";
  for (let i = -2; i <= 2; i++) {
    const t = i / 2; // -1 .. 1
    const startX = cx + t * w * 0.15;
    const bauchX = cx + t * w * 0.33;
    const tipX = cx + t * w * 0.27;
    const tipY = top + w * (0.34 - Math.abs(t) * 0.05);
    x.strokeStyle = STEEL;
    x.lineWidth = w * 0.08;
    x.beginPath();
    x.moveTo(startX, top);
    x.quadraticCurveTo(bauchX, top + w * 0.2, tipX, tipY);
    x.stroke();
    // helle Schneide an der Spitze
    x.strokeStyle = EDGE;
    x.lineWidth = w * 0.022;
    x.beginPath();
    x.moveTo(cx + t * w * 0.31, top + w * 0.24);
    x.lineTo(tipX, tipY);
    x.stroke();
  }

  // Zylinder in Grün — das Erkennungszeichen der Maschine
  x.strokeStyle = GREEN;
  x.lineWidth = w * 0.035;
  for (const dir of [-1, 1]) {
    x.beginPath();
    x.moveTo(cx + dir * w * 0.05, w * 0.3);
    x.lineTo(cx + dir * w * 0.2, w * 0.46);
    x.stroke();
  }

  // Warnstreifen unten als Abschluss
  x.fillStyle = YELLOW;
  x.fillRect(0, w * 0.93, w, w * 0.045);

  x.restore();
  return c;
}

for (const [name, size, safe] of [
  ["icon-192.png", 192, 0.04],
  ["icon-512.png", 512, 0.04],
  ["icon-maskable-512.png", 512, 0.14],
  ["icon-1024.png", 1024, 0.04],
]) {
  const canvas = drawIcon(size, safe);
  writeFileSync(join(OUT, name), canvas.toBuffer("image/png"));
  console.log("geschrieben:", name);
}
