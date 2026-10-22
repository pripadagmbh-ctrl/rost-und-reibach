/**
 * SORTENFARBEN UND BILDZEICHEN (Auftrag 41, Patrick 22.10.2026: „Farbe und
 * Bildschild an jeder Mulde, im ganzen Spiel; das Ziel-Teil leuchtet in
 * derselben Farbe").
 *
 * Die EINE Tabelle, aus der Muldenschild (world/), Zielmarke und Zielzeile
 * (ui/) Farbe und Bild lesen. Niemand legt eine zweite Farbliste an.
 *
 * Schnittstelle vom Bauleiter (Stub), Werte und Bilder Paket P1 (welt).
 *
 * Bild = Liste von SVG-Pfaden (`d`, Raster 24 x 24, gestrichen mit Breite 2,
 * runde Enden) — dieselben Zeichenketten gehen ins HUD (`<path d>`) und auf
 * die Leinwand des Schilds (`new Path2D(d)`, `zeichneSortenbild`).
 *
 * FARBEN — FUENF GRUPPEN, alle aus der Palette von Okabe und Ito (2008,
 * „Color Universal Design", jfly.uni-koeln.de/color), die fuer Farbsehschwache
 * gebaut ist. Gemessen mit `tools/farbabstand.ts` (ΔE2000 und Simulation nach
 * Machado et al. 2009), festgehalten in `test/sorten.test.ts`:
 *
 *   Stahl     Himmelblau   0x56b4e9   „Stahlblau"
 *   Bunt      Zinnober     0xd55e00   naechste Okabe-Ito-Farbe am Kupfer (0xc7622b, catalog.ts)
 *   Misch     Purpur       0xcc79a7   die einzige, die nach nichts aussieht — wie Mischschrott
 *   Müll      Blau         0x0072b2   passt zum Enzianblau des Müll-Lacks (E-138, 0x1f4e8c)
 *   Batterie  Gelb         0xf0e442   Warngelb (Gefahrgut)
 *
 * Kleinster Abstand zweier Gruppen: ΔE 22,3 normal, 15,5 Deuteranopie,
 * 12,3 Protanopie, 14,0 Tritanopie (Schwellen 20 / 10, siehe Test).
 *
 * Die vier Silos der Bunt-Reihe (Kupfer, Kabel, Alu, VA) tragen die Farbe
 * ihrer Gruppe, aber jedes ein eigenes Bild: Die Farbe sagt „Bunt", das Bild
 * sagt, welches. Farbe ist nie der einzige Kanal.
 */
import { CONFIGS, gehoertHierhin, type ContainerConfig } from "../world/containers";
import { MATERIALS, istAbfall } from "./catalog";

export type SorteId = "stahl" | "bunt" | "misch" | "muell" | "batterie" | "kupfer" | "kabel" | "alu" | "va";

export interface Sorte {
  id: SorteId;
  /** 0xrrggbb */
  farbe: number;
  name: { de: string; en: string };
  /** SVG-Pfade im 24er-Raster (gestrichen) */
  bild: readonly string[];
}

/* Okabe-Ito-Farben (Herkunft siehe Kopf) */
const HIMMELBLAU = 0x56b4e9;
const ZINNOBER = 0xd55e00;
const PURPUR = 0xcc79a7;
const BLAU = 0x0072b2;
const GELB = 0xf0e442;

/*
 * BILDER (24er-Raster, Strich 2, runde Enden). Je Sorte ein Gegenstand, den
 * man auf einem Schrottplatz in dieser Mulde findet — kein Buchstabe, damit
 * es ohne Lesen geht:
 *
 *   stahl     Doppel-T-Traeger im Querschnitt
 *   bunt      drei gestapelte Metallbarren
 *   misch     ein Haufen aus Kasten, Kugel und Keil — „allerlei"
 *   muell     Muelltonne mit Deckel
 *   batterie  Akku mit Polen, Plus und Minus
 *   kupfer    Rohrbogen (Kupferrohr)
 *   kabel     Stecker mit Kabel
 *   alu       Getraenkedose
 *   va        Kochtopf mit Deckel (Edelstahl)
 */
