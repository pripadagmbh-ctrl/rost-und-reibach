/**
 * Kundschaft des Platzes (Briefing Kap. 26, Fassung 02.09.2026).
 *
 * Drei Gruppen liefern an, und sie unterscheiden sich in allem: Menge,
 * Material, Fahrzeug, Preiswissen, Verhandlungsstil und darin, was sie sich
 * merken.
 *
 *   PRIVAT    kleine Mengen, wechselnde Gesichter, kein Preiswissen. Bringen
 *             unwissentlich Störstoff mit und merken sich grob, ob man sie
 *             fair behandelt hat.
 *   HAENDLER  Stammfiguren aus wiederkehrenden Familien. Kennen jeden Preis,
 *             drücken hart zurück, sind lang nachtragend.
 *   GEWERBE   Betriebe, liefern sortenrein je Branche. Der Preis ist ihnen
 *             zweitrangig, entscheidend ist ein reibungsloser Ablauf.
 *
 * Ton-Leitplanke (verbindlich): Das Milieu entsteht aus Beruf, Familie und
 * Geschäft — nie aus Herkunft. Keine Gruppe wird als kriminell markiert.
 */

import {
  baueFuhre,
  rollAufbau,
  rollFuellgrad,
  ladeHoeheGrenze,
  BED_LEN,
  LADE_RAND,
  LKW_HALB_BREITE,
  WAND_HOEHE,
  FUELL_KLASSEN,
  type Aufbau,
  type Fahrzeugart,
} from "./fuellgrad";
import type { Aussehen, KundenEintrag } from "./aussehen";
import { KATALOG_BIG, KATALOG_HUGE, type PileSpec } from "../world/objektkatalog";
import { packeLadung, stueckMass } from "./ladung";
import { WOHNWAGEN_DEF } from "../dismantle/carDef";

export type CustomerGroup = "privat" | "haendler" | "gewerbe";

export interface CustomerProfile {
  group: CustomerGroup;
  /** Anzeigename am Fahrzeug und in Meldungen */
  name: string;
  /** Untertitel: Familie, Branche oder Herkunftsort */
  subtitle: string;
  /** Liefermenge in kg — folgt aus Füllgrad × Laderaum × Schüttdichte */
  massKg: number;
  /** Fahrzeug, mit dem er kommt — steht vor der Menge fest, denn es bestimmt sie */
  vehicle: Fahrzeugart;
  /** Aufbau der Ladefläche (nur Händler fahren Rungen oder Koffer) */
  aufbau: Aufbau;
  /** Wie voll die Ladefläche ist (0–1) — das, was der Spieler sieht */
  fuellgrad: number;
  /** Schüttdichte der Ladung in kg/m³ */
  dichte: number;
  /** Fraktion, wenn sortenrein geliefert wird; sonst null für Mischladung */
  sortedMaterial: string | null;
  /** Anteil Störstoff an der Ladung */
  contaminantShare: number;
  /** 1 = lässt sich alles gefallen, 5 = drückt hart zurück */
  hardness: number;
  /** Spruch bei der Ankunft */
  greeting: string;
  /**
   * Wie der Mensch aussieht, der aus dem Wagen steigt.
   *
   * PFLICHTIG, aus demselben Grund wie `vehicle` weiter unten: Ein Kunde ohne
   * Aussehen ist kein Kunde, sondern ein halbes Profil, und ein Rückfall
   * („dann nimm halt die Standardfigur") wäre die zweite Stelle, die dasselbe
   * zu wissen meint. Prüfstände nehmen `AUSSEHEN_NEUTRAL` aus `aussehen.ts`.
   */
  aussehen: Aussehen;
  /**
   * DIE EINZELSTÜCK-FUHRE (E-126): Der Wagen bringt genau dieses eine Teil
   * und sonst nichts. Fehlt das Feld, ist es eine gewöhnliche Fuhre.
   * Optional, damit Prüfstände ihre Profile nicht anfassen müssen.
   */
  einzelstueck?: PileSpec;
  /**
   * Was der Abschlepper bringt, wenn es kein Pkw ist (E-135). Fehlt das
   * Feld, liegt ein Altauto auf der Brücke — wie bisher.
   */
  wrackArt?: "wohnwagen";
}

/**
 * Die Händlerfamilien. Wiederkehrende Stammfiguren, die sich untereinander
 * kennen.
 *
 * ERSTFASSUNG — Vornamen, Alter und Marotten sind Platzhalter aus dem
 * Charakter-Briefing (Kap. 26.7, noch offen). Zum Überschreiben gedacht:
 * gesetzt sind bisher nur die Familiennamen.
 */
export interface Family {
  family: string;
  firstName: string;
  /** 1–5, wie hart verhandelt wird */
  hardness: number;
  /** Was dieser Händler typischerweise bringt */
  typical: string | null;
  greetings: string[];
  /**
   * Wie er aussieht — fest, nicht gewürfelt. Willi ist immer Willi, sonst
   * kann man ihn sich nicht merken (`offene-punkte.md`: „Der rote mit dem
   * kurzen Kran, der bringt immer Alu").
   */
  aussehen: Aussehen;
}

/*
 * DIE ACHT HÄNDLER, UND WIE SIE AUSSEHEN (15.09.2026).
 *
 * Gelesen wird die Tabelle so: `groesse` in Metern, `fuelle` 0 = dünn bis
 * 1 = dick, `pflege` 0 = ölig bis 1 = frisch, `haut`/`haar` sind Indizes in
 * die Tafeln in `aussehen.ts`.
 *
 * Die Zahlen sind von Hand gesetzt (SW) — sie sind CHARAKTER, kein Balancing:
 * Wer Willi kleiner haben will, ändert eine Zahl. Was sie nicht dürfen, ist
 * ein Muster bilden: Über alle 23 Kunden hinweg darf keine dieser Spalten mit
 * Gruppe oder Härtegrad zusammenhängen. Nachgerechnet wird das von
 * `aussehensBefunde()`, bewacht von `test/kundenaussehen.test.ts`.
 *
 * Man sieht es an den beiden Enden: Willi Bäring (Härte 5) ist ölig, Heiner
 * Prieser (Härte 5) ist der gepflegteste Mann auf dem Hof — und beide drücken
 * gleich hart. Genau das ist die Absicht.
 */
