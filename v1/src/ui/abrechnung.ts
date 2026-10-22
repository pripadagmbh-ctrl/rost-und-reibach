/**
 * DER FEIERABEND UND SEINE ABRECHNUNG (E-113, 22.09.2026).
 *
 * Der Platz zählte seinen Durchsatz hoch und hörte nie auf — ein Punktestand
 * ohne Anzeigetafel. Hier ist die Tafel: Um 18:00 ist Schluss, das Bild
 * zeigt die drei Kennzahlen aus Briefing Kap. 11 (Sortierquote, Gewinn,
 * ø Kundenzufriedenheit) und ein bis drei Sterne, danach fängt der nächste
 * Tag an.
 *
 * ## Was hier NICHT entschieden wird
 *
 * Keine Zahl. Die Uhr steht in `world/daylight.ts`, Torschluss, Feierabend,
 * Sortierquote und Sterne stehen in `economy/shift.ts`. Dieses Modul zeigt an
 * und macht Geräusche; es rechnet nichts nach. Sonst gäbe es zwei
 * Sortierquoten, und eine davon wäre falsch.
 *
 * ## Der Weg eines Feierabends
 *
 * 1. `shift.update(dt, lose, daylight.time)` setzt die Flanken (Spiellogik).
 * 2. `takt()` liest sie ab und schickt `tag:torschluss` / `tag:feierabend`
 *    über den Bus (Projektregel 10: Anzeige und Ton hängen nur an Events).
 * 3. Wer will, hängt sich an: das Feld hier, die Glocke, das Funkgerät.
 * 4. WEITER stellt die Uhr auf den frühen Morgen und nullt die Tageszähler.
 */
import { START_TIME } from "../world/daylight";
import { platzwache } from "../world/platzinventar";
import { zufriedenheit, type Shift, type Tagesbilanz } from "../economy/shift";
import { reinheitsUrteil } from "./hud";
import type { EventBus, GameEvents } from "../core/events";
import { erfuellt, type ChallengeWertung } from "../challenges/challenge";
import { CHALLENGES } from "../challenges/katalog";
import { sprache, waehle, type Sprache } from "../challenges/texte";
import { leseChallenges } from "../core/save";
import { naechsteFreieAufgabe, nochmal, zumMenue, zurLektion } from "./hauptmenue";
import { KRITERIEN, MESSGROESSEN, sterneText, wort } from "./aufgabentexte";
import { laufAus, merkeLauf } from "../core/bestenliste";
import { nachDemLehrgang, tagNachDemLehrgang } from "./schichtmenue";
import { stufenName } from "./schichttexte";

/** Eine Zeile der Abrechnung: links das Wort, rechts die Zahl. */
export interface Abrechnungszeile {
  name: string;
  wert: string;
  /** Farbe der Zahl, wenn sie ein Urteil trägt (sonst der Grundton) */
  farbe?: string;
}

/** Tonnen, Prozent und Euro, wie man sie hier schreibt. */
function tonnen(kg: number): string {
  return `${(kg / 1000).toFixed(1).replace(".", ",")} t`;
}
function prozent(anteil01: number): string {
  return `${Math.round(anteil01 * 100)} %`;
}
function euro(eur: number): string {
  return `${Math.round(eur).toLocaleString("de-DE")} €`;
}

/**
 * Die Sternzeile: Zeichen UND Wort (Briefing Kap. 20 — Farbe und Symbol sind
 * nie der einzige Kanal, und drei Sternchen sind auf einem Handy klein).
 */
export function sterneZeile(sterne: number, s: Sprache = "de"): string {
  // Eine Stelle fuer Feierabend und Aufgaben (E-162: auch Englisch)
  return sterneText(sterne, s);
}

/**
 * Die Zahlen des Tages als Zeilen — ohne DOM, damit sie prüfbar bleiben.
 *
 * Sechs Zeilen, keine sieben: Auf dem iPhone mini quer (375 px hoch) bleiben
 * neben Überschrift, Sternzeile und dem WEITER-Knopf keine mehr übrig. Darum
 * stehen Anlieferungen und Abholungen in einer Zeile.
 */
export function abrechnungszeilen(b: Tagesbilanz): Abrechnungszeile[] {
  const urteil = reinheitsUrteil(b.sortierquote);
  return [
    { name: "Umschlag heute", wert: tonnen(b.umschlagKg) },
    {
      name: "Sortierquote",
      wert: `${urteil.zeichen} ${prozent(b.sortierquote)} ${urteil.wort}`,
      farbe: urteil.farbe,
    },
    {
      name: "Gewinn",
      wert: `${b.gewinnEur >= 0 ? "+" : ""}${euro(b.gewinnEur)}`,
      // Das Vorzeichen ist der zweite Kanal, die Farbe nur die Bestätigung
      farbe: b.gewinnEur > 0 ? "#7ec96a" : b.gewinnEur < 0 ? "#e08a5a" : undefined,
    },
    { name: "Kontostand", wert: euro(b.kontoEur) },
    { name: "ø Zufriedenheit", wert: prozent(b.zufriedenheit) },
    { name: "Fuhren", wert: `${b.deliveries} rein · ${b.pickups} raus` },
  ];
}