// SW: Bildwahl, am Geraet abzunehmen (Auftrag 41)
export const SORTEN: Readonly<Record<SorteId, Sorte>> = {
  stahl: {
    id: "stahl",
    farbe: HIMMELBLAU,
    name: { de: "Stahl", en: "Steel" },
    bild: ["M5 3h14v4h-5v10h5v4H5v-4h5V7H5z"],
  },
  bunt: {
    id: "bunt",
    farbe: ZINNOBER,
    name: { de: "Bunt + VA", en: "Non-ferrous + SS" },
    bild: ["M2 21l2-7h6l2 7z", "M12 21l2-7h6l2 7z", "M7 12l2-7h6l2 7z"],
  },
  misch: {
    id: "misch",
    farbe: PURPUR,
    name: { de: "Misch", en: "Mixed" },
    bild: ["M3 20.5v-7h7v7z", "M13.5 17a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0", "M7.5 10.5l4.5-7 4.5 7z"],
  },
  muell: {
    id: "muell",
    farbe: BLAU,
    name: { de: "Müll", en: "Waste" },
    bild: ["M3.5 6.5h17", "M9.5 6.5v-3h5v3", "M5.5 6.5l1.3 14.5h10.4l1.3-14.5", "M10 10v7.5M14 10v7.5"],
  },
  batterie: {
    id: "batterie",
    farbe: GELB,
    name: { de: "Batterien", en: "Batteries" },
    bild: ["M2.5 7h16v11h-16z", "M18.5 10.5h2.5v4h-2.5", "M5.5 12.5h4.5M7.75 10.25v4.5", "M12.5 12.5h3.5"],
  },
  kupfer: {
    id: "kupfer",
    farbe: ZINNOBER,
    name: { de: "Kupfer", en: "Copper" },
    bild: ["M4 21v-9a8 8 0 0 1 8-8h9", "M9 21v-9a3 3 0 0 1 3-3h9", "M4 21h5M21 4v5"],
  },
  kabel: {
    id: "kabel",
    farbe: ZINNOBER,
    name: { de: "Kabel", en: "Cable" },
    bild: ["M8 3v4M14 3v4", "M5 7h12v3a6 6 0 0 1-12 0z", "M11 16v1.5a3.5 3.5 0 0 0 3.5 3.5H21"],
  },
  alu: {
    id: "alu",
    farbe: ZINNOBER,
    name: { de: "Alu", en: "Aluminium" },
    bild: ["M8 3h8l1.5 2.5v13L16 21H8l-1.5-2.5v-13z", "M6.5 8h11M6.5 16h11"],
  },
  va: {
    id: "va",
    farbe: ZINNOBER,
    name: { de: "VA", en: "Stainless" },
    bild: ["M5 11h14v6a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z", "M2 12.5h3M19 12.5h3", "M4 8h16", "M10 5h4"],
  },
};

/** Alle Sorten-Ids in fester Reihenfolge (fuer Tabellen, Tests, HUD). */
export const SORTEN_IDS: readonly SorteId[] = Object.keys(SORTEN) as SorteId[];

/*
 * Welche Sorte ein Behaelter ist, folgt aus seinem Datensatz in
 * `world/containers.ts` — nicht aus seiner Id. So stimmt es auch dann, wenn
 * die Schicht die rechte Halde zur MÜLL-Halde macht (`world/schichtplatz.ts`,
 * E-201): Dieselbe Id `c_mixed` traegt dann Müll-Fraktionen und bekommt das
 * Müll-Schild.
 */
/** Die Sorte eines Lagersilos nach seiner Leitfraktion — jedes Silo hat ein eigenes Bild. */
const SILO: Readonly<Record<string, SorteId>> = {
  copper: "kupfer",
  brass: "kupfer",
  cable: "kabel",
  alu: "alu",
  zinc: "alu",
  va: "va",
};
/** Leitfraktionen mit eigener Sorte, gleich ob Silo oder Mulde am Bagger. */
const LEIT: Readonly<Record<string, SorteId>> = {
  steel: "stahl",
  mixed: "misch",
  battery: "batterie",
};

/** Sorte aus einem Behaelter-Datensatz (Leitfraktion, Lager ja/nein). */
export function sorteVonKonfig(cfg: Pick<ContainerConfig, "fractionId" | "lager" | "nurHuelle">): SorteId | null {
  if (cfg.nurHuelle) return null; // gebaut, aber ohne Fraktion (E-010/E-011)
  const f = cfg.fractionId;
  if (istAbfall(f)) return "muell";
  const leit = LEIT[f];
  if (leit) return leit;
  const silo = SILO[f];
  if (!silo) return null;
  // Am Bagger ist jede Buntmetall-Mulde die Sammelmulde BUNT + VA (E-028/E-029)
  return cfg.lager === true ? silo : "bunt";
}

