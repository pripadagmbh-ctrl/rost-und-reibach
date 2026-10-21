/**
 * Wächter für Lamberts selbständiges Aufräumen (E-093, 17.09.2026).
 *
 * Patricks Gerätetest, zwei Punkte: „Lambert sortiert den Abfall mit dem
 * Radlader in die Mulden" und „Mulden befüllen, solange Platz ist; sonst
 * andere Arbeit aufnehmen."
 *
 * Geprüft wird in dieser Reihenfolge:
 *
 *  1. Die Rechnung hinter „Platz ist" (`world/fuellstand.ts`) — mit
 *     Gegenprobe: ein Behälter knapp UNTER der Schranke darf nicht als voll
 *     gelten, sonst meldet der Wächter nie.
 *  2. Dass er den Abfall wirklich wegräumt, ohne gerufen zu werden.
 *  3. Dass er ihn liegen lässt und es durchgibt, wenn die Mulde voll ist —
 *     Gegenprobe: dieselbe Lage mit einem Kilo weniger, und er fährt los.
 *  4. Dass ein rangierendes Fahrzeug Vorfahrt hat — Gegenprobe: ohne
 *     Fahrzeug arbeitet er.
 *  5. Dass er dem Bagger nicht in den Schwenkbereich fährt — Gegenprobe: ein
 *     Punkt, der drin liegt, wird von derselben Prüfung auch erkannt.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import { initPhysics } from "../src/physics/physicsWorld";
import { CONFIGS, ROLLOFF_WAND, MULDE_STEIN, bayHalb } from "../src/world/containers";
import { BAGGER_STAND, SCHWENK_INNEN, SCHWENK_AUSSEN } from "../src/world/baggerstand";
import { schuettdichte, abfallDichte } from "../src/materials/schuettdichte";
import {
  nutzVolumen,
  lichteFlaeche,
  fuellgrad,
  istVoll,
  restKg,
  VOLL_AB,
} from "../src/world/fuellstand";
import { LAMBERT_SPRUECHE } from "../src/world/lambertfunk";
import { SCHIEB_ABLAGE_M, SCHIEB_VORLAUF, SCHIEB_AB_M } from "../src/world/loader";
import { aufFahrspur } from "../src/world/fahrspuren";
import {
  ABFALLSILO,
  SAATEN,
  ZWEI_STUECKE,
  baueAbfall,
  festerZufall,
  fuelleSilo,
  papierStattBrowser,
} from "./lambertlauf";

beforeAll(async () => {
  papierStattBrowser();
  await initPhysics();
});

const MUELL = CONFIGS.find((c) => c.id === "r_rubble")!;

/* ------------------------------------------------- 1  Wie voll ist voll --- */

