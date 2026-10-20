/**
 * DIE SECHS AUFGABEN FUER 1.0 ALS KATALOG (G3, 20.10.2026).
 *
 * Was fuer alle gilt (Auftrag G3, „Allgemein"):
 *  - Reihenfolge 1–6 wie im Konzept, Kennungen fest (gespeicherte Sterne
 *    haengen daran — „verladen" bleibt);
 *  - jede hat Ziel, Schritte mit Geisterdaumen, Wertung, Aufbau und nennt
 *    ihren Startgreifer (sonst bliebe nach Aufgabe 5 der Magnet dran);
 *  - der letzte Schritt ist die Fertig-Beobachtung;
 *  - die Karte auf dem iPhone mini quer: Ziel in EINER Zeile, Schritttext
 *    (mit der Standard-Belegung eingesetzt) in hoechstens ZWEI, Sternziele
 *    in hoechstens zwei, Tipp in hoechstens zwei — gerechnet aus dem CSS wie
 *    `test/aufgabenkarte-platz.test.ts`.
 * Zweisprachigkeit und Platzhalter prueft `test/aufgabe1.test.ts` fuer alle.
 */
import { describe, it, expect } from "vitest";
import { CHALLENGES } from "../src/challenges/katalog";
import { aufbauKonflikte } from "../src/challenges/aufbau";
import type { Beobachtung } from "../src/challenges/challenge";
import { sternZiele } from "../src/ui/aufgabentexte";
import { bedientext } from "../src/ui/challengekarte";
import { defaultConfig } from "../src/core/controlConfig";
import { FASSUNGEN, fassungInnen, px, pxOderNull, schriftgroesse, zeilen } from "./cssmass";

const MINI = FASSUNGEN.find((f) => f.name === "iPhone mini quer")!;
const HALTER = ["#tutorial", "#tutorial.aufgabe", "body.touch #tutorial", "body.touch #tutorial.aufgabe"];
const KARTE = ["#tutorial .karte", "#tutorial.aufgabe .karte"];
const ZUSATZ = ["#tutorial.aufgabe .zusatz"];
const TEXT = ["#tutorial p", "#tutorial.aufgabe p"];
/** Innenbreite der Karte — dieselbe Rechnung wie `innen0` in test/aufgabenkarte-platz.test.ts (Rahmen 5 + 2 px) */
function innen(): number {
  const links = px(HALTER, "left", MINI);
  const breite = pxOderNull(HALTER, "width", MINI);
  const rechts = breite === null ? MINI.w - px(HALTER, "right", MINI) : links + breite;
  return rechts - links - 5 - 2 - 2 * fassungInnen(KARTE, MINI)[1];
}

const FERTIG: Record<string, Beobachtung> = {
  "erster-griff": "teil_im_ziel",
  verladen: "wrack_gepresst",
  sortieren: "teil_im_ziel",
  "platt-machen": "wrack_platt",
  magnet: "teil_im_ziel",
  "schwere-last": "wrack_abgelegt",
};

describe("Der Aufgabenkatalog fuer 1.0", () => {
  it("sechs Aufgaben in der Reihenfolge des Konzepts", () => {
    expect(CHALLENGES.map((c) => c.id)).toEqual(["erster-griff", "verladen", "sortieren", "platt-machen", "magnet", "schwere-last"]);
  });

  for (const c of CHALLENGES) {
    describe(c.id, () => {
      it("vollstaendig: Aufbau, Startgreifer, Schritte mit Daumen oder Ziel, Wertung, Fertig-Beobachtung zuletzt", () => {
        expect(aufbauKonflikte(c)).toEqual([]);
        expect((c.aufbau.teile?.length ?? 0) + (c.aufbau.wracks?.length ?? 0)).toBeGreaterThan(0);
        expect(c.aufbau.greifer).toBeDefined();
        expect(c.schritte.length).toBeGreaterThan(0);
        expect(c.schritte.at(-1)!.beobachtet).toBe(FERTIG[c.id]);
        expect(Object.keys(c.wertung.zwei).length + Object.keys(c.wertung.drei).length).toBeGreaterThan(0);
        // jede Schwelle von drei Sternen ist mindestens so streng wie die von zweien
        for (const [k, v] of Object.entries(c.wertung.zwei)) {
          const drei = (c.wertung.drei as Record<string, number>)[k];
          if (drei !== undefined) expect(drei, k).toBeLessThanOrEqual(v as number);
        }
      });

      it("iPhone mini quer: Ziel 1 Zeile, Schritte und Tipp hoechstens 2, Sternziele hoechstens 2", () => {
        const b = innen();
        const zs = schriftgroesse(ZUSATZ, MINI);
        const ts = schriftgroesse(TEXT, MINI);
        for (const s of ["de", "en"] as const) {
          expect(zeilen(c.ziel[s], b, zs), `${s} Ziel: ${c.ziel[s]}`).toBe(1);
          for (const st of c.schritte) {
            const text = bedientext(st.text[s], defaultConfig(), s);
            expect(text, "Zeilenumbruch im Schritttext").not.toContain("\n");
            expect(zeilen(text, b, ts), `${s} ${st.titel[s]}: ${text}`).toBeLessThanOrEqual(2);
          }
          if (c.tippNachUeberlast) expect(zeilen(c.tippNachUeberlast[s], b, zs), `${s} Tipp`).toBeLessThanOrEqual(2);
          expect(zeilen(sternZiele(c.wertung, s), b, zs), `${s} Sterne: ${sternZiele(c.wertung, s)}`).toBeLessThanOrEqual(2);
        }
      });
    });
  }

  it("Tipp und Zaehlwort zweisprachig, ohne Tastenbuchstaben (Touch kennt keine Taste O)", () => {
    for (const c of CHALLENGES) {
      for (const t of [c.tippNachUeberlast, c.zaehlwort]) {
        if (!t) continue;
        expect(t.de.trim()).not.toBe("");
        expect(t.en.trim()).not.toBe("");
        expect(t.de + t.en).not.toMatch(/\bTaste\b|\bkey\b|\(O\)/i);
      }
    }
  });
});
