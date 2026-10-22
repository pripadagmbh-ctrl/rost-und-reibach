import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative, sep } from "node:path";

/*
 * WÄCHTER: KEINE NEUEN TEXTBOXEN (Auftrag 41, Paket P4a).
 *
 * Patrick am Gerät, 22.10.2026 (v1/docs/offene-punkte.md, Punkt 41f): „Auch
 * bin ich kein Fan von diesen Textboxen, die da erscheinen … nimmt ja sowieso
 * auch immer sehr viel Sichtfläche weg." Entschieden: im ganzen Spiel
 * Einblendungen (`hud.toast`) durch ein Symbol am Ort des Geschehens + Ton
 * ersetzen — oder begründet behalten.
 *
 * Vergleich: eine Zählerliste am Ausgang einer Lagerhalle. Wer eine Kiste
 * mehr hinausträgt, als auf der Liste steht, fällt auf; wer weniger trägt,
 * bekommt den Hinweis, die Liste nachzuziehen.
 *
 * Gezählt wird je Datei in `v1/src/`, was einen Toast AUSLÖST:
 *   - `irgendwas.toast(` (hud.toast, m.hud.toast, m.toast …)
 *   - ein nackter Aufruf `toast(…)` (z. B. nach Destrukturieren)
 * Nicht gezählt: die Definition (`toast(msg: string): void {` in ui/hud.ts),
 * Typangaben (`hud: { toast(msg: string): void }`) und Kommentare.
 *
 * Fällt durch, wenn eine Datei MEHR hat als erlaubt oder eine neue Datei
 * einen Toast bekommt. Weniger: nur ein Hinweis — P4b senkt die Zahlen, dann
 * die Liste nachziehen. Jede Zahl, die bleibt, braucht ihren Grund im
 * Kommentar daneben.
 *
 * Dazu zwei Umwege, die die Zählung aushebeln würden: den Toast als
 * Funktionswert weiterreichen (`hud.toast.bind`, `= hud.toast;`) und direkt in
 * `#toast` schreiben. Beides fällt durch.
 */

/**
 * Erlaubte Toast-Aufrufe je Datei (Pfad relativ zu v1/src, mit „/").
 * Stand 22.10.2026, Inventur 41-P4a (Gegenzählung per grep: 52 + 4 + 2 = 58).
 */
const ERLAUBT: Record<string, number> = {
  /*
   * 52: alle Meldungen der Verdrahtung. 21 davon laufen nur im Betrieb
   * (BETRIEB = false, E-118) und sind heute tot; Zeile 1166 reicht nur den
   * Toast an ui/radio.ts weiter. P4b ersetzt die erreichbaren durch Symbol +
   * Ton; was bleibt, bekommt hier seinen Grund.
   */
  "main.ts": 52,
  /*
   * 4: drei Notfälle, falls das Markup der Tafel `#abrechnung` fehlt
   * (Feierabend — ohnehin nur Betrieb —, Prüfung, Lektion) und „Tag n —
   * Einfahrt offen" (tag:neu, nur Betrieb). Die Typangabe
   * `hud: { toast(msg: string): void }` zählt nicht.
   */
  "ui/abrechnung.ts": 4,
  /* 2: Senderwahl und Radio an/aus im Pausenmenü (Radio-Feld). */
  "ui/radio.ts": 2,
};

const wurzel = resolve(__dirname, "..");
const srcWurzel = resolve(wurzel, "src");

/** Alle .ts-Dateien unter src, Pfad relativ mit „/". */
function alleQuellen(): Map<string, string> {
  const aus = new Map<string, string>();
  const gehe = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const p = resolve(dir, name);
      if (statSync(p).isDirectory()) gehe(p);
      else if (name.endsWith(".ts")) aus.set(relative(srcWurzel, p).split(sep).join("/"), readFileSync(p, "utf8"));
    }
  };
  gehe(srcWurzel);
  return aus;
}

