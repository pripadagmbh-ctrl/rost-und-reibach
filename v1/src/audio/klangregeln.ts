/**
 * KLANGREGELN (E-121, 06.10.2026) — was wie klingt, ohne WebAudio.
 *
 * Alles hier ist reine Rechnung: Aus einem Ereignis (Material, Masse, Wucht,
 * Untergrund) wird ein Rezept (Teiltoene, Abklingzeiten, Pegel). Gespielt wird
 * es in `audioManager.ts`. Getrennt, damit die Waechter pruefen koennen, dass
 * haerter auch lauter heisst, ohne einen Lautsprecher zu brauchen.
 *
 * AUFNAHMEN (E-130, 16.10.2026): Seit Patricks Befund „beim greifen eher ein
 * summen" klingt alles hier aus echten Aufnahmen (`public/ton/`, Herkunft in
 * `public/ton/QUELLEN.md`, Schnitt in `tools/tonwerk/rezepte.mjs`). Die
 * Teiltoene unten bleiben als Ersatz, solange die Dateien laden oder fehlen.
 * Welche Aufnahme zu welcher Familie gehoert, steht in `proben`.
 *
 * KLEINE LAUTSPRECHER: Ein iPhone-mini-Lautsprecher gibt unter etwa 300 Hz
 * praktisch nichts wieder, ein iPad unter etwa 150 Hz. Ein Stahlschlag, der
 * nur aus 90 Hz besteht, ist dort stumm. Deshalb hat jedes Rezept unten
 * Teiltoene zwischen 300 Hz und 3 kHz — der tiefe Grundton liefert den
 * Druck im Kopfhoerer, die Mitten tragen den Klang ueber das Geraet.
 */

/** Worauf ein Teil faellt oder worueber die Spinne schleift. */
export type Untergrund = "beton" | "stahl" | "schrott";

/** Ein Metallschlag als Rezept. */
export interface Schlag {
  /** Teiltonfrequenzen (Hz), bewusst nicht ganzzahlig zueinander */
  teiltoene: number[];
  /** Abklingzeit je Teilton (s) */
  abkling: number[];
  /** Grundlautstaerke vor dem Pegel */
  laut: number;
  /** Grenzfrequenz des Anriss-Rauschens (Hz) */
  anriss: number;
  /** Lautstaerke des Anrisses */
  anrissLaut: number;
  /** Streuung der Tonhoehe je Anschlag (Anteil) */
  streu: number;
  /** Nachschlaege fuer Scheppern: so oft klappert es kurz hinterher */
  scheppern: number;
  /** Rascheln (Kabel, Geroell): Grenzfrequenz, 0 = keins */
  rascheln: number;
  /** Aufnahmen dieser Familie (Dateiname ohne .wav in public/ton/), zufaellig gewaehlt (E-130) */
  proben: string[];
}

/*
 * KLANGFAMILIEN. Alle Werte SW (Startwerte zum Austesten am Geraet), die
 * Teiltoene sind aus den bisherigen `playDrop`-Klaengen abgeleitet und nach
 * Patricks Vorgabe (06.10.2026) sortiert: „Stahl dumpf-schwer, Blech
 * scheppernd, Kupfer und Alu heller".
 */
