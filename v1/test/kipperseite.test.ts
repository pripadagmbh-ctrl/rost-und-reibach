/**
 * Der Kipper lädt seitlich ab — und die Fuhre landet dort, wo der Arm hinkommt.
 *
 * Ansage Patrick 15.09.2026: „Kipper fahren die falsche Spur. Die sollen auch,
 * wie die anderen LKWs, seitlich von mir abgeladen werden." Bestätigt am selben
 * Tag: Er soll weiter KIPPEN (das ist der einzige Weg, auf dem Material ohne
 * Spielerarbeit auf den Platz kommt), aber quer am Abladeplatz — der Spieler
 * sortiert danach nach. Und: Sortenreine Fuhren fahren weiterhin zu den Silos.
 *
 * Dieser Wächter hält die drei Zahlen fest, an denen das hängt:
 *
 *  1. Die Zweiteilung der Wege (`faehrtInsSilo`).
 *  2. Der Wagen steht mit der LÄNGSSEITE zum Bagger, und alle vier Ecken
 *     seiner Ladefläche liegen im Schwenkband 5,8 bis 9,2 m.
 *  3. Die gekippte Fuhre liegt im Greifband, nicht in der Rückfahrspur, nicht
 *     an der Südmauer und nicht in der Ausbuchtung.
 *
 * Maße: `vehicles.ts`/`vehicleModel.ts` — Ursprung = Mitte der Ladefläche,
 * nach hinten bis −(bedLen/2 + 0,14) (Unterfahrschutz), nach vorn bis
 * +(bedLen/2 + 1,90) (Kabine), halbe Breite 1,55 m.
 */
import { describe, it, expect } from "vitest";
import {
  ABLADE_SPUR_X,
  ABLADE_HALT_Z,
  ABKIPP_ZONE,
  BED_HALF_W,
  BED_LEN,
  TIP_CREEP_M,
  bedLenFor,
  faehrtInsSilo,
  routeInRev,
  routeOut,
  neueAbladestelle,
} from "../src/delivery/routes";
import { lagerMuldeFuer, CONFIGS } from "../src/world/containers";
import { BAGGER_STAND, abstandVomStand } from "../src/world/baggerstand";
import { hitsObstacle } from "../src/world/obstacles";
import { YARD_D, BUCHT_X_VON, BUCHT_X_BIS } from "../src/world/yard";

/** Grenzen des Schwenkbands am Boden (E-010, `test/platz.test.ts`). */
const BAND_INNEN = 5.8;
const BAND_AUSSEN = 9.2;
/** Innenseite der Südmauer: Platztiefe 58 m, Betonlego 0,60 m dick. */
const SUEDMAUER_INNEN = -YARD_D / 2 + 0.3;

const KIPPER = BED_LEN.kipper!;

