/**
 * DIE ENGSTELLEN DES PLATZES — eine Liste, aus der GEBAUTEN Welt.
 *
 * Getrennt von `engstellen-kern.ts`, weil der Kern reine Geometrie ist und
 * nichts vom Schrottplatz weiss. Und getrennt vom Werkzeug, weil der Waechter
 * (`test/engstellen.test.ts`) dieselben Ziele messen muss wie der Messlauf:
 * Zwei Listen derselben Engstellen liefen unweigerlich auseinander, und zwar
 * stumm — dieselbe Klasse Fehler wie die doppelten Wege in E-044, E-064,
 * E-070, E-082 und E-087.
 *
 * Gebaut werden Platz, Behaelter und Presse; ihre KOLLIDER sind die
 * Hindernisse. Nicht abgeschriebene Masse: Der Platz hat schon zweimal
 * Kollider gehabt, die woanders standen als das, was man sah (12.09.2026
 * „unsichtbare Barriere", 15.09.2026 die ungedrehten Muldenkoerper).
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { PressManager, PRESS_CENTER, PRESS_KAMMER } from "../src/world/press";
import { ContainerManager, CONFIGS, bayHalb } from "../src/world/containers";
import { Yard } from "../src/world/yard";
import { EventBus } from "../src/core/events";
import { BED_HALF_W, bedLenFor, MULDEN_GASSE_X } from "../src/delivery/routes";
import { UMRISS_HALB_B } from "../src/delivery/umriss";
import { wandHoehe } from "../src/delivery/vehicleModel";
import { kaestenAusWelt, type Fenster, type Kasten } from "./engstellen-kern";

export interface Ziel {
  fenster: Fenster;
  hindernisse: Kasten[];
  /** Was der Spieler dort tut — steht in der Ausgabe. */
  zweck: string;
  /**
   * SOLL der offene Greifer hier ueberhaupt hinein?
   *
   * Nicht jede Engstelle ist ein Fehler. In die Ladeflaeche eines LKW und in
   * den Spalt neben einem eingefahrenen Wagen kommt kein Umschlagbagger mit
   * offenem Greifer — er laedt von OBEN. Diese Ziele werden trotzdem
   * gemessen, weil ihre Zahl sagt, WIE WEIT offen er dort noch herunterkommt;
   * sie stehen aber nicht in der Befundliste, sonst faende man den einen
   * echten Befund zwischen lauter erwarteten nicht mehr.
   */
  sollPassen: boolean;
}

export interface Platzmessung {
  ziele: Ziel[];
  kaesten: Kasten[];
  /** Kollider, die keine Quader sind — mit Ort, damit niemand sie uebersieht. */
  uebergangen: Array<{ x: number; y: number; z: number }>;
}

/** Die Presskammer in Weltachsen — Muendung und Hoehenband. */
export const MUENDUNG = {
  x0: PRESS_CENTER.x - PRESS_KAMMER.hw,
  x1: PRESS_CENTER.x + PRESS_KAMMER.hw,
  z0: PRESS_CENTER.z - PRESS_KAMMER.hd,
  z1: PRESS_CENTER.z + PRESS_KAMMER.hd,
  /** Kammerboden 0,30 m, Wandkrone 0,30 + 1,90 = 2,20 m (`press.ts`). */
  y0: 0.3,
  y1: 2.2,
};

