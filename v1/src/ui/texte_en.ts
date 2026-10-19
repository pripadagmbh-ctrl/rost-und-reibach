/**
 * ENGLISCH (E-170). Schlüssel = der deutsche Text, wie er im Spiel steht
 * (Leerraum zu einem Leerzeichen zusammengezogen, Ränder abgeschnitten).
 *
 * Fachwörter: Umschlagbagger = material handler, Mulde = skip,
 * Schere/Presse = shear/baler, Pratzen/Stützen = outriggers,
 * Mischschrott = mixed scrap, Stahlschrott = steel scrap,
 * Buntmetall = non-ferrous, Edelstahl/VA = stainless, Spinne = grapple,
 * Hauptarm = boom, Ausleger (am rechten Stick) = arm, Oberwagen = upper.
 * Britische Schreibung wie im Store-Text (aluminium, tyres).
 */
export const EN: Record<string, string> = {
  "Gespeichert.": "Saved.",
};

/**
 * Sätze mit Zahlen oder Namen darin. `$1` usw. wird selbst wieder übersetzt
 * (Name aus dem Wörterbuch, Zahl mit Punkt statt Komma, Listen stückweise).
 * Reihenfolge zählt: das erste passende Muster gewinnt.
 */
export const MUSTER: Array<[RegExp, string]> = [];
