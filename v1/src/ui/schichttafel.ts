/**
 * DIE FEIERABEND-TAFEL DER SCHICHT (E-205) — Muster: `ui/abrechnung.ts` (E-113).
 *
 * Auf `schicht:ende`: Sirene (E-148) und Sterntoene, dann die Tafel mit den
 * Zahlen der Bilanz (`economy/kasse.ts`, E-203) — rechnet nichts nach, zeigt
 * an. Der Lauf kommt beim Zeigen in die Bestenliste (wie E-195), so kennt die
 * Tafel ihren Platz ohne Reihenfolge zwischen Zuhoerern.
 *
 * Eigenes Feld `#schichttafel` statt `#abrechnung`: Zehn Zeilen passen auf dem
 * iPhone mini quer nur zweispaltig, und die Knoepfe stehen dort
 * nebeneinander (Rechnung in `test/schichttafel.test.ts`). Schrift 14 px wie
 * die Abrechnung — die Tafel liest man (Kap. 20).
 *
 * Knoepfe: NOCHMAL (dieselbe Stufe), WEITER: <naechste Stufe> (nur wenn frei),
 * ZUM MENÜ. Alle drei laden neu — die Welt wird nie abgeraeumt.
 */
import type { EventBus } from "../core/events";
import { LAGER_ANTEIL, SCHICHTSTUFEN, schichtLauf, stufeFrei, type Schichtbilanz, type Schichtstufe } from "../economy/kasse";
import { REIN_GUT, REIN_MITTEL } from "../economy/shift";
import { sprache, type Sprache } from "../challenges/texte";
import { besteSchichtSterne, leseBestenliste, merkeSchicht } from "../core/bestenliste";
import { rangZeile, type Abrechnungszeile } from "./abrechnung";
import { sterneText, uhr, wort } from "./aufgabentexte";
import { zumMenue } from "./hauptmenue";
import { zurSchicht } from "./schichtmenue";
import { euro, schichtWort, stufenName, tonnenZahl } from "./schichttexte";

/** Farben wie auf der Abrechnung (E-113) — immer mit Zeichen oder Vorzeichen davor. */
const GRUEN = "#7ec96a";
const ORANGE = "#e08a5a";

/** Die Zahlen der Bilanz als Zeilen, in der Reihenfolge der Tafel (Konzept Abschnitt 4) — ohne DOM. */
export function schichtTafelZeilen(b: Schichtbilanz, s: Sprache): Abrechnungszeile[] {
  const q = b.sortierquote;
  const urteil =
    q >= REIN_GUT
      ? { z: "✓", w: schichtWort("sauber", s), farbe: GRUEN }
      : q >= REIN_MITTEL
        ? { z: "!", w: schichtWort("durchwachsen", s), farbe: undefined }
        : { z: "✗", w: schichtWort("zusammengekippt", s), farbe: ORANGE };
  const abzug = (eur: number): string => (eur > 0 ? euro(-eur, s) : euro(0, s));
  return [
    { name: schichtWort("tonnen", s), wert: `${tonnenZahl(b.tonnenUmgeschlagen, s)} t` },
    { name: schichtWort("quote", s), wert: `${urteil.z} ${Math.round(q * 100)} % ${urteil.w}`, farbe: urteil.farbe },
    { name: schichtWort("wartezeit", s), wert: uhr(b.warteS) },
    { name: schichtWort("erloes", s), wert: euro(b.erloesEur, s, true) },
    { name: schichtWort("lager", s).replace("{p}", String(Math.round(LAGER_ANTEIL * 100))), wert: euro(b.lagerwertEur, s, true) },
    { name: schichtWort("standgelder", s), wert: abzug(b.standgeldEur) },
    { name: schichtWort("fehlwuerfe", s), wert: abzug(b.fehlwurfEur) },
    { name: schichtWort("schaeden", s), wert: abzug(b.schadenEur) },
    {
      name: schichtWort("verdienst", s),
      wert: euro(b.verdienstEur, s, true),
      // Das Vorzeichen ist der Kanal, die Farbe bestaetigt
      farbe: b.verdienstEur > 0 ? GRUEN : b.verdienstEur < 0 ? ORANGE : undefined,
    },
  ];
}

