import { rollCustomer, rollEinzelstueck, type CustomerProfile } from "./customers";
import type { Fahrzeugart } from "./fuellgrad";

/**
 * NACHSCHUB IM SANDKASTEN (E-118).
 *
 * Im Simulator gibt es kein Geld und keine Kundschaft — aber Material soll
 * trotzdem kommen. Der kleinste Weg: dieselbe Anlieferung wie bisher
 * (`VehicleManager.spawnNow`), nur auf Knopfdruck statt nach Uhr, und ohne
 * dass jemand an der Waage bezahlt oder verhandelt (das hängt `main.ts` ab).
 *
 * Reihum statt gewürfelt: Wer viermal NACHSCHUB tippt, bekommt einen Kipper,
 * eine Pritsche, ein Wrack und ein Großteil. Beim Zufall der Kundschaft käme
 * ein Wrack nur bei rund jeder neunten Fuhre — zu selten für einen Platz, auf
 * dem es ums Zerlegen geht.
 *
 * DAS GROSSTEIL IST DIE VIERTE ART (E-126), aus demselben Grund wie das
 * Wrack: Es ist eine eigene Aufgabe am Bagger (ein schweres, sperriges Stück
 * einfädeln), und wer sie üben will, soll nicht auf den Zufall warten. Ein
 * Großteil ist kein eigenes Fahrzeug — es kommt auf der flachen Pritsche —,
 * deshalb ist die Art hier mehr als die Fahrzeugart.
 */
export type NachschubArt = Fahrzeugart | "einzelstueck";

export const NACHSCHUB_FOLGE: readonly NachschubArt[] = [
  "kipper",
  "pritsche",
  "wrack",
  "einzelstueck",
  // E-141: der Absetzkipper mit seiner Mulde — kippt sie aus oder setzt sie ab
  "absetzer",
];

/**
 * So oft wird höchstens gewürfelt, bis das Fahrzeug passt.
 * // SW: Ein Wrack kommt bei etwa 12 % der Würfe (Händler 60 % × 15 % +
 * Privat 18 % × 15 %, `customers.ts`); 200 Fehlwürfe in Folge sind
 * praktisch ausgeschlossen (0,88^200 ≈ 1e-11).
 */
const MAX_WUERFE = 200;

/** Was im HUD steht, wenn die Fuhre losfährt — Fahrzeug, kein Kundenname. */
export const NACHSCHUB_MELDUNG: Record<NachschubArt, string> = {
  kipper: "Nachschub: Ein Kipper ist unterwegs.",
  pritsche: "Nachschub: Eine Pritsche ist unterwegs.",
  wrack: "Nachschub: Ein Wrack ist unterwegs.",
  pkw: "Nachschub: Ein Anhänger ist unterwegs.",
  einzelstueck: "Nachschub: Ein Großteil ist unterwegs.",
  absetzer: "Nachschub: Ein Absetzkipper mit Mulde ist unterwegs.",
};

/** Die Meldung zu einem fertigen Profil — ein Großteil kommt auf der Pritsche. */
export function nachschubMeldung(c: CustomerProfile): string {
  return NACHSCHUB_MELDUNG[c.einzelstueck ? "einzelstueck" : c.vehicle];
}

/**
 * Ein Profil für die nächste Fuhre, dessen Fahrzeug `art` ist.
 *
 * Gewürfelt wird mit der gewohnten Kundschaft, damit Menge, Füllgrad und
 * Ladung zum Fahrzeug passen — ein Profil mit fremdem Fahrzeug hätte eine
 * Anhängerladung auf einen Kipper gelegt. Passt nach `MAX_WUERFE` keins,
 * kommt das letzte: lieber eine andere Fuhre als keine. Das Großteil wird
 * nicht gesucht, sondern direkt gewürfelt.
 */
export function profilFuer(
  art: NachschubArt,
  wuerfle: () => CustomerProfile = rollCustomer
): CustomerProfile {
  if (art === "einzelstueck") return rollEinzelstueck();
  let c = wuerfle();
  for (let i = 1; i < MAX_WUERFE && c.vehicle !== art; i++) c = wuerfle();
  return c;
}
