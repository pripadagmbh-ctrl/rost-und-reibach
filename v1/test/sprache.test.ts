/**
 * Sprache (E-170): Start-Sprache, Übersetzen, und die Wächter
 * „kein deutscher Text, wenn Englisch an ist" und „kein fehlender Schlüssel".
 *
 * Ohne Browser gibt es keinen echten DOM-Durchlauf. Stattdessen werden alle
 * Quellen sichtbarer Texte hier eingesammelt — die Seite, die Kataloge, die
 * Meldungen — und durch dieselbe Übersetzung geschickt, die im Spiel der
 * Beobachter benutzt (`nachEnglisch`).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ermittleSprache, nachEnglisch, setzeSprache, sprache, t } from "../src/ui/sprache";
import { EN } from "../src/ui/texte_en";
import { FUNCTION_LABELS, AXIS_LABELS } from "../src/core/controlConfig";
import { STATIONEN, hoerZeile } from "../src/audio/hoerparcours";
import { SENDER } from "../src/audio/songs";
import { naechsterSender, senderAnsage, senderListe } from "../src/ui/radio";
import { griffLadung, griffZiel } from "../src/ui/hud";

const wurzel = resolve(__dirname, "..");
const lies = (p: string): string => readFileSync(resolve(wurzel, p), "utf8");

/**
 * Sieht ein Text deutsch aus? Umlaute, ß und eine Handvoll Wörter, die es im
 * Englischen nicht gibt. Grob, aber genug für einen Wächter: Ein halb
 * übersetzter Satz fällt auf.
 */
const DEUTSCH =
  /[äöüÄÖÜß]|\b(der|das|und|nicht|ist|mit|für|ein|eine|zum|zur|auf|wird|noch|erst|kein|oder|Spinne|Greifer|Mulde|Schere|Stiel|Ausleger|Fahren|Teile?)\b/;
const sprachfrei = (s: string): boolean => !/[A-Za-zÄÖÜäöüß]{2,}/.test(s);

function mussUebersetztSein(texte: Iterable<string>, woher: string): void {
  const fehlt: string[] = [];
  const halb: string[] = [];
  for (const de of new Set(texte)) {
    if (sprachfrei(de)) continue;
    const en = nachEnglisch(de);
    const kern = de.replace(/\s+/g, " ").trim();
    if (en === de && EN[kern] === undefined) fehlt.push(kern);
    else if (DEUTSCH.test(en)) halb.push(`${kern} → ${en.trim()}`);
  }
  expect(fehlt, `${woher}: kein englischer Eintrag`).toEqual([]);
  expect(halb, `${woher}: englisch, aber noch deutsch`).toEqual([]);
}

afterEach(() => setzeSprache("de"));

describe("Start-Sprache", () => {
  it("gemerkte Wahl geht vor dem Gerät", () => {
    expect(ermittleSprache("en", "de-DE")).toBe("en");
    expect(ermittleSprache("de", "en-US")).toBe("de");
  });
  it("sonst das Gerät: deutsch nur bei de-*, alles andere englisch", () => {
    expect(ermittleSprache(null, "de-DE")).toBe("de");
    expect(ermittleSprache(null, "de")).toBe("de");
    expect(ermittleSprache(null, "de-AT")).toBe("de");
    expect(ermittleSprache(null, "en-GB")).toBe("en");
    expect(ermittleSprache(null, "fr-FR")).toBe("en");
    expect(ermittleSprache(null, undefined)).toBe("en");
    expect(ermittleSprache("kaputt", "nl-NL")).toBe("en");
  });
  it("ohne Seite (Vitest) gilt Deutsch, t() gibt den Text unverändert zurück", () => {
    expect(sprache()).toBe("de");
    expect(t("Gespeichert.")).toBe("Gespeichert.");
  });
  it("umschalten wirkt sofort auf t() und ohne Speicher (try/catch)", () => {
    setzeSprache("en");
    expect(t("Gespeichert.")).toBe("Saved.");
    setzeSprache("de");
    expect(t("Gespeichert.")).toBe("Gespeichert.");
  });
});