export const FAMILIES: Family[] = [
  {
    family: "Bäring",
    firstName: "Willi",
    hardness: 5,
    typical: null,
    greetings: ["Na, was zahlst du heute?", "Ich hab was Gutes dabei.", "Der Preis von gestern gilt noch?"],
    // Klein, breit, seit dreißig Jahren dieselbe Jacke. Goldkette über dem Kragen.
    aussehen: { groesse: 1.66, fuelle: 0.8, pflege: 0.2, haut: 1, haar: 3, jacke: 0, weste: false, merkmal: "goldkette" },
  },
  {
    family: "Lorsbach",
    firstName: "Kurt",
    hardness: 4,
    typical: "steel",
    greetings: ["Volle Fuhre, wie besprochen.", "Wiegen wir gleich?", "Steht alles bereit?"],
    // Lang und dürr, Weste an, Mütze auf, immer pünktlich.
    aussehen: { groesse: 1.88, fuelle: 0.25, pflege: 0.8, haut: 0, haar: 1, jacke: 3, weste: true, merkmal: "muetze" },
  },
  {
    family: "Prieser",
    firstName: "Heiner",
    hardness: 5,
    typical: null,
    greetings: ["Du kennst mich ja.", "Machen wir es kurz.", "Was geht heute?"],
    // Der Gepflegteste — und der Härteste. Schwere Uhr am Handgelenk.
    aussehen: { groesse: 1.9, fuelle: 0.3, pflege: 0.9, haut: 2, haar: 0, jacke: 1, weste: false, merkmal: "uhr" },
  },
  {
    family: "Hardwig",
    firstName: "Rudi",
    hardness: 3,
    typical: "alu",
    greetings: ["Alles sauber getrennt.", "Nur das Gute heute.", "Wo soll ich hin?"],
    // Groß, kräftig, dreckig — und der Schäferhund sitzt im Haus.
    aussehen: { groesse: 1.85, fuelle: 0.7, pflege: 0.25, haut: 0, haar: 2, jacke: 0, weste: true, merkmal: "hund" },
  },
  {
    family: "Boxmann",
    firstName: "Ewald",
    hardness: 4,
    typical: "steel",
    greetings: ["Schwer beladen, pass auf.", "Der Kipper ist randvoll.", "Lange Fahrt gehabt."],
    // Klein und rund, kommt von weit her und sieht auch so aus.
    aussehen: { groesse: 1.62, fuelle: 0.85, pflege: 0.2, haut: 3, haar: 4, jacke: 4, weste: false, merkmal: "keins" },
  },
  {
    family: "Zöllner",
    firstName: "Fritz",
    hardness: 5,
    typical: "copper",
    greetings: ["Guck erst mal rein.", "Das ist was Feines.", "Nicht drücken heute."],
    // Bauchtasche mit dem Papierkram, immer griffbereit.
    aussehen: { groesse: 1.74, fuelle: 0.6, pflege: 0.45, haut: 1, haar: 3, jacke: 2, weste: true, merkmal: "bauchtasche" },
  },
  {
    family: "Adorf",
    firstName: "Manni",
    hardness: 3,
    typical: null,
    greetings: ["Zusammengesammelt die Woche.", "Bisschen von allem.", "Passt das so?"],
    // Lang, dünn, sauber — sammelt die Woche über zusammen.
    aussehen: { groesse: 1.7, fuelle: 0.2, pflege: 0.85, haut: 2, haar: 1, jacke: 1, weste: false, merkmal: "uhr" },
  },
  {
    family: "Schmikatz",
    firstName: "Toni",
    hardness: 4,
    typical: "va",
    greetings: ["Sortenrein, wie immer.", "Da staunst du.", "Was bietest du?"],
    // Mittelmaß in allem, und genau deshalb erkennt man ihn an der Weste.
    aussehen: { groesse: 1.78, fuelle: 0.45, pflege: 0.35, haut: 3, haar: 2, jacke: 2, weste: true, merkmal: "keins" },
  },
];

/**
 * Gewerbekunden nach Branche. Jede Branche bringt ihr eigenes Material —
 * sortenrein, weil es im Betrieb schon getrennt anfällt.
 */
export interface Trade {
  name: string;
  material: string;
  /** Anteil Beifang, der nicht zur Hauptfraktion gehört */
  beifang: number;
  greetings: string[];
  /** Der Mensch, der den Firmenwagen fährt — fest je Betrieb. */
  aussehen: Aussehen;
}

export const TRADES: Trade[] = [
  {
    name: "Gießerei Hallmann",
    material: "steel",
    beifang: 0.25, // Schlacke kommt als Beifang mit
    greetings: ["Guss und Schlacke, wie immer.", "Der Ofen war gut ausgelastet."],
    aussehen: { groesse: 1.72, fuelle: 0.75, pflege: 0.3, haut: 2, haar: 0, jacke: 3, weste: true, merkmal: "keins" },
  },
  {
    name: "Dreherei Kessel",
    material: "steel",
    beifang: 0.05, // Späne sind sauber, aber ölig
    greetings: ["Späne, noch ölig.", "Frisch aus der Halle."],
    aussehen: { groesse: 1.66, fuelle: 0.35, pflege: 0.2, haut: 3, haar: 2, jacke: 1, weste: false, merkmal: "muetze" },
  },
  {
    name: "Maschinenbau Voigt",
    material: "steel",
    beifang: 0.12,
    greetings: ["Große Teile heute, Vorsicht.", "Zwei Motoren sind dabei."],
    aussehen: { groesse: 1.9, fuelle: 0.55, pflege: 0.6, haut: 0, haar: 3, jacke: 0, weste: true, merkmal: "keins" },
  },
  {
    name: "Kfz-Werkstatt Rehm",
    material: "alu",
    beifang: 0.18,
    greetings: ["Felgen und Kleinkram.", "Wenig, aber gut."],
    aussehen: { groesse: 1.8, fuelle: 0.25, pflege: 0.85, haut: 1, haar: 1, jacke: 2, weste: false, merkmal: "uhr" },
  },
  {
    name: "Elektro Sander",
    material: "cable",
    beifang: 0.15,
    greetings: ["Kabel vom Umbau.", "Kupferanteil ist ordentlich."],
    aussehen: { groesse: 1.6, fuelle: 0.7, pflege: 0.9, haut: 3, haar: 4, jacke: 2, weste: true, merkmal: "bauchtasche" },
  },
  {
    name: "Schlosserei Timm",
    material: "va",
    beifang: 0.06,
    greetings: ["V2A, sauber getrennt.", "Wie immer sortenrein."],
    aussehen: { groesse: 1.86, fuelle: 0.2, pflege: 0.55, haut: 1, haar: 0, jacke: 3, weste: false, merkmal: "hund" },
  },
  {
    name: "Abbruch Kranz",
    material: "steel",
    beifang: 0.32, // viel Störstoff aus dem Abriss
    greetings: ["Heizkörper und Rohre.", "Da ist auch Dreck dabei, ich weiß."],
    aussehen: { groesse: 1.68, fuelle: 0.85, pflege: 0.15, haut: 0, haar: 3, jacke: 4, weste: true, merkmal: "goldkette" },
  },
];

