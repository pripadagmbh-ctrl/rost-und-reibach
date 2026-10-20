import type RAPIER from "@dimforge/rapier3d-compat";
import type { EventBus, GameEvents } from "../core/events";
import type { WrackArt } from "../dismantle/carDef";
import type { Zweisprachig } from "./texte";

/**
 * DER AUFGABEN-RAHMEN (E-125, 06.10.2026; neu gefasst in E-162, 19.10.2026).
 *
 * Patrick: „Mit Challenges soll das Spiel anfangen, damit die Steuerung klar
 * wird." Eine Aufgabe ist DATEN (`katalog.ts`): was liegt wo, welche
 * Lernschritte, welche Schwellen fuer die Sterne. Hier steht nur, was alle
 * gemeinsam haben — das Beobachten, das Weiterruecken, das Zaehlen, das Werten.
 *
 * NUR BEOBACHTEN. Nichts hier bewegt einen Koerper, eine Spinne oder ein
 * Pendel (Regel 2). Ein Schritt gilt erst als geschafft, wenn das Spiel ihn
 * gesehen hat — nie nach Zeit. Was der Spieler schon richtig macht, wird
 * uebersprungen: Ein spaeterer Schritt, der schon zu sehen ist, nimmt die
 * frueheren mit.
 *
 * WAS NEU IST (E-162): Der Lauf hoert selbst auf die Ereignisse, die es schon
 * gibt (`itemEntered`, `itemLeft`, `schrott:aufprall`, `greifer:ueberlast`,
 * `wrack:geknautscht`, `fahrkunst:zyklus`), und zaehlt daraus, was man SIEHT:
 * Uhr, Fehlwuerfe, harte Aufschlaege, Ueberlast-Meldungen, Fremdteile im Ziel,
 * Abstand zur Markierung. Pendel-Ruhe in Grad ist keine Sternbedingung mehr
 * (Patrick 19.10.2026, Frage 5 A).
 *
 * WAS BEOBACHTET WERDEN KANN — die naechste Aufgabe waehlt aus dieser Liste;
 * wer etwas Neues beobachten will, setzt hier eine Zeile dazu.
 *
 * Teile (Aufgabe 1). „Das Teil" ist das gefasste Aufgaben-Teil, sonst das
 * erste, das noch nicht im Ziel liegt:
 *   blick_auf_teil     der Oberwagen schaut aufs Teil (Winkel klein)
 *   spinne_am_teil     die Spinne steht ueber dem Teil — waagrecht nah UND
 *                      tief genug, dass Schliessen es packt
 *   teil_gefasst       das Teil haengt in der Spinne
 *   teil_gehoben       gefasst und hoch genug, um ueber die Wand des
 *                      Zielbehaelters zu kommen
 *   teil_ueber_ziel    gefasst und ueber dem Zielbehaelter
 *   teil_im_ziel       ALLE Aufgaben-Teile liegen im Zielbehaelter, keines
 *                      mehr in der Spinne
 *
 * Wrack und Presse (E-125, Aufgabe 2 — unveraendert):
 *   wrack_gefasst      das Wrack haengt in der Spinne
 *   wrack_ueber_kammer es haengt in der Spinne und steht waagerecht ueber
 *                      der Presskammer (Pruefung der Presse selbst)
 *   wrack_in_kammer    losgelassen und in der Kammer — genau das, was die
 *                      Presse beim Stempeln als „drin" zaehlt (`inChamber`).
 *                      Bewusst NICHT „still": Quer aufgelegt ruht ein Wrack
 *                      auf Wandkrone und Klappe und schlaeft dort nie ein
 *                      (gemessen, `tools/challenge-ruhe.ts`).
 *   wrack_gepresst     die Presse hat zugeschlagen, nachdem sie mit dem Wrack
 *                      in der Kammer gestartet wurde
 *
 * Seit G3 (20.10.2026, Aufgaben 3–6):
 *   teil_im_ziel       ohne `zielBehaelter` (Aufgabe 3, Sortieren): jedes
 *                      Pflichtteil liegt in einer Mulde, in der es RICHTIG
 *                      ist (`itemEntered.correct`), losgelassen und unter der
 *                      Krone. Teile mit `bleibtLiegen` (Kupfer in Aufgabe 5)
 *                      zaehlen nicht mit.
 *   wrack_geknautscht  das Aufgaben-Wrack ist sichtbar angeknautscht
 *                      (`wrack:geknautscht.grad` ≥ `ANGEKNAUTSCHT_AB`)
 *   wrack_platt        … und mindestens `plattAb` (Aufgabe 4)
 *   wrack_gehoben      gefasst und mit der Unterkante `WRACK_HUB_M` ueber dem
 *                      Boden (Aufgabe 6)
 *   wrack_abgelegt     losgelassen, liegt mit der Mitte im Ablagekreis
 *                      (`ablageziel`, `ablageRadiusM`) — und war VORHER
 *                      gehoben: Setzt es gefasst ausserhalb des Kreises auf,
 *                      zaehlt das Heben nicht mehr. Unter Ueberlast schleift
 *                      ein Wrack sonst ueber den Boden ins Ziel (Befund M6).
 *
 * Und auf der Karte (`challenge:stand`):
 *   zaehler            mit `zaehlwort`: Pflichtteile im Ziel / alle
 *   balken01           mit `plattAb`: der Knautschgrad des Wracks, 0 … 1
 *   tipp               mit `tippNachUeberlast`: ab der ersten Ueberlast-
 *                      Meldung OHNE Pratzen (`greifer:ueberlast.abgestuetzt`)
 *
 * Seit G4 (20.10.2026, Aufgabe 5 mit zwei Halden):
 *   Ein Teil darf sein EIGENES Ziel haben (`AufbauTeil.ziel`, sonst gilt
 *   `zielBehaelter`). Gehoben, ueber dem Ziel, im Ziel, die gruene Marke und
 *   der Fehlwurf richten sich dann nach dem Ziel dieses Teils. Fremdteil ist,
 *   was in IRGENDEINEM dieser Ziele liegt und dort nicht hingehoert.
 *   Mit `zielMarkeAbStart` steht die gruene Marke vom ersten Bild an
 *   (Aufgabe 6, Patrick 20.10.2026), sonst erst, wenn das Wrack haengt.
 */
