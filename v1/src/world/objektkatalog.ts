/**
 * Objektkatalog — die Erweiterung des Sortiments (12.09.2026).
 *
 * Hier stehen die Objekte aus `docs/objektpool-erweiterung.md`, in genau der
 * Struktur, die `scrapItems.ts` schon kennt: `PileSpec` mit Fraktion, Masse,
 * Form und Maßen. Keine neuen Felder, keine neue Mechanik — die drei Listen
 * unten werden in `scrapItems.ts` einfach an die vorhandenen angehängt.
 *
 * Warum eine eigene Datei: `scrapItems.ts` ist die Werkstatt für Physik,
 * Dämpfung und Kollider. Ein Katalog von zweihundert Gegenständen gehört da
 * nicht mitten hinein — er ändert sich nach anderen Regeln und wird von
 * anderen Leuten gepflegt.
 *
 * **Einteilung nach Masse und Maß**, nicht nach Thema:
 *
 * - `KATALOG_SPECS` — bis rund 210 kg, längste Kante bis 2,2 m. Landet im
 *   Starthaufen und in gewöhnlichen Ladungen.
 * - `KATALOG_BIG` — bis rund 600 kg, bis 3,4 m. Großteile für
 *   Händleranlieferungen.
 * - `KATALOG_HUGE` — bis rund 2600 kg, bis 4,8 m. Schwergewichte, die einen
 *   Auflieger füllen.
 *
 * Die Obergrenzen sind keine Willkür: Der Ausleger reicht gut acht Meter, und
 * die schwerste Last im Bestand wiegt 2400 kg. Ein Objekt, das niemand heben
 * oder das keiner um die eigene Achse schwenken kann, ist im Spiel kein
 * Objekt, sondern ein Hindernis. Reale Riesen (Waggonkasten, 40-Fuß-Container,
 * Rangierlok) stehen deshalb in der Größe drin, in der ein Umschlagbagger sie
 * tatsächlich noch bewegt — als Kasten, Segment oder ausgeschlachteter Rest.
 *
 * Lose Schüttgüter — Beton, Ziegel, Asphalt, Naturstein, Schotter, Kies, Sand,
 * Erde — sind bewusst **nicht** dabei (Ansage 12.09.2026). Was rieselt, ist
 * mit einem Greifer nicht zu fassen und bräuchte eigene Mechanik.
 */
import type { ScrapShape } from "./scrapItems";
import type { BauId } from "./objektbau";
import { type Anteil, fraktionVonTeil } from "../materials/purity";

export interface PileSpec {
  materialId: string;
  massKg: number;
  kind: ScrapShape["kind"];
  dims: number[];
  /** Aus welchen Bauteilen — ohne Angabe bleibt es der nackte Grundkörper. */
  bau?: BauId;
  /** Wie es heißt — steht im Greifer, damit man weiß, was man gefasst hat. */
  name?: string;
  /** Woraus es besteht — ohne Angabe gilt es als sortenrein. */
  zusammensetzung?: Anteil[];
  /**
   * Übersteuerung der Stahlschrott-Regel (E-042), wenn Rechnung und
   * Augenschein auseinandergehen.
   *
   * Normalerweise entscheidet die rechnerische Wandstärke aus Masse und Maß
   * (`materials/purity.ts`, `WAND_AB_MM`). Sie erbt jeden Fehler in diesen
   * beiden Zahlen: Wo eine Masse aus Spielgründen kleiner gesetzt ist, als das
   * Stück in Wirklichkeit wiegt, rutscht es unter die Schwelle.
   *
   * **Jede Setzung braucht eine Begründung in derselben Zeile.** Ein `massiv`
   * ohne Begründung ist eine Bequemlichkeit, keine Entscheidung — und genau
   * davon wollte die Regel weg.
   */
  massiv?: boolean;
  /** Faellt beim Zerquetschen in seine Bestandteile (Kabeltrommel, Lattenrost). */
  trennbar?: boolean;
  /** Trennbar, aber nur mit Werkzeug — Arbeit fuer Lambert, nicht fuer die Spinne. */
  nurWerkzeug?: boolean;
}

/* ------------------------------------------------------------------------ */
/* Klein und mittel — Starthaufen und gewöhnliche Ladungen                    */
/* ------------------------------------------------------------------------ */

