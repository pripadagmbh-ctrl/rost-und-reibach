import type { ChallengeDaten } from "./challenge";
import { PRESS_CENTER, pressWaende } from "../world/press";
import { BAGGER_STAND } from "../world/baggerstand";

/**
 * DIE AUFGABEN — Daten, kein Code (E-125, 06.10.2026; E-162, 19.10.2026).
 *
 * Konzept: `docs/aufgaben-konzept.md`, von Patrick abgenommen am 19.10.2026.
 * Eine neue Aufgabe ist ein weiterer Eintrag in dieser Liste (Aufbau, Schritte
 * aus dem Vorrat in `challenge.ts`, Schwellen), keine neue Datei.
 *
 * Die REIHENFOLGE ist die Freischalt-Reihenfolge (nacheinander ab 1 Stern,
 * Patrick 19.10.2026, Frage 1 A), und die ERSTE ist die, mit der das Spiel
 * beim allerersten Start beginnt (Frage 2 A, `ui/hauptmenue.ts`).
 */

/*
 * WO DAS KUPFERTEIL DER AUFGABE 1 LIEGT — gerechnet, nicht gegriffen.
 * Bewacht in `test/aufgabe1.test.ts` (Lage-Waechter und Durchlauf mit dem
 * echten Bagger).
 *
 * Gemessen mit dem echten `Excavator` (Fuenfschalengreifer, 19.10.2026):
 *  - Startpose: Hauptarm 35°, Ausleger −70°, Blick nach +z. Spinne haengt
 *    8,09 m vor der Drehmitte (−0,5 | −22,5), Gelenk 3,64 m, Sensorpunkt
 *    2,14 m ueber Boden.
 *  - Nur den Hauptarm gesenkt, bis die offenen Schalen aufsitzen: Hauptarm
 *    28,2°, Ausladung 8,13 m (+4 cm), Gelenk 2,75 m, Sensor 1,25 m.
 * Wer sich also nur dreht und den Hauptarm senkt, trifft den Kreis mit 8,13 m
 * Halbmesser. Darauf liegt das Teil — kein Ausleger noetig.
 *
 * Der Winkel: 15° neben der Startblickrichtung, nach +x, also vom Fahrer aus
 * LINKS (rechts von ihm ist −x). Nicht geradeaus, sonst erledigte sich
 * „Dreh dich zum Teil" von selbst (Toleranz 6°, `BLICK_TOLERANZ_RAD`). Nicht
 * weiter als 15°: Auf der linken Seite liegt bei 31,6° der Kehrbesen
 * (`BESEN_PLATZ`, im Sandkasten), auf der rechten die MUELL-Mulde. Seit E-183
 * (20.10.2026) steht sie auf `MUELL_START` (−3,0 | −16,0), Mitte bei −21°;
 * ihre naechste Ecke (−1,20 | −13,85) liegt bei −4,6° und 2,80 m vom Teil
 * (Rechteck zu Teilmitte) — gerechnet vom Waechter `aufbauKonflikte` in
 * `test/aufgabe1.test.ts` gegen die echten Behaelterplaetze. Bei 15° sind es 2,3 m
 * Mitte-zu-Mitte zum Besen, die Umkreise (1,46 + 0,69 m) beruehren sich nicht
 * — und in der Aufgabe liegt kein Besen, ihr Platz ist leer.
 *
 * Im ersten Bild: Die Kamera steht 11 m hinter dem Bagger (`orbitCamera.ts`);
 * von dort liegt das Teil 8° neben der Bildmitte und 2,1 m links vom Ausleger.
 *
 * Ziel auf derselben Ausladung: Die Mitte der Box BUNT + VA (−7,6 | −19,8)
 * liegt auf dem 8,13-m-Kreis bei −70,6° (Punkt (−8,17 | −19,80): 2,7 m hinter
 * der 1,0-m-Schwelle zum Bagger hin, 1,5 m vor der offenen Westseite, je
 * 3,0 m von den Flanken). Von 15° sind das 86° Schwenk nach rechts; der Kreis
 * geht dabei (seit E-183) quer ueber die MUELL-Mulde (Oberkante 1,2 m nach
 * `rolloffOberkante`) und bei z −16,8 ueber die 2,0-m-Nordflanke der Box —
 * darum verlangt „Heb an" die Unterkante 0,3 m ueber 2,0 m.
 */
const ERSTER_GRIFF_WINKEL = (15 * Math.PI) / 180; // Herkunft oben
const ERSTER_GRIFF_AUSLADUNG = 8.13; // gemessen, oben

