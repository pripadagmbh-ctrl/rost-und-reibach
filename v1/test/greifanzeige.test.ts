import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { griffLadung, griffZiel, type GriffStueck } from "../src/ui/hud";
import {
  FASSUNGEN,
  css,
  hudHoehe,
  knopfKasten,
  luft,
  pedalKasten,
  px,
  seite,
  ueberlappt,
  wert,
  wurzel,
  type Fassung,
  type Kasten,
} from "./cssmass";

/*
 * Waechter fuer den unteren HUD-Block (Griff-Info + Ladeanzeige).
 *
 * Anlass (Patrick, 15.09.2026, iPhone mini): "Bei iPhone Mini wird auch durch
 * die Greifanzeige, also was gegriffen worden ist, die Sicht verdeckt."
 *
 * Geprueft werden DREI Fassungen, und seit dem 15.09.2026 (E-032) mit den
 * sicheren Raendern des jeweiligen Geraets. Die Rechnung selbst steht in
 * `test/cssmass.ts`; sie nimmt Rahmen und Fassung ausdruecklich mit.
 */

/** Die Seite mit Kommentaren — fuer Suchen nach Markup. */
const dokument = seite;

// ---------------------------------------------------------------------------
// Die laengsten Texte, die das Spiel erzeugen kann
// ---------------------------------------------------------------------------

/*
 * Nicht geschaetzt, sondern aus den Quellen geholt: der laengste Stuecknamen
 * und die laengste Muldenaufschrift. Kommt ein laengerer dazu, faellt der Test
 * "die Annahmen ueber die laengsten Texte stimmen noch" weiter unten.
 */
const LANGER_NAME = "Unfallfahrzeug (Front eingedrückt)";
const LANGE_MULDE = "MISCHSCHROTT";

const stueck = (
  name: string,
  massKg: number,
  materialId = "mixed",
  composition?: Array<{ materialId: string; massKg: number }>
): GriffStueck => ({ materialId, massKg, shape: { name }, composition });

/** Die volle Spinne: drei benannte Brocken, mehrere Fraktionen, ein Rest. */
const schlimmsteLadung: GriffStueck[] = [
  // Groesster Anteil ist NICHT die eigene Fraktion — nur dann haengt
  // hauptMaterial() die lange Form "Mischschrott · 58 % Baumischabfall" an.
  stueck(LANGER_NAME, 900, "mixed", [
    { materialId: "mixed", massKg: 380 },
    { materialId: "rubble", massKg: 520 },
  ]),
  stueck("Wohnwagen-Kühlschrank (Absorber)", 120),
  stueck("U-Bahn-Drehgestell (angetrieben)", 400),
  stueck("Blech", 10, "steel"),
  stueck("Blech", 10, "va"),
  stueck("Draht", 10, "cable"),
  stueck("Rohr", 10, "brass"),
  stueck("Klotz", 10, "wood"),
];

const langeLadung = griffLadung(schlimmsteLadung, { container: LANGE_MULDE, ampel: "red" });
const langesZiel = griffZiel(
  stueck(LANGER_NAME, 1200, "mixed", [
    { materialId: "mixed", massKg: 500 },
    { materialId: "rubble", massKg: 700 },
  ])
);
/**
 * Der Alltag: ein ganz normales Stueck anvisiert, kein Abholer da.
 *
 * NEU am 15.09.2026 (E-032). Bis dahin wurde nur der schlimmste Fall geprueft
 * — und der ist selten. Was der Spieler stundenlang sieht, ist DIESE Zeile,
 * und sie hat einen eigenen, engeren Deckel verdient.
 */
const alltagsZiel = griffZiel(stueck("Kühlschrank", 84));
/** Laengste Ladeanzeige: Fraktionsname, Masse, Balken, Prozent (vgl. hud.ts). */
const LANGE_LADEZEILE = "Baumischabfall: 12.4 t · ██████████ 100 % sortenrein";

// ---------------------------------------------------------------------------
// Der untere Stapel als Kaesten
// ---------------------------------------------------------------------------

interface Stapel {
  griff: Kasten;
  ladung: Kasten | null;
  /** Oberkante des ganzen Blocks ueber der Bildunterkante; 0 = nichts im Bild. */
  oben: number;
}

