/**
 * DIE SCHICHT-ANZEIGE (E-205): reagiert auf `schicht:*`, und sie steht nirgends im Weg.
 *
 * Teil 1 treibt das Datenbild (`SchichtAnzeige`) über den Bus — ohne Browser.
 * Teil 2 rechnet aus dem CSS (`test/cssmass.ts`), wo der Kasten auf dem iPad
 * (1180 × 820 und 1024 × 768) und dem iPhone mini quer (812 × 375) steht, und
 * prüft: links vom Kamera-Mittelstreifen, über dem linken Stick in seiner
 * Ruhelage und den Pedalen, weg vom Funktionskranz, die Einblendung daneben.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EventBus, type GameEvents } from "../src/core/events";
import { BUCHUNG_MS, SchichtAnzeige, tickerSchritt, type AnzeigeBild } from "../src/ui/schichtanzeige";
import type { Sprache } from "../src/challenges/texte";
import { FASSUNGEN, fassungInnen, pedalKasten, px, pxOderNull, schriftgroesse, wert, wurzel, zeilenabstand, type Fassung } from "./cssmass";

type Stand = GameEvents["schicht:stand"];
const stand = (x: Partial<Stand> = {}): Stand => ({
  uhr: "06:42",
  restS: 558,
  torZu: false,
  kasseEur: 0,
  wartend: 0,
  annahmeVoll: false,
  verlader: { order: null, kg: 3100, anteil: 0.62 },
  boxen: [
    { order: "steel", kg: 4200, schwelleKg: 6000 },
    { order: "copper", kg: 1600, schwelleKg: 1500 },
    { order: "rubble", kg: 0, schwelleKg: 3000 },
  ],
  ...x,
});

function aufbau(s: Sprache = "de"): { bus: EventBus; a: SchichtAnzeige; uhr: { ms: number } } {
  const bus = new EventBus();
  const uhr = { ms: 0 };
  const a = new SchichtAnzeige(bus, () => uhr.ms, () => s);
  return { bus, a, uhr };
}

describe("Anzeige reagiert auf schicht:start und schicht:stand", () => {
  it("vor der Schicht unsichtbar, ab schicht:start im Bild", () => {
    const { bus, a } = aufbau();
    expect(a.bild.sichtbar).toBe(false);
    bus.emit("schicht:start", { stufe: "montag", dauerS: 600 });
    expect(a.bild.sichtbar).toBe(true);
  });
  it("Uhr mit Restzeit, nach Torschluss mit Wort", () => {
    const { bus, a } = aufbau();
    bus.emit("schicht:stand", stand());
    expect(a.bild.uhr).toBe("06:42 · noch 9:18");
    bus.emit("schicht:stand", stand({ uhr: "15:12", restS: 47.2, torZu: true }));
    expect(a.bild.uhr).toBe("15:12 · Tor zu · 0:48");
  });
  it("Warnzeile nur, wenn Fuhren warten oder die Annahme voll ist — Zeichen und Wort", () => {
    const { bus, a } = aufbau();
    bus.emit("schicht:stand", stand());
    expect(a.bild.warn).toBeNull();
    bus.emit("schicht:stand", stand({ wartend: 1 }));
    expect(a.bild.warn).toBe("! 1 Fuhre wartet");
    bus.emit("schicht:stand", stand({ wartend: 3 }));
    expect(a.bild.warn).toBe("! 3 Fuhren warten");
    bus.emit("schicht:stand", stand({ annahmeVoll: true }));
    expect(a.bild.warn).toBe("! Annahme voll");
    bus.emit("schicht:stand", stand({ annahmeVoll: true, wartend: 2 }));
    expect(a.bild.warn).toBe("! Annahme voll · 2 warten");
  });
  it("Verlader: Sorte und Anteil; in der Lücke „kommt …\"", () => {
    const { bus, a } = aufbau();
    bus.emit("schicht:stand", stand());
    expect(a.bild.verlader).toEqual({ name: "VERLADER", anteil: 0.62, wert: "Misch 62 %", voll: false });
    bus.emit("schicht:stand", stand({ verlader: { order: "steel", kg: 6000, anteil: 1.4 } }));
    expect(a.bild.verlader).toMatchObject({ anteil: 1, wert: "STAHL 100 %", voll: true });
    bus.emit("schicht:stand", stand({ verlader: null }));
    expect(a.bild.verlader).toMatchObject({ anteil: 0, wert: "kommt …" });
  });
  it("Boxen gegen ihre Schwelle; voll heißt „Abholer kommt\"", () => {
    const { bus, a } = aufbau();
    bus.emit("schicht:stand", stand());
    expect(a.bild.boxen).toEqual([
      { name: "STAHL", anteil: 0.7, wert: "4,2/6 t", voll: false },
      { name: "BUNT+VA", anteil: 1, wert: "Abholer kommt", voll: true },
      { name: "MÜLL", anteil: 0, wert: "0,0/3 t", voll: false },
    ]);
  });
  it("E-211: steht der Abholer der Box vorn, heißt es „Abholer da\" — auch wenn sie schon leerer ist", () => {
    const { bus, a } = aufbau();
    bus.emit("schicht:stand", stand({ verlader: { order: "copper", kg: 400, anteil: 0.3 } }));
    expect(a.bild.boxen[1]).toMatchObject({ wert: "Abholer da", voll: true });
    bus.emit("schicht:stand", stand({ verlader: { order: "copper", kg: 1200, anteil: 0.8 }, boxen: [{ order: "steel", kg: 0, schwelleKg: 6000 }, { order: "copper", kg: 300, schwelleKg: 1500 }, { order: "rubble", kg: 0, schwelleKg: 3000 }] }));
    expect(a.bild.boxen[1]).toMatchObject({ wert: "Abholer da", voll: false });
    // Gegenprobe: Misch-Verlader vorn → bei voller Box „Abholer kommt"
    bus.emit("schicht:stand", stand());
    expect(a.bild.boxen[1]).toMatchObject({ wert: "Abholer kommt" });
  });
  it("vor dem ersten Lagebild: leere Balken, nichts ist „voll\"", () => {
    const { bus, a } = aufbau();
    bus.emit("schicht:start", { stufe: "montag", dauerS: 600 });
    expect(a.bild.boxen.map((b) => b.voll)).toEqual([false, false, false]);
    expect(a.bild.verlader.wert).toBe("kommt …");
  });
  it("Englisch", () => {
    const { bus, a } = aufbau("en");
    bus.emit("schicht:stand", stand({ wartend: 2, annahmeVoll: true }));
    expect(a.bild.uhr).toBe("06:42 · 9:18 left");
    expect(a.bild.warn).toBe("! Intake full · 2 waiting");
    expect(a.bild.verlader.wert).toBe("Mixed 62 %");
    expect(a.bild.boxen.map((b) => `${b.name} ${b.wert}`)).toEqual(["STEEL 4.2/6 t", "NF+SS pickup coming", "WASTE 0.0/3 t"]);
  });
});

describe("Kasse: weicher Ticker wie das Konto (hud.updateMoney)", () => {
  it("läuft hinterher und rastet ein", () => {
    const { bus, a } = aufbau();
    bus.emit("schicht:start", { stufe: "montag", dauerS: 600 });
    bus.emit("schicht:stand", stand({ kasseEur: 1240 }));
    expect(a.bild.kasse).toBe("Kasse 0 €");
    a.takt(0.13); // eine Zeitkonstante: rund 63 %
    const zwischen = Number(a.bild.kasse.replace(/\D/g, ""));
    expect(zwischen).toBeGreaterThan(700);
    expect(zwischen).toBeLessThan(850);
    for (let i = 0; i < 60; i++) a.takt(1 / 60);
    expect(a.bild.kasse).toBe("Kasse 1.240 €");
    expect(a.takt(1 / 60), "eingerastet: nichts mehr zu malen").toBe(false);
  });
  it("bildratenunabhängig: 30 Bilder ≈ 60 Bilder", () => {
    let x30 = 0;
    let x60 = 0;
    for (let i = 0; i < 6; i++) x30 = tickerSchritt(x30, 1000, 1 / 30);
    for (let i = 0; i < 12; i++) x60 = tickerSchritt(x60, 1000, 1 / 60);
    expect(Math.abs(x30 - x60)).toBeLessThan(1);
  });
  it("negative Kasse mit echtem Minuszeichen", () => {
    const { bus, a } = aufbau();
    bus.emit("schicht:start", { stufe: "montag", dauerS: 600 });
    bus.emit("schicht:stand", stand({ kasseEur: -75 }));
    a.takt(5);
    expect(a.bild.kasse).toBe("Kasse −75 €");
  });
});

describe("Buchungen: kurze Einblendung", () => {
  const zeige = (b: AnzeigeBild): string | null => b.buchung?.text ?? null;
  it("Abfahrt, Fehlwurf, Schaden — mit Vorzeichen", () => {
    const { bus, a, uhr } = aufbau();
    bus.emit("schicht:start", { stufe: "montag", dauerS: 600 });
    const naechste = (): void => {
      uhr.ms += BUCHUNG_MS;
      a.takt(0.016);
    };
    bus.emit("schicht:buchung", { art: "abfahrt", eur: 1240, kg: 7800, order: null });
    expect(a.bild.buchung).toEqual({ text: "+1.240 € Mischschrott", minus: false });
    naechste();
    bus.emit("schicht:buchung", { art: "abfahrt", eur: 3120, order: "copper" });
    expect(zeige(a.bild)).toBe("+3.120 € Bunt + VA");
    naechste();
    bus.emit("schicht:buchung", { art: "fehlwurf", eur: -25 });
    expect(a.bild.buchung).toEqual({ text: "−25 € Fehlwurf", minus: true });
    naechste();
    bus.emit("schicht:buchung", { art: "schaden", eur: -50 });
    expect(zeige(a.bild)).toBe("−50 € Schaden");
    naechste();
    bus.emit("schicht:buchung", { art: "abfahrt", eur: -84, order: "rubble" });
    expect(zeige(a.bild)).toBe("−84 € Müll");
  });
  it("Standgeld in kleinen Schritten zählt in derselben Einblendung weiter", () => {
    const { bus, a, uhr } = aufbau();
    bus.emit("schicht:start", { stufe: "montag", dauerS: 600 });
    for (let i = 0; i < 12; i++) {
      bus.emit("schicht:buchung", { art: "standgeld", eur: -1 });
      uhr.ms += 1000;
    }
    expect(zeige(a.bild)).toBe("−12 € Standgeld");
  });
  it("verschwindet nach 2,6 s", () => {
    const { bus, a, uhr } = aufbau();
    bus.emit("schicht:start", { stufe: "montag", dauerS: 600 });
    bus.emit("schicht:buchung", { art: "fehlwurf", eur: -25 });
    uhr.ms = BUCHUNG_MS - 1;
    a.takt(0.016);
    expect(a.bild.buchung).not.toBeNull();
    uhr.ms = BUCHUNG_MS;
    expect(a.takt(0.016)).toBe(true);
    expect(a.bild.buchung).toBeNull();
    // danach beginnt eine neue Einblendung bei null
    bus.emit("schicht:buchung", { art: "fehlwurf", eur: -25 });
    expect(zeige(a.bild)).toBe("−25 € Fehlwurf");
  });
  it("Abfahrt mit Fehlwurf (zwei Zeilen im selben Augenblick, E-204): beide nacheinander", () => {
    const { bus, a, uhr } = aufbau();
    bus.emit("schicht:start", { stufe: "montag", dauerS: 600 });
    bus.emit("schicht:buchung", { art: "abfahrt", eur: 980, order: null });
    bus.emit("schicht:buchung", { art: "fehlwurf", eur: -75 });
    expect(zeige(a.bild)).toBe("+980 € Mischschrott");
    uhr.ms = BUCHUNG_MS;
    a.takt(0.016);
    expect(zeige(a.bild)).toBe("−75 € Fehlwurf");
    uhr.ms = 2 * BUCHUNG_MS - 1;
    a.takt(0.016);
    expect(zeige(a.bild), "die zweite steht ihre vollen 2,6 s").toBe("−75 € Fehlwurf");
    uhr.ms = 2 * BUCHUNG_MS;
    a.takt(0.016);
    expect(a.bild.buchung).toBeNull();
  });
  it("GEGENPROBE: viele auf einmal — es warten höchstens drei hinter der ersten", () => {
    const { bus, a, uhr } = aufbau();
    bus.emit("schicht:start", { stufe: "montag", dauerS: 600 });
    for (let i = 0; i < 6; i++) bus.emit("schicht:buchung", { art: i % 2 ? "schaden" : "fehlwurf", eur: -(i + 1) });
    const gesehen: string[] = [];
    for (let i = 0; i < 8 && a.bild.buchung; i++) {
      gesehen.push(zeige(a.bild)!);
      uhr.ms += BUCHUNG_MS;
      a.takt(0.016);
    }
    expect(gesehen).toEqual(["−1 € Fehlwurf", "−4 € Schaden", "−5 € Fehlwurf", "−6 € Schaden"]);
  });
  it("Englisch", () => {
    const { bus, a, uhr } = aufbau("en");
    bus.emit("schicht:start", { stufe: "montag", dauerS: 600 });
    bus.emit("schicht:buchung", { art: "abfahrt", eur: 1240, order: "mixed" });
    expect(zeige(a.bild)).toBe("+1,240 € Mixed scrap");
    bus.emit("schicht:buchung", { art: "standgeld", eur: -3 });
    uhr.ms += BUCHUNG_MS;
    a.takt(0.016);
    expect(zeige(a.bild)).toBe("−3 € waiting fee");
  });
});

/* ------------------------------------------------------------------ Platz */

