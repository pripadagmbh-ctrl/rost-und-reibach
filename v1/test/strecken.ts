/**
 * ALLE STRECKEN DES PLATZES — einmal aufgeschrieben, von drei Geraeten benutzt.
 *
 * Die Liste stand bis zum 16.09.2026 als `alleStrecken()` in
 * `test/fahrumriss.test.ts`. Sie ist dort hinausgezogen, weil der
 * Rangierknick-Waechter (`test/rangierknick.test.ts`) und das Messwerkzeug
 * (`tools/rangierknick.ts`) dieselbe Liste brauchen — und zwar dieselbe und
 * nicht eine zweite Abschrift. Zwei Abschriften laufen auseinander, sobald
 * eine Strecke dazukommt, und der zweite Waechter prueft dann eine Strecke
 * weniger, ohne es zu sagen (das ist die Lehre aus E-041).
 *
 * ZWEI SICHTEN AUF DASSELBE:
 *
 *   `alleStrecken()`  Einzelstrecken. Antwortet auf „faehrt irgendwo ein
 *                     Umriss durch ein Bauwerk".
 *   `fahrplaene()`    Ketten. Antwortet auf „wie gross ist der Knick am
 *                     UEBERGANG von einer Strecke zur naechsten" — und genau
 *                     dort steht der schaerfste (168,7 Grad beim Wechsel
 *                     `shiftPause` → `reverseIn`, E-073). Wer nur
 *                     Einzelstrecken ansieht, findet ihn nie.
 */
import { CONFIGS } from "../src/world/containers";
import {
  routeApproach,
  routeInRev,
  routeOut,
  bayApproach,
  bayInRev,
  bayOut,
  ROUTE_IN_FWD,
  PICKUP_IN_FWD,
  PARK_SLOTS,
  routeToPark,
  routeParkRueckVon,
  parkAusfahrt,
  anfahrtVomPlatz,
  neueAbladestelle,
  neueAbholstelle,
  alleAbholPlaetze,
  SPEED,
} from "../src/delivery/routes";

/** Rueckwaerts in die Parkbucht faehrt der Fahrer noch langsamer (`vehicles.ts`). */
const PARK_RUECK_TEMPO = 1.6;

/** Eine Etappe: ein Streckenzug, in einer Richtung, mit ihrem Fahrtempo. */
export interface Etappe {
  name: string;
  route: Array<[number, number]>;
  /** Rueckwaerts heisst: dieselbe Bahn, Kabine um 180 Grad gedreht. */
  rueckwaerts: boolean;
  /** Fahrtempo auf dieser Etappe (m/s) — aus `vehicles.update`. */
  tempo: number;
  /**
   * WELCHE PHASEN AUS `vehicles.update` DIESE STRECKE ABFAHREN.
   *
   * DAS IST DER BLINDE FLECK, DER E-097 MOEGLICH GEMACHT HAT, und er sass
   * nicht in der Hindernisliste, sondern HIER. Die Liste kannte vier Etappen
   * je Fuhre; das Fahrzeug fuhr fuenf. `toPark` rechnete sich seine eigene
   * Luftlinie, und weil sie in keiner Streckenliste stand, hat sie nie jemand
   * abgetastet — der Wagen fuhr 3,10 m tief durch den MUELL-Container.
   *
   * Seit E-098 traegt jede Etappe ihre Phasen, und `test/streckenliste.test.ts`
   * haelt dagegen, was in `vehicles.ts` wirklich `advance()` ruft. Wer eine
   * sechste Etappe einbaut und sie hier vergisst, bekommt es gesagt.
   */
  phasen: string[];
}

/** Was ein Fahrzeug einer Art von der Einfahrt bis zur Ausfahrt abfaehrt. */
export interface Fahrplan {
  name: string;
  /** Fahrzeugart, fuer `bedLenFor` — der Kipper ist der laengste Wagen. */
  kind: string;
  etappen: Etappe[];
}

/** Rueckwaerts faehrt der Fahrer langsamer — dieselbe Zahl wie in `vehicles.ts`. */
const RUECK_TEMPO = SPEED * 0.6;

/**
 * Jede Kette, die auf dem Platz wirklich gefahren wird.
 *
 * Die Reihenfolge ist die der Phasen in `vehicles.update`:
 * `in` → `approach` → (`shiftPause`) → `reverseIn` → … → `out`.
 * Die Pausen dazwischen stehen nicht in der Liste; fuer den Knick zaehlt nur,
 * welche Gierlage am Ende der einen und am Anfang der naechsten Etappe gilt.
 */
