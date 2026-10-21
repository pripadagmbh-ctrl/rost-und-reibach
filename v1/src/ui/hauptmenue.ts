/**
 * DAS HAUPTMENÜ (E-118) — seit E-196 zweistufig:
 *
 *   Stufe 1 (`#hm-haupt`): LEHRGANG · PRÜFUNGEN · (SCHICHT) · SANDKASTEN · BESTENLISTE
 *   Stufe 2 (`#hm-liste`):  die Prüfungen mit Sternen
 *
 * LEHRGANG ist seit L4 (Patrick 21.10.2026: „Alles in einem Durchgang") EIN
 * Knopf ohne Untermenü: Er startet den einen Lehrgang dort, wo der Spieler
 * aufgehört hat (`lehrgangEinstieg` in core/save.ts, main.ts reicht es an
 * `LektionLauf.start`), Kleingedrucktes „Schritt n von m" bzw. „✓ geschafft".
 *
 * Zweistufig, weil fünf Hauptknöpfe plus sechs Prüfungen auf dem iPhone mini
 * quer (354 px nutzbare Höhe) nur mit Scrollen in eine Liste passten. Rechnung bei `#hauptmenue` in index.html und in
 * `test/hauptmenue-platz.test.ts`.
 *
 * Es steht VOR dem Aufbau der Welt: `main.ts` wartet auf die Wahl und baut
 * erst dann den Platz.
 *
 * ERSTER START (E-125, seit E-196): Wer weder eine Prüfung noch den Lehrgang
 * je begonnen hat, landet ohne Menü in Lektion 1 — „Intro zu allen
 * Funktionalitäten" (Patrick 21.10.2026). Ohne Lektionen (Lehrgang nicht
 * angeschlossen) wie bisher in Prüfung 1.
 *
 * Prüfungen werden NACHEINANDER freigeschaltet (E-162): n+1 ist offen, sobald
 * n mindestens einen Stern hat. Der Lehrgang ist jederzeit wiederholbar und
 * sperrt nichts (auch übersprungen nicht). Gesperrte Knöpfe sind `disabled`, tragen ein Schloss UND
 * sagen, was fehlt (Kap. 20: nie nur Farbe). Alle Texte zweisprachig.
 *
 * EIN WEITERER HAUPTKNOPF (z. B. SCHICHT): ein `<button id="hm-…">` an seiner
 * Stelle in `#hm-haupt` (index.html), eine Zeile `haupt(…)` unten in
 * `waehleSpielart`, ein Fall in `Spielwahl`. Das Raster in index.html nimmt
 * vier oder fünf Knöpfe ohne Änderung.
 */
import { CHALLENGES } from "../challenges/katalog";
import { sprache, waehle, type Sprache, type Zweisprachig } from "../challenges/texte";
import { leseChallenges, leseLehrgang, type ChallengeStand, type LehrgangStand } from "../core/save";
import { CHALLENGES_PAUSIERT } from "../core/spielart";
import { sterneText, uhrGenau, wort } from "./aufgabentexte";
import { leseBestenliste } from "../core/bestenliste";
import { installBestenliste } from "./bestenliste";
import { FIRMA } from "../world/werbung";
import type { Schichtstufe } from "../economy/kasse";
import { schichtAusAdresse, schichtKnoepfe } from "./schichtmenue";
import { schichtWort } from "./schichttexte";

export type Spielwahl =
  | { art: "sandkasten" }
  | { art: "challenge"; id: string }
  /** E-196: eine Lektion des Lehrgangs */
  | { art: "lektion"; id: string }
  /** E-205: eine Schicht (ui/schichtmenue.ts) */
  | { art: "schicht"; stufe: Schichtstufe };

/** Was das Menü von einer Lektion braucht — die Lektionsdaten (`challenges/lektion.ts`) passen von selbst. */
export interface LektionEintrag {
  id: string;
  name: Zweisprachig;
  /** nur gezählt: „Schritt n von m" */
  schritte?: readonly unknown[];
}

