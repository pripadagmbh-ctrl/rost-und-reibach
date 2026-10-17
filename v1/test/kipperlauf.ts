/**
 * EIN LAUFAPPARAT FÜR DEN KIPPER — Wächter und Messinstrument benutzen ihn.
 *
 * Bis zum 15.09.2026 stand dieser Ablauf zweimal da: einmal in
 * `test/kipper.test.ts`, einmal in `tools/kipper-messreihe.ts`. Genau daraus
 * ist der Streit entstanden, den E-062 aufgelöst hat — zwei Geräte, dieselben
 * 24 Saaten, Ergebnisse um den Faktor zwei auseinander. Jetzt gibt es einen
 * Ablauf; der Wächter hängt Schranken daran, das Werkzeug druckt Tabellen.
 *
 * Er liegt in `test/` und nicht in `tools/`, weil ein Wächter nichts aus
 * `tools/` importieren soll: `tools/kipper-messreihe.ts` fährt beim Laden
 * seine ganze Reihe (das ist sein Zweck), und `npm test` würde das mitziehen.
 *
 * VIER ZAHLEN je Lauf, und alle vier gehören zusammen berichtet:
 *
 *   vmaxKmh      wie schnell das schnellste Stück je wird (dynamisch)
 *   durchAnteil  wie viel beim Kippen UNTER die Brücke gerät
 *   restAnteil   wie viel am Ende noch obenauf liegt
 *   endAbstand   wie weit das entfernteste Stück am Ende vom LKW liegt
 *
 * Die erste sieht der Spieler nie, die letzte sehr wohl („Teile sind ganz
 * woanders auf dem Platz gelandet", Patrick 15.09.2026). Eine Brücke, die
 * nichts mehr schleudert, aber die halbe Fuhre behält, ist keine Lösung —
 * deshalb steht `restAnteil` gleichberechtigt daneben.
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { brueckenKeilEcken } from "../src/delivery/vehicleModel";
import { BED_HALF_W, bedLenFor, KIPP_ABLAUF, type KippAblauf } from "../src/delivery/routes";
import type { CustomerProfile } from "../src/delivery/customers";
import { lagerMuldeFuer, ContainerManager } from "../src/world/containers";
import { papierStattBrowser } from "./lambertlauf";

/**
 * Wie tief unter der Ladefläche ein Stück als „durchgefallen" gilt (m,
 * Flächenkoordinaten). −0,60 ist die Unterkante der Brücke an ihrer dicksten
 * Stelle: Wer dort ist, ist UNTER der Brücke und nicht mehr darauf. Feste
 * Marke, damit dünnere und dickere Stände dieselbe Schranke sehen.
 */
export const DURCHFALL_MARKE = -0.6;

