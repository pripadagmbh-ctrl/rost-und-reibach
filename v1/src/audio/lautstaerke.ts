/**
 * LAUTSTÄRKE JE GRUPPE (E-139, Wunsch Patrick 17.10.2026: „lautstärke
 * konfigurationen für bagger, metall und musik im menü").
 *
 * Drei Gruppen, jeder Klang hängt an genau einer:
 *  - bagger: Motor, Hydraulik (Druck, Ventil, Ölströmen), Zupacken, Loslassen,
 *    Bedienklick und Funk-Knacken (beides kommt aus der Kabine)
 *  - metall: alles, was Metall auf etwas trifft — Aufprall, Hämmern, Drücken,
 *    Knautschen, Krallen-Schnappen, Kratzen, Glas, Abriss, Glocke, Sterne
 *  - musik: das Kabinenradio
 *
 * Gemerkt in localStorage, eigener Schlüssel: Lautstärke gehört zum Gerät,
 * nicht zum Spielstand — ein „Neues Spiel" soll sie nicht zurücksetzen.
 */
export type Lautgruppe = "bagger" | "metall" | "musik";
export const LAUTGRUPPEN: readonly Lautgruppe[] = ["bagger", "metall", "musik"];
export type Lautstaerken = Record<Lautgruppe, number>;

export const LAUT_KEY = "schrottplatz_lautstaerke";
/** Start: alles voll — die Pegel darunter sind schon abgeglichen (E-130). */
export const LAUT_START: Lautstaerken = { bagger: 1, metall: 1, musik: 1 };

const begrenze = (v: unknown, sonst: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : sonst;

/** Aus gespeichertem Text; was fehlt oder kaputt ist, steht auf dem Startwert. */
export function leseLautstaerken(roh: string | null): Lautstaerken {
  let d: Record<string, unknown> = {};
  try {
    const p = JSON.parse(roh ?? "{}") as unknown;
    if (p && typeof p === "object") d = p as Record<string, unknown>;
  } catch {
    /* kaputt: Startwerte */
  }
  return {
    bagger: begrenze(d.bagger, LAUT_START.bagger),
    metall: begrenze(d.metall, LAUT_START.metall),
    musik: begrenze(d.musik, LAUT_START.musik),
  };
}

export function ladeLautstaerken(): Lautstaerken {
  try {
    return leseLautstaerken(localStorage.getItem(LAUT_KEY));
  } catch {
    return { ...LAUT_START }; // Safari-Privatmodus oder kein Speicher
  }
}

export function speichereLautstaerken(l: Lautstaerken): void {
  try {
    localStorage.setItem(LAUT_KEY, JSON.stringify(l));
  } catch {
    /* Privatmodus: gilt dann nur bis zum Neuladen */
  }
}