export type Beobachtung =
  | "blick_auf_teil"
  | "spinne_am_teil"
  | "teil_gefasst"
  | "teil_gehoben"
  | "teil_ueber_ziel"
  | "teil_im_ziel"
  | "wrack_gefasst"
  | "wrack_ueber_kammer"
  | "wrack_in_kammer"
  | "wrack_gepresst"
  | "wrack_geknautscht"
  | "wrack_platt"
  | "wrack_gehoben"
  | "wrack_abgelegt";

/**
 * Was der Geisterdaumen zeigt — die Form steht in `core/events.ts`.
 *
 * `richtung` ist das VORZEICHEN DES BEFEHLS, wie ihn der Bagger bekommt
 * (gelesen in `excavator/excavator.ts`, Zeilen „inCab/inBoom/inStick" und
 * „Spinne"; Tastatur `input.axis(minus, plus)`, Touch `touch.axes.*`):
 *   grapple  plus = schliessen (Leertaste, rechter Stick nach rechts),
 *            minus = oeffnen — dasselbe „plus" wie in `ui/challengekarte.ts`
 *   boom     plus = Hauptarm HEBEN (Taste R, `boomAngle` steigt),
 *            minus = senken (Taste F)
 *   cab      plus = `cabYaw` steigt (Taste Q). Blickrichtung ist
 *            (sin, cos) von `heading + cabYaw`; steigt der Winkel, dreht der
 *            Oberwagen nach +x — vom Fahrer aus nach LINKS (er schaut beim
 *            Start nach +z, rechts von ihm ist −x). minus = nach rechts (E).
 *   stick    plus = Ausleger WEG (Taste T, `stickAngle` steigt Richtung
 *            −25°, die Spitze geht nach aussen), minus = heran (G)
 * Welcher Stick und welche Bildschirmrichtung das sind, weiss nur die
 * Anzeige — die Belegung ist frei (`core/controlConfig.ts`).
 */
export type Zeige = GameEvents["challenge:schritt"]["zeige"];

export interface Lernschritt {
  /** Woran das Spiel erkennt, dass der Schritt geschafft ist */
  beobachtet: Beobachtung;
  titel: Zweisprachig;
  /**
   * Bildschirmtext. Platzhalter fuer die Bedienung — `{schwenken}`,
   * `{hauptarm}`, `{ausleger}`, `{schliessen}`, `{oeffnen}` — setzt die
   * Anzeige aus der Stickbelegung ein (`ui/challengekarte.ts`). In BEIDEN
   * Sprachen dieselben (Waechter in `test/aufgabe1.test.ts`).
   */
  text: Zweisprachig;
  /** Geisterdaumen: welche Bewegung, in welche Richtung; null = keiner */
  zeige: Zeige;
}

/**
 * Was am Ende gemessen vorliegt — nur Sichtbares (Patrick 19.10.2026).
 * Die Schluesselnamen sind mit der Anzeige vereinbart (Abschlusstafel,
 * Sternziel-Zeilen); wer einen umbenennt, bricht `ui/abrechnung.ts`.
 */
export interface ChallengeMessung {
  /** Spielzeit vom Start bis zum letzten Schritt (s), ohne Pause */
  zeitS: number;
  /** Aufgaben-Teile, die in einer falschen Mulde gelandet sind — je Teil und Einwurf einmal */
  fehlwuerfe: number;
  /** Aufschlaege eigener Teile/Wracks ab `HART_AB_MS`, dazu Wracks aus `FALLHOEHE_HART_M` fallen gelassen */
  harteAufschlaege: number;
  /** Fahrkunst Praezision (E-119): Abstand zum Ablageziel im Liegen (cm); null = ohne Ziel/Zyklus */
  praezisionCm: number | null;
  /** Ueberlast-Meldungen der Maschine (E-152) */
  ueberlasten: number;
  /** Falsche Teile, die beim Abschluss im Zielbehaelter liegen (Stand, nicht Ereignis) */
  fremdteile: number;
}

/** Obergrenzen je Messgroesse. Was fehlt, zaehlt fuer diesen Stern nicht. */
export type Schwellen = Partial<Record<keyof ChallengeMessung, number>>;

/** Ein Stern ist der Boden (geschafft). Zwei und drei verlangen ALLE ihre Schwellen. */
export interface ChallengeWertung {
  zwei: Schwellen;
  drei: Schwellen;
}

