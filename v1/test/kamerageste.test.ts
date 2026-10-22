import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as THREE from "three";
import { TouchControls, type KameraEingabe } from "../src/core/touch";
import { OrbitCamera } from "../src/excavator/orbitCamera";
import type { Input } from "../src/core/input";

/*
 * E-136 (Gerätebefund 17.10.2026): Kamera drehen ohne Ansichtswechsel.
 * Bewacht wird: Ein Finger im Mittelstreifen dreht, einer auf dem Stick nicht;
 * zwei Finger kneifen = Zoom; die Geister-Zeiger-Sicherung lässt auch den
 * Streifen los; jede Ansicht dreht sich.
 *
 * Es gibt kein Browser-Dokument im Testlauf. Die Seite wird darum mit
 * Attrappen nachgebaut, die nur Ereignisse sammeln und abfeuern — so läuft
 * der echte TouchControls-Code, nicht eine Kopie.
 */

type Handler = (e: unknown) => void;
interface Attrappe {
  id: string;
  fire(typ: string, e: Record<string, unknown>): void;
}

function attrappe(id: string): Attrappe & Record<string, unknown> {
  const h: Record<string, Handler[]> = {};
  return {
    id,
    style: {},
    dataset: {},
    hidden: true,
    offsetWidth: 100,
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener: (t: string, f: Handler) => (h[t] ??= []).push(f),
    setPointerCapture() {},
    querySelector: () => attrappe(`${id}-knob`),
    appendChild() {},
    fire(typ, e) {
      for (const f of h[typ] ?? []) f({ preventDefault() {}, pointerType: "touch", pressure: 0, ...e });
    },
  };
}

let seite: Map<string, ReturnType<typeof attrappe>>;
let dok: ReturnType<typeof attrappe>;

beforeEach(() => {
  seite = new Map();
  dok = attrappe("document");
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.stubGlobal("document", {
    ...dok,
    body: { classList: { add() {} } },
    getElementById: (id: string) => {
      if (!seite.has(id)) seite.set(id, attrappe(id));
      return seite.get(id);
    },
    querySelectorAll: () => [],
    createElement: () => attrappe("neu"),
  });
});

function bauen(): { touch: TouchControls; k: KameraEingabe } {
  const k: KameraEingabe = { orbitDX: 0, orbitDY: 0, zoomFactor: 1, camReset: false };
  const touch = new TouchControls(attrappe("canvas") as unknown as HTMLElement, k);
  return { touch, k };
}

const zieh = (zone: string, id: number, von: [number, number], nach: [number, number]): void => {
  const z = seite.get(zone)!;
  z.fire("pointerdown", { pointerId: id, clientX: von[0], clientY: von[1] });
  z.fire("pointermove", { pointerId: id, clientX: nach[0], clientY: nach[1] });
};

