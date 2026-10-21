/**
 * SCHICHTBETRIEB: DER ARBEITSKREIS UM DEN BAGGER — Bilder und Prüfung.
 *
 *     npx vite-node tools/schicht-platz.ts -- <zielordner>
 *
 * Schreibt drei Draufsichten als SVG (vorher, Variante A, Variante B) und
 * druckt je Variante eine Prüftabelle. Gezeichnet und gerechnet wird mit
 * denselben Bausteinen wie im Spiel: Bauwerke aus `fahrHindernisse`,
 * Rangierzüge aus `planeRangierzugOderNull` (E-140), Ausfahrt aus `zumTor`,
 * Umrisse aus `umriss.ts`, Schwenkband aus `baggerstand.ts`.
 *
 * Geprüft wird, was die Fahrspur-Wächter (E-192/E-193) verlangen:
 *   - jeder neue Halt hat einen freien Rangierzug (0,3 m Rand, Bauwerke),
 *   - keine Fahrt streift einen Platz, auf dem ständig etwas steht
 *     (Verlader, Müll-Container, Annahme-Haufen) — Laster gegen Laster,
 *   - die Ladefläche des Verladers liegt im Schwenkband 5,8 … 9,2 m,
 *   - keine Fahrspur kommt dem Baggerstand näher als der Tastbereich 5,5 m,
 *   - der Bagger kommt aus dem Kreis heraus (Ausfahrt zu den Lagersilos).
 *
 * Nur ein Werkzeug für das Konzept (Etappe 1): Es ändert nichts am Spiel.
 * Die Lagen der Varianten stehen unten als Vorschlag (SW) und wandern in
 * Etappe 2 in `routes.ts` / `containers.ts`, wenn Patrick gewählt hat.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import {
  WAAGE_HALT,
  VERTEILER,
  BED_LEN,
  BLOCK_RADIUS,
  ABLADE_SPUR_X,
  ABLADE_HALT_Z,
  ABKIPP_ZONE,
  fahrHindernisse,
  planHindernisse,
  rangierAbladeplatz,
  rangierAbsetzplatz,
  absetzAusfahrt,
  abholPlaetzeEinmal,
  bayApproach,
  bayInRev,
  bayOut,
  PARK_SLOTS,
  parkAusfahrt,
  anfahrtVomPlatz,
  routeOut,
  zumTor,
  VERLADER_VORN,
} from "../src/delivery/routes";
import { planeRangierzugOderNull, type Rangierzug } from "../src/delivery/rangierplan";
import {
  boxUeberlappung,
  fahrzeugUmriss,
  tiefsteDurchdringung,
  umrissEcken,
  umrisseEntlang,
  type Rechteck,
} from "../src/delivery/umriss";
import { CONFIGS } from "../src/world/containers";
import { BAGGER_STAND, SCHWENK_INNEN, SCHWENK_AUSSEN } from "../src/world/baggerstand";
import { MUELL_PLAETZE, planeMuellwechsel, wannenRechteck } from "../src/delivery/muellwechsel";
import { UNTERWAGEN_HALB_B } from "../src/excavator/unterwagenParts";

type Box = ReturnType<typeof fahrzeugUmriss>;

const ziel = process.argv.slice(2).find((a) => !a.startsWith("-")) ?? ".";
mkdirSync(ziel, { recursive: true });

const S = BAGGER_STAND;
type P = [number, number];
const VORLAUF: P[] = [WAAGE_HALT, VERTEILER, [-21, 10], [-12, 4]];
const ABHOLER = BED_LEN.abholer!;
const KIPPER = BED_LEN.kipper!;

/** Schwenkwinkel vom Sitz: 0 = geradeaus (Norden), + = links (+x). */
const az = (x: number, z: number): number => (Math.atan2(x - S.x, z - S.z) * 180) / Math.PI;
const r = (x: number, z: number): number => Math.hypot(x - S.x, z - S.z);
const box = (x: number, z: number, gier: number, bed: number): Box => fahrzeugUmriss({ x, z, rot: gier }, bed);
const aabb = (b: Box): Rechteck => {
  const e = umrissEcken(b);
  const xs = e.map((p) => p[0]);
  const zs = e.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const z0 = Math.min(...zs);
  const z1 = Math.max(...zs);
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, hw: (x1 - x0) / 2, hd: (z1 - z0) / 2 };
};
/** Ecken der Ladefläche (nicht des ganzen Wagens) an einem Halt. */
const ladeEcken = (x: number, z: number, gier: number, bed: number, halbB = 1.27): P[] =>
  umrissEcken({ x, z, hw: halbB, hd: bed / 2, rot: gier });
