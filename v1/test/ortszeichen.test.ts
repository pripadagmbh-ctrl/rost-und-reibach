/**
 * ORTSZEICHEN (Auftrag 41f, P4b, Patrick 22.10.2026: keine Textboxen —
 * Zeichen am Ort des Geschehens plus Ton).
 *
 * Geprueft je Ereignis: welches Zeichen wo steht (Sprite-Position aus den
 * Lesezugriffen), welcher Ton (Audio-Attrappe), was der Bildschirmleser
 * hoert; dazu Lebensdauer, Bildschirmgroesse, Buendeln „✓ +n", nur Wuerfe
 * des Spielers, Vorrat (nach 1000 Ereignissen nichts Neues), keine
 * sichtbare Textbox.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as THREE from "three";
import { EventBus } from "../src/core/events";
import { HOEHE_PX, LEBEN_S, PLAETZE, UEBER_LASTER_M, WURF_FENSTER_MS, installOrtszeichen } from "../src/ui/ortszeichen";

// ------------------------------------------------------------- Attrappen

/** Eine 2D-Leinwand, die mitschreibt, welche Zahl zuletzt darauf kam */
function leinwand() {
  const texte: string[] = [];
  const ctx = new Proxy({ texte } as Record<string, unknown>, {
    get: (z, f: string) => (f in z ? z[f] : f === "fillText" ? (s: string) => texte.push(s) : f === "clearRect" ? () => texte.splice(0) : () => {}),
    set: (z, f: string, v) => ((z[f] = v), true),
  });
  return { width: 0, height: 0, getContext: () => ctx, texte };
}
type Leinwand = ReturnType<typeof leinwand>;

interface Knoten {
  className: string;
  textContent: string;
  innerHTML: string;
  style: Record<string, string>;
  kinder: Knoten[];
  appendChild(k: Knoten): void;
}
const knoten = (): Knoten => ({
  className: "",
  textContent: "",
  innerHTML: "",
  style: {},
  kinder: [],
  appendChild(k) {
    this.kinder.push(k);
  },
});

const g = globalThis as Record<string, unknown>;
const echt = g.document;
let angelegt: string[];
let seite: Record<string, Knoten>;
beforeEach(() => {
  angelegt = [];
  seite = { "ortszeichen-ansage": knoten(), "btn-kranz": knoten() };
  g.document = {
    createElement: (tag: string) => {
      angelegt.push(tag);
      return tag === "canvas" ? leinwand() : knoten();
    },
    getElementById: (id: string) => seite[id] ?? null,
  };
});
afterEach(() => {
  g.document = echt;
});

function aufbau() {
  const scene = new THREE.Scene();
  const bus = new EventBus();
  const ton: string[] = [];
  const audio = {
    playWrong: () => ton.push("wrong"),
    playRichtig: () => ton.push("richtig"),
    playFunk: (leise?: boolean) => ton.push(leise ? "funk-leise" : "funk"),
    playClawSnap: () => ton.push("snap"),
    playTick: () => ton.push("tick"),
  };
  const greifer = new THREE.Vector3(3, 2, -10);
  const mulden: Record<string, { x: number; y: number; z: number }> = { r_bunt: { x: -7.6, y: 2, z: -19.8 }, r_rubble: { x: -3.5, y: 2, z: -16 } };
  let ms = 10_000;
  const oz = installOrtszeichen({
    bus,
    scene,
    audio,
    greiferOrt: (out) => out.copy(greifer),
    behaelterOrt: (id) => mulden[id] ?? null,
    uhr: () => ms,
  });
  const sprites = () => scene.children.filter((c): c is THREE.Sprite => c instanceof THREE.Sprite);
  const sichtbar = () => sprites().filter((s) => s.visible);
  const zahl = (s: THREE.Sprite) => ((s.material.map!.image as Leinwand).texte.at(-1) ?? null);
  const kamera = new THREE.PerspectiveCamera(55, 812 / 375, 0.1, 500); // SW wie das Spiel: iPhone mini quer
  const renderer = { getSize: (v: THREE.Vector2) => v.set(812, 375) };
  /** Ein Bild zeichnen: jedes sichtbare Sprite bekommt sein onBeforeRender */
  const bild = () => {
    for (const s of sichtbar()) s.onBeforeRender(renderer as never, scene, kamera, s.geometry, s.material, null as never);
  };
  return {
    scene,
    bus,
    ton,
    greifer,
    mulden,
    oz,
    sprites,
    sichtbar,
    zahl,
    kamera,
    bild,
    vor: (dms: number) => (ms += dms),
  };
}

