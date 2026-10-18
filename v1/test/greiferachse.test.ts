/**
 * Waechter fuer die GREIFERACHSE und das Pendel ohne Winkelsperre (E-105).
 *
 * Zwei Sachen haengen hier zusammen, und deshalb stehen sie in einer Datei:
 *
 *   1. Der Greifer haengt FREI. Am 17.09.2026 ist der Deckel von 17 Grad je
 *      Achse gefallen — Patrick: „Es ging eher drum, dass ein Greifer keine
 *      winkelsperre hat, soll auch nicht. Damit ueber das schwenken seitliche
 *      kraft erzeugt wird und teile geworfen werden koennen."
 *   2. Weil er frei haengt, haengt er selten lotrecht. Bodenanschlag und
 *      Messstrahl rechnen deshalb in der GREIFERACHSE statt in der
 *      Weltsenkrechten. Diese Umstellung stammt aus E-085 (dem
 *      Seitwaertskippen, das am selben Tag zurueckgenommen wurde) und bleibt —
 *      sie war nie an das Kippen gebunden, sondern an die Schraeglage.
 *
 * DIE HAERTESTE BEDINGUNG ist nicht, dass der schraege Fall stimmt — sondern
 * dass AM LOTRECHTEN GREIFER NICHTS ANDERS IST. Daran haengt alles, was
 * Patrick am Prototyp gefallen hat: Bodenanschlag, Greiffenster, das Gefuehl
 * beim Zupacken. Deshalb steht diese Probe an erster Stelle.
 *
 * JEDE ZAHLENSCHRANKE HAT EINE GEGENPROBE, DIE MELDEN MUSS.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import { SICHELKRALLE } from "../src/excavator/greiferform";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";
import type { Greiferform } from "../src/excavator/greiferform";

class Tasten {
  down = new Set<string>();
  gedrueckt = new Set<string>();
  wheelDelta = 0;
  orbitDX = 0;
  orbitDY = 0;
  shiftHeld = false;
  isDown(c: string): boolean {
    return this.down.has(c);
  }
  wasPressed(c: string): boolean {
    return this.gedrueckt.has(c);
  }
  mouseHeld(): boolean {
    return false;
  }
  axis(neg: string, pos: string): number {
    return (this.down.has(pos) ? 1 : 0) - (this.down.has(neg) ? 1 : 0);
  }
  endFrame(): void {}
}

const DT = 1 / 60;
const GRAD = Math.PI / 180;
/** Der Deckel, der bis zum 17.09.2026 galt (Grad) — Bezugsgroesse, kein Sollwert. */
const ALTER_DECKEL = 17;

beforeAll(async () => {
  leinwandAttrappe();
  await initPhysics();
});

function baueBagger(): { bagger: Excavator; world: RAPIER.World; szene: THREE.Scene } {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  const szene = new THREE.Scene();
  return { bagger: new Excavator(szene, world), world, szene };
}

/** Tiefster gezeichneter Punkt des Greifers ueber dem Beton (m). */
function tiefsterPunkt(bagger: Excavator): number {
  const g = bagger.grappleGroup;
  g.updateWorldMatrix(true, true);
  const p = new THREE.Vector3();
  let tief = Infinity;
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (let a: THREE.Object3D | null = m; a && a !== g; a = a.parent) if (!a.visible) return;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      if (p.y < tief) tief = p.y;
    }
  });
  return tief;
}

/**
 * Den Arm auf den Beton absetzen und die Spinne schliessen — dieselbe Folge,
 * mit der E-046 und E-065 den Bodenanschlag gemessen haben.
 */
function absetzen(bagger: Excavator, world: RAPIER.World, schritte = 420): number {
  const tasten = new Tasten();
  for (let i = 0; i < schritte; i++) {
    tasten.down.clear();
    if (i < schritte * 0.55) {
      tasten.down.add("KeyF"); // Ausleger senken
      tasten.down.add("KeyG"); // Stiel ran
    } else {
      tasten.down.add("Space"); // zupacken
    }
    bagger.update(DT, tasten as never);
    world.step();
  }
  return tiefsterPunkt(bagger);
}

/**
 * Oberwagen voll schwenken und dabei den groessten Ausschlag mitschreiben.
 *
 * Gemessen wird an der gezeichneten Lage, nicht an der inneren Zahl: Die
 * Greiferachse ist die lokale −y-Achse der `grappleGroup`, der Ausschlag der
 * Winkel zwischen ihr und der Weltsenkrechten. Was hier herauskommt, ist das,
 * was Patrick auf dem Glas sieht.
 */
