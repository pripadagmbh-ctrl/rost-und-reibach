/**
 * Stahlschrott-Regel — was Premium ist, und was die Umstellung bewegt hat.
 *
 * Anlass (Patrick, 15.09.2026): „Ich möchte ein bisschen strenger werden, was
 * Stahlschrott ist. Das ist halt so das Premium. Es geht da eher so um
 * Bahnschwellen, Bremsscheiben, Träger — das ist so wirklich ganz gutes
 * Material."
 *
 * **Die Regel selbst steht seit E-042 in `src/materials/purity.ts`** und gilt
 * im Spiel. Dieses Werkzeug rechnet sie nicht nach, sondern ruft sie auf und
 * stellt sie der alten Regel gegenüber — damit `docs/stahlschrott.md`, das
 * Blatt und das Spiel nicht auseinanderlaufen können.
 *
 * Aufruf aus `v1/`:
 *
 *     npx vite-node tools/stahlschrott-liste.ts
 *     npx vite-node tools/stahlschrott-wirkung.ts
 *     npx vite-node tools/stahlschrott-blatt-schreiben.ts
 */
import { readFileSync } from "node:fs";
import {
  STAHL_KG_M3,
  VERBUND_BIS,
  WAND_AB_MM,
  aussenflaeche,
  fraktionAus,
  fraktionVonTeil,
  istRad,
  wandstaerkeMm,
} from "../src/materials/purity";
import type { PileSpec } from "../src/world/objektkatalog";

export { STAHL_KG_M3, VERBUND_BIS, WAND_AB_MM, aussenflaeche, wandstaerkeMm };

/* ------------------------------------------------------------------------ */
/* 1 · Der Katalog, unberührt                                                 */
/* ------------------------------------------------------------------------ */

/**
 * Alle sechs Listen werden aus dem **Quelltext** gelesen, nicht importiert.
 *
 * Zwei Gründe, und der zweite ist der wichtigere:
 *
 * 1. `BIG_SPECS` und `HUGE_SPECS` in `scrapItems.ts` sind nicht exportiert —
 *    und genau dort stehen Patricks Premium-Beispiele (Doppel-T-Träger,
 *    Maschinenblock, Schwungrad). Die Bestandsaufnahme vom 15.09.
 *    (`docs/fraktionen.md`, „271 erreichbare Einträge") hat diese Lücke.
 * 2. Beide Dateien **überschreiben `materialId` beim Laden** mit dem Ergebnis
 *    der Regel. Wer sie importiert, sieht nie mehr, was vorher dastand — und
 *    kann den Vorher-Nachher-Vergleich nicht rechnen, für den es dieses
 *    Werkzeug gibt.
 *
 * Erlaubt ist das, weil jede Zeile ein reines Objektliteral ist: keine
 * Funktionsaufrufe, keine Variablen, nur Zahlen und Zeichenketten. Sobald
 * jemand dort eine Variable benutzt, wirft `new Function` — das Werkzeug
 * schweigt dann nicht, sondern stürzt ab. Lieber laut falsch als leise
 * unvollständig.
 */
function ausQuelltext(quelle: string, name: string): PileSpec[] {
  const kopf = new RegExp(`const ${name}: PileSpec\\[\\] = \\[`);
  const start = quelle.search(kopf);
  if (start < 0) throw new Error(`${name} im Quelltext nicht gefunden`);
  const auf = quelle.indexOf("[", start);
  const zu = quelle.indexOf("\n];", auf);
  if (zu < 0) throw new Error(`${name}: Ende der Liste nicht gefunden`);
  const rumpf = quelle
    .slice(auf + 1, zu)
    .split("\n")
    .filter((z) => !z.includes("...KATALOG"))
    .join("\n");
  /*
   * Der Zeilenumbruch vor `];` ist Absicht (16.10.2026). Die Listen in
   * `scrapItems.ts` enden mit einer Kommentarzeile („// Erweiterung
   * 12.09.2026 …"). Ohne Umbruch stand `];` IN diesem Kommentar, und die Liste
   * blieb offen. Bei Windows-Zeilenenden beendete das unsichtbare `\r` den
   * Kommentar zufaellig — deshalb lief das Werkzeug nur auf einem Rechner,
   * dessen Arbeitsbaum CRLF hatte, und auf jedem frischen Auschecken nicht.
   */
  return new Function(`return [${rumpf}\n];`)() as PileSpec[];
}

function lies(datei: string): string {
  return readFileSync(new URL(`../src/world/${datei}`, import.meta.url), "utf8");
}

