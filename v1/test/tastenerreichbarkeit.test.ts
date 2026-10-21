import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join, relative } from "node:path";

/*
 * JEDE Taste, die im Spiel etwas ausloest, ist auf dem Geraet erreichbar —
 * oder sie steht mit Begruendung auf der Ausnahmeliste.
 *
 * Der Anlass (E-088). E-085 hat das Seitwaertskippen des Greifers gebaut und
 * auf Taste K gelegt. Patrick spielt auf dem iPad. Dort gibt es keine Taste K.
 * Im Funktionskranz gab es keinen Knopf. Die Funktion war fertig gebaut,
 * gemessen, bewacht — und fuer den einzigen Spieler unerreichbar.
 *
 * Nachtrag 17.09.2026 (E-105): Die Funktion selbst ist wieder weg, samt Taste
 * und Kranzknopf — sie beruhte auf einem Missverstaendnis. Der WAECHTER
 * bleibt; er hat seine Arbeit getan und die naechste Taste wartet schon.
 *
 * Es ist dieselbe Fehlerklasse wie in `platzinventar-verdrahtung.test.ts`:
 * zwei Wege fuer dasselbe Ereignis, und nur einer ist verdrahtet. Tastatur und
 * Touch sind zwei Wege. Wer nur den ersten baut, sieht am Bildschirm fertige
 * Arbeit und merkt nichts.
 *
 * Bewacht wird darum nicht die Funktion, sondern der Zusammenhang:
 *   1. Jede Taste, die der Quelltext abfragt, steht in der Tabelle unten.
 *   2. Jede Tabellenzeile nennt den Touch-Weg — oder einen Grund, warum es
 *      keinen gibt.
 *   3. Jeder Kranz- und Menueknopf wird in `main.ts` auch abgefragt
 *      (ein Knopf, den niemand abfragt, ist ein toter Knopf).
 *   4. Jeder DIREKT verdrahtete Knopf ("Knopf: id") steht auf der Seite und
 *      haengt in `main.ts` an einem Klick. Das ist der zweite Weg, wie eine
 *      Taste auf dem Geraet erreichbar sein kann: nicht ueber den Kranz,
 *      sondern ueber einen echten Knopf im Pausenfeld.
 *   5. Keine Taste loest zwei verschiedene Dinge aus.
 * Dazu fuenf Gegenproben, die melden MUESSEN.
 */

const wurzel = resolve(__dirname, "..");
const lies = (p: string) => readFileSync(resolve(wurzel, p), "utf8");
const main = lies("src/main.ts");
const touchTs = lies("src/core/touch.ts");
const seite = lies("index.html");

/**
 * Das Spinnen-Labor (`src/labor/`) ist eine eigene Seite (`labor.html`) zum
 * Vermessen von Greifern, kein Spiel. Dort gibt es weder Kranz noch Knoepfe,
 * und wer sie oeffnet, sitzt an einem Rechner.
 */
const AUSSEN = ["src/labor"];

/** Alle .ts-Dateien unter src/, ausser den ausgenommenen Ordnern. */
function quellen(): Array<{ pfad: string; text: string }> {
  const out: Array<{ pfad: string; text: string }> = [];
  const gehe = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      const rel = relative(wurzel, p).replace(/\\/g, "/");
      if (AUSSEN.some((a) => rel.startsWith(a))) continue;
      if (e.isDirectory()) gehe(p);
      else if (e.name.endsWith(".ts")) out.push({ pfad: rel, text: readFileSync(p, "utf8") });
    }
  };
  gehe(resolve(wurzel, "src"));
  return out;
}

/** Ein Tastencode samt der Art, wie er abgefragt wird. */
interface Fund {
  code: string;
  art: "druck" | "halten" | "achse";
  pfad: string;
}