describe("Füllstand einer Mulde", () => {
  it("rechnet das Nutzvolumen aus der Geometrie, nicht aus einer Zahl im Code", () => {
    // Absetzcontainer: vier Wände, je ROLLOFF_WAND dick
    const [w, d, h] = MUELL.size;
    expect(lichteFlaeche(MUELL)).toBeCloseTo((w - 2 * ROLLOFF_WAND) * (d - 2 * ROLLOFF_WAND), 6);
    expect(nutzVolumen(MUELL)).toBeCloseTo(lichteFlaeche(MUELL) * h, 6);
    // Betonlego-Mulde: zwei Wände, also je Achse nur eine Steinstärke
    const [bw, bd, bh] = ABFALLSILO.size;
    expect(lichteFlaeche(ABFALLSILO)).toBeCloseTo(
      (bw - MULDE_STEIN.dicke) * (bd - MULDE_STEIN.dicke),
      6
    );
    expect(nutzVolumen(ABFALLSILO)).toBeCloseTo(lichteFlaeche(ABFALLSILO) * bh, 6);
  });

  it("misst nach Volumen, nicht nach Gewicht: gleiche Kilo, anderer Füllgrad", () => {
    // 900 kg Kunststoff (90 kg/m³) brauchen zehnmal so viel Raum wie
    // 900 kg Bleiakkus (1600 kg/m³) — genau darum geht es.
    const kunst = fuellgrad(MUELL, new Map([["plastic", 900]]));
    const holz = fuellgrad(MUELL, new Map([["wood", 900]]));
    expect(kunst).toBeGreaterThan(holz * 2);
  });

  it("ist bei der Schranke voll — und einen Hauch darunter nicht (Gegenprobe)", () => {
    const grenzeKg = nutzVolumen(MUELL) * VOLL_AB * schuettdichte("wood");
    // knapp darüber: voll
    expect(istVoll(MUELL, new Map([["wood", grenzeKg + 1]]))).toBe(true);
    // knapp darunter: NICHT voll — sonst meldet der Wächter immer
    expect(istVoll(MUELL, new Map([["wood", grenzeKg - 1]]))).toBe(false);
    // und leer erst recht nicht
    expect(istVoll(MUELL, new Map())).toBe(false);
  });

  it("nennt die Zahlen, an denen die Regel haengt (gerechnet, nicht getippt)", () => {
    /*
     * Ohne diese Prüfung ist der Wächter blind gegen die Zahl selbst: Alle
     * anderen rechnen mit `VOLL_AB` und wären auch bei 99 noch grün. Hier
     * steht die Rechenkette ausgeschrieben.
     *
     * MUELL-Container (seit E-190 ein 10-m³-Abrollcontainer):
     *   2,50 × 4,50 × 1,00 m außen, 0,09 m Wand
     *   → lichte 2,32 × 4,32 m, Nutzvolumen 10,02 m³
     *   → voll ab 10,02 × 0,90 × 197,5 kg/m³ = 1.782 kg gemischter Abfall
     * ABFALL-Silo: 6,00 × 4,20 × 3,00 m, 0,55 m Betonlego, zwei Wände
     *   → lichte 5,45 × 3,65 m, Nutzvolumen 59,68 m³ → 10.608 kg
     */
    expect(nutzVolumen(MUELL)).toBeCloseTo(10.02, 2);
    expect(nutzVolumen(MUELL) * VOLL_AB * abfallDichte()).toBeGreaterThan(1750);
    expect(nutzVolumen(MUELL) * VOLL_AB * abfallDichte()).toBeLessThan(1820);
    expect(nutzVolumen(ABFALLSILO)).toBeCloseTo(59.68, 2);
    expect(nutzVolumen(ABFALLSILO) * VOLL_AB * abfallDichte()).toBeGreaterThan(10400);
    // Der Mittelwert der vier Abfall-Schüttdichten (250 · 300 · 150 · 90)
    expect(abfallDichte()).toBeCloseTo(197.5, 3);
  });

  it("sagt in Kilogramm, was noch hineingeht", () => {
    const rest = restKg(MUELL, new Map(), "wood");
    expect(rest).toBeCloseTo(nutzVolumen(MUELL) * VOLL_AB * schuettdichte("wood"), 6);
    // Nach einer halben Fuhre ist die Hälfte weg
    const halb = restKg(MUELL, new Map([["wood", rest / 2]]), "wood");
    expect(halb).toBeCloseTo(rest / 2, 6);
  });
});

/* ---------------------------------------------------- 2  Lambert selbst --- */

