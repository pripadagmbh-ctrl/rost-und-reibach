/**
 * SCHNITTREZEPTE (E-130, 16.10.2026) — was aus welcher Aufnahme ins Spiel geht.
 *
 * Gewaehlt nach Spektrogramm und Kennzahlen (`tonwerk.mjs analyse`), nicht
 * nach Gehoer: Am Arbeitsplatz ist kein Lautsprecher. Jede Zeitangabe ist
 * deshalb ein Startwert (SW) und wird am Geraet abgenommen.
 *
 * Felder: `art` "einmal" (Schlag, wird nach dem Abklingen abgeschnitten) oder
 * "schleife" (nahtlos, Ende ueber den Anfang geblendet). `schichten` werden
 * gemischt: `q` Rohdatei (relativ zu ton-roh/), `von`/`dauer` in s der
 * Rohdatei, `rate` Tempo (0,6 = tiefer und langsamer), `gain`, `versatz` in s,
 * `hp`/`tp` Hoch-/Tiefpass in Hz. `streu` verteilt kurze Schlaege zufaellig
 * (fester Samen) — so entstehen Rasseln und Kratzen aus Einzelschlaegen.
 */

/** 24 kHz: die Haelfte von 48 kHz (iOS-Tonkanal), reicht bis 12 kHz. */
export const ABTASTRATE = 24000;

