/**
 * ORTSZEICHEN (Auftrag 41f, P4b, Patrick 22.10.2026: „kein Fan von diesen
 * Textboxen … nimmt ja sowieso auch immer sehr viel Sichtfläche weg").
 *
 * Statt einer Meldezeile ein kurzes Zeichen DORT, wo es passiert, plus Ton:
 * rotes Gewicht am Greifer, ✕ über der falschen Mulde, ✓ +3 über der
 * richtigen, Paket über der Presse, Zeichen über dem Laster. Vergleich: der
 * Einweiser auf der Baustelle — er ruft nicht quer über den Platz, er hebt
 * die Hand dort, wo es klemmt.
 *
 *  - Kein Text in der Welt ausser Zahlen („+3"). Farbe ist nie der einzige
 *    Kanal: jedes Zeichen hat eine eigene FORM.
 *  - Konstante Bildschirmgroesse (`sizeAttenuation: false`, `HOEHE_PX`), damit
 *    es auf dem iPhone mini quer genauso lesbar ist wie aus der Naehe; ueber
 *    Waenden sichtbar (`depthTest: false`, wie der Pfeil der Zielmarke).
 *  - Steigt leicht auf und blendet aus (`LEBEN_S`). Das Aufsteigen laeuft im
 *    Bildschirm (`center.y`), nicht in Metern — gleich weit, ob nah oder fern.
 *  - Vorrat: `PLAETZE` Sprites mit je eigener kleiner Leinwand, einmal
 *    angelegt. Ein Ereignis malt die Leinwand neu; je Bild wird nichts
 *    angelegt. Ein sichtbares Zeichen = ein Zeichenaufruf.
 *  - Bildschirmleser: eine unsichtbare `aria-live`-Zeile (`#ortszeichen-ansage`)
 *    bekommt den Text der Fuhrpark-Meldung bzw. eine kurze Beschreibung.
 *
 * Haengt nur am Bus (Regel 10). Weltorte, die das Ereignis nicht traegt
 * (Greifer, Mulde), kommen ueber Lesezugriffe bei der Installation.
 */
import * as THREE from "three";
import type { EventBus, FuhrparkArt } from "../core/events";
import { AMPEL_ZEICHEN, SORTEN, bildFarbe, farbeCss, sorteVonMaterial, zeichnePfade, type SorteId } from "../materials/sorten";
import { sprache, t } from "./sprache";

/** Hoehe eines Zeichens auf dem Bildschirm (CSS-Pixel). SW: 44 px — Tippziel-Mass, auf dem iPhone mini quer (375 px hoch) ein Achtel */
export const HOEHE_PX = 44;
/** Kleine Zeichen (Bewegung, Kleinkram): so viel davon. SW */
const KLEIN = 0.7;
/** Lebensdauer (s). SW: 2 s — lang genug fuer einen Blick, kurz genug gegen Zeichenregen (Auftrag: 1,5–3 s) */
export const LEBEN_S = 2;
/** Ruhige Meldungen (Abholer bereit, Pritsche wartet) bleiben laenger. SW */
const LEBEN_LANG_S = 3;
/** So weit steigt ein Zeichen in seiner Lebenszeit, in Zeichenhoehen. SW: 0,6 = rund 26 px */
const AUFSTIEG = 0.6;
/** Ab diesem Anteil der Lebenszeit blendet es aus. SW */
const AUSBLENDEN_AB = 0.6;
/** So viele Zeichen gleichzeitig. SW: sechs Mulden + Greifer + Presse + Laster + Luft; ist alles belegt, weicht das aelteste */
export const PLAETZE = 12;
/** Ein Wurf zaehlt als Wurf des Spielers, wenn so kurz vorher losgelassen wurde (ms). SW: 4 s — Flug + Rollen in der Mulde */
export const WURF_FENSTER_MS = 4000;
/** Richtig-Ton hoechstens so oft (ms) — fuenf Teile auf einmal klingeln einmal. SW */
const RICHTIG_ABSTAND_MS = 150;
/** Ueber der Muldenkante, ueber dem Greifer, ueber dem Laster (m). SW: Laster rund 3,5 m hoch */
const UEBER_MULDE_M = 0.3;
/** Ueber der Mulde: ueber ihrem Bildschild, damit das Schild lesbar bleibt (Bild 22.10.: bei 0,3 m deckte ✕ das MÜLL-Schild zu). SW */
const UEBER_SCHILD_M = 1.9;
const UEBER_GREIFER_M = 0.8;
export const UEBER_LASTER_M = 4.2;
/** Kranz-Knopf: so lange steht die Quittung daran (ms). SW */
const QUITTUNG_MS = 1200;
/** Zerlegt: hoechstens so viele Sortenbilder nebeneinander; zurueck an den Platz: so viele Pfeile. SW */
const ZERLEGT_MAX = 3;
const ZURUECK_MAX = 6;