/** Ein Teil aus dem Teilekatalog (`name` wie in `world/objektkatalog.ts` bzw. `scrapItems.ts`). */
export interface AufbauTeil {
  name: string;
  x: number;
  z: number;
  /** Drehung um die Hochachse (rad) */
  gier?: number;
  /**
   * Gehoert NICHT ins Ziel (Aufgabe 5: das Kupfer im Eisenhaufen). Zaehlt
   * nicht fuer Zaehler und Fertig; liegt es in einem Ziel der Aufgabe, ist es
   * ein Fremdteil — kein Fehlwurf (G4: Fehlwurf ist ein Pflichtteil im
   * falschen Ziel).
   */
  bleibtLiegen?: boolean;
  /** Eigenes Ziel dieses Teils (Container-ID), sonst `ChallengeDaten.zielBehaelter` — Aufgabe 5: Spaene auf MISCH */
  ziel?: string;
}

export interface AufbauWrack {
  art: WrackArt;
  x: number;
  z: number;
  gier?: number;
  /** Alle abreissbaren Teile ab, wie aus dem Spielstand (`restoreState`) — der Rumpf allein (Aufgabe 6) */
  ausgeschlachtet?: boolean;
}

/** Was auf dem sonst leeren Platz steht (gebaut von `aufbau.ts`). */
export interface ChallengeAufbau {
  teile?: readonly AufbauTeil[];
  wracks?: readonly AufbauWrack[];
  /** Mit welchem Greifer die Aufgabe beginnt (Kennung aus `excavator/greiferwahl.ts`) */
  greifer?: "fuenfschalen" | "magnet";
}

export interface ChallengeDaten {
  id: string;
  /** Knopf im Hauptmenue und Kopf des Abschlussbilds */
  name: Zweisprachig;
  /** Kleingedrucktes im Hauptmenue */
  beschreibung: Zweisprachig;
  /** Ein Satz auf der Karte: was zu tun ist */
  ziel: Zweisprachig;
  aufbau: ChallengeAufbau;
  /**
   * Wohin die Teile gehoeren (Container-ID aus `world/containers.ts`). Ist er
   * gesetzt, gilt ein Fahrkunst-Zyklus ueber ihm als „am Ziel"; sonst ueber
   * der Presskammer.
   */
  zielBehaelter?: string;
  /** Ablageziel fuer die Praezision (`Fahrkunst.ziel`); null = keins */
  ablageziel: { x: number; z: number } | null;
  /** Mit `ablageziel`: Halbmesser des Ablagekreises fuer `wrack_abgelegt` (m) */
  ablageRadiusM?: number;
  /** Wo die gruene Marke steht, solange das Wrack gefasst ist (ohne Zielbehaelter: Kammer, Ablagekreis) */
  zielMarke?: Punkt;
  /** Die gruene Marke steht schon vor dem Greifen (Aufgabe 6: der Kreis von Anfang an) */
  zielMarkeAbStart?: boolean;
  /** Zaehler auf der Karte: „4/6 richtig" — das Wort dahinter */
  zaehlwort?: Zweisprachig;
  /** Balken „platt" auf der Karte und `wrack_platt` ab diesem Knautschgrad (0 … 1) */
  plattAb?: number;
  /** Hinweis auf der Karte nach der ersten Ueberlast ohne Pratzen */
  tippNachUeberlast?: Zweisprachig;
  schritte: readonly Lernschritt[];
  wertung: ChallengeWertung;
}

/** Erfuellt die Messung alle diese Schwellen? Ungemessen erfuellt keine. */
export function erfuellt(s: Schwellen, m: ChallengeMessung): boolean {
  return (Object.keys(s) as Array<keyof ChallengeMessung>).every((k) => {
    const v = m[k];
    return v !== null && v <= s[k]!;
  });
}

/** Ein bis drei Sterne — die einzige Stelle, an der sie entstehen. */
export function sterne(w: ChallengeWertung, m: ChallengeMessung): number {
  return erfuellt(w.drei, m) ? 3 : erfuellt(w.zwei, m) ? 2 : 1;
}

/* ------------------------------------------------------------------------ */
/* Schwellen der Beobachtung — alle SW, nach Patricks ersten Laeufen nachstellen */
/* ------------------------------------------------------------------------ */

/**
 * Ab dieser Wucht (m/s Tempoverlust, wie `schrott:aufprall` sie meldet) ist
 * ein Aufschlag „hart". // SW: 5,0 m/s ist der freie Fall aus 1,3 m
 * (√(2 · 9,81 · 1,27)). Gehaltene Last meldet 2 × Senktempo
 * (`audio/klangregeln.ts` `lastAufschlagWucht`): mit vollem Arm (3,15 m/s,
 * gemessen E-134) aufgesetzt sind das 6,3 — hart; nur mit dem Ausleger
 * (2,13 m/s) 4,3 — nicht hart; ruhig abgesetzt meldet der Melder 1,5. Der
 * Ton macht ab 1,5 einen eigenen Schlag (`SCHLAG_AB_MS`) — „hart" liegt
 * deutlich darueber, sonst zaehlte jedes Ablegen.
 *
 * GEMESSEN AM WRACK (G3, 20.10.2026, `test/aufgabe2.test.ts`, echter Pkw in
 * der echten Presse): Langsam abgesetzt meldet es 2,7 m/s, mit vollem
 * Senktempo aufgesetzt 6,2 — die Schwelle trennt das. Aus der Wandkrone
 * (2,2 m) fallen gelassen trifft es zwar mit 6,1 m/s auf, der Melder sieht
 * aber nur 2,6–2,9: Rapier bremst die 950 kg ueber zwei bis drei Schritte ab,
 * und gemeldet wird der Verlust je Schritt. Erst ab rund 3,5 m Fallhoehe
 * meldet er ≥ 5 (6,7 / 9,4). Darum zaehlt beim Wrack zusaetzlich die
 * Fallhoehe beim Loslassen (`FALLHOEHE_HART_M`).
 */