const ohneMuell = (l: Rechteck[]): Rechteck[] =>
  l.filter((o) => !("label" in o) || !String((o as { label: string }).label).startsWith("MUELL"));

/* ------------------------------------------------------------ Varianten -- */

interface Ziel {
  name: string;
  x: number;
  z: number;
}
interface Fahrt {
  name: string;
  farbe: string;
  bed: number;
  zug: Rangierzug | null;
  ausfahrt: P[];
}
interface Stehend {
  name: string;
  farbe: string;
  /** Umriss, der dauernd (oder während der Arbeit) dort steht */
  umriss: Box | Rechteck;
}
interface Variante {
  datei: string;
  titel: string;
  untertitel: string;
  fahrten: Fahrt[];
  stehend: Stehend[];
  /** Zonen auf dem Boden (Haufen, Boxen) — nur gezeichnet */
  zonen: Array<{ name: string; farbe: string; x: number; z: number; hw: number; hd: number; rund?: boolean }>;
  ziele: Ziel[];
  /** Ladeflächen, deren Ecken im Band liegen sollen */
  ladeflaechen: Array<{ name: string; ecken: P[] }>;
  /** Weg des Baggers aus dem Kreis heraus (Polylinie der Mitte) */
  baggerWeg: P[];
  kante?: Rechteck;
}

// Annahme heute: der Abladeplatz Ost (E-029/E-033), Haufen hinter dem Kipper
const ANNAHME_OST: Ziel = { name: "ANNAHME", x: ABKIPP_ZONE[0], z: ABKIPP_ZONE[1] - 0.6 };
const halde = (id: string): { x: number; z: number; hw: number; hd: number } => {
  const c = CONFIGS.find((k) => k.id === id)!;
  return { x: c.x, z: c.z, hw: c.size[0] / 2, hd: c.size[1] / 2 };
};
const STAHL = halde("c_steel");
const MISCH = halde("c_mixed");
const BUNT = halde("r_bunt");
// Zielpunkt einer Halde: 1 m hinter ihrer Vorderkante (dort wird abgeworfen)
const vorn = (h: { x: number; z: number; hd: number }): { x: number; z: number } => ({ x: h.x, z: h.z + h.hd - 1 });
const MUELL0 = MUELL_PLAETZE[0]!;

/* --- VORHER: Stand 3809c63 ------------------------------------------------ */
function vorher(): Variante {
  const abl = rangierAbladeplatz();
  const abs = rangierAbsetzplatz();
  const m = planeMuellwechsel(MUELL0);
  return {
    datei: "vorher.svg",
    titel: "Vorher (Stand 3809c63): ein Laster zur Zeit am Bagger",
    untertitel: "Anlieferer und Abholer teilen sich den Abladeplatz Ost — nie beide gleichzeitig",
    fahrten: [
      { name: "Anlieferer / Abholer → Abladeplatz", farbe: "#d07000", bed: KIPPER, zug: abl, ausfahrt: routeOut() },
      { name: "Absetzkipper", farbe: "#b03060", bed: BED_LEN.absetzer!, zug: abs, ausfahrt: [] },
      ...(m ? [{ name: "Müll-Abroller", farbe: "#1f4e8c", bed: ABHOLER, zug: m.hin, ausfahrt: m.ausfahrt }] : []),
    ],
    stehend: [{ name: "MÜLL", farbe: "#1f4e8c", umriss: wannenRechteck(MUELL0) }],
    zonen: [
      { name: "MISCH", farbe: "#8a8070", ...MISCH },
      { name: "STAHL", farbe: "#6e5a4e", ...STAHL },
      { name: "BUNT+VA", farbe: "#c7622b", ...BUNT },
      { name: "Kipphaufen", farbe: "#d07000", x: ABKIPP_ZONE[0], z: ABKIPP_ZONE[1] - 0.6, hw: 2.4, hd: 2.4, rund: true },
    ],
    ziele: [
      ANNAHME_OST,
      { name: "STAHL", ...vorn(STAHL) },
      { name: "MISCH", ...vorn(MISCH) },
      { name: "BUNT+VA", x: BUNT.x + 1.2, z: BUNT.z },
      { name: "MÜLL", x: MUELL0.x, z: MUELL0.z },
    ],
    ladeflaechen: [{ name: "Abladeplatz (Pritsche/Abholer)", ecken: ladeEcken(ABLADE_SPUR_X, ABLADE_HALT_Z, 0, ABHOLER) }],
    baggerWeg: [[S.x, S.z], [S.x, -8], [-12, -8]],
  };
}