function schwenken(
  bagger: Excavator,
  world: RAPIER.World,
  bilder: number,
  taste: string | null
): { hoechster: number; letzter: number } {
  const tasten = new Tasten();
  const achse = new THREE.Vector3();
  let hoechster = 0;
  let letzter = 0;
  for (let i = 0; i < bilder; i++) {
    tasten.down.clear();
    if (taste) tasten.down.add(taste);
    bagger.update(DT, tasten as never);
    world.step();
    achse.set(0, -1, 0).applyQuaternion(bagger.grappleGroup.quaternion);
    letzter = Math.acos(THREE.MathUtils.clamp(-achse.y, -1, 1)) / GRAD;
    if (letzter > hoechster) hoechster = letzter;
  }
  return { hoechster, letzter };
}

/* ==================================================================== */
describe("Lotrecht ist nichts anders — Ziffer fuer Ziffer", () => {
  /*
   * Die Formen liefern ihre Ausladung bei Neigung 0 durch einen Vorabsprung:
   * `if (kipp === 0) return tiefe(winkel)`. Diese Pruefung haelt genau diesen
   * Sprung fest. `toBe` und nicht `toBeCloseTo` — es geht um dieselbe Zahl,
   * nicht um eine aehnliche.
   */
  for (const form of [SICHELKRALLE, FUENFSCHALEN] as Greiferform[]) {
    it(`${form.name}: ausladung(winkel, 0) ist tiefe(winkel)`, () => {
      for (let i = 0; i <= 40; i++) {
        const w = form.zu + ((form.offen - form.zu) * i) / 40;
        expect(form.ausladung(w, 0)).toBe(form.tiefe(w));
      }
      expect(form.maxAusladung(0)).toBe(form.maxTiefe);
    });

    it(`${form.name}: GEGENPROBE — schon ein Grad Schraeglage aendert die Zahl`, () => {
      let groesste = 0;
      for (let i = 0; i <= 40; i++) {
        const w = form.zu + ((form.offen - form.zu) * i) / 40;
        groesste = Math.max(groesste, Math.abs(form.ausladung(w, 1 * GRAD) - form.tiefe(w)));
      }
      // Ein Grad an 3 m Hebel sind Zentimeter, nicht Nullen.
      expect(groesste).toBeGreaterThan(0.002);
      expect(form.maxAusladung(1 * GRAD)).not.toBe(form.maxTiefe);
    });
  }

  /**
   * DIE ZAHL, DIE PATRICK AM GERAET SIEHT: wie hoch der geschlossene Greifer
   * ueber dem Beton stehen bleibt.
   *
   * Die Sollwerte sind am Stand vor E-085 gemessen, mit
   * `tools/bodenanschlag-hoehe.ts` und mit derselben Folge wie hier —
   * absenken, zupacken, tiefsten gezeichneten Punkt nehmen: Sichelkralle
   * **6,37 cm**, Fuenfschalengreifer **20,44 cm** (letzterer seit E-090, davor
   * 20,99 cm; der breitere Saum baucht 5,5 mm weiter nach unten).
   *
   * Das Fenster ist ein Millimeter: enger als jeder Effekt, den ein Umbau am
   * Bodenanschlag haben koennte, und weit genug fuer das Rauschen einer
   * Physikschleife.
   */
  const ANSCHLAG: Array<{ form: Greiferform; soll: number }> = [
    { form: SICHELKRALLE, soll: 0.0637 },
    { form: FUENFSCHALEN, soll: 0.2044 },
  ];
  for (const { form, soll } of ANSCHLAG) {
    it(`${form.name}: der Bodenanschlag steht lotrecht auf ${(soll * 100).toFixed(2)} cm`, () => {
      const { bagger, world } = baueBagger();
      if (bagger.greiferform !== form) expect(bagger.setGreifer(form)).toBe(true);
      const hoehe = absetzen(bagger, world);
      /*
       * Und der Greifer haengt dabei WIRKLICH lotrecht — sonst waere die Zahl
       * oben mit einem anderen Rechenweg zustande gekommen und der Vergleich
       * mit dem Stand von gestern nichts wert.
       */
      expect(bagger.neigung).toBe(0);
      expect(bagger.pendelAchse.x).toBe(0);
      expect(bagger.pendelAchse.y).toBe(-1);
      expect(bagger.pendelAchse.z).toBe(0);
      expect(hoehe).toBeGreaterThan(soll - 0.001);
      expect(hoehe).toBeLessThan(soll + 0.001);
    });
  }

  it("GEGENPROBE — schraeg haengend steht der Greifer messbar anders", () => {
    /*
     * Ohne diese Probe koennte der Bodenanschlag die Schraeglage schlicht
     * ignorieren, und die Zahlen oben waeren trotzdem gruen. Gerechnet wird
     * der Unterschied an der Zahl, mit der `resolveGroundClamp` den Arm
     * anhaelt: Bei 20 Grad Schraeglage — so weit schlaegt das Pendel im
     * vollen Schwenk wirklich aus — verlangt die Sichelkralle 18 cm mehr
     * Abstand als lotrecht.
     */
    const lot = SICHELKRALLE.maxAusladung(0);
    const schraeg = SICHELKRALLE.maxAusladung(20 * GRAD);
    expect(Math.abs(schraeg - lot)).toBeGreaterThan(0.05);
  });
});

