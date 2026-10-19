/**
 * WIE OFT KOMMT WELCHE SORTE? — Messung zu Patricks Ansage vom 20.10.2026:
 * „Auch fehlt es an der balance zwischen misch und stahlschrott.
 * Mischschrott ist häufiger."
 *
 * Gemessen an den drei Stellen, an denen Schrott ins Spiel kommt:
 *
 *  1. STARTHAUFEN — `spawnPile` (85 Teile, Grossteil-Anteil 0,12), mit dem
 *     Platzieren nachgebaut: Was keinen Platz findet, faellt weg (wie dort).
 *  2. STREUSCHROTT — `randomCargo(START_STREU.teile)`, zehn Teile.
 *  3. ANLIEFERUNGEN — `rollAnlieferung` (Haendler, Gewerbe, Privat,
 *     Einzelstueck, Wohnwagen), gepackt mit dem Nachbau `packeFuhre` aus
 *     `tools/grossteile.ts`. Wracks (Abschlepper) zaehlen extra: Sie bringen
 *     ein Auto, keine Schrottteile.
 *
 * Jede Zahl ueber viele Saaten (Standard 96, E-080: 24 reichen nicht).
 * Ausgabe je Sortengruppe: Anteil an der STUECKZAHL und an der MASSE.
 *
 * Dazu zwei Listen ohne Zufall: alle Mulden-/Container-/Behaelter-Eintraege
 * und alle Reifen-Eintraege, je mit Fraktion nach der einen Regel
 * (`fraktionVonTeil`), Wandstaerke und Fremdstoff.
 *
 * Aufruf, aus `v1/`:
 *
 *     npx vite-node tools/sortenanteile.ts
 *     npx vite-node tools/sortenanteile.ts 480      (Zahl der Saaten)
 */
import { SPECS, BIG_SPECS, HUGE_SPECS, randomCargo, umkugelRadius } from "../src/world/scrapItems";
import type { PileSpec } from "../src/world/objektkatalog";
import { rollAnlieferung, FAMILIES, TRADES } from "../src/delivery/customers";
import { START_STREU } from "../src/world/startplatz";
import { fraktionVonTeil, wandstaerkeMm } from "../src/materials/purity";

// grossteile.ts laeuft sonst beim Import selbst los
(globalThis as { grossteileAlsBaustein?: boolean }).grossteileAlsBaustein = true;
const { packeFuhre } = await import("./grossteile");

/** Fester Zufall wie in `tools/grossteile.ts`. */
function festerZufall(saat: number): () => void {
  const echt = Math.random;
  let z = saat >>> 0;
  Math.random = () => {
    z = (z * 1664525 + 1013904223) >>> 0;
    return z / 4294967296;
  };
  return () => {
    Math.random = echt;
  };
}

export type Gruppe = "Stahl" | "Misch" | "Alu" | "NE+Kabel+Akku" | "Abfall";
export const GRUPPEN: Gruppe[] = ["Stahl", "Misch", "Alu", "NE+Kabel+Akku", "Abfall"];

export function gruppeVon(materialId: string): Gruppe {
  if (materialId === "steel") return "Stahl";
  if (materialId === "mixed") return "Misch";
  if (materialId === "alu") return "Alu";
  if (["wood", "rubble", "plastic", "tires"].includes(materialId)) return "Abfall";
  return "NE+Kabel+Akku";
}

export interface Zaehler {
  stueck: Record<Gruppe, number>;
  kg: Record<Gruppe, number>;
}

export function neuerZaehler(): Zaehler {
  const leer = (): Record<Gruppe, number> =>
    Object.fromEntries(GRUPPEN.map((g) => [g, 0])) as Record<Gruppe, number>;
  return { stueck: leer(), kg: leer() };
}

function zaehle(z: Zaehler, materialId: string, kg: number): void {
  const g = gruppeVon(materialId);
  z.stueck[g] += 1;
  z.kg[g] += kg;
}

export function anteile(z: Zaehler): { stueck: Record<Gruppe, number>; kg: Record<Gruppe, number> } {
  const s = GRUPPEN.reduce((a, g) => a + z.stueck[g], 0) || 1;
  const k = GRUPPEN.reduce((a, g) => a + z.kg[g], 0) || 1;
  return {
    stueck: Object.fromEntries(GRUPPEN.map((g) => [g, z.stueck[g] / s])) as Record<Gruppe, number>,
    kg: Object.fromEntries(GRUPPEN.map((g) => [g, z.kg[g] / k])) as Record<Gruppe, number>,
  };
}