const GRIP_SEL = ["#gripinfo", "#hudunten .hud", ".hud"];
const LOAD_SEL = ["#load", "#hudunten .hud", ".hud"];
const HALTER_SEL = ["#hudunten", "body.touch #hudunten"];

/**
 * Rechnet den unteren Stapel aus.
 *
 * `kopf === null` heisst Ruhezustand: Seit dem 15.09.2026 verschwindet die
 * Griff-Info ganz, wenn sie nichts zu sagen hat (Patrick: "Ich weiss nicht,
 * wofuer wir 'Greifer offen' ueberhaupt brauchen"). Dann steht dort nichts —
 * und das muss die Rechnung genauso sehen.
 */
function stapel(f: Fassung, kopf: string | null, liste: string, mitAbholer: boolean): Stapel {
  const links = px(HALTER_SEL, "left", f);
  const rechts = px(HALTER_SEL, "right", f);
  const unten = px(HALTER_SEL, "bottom", f);
  const luecke = px(HALTER_SEL, "gap", f);
  const breite = f.w - links - rechts;

  const g =
    kopf === null
      ? { hoehe: 0, zeilen: 0 }
      : hudHoehe(GRIP_SEL, f, breite, [
          { text: kopf },
          ...(liste ? [{ text: liste, eineZeile: true }] : []),
        ]);
  const l = mitAbholer
    ? hudHoehe(LOAD_SEL, f, breite, [{ text: LANGE_LADEZEILE }])
    : { hoehe: 0, zeilen: 0 };
  const zwischen = g.hoehe > 0 && l.hoehe > 0 ? luecke : 0;

  // Reihenfolge im Markup: Griff-Info oben, Ladeanzeige unten. Der Halter
  // haengt am unteren Rand — was unten steht, liegt fest.
  const ladung: Kasten | null =
    l.hoehe > 0
      ? { name: "Ladeanzeige", x0: links, x1: f.w - rechts, y0: unten, y1: unten + l.hoehe }
      : null;
  const griffUnten = unten + l.hoehe + zwischen;
  return {
    griff: {
      name: "Griff-Info",
      x0: links,
      x1: f.w - rechts,
      y0: griffUnten,
      y1: griffUnten + g.hoehe,
    },
    ladung,
    oben: g.hoehe + l.hoehe === 0 ? 0 : unten + g.hoehe + l.hoehe + zwischen,
  };
}

