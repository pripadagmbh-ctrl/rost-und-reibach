/**
 * Geführter Einstieg (Briefing Kap. 21).
 *
 * Wer den Platz zum ersten Mal sieht, weiß nicht, was zu tun ist: Da steht
 * ein Bagger, da liegt Schrott, und irgendwo fährt ein LKW. Diese Führung
 * zeigt den Kreislauf einmal durch — annehmen, sortieren, pressen, abholen
 * lassen — und hält sich danach heraus.
 *
 * Sie schreibt nichts vor und blockiert nichts. Jeder Schritt beobachtet nur,
 * ob das Ziel erreicht wurde, und der Spieler kann jederzeit abbrechen. Wer
 * schon weiß, wie es geht, wird nicht aufgehalten.
 */

export interface TutorialContext {
  /** Kunde steht an der Waage und wartet auf einen Preis */
  verhandeltGerade: boolean;
  /** Preis wurde ausgehandelt (mindestens einmal) */
  preisVereinbart: boolean;
  /** So viel liegt lose auf dem Platz */
  looseKg: number;
  /** Teile, die der Spieler in eine Mulde geworfen hat */
  sortiertKg: number;
  /** Die Schere hat mindestens einmal gepresst */
  gepresst: boolean;
  /** Ein Abholer wurde bestellt */
  abholerBestellt: boolean;
  /** So viel wurde insgesamt abgefahren */
  turnoverKg: number;
}

export interface TutorialStep {
  id: string;
  /** Überschrift der Karte */
  title: string;
  /** Was zu tun ist, in einem Satz */
  text: string;
  /** Erfüllt? Dann rückt die Führung weiter. */
  done: (c: TutorialContext) => boolean;
}

export const STEPS: TutorialStep[] = [
  {
    id: "umsehen",
    title: "Willkommen auf dem Platz",
    text:
      "Du sitzt im Umschlagbagger. Linker Stick: Hauptarm und Oberwagen, " +
      "rechter Stick: Ausleger und Greifer. Am Tablet setzt du den Daumen " +
      "einfach irgendwo in der linken bzw. rechten Bildhälfte auf — der Stick " +
      "erscheint dort. Zum Fahren tippst du die Pedale unten in der Mitte an — " +
      "dann fährt derselbe linke Stick. Sieh dich erst " +
      "einmal um — dreh den Oberwagen einmal herum.",
    done: () => true, // wird zeitgesteuert weitergeschaltet
  },
  {
    id: "annehmen",
    title: "Der erste Kunde",
    text:
      "Ein Kunde fährt auf die Waage. Nach der Wiegung nennst du deinen Preis. " +
      "Privatleute kennen die Notierung nicht, Händler jeden Cent — wer zu hart " +
      "drückt, sieht sie wieder abfahren.",
    done: (c) => c.preisVereinbart,
  },
  {
    id: "sortieren",
    title: "Sortieren bringt das Geld",
    text:
      "Greif den abgeladenen Schrott und wirf ihn in die passende Mulde. " +
      "Sortenrein verkauft sich um ein Vielfaches besser als gemischt — " +
      "das ist der ganze Kern des Geschäfts.",
    done: (c) => c.sortiertKg > 300,
  },
  {
    id: "pressen",
    title: "Mischschrott in die Presse",
    text:
      "Was sich nicht lohnt zu trennen, kommt in die Presse hinter dir. " +
      "Mit B schließt du die Klappen: Aus losem Schrott wird ein Paket, " +
      "das viel weniger Platz braucht.",
    done: (c) => c.gepresst,
  },
  {
    id: "abholen",
    title: "Abholung bestellen",
    text:
      "Mit V rufst du einen Abholer und wählst, welche Fraktion er mitnimmt. " +
      "Belade ihn sortenrein — erst wenn er vom Hof fährt, bekommst du Geld.",
    done: (c) => c.abholerBestellt,
  },
  {
    id: "verdienen",
    title: "Der Kreislauf steht",
    text:
      "Sobald die Ladung abgefahren ist, ist der erste Zyklus geschafft. " +
      "Von hier an gilt: Platz frei halten, sortenrein laden, umschlagen. " +
      "Mit dem Verdienten baust du den Platz aus (Taste G).",
    done: (c) => c.turnoverKg > 0,
  },
];

export class Tutorial {
  private index = 0;
  private t = 0;
  /** Abgeschlossen oder abgebrochen — dann meldet sich die Führung nicht mehr */
  finished = false;
  /**
   * Angehalten: Die Führung bleibt stehen, wo sie ist, und rückt nicht weiter.
   *
   * Der Unterschied zu `finished` ist der ganze Sinn (Ansage 14.09.2026: „das
   * Tutorial pausieren"): Übersprungen ist für immer weg, angehalten wartet.
   * Wer den Platz erst einmal in Ruhe ansehen will, verliert die Führung nicht,
   * und wer sie beim Ausprobieren im Weg hat, muss sie nicht opfern.
   *
   * Auch die Uhr steht dabei still. Sonst wäre der erste Schritt nach der Pause
   * sofort „reif" und die Führung spränge beim Fortsetzen ohne Zutun weiter.
   */
  paused = false;

  get step(): TutorialStep | null {
    return this.finished ? null : (STEPS[this.index] ?? null);
  }

  get progress(): string {
    return `${Math.min(this.index + 1, STEPS.length)}/${STEPS.length}`;
  }

  /**
   * Fortschritt prüfen. Der erste Schritt läuft nach ein paar Sekunden von
   * selbst weiter, die übrigen erst, wenn ihr Ziel erreicht ist.
   */
  update(dt: number, c: TutorialContext): boolean {
    if (this.finished || this.paused) return false;
    const step = STEPS[this.index];
    if (!step) {
      this.finished = true;
      return true;
    }
    this.t += dt;
    const zeitReif = step.id === "umsehen" ? this.t > 12 : true;
    if (zeitReif && step.done(c)) {
      this.index++;
      this.t = 0;
      if (this.index >= STEPS.length) this.finished = true;
      return true; // Schritt hat gewechselt
    }
    return false;
  }

  /** Der Spieler will die Führung nicht. */
  skip(): void {
    this.finished = true;
  }

  /** Anhalten oder fortsetzen. Gibt zurück, ob sie jetzt angehalten ist. */
  togglePause(): boolean {
    if (this.finished) return false;
    this.paused = !this.paused;
    return this.paused;
  }

  toJSON(): { index: number; finished: boolean; paused: boolean } {
    return { index: this.index, finished: this.finished, paused: this.paused };
  }

  load(d: { index?: number; finished?: boolean; paused?: boolean } | undefined): void {
    if (!d) return;
    this.index = d.index ?? 0;
    this.finished = d.finished ?? false;
    this.paused = d.paused === true;
  }
}