/** Leinwand je Zeichen: 2 : 1 — links das Bild, rechts die Zahl (ohne Zahl Bild mittig). Pixel SW: 44 px × Pixeldichte 3 ≈ 132 */
const LW_B = 256;
const LW_H = 128;

/* ----------------------------------------------------------------- Bilder -- */

/** Bild eines Zeichens: Pfade im 24er-Raster (wie `materials/sorten.ts`), Grundfarbe der Plakette, Strichfarbe. */
interface Bild {
  pfade: readonly string[];
  grund: number;
  strich: number;
}
const ROT = 0xc62828; // SW: Signalrot, Weiss darauf 5,6 : 1
const GRUEN = 0x1e7b3a; // SW: Gruen wie ✓, Weiss darauf 5,4 : 1
const BERNSTEIN = 0xe69f00; // Okabe-Ito Orange (wie sorten.ts), Schwarz darauf
const SCHIEFER = 0x3d4852; // SW: neutral, Weiss darauf
const WEISS = 0xffffff;
const SCHWARZ = 0x000000;

/*
 * Formen: ✓ und ✕ aus der Ampel am Schild (sorten.ts), Gewicht/Stuetzen/Paket
 * wie die Lehrgangsleiste (`BILD.last`, `BILD.stuetzen`, `BILD.pressen` in
 * lektionskarte.ts), Rechtecke als Pfad geschrieben. Neu: Werkzeug
 * (Schraubenschluessel), Pfeil nach unten, Uhr, Laster, Laden (Pfeil in die
 * Pritsche), Sperre (Bake), Tor, Voll (gestapelt bis oben), Bagger (wie
 * `BILD.fahren`).
 */