/**
 * Herkunftsorte für Privatleute: Mönchengladbacher Stadtteile und die
 * Nachbarorte am Niederrhein. Die Kundschaft kommt aus der Gegend, nicht
 * von irgendwoher — das verankert den Platz da, wo er steht.
 */
const PRIVAT_ORTE = [
  // Mönchengladbacher Stadtteile
  "aus Eicken",
  "aus Rheydt",
  "aus Hardt",
  "aus Neuwerk",
  "aus Odenkirchen",
  "aus Giesenkirchen",
  "aus Lürrip",
  "aus Waldhausen",
  "aus Windberg",
  "aus Wickrath",
  "aus Venn",
  "aus Hehn",
  "aus Holt",
  "aus Bettrath",
  "aus Schelsen",
  "vom Westend",
  "vom Bunten Garten",
  "aus dem Volksgarten",
  // Nachbarschaft
  "aus Korschenbroich",
  "aus Viersen",
  "aus Jüchen",
  "aus Wegberg",
  "aus Schwalmtal",
  "aus Willich",
  "aus Erkelenz",
];

/**
 * Die Privatleute.
 *
 * Bis 15.09.2026 war das eine nackte Namensliste. Jetzt ist es dieselbe Liste
 * mit Gesicht — die Namen sind Wort für Wort unverändert geblieben, dazu ist
 * nur gekommen, wie der Mensch dahinter aussieht.
 *
 * Sie kommen seltener wieder als die Händler, und trotzdem gehört das Aussehen
 * an den Namen und nicht an den Zufall: Wer Frau Öztürk zweimal im Monat sieht,
 * soll sie wiedererkennen.
 */
export interface Privatmensch {
  name: string;
  aussehen: Aussehen;
}

export const PRIVATLEUTE: Privatmensch[] = [
  {
    name: "Herr Kowalik",
    aussehen: { groesse: 1.84, fuelle: 0.3, pflege: 0.25, haut: 3, haar: 1, jacke: 0, weste: false, merkmal: "muetze" },
  },
  {
    name: "Frau Dettmer",
    aussehen: { groesse: 1.62, fuelle: 0.7, pflege: 0.85, haut: 0, haar: 4, jacke: 1, weste: true, merkmal: "keins" },
  },
  {
    name: "Herr Sievers",
    aussehen: { groesse: 1.92, fuelle: 0.85, pflege: 0.55, haut: 1, haar: 0, jacke: 2, weste: false, merkmal: "goldkette" },
  },
  {
    name: "Frau Lindqvist",
    aussehen: { groesse: 1.7, fuelle: 0.2, pflege: 0.45, haut: 2, haar: 2, jacke: 3, weste: true, merkmal: "uhr" },
  },
  {
    name: "Herr Baumgart",
    aussehen: { groesse: 1.58, fuelle: 0.55, pflege: 0.2, haut: 1, haar: 3, jacke: 4, weste: false, merkmal: "hund" },
  },
  {
    name: "Frau Öztürk",
    aussehen: { groesse: 1.8, fuelle: 0.4, pflege: 0.9, haut: 3, haar: 0, jacke: 4, weste: true, merkmal: "bauchtasche" },
  },
  {
    name: "Herr Reinhold",
    aussehen: { groesse: 1.74, fuelle: 0.75, pflege: 0.35, haut: 0, haar: 3, jacke: 0, weste: false, merkmal: "keins" },
  },
  {
    name: "Frau Waldmann",
    aussehen: { groesse: 1.88, fuelle: 0.35, pflege: 0.6, haut: 2, haar: 1, jacke: 1, weste: true, merkmal: "keins" },
  },
];

const PRIVAT_SPRUECHE = [
  "Keller ausgeräumt.",
  "Was ist das denn wert?",
  "Lag alles noch in der Scheune.",
  "Meine Frau wollte das weghaben.",
  "Ist da was Gutes dabei?",
  "Sagen Sie einfach, wo hin.",
];

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/**
 * Unter dieser Menge fährt niemand vor.
 *
 * Bis 15.09.2026 stand hier 600 kg — als gewürfelte Untergrenze (E-030). Seit
 * die Masse aus dem Füllgrad folgt, ist sie keine Regel mehr, sondern ein
 * Ergebnis: Ein viertelvoller PKW-Anhänger mit viel Holz und Kunststoff wiegt
 * rechnerisch 280 kg, und das ist richtig so — der Füllgrad gewinnt
 * (Ansage Patrick 15.09.2026). Geblieben ist nur die Notbremse: Wer für eine
 * Handvoll Blech den Weg auf sich nimmt, ist kein Kunde.
 *
 * SW. Betroffen ist allein der Privatmann im Viertel-Fall; jeder LKW liegt
 * um Größenordnungen darüber.
 */
export const MINDEST_FUHRE_KG = 300;

/**
 * Fahrzeug zur Kundschaft würfeln. Steht vor der Menge, weil es sie bestimmt:
 * Ein PKW-Anhänger fasst 2,4 m³, ein Kipper mit Rungen 20 m³.
 */