export function fahrplaene(): Fahrplan[] {
  neueAbladestelle();
  neueAbholstelle();
  const out: Fahrplan[] = [];
  for (const kind of ["pritsche", "kipper"]) {
    const v = kind === "kipper" ? "Kipper-" : "";
    out.push({
      name: `${kind} zum Abladeplatz`,
      kind,
      etappen: [
        {
          name: `${v}Einfahrt`,
          route: ROUTE_IN_FWD,
          rueckwaerts: false,
          tempo: SPEED,
          phasen: ["in"],
        },
        {
          name: `${v}Anfahrt`,
          route: routeApproach(),
          rueckwaerts: false,
          tempo: SPEED,
          phasen: ["approach"],
        },
        {
          name: `${v}Rangieren`,
          route: routeInRev(),
          rueckwaerts: true,
          tempo: RUECK_TEMPO,
          phasen: ["reverseIn"],
        },
        {
          name: `${v}Ausfahrt`,
          route: routeOut(),
          rueckwaerts: false,
          tempo: SPEED,
          // `nudging` faehrt dieselbe Ausfahrt, nur mit 45 Prozent Tempo und
          // nur ein paar Meter weit (`vehicles.weicheAus`).
          phasen: ["out", "nudging"],
        },
      ],
    });
  }
  for (const p of alleAbholPlaetze()) {
    const wie = p.order ?? "gemischt";
    out.push({
      name: `Abholer ${wie}`,
      kind: "abholer",
      etappen: [
        {
          name: `Abholer ${wie} Einfahrt`,
          route: PICKUP_IN_FWD,
          rueckwaerts: false,
          tempo: SPEED,
          phasen: ["in"],
        },
        {
          name: `Abholer ${wie} Anfahrt`,
          route: p.anfahrt,
          rueckwaerts: false,
          tempo: SPEED,
          phasen: ["approach"],
        },
        {
          name: `Abholer ${wie} Rangieren`,
          route: p.rueckweg,
          rueckwaerts: true,
          tempo: RUECK_TEMPO,
          phasen: ["reverseIn"],
        },
        {
          name: `Abholer ${wie} Ausfahrt`,
          route: p.ausfahrt,
          rueckwaerts: false,
          tempo: SPEED,
          phasen: ["out", "nudging"],
        },
      ],
    });
  }
  for (const c of CONFIGS.filter((s) => s.lager === true)) {
    out.push({
      name: `Silo ${c.label}`,
      kind: "kipper",
      etappen: [
        {
          name: `Silo ${c.label} Einfahrt`,
          route: ROUTE_IN_FWD,
          rueckwaerts: false,
          tempo: SPEED,
          phasen: ["in"],
        },
        {
          name: `Silo ${c.label} Anfahrt`,
          route: bayApproach(c),
          rueckwaerts: false,
          tempo: SPEED,
          phasen: ["approach"],
        },
        {
          name: `Silo ${c.label} Rangieren`,
          route: bayInRev(c),
          rueckwaerts: true,
          tempo: RUECK_TEMPO,
          phasen: ["reverseIn"],
        },
        {
          name: `Silo ${c.label} Ausfahrt`,
          route: bayOut(c),
          rueckwaerts: false,
          tempo: SPEED,
          phasen: ["out", "nudging"],
        },
      ],
    });
  }
  /*
   * DIE FUENFTE UND SECHSTE ETAPPE (E-098) — die, die bis zum 17.09.2026 in
   * keiner Liste stand.
   *
   * Nach dem Abladen faehrt ein Teil der Wagen NICHT vom Hof, sondern auf
   * einen der drei Warteplaetze: erst vorwaerts zur Bucht (`toPark`), dann
   * rueckwaerts hinein (`parkRueck`). Beide Etappen haengen an der Ausfahrt,
   * von der abgebogen wird, und die ist je Fuhre eine andere — deshalb eine
   * Kette je Ausfahrt und Bucht.
   *
   * SIE BEGINNT BEIM RANGIEREN UND NICHT AN DER EINFAHRT. Was hier neu
   * geprueft werden muss, sind die beiden UEBERGAENGE: vom Rueckwaertsstehen
   * am Halteplatz in die Fahrt zum Warteplatz, und von dort in die
   * Rueckwaertsfahrt in die Bucht. Die drei Etappen davor stehen schon
   * vollstaendig in den Ketten oben; sie noch einmal mitzufahren, verdreifachte
   * nur die Laufzeit des Waechters.
   */
  const ketten = [...out];
  for (const f of ketten) {
    const rangier = f.etappen.find((e) => e.phasen.includes("reverseIn"));
    const aus = f.etappen.find((e) => e.phasen.includes("out"));
    if (!rangier || !aus) continue;
    for (const [i, slot] of PARK_SLOTS.entries()) {
      out.push({
        name: `${f.name} zum Warteplatz ${i + 1}`,
        kind: f.kind,
        etappen: [
          rangier,
          {
            name: `${f.name} zum Warteplatz ${i + 1}`,
            route: routeToPark(aus.route, slot),
            rueckwaerts: false,
            tempo: SPEED,
            phasen: ["toPark"],
          },
          {
            name: `Parken ${i + 1}`,
            route: routeParkRueckVon(aus.route, slot),
            rueckwaerts: true,
            tempo: PARK_RUECK_TEMPO,
            phasen: ["parkRueck"],
          },
        ],
      });
    }
  }
  /*
   * DAS GESPANN (E-140): Auto mit Anhaenger. Es faehrt dieselben Strecken wie
   * die Pritsche (Abladeplatz, Warteplaetze), aber rueckwaerts zielt der
   * Fahrer mit der Anhaengerachse, und der Anhaenger knickt. Ins Silo faehrt
   * es nie (`faehrtInsSilo`: nur Kipper).
   */
  for (const f of [...out]) {
    if (f.kind !== "pritsche") continue;
    out.push({ ...f, name: `Gespann: ${f.name}`, kind: "pkw" });
  }
  /*
   * VOM WARTEPLATZ WEG (E-140). Zwei Wege fuehren von einem Warteplatz: nach
   * der Kaffeepause zum Tor (`parkAusfahrt`) und — fuer die Fuhren, die zum
   * Start anstehen (E-131) — an den Abladeplatz oder ins Silo
   * (`anfahrtVomPlatz`). Beide beginnen im Stand auf dem Platz, Kabine zum
   * Hof; bis E-140 drehte sich der Wagen dort auf der Stelle.
   */
  for (const [i, slot] of PARK_SLOTS.entries()) {
    out.push({
      name: `Warteplatz ${i + 1} zum Tor`,
      kind: "kipper",
      etappen: [
        {
          name: `Warteplatz ${i + 1} Ausfahrt`,
          route: parkAusfahrt(slot),
          rueckwaerts: false,
          tempo: SPEED,
          phasen: ["out"],
        },
      ],
    });
    const ziele: Array<[string, (typeof CONFIGS)[number] | null]> = [
      ["Abladeplatz", null],
      ...CONFIGS.filter((c) => c.lager === true).map(
        (c) => [c.label, c] as [string, (typeof CONFIGS)[number]]
      ),
    ];
    for (const [wohin, silo] of ziele) {
      const zug = anfahrtVomPlatz(slot, silo);
      // Ins Silo nur der Kipper; an den Abladeplatz auch das Gespann.
      for (const kind of silo ? ["kipper"] : ["kipper", "pkw"]) {
      out.push({
        name: `${kind === "pkw" ? "Gespann: " : ""}Ansteher ${i + 1} ${wohin}`,
        kind,
        etappen: [
          {
            name: `Ansteher ${i + 1} ${wohin} Anfahrt`,
            route: zug.anfahrt,
            rueckwaerts: false,
            tempo: SPEED,
            phasen: ["approach"],
          },
          {
            name: `Ansteher ${i + 1} ${wohin} Rangieren`,
            route: zug.rueckweg,
            rueckwaerts: true,
            tempo: RUECK_TEMPO,
            phasen: ["reverseIn"],
          },
        ],
      });
      }
    }
    out.push({ ...out.find((f) => f.name === `Warteplatz ${i + 1} zum Tor`)!, name: `Gespann: Warteplatz ${i + 1} zum Tor`, kind: "pkw" });
  }
  return out;
}

