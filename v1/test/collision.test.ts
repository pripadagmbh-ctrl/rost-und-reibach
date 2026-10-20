import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { CONFIGS, bayVorderkante, bayRuecken, bayOeffnung } from "../src/world/containers";
import {
  YARD_MIN_X,
  YARD_MAX_X,
  YARD_D,
  BUCHT_X_VON,
  BUCHT_X_BIS,
  BUCHT_Z,
} from "../src/world/yard";
import {
  STATIC_OBSTACLES,
  hitsObstacle,
  slideAround,
} from "../src/world/obstacles";
import {
  OFFICE_X,
  OFFICE_Z,
  officeFootprints,
  hallenFootprints,
  hallenWaende,
  HALLEN_X,
  HALLE_TIEFE,
  TOR_RICHTUNG,
} from "../src/world/office";
import { PRESS_CENTER, pressWaende } from "../src/world/press";

/**
 * Fussabdruck der Presse aus ihren vier Waenden.
 *
 * Seit E-029 steht sie nicht mehr als ein Vollrechteck in `STATIC_OBSTACLES`,
 * sondern als Wandring — sonst kaeme der Greifer nicht auf den Kammerboden
 * (Befund Patrick 15.09.2026: „Es war auch nicht moeglich, ein
 * zusammengepresstes Auto wieder aus der Presse zu holen"). Wer die Anordnung
 * pruefen will, braucht trotzdem den Umriss; er wird hier aus den Eintraegen
 * zusammengesetzt, die wirklich in der Liste stehen.
 */
function presseFuss(): { x: number; z: number; hw: number; hd: number } {
  const w = STATIC_OBSTACLES.filter((o) => o.label.startsWith("Presse "));
  expect(w.length, "die Presse fehlt in der Hindernisliste").toBe(4);
  const x0 = Math.min(...w.map((o) => o.x - o.hw));
  const x1 = Math.max(...w.map((o) => o.x + o.hw));
  const z0 = Math.min(...w.map((o) => o.z - o.hd));
  const z1 = Math.max(...w.map((o) => o.z + o.hd));
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, hw: (x1 - x0) / 2, hd: (z1 - z0) / 2 };
}
import { BAGGER_STAND } from "../src/world/baggerstand";
import { WEIGH_X, WEIGH_Z, TRENNSTEIN_X } from "../src/world/yard";
import {
  CLAW_OPEN_SPLAY,
  CLAW_SEGMENTS,
  clawPoint,
  clawSpan,
  CLAW_CLOSED_SPLAY,
  clawTipDepth,
  clawToothDepth,
  CLAW_MAX_DEPTH,
  naechsteSpreizung,
  NACHDRUECK_RESERVE,
} from "../src/excavator/clawGeometry";
import {
  ABLADE_SPUR_X,
  ABLADE_HALT_Z,
  ROUTE_IN_FWD,
  routeApproach,
  routeInRev,
  routeOut,
  pickupApproach,
  pickupInRev,
  pickupOut,
} from "../src/delivery/routes";

/**
 * Die Kollisionsprüfung hat schon mehrfach echte Fehler produziert: ein
 * Bauwerk sperrte versehentlich eine Fahrspur, eine Mulde lag außerhalb der
 * Reichweite, der Innenraum einer Box war als Vollfläche gesperrt. Diese
 * Tests halten genau diese Fälle fest.
 */

/** Gemessene Reichweite des Auslegers am Boden */
const REICHWEITE_M = 9.8;
/** Mitten der vier Sortiermulden (Reihe im Osten) */
/**
 * Muldenlage NICHT hier eintragen — sie kommt aus CONFIGS.
 *
 * Vorher standen die Koordinaten hier fest, und beim Verschieben der
 * Sortierreihe prüfte der Test die alte Stelle: grün, obwohl die Wände
 * woanders standen. Ein Test, der seine eigene Wahrheit mitbringt, prüft
 * nichts.
 */
/**
 * Was der Spieler selbst befuellt.
 *
 * Seit E-010 sind es drei statt vier: Kupfer und Messing teilen sich eine
 * Mulde, Alu und Zink ebenfalls, und VA hat am Bagger kein eigenes Ziel mehr.
 * Die Liste kommt deshalb aus dem Kennzeichen `sortierbox` und nicht mehr aus
 * abgeschriebenen IDs — sonst prueft sie irgendwann Mulden, die es nicht gibt.
 */
const SORTIERMULDEN = CONFIGS.filter((c) => c.sortierbox === true);
/**
 * Standplatz des Baggers — aus `world/baggerstand.ts`, nicht abgeschrieben.
 *
 * Vorher stand hier die Zahl aus `excavator.ts` als Kopie. Beim Platzumbau
 * (E-010) ist der Standplatz gewandert, die Kopie nicht — und der Test prueft
 * dann die Reichweite von einer Stelle aus, an der niemand steht.
 */
const BAGGER_X = BAGGER_STAND.x;
const BAGGER_Z = BAGGER_STAND.z;
/**
 * Die Silo-Reihe, an der der Abholer entlangfaehrt.
 *
 * Aus dem Kennzeichen `lager` gelesen, nicht aus abgeschriebenen IDs: Am
 * 15.09.2026 sind aus neun Silos sechs geworden (`c_wood` und `c_plastic`
 * gingen im ABFALL auf), und eine Liste von Hand haette danach drei Behaelter
 * geprueft, die es nicht mehr gibt.
 */