/**
 * Tastencodes aus Quelltext klauben.
 *
 * Nur Zeichenketten-Literale: `input.axis(n1, p1)` in der Hilfsfunktion
 * `axis2` traegt Variablen und faellt deshalb heraus — die echten Codes stehen
 * an der Aufrufstelle.
 */
export function sammle(quellen: Array<{ pfad: string; text: string }>): Fund[] {
  const out: Fund[] = [];
  const muster: Array<[RegExp, Fund["art"]]> = [
    [/input\.wasPressed\(\s*"([A-Za-z0-9]+)"\s*\)/g, "druck"],
    [/input\.isDown\(\s*"([A-Za-z0-9]+)"\s*\)/g, "halten"],
    [/input\.axis\(\s*"([A-Za-z0-9]+)"\s*,\s*"([A-Za-z0-9]+)"\s*\)/g, "achse"],
    [/axis2\(\s*input\s*,\s*"([A-Za-z0-9]+)"\s*,\s*"([A-Za-z0-9]+)"\s*,\s*"([A-Za-z0-9]+)"\s*,\s*"([A-Za-z0-9]+)"\s*\)/g, "achse"],
  ];
  for (const q of quellen) {
    for (const [re, art] of muster) {
      for (const m of q.text.matchAll(re)) {
        for (const code of m.slice(1)) out.push({ code, art, pfad: q.pfad });
      }
    }
  }
  return out;
}

/**
 * DIE TABELLE. Eine Zeile je Taste.
 *
 * `touch` ist der Weg, auf dem dieselbe Sache ohne Tastatur zu erreichen ist.
 * `null` heisst: gibt es nicht — dann MUSS `grund` dastehen, und der Grund
 * muss einer sein, den man Patrick vorlesen kann.
 */
interface Zeile {
  wirkung: string;
  /** Kranzeintrag / Menueknopf / Geste / Stick — oder null */
  touch: string | null;
  /** Nur wenn touch === null */
  grund?: string;
}

