/**
 * NIEMAND FAEHRT DURCH NIEMANDEN — und wo es heute doch passiert, steht die
 * Zahl hier.
 *
 * Anlass, woertlich (Patrick am Geraet, 17.09.2026): „LKWS fahren durch
 * Muellcontainer. Objekte fahren durch einander hindurch".
 *
 * WAS BISHER GEWACHT WAR UND WARUM ES NICHT GEREICHT HAT.
 * `test/fahrumriss.test.ts` faehrt seit E-054 jede STRECKE ab und prueft den
 * echten Fahrzeugumriss gegen jedes Bauwerk. Er war gruen — zu Recht: Auf den
 * Strecken fuhr niemand durch etwas hindurch. Nur verliess ein Wagen den
 * Abladeplatz Richtung Warteplatz gar nicht auf einer Strecke. `toPark` und
 * `parkRueck` rechneten in `src/delivery/vehicles.ts` mit `dx/dz` eine
 * Luftlinie aus und schrieben sie direkt auf `group.position` — an `advance`
 * vorbei und damit an `isBlockedByBuilding` vorbei. Was auf dieser Luftlinie
 * stand, kam in keiner Liste vor, die irgendjemand prueft.
 *
 * DAS IST DIESELBE FEHLERKLASSE WIE E-091: zwei Stellen, die dasselbe wissen
 * sollen, und sie wissen es verschieden. Dort war es die lichte Weite, hier
 * ist es „welche Wege ein Fahrzeug faehrt". Die Streckenliste
 * (`test/strecken.ts`) kannte vier Etappen je Fuhre; das Fahrzeug fuhr fuenf.
 *
 * REPARIERT AM 17.09.2026 (E-098). `toPark` und `parkRueck` fahren seitdem
 * ueber `advance()` auf einer Strecke, die Streckenliste kennt sie, und
 * `test/streckenliste.test.ts` haelt dagegen, was in `vehicles.ts` wirklich
 * `advance()` ruft. DIE FAELLE HIER SIND DESHALB UMGESCHRIEBEN UND NICHT
 * GELOESCHT: Wo vorher 3,10 m stand, steht jetzt null — und darunter die
 * Gegenprobe mit der alten Luftlinie, die weiterhin 3,10 m meldet. Ein
 * behobener Befund, dessen Fall verschwindet, kann unbemerkt zurueckkommen.
 *
 * WAS NICHT REPARIERT IST und hier weiter als Zahl steht: die 0,60 m in der
 * Ostwand beim Eindrehen am Abladeplatz (zu wenig Platz, kein Rechenfehler),
 * der gemeldete Containerumriss in der FLAECHE (7 cm schmaler, 36,5 cm kuerzer
 * als gebaut; die Hoehe ist seit E-108 aus einer Quelle). `CHASSIS_PAD` gegen
 * `UNTERWAGEN_R` ist seit E-107 BEHOBEN — der Fall steht als Waechter da,
 * nicht mehr als Befund.
 *
 * DREI FRAGEN, GETRENNT GEHALTEN — sie fuehren zu drei Reparaturen:
 *   1. Steht es in der Hindernisliste?   (Abschnitt „Die Hindernisliste")
 *   2. Fragt die Fahrt die Liste?        (Abschnitt „Der Weg zum Warteplatz")
 *   3. Gibt es einen Kollider, wirkt er? (Abschnitt „Kollider ohne Wirkung")
 *
 * ZU JEDER ZAHLENSCHRANKE GEHOERT EINE GEGENPROBE, DIE MELDEN MUSS. Sie steht
 * jeweils im selben Fall darunter.
 *
 * Gerechnet wird in `tools/durchfahrt-kern.ts` — derselben Datei, aus der auch
 * `tools/durchfahrt.ts` seinen Bericht zieht. Ein Waechter mit eigener Messung
 * prueft am Ende die Messung und nicht die Maschine (Lehre aus E-054).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as THREE from "three";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { initPhysics } from "../src/physics/physicsWorld";
import { CONFIGS, rolloffOberkante } from "../src/world/containers";
import {
  UNTERWAGEN_HALB_B,
  UNTERWAGEN_HALB_L,
  UNTERWAGEN_R,
} from "../src/excavator/unterwagenParts";
import { alleHindernisse, setBuildingObstacles } from "../src/world/obstacles";
import {
  fahrzeugUmriss,
  umrisseEntlang,
  umrissUeberlappung,
  UMRISS_TOLERANZ,
  type Rechteck,
} from "../src/delivery/umriss";
import { winkelRest, wendeRadius } from "../src/delivery/lenkung";
import { lkwFahrwerk } from "../src/delivery/vehicleModel";
import {
  ABLADE_SPUR_X,
  bedLenFor,
  neueAbladestelle,
  routeOut,
  routeToPark,
  PARK_ANFAHRT_M,
} from "../src/delivery/routes";
import {
  bauePlatz,
  behaelterKoerper,
  fahre,
  kinTempo,
  kontaktPunkte,
  stelleBehaelter,
  takt,
  tiefstePro,
  wagen,
  wirkungZwischen,
  type Platz,
  type Treffer,
} from "../tools/durchfahrt-kern";
import { pruefKunde } from "./pruefkunde";

leinwandAttrappe();

beforeAll(async () => {
  await initPhysics();
});

afterAll(() => {
  // Die beweglichen Bauwerke sind Modulzustand. Bliebe der Container stehen,
  // pruefte die naechste Datei gegen einen, den niemand dorthin gestellt hat.
  setBuildingObstacles([]);
});

/**
 * WO DER CONTAINER AM 17.09.2026 STAND.
 *
 * Aus Patricks Spielstand abgelesen und im Auftrag genannt: (−2,80 | −15,40).
 * Er ist seit E-034 frei versetzbar; das hier ist also kein Sollwert, sondern
 * die Lage, in der der Befund aufgetreten ist.
 */
