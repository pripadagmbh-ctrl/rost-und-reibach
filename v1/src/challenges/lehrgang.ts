import type { LektionDaten } from "./lektion";

/**
 * DER LEHRGANG — als DATEN (E-196; L3, Patrick 21.10.2026: „Alles in einem
 * Durchgang").
 *
 * EIN Lehrgang am Stueck, danach direkt Pruefung 1. Reihenfolge laut
 * Patrick: Kamera, Fahren, Schwenken, Arm/Stiel (Teil 1, Schritte 1–9) —
 * Greifen/Rotator, Absetzen, Stuetzen/Traglast, Haemmern/Zudruecken,
 * Zerlegen, Presse, Magnet, Sortieren, Hupe (Teil 2, Schritte 10–24, L8).
 * Budget gesamt 8–12 min, davon die Grundsteuerung rund 3 min, Teil 2
 * 6–8 min (spiel-konzept.md Fassung 3, Abschnitt 2: Steuerung ohne Uhr,
 * danach die WOCHE).
 *
 * TEIL 2 (L8) uebt in der Welt, an STATIONEN: Ein Schritt mit `station`
 * stellt den fertigen Aufbau einer Pruefung aus `katalog.ts` auf den Platz
 * (`lehrgang:station`, main.ts baut ihn auf und faehrt die Pruefung stumm
 * als `StationLauf`, `station.ts`); er gilt bis zum naechsten Schritt mit
 * `station`. Erfuellt ist ein Welt-Schritt, wenn die Station die Beobachtung
 * gesehen hat (`ziel.art "station"`), ein Ereignis kam (Abriss, richtiger
 * Einwurf, Hupe) oder ein Zustand an ist (Pratzen unten, Kranz offen).
 * Vorgefuehrt wird dort nichts (ausser Drehen): Leuchten, Pfeil und Weg der
 * Zielmarke zeigen, wohin, der Lotse (`lektion.ts` welt), welcher Stick.
 *   Stationen: erster-griff (Greifen, Drehen, Ablegen) · schwere-last
 *   (Kranz, Stuetzen, Last) · platt-machen (Haemmern, Quetschen) ·
 *   verladen (Zerlegen, Presse, Pressen) · magnet · sortieren (und Hupe).
 *   Budget je Schritt (Mensch, geschaetzt): Zurueck 0–15 s, Greifen 30,
 *   Drehen 10, Ablegen 30, Kranz 5, Stuetzen 5, Last 30, Haemmern 25,
 *   Quetschen 20, Zerlegen 30, Presse 40, Pressen 10, Magnet 45,
 *   Sortieren 60, Hupe 5 — zusammen rund 6 min, mit Suchen bis 8.
 *   Verworfen fuer den Lehrgang: „Werfen" und „Abholer" — beides lehrt die
 *   WOCHE (Annahme L8); die Hupe steht fuer den Abholer (E-191). Kein
 *   eigener Schritt „Heben" vor „Ablegen": Der Lotse sagt mit Last zuerst
 *   „hoch", dann „hinueber".
 *
 * Gestrafft gegenueber den Lektionen 1–3 (16 → 9 Schritte):
 *   - Kamera neigen entfaellt: dieselbe Geste wie Drehen, nur senkrecht —
 *     wer drehen kann, findet neigen von selbst.
 *   - Kamera zuruecksetzen (Doppeltipp Mitte) entfaellt: Der Ansicht-Umlauf
 *     endet ohnehin auf dem Startpunkt (`orbitCamera.ts` zumStart) — das ist
 *     der Rettungsweg, den der Lehrgang schon zeigt.
 *   - Fahren vor/zurueck → ein Schritt hin und zurueck.
 *   - Schwenken links/rechts → ein Schritt nach beiden Seiten. Er kommt
 *     NACH dem Fahren und ersetzt „Fahren aus": Mit Fahren an fuehrt der
 *     linke Stick das Fahrwerk, schwenken geht erst nach dem Ausschalten.
 *   - Hauptarm heben/senken → ein Schritt; Stiel aus/ein → ein Schritt.
 *
 * `wort` (L7-W, Patrick 22.10.2026, Punkt 44a): 1–3 Woerter neben dem
 * Bildzeichen der Leiste, hoechstens `WORT_MAX_ZEICHEN` Zeichen
 * (`ui/lektionskarte.ts`, Waechter `test/lehrgangsleiste.test.ts`).
 * Wortwahl Patrick 22.10.2026 („Markierung, Ansicht und Stiel checkt keiner"):
 * was man sieht statt Fachwort — Fahrersicht, Außensicht, Ausleger heben,
 * Arm strecken, Greifer aufs Ziel; auch in Teil 2 kein „Stiel", „Marke",
 * „Rotator".
 *
 * Jeder Schritt: Symbol am Rand (Bildsprache, ui), Vorfuehrung 2–5 s,
 * `titel`/`text` nur noch fuer aria-label und Rueckfall
 * (`test/lehrgang.test.ts`: zweisprachig, iPhone mini quer). Jede
 * Vorfuehrung endet in der Lage, in der sie begann („hin und zurueck"):
 * Zwischen den Wegen steht eine Pause, laenger als die Anlauframpe des
 * Baggers (Arm 0,3 s, Fahren 0,7 s, `excavator.ts` RAMP_TIME/DRIVE_RAMP_TIME)
 * — so heben sich Anfahren und Ausrollen der Wege genau auf. Genau heisst:
 * jeder Weg gleich lang. Ein langer Rueckweg statt zwei kurzer laesst einen
 * Auslauf uebrig, und der ist weicher als der Anlauf (`excavator.ts` ramp) —
 * so kamen die 0,51° beim Schwenken zustande (qa 21.10., L3b).
 * Geschrieben ist jede Spur „weg vom Boden" (erst heben, erst ausfahren);
 * steht der Spieler so, dass sie an einen Anschlag liefe, dreht `richteSpur`
 * (`lektion.ts`) sie bei Beginn des Schritts um (L3b).
 *
 * Masse fuer die Spuren: Drehkranz 33°/s, Hauptarm 19°/s, Stiel 24°/s bei
 * vollem Ausschlag, Fahren 3,2 m/s (`excavator.ts` CAB_MAX, BOOM_RATE,
 * STICK_RATE, DRIVE_MAX). Kamera wie `orbitCamera.ts`: Gier 0,006 rad je
 * Einheit `orbitDX`, Abstand mal `zoomFactor`.
 */