const FAMILIEN: Record<string, Schlag> = {
  // Massiver Stahl: tief, kurz, schwer. Die drei oberen Teiltoene tragen ihn
  // ueber kleine Lautsprecher.
  stahl: {
    teiltoene: [92, 151, 233, 347, 512, 760],
    abkling: [0.3, 0.26, 0.22, 0.18, 0.13, 0.09],
    laut: 0.3,
    anriss: 900,
    anrissLaut: 0.34,
    streu: 0.06,
    scheppern: 0,
    rascheln: 0,
    proben: ["stahl_1", "stahl_2", "stahl_3"],
  },
  // Blech: viele hohe Teiltoene, und es klappert zweimal nach.
  blech: {
    teiltoene: [310, 467, 689, 1013, 1490, 2190, 3170],
    abkling: [0.22, 0.2, 0.17, 0.14, 0.11, 0.08, 0.06],
    laut: 0.22,
    anriss: 3000,
    anrissLaut: 0.26,
    streu: 0.08,
    scheppern: 2,
    rascheln: 0,
    proben: ["blech_1", "blech_2", "blech_3"],
  },
  // Edelstahl: klar und lange nachklingend — aber kuerzer als der alte
  // Abwurfklang (1,25 s), sonst singt ein Haufen.
  va: {
    teiltoene: [392, 611, 913, 1327, 1904],
    abkling: [0.6, 0.5, 0.4, 0.3, 0.2],
    laut: 0.2,
    anriss: 3400,
    anrissLaut: 0.2,
    streu: 0.03,
    scheppern: 0,
    rascheln: 0,
    proben: ["va_1", "va_2"],
  },
  // Alu: leicht, hell, kurz, ein Nachklappern.
  alu: {
    teiltoene: [587, 905, 1340, 1890, 2650],
    abkling: [0.16, 0.13, 0.1, 0.08, 0.06],
    laut: 0.2,
    anriss: 4200,
    anrissLaut: 0.22,
    streu: 0.05,
    scheppern: 1,
    rascheln: 0,
    proben: ["alu_1", "alu_2"],
  },
  // Kupfer: hell, aber warm, mit tragendem Nachklang.
  kupfer: {
    teiltoene: [450, 702, 1046, 1520, 2210],
    abkling: [0.42, 0.34, 0.26, 0.18, 0.12],
    laut: 0.2,
    anriss: 2400,
    anrissLaut: 0.18,
    streu: 0.04,
    scheppern: 0,
    rascheln: 0,
    proben: ["kupfer_1", "kupfer_2"],
  },
  // Kabelbund: dumpf, mit Rascheln.
  kabel: {
    teiltoene: [132, 189, 420],
    abkling: [0.12, 0.1, 0.06],
    laut: 0.16,
    anriss: 900,
    anrissLaut: 0.26,
    streu: 0.09,
    scheppern: 0,
    rascheln: 1600,
    proben: ["kabel_1"],
  },
  // Akku, Kunststoffgehaeuse mit Blei: ein Klotz ohne Klang.
  klotz: {
    teiltoene: [120, 260, 410],
    abkling: [0.08, 0.06, 0.05],
    laut: 0.18,
    anriss: 600,
    anrissLaut: 0.32,
    streu: 0.05,
    scheppern: 0,
    rascheln: 0,
    proben: ["klotz_1"],
  },
  // Holz: kurzes Klopfen.
  holz: {
    teiltoene: [340, 610, 980],
    abkling: [0.07, 0.05, 0.04],
    laut: 0.2,
    anriss: 1800,
    anrissLaut: 0.25,
    streu: 0.06,
    scheppern: 0,
    rascheln: 0,
    proben: ["holz_1", "holz_2"],
  },
  // Reifen: tiefer, weicher Plumps; der obere Teilton traegt ihn ueber kleine Lautsprecher.
  reifen: {
    teiltoene: [70, 140, 480],
    abkling: [0.18, 0.12, 0.06],
    laut: 0.22,
    anriss: 400,
    anrissLaut: 0.3,
    streu: 0.05,
    scheppern: 0,
    rascheln: 0,
    proben: ["reifen_1"],
  },
  // Kunststoff: hohles Klacken.
  kunststoff: {
    teiltoene: [520, 880, 1460],
    abkling: [0.05, 0.04, 0.03],
    laut: 0.14,
    anriss: 2600,
    anrissLaut: 0.2,
    streu: 0.06,
    scheppern: 0,
    rascheln: 0,
    proben: ["kunststoff_1", "kunststoff_2"],
  },
  // Bauschutt: Brocken und Geroell, kaum Ton.
  geroell: {
    teiltoene: [150, 300, 520],
    abkling: [0.06, 0.04, 0.03],
    laut: 0.12,
    anriss: 1200,
    anrissLaut: 0.3,
    streu: 0.1,
    scheppern: 0,
    rascheln: 2200,
    proben: ["geroell_1", "geroell_2"],
  },
};

/** Stahl unter dieser Masse klingt als Blech. SW: 40 kg (Tuer, Haube, Fass). */
const BLECH_BIS_KG = 40;

/** Welche Klangfamilie ein Material hat. Unbekanntes klingt als Blech. */
export function familieVon(materialId: string, massKg: number, blech: boolean): string {
  switch (materialId) {
    case "steel":
      return blech || massKg < BLECH_BIS_KG ? "blech" : "stahl";
    case "mixed":
      return "blech";
    case "va":
      return "va";
    case "alu":
      return "alu";
    case "copper":
    case "brass":
    case "zinc":
      return "kupfer";
    case "cable":
      return "kabel";
    case "battery":
      return "klotz";
    case "wood":
      return "holz";
    case "tires":
      return "reifen";
    case "plastic":
      return "kunststoff";
    case "rubble":
      return "geroell";
    default:
      return "blech";
  }
}