/** Die 24 Saaten, auf die sich alle Kipper-Messungen seit E-044 beziehen. */
export const SAATEN = [20260913, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
  12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

/**
 * 48 SAATEN FÜR DEN WÄCHTER (E-109) — die 24 oben plus 24 weitere.
 *
 * WARUM DER WÄCHTER MEHR BRAUCHT ALS DAS WERKZEUG: Eine Stichprobe von 24
 * Fuhren ist für einen Bericht genug und für ein Urteil zu wenig. Gemessen
 * (`tools/kipper-streuung.ts`, 144 frische Saaten, 20.000 Ziehungen je
 * Gruppengrösse) reisst der Median über 24 Saaten die Schranke 40 in 3,5 % der
 * Fälle, ohne dass sich am Spiel etwas geändert hätte; über 48 sind es 0,36 %,
 * über 96 gar keine mehr. Der Sprung von 24 auf 48 kostet rund 46 s je
 * Testlauf und nimmt 90 % der Fehlalarme.
 *
 * Für das WERKZEUG bleibt es bei 24 — es berichtet, es urteilt nicht.
 */
export const SAATEN_LANG = [
  ...SAATEN,
  24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,
  36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47,
];

export interface Stand {
  name: string;
  kunde: () => CustomerProfile;
  /** Solver-Werte aus `PhysicsWorld` setzen statt Rapier-Vorgaben zu nehmen. */
  solverWieSpiel?: boolean;
  /**
   * Die Kollider der Mulde beim Halt noch einmal neu anmelden.
   *
   * `vehicles.releaseCargo` tut das seit E-071 selbst; dieser Schalter tut es
   * ein zweites Mal. Er ist die NULLPROBE des Werkzeugs: Zweimal darf nicht
   * anders messen als einmal.
   */
  muldeNeuAnmelden?: boolean;
  /**
   * Andere Brückenform als die gebaute: vorn (Kabine) `vorn` Meter dick, am
   * Heck `hinten` Meter. Gleiche Zahlen ergeben den alten Quader
   * (`{ vorn: 0.6, hinten: 0.6 }`), ungleiche einen Keil.
   *
   * ACHTUNG, NICHT BITGLEICH: Der Eingriff schaltet den gebauten Kollider ab
   * und trägt einen neuen ein; der bekommt eine andere Nummer und wird in
   * anderer Reihenfolge gelöst. Auf DIESELBE Form gestellt kommt deshalb nicht
   * Zeichen für Zeichen dieselbe Reihe heraus — Kippen ist chaotisch, eine
   * andere Rundung in der letzten Stelle reicht. Taugt für Vergleiche über 24
   * Saaten, nicht für den Nachweis, dass sich nichts geändert hat.
   */
  keil?: { vorn: number; hinten: number };
  /**
   * ABSICHTLICH KAPUTT: Die Brücke wird beim Halt körperlos geschaltet. Dann
   * fällt die ganze Fuhre hindurch. Nur für die Gegenprobe der Wächter — ein
   * Prüfcode, der das nicht meldet, prüft nichts.
   */
  brueckeAbschalten?: boolean;
  /**
   * Lenkrate des Wagens (rad/s); `Infinity` ist der Sprungzustand von vor dem
   * 16.09.2026 (E-081). Ohne Angabe faehrt der gebaute Wert.
   *
   * Steht hier, damit die Frage „erklaert der Rangierknick den Durchfall"
   * MIT DIESEM Apparat beantwortet werden kann und nicht mit einem zweiten.
   * Das ist die Lehre aus E-062: Zwei Geraete fuer denselben Vorgang liefern
   * zwei Wahrheiten.
   */
  lenkrate?: number;
  /**
   * Faedelt der Wagen in die Ausfahrt ein, oder springt er auf sie?
   * `false` ist der Zustand von vor dem 17.09.2026 (E-093).
   */
  faedeltAus?: boolean;
  /**
   * WIE LANGE NACH DEM VERLASSEN DER ABLADESPUR NOCH GEMESSEN WIRD (s).
   *
   * Ohne Angabe: gar nicht — dann endet der Lauf wie seit E-044, in dem
   * Rechenschritt, in dem der Wagen die Spur raeumt.
   *
   * GENAU DORT LAG ABER EIN BLINDER FLECK, und er ist der Grund fuer diese
   * Zahl (E-093): `leaveUnloadingBay` setzte `routeS = 0` und damit den Wagen
   * an den ANFANG der Ausfahrt zurueck. Der Kipper steht da nicht mehr —
   * `tipCreep` hat ihn 1,4 m nach vorn gezogen. Er sprang also bei JEDER
   * Fuhre 1,32 m rueckwaerts in den eben abgekippten Haufen, und zwar EINEN
   * Rechenschritt NACH dem Abbruch dieser Schleife. Ein Messfenster, das
   * einen Sprung um ein Bild verpasst, meldet 0,0 % und beweist nichts.
   */
  nachlaufS?: number;
  /**
   * Keine Kaffeepause — der Wagen faehrt nach dem Kippen gleich vom Hof.
   *
   * Der Warteplatz wird gewuerfelt (75 % der Haendler bekommen einen), und wer
   * einen hat, geht nach dem Kippen in `toPark` und nicht in die Ausfahrt.
   * Genau dort sitzt aber der Sprung, um den es geht. Ohne diesen Schalter
   * misst man in drei von vier Laeufen etwas anderes als die Frage.
   */
  ohnePause?: boolean;
  /**
   * Anderer Kippablauf als der gebaute (E-149): Endwinkel, Haltezeit,
   * Rütteln. `{ winkel: 58°, haltS: 2,2, ruettelStoesse: 0 }` ist der Stand
   * vor E-149 — die Gegenprobe in `tools/kipper-leeren.ts`.
   */
  kippen?: Partial<KippAblauf>;
  /**
   * Die Mulden des Platzes mit ihren Betonlego-Wänden aufbauen (E-149).
   *
   * Ohne sie steht der Kipper vor einem Silo, das nur als Grundriss in der
   * Zählung existiert. Bis E-149 fiel das nicht auf, weil fast die halbe
   * Fuhre auf der Brücke liegen blieb — und die Brücke steht beim Kippen
   * selbst über dem Silo, ihr Rest zählte also als „in der Mulde". Seit die
   * Brücke wirklich frei wird, rutscht die Fuhre in den Raum, in dem die
   * Rückwand stehen müsste, und landet dahinter. Dieselbe Lehre wie bei
   * Lambert (E-109): „in die Mulde" prüft man mit einer Mulde.
   */
  mitMulden?: boolean;
}

/** Fester Zufall — die Ladung wird gewürfelt, sonst vergleicht man Rauschen. */
export function festerZufall(saat: number): () => void {
  const echt = Math.random;
  let z = saat >>> 0;
  Math.random = () => {
    z = (z * 1664525 + 1013904223) >>> 0;
    return z / 4294967296;
  };
  return () => {
    Math.random = echt;
  };
}

export interface Lauf {
  /** Höchsttempo eines DYNAMISCHEN Stücks über den ganzen Zyklus (km/h). */
  vmaxKmh: number;
  /** In welcher Phase des Wagens das schnellste Stück gemessen wurde (E-149). */
  vmaxPhase: string;
  /** Kippt diese Fuhre in ein Lagersilo statt am Abladeplatz? (E-149) */
  insSilo: boolean;
  teile: number;
  masseKg: number;
  fuellgrad: number;
  /** Anteil der Fuhre, der am Ende des Zyklus noch auf der Brücke liegt. */
  restAnteil: number;
  /** Anteil der Fuhre, der beim Kippen UNTER die Brücke gerät. */
  durchAnteil: number;
  /**
   * Anteil, der schon VOR dem Kippen unter die Brücke gerät (E-081).
   *
   * Das Messfenster von `durchAnteil` beginnt bei `tipping`. Zwischen der
   * Freigabe der Ladung (`pauseBeforeUnload`, dort wird sie wieder dynamisch)
   * und dem Kippbeginn liegen aber 1,2 s, in denen niemand hinsah — und
   * genau dort setzt `releaseCargo` die Kollider der Mulde neu (E-071). Ein
   * Stück, das in dieser Lücke durchsackt, kam in keiner Zahl vor.
   */
  durchVorKippen: number;
  /** Abstand des entferntesten Stücks vom Halteplatz des LKW (m). */
  endAbstand: number;
  /** Anteil der Fuhre, der in der zugehörigen Lagermulde gelandet ist (0–1). */
  inDerMulde: number;
}

function keilForm(vorn: number, hinten: number): RAPIER.ColliderDesc {
  const d = RAPIER.ColliderDesc.convexHull(
    brueckenKeilEcken(BED_HALF_W, bedLenFor("kipper"), vorn, hinten)
  );
  if (!d) throw new Error("keilForm: konvexe Huelle nicht baubar");
  return d;
}

/**
 * Eine Fuhre von vorn bis hinten: anliefern, kippen, abfahren, auslaufen.
 *
 * NUR DYNAMISCHE KÖRPER ZÄHLEN beim Tempo. Mitfahrende Ladung ist kinematisch
 * und an die Mulde verriegelt; Rapier leitet ihre Geschwindigkeit aus der
 * Posenänderung ab, und die schlägt beim Routenwechsel auf über 1.000 km/h aus
 * (gemessen 15.09.2026), weil der Wagen seine Ausrichtung in EINEM Schritt um
 * bis zu 168,7° umlegt. Das ist ein eigener Befund und steht in
 * `docs/offene-punkte.md`; für die Frage „fliegt etwas weg" ist es eine
 * Scheinzahl — ein verriegeltes Stück fliegt nirgends hin.
 */
export function lauf(s: Stand, saat: number): Lauf {
  const zurueck = festerZufall(saat);
  try {
    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    if (s.solverWieSpiel) {
      // Abschrift aus `physics/physicsWorld.ts` — dort ist die Quelle.
      world.timestep = 1 / 60;
      const p = world.integrationParameters;
      p.numSolverIterations = 6;
      p.contact_natural_frequency = 30;
      p.normalizedAllowedLinearError = 0.005;
      p.numAdditionalFrictionIterations = 2;
    }
    const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0),
      boden
    );
    const items = new ItemManager(scene, world);
    const m = new VehicleManager(
      scene,
      world,
      items,
      new CompositeManager(scene, world, items, new EventBus())
    );
    const c = s.kunde();
    if (s.mitMulden) {
      papierStattBrowser();
      new ContainerManager(scene, world, new EventBus());
    }
    m.spawnNow("kipper", c);
    const v = (m as unknown as { active: Record<string, unknown> }).active;
    const bedBody = (v as unknown as { bedBody: RAPIER.RigidBody }).bedBody;
    const bedGroup = (v as unknown as { bedGroup: THREE.Group }).bedGroup;
    const grp = (v as unknown as { group: THREE.Group }).group;
    if (s.lenkrate !== undefined) (v as unknown as { lenkrate: number }).lenkrate = s.lenkrate;
    if (s.faedeltAus !== undefined) {
      (v as unknown as { faedeltAus: boolean }).faedeltAus = s.faedeltAus;
    }
    if (s.ohnePause) (v as unknown as { parkSpot: [number, number] | null }).parkSpot = null;
    if (s.kippen) {
      (v as unknown as { kippAblauf: KippAblauf }).kippAblauf = { ...KIPP_ABLAUF, ...s.kippen };
    }
    let nachlauf = s.nachlaufS ?? 0;
    if (s.keil) {
      // Gebauten Kollider abschalten statt entfernen: `removeCollider`
      // verschiebt die Nummern aller folgenden, und `vehicles.ts` greift auf
      // `collider(0)` zu.
      bedBody.collider(0).setEnabled(false);
      world.createCollider(keilForm(s.keil.vorn, s.keil.hinten), bedBody);
    }
    const dt = 1 / 60;
    let vmax = 0;
    let vmaxPhase = "";
    let phase = "";
    let kippt = false;
    let amHalt: THREE.Vector3 | null = null;
    const q = new THREE.Vector3();
    const durch = new Set<number>();
    const durchFrueh = new Set<number>();
    let freigegeben = false;
    for (let i = 0; i < 60 * 480; i++) {
      m.update(dt);
      items.clampSpeeds(dt);
      world.step();
      const p = String(v.phase);
      if (p !== phase) {
        if (p === "tipping") kippt = true;
        phase = p;
      }
      if (p === "pauseBeforeUnload") freigegeben = true;
      if (p === "pauseBeforeUnload" && !amHalt) {
        amHalt = grp.position.clone();
        for (let k = 0; k < bedBody.numColliders(); k++) {
          const col = bedBody.collider(k);
          if (s.brueckeAbschalten) col.setEnabled(false);
          else if (s.muldeNeuAnmelden && col.isEnabled()) {
            col.setEnabled(false);
            col.setEnabled(true);
          }
        }
      }
      for (const it of items.items) {
        if (!it.body.isDynamic()) continue;
        const lv = it.body.linvel();
        const vv = Math.hypot(lv.x, lv.y, lv.z);
        if (vv > vmax) {
          vmax = vv;
          vmaxPhase = p;
        }
      }
      if (freigegeben) {
        bedGroup.updateWorldMatrix(true, false);
        for (const it of items.items) {
          const pp = it.body.translation();
          q.set(pp.x, pp.y, pp.z);
          bedGroup.worldToLocal(q);
          if (Math.abs(q.x) < 1.4 && q.z > 0 && q.z < 6 && q.y < DURCHFALL_MARKE) {
            (kippt ? durch : durchFrueh).add(it.body.handle);
          }
        }
      }
      /*
       * DIE SPUR IST GERAEUMT — hier endete der Lauf bis zum 17.09.2026.
       * `ausfaedeln` gehoert in dieselbe Zeile wie `out` und `toPark`: Es ist
       * dieselbe Etappe, nur mit einem anderen Namen (E-093). Ohne sie wuerde
       * der reparierte Stand laenger messen als der alte, und der Vergleich
       * waere wertlos.
       */
      if (p === "out" || p === "toPark" || p === "ausfaedeln") {
        if (nachlauf <= 0) break;
        nachlauf -= dt;
      }
    }
    /*
     * Am Ende im Rahmen der LADEFLÄCHE zählen, nicht in dem des Wagens: Der
     * Wagenrahmen taugt für den Schnappschuss bei voller Neigung, am Ende
     * steht der Kipper aber über seinem eigenen Haufen.
     */
    bedGroup.updateWorldMatrix(true, false);
    const rest = items.items.filter((it) => {
      const pp = it.body.translation();
      q.set(pp.x, pp.y, pp.z);
      bedGroup.worldToLocal(q);
      return Math.abs(q.x) < 1.4 && q.z > -0.5 && q.z < 6.5 && q.y > -0.1 && q.y < 2.0;
    }).length;
    // Auslaufen lassen: Wo etwas LIEGT, sieht man erst, wenn es ruht.
    for (let i = 0; i < 60 * 25; i++) {
      items.clampSpeeds(dt);
      world.step();
    }
    const ort = amHalt ?? grp.position;
    let endAbstand = 0;
    for (const it of items.items) {
      const pp = it.body.translation();
      endAbstand = Math.max(endAbstand, Math.hypot(pp.x - ort.x, pp.z - ort.z));
    }
    const mulde = lagerMuldeFuer(c.sortedMaterial);
    const inDerMulde = mulde
      ? items.items.filter((it) => {
          const pp = it.body.translation();
          return (
            Math.abs(pp.x - mulde.x) <= mulde.size[0] / 2 &&
            Math.abs(pp.z - mulde.z) <= mulde.size[1] / 2
          );
        }).length
      : 0;
    const n = Math.max(1, items.items.length);
    return {
      vmaxKmh: vmax * 3.6,
      vmaxPhase,
      insSilo: mulde !== null,
      teile: items.items.length,
      masseKg: items.items.reduce((a, it) => a + it.massKg, 0),
      fuellgrad: c.fuellgrad,
      restAnteil: rest / n,
      durchAnteil: durch.size / n,
      durchVorKippen: durchFrueh.size / n,
      endAbstand,
      inDerMulde: inDerMulde / n,
    };
  } finally {
    zurueck();
  }
}

