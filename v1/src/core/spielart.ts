/**
 * DIE SPIELART — der eine Schalter (E-118, Ansage Patrick 06.10.2026).
 *
 * > „Ich will das Spiel vereinfachen und einen reinen Simulator draus machen,
 * > ohne tiefgreifende Story und mehr Fokus auf Bagger Challenges, Zerstörung
 * > und Bagger Skills."
 *
 * Auf Rückfrage: Wirtschaft, Verhandeln, Ruf und die Figuren „abschalten, im
 * Code lassen". Darum steht hier EINE Konstante, und alle lesen sie — dasselbe
 * Muster wie `VORGABE_FORM` in `dismantle/composites.ts` (E-117). Mehrere
 * Stellen, die je für sich wissen, ob gerade Simulator ist, sind die häufigste
 * Fehlerklasse dieses Projekts.
 *
 *   "simulator"  Hauptmenü (SANDKASTEN / CHALLENGES), kein Geld, keine Uhr,
 *                keine Kundschaft, keine Belegschaft. Das Radio bleibt.
 *   "betrieb"    Das Spiel bis E-117: Schrotthandel mit Kasse, Verhandeln,
 *                Ruf, Feierabend, Mario/Janine/Lambert, Polizei. Kein Menü.
 *
 * Zurück auf den alten Stand: hier "betrieb" eintragen — sonst nichts.
 *
 * Was im Simulator abgeschaltet ist, steht an genau zwei Stellen: hier die
 * Knöpfe und Anzeigen (`NUR_IM_BETRIEB`), in `main.ts` die Verdrahtung (Block
 * „Simulator: abhängen" und die Abfragen von `BETRIEB` in Schritt und
 * Bildschleife). Die Module selbst wissen von alledem nichts; ihre Tests
 * prüfen sie unverändert.
 */
export type Spielart = "simulator" | "betrieb";

export const SPIELART: Spielart = "simulator";

/** Läuft der alte Schrotthandel mit Geld, Kundschaft und Belegschaft? */
export const BETRIEB = (SPIELART as Spielart) === "betrieb";

/**
 * DIE CHALLENGES SIND PAUSIERT (E-129). Patrick am Gerät, 16.10.2026: „Und die
 * Challenges sind noch nicht ausgereift, pausieren".
 *
 * Pausiert heißt: nicht im Weg des Spielers, aber nichts gelöscht. Das Spiel
 * führt beim ersten Start nicht mehr in Challenge 1 und zeigt kein Hauptmenü —
 * mit nur noch einem Knopf (SANDKASTEN) wäre es ein Tipp ohne Wahl —, sondern
 * startet direkt im Sandkasten. Rahmen, Katalog, Karte, Wertung und ihre
 * Wächter bleiben (E-125); auf `false` gestellt ist alles wieder da.
 */
export const CHALLENGES_PAUSIERT = false; // E-162: aufgehoben, Aufgabe 1 traegt (Patrick 19.10.2026: Aufgaben + Sandkasten fuer 1.0)

/**
 * Was auf der Seite (`index.html`) nur zu EINER Spielart gehört — `main.ts`
 * nimmt den Rest beim Start aus dem Bild. Kranz-Einträge werden entfernt
 * (der Kranz liest die Spans, nicht ihre Sichtbarkeit), alles andere wird
 * nur verborgen, weil HUD und Pausenmenü es beim Start fest greifen.
 */
export const NUR_IM_BETRIEB: readonly string[] = [
  "money", // Konto und Haufenwert
  "shift", // Uhr, Tagesablauf, Zahlungslage
  "load", // Ladeanzeige des Abholers (Erlös hängt daran)
  "tutorial", // geführter Einstieg in den Handelskreislauf
  "pause-shop", // Platz ausbauen
  // "btn-pickup" (ABHOLEN) gehoert seit E-120 zu beiden Spielarten
  "btn-lambert", // Kranz: LAMBERT
];
export const NUR_IM_SIMULATOR: readonly string[] = [
  "btn-nachschub", // Kranz: NACHSCHUB
];

/*
 * CHALLENGE IST KEINE DRITTE SPIELART (E-125). Sie ist eine WAHL im
 * Hauptmenue des Simulators, wie der Sandkasten — gewaehlt zur Laufzeit,
 * nicht beim Bauen. `SPIELART` entscheidet, ob es Geld und Leute gibt; das
 * gilt fuer beide Wahlen gleich. Was nur im freien Spiel gebraucht wird und
 * in einer Challenge stoeren wuerde, steht hier — `main.ts` nimmt es in der
 * Challenge aus dem Bild, auf demselben Weg wie die Listen oben.
 */
export const NUR_IM_SANDKASTEN: readonly string[] = [
  "btn-nachschub", // Kranz: keine Fuhre mitten in die Aufgabe
  "btn-pickup", // Kranz: kein Abholer
  "btn-away", // Kranz: ZUR WAAGE — es faehrt keiner
  "btn-hupe", // Kranz: HUPE (E-191) — es wartet keiner auf das Signal
  "pause-save", // eine Challenge-Welt darf den Sandkasten-Stand nicht ueberschreiben
  "pause-new", // „Neues Spiel" loescht den Sandkasten-Stand
];