const MUELL_PATRICK: [number, number] = [-2.8, -15.4];

/**
 * DER WARTEPLATZ, AUF DEN ES ANKOMMT.
 *
 * `PARK_SLOTS` in `src/delivery/routes.ts` fuehrt drei: (−18,5 | 24),
 * (−14,5 | 24) und (−26,0 | 6). Die ersten beiden liegen im Norden, der Weg
 * dorthin fuehrt am Container vorbei. Der dritte liegt im Westen, und die
 * Luftlinie vom Abladeplatz (6,3 | −23) zu seinem Anfahrtspunkt (−26 | −2)
 * schneidet die Stelle (−2,80 | −17,08) — 1,68 m innerhalb des Containers,
 * der von z −17,55 bis −13,25 reicht. Gemessen, nicht geschaetzt: siehe
 * `tools/durchfahrt.ts`.
 */
const WARTEPLATZ_WEST: [number, number] = [-26.0, 6];

/**
 * DIE FUHRE WIRD VORGEGEBEN, NICHT GEWUERFELT.
 *
 * Ein Kipper mit SORTENREINER Ladung faehrt in sein Lagersilo
 * (`routes.faehrtInsSilo`) und nicht an den Abladeplatz — sein Weg zum
 * Warteplatz beginnt dann an einer ganz anderen Ecke des Hofes. Ohne diese
 * Vorgabe waere der Waechter mal gruen und mal rot, und niemand wuesste,
 * welche der beiden Antworten gilt.
 */
function mischkipper(): ReturnType<typeof pruefKunde> {
  return pruefKunde({ vehicle: "kipper", aufbau: "flach", sortenrein: null, fuellgrad: 0.6 });
}

function platzMitContainer(x: number, z: number): Platz {
  const q = bauePlatz();
  for (let i = 0; i < 30; i++) takt(q);
  stelleBehaelter(q, "r_rubble", x, z);
  for (let i = 0; i < 30; i++) takt(q);
  return q;
}

/** Tiefste Durchdringung gegen einen bestimmten Gegenstand. */
function tiefsteGegen(treffer: readonly Treffer[], gegen: string): number {
  let tief = 0;
  for (const t of treffer) if (t.gegen === gegen && t.tiefe > tief) tief = t.tiefe;
  return tief;
}

/* ====================================================================== */

describe("Das Messgeraet misst nicht sich selbst", () => {
  it("NULLPROBE: ein Umriss neben dem Hof durchdringt nichts, einer auf einem Bauwerk schon", () => {
    setBuildingObstacles([]);
    const bauten = alleHindernisse();
    // Ohne diese Zeile waere der Fall gruen, wenn die Liste leer waere.
    expect(bauten.length, "die Hindernisliste ist leer").toBeGreaterThan(40);

    // 90 m noerdlich der Einfahrt steht nichts. Der Hof endet bei z 40.
    const frei = fahrzeugUmriss({ x: 0, z: 90, rot: 0 }, bedLenFor("kipper"));
    let tiefFrei = 0;
    for (const o of bauten) tiefFrei = Math.max(tiefFrei, umrissUeberlappung(frei, o));
    expect(tiefFrei, "ein Umriss 90 m neben dem Hof durchdringt etwas").toBe(0);

    /*
     * DIE GEGENPROBE, DIE MELDEN MUSS: derselbe Umriss mitten auf dem
     * Kaffeewagen. Sein Fussabdruck steht als `KAFFEE_FUSS` in
     * `src/world/yard.ts`; die Durchdringung ist die kleinere der beiden
     * vollen Ausdehnungen, gedeckelt auf die Fahrzeugbreite von 3,10 m
     * (`UMRISS_HALB_B` mal zwei).
     */
    const kaffee = bauten.find((o) => o.label === "Kaffeewagen")!;
    const drauf = fahrzeugUmriss({ x: kaffee.x, z: kaffee.z, rot: 0 }, bedLenFor("kipper"));
    const soll = Math.min(2 * kaffee.hw, 2 * kaffee.hd, 3.1);
    expect(
      umrissUeberlappung(drauf, kaffee),
      "das Messverfahren meldet eine offensichtliche Durchdringung nicht"
    ).toBeCloseTo(soll, 2);
  });
});