describe("Übersetzen", () => {
  it("ganzer Satz aus dem Wörterbuch, Leerraum am Rand bleibt", () => {
    expect(nachEnglisch("Gespeichert.")).toBe("Saved.");
    expect(nachEnglisch("\n   Gespeichert.  ")).toBe("\n   Saved.  ");
  });
  it("Unbekanntes bleibt, wie es ist", () => {
    expect(nachEnglisch("Already English")).toBe("Already English");
    expect(nachEnglisch("↺")).toBe("↺");
  });
  it("Muster: Zahlen mit Punkt, Namen und Listen übersetzt", () => {
    const faelle: Array<[string, string]> = [
      ["Greifer → Fünfschalengreifer", "Grapple → Orange peel grapple"],
      ["Lasthebemagnet angebaut.", "Lifting magnet fitted."],
      [
        "Zu schwer: 3,2 t – hier hebt die Maschine 2,1 t. Abstützen (O) und näher greifen.",
        "Too heavy: 3.2 t – the machine lifts 2.1 t here. Lower the outriggers (O) and grab closer.",
      ],
      [
        "Zu schwer: 9,0 t – hier hebt die Maschine 5,5 t. Näher am Bagger greifen.",
        "Too heavy: 9.0 t – the machine lifts 5.5 t here. Grab it closer to the machine.",
      ],
      ["Zerlegt: Kupfer + Kabel + Holz", "Taken apart: Copper + Cable + Wood"],
      ["Kühlschrank braucht Werkzeug.", "Fridge needs tools."],
      ["Das Teil braucht Werkzeug.", "The part needs tools."],
      ["Mischschrott zusammengedrückt", "Mixed scrap crushed"],
      ["Presse: 3 Teile zum Paket gepresst", "Press: 3 parts pressed into a bale"],
      ["Presse: 1 Teil zum Paket gepresst", "Press: 1 part pressed into a bale"],
      ["Reifen, Felge liegt wieder auf dem Platz", "Tyres, Wheel rim is back in the yard"],
      ["12 Kleinteile zu Bündeln zusammengefasst", "12 small parts bundled together"],
      ["Mehrfach belegt: Spinne drehen, Hauptarm heben/senken", "Assigned more than once: Rotate grapple, Raise/lower boom"],
    ];
    for (const [de, en] of faelle) expect(nachEnglisch(de), de).toBe(en);
  });
  it("keine Kette: kein englischer Text ist selbst ein anderer deutscher Schlüssel", () => {
    const ketten = Object.entries(EN).filter(([de, en]) => en !== de && EN[en] !== undefined && EN[en] !== en);
    expect(ketten).toEqual([]);
  });
});

describe("Wächter: kein deutscher Text auf der Seite, wenn Englisch an ist", () => {
  const seite = lies("index.html");
  const body = seite
    .slice(seite.indexOf("<body>"))
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    // translate="no" ist absichtlich zweisprachig (Sprachknopf)
    .replace(/<(\w+)[^>]*translate="no"[^>]*>[\s\S]*?<\/\1>/g, "");
  const entity = (s: string): string =>
    s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

  it("jeder Text zwischen den Tags", () => {
    const texte = [...body.matchAll(/>([^<]+)</g)].map((m) => entity(m[1]));
    expect(texte.length).toBeGreaterThan(50);
    mussUebersetztSein(texte, "index.html");
  });
  it("title, aria-label und der Seitentitel", () => {
    const attr = [...body.matchAll(/\s(?:title|aria-label|placeholder)="([^"]+)"/g)].map((m) => entity(m[1]));
    const titel = entity(/<title>([^<]+)<\/title>/.exec(seite)![1]); // „Rost &amp; Reibach" (E-173)
    mussUebersetztSein([...attr, titel], "Attribute");
  });
  it("Pausenknöpfe bleiben auch auf Englisch unter 30 Zeichen (iPhone mini, zweispaltig)", () => {
    const knoepfe = [...body.matchAll(/<button id="pause-[\w-]+">([^<]+)<\/button>/g)].map((m) => nachEnglisch(m[1]).trim());
    for (const k of knoepfe) expect(k.length, k).toBeLessThanOrEqual(30);
  });
  it("Funktionskranz: kein englischer Eintrag länger als der längste deutsche", () => {
    const kranz = [...seite.matchAll(/<span id="btn-[\w-]+">([^<]+)<\/span>/g)].map((m) => m[1].trim());
    const laengsterDe = Math.max(...kranz.map((k) => k.length));
    for (const k of kranz) expect(nachEnglisch(k).length, `${k} → ${nachEnglisch(k)}`).toBeLessThanOrEqual(laengsterDe);
  });
});

describe("Wächter: kein fehlender Schlüssel in den Katalogen", () => {
  const namen = (datei: string, feld = "name"): string[] =>
    [...lies(datei).matchAll(new RegExp(`\\b${feld}: *"([^"]+)"`, "g"))].map((m) => m[1]);

  it("Fraktionen, Schrottstücke, Großteile, Wrackteile, Greifer", () => {
    for (const datei of [
      "src/materials/catalog.ts",
      "src/world/scrapItems.ts",
      "src/world/objektkatalog.ts",
      "src/dismantle/carDef.ts",
      "src/dismantle/wrackformen.ts",
      "src/excavator/greiferFuenfschalen.ts",
      "src/excavator/magnet.ts",
    ]) {
      const n = namen(datei);
      expect(n.length, datei).toBeGreaterThan(0);
      mussUebersetztSein(n, datei);
    }
  });
  it("Muldenschilder", () => {
    mussUebersetztSein([...namen("src/world/containers.ts", "label"), ...namen("src/world/containers.ts", "schrift")].filter(
      (l) => l === l.toUpperCase() && !l.includes("Startplatz")
    ), "containers.ts");
  });
});

