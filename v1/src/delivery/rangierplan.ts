/**
 * DER RANGIERZUG (E-140) — wie ein LKW rueckwaerts in eine Gasse kommt, wenn
 * er sich nicht auf der Stelle drehen kann.
 *
 * Bis E-140 drehte sich jeder Wagen vor dem Zuruecksetzen auf der Stelle um
 * (am Abladeplatz 169 Grad). Ein Fahrzeug mit lenkender Vorderachse kann das
 * nicht: Es muss VORBEIFAHREN, anhalten und im Bogen zuruecksetzen — so, wie
 * ein Fahrer an eine Rampe stoesst. Diese Datei rechnet diesen Zug aus:
 *
 *   1. Vorwaerts vom Ende der bisherigen Anfahrt bis zum Wendepunkt — auf dem
 *      kuerzesten Weg aus Kreisboegen und Geraden, den ein Fahrzeug mit
 *      Mindestradius fahren kann („Dubins-Weg", sechs Bauformen wie
 *      Links-Gerade-Rechts).
 *   2. Am Wendepunkt anhalten, Gang rein, rueckwaerts im Bogen auf die Gerade
 *      der Gasse, und die Gerade hinunter bis zum Halt.
 *
 * WELCHER WENDEPUNKT? Es werden einige Dutzend Vorlagen durchprobiert (wie
 * weit der Bogen dreht, wie eng er ist, wie lang die Gerade) und der kuerzeste
 * Zug genommen, dessen Umriss an keiner Stelle ein Bauwerk beruehrt. Das ist
 * dieselbe Frage, die `drehRichtung` seit E-084 stellte („dorthin, wo Platz
 * ist"), nur fuer einen ganzen Zug statt fuer eine Drehrichtung. Es ist KEIN
 * Wegsucher: Die Strecke davor und danach steht fest in `routes.ts`; gesucht
 * wird nur, wo der Fahrer wendet.
 *
 * Die Strecken sind Wege der HINTERACHSE (dort lenkt das Einspurmodell aus
 * `lenkung.ts` hin), ihr letzter Punkt ist der Halt des Fahrzeugursprungs.
 */
import { fahrzeugUmriss, tiefsteDurchdringung, ursprungVorAchse, type Rechteck } from "./umriss";
import type { Box } from "../world/boxen";

/** Eine Lage auf dem Platz: Ort und Gier (three.js `rotation.y`, vorwaerts = (sin, cos)). */
export interface Pose {
  x: number;
  z: number;
  gier: number;
}

type Glied = { art: "L" | "R" | "S"; laenge: number };

/** Ein Weg aus Kreisboegen und Geraden. */
export interface Bahn {
  wort: string;
  laenge: number;
  glieder: Glied[];
}

const ZWEI_PI = Math.PI * 2;
const mod = (a: number): number => ((a % ZWEI_PI) + ZWEI_PI) % ZWEI_PI;

/**
 * Einen Weg abfahren und alle `schritt` Meter eine Lage ablegen (die erste
 * Lage ist der Start). L heisst Gier faellt (Linksbogen im Rechenrahmen der
 * Lehrbuecher), R heisst Gier steigt.
 */
export function bahnLagen(a: Pose, glieder: ReadonlyArray<Glied>, r: number, schritt = 0.5): Pose[] {
  const out: Pose[] = [{ ...a }];
  let { x, z, gier } = a;
  for (const g of glieder) {
    const n = Math.max(1, Math.ceil(g.laenge / schritt));
    const ds = g.laenge / n;
    const k = g.art === "S" ? 0 : (g.art === "L" ? -1 : 1) / r;
    for (let i = 0; i < n; i++) {
      const dg = k * ds;
      const m = gier + dg / 2;
      // Sehne des Bogens: exakt, nicht nur naeherungsweise
      const sehne = Math.abs(dg) > 1e-12 ? (2 * Math.sin(Math.abs(dg) / 2)) / Math.abs(k) : ds;
      x += sehne * Math.sin(m);
      z += sehne * Math.cos(m);
      gier += dg;
      out.push({ x, z, gier });
    }
  }
  return out;
}