const LASTER = ["M2 6h11v10H2z", "M13 9h4.5l3.5 4v3h-8z", "M4.5 18a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0", "M15 18a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0"];
const BILDER = {
  ok: { pfade: AMPEL_ZEICHEN.green, grund: GRUEN, strich: WEISS },
  nein: { pfade: AMPEL_ZEICHEN.red, grund: ROT, strich: WEISS },
  last: { pfade: ["M9 8.5a3 3 0 1 1 6 0", "M6.5 8.5h11L21 21H3z"], grund: ROT, strich: WEISS },
  stuetzen: { pfade: ["M7 5h10v6H7z", "M8 10L4 18M16 10l4 8M2 19h4M18 19h4"], grund: BERNSTEIN, strich: SCHWARZ },
  werkzeug: {
    pfade: ["M15 3a5 5 0 0 0-4.6 6.9L3 17.3 6.7 21l7.4-7.4A5 5 0 0 0 21 9l-3 3-3-3 3-3a5 5 0 0 0-3-3z"],
    grund: BERNSTEIN,
    strich: SCHWARZ,
  },
  paket: { pfade: ["M4 8l8-4 8 4v8l-8 4-8-4z", "M4 8l8 4 8-4M12 12v8", "M8 6v8M16 6v8"], grund: SCHIEFER, strich: WEISS },
  runter: { pfade: ["M12 4v15", "M6 13l6 6 6-6"], grund: SCHIEFER, strich: WEISS },
  uhr: { pfade: ["M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0", "M12 7v5l3.5 2"], grund: BERNSTEIN, strich: SCHWARZ },
  laster: { pfade: LASTER, grund: SCHIEFER, strich: WEISS },
  laden: { pfade: ["M12 2v8", "M8.5 6.5L12 10l3.5-3.5", "M3 12h18l-2 6H5z", "M7 21h2M15 21h2"], grund: GRUEN, strich: WEISS },
  sperre: { pfade: ["M3 8h18v6H3z", "M8 8l-4 6M13 8l-4 6M18 8l-4 6", "M6 14v7M18 14v7"], grund: ROT, strich: WEISS },
  bagger: {
    pfade: ["M3.5 18a3 3 0 1 0 6 0a3 3 0 1 0-6 0", "M14.5 18a3 3 0 1 0 6 0a3 3 0 1 0-6 0", "M2 14h20", "M4 14v-4h7l2 4", "M12 11l5-6 3 3"],
    grund: ROT,
    strich: WEISS,
  },
  tor: { pfade: ["M3 21V4h18v17", "M3 8h18", "M8 8v13M12 8v13M16 8v13"], grund: BERNSTEIN, strich: SCHWARZ },
  voll: { pfade: ["M4 4h16v17H4z", "M4 9.5h16M4 15h16"], grund: ROT, strich: WEISS },
} as const satisfies Record<string, Bild>;
type BildId = keyof typeof BILDER;

const sortenBild = (s: SorteId): Bild => ({ pfade: SORTEN[s].bild, grund: SORTEN[s].farbe, strich: bildFarbe(s) });

/**
 * Was ein Fuhrpark-Anlass zeigt (Auftrag 41f, Antwort 6). `null` = kein Zeichen:
 * Bewegungsmeldungen — der Laster faehrt sichtbar los, ein Zeichen ueber jedem
 * fahrenden Laster waere Zeichenregen und sagte nichts, was man nicht sieht;
 * sie gehen nur an den Bildschirmleser. `kommtAn` und `platzFrei` sind
 * klein und leise (gut zu wissen, nichts zu tun). Wichtig (der Spieler muss
 * etwas tun oder warten) ist gross, mit vollem Funkton.
 */
export const FUHRPARK_ZEICHEN: Readonly<Record<FuhrparkArt, { bild: BildId | { sorte: SorteId }; klein?: boolean; lang?: boolean } | null>> = {
  faehrtLos: null,
  faehrtNach: null,
  unterwegs: null,
  muellAb: null,
  muellHolt: null,
  kommtAn: { bild: "laster", klein: true },
  platzFrei: { bild: "ok", klein: true },
  bereit: { bild: "laden", lang: true },
  wartetLager: { bild: "uhr", lang: true },
  blockiertBagger: { bild: "bagger" },
  blockiertDing: { bild: "sperre" },
  siloGasse: { bild: "tor" },
  muellPlatz: { bild: { sorte: "muell" } },
  platzVoll: { bild: "voll" },
  abholerKommt: { bild: "laster" },
};

/** Kurzbeschreibung fuer den Bildschirmleser (die Welt zeigt nur Zeichen). Neutral, 2–4 Woerter. */
const ANSAGE = {
  last: { de: "Zu schwer", en: "Too heavy" },
  stuetzen: { de: "Zu schwer – abstützen", en: "Too heavy – outriggers" },
  ok: { de: "Richtig sortiert", en: "Sorted correctly" },
  nein: { de: "Falsche Mulde", en: "Wrong skip" },
  werkzeug: { de: "Braucht Werkzeug", en: "Needs a tool" },
  zerlegt: { de: "Zerlegt", en: "Taken apart" },
  presseNein: { de: "Presse geht gerade nicht", en: "Press not available" },
  paket: { de: "Paket gepresst", en: "Bale pressed" },
  presseLeer: { de: "Presse war leer", en: "Press was empty" },
  zurueck: { de: "Wieder an seinem Platz", en: "Back in place" },
  abholerLeer: { de: "Abholer ist noch leer", en: "Truck is still empty" },
  quittNein: { de: "Geht gerade nicht", en: "Not right now" },
  quittUhr: { de: "Vorgemerkt", en: "Queued" },
} as const;
type AnsageId = keyof typeof ANSAGE;