const ansage = () => seite["ortszeichen-ansage"]!.textContent;

// ------------------------------------------------------------- je Ereignis

describe("Ueberlast: rotes Gewicht am Greifer, dumpfer Fehlton", () => {
  it("abgestuetzt: ein Zeichen ueber der Spinne, folgt ihr; playWrong", () => {
    const z = aufbau();
    z.bus.emit("greifer:ueberlast", { massKg: 3000, grenzeKg: 2000, ausladungM: 7, abgestuetzt: true });
    expect(z.sichtbar()).toHaveLength(1);
    const s = z.sichtbar()[0]!;
    expect(s.position.x).toBe(3);
    expect(s.position.y).toBeGreaterThan(2);
    expect(s.position.z).toBe(-10);
    expect(z.zahl(s), "kein Text, keine Zahl").toBeNull();
    expect(z.ton).toEqual(["wrong"]);
    expect(ansage()).toBe("Zu schwer");
    // Die Spinne schwenkt weiter: das Zeichen geht mit
    z.greifer.set(-4, 3, -12);
    z.vor(100);
    z.bild();
    expect(s.position.x).toBe(-4);
    expect(s.position.z).toBe(-12);
  });

  it("frei stehend: dazu das Stuetzen-Bild, nebeneinander", () => {
    const z = aufbau();
    z.bus.emit("greifer:ueberlast", { massKg: 3000, grenzeKg: 2000, ausladungM: 7, abgestuetzt: false });
    const [a, b] = z.sichtbar();
    expect(z.sichtbar()).toHaveLength(2);
    expect(a!.position.equals(b!.position)).toBe(true);
    expect(a!.center.x, "seitlich versetzt").not.toBeCloseTo(b!.center.x, 2);
    expect(z.ton).toEqual(["wrong"]);
    expect(ansage()).toMatch(/abstützen/);
  });
});

