/**
 * WÄCHTER: Der offene Greifer muss in jede Engstelle passen, in die er
 * hineingreifen soll — gemessen am GEBAUTEN NETZ, nicht an einer Formel.
 *
 * ## Warum es diesen Wächter gibt
 *
 * E-090 hat den Hüllkreis des Fünfschalengreifers von 3,2262 auf 3,3064 m
 * wachsen lassen (+8 cm) und dazu selbst geschrieben: „An denselben 8 cm hängen
 * Presskammer und Muldenbreiten … Die sind hier NICHT nachgemessen worden."
 * Das ist genau die Sorte offener Punkt, die sonst erst auf dem iPad auffällt —
 * und Patrick testet gleich.
 *
 * ## Was dieser Wächter anders macht als die beiden, die es schon gibt
 *
 * `test/spinnenmass.test.ts` und `test/presseKammer.test.ts` rechnen mit
 * `clawSpan(CLAW_OPEN_SPLAY)` = 3,3805 m. Das ist die MITTELLINIE der
 * Sichelkralle. Der gezeichnete Körper ist breiter: **3,5335 m**, gemessen am
 * Netz, und der weiteste Punkt ist die Zahnkappe `tineTip`.
 *
 * **15,3 cm Modell, die es in der Rechnung nicht gab.** Das ist dieselbe
 * Klasse Fehler wie am 14.09.2026 beim Bodenanschlag: Der Zahnkegel wurde
 * gezeichnet, aber nicht gerechnet, es fehlten 0,1241 m — und genau so weit
 * sank die Spinne in den Beton („Spinne sitzt auf, die kleinen äussersten
 * Noppen verschwinden im Boden"). Diesmal fehlt es in der Breite.
 *
 * Und: **beide Formen**. Der Fünfschalengreifer stand bisher in keinem
 * einzigen Maßwächter des Platzes.
 *
 * ## Warum ein KREIS und nicht ein Quadrat
 *
 * Der Greifer hängt an einem Rotator. Welche Stellung der gerade hat, weiß
 * niemand — also zählt das Maß, das in JEDER Rotatorstellung gilt: der
 * Hüllkreis. Ihm gegenüber steht der größte freie Kreis in der Öffnung.
 * Beides ist drehinvariant, beides ist am gebauten Körper gemessen.
 *
 * Warum am Netz und nicht am Kasten: E-065 hat die Freigangfrage mit Kästen
 * beantwortet und bei 0 Grad −0,071 m gemeldet, wo der Greifer nachweislich
 * frei hing. Hier ist die Messung sogar EXAKT statt abgetastet — das Maximum
 * von `hypot(x, z)` über ein Dreieck liegt immer in einer Ecke, die Eckpunkte
 * der Netze reichen also aus. Es gibt keine Fehlerschranke, die man
 * dazurechnen müsste.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import { initPhysics } from "../src/physics/physicsWorld";
import { SICHELKRALLE } from "../src/excavator/greiferform";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";
import { clawSpan, CLAW_OPEN_SPLAY } from "../src/excavator/clawGeometry";
import type { Greiferform } from "../src/excavator/greiferform";
import {
  aufgeblasen,
  freierKreis,
  huellkreisKurve,
  leinwandMitVerlauf,
  type Fenster,
  type Kasten,
} from "../tools/engstellen-kern";
import { zielePlatz, type Ziel } from "../tools/engstellen-platz";

/** Um wie viel der Prüfgreifer der Gegenprobe breiter ist (m). */
// E-138: 0,20 → 0,40. Mit der groesseren Presse (4,45 x 5,05 m) liegt keine
// Engstelle mehr innerhalb von 20 cm ueber dem Huellkreis der Sichelkralle —
// die Gegenprobe haette nichts mehr gefunden, und das waere keine Pruefung.
// Bei 40 cm meldet sie die Presskammer (Sichelkralle) bzw. den MUELL-Container
// (Fuenfschalengreifer).
const AUFBLASEN = 0.4;