export const HART_AB_MS = 5.0;

/**
 * Ein Wrack, das aus dieser Hoehe ueber der Stelle losgelassen wird, an der
 * es dann liegen bleibt, ist hart aufgeschlagen — auch wenn der Melder es
 * (siehe oben) zu weich meldet. // SW: 0,5 m — langsam abgesetzt sind es
 * gemessen 0,0 m (Unterkante 0,25 beim Oeffnen, 0,30 liegend), von der
 * Wandkrone 1,95 m. Ein Aufschlag je Loslassen, auch wenn beides zutrifft.
 */
export const FALLHOEHE_HART_M = 0.5;

/** So lange nach dem Loslassen wird der Fall eines Wracks beobachtet. // SW: 2 s, ein Fall aus 5 m dauert 1 s */
export const FALL_BEOBACHTEN_S = 2.0;

/**
 * „Der Oberwagen schaut aufs Teil": Winkel zwischen Blickrichtung und
 * Richtung Drehmitte → Teil. // SW: 6° sind auf 8,1 m Ausladung (gemessen,
 * `test/aufgabe1.test.ts`) 0,85 m seitlich — gemessen greift der
 * Fuenfschalengreifer den Kupfer-Boiler noch mit 0,8 m Versatz. Das Teil der
 * Aufgabe 1 liegt 15° neben der Startblickrichtung, der Schritt kann sich also
 * nicht selbst erledigen.
 */
export const BLICK_TOLERANZ_RAD = (6 * Math.PI) / 180;

/**
 * „Die Spinne steht am Teil", waagrecht: Abstand Sensorpunkt → Teilmitte.
 * // SW: 0,8 m — bis dahin greift der Fuenfschalengreifer den Kupfer-Boiler
 * gemessen noch (`test/aufgabe1.test.ts`, Versatz 0 / 0,4 / 0,8 m).
 */
export const SPINNE_WAAGRECHT_M = 0.8;

/**
 * „… und tief genug": Hoehe Sensorpunkt ueber Teilmitte. // SW: 1,2 m.
 * Gemessen (Fuenfschalengreifer, `test/aufgabe1.test.ts`): in der Startpose
 * steht der Sensor 1,76 m ueber der Mitte des liegenden Boilers, mit dem
 * Hauptarm bis zum Boden gesenkt 0,87 m. 1,2 m liegt dazwischen und knapp
 * unter dem Sensorradius (1,24 m) — die Greifkugel reicht dann bis zur
 * Teilmitte.
 */
export const SPINNE_HOEHE_M = 1.2;

/**
 * „Gehoben": so viel Luft muss die Unterkante des Teils ueber der Wand des
 * Zielbehaelters haben. // SW: 0,3 m — eine Handbreit mehr als die Wand,
 * damit es beim Schwenken nicht an der Krone haengen bleibt.
 */
export const HUB_LUFT_M = 0.3;

/** Ohne Zielbehaelter: so hoch ueber seiner Liegehoehe gilt ein Teil als gehoben. // SW: 1,0 m, deutlich mehr als jedes Zucken beim Zupacken */
export const HUB_OHNE_ZIEL_M = 1.0;

/**
 * „Angeknautscht" (Aufgabe 4, Schritt 1): ab diesem mittleren Knautschgrad.
 * // SW: 0,05 — ein voller Biss bringt gemessen 0,06 bis 0,2
 * (`test/aufgabe4.test.ts`), ein Zucken beim Aufsetzen nichts.
 */
export const ANGEKNAUTSCHT_AB = 0.05;

/**
 * „Gehoben" (Aufgabe 6): Unterkante des gefassten Wracks so hoch ueber dem
 * Boden. // SW: 0,3 m — eine Handbreit wie `HUB_LUFT_M`; ein Wrack, das mit
 * einem Ende schleift, steht dort bei 0.
 */
export const WRACK_HUB_M = 0.3;

/**
 * „Liegt" bzw. „setzt auf": Unterkante hoechstens so hoch. // SW: 0,15 m —
 * ein liegendes Wrack misst gemessen 0,00 bis 0,05 m (Raeder, Beton-
 * Eindringtiefe), ein haengendes deutlich mehr.
 */
export const WRACK_LIEGT_M = 0.15;

/**
 * Ueberlast-Meldungen, die so dicht aufeinander folgen, sind EIN Versuch.
 * // SW: 1,0 s — gemessen (`test/aufgabe6.test.ts`): Wer den Ausleger an der
 * Grenze 1,5 s gedrueckt haelt, bekommt vom Bagger fuenf Meldungen bei 5,61–5,62 m
 * (die Sperre gibt kurz frei, der Ausleger rueckt nach). Ein neuer Versuch
 * ist erst, was nach einer Sekunde ohne Meldung kommt.
 */
export const UEBERLAST_PAUSE_S = 1.0;

/** Ohne `hoehenspanne` (Attrappen): Marke so hoch ueber der Wrackmitte. // SW: 1,5 m, Dach eines Pkw */
export const WRACK_MARKE_OHNE_SPANNE_M = 1.5;