describe("Kamera-Geste im Mittelstreifen (E-136)", () => {
  it("ein Finger im Streifen dreht die Kamera", () => {
    const { k } = bauen();
    zieh("zone-mitte", 1, [500, 300], [540, 290]);
    expect(k.orbitDX).toBeGreaterThan(0);
    expect(k.orbitDY).toBeLessThan(0);
  });

  it("ein Finger auf dem Stick dreht sie nicht — er gehört dem Stick", () => {
    const { touch, k } = bauen();
    zieh("zone-right", 1, [900, 300], [960, 300]);
    zieh("zone-left", 2, [100, 300], [100, 360]);
    touch.update();
    expect(k.orbitDX).toBe(0);
    expect(k.orbitDY).toBe(0);
    // ... und der Stick hat den Zug bekommen
    const a = touch.axes;
    expect(Math.abs(a.grapple) + Math.abs(a.boom) + Math.abs(a.stick) + Math.abs(a.cab)).toBeGreaterThan(0);
  });

  it("zwei Finger auseinander zoomen heran, ohne zu drehen", () => {
    const { k } = bauen();
    const z = seite.get("zone-mitte")!;
    z.fire("pointerdown", { pointerId: 1, clientX: 480, clientY: 300 });
    z.fire("pointerdown", { pointerId: 2, clientX: 560, clientY: 300 });
    z.fire("pointermove", { pointerId: 2, clientX: 640, clientY: 300 });
    expect(k.zoomFactor).toBeCloseTo(0.5, 6); // Spanne 80 -> 160 px
    expect(k.orbitDX).toBe(0);
  });

  it("kein Finger mehr auf dem Glas lässt auch den Streifen los", () => {
    const { touch, k } = bauen();
    zieh("zone-mitte", 7, [500, 300], [510, 300]);
    touch.releaseAll();
    const vorher = k.orbitDX;
    seite.get("zone-mitte")!.fire("pointermove", { pointerId: 7, clientX: 600, clientY: 300 });
    expect(k.orbitDX).toBe(vorher);
  });

  it("die Seite hat den Streifen zwischen den Stick-Zonen, ohne Überlappung", () => {
    const html = readFileSync(resolve(__dirname, "../index.html"), "utf8");
    expect(html).toContain('id="zone-mitte"');
    const breite = Number(/#touch \.zone \{[^}]*width: (\d+)%/.exec(html)![1]);
    const mitte = /#zone-mitte \{ left: (\d+)%; width: (\d+)%/.exec(html)!;
    expect(Number(mitte[1])).toBe(breite);
    expect(breite * 2 + Number(mitte[2])).toBe(100);
  });
});

/*
 * 40e (22.10.2026): Die Pedale stehen jetzt unten IM Mittelstreifen. Ein Tipp
 * auf sie darf die Kamera nicht erreichen, und ein Kamera-Zug, der ueber sie
 * laeuft, darf weder abreissen noch schalten. Im Browser traegt das die
 * Bauform: #pedals ist Geschwister von #zone-mitte (nicht Kind), liegt darueber
 * (z 2), und der Streifen faengt seine Finger per setPointerCapture ein. Die
 * Attrappen hier lassen nichts durchsickern — geprueft wird darum, dass der
 * echte Code an jeder Stelle das Richtige tut, plus die Bauform im Markup.
 */
describe("Pedale im Mittelstreifen (40e)", () => {
  const PEDAL = { closest: () => ({}) }; // e.target liegt auf einem .pedal
  const FASSUNG = { closest: () => null }; // Luecke zwischen den Pedalen

  it("Tippen, Doppeltippen und Kneifen auf den Pedalen bewegen die Kamera nicht", () => {
    const { touch, k } = bauen();
    const p = seite.get("pedals")!;
    p.fire("pointerdown", { pointerId: 1, clientX: 380, clientY: 330, target: PEDAL });
    p.fire("pointerdown", { pointerId: 2, clientX: 430, clientY: 330, target: PEDAL }); // Kneifen beginnt hier
    p.fire("pointermove", { pointerId: 2, clientX: 470, clientY: 300, target: PEDAL });
    p.fire("pointerdown", { pointerId: 3, clientX: 406, clientY: 330, target: FASSUNG });
    // Verirrt sich das pointerup in den Streifen, kennt der den Finger nicht:
    const z = seite.get("zone-mitte")!;
    for (const id of [1, 2, 3]) z.fire("pointerup", { pointerId: id, clientX: 406, clientY: 330 });
    p.fire("pointerdown", { pointerId: 4, clientX: 406, clientY: 330, target: PEDAL });
    z.fire("pointerup", { pointerId: 4, clientX: 406, clientY: 330 });
    expect(k).toEqual({ orbitDX: 0, orbitDY: 0, zoomFactor: 1, camReset: false });
    expect(touch.fahrenAktiv, "drei Tipps aufs Pedal = an").toBe(true);
  });

  it("ein Finger im Streifen und einer auf dem Pedal: kein Zoom", () => {
    const { k } = bauen();
    seite.get("zone-mitte")!.fire("pointerdown", { pointerId: 1, clientX: 406, clientY: 150 });
    seite.get("pedals")!.fire("pointerdown", { pointerId: 2, clientX: 406, clientY: 330, target: PEDAL });
    seite.get("zone-mitte")!.fire("pointermove", { pointerId: 2, clientX: 460, clientY: 300 });
    expect(k.zoomFactor).toBe(1);
  });

  it("ein Kamera-Zug aus dem Streifen laeuft ueber die Pedale weiter und schaltet nicht", () => {
    const { touch, k } = bauen();
    const z = seite.get("zone-mitte")!;
    const gefangen: number[] = [];
    z.setPointerCapture = (id: number) => gefangen.push(id);
    z.fire("pointerdown", { pointerId: 5, clientX: 406, clientY: 200 });
    z.fire("pointermove", { pointerId: 5, clientX: 406, clientY: 320 }); // jetzt ueber den Pedalen
    const halb = k.orbitDY;
    z.fire("pointermove", { pointerId: 5, clientX: 440, clientY: 350 });
    expect(gefangen, "Streifen faengt den Finger ein").toEqual([5]);
    expect(halb).toBeGreaterThan(0);
    expect(k.orbitDY).toBeGreaterThan(halb);
    expect(k.orbitDX).toBeGreaterThan(0);
    expect(touch.fahrenAktiv).toBe(false);
  });

  it("Bauform: Pedale neben, nicht in dem Streifen, darueber und mit eigenem Abfangen", () => {
    const html = readFileSync(resolve(__dirname, "../index.html"), "utf8");
    expect(html).toContain('<div class="zone" id="zone-mitte"></div>');
    const block = /#pedals \{([^}]*)\}/.exec(html)![1];
    expect(block).toContain("pointer-events: auto");
    expect(block).toContain("touch-action: none");
    expect(Number(/z-index:\s*(\d+)/.exec(block)![1])).toBeGreaterThan(0);
  });
});

describe("Jede Ansicht ist drehbar (E-136)", () => {
  const eingabe = (dx: number, zoom = 1): Input =>
    ({ wasPressed: () => false, orbitDX: dx, orbitDY: 0, zoomFactor: zoom, camReset: false, shiftHeld: false, wheelDelta: 0 }) as unknown as Input;
  const ziel = (out: THREE.Vector3): THREE.Vector3 => out.set(0, 0, 0);
  const kabine = (out: THREE.Vector3): number => (out.set(0, 2, 0), 0);

  for (const mode of ["orbit", "top", "side", "cabin"] as const) {
    it(`${mode}: Ziehen ändert die Blickrichtung`, () => {
      const cam = new OrbitCamera(1.5);
      cam.mode = mode;
      cam.update(1, eingabe(0), ziel, kabine);
      const vorher = cam.camera.quaternion.clone();
      cam.update(1, eingabe(80), ziel, kabine);
      expect(cam.camera.quaternion.angleTo(vorher)).toBeGreaterThan(0.1);
    });
  }

  it("Kneifen zoomt die Draufsicht, aber nur bis zur Grenze", () => {
    const cam = new OrbitCamera(1.5);
    cam.mode = "top";
    cam.update(1, eingabe(0), ziel, kabine);
    const weit = cam.camera.position.length();
    cam.update(1, eingabe(0, 0.5), ziel, kabine);
    expect(cam.camera.position.length()).toBeLessThan(weit);
    for (let i = 0; i < 20; i++) cam.update(1, eingabe(0, 0.5), ziel, kabine);
    expect(cam.camera.position.length()).toBeGreaterThanOrEqual(10 - 1e-6);
  });
});