/**
 * ALLE SECHS DUBINS-WEGE von `a` nach `b` mit Mindestradius `r`.
 *
 * Die Formeln sind die des Lehrbuchs (Shkel & Lumelsky 2001) im ueblichen
 * Rechenrahmen (Winkel gegen den Uhrzeigersinn ab +x). Jede Bauform wird nach
 * dem Ausrechnen ABGEFAHREN und nur behalten, wenn sie wirklich in `b` endet
 * — ein Vorzeichenfehler in einer der sechs Formeln faellt damit heraus,
 * statt einen falschen Weg zu liefern.
 */
export function dubins(a: Pose, b: Pose, r: number): Bahn[] {
  const dx = b.x - a.x;
  const dy = b.z - a.z;
  const d = Math.hypot(dx, dy) / r;
  const phi = Math.atan2(dy, dx);
  // Gier → Lehrbuchwinkel: theta = pi/2 − gier
  const al = mod(Math.PI / 2 - a.gier - phi);
  const be = mod(Math.PI / 2 - b.gier - phi);
  const sa = Math.sin(al);
  const sb = Math.sin(be);
  const ca = Math.cos(al);
  const cb = Math.cos(be);
  const cab = Math.cos(al - be);
  const kandidaten: Array<[string, number, number, number] | null> = [];
  // LSL
  {
    const p2 = 2 + d * d - 2 * cab + 2 * d * (sa - sb);
    if (p2 >= 0) {
      const tmp = Math.atan2(cb - ca, d + sa - sb);
      kandidaten.push(["LSL", mod(-al + tmp), Math.sqrt(p2), mod(be - tmp)]);
    }
  }
  // RSR
  {
    const p2 = 2 + d * d - 2 * cab + 2 * d * (sb - sa);
    if (p2 >= 0) {
      const tmp = Math.atan2(ca - cb, d - sa + sb);
      kandidaten.push(["RSR", mod(al - tmp), Math.sqrt(p2), mod(-be + tmp)]);
    }
  }
  // LSR
  {
    const p2 = -2 + d * d + 2 * cab + 2 * d * (sa + sb);
    if (p2 >= 0) {
      const p = Math.sqrt(p2);
      const tmp = Math.atan2(-ca - cb, d + sa + sb) - Math.atan2(-2, p);
      kandidaten.push(["LSR", mod(-al + tmp), p, mod(-be + tmp)]);
    }
  }
  // RSL
  {
    const p2 = d * d - 2 + 2 * cab - 2 * d * (sa + sb);
    if (p2 >= 0) {
      const p = Math.sqrt(p2);
      const tmp = Math.atan2(ca + cb, d - sa - sb) - Math.atan2(2, p);
      kandidaten.push(["RSL", mod(al - tmp), p, mod(be - tmp)]);
    }
  }
  // RLR
  {
    const tmp = (6 - d * d + 2 * cab + 2 * d * (sa - sb)) / 8;
    if (Math.abs(tmp) <= 1) {
      const p = mod(ZWEI_PI - Math.acos(tmp));
      const t = mod(al - Math.atan2(ca - cb, d - sa + sb) + p / 2);
      kandidaten.push(["RLR", t, p, mod(al - be - t + p)]);
    }
  }
  // LRL
  {
    const tmp = (6 - d * d + 2 * cab + 2 * d * (sb - sa)) / 8;
    if (Math.abs(tmp) <= 1) {
      const p = mod(ZWEI_PI - Math.acos(tmp));
      const t = mod(-al - Math.atan2(ca - cb, d + sa - sb) + p / 2);
      kandidaten.push(["LRL", t, p, mod(be - al - t + p)]);
    }
  }
  const out: Bahn[] = [];
  for (const k of kandidaten) {
    if (!k) continue;
    const [wort, t, p, q] = k;
    const arten = wort.split("") as Array<"L" | "R" | "S">;
    const glieder: Glied[] = [t, p, q].map((w, i) => ({ art: arten[i]!, laenge: w * r }));
    // Je Glied ein Schritt: Die Sehnenrechnung in `bahnLagen` ist exakt.
    const lagen = bahnLagen(a, glieder, r, Infinity);
    const e = lagen[lagen.length - 1]!;
    const trifft =
      Math.hypot(e.x - b.x, e.z - b.z) < 1e-3 && Math.abs(Math.sin((e.gier - b.gier) / 2)) < 1e-3;
    if (!trifft) continue;
    out.push({ wort, laenge: (t + p + q) * r, glieder: glieder.filter((g) => g.laenge > 1e-9) });
  }
  return out.sort((x, y) => x.laenge - y.laenge);
}