describe("Wurf in eine Mulde: ✓ +n oder ✕ — nur fuer Wuerfe des Spielers", () => {
  const rein = (z: ReturnType<typeof aufbau>, containerId: string, correct: boolean, i = 1) =>
    z.bus.emit("itemEntered", { itemId: `t${i}`, materialId: "copper", containerId, correct });

  it("ohne vorheriges released: kein Zeichen, kein Ton (Kipper kippt in die Mulde)", () => {
    const z = aufbau();
    for (let i = 0; i < 20; i++) rein(z, "r_bunt", i % 2 === 0, i);
    expect(z.sichtbar()).toHaveLength(0);
    expect(z.ton).toEqual([]);
    // Und zu lange her zaehlt auch nicht
    z.bus.emit("released", { count: 1 });
    z.vor(WURF_FENSTER_MS + 1);
    rein(z, "r_bunt", true);
    expect(z.sichtbar()).toHaveLength(0);
    // Leeres Oeffnen (count 0) ist kein Wurf
    z.bus.emit("released", { count: 0 });
    rein(z, "r_bunt", true);
    expect(z.sichtbar()).toHaveLength(0);
  });

  it("richtig: ✓ ueber der Mulde, kurz nacheinander zaehlt es hoch (+1, +2, +3) — ein Zeichen, leiser eigener Ton", () => {
    const z = aufbau();
    z.bus.emit("released", { count: 3 });
    rein(z, "r_bunt", true, 1);
    expect(z.sichtbar()).toHaveLength(1);
    const s = z.sichtbar()[0]!;
    expect(s.position.x).toBe(-7.6);
    expect(s.position.z).toBe(-19.8);
    expect(s.position.y).toBeGreaterThan(2);
    expect(z.zahl(s)).toBe("+1");
    z.vor(50);
    rein(z, "r_bunt", true, 2);
    z.vor(300);
    rein(z, "r_bunt", true, 3);
    expect(z.sichtbar(), "gebuendelt, kein zweites Zeichen").toHaveLength(1);
    expect(z.zahl(s)).toBe("+3");
    // Ton: der erste, der zweite 50 ms danach nicht (ein Klingeln fuer einen Schwung), der dritte wieder
    expect(z.ton).toEqual(["richtig", "richtig"]);
    expect(ansage()).toBe("Richtig sortiert");
  });

  it("falsch: ✕ ueber der Mulde, dumpfer Fehlton; die andere Mulde bekommt ihr eigenes Zeichen", () => {
    const z = aufbau();
    z.bus.emit("released", { count: 2 });
    rein(z, "r_bunt", true, 1);
    rein(z, "r_rubble", false, 2);
    expect(z.sichtbar()).toHaveLength(2);
    const muell = z.sichtbar().find((s) => s.position.x === -3.5)!;
    expect(z.zahl(muell)).toBeNull();
    expect(z.ton).toEqual(["richtig", "wrong"]);
    expect(ansage()).toBe("Falsche Mulde");
    // Unbekannte Mulde: nichts
    rein(z, "gibtsnicht", false, 3);
    expect(z.sichtbar()).toHaveLength(2);
  });
});

describe("Lebensdauer und Bildschirmgroesse", () => {
  it("steigt auf, blendet aus, ist nach LEBEN_S weg; 44 px hoch auf dem iPhone mini quer", () => {
    const z = aufbau();
    z.bus.emit("presse:gesperrt", { grund: "laeuft", x: 5, y: 1, z: 5 });
    const s = z.sichtbar()[0]!;
    z.bild();
    const px = (sp: THREE.Sprite) => (sp.scale.y * z.kamera.projectionMatrix.elements[5]! * 375) / 2;
    expect(px(s)).toBeCloseTo(HOEHE_PX, 6);
    expect(s.material.opacity).toBe(1);
    const y0 = s.center.y;
    z.vor(LEBEN_S * 500);
    z.bild();
    expect(s.center.y, "steigt auf (center sinkt = Bild hoeher)").toBeLessThan(y0);
    expect(s.material.opacity).toBe(1);
    z.vor(LEBEN_S * 400);
    z.bild();
    expect(s.material.opacity).toBeGreaterThan(0);
    expect(s.material.opacity).toBeLessThan(1);
    z.vor(LEBEN_S * 100 + 1);
    z.bild();
    expect(s.visible).toBe(false);
    expect(z.sichtbar()).toHaveLength(0);
  });

  it("sizeAttenuation aus, ueber Waenden (depthTest aus)", () => {
    const z = aufbau();
    for (const s of z.sprites()) {
      expect(s.material.sizeAttenuation).toBe(false);
      expect(s.material.depthTest).toBe(false);
    }
  });
});