/** Sorte einer Mulde/Box/Halde/eines Silos (Container-ID aus world/containers.ts); null = keine Sorte (z. B. Presse). */
export function sorteVonBehaelter(containerId: string): SorteId | null {
  const cfg = CONFIGS.find((c) => c.id === containerId);
  return cfg ? sorteVonKonfig(cfg) : null;
}

/**
 * In welche Sorte gehoert dieses Material (Fraktions-ID aus materials/catalog.ts)?
 *
 * Die Sorte der MULDE, in der es auf dem Platz richtig liegt
 * (`gehoertHierhin`): zuerst die Mulden am Bagger, dann die Silos. Kupfer ist
 * damit `bunt` (BUNT + VA nimmt sieben Fraktionen), ein Akku auch — er liegt
 * seit E-029 in derselben Mulde. Gibt es gerade keine Mulde dafuer (in der
 * Schicht geht Mischschrott auf den Verlader, E-201), gilt die Sorte seiner
 * Leitfraktion. Unbekannte Ids: null.
 */
export function sorteVonMaterial(materialId: string): SorteId | null {
  if (!MATERIALS[materialId]) return null;
  const passend = CONFIGS.filter((c) => !c.nurHuelle && gehoertHierhin(c, materialId));
  const ziel = passend.find((c) => c.lager !== true) ?? passend[0];
  if (ziel) {
    const s = sorteVonKonfig(ziel);
    if (s) return s;
  }
  return sorteVonKonfig({ fractionId: materialId });
}

/** CSS-Farbe aus 0xrrggbb. */
export function farbeCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

/** Relative Leuchtdichte nach WCAG 2.1 (dieselbe Formel wie `tools/farbabstand.ts`, `leuchtdichte`). */
function leuchtdichte(hex: number): number {
  const lin = (v: number): number => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((hex >> 16) & 0xff) + 0.7152 * lin((hex >> 8) & 0xff) + 0.0722 * lin(hex & 0xff);
}

/**
 * Strichfarbe des Bilds auf der Sortenfarbe: Schwarz oder Weiss, was mehr
 * Kontrast gibt (WCAG 2.1). Gemessen alle ≥ 4,5 : 1 (`test/sorten.test.ts`).
 */
export function bildFarbe(sorte: SorteId): number {
  const l = leuchtdichte(SORTEN[sorte].farbe);
  return (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? 0x000000 : 0xffffff;
}

/** Zeichen fuer die Ampel am Schild (E-061): Farbe allein reicht Farbenblinden nicht. */
export const AMPEL_ZEICHEN: Readonly<Record<"green" | "yellow" | "red", readonly string[]>> = {
  green: ["M5 12.5l4.5 4.5L19 7"], // ✓
  yellow: ["M12 4.5v10", "M12 19v.5"], // !
  red: ["M6 6l12 12M18 6L6 18"], // ✕
};

/** Kleinste Schnittmenge einer 2D-Leinwand, die das Bild braucht. */
type Leinwand = Pick<
  CanvasRenderingContext2D,
  "save" | "restore" | "translate" | "scale" | "stroke" | "lineWidth" | "lineCap" | "lineJoin" | "strokeStyle"
>;

/**
 * Pfade (24er-Raster) in ein Quadrat zeichnen: links oben (x, y), Kante
 * `groesse` Pixel, Strichfarbe `farbe` (CSS). Strichbreite 2 im Raster,
 * runde Enden. Ohne `Path2D` (Node, Vitest) wird nichts gezeichnet → false.
 */
export function zeichnePfade(
  ctx: Leinwand,
  pfade: readonly string[],
  x: number,
  y: number,
  groesse: number,
  farbe: string,
  breite = 2
): boolean {
  if (typeof Path2D === "undefined") return false;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(groesse / 24, groesse / 24);
  ctx.lineWidth = breite;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = farbe;
  for (const d of pfade) ctx.stroke(new Path2D(d));
  ctx.restore();
  return true;
}

/** Das Bild einer Sorte auf eine Leinwand (Schild, HUD-Canvas). */
export function zeichneSortenbild(
  ctx: Leinwand,
  sorte: SorteId,
  x: number,
  y: number,
  groesse: number,
  farbe: string = farbeCss(bildFarbe(sorte))
): boolean {
  return zeichnePfade(ctx, SORTEN[sorte].bild, x, y, groesse, farbe);
}