/* ------------------------------------------------------------------------ */
/* Was der Lauf von der Welt liest — mehr nicht                              */
/* ------------------------------------------------------------------------ */

export interface Punkt {
  x: number;
  y: number;
  z: number;
}

/**
 * Die Quellen des Laufs. Fertig verdrahtet fuer das Spiel in
 * `challenges/quellen.ts` (`weltQuellen`); Tests geben Attrappen.
 */
export interface ChallengeQuellen {
  /** Was gerade in der Spinne haengt (`grip.grippedBodies`) */
  gegriffen(): ReadonlyArray<{ handle: number }>;
  /** Sensorpunkt der Spinne (`excavator.getSensorPosition`) */
  spinne(): Punkt;
  /** Drehmitte des Oberwagens (`excavator.position`) */
  drehmitte(): { x: number; z: number };
  /** Weltgier des Oberwagens, `heading + cabYaw` (rad); Blick = (sin, cos) */
  blickRad(): number;
  /** Ort und Wandoberkante eines Behaelters, null wenn es ihn nicht gibt */
  behaelter(id: string): { x: number; z: number; oberkante: number } | null;
  /** Steht der Punkt ueber dem Behaelter? (`GameContainer.isOverhead`, beruecksichtigt die Drehung) */
  ueberBehaelter(id: string, p: { x: number; z: number }): boolean;
  /** In welchem Behaelter das Teil laut Zonen-Zaehlung liegt (`ScrapItem.containerId`) */
  behaelterVon(itemId: string): string | null;
  /** `PressManager.ueberKammer` */
  ueberKammer(p: { x: number; z: number }): boolean;
  /** `PressManager.inChamber` */
  inKammer(p: Punkt): boolean;
  /**
   * Tiefster und hoechster Punkt eines Koerpers (m ueber Boden), aus seinen
   * Kollidern; null = unbekannt. Ohne diese Quelle (Attrappen) rechnet der
   * Lauf mit der Mitte: unten = Hub ueber der Liegehoehe.
   */
  hoehenspanne?(handle: number): { unten: number; oben: number } | null;
}

/** Was ein Koerper der Aufgabe koennen muss — ein `RAPIER.RigidBody` kann es. */
export type AufgabenKoerper = Pick<RAPIER.RigidBody, "handle" | "translation" | "isValid">;

/** Die Objekte, die `aufbau.ts` fuer die Aufgabe gebaut hat (`ScrapItem` / `CarComposite` passen). */
export interface ChallengeObjekte {
  teile: ReadonlyArray<{ id: string; body: AufgabenKoerper }>;
  wracks: ReadonlyArray<{ body: AufgabenKoerper }>;
}

type Marke = GameEvents["challenge:stand"]["marken"][number];

export class ChallengeLauf {
  zeitS = 0;
  geschafft = false;
  /** Hoechster beobachteter Schritt (Index), −1 = noch keiner */
  private erreicht = -1;
  private gemeldet = -1;
  private laeuft = false;
  /** Nach `beenden()` stumm — der EventBus kennt kein `off` (E-162) */
  private aus = false;

  private inKammer = false;
  private freigegeben = false;
  private gepresst = false;
  /** Letzter Fahrkunst-Zyklus, der am Ziel zur Ruhe kam */
  private zyklus: GameEvents["fahrkunst:zyklus"] | null = null;

  private fehlwuerfe = 0;
  private harteAufschlaege = 0;
  private ueberlasten = 0;
  /** Hoechster gemeldeter Knautschgrad eines Aufgaben-Wracks (Aufgabe 4 liest ihn) */
  knautschgrad = 0;
  /** Teile, deren falscher Einwurf schon gezaehlt ist — frei erst nach erneutem Greifen */
  private falschGezaehlt = new Set<string>();
  /** Falsche Teile, die gerade in einem Ziel liegen: Teil → Ziel */
  private fremdIn = new Map<string, string>();
  /** Liegehoehe je Teil (tiefste Mitte, solange es nicht gefasst war) */
  private liegeY = new Map<string, number>();
  /** Aufgaben-Teile, die richtig eingeworfen wurden: Teil → Mulde (bis `itemLeft`) */
  private richtigIn = new Map<string, string>();
  /** Liegehoehe des Wracks (tiefste Mitte, ungefasst) — Ersatz, wenn `hoehenspanne` fehlt */
  private wrackLiegeY: number | null = null;
  /** Das Wrack war gehoben und hat seitdem nicht ausserhalb des Ablagekreises aufgesetzt */
  private wrackGehoben = false;
  /** Ueberlast ohne Pratzen gemeldet → Tipp auf der Karte */
  private ueberlastFrei = false;
  /** Spielzeit der letzten Ueberlast-Meldung (gezaehlt oder nicht) */
  private letzteUeberlastS = -Infinity;
  /** War das Wrack im letzten Bild gefasst? */
  private wrackWarGefasst = false;
  /** Das Wrack faellt nach dem Loslassen: Unterkante dabei, tiefste seitdem, Zeit, schon hart gemeldet */
  private fall: { ab: number; tief: number; s: number; hart: boolean } | null = null;