describe("Wächter: Meldungen und Menüs aus dem Spiel", () => {
  it("jeder feste Satz in hud.toast(…) von main.ts — außer Betrieb-Meldungen", () => {
    const main = lies("src/main.ts");
    const saetze: string[] = [];
    for (let i = main.indexOf("hud.toast("); i >= 0; i = main.indexOf("hud.toast(", i + 1)) {
      let tiefe = 0;
      let j = i + "hud.toast".length;
      for (; j < main.length; j++) {
        if (main[j] === "(") tiefe++;
        else if (main[j] === ")" && --tiefe === 0) break;
      }
      // nur ganze Literale "…", keine Teile aus `…${…}…`
      const aufruf = main.slice(i, j).replace(/`[^`]*`/g, "");
      for (const m of aufruf.matchAll(/"([^"]+)"/g)) saetze.push(m[1]);
    }
    /*
     * Im Simulator abgeschaltet (E-118, `BETRIEB`): Lambert, Kasse, Händler.
     * Kommt der Betrieb zurück, gehören sie ins Wörterbuch — dann hier streichen.
     */
    const nurBetrieb = new Set([
      "Lambert kommt und räumt die Boxen leer.",
      "Lambert ist schon dabei.",
      "Lambert winkt ab — in den Boxen liegt nichts für ihn.",
      "Konto leer — es liefert niemand mehr. Erst verkaufen, dann ankaufen!",
      "Wieder zahlungsfähig — die Händler kommen zurück.",
      "Container war leer — der LKW fährt umsonst.",
      "Fahrspur wieder frei.",
      " — Arbeit für Lambert",
      " — freiräumen!",
      // Vergleichswerte im Code, keine Texte
      "vorgemerkt",
      "kommt",
      "schon unterwegs",
    ]);
    // P4b (22.10.2026): die erreichbaren Textboxen sind Zeichen geworden — es bleiben die Betrieb-Meldungen und „Speichern fehlgeschlagen!"
    expect(saetze.length).toBeGreaterThan(8);
    mussUebersetztSein(saetze.filter((s) => !nurBetrieb.has(s)), "main.ts");
  });
  it("Nachschub-Meldungen und Pressen-Sperrgrund", () => {
    const n = [...lies("src/delivery/nachschub.ts").matchAll(/"(Nachschub: [^"]+)"/g)].map((m) => m[1]);
    expect(n.length).toBe(7);
    const p = [...lies("src/world/press.ts").matchAll(/sperrgrund = "([^"]+)"/g)].map((m) => m[1]);
    mussUebersetztSein([...n, ...p], "nachschub/press");
  });
  it("Steuerungsmenü, Greiferwahl", () => {
    mussUebersetztSein([...Object.values(FUNCTION_LABELS), ...Object.values(AXIS_LABELS), "erst ablegen"], "Steuerung");
  });
  it("Radio: Liste, Ansagen, Sender-Beschreibungen (Sendernamen sind Eigennamen)", () => {
    const texte: string[] = [];
    for (const an of [true, false]) {
      for (const e of senderListe(SENDER[0]!.id, an)) texte.push(e.stand, e.beschreibung);
      texte.push(senderAnsage(SENDER[1]!, an));
    }
    texte.push(naechsterSender(SENDER[SENDER.length - 1]!.id, true).ansage);
    texte.push(`${SENDER.length} Sender, alle selbst gespielt. MUSIK schaltet weiter.`, "Radio ist aus — der gewählte Sender bleibt still.");
    // Eigennamen dürfen bleiben — gezählt wird, was um sie herum steht
    const ohneNamen = (s: string): string => SENDER.reduce((a, x) => a.replace(x.sender, "Sender"), s);
    for (const de of texte) {
      const en = nachEnglisch(de);
      expect(en, `Radio: "${de}" nicht übersetzt`).not.toBe(sprachfrei(de) ? "_" : de);
      expect(DEUTSCH.test(ohneNamen(en)), `Radio: "${en}"`).toBe(false);
    }
  });
  it("Hörprobe: jede Station", () => {
    for (const s of STATIONEN) {
      const en = nachEnglisch(hoerZeile(s, 1));
      expect(en.startsWith("Sound test"), en).toBe(true);
      expect(DEUTSCH.test(en), en).toBe(false);
    }
  });
  it("Griff-Info auf Englisch: Name, Fraktion, Ladung", () => {
    setzeSprache("en");
    const ziel = griffZiel({ materialId: "mixed", massKg: 55, shape: { name: "Kühlschrank" } }, false).kopf;
    expect(ziel).toBe("▼ Fridge (Mixed scrap) · 55 kg");
    const ladung = griffLadung(
      [
        { materialId: "steel", massKg: 300, shape: { name: "Doppel-T-Träger" } },
        { materialId: "copper", massKg: 5 },
        { materialId: "copper", massKg: 5 },
      ],
      null
    );
    expect(ladung.kopf).toBe("Grapple: 310 kg");
    expect(ladung.liste).toBe("I-beam (Steel scrap), 2× Copper");
  });
});
