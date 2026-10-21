/**
 * Zentrale Eingabe: Tastatur + Maus.
 * Achsen liefern -1..+1; "pressed" gilt genau einen Frame (für Toggles wie F3/C/H).
 */
export class Input {
  private down = new Set<string>();
  private pressedThisFrame = new Set<string>();
  /** Mausrad-Delta seit letztem Frame (in "Notches", + = weg vom Nutzer) */
  wheelDelta = 0;
  /** Kamera-Drehdelta in px seit letztem Frame: MMB-Ziehen oder Touch-Mittelstreifen (E-136) */
  orbitDX = 0;
  orbitDY = 0;
  /** Kamera-Abstand mal diesen Faktor (Touch-Kneifen, E-136); 1 = unverändert */
  zoomFactor = 1;
  /** true genau in dem Frame, in dem die Ansicht zurückgesetzt werden soll (Doppeltipp Mittelstreifen) */
  camReset = false;
  /** Maustasten: 0=links, 1=mitte, 2=rechts */
  private mouseDown = new Set<number>();
  shiftHeld = false;

  constructor(target: HTMLElement) {
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressedThisFrame.add(e.code);
      this.shiftHeld = e.shiftKey;
      // Browser-Kürzel/Scrollen nicht auslösen (F3, Pfeile, Bild-Tasten, Leertaste)
      if (
        e.code === "F3" ||
        e.code === "Space" ||
        e.code.startsWith("Arrow") ||
        e.code === "PageUp" ||
        e.code === "PageDown"
      ) {
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => {
      this.down.delete(e.code);
      this.shiftHeld = e.shiftKey;
    });
    window.addEventListener("blur", () => {
      this.down.clear();
      this.mouseDown.clear();
    });

    target.addEventListener("mousedown", (e) => {
      this.mouseDown.add(e.button);
      if (e.button === 1) e.preventDefault(); // MMB-Autoscroll unterbinden
    });
    window.addEventListener("mouseup", (e) => this.mouseDown.delete(e.button));
    window.addEventListener("mousemove", (e) => {
      if (this.mouseDown.has(1)) {
        this.orbitDX += e.movementX;
        this.orbitDY += e.movementY;
      }
    });
    target.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.wheelDelta += Math.sign(e.deltaY);
        this.shiftHeld = e.shiftKey;
      },
      { passive: false }
    );
    target.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** true genau in dem Frame, in dem die Taste gedrückt wurde */
  wasPressed(code: string): boolean {
    return this.pressedThisFrame.has(code);
  }

  mouseHeld(button: number): boolean {
    return this.mouseDown.has(button);
  }

  /**
   * E-196: Ein Tastendruck ohne Taste — die Vorfuehrung im Lehrgang
   * (`core/wiedergabe.ts`) drueckt so wie der Spieler: `wasPressed(code)` ist
   * genau in diesem Bild wahr, `endFrame` raeumt ihn weg. Nichts haengt am
   * Spieler; ohne Lehrgang ruft das niemand.
   */
  drueckeVirtuell(code: string): void {
    this.pressedThisFrame.add(code);
  }

  /** E-196: Haelt der Spieler gerade eine Taste oder Maustaste? (Abbruch der Vorfuehrung) */
  get aktiv(): boolean {
    return this.down.size > 0 || this.mouseDown.size > 0;
  }

  /** -1..+1 aus zwei Tasten */
  axis(negCode: string, posCode: string): number {
    return (this.isDown(posCode) ? 1 : 0) - (this.isDown(negCode) ? 1 : 0);
  }

  /** Am Frame-Ende aufrufen: verbraucht Deltas und Einmal-Events. */
  endFrame(): void {
    this.pressedThisFrame.clear();
    this.wheelDelta = 0;
    this.orbitDX = 0;
    this.orbitDY = 0;
    this.zoomFactor = 1;
    this.camReset = false;
  }
}
