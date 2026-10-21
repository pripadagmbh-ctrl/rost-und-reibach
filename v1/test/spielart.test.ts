import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { seite, wurzel } from "./cssmass";
import { BETRIEB, NUR_IM_BETRIEB, NUR_IM_SANDKASTEN, NUR_IM_SIMULATOR, SPIELART } from "../src/core/spielart";
import { griffZiel } from "../src/ui/hud";

/*
 * DER SIMULATOR-SCHALTER (E-118, Patrick 06.10.2026).
 *
 * Wirtschaft, Verhandeln, Ruf und Figuren: „Abschalten, im Code lassen." Die
 * Module bleiben und werden von ihren eigenen Tests unveraendert geprueft. Was
 * dieser Waechter haelt, ist die VERDRAHTUNG — und dass es genau EINEN
 * Schalter gibt, den alle lesen.
 *
 * `main.ts` ist ein Browserstart; geprueft wird darum am Quelltext, wie in
 * `funk-verdrahtung` und `platzinventar-verdrahtung`.
 */

const main = readFileSync(resolve(wurzel, "src/main.ts"), "utf8");

/** Bereiche [von, bis) aller Bloecke `if (BETRIEB) { … }` im Quelltext. */
function betriebsBloecke(quelle: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const m of quelle.matchAll(/if \(BETRIEB\) \{/g)) {
    let tiefe = 0;
    for (let i = m.index! + m[0].length - 1; i < quelle.length; i++) {
      if (quelle[i] === "{") tiefe++;
      else if (quelle[i] === "}" && --tiefe === 0) {
        out.push([m.index!, i + 1]);
        break;
      }
    }
  }
  return out;
}

/** Aufrufe, die irgendwo AUSSERHALB eines Betriebsblocks stehen. */
function draussen(quelle: string, aufrufe: string[]): string[] {
  const bloecke = betriebsBloecke(quelle);
  const out: string[] = [];
  for (const a of aufrufe) {
    let i = quelle.indexOf(a);
    if (i < 0) out.push(`${a} (fehlt ganz)`);
    while (i >= 0) {
      if (!bloecke.some(([v, b]) => i >= v && i < b)) out.push(a);
      i = quelle.indexOf(a, i + 1);
    }
  }
  return out;
}

/** Was nur im Betrieb laufen darf — je Bild bzw. je Physikschritt. */
const NUR_BETRIEB_AUFRUFE = [
  /*
   * Der Tagesablauf MIT Uhrzeit — daran haengen Torschluss und Feierabend
   * (E-113). Seit E-122 laeuft `shift.update` auch im Sandkasten, aber OHNE
   * Uhrzeit: nur fuer den Takt der Anlieferer nach losem Schrott. Gesperrt
   * bleibt also genau der Aufruf, der die Uhr hineingibt.
   */
  "shift.update(frameDt, looseKg, daylight.time",
  "abrechnung.takt()",
  "funk.platzlage(",
  "tutorial.update(",
  "hud.updateShift(",
  "hud.updateMoney(",
  "staff.update(",
  "polizei.update(",
];

describe("Ein Schalter fuer die Spielart", () => {
  it("steht auf Simulator", () => {
    expect(SPIELART).toBe("simulator");
    expect(BETRIEB).toBe(false);
  });

  it("und ist nirgends sonst ein zweites Mal definiert", () => {
    /*
     * Die haeufigste Fehlerklasse dieses Projekts: zwei Stellen, die dasselbe
     * wissen sollen. Wer im Quelltext ein eigenes "simulator" oder "betrieb"
     * als Zeichenkette abfragt, hat sich einen zweiten Schalter gebaut.
     */
    const funde: string[] = [];
    const gehe = (dir: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) gehe(p);
        else if (e.name.endsWith(".ts")) {
          const rel = relative(wurzel, p).replace(/\\/g, "/");
          if (rel === "src/core/spielart.ts") continue;
          if (/["']simulator["']|["']betrieb["']/.test(readFileSync(p, "utf8"))) funde.push(rel);
        }
      }
    };
    gehe(resolve(wurzel, "src"));
    expect(funde, "zweiter Schalter").toEqual([]);
  });

  it("jede Kennung der beiden Listen gibt es auf der Seite", () => {
    for (const id of [...NUR_IM_BETRIEB, ...NUR_IM_SIMULATOR, ...NUR_IM_SANDKASTEN]) {
      expect(seite.includes(`id="${id}"`), `${id} steht nicht in index.html`).toBe(true);
    }
  });

  it("der Kranz hat in keiner Spielart mehr als acht Eintraege", () => {
    const von = seite.indexOf('<div class="hidden-actions">');
    const bis = seite.indexOf('<div class="hidden-actions" id="menu-actions">');
    const ids = [...seite.slice(von, bis).matchAll(/<span id="([\w-]+)"/g)].map((m) => m[1]);
    const simulator = ids.filter((id) => !NUR_IM_BETRIEB.includes(id));
    const betrieb = ids.filter((id) => !NUR_IM_SIMULATOR.includes(id));
    expect(simulator).toContain("btn-nachschub");
    // ABHOLEN gibt es seit E-120 auch im Sandkasten (ohne Fraktionswahl)
    expect(simulator).toContain("btn-pickup");
    expect(simulator).not.toContain("btn-lambert");
    expect(betrieb).not.toContain("btn-nachschub");
    // E-191: HUPE kam in beide Spielarten — acht statt sieben (`funktionskranz.test.ts` traegt neun)
    expect(simulator).toContain("btn-hupe");
    expect(simulator.length).toBeLessThanOrEqual(8);
    expect(betrieb.length).toBe(8);
  });
});

