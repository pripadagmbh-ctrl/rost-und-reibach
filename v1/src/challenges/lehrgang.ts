import type { LektionDaten } from "./lektion";

/**
 * DER LEHRGANG — die Lektionen als DATEN (E-196, Patrick 21.10.2026).
 *
 * Jede Lektion: 1–2 min, 3–6 Schritte, Ziel in einem Satz, Bedienzeile je
 * Schritt hoechstens zwei Zeilen auf dem iPhone mini quer
 * (`test/lehrgang.test.ts`). Jede Vorfuehrung endet in der Lage, in der sie
 * begann („hin und zurueck"): Zwischen Hin- und Rueckweg steht eine Pause,
 * laenger als die Anlauframpe des Baggers (Arm 0,3 s, Fahren 0,7 s,
 * `excavator.ts` RAMP_TIME/DRIVE_RAMP_TIME) — so heben sich Anfahren und
 * Ausrollen beider Wege genau auf.
 *
 * Masse fuer die Spuren: Drehkranz 33°/s, Hauptarm 19°/s, Stiel 24°/s bei
 * vollem Ausschlag, Fahren 3,2 m/s (`excavator.ts` CAB_MAX, BOOM_RATE,
 * STICK_RATE, DRIVE_MAX). Kamera wie `orbitCamera.ts`: Gier 0,006 rad je
 * Einheit `orbitDX`, Nick 0,005 rad je `orbitDY`, Abstand mal `zoomFactor`.
 */
const GRAD = Math.PI / 180;

/** Die zwoelf Lektionen in Lehrgang-Reihenfolge (Patrick 21.10.2026). Gebaut sind 1–3. */
export const LEKTIONS_PLAN = [
  "kamera",
  "fahren-schwenken",
  "ausleger-stiel",
  "greifen-rotator",
  "absetzen-werfen",
  "pratzen-traglast",
  "haemmern-zudruecken",
  "zerlegen",
  "presse",
  "magnet",
  "abholer-funk",
  "sortieren",
] as const;