describe("Teile, Presse, Platz", () => {
  it("teil:werkzeug: Werkzeug-Zeichen am Teil, Zuschnappen", () => {
    const z = aufbau();
    z.bus.emit("teil:werkzeug", { name: "Motorblock", x: 1, y: 0.5, z: 2 });
    const s = z.sichtbar()[0]!;
    expect([s.position.x, s.position.z]).toEqual([1, 2]);
    expect(s.position.y).toBeGreaterThan(0.5);
    expect(z.ton).toEqual(["snap"]);
  });

  it("teil:zerlegt: je Sorte der Bruchstuecke ein Bild, nebeneinander (gleiche Sorte einmal)", () => {
    const z = aufbau();
    z.bus.emit("teil:zerlegt", { materialIds: ["steel", "copper", "copper"], x: 0, y: 1, z: 0 });
    expect(z.sichtbar()).toHaveLength(2);
    const [a, b] = z.sichtbar();
    expect(a!.center.x).not.toBeCloseTo(b!.center.x, 2);
  });

  it("Presse: gesperrt ✕ + Fehlton; gestempelt Paket +n; leer gestempelt ✕ + Fehlton", () => {
    const z = aufbau();
    z.bus.emit("presse:gesperrt", { grund: "nichtInKammer", x: 8, y: 1, z: -26 });
    expect(z.ton).toEqual(["wrong"]);
    z.bus.emit("presse:gestempelt", { teile: 3, x: 8, y: 1, z: -26 });
    expect(z.sichtbar(), "dasselbe Zeichen ueber der Presse").toHaveLength(1);
    expect(z.zahl(z.sichtbar()[0]!)).toBe("+3");
    expect(z.ton).toEqual(["wrong"]);
    z.bus.emit("presse:gestempelt", { teile: 0, x: 8, y: 1, z: -26 });
    expect(z.zahl(z.sichtbar()[0]!)).toBeNull();
    expect(z.ton).toEqual(["wrong", "wrong"]);
  });

  it("inventar:zurueck: je Stueck ein kleiner Pfeil", () => {
    const z = aufbau();
    z.bus.emit("inventar:zurueck", { stuecke: [{ x: 1, y: 0, z: 1 }, { x: 2, y: 0, z: 2 }] });
    expect(z.sichtbar().map((s) => s.position.x)).toEqual([1, 2]);
    z.bild();
    const gross = aufbau();
    gross.bus.emit("presse:gesperrt", { grund: "laeuft", x: 0, y: 0, z: 0 });
    gross.bild();
    expect(z.sichtbar()[0]!.scale.y, "klein").toBeLessThan(gross.sichtbar()[0]!.scale.y);
  });
});