  private readonly teilIds: ReadonlySet<string>;
  /** Teile, die ins Ziel muessen (ohne `bleibtLiegen`) */
  private readonly pflichtIds: ReadonlySet<string>;
  private readonly eigeneHandles: ReadonlySet<number>;
  /** Pflichtteil → sein Ziel (eigenes `ziel` oder `zielBehaelter`); fehlt = Sortieren nach `itemEntered.correct` */
  private readonly zielJe = new Map<string, string>();
  /** Alle Ziele der Aufgabe — was dort falsch liegt und kein Pflichtteil ist, ist ein Fremdteil */
  private readonly alleZiele = new Set<string>();

  constructor(
    readonly daten: ChallengeDaten,
    /** Stelle im Katalog, ab 1 (`challenge:start`) */
    readonly nr: number,
    private q: ChallengeQuellen,
    private bus: EventBus,
    private objekte: ChallengeObjekte
  ) {
    this.teilIds = new Set(objekte.teile.map((t) => t.id));
    // `baueAufgabe` legt die Teile in der Reihenfolge der Daten an
    this.pflichtIds = new Set(objekte.teile.filter((_, i) => !daten.aufbau.teile?.[i]?.bleibtLiegen).map((t) => t.id));
    objekte.teile.forEach((t, i) => {
      const z = daten.aufbau.teile?.[i]?.ziel ?? daten.zielBehaelter;
      if (z && this.pflichtIds.has(t.id)) this.zielJe.set(t.id, z);
    });
    if (daten.zielBehaelter) this.alleZiele.add(daten.zielBehaelter);
    for (const z of this.zielJe.values()) this.alleZiele.add(z);
    this.eigeneHandles = new Set([
      ...objekte.teile.map((t) => t.body.handle),
      ...objekte.wracks.map((w) => w.body.handle),
    ]);
    const zaehlt = (): boolean => this.laeuft && !this.aus && !this.geschafft;
    bus.on("itemEntered", (e) => {
      if (!zaehlt()) return;
      const pflicht = this.pflichtIds.has(e.itemId);
      if (this.teilIds.has(e.itemId) && e.correct) this.richtigIn.set(e.itemId, e.containerId);
      // Fremd ist, was in einem Ziel liegt und dort nicht hingehoert; ein Pflichtteil im falschen Ziel ist ein Fehlwurf
      if (!e.correct && !pflicht && this.alleZiele.has(e.containerId)) this.fremdIn.set(e.itemId, e.containerId);
      if (!pflicht || this.falschGezaehlt.has(e.itemId)) return;
      // Mit Ziel zaehlt fuer Pflichtteile der Behaelter, sonst die Sorte
      const z = this.zielJe.get(e.itemId);
      const falsch = z ? e.containerId !== z : !e.correct;
      if (!falsch) return;
      this.falschGezaehlt.add(e.itemId);
      this.fehlwuerfe++;
    });
    bus.on("itemLeft", (e) => {
      if (!zaehlt()) return;
      if (this.fremdIn.get(e.itemId) === e.containerId) this.fremdIn.delete(e.itemId);
      if (this.richtigIn.get(e.itemId) === e.containerId) this.richtigIn.delete(e.itemId);
    });
    bus.on("schrott:aufprall", (e) => {
      if (!zaehlt() || e.handle === undefined || !this.eigeneHandles.has(e.handle)) return;
      if (e.wucht < HART_AB_MS) return;
      // Faellt gerade das Wrack: der Fall zaehlt einmal, wenn er vorbei ist
      if (this.fall && e.handle === this.objekte.wracks[0]?.body.handle) this.fall.hart = true;
      else this.harteAufschlaege++;
    });
    bus.on("greifer:ueberlast", (e) => {
      if (!zaehlt()) return;
      if (!e.abgestuetzt) this.ueberlastFrei = true;
      // Ein Versuch, eine Meldung: was binnen UEBERLAST_PAUSE_S nach der letzten Meldung kommt, gehoert dazu
      const neu = this.zeitS - this.letzteUeberlastS >= UEBERLAST_PAUSE_S;
      this.letzteUeberlastS = this.zeitS;
      if (neu) this.ueberlasten++;
    });
    bus.on("wrack:geknautscht", (e) => {
      if (zaehlt() && this.eigeneHandles.has(e.handle)) this.knautschgrad = Math.max(this.knautschgrad, e.grad);
    });
    bus.on("fahrkunst:zyklus", (e) => {
      if (zaehlt()) this.zyklusGemessen(e);
    });
  }

  /** `challenge:start`, dann den ersten Schritt zeigen. */
  start(): void {
    if (this.laeuft || this.aus) return;
    this.laeuft = true;
    for (const t of this.objekte.teile) {
      if (t.body.isValid()) this.liegeY.set(t.id, t.body.translation().y);
    }
    const d = this.daten;
    this.bus.emit("challenge:start", { id: d.id, nr: this.nr, name: d.name, ziel: d.ziel, wertung: d.wertung });
    this.melde();
  }

  /** Nach ↻ oder Verlassen: ab jetzt stumm, zaehlt und meldet nichts mehr. */
  beenden(): void {
    this.aus = true;
  }

  get beendet(): boolean {
    return this.aus;
  }

