/**
 * Schüttdichten — was eine Fuhre wiegt, die man nach Volumen belädt.
 *
 * Anlass (Patrick, 15.09.2026): „Es ist halt bei Händlern halt auch nicht
 * immer das Gewicht, sondern eher das Volumen auf der Ladefläche."
 *
 * Bis dahin kannte das Spiel nur Kilogramm. Zwei Fuhren mit je 2.500 kg sahen
 * deshalb gleich aus — obwohl 2.500 kg Aluminiumprofile über die Bordwand
 * ragen und 2.500 kg Messingarmaturen als flacher Fleck auf dem Boden der
 * Pritsche liegen. Diese Tabelle ist der Unterschied.
 *
 * ACHTUNG, Schüttdichte ist nicht Feststoffdichte. Loser Schrott ist zur
 * Hälfte Luft: Stahl selbst wiegt 7.850 kg/m³, loser Stahlschrott 600 bis 900.
 * Der Branchen-Faustwert lautet „eine Tonne Stahlschrott sind 1,2 bis 1,5 m³"
 * (= 667 bis 833 kg/m³); die Werte unten liegen in diesem Rahmen.
 *
 * Herkunft je Zahl steht am Eintrag. Wo keine belastbare Quelle vorlag, steht
 * `SW` (Startwert zum Austesten, Projektregel 3) mit der Überlegung dahinter.
 */
import { ABFALLFRAKTIONEN, normalizeMaterialId } from "./catalog";

/**
 * Schüttdichte in kg/m³, so wie das Material lose auf der Ladefläche liegt —
 * ungepresst, unzerkleinert, wie es beim Kunden anfällt.
 */
export const SCHUETTDICHTE: Record<string, number> = {
  // Sammelschrott E1/E3, lose: Faustwert 1 t = 1,2–1,5 m³, also 667–833 kg/m³.
  // 750 ist die Mitte dieses Bandes.
  steel: 750,
  // VA kommt als Blech, Rohr und Behälterteil — sperriger als Stahlschrott,
  // obwohl das Material selbst schwerer ist. SW.
  va: 700,
  // Alu: Profile, Felgen, Bleche, Fensterrahmen. Alu wiegt ein Drittel von
  // Stahl (2.700 gegen 7.850 kg/m³) und liegt genauso locker. SW, abgeleitet
  // aus steel × (2700/7850) = 258.
  alu: 250,
  // Kupfer: Rohre und Wickel, dicht gepackt, aber hohl. SW.
  copper: 900,
  // Messing: Armaturen, Hähne, Ventile — kompakte Vollteile, das schwerste,
  // was in normalen Mengen ankommt. SW.
  brass: 1400,
  // Zink: Dachrinnen, Fallrohre, Verzinktes. Röhren und Bleche, viel Luft. SW.
  zinc: 350,
  // Bleiakkus stehen dicht an dicht auf der Palette, praktisch ohne Lücke.
  // Ein 60-Ah-Akku wiegt 16 kg bei rund 0,01 m³, macht 1.600 kg/m³.
  battery: 1600,
  // Kabelbunde und Trommelreste: viel Luft zwischen den Windungen. SW.
  cable: 450,
  // Mischschrott, wie ein Händler ihn lose auflädt: überwiegend Stahl,
  // dazwischen Blech, Hohlkörper und Kleinkram. Leichter als sortenreiner
  // Stahlschrott, weil nichts gestapelt wird. SW.
  mixed: 620,

  // --- Abfallfraktionen: fressen Volumen, wiegen fast nichts ---
  // Altholz lose, unzerkleinert: 0,2–0,3 t/m³.
  wood: 250,
  // PKW-Reifen lose geschüttet: 0,1–0,2 t/m³.
  tires: 150,
  // Baumischabfall lose: 0,25–0,35 t/m³.
  rubble: 300,
  // Kunststoff lose (Folie, Hohlkörper, Formteile): unter 0,1 t/m³.
  plastic: 90,
};

/**
 * **Feststoffdichte** in kg/m³ — was der reine Werkstoff wiegt, ohne Luft.
 *
 * Nicht dasselbe wie die Schüttdichte oben, und für etwas ganz anderes da:
 * Die Schüttdichte sagt, was eine LADUNG wiegt; die Feststoffdichte sagt, was
 * ein EINZELNES Stück höchstens wiegen kann. Ein Kasten von einem halben
 * Kubikmeter kann nie mehr als einen halben Kubikmeter Vollmaterial wiegen —
 * das ist keine Balancing-Frage, sondern eine Obergrenze aus der Physik.
 *
 * Anlass (Patrick, 15.09.2026): „Ganz oft sind Aluminium-Sachen, die haben
 * dann zwei Tonnen. Aber Aluminium ist ja leicht, das ist ja die Eigenschaft
 * von Aluminium." Damit ist das Gewicht einer von drei Kanälen, an denen er
 * Aluminium erkennen will — neben Farbe und Zusammensetzung. Ein Maß dafür
 * gab es bisher nicht; jetzt gibt es eins, und `test/bauart.test.ts` prüft
 * jeden Katalogeintrag dagegen.
 *
 * Die Werte sind **Obergrenzen**, wo eine Spanne existiert: Eiche statt
 * Fichte, Beton statt Ziegel. Ein Wächter soll nur das anschlagen, was
 * wirklich unmöglich ist, nicht das Ungewöhnliche.
 */
