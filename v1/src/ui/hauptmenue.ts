/**
 * DAS HAUPTMENÜ (E-118) — zwei Spielarten: SANDKASTEN und CHALLENGES.
 *
 * Es steht VOR dem Aufbau der Welt: `main.ts` wartet auf die Wahl und baut
 * erst dann den Platz. So bekommt eine Challenge ihren eigenen Platz, ohne
 * dass ein schon gebauter Platz wieder abgeräumt werden muss.
 *
 * Seit E-125 (06.10.2026) stehen die Challenges als Knöpfe in
 * `#hm-challenges`, mit der besten Sternzahl. Und das Menü kommt beim
 * ALLERERSTEN Start gar nicht erst: Patrick, „Mit Challenges soll das Spiel
 * anfangen, damit die Steuerung klar wird." Wer noch nie eine Challenge
 * begonnen hat (`leseChallenges()` in `core/save.ts` ist leer), landet direkt
 * in der ersten.
 */
import { CHALLENGES } from "../challenges/katalog";
import { leseChallenges } from "../core/save";
import { CHALLENGES_PAUSIERT } from "../core/spielart";
import { sterneZeile } from "./abrechnung";
import { FIRMA } from "../world/werbung";

export type Spielwahl = { art: "sandkasten" } | { art: "challenge"; id: string };

/*
 * NOCHMAL nach einer Challenge: Die Welt wird beim Start gebaut und nie
 * abgeräumt, also heißt nochmal „neu laden, und zwar direkt in dieselbe
 * Challenge". Das sagt die Adresse (`#challenge=verladen`) — keine Ablage,
 * nur ein Wegweiser für den nächsten Start, der beim Lesen gelöscht wird.
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

/** Menü zeigen und auf die Wahl warten — oder gleich in eine Challenge. */
export function waehleSpielart(): Promise<Spielwahl> {
  // Pausiert (E-129): kein Menue, keine Challenge — direkt in den Sandkasten.
  if (CHALLENGES_PAUSIERT) return Promise.resolve({ art: "sandkasten" });
  const stand = leseChallenges();
  const direkt = challengeAusAdresse() ?? (Object.keys(stand).length === 0 ? CHALLENGES[0]!.id : null);
  if (direkt) return Promise.resolve({ art: "challenge", id: direkt });

  const el = document.getElementById("hauptmenue")!;
  // Der Name kommt von der einen Stelle, die auch die Tafel am Tor liest (E-131)
  el.querySelector("h1")!.textContent = FIRMA;
  const liste = document.getElementById("hm-challenges")!;
  el.classList.add("open");
  return new Promise((fertig) => {
    const waehle = (w: Spielwahl): void => {
      el.classList.remove("open");
      fertig(w);
    };
    document.getElementById("hm-sandkasten")!.addEventListener("click", () => waehle({ art: "sandkasten" }), {
      once: true,
    });
    CHALLENGES.forEach((c, i) => {
      const b = document.createElement("button");
      const s = stand[c.id]?.sterne ?? 0;
      b.innerHTML = `CHALLENGE ${i + 1} · ${c.name}<small></small>`;
      b.querySelector("small")!.textContent = `${c.beschreibung} ${s > 0 ? sterneZeile(s) : "Noch nicht geschafft."}`;
      b.addEventListener("click", () => waehle({ art: "challenge", id: c.id }), { once: true });
      liste.appendChild(b);
    });
  });
}