export const KATALOG_SPECS: PileSpec[] = [
  // --- Zink und Batterien (Ansage 12.09.2026) ---
  { materialId: "zinc", massKg: 14, kind: "box", dims: [0.25, 0.25, 2.4], bau: "buendel", name: "Zink-Dachrinne" },
  { materialId: "zinc", massKg: 22, kind: "box", dims: [0.6, 0.12, 1.8], bau: "platte", name: "Zinkblech-Tafel" },
  { materialId: "zinc", massKg: 31, kind: "box", dims: [0.45, 0.5, 0.9], bau: "buendel", name: "Fallrohr-Bund" },
  // E-150: verzinkt ist Stahl, kein Buntmetall (Patrick, 17.10.2026). 1,9 mm rechnerisch -> Mischschrott.
  { materialId: "steel", massKg: 58, kind: "box", dims: [0.7, 0.6, 1.2], bau: "stapel", name: "Verzinkte Gitterroste", zusammensetzung: [{ materialId: "steel", anteil: 1 }] },
  /* --- Vier Zinksorten mehr (E-063) ------------------------------------
   * Titanzink hat 7140 kg/m³ (`FESTSTOFFDICHTE.zinc`). Alle vier Massen sind
   * daraus gerechnet, nicht geschaetzt; die Rechnung steht je Zeile.
   */
  // Bandzink 0,7 mm, 0,65 m breit, 8 m lang = 5,2 m² x 0,0007 x 7140 = 26 kg.
  { materialId: "zinc", massKg: 26, kind: "cyl", dims: [0.25, 0.7], bau: "trommel", name: "Zinkblech-Rolle" },
  // Verzinkte Leitungsrinnen, 2,2 m, gebuendelt: 0,198 m³ Huelle, 278 kg/m³.
  // Nicht „Kabelrinne": Das Wort Kabel im Namen verspricht die Fraktion Kabel,
  // und das Stueck ist verzinktes Blech (`test/bauart.test.ts`, NAMENSSTOFF).
  // E-150: verzinktes Blech ist Stahl — 2,5 mm rechnerisch -> Mischschrott.
  { materialId: "steel", zusammensetzung: [{ materialId: "steel", anteil: 1 }], massKg: 55, kind: "box", dims: [0.3, 0.3, 2.2], bau: "buendel", name: "Verzinkte Leitungsrinnen (Bund)" },
  // Opferanoden vom Schiffsrumpf, massiver Zinkguss: 0,05 m³, 120 kg =
  // 2400 kg/m³ — ein Drittel Feststoff, der Rest Luft zwischen den Bloecken.
  { materialId: "zinc", massKg: 120, kind: "box", dims: [0.4, 0.25, 0.5], bau: "stapel", name: "Zink-Opferanoden (Stapel)" },
  // Regentonne aus Zinkblech, 0,8 mm: 1,2 m² Mantel x 0,0008 x 7140 = 7 kg,
  // mit Boden und Wulstrand 14 kg.
  { materialId: "zinc", massKg: 14, kind: "cyl", dims: [0.3, 0.5], bau: "tank", name: "Zink-Regentonne" },
  /* --- Zwei echte Zinksorten fuer die zwei verzinkten (E-150) -----------
   * Gitterroste und Leitungsrinnen sind seit E-150 Stahl. Ohne Ersatz haette
   * Zink nur noch sechs Kleinteile — Patrick, 15.09.2026: „mindestens acht
   * je Fraktion" (`test/gewicht.test.ts`).
   */
  // Kaminverwahrung aus Titanzink 0,7 mm, abgekantet: 2,0 m² x 0,0007 x 7140 = 10 kg.
  { materialId: "zinc", massKg: 10, kind: "box", dims: [0.8, 0.15, 1.1], bau: "platte", name: "Zink-Kaminverwahrung" },
  // Zinkdruckguss (Zamak): Tuergriffe, Armaturenkoerper, Vergasergehaeuse,
  // gestapelt. 0,12 m³ Huelle bei rund 1500 kg/m³ loser Gussteile (SW) = 180 kg.
  { materialId: "zinc", massKg: 180, kind: "box", dims: [0.5, 0.4, 0.6], bau: "stapel", name: "Zinkdruckguss-Teile (Stapel)" },
  /*
   * E-063: Die Akkus standen als GITTERRAHMEN da (`rahmenbox`) — ein Geflecht
   * aus Kanten und Draehten, durch das man hindurchsieht. Ein Bleiakku ist das
   * Gegenteil: ein geschlossener schwarzer Kasten mit hellem Deckel, zwei
   * Polen und Zellenstopfen. Eigener Bau `batterie`; die Palette bekommt ihn
   * auch, damit alles, was Batterie heisst, gleich aussieht.
   *
   * Massen unveraendert. Sie halten die Feststoffprobe: Ein 60-Ah-Akku wiegt
   * 16 kg bei 7,6 Litern (`FESTSTOFFDICHTE.battery` = 2100 kg/m³).
   */
  { materialId: "battery", massKg: 19, kind: "box", dims: [0.35, 0.22, 0.19], bau: "batterie", name: "Starterbatterie" },
  { materialId: "battery", massKg: 46, kind: "box", dims: [0.52, 0.24, 0.28], bau: "batterie", name: "LKW-Batterie" },
  { materialId: "battery", massKg: 180, kind: "box", dims: [0.9, 0.7, 0.75], bau: "batterie", name: "Batteriepalette" },
  { materialId: "battery", massKg: 320, kind: "box", dims: [1.2, 0.8, 0.9], bau: "batterie", name: "Staplerbatterie" },
  /* --- Vier Akkus mehr (E-063): vier Sorten waren zu wenig fuer eine Mulde ---
   *
   * Masse je Stueck aus Volumen x 2100 kg/m³ (Akku als Geraet, nicht als
   * reines Blei — `materials/schuettdichte.ts`), mit dem Fuellgrad, den die
   * Bauform hergibt. Zum Vergleich von Hand: Eine Motorradbatterie traegt man
   * mit zwei Fingern, eine Batteriebank braucht den Bagger.
   */
  // 18 x 17 x 9 cm, 4 kg — die Groesse einer 12-V-Motorradbatterie.
  { materialId: "battery", massKg: 4, kind: "box", dims: [0.18, 0.17, 0.09], bau: "batterie", name: "Motorrad-Batterie" },
  // USV-Einschub aus dem Serverraum: 0,12 m³, 180 kg = 1500 kg/m³.
  { materialId: "battery", massKg: 180, kind: "box", dims: [0.6, 0.4, 0.5], bau: "batterie", name: "USV-Batterieblock" },
  // Traktionszellen aus einem Elektrostapler, gebuendelt: 0,105 m³, 160 kg.
  { materialId: "battery", massKg: 160, kind: "box", dims: [0.5, 0.6, 0.35], bau: "batterie", name: "Traktionszellen (Bund)" },
  // Hausspeicher, Bleigel: 0,149 m³, 95 kg = 640 kg/m³ (viel Gehaeuse).
  { materialId: "battery", massKg: 95, kind: "box", dims: [0.55, 0.9, 0.3], bau: "batterie", name: "Solarspeicher-Batterie" },
  // --- Landwirtschaft ---
  { materialId: "steel", massKg: 95, kind: "box", dims: [1.9, 1.1, 0.3], bau: "stapel", name: "Silo-Blechsegment" },
  { materialId: "steel", massKg: 140, kind: "box", dims: [0.45, 0.45, 2.2], bau: "rahmenbox", name: "Melkstand-Gitterwerk" },
  { materialId: "steel", massKg: 180, kind: "cyl", dims: [0.3, 1.8], bau: "rohrFlansch", name: "Häcksler-Auswurfkrümmer" },
  { materialId: "steel", massKg: 150, kind: "box", dims: [1.0, 0.14, 2.1], bau: "platte", name: "Kartoffelroder-Siebkette" },

  // --- Industrie ---
  { materialId: "steel", massKg: 120, kind: "box", dims: [1.2, 0.8, 0.8], bau: "rahmenbox", name: "Gitterbox" },
  { materialId: "steel", massKg: 165, kind: "box", dims: [0.9, 0.55, 0.8], bau: "elektromotor", name: "Kreiselpumpe mit Grundplatte", zusammensetzung: [{ materialId: "steel", anteil: 0.72 }, { materialId: "copper", anteil: 0.2 }, { materialId: "alu", anteil: 0.08 }] },
  { materialId: "steel", massKg: 200, kind: "box", dims: [0.65, 0.6, 0.7], bau: "maschine", name: "Großgetriebe (Industrie)" },
  { materialId: "steel", massKg: 190, kind: "box", dims: [1.1, 1.0, 0.75], bau: "maschine", name: "Schraubenkompressor" },
  { materialId: "steel", massKg: 130, kind: "cyl", dims: [0.32, 1.6], bau: "rohrFlansch", name: "Wärmetauscher-Bündel" },
  { materialId: "steel", massKg: 75, kind: "box", dims: [0.7, 0.7, 1.9], bau: "buendel", name: "Lüftungskanäle (Bündel)" },
  { materialId: "steel", massKg: 160, kind: "box", dims: [1.3, 0.45, 2.2], bau: "ausleger", name: "Späneförderer" },
  { materialId: "steel", massKg: 145, kind: "box", dims: [0.85, 0.7, 0.9], bau: "maschine", name: "Hallenkran-Laufkatze" },
  { materialId: "steel", massKg: 105, kind: "box", dims: [0.25, 0.25, 2.2], bau: "buendel", name: "Palettenregal-Traversen (Bund)" },

  // --- Haushalt ---
  { materialId: "steel", massKg: 55, kind: "box", dims: [0.6, 1.7, 0.6], bau: "weisseWare", name: "Kühlschrank", zusammensetzung: [{ materialId: "steel", anteil: 0.52 }, { materialId: "alu", anteil: 0.1 }, { materialId: "copper", anteil: 0.06 }, { materialId: "plastic", anteil: 0.32 }] },
  { materialId: "steel", massKg: 62, kind: "box", dims: [1.3, 0.85, 0.65], bau: "weisseWare", name: "Gefriertruhe", zusammensetzung: [{ materialId: "steel", anteil: 0.55 }, { materialId: "alu", anteil: 0.08 }, { materialId: "copper", anteil: 0.05 }, { materialId: "plastic", anteil: 0.32 }] },
  { materialId: "steel", massKg: 33, kind: "box", dims: [0.6, 0.85, 0.6], bau: "weisseWare", name: "Wäschetrockner", zusammensetzung: [{ materialId: "steel", anteil: 0.62 }, { materialId: "alu", anteil: 0.06 }, { materialId: "copper", anteil: 0.1 }, { materialId: "plastic", anteil: 0.22 }] },
  { materialId: "steel", massKg: 28, kind: "box", dims: [0.6, 0.6, 0.6], bau: "weisseWare", name: "Einbauherd mit Umluftofen", zusammensetzung: [{ materialId: "steel", anteil: 0.78 }, { materialId: "alu", anteil: 0.04 }, { materialId: "copper", anteil: 0.05 }, { materialId: "plastic", anteil: 0.13 }] },
  { materialId: "va", massKg: 14, kind: "box", dims: [0.9, 0.5, 0.5], bau: "weisseWare", name: "Dunstabzugshaube" },
  { materialId: "steel", massKg: 36, kind: "box", dims: [0.45, 0.8, 0.35], bau: "maschine", name: "Gastherme", zusammensetzung: [{ materialId: "steel", anteil: 0.55 }, { materialId: "copper", anteil: 0.28 }, { materialId: "alu", anteil: 0.07 }, { materialId: "plastic", anteil: 0.1 }] },
  { materialId: "plastic", massKg: 45, kind: "box", dims: [1.2, 1.5, 0.75], bau: "tank", name: "Öltank (Keller, Kunststoff)" },
  { materialId: "copper", massKg: 34, kind: "box", dims: [0.9, 0.65, 0.35], bau: "maschine", name: "Split-Klimagerät", zusammensetzung: [{ materialId: "steel", anteil: 0.45 }, { materialId: "copper", anteil: 0.3 }, { materialId: "alu", anteil: 0.15 }, { materialId: "plastic", anteil: 0.1 }] },
  // E-063: war `container` — mit Eckbeschlaegen und Tuerfluegeln, in
  // Seecontainer-Blau. Ein Ölradiator ist ein Rippenkoerper: `platte`, wie der
  // Heizkoerper drei Zeilen weiter unten.
  { materialId: "steel", massKg: 24, kind: "box", dims: [0.45, 0.65, 0.25], bau: "platte", name: "Ölradiator" },
  { materialId: "steel", massKg: 130, kind: "box", dims: [0.55, 0.7, 0.5], bau: "maschine", name: "Gusseiserner Badeofen" },
  { materialId: "steel", massKg: 165, kind: "box", dims: [0.6, 0.8, 0.55], bau: "maschine", name: "Kachelofen-Einsatz" },
  { materialId: "steel", massKg: 40, kind: "box", dims: [1.45, 0.35, 2.05], bau: "rahmenbox", name: "Doppelbett-Gestell" },
  { materialId: "wood", massKg: 48, kind: "box", dims: [0.95, 0.45, 2.0], bau: "stapel", name: "Lattenrost-Stapel" },
  { materialId: "plastic", massKg: 55, kind: "box", dims: [1.4, 0.7, 2.0], bau: "stapel", name: "Matratzenstapel" },
  /*
   * E-061: Eine Couch ist Muell, kein Mischschrott.
   *
   * Patrick, 15.09.2026: „Wenn etwas wie eine Couch aussieht, dass es auch
   * eine Couch ist. Und dann ist es Muell, dann ist es kein VA."
   *
   * Vorher stand hier eine Stueckliste (55 % Kunststoff, 30 % Holz, 15 %
   * Stahl). Rechnerisch war das korrekt und machte das Sofa zu Mischschrott —
   * einer Fraktion, die GELD BRINGT (0,16 €/kg). Genau das ist der
   * Widerspruch: Kein Schrotthaendler zahlt fuer eine Couch, er laesst sich
   * die Entsorgung bezahlen. Ohne Stueckliste bleibt die Vorgabe stehen, und
   * `plastic` (Kunststoff, −0,06 €/kg) ist die Entsorgungsfraktion, in die
   * Polstermoebel gehoeren.
   *
   * Der Stahl im Rahmen geht dabei nicht verloren — er ist nur nichts wert,
   * solange niemand die Couch zerlegt. Das ist dieselbe Logik wie beim
   * Kuehlschrank, nur andersherum.
   *
   * Nebenwirkung, gewollt: Die Griff-Info schweigt jetzt bei der Couch. Abfall
   * braucht keine Materialangabe (`src/ui/hud.ts`, `STOFFWORT`).
   *
   * E-063 setzt den zweiten Teil um: Die Couch traegt jetzt `bau: "polster"`.
   * Vorher entschied `moebel` nach den Abmessungen, ob etwas in Stoff bezogen
   * dasteht — die Couch traf es zufaellig richtig, vier andere zufaellig
   * falsch. Jetzt sagt es der Eintrag selbst, und `test/bauart.test.ts` haelt
   * fest, dass jeder Traeger dieses Baus in den MUELL geht.
   */
  { materialId: "plastic", massKg: 70, kind: "box", dims: [2.1, 0.9, 0.95], bau: "polster", name: "Couch (Dreisitzer)" },
  /*
   * Zwei Polstermoebel mehr (E-063). Patrick nannte „Couch, Sessel,
   * Matratze" — Sessel und Ohrensessel fehlten, und ein Bau mit einem
   * einzigen Traeger laesst sich nicht pruefen.
   *
   * Masse: Ein Dreisitzer wiegt 70 kg (Zeile oben). Der Sessel hat rund ein
   * Drittel der Sitzflaeche, der Zweisitzer zwei Drittel — 24 und 48 kg.
   * Beides traegt ein Mensch allein; die Hüllwichte bleibt weit unter der von
   * Kunststoff (1900 kg/m³), wie es sich fuer Schaum und Stoff gehoert.
   */
  { materialId: "plastic", massKg: 24, kind: "box", dims: [0.95, 0.85, 0.9], bau: "polster", name: "Sessel (Polster)" },
  { materialId: "plastic", massKg: 48, kind: "box", dims: [1.6, 0.85, 0.9], bau: "polster", name: "Couch (Zweisitzer)" },
  { materialId: "wood", massKg: 65, kind: "box", dims: [1.0, 2.0, 0.6], bau: "moebel", name: "Schrankwand-Segment", zusammensetzung: [{ materialId: "wood", anteil: 0.88 }, { materialId: "steel", anteil: 0.08 }, { materialId: "plastic", anteil: 0.04 }] },
  { materialId: "alu", massKg: 26, kind: "box", dims: [0.9, 1.9, 0.12], bau: "fensterflaeche", name: "Duschkabine" },
  { materialId: "alu", massKg: 42, kind: "cyl", dims: [0.28, 1.5], bau: "rohrFlansch", name: "Rollladenpanzer (aufgerollt)" },
  { materialId: "wood", massKg: 85, kind: "box", dims: [2.1, 1.9, 0.12], bau: "fensterflaeche", name: "Gartenhaus-Wandelement" },
  // E-063: war `maschine` — Verkleidung mit Bedienpult und vier Fuessen. Ein
  // Aufsitzmaeher hat Sitz, Lenkrad und vier Raeder: `kleinfahrzeug`.
  { materialId: "steel", massKg: 180, kind: "box", dims: [1.0, 0.9, 1.7], bau: "kleinfahrzeug", name: "Aufsitzmäher", zusammensetzung: [{ materialId: "steel", anteil: 0.7 }, { materialId: "plastic", anteil: 0.14 }, { materialId: "alu", anteil: 0.06 }, { materialId: "tires", anteil: 0.06 }, { materialId: "copper", anteil: 0.04 }] },

  // --- Wohnwagen und Freizeit ---
  { materialId: "steel", massKg: 95, kind: "box", dims: [1.55, 0.4, 0.6], bau: "achse", name: "Wohnwagen-Achse" },
  { materialId: "alu", massKg: 60, kind: "box", dims: [2.2, 1.9, 0.06], bau: "fensterflaeche", name: "Wohnwagen-Wandelement" },
  { materialId: "alu", massKg: 24, kind: "box", dims: [0.2, 0.2, 2.2], bau: "buendel", name: "Vorzelt-Gestänge (Bund)" },
  { materialId: "steel", massKg: 38, kind: "box", dims: [0.55, 0.6, 0.5], bau: "weisseWare", name: "Wohnwagen-Kühlschrank (Absorber)", zusammensetzung: [{ materialId: "steel", anteil: 0.52 }, { materialId: "alu", anteil: 0.1 }, { materialId: "copper", anteil: 0.06 }, { materialId: "plastic", anteil: 0.32 }] },
  { materialId: "plastic", massKg: 160, kind: "box", dims: [1.1, 0.75, 2.2], bau: "wasserfahrzeug", name: "Jetski", zusammensetzung: [{ materialId: "plastic", anteil: 0.58 }, { materialId: "steel", anteil: 0.24 }, { materialId: "alu", anteil: 0.1 }, { materialId: "copper", anteil: 0.08 }] },
  { materialId: "steel", massKg: 210, kind: "box", dims: [1.15, 1.0, 1.85], bau: "kleinfahrzeug", name: "Quad", zusammensetzung: [{ materialId: "steel", anteil: 0.62 }, { materialId: "plastic", anteil: 0.16 }, { materialId: "alu", anteil: 0.1 }, { materialId: "tires", anteil: 0.08 }, { materialId: "copper", anteil: 0.04 }] },
  { materialId: "steel", massKg: 175, kind: "box", dims: [1.2, 1.7, 2.2], bau: "kabine", name: "Golfwagen", zusammensetzung: [{ materialId: "steel", anteil: 0.55 }, { materialId: "plastic", anteil: 0.2 }, { materialId: "alu", anteil: 0.1 }, { materialId: "tires", anteil: 0.08 }, { materialId: "copper", anteil: 0.07 }] },
  { materialId: "steel", massKg: 95, kind: "box", dims: [0.7, 1.05, 1.9], bau: "einspurig", name: "Motorroller (komplett)", zusammensetzung: [{ materialId: "steel", anteil: 0.58 }, { materialId: "plastic", anteil: 0.2 }, { materialId: "alu", anteil: 0.12 }, { materialId: "tires", anteil: 0.06 }, { materialId: "copper", anteil: 0.04 }] },
  // Kufen vorn, Raupe hinten — kein Rad (Befund 14.09.2026, siehe objektbau.ts)
  { materialId: "steel", massKg: 205, kind: "box", dims: [1.15, 1.1, 2.2], bau: "kufenRaupe", name: "Schneemobil", zusammensetzung: [{ materialId: "steel", anteil: 0.55 }, { materialId: "plastic", anteil: 0.22 }, { materialId: "alu", anteil: 0.12 }, { materialId: "tires", anteil: 0.07 }, { materialId: "copper", anteil: 0.04 }] },
  // E-063: war `tank` — liegender Zylinder mit Sattel, Domdeckel und Stutzen.
  // Ein Ruderboot ist ein Rumpf mit Steven und Duchten: eigener Bau `boot`.
  { materialId: "alu", massKg: 55, kind: "box", dims: [1.2, 0.45, 2.2], bau: "boot", name: "Ruderboot (Alu)" },

  // --- Fahrzeugschrott ---
  { materialId: "tires", massKg: 45, kind: "cyl", dims: [0.32, 1.0], bau: "stapel", name: "Reifenstapel (Pkw)" },
  { materialId: "tires", massKg: 120, kind: "cyl", dims: [0.55, 1.2], bau: "stapel", name: "Reifenstapel (LKW)" },
  // Alufelge statt Stahlfelge: Das lohnt zu trennen — aber nicht mit der
  // Spinne, sondern mit Flex oder Abdrueckmaschine (Ansage 12.09.2026).
  { materialId: "mixed", massKg: 24, kind: "cyl", dims: [0.34, 0.24], name: "Rad mit Alufelge", trennbar: true, nurWerkzeug: true, zusammensetzung: [{ materialId: "tires", anteil: 0.58 }, { materialId: "alu", anteil: 0.42 }] },
  { materialId: "steel", massKg: 95, kind: "cyl", dims: [0.28, 1.1], bau: "stapel", name: "Felgenstapel (Stahl)", massiv: true }, // E-042: derselbe Gegenstand wie die LKW-Felge, nur gestapelt
  { materialId: "steel", massKg: 190, kind: "box", dims: [0.75, 0.7, 0.8], bau: "motor", name: "Motorblock (V8, ausgebaut)", zusammensetzung: [{ materialId: "steel", anteil: 0.82 }, { materialId: "alu", anteil: 0.14 }, { materialId: "copper", anteil: 0.04 }] },
  { materialId: "alu", massKg: 85, kind: "box", dims: [0.6, 0.65, 0.9], bau: "maschine", name: "Automatikgetriebe" },
  { materialId: "steel", massKg: 185, kind: "box", dims: [1.55, 0.5, 0.45], bau: "achse", name: "Hinterachse mit Differenzial" },
  { materialId: "va", massKg: 38, kind: "box", dims: [0.5, 0.4, 0.9], bau: "buendel", name: "Katalysator-Bündel" },
  { materialId: "plastic", massKg: 32, kind: "box", dims: [1.7, 0.6, 0.7], bau: "stapel", name: "Stoßfänger-Stapel" },
  { materialId: "steel", massKg: 88, kind: "box", dims: [1.5, 0.35, 1.3], bau: "stapel", name: "Motorhauben-Stapel" },
  { materialId: "steel", massKg: 110, kind: "box", dims: [1.1, 0.55, 1.2], bau: "buendel", name: "Fahrzeugtüren-Bund" },
  // E-063: Eine Sitzbank IST ein Polstermoebel — sie stand nur aus dem
  // falschen Grund als eines da (Massenzweig von `moebel`). Jetzt sagt es der
  // Eintrag, und die Fraktion ist wie bei der Couch Kunststoff = Muell.
  { materialId: "plastic", massKg: 30, kind: "box", dims: [1.35, 0.75, 0.7], bau: "polster", name: "Fahrzeug-Sitzbank" },

  // --- Bauabbruch ---
  { materialId: "steel", massKg: 205, kind: "box", dims: [1.1, 0.85, 0.95], bau: "schaufel", name: "Baggerlöffel", massiv: true, zusammensetzung: [{ materialId: "steel", anteil: 0.97 }, { materialId: "tires", anteil: 0.03 }] }, // E-042: Verschleissblech 15-20 mm, gerechnet nur 4,7 mm
  { materialId: "alu", massKg: 70, kind: "box", dims: [0.8, 0.45, 2.1], bau: "buendel", name: "Gerüstrahmen (Bund)" },
  { materialId: "wood", massKg: 110, kind: "box", dims: [0.6, 0.4, 2.2], bau: "stapel", name: "Gerüstbohlen (Stapel)" },
  { materialId: "steel", massKg: 145, kind: "box", dims: [0.35, 0.35, 2.2], bau: "buendel", name: "Stahlstützen-Bund" },
  { materialId: "steel", massKg: 120, kind: "box", dims: [1.6, 0.9, 0.35], bau: "rahmenbox", name: "Bauzaun-Felder (Stapel)" },
  { materialId: "steel", massKg: 85, kind: "box", dims: [1.9, 0.7, 0.25], bau: "rahmenbox", name: "Absperrgitter (Bund)" },

  // --- Gebäudetechnik ---
  { materialId: "steel", massKg: 190, kind: "box", dims: [0.7, 0.55, 0.6], bau: "maschine", name: "Aufzugs-Antriebsmaschine", zusammensetzung: [{ materialId: "steel", anteil: 0.7 }, { materialId: "copper", anteil: 0.26 }, { materialId: "alu", anteil: 0.04 }] },
  { materialId: "alu", massKg: 48, kind: "box", dims: [1.6, 1.1, 0.1], bau: "platte", name: "Fassadenelement (Metall)" },
  { materialId: "steel", massKg: 115, kind: "box", dims: [0.6, 1.9, 0.55], bau: "kabine", name: "Tankstellen-Zapfsäule" },
  { materialId: "va", massKg: 160, kind: "box", dims: [0.9, 1.1, 0.85], bau: "weisseWare", name: "Krankenhaus-Sterilisator" },
  { materialId: "steel", massKg: 95, kind: "box", dims: [0.4, 1.1, 0.4], bau: "kabine", name: "Parkhaus-Schrankenanlage" },
  { materialId: "va", massKg: 145, kind: "box", dims: [2.2, 1.1, 0.75], bau: "weisseWare", name: "Supermarkt-Kühlregal", zusammensetzung: [{ materialId: "va", anteil: 0.45 }, { materialId: "steel", anteil: 0.3 }, { materialId: "copper", anteil: 0.12 }, { materialId: "plastic", anteil: 0.13 }] },
  // E-063: war `rahmenbox` — ein Gittergestell, durch das man hindurchsieht.
  // Eine Kassentheke ist ein geschlossener Korpus: `moebel`.
  { materialId: "steel", massKg: 70, kind: "box", dims: [1.8, 0.9, 0.7], bau: "moebel", name: "Supermarkt-Kassentheke" },

  // --- Luftfahrt ---
  { materialId: "alu", massKg: 80, kind: "box", dims: [1.5, 1.6, 0.15], bau: "platte", name: "Flugzeug-Seitenleitwerk" },
  { materialId: "alu", massKg: 110, kind: "box", dims: [2.2, 0.15, 0.8], bau: "platte", name: "Flugzeug-Höhenleitwerk" },
  { materialId: "steel", massKg: 195, kind: "box", dims: [0.45, 1.5, 0.5], bau: "achse", name: "Flugzeug-Fahrwerksbein" },
  { materialId: "alu", massKg: 65, kind: "cyl", dims: [0.8, 1.6], bau: "tank", name: "Triebwerksverkleidung" },
  // E-063: war `platte` — ein Blech mit umgekanteten Raendern. Eine
  // Luftschraube ist Nabe plus zwei Blaetter: eigener Bau `propeller`.
  { materialId: "alu", massKg: 90, kind: "box", dims: [2.2, 0.25, 2.2], bau: "propeller", name: "Propeller (Metall)" },
  // E-063: war `motor` — mit Zylinderkopf und Oelwanne. Ein Rotorkopf ist eine
  // Nabe mit Blattanschluessen; `achse` trifft das am naechsten.
  { materialId: "steel", massKg: 205, kind: "cyl", dims: [0.45, 0.6], bau: "achse", name: "Rotorkopf" },
  { materialId: "alu", massKg: 75, kind: "box", dims: [0.35, 0.25, 2.2], bau: "buendel", name: "Rotorblätter (Bund)" },
  { materialId: "alu", massKg: 85, kind: "box", dims: [1.5, 1.3, 1.6], bau: "rahmenbox", name: "Flughafen-Gepäckwagen" },
  { materialId: "alu", massKg: 130, kind: "box", dims: [1.5, 1.5, 2.0], bau: "container", name: "Luftfracht-Container (ULD)" },

  // --- Schiene ---
  // E-063: war `achse` — Rohr mit Bremstrommeln und Federbock. Ein Pufferpaar
  // ist zweimal Stahlguss am Stueck: `klotz`.
  { materialId: "steel", massKg: 200, kind: "box", dims: [0.6, 0.5, 0.6], bau: "klotz", name: "Eisenbahn-Puffer (Paar)" },
  { materialId: "steel", massKg: 175, kind: "box", dims: [0.35, 0.35, 2.2], bau: "buendel", name: "Schienenbündel" },
  { materialId: "steel", massKg: 160, kind: "box", dims: [0.3, 0.3, 2.2], bau: "buendel", name: "Weichenzunge" },
  { materialId: "steel", massKg: 140, kind: "box", dims: [0.4, 2.2, 0.4], bau: "buendel", name: "Oberleitungsmast" },
  { materialId: "steel", massKg: 105, kind: "box", dims: [0.5, 2.1, 0.5], bau: "buendel", name: "Signalmast mit Schirm" },
  { materialId: "wood", massKg: 190, kind: "box", dims: [0.9, 0.55, 2.2], bau: "stapel", name: "Bahnschwellen (Holzstapel)" },

  // --- Hafen ---
  // E-063: Schiffsschraube war `platte`, Stockanker und Poller waren `motor`.
  // Drei Gegenstaende, drei Formen — und keiner davon sieht aus wie ein
  // Motorblock mit Kruemmern.
  { materialId: "brass", massKg: 180, kind: "box", dims: [1.1, 0.3, 1.1], bau: "propeller", name: "Schiffsschraube" },
  { materialId: "steel", massKg: 175, kind: "box", dims: [1.4, 0.2, 1.1], bau: "platte", name: "Ruderblatt" },
  { materialId: "steel", massKg: 205, kind: "wire", dims: [0.7], bau: "haufen", name: "Ankerkette (Haufen)" },
  { materialId: "steel", massKg: 195, kind: "box", dims: [0.9, 1.3, 0.7], bau: "anker", name: "Stockanker" },
  { materialId: "steel", massKg: 190, kind: "cyl", dims: [0.3, 0.8], bau: "klotz", name: "Poller" },
  { materialId: "steel", massKg: 165, kind: "box", dims: [1.9, 0.2, 1.4], bau: "platte", name: "Schiffsluke (Deckel)" },

  // --- Lose Schrottmaterialien (nur Metall, Holz, Reifen) ---
  { materialId: "wood", massKg: 120, kind: "box", dims: [1.4, 0.9, 1.5], bau: "haufen", name: "Holzbruch-Haufen" },
  { materialId: "mixed", massKg: 175, kind: "box", dims: [1.2, 0.9, 1.2], bau: "haufen", name: "Mischschrott-Haufen" },
  { materialId: "steel", massKg: 190, kind: "wire", dims: [0.75], bau: "haufen", name: "Stahlteile-Haufen" },
  { materialId: "steel", massKg: 210, kind: "box", dims: [0.7, 0.7, 0.7], bau: "stapel", name: "Metallpaket (gepresst)" },
  { materialId: "tires", massKg: 95, kind: "wire", dims: [0.85], bau: "haufen", name: "Reifenhaufen" },
  { materialId: "steel", massKg: 205, kind: "box", dims: [0.55, 0.55, 1.3], bau: "stapel", name: "Schrottschere-Abschnitte" },
  /* --- Massives Kleinzeug (E-042, 15.09.2026) ---------------------------
   *
   * Patrick nannte als Premium-Beispiele "Bahnschwellen, Bremsscheiben,
   * Traeger" — und keines davon war im Katalog zu greifen. Dazu der Befund
   * aus der Messung: Nach der neuen Regel bleiben im Stahltopf der Kleinteile
   * nur 19 Sorten; jede sortenreine Stahlfuhre zeigte dieselben Stuecke.
   *
   * Alle Massen sind gerechnet, nicht geschaetzt. Die Wandstaerke dahinter
   * ist die, die `wandstaerkeMm` aus Masse und Mass zurueckgibt — sie steht
   * hier, damit man beim Aendern sofort sieht, wo die Schwelle (6 mm) liegt.
   */
  // Bremsscheibe LKW: 430 mm Durchmesser, 38 kg. Das Huellmass ist die Tiefe
  // MIT Topf und Nabe (0,12 m), nicht die Reibringdicke — duenner legt
  // Rapier eine Scheibe nicht ruhig ab, und 0,12 m ist im Projekt die
  // Grenze "duenn" (`DUENN_M`, purity.ts). Ohne `bau`, also in
  // Fraktionsfarbe: eines der wenigen Stuecke, an denen man sie ueberhaupt
  // sieht (docs/fraktionen.md, 2.3). -> 10,7 mm
  { materialId: "steel", massKg: 38, kind: "cyl", dims: [0.215, 0.12], name: "Bremsscheibe (LKW)" },
  // Y-Stahlschwelle, 2,2 m lang, rund 105 kg — die Bauform, die Holz- und
  // Betonschwellen im Gleisbau abloest. -> 6,2 mm, knapp ueber der Schwelle
  { materialId: "steel", massKg: 105, kind: "box", dims: [0.35, 0.12, 2.2], bau: "traeger", name: "Bahnschwelle (Stahl, Y-Form)" },
  // Schiene S49: 49,4 kg je Meter, hier ein Abschnitt von 1,2 m = 60 kg.
  // Profilhoehe 149 mm, Fussbreite 125 mm. -> 10,7 mm
  { materialId: "steel", massKg: 60, kind: "box", dims: [0.13, 0.15, 1.2], bau: "traeger", name: "Schienenabschnitt" },
  // Kurbelwelle eines Sechszylinder-LKW-Motors, geschmiedet, 1,2 m. -> 14,0 mm
  { materialId: "steel", massKg: 90, kind: "cyl", dims: [0.1, 1.2], bau: "achse", name: "Kurbelwelle (LKW)" },
  // Grosszahnrad, 560 mm Durchmesser, mit Nabe 0,12 m breit (wie oben). -> 15,4 mm
  { materialId: "steel", massKg: 85, kind: "cyl", dims: [0.28, 0.12], name: "Großzahnrad" },
  // Schmiedeamboss, 120 kg — das massivste Stueck seiner Groesse. -> 21,8 mm
  { materialId: "steel", massKg: 120, kind: "box", dims: [0.5, 0.25, 0.3], bau: "klotz", name: "Amboss" }, // E-063: war `motor`
  // Grobblech 20 mm, Zuschnitt 0,80 x 1,20 m: 7850 x 0,02 x 0,96 = 151 kg.
  // Das Huellmass ist mit 0,06 m absichtlich dicker als die Platte — duenner
  // legt Rapier Bleche nicht sicher ab (Lehre v2 E-011). Gegenstueck zum
  // "Blech" aus SPECS (55 kg, 4,8 mm, Mischschrott): dieselbe Form, dreimal
  // die Masse, andere Mulde. -> 8,8 mm
  { materialId: "steel", massKg: 150, kind: "box", dims: [0.8, 0.06, 1.2], bau: "platte", name: "Grobblech-Zuschnitt (20 mm)" },

  /* ====================================================================== *
   * Die duennen Fraktionen auffuellen (E-063, 15.09.2026)                  *
   * ====================================================================== *
   *
   * Patrick, 15.09.2026, auf die Frage nach den duennen Fraktionen:
   * „Auffuellen, mindestens acht je Fraktion."
   *
   * Warum die Zahl an dieser Liste haengt und nicht am Gesamtkatalog:
   * `randomCargo` zieht jedes Stueck aus GENAU EINER Groessenklasse. Eine
   * sortenreine Kleinteil-Fuhre sieht nur das, was hier und in `SPECS` steht.
   * Gemessen am 15.09.2026 (`npx vite-node tools/katalog-aussehen.ts klassen`)
   * waren das Kupfer 2, Messing 2, Kabel 3, VA 6, Zink 4, Batterien 4: Eine
   * sortenreine Kupferfuhre bestand aus zwei verschiedenen Dingen.
   *
   * **Jede Masse ist gerechnet, keine geschaetzt.** Die Rechnung steht je
   * Zeile: Volumen mal Feststoffdichte des Werkstoffs mal dem Fuellgrad, den
   * die Bauform hergibt (Kupfer 8960, Messing 8700, Kabel 2500, VA 7900
   * kg/m³ — `materials/schuettdichte.ts`). `test/gewicht.test.ts` prueft das
   * Ergebnis gegen dieselbe Dichte nach: Eine Messingarmatur von 900 kg ist
   * ein Fehler, keine Armatur.
   *
   * Die Bauzweige sind so gewaehlt, dass Name und Anblick decken — sonst waere
   * mit der einen Hand kaputtgemacht, was die andere gerade in Ordnung
   * gebracht hat.
   */

  // --- Kupfer: Rohr, Draht, Schiene, Kessel (2 -> 8) ---
  // Wickeldraht einer ausgeschlachteten Motorwicklung. Ringvolumen
  // 2π²·0,13·0,05² = 0,00642 m³, bei 60 % Wickeldichte 34 kg.
  { materialId: "copper", massKg: 34, kind: "torus", dims: [0.13, 0.05], name: "Wickeldraht (Kupferspule)" },
  // Sechs Sammelschienen 40 x 10 mm, 2,0 m: 6 · 0,0008 · 2 · 8960 = 86 kg.
  { materialId: "copper", massKg: 86, kind: "box", dims: [0.12, 0.12, 2.0], bau: "buendel", name: "Stromschienen-Bund (Kupfer)" },
  // Waschkessel, Ø 560 mm, 450 hoch, 2 mm Wand: 1,04 m² · 0,002 · 8960 = 19 kg.
  { materialId: "copper", massKg: 19, kind: "cyl", dims: [0.28, 0.45], bau: "tank", name: "Kupferkessel (Waschkessel)" },
  // Sieben Fallrohre Ø 80, 0,6 mm, 2,2 m: 7 · 2,2 · 1,35 kg/m = 21 kg.
  { materialId: "copper", massKg: 21, kind: "box", dims: [0.22, 0.22, 2.2], bau: "buendel", name: "Kupfer-Fallrohr (Bund)" },
  // Lamellenblock eines Kuehlers, rund 6 % Feststoff auf 0,05 m³: 27 kg.
  { materialId: "copper", massKg: 27, kind: "box", dims: [0.5, 0.4, 0.25], bau: "stapel", name: "Kupfer-Lamellenblock" },
  // Erdungsband 30 x 3 mm, 25 m aufgerollt: 0,00225 m³ · 8960 = 20 kg.
  { materialId: "copper", massKg: 20, kind: "cyl", dims: [0.2, 0.12], bau: "trommel", name: "Erdungsband (Kupfer, Rolle)" },

  // --- Messing: Armatur, Ventil, Lagerschale, Beschlag (2 -> 8) ---
  // Absperrschieber DN100, Rotguss — Katalogmasse eines echten Schiebers.
  { materialId: "brass", massKg: 22, kind: "box", dims: [0.34, 0.4, 0.34], bau: "armatur", name: "Absperrschieber (Messing)" },
  // Industrie-Ventilblock, 0,09 m³ Huelle, 833 kg/m³ (viel Hohlraum im Gehaeuse).
  { materialId: "brass", massKg: 75, kind: "box", dims: [0.45, 0.5, 0.4], bau: "armatur", name: "Messing-Ventilblock" },
  // Vierzig ausgebaute Hauswasserzaehler à 2,5 kg auf einer Palette.
  { materialId: "brass", massKg: 105, kind: "box", dims: [0.8, 0.5, 0.6], bau: "stapel", name: "Wasserzähler (Messing, Palette)" },
  // Gestapelte Gleitlagerschalen: 0,061 m³ bei rund 18 % Feststoff = 95 kg.
  { materialId: "brass", massKg: 95, kind: "box", dims: [0.45, 0.3, 0.45], bau: "stapel", name: "Messing-Lagerschalen (Stapel)" },
  // Tuerklinken, Schilder, Bandbeschlaege lose geschuettet: 0,043 m³, 980 kg/m³.
  { materialId: "brass", massKg: 42, kind: "box", dims: [0.35, 0.35, 0.35], bau: "haufen", name: "Messing-Türbeschläge (Haufen)" },
  // Rohrbogen und Fittinge gebuendelt: 0,075 m³ Huelle, 400 kg/m³.
  { materialId: "brass", massKg: 30, kind: "box", dims: [0.25, 0.25, 1.2], bau: "buendel", name: "Messing-Rohrbogen (Bund)" },

  // --- Kabel: Erdkabel, Steuerleitung, Litze (3 -> 8) ---
  // NYY-Ring, Ringvolumen 2π²·0,35·0,10² = 0,069 m³, 55 % Wickeldichte.
  { materialId: "cable", massKg: 85, kind: "torus", dims: [0.35, 0.1], name: "Erdkabel-Ring (NYY)" },
  // Steuerleitung, kleiner Ring: 0,0131 m³, 1140 kg/m³.
  { materialId: "cable", massKg: 15, kind: "torus", dims: [0.22, 0.055], name: "Steuerleitung (Ring)" },
  // Feindraehtige Litze, gebuendelt: 0,056 m³, 800 kg/m³.
  { materialId: "cable", massKg: 45, kind: "box", dims: [0.25, 0.25, 0.9], bau: "buendel", name: "Kabellitze (Bund)" },
  // Abschnitte aus einer Trafostation, gebuendelt: 0,099 m³, 1110 kg/m³.
  { materialId: "cable", massKg: 110, kind: "box", dims: [0.3, 0.3, 1.1], bau: "buendel", name: "Starkstromkabel (Bund)" },
  // Ausgerissene Netzwerkverkabelung, loser Verhau — 0,70 m³ und nur 57 kg/m³:
  // fast alles Luft, und genau so sperrig faehrt es sich auf der Pritsche.
  { materialId: "cable", massKg: 40, kind: "wire", dims: [0.55], bau: "haufen", name: "Datenkabel-Verhau (Ballen)" },

  // --- VA: Rohrbogen, Behaelter, Gelaender, Blech (6 -> 12) ---
  // Rohrbogen DN200, 2 mm Wand, mit zwei Flanschen: 18 kg.
  { materialId: "va", massKg: 18, kind: "box", dims: [0.35, 0.35, 0.5], bau: "rohrFlansch", name: "VA-Rohrbogen (DN200)" },
  // Gastro-Kochkessel Ø 700, 750 hoch, 2,5 mm: 2,42 m² · 0,0025 · 7900 = 48 kg.
  { materialId: "va", massKg: 48, kind: "cyl", dims: [0.35, 0.75], bau: "tank", name: "Gastro-Kochkessel (VA)" },
  // Zwoelf Gelaenderstaebe Ø 14 mm, 2,0 m, massiv: 12 · 0,000308 m³ · 7900 = 29 kg.
  { materialId: "va", massKg: 30, kind: "box", dims: [0.18, 0.18, 2.0], bau: "buendel", name: "VA-Geländerstäbe (Bund)" },
  // Milchkanne, 1,2 mm Blech, 1,13 m² Mantel und Boden: 11 kg, mit Deckel 12.
  { materialId: "va", massKg: 12, kind: "cyl", dims: [0.22, 0.6], bau: "tank", name: "Milchkanne (VA)" },
  // Lochblech 3 mm, 0,9 x 1,2 m, 30 % Lochanteil: 1,08 · 0,003 · 0,7 · 7900 = 18 kg.
  // Huellmass 0,06 m statt 3 mm — duenner legt Rapier ein Blech nicht ab (v2 E-011).
  { materialId: "va", massKg: 18, kind: "box", dims: [0.9, 0.06, 1.2], bau: "platte", name: "VA-Lochblech (Tafel)" },
  // Plattenwaermetauscher, 0,09 m³ Huelle bei rund 9 % Feststoff: 65 kg.
  { materialId: "va", massKg: 65, kind: "box", dims: [0.3, 0.6, 0.5], bau: "stapel", name: "VA-Plattenwärmetauscher" },

  /* ====================================================================== *
   * DIE VIER ABFALLSORTEN BEKOMMEN GEGENSTAENDE (16.09.2026)
   *
   * Anlass, aus Patricks Geraetetest: „‚Stoerstoff' aufloesen in Holz,
   * Baumischabfall, Reifen und Kunststoffe — Stoerstoff sagt niemandem etwas."
   *
   * Die Namen gab es seit dem 15.09. (E-067), die GEGENSTAENDE nicht: In der
   * Kleinteil-Klasse — der einzigen, aus der eine gewoehnliche Anlieferung
   * zieht — standen Reifen bei vier Sorten, Holz bei sechs und
   * **Baumischabfall bei NULL**. Eine Fraktion ohne Gegenstaende ist ein Wort
   * auf einem Schild. E-067 hatte das Auffuellen ausdruecklich vertagt, weil
   * es die Mischung in `randomCargo` und damit den Verdienst verschiebt; genau
   * das ist hier NICHT passiert (siehe `REST_LOSE` in `world/scrapItems.ts` —
   * die Anteile stehen auf die Stelle genau, wo sie standen).
   *
   * Ziel ist dieselbe Zahl wie bei den Metallen: **acht Sorten je Fraktion in
   * der Kleinteil-Klasse** (Patrick, 15.09.2026: „Auffuellen, mindestens acht
   * je Fraktion"). `test/gewicht.test.ts` haelt sie fest.
   *
   * JEDE MASSE IST GERECHNET, die Rechnung steht an der Zeile. Als Dichten
   * dienen die Feststoffdichten aus `materials/schuettdichte.ts`
   * (Holz 900, Reifen 1300, Baumischabfall 2500, Kunststoff 1900 kg/m³) —
   * sie sind Obergrenzen, und der Waechter in `test/gewicht.test.ts` rechnet
   * mit denselben.
   *
   * Nichts davon RIESELT: Bauschutt kommt im Bigbag, als Palette, als Stapel
   * oder als verkeilter Haufen — greifbar am Stueck (Ansage 12.09.2026, kein
   * Schuettgut).
   * ====================================================================== */

  /* --- Baumischabfall: 0 -> 8 Kleinteile -------------------------------- */
  // Mineralwolle im Bigbag: 0,891 m³ Huelle, lose 50 kg/m³ (Dammwolle liegt
  // zwischen 20 und 100) = 45 kg. Das Leichteste auf dem Platz, das trotzdem
  // einen ganzen Greifer fuellt — genau der Grund, warum Abfall Volumen frisst.
  { materialId: "rubble", massKg: 45, kind: "box", dims: [0.9, 1.1, 0.9], bau: "haufen", name: "Dämmwolle-Bigbag" },
  // Gipskarton 12,5 mm wiegt 9,5 kg/m². Sechs Platten 1,25 x 2,0 m = 15 m²
  // x 9,5 = 142 kg; Stapelhoehe 6 x 12,5 mm = 75 mm.
  { materialId: "rubble", massKg: 142, kind: "box", dims: [1.25, 0.075, 2.0], bau: "stapel", name: "Gipskarton-Platten (Stapel)" },
  // Dachziegel 3,5 kg je Stueck, rund 51 Stueck auf dem angebrochenen Stapel
  // = 180 kg. Eine volle Palette (240 Stueck, 840 kg) waere Grossteil-Klasse.
  { materialId: "rubble", massKg: 180, kind: "box", dims: [0.8, 0.45, 1.0], bau: "stapel", name: "Dachziegel (Palette)" },
  // Bordstein 15/30/100: 0,045 m³ Beton x 2350 kg/m³ = 106 kg. Der Handel
  // nennt 105 kg fuer genau dieses Mass.
  { materialId: "rubble", massKg: 105, kind: "box", dims: [0.15, 0.3, 1.0], bau: "beton", name: "Bordstein (Beton)" },
  // Gehwegplatte 50 x 50 x 5 cm wiegt 30 kg; vier gestapelt = 120 kg bei
  // 0,20 m Stapelhoehe.
  { materialId: "rubble", massKg: 120, kind: "box", dims: [0.5, 0.2, 0.5], bau: "stapel", name: "Gehwegplatten (Stapel)" },
  // Verkeilter Haufen Mauerwerksbrocken, Kugelhuelle r = 0,45 m = 0,382 m³.
  // Bei 190 kg sind das 498 kg/m³ — rund ein Fuenftel Vollstein, der Rest
  // Luft zwischen den Brocken. So liegt Abbruchmauerwerk wirklich.
  { materialId: "rubble", massKg: 190, kind: "wire", dims: [0.45], bau: "haufen", name: "Mauerwerk-Brocken (Haufen)" },
  // Porenbeton hat 500 kg/m³ (Rohdichteklasse 0,5). 0,32 m³ Steine auf der
  // angebrochenen Palette = 160 kg.
  { materialId: "rubble", massKg: 160, kind: "box", dims: [0.8, 0.5, 0.8], bau: "stapel", name: "Porenbeton-Steine (Palette)" },
  // Badezimmer-Ausbau: WC 25 kg, Waschbecken 20, Spuelkasten 10 = 55 kg.
  { materialId: "rubble", massKg: 55, kind: "box", dims: [0.7, 0.5, 0.6], bau: "stapel", name: "Sanitärkeramik (WC und Becken)" },

  /* --- Reifen: 4 -> 8 Kleinteile ---------------------------------------- */
  // LKW-Reifen 315/80 R22.5: Aussendurchmesser 1,08 m, Breite 0,315 m, 62 kg
  // (Herstellerangabe fuer diese gaengige Groesse). Als Torus
  // R = 0,52 / r = 0,14.
  { materialId: "tires", massKg: 62, kind: "torus", dims: [0.52, 0.14], name: "LKW-Reifen" },
  // Radladerreifen 17.5 R25: 1,45 m Aussendurchmesser, 160 kg. Der schwerste
  // Einzelreifen, den die Spinne noch bequem traegt.
  { materialId: "tires", massKg: 160, kind: "torus", dims: [0.65, 0.22], name: "Erdbaureifen (Radlader)" },
  // Zehn Motorradreifen à 4 kg, zusammengebunden = 40 kg auf 0,18 m³.
  { materialId: "tires", massKg: 40, kind: "box", dims: [0.6, 0.5, 0.6], bau: "buendel", name: "Motorradreifen (Bund)" },
  // Vollgummireifen vom Stapler (18x7-8), 30 kg das Stueck, vier gestapelt
  // = 120 kg; Stapelhoehe 4 x 0,18 m = 0,72 m.
  { materialId: "tires", massKg: 120, kind: "cyl", dims: [0.28, 0.72], bau: "stapel", name: "Vollgummireifen (Stapler)" },

  /* --- Holz: 6 -> 8 Kleinteile ------------------------------------------ */
  // Europalette 1,2 x 0,8 m wiegt 25 kg; vier gestapelt = 100 kg bei 0,6 m.
  { materialId: "wood", massKg: 100, kind: "box", dims: [1.2, 0.6, 0.8], bau: "stapel", name: "Europaletten (Stapel)" },
  // Dachlatte 4 x 6 cm, 2,2 m: 0,00528 m³ x 500 kg/m³ (Fichte) = 2,64 kg.
  // Vierundzwanzig im Bund = 63 kg.
  { materialId: "wood", massKg: 63, kind: "box", dims: [0.3, 0.3, 2.2], bau: "buendel", name: "Dachlatten-Bund" },
];


