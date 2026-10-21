/**
 * DER SCHICHT-PLATZ — „Kreis in der Ecke" (E-201, Konzept `docs/schicht-konzept.md`
 * Abschnitt 3, Variante A; Patrick 21.10.2026).
 *
 * EIN Schalter, einmal vor dem Bau der Welt (Muster `core/spielart.ts`: eine
 * Stelle, alle lesen). Ohne Aufruf ist alles bitgleich wie im Sandkasten.
 *
 * Was er umstellt, steht nur hier:
 *   - Der MÜLL-Container (`r_rubble`) ist nicht auf dem Platz — kein Körper,
 *     kein Schild, kein Fahrhindernis vor dem Bagger (dort hält der Verlader,
 *     `routes.ts` `VERLADER_VORN`). Mit ihm gibt es dort keinen freien Zug
 *     (`tools/schicht-platz.ts`).
 *   - Die rechte Halde (`c_mixed`, sonst MISCHSCHROTT) ist die MÜLL-Halde:
 *     dieselben vier Sorten wie der Container (Bauschutt, Reifen, Holz,
 *     Kunststoff). Mischschrott geht in der Schicht auf den Verlader.
 *   - Wer etwas gemerkt hat, das davon abhängt (Rangierzüge), räumt beim
 *     Umschalten auf (`beimUmschalten`).
 *
 * Was `main.ts` beim Aufbau weglässt (Starthaufen, Autos, Ansteher, Müll-
 * Abroller), steht dort — dieses Modul baut nichts.
 */
import { CONFIGS, type ContainerConfig } from "./containers";

let an = false;
const hoerer: Array<() => void> = [];
/** Was der Schalter überschrieben hat, zum Zurücksetzen. */
let vorher: { muell: ContainerConfig; index: number; misch: Pick<ContainerConfig, "fractionId" | "label" | "mitFraktionen"> } | null = null;

/** Läuft die Schicht auf diesem Platz? */
export function istSchichtPlatz(): boolean {
  return an;
}

/** Gemerktes verwerfen, wenn der Schalter umlegt (Rangier-Speicher in `routes.ts`). */
export function beimUmschalten(f: () => void): void {
  hoerer.push(f);
}

/** Den Platz für die Schicht umstellen — einmal, vor dem Bau der Welt. */
export function aktiviereSchichtPlatz(): void {
  if (an) return;
  const index = CONFIGS.findIndex((c) => c.id === "r_rubble");
  const misch = CONFIGS.find((c) => c.id === "c_mixed");
  if (index < 0 || !misch) throw new Error("Schicht-Platz: r_rubble oder c_mixed fehlt in CONFIGS");
  const muell = CONFIGS[index]!;
  vorher = { muell, index, misch: { fractionId: misch.fractionId, label: misch.label, mitFraktionen: misch.mitFraktionen } };
  CONFIGS.splice(index, 1);
  // Dieselben Sorten wie der Container; Schild „MÜLL" wie seine Bemalung (E-138), EN „WASTE"
  misch.fractionId = muell.fractionId;
  misch.mitFraktionen = [...(muell.mitFraktionen ?? [])];
  misch.label = muell.bemalung?.schrift ?? muell.label;
  an = true;
  for (const f of hoerer) f();
}

/** Zurück auf den Sandkasten-Platz (für Tests). */
export function setzeSchichtPlatzZurueck(): void {
  if (!an || !vorher) return;
  const misch = CONFIGS.find((c) => c.id === "c_mixed")!;
  misch.fractionId = vorher.misch.fractionId;
  misch.label = vorher.misch.label;
  if (vorher.misch.mitFraktionen === undefined) delete misch.mitFraktionen;
  else misch.mitFraktionen = vorher.misch.mitFraktionen;
  CONFIGS.splice(vorher.index, 0, vorher.muell);
  vorher = null;
  an = false;
  for (const f of hoerer) f();
}