describe("Fuhrpark: Zeichen ueber dem Laster plus Funkton", () => {
  it("bereit: Zeichen an (x, LASTER, z), Funkton, Text an den Bildschirmleser, bleibt laenger", () => {
    const z = aufbau();
    z.bus.emit("fuhrpark:meldung", { text: "Abholer steht bereit.", art: "bereit", x: 4, z: -30 });
    const s = z.sichtbar()[0]!;
    expect([s.position.x, s.position.y, s.position.z]).toEqual([4, UEBER_LASTER_M, -30]);
    expect(z.ton).toEqual(["funk"]);
    expect(ansage()).toBe("Abholer steht bereit.");
    z.vor(LEBEN_S * 1000 + 100);
    z.bild();
    expect(s.visible, "ruhig laenger als ein normales Zeichen").toBe(true);
    // Dieselbe Meldung, solange das Zeichen steht: kein zweiter Funk
    z.bus.emit("fuhrpark:meldung", { text: "Abholer steht bereit.", art: "bereit", x: 4, z: -30 });
    expect(z.ton).toEqual(["funk"]);
    expect(z.sichtbar()).toHaveLength(1);
  });

  it("Bewegung: kein Zeichen, kein Funk — nur der Bildschirmleser; kommtAn klein und leise", () => {
    const z = aufbau();
    for (const art of ["faehrtLos", "faehrtNach", "unterwegs", "muellAb", "muellHolt"] as const) {
      z.bus.emit("fuhrpark:meldung", { text: art, art, x: 0, z: 0 });
      expect(ansage()).toBe(art);
    }
    expect(z.sichtbar()).toHaveLength(0);
    expect(z.ton).toEqual([]);
    z.bus.emit("fuhrpark:meldung", { text: "kommt", art: "kommtAn", x: 0, z: 0 });
    expect(z.sichtbar()).toHaveLength(1);
    expect(z.ton).toEqual(["funk-leise"]);
  });

  it("ohne art: kein Zeichen, kein Ton, nur der Bildschirmleser; art ohne Ort: Funk ohne Zeichen", () => {
    const z = aufbau();
    z.bus.emit("fuhrpark:meldung", { text: "Büro an Bagger: Hallo." });
    expect(z.sichtbar()).toHaveLength(0);
    expect(z.ton).toEqual([]);
    expect(ansage()).toBe("Büro an Bagger: Hallo.");
    z.bus.emit("fuhrpark:meldung", { text: "voll", art: "platzVoll" });
    expect(z.sichtbar()).toHaveLength(0);
    expect(z.ton).toEqual(["funk"]);
  });

  it("jeder wichtige Anlass hat ein Zeichen", () => {
    for (const art of ["bereit", "wartetLager", "blockiertBagger", "blockiertDing", "siloGasse", "muellPlatz", "platzVoll", "abholerKommt"] as const) {
      const z = aufbau();
      z.bus.emit("fuhrpark:meldung", { text: art, art, x: 1, z: 1 });
      expect(z.sichtbar(), art).toHaveLength(1);
      expect(z.ton, art).toEqual(["funk"]);
    }
  });

  it("fuhrpark:abholerLeer: Laster mit 0 ueber dem Abholer, Fehlton", () => {
    const z = aufbau();
    z.bus.emit("fuhrpark:abholerLeer", { x: 6, z: -28 });
    const s = z.sichtbar()[0]!;
    expect([s.position.x, s.position.y, s.position.z]).toEqual([6, UEBER_LASTER_M, -28]);
    expect(z.zahl(s)).toBe("0");
    expect(z.ton).toEqual(["wrong"]);
  });
});

describe("Quittung am Kranz-Knopf", () => {
  it("nein: ✕ am Knopf + Fehlton; uhr: Uhr + Klick — dieselbe Marke, kein Weltzeichen", () => {
    const z = aufbau();
    z.bus.emit("bedienung:quittung", { code: "KeyV", zeichen: "nein" });
    const kranz = seite["btn-kranz"]!;
    expect(kranz.kinder).toHaveLength(1);
    expect(kranz.kinder[0]!.className).toBe("oz-quittung an nein");
    expect(kranz.kinder[0]!.innerHTML).toMatch(/^<svg/);
    expect(z.ton).toEqual(["wrong"]);
    z.bus.emit("bedienung:quittung", { code: "KeyV", zeichen: "uhr" });
    expect(kranz.kinder).toHaveLength(1);
    expect(kranz.kinder[0]!.className).toBe("oz-quittung an uhr");
    expect(z.ton).toEqual(["wrong", "tick"]);
    expect(z.sichtbar()).toHaveLength(0);
    expect(ansage()).toBe("Vorgemerkt");
  });
});

