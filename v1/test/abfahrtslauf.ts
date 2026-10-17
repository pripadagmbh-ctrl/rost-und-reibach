/**
 * DER ORTSSPRUNG BEIM ABFAHREN — ein Laufapparat, den Waechter und Werkzeug teilen.
 *
 * `test/knicklauf.ts` misst den DREHsprung (E-084). Er faehrt dafuer
 * Fahrplaene nach, also Streckenzuege — und genau deshalb sieht er den
 * zweiten Sprung nicht: Der entsteht nicht auf einer Strecke, sondern beim
 * WECHSEL auf eine Strecke. `nearestS` liefert die Bogenlaenge des naechsten
 * Routenpunktes, und der naechste Rechenschritt setzt den Wagen dorthin —
 * quer ueber den Abstand, der dazwischen liegt.
 *
 * Dieser Apparat faehrt deshalb keinen Fahrplan nach, sondern laesst das ECHTE
 * Fahrzeug (`VehicleManager`) seinen ganzen Zyklus fahren und misst jeden
 * einzelnen Rechenschritt:
 *
 *   sprungM   wie weit sich die Fahrzeugmitte in EINEM Bild bewegt
 *   eckeM     wie weit dabei die aeusserste Umrissecke springt
 *   tiefeM    wie tief der Umriss dabei in einem Bauwerk steckt
 *
 * Ein regulaerer Fahrschritt ist SPEED/60 = 0,08 m gross. Alles darueber ist
 * kein Fahren mehr, sondern ein Versetzen — und Rapier leitet aus einer
 * Posenaenderung von 5,3 m in 1/60 s 318 m/s ab.
 *
 * DER ALTE ZUSTAND IST EIN EINGANGSWERT, kein nachgebauter Fehler:
 * `faedeltAus = false` liefert Zeichen fuer Zeichen die Abfahrt von vor dem
 * 16.09.2026. Damit hat jeder Waechter hier seine Gegenprobe (Lehre aus
 * E-062: ein Waechter, der nie rot werden kann, bewacht nichts).
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { VehicleManager, type DeliveryKind } from "../src/delivery/vehicles";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { PARK_SLOTS, SPEED, bedLenFor } from "../src/delivery/routes";
import { STATIC_OBSTACLES } from "../src/world/obstacles";
import { fahrzeugUmriss, eckenSprung, umrissUeberlappung } from "../src/delivery/umriss";
import { festerZufall } from "./kipperlauf";
import { spielFuhre, pruefKunde } from "./pruefkunde";

/** Rechenschritt des Spiels (s) — `PhysicsWorld.timestep`. */
export const SCHRITT_S = 1 / 60;

/**
 * Wie weit ein Wagen in EINEM Bild hoechstens faehrt, ohne zu springen (m).
 *
 * Gerechnet und nicht gegriffen: SPEED = 4,8 m/s bei 60 Bildern je Sekunde
 * sind 0,080 m. Der Kriechzug nach dem Kippen (`TIP_CREEP_SPEED` 1,1 m/s) und
 * die Rueckwaertsfahrt (0,6 x SPEED) sind langsamer. Wer mehr zurueclegt,
 * faehrt nicht — er wird versetzt.
 */
export const FAHRSCHRITT_M = SPEED * SCHRITT_S;

export interface Schritt {
  phase: string;
  vorherige: string;
  x: number;
  z: number;
  sprungM: number;
  eckeM: number;
}

export interface Anstoss {
  phase: string;
  bauwerk: string;
  tiefeM: number;
  x: number;
  z: number;
}

export interface Abfahrt {
  name: string;
  /** Weitester Schritt der Fahrzeugmitte in einem Bild (m). */
  maxSprungM: number;
  /** Weitester Schritt der aeussersten Umrissecke in einem Bild (m). */
  maxEckeM: number;
  /** Tiefste Durchdringung eines Bauwerks ueber den ganzen Zyklus (m). */
  maxTiefeM: number;
  /** Je Phase und Bauwerk die tiefste Durchdringung, absteigend. */
  anstoesse: Anstoss[];
  /** Wo der weiteste Sprung passierte. */
  schlimmster: Schritt | null;
  /** Alle Schritte ueber der Fahrschrittgrenze, absteigend. */
  spruenge: Schritt[];
  /** Welche Phasen der Wagen durchlaufen hat, in dieser Reihenfolge. */
  phasen: string[];
  dauerS: number;
}

