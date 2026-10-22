import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fahrachse } from "../src/core/touch";
import { FUNCTION_LABELS, AXIS_LABELS, defaultConfig } from "../src/core/controlConfig";
import { FASSUNGEN, pedalKasten, px } from "./cssmass";

/*
 * Gefahren wird mit dem linken Stick, eingeschaltet mit zwei Pedalen unten
 * mittig (Ansage Patrick 14.09.2026: "zwei Pedale nebeneinander
 * unten Mitte", Nachtrag: "die beiden Pedale sind nur visuell", nach dem
 * Geraetetest: "Pedale links unten anordnen, sonst verdeckt er zu viel Sicht";
 * Befund 22.10.2026, 40e: "Pedale in die Mitte — sie werden beim Baggern
 * versehentlich getroffen"). Lage und Abstaende: test/pedalmitte.test.ts.
 *
 * Diese Datei hiess bis heute fahrflaeche.test.ts und bewachte den Vorgaenger:
 * eine eigene Fahrflaeche unten links mit einem dritten schwebenden Stick.
 * Patrick hat sie auf dem iPad abgelehnt. Der Vorgaenger davor war ein
 * Fahrmodus per Doppeltipp, der nach vier Sekunden von selbst zurueckfiel.
 * Bewacht wird jetzt die dritte Loesung — und ausdruecklich das, woran die
 * beiden ersten gescheitert sind: ein Zustand, der sich von allein aendert,
 * und ein Zustand, den man nicht sieht.
 *
 * TouchControls selbst braucht ein Browser-Dokument und laesst sich hier nicht
 * bauen. Darum werden Quelle und Seite gelesen, wie es
 * test/upgradeEffects.test.ts fuer die Ausbaustufen tut.
 */

const wurzel = resolve(__dirname, "..");
const touchQuelle = readFileSync(resolve(wurzel, "src/core/touch.ts"), "utf8");
const seite = readFileSync(resolve(wurzel, "index.html"), "utf8");
/**
 * Dieselbe Seite ohne Kommentare — nur das, was der Spieler wirklich lesen
 * kann. Warum die alten Loesungen weg sind, steht als Kommentar im Dokument und
 * darf die Suche nach alten Hilfetexten nicht stoeren.
 */
const sichtbar = seite.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Zahl hinter einer CSS-Eigenschaft in einem Regelblock herausziehen.
 *
 * GEAENDERT am 15.09.2026 (E-032): Die Abstaende stehen seither als
 * `max(8px, calc(var(--sa-l) + 8px))` da — sichere Raender fuer Notch und
 * Home-Indicator. Hier interessiert der GRUNDABSTAND, also das erste
 * Pixelmass im Ausdruck; das ist zugleich der Wert, den ein Geraet ohne Notch
 * (das iPad) wirklich bekommt. Dass auf dem iPhone nichts in den Rand ragt,
 * prueft `test/sichererand.test.ts` mit den echten Randbreiten.
 *
 * Wichtig: Es wird weiter geworfen, wenn gar nichts dasteht. Ein Waechter, der
 * bei fehlender Angabe stillschweigend NaN weiterreicht, ist gruen und wertlos.
 */
function css(block: string, eigenschaft: string): number {
  const m = new RegExp(`(?:^|[;{\\s])${eigenschaft}:\\s*([^;]+)`).exec(block);
  expect(m, `${eigenschaft} fehlt`).not.toBeNull();
  const zahl = /(\d+)px/.exec(m![1]);
  expect(zahl, `${eigenschaft} ohne Pixelmass: ${m![1]}`).not.toBeNull();
  return Number(zahl![1]);
}

/** Alle Regelbloecke zu einem Selektor, in der Reihenfolge des Dokuments. */
function bloecke(selektor: string): string[] {
  const esc = selektor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...seite.matchAll(new RegExp(`${esc}\\s*\\{([^}]*)\\}`, "g"))].map((m) => m[1]);
}