/* ==================================================================== */
describe("Die Ausladung stimmt mit dem gezeichneten Netz", () => {
  /**
   * `maxAusladung` ist die Zahl, mit der `resolveGroundClamp` den Arm anhaelt.
   * Sie darf nicht kleiner sein als das, was wirklich gezeichnet wird —
   * sonst faehrt der Greifer in den Beton.
   */
  function wahreMaxAusladung(bagger: Excavator, form: Greiferform, kipp: number): number {
    const g = bagger.grappleGroup;
    const bau = (
      bagger as unknown as {
        greiferbau: { setWinkel(i: number, w: number): void; nachfuehren(): void };
      }
    ).greiferbau;
    const ck = Math.cos(kipp);
    const sk = Math.sin(kipp);
    const p = new THREE.Vector3();
    let weit = -Infinity;
    /*
     * 41 Stuetzstellen — DIESELBEN, die `maxAusladungVon` nimmt. Mit 21
     * meldete diese Pruefung 29 mm Unterschied, und das war kein Fehler der
     * Rechnung, sondern der Pruefung: Die Rechnung hatte eine tiefere
     * Oeffnungsstellung gefunden, die hier gar nicht abgetastet wurde.
     */
    for (let s = 0; s <= 40; s++) {
      const w = form.zu + ((form.offen - form.zu) * s) / 40;
      for (let i = 0; i < form.schalen; i++) bau.setWinkel(i, w);
      bau.nachfuehren();
      g.updateWorldMatrix(true, true);
      const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        for (let a: THREE.Object3D | null = m; a && a !== g; a = a.parent) if (!a.visible) return;
        const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
        const mm = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
        for (let k = 0; k < pos.count; k++) {
          p.fromBufferAttribute(pos, k).applyMatrix4(mm);
          const d = -p.y * ck + p.z * sk;
          if (d > weit) weit = d;
        }
      });
    }
    return weit;
  }

  for (const form of [SICHELKRALLE, FUENFSCHALEN] as Greiferform[]) {
    it(`${form.name}: der Bodenanschlag liegt nie unter dem gezeichneten Netz`, () => {
      const { bagger } = baueBagger();
      if (bagger.greiferform !== form) expect(bagger.setGreifer(form)).toBe(true);
      let zuFlach = 0;
      let zuHoch = 0;
      /*
       * BEIDE Richtungen. Das Pendel schlaegt in jede Himmelsrichtung aus, und
       * der Greifer ist um seine Achse fuenfzaehlig — nach der einen Seite
       * steht eine Schale unten, nach der anderen eine Luecke. Dass die
       * Rechnung beides trifft, haengt daran, dass sie ueber ALLE Schalen
       * laeuft.
       */
      for (let g = -90; g <= 90; g += 10) {
        const k = g * GRAD;
        const d = form.maxAusladung(k) - wahreMaxAusladung(bagger, form, k);
        zuFlach = Math.max(zuFlach, -d);
        zuHoch = Math.max(zuHoch, d);
      }
      // Nie zu flach: sonst sinkt der Greifer in den Beton.
      expect(zuFlach).toBeLessThanOrEqual(0);
      // Und nicht unnoetig hoch: der Zuschlag darf kein Polster werden.
      expect(zuHoch).toBeLessThan(0.055);
    });

    it(`${form.name}: GEGENPROBE — ohne den Zuschlag sinkt der Greifer ein`, () => {
      const { bagger } = baueBagger();
      if (bagger.greiferform !== form) expect(bagger.setGreifer(form)).toBe(true);
      /*
       * Dieselbe Rechnung wie `maxAusladungVon`, nur ohne `KIPP_ZUSCHLAG`.
       * Dass hier ein Fehlbetrag herauskommt, ist der Grund, warum es den
       * Zuschlag gibt — und der Beweis, dass die Pruefung darueber nicht
       * trivial ist.
       */
      let ohne = 0;
      for (let i = 0; i <= 40; i++) {
        ohne = Math.max(
          ohne,
          form.ausladung(form.zu + ((form.offen - form.zu) * i) / 40, -90 * GRAD)
        );
      }
      expect(wahreMaxAusladung(bagger, form, -90 * GRAD) - ohne).toBeGreaterThan(0.015);
    });

    it(`${form.name}: GEGENPROBE — die alte Rechnung (maxTiefe) faellt durch`, () => {
      const { bagger } = baueBagger();
      if (bagger.greiferform !== form) expect(bagger.setGreifer(form)).toBe(true);
      /*
       * So sah der Bodenanschlag vor E-085 aus: eine feste Tiefe, egal wie
       * der Greifer haengt. Bei 90 Grad liegt er um rund einen Meter daneben.
       */
      const abweichung = Math.abs(form.maxTiefe - wahreMaxAusladung(bagger, form, -90 * GRAD));
      expect(abweichung).toBeGreaterThan(0.9);
    });
  }
});

