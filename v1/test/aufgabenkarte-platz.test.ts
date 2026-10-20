/**
 * WO DIE AUFGABENKARTE UND DIE GEISTERDAUMEN STEHEN (E-162) — aus dem CSS
 * gerechnet (`test/cssmass.ts`), in den Fassungen iPad quer, iPhone mini quer
 * und hoch.
 *
 * Bewacht wird, was der Auftrag verlangt: Karte und Knoepfe ragen nicht in die
 * Stick-Aufsetzfelder. „Aufsetzfeld" heisst hier: der Ring des
 * Geisterdaumens — genau dort bittet die Aufgabe den Daumen hin. Dazu: die
 * Knoepfe der Karte liegen auf dem iPhone mini quer ganz im
 * Kamera-Mittelstreifen (dort setzt nie ein Stick auf), und alles bleibt frei
 * von Pedalen, Drehtasten und Menueknopf.
 *
 * Gerechnet werden zwei Kartenfaelle:
 *  - Schritt 1 von Aufgabe 1: Ziel (1 Zeile), Schritt-Titel, Text in 2 Zeilen,
 *    eine Sternzeile. Auf dem iPhone mini quer endet die Karte damit bei
 *    hoechstens y 130 — darunter liegt das Kupferteil (G2b, Smoke-Test 19.10.).
 *  - der schlimmste Fall: dazu Zaehler, und die Sternzeile der Presse-Aufgabe
 *    so oft umgebrochen, wie sie es auf dieser Breite tut.
 */
import { describe, it, expect } from "vitest";
import {
  FASSUNGEN,
  fassungInnen,
  knopfKasten,
  luft,
  pedalKasten,
  px,
  pxOderNull,
  schriftgroesse,
  ueberlappt,
  wert,
  zeilen,
  zeilenabstand,
  type Fassung,
  type Kasten,
} from "./cssmass";
import { sternZiele } from "../src/ui/aufgabentexte";
import type { GameEvents } from "../src/core/events";

const HALTER = ["#tutorial", "#tutorial.aufgabe", "body.touch #tutorial", "body.touch #tutorial.aufgabe"];
const KARTE = ["#tutorial .karte", "#tutorial.aufgabe .karte"];
const KOPF = ["#tutorial .kopf", "#tutorial.aufgabe .kopf"];
const ZUSATZ = ["#tutorial.aufgabe .zusatz"];
const TITEL = ["#tutorial h3", "#tutorial.aufgabe h3"];
const TEXT = ["#tutorial p", "#tutorial.aufgabe p"];
const RAHMEN = 2; // `.karte`: border 2px …
const RAHMEN_LINKS = 5; // … border-left-width 5px

const hochkant = (f: Fassung): boolean => f.h > f.w;
/** Stick-Zonen: 35 % je Seite, hochkant 40 % (index.html `#touch .zone`). */
const zoneLinksBis = (f: Fassung): number => f.w * (hochkant(f) ? 0.4 : 0.35);
const zoneRechtsAb = (f: Fassung): number => f.w * (hochkant(f) ? 0.6 : 0.65);

/** Zeilenhoehe in px, aufgerundet (der Browser rundet Zeilenkaesten nicht ab). */
const zeile = (sel: string[], f: Fassung): number => Math.ceil(schriftgroesse(sel, f) * zeilenabstand(sel, f));

type Wertung = GameEvents["challenge:start"]["wertung"];
// Wertungen wie in `challenges/katalog.ts` (Aufgabe 1 und die Presse)
const ERSTER_GRIFF = { zwei: { zeitS: 180 }, drei: { zeitS: 90 } } as unknown as Wertung;
const PRESSE = {
  zwei: { zeitS: 180, praezisionCm: 100 },
  drei: { zeitS: 90, praezisionCm: 40, harteAufschlaege: 0 },
} as unknown as Wertung;
const SORTIEREN = { zwei: { zeitS: 240, fehlwuerfe: 1 }, drei: { zeitS: 150, fehlwuerfe: 0 } } as unknown as Wertung;