/** Messing klingt heller als Kupfer, Zink dumpfer. Faktor auf alle Teiltoene. */
const TONHOEHE: Record<string, number> = { brass: 1.15, zinc: 0.85 };

/**
 * Unter dieser Wucht (m/s Tempoverlust) gibt es keinen eigenen Schlag, nur
 * Rasseln. Der Melder in `scrapItems.ts` meldet ab 1,1 m/s; das Zittern im
 * Haufen liegt knapp darueber. SW: 1,5 m/s.
 */
export const SCHLAG_AB_MS = 1.5;

/**
 * Pegel 0..1 eines Aufpralls aus Wucht und Masse.
 *
 * Wucht: ab der Schwelle linear bis 7 m/s (freier Fall aus 2,5 m), danach
 * voll. Masse: logarithmisch, 1 kg leise, 1 t voll — ein Zentner klingt nicht
 * hundertmal lauter als ein Kilo, sondern spuerbar lauter. Beides SW.
 */
export function aufprallPegel(wucht: number, massKg: number): number {
  const w = Math.min(1, Math.max(0, (wucht - 1.0) / 6));
  const m = Math.min(1, Math.max(0.35, 0.45 + 0.2 * Math.log10(Math.max(massKg, 0.1) / 10)));
  return Math.pow(w, 0.7) * m;
}

/** Ein fertiges Aufprall-Rezept: das Teil selbst plus der Untergrund. */
export interface AufprallRezept {
  pegel: number;
  /** Abspieltempo der Aufnahme: groesser = tiefer (E-130), Messing heller, Zink dumpfer */
  rate: number;
  /** Anteil der Aufnahme, der ausklingen darf: Beton daempft (E-130) */
  daempf: number;
  teil: Schlag;
  grund: Schlag;
}

/*
 * DER UNTERGRUND klingt mit (SW):
 *  - Beton: ein trockener Klatsch, kein Ton — und das Teil klingt kuerzer,
 *    weil der Boden es daempft.
 *  - Stahl (Ladeflaeche, Mulde): die Platte wummert mit, tief und lang.
 *  - Schrott: ein zweites, kurzes Blechklappern — das Teil, auf das es faellt.
 */
const GRUND: Record<Untergrund, Schlag> = {
  beton: {
    teiltoene: [180, 410],
    abkling: [0.05, 0.03],
    laut: 0.1,
    anriss: 500,
    anrissLaut: 0.3,
    streu: 0.1,
    scheppern: 0,
    rascheln: 0,
    proben: ["grund_beton"],
  },
  stahl: {
    teiltoene: [143, 231, 368, 590, 870],
    abkling: [0.5, 0.42, 0.32, 0.22, 0.14],
    laut: 0.18,
    anriss: 1200,
    anrissLaut: 0.12,
    streu: 0.03,
    scheppern: 0,
    rascheln: 0,
    proben: ["grund_stahl_1", "grund_stahl_2"],
  },
  schrott: {
    teiltoene: [270, 430, 655, 980, 1460],
    abkling: [0.12, 0.1, 0.08, 0.06, 0.05],
    laut: 0.1,
    anriss: 2200,
    anrissLaut: 0.12,
    streu: 0.12,
    scheppern: 1,
    rascheln: 0,
    proben: ["grund_schrott_1", "grund_schrott_2"],
  },
};

/** Beton daempft das Nachklingen. SW: auf 80 %. */
const BETON_DAEMPFT = 0.8;

/**
 * Das Rezept eines Aufpralls — oder `null`, wenn er zu schwach fuer einen
 * eigenen Schlag ist (dann geht er ins Rasselbett).
 */