const SILOS = CONFIGS.filter((c) => c.lager === true);

describe("Feste Bauten", () => {
  it("sperrt jedes eingetragene Bauwerk an seinem Platz", () => {
    // Aus der Liste selbst geprüft statt gegen abgeschriebene Koordinaten:
    // So bricht der Test nicht, wenn ein Gebäude umzieht — er prüft die
    // Zusicherung, nicht den Standort.
    for (const o of STATIC_OBSTACLES) {
      expect(hitsObstacle(o.x, o.z, 0), `${o.label} muss sperren`).not.toBeNull();
    }
  });

  it("führt die erwarteten Bauwerke", () => {
    const labels = STATIC_OBSTACLES.map((o) => o.label).join(" ");
    for (const pflicht of ["Südwand", "Westwand", "Ostwand", "Presse Nord"]) {
      expect(labels, `${pflicht} fehlt in der Hindernisliste`).toContain(pflicht);
    }
  });

  it("stellt Büro und Hallen von Anfang an in den Weg", () => {
    // Sie stehen von der ersten Sekunde an da — nicht erst nach einem Kauf.
    expect(hitsObstacle(OFFICE_X, OFFICE_Z, 0)?.label).toBe("Betriebsgebäude");
    /*
     * Die drei Sortierhallen sind am 15.09.2026 wieder an die Wand neben dem
     * Buero gezogen; die Silo-Reihe, die dort im Weg lag, steht jetzt an der
     * anderen Seite.
     *
     * Und sie sind nicht mehr massiv: Eine Halle sperrt ihre WAENDE, nicht
     * ihre Grundflaeche. Als Vollrechteck war sie nicht anfahrbar — jeder LKW
     * haelt 1,4 m vor einem Hindernis an, und der Weg aus E-011 („Haendler
     * fahren ueber die Waage in ihre Halle und laden selbst ab") lief ins
     * Leere. Geprueft wird deshalb beides: Die Waende sperren, das Tor nicht.
     */
    const hallen = hallenFootprints();
    expect(hallen.length, "es fehlen Hallen").toBe(3);
    for (const w of hallenWaende()) {
      /*
       * Die Nordwand der ersten Halle steht buendig an der Suedwand des
       * Bueros — dort meldet die Liste den Betriebshof, und das ist richtig:
       * Gesperrt ist gesperrt, und zwei Steinreihen mit 20 cm Luft dazwischen
       * waeren ein Baufehler.
       */
      expect(hitsObstacle(w.x, w.z, 0)?.label, `Halle ${w.nr} ${w.teil}`).toMatch(
        /^(Halle |Betriebsgebäude)/
      );
    }
    for (const [, z] of hallen) {
      // Innenraum frei — dort steht der Haendler mit seinem Wagen
      expect(hitsObstacle(HALLEN_X, z, 0), `Halleninnenraum bei z=${z}`).toBeNull();
      // Und das Tor ist offen: einen Meter davor steht nichts
      const torX = HALLEN_X + TOR_RICHTUNG.x * (HALLE_TIEFE / 2 + 1.0);
      expect(hitsObstacle(torX, z, 0), `Tor der Halle bei z=${z} zugestellt`).toBeNull();
    }
  });

  it("stellt den Betriebshof neben die Waage in die hintere Ecke", () => {
    // Ausdruecklicher Wunsch (11.09.2026): an die Westwand, nahe der Ecke,
    // in Sichtweite der Waage. Sonst wandert der Bau beim naechsten Umbau
    // wieder mitten auf den Platz.
    for (const [x, z, hw, hd] of officeFootprints()) {
      expect(x - hw, "steht in der Westwand").toBeGreaterThanOrEqual(YARD_MIN_X);
      expect(x + hw, "ragt zu weit auf den Platz").toBeLessThan(-28);
      expect(z + hd, "steht in der Nordwand").toBeLessThanOrEqual(YARD_D / 2);
    }
    // Das Buero schaut auf die Waage
    expect(Math.hypot(OFFICE_X - WEIGH_X, OFFICE_Z - WEIGH_Z)).toBeLessThan(20);
  });

  it("lässt die Zufahrt zur Waage frei", () => {
    /*
     * Zwischen Gebaeudefront und Wiegeplatte muss ein LKW durchpassen.
     *
     * Die Waage ist am 14.09.2026 neben das Buero gezogen (E-010) und steht
     * damit nicht mehr in der Flucht des Tors: Sie liegt 5,5 m westlich davon.
     * Oben endet die Spur deshalb bei z 26 statt 27 — bei 27 sind es nur noch
     * 2,0 m bis zur Nordmauer, und dort faehrt auch niemand mehr; der Wagen
     * kommt vom Tor herueber. Geprueft wird weiter dieselbe Eigenschaft: Auf
     * der ganzen Wiegestrecke steht nichts im Weg.
     */
    for (let z = 14; z <= 26; z += 1) {
      expect(hitsObstacle(WEIGH_X, z, 2.0), `Waagenspur bei z=${z}`).toBeNull();
    }
  });

  it("lässt die Einfahrt offen", () => {
    expect(hitsObstacle(-22, 29, 0)).toBeNull();
    // beidseits davon steht die Nordwand
    expect(hitsObstacle(-32, 29, 0)).not.toBeNull();
    expect(hitsObstacle(-10, 29, 0)).not.toBeNull();
  });

  it("hält jeden Punkt der echten Fahrspuren frei", () => {
    // Geprüft werden die Routen, die die LKW tatsächlich abfahren — nicht
    // abgeschriebene Werte. Ein blockierter Punkt legt den Verkehr lahm,
    // und genau das ist zweimal passiert: erst durch das Wiegehäuschen,
    // dann durch die zusammengerückten Mulden.
    const routen: Array<[string, Array<[number, number]>]> = [
      ["Einfahrt", ROUTE_IN_FWD],
      ["Anfahrt", routeApproach()],
      ["Rangieren", routeInRev()],
      ["Ausfahrt", routeOut()],
      ["Abholer-Anfahrt", pickupApproach()],
      ["Abholer-Rangieren", pickupInRev()],
      ["Abholer-Ausfahrt", pickupOut()],
    ];
    // Der Kipper faehrt seit E-029 dieselben drei Strecken wie die Pritsche.
    for (const [name, punkte] of routen) {
      for (const [x, z] of punkte) {
        // 1,4 m ist der Sicherheitsabstand, mit dem die LKW prüfen
        expect(hitsObstacle(x, z, 1.4), `${name} bei (${x}, ${z})`).toBeNull();
      }
    }
  });

  it("die Absetzcontainer stehen bewusst in keiner Hindernisliste", () => {
    /*
     * Sie sind bewegliche Koerper (E-081) und wandern, sobald der Bagger sie
     * zieht. Ein fester Eintrag zeigte nach dem ersten Zug auf leeren Boden —
     * und der Container selbst waere unsichtbar geworden. Ihre Kollision
     * kommt aus der Physik, nicht aus dieser Liste.
     */
    for (const c of SORTIERMULDEN) {
      expect(hitsObstacle(c.x, c.z, 0), `${c.label}: darf nicht fest eingetragen sein`).toBeNull();
    }
  });

  it("kein Absetzcontainer steht in einer Fahrspur", () => {
    // Sie sind fuer die LKW unsichtbar. Steht einer im Weg, faehrt ihm der
    // naechste Kipper hinein, statt zu warten.
    const spuren: Array<[string, Array<[number, number]>]> = [
      ["Anfahrt", routeApproach()],
      ["Rangieren", routeInRev()],
      ["Abholer", pickupApproach()],
      ["Abholer-Rangieren", pickupInRev()],
    ];
    for (const c of SORTIERMULDEN) {
      const [w, d] = c.size;
      for (const [name, punkte] of spuren) {
        for (const [x, z] of punkte) {
          const zu =
            Math.abs(x - c.x) < w / 2 + 1.8 && Math.abs(z - c.z) < d / 2 + 1.8;
          expect(zu, `${c.label} steht auf der Spur ${name} bei (${x}, ${z})`).toBe(false);
        }
      }
    }
  });

  it("lässt die Silos zum Platz hin offen", () => {
    /*
     * Sie stehen an der Wand und oeffnen sich zum Platz. Waere die Oeffnung
     * zugestellt, kaeme weder Radlader noch Abholer hinein.
     *
     * Seit dem 15.09.2026 liegt die Reihe an der gegenueberliegenden Wand und
     * oeffnet sich nach WESTEN (Standardrichtung). Die Seite kommt deshalb aus
     * `facing`, nicht mehr aus einem festen Vorzeichen — sonst prueft der
     * Waechter beim naechsten Umzug die geschlossene Seite.
     */
    for (const c of SILOS) {
      const v = bayVorderkante(c);
      const r = bayRuecken(c);
      const o = bayOeffnung(c);
      expect(hitsObstacle(c.x, c.z, 0), `${c.label}: Innenraum frei`).toBeNull();
      expect(
        hitsObstacle(v.x + o.x * 0.9, v.z + o.z * 0.9, 0),
        `${c.label}: Öffnung frei`
      ).toBeNull();
      expect(hitsObstacle(r.x, r.z, 0), `${c.label}: Rückwand sperrt`).not.toBeNull();
    }
  });

  it("die beiden Halden haben keine eigenen Wände — die Ausbuchtung hält sie", () => {
    /*
     * Ansage 13.09.2026: „die Abgrenzung, die du da neu gezogen hast, die
     * gehoeren da eigentlich gar nicht hin bzw. koennen weg … der Mischschrott
     * liegt einfach nur daneben, ohne dass das irgendwie abgegrenzt wird."
     *
     * Mit E-010 (14.09.2026) ist daraus die Ausbuchtung geworden: Die Halden
     * liegen in einer Wanne, die rundum Platzgrenze ist. Die Eigenschaft
     * bleibt dieselbe — KEINE eigene Wand um die Halde —, nur haelt sie jetzt
     * die Buchtwand statt der alten Aussenmauer. Geprueft wird deshalb an
     * derselben Stelle wie vorher, aber gegen das, was dort heute steht.
     */
    const h = CONFIGS.find((c) => c.id === "c_mixed")!;
    const s = CONFIGS.find((c) => c.id === "c_steel")!;
    const [w, d] = h.size;
    expect(hitsObstacle(h.x, h.z, 0), "Innenraum frei").toBeNull();
    expect(hitsObstacle(s.x, s.z, 0), "Innenraum der Stahlhalde frei").toBeNull();
    // Nach Norden offen: dort steht der Bagger und greift hinein.
    expect(hitsObstacle(h.x, h.z + d / 2 + 1.2, 0), "Vorderseite offen").toBeNull();
    /*
     * Aussen haelt die Buchtwand — dieselbe Probe, nur 10 cm weiter draussen.
     * „Aussen" ist die Seite weg von den Trennsteinen; seit dem Tausch E-122
     * ist das beim Mischschrott −x. Aus der Lage gerechnet statt abgeschrieben.
     */
    const weg = Math.sign(h.x - TRENNSTEIN_X);
    const aussen = hitsObstacle(h.x + weg * (w / 2 + 0.2), h.z, 0);
    expect(aussen, "Aussenwand sperrt").not.toBeNull();
    expect(aussen!.label, "es ist nicht die Buchtwand").toContain("Bucht");
    /*
     * Zwischen den beiden Halden steht nur die Pyramide aus Trennsteinen. Sie
     * darf den Arm nicht aufhalten: „sodass der Zugriff von Mischschrott zu
     * Stahlschrott fluessig laeuft." Geprueft wird das ueber die Hoehe — auf
     * 2,5 m ist dort nichts mehr.
     */
    expect(
      hitsObstacle(h.x - weg * (w / 2 + 0.4), h.z, 0, 2.5),
      "zur Stahlhalde hin steht etwas Hohes im Weg"
    ).toBeNull();
  });

  it("alles steht innerhalb der Platzgrenzen oder in der Ausbuchtung", () => {
    /*
     * Seit die Ostgrenze an die Mulden herangerueckt ist (x 10,5 statt 40),
     * muss geprueft werden, dass nichts jenseits davon liegt.
     *
     * Seit E-010 gibt es eine zweite erlaubte Flaeche: die Ausbuchtung hinter
     * dem Bagger. Sie ist Platz, nicht Ausland — was darin liegt, steht
     * innerhalb der Mauern. Ein Behaelter muss also entweder ganz im Rechteck
     * oder ganz in der Bucht liegen; halb draussen zaehlt weiter als Fehler.
     */
    for (const c of CONFIGS) {
      const [w, d] = c.size;
      expect(c.x + w / 2, `${c.label} ragt ueber die Ostgrenze`).toBeLessThan(YARD_MAX_X);
      expect(c.x - w / 2, `${c.label} ragt ueber die Westgrenze`).toBeGreaterThan(YARD_MIN_X);
      const imRechteck = Math.abs(c.z) + d / 2 < YARD_D / 2;
      const inDerBucht =
        c.x - w / 2 >= BUCHT_X_VON &&
        c.x + w / 2 <= BUCHT_X_BIS &&
        c.z - d / 2 >= BUCHT_Z &&
        c.z + d / 2 <= -YARD_D / 2;
      expect(imRechteck || inDerBucht, `${c.label} ragt ueber Nord/Sued`).toBe(true);
    }
  });

  it("die Platzgrenze steht dicht hinter den Silos", () => {
    /*
     * Der Sinn des Verkleinerns: keine Leere mehr zwischen letzter Mulde und
     * Mauer. Frueher lagen dort ueber 30 m.
     *
     * Seit dem 15.09.2026 ist es die OSTgrenze — die Reihe hat die Wand
     * gewechselt. Gemessen wird gegen die Wand, an der die Reihe steht, nicht
     * gegen eine fest eingetragene.
     */
    for (const c of SILOS) {
      const r = bayRuecken(c);
      // Jedes Silo gegen die Wand, an der es steht — seit E-028 sind das zwei
      // verschiedene (Westwand und Suedmauer).
      const luft =
        c.facing === "north" ? r.z - -(YARD_D / 2) : r.x - YARD_MIN_X;
      expect(luft, `${c.label}: ${luft.toFixed(1)} m Leere hinter der Mulde`).toBeLessThan(4);
      expect(luft, `${c.label}: die Mauer steht auf der Mulde`).toBeGreaterThan(0.8);
    }
  });

  it("an der alten Reifenstelle steht nichts mehr — und nichts Unsichtbares", () => {
    /*
     * Der Reifencontainer ist am 14.09.2026 abends ersatzlos entfallen
     * (Ansage). Er stand auf (4,1 | −17,6), also genau in der Spur, in der
     * jetzt der LKW an seinen Abladeplatz zurueckstoesst. Bleibt ein
     * Hindernis zurueck, faehrt dort nie wieder ein Wagen durch — und zu
     * sehen waere davon nichts.
     */
    expect(CONFIGS.find((c) => c.id === "c_tires"), "Reifencontainer steht noch im Katalog")
      .toBeUndefined();
    for (const dz of [-3, 0, 3]) {
      expect(hitsObstacle(4.1, -17.6 + dz, 0), "unsichtbare Wand an der alten Reifenstelle")
        .toBeNull();
    }
  });

  it("der neue LKW-Abladeplatz ist auf ganzer Länge frei", () => {
    /*
     * Der Wagen steht dort quer, 8,6 m lang und 3,1 m breit. Was ihn
     * streift, sieht man erst, wenn er halb in einer Mulde steht.
     */
    for (let z = ABLADE_HALT_Z; z <= ABLADE_HALT_Z + 8.6; z += 0.4) {
      for (const dx of [-1.55, 0, 1.55]) {
        expect(
          hitsObstacle(ABLADE_SPUR_X + dx, z, 0.2),
          `Abladeplatz bei (${(ABLADE_SPUR_X + dx).toFixed(2)} | ${z.toFixed(1)}) zugestellt`
        ).toBeNull();
      }
    }
    // Und ringsum bleibt Luft: 1,0 m zur nächsten festen Wand.
    expect(
      hitsObstacle(ABLADE_SPUR_X, ABLADE_HALT_Z, 1.0),
      "hinter dem Wagen ist es zu eng"
    ).toBeNull();
  });

  it("lässt den Arm über niedrige Mauern schwenken, aber nicht hindurch", () => {
    // Umrandung ist 1,8 m hoch
    // Eine Stelle der Suedwand, an der keine Mulde dahintersteht
    expect(hitsObstacle(-30, -29, 0, 1.0), "unterhalb sperrt").not.toBeNull();
    expect(hitsObstacle(-30, -29, 0, 2.5), "darüber ist frei").toBeNull();
  });

  it("hat für jedes Bauwerk eine sinnvolle Höhe", () => {
    for (const o of STATIC_OBSTACLES) {
      expect(o.top, `${o.label} braucht eine Höhe`).toBeGreaterThan(0);
      expect(o.hw, `${o.label} braucht Breite`).toBeGreaterThan(0);
      expect(o.hd, `${o.label} braucht Tiefe`).toBeGreaterThan(0);
    }
  });

  it("lenkt eine Richtung an der Wand entlang, statt hindurch", () => {
    const out = { x: 0, z: 0 };
    // Von Süden frontal auf die Südwand einer Sortiermulde zu
    const mulde = SILOS[0]!;
    const abgelenkt = slideAround(mulde.x, mulde.z - mulde.size[1] / 2 - 0.9, 0, 1, 0.7, out);
    expect(abgelenkt).toBe(true);
    expect(Math.hypot(out.x, out.z)).toBeCloseTo(1, 3);
  });

  it("meldet freie Fläche als frei", () => {
    const out = { x: 0, z: 0 };
    expect(slideAround(-10, 2, 0, 1, 0.7, out)).toBe(false);
  });
});

