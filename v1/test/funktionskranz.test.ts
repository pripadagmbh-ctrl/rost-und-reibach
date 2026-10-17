import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EM_BREITE, FASSUNGEN, luft, seite, wert, schriftgroesse, type Fassung, type Kasten } from "./cssmass";

/*
 * Wieviel Platz der Funktionskranz braucht — und ob der naechste Eintrag noch
 * hineinpasst.
 *
 * Der Kranz klappt um den rechten Daumen auf; seine Eintraege sitzen auf einem
 * Kreis und werden durch Ziehen in ihre Richtung gewaehlt. Jeder neue Eintrag
 * rueckt alle anderen naeher zusammen: acht stehen 45 Grad auseinander, neun
 * nur noch 40, zehn nur noch 36.
 *
 * Seit E-105 (17.09.2026, Ansage Patrick) sind es SIEBEN: Der Eintrag fuer das
 * Seitwaertskippen ist mit der Funktion selbst hinausgeflogen — sie war ein
 * Missverstaendnis. Davor waren es acht (E-093: die Zonenmarkierungen zogen
 * ins Pausenmenue, weil sie eine Anzeigeeinstellung sind). Die reparierte
 * Geometrie bleibt — sie war der eigentliche Befund.
 *
 * Nachgemessen am 16.09.2026, als ein neunter Eintrag dazukam (E-088),
 * und der Befund war unangenehm: Schon die ACHT Eintraege ueberlappten sich —
 * um 3,5 px an den Ecken, auf dem iPad. Der Grund war kein Rechenfehler,
 * sondern `box-sizing`: `width: 76px` war die Breite des INHALTS, der
 * 2-px-Rahmen kam obendrauf, und der negative Rand (-38px) traf damit nicht
 * die Mitte, sondern lag 2 px daneben. Dazu waechst der scharfgestellte
 * Eintrag per `transform: scale` — auch das war nie mitgerechnet.
 *
 * Deshalb rechnet dieser Waechter mit dem, was der Browser wirklich zeichnet:
 * Randbox, Vergroesserung, echte Zeichenbreite der Schrift.
 */

const wurzel = resolve(__dirname, "..");
const touchTs = readFileSync(resolve(wurzel, "src/core/touch.ts"), "utf8");

/**
 * Mindestluft zwischen zwei Eintraegen in px.
 *
 * // SW: Startwert zum Austesten auf dem Geraet. Hergeleitet aus dem, was man
 * sieht: Jeder Eintrag hat einen 2 px starken Rahmen. Bleiben weniger als
 * 2 + 2 px Abstand, beruehren sich die Rahmen zweier Nachbarn und werden zu
 * EINEM Strich — dann sieht der Kranz aus wie ein Band statt wie neun
 * Knoepfe. 6 px sind zwei Rahmen plus 2 px sichtbarer Spalt.
 */
const MIN_LUFT = 6;

/** Halbmesser des Kranzes, aus dem Quelltext statt aus dem Gedaechtnis. */
function radius(): number {
  const m = /const RADIAL_R = (\d+);/.exec(touchTs);
  if (!m) throw new Error("RADIAL_R steht nicht mehr in touch.ts");
  return Number(m[1]);
}

/** Die Beschriftungen des Kranzes, in der Reihenfolge der Seite. */
function eintraege(): string[] {
  const von = seite.indexOf('<div class="hidden-actions">');
  const bis = seite.indexOf('<div class="hidden-actions" id="menu-actions">');
  if (von < 0 || bis < 0) throw new Error("Traegerblock des Kranzes nicht gefunden");
  return [...seite.slice(von, bis).matchAll(/<span id="[\w-]+">([^<]+)<\/span>/g)].map((m) => m[1]);
}

const SEKTOR = ["#radial .sektor"];
const SEL = ["#radial .sektor.sel"];

