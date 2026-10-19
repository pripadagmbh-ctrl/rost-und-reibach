/**
 * STUMMSCHALTER (E-172, Patrick 19.10.2026): Steht der Stummschalter am
 * iPhone auf lautlos, ist das Spiel still — und Musik aus einer anderen App
 * (Spotify, Podcast) läuft unter dem Spiel weiter, statt abzubrechen.
 *
 * Das ist die Audio-Sitzung „ambient". Zwei Stellen setzen sie:
 *  - hier im Web-Teil `navigator.audioSession.type` (Safari ab 16.4, also
 *    auch die WebView der App ab iOS 16.4; älteres Safari kennt es nicht und
 *    bleibt bei seinem Standard),
 *  - in der App zusätzlich `AVAudioSession` in `ios/App/App/AppDelegate.swift`,
 *    damit es auch greift, bevor das Spiel den ersten Ton macht.
 *
 * Muss VOR dem ersten Ton gesetzt sein — `AudioManager` ruft es, bevor er den
 * Tonkanal baut.
 */
export function folgeStummschalter(nav: unknown = typeof navigator !== "undefined" ? navigator : undefined): boolean {
  const sitzung = (nav as { audioSession?: { type: string } } | undefined)?.audioSession;
  if (!sitzung) return false;
  try {
    sitzung.type = "ambient";
    return sitzung.type === "ambient";
  } catch {
    return false; // Browser verweigert den Wert — dann gilt sein Standard
  }
}