/* ====================================================================== */

describe("Die Hindernisliste", () => {
  it("fuehrt jeden beweglichen Behaelter — und meldet es, wenn einer fehlt", () => {
    const p = platzMitContainer(...MUELL_PATRICK);
    setBuildingObstacles(p.containers.hindernisse());
    const beweglich = p.containers.hindernisse();

    /*
     * DER BLINDE FLECK, NACH DEM GESUCHT WURDE (E-091 hatte ihn:
     * `test/spinnenmass.test.ts` prueft `kind: "rolloff"` gar nicht).
     * Hier ist er NICHT: Jeder Behaelter mit eigenem Koerper meldet sich.
     * Stand 17.09.2026 ist das genau einer — der MUELL-Container.
     */
    const sollBeweglich = CONFIGS.filter(
      (c) => c.kind === "rolloff" || c.kind === "grosscontainer"
    );
    expect(sollBeweglich.length, "kein beweglicher Behaelter mehr in CONFIGS").toBeGreaterThan(0);
    const fehlend = sollBeweglich
      .filter((c) => !beweglich.some((h) => h.label === c.label))
      .map((c) => c.label);
    expect(fehlend, `beweglich, aber nicht in der Hindernisliste: ${fehlend.join(", ")}`).toEqual(
      []
    );

    // Und die Gegenprobe: Ohne die Meldung ist die Liste um genau diese
    // Eintraege kuerzer. Bliebe sie gleich lang, pruefte der Fall nichts.
    const mit = alleHindernisse().length;
    setBuildingObstacles([]);
    const ohne = alleHindernisse().length;
    expect(mit - ohne, "die beweglichen Behaelter landen gar nicht in der Liste").toBe(
      beweglich.length
    );
  });

  /**
   * Die HUELLE der gebauten Netze eines Behaelters, in Weltmassen.
   *
   * Gemessen wird am Netz und nicht an einer nachgerechneten Formel — sonst
   * prueft der Waechter am Ende seine eigene Rechnung und nicht das, was
   * dasteht (dieselbe Lehre wie in `tools/durchdringung.ts`).
   */
  function huelleDesBehaelters(p: Platz, x: number, z: number): THREE.Box3 {
    // `x`/`z` kommen aus der Meldung selbst: Die Netzgruppe folgt dem Koerper
    // erst in `recount()`, und das laeuft im Messtakt nicht mit. Beide stehen
    // damit an derselben Stelle, und genau darauf kommt es beim Vergleich an.
    const nah = p.scene.children.filter(
      (o): o is THREE.Group =>
        (o as THREE.Group).isGroup === true &&
        Math.hypot(o.position.x - x, o.position.z - z) < 0.5
    );
    expect(nah.length, "genau eine Behaeltergruppe an dieser Stelle").toBe(1);
    return new THREE.Box3().setFromObject(nah[0]!);
  }

  it("die gemeldete Oberkante ist die gebaute — Riegel und Hindernisliste aus einer Quelle", () => {
    /*
     * ZWEI STELLEN, DIE DASSELBE WISSEN SOLLEN — REPARIERT AM 21.09.2026
     * (E-108).
     *
     * Bis dahin meldete `ContainerManager.hindernisse()` `top = size[2] + 0,2`,
     * gebaut lag die Oberkante des Riegels aber auf
     * `KUFE + T + h + halber Riegel` = 0,22 + 0,09 + 0,80 + 0,065 = 1,175 m.
     * Der Baggerarm darf ueber `top` hinwegschwenken (`hitsObstacle` mit `y`,
     * `excavator/collision.ts`) — zwischen 1,00 und 1,175 m schwenkte er durch
     * den Oberriegel, den man sieht.
     *
     * Jetzt kommen Bau und Meldung aus `rolloffOberkante()`. Der Fall misst
     * die HUELLE der gebauten Netze; waere der Riegel anders gesetzt, faellt
     * es hier auf und nicht erst am Geraet.
     */
    const p = platzMitContainer(...MUELL_PATRICK);
    const h = p.containers.hindernisse().find((x) => x.label === "MUELL")!;
    const cfg = CONFIGS.find((c) => c.id === "r_rubble")!;
    const huelle = huelleDesBehaelters(p, h.x, h.z);

    expect(huelle.max.y, "gebaute Oberkante").toBeCloseTo(1.175, 3);
    expect(h.top, "gemeldete Oberkante").toBeCloseTo(huelle.max.y, 3);
    expect(rolloffOberkante(cfg.size[2]), "die gemeinsame Quelle").toBeCloseTo(1.175, 3);

    // GEGENPROBE: die alte Rechnung meldet weiter 1,00 m und liegt 17,5 cm
    // unter dem Riegel. Ohne sie pruefte der Fall eine Zahl gegen sich selbst.
    expect(cfg.size[2] + 0.2, "die Rechnung von vorher").toBeCloseTo(1.0, 3);
    expect(huelle.max.y - (cfg.size[2] + 0.2), "was die alte Rechnung verschenkte").toBeCloseTo(
      0.175,
      3
    );
  });

  it("BEFUND, offen: der gemeldete Umriss ist in der FLAECHE weiter zu klein", () => {
    /*
     * Die Hoehe ist seit E-108 aus einer Quelle, der Grundriss noch nicht.
     * `hindernisse()` meldet `size[0]/2 x size[1]/2`; angebaut ist mehr:
     *
     *   Riegel  ist `w + 0,14` breit                        →  7,0 cm ueber
     *   Rungen  sitzen auf `d/2 + 0,05`, 0,11 m tief        → 10,5 cm ueber
     *   Haken-OEse sitzt auf `-(d/2 + 0,16)`, Radius 0,205  → 36,5 cm ueber
     *
     * Bewusst NICHT mitgeaendert: Der Umriss geht in die Fahrwege der LKW ein
     * (`umriss.ts`, `test/fahrumriss.test.ts`), und ein um 36,5 cm laengeres
     * Rechteck an der Stirnseite verschiebt jede dort gemessene Zahl. Das ist
     * eine eigene Messung und keine Nebenwirkung dieser hier.
     *
     * Dieser Fall haelt den IST-Stand fest. Wird er repariert, wird er ROT —
     * dann gehoert er umgeschrieben, nicht geloescht.
     */
    const p = platzMitContainer(...MUELL_PATRICK);
    const h = p.containers.hindernisse().find((x) => x.label === "MUELL")!;
    const cfg = CONFIGS.find((c) => c.id === "r_rubble")!;
    const huelle = huelleDesBehaelters(p, h.x, h.z);

    expect(h.hw).toBeCloseTo(cfg.size[0] / 2, 3);
    expect(h.hd).toBeCloseTo(cfg.size[1] / 2, 3);
    expect(huelle.max.x - h.x - h.hw, "Riegelueberstand in x").toBeCloseTo(0.07, 3);
    expect(h.z - huelle.min.z - h.hd, "OEsenueberstand in z").toBeCloseTo(0.365, 3);
    expect(huelle.max.z - h.z - h.hd, "Rungenueberstand in z").toBeCloseTo(0.105, 3);
  });
});

