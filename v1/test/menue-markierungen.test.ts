import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { css, seite, wurzel } from "./cssmass";

/*
 * Die Zonenmarkierungen im Pausenmenue — und ob der Knopf dort etwas tut.
 *
 * Der Anlass (E-093). Patrick am Geraet, 16.09.2026: „Nimm Schild
 * (Markierungen) aus dem Menue raus, das kann ueber Hauptmenue geloest
 * werden." Gemeint war der Kranzeintrag SCHILDER (`btn-marks`, Taste M), die
 * Zonenmarkierungen — NICHT das Raeumschild SCHILD (`btn-blade`, Taste I).
 *
 * Bewacht wird die Fehlerklasse aus `tastenerreichbarkeit.test.ts`: zwei Wege
 * fuer dieselbe Sache, und nur einer ist verdrahtet. Beim Umzug ins Menue
 * kommt ein dritter Weg dazu — der Klick auf den Knopf im Pausenfeld. Der
 * versteckte Span in `#menu-actions` traegt nur noch den Tastencode; wer nur
 * ihn prueft, sieht einen gruenen Test und einen toten Knopf.
 *
 * Und: Der Zustand wird an EINER Stelle beschrieben. Der Kranz zeigt „ist an"
 * mit einem gelben Balken am unteren Rand (E-088). Der Menueknopf muss
 * dieselbe Regel benutzen, nicht eine zweite eigene.
 */

const main = readFileSync(resolve(wurzel, "src/main.ts"), "utf8");
const touchTs = readFileSync(resolve(wurzel, "src/core/touch.ts"), "utf8");

/** Der Knopf im Pausenfeld, wie er auf der Seite steht. */
const KNOPF = "pause-markierungen";