/* --------------------------------------------------------------- Plan --- */

/**
 * Wie der Zug gesucht wird. Alle Zahlen SW (E-140), gemessen mit
 * `tools/einspur-plan.ts` und den Waechtern.
 */
export const RANGIER = {
  /**
   * Radius der Vorwaertsboegen (m). Der Kipper faehrt bei vollem Einschlag
   * 6,14 m (`lenkung.wendeRadius`); 7,5 m lassen dem Bahnfolger Luft, damit er
   * nicht am Anschlag faehrt.
   */
  radiusVor: 7.5,
  /** Radien des Rueckwaertsbogens (m) — der weitere ist der ruhigere. */
  radienRueck: [7.5, 10, 13],
  /** Wie weit der Rueckwaertsbogen dreht (Grad, beide Richtungen). */
  drehungenGrad: [0, 30, 45, 60, 75, 90, 105, 120, 135, 150],
  /**
   * Wie lang die Gerade vor dem Halt ist (m). Mindestens 6 m: So weit braucht
   * der Bahnfolger rueckwaerts, bis der Wagen gerade in der Gasse steht.
   */
  geraden: [6, 9, 12],
  /** Gerade vor dem Wendepunkt (m): Der Wagen haelt gerade an, nicht im Bogen. */
  anlauf: 2,
  /** Umriss fuer die Pruefung: der Kipper, der laengste Wagen (bedLen). */
  bedLen: 6.0,
  /** Sicherheitsrand um den Umriss (m): Der Bahnfolger faehrt nicht auf den Zentimeter. */
  rand: 0.3,
  /** Rueckwaertsfahrt zaehlt so viel mehr als vorwaerts (langsamer, 0,6 x Tempo). */
  rueckGewicht: 1.6,
};

/** Wie tief der Umriss an diesen Hinterachslagen hoechstens in einem Bauwerk steckt (m). */
export function bahnTiefe(
  lagen: ReadonlyArray<Pose>,
  hindernisse: ReadonlyArray<Rechteck>,
  /** Sobald die Tiefe darueber liegt, wird nicht weiter gesucht. */
  abbruch = 0,
  rand = RANGIER.rand,
  bedLen = RANGIER.bedLen
): number {
  let tief = 0;
  const vor = ursprungVorAchse(bedLen);
  const box: Box[] = [];
  for (const l of lagen) {
    const b = fahrzeugUmriss(
      { x: l.x + Math.sin(l.gier) * vor, z: l.z + Math.cos(l.gier) * vor, rot: l.gier },
      bedLen
    );
    b.hw += rand;
    b.hd += rand;
    box.length = 0;
    box.push(b);
    const t = tiefsteDurchdringung(box, hindernisse);
    if (t > tief) tief = t;
    if (tief > abbruch) return tief;
  }
  return tief;
}

export interface Rangierzug {
  /** Vorwaerts bis zum Wendepunkt (letzter Punkt = Ursprung im Wendepunkt). */
  anfahrt: Array<[number, number]>;
  /** Rueckwaerts bis zum Halt (letzter Punkt = Halt). */
  rueckweg: Array<[number, number]>;
  /** Fuer Bericht und Waechter: wie der Zug zustande kam. */
  wahl: string;
}

const punkte = (lagen: ReadonlyArray<Pose>, jeder = 2): Array<[number, number]> =>
  lagen.filter((_, i) => i % jeder === 0 || i === lagen.length - 1).map((l) => [l.x, l.z]);