/**
 * Kommentare heraus, zeilenweise. Reicht für den Stil dieses Projekts: Block-
 * kommentare beginnen jede Zeile mit `*`, Zeilenkommentare stehen am Ende.
 * Ein `//` zählt nur mit Leerraum davor als Kommentar (URLs in Texten bleiben).
 */
function ohneKommentare(quelle: string): string {
  const zeilen: string[] = [];
  let imBlock = false;
  for (const roh of quelle.split(/\r?\n/)) {
    let z = roh;
    if (imBlock) {
      const ende = z.indexOf("*/");
      if (ende < 0) {
        zeilen.push("");
        continue;
      }
      z = z.slice(ende + 2);
      imBlock = false;
    }
    const t = z.trim();
    if (t.startsWith("//") || t.startsWith("*")) {
      zeilen.push("");
      continue;
    }
    if (t.startsWith("/*")) {
      const ende = z.indexOf("*/", z.indexOf("/*") + 2);
      if (ende < 0) {
        imBlock = true;
        zeilen.push("");
        continue;
      }
      z = z.slice(ende + 2);
    }
    const kommentar = z.search(/\s\/\//);
    zeilen.push(kommentar >= 0 ? z.slice(0, kommentar) : z);
  }
  return zeilen.join("\n");
}

/** Signatur statt Aufruf: `toast(msg: string): void` — Parameter mit Typ, dann Rückgabetyp. */
const SIGNATUR = /toast\s*\(\s*[\w$]+\s*\??\s*:\s*[^()]*\)\s*:/g;

/** Wie viele Toasts löst diese Quelle aus? */
function zaehleToasts(quelle: string): number {
  const code = ohneKommentare(quelle).replace(SIGNATUR, "");
  const mitPunkt = code.match(/\.toast\s*\(/g)?.length ?? 0;
  const nackt = code.match(/(?<![\w$.])toast\s*\(/g)?.length ?? 0;
  return mitPunkt + nackt;
}

/** Umwege: `.toast` ohne Aufruf (als Funktionswert) und direkter Griff nach `#toast`. */
function toastUmwege(quelle: string, datei: string): string[] {
  const code = ohneKommentare(quelle);
  const aus: string[] = [];
  for (const m of code.matchAll(/\.toast\b(?!\s*\()/g)) aus.push(`${datei}: \`${code.slice(m.index, m.index + 20).trim()}\``);
  if (datei !== "ui/hud.ts" && /getElementById\(\s*["'`]toast["'`]\s*\)|querySelector(All)?\(\s*["'`]#toast\b/.test(code)) {
    aus.push(`${datei}: greift direkt nach #toast (nur ui/hud.ts darf das)`);
  }
  return aus;
}

interface Pruefung {
  zuViel: string[];
  weniger: string[];
}

/** Vergleich mit der Erlaubt-Liste. */
function pruefe(quellen: Map<string, string>, erlaubt: Record<string, number>): Pruefung {
  const zuViel: string[] = [];
  const weniger: string[] = [];
  const gesehen = new Set<string>();
  for (const [datei, text] of quellen) {
    const n = zaehleToasts(text);
    if (n === 0 && !(datei in erlaubt)) continue;
    gesehen.add(datei);
    const max = erlaubt[datei];
    if (max === undefined) zuViel.push(`${datei}: ${n} Toast(s), Datei steht nicht in der Liste — Symbol am Ort + Ton statt Textbox (Auftrag 41)`);
    else if (n > max) zuViel.push(`${datei}: ${n} statt höchstens ${max} — neue Textbox? Symbol am Ort + Ton (Auftrag 41)`);
    else if (n < max) weniger.push(`${datei}: nur noch ${n} statt ${max} — schön! Bitte ERLAUBT nachziehen.`);
  }
  for (const datei of Object.keys(erlaubt)) {
    if (!gesehen.has(datei)) weniger.push(`${datei}: keine Toasts mehr (oder Datei weg) — Eintrag aus ERLAUBT streichen.`);
  }
  return { zuViel, weniger };
}

describe("Wächter: keine neuen Textboxen (Auftrag 41, P4a)", () => {
  const quellen = alleQuellen();

  it("keine Datei in src/ löst mehr Toasts aus als erlaubt, keine neue Datei kommt dazu", () => {
    const { zuViel, weniger } = pruefe(quellen, ERLAUBT);
    // Freundlich, nicht rot: weniger ist das Ziel von P4b
    if (weniger.length) console.warn(`Toast-Wächter — Liste nachziehen:\n  ${weniger.join("\n  ")}`);
    expect(zuViel, zuViel.join("\n")).toEqual([]);
  });

  it("kein Toast über Umweg (als Funktionswert weitergereicht oder direkt in #toast geschrieben)", () => {
    const umwege = [...quellen].flatMap(([d, t]) => toastUmwege(t, d));
    expect(umwege, umwege.join("\n")).toEqual([]);
  });

  it("die Zählung sieht die Inventur: heute 58 Aufrufe in drei Dateien, die Definition zählt nicht", () => {
    const gezaehlt = [...quellen].map(([d, t]) => [d, zaehleToasts(t)] as const).filter(([, n]) => n > 0);
    // Steht hier eine kleinere Zahl, hat P4b geliefert — dann ERLAUBT und diese Zeile nachziehen.
    expect(gezaehlt.reduce((a, [, n]) => a + n, 0)).toBeLessThanOrEqual(58);
    expect(zaehleToasts(quellen.get("ui/hud.ts") ?? ""), "die Definition in ui/hud.ts zählt als Aufruf").toBe(0);
  });

  describe("Gegenprobe — der Wächter schlägt an, wo er soll", () => {
    const main = quellen.get("main.ts")!;

    it("main.ts mit einem Toast mehr fällt durch", () => {
      const mehr = new Map(quellen);
      mehr.set("main.ts", main + '\nhud.toast("Neue Textbox");\n');
      expect(pruefe(mehr, ERLAUBT).zuViel.some((z) => z.startsWith("main.ts:"))).toBe(true);
    });

    it("eine erfundene neue Datei mit einem Toast fällt durch", () => {
      const neu = new Map(quellen);
      neu.set("world/erfunden.ts", 'export const f = (m: { toast(t: string): void }) => m.toast("Hallo");\n');
      const { zuViel } = pruefe(neu, ERLAUBT);
      expect(zuViel.some((z) => z.startsWith("world/erfunden.ts:"))).toBe(true);
      // genau EIN Aufruf — die Typangabe im Parameter zählt nicht mit
      expect(zaehleToasts(neu.get("world/erfunden.ts")!)).toBe(1);
    });

    it("ein nackter Aufruf nach Destrukturieren zählt auch", () => {
      expect(zaehleToasts('const { toast } = hud;\ntoast("x");\n')).toBe(1);
    });

    it("Kommentare, Definition und Typangabe zählen nicht", () => {
      const nurText = [
        "// hud.toast(\"alt\")",
        "/*",
        " * früher: hud.toast(`…`)",
        " */",
        "class Hud {",
        "  toast(msg: string): void {",
        "    el.textContent = msg;",
        "  }",
        "}",
        "interface A { hud: { toast(msg: string): void } }",
        "const x = 1; // hud.toast(\"hinten\")",
      ].join("\n");
      expect(zaehleToasts(nurText)).toBe(0);
    });

    it("weniger als erlaubt ist kein Fehler, nur ein Hinweis", () => {
      const weniger = new Map(quellen);
      weniger.set("ui/radio.ts", "export const leer = 1;\n");
      const r = pruefe(weniger, ERLAUBT);
      expect(r.zuViel).toEqual([]);
      expect(r.weniger.some((z) => z.startsWith("ui/radio.ts:"))).toBe(true);
    });

    it("Umwege fallen auf: Funktionswert und direkter Griff nach #toast", () => {
      expect(toastUmwege("const sag = hud.toast.bind(hud);", "world/x.ts").length).toBe(1);
      expect(toastUmwege('document.getElementById("toast")!.textContent = "x";', "world/x.ts").length).toBe(1);
      expect(toastUmwege('document.getElementById("toast")!', "ui/hud.ts")).toEqual([]);
    });
  });
});