/*
 * --- VARIANTE A: „Kreis in der Ecke" --------------------------------------
 * Annahme bleibt am Abladeplatz Ost (gemessen seit E-029). Der Verlader
 * (Abroller 34 m³) steht QUER vor dem Bagger, Kabine nach Osten — er setzt
 * von Osten nach Westen zurück. Dafür zieht der MÜLL in der Schicht in die
 * rechte Halde (heute MISCHSCHROTT); Mischschrott geht ja auf den Verlader.
 */
/*
 * Gefunden mit einer Suche über Winkel 25° rechts … 35° links und 6,6 … 7,8 m
 * Abstand, beide Kabinenrichtungen, gegen den echten Rangierplaner: Nur acht
 * Lagen haben einen freien Zug, alle mit der Kabine nach Westen. Mit dem
 * MÜLL-Container an seinem Platz (E-192) hat KEINE einen — er steht genau dort,
 * wo die Kabine hinmuss. Gewählt: 10° links, 7,2 m — alle vier Ecken der
 * Ladefläche 6,52 … 8,89 m vom Sitz, der Wagen 5,65 m vom Sitz, also außerhalb
 * des 5,5-m-Tastbereichs.
 */
// Seit E-201 gebaut: die Lage steht in `routes.ts` (`VERLADER_VORN`), hier nur gelesen
const A_VERLADER = VERLADER_VORN;
function varianteA(): Variante {
  const kipperAmPlatz = box(ABLADE_SPUR_X, ABLADE_HALT_Z, 0, KIPPER);
  const verladerAmPlatz = box(A_VERLADER.x, A_VERLADER.z, A_VERLADER.gier, ABHOLER);
  const haufen: Rechteck = { x: ANNAHME_OST.x, z: ANNAHME_OST.z, hw: 2.4, hd: 2.4 };
  const grund = ohneMuell(planHindernisse());
  const verlader = planeRangierzugOderNull(
    VORLAUF,
    [A_VERLADER.x, A_VERLADER.z],
    A_VERLADER.gier,
    [...grund, aabb(kipperAmPlatz), haufen],
    true,
    undefined,
    ABHOLER
  );
  // Die Annahme fährt ihre heutige Strecke — geprüft wird nur, ob sie den Verlader streift
  const annahme = rangierAbladeplatz();
  const vAus: P[] = [
    [A_VERLADER.x, A_VERLADER.z],
    [A_VERLADER.x + Math.sin(A_VERLADER.gier), A_VERLADER.z + Math.cos(A_VERLADER.gier)],
  ];
  return {
    datei: "variante-A.svg",
    titel: "Variante A: Kreis in der Ecke (Empfehlung)",
    untertitel: "Annahme Ost wie heute · Verlader quer vorn · MÜLL in die rechte Halde",
    fahrten: [
      { name: "Anlieferer → Annahme", farbe: "#d07000", bed: KIPPER, zug: annahme, ausfahrt: routeOut() },
      { name: "Verlader (Abroller 34 m³)", farbe: "#7a3cc0", bed: ABHOLER, zug: verlader, ausfahrt: zumTor(vAus) },
    ],
    stehend: [
      { name: "VERLADER", farbe: "#7a3cc0", umriss: verladerAmPlatz },
      { name: "Annahme-Haufen", farbe: "#d07000", umriss: haufen },
    ],
    zonen: [
      { name: "MÜLL", farbe: "#1f4e8c", ...MISCH },
      { name: "STAHL", farbe: "#6e5a4e", ...STAHL },
      { name: "BUNT+VA", farbe: "#c7622b", ...BUNT },
      { name: "Annahme MISCH", farbe: "#d07000", x: haufen.x, z: haufen.z, hw: 2.4, hd: 2.4, rund: true },
    ],
    ziele: [
      ANNAHME_OST,
      { name: "VERLADER", x: A_VERLADER.x, z: A_VERLADER.z },
      { name: "STAHL", ...vorn(STAHL) },
      { name: "MÜLL", ...vorn(MISCH) },
      { name: "BUNT+VA", x: BUNT.x + 1.2, z: BUNT.z },
    ],
    ladeflaechen: [
      { name: "Verlader", ecken: ladeEcken(A_VERLADER.x, A_VERLADER.z, A_VERLADER.gier, ABHOLER) },
      { name: "Annahme (Pritsche)", ecken: ladeEcken(ABLADE_SPUR_X, ABLADE_HALT_Z, 0, BED_LEN.pritsche!) },
    ],
    // Hinaus nur über die Ostspur, solange dort kein Anlieferer steht
    baggerWeg: [[S.x, S.z], [S.x + 2.5, -20.2], [ABLADE_SPUR_X, -19.0], [ABLADE_SPUR_X, -6], [-12, -6]],
  };
}

