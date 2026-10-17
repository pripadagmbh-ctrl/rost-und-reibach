/**
 * Wächter für die ganzen Strecken, nicht nur ihre Stützpunkte.
 *
 * `test/collision.test.ts` prüft die Ecken der Routen. Ein LKW fährt aber
 * nicht von Ecke zu Ecke, sondern die Strecke dazwischen ab und tastet dabei
 * mit 1,40 m nach festen Bauten (`isBlockedByBuilding`). Ein Bauwerk, das nur
 * die Mitte eines Abschnitts streift, hält ihn genauso auf — und feste Bauten
 * kennen keine Aufgeben-Regel: Was sie versperren, bleibt versperrt.
 *
 * Anlass ist der Umbau vom Abend des 14.09.2026: Der Abladeplatz ist in die
 * Südostecke gezogen, und die Rückwärtsstrecke läuft dort 16 m an der
 * Müllmulde entlang.
 */
import { describe, it, expect } from "vitest";
import { hitsObstacle } from "../src/world/obstacles";
import {
  ROUTE_IN_FWD,
  routeApproach,
  routeInRev,
  routeOut,
  pickupApproach,
  pickupInRev,
  pickupOut,
  bayApproach,
  bayInRev,
  bayOut,
} from "../src/delivery/routes";
import { CONFIGS } from "../src/world/containers";
import { endlich, mindestens } from "./zahl";

/** Derselbe Tastradius, mit dem die Fahrzeuge prüfen. */
const TASTRADIUS = 1.4;

function strecke(name: string, punkte: Array<[number, number]>): void {
  /*
   * Zwei Zeilen gegen den Waechter, der nichts prueft (E-038).
   *
   * Bei `punkte.length < 2` laeuft die Schleife unten NULL mal und der Test
   * ist gruen — dasselbe Ergebnis wie bei einer Strecke, die tatsaechlich frei
   * ist. Und bei `NaN` unter den Punkten ist jeder Vergleich falsch, also
   * findet `hitsObstacle` nie etwas. Genau so war es hier am 15.09.2026.
   */
  endlich(punkte, `${name}: Wegpunkte`);
  mindestens(punkte.length, 2, `${name}: Wegpunkte`);
  /** Wieviele Tastpunkte wirklich gegen die Bauten gerechnet wurden. */
  let getastet = 0;
  for (let i = 0; i < punkte.length - 1; i++) {
    const [ax, az] = punkte[i]!;
    const [bx, bz] = punkte[i + 1]!;
    const laenge = Math.hypot(bx - ax, bz - az);
    const schritte = Math.max(2, Math.ceil(laenge / 0.25));
    for (let k = 0; k <= schritte; k++) {
      const t = k / schritte;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      const o = hitsObstacle(x, z, TASTRADIUS);
      getastet++;
      expect(
        o,
        `${name}: bei (${x.toFixed(2)} | ${z.toFixed(2)}) steht ${o?.label} im Weg`
      ).toBeNull();
    }
  }
  mindestens(getastet, 3, `${name}: Tastpunkte`);
}

describe("Jede Fahrstrecke ist auf ganzer Länge frei", () => {
  const silos = CONFIGS.filter((c) => c.lager === true);

  const routen: Array<[string, Array<[number, number]>]> = [
    ["Einfahrt", ROUTE_IN_FWD],
    ["Händler-Anfahrt", routeApproach()],
    ["Händler-Rückwärts", routeInRev()],
    ["Händler-Ausfahrt", routeOut()],
    ["Abholer-Anfahrt", pickupApproach()],
    ["Abholer-Rückwärts", pickupInRev()],
    ["Abholer-Ausfahrt", pickupOut()],
  ];
  /*
   * Der Kipper faehrt seit E-029 DIESELBEN drei Strecken wie die Pritsche —
   * eine eigene Spur hat er nicht mehr. Sie stehen deshalb nur noch einmal in
   * der Liste; ein zweiter Eintrag pruefte dieselben Punkte ein zweites Mal.
   */

  for (const [name, punkte] of routen) {
    it(`${name}`, () => strecke(name, punkte));
  }

  /*
   * Die Silo-Anfahrten enden IN der Mulde — dort ist das Bauwerk das Ziel
   * und kein Hindernis. Geprüft wird deshalb nur die Gasse davor.
   */
  for (const c of silos) {
    it(`Silo-Gasse vor ${c.label}`, () => {
      /*
       * MIT DEM DATENSATZ, nicht mit `c.z`. Hier stand bis zum 15.09.2026
       * `bayApproach(c.z)` — seit E-028 nimmt die Funktion den ganzen
       * Container. Eine Zahl hat kein `.facing` und kein `.z`, also kamen
       * Strecken mit `undefined`/`NaN` heraus, und jeder Vergleich mit NaN ist
       * falsch: Der Wächter hat monatelang nichts geprüft. Seit dem
       * 15.09.2026 sieht `tsc` auch `test/` an (E-038,
       * `tsconfig.test.json`) und fängt genau diesen Aufruf.
       */
      const an = endlich(bayApproach(c), `Anfahrt ${c.label}`);
      strecke(`Anfahrt ${c.label}`, an.slice(0, an.length - 1));
      const aus = endlich(bayOut(c), `Ausfahrt ${c.label}`);
      strecke(`Ausfahrt ${c.label}`, aus.slice(1));
      /*
       * Und das letzte Stueck in die Mulde hinein ist eine Gerade. Bis E-140
       * bestand der Rueckweg aus genau zwei Punkten; seit dem Rangierzug
       * (`rangierplan.ts`) beginnt er mit einem Bogen und endet mit
       * mindestens 6 m Geraden in der Spur der Mulde.
       */
      const rev = bayInRev(c);
      const [ex, ez] = rev[rev.length - 1]!;
      const [vx, vz] = rev[rev.length - 2]!;
      const quer = c.facing === "north" ? Math.abs(vx - ex) : Math.abs(vz - ez);
      expect(quer, `${c.label}: die letzte Gerade liegt nicht in der Spur`).toBeLessThan(0.01);
    });
  }
});
