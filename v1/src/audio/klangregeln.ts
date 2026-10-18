/**
 * KLANGREGELN (E-121, 06.10.2026) — was wie klingt, ohne WebAudio.
 *
 * Alles hier ist reine Rechnung: Aus einem Ereignis (Material, Masse, Wucht,
 * Untergrund) wird ein Rezept (Aufnahmen, Tempo, Pegel, Dauer). Gespielt wird
 * es in `audioManager.ts`. Getrennt, damit die Waechter pruefen koennen, dass
 * haerter auch lauter heisst, ohne einen Lautsprecher zu brauchen.
 *
 * AUFNAHMEN (E-130, 16.10.2026): Seit Patricks Befund „beim greifen eher ein
 * summen" klingt alles hier aus echten Aufnahmen (`public/ton/`, Herkunft in
 * `public/ton/QUELLEN.md`, Schnitt in `tools/tonwerk/rezepte.mjs`). Welche
 * Aufnahme zu welcher Familie gehoert, steht in `proben`. Seit E-153 gibt es
 * keine gerechneten Teiltoene mehr, auch nicht als Ersatz beim Laden.
 *
 * KLEINE LAUTSPRECHER: Ein iPhone-mini-Lautsprecher gibt unter etwa 300 Hz
 * praktisch nichts wieder. Der Waechter in `test/tonaufnahmen.test.ts` misst
 * deshalb an jeder Aufnahme selbst, dass genug davon ueber 300 Hz liegt.
 */

/**
 * TONHOEHE (E-159, Befund Patrick 18.10.: „kindlich", „lallend"): Jede
 * Aufnahme spielt in ihrem eigenen Tempo, gestreut um hoechstens ±4 % je
 * Anschlag — damit kein Schlag wie der vorige klingt. Kein Klang wird nach
 * Masse oder Kraft hoeher oder tiefer gezogen, und kein Tempo gleitet. Groesse
 * und Kraft wirken ueber Pegel, Filter, Dauer und Aufnahmewahl.
 */
export const TEMPO_STREU = 0.04;

/** Worauf ein Teil faellt oder worueber die Spinne schleift. */
export type Untergrund = "beton" | "stahl" | "schrott";

/** Eine Klangfamilie: welche Aufnahmen, wie laut, wie lange (E-153: ohne Teiltoene). */
export interface Schlag {
  /** Grundlautstaerke vor dem Pegel */
  laut: number;
  /** Wie lange ein Schlag klingt (s) — fuer die Stimmenzaehlung. Aus den alten Abklingzeiten uebernommen. */
  dauer: number;
  /** Aufnahmen dieser Familie (Dateiname ohne Endung in public/ton/, s. `dateiVon`), zufaellig gewaehlt (E-130) */
  proben: string[];
}

/*
 * KLANGFAMILIEN. Alle Werte SW (Startwerte zum Austesten am Geraet), nach
 * Patricks Vorgabe (06.10.2026) sortiert: „Stahl dumpf-schwer, Blech
 * scheppernd, Kupfer und Alu heller".
 */
export const FAMILIEN: Record<string, Schlag> = {
  // Massiver Stahl: tief, kurz, schwer.
  stahl: {
    laut: 0.3,
    dauer: 0.35,
    proben: ["stahl_1", "stahl_2", "stahl_3", "stahl_4"],
  },
  // Kleines Eisen (E-159): Eisenteile unter 40 kg — echte fallende Metallteile
  // mit Nachspringen. Vorher klangen sie als Blech, hoeher gezogen: „wie Alu".
  kleineisen: {
    laut: 0.25,
    dauer: 0.5,
    proben: ["kleineisen_1", "kleineisen_2", "kleineisen_3"],
  },
  // Blech: hell, es scheppert.
  blech: {
    laut: 0.22,
    dauer: 0.37,
    proben: ["blech_1", "blech_2", "blech_3", "blech_4"],
  },
  // Edelstahl: klar und lange nachklingend — aber kuerzer als der alte
  // Abwurfklang (1,25 s), sonst singt ein Haufen.
  va: {
    laut: 0.2,
    dauer: 0.65,
    proben: ["va_1", "va_2"],
  },
  // Alu: leicht, hell, kurz, ein Nachklappern.
  alu: {
    laut: 0.2,
    dauer: 0.26,
    proben: ["alu_1", "alu_2", "alu_3"],
  },
  // Kupfer: hell, aber warm, mit tragendem Nachklang.
  kupfer: {
    laut: 0.2,
    dauer: 0.47,
    proben: ["kupfer_1", "kupfer_2"],
  },
  // Kabelbund: dumpf, mit Rascheln.
  kabel: {
    laut: 0.16,
    dauer: 0.17,
    proben: ["kabel_1"],
  },
  // Akku, Kunststoffgehaeuse mit Blei: ein Klotz ohne Klang.
  klotz: {
    laut: 0.18,
    dauer: 0.13,
    proben: ["klotz_1"],
  },
  // Holz: kurzes Klopfen.
  holz: {
    laut: 0.2,
    dauer: 0.12,
    proben: ["holz_1", "holz_2"],
  },
  // Reifen: tiefer, weicher Plumps.
  reifen: {
    laut: 0.22,
    dauer: 0.23,
    proben: ["reifen_1"],
  },
  // Kunststoff: hohles Klacken.
  kunststoff: {
    laut: 0.14,
    dauer: 0.1,
    proben: ["kunststoff_1", "kunststoff_2"],
  },
  // Bauschutt: Brocken und Geroell, kaum Ton.
  geroell: {
    laut: 0.12,
    dauer: 0.11,
    proben: ["geroell_1", "geroell_2"],
  },
};

