import { describe, it, expect } from "vitest";
import {
  FASSUNGEN,
  css,
  knopfKasten,
  loese,
  pedalKasten,
  px,
  pxOderNull,
  seite,
  wert,
  type Fassung,
  type Kasten,
} from "./cssmass";

/*
 * Sichere Raender: Notch, abgerundete Ecken, Home-Indicator.
 *
 * Befund 15.09.2026 (E-027, offener Punkt 2): `viewport-fit=cover` stand seit
 * jeher im Dokument, `env(safe-area-inset-*)` wurde NIRGENDS benutzt. Im
 * Querformat sass der untere HUD-Block 6 px ueber der Unterkante — genau auf
 * dem weissen Balken. Nachgerechnet lagen im Querformat SIEBEN Elemente
 * teilweise im Rand (Pedale, beide Drehtasten, Menueknopf, Ladeanzeige, Konto,
 * Tagesablauf), im Hochformat vier.
 *
 * Der Vorgaenger hat ausdruecklich empfohlen, es fuer ALLE unteren Elemente
 * gemeinsam zu loesen. Genau das prueft diese Datei: nicht, dass irgendwo ein
 * env() steht, sondern dass KEIN Bedienelement und keine Anzeige in einer der
 * drei Fassungen in den Rand ragt.
 */

/** Alles, was am Bildrand klebt und deshalb einen sicheren Rand braucht. */
function randElemente(f: Fassung): Kasten[] {
  const out: Kasten[] = [pedalKasten(f), knopfKasten("btn-rot-l", f), knopfKasten("btn-rot-r", f)];

  const menue = knopfKasten("btn-menu", f);
  out.push(menue);

  /*
   * Fuer die Stapel und die Tutorialkarte zaehlt nur die VERANKERTE Kante —
   * wie hoch oder breit sie werden, haengt am Text und steht in
   * greifanzeige.test.ts bzw. hudplatz.test.ts. Damit die Pruefung unten
   * trotzdem in beiden Achsen laufen kann, bekommt jeder dieser Kaesten die
   * freie Achse als volle Spanne INNERHALB des Randes: Er soll an dieser
   * Seite nicht durchfallen, nur weil dort nichts verankert ist.
   */
  const frei = { x0: f.sa.l, x1: f.w - f.sa.r, y0: f.sa.b, y1: f.h - f.sa.t };

  const ho = ["#hudoben", "body.touch #hudoben"];
  const oTop = px(ho, "top", f);
  const oRechts = pxOderNull(ho, "right", f);
  const oLinks = pxOderNull(ho, "left", f);
  out.push({
    name: "HUD oben",
    x0: oLinks ?? frei.x0,
    x1: oRechts === null ? frei.x1 : f.w - oRechts,
    y0: frei.y0,
    y1: f.h - oTop,
  });

  const hu = ["#hudunten", "body.touch #hudunten"];
  out.push({
    name: "HUD unten",
    x0: px(hu, "left", f),
    x1: f.w - px(hu, "right", f),
    y0: px(hu, "bottom", f),
    y1: frei.y1,
  });

  const tut = ["#tutorial", "body.touch #tutorial"];
  const tLinks = px(tut, "left", f);
  out.push({
    name: "Tutorialkarte",
    x0: tLinks,
    x1: frei.x1,
    y0: frei.y0,
    y1: f.h - px(tut, "top", f),
  });

  return out;
}