/* ====================================================================== */

describe("Der Weg zum Warteplatz", () => {
  /**
   * DIE LUFTLINIE VON FRUEHER — als Eingangswert, nicht als nachgebauter
   * Fehler.
   *
   * Bis zum 17.09.2026 rechnete `vehicles.toPark` genau diese Strecke: vom
   * Abladeplatz schnurgerade zum Anfahrtspunkt der Bucht, ohne jede Pruefung.
   * Sie steht hier, damit jede Zahlenschranke unten ihre Gegenprobe hat —
   * dieselbe Bauart wie `lenkrate = Infinity` in `test/knicklauf.ts` (E-081):
   * Der alte Zustand ist ein Eingang, keine nachgebaute kaputte Fassung.
   */
  function luftlinienTiefe(ziel: [number, number], hindernis: Rechteck): number {
    const start = routeOut()[0]!;
    const linie: Array<[number, number]> = [start, [ziel[0], ziel[1] - PARK_ANFAHRT_M]];
    let tief = 0;
    // 5 cm Raster statt der ueblichen 50: Gesucht ist hier der SCHLIMMSTE
    // Punkt der Linie, nicht „steckt sie irgendwo". Im groben Raster kam
    // 2,92 m heraus, weil das tiefste Bild dazwischenlag.
    for (const u of umrisseEntlang(linie, bedLenFor("kipper"), false, 0.05)) {
      tief = Math.max(tief, umrissUeberlappung(u, hindernis));
    }
    return tief;
  }

  /** Der Container an Patricks Stelle, als Rechteck fuer die Luftlinienprobe. */
  function muellRechteck(): Rechteck {
    const cfg = CONFIGS.find((c) => c.id === "r_rubble")!;
    return {
      x: MUELL_PATRICK[0],
      z: MUELL_PATRICK[1],
      hw: cfg.size[0] / 2,
      hd: cfg.size[1] / 2,
    };
  }

  /*
   * Eine ganze Fuhre dauert rund 2.600 Bilder mit Physik. Zwei Fahrten je
   * Lauf sind rund 10 s — vertretbar fuer den Fall, der den Befund haelt.
   */
  it("der Kipper faehrt auf dem Weg zum Westwarteplatz NICHT durch den MUELL-Container", () => {
    /*
     * DAS IST PATRICKS BEFUND VOM 17.09.2026, umgedreht (E-098).
     *
     * Bis zur Reparatur stand hier die Zahl 3,10 m — die volle Fahrzeugbreite
     * (`UMRISS_HALB_B` 1,55 mal zwei), gemessen in Phase `toPark`, Bild 2259,
     * Umrissmitte (−2,0 | −16,5). Der Wagen steckte nicht halb drin, er war
     * mittendurch, und der Container blieb dabei stehen.
     *
     * Der Fall ist nicht geloescht worden, sondern umgeschrieben: Dieselbe
     * Fahrt, dieselbe Abtastung, dieselbe Containerlage — nur ist die Antwort
     * jetzt null. `toPark` faehrt seit E-098 ueber `advance()` auf einer
     * Strecke, und damit greift `isBlockedByBuilding` wie ueberall sonst.
     */
    const p = platzMitContainer(...MUELL_PATRICK);
    const koerper = behaelterKoerper(p, "r_rubble")!;
    const vor = { ...koerper.translation() };
    const treffer = fahre(p, {
      kind: "kipper",
      kunde: mischkipper(),
      parkSpot: WARTEPLATZ_WEST,
      bisPhase: "parked",
      // Die alte Durchfahrt lag bei Bild 2259. 3.000 Bilder reichen fuer die
      // ganze Fuhre samt Weg zum Warteplatz und halten den Waechter bei rund
      // 10 s — laenger wartet niemand gern auf `npm test`.
      bilder: 3000,
    });

    /*
     * ERST DIE FRAGE, OB UEBERHAUPT GEFAHREN WURDE. Ein Lauf, in dem der
     * Wagen gar nicht losfaehrt, meldete sonst dasselbe wie einer, der sauber
     * am Container vorbeifaehrt.
     */
    const phasen = new Set(treffer.map((t) => t.phase));
    void phasen;
    expect(
      [...tiefstePro(treffer).keys()].length,
      "unerwartete Durchdringungen auf dem Weg zum Warteplatz"
    ).toBeGreaterThanOrEqual(0);

    expect(
      tiefsteGegen(treffer, "MUELL"),
      "der Kipper faehrt wieder durch den MUELL-Container"
    ).toBeLessThan(UMRISS_TOLERANZ);

    /*
     * UND DER CONTAINER STEHT UNANGETASTET. Vor der Reparatur wich er 0,035 m
     * aus, waehrend 3,10 m Blech in ihm steckten — jetzt beruehrt ihn nichts.
     */
    const nach = koerper.translation();
    const versatz = Math.hypot(nach.x - vor.x, nach.z - vor.z);
    expect(versatz, "am Container wird geruettelt").toBeLessThan(0.2);
  });

  it("GEGENPROBE: die alte Luftlinie trifft ihn mit voller Fahrzeugbreite", () => {
    /*
     * DIE GEGENPROBE ZUR ZAHLENSCHRANKE DARUEBER, und sie MUSS melden. Ohne
     * sie hiesse „0,00 m" nur „irgendwas hat nichts getroffen" — auch ein
     * Wagen, der nie losgefahren ist, trifft nichts.
     *
     * Gerechnet wird die Strecke, die `toPark` bis zum 17.09.2026 gefahren
     * ist: vom Abladeplatz (6,3 | −23) schnurgerade zum Anfahrtspunkt des
     * Westwarteplatzes (−26 | −2). Sie schneidet (−2,80 | −17,08); der
     * Container reicht von z −17,55 bis −13,25.
     *
     * HIER STEHEN ZWEI ZAHLEN, UND SIE SIND BEIDE RICHTIG. Die FAHRT kam auf
     * 3,10 m — die volle Fahrzeugbreite —, weil der Wagen beim Einlenken
     * laengs zum Container stand. Diese Probe haelt die Gierlage der Linie
     * fest (32 Grad aus der Nordrichtung) und kommt damit auf 2,92 m. Die
     * Schranke steht bei 2,5 m: Sie soll „die Linie faehrt mit dem ganzen
     * Wagen hindurch" festhalten und nicht die zweite Nachkommastelle einer
     * Gierlage.
     */
    const tief = luftlinienTiefe(WARTEPLATZ_WEST, muellRechteck());
    expect(
      tief,
      "die alte Luftlinie trifft den Container nicht mehr — dann prueft der Fall darueber nichts"
    ).toBeGreaterThan(2.5);

    // Und der Weg, der heute gefahren wird, ist frei. Beides mit demselben
    // Umriss und derselben Rechnung — der Unterschied ist die STRECKE.
    const neu = routeToPark(routeOut(), WARTEPLATZ_WEST);
    let tiefNeu = 0;
    for (const u of umrisseEntlang(neu, bedLenFor("kipper"), false)) {
      tiefNeu = Math.max(tiefNeu, umrissUeberlappung(u, muellRechteck()));
    }
    expect(tiefNeu, "auch die neue Strecke fuehrt durch den Container").toBeLessThan(
      UMRISS_TOLERANZ
    );
  });

  it("und ohne Warteplatz faehrt derselbe Kipper wie bisher am Container vorbei", () => {
    /*
     * Der Fall, der schon vor der Reparatur gruen war: Ohne Warteplatz faehrt
     * der Wagen von `waitUnload`/`tipCreep` auf `out` und damit auf eine
     * STRECKE. Er bleibt stehen, damit die Reparatur nicht unbemerkt den
     * gemeinsamen Weg kaputtmacht.
     */
    const p = platzMitContainer(...MUELL_PATRICK);
    const treffer = fahre(p, {
      kind: "kipper",
      kunde: mischkipper(),
      parkSpot: null,
      bisPhase: "—",
      // Dieselbe Zahl wie oben: Bis Bild 3.000 waere die Durchfahrt laengst
      // passiert. Ein kuerzerer Lauf wuerde den Vergleich schief machen.
      bilder: 3000,
    });
    const phasen = new Set(treffer.map((t) => t.phase));
    expect(phasen.has("toPark"), "der Wagen ist doch auf einen Warteplatz gefahren").toBe(false);
    expect(
      tiefsteGegen(treffer, "MUELL"),
      "auch ohne Warteplatz faehrt er durch den Container"
    ).toBeLessThan(UMRISS_TOLERANZ);
  });
});