function rollFahrzeug(group: CustomerGroup): Fahrzeugart {
  if (group === "privat") {
    // PKW mit Anhänger oder Kastenwagen. Gelegentlich schleppt jemand ein
    // Altauto an — dann kommt der Abschleppwagen.
    return Math.random() < 0.15 ? "wrack" : "pkw";
  }
  /*
   * Der Betrieb ruft, wenn sein Container voll ist — und oft IST es ein
   * Container: Dann bringt ihn der Absetzkipper (E-141). SW: 30 % der
   * Gewerbefuhren, der Rest wie bisher im Verhaeltnis 65 : 35.
   */
  if (group === "gewerbe") {
    const g = Math.random();
    return g < 0.3 ? "absetzer" : g < 0.3 + 0.7 * 0.65 ? "kipper" : "pritsche";
  }
  // Händler: alles unterwegs, was Räder hat
  const r = Math.random();
  return r < 0.5 ? "kipper" : r < 0.85 ? "pritsche" : "wrack";
}

/**
 * Die Ladung eines Kunden bestimmen — Füllgrad zuerst, Masse zuletzt.
 *
 * Reihenfolge (Ansage Patrick 15.09.2026): Wie voll ist die Ladefläche? Wie
 * groß ist sie bei diesem Wagen? Was wiegt das Material, das darin liegt?
 * Erst daraus kommen die Kilogramm.
 */
function fuhreFuer(
  group: CustomerGroup,
  sortedMaterial: string | null,
  contaminantShare: number
): {
  vehicle: Fahrzeugart;
  aufbau: Aufbau;
  fuellgrad: number;
  massKg: number;
  dichte: number;
} {
  const vehicle = rollFahrzeug(group);
  const aufbau = rollAufbau(group);
  /*
   * Die Mulde kommt, wenn sie voll ist (E-141): Ein Containerdienst holt
   * keine viertelvolle Mulde ab. SW: drei Viertel bis randvoll — sonst kaeme
   * ein Dreiachser mit 540 kg, und unter 600 kg faehrt kein LKW vor
   * (`test/lademenge.test.ts`).
   */
  const fuellgrad =
    vehicle === "absetzer"
      ? FUELL_KLASSEN.dreiviertel.von + Math.random() * (FUELL_KLASSEN.randvoll.bis - FUELL_KLASSEN.dreiviertel.von)
      : rollFuellgrad(group);
  const fuhre = baueFuhre({
    kind: vehicle,
    aufbau,
    fuellgrad,
    hauptfraktion: sortedMaterial,
    stoerstoffAnteil: contaminantShare,
  });
  return {
    vehicle,
    aufbau,
    fuellgrad: fuhre.fuellgrad,
    massKg: Math.max(MINDEST_FUHRE_KG, fuhre.massKg),
    dichte: fuhre.dichte,
  };
}

/**
 * Nächsten Kunden würfeln.
 *
 * Die Mischung ist bewusst ungleich: Händler bringen die großen Mengen und
 * tragen den Umschlag, Privatleute sorgen für Abwechslung und Kleinkram,
 * Gewerbe liefert das sortenreine Material, mit dem sich sauber verdienen
 * lässt.
 */
export function rollCustomer(): CustomerProfile {
  const r = Math.random();
  // Weniger Privatleute (Wunsch 10.09.2026): Sie bringen Kleinkram im
  // Anhaenger, und wenn jeder Dritte einer ist, steht der Platz voller
  // Kofferraumladungen. Ein Schrottplatz lebt vom Haendler — der bringt die
  // Fuhren, an denen Schere und Presse ueberhaupt lohnen.
  if (r < 0.18) return rollPrivat();
  if (r < 0.78) return rollHaendler();
  return rollGewerbe();
}

function rollPrivat(): CustomerProfile {
  // Haushaltsauflösung ist immer gemischt, und Privatleute bringen
  // unwissentlich Störstoff mit: Holz, Kunststoff, Reifen. Der Störstoff frisst
  // Volumen und wiegt fast nichts — ihr Anhänger sieht voller aus, als er wiegt.
  const contaminantShare = 0.15 + Math.random() * 0.2;
  const fuhre = fuhreFuer("privat", null, contaminantShare);
  const p = pick(PRIVATLEUTE);
  return {
    group: "privat",
    name: p.name,
    subtitle: pick(PRIVAT_ORTE),
    /*
     * Die Menge wird nicht mehr gewürfelt, sie wird gerechnet (Ansage Patrick
     * 15.09.2026): „Es ist halt bei Händlern halt auch nicht immer das
     * Gewicht, sondern eher das Volumen auf der Ladefläche."
     *
     * Ein PKW-Anhänger fasst 2,4 m³ (1,74 m innen × 2,0 m nutzbar × 0,69 m
     * Ladehöhe, Maße aus `vehicleModel.buildCarAndTrailer`). Voll mit
     * gemischtem Haushaltsschrott sind das rund 1,3 t, ein Viertel voll rund
     * 350 kg. Der Privatmann bleibt damit das untere Ende der Spanne, ohne
     * dass eine Zahl das anordnet.
     */
    massKg: fuhre.massKg,
    vehicle: fuhre.vehicle,
    aufbau: fuhre.aufbau,
    fuellgrad: fuhre.fuellgrad,
    dichte: fuhre.dichte,
    sortedMaterial: null,
    contaminantShare,
    hardness: HAERTE_PRIVAT,
    greeting: pick(PRIVAT_SPRUECHE),
    aussehen: p.aussehen,
  };
}

function rollHaendler(): CustomerProfile {
  const f = pick(FAMILIES);
  // Auch wenn er eine Vorliebe hat: der Händler nimmt mit, was er kriegt
  const sortedMaterial = f.typical && Math.random() < 0.45 ? f.typical : null;
  const contaminantShare = 0.05 + Math.random() * 0.08;
  const fuhre = fuhreFuer("haendler", sortedMaterial, contaminantShare);
  return {
    group: "haendler",
    name: f.firstName,
    subtitle: f.family,
    /*
     * „Eigentlich kommen Händler erst, wenn ihre LKWs randvoll sind."
     * Zwei von drei Fuhren sind deshalb randvoll (siehe `FUELL_GEWICHTE`).
     * Was das wiegt, hängt am Aufbau und am Material: ein flacher Kipper voll
     * Mischschrott rund 8 t, derselbe Wagen mit Rungen wäre über 12 t — da
     * geht vorher die Nutzlast aus, und dann liegt die Ladung flacher.
     */
    massKg: fuhre.massKg,
    vehicle: fuhre.vehicle,
    aufbau: fuhre.aufbau,
    fuellgrad: fuhre.fuellgrad,
    dichte: fuhre.dichte,
    sortedMaterial,
    contaminantShare,
    hardness: f.hardness,
    greeting: pick(f.greetings),
    aussehen: f.aussehen,
  };
}

