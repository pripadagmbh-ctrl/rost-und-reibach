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

  // Knoepfe am rechten Rand des Kopfs, von rechts nach links: ↻, Pause, PRESSEN
  const luecke = px(["#tutorial .kopf .knoepfe"], "gap", f);
  const knopfHoehe = px(["#tutorial.aufgabe .kopf button"], "height", f);
  const ueberstand = -px(["#tutorial.aufgabe .kopf button::before"], "top", f);
  const kopfOben = y1 - RAHMEN - padY;
  const knoepfe: Kasten[] = [];
  let x = rechts - RAHMEN - padX;
  for (const id of ["tut-neu", "tut-pause", "tut-pressen"]) {
    const b = px([`#tutorial.aufgabe #${id}`], "width", f);
    // Trefferflaeche: ::before ragt 3 px zur Seite und `ueberstand` px nach oben/unten
    knoepfe.push({ name: id, x0: x - b - 3, x1: x + 3, y0: kopfOben - knopfHoehe - ueberstand, y1: kopfOben + ueberstand });
    x -= b + luecke;
  }
  return { karte, innen, hoehe, knoepfe };
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
});
