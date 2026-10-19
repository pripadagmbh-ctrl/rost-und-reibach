/**
 * iOS-Bilder aus dem vorhandenen App-Icon (E-161) — keine neue Grafik.
 *
 *   node tools/ios-bilder.mjs        (oder: npm run ios:bilder)
 *
 * 1. App-Icon 1024 x 1024 OHNE Alphakanal. Apple lehnt ein Store-Icon mit
 *    Alphakanal ab (ITMS-90717), auch wenn jedes Pixel deckend ist. Das Icon
 *    aus `tools/make-icons.mjs` ist RGBA; hier wird es auf den Hintergrund
 *    #1a1c1e gelegt und als reines RGB-PNG geschrieben.
 * 2. Startbild 2732 x 2732: Hintergrund #1a1c1e, das Icon 1:1 in der Mitte.
 *    Der Startbildschirm fuellt den Schirm (scaleAspectFill) und schneidet im
 *    Querformat oben und unten ab; auf dem iPhone mini (812 x 375 pt) bleibt
 *    das Icon mit 304 pt Hoehe ganz sichtbar.
 *
 * Nur Node-Bordmittel (zlib), damit kein Bildpaket mit Binaerdownload noetig
 * ist. Liest nur 8-Bit-PNG ohne Zeilensprung (das liefert make-icons.mjs).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync, crc32 } from "node:zlib";

const V1 = join(dirname(fileURLToPath(import.meta.url)), "..");
const QUELLE = join(V1, "public", "icon-1024.png");
const ASSETS = join(V1, "ios", "App", "App", "Assets.xcassets");
const ICON = join(ASSETS, "AppIcon.appiconset", "AppIcon-512@2x.png");
const SPLASH = ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"].map((n) =>
  join(ASSETS, "Splash.imageset", n),
);
const BG = [0x1a, 0x1c, 0x1e]; // Hintergrund wie index.html / manifest
const SPLASH_KANTE = 2732; // Capacitor-Vorlage, groesstes iPad 2732 px

/** PNG lesen → { w, h, kanaele, px } mit px als Rohpixel ohne Filterbytes. */
function lesePng(datei) {
  const b = readFileSync(datei);
  let pos = 8;
  let w = 0, h = 0, typ = 0;
  const idat = [];
  while (pos < b.length) {
    const len = b.readUInt32BE(pos);
    const art = b.toString("ascii", pos + 4, pos + 8);
    const daten = b.subarray(pos + 8, pos + 8 + len);
    if (art === "IHDR") {
      w = daten.readUInt32BE(0);
      h = daten.readUInt32BE(4);
      typ = daten[9];
      if (daten[8] !== 8 || daten[12] !== 0) throw new Error(`${datei}: nur 8 Bit ohne Zeilensprung`);
    } else if (art === "IDAT") idat.push(daten);
    pos += 12 + len;
  }
  const kanaele = { 2: 3, 6: 4 }[typ];
  if (!kanaele) throw new Error(`${datei}: Farbtyp ${typ} nicht unterstuetzt`);
  const roh = inflateSync(Buffer.concat(idat));
  const zeile = w * kanaele;
  const px = Buffer.alloc(zeile * h);
  for (let y = 0; y < h; y++) {
    const f = roh[y * (zeile + 1)];
    const ein = roh.subarray(y * (zeile + 1) + 1, (y + 1) * (zeile + 1));
    const aus = px.subarray(y * zeile, (y + 1) * zeile);
    const oben = y > 0 ? px.subarray((y - 1) * zeile, y * zeile) : Buffer.alloc(zeile);
    for (let i = 0; i < zeile; i++) {
      const a = i >= kanaele ? aus[i - kanaele] : 0;
      const o = oben[i];
      const c = i >= kanaele ? oben[i - kanaele] : 0;
      let v;
      if (f === 0) v = 0;
      else if (f === 1) v = a;
      else if (f === 2) v = o;
      else if (f === 3) v = (a + o) >> 1;
      else {
        const p = a + o - c, pa = Math.abs(p - a), pb = Math.abs(p - o), pc = Math.abs(p - c);
        v = pa <= pb && pa <= pc ? a : pb <= pc ? o : c;
      }
      aus[i] = (ein[i] + v) & 0xff;
    }
  }
  return { w, h, kanaele, px };
}

function stueck(art, daten) {
  const kopf = Buffer.alloc(8);
  kopf.writeUInt32BE(daten.length, 0);
  kopf.write(art, 4, "ascii");
  const pruef = Buffer.alloc(4);
  pruef.writeUInt32BE(crc32(Buffer.concat([kopf.subarray(4), daten])), 0);
  return Buffer.concat([kopf, daten, pruef]);
}

/** RGB-PNG schreiben (Farbtyp 2, kein Alphakanal). */
function schreibeRgb(datei, w, h, rgb) {
  const roh = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) rgb.copy(roh, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  writeFileSync(
    datei,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      stueck("IHDR", ihdr),
      stueck("IDAT", deflateSync(roh, { level: 9 })),
      stueck("IEND", Buffer.alloc(0)),
    ]),
  );
}

// 1. Icon ohne Alphakanal
const q = lesePng(QUELLE);
const icon = Buffer.alloc(q.w * q.h * 3);
for (let i = 0; i < q.w * q.h; i++) {
  const al = q.kanaele === 4 ? q.px[i * 4 + 3] / 255 : 1;
  for (let k = 0; k < 3; k++) icon[i * 3 + k] = Math.round(q.px[i * q.kanaele + k] * al + BG[k] * (1 - al));
}
schreibeRgb(ICON, q.w, q.h, icon);

// 2. Startbild: Hintergrund, Icon mittig
const S = SPLASH_KANTE;
const splash = Buffer.alloc(S * S * 3);
for (let i = 0; i < S * S; i++) BG.forEach((v, k) => (splash[i * 3 + k] = v));
const x0 = (S - q.w) >> 1, y0 = (S - q.h) >> 1;
for (let y = 0; y < q.h; y++) icon.copy(splash, ((y0 + y) * S + x0) * 3, y * q.w * 3, (y + 1) * q.w * 3);
for (const d of SPLASH) schreibeRgb(d, S, S, splash);

// Selbstpruefung: zurueckgelesen ohne Alpha, Mitte gleich der Quelle
const ic = lesePng(ICON), sp = lesePng(SPLASH[0]);
const mitte = (q.h / 2) * q.w + q.w / 2;
if (ic.kanaele !== 3 || sp.kanaele !== 3) throw new Error("Alphakanal noch da");
if (ic.w !== 1024 || sp.w !== S) throw new Error("falsche Groesse");
if (!ic.px.subarray(mitte * 3, mitte * 3 + 3).equals(icon.subarray(mitte * 3, mitte * 3 + 3))) throw new Error("Icon-Mitte weicht ab");
if (!sp.px.subarray(0, 3).equals(Buffer.from(BG))) throw new Error("Startbild-Ecke nicht #1a1c1e");
console.log("geschrieben:", ICON.replace(V1, "v1"), "und", SPLASH.length, "Startbilder (RGB, ohne Alpha)");
