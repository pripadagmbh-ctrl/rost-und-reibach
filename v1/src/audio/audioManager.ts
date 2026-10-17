/**
 * Kern-Sounds M1 (Briefing Kap. 15) — per WebAudio; Greifen, Aufprall, Kehren, Knautschen und
 * Motor seit E-130 aus geschnittenen Aufnahmen (public/ton/, Herkunft in QUELLEN.md), der Rest prozedural.
 * Audio ist der primäre Belohnungskanal: jeder Abwurf klingt nach seinem Material,
 * richtig = Funk-Knacken, falsch = stumpfer Schlag. Seit E-139 keine Tonfolge mehr:
 * kein Klang hier spielt eine Melodie oder einen Piepton (Waechter in geraeusche.test.ts).
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
const EINZEL_VA = FAMILIEN.va!.proben;
const EINZEL_KLICK = FAMILIEN.kunststoff!.proben;
const GRUND_STAHL = GRUND.stahl.proben;
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
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  /** Motor als Aufnahme (E-130); solange sie fehlt, laeuft `engineOsc` */
  private motorQuelle: AudioBufferSourceNode | null = null;
  /**
   * AUFNAHMEN (E-130). Die Bytes werden schon beim Seitenaufruf geholt — dafuer
   * braucht es keine Geste —, dekodiert wird, sobald der Tonkanal steht. Ein
   * AudioBuffer gehoert keinem Kanal, darum ueberlebt `proben` auch einen
   * Neuaufbau. Fehlt eine Datei, klingt an ihrer Stelle die alte Synthese.
   */
  private readonly rohbytes = new Map<string, ArrayBuffer>();
  private readonly proben = new Map<string, AudioBuffer>();
  private readonly ladeStart = typeof performance !== "undefined" ? performance.now() : 0;
  /** Ladebericht fuer Overlay und Messung: ms bis alles geholt bzw. dekodiert ist */
  private holMs = -1;
  private dekodierMs = -1;
  /** Kehren laeuft ueber Aufnahmen (dann Tiefpass statt enger Baender) */
  private kehrAufnahme = false;
  private druckQuelle: AudioBufferSourceNode | null = null;
  private fahrtQuelle: AudioBufferSourceNode | null = null;
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
  private kornQuelle: AudioBufferSourceNode | null = null;
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
   * nichts: Bis eine Datei da ist, klingt an ihrer Stelle die alte Synthese.
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
      fetch(`${TON_ORDNER}${n}.wav`)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((b) => {
          if (b) {
            this.rohbytes.set(n, b);
            this.dekodiere(n);
          }
        })
        .catch(() => {
          /* fehlt: dann klingt die Synthese */
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
        /* nicht dekodierbar: Synthese bleibt */
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
   * gewaehlt. Liefert false, wenn sie (noch) nicht da ist — dann spielt der
   * Aufrufer die Synthese. `anteil` < 1 blendet frueher aus (Beton daempft),
   * `dauer` schneidet nach Sekunden ab, `tp` legt einen Tiefpass darueber.
   */
  private spiele(
    namen: readonly string[],
    gain: number,
    opt: { rate?: number; delay?: number; anteil?: number; dauer?: number; tp?: number; bagger?: boolean } = {}
  ): boolean {
    const ctx = this.ctx;
    if (!ctx || !this.sfx || namen.length === 0) return false;
    const buf = this.proben.get(namen[Math.floor(Math.random() * namen.length)]!);
    if (!buf) return false;
    const rate = opt.rate ?? 1;
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

  /** Ein Schlag aus der Familie als Aufnahme, sonst als Teiltoene (alter Weg). */
  private schlagAufnahme(s: Schlag, pegel: number, rate = 1, anteil = 1): void {
    const streu = 1 + (Math.random() - 0.5) * s.streu;
    if (!this.spiele(s.proben, AUFNAHME_LAUT * s.laut * pegel, { rate: rate * streu, anteil })) this.schlag(s, pegel);
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
   * Dauerquellen ersetzt: Auf iOS gelten Oszillatoren und Rauschschleifen
   * danach zwar weiter als laufend, geben aber nichts mehr aus.
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
    // Die Rauschpuffer gehoeren zum alten Kanal und waeren im neuen unbrauchbar
    this.cachedNoise = null;
    this.puffer.clear();
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
    const motor = this.proben.get(SCHLEIFEN.motor);
    let motorQuelle: AudioScheduledSourceNode;
    if (motor) {
      // E-130: Diesel im Stand als Aufnahme (BigSoundBank #2147), Tempo folgt der Bedienung
      this.motorQuelle = ctx.createBufferSource();
      this.motorQuelle.buffer = motor;
      this.motorQuelle.loop = true;
      this.motorQuelle.connect(this.engineGain);
      this.motorQuelle.start();
      motorQuelle = this.motorQuelle;
    } else {
      // Ersatz, bis die Aufnahme da ist: tiefer Saegezahn + Tiefpass
      this.engineOsc = ctx.createOscillator();
      this.engineOsc.type = "sawtooth";
      this.engineOsc.frequency.value = 48;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = "lowpass";
      engineFilter.frequency.value = 220;
      this.engineOsc.connect(engineFilter).connect(this.engineGain);
      this.engineOsc.start();
      motorQuelle = this.engineOsc;
    }
    /*
     * Der Pumpenton (Dreieck 118 Hz, Wunsch 29.08.2026) ist mit E-130 entfallen:
     * Er war einer der Summtoene. Die Hydraulik beim Bewegen kommt jetzt aus
     * derselben Aufnahme wie die Schalenfahrt (`oelFluss`).
     */
    this.dauerquellen = [motorQuelle, ...this.baueMaterialschicht(ctx)];
  }

  /**
   * Kehren, Rasseln und Greifen — alles Dauerquellen auf Pegel 0, die erst
   * die Setter und Ereignisse hochziehen. Liefert die Quellen fuer den
   * Unterbrechungs-Ersatz.
   *
   * Seit E-130 spielt jeder Weg eine Aufnahme in Schleife (`SCHLEIFEN`).
   * Solange sie fehlt, laeuft er auf Rauschen oder Knisterpuffern (E-121) —
   * nie auf einem Oszillator, damit nichts summt.
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
    let weissQ: AudioBufferSourceNode | null = null;
    const weiss = (): AudioBufferSourceNode => (weissQ ??= loop(this.noiseBuffer()));
    // Eigene Rauschquelle fuer die Hydraulik: eine Quelle gehoert genau einer Lautstaerkegruppe (E-139)
    let weissB: AudioBufferSourceNode | null = null;
    const weissBagger = (): AudioBufferSourceNode => (weissB ??= loop(this.noiseBuffer()));

    // Kehren. Mit Aufnahme ein weicher Tiefpass (die Aufnahme bringt ihren
    // Klang mit) statt der engen Baender aus E-121.
    const betonAuf = auf(SCHLEIFEN.kehrBeton);
    const rasselAuf = auf(SCHLEIFEN.rassel);
    const stahlAuf = auf(SCHLEIFEN.kehrStahl);
    this.kehrAufnahme = !!(betonAuf && rasselAuf && stahlAuf);
    // SW: Koernung 220 Koerner/s à 6 ms, Geroell 35 Schlaege/s à 25 ms
    const korn = loop(betonAuf ?? this.knisterPuffer("korn", 220, 0.006));
    const rassel = loop(rasselAuf ?? this.knisterPuffer("rassel", 35, 0.025));
    this.kornQuelle = korn;
    this.rasselQuelle = rassel;
    const beton = { gain: stumm(), filter: betonAuf ? band(4000, 0.5, "lowpass") : band(1100, 0.9) };
    korn.connect(beton.filter).connect(beton.gain);
    if (!betonAuf) {
      const betonRausch = ctx.createGain();
      betonRausch.gain.value = 0.35; // SW
      weiss().connect(betonRausch).connect(beton.filter);
    }
    const stahl = { gain: stumm(), filter: stahlAuf ? band(9000, 0.5, "lowpass") : band(2400, 8) };
    (stahlAuf ? loop(stahlAuf) : weiss()).connect(stahl.filter).connect(stahl.gain);
    const schrott = { gain: stumm(), filter: rasselAuf ? band(6000, 0.5, "lowpass") : band(1500, 0.8) };
    rassel.connect(schrott.filter).connect(schrott.gain);
    this.kehr = { beton, stahl, schrott };

    // Rasselbett: was keinen eigenen Schlag bekommt, rasselt hier
    this.bettGain = stumm();
    rassel.connect(rasselAuf ? band(7000, 0.5, "lowpass") : band(1800, 0.6)).connect(this.bettGain);

    // Druckaufbau beim Zudruecken: Greifkran unter Last (Aufnahme H), ersatzweise Rauschen
    const druck = auf(SCHLEIFEN.druck);
    this.stoehnFilter = band(900, 0.7, "lowpass");
    this.stoehnGain = stumm(this.baggerBus);
    this.druckQuelle = druck ? loop(druck) : null;
    (this.druckQuelle ?? weissBagger()).connect(this.stoehnFilter).connect(this.stoehnGain);
    // Druckbegrenzungsventil: Zischen, wenn die Spinne am Ende ist
    const ventil = auf(SCHLEIFEN.ventil);
    this.ventilGain = stumm(this.baggerBus);
    (ventil ? loop(ventil) : weissBagger()).connect(band(3500, 0.7, "highpass")).connect(this.ventilGain);
    // Schalen und Arm in Bewegung: Oel stroemt
    const fahrt = auf(SCHLEIFEN.fahrt);
    this.schalenGain = stumm(this.baggerBus);
    this.fahrtQuelle = fahrt ? loop(fahrt) : null;
    (this.fahrtQuelle ?? weissBagger()).connect(band(fahrt ? 8000 : 900, 0.7, "lowpass")).connect(this.schalenGain);

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
    this.engineOsc = null;
    this.engineGain = null;
    this.motorQuelle = null;
    this.kehr = null;
    this.kornQuelle = null;
    this.rasselQuelle = null;
    this.bettGain = null;
    this.stoehnFilter = null;
    this.stoehnGain = null;
    this.ventilGain = null;
    this.schalenGain = null;
    this.druckQuelle = null;
    this.fahrtQuelle = null;
  }

  /** Pro Frame: activity 0..1 (Achsbewegung), load 0..1 (Traglast-Anteil). */
  updateEngine(activity: number, load: number): void {
    if (!this.ctx || !this.engineGain) return;
    const t = this.ctx.currentTime;
    if (this.motorQuelle) {
      // E-130, SW: Drehzahl als Abspieltempo 0,9…1,3; die Aufnahme liegt bei −3 dBFS
      this.motorQuelle.playbackRate.setTargetAtTime(0.9 + 0.3 * activity + 0.1 * load, t, 0.15);
      this.engineGain.gain.setTargetAtTime(0.06 + 0.07 * activity + 0.02 * load, t, 0.15);
    } else if (this.engineOsc) {
      // Beim Bedienen geht der Motor spürbar hoch — das trägt das Feedback
      this.engineOsc.frequency.setTargetAtTime(46 * (1 + 0.55 * activity + 0.22 * load), t, 0.12);
      this.engineGain.gain.setTargetAtTime(0.05 + 0.085 * activity + 0.02 * load, t, 0.15);
    }
    this.arm = activity;
    this.oelAktualisieren(t);
  }

  /** Oelstroemen aus Schalentempo und Armbewegung (E-130, `oelFluss`). */
  private oelAktualisieren(t: number): void {
    if (!this.schalenGain) return;
    const o = oelFluss(this.schalenTempo, this.arm);
    this.schalenGain.gain.setTargetAtTime(o.laut, t, 0.06);
    this.fahrtQuelle?.playbackRate.setTargetAtTime(o.rate, t, 0.08);
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
    const hz = this.kehrAufnahme ? k.hz * 4 : k.hz;
    for (const g of ["beton", "stahl", "schrott"] as const) {
      const weg = this.kehr[g];
      weg.gain.gain.setTargetAtTime(g === untergrund ? k.laut : 0, t, g === untergrund ? 0.06 : 0.08);
      if (g === untergrund) weg.filter.frequency.setTargetAtTime(hz, t, 0.06);
    }
    // Schneller schleifen = dichter koernen. Die Rasselquelle teilt sich das
    // Kehren auf Schrott mit dem Rasselbett — beide werden dann lebhafter.
    if (untergrund === "beton") this.kornQuelle?.playbackRate.setTargetAtTime(k.rate, t, 0.1);
    if (untergrund === "schrott") this.rasselQuelle?.playbackRate.setTargetAtTime(k.rate, t, 0.1);
  }

  /**
   * Pro Frame: die Spinne (E-121). `schalenTempo` 0..1 = wie schnell die
   * Schalen gerade fahren (Oel fliesst), `kraft` 0..1 = Schliesskraft durch
   * Hoechstkraft (Zylinder steht unter Druck). Beides darf gleichzeitig sein.
   * Seit E-130 beides auf Aufnahmen: Lautstaerke, Tempo und Tiefpass.
   */
  setGreifer(schalenTempo: number, kraft: number): void {
    if (!this.ctx || !this.stoehnGain || !this.stoehnFilter || !this.ventilGain || !this.schalenGain) return;
    const t = this.ctx.currentTime;
    // E-130: an der Aenderung der Kraft, nicht an ihrem Wert — wer zuhaelt, hoert Stille
    const s = this.druckaufbau.schritt(t, kraft);
    this.stoehnGain.gain.setTargetAtTime(s.laut, t, 0.05);
    this.druckQuelle?.playbackRate.setTargetAtTime(s.rate, t, 0.12);
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
    this.schlagAufnahme(r.teil, r.pegel, r.rate, r.daempf);
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
    if (!this.spiele(EINZEL.knautsch, 0.75 * k.pegel, { rate: k.rate, dauer: k.dauer })) {
      // Ersatz ohne Aufnahme: der alte Crash, nach Staerke
      this.burst([52, 78], 0.7, 0.2 + 0.4 * k.pegel, "sine");
      this.noiseBurst(2500, 0.18, 0.3 * k.pegel);
      return;
    }
    // Metallschlaege ueber die Dauer verteilt: je mehr Zuwachs, desto dichter
    const stahl = aufprallKlang({ materialId: "steel", massKg: 300, wucht: 6, blech: false, untergrund: "beton" })!;
    for (let i = 0; i < k.schlaege; i++) {
      const d = ((i + 0.3 + Math.random() * 0.4) / k.schlaege) * k.dauer * 0.8;
      this.spiele(stahl.teil.proben, 0.35 * k.pegel, { rate: 0.75 + Math.random() * 0.15, delay: d });
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
    if (this.spiele(EINZEL.biss, 0.55 * p, { rate: 1.05 - 0.15 * k })) return;
    // Ersatz: drei kurze, tiefe Knirscher, dazu das Anriss-Rauschen
    const teile = [180, 290, 460, 720, 1150];
    const abkling = [0.12, 0.1, 0.08, 0.06, 0.05];
    for (const [i, d] of [0, 0.03, 0.07].entries()) {
      this.metalHit(teile, abkling, 0.28 * p * Math.pow(0.6, i), {
        transient: 2500,
        transientGain: 0.25 * p * Math.pow(0.6, i),
        spread: 0.1,
      }, d);
    }
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
    const ventil = this.proben.get(SCHLEIFEN.ventil);
    const src = ctx.createBufferSource();
    src.buffer = ventil ?? this.noiseBuffer();
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 1.2;
    // SW: 3,2 kHz → 1,2 kHz in 0,35 s, Pegel 0,07
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(1200, t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(ventil ? 0.3 : 0.07, t); // SW: die Aufnahme ist schmalbandiger als weisses Rauschen
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    src.connect(f).connect(g).connect(this.baggerBus);
    src.start(t);
    src.stop(t + 0.42);
    this.spiele(EINZEL.anschlag, 0.12, { rate: 1.25, delay: 0.02, tp: 3000, bagger: true });
  }

  /** Ein Schlag nach Rezept, mit Nachklappern und Rascheln. */
  private schlag(s: Schlag, pegel: number): void {
    for (let i = 0; i <= s.scheppern; i++) {
      const d = i === 0 ? 0 : 0.045 * i * (1 + Math.random() * 0.3); // SW: 45 ms Abstand
      const f = Math.pow(0.5, i);
      this.metalHit(
        i === 0 ? s.teiltoene : s.teiltoene.slice(1),
        i === 0 ? s.abkling : s.abkling.slice(1).map((x) => x * 0.6),
        s.laut * pegel * f,
        { transient: s.anriss, transientGain: s.anrissLaut * pegel * f, spread: s.streu * (1 + i) },
        d
      );
    }
    if (s.rascheln > 0) this.noiseBurst(s.rascheln, 0.2, 0.16 * pegel);
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
    if (this.spiele(EINZEL.anschlag, 0.2 + 0.35 * h, { rate: 0.85 + 0.2 * h, tp: 1500 + 8000 * h })) return;
    this.metalHit([620, 940, 1380, 1970], [0.34 * h, 0.26 * h, 0.18 * h, 0.12 * h], 0.1 + 0.12 * h, {
      transient: 1500,
      transientGain: 0.3 * h,
      spread: 0.012,
    });
  }

  playGrab(materialId?: string): void {
    // E-130: der Greifkran fasst Schrott (Pixabay „Grua recicladora“, H). SW: 0,5
    if (!this.spiele(EINZEL.zupacken, 0.5, { bagger: true })) {
      // Ersatz: kurzer Rauschimpuls + tiefer Thump
      this.burst([70], 0.18, 0.35, "triangle");
      this.noiseBurst(500, 0.08, 0.25);
    }
    // E-121: dazu das Material, leise — man hoert, WAS man gefasst hat.
    // SW: wie ein Aufprall mit 4 m/s, auf Pegel 0,35 gedeckelt.
    if (!materialId) return;
    const r = aufprallKlang({ materialId, massKg: 50, wucht: 4, blech: false, untergrund: "schrott" });
    if (r) this.schlagAufnahme(r.teil, Math.min(r.pegel, 0.35), r.rate);
  }

  /**
   * Abwurfklang je Material (Kap. 15). Metall klingt nicht harmonisch wie ein
   * Instrument, sondern über INHARMONISCHE Teiltöne mit unterschiedlich langem
   * Abklingen — genau das bildet metalHit nach. Dazu ein kurzer Aufprall-
   * Transient, der Masse und Härte vermittelt.
   */
  playDrop(materialId: string): void {
    // E-130: dieselbe Aufnahme wie der Aufprall des Materials (80 kg, 5 m/s)
    const r = aufprallKlang({ materialId, massKg: 80, wucht: 5, blech: false, untergrund: "stahl" });
    if (r && this.spiele(r.teil.proben, AUFNAHME_LAUT * r.teil.laut * 0.7, { rate: r.rate })) return;
    switch (materialId) {
      case "steel":
        // schwerer Stahl: tiefer Anschlag, langes metallisches Nachklingen
        this.metalHit([214, 331, 487, 712, 1043], [0.9, 0.7, 0.5, 0.34, 0.22], 0.26, {
          transient: 1600,
          transientGain: 0.3,
          spread: 0.05,
        });
        break;
      case "va":
        // Edelstahl: heller und klarer, klingt am längsten nach
        this.metalHit([392, 611, 913, 1327, 1904], [1.25, 0.95, 0.7, 0.45, 0.3], 0.2, {
          transient: 3400,
          transientGain: 0.2,
          spread: 0.03,
        });
        break;
      case "alu":
        // Aluminium: leicht, hell, kurzer Nachhall
        this.metalHit([523, 807, 1188, 1673], [0.5, 0.36, 0.24, 0.16], 0.19, {
          transient: 4200,
          transientGain: 0.22,
          spread: 0.04,
        });
        break;
      case "copper":
        // Kupfer/Messing: weicher, dunkler Klang mit tragendem Sustain
        this.metalHit([297, 449, 668, 951], [1.0, 0.8, 0.55, 0.35], 0.22, {
          transient: 1100,
          transientGain: 0.18,
          spread: 0.06,
        });
        break;
      case "cable":
        // Kabelbund: fast tonlos, dumpfes Poltern mit Raschelanteil
        this.metalHit([132, 189], [0.24, 0.18], 0.2, {
          transient: 900,
          transientGain: 0.3,
          spread: 0.09,
        });
        this.noiseBurst(1600, 0.22, 0.16);
        break;
      default:
        // Störstoff (Holz, Beton, Kunststoff): Schlag ohne metallisches Klingen
        this.metalHit([96, 143], [0.14, 0.1], 0.3, {
          transient: 420,
          transientGain: 0.26,
          spread: 0.02,
        });
    }
  }

  /**
   * Ein Metallschlag: kurzer Aufprall-Transient plus inharmonische Partialtöne,
   * die unterschiedlich schnell verklingen.
   * @param partials Teiltonfrequenzen (bewusst nicht harmonisch)
   * @param decays Abklingzeit je Teilton in Sekunden
   * @param gain Grundlautstärke
   */
  private metalHit(
    partials: number[],
    decays: number[],
    gain: number,
    opts: { transient: number; transientGain: number; spread: number },
    delay = 0
  ): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const ziel = this.ausgang;
    // Aufprall: sehr kurzer, gefilterter Rauschimpuls
    this.noiseBurst(opts.transient, 0.045, opts.transientGain, delay);
    partials.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      // leichte Verstimmung je Anschlag — kein Ton klingt exakt wie der vorige
      osc.frequency.value = f * (1 + (Math.random() - 0.5) * opts.spread);
      osc.type = i === 0 ? "triangle" : "sine";
      const g = this.ctx!.createGain();
      const amp = (gain / (i + 1.4)) * (0.85 + Math.random() * 0.3);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(amp, 0.0002), t + 0.006); // harter Anschlag
      g.gain.exponentialRampToValueAtTime(0.0001, t + decays[i]);
      osc.connect(g).connect(ziel);
      osc.start(t);
      osc.stop(t + decays[i] + 0.05);
    });
  }

  /*
   * ------------------------------------------------------------------
   * Stumm gestellt, nicht geloescht (Ansage 12.09.2026: "erst Ton fixen,
   * auf Stand von gestern frueh gehen, und Toene einzeln testen spaeter").
   *
   * Die Klangwelt steht wieder auf dem Stand vom 11.09. mittags — vor der
   * gesamten Tonueberarbeitung. Drei Dinge sind seither im Spiel dazugekommen
   * und rufen hier an: Aufschlaege von Teilen, der Rueckfahrwarner und der
   * Taktgeber der Platzkulisse. Sie bleiben als leere Einsprungstellen
   * stehen, damit das Spiel unveraendert laeuft und jeder Klang spaeter
   * EINZELN wieder eingeschaltet und beurteilt werden kann — genau so, wie
   * es diesmal haette laufen muessen.
   *
   * Was daraus geworden ist, steht in docs/tonkonzept.md.
   * ------------------------------------------------------------------
   */

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
    const kreisch = this.spiele([SCHLEIFEN.kehrStahl], 0.35, { rate: 0.7 + Math.random() * 0.1, dauer: 0.45 });
    const blech = this.spiele(FAMILIE_BLECH, 0.5, { rate: 0.85 + Math.random() * 0.1, delay: 0.05 });
    if (!kreisch && !blech) this.noiseBurst(1800, 0.35, 0.3); // Ersatz, bis die Aufnahmen da sind
  }

  /** Schwerer Blech-Crash (Quetschstufe). */
  playCrash(strength = 1): void {
    /*
     * E-130: Folgt ein `crushed` (oder der Pressenstempel) unmittelbar auf
     * einen Knautscher, hat der Knautscher den Vortritt — er kam zuerst und
     * kennt die Staerke. Sonst knallten zwei volle Crashs uebereinander.
     */
    if (this.ctx && this.ctx.currentTime - this.letzterKnautsch < KNAUTSCH_SPERRE_S) return;
    if (this.spiele(EINZEL.knautsch, 0.35 + 0.4 * strength, { dauer: 1 + 1.5 * strength })) return;
    this.burst([52, 78], 0.7, 0.35 + 0.25 * strength, "sine");
    this.burst([161, 214, 289], 0.5, 0.32, "triangle");
    this.noiseBurst(2500, 0.18, 0.3);
  }

  /** Scheibe birst. */
  playGlass(): void {
    if (this.spiele(EINZEL.glas, 0.45)) return; // E-130: BigSoundBank #0148/#0771. SW
    this.burst([1900, 2600, 3400], 0.28, 0.2);
    this.noiseBurst(7000, 0.14, 0.22);
  }

  /** Zaunfeld reißt aus der Verankerung: es scheppert und rasselt (E-139: Aufnahmen statt Dreieckston). */
  playRattle(): void {
    const blech = this.spiele(FAMILIE_BLECH, 0.6);
    const rassel = this.spiele([SCHLEIFEN.rassel], 0.5, { dauer: 0.5 });
    if (!blech && !rassel) this.noiseBurst(900, 0.35, 0.3);
  }

  /**
   * Verkauf, Waage, Ausbau. E-139: gestrichen — der Münz-Dreiklang war eine
   * Tonkette, und ein Schrottplatz hat keine. Die Einblendung bleibt.
   */
  playSale(): void {}

  /**
   * DIE FEIERABENDGLOCKE (E-113, E-139). Zwei Schläge auf ein aufgehängtes
   * Stück Stahl — so wird auf Baustellen und Plätzen gerufen. E-139: Aufnahme
   * (fallende Stahlstangen, BigSoundBank #1776/#0235, lang ausklingend) statt
   * der gerechneten Glocke. Der zweite Schlag nach 0,62 s und schwächer.
   */
  playFeierabend(): void {
    this.spiele(EINZEL_VA, 0.5, { rate: 0.8 }); // SW
    this.spiele(EINZEL_VA, 0.35, { rate: 0.8, delay: 0.62 }); // SW
  }

  /**
   * Die Sterne des Tages, hörbar (E-113). E-139: ein bis drei Hammerschläge
   * auf Stahl, gleich hoch, statt einer aufsteigenden Tonfolge — man zählt
   * die Schläge. Nach der Glocke, damit sie nicht im Anschlag untergehen.
   */
  playSterne(anzahl: number): void {
    for (let i = 0; i < Math.max(0, Math.min(3, anzahl)); i++) {
      this.spiele(FAMILIE_STAHL, 0.55, { rate: 0.95 + Math.random() * 0.06, delay: 0.95 + i * 0.32 }); // SW
    }
  }

  /**
   * Richtig sortiert, Challenge-Schritt geschafft. E-139: statt „Kaching"
   * (zwei Sinustöne) das Knacken eines Funkgeräts, wenn jemand die Taste
   * loslässt — „verstanden". Gefiltertes Rauschen, keine Tonhöhe.
   */
  playCorrect(): void {
    this.funkKnacken(0, 0.18); // SW
    this.funkKnacken(0.07, 0.12); // SW
  }

  /**
   * Rastklick des Funktionsrädchens und jedes Antippens: ein trockenes
   * Kunststoff-Klacken (E-139: Aufnahme statt zwei Pieptönen). Bewusst leise.
   */
  playTick(): void {
    this.spiele(EINZEL_KLICK, 0.15, { rate: 1.5 + Math.random() * 0.1, tp: 5000, bagger: true }); // SW
  }

  /**
   * Falsch sortiert, Fahrer hupt (main.ts ruft beides hierher). E-139: ein
   * stumpfer, tiefer Schlag auf eine Muldenwand statt des Rechteck-Brummens.
   * Eine Hupe gibt es im Bestand nicht (offen für Patrick).
   */
  playWrong(): void {
    if (!this.spiele(GRUND_STAHL, 0.9, { rate: 0.6, tp: 700 })) this.noiseBurst(300, 0.25, 0.3); // SW
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
      this.spiele(s.proben, AUFNAHME_LAUT * 0.3 * s.pegel, { rate: s.rate, dauer: s.dauer, tp: s.tp });
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
    this.spiele(s.proben, AUFNAHME_LAUT * 0.3 * s.pegel, { rate: s.rate, dauer: s.dauer, tp: s.tp });
  }

  /** Ein Knacken wie aus dem Funkgerät: 25 ms Rauschen im Sprachband. */
  private funkKnacken(delay: number, gain: number): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1800; // SW: Mitte des Funk-Sprachbands
    f.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
    src.connect(f).connect(g).connect(this.baggerBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.04);
  }

  // ---------- Synthese-Helfer ----------

  private burst(freqs: number[], dur: number, gain: number, type: OscillatorType = "sine"): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = f * (0.98 + Math.random() * 0.04); // leichte Verstimmung
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(gain / freqs.length, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g).connect(this.ausgang);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
  }

  private noiseBurst(cutoff: number, dur: number, gain: number, delay = 0): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(g).connect(this.ausgang);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  /** Wohin Ereignisklaenge gehen: Schlag-Bus mit Begrenzer (Gruppe Metall), sonst direkt. */
  private get ausgang(): AudioNode {
    return this.sfx ?? this.master!;
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

  /**
   * Knisterpuffer (E-121): eine Sekunde einzelner, kurz abklingender Koerner
   * in zufaelligem Abstand — Grundstoff fuer Schaben und Geroell. Einmal je
   * Kanal gerechnet, danach in Schleife gespielt.
   * @param dichte Koerner je Sekunde
   * @param abkling Abklingzeit eines Korns (s)
   */
  private puffer = new Map<string, AudioBuffer>();
  private knisterPuffer(name: string, dichte: number, abkling: number): AudioBuffer {
    const da = this.puffer.get(name);
    if (da) return da;
    const ctx = this.ctx!;
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    const p = dichte / len;
    const fall = Math.exp(-1 / (abkling * len));
    let huell = 0;
    for (let i = 0; i < len; i++) {
      if (Math.random() < p) huell = Math.max(huell, 0.3 + 0.7 * Math.random() ** 2);
      data[i] = huell * (Math.random() * 2 - 1);
      huell *= fall;
    }
    this.puffer.set(name, buf);
    return buf;
  }

  private cachedNoise: AudioBuffer | null = null;
  private noiseBuffer(): AudioBuffer {
    if (this.cachedNoise) return this.cachedNoise;
    const len = this.ctx!.sampleRate;
    const buf = this.ctx!.createBuffer(1, len, this.ctx!.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.cachedNoise = buf;
    return buf;
  }
}
