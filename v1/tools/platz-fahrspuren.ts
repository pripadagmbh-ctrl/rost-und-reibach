/**
 * DRAUFSICHT: FAHRSPUREN, PLÄTZE, BAGGERSTÄNDE (E-192) — als SVG, dazu eine Tabelle.
 *
 *     npx vite-node tools/platz-fahrspuren.ts -- <ziel.svg>
 *
 * Gezeichnet wird, was gerechnet wird: Bauwerke aus `fahrHindernisse`, die
 * Strecken aus `routes.ts` (Einfahrt, Abladeplatz, Lagersilos, Verladeplätze,
 * Absetzkipper, Müll-Abroller), die Halteplätze als Wagenumriss, die
 * Baggerstände mit Schwenkband (5,8 … 9,2 m) und die Müllplätze.
 *
 * Die Tabelle nennt je Platz: Ausladung der Ecken vom Sitz seines Baggerstands
 * (nah … fern) und wie nah der Baggerstand an einer FREMDEN Fahrspur steht
 * (unter 5,5 m hält dort ein Laster an, `BLOCK_RADIUS`).
 */
import { writeFileSync } from "node:fs";
import {
  ROUTE_IN_FWD,
  routeApproach,
  routeInRev,
  routeOut,
  abholPlaetzeEinmal,
  bayApproach,
  bayInRev,
  bayOut,
  rangierAbsetzplatz,
  absetzAusfahrt,
  ABSETZ_HALT,
  fahrHindernisse,
  BLOCK_RADIUS,
  BED_LEN,
} from "../src/delivery/routes";
import { CONFIGS } from "../src/world/containers";
import { BAGGER_STAND, SCHWENK_INNEN, SCHWENK_AUSSEN } from "../src/world/baggerstand";
import { MUELL_PLAETZE, planeMuellwechsel, wannenRechteck } from "../src/delivery/muellwechsel";
import { fahrzeugUmriss, umrissEcken } from "../src/delivery/umriss";

const ziel = process.argv.slice(2).find((a) => a.endsWith(".svg")) ?? "platz-fahrspuren.svg";
const titel = process.argv.slice(2).find((a) => a.startsWith("titel=") )?.slice(6) ?? "";

type Strecke = { name: string; farbe: string; punkte: Array<[number, number]> };
const strecken: Strecke[] = [];
const add = (name: string, farbe: string, ...teile: Array<Array<[number, number]>>): void => {
  for (const p of teile) strecken.push({ name, farbe, punkte: p });
};
add("Einfahrt", "#555", ROUTE_IN_FWD);
add("Abladeplatz", "#d07000", routeApproach(), routeInRev(), routeOut());
const silos = CONFIGS.filter((c) => c.lager === true);
for (const c of silos) add(`Silo ${c.label}`, "#2a7d2a", bayApproach(c), bayInRev(c), bayOut(c));
const plaetze = abholPlaetzeEinmal();
for (const p of plaetze) if (p.ziel) add(p.name, "#7a3cc0", p.anfahrt, p.rueckweg, p.ausfahrt);
const abs = rangierAbsetzplatz();
add("Absetzkipper", "#b03060", abs.anfahrt, abs.rueckweg, absetzAusfahrt());
const muellPlan = planeMuellwechsel(MUELL_PLAETZE[0]!);
if (muellPlan) {
  add("Müll-Abroller", "#1f4e8c", muellPlan.hin.anfahrt, muellPlan.hin.rueckweg, muellPlan.ausfahrt);
  // Bis E-192 fuhr der Abroller vom leeren zum vollen um (`zumVollen`) — für das Vorher-Bild
  const um = (muellPlan as { zumVollen?: { anfahrt: Array<[number, number]>; rueckweg: Array<[number, number]> } | null }).zumVollen;
  if (um) add("Müll-Abroller", "#1f4e8c", um.anfahrt, um.rueckweg);
}