export interface Reihe {
  name: string;
  mittel: number;
  hoechst: number;
  median: number;
  werte: number[];
  teile: number;
  masseKg: number;
  fuellgrad: number;
  /** Anteil der Fuhre, der am Ende noch auf der Brücke liegt (0–1). */
  rest: number;
  /** Anteil der Fuhre, der beim Kippen unter die Brücke gerät (0–1). */
  durch: number;
  /** Anteil, der schon vor dem Kippen unter die Brücke gerät (0–1). */
  durchFrueh: number;
  /** Größter Endabstand über die Reihe (m) und der Mittelwert davon. */
  abstandMax: number;
  abstandMittel: number;
  /** Anteil, der in der Lagermulde gelandet ist (nur bei sortenreinen Fuhren). */
  inDerMulde: number;
}

export const mittelwert = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length;
export const abweichung = (a: number[]): number => {
  const mu = mittelwert(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - mu) ** 2, 0) / Math.max(1, a.length - 1));
};

export function reihe(s: Stand, saaten: number[] = SAATEN): Reihe {
  return fasseZusammen(s.name, saaten.map((x) => lauf(s, x)));
}

/**
 * DIESELBE REIHE, ABER MIT LUFTHOLEN (E-109).
 *
 * Ein Vitest-Arbeiter, der 40 s am Stück rechnet, kommt nicht dazu, dem
 * Berichterstatter zu antworten. Vitest bricht den Lauf dann mit
 * `[vitest-worker]: Timeout calling "onTaskUpdate"` ab — gemessen am
 * 21.09.2026 in 1 von 3 vollen `npm test`-Läufen, nachdem der Wächter von 24
 * auf 48 Saaten gegangen war. Der Test war grün, der Lauf trotzdem rot.
 *
 * `setTimeout(0)` alle paar Saaten gibt die Ereignisschleife frei. Es kostet
 * nichts messbares und macht den Unterschied zwischen „rechnet lange" und
 * „antwortet nicht mehr".
 */
