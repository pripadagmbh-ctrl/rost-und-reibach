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
import type { ControlConfig } from "../core/controlConfig";
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

export function installGeisterdaumen(m: { bus: EventBus; steuerung: () => ControlConfig }): void {
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
  document.body.appendChild(halter);

  let bild: DaumenBild | null = null;
  let aus = true; // nach `geschafft` bis zum naechsten Schritt
  let gezeigt = ""; // was gerade im DOM steht — geschrieben wird nur bei Aenderung

  /** Liegt ein echter Daumen in dieser Zone? Der Stickkreis ist dann eingeblendet. */
  const daumenDrauf = (seite: "links" | "rechts"): boolean => {
    const pad = document.getElementById(seite === "links" ? "touch-left" : "touch-right");
    return !!pad && !pad.hidden;
  };

  const auffrischen = (): void => {
    const sichtbar =
      !aus && bild !== null && document.body.classList.contains("touch") && !daumenDrauf(bild.seite);
    const soll = sichtbar && bild ? `${bild.seite}:${bild.pfeil}` : "";
    if (soll === gezeigt) return;
    gezeigt = soll;
    for (const seite of ["links", "rechts"] as const) {
      const an = sichtbar && bild?.seite === seite;
      const { el, pfeil } = g[seite];
      el.classList.toggle("an", an);
      if (!an || !bild) continue;
      // Die Klasse waehlt die Bewegung (CSS-Keyframes je Richtung, index.html)
      el.dataset["pfeil"] = bild.pfeil;
      pfeil.textContent = ZEICHEN[bild.pfeil];
    }
  };

  m.bus.on("challenge:start", () => {
    bild = null;
    aus = false;
    auffrischen();
  });
  m.bus.on("challenge:schritt", (e) => {
    aus = false;
    bild = daumenBild(e.zeige, m.steuerung());
    auffrischen();
  });
  // Einmal je Bild: reicht, um den echten Daumen zu bemerken (keine Layoutabfrage, nur `hidden`)
  m.bus.on("challenge:stand", () => auffrischen());
  m.bus.on("challenge:geschafft", () => {
    aus = true;
    bild = null;
    auffrischen();
  });
}