/* --- Plätze mit Baggerstand: Halt-Umriss und Stand ---------------------- */
interface Platz {
  name: string;
  stand: { x: number; z: number };
  ecken: Array<[number, number]>;
  eigene: string[];
}
const ladeplaetze: Platz[] = [];
const haltGierAus = (r: Array<[number, number]>): number => {
  const n = r.length;
  const [hx, hz] = r[n - 1]!;
  const [px, pz] = r[n - 2]!;
  return Math.atan2(px - hx, pz - hz);
};
for (const p of plaetze) {
  const b = fahrzeugUmriss({ x: p.halt[0], z: p.halt[1], rot: haltGierAus(p.rueckweg) }, BED_LEN.abholer!);
  ladeplaetze.push({ name: p.name, stand: p.stand, ecken: [0, 1, 3, 2].map((k) => umrissEcken(b)[k]!), eigene: [p.name, "Abladeplatz"] });
}
{
  const b = fahrzeugUmriss({ x: ABSETZ_HALT[0], z: ABSETZ_HALT[1], rot: haltGierAus(abs.rueckweg) }, BED_LEN.absetzer!);
  ladeplaetze.push({ name: "Absetzkipper-Halt", stand: BAGGER_STAND, ecken: [0, 1, 3, 2].map((k) => umrissEcken(b)[k]!), eigene: ["Absetzkipper"] });
}
MUELL_PLAETZE.forEach((m, i) => {
  const r = wannenRechteck(m);
  ladeplaetze.push({
    name: MUELL_PLAETZE.length > 1 ? `Müllplatz ${i === 0 ? "A" : "B"}` : "Müllplatz",
    stand: BAGGER_STAND,
    ecken: [
      [r.x - r.hw, r.z - r.hd],
      [r.x + r.hw, r.z - r.hd],
      [r.x + r.hw, r.z + r.hd],
      [r.x - r.hw, r.z + r.hd],
    ],
    eigene: ["Müll-Abroller"],
  });
});

// Zum Vergleich ein vorgeschlagener zweiter Platz: MUELL_B="x,z" (nur gezeichnet und vermessen)
if (process.env.MUELL_B) {
  const [bx, bz] = process.env.MUELL_B.split(",").map(Number) as [number, number];
  const r = wannenRechteck({ x: bx, z: bz, gier: 0 });
  ladeplaetze.push({
    name: "Variante B",
    stand: BAGGER_STAND,
    ecken: [
      [r.x - r.hw, r.z - r.hd],
      [r.x + r.hw, r.z - r.hd],
      [r.x + r.hw, r.z + r.hd],
      [r.x - r.hw, r.z + r.hd],
    ],
    eigene: ["Müll-Abroller"],
  });
}

const abstandZuStrecke = (x: number, z: number, r: Array<[number, number]>): number => {
  let b = Infinity;
  for (let i = 0; i < r.length - 1; i++) {
    const [ax, az] = r[i]!;
    const [bx, bz] = r[i + 1]!;
    const dx = bx - ax;
    const dz = bz - az;
    const L = dx * dx + dz * dz || 1e-9;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L));
    b = Math.min(b, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return b;
};
console.log("Platz | Ausladung nah … fern (m) | nächste fremde Fahrspur vom Baggerstand (m)");
for (const p of ladeplaetze) {
  const d = p.ecken.map(([x, z]) => Math.hypot(x - p.stand.x, z - p.stand.z));
  let nah = Infinity;
  let wer = "";
  for (const s of strecken) {
    if (p.eigene.some((e) => s.name.startsWith(e) || e.startsWith(s.name))) continue;
    const a = abstandZuStrecke(p.stand.x, p.stand.z, s.punkte);
    if (a < nah) {
      nah = a;
      wer = s.name;
    }
  }
  console.log(
    `${p.name} | ${Math.min(...d).toFixed(2)} … ${Math.max(...d).toFixed(2)} | ${nah.toFixed(1)} (${wer})${nah < BLOCK_RADIUS ? " — IM TASTBEREICH" : ""}`
  );
}

