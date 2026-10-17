/**
 * Materialkatalog — die 6 MVP-Materialklassen (Briefing Kap. 7).
 * Preise in €/kg, alle Werte Startwerte (SW). Negativer Verkaufspreis = Entsorgungskosten.
 * i18n kommt in V1; M1 ist deutschsprachig.
 */
export interface MaterialClass {
  id: string;
  name: string;
  buyPricePerKg: number;
  sellPricePerKg: number;
  /** Farbleitsystem Kap. 16 */
  color: number;
}

/**
 * Fraktionen (Stand 12.09.2026): Guss läuft mit im Stahlschrott, dafür gibt es
 * eine eigene Mulde für Edelstahl (VA).
 *
 * Kupfer und Messing sind getrennt (Ansage 12.09.2026: „Kupfer Messing soll
 * getrennt werden"). Zusammengefasst waren sie eine Bequemlichkeit: Messing
 * bringt gut die Hälfte von Kupfer, und wer beides in eine Mulde wirft,
 * bekommt am Ende den Messingpreis für alles. Genau diese Entscheidung — den
 * Hahn nicht zum Rohr zu werfen — ist der Sinn einer eigenen Mulde.
 */
export const MATERIALS: Record<string, MaterialClass> = {
  steel: { id: "steel", name: "Stahlschrott", buyPricePerKg: 0.18, sellPricePerKg: 0.25, color: 0x6e5a4e },
  va: { id: "va", name: "Edelstahl VA", buyPricePerKg: 1.0, sellPricePerKg: 1.4, color: 0xdfe6ea },
  /*
   * Aluminium: mattes, warmes Mittelgrau — nicht das Blauweiss von poliertem
   * Blech (E-042, 15.09.2026).
   *
   * Patrick am Geraet: „Aluminium ist in den meisten Faellen grau." Bis dahin
   * stand hier 0xc4c8cc, ein sehr helles blaeuliches Grau; Altaluminium ist
   * matt, oxidiert und staubig. Gemessen mit `tools/alufarbe.ts` (DeltaE2000
   * auf die Grundfarben):
   *
   *   Paar           vorher   jetzt   warum es zaehlt
   *   alu <-> va       6,98   24,63   verschiedene Silos (ALU- und VA-LAGER)
   *   alu <-> zinc    10,23   12,25   teilen sich jeden Behaelter, egal
   *   alu <-> mixed   37,90   20,25   bleibt klar getrennt
   *   alu <-> steel   37,88   20,44   bleibt klar getrennt
   *
   * Die 6,98 waren der eigentliche Fehler: Alu und Edelstahl waren kaum zu
   * unterscheiden, bei Abendsonne gar nicht (6,54 — unter 10 gilt als dieselbe
   * Farbe). Dass Alu dafuer naeher an Zink rueckt, kostet nichts: ALU-LAGER
   * nimmt Zink mit, die beiden muessen nie getrennt werden (`containers.ts`).
   *
   * Derselbe Ton steht in `world/objektbau.ts` als `ALU` — dort werden 27 der
   * 30 Alu-Teile gefaerbt, hier nur drei.
   */
  alu: { id: "alu", name: "Aluminium", buyPricePerKg: 1.1, sellPricePerKg: 1.5, color: 0x928d85 },
  copper: { id: "copper", name: "Kupfer", buyPricePerKg: 6.0, sellPricePerKg: 7.2, color: 0xc7622b },
  brass: { id: "brass", name: "Messing", buyPricePerKg: 3.4, sellPricePerKg: 4.3, color: 0xc9a227 },
  /*
   * Zink und Batterien kommen mit der neuen Platzordnung dazu (Ansage
   * 12.09.2026). Beide sind auf einem echten Schrottplatz eigene Stroeme:
   * Zink aus Dachrinnen, Fallrohren und Zinkblech (Verzinktes ist Stahl,
   * E-150: „verzinkt ist kein buntmetall"), Bleiakkus aus allem, was
   * einen Anlasser hat. Akkus sind ausserdem gefaehrlicher Abfall — sie
   * duerfen nicht in den Mischschrott, und genau deshalb lohnt die eigene
   * Mulde.
   */
  zinc: { id: "zinc", name: "Zink", buyPricePerKg: 0.62, sellPricePerKg: 0.82, color: 0x9aa6ad },
  battery: {
    id: "battery",
    name: "Batterien",
    buyPricePerKg: 0.38,
    sellPricePerKg: 0.55,
    color: 0x3d4b57,
  },
  cable: { id: "cable", name: "Kabel", buyPricePerKg: 1.6, sellPricePerKg: 2.2, color: 0xb0682a },
  /**
   * Mischschrott: alles, was zusammen in die Presse geht. Er laesst sich
   * verkaufen, bringt aber deutlich weniger als sortenreiner Stahl — genau das
   * ist der Anreiz, vorher zu trennen (Wunsch 11.09.2026).
   */
  mixed: { id: "mixed", name: "Mischschrott", buyPricePerKg: 0.1, sellPricePerKg: 0.16, color: 0x5f5a52 },
  /*
   * Abfallfraktionen. "Stoerstoff" hiess das frueher in einem Topf — aber
   * niemand weiss, was Stoerstoff ist (Befund 11.09.2026). Jetzt beim Namen
   * genannt: Holz, Baumisch, Reifen, Kunststoff. Sie kommen als Beifang mit
   * und muessen entsorgt werden; wer sie sauber trennt, zahlt weniger drauf,
   * als wenn sie im Mischschrott landen.
   */
  wood: { id: "wood", name: "Holz", buyPricePerKg: 0, sellPricePerKg: -0.02, color: 0x8a6a42 },
  tires: { id: "tires", name: "Reifen", buyPricePerKg: 0, sellPricePerKg: -0.05, color: 0x2e2c2b },
  rubble: { id: "rubble", name: "Baumischabfall", buyPricePerKg: 0, sellPricePerKg: -0.04, color: 0x9a9083 },
  plastic: { id: "plastic", name: "Kunststoff", buyPricePerKg: 0, sellPricePerKg: -0.06, color: 0x3f6d8a },
};