/** Die naechste Stufe, wenn es eine gibt und sie jetzt frei ist. */
export function naechsteStufe(st: Schichtstufe, besteSterne: Partial<Record<Schichtstufe, number>>): Schichtstufe | null {
  const n = SCHICHTSTUFEN[SCHICHTSTUFEN.indexOf(st) + 1];
  return n && stufeFrei(n, besteSterne) ? n : null;
}

/** Was die Tafel nach einem Feierabend zeigt — und speichert dabei den Lauf. Ohne DOM pruefbar. */
export function feierabend(b: Schichtbilanz, s: Sprache, wann: Date = new Date()) {
  const platz = merkeSchicht(schichtLauf(b, wann));
  const sterne = besteSchichtSterne(leseBestenliste());
  // Wurde nicht gespeichert (Speicher gesperrt), zaehlt dieser Lauf fuers Weiter trotzdem
  sterne[b.stufe] = Math.max(sterne[b.stufe] ?? 0, b.sterne);
  return {
    kopf: `${schichtWort("feierabend", s)} · ${stufenName(b.stufe, s).toUpperCase()}`,
    sterne: sterneText(b.sterne, s),
    zeilen: schichtTafelZeilen(b, s),
    rang: rangZeile(platz, s),
    platz,
    naechste: naechsteStufe(b.stufe, sterne),
  };
}

export interface SchichtTafelAnschluss {
  bus: EventBus;
  audio: { playFeierabend(): void; playSterne(anzahl: number): void };
}

export interface SchichtTafel {
  /** Steht die Tafel im Bild? Solange ruht die Simulation (main.ts, wie `abrechnung.offen`). */
  readonly offen: boolean;
}

export function installSchichtTafel(m: SchichtTafelAnschluss): SchichtTafel {
  let offen = false;
  m.bus.on("schicht:ende", ({ bilanz }) => {
    // Ton am Ereignis (Regel 10), auch wenn die Seite fehlt
    m.audio.playFeierabend();
    m.audio.playSterne(bilanz.sterne);
    const s = sprache();
    const t = feierabend(bilanz, s);
    const feld = typeof document === "undefined" ? null : document.getElementById("schichttafel");
    if (!feld) return;
    const zeile = (z: Abrechnungszeile, klasse = "zeile"): HTMLElement => {
      const d = document.createElement("div");
      d.className = klasse;
      const name = document.createElement("span");
      name.textContent = z.name;
      const wert = document.createElement("span");
      wert.className = "wert";
      wert.textContent = z.wert;
      if (z.farbe) wert.style.color = z.farbe;
      d.append(name, wert);
      return d;
    };
    document.getElementById("st-kopf")!.textContent = t.kopf;
    document.getElementById("st-sterne")!.textContent = t.sterne;
    const verdienst = t.zeilen[t.zeilen.length - 1]!;
    document
      .getElementById("st-zahlen")!
      .replaceChildren(...t.zeilen.slice(0, -1).map((z) => zeile(z)), zeile(verdienst, "zeile summe"), zeile(t.rang, "zeile rang"));
    const knopf = (id: string, beschriftung: string, tu: (() => void) | null): void => {
      const b = document.getElementById(id)!;
      b.textContent = beschriftung;
      b.hidden = !tu;
      b.onclick = tu;
    };
    knopf("st-nochmal", wort("nochmal", s), () => zurSchicht(bilanz.stufe));
    const n = t.naechste;
    knopf("st-weiter", n ? schichtWort("weiterZu", s).replace("{tag}", stufenName(n, s).toUpperCase()) : "", n ? () => zurSchicht(n) : null);
    knopf("st-menue", wort("zumMenue", s), zumMenue);
    feld.classList.add("open");
    offen = true;
  });
  return {
    get offen(): boolean {
      return offen;
    },
  };
}