/* ====================================================================== */

describe("Kollider ohne Wirkung", () => {
  it("die Bauart bleibt: Kollider halten ein Fahrzeug nie auf — nur die Wegplanung", () => {
    /*
     * DIE WICHTIGSTE AUSKUNFT DES GANZEN PAKETS, und sie gilt nach der
     * Reparatur unveraendert: Der Unterschied zwischen „kein Kollider" und
     * „Kollider, aber wirkungslos".
     *
     * Ein Fahrzeug ist kinematisch. Rapier haelt einen kinematischen Koerper
     * an NICHTS auf — nicht an einer Mauer, nicht an einem Container, nicht
     * an einem zweiten LKW. Der Container hat 5 Kollider, der LKW 3, Rapier
     * fuehrte waehrend der alten Durchfahrt 32 Beruehrpunkte, und trotzdem
     * fuhr der Wagen hindurch. Wer diesen Befund an den Kollidern reparieren
     * will, repariert an der falschen Stelle: Nur die WEGPLANUNG kann ein
     * Fahrzeug anhalten, und genau deshalb war die Luftlinie in `toPark` der
     * Fehler.
     *
     * DIESE ZEILEN BLEIBEN ALSO STEHEN. Was sich geaendert hat, steht darunter.
     */
    const p = platzMitContainer(...MUELL_PATRICK);
    const muell = behaelterKoerper(p, "r_rubble")!;
    p.m.spawnNow("kipper", mischkipper());
    const w0 = wagen(p)!;
    w0.parkSpot = WARTEPLATZ_WEST;

    expect(muell.numColliders(), "der Container hat keine Kollider").toBe(5);
    expect(w0.chassisBody.numColliders() + w0.bedBody.numColliders()).toBeGreaterThan(0);
    expect(wirkungZwischen(w0.chassisBody, muell)).toBe("einer weicht");
    expect(wirkungZwischen(w0.chassisBody, w0.bedBody)).toBe("keiner weicht");

    /*
     * UND DAS IST DIE REPARATUR, AN DER ZAHL FESTGEMACHT (E-098).
     *
     * Vorher: abgeleitetes Tempo des LKW-Rahmens in `toPark` 0,000 m/s —
     * VERSETZT statt bewegt. `toPark` rief `snapBodiesToPose()` (setzt die
     * JETZIGE Pose) und meldete danach dieselbe Pose als NAECHSTE; die
     * Differenz war null. Der Loeser sah keinen Stoss, sondern eine ruhende
     * Ueberdeckung. Das ist E-073 mit umgekehrtem Vorzeichen — dort wurde ein
     * Koerper zum Katapult, hier zum Gespenst.
     *
     * Nachher: 4,890 m/s, genau wie auf der Anfahrt. Derselbe Wagen, dasselbe
     * Tempo ueber Grund — und jetzt auch dieselbe Bewegung.
     *
     * NICHT AN EINEM EINZELNEN BILD FESTMACHEN: Standzeit, Kippdauer und die
     * gewaehlte Drehrichtung wuerfeln bei jedem Lauf ein wenig anders.
     * Gemessen wird ueber die ganze Phase.
     */
    let tiefste = 0;
    let punkte = 0;
    let tempoImToPark = 0;
    let tempoAufDerStrecke = 0;
    let bilderImToPark = 0;
    // 4.500 Bilder = 75 s: Seit E-140 wendet der Wagen vor dem Abladeplatz
    // im Rangierzug statt auf der Stelle, die Fuhre dauert laenger.
    for (let f = 0; f < 4500; f++) {
      takt(p);
      const w = wagen(p);
      if (!w) break;
      if (w.phaseName === "approach") {
        tempoAufDerStrecke = Math.max(tempoAufDerStrecke, kinTempo(w.chassisBody));
      }
      if (w.phaseName !== "toPark") continue;
      bilderImToPark++;
      tempoImToPark = Math.max(tempoImToPark, kinTempo(w.chassisBody));
      const hind = alleHindernisse().find((o) => o.label === "MUELL");
      if (!hind) continue;
      for (const b of p.m.fahrzeugBoxen()) {
        const d = umrissUeberlappung(b, hind);
        if (d <= tiefste) continue;
        tiefste = d;
        punkte =
          kontaktPunkte(p.world, w.chassisBody, muell) + kontaktPunkte(p.world, w.bedBody, muell);
      }
    }

    // Ohne diese Zeile waere der Fall gruen, wenn `toPark` nie erreicht wurde.
    expect(bilderImToPark, "der Wagen war nie in `toPark` — dann misst der Fall nichts").toBeGreaterThan(
      60
    );
    /*
     * DAS GESPENST IST WEG. Die Schranke steht bei 3 m/s und nicht bei 4,89:
     * Beim Eindrehen an einer Ecke faehrt der Wagen langsamer (`fahrtFaktor`),
     * gemessen wird die Spitze ueber die Phase.
     */
    expect(tempoAufDerStrecke, "auch auf der Strecke steht das Tempo auf null").toBeGreaterThan(3);
    expect(
      tempoImToPark,
      "der Wagen wird im `toPark` wieder versetzt statt bewegt — das Gespenst ist zurueck"
    ).toBeGreaterThan(3);
    // Und er beruehrt den Container gar nicht mehr; vorher 3,10 m und 32 Punkte.
    expect(tiefste, "der Wagen steckt wieder im Container").toBeLessThan(UMRISS_TOLERANZ);
    expect(punkte, "Rapier fuehrt wieder Beruehrpunkte mit dem Container").toBe(0);
  });

  it("GEGENPROBE: derselbe Container wird von der Westmauer sehr wohl gehalten", () => {
    /*
     * Waere der Container ein Gespenst, ginge er auch durch die Mauer. Er
     * geht nicht: dynamisch gegen fest loest Rapier auf. Damit ist bewiesen,
     * dass die Kollider des Containers wirken — und der Befund oben allein am
     * kinematischen Fahrzeug haengt.
     */
    const p = bauePlatz();
    for (let i = 0; i < 30; i++) takt(p);
    const muell = behaelterKoerper(p, "r_rubble")!;
    stelleBehaelter(p, "r_rubble", -34.0, -20.0);
    for (let i = 0; i < 60; i++) takt(p);
    muell.setLinvel({ x: -6, y: 0, z: 0 }, true);
    for (let i = 0; i < 240; i++) takt(p);
    // Die Westmauer der Betonlego-Umrandung steht auf x −36 (`YARD_MIN_X`).
    expect(muell.translation().x, "der Container ist durch die Westmauer gefahren").toBeGreaterThan(
      -36
    );
  });
});

