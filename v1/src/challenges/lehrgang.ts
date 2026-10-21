import type { LektionDaten } from "./lektion";

/**
 * DER LEHRGANG — als DATEN (E-196; L3, Patrick 21.10.2026: „Alles in einem
 * Durchgang").
 *
 * EIN Lehrgang am Stueck, danach direkt Pruefung 1. Reihenfolge laut
 * Patrick: Kamera, Fahren, Schwenken, Arm/Stiel (Etappe 2a, gebaut) —
 * Greifen/Rotator, Absetzen/Werfen, Stuetzen/Traglast, Haemmern/Zudruecken,
 * Zerlegen, Presse, Magnet, Abholer/Hupe, Sortieren (Etappe 2b, folgt als
 * weitere Schritte hinten an `schritte`). Budget gesamt 8–12 min, davon die
 * Grundsteuerung rund 3 min.
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
      de: "Kamera, Fahren, Schwenken, Hauptarm und Stiel — am Stück.",
      en: "Camera, driving, swinging, boom and stick — in one go.",
    },
    ziel: { de: "Mach dem Bagger alles nach.", en: "Copy what the machine shows you." },
    schritte: [
      /* --- Kamera ------------------------------------------------------ */
      {
        symbol: "kamera",
        titel: { de: "Kamera drehen", en: "Turn the camera" },
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
        text: {
          de: "Zwei Finger in der Bildmitte spreizen oder kneifen: näher ran, weiter weg.",
          en: "Spread or pinch two fingers in the middle: closer or farther.",
        },
        zeige: null,
        // SW: Abstand halbieren (11 → 5,5 m, Grenze 3 m), dann verdoppeln — genau zurueck
        vorfuehrung: [{ dauerS: 1.0, kamera: { zoomProS: 0.5 } }, { dauerS: 0.4 }, { dauerS: 1.0, kamera: { zoomProS: 2 } }, { dauerS: 0.3 }],
        ziel: { art: "aenderung", groesse: "zoom", richtung: "beide", ab: 0.25 }, // SW: ein Viertel naeher oder weiter
      },
      {
        symbol: "ansicht",
        titel: { de: "Ansicht wechseln", en: "Switch view" },
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
        text: { de: "{boom+}: Der Hauptarm geht hoch, {boom-}: wieder runter.", en: "{boom+}: the boom goes up, {boom-}: down again." },
        zeige: { fn: "boom", richtung: "plus" },
        // SW: 0,8 s voll = 15° hoch, zurueck (L3b: vorher 19°; kleiner, damit aus mehr Lagen eine Richtung frei ist — erst heben bis 54°, darueber erst senken)
        vorfuehrung: [{ dauerS: 0.8, achsen: { boom: 1 } }, { dauerS: 0.5 }, { dauerS: 0.8, achsen: { boom: -1 } }, { dauerS: 0.5 }],
        ziel: { art: "aenderung", groesse: "boom", richtung: "plus", ab: 10 * GRAD }, // SW
      },
      {
        symbol: "stiel",
        titel: { de: "Stiel", en: "Stick" },
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
    ],
  },
];

/** Stelle einer Lektion im Lehrgang (ab 1), 0 = unbekannt. Seit L3 gibt es genau eine. */
export function lektionNr(id: string): number {
  return LEKTIONEN.findIndex((l) => l.id === id) + 1;
}