const GRAD = Math.PI / 180;

export const LEKTIONEN: readonly LektionDaten[] = [
  {
    id: "lehrgang",
    name: { de: "LEHRGANG", en: "TRAINING" },
    beschreibung: {
      de: "Kamera, Fahren, Arm — dann Greifen, Presse, Magnet. Am Stück.",
      en: "Camera, driving, arm — then grabbing, press, magnet. In one go.",
    },
    ziel: { de: "Mach dem Bagger alles nach.", en: "Copy what the machine shows you." },
    schritte: [
      /* --- Kamera ------------------------------------------------------ */
      {
        symbol: "kamera",
        titel: { de: "Kamera drehen", en: "Turn the camera" },
        wort: { de: "Kamera drehen", en: "Turn camera" },
        text: {
          de: "Einen Finger in der Bildmitte quer ziehen: Die Kamera kreist um den Bagger.",
          en: "Drag one finger sideways in the middle: the camera circles the machine.",
        },
        zeige: null,
        // SW: 130 je s × 1 s = 0,78 rad (45°) hin, Pause, zurueck
        vorfuehrung: [{ dauerS: 1.0, kamera: { gierProS: 130 } }, { dauerS: 0.3 }, { dauerS: 1.0, kamera: { gierProS: -130 } }, { dauerS: 0.3 }],
        ziel: { art: "aenderung", groesse: "kameraGier", richtung: "beide", ab: 25 * GRAD }, // SW
      },
      {
        symbol: "kamera",
        titel: { de: "Zoomen", en: "Zoom" },
        wort: { de: "Zoom", en: "Zoom" },
        text: {
          de: "Zwei Finger in der Bildmitte spreizen und kneifen: näher ran und weiter weg.",
          en: "Spread and pinch two fingers in the middle: closer and farther.",
        },
        zeige: null,
        // SW: Abstand halbieren (11 → 5,5 m, Grenze 3 m), dann verdoppeln — genau zurueck
        vorfuehrung: [{ dauerS: 1.0, kamera: { zoomProS: 0.5 } }, { dauerS: 0.4 }, { dauerS: 1.0, kamera: { zoomProS: 2 } }, { dauerS: 0.3 }],
        // SW: je ein Viertel naeher UND weiter (L5-B, Patrick 22.10. Punkt 40c: „sollte … das Rein- und Rauszoomen sein")
        ziel: { art: "aenderung", groesse: "zoom", richtung: "hinUndZurueck", ab: 0.25 },
      },
      {
        symbol: "ansicht",
        titel: { de: "Ansicht wechseln", en: "Switch view" },
        wort: { de: "Fahrersicht", en: "Driver view" },
        text: {
          de: "Rechts doppelt tippen: von oben, aus der Kabine, von der Seite.",
          en: "Double-tap on the right: from above, from the cab, from the side.",
        },
        zeige: null,
        // Orbit → Draufsicht → Kabine → Seite → Orbit (`orbitCamera.ts`); jede Ansicht 1,5 s (SW), zurueck auf dem Startpunkt
        vorfuehrung: [
          { dauerS: 1.5, tasten: ["KeyC"] },
          { dauerS: 1.5, tasten: ["KeyC"] },
          { dauerS: 1.5, tasten: ["KeyC"] },
          { dauerS: 0.5, tasten: ["KeyC"] },
        ],
        ziel: { art: "ansicht", modus: "gewechselt" },
      },
      {
        symbol: "ansicht",
        titel: { de: "Zurück nach draußen", en: "Back outside" },
        wort: { de: "Außensicht", en: "Outside view" },
        text: {
          de: "Weiter doppelt tippen, bis du wieder hinter dem Bagger stehst.",
          en: "Keep double-tapping until you're behind the machine again.",
        },
        zeige: null,
        // Ohne Vorfuehrung: Wohin es von hier geht, haengt davon ab, wo der Spieler steht
        vorfuehrung: null,
        ziel: { art: "ansicht", modus: "orbit" },
      },
      /* --- Fahren und Schwenken ---------------------------------------- */
      {
        symbol: "fahren",
        titel: { de: "Fahren", en: "Drive" },
        wort: { de: "Fahren", en: "Drive" },
        text: {
          de: "Pedale antippen: Fahren an. Linker Stick hoch und runter: vor und zurück.",
          en: "Tap the pedals: driving on. Left stick up and down: forward and back.",
        },
        zeige: null,
        // SW: halbes Gas (1,6 m/s) 1,2 s = 1,9 m, Pause > Rampe 0,7 s, zurueck
        vorfuehrung: [{ dauerS: 1.2, achsen: { drive: 0.5 } }, { dauerS: 0.8 }, { dauerS: 1.2, achsen: { drive: -0.5 } }, { dauerS: 0.8 }],
        ziel: { art: "aenderung", groesse: "fahrt", richtung: "beide", ab: 1.5 }, // SW: 1,5 m, ein Drittel Maschinenlaenge
      },
      {
        /*
         * „Fahren aus" ist nicht zu sehen (`TouchControls.fahrenAn` ist privat,
         * kein Ereignis). Gesehen wird die Folge: Mit Fahren aus schwenkt der
         * linke Stick wieder (Werksbelegung, `controlConfig.ts`).
         */
        symbol: "schwenken",
        titel: { de: "Schwenken", en: "Swing" },
        wort: { de: "Schwenken", en: "Swing" },
        text: {
          de: "Pedale antippen: Fahren aus. Dann {cab}: nach links und rechts schwenken.",
          en: "Tap the pedals: driving off. Then {cab}: swing left and right.",
        },
        zeige: { fn: "cab", richtung: "beide" },
        /*
         * SW: 0,8 s voll = 26° nach links und genauso zurueck, Pausen > Auslauf
         * (0,36 s). Nur links (L3b): Rechts vor dem Startplatz steht die
         * MUELL-Mulde (`containers.ts` MUELL_START, E-183) — die tief haengende
         * Spinne stoesst schon bei 5–10° rechts an sie, und der Arm haelt an
         * (gemessen kopflos: Ende 15° neben der Startlage). Das trifft jeden,
         * der in Schritt 6 einsteigt (Wiedereinstieg) oder zurueckgefahren ist.
         */
        vorfuehrung: [{ dauerS: 0.8, achsen: { cab: 1 } }, { dauerS: 0.5 }, { dauerS: 0.8, achsen: { cab: -1 } }, { dauerS: 0.5 }],
        ziel: { art: "aenderung", groesse: "cabYaw", richtung: "beide", ab: 20 * GRAD }, // SW
      },
      /* --- Hauptarm und Stiel ------------------------------------------ */
      {
        /*
         * Gefordert ist Heben: Aus der Startpose (35°) sitzt die offene Spinne
         * schon nach 6,8° Senken auf (28,2°, `katalog.ts` Aufgabe 1) — ein
         * Ziel „beide" waere mit Senken allein nicht zu schaffen.
         */
        symbol: "arm",
        titel: { de: "Hauptarm", en: "Boom" },
        wort: { de: "Ausleger heben", en: "Raise boom" },
        text: { de: "{boom+}: Der Hauptarm geht hoch, {boom-}: wieder runter.", en: "{boom+}: the boom goes up, {boom-}: down again." },
        zeige: { fn: "boom", richtung: "plus" },
        // SW: 0,8 s voll = 15° hoch, zurueck (L3b: vorher 19°; kleiner, damit aus mehr Lagen eine Richtung frei ist — erst heben bis 54°, darueber erst senken)
        vorfuehrung: [{ dauerS: 0.8, achsen: { boom: 1 } }, { dauerS: 0.5 }, { dauerS: 0.8, achsen: { boom: -1 } }, { dauerS: 0.5 }],
        ziel: { art: "aenderung", groesse: "boom", richtung: "plus", ab: 10 * GRAD }, // SW
      },
      {
        symbol: "stiel",
        titel: { de: "Stiel", en: "Stick" },
        wort: { de: "Arm strecken", en: "Extend arm" },
        text: { de: "{stick+}: Der Stiel schiebt die Spinne vor, {stick-}: holt sie heran.", en: "{stick+}: the stick pushes the grapple out, {stick-}: pulls it in." },
        zeige: { fn: "stick", richtung: "beide" },
        // SW: 0,8 s voll = 19° (Start −70°, Grenze −25°), zurueck
        vorfuehrung: [{ dauerS: 0.8, achsen: { stick: 1 } }, { dauerS: 0.5 }, { dauerS: 0.8, achsen: { stick: -1 } }, { dauerS: 0.5 }],
        ziel: { art: "aenderung", groesse: "stick", richtung: "beide", ab: 10 * GRAD }, // SW
      },
      {
        /*
         * Die Marke liegt (aus der Startlage) 1,1 m naeher am Bagger als die Spinne bei Beginn des
         * Schritts und 30° nach links geschwenkt. Nur Einfahren senkt die
         * Spinne dabei auf den Boden (der Stiel schwenkt nach unten) — Hauptarm
         * heben UND Stiel einfahren holt sie waagrecht heran: 0,8 s beide voll
         * ≈ 1,1 m (Armgeometrie `excavator.ts`, nachgemessen im
         * Kopflos-Durchlauf).
         *
         * Warum geschwenkt (L1b, Geraetebefund 21.10.): Geradeaus vor dem
         * Bagger liegt jeder erreichbare Bodenpunkt aus der Startkamera hinter
         * Oberwagen und Ausleger (Strahlprobe: −1,2 m 12/16 Ringpunkte
         * verdeckt, +3 m noch 14/16). Frei wird der Ring erst ab 26° Schwenk
         * zur Seite ohne Kabine (`cab+`, im Bild links); 30° gibt Abstand.
         * Waechter: `test/lehrgang-marke.test.ts`.
         */
        symbol: "marke",
        titel: { de: "Auf die Marke", en: "Onto the mark" },
        wort: { de: "Greifer aufs Ziel", en: "Grapple to target" },
        text: {
          de: "{cab+}, dann {boom+} und {stick-}: Spinne über die Marke.",
          en: "{cab+}, then {boom+} and {stick-}: grapple over the mark.",
        },
        zeige: { fn: "stick", richtung: "minus" },
        // SW: Schwenk 0,9 s voll ≈ 30°, dann Arm 0,8 s; zurueck in umgekehrter Folge
        vorfuehrung: [
          { dauerS: 0.9, achsen: { cab: 1 } },
          { dauerS: 0.8, achsen: { boom: 1, stick: -1 } },
          { dauerS: 1.0 },
          { dauerS: 0.8, achsen: { boom: -1, stick: 1 } },
          { dauerS: 0.9, achsen: { cab: -1 } },
          { dauerS: 0.5 },
        ],
        /*
         * SW: halber Meter, gut die Haelfte der offenen Spinne; 30° s. o.
         * Ohne `radialM` (L3b): Die Marke liegt, wohin die Vorfuehrung die
         * Spinne bis zum Halt bringt — aus der Startlage 1,1 m heran. Steht der
         * Arm so hoch, dass Heben an den Anschlag liefe, schiebt die
         * umgedrehte Spur sie hinaus, und die Marke liegt draussen.
         */
        ziel: { art: "marke", schwenkRad: 30 * GRAD, radiusM: 0.5 },
      },
      /*
       * ================= TEIL 2 (L8): in der Welt, an Stationen =================
       * Ab hier ohne Vorfuehrung (ausser Drehen): Was zu tun ist, zeigen die
       * Station (Leuchten, Pfeil, Weg der Zielmarke) und der Lotse
       * (`lehrgang:richtung` aus den Marken, `lektion.ts` welt).
       */
      {
        /*
         * Die Stationen liegen fest wie in den Pruefungen, gerechnet ab dem
         * Startplatz (`BAGGER_STAND`). Wer nach dem Fahren schon dort steht,
         * hat das Haekchen sofort.
         */
        symbol: "zurueck",
        titel: { de: "Zurück zum Platz", en: "Back to your spot" },
        wort: { de: "Zurück", en: "Back" },
        text: { de: "Fahr zurück auf die Marke, gerade ausgerichtet.", en: "Drive back onto the mark, facing straight ahead." },
        zeige: null,
        vorfuehrung: null,
        // SW: 1,0 m und 10° — die Pruefungen setzen den Bagger genau auf BAGGER_STAND; 1 m verschiebt ein Teil auf 8 m Ausladung um 7°, das faengt der Lotse
        ziel: { art: "ort", radiusM: 1.0, gierTolRad: 10 * GRAD },
      },
      {
        symbol: "greifen",
        titel: { de: "Teil greifen", en: "Grab the part" },
        wort: { de: "Greifen", en: "Grab" },
        text: { de: "{cab+} zum Teil, {boom-} ab, {grapple+}: zupacken.", en: "{cab+} to the part, {boom-} down, {grapple+}: grab it." },
        zeige: { fn: "grapple", richtung: "plus" },
        vorfuehrung: null,
        station: "erster-griff",
        ziel: { art: "station", beobachtet: "teil_gefasst" },
      },
      {
        symbol: "rotator",
        titel: { de: "Spinne drehen", en: "Rotate the grapple" },
        wort: { de: "Drehen", en: "Rotate" },
        text: { de: "{rotator}: Die Spinne dreht sich, hin und zurück.", en: "{rotator}: the grapple turns, there and back." },
        zeige: { fn: "rotator", richtung: "beide" },
        // SW: 0,6 s voll = 72° (ROTATOR_SPEED 120°/s ohne Rampe, `excavator.ts`), Pause, zurueck — wie alle Spuren gleich lange Wege
        vorfuehrung: [{ dauerS: 0.6, achsen: { rotator: 1 } }, { dauerS: 0.5 }, { dauerS: 0.6, achsen: { rotator: -1 } }, { dauerS: 0.5 }],
        // SW: 45°, deutlich mehr als ein Zucken, gut die Haelfte der Vorfuehrung
        ziel: { art: "aenderung", groesse: "rotator", richtung: "beide", ab: 45 * GRAD },
      },
      {
        symbol: "ablegen",
        titel: { de: "In die Box", en: "Into the bay" },
        wort: { de: "Ablegen", en: "Drop" },
        text: { de: "{boom+} hoch, {cab-} zur Box, {grapple-}: loslassen.", en: "{boom+} up, {cab-} to the bay, {grapple-}: let go." },
        zeige: { fn: "grapple", richtung: "minus" },
        vorfuehrung: null,
        ziel: { art: "station", beobachtet: "teil_im_ziel" },
      },
      {
        /*
         * Der Funktionskranz als eigener Schritt (Patrick, offene-punkte.md
         * 39c/42): erst aufklappen, dann folgen Stuetzen, Pressen, Hupe aus
         * dem Kranz. Die Station steht schon — der LKW wartet.
         */
        symbol: "kranz",
        titel: { de: "Funktionen öffnen", en: "Open the functions" },
        wort: { de: "Funktionen", en: "Functions" },
        text: { de: "Den Knopf unter dem Menü antippen: Die Funktionen klappen auf.", en: "Tap the button below the menu: the functions open." },
        zeige: null,
        vorfuehrung: null,
        station: "schwere-last",
        kranz: { code: null },
        ziel: { art: "zustand", was: "kranzOffen" },
      },
      {
        symbol: "stuetzen",
        titel: { de: "Abstützen", en: "Outriggers down" },
        wort: { de: "Stützen", en: "Outriggers" },
        text: { de: "STÜTZEN antippen: Die Pratzen gehen runter.", en: "Tap OUTRIGGERS: the pads go down." },
        zeige: null,
        vorfuehrung: null,
        kranz: { code: "KeyO" },
        ziel: { art: "zustand", was: "abgestuetzt" },
      },
      {
        symbol: "last",
        titel: { de: "Schwere Last", en: "Heavy load" },
        wort: { de: "Last heben", en: "Lift load" },
        text: { de: "{cab+} zum LKW, {grapple+}: fassen, {boom+}: anheben.", en: "{cab+} to the truck, {grapple+}: grab, {boom+}: lift." },
        zeige: { fn: "cab", richtung: "plus" },
        vorfuehrung: null,
        ziel: { art: "station", beobachtet: "wrack_gehoben" },
      },
      {
        symbol: "haemmern",
        titel: { de: "Hämmern", en: "Hammer" },
        wort: { de: "Hämmern", en: "Hammer" },
        text: { de: "Spinne über den Wohnwagen, dann {boom-} — mit Schwung.", en: "Grapple over the caravan, then {boom-} — with a swing." },
        zeige: { fn: "boom", richtung: "minus" },
        vorfuehrung: null,
        station: "platt-machen",
        ziel: { art: "station", beobachtet: "wrack_gehauen" },
      },
      {
        symbol: "quetschen",
        titel: { de: "Quetschen", en: "Crush" },
        wort: { de: "Quetschen", en: "Crush" },
        text: { de: "Offene Spinne aufs Dach, {boom-}, dann {grapple+}.", en: "Open grapple onto the roof, {boom-}, then {grapple+}." },
        zeige: { fn: "grapple", richtung: "plus" },
        vorfuehrung: null,
        // `wrack_beides` = Schlag UND Biss — der Schlag ist aus dem Schritt davor schon gesehen (dieselbe Station)
        ziel: { art: "station", beobachtet: "wrack_beides" },
      },
      {
        symbol: "zerlegen",
        titel: { de: "Zerlegen", en: "Dismantle" },
        wort: { de: "Zerlegen", en: "Dismantle" },
        text: { de: "Ein Teil am Auto fassen, {grapple+}, mit {boom+} abreißen.", en: "Grab a part of the car, {grapple+}, tear it off with {boom+}." },
        zeige: { fn: "grapple", richtung: "plus" },
        vorfuehrung: null,
        station: "verladen",
        // Ein Teil ab (`wrack:abriss` "ab"); die aufspringende Haube zaehlt nicht — aufgesprungen ist nicht ab (E-185)
        ziel: { art: "ereignis", ereignis: "abriss", anzahl: 1 },
      },
      {
        symbol: "presse",
        titel: { de: "In die Presse", en: "Into the press" },
        wort: { de: "In die Presse", en: "Into the press" },
        text: { de: "Auto fassen, {boom+} hoch, {cab-} zur Presse, {grapple-}.", en: "Grab the car, {boom+} up, {cab-} to the press, {grapple-}." },
        zeige: { fn: "cab", richtung: "minus" },
        vorfuehrung: null,
        ziel: { art: "station", beobachtet: "wrack_in_kammer" },
      },
      {
        symbol: "pressen",
        titel: { de: "Pressen", en: "Press" },
        wort: { de: "Pressen", en: "Press" },
        text: { de: "PRESSE antippen: Die Presse drückt das Auto zusammen.", en: "Tap PRESS: the press crushes the car." },
        zeige: null,
        vorfuehrung: null,
        kranz: { code: "KeyB" },
        ziel: { art: "station", beobachtet: "wrack_gepresst" },
      },
      {
        // Der Greifer wechselt mit dem Aufbau der Station (`magnet`: Lasthebemagnet, main.ts setzeGreifer)
        symbol: "magnet",
        titel: { de: "Magnet", en: "Magnet" },
        wort: { de: "Magnet", en: "Magnet" },
        text: { de: "Magnet über Eisen, {grapple+}: an, zur Halde, {grapple-}: aus.", en: "Magnet over iron, {grapple+}: on, to the bay, {grapple-}: off." },
        zeige: { fn: "grapple", richtung: "plus" },
        vorfuehrung: null,
        station: "magnet",
        // Ein richtiger Einwurf reicht — das ganze Sortieren mit dem Magnet ist die Pruefung
        ziel: { art: "ereignis", ereignis: "einwurf", anzahl: 1 },
      },
      {
        symbol: "sortieren",
        titel: { de: "Sortieren", en: "Sort" },
        wort: { de: "Sortieren", en: "Sort" },
        text: { de: "Zwei Teile in die Mulde ihrer Farbe.", en: "Two parts into the bay of their colour." },
        zeige: { fn: "grapple", richtung: "plus" },
        vorfuehrung: null,
        station: "sortieren",
        // SW: zwei richtige Einwuerfe — einer koennte Zufall sein, sechs sind die Pruefung
        ziel: { art: "ereignis", ereignis: "einwurf", anzahl: 2 },
      },
      {
        // Die Hupe steht fuer den Abholer (E-191: „Hupen = Laster darf abfahren") — den Abholer selbst lehrt die WOCHE
        symbol: "hupe",
        titel: { de: "Hupen", en: "Horn" },
        wort: { de: "Hupen", en: "Horn" },
        text: { de: "HUPE antippen: Der Laster darf abfahren.", en: "Tap HORN: the truck may leave." },
        zeige: null,
        vorfuehrung: null,
        kranz: { code: "Digit2" },
        ziel: { art: "ereignis", ereignis: "hupe", anzahl: 1 },
      },
    ],
  },
];

/** Stelle einer Lektion im Lehrgang (ab 1), 0 = unbekannt. Seit L3 gibt es genau eine. */
export function lektionNr(id: string): number {
  return LEKTIONEN.findIndex((l) => l.id === id) + 1;
}
