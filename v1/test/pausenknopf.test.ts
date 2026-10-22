/**
 * DER ⏸-KNOPF NEBEN ☰ UND DAS ▶-FELD (Auftrag 43a) — auf einer Ersatz-Seite,
 * nur die zwei Elemente aus index.html und der Bus.
 *
 *  - ⏸ sendet `spiel:pause { art: "still" }`,
 *  - ▶ erscheint nur bei "still", nicht beim ☰-Menue ("menue"),
 *  - ▶-Tipp sendet `spiel:weiter`, jedes `spiel:weiter` blendet ▶ aus,
 *  - kein sichtbarer Text, Vorlesetexte in beiden Sprachen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventBus, type GameEvents } from "../src/core/events";
import { setzeSprachquelle, type Sprache } from "../src/challenges/texte";
import { installPausenknopf } from "../src/ui/pausenknopf";
import { seite } from "./cssmass";

let spr: Sprache = "de";
setzeSprachquelle(() => spr);

class El {
  hidden = false;
  attrs: Record<string, string> = {};
  private hoerer: Record<string, Array<(e: unknown) => void>> = {};
  constructor(public id: string) {}
  setAttribute(k: string, v: string) {
    this.attrs[k] = v;
  }
  getAttribute(k: string) {
    return this.attrs[k] ?? null;
  }
  addEventListener(t: string, f: (e: unknown) => void) {
    (this.hoerer[t] ??= []).push(f);
  }
  /** Ein Finger tippt: pointerdown und pointerup mit derselben Kennung. */
  tippe(id = 1) {
    const e = { pointerId: id, preventDefault() {}, stopPropagation() {} };
    for (const f of this.hoerer["pointerdown"] ?? []) f(e);
    for (const f of this.hoerer["pointerup"] ?? []) f(e);
  }
}

let el: Record<string, El>;
beforeEach(() => {
  el = { "btn-halt": new El("btn-halt"), weiterfeld: new El("weiterfeld") };
  el["weiterfeld"]!.hidden = true; // wie in index.html
  vi.stubGlobal("document", { getElementById: (id: string) => el[id] ?? null });
  spr = "de";
});
afterEach(() => vi.unstubAllGlobals());

function aufbau() {
  const bus = new EventBus();
  const pk = installPausenknopf({ bus });
  const gesendet: string[] = [];
  bus.on("spiel:pause", (e: GameEvents["spiel:pause"]) => gesendet.push(`pause:${e.art}`));
  bus.on("spiel:weiter", () => gesendet.push("weiter"));
  return { bus, pk, gesendet };
}
const feld = () => el["weiterfeld"]!;

describe("⏸ neben ☰ (43a)", () => {
  it("⏸ sendet spiel:pause still, ▶ erscheint, ▶-Tipp sendet spiel:weiter und verschwindet", () => {
    const { gesendet } = aufbau();
    expect(feld().hidden).toBe(true);
    el["btn-halt"]!.tippe();
    expect(gesendet).toEqual(["pause:still"]);
    expect(feld().hidden).toBe(false);
    feld().tippe();
    expect(gesendet).toEqual(["pause:still", "weiter"]);
    expect(feld().hidden).toBe(true);
  });

  it("☰-Menue (art menue) zeigt kein ▶", () => {
    const { bus } = aufbau();
    bus.emit("spiel:pause", { art: "menue" });
    expect(feld().hidden).toBe(true);
  });

  it("jedes spiel:weiter blendet ▶ aus — auch ESC/P am Rechner", () => {
    const { bus } = aufbau();
    bus.emit("spiel:pause", { art: "still" });
    expect(feld().hidden).toBe(false);
    bus.emit("spiel:weiter", {});
    expect(feld().hidden).toBe(true);
  });

  it("ein verborgenes ▶ sendet nichts (GEGENPROBE zum ersten Fall)", () => {
    const { gesendet } = aufbau();
    feld().tippe();
    expect(gesendet).toEqual([]);
  });

  it("Vorlesetexte in beiden Sprachen, Englisch ohne Umlaut", () => {
    const { pk } = aufbau();
    expect(el["btn-halt"]!.getAttribute("aria-label")).toBe("Pause");
    expect(feld().getAttribute("aria-label")).toBe("Weiter");
    spr = "en";
    pk.neuBeschriften();
    expect(el["btn-halt"]!.getAttribute("aria-label")).toBe("Pause");
    expect(feld().getAttribute("aria-label")).toBe("Resume");
    for (const id of ["btn-halt", "weiterfeld"]) expect(el[id]!.getAttribute("aria-label")).not.toMatch(/[äöüßÄÖÜ]/);
  });

  it("index.html: beide Elemente ohne sichtbaren Text, Zeichen nur als Bild", () => {
    for (const id of ["btn-halt", "weiterfeld"]) {
      const m = new RegExp(`<(div|button)[^>]*id="${id}"[^>]*>([\\s\\S]*?)</\\1>`).exec(seite);
      expect(m, id).not.toBeNull();
      expect(m![2]!.replace(/<[^>]*>/g, "").trim(), `${id} traegt Text`).toBe("");
      expect(m![2]).toContain("<svg");
      expect(m![0]).toMatch(/aria-label="[^"]+"/);
    }
    expect(seite, "das ⏸ der Zielzeile ist weg").not.toContain('id="zz-pause"');
  });
});