/**
 * Alle Strecken einzeln — Name, Punkte, Fahrzeugart, rueckwaerts.
 *
 * Aus den Fahrplaenen abgeleitet, damit eine neue Strecke nur EINMAL
 * eingetragen werden muss. Seit E-098 stehen die Wege zum Warteplatz und in
 * die Bucht darin; vorher waren nur die drei Buchten von Hand angehaengt und
 * der WEG dorthin fehlte ganz — genau das war der blinde Fleck.
 *
 * Doppelte Eintraege fallen heraus: Die Ketten teilen sich Etappen (jede
 * Parkkette faengt mit dem Rangieren ihrer Fuhre an), und zweimal dieselbe
 * Strecke abzutasten kostet nur Zeit.
 */
export function alleStrecken(): Array<[string, Array<[number, number]>, string, boolean]> {
  const strecken: Array<[string, Array<[number, number]>, string, boolean]> = [];
  const schon = new Set<string>();
  for (const f of fahrplaene()) {
    for (const e of f.etappen) {
      const schluessel = `${f.kind}|${e.rueckwaerts}|${JSON.stringify(e.route)}`;
      if (schon.has(schluessel)) continue;
      schon.add(schluessel);
      strecken.push([e.name, e.route, f.kind, e.rueckwaerts]);
    }
  }
  return strecken;
}