  /** Einmal je Bild, ausserhalb der Pause. */
  takt(dt: number): void {
    if (!this.laeuft || this.aus || this.geschafft) return;
    this.zeitS += dt;
    const { jetzt, marken, imZiel } = this.beobachte(dt);
    // Was der Spieler schon richtig macht, wird uebersprungen: Ein spaeterer
    // Schritt, der schon zu sehen ist, nimmt die frueheren mit.
    this.daten.schritte.forEach((s, i) => {
      if (jetzt[s.beobachtet] && i > this.erreicht) this.erreicht = i;
    });
    const d = this.daten;
    this.bus.emit("challenge:stand", {
      id: d.id,
      zeitS: this.zeitS,
      zaehler: d.zaehlwort ? { ist: imZiel, von: this.pflichtIds.size, wort: d.zaehlwort } : null,
      balken01: d.plattAb !== undefined ? Math.min(1, this.knautschgrad) : null,
      pressenBereit: this.pressenBereit,
      tipp: d.tippNachUeberlast && this.ueberlastFrei ? d.tippNachUeberlast : null,
      marken,
    });
    this.melde();
  }

  /** Fahrkunst-Zyklus vom Bus. Gilt nur, wenn die Ladung am Ziel liegt. */
  zyklusGemessen(e: GameEvents["fahrkunst:zyklus"]): void {
    const z = this.daten.zielBehaelter;
    if (z ? this.q.ueberBehaelter(z, e) : this.q.ueberKammer(e)) this.zyklus = e;
  }

  /** Der Knopf PRESSEN darf auf die Karte: Wrack losgelassen in der Kammer, noch nicht gepresst. */
  get pressenBereit(): boolean {
    return this.inKammer && !this.gepresst && this.daten.schritte.some((s) => s.beobachtet === "wrack_gepresst");
  }

  /**
   * Darf die Presse jetzt laufen? Erst, wenn das Wrack losgelassen in der
   * Kammer ist — eine leere Presse waere kein Lernschritt.
   */
  pressenErlaubt(): boolean {
    if (this.inKammer) this.freigegeben = true;
    return this.inKammer;
  }

  /** `press.onStamp` — zaehlt nur nach einem freigegebenen Start. */
  presseHatGestempelt(): void {
    if (this.freigegeben && !this.aus) this.gepresst = true;
  }