const IPAD_AIR: Fassung = { name: "iPad quer 1180", w: 1180, h: 820, sa: { l: 0, r: 0, t: 0, b: 0 } };
const PRUEF = [IPAD_AIR, ...FASSUNGEN.filter((f) => f.w > f.h)];
const A = ["#schichtanzeige", "body.touch #schichtanzeige", ".hud"];
const touchTs = readFileSync(resolve(wurzel, "src/core/touch.ts"), "utf8");
const RADIAL_R = Number(/const RADIAL_R = (\d+);/.exec(touchTs)![1]);

/** Längste Zeilen, die die Anzeige schreiben kann — DE und EN (aus dem Datenbild, nicht abgeschrieben). */
function laengsteBilder(): AnzeigeBild[] {
  const out: AnzeigeBild[] = [];
  for (const s of ["de", "en"] as const) {
    const { bus, a } = aufbau(s);
    bus.emit("schicht:start", { stufe: "freitag", dauerS: 600 });
    const schwer = stand({
      uhr: "15:59", restS: 599, torZu: true, kasseEur: -12345, wartend: 12, annahmeVoll: true,
      verlader: { order: "copper", kg: 0, anteil: 0.99 },
      boxen: [
        { order: "steel", kg: 12345, schwelleKg: 16500 },
        { order: "copper", kg: 1499, schwelleKg: 1500 },
        { order: "rubble", kg: 2999, schwelleKg: 3000 },
      ],
    });
    bus.emit("schicht:stand", schwer);
    bus.emit("schicht:buchung", { art: "abfahrt", eur: 12345, order: "steel" });
    a.takt(9);
    out.push(a.bild);
    bus.emit("schicht:buchung", { art: "abfahrt", eur: -1234, order: "copper" });
    bus.emit("schicht:stand", stand({ ...schwer, torZu: false, verlader: null, boxen: schwer.boxen.map((b) => ({ ...b, kg: b.schwelleKg })) }));
    out.push(a.bild);
    bus.emit("schicht:buchung", { art: "standgeld", eur: -999 });
    out.push(a.bild);
  }
  return out;
}

