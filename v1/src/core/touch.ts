/**
 * Touch-Steuerung für Tablet und Smartphone (Briefing Kap. 5.1).
 * Aufteilung (Design 2026-08-29, Sticks überarbeitet 2026-09-09,
 * Fahrpedale 2026-09-14):
 *   linke Bildhälfte  — X: Oberwagen drehen, Y: Hauptarm heben/senken
 *   rechte Bildhälfte — X: Spinne öffnen/schließen, Y: Ausleger heran/weg
 *   Beide Sticks schweben: Sie erscheinen unter dem Daumen, wo er aufsetzt,
 *   und verschwinden beim Loslassen — kein Zielen auf feste Kreise (Vorbild
 *   Bagerana/v2). Maßgeblich ist die Zone, nicht der Ort.
 *   (die vier Stickachsen sind im Steuerungsmenü frei belegbar)
 *   Pedale         — zwei Stück unten mittig: antippen macht den
 *                    linken Stick zu Gas und Lenkung, noch ein Tipp gibt ihm
 *                    Hauptarm und Oberwagen zurück. Gefahren wird nur mit dem
 *                    Stick; die Pedale selbst geben kein Gas. Gas und Lenken
 *                    sind darum auch keine Zeilen im Steuerungsmenü.
 *   ↺ / ↻          — Spinne links bzw. rechts drehen (Rotator)
 *   Greifen        — über den rechten Stick (oder festen Fingerdruck)
 *   Extras         — Doppeltipp rechts wechselt die Ansicht
 *   Mittelstreifen — zwischen den Sticks (E-136): ein Finger dreht die Kamera,
 *                    zwei Finger kneifen = Zoom, Doppeltipp = Ansicht zurück
 *   Kranz-Knopf    — rechts oben unter ☰: Antippen klappt den Funktionskranz
 *                    auf, Antippen eines Eintrags löst ihn aus (L7-A)
 *   Fünf Finger    — Debug-Overlay ein/aus (auf dem Tablet gibt es keine F3-Taste)
 *
 * Zwei verworfene Vorläufer, damit sie niemand wiedererfindet:
 *   Bis zum 14.09.2026 früh war Fahren ein Modus, den ein Doppeltipp links
 *   einschaltete und der nach vier Sekunden ohne Daumen von selbst zurückfiel.
 *   Der Zustand wechselte ohne Zutun, und man wusste nie, woran man war.
 *   Danach bekam das Fahren eine eigene Fläche unten links (400 x 200 px) mit
 *   einem dritten schwebenden Stick. Patrick hat sie auf dem iPad abgelehnt.
 * Jetzt: umgeschaltet wird wieder, aber sichtbar und nur von Hand (Ansage
 * Patrick 14.09.2026, "zwei Pedale nebeneinander unten Mitte"; seit dem
 * Gerätetest desselben Tages unten links, weil sie in der Mitte zu viel Sicht
 * verdeckt haben). Seit 22.10.2026 wieder unten mittig, kleiner (Befund 40e:
 * „sie werden beim Baggern versehentlich getroffen" — unten links lagen sie
 * unter dem linken Stick-Daumen). Lage und Masse: index.html „Fahrpedale",
 * gerechnet in test/pedalmitte.test.ts.
 */
import { type ControlConfig, type AxisId, loadConfig } from "./controlConfig";
import type { Input } from "./input";

/** Was die Kamera-Geste in die Eingabe schreibt (main reicht `Input` durch). */
export type KameraEingabe = Pick<Input, "orbitDX" | "orbitDY" | "zoomFactor" | "camReset">;

export interface TouchAxes {
  cab: number;
  stick: number;
  boom: number;
  rotator: number;
  drive: number;
  steer: number;
  grab: boolean;
  /** Spinnen-Befehl vom rechten Stick: 1 = schließen, -1 = öffnen, 0 = halten */
  grapple: number;
}

interface StickState {
  id: number | null;
  baseX: number;
  baseY: number;
  dx: number;
  dy: number;
  pad: HTMLElement;
  knob: HTMLElement;
  /** Zeitpunkt des Aufsetzens — entscheidet, ob daraus ein Tipp wird */
  downT: number;
  /** Wieviel px der Knopf im Kreis wandern darf — aus der Kreisgröße gemessen */
  travel: number;
}

const RADIUS = 62; // px bis Vollausschlag
/** Ab diesem Druck (0..1) gilt eine Berührung als „festes Drücken" = Greifen */
const PRESSURE_GRAB = 0.55;
/** Totzone der Spinnenachse — schützt vor ungewolltem Öffnen beim Baggern */
const GRAPPLE_DEADZONE = 0.38;
/**
 * Totzone der Fahrfläche. Der Daumen setzt irgendwo auf und zieht von dort los;
 * beim Abrollen wandert er leicht zur Seite, und die Maschine zöge dann schon
 * von selbst an. 0,15 von 62 px Vollausschlag sind gut 9 px Spiel.
 * // SW: Startwert zum Austesten, auf dem Gerät nachzujustieren
 */
