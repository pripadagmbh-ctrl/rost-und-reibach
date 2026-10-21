/**
 * DIE LEKTIONSKARTE (E-196) — dieselbe Karte `#tutorial` wie bei den
 * Prüfungen (`ui/challengekarte.ts`), gleiche Stelle, gleiche Fassung
 * (`.aufgabe`), eigener Inhalt:
 *
 *   Lektion 2 · Schritt 1/4                         [▴ / Pause]
 *   Ziel: Den Hauptarm heben und senken.
 *   Schau zu: Hauptarm heben          (Phase „zeigen")
 *   Linker Stick nach oben: …         (bedientext, SEINE Belegung)
 *   Antippen überspringt
 *
 *   Jetzt du: Hauptarm heben          (Phase „du")
 *   ✓ Hauptarm heben                  (Häkchen, mit dem Klack)
 *
 * Hängt nur am Bus (Regel 10): liest `lehrgang:start/schritt/haekchen/
 * geschafft`, sendet `lehrgang:abbrechen` (Klick auf die Karte am Rechner —
 * auf Touch bricht jeder Daumen ab, der aufsetzt, `core/wiedergabe.ts`).
 *
 * Fortschritt: `lehrgang:start` merkt „begonnen" (nächster Start = Menü),
 * `lehrgang:geschafft` die Lektion (`core/save.ts`).
 *
 * Zuklappen nach 5 s auf dem Telefon quer wie bei den Prüfungen (E-164);
 * die Lesezeit ist die Spielzeit aus `takt(dt)` und steht in der Pause.
 */
import type { EventBus, GameEvents } from "../core/events";
import type { ControlConfig } from "../core/controlConfig";
import { merkeLehrgangBegonnen, merkeLektion } from "../core/save";
import { sprache, waehle, type Sprache } from "../challenges/texte";
import { wort } from "./aufgabentexte";
import { bedientext, Klappe, tippKnopf, zeile } from "./challengekarte";

type Start = GameEvents["lehrgang:start"];
type Schritt = GameEvents["lehrgang:schritt"];

export interface LektionsKartenText {
  kopf: string;
  ziel: string;
  titel: string;
  text: string;
  hinweis: string;
}

/** Rein: was auf der Karte steht. `touch` wählt „Antippen" oder „Klicken". */
export function lektionsKartenText(
  start: Start | null,
  schritt: Schritt | null,
  haken: boolean,
  c: ControlConfig,
  s: Sprache,
  touch: boolean
): LektionsKartenText {
  const nr = start?.nr ?? 0;
  const kopf = schritt
    ? `${wort("lektion", s)} ${nr} · ${wort("schritt", s)} ${schritt.nr}/${schritt.von}`
    : `${wort("lektion", s)} ${nr}`;
  const ziel = start ? `${wort("ziel", s)}: ${waehle(start.ziel, s)}` : "";
  if (!schritt) return { kopf, ziel, titel: start ? waehle(start.name, s) : "", text: "", hinweis: "" };
  const t = waehle(schritt.titel, s);
  const zeigen = schritt.phase === "zeigen";
  return {
    kopf,
    ziel,
    titel: haken ? `✓ ${t}` : `${wort(zeigen ? "schauZu" : "jetztDu", s)}: ${t}`,
    text: bedientext(waehle(schritt.text, s), c, s),
    hinweis: zeigen && !haken ? wort(touch ? "antippen" : "klickenUeberspringt", s) : "",
  };
}

export interface LektionsKarteAnschluss {
  bus: EventBus;
  steuerung: () => ControlConfig;
  /** Häkchen: der Klack aus `audioManager.playSchritt` */
  audio: { playSchritt(): void };
}

export interface LektionsKarte {
  /** Einmal je Bild außerhalb der Pause: Lesezeit fürs Zuklappen. */
  takt(dt: number): void;
  /** Nach einem Sprachwechsel. */
  neuBeschriften(): void;
}