export interface AbfahrtStand {
  name: string;
  /** Warteplatz 0..2, oder null: der Wagen faehrt ohne Pause vom Hof. */
  platz: number | null;
  kind?: DeliveryKind;
  /** false = der Sprungzustand von vor dem 16.09.2026 (Gegenprobe). */
  faedeltAus?: boolean;
  /** Fuer den Fahrplan-Vergleich: auch die Lenkung auf den alten Stand. */
  lenkrate?: number;
  /**
   * Welchen Weg der Wagen nimmt.
   *
   *   "silo"     gewuerfelte Haendlerfuhre (`spielFuhre`) — landet bei
   *              sortenreiner Ladung in der Silo-Gasse; deren Ausfahrt laeuft
   *              ueber (−27 | 6) und damit dicht am dritten Warteplatz vorbei.
   *   "abladen"  gemischte Fuhre (`pruefKunde`, sortenrein null) — sie faehrt
   *              an den Abladeplatz, und ihre Ausfahrt ist `routeOut()`. Das
   *              ist der Weg, den `tools/einfaedeln.ts` gerechnet hat.
   *
   * Beide gehoeren gemessen: Der Ortssprung haengt daran, WELCHE Ausfahrt der
   * Wagen einfaedelt, und die beiden liegen an den Warteplaetzen verschieden
   * weit weg.
   */
  weg?: "silo" | "abladen";
}

/**
 * Einen ganzen Zyklus fahren und jeden Rechenschritt vermessen.
 *
 * KEIN ZUSAETZLICHES OBJEKT ueber das hinaus, was das Spiel selbst anlegt:
 * Jedes `THREE.Object3D` zieht beim Erzeugen vier Zufallszahlen, ein Netz
 * mehr wuerfelt also eine andere Fuhre (E-080). Der Apparat baut deshalb
 * Szene, Welt, Fuhrpark und Ladung genau wie `test/wirkungslauf.ts` und
 * nichts daneben.
 */