export function zielePlatz(): Platzmessung {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  new Yard(scene, world);
  new ContainerManager(scene, world, new EventBus());
  new PressManager(scene, world, { items: [] } as never, { cars: [] } as never);
  world.step();
  scene.updateMatrixWorld(true);
  const { kaesten, uebergangen } = kaestenAusWelt(world);

  const ziele: Ziel[] = [];

  /* --- Die Presskammer. Muendung und Hoehenband wie in presseKammer.test.ts. */
  /*
   * Welcher Kasten IST der Stempel? Gesucht, nicht abgezaehlt: Er ist der
   * einzige Kollider, der in der Muendung steht und dabei schmaler als einen
   * Meter ist (0,42 m Plattendicke, `press.ts`: `PLATE_T * 1.4`). Die
   * Wandkollider liegen ausserhalb der Muendung, die Deckelklappe ist 4,45 m
   * breit. Wer ihn ueber seinen Listenplatz suchte, fasste beim naechsten
   * Umbau den falschen.
   */
  const inMuendung = kaesten.filter(
    (k) =>
      k.max.x > MUENDUNG.x0 && k.min.x < MUENDUNG.x1 &&
      k.max.z > MUENDUNG.z0 && k.min.z < MUENDUNG.z1 &&
      k.max.y > MUENDUNG.y0 && k.min.y < MUENDUNG.y1
  );
  const stempel = inMuendung.filter(
    (k) => Math.min(k.max.x - k.min.x, k.max.z - k.min.z) < 1.0
  );
  ziele.push({
    fenster: {
      name: "Presskammer, Stempel geparkt",
      ...MUENDUNG,
      herkunft: "PressManager-Kollider",
    },
    hindernisse: kaesten,
    zweck: "Schrott einfuellen und das fertige Paket wieder herausholen",
    sollPassen: true,
  });
  ziele.push({
    fenster: {
      name: "Presskammer, ohne den Stempel",
      ...MUENDUNG,
      herkunft: "PressManager-Kollider ohne die Stempelplatte",
    },
    hindernisse: kaesten.filter((k) => !stempel.includes(k)),
    zweck: "dieselbe Kammer, Stempel gedacht weggefahren",
    sollPassen: true,
  });

  /* --- Jede Mulde, jede Halde, der Absetzcontainer. */
  for (const cfg of CONFIGS) {
    const { hw, hd } = bayHalb(cfg);
    if (cfg.kind === "bay") {
      /*
       * Die lichte Weite einer Mulde IST `bayHalb`: Die Flankenkollider
       * sitzen auf ±(d/2 + BLOCK_T/2), ihre Innenflaechen also genau auf
       * ±d/2. Das Hoehenband reicht vom Boden bis zur Wandkrone.
       */
      ziele.push({
        fenster: {
          name: `Mulde ${cfg.label}`,
          x0: cfg.x - hw, x1: cfg.x + hw,
          z0: cfg.z - hd, z1: cfg.z + hd,
          y0: 0.05, y1: cfg.size[2],
          herkunft: `CONFIGS ${cfg.id} · bayHalb`,
        },
        hindernisse: kaesten,
        zweck: cfg.lager ? "Lambert traegt hinein, der Abholer holt heraus" : "sortieren",
        sollPassen: true,
      });
    } else if (cfg.kind === "halde") {
      /*
       * Eine Halde hat keine eigenen Waende (`haldeWaende` alles false). Was
       * sie begrenzt, sind die Trennsteine in der Fuge und die Waende der
       * Suedbucht. Hoehenband bis 2,40 m — so hoch steht die Steinpyramide in
       * der Mitte; darueber ist zwischen den Halden nichts.
       */
      ziele.push({
        fenster: {
          name: `Halde ${cfg.label}`,
          x0: cfg.x - hw, x1: cfg.x + hw,
          z0: cfg.z - hd, z1: cfg.z + hd,
          y0: 0.05, y1: 2.4,
          herkunft: `CONFIGS ${cfg.id} · bayHalb · TRENNSTEINE`,
        },
        hindernisse: kaesten,
        zweck: "greifen und umsetzen zwischen den beiden Halden",
        sollPassen: true,
      });
    } else if (cfg.kind === "rolloff" || cfg.kind === "grosscontainer") {
      /*
       * Der Absetzcontainer: lichte Weite INNEN. Die vier Waende sind
       * T = 0,09 m stark und stehen innen buendig (`containers.ts`, `waende`),
       * der Boden liegt auf KUFE + T = 0,31 m.
       */
      const T = 0.09;
      const [w, d, h] = cfg.size;
      ziele.push({
        fenster: {
          name: `Absetzcontainer ${cfg.label}`,
          x0: cfg.x - (w / 2 - T), x1: cfg.x + (w / 2 - T),
          z0: cfg.z - (d / 2 - T), z1: cfg.z + (d / 2 - T),
          y0: 0.32, y1: 0.31 + h,
          herkunft: `CONFIGS ${cfg.id} · Wandstaerke 0,09 m`,
        },
        /*
         * Der Container ist ein DYNAMISCHER Koerper; seine eigenen Waende
         * stehen als Kollider da und wuerden das Fenster von innen
         * zuschnueren — das Fenster IST aber schon die lichte Weite. Also
         * zaehlt nur, was ausserhalb seines Umrisses steht.
         */
        hindernisse: kaesten.filter(
          (k) =>
            k.max.x < cfg.x - w / 2 - 0.2 || k.min.x > cfg.x + w / 2 + 0.2 ||
            k.max.z < cfg.z - d / 2 - 0.2 || k.min.z > cfg.z + d / 2 + 0.2
        ),
        zweck: "Muell hineinwerfen und wieder ausraeumen",
        /*
         * SEIT E-190 NICHT MEHR: Der MUELL ist ein 10-m³-Abrollcontainer, so
         * breit wie die Strasse erlaubt (2,50 m aussen, 2,32 m innen). Die ganz
         * offene Spinne (rund 3,3 m) passt nicht hinein — geworfen wird von
         * oben wie in die Ladeflaeche des Abholers, ausgeraeumt halb offen.
         * Patrick hat die Groesse gewaehlt (21.10.2026).
         */
        sollPassen: false,
      });
    }
  }

  /* --- Der Verladeplatz: die Ladeflaeche des Abholers zwischen den Bordwaenden. */
  const bedLen = bedLenFor("abholer");
  const wand = wandHoehe("abholer");
  ziele.push({
    fenster: {
      name: "Ladeflaeche des Abholers",
      x0: -BED_HALF_W, x1: BED_HALF_W,
      z0: -bedLen / 2, z1: bedLen / 2,
      y0: 1.16, y1: 1.15 + wand,
      herkunft: `BED_HALF_W ${BED_HALF_W} m · wandHoehe("abholer") ${wand} m · Flaeche 1,15 m`,
    },
    hindernisse: [],
    zweck: "der Bagger laedt die bestellte Fuhre auf — von OBEN",
    sollPassen: false,
  });

  /* --- Die Silo-Gasse: der Wagen steht in der Mulde, der Greifer daneben. */
  const silo = CONFIGS.find((c) => c.id === "c_alu_lager")!;
  const halbSilo = bayHalb(silo).hd;
  ziele.push({
    fenster: {
      name: "Silo-Gasse, Wagen in der Mulde",
      x0: -halbSilo, x1: halbSilo,
      z0: -2, z1: 2,
      y0: 0.05, y1: silo.size[2],
      herkunft: `bayHalb(${silo.id}).hd · UMRISS_HALB_B ${UMRISS_HALB_B} m · Gasse x ${MULDEN_GASSE_X}`,
    },
    hindernisse: [
      {
        name: "Abholer, in die Mulde zurueckgestossen",
        min: { x: -UMRISS_HALB_B, y: 0, z: -2 },
        max: { x: UMRISS_HALB_B, y: 4, z: 2 },
      },
    ],
    zweck: "neben dem Wagen in die Mulde langen — geht nicht, er laedt von OBEN",
    sollPassen: false,
  });

  return { ziele, kaesten, uebergangen };
}