function rollGewerbe(): CustomerProfile {
  const t = pick(TRADES);
  // Der Betrieb ruft, wenn sein Container voll ist — nicht, wenn der LKW voll
  // ist. Deshalb streut sein Füllgrad breiter als der des Händlers.
  const fuhre = fuhreFuer("gewerbe", t.material, t.beifang);
  return {
    group: "gewerbe",
    name: t.name,
    subtitle: "Gewerbe",
    massKg: fuhre.massKg,
    vehicle: fuhre.vehicle,
    aufbau: fuhre.aufbau,
    fuellgrad: fuhre.fuellgrad,
    dichte: fuhre.dichte,
    sortedMaterial: t.material,
    contaminantShare: t.beifang,
    hardness: HAERTE_GEWERBE, // sachlich, wenig Spielraum
    greeting: pick(t.greetings),
    aussehen: t.aussehen,
  };
}

/**
 * DIE GANZE KUNDSCHAFT AUF EINEN BLICK — 8 Händler, 7 Betriebe, 8 Privatleute.
 *
 * Kein zweiter Datenbestand, sondern eine Ansicht auf die drei Listen weiter
 * oben. Sie ist die Grundlage des Ton-Wächters (`aussehensBefunde`): Der muss
 * ALLE Kunden zugleich sehen können, sonst kann er nicht prüfen, ob sich über
 * die Gruppen hinweg ein Muster gebildet hat.
 *
 * Der Härtegrad von Gewerbe und Privat stand bis hierher als nackte 1 bzw. 2
 * mitten in `rollPrivat`/`rollGewerbe`. Er hat jetzt einen Namen und steht an
 * EINER Stelle — sonst hätte diese Ansicht ihn abschreiben müssen, und beim
 * nächsten Balancing wäre genau die Abschrift stehengeblieben.
 */
export const HAERTE_GEWERBE = 2;
export const HAERTE_PRIVAT = 1;

export function alleKunden(): KundenEintrag[] {
  return [
    ...FAMILIES.map((f) => ({
      name: `${f.firstName} ${f.family}`,
      gruppe: "haendler",
      haerte: f.hardness,
      aussehen: f.aussehen,
    })),
    ...TRADES.map((t) => ({
      name: t.name,
      gruppe: "gewerbe",
      haerte: HAERTE_GEWERBE,
      aussehen: t.aussehen,
    })),
    ...PRIVATLEUTE.map((p) => ({
      name: p.name,
      gruppe: "privat",
      haerte: HAERTE_PRIVAT,
      aussehen: p.aussehen,
    })),
  ];
}

/**
 * Fahrzeugart, die zu dieser Kundschaft passt.
 *
 * Seit 15.09.2026 steht sie schon im Profil: Das Fahrzeug bestimmt den
 * Laderaum und damit die Menge, es muss also VOR der Menge feststehen.
 *
 * HIER STAND EIN `?? rollFahrzeug(c.group)`, UND ES WAR EIN FEHLER (E-044).
 *
 * Gemeint war es als Bequemlichkeit für von Hand gebaute Profile aus Tests
 * und Tutorial. Was es tat, war schlimmer als ein Absturz: Es WÜRFELTE das
 * Fahrzeug. Ein Prüfstand, dessen einziger Zweck der Kipper ist, bekam
 * dadurch zwei Wochen lang gelegentlich eine Pritsche untergeschoben, und der
 * Wächter war trotzdem grün. Dieselbe Klasse Selbsttäuschung wie ein Wächter,
 * der `NaN` vergleicht.
 *
 * Außerdem ist ein Profil ohne Fahrzeug nicht unvollständig, sondern
 * WIDERSPRÜCHLICH: Seine Kilogramm sind aus einem Laderaum gerechnet, den es
 * angeblich nicht gibt. Da ist nichts zu retten, also wird auch nichts
 * gerettet. Das Feld ist pflichtig, der Typlauf über `test/` (E-038) setzt es
 * durch, und wer es mit einer Umtypung umgeht, bekommt es gesagt.
 */
/* ------------------------------------------- Die Einzelstück-Fuhre ------- */

/**
 * EIN LASTER, EIN GROSSES TEIL (E-126).
 *
 * Patrick, 06.10.2026: „Die Schrottsorten sollen mehr grossteile beinhalten,
 * container, gerüste, kleine bagger." E-123 hat sie in den Katalog gebracht
 * und gemessen, dass die schweren fast nie ankommen (Absetzmulde und beide
 * Minibagger 0,04 bis 0,08 je 100 Fuhren): In einer Schüttgutfuhre teilen sie
 * sich die Ziehung mit über hundert anderen Teilen, und auf einer flachen
 * Pritsche sind sie zu hoch für „Bordwand + 0,35 m". Ein Teil, das nie
 * ankommt, gibt es für den Spieler nicht.
 *
 * Darum eine eigene Fuhre: eine flache Pritsche, ohne Kran, mit genau einem
 * Stück. Allein auf der Fläche darf es höher sein (`ladeHoeheGrenze`).
 */

/**
 * Welche Bauarten als Einzelstück kommen — Patricks drei Wörter, als Daten:
 * Container (`container`, `mulde`, `deckelmulde`), Gerüste (`geruest`,
 * `geruestfeld`), kleine Bagger (`minibagger`, `raupe`). Ein neuer
 * Katalogeintrag mit einer dieser Bauarten kommt von selbst mit.
 */
export const EINZELSTUECK_BAU: ReadonlySet<string> = new Set([
  "container",
  "mulde",
  "deckelmulde",
  "geruest",
  "geruestfeld",
  "minibagger",
  "raupe",
]);

/** Die Fläche der Einzelstück-Pritsche: flach, LKW-Breite, erhöhte Grenze. */
export const EINZELSTUECK_FLAECHE = {
  halbBreite: LKW_HALB_BREITE,
  nutzLaenge: BED_LEN.pritsche - 2 * LADE_RAND,
  maxHoehe: ladeHoeheGrenze(WAND_HOEHE.flach, true),
};