/* ---------------------------------------------------------------- Modul -- */

/** Was das Modul vom Ton braucht (AudioManager) — mehr nicht. */
export interface OrtszeichenTon {
  playWrong(): void;
  playRichtig(): void;
  playFunk(leise?: boolean): void;
  playClawSnap(haerte?: number): void;
  playTick(): void;
}

export interface OrtszeichenOpt {
  bus: EventBus;
  scene: THREE.Scene;
  audio: OrtszeichenTon;
  /** Wo die Spinne gerade ist (schreibt in `out`, gibt es zurueck) — das Ueberlast-Zeichen folgt ihr */
  greiferOrt: (out: THREE.Vector3) => THREE.Vector3;
  /** Mitte und Oberkante eines Behaelters (y = Wandkrone), null = unbekannt */
  behaelterOrt: (containerId: string) => { x: number; y: number; z: number } | null;
  /** Uhr in ms (Tests); sonst `performance.now()` */
  uhr?: () => number;
}

export interface Ortszeichen {
  /** Sprache gewechselt: die Ansage-Zeile neu schreiben */
  neuBeschriften(): void;
}

interface Platz {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  tex: THREE.CanvasTexture;
  g: CanvasRenderingContext2D | null;
  t0: number;
  bis: number;
  /** Schluessel zum Buendeln („mulde:r_bunt"), null = keiner */
  schluessel: string | null;
  n: number;
  groesse: number;
  folge: boolean;
  /** Seitlicher Versatz in Zeichenbreiten (mehrere Zeichen am selben Ort) */
  versatz: number;
  /** Wo im Sprite der Ort liegt: 0,5 = Mitte (Bild mittig), 0,25 = Mitte des Bilds, wenn rechts eine Zahl steht */
  mitteX: number;
}