/** Breite/Hoehe eines Eintrags, so wie er auf dem Glas steht (Randbox). */
function sektorMass(f: Fassung): { w: number; h: number; schrift: number } {
  /*
   * Ohne `border-box` waere `width` der Inhalt und der Rahmen kaeme obendrauf
   * — genau der Fehler, der bis zum 16.09.2026 3,5 px Ueberlappung erzeugt
   * hat. Der Waechter besteht darauf, statt still falsch zu rechnen.
   */
  expect(wert(SEKTOR, "box-sizing", f), "der Sektor steht nicht auf border-box").toBe(
    "border-box"
  );
  const w = Number(/(\d+)px/.exec(wert(SEKTOR, "width", f) ?? "")?.[1]);
  const h = Number(/(\d+)px/.exec(wert(SEKTOR, "height", f) ?? "")?.[1]);
  expect(Number.isFinite(w) && Number.isFinite(h), "Sektormass fehlt").toBe(true);
  return { w, h, schrift: schriftgroesse(SEKTOR, f) };
}

/** Der negative Rand MUSS die halbe Randbox sein, sonst sitzt nichts mittig. */
function randPruefen(f: Fassung, w: number, h: number): void {
  const m = wert(SEKTOR, "margin", f);
  const zahlen = (m ?? "").split(/\s+/).map((t) => Number(/(-?\d+)px/.exec(t)?.[1] ?? 0));
  expect(zahlen.length, `margin unerwartet: ${m}`).toBe(4);
  expect(zahlen[0], "oberer Rand trifft die Mitte nicht").toBe(-h / 2);
  expect(zahlen[3], "linker Rand trifft die Mitte nicht").toBe(-w / 2);
}

/** Vergroesserung des scharfgestellten Eintrags (`transform: scale(...)`). */
function skala(f: Fassung): number {
  const t = wert(SEL, "transform", f);
  const m = /scale\(([\d.]+)\)/.exec(t ?? "");
  if (!m) throw new Error(`transform des gewaehlten Eintrags unklar: ${t}`);
  return Number(m[1]);
}

/** Die n Kaesten auf dem Ring; `gross` ist der scharfgestellte. */
function ring(n: number, r: number, w: number, h: number, gross: number, s: number): Kasten[] {
  const out: Kasten[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2; // 0 = oben, im Uhrzeigersinn — wie buildRadial
    const cx = Math.sin(a) * r;
    const cy = -Math.cos(a) * r;
    const bw = i === gross ? w * s : w;
    const bh = i === gross ? h * s : h;
    out.push({ name: `E${i}`, x0: cx - bw / 2, x1: cx + bw / 2, y0: cy - bh / 2, y1: cy + bh / 2 });
  }
  return out;
}

/**
 * Engste Stelle des Kranzes: jeder Eintrag einmal scharfgestellt, gegen alle
 * anderen. Negativ heisst Ueberlappung.
 */
export function engste(n: number, r: number, w: number, h: number, s: number): number {
  let min = Infinity;
  for (let g = 0; g < n; g++) {
    const k = ring(n, r, w, h, g, s);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) min = Math.min(min, luft(k[i], k[j]));
    }
  }
  return min;
}