/* ------------------------------------------------------------------------ */
/* Großteile — Händleranlieferungen                                           */
/* ------------------------------------------------------------------------ */

export const KATALOG_BIG: PileSpec[] = [
  // --- Landwirtschaft ---
  { materialId: "steel", massKg: 320, kind: "box", dims: [1.6, 1.7, 1.5], bau: "kabine", name: "Traktorkabine", zusammensetzung: [{ materialId: "steel", anteil: 0.8 }, { materialId: "rubble", anteil: 0.06 }, { materialId: "plastic", anteil: 0.1 }, { materialId: "alu", anteil: 0.04 }] },
  { materialId: "steel", massKg: 480, kind: "box", dims: [2.4, 0.7, 0.7], bau: "achse", name: "Traktor-Hinterachse" },
  { materialId: "steel", massKg: 260, kind: "box", dims: [1.9, 0.5, 0.6], bau: "achse", name: "Traktor-Vorderachse" },
  { materialId: "steel", massKg: 380, kind: "box", dims: [1.3, 0.5, 2.9], bau: "ausleger", name: "Frontlader-Schwinge" },
  { materialId: "steel", massKg: 240, kind: "box", dims: [2.1, 0.8, 0.9], bau: "schaufel", name: "Frontlader-Schaufel", massiv: true }, // E-042: Schaufelboden ist 8-15 mm Verschleissblech
  { materialId: "steel", massKg: 480, kind: "cyl", dims: [0.42, 0.85], bau: "trommel", name: "Häcksler-Trommel" }, // E-063: war `motor`
  { materialId: "steel", massKg: 210, kind: "box", dims: [0.8, 0.9, 0.7], bau: "maschine", name: "Güllefass-Pumpwerk" },
  { materialId: "steel", massKg: 340, kind: "cyl", dims: [0.4, 1.5], bau: "buendel", name: "Presskammerwalzen (Bund)" },
  { materialId: "steel", massKg: 420, kind: "box", dims: [2.6, 1.3, 1.0], bau: "gitterturm", name: "Sämaschine mit Saatkasten" },
  { materialId: "steel", massKg: 260, kind: "box", dims: [2.8, 0.35, 0.7], bau: "platte", name: "Mähwerk-Scheibenbalken" },
  { materialId: "alu", massKg: 190, kind: "box", dims: [3.2, 0.4, 0.4], bau: "buendel", name: "Feldspritze-Gestänge" },

  // --- Industrie ---
  { materialId: "steel", massKg: 560, kind: "box", dims: [1.5, 1.6, 1.4], bau: "maschine", name: "Exzenterpresse" },
  { materialId: "steel", massKg: 280, kind: "box", dims: [1.0, 0.7, 3.0], bau: "ausleger", name: "Förderband-Segment" },
  { materialId: "steel", massKg: 390, kind: "box", dims: [1.1, 0.9, 0.95], bau: "maschine", name: "Förderband-Antriebsstation" },
  { materialId: "steel", massKg: 310, kind: "cyl", dims: [0.5, 2.4], bau: "tank", name: "Druckluftbehälter" },
  { materialId: "steel", massKg: 580, kind: "box", dims: [1.9, 1.1, 0.95], bau: "maschine", name: "Notstromaggregat", zusammensetzung: [{ materialId: "steel", anteil: 0.74 }, { materialId: "copper", anteil: 0.18 }, { materialId: "alu", anteil: 0.08 }] },
  { materialId: "steel", massKg: 430, kind: "box", dims: [1.4, 1.5, 1.3], bau: "maschine", name: "Industrieofen-Kammer" },
  { materialId: "steel", massKg: 240, kind: "box", dims: [2.2, 1.5, 1.6], bau: "maschine", name: "Lüftungsaggregat (Dachgerät)" },
  { materialId: "steel", massKg: 300, kind: "cyl", dims: [0.85, 2.2], bau: "tank", name: "Zyklonabscheider" },
  { materialId: "steel", massKg: 470, kind: "box", dims: [1.2, 1.0, 3.2], bau: "gitterturm", name: "Rohrbrücke-Segment" },
  { materialId: "steel", massKg: 470, kind: "box", dims: [1.25, 2.6, 0.85], bau: "rahmenbox", name: "Gitterbox-Stapel" },
  { materialId: "steel", massKg: 350, kind: "box", dims: [1.1, 3.0, 0.9], bau: "rahmenbox", name: "Palettenregal-Rahmen" },
  { materialId: "steel", massKg: 260, kind: "box", dims: [2.6, 2.4, 0.2], bau: "platte", name: "Industrie-Rolltor" },
  { materialId: "steel", massKg: 330, kind: "box", dims: [2.4, 0.7, 1.1], bau: "buendel", name: "Sektionaltor-Panele (Bund)" },
  { materialId: "plastic", massKg: 210, kind: "box", dims: [2.2, 2.0, 2.0], bau: "tank", name: "Kühlturm-Zelle" },

  // --- Haushalt ---
  { materialId: "steel", massKg: 230, kind: "cyl", dims: [0.6, 2.4], bau: "tank", name: "Heizöltank (Stahl, liegend)" },
  { materialId: "wood", massKg: 240, kind: "box", dims: [2.6, 0.9, 0.65], bau: "moebel", name: "Küchenzeile (Segment)", zusammensetzung: [{ materialId: "wood", anteil: 0.74 }, { materialId: "steel", anteil: 0.16 }, { materialId: "plastic", anteil: 0.1 }] },

  // --- Wohnwagen und Freizeit ---
  { materialId: "steel", massKg: 420, kind: "box", dims: [2.0, 0.6, 3.4], bau: "fahrgestell", name: "Wohnwagen-Chassis" },
  { materialId: "steel", massKg: 260, kind: "box", dims: [1.8, 0.8, 3.2], bau: "fahrgestell", name: "Bootsanhänger" },
  // E-063: beide waren `tank`. Fuenf Boote im Katalog sahen aus wie liegende
  // Kessel mit Sattel und Domdeckel.
  { materialId: "plastic", massKg: 340, kind: "box", dims: [1.7, 1.1, 3.4], bau: "boot", name: "Sportboot-Rumpf (GFK)" },
  { materialId: "plastic", massKg: 280, kind: "box", dims: [2.0, 1.4, 2.6], bau: "boot", name: "Kajütboot-Aufbau" },
  { materialId: "steel", massKg: 380, kind: "box", dims: [2.0, 1.5, 3.0], bau: "fahrgestell", name: "Campinganhänger (Faltcaravan)", zusammensetzung: [{ materialId: "steel", anteil: 0.48 }, { materialId: "alu", anteil: 0.2 }, { materialId: "plastic", anteil: 0.22 }, { materialId: "wood", anteil: 0.1 }] },

  // --- Fahrzeugschrott ---
  { materialId: "steel", massKg: 520, kind: "box", dims: [1.9, 0.9, 3.4], bau: "fahrgestell", name: "Pritschenwagen-Fahrgestell" },
  { materialId: "steel", massKg: 560, kind: "box", dims: [2.3, 1.2, 3.0], bau: "container", name: "Kipper-Mulde" },
  { materialId: "alu", massKg: 300, kind: "cyl", dims: [1.0, 2.8], bau: "tank", name: "Tankauflieger-Segment" },
  { materialId: "steel", massKg: 240, kind: "box", dims: [0.6, 0.25, 3.2], bau: "stapel", name: "Autotransporter-Rampen" },
  { materialId: "steel", massKg: 260, kind: "box", dims: [1.5, 1.0, 2.8], bau: "fahrgestell", name: "Anhänger (Einachs, Plane)" },
  { materialId: "alu", massKg: 190, kind: "box", dims: [3.2, 2.2, 0.08], bau: "platte", name: "Kofferauflieger-Seitenwand" },

  // --- Bauabbruch ---
  { materialId: "steel", massKg: 590, kind: "box", dims: [1.1, 1.1, 3.2], bau: "ausleger", name: "Baggerausleger" },
  { materialId: "steel", massKg: 420, kind: "box", dims: [2.6, 0.9, 1.0], bau: "schaufel", name: "Radlader-Schaufel", massiv: true }, // E-042: wie die Frontlader-Schaufel, nur groesser
  { materialId: "steel", massKg: 560, kind: "cyl", dims: [0.55, 1.1], bau: "buendel", name: "Raupenlaufwerk-Ketten (Bund)" },
  { materialId: "steel", massKg: 430, kind: "box", dims: [1.4, 1.4, 2.9], bau: "gitterturm", name: "Turmdrehkran-Mastschuss" },
  { materialId: "steel", massKg: 390, kind: "box", dims: [2.4, 1.5, 0.25], bau: "platte", name: "Betonfertigteil-Wand" },
  { materialId: "rubble", massKg: 520, kind: "box", dims: [1.3, 0.9, 2.0], bau: "beton", name: "Betontreppenlauf" },
  { materialId: "rubble", massKg: 380, kind: "cyl", dims: [0.75, 1.2], bau: "beton", name: "Betonrohr (Kanal)" },
  { materialId: "rubble", massKg: 340, kind: "cyl", dims: [0.7, 0.9], bau: "beton", name: "Schachtring" },
  { materialId: "wood", massKg: 220, kind: "box", dims: [3.2, 1.4, 0.2], bau: "gitterturm", name: "Dachstuhl-Binder" },
  { materialId: "alu", massKg: 280, kind: "box", dims: [2.6, 2.2, 0.2], bau: "fensterflaeche", name: "Fensterfront (Pfosten-Riegel)" },
  // E-123: war `container` — mit Eckbeschlaegen und Tuerfluegeln wie ein
  // Seecontainer. Eine Absetzmulde ist ein offener Trog mit schraegen Stirnwaenden.
  { materialId: "steel", massKg: 520, kind: "box", dims: [2.2, 1.3, 3.2], bau: "mulde", name: "Schuttcontainer (Absetzmulde)" },
  { materialId: "wood", massKg: 340, kind: "box", dims: [2.1, 2.1, 3.2], bau: "kabine", name: "Bauwagen (alt, Holz)" },

  // --- Gebäudetechnik ---
  { materialId: "steel", massKg: 520, kind: "box", dims: [1.5, 2.2, 1.5], bau: "container", name: "Aufzugskabine" },
  { materialId: "steel", massKg: 580, kind: "box", dims: [0.5, 1.8, 0.6], bau: "klotz", name: "Aufzugs-Gegengewicht" }, // E-063: war `motor`
  { materialId: "alu", massKg: 260, kind: "box", dims: [0.9, 0.5, 3.2], bau: "ausleger", name: "Rolltreppen-Stufenband" },
  { materialId: "steel", massKg: 430, kind: "box", dims: [2.6, 1.8, 2.2], bau: "maschine", name: "Großklimagerät (Dach)" },
  { materialId: "steel", massKg: 380, kind: "box", dims: [2.2, 1.4, 1.6], bau: "maschine", name: "Rückkühler (Dachaufbau)" },
  { materialId: "alu", massKg: 250, kind: "box", dims: [2.4, 2.4, 0.15], bau: "fensterflaeche", name: "Glasfassaden-Element" },
  { materialId: "steel", massKg: 560, kind: "box", dims: [1.2, 2.8, 1.0], bau: "maschine", name: "Werkstatt-Hebebühne" },
  { materialId: "alu", massKg: 210, kind: "box", dims: [3.0, 2.2, 0.18], bau: "fensterflaeche", name: "Autohaus-Schaufensterrahmen" },
  { materialId: "steel", massKg: 590, kind: "box", dims: [1.1, 1.4, 1.2], bau: "maschine", name: "Schul-Heizkesselanlage" },
  { materialId: "steel", massKg: 240, kind: "box", dims: [2.6, 1.2, 0.2], bau: "stapel", name: "Kühlhaus-Paneele (Stapel)" },
  { materialId: "steel", massKg: 300, kind: "box", dims: [3.0, 0.4, 1.6], bau: "platte", name: "Tankstellen-Dachkonstruktion" },

  // --- Luftfahrt ---
  { materialId: "steel", massKg: 560, kind: "box", dims: [2.2, 1.0, 3.0], bau: "karosserie", name: "Flughafen-Schleppfahrzeug", zusammensetzung: [{ materialId: "steel", anteil: 0.8 }, { materialId: "plastic", anteil: 0.08 }, { materialId: "copper", anteil: 0.06 }, { materialId: "tires", anteil: 0.06 }] },
  { materialId: "alu", massKg: 260, kind: "box", dims: [1.6, 2.4, 2.6], bau: "gitterturm", name: "Fluggasttreppe" },
  { materialId: "alu", massKg: 300, kind: "box", dims: [1.7, 1.9, 2.4], bau: "elektromotor", name: "Cateringwagen-Aufbau" },
  { materialId: "alu", massKg: 420, kind: "box", dims: [2.0, 1.7, 2.6], bau: "kabine", name: "Hubschrauber-Zelle", zusammensetzung: [{ materialId: "alu", anteil: 0.68 }, { materialId: "rubble", anteil: 0.08 }, { materialId: "plastic", anteil: 0.16 }, { materialId: "steel", anteil: 0.08 }] },
  { materialId: "alu", massKg: 230, kind: "cyl", dims: [0.35, 3.2], bau: "rohrFlansch", name: "Hubschrauber-Heckausleger" },

  // --- Schiene ---
  { materialId: "steel", massKg: 580, kind: "box", dims: [1.6, 1.3, 0.9], bau: "klotz", name: "Prellbock" }, // E-063: war `motor`
  { materialId: "steel", massKg: 560, kind: "cyl", dims: [0.48, 1.5], bau: "achse", name: "Radsatz (Eisenbahn)" },
  { materialId: "steel", massKg: 520, kind: "box", dims: [2.2, 2.0, 1.6], bau: "kabine", name: "Lokomotiv-Führerstand", zusammensetzung: [{ materialId: "steel", anteil: 0.86 }, { materialId: "rubble", anteil: 0.06 }, { materialId: "plastic", anteil: 0.08 }] },
  { materialId: "rubble", massKg: 590, kind: "box", dims: [1.0, 0.7, 2.6], bau: "stapel", name: "Bahnschwellen (Betonstapel)" },
  { materialId: "steel", massKg: 470, kind: "box", dims: [2.8, 1.9, 0.15], bau: "platte", name: "Schiebewand-Waggon-Seitenteil" },

  // --- Hafen ---
  { materialId: "steel", massKg: 520, kind: "box", dims: [2.4, 1.2, 3.2], bau: "boot", name: "Ponton-Segment" }, // E-063: war `tank`
  { materialId: "steel", massKg: 580, kind: "box", dims: [2.6, 0.9, 1.4], bau: "maschine", name: "Reachstacker-Spreader" },
  { materialId: "steel", massKg: 490, kind: "box", dims: [1.6, 1.4, 3.2], bau: "boot", name: "Bootsrumpf (Stahl)" }, // E-063: war `tank`
  { materialId: "steel", massKg: 430, kind: "box", dims: [1.0, 1.0, 3.4], bau: "ausleger", name: "Hafenkran-Ausleger" },
  // --- Massives Grossteil (E-042, 15.09.2026) ---
  // Palette mit rund zehn LKW-Bremsscheiben, 400 kg. -> 10,5 mm
  { materialId: "steel", massKg: 400, kind: "box", dims: [1.0, 0.8, 0.9], bau: "stapel", name: "Bremsscheiben (Palette)" },
  // Gegengewicht eines Gabelstaplers, Gussblock. -> 30,5 mm
  { materialId: "steel", massKg: 450, kind: "box", dims: [0.9, 0.5, 0.35], bau: "klotz", name: "Stapler-Gegengewicht" }, // E-063: war `motor`

  /* ====================================================================== *
   * CONTAINER, GERUESTE, KLEINE BAGGER (E-123, 06.10.2026)
   *
   * Patrick: „Die Schrottsorten sollen mehr grossteile beinhalten, container,
   * gerüste, kleine bagger."
   *
   * Jedes Mass ist so gewaehlt, dass das Stueck auf eine Ladeflaeche des
   * Spiels PASST — Breite bis 2,28 m (12 Rasterfelder samt `ladung.LUFT`),
   * Hoehe bis 0,99 / 1,40 / 1,90 m (flach / Rungen / Koffer). Wo das echte
   * Ding hoeher ist (Seecontainer, Minibagger mit Dach), steht es hier in der
   * Form, in der es auf einem Lkw ankommt: ohne Dach, ohne Arm, liegend.
   * Gemessen mit `tools/grossteile.ts`; `test/grossteileNeu.test.ts` haelt fest,
   * dass jedes davon auf mindestens einen Wagen passt.
   *
   * Massen GERECHNET, wo es eine Rechnung gibt (Blechflaeche × Dicke × 7850
   * kg/m³), sonst Startwert (SW) aus der Groessenklasse. Die Fraktion rechnet
   * wie immer `fraktionVonTeil` aus — sie steht im Kommentar nur zum Lesen.
   *
   * Verzinktes ist STAHL (E-150, Patrick 17.10.2026: „verzinkt ist kein
   * buntmetall"). Die Zinkschicht ist wenige Mikrometer dick, unter 1 % der
   * Masse. Bis E-150 galt hier die Hausregel „Verzinktes ist Zink" vom
   * 12.09.2026 — sie ist zurueckgenommen. Ob Stahl- oder Mischschrott, sagt
   * die eine Regel in `purity.fraktionVonTeil` (Wandstaerke, Verbund).
   * ====================================================================== */

  // --- Container ---
  // Werkzeugcontainer der Baustelle, Trapezblech 2 mm: Huelle 2,0 × 1,3 × 1,3 m
  // = 13,6 m² × 0,002 × 7850 = 214 kg, dazu Rahmenprofile und Holzboden
  // ≈ 380 kg (SW). Holz 12 %, Dichtungen und Griffe 3 % -> Mischschrott.
  { materialId: "steel", massKg: 380, kind: "box", dims: [1.3, 1.3, 2.0], bau: "container", name: "Werkzeugcontainer (Baustelle)", zusammensetzung: [{ materialId: "steel", anteil: 0.85 }, { materialId: "wood", anteil: 0.12 }, { materialId: "plastic", anteil: 0.03 }] },
  // Kippbehaelter fuer den Stapler, 4 mm Blech: offener Trog 1,2 × 1,6 m,
  // 0,95 m hoch (unter der flachen Bordwand + Ueberstand von 0,99 m) — rund
  // 7,5 m² × 0,004 × 7850 = 236 kg, mit Gabeltaschen 260 kg. -> 3,6 mm, Mischschrott.
  { materialId: "steel", massKg: 260, kind: "box", dims: [1.2, 0.95, 1.6], bau: "mulde", name: "Kippbehälter (Stapler)" },

  // --- Gerueste ---
  // Stahl-Stellrahmen 0,73 × 2,00 m wiegt 18–19 kg (Rahmengeruest, Groessenordnung
  // der Herstellerkataloge); 18 Stueck flach gestapelt = 335 kg bei 0,9 m Hoehe.
  // E-150: Stahl, 5,0 mm rechnerisch -> Mischschrott (Rohrrahmen, kein Vollmaterial).
  { materialId: "steel", massKg: 335, kind: "box", dims: [0.8, 0.9, 2.1], bau: "geruest", name: "Gerüstrahmen (Paket, verzinkt)", zusammensetzung: [{ materialId: "steel", anteil: 1 }] },
  // Alu-Rollgeruest, zerlegt: vier Rahmen, Plattform, Streben, Rollen —
  // rund 160 kg fuer ein Geruest mit 7 m Arbeitshoehe (SW).
  { materialId: "alu", massKg: 160, kind: "box", dims: [0.8, 0.6, 2.6], bau: "geruest", name: "Alu-Rollgerüst (zerlegt, Paket)" },
  // Geruestrohr 48,3 × 3,2 mm wiegt 3,56 kg/m (DIN EN 39); 20 Rohre à 4 m mit
  // Kupplungen = 285 + 15 kg. Liegt laengs auf jeder Pritsche (4,12 m mit Luft).
  // E-150: Stahl, 7,7 mm rechnerisch (dichtes Rohrbuendel) -> Stahlschrott.
  { materialId: "steel", massKg: 300, kind: "box", dims: [0.3, 0.3, 4.0], bau: "buendel", name: "Gerüstrohre verzinkt (Bund)", zusammensetzung: [{ materialId: "steel", anteil: 1 }] },
  // Ein Feld, aus dem Verband gerissen und auf die Seite gelegt: zwei Rahmen
  // (je 18,5 kg), zwei Stahlboeden (je 19 kg), Diagonale, Gelaender, Bordbrett
  // aus Holz — 105 kg. Das Holz macht es zu Mischschrott.
  // E-150: Stahl statt Zink; 0,8 mm rechnerisch -> Mischschrott (wie vorher, jetzt aus Stahl).
  { materialId: "steel", massKg: 105, kind: "box", dims: [2.0, 0.75, 2.6], bau: "geruestfeld", name: "Gerüstfeld (ausgerissen)", zusammensetzung: [{ materialId: "steel", anteil: 0.88 }, { materialId: "wood", anteil: 0.12 }] },

  // --- Kleine Bagger ---
  // Raupenunterwagen eines 1,5-t-Minibaggers: Kettenlaenge 1,55 m plus Schild,
  // Spurbreite 1,0 m. Rund 450 kg, davon zwei Gummiketten à 45 kg = 20 %
  // Gummi (Fraktion Reifen) -> Mischschrott. Trockengelegt: Ein Schrottplatz
  // nimmt keine Maschine mit Oel (Altoelverordnung), darum steht kein Oel drin.
  { materialId: "steel", massKg: 450, kind: "box", dims: [1.0, 0.5, 1.9], bau: "raupe", name: "Minibagger-Raupenunterwagen", zusammensetzung: [{ materialId: "steel", anteil: 0.8 }, { materialId: "tires", anteil: 0.2 }] },
  // Ausleger mit Stiel und drei Zylindern, 1,5-t-Klasse, 240 kg (SW).
  // Auslegerbleche 10–15 mm und massive Kolbenstangen: Rechnerisch nur 6,0 mm,
  // weil der Huellquader die Kroepfung mitzaehlt -> `massiv`.
  { materialId: "steel", massKg: 240, kind: "box", dims: [0.35, 0.55, 2.6], bau: "ausleger", name: "Minibagger-Ausleger mit Stiel", massiv: true, zusammensetzung: [{ materialId: "steel", anteil: 0.96 }, { materialId: "plastic", anteil: 0.04 }] },
];