/*
 * WO DAS WRACK DER AUFGABE 2 STEHT (G3, 20.10.2026) — schraeg vorn, im ersten
 * Bild, statt hinter dem Bagger. Gerechnet und bewacht in
 * `test/aufgabe2.test.ts` (Grundriss im 25-cm-Raster gegen Behaelter, MUELL-
 * Mulde, Bauwerke und Mauern samt E-182, Presskammer und Besenplatz, mit
 * 0,3 m Rand).
 *
 * Vorn ist wenig Platz: Rechts steht ab −10° die MUELL-Mulde (`MUELL_START`,
 * E-183), links ab 25° der Besenplatz. Dazwischen passt ein Pkw nur
 * laengs zur Blicklinie, bei 5–10° und hoechstens 15° schraeg gedreht
 * (Abtastung 5°-Schritte, 0,25 m, Gier je 15°).
 *
 *  - Winkel 10° links (wie Aufgabe 1: nicht geradeaus, sonst ist das
 *    Drehen geschenkt).
 *  - Mitte 7,9 m: Die Kabine sitzt 0,2 m hinter der Wagenmitte
 *    (`CAR_DEF.karosserie.kabineZ`); mit der Schnauze zum Bagger liegt die
 *    Dachmitte damit auf 8,1 m — dort setzt die Spinne auf, wer nur dreht
 *    und den Hauptarm senkt (Aufgabe 1: 8,13 m gemessen).
 *  - Gier 10° + 180° + 15°: Schnauze zum Bagger, 15° schraeg. Schnauze vorn,
 *    weil an der Haube seit E-185 die Haube Vorrang hat (aufspringen,
 *    abreissen) — wer dort greift, holt die Haube statt des Wracks. Auf dem
 *    Dach und am Kofferraum fasst die Spinne das Wrack (E-185, Tabelle).
 * Zur Presse sind es dann rund 130° nach rechts, ueber MUELL und BUNT + VA
 * (beide ≤ 2,0 m) und die Pressenwand.
 */
const PRESSE_WRACK_WINKEL = (10 * Math.PI) / 180;
const PRESSE_WRACK_AUSLADUNG = 7.9;
const PRESSE_WRACK_GIER = PRESSE_WRACK_WINKEL + Math.PI + (15 * Math.PI) / 180;
/** Aufgabe 6: Strahl, Start- und Zielausladung des LKW-Wracks — Herleitung beim Eintrag „schwere-last" */
const SCHWER_WINKEL = (80 * Math.PI) / 180;
const SCHWER_START_M = 5.0;
const SCHWER_ZIEL_M = 7.35;

/**
 * Ein Platz vor dem Bagger: Winkel in Grad ab der Startblickrichtung (+ =
 * nach +x, vom Fahrer aus LINKS, `cab+`), Ausladung in m ab `BAGGER_STAND`.
 * Gier quer zur Blicklinie (+90°) wie in Aufgabe 1, damit man von hinten die
 * ganze Laenge sieht.
 */
function vorDemBagger(winkelGrad: number, ausladung: number): { x: number; z: number; gier: number } {
  const w = (winkelGrad * Math.PI) / 180;
  return { x: BAGGER_STAND.x + ausladung * Math.sin(w), z: BAGGER_STAND.z + ausladung * Math.cos(w), gier: w + Math.PI / 2 };
}

/** Krone der Presskammer — dieselben Waende, aus denen die Presse gebaut ist (`pressWaende`) */
const KAMMER_KRONE = Math.max(...pressWaende().map((w) => w.top));