describe("Zonenmarkierungen sitzen im Pausenmenue und sind dort bedienbar", () => {
  it("der Knopf steht im Pausenfeld, nicht irgendwo", () => {
    const panel = seite.slice(seite.indexOf('<div id="pause">'), seite.indexOf('<div id="controls-menu">'));
    expect(panel.includes(`id="${KNOPF}"`), `${KNOPF} steht nicht im Pausenfeld`).toBe(true);
  });

  it("seine Beschriftung sagt, worum es geht — und wie man es schaltet", () => {
    const m = new RegExp(`<button id="${KNOPF}">([^<]+)</button>`).exec(seite);
    expect(m, `${KNOPF} ist kein <button> mit Text`).toBeTruthy();
    const text = (m?.[1] ?? "").trim();
    /*
     * „Markierungen" ist das Wort, das auch die Meldung im Spiel benutzt
     * („Markierungen an"). Stuende am Knopf ein anderes Wort als in der
     * Meldung, suchte man zwei Dinge statt eines.
     */
    expect(text, `Knopftext "${text}" nennt die Markierungen nicht`).toMatch(/[Mm]arkierungen/);
    // P4b (Auftrag 41f): keine Meldung mehr — der Knopf zeigt den Zustand (Balken `.an`), die Schilder verschwinden sichtbar
    expect(main, "der Knopf zeigt seinen Zustand nicht mehr").toContain('markKnopf.classList.toggle("an", an)');
    /*
     * Lesbar bleiben: Im Querformat des iPhone mini steht das Pausenfeld
     * zweispaltig, und die Spaltenbreite richtet sich nach dem laengsten Knopf
     * — heute „Greifer → Fünfschalengreifer" mit 28 Zeichen. Wer laenger
     * beschriftet, zieht das ganze Feld breiter. 30 Zeichen ist die Schranke:
     * der laengste vorhandene Knopf plus zwei, nicht mehr.
     */
    const knoepfe = [...seite.matchAll(/<button id="pause-[\w-]+">([^<]+)<\/button>/g)].map(
      (b) => b[1].trim()
    );
    const laengster = knoepfe.reduce((a, b) => (a.length >= b.length ? a : b));
    expect(laengster.length, `"${laengster}" sprengt die Schranke`).toBeLessThanOrEqual(30);
    expect(text.length, `Knopftext "${text}" ist zu lang fuers Telefon`).toBeLessThanOrEqual(30);
    expect(
      text.length,
      `"${text}" ist laenger als der bisher laengste Knopf "${laengster}" — ` +
        "das Pausenfeld wuerde im Querformat breiter"
    ).toBeLessThanOrEqual(laengster.length);
  });

  it("main.ts haengt einen Klick daran — sonst ist es ein toter Knopf", () => {
    expect(
      main.includes(`getElementById("${KNOPF}")`),
      `main.ts holt ${KNOPF} nie — der Knopf tut nichts`
    ).toBe(true);
    expect(
      /markKnopf\.addEventListener\("click"/.test(main),
      "kein Klickhandler am Markierungsknopf"
    ).toBe(true);
  });

  it("Taste und Knopf schalten dieselbe Zeile", () => {
    /*
     * Zwei Kopien derselben Umschaltung liefen frueher oder spaeter
     * auseinander — dann zeigte der Knopf „an", waehrend die Schilder aus
     * waren. Beide Wege rufen `schalteMarkierungen`.
     */
    expect(main).toContain("const schalteMarkierungen");
    expect(
      /input\.wasPressed\("KeyM"\)[^\n]*schalteMarkierungen\(\)/.test(main),
      "Taste M ruft nicht dieselbe Umschaltung wie der Knopf"
    ).toBe(true);
    expect(main).toContain('markKnopf.addEventListener("click", schalteMarkierungen)');
    // Und es gibt genau EINE Stelle, die die Schilder sichtbar macht.
    const stellen = [...main.matchAll(/containers\.setLabelsVisible\(/g)].length;
    expect(stellen, "setLabelsVisible steht an mehr als einer Stelle").toBe(1);
  });

  it("der Zustand steht am Knopf, und zwar gleich beim ersten Oeffnen", () => {
    expect(
      /markKnopf\.classList\.toggle\("an"/.test(main),
      "der Knopf bekommt nie die Klasse `an` — man sieht nicht, ob die Schilder an sind"
    ).toBe(true);
    expect(
      main.includes("zeigeMarkierungen(labelsOn)"),
      "der Anfangszustand wird nie an den Knopf geschrieben"
    ).toBe(true);
  });

  it('„ist an" wird EINMAL beschrieben — Kranz und Menue teilen die Regel', () => {
    /*
     * Zwei getrennte Regeln waeren zwei Bildsprachen fuer dieselbe Auskunft.
     * Gesucht wird darum die gemeinsame Regel, nicht zweimal dieselbe Farbe.
     */
    const balken = /([^{}]*)\{\s*content:\s*""[^}]*height:\s*4px[^}]*\}/g;
    const treffer = [...css.matchAll(balken)].map((m) => m[1].trim());
    const gemeinsam = treffer.filter(
      (sel) => sel.includes("#radial .sektor.an::after") && sel.includes("#pause button.an::after")
    );
    expect(
      gemeinsam.length,
      `keine gemeinsame Balkenregel gefunden; gefunden wurde: ${treffer.join(" | ")}`
    ).toBe(1);
  });

  it("Farbe ist nicht der einzige Kanal", () => {
    /*
     * Briefing Kap. 20. Der Balken ist eine FORM, die da ist oder nicht — er
     * wirkt auch, wenn man Gelb nicht von Grau unterscheidet. Deshalb muss er
     * eine Hoehe haben, nicht nur eine Farbe.
     */
    const m = /#radial \.sektor\.an::after,\s*#pause button\.an::after\s*\{([^}]*)\}/.exec(css);
    expect(m, "die Balkenregel steht nicht mehr da").toBeTruthy();
    expect(m?.[1], "der Balken hat keine Hoehe — dann bleibt nur die Farbe").toMatch(/height:\s*4px/);
    expect(m?.[1], "der Balken steht nicht am Rand des Kastens").toMatch(/position:\s*absolute/);
  });

  it("der Balken braucht einen Traeger: #pause button steht auf position: relative", () => {
    /*
     * Ohne das haengt der Balken am naechsten positionierten Vorfahren — beim
     * Pausenfeld also unten am Panel statt am Knopf. Sichtbar waere er
     * trotzdem, nur an der falschen Stelle; genau so ein Fehler faellt im
     * Test nie auf, wenn man ihn nicht benennt.
     */
    /*
     * ALLE Regeln zu `#pause button` einsammeln, nicht die erstbeste: Die
     * erste im Quelltext steht in der Medienabfrage fuers Querformat und
     * setzt nur Rand und Schriftgroesse. Wer dort nachsieht, misst nichts.
     */
    const regeln = [...css.matchAll(/(?:^|\})\s*#pause button\s*\{([^}]*)\}/g)].map((m) => m[1]);
    expect(regeln.length, "#pause button hat keine eigene Regel mehr").toBeGreaterThan(0);
    expect(
      regeln.some((d) => /position:\s*relative/.test(d)),
      `keine der ${regeln.length} Regeln setzt position: relative — der Balken haengt am Panel`
    ).toBe(true);
    // und keine spaetere Regel stellt es wieder auf statisch
    expect(regeln.some((d) => /position:\s*static/.test(d)), "position wird wieder aufgehoben").toBe(
      false
    );
  });

  it("Taste M bleibt gebunden, und SCHILDER steht im Menueblock", () => {
    expect(touchTs).toContain('bindTap("btn-marks", "KeyM")');
    const menue = seite.slice(seite.indexOf('<div class="hidden-actions" id="menu-actions">'));
    expect(menue.slice(0, menue.indexOf("</div>"))).toContain('id="btn-marks"');
  });

  /* ------------------------------------------------ Gegenproben ----------- */

  it("GEGENPROBE: ein Knopf ohne Klickhandler wuerde gemeldet", () => {
    const kaputt = main.replace('markKnopf.addEventListener("click", schalteMarkierungen)', "");
    expect(kaputt, "die Gegenprobe hat nichts veraendert").not.toBe(main);
    expect(
      /markKnopf\.addEventListener\("click"/.test(kaputt),
      "die Pruefung wuerde den toten Knopf nicht bemerken"
    ).toBe(false);
  });

  it("GEGENPROBE: eine zweite, eigene Zustandsdarstellung wuerde gemeldet", () => {
    const kaputt = css.replace(", #pause button.an::after", "");
    expect(kaputt, "die Gegenprobe hat nichts veraendert").not.toBe(css);
    const balken = /([^{}]*)\{\s*content:\s*""[^}]*height:\s*4px[^}]*\}/g;
    const gemeinsam = [...kaputt.matchAll(balken)]
      .map((m) => m[1])
      .filter((sel) => sel.includes("#radial") && sel.includes("#pause"));
    expect(gemeinsam.length, "die Pruefung merkt nicht, dass die Regel auseinanderfaellt").toBe(0);
  });

  it("GEGENPROBE: ein Balken ohne Traeger wuerde gemeldet", () => {
    /*
     * Ohne `position: relative` am Knopf faellt der Balken an das Pausenfeld
     * — sichtbar, aber an der falschen Stelle. Dieser Fehler faellt am
     * Bildschirm kaum auf; hier muss er auffallen.
     */
    const kaputt = css.replace("display: block; position: relative;", "display: block;");
    expect(kaputt, "die Gegenprobe hat nichts veraendert").not.toBe(css);
    const regeln = [...kaputt.matchAll(/(?:^|\})\s*#pause button\s*\{([^}]*)\}/g)].map((m) => m[1]);
    expect(
      regeln.some((d) => /position:\s*relative/.test(d)),
      "die Pruefung merkt den fehlenden Traeger nicht"
    ).toBe(false);
  });

  it("GEGENPROBE: ein verlorener Anfangszustand wuerde gemeldet", () => {
    const kaputt = main.replace("zeigeMarkierungen(labelsOn);", "");
    expect(kaputt, "die Gegenprobe hat nichts veraendert").not.toBe(main);
    expect(kaputt.includes("zeigeMarkierungen(labelsOn)"), "die Pruefung greift nicht").toBe(false);
  });
});