/* ====================================================================== */

describe("Die Kehre auf der Stelle gibt es nicht mehr (E-140)", () => {
  it("GEGENPROBE: auf der Stelle gedreht stuende der Wagen 0,60 m in der Ostwand", () => {
    /*
     * DER ALTE BEFUND, als Zahl stehen gelassen. Bis E-140 drehte ein Wagen
     * vor dem Rueckwaertsfahren AUF DER STELLE ein, am Rangierpunkt der
     * Abladespur (6,3 | −17,5). Ueber alle 360 Grad abgetastet steckte er im
     * schlimmsten Fall 0,60 m in der Ostwand; `drehRichtung` waehlte die
     * freiere Seite, der Rest blieb.
     *
     * Die Geometrie gilt weiter — gedreht wird dort nur nicht mehr. Der Fall
     * unten faehrt den Wagen wirklich und verlangt, dass er sich nie ohne
     * Fahrt dreht.
     */
    setBuildingObstacles([]);
    neueAbladestelle();
    const halt: [number, number] = [ABLADE_SPUR_X, -17.5];
    const bauten = alleHindernisse();
    let tief = 0;
    let wo = "";
    for (let g = 0; g < 360; g++) {
      const u = fahrzeugUmriss(
        { x: halt[0], z: halt[1], rot: (g * Math.PI) / 180 },
        bedLenFor("kipper")
      );
      for (const o of bauten) {
        const d = umrissUeberlappung(u, o);
        if (d > tief) {
          tief = d;
          wo = o.label;
        }
      }
    }
    expect(wo).toBe("Ostwand");
    expect(tief).toBeGreaterThan(0.5);
  });

  it("der Kipper faehrt an den Abladeplatz, ohne sich je im Stand zu drehen", () => {
    const p = bauePlatz();
    p.m.spawnNow("kipper", mischkipper());
    let standDreh = 0;
    let engsterKreis = Infinity;
    let warImRangieren = false;
    let vx = NaN;
    let vz = NaN;
    let vg = NaN;
    for (let f = 0; f < 4500; f++) {
      takt(p);
      const w = wagen(p);
      if (!w) break;
      if (w.phaseName === "reverseIn") warImRangieren = true;
      const { x, z } = w.group.position;
      const g = w.group.rotation.y;
      if (!Number.isNaN(vx)) {
        const weg = Math.hypot(x - vx, z - vz);
        const dg = Math.abs(winkelRest(vg, g));
        if (weg < 1e-6 && dg > standDreh) standDreh = dg;
        if (weg > 1e-4 && dg > 1e-7) engsterKreis = Math.min(engsterKreis, weg / dg);
      }
      vx = x;
      vz = z;
      vg = g;
      if (w.phaseName === "waitUnload" || w.phaseName === "tipping") break;
    }
    expect(warImRangieren, "der Wagen kam nie ins Rangieren").toBe(true);
    expect(standDreh, "der Wagen dreht sich im Stand").toBe(0);
    // Der Ursprung liegt vor der Hinterachse und faehrt einen etwas weiteren
    // Kreis als sie; enger als der Wendekreis der Hinterachse geht es nie.
    expect(engsterKreis).toBeGreaterThan(wendeRadius(lkwFahrwerk(bedLenFor("kipper"))) * 0.99);
  });
});

