/**
 * DER GEISTERDAUMEN (E-162, 19.10.2026).
 *
 * Konzept (`docs/aufgaben-konzept.md`): „Erklaert wurde mit Text statt mit
 * Zeigen … Die Sticks schweben aber, sie erscheinen erst dort, wo der Daumen
 * aufsetzt. Es gibt nichts im Bild, worauf man schauen koennte." Darum zeigt
 * je Schritt ein halbdurchsichtiger Daumen in der linken bzw. rechten
 * Stick-Zone die EINE Bewegung des Schritts: Ring in Stickgroesse, Daumen
 * darin, der sanft in Pfeilrichtung schiebt.
 *
 * Welche Zone und welcher Pfeil, ergibt sich aus der Belegung des Spielers
 * (`stickRichtung` in `ui/challengekarte.ts` — dieselbe Stelle, aus der der
 * Kartentext kommt; Karte und Daumen koennen sich nicht widersprechen).
 *
 * Nur auf Touch (`body.touch`, gesetzt von `core/touch.ts`); am Rechner gibt
 * es keine Sticks, also auch keinen Daumen. Nimmt keine Beruehrung an.
 * Verschwindet, solange ein echter Daumen in dieser Zone liegt — abgelesen am
 * Stickkreis (`#touch-left` / `#touch-right` ist dann nicht `hidden`), ohne
 * `touch.ts` anzufassen. Haengt nur am Bus.
 */
import type { EventBus, GameEvents } from "../core/events";
import type { AxisId, ControlConfig } from "../core/controlConfig";
import type { Spur, SpurAbschnitt, SpurAchse } from "../core/spur";
import { KAMERA_ZURUECK, SPUR_ACHSEN, type Wiedergabe } from "../core/wiedergabe";
import { sprache, type Sprache } from "../challenges/texte";
import { achseVon, stickRichtung } from "./challengekarte";

export type Pfeil = "links" | "rechts" | "hoch" | "runter" | "quer" | "laengs";

/** Was der Daumen zeigt: in welcher Zone, in welche Richtung. */
export interface DaumenBild {
  seite: "links" | "rechts";
  /** links/rechts/hoch/runter; „quer"/„laengs" = Doppelpfeil (richtung "beide") */
  pfeil: Pfeil;
}

/** Die Bewegung eines Schritts als Daumenbild — null, wenn nichts zu zeigen ist. */
export function daumenBild(zeige: GameEvents["challenge:schritt"]["zeige"], c: ControlConfig): DaumenBild | null {
  if (!zeige || zeige.fn === "none") return null;
  const id = achseVon(zeige.fn, c);
  if (!id) return null; // Funktion liegt auf keinem Stick (Steuerungsmenue) — der Text sagt das
  const r = stickRichtung(id, c, zeige.richtung !== "minus");
  if (zeige.richtung === "beide") return { seite: r.seite, pfeil: r.quer ? "quer" : "laengs" };
  const pfeil: Pfeil = r.quer ? (r.rechtsOderUnten ? "rechts" : "links") : r.rechtsOderUnten ? "runter" : "hoch";
  return { seite: r.seite, pfeil };
}

const ZEICHEN: Record<Pfeil, string> = {
  links: "←",
  rechts: "→",
  hoch: "↑",
  runter: "↓",
  quer: "↔",
  laengs: "↕",
};

/*
 * --- LEHRGANG (E-196): Der Daumen folgt der Vorfuehrung ---
 * In der Phase „zeigen" schiebt die Wiedergabe (`core/wiedergabe.ts`) die
 * Sticks; der Geisterdaumen steht dann genau dort, wo ein echter Daumen
 * stehen muesste, damit dieselben Werte herauskommen — ueber dieselbe
 * Belegung wie Karte und Pfeil (`achseVon`).
 */

/** Ausschlag eines Sticks auf dem Bildschirm, −1 … +1 (rechts bzw. unten positiv). */
export interface Ausschlag {
  dx: number;
  dy: number;
}

/** SW: darunter gilt ein Stick als „in Ruhe" (Rauschen der Spur, Rundung) */
const RUHE = 0.02;
const clamp1 = (v: number): number => Math.max(-1, Math.min(1, v));

/**
 * Rein: Welche Stickausschlaege erzeugen diese Achsenwerte bei dieser
 * Belegung? Umkehr von `core/touch.ts`: Befehl = Ausschlag × (Umkehr ? −1 : 1),
 * also Ausschlag = Befehl × (Umkehr ? −1 : 1). Fahren liegt beim
 * Fahrbetrieb auf dem linken Stick (nach oben = vorwaerts). Ein Stick ohne
 * Ausschlag ist null. Die Totzonen werden nicht nachgebildet — gezeigt wird
 * die Richtung, nicht der Millimeter.
 */