export function abfahrt(s: AbfahrtStand, saat = 20260916): Abfahrt {
  const zurueck = festerZufall(saat);
  try {
    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    // Abschrift aus `physics/physicsWorld.ts` — dort ist die Quelle.
    world.timestep = SCHRITT_S;
    const p = world.integrationParameters;
    p.numSolverIterations = 6;
    p.contact_natural_frequency = 30;
    p.normalizedAllowedLinearError = 0.005;
    p.numAdditionalFrictionIterations = 2;
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
    const kind = s.kind ?? "kipper";
    /*
     * Prueffuhre ODER Spielfuhre — und die Wahl faellt ueber `test/pruefkunde.ts`,
     * nicht von Hand (E-062). `pruefKunde` gibt den Fuellgrad vor, die Masse
     * folgt; beides zusammen zu setzen lehnt es ab.
     */
    m.spawnNow(
      kind,
      s.weg === "abladen" ? pruefKunde({ sortenrein: null, fuellgrad: 0.7 }) : spielFuhre()
    );
    const v = (m as unknown as {
      active: {
        phase: string;
        parkSpot: [number, number] | null;
        parkSeconds: number;
        faedeltAus: boolean;
        lenkrate: number;
        kaffeeGehabt: boolean;
        group: THREE.Group;
        done: boolean;
      };
    }).active;
    if (s.faedeltAus === false) v.faedeltAus = false;
    if (s.lenkrate !== undefined) v.lenkrate = s.lenkrate;
    if (s.platz !== null) {
      v.parkSpot = PARK_SLOTS[s.platz]!;
      /*
       * Drei Sekunden statt 45 bis 120: Gemessen wird die ABFAHRT, nicht die
       * Pause. Der Fahrer bleibt sitzen (`kaffeeGehabt`), sonst muesste er
       * erst zur Theke und zurueck — das haengt an `parkSeconds − 12` und
       * gehoert zu E-078, nicht zu dieser Frage.
       */
      v.parkSeconds = 3;
      v.kaffeeGehabt = true;
    } else {
      v.parkSpot = null;
    }
    const bedLen = bedLenFor(kind);
    const grp = v.group;
    let box = fahrzeugUmriss(
      { x: grp.position.x, z: grp.position.z, rot: grp.rotation.y },
      bedLen
    );
    let vorher = grp.position.clone();
    let vorherPhase = String(v.phase);
    const phasen: string[] = [vorherPhase];
    const spruenge: Schritt[] = [];
    let maxSprung = 0;
    let maxEcke = 0;
    let maxTiefe = 0;
    let schlimmster: Schritt | null = null;
    let schritte = 0;
    const tiefen = new Map<string, Anstoss>();
    // Deckel: 480 s sind vier Standzeiten; ein Zyklus dauert rund 120 s.
    for (let i = 0; i < 60 * 480; i++) {
      m.update(SCHRITT_S);
      items.clampSpeeds(SCHRITT_S);
      world.step();
      schritte++;
      const phase = String(v.phase);
      const jetzt = fahrzeugUmriss(
        { x: grp.position.x, z: grp.position.z, rot: grp.rotation.y },
        bedLen
      );
      const sprung = Math.hypot(grp.position.x - vorher.x, grp.position.z - vorher.z);
      const ecke = eckenSprung(box, jetzt);
      const eintrag: Schritt = {
        phase,
        vorherige: vorherPhase,
        x: grp.position.x,
        z: grp.position.z,
        sprungM: sprung,
        eckeM: ecke,
      };
      if (sprung > maxSprung) {
        maxSprung = sprung;
        schlimmster = eintrag;
      }
      if (ecke > maxEcke) maxEcke = ecke;
      // 1 mm Toleranz auf den Fahrschritt: darunter ist es Rundung.
      if (sprung > FAHRSCHRITT_M + 0.001) spruenge.push(eintrag);
      for (const o of STATIC_OBSTACLES) {
        const d = umrissUeberlappung(jetzt, o);
        if (d > maxTiefe) maxTiefe = d;
        if (d > 0.01) {
          const k = `${phase} | ${o.label}`;
          const alt = tiefen.get(k);
          if (!alt || alt.tiefeM < d) {
            tiefen.set(k, {
              phase,
              bauwerk: o.label,
              tiefeM: d,
              x: grp.position.x,
              z: grp.position.z,
            });
          }
        }
      }
      box = jetzt;
      vorher = grp.position.clone();
      if (phase !== vorherPhase) {
        phasen.push(phase);
        vorherPhase = phase;
      }
      if (v.done) break;
    }
    spruenge.sort((a, b) => b.sprungM - a.sprungM);
    const ergebnis: Abfahrt = {
      name: s.name,
      maxSprungM: maxSprung,
      maxEckeM: maxEcke,
      maxTiefeM: maxTiefe,
      anstoesse: [...tiefen.values()].sort((a, b) => b.tiefeM - a.tiefeM),
      schlimmster,
      spruenge: spruenge.slice(0, 12),
      phasen,
      dauerS: schritte * SCHRITT_S,
    };
    /*
     * Welt freigeben — sie liegt im WASM-Speicher, und ueber viele Laeufe
     * bricht der Lauf sonst ohne Meldung ab (E-084).
     */
    world.free();
    return ergebnis;
  } finally {
    zurueck();
  }
}

/** Die Staende, die Werkzeug und Waechter fahren: je Warteplatz alt gegen neu. */
export function staende(): AbfahrtStand[] {
  const out: AbfahrtStand[] = [];
  for (const weg of ["abladen", "silo"] as const) {
    for (let i = 0; i < PARK_SLOTS.length; i++) {
      // Seit E-140 kann der Wagen nur noch springen, wenn auch die Lenkung
      // auf dem alten Stand ist: Das Einspurmodell setzt nie einen Ort.
      out.push({
        name: `${weg} Warteplatz ${i + 1} SPRUNG`,
        platz: i,
        weg,
        faedeltAus: false,
        lenkrate: Infinity,
      });
      out.push({ name: `${weg} Warteplatz ${i + 1} AUSFAEDELN`, platz: i, weg });
    }
    out.push({
      name: `${weg} ohne Warteplatz SPRUNG`,
      platz: null,
      weg,
      faedeltAus: false,
      lenkrate: Infinity,
    });
    out.push({ name: `${weg} ohne Warteplatz AUSFAEDELN`, platz: null, weg });
  }
  return out;
}