export const QUELLEN = {
  A: {
    name: "Kenney, Impact Sounds (1.0)",
    url: "https://kenney.nl/assets/impact-sounds",
    lizenz: "CC0 1.0",
    lizenzUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
  I: {
    name: "OpenGameArt, 100 CC0 metal and wood SFX",
    url: "https://opengameart.org/content/100-cc0-metal-and-wood-sfx",
    lizenz: "CC0 1.0",
    lizenzUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
  B: { name: "BigSoundBank #2148 Excavator, use", url: "https://bigsoundbank.com/excavator-use-s2148.html", lizenz: "CC0 1.0", lizenzUrl: "https://creativecommons.org/publicdomain/zero/1.0/" },
  C: { name: "BigSoundBank #2147 Excavator, engine", url: "https://bigsoundbank.com/excavator-engine-s2147.html", lizenz: "CC0 1.0", lizenzUrl: "https://creativecommons.org/publicdomain/zero/1.0/" },
  D: { name: "BigSoundBank #0914 Excavator (Cranes of site)", url: "https://bigsoundbank.com/cranes-of-site-s0914.html", lizenz: "CC0 1.0", lizenzUrl: "https://creativecommons.org/publicdomain/zero/1.0/" },
  E: {
    name: "BigSoundBank #1771, #1776, #0235 (Stahlstangen fallen)",
    url: "https://bigsoundbank.com/falling-sheet-steel-bar-1-s1771.html · https://bigsoundbank.com/fall-2-sheet-steel-bars-1-s1776.html · https://bigsoundbank.com/iron-bar-falls-2-s0235.html",
    lizenz: "CC0 1.0",
    lizenzUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
  F: {
    name: "BigSoundBank #0118, #0148, #0771 (Dose zerdrückt, Glas birst, Scherben)",
    url: "https://bigsoundbank.com/can-that-are-crushed-s0118.html · https://bigsoundbank.com/glass-burst-s0148.html · https://bigsoundbank.com/broken-glass-s0771.html",
    lizenz: "CC0 1.0",
    lizenzUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
  H: {
    name: "Pixabay „Grua recicladora“ (Schrottplatz-Greifkran), Datei freesound_community-grua-recicladora-48744.mp3, von Patrick am 16.10.2026 selbst geladen. Original auf Freesound als CC0: Fhmediahmo #191965",
    url: "https://pixabay.com/sound-effects/film-special-effects-grua-recicladora-48744/",
    lizenz: "Pixabay Content License — Einbau ins Spiel erlaubt, Weitergabe der Datei für sich allein nicht",
    lizenzUrl: "https://pixabay.com/service/license-summary/",
  },
  // E-159: von Patrick am 18.10.2026 freigegeben, vom Orchestrator geladen
  S: {
    name: "BigSoundBank #2358, #2359, #2360 (Metal barrier: Closure #1–#3, grosse Metallschranke schlaegt zu) und #1774 (Falling sheet steel bar #4)",
    url: "https://bigsoundbank.com/grinding-metal-barrier-closure-1-s2358.html · https://bigsoundbank.com/grinding-metal-barrier-closure-2-s2359.html · https://bigsoundbank.com/grinding-metal-barrier-closure-3-s2360.html · https://bigsoundbank.com/falling-sheet-steel-bar-4-s1774.html",
    lizenz: "CC0 1.0",
    lizenzUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
  T: {
    name: "BigSoundBank #0971 Car door #1 (Peugeot 107, mehrere Schlaege) und #1524 Car door 3",
    url: "https://bigsoundbank.com/car-door-1-s0971.html · https://bigsoundbank.com/car-door-3-s1524.html",
    lizenz: "CC0 1.0",
    lizenzUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
  U: {
    name: "OpenGameArt, rubberduck: 75 CC0 breaking / falling / hit sfx",
    url: "https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx",
    lizenz: "CC0 1.0",
    lizenzUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
  // E-148: von Patrick am 17.10.2026 freigegeben, vom Orchestrator geladen
  J: { name: "BigSoundBank #2721 Truck Horn (LKW-Drucklufthupe)", url: "https://bigsoundbank.com/truck-horn-s2721.html", lizenz: "CC0 1.0", lizenzUrl: "https://creativecommons.org/publicdomain/zero/1.0/" },
  K: { name: "BigSoundBank #1269 Industrial Doorbell #1 (elektrische Werksklingel)", url: "https://bigsoundbank.com/industrial-doorbell-s1269.html", lizenz: "CC0 1.0", lizenzUrl: "https://creativecommons.org/publicdomain/zero/1.0/" },
  L: { name: "BigSoundBank #3260 National alert signal, end (Sirene, Entwarnung)", url: "https://bigsoundbank.com/national-alert-signal-end-s3260.html", lizenz: "CC0 1.0", lizenzUrl: "https://creativecommons.org/publicdomain/zero/1.0/" },
};

/** H: der echte Greifkran (Pixabay), relativ zu ton-roh/ */
const H = "H/freesound_community-grua-recicladora-48744.mp3";

const k = (n, mehr = {}) => ({ q: `A/x/Audio/${n}.ogg`, ...mehr });
const o = (n, mehr = {}) => ({ q: `I/x/${n}.ogg`, ...mehr });
/** U: OpenGameArt rubberduck „75 CC0 breaking / falling / hit sfx" (E-159) */
const u = (n, mehr = {}) => ({ q: `U/x/bfh1_${n}.ogg`, ...mehr });
/** Schlagstellen in T/0971 (Autotuer zugeschlagen, Spitzen bei 0,32 / 4,42 / 8,45 / 12,68 s) */
const TUER = [0.27, 4.37, 8.4, 12.63];

export const REZEPTE = [
  /* ------------------------------------------------------------ Greifen -- */
  {
    name: "hyd_fahrt",
    wofuer: "Schalen und Arm fahren: Öl strömt (Schleife)",
    art: "schleife",
    dauer: 2.5,
    abtastrate: 16000, // SW: Rauschen bis 8 kHz reicht, spart ein Drittel
    // D 63–66 s: ohne Schlaege, breites Rauschen; der Motor (unter 250 Hz) faellt raus
    schichten: [{ q: "D/0914.ogg", von: 63.0, dauer: 3.0, hp: 250 }],
    spitze: 0.7,
  },
  {
    name: "hyd_druck",
    wofuer: "Zudrücken: Greifkran-Hydraulik unter Last, höher mit der Kraft (Schleife)",
    art: "schleife",
    dauer: 2.5,
    abtastrate: 16000, // SW: der Kran bringt ueber 8 kHz nichts Wesentliches
    // H 13–16 s (E-130, H statt D 108 s): der Greifkran unter Last — breites
    // Anschwellen 300 Hz–3 kHz ohne Schlaege. Echte Greifer-Hydraulik statt
    // des Pumpen-Singens eines Baustellenkrans.
    schichten: [{ q: H, von: 13.0, dauer: 3.0, hp: 250 }],
    spitze: 0.7,
  },
  {
    name: "ventil",
    wofuer: "Druckbegrenzungsventil und Loslassen: Zischen (Schleife)",
    art: "schleife",
    dauer: 1.5,
    schichten: [{ q: "D/0914.ogg", von: 58.5, dauer: 2.0, hp: 2500 }],
    spitze: 0.7,
  },
  {
    name: "zupacken",
    wofuer: "Spinne packt zu: der Greifkran fasst Schrott",
    art: "einmal",
    // H 26,95–27,7 s (E-130, ersetzt Kenney-Schlag + Platte + D-Zischen): der
    // Kran packt Schrott — breiter Einsatz bis unter 100 Hz, Rauschen bis
    // 10 kHz, das ausklingt. Genau der Vorgang, den die Schichten nachbauten.
    schichten: [{ q: H, von: 26.95, dauer: 0.75, ein: 0.002, aus: 0.25 }],
  },
  {
    name: "anschlag_1",
    wofuer: "Zähne treffen leer aufeinander: Stahl auf Stahl",
    art: "einmal",
    // H 25,98–26,35 s (E-130, ersetzt OpenGameArt metal_hit_01): kurzer, heller
    // Klack des Krangreifers, dazu der alte Schlag leise fuer den Stahlglanz
    schichten: [{ q: H, von: 25.98, dauer: 0.37, ein: 0.002, aus: 0.15 }, o("metal_hit_01", { gain: 0.35 })],
  },
  {
    name: "anschlag_2",
    wofuer: "Zähne treffen leer aufeinander (zweite Fassung)",
    art: "einmal",
    // H 33,98–34,4 s (E-130, ersetzt OpenGameArt metal_hit_04): zweiter Klack des Krans
    schichten: [{ q: H, von: 33.98, dauer: 0.42, ein: 0.002, aus: 0.15 }, o("metal_hit_04", { gain: 0.35 })],
  },
  /*
   * Biss (E-159): keine Dose mehr (F #0118 klang nach „Coladose"). Das
   * Knirschen kommt aus dem echten Greifkran im Schrott (H 141–145 s, dieselbe
   * Strecke wie `rassel`), der Anschlag aus einem schweren Metallschlag (U).
   */
  {
    name: "biss_1",
    wofuer: "Zudrücken beißt ins Material: Knirschen",
    art: "einmal",
    schichten: [{ q: H, von: 141.6, dauer: 0.45, hp: 200, aus: 0.2 }, u("metal_hit_04", { gain: 0.6 })],
  },
  {
    name: "biss_2",
    wofuer: "Zudrücken beißt ins Material (zweite Fassung)",
    art: "einmal",
    schichten: [{ q: H, von: 142.7, dauer: 0.42, hp: 200, aus: 0.2 }, u("metal_hit_05", { gain: 0.6 })],
  },
  {
    name: "biss_3",
    wofuer: "Zudrücken beißt ins Material (dritte Fassung)",
    art: "einmal",
    schichten: [{ q: H, von: 143.8, dauer: 0.45, hp: 200, aus: 0.2 }, u("metal_hit_02", { gain: 0.5 })],
  },

  /* ----------------------------------------------------- Blech knautschen -- */
  /*
   * Knautschen (E-159, Befund 18.10.: „Autos fallen lassen, das muss wie blech
   * klingen und nicht wie eine Coladose" und an der Schere „wie ein lallender
   * Betrunkener"): Die Dose #0118 (tief gelegt) und das gleitende Stoehnen aus
   * H 61 s sind raus. Jetzt: ein echter Karosserieschlag (Autotuer T #0971),
   * darunter eine schwere Metallschranke (S), Blechschlaege (I) und das
   * Knirschen des Greifkrans im Schrott (H 141 s). Kein Ton gleitet.
   */
  {
    name: "knautsch_1",
    wofuer: "Blech wird zerdrückt (Presse, Auto fällt, Quetschen): Karosserie + Schranke + Blech + Knirschen",
    art: "einmal",
    dauer: 2.6,
    schichten: [
      { q: "T/0971.ogg", von: TUER[0], dauer: 0.7, aus: 0.3 },
      { q: "S/2360.ogg", von: 0.08, dauer: 2.2, gain: 0.55, versatz: 0.12, aus: 1.0 },
      o("metal_sheet_03", { gain: 0.6, versatz: 0.45 }),
      o("metal_sheet_05", { gain: 0.5, versatz: 1.0 }),
      { q: H, von: 141.5, dauer: 2.0, hp: 200, gain: 0.45, versatz: 0.2, ein: 0.05, aus: 0.6 },
    ],
  },
  {
    name: "knautsch_2",
    wofuer: "Blech wird zerdrückt (zweite Fassung)",
    art: "einmal",
    dauer: 2.2,
    schichten: [
      { q: "T/0971.ogg", von: TUER[1], dauer: 0.7, aus: 0.3 },
      { q: "S/2359.ogg", von: 0.93, dauer: 1.9, gain: 0.55, versatz: 0.1, aus: 0.9 },
      o("metal_sheet_06", { gain: 0.6, versatz: 0.5 }),
      { q: H, von: 143.0, dauer: 1.6, hp: 200, gain: 0.45, versatz: 0.15, ein: 0.05, aus: 0.5 },
    ],
  },
  { name: "glas_1", wofuer: "Scheibe birst", art: "einmal", schichten: [{ q: "F/0148.ogg", dauer: 1.6 }] },
  { name: "glas_2", wofuer: "Scheibe birst (Scherben)", art: "einmal", schichten: [{ q: "F/0771.ogg", von: 1.7, dauer: 0.9 }] },

  /* ---------------------------------------------- Aufprall nach Material -- */
  /*
   * Familien (E-159): Keine Aufnahme ist im Tonwerk schneller oder langsamer
   * gelegt (vorher Kupfer ×0,9, Stahl ×0,8, Kunststoff ×1,3) — jede klingt in
   * ihrer eigenen Tonhoehe.
   */
  { name: "stahl_1", wofuer: "Aufprall massiver Stahl", art: "einmal", schichten: [{ q: "E/1771.ogg" }, k("impactPlate_heavy_000", { gain: 0.5 })] },
  { name: "stahl_2", wofuer: "Aufprall massiver Stahl (2): schwerer Schlag", art: "einmal", schichten: [u("metal_hit_04"), u("metal_hit_05", { gain: 0.7 })] },
  { name: "stahl_3", wofuer: "Aufprall massiver Stahl (3)", art: "einmal", schichten: [{ q: "E/1776.ogg", dauer: 0.9, aus: 0.3 }, k("impactMetal_heavy_000", { gain: 0.5 })] },
  // S #1774: Stahlstange faellt — 0,8 s, danach klingt sie zu lang (wie eine Glocke)
  { name: "stahl_4", wofuer: "Aufprall massiver Stahl (4): Stahlstange", art: "einmal", schichten: [{ q: "S/1774.ogg", dauer: 0.8, aus: 0.3 }] },
  // Kleines Eisen (E-159): echte fallende Metallteile, mit Nachspringen — nicht Alu, nicht Blech
  { name: "kleineisen_1", wofuer: "Aufprall kleines Eisenteil", art: "einmal", schichten: [u("metal_falling_01")] },
  { name: "kleineisen_2", wofuer: "Aufprall kleines Eisenteil (2)", art: "einmal", schichten: [u("metal_falling_02")] },
  { name: "kleineisen_3", wofuer: "Aufprall kleines Eisenteil (3)", art: "einmal", schichten: [u("metal_hit_06")] },
  { name: "blech_1", wofuer: "Aufprall Blech, scheppert", art: "einmal", schichten: [o("metal_sheet_01")] },
  { name: "blech_2", wofuer: "Aufprall Blech (2)", art: "einmal", schichten: [o("metal_sheet_02")] },
  { name: "blech_3", wofuer: "Aufprall Blech (3)", art: "einmal", schichten: [o("metal_sheet_06")] },
  { name: "blech_4", wofuer: "Aufprall Blech (4)", art: "einmal", schichten: [o("metal_sheet_03")] },
  { name: "va_1", wofuer: "Aufprall Edelstahl, klingt lang", art: "einmal", schichten: [{ q: "E/1776.ogg", dauer: 1.4 }] },
  { name: "va_2", wofuer: "Aufprall Edelstahl (2)", art: "einmal", schichten: [{ q: "E/0235.ogg" }] },
  /*
   * Alu (E-159): hell und TROCKEN — kurze, klappernde Leichtmetallschlaege
   * (Abklingen 0,08–0,17 s, Schwerpunkt 5,5–6,6 kHz) ohne Nachklingen. Vorher
   * Kenney „impactMetal_light": ein heller, stehender Ton — das klang nach
   * Glöckchen und war das „kindliche".
   */
  { name: "alu_1", wofuer: "Aufprall Alu, hell und trocken", art: "einmal", schichten: [u("metal_falling_04")] },
  { name: "alu_2", wofuer: "Aufprall Alu (2)", art: "einmal", schichten: [u("metal_falling_05")] },
  { name: "alu_3", wofuer: "Aufprall Alu (3)", art: "einmal", schichten: [u("metal_hit_01")] },
  { name: "kupfer_1", wofuer: "Aufprall Kupfer/Messing/Zink, warm", art: "einmal", schichten: [k("impactMetal_medium_000")] },
  { name: "kupfer_2", wofuer: "Aufprall Kupfer (2)", art: "einmal", schichten: [k("impactMetal_medium_003")] },
  {
    name: "kabel_1",
    wofuer: "Aufprall Kabelbund: dumpf, raschelt",
    art: "einmal",
    schichten: [k("impactSoft_heavy_001"), k("footstep_snow_001", { gain: 0.8 }), k("impactGeneric_light_000", { gain: 0.5 })],
  },
  { name: "klotz_1", wofuer: "Aufprall Akku: Klotz ohne Klang", art: "einmal", schichten: [k("impactPunch_medium_002"), k("impactWood_light_000", { gain: 0.6 })] },
  { name: "holz_1", wofuer: "Aufprall Holz", art: "einmal", schichten: [k("impactWood_heavy_000"), o("wood_hit_03", { gain: 0.4 })] },
  { name: "holz_2", wofuer: "Aufprall Holz (2)", art: "einmal", schichten: [k("impactPlank_medium_001"), k("impactWood_light_002", { gain: 0.5 })] },
  { name: "reifen_1", wofuer: "Aufprall Reifen: weicher Plumps", art: "einmal", schichten: [k("impactSoft_heavy_002"), k("impactGeneric_light_002", { gain: 0.5 })] },
  { name: "kunststoff_1", wofuer: "Aufprall Kunststoff: hohles Klacken", art: "einmal", schichten: [k("impactGeneric_light_000")] },
  { name: "kunststoff_2", wofuer: "Aufprall Kunststoff (2)", art: "einmal", schichten: [k("impactWood_light_004")] },
  { name: "geroell_1", wofuer: "Aufprall Bauschutt", art: "einmal", schichten: [k("impactMining_000"), k("footstep_concrete_000", { gain: 0.8 })] },
  { name: "geroell_2", wofuer: "Aufprall Bauschutt (2)", art: "einmal", schichten: [k("impactMining_002"), k("footstep_concrete_003", { gain: 0.8 })] },

  /* ------------------------------------------ Koerper: Masse klingt mit (E-159) -- */
  // Hohler Blechkoerper (Karosserie, Tank, Fass): echte Autotuer, voller Schlag
  ...TUER.map((von, i) => ({
    name: `koerper_blech_${i + 1}`,
    wofuer: `Schwerer Blechkörper schlägt auf (Auto, Tank) (${i + 1})`,
    art: "einmal",
    schichten: [{ q: "T/0971.ogg", von, dauer: 0.75, aus: 0.35 }],
  })),
  // Schwerer Stahl auf Stahl: grosse Metallschranke, nur der Schlag (ohne das Quietschen davor)
  { name: "koerper_stahl_1", wofuer: "Schweres Metall auf Stahl: dröhnt nach", art: "einmal", schichten: [{ q: "S/2360.ogg", von: 0.08, dauer: 2.2, aus: 1.0 }] },
  { name: "koerper_stahl_2", wofuer: "Schweres Metall auf Stahl (2)", art: "einmal", schichten: [{ q: "S/2358.ogg", von: 1.68, dauer: 2.0, aus: 0.9 }] },
  { name: "koerper_stahl_3", wofuer: "Schweres Metall auf Stahl (3)", art: "einmal", schichten: [{ q: "S/2359.ogg", von: 0.93, dauer: 1.9, aus: 0.9 }] },

  /* ------------------------------------------------- Untergrund klingt mit -- */
  { name: "grund_beton", wofuer: "Untergrund Beton: trockener Klatsch", art: "einmal", schichten: [k("impactPunch_medium_000"), k("footstep_concrete_001", { gain: 0.9 })] },
  { name: "grund_stahl_1", wofuer: "Untergrund Ladefläche/Mulde: wummert", art: "einmal", schichten: [k("impactPlate_heavy_000")] },
  { name: "grund_stahl_2", wofuer: "Untergrund Ladefläche/Mulde (2)", art: "einmal", schichten: [k("impactPlate_heavy_004")] },
  { name: "grund_schrott_1", wofuer: "Untergrund Schrott: klappert", art: "einmal", schichten: [k("impactTin_medium_000")] },
  { name: "grund_schrott_2", wofuer: "Untergrund Schrott (2)", art: "einmal", schichten: [k("impactTin_medium_003")] },

  /* -------------------------------------------------- Kehren und Rasseln -- */
  {
    name: "kehr_beton",
    wofuer: "Spinne schleift über Beton: raues Schaben (Schleife)",
    art: "schleife",
    dauer: 2.0,
    streu: {
      quellen: [0, 1, 2, 3, 4].map((i) => k(`footstep_concrete_00${i}`)),
      anzahl: 95, // SW: ohne Luecke, sonst klingt es nach Schritten
      gain: [0.25, 0.7],
      rate: [0.9, 1.4],
      samen: 11,
    },
    hp: 300,
  },
  {
    name: "kehr_stahl",
    wofuer: "Spinne schleift über Ladefläche/Mulde: Kreischen (Schleife)",
    art: "schleife",
    dauer: 2.0,
    // D 9,6–12,1 s: gleitendes Quietschen um 1–1,5 kHz und 3–5 kHz.
    // E-153: ohne die 14 darueber gestreuten Kenney-Schlaege — nur die Aufnahme.
    schichten: [{ q: "D/0914.ogg", von: 9.6, dauer: 2.5, hp: 700 }],
    spitze: 0.7,
  },
  {
    name: "rassel",
    wofuer: "Schrott rutscht und klappert; Spinne über Schrott (Schleife)",
    art: "schleife",
    dauer: 2.0,
    // E-153: H 141,5–144 s statt 48 gestreuter Kenney-Dosenschlaege. Der echte
    // Greifkran im Schrott: dichtes Klappern und Knirschen bis 10 kHz,
    // Schwerpunkt 2,1 kHz, keine Einzelschlaege, die als Muster auffallen.
    // Das Brummen des Krans (unter 200 Hz) faellt raus.
    schichten: [{ q: H, von: 141.5, dauer: 2.5, hp: 200 }],
    spitze: 0.8,
  },

  /* ------------------------------------------------- Signale (E-148) -- */
  {
    name: "hupe",
    wofuer: "LKW-Drucklufthupe: der Fahrer hupt (im Spiel einmal oder doppelt)",
    art: "einmal",
    dauer: 1.3,
    abtastrate: 16000, // SW: Schwerpunkt 1,2 kHz, ueber 8 kHz nur Rauschen
    // J 0–1,3 s: der ganze Stoss, 0,4 s voll, dann der Hall ueber den Platz
    schichten: [{ q: "J/2721.ogg", von: 0, dauer: 1.3, aus: 0.3 }],
  },
  {
    name: "klingel",
    wofuer: "Elektrische Werksklingel: Feierabend (Alternative zur Sirene)",
    art: "einmal",
    dauer: 2.2,
    abtastrate: 16000, // SW: Groessenbudget (2 MB); klingt etwas dumpfer als roh
    // K 0–2,2 s: 1,2 s Klingeln, dann das Ausschwingen der Glocke
    schichten: [{ q: "K/1269.ogg", von: 0, dauer: 2.2, aus: 0.5 }],
  },
  {
    name: "sirene",
    wofuer: "Werkssirene: Feierabend — läuft hoch, steht kurz, läuft aus",
    art: "einmal",
    dauer: 4.9,
    abtastrate: 12000, // SW: Grundton um 340 Hz, Obertoene bis 6 kHz genuegen
    schichten: [
      // L 0–3,2 s: Hochlauf, bei 3 s steht der Ton
      { q: "L/3260.ogg", von: 0, dauer: 3.2, ein: 0.01, aus: 0.3 },
      // L ab 33,9 s: hier beginnt der Auslauf (der Ton sinkt), uebergeblendet
      // und in 1,6 s ausgeblendet — kein stehender Ton
      { q: "L/3260.ogg", von: 33.9, dauer: 2.0, versatz: 2.9, ein: 0.3, aus: 1.6 },
    ],
  },

  /* ------------------------------------------------------------- Motor -- */
  {
    name: "motor",
    wofuer: "Dieselmotor im Stand (Schleife), Tempo folgt der Bedienung",
    art: "schleife",
    dauer: 3.0,
    abtastrate: 12000, // SW: ein Diesel hat ueber 6 kHz nichts zu sagen
    schichten: [{ q: "C/2147.ogg", von: 12.0, dauer: 3.5 }],
    spitze: 0.7,
  },
];