export function stickAusschlag(
  achsen: Record<SpurAchse, number>,
  c: ControlConfig
): { links: Ausschlag | null; rechts: Ausschlag | null } {
  const roh: Record<AxisId, number> = { leftX: 0, leftY: 0, rightX: 0, rightY: 0 };
  for (const fn of ["cab", "boom", "stick", "grapple", "rotator"] as const) {
    const v = achsen[fn];
    if (Math.abs(v) < RUHE) continue;
    const id = achseVon(fn, c);
    if (id) roh[id] += v * (c[id].invert ? -1 : 1);
  }
  roh.leftX += achsen.steer;
  roh.leftY -= achsen.drive;
  const seite = (x: number, y: number): Ausschlag | null =>
    Math.abs(x) < RUHE && Math.abs(y) < RUHE ? null : { dx: clamp1(x), dy: clamp1(y) };
  return { links: seite(roh.leftX, roh.leftY), rechts: seite(roh.rightX, roh.rightY) };
}

export type KameraGeste = "rechts" | "links" | "hoch" | "runter" | "auf" | "zu";

/**
 * Rein: Welche Geste im Mittelstreifen erzeugt diese Kamerabewegung? Ein
 * Finger zieht (Gier = waagerecht, Nick = senkrecht, Vorzeichen wie
 * `Input.orbitDX/DY`), zwei Finger kneifen: Faktor < 1 = naeher = Finger
 * auseinander („auf"), > 1 = zusammen („zu") — wie `core/touch.ts`.
 */
export function kameraGeste(k: SpurAbschnitt["kamera"] | null): KameraGeste | null {
  if (!k) return null;
  const z = k.zoomProS ?? 1;
  if (Math.abs(z - 1) > 1e-3) return z < 1 ? "auf" : "zu";
  const gx = k.gierProS ?? 0;
  const gy = k.nickProS ?? 0;
  if (Math.abs(gx) < 1e-3 && Math.abs(gy) < 1e-3) return null;
  if (Math.abs(gx) >= Math.abs(gy)) return gx > 0 ? "rechts" : "links";
  return gy > 0 ? "runter" : "hoch";
}

/*
 * --- LEHRGANG, Phase „du" (L2b, qa-Befunde 4 und 5) ---
 * `zeige` nennt EINE Funktion. Lektion 3 Schritt 5 braucht aber zwei Sticks,
 * und die Kamera-Schritte haben gar kein `zeige`. Darum leiten sich die Bilder
 * in „du" aus der Spur ab, die eben vorgefuehrt wurde: Der Spieler sieht
 * dieselben Daumen, die er gerade gesehen hat — nur stehend mit Pfeil.
 */

/**
 * Rein: Je Stickseite der erste Ausschlag der Spur; `zeige` behaelt seine
 * Seite (Doppelpfeil bei „beide"). Abschnitte, in denen die `zeige`-Funktion
 * laeuft, kommen zuerst: Sie sind der Kern des Schritts. Lektion 3 Schritt 5
 * schwenkt erst (links quer) und hebt dann mit Stiel (links laengs + rechts) —
 * links zeigt dann „Hauptarm heben", nicht das Vorab-Schwenken.
 */
export function daumenAusSpur(spur: Spur | null, zeige: GameEvents["challenge:schritt"]["zeige"], c: ControlConfig): DaumenBild[] {
  const z = daumenBild(zeige, c);
  const bilder: DaumenBild[] = z ? [z] : [];
  const fn = zeige?.fn;
  const kern = (a: SpurAbschnitt): boolean => !!fn && fn !== "none" && Math.abs(a.achsen?.[fn as SpurAchse] ?? 0) >= RUHE;
  const folge = [...(spur ?? [])].sort((a, b) => Number(kern(b)) - Number(kern(a))); // stabil: sonst Reihenfolge der Spur
  for (const a of folge) {
    const achsen = Object.fromEntries(SPUR_ACHSEN.map((k) => [k, a.achsen?.[k] ?? 0])) as Record<SpurAchse, number>;
    const aus = stickAusschlag(achsen, c);
    for (const seite of ["links", "rechts"] as const) {
      const x = aus[seite];
      if (!x || bilder.some((b) => b.seite === seite)) continue;
      const pfeil: Pfeil = Math.abs(x.dx) >= Math.abs(x.dy) ? (x.dx > 0 ? "rechts" : "links") : x.dy > 0 ? "runter" : "hoch";
      bilder.push({ seite, pfeil });
    }
  }
  return bilder;
}