const TASTEN: Record<string, Zeile> = {
  // ---- Maschine: stufenlos, auf Touch ueber die Sticks und die Pedale ----
  KeyW: { wirkung: "vorwaerts", touch: "Pedale + linker Stick hoch" },
  KeyS: { wirkung: "rueckwaerts", touch: "Pedale + linker Stick runter" },
  KeyA: { wirkung: "links lenken", touch: "Pedale + linker Stick links" },
  KeyD: { wirkung: "rechts lenken", touch: "Pedale + linker Stick rechts" },
  KeyQ: { wirkung: "Oberwagen links", touch: "Stickachse `cab` (frei belegbar)" },
  KeyE: { wirkung: "Oberwagen rechts", touch: "Stickachse `cab` (frei belegbar)" },
  KeyR: { wirkung: "Ausleger heben", touch: "Stickachse `boom` (frei belegbar)" },
  KeyF: { wirkung: "Ausleger senken", touch: "Stickachse `boom` (frei belegbar)" },
  KeyT: { wirkung: "Stiel weg", touch: "Stickachse `stick` (frei belegbar)" },
  KeyG: { wirkung: "Stiel ran", touch: "Stickachse `stick` (frei belegbar)" },
  ArrowLeft: { wirkung: "Oberwagen links", touch: "Stickachse `cab`" },
  ArrowRight: { wirkung: "Oberwagen rechts", touch: "Stickachse `cab`" },
  ArrowUp: { wirkung: "Stiel weg", touch: "Stickachse `stick`" },
  ArrowDown: { wirkung: "Stiel ran", touch: "Stickachse `stick`" },
  PageUp: { wirkung: "Ausleger heben", touch: "Stickachse `boom`" },
  PageDown: { wirkung: "Ausleger senken", touch: "Stickachse `boom`" },
  Space: { wirkung: "Spinne schliessen", touch: "rechter Stick (`grapple`) oder Fingerdruck" },

  // ---- Einmalige Befehle: auf Touch ueber Kranz, Menue oder Geste ----
  KeyC: { wirkung: "Ansicht wechseln", touch: "Doppeltipp rechte Bildhaelfte" },
  KeyX: { wirkung: "Fahrerkabine heben/senken", touch: "Kranz: KABINE" },
  KeyO: { wirkung: "Pratzen aus/ein", touch: "Kranz: STUETZEN" },
  KeyI: { wirkung: "Schild heben/senken", touch: "Kranz: SCHILD" },
  KeyB: { wirkung: "Presse starten", touch: "Kranz: PRESSE" },
  KeyV: { wirkung: "Abholung rufen/abfahren", touch: "Kranz: ABHOLEN" },
  KeyJ: { wirkung: "zur Waage schicken", touch: "Kranz: ZUR WAAGE" },
  KeyY: { wirkung: "Lambert rufen", touch: "Kranz: LAMBERT" },
  // E-118: nur im Simulator; ABHOLEN und LAMBERT gibt es dort nicht
  Digit1: { wirkung: "Nachschub holen", touch: "Kranz: NACHSCHUB" },
  // E-191: Hupen = Laster darf abfahren; 2, weil jeder Buchstabe belegt ist
  Digit2: { wirkung: "Hupen (Abholer darf abfahren)", touch: "Kranz: HUPE" },
  /*
   * E-093: SCHILDER zog aus dem Kranz ins Pausenmenue (`pause-markierungen`).
   * Der Waechter wurde dafuer NICHT gelockert — er verlangt fuer „Menue: …"
   * genau dasselbe wie fuer „Kranz: …", naemlich eine Abfrage in main.ts.
   * Geaendert ist nur die Ortsangabe, damit die Tabelle nicht luegt.
   */
  KeyM: { wirkung: "Zonenschilder an/aus", touch: "Menue: SCHILDER" },
  /*
   * E-105 (17.09.2026): Der Doppelgriff auf K ist weg. E-085 hatte das
   * Seitwaertskippen auf die Speichern-Taste gelegt; die Funktion selbst ist
   * auf Patricks Wort hinausgeflogen („kippen soll als funktion raus, das war
   * ein missverstaendnis"), und damit tut K wieder genau eine Sache.
   *
   * Der Touch-Weg ist KEIN Kranzeintrag, sondern der Knopf „Speichern" im
   * Pausenfeld — er haengt an einem eigenen Klick, nicht an einem Tastencode.
   * Dafuer gibt es die Schreibweise „Knopf: id", und die Pruefung unten
   * verlangt fuer sie genauso einen Nachweis wie fuer „Kranz: …".
   */
  KeyK: { wirkung: "Stand speichern", touch: "Knopf: pause-save" },
  KeyZ: { wirkung: "Platz ausbauen", touch: "Menue: AUSBAU" },
  KeyU: { wirkung: "Musik an/aus", touch: "Menue: MUSIK" },
  Escape: { wirkung: "Pause", touch: "Menueknopf oben rechts + Menue: PAUSE" },

  // ---- Ausnahmen: ausdruecklich KEIN Knopf ----
  KeyP: {
    wirkung: "Pause (zweite Taste)",
    touch: null,
    grund:
      "Zweitbelegung derselben Sache — Escape hat den Knopf. Ein zweiter Knopf " +
      "fuer dieselbe Pause waere eine Falle, kein Angebot.",
  },
  KeyH: {
    wirkung: "Hilfe ein/aus",
    touch: null,
    grund:
      "Die Hilfe IST die Tastenliste. Auf dem Geraet steht die Bedienung im " +
      "Pausenmenue (Hinweiszeilen und `pause-controls`), und dort steht sie in " +
      "der Sprache des Geraets: Sticks, Pedale, Kranz.",
  },
  F3: {
    wirkung: "Fehlersuch-Anzeige",
    touch: null,
    grund:
      "Fehlersuche, nicht Spiel. Erreichbar bleibt sie trotzdem: fuenf Finger " +
      "gleichzeitig aufs Glas (`bindDebugGeste`). Ein Knopf im Kranz wuerde " +
      "einen der acht Plaetze fuer etwas belegen, das Patrick nie braucht.",
  },
  KeyL: {
    wirkung: "Stand laden",
    touch: null,
    grund:
      "Im Pausenmenue als `pause-load`. Laden wirft die laufende Runde weg — " +
      "das gehoert hinter zwei Handgriffe, nicht neben den Daumen.",
  },
  KeyN: {
    wirkung: "neues Spiel",
    touch: null,
    grund:
      "Im Pausenmenue als `pause-new`. Loescht den Spielstand; ein Fehlgriff " +
      "im Kranz waere nicht ruecknehmbar.",
  },
};