/**
 * Alte Fraktionen aus früheren Spielständen auf die aktuellen abbilden.
 * "contaminant" war der Sammeltopf, bevor die Abfaelle ihre eigenen Namen
 * bekamen; er landet im Baumischabfall.
 */
const ALIASES: Record<string, string> = { cast: "steel", contaminant: "rubble" };

export function getMaterial(id: string): MaterialClass {
  const m = MATERIALS[id] ?? MATERIALS[ALIASES[id] ?? ""];
  if (!m) throw new Error(`Unbekannte Materialklasse: ${id}`);
  return m;
}

/** Kanonische Fraktions-ID (für Save-Migration und Zonen-Zuordnung). */
export function normalizeMaterialId(id: string): string {
  return MATERIALS[id] ? id : (ALIASES[id] ?? "steel");
}

/**
 * DIE VIER ABFALLFRAKTIONEN — und zwar an genau EINER Stelle.
 *
 * Sie bringen kein Geld, sie kosten. Ein Abnehmer bestellt sie nie; sie werden
 * entsorgt.
 *
 * Diese Liste ist die Quelle, aus der sich alles andere bedient: die
 * Schuettdichten (`schuettdichte.ts`), der Fraktionsmix der Anlieferungen
 * (`world/scrapItems.ts`, `randomCargo`), die Mulden (`world/containers.ts`)
 * und das HUD. Bis zum 16.09.2026 stand dieselbe Vierergruppe ZWEIMAL im
 * Quelltext — hier und als `STOERSTOFFE` in `schuettdichte.ts` —, und im
 * Fraktionsmix stand eine DRITTE Fassung mit nur drei davon: Reifen konnten
 * nie angeliefert werden. Genau diese Fehlerklasse (zwei Stellen, die dasselbe
 * wissen sollen, und sie wissen es verschieden) hat am 15.09.2026 fuenf
 * Waechter beschaeftigt. `test/abfall.test.ts` haelt die Liste jetzt zusammen.
 *
 * Die Reihenfolge ist die, in der Patrick sie genannt hat („Holz,
 * Baumischabfall, Reifen und Kunststoffe") — sie bestimmt nichts ausser der
 * Lesbarkeit.
 */
export const ABFALLFRAKTIONEN = ["wood", "rubble", "tires", "plastic"] as const;

/** Dieselbe Liste als Menge, fuer schnelle Abfragen. */
export const ABFALL: ReadonlySet<string> = new Set<string>(ABFALLFRAKTIONEN);

/** Ist das eine Abfallfraktion? */
export function istAbfall(id: string): boolean {
  return ABFALL.has(normalizeMaterialId(id));
}