/** Textbreite innen in der Karte. */
function innen0(f: Fassung): number {
  const links = px(HALTER, "left", f);
  const breite = pxOderNull(HALTER, "width", f);
  const rechts = breite === null ? f.w - px(HALTER, "right", f) : links + breite;
  return rechts - links - RAHMEN_LINKS - RAHMEN - 2 * fassungInnen(KARTE, f)[1];
}

type Fall = "schritt1" | "schlimmst";

function kartenKasten(f: Fassung, fall: Fall = "schlimmst"): { karte: Kasten; innen: number; hoehe: number; knoepfe: Kasten[] } {
  const links = px(HALTER, "left", f);
  const breite = pxOderNull(HALTER, "width", f);
  const rechts = breite === null ? f.w - px(HALTER, "right", f) : links + breite;
  const oben = px(HALTER, "top", f);
  const [padY, padX] = fassungInnen(KARTE, f);
  expect(wert(KARTE, "border-left-width", f)).toBe(`${RAHMEN_LINKS}px`);
  const innen = innen0(f);
  expect(innen).toBe(rechts - links - RAHMEN_LINKS - RAHMEN - 2 * padX);
  const kopf = px(KOPF, "min-height", f);
  const titelRand = Number(/^(\d+)(px)?(\s|$)/.exec(wert(["#tutorial.aufgabe h3"], "margin", f) ?? "")?.[1] ?? NaN);
  const schrift = schriftgroesse(ZUSATZ, f);
  const sternZeilen =
    fall === "schritt1"
      ? zeilen(sternZiele(ERSTER_GRIFF, "de"), innen0(f), schrift)
      : Math.max(...(["de", "en"] as const).map((s) => zeilen(sternZiele(PRESSE, s), innen0(f), schrift)));
  const hoehe =
    2 * RAHMEN +
    2 * padY +
    kopf +
    zeile(ZUSATZ, f) + // Ziel
    titelRand +
    zeile(TITEL, f) +
    2 * zeile(TEXT, f) + // Text, zwei Zeilen
    (fall === "schlimmst" ? zeile(ZUSATZ, f) : 0) + // Zaehler
    sternZeilen * zeile(ZUSATZ, f); // Sternziele
  const y1 = f.h - oben;
  const karte: Kasten = { name: "Aufgabenkarte", x0: links, x1: rechts, y0: y1 - hoehe, y1 };

  return { karte, innen, hoehe, knoepfe: kopfKnoepfe(f, true) };
}

/** Breite des Schrifthalters links im Kopf; null = er waechst mit dem Text (iPad, Telefon hoch). */
const LINKS = ["#tutorial.aufgabe .kopf .links"];

/**
 * Trefferflaechen der Kopf-Knoepfe (::before ragt 3 px zur Seite und
 * `ueberstand` px nach oben/unten).
 *  - Schrifthalter frei: alle Knoepfe fest breit, rechtsbuendig — von rechts
 *    nach links ↻, Pause, PRESSEN.
 *  - Schrifthalter fest (Telefon quer, E-164): Knoepfe ab Halter + Luecke,
 *    PRESSEN fest, ↻ fest, der Klappknopf fuellt den Rest.
 * `schriftBreite` ueberschreibt den Halter (fuer die Gegenprobe).
 */