/**
 * Die Zahlen einer Aufgabe als Zeilen — ohne DOM, damit sie prüfbar bleiben.
 * Eine Zeile je Messgroesse, nach der die Aufgabe wertet; dahinter, was es
 * für drei Sterne braucht. Ob eine Schwelle erfuellt ist, entscheidet
 * `erfuellt` aus `challenges/challenge.ts` — hier wird nichts nachgerechnet.
 * Zeichen UND Farbe (Kap. 20): ✓ reicht für drei Sterne, ✗ nicht einmal für zwei.
 */
export function challengeZeilen(e: GameEvents["challenge:geschafft"], s: Sprache = sprache()): Abrechnungszeile[] {
  const { zwei, drei } = e.wertung;
  const arten = MESSGROESSEN.filter((k) => zwei[k] !== undefined || drei[k] !== undefined);
  return arten.map((k) => {
    const v = e.messung[k];
    const kr = KRITERIEN[k];
    const name = waehle(kr.name, s);
    if (v === null || v === undefined) return { name, wert: `✗ ${wort("nichtGemessen", s)}`, farbe: "#e08a5a" };
    const ziel = drei[k] === undefined ? "" : ` (${wort("dreiBis", s)} ${kr.zahl(drei[k]!)})`;
    const wert = `${kr.zahl(v)}${kr.wort ? waehle(kr.wort, s) : ""}${ziel}`;
    const nur = (sw: ChallengeWertung["zwei"]): ChallengeWertung["zwei"] => ({ [k]: sw[k] });
    if (drei[k] !== undefined && erfuellt(nur(drei), e.messung)) return { name, wert: `✓ ${wert}`, farbe: "#7ec96a" };
    if (zwei[k] !== undefined && !erfuellt(nur(zwei), e.messung)) return { name, wert: `✗ ${wert}`, farbe: "#e08a5a" };
    return { name, wert };
  });
}

/** E-195: Wo der Lauf in der Bestenliste steht — `platz` aus `eintragen` (null = nicht unter den besten 5). */
export function rangZeile(platz: number | null, s: Sprache = sprache()): Abrechnungszeile {
  const wert =
    platz === 1 ? `★ ${wort("neuerRekord", s)}` : platz ? wort("platzVon", s).replace("{n}", String(platz)) : wort("nichtPlatziert", s);
  return { name: wort("rang", s), wert, farbe: platz === 1 ? "#f0b429" : undefined };
}

/** Was das Feld von außen braucht — mehr nicht. */
export interface AbrechnungsAnschluss {
  bus: EventBus;
  shift: Shift;
  hud: { toast(msg: string): void };
  audio: { playFeierabend(): void; playSterne(anzahl: number): void };
  funk: { torschluss(): void; neuerTag(): void };
  /** Kontostand jetzt — für Gewinn und den nächsten Morgen */
  konto: () => number;
  /** Der Ruf der drei Kundengruppen (`economy/reputation.ts`) */
  ruf: { get(gruppe: "privat" | "haendler" | "gewerbe"): number };
  /** Die Uhr aus `world/daylight.ts` — wird auf den Morgen zurückgestellt */
  daylight: { time: number; neuerTag: boolean };
  /** E-196: die Lektionen in ihrer Reihenfolge — WEITER fuehrt zur naechsten */
  lektionen?: readonly { id: string }[];
}

export interface Abrechnung {
  /** Einmal je Bild aus der Bildschleife: holt die Flanken ab. */
  takt(): void;
  /** Steht das Feld im Bild? Solange ruht die Simulation. */
  readonly offen: boolean;
}