describe("Unterer HUD-Block: Griff-Info und Ladeanzeige", () => {
  it("die Annahmen ueber die laengsten Texte stimmen noch", () => {
    /*
     * Faellt dieser Test, ist ein laengerer Name oder eine laengere
     * Muldenaufschrift dazugekommen — dann ist die Platzrechnung weiter unten
     * mit dem falschen Wert gemacht und muss nachgezogen werden.
     */
    const quellen = [
      "src/world/objektkatalog.ts",
      "src/world/scrapItems.ts",
      "src/world/containers.ts",
      "src/world/yard.ts",
      "src/dismantle/carDef.ts",
    ]
      .map((p) => {
        try {
          return readFileSync(resolve(wurzel, p), "utf8");
        } catch {
          return "";
        }
      })
      .join("\n");
    const namen = [...quellen.matchAll(/name: "([^"]*)"/g)].map((m) => m[1]);
    const labels = [...quellen.matchAll(/label: "([^"]*)"/g)].map((m) => m[1]);
    for (const n of namen)
      expect(n.length, `laengerer Name: ${n}`).toBeLessThanOrEqual(LANGER_NAME.length);
    for (const l of labels)
      expect(l.length, `laengere Aufschrift: ${l}`).toBeLessThanOrEqual(LANGE_MULDE.length);
  });

  it("stapelt beide Zeilen, statt sie einzeln an den Rand zu haengen", () => {
    /*
     * Der eigentliche Fehler vom 14.09.2026: Jede Zeile hatte ihren eigenen
     * Abstand zum Bildrand (118 / 163 px). Wuchs die untere auf zwei Zeilen,
     * schob sie sich unter die obere. Im Stapel kann das nicht passieren —
     * darum wird hier die Bauform bewacht und nicht nur das Ergebnis.
     */
    const halter = ["#hudunten"];
    const iPad = FASSUNGEN[0];
    expect(wert(halter, "display", iPad)).toBe("flex");
    expect(wert(halter, "flex-direction", iPad)).toBe("column");
    expect(px(halter, "gap", iPad)).toBeGreaterThanOrEqual(4);
    // Und keine der beiden Zeilen haengt noch selbst am Rand.
    expect(css).not.toMatch(/body\.touch #gripinfo\s*\{/);
    expect(css).not.toMatch(/body\.touch #load\s*\{/);
  });

  it("stellt die veraenderliche Zeile nach oben und die ruhende nach unten", () => {
    /*
     * NEU am 15.09.2026 (E-032). Der Halter haengt am unteren Bildrand und
     * waechst nach oben: Was unten steht, liegt fest; was oben steht, darf
     * seine Hoehe aendern, ohne den Rest zu verschieben.
     *
     * Die Griff-Info wechselt mehrmals je Sekunde ihre Zeilenzahl und
     * verschwindet seit heute ganz, wenn sie nichts zu sagen hat. Stuende sie
     * unten, spraenge die Ladeanzeige bei jedem Griff auf und ab — genau das
     * Zappeln, das schlimmer waere als ein ruhiger Kasten.
     */
    const block = dokument.slice(
      dokument.indexOf('<div id="hudunten">'),
      dokument.indexOf("</div>", dokument.indexOf('id="load"'))
    );
    expect(block.indexOf('id="gripinfo"')).toBeGreaterThan(0);
    expect(block.indexOf('id="gripinfo"')).toBeLessThan(block.indexOf('id="load"'));
  });

  it("waechst nicht mehr nach beiden Seiten aus der Bildmitte", () => {
    /*
     * Beide Zeilen waren mittig zentriert (left: 50% + translateX(-50%)) und
     * ohne Breitengrenze. Auf 375 px Breite wurde daraus eine schmale, hohe
     * Saeule mitten im Bild. Auf Touchgeraeten haengt der Block jetzt links im
     * freien Streifen; ohne Touch bleibt die Mitte, dort steht nichts im Weg.
     */
    const iPad = FASSUNGEN[0];
    expect(wert(["#gripinfo"], "transform", iPad)).toBeNull();
    expect(wert(["#load"], "transform", iPad)).toBeNull();
    expect(wert(HALTER_SEL, "align-items", iPad)).toBe("flex-start");
  });

  it("schneidet nur die Aufzaehlung ab, nie Gewicht, Preis oder Ampel", () => {
    // Die Liste ist die einzige Zeile mit Ellipse. Alles, was der Spieler zum
    // Entscheiden braucht, steht im Kopf und darf statt dessen umbrechen.
    const iPad = FASSUNGEN[0];
    const liste = ["#grip-liste"];
    expect(wert(liste, "white-space", iPad)).toBe("nowrap");
    expect(wert(liste, "text-overflow", iPad)).toBe("ellipsis");
    expect(wert(liste, "overflow", iPad)).toBe("hidden");
    expect(wert(["#grip-kopf"], "white-space", iPad)).toBeNull();

    expect(langeLadung.kopf).toContain("1.5 t");
    // Preis und Gewicht des anvisierten Stuecks stehen ebenfalls im Kopf.
    expect(langesZiel.kopf).toContain("1.2 t");
    expect(langesZiel.kopf).toContain("€/t");
    /*
     * Die Fraktion bleibt in Klammern hinter dem Namen — die Prozente sind weg
     * (E-061, 15.09.2026).
     *
     * Hier stand bis zum 15.09.2026 „(Mischschrott · 58 % Baumischabfall)".
     * Patrick am selben Tag: „Es gibt Mischschrott, dann ist das Mischschrott.
     * Dann sind mir die Anteile, zu wie viel Prozent das Mischschrott ist,
     * relativ egal." Dieser Waechter ist dabei absichtlich rot geworden — das
     * war die Meldung „die Prozente sind raus".
     *
     * Der Mittelpunkt statt der zweiten Klammer: Der Name endet hier selbst
     * auf „)", und „(Front eingedrückt) (Mischschrott)" liest sich falsch.
     */
    expect(langesZiel.kopf).toContain(`${LANGER_NAME} · Mischschrott`);
    expect(langesZiel.kopf).not.toContain("%");
    /*
     * Und der Zielhinweis ist weg. Er stand hier als „› ueber MISCHSCHROTT:
     * ✕ falsche Zone". Patrick: „Die Info brauche ich nicht, weil ich sehe es
     * ja quasi, weil es gruen aufleuchtet auf dem Feld."
     */
    expect(langeLadung.kopf).not.toContain(LANGE_MULDE);
    expect(langeLadung.kopf).not.toContain("falsche Zone");
    expect(langeLadung.kopf).not.toContain("passt");
  });

  it("blendet die zweite Zeile aus, wenn nichts in der Spinne liegt", () => {
    // "Kühlschrank anvisiert" braucht keine Aufzaehlung — und eine leere Zeile
    // im Bild waere genau das, was Patrick stoert.
    expect(alltagsZiel.liste).toBe("");
    expect(css).toContain("#grip-liste:empty { display: none; }");
  });

  it("ist im Ruhezustand ganz weg — ohne Flaeche, nicht nur durchsichtig", () => {
    /*
     * NEU am 15.09.2026 (E-032). Patrick: "Ich weiss nicht, wofuer wir
     * 'Greifer offen' ueberhaupt brauchen. Also kann ganz verschwinden."
     *
     * `display: none` und nicht `opacity: 0` ist der Kern: Ein durchsichtiger
     * Kasten haelt seine Flaeche und schiebt die Ladeanzeige weiter nach oben.
     * Sichtbar waere nichts, verdeckt trotzdem etwas.
     */
    expect(css).toContain("#gripinfo.weg { display: none; }");
    expect(wert(["#gripinfo.weg"], "display", FASSUNGEN[0])).toBe("none");
    // Das Markup startet im Ruhezustand: Beim Laden steht dort noch nichts.
    expect(dokument).toMatch(/<div id="gripinfo" class="hud weg">/);
    expect(dokument).toMatch(/<span id="grip-kopf"><\/span>/);

    const hud = readFileSync(resolve(wurzel, "src/ui/hud.ts"), "utf8");
    // Kein Text mehr fuer "nichts anvisiert" — die Zeile wird verborgen.
    expect(hud).not.toContain('kopf: "Greifer: offen"');
    expect(hud).toMatch(/showTarget\([\s\S]{0,120}this\.verbergeGriff\(\)/);
    // ... aber "geschlossen (leer)" bleibt: Das ist die Antwort auf einen
    // Fehlgriff, keine Zustandsmeldung (Empfehlung an Patrick, E-032).
    // E-170: steht seit der Übersetzung in t(…)
    expect(hud).toContain('kopf: t("Greifer: geschlossen (leer)")');
  });

  it("laesst die Zeile nicht bei jedem Ueberstreichen auf- und zuklappen", () => {
    /*
     * Ein Kasten, der beim Schwenken ueber eine Halde flackert, waere
     * schlimmer als ein ruhiger Kasten. Darum ein Nachlauf, bevor er faellt —
     * und Zeit nehmen statt Zeitgeber stellen: `verbergeGriff` laeuft in jedem
     * Bild, ein `setTimeout` wuerde beim naechsten Ziel ins Leere feuern.
     */
    const hud = readFileSync(resolve(wurzel, "src/ui/hud.ts"), "utf8");
    const m = /const GRIFF_NACHLAUF_MS = (\d+);/.exec(hud);
    expect(m, "Nachlauf fehlt").not.toBeNull();
    const ms = Number(m![1]);
    expect(ms, "Nachlauf zu kurz — die Zeile wuerde flackern").toBeGreaterThanOrEqual(250);
    expect(ms, "Nachlauf zu lang — es stuende zu lange etwas Falsches da").toBeLessThanOrEqual(900);
    expect(hud).not.toContain("setTimeout(() => this.verbergeGriff");
  });

  for (const f of FASSUNGEN) {
    describe(f.name, () => {
      const voll = stapel(f, langeLadung.kopf, langeLadung.liste, true);
      const ziel = stapel(f, langesZiel.kopf, langesZiel.liste, true);
      const alltag = stapel(f, alltagsZiel.kopf, alltagsZiel.liste, false);
      const ruhe = stapel(f, null, "", false);
      const nachbarn = [
        pedalKasten(f),
        knopfKasten("btn-rot-l", f),
        knopfKasten("btn-rot-r", f),
      ];
      const kaesten = [voll, ziel, alltag].flatMap((s) =>
        s.ladung ? [s.griff, s.ladung] : [s.griff]
      );

      it("ueberlappt weder Pedale noch Drehtasten", () => {
        for (const n of nachbarn)
          for (const k of kaesten)
            expect(
              ueberlappt(k, n),
              `${k.name} auf ${n.name}: ${JSON.stringify([k, n])}`
            ).toBe(false);
      });

      it("haelt mindestens 8 px Luft zum naechsten Bedienelement", () => {
        // Beruehren reicht nicht: Ein Daumen, der die Zeile streift, soll nicht
        // das Gefuehl haben, er tippe daneben.
        for (const n of nachbarn)
          for (const k of kaesten)
            expect(luft(k, n), `${k.name} zu dicht an ${n.name}`).toBeGreaterThanOrEqual(8);
      });

      it("steht im Ruhezustand gar nicht im Bild", () => {
        expect(ruhe.oben, "im Ruhezustand darf dort nichts stehen").toBe(0);
      });

      it("bleibt im Alltag im unteren Viertel bis Drittel", () => {
        /*
         * Der Alltagsfall: ein Stueck anvisiert, kein Abholer. So sieht das
         * Bild die allermeiste Zeit aus, und hier ist der Deckel eng.
         * Gemessen: iPad 5,5 % · iPhone quer 19,5 % · iPhone hoch 24,9 %.
         * Im Hochformat sitzt der Block ueber den Pedalen, darum die 27 %.
         */
        expect(alltag.oben / f.h, `Alltag reicht bis ${alltag.oben} px von ${f.h}`).toBeLessThan(
          0.27
        );
      });

      it("bleibt mit dem laengsten Text unter zwei Fuenfteln des Bildes", () => {
        /*
         * GEAENDERT am 15.09.2026 (E-032): vorher 0,35, jetzt 0,40 — mit
         * Begruendung, nicht aus Bequemlichkeit.
         *
         * Zwei Dinge sind seither dazugekommen, beide unverzichtbar:
         *  1. Sichere Raender. Im Querformat nimmt der Notch-Rand 100 px
         *     Bildbreite weg. Derselbe Text braucht dadurch eine Zeile mehr,
         *     und unten kommen 21 px Home-Indicator dazu: allein das sind
         *     +43 px (83 -> 126 px).
         *  2. 14 px Schrift statt 12 im Querformat (Briefing Kap. 20):
         *     +15 px (126 -> 141 px).
         * Zurueckgeholt wurden 11 px (Zeilenabstand 1,25 statt 1,35,
         * Innenrand 4/8 statt 4/10, Zwischenraum 4 statt 6) — und im
         * Ruhezustand die ganzen 27 px, die dort bisher immer standen.
         *
         * Der schlimmste Fall ist selten: laengster Stuecknamen samt
         * Materialangabe UND wartender Abholer. Was der Spieler staendig
         * sieht, deckelt der Test darueber auf 27 %.
         *
         * Gemessen: iPad 12,5 % · iPhone quer 37,6 % · iPhone hoch 36,0 %.
         */
        const hoechste = Math.max(voll.oben, ziel.oben);
        expect(hoechste / f.h, `Block reicht bis ${hoechste} px von ${f.h}`).toBeLessThan(0.4);
      });

      it("erreicht die Bildmitte nie", () => {
        // Die harte Grenze: Gegriffen wird in der Bildmitte. Was dort steht,
        // steht im Weg — unabhaengig von jeder Prozentzahl.
        const hoechste = Math.max(voll.oben, ziel.oben);
        expect(hoechste).toBeLessThan(f.h / 2);
      });
    });
  }
});