/*
 * --- VARIANTE B: „Haufen vorn" --------------------------------------------
 * Die Anlieferer setzen von Norden auf den Bagger zu und kippen über eine
 * niedrige Abkippkante (Betonlego, 0,8 m) — der Haufen liegt vorn mittig.
 * Der Verlader steht am heutigen Abladeplatz Ost (dort hält heute schon der
 * Abholer, E-177). MÜLL bleibt, wo er ist.
 */
const B_KANTE: Rechteck = { x: 0.6, z: -12.7, hw: 2.4, hd: 0.3 }; // SW
const B_HALT: { x: number; z: number } = { x: 0.6, z: -12.7 + 0.3 + 0.14 + KIPPER / 2 + 0.2 }; // Heck 0,2 m vor der Kante
function varianteB(): Variante {
  const verladerAmPlatz = box(ABLADE_SPUR_X, ABLADE_HALT_Z, 0, ABHOLER);
  const kipperAmPlatz = box(B_HALT.x, B_HALT.z, 0, KIPPER);
  const haufen: Rechteck = { x: 0.6, z: -15.2, hw: 2.2, hd: 2.2 };
  const grund = planHindernisse();
  const annahme = planeRangierzugOderNull(
    VORLAUF,
    [B_HALT.x, B_HALT.z],
    0,
    [...grund, aabb(verladerAmPlatz), B_KANTE],
    true,
    undefined,
    KIPPER
  );
  /*
   * Die heutige Abholer-Strecke (E-177) dreht vorn im Bogen — mitten durch Kante
   * und Haufen. Neu geplant gegen Kante und Haufen gibt es einen Zug (66 m
   * Umweg); steht dabei ein Kipper an der Kante, gibt es KEINEN — der Verlader
   * muss warten, bis der Kipper weg ist.
   */
  const verlader = planeRangierzugOderNull(VORLAUF, [ABLADE_SPUR_X, ABLADE_HALT_Z], 0, [...grund, B_KANTE, haufen], true, undefined, ABHOLER);
  return {
    datei: "variante-B.svg",
    titel: "Variante B: Haufen vorn mittig",
    untertitel: "Abkippkante vor dem Bagger · Verlader am Abladeplatz Ost · MÜLL bleibt",
    fahrten: [
      { name: "Anlieferer → Abkippkante", farbe: "#d07000", bed: KIPPER, zug: annahme, ausfahrt: zumTor([[B_HALT.x, B_HALT.z], [B_HALT.x, B_HALT.z + 1]]) },
      { name: "Verlader (Abroller 34 m³)", farbe: "#7a3cc0", bed: ABHOLER, zug: verlader, ausfahrt: routeOut() },
    ],
    stehend: [
      { name: "VERLADER", farbe: "#7a3cc0", umriss: verladerAmPlatz },
      { name: "MÜLL", farbe: "#1f4e8c", umriss: wannenRechteck(MUELL0) },
      { name: "Haufen", farbe: "#d07000", umriss: haufen },
      { name: "Abkippkante", farbe: "#555", umriss: B_KANTE },
      { name: "Kipper an der Kante", farbe: "#d07000", umriss: kipperAmPlatz },
    ],
    zonen: [
      { name: "MISCH (Puffer)", farbe: "#8a8070", ...MISCH },
      { name: "STAHL", farbe: "#6e5a4e", ...STAHL },
      { name: "BUNT+VA", farbe: "#c7622b", ...BUNT },
      { name: "Annahme MISCH", farbe: "#d07000", x: haufen.x, z: haufen.z, hw: 2.2, hd: 2.2, rund: true },
    ],
    ziele: [
      { name: "ANNAHME", x: haufen.x, z: haufen.z },
      { name: "VERLADER", x: ABLADE_SPUR_X, z: ABLADE_HALT_Z },
      { name: "STAHL", ...vorn(STAHL) },
      { name: "MISCH", ...vorn(MISCH) },
      { name: "BUNT+VA", x: BUNT.x + 1.2, z: BUNT.z },
      { name: "MÜLL", x: MUELL0.x, z: MUELL0.z },
    ],
    ladeflaechen: [{ name: "Verlader", ecken: ladeEcken(ABLADE_SPUR_X, ABLADE_HALT_Z, 0, ABHOLER) }],
    baggerWeg: [[S.x, S.z], [S.x, -8], [-12, -8]],
    kante: B_KANTE,
  };
}

