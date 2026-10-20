/**
 * Wächter für die Wandenden — Befund 14.09.2026 (Patrick, auf dem Gerät):
 * „Bei jeder Mulde werden immer vollständige Legosteine gebaut. Das führt
 * dazu, dass die Außenteile immer abstehen."
 *
 * Geprüft wird an den echten Maßen aus `CONFIGS` und an den echten Läufen der
 * Umrandung: Jede Reihe fängt an der Wandkante an und hört an der Wandkante
 * auf. Die Bauklasse selbst braucht Szene und Physikwelt und ist kopflos
 * nicht zu messen — deshalb liegt die Geometrie der Wände in
 * `muldenWandSpannen` bzw. `mauerLaeufe`, und beide werden vom Bau benutzt.
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { reihenstuecke } from "../src/world/legoreihe";
import {
  CONFIGS,
  ContainerManager,
  muldenWandSpannen,
  muldenWaendeWelt,
  MULDE_STEIN,
} from "../src/world/containers";
import { STATIC_OBSTACLES } from "../src/world/obstacles";
import { EventBus } from "../src/core/events";
import { initPhysics } from "../src/physics/physicsWorld";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import {
  mauerLaeufe,
  schraegeLaeufe,
  BUCHT_FASE_WEST,
  BUCHT_FASE_OST,
  MAUER_STEIN,
  TOR_HALB,
  GATE_X,
  YARD_D,
  YARD_MIN_X,
  YARD_MAX_X,
  BUCHT_X_VON,
  BUCHT_X_BIS,
  BUCHT_Z,
} from "../src/world/yard";

const mulden = CONFIGS.filter((c) => c.kind === "bay");

/** Äußerste Kanten einer ausgelegten Reihe. */
function kanten(von: number, bis: number, laenge: number, versatz: number): [number, number] {
  const st = reihenstuecke(von, bis, laenge, versatz);
  const a = st[0]!;
  const b = st[st.length - 1]!;
  return [a.mitte - a.laenge / 2, b.mitte + b.laenge / 2];
}

describe("Muldenwände stehen nicht über", () => {
  it("führt überhaupt Mulden", () => {
    expect(mulden.length).toBeGreaterThan(0);
  });

  for (const cfg of mulden) {
    it(`${cfg.label}: Flanken und Rückwand enden an ihrer Kante`, () => {
      const [w, d] = cfg.size;
      const spannen = muldenWandSpannen(w, d, !cfg.shareEast);
      // beide Lagen prüfen: gerade und versetzte
      for (const versatz of [0, MULDE_STEIN.laenge / 2]) {
        const [f0, f1] = kanten(spannen.flanke[0], spannen.flanke[1], MULDE_STEIN.laenge, versatz);
        expect(f0, "Flanke steht vor der offenen Kante über").toBeCloseTo(-w / 2, 9);
        expect(f1, "Flanke steht hinter der Rückwand über").toBeCloseTo(w / 2, 9);
        if (!cfg.shareEast) {
          const [r0, r1] = kanten(spannen.rueck[0], spannen.rueck[1], MULDE_STEIN.laenge, versatz);
          const aussen = d / 2 + MULDE_STEIN.dicke;
          expect(r0, "Rückwand steht nach Süden über").toBeCloseTo(-aussen, 9);
          expect(r1, "Rückwand steht nach Norden über").toBeCloseTo(aussen, 9);
        }
      }
    });
  }

  it("die Flanke endet genau da, wo die Rückwand anfängt", () => {
    // T-Stoß statt Überlappung: sonst stecken an der hinteren Ecke zwei
    // Steine ineinander.
    const cfg = mulden.find((c) => !c.shareEast)!;
    const [w, d] = cfg.size;
    const s = muldenWandSpannen(w, d, true);
    expect(s.flanke[1]).toBeCloseTo(w / 2, 9);
    // Innenfläche der Rückwand liegt auf derselben Linie
    expect(w / 2 + MULDE_STEIN.dicke / 2 - MULDE_STEIN.dicke / 2).toBeCloseTo(w / 2, 9);
    // und die Rückwand ist so lang wie die Außenflächen der Flanken
    expect(s.rueck[1] - s.rueck[0]).toBeCloseTo(d + 2 * MULDE_STEIN.dicke, 9);
  });
});