/* ------------------------------------------------------------------------ */
/* Schwergewichte — füllen einen Auflieger                                    */
/* ------------------------------------------------------------------------ */

export const KATALOG_HUGE: PileSpec[] = [
  // --- Landwirtschaft ---
  { materialId: "steel", massKg: 1300, kind: "box", dims: [4.6, 0.9, 1.3], bau: "schaufel", name: "Mähdrescher-Schneidwerk" },
  { materialId: "steel", massKg: 620, kind: "cyl", dims: [0.65, 1.5], bau: "trommel", name: "Mähdrescher-Dreschtrommel" }, // E-063: war `tank`
  { materialId: "steel", massKg: 640, kind: "box", dims: [2.6, 1.6, 2.2], bau: "tank", name: "Mähdrescher-Korntank" },
  { materialId: "steel", massKg: 1500, kind: "cyl", dims: [0.95, 3.4], bau: "tank", name: "Güllefass" },
  { materialId: "steel", massKg: 1900, kind: "box", dims: [2.4, 2.3, 3.2], bau: "maschine", name: "Ballenpresse (Rundballen)" }, // E-063: war `tank`
  { materialId: "steel", massKg: 760, kind: "box", dims: [3.0, 1.0, 1.4], bau: "gitterturm", name: "Grubber mit Zinkenfeld" },
  { materialId: "steel", massKg: 840, kind: "box", dims: [2.9, 0.9, 1.6], bau: "gitterturm", name: "Scheibenegge" },
  { materialId: "steel", massKg: 720, kind: "box", dims: [2.6, 0.8, 1.1], bau: "gitterturm", name: "Kreiselegge" },
  { materialId: "steel", massKg: 880, kind: "box", dims: [3.4, 1.1, 1.5], bau: "schaufel", name: "Maispflücker-Vorsatz" },
  { materialId: "steel", massKg: 830, kind: "box", dims: [2.4, 2.0, 3.4], bau: "rahmenbox", name: "Ladewagen-Aufbau" },
  { materialId: "steel", massKg: 920, kind: "box", dims: [1.6, 1.5, 2.4], bau: "maschine", name: "Miststreuer-Streuwerk" },
  { materialId: "steel", massKg: 1700, kind: "box", dims: [2.6, 2.0, 3.0], bau: "tank", name: "Futtermischwagen-Behälter" },
  { materialId: "steel", massKg: 900, kind: "cyl", dims: [0.55, 2.2], bau: "achse", name: "Futtermischwagen-Mischschnecke" }, // E-063: war `tank` — eine Schnecke ist eine Welle, kein Kessel

  // --- Industrie ---
  { materialId: "steel", massKg: 2300, kind: "box", dims: [2.2, 2.4, 2.6], bau: "maschine", name: "CNC-Fräsmaschine" },
  { materialId: "steel", massKg: 2100, kind: "box", dims: [1.2, 1.4, 3.6], bau: "maschine", name: "Drehmaschine mit Bett" },
  { materialId: "steel", massKg: 2600, kind: "box", dims: [1.6, 1.9, 4.4], bau: "maschine", name: "Spritzgussmaschine" },
  { materialId: "steel", massKg: 1600, kind: "cyl", dims: [1.0, 3.2], bau: "tank", name: "Dampfkessel" },

  // --- Wohnwagen und Freizeit ---
  { materialId: "alu", massKg: 950, kind: "box", dims: [2.3, 2.5, 4.6], bau: "karosserie", name: "Wohnwagen (komplett)", zusammensetzung: [{ materialId: "alu", anteil: 0.38 }, { materialId: "wood", anteil: 0.24 }, { materialId: "plastic", anteil: 0.3 }, { materialId: "steel", anteil: 0.08 }] },
  { materialId: "alu", massKg: 1100, kind: "box", dims: [2.4, 2.6, 4.6], bau: "karosserie", name: "Wohnmobil-Aufbau", zusammensetzung: [{ materialId: "alu", anteil: 0.44 }, { materialId: "plastic", anteil: 0.3 }, { materialId: "wood", anteil: 0.2 }, { materialId: "steel", anteil: 0.06 }] },
  { materialId: "alu", massKg: 620, kind: "box", dims: [2.3, 1.4, 2.4], bau: "karosserie", name: "Wohnmobil-Alkoven", zusammensetzung: [{ materialId: "alu", anteil: 0.4 }, { materialId: "plastic", anteil: 0.34 }, { materialId: "wood", anteil: 0.22 }, { materialId: "steel", anteil: 0.04 }] },

  // --- Fahrzeugschrott ---
  { materialId: "steel", massKg: 700, kind: "box", dims: [1.6, 1.4, 3.4], bau: "karosserie", name: "Kleinwagen-Karosserie", zusammensetzung: [{ materialId: "steel", anteil: 0.74 }, { materialId: "plastic", anteil: 0.14 }, { materialId: "alu", anteil: 0.05 }, { materialId: "rubble", anteil: 0.04 }, { materialId: "copper", anteil: 0.03 }] },
  { materialId: "steel", massKg: 980, kind: "box", dims: [1.8, 1.5, 4.6], bau: "karosserie", name: "Kombi-Karosserie", zusammensetzung: [{ materialId: "steel", anteil: 0.74 }, { materialId: "plastic", anteil: 0.14 }, { materialId: "alu", anteil: 0.05 }, { materialId: "rubble", anteil: 0.04 }, { materialId: "copper", anteil: 0.03 }] },
  { materialId: "steel", massKg: 1250, kind: "box", dims: [1.9, 1.8, 4.4], bau: "karosserie", name: "SUV-Karosserie", zusammensetzung: [{ materialId: "steel", anteil: 0.73 }, { materialId: "plastic", anteil: 0.15 }, { materialId: "alu", anteil: 0.05 }, { materialId: "rubble", anteil: 0.04 }, { materialId: "copper", anteil: 0.03 }] },
  { materialId: "steel", massKg: 1400, kind: "box", dims: [2.0, 2.4, 4.8], bau: "karosserie", name: "Transporter-Kastenwagen", zusammensetzung: [{ materialId: "steel", anteil: 0.78 }, { materialId: "plastic", anteil: 0.12 }, { materialId: "alu", anteil: 0.05 }, { materialId: "rubble", anteil: 0.03 }, { materialId: "copper", anteil: 0.02 }] },
  { materialId: "steel", massKg: 620, kind: "box", dims: [1.7, 1.4, 4.2], bau: "karosserie", name: "Ausgebranntes Fahrzeug", zusammensetzung: [{ materialId: "steel", anteil: 0.88 }, { materialId: "rubble", anteil: 0.06 }, { materialId: "alu", anteil: 0.06 }] },
  { materialId: "steel", massKg: 1050, kind: "box", dims: [1.8, 1.5, 4.0], bau: "karosserie", name: "Unfallfahrzeug (Front eingedrückt)", zusammensetzung: [{ materialId: "steel", anteil: 0.74 }, { materialId: "plastic", anteil: 0.14 }, { materialId: "alu", anteil: 0.05 }, { materialId: "rubble", anteil: 0.04 }, { materialId: "copper", anteil: 0.03 }] },
  { materialId: "steel", massKg: 1800, kind: "box", dims: [2.1, 2.5, 4.8], bau: "karosserie", name: "Kleinbus", zusammensetzung: [{ materialId: "steel", anteil: 0.74 }, { materialId: "plastic", anteil: 0.14 }, { materialId: "alu", anteil: 0.05 }, { materialId: "rubble", anteil: 0.04 }, { materialId: "copper", anteil: 0.03 }] },
  { materialId: "steel", massKg: 2100, kind: "box", dims: [2.5, 2.8, 3.6], bau: "karosserie", name: "Reisebus-Heckteil", zusammensetzung: [{ materialId: "steel", anteil: 0.72 }, { materialId: "plastic", anteil: 0.14 }, { materialId: "alu", anteil: 0.07 }, { materialId: "rubble", anteil: 0.04 }, { materialId: "copper", anteil: 0.03 }] },
  { materialId: "steel", massKg: 2400, kind: "box", dims: [2.5, 1.2, 4.8], bau: "fahrgestell", name: "Sattelauflieger-Chassis" },

  // --- Bauabbruch ---
  // E-123: war 2,2 × 2,2 × 3,4 m und `karosserie` — ein Auto mit Scheiben,
  // und 2,2 m hoch kam er auf keinen Wagen (`tools/grossteile.ts`: nie
  // angekommen). 2,5 t ausgeschlachtet ist die 3,5-t-Klasse ohne Kabine und
  // Arm: Spur 1,7 m, Unterwagen samt Schild 2,6 m, bis Oberkante Sitzlehne
  // 1,40 m (SW) — knapp unter der Rungen-Grenze von 1,40 m, damit er nicht nur
  // im Koffer kommt (gemessen mit 1,55 m: 0 von 7 gezogenen kamen an).
  // Masse und Stueckliste unveraendert.
  { materialId: "steel", massKg: 2500, kind: "box", dims: [1.7, 1.4, 2.6], bau: "minibagger", name: "Minibagger (ausgeschlachtet)", zusammensetzung: [{ materialId: "steel", anteil: 0.86 }, { materialId: "plastic", anteil: 0.06 }, { materialId: "copper", anteil: 0.04 }, { materialId: "rubble", anteil: 0.04 }] },
  { materialId: "steel", massKg: 2200, kind: "cyl", dims: [0.85, 2.1], bau: "trommel", name: "Vibrationswalze (Bandage)" }, // E-063: war `tank`
  { materialId: "steel", massKg: 1200, kind: "box", dims: [1.4, 1.4, 4.8], bau: "gitterturm", name: "Turmdrehkran-Ausleger" },
  { materialId: "rubble", massKg: 2400, kind: "box", dims: [2.4, 0.8, 1.8], bau: "beton", name: "Kranballast-Platten" },
  { materialId: "steel", massKg: 1500, kind: "cyl", dims: [1.1, 2.6], bau: "tank", name: "Betonmischer-Trommel" },
  { materialId: "steel", massKg: 1900, kind: "box", dims: [2.4, 2.6, 4.8], bau: "container", name: "Baustellencontainer", zusammensetzung: [{ materialId: "steel", anteil: 0.68 }, { materialId: "plastic", anteil: 0.16 }, { materialId: "wood", anteil: 0.12 }, { materialId: "alu", anteil: 0.04 }] },
  { materialId: "rubble", massKg: 2500, kind: "box", dims: [2.4, 0.25, 4.6], bau: "beton", name: "Hohlkammerdecke (Element)" },

  // --- Gebäudetechnik ---
  { materialId: "steel", massKg: 2400, kind: "box", dims: [1.4, 2.6, 4.6], bau: "gitterturm", name: "Rolltreppen-Segment" },
  { materialId: "steel", massKg: 1800, kind: "cyl", dims: [1.2, 3.6], bau: "tank", name: "Tankstellen-Erdtank" },

  // --- Luftfahrt ---
  { materialId: "alu", massKg: 900, kind: "box", dims: [2.6, 1.9, 4.6], bau: "karosserie", name: "Kleinflugzeug (komplett)", zusammensetzung: [{ materialId: "alu", anteil: 0.72 }, { materialId: "steel", anteil: 0.14 }, { materialId: "plastic", anteil: 0.08 }, { materialId: "rubble", anteil: 0.06 }] },
  { materialId: "steel", massKg: 1900, kind: "cyl", dims: [0.95, 2.8], bau: "tank", name: "Strahltriebwerk (ausgebaut)", zusammensetzung: [{ materialId: "steel", anteil: 0.58 }, { materialId: "alu", anteil: 0.34 }, { materialId: "va", anteil: 0.08 }] },

  // --- Schiene ---
  { materialId: "steel", massKg: 2600, kind: "box", dims: [2.4, 2.6, 4.6], bau: "karosserie", name: "Rangierlok (ausgeschlachtet)", zusammensetzung: [{ materialId: "steel", anteil: 0.84 }, { materialId: "copper", anteil: 0.08 }, { materialId: "alu", anteil: 0.04 }, { materialId: "plastic", anteil: 0.04 }] },
  { materialId: "steel", massKg: 2500, kind: "box", dims: [1.5, 1.6, 2.8], bau: "motor", name: "Diesellok-Motorblock", zusammensetzung: [{ materialId: "steel", anteil: 0.82 }, { materialId: "alu", anteil: 0.14 }, { materialId: "copper", anteil: 0.04 }] },
  { materialId: "steel", massKg: 2300, kind: "box", dims: [2.6, 2.6, 4.8], bau: "container", name: "Personenwaggon-Kasten", zusammensetzung: [{ materialId: "steel", anteil: 0.76 }, { materialId: "alu", anteil: 0.08 }, { materialId: "plastic", anteil: 0.1 }, { materialId: "rubble", anteil: 0.06 }] },
  { materialId: "steel", massKg: 2200, kind: "box", dims: [2.6, 0.6, 4.8], bau: "fahrgestell", name: "Güterwaggon-Boden" },
  { materialId: "steel", massKg: 2000, kind: "cyl", dims: [1.2, 3.4], bau: "tank", name: "Kesselwagen-Kessel" },
  { materialId: "steel", massKg: 2100, kind: "box", dims: [2.4, 2.6, 4.4], bau: "container", name: "Straßenbahn-Wagenkasten", zusammensetzung: [{ materialId: "steel", anteil: 0.7 }, { materialId: "alu", anteil: 0.12 }, { materialId: "plastic", anteil: 0.12 }, { materialId: "rubble", anteil: 0.06 }] },
  { materialId: "steel", massKg: 2600, kind: "box", dims: [2.4, 1.2, 2.2], bau: "achse", name: "U-Bahn-Drehgestell (angetrieben)" },

  // --- Hafen ---
  { materialId: "steel", massKg: 2200, kind: "box", dims: [2.4, 2.6, 4.8], bau: "container", name: "Seecontainer 20 Fuß", massiv: true, zusammensetzung: [{ materialId: "steel", anteil: 0.95 }, { materialId: "wood", anteil: 0.05 }] }, // E-042, Patrick 15.09.2026: "Dicke Uebersee-Container haben auch viel Masse, auch wenn es duennes Blech ist. Drum Stahl."
  { materialId: "steel", massKg: 2500, kind: "box", dims: [2.4, 2.7, 4.8], bau: "container", name: "Kühlcontainer", zusammensetzung: [{ materialId: "steel", anteil: 0.72 }, { materialId: "plastic", anteil: 0.18 }, { materialId: "copper", anteil: 0.06 }, { materialId: "alu", anteil: 0.04 }] },
  { materialId: "steel", massKg: 2400, kind: "box", dims: [2.4, 2.6, 4.6], bau: "container", name: "Bürocontainer", zusammensetzung: [{ materialId: "steel", anteil: 0.7 }, { materialId: "plastic", anteil: 0.15 }, { materialId: "wood", anteil: 0.1 }, { materialId: "alu", anteil: 0.05 }] },
  { materialId: "steel", massKg: 2500, kind: "box", dims: [2.4, 2.6, 4.6], bau: "container", name: "Werkstattcontainer", zusammensetzung: [{ materialId: "steel", anteil: 0.74 }, { materialId: "plastic", anteil: 0.12 }, { materialId: "wood", anteil: 0.1 }, { materialId: "alu", anteil: 0.04 }] },
  { materialId: "steel", massKg: 2600, kind: "box", dims: [1.8, 1.9, 3.2], bau: "motor", name: "Schiffsmotor (Diesel)", zusammensetzung: [{ materialId: "steel", anteil: 0.84 }, { materialId: "alu", anteil: 0.1 }, { materialId: "copper", anteil: 0.06 }] },

  /* --- Container und kleine Bagger (E-123, 06.10.2026) — Einleitung bei KATALOG_BIG --- */
  // Absetzmulde 5 m³ mit Klappdeckel. Trog aus 5-mm-Blech (Boden 2,25 × 1,75,
  // Seiten trapezfoermig 2,25 → 3,30 m, schraege Stirnwaende): 16,6 m² ×
  // 0,005 × 7850 = 652 kg; Deckel 3 mm, 5,8 m² = 136 kg; Zapfen und Profile
  // 30 kg -> 820 kg. 1,35 m hoch: passt auf Rungen und Koffer. -> Mischschrott.
  { materialId: "steel", massKg: 820, kind: "box", dims: [1.75, 1.35, 3.3], bau: "deckelmulde", name: "Absetzmulde 5 m³ (Klappdeckel)" },
  // Minibagger der 1,5-t-Klasse, Ausleger und Schutzdach abgebaut: Laenge
  // 2,1 m (Unterwagen 1,55 m + Schild), Breite 1,0 m, Hoehe 1,3 m bis zur
  // Lehne. 1,5 t minus Arm (240 kg, eigener Eintrag) = rund 1300 kg.
  // Gummiketten 7 %, Haube/Sitz/Schlaeuche 4 %, Kuehler (Alu) 2 %, Kabelbaum
  // und Lichtmaschine (Kupfer) 1 % -> 14 % Fremdstoff, also Mischschrott.
  // Trockengelegt, siehe Raupenunterwagen.
  { materialId: "steel", massKg: 1300, kind: "box", dims: [1.0, 1.3, 2.1], bau: "minibagger", name: "Minibagger 1,5 t (ohne Arm/Dach)", zusammensetzung: [{ materialId: "steel", anteil: 0.86 }, { materialId: "tires", anteil: 0.07 }, { materialId: "plastic", anteil: 0.04 }, { materialId: "alu", anteil: 0.02 }, { materialId: "copper", anteil: 0.01 }] },
];

/*
 * Die Fraktion wird aus der Zusammensetzung abgeleitet, nicht von Hand
 * gepflegt. Sonst laufen beide auseinander, sobald jemand einen Anteil aendert:
 * Ein Kuehlschrank stuende als "steel" im Katalog und waere trotzdem
 * Mischschrott. Ein Eintrag ohne Zusammensetzung bleibt, was er ist.
 */
for (const liste of [KATALOG_SPECS, KATALOG_BIG, KATALOG_HUGE]) {
  for (const sp of liste) sp.materialId = fraktionVonTeil(sp);
}