/* ------------------------------------------------------------- Prüfen -- */

const abstandZuStrecke = (x: number, z: number, rt: P[]): number => {
  let b = Infinity;
  for (let i = 0; i < rt.length - 1; i++) {
    const [ax, az2] = rt[i]!;
    const [bx, bz] = rt[i + 1]!;
    const dx = bx - ax;
    const dz = bz - az2;
    const L = dx * dx + dz * dz || 1e-9;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az2) * dz) / L));
    b = Math.min(b, Math.hypot(x - ax - dx * t, z - az2 - dz * t));
  }
  return b;
};
const alsBox = (u: Box | Rechteck): Box => ("rot" in u ? (u as Box) : { ...u, rot: 0 });

function pruefe(v: Variante): string[] {
  const out: string[] = [`## ${v.titel}`];
  for (const f of v.fahrten) {
    if (!f.zug) {
      out.push(`- ${f.name}: KEIN freier Rangierzug`);
      continue;
    }
    const wege: Array<[string, P[], boolean]> = [
      ["Anfahrt", f.zug.anfahrt, false],
      ["Rückweg", f.zug.rueckweg, true],
      ["Ausfahrt", f.ausfahrt, false],
    ];
    let bau = 0;
    const streift: string[] = [];
    let nahBagger = Infinity;
    for (const [teil, w, rev] of wege) {
      if (w.length < 2) continue;
      const umr = umrisseEntlang(w, f.bed, rev);
      bau = Math.max(bau, tiefsteDurchdringung(umr, ohneMuell(fahrHindernisse()).filter((o) => (o as { label?: string }).label !== "Baggerstand")));
      for (const st of v.stehend) {
        if (st.name === "VERLADER" && f.name.startsWith("Verlader")) continue;
        // Der Anlieferer kippt auf seinen Haufen — der Haufen ist sein Ziel, kein Hindernis (WORK_ZONES)
        if ((st.name.includes("aufen") || st.name.startsWith("Kipper")) && f.name.startsWith("Anlieferer")) continue;
        const t = Math.max(...umr.map((u) => boxUeberlappung(u, alsBox(st.umriss))));
        if (t > 0.01) streift.push(`${teil} streift ${st.name} (${t.toFixed(2)} m)`);
      }
      nahBagger = Math.min(nahBagger, abstandZuStrecke(S.x, S.z, w));
    }
    out.push(
      `- ${f.name}: Rangierzug „${f.zug.wahl}" · Bauwerke ${bau.toFixed(2)} m · Spur ab Baggerstand ${nahBagger.toFixed(1)} m` +
        `${nahBagger < BLOCK_RADIUS ? " (IM TASTBEREICH)" : ""}` +
        (streift.length ? ` · ${streift.join("; ")}` : " · streift nichts, was dauernd steht")
    );
  }
  for (const l of v.ladeflaechen) {
    const d = l.ecken.map(([x, z]) => r(x, z));
    const ok = d.every((x) => x >= SCHWENK_INNEN - 0.05 && x <= SCHWENK_AUSSEN + 0.05);
    out.push(`- Ladefläche ${l.name}: Ecken ${d.map((x) => x.toFixed(2)).join(" · ")} m ${ok ? "— alle im Band" : "— NICHT alle im Band"}`);
  }
  for (const z of v.ziele) out.push(`- Ziel ${z.name}: ${r(z.x, z.z).toFixed(1)} m vom Sitz, Schwenk ${az(z.x, z.z).toFixed(0)}°`);
  const a = v.ziele[0]!;
  const vom = v.ziele.slice(1).map((z) => {
    let d = Math.abs(az(z.x, z.z) - az(a.x, a.z));
    if (d > 180) d = 360 - d;
    return `${z.name} ${d.toFixed(0)}°`;
  });
  out.push(`- Schwenk ab ${a.name}: ${vom.join(" · ")}`);
  // Bagger-Ausfahrt: 1,5 m halbe Breite + 0,3 m Rand entlang des Wegs
  let block = 0;
  const hind = ohneMuell(fahrHindernisse()).filter((o) => (o as { label?: string }).label !== "Baggerstand");
  const fest: Rechteck[] = [...hind, ...(v.kante ? [v.kante] : [])];
  const stehen = v.stehend.filter((s) => !s.name.includes("aufen") && !s.name.startsWith("Kipper"));
  for (let i = 0; i < v.baggerWeg.length - 1; i++) {
    const [x0, z0] = v.baggerWeg[i]!;
    const [x1, z1] = v.baggerWeg[i + 1]!;
    const L = Math.hypot(x1 - x0, z1 - z0);
    const b: Box = { x: (x0 + x1) / 2, z: (z0 + z1) / 2, hw: UNTERWAGEN_HALB_B + 0.3, hd: L / 2, rot: Math.atan2(x1 - x0, z1 - z0) };
    block = Math.max(block, tiefsteDurchdringung([b], fest));
    for (const s of stehen) block = Math.max(block, boxUeberlappung(b, alsBox(s.umriss)));
  }
  out.push(`- Bagger hinaus zu den Silos: ${block > 0.01 ? `VERSPERRT (${block.toFixed(2)} m)` : "frei"}`);
  return out;
}