export function aufprallKlang(e: {
  materialId: string;
  massKg: number;
  wucht: number;
  blech: boolean;
  untergrund: Untergrund;
}): AufprallRezept | null {
  if (!(e.wucht >= SCHLAG_AB_MS)) return null;
  const pegel = aufprallPegel(e.wucht, e.massKg);
  const fam = FAMILIEN[familieVon(e.materialId, e.massKg, e.blech)]!;
  // Groesser klingt tiefer: 80 kg ist die Mitte, gedeckelt auf ±30 %.
  const hoehe =
    (TONHOEHE[e.materialId] ?? 1) *
    Math.min(1.3, Math.max(0.7, Math.pow(80 / Math.max(e.massKg, 1), 0.12)));
  const daempf = e.untergrund === "beton" ? BETON_DAEMPFT : 1;
  return {
    pegel,
    rate: hoehe,
    daempf,
    teil: {
      ...fam,
      teiltoene: fam.teiltoene.map((f) => f * hoehe),
      abkling: fam.abkling.map((d) => d * daempf),
    },
    grund: GRUND[e.untergrund],
  };
}

/** Wie lange ein Schlag klingt (s) — fuer die Stimmenzaehlung. */
export function dauerVon(s: Schlag): number {
  return Math.max(...s.abkling) + 0.05 * s.scheppern + 0.05;
}

/* ------------------------------------------------------------- Greifen -- */

/** Volle Schliesskraft der Spinne (kN) — `Excavator.MAX_SCHLIESSKRAFT_KN`. */
export const VOLLE_KRAFT_KN = 49.05;

/**
 * Lautstaerke des Bisses (`greifer:zugedrueckt`). Waechst mit der Kraft und
 * hat einen Boden: Auch ein leichter Biss ist zu hoeren. SW.
 */
export function bissPegel(kraftKN: number): number {
  const k = Math.min(1, Math.max(0, kraftKN / VOLLE_KRAFT_KN));
  return 0.15 + 0.85 * k;
}

/**
 * Der Druckaufbau beim Zudruecken, je Kraftanteil 0..1: lauter, hoeher und
 * heller, je haerter. Ab 85 % zischt das Druckbegrenzungsventil — das hoert
 * man an jeder echten Maschine, wenn der Zylinder am Ende ist. SW.
 *
 * Seit E-130 auf einer Aufnahme (Pumpe unter Last, `hyd_druck`): `rate` ist
 * das Abspieltempo (hoeher = die Pumpe singt hoeher), `filterHz` ein Tiefpass
 * (leicht gedrueckt klingt dumpf, voll offen). Vorher zwei Saegezaehne —
 * genau die klangen fuer Patrick nach Summen.
 */
export function stoehnen(k01: number): { laut: number; rate: number; filterHz: number; zischen: number } {
  const k = Math.min(1, Math.max(0, k01));
  return {
    laut: 0.22 * Math.pow(k, 0.8), // SW: Aufnahme auf −3 dBFS geschnitten, darum hoeher als die alte 0,1
    rate: 0.8 + 0.4 * k, // SW
    filterHz: 900 + 5000 * k, // SW
    zischen: k > 0.85 ? 0.1 * ((k - 0.85) / 0.15) : 0,
  };
}

/**
 * KEIN GREIFKLANG BLEIBT STEHEN (E-130, Geraetebefund Patrick 16.10.2026:
 * „beim greifen ein durchgängiger ton …, der sollte nie durchgängig sein wie in
 * einem ufo oder spaceship wo der ton unendlich langgezogen wird").
 *
 * Bis E-130 hing der Druckklang am WERT der Schliesskraft — wer zuhielt, hoerte
 * ihn endlos. Echte Hydraulik klingt nur, wenn sich etwas aendert: Der Druck
 * baut auf, das Ventil spricht an. Haelt das Ventil, ist sie still.
 *
 * Darum haengt der Klang hier an der AENDERUNG der Kraft: Steigt sie, schwillt
 * die Huelle an (voll bei `ANSTIEG_VOLL` je Sekunde); steht sie, faellt die
 * Huelle mit `ABKLING_S`. Das Ventil zischt einmal, wenn die Kraft ueber 85 %
 * steigt, und klingt mit `VENTIL_ABKLING_S` aus; erneut erst, wenn sie unter
 * 80 % war. SW alle drei: 2/s (volle Kraft in einer halben Sekunde), 0,15 s
 * (nach 0,7 s unter 1 %), 0,3 s.
 */
export const ANSTIEG_VOLL = 2;
export const ABKLING_S = 0.15;
export const VENTIL_ABKLING_S = 0.3;

export class Druckaufbau {
  private kraftAlt = 0;
  private tAlt = -1;
  private huelle = 0;
  private ventil = 0;
  private ventilScharf = true;