const DRIVE_DEADZONE = 0.15;
/**
 * Halbmesser des Kranzes in px.
 *
 * 104 -> 112 am 16.09.2026 (E-088), als der neunte Eintrag dazukam. Gerechnet,
 * nicht geschaetzt: Zwei Nachbarn stehen bei neun Eintraegen 40 Grad
 * auseinander, ihre Mitten also 2 * R * sin(20 Grad) = 0,643 * R auseinander.
 * Bei R = 112 sind das 72,0 px; der scharfgestellte Kasten ist 62 * 1,10 = 68,2
 * px breit, sein Nachbar 62 — macht 6,9 px Luft. Mit R = 104 waeren es 2,8 px
 * gewesen. Nachgerechnet wird das in `test/funktionskranz.test.ts`.
 *
 * Bleibt 112, obwohl SCHILDER einen Tag spaeter ins Menue umgezogen ist (E-093)
 * und nur noch ACHT Eintraege auf dem Ring stehen. Nachgemessen: Acht haben
 * bei R = 112 satte 14,1 px Luft (iPad) bzw. 18,3 px (iPhone mini quer); die
 * 6-px-Schranke liesse R bis 101 herunter. Kleiner gemacht wird trotzdem
 * nichts — der Halbmesser ist reine Ansicht (gewaehlt wird seit L7-A durch
 * Antippen des Eintrags), und die 112 halten den Platz fuer den neunten Eintrag frei, den Patrick
 * vergeben kann. Was in den Kranz kommt, entscheidet er.
 */
const RADIAL_R = 112;
/**
 * So lange nach einem verschluckten Tipp (Kranz offen, daneben getippt) wird
 * auch dessen `click` verschluckt — Karten und Leisten hoeren auf `click`, und
 * der kommt erst nach dem pointerup. // SW: ein click folgt binnen Millisekunden
 */
const KLICK_SCHLUCKEN_MS = 400;
/** Ein Aufsetzen zählt nur als Tipp, wenn es kürzer dauert und der Finger kaum wandert */
const TAP_MAX_MS = 250;
const TAP_MAX_MOVE = 12;
/** Zwei Tipps am selben Ort binnen dieser Zeit = Doppeltipp (Ansicht wechseln) */
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_RADIUS = 60;
/**
 * Mittelstreifen (E-136): Fingerweg in px mal diesen Faktor = Kamera-Delta.
 * Die Maus liefert 1:1; der Streifen ist aber nur 30 % breit (iPhone mini quer
 * 244 px), mit 1,4 dreht ein Wisch über die ganze Breite gut 120°.
 * // SW: Startwert zum Austesten, auf dem Gerät nachzujustieren
 */
const CAM_TOUCH_GAIN = 1.4;

const clamp1 = (v: number): number => Math.max(-1, Math.min(1, v));

/**
 * Rohausschlag der Fahrfläche in einen Fahrbefehl übersetzen: unterhalb der
 * Totzone Null, darüber wieder auf den vollen Bereich gespreizt. Ohne das
 * Spreizen begänne das Fahren bei 0,15 mit einem Ruck.
 */
export function fahrachse(v: number): number {
  const a = Math.abs(v);
  if (a <= DRIVE_DEADZONE) return 0;
  const s = (a - DRIVE_DEADZONE) / (1 - DRIVE_DEADZONE);
  return Math.sign(v) * Math.min(1, s);
}

export class TouchControls {
  /** Achsenbelegung — vom Steuerungsmenü geändert, im Browser gespeichert */
  config: ControlConfig = loadConfig();
  readonly axes: TouchAxes = {
    cab: 0,
    stick: 0,
    boom: 0,
    rotator: 0,
    drive: 0,
    steer: 0,
    grab: false,
    grapple: 0,
  };
  readonly active: boolean;
  /** true, sobald das Gerät echten Druck meldet — dann geht Greifen per Drücken */
  pressureSupported = false;
  private left: StickState | null = null;
  private right: StickState | null = null;
  /**
   * true = der linke Stick gibt Gas und lenkt, statt Hauptarm und Oberwagen zu
   * führen. Umgeschaltet wird ausschließlich durch einen Tipp auf die Pedale.
   * Es gibt keine Uhr, die das zurückstellt: Der alte Fahrmodus fiel nach vier
   * Sekunden ohne Daumen von selbst zurück, und genau das machte ihn
   * unbrauchbar (Ansage Patrick 14.09.2026).
   */
  private fahrenAn = false;
  private pressed = new Set<string>();
  private held = new Set<string>();
  private pressureGrab = false;
  private lastTap = 0;
  private radialEl: HTMLElement | null = null;
  private radialItems: Array<{ el: HTMLElement; code: string }> = [];
  private radialOpen = false;
  /** Der Knopf rechts oben, der den Kranz oeffnet und schliesst (L7-A) */
  private kranzKnopf: HTMLElement | null = null;
  /** Finger, die bei offenem Kranz aufsetzten: Zeiger-ID → Eintrag (-1 = daneben, verschluckt) */
  private kranzZeiger = new Map<number, number>();
  private klickSchluckenBis = 0;
  private lastTapX = 0;
  private lastTapY = 0;
  /** Finger im Mittelstreifen: Zeiger-ID → letzte Lage (höchstens zwei) */
  private camZeiger = new Map<number, { x: number; y: number }>();
  /** Der aktuelle Griff im Streifen könnte noch ein Tipp werden */
  private camTipp: { t: number; x: number; y: number } | null = null;
  private camLastTap = { t: 0, x: 0, y: 0 };