/* ==================================================================== */
describe("Der Ausschlag hat keine Sperre mehr", () => {
  /**
   * DIE ZAHL, UM DIE ES GEHT. Bis zum 17.09.2026 deckelte `PENDEL_MAX` bei
   * 17 Grad je Achse; gemessen kam der Greifer im vollen Oberwagenschwenk auf
   * 17,3 Grad und stand damit am Anschlag. Ohne Deckel sind es 20,2 Grad
   * (`tools/pendelausschlag.ts`, 17.09.2026).
   *
   * Die Schranke steht bei 18 Grad, also UEBER dem alten Deckel und unter dem
   * gemessenen Wert: Wer die Sperre wieder einbaut — gleich bei welcher Zahl
   * bis 18 Grad — faellt hier durch.
   */
  it("im vollen Schwenk schlaegt der Greifer weiter aus als der alte Deckel", () => {
    const { bagger, world } = baueBagger();
    const { hoechster } = schwenken(bagger, world, 360, "KeyQ");
    expect(
      hoechster,
      `groesster Ausschlag ${hoechster.toFixed(1)}° — der alte Deckel lag bei ${ALTER_DECKEL}°`
    ).toBeGreaterThan(18);
  });

  it("GEGENPROBE — mit dem alten Deckel waere derselbe Schwenk gekappt", () => {
    /*
     * Die Gegenprobe rechnet den alten Deckel auf denselben Verlauf nach:
     * `PENDEL_MAX` hat JE ACHSE bei 17 Grad gekappt. Wenn im Schwenk eine der
     * beiden Achsen ueber 17 Grad kommt, haette der Deckel zugegriffen — sonst
     * misst die Pruefung oben etwas, das der Deckel nie beruehrt hat, und sie
     * waere blind.
     */
    const { bagger, world } = baueBagger();
    const tasten = new Tasten();
    const swing = (bagger as unknown as { swing: THREE.Vector2 }).swing;
    let groessteAchse = 0;
    for (let i = 0; i < 360; i++) {
      tasten.down.clear();
      tasten.down.add("KeyQ");
      bagger.update(DT, tasten as never);
      world.step();
      groessteAchse = Math.max(groessteAchse, Math.abs(swing.x), Math.abs(swing.y));
    }
    expect(
      groessteAchse / GRAD,
      `groesster Achsausschlag ${(groessteAchse / GRAD).toFixed(1)}° — unter ${ALTER_DECKEL}° ` +
        `haette der alte Deckel gar nicht gegriffen`
    ).toBeGreaterThan(ALTER_DECKEL);
  });

  it("und laeuft trotzdem nicht davon: 30 s Dauerschwenk bleiben unter 60 Grad", () => {
    /*
     * Die Sorge bei jeder entfernten Sperre. Sie ist hier unbegruendet, und
     * zwar aus einem Grund, der in der Gleichung steht: Die Rueckstellung geht
     * mit `sin(Ausschlag)` und ist damit periodisch — es gibt keinen Term, der
     * mit dem Winkel waechst. Trotzdem gemessen, nicht behauptet.
     */
    const { bagger, world } = baueBagger();
    const { hoechster, letzter } = schwenken(bagger, world, 1800, "KeyQ");
    expect(hoechster).toBeLessThan(60);
    expect(Number.isFinite(letzter)).toBe(true);
  });

  it("nach dem Ausschwingen haengt er wieder exakt lotrecht", () => {
    /*
     * Das Totband (`NEIGUNG_TOTBAND`, 0,5 Grad) ist die Stelle, an der der
     * lotrechte Greifer ueberhaupt entsteht: Ein gerechnetes Pendel trifft die
     * Null nie exakt. Ohne Totband waere `neigung === 0` im Spiel nie wahr,
     * die drei Vorabspruenge liefen nie, und die Zusage oben — Bodenanschlag
     * Ziffer fuer Ziffer wie vorher — waere im Betrieb nie eingeloest.
     */
    const { bagger, world } = baueBagger();
    schwenken(bagger, world, 300, "KeyQ");
    const nach = schwenken(bagger, world, 600, null);
    expect(nach.letzter).toBeLessThan(0.5);
    expect(bagger.neigung).toBe(0);
  });

  it("GEGENPROBE — ohne Totband bliebe ein Rest stehen", () => {
    /*
     * Dass das Totband wirklich etwas tut: Nach dem Ausschwingen steht das
     * Pendel NICHT auf null, sondern auf einem Rest — nur eben unter 0,5 Grad.
     * Waere der Rest exakt null, tuete das Totband nichts und die Pruefung
     * darueber waere leer.
     */
    const { bagger, world } = baueBagger();
    schwenken(bagger, world, 300, "KeyQ");
    schwenken(bagger, world, 600, null);
    const swing = (bagger as unknown as { swing: THREE.Vector2 }).swing;
    const rest = Math.hypot(swing.x, swing.y) / GRAD;
    expect(rest, "das Pendel steht exakt auf null — dann siebt das Totband nichts").toBeGreaterThan(
      0
    );
    expect(rest).toBeLessThan(0.5);
  });
});