describe("Reichweite des Baggers", () => {
  it("erreicht die Absetzcontainer von der Arbeitslinie aus", () => {
    /*
     * Reine Entfernungsprobe gegen die kurze Arbeitslinie (−6 | −16) bis
     * (−6 | −11,5). Wie hoch der Arm dabei kommt, prueft test/reach.test.ts —
     * das ist die schaerfere Bedingung.
     */
    for (const c of SORTIERMULDEN) {
      let naechste = Infinity;
      for (let t = 0; t <= 1.0001; t += 0.05) {
        const pz = BAGGER_Z + t * 5;
        naechste = Math.min(naechste, Math.hypot(c.x - BAGGER_X, c.z - pz));
      }
      expect(naechste, `${c.label} muss in Reichweite liegen`).toBeLessThan(REICHWEITE_M);
    }
  });

  it("erreicht die offene Seite der Presse", () => {
    /*
     * Naechster Punkt der Kammer, nicht deren Mitte. Sie steht seit dem
     * Umbau vom 13.09.2026 in der Ecke, nicht mehr in der Sitzachse.
     *
     * Seit E-029 steht sie nicht mehr als EIN Rechteck in der Liste, sondern
     * als Wandring (sonst kaeme der Greifer nicht auf den Kammerboden). Der
     * Fussabdruck wird deshalb aus den vier Waenden zusammengesetzt — aus
     * derselben Liste, in der er wirklich steht.
     */
    const presse = presseFuss();
    const dz = Math.abs(presse.z + presse.hd - BAGGER_Z);
    const dx = Math.max(0, Math.abs(presse.x - BAGGER_X) - presse.hw);
    expect(Math.hypot(dx, dz)).toBeLessThan(REICHWEITE_M);
  });

  it("die Silos stehen in zwei Fluchten — Westwand und Suedwand", () => {
    /*
     * Der Abholer faehrt einen Schenkel in einem Zug ab (Ansage 12.09.2026).
     * Steht eines aus der Reihe, muss er rangieren, und die Spur trifft es
     * nicht mehr. Seit E-028 gibt es ZWEI Fluchten; geprueft wird jede fuer
     * sich, sonst meldet der Waechter die Ecke als Fehler.
     */
    const west = SILOS.filter((c) => c.facing === "east");
    const sued = SILOS.filter((c) => c.facing === "north");
    expect(west.length, "kein Westschenkel").toBeGreaterThan(0);
    expect(sued.length, "kein Suedschenkel").toBeGreaterThan(0);
    for (const c of west) expect(c.x, `${c.label} nicht in der Westflucht`).toBeCloseTo(west[0]!.x, 3);
    for (const c of sued) expect(c.z, `${c.label} nicht in der Suedflucht`).toBeCloseTo(sued[0]!.z, 3);
  });

  it("die Ruecknwand ist hoeher als die Flanken", () => {
    // Beim Einfuellen von oben fliegt regelmaessig ein Stueck ueber die hintere
    // Kante — dahinter ist es verloren.
    const c = SILOS[0]!;
    const wand = STATIC_OBSTACLES.find((o) => o.label === `${c.label} Stirn`)!;
    const flanke = STATIC_OBSTACLES.find((o) => o.label === `${c.label} Süd`)!;
    expect(wand.top).toBeGreaterThan(flanke.top);
  });

  it("die Presse steht an der Westflanke, die zwei gleich grossen Boxen hinter dem Bagger", () => {
    /*
     * Die Anordnung aus der Sitzperspektive: Links vom Sitz ist +x, rechts
     * ist −x (E-086).
     *
     * Bis zum 14.09.2026 mittags stand die Presse LINKS aussen in der Ecke
     * (Ansage 13.09.2026). Am Abend hat Patrick sie dort weggenommen: „Die
     * Presse muss weg, da wo sie gerade steht, und da kommt der LKW hin." Sie
     * steht jetzt RECHTS vom Sitz an der Westflanke. Geprueft wird weiter die
     * Anordnung und nicht die Koordinate — nur eben die neue.
     */
    const halde = CONFIGS.find((c) => c.id === "c_mixed")!;
    const stahl = CONFIGS.find((c) => c.id === "c_steel")!;
    const presse = presseFuss();
    expect(presse.x, "Presse nicht rechts vom Sitz").toBeLessThan(halde.x);
    // E-122 (06.10.2026, „Plaetze fuer Mischschrott und Stahlschrott
    // tauschen"): Mischschrott rechts (−x, zur Presse), Stahlschrott links.
    expect(stahl.x, "Stahlschrott nicht links vom Mischschrott").toBeGreaterThan(halde.x);
    // Und da, wo sie stand, darf keine unsichtbare Wand zurueckbleiben.
    expect(hitsObstacle(6.6, -24.6, 0), "die alte Pressenstelle sperrt noch").toBeNull();
    /*
     * Gleich gross waren sie nur einen halben Tag. Am 13.09.2026 kam die Ansage
     * „Wand entfernen lassen, Lego-Mulden fuer Alu, VA, Kabel und Kupfer dort
     * hinsetzen" — die Reihe steht jetzt dort, wo die Stahlbox breit war, und
     * die Stahlbox ist auf 4 m zurueckgegangen. Gleich geblieben ist, was
     * beide haelt: die erhoehte Suedmauer im Ruecken, auf ganzer Tiefe.
     */
    expect(stahl.size[1], "die Boxen sind nicht mehr gleich tief").toBe(halde.size[1]);
    expect(stahl.size[2], "die Boxen sind nicht mehr gleich hoch").toBe(halde.size[2]);
    for (const [name, z] of [
      ["Mischschrott", halde.z],
      ["Stahlbox", stahl.z],
      ["Presse", presse.z],
    ] as Array<[string, number]>) {
      expect(z, `${name} liegt nicht hinter dem Bagger`).toBeLessThan(BAGGER_Z);
    }
  });

  it("kein Hindernis steht dort, wo gar nichts gebaut ist", () => {
    /*
     * Die Presse ist am 13.09.2026 von (−3,0 | −26,0) in die Ecke auf
     * (6,6 | −26,0) gezogen — ihr Eintrag in STATIC_OBSTACLES blieb stehen.
     * Einen halben Tag lang stand damit eine unsichtbare Wand von 7,8 x 5,0 m
     * hinter dem Bagger, und an der Presse selbst gar keine. Seitdem kommen
     * Lage und Mass aus press.ts; dieser Test haelt fest, dass sie
     * zusammenbleiben.
     */
    const presse = presseFuss();
    expect(presse.x).toBeCloseTo(PRESS_CENTER.x, 6);
    expect(presse.z).toBeCloseTo(PRESS_CENTER.z, 6);
    /*
     * Seit E-029 ist die KAMMER frei und nur der Wandring sperrt — sonst kommt
     * der Greifer nicht an das Paket. Geprueft wird deshalb der Ring, nicht
     * die Mitte: Die Wandmitten sperren, der Kammerboden ist offen.
     */
    expect(hitsObstacle(PRESS_CENTER.x, PRESS_CENTER.z, 0), "die Kammer ist zugemauert")
      .toBeNull();
    for (const w of pressWaende()) {
      expect(hitsObstacle(w.x, w.z, 0), `Pressenwand ${w.teil} sperrt nicht`).not.toBeNull();
    }
    // Die Stelle, an der sie bis zum Abend des 14.09.2026 stand, muss frei
    // sein — dort steht jetzt der LKW.
    expect(hitsObstacle(6.6, -24.6, 0), "alte Pressenstelle sperrt noch").toBeNull();
  });

  it("schließt mittig, ohne dass die Spitzen sich überlappen", () => {
    /*
     * Geschlossen heisst bei der Sichelkralle nicht Spreizung 0: Die Schalen
     * haengen an einem Bolzenkreis von 0,25 m; bei 0 stehen sie senkrecht nach
     * unten und ihre Spitzen liegen weit auseinander. Erst nach 0,85 rad
     * Ausschwenken treffen sie sich auf der Achse.
     *
     * Der Fuenfschalengreifer vom 13.09.2026 liess dort ein Loch von 0,12 m,
     * weil fuenf Spitzen endlicher Breite sich nicht auf einem Punkt treffen
     * koennen. Diese Form hat drei Segmente und schliesst auf der Achse; die
     * Schranke ist deshalb wieder „nahe null" (Rueckbau 13.09.2026).
     */
    const p = clawPoint(0, CLAW_CLOSED_SPLAY, CLAW_SEGMENTS, new THREE.Vector3());
    // Radius nahe null heisst: die Spitzen treffen sich in der Mitte
    expect(Math.abs(Math.hypot(p.x, p.z))).toBeLessThan(0.05);
  });

  it("öffnet weit genug, um etwas zu fassen", () => {
    /*
     * Hier stand auch eine Obergrenze: „Innenbreite der Mulde ist 3,8 m".
     * Eine abgeschriebene Zahl, die nach jedem Umbau der Behälter falsch war —
     * zuletzt schlug sie an, obwohl die Behälter längst 4,7 m messen. Ob die
     * Spinne in einen Behälter passt, prüft `test/spinnenmass.test.ts` gegen
     * die echten Maße aus CONFIGS. Eine Regel, ein Besitzer.
     */
    /*
     * 2,30 m Spitzenweite — die Zahl der Positionsliste, jetzt im Maßstab 1:1
     * statt vergrößert. Die alte Sichelkralle öffnete 3,38 m, weil sie eine um
     * ein Viertel aufgeblasene MG4.1-800 war.
     *
     * Die Schranke steht bei 2,0 m, und der Grund ist nachgemessen: Von den 44
     * Schrottsorten hat die sperrigste eine mittlere Kante von 1,90 m (Waggon-
     * Drehgestell, LKW-Fahrerhaus). Was darunter fällt, passt nicht mehr
     * zwischen die Spitzen — dann ist im Spiel etwas nicht mehr aufnehmbar,
     * und das soll auffallen, bevor es jemand beim Spielen merkt.
     */
    expect(clawSpan(CLAW_OPEN_SPLAY)).toBeGreaterThan(2.0);
  });

  it("öffnet weiter, als es schließt", () => {
    expect(clawSpan(CLAW_OPEN_SPLAY)).toBeGreaterThan(clawSpan(0));
  });

  it("liefert eine Spitzentiefe, die zum Bodenanschlag passt", () => {
    /*
     * Hier stand zweimal eine Behauptung darueber, welche Stellung die tiefere
     * ist — erst „zu ist tiefer", dann „offen ist tiefer". Beide waren fuer
     * ihre jeweilige Form richtig und wurden beim naechsten Formwechsel
     * falsch. Die Frage ist ohnehin die falsche: Fuer den Bodenanschlag zaehlt
     * nicht, welche Stellung tiefer ist, sondern dass mit der tiefsten
     * gerechnet wird.
     */
    const offen = clawTipDepth(CLAW_OPEN_SPLAY);
    const zu = clawTipDepth(CLAW_CLOSED_SPLAY);
    expect(offen).toBeGreaterThan(1.5);
    expect(zu).toBeGreaterThan(1.5);
    expect(CLAW_MAX_DEPTH, "Maximum liegt unter einer Einzelstellung").toBeGreaterThanOrEqual(
      Math.max(offen, zu) - 1e-9
    );
    for (let i = 0; i <= 20; i++) {
      expect(clawTipDepth((CLAW_OPEN_SPLAY * i) / 20)).toBeLessThanOrEqual(CLAW_MAX_DEPTH + 1e-9);
    }
    /*
     * Obergrenze der Spitzentiefe. Sie huetet, dass der Greifer nicht so lang
     * wird, dass der Arm ihn nicht mehr ueber eine Wand hebt. Dass es reicht,
     * prueft nicht diese Zahl, sondern `test/reach.test.ts`: dort wird fuer
     * jede Mulde nachgerechnet, ob der Arm ueber ihre Wand kommt.
     */
    expect(CLAW_MAX_DEPTH).toBeLessThan(3.0);
  });

  it("läuft vom Gelenk bis zur Spitze durchgehend abwärts", () => {
    /*
     * Die Schale ist ein gleichmäßiger Bogen von 86°, kein Haken: Sie krümmt
     * sich zur Achse hin, läuft dabei aber bis zur Spitze weiter nach unten.
     *
     * Am 13.09.2026 stand hier kurz das Gegenteil — ein Rücklauf nach oben.
     * Der kam aus einer 170°-Form, die aus nur zwei Datenblattmaßen
     * zurückgerechnet war. Gegen alle sechs Maße gerechnet bleibt der flache
     * Bogen übrig, und der hakt nicht.
     */
    let vorher = 0;
    for (let k = 1; k <= CLAW_SEGMENTS; k++) {
      const tiefe = -clawPoint(0, CLAW_CLOSED_SPLAY, k, new THREE.Vector3()).y;
      expect(tiefe, `Station ${k} läuft nicht weiter abwärts`).toBeGreaterThan(vorher);
      vorher = tiefe;
    }
  });

  it("nimmt für den Bodenanschlag den tiefsten Punkt der Schale — Kette ODER Zahn", () => {
    /*
     * Die Rechnung geht über alle Stationen, und das ist Absicht: Sobald jemand
     * am Krümmungsprofil dreht und die Schale am Ende nach innen hakt, wandert
     * der tiefste Punkt nach oben. Wer dann noch nach der Spitze absetzt, fährt
     * mit dem Bauch der Schale in den Beton, ohne dass ein Test anschlägt.
     *
     * Bis zum 14.09.2026 stand hier `clawTipDepth === tiefste Station` — ein
     * Gleichheitszeichen gegen genau das Modell, aus dem `clawTipDepth` selbst
     * kommt. Der Test hat sich damit selbst bestaetigt und den gezeichneten
     * Zahnkegel uebersehen, der 12,4 cm tiefer haengt (Befund am Geraet: „die
     * kleinen aeussersten Noppen verschwinden im Boden").
     *
     * Der Waechter ist damit nicht schwaecher, sondern breiter: Er verlangt
     * weiterhin, dass der Kettenbauch mitgerechnet wird, und zusaetzlich, dass
     * der Zahn mitgerechnet wird. Ob die Zahnrechnung zum GEZEICHNETEN Zahn
     * passt, prueft `test/spinnenmodell.test.ts` am Mesh.
     */
    for (const splay of [CLAW_CLOSED_SPLAY, CLAW_OPEN_SPLAY]) {
      let kette = 0;
      for (let k = 1; k <= CLAW_SEGMENTS; k++) {
        kette = Math.max(kette, -clawPoint(0, splay, k, new THREE.Vector3()).y);
      }
      expect(clawTipDepth(splay)).toBeCloseTo(Math.max(kette, clawToothDepth(splay)), 6);
      expect(clawTipDepth(splay), "Kettenbauch faellt unter den Tisch").toBeGreaterThanOrEqual(
        kette - 1e-9
      );
      expect(clawTipDepth(splay), "der Zahn faellt unter den Tisch").toBeGreaterThanOrEqual(
        clawToothDepth(splay) - 1e-9
      );
    }
  });
});