/**
 * L5-B (Patrick 22.10. Punkt 40f): Der Lauf sagt in „du", welche Funktion
 * gerade in welche Richtung zaehlt (`lehrgang:richtung`); hier wird daraus je
 * Stickseite ein Einzelpfeil — ueber die Belegung des Spielers, nie fest
 * verdrahtet. Liegen zwei Funktionen auf demselben Stick, zeigt er die erste;
 * eine Funktion, die auf keinem Stick liegt, faellt weg.
 */
export function daumenAusBedarf(bedarf: GameEvents["lehrgang:richtung"]["bedarf"], c: ControlConfig): DaumenBild[] {
  const bilder: DaumenBild[] = [];
  for (const b of bedarf) {
    const d = daumenBild(b, c);
    if (d && !bilder.some((x) => x.seite === d.seite)) bilder.push(d);
  }
  return bilder;
}

/**
 * Rein: Die Kamera-Geste einer Spur fuer „du". Ein Doppeltipp hat Vorrang —
 * er ist das Neue des Schritts (Lektion 1 Schritt 6: drehen kennt der
 * Spieler aus Schritt 1). Sonst die erste Geste, sonst "".
 */
export function kameraAusSpur(spur: Spur | null): KameraGeste | "doppeltipp" | "" {
  if (!spur) return "";
  if (spur.some((a) => a.kamera?.zuruecksetzen)) return "doppeltipp";
  for (const a of spur) {
    const g = kameraGeste(a.kamera ?? null);
    if (g) return g;
  }
  return "";
}

/*
 * --- L4b: Pedale in „du" (qa Q4 Befund 1) ---
 * Fahren liegt auf dem linken Stick, solange der Fahrbetrieb an ist
 * (`core/touch.ts`: dann zaehlen leftX/leftY nicht fuer die Arbeitsfunktionen).
 * Ohne Text sieht der Spieler nicht, dass er erst die Pedale antippen muss —
 * also leuchten sie, wenn der Betrieb nicht zum Schritt passt.
 */
const LINKS_ACHSEN: readonly AxisId[] = ["leftX", "leftY"];

/**
 * Rein: Muessen die Pedale in „du" leuchten?
 *  - Die Spur faehrt (drive/steer), Fahren ist aus → ja.
 *  - Die Spur bewegt eine Funktion, die auf dem LINKEN Stick liegt (bei der
 *    Grundbelegung Drehkranz und Hauptarm), Fahren ist an → ja. Funktionen
 *    auf dem rechten Stick (Grundbelegung: Stiel) stoert der Fahrbetrieb nicht.
 *  - Sonst nein. Faehrt die Spur UND arbeitet links, gewinnt das Fahren.
 */
export function pedaleLeuchten(spur: Spur | null, fahrenAn: boolean, c: ControlConfig): boolean {
  const s = spur ?? [];
  const bewegt = (a: SpurAbschnitt, k: SpurAchse): boolean => Math.abs(a.achsen?.[k] ?? 0) >= RUHE;
  if (s.some((a) => bewegt(a, "drive") || bewegt(a, "steer"))) return !fahrenAn;
  const links = (["cab", "boom", "stick", "grapple", "rotator"] as const).filter((fn) => LINKS_ACHSEN.includes(achseVon(fn, c) as AxisId));
  return fahrenAn && s.some((a) => links.some((fn) => bewegt(a, fn)));
}

/*
 * --- L8-B2 (Lehrgang Teil 2): Drehtasten und Funktionskranz ---
 * Der Rotator liegt in der Grundbelegung auf keinem Stick, sondern auf den
 * Drehtasten ↺/↻ (`core/touch.ts`: rotR = +1, rotL = −1). Dann zeigt ein
 * Finger, der die Taste HAELT. Liegt er auf einem Stick, zeigt das der
 * Stick-Geist wie jede andere Funktion (`daumenBild`).
 */

/**
 * Rein: Welche Drehtaste muss gehalten werden? +1 = ↻ (#btn-rot-r), −1 = ↺
 * (#btn-rot-l), 0 = keine (oder der Rotator liegt auf einem Stick).
 * Vorrang hat, was der Lauf meldet (`lehrgang:richtung`); sonst der erste
 * Rotator-Ausschlag der Spur.
 */
export function drehtasteAus(
  bedarf: GameEvents["lehrgang:richtung"]["bedarf"] | null,
  spur: Spur | null,
  c: ControlConfig
): -1 | 0 | 1 {
  if (achseVon("rotator", c)) return 0;
  if (bedarf) {
    const b = bedarf.find((x) => x.fn === "rotator");
    return b ? (b.richtung === "plus" ? 1 : -1) : 0;
  }
  const a = (spur ?? []).find((x) => Math.abs(x.achsen?.rotator ?? 0) >= RUHE);
  return a ? (Math.sign(a.achsen!.rotator!) as -1 | 1) : 0;
}