export const LEKTIONEN: readonly LektionDaten[] = [
  {
    id: "kamera",
    name: { de: "KAMERA & ANSICHT", en: "CAMERA & VIEW" },
    beschreibung: {
      de: "Kamera drehen, neigen, zoomen und die vier Ansichten kennenlernen.",
      en: "Turn, tilt and zoom the camera and get to know the four views.",
    },
    ziel: { de: "Schau dir den Bagger von allen Seiten an.", en: "Look at the machine from every side." },
    schritte: [
      {
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
        titel: { de: "Kamera neigen", en: "Tilt the camera" },
        text: {
          de: "Den Finger in der Bildmitte hoch oder runter ziehen.",
          en: "Drag the finger up or down in the middle.",
        },
        zeige: null,
        // SW: 80 je s × 1 s = 0,4 rad (23°) steiler, zurueck; Start 0,42 rad, Grenze 1,35
        vorfuehrung: [{ dauerS: 1.0, kamera: { nickProS: 80 } }, { dauerS: 0.3 }, { dauerS: 1.0, kamera: { nickProS: -80 } }, { dauerS: 0.3 }],
        ziel: { art: "aenderung", groesse: "kameraNick", richtung: "beide", ab: 12 * GRAD }, // SW
      },
      {
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
      {
        titel: { de: "Kamera zurücksetzen", en: "Reset the camera" },
        text: {
          de: "Kamera verdrehen, dann zweimal schnell in die Bildmitte tippen.",
          en: "Turn the camera, then double-tap the middle.",
        },
        zeige: null,
        // SW: 150 je s × 0,8 s = 0,72 rad weg, Doppeltipp holt sie auf den Startpunkt
        vorfuehrung: [{ dauerS: 0.8, kamera: { gierProS: 150 } }, { dauerS: 0.4 }, { dauerS: 0.8, kamera: { zuruecksetzen: true } }],
        ziel: { art: "kameraStart" },
      },
    ],
  },
  {
    id: "fahren-schwenken",
    name: { de: "FAHREN & SCHWENKEN", en: "DRIVE & SWING" },
    beschreibung: {
      de: "Den Oberwagen drehen, das Fahren einschalten, vor und zurück fahren.",
      en: "Swing the upper body, switch on driving, drive forward and back.",
    },
    ziel: { de: "Schwenk nach beiden Seiten und fahr ein Stück.", en: "Swing both ways and drive a bit." },
    schritte: [
      {
        titel: { de: "Nach links schwenken", en: "Swing left" },
        text: { de: "{cab+}: Der Oberwagen dreht nach links.", en: "{cab+}: the upper body swings left." },
        zeige: { fn: "cab", richtung: "plus" },
        // SW: 1 s voll = 33° hin, Pause > Rampe 0,3 s, zurueck
        vorfuehrung: [{ dauerS: 1.0, achsen: { cab: 1 } }, { dauerS: 0.5 }, { dauerS: 1.0, achsen: { cab: -1 } }, { dauerS: 0.5 }],
        ziel: { art: "aenderung", groesse: "cabYaw", richtung: "plus", ab: 20 * GRAD }, // SW
      },
      {
        titel: { de: "Nach rechts schwenken", en: "Swing right" },
        text: { de: "{cab-}: Der Oberwagen dreht nach rechts.", en: "{cab-}: the upper body swings right." },
        zeige: { fn: "cab", richtung: "minus" },
        vorfuehrung: [{ dauerS: 1.0, achsen: { cab: -1 } }, { dauerS: 0.5 }, { dauerS: 1.0, achsen: { cab: 1 } }, { dauerS: 0.5 }],
        ziel: { art: "aenderung", groesse: "cabYaw", richtung: "minus", ab: 20 * GRAD }, // SW
      },
      {
        titel: { de: "Fahren an, vorwärts", en: "Drive on, forward" },
        text: {
          de: "Pedale antippen: Fahren an. Dann den linken Stick nach oben.",
          en: "Tap the pedals: driving on. Then push the left stick up.",
        },
        zeige: null,
        // SW: halbes Gas (1,6 m/s) 1,2 s = 1,9 m, Pause > Rampe 0,7 s, zurueck
        vorfuehrung: [{ dauerS: 1.2, achsen: { drive: 0.5 } }, { dauerS: 0.8 }, { dauerS: 1.2, achsen: { drive: -0.5 } }, { dauerS: 0.8 }],
        ziel: { art: "aenderung", groesse: "fahrt", richtung: "plus", ab: 1.5 }, // SW: 1,5 m, ein Drittel Maschinenlaenge
      },
      {
        titel: { de: "Und zurück", en: "And back" },
        text: { de: "Linken Stick nach unten: rückwärts fahren.", en: "Pull the left stick down: drive backwards." },
        zeige: null,
        vorfuehrung: [{ dauerS: 1.2, achsen: { drive: -0.5 } }, { dauerS: 0.8 }, { dauerS: 1.2, achsen: { drive: 0.5 } }, { dauerS: 0.8 }],
        ziel: { art: "aenderung", groesse: "fahrt", richtung: "minus", ab: 1.5 }, // SW
      },
      {
        /*
         * „Fahren aus" ist nicht zu sehen (`TouchControls.fahrenAn` ist privat,
         * kein Ereignis). Gesehen wird die Folge: Mit Fahren aus schwenkt der
         * linke Stick wieder (Werksbelegung, `controlConfig.ts`).
         */
        titel: { de: "Fahren aus", en: "Driving off" },
        text: {
          de: "Pedale antippen: Fahren aus. Dann {cab}: kurz schwenken.",
          en: "Tap the pedals: driving off. Then {cab}: swing a little.",
        },
        zeige: { fn: "cab", richtung: "beide" },
        // SW: 0,5 s voll ≈ 16° hin und zurueck
        vorfuehrung: [{ dauerS: 0.5, achsen: { cab: 1 } }, { dauerS: 0.5 }, { dauerS: 0.5, achsen: { cab: -1 } }, { dauerS: 0.5 }],
        ziel: { art: "aenderung", groesse: "cabYaw", richtung: "beide", ab: 8 * GRAD }, // SW
      },
    ],
  },
  {
    id: "ausleger-stiel",
    name: { de: "HAUPTARM & STIEL", en: "BOOM & STICK" },
    beschreibung: {
      de: "Hauptarm heben und senken, Stiel aus- und einfahren, die Spinne genau hinstellen.",
      en: "Raise and lower the boom, move the stick out and in, place the grapple.",
    },
    ziel: { de: "Bring die Spinne über die Marke.", en: "Bring the grapple over the mark." },
    schritte: [
      {
        titel: { de: "Hauptarm heben", en: "Raise the boom" },
        text: { de: "{boom+}: Der Hauptarm geht hoch.", en: "{boom+}: the boom goes up." },
        zeige: { fn: "boom", richtung: "plus" },
        // SW: 1 s voll = 19° hoch (Start 35°, Grenze 70°), zurueck
        vorfuehrung: [{ dauerS: 1.0, achsen: { boom: 1 } }, { dauerS: 0.5 }, { dauerS: 1.0, achsen: { boom: -1 } }, { dauerS: 0.5 }],
        ziel: { art: "aenderung", groesse: "boom", richtung: "plus", ab: 10 * GRAD }, // SW
      },
      {
        /*
         * Senken nach dem Heben: Aus der Startpose (35°) sitzt die offene Spinne
         * schon nach 6,8° auf (28,2°, `katalog.ts` Aufgabe 1) — darum zeigt die
         * Vorfuehrung nur 13° und das Ziel verlangt 8°.
         */
        titel: { de: "Hauptarm senken", en: "Lower the boom" },
        text: { de: "{boom-}: Der Hauptarm geht runter.", en: "{boom-}: the boom comes down." },
        zeige: { fn: "boom", richtung: "minus" },
        vorfuehrung: [{ dauerS: 0.7, achsen: { boom: -1 } }, { dauerS: 0.5 }, { dauerS: 0.7, achsen: { boom: 1 } }, { dauerS: 0.5 }],
        ziel: { art: "aenderung", groesse: "boom", richtung: "minus", ab: 8 * GRAD }, // SW
      },
      {
        titel: { de: "Stiel ausfahren", en: "Stick out" },
        text: { de: "{stick+}: Der Stiel schiebt die Spinne nach vorn.", en: "{stick+}: the stick pushes the grapple out." },
        zeige: { fn: "stick", richtung: "plus" },
        // SW: 0,8 s voll = 19° (Start −70°, Grenze −25°), zurueck
        vorfuehrung: [{ dauerS: 0.8, achsen: { stick: 1 } }, { dauerS: 0.5 }, { dauerS: 0.8, achsen: { stick: -1 } }, { dauerS: 0.5 }],
        ziel: { art: "aenderung", groesse: "stick", richtung: "plus", ab: 10 * GRAD }, // SW
      },
      {
        titel: { de: "Stiel einfahren", en: "Stick in" },
        text: { de: "{stick-}: Der Stiel holt die Spinne heran.", en: "{stick-}: the stick pulls the grapple in." },
        zeige: { fn: "stick", richtung: "minus" },
        vorfuehrung: [{ dauerS: 0.8, achsen: { stick: -1 } }, { dauerS: 0.5 }, { dauerS: 0.8, achsen: { stick: 1 } }, { dauerS: 0.5 }],
        ziel: { art: "aenderung", groesse: "stick", richtung: "minus", ab: 10 * GRAD }, // SW
      },
      {
        /*
         * Die Marke liegt 1,2 m naeher am Bagger als die Spinne bei Beginn des
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
         * Waechter: `test/lehrgang.test.ts` „Bodenmarke frei im Bild".
         */
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
        // SW: halber Meter, gut die Haelfte der offenen Spinne; 30° s. o.
        ziel: { art: "marke", radialM: -1.2, schwenkRad: 30 * GRAD, radiusM: 0.5 },
      },
    ],
  },
];

/** Stelle einer Lektion im Lehrgang (ab 1), 0 = unbekannt. */
export function lektionNr(id: string): number {
  return LEKTIONS_PLAN.indexOf(id as (typeof LEKTIONS_PLAN)[number]) + 1;
}

/**
 * VORSCHLAG (E-196, noch nicht scharf): Die sechs Aufgaben werden Pruefungen
 * nach diesen Lektionen — freigeschaltet, wenn alle genannten geschafft sind.
 */
export const PRUEFUNG_NACH: Record<string, readonly (typeof LEKTIONS_PLAN)[number][]> = {
  "erster-griff": ["ausleger-stiel", "greifen-rotator", "absetzen-werfen"],
  verladen: ["presse"],
  sortieren: ["sortieren"],
  "platt-machen": ["haemmern-zudruecken"],
  magnet: ["magnet"],
  "schwere-last": ["pratzen-traglast"],
};
