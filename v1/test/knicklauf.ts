/**
 * EIN LAUFAPPARAT FÜR DIE FAHRT — Waechter und Messwerkzeug benutzen ihn.
 *
 * Er faehrt einen Fahrplan KINEMATISCH ab, Rechenschritt fuer Rechenschritt,
 * mit genau dem Gesetz, mit dem `vehicles.advance` faehrt (`folgeSchritt` aus
 * `lenkung.ts`, seit E-140 das Einspurmodell) — nur ohne Physik, ohne Ladung
 * und ohne Blockadepruefung. Der Knick und der Platzbedarf sind reine Fragen
 * der Pose, und eine Messung ohne Physik streut nicht.
 *
 * VIER ZAHLEN je Fahrt:
 *
 *   Grad je Schritt   wie weit sich die Gierlage in EINEM Bild dreht
 *   Sprung (m)        wie weit die WEITESTE Umrissecke dabei springt
 *   Tiefe (m)         wie tief der Umriss dabei in einem Bauwerk steckt
 *   Steckt            ob eine Etappe ihr Ende nicht erreicht
 *
 * DER ALTE ZUSTAND IST EIN EINGANGSWERT, kein geloeschter Code:
 * `lenkrate = Infinity` liefert die Fahrt von vor dem 16.09.2026 (hartes
 * Setzen von Ort und Gier). Damit hat jeder Waechter seine Gegenprobe.
 */
import { bedLenFor, fahrHindernisse } from "../src/delivery/routes";
import { lkwFahrwerk, pkwFahrwerk, PKW_LAENGE_MAX } from "../src/delivery/vehicleModel";
import {
  fahrzeugUmriss,
  zugwagenUmriss,
  anhaengerUmriss,
  poseAuf,
  streckenLaenge,
  eckenSprung,
  umrissUeberlappung,
  type Rechteck,
} from "../src/delivery/umriss";
import { folgeSchritt, winkelRest, LENK_RATE, type Fahrwerk, type Lage } from "../src/delivery/lenkung";
import type { Fahrplan } from "./strecken";

/** Rechenschritt des Spiels (s) — `PhysicsWorld.timestep`, 60 Bilder je Sekunde. */
export const SCHRITT_S = 1 / 60;

/** Ein einzelner Knick: wo, wie scharf, wie weit springt die Ecke. */
export interface Knick {
  etappe: string;
  x: number;
  z: number;
  grad: number;
  sprungM: number;
}

/** Wo ein Umriss in einem Bauwerk steckt. */
export interface Anstoss {
  etappe: string;
  bauwerk: string;
  tiefeM: number;
  x: number;
  z: number;
}

export interface Fahrt {
  plan: string;
  /** Schaerfster Knick eines einzelnen Rechenschritts. */
  maxGrad: number;
  /** Weitester Sprung einer Umrissecke in einem Rechenschritt (m). */
  maxSprungM: number;
  /** Tiefste Durchdringung eines Bauwerks ueber die ganze Fahrt (m). */
  maxTiefeM: number;
  /** Wie lange die Fahrt dauert (s). */
  dauerS: number;
  /** Alle Knicke ueber 1 Grad je Schritt, absteigend. */
  knicke: Knick[];
  /** Alle Durchdringungen ueber der Toleranz, absteigend. */
  anstoesse: Anstoss[];
  /** Etappen, deren Ende nicht erreicht wurde — mit Rest in Metern. */
  stecken: string[];
  /** Drehte sich der Wagen irgendwann, ohne zu fahren? (Grad, groesster Wert) */
  standDrehGrad: number;
  /** Wie weit der Ursprung am Ende jeder Etappe neben ihrem Endpunkt steht (m). */
  maxEndAbweichungM: number;
  /** Engster gefahrener Kreis (m): Weg je Gieraenderung, ueber alle Schritte mit Fahrt. */
  minRadiusM: number;
  /** Groesster Knick des Anhaengers (Grad) — nur beim Gespann nicht null. */
  maxKnickGrad: number;
  /** Jede Lage, in Bildfolge — fuer Zeichnungen. */
  spur: Array<{ etappe: string; x: number; z: number; gier: number; lenk: number; knick: number }>;
}

export interface Fahrweise {
  /** `Infinity` ist der alte Sprungzustand, jeder endliche Wert das Einspurmodell. */
  lenkrate: number;
}

/** Wie das Spiel seit E-140 faehrt. */
export const NEU: Fahrweise = { lenkrate: LENK_RATE };
/** Wie es bis zum 16.09.2026 fuhr — die Gegenprobe jedes Waechters hier. */
export const ALT: Fahrweise = { lenkrate: Infinity };

/** Das Fahrwerk einer Fahrzeugart — dieselbe Quelle wie der Modellbau. */
export function fahrwerkFuer(kind: string): Fahrwerk {
  const bedLen = bedLenFor(kind);
  return kind === "pkw" ? pkwFahrwerk(bedLen, PKW_LAENGE_MAX) : lkwFahrwerk(bedLen);
}

/**
 * Die Figuren eines Wagens in dieser Lage — dieselben wie `vehicles.boxen`:
 * beim LKW eine, beim Gespann Auto und Anhaenger (der knickt und steht
 * anders als das Auto). Sprung und Winkel misst die erste.
 */
export function figurenFuer(kind: string, l: Lage): Array<ReturnType<typeof fahrzeugUmriss>> {
  const bedLen = bedLenFor(kind);
  const fw = fahrwerkFuer(kind);
  const p = { x: l.x, z: l.z, rot: l.gier };
  if (!fw.anhaenger) return [fahrzeugUmriss(p, bedLen)];
  const k = fw.anhaenger.kupplung;
  return [
    zugwagenUmriss(p, fw.vorn, fw.hinten),
    anhaengerUmriss(l.x + Math.sin(l.gier) * k, l.z + Math.cos(l.gier) * k, l.gier + l.knick, bedLen),
  ];
}