/**
 * Rein: Wohin tippt der Kranz-Finger? Ist der Kranz zu, auf den Knopf
 * (#btn-kranz); ist er offen, auf den Eintrag mit diesem Tastencode
 * (`data-code` des Sektors) — bei `code: null` nirgends (das Aufklappen war
 * das Ziel). `null` = der Schritt hat keinen Kranz.
 */
export function kranzZiel(kranz: { code: string | null } | null | undefined, offen: boolean): "knopf" | { code: string } | null {
  if (!kranz) return null;
  if (!offen) return "knopf";
  return kranz.code ? { code: kranz.code } : null;
}

/** SW: so lange leuchtet ein gedrueckter Knopf nach (s) */
export const TASTE_LEUCHTET_S = 1.5;

/** Rein: Aufschrift fuer einen Tastendruck der Spur — `kranz` liest die Aufschrift des Kranzeintrags. */
export function tastenText(code: string, kranz: (code: string) => string | null, _s: Sprache = sprache()): string | null {
  // L5-B (40b): Ansicht und Kamera-Start zeigt ein tippender Finger, kein Schild
  if (code === "KeyC" || code === KAMERA_ZURUECK) return null;
  // L4 (Patrick: „kaum oder keinen Text"): Zeichen plus hoechstens EIN Wort — beim Kranz nur sein Name, wie er dort steht
  return kranz(code);
}

/** Rein (L8-Nachtrag): Tastencode → Aufschrift der Taste am Rechner, "KeyO" → "O", "Digit2" → "2". */
export function pcTaste(code: string): string {
  return code.replace(/^(Key|Digit)/, "");
}

export interface Geisterdaumen {
  /** Lehrgang: einmal je Bild (in Pruefungen harmlos, dort frischt `challenge:stand` auf). */
  takt(): void;
}