describe("Sichere Raender", () => {
  it("benutzt env() ueberhaupt — und immer mit Ersatzwert 0px", () => {
    /*
     * Der Ersatzwert ist kein Schmuck: Aeltere Safari-Fassungen verwerfen eine
     * Deklaration mit einem env()-Namen, den sie nicht kennen, komplett. Ohne
     * `, 0px` stuende das Element dann ueberhaupt nicht mehr dort, wo es soll —
     * und zwar auf genau den Geraeten, auf denen der Rand gar nicht noetig ist.
     */
    const treffer = [...css.matchAll(/env\(\s*safe-area-inset-(\w+)([^)]*)\)/g)];
    expect(treffer.length, "env(safe-area-inset-*) wird nirgends benutzt").toBeGreaterThanOrEqual(4);
    for (const t of treffer)
      expect(t[2].replace(/\s/g, ""), `env() ohne Ersatzwert: ${t[0]}`).toBe(",0px");
    // Alle vier Seiten, nicht nur unten.
    const seiten = new Set(treffer.map((t) => t[1]));
    expect([...seiten].sort()).toEqual(["bottom", "left", "right", "top"]);
    // Und `viewport-fit=cover` muss dafuer gesetzt sein, sonst meldet Safari 0.
    expect(seite).toContain("viewport-fit=cover");
  });

  it("holt die Raender an einer Stelle und benutzt ueberall dieselben Namen", () => {
    // Vier Variablen, ein Ort. Stuende env() an zwanzig Stellen, wuerde die
    // naechste Aenderung eine davon vergessen.
    for (const name of ["--sa-l", "--sa-r", "--sa-t", "--sa-b"]) {
      const setzt = [...css.matchAll(new RegExp(`${name}:`, "g"))];
      expect(setzt.length, `${name} wird ${setzt.length}-mal gesetzt`).toBe(1);
    }
  });

  it("rueckt #touch selbst NICHT ein — sonst liegt jeder Stick neben dem Daumen", () => {
    /*
     * Die kuerzeste Fassung waere, `#touch` einzuruecken; alle Knoepfe darin
     * sind absolut positioniert und wuerden mitwandern. Sie ist falsch: Die
     * schwebenden Sticks bekommen ihre Lage aus `clientX/clientY`
     * (`core/touch.ts`), und die zaehlen ab dem Polsterkasten von `#touch`.
     * Eingerueckt laege jeder Stick um die Randbreite daneben.
     */
    const block = /#touch \{([^}]*)\}/.exec(css);
    expect(block, "#touch fehlt").not.toBeNull();
    expect(block![1]).toContain("inset: 0");
    expect(block![1]).not.toContain("--sa-");
  });

  for (const f of FASSUNGEN) {
    describe(f.name, () => {
      it("haelt jedes Element innerhalb der sicheren Raender", () => {
        for (const k of randElemente(f)) {
          expect(k.x0, `${k.name} ragt links in den Rand`).toBeGreaterThanOrEqual(f.sa.l);
          expect(k.x1, `${k.name} ragt rechts in den Rand`).toBeLessThanOrEqual(f.w - f.sa.r);
          expect(k.y0, `${k.name} ragt unten in den Rand`).toBeGreaterThanOrEqual(f.sa.b);
          expect(k.y1, `${k.name} ragt oben in den Rand`).toBeLessThanOrEqual(f.h - f.sa.t);
        }
      });

      it("legt die Tafeln der Dialoge in den sicheren Bereich, den Ueberzug aber aufs ganze Glas", () => {
        // Sonst blitzt am Rand das Spiel durch, oder der Schliessen-Knopf
        // liegt unter dem Home-Indicator.
        for (const sel of ["#pause", "#pickup", "#haggle", "#shop", "#radio"]) {
          const v = wert([sel], "padding", f);
          expect(v, `${sel} ohne sicheren Innenrand`).not.toBeNull();
          expect(v).toContain("--sa-");
          expect(wert([sel], "inset", f)).toBe("0");
          expect(wert([sel], "box-sizing", f)).toBe("border-box");
        }
      });
    });
  }

  it("aendert auf dem iPad keinen einzigen Pixel", () => {
    /*
     * Die wichtigste Zusicherung des ganzen Umbaus. env() liefert auf dem iPad
     * null; jedes max(Grundabstand, 0 + Mindestluft) faellt damit auf den
     * Grundabstand zurueck. Hier stehen die Werte von vor dem Umbau
     * (Stand 15.09.2026, Messung docs/messungen/2026-09-15-greifanzeige) —
     * faellt einer, ist die iPad-Fassung verschoben worden.
     */
    /*
     * GEAENDERT am 22.10.2026 (Befund 40e): Pedale unten mittig statt unten
     * links, der untere Block links daneben. Gewollte Verschiebung — die
     * neuen Werte stehen hier, damit die naechste ungewollte wieder auffaellt.
     * Vorher: Pedale [12, 10], Block links 198 / rechts 82.
     */
    const iPad = FASSUNGEN[0];
    const pedale = pedalKasten(iPad);
    expect([pedale.x0, pedale.y0]).toEqual([439, 10]);
    expect(px(["#hudunten", "body.touch #hudunten"], "left", iPad)).toBe(12);
    expect(px(["#hudunten", "body.touch #hudunten"], "right", iPad)).toBe(597);
    expect(px(["#hudunten", "body.touch #hudunten"], "bottom", iPad)).toBe(10);
    expect(px(["#touch .btn", "#touch #btn-rot-l"], "bottom", iPad)).toBe(238);
    expect(px(["#touch .btn", "#touch #btn-rot-r"], "bottom", iPad)).toBe(180);
    expect(px(["#btn-menu"], "top", iPad)).toBe(12);
  });

  it("die Aufloesung von max() und calc() ist selbst richtig", () => {
    /*
     * Warnung aus dem Auftrag vom 15.09.2026: Am selben Tag war ein Waechter
     * zwei Stunden gruen, weil seine Eingaben NaN waren — jeder Vergleich mit
     * NaN ist falsch. Darum wird der Rechner hier an bekannten Faellen
     * geprueft, und `loese()` wirft bei allem, was es nicht versteht, statt
     * NaN zurueckzugeben.
     */
    const rand = { l: 50, r: 44, t: 50, b: 34 };
    expect(loese("12px", rand)).toBe(12);
    expect(loese("calc(var(--sa-l) + 156px)", rand)).toBe(206);
    expect(loese("max(12px, calc(var(--sa-t) + 8px))", rand)).toBe(58);
    expect(loese("max(190px, calc(var(--sa-r) + 8px))", rand)).toBe(190);
    expect(loese("max(12px, calc(var(--sa-r) + 8px))", { ...rand, r: 0 })).toBe(12);
    expect(loese("auto", rand)).toBeNull();
    expect(() => loese("50%", rand)).toThrow();
    // Prozent nur mit Bezugsgroesse (22.10.2026, Pedale mittig): 512 + 85
    expect(loese("calc(50% + 85px)", rand, 1024)).toBe(597);
    expect(() => loese("var(--unbekannt)", rand)).toThrow();
  });
});