function kopfKnoepfe(f: Fassung, mitPressen: boolean, schriftBreite = pxOderNull(LINKS, "width", f)): Kasten[] {
  const links = px(HALTER, "left", f);
  const breite = pxOderNull(HALTER, "width", f);
  const rechts = breite === null ? f.w - px(HALTER, "right", f) : links + breite;
  const [padY, padX] = fassungInnen(KARTE, f);
  const luecke = px(["#tutorial .kopf .knoepfe"], "gap", f);
  const knopfHoehe = px(["#tutorial.aufgabe .kopf button"], "height", f);
  const ueberstand = -px(["#tutorial.aufgabe .kopf button::before"], "top", f);
  const kopfOben = f.h - px(HALTER, "top", f) - RAHMEN - padY;
  const kasten = (id: string, x0: number, x1: number): Kasten => ({
    name: id, x0: x0 - 3, x1: x1 + 3, y0: kopfOben - knopfHoehe - ueberstand, y1: kopfOben + ueberstand,
  });
  const w = (id: string): number => px([`#tutorial.aufgabe #${id}`], "width", f);
  const ende = rechts - RAHMEN - padX;
  if (schriftBreite === null) {
    const out: Kasten[] = [];
    let x = ende;
    for (const id of mitPressen ? ["tut-neu", "tut-pause", "tut-pressen"] : ["tut-neu", "tut-pause"]) {
      out.push(kasten(id, x - w(id), x));
      x -= w(id) + luecke;
    }
    return out;
  }
  expect(wert(["#tutorial.aufgabe #tut-pause"], "flex", f), "Klappknopf fuellt den Kopf").toBe("1");
  let x = links + RAHMEN_LINKS + padX + schriftBreite + px(KOPF, "gap", f);
  const out: Kasten[] = [];
  if (mitPressen) {
    out.push(kasten("tut-pressen", x, x + w("tut-pressen")));
    x += w("tut-pressen") + luecke;
  }
  const neuAb = ende - w("tut-neu");
  out.push(kasten("tut-pause", x, neuAb - luecke), kasten("tut-neu", neuAb, ende));
  return out;
}

/** Zusammengeklappt (E-164): nur Rahmen, Polster und Kopf. */
function zuKasten(f: Fassung): Kasten {
  const links = px(HALTER, "left", f);
  const breite = pxOderNull(HALTER, "width", f);
  const rechts = breite === null ? f.w - px(HALTER, "right", f) : links + breite;
  const [padY] = fassungInnen(KARTE, f);
  const y1 = f.h - px(HALTER, "top", f);
  return { name: "Karte zu", x0: links, x1: rechts, y0: y1 - (2 * RAHMEN + 2 * padY + px(KOPF, "min-height", f)), y1 };
}

function geist(seite: "links" | "rechts", f: Fassung): Kasten {
  const sel = ["#geisterdaumen .geist", `#geisterdaumen .geist.${seite}`];
  const w = px(sel, "width", f);
  const h = px(sel, "height", f);
  const unten = px(sel, "bottom", f);
  const x0 = seite === "links" ? px(sel, "left", f) : f.w - px(sel, "right", f) - w;
  return { name: `Geisterdaumen ${seite}`, x0, x1: x0 + w, y0: unten, y1: unten + h };
}