  /** Ein Bild: Zeit `t` (s) und Kraftanteil 0..1. Liefert Pegel von Druck und Ventil. */
  schritt(t: number, kraft01: number): { laut: number; rate: number; filterHz: number; zischen: number } {
    const k = Math.min(1, Math.max(0, kraft01));
    const dt = this.tAlt < 0 ? 0 : Math.min(0.1, Math.max(0, t - this.tAlt));
    const s = stoehnen(k);
    if (dt > 0) {
      const ziel = Math.min(1, Math.max(0, k - this.kraftAlt) / dt / ANSTIEG_VOLL);
      this.huelle = Math.max(ziel, this.huelle * Math.exp(-dt / ABKLING_S));
      this.ventil *= Math.exp(-dt / VENTIL_ABKLING_S);
    }
    if (k > 0.85 && this.ventilScharf && k > this.kraftAlt) {
      this.ventil = 1;
      this.ventilScharf = false;
    }
    if (k < 0.8) this.ventilScharf = true;
    this.kraftAlt = k;
    this.tAlt = t;
    return { laut: 0.22 * this.huelle * (0.4 + 0.6 * k), rate: s.rate, filterHz: s.filterHz, zischen: 0.1 * this.ventil };
  }
}

/**
 * Schalen und Arm in Bewegung: Oel stroemt (`hyd_fahrt`). `schalen` 0..1 ist
 * das Schalentempo, `arm` 0..1 die Achsbewegung des Baggers — wer nur den Arm
 * bewegt, hoert die Hydraulik leiser als beim Greifen. Eine Quelle fuer beides,
 * damit nicht zwei Kopien derselben Aufnahme gegeneinander schweben. SW.
 */
export function oelFluss(schalen: number, arm: number): { laut: number; rate: number } {
  // Unter 3 % ist es Messrauschen, keine Bewegung — sonst haenge ein Hauch Oel
  // am Zuhalten (E-130). SW.
  const s = schalen < 0.03 ? 0 : Math.min(1, schalen);
  const a = arm < 0.03 ? 0 : Math.min(1, arm * 1.6);
  return { laut: Math.max(0.14 * s, 0.06 * a), rate: 0.9 + 0.25 * Math.max(s, a) };
}

/* ---------------------------------------------------- Knautschen (E-130) -- */

/**
 * Das Wrack knautscht (`wrack:geknautscht`). `zuwachs` ist, um wie viel der
 * mittlere Knautschgrad gestiegen ist: ein voller Biss etwa 0,17, die Presse
 * bis 1. Groesser heisst lauter, laenger, tiefer und dichter — die Presse
 * faltet das ganze Auto hoerbar auf einmal, ein Biss knirscht kurz. SW.
 */
export function knautschKlang(zuwachs: number): { pegel: number; dauer: number; rate: number; schlaege: number } {
  const z = Math.min(1, Math.max(0, zuwachs));
  return {
    pegel: 0.35 + 0.65 * Math.sqrt(z),
    dauer: 0.6 + 2.4 * z,
    rate: 1.1 - 0.25 * z,
    schlaege: Math.round(4 * z),
  };
}

/* ----------------------------------------------- Aufnahmen-Liste (E-130) -- */

/** Dauerklaenge: je eine Schleife aus `public/ton/`. */
export const SCHLEIFEN = {
  fahrt: "hyd_fahrt",
  druck: "hyd_druck",
  ventil: "ventil",
  kehrBeton: "kehr_beton",
  kehrStahl: "kehr_stahl",
  rassel: "rassel",
  motor: "motor",
} as const;

/** Einzelklaenge: mehrere Fassungen, zufaellig gewaehlt. */
export const EINZEL = {
  zupacken: ["zupacken"],
  anschlag: ["anschlag_1", "anschlag_2"],
  biss: ["biss_1", "biss_2", "biss_3"],
  knautsch: ["knautsch_1", "knautsch_2"],
  glas: ["glas_1", "glas_2"],
} as const;

/** Alle Aufnahmen, die das Spiel laedt — Familien, Untergruende, Schleifen, Einzelklaenge. */
export function alleProben(): string[] {
  const alle = [
    ...Object.values(FAMILIEN).flatMap((f) => f.proben),
    ...Object.values(GRUND).flatMap((g) => g.proben),
    ...Object.values(SCHLEIFEN),
    ...Object.values(EINZEL).flat(),
  ];
  return [...new Set(alle)];
}