interface Mass {
  form: Greiferform;
  /** Größter Hüllkreis über den ganzen Öffnungsweg (m). */
  huell: number;
  /** Bei welchem Öffnungsgrad, und in welchem Netz. */
  beiT: number;
  netz: string;
  /** Derselbe Greifer, um AUFBLASEN breiter — die Gegenprobe. */
  dick: number;
}

function vermessen(form: Greiferform): Mass {
  const kurve = huellkreisKurve(form.baue(), form.schalen, form.zu, form.offen, 41);
  const groesste = kurve.reduce((a, b) => (b.d > a.d ? b : a));
  /*
   * Ein ZWEITES Modell für die Gegenprobe, nicht dasselbe. `aufgeblasen`
   * hängt die Greifergruppe in eine gestreckte Gruppe um; wer danach noch
   * einmal das Original misst, misst durch dieselbe Streckung hindurch und
   * bekommt seine Zahl scheinbar unverändert zurück. Zwei Modelle, keine
   * Verwechslung.
   */
  const zweites = form.baue();
  const dickKurve = huellkreisKurve(
    aufgeblasen(zweites, groesste.d, AUFBLASEN),
    form.schalen,
    form.zu,
    form.offen,
    41
  );
  return {
    form,
    huell: groesste.d,
    beiT: groesste.t,
    netz: groesste.netz,
    dick: dickKurve.reduce((a, b) => (b.d > a.d ? b : a)).d,
  };
}

/**
 * Wo ein Greifer dieser Breite ANSTÖSST — nur Ziele, in die er hinein soll.
 *
 * Rückgabe: `"<Form> × <Ziel>"` je Verstoß, sortiert. Genau dieselbe Funktion
 * bekommt in der Gegenprobe den aufgeblasenen Greifer vorgelegt; wäre sie für
 * beide verschieden, prüfte die Gegenprobe nicht den Wächter, sondern sich
 * selbst.
 */
interface Engstelle {
  name: string;
  /** Groesster freier Kreis in der Oeffnung (m). */
  frei: number;
  sollPassen: boolean;
}

function anstoesse(stellen: Engstelle[], name: string, durchmesser: number): string[] {
  return stellen
    .filter((e) => e.sollPassen && e.frei <= durchmesser)
    .map((e) => `${name} × ${e.name}`)
    .sort();
}

/**
 * WAS HEUTE NACHWEISLICH NICHT PASST — gemessen am 16.09.2026, nicht geduldet.
 *
 * Diese Liste ist KEINE Ausnahme, die etwas durchwinkt: Der Wächter vergleicht
 * auf GLEICHHEIT. Kommt ein Anstoß dazu, meldet er. Fällt dieser hier weg,
 * meldet er auch — und sagt damit demjenigen, der ihn behoben hat, dass die
 * Zeile hier zu löschen ist. Eine Ausnahme, die sich selbst abräumt.
 *
 * Der Befund: Die offene Sichelkralle misst am Netz 3,5335 m, der
 * Absetzcontainer ist innen 3,42 m weit (3,60 aussen minus zweimal 0,09 m
 * Wand). **5,7 cm zu breit je Seite.** Ganz offen setzen ihre Zahnkappen auf
 * den Bordwänden auf; bis 95 % Öffnung geht sie hinein.
 *
 * ER IST ÄLTER ALS E-090. Die Sichelkralle ist beim Schalenumbau Bit für Bit
 * unverändert geblieben (E-090, Abdruckvergleich: grösster Unterschied
 * 0,000e+0). Gefunden wurde er trotzdem erst jetzt, und zwar aus zwei Gründen,
 * die beide in `test/spinnenmass.test.ts` stehen:
 *
 *   1. Dort wird mit `clawSpan` = 3,3805 m gerechnet statt mit dem Netz —
 *      3,3805 hätte in 3,42 m noch hineingepasst.
 *   2. Absetzcontainer werden dort gar nicht geprüft: Der Wächter kennt
 *      Presskammer, Sortierbox und `kind === "bay"`, aber kein `rolloff`.
 *
 * Was daraus wird, entscheidet Patrick — Container breiter, Greifer schmaler,
 * oder so lassen. Dieser Wächter entscheidet nichts, er hält die Zahl fest.
 */