describe("Aufgabenkarte und Geisterdaumen: Platz", () => {
  for (const f of FASSUNGEN) {
    describe(f.name, () => {
      const { karte, innen, hoehe, knoepfe } = kartenKasten(f);
      const ringe = [geist("links", f), geist("rechts", f)];
      const fest = [pedalKasten(f), knopfKasten("btn-rot-l", f), knopfKasten("btn-rot-r", f), knopfKasten("btn-menu", f)];

      it("Text in mindestens 14 px", () => {
        for (const sel of [ZUSATZ, TEXT, KOPF]) expect(schriftgroesse(sel, f), sel[sel.length - 1]).toBeGreaterThanOrEqual(14);
      });

      it("Knoepfe sind mit dem Daumen zu treffen (44 x 44 px)", () => {
        for (const k of knoepfe) {
          expect(k.x1 - k.x0, k.name).toBeGreaterThanOrEqual(44);
          expect(k.y1 - k.y0, k.name).toBeGreaterThanOrEqual(44);
        }
      });

      it("Karte und Knoepfe bleiben aus den Aufsetzfeldern (Ring des Geisterdaumens)", () => {
        for (const r of ringe) {
          for (const k of [karte, ...knoepfe]) {
            expect(ueberlappt(k, r), `${k.name} auf ${r.name}: ${JSON.stringify([k, r])}`).toBe(false);
          }
          expect(luft(karte, r), `Karte zu dicht am ${r.name} (Kartenhoehe ${hoehe} px)`).toBeGreaterThanOrEqual(6);
        }
      });

      it("Geisterdaumen liegen in ihrer Stick-Zone, frei von Pedalen, Drehtasten, Menue", () => {
        const [l, r] = ringe as [Kasten, Kasten];
        expect(l.x0, "links: im sichtbaren Bild").toBeGreaterThanOrEqual(f.sa.l);
        expect(l.x1, "links: in der linken Zone").toBeLessThanOrEqual(zoneLinksBis(f));
        expect(r.x0, "rechts: in der rechten Zone").toBeGreaterThanOrEqual(zoneRechtsAb(f));
        expect(r.x1, "rechts: im sichtbaren Bild").toBeLessThanOrEqual(f.w - f.sa.r);
        for (const g of ringe)
          for (const k of fest) expect(luft(g, k), `${g.name} an ${k.name}: ${JSON.stringify([g, k])}`).toBeGreaterThanOrEqual(4);
      });

      it("Karte frei vom Menueknopf", () => {
        const menue = knopfKasten("btn-menu", f);
        expect(luft(karte, menue), JSON.stringify([karte, menue])).toBeGreaterThanOrEqual(6);
      });

      if (!hochkant(f)) {
        it("quer: Karte endet vor der rechten Stick-Zone", () => {
          expect(karte.x1).toBeLessThan(zoneRechtsAb(f));
        });
        it("quer: Sternziele von Aufgabe 1 und Sortieren in einer Zeile, Presse in hoechstens zwei", () => {
          const schrift = schriftgroesse(ZUSATZ, f);
          for (const s of ["de", "en"] as const) {
            for (const w of [ERSTER_GRIFF, SORTIEREN]) expect(zeilen(sternZiele(w, s), innen, schrift), sternZiele(w, s)).toBe(1);
            expect(zeilen(sternZiele(PRESSE, s), innen, schrift), sternZiele(PRESSE, s)).toBeLessThanOrEqual(2);
          }
        });
      }

      if (f.name === "iPhone mini quer") {
        it("mini quer: alle Knoepfe im Kamera-Mittelstreifen, kein Stick setzt dort auf", () => {
          for (const k of knoepfe) {
            expect(k.x0, `${k.name} ragt in die linke Stick-Zone`).toBeGreaterThan(zoneLinksBis(f));
            expect(k.x1, `${k.name} ragt in die rechte Stick-Zone`).toBeLessThan(zoneRechtsAb(f));
          }
        });
        it("mini quer: Schritt 1 von Aufgabe 1 laesst das Arbeitsfeld ab y 130 frei (G2b)", () => {
          const s1 = kartenKasten(f, "schritt1");
          expect(f.h - s1.karte.y0, "Unterkante der Karte").toBeLessThanOrEqual(130);
        });
        it("mini quer: die Zahlen im CSS-Kommentar stimmen", () => {
          const s1 = kartenKasten(f, "schritt1");
          expect([karte.x0, karte.x1]).toEqual([58, 524]);
          expect(s1.hoehe).toBe(123);
          expect(f.h - s1.karte.y0, "Unterkante Schritt 1").toBe(129);
          expect(hoehe).toBe(157);
          expect(f.h - karte.y0, "Unterkante schlimmster Fall").toBe(163);
          expect(f.h - ringe[0]!.y1, "Oberkante des linken Rings").toBe(190);
        });

        // --- E-164: zusammengeklappt auf die Kopfzeile
        it("mini quer zu: Karte hoechstens 50 px hoch, Unterkante bei hoechstens 60", () => {
          const zu = zuKasten(f);
          expect(zu.y1 - zu.y0, "Hoehe").toBeLessThanOrEqual(50);
          expect(f.h - zu.y0, "Unterkante").toBeLessThanOrEqual(60);
          expect([zu.y1 - zu.y0, f.h - zu.y0], "Zahlen im CSS-Kommentar").toEqual([38, 44]);
        });
        for (const mitPressen of [false, true]) {
          it(`mini quer zu: Klappknopf ${mitPressen ? "neben PRESSEN" : "allein"} 44 x 44, ganz im Kamera-Mittelstreifen`, () => {
            const kn = kopfKnoepfe(f, mitPressen);
            const klapp = kn.find((k) => k.name === "tut-pause")!;
            for (const k of kn) {
              expect(k.x1 - k.x0, k.name).toBeGreaterThanOrEqual(44);
              expect(k.y1 - k.y0, k.name).toBeGreaterThanOrEqual(44);
              expect(k.x0, `${k.name} ragt in die linke Stick-Zone`).toBeGreaterThan(zoneLinksBis(f));
              expect(k.x1, `${k.name} ragt in die rechte Stick-Zone`).toBeLessThan(zoneRechtsAb(f));
            }
            for (let i = 1; i < kn.length; i++) expect(luft(kn[i - 1]!, kn[i]!), "Knoepfe ueberlappen nicht").toBeGreaterThanOrEqual(0);
            // die Zahlen im CSS-Kommentar (sichtbar, ohne die 3 px des ::before)
            expect([klapp.x0 + 3, klapp.x1 - 3]).toEqual(mitPressen ? [391, 462] : [289, 462]);
          });
        }
        it("mini quer zu: der Fortschritt passt neben Schritt und Uhr in den Kopf", () => {
          const breite = px(LINKS, "width", f);
          const schrift = schriftgroesse(KOPF, f);
          for (const t of ["2/2 · 9:59 · 12/12 richtig", "2/2 · 9:59 · 12/12 correct", "2/2 · 9:59 · platt 99 %", "2/2 · 9:59 · flattened 99 %"])
            expect(t.length * schrift * 0.55, t).toBeLessThanOrEqual(breite);
          expect(wert(["#tutorial.aufgabe .kurz", "#tutorial.aufgabe.pausiert .kurz"], "display", f)).toBe("inline");
        });
      }

      if (f.name === "iPad quer") {
        it("iPad: Kopf wie vorher — kein fester Schrifthalter, Pause 72 px, kein Fortschritt im Kopf", () => {
          expect(pxOderNull(LINKS, "width", f)).toBeNull();
          expect(px(["#tutorial.aufgabe #tut-pause"], "width", f)).toBe(72);
          expect(wert(["#tutorial.aufgabe .kurz", "#tutorial.aufgabe.pausiert .kurz"], "display", f)).toBe("none");
          // Karte x 12..478, innen bis 464: ↻ 420..464, Pause 342..414, PRESSEN 240..336
          expect(kopfKnoepfe(f, true).map((k) => [k.x0 + 3, k.x1 - 3])).toEqual([[420, 464], [342, 414], [240, 336]]);
        });
      }
    });
  }

  it("GEGENPROBE: eine hoehere Karte faellt auf dem iPhone mini quer auf", () => {
    const f = FASSUNGEN.find((x) => x.name === "iPhone mini quer")!;
    const { karte } = kartenKasten(f);
    const ring = geist("links", f);
    // zwei Zeilen mehr (z. B. Tipp und eine dritte Textzeile) — dann muss der Waechter anschlagen
    const hoeher: Kasten = { ...karte, y0: karte.y0 - 2 * zeile(ZUSATZ, f) };
    expect(luft(hoeher, ring)).toBeLessThan(6);
    // und eine Zeile mehr bei Schritt 1 (z. B. die Sternziele wieder in zwei Zeilen) reisst die 130
    const s1 = kartenKasten(f, "schritt1").karte;
    expect(f.h - (s1.y0 - zeile(ZUSATZ, f))).toBeGreaterThan(130);
  });

  it("GEGENPROBE E-164: ein schmalerer Schrifthalter schiebt den Klappknopf in die linke Stick-Zone, eine Zeile mehr reisst die 50 px", () => {
    const f = FASSUNGEN.find((x) => x.name === "iPhone mini quer")!;
    const klapp = kopfKnoepfe(f, false, px(LINKS, "width", f) - 8).find((k) => k.name === "tut-pause")!;
    expect(klapp.x0).toBeLessThanOrEqual(zoneLinksBis(f));
    const zu = zuKasten(f);
    expect(zu.y1 - zu.y0 + zeile(ZUSATZ, f), "Zaehler als eigene Zeile statt im Kopf").toBeGreaterThan(50);
  });
});