/**
 * DEN ZUG RECHNEN.
 *
 * `vorlauf` ist die feste Strecke bis hierher (ihr letztes Stueck gibt die
 * Fahrtrichtung), `halt` der Haltepunkt des Ursprungs, `gierHalt` die
 * Blickrichtung der Kabine dort. Rueckwaerts gefahren wird also in Richtung
 * `gierHalt + pi`.
 */
export function planeRangierzug(
  vorlauf: ReadonlyArray<readonly [number, number]>,
  halt: readonly [number, number],
  gierHalt: number,
  hindernisse: ReadonlyArray<Rechteck>,
  bedLen = RANGIER.bedLen
): Rangierzug {
  return planeRangierzugOderNull(vorlauf, halt, gierHalt, hindernisse, false, undefined, bedLen)!;
}

/** Wie `planeRangierzug` — mit `nurFrei` aber `null`, wenn kein Zug frei ist. */
export function planeRangierzugOderNull(
  vorlauf: ReadonlyArray<readonly [number, number]>,
  halt: readonly [number, number],
  gierHalt: number,
  hindernisse: ReadonlyArray<Rechteck>,
  nurFrei: boolean,
  /** Fuer Werkzeuge: warum die billigsten Zuege verworfen wurden. */
  protokoll?: string[],
  /** Ladeflaechenlaenge des Wagens, der hier faehrt (Umriss der Pruefung). */
  bedLen = RANGIER.bedLen
): Rangierzug | null {
  const tiefe = (lagen: ReadonlyArray<Pose>, abbruch: number, rand = RANGIER.rand): number =>
    bahnTiefe(lagen, hindernisse, abbruch, rand, bedLen);
  const n = vorlauf.length;
  const [ax, az] = vorlauf[n - 1]!;
  const [bx, bz] = vorlauf[n - 2]!;
  const start: Pose = { x: ax, z: az, gier: Math.atan2(ax - bx, az - bz) };
  const beta = gierHalt + Math.PI; // Fahrtrichtung rueckwaerts
  const vor = ursprungVorAchse(bedLen);
  /** Der Rueckwaertsteil ist allen Vorwaertswegen zu ihm gemeinsam — einmal pruefen. */
  type Rueckteil = { rueck: Pose[]; gasse: Pose[]; tief?: number };
  type Kandidat = {
    kosten: number;
    bahn: Bahn;
    anlaufStart: Pose;
    rueck: Pose[];
    teil: Rueckteil;
    wahl: string;
  };
  const kandidaten: Kandidat[] = [];
  for (const gerade of RANGIER.geraden) {
    // Hinterachse am Anfang der Geraden
    const e: Pose = {
      x: halt[0] - Math.sin(beta) * (gerade - vor),
      z: halt[1] - Math.cos(beta) * (gerade - vor),
      gier: beta,
    };
    for (const grad of RANGIER.drehungenGrad) {
      for (const seite of grad === 0 ? [1] : [1, -1]) {
        const dreh = (seite * grad * Math.PI) / 180;
        for (const r of grad === 0 ? [RANGIER.radienRueck[0]!] : RANGIER.radienRueck) {
          // Den Rueckwaertsbogen vom Ende her zurueckrechnen: Fahrtrichtung
          // umgekehrt, Drehung umgekehrt — dann liegt der Wendepunkt fest.
          // Rueckwaerts gerechnet zeigt die Gier dieser Lagen gegen die
          // Fahrtrichtung — das IST die Blickrichtung der Kabine.
          const zurueck = bahnLagen(
            { x: e.x, z: e.z, gier: beta + Math.PI },
            [{ art: dreh > 0 ? "L" : "R", laenge: Math.abs(dreh) * r }],
            r
          );
          const c = zurueck[zurueck.length - 1]!;
          const anlaufStart: Pose = {
            x: c.x - Math.sin(c.gier) * RANGIER.anlauf,
            z: c.z - Math.cos(c.gier) * RANGIER.anlauf,
            gier: c.gier,
          };
          const rueck = zurueck.slice().reverse();
          const lRueck = Math.abs(dreh) * r + gerade;
          // Die Gerade in der Gasse: Lagen vom Bogenende bis zum Halt.
          const gasse = bahnLagen({ x: e.x, z: e.z, gier: beta }, [{ art: "S", laenge: gerade }], 1)
            .map((p) => ({ x: p.x, z: p.z, gier: gierHalt }));
          const teil: Rueckteil = { rueck, gasse };
          for (const bahn of dubins(start, anlaufStart, RANGIER.radiusVor)) {
            kandidaten.push({
              kosten: bahn.laenge + RANGIER.anlauf + RANGIER.rueckGewicht * lRueck,
              bahn,
              anlaufStart,
              rueck,
              teil,
              wahl:
                `${bahn.wort} ${bahn.laenge.toFixed(1)} m vorwaerts, ` +
                `Bogen ${((dreh * 180) / Math.PI).toFixed(0)} Grad r ${r} m, Gerade ${gerade} m`,
            });
          }
        }
      }
    }
  }
  const vorwaerts = (k: Kandidat): Pose[] => [
    ...bahnLagen(start, k.bahn.glieder, RANGIER.radiusVor),
    ...bahnLagen(k.anlaufStart, [{ art: "S", laenge: RANGIER.anlauf }], 1).slice(1),
  ];
  kandidaten.sort((p, q) => p.kosten - q.kosten);
  /*
   * Der erste freie Zug gewinnt. Ist KEINER frei, wird der mit der geringsten
   * Durchdringung genommen und das in `wahl` vermerkt — dann meldet der
   * Waechter (`test/rangierknick.test.ts`) die Stelle, statt dass das Spiel
   * beim Laden abbricht.
   */
  /*
   * Gepruefter Rand: 0,30 m auf Bogen und Vorwaertsweg, wo der Bahnfolger
   * schneidet; 0,05 m auf der Geraden in der Gasse — dort steht der Halt fest
   * (vom Platz vorgegeben), und der Wagen faehrt sie gerade.
   */
  const RAND_GASSE = 0.05;
  const teilTiefe = (t: Rueckteil, abbruch: number): number => {
    if (t.tief === undefined || (t.tief > 0 && abbruch === Infinity)) {
      t.tief = Math.max(
        tiefe(t.rueck, abbruch),
        tiefe(t.gasse, abbruch, RAND_GASSE)
      );
    }
    return t.tief;
  };
  let bester: { k: Kandidat; tief: number } | null = null;
  for (const k of kandidaten) {
    if (protokoll && protokoll.length < 25) {
      protokoll.push(
        `${k.kosten.toFixed(1)}  ${k.wahl}  rueck ${teilTiefe(k.teil, Infinity).toFixed(2)}  ` +
          `vor ${tiefe(vorwaerts(k), Infinity).toFixed(2)}`
      );
    }
    if (teilTiefe(k.teil, 0) <= 0 && tiefe(vorwaerts(k), 0) <= 0) {
      bester = { k, tief: 0 };
      break;
    }
  }
  // Kein Zug frei: unter den 200 billigsten den mit der geringsten Durchdringung.
  if (!bester && !nurFrei) {
    for (const k of kandidaten.slice(0, 200)) {
      const tief = Math.max(teilTiefe(k.teil, Infinity), tiefe(vorwaerts(k), Infinity));
      if (!bester || tief < bester.tief) bester = { k, tief };
    }
  }
  if (!bester) {
    if (nurFrei) return null;
    throw new Error(`Kein Rangierzug zum Halt (${halt[0]} | ${halt[1]})`);
  }
  const k = bester.k;
  const vorw = vorwaerts(k);
  const c = vorw[vorw.length - 1]!;
  const ursprungC: [number, number] = [c.x + Math.sin(c.gier) * vor, c.z + Math.cos(c.gier) * vor];
  return {
    anfahrt: [...vorlauf.map((p) => [p[0], p[1]] as [number, number]), ...punkte(vorw.slice(1)), ursprungC],
    rueckweg: [ursprungC, ...punkte(k.rueck), [halt[0], halt[1]]],
    wahl: (bester.tief > 0 ? `NICHT FREI (${bester.tief.toFixed(2)} m): ` : "") + k.wahl,
  };
}