export function installLektionsKarte(m: LektionsKarteAnschluss): LektionsKarte {
  // Der Fortschritt hängt am Bus, auch wenn die Karte im Markup fehlen sollte
  m.bus.on("lehrgang:start", () => merkeLehrgangBegonnen());
  m.bus.on("lehrgang:geschafft", (e) => merkeLektion(e.id));

  const karte = document.getElementById("tutorial");
  const innen = karte?.querySelector<HTMLElement>(".karte");
  const kopf = karte?.querySelector<HTMLElement>(".kopf");
  const schrittEl = document.getElementById("tut-schritt");
  const titelEl = document.getElementById("tut-titel");
  const textEl = document.getElementById("tut-text");
  const pause = document.getElementById("tut-pause");
  const skip = document.getElementById("tut-skip");
  const leer: LektionsKarte = { takt() {}, neuBeschriften() {} };
  if (!karte || !innen || !kopf || !schrittEl || !titelEl || !textEl || !pause) return leer;

  // Fassung der Prüfungskarte (index.html `.aufgabe`), dazu `.lektion`
  karte.classList.add("aufgabe", "lektion");
  karte.setAttribute("translate", "no");
  if (skip) skip.hidden = true;
  pause.setAttribute("type", "button");
  const links = document.createElement("span");
  links.className = "links";
  kopf.insertBefore(links, schrittEl);
  links.append(schrittEl);

  const neueZeile = (klasse: string): HTMLDivElement => {
    const d = document.createElement("div");
    d.className = `zusatz ${klasse}`;
    d.hidden = true;
    return d;
  };
  const zielEl = neueZeile("ziel");
  const hinweisEl = neueZeile("hinweis");
  innen.insertBefore(zielEl, titelEl);
  innen.append(hinweisEl);

  const setze = {
    kopf: zeile(schrittEl),
    ziel: zeile(zielEl),
    titel: zeile(titelEl),
    text: zeile(textEl),
    hinweis: zeile(hinweisEl),
  };
  const setzePause = zeile(pause, false);

  let start: Start | null = null;
  let schritt: Schritt | null = null;
  let haken = false;
  let t = 0;

  const klein = matchMedia("(max-height: 430px)");
  const klappe = new Klappe(() => klein.matches);
  const beschrifteKlappe = (s: Sprache): void => {
    const zu = karte.classList.contains("pausiert");
    if (klein.matches) {
      setzePause(zu ? "▾" : "▴");
      pause.setAttribute("aria-label", wort(zu ? "karteAufklappen" : "karteEinklappen", s));
    } else {
      setzePause(wort(zu ? "weiter" : "pause", s));
      pause.setAttribute("aria-label", wort("karteEinklappen", s));
    }
  };
  const zeigeKlappe = (): void => {
    if (karte.classList.contains("pausiert") === klappe.zu) return;
    karte.classList.toggle("pausiert", klappe.zu);
    beschrifteKlappe(sprache());
  };
  klein.addEventListener("change", () => beschrifteKlappe(sprache()));

  const zeige = (): void => {
    const s = sprache();
    const touch = document.body.classList.contains("touch");
    const x = lektionsKartenText(start, schritt, haken, m.steuerung(), s, touch);
    setze.kopf(x.kopf);
    setze.ziel(x.ziel);
    setze.titel(x.titel);
    setze.text(x.text);
    setze.hinweis(x.hinweis);
    // Am Rechner ist die Karte waehrend der Vorfuehrung anklickbar (index.html `.zeigt`)
    karte.classList.toggle("zeigt", schritt?.phase === "zeigen" && !haken);
    beschrifteKlappe(s);
  };

  tippKnopf(pause, () => {
    klappe.tippe();
    zeigeKlappe();
  });
  innen.addEventListener("pointerdown", () => {
    if (karte.classList.contains("zeigt")) m.bus.emit("lehrgang:abbrechen", {});
  });

  m.bus.on("lehrgang:start", (e) => {
    start = e;
    schritt = null;
    haken = false;
    t = 0;
    klappe.neustart();
    zeigeKlappe();
    zeige();
    karte.classList.add("open");
  });
  m.bus.on("lehrgang:schritt", (e) => {
    schritt = e;
    haken = false;
    zeige();
    klappe.zeige();
    zeigeKlappe();
    karte.classList.add("open");
  });
  m.bus.on("lehrgang:haekchen", () => {
    haken = true;
    m.audio.playSchritt();
    zeige();
  });
  m.bus.on("lehrgang:geschafft", () => {
    karte.classList.remove("open", "zeigt");
  });

  return {
    takt(dt: number): void {
      t += Math.max(0, dt);
      klappe.zeit(t);
      zeigeKlappe();
    },
    neuBeschriften: zeige,
  };
}