export const FESTSTOFFDICHTE: Record<string, number> = {
  // Baustahl — dieselbe Zahl wie `STAHL_KG_M3` in `purity.ts`.
  steel: 7850,
  // Austenitischer Edelstahl 1.4301.
  va: 7900,
  alu: 2700,
  copper: 8960,
  // Messing CuZn37 (8400–8700), Obergrenze.
  brass: 8700,
  zinc: 7140,
  // Bleiakku als Gerät, nicht als reines Blei: Gehäuse, Säure, Platten.
  // Ein 60-Ah-Akku wiegt 16 kg bei rund 7,6 Litern — knapp 2100 kg/m³.
  battery: 2100,
  // Kabel als Ganzes: Kupferseele plus Mantel, dicht gewickelt.
  cable: 2500,
  // Hartholz (Eiche, Buche), feucht — die schwerste Sorte, die anfällt.
  wood: 900,
  // Duroplaste und GFK liegen bei 1500–1900; PVC bei 1400. Obergrenze.
  plastic: 1900,
  // Gummimischung mit Stahlcord.
  tires: 1300,
  // Stahlbeton.
  rubble: 2500,
  /*
   * Mischschrott hat keine eigene Dichte — er ist ein Gemisch. Als Obergrenze
   * gilt Stahl: Was mehr wiegt als ein gleich großer Stahlklotz, kann kein
   * Gemisch aus Blech, Kunststoff und Kupfer sein.
   */
  mixed: 7850,
};

/** Feststoffdichte einer Fraktion; ohne Eintrag gilt Stahl als Obergrenze. */
export function feststoffdichte(id: string): number {
  return (
    FESTSTOFFDICHTE[id] ?? FESTSTOFFDICHTE[normalizeMaterialId(id)] ?? FESTSTOFFDICHTE.steel
  );
}

/**
 * Späne als Mulde voller Knäuel (E-147) — keine Fraktion, sondern eine Form
 * von Mischschrott, darum nicht in `SCHUETTDICHTE`.
 *
 * Lose Wirr- und Langspäne liegen bei 0,1–0,3 t/m³ (Branchenwert für
 * ungebrochene Drehspäne; Kurz- und Bröckelspäne 0,5–1,5 t/m³). In dieser
 * Sitzung nicht nachgeschlagen. SW: 150 — im unteren Teil des Bandes, weil die
 * Knäuel im Spiel mit Lücken liegen.
 */
export const SPAENE_SCHUETTDICHTE = 150;

/** Fallwert für eine Fraktion ohne Eintrag — so schwer wie Mischschrott. SW. */
const STANDARD_DICHTE = 620;

/** Schüttdichte einer Fraktion in kg/m³. */
export function schuettdichte(id: string): number {
  return SCHUETTDICHTE[id] ?? SCHUETTDICHTE[normalizeMaterialId(id)] ?? STANDARD_DICHTE;
}

/**
 * Der Beifang einer Fuhre ist kein Material, sondern ein Gemisch aus den vier
 * Abfallfraktionen: Holz, Baumischabfall, Reifen, Kunststoff. Als Schüttdichte
 * zählt ihr Mittel — und das ist der Grund, warum eine verunreinigte Fuhre
 * voller aussieht, als sie wiegt.
 *
 * Die Liste stand hier bis zum 16.09.2026 ein zweites Mal im Quelltext
 * (`STOERSTOFFE`), neben `ABFALL` in `catalog.ts`. Jetzt wird sie geholt, nicht
 * wiederholt — wer eine fünfte Abfallsorte einträgt, bekommt sie hier von
 * selbst.
 */
export function abfallDichte(): number {
  return (
    ABFALLFRAKTIONEN.reduce((s, id) => s + schuettdichte(id), 0) / ABFALLFRAKTIONEN.length
  );
}

/**
 * Mischdichte einer Ladung aus Volumenanteilen.
 *
 * Die Anteile sind **Volumen**anteile, nicht Gewichtsanteile — genau darum
 * geht es: Wer ein Viertel der Ladefläche mit Kunststoff belegt, hat ein
 * Viertel weniger Platz und kaum mehr Gewicht. Die Anteile werden auf 1
 * normiert; eine leere Angabe ergibt Mischschrott.
 */
export function mischDichte(anteile: Record<string, number>): number {
  let summe = 0;
  let masse = 0;
  for (const [id, anteil] of Object.entries(anteile)) {
    if (!(anteil > 0)) continue;
    summe += anteil;
    masse += anteil * schuettdichte(id);
  }
  return summe > 0 ? masse / summe : STANDARD_DICHTE;
}

/**
 * Dichte einer Anlieferung aus Hauptfraktion und Abfallanteil.
 *
 * @param hauptfraktion Fraktions-ID, oder null für eine gemischte Fuhre
 * @param abfallAnteil Volumenanteil Holz/Baumisch/Reifen/Kunststoff (0–1)
 */
export function ladungsDichte(
  hauptfraktion: string | null,
  abfallAnteil: number
): number {
  // NaN käme aus einem halb gefüllten Profil und würde sich durch die ganze
  // Rechenkette ziehen, ohne dass ein Vergleich je fehlschlägt (Lehre
  // 15.09.2026). Deshalb hier abfangen, nicht weiterreichen.
  const abfall = Number.isFinite(abfallAnteil)
    ? Math.min(1, Math.max(0, abfallAnteil))
    : 0;
  const haupt = schuettdichte(hauptfraktion ?? "mixed");
  return haupt * (1 - abfall) + abfallDichte() * abfall;
}
