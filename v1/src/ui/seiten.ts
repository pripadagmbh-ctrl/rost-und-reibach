/**
 * Pausenmenü, untere Zeile: Sprache (E-170).
 *
 * Der Sprachknopf trägt beide Wörter („Sprache · Language") auf der Seite,
 * damit ihn auch findet, wer die gerade eingestellte Sprache nicht liest.
 */
import { setzeSprache, sprache } from "./sprache";

export function installSeiten(): void {
  const knopf = document.getElementById("pause-sprache");
  if (!knopf) return;
  const beschrifte = (): void => {
    knopf.textContent = sprache() === "de" ? "Sprache: Deutsch" : "Language: English";
  };
  beschrifte();
  knopf.addEventListener("click", () => {
    setzeSprache(sprache() === "de" ? "en" : "de");
    beschrifte();
  });
}
