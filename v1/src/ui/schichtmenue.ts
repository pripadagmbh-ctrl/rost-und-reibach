/**
 * SCHICHT IM HAUPTMENUE (E-205) — die zweite Stufe mit Montag, Mittwoch, Freitag.
 *
 * `ui/hauptmenue.ts` haengt sich mit wenigen Zeilen hier an (Knopf `#hm-schicht`,
 * Fall in `Spielwahl`, Adresse). Was eine Stufe im Menue zeigt, steht hier:
 * Name, eine Zeile Beschreibung, Sterne und Bestverdienst aus der Bestenliste,
 * bei Sperre Schloss UND Grund (Kap. 20: nie nur Farbe).
 *
 * Freigeschaltet wird nach `stufeFrei` (economy/kasse.ts, E-203: naechste ab
 * einem Stern); die Sterne kommen aus der Bestenliste (`besteSchichtSterne`).
 *
 * ADRESSE `#schicht=<stufe>` fuehrt direkt hinein — wie `#challenge=` und
 * `#lektion=` (NOCHMAL und WEITER auf der Tafel laden damit neu). Die Sperre
 * gilt dort nicht, ebenso wenig wie bei `#challenge=`: Die Adresse ist ein
 * Wegweiser fuer die Tafel und fuer Testlaeufe.
 */
import { SCHICHTSTUFEN, stufeFrei, type Schichtstufe } from "../economy/kasse";
import { waehle, type Sprache } from "../challenges/texte";
import { besteSchichtSterne, type Ablage } from "../core/bestenliste";
import { sterneText } from "./aufgabentexte";
import { euro, schichtWort, stufenName, STUFEN_TEXT } from "./schichttexte";

const ADRESSE = /^#schicht=(\w+)$/;

/** Rein: Adresse → Stufe, nur wenn es die Stufe gibt. */
export function schichtAusAdresse(hash: string): Schichtstufe | null {
  const m = ADRESSE.exec(hash);
  const st = m?.[1] as Schichtstufe | undefined;
  return st && SCHICHTSTUFEN.includes(st) ? st : null;
}

/** In eine Schicht (NOCHMAL, WEITER auf der Tafel): neu laden, direkt hinein. */
export function zurSchicht(st: Schichtstufe): void {
  location.hash = `schicht=${st}`;
  location.reload();
}

/*
 * NACH DEM LEHRGANG (L8-B2, Konzept Fassung 3: „nach dem Lehrgang geht es zur
 * WOCHE, Montag"). PLATZHALTER — W1 ersetzt das: Das Menue WOCHE gibt es noch
 * nicht. Bis dahin zeigt diese EINE Stelle auf den ersten freien Tag und
 * startet ihn als Schicht-Stufe, auf demselben Weg wie das Hauptmenue
 * (`#schicht=<stufe>` → `waehleSpielart` → Spielwahl „schicht"). Montag ist
 * immer frei (`stufeFrei`), also heute immer Montag.
 */
export function tagNachDemLehrgang(): Schichtstufe {
  return SCHICHTSTUFEN[0]!; // "montag"
}
/** WEITER auf der Tafel LEHRGANG GESCHAFFT (ui/abrechnung.ts). W1 ersetzt das. */
export function nachDemLehrgang(): void {
  zurSchicht(tagNachDemLehrgang());
}

/** Was ein Stufenknopf zeigt — ohne DOM, pruefbar. `beschr` blendet das Telefon quer aus. */
export interface StufenKnopf {
  stufe: Schichtstufe;
  frei: boolean;
  kopf: string;
  beschr: string;
  /** Sterne + Bestverdienst, oder Schloss + Grund */
  stand: string;
}

export function stufenKnopf(st: Schichtstufe, d: Ablage, s: Sprache): StufenKnopf {
  const sterne = besteSchichtSterne(d);
  const frei = stufeFrei(st, sterne);
  const name = stufenName(st, s).toUpperCase();
  const beschr = waehle(STUFEN_TEXT[st].beschr, s);
  if (!frei) {
    const vorige = SCHICHTSTUFEN[SCHICHTSTUFEN.indexOf(st) - 1]!;
    return { stufe: st, frei, kopf: `🔒 ${name}`, beschr, stand: `🔒 ${schichtWort("gesperrt", s).replace("{tag}", stufenName(vorige, s))}` };
  }
  const best = d.schichten[st]?.[0];
  const stand = best
    ? `${sterneText(sterne[st] ?? 0, s)} · ${schichtWort("bestVerdienst", s).replace("{e}", euro(best.verdienstEur, s))}`
    : schichtWort("nochNichtGespielt", s);
  return { stufe: st, frei, kopf: name, beschr, stand };
}

/** Die Knoepfe der zweiten Stufe; `beschrifte` und `waehle` reicht das Hauptmenue herein. */
export function schichtKnoepfe(
  d: Ablage,
  s: Sprache,
  beschrifte: (b: HTMLElement, kopf: string, ...klein: Array<{ text: string; klasse?: string }>) => void,
  waehle_: (st: Schichtstufe) => void
): HTMLButtonElement[] {
  return SCHICHTSTUFEN.map((st) => {
    const k = stufenKnopf(st, d, s);
    const b = document.createElement("button");
    beschrifte(b, k.kopf, { text: `${k.beschr} · `, klasse: "beschr" }, { text: k.stand });
    if (k.frei) b.addEventListener("click", () => waehle_(st));
    else b.disabled = true;
    return b;
  });
}
