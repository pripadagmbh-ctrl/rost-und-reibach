/**
 * DAS HAUPTMENÜ (E-118) — zwei Spielarten: SANDKASTEN und AUFGABEN.
 *
 * Es steht VOR dem Aufbau der Welt: `main.ts` wartet auf die Wahl und baut
 * erst dann den Platz. So bekommt eine Aufgabe ihren eigenen Platz, ohne
 * dass ein schon gebauter Platz wieder abgeräumt werden muss.
 *
 * Seit E-125 (06.10.2026) stehen die Aufgaben als Knöpfe in
 * `#hm-challenges`, mit der besten Sternzahl. Und das Menü kommt beim
 * ALLERERSTEN Start gar nicht erst: Patrick, „Mit Challenges soll das Spiel
 * anfangen, damit die Steuerung klar wird." Wer noch nie eine Aufgabe
 * begonnen hat (`leseChallenges()` in `core/save.ts` ist leer), landet direkt
 * in der ersten.
 *
 * Seit E-162 (Patrick 19.10.2026, Frage 1 A) werden sie NACHEINANDER
 * freigeschaltet: Aufgabe n+1 ist offen, sobald Aufgabe n mindestens einen
 * Stern hat. Der Sandkasten ist immer offen. Gesperrte Knöpfe sind
 * `disabled`, tragen ein Schloss UND sagen, was fehlt (Kap. 20: nie nur Farbe).
 * Alle Texte zweisprachig (`ui/aufgabentexte.ts`).
 */
import { CHALLENGES } from "../challenges/katalog";
import { sprache, waehle } from "../challenges/texte";
import { leseChallenges, type ChallengeStand } from "../core/save";
import { CHALLENGES_PAUSIERT } from "../core/spielart";
import { sterneText, uhrGenau, wort } from "./aufgabentexte";
import { leseBestenliste } from "../core/bestenliste";
import { installBestenliste } from "./bestenliste";
import { FIRMA } from "../world/werbung";

export type Spielwahl = { art: "sandkasten" } | { art: "challenge"; id: string };

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
 * NOCHMAL nach einer Aufgabe: Die Welt wird beim Start gebaut und nie
 * abgeräumt, also heißt nochmal „neu laden, und zwar direkt in dieselbe
 * Aufgabe". Das sagt die Adresse (`#challenge=verladen`) — keine Ablage,
 * nur ein Wegweiser für den nächsten Start, der beim Lesen gelöscht wird.
 * Seit E-162 ruft NOCHMAL das nicht mehr selbst (es sendet
 * `challenge:neustart`, main.ts entscheidet); `nochmal(id)` bleibt der
 * Rückfall und der Weg zur NÄCHSTEN AUFGABE.
 */
const ADRESSE = /^#challenge=([\w-]+)$/;

function challengeAusAdresse(): string | null {
  const m = ADRESSE.exec(location.hash);
  if (!m) return null;
  history.replaceState(null, "", location.pathname + location.search);
  return CHALLENGES.some((c) => c.id === m[1]) ? m[1]! : null;
}

export function nochmal(id: string): void {
  location.hash = `challenge=${id}`;
  location.reload();
}

export function zumMenue(): void {
  history.replaceState(null, "", location.pathname + location.search);
  location.reload();
}

/** Knopf mit Kopfzeile und Kleingedrucktem — Texte als Textknoten, nie als HTML. */
function beschrifte(b: HTMLElement, kopf: string, klein: string): void {
  const small = document.createElement("small");
  small.textContent = klein;
  b.replaceChildren(document.createTextNode(kopf), small);
}

/** Menü zeigen und auf die Wahl warten — oder gleich in eine Aufgabe. */
export function waehleSpielart(): Promise<Spielwahl> {
  // E-195: Bestenliste aus Haupt- und Pausenmenue — vor jedem Rueckweg, damit der Pausenknopf immer haengt
  installBestenliste();
  // Pausiert (E-129): kein Menue, keine Aufgabe — direkt in den Sandkasten.
  if (CHALLENGES_PAUSIERT) return Promise.resolve({ art: "sandkasten" });
  const stand = leseChallenges();
  const direkt = challengeAusAdresse() ?? (Object.keys(stand).length === 0 ? CHALLENGES[0]!.id : null);
  if (direkt) return Promise.resolve({ art: "challenge", id: direkt });

  const s = sprache();
  const ids = CHALLENGES.map((c) => c.id);
  const el = document.getElementById("hauptmenue")!;
  // Der Name kommt von der einen Stelle, die auch die Tafel am Tor liest (E-131)
  el.querySelector("h1")!.textContent = FIRMA;
  const liste = document.getElementById("hm-challenges")!;
  const sandkasten = document.getElementById("hm-sandkasten")!;
  const bestenKnopf = document.getElementById("hm-bestenliste");
  if (bestenKnopf) bestenKnopf.textContent = wort("bestenliste", s);
  const besten = leseBestenliste();
  // Diese Knöpfe beschriftet das Menü selbst in der gewählten Sprache —
  // die Seitenübersetzung (`ui/sprache.ts`) lässt sie darum aus.
  for (const k of [sandkasten, liste, bestenKnopf]) k?.setAttribute("translate", "no");
  beschrifte(sandkasten, wort("sandkasten", s), wort("sandkastenText", s));
  el.classList.add("open");
  return new Promise((fertig) => {
    const waehle_ = (w: Spielwahl): void => {
      el.classList.remove("open");
      fertig(w);
    };
    sandkasten.addEventListener("click", () => waehle_({ art: "sandkasten" }), { once: true });
    CHALLENGES.forEach((c, i) => {
      const b = document.createElement("button");
      const sterne = stand[c.id]?.sterne ?? 0;
      // E-195: Bestzeit = Zeit des besten Laufs (erst Sterne, dann Zeit)
      const best = besten.aufgaben[c.id]?.[0];
      // geschuetzte Leerzeichen: „· Bestzeit 1:23,45" bricht nicht auseinander
      const bestzeit = best ? `\u00a0· ${wort("bestzeit", s)}\u00a0${uhrGenau(best.zeitHs, s)}` : "";
      const frei = aufgabeFrei(i, ids, stand);
      const kopf = `${frei ? "" : "🔒 "}${wort("aufgabe", s)} ${i + 1} · ${waehle(c.name, s)}`;
      const klein = frei
        ? `${waehle(c.beschreibung, s)} ${sterne > 0 ? sterneText(sterne, s) : wort("nochNicht", s)}${bestzeit}`
        : `🔒 ${wort("gesperrt", s).replace("{n}", String(i))}`;
      beschrifte(b, kopf, klein);
      b.disabled = !frei;
      if (frei) b.addEventListener("click", () => waehle_({ art: "challenge", id: c.id }), { once: true });
      liste.appendChild(b);
    });
  });
}