/**
 * Die Teile, die als Einzelstück kommen können. Drei Bedingungen, keine
 * davon eine neue Zahl:
 *
 *   1. ein Großteil (`KATALOG_BIG`/`KATALOG_HUGE`) mit einer Bauart aus
 *      `EINZELSTUECK_BAU`;
 *   2. es liegt allein auf der Pritsche — gerechnet von `packeLadung`, wie
 *      beim Beladen; die 2,40 m breiten Seecontainer scheitern weiter an
 *      der Breite (E-106: 0,20-m-Raster samt `ladung.LUFT`);
 *   3. es wiegt mindestens `MINDEST_FUHRE_KG` — für 105 kg Gerüstfeld fährt
 *      niemand einen Lkw vor. Die leichten Teile kommen weiter in der
 *      gemischten Fuhre.
 */
export const EINZELSTUECKE: readonly PileSpec[] = [...KATALOG_BIG, ...KATALOG_HUGE].filter(
  (sp) =>
    EINZELSTUECK_BAU.has(sp.bau ?? "") &&
    sp.massKg >= MINDEST_FUHRE_KG &&
    packeLadung(
      [stueckMass(sp.kind, sp.dims)],
      EINZELSTUECK_FLAECHE.halbBreite,
      EINZELSTUECK_FLAECHE.nutzLaenge,
      EINZELSTUECK_FLAECHE.maxHoehe
    )[0] !== null
);

/**
 * Anteil der Einzelstück-Fuhren an allen Anlieferungen.
 *
 * // SW: 0,35 — gerechnet aus dem Ziel des Auftrags zu E-126: Jedes Teil aus
 * `EINZELSTUECKE` soll in einer Sandkastenstunde im Mittel mindestens einmal
 * kommen. Angenommen ist eine Fuhre alle drei Minuten (12,6 Stück je Fuhre,
 * E-106, bei rund einem Griff je 15 s — Schwenk allein 3,7 bis 7,6 s, E-122;
 * gemessen 12 je Stunde, wenn niemand ablädt, E-122) und eine Einzelstück-
 * Fuhre in anderthalb Minuten (ein Griff). Bei 0,35 sind das 24 Fuhren in
 * der Stunde, 8,5 davon Einzelstücke, je Teil der acht 1,06. Bei 0,30 wären
 * es 0,88 — knapp darunter. `test/einzelstueck.test.ts` rechnet nach.
 */
export const EINZELSTUECK_ANTEIL = 0.35;

/** Was der Fahrer sagt — Geschäft und Baustelle, sonst nichts. */
const EINZELSTUECK_SPRUECHE = [
  "Nur ein Stück heute, aber ein großes.",
  "Kommt von einer Baustellenräumung.",
  "Der Verleiher wollte es nicht mehr reparieren.",
];

/**
 * Eine Einzelstück-Fuhre würfeln. Der Händler bringt sie — er „nimmt mit,
 * was er kriegt" (siehe `rollHaendler`), auch ein ausgemustertes Gerät.
 */
export function rollEinzelstueck(): CustomerProfile {
  const f = pick(FAMILIES);
  const teil = pick(EINZELSTUECKE as PileSpec[]);
  const s = stueckMass(teil.kind, teil.dims);
  const flaeche = EINZELSTUECK_FLAECHE.halbBreite * 2 * EINZELSTUECK_FLAECHE.nutzLaenge;
  return {
    group: "haendler",
    name: f.firstName,
    subtitle: f.family,
    // Die Waage wiegt das Teil — keine Schüttung, kein Füllgrad-Rechnen.
    massKg: teil.massKg,
    vehicle: "pritsche",
    // Flach: Über Rungen oder Koffer müsste die Spinne ein Teil von 2 t
    // herausheben, das die Wände knapp freilassen.
    aufbau: "flach",
    // Was man sieht: die belegte Grundfläche.
    fuellgrad: (s.breite * s.laenge) / flaeche,
    dichte: teil.massKg / (s.breite * s.laenge * s.hoehe),
    sortedMaterial: null,
    // Seine Fremdstoffe stehen in der Zusammensetzung des Teils, nicht als Beifang.
    contaminantShare: 0,
    hardness: f.hardness,
    greeting: pick(EINZELSTUECK_SPRUECHE),
    aussehen: f.aussehen,
    einzelstueck: teil,
  };
}

/**
 * Wer als Nächstes ans Tor kommt: mit `EINZELSTUECK_ANTEIL` eine
 * Einzelstück-Fuhre, sonst die gewohnte Kundschaft. `rollCustomer` selbst
 * bleibt die Schüttgut-Kundschaft — seine Wächter (Füllgrad, Dichte, Menge)
 * gelten für sie unverändert.
 */
export function rollAnlieferung(): CustomerProfile {
  const r = Math.random();
  if (r < EINZELSTUECK_ANTEIL) return rollEinzelstueck();
  // Oberes Ende derselben Zahl: Die Einzelstücke und der Zufallsstrom davor
  // bleiben, wie sie waren (E-135).
  if (r >= 1 - WOHNWAGEN_ANTEIL) return rollWohnwagen();
  return rollCustomer();
}

/**
 * WIE OFT EIN WOHNWAGEN KOMMT (E-135). Patrick, 17.10.2026: „ab und zu bringt
 * jmd auch nen wohnwagen zum verschrotten".
 *
 * // SW: einer je Sandkastenstunde. Gerechnet wie `EINZELSTUECK_ANTEIL`: 24
 * Ankünfte je Stunde (E-126), davon 1/24. Er nimmt seinen Anteil der
 * gewohnten Kundschaft weg, nicht den Einzelstücken.
 */
export const WOHNWAGEN_ANTEIL = 1 / 24;

/** Was der Besitzer sagt — Familie und Alltag, sonst nichts. */
const WOHNWAGEN_SPRUECHE = [
  "Die Kinder fahren nicht mehr mit.",
  "Stand zwölf Jahre im Garten.",
  "Das Dach war schon lange undicht.",
  "Der TÜV hat abgewunken.",
];

