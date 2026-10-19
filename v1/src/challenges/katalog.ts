import type { ChallengeDaten } from "./challenge";
import { START_AUTOS } from "../world/startplatz";
import { PRESS_CENTER } from "../world/press";
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
 * (`BESEN_PLATZ`, im Sandkasten), auf der rechten bei −22° die MUELL-Mulde,
 * deren Ecke das Teil schon bei −15° beruehrte. Bei 15° sind es 2,3 m
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
 * geht dabei ueber die Ecke der MUELL-Mulde (Oberkante 1,2 m nach
 * `rolloffOberkante`) und bei z −16,8 ueber die 2,0-m-Nordflanke der Box —
 * darum verlangt „Heb an" die Unterkante 0,3 m ueber 2,0 m.
 */
const ERSTER_GRIFF_WINKEL = (15 * Math.PI) / 180; // Herkunft oben
const ERSTER_GRIFF_AUSLADUNG = 8.13; // gemessen, oben

export const CHALLENGES: readonly ChallengeDaten[] = [
  {
    id: "erster-griff",
    name: { de: "ERSTER GRIFF", en: "FIRST GRAB" },
    beschreibung: {
      de: "Ein Kupferteil greifen, anheben und in die Box BUNT + VA legen. Hier lernst du die vier Grundbewegungen.",
      en: "Grab a copper part, lift it and drop it into the BUNT + VA bay. Learn the four basic moves.",
    },
    ziel: {
      // Hoechstens ~50 Zeichen: eine Zeile auf dem iPhone mini quer (ui-Messung E-162)
      de: "Leg das Kupferteil in die Box BUNT + VA.",
      en: "Put the copper part into the BUNT + VA bay.",
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
          en: "{cab-}: swing right until the part is above BUNT + VA.",
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
    /*
     * Das Wrack steht (noch) auf dem Platz des zweiten Startautos: im
     * Schwenkband, nicht in der Presse, frei von den Trennsteinen —
     * gerechnet und bewacht in `test/startplatz.test.ts`. Der Umzug nach
     * schraeg vorn (Konzept, Aufgabe 2) kommt in der naechsten Runde.
     */
    aufbau: { wracks: [{ art: "pkw", x: START_AUTOS[1]!.x, z: START_AUTOS[1]!.z }] },
    // Ablageziel ist die Kammermitte — dieselbe Zahl, um die die Presse gebaut ist
    ablageziel: { x: PRESS_CENTER.x, z: PRESS_CENTER.z },
    schritte: [
      {
        beobachtet: "wrack_gefasst",
        titel: { de: "Greif das Wrack", en: "Grab the wreck" },
        /*
         * „hinter dir": Der Bagger schaut beim Start nach +z (`heading = 0`),
         * das Wrack steht 8,5 m in −z — also hinter der Kabine, ausserhalb des
         * ersten Bilds. Ohne diesen Satz sucht man es.
         */
        text: {
          de:
            "Das Wrack steht hinter dir.\n" +
            "{schwenken}: Oberwagen drehen\n" +
            "{hauptarm}: Hauptarm heben/senken\n" +
            "{ausleger}: Ausleger heran/weg\n" +
            "Spinne aufs Wrack senken, dann\n" +
            "{schliessen}: Spinne schließen",
          en:
            "The wreck is behind you.\n" +
            "{schwenken}: swing\n" +
            "{hauptarm}: boom up/down\n" +
            "{ausleger}: stick in/out\n" +
            "Lower the grapple onto the wreck, then\n" +
            "{schliessen}: close the grapple",
        },
        zeige: { fn: "cab", richtung: "beide" },
      },
      {
        // Die Griffe kennt er jetzt — hier steht nur noch das Ziel
        beobachtet: "wrack_ueber_kammer",
        titel: { de: "Ab zur Presse", en: "Over to the press" },
        // Die Presse steht bei x −8 neben dem Sitz (x −0,5) — vom Fahrer aus rechts
        text: {
          de: "Heb das Wrack an und schwenk es über die offene Kammer der Presse, rechts neben dem Bagger.",
          en: "Lift the wreck and swing it over the open press chamber, to the right of the machine.",
        },
        zeige: null,
      },
      {
        beobachtet: "wrack_in_kammer",
        titel: { de: "Ablegen", en: "Set it down" },
        text: {
          de: "Absenken, dann\n{oeffnen}: Spinne öffnen\nMittig und ohne Aufschlag gibt Sterne.",
          en: "Lower it, then\n{oeffnen}: open the grapple\nCentred and without a hard hit earns stars.",
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
     * 40 cm (ein Drittel davon) mittig. Harter Aufschlag: `HART_AB_MS` in
     * `challenge.ts`.
     */
    wertung: {
      zwei: { zeitS: 180, praezisionCm: 100 }, // SW, Konzept 19.10.2026
      drei: { zeitS: 90, praezisionCm: 40, harteAufschlaege: 0 }, // SW, Konzept 19.10.2026
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