describe("Vorrat und keine Textbox", () => {
  it("nach 1000 gemischten Ereignissen: keine neuen Netze, Materialien, Texturen, DOM-Knoten", () => {
    const z = aufbau();
    const zaehle = () => {
      const mats = new Set<THREE.Material>();
      const tex = new Set<THREE.Texture>();
      z.scene.traverse((o) => {
        const s = o as THREE.Sprite;
        if (s.material) {
          mats.add(s.material);
          if (s.material.map) tex.add(s.material.map);
        }
      });
      return { netze: z.scene.children.length, mats: mats.size, tex: tex.size };
    };
    const vorher = zaehle();
    expect(vorher).toEqual({ netze: PLAETZE, mats: PLAETZE, tex: PLAETZE });
    z.bus.emit("bedienung:quittung", { code: "KeyV", zeichen: "nein" }); // die eine Marke am Knopf
    const dom0 = angelegt.length;
    for (let i = 0; i < 1000; i++) {
      z.vor(37);
      switch (i % 7) {
        case 0:
          z.bus.emit("released", { count: 1 });
          z.bus.emit("itemEntered", { itemId: `t${i}`, materialId: "copper", containerId: i % 2 ? "r_bunt" : "r_rubble", correct: i % 3 > 0 });
          break;
        case 1:
          z.bus.emit("greifer:ueberlast", { massKg: 3000, grenzeKg: 2000, ausladungM: 7, abgestuetzt: i % 2 === 0 });
          break;
        case 2:
          z.bus.emit("teil:zerlegt", { materialIds: ["steel", "copper", "mixed", "battery"], x: i, y: 0, z: 0 });
          break;
        case 3:
          z.bus.emit("fuhrpark:meldung", { text: "x", art: "blockiertDing", x: 0, z: i });
          break;
        case 4:
          z.bus.emit("inventar:zurueck", { stuecke: Array.from({ length: 20 }, (_, k) => ({ x: k, y: 0, z: 0 })) });
          break;
        case 5:
          z.bus.emit("presse:gestempelt", { teile: i % 4, x: 0, y: 0, z: 0 });
          break;
        default:
          z.bus.emit("bedienung:quittung", { code: "KeyJ", zeichen: i % 2 ? "nein" : "uhr" });
      }
      z.bild();
    }
    expect(zaehle()).toEqual(vorher);
    expect(angelegt.length, "keine DOM-Knoten nach der ersten Quittung").toBe(dom0);
    expect(z.sichtbar().length).toBeLessThanOrEqual(PLAETZE);
  });

  it("keine sichtbare Textbox: das Modul legt nur Leinwaende und die eine Knopf-Marke an; die Ansage ist unsichtbar", () => {
    const z = aufbau();
    z.bus.emit("fuhrpark:meldung", { text: "Büro an Bagger: Stell den Müll-Container an seinen Platz.", art: "muellPlatz", x: 0, z: 0 });
    z.bus.emit("bedienung:quittung", { code: "KeyV", zeichen: "nein" });
    expect(angelegt.filter((t) => t !== "canvas")).toEqual(["span"]);
    expect(angelegt.filter((t) => t === "canvas")).toHaveLength(PLAETZE);
    const html = readFileSync(resolve(__dirname, "../index.html"), "utf8");
    expect(html).toMatch(/<div id="ortszeichen-ansage" class="nur-leser" aria-live="polite"/);
    expect(html).toMatch(/\.nur-leser \{[^}]*clip-path: inset\(50%\)/);
    // Text in der Welt nur als Zahl: jede Zeichnung auf einer Leinwand ist +n oder 0
    for (const s of z.sprites()) for (const t of (s.material.map!.image as Leinwand).texte) expect(t).toMatch(/^(\+\d+|0)$/);
  });

  it("neuBeschriften schreibt die letzte Ansage in der eingestellten Sprache neu", () => {
    const z = aufbau();
    z.bus.emit("greifer:ueberlast", { massKg: 3000, grenzeKg: 2000, ausladungM: 7, abgestuetzt: true });
    seite["ortszeichen-ansage"]!.textContent = "";
    z.oz.neuBeschriften();
    expect(ansage()).toBe("Zu schwer");
  });

  it("Messung: drei Zeichen gleichzeitig = drei Sprites = drei Zeichenaufrufe", () => {
    const z = aufbau();
    z.bus.emit("released", { count: 2 });
    z.bus.emit("itemEntered", { itemId: "a", materialId: "copper", containerId: "r_bunt", correct: true });
    z.bus.emit("itemEntered", { itemId: "b", materialId: "copper", containerId: "r_rubble", correct: false });
    z.bus.emit("greifer:ueberlast", { massKg: 3000, grenzeKg: 2000, ausladungM: 7, abgestuetzt: true });
    expect(z.sichtbar()).toHaveLength(3);
  });
});