/** Alle Schrottteile des Spiels, mit Herkunftsliste. */
export function alleEintraege(): { spec: PileSpec; liste: string }[] {
  const scrap = lies("scrapItems.ts");
  const katalog = lies("objektkatalog.ts");
  const listen: [string, string][] = [
    ["SPECS", scrap],
    ["BIG_SPECS", scrap],
    ["HUGE_SPECS", scrap],
    ["KATALOG_SPECS", katalog],
    ["KATALOG_BIG", katalog],
    ["KATALOG_HUGE", katalog],
  ];
  const raus: { spec: PileSpec; liste: string }[] = [];
  for (const [name, quelle] of listen)
    for (const spec of ausQuelltext(quelle, name)) raus.push({ spec, liste: name });
  return raus;
}

/* ------------------------------------------------------------------------ */
/* 2 · Maße zur Anschauung                                                    */
/* ------------------------------------------------------------------------ */

/**
 * Rauminhalt der Hülle in m³ — der Raum, den das Stück auf der Ladefläche
 * wegnimmt. Nur zur Anschauung: Die Regel hängt nicht daran, sie rechnet mit
 * der Außenfläche.
 */
export function huellVolumen(kind: string, dims: number[]): number {
  if (kind === "cyl") {
    const [r, l] = dims;
    return Math.PI * r * r * l;
  }
  if (kind === "torus") {
    const [R, r] = dims;
    return 2 * Math.PI * Math.PI * R * r * r;
  }
  if (kind === "wire") {
    const r = dims[0];
    return (4 / 3) * Math.PI * r * r * r;
  }
  const [a = 1, b = 1, c = 1] = dims;
  return a * b * c;
}

/** Hüllwichte in kg/m³ — Masse geteilt durch den belegten Raum. */
export function huellwichte(spec: PileSpec): number {
  return spec.massKg / Math.max(huellVolumen(spec.kind, spec.dims), 1e-4);
}

/** Der Stoff mit dem größten Anteil und sein Anteil (ohne Stückliste: 1,0). */
export function leitstoff(spec: PileSpec): { id: string; anteil: number } {
  const z = spec.zusammensetzung;
  if (!z || z.length === 0) return { id: spec.materialId, anteil: 1 };
  let groesster = z[0];
  for (const a of z) if (a.anteil > groesster.anteil) groesster = a;
  return { id: groesster.materialId, anteil: groesster.anteil };
}

/* ------------------------------------------------------------------------ */
/* 3 · Urteil je Stück: vorher gegen jetzt                                    */
/* ------------------------------------------------------------------------ */

/** Warum ein Stück so einsortiert ist. */
/** `rad` seit E-186 (Patrick 20.10.2026: „Rad zählt als Reifen", `purity.istRad`). */
export type Grund = "premium" | "uebersteuert" | "kein-stahl" | "duennwandig" | "verbund" | "rad";

export interface Urteil {
  spec: PileSpec;
  liste: string;
  /** Fraktion vor E-042 — allein aus der Stückliste, Schwelle 95 %. */
  vorher: string;
  /** Fraktion nach E-042, gerechnet von `fraktionVonTeil` aus `src/`. */
  jetzt: string;
  grund: Grund;
  wand: number;
  wichte: number;
  fremd: number;
}

/**
 * Ein Stück beurteilen.
 *
 * `jetzt` kommt aus dem Spiel selbst (`fraktionVonTeil`); `grund` erklärt nur,
 * warum. Die Trennung ist Absicht: Wer die Begründung umformuliert, ändert
 * nichts an der Sortierung — und wer die Regel ändert, sieht es in beidem.
 */
export function urteile(spec: PileSpec, liste = ""): Urteil {
  const { id, anteil } = leitstoff(spec);
  const wand = wandstaerkeMm(spec.massKg, spec.kind, spec.dims);
  const fremd = 1 - anteil;
  const vorher = spec.zusammensetzung?.length
    ? fraktionAus(spec.zusammensetzung, spec.materialId)
    : spec.materialId;

  let grund: Grund = "premium";
  if (istRad(spec.zusammensetzung ?? [])) grund = "rad";
  else if (id !== "steel") grund = "kein-stahl";
  else if (fremd > VERBUND_BIS + 1e-9) grund = "verbund";
  else if (spec.massiv !== undefined) grund = "uebersteuert";
  else if (wand < WAND_AB_MM) grund = "duennwandig";

  return {
    spec,
    liste,
    vorher,
    jetzt: fraktionVonTeil(spec),
    grund,
    wand,
    wichte: huellwichte(spec),
    fremd,
  };
}

/** Alle Einträge beurteilt. */
export function alleUrteile(): Urteil[] {
  return alleEintraege().map(({ spec, liste }) => urteile(spec, liste));
}