/**
 * Der Starthaufen, Platzieren wie `ItemManager.spawnPile` — gleiche Zufallsaufrufe
 * in gleicher Reihenfolge, nur ohne Physik. Gibt die Teile zurueck, die liegen.
 */
export function starthaufen(count = 85, spread = 2.9): Array<{ materialId: string; massKg: number }> {
  const SPAWN_ABSTAND = 0.06; // wie `scrapItems.SPAWN_ABSTAND`
  const placed: Array<{ x: number; y: number; z: number; r: number }> = [];
  const out: Array<{ materialId: string; massKg: number }> = [];
  const specs = randomCargo(count, 0.12);
  for (const s of specs) {
    const r = umkugelRadius(s.shape) + SPAWN_ABSTAND;
    let spot: { x: number; y: number; z: number; r: number } | null = null;
    for (let layer = 0; layer < 24 && !spot; layer++) {
      const y = 0.5 + layer * 0.62;
      const maxRad = spread * (1 - layer * 0.03);
      for (let attempt = 0; attempt < 90; attempt++) {
        const a = Math.random() * Math.PI * 2;
        const rad = Math.sqrt(Math.random()) * maxRad;
        const x = Math.cos(a) * rad;
        const z = Math.sin(a) * rad;
        const clash = placed.some((p) => Math.hypot(p.x - x, p.y - y, p.z - z) < p.r + r);
        if (!clash) {
          spot = { x, y, z, r };
          break;
        }
      }
    }
    if (!spot) continue;
    placed.push(spot);
    // die drei Drehwinkel von spawnPile
    Math.random();
    Math.random();
    Math.random();
    out.push({ materialId: s.materialId, massKg: s.massKg });
  }
  return out;
}

export interface Messung {
  start: Zaehler;
  streu: Zaehler;
  liefer: Zaehler;
  lieferJeArt: Record<string, Zaehler>;
  fuhren: number;
  wracks: number;
  startStueckJeSaat: number;
}

export function miss(saaten: number, fuhrenJeSaat = 40): Messung {
  const start = neuerZaehler();
  const streu = neuerZaehler();
  const liefer = neuerZaehler();
  const lieferJeArt: Record<string, Zaehler> = {};
  let fuhren = 0;
  let wracks = 0;
  let startStueck = 0;
  for (let s = 0; s < saaten; s++) {
    let zurueck = festerZufall(1000 + s);
    const haufen = starthaufen();
    startStueck += haufen.length;
    for (const t of haufen) zaehle(start, t.materialId, t.massKg);
    for (const t of randomCargo(START_STREU.teile || 10)) zaehle(streu, t.materialId, t.massKg);
    zurueck();

    zurueck = festerZufall(50000 + s);
    for (let f = 0; f < fuhrenJeSaat; f++) {
      const c = rollAnlieferung();
      fuhren++;
      if (c.vehicle === "wrack") {
        wracks++;
        continue;
      }
      const art = c.einzelstueck
        ? "Einzelstueck"
        : c.spaene
          ? "Spaene"
          : c.group === "gewerbe"
            ? "Gewerbe"
            : c.group === "privat"
              ? "Privat"
              : c.sortedMaterial
                ? "Haendler sortenrein"
                : "Haendler gemischt";
      lieferJeArt[art] ??= neuerZaehler();
      if (c.spaene) {
        // Spaenemulde: Mischschrott (E-147), Knaeuel zu 11–18 kg (Mitte 14,3)
        const n = Math.max(1, Math.round(c.massKg / 14.3));
        for (let k = 0; k < n; k++) {
          zaehle(liefer, "mixed", c.massKg / n);
          zaehle(lieferJeArt[art]!, "mixed", c.massKg / n);
        }
        continue;
      }
      const e = packeFuhre(c);
      for (const t of e.fracht) {
        zaehle(liefer, t.materialId, t.massKg);
        zaehle(lieferJeArt[art]!, t.materialId, t.massKg);
      }
    }
    zurueck();
  }
  return { start, streu, liefer, lieferJeArt, fuhren, wracks, startStueckJeSaat: startStueck / saaten };
}

function pz(x: number): string {
  return `${(x * 100).toFixed(1).replace(".", ",")} %`.padStart(8);
}