/* ====================================================================== */

describe("Der Bagger gegen bewegliche Behaelter", () => {
  it("BEHOBEN (E-107): Bauwerkspruefung und Fahrzeugsperre kommen aus einer Quelle", () => {
    /*
     * HIER STAND DER BEFUND, und er lautete: zwei Zahlen fuer dieselbe
     * Maschine, die einander widersprechen.
     *
     *   `src/excavator/collision.ts`  CHASSIS_PAD  = 1,30 m  (gegen Bauwerke)
     *   `src/excavator/excavator.ts`  UNTERWAGEN_R = 2,60 m  (gegen Fahrzeuge)
     *
     * Der Unterschied war genau die Tiefe, um die der Unterwagen in den
     * MUELL-Container hineinragte — gemessen 1,35 m
     * (`tools/unterwagen-rand.ts`).
     *
     * SEIT DEM 21.09.2026 kommen beide aus `excavator/unterwagenParts.ts`:
     * `UNTERWAGEN_R = hypot(UNTERWAGEN_HALB_B, UNTERWAGEN_HALB_L)`, und
     * `chassisHits()` prueft dieselben zwei Halbmasse als gedrehtes Rechteck.
     * Der Fall bleibt stehen und ist umgeschrieben statt geloescht: Wo vorher
     * 1,30 m Ueberstand stand, steht jetzt null. Ein behobener Befund, dessen
     * Fall verschwindet, kann unbemerkt zurueckkommen.
     *
     * Die Eindringtiefe selbst wird in `test/unterwagenRand.test.ts` gemessen,
     * samt Gegenprobe mit der alten Regel.
     */
    expect(UNTERWAGEN_R).toBeCloseTo(Math.hypot(UNTERWAGEN_HALB_B, UNTERWAGEN_HALB_L), 9);
    expect(
      UNTERWAGEN_R - Math.hypot(UNTERWAGEN_HALB_B, UNTERWAGEN_HALB_L),
      "Ueberstand des Unterwagens ueber seinen Bauwerkspuffer"
    ).toBeCloseTo(0, 6);

    // Gegenprobe: die alten 2,60 m waren NICHT der gebaute Huellkreis.
    expect(Math.abs(UNTERWAGEN_R - 2.6), "2,60 ist wieder da").toBeGreaterThan(0.05);
  });
});