describe("Die Umrandung kommt in den Ecken an", () => {
  const laeufe = mauerLaeufe();
  const hz = YARD_D / 2;
  const t = MAUER_STEIN.dicke / 2;
  const lauf = (name: string) => laeufe.find((l) => l.name === name)!;

  it("führt neun Läufe: vier Platzseiten mit ihren Lücken und die Ausbuchtung", () => {
    expect(laeufe.map((l) => l.name).sort()).toEqual(
      [
        "bucht-ost",
        "bucht-sued",
        "bucht-west",
        "nord-ost",
        "nord-west",
        "ost",
        "sued-ost",
        "sued-west",
        "west",
      ].sort()
    );
  });

  it("jeder Lauf ist von Anfang bis Ende mit Steinen belegt", () => {
    for (const l of laeufe) {
      const [a, b] = kanten(l.von, l.bis, MAUER_STEIN.laenge, 0);
      expect(a, `${l.name}: fängt woanders an`).toBeCloseTo(l.von, 9);
      expect(b, `${l.name}: hört woanders auf`).toBeCloseTo(l.bis, 9);
    }
  });

  it("Nord- und Südmauer laufen über die Ecken, Ost und West stoßen an", () => {
    expect(lauf("nord-west").von).toBeCloseTo(YARD_MIN_X - t, 9);
    expect(lauf("nord-ost").bis).toBeCloseTo(YARD_MAX_X + t, 9);
    expect(lauf("sued-west").von).toBeCloseTo(YARD_MIN_X - t, 9);
    expect(lauf("sued-ost").bis).toBeCloseTo(YARD_MAX_X + t, 9);
    for (const n of ["west", "ost"]) {
      expect(lauf(n).von).toBeCloseTo(-hz + t, 9);
      expect(lauf(n).bis).toBeCloseTo(hz - t, 9);
    }
  });

  it("die Einfahrt ist genau so breit wie ihre Torpfosten", () => {
    // Vorher blieb die Lücke 9,6 m breit, während Pfosten und Kollider bei
    // 9,0 m standen — die Mauer hörte 0,3 m neben dem Pfosten auf.
    expect(lauf("nord-west").bis).toBeCloseTo(GATE_X - TOR_HALB, 9);
    expect(lauf("nord-ost").von).toBeCloseTo(GATE_X + TOR_HALB, 9);
    expect(lauf("nord-ost").von - lauf("nord-west").bis).toBeCloseTo(2 * TOR_HALB, 9);
  });

  it("die Ausbuchtung ist rundum geschlossen, ohne Überstand", () => {
    // Schenkel tragen die hinteren Ecken, die Rückwand stößt zwischen ihnen an.
    for (const n of ["bucht-west", "bucht-ost"]) expect(lauf(n).von).toBeCloseTo(BUCHT_Z - t, 9);
    expect(lauf("bucht-sued").von).toBeCloseTo(BUCHT_X_VON + t, 9);
    expect(lauf("bucht-sued").bis).toBeCloseTo(BUCHT_X_BIS - t, 9);
    /*
     * Vorn (E-189): Schenkel und Südmauer enden an den Fasen; jede Fase läuft
     * genau vom Ende des Schenkels zum Ende der Südmauer — kein Loch.
     */
    const [fw, fo] = schraegeLaeufe();
    expect([fw!.x0, fw!.z0]).toEqual([BUCHT_X_VON, lauf("bucht-west").bis]);
    expect([fw!.x1, fw!.z1]).toEqual([lauf("sued-west").bis, -hz]);
    expect([fo!.x0, fo!.z0]).toEqual([BUCHT_X_BIS, lauf("bucht-ost").bis]);
    expect([fo!.x1, fo!.z1]).toEqual([lauf("sued-ost").von, -hz]);
    expect(lauf("bucht-west").bis).toBeCloseTo(-hz - BUCHT_FASE_WEST, 9);
    expect(lauf("bucht-ost").bis).toBeCloseTo(-hz - BUCHT_FASE_OST, 9);
  });

  it("die Öffnung der Ausbuchtung bleibt frei", () => {
    const belegt = (x: number): boolean =>
      laeufe.some(
        (l) => l.achse === "x" && Math.abs(l.fest + hz) < 0.01 && x > l.von && x < l.bis
      );
    for (let x = BUCHT_X_VON + 0.2; x < BUCHT_X_BIS - 0.2; x += 0.5) {
      expect(belegt(x), `Südmauer steht bei x=${x.toFixed(1)} vor der Bucht`).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------------ *
 * WAECHTER E-110: Stein, Kollider und Hinderniseintrag sind EINE Wand
 * ------------------------------------------------------------------------ */
describe("Gebaute Wand, gemeldete Wand und Kollider sagen dasselbe", () => {
  /*
   * Zwei Befunde vom 22.09.2026, beide dieselbe Ursache:
   *
   *   „Kollisionsprüfung ohne Mauer bei Buntmetallmulde?"  Die Hindernisliste
   *   rechnete mit einer 0,35 m dicken Wand auf der Muldenkante; gebaut sind
   *   0,55 m, und sie stehen VOR der Kante. Ergebnis: 0,35 m Sperre ohne
   *   Stein nach innen, 0,20 m Stein ohne Sperre nach aussen.
   *
   *   „die spinne bleibt über dem abgesenkten muldenwand stehen"  Der
   *   Rueckwand-Kollider entstand ohne Bedingung — auch an der Mulde mit
   *   `shareEast`, die statt der Rueckwand nur eine 1,00 m hohe Schwelle hat.
   *   Dort stand eine unsichtbare Wand auf 3,00 m.
   *
   * Dieser Waechter prueft ALLE Mulden, nicht die eine, an der es aufgefallen
   * ist: Dass heute nur `BUNT + VA` ein `shareEast` traegt, macht den Fall zum
   * Sonderfall, nicht zum Einzelfall.
   */
  const T = MULDE_STEIN.dicke;
  /** Dicke und Laenge eines Wandrechtecks, ohne zu wissen, wie es gedreht ist. */
  const dick = (o: { hw: number; hd: number }): number => 2 * Math.min(o.hw, o.hd);
  const lang = (o: { hw: number; hd: number }): number => 2 * Math.max(o.hw, o.hd);

  for (const cfg of mulden) {
    it(`${cfg.label}: der Hinderniseintrag ist die gebaute Wand`, () => {
      const gebaut = muldenWaendeWelt(cfg);
      const gemeldet = STATIC_OBSTACLES.filter((o) => o.label.startsWith(`${cfg.label} `));
      expect(gemeldet.length, "so viele Eintraege wie Waende").toBe(gebaut.length);
      for (const wand of gebaut) {
        const e = gemeldet.find(
          (o) => Math.abs(o.x - wand.x) < 1e-9 && Math.abs(o.z - wand.z) < 1e-9
        );
        expect(e, `kein Eintrag auf (${wand.x.toFixed(2)} | ${wand.z.toFixed(2)})`).toBeTruthy();
        expect(e!.hw, `${e!.label}: Breite`).toBeCloseTo(wand.hw, 9);
        expect(e!.hd, `${e!.label}: Tiefe`).toBeCloseTo(wand.hd, 9);
        expect(e!.top, `${e!.label}: Oberkante`).toBeCloseTo(wand.top, 9);
      }
    });

    it(`${cfg.label}: Dicke, Laenge und Lage stimmen mit den Steinen`, () => {
      /*
       * Unabhaengig nachgerechnet, nur aus `size` und `MULDE_STEIN` — nicht aus
       * `muldenWaende()`. Sonst prueft der Waechter die Rechnung mit sich
       * selbst. Gemessen wird drehungsfrei: Dicke, Laenge und Abstand von der
       * Mitte gelten in jeder Ausrichtung.
       */
      const [w, d, h] = cfg.size;
      const lagen = Math.max(2, Math.round(h / MULDE_STEIN.hoehe));
      const waende = muldenWaendeWelt(cfg);
      for (const o of waende) {
        expect(dick(o), `${cfg.label} ${o.teil}: Wanddicke ist die Steindicke`).toBeCloseTo(T, 9);
      }
      const flanken = waende.filter((o) => o.teil.startsWith("flanke"));
      expect(flanken.length, "zwei Flanken").toBe(2);
      for (const f of flanken) {
        expect(lang(f), `${cfg.label} ${f.teil}: Flanke reicht ueber die Front`).toBeCloseTo(w, 9);
        expect(f.top, `${cfg.label} ${f.teil}: Oberkante = ${lagen} Lagen`).toBeCloseTo(
          lagen * MULDE_STEIN.hoehe,
          9
        );
      }
      // Die Flanken stehen AUSSEN an der Mulde: Mitte zu Mitte = Tiefe + Dicke
      expect(
        Math.hypot(flanken[0]!.x - flanken[1]!.x, flanken[0]!.z - flanken[1]!.z),
        "Flankenabstand"
      ).toBeCloseTo(d + T, 9);
      const stirn = waende.find((o) => o.teil === "stirn" || o.teil === "schwelle");
      expect(stirn, "keine Stirnseite").toBeTruthy();
      expect(lang(stirn!), "die Stirn deckt die Flankenaussenflaechen").toBeCloseTo(d + 2 * T, 9);
      expect(
        Math.hypot(stirn!.x - cfg.x, stirn!.z - cfg.z),
        "die Stirn steht vor der Muldenkante"
      ).toBeCloseTo(w / 2 + T / 2, 9);
      expect(stirn!.top, "Oberkante der Stirnseite").toBeCloseTo(
        cfg.shareEast
          ? Math.max(1, Math.round((cfg.niedrigeStirn ?? 0) / MULDE_STEIN.hoehe)) *
              MULDE_STEIN.hoehe
          : (lagen + 2) * MULDE_STEIN.hoehe,
        9
      );
    });
  }

  it("und der Kollider steht nirgends hoeher als die Steine, die man sieht", async () => {
    /*
     * DIE PROBE, DIE DIE SPINNE MACHT. `surfaceUnderClaws` schickt einen Strahl
     * aus der Greifermitte senkrecht nach unten und nimmt den ersten festen
     * Treffer als tragenden Grund. Genau so wird hier gemessen, an der Mitte
     * jeder Wand.
     *
     * Erwartet wird die HOECHSTE erklaerte Wand an dieser Stelle — nicht die
     * eigene: An der Suedwestecke der Nichtmetall-Reihe stehen zwei Mulden so
     * dicht, dass ihre Flanken sich 0,40 m durchdringen (VA-LAGER 3,50 m,
     * BATTERIEN 3,00 m). Das ist Bestand und kein Fehler dieses Pakets; wer es
     * aendert, aendert die Platzanordnung.
     */
    leinwandAttrappe();
    await initPhysics();
    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0),
      boden
    );
    new ContainerManager(scene, world, new EventBus());
    // Ein Schritt, bevor gefragt wird: Rapier baut seinen Suchbaum im `step()`.
    world.step();
    const alle = mulden.flatMap((c) => muldenWaendeWelt(c));
    for (const wand of alle) {
      const treffer = world.castRay(
        new RAPIER.Ray({ x: wand.x, y: 8, z: wand.z }, { x: 0, y: -1, z: 0 }),
        12,
        true
      );
      expect(treffer, `kein Kollider unter (${wand.x.toFixed(2)} | ${wand.z.toFixed(2)})`).toBeTruthy();
      const gemessen = 8 - treffer!.timeOfImpact;
      const erklaert = Math.max(
        ...alle
          .filter(
            (o) => Math.abs(o.x - wand.x) <= o.hw + 1e-9 && Math.abs(o.z - wand.z) <= o.hd + 1e-9
          )
          .map((o) => o.top)
      );
      expect(
        gemessen,
        `Kollider auf ${gemessen.toFixed(2)} m, erklaert sind ${erklaert.toFixed(
          2
        )} m bei (${wand.x.toFixed(2)} | ${wand.z.toFixed(2)})`
      ).toBeCloseTo(erklaert, 6);
    }
  });
});