/** Der Kasten der Anzeige (oben gezählt) — border-box, Höhe aus acht Zeilen. */
function kasten(f: Fassung): { x0: number; x1: number; y0: number; y1: number; fs: number; innen: number } {
  expect(wert(A, "box-sizing", f)).toBe("border-box");
  const fs = schriftgroesse(A, f);
  const lh = zeilenabstand(A, f);
  const [py, pxx] = fassungInnen(A, f);
  const breite = px(A, "width", f);
  const x0 = px(A, "left", f);
  const y0 = px(A, "top", f);
  const zeilenMax = 8; // Uhr, Kasse, Buchung, Warnung, Verlader, drei Boxen
  const h = zeilenMax * Math.ceil(fs * lh) + 2 * py + 2;
  return { x0, x1: x0 + breite, y0, y1: y0 + h, fs, innen: breite - 2 * pxx - 2 };
}

describe("Schicht-Anzeige: Platz auf iPad und iPhone mini quer", () => {
  for (const f of PRUEF) {
    describe(f.name, () => {
      const k = kasten(f);
      if (process.env["MASS"]) console.log(f.name, "Anzeige", k);

      it("Schrift ≥ 14 px (Kap. 20), jede Zeile passt in die Breite", () => {
        expect(k.fs).toBeGreaterThanOrEqual(14);
        const zeichen = k.fs * 0.55;
        const luecke = px(["#schichtanzeige .sa-balken"], "gap", f);
        const bahnMin = px(["#schichtanzeige .sa-balken .bahn"], "min-width", f);
        for (const b of laengsteBilder()) {
          for (const t of [b.uhr, b.kasse, b.buchung?.text ?? "", b.warn ?? ""]) expect(t.length * zeichen, t).toBeLessThanOrEqual(k.innen);
          for (const z of [b.verlader, ...b.boxen]) {
            const breite = Math.max(8, z.name.length) * zeichen + luecke + bahnMin + luecke + z.wert.length * zeichen;
            expect(breite, `${z.name} ${z.wert}`).toBeLessThanOrEqual(k.innen);
          }
        }
      });

      it("ganz links vom Kamera-Mittelstreifen (35 %)", () => {
        expect(k.x1).toBeLessThanOrEqual(0.35 * f.w - 4);
        expect(k.x0).toBeGreaterThanOrEqual(f.sa.l);
      });

      it("über dem linken Stick in seiner Ruhelage (Geisterdaumen) und den Pedalen", () => {
        const g = ["#geisterdaumen .geist", "#geisterdaumen .geist.links"];
        const pad = px(["#touch .pad"], "width", f);
        const mitteY = f.h - px(g, "bottom", f) - px(g, "height", f) / 2;
        expect(k.y1, "Stick").toBeLessThanOrEqual(mitteY - pad / 2 - 4);
        const p = pedalKasten(f);
        expect(k.y1, "Pedale").toBeLessThanOrEqual(f.h - p.y1);
      });

      it("weit weg vom Funktionskranz (er klappt um den rechten Daumen, rechte 35 %)", () => {
        const sektorB = px(["#radial .sektor"], "width", f);
        expect(k.x1).toBeLessThan(0.65 * f.w - RADIAL_R - sektorB / 2);
      });

      it("Menüknopf und Drehtasten liegen rechts davon", () => {
        for (const id of ["btn-menu", "btn-rot-l", "btn-rot-r"]) {
          const sel = ["#touch .btn", `#touch #${id}`, `#${id}`];
          const x0 = f.w - px(sel, "right", f) - px(sel, "width", f) - 4;
          expect(x0, id).toBeGreaterThan(k.x1);
        }
      });

      it("Einblendungen (#toast) beginnen rechts daneben, nicht darüber", () => {
        const sel = ["#toast", "body.touch #schichtanzeige:not([hidden]) ~ #toast"];
        expect(wert(sel, "transform", f)).toBe("none");
        expect(px(sel, "left", f)).toBeGreaterThanOrEqual(k.x1 + 4);
        // und gegen den Menüknopf: rechts bleibt seine Breite frei
        const menue = ["#touch .btn", "#touch #btn-menu", "#btn-menu"];
        const maxB = wert(sel, "max-width", f)!;
        const rechteKante = px(sel, "left", f) + f.w - f.sa.l - Number(/(\d+)px\)$/.exec(maxB)![1]);
        expect(rechteKante, "rechte Kante der Einblendung").toBeLessThanOrEqual(f.w - px(menue, "right", f) - px(menue, "width", f) - 4);
      });
    });
  }

  it("GEGENPROBE: 40 px breiter, und der Kasten ragt auf dem iPhone mini in den Mittelstreifen", () => {
    const f = PRUEF.find((x) => x.name === "iPhone mini quer")!;
    const k = kasten(f);
    expect(k.x1 + 40).toBeGreaterThan(0.35 * f.w - 4);
  });
  it("ohne Touch steht sie oben rechts (links ist die Tastenhilfe)", () => {
    const f = IPAD_AIR;
    expect(pxOderNull(["#schichtanzeige"], "right", f)).toBe(12);
  });
});
