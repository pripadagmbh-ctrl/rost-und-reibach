/**
 * Hörprobe (E-159): startet den Hörparcours (`audio/hoerparcours.ts`) und
 * zeigt oben im Bild, welche Station läuft. Der Knopf sitzt im Feld
 * „Lautstärke" des Pausenmenüs — dort ist Platz, das Pausenfeld selbst ist auf
 * dem iPhone mini voll. Ein zweiter Druck (Knopf oder Taste) hält an.
 */
import type { EventBus } from "../core/events";
import { starteHoerparcours, type HoerTon } from "../audio/hoerparcours";

export function installHoerprobe(m: { audio: HoerTon; bus: EventBus }): () => void {
  const zeile = document.getElementById("hoerprobe-zeile");
  const zeige = (text: string): void => {
    if (!zeile) return;
    zeile.textContent = text;
    zeile.hidden = text === "";
    if (text === "") stopp = null;
  };
  let stopp: (() => void) | null = null;
  const umschalten = (): void => {
    if (stopp) {
      stopp();
      stopp = null;
      return;
    }
    stopp = starteHoerparcours(m.audio, m.bus, zeige);
  };
  const knopf = document.getElementById("ton-hoerprobe");
  knopf?.addEventListener("click", () => {
    document.getElementById("ton")?.classList.remove("open");
    umschalten();
  });
  return umschalten;
}