export function installOrtszeichen(o: OrtszeichenOpt): Ortszeichen {
  const { bus, scene, audio } = o;
  const jetzt = o.uhr ?? ((): number => performance.now());
  const doc = typeof document !== "undefined" ? document : null;

  const groesse = new THREE.Vector2();
  const plaetze: Platz[] = [];
  for (let i = 0; i < PLAETZE; i++) {
    const lw = doc?.createElement("canvas") ?? null;
    if (lw) {
      lw.width = LW_B;
      lw.height = LW_H;
    }
    const tex = new THREE.CanvasTexture(lw as HTMLCanvasElement);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      sizeAttenuation: false,
      fog: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 1000; // nach der Zielmarke (999): Zeichen liegen obenauf
    sprite.frustumCulled = false; // sonst liefe die Lebenszeit ausserhalb des Bilds nicht ab
    sprite.visible = false;
    const p: Platz = {
      sprite,
      mat,
      tex,
      g: (lw?.getContext("2d") as CanvasRenderingContext2D | null) ?? null,
      t0: 0,
      bis: -Infinity,
      schluessel: null,
      n: 0,
      groesse: 1,
      folge: false,
      versatz: 0,
      mitteX: 0.5,
    };
    /*
     * Je Bild, nur solange sichtbar: Groesse aus Leinwandhoehe und Brennweite
     * (sizeAttenuation aus: die Hoehe in Bildschirm-Einheiten ist scale.y × P11,
     * also scale.y = 2 · px / (H · P11)), Aufsteigen, Ausblenden.
     */
    sprite.onBeforeRender = (renderer, _scene, camera) => {
      animiere(p, jetzt(), (renderer as THREE.WebGLRenderer).getSize(groesse).y, camera);
    };
    plaetze.push(p);
    scene.add(sprite);
  }

  const ort = new THREE.Vector3();
  const animiere = (p: Platz, ms: number, hoehePx: number, camera: THREE.Camera): void => {
    const k = (ms - p.t0) / (p.bis - p.t0);
    if (!(k < 1)) {
      p.sprite.visible = false;
      p.mat.opacity = 0;
      return;
    }
    if (p.folge) {
      o.greiferOrt(ort);
      p.sprite.position.set(ort.x, ort.y + UEBER_GREIFER_M, ort.z);
    }
    const p11 = (camera as THREE.PerspectiveCamera).isPerspectiveCamera ? camera.projectionMatrix.elements[5]! : 1;
    const sy = (2 * HOEHE_PX * p.groesse) / (Math.max(1, hoehePx) * p11);
    p.sprite.scale.set(sy * (LW_B / LW_H), sy, 1);
    p.sprite.center.set(p.mitteX + p.versatz, -AUFSTIEG * Math.max(0, k));
    p.mat.opacity = k < AUSBLENDEN_AB ? 1 : 1 - (k - AUSBLENDEN_AB) / (1 - AUSBLENDEN_AB);
    p.sprite.updateMatrixWorld();
  };

  /** Freier Platz oder einer mit diesem Schluessel; ist alles belegt, der, der am ehesten ablaeuft. */
  const platzFuer = (schluessel: string | null, ms: number): Platz => {
    if (schluessel) {
      const da = plaetze.find((p) => p.schluessel === schluessel && p.bis > ms);
      if (da) return da;
    }
    let best = plaetze[0]!;
    for (const p of plaetze) {
      if (p.bis <= ms) return p;
      if (p.bis < best.bis) best = p;
    }
    return best;
  };

  /** Plakette (Kreis in der Grundfarbe, dunkler Rand) mit Bild, rechts daneben die Zahl. */
  const male = (p: Platz, b: Bild, zahl: string | null): void => {
    const g = p.g;
    if (!g) return;
    g.clearRect(0, 0, LW_B, LW_H);
    const r = LW_H / 2 - 6;
    const cx = zahl ? LW_H / 2 : LW_B / 2;
    const cy = LW_H / 2;
    g.beginPath();
    g.arc(cx, cy, r, 0, 2 * Math.PI);
    g.fillStyle = farbeCss(b.grund);
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = "rgba(0,0,0,0.75)"; // SW: Rand, damit es auf hellem Beton und dunklem Stahl steht
    g.stroke();
    const kante = r * 1.25;
    zeichnePfade(g, b.pfade, cx - kante / 2, cy - kante / 2, kante, farbeCss(b.strich), 2.4);
    if (zahl) {
      g.font = "bold 76px system-ui, -apple-system, sans-serif"; // SW: Ziffern so hoch wie das Bild
      g.textAlign = "left";
      g.textBaseline = "middle";
      g.lineJoin = "round";
      g.lineWidth = 10;
      g.strokeStyle = "rgba(0,0,0,0.85)";
      g.fillStyle = "#ffffff";
      g.strokeText(zahl, LW_H + 4, cy + 3, LW_B - LW_H - 8);
      g.fillText(zahl, LW_H + 4, cy + 3, LW_B - LW_H - 8);
    }
    p.tex.needsUpdate = true;
  };

  const zeige = (
    x: number,
    y: number,
    z: number,
    b: Bild,
    opt: { zahl?: string | null; schluessel?: string | null; n?: number; leben?: number; klein?: boolean; folge?: boolean; versatz?: number } = {}
  ): Platz => {
    const ms = jetzt();
    const p = platzFuer(opt.schluessel ?? null, ms);
    p.schluessel = opt.schluessel ?? null;
    p.n = opt.n ?? 0;
    p.t0 = ms;
    p.bis = ms + 1000 * (opt.leben ?? LEBEN_S);
    p.groesse = opt.klein ? KLEIN : 1;
    p.folge = !!opt.folge;
    p.versatz = opt.versatz ?? 0;
    p.mitteX = opt.zahl ? 0.25 : 0.5; // das Bild steht ueber dem Ort, die Zahl rechts daneben
    p.sprite.position.set(x, y, z);
    p.sprite.center.set(p.mitteX + p.versatz, 0);
    p.mat.opacity = 1;
    p.sprite.visible = true;
    male(p, b, opt.zahl ?? null);
    return p;
  };

  /* --------------------------------------------------------- Ansage -- */
  const ansageEl = doc?.getElementById("ortszeichen-ansage") ?? null;
  let letzte: { id: AnsageId } | { text: string } | null = null;
  const sage = (a: { id: AnsageId } | { text: string }): void => {
    letzte = a;
    if (ansageEl) ansageEl.textContent = "id" in a ? ANSAGE[a.id][sprache()] : t(a.text);
  };

  /* ----------------------------------------------------- Zuhoerer -- */

  // Ueberlast (E-152, einmal je Versuch): rotes Gewicht an der Spinne; frei stehend dazu das Stuetzen-Bild
  bus.on("greifer:ueberlast", (e) => {
    o.greiferOrt(ort);
    const y = ort.y + UEBER_GREIFER_M;
    if (e.abgestuetzt) zeige(ort.x, y, ort.z, BILDER.last, { folge: true, schluessel: "greifer" });
    else {
      // Zwei Zeichen nebeneinander: Gewicht links, Stuetzen rechts (Versatz in Zeichenbreiten, Bild ist eine halbe breit)
      zeige(ort.x, y, ort.z, BILDER.last, { folge: true, schluessel: "greifer", versatz: 0.27 });
      zeige(ort.x, y, ort.z, BILDER.stuetzen, { folge: true, schluessel: "greifer2", versatz: -0.27 });
    }
    sage({ id: e.abgestuetzt ? "last" : "stuetzen" });
    audio.playWrong(); // Antwort 2: der vorhandene dumpfe Fehlton
  });

  // Nur Wuerfe des Spielers: Ein Kipper, der in eine Mulde kippt, loest kein Zeichen aus
  let losgelassen = -Infinity;
  bus.on("released", (e) => {
    if (e.count > 0) losgelassen = jetzt();
  });
  let richtigTon = -Infinity;
  bus.on("itemEntered", (e) => {
    const ms = jetzt();
    if (ms - losgelassen > WURF_FENSTER_MS) return;
    const m = o.behaelterOrt(e.containerId);
    if (!m) return;
    const schluessel = `mulde:${e.containerId}`;
    if (e.correct) {
      // Mehrere in kurzer Folge zaehlen hoch: dasselbe Zeichen, solange es steht
      const da = plaetze.find((p) => p.schluessel === schluessel && p.bis > ms && p.n > 0);
      const n = (da?.n ?? 0) + 1;
      zeige(m.x, m.y + UEBER_SCHILD_M, m.z, BILDER.ok, { zahl: `+${n}`, schluessel, n });
      sage({ id: "ok" });
      if (ms - richtigTon >= RICHTIG_ABSTAND_MS) {
        richtigTon = ms;
        audio.playRichtig();
      }
    } else {
      zeige(m.x, m.y + UEBER_SCHILD_M, m.z, BILDER.nein, { schluessel, n: 0 });
      sage({ id: "nein" });
      audio.playWrong();
    }
  });

  bus.on("teil:werkzeug", (e) => {
    zeige(e.x, e.y + UEBER_MULDE_M, e.z, BILDER.werkzeug, { schluessel: "werkzeug" });
    sage({ id: "werkzeug" });
    audio.playClawSnap(0.6); // SW: gedaempft — die Zaehne beissen ab
  });

  bus.on("teil:zerlegt", (e) => {
    const sorten = [...new Set(e.materialIds.map(sorteVonMaterial).filter((s): s is SorteId => !!s))].slice(0, ZERLEGT_MAX);
    sorten.forEach((s, i) => zeige(e.x, e.y + UEBER_MULDE_M, e.z, sortenBild(s), { versatz: (i - (sorten.length - 1) / 2) * -0.5 }));
    sage({ id: "zerlegt" });
  });

  bus.on("presse:gesperrt", (e) => {
    zeige(e.x, e.y + UEBER_MULDE_M, e.z, BILDER.nein, { schluessel: "presse" });
    sage({ id: "presseNein" });
    audio.playWrong();
  });
  bus.on("presse:gestempelt", (e) => {
    if (e.teile > 0) {
      zeige(e.x, e.y + UEBER_MULDE_M, e.z, BILDER.paket, { zahl: `+${e.teile}`, schluessel: "presse" });
      sage({ id: "paket" });
    } else {
      zeige(e.x, e.y + UEBER_MULDE_M, e.z, BILDER.nein, { schluessel: "presse" });
      sage({ id: "presseLeer" });
      audio.playWrong();
    }
  });

  bus.on("inventar:zurueck", (e) => {
    for (const s of e.stuecke.slice(0, ZURUECK_MAX)) zeige(s.x, s.y + UEBER_MULDE_M, s.z, BILDER.runter, { klein: true });
    if (e.stuecke.length) sage({ id: "zurueck" });
  });

  bus.on("fuhrpark:abholerLeer", (e) => {
    zeige(e.x, UEBER_LASTER_M, e.z, BILDER.laster, { zahl: "0", schluessel: "abholerLeer" });
    sage({ id: "abholerLeer" });
    audio.playWrong();
  });

  bus.on("fuhrpark:meldung", (e) => {
    sage({ text: e.text });
    const z = e.art ? FUHRPARK_ZEICHEN[e.art] : null;
    if (!e.art || !z) return; // ohne Anlass bzw. Bewegung: nur der Bildschirmleser
    const schluessel = `fuhrpark:${e.art}`;
    const ms = jetzt();
    // Dieselbe Meldung, solange ihr Zeichen noch steht: auffrischen, nicht noch einmal funken
    const schonDa = plaetze.some((p) => p.schluessel === schluessel && p.bis > ms);
    if (e.x !== undefined && e.z !== undefined) {
      const b = typeof z.bild === "string" ? BILDER[z.bild] : sortenBild(z.bild.sorte);
      zeige(e.x, UEBER_LASTER_M, e.z, b, { schluessel, klein: z.klein, leben: z.lang ? LEBEN_LANG_S : LEBEN_S });
    }
    if (!schonDa) audio.playFunk(!!z.klein);
  });

  // Antwort auf einen Knopf ohne Weltort: kurzes Zeichen am Kranz-Knopf
  const kranz = doc?.getElementById("btn-kranz") ?? null;
  let marke: HTMLElement | null = null;
  let quittungAus: ReturnType<typeof setTimeout> | null = null;
  const SVG = (b: Bild): string =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="${farbeCss(b.strich)}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${b.pfade.map((d) => `<path d="${d}"/>`).join("")}</svg>`;
  bus.on("bedienung:quittung", (e) => {
    const b = e.zeichen === "nein" ? BILDER.nein : BILDER.uhr;
    if (kranz && doc) {
      if (!marke) {
        marke = doc.createElement("span");
        kranz.appendChild(marke);
      }
      marke.className = `oz-quittung an ${e.zeichen}`;
      marke.style.background = farbeCss(b.grund);
      marke.innerHTML = SVG(b);
      if (quittungAus !== null) clearTimeout(quittungAus);
      quittungAus = setTimeout(() => {
        if (marke) marke.className = "oz-quittung";
        quittungAus = null;
      }, QUITTUNG_MS);
    }
    sage({ id: e.zeichen === "nein" ? "quittNein" : "quittUhr" });
    if (e.zeichen === "nein") audio.playWrong();
    else audio.playTick();
  });

  return {
    neuBeschriften() {
      if (letzte) sage(letzte);
    },
  };
}
