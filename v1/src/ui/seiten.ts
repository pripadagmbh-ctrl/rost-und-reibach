/**
 * Pausenmenü: Sprache (E-170) und Datenschutz, Lizenzen, Support (E-171).
 *
 * Der Sprachknopf trägt beide Wörter („Sprache · Language") auf der Seite,
 * damit ihn auch findet, wer die gerade eingestellte Sprache nicht liest.
 *
 * Die drei Seiten liegen in `public/` und damit im App-Paket: Sie gehen
 * offline, und der Link ist relativ. Gezeigt werden sie in einem Rahmen über
 * dem Spiel — ein Wechsel der ganzen Seite würde in der iOS-App das Spiel
 * verlassen, und es gäbe keinen Weg zurück. Adressen außerhalb (apple.com,
 * Lizenzgeber) tragen in den Seiten `target="_blank"`; Capacitor öffnet sie
 * dann in Safari, im Browser in einem neuen Tab. So gibt es keinen Browser
 * im Spiel (Altersfreigabe: „Unrestricted Web Access: nein").
 */
import { setzeSprache, sprache } from "./sprache";

export function installSeiten(): void {
  const knopf = document.getElementById("pause-sprache");
  if (knopf) {
    const beschrifte = (): void => {
      knopf.textContent = sprache() === "de" ? "Sprache: Deutsch" : "Language: English";
    };
    beschrifte();
    knopf.addEventListener("click", () => {
      setzeSprache(sprache() === "de" ? "en" : "de");
      beschrifte();
    });
  }

  const feld = document.getElementById("seite");
  const rahmen = document.getElementById("seite-rahmen") as HTMLIFrameElement | null;
  if (!feld || !rahmen) return;
  document.querySelectorAll<HTMLElement>("[data-seite]").forEach((b) =>
    b.addEventListener("click", () => {
      // Englisch steht auf jeder Seite unter #en
      rahmen.src = `${b.dataset.seite}${sprache() === "en" ? "#en" : ""}`;
      rahmen.title = b.textContent ?? "";
      feld.classList.add("open");
    })
  );
  document.getElementById("seite-zu")?.addEventListener("click", () => feld.classList.remove("open"));
}