function zeile(name: string, z: Zaehler): void {
  const a = anteile(z);
  console.log(
    `${name.padEnd(22)} Stueck: ` +
      GRUPPEN.map((g) => `${g} ${pz(a.stueck[g])}`).join("  ") +
      `\n${"".padEnd(22)} Masse:  ` +
      GRUPPEN.map((g) => `${g} ${pz(a.kg[g])}`).join("  ")
  );
}

function liste(titel: string, filter: (sp: PileSpec) => boolean): void {
  console.log(`\n=== ${titel} ===`);
  const L: Array<[string, PileSpec[]]> = [
    ["SPECS", SPECS],
    ["BIG", BIG_SPECS],
    ["HUGE", HUGE_SPECS],
  ];
  for (const [k, l] of L) {
    for (const sp of l) {
      if (!filter(sp)) continue;
      const fremd = sp.zusammensetzung
        ? 1 - Math.max(...sp.zusammensetzung.map((a) => a.anteil))
        : 0;
      console.log(
        `  [${k}] ${(sp.name ?? "?").padEnd(38)} bau=${String(sp.bau ?? "-").padEnd(12)} ${String(sp.massKg).padStart(5)} kg` +
          `  Wand ${wandstaerkeMm(sp.massKg, sp.kind, sp.dims).toFixed(1).padStart(5)} mm  Fremd ${(fremd * 100).toFixed(0).padStart(3)} %` +
          `  massiv=${sp.massiv === undefined ? "-" : sp.massiv}  -> ${fraktionVonTeil(sp)}`
      );
    }
  }
}

/**
 * Die Zeilen, die E-181 fuer `delivery/customers.ts` vorschlaegt (Bereich des
 * Lieferungs-Agenten) — hier nur im Speicher gesetzt, um ihre Wirkung zu
 * messen. Aufruf mit `VORSCHLAG=1`.
 */
export function vorschlagSetzen(): void {
  const t = (n: string) => TRADES.find((x) => x.name === n)!;
  const f = (n: string) => FAMILIES.find((x) => x.family === n)!;
  t("Abbruch Kranz").material = "mixed";
  t("Maschinenbau Voigt").material = "mixed";
  f("Boxmann").typical = "mixed";
  f("Adorf").typical = "mixed";
}

function main(): void {
  const arg = process.argv.slice(2).filter((a) => /^\d+$/.test(a));
  const SAATEN = arg.length > 0 ? Number(arg[0]) : 96;
  if (process.env.VORSCHLAG) {
    vorschlagSetzen();
    console.log("VORSCHLAG customers.ts gesetzt (nur im Speicher)");
  }

  liste(
    "Mulden, Container, Behaelter",
    (sp) =>
      /mulde|container|behälter|behaelter|kippbeh/i.test(sp.name ?? "") ||
      ["mulde", "deckelmulde", "container"].includes(sp.bau ?? "")
  );
  liste("Reifen und Raeder", (sp) => /reifen|rad\b|rad mit|felge/i.test(sp.name ?? "") || sp.materialId === "tires");

  console.log(`\n=== Katalog: Eintraege je Gruppe ===`);
  for (const [k, l] of [
    ["SPECS", SPECS],
    ["BIG", BIG_SPECS],
    ["HUGE", HUGE_SPECS],
  ] as Array<[string, PileSpec[]]>) {
    const z = neuerZaehler();
    for (const sp of l) zaehle(z, sp.materialId, sp.massKg);
    console.log(`  ${k.padEnd(6)} ` + GRUPPEN.map((g) => `${g} ${z.stueck[g]}`).join(" · "));
  }

  const m = miss(SAATEN);
  console.log(`\n=== Anteile, ${SAATEN} Saaten ===`);
  console.log(`Starthaufen: im Mittel ${m.startStueckJeSaat.toFixed(1)} Teile liegen`);
  zeile("Starthaufen", m.start);
  zeile("Streuschrott", m.streu);
  zeile(`Anlieferungen (${m.fuhren - m.wracks})`, m.liefer);
  console.log(`  dazu Wracks auf dem Abschlepper: ${m.wracks} von ${m.fuhren} Fuhren (${pz(m.wracks / m.fuhren)})`);
  console.log("\n--- Anlieferungen je Art ---");
  for (const [art, z] of Object.entries(m.lieferJeArt).sort()) zeile(art, z);
}

if (!(globalThis as { sortenanteileAlsBaustein?: boolean }).sortenanteileAlsBaustein) main();
