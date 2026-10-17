/**
 * GEHALTENER SCHROTT SCHLAEGT AUF (E-134, 17.10.2026).
 *
 * Patrick: „schrott krach auch wenn ich mit der spinne schrott auf den boden
 * haue ohne loszulassen". Lose Teile melden ihren Aufprall selbst
 * (`scrapItems.onAufprall`, E-121); was die Spinne haelt, ist kinematisch und
 * meldet nichts.
 *
 * Erkannt wird ein EINSCHLAG, kein Aufliegen: der Uebergang von „frei" zu
 * „Kontakt", wenn die Spitze dabei schnell genug nach unten kam. Danach bleibt
 * es still, solange aufgesetzt bleibt — dieselbe Regel wie beim Greifklang
 * (E-130): kein Klang bleibt stehen. Erst wer wieder abhebt
 * (`AUFSCHLAG_FREI_S`), kann erneut aufschlagen.
 */

/**
 * Ab dieser Senkgeschwindigkeit der Spitze (m/s) ist es ein Schlag. SW 0,8,
 * gemessen mit `tools/lastaufschlag.ts` (180-kg-Traeger): Ausleger und Stiel
 * voll gesenkt 3,15 m/s, nur der Ausleger 2,13 m/s, behutsam abgesetzt
 * (Taste im Wechsel) 0,11 m/s. Die Schwelle liegt dazwischen, naeher am
 * Behutsamen: Wer zuegig absetzt, darf es hoeren.
 */
export const AUFSCHLAG_AB_MS = 0.8;
/**
 * So lange muss die Last frei gewesen sein, bevor sie erneut aufschlagen
 * kann (s). SW 0,15: Der Bodenkontakt flackert beim Aufliegen nicht, aber
 * ein Pendeln knapp ueber dem Boden soll kein Trommelfeuer geben.
 */
export const AUFSCHLAG_FREI_S = 0.15;

export class Aufschlagmelder {
  private kontaktAlt = true; // wer im Kontakt startet, hat nicht aufgeschlagen
  private freiS = 0;
  private abwaertsAlt = 0;

  /**
   * Ein Physikschritt. `kontakt`: liegt die Last jetzt auf; `abwaerts`:
   * Senkgeschwindigkeit der Spitze in diesem Schritt (m/s, vor dem Anschlag).
   * Liefert das Aufschlagtempo beim Einschlag, sonst null.
   */
  schritt(dt: number, kontakt: boolean, abwaerts: number): number | null {
    const tempo = Math.max(abwaerts, this.abwaertsAlt);
    const schlag = kontakt && !this.kontaktAlt && this.freiS >= AUFSCHLAG_FREI_S && tempo >= AUFSCHLAG_AB_MS;
    this.freiS = kontakt ? 0 : this.freiS + dt;
    this.kontaktAlt = kontakt;
    this.abwaertsAlt = abwaerts;
    return schlag ? tempo : null;
  }
}