/**
 * Ist die Aufgabe an Stelle `i` (ab 0) offen? Die erste immer, jede weitere,
 * sobald die vorige mindestens einen Stern hat. Rein, damit pruefbar.
 */
export function aufgabeFrei(i: number, ids: readonly string[], stand: ChallengeStand): boolean {
  if (i <= 0) return i === 0 && ids.length > 0;
  if (i >= ids.length) return false;
  return (stand[ids[i - 1]!]?.sterne ?? 0) >= 1;
}

/** Die Aufgabe nach `id`, falls es eine gibt und sie bei diesem Stand offen ist — sonst null. */
export function naechsteFreieAufgabe(id: string, ids: readonly string[], stand: ChallengeStand): string | null {
  const i = ids.indexOf(id);
  if (i < 0 || i + 1 >= ids.length) return null;
  return aufgabeFrei(i + 1, ids, stand) ? ids[i + 1]! : null;
}

/*
 * NOCHMAL / WEITER: Die Welt wird beim Start gebaut und nie abgeräumt, also
 * heißt „eine andere Aufgabe/Lektion" neu laden, und zwar direkt dorthin. Das
 * sagt die Adresse (`#challenge=verladen`, `#lektion=sticks`) — keine Ablage,
 * nur ein Wegweiser für den nächsten Start, der beim Lesen gelöscht wird.
 */
const ADRESSE = /^#(challenge|lektion)=([\w-]+)$/;

/** Rein: Adresse → Wahl, nur wenn es die Aufgabe bzw. Lektion gibt. */
export function wahlAusAdresse(
  hash: string,
  lektionIds: readonly string[],
  challengeIds: readonly string[]
): Spielwahl | null {
  const m = ADRESSE.exec(hash);
  if (!m) return null;
  const id = m[2]!;
  if (m[1] === "lektion") return lektionIds.includes(id) ? { art: "lektion", id } : null;
  return challengeIds.includes(id) ? { art: "challenge", id } : null;
}

/** Erster Start = weder eine Prüfung noch der Lehrgang je begonnen (auch nicht übersprungen). */
export function ersterStart(challenges: ChallengeStand, lehrgang: LehrgangStand): boolean {
  return (
    Object.keys(challenges).length === 0 &&
    !lehrgang.begonnen &&
    !lehrgang.fertig &&
    !lehrgang.uebersprungen &&
    lehrgang.schritt === 0
  );
}

/** Rein: Wohin es ohne Menü geht — Adresse vor erstem Start; null = Menü zeigen. */
export function startWahl(
  adresse: Spielwahl | null,
  challenges: ChallengeStand,
  lehrgang: LehrgangStand,
  lektionIds: readonly string[],
  challengeIds: readonly string[]
): Spielwahl | null {
  if (adresse) return adresse;
  if (!ersterStart(challenges, lehrgang)) return null;
  if (lektionIds[0]) return { art: "lektion", id: lektionIds[0] };
  return challengeIds[0] ? { art: "challenge", id: challengeIds[0] } : null;
}

/** Rein: Kleingedrucktes am LEHRGANG-Knopf — „Schritt n von m" (n = der nächste) bzw. „✓ geschafft" (Zeichen UND Wort, Kap. 20). */
export function lehrgangKlein(stand: LehrgangStand, schritte: number, s: Sprache): string {
  if (stand.fertig) return wort("lehrgangFertig", s);
  const n = Math.min(stand.schritt + 1, Math.max(1, schritte));
  return wort("lehrgangSchritt", s).replace("{n}", String(n)).replace("{m}", String(schritte));
}

function adresseLoeschen(): void {
  history.replaceState(null, "", location.pathname + location.search);
}

export function nochmal(id: string): void {
  location.hash = `challenge=${id}`;
  location.reload();
}

