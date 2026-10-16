/**
 * Zustandskunde des Tonkanals — bewusst ohne Browser-Abhaengigkeit, damit sie
 * geprueft werden kann, ohne ein Geraet in der Hand zu haben.
 *
 * Hintergrund (Geraetetest 14.09.2026, iPad): Das Debug-Overlay zeigte
 * `Ton: interrupted · Musik an (laeuft)` — der Tonkanal stand still, das Spiel
 * meinte, es spiele. `interrupted` ist ein EIGENER Zustand von WebKit, den die
 * Typdefinition des Browsers gar nicht kennt (`AudioContextState` kennt nur
 * running/suspended/closed). Er tritt ein, sobald die Seite in den Hintergrund
 * geht, ein Anruf kommt oder der Bildschirm sperrt, und er geht ohne ein
 * ausdrueckliches `resume()` NICHT von selbst zurueck.
 *
 * Deshalb wird hier nicht auf eine Liste stummer Zustaende geprueft, sondern
 * umgekehrt: hoerbar ist ausschliesslich `running`. Jeder andere Zustand — auch
 * ein kuenftiger, den heute niemand kennt — gilt als stumm und weckbar.
 */

/** Was der AudioContext melden kann, inklusive des WebKit-eigenen Zustands. */
export type Tonlage = "keiner" | "running" | "suspended" | "interrupted" | "closed" | string;

/** Nur ein laufender Kanal bringt wirklich Ton ans Ohr. */
export function istHoerbar(zustand: Tonlage): boolean {
  return zustand === "running";
}

/**
 * Braucht dieser Zustand einen Weckruf (`resume()`)?
 * Ja fuer `suspended` UND `interrupted` — und fuer alles Unbekannte.
 * Nein nur, wenn es nichts zu wecken gibt (kein Kanal) oder der Kanal
 * endgueltig geschlossen ist; da hilft nur ein Neuaufbau.
 */
export function brauchtWeckruf(zustand: Tonlage): boolean {
  return zustand !== "running" && zustand !== "closed" && zustand !== "keiner";
}

/** Ein geschlossener Kanal laesst sich nicht wecken, nur ersetzen. */
export function brauchtNeuaufbau(zustand: Tonlage): boolean {
  return zustand === "closed";
}

/** Zustandsbericht des Tonsystems fuer Overlay und Tests. */
export interface Tondiagnose {
  /** Zustand des AudioContext, woertlich wie der Browser ihn meldet */
  ctx: Tonlage;
  /** Wunsch des Spielers */
  musicWanted: boolean;
  /** Musik laeuft UND ist tatsaechlich hoerbar */
  musicRunning: boolean;
  /** Kommt ueberhaupt Ton heraus? */
  hoerbar: boolean;
  /** Vergebliche Weckrufe seit dem letzten Mal, dass der Ton lief */
  weckversuche: number;
  /**
   * Die Aufnahmen (E-130): wie viele dekodiert sind, ms ab Seitenaufruf bis
   * alles geholt bzw. dekodiert war (−1 = noch nicht), Dateigroesse und
   * Speicher der dekodierten Puffer in kB.
   */
  aufnahmen?: { geladen: number; gesamt: number; holMs: number; dekodierMs: number; kB: number; speicherKB: number };
}