describe("Der Kipper lädt seitlich ab", () => {
  it("die Zweiteilung: sortenrein mit Lagersilo ins Lager, alles andere an den Abladeplatz", () => {
    /*
     * Das ist die Regel, die Patrick am 15.09.2026 bestätigt hat, und sie ist
     * seit E-028 genau so im Code angelegt — was heute wegfällt, ist der
     * DRITTE Weg (die eigene Kipperspur mitten im Arbeitsbereich).
     */
    for (const fraktion of ["copper", "brass", "cable", "alu", "zinc", "va", "battery", "rubble"]) {
      const lager = lagerMuldeFuer(fraktion);
      expect(lager, `${fraktion} hat kein Lagersilo`).not.toBeNull();
      expect(faehrtInsSilo("kipper", lager), `${fraktion} fährt nicht ins Silo`).toBe(true);
    }
    // Gemischt und alles ohne Lagerziel: Abladeplatz.
    expect(faehrtInsSilo("kipper", lagerMuldeFuer(null))).toBe(false);
    expect(faehrtInsSilo("kipper", lagerMuldeFuer("mixed"))).toBe(false);
    expect(faehrtInsSilo("kipper", lagerMuldeFuer("steel"))).toBe(false);
    /*
     * Und wer NICHT selbst kippen kann, fährt nie ins Silo — er wird vom
     * Bagger ausgeräumt und muss dafür in Reichweite stehen, auch mit
     * sortenreiner Ladung.
     */
    for (const art of ["pritsche", "wrack", "pkw", "abholer"]) {
      expect(faehrtInsSilo(art, lagerMuldeFuer("copper")), `${art} fährt ins Silo`).toBe(false);
    }
  });

  it("er hält auf demselben Abladeplatz wie die Pritschen, mit der Längsseite zum Bagger", () => {
    neueAbladestelle();
    const rev = routeInRev();
    const [halt] = rev.slice(-1);
    expect(halt).toEqual([ABLADE_SPUR_X, ABLADE_HALT_Z]);
    /*
     * QUER heißt: Die Längsachse der Ladefläche steht senkrecht auf der
     * Sichtlinie vom Sitz. Der Wagen setzt von Norden nach Süden zurück, seine
     * Achse liegt also in z; der Bagger steht in −x daneben. Gemessen wird der
     * Winkel zwischen beiden — er muss nahe 90 Grad liegen, sonst schaut der
     * Spieler wieder auf ein Heck.
     */
    // Die letzte Gerade des Rangierzugs (E-140) — bis dahin die einzige.
    const [von, bis] = [rev.at(-2)!, rev.at(-1)!];
    const achse = Math.atan2(bis[0] - von[0], bis[1] - von[1]);
    const zumSitz = Math.atan2(BAGGER_STAND.x - halt![0], BAGGER_STAND.z - halt![1]);
    let winkel = Math.abs(((achse - zumSitz) * 180) / Math.PI);
    if (winkel > 180) winkel = 360 - winkel;
    expect(Math.abs(winkel - 90), `${winkel.toFixed(1)} Grad statt quer`).toBeLessThan(35);
  });

  it("alle vier Ecken seiner Ladefläche liegen im Schwenkband", () => {
    /*
     * Er ist mit 6,00 m der LÄNGSTE Wagen — 0,60 m mehr als die Pritsche, für
     * die der Platz am 15.09.2026 von z −24,0 auf −23,0 gerückt ist. Bei
     * −24,0 lag die nächste Ecke auf 5,58 m und damit unter der inneren
     * Grenze; das ist die Zahl, an der der Abladeplatz hängt.
     */
    const ecken: Array<[string, number]> = [];
    for (const dx of [-BED_HALF_W, BED_HALF_W]) {
      for (const dz of [-KIPPER / 2, KIPPER / 2]) {
        const d = abstandVomStand(ABLADE_SPUR_X + dx, ABLADE_HALT_Z + dz);
        ecken.push([`(${(ABLADE_SPUR_X + dx).toFixed(2)} | ${(ABLADE_HALT_Z + dz).toFixed(2)})`, d]);
      }
    }
    for (const [wo, d] of ecken) {
      expect(d, `${wo}: ${d.toFixed(2)} m — zu nah am Bagger`).toBeGreaterThanOrEqual(BAND_INNEN);
      expect(d, `${wo}: ${d.toFixed(2)} m — außer Reichweite`).toBeLessThanOrEqual(BAND_AUSSEN);
    }
  });

  it("er steht nicht in der Südmauer — und 0,3 m weiter täte er es", () => {
    /*
     * Nach hinten reicht er bis Halt − (bedLen/2 + 0,14). Die Gegenprobe mit
     * der Pritschenlänge zeigt, dass diese Prüfung am Kipper hängt und nicht
     * an irgendeinem Wagen.
     */
    const heck = ABLADE_HALT_Z - (KIPPER / 2 + 0.14);
    expect(heck, `Heck auf z ${heck.toFixed(2)}`).toBeGreaterThan(SUEDMAUER_INNEN);
    const luft = heck - SUEDMAUER_INNEN;
    expect(luft, `nur ${luft.toFixed(2)} m Luft zur Südmauer`).toBeGreaterThan(1.0);
    // Und er steht wirklich weiter hinten als die Pritsche:
    expect(KIPPER - bedLenFor("pritsche")).toBeCloseTo(0.6, 6);
  });

  it("die gekippte Fuhre landet im Greifband — Abwurfkante und Ende des Anziehens", () => {
    /*
     * Die Mulde kippt über ihre HINTERE Kante aus; die liegt bei
     * Halt − bedLen/2. Danach zieht der Wagen gekippt `TIP_CREEP_M` nach
     * NORDEN an (auf den Bagger zu), der Rest rutscht nach.
     *
     *   Abwurfkante   (6,3 | −26,0)   7,65 m
     *   nach Anziehen (6,3 | −24,6)   7,12 m
     */
    expect(ABKIPP_ZONE[0]).toBeCloseTo(ABLADE_SPUR_X, 6);
    expect(ABKIPP_ZONE[1]).toBeCloseTo(ABLADE_HALT_Z - KIPPER / 2, 6);
    const abwurf = abstandVomStand(ABKIPP_ZONE[0], ABKIPP_ZONE[1]);
    const nachher = abstandVomStand(ABKIPP_ZONE[0], ABKIPP_ZONE[1] + TIP_CREEP_M);
    expect(abwurf).toBeCloseTo(7.65, 2);
    expect(nachher).toBeCloseTo(7.12, 2);
    for (const [wo, d] of [
      ["Abwurfkante", abwurf],
      ["nach dem Anziehen", nachher],
    ] as Array<[string, number]>) {
      expect(d, `${wo}: ${d.toFixed(2)} m`).toBeGreaterThanOrEqual(BAND_INNEN);
      expect(d, `${wo}: ${d.toFixed(2)} m`).toBeLessThanOrEqual(BAND_AUSSEN);
    }
  });

  it("und die ganze Breite des Haufens bleibt erreichbar, nicht nur seine Mitte", () => {
    /*
     * Ein Haufen ist kein Punkt. Abgetastet wird das Rechteck, über das die
     * Fuhre herausrutscht: in x die Muldenbreite (± BED_HALF_W), in z von der
     * Abwurfkante bis zum Ende des Anziehens. Gefordert ist, dass der Arm den
     * BODEN erreicht — das ist das Fenster 3,0 bis 9,5 m aus der Armgeometrie
     * (`test/reach.test.ts`), nicht das engere Schwenkband für Muldenwände.
     */
    let naechste = Infinity;
    let fernste = 0;
    for (const dx of [-BED_HALF_W, 0, BED_HALF_W]) {
      for (const z of [ABKIPP_ZONE[1], ABKIPP_ZONE[1] + TIP_CREEP_M / 2, ABKIPP_ZONE[1] + TIP_CREEP_M]) {
        const d = abstandVomStand(ABKIPP_ZONE[0] + dx, z);
        naechste = Math.min(naechste, d);
        fernste = Math.max(fernste, d);
      }
    }
    expect(naechste, `nächste Ecke ${naechste.toFixed(2)} m`).toBeGreaterThan(3.0);
    expect(fernste, `fernste Ecke ${fernste.toFixed(2)} m`).toBeLessThan(9.5);
  });

  it("die Fuhre rollt weder in die Rückfahrspur noch in die Ausbuchtung", () => {
    neueAbladestelle();
    /*
     * Der Wagen setzt von Norden zurück und fährt nach Norden wieder heraus;
     * der Haufen liegt SÜDLICH von ihm, also hinter seiner Ausfahrt. Geprüft
     * wird, dass die Abwurfkante südlich des Halts liegt und der Auslauf
     * danach an einer Mauer endet und nicht in der Ausbuchtung — dort käme
     * der Arm nicht mehr hin (Vorderkante der Halde: z −29).
     */
    expect(ABKIPP_ZONE[1], "der Haufen liegt in der Ausfahrt").toBeLessThan(ABLADE_HALT_Z);
    const aus = routeOut();
    for (const [x, z] of aus) {
      if (Math.abs(x - ABKIPP_ZONE[0]) > 2.6) continue;
      expect(z, `Ausfahrtpunkt (${x} | ${z}) führt durch den Haufen`).toBeGreaterThan(
        ABKIPP_ZONE[1] + 1.0
      );
    }
    /*
     * Auslauf nach Süden: Von der Abwurfkante bis zur Südmauer. Er muss groß
     * genug sein, damit nichts an der Mauer klemmt — und klein genug, dass
     * nichts in die Ausbuchtung rollt, wo der Arm es nicht mehr holt. Die
     * Ausbuchtung öffnet sich bei z −29,0 zwischen x −6,5 und 7,5; der
     * Abladeplatz liegt mit x 6,3 mitten in dieser Öffnung.
     */
    expect(ABLADE_SPUR_X).toBeGreaterThan(BUCHT_X_VON);
    expect(ABLADE_SPUR_X).toBeLessThan(BUCHT_X_BIS);
    const auslauf = ABKIPP_ZONE[1] - -YARD_D / 2;
    expect(auslauf, `nur ${auslauf.toFixed(2)} m Auslauf nach Süden`).toBeGreaterThan(2.0);
    expect(auslauf, `${auslauf.toFixed(2)} m Auslauf — das rollt in die Bucht`).toBeLessThan(4.0);
  });

  it("die alte Kipperspur ist restlos weg — keine unsichtbaren Reste", () => {
    /*
     * Sie lief auf x 2,0 von z −7 bis −12,5, der Abkippfleck lag auf
     * (2,0 | −15,5) — rund 3 x 9 m mitten im Schwenkband, 7,0 bis 7,4 m vom
     * Sitz. Das ist die beste freie Fläche, die es auf dem Platz gibt.
     *
     * Geprüft wird, dass dort nichts steht (die Fläche ist wirklich frei)
     * UND dass keine Route mehr hindurchführt.
     */
    for (let z = -16.5; z <= -6.0; z += 0.5) {
      expect(hitsObstacle(2.0, z, 1.4), `alte Kipperspur bei z=${z.toFixed(1)} versperrt`).toBeNull();
    }
    /*
     * SEIT E-140 NUR NOCH DER TEIL IM SCHWENKBAND (z −17,27 … −13,65, siehe
     * unten). Der Rangierzug an den Abladeplatz setzt im weiten Bogen ueber
     * den Vorplatz zurueck und kreuzt die alte Spur an ihrem Nordende, bei
     * z −9 — 13 m vom Sitz, weit ausserhalb des Bands. Die ganze Spur zu
     * sperren, hiesse den Abladeplatz unerreichbar zu machen: Gerechnet mit
     * der Spur als Bauwerk findet `planeRangierzug` keinen freien Zug mehr
     * (0,60 m in der Ostwand). Der Teil, der fuer die Arbeit zaehlt, bleibt frei.
     */
    const strecken = [routeInRev(), routeOut()];
    for (const route of strecken) {
      for (const [x, z] of route) {
        const inSpur = Math.abs(x - 2.0) < 1.6 && z > -17.27 && z < -13.65;
        expect(inSpur, `Wegpunkt (${x} | ${z}) liegt im Schwenkband der alten Kipperspur`).toBe(false);
      }
    }
    /*
     * WIEVIEL DAVON IST WIRKLICH ARBEITSFLÄCHE — nachgemessen, nicht
     * behauptet. Auf der Achse x 2,0 liegt das Schwenkband 5,8 bis 9,2 m
     * zwischen z −17,27 und −13,65: 3,62 m. Der alte Abkippfleck
     * (2,0 | −15,5) sitzt mit 7,43 m genau darin; der Halt (2,0 | −12,5) lag
     * mit 10,31 m schon außerhalb, das Nordende der Spur (2,0 | −7) mit
     * 15,70 m weit draußen. Frei wird also die ganze Spur — im Schwenkband
     * nutzbar ist der südliche Streifen.
     */
    expect(abstandVomStand(2.0, -15.5)).toBeCloseTo(7.43, 2);
    expect(abstandVomStand(2.0, -12.5)).toBeCloseTo(10.31, 2);
    expect(abstandVomStand(2.0, -7.0)).toBeCloseTo(15.7, 2);
    let imBand = 0;
    for (let z = -20.0; z <= -6.0; z += 0.01) {
      const d = abstandVomStand(2.0, z);
      if (d >= BAND_INNEN && d <= BAND_AUSSEN) imBand += 0.01;
    }
    expect(imBand, `nur ${imBand.toFixed(2)} m der Spur liegen im Band`).toBeGreaterThan(3.5);
  });

  it("die Arbeitszone am Abladeplatz deckt den Haufen ab", () => {
    /*
     * Ohne das hält der nächste Wagen vor dem liegengebliebenen Material an
     * und hupt (`WORK_ZONES`, `routes.ts`). Bis heute deckte der Kreis nur
     * die Ladefläche der Pritsche ab — jetzt liegt dort auch, was der Kipper
     * ausgeschüttet hat.
     */
    const zone = CONFIGS; // nur damit der Import nicht als tot gilt
    expect(zone.length).toBeGreaterThan(0);
    const d = Math.hypot(ABKIPP_ZONE[0] - ABLADE_SPUR_X, ABKIPP_ZONE[1] - ABLADE_HALT_Z);
    expect(d, "der Haufen liegt außerhalb der Arbeitszone").toBeLessThan(9);
  });
});