/** E-196: in eine Lektion (NOCHMAL, WEITER auf der Tafel). */
export function zurLektion(id: string): void {
  location.hash = `lektion=${id}`;
  location.reload();
}

export function zumMenue(): void {
  adresseLoeschen();
  location.reload();
}

/** Knopf mit Kopfzeile und Kleingedrucktem — Texte als Textknoten, nie als HTML. */
function beschrifte(b: HTMLElement, kopf: string, ...klein: Array<{ text: string; klasse?: string }>): void {
  const small = document.createElement("small");
  for (const k of klein) {
    if (!k.klasse) {
      small.append(k.text);
      continue;
    }
    const span = document.createElement("span");
    span.className = k.klasse;
    span.textContent = k.text;
    small.append(span);
  }
  b.replaceChildren(document.createTextNode(kopf), ...(klein.length ? [small] : []));
}

/**
 * Menü zeigen und auf die Wahl warten — oder gleich in eine Aufgabe/Lektion.
 * `lektionen`: die Lektionen des Lehrgangs in ihrer Reihenfolge (main.ts
 * reicht sie aus `challenges/lektion.ts` herein); leer = kein LEHRGANG.
 */
export function waehleSpielart(lektionen: readonly LektionEintrag[] = []): Promise<Spielwahl> {
  // E-195: Bestenliste aus Haupt- und Pausenmenue — vor jedem Rueckweg, damit der Pausenknopf immer haengt
  installBestenliste();
  // Pausiert (E-129): kein Menue, keine Aufgabe — direkt in den Sandkasten.
  if (CHALLENGES_PAUSIERT) return Promise.resolve({ art: "sandkasten" });
  // E-205: `#schicht=<stufe>` fuehrt direkt hinein (NOCHMAL/WEITER der Schicht-Tafel)
  const schichtAdresse = schichtAusAdresse(location.hash);
  if (schichtAdresse) {
    adresseLoeschen();
    return Promise.resolve({ art: "schicht", stufe: schichtAdresse });
  }
  const stand = leseChallenges();
  const lehrgang = leseLehrgang();
  const ids = CHALLENGES.map((c) => c.id);
  const lektionIds = lektionen.map((l) => l.id);
  const adresse = wahlAusAdresse(location.hash, lektionIds, ids);
  if (ADRESSE.test(location.hash)) adresseLoeschen();
  const direkt = startWahl(adresse, stand, lehrgang, lektionIds, ids);
  if (direkt) return Promise.resolve(direkt);

  const s = sprache();
  const el = document.getElementById("hauptmenue")!;
  // Der Name kommt von der einen Stelle, die auch die Tafel am Tor liest (E-131)
  el.querySelector("h1")!.textContent = FIRMA;
  const hauptEl = document.getElementById("hm-haupt")!;
  const listeEl = document.getElementById("hm-liste")!;
  const eintraege = document.getElementById("hm-eintraege")!;
  const listenTitel = document.getElementById("hm-listentitel")!;
  const zurueckKnopf = document.getElementById("hm-zurueck")!;
  zurueckKnopf.textContent = `← ${wort("zurueck", s)}`;
  const besten = leseBestenliste();

  return new Promise((fertig) => {
    let gewaehlt = false;
    const waehle_ = (w: Spielwahl): void => {
      if (gewaehlt) return;
      gewaehlt = true;
      el.classList.remove("open");
      fertig(w);
    };

    /** Ein Hauptknopf (Stufe 1). Fehlt der Knopf im Markup, fehlt er eben. */
    const haupt = (id: string, kopf: string, klein: string, tu: () => void): void => {
      const b = document.getElementById(id);
      if (!b) return;
      beschrifte(b, kopf, ...(klein ? [{ text: klein }] : []));
      b.addEventListener("click", tu);
    };

    /** Stufe 2 zeigen: Titel, Knöpfe, Zurück. */
    const zeigeListe = (titel: string, art: "pruefungen" | "schichten", knoepfe: HTMLButtonElement[]): void => {
      listenTitel.textContent = titel;
      eintraege.className = art;
      eintraege.replaceChildren(...knoepfe);
      hauptEl.hidden = true;
      listeEl.hidden = false;
      el.classList.add("liste"); // Telefon quer: Ueberschrift aus, Platz fuer die Liste
    };
    const zurueck = (): void => {
      listeEl.hidden = true;
      hauptEl.hidden = false;
      el.classList.remove("liste");
    };
    zurueckKnopf.addEventListener("click", zurueck);
    window.addEventListener("keydown", (e) => {
      if (e.code === "Escape" && !listeEl.hidden && el.classList.contains("open")) zurueck();
    });

    const pruefungsKnoepfe = (): HTMLButtonElement[] =>
      CHALLENGES.map((c, i) => {
        const b = document.createElement("button");
        const sterne = stand[c.id]?.sterne ?? 0;
        // E-195: Bestzeit = Zeit des besten Laufs (erst Sterne, dann Zeit)
        const best = besten.aufgaben[c.id]?.[0];
        // geschuetzte Leerzeichen: „· Bestzeit 1:23,45" bricht nicht auseinander
        const bestzeit = best ? ` · ${wort("bestzeit", s)} ${uhrGenau(best.zeitHs, s)}` : "";
        const frei = aufgabeFrei(i, ids, stand);
        const kopf = `${frei ? "" : "🔒 "}${wort("aufgabe", s)} ${i + 1} · ${waehle(c.name, s)}`;
        if (frei) {
          // Die Beschreibung blendet das Telefon quer aus (index.html `.beschr`) — Sterne und Zeit bleiben
          beschrifte(
            b,
            kopf,
            { text: `${waehle(c.beschreibung, s)} `, klasse: "beschr" },
            { text: `${sterne > 0 ? sterneText(sterne, s) : wort("nochNicht", s)}${bestzeit}` }
          );
          b.addEventListener("click", () => waehle_({ art: "challenge", id: c.id }));
        } else {
          beschrifte(b, kopf, { text: `🔒 ${wort("gesperrt", s).replace("{n}", String(i))}` });
          b.disabled = true;
        }
        return b;
      });

    // --- Stufe 1, in der Reihenfolge von #hm-haupt (index.html)
    // L4: EIN Lehrgang — die erste (einzige) Lektion; wo er weitermacht, sagt main.ts dem Lauf (`lehrgangEinstieg`)
    const lg = lektionen[0];
    const lehrgangKnopf = document.getElementById("hm-lehrgang");
    if (lehrgangKnopf) lehrgangKnopf.hidden = !lg;
    if (lg) {
      haupt("hm-lehrgang", wort("lehrgang", s), lehrgangKlein(lehrgang, lg.schritte?.length ?? 0, s), () =>
        waehle_({ art: "lektion", id: lg.id })
      );
    }
    haupt("hm-pruefungen", wort("pruefungen", s), wort("pruefungenText", s), () =>
      zeigeListe(wort("pruefungen", s), "pruefungen", pruefungsKnoepfe())
    );
    haupt("hm-schicht", schichtWort("schicht", s), schichtWort("schichtText", s), () =>
      zeigeListe(schichtWort("schichten", s), "schichten", schichtKnoepfe(besten, s, beschrifte, (stufe) => waehle_({ art: "schicht", stufe })))
    );
    haupt("hm-sandkasten", wort("sandkasten", s), wort("sandkastenText", s), () => waehle_({ art: "sandkasten" }));
    // BESTENLISTE oeffnet `ui/bestenliste.ts` selbst (installBestenliste oben)
    const bestenKnopf = document.getElementById("hm-bestenliste");
    if (bestenKnopf) beschrifte(bestenKnopf, wort("bestenliste", s));

    hauptEl.hidden = false;
    listeEl.hidden = true;
    el.classList.add("open");
  });
}
