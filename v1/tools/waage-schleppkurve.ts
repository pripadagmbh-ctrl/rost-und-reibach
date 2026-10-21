/**
 * SCHLEPPKURVEN NACH DER WAAGE UND DIE WARTEPLÄTZE (E-193) — als SVG.
 *
 *     npx vite-node tools/waage-schleppkurve.ts -- <ziel.svg> titel=…
 *
 * Gezeichnet wird, was gerechnet wird: Jede Fahrt aus `test/strecken.ts`
 * (außer Ein- und Ausparken selbst) wird mit dem Einspurmodell aus
 * `test/knicklauf.ts` abgefahren; jede zehnte Lage als Umriss (geprüft wird jede). Die
 * Warteplätze sind der Umriss des längsten Wagens (Kipper) dort, wo seine
 * Parkfahrt endet. Rot: Wo eine fremde Fahrt durch einen besetzten
 * Warteplatz streicht — dort stand vor E-193 einer im Weg.
 */
import { writeFileSync } from "node:fs";
import { fahrHindernisse } from "../src/delivery/routes";
import { boxUeberlappung, umrissEcken } from "../src/delivery/umriss";
import { fahrplaene } from "../test/strecken";
import { fahre, figurenFuer } from "../test/knicklauf";

const ziel = process.argv.slice(2).find((a) => a.endsWith(".svg")) ?? "waage-schleppkurve.svg";
const titel = process.argv.slice(2).find((a) => a.startsWith("titel="))?.slice(6) ?? "";

type Box = ReturnType<typeof figurenFuer>[number];
const plaene = fahrplaene();
const plaetze: Array<{ name: string; box: Box }> = [];
for (const f of plaene) {
  const m = /^kipper zum Abladeplatz zum Warteplatz (\d)$/.exec(f.name);
  if (!m) continue;
  const s = fahre(f).spur.at(-1)!;
  plaetze.push({ name: `Warteplatz ${m[1]}`, box: figurenFuer("kipper", s)[0]! });
}

const X0 = -40;
const X1 = 12;
const Z0 = -6;
const Z1 = 44;
const S = 16;
const W = (X1 - X0) * S;
const H = (Z1 - Z0) * S;
const px = (x: number): number => (X1 - x) * S;
const pz = (z: number): number => (Z1 - z) * S;
const poly = (b: Box): string =>
  [0, 1, 3, 2].map((k) => umrissEcken(b)[k]!).map(([x, z], i) => `${i ? "L" : "M"}${px(x).toFixed(1)},${pz(z).toFixed(1)}`).join(" ") + " Z";

const teile: string[] = [`<rect width="${W}" height="${H}" fill="#f4f1ea"/>`];
for (const o of fahrHindernisse()) {
  teile.push(
    `<rect x="${px(o.x + o.hw)}" y="${pz(o.z + o.hd)}" width="${2 * o.hw * S}" height="${2 * o.hd * S}" fill="#b9b4aa" stroke="#777"><title>${o.label}</title></rect>`
  );
}
const treffer = new Map<string, { tiefe: number; fahrten: Set<string> }>();
for (const f of plaene) {
  if (/Warteplatz|Ansteher|Parken/.test(f.name)) continue;
  const spur = fahre(f).spur;
  for (let i = 0; i < spur.length; i++) {
    for (const b of figurenFuer(f.kind, spur[i]!)) {
      let rot = false;
      for (const p of plaetze) {
        const d = boxUeberlappung(b, p.box);
        if (d <= 0) continue;
        rot = true;
        const t = treffer.get(p.name) ?? { tiefe: 0, fahrten: new Set() };
        t.tiefe = Math.max(t.tiefe, d);
        t.fahrten.add(f.name.replace(/ zum Abladeplatz$/, ""));
        treffer.set(p.name, t);
      }
      if (i % 10 === 0 || rot) teile.push(`<path d="${poly(b)}" fill="none" stroke="${rot ? "#d22" : "#d07000"}" stroke-width="${rot ? 1.4 : 0.6}" opacity="${rot ? 0.9 : 0.25}"/>`);
    }
  }
}
for (const p of plaetze) {
  const t = treffer.get(p.name);
  teile.push(`<path d="${poly(p.box)}" fill="${t ? "#d22" : "#2a7d2a"}" opacity="0.45" stroke="#222" stroke-width="2"/>`);
  teile.push(
    `<text x="${px(p.box.x)}" y="${pz(p.box.z)}" font-size="13" text-anchor="middle" font-family="sans-serif" font-weight="bold">${p.name.replace("Warteplatz ", "W")}</text>`
  );
  console.log(
    `${p.name} (${p.box.x.toFixed(1)} | ${p.box.z.toFixed(1)}): ${t ? `${t.tiefe.toFixed(2)} m in ${[...t.fahrten].join(", ")}` : "frei"}`
  );
}
const legende: Array<[string, string]> = [
  ["#d07000", "Schleppkurve: Umriss jeder Fahrt ab der Waage"],
  ["#d22", "Fahrt streift einen besetzten Warteplatz"],
  ["#2a7d2a", "Warteplatz frei von allen Fahrten"],
  ["#b9b4aa", "Bauwerke (Waage, Büro, Mauern, Boxen)"],
];
legende.forEach(([f, t], i) => {
  teile.push(`<rect x="12" y="${14 + i * 20}" width="22" height="8" fill="${f}"/>`);
  teile.push(`<text x="40" y="${22 + i * 20}" font-size="14" font-family="sans-serif">${t}</text>`);
});
if (titel) teile.push(`<text x="${W - 12}" y="26" font-size="20" text-anchor="end" font-family="sans-serif">${titel}</text>`);
teile.push(`<text x="${W - 12}" y="${H - 10}" font-size="12" text-anchor="end" font-family="sans-serif">Norden oben, +x links (Blick wie hinter dem Bagger) · 1 m = ${S} px</text>`);
writeFileSync(ziel, `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${teile.join("")}</svg>\n`);
console.log(ziel, W, "x", H);