/**
 * Tasten, die MEHR ALS EINE Sache ausloesen — mit Grund.
 *
 * LEER, und das ist der Stand seit dem 17.09.2026 (E-105). Bis dahin stand
 * hier `KeyK`: E-085 hatte das Seitwaertskippen auf die Taste gelegt, auf der
 * seit dem Prototyp das Speichern liegt (README "Steuerung", Zeile
 * "K/L/N speichern/laden/neu"). Ein Druck tat auf der Tastatur beides. Mit dem
 * Kippen ist auch der Konflikt weg.
 *
 * Die Liste bleibt stehen, samt der Pruefung darunter, die verlangt, dass
 * jeder Eintrag noch doppelt belegt IST. Eine leere Liste ist kein toter Code,
 * sondern die Aussage: Es gibt gerade keinen.
 */
const KONFLIKTE: Record<string, string> = {};

describe("Jede Taste ist auf dem Geraet erreichbar", () => {
  const funde = sammle(quellen());

  it("es werden ueberhaupt Tasten gefunden", () => {
    // Ohne das waere die ganze Datei gruen, wenn das Suchmuster bricht.
    expect(funde.length, "kein einziger Tastencode gefunden").toBeGreaterThan(20);
    expect(new Set(funde.map((f) => f.code)).size).toBeGreaterThan(15);
  });

  it("jede abgefragte Taste steht in der Tabelle", () => {
    const ohne = [...new Set(funde.map((f) => f.code))].filter((c) => !(c in TASTEN));
    expect(
      ohne,
      `neue Taste(n) ohne Eintrag: ${ohne.join(", ")} — Touch-Weg eintragen ` +
        `oder mit Grund auf die Ausnahmeliste setzen`
    ).toEqual([]);
  });

  it("und umgekehrt steht in der Tabelle nichts, was es nicht mehr gibt", () => {
    // Sonst wachsen hier Karteileichen, und die Liste verliert ihren Wert.
    const gefunden = new Set(funde.map((f) => f.code));
    const tot = Object.keys(TASTEN).filter((c) => !gefunden.has(c));
    expect(tot, `Tabellenzeilen ohne Abfrage im Quelltext: ${tot.join(", ")}`).toEqual([]);
  });

  it("jede Ausnahme hat einen Grund, den man vorlesen kann", () => {
    for (const [code, z] of Object.entries(TASTEN)) {
      if (z.touch !== null) continue;
      expect(z.grund, `${code} hat keinen Touch-Weg und keinen Grund`).toBeTruthy();
      expect((z.grund ?? "").length, `${code}: der Grund ist eine Floskel`).toBeGreaterThan(40);
    }
  });

  it("jeder Kranz- und Menueeintrag wird in main.ts auch abgefragt", () => {
    /*
     * DIE ZEILE, AN DER ES GESCHEITERT IST. Ein Eintrag im Kranz legt nur
     * `data-action` auf ein Element; ausgeloest wird er, wenn `main.ts`
     * `touch.consumePress` fragt. Fehlt die Frage, ist der Knopf tot — er
     * blinkt, klickt, vibriert und tut nichts.
     */
    for (const [code, z] of Object.entries(TASTEN)) {
      if (z.touch === null || !/^(Kranz|Menue)/.test(z.touch)) continue;
      expect(
        main.includes(`touch.consumePress("${code}")`),
        `${z.touch} ist ein toter Knopf: main.ts fragt "${code}" nie ueber touch ab`
      ).toBe(true);
    }
  });

  it("jeder direkt verdrahtete Knopf steht auf der Seite und haengt an einem Klick", () => {
    /*
     * Die zweite Art, wie eine Taste auf dem Geraet erreichbar sein kann.
     * `pause-save` traegt keinen Tastencode und taucht in `touch.ts` nicht
     * auf — er ist ein gewoehnlicher Knopf im Pausenfeld mit eigenem
     * Klick-Horcher. Dass er da ist UND gehoert wird, ist genauso pruefbar wie
     * beim Kranz; ohne diese Zeile waere "Knopf: …" eine Behauptung, die
     * niemand nachhaelt.
     */
    let geprueft = 0;
    for (const [code, z] of Object.entries(TASTEN)) {
      const m = /^Knopf: ([\w-]+)/.exec(z.touch ?? "");
      if (!m) continue;
      geprueft++;
      const id = m[1];
      expect(seite.includes(`id="${id}"`), `${code}: den Knopf ${id} gibt es auf der Seite nicht`)
        .toBe(true);
      expect(
        main.includes(`getElementById("${id}")`),
        `${code}: main.ts holt sich ${id} nie — der Knopf tut nichts`
      ).toBe(true);
    }
    expect(geprueft, "kein einziger direkt verdrahteter Knopf in der Tabelle").toBeGreaterThan(0);
  });

  it("und jeder gebundene Knopf gehoert zu einem Eintrag auf der Seite", () => {
    const bindungen = [...touchTs.matchAll(/bindTap\("([\w-]+)",\s*"(\w+)"\)/g)];
    expect(bindungen.length, "keine einzige Knopfbindung gefunden").toBeGreaterThan(8);
    for (const [, id, code] of bindungen) {
      expect(seite.includes(`id="${id}"`), `touch.ts bindet ${id} — auf der Seite gibt es das nicht`)
        .toBe(true);
      expect(
        main.includes(`touch.consumePress("${code}")`),
        `Knopf ${id} schickt "${code}" — main.ts fragt es nie ab`
      ).toBe(true);
    }
  });

  it("und jeder Eintrag auf der Seite ist gebunden", () => {
    // Ein Span ohne `bindTap` bekommt kein `data-action` und wird vom Kranz
    // stillschweigend uebersprungen: ein Eintrag, den man nicht sieht.
    const bereich = seite.slice(
      seite.indexOf('<div class="hidden-actions">'),
      seite.indexOf('<div id="pause">')
    );
    const ids = [...bereich.matchAll(/<span id="([\w-]+)"/g)].map((m) => m[1]);
    expect(ids.length, "keine Eintraege gefunden").toBeGreaterThan(8);
    for (const id of ids) {
      expect(touchTs.includes(`bindTap("${id}"`), `${id} steht auf der Seite, ist aber nicht gebunden`)
        .toBe(true);
    }
  });

  it("keine Taste loest zwei verschiedene Dinge aus", () => {
    /*
     * `input.wasPressed("X")` an zwei Stellen heisst: ein Druck, zwei
     * Wirkungen. Das ist genau dann Absicht, wenn es hier begruendet steht.
     */
    const doppelt = doppelbelegt(funde);
    const unerklaert = doppelt.filter((d) => !(d.code in KONFLIKTE));
    expect(
      unerklaert.map((d) => `${d.code} (${d.pfade.join(" + ")})`),
      "Taste an zwei Stellen abgefragt, ohne Eintrag in KONFLIKTE"
    ).toEqual([]);
    // Und die bekannten Konflikte muessen es noch geben — sonst ist die Liste
    // eine Karteileiche, die den naechsten echten Konflikt durchwinkt.
    for (const code of Object.keys(KONFLIKTE)) {
      expect(
        doppelt.some((d) => d.code === code),
        `${code} steht in KONFLIKTE, ist aber nicht mehr doppelt belegt — Zeile loeschen`
      ).toBe(true);
    }
  });

  /* ------------------------------------------------ Gegenproben ----------- */

  it("GEGENPROBE: eine neue Taste ohne Knopf und ohne Eintrag wird gemeldet", () => {
    const erfunden = sammle([
      { pfad: "src/erfunden.ts", text: 'if (input.wasPressed("Backquote")) hupe();' },
    ]);
    expect(erfunden.map((f) => f.code), "die Suche findet die neue Taste nicht").toEqual([
      "Backquote",
    ]);
    const ohne = erfunden.map((f) => f.code).filter((c) => !(c in TASTEN));
    expect(ohne, "die Pruefung laesst eine unbekannte Taste durch").toEqual(["Backquote"]);
  });

  it("GEGENPROBE: ein Knopf ohne Abfrage in main.ts wird gemeldet", () => {
    // KeyX (Kranz: KABINE) statt KeyK — K ist seit E-105 kein Kranzeintrag mehr.
    const kaputt = main.replace('touch.consumePress("KeyX")', 'false /* weg */');
    expect(kaputt, "die Gegenprobe hat gar nichts veraendert").not.toBe(main);
    expect(
      kaputt.includes('touch.consumePress("KeyX")'),
      "die Pruefung wuerde den toten Knopf nicht bemerken"
    ).toBe(false);
  });

  it("GEGENPROBE: ein Knopf ohne Eintrag auf der Seite wird gemeldet", () => {
    const kaputt = seite.replace('<span id="btn-cab">KABINE</span>', "");
    expect(kaputt, "die Gegenprobe hat gar nichts veraendert").not.toBe(seite);
    expect(kaputt.includes('id="btn-cab"'), "die Pruefung findet den fehlenden Eintrag nicht")
      .toBe(false);
  });

  it("GEGENPROBE: ein direkt verdrahteter Knopf ohne Klick-Horcher wird gemeldet", () => {
    const kaputt = main.replace('getElementById("pause-save")', 'getElementById("gibtsnicht")');
    expect(kaputt, "die Gegenprobe hat gar nichts veraendert").not.toBe(main);
    expect(
      kaputt.includes('getElementById("pause-save")'),
      "die Pruefung wuerde den stummen Knopf nicht bemerken"
    ).toBe(false);
  });

  it("GEGENPROBE: eine zweite Abfrage derselben Taste wird gemeldet", () => {
    const erfunden = sammle([
      { pfad: "src/a.ts", text: 'input.wasPressed("KeyB")' },
      { pfad: "src/b.ts", text: 'input.wasPressed("KeyB")' },
    ]);
    const doppelt = doppelbelegt(erfunden);
    expect(doppelt.map((d) => d.code), "die Doppelbelegung faellt nicht auf").toEqual(["KeyB"]);
    expect(doppelt[0].code in KONFLIKTE, "KeyB steht faelschlich in KONFLIKTE").toBe(false);
  });
});

/** Tasten, die in mehr als einer Datei als Druck abgefragt werden. */
export function doppelbelegt(funde: Fund[]): Array<{ code: string; pfade: string[] }> {
  const nach = new Map<string, Set<string>>();
  for (const f of funde) {
    if (f.art !== "druck") continue;
    const s = nach.get(f.code) ?? new Set<string>();
    s.add(f.pfad);
    nach.set(f.code, s);
  }
  return [...nach.entries()]
    .filter(([, s]) => s.size > 1)
    .map(([code, s]) => ({ code, pfade: [...s].sort() }));
}