export function installGeisterdaumen(m: {
  bus: EventBus;
  steuerung: () => ControlConfig;
  /** E-196: die Wiedergabe des Lehrgangs — nur gelesen (`werte`, `gedrueckt`) */
  vorfuehrung?: Pick<Wiedergabe, "werte" | "gedrueckt">;
  /** L4b: Fahrbetrieb an? (`TouchControls.fahrenAktiv`, nur gelesen) — fehlt am Rechner, dann leuchtet nichts */
  fahrenAn?: () => boolean;
  /** L8-B2: Funktionskranz offen? (`TouchControls.kranzOffen`, nur gelesen) — fehlt am Rechner, dann gilt „zu" */
  kranzOffen?: () => boolean;
}): Geisterdaumen {
  const halter = document.createElement("div");
  halter.id = "geisterdaumen";
  halter.setAttribute("aria-hidden", "true");
  const geist = (seite: "links" | "rechts"): { el: HTMLDivElement; pfeil: HTMLDivElement } => {
    const el = document.createElement("div");
    el.className = `geist ${seite}`;
    const ring = document.createElement("div");
    ring.className = "ring";
    const daumen = document.createElement("div");
    daumen.className = "daumen";
    const pfeil = document.createElement("div");
    pfeil.className = "pfeil";
    el.append(ring, daumen, pfeil);
    halter.appendChild(el);
    return { el, pfeil };
  };
  const g = { links: geist("links"), rechts: geist("rechts") };
  // Lehrgang: Kamera-Geste im Mittelstreifen, Knopf-Schild ueber dem rechten Stick
  const kam = document.createElement("div");
  kam.className = "kamgeist";
  for (let i = 0; i < 2; i++) {
    const f = document.createElement("div");
    f.className = "finger";
    kam.appendChild(f);
  }
  const schild = document.createElement("div");
  schild.className = "tastengeist";
  /*
   * L5-B (Patrick 22.10. Punkte 40b, 40d): Tippen als Bewegung. Ein Finger
   * senkt sich, je Tipp laeuft ein Ring nach aussen — doppelt fuer die
   * Ansicht (rechte Zone) und den Kamera-Start (Mitte), einmal fuer die Pedale
   * (der Finger kommt von oben angewandert). In „du" in Schleife, in der
   * Vorfuehrung einmal je Druck. Bewegung im CSS (index.html `tipp-*`).
   */
  const tippgeist = (art: string): HTMLDivElement => {
    const el = document.createElement("div");
    el.className = `tippgeist ${art}`;
    for (const k of ["welle", "welle zwei", "finger"]) {
      const t = document.createElement("div");
      t.className = k;
      el.appendChild(t);
    }
    return el;
  };
  /*
   * L8-B2: `kranz` tippt einmal je Durchgang auf Knopf bzw. Eintrag (wie das
   * Pedal, der Finger kommt angewandert); `halten` setzt auf die Drehtaste und
   * bleibt gedrueckt (index.html `tipp-halten`).
   */
  const tipp = {
    ansicht: tippgeist("ansicht"),
    mitte: tippgeist("mitte"),
    pedal: tippgeist("pedal einzel"),
    kranz: tippgeist("kranz einzel"),
    halten: tippgeist("halten"),
  };
  halter.append(kam, schild, tipp.ansicht, tipp.mitte, tipp.pedal, tipp.kranz, tipp.halten);
  document.body.appendChild(halter);

  let bilder: DaumenBild[] = [];
  /* Lehrgang „du": Geste und Tasten der zuletzt vorgefuehrten Spur */
  let duGeste = "";
  let duTasten: string[] = [];
  /* Welche Spur zu welchem Schritt gehoert: `lehrgang:schritt` (zeigen) kommt vor `lehrgang:vorfuehren` */
  let zeigtGerade: { id: string; nr: number } | null = null;
  let spurDes: { id: string; nr: number; spur: Spur } | null = null;
  let aus = true; // nach `geschafft` bis zum naechsten Schritt
  let gezeigt = ""; // was gerade im DOM steht — geschrieben wird nur bei Aenderung
  let phase: "zeigen" | "du" = "du";
  /* Lehrgang „du": die Spur des Schritts — fuer die Pedal-Regel */
  let duSpur: Spur | null = null;
  /* L4b: Haekchen-Pause bis zum naechsten Schritt — die Seiten, die gruen leuchten */
  let gelungen: Set<"links" | "rechts"> | null = null;
  /* L5-B (40f): letzte `lehrgang:richtung` dieses Schritts — ersetzt in „du" die Bilder aus der Spur */
  let richtung: GameEvents["lehrgang:richtung"] | null = null;
  let schrittVon: { id: string; nr: number } | null = null;
  /* L5-B (40b/40d): Vorfuehrung — zaehlt jeden Tastendruck (neuer Finger-Tipp) und ob der Schritt erst die Pedale braucht */
  let druckDa: object | null = null;
  let druecke = 0;
  let pedalVorab = false;
  /* L5-B (40b): der laufende Lehrgangsschritt uebt die Ansicht (Bildzeichen „ansicht") */
  let ansichtSchritt = false;
  /* L8-B2: Kranz des laufenden Lehrgangsschritts (`lehrgang:schritt.kranz`) */
  let kranzSchritt: { code: string | null } | null = null;
  /* Wo der Kranz-Finger zuletzt stand ("-", "knopf" oder Tastencode) — ein neuer Ort startet seine Bewegung von vorn */
  let kranzGezeigt = "-";
  /** Mitte eines Elements in Bildpunkten — null, wenn es nicht zu sehen ist (Breite 0) */
  const mitteVon = (el: Element | null | undefined): { x: number; y: number } | null => {
    const r = (el as HTMLElement | null)?.getBoundingClientRect?.();
    return r && r.width > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  };
  /** Mitte des ersten Pedals in Bildpunkten — gelesen nur, wenn der Finger dorthin muss (Lage verlegt L5-A, `#pedals`) */
  const pedalOrt = (): { x: number; y: number } | null => {
    const p = document.getElementById("pedals");
    return mitteVon(p?.querySelector(".pedal") ?? p);
  };
  /** L8-B2: Knopf oder Kranz-Eintrag (`data-code`, core/touch.ts) — Lage zur Laufzeit wie beim Pedal */
  const kranzOrt = (z: "knopf" | { code: string }): { x: number; y: number } | null => {
    if (z === "knopf") return mitteVon(document.getElementById("btn-kranz"));
    const sektoren = document.getElementById("radial")?.querySelectorAll(".sektor") ?? [];
    return mitteVon(Array.from(sektoren).find((s) => (s as HTMLElement).dataset["code"] === z.code));
  };
  /** Setzt einen Finger auf einen Ort (oder blendet ihn aus); `neu` startet die Bewegung von vorn */
  const fingerAuf = (el: HTMLElement, ort: { x: number; y: number } | null, einmal: boolean, neu: boolean): void => {
    if (ort) {
      el.style.setProperty("left", `${ort.x.toFixed(0)}px`);
      el.style.setProperty("top", `${ort.y.toFixed(0)}px`);
    }
    tippe(el, !!ort, einmal, neu);
  };
  /** an/aus; `neu` = Bewegung von vorn (der naechste Druck der Vorfuehrung) */
  const tippe = (el: HTMLElement, an: boolean, einmal: boolean, neu: boolean): void => {
    if (an && neu) {
      el.classList.remove("an");
      void el.offsetWidth; // Bewegung neu starten (Stil neu rechnen)
    }
    el.classList.toggle("an", an);
    el.classList.toggle("einmal", an && einmal);
  };

  /** Liegt ein echter Daumen in dieser Zone? Der Stickkreis ist dann eingeblendet. */
  const daumenDrauf = (seite: "links" | "rechts"): boolean => {
    const pad = document.getElementById(seite === "links" ? "touch-left" : "touch-right");
    return !!pad && !pad.hidden;
  };
  const kranz = (code: string): string | null =>
    document.querySelector(`.hidden-actions span[data-action="${code}"]`)?.textContent?.trim() || null;

  const auffrischen = (): void => {
    const touch = document.body.classList.contains("touch");
    // L8-Nachtrag: Am Rechner gibt es keinen Geist und keinen Kranz — bei Kranz-Schritten steht die Taste als Schild (O, B, 2)
    if (!touch) {
      const t = !aus && kranzSchritt?.code ? pcTaste(kranzSchritt.code) : "";
      schild.classList.toggle("an", t !== "");
      schild.classList.toggle("pc", t !== "");
      schild.textContent = t;
      return;
    }
    const w = phase === "zeigen" ? (m.vorfuehrung?.werte ?? null) : null;
    const a = w ? stickAusschlag(w.achsen, m.steuerung()) : null;
    // In der Vorfuehrung: jede Seite, die sich bewegt, dazu die Seite des Schritts in Ruhe
    const folgt = (seite: "links" | "rechts"): Ausschlag | null =>
      a ? (a[seite] ?? (bilder.some((b) => b.seite === seite) ? { dx: 0, dy: 0 } : null)) : null;
    // L5-B (40d): Passt der Fahrbetrieb nicht, zeigt der Finger erst aufs Pedal — der Stick-Geist kommt danach
    const pedal = !w && pedaleLeuchten(duSpur, m.fahrenAn?.() ?? false, m.steuerung());
    // „du": je Seite das stehende Bild, solange dort kein echter Daumen liegt
    const steht = (seite: "links" | "rechts"): DaumenBild | null =>
      w || pedal || daumenDrauf(seite) ? null : (bilder.find((b) => b.seite === seite) ?? null);
    const gedrueckt = w ? m.vorfuehrung?.gedrueckt : null;
    const frisch = gedrueckt && gedrueckt.seitS < TASTE_LEUCHTET_S ? gedrueckt.codes : [];
    if (gedrueckt && gedrueckt !== druckDa) druecke++;
    druckDa = gedrueckt ?? null;
    // L8-B2: Kranz-Schritt — auf Touch zeigt der Finger den Eintrag, ein Schild mit demselben Namen waere doppelter Text
    const kz = touch ? kranzZiel(kranzSchritt, m.kranzOffen?.() ?? false) : null;
    const kzText = kz === null ? "-" : kz === "knopf" ? "knopf" : kz.code;
    const ohneKranz = (c: string): boolean => !(touch && kranzSchritt?.code && c === kranzSchritt.code);
    // L8-B2: Drehtaste halten — Vorfuehrung: solange die Spur dreht; „du": was der Lauf meldet, sonst die Spur
    const st = m.steuerung();
    const rotDu = !w && !pedal ? drehtasteAus(richtung?.bedarf ?? null, duSpur, st) : 0;
    const schildText = (w ? frisch : duTasten)
      .filter(ohneKranz)
      .map((c) => tastenText(c, kranz))
      .filter((x): x is string => !!x)
      .join(" · ");
    const geste = w ? (frisch.includes(KAMERA_ZURUECK) ? "doppeltipp" : (kameraGeste(w.kamera) ?? "")) : duGeste;
    // Schritt ohne Vorfuehrung, der die Ansicht will (Zurueck nach draussen): derselbe Finger
    const ansichtTipp = w ? frisch.includes("KeyC") : duTasten.includes("KeyC") || ansichtSchritt;
    const fahren = !!w && (Math.abs(w.achsen.drive) >= RUHE || Math.abs(w.achsen.steer) >= RUHE);
    // Drehtasten leuchten nur, wenn der Rotator auf keinem Stick liegt
    const rot = w ? (!achseVon("rotator", st) && Math.abs(w.achsen.rotator) >= RUHE ? Math.sign(w.achsen.rotator) : 0) : rotDu;
    // Haelt der Spieler die Taste selbst, tritt der Finger zurueck (wie der Stick-Geist beim echten Daumen)
    const rotTaste = rot > 0 ? "btn-rot-r" : rot < 0 ? "btn-rot-l" : null;
    const rotFinger = rotTaste && !(!w && document.getElementById(rotTaste)?.classList.contains("down")) ? rotTaste : null;
    const L = folgt("links");
    const R = folgt("rechts");
    const runde = (x: Ausschlag | null): string => (x ? `${x.dx.toFixed(2)},${x.dy.toFixed(2)}` : "-");
    const sichtbar = !aus && touch;
    if (gelungen) {
      /*
       * L4b (qa Q4 Befund 2): In der Haekchen-Pause kein gelber Geist mit
       * Pfeil — der hiesse „nochmal". Laesst der Spieler los, steht an der
       * Stelle seines Sticks der Geist gruen und still; Finger-Geist, Schild
       * und Pedale bleiben, wie sie beim Haekchen waren.
       */
      const soll = `p|${daumenDrauf("links")}|${daumenDrauf("rechts")}|${sichtbar}`;
      if (soll === gezeigt) return;
      gezeigt = soll;
      for (const seite of ["links", "rechts"] as const) {
        const { el, pfeil } = g[seite];
        const an = sichtbar && gelungen.has(seite) && !daumenDrauf(seite);
        el.classList.toggle("an", an);
        el.classList.toggle("folgt", false);
        el.classList.toggle("erfolg", an);
        pfeil.textContent = "";
        delete el.dataset["pfeil"];
      }
      return;
    }
    const pedalTipp = w ? pedalVorab : pedal;
    const soll = !sichtbar
      ? ""
      : w
        ? `v|${runde(L)}|${runde(R)}|${geste}|${schildText}|${fahren}|${rot}|${ansichtTipp}|${pedalTipp}|${kzText}|${rotFinger}|${druecke}`
        : `d|${steht("links")?.pfeil ?? "-"}|${steht("rechts")?.pfeil ?? "-"}|${geste}|${schildText}|${pedal}|${ansichtTipp}|${kzText}|${rot}|${rotFinger}`;
    if (soll === gezeigt) return;
    const neuerDruck = !!w && !gezeigt.endsWith(`|${druecke}`);
    gezeigt = soll;
    for (const seite of ["links", "rechts"] as const) {
      const { el, pfeil } = g[seite];
      const f = sichtbar && w ? (seite === "links" ? L : R) : null;
      const b = steht(seite);
      const an = sichtbar && (w ? f !== null : b !== null);
      el.classList.toggle("an", an);
      el.classList.toggle("folgt", !!f);
      if (!an) continue;
      if (f) {
        // Folgen: Lage per CSS-Variable, Weg je Fassung in index.html (--weg)
        el.style.setProperty("--dx", f.dx.toFixed(3));
        el.style.setProperty("--dy", f.dy.toFixed(3));
        pfeil.textContent = "";
        delete el.dataset["pfeil"];
      } else if (b) {
        // Die Klasse waehlt die Bewegung (CSS-Keyframes je Richtung, index.html)
        el.dataset["pfeil"] = b.pfeil;
        pfeil.textContent = ZEICHEN[b.pfeil];
      }
    }
    // Doppeltipp im Mittelstreifen: derselbe tippende Finger wie fuer die Ansicht (L5-B)
    kam.classList.toggle("an", sichtbar && geste !== "" && geste !== "doppeltipp");
    kam.dataset["geste"] = geste;
    tippe(tipp.mitte, sichtbar && geste === "doppeltipp", !!w, neuerDruck);
    tippe(tipp.ansicht, sichtbar && ansichtTipp, !!w, neuerDruck);
    const ort = sichtbar && pedalTipp ? pedalOrt() : null;
    if (ort) {
      tipp.pedal.style.setProperty("left", `${ort.x.toFixed(0)}px`);
      tipp.pedal.style.setProperty("top", `${ort.y.toFixed(0)}px`);
    }
    tippe(tipp.pedal, !!ort, !!w, false);
    // L8-B2: Kranz-Finger (Knopf, dann Eintrag) und Halte-Finger auf der Drehtaste
    const kranzNeu = kzText !== kranzGezeigt;
    kranzGezeigt = kzText;
    fingerAuf(tipp.kranz, sichtbar && kz ? kranzOrt(kz) : null, false, kranzNeu);
    fingerAuf(tipp.halten, sichtbar && rotFinger ? mitteVon(document.getElementById(rotFinger)) : null, false, false);
    schild.classList.toggle("an", sichtbar && schildText !== "");
    schild.textContent = schildText;
    document.getElementById("pedals")?.classList.toggle("geist-zeigt", sichtbar && (fahren || pedal));
    document.getElementById("btn-rot-r")?.classList.toggle("geist-zeigt", sichtbar && rot > 0);
    document.getElementById("btn-rot-l")?.classList.toggle("geist-zeigt", sichtbar && rot < 0);
  };

  const anfang = (): void => {
    bilder = [];
    duGeste = "";
    duTasten = [];
    zeigtGerade = null;
    spurDes = null;
    duSpur = null;
    gelungen = null;
    richtung = null;
    pedalVorab = false;
    ansichtSchritt = false;
    kranzSchritt = null;
    aus = false;
    phase = "du";
    auffrischen();
  };
  /** `spur`: nur Lehrgang „du" — die Spur, die zu DIESEM Schritt vorgefuehrt wurde */
  const schritt = (zeige: GameEvents["challenge:schritt"]["zeige"], p: "zeigen" | "du", spur: Spur | null = null): void => {
    aus = false;
    gelungen = null;
    phase = p;
    duSpur = p === "du" ? spur : null;
    bilder = daumenAusSpur(p === "du" ? spur : null, zeige, m.steuerung());
    duGeste = p === "du" ? kameraAusSpur(spur) : "";
    // L5-B (40f): weiss der Lauf, was gerade zaehlt, zeigt der Geist genau das
    if (p === "du" && richtung) {
      bilder = daumenAusBedarf(richtung.bedarf, m.steuerung());
      if (richtung.kamera) duGeste = richtung.kamera;
    }
    duTasten = p === "du" ? [...new Set((spur ?? []).flatMap((a) => a.tasten ?? []))] : [];
    auffrischen();
  };
  /*
   * L4 (Patrick: „sollte irgendwie gehighlighten sein, wenn eine aktion
   * erfolgreich war"): Beim Haekchen leuchtet gruen, was die Aktion war —
   * der Geist (Ring, Finger, Schild) oder, wo der echte Daumen noch liegt,
   * der echte Stickkreis. Die Dauer steht im CSS (0,8 s wie
   * `HAEKCHEN_PAUSE_S`); weg ist es mit dem naechsten Schritt.
   */
  const erfolg = (an: boolean): void => {
    const ziele = an
      ? [
          ...Array.from(halter.querySelectorAll<HTMLElement>(".geist.an, .kamgeist.an, .tastengeist.an, .tippgeist.an")),
          ...["touch-left", "touch-right"].map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el && !el.hidden),
        ]
      : Array.from(document.querySelectorAll<HTMLElement>(".erfolg"));
    for (const el of ziele) el.classList.toggle("erfolg", an);
  };
  const ende = (): void => {
    aus = true;
    kranzSchritt = null;
    bilder = [];
    duSpur = null;
    gelungen = null;
    erfolg(false);
    auffrischen();
  };

  m.bus.on("challenge:start", anfang);
  m.bus.on("challenge:schritt", (e) => schritt(e.zeige, "du"));
  // Einmal je Bild: reicht, um den echten Daumen zu bemerken (keine Layoutabfrage, nur `hidden`)
  m.bus.on("challenge:stand", () => auffrischen());
  m.bus.on("challenge:geschafft", ende);
  m.bus.on("lehrgang:start", () => {
    erfolg(false);
    anfang();
  });
  m.bus.on("lehrgang:haekchen", () => {
    erfolg(true);
    // Gruen bleibt, was beim Haekchen zu sehen war: der Geist oder der echte Stick dieser Seite
    gelungen = new Set((["links", "rechts"] as const).filter((s) => g[s].el.classList.contains("an") || daumenDrauf(s)));
    auffrischen();
  });
  m.bus.on("lehrgang:schritt", (e) => {
    erfolg(false);
    richtung = null; // die Richtung dieses Schritts kommt gleich nach seinem „du"
    schrittVon = { id: e.id, nr: e.nr };
    ansichtSchritt = e.symbol === "ansicht";
    kranzSchritt = e.kranz ?? null;
    pedalVorab = false;
    if (e.phase === "zeigen") zeigtGerade = { id: e.id, nr: e.nr };
    const eigene = spurDes && spurDes.id === e.id && spurDes.nr === e.nr ? spurDes.spur : null;
    schritt(e.zeige, e.phase, e.phase === "du" ? eigene : null);
  });
  m.bus.on("lehrgang:vorfuehren", (e) => {
    spurDes = zeigtGerade ? { ...zeigtGerade, spur: e.spur } : null;
    // L5-B (40d): Die Vorfuehrung schaltet die Pedale nicht (die Spur faehrt an ihnen vorbei) — der Finger zeigt einmal, dass es hier losgeht
    pedalVorab = pedaleLeuchten(e.spur, m.fahrenAn?.() ?? false, m.steuerung());
    auffrischen();
  });
  m.bus.on("lehrgang:richtung", (e) => {
    if (aus || phase !== "du" || schrittVon?.id !== e.id || schrittVon.nr !== e.nr) return;
    richtung = e;
    const eigene = spurDes && spurDes.id === e.id && spurDes.nr === e.nr ? spurDes.spur : null;
    schritt(null, "du", eigene); // die Bilder kommen ganz aus `bedarf`
  });
  m.bus.on("lehrgang:geschafft", ende);

  return { takt: auffrischen };
}
