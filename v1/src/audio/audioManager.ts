/**
 * Kern-Sounds M1 (Briefing Kap. 15) — per WebAudio, und seit E-153 NUR aus
 * geschnittenen Aufnahmen (public/ton/, Herkunft in QUELLEN.md): kein
 * Oszillator, kein gerechnetes Rauschen, auch nicht als Ersatz, solange die
 * Aufnahmen laden — dann ist es still (Patrick 17.10.: „möglichst nur
 * realistische töne"). Einzige Ausnahme ist das Radio (`music.ts`, beim Start
 * aus). Waechter in geraeusche.test.ts.
 * Jeder Abwurf klingt nach seinem Material, falsch = stumpfer Schlag.
 * Startet erst nach der ersten echten Nutzereingabe (Browser-Autoplay-Policy).
 *
 * Tonwaechter (Befund 14.09.2026, iPad): Der Tonkanal faellt auf iOS in den
 * Zustand `interrupted`, sobald die Seite in den Hintergrund geht, der
 * Bildschirm sperrt oder ein Anruf kommt — und er kommt ohne ausdrueckliches
 * `resume()` nicht zurueck. Deshalb wird hier aus DREI Richtungen geweckt:
 * bei jeder Nutzergeste, bei `visibilitychange`/`pageshow`/`focus` und direkt
 * am Kanal ueber `statechange` — letzteres fuer den Ausfall mitten im Spiel,
 * bei dem es gar keine Geste gibt, an der man sich festhalten koennte.
 */
import { Music } from "./music";
import { findeSender, STANDARD_SENDER, type Song } from "./songs";
import { brauchtNeuaufbau, brauchtWeckruf, istHoerbar, type Tondiagnose } from "./tonzustand";
import {
  alleProben,
  aufprallKlang,
  AUFSCHLAG_ABSTAND_S,
  bissPegel,
  dateiVon,
  dauerVon,
  DRUECK_ABSTAND_S,
  DRUECK_STREU_S,
  Druckaufbau,
  EINZEL,
  FAMILIEN,
  GRUND,
  kehrKlang,
  knautschKlang,
  oelFluss,
  Rasselbett,
  SCHLEIFEN,
  spinnenAufschlag,
  spinnenDruecken,
  Stimmenbudget,
  VOLLE_KRAFT_KN,
  KLONK_ABSTAND_S,
  klonkPegel,
  MAGNET_HELL_HZ,
  MOTOR_HZ_LEER,
  TEMPO_STREU,
  MAGNET_LAUT,
  type AufprallRezept,
  type Schlag,
  type SpinnenGrund,
  type Untergrund,
} from "./klangregeln";
import type { EventBus, GameEvents } from "../core/events";
import { ladeLautstaerken, speichereLautstaerken, type Lautgruppe, type Lautstaerken } from "./lautstaerke";

/**
 * Wo die Aufnahmen liegen (E-130). `BASE_URL` ist im Build "./" (vite.config:
 * base "./"), damit es unter /v1/ und in Capacitor gleich funktioniert.
 */
const TON_ORDNER = `${import.meta.env?.BASE_URL ?? "./"}ton/`;

/**
 * Lautstaerke einer Aufnahme je Einheit `laut` der Klangfamilie. Die Aufnahmen
 * sind auf −1 dBFS geschnitten, die alten Teiltoene lagen deutlich darunter.
 * SW: 2,5 — am Geraet gegen Motor und Radio abgleichen.
 */
const AUFNAHME_LAUT = 2.5;
/** Aufnahmen fuer die Rueckmeldungen (E-139): aus dem Bestand, keine eigenen Dateien. */
const FAMILIE_BLECH = FAMILIEN.blech!.proben;
const FAMILIE_STAHL = FAMILIEN.stahl!.proben;
const EINZEL_KLICK = FAMILIEN.kunststoff!.proben;
const GRUND_STAHL = GRUND.stahl.proben;
/**
 * Womit der Feierabend gerufen wird (E-148): Werkssirene (läuft hoch, steht
 * kurz, läuft aus) oder elektrische Werksklingel. Patrick entscheidet nach dem
 * Hören — umstellen heißt dieses eine Wort ändern.
 */
export const FEIERABEND_KLANG: "sirene" | "klingel" = "sirene";
/** Ein Knautscher und ein `crushed` im selben Moment: nur der erste klingt. SW: 0,3 s */
const KNAUTSCH_SPERRE_S = 0.3;

/**
 * Nachfassfristen in Millisekunden. `resume()` loest sein Versprechen auf iOS
 * auch dann ein, wenn der Kanal gleich wieder stumm wird — dem Versprechen
 * allein darf man also nicht glauben, man muss nachsehen.
 * SW: 250 ms (unmittelbar nach der Geste) und 1200 ms (nachdem das System die
 * Unterbrechung abgeschlossen hat).
 */
const NACHSEHEN_MS = [250, 1200];
/**
 * So viele Weckrufe duerfen vergeblich bleiben, bevor der Kanal beim naechsten
 * Antippen komplett neu gebaut wird. SW: 3 — die ersten beiden koennen daran
 * scheitern, dass gerade keine Nutzergeste anlag (dann verweigert Safari das
 * Aufwecken); beim dritten ist der Kanal vermutlich verloren.
 */