/* ==================================================================== */
describe("Der Messstrahl wandert mit dem Greifer", () => {
  /**
   * `surfaceUnderClaws` schickt seinen Strahl aus dem FUSSPUNKT DER
   * GREIFERACHSE nach unten, nicht aus dem Kardangelenk. Schraeg haengend
   * liegt der seitlich versetzt — bei 17 Grad und 2,75 m Tiefe um 80 cm.
   *
   * Geprueft wird mit einem Podest, das GENAU DORT liegt, wo die Achse den
   * Boden trifft. Wo das ist, wird nicht nachgerechnet, sondern an der
   * Drehung des Greifers abgegriffen — so haengt der Versuch an keinem
   * Vorzeichen, das jemand von Hand nachziehen muesste.
   */
  const PODEST_H = 1.2;
  /**
   * Halbe Kantenlaenge des Podests (m).
   *
   * 0,15 m, und die Zahl haengt am gemessenen Ausschlag: Im Schwenk haengt der
   * Greifer rund 7,8 Grad schraeg, der Fusspunkt der Achse liegt damit
   * `3,00 · sin 7,8° = 0,41 m` neben dem Gelenk. Zwei Podeste an ±0,41 m
   * duerfen sich nicht beruehren und keines darf das Gelenk ueberdecken —
   * sonst meldet der Strahl beide und die Gegenprobe ist blind. Mit 0,15 m
   * bleiben 0,26 m Luft nach beiden Seiten.
   */
  const PODEST_HALB = 0.15;

  /** Bagger mit ausgeschlagenem Pendel — geschwenkt, bis es schraeg haengt. */
  function ausgeschlagen(): { bagger: Excavator; world: RAPIER.World } {
    const { bagger, world } = baueBagger();
    schwenken(bagger, world, 300, "KeyQ");
    expect(bagger.neigung / GRAD, "das Pendel haengt gar nicht schraeg").toBeGreaterThan(3);
    /*
     * Und der Versatz ist groesser als das Podest: Sonst lagen beide Podeste
     * unter dem Gelenk und der Versuch unterschiede nichts.
     */
    const versatz = SICHELKRALLE.maxTiefe * Math.hypot(bagger.pendelAchse.x, bagger.pendelAchse.z);
    expect(versatz, `Versatz nur ${versatz.toFixed(2)} m`).toBeGreaterThan(2 * PODEST_HALB);
    return { bagger, world };
  }

  /** Wo die Greiferachse den Boden trifft, waagerecht (Weltkoordinaten). */
  function achsfusspunkt(bagger: Excavator, richtung: 1 | -1): { x: number; z: number } {
    const g = bagger.grappleGroup;
    return {
      x: g.position.x + richtung * SICHELKRALLE.maxTiefe * bagger.pendelAchse.x,
      z: g.position.z + richtung * SICHELKRALLE.maxTiefe * bagger.pendelAchse.z,
    };
  }

  function mitPodest(richtung: 1 | -1): number {
    const { bagger, world } = ausgeschlagen();
    const f = achsfusspunkt(bagger, richtung);
    const p = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(f.x, PODEST_H / 2, f.z)
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(PODEST_HALB, PODEST_H / 2, PODEST_HALB), p);
    world.step();
    const splay = (bagger as unknown as { currentSplay(): number }).currentSplay();
    return (bagger as unknown as { surfaceUnderClaws(s: number): number }).surfaceUnderClaws(splay);
  }

  it("schraeg haengend misst der Strahl das Podest unter den Schalen", () => {
    expect(mitPodest(1)).toBeGreaterThan(PODEST_H - 0.02);
  });

  it("GEGENPROBE — dasselbe Podest auf der anderen Seite zaehlt nicht", () => {
    /*
     * Es liegt genauso weit vom Gelenk entfernt, nur in der Gegenrichtung.
     * Wuerde der Strahl weiter senkrecht aus dem Gelenk kommen, meldete er
     * beide Podeste nicht — oder bei kleinem Versatz beide. Dass genau eines
     * zaehlt, ist der Nachweis, dass er der Achse folgt.
     */
    expect(mitPodest(-1)).toBeLessThan(0.02);
  });
});