/* -------------------------------------------------------------- Kehren -- */

/**
 * Das Schleifen der Spinne, je Tempo 0..1 und Untergrund. Jeder Untergrund hat
 * seinen eigenen Klangweg im Manager; hier steht nur, wie laut und wie hell.
 * Schneller = lauter, heller und dichter. SW.
 */
export function kehrKlang(tempo01: number, grund: Untergrund): { laut: number; hz: number; rate: number } {
  const t = Math.min(1, Math.max(0, tempo01));
  switch (grund) {
    case "beton":
      // raues Schaben: breites Band, dichte Koernung
      return { laut: 0.16 * t, hz: 800 + 700 * t, rate: 0.7 + 0.9 * t };
    case "stahl":
      // Kreischen: enges, hohes Band, wandert mit dem Tempo
      return { laut: 0.09 * t, hz: 2100 + 900 * t, rate: 1 };
    case "schrott":
      // Klappern und Rutschen: lose Schlaege, lauter je schneller
      return { laut: 0.2 * t, hz: 1300 + 500 * t, rate: 0.6 + 1.0 * t };
  }
}

/* ------------------------------------------------------ Stimmenbudget -- */

/**
 * WIE VIEL GLEICHZEITIG KLINGEN DARF (tonkonzept.md R2).
 *
 * Zwei Grenzen:
 *  1. Hoechstens `stimmen` Schlaege klingen gleichzeitig.
 *  2. Ein Kontingent von `jeSekunde` Schlaegen je Sekunde (bis `vorrat` auf
 *     einmal). Laute Schlaege (Pegel ≥ `lautAb`) duerfen das Kontingent
 *     ueberziehen, bis `vorrat` ins Minus — das grosse Teil, das auf die
 *     Ladeflaeche knallt, darf nicht deshalb stumm bleiben, weil vorher ein
 *     Haufen geklappert hat. Auf Dauer bleibt es trotzdem bei `jeSekunde`.
 *
 * Was abgewiesen wird, geht nicht verloren: Der Manager gibt es ans
 * Rasselbett weiter. So klingt ein rutschender Haufen nach Geroell, nicht
 * nach Maschinengewehr.
 */
export class Stimmenbudget {
  private enden: number[] = [];
  private vorratJetzt: number;
  private zuletzt = 0;

  constructor(
    readonly stimmen = 6, // SW
    readonly jeSekunde = 4, // tonkonzept.md R2: „drei bis vier Schlaege je Sekunde"
    readonly vorrat = 4, // SW
    readonly lautAb = 0.6 // SW
  ) {
    this.vorratJetzt = vorrat;
  }

  /** Darf jetzt (Zeit `t` in s) ein Schlag von `dauer` s mit `pegel` klingen? */
  darf(t: number, dauer: number, pegel: number): boolean {
    this.vorratJetzt = Math.min(this.vorrat, this.vorratJetzt + (t - this.zuletzt) * this.jeSekunde);
    this.zuletzt = t;
    this.enden = this.enden.filter((e) => e > t);
    if (this.enden.length >= this.stimmen) return false;
    const boden = pegel >= this.lautAb ? 1 - this.vorrat : 1;
    if (this.vorratJetzt < boden) return false;
    this.vorratJetzt -= 1;
    this.enden.push(t + dauer);
    return true;
  }

  /** Gerade klingende Schlaege (fuer Messung und Waechter). */
  aktiv(t: number): number {
    return this.enden.filter((e) => e > t).length;
  }
}

/**
 * Das Rasselbett: eine Energie, die mit jedem abgewiesenen Schlag steigt und
 * mit `tau` abklingt. Gedeckelt — ein Haufen in Bewegung rasselt, er rauscht
 * nicht zu. SW: tau 0,35 s, Deckel 1.
 */
export class Rasselbett {
  private e = 0;
  private t = 0;
  constructor(readonly tau = 0.35, readonly deckel = 1) {}

  /** Energie zum Zeitpunkt t (s), nach Abklingen. */
  stand(t: number): number {
    return this.e * Math.exp(-Math.max(0, t - this.t) / this.tau);
  }

  /** Energie hinzufuegen; liefert den neuen, gedeckelten Stand. */
  dazu(t: number, menge: number): number {
    this.e = Math.min(this.deckel, this.stand(t) + menge);
    this.t = t;
    return this.e;
  }
}