/* ------------------------------------------------------------ Zeichnen -- */

const X0 = -14;
const X1 = 12;
const Z0 = -37;
const Z1 = 2;
const PX = 26; // Pixel je Meter
const W = (X1 - X0) * PX;
const H = (Z1 - Z0) * PX + 150;
// Norden oben, +x LINKS — wie hinter dem Bagger (alle Platzbilder seit E-122)
const px = (x: number): number => (X1 - x) * PX;
const pz = (z: number): number => (Z1 - z) * PX;
const pfad = (p: P[]): string => p.map(([x, z], i) => `${i ? "L" : "M"}${px(x).toFixed(1)},${pz(z).toFixed(1)}`).join(" ");
const viereck = (e: P[]): string => pfad([e[0]!, e[1]!, e[3]!, e[2]!]) + " Z";
const txt = (x: number, y: number, t: string, gr = 13, extra = ""): string =>
  `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${gr}" font-family="sans-serif" text-anchor="middle" ${extra}>${t}</text>`;

function zeichne(v: Variante): void {
  const t: string[] = [
    `<rect width="${W}" height="${H}" fill="#f4f1ea"/>`,
    `<clipPath id="k"><rect width="${W}" height="${(Z1 - Z0) * PX}"/></clipPath>`,
    `<g clip-path="url(#k)">`,
  ];
  // Schwenkband
  t.push(
    `<circle cx="${px(S.x)}" cy="${pz(S.z)}" r="${SCHWENK_AUSSEN * PX}" fill="#6a6" fill-opacity="0.07" stroke="#4a4" stroke-dasharray="8 5"/>`,
    `<circle cx="${px(S.x)}" cy="${pz(S.z)}" r="${SCHWENK_INNEN * PX}" fill="#f4f1ea" stroke="#4a4" stroke-dasharray="3 5"/>`,
    `<circle cx="${px(S.x)}" cy="${pz(S.z)}" r="${BLOCK_RADIUS * PX}" fill="none" stroke="#c33" opacity="0.5"/>`
  );
  for (const z of v.zonen) {
    t.push(
      z.rund
        ? `<ellipse cx="${px(z.x)}" cy="${pz(z.z)}" rx="${z.hw * PX}" ry="${z.hd * PX}" fill="${z.farbe}" fill-opacity="0.35" stroke="${z.farbe}"/>`
        : `<rect x="${px(z.x + z.hw)}" y="${pz(z.z + z.hd)}" width="${2 * z.hw * PX}" height="${2 * z.hd * PX}" fill="${z.farbe}" fill-opacity="0.25"/>`
    );
  }
  for (const o of fahrHindernisse()) {
    if (o.label.startsWith("MUELL") || o.label === "Baggerstand") continue;
    t.push(`<rect x="${px(o.x + o.hw)}" y="${pz(o.z + o.hd)}" width="${2 * o.hw * PX}" height="${2 * o.hd * PX}" fill="#a9a398" stroke="#777"/>`);
  }
  if (v.kante) t.push(`<rect x="${px(v.kante.x + v.kante.hw)}" y="${pz(v.kante.z + v.kante.hd)}" width="${2 * v.kante.hw * PX}" height="${2 * v.kante.hd * PX}" fill="#555"/>`);
  // Bagger-Ausfahrt
  t.push(`<path d="${pfad(v.baggerWeg)}" fill="none" stroke="#3f8f3f" stroke-width="${2 * UNTERWAGEN_HALB_B * PX}" stroke-opacity="0.13" stroke-linejoin="round"/>`);
  // Fahrten
  for (const f of v.fahrten) {
    if (!f.zug) continue;
    for (const [w, d] of [
      [f.zug.anfahrt, ""],
      [f.zug.rueckweg, "7 4"],
      [f.ausfahrt, "2 4"],
    ] as Array<[P[], string]>) {
      if (w.length > 1) t.push(`<path d="${pfad(w)}" fill="none" stroke="${f.farbe}" stroke-width="3" opacity="0.8" stroke-dasharray="${d}"/>`);
    }
  }
  // Stehende Dinge
  for (const s of v.stehend) {
    if (s.name.includes("aufen")) continue;
    const e = umrissEcken(alsBox(s.umriss));
    t.push(`<path d="${viereck(e)}" fill="${s.farbe}" fill-opacity="0.55" stroke="#222"/>`);
  }
  for (const l of v.ladeflaechen) t.push(`<path d="${viereck(l.ecken)}" fill="none" stroke="#000" stroke-width="1.5" stroke-dasharray="4 3"/>`);
  // Bagger
  t.push(`<rect x="${px(S.x + 1.5)}" y="${pz(S.z + 2.2)}" width="${3 * PX}" height="${4.4 * PX}" fill="#e0a020" stroke="#222"/>`);
  t.push(txt(px(S.x), pz(S.z) + 5, "BAGGER", 12, 'font-weight="bold"'));
  // Ziele mit Schwenkwinkel
  for (const z of v.ziele) {
    const a = az(z.x, z.z);
    t.push(`<line x1="${px(S.x)}" y1="${pz(S.z)}" x2="${px(z.x)}" y2="${pz(z.z)}" stroke="#333" stroke-width="1" opacity="0.35"/>`);
    t.push(txt(px(z.x), pz(z.z) - 4, z.name, 15, 'font-weight="bold"'));
    t.push(txt(px(z.x), pz(z.z) + 13, `${a > 0 ? "+" : ""}${a.toFixed(0)}° · ${r(z.x, z.z).toFixed(1)} m`, 12));
  }
  t.push(`</g>`);
  // Kopf und Legende
  t.push(`<rect x="0" y="0" width="${W}" height="54" fill="#f4f1ea" opacity="0.9"/>`);
  t.push(`<text x="12" y="24" font-size="19" font-family="sans-serif" font-weight="bold">${v.titel}</text>`);
  t.push(`<text x="12" y="45" font-size="14" font-family="sans-serif">${v.untertitel}</text>`);
  const ly = (Z1 - Z0) * PX + 18;
  const leg: Array<[string, string]> = [
    ...v.fahrten.map((f) => [f.farbe, `${f.name}: — vorwärts · - - rückwärts · ··· Ausfahrt`] as [string, string]),
    ["#4a4", "Schwenkband 5,8 … 9,2 m (Greifen ohne Fahren)"],
    ["#c33", "5,5 m Tastbereich: hier hält jeder Laster vor dem Bagger"],
    ["#3f8f3f", "Weg des Baggers hinaus zu den Lagersilos"],
  ];
  leg.forEach(([f, s], i) => {
    t.push(`<rect x="12" y="${ly + i * 20 - 9}" width="26" height="7" fill="${f}"/>`);
    t.push(`<text x="46" y="${ly + i * 20}" font-size="13" font-family="sans-serif">${s}</text>`);
  });
  t.push(`<text x="${W - 10}" y="${H - 8}" font-size="11" text-anchor="end" font-family="sans-serif">Norden oben, links = links vom Fahrer · 1 m = ${PX} px · Winkel: 0° geradeaus, + links</text>`);
  writeFileSync(`${ziel}/${v.datei}`, `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${t.join("")}</svg>\n`);
}