describe("Fahrachse", () => {
  it("bleibt in der Totzone bei null", () => {
    // Daumen rollt beim Aufsetzen ein paar Pixel — das darf nicht anfahren
    expect(fahrachse(0)).toBe(0);
    expect(fahrachse(0.1)).toBe(0);
    expect(fahrachse(-0.14)).toBe(0);
  });

  it("gibt am Vollausschlag volles Gas, in beide Richtungen", () => {
    expect(fahrachse(1)).toBeCloseTo(1, 6);
    expect(fahrachse(-1)).toBeCloseTo(-1, 6);
    // Ueber den Rand gezogen bleibt es bei eins
    expect(fahrachse(1.4)).toBeCloseTo(1, 6);
  });

  it("spreizt den Rest wieder auf den vollen Bereich", () => {
    // Ohne Spreizen begaenne das Fahren mit einem Ruck bei 0,15
    const knapp = fahrachse(0.16);
    expect(knapp).toBeGreaterThan(0);
    expect(knapp).toBeLessThan(0.05);
    // Mitte zwischen Totzone und Vollausschlag ergibt gut halbes Gas
    expect(fahrachse(0.575)).toBeCloseTo(0.5, 2);
  });

  it("steigt durchgehend an", () => {
    let vorher = -1;
    for (let v = 0; v <= 1.0001; v += 0.05) {
      const jetzt = fahrachse(v);
      expect(jetzt).toBeGreaterThanOrEqual(vorher);
      vorher = jetzt;
    }
  });
});