/**
 * Einen Fahrplan abfahren und dabei jeden Schritt vermessen.
 *
 * `hindernisse` ist ein Eingang und keine feste Liste, damit derselbe Apparat
 * auch gegen einen versetzten Container gerechnet werden kann.
 */
export function fahre(
  f: Fahrplan,
  w: Fahrweise = NEU,
  hindernisse: ReadonlyArray<Rechteck & { label: string }> = fahrHindernisse()
): Fahrt {
  const fw = fahrwerkFuer(f.kind);
  const knicke: Knick[] = [];
  const anstoesse: Anstoss[] = [];
  const stecken: string[] = [];
  const spur: Fahrt["spur"] = [];
  let maxGrad = 0;
  let maxSprung = 0;
  let maxTiefe = 0;
  let schritte = 0;
  let standDreh = 0;
  let maxEnd = 0;
  let maxKnick = 0;
  let minRadius = Infinity;
  // Startlage: der Wagen wird an der Einfahrt GESETZT, nicht eingelenkt
  // (`vehicles.ts`, Konstruktor: `placeAt(this.routeIn, 0)`).
  const start = poseAuf(f.etappen[0]!.route, 0, f.etappen[0]!.rueckwaerts);
  const l: Lage = { x: start.x, z: start.z, gier: start.rot, lenk: 0, knick: 0 };
  /*
   * Die Figuren: beim LKW eine, beim Gespann Auto und Anhaenger (der knickt
   * und steht anders als das Auto). Sprung und Winkel misst die erste.
   */
  const figuren = (): Array<ReturnType<typeof fahrzeugUmriss>> => figurenFuer(f.kind, l);
  let box = figuren()[0]!;
  const messe = (name: string, gradSchritt: number, weg: number): void => {
    const alle = figuren();
    const neu = alle[0]!;
    const sprung = eckenSprung(box, neu);
    if (gradSchritt > maxGrad) maxGrad = gradSchritt;
    if (sprung > maxSprung) maxSprung = sprung;
    if (weg < 1e-9 && gradSchritt > standDreh) standDreh = gradSchritt;
    if (weg > 1e-4 && gradSchritt > 1e-6) {
      const r = weg / ((gradSchritt * Math.PI) / 180);
      if (r < minRadius) minRadius = r;
    }
    if (Math.abs(l.knick) * (180 / Math.PI) > maxKnick) maxKnick = Math.abs(l.knick) * (180 / Math.PI);
    if (gradSchritt > 1 || sprung > 0.5) {
      knicke.push({ etappe: name, x: neu.x, z: neu.z, grad: gradSchritt, sprungM: sprung });
    }
    for (const fig of alle) {
      for (const o of hindernisse) {
        const d = umrissUeberlappung(fig, o);
        if (d > maxTiefe) maxTiefe = d;
        if (d > 0.01) {
          anstoesse.push({ etappe: name, bauwerk: o.label, tiefeM: d, x: fig.x, z: fig.z });
        }
      }
    }
    box = neu;
    schritte++;
    spur.push({ etappe: name, x: l.x, z: l.z, gier: l.gier, lenk: l.lenk, knick: l.knick });
  };
  for (const e of f.etappen) {
    const laenge = streckenLaenge(e.route);
    let s = 0;
    let fertig = false;
    // Deckel gegen Endlosschleifen: die laengste Strecke ist rund 90 m.
    // 20.000 Schritte sind 5,5 Minuten Fahrzeit.
    for (let i = 0; i < 20000 && !fertig; i++) {
      const vorher = l.gier;
      if (!Number.isFinite(w.lenkrate)) {
        s = Math.min(s + e.tempo * SCHRITT_S, laenge);
        const p = poseAuf(e.route, s, e.rueckwaerts);
        l.x = p.x;
        l.z = p.z;
        l.gier = p.rot;
        fertig = s >= laenge;
        // Gefahren wird an der Hinterachse; beim Sprung ist das der Bogenschritt.
        messe(e.name, Math.abs(winkelRest(vorher, l.gier)) * (180 / Math.PI), e.tempo * SCHRITT_S);
        continue;
      }
      const r = folgeSchritt(l, fw, e.route, laenge, s, e.rueckwaerts, e.tempo, SCHRITT_S);
      s = r.s;
      fertig = r.fertig;
      messe(e.name, Math.abs(winkelRest(vorher, l.gier)) * (180 / Math.PI), r.weg);
    }
    if (!fertig) stecken.push(`${e.name} (${(laenge - s).toFixed(1)} m vor dem Ende)`);
    const ende = e.route[e.route.length - 1]!;
    maxEnd = Math.max(maxEnd, Math.hypot(l.x - ende[0], l.z - ende[1]));
  }
  knicke.sort((a, b) => b.sprungM - a.sprungM);
  anstoesse.sort((a, b) => b.tiefeM - a.tiefeM);
  return {
    plan: f.name,
    maxGrad,
    maxSprungM: maxSprung,
    maxTiefeM: maxTiefe,
    dauerS: schritte * SCHRITT_S,
    knicke: knicke.slice(0, 12),
    anstoesse: anstoesse.slice(0, 12),
    stecken,
    standDrehGrad: standDreh,
    maxEndAbweichungM: maxEnd,
    maxKnickGrad: maxKnick,
    minRadiusM: minRadius,
    spur,
  };
}