const NEUAUFBAU_AB = 3;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: Music | null = null;
  /** Musikwunsch des Spielers — gilt auch, bevor der Ton überhaupt läuft */
  private musicWanted = false; // E-139: Radio aus beim Start (Befund 17.10.: „kindliche Klänge")
  /**
   * Gewaehlter Sender. Steht auch dann schon fest, wenn es den Tonkanal noch
   * gar nicht gibt: Die erste Geste baut ihn dann gleich mit dem richtigen
   * Stueck auf, statt kurz das falsche anzuspielen.
   */
  private songWanted: string = STANDARD_SENDER;
  private engineGain: GainNode | null = null;
  /** Motor als Aufnahme (E-130); solange sie fehlt, schweigt er (E-153) */
  private motorQuelle: AudioBufferSourceNode | null = null;
  private motorFilter: BiquadFilterNode | null = null;
  /**
   * AUFNAHMEN (E-130). Die Bytes werden schon beim Seitenaufruf geholt — dafuer
   * braucht es keine Geste —, dekodiert wird, sobald der Tonkanal steht. Ein
   * AudioBuffer gehoert keinem Kanal, darum ueberlebt `proben` auch einen
   * Neuaufbau. Fehlt eine Datei, bleibt ihr Klang still (E-153).
   */
  private readonly rohbytes = new Map<string, ArrayBuffer>();
  private readonly proben = new Map<string, AudioBuffer>();
  private readonly ladeStart = typeof performance !== "undefined" ? performance.now() : 0;
  /** Ladebericht fuer Overlay und Messung: ms bis alles geholt bzw. dekodiert ist */
  private holMs = -1;
  private dekodierMs = -1;
  /** Letzte Achsbewegung und Schalentempo: beide speisen das Oelstroemen */
  private arm = 0;
  private schalenTempo = 0;
  private letzterKnautsch = -1;
  /**
   * Schlag-Bus mit Begrenzer (E-121): alle Ereignisklaenge und die
   * Materialschicht laufen hier durch, damit zwanzig gleichzeitige Schlaege
   * nicht klirren. Motor und Radio laufen daran vorbei (tonkonzept.md:
   * „Dauerklaenge nicht auf den Schlag-Kompressor").
   */
  private sfx: GainNode | null = null;
  /** Drei Lautstaerkegruppen vor dem Master (E-139); jeder Klang haengt an genau einer */
  private gruppen: Record<Lautgruppe, GainNode> | null = null;
  private readonly laut: Lautstaerken = ladeLautstaerken();
  /** Kehren: je Untergrund ein eigener Klangweg (E-121) */
  private kehr: Record<Untergrund, { gain: GainNode; filter: BiquadFilterNode }> | null = null;
  private rasselQuelle: AudioBufferSourceNode | null = null;
  private bettGain: GainNode | null = null;
  /** Greifen: Druckaufbau unter Last, Ventilzischen, Oelstroemen beim Bewegen */
  private stoehnFilter: BiquadFilterNode | null = null;
  private stoehnGain: GainNode | null = null;
  private ventilGain: GainNode | null = null;
  private schalenGain: GainNode | null = null;
  private readonly budget = new Stimmenbudget();
  private readonly bett = new Rasselbett();
  private readonly druckaufbau = new Druckaufbau();
  private letzterBiss = -1;
  /** Alle Dauerquellen, damit sie nach einer Unterbrechung ersetzt werden koennen */
  private dauerquellen: AudioScheduledSourceNode[] = [];
  /** Vergebliche Weckrufe, seit der Ton zuletzt lief */
  private weckversuche = 0;
  /** Seit dem letzten hoerbaren Moment gab es eine Unterbrechung */
  private unterbrochen = false;

  /**
   * @param bus Ereignisbus (Regel 10). Ohne Bus (Labor) bleiben Aufprall,
   *   Biss und Loslassen stumm, alles andere klingt wie bisher.
   */
  constructor(bus?: EventBus) {
    if (bus) {
      bus.on("schrott:aufprall", (e) => this.playAufprallEreignis(e));
      bus.on("greifer:zugedrueckt", (e) => this.playBiss(e.kraftKN));
      bus.on("released", () => this.playLoslassen());
      bus.on("wrack:geknautscht", (e) => this.playKnautsch(e.zuwachs));
      // E-151: Lasthebemagnet
      bus.on("magnet:an", () => this.playMagnet(true));
      bus.on("magnet:aus", () => this.playMagnet(false));
      bus.on("magnet:haftet", (e) => this.playMagnetKlonk(e.massKg));
      // E-139: Hämmern und Drücken mit der Spinne
      bus.on("spinne:aufschlag", (e) => this.playSpinnenAufschlag(e.wucht, e.untergrund));
      bus.on("spinne:druecken", (e) => this.playSpinnenDruecken(e.staerke, e.untergrund));
    }
    this.holeProben();
    const start = (): void => this.ensureStarted();
    // Mobile Browser geben den Ton erst nach einer echten Geste frei, und
    // welches Ereignis dabei zählt, unterscheidet sich je nach System — daher
    // auf alle üblichen hören.
    for (const ev of ["pointerdown", "pointerup", "touchend", "click", "keydown"]) {
      window.addEventListener(ev, start, { once: false, passive: true });
    }
    // Rueckkehr aus dem Hintergrund. Ohne diesen Handler bleibt ein auf
    // `interrupted` gefallener Kanal stumm, bis der Spieler zufaellig tippt.
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this.ensureStarted();
    });
    // Safari meldet die Rueckkehr aus dem Seiten-Zwischenspeicher (bfcache)
    // nur ueber `pageshow`; nach einem App-Wechsel kommt teils nur `focus`.
    window.addEventListener("pageshow", start);
    window.addEventListener("focus", start);
  }

  /** Musik an/aus. Liefert den neuen Zustand. */
  toggleMusic(): boolean {
    this.musicWanted = !this.musicWanted;
    if (this.music) {
      if (this.musicWanted) this.music.start();
      else this.music.stop();
    }
    return this.musicWanted;
  }

  get musicOn(): boolean {
    return this.musicWanted;
  }

  /** Kennung des gewaehlten Senders (fuer Menue und Spielstand). */
  get songId(): string {
    return this.songWanted;
  }

  /** Der gewaehlte Sender als Datensatz — Name, Frequenz, Beschreibung. */
  get song(): Song {
    return findeSender(this.songWanted);
  }

  /**
   * Sender waehlen. Liefert true, wenn sich etwas geaendert hat. Das Radio
   * bleibt dabei, wie es war: Ist es aus, bleibt es still.
   */
  setSong(id: string): boolean {
    const gewaehlt = findeSender(id).id;
    if (gewaehlt === this.songWanted) return false;
    this.songWanted = gewaehlt;
    this.music?.setSong(gewaehlt);
    return true;
  }

  /**
   * Zustandsbericht für Fehlersuche und Tests — bewusst ehrlich: `musicRunning`
   * meldet nur dann „laeuft", wenn der Kanal auch wirklich Ton durchlaesst.
   * Vorher stand im Overlay „Musik an (laeuft)", waehrend der Kanal auf
   * `interrupted` stand und nichts zu hoeren war.
   */
  get diagnostics(): Tondiagnose {
    const zustand = (this.ctx?.state as string | undefined) ?? "keiner";
    const hoerbar = istHoerbar(zustand);
    return {
      ctx: zustand,
      musicWanted: this.musicWanted,
      musicRunning: (this.music?.enabled ?? false) && hoerbar,
      hoerbar,
      weckversuche: this.weckversuche,
      aufnahmen: this.aufnahmenBericht,
    };
  }

  /**
   * Was die Aufnahmen kosten (E-130): wie viele da sind, wie lange Holen und
   * Dekodieren gedauert haben (ab Seitenaufruf), wie viel sie als Datei und
   * dekodiert im Speicher belegen.
   */
  get aufnahmenBericht(): NonNullable<Tondiagnose["aufnahmen"]> {
    let kB = 0;
    for (const b of this.rohbytes.values()) kB += b.byteLength / 1024;
    let speicherKB = 0;
    for (const b of this.proben.values()) speicherKB += (b.length * b.numberOfChannels * 4) / 1024;
    return {
      geladen: this.proben.size,
      gesamt: alleProben().length,
      holMs: Math.round(this.holMs),
      dekodierMs: Math.round(this.dekodierMs),
      kB: Math.round(kB),
      speicherKB: Math.round(speicherKB),
    };
  }

  /**
   * Alle Aufnahmen holen (E-130). Laeuft beim Seitenaufruf an und blockiert
   * nichts: Bis eine Datei da ist, bleibt ihr Klang still (E-153).
   * Die Bytes bleiben im Speicher (zusammen gut 1,7 MB), weil
   * `decodeAudioData` sie verbraucht und ein Neuaufbau des Kanals sie sonst
   * neu holen muesste.
   */
  private holeProben(): void {
    if (typeof fetch !== "function") return;
    const namen = alleProben();
    let offen = namen.length;
    const eine = (): void => {
      if (--offen === 0) this.holMs = performance.now() - this.ladeStart;
    };
    for (const n of namen) {
      fetch(`${TON_ORDNER}${dateiVon(n)}`)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((b) => {
          if (b) {
            this.rohbytes.set(n, b);
            this.dekodiere(n);
          }
        })
        .catch(() => {
          /* fehlt: dann bleibt es still */
        })
        .finally(eine);
    }
  }

  /**
   * Eine geholte Aufnahme dekodieren (Kopie, s. holeProben). Gibt es noch
   * keinen Tonkanal (vor der ersten Geste), dekodiert ein Offline-Kanal mit
   * 48 kHz — ein AudioBuffer gehoert keinem Kanal, und so ist beim ersten
   * Antippen schon alles fertig. Ohne Offline-Kanal wartet es auf den echten.
   */
  private dekodiere(n: string): void {
    const ctx: BaseAudioContext | null = this.ctx ?? this.dekoder();
    const bytes = this.rohbytes.get(n);
    if (!ctx || !bytes || this.proben.has(n) || typeof ctx.decodeAudioData !== "function") return;
    ctx
      .decodeAudioData(bytes.slice(0))
      .then((buf) => {
        if (this.proben.has(n)) return;
        this.proben.set(n, buf);
        if (this.proben.size === this.rohbytes.size) this.dekodierMs = performance.now() - this.ladeStart;
        // Sind alle Schleifen da, werden die Dauerklaenge einmal auf Aufnahmen umgebaut
        const schleifen = Object.values(SCHLEIFEN) as string[];
        if (schleifen.includes(n) && schleifen.every((s) => this.proben.has(s) || !this.rohbytes.has(s))) {
          this.baueDauertoene();
        }
      })
      .catch(() => {
        /* nicht dekodierbar: bleibt still */
      });
  }

  private offline: OfflineAudioContext | null = null;
  private dekoder(): OfflineAudioContext | null {
    if (!this.offline && typeof OfflineAudioContext === "function") {
      try {
        this.offline = new OfflineAudioContext(1, 1, 48000); // SW: Rate des iOS-Tonkanals
      } catch {
        /* dann eben mit dem echten Kanal */
      }
    }
    return this.offline;
  }

  /**
   * Eine Aufnahme spielen (E-130). `namen` sind Fassungen, eine wird zufaellig
   * gewaehlt. Liefert false, wenn sie (noch) nicht da ist — dann bleibt der
   * Klang still (E-153). `anteil` < 1 blendet frueher aus (Beton daempft),
   * `dauer` schneidet nach Sekunden ab, `tp` legt einen Tiefpass darueber.
   * E-159: Das Tempo kann niemand von aussen setzen. Jede Aufnahme spielt in
   * ihrem eigenen Tempo, gestreut um ±TEMPO_STREU — nie hoeher oder tiefer gezogen.
   */
  private spiele(
    namen: readonly string[],
    gain: number,
    opt: { delay?: number; anteil?: number; dauer?: number; tp?: number; bagger?: boolean } = {}
  ): boolean {
    const ctx = this.ctx;
    if (!ctx || !this.sfx || namen.length === 0) return false;
    const buf = this.proben.get(namen[Math.floor(Math.random() * namen.length)]!);
    if (!buf) return false;
    const rate = 1 + TEMPO_STREU * (2 * Math.random() - 1);
    const t = ctx.currentTime + (opt.delay ?? 0);
    const q = ctx.createBufferSource();
    q.buffer = buf;
    q.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    let kette: AudioNode = q;
    if (opt.tp) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = opt.tp;
      kette = q.connect(f);
    }
    kette.connect(g).connect(opt.bagger ? this.baggerBus : this.sfx);
    const voll = buf.duration / rate;
    const ende = Math.min(voll * (opt.anteil ?? 1), opt.dauer ?? voll);
    q.start(t);
    if (ende < voll) {
      g.gain.setValueAtTime(gain, t + ende * 0.6);
      g.gain.linearRampToValueAtTime(0.0001, t + ende);
      q.stop(t + ende + 0.02);
    }
    return true;
  }

  /** Ein Schlag aus der Familie als Aufnahme; laedt sie noch, bleibt es still (E-153). */
  private schlagAufnahme(s: Schlag, pegel: number, anteil = 1): void {
    this.spiele(s.proben, AUFNAHME_LAUT * s.laut * pegel, { anteil });
  }

  /**
   * Einstiegspunkt aller Weckrichtungen: baut den Kanal beim ersten Mal auf,
   * weckt ihn danach, und baut ihn notfalls neu.
   */
  private ensureStarted(): void {
    const ctx = this.ctx;
    if (!ctx) {
      this.baueKanal();
      return;
    }
    const zustand = ctx.state as string;
    if (brauchtNeuaufbau(zustand) || (this.weckversuche >= NEUAUFBAU_AB && !istHoerbar(zustand))) {
      this.neuAufbauen();
      return;
    }
    if (brauchtWeckruf(zustand)) {
      this.weckruf();
      return;
    }
    this.laeuftWieder();
  }

  /**
   * `resume()` anstossen und nachsehen, ob es geholfen hat. Der Weckruf gilt
   * so lange als vergeblich, bis das Gegenteil festgestellt ist — deshalb wird
   * hier hochgezaehlt und erst in `laeuftWieder()` zurueckgesetzt.
   */
  private weckruf(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.unterbrochen = true;
    this.weckversuche++;
    ctx.resume().catch(() => {});
    for (const ms of NACHSEHEN_MS) window.setTimeout(() => this.nachsehen(), ms);
  }

  /** Hat der Weckruf gegriffen? Wenn nein: noch einmal schieben. */
  private nachsehen(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const zustand = ctx.state as string;
    if (istHoerbar(zustand)) {
      this.laeuftWieder();
      return;
    }
    if (brauchtWeckruf(zustand)) ctx.resume().catch(() => {});
  }

  /**
   * Der Kanal ist (wieder) offen. Nach einer Unterbrechung werden die
   * Dauerquellen ersetzt: Auf iOS gelten Schleifen danach zwar weiter als laufend, geben aber nichts mehr aus.
   */
  private laeuftWieder(): void {
    this.weckversuche = 0;
    if (this.unterbrochen) {
      this.unterbrochen = false;
      this.baueDauertoene();
      this.music?.wiederaufnehmen();
    }
    if (this.musicWanted) this.music?.start();
  }

  /** Kanal samt Musik von Grund auf neu. Letzte Rettung, wenn nichts weckt. */
  private neuAufbauen(): void {
    const alt = this.ctx;
    this.stoppeDauertoene();
    try {
      this.music?.stop();
    } catch {
      /* toter Kanal — egal, er wird ohnehin verworfen */
    }
    this.music = null;
    this.ctx = null;
    this.master = null;
    this.sfx = null;
    this.gruppen = null;
    this.weckversuche = 0;
    this.unterbrochen = false;
    try {
      alt?.close().catch(() => {});
    } catch {
      /* war schon zu */
    }
    this.baueKanal();
  }

  private baueKanal(): void {
    try {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(ctx.destination);
      /*
       * Begrenzer statt Kompressor: Er greift erst kurz vor dem Klirren und
       * laesst schnell wieder los, damit er nicht pumpt (tonkonzept.md, die
       * Lehre aus dem Diesel). SW: -6 dB, 20:1, 2 ms an, 120 ms los.
       */
      this.sfx = ctx.createGain();
      const begrenzer = ctx.createDynamicsCompressor();
      begrenzer.threshold.value = -6;
      begrenzer.knee.value = 3;
      begrenzer.ratio.value = 20;
      begrenzer.attack.value = 0.002;
      begrenzer.release.value = 0.12;
      const gruppe = (g: Lautgruppe): GainNode => {
        const n = ctx.createGain();
        n.gain.value = this.laut[g];
        n.connect(this.master!);
        return n;
      };
      this.gruppen = { bagger: gruppe("bagger"), metall: gruppe("metall"), musik: gruppe("musik") };
      this.sfx.connect(begrenzer).connect(this.gruppen.metall);
      this.unterbrochen = false;
      this.weckversuche = 0;
      // E-130: was schon geholt ist, jetzt dekodieren (der Rest, sobald es da ist)
      for (const n of this.rohbytes.keys()) this.dekodiere(n);

      // Der Kanal meldet selbst, wenn er einschlaeft — der einzige Weg, einen
      // Ausfall mitten im Spiel (Anruf, Kontrollzentrum) sofort zu bemerken.
      ctx.onstatechange = (): void => {
        if (this.ctx !== ctx) return; // gehoert zu einem verworfenen Kanal
        const z = ctx.state as string;
        if (istHoerbar(z)) this.laeuftWieder();
        else if (brauchtWeckruf(z)) this.weckruf();
      };

      // Hintergrundmusik, zur Laufzeit erzeugt — keine fremden Aufnahmen
      this.music = new Music(ctx, this.gruppen.musik, this.songWanted);
      if (this.musicWanted) this.music.start();

      this.baueDauertoene();

      // Frisch angelegte Kanaele starten auf iOS haeufig als `suspended`
      if (brauchtWeckruf(ctx.state as string)) this.weckruf();
    } catch {
      this.ctx = null; // Audio bleibt aus, Spiel läuft weiter
    }
  }

  /**
   * Motor, Hydraulik und Kratzen laufen dauerhaft. Sie liegen in einer eigenen
   * Methode, weil sie nach jeder Tonunterbrechung ersetzt werden muessen — und
   * seit E-130 einmal mehr, sobald die Aufnahmen dekodiert sind.
   */
  private baueDauertoene(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    this.stoppeDauertoene();

    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.05;
    this.engineGain.connect(this.baggerBus);
    // E-130: Diesel im Stand als Aufnahme (BigSoundBank #2147).
    // E-153: Solange sie laedt, schweigt der Motor — vorher sprang ein Saegezahn ein.
    // E-159: Tempo fest; die Bedienung macht ihn lauter und heller (Tiefpass), nicht hoeher.
    this.motorFilter = ctx.createBiquadFilter();
    this.motorFilter.type = "lowpass";
    this.motorFilter.frequency.value = MOTOR_HZ_LEER;
    this.motorFilter.connect(this.engineGain);
    const motor = this.proben.get(SCHLEIFEN.motor);
    const motorQuellen: AudioScheduledSourceNode[] = [];
    if (motor) {
      this.motorQuelle = ctx.createBufferSource();
      this.motorQuelle.buffer = motor;
      this.motorQuelle.loop = true;
      this.motorQuelle.connect(this.motorFilter);
      this.motorQuelle.start();
      motorQuellen.push(this.motorQuelle);
    }
    /*
     * Der Pumpenton (Dreieck 118 Hz, Wunsch 29.08.2026) ist mit E-130 entfallen:
     * Er war einer der Summtoene. Die Hydraulik beim Bewegen kommt jetzt aus
     * derselben Aufnahme wie die Schalenfahrt (`oelFluss`).
     */
    this.dauerquellen = [...motorQuellen, ...this.baueMaterialschicht(ctx)];
  }

  /**
   * Kehren, Rasseln und Greifen — alles Dauerquellen auf Pegel 0, die erst
   * die Setter und Ereignisse hochziehen. Liefert die Quellen fuer den
   * Unterbrechungs-Ersatz.
   *
   * Jeder Weg spielt eine Aufnahme in Schleife (`SCHLEIFEN`). Solange sie
   * laedt, bleibt er stumm (E-153; vorher Rauschen und Knisterpuffer).
   */
  private baueMaterialschicht(ctx: AudioContext): AudioScheduledSourceNode[] {
    const sfx = this.sfx!;
    const quellen: AudioScheduledSourceNode[] = [];
    const loop = (buf: AudioBuffer): AudioBufferSourceNode => {
      const q = ctx.createBufferSource();
      q.buffer = buf;
      q.loop = true;
      q.start();
      quellen.push(q);
      return q;
    };
    const band = (hz: number, q: number, typ: BiquadFilterType = "bandpass"): BiquadFilterNode => {
      const f = ctx.createBiquadFilter();
      f.type = typ;
      f.frequency.value = hz;
      f.Q.value = q;
      return f;
    };
    const stumm = (ziel: AudioNode = sfx): GainNode => {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(ziel);
      return g;
    };
    const auf = (n: string): AudioBuffer | undefined => this.proben.get(n);
    /** Eine Aufnahme als Schleife in `ziel` — fehlt sie (laedt noch), bleibt der Weg stumm (E-153). */
    const schleife = (n: string, ziel: AudioNode): AudioBufferSourceNode | null => {
      const b = auf(n);
      if (!b) return null;
      const q = loop(b);
      q.connect(ziel);
      return q;
    };

    // Kehren: je Untergrund eine Aufnahme hinter einem weichen Tiefpass
    const beton = { gain: stumm(), filter: band(4000, 0.5, "lowpass") };
    const stahl = { gain: stumm(), filter: band(9000, 0.5, "lowpass") };
    const schrott = { gain: stumm(), filter: band(6000, 0.5, "lowpass") };
    beton.filter.connect(beton.gain);
    stahl.filter.connect(stahl.gain);
    schrott.filter.connect(schrott.gain);
    schleife(SCHLEIFEN.kehrBeton, beton.filter);
    schleife(SCHLEIFEN.kehrStahl, stahl.filter);
    this.rasselQuelle = schleife(SCHLEIFEN.rassel, schrott.filter);
    this.kehr = { beton, stahl, schrott };

    // Rasselbett: was keinen eigenen Schlag bekommt, rasselt hier (dieselbe Aufnahme)
    this.bettGain = stumm();
    this.rasselQuelle?.connect(band(7000, 0.5, "lowpass")).connect(this.bettGain);

    // Druckaufbau beim Zudruecken: Greifkran unter Last (Aufnahme H)
    this.stoehnFilter = band(900, 0.7, "lowpass");
    this.stoehnGain = stumm(this.baggerBus);
    this.stoehnFilter.connect(this.stoehnGain);
    schleife(SCHLEIFEN.druck, this.stoehnFilter);
    // Druckbegrenzungsventil: Zischen, wenn die Spinne am Ende ist
    this.ventilGain = stumm(this.baggerBus);
    const ventilFilter = band(3500, 0.7, "highpass");
    ventilFilter.connect(this.ventilGain);
    schleife(SCHLEIFEN.ventil, ventilFilter);
    // Schalen und Arm in Bewegung: Oel stroemt
    this.schalenGain = stumm(this.baggerBus);
    const fahrtFilter = band(8000, 0.7, "lowpass");
    fahrtFilter.connect(this.schalenGain);
    schleife(SCHLEIFEN.fahrt, fahrtFilter);

    return quellen;
  }

  /** Alte Dauerquellen abstellen und abhaengen, damit nichts doppelt laeuft. */
  private stoppeDauertoene(): void {
    for (const q of this.dauerquellen) {
      try {
        q.stop();
      } catch {
        /* nie gestartet oder schon gestoppt */
      }
      try {
        q.disconnect();
      } catch {
        /* schon abgehaengt */
      }
    }
    this.dauerquellen = [];
    this.engineGain = null;
    this.motorQuelle = null;
    this.motorFilter = null;
    this.kehr = null;
    this.rasselQuelle = null;
    this.bettGain = null;
    this.stoehnFilter = null;
    this.stoehnGain = null;
    this.ventilGain = null;
    this.schalenGain = null;
  }

  /** Pro Frame: activity 0..1 (Achsbewegung), load 0..1 (Traglast-Anteil). */
  updateEngine(activity: number, load: number): void {
    if (!this.ctx || !this.engineGain) return;
    const t = this.ctx.currentTime;
    if (this.motorQuelle) {
      // E-159, SW: Last = lauter und heller (Tiefpass oeffnet), das Tempo bleibt fest.
      // E-151: Ist der Magnet an, zieht der Generator am Diesel — etwas lauter und heller.
      const gen = this.magnetAn ? 1 : 0;
      this.motorFilter?.frequency.setTargetAtTime(
        MOTOR_HZ_LEER + 3500 * activity + 1000 * load + MAGNET_HELL_HZ * gen,
        t,
        0.15
      );
      this.engineGain.gain.setTargetAtTime(0.06 + 0.07 * activity + 0.02 * load + MAGNET_LAUT * gen, t, 0.15);
    }
    this.arm = activity;
    this.oelAktualisieren(t);
  }

  /** Oelstroemen aus Schalentempo und Armbewegung (E-130, `oelFluss`). */
  private oelAktualisieren(t: number): void {
    if (!this.schalenGain) return;
    const o = oelFluss(this.schalenTempo, this.arm);
    this.schalenGain.gain.setTargetAtTime(o.laut, t, 0.06);
  }

  /**
   * Pro Frame: Die Spinne schleift (E-121). `intensity` 0..1 ist das Tempo,
   * `untergrund` sagt worueber. Die beiden anderen Klangwege blenden in
   * 80 ms aus — wer von Beton auf die Ladeflaeche zieht, hoert den Wechsel.
   */
  setScrape(intensity: number, untergrund: Untergrund = "beton"): void {
    if (!this.ctx || !this.kehr) return;
    const t = this.ctx.currentTime;
    const k = kehrKlang(intensity, untergrund);
    // Mit Aufnahme ein Tiefpass beim Vierfachen: schneller = heller (E-130, SW)
    const hz = k.hz * 4;
    for (const g of ["beton", "stahl", "schrott"] as const) {
      const weg = this.kehr[g];
      weg.gain.gain.setTargetAtTime(g === untergrund ? k.laut : 0, t, g === untergrund ? 0.06 : 0.08);
      if (g === untergrund) weg.filter.frequency.setTargetAtTime(hz, t, 0.06);
    }
  }

  /**
   * Pro Frame: die Spinne (E-121). `schalenTempo` 0..1 = wie schnell die
   * Schalen gerade fahren (Oel fliesst), `kraft` 0..1 = Schliesskraft durch
   * Hoechstkraft (Zylinder steht unter Druck). Beides darf gleichzeitig sein.
   * Seit E-130 beides auf Aufnahmen: Lautstaerke und Tiefpass (E-159: kein Tempo mehr).
   */
  setGreifer(schalenTempo: number, kraft: number): void {
    if (!this.ctx || !this.stoehnGain || !this.stoehnFilter || !this.ventilGain || !this.schalenGain) return;
    const t = this.ctx.currentTime;
    // E-130: an der Aenderung der Kraft, nicht an ihrem Wert — wer zuhaelt, hoert Stille
    const s = this.druckaufbau.schritt(t, kraft);
    this.stoehnGain.gain.setTargetAtTime(s.laut, t, 0.05);
    this.stoehnFilter.frequency.setTargetAtTime(s.filterHz, t, 0.1);
    this.ventilGain.gain.setTargetAtTime(s.zischen, t, 0.05);
    this.schalenTempo = Math.min(1, Math.max(0, schalenTempo));
    this.oelAktualisieren(t);
  }

  /** Gerade klingende Aufprall-Schlaege (Messung, Waechter). */
  get stimmen(): number {
    return this.ctx ? this.budget.aktiv(this.ctx.currentTime) : 0;
  }

  /**
   * Ein Schrottteil schlaegt auf (Ereignis `schrott:aufprall`, E-121).
   *
   * Drei Wege: zu schwach → nur Rasseln; kein Platz im Stimmenbudget →
   * Rasseln, staerker; sonst ein eigener Schlag aus Teil und Untergrund.
   */
  playAufprallEreignis(e: GameEvents["schrott:aufprall"]): void {
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime;
    const r = aufprallKlang(e);
    if (!r) {
      this.rassle(t, 0.06 * Math.min(1, e.wucht / 1.5)); // SW
      return;
    }
    if (!this.budget.darf(t, dauerVon(r.teil), r.pegel)) {
      this.rassle(t, 0.25 * r.pegel); // SW
      return;
    }
    this.aufprallAufnahme(r);
    if (e.untergrund === "schrott") this.rassle(t, 0.15 * r.pegel); // SW: es rutscht nach
  }

  /** Energie ins Rasselbett, Pegel folgt mit Abklingen. SW: voll = 0,12. */
  private rassle(t: number, menge: number): void {
    if (!this.bettGain) return;
    const stand = this.bett.dazu(t, menge);
    const g = this.bettGain.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(0.12 * stand, t, 0.015);
    g.setTargetAtTime(0, t + 0.05, this.bett.tau);
  }

  /** Teil und Untergrund eines Aufpralls (E-130: Aufnahmen, sonst Teiltoene). */
  private aufprallAufnahme(r: AufprallRezept): void {
    this.schlagAufnahme(r.teil, r.pegel, r.daempf);
    if (r.koerper) this.schlagAufnahme(r.koerper, r.pegel, r.daempf); // E-159: die Masse klingt mit
    this.schlagAufnahme(r.grund, r.pegel);
  }

  /**
   * Das Wrack knautscht (Ereignis `wrack:geknautscht`, E-130). Grundschicht ist
   * die zerdrueckte Dose (BigSoundBank #0118), tiefer gelegt und mit
   * Metallschlaegen geschichtet; `zuwachs` macht sie lauter, laenger, tiefer
   * und dichter (`knautschKlang`). Die Presse (bis 1) faltet hoerbar das ganze
   * Auto, ein Biss (~0,17) knirscht kurz.
   */
  playKnautsch(zuwachs: number): void {
    if (!this.ctx || !(zuwachs > 0)) return;
    const k = knautschKlang(zuwachs);
    this.letzterKnautsch = this.ctx.currentTime;
    if (!this.spiele(EINZEL.knautsch, 0.75 * k.pegel, { dauer: k.dauer })) return;
    // Metallschlaege ueber die Dauer verteilt: je mehr Zuwachs, desto dichter
    const stahl = aufprallKlang({ materialId: "steel", massKg: 300, wucht: 6, blech: false, untergrund: "beton" })!;
    for (let i = 0; i < k.schlaege; i++) {
      const d = ((i + 0.3 + Math.random() * 0.4) / k.schlaege) * k.dauer * 0.8;
      this.spiele(stahl.teil.proben, 0.35 * k.pegel, { delay: d, tp: 3000 });
    }
  }

  /**
   * Der Biss (Ereignis `greifer:zugedrueckt`, E-112/E-121): das Material
   * knirscht unter dem Druck, lauter je haerter. Ein Biss trifft oft mehrere
   * Koerper im selben Bild — es knirscht trotzdem nur einmal.
   */
  playBiss(kraftKN: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (t - this.letzterBiss < 0.08) return; // SW: ein Knirschen je Moment
    this.letzterBiss = t;
    const p = bissPegel(kraftKN);
    // E-130: Dose zerdrueckt (BigSoundBank #0118), tiefer gelegt, mit Metallschlag.
    // Haerter = lauter und etwas tiefer. SW: Pegel 0,55, Tempo 1,05 → 0,9
    const k = Math.min(1, kraftKN / VOLLE_KRAFT_KN);
    this.spiele(EINZEL.biss, 0.55 * p, { tp: 4000 + 6000 * (1 - k) });
  }

  /**
   * Loslassen (Ereignis `released`, E-121): das Ventil oeffnet, der Druck
   * entweicht mit einem fallenden Zischen, die Schalen klacken auf.
   */
  playLoslassen(): void {
    if (!this.ctx || !this.sfx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // E-130: das Zischen aus der Ventil-Aufnahme, der Klack als Metallanschlag
    this.spiele(EINZEL.anschlag, 0.12, { delay: 0.02, tp: 3000, bagger: true });
    const ventil = this.proben.get(SCHLEIFEN.ventil);
    if (!ventil) return; // E-153: laedt noch — dann nur der Klack, kein Rauschen
    const src = ctx.createBufferSource();
    src.buffer = ventil;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 1.2;
    // SW: 3,2 kHz → 1,2 kHz in 0,35 s, Pegel 0,07
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(1200, t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3, t); // SW
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    src.connect(f).connect(g).connect(this.baggerBus);
    src.start(t);
    src.stop(t + 0.42);
  }

  /**
   * Zuschnappen der Spinne: Stahl auf Stahl (Wunsch 11.09.2026).
   *
   * Kein Zupacken-Thump, sondern ein harter, heller Anschlag mit kurzem
   * metallischem Nachklingen — so klingt es, wenn die Zaehne leer
   * aufeinandertreffen. Liegt Material dazwischen, daempft das: dann kommt
   * `haerte` kleiner herein und der Klang wird kuerzer und leiser.
   */
  playClawSnap(haerte = 1, _typ?: string): void {
    const h = Math.max(0.15, Math.min(haerte, 1));
    // E-130: Stahl auf Stahl als Aufnahme; weich gedaempft = leiser, tiefer, dumpfer (SW)
    this.spiele(EINZEL.anschlag, 0.2 + 0.35 * h, { tp: 1500 + 8000 * h });
  }

  playGrab(materialId?: string): void {
    // E-130: der Greifkran fasst Schrott (Pixabay „Grua recicladora“, H). SW: 0,5
    this.spiele(EINZEL.zupacken, 0.5, { bagger: true });
    // E-121: dazu das Material, leise — man hoert, WAS man gefasst hat.
    // SW: wie ein Aufprall mit 4 m/s, auf Pegel 0,35 gedeckelt.
    if (!materialId) return;
    const r = aufprallKlang({ materialId, massKg: 50, wucht: 4, blech: false, untergrund: "schrott" });
    if (r) this.schlagAufnahme(r.teil, Math.min(r.pegel, 0.35));
  }

  /**
   * Abwurfklang je Material (Kap. 15): dieselbe Aufnahme wie der Aufprall des
   * Materials (80 kg, 5 m/s, auf Stahl). E-153: ohne die gerechneten Teiltoene.
   */
  playDrop(materialId: string): void {
    const r = aufprallKlang({ materialId, massKg: 80, wucht: 5, blech: false, untergrund: "stahl" });
    if (r) this.spiele(r.teil.proben, AUFNAHME_LAUT * r.teil.laut * 0.7, {});
  }

  /**
   * Alter Direktaufruf aus main.ts — bleibt stumm. Seit E-121 klingt der
   * Aufprall ueber das Ereignis `schrott:aufprall` (`playAufprallEreignis`).
   * Entfernen, sobald main.ts das Ereignis sendet statt hier anzurufen.
   */
  playAufprall(_materialId: string, _wucht: number, _aufStahl: boolean): void {}

  /** Rueckfahrwarner eines rangierenden LKW. Stumm, siehe oben. */
  setRueckfahrwarner(_an: boolean): void {}

  /** Taktgeber der Platzkulisse. Stumm, siehe oben. */
  tickUmgebung(_dt: number): void {}

  /**
   * Eine Baugruppe reißt ab: Metall kreischt kurz (Kreischen der Ladefläche,
   * tief gelegt) und Blech kracht. E-139: vorher ein fallender Sägezahn —
   * ein Laser-„Piu", kein Metall.
   */
  playTear(): void {
    this.spiele([SCHLEIFEN.kehrStahl], 0.35, { dauer: 0.45 });
    this.spiele(FAMILIE_BLECH, 0.5, { delay: 0.05 });
  }

  /** Schwerer Blech-Crash (Quetschstufe). */
  playCrash(strength = 1): void {
    /*
     * E-130: Folgt ein `crushed` (oder der Pressenstempel) unmittelbar auf
     * einen Knautscher, hat der Knautscher den Vortritt — er kam zuerst und
     * kennt die Staerke. Sonst knallten zwei volle Crashs uebereinander.
     */
    if (this.ctx && this.ctx.currentTime - this.letzterKnautsch < KNAUTSCH_SPERRE_S) return;
    this.spiele(EINZEL.knautsch, 0.35 + 0.4 * strength, { dauer: 1 + 1.5 * strength });
  }

  /** Scheibe birst. */
  playGlass(): void {
    this.spiele(EINZEL.glas, 0.45); // E-130: BigSoundBank #0148/#0771. SW
  }

  /** Zaunfeld reißt aus der Verankerung: es scheppert und rasselt (E-139: Aufnahmen statt Dreieckston). */
  playRattle(): void {
    this.spiele(FAMILIE_BLECH, 0.6);
    this.spiele([SCHLEIFEN.rassel], 0.5, { dauer: 0.5 });
  }

  /**
   * Verkauf, Waage, Ausbau. E-139: gestrichen — der Münz-Dreiklang war eine
   * Tonkette, und ein Schrottplatz hat keine. Die Einblendung bleibt.
   */
  playSale(): void {}

  /** Bis wann das Feierabendsignal klingt (Kanalzeit) — die Sterne warten darauf. */
  private feierabendBis = -1;

  /**
   * FEIERABEND (E-113, E-139, E-148): die Werkssirene oder die Werksklingel
   * (`FEIERABEND_KLANG`), echte Aufnahmen. Gruppe Bagger: ein Signal des
   * Betriebs, das auch hört, wer das Metall leise gestellt hat.
   */
  playFeierabend(): void {
    const ctx = this.ctx;
    const name = EINZEL[FEIERABEND_KLANG][0];
    const buf = this.proben.get(name);
    // SW: Sirene 0,35, Klingel 0,3 — beide stehen auf −1 dBFS und klingen lange
    if (!ctx || !buf || !this.spiele([name], FEIERABEND_KLANG === "sirene" ? 0.35 : 0.3, { bagger: true })) return;
    this.feierabendBis = ctx.currentTime + buf.duration;
  }

  /**
   * Der Fahrer hupt (E-148): LKW-Drucklufthupe, zweimal — kurz, dann lang
   * („tut-tuuut"), wie ein Fahrer, der ungeduldig wird. Gruppe Bagger: ein
   * Signal des Platzbetriebs, kein Metallklang.
   */
  private magnetAn = false;
  private letzterKlonk = -1;

  /**
   * Lasthebemagnet an oder aus (`magnet:an` / `magnet:aus`, E-151): das
   * Schütz klackt — trocken (Kunststoff-Klacken, tiefer gelegt) mit einem
   * leisen Metallanschlag darunter. Beim Ausschalten etwas heller und leiser,
   * dann fällt die Last (deren Aufprall kommt über `schrott:aufprall`).
   *
   * KEIN BRUMMEN: Ein echter Magnet brummt mit 50/100 Hz — ein stehender Ton,
   * genau der Ufo-Befund (16.10.), und im Bestand gibt es keine Aufnahme davon.
   * Was man an einem echten Magnetbagger hört, ist der Generator: Der Diesel
   * zieht an. Darum dreht der Motor (`updateEngine`) etwas höher und lauter,
   * solange der Magnet an ist — die vorhandene Aufnahme, kein neuer Ton.
   */
  playMagnet(an: boolean): void {
    this.magnetAn = an;
    this.spiele(EINZEL_KLICK, an ? 0.45 : 0.35, { tp: an ? 3000 : 5000, bagger: true }); // SW
    this.spiele(EINZEL.anschlag, an ? 0.12 : 0.08, { tp: 2000, delay: 0.005, bagger: true }); // SW
  }

  /**
   * Teile schlagen an der Magnetscheibe an (`magnet:haftet`, E-151): ein
   * dumpfer Klonk — Stahl gegen die Stahlplatte, mit Tiefpass. Lauter mit
   * der Masse. Kommen viele kurz nacheinander, klingt nur einer je
   * `KLONK_ABSTAND_S`; der Rest klappert leise im Rasselbett.
   */
  playMagnetKlonk(massKg: number): void {
    if (!this.ctx || !(massKg > 0)) return;
    const t = this.ctx.currentTime;
    const p = klonkPegel(massKg);
    if (t - this.letzterKlonk < KLONK_ABSTAND_S) {
      this.rassle(t, 0.2 * p); // SW
      return;
    }
    this.letzterKlonk = t;
    this.spiele(FAMILIE_STAHL, AUFNAHME_LAUT * 0.25 * p, { tp: 2500 });
    this.spiele(GRUND_STAHL, AUFNAHME_LAUT * 0.2 * p, {});
  }

  playHupe(): void {
    this.spiele(EINZEL.hupe, 0.45, { dauer: 0.3, bagger: true }); // SW
    this.spiele(EINZEL.hupe, 0.5, { delay: 0.45, bagger: true }); // SW
  }

  /**
   * Die Sterne des Tages, hörbar (E-113). E-139: ein bis drei Hammerschläge
   * auf Stahl, gleich hoch, statt einer aufsteigenden Tonfolge — man zählt
   * die Schläge. Nach der Glocke, damit sie nicht im Anschlag untergehen.
   */
  playSterne(anzahl: number): void {
    // E-148: nach dem Feierabendsignal (die Sirene klingt fast 5 s), sonst nach 0,95 s
    const jetzt = this.ctx?.currentTime ?? 0;
    const ab = Math.max(0.95, this.feierabendBis - jetzt + 0.2); // SW: 0,2 s Luft
    for (let i = 0; i < Math.max(0, Math.min(3, anzahl)); i++) {
      this.spiele(FAMILIE_STAHL, 0.55, { delay: ab + i * 0.32 }); // SW
    }
  }

  /**
   * Richtig sortiert, Challenge-Schritt geschafft. E-153: still. Das
   * Funk-Knacken aus E-139 war gerechnetes Rauschen; eine echte Funk-Aufnahme
   * gibt es im Bestand nicht (offen für Patrick). Was richtig landet, hört man
   * am Aufprall in der Mulde.
   */
  playCorrect(): void {}

  /**
   * Rastklick des Funktionsrädchens und jedes Antippens: ein trockenes
   * Kunststoff-Klacken (E-139: Aufnahme statt zwei Pieptönen). Bewusst leise.
   */
  playTick(): void {
    this.spiele(EINZEL_KLICK, 0.15, { tp: 5000, bagger: true }); // SW
  }

  /**
   * Falsch sortiert, Fahrer hupt (main.ts ruft beides hierher). E-139: ein
   * stumpfer, tiefer Schlag auf eine Muldenwand statt des Rechteck-Brummens.
   * Eine Hupe gibt es im Bestand nicht (offen für Patrick).
   */
  playWrong(): void {
    this.spiele(GRUND_STAHL, 0.9, { tp: 700 }); // SW
  }

  private letzterHieb = -1;
  private naechsterDruck = -1;

  /**
   * Die Spinne schlägt auf (Ereignis `spinne:aufschlag`, E-139): schwerer
   * Stahl plus Untergrund, laut nach Wucht. Mindestabstand gegen Trommelfeuer.
   */
  playSpinnenAufschlag(wucht: number, grund: SpinnenGrund): void {
    if (!this.ctx || !(wucht > 0)) return;
    const t = this.ctx.currentTime;
    if (t - this.letzterHieb < AUFSCHLAG_ABSTAND_S) return;
    this.letzterHieb = t;
    for (const s of spinnenAufschlag(wucht, grund)) {
      this.spiele(s.proben, AUFNAHME_LAUT * 0.3 * s.pegel, { dauer: s.dauer, tp: s.tp });
    }
    if (grund === "schrott") this.rassle(t, 0.3 * wucht); // SW: der Haufen rutscht nach
  }

  /**
   * Die Spinne drückt (Ereignis `spinne:druecken`, E-139): ein kurzer Stoß
   * Knirschen, dann Pause — nie ein Dauerton (Befund 16.10.: „wie in einem Ufo").
   */
  playSpinnenDruecken(staerke: number, grund: SpinnenGrund): void {
    if (!this.ctx || !(staerke > 0)) return;
    const t = this.ctx.currentTime;
    if (t < this.naechsterDruck) return;
    this.naechsterDruck = t + DRUECK_ABSTAND_S + Math.random() * DRUECK_STREU_S;
    const s = spinnenDruecken(staerke, grund);
    this.spiele(s.proben, AUFNAHME_LAUT * 0.3 * s.pegel, { dauer: s.dauer, tp: s.tp });
  }

  /** Gruppe Bagger: Motor, Hydraulik, Greifer-Mechanik, Kabine (E-139). */
  private get baggerBus(): AudioNode {
    return this.gruppen?.bagger ?? this.master!;
  }

  /** Lautstaerke einer Gruppe 0..1 (E-139). */
  lautstaerke(g: Lautgruppe): number {
    return this.laut[g];
  }

  /** Lautstaerke einer Gruppe setzen (0..1), sofort hoerbar und gemerkt. */
  setLautstaerke(g: Lautgruppe, wert: number): void {
    const v = Math.min(1, Math.max(0, Number.isFinite(wert) ? wert : 1));
    this.laut[g] = v;
    const n = this.gruppen?.[g];
    if (n && this.ctx) n.gain.setTargetAtTime(v, this.ctx.currentTime, 0.03); // SW: 30 ms, knackfrei
    speichereLautstaerken(this.laut);
  }
}
