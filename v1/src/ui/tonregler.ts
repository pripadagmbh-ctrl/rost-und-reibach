/**
 * Lautstärke im Pausenmenü (E-139): drei Schieber Bagger, Metall, Musik.
 *
 * Der Knopf `pause-ton` verlässt die Pause und öffnet das Feld — wie das
 * Radio: Man hört beim Schieben, was sich ändert. Ein Tipp irgendwo auf die
 * Schiene setzt den Wert (Safari springt sonst nur, wenn man den Knopf
 * trifft). Gemerkt wird im AudioManager.
 */
import type { Lautgruppe } from "../audio/lautstaerke";

/** Was das Feld vom Ton braucht — mehr nicht. */
export interface TonRegler {
  lautstaerke(g: Lautgruppe): number;
  setLautstaerke(g: Lautgruppe, wert: number): void;
}

/** 0..1 → Anzeige „80 %". */
export const prozent = (v: number): string => `${Math.round(v * 100)} %`;

export function installTonregler(m: { audio: TonRegler; verlassePause: () => void }): () => void {
  const feld = document.getElementById("ton");
  if (!feld) return () => {};
  const regler = Array.from(feld.querySelectorAll<HTMLInputElement>('input[type="range"][data-gruppe]'));

  const zeige = (el: HTMLInputElement): void => {
    const out = document.getElementById(`${el.id}-wert`);
    if (out) out.textContent = prozent(Number(el.value) / 100);
  };
  const setze = (el: HTMLInputElement): void => {
    m.audio.setLautstaerke(el.dataset.gruppe as Lautgruppe, Number(el.value) / 100);
    zeige(el);
  };
  /** Wert aus der Fingerposition, auf die Schrittweite gerundet. */
  const ausFinger = (el: HTMLInputElement, x: number): void => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0) return;
    const step = Number(el.step) || 1;
    const v = Math.round((((x - r.left) / r.width) * 100) / step) * step;
    el.value = String(Math.min(100, Math.max(0, v)));
    setze(el);
  };

  for (const el of regler) {
    el.addEventListener("input", () => setze(el));
    el.addEventListener("pointerdown", (e) => {
      el.setPointerCapture(e.pointerId);
      ausFinger(el, e.clientX);
    });
    el.addEventListener("pointermove", (e) => {
      if (el.hasPointerCapture(e.pointerId)) ausFinger(el, e.clientX);
    });
  }

  const oeffne = (): void => {
    for (const el of regler) {
      el.value = String(Math.round(m.audio.lautstaerke(el.dataset.gruppe as Lautgruppe) * 100));
      zeige(el);
    }
    feld.classList.add("open");
  };
  document.getElementById("ton-close")?.addEventListener("click", () => feld.classList.remove("open"));
  document.getElementById("pause-ton")?.addEventListener("click", () => {
    m.verlassePause();
    oeffne();
  });
  return oeffne;
}