  /** Was gerade zu sehen ist — und wo die Markierungen hingehoeren. */
  private beobachte(dt: number): { jetzt: Record<Beobachtung, boolean>; marken: Marke[]; imZiel: number } {
    const q = this.q;
    const d = this.daten;
    const griff = new Set(q.gegriffen().map((b) => b.handle));
    const marken: Marke[] = [];

    // --- Teile -----------------------------------------------------------
    const lebend = this.objekte.teile.filter((t) => t.body.isValid());
    const pflicht = lebend.filter((t) => this.pflichtIds.has(t.id));
    let gefasst: (typeof lebend)[number] | null = null;
    /*
     * Im Ziel heisst: losgelassen, in der Zone UND schon unter der Wandkrone
     * (qa-Befund 19.10.2026: Die Zone zaehlt das Teil, waehrend es noch ueber
     * der 2-m-Wand faellt — prallte es heraus, waere die Aufgabe trotzdem
     * geschafft). Mitte unter der Oberkante = es ist drin, nicht darueber.
     * Mit Ziel zaehlt der Behaelter des Teils, ohne (Aufgabe 3) die Mulde, in
     * der das Teil richtig ist (`itemEntered.correct`).
     */
    const imZiel = (t: { id: string; body: AufgabenKoerper }): boolean => {
      if (griff.has(t.body.handle)) return false;
      const c = q.behaelterVon(t.id);
      const z = this.zielJe.get(t.id);
      if (!c || (z ? c !== z : this.richtigIn.get(t.id) !== c)) return false;
      return t.body.translation().y < (q.behaelter(c)?.oberkante ?? Infinity);
    };
    for (const t of lebend) {
      const p = t.body.translation();
      if (griff.has(t.body.handle)) {
        gefasst ??= t;
        // Neu gegriffen: ein neuer Einwurf darf wieder als Fehlwurf zaehlen
        this.falschGezaehlt.delete(t.id);
        continue;
      }
      const alt = this.liegeY.get(t.id);
      if (alt === undefined || p.y < alt) this.liegeY.set(t.id, p.y);
      if (this.pflichtIds.has(t.id) && !imZiel(t)) marken.push({ x: p.x, y: p.y + this.liegeY.get(t.id)!, z: p.z, art: "teil" });
    }
    const teil = gefasst ?? pflicht.find((t) => !imZiel(t)) ?? null;
    const ziel = teil ? this.zielJe.get(teil.id) : undefined;
    const zielOrt = ziel ? q.behaelter(ziel) : null;
    if (gefasst && zielOrt) marken.push({ x: zielOrt.x, y: zielOrt.oberkante, z: zielOrt.z, art: "ziel" });

    let blick = false;
    let amTeil = false;
    let gehoben = false;
    let ueberZiel = false;
    if (teil) {
      const p = teil.body.translation();
      const m = q.drehmitte();
      const a = q.blickRad();
      const zuTeil = Math.atan2(p.x - m.x, p.z - m.z);
      blick = Math.abs(winkelDiff(a, zuTeil)) <= BLICK_TOLERANZ_RAD;
      const s = q.spinne();
      amTeil = Math.hypot(s.x - p.x, s.z - p.z) <= SPINNE_WAAGRECHT_M && s.y - p.y <= SPINNE_HOEHE_M;
      if (gefasst) {
        const liege = this.liegeY.get(teil.id) ?? p.y;
        // Unterkante ≈ Mitte − halbe Hoehe; liegend auf dem Boden (y 0) ist die Mitte die halbe Hoehe
        const unterkante = p.y - liege;
        gehoben = zielOrt ? unterkante >= zielOrt.oberkante + HUB_LUFT_M : unterkante >= HUB_OHNE_ZIEL_M;
        ueberZiel = !!ziel && q.ueberBehaelter(ziel, p);
      }
    }
    const nImZiel = pflicht.filter(imZiel).length;
    const alleImZiel = pflicht.length > 0 && nImZiel === pflicht.length;

    // --- Wrack (E-125; G3: Knautschen, Heben, Ablegen) ---------------------
    const w = this.objekte.wracks[0];
    const wb = w && w.body.isValid() ? w.body : null;
    const wp = wb?.translation();
    const wGefasst = !!wb && griff.has(wb.handle);
    this.inKammer = !!wb && !wGefasst && q.inKammer(wp!);
    let wGehoben = false;
    let abgelegt = false;
    if (wb && wp) {
      if (!wGefasst && (this.wrackLiegeY === null || wp.y < this.wrackLiegeY)) this.wrackLiegeY = wp.y;
      // Unter- und Oberkante aus den Kollidern; ohne Quelle die Mitte ueber der Liegehoehe
      const spanne = q.hoehenspanne?.(wb.handle) ?? { unten: wp.y - (this.wrackLiegeY ?? wp.y), oben: wp.y + WRACK_MARKE_OHNE_SPANNE_M };
      const a = d.ablageziel;
      const imKreis = !!a && d.ablageRadiusM !== undefined && Math.hypot(wp.x - a.x, wp.z - a.z) <= d.ablageRadiusM;
      if (wGefasst) {
        wGehoben = spanne.unten >= WRACK_HUB_M;
        if (wGehoben) this.wrackGehoben = true;
        // Gefasst aufgesetzt ausserhalb des Kreises: ab hier wird geschleift, nicht getragen
        else if (spanne.unten <= WRACK_LIEGT_M && !imKreis) this.wrackGehoben = false;
      }
      abgelegt = !wGefasst && this.wrackGehoben && imKreis && spanne.unten <= WRACK_LIEGT_M;
      // Fallhoehe: beim Loslassen merken, dann sehen, wo es liegen bleibt
      if (this.wrackWarGefasst && !wGefasst) this.fall = { ab: spanne.unten, tief: spanne.unten, s: 0, hart: false };
      if (wGefasst) this.fall = null;
      const f = this.fall;
      if (f) {
        f.tief = Math.min(f.tief, spanne.unten);
        f.s += dt;
        if (f.ab - f.tief >= FALLHOEHE_HART_M) f.hart = true;
        if (f.s >= FALL_BEOBACHTEN_S) {
          if (f.hart) this.harteAufschlaege++;
          this.fall = null;
        }
      }
      this.wrackWarGefasst = wGefasst;
      const fertig = this.inKammer || this.gepresst || abgelegt || (d.plattAb !== undefined && this.knautschgrad >= d.plattAb);
      if (!wGefasst && !fertig) marken.push({ x: wp.x, y: spanne.oben, z: wp.z, art: "teil" });
      if (d.zielMarke && (wGefasst || d.zielMarkeAbStart)) marken.push({ ...d.zielMarke, art: "ziel" });
    }

    return {
      jetzt: {
        blick_auf_teil: blick,
        spinne_am_teil: amTeil,
        teil_gefasst: !!gefasst,
        teil_gehoben: gehoben,
        teil_ueber_ziel: ueberZiel,
        teil_im_ziel: alleImZiel,
        wrack_gefasst: wGefasst,
        wrack_ueber_kammer: wGefasst && q.ueberKammer(wp!),
        wrack_in_kammer: this.inKammer,
        wrack_gepresst: this.gepresst,
        wrack_geknautscht: this.knautschgrad >= ANGEKNAUTSCHT_AB,
        wrack_platt: d.plattAb !== undefined && this.knautschgrad >= d.plattAb,
        wrack_gehoben: wGehoben,
        wrack_abgelegt: abgelegt,
      },
      marken,
      imZiel: nImZiel,
    };
  }

  /** Die Messung, wie sie jetzt steht. */
  messung(): ChallengeMessung {
    return {
      zeitS: this.zeitS,
      fehlwuerfe: this.fehlwuerfe,
      // ein Fall, der noch beobachtet wird, zaehlt schon, wenn er hart war (Aufgabe 6 endet beim Aufsetzen)
      harteAufschlaege: this.harteAufschlaege + (this.fall?.hart ? 1 : 0),
      praezisionCm: this.zyklus?.praezisionCm ?? null,
      ueberlasten: this.ueberlasten,
      fremdteile: this.fremdIn.size,
    };
  }

  private melde(): void {
    const n = this.daten.schritte.length;
    const nr = this.erreicht + 1;
    if (nr === this.gemeldet) return;
    this.gemeldet = nr;
    if (nr < n) {
      const s = this.daten.schritte[nr]!;
      this.bus.emit("challenge:schritt", {
        id: this.daten.id,
        nr: nr + 1,
        von: n,
        titel: s.titel,
        text: s.text,
        zeige: s.zeige,
      });
      return;
    }
    this.geschafft = true;
    const messung = this.messung();
    this.bus.emit("challenge:geschafft", {
      id: this.daten.id,
      name: this.daten.name,
      sterne: sterne(this.daten.wertung, messung),
      messung,
      wertung: this.daten.wertung,
    });
  }
}

/** Kleinster Winkel von b nach a, −π … π. */
function winkelDiff(a: number, b: number): number {
  let d = (a - b) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}
