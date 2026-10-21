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
import { wort } from "./aufgabentexte";
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

/** SW: so lange leuchtet ein gedrueckter Knopf nach (s) */
export const TASTE_LEUCHTET_S = 1.5;

/** Rein: Aufschrift fuer einen Tastendruck der Spur — `kranz` liest die Aufschrift des Kranzeintrags. */
export function tastenText(code: string, kranz: (code: string) => string | null, s: Sprache = sprache()): string | null {
  if (code === "KeyC") return wort("ansichtTipp", s);
  if (code === KAMERA_ZURUECK) return null; // zeigt der Doppeltipp im Mittelstreifen
  const name = kranz(code);
  return name ? `${name}: ${wort("kranzTipp", s)}` : null;
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
  halter.append(kam, schild);
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

  /** Liegt ein echter Daumen in dieser Zone? Der Stickkreis ist dann eingeblendet. */
  const daumenDrauf = (seite: "links" | "rechts"): boolean => {
    const pad = document.getElementById(seite === "links" ? "touch-left" : "touch-right");
    return !!pad && !pad.hidden;
  };
  const kranz = (code: string): string | null =>
    document.querySelector(`.hidden-actions span[data-action="${code}"]`)?.textContent?.trim() || null;

  const auffrischen = (): void => {
    const touch = document.body.classList.contains("touch");
    const w = phase === "zeigen" ? (m.vorfuehrung?.werte ?? null) : null;
    const a = w ? stickAusschlag(w.achsen, m.steuerung()) : null;
    // In der Vorfuehrung: jede Seite, die sich bewegt, dazu die Seite des Schritts in Ruhe
    const folgt = (seite: "links" | "rechts"): Ausschlag | null =>
      a ? (a[seite] ?? (bilder.some((b) => b.seite === seite) ? { dx: 0, dy: 0 } : null)) : null;
    // „du": je Seite das stehende Bild, solange dort kein echter Daumen liegt
    const steht = (seite: "links" | "rechts"): DaumenBild | null =>
      w || daumenDrauf(seite) ? null : (bilder.find((b) => b.seite === seite) ?? null);
    const gedrueckt = w ? m.vorfuehrung?.gedrueckt : null;
    const frisch = gedrueckt && gedrueckt.seitS < TASTE_LEUCHTET_S ? gedrueckt.codes : [];
    const schildText = (w ? frisch : duTasten)
      .map((c) => tastenText(c, kranz))
      .filter((x): x is string => !!x)
      .join(" · ");
    const geste = w ? (frisch.includes(KAMERA_ZURUECK) ? "doppeltipp" : (kameraGeste(w.kamera) ?? "")) : duGeste;
    const fahren = !!w && (Math.abs(w.achsen.drive) >= RUHE || Math.abs(w.achsen.steer) >= RUHE);
    // Drehtasten leuchten nur, wenn der Rotator auf keinem Stick liegt
    const rot = w && !achseVon("rotator", m.steuerung()) && Math.abs(w.achsen.rotator) >= RUHE ? Math.sign(w.achsen.rotator) : 0;
    const L = folgt("links");
    const R = folgt("rechts");
    const runde = (x: Ausschlag | null): string => (x ? `${x.dx.toFixed(2)},${x.dy.toFixed(2)}` : "-");
    const sichtbar = !aus && touch;
    const soll = !sichtbar
      ? ""
      : w
        ? `v|${runde(L)}|${runde(R)}|${geste}|${schildText}|${fahren}|${rot}`
        : `d|${steht("links")?.pfeil ?? "-"}|${steht("rechts")?.pfeil ?? "-"}|${geste}|${schildText}`;
    if (soll === gezeigt) return;
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
    kam.classList.toggle("an", sichtbar && geste !== "");
    kam.dataset["geste"] = geste;
    schild.classList.toggle("an", sichtbar && schildText !== "");
    schild.textContent = schildText;
    document.getElementById("pedals")?.classList.toggle("geist-zeigt", sichtbar && fahren);
    document.getElementById("btn-rot-r")?.classList.toggle("geist-zeigt", sichtbar && rot > 0);
    document.getElementById("btn-rot-l")?.classList.toggle("geist-zeigt", sichtbar && rot < 0);
  };

  const anfang = (): void => {
    bilder = [];
    duGeste = "";
    duTasten = [];
    zeigtGerade = null;
    spurDes = null;
    aus = false;
    phase = "du";
    auffrischen();
  };
  /** `spur`: nur Lehrgang „du" — die Spur, die zu DIESEM Schritt vorgefuehrt wurde */
  const schritt = (zeige: GameEvents["challenge:schritt"]["zeige"], p: "zeigen" | "du", spur: Spur | null = null): void => {
    aus = false;
    phase = p;
    bilder = daumenAusSpur(p === "du" ? spur : null, zeige, m.steuerung());
    duGeste = p === "du" ? kameraAusSpur(spur) : "";
    duTasten = p === "du" ? [...new Set((spur ?? []).flatMap((a) => a.tasten ?? []))] : [];
    auffrischen();
  };
  const ende = (): void => {
    aus = true;
    bilder = [];
    auffrischen();
  };

  m.bus.on("challenge:start", anfang);
  m.bus.on("challenge:schritt", (e) => schritt(e.zeige, "du"));
  // Einmal je Bild: reicht, um den echten Daumen zu bemerken (keine Layoutabfrage, nur `hidden`)
  m.bus.on("challenge:stand", () => auffrischen());
  m.bus.on("challenge:geschafft", ende);
  m.bus.on("lehrgang:start", anfang);
  m.bus.on("lehrgang:schritt", (e) => {
    if (e.phase === "zeigen") zeigtGerade = { id: e.id, nr: e.nr };
    const eigene = spurDes && spurDes.id === e.id && spurDes.nr === e.nr ? spurDes.spur : null;
    schritt(e.zeige, e.phase, e.phase === "du" ? eigene : null);
  });
  m.bus.on("lehrgang:vorfuehren", (e) => {
    spurDes = zeigtGerade ? { ...zeigtGerade, spur: e.spur } : null;
  });
  m.bus.on("lehrgang:geschafft", ende);

  return { takt: auffrischen };
}