/**
 * Ein Privatmann gibt seinen Wohnwagen ab. Er kommt auf dem Abschlepper —
 * dieselbe Fuhre wie ein Altauto, nur liegt etwas anderes auf der Brücke.
 * Warum nicht als Anhänger hinter dem Pkw: Der Pkw-Anhänger ist ein fest
 * gebautes Fahrzeugteil mit Gelenk; ein Wohnwagen dort wäre das Wrack selbst
 * am Haken — ein neuer Ablauf in `vehicles.ts` und `vehicleModel.ts`.
 */
export function rollWohnwagen(): CustomerProfile {
  const p = pick(PRIVATLEUTE);
  const fuhre = baueFuhre({ kind: "wrack", fuellgrad: 1, hauptfraktion: null, stoerstoffAnteil: 0 });
  return {
    group: "privat",
    name: p.name,
    subtitle: pick(PRIVAT_ORTE),
    // Die Waage wiegt, was der Datensatz wiegt — eine Zahl, eine Stelle.
    massKg: WOHNWAGEN_DEF.totalMassKg,
    vehicle: "wrack",
    aufbau: "flach",
    fuellgrad: fuhre.fuellgrad,
    dichte: fuhre.dichte,
    sortedMaterial: null,
    contaminantShare: 0,
    hardness: HAERTE_PRIVAT,
    greeting: pick(WOHNWAGEN_SPRUECHE),
    aussehen: p.aussehen,
    wrackArt: "wohnwagen",
  };
}

/* ------------------------------------------------- Der Abholfahrer ------- */

/**
 * ACHIM KURTENBACH — der Fahrer, der den Container holt.
 *
 * Entscheidung Patrick, 15.09.2026: Der Abholer wird **ein wiederkehrender
 * Fahrer mit Namen** statt einer Rolle. Ausdruecklich verworfen: „mehrere,
 * wechselnd" — auf diesem Hof steht jeden Tag derselbe Wagen mit demselben
 * Mann darin, und man erkennt ihn an der Stimme, nicht am Schriftzug.
 *
 * Gebaut ist er wie die Haendlerfamilien weiter oben in dieser Datei: ein
 * Datensatz mit Namen, Milieu und Spruechen, aus dem `pick()` zieht. Keine
 * zweite Bauweise daneben.
 *
 * WER ER IST. Achim Kurtenbach, 54, faehrt den Abrollkipper fuer die
 * Spedition seines Schwagers in Wickrath (Ortsliste dieser Datei). Kommt
 * jeden Tag auf denselben Hof, kennt die Wege, redet wenig und nie umsonst.
 * Kaffeebecher in der Tuerablage, Tochter Lena macht naechstes Jahr Abitur
 * und uebt gerade Fahrstunden, und zur Dauerbaustelle auf der A61 hat er eine
 * Meinung.
 *
 * TON-LEITPLANKE (Projektregel 7, hier woertlich genommen): Das Milieu
 * entsteht aus BERUF, FAMILIE und GESCHAEFT — Standzeit, Lieferschein,
 * Fahrstunde, Stau. Nie aus Herkunft. Er ist Dienstleister und Bekannter
 * zugleich: knapp, routiniert, freundlich, nicht geschwaetzig. Kein Spruch
 * von ihm bewertet den Spieler, keiner deutet etwas an.
 *
 * WAS ER NICHT HAT (Ansage Patrick, mehrfach: „Kreislaufsachen noch nicht"):
 * keinen Preis, keinen Ruf-Wert, keine Verhandlung, kein Konto. Er hat eine
 * Stimme — mehr nicht. In diesem Abschnitt steht kein Eurozeichen.
 */
export interface Abholfahrer {
  /** Wie er sich am Funk meldet — das steht vor dem Spruch im HUD. */
  funkname: string;
  /** Vollstaendig, fuer Papiere und spaetere Verwendung am Wagen. */
  name: string;
  /** Milieu: Beruf, Familie, Geschaeft. */
  subtitle: string;
  /**
   * Ankunft AN EINEM SILO. Der Ort kommt aus dem Schild des Behaelters und
   * aus keiner zweiten Liste (E-056) — deshalb Vorlagen, keine festen Saetze.
   */
  amSchild: Array<(schild: string) => string>;
  /** Alles andere: feste Saetze je Lage. */
  sprueche: Record<Fahrerlage, string[]>;
}

/**
 * Die Lagen, in denen er etwas sagt — und nur die, die es wirklich gibt.
 *
 *   angekommen        er steht am Halteplatz und meldet, wo (E-056)
 *   wartet            es wird beladen, er hat Standzeit
 *   abfahrtVoll       beladen vom Hof
 *   abfahrtLeer       leer vom Hof — seit E-064 sichtbar als „0 kg abgeholt"
 *   containerZurueck  er hatte Platzinventar auf der Flaeche und setzt es
 *                     leer wieder ab (E-034)
 */
export type Fahrerlage =
  | "angekommen"
  | "wartet"
  | "abfahrtVoll"
  | "abfahrtLeer"
  | "containerZurueck";

export const ABHOLFAHRER: Abholfahrer = {
  funkname: "Achim",
  name: "Achim Kurtenbach",
  subtitle: "Abrollkipper, Spedition aus Wickrath",
  /*
   * Diese drei Vorlagen stehen seit E-056 im Spiel und sind am Geraet
   * abgenommen — sie bleiben Wort fuer Wort, wie sie sind. Neu ist nur, wer
   * sie sagt.
   */
  amSchild: [
    (s) => `Bin am ${s}.`,
    (s) => `Steh am ${s}, kannst kommen.`,
    (s) => `${s}, ich warte.`,
  ],
  sprueche: {
    // Ankunft ohne Schild: vorn beim Bagger, wo kein Silo steht. Ebenfalls
    // seit E-056 unveraendert.
    angekommen: [
      "Bin vorn bei dir, Motor laeuft.",
      "Steh am Abladeplatz, lad auf.",
      "Bin da, laengsseits wie immer.",
    ],
    // Standzeit. Er draengelt nicht — Draengeln waere eine Aufforderung, und
    // der Spieler soll hier in Ruhe arbeiten koennen.
    wartet: [
      "Lass dir Zeit, ich hab noch Standzeit.",
      "Kaffee ist noch warm, mach in Ruhe.",
      "Pack ruhig voll, die Achsen halten das.",
      "Ich warte. Die A61 ist eh wieder dicht.",
    ],
    abfahrtVoll: [
      "Passt so. Bis morgen, selbe Zeit.",
      "Ist gesichert, ich fahr raus.",
      "Gute Fuhre. Ich melde mich.",
      "Muss los, Lena hat gleich Fahrstunde.",
    ],
    // Leer wieder raus (E-064). Kein Vorwurf: Eine Leerfahrt ist sein
    // Berufsrisiko, nicht das Versagen des Spielers.
    abfahrtLeer: [
      "Leer wieder raus. Kommt vor.",
      "Nichts drin. Ruf an, wenn was liegt.",
      "Dann schreib ich Standzeit auf.",
      "Kein Gramm drauf. Bis morgen.",
    ],
    // Platzinventar (E-034): Der Muellcontainer faehrt nicht mit. Er kippt
    // ihn aus und setzt die leere Wanne wieder ab.
    containerZurueck: [
      "Wanne ist leer, steht wieder bei dir.",
      "Abfall ist runter, Wanne steht vorn.",
      "Ausgekippt. Die Wanne steht wieder da.",
    ],
  },
};