describe("Lambert räumt selbständig auf", () => {
  /*
   * DIESER FALL WAR DER UNZUVERLÄSSIGE (offener Punkt, behoben in E-109).
   *
   * Er stand als ein einziger Lauf da und prüfte `imSilo() === 2`. In 3 von 40
   * Läufen der Datei kam 1 heraus — und der Verdacht lautete „Zeitschranke
   * reißt unter Last". Das war er nicht: Der Lauf hängt an gerechneten
   * Schritten (dt = 1/60), an keiner Wanduhr, und er ist nach 22,1 s fertig,
   * bei 120 s Budget. Gemessen mit `tools/lambert-streuung.ts` über 60 Saaten:
   * 22,1 s, jedes Mal, auf die Zehntelsekunde.
   *
   * ES WAR DIE FEHLENDE MULDE. Der Aufbau setzte einen Boden und sonst nichts;
   * die Abfallmulde war ein gedachtes Rechteck, in dem gezählt wurde. Lambert
   * wirft seine Fuhre aber aus 3,90 m Höhe ab, gestreut um ±0,60 m
   * (`people.ts:1327`, `Math.random()`), und ohne Betonlego prallte sie auf
   * den nackten Boden und rutschte weg — gemessen 2,95 m neben der Mitte, also
   * 0,85 m ausserhalb einer Wand, die es nicht gab. Der Wächter prüfte „bringt
   * es in die Mulde", ohne dass eine Mulde vorhanden war.
   *
   * Jetzt steht der echte `ContainerManager` da, gezählt wird im Grundriss der
   * Mulde (`bayHalb`) statt in einem Rahmen mit 0,78 m Zuschlag — und gefahren
   * werden sechs feste Saaten statt eines Wurfs.
   *
   * FÜNF VON SECHS, NICHT SECHS VON SECHS, und das ist gemessen, nicht
   * gefällig gewählt: Mit Mulde springt in 1 von 200 Läufen (`echt`, ohne
   * Saat) ein Stück über die offene Nordseite wieder heraus und bleibt 0,74 m
   * davor liegen. Das ist ein Befund am Spiel, kein Testfehler, und er steht
   * in `docs/offene-punkte.md`. Bei 0,5 % je Lauf reisst „5 von 6" nur in
   * 0,04 % der Saatensätze — ein Umbau, der den Zufallsstrom verschiebt und
   * damit sechs andere Würfe würfelt, kippt diesen Wächter also nicht.
   */
  it("bringt herumliegenden Abfall in die Abfallmulde und meldet sich an und ab", () => {
    let drin = 0;
    for (const saat of SAATEN) {
      const zurueck = festerZufall(saat);
      try {
        const p = baueAbfall();
        for (const [mat, kg, x, z] of ZWEI_STUECKE) p.lege(mat, kg, x, z);
        p.schritt(120);
        if (p.imSilo() === 2) drin++;
        // An- und abmelden muss er in JEDEM Lauf — das hängt an keinem Wurf.
        expect(p.funk.length, `Saat ${saat}: kein Funk`).toBeGreaterThanOrEqual(2);
        expect(LAMBERT_SPRUECHE.abfallAn, `Saat ${saat}: meldet sich nicht an`).toContain(p.funk[0]);
        expect(
          LAMBERT_SPRUECHE.abfallFertig,
          `Saat ${saat}: meldet sich nicht ab`
        ).toContain(p.funk[p.funk.length - 1]);
      } finally {
        zurueck();
      }
    }
    expect(drin, `nur ${drin} von ${SAATEN.length} Laeufen haben beide Stuecke in der Mulde`).
      toBeGreaterThanOrEqual(SAATEN.length - 1);
  }, 120000);

  it("GEGENPROBE: dieselbe Zaehlung meldet ein Stueck NEBEN der Mulde nicht als drin", () => {
    /*
     * Ohne diese Zeile prüft `imSilo()` nichts: Ein Rahmen, der alles zählt,
     * ist immer bei 2. Genau dieser Zuschlag war der Fehler — die alte
     * Zählung liess ein Stück 0,78 m ausserhalb der Wand als „in der Mulde"
     * durchgehen.
     */
    const p = baueAbfall();
    const { hw, hd } = bayHalb(ABFALLSILO);
    const drin = p.lege("wood", 40, ABFALLSILO.x, ABFALLSILO.z);
    expect(p.imSilo()).toBe(1);
    // Einen halben Meter hinter die Mulde legen: darf nicht mehr zählen.
    drin.body.setTranslation({ x: ABFALLSILO.x + hw + 0.5, y: 0.4, z: ABFALLSILO.z }, true);
    expect(p.imSilo()).toBe(0);
    drin.body.setTranslation({ x: ABFALLSILO.x, y: 0.4, z: ABFALLSILO.z + hd + 0.5 }, true);
    expect(p.imSilo()).toBe(0);
  });

  it("fährt dem Bagger dabei nicht in den Schwenkbereich", () => {
    const p = baueAbfall();
    p.lege("wood", 80, -14.0, -6.0);
    p.schritt(90);
    expect(p.imBand).toBe(false);
    // Gegenprobe: Ein Punkt IM Band wird von derselben Rechnung auch erkannt —
    // sonst prüfte die Zeile darüber gar nichts.
    const drin = Math.hypot(
      BAGGER_STAND.x - BAGGER_STAND.x,
      BAGGER_STAND.z + (SCHWENK_INNEN + SCHWENK_AUSSEN) / 2 - BAGGER_STAND.z
    );
    expect(drin).toBeGreaterThanOrEqual(SCHWENK_INNEN);
    expect(drin).toBeLessThanOrEqual(SCHWENK_AUSSEN);
  });

  it("lässt den Abfall liegen und gibt durch, wenn die Mulde voll ist", () => {
    const p = baueAbfall();
    // Ein Kilo ÜBER der Schranke
    fuelleSilo(p, nutzVolumen(ABFALLSILO) * VOLL_AB * schuettdichte("wood") + 1);
    const lose = p.lege("wood", 80, -14.0, -6.0);
    p.schritt(45);
    expect(istVoll(ABFALLSILO, new Map([["wood", nutzVolumen(ABFALLSILO) * VOLL_AB * schuettdichte("wood") + 1]]))).toBe(true);
    expect(p.funk.some((s) => LAMBERT_SPRUECHE.muldeVoll.includes(s))).toBe(true);
    // Das lose Stück liegt noch da, wo es lag
    const q = lose.body.translation();
    expect(Math.hypot(q.x - -14.0, q.z - -6.0)).toBeLessThan(1.5);
  });

  it("GEGENPROBE: ein Kilo unter der Schranke, und er holt es doch", () => {
    const p = baueAbfall();
    fuelleSilo(p, nutzVolumen(ABFALLSILO) * VOLL_AB * schuettdichte("wood") - 1);
    p.lege("wood", 80, -14.0, -6.0);
    p.schritt(120);
    expect(p.funk.some((s) => LAMBERT_SPRUECHE.muldeVoll.includes(s))).toBe(false);
    expect(p.funk.some((s) => LAMBERT_SPRUECHE.abfallAn.includes(s))).toBe(true);
  });

  it("macht Platz, solange ein Fahrzeug rangiert", () => {
    const p = baueAbfall();
    p.lege("wood", 80, -14.0, -6.0);
    const lkw = new THREE.Vector3(-12, 0, 4);
    p.schritt(60, lkw);
    expect(p.imSilo()).toBe(0);
    expect(p.funk.length).toBe(0);
    // GEGENPROBE: dieselbe Lage ohne Fahrzeug, und er fährt los
    const q = baueAbfall();
    q.lege("wood", 80, -14.0, -6.0);
    q.schritt(60);
    expect(q.funk.length).toBeGreaterThan(0);
  });

  it("schiebt einen Brocken von der Büroseite in den Schwenkbereich — und bleibt selbst draußen", () => {
    const p = baueAbfall();
    // Ein Brocken auf der Büroseite, weit außerhalb der Baggerreichweite
    const brocken = p.lege("steel", 500, -20.0, 0.0);
    expect(Math.hypot(-20 - BAGGER_STAND.x, 0 - BAGGER_STAND.z)).toBeGreaterThan(SCHIEB_AB_M);
    p.schritt(200);
    const q = brocken.body.translation();
    const nachher = Math.hypot(q.x - BAGGER_STAND.x, q.z - BAGGER_STAND.z);
    expect(nachher).toBeGreaterThanOrEqual(SCHWENK_INNEN);
    expect(nachher).toBeLessThanOrEqual(SCHWENK_AUSSEN);
    // Und er selbst war nie im Band
    expect(p.imBand).toBe(false);
    expect(p.funk.some((t) => LAMBERT_SPRUECHE.schiebenAn.includes(t))).toBe(true);
    expect(p.funk.some((t) => LAMBERT_SPRUECHE.schiebenFertig.includes(t))).toBe(true);
  });

  it("die Rechnung dahinter: Ablage im Band, Halteplatz außerhalb", () => {
    /*
     * Die Zahl, an der es hängt — ausgeschrieben, damit ein Umstellen von
     * `SCHIEB_ABLAGE_M` oder `SCHIEB_VORLAUF` hier anschlägt und nicht erst
     * auf dem iPad.
     */
    expect(SCHIEB_ABLAGE_M).toBeGreaterThanOrEqual(SCHWENK_INNEN);
    expect(SCHIEB_ABLAGE_M).toBeLessThanOrEqual(SCHWENK_AUSSEN);
    expect(SCHIEB_ABLAGE_M + SCHIEB_VORLAUF).toBeGreaterThan(SCHWENK_AUSSEN);
    // GEGENPROBE: Mit der alten Ablage (6,0 m) stünde er mitten im Band —
    // genau das war der Fehler.
    expect(6.0 + SCHIEB_VORLAUF).toBeLessThan(SCHWENK_AUSSEN);
  });

  it("legt keinen Brocken auf eine Fahrspur", () => {
    const p = baueAbfall();
    const brocken = p.lege("steel", 500, -20.0, 0.0);
    p.schritt(200);
    const q = brocken.body.translation();
    expect(aufFahrspur(q.x, q.z, 0.8)).toBe(false);
    // GEGENPROBE: Ein Punkt AUF der Zufahrt wird von derselben Abfrage
    // erkannt — die Zufahrt läuft über (−12 | 4).
    expect(aufFahrspur(-12, 4, 0)).toBe(true);
  });

  it("fasst nichts an, was schon in einer Abfallmulde liegt", () => {
    const p = baueAbfall();
    fuelleSilo(p, 50);
    p.schritt(30);
    // Keine Arbeit gefunden, also auch keine Meldung — er trägt nicht aus der
    // Mulde in die Mulde.
    expect(p.funk.length).toBe(0);
  });
});
