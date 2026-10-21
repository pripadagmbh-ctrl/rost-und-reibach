/**
 * EINGABE-SPUR FÜR DIE VORFÜHRUNG IM LEHRGANG (E-196, Patrick 21.10.2026:
 * „Vorführung im Spiel statt Video").
 *
 * Eine Spur ist DATEN: Abschnitte mit Dauer und den Befehlen, die in dieser
 * Zeit anliegen — dieselben Werte, die sonst die Sticks liefern
 * (`TouchControls.axes`, −1 … +1, Vorzeichen wie der Befehl des Spielers),
 * dazu einmalige Tastendrücke (Codes wie bei `touch.consumePress`, z. B.
 * "KeyO" Stützen, "KeyV" Ansicht) und Kamera-Gesten (wie der Mittelstreifen
 * sie an `Input` gibt). Die Wiedergabe schreibt NUR in diesen Eingabeweg —
 * Spinne, Pendel und Kamera rechnen wie beim Spieler (Regel 2).
 *
 * Deterministisch: feste Abschnitte, Zeit = Spielzeit der Wiedergabe.
 * Jede Spur einer Lektion soll in der Lage enden, in der sie begann
 * („hin und zurück"), damit der Spieler danach am selben Punkt steht.
 */
export type SpurAchse = "cab" | "boom" | "stick" | "grapple" | "rotator" | "drive" | "steer";

export interface SpurAbschnitt {
  /** Dauer in Sekunden Spielzeit */
  dauerS: number;
  /** Befehle, die während des Abschnitts anliegen; fehlende Achsen = 0 */
  achsen?: Partial<Record<SpurAchse, number>>;
  /** Einmal zu Beginn des Abschnitts gedrückt */
  tasten?: readonly string[];
  /** Kamera-Gesten je Sekunde (Mittelstreifen): Gier/Nick wie `Input.orbitDX/DY`, Zoom als Faktor je Sekunde; `zuruecksetzen` = Doppeltipp */
  kamera?: { gierProS?: number; nickProS?: number; zoomProS?: number; zuruecksetzen?: boolean };
}

export type Spur = readonly SpurAbschnitt[];

/** Gesamtdauer einer Spur (s). */
export function spurDauer(s: Spur): number {
  return s.reduce((a, b) => a + b.dauerS, 0);
}