/**
 * GEGENPROBE FÜR VARIANTE A: Streift irgendeine andere Fahrt des Platzes den
 * stehenden Verlader? Sortenreine Kipper in die Silos, Abholer an die Silos,
 * Absetzkipper, Warteplätze (zum Abladeplatz und hinaus). Kipper-Umriss
 * (6,0 m) für alle — der längste Wagen, auf der sicheren Seite.
 */
function gegenprobeA(): string {
  const vb = box(A_VERLADER.x, A_VERLADER.z, A_VERLADER.gier, ABHOLER);
  const fahrten: Array<[string, P[], boolean]> = [];
  for (const c of CONFIGS.filter((k) => k.lager === true)) {
    fahrten.push([`Kipper ${c.label} hin`, bayApproach(c), false], [`Kipper ${c.label} zurück`, bayInRev(c), true], [`Kipper ${c.label} raus`, bayOut(c), false]);
  }
  for (const p of abholPlaetzeEinmal()) {
    if (!p.ziel) continue;
    fahrten.push([`${p.name} hin`, p.anfahrt, false], [`${p.name} zurück`, p.rueckweg, true], [`${p.name} raus`, p.ausfahrt, false]);
  }
  const abs = rangierAbsetzplatz();
  fahrten.push(["Absetzkipper hin", abs.anfahrt, false], ["Absetzkipper zurück", abs.rueckweg, true], ["Absetzkipper raus", absetzAusfahrt(), false]);
  for (const sl of PARK_SLOTS) {
    const z = anfahrtVomPlatz(sl, null);
    fahrten.push([`Warteplatz ${sl.join("|")} zum Abladeplatz`, z.anfahrt, false], [`Warteplatz ${sl.join("|")} raus`, parkAusfahrt(sl), false]);
  }
  const treffer: string[] = [];
  for (const [n, w, rev] of fahrten) {
    if (w.length < 2) continue;
    const t = Math.max(...umrisseEntlang(w, KIPPER, rev).map((u) => boxUeberlappung(u, vb)));
    if (t > 0.01) treffer.push(`${n} (${t.toFixed(2)} m)`);
  }
  return `- Gegenprobe: ${fahrten.length} andere Fahrten gegen den stehenden Verlader — ${treffer.length ? "STREIFEN: " + treffer.join("; ") : "keine streift ihn"}`;
}

for (const v of [vorher(), varianteA(), varianteB()]) {
  zeichne(v);
  console.log(pruefe(v).join("\n"));
  if (v.datei === "variante-A.svg") console.log(gegenprobeA());
  console.log("");
}
console.log("Bilder:", ziel, W, "x", H);