describe("Zwei Pedale statt Fahrflaeche", () => {
  it("hat zwei Pedale unten mittig", () => {
    // Zwei, nebeneinander — so bestellt. Ein einzelnes Pedal saehe aus wie ein
    // Knopf; zwei sehen aus wie eine Maschine.
    expect(seite).toContain('id="pedals"');
    expect(seite).toContain('id="pedal-l"');
    expect(seite).toContain('id="pedal-r"');
    const halter = bloecke("#pedals")[0] ?? "";
    /*
     * GEAENDERT am 22.10.2026. Bis dahin verlangte der Test "unten links"
     * (Patrick 14.09.2026: "Pedale links unten anordnen, sonst verdeckt er zu
     * viel Sicht"). Am 22.10.2026 hat er die Mitte bestellt: Unten links lagen
     * sie unter dem linken Stick-Daumen und wurden beim Baggern getroffen.
     * Gegen die Sicht: kleiner als vorher (pedalmitte.test.ts).
     */
    expect(halter).toContain("left: 50%");
    expect(halter).toContain("translateX(-50%)");
    expect(halter).toContain("bottom:");
  });

  // "bleibt mit allem in der linken Bildhaelfte" ist am 22.10.2026 nach
  // test/pedalmitte.test.ts gewandert: Dort steht jetzt "im Mittelstreifen,
  // fern von beiden Stick-Zonen".

  it("hat die Fahrflaeche von heute frueh restlos abgeraeumt", () => {
    // Zone, Stick, CSS und Aufschrift der abgelehnten Flaeche unten links
    for (const rest of ["zone-drive", "touch-drive", "FAHREN", "Gas ↕"]) {
      expect(seite.includes(rest), `${rest} haengt noch in index.html`).toBe(false);
    }
    // Der dritte Stick hatte in makeStick eine eigene Rolle. Uebrig sind zwei.
    // ("fahren" allein taugt nicht als Suchwort: So heisst jetzt die
    // CSS-Klasse, an der die Pedale leuchten.)
    expect(touchQuelle).toContain('rolle: "links" | "rechts"');
    expect(touchQuelle).not.toContain('"links" | "rechts" | "fahren"');
    expect(touchQuelle).not.toContain("drivePad");
  });

  it("kennt keinen Zeitablauf, der von selbst zurueckschaltet", () => {
    // Der Kern des ersten Fehlschlags: Nach vier Sekunden ohne Daumen fiel der
    // Fahrmodus von allein zurueck. Weder Uhr noch Timer duerfen wieder
    // auftauchen — der Modus endet nur, wenn der Spieler ihn beendet.
    for (const rest of ["driveIdleS", "DRIVE_AUTO_EXIT_S", "setTimeout", "setInterval"]) {
      expect(touchQuelle.includes(rest), `${rest} haengt noch in touch.ts`).toBe(false);
    }
  });

  it("schaltet nur auf einen Tipp aufs Pedal um", () => {
    // Umgeschaltet wird an genau einer Stelle, und die haengt am Pedal.
    expect(touchQuelle).toContain('ziel?.closest(".pedal")');
    expect(touchQuelle).toContain("this.setFahren(!this.fahrenAn)");
    const schalter = [...touchQuelle.matchAll(/this\.setFahren\(/g)];
    expect(schalter).toHaveLength(1);
  });

  it("laesst den Zustand stehen, wenn der Browser die Finger verschluckt", () => {
    // Geister-Zeiger-Sicherung: releaseAll laesst beide Sticks los. Sie darf
    // das Fahren nicht mit ausschalten — ein App-Wechsel ist kein Tipp.
    const koerper = /releaseAll\(\): void \{([\s\S]*?)\n  \}/.exec(touchQuelle)?.[1] ?? "";
    expect(koerper, "releaseAll nicht gefunden").not.toBe("");
    expect(koerper).not.toContain("fahrenAn");
    expect(koerper).toContain("resetStick");
  });

  it("gibt beim Umschalten den linken Stick frei", () => {
    // Sonst stuende ein liegender Daumen im naechsten Bild als Vollgas da.
    const koerper = /setFahren\(an: boolean\): void \{([\s\S]*?)\n  \}/.exec(touchQuelle)?.[1] ?? "";
    expect(koerper, "setFahren nicht gefunden").not.toBe("");
    expect(koerper).toContain("resetStick(this.left)");
    expect(koerper).toContain("this.axes.drive = 0");
    expect(koerper).toContain("this.axes.steer = 0");
  });

  it("legt beim Fahren nur die beiden linken Achsen still", () => {
    // Der linke Stick behaelt seine Belegung, er pausiert sie nur. Ausgeschaltet
    // fuehrt er sofort wieder Hauptarm und Oberwagen.
    expect(touchQuelle).toContain(
      'if (this.fahrenAn && (id === "leftX" || id === "leftY")) continue;'
    );
    expect(touchQuelle).toContain("const faehrt = this.fahrenAn && l !== null;");
    expect(touchQuelle).toContain("this.axes.drive = faehrt ? clamp1(fahrachse(-l.dy)) : 0;");
    expect(touchQuelle).toContain("this.axes.steer = faehrt ? clamp1(fahrachse(l.dx)) : 0;");
  });

  it("verspricht in keinem Hilfetext mehr einen Doppeltipp oder ein Feld zum Fahren", () => {
    expect(sichtbar).not.toContain("Doppeltipp links");
    expect(sichtbar).not.toMatch(/Feld unten links/);
    // Dafuer steht ueberall dasselbe: Pedale antippen, dann faehrt der Stick.
    // Die Lage muss mitwandern — ein Hilfetext, der nach links zeigt,
    // schickt den Spieler an die falsche Stelle (seit 22.10.2026 Mitte).
    expect(sichtbar).toMatch(/Pedale unten Mitte/);
    expect(sichtbar).not.toMatch(/Pedale unten links/);
  });

  it("laesst den Doppeltipp fuer die Ansicht unangetastet", () => {
    expect(touchQuelle).toContain('this.pressed.add("KeyC")');
    expect(sichtbar).toContain("Doppeltipp rechts: Ansicht");
  });

  it("gibt Gas und Lenken keine Zeile im Steuerungsmenue", () => {
    // Waeren sie belegbar, koennte man sich das Fahren wegstellen — und die
    // Pedale taeten dann nichts. Es bleibt bei vier Achsen.
    expect(Object.keys(AXIS_LABELS)).toEqual(["leftY", "leftX", "rightY", "rightX"]);
    expect(Object.keys(FUNCTION_LABELS)).not.toContain("drive");
    expect(Object.keys(FUNCTION_LABELS)).not.toContain("steer");
    expect(Object.keys(defaultConfig())).toHaveLength(4);
  });
});

describe("Der Zustand ist ohne Text ablesbar", () => {
  /** Den Markup-Block der Pedale ausschneiden, Klammer fuer Klammer. */
  function pedalBlock(): string {
    const start = seite.indexOf('<div id="pedals"');
    expect(start, "Pedal-Markup fehlt").toBeGreaterThan(0);
    let tiefe = 0;
    const re = /<(\/?)div\b[^>]*>/g;
    re.lastIndex = start;
    for (let m = re.exec(seite); m; m = re.exec(seite)) {
      tiefe += m[1] ? -1 : 1;
      if (tiefe === 0) return seite.slice(start, m.index + m[0].length);
    }
    throw new Error("Pedal-Markup nicht geschlossen");
  }

  it("traegt kein Wort auf den Pedalen", () => {
    // Die abgelehnte Fahrflaeche schrieb "FAHREN" ins Bild. Der Zustand soll
    // diesmal an der Form haengen, nicht an einer Beschriftung, die man beim
    // Arbeiten ohnehin nicht liest.
    const ohneTags = pedalBlock().replace(/<[^>]*>/g, "");
    expect(ohneTags.trim()).toBe("");
  });

  it("nennt sich trotzdem fuer Vorlesesoftware", () => {
    // Kein Text im Bild heisst nicht: kein Text fuer den, der nicht hinsieht.
    expect(pedalBlock()).toContain('aria-label="Fahren ein- und ausschalten"');
  });

  it("aendert eingeschaltet Farbe UND Form", () => {
    // Farbe ist nie der einzige Kanal (Briefing Kap. 20): Das Pedal leuchtet,
    // und die Trittplatte rutscht nach unten — ein durchgetretenes Pedal.
    const pedal = bloecke("#touch.fahren .pedal")[0] ?? "";
    expect(pedal, "Leuchtzustand fehlt").toContain("background:");
    expect(pedal).toContain("border-color:");
    const platte = bloecke("#touch.fahren .pedal .platte")[0] ?? "";
    expect(platte, "Plattenweg fehlt").toMatch(/transform:\s*translateY\(\d+px\)/);
  });

  it("sagt es noch einmal am linken Stick selbst", () => {
    // Dort liegt der Daumen. Wer beim Fahren auf den Stick schaut, sieht den
    // warmen Rand, ohne in die Bildmitte blicken zu muessen.
    expect(bloecke("#touch.fahren #touch-left")[0] ?? "").toContain("border-color:");
  });

  it("zeigt die Pedale auch im ausgeschalteten Zustand", () => {
    // Wer sie sucht, muss sie finden: kein hidden, kein display:none, keine
    // Sichtbarkeit erst ab Fahrmodus.
    const grund = bloecke("#touch .pedal")[0] ?? "";
    expect(grund, "Grundzustand fehlt").not.toContain("display: none");
    expect(grund).not.toContain("opacity: 0");
    const tag = /<div id="pedals"[^>]*>/.exec(seite);
    expect(tag, "Pedal-Halter fehlt").not.toBeNull();
    expect(tag![0]).not.toContain("hidden");
  });
});

describe("Platz auf dem Glas", () => {
  const tabletPedal = bloecke("#touch .pedal")[0] ?? "";
  const handyPedal = bloecke("#touch .pedal")[1] ?? "";
  const tabletHalter = bloecke("#pedals")[0] ?? "";
  const handyHalter = bloecke("#pedals")[1] ?? "";

  it("haelt in beiden Layouts die 44 px fuer Tippziele ein", () => {
    // Briefing Kap. 20. Gemessen wird in beide Richtungen, nicht nur in einer.
    // box-sizing: border-box, damit width/height hier das Sichtbare meinen.
    expect(tabletPedal).toContain("box-sizing: border-box");
    for (const [name, block] of [
      ["iPad", tabletPedal],
      ["iPhone mini", handyPedal],
    ] as const) {
      expect(css(block, "width"), `${name} zu schmal`).toBeGreaterThanOrEqual(44);
      expect(css(block, "height"), `${name} zu flach`).toBeGreaterThanOrEqual(44);
    }
  });

  it("laesst Luft zwischen den Pedalen", () => {
    // Damit der Daumen nicht zwischen beide faellt. Zwoelf Pixel sind die
    // Untergrenze, unter der zwei Ziele optisch zu einem verschmelzen.
    expect(css(tabletHalter, "gap")).toBeGreaterThanOrEqual(12);
    expect(css(handyHalter, "gap")).toBeGreaterThanOrEqual(12);
  });

  it("laesst den unteren HUD-Zeilen einen Streifen neben oder ueber den Pedalen", () => {
    /*
     * GEAENDERT am 15.09.2026. Vorher hiess der Test "schiebt Griff-Info und
     * Ladeanzeige ueber die Pedale" und verlangte: Die Griff-Info muss
     * OBERHALB der Pedaloberkante beginnen (118 px auf dem Tablet, 90 px in
     * der flachen Fassung) — denn beide Zeilen waren mittig zentriert, ohne
     * Breitengrenze, und reichten bei langem Text bis in die linke Ecke, in
     * der die Pedale stehen.
     *
     * Was davon weiter gilt und was nicht:
     *  - Weiter gilt: Eine lange Zeile darf die Pedale nicht erreichen. Das
     *    ist der Kern, und er wird hier weiter geprueft.
     *  - Nicht mehr gilt: dass "darueber" der einzige Weg dorthin ist. Die
     *    Zeilen stehen seit heute linksbuendig im freien Streifen und haben
     *    eine Breitengrenze; sie koennen die Pedale nicht mehr erreichen.
     *    "Darueber" schob statt dessen eine Textzeile mitten ins Bild — genau
     *    das hat Patrick am 15.09.2026 am iPhone mini beanstandet.
     *
     * Die Fassung um die Pedale zaehlt weiter doppelt mit (oben und unten);
     * vergisst man sie, fehlen genau die Pixel, die auf dem iPhone mini die
     * Anzeige aufs Pedal geschoben haben (Messung 14.09.2026).
     *
     * Wo der Block wirklich landet, rechnet test/greifanzeige.test.ts aus:
     * mit dem laengstmoeglichen Text und in allen DREI Fassungen — auch im
     * Hochformat, das hier nie geprueft wurde.
     */
    /*
     * GEAENDERT am 22.10.2026: Die Pedale stehen mittig (left 50 % +
     * translateX), das rechnet nur noch cssmass.ts — mit sicheren Raendern und
     * in allen drei Fassungen. Der Block muss links neben ODER ueber ihnen
     * enden.
     */
    for (const f of FASSUNGEN) {
      const p = pedalKasten(f);
      const hu = ["#hudunten", "body.touch #hudunten"];
      const rechts = f.w - px(hu, "right", f);
      const unten = px(hu, "bottom", f);
      expect(rechts <= p.x0 || unten >= p.y1, `${f.name}: Block liegt auf den Pedalen`).toBe(true);
    }
  });

  it("laesst dem flachen Layout noch Bild uebrig", () => {
    /*
     * iPhone mini quer ist 375 px hoch. Pedale und die beiden HUD-Zeilen
     * stapeln sich unten; zusammen duerfen sie nicht das halbe Bild fuellen,
     * sonst sieht man den Platz nicht mehr.
     *
     * GEAENDERT am 15.09.2026: Gemessen wird am Halter statt an der einzelnen
     * Ladeanzeige, weil beide Zeilen jetzt in einem Stapel stehen. Der
     * Zuschlag ist von 28 px (eine flache Textzeile) auf 100 px gewachsen —
     * so hoch wird der Stapel im schlimmsten Fall aus BEIDEN Zeilen zusammen.
     * Die Rechnung dazu steht in test/greifanzeige.test.ts.
     */
    const oben = css(bloecke("body.touch #hudunten")[2] ?? "", "bottom") + 100;
    expect(oben).toBeLessThan(375 / 2);
  });

  it("legt die Pedale ueber die Stickzonen, nicht darunter", () => {
    // Sonst faenge die Bildhaelfte den Tipp ab und der Stick spraenge an der
    // Bildmitte auf. Die Zonen liegen auf z-index 0.
    const z = /z-index:\s*(\d+)/.exec(tabletHalter);
    expect(z, "z-index fehlt").not.toBeNull();
    expect(Number(z![1])).toBeGreaterThan(0);
  });
});
