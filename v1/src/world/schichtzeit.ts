/**
 * DIE ZAHLEN DER SCHICHT-UHR (E-203, herausgelöst mit E-202) — ohne three.js.
 *
 * Sie standen in `world/daylight.ts` und stehen dort weiter (Wiederexport):
 * Es gibt genau EINE Uhr (`Daylight.time`, E-113). Herausgelöst sind nur die
 * Zahlen, damit reine Module wie der Fahrplan (`economy/schichtplan.ts`) sie
 * lesen können, ohne three.js zu laden — `daylight.ts` baut Himmel und Licht.
 *
 * Patrick, 21.10.2026: Eine Schicht dauert rund zehn Minuten, die Uhr im Bild
 * läuft von 06:00 bis 16:00 (`docs/schicht-konzept.md`, Abschnitt 2). Zehn
 * Spielstunden in 600 s sind 60 s je Spielstunde, ein voller Tag also
 * 24 x 60 = 1 440 s statt 900 s.
 */

/** Länge eines Schicht-Tages in Sekunden: 24 Spielstunden zu je 60 s (siehe oben). */
export const SCHICHT_TAG_S = 1440;
/** Schichtbeginn 06:00 = 6/24 Tag. */
export const SCHICHT_START = 6 / 24;
/**
 * Torschluss 15:00 = 15/24 Tag — ab hier kommt keine neue Fuhre mehr (wie
 * `shift.TORSCHLUSS_TIME` im Sandkasten, E-113). Bei 60 s je Spielstunde nach
 * 9 x 60 = 540 s Schicht; die letzte Stunde gehoert dem Abarbeiten.
 */
export const SCHICHT_TORSCHLUSS = 15 / 24;
/** Feierabend 16:00 = 16/24 Tag, nach (16 − 6) x 60 = 600 s Schicht. */
export const SCHICHT_FEIERABEND = 16 / 24;

/** Torschluss in Schicht-Sekunden seit 06:00 — gerechnet, nicht abgeschrieben (540). */
export const SCHICHT_TORSCHLUSS_S = (SCHICHT_TORSCHLUSS - SCHICHT_START) * SCHICHT_TAG_S;
/** Feierabend in Schicht-Sekunden seit 06:00 (600). */
export const SCHICHT_FEIERABEND_S = (SCHICHT_FEIERABEND - SCHICHT_START) * SCHICHT_TAG_S;