export async function reiheMitLuft(
  s: Stand,
  saaten: number[] = SAATEN,
  atemzugAlle = 4
): Promise<Reihe> {
  const r: Lauf[] = [];
  for (let i = 0; i < saaten.length; i++) {
    r.push(lauf(s, saaten[i]!));
    if ((i + 1) % atemzugAlle === 0) await new Promise((fertig) => setTimeout(fertig, 0));
  }
  return fasseZusammen(s.name, r);
}

function fasseZusammen(name: string, r: Lauf[]): Reihe {
  const werte = r.map((x) => x.vmaxKmh);
  const sortiert = [...werte].sort((a, b) => a - b);
  return {
    name,
    mittel: mittelwert(werte),
    hoechst: Math.max(...werte),
    median: sortiert[Math.floor(sortiert.length / 2)]!,
    werte,
    teile: mittelwert(r.map((x) => x.teile)),
    masseKg: mittelwert(r.map((x) => x.masseKg)),
    fuellgrad: mittelwert(r.map((x) => x.fuellgrad)),
    rest: mittelwert(r.map((x) => x.restAnteil)),
    durch: mittelwert(r.map((x) => x.durchAnteil)),
    durchFrueh: mittelwert(r.map((x) => x.durchVorKippen)),
    abstandMax: Math.max(...r.map((x) => x.endAbstand)),
    abstandMittel: mittelwert(r.map((x) => x.endAbstand)),
    inDerMulde: mittelwert(r.map((x) => x.inDerMulde)),
  };
}

/** Paarweiser Vergleich — nur gültig, weil beide Stände dieselbe Ladung tragen. */
export function paarweise(a: Reihe, b: Reihe): { delta: number; se: number; besser: number } {
  const d = a.werte.map((x, i) => x - b.werte[i]!);
  return {
    delta: mittelwert(d),
    se: abweichung(d) / Math.sqrt(d.length),
    besser: d.filter((x) => x > 0).length,
  };
}