/**
 * Was Achim in dieser Lage durchgibt.
 *
 * Man darf es UEBERHOEREN. Eine Zeile im Durchlauf, nichts zum Wegklicken,
 * nichts, was stehen bleibt — wer nicht hinhoert, sucht halt.
 *
 * DER ORT KOMMT AUS DEM SCHILD, nicht aus einer zweiten Liste (E-056).
 * Uebergeben wird das `label` des Behaelters, also genau das, was an der
 * Mulde steht; ein neues Silo bekommt seinen Spruch damit von selbst richtig.
 * Bei einer Abholung ohne Lagersilo (Stahlschrott, Mischschrott, „Gemischt")
 * ist es `null` — dann steht er vorn beim Bagger. Das Schild zaehlt nur bei
 * der Ankunft: Wo er steht, ist beim Losfahren keine Frage mehr.
 *
 * Ton: Funkverkehr auf einem Platz, kein Ansagetext. Kurz, gesprochen, aus
 * dem Mund eines Fahrers, der seit dreissig Jahren Container faehrt.
 */
export function fahrerfunk(lage: Fahrerlage, schild: string | null = null): string {
  if (lage === "angekommen" && schild) return pick(ABHOLFAHRER.amSchild)(schild);
  return pick(ABHOLFAHRER.sprueche[lage]);
}

/**
 * DER ANLIEFERER HAT ES EILIG (E-082).
 *
 * Achim ist der Abholfahrer; er faehrt fuer den Hof und hat Standzeit. Der
 * ANLIEFERER ist ein Kunde: Er steht mit seiner eigenen Fuhre da, will sie
 * loswerden und hat einen Tag vor sich. Bis heute konnte er unbegrenzt am
 * Abladeplatz stehen — im kopflosen Lauf zehn Minuten, und weil der Platz
 * einspurig ist (E-029), kam solange kein zweites Fahrzeug.
 *
 * Zwei Lagen, zwei kurze Saetze — gesprochen, nicht angesagt, und ohne
 * Vorwurf: Dass er wieder mitnimmt, was er gebracht hat, ist sein Geschaeft,
 * nicht das Versagen des Spielers (dieselbe Haltung wie bei Achims
 * `abfahrtLeer`).
 *
 *   wartetLange        die Mahnung, eine Minute vor Schluss
 *   faehrtUnverrichtet er faehrt — mit der Fuhre, die noch oben liegt
 *
 * WER es sagt, steht im Kundenprofil (`CustomerProfile.name`); es gibt hier
 * absichtlich keine zweite Namensliste (Lehre aus E-066).
 */
export type Anliefererlage = "wartetLange" | "faehrtUnverrichtet" | "muldeAbgesetzt";

export const ANLIEFERER_SPRUECHE: Record<Anliefererlage, string[]> = {
  wartetLange: [
    "Wie lange brauchst du noch?",
    "Ich muss gleich weiter.",
    "Hab noch einen Termin heute.",
    "Sag an, ich hab's eilig.",
  ],
  faehrtUnverrichtet: [
    "Ich nehm die Fuhre wieder mit.",
    "Bleibt drauf. Ich fahr.",
    "Dann eben ein andermal.",
    "Zu lange gestanden. Bis dann.",
  ],
  // E-141: Der Absetzkipper laesst seine Mulde stehen
  muldeAbgesetzt: [
    "Mulde steht hinten. Wenn sie leer ist, hol ich sie.",
    "Die Mulde bleibt da. Ruf, wenn sie leer ist.",
    "Ich stell sie euch hin. Bis nachher.",
  ],
};

/** Was der Anlieferer in dieser Lage sagt. Eine Zeile, zum Ueberhoeren. */
export function anliefererfunk(lage: Anliefererlage): string {
  return pick(ANLIEFERER_SPRUECHE[lage]);
}

/**
 * Die Ankunftsmeldung — der Fall, den es seit E-056 gibt.
 *
 * Bleibt als eigener Name stehen, weil genau an ihm die Kopplung an das
 * Schild haengt und `test/abholplatz.test.ts` sie dort prueft.
 */
export function abholerFunk(schild: string | null): string {
  return fahrerfunk("angekommen", schild);
}

/*
 * HIER STAND `ABHOLER_FUNKNAME = "Abholer"` — eine Rolle, kein Mensch.
 *
 * Ersatzlos gestrichen und nicht etwa auf „Achim" umgebogen: Wer da funkt,
 * steht seit dem 15.09.2026 in `ABHOLFAHRER.funkname`, und zwei Namen fuer
 * denselben Mann sind genau die zweite Liste, die beim naechsten Umbau
 * zurueckbleibt.
 */

export function vehicleForCustomer(c: CustomerProfile): Fahrzeugart {
  if (!c.vehicle) {
    throw new Error(
      `Kundenprofil ohne Fahrzeug: "${c.name}". Das Fahrzeug bestimmt den Laderaum ` +
        `und damit die Menge — es gehört ins Profil (siehe fuhreFuer/rollCustomer).`
    );
  }
  return c.vehicle;
}
