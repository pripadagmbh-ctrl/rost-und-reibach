import { describe, expect, it } from "vitest";
import {
  FASSUNGEN,
  fassungInnen,
  knopfKasten,
  luft,
  pedalKasten,
  px,
  schriftgroesse,
  zeilenabstand,
  type Fassung,
  type Kasten,
} from "./cssmass";

/*
 * Fahrpedale unten mittig (Befund Patrick 22.10.2026, 40e: „Pedale in die
 * Mitte — sie werden beim Baggern versehentlich getroffen (gilt fürs ganze
 * Spiel)"). Unten links lagen sie unter dem linken Stick-Daumen.
 *
 * Gerechnet wird aus dem CSS (cssmass.ts) auf iPad quer 1180 x 820 und
 * 1024 x 768 und iPhone mini quer 812 x 375 mit Notch-Rand: Die Pedale stehen
 * im Kamera-Mittelstreifen (35 % bis 65 %, E-136) mit Luft zu beiden
 * Stick-Zonen und beruehren weder Drehtasten, Menue, unteren HUD-Block,
 * Schicht-Anzeige noch Lehrgangsleiste. Dass ein Tipp auf den Pedalen die
 * Kamera nicht erreicht, prueft test/kamerageste.test.ts.
 */

const IPAD_AIR: Fassung = { name: "iPad quer 1180", w: 1180, h: 820, sa: { l: 0, r: 0, t: 0, b: 0 } };
const QUER = [IPAD_AIR, ...FASSUNGEN.filter((f) => f.w > f.h)];

/** SW 22.10.2026: so weit bleibt der Pedalblock von jeder Stick-Zone weg — ein Daumen am Zonenrand trifft ihn nicht. */
const ZONEN_LUFT = 24;
/** Mindestluft zu jedem Nachbarn — wie die 8 px in test/greifanzeige.test.ts. */
const LUFT = 8;
/**
 * Unterkante der Lehrgangsleiste hoechstens ein Viertel des Bildes —
 * zugesichert in test/lehrgangsleiste.test.ts („Unterkante"), gemessen 74 px.
 */
const LEISTE_UNTEN_ANTEIL = 0.25;

/** Unterer HUD-Block an seinen verankerten Kanten; nach oben hoechstens bis zur Bildmitte (greifanzeige.test.ts). */
function hudUnten(f: Fassung): Kasten {
  const hu = ["#hudunten", "body.touch #hudunten"];
  const y0 = px(hu, "bottom", f);
  return { name: "HUD unten", x0: px(hu, "left", f), x1: f.w - px(hu, "right", f), y0, y1: f.h / 2 };
}

/** Schicht-Anzeige oben links, acht Zeilen hoch (wie test/schichtanzeige.test.ts). */
function schicht(f: Fassung): Kasten {
  const A = ["#schichtanzeige", "body.touch #schichtanzeige", ".hud"];
  const [py] = fassungInnen(A, f);
  const h = 8 * Math.ceil(schriftgroesse(A, f) * zeilenabstand(A, f)) + 2 * py + 2;
  const x0 = px(A, "left", f);
  const oben = px(A, "top", f);
  return { name: "Schicht-Anzeige", x0, x1: x0 + px(A, "width", f), y0: f.h - oben - h, y1: f.h - oben };
}

function leiste(f: Fassung): Kasten {
  return { name: "Lehrgangsleiste", x0: 0.35 * f.w, x1: 0.65 * f.w, y0: f.h * (1 - LEISTE_UNTEN_ANTEIL), y1: f.h };
}

/** Alles, was an einem Pedalblock falsch sein kann — leer heisst: passt. */
function fehler(p: Kasten, f: Fassung): string[] {
  const out: string[] = [];
  if (p.x0 < 0.35 * f.w + ZONEN_LUFT) out.push(`linke Stick-Zone: ${p.x0} < ${0.35 * f.w + ZONEN_LUFT}`);
  if (p.x1 > 0.65 * f.w - ZONEN_LUFT) out.push(`rechte Stick-Zone: ${p.x1} > ${0.65 * f.w - ZONEN_LUFT}`);
  if (p.y0 < f.sa.b) out.push("im Home-Indicator");
  const nachbarn = [
    knopfKasten("btn-rot-l", f),
    knopfKasten("btn-rot-r", f),
    knopfKasten("btn-menu", f),
    hudUnten(f),
    schicht(f),
    leiste(f),
  ];
  for (const n of nachbarn) if (luft(p, n) < LUFT) out.push(`${n.name}: ${luft(p, n)} px Luft`);
  return out;
}

describe("Fahrpedale unten mittig (40e)", () => {
  for (const f of QUER) {
    describe(f.name, () => {
      const p = pedalKasten(f);
      if (process.env["MASS"]) console.log(f.name, "Pedale", p, "HUD unten", hudUnten(f));

      it("im Mittelstreifen, fern von beiden Stick-Zonen und allen Nachbarn", () => {
        expect(fehler(p, f), JSON.stringify(p)).toEqual([]);
      });

      it("mittig: gleich weit von beiden Stick-Zonen", () => {
        expect(p.x0 - 0.35 * f.w).toBeCloseTo(0.65 * f.w - p.x1, 6);
      });

      it("jedes Pedal bleibt ein Tippziel (44 px, Kap. 20)", () => {
        expect(px(["#touch .pedal"], "width", f)).toBeGreaterThanOrEqual(44);
        expect(px(["#touch .pedal"], "height", f)).toBeGreaterThanOrEqual(44);
      });

      it("laesst ueber sich den groessten Teil des Streifens fuer die Kamera", () => {
        // Freie Hoehe im Streifen zwischen Pedal-Oberkante und Bildoberkante
        // bzw. der Lehrgangsleiste (schlimmster Fall 25 %). SW: mindestens die halbe Bildhoehe.
        const frei = f.h - f.sa.t - p.y1;
        const imLehrgang = f.h * (1 - LEISTE_UNTEN_ANTEIL) - p.y1;
        if (process.env["MASS"]) console.log(f.name, "Kamera frei", { frei, imLehrgang, seitlich: p.x0 - 0.35 * f.w });
        expect(imLehrgang / f.h).toBeGreaterThanOrEqual(0.5);
      });

      it("GEGENPROBE: 40 px breiter, und der Block stoesst an", () => {
        const breiter = { ...p, x0: p.x0 - 20, x1: p.x1 + 20 };
        expect(fehler(breiter, f).length).toBeGreaterThan(0);
      });
    });
  }
});