const BEKANNTE_ANSTOESSE = ["Sichelkralle × Absetzcontainer MUELL"];

describe("Engstellen: passt der offene Greifer hinein?", () => {
  let ziele: Ziel[];
  let stellen: Engstelle[];
  let masse: Mass[];

  beforeAll(async () => {
    leinwandMitVerlauf();
    await initPhysics();
    ziele = zielePlatz().ziele;
    /*
     * Die freien Kreise EINMAL. Die Rastersuche ist der teure Teil dieses
     * Waechters; wer sie je Vergleich wiederholt, laesst ihn ohne Not
     * minutenlang laufen — und ein Waechter, der zu lange braucht, wird
     * irgendwann abgeschaltet.
     */
    stellen = ziele.map((z) => ({
      name: z.fenster.name,
      frei: freierKreis(z.fenster, z.hindernisse).d,
      sollPassen: z.sollPassen,
    }));
    masse = [SICHELKRALLE, FUENFSCHALEN].map(vermessen);
  });

  it("Nullprobe: der Rechenkern misst bekannte Figuren richtig", () => {
    const leer: Fenster = {
      name: "leer",
      x0: -2.5, x1: 2.5, z0: -1.5, z1: 1.5, y0: 0, y1: 1,
      herkunft: "Nullprobe",
    };
    // Ein leeres Fenster von 5 x 3 m nimmt einen Kreis von 3,00 m auf.
    expect(freierKreis(leer, []).d).toBeCloseTo(3.0, 2);
    // Eine 1,00 m breite Wand mittig quer hinein lässt links und rechts 2,00 m.
    const wand: Kasten = {
      name: "Prüfwand",
      min: { x: -0.5, y: 0, z: -1.5 },
      max: { x: 0.5, y: 1, z: 1.5 },
    };
    expect(freierKreis(leer, [wand]).d).toBeCloseTo(2.0, 2);
    // Dieselbe Wand ÜBER dem Höhenband ist kein Hindernis.
    const hoch: Kasten = {
      name: "Prüfwand hoch",
      min: { x: -0.5, y: 2, z: -1.5 },
      max: { x: 0.5, y: 3, z: 1.5 },
    };
    expect(freierKreis(leer, [hoch]).d).toBeCloseTo(3.0, 2);
    /*
     * Und die Messung am Netz: ein Kasten von 2,00 x 4,00 m auf der Achse.
     * Sein weitester Punkt ist eine Ecke, hypot(1; 2) = 2,2360679…, der
     * Hüllkreis also 4,4721359… — von Hand nachzurechnen.
     */
    const g = new THREE.Group();
    const k = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 4));
    k.position.y = -1;
    g.add(k);
    const kurve = huellkreisKurve(
      { gruppe: g, setWinkel: () => {}, nachfuehren: () => {} },
      1, 0, 1, 3
    );
    expect(kurve[0]!.d).toBeCloseTo(2 * Math.hypot(1, 2), 6);
  });

  it("der Hüllkreis wird am NETZ gemessen — und der ist breiter als die Mittellinie", () => {
    const sichel = masse.find((m) => m.form.id === "sichel")!;
    const fuenf = masse.find((m) => m.form.id === "fuenfschalen")!;
    // eslint-disable-next-line no-console
    console.log(
      `Hüllkreis am Netz: Sichelkralle ${sichel.huell.toFixed(4)} m (${sichel.netz}) · ` +
        `Fünfschalengreifer ${fuenf.huell.toFixed(4)} m (${fuenf.netz}) · ` +
        `clawSpan(CLAW_OPEN_SPLAY) ${clawSpan(CLAW_OPEN_SPLAY).toFixed(4)} m`
    );
    /*
     * Die Zahl des Fünfschalengreifers ist die aus E-090 („Hüllkreis 3,3064 m,
     * +8 cm"). Sie steht hier, damit der Umbau der Schale nicht ein zweites
     * Mal unbemerkt in die Breite geht.
     */
    expect(fuenf.huell, "Hüllkreis Fünfschalengreifer (E-090: 3,3064 m)").toBeCloseTo(3.3064, 3);
    /*
     * Die Zahl der Sichelkralle stand bisher nirgends — gemessen 16.09.2026.
     * Der weiteste Punkt ist die Zahnkappe `tineTip` am ganz offenen Greifer.
     */
    expect(sichel.huell, "Hüllkreis Sichelkralle, am Netz gemessen").toBeCloseTo(3.5335, 3);
    expect(sichel.netz, "der weiteste Punkt ist die Zahnkappe").toContain("tineTip");
    expect(sichel.beiT, "und er sitzt am ganz offenen Greifer").toBeCloseTo(1, 6);
    /*
     * DER KERN DER SACHE: Die Mittellinienformel unterschätzt den gezeichneten
     * Körper. Wer mit ihr prüft, prüft einen Greifer, den es nicht gibt.
     */
    expect(
      sichel.huell - clawSpan(CLAW_OPEN_SPLAY),
      "clawSpan misst die Mittellinie, nicht die Zahnkappen"
    ).toBeGreaterThan(0.15);
  });

  it("jede Engstelle, in die er hinein soll, nimmt beide Greifer auf", () => {
    const alle = masse.flatMap((m) => anstoesse(stellen, m.form.name, m.huell)).sort();
    for (const e of stellen) {
      if (!e.sollPassen) continue;
      // eslint-disable-next-line no-console
      console.log(
        `${e.name.padEnd(34)} frei ${e.frei.toFixed(3)} m · ` +
          masse
            .map((m) => `${m.form.name.slice(0, 5)} ${(((e.frei - m.huell) / 2) * 100).toFixed(1)} cm`)
            .join(" · ")
      );
    }
    expect(alle, "neuer Anstoß, oder ein bekannter ist behoben — siehe BEKANNTE_ANSTOESSE").toEqual(
      BEKANNTE_ANSTOESSE
    );
  });

  it("GEGENPROBE: ein um 40 cm aufgeblasener Greifer MUSS gemeldet werden", () => {
    for (const m of masse) {
      /*
       * Erst die Messung selbst: Der Prüfgreifer ist wirklich AUFBLASEN breiter.
       * Ohne diesen Satz prüfte die Gegenprobe nur, dass „Zahl plus 20" größer
       * ist als „Zahl" — und das weiß man auch ohne Test.
       */
      expect(
        m.dick - m.huell,
        `${m.form.name}: der Prüfgreifer ist gar nicht breiter geworden`
      ).toBeCloseTo(AUFBLASEN, 6);
      const heute = anstoesse(stellen, m.form.name, m.huell);
      const jetzt = anstoesse(stellen, m.form.name, m.dick);
      // eslint-disable-next-line no-console
      console.log(
        `Gegenprobe ${m.form.name}: ${m.huell.toFixed(4)} m → ${m.dick.toFixed(4)} m, ` +
          `Anstöße ${heute.length} → ${jetzt.length}: ${jetzt.join(" | ")}`
      );
      expect(
        jetzt.length,
        `${m.form.name} um ${AUFBLASEN * 100} cm breiter wird nirgends gemeldet — der Wächter wäre blind`
      ).toBeGreaterThan(heute.length);
      for (const a of heute) expect(jetzt, "ein alter Anstoß ist verschwunden").toContain(a);
    }
  });

  it("GEGENPROBE an der PRESSKAMMER: wie viel Zugabe sie verträgt, und ab wann sie meldet", () => {
    /*
     * Die Presskammer ist die Stelle, an die E-090 ausdrücklich erinnert hat.
     * 20 cm reichen dort nicht als Gegenprobe — und DAS ist die eigentliche
     * Auskunft: Sie hat mehr Luft als 20 cm. Statt die Zugabe zu raten, wird
     * sie GEMESSEN und dann genau um einen Zentimeter überschritten.
     *
     * Die Rechnung: Der Greifer passt, solange sein Hüllkreis kleiner ist als
     * der freie Kreis. Die Zugabe bis zum Anstoß ist also
     *     reserve = frei − Hüllkreis          (im DURCHMESSER)
     * und die Hälfte davon ist die Luft je Seite, die in der Tabelle steht.
     * Wer das verwechselt, hält 16,7 cm je Seite für 16,7 cm Zugabe — genau
     * dieser Irrtum hat die erste Fassung dieser Gegenprobe reißen lassen.
     */
    const presse = stellen.find((e) => e.name === "Presskammer, Stempel geparkt")!;
    for (const m of masse) {
      const reserve = presse.frei - m.huell;
      // eslint-disable-next-line no-console
      console.log(
        `Presskammer, Stempel geparkt: frei ${presse.frei.toFixed(4)} m · ` +
          `${m.form.name} ${m.huell.toFixed(4)} m · Reserve ${(reserve * 100).toFixed(1)} cm ` +
          `im Durchmesser (${((reserve / 2) * 100).toFixed(1)} cm je Seite)`
      );
      expect(reserve, `${m.form.name} passt heute nicht mehr an den Stempel vorbei`).toBeGreaterThan(0);
      /*
       * Ein GEBAUTER Greifer, um genau diese Reserve plus 1 cm gestreckt, muss
       * an der Presskammer gemeldet werden. Gebaut, nicht gerechnet — sonst
       * prüfte die Gegenprobe nur eine Subtraktion.
       */
      const zuDick = huellkreisKurve(
        aufgeblasen(m.form.baue(), m.huell, reserve + 0.01),
        m.form.schalen,
        m.form.zu,
        m.form.offen,
        41
      ).reduce((a, b) => (b.d > a.d ? b : a)).d;
      expect(zuDick - m.huell, "der Prüfgreifer wurde nicht wie verlangt gestreckt").toBeCloseTo(
        reserve + 0.01,
        6
      );
      expect(
        anstoesse(stellen, m.form.name, zuDick),
        `${m.form.name} mit ${((reserve + 0.01) * 100).toFixed(1)} cm Zugabe passt angeblich noch an den Stempel vorbei`
      ).toContain(`${m.form.name} × Presskammer, Stempel geparkt`);
    }
  });

  it("die Ziele stehen vollzählig — kein Behälter fällt stillschweigend heraus", () => {
    /*
     * Ein Wächter, der weniger Ziele prüft als der Platz hat, ist grün und
     * wertlos. Genau das ist am 15.09.2026 dreimal passiert (`tsconfig.test.json`:
     * Wächter, die zwei Stunden lang NaN geprüft haben). Deshalb steht hier,
     * WIE VIELE Engstellen es gibt.
     */
    const namen = ziele.map((z) => z.fenster.name);
    expect(namen).toContain("Presskammer, Stempel geparkt");
    expect(namen).toContain("Presskammer, ohne den Stempel");
    expect(namen).toContain("Absetzcontainer MUELL");
    expect(namen).toContain("Halde MISCHSCHROTT");
    expect(namen).toContain("Halde STAHLSCHROTT");
    expect(namen).toContain("Ladeflaeche des Abholers");
    expect(namen).toContain("Silo-Gasse, Wagen in der Mulde");
    // Sechs Lagersilos (E-028) plus die Sortierbox BUNT + VA.
    expect(namen.filter((n) => n.startsWith("Mulde ")).length, "Zahl der Mulden").toBe(7);
    expect(ziele.filter((z) => z.sollPassen).length, "Zahl der Ziele, in die er hinein SOLL").toBe(12);
  });
});