/**
 * Ungleichmäßiges Schließen der Spinne (Wunsch 10.09.2026).
 *
 * Steckt eine Stange zwischen zwei Zähnen, sollen genau die beiden stehen
 * bleiben und die anderen drei weiter zugehen. Ein Greifer bleibt dabei nicht
 * schlagartig stehen — er drückt noch ein Stück nach, bis der Druck steht.
 * Kleinerer Winkel heißt weiter geschlossen.
 */
describe("Krallen schließen einzeln", () => {
  const SCHRITT = 0.1;
  const R = NACHDRUECK_RESERVE;

  it("eine freie Kralle geht weiter zu", () => {
    expect(naechsteSpreizung(1.0, 0.4, SCHRITT, false, R).winkel).toBeCloseTo(0.9, 6);
  });

  it("oeffnen geht auch dann, wenn etwas im Weg ist", () => {
    // Sonst bliebe eine Kralle fuer immer stecken, sobald sie einmal aufsitzt
    expect(naechsteSpreizung(0.5, 1.25, SCHRITT, true, 0).winkel).toBeCloseTo(0.6, 6);
  });

  it("das Ziel wird nicht ueberschossen", () => {
    expect(naechsteSpreizung(0.45, 0.4, SCHRITT, false, R).winkel).toBeCloseTo(0.4, 6);
    expect(naechsteSpreizung(1.2, 1.25, SCHRITT, false, R).winkel).toBeCloseTo(1.25, 6);
  });

  it("blockiert wird nachgedrueckt, langsam und begrenzt", () => {
    // Erstes Bild: die Kralle steht nicht, sie setzt nach
    const a = naechsteSpreizung(1.0, 0.4, SCHRITT, true, R);
    expect(a.winkel, "die Kralle bleibt schlagartig stehen").toBeLessThan(1.0);
    expect(1.0 - a.winkel, "sie drueckt so schnell nach wie sonst").toBeLessThan(SCHRITT);
    expect(a.reserve).toBeLessThan(R);
  });

  it("das Nachdruecken ist irgendwann zu Ende", () => {
    let winkel = 1.0;
    let reserve = R;
    for (let i = 0; i < 200; i++) {
      const r = naechsteSpreizung(winkel, 0.4, SCHRITT, true, reserve);
      winkel = r.winkel;
      reserve = r.reserve;
    }
    expect(reserve).toBe(0);
    // Nachgedrueckt hat sie genau ihre Reserve, nicht mehr
    expect(1.0 - winkel).toBeCloseTo(R, 6);
    /*
     * ... und ist damit weit vom kommandierten Winkel entfernt geblieben.
     *
     * Geprueft wird der Abstand zum Kommando, nicht mehr die feste Schranke
     * 0,8. Die stand fuer eine Reserve von 0,12 rad; seit sie am 13.09.2026 auf
     * 0,38 steht („die Spinne greift nicht richtig"), waere sie nur noch die
     * alte Zahl und nicht die Eigenschaft.
     */
    expect(winkel - 0.4, "der Zahn ist bis zum Kommando durchgelaufen").toBeGreaterThan(0.1);
  });

  it("wer loslaesst, bekommt seine Reserve zurueck", () => {
    const zu = naechsteSpreizung(1.0, 0.4, SCHRITT, true, 0.01);
    expect(zu.reserve).toBeLessThanOrEqual(0.01);
    const auf = naechsteSpreizung(zu.winkel, 1.25, SCHRITT, true, zu.reserve);
    expect(auf.reserve, "sonst drueckt sie beim naechsten Griff nicht mehr nach").toBe(R);
  });

  it("die Stange zwischen zwei Zaehnen: drei gehen zu, zwei bleiben", () => {
    const blockiert = [false, true, true, false, false];
    let winkel = [1.25, 1.25, 1.25, 1.25, 1.25];
    let reserve = [R, R, R, R, R];
    for (let i = 0; i < 60; i++) {
      const neu = winkel.map((w, k) =>
        naechsteSpreizung(w, 0.3, SCHRITT, blockiert[k]!, reserve[k]!)
      );
      winkel = neu.map((n) => n.winkel);
      reserve = neu.map((n) => n.reserve);
    }
    expect(winkel[0]).toBeCloseTo(0.3, 6);
    expect(winkel[3]).toBeCloseTo(0.3, 6);
    // Die blockierten haben nachgedrueckt, aber nur um ihre Reserve
    expect(winkel[1]).toBeCloseTo(1.25 - R, 6);
    expect(winkel[2]).toBeCloseTo(1.25 - R, 6);
    const spanne = Math.max(...winkel) - Math.min(...winkel);
    expect(spanne, "die Spinne geht wieder gleichmaessig zu").toBeGreaterThan(0.5);
  });
});