export const CHALLENGES: readonly ChallengeDaten[] = [
  {
    id: "erster-griff",
    name: { de: "ERSTER GRIFF", en: "FIRST GRAB" },
    beschreibung: {
      de: "Ein Kupferteil greifen, anheben und in die Box BUNT + VA legen. Hier lernst du die vier Grundbewegungen.",
      en: "Grab a copper part, lift it and drop it into the NON-FERROUS + SS bay. Learn the four basic moves.",
    },
    ziel: {
      // Hoechstens ~50 Zeichen: eine Zeile auf dem iPhone mini quer (ui-Messung E-162)
      de: "Leg das Kupferteil in die Box BUNT + VA.",
      en: "Put the copper part into the NON-FERROUS + SS bay.",
    },
    aufbau: {
      /*
       * Der Kupfer-Boiler (`scrapItems.ts`, Grossteile): 65 kg, liegend
       * Ø 0,70 x 1,20 m, reines Kupfer — gehoert also in BUNT + VA.
       * Gewaehlt, weil er gross genug ist, um unter der offenen Spinne
       * (Ø rund 2,4 m) noch sichtbar zu bleiben, und kompakt genug zum
       * Greifen: Gemessen packt ihn der Fuenfschalengreifer mit 0, 0,4 und
       * 0,8 m Versatz (`test/aufgabe1.test.ts`). Der Kupferkessel aus dem
       * Objektkatalog (19 kg, Ø 0,56 m) greift genauso gut, verschwindet aber
       * unter den Schalen; Kupferrohr-Bund und Wickeldraht (Ringe) liessen
       * sich mit 0,8 m Versatz NICHT mehr fassen.
       *
       * Quer gelegt (Gier = Winkel + 90°): Die Rohrachse steht quer zur
       * Blicklinie, von hinten sieht man die ganze Laenge.
       */
      teile: [
        {
          name: "Kupfer-Boiler",
          x: BAGGER_STAND.x + ERSTER_GRIFF_AUSLADUNG * Math.sin(ERSTER_GRIFF_WINKEL), // 1,60
          z: BAGGER_STAND.z + ERSTER_GRIFF_AUSLADUNG * Math.cos(ERSTER_GRIFF_WINKEL), // −14,65
          gier: ERSTER_GRIFF_WINKEL + Math.PI / 2,
        },
      ],
      greifer: "fuenfschalen",
    },
    zielBehaelter: "r_bunt",
    ablageziel: null,
    schritte: [
      {
        beobachtet: "blick_auf_teil",
        titel: { de: "Dreh dich zum Teil", en: "Swing to the part" },
        text: {
          de: "{cab+}: nach links drehen, bis die Spinne über dem Kupferteil hängt.",
          en: "{cab+}: swing left until the grapple is above the copper part.",
        },
        // Teil bei +15°: nach +x drehen = cabYaw steigt = plus (Kopf von challenge.ts)
        zeige: { fn: "cab", richtung: "plus" },
      },
      {
        beobachtet: "spinne_am_teil",
        titel: { de: "Senk die Spinne ab", en: "Lower the grapple" },
        text: {
          de: "{boom-}: Hauptarm senken, bis die Spinne um das Teil steht.",
          en: "{boom-}: lower the boom until the grapple surrounds the part.",
        },
        zeige: { fn: "boom", richtung: "minus" },
      },
      {
        beobachtet: "teil_gefasst",
        titel: { de: "Schließ die Spinne", en: "Close the grapple" },
        text: {
          de: "{grapple+}: Spinne schließen.",
          en: "{grapple+}: close the grapple.",
        },
        zeige: { fn: "grapple", richtung: "plus" },
      },
      {
        beobachtet: "teil_gehoben",
        titel: { de: "Heb an", en: "Lift it" },
        text: {
          de: "{boom+}: Hauptarm heben, höher als die Boxwand.",
          en: "{boom+}: raise the boom above the bay wall.",
        },
        zeige: { fn: "boom", richtung: "plus" },
      },
      {
        beobachtet: "teil_ueber_ziel",
        titel: { de: "Schwenk zur Box", en: "Swing to the bay" },
        text: {
          de: "{cab-}: nach rechts drehen, bis das Teil über BUNT + VA hängt.",
          en: "{cab-}: swing right until the part is above NON-FERROUS + SS.",
        },
        // Box bei −70,6°: nach −x drehen = minus
        zeige: { fn: "cab", richtung: "minus" },
      },
      {
        beobachtet: "teil_im_ziel",
        titel: { de: "Öffne die Spinne", en: "Open the grapple" },
        text: {
          de: "{grapple-}: Spinne öffnen.",
          en: "{grapple-}: open the grapple.",
        },
        zeige: { fn: "grapple", richtung: "minus" },
      },
    ],
    /*
     * Sterne (Konzept, Aufgabe 1): ★ geschafft · ★★ unter 3:00 min · ★★★ unter
     * 1:30 min. Bewusst grosszuegig, hier soll keiner scheitern. SW.
     */
    wertung: {
      zwei: { zeitS: 180 }, // SW, Konzept 19.10.2026
      drei: { zeitS: 90 }, // SW, Konzept 19.10.2026
    },
  },
  {
    id: "verladen",
    name: { de: "AUTO IN DIE PRESSE", en: "CAR INTO THE PRESS" },
    beschreibung: {
      de: "Ein Wrack greifen, zur Presse schwenken, einlegen, pressen.",
      en: "Grab a wreck, swing it to the press, drop it in and crush it.",
    },
    ziel: {
      de: "Leg das Wrack in die Presse und press es.",
      en: "Put the wreck in the press and crush it.",
    },
    aufbau: {
      wracks: [
        {
          art: "pkw",
          x: BAGGER_STAND.x + PRESSE_WRACK_AUSLADUNG * Math.sin(PRESSE_WRACK_WINKEL),
          z: BAGGER_STAND.z + PRESSE_WRACK_AUSLADUNG * Math.cos(PRESSE_WRACK_WINKEL),
          gier: PRESSE_WRACK_GIER,
        },
      ],
      greifer: "fuenfschalen",
    },
    // Ablageziel ist die Kammermitte — dieselbe Zahl, um die die Presse gebaut ist
    ablageziel: { x: PRESS_CENTER.x, z: PRESS_CENTER.z },
    // Gruene Marke auf der Wandkrone ueber der Kammermitte, solange das Wrack haengt
    zielMarke: { x: PRESS_CENTER.x, y: KAMMER_KRONE, z: PRESS_CENTER.z },
    schritte: [
      {
        beobachtet: "wrack_gefasst",
        titel: { de: "Greif das Wrack", en: "Grab the wreck" },
        // Wrack 10° links, Dach auf der Ausladung der Startpose: drehen, Hauptarm senken, zu (wie Aufgabe 1)
        text: {
          de: "{cab+} zum Wrack, {boom-} aufs Dach, {grapple+}.",
          en: "{cab+} to the wreck, {boom-} onto the roof, {grapple+}.",
        },
        zeige: { fn: "cab", richtung: "plus" },
      },
      {
        beobachtet: "wrack_ueber_kammer",
        titel: { de: "Zur Presse", en: "To the press" },
        // Die Presse steht rechts hinter dem Sitz (−8,0 | −26,0): nach rechts drehen = minus
        text: {
          de: "{boom+}: hoch über die Wände, dann {cab-} bis über die Kammer.",
          en: "{boom+}: high over the walls, then {cab-} until over the chamber.",
        },
        zeige: { fn: "cab", richtung: "minus" },
      },
      {
        beobachtet: "wrack_in_kammer",
        titel: { de: "Ablegen", en: "Set it down" },
        text: {
          de: "{boom-}: langsam absenken, dann {grapple-}.",
          en: "{boom-}: lower it gently, then {grapple-}.",
        },
        zeige: { fn: "grapple", richtung: "minus" },
      },
      {
        beobachtet: "wrack_gepresst",
        titel: { de: "Pressen", en: "Crush it" },
        // Knopf PRESSEN auf der Karte (Patrick 19.10.2026, Frage 3 A); der Kranz geht weiter
        text: {
          de: "Tipp auf der Karte auf PRESSEN.",
          en: "Tap PRESS on the card.",
        },
        zeige: null,
      },
    ],
    /*
     * Sterne (Konzept, Aufgabe 2): ★ gepresst · ★★ unter 3:00 min und
     * hoechstens 1 m neben der Kammermitte · ★★★ unter 1:30 min, hoechstens
     * 40 cm daneben und kein harter Aufschlag. Alle Zahlen SW.
     *
     * Praezision (cm von der Kammermitte, E-119/E-125): Quer bleiben je Seite
     * rund 1,2 m bis zur Wand — unter 100 cm liegt das Wrack ganz drin, unter
     * 40 cm (ein Drittel davon) mittig. Harter Aufschlag: `HART_AB_MS` und
     * `FALLHOEHE_HART_M` in `challenge.ts` — gemessen G3: langsam abgesetzt
     * 0, aus der Wandkrone fallen gelassen 1.
     */
    wertung: {
      zwei: { zeitS: 180, praezisionCm: 100 }, // SW, Konzept 19.10.2026
      drei: { zeitS: 90, praezisionCm: 40, harteAufschlaege: 0 }, // SW, Konzept 19.10.2026
    },
  },
  {
    id: "sortieren",
    name: { de: "SORTIEREN", en: "SORTING" },
    beschreibung: {
      de: "Sechs Teile in die richtige Mulde: Stahl, Misch, Buntmetall, Müll. Die Griff-Info sagt dir, was du gefasst hast.",
      en: "Six parts into the right bay: steel, mixed, non-ferrous, waste. The grab info tells you what you are holding.",
    },
    ziel: {
      de: "Bring alle sechs Teile in die richtige Mulde.",
      en: "Put all six parts into the right bay.",
    },
    /*
     * SECHS TEILE, die man an der Form erkennt (G3, Konzept Aufgabe 3) — je
     * Sorte gewaehlt nach dem, was die Griff-Info sagt (`fraktionVonTeil`),
     * und gemessen greifbar (Fuenfschalengreifer, 0 und 0,5 m Versatz, alle
     * sechs gefasst und 4,3 m gehoben, `test/aufgabe3.test.ts`):
     *   STAHLSCHROTT  Schwungrad (300 kg), Traktor-Frontgewicht (160 kg) —
     *                 massiver Stahl
     *   MISCHSCHROTT  Waschmaschine (42 kg, Blech mit Motor), Gefriertruhe
     *                 (62 kg, Blech, Kunststoff, Kupfer) — beide Weisse Ware.
     *                 Bis 20.10. war hier das Traktor-Vorderrad; seit E-186
     *                 zaehlt ein Rad als Reifen (MUELL), darum ein Teil, das
     *                 vor und nach E-186 Mischschrott ist.
     *   BUNT + VA     Kupfer-Boiler (65 kg) — der aus Aufgabe 1
     *   MUELL         Holzkiste (90 kg, Holz gehoert seit E-034 in den Muell)
     *
     * WO SIE LIEGEN — gerechnet mit 0,3 m Rand gegen Behaelter, MUELL-Mulde,
     * Mauern, Presse und Besenplatz (`test/aufgabe3.test.ts`): Vorn ist nur
     * zwischen MUELL (rechts, bis −2°) und Besenplatz (links, ab 14°) Platz,
     * dort zwei Teile: der Boiler auf 8°, die Kiste auf 12° naeher heran.
     * Die Kiste lag zuerst auf 8° / 6,2 m, 1,6 m neben der MUELL-Mulde — die
     * offene Spinne (3,0 m) streifte beim Greifen die Mulde und schob sie
     * gemessen 0,21 m weg (E-184: sie ist beweglich). Auf 12° sind es 2,0 m.
     * Die vier anderen links vorn auf 52–70°, wo in Aufgaben kein Laster
     * steht. Ausladung 6,2 bis 8,5 m: wer die nahen holt, braucht den
     * Ausleger (Konzept: „Ausleger heran und weg").
     *
     * Beim Schwenken nach hinten zur Stahlhalde liegt bei 120–150° die
     * Suedostecke der Bucht (4,8 m hoch, 9,1 m vom Sitz, E-182): Wer dort mit
     * mehr als rund 8 m Ausladung tief schwenkt, schlaegt an. Gemessen am
     * Test-Fahrer (`test/aufgabe3.test.ts`), der dafuer auf 7 m heranzieht.
     */
    aufbau: {
      teile: [
        { name: "Kupfer-Boiler", ...vorDemBagger(8, 8.13) },
        { name: "Holzkiste", ...vorDemBagger(12, 6.2) },
        { name: "Schwungrad", ...vorDemBagger(52, 6.5) },
        { name: "Traktor-Frontgewicht", ...vorDemBagger(54, 8.5) },
        { name: "Waschmaschine", ...vorDemBagger(70, 6.6) },
        { name: "Gefriertruhe", ...vorDemBagger(68, 8.5) },
      ],
      greifer: "fuenfschalen",
    },
    // Kein Zielbehaelter: Jedes Teil hat seine eigene Mulde — die richtige meldet `itemEntered.correct`
    ablageziel: null,
    zaehlwort: { de: "richtig", en: "correct" },
    schritte: [
      {
        beobachtet: "teil_gefasst",
        titel: { de: "Greif ein Teil", en: "Grab a part" },
        text: {
          de: "Spinne übers Teil, {boom-} und {grapple+}.",
          en: "Grapple over a part, {boom-} and {grapple+}.",
        },
        zeige: { fn: "grapple", richtung: "plus" },
      },
      {
        beobachtet: "teil_im_ziel",
        titel: { de: "In die richtige Mulde", en: "Into the right bay" },
        // Aus dem Sitz: Stahlhalde +x (links) hinten, Mischhalde −x (rechts) hinten, BUNT + VA rechts, MUELL vorn rechts
        text: {
          de: "STAHL hinten links, MISCH hinten rechts, BUNT rechts, MÜLL vorn.",
          en: "STEEL back left, MIXED back right, NON-FERROUS right, WASTE ahead.",
        },
        zeige: { fn: "cab", richtung: "beide" },
      },
    ],
    /*
     * Sterne (Konzept, Aufgabe 3): ★ alle sechs richtig · ★★ unter 4:00 und
     * hoechstens 1 Fehlwurf · ★★★ unter 2:30 und kein Fehlwurf. Ein falsch
     * eingeworfenes Teil darf man herausholen, es bleibt ein Fehlwurf. SW.
     */
    wertung: {
      zwei: { zeitS: 240, fehlwuerfe: 1 }, // SW, Konzept 19.10.2026
      drei: { zeitS: 150, fehlwuerfe: 0 }, // SW, Konzept 19.10.2026
    },
  },
  {
    id: "platt-machen",
    name: { de: "PLATT MACHEN", en: "FLATTEN IT" },
    beschreibung: {
      de: "Einen Wohnwagen mit der Spinne platt machen: zubeißen, auf, weiter, wieder zu.",
      en: "Flatten a caravan with the grapple: bite, open, move on, bite again.",
    },
    ziel: {
      de: "Mach den Wohnwagen platt — nur mit der Spinne.",
      en: "Flatten the caravan — with the grapple only.",
    },
    /*
     * DER WOHNWAGEN (E-135, knautscht dreimal so schnell wie ein Pkw) steht
     * vorn auf 8°, 7,4 m, Deichsel zum Bagger, 10° schraeg — der einzige
     * Platz vorn, an dem Aufbau UND Deichsel (1,3 m vor dem Bug,
     * `FORM_WOHNWAGEN`) frei von MUELL-Mulde und Besenplatz bleiben
     * (0,3 m Rand, Abtastung 1°/0,2 m/5°, `test/aufgabe4.test.ts`).
     *
     * WAS PLATT MACHT — gemessen am echten Bagger (G3, `test/aufgabe4.test.ts`):
     *   Zudruecken auf dem Wohnwagen (ein Biss)   +0,26 je Biss: 3 Bisse 0,77,
     *                                             4 Bisse 1,00
     *   Haemmern mit der leeren Spinne (30 Schlaege) 0,00 — es schiebt ihn
     *                                             nur 2,8 m weg
     *   Zu und mit dem Hauptarm nachdruecken        nur der erste Biss (0,26)
     * Darum lehrt die Aufgabe Zudruecken, nicht Haemmern (Rueckfrage an
     * Patrick, Bericht G3): Haemmern ist heute nur zu hoeren (E-137/E-139).
     */
    aufbau: {
      wracks: [
        {
          art: "wohnwagen",
          x: BAGGER_STAND.x + 7.4 * Math.sin((8 * Math.PI) / 180),
          z: BAGGER_STAND.z + 7.4 * Math.cos((8 * Math.PI) / 180),
          gier: ((8 + 180 - 10) * Math.PI) / 180,
        },
      ],
      greifer: "fuenfschalen",
    },
    ablageziel: null,
    /*
     * Fertig bei 80 % (Konzept). // SW: Mit 0,26 je Biss sind das vier
     * Bisse (drei geben 0,77) — geuebt rund 20 s, unter der Minute fuer
     * ★★★. 0,75 waeren drei Bisse; das Konzept bleibt, bis Patrick spielt.
     */
    plattAb: 0.8,
    schritte: [
      {
        beobachtet: "wrack_geknautscht",
        titel: { de: "Beiß zu", en: "Bite" },
        text: {
          de: "Offene Spinne aufs Dach, {boom-}, dann {grapple+}.",
          en: "Open grapple onto the roof, {boom-}, then {grapple+}.",
        },
        zeige: { fn: "grapple", richtung: "plus" },
      },
      {
        beobachtet: "wrack_platt",
        titel: { de: "Mach ihn platt", en: "Flatten it" },
        text: {
          de: "{grapple-}, ein Stück weiter, wieder {grapple+} — bis er platt ist.",
          en: "{grapple-}, move along a bit, {grapple+} again — until it is flat.",
        },
        zeige: { fn: "grapple", richtung: "beide" },
      },
    ],
    /* Sterne (Konzept, Aufgabe 4): ★ zu 80 % platt · ★★ unter 2:00 · ★★★ unter 1:00. SW. */
    wertung: {
      zwei: { zeitS: 120 }, // SW, Konzept 19.10.2026
      drei: { zeitS: 60 }, // SW, Konzept 19.10.2026
    },
  },
  {
    id: "magnet",
    name: { de: "MAGNET", en: "MAGNET" },
    beschreibung: {
      de: "Mit dem Lasthebemagnet den Haufen sortieren: Eisen in die Stahlhalde, Späne in die Mischhalde. Kupfer haftet nicht — es bleibt liegen.",
      en: "Sort the pile with the lifting magnet: iron to the steel bay, swarf to the mixed bay. Copper does not stick — leave it.",
    },
    ziel: {
      de: "Eisen auf STAHL, Späne auf MISCH, Kupfer liegen lassen.",
      en: "Iron to STEEL, swarf to MIXED, leave the copper.",
    },
    /*
     * DER HAUFEN (Konzept Aufgabe 5): fuenf magnetische Teile — zwei
     * Spaeneknaeuel (E-147, 82 % Stahl), Stahlknueppel, LKW-Felge,
     * Vierkantstahl — und zwei Kupferteile, die liegen bleiben
     * (`bleibtLiegen`). Ob etwas haftet, sagt dieselbe Regel wie im Spiel
     * (`ferroAnteil` ≥ `MAGNET_AB`), bewacht in `test/aufgabe5.test.ts`.
     *
     * Locker statt gestapelt (Spawn ohne Ueberlappung, v2 E-010, 0,3 m Luft):
     * Der Magnet (Wirkfeld 0,75 m, E-146) holt so ein bis zwei Stuecke je
     * Gang. Links vorn auf 48–69°, 6,4–9,0 m: vorn zwischen MUELL und
     * Besenplatz ist kein Platz fuer sieben Teile (Aufgabe 3, Kopf).
     *
     * SPAENE SIND MISCHSCHROTT (E-147, Patrick 17.10.2026) — und gehoeren
     * darum auch hier in die Mischhalde (Patrick 20.10.2026, G4): Jedes
     * Knaeuel hat `ziel: "c_mixed"`, das Eisen geht auf `zielBehaelter`.
     * Spaene in STAHL oder Eisen in MISCH ist ein Fehlwurf, Kupfer in einer
     * der beiden Halden ein Fremdteil (`challenge.ts`).
     *
     * BEIDE HALDEN OHNE FAHREN — dieselbe Abwurf-Rechnung wie Sortieren
     * (`abwurf` in `test/aufgabenplatz.ts`, 1 m Luft zu den Zonenraendern
     * und Bauwerken, im Schwenkband): STAHL hinten links bei rund 160°, MISCH
     * hinten rechts bei rund −160° (200° links herum). Vom Haufen (48–69°)
     * geht es zu beiden nach links weiter ({cab+}), zu MISCH 40° mehr.
     */
    aufbau: {
      teile: [
        { name: "Späneknäuel", ...vorDemBagger(48, 6.4), ziel: "c_mixed" },
        { name: "Kupferrohr-Bund", ...vorDemBagger(61, 6.4), bleibtLiegen: true },
        { name: "Stahlknüppel", ...vorDemBagger(50, 7.8) },
        { name: "Kupferrohr", ...vorDemBagger(60, 8.0), bleibtLiegen: true },
        { name: "Späneknäuel", ...vorDemBagger(69, 7.9), ziel: "c_mixed" },
        { name: "LKW-Felge", ...vorDemBagger(53, 9.0) },
        { name: "Vierkantstahl", ...vorDemBagger(65, 9.0) },
      ],
      greifer: "magnet",
    },
    // Eisen; die Spaene nennen ihr eigenes Ziel (oben)
    zielBehaelter: "c_steel",
    ablageziel: null,
    // Ein Zaehler fuer alle fuenf (wie Sortieren) — welche Halde, zeigt die gruene Marke beim Halten
    zaehlwort: { de: "richtig", en: "correct" },
    schritte: [
      {
        beobachtet: "teil_gefasst",
        titel: { de: "Magnet an", en: "Magnet on" },
        // Magnet: „schliessen" schaltet ein (E-146)
        text: {
          de: "Magnet über den Haufen, {grapple+}: an, dann {boom-}.",
          en: "Magnet over the pile, {grapple+}: on, then {boom-}.",
        },
        zeige: { fn: "grapple", richtung: "plus" },
      },
      {
        beobachtet: "teil_ueber_ziel",
        titel: { de: "Zur richtigen Halde", en: "To the right bay" },
        // Beide Halden hinten: vom Haufen auf ~55° nach links weiter = cabYaw steigt = plus (STAHL ~160°, MISCH ~200°)
        text: {
          de: "{boom+}: hoch, {cab+} nach hinten — Eisen auf STAHL, Späne auf MISCH.",
          en: "{boom+}: up, {cab+} to the back — iron to STEEL, swarf to MIXED.",
        },
        zeige: { fn: "cab", richtung: "plus" },
      },
      {
        beobachtet: "teil_im_ziel",
        titel: { de: "Magnet aus", en: "Magnet off" },
        text: {
          de: "{grapple-}: aus, es fällt. Hol alles, nur das Kupfer bleibt.",
          en: "{grapple-}: off, it drops. Fetch it all, leave only the copper.",
        },
        zeige: { fn: "grapple", richtung: "minus" },
      },
    ],
    /*
     * Sterne (Konzept, Aufgabe 5; G4): ★ alles Magnetische richtig · ★★ unter
     * 3:00 · ★★★ unter 2:00, kein Kupfer in einer Halde und kein Fehlwurf.
     * Die Zeiten bleiben, obwohl MISCH 40° weiter liegt als STAHL: Der Magnet
     * holt ein bis zwei Stuecke je Gang, der Test-Fahrer braucht gemessen
     * (`test/aufgabe5.test.ts`) deutlich unter 2:00. „Kein Fehlwurf" ist neu,
     * weil die Aufgabe jetzt sortiert wie Aufgabe 3 (dort ★★★ ebenso). SW.
     */
    wertung: {
      zwei: { zeitS: 180 }, // SW, Konzept 19.10.2026
      drei: { zeitS: 120, fremdteile: 0, fehlwuerfe: 0 }, // SW, Konzept 19.10.2026, Fehlwurf G4 (Patrick 20.10.2026)
    },
  },
  {
    id: "schwere-last",
    name: { de: "SCHWERE LAST", en: "HEAVY LOAD" },
    beschreibung: {
      de: "Ein ausgeschlachtetes LKW-Wrack, fast 5 Tonnen, weiter hinaus heben. Allein geht es nicht — stütz dich ab.",
      en: "Lift a stripped truck wreck, almost 5 tonnes, further out. It will not go on its own — use the outriggers.",
    },
    ziel: {
      de: "Leg das LKW-Wrack in den grünen Kreis.",
      en: "Put the truck wreck into the green circle.",
    },
    /*
     * DAS AUSGESCHLACHTETE LKW-WRACK (Patrick 20.10.2026, Wahl B): alle Teile
     * ab (`restoreState`), der Rumpf allein `LKW_DEF.hullMassKg` = 4 990 kg.
     * Traglast dafuer (`nutzlastKg`, E-154/E-156, Fuenfschalengreifer):
     * frei stehend bis 5,61 m Ausladung, mit Pratzen bis 8,68 m — gemessen
     * mit `tools/schwere-last.ts` (MASSE=rumpf) und im Durchlauf
     * `test/aufgabe6.test.ts`.
     *
     * START nah, damit es ohne Pratzen hochgeht: Mitte 5,0 m auf 80° links,
     * quer zur Blicklinie, Fahrerhaus nach vorn (Gier 80° − 90°). Gefasst
     * wurde gemessen bei 5,06 m (0,56 m unter der Grenze); am Fahrerhausdach
     * waeren es 5,35 m. Die Innenkante liegt 3,75 m vom Sitz, mehr als 0,8 m
     * neben jedem Pratzenteller (`PRATZE_X/Z`).
     *
     * ZIEL weit: der Ablagekreis um 7,35 m auf demselben Strahl, Halbmesser
     * 0,85 m — die Wrackmitte liegt damit zwischen 6,50 und 8,20 m: 0,9 m
     * ueber der freien Grenze, 0,5 m unter der mit Pratzen. Wer es ohne
     * Pratzen hinausfaehrt, bekommt gemessen bei 5,60 m die Ueberlast-Meldung
     * (E-152), dann den Tipp. 80° statt 75°: Bei 75° reichte ein quer
     * liegendes Wrack am vorderen Kreisrand in den (in Aufgaben leeren)
     * Besenplatz.
     *
     * WARUM NICHT DIE STAHLHALDE (Auftrag G3, E-182): Die Zone ist 5,2 m
     * breit (x 0,6 … 5,8), das Wrack 6,0 m lang — quer passt es nicht hinein,
     * laengs laege die Mitte bei z −32 und 10 m vom Sitz (Grenze mit Pratzen
     * 8,68). Bleibt laengs mit der Mitte an der Vorderkante, halb draussen —
     * dafuer muesste man das Wrack mit dem Rotator um 90° drehen, denn es
     * kommt quer an. Die Mischhalde ist breiter (6,8 m), aber auch dort laege
     * die Mitte bei 8,2–8,5 m, an der Grenze. Darum ein Kreis auf freier
     * Flaeche.
     *
     * FREI (`test/aufgabe6.test.ts`, 0,3 m Rand, mit Besenplatz): Start in
     * jeder Lage; im Kreis quer bis 8,5 m, laengs nur bis 7,0 m (dahinter
     * die Ostmauer) — das Wrack kommt quer an, wie es gegriffen wurde.
     */
    aufbau: {
      wracks: [
        {
          art: "lkw",
          x: BAGGER_STAND.x + SCHWER_START_M * Math.sin(SCHWER_WINKEL),
          z: BAGGER_STAND.z + SCHWER_START_M * Math.cos(SCHWER_WINKEL),
          gier: SCHWER_WINKEL - Math.PI / 2,
          ausgeschlachtet: true,
        },
      ],
      greifer: "fuenfschalen",
    },
    ablageziel: {
      x: BAGGER_STAND.x + SCHWER_ZIEL_M * Math.sin(SCHWER_WINKEL),
      z: BAGGER_STAND.z + SCHWER_ZIEL_M * Math.cos(SCHWER_WINKEL),
    },
    ablageRadiusM: 0.85, // SW, Herleitung oben: Mitte zwischen 6,50 und 8,20 m
    zielMarke: {
      x: BAGGER_STAND.x + SCHWER_ZIEL_M * Math.sin(SCHWER_WINKEL),
      y: 0,
      z: BAGGER_STAND.z + SCHWER_ZIEL_M * Math.cos(SCHWER_WINKEL),
    },
    // Der Kreis steht von Anfang an (Patrick 20.10.2026, G4) — man sieht, wohin es geht, bevor man greift
    zielMarkeAbStart: true,
    tippNachUeberlast: {
      de: "Zu schwer so weit draußen: Stütz dich ab (STÜTZEN) und versuch es nochmal.",
      en: "Too heavy that far out: put the outriggers down (OUTRIGGER) and try again.",
    },
    schritte: [
      {
        beobachtet: "wrack_gefasst",
        titel: { de: "Greif das Wrack", en: "Grab the wreck" },
        text: {
          de: "{cab+} zum Wrack, {boom-} auf den Rahmen, {grapple+}.",
          en: "{cab+} to the wreck, {boom-} onto the frame, {grapple+}.",
        },
        zeige: { fn: "cab", richtung: "plus" },
      },
      {
        beobachtet: "wrack_gehoben",
        titel: { de: "Heb an", en: "Lift it" },
        text: {
          de: "{boom+}: anheben, bis es frei hängt.",
          en: "{boom+}: lift until it hangs free.",
        },
        zeige: { fn: "boom", richtung: "plus" },
      },
      {
        beobachtet: "wrack_abgelegt",
        titel: { de: "In den Kreis", en: "Into the circle" },
        text: {
          de: "{stick+}: hinaus bis über den grünen Kreis, dann absetzen und {grapple-}.",
          en: "{stick+}: out over the green circle, then set it down and {grapple-}.",
        },
        zeige: { fn: "stick", richtung: "plus" },
      },
    ],
    /*
     * Sterne (Konzept, Aufgabe 6): ★ abgelegt · ★★ unter 3:00 · ★★★ unter
     * 2:00 und hoechstens eine Ueberlast-Meldung (die erste, die zum Tipp
     * fuehrt, ist frei). SW.
     */
    wertung: {
      zwei: { zeitS: 180 }, // SW, Konzept 19.10.2026
      drei: { zeitS: 120, ueberlasten: 1 }, // SW, Konzept 19.10.2026
    },
  },
];

export function challengeNach(id: string): ChallengeDaten | null {
  return CHALLENGES.find((c) => c.id === id) ?? null;
}

/** Stelle im Katalog ab 1 (fuer `ChallengeLauf` und `challenge:start`), 0 = unbekannt. */
export function challengeNr(id: string): number {
  return CHALLENGES.findIndex((c) => c.id === id) + 1;
}