  constructor(canvas: HTMLElement, private kamera: KameraEingabe | null = null) {
    this.active = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
    const root = document.getElementById("touch");
    if (!root) return;
    if (!this.active) {
      root.style.display = "none";
      return;
    }
    root.style.display = "block";
    // Merkmal fuers Stylesheet: nur auf Touchgeraeten sitzt die Tutorialkarte oben
    document.body.classList.add("touch");
    this.left = this.makeStick("touch-left", "zone-left", "links");
    this.right = this.makeStick("touch-right", "zone-right", "rechts");
    this.bindKamera();
    this.bindPedale();
    this.bindSafety();
    this.bindDebugGeste();
    this.bindHold("btn-rot-l", "rotL");
    this.bindHold("btn-rot-r", "rotR");
    this.bindTap("btn-cab", "KeyX");
    this.bindTap("btn-outrig", "KeyO");
    this.bindTap("btn-press", "KeyB");
    this.bindTap("btn-pickup", "KeyV");
    this.bindTap("btn-away", "KeyJ");
    // E-191: Bagger-Hupe — Taste 2, weil jeder Buchstabe schon belegt ist
    this.bindTap("btn-hupe", "Digit2");
    this.bindTap("btn-lambert", "KeyY");
    this.bindTap("btn-blade", "KeyI");
    // E-118: nur im Simulator auf der Seite; im Betrieb nimmt main.ts den Span heraus
    this.bindTap("btn-nachschub", "Digit1");
    // Menue statt Kranz: Diese Spans tragen nur den Tastencode. Gedrueckt
    // werden sie nie — die echten Knoepfe stehen im Pausenfeld.
    this.bindTap("btn-music", "KeyU");
    this.bindTap("btn-shop", "KeyZ");
    this.bindTap("btn-marks", "KeyM"); // E-093: aus dem Kranz ins Menue
    this.bindTap("btn-pause", "Escape");
    this.bindMenu();
    this.buildRadial();
    this.bindKranz();
    this.bindCanvas(canvas);
    TouchControls.blockBrowserZoom();
  }

  /**
   * Kurzer Vibrationsimpuls, wo das Gerät ihn kann. Android liefert ihn über
   * die Vibrations-Schnittstelle; iOS kennt sie nicht, dort bleibt es beim
   * Klickgeräusch. Fehler werden geschluckt — Haptik ist Beiwerk.
   */
  private static vibrate(ms: number): void {
    try {
      navigator.vibrate?.(ms);
    } catch {
      // manche Browser werfen ohne vorherige Nutzergeste
    }
  }

  /** Rastklick des Rädchens — von main mit dem Audiosystem verbunden. */
  onWheelTick: (() => void) | null = null;
  /**
   * Bestätigung beim Auslösen eines Eintrags. Auf Android vibriert das Gerät
   * zusätzlich; iOS Safari kennt keine Vibrations-Schnittstelle, dort ist der
   * Ton die einzige Rückmeldung, die eine Webseite geben kann.
   */
  onTap: (() => void) | null = null;