/* --- Zeichnen -------------------------------------------------------------- */
const X0 = -48;
const X1 = 26;
const Z0 = -34;
const Z1 = 44;
const S = 14; // Pixel je Meter
const W = (X1 - X0) * S;
const H = (Z1 - Z0) * S;
// Blick von oben wie im Spiel hinter dem Bagger: Norden (+z) oben, +x LINKS
const px = (x: number): number => (X1 - x) * S;
const pz = (z: number): number => (Z1 - z) * S;
const teile: string[] = [`<rect width="${W}" height="${H}" fill="#f4f1ea"/>`];
for (const o of fahrHindernisse()) {
  const muell = o.label.startsWith("MUELL");
  teile.push(
    `<rect x="${px(o.x + o.hw)}" y="${pz(o.z + o.hd)}" width="${2 * o.hw * S}" height="${2 * o.hd * S}" ` +
      `fill="${muell ? "#9fb8e0" : "#b9b4aa"}" stroke="#777" stroke-width="1"><title>${o.label}</title></rect>`
  );
}
// Schwenkband am Hauptstand und an jedem Verladestand
for (const st of [BAGGER_STAND, ...plaetze.filter((p) => p.ziel).map((p) => p.stand)]) {
  teile.push(
    `<circle cx="${px(st.x)}" cy="${pz(st.z)}" r="${SCHWENK_AUSSEN * S}" fill="none" stroke="#6a6" stroke-dasharray="6 4"/>`,
    `<circle cx="${px(st.x)}" cy="${pz(st.z)}" r="${SCHWENK_INNEN * S}" fill="none" stroke="#6a6" stroke-dasharray="2 4"/>`,
    `<circle cx="${px(st.x)}" cy="${pz(st.z)}" r="${1.6 * S}" fill="#3f8f3f" opacity="0.8"/>`,
    `<circle cx="${px(st.x)}" cy="${pz(st.z)}" r="${BLOCK_RADIUS * S}" fill="none" stroke="#c33" stroke-width="1" opacity="0.5"/>`
  );
}
// Fahrlinie des Baggers nach vorn (3,0 m breit)
teile.push(
  `<rect x="${px(BAGGER_STAND.x + 1.5)}" y="${pz(BAGGER_STAND.z + 12)}" width="${3 * S}" height="${12 * S}" fill="#3f8f3f" opacity="0.12"/>`
);
for (const s of strecken) {
  const d = s.punkte.map(([x, z], i) => `${i ? "L" : "M"}${px(x).toFixed(1)},${pz(z).toFixed(1)}`).join(" ");
  teile.push(`<path d="${d}" fill="none" stroke="${s.farbe}" stroke-width="2" opacity="0.75"><title>${s.name}</title></path>`);
}
for (const p of ladeplaetze) {
  const d = p.ecken.map(([x, z], i) => `${i ? "L" : "M"}${px(x).toFixed(1)},${pz(z).toFixed(1)}`).join(" ") + " Z";
  const muell = p.name.startsWith("Müll") || p.name.startsWith("Variante");
  teile.push(
    `<path d="${d}" fill="${muell ? "#1f4e8c" : "#7a3cc0"}" opacity="${muell ? 0.55 : 0.25}" stroke="#222"><title>${p.name}</title></path>`
  );
  const cx = p.ecken.reduce((a, e) => a + e[0], 0) / p.ecken.length;
  const cz = p.ecken.reduce((a, e) => a + e[1], 0) / p.ecken.length;
  teile.push(`<text x="${px(cx)}" y="${pz(cz)}" font-size="11" text-anchor="middle" font-family="sans-serif">${p.name.replace("Verladeplatz ", "")}</text>`);
}
const legende = [
  ["#555", "Einfahrt"],
  ["#d07000", "Abladeplatz"],
  ["#2a7d2a", "Sortenreine Kipper → Lagersilo"],
  ["#7a3cc0", "Abholer → Verladeplatz am Silo"],
  ["#b03060", "Absetzkipper"],
  ["#1f4e8c", "Müll-Abroller / Müllplätze A, B"],
  ["#c33", "Baggerstand: 5,5 m Tastbereich der Laster"],
  ["#6a6", "Schwenkband 5,8 … 9,2 m"],
];
legende.forEach(([f, t], i) => {
  teile.push(`<rect x="12" y="${14 + i * 18}" width="22" height="6" fill="${f}"/>`);
  teile.push(`<text x="40" y="${21 + i * 18}" font-size="13" font-family="sans-serif">${t}</text>`);
});
if (titel) teile.push(`<text x="${W - 12}" y="24" font-size="18" text-anchor="end" font-family="sans-serif">${titel}</text>`);
teile.push(`<text x="${W - 12}" y="${H - 10}" font-size="12" text-anchor="end" font-family="sans-serif">Norden oben, +x links (Blick wie hinter dem Bagger) · 1 m = ${S} px</text>`);
writeFileSync(ziel, `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${teile.join("")}</svg>\n`);
console.log(ziel, W, "x", H);