export function installAbrechnung(m: AbrechnungsAnschluss): Abrechnung {
  const feld = document.getElementById("abrechnung");
  const kopf = document.getElementById("abr-kopf");
  const sterneEl = document.getElementById("abr-sterne");
  const zahlen = document.getElementById("abr-zahlen");
  const weiter = document.getElementById("abr-weiter");
  let offen = false;

  /** Kopf, Sternzeile und Zahlen in die Tafel — fuer Feierabend und Challenge (E-125). */
  const fuelle = (kopfText: string, sterne: number, zeilen: Abrechnungszeile[], s: Sprache = "de"): boolean => {
    if (!feld || !kopf || !sterneEl || !zahlen) return false;
    kopf.textContent = kopfText;
    sterneEl.textContent = sterneZeile(sterne, s);
    zahlen.innerHTML = "";
    for (const z of zeilen) {
      const zeile = document.createElement("div");
      zeile.className = "zeile";
      const name = document.createElement("span");
      name.textContent = z.name;
      const wert = document.createElement("span");
      wert.className = "wert";
      wert.textContent = z.wert;
      if (z.farbe) wert.style.color = z.farbe;
      zeile.append(name, wert);
      zahlen.appendChild(zeile);
    }
    feld.classList.add("open");
    offen = true;
    return true;
  };

  const zeige = (b: Tagesbilanz): void => {
    m.audio.playFeierabend();
    m.audio.playSterne(b.sterne);
    if (!fuelle(`FEIERABEND · TAG ${b.tag}`, b.sterne, abrechnungszeilen(b))) {
      // Ohne Markup bleibt die Abrechnung eine Einblendung — das Spiel läuft
      // weiter, statt am fehlenden Feld hängenzubleiben.
      m.hud.toast(`Feierabend · ${tonnen(b.umschlagKg)} · ${sterneZeile(b.sterne)}`);
    }
  };

  /*
   * Das Ende einer Aufgabe (E-125, E-162) — dieselbe Tafel, keine zweite Art
   * Abschlussbild. WEITER heisst hier NOCHMAL; darunter NÄCHSTE AUFGABE (nur
   * wenn es eine gibt und sie jetzt frei ist) und ZUM MENÜ. Ohne Glocke: Es
   * ist kein Feierabend, nur die Sterntöne.
   *
   * NOCHMAL laedt seit E-162 nicht mehr selbst neu: Es sendet
   * `challenge:neustart` und schliesst die Tafel — ob neu geladen oder neu
   * aufgebaut wird, entscheidet main.ts (wie beim ↻ auf der Karte).
   */
  let challengeId: string | null = null;
  const menue = document.getElementById("abr-menue");
  const naechste = document.getElementById("abr-naechste");
  let naechsteId: string | null = null;
  m.bus.on("challenge:geschafft", (e) => {
    const s = sprache();
    m.audio.playSterne(e.sterne);
    challengeId = e.id;
    // Die Ablage wird vielleicht erst NACH diesem Zuhoerer beschrieben (main.ts) —
    // das Ergebnis dieses Laufs zaehlt darum schon mit.
    const stand = leseChallenges();
    stand[e.id] = { sterne: Math.max(e.sterne, stand[e.id]?.sterne ?? 0) };
    naechsteId = naechsteFreieAufgabe(
      e.id,
      CHALLENGES.map((c) => c.id),
      stand
    );
    // E-195: Hier wird der Lauf gespeichert — so kennt die Tafel seinen Platz, ohne Reihenfolge zwischen Zuhoerern
    const rang = rangZeile(merkeLauf(e.id, laufAus(e)), s);
    if (!fuelle(`${wort("geschafft", s)} · ${waehle(e.name, s)}`, e.sterne, [rang, ...challengeZeilen(e, s)], s)) {
      m.hud.toast(`${wort("geschafft", s)} · ${sterneZeile(e.sterne, s)}`);
      return;
    }
    // Die Tafel schreibt hier selbst in der gewählten Sprache
    feld?.setAttribute("translate", "no");
    if (weiter) weiter.textContent = wort("nochmal", s);
    if (naechste) {
      naechste.textContent = wort("naechste", s);
      naechste.hidden = naechsteId === null;
    }
    if (menue) {
      menue.textContent = wort("zumMenue", s);
      menue.hidden = false;
    }
  });
  /*
   * Das Ende einer Lektion (E-196) — dieselbe Tafel, ohne Sterne: Kopf
   * „LEKTION GESCHAFFT · Name", statt der Sternzeile „✓ Lektion 3 von 12",
   * eine Zeile Zeit. Knoepfe in der Reihenfolge WEITER (naechste Lektion;
   * nach der letzten seit L8-B2: MONTAG, `nachDemLehrgang`), NOCHMAL, ZUM MENÜ. NOCHMAL sitzt dafuer
   * auf dem zweiten Knopf (`abr-naechste`). Beides laedt neu mit
   * `#lektion=<id>` — eine Lektion ist kurz, der Platz wird frisch gebaut.
   */
  let lektion: { id: string; weiter: () => void } | null = null;
  m.bus.on("lehrgang:geschafft", (e) => {
    const s = sprache();
    m.audio.playSterne(1); // dezent: ein Ton, keine Sternfolge
    const ids = (m.lektionen ?? []).map((l) => l.id);
    const i = ids.indexOf(e.id);
    const naechsteLektion = i >= 0 ? ids[i + 1] : undefined;
    // L8-B2 (Konzept Fassung 3): nach dem Lehrgang zur WOCHE, Montag — bis W1 der Platzhalter in ui/schichtmenue.ts
    lektion = {
      id: e.id,
      weiter: () => (naechsteLektion ? zurLektion(naechsteLektion) : nachDemLehrgang()),
    };
    // L4: EIN Lehrgang heisst LEHRGANG — der Name hinter „LEHRGANG GESCHAFFT" waere doppelt
    const kopf = ids.length > 1 ? `${wort("lektionGeschafft", s)} · ${waehle(e.name, s)}` : wort("lektionGeschafft", s);
    // L8-Nachtrag (Orchestrator 22.10.2026): keine Zeitzeile — der Lehrgang hat keine Uhr, und nach einem Wiedereinstieg zaehlte sie nur ab dort
    if (!fuelle(kopf, 0, [], s)) {
      m.hud.toast(kopf);
      return;
    }
    feld?.setAttribute("translate", "no");
    if (sterneEl) {
      // L4: EIN Lehrgang — „Lektion 1 von 1" sagt nichts, das ✓ reicht (Kopf sagt „LEHRGANG GESCHAFFT")
      sterneEl.textContent =
        ids.length > 1 ? wort("lektionVon", s).replace("{n}", String(e.nr)).replace("{m}", String(ids.length)) : "✓";
    }
    // Knopf = der Tag, kein „Pruefung" mehr: MONTAG / MONDAY (Wortliste ui/schichttexte.ts)
    if (weiter) weiter.textContent = naechsteLektion ? wort("weiterGross", s) : stufenName(tagNachDemLehrgang(), s).toUpperCase();
    if (naechste) {
      naechste.textContent = wort("nochmal", s);
      naechste.hidden = false;
    }
    if (menue) {
      menue.textContent = wort("zumMenue", s);
      menue.hidden = false;
    }
  });

  menue?.addEventListener("click", zumMenue);
  naechste?.addEventListener("click", () => {
    if (lektion) zurLektion(lektion.id);
    else if (naechsteId) nochmal(naechsteId);
  });

  const weiterSpielen = (): void => {
    if (!offen) return;
    if (lektion) {
      lektion.weiter();
      return;
    }
    if (challengeId) {
      offen = false;
      feld?.classList.remove("open");
      m.bus.emit("challenge:neustart", {});
      return;
    }
    offen = false;
    feld?.classList.remove("open");
    /*
     * Der neue Morgen. Die Uhr springt auf `START_TIME` (6:43) — dieselbe
     * Zahl, mit der das Spiel anfängt.
     *
     * Achtung, hier hängen zwei ältere Sachen dran: Weil die Uhr nun nie mehr
     * über Mitternacht läuft, würde der Tageswechsel in `daylight.update()`
     * nie wieder auslösen — der Kehrbesen käme nach einem Missgeschick nie
     * zurück (E-031) und der Müllcontainer würde nie geleert (E-034). Darum
     * werden beide Wege hier von Hand angestoßen. Sie zusammenzulegen ist ein
     * eigenes Paket; `world/daylight.ts` vermerkt das seit dem 15.09.2026.
     */
    m.daylight.time = START_TIME;
    m.daylight.neuerTag = true;
    platzwache.neuerTag();
    m.shift.naechsterTag(m.konto());
    m.bus.emit("tag:neu", { tag: m.shift.tag });
  };

  weiter?.addEventListener("click", weiterSpielen);
  /*
   * Eingabetaste als Beigabe, nicht als Weg: Beschriftet ist die Fläche
   * („WEITER"), und auf dem iPad gibt es keine Tastatur. Eine Taste ohne
   * Fläche wäre hier ein Sackgasse.
   */
  window.addEventListener("keydown", (e) => {
    if (!offen) return;
    if (e.code === "Enter" || e.code === "NumpadEnter") weiterSpielen();
  });

  m.bus.on("tag:torschluss", () => m.funk.torschluss());
  m.bus.on("tag:feierabend", (b) => zeige(b));
  m.bus.on("tag:neu", (e) => {
    m.funk.neuerTag();
    m.hud.toast(`Tag ${e.tag} — die Einfahrt ist wieder offen.`);
  });

  return {
    takt(): void {
      if (m.shift.torZuFlanke) {
        m.shift.torZuFlanke = false;
        m.bus.emit("tag:torschluss", {});
      }
      if (m.shift.feierabendFlanke) {
        m.shift.feierabendFlanke = false;
        m.bus.emit("tag:feierabend", m.shift.bilanz(m.konto(), zufriedenheit(m.ruf)));
      }
    },
    get offen(): boolean {
      return offen;
    },
  };
}