  /**
   * Browser-Zoom unterbinden: Safari kennt eigene Gesture-Events, und ein
   * schneller Doppeltipp zoomt sonst die Seite, statt die Ansicht zu wechseln.
   */
  private static blockBrowserZoom(): void {
    for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
      document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
    }
    document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
    // iOS/Android markieren sonst Elemente beim Halten und zeigen ein Kontextmenü
    document.addEventListener("contextmenu", (e) => e.preventDefault(), { passive: false });
    document.addEventListener("selectstart", (e) => e.preventDefault(), { passive: false });
    // Mehrfinger-Gesten (Pinch) abfangen
    document.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length > 1) e.preventDefault();
      },
      { passive: false }
    );
    // Ein zweiter Tipp binnen 320 ms würde sonst den Doppeltipp-Zoom auslösen
    let last = 0;
    document.addEventListener(
      "touchend",
      (e) => {
        const now = performance.now();
        if (now - last < 320) e.preventDefault();
        last = now;
      },
      { passive: false }
    );
  }

  /**
   * Schwebender Stick: Aufsetzfläche ist die halbe Bildbreite. Wo der Daumen
   * landet, wird der Kreis hingesetzt und eingeblendet; beim Loslassen
   * verschwindet er. Nullpunkt ist der Aufsetzpunkt, nicht die Kreismitte —
   * dadurch springt nichts, egal wo der Finger aufkommt. Den Zeiger fängt die
   * Zone ein, damit der Stick weiterläuft, wenn der Daumen über den Kreisrand
   * oder in die andere Bildhälfte wandert.
   *
   * Die Rolle entscheidet über eine Kleinigkeit: Nur der rechte Stick wechselt
   * per Doppeltipp die Ansicht. Ein Doppeltipp links tut nichts — er schaltete
   * bis zum 14.09.2026 den Fahrmodus um, und das soll nicht aus Versehen
   * zurückkommen.
   */
  private makeStick(padId: string, zoneId: string, rolle: "links" | "rechts"): StickState | null {
    const pad = document.getElementById(padId);
    const zone = document.getElementById(zoneId);
    if (!pad || !zone) return null;
    const knob = pad.querySelector<HTMLElement>(".knob")!;
    const st: StickState = {
      id: null, baseX: 0, baseY: 0, dx: 0, dy: 0, pad, knob, travel: 0, downT: 0,
    };
    zone.addEventListener(
      "pointerdown",
      (e) => {
        if (st.id !== null) return; // ein Finger je Bildhälfte
        st.id = e.pointerId;
        st.baseX = e.clientX;
        st.baseY = e.clientY;
        st.dx = 0;
        st.dy = 0;
        st.downT = performance.now();
        pad.hidden = false;
        pad.style.left = `${e.clientX}px`;
        pad.style.top = `${e.clientY}px`;
        // Erst nach dem Einblenden messen — versteckt ist die Breite 0.
        st.travel = Math.max(0, pad.offsetWidth / 2 - knob.offsetWidth / 2 - 2);
        knob.style.transform = "translate(0,0)";
        zone.setPointerCapture(e.pointerId);
        this.checkPressure(e);
        e.preventDefault();
      },
      { passive: false }
    );
    zone.addEventListener(
      "pointermove",
      (e) => {
        if (st.id !== e.pointerId) return;
        st.dx = clamp1((e.clientX - st.baseX) / RADIUS);
        st.dy = clamp1((e.clientY - st.baseY) / RADIUS);
        knob.style.transform = `translate(${st.dx * st.travel}px, ${st.dy * st.travel}px)`;
        this.checkPressure(e);
        e.preventDefault();
      },
      { passive: false }
    );
    zone.addEventListener("pointerup", (e) => {
      if (st.id !== e.pointerId) return;
      const dauer = performance.now() - st.downT;
      const weg = Math.hypot(e.clientX - st.baseX, e.clientY - st.baseY);
      if (dauer < TAP_MAX_MS && weg < TAP_MAX_MOVE) {
        this.registerTap(e.clientX, e.clientY, rolle === "rechts");
      }
      TouchControls.resetStick(st);
      this.pressureGrab = false;
    });
    const abbruch = (e: PointerEvent): void => {
      if (st.id !== e.pointerId) return;
      TouchControls.resetStick(st);
      this.pressureGrab = false;
    };
    zone.addEventListener("pointercancel", abbruch);
    // Verliert die Zone den Zeiger (Systemgeste, App-Wechsel), bliebe der Stick sonst stehen
    zone.addEventListener("lostpointercapture", abbruch);
    return st;
  }

  /**
   * Kamera-Geste im Mittelstreifen zwischen den beiden Stick-Zonen (E-136,
   * Gerätebefund 17.10.2026: „die Kamera drehen, ohne zwischen den Ansichten
   * switchen zu müssen").
   *
   * Nur hier, nie über den Sticks: In v2 lösten Daumen neben den Sticks sonst
   * Perspektivwechsel aus. Die Zonen grenzen nur aneinander — ein Finger, der
   * auf einem Stick aufsetzt, gehört dem Stick, auch wenn er in den Streifen
   * wandert (Pointer-Capture der Stick-Zone). Umgekehrt fängt der Streifen
   * seine Finger ein.
   *
   * Ein Finger zieht = drehen/neigen, zwei Finger = Kneifen-Zoom (dann wird
   * nicht gedreht, sonst wackelt das Bild beim Zoomen). Kurzer Doppeltipp am
   * selben Ort = Ansicht auf ihren Startpunkt.
   */
  private bindKamera(): void {
    const zone = document.getElementById("zone-mitte");
    if (!zone) return;
    zone.addEventListener(
      "pointerdown",
      (e) => {
        e.preventDefault();
        if (this.camZeiger.size >= 2) return;
        this.camZeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });
        zone.setPointerCapture(e.pointerId);
        // Ein Tipp ist nur ein einzelner Finger; der zweite macht daraus Zoom
        this.camTipp =
          this.camZeiger.size === 1 ? { t: performance.now(), x: e.clientX, y: e.clientY } : null;
      },
      { passive: false }
    );
    zone.addEventListener(
      "pointermove",
      (e) => {
        const p = this.camZeiger.get(e.pointerId);
        if (!p) return;
        e.preventDefault();
        const k = this.kamera;
        if (this.camZeiger.size === 1) {
          if (k) {
            k.orbitDX += (e.clientX - p.x) * CAM_TOUCH_GAIN;
            k.orbitDY += (e.clientY - p.y) * CAM_TOUCH_GAIN;
          }
        } else {
          const [a, b] = [...this.camZeiger.values()];
          const vorher = Math.hypot(a.x - b.x, a.y - b.y);
          p.x = e.clientX;
          p.y = e.clientY;
          const nachher = Math.hypot(a.x - b.x, a.y - b.y);
          // Auseinander = näher heran. Unter 10 px Spanne ist das Verhältnis Rauschen
          if (k && vorher > 10 && nachher > 10) k.zoomFactor *= vorher / nachher;
        }
        p.x = e.clientX;
        p.y = e.clientY;
      },
      { passive: false }
    );
    zone.addEventListener("pointerup", (e) => {
      if (!this.camZeiger.delete(e.pointerId)) return;
      const t = this.camTipp;
      this.camTipp = null;
      if (!t) return;
      const now = performance.now();
      if (now - t.t >= TAP_MAX_MS || Math.hypot(e.clientX - t.x, e.clientY - t.y) >= TAP_MAX_MOVE) return;
      const l = this.camLastTap;
      if (now - l.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - l.x, e.clientY - l.y) < DOUBLE_TAP_RADIUS) {
        if (this.kamera) this.kamera.camReset = true;
        this.onTap?.();
        l.t = 0;
      } else {
        this.camLastTap = { t: now, x: e.clientX, y: e.clientY };
      }
    });
    const abbruch = (e: PointerEvent): void => {
      if (this.camZeiger.delete(e.pointerId)) this.camTipp = null;
    };
    zone.addEventListener("pointercancel", abbruch);
    zone.addEventListener("lostpointercapture", abbruch);
  }

  /** Stick auf Null stellen und ausblenden. */
  private static resetStick(st: StickState): void {
    st.id = null;
    st.dx = 0;
    st.dy = 0;
    st.knob.style.transform = "translate(0,0)";
    st.pad.hidden = true;
  }

  /**
   * Doppeltipp = Ansicht wechseln. Die Ortsprüfung ist wichtig, seit die Sticks
   * überall aufsetzen dürfen: ohne sie gälten linker und rechter Daumen kurz
   * nacheinander als Doppeltipp und die Kamera spränge beim Baggern ständig um.
   */
  private registerTap(x: number, y: number, wechselt: boolean): void {
    const now = performance.now();
    const nah = Math.hypot(x - this.lastTapX, y - this.lastTapY) < DOUBLE_TAP_RADIUS;
    if (now - this.lastTap < DOUBLE_TAP_MS && nah) {
      // Nur rechts wechselt die Ansicht. Links doppelt schaltete bis zum
      // 14.09.2026 den Fahrmodus um — den gibt es nicht mehr, und die Kamera
      // soll nicht plötzlich am Armdaumen hängen.
      if (wechselt) {
        this.pressed.add("KeyC");
        this.onTap?.();
      }
      this.lastTap = 0;
      return;
    }
    this.lastTap = now;
    this.lastTapX = x;
    this.lastTapY = y;
  }

  /**
   * Fünf Finger gleichzeitig schalten das Debug-Overlay um. Am Rechner liegt es
   * auf F3 — die hat ein Tablet nicht, und ohne die Zahlen laesst sich auf dem
   * Geraet nichts nachmessen. Fuenf Finger deshalb, weil kein Spielgriff so
   * viele braucht: mit zweien steuert man, mit dreien verrutscht man mal.
   */
  private bindDebugGeste(): void {
    document.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length >= 5) {
          this.pressed.add("F3");
          TouchControls.vibrate(30);
          this.releaseAll(); // die fuenf Finger sollen nichts am Bagger verstellen
          this.closeRadial();
        }
      },
      { passive: true }
    );
  }

  /**
   * Sicherung gegen „Geister-Zeiger": Verschluckt der Browser ein pointerup
   * (Systemgeste, App-Wechsel, abgebrochene Mehrfingergeste), bliebe die
   * Bildhälfte mit der alten Zeiger-ID belegt und nähme keinen neuen Finger
   * mehr an. Deshalb: kein Finger mehr auf dem Glas → alles loslassen.
   */
  private bindSafety(): void {
    const allesLos = (e: Event): void => {
      if ((e as TouchEvent).touches.length === 0) this.releaseAll();
    };
    document.addEventListener("touchend", allesLos, { passive: true });
    document.addEventListener("touchcancel", allesLos, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) return;
      this.releaseAll();
      this.closeRadial();
    });
  }

  /**
   * Beide Sticks, alle Halteknöpfe und das Druck-Greifen loslassen.
   *
   * Ob gefahren wird, bleibt dabei ausdrücklich stehen. Ein App-Wechsel ist
   * kein Tipp auf die Pedale, und der Zustand darf sich nur ändern, wenn der
   * Spieler ihn ändert — sonst käme der Zeitablauf von heute früh durch die
   * Hintertür zurück.
   *
   * Der Funktionskranz bleibt ebenfalls offen (L7-A): Er wird per Tipp
   * geöffnet, und nach jedem Tipp ist kein Finger mehr auf dem Glas — hier zu
   * schliessen hiesse, ihn sofort wieder zuzuklappen. Losgelassen werden nur
   * die Finger, die gerade einen Eintrag drücken.
   */
  releaseAll(): void {
    for (const st of [this.left, this.right]) {
      if (st) TouchControls.resetStick(st);
    }
    this.held.clear();
    this.camZeiger.clear();
    this.camTipp = null;
    this.pressureGrab = false;
    this.kranzZeiger.clear();
    for (const it of this.radialItems) it.el.classList.remove("sel");
    for (const id of ["btn-rot-l", "btn-rot-r"]) {
      document.getElementById(id)?.classList.remove("down");
    }
  }

  /**
   * Die beiden Pedale unten mittig (seit 22.10.2026, vorher unten links).
   *
   * Sie sind zusammen ein Umschalter und sonst nichts: Ein Tipp auf eines von
   * beiden macht den linken Stick zu Gas und Lenkung, der nächste gibt ihm
   * Hauptarm und Oberwagen zurück. Gefahren wird ausschließlich mit dem Stick;
   * die Pedale geben kein Gas (Ansage Patrick 14.09.2026). Sie stehen zu
   * zweit, weil eine Maschine zwei Fahrpedale hat — nicht, weil sie
   * Verschiedenes könnten. Beide tun dasselbe.
   *
   * Ausgelöst wird auf pointerdown: Der Tipp soll sofort sitzen, und es gibt
   * nichts, was man nach dem Aufsetzen noch abwählen könnte. Die Fassung um
   * die Pedale fängt Zeiger ab, ohne zu schalten — so landet ein Daumen, der
   * die Lücke zwischen beiden trifft, nicht im Mittelstreifen darunter und
   * zählt dort weder als Kamera-Zug noch als Doppeltipp (Ansicht zurück).
   * Die Pedale sind Geschwister von #zone-mitte, nicht ihr Kind, und liegen
   * darüber (z 2 gegen 0): Ein Finger, der hier aufsetzt, erreicht die
   * Kamera nie — auch nicht als zweiter Finger eines Kneifens. Umgekehrt
   * fängt der Streifen seine Finger ein (setPointerCapture), ein Kamera-Zug
   * läuft also über die Pedale weiter, ohne zu schalten
   * (test/kamerageste.test.ts, „Pedale im Mittelstreifen").
   */
  private bindPedale(): void {
    const el = document.getElementById("pedals");
    if (!el) return;
    el.addEventListener(
      "pointerdown",
      (e) => {
        const ziel = e.target as HTMLElement | null;
        if (ziel?.closest(".pedal")) this.setFahren(!this.fahrenAn);
        e.preventDefault();
      },
      { passive: false }
    );
  }

  /**
   * Fahren ein- oder ausschalten und das Bild nachziehen: Die Pedale leuchten
   * und ihre Trittplatten stehen unten, der linke Stick bekommt einen warmen
   * Rand. Der Zustand ist damit ohne ein einziges Wort ablesbar — das war die
   * Bedingung, unter der das Umschalten überhaupt zurückkommen durfte.
   *
   * Der linke Stick wird dabei losgelassen. Läge beim Umschalten ein Daumen
   * auf ihm, stünde sein Ausschlag im nächsten Bild als Gas da und die
   * Maschine zöge ruckartig an; umgekehrt führe der Arm los. Nach dem Wechsel
   * muss der Daumen also einmal neu aufsetzen.
   */
  private setFahren(an: boolean): void {
    this.fahrenAn = an;
    document.getElementById("touch")?.classList.toggle("fahren", an);
    if (this.left) TouchControls.resetStick(this.left);
    this.axes.drive = 0;
    this.axes.steer = 0;
    TouchControls.vibrate(22); // spürbar, wo das Gerät es kann
    this.onTap?.(); // hörbar überall — auf iOS die einzige Rückmeldung
  }

  private bindHold(id: string, key: string): void {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(
      "pointerdown",
      (e) => {
        this.held.add(key);
        el.classList.add("down");
        e.preventDefault();
      },
      { passive: false }
    );
    const up = (): void => {
      this.held.delete(key);
      el.classList.remove("down");
    };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", up);
  }

  /**
   * Eintrag des Funktionsrädchens mit einer Taste verbinden.
   *
   * Ausgelöst wird NICHT hier, sondern beim Loslassen im Rädchen selbst — und
   * nur, wenn der Finger dabei kaum gewandert ist. Vorher hing die Auslösung am
   * pointerdown des Eintrags: Weil das Rädchen den Zeiger einfängt, sobald man
   * es dreht, galt jedes Wischen zugleich als Tipp auf den scharfgestellten
   * Eintrag. Man wollte blättern und löste aus.
   */
  private bindTap(id: string, code: string): void {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset["action"] = code;
  }

  /** Eintrag auslösen. */
  private fire(code: string): void {
    this.pressed.add(code);
    TouchControls.vibrate(22); // spürbar, wo das Gerät es kann
    this.onTap?.(); // hörbar überall — auf iOS die einzige Rückmeldung
  }

  /**
   * Funktionskranz: die Maschinenfunktionen auf einem Ring.
   *
   * Bis zum 22.10.2026 klappte er auf, wenn der rechte Daumen 0,4 s stillhielt,
   * und gewählt wurde per Zugrichtung. Das stand nirgends und ging beim
   * Greifen versehentlich auf (Punkte 42a/42b). Seit L7-A öffnet ihn nur der
   * Knopf rechts oben unter ☰ (Ansage Patrick: „nur ein Knopf, Stillhalten
   * öffnet nichts mehr"); Lage und Ring: index.html „Funktionskranz",
   * gerechnet in test/kranzknopf.test.ts.
   */
  private buildRadial(): void {
    const el = document.getElementById("radial");
    // Nur der erste Traegerblock kommt in den Kranz; #menu-actions liegt
    // hinter dem Menueknopf.
    const traeger = Array.from(
      document.querySelectorAll<HTMLElement>(".hidden-actions:not(#menu-actions) span")
    );
    if (!el || traeger.length === 0) return;
    this.radialEl = el;
    for (const t of traeger) {
      const code = t.dataset["action"];
      if (!code) continue;
      const sektor = document.createElement("div");
      sektor.className = "sektor";
      sektor.textContent = t.textContent ?? "";
      el.appendChild(sektor);
      this.radialItems.push({ el: sektor, code });
    }
    const nabe = document.createElement("div");
    nabe.className = "nabe";
    el.appendChild(nabe);
    // Sektoren einmal auf dem Kreis verteilen — die Lage aendert sich nie
    const n = this.radialItems.length;
    this.radialItems.forEach((it, i) => {
      const a = (i / n) * Math.PI * 2; // 0 = oben, im Uhrzeigersinn
      it.el.style.left = `${Math.sin(a) * RADIAL_R}px`;
      it.el.style.top = `${-Math.cos(a) * RADIAL_R}px`;
    });
  }

  /** Menüknopf oben rechts: öffnet die Pause. */
  private bindMenu(): void {
    const el = document.getElementById("btn-menu");
    if (!el) return;
    el.addEventListener(
      "pointerup",
      (e) => {
        this.fire("Escape");
        e.preventDefault();
      },
      { passive: false }
    );
  }

  /**
   * Knopf und Bedienung des Kranzes (L7-A).
   *
   * Knopf antippen öffnet, noch einmal antippen schliesst. Ein Eintrag löst
   * beim Loslassen aus, wenn der Finger noch auf DEMSELBEN Eintrag liegt, und
   * schliesst. Ein Tipp daneben (auch auf die Nabe) schliesst folgenlos.
   *
   * Solange der Kranz offen ist, gehört jeder NEUE Finger ihm: Ein Hörer am
   * Dokument in der Fangphase sieht das pointerdown vor jeder Zone, jedem
   * Knopf und jeder Karte und hält es dort an. So startet ein Tipp daneben
   * weder einen Stick noch die Kamera und zählt nicht als (Doppel-)Tipp. Sein
   * pointerup und sein click werden ebenso verschluckt (☰ löst auf pointerup
   * aus, Karten auf click). Finger, die schon vorher lagen und von ihrer Zone
   * gefangen sind, laufen weiter — der Stick unter dem Daumen bleibt, was er ist.
   */
  private bindKranz(): void {
    const knopf = document.getElementById("btn-kranz");
    if (!knopf) return;
    this.kranzKnopf = knopf;
    // Leerer Kranz (alles per core/spielart.ts entfernt): kein Knopf
    knopf.hidden = this.radialItems.length === 0;
    knopf.addEventListener(
      "pointerdown",
      (e) => {
        e.preventDefault();
        if (this.radialOpen) this.closeRadial();
        else this.openRadial();
      },
      { passive: false }
    );
    const eintrag = (ziel: EventTarget | null): number => this.radialItems.findIndex((it) => it.el === ziel);
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (!this.radialOpen || knopf.contains(e.target as Node | null)) return;
        e.preventDefault();
        e.stopPropagation();
        const i = eintrag(e.target);
        this.kranzZeiger.set(e.pointerId, i);
        if (i < 0) {
          this.closeRadial();
          return;
        }
        this.radialItems[i].el.classList.add("sel");
        // Touch fängt den Zeiger am Eintrag ein; ohne Freigabe meldete pointerup
        // immer diesen Eintrag, auch wenn der Finger längst daneben liegt.
        (e.target as Element).releasePointerCapture?.(e.pointerId);
      },
      { capture: true, passive: false }
    );
    const los = (e: PointerEvent): void => {
      const i = this.kranzZeiger.get(e.pointerId);
      if (i === undefined) return;
      this.kranzZeiger.delete(e.pointerId);
      e.stopPropagation();
      this.klickSchluckenBis = performance.now() + KLICK_SCHLUCKEN_MS;
      const it = this.radialItems[i];
      if (!it) return;
      it.el.classList.remove("sel");
      if (e.type === "pointerup" && this.radialOpen && eintrag(e.target) === i) {
        this.fire(it.code);
        this.closeRadial();
      }
    };
    document.addEventListener("pointerup", los, { capture: true });
    document.addEventListener("pointercancel", los, { capture: true });
    document.addEventListener(
      "click",
      (e) => {
        if (performance.now() >= this.klickSchluckenBis) return;
        e.preventDefault();
        e.stopPropagation();
      },
      { capture: true }
    );
  }

  private openRadial(): void {
    if (!this.radialEl) return;
    this.radialEl.hidden = false;
    this.radialOpen = true;
    for (const it of this.radialItems) it.el.classList.remove("sel");
    this.kranzKnopf?.classList.add("down");
    document.getElementById("touch")?.classList.add("kranz-offen");
    this.kranzKnopf?.setAttribute("aria-expanded", "true");
    TouchControls.vibrate(14);
    this.onTap?.();
  }

  private closeRadial(): void {
    if (!this.radialOpen) return;
    this.radialOpen = false;
    if (this.radialEl) this.radialEl.hidden = true;
    for (const it of this.radialItems) it.el.classList.remove("sel");
    this.kranzKnopf?.classList.remove("down");
    document.getElementById("touch")?.classList.remove("kranz-offen");
    this.kranzKnopf?.setAttribute("aria-expanded", "false");
  }

  /**
   * Druckmessung fürs Greifen. Geräte ohne Kraftsensor melden konstant 0 oder
   * 0,5 — erst ein anderer Wert beweist, dass echter Druck ankommt.
   */
  private checkPressure(e: PointerEvent): void {
    if (e.pointerType !== "touch") return;
    if (e.pressure > 0 && e.pressure !== 0.5) this.pressureSupported = true;
    this.pressureGrab = this.pressureSupported && e.pressure >= PRESSURE_GRAB;
  }

  /**
   * Die Leinwand selbst bekommt auf Touchgeräten kaum noch Zeiger — die beiden
   * Stick-Zonen liegen darüber, seit die Sticks überall aufsetzen dürfen. Die
   * Bindung bleibt für den Rest: Druck greift auch dann, wenn ein Finger doch
   * einmal direkt auf der Leinwand landet (Zonen ausgeblendet, Maus mit Stift).
   * Doppeltipp und Sticks laufen über die Zonen.
   */
  private bindCanvas(canvas: HTMLElement): void {
    canvas.addEventListener("pointerdown", (e) => this.checkPressure(e));
    canvas.addEventListener("pointermove", (e) => this.checkPressure(e));
    const clear = (): void => {
      this.pressureGrab = false;
    };
    canvas.addEventListener("pointerup", clear);
    canvas.addEventListener("pointercancel", clear);
  }

  /**
   * E-196: Liegt gerade ein Finger auf einem Stick oder im Mittelstreifen?
   * Nur lesen — die Vorfuehrung im Lehrgang bricht ab, sobald einer aufsetzt.
   */
  get daumenAuf(): boolean {
    return this.left?.id != null || this.right?.id != null || this.camZeiger.size > 0;
  }

  /**
   * L4b: Ist der Fahrbetrieb an (Pedale getreten)? Nur lesen — der
   * Geisterdaumen laesst im Lehrgang die Pedale leuchten, wenn der Schritt
   * den anderen Betrieb braucht.
   */
  get fahrenAktiv(): boolean {
    return this.fahrenAn;
  }

  /** L7-A: Ist der Funktionskranz offen? Nur lesen — für den Lehrgang-Schritt. */
  get kranzOffen(): boolean {
    return this.radialOpen;
  }

  consumePress(code: string): boolean {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  /**
   * Zustand eines Kranzeintrags anzeigen: an oder aus.
   *
   * Fuer Funktionen, die UMSCHALTEN statt auszuloesen — KABINE und STUETZEN,
   * sobald der Bagger ihren Zustand herausgibt. Ohne das ist ein Umschalter im
   * Kranz eine Taste, die man drueckt und hofft.
   *
   * Im Kranz nutzt das gerade niemand: Der bisher einzige Nutzer war der
   * Eintrag KIPPEN, und der ist am 17.09.2026 mit dem Seitwaertskippen
   * hinausgeflogen (E-105). Die Anzeige bleibt trotzdem stehen — sie kostet
   * nichts, und das Pausenmenue zeigt seine Zustaende ueber dieselbe
   * Bildsprache.
   *
   * Der Kranz erfaehrt den Zustand von aussen (main.ts reicht ihn durch) und
   * fragt NIE die Maschine (Projektregel 10). `touch.ts` kennt weder Bagger
   * noch Greifer, nur Tastencodes.
   *
   * Unbekannte Codes sind stillschweigend erlaubt: Ein Eintrag kann im Menue
   * statt im Kranz liegen, dann gibt es nichts zu zeigen.
   */
  setAktiv(code: string, an: boolean): void {
    for (const it of this.radialItems) {
      if (it.code === code) it.el.classList.toggle("an", an);
    }
  }

  /** `_dt` brauchte nur die alte Halte-Uhr des Kranzes (bis L7-A); main.ts reicht es weiter durch. */
  update(_dt = 1 / 60): void {
    if (!this.active) return;
    const l = this.left;
    const r = this.right;
    // Die vier Stickachsen sind frei belegbar (Steuerungsmenü). Werkseinstellung:
    // Hauptarm und Oberwagen links, Ausleger und Spinne rechts.
    this.axes.cab = 0;
    this.axes.boom = 0;
    this.axes.stick = 0;
    this.axes.grapple = 0;
    let rotAxis = 0;
    const raw: Record<AxisId, number> = {
      leftY: l ? l.dy : 0,
      leftX: l ? l.dx : 0,
      rightY: r ? r.dy : 0,
      rightX: r ? r.dx : 0,
    };
    for (const id of ["leftY", "leftX", "rightY", "rightX"] as AxisId[]) {
      // Beim Fahren führt der linke Stick Gas und Lenkung (siehe unten); seine
      // beiden Belegungen ruhen so lange. Sie bleiben aber, was sie sind —
      // ausgeschaltet steuert er sofort wieder Hauptarm und Oberwagen.
      if (this.fahrenAn && (id === "leftX" || id === "leftY")) continue;
      const b = this.config[id];
      const v = raw[id] * (b.invert ? -1 : 1);
      switch (b.fn) {
        case "boom":
          this.axes.boom += v;
          break;
        case "stick":
          this.axes.stick += v;
          break;
        case "cab":
          this.axes.cab += v;
          break;
        case "grapple": {
          // Die Spinne braucht eine großzügige Totzone: beim Ziehen am
          // Ausleger rutscht der Daumen leicht zur Seite, und die Schalen
          // gingen dann ungewollt auf. Zusätzlich wird die Querachse gedämpft,
          // solange die Längsachse desselben Sticks stark ausgelenkt ist —
          // bewusste Diagonalbewegungen bleiben trotzdem möglich.
          const quer = id === "leftX" || id === "rightX";
          const laengs = Math.abs(quer ? (id === "leftX" ? raw.leftY : raw.rightY) : 0);
          const eff = v * (1 - Math.min(laengs, 1) * 0.5);
          if (Math.abs(eff) > GRAPPLE_DEADZONE) this.axes.grapple += eff;
          break;
        }
        case "rotator":
          rotAxis += v;
          break;
        default:
          break;
      }
    }
    // Rotator: Drehtasten, zusätzlich eine Stickachse, falls so belegt
    this.axes.rotator = clamp1(
      (this.held.has("rotR") ? 1 : 0) - (this.held.has("rotL") ? 1 : 0) + rotAxis
    );
    // Fahren: nur wenn die Pedale angetippt sind, und dann über den linken
    // Stick. Nach oben ziehen = vorwärts, seitlich lenkt.
    const faehrt = this.fahrenAn && l !== null;
    this.axes.drive = faehrt ? clamp1(fahrachse(-l.dy)) : 0;
    this.axes.steer = faehrt ? clamp1(fahrachse(l.dx)) : 0;
    this.axes.boom = clamp1(this.axes.boom);
    this.axes.stick = clamp1(this.axes.stick);
    this.axes.cab = clamp1(this.axes.cab);
    this.axes.grapple = clamp1(this.axes.grapple);
    this.axes.grab = this.pressureGrab;
  }
}