/* ==================================================================== */
describe("Das gesteuerte Seitwaertskippen ist zurueckgenommen (E-105)", () => {
  /**
   * Am 17.09.2026 hat Patrick klargestellt: „kippen soll als funktion raus,
   * das war ein missverstaendnis." Gemeint war nie ein Bedienelement, sondern
   * die Bauart — ein Greifer haengt frei.
   *
   * Dieser Waechter haelt das fest, damit es niemand aus Gewohnheit wieder
   * einbaut. Er sucht im QUELLTEXT, nicht am Verhalten: Eine Funktion, die
   * niemand mehr aufruft, faellt keinem Verhaltenstest auf.
   */
  const wurzel = resolve(__dirname, "..");
  const lies = (p: string) => readFileSync(resolve(wurzel, p), "utf8");

  it("weder Bagger noch Seite noch Touch kennen die Kippfunktion", () => {
    const orte = ["src/excavator/excavator.ts", "src/main.ts", "src/core/touch.ts", "index.html"];
    for (const ort of orte) {
      const text = lies(ort);
      for (const wort of ["toggleKippen", "kippIst", "kippSoll", "kippAktiv", "btn-kipp"]) {
        expect(text.includes(wort), `${ort} enthaelt wieder "${wort}"`).toBe(false);
      }
    }
  });

  it("der Bodenanschlag folgt dem Pendel NICHT — mit der Zahl, die das begruendet", () => {
    /*
     * `ANSCHLAG_FOLGT_PENDEL` steht auf `false`, und das ist eine Entscheidung
     * mit Preisschild, keine Vergesslichkeit. Gemessen am 17.09.2026: Mit
     * `true` setzt der geschlossene Greifer auf 7,90 statt 6,37 cm ab
     * (Sichelkralle) und auf 21,21 statt 20,44 cm (Fuenfschalengreifer) —
     * weil der Anschlag den Arm ANHEBT, waehrend das Pendel beim Absenken ein
     * paar Grad ausschlaegt, und `bodenSperre` ihn danach oben festhaelt.
     *
     * Wer den Schalter umlegt, aendert das Absetzen. Das gehoert in ein
     * eigenes Paket mit eigener Abnahme — und dann faellt dieser Waechter auf
     * und erinnert daran, die beiden Zahlen oben neu zu messen.
     */
    const text = lies("src/excavator/excavator.ts");
    expect(
      /const ANSCHLAG_FOLGT_PENDEL = false;/.test(text),
      "ANSCHLAG_FOLGT_PENDEL steht nicht mehr auf false — dann sind 6,37 und 20,44 cm neu zu messen"
    ).toBe(true);
  });

  it("GEGENPROBE — ein wieder eingebauter Aufruf wuerde gemeldet", () => {
    const kaputt = lies("src/main.ts") + "\nexcavator.toggleKippen();\n";
    expect(kaputt.includes("toggleKippen"), "die Suche findet den Aufruf nicht").toBe(true);
  });
});