/** Massiver Stahl unter dieser Masse klingt als kleines Eisen (E-159; vorher als Blech). SW: 40 kg. */
const BLECH_BIS_KG = 40;

/** Welche Klangfamilie ein Material hat. Unbekanntes klingt als Blech. */
export function familieVon(materialId: string, massKg: number, blech: boolean): string {
  switch (materialId) {
    case "steel":
      return blech ? "blech" : massKg < BLECH_BIS_KG ? "kleineisen" : "stahl";
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

/**
 * Gehaltener Schrott schlaegt auf (E-134): Aus dem Senktempo der Armspitze
 * (m/s) wird die Wucht fuer `schrott:aufprall`. Doppelt, weil der Arm
 * nachdrueckt — ein Traeger, den der Bagger mit 2 m/s auf den Beton haut,
 * kracht wie einer, der aus 3 m faellt. Nie unter `SCHLAG_AB_MS`: Was der
 * Melder als Schlag erkannt hat, bekommt einen eigenen Schlag, kein Rasseln.
 * SW: Faktor 2 (gemessen: voll 3,15 m/s, nur Ausleger 2,13 m/s).
 */
export function lastAufschlagWucht(tempo: number): number {
  return Math.max(SCHLAG_AB_MS, 2 * tempo);
}

/**
 * Ein fertiges Aufprall-Rezept, geschichtet wie im Tonstudio (E-159):
 * ANSCHLAG (`teil`, das Material) + KOERPER (`koerper`, die Masse — nur bei
 * schweren Teilen) + UNTERGRUND (`grund`).
 */
export interface AufprallRezept {
  pegel: number;
  /** Anteil der Aufnahme, der ausklingen darf: Beton daempft (E-130) */
  daempf: number;
  teil: Schlag;
  /** Schwere Teile: der Koerper klingt mit (hohles Blech oder Stahl auf Stahl), sonst null */
  koerper: Schlag | null;
  grund: Schlag;
}

/** Ab dieser Masse klingt der Koerper mit. SW: 150 kg (Tuer, Motorblock, Traeger). */
export const KOERPER_AB_KG = 150;

/*
 * DER KOERPER (E-159): Was schwer ist, klingt nicht nur nach seinem Material.
 *  - Blech (Karosserie, Tank, Fass): eine echte zugeschlagene Autotuer —
 *    voll, hohl, dumpf. Auf jedem Untergrund.
 *  - Schweres Metall auf Stahl (Ladeflaeche, Mulde, Container): eine grosse
 *    Metallschranke schlaegt zu und droehnt bis zu 2 s nach. Auf Beton nicht —
 *    da bleibt es trocken.
 */
export const KOERPER: Record<"blech" | "stahl", Schlag> = {
  blech: { laut: 0.3, dauer: 0.5, proben: ["koerper_blech_1", "koerper_blech_2", "koerper_blech_3", "koerper_blech_4"] },
  stahl: { laut: 0.3, dauer: 1.5, proben: ["koerper_stahl_1", "koerper_stahl_2", "koerper_stahl_3"] },
};
const METALLISCH = new Set(["stahl", "kleineisen", "va", "kupfer"]);

/*
 * DER UNTERGRUND klingt mit (SW):
 *  - Beton: ein trockener Klatsch, kein Ton — und das Teil klingt kuerzer,
 *    weil der Boden es daempft.
 *  - Stahl (Ladeflaeche, Mulde): die Platte wummert mit, tief und lang.
 *  - Schrott: ein zweites, kurzes Blechklappern — das Teil, auf das es faellt.
 */
export const GRUND: Record<Untergrund, Schlag> = {
  beton: {
    laut: 0.1,
    dauer: 0.1,
    proben: ["grund_beton"],
  },
  stahl: {
    // E-159: lauter (0,18 → 0,28) — Metall auf Metall soll man am Untergrund hoeren. SW
    laut: 0.28,
    dauer: 0.55,
    proben: ["grund_stahl_1", "grund_stahl_2"],
  },
  schrott: {
    laut: 0.1,
    dauer: 0.22,
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
  spaene?: boolean;
  untergrund: Untergrund;
}): AufprallRezept | null {
  if (!(e.wucht >= SCHLAG_AB_MS)) return null;
  const pegel = aufprallPegel(e.wucht, e.massKg);
  // Späne rascheln wie Draht (E-147), obwohl sie als Mischschrott sonst Blech wären
  const name = e.spaene ? "kabel" : familieVon(e.materialId, e.massKg, e.blech);
  const fam = FAMILIEN[name]!;
  const schwer = !e.spaene && e.massKg >= KOERPER_AB_KG;
  const koerper =
    schwer && name === "blech" ? KOERPER.blech : schwer && METALLISCH.has(name) && e.untergrund === "stahl" ? KOERPER.stahl : null;
  // E-159: keine Tonhoehe nach Masse mehr (±30 % klang bei Kleinteilen nach Micky Maus).
  // Masse wirkt ueber Pegel und Aufnahmewahl, nie ueber das Abspieltempo.
  const daempf = e.untergrund === "beton" ? BETON_DAEMPFT : 1;
  return {
    pegel,
    daempf,
    teil: { ...fam, dauer: fam.dauer * daempf },
    koerper,
    grund: GRUND[e.untergrund],
  };
}

/** Wie lange ein Schlag klingt (s) — fuer die Stimmenzaehlung. */
export function dauerVon(s: Schlag): number {
  return s.dauer;
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
 * Der Druckaufbau beim Zudruecken, je Kraftanteil 0..1: lauter und heller,
 * je haerter. Ab 85 % zischt das Druckbegrenzungsventil — das hoert
 * man an jeder echten Maschine, wenn der Zylinder am Ende ist. SW.
 *
 * Seit E-130 auf einer Aufnahme (Pumpe unter Last, `hyd_druck`): `filterHz`
 * ist ein Tiefpass (leicht gedrueckt klingt dumpf, voll offen). Das
 * Abspieltempo bleibt fest (E-159): Ein Tempo, das mit der Kraft gleitet,
 * zieht die Tonhoehe mit — Patrick hoerte an der Schere „einen lallenden
 * Betrunkenen".
 */
export function stoehnen(k01: number): { laut: number; filterHz: number; zischen: number } {
  const k = Math.min(1, Math.max(0, k01));
  return {
    laut: 0.22 * Math.pow(k, 0.8), // SW: Aufnahme auf −3 dBFS geschnitten, darum hoeher als die alte 0,1
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
  schritt(t: number, kraft01: number): { laut: number; filterHz: number; zischen: number } {
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
    return { laut: 0.22 * this.huelle * (0.4 + 0.6 * k), filterHz: s.filterHz, zischen: 0.1 * this.ventil };
  }
}

/**
 * Schalen und Arm in Bewegung: Oel stroemt (`hyd_fahrt`). `schalen` 0..1 ist
 * das Schalentempo, `arm` 0..1 die Achsbewegung des Baggers — wer nur den Arm
 * bewegt, hoert die Hydraulik leiser als beim Greifen. Eine Quelle fuer beides,
 * damit nicht zwei Kopien derselben Aufnahme gegeneinander schweben. SW.
 */
export function oelFluss(schalen: number, arm: number): { laut: number } {
  // Unter 3 % ist es Messrauschen, keine Bewegung — sonst haenge ein Hauch Oel
  // am Zuhalten (E-130). SW.
  const s = schalen < 0.03 ? 0 : Math.min(1, schalen);
  const a = arm < 0.03 ? 0 : Math.min(1, arm * 1.6);
  return { laut: Math.max(0.14 * s, 0.06 * a) };
}

/* ---------------------------------------------------- Knautschen (E-130) -- */

/**
 * Das Wrack knautscht (`wrack:geknautscht`). `zuwachs` ist, um wie viel der
 * mittlere Knautschgrad gestiegen ist: ein voller Biss etwa 0,17, die Presse
 * bis 1. Groesser heisst lauter, laenger und dichter — die Presse
 * faltet das ganze Auto hoerbar auf einmal, ein Biss knirscht kurz. SW.
 */
export function knautschKlang(zuwachs: number): { pegel: number; dauer: number; schlaege: number } {
  const z = Math.min(1, Math.max(0, zuwachs));
  return {
    pegel: 0.35 + 0.65 * Math.sqrt(z),
    dauer: 0.6 + 2.4 * z,
    schlaege: Math.round(4 * z),
  };
}

/* ------------------------------------- Hämmern und Drücken (E-139) -- */

/** Worauf die Spinne schlägt oder drückt: die drei Untergründe plus das Wrack. */
export type SpinnenGrund = Untergrund | "wrack";

/** Zwischen zwei Hammerschlägen mindestens so viel Zeit, sonst Maschinengewehr. SW: 0,15 s (wie E-134). */
export const AUFSCHLAG_ABSTAND_S = 0.15;
/**
 * Drücken klingt in Stößen, nie als Dauerton: nach einem Stoß mindestens
 * `DRUECK_ABSTAND_S` plus bis zu `DRUECK_STREU_S` Pause. Der Melder schickt
 * höchstens alle 0,25 s; mit der Streuung fällt ab und zu einer aus — so
 * knirscht es unregelmäßig wie echtes Blech, nicht im Takt. SW beide.
 */
export const DRUECK_ABSTAND_S = 0.2;
export const DRUECK_STREU_S = 0.15;
/** Ein Stoß ist kürzer als die kürzeste Pause — dazwischen ist es still. SW: 0,18 s. */
export const DRUECK_DAUER_S = 0.18;

/** Eine Schicht eines Spinnenklangs: welche Aufnahmen, wie laut, wie schnell, wie lang. */
export interface Schicht {
  proben: readonly string[];
  pegel: number;
  /** Abschneiden nach Sekunden (mit Ausblende); fehlt = ganz */
  dauer?: number;
  /** Tiefpass in Hz (dumpfer); fehlt = offen */
  tp?: number;
}

/** ±`anteil` Zufall um 1 — fuer Pegel und Dauer (die Tonhoehe streut `spiele` selbst, ±TEMPO_STREU). */
const streu = (anteil: number): number => 1 + (Math.random() - 0.5) * 2 * anteil;

/**
 * Die Spinne schlägt auf (`spinne:aufschlag`): schwerer Stahl (die Spinne
 * selbst, gut eine Tonne) plus der Untergrund. Wrack: dumpf geknautschtes
 * Blech statt Stahlklang. Lautstärke folgt der Wucht. Alle Pegel SW.
 */
export function spinnenAufschlag(wucht01: number, grund: SpinnenGrund): Schicht[] {
  const w = Math.min(1, Math.max(0, wucht01));
  const p = 0.15 + 0.85 * Math.pow(w, 0.8);
  const stahl: Schicht = { proben: FAMILIEN.stahl!.proben, pegel: 0.75 * p };
  switch (grund) {
    case "beton":
      return [stahl, { proben: GRUND.beton.proben, pegel: 0.5 * p }];
    case "stahl": {
      // E-159: Ein kraeftiger Hieb auf Stahl droehnt nach (Metallschranke)
      const s: Schicht[] = [stahl, { proben: GRUND.stahl.proben, pegel: 0.6 * p }];
      if (w > 0.5) s.push({ proben: KOERPER.stahl.proben, pegel: 0.5 * p });
      return s;
    }
    case "schrott":
      return [stahl, { proben: GRUND.schrott.proben, pegel: 0.5 * p }, { proben: FAMILIEN.blech!.proben, pegel: 0.35 * p }];
    case "wrack":
      return [
        { proben: EINZEL.knautsch, pegel: 0.4 * p, dauer: 0.35 + 0.4 * w },
        { proben: FAMILIEN.blech!.proben, pegel: 0.5 * p, tp: 2500 },
        { proben: FAMILIEN.stahl!.proben, pegel: 0.3 * p, tp: 1800 },
      ];
  }
}

/**
 * Die Spinne drückt (`spinne:druecken`): ein kurzer Stoß Knirschen oder
 * Ächzen, je Untergrund eine andere Aufnahme — Beton knirscht wie Schutt,
 * Stahl ächzt (Kreischen aus der Ladefläche), Schrott und Wrack geben nach.
 * Härter = lauter. Höchstens
 * `DRUECK_DAUER_S` lang, nie länger. Alle Pegel SW.
 */
export function spinnenDruecken(staerke01: number, grund: SpinnenGrund): Schicht {
  const s = Math.min(1, Math.max(0, staerke01));
  const pegel = (0.12 + 0.5 * s) * streu(0.2);
  const d = DRUECK_DAUER_S * (0.7 + 0.3 * Math.random()); // nie über DRUECK_DAUER_S
  switch (grund) {
    case "beton":
      return { proben: FAMILIEN.geroell!.proben, pegel, dauer: d };
    case "stahl":
      return { proben: [SCHLEIFEN.kehrStahl], pegel: 0.8 * pegel, dauer: d, tp: 3500 };
    case "schrott":
      return { proben: EINZEL.biss, pegel, dauer: d };
    case "wrack":
      return { proben: EINZEL.knautsch, pegel: 1.2 * pegel, dauer: d };
  }
}

/* --------------------------------------------- Lasthebemagnet (E-151) -- */

/** Viele Teile schlagen kurz nacheinander an: ein Klonk je so viel Zeit. SW: 0,12 s. */
export const KLONK_ABSTAND_S = 0.12;
/** Motor-Tiefpass im Leerlauf (Hz); Bedienung oeffnet ihn (E-159: statt hoeherer Drehzahl). SW. */
export const MOTOR_HZ_LEER = 1500;
/** Magnet an: der Generator zieht am Diesel — so viel heller (Hz) und lauter. SW. */
export const MAGNET_HELL_HZ = 800;
export const MAGNET_LAUT = 0.015;

/**
 * Pegel des Klonks aus der neu haftenden Masse: 5 kg leise (0,3), ab 500 kg
 * voll, logarithmisch dazwischen — ein Träger klonkt deutlich, nicht
 * hundertmal lauter als eine Dose. SW.
 */
export function klonkPegel(massKg: number): number {
  const m = Math.max(0, massKg);
  return Math.min(1, Math.max(0.3, 0.3 + 0.35 * Math.log10(Math.max(m, 1) / 5)));
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
  // Signale (E-148): echte Aufnahmen, BigSoundBank #2721/#1269/#3260
  hupe: ["hupe"],
  sirene: ["sirene"],
  klingel: ["klingel"],
} as const;

/**
 * Dateiname einer Aufnahme in public/ton/ (E-159): Schleifen sind WAV (eine
 * verlustbehaftete Naht koennte bei jeder Runde knacken), alle Einzelklaenge
 * AAC in M4A — rund fuenfmal kleiner, iOS-Safari dekodiert es nativ.
 */
export function dateiVon(name: string): string {
  return (Object.values(SCHLEIFEN) as string[]).includes(name) ? `${name}.wav` : `${name}.m4a`;
}

/** Alle Aufnahmen, die das Spiel laedt — Familien, Untergruende, Schleifen, Einzelklaenge. */
export function alleProben(): string[] {
  const alle = [
    ...Object.values(FAMILIEN).flatMap((f) => f.proben),
    ...Object.values(GRUND).flatMap((g) => g.proben),
    ...Object.values(KOERPER).flatMap((g) => g.proben),
    ...Object.values(SCHLEIFEN),
    ...Object.values(EINZEL).flat(),
  ];
  return [...new Set(alle)];
}

/* -------------------------------------------------------------- Kehren -- */

/**
 * Das Schleifen der Spinne, je Tempo 0..1 und Untergrund. Jeder Untergrund hat
 * seinen eigenen Klangweg im Manager; hier steht nur, wie laut und wie hell.
 * Schneller = lauter und heller (das Tempo der Aufnahme bleibt fest, E-159). SW.
 */
export function kehrKlang(tempo01: number, grund: Untergrund): { laut: number; hz: number } {
  const t = Math.min(1, Math.max(0, tempo01));
  switch (grund) {
    case "beton":
      // raues Schaben: breites Band, dichte Koernung
      return { laut: 0.16 * t, hz: 800 + 700 * t };
    case "stahl":
      // Kreischen: enges, hohes Band, wandert mit dem Tempo
      return { laut: 0.09 * t, hz: 2100 + 900 * t };
    case "schrott":
      // Klappern und Rutschen: lose Schlaege, lauter je schneller
      return { laut: 0.2 * t, hz: 1300 + 500 * t };
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