describe("Funktionskranz: sieben Eintraege, und was der achte bis zehnte kosten", () => {
  const labels = eintraege();
  const r = radius();

  it("sieben Eintraege — und der Kippknopf ist keiner davon (E-105)", () => {
    /*
     * Patrick, 17.09.2026: kippen soll als Funktion raus, das war ein
     * Missverstaendnis. Ein Knopf fuer eine Funktion, die es nicht mehr gibt,
     * waere ein toter Knopf; `test/tastenerreichbarkeit.test.ts` haette ihn
     * gemeldet, aber erst nachdem jemand darauf getippt haette.
     */
    expect(labels, "der Kippknopf steht wieder im Kranz").not.toContain("KIPPEN");
    /*
     * E-118 (06.10.2026): Auf der SEITE stehen acht — NACHSCHUB kam fuer den
     * Simulator dazu. Im SPIEL sind es nie mehr als sieben: `main.ts` nimmt je
     * Spielart heraus, was nicht dazugehoert (Liste in `core/spielart.ts`) —
     * im Simulator ABHOLEN und LAMBERT (also sechs), im Betrieb NACHSCHUB.
     * Gemessen wird unten trotzdem mit allen acht, also mit dem engsten Fall.
     */
    expect(labels.length, `der Kranz hat ${labels.length} statt acht Eintraege`).toBe(8);
    expect(labels, "NACHSCHUB fehlt auf der Seite (E-118)").toContain("NACHSCHUB");
  });

  it("SCHILDER ist NICHT mehr dabei — es steht im Pausenmenue (E-093)", () => {
    /*
     * Ansage Patrick am Geraet, 16.09.2026: „Nimm Schild (Markierungen) aus
     * dem Menue raus, das kann ueber Hauptmenue geloest werden." Gemeint sind
     * die Zonenmarkierungen (`btn-marks`, Taste M) — eine Anzeigeeinstellung.
     * NICHT gemeint ist SCHILD (`btn-blade`, Taste I), das Raeumschild des
     * Baggers; das ist eine Maschinenfunktion und bleibt im Kranz. Die zwei
     * Namen sind einander so aehnlich, dass dieser Test beide nennt.
     */
    expect(labels, "SCHILDER steht wieder im Kranz").not.toContain("SCHILDER");
    expect(labels, "SCHILD — das Raeumschild — ist aus dem Kranz verschwunden").toContain("SCHILD");
    expect(
      seite.slice(seite.indexOf('<div class="hidden-actions" id="menu-actions">')),
      "SCHILDER ist nirgends im Menueblock — dann ist Taste M auf dem iPad unerreichbar"
    ).toContain('<span id="btn-marks">SCHILDER</span>');
  });

  for (const f of FASSUNGEN) {
    it(`${f.name}: kein Eintrag ueberlappt einen anderen`, () => {
      const { w, h } = sektorMass(f);
      randPruefen(f, w, h);
      const s = skala(f);
      const gemessen = engste(labels.length, r, w, h, s);
      expect(
        gemessen,
        `engste Stelle ${gemessen.toFixed(1)} px bei ${labels.length} Eintraegen ` +
          `(R=${r}, Kasten ${w}x${h}, scharf x${s})`
      ).toBeGreaterThanOrEqual(MIN_LUFT);
    });

    it(`${f.name}: die laengste Beschriftung passt in den Kasten`, () => {
      const { w, schrift } = sektorMass(f);
      const innen = w - 2 * 2; // 2 px Rahmen je Seite
      const laengste = labels.reduce((a, b) => (a.length >= b.length ? a : b));
      const breite = laengste.length * schrift * EM_BREITE;
      expect(
        breite,
        `"${laengste}" braucht ${breite.toFixed(1)} px, im Kasten sind ${innen} px ` +
          `— der Text bricht um und sprengt die Hoehe`
      ).toBeLessThanOrEqual(innen);
    });
  }

  it("ZWEI Plaetze sind frei, ein zehnter Eintrag nicht — mit Zahlen", () => {
    /*
     * Die Zahlenreihe, neu gemessen am 17.09.2026, nachdem der Kippknopf
     * hinausgeflogen ist (E-105). Am iPad, R = 112, Kasten 62 x 34,
     * scharf x1,10:
     *
     *    sieben 22,5 px Luft   (iPhone mini quer: 26,7)
     *    acht   14,1 px         (18,3)
     *    neun    6,9 px         (11,1)
     *    zehn    0,7 px         ( 4,9)  -> unter der Schranke
     *    elf    -4,5 px         (-0,3)  -> Ueberlappung
     *
     * Zwei Plaetze sind also frei: Der Kranz vertruege einen achten und einen
     * neunten Eintrag, ohne dass sich etwas beruehrt. Was dort hineinkommt,
     * entscheidet Patrick — dieser Test fuellt die Plaetze nicht, er haelt sie
     * nur offen. Wer einen ZEHNTEN will, aendert nicht diese Zahl, sondern die
     * Gliederung: ein Eintrag wandert ins Menue, oder der Kranz bekommt zwei
     * Ringe.
     */
    const ipad = FASSUNGEN[0];
    const { w, h } = sektorMass(ipad);
    const s = skala(ipad);
    const sieben = engste(7, r, w, h, s);
    const acht = engste(8, r, w, h, s);
    const neun = engste(9, r, w, h, s);
    const zehn = engste(10, r, w, h, s);
    expect(sieben, `sieben Eintraege haben ${sieben.toFixed(1)} px Luft`).toBeGreaterThanOrEqual(
      MIN_LUFT
    );
    expect(acht, `der freie achte Platz haette nur ${acht.toFixed(1)} px`).toBeGreaterThanOrEqual(
      MIN_LUFT
    );
    expect(neun, `der freie neunte Platz haette nur ${neun.toFixed(1)} px`).toBeGreaterThanOrEqual(
      MIN_LUFT
    );
    expect(zehn, `zehn Eintraege haetten ${zehn.toFixed(1)} px Luft`).toBeLessThan(MIN_LUFT);
  });

  it("R = 112 waere fuer sieben Eintraege nicht noetig — die Zahl, die das belegt", () => {
    /*
     * Zur Frage "kann RADIAL_R jetzt enger ruecken?" (Auftrag 17.09.2026).
     * Rechnerisch ja: Mit sieben Eintraegen reicht R = 91, um die
     * 6-px-Schranke in allen drei Fassungen zu halten — mit acht waren es 101.
     *
     * GEMACHT WIRD ES NICHT, und das ist keine Bequemlichkeit. Der Halbmesser
     * ist reine Ansicht: Gewaehlt wird ueber die RICHTUNG des Daumenzugs,
     * nicht ueber die Entfernung. Wie weit der Kranz den Daumen umgibt, ist
     * eine Gestaltungsfrage — und die entscheidet Patrick. Dazu haelt 112 zwei
     * Plaetze offen, und der Kranz hat in zwei Tagen zweimal einen Eintrag
     * verloren und wiederbekommen.
     *
     * Der Test haelt die Herleitung fest, damit die Zahl 91 nicht beim
     * naechsten Mal wieder geschaetzt werden muss.
     */
    const ipad = FASSUNGEN[0];
    const { w, h } = sektorMass(ipad);
    const s = skala(ipad);
    const kleinsterFuer = (n: number): number => {
      for (let rr = 40; rr <= r; rr++) {
        const eng = Math.min(
          ...FASSUNGEN.map((f) => {
            const m = sektorMass(f);
            return engste(n, rr, m.w, m.h, skala(f));
          })
        );
        if (eng >= MIN_LUFT) return rr;
      }
      return 0;
    };
    const fuerSieben = kleinsterFuer(7);
    expect(fuerSieben, "kein Halbmesser unter 112 haelt sieben Eintraege auseinander").toBeGreaterThan(0);
    expect(fuerSieben, `rechnerisches Minimum fuer sieben liegt bei R = ${fuerSieben}`).toBe(91);
    expect(kleinsterFuer(8), "das Minimum fuer acht Eintraege hat sich verschoben").toBe(101);
    expect(r, "RADIAL_R steht nicht mehr auf 112 — dann gehoert E-105 fortgeschrieben").toBe(112);
    // Und der gewaehlte Halbmesser hat mehr Luft als das Minimum, nicht weniger
    expect(engste(7, r, w, h, s)).toBeGreaterThan(MIN_LUFT);
  });

  it("GEGENPROBE: die Masse von gestern wuerden gemeldet", () => {
    /*
     * R = 104, Kasten 76 x 30 als INHALT (also 80 x 34 sichtbar), scharf
     * x1,15 — der Stand bis zum 16.09.2026. Schon mit ACHT Eintraegen faellt
     * er durch: -6,1 px, die Kaesten ueberlappten sich. Genau darum ist der
     * Rueckweg auf acht Eintraege KEIN Rueckweg auf die alte Geometrie.
     * Ohne diese Gegenprobe koennte die Rechnung oben stillschweigend immer
     * gruen sein.
     */
    expect(engste(8, 104, 80, 34, 1.15), "die alten Masse fallen nicht auf").toBeLessThan(0);
    expect(engste(9, 104, 80, 34, 1.15)).toBeLessThan(0);
    // Auch mit nur sieben Eintraegen: die alte Geometrie war schon damals eng.
    expect(engste(7, 104, 80, 34, 1.15)).toBeLessThan(MIN_LUFT);
  });

  it("GEGENPROBE: ein zu kleiner Halbmesser wird gemeldet", () => {
    /*
     * Zu den Zahlen 91 und 101 oben. Einen Punkt darunter reicht es NICHT
     * mehr — faellt das hier nicht auf, misst die Suche nach dem kleinsten
     * Halbmesser nichts. Geprueft wird ueber alle drei Fassungen, so wie die
     * Suche selbst.
     */
    const engsteAlle = (n: number, rr: number): number =>
      Math.min(
        ...FASSUNGEN.map((f) => {
          const m = sektorMass(f);
          return engste(n, rr, m.w, m.h, skala(f));
        })
      );
    expect(engsteAlle(7, 90), "R = 90 faellt bei sieben nicht auf").toBeLessThan(MIN_LUFT);
    expect(engsteAlle(7, 91), "R = 91 sollte bei sieben gerade reichen").toBeGreaterThanOrEqual(
      MIN_LUFT
    );
    expect(engsteAlle(8, 100), "R = 100 faellt bei acht nicht auf").toBeLessThan(MIN_LUFT);
    expect(engsteAlle(8, 101), "R = 101 sollte bei acht gerade reichen").toBeGreaterThanOrEqual(
      MIN_LUFT
    );
  });

  it("GEGENPROBE: ein groesserer Kasten faellt durch", () => {
    /*
     * HOEHER, nicht nur breiter — und das ist der eigentliche Befund dieser
     * Gegenprobe. Bis zum 16.09.2026 stand hier `w + 12`, und bei ACHT
     * Eintraegen hat das gereicht. Bei SIEBEN stehen die Kaesten 51,4 Grad
     * auseinander statt 45; die engste Stelle liegt dann nicht mehr zwischen
     * zwei seitlichen Nachbarn, sondern zwischen zwei uebereinander. Gemessen:
     * 12 px breiter laesst 9,9 px Luft, 24 px breiter genau dieselben 6,5 px —
     * die Breite ist nicht mehr massgeblich, und eine Gegenprobe, die nur an
     * der Breite dreht, meldete nichts mehr.
     */
    const ipad = FASSUNGEN[0];
    const { w, h } = sektorMass(ipad);
    const s = skala(ipad);
    expect(
      engste(labels.length, r, w + 24, h + 8, s),
      "24 px breiter und 8 px hoeher faellt nicht auf — dann misst der Test nichts"
    ).toBeLessThan(MIN_LUFT);
  });

  it("und der Kranz passt aufs Bild, wenn der Daumen mittig aufsetzt", () => {
    /*
     * Der Kranz erscheint dort, wo der Daumen liegt, und wird NICHT an den
     * Bildrand gerueckt. Setzt der Daumen ganz unten auf, haengt der unterste
     * Eintrag unter dem Bildrand — lesen kann man ihn dann nicht mehr (waehlen
     * schon, die Richtung stimmt trotzdem).
     *
     * Gemessen wird deshalb das BAND in der rechten Bildhaelfte, in dem ein
     * Daumen einen vollstaendig sichtbaren Kranz erzeugt. Es muss ein Band
     * geben; wie breit es ist, steht in der Meldung und im Log.
     */
    for (const f of FASSUNGEN) {
      const { w, h } = sektorMass(f);
      const s = skala(f);
      const hoch = r + (h * s) / 2;
      const breit = r + (w * s) / 2;
      const bandH = f.h - f.sa.t - f.sa.b - 2 * hoch;
      /*
       * Die rechte Zone ist seit E-136 35 % der Bildbreite (`#touch .zone:
       * width 35%`, davor 50 %; dazwischen liegt der Kamera-Mittelstreifen),
       * der Daumen setzt also zwischen 0,65 w und dem rechten sicheren Rand auf.
       * Telefon hochkant: 40 % (Regel `max-width: 500px and min-height: 431px`), ab 0,6 w.
       * Sichtbar bleibt der Kranz, wo auch links noch Platz ist.
       */
      const bandB = f.w - f.sa.r - breit - Math.max(f.w * (f.h > f.w ? 0.6 : 0.65), f.sa.l + breit);
      expect(
        bandH,
        `${f.name}: kein Streifen, in dem der Kranz ganz sichtbar ist ` +
          `(Ring ${hoch.toFixed(0)} px hoch ueber/unter dem Daumen, Bild ${f.h} px)`
      ).toBeGreaterThan(0);
      expect(bandB, `${f.name}: der Kranz passt in keiner Daumenlage in die Breite`).toBeGreaterThan(0);
    }
  });
});