describe("main.ts haengt im Simulator ab, was Geld und Leute ins Bild bringt", () => {
  it("Uhr, Kasse, Funk, Tutorial, Belegschaft und Polizei laufen nur im Betrieb", () => {
    expect(draussen(main, NUR_BETRIEB_AUFRUFE)).toEqual([]);
  });

  it("GEGENPROBE: ein Aufruf ausserhalb des Blocks wird gemeldet", () => {
    const kaputt = main.replace(
      /if \(BETRIEB\) \{\s*staff\.update\(/,
      "{ staff.update("
    );
    expect(kaputt, "die Gegenprobe hat nichts veraendert").not.toBe(main);
    expect(draussen(kaputt, NUR_BETRIEB_AUFRUFE)).toContain("staff.update(");
  });

  it("Waage, Kundschaft und Verkauf werden abgehaengt", () => {
    const stelle = main.indexOf("if (!BETRIEB) {\n    const stumm");
    expect(stelle, "der Abhaengblock fehlt").toBeGreaterThan(0);
    const block = main.slice(stelle, main.indexOf("\n  }\n", stelle));
    for (const haken of [
      "onWeighIn",
      "onWeighOut",
      "onCustomerArrived",
      "onPickupFunk",
      "onAbholerTara",
      "onAbholerBrutto",
      "onPickupDepart",
    ]) {
      expect(block, `${haken} bleibt verdrahtet`).toContain(`"${haken}"`);
    }
    /*
     * Bis E-122 stand hier `acceptDeliveries = false`: keine Fuhren nach Uhr.
     * Patrick, 06.10.2026: "LKWs kommen automatisch." Seitdem folgt die
     * Einfahrt im Sandkasten dem Stau, im selben Takt wie im Betrieb.
     */
    expect(block, "die Einfahrt ist im Sandkasten wieder fest zu").not.toContain(
      "vehicles.acceptDeliveries = false"
    );
    expect(main, "die Einfahrt folgt im Sandkasten nicht dem Stau").toContain(
      "vehicles.acceptDeliveries = !shift.jammed"
    );
    expect(main, "der Sandkasten-Takt bekommt doch eine Uhrzeit").toContain(
      "shift.update(frameDt, looseKg);"
    );
    expect(block).toContain("staff.ausblenden()");
    expect(block).toContain("hud.preiseZeigen = false");
    expect(block).toContain("containers.preiseZeigen = false");
  });

  it("das Hauptmenue kommt vor dem Platz", () => {
    // Seit E-196 bekommt das Menue die Lektionsliste: `await waehleSpielart(LEKTIONEN)`
    const menue = main.indexOf("await waehleSpielart(");
    expect(menue, "main.ts wartet nie auf das Hauptmenue").toBeGreaterThan(0);
    expect(menue).toBeLessThan(main.indexOf("new Yard("));
  });

  it("NACHSCHUB ist verdrahtet — Kranz und Taste", () => {
    expect(main).toMatch(
      /!BETRIEB && \(input\.wasPressed\("Digit1"\) \|\| touch\.consumePress\("Digit1"\)\)\) holeNachschub\(\)/
    );
  });
});

describe("Hauptmenue", () => {
  /*
   * Bis E-124 stand hier ein gesperrter CHALLENGES-Knopf („Kommen als
   * Naechstes"). Seit E-125 fuellt `ui/hauptmenue.ts` die Liste aus
   * `challenges/katalog.ts` — der Platzhalter ist weg. Seit E-196
   * zweistufig: Hauptknoepfe in #hm-haupt, die Liste in #hm-eintraege;
   * beschriftet wird alles aus `ui/hauptmenue.ts`.
   */
  it("SANDKASTEN ist waehlbar, die Pruefungen kommen aus dem Katalog", () => {
    expect(seite).toContain('<button id="hm-sandkasten"></button>');
    expect(seite).not.toContain("hm-challenges-knopf");
    expect(seite).toContain('<div id="hm-eintraege"></div>');
    const menue = readFileSync(resolve(wurzel, "src/ui/hauptmenue.ts"), "utf8");
    expect(menue).toMatch(/CHALLENGES\.map/);
    expect(menue).toContain('getElementById("hm-eintraege")');
    expect(menue).toContain('haupt("hm-sandkasten"');
  });
});

describe("Ohne Geld kein Preis in der Griff-Info", () => {
  const stueck = { materialId: "copper", massKg: 40, shape: null } as unknown as Parameters<
    typeof griffZiel
  >[0];
  it("mit Preis wie bisher, im Simulator ohne", () => {
    expect(griffZiel(stueck).kopf).toContain("€");
    expect(griffZiel(stueck, false).kopf).not.toContain("€");
    expect(griffZiel(stueck, false).kopf).toContain("40");
  });
});
