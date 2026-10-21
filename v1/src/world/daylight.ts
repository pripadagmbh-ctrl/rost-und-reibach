import * as THREE from "three";
import { YARD_D, YARD_MIN_X, YARD_MAX_X, GATE_X, TOR_HALB } from "./yard";
import { platzwache } from "./platzinventar";

/**
 * Tageslauf über dem Platz (Wunsch 29.08.2026).
 *
 * Ein Arbeitstag dauert eine Viertelstunde Echtzeit und läuft von Sonnen-
 * aufgang bis in die Nacht. Damit bekommt der Wechsel aus Annahme und
 * Sortieren ein sichtbares Gegenstück: Man sieht am Licht, wie weit der Tag
 * ist, statt nur eine Zahl im HUD zu lesen.
 *
 * Sobald es dämmert, geht das Flutlicht an — vier Masten an den Ecken,
 * allesamt nach innen auf die Arbeitsfläche gerichtet.
 */

/** Länge eines vollen Tages in Sekunden */
export const DAY_LENGTH_S = 900;
/** Tageszeit, bei der das Spiel beginnt: früher Morgen */
export const START_TIME = 0.28;

/*
 * DIE SCHICHT-UHR (E-203, 21.10.2026) — keine zweite Uhr, sondern dieselbe mit
 * einer anderen Tageslaenge.
 *
 * Patrick, 21.10.2026: Eine Schicht dauert rund zehn Minuten, die Uhr im Bild
 * laeuft von 06:00 bis 16:00 (`docs/schicht-konzept.md`, Abschnitt 2). Zehn
 * Spielstunden in 600 s sind 60 s je Spielstunde, ein voller Tag also
 * 24 x 60 = 1 440 s statt 900 s. Die Sonne wandert mit: Um 16:00 steht sie
 * noch bei `daylight` 0,98 (sin 150° = 0,5), das Flutlicht kaeme erst gegen
 * 17:30 (`daylight` < 0,45) — in der Schicht also nie.
 *
 * Regel aus E-113: Es gibt genau EINE Uhr (`Daylight.time`). Die Schicht
 * schaltet nur die Tageslaenge um (`schichtTag()`), sie zaehlt keine eigene
 * Zeit. Der Sandkasten ruft `schichtTag()` nie auf und rechnet bitgleich wie
 * vorher (`dt / 900`, Start 0,28 — Waechter in `test/schichtuhr.test.ts`).
 */
/*
 * Die Zahlen selbst stehen seit E-202 in `world/schichtzeit.ts` (ohne three.js,
 * damit der Fahrplan sie lesen kann) und werden hier weitergereicht — es bleibt
 * eine Stelle.
 */
import { SCHICHT_TAG_S, SCHICHT_START } from "./schichtzeit";
export { SCHICHT_TAG_S, SCHICHT_START, SCHICHT_TORSCHLUSS, SCHICHT_FEIERABEND } from "./schichtzeit";

/** Farben für Himmel und Sonne über den Tag */
const SKY_NIGHT = new THREE.Color(0x151b26);
const SKY_DAWN = new THREE.Color(0xd8a07a);
const SKY_DAY = new THREE.Color(0xb8c4cc);
const SUN_LOW = new THREE.Color(0xffb066);
const SUN_HIGH = new THREE.Color(0xfff4e0);

export class Daylight {
  /** 0 = Mitternacht, 0.25 = Sonnenaufgang, 0.5 = Mittag, 0.75 = Sonnenuntergang */
  time = START_TIME;
  /**
   * Wie viele Sekunden ein voller Tag dauert: im Sandkasten `DAY_LENGTH_S`
   * (900), in der Schicht `SCHICHT_TAG_S` (1 440). Umgeschaltet nur ueber
   * `schichtTag()`, damit es bei einer Uhr bleibt (E-113, E-203).
   */
  tageslaengeS = DAY_LENGTH_S;
  /** 0 = tiefe Nacht, 1 = heller Tag — auch fürs Flutlicht ausgewertet */
  daylight = 1;
  private sky = new THREE.Color();
  private sunColor = new THREE.Color();

  constructor(
    private scene: THREE.Scene,
    private hemi: THREE.HemisphereLight,
    private sun: THREE.DirectionalLight
  ) {}

  /** Uhrzeit als Text fürs HUD. */
  get clock(): string {
    const min = Math.floor(this.time * 24 * 60);
    return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  }

  /**
   * Auf den Schicht-Tag umschalten (E-203): Uhr auf 06:00, ein Tag dauert
   * 1 440 s. Aufzurufen beim Bau einer Schicht, bevor die Uhr laeuft. Der
   * Tageszaehler `tag` bleibt, wie er ist — er gehoert dem Platzinventar.
   */
  schichtTag(): void {
    this.tageslaengeS = SCHICHT_TAG_S;
    this.time = SCHICHT_START;
  }

  /** Laeuft die Uhr im Schicht-Takt? */
  get istSchicht(): boolean {
    return this.tageslaengeS === SCHICHT_TAG_S;
  }

  /** Sekunden seit Schichtbeginn (06:00), aus der einen Uhr gerechnet. */
  get schichtSekunden(): number {
    return (this.time - SCHICHT_START) * this.tageslaengeS;
  }

  get isNight(): boolean {
    return this.daylight < 0.35;
  }

  /**
   * Wie viele Tageswechsel es seit dem Start gab.
   *
   * Es gab bisher keinen Tagesanfang im Spiel — die Uhr laeuft um Mitternacht
   * ueber, und niemand merkte es. Seit dem 15.09.2026 haengt daran etwas:
   * Platzinventar (Kehrbesen, spaeter Muellcontainer) „erscheint am naechsten
   * Tag wieder" (Ansage Patrick). Mehr als das Zaehlen macht diese Klasse
   * nicht; wer etwas daran haengen will, fragt `neuerTag` ab und setzt es
   * zurueck. Eine Tagesbilanz gehoert ausdruecklich NICHT hierher — der
   * Wirtschaftskreislauf ist zurueckgestellt.
   */
  tag = 0;
  /**
   * Steht auf true, sobald die Uhr ueber Mitternacht gelaufen ist, und bleibt
   * es, bis jemand es zuruecksetzt. Eine Flanke, kein Ereignis: So kann der
   * Aufrufer sie in seinem eigenen Takt abholen, ohne dass hier ein Bus
   * haengt.
   */
  neuerTag = false;

  update(dt: number): void {
    const vorher = this.time;
    this.time = (this.time + dt / this.tageslaengeS) % 1;
    /*
     * MITTERNACHT — der einzige Tageswechsel, den das Spiel hat.
     *
     * `economy/shift.ts` fuehrt keinen Tagesablauf und keine Phasen. Ein
     * „Morgen" gibt es nur hier: wenn die Uhr ueber 24:00 laeuft.
     *
     * Hier haengen ZWEI Fassungen derselben Gattung „Platzinventar", die am
     * 15.09.2026 unabhaengig voneinander entstanden sind — eine fuer den Besen
     * (E-031, Merker `neuerTag`, abgefragt in `main.ts`), eine fuer den
     * Muellcontainer (E-034, `platzwache`, die sich jeder selbst abholt).
     * Beide sind fuer sich richtig und gepruefft; sie zusammenzulegen ist ein
     * eigenes Paket und nicht die Arbeit eines Zusammenfuehrens.
     *
     * Bis dahin laufen beide. Sie stoeren einander nicht: Der Merker traegt
     * den Besen, die Platzwache den Container.
     */
    if (this.time < vorher) {
      this.tag++;
      this.neuerTag = true;
    }
    /*
     * MITTERNACHT — der einzige Tageswechsel, den das Spiel hat.
     *
     * `economy/shift.ts` fuehrt keinen Tagesablauf und keine Phasen (es zaehlt
     * Umschlag und macht die Einfahrt zu, wenn der Platz zusteht). Ein
     * „Morgen" gibt es nur hier: wenn die Uhr ueber 24:00 laeuft. Daran haengt
     * das Platzinventar — der Muellcontainer wird nachts geleert, sein Inhalt
     * liegt morgens im Abfall-Silo (`world/platzinventar.ts`).
     *
     * Gemeldet wird ueber die Platzwache und nicht per Rueckruf: So braucht es
     * keine Verdrahtung in `main.ts`, und wer den Wechsel braucht, holt ihn
     * sich in seiner eigenen Runde ab.
     */
    if (this.time < vorher) platzwache.neuerTag();

    // Sonnenhöhe: sin über den Tagbogen, negativ heißt unter dem Horizont
    // SCHICHT (E-202, Orchestrator 21.10.2026): Die Uhr zeigt 06:00–16:00, das LICHT laeuft halb so
    // schnell um Mittag (09:30–14:30) — sonst begaenne jede Schicht in der Daemmerung. Eine Uhr, nur die Sonne versetzt.
    const lichtZeit = this.istSchicht ? 0.5 + (this.time - 11 / 24) / 2 : this.time;
    const angle = (lichtZeit - 0.25) * Math.PI * 2;
    const height = Math.sin(angle);
    this.daylight = THREE.MathUtils.clamp(height * 1.35 + 0.3, 0, 1);

    // Sonne wandert von Ost nach West, im Sommerbogen leicht nach Süden
    const r = 46;
    this.sun.position.set(Math.cos(angle) * r, Math.max(height * 38, -6), 14 + height * 8);
    this.sun.intensity = Math.max(height, 0) * 1.9;

    // Tief stehende Sonne färbt warm, Mittagssonne neutral
    const warmth = THREE.MathUtils.clamp(1 - Math.max(height, 0) * 2.4, 0, 1);
    this.sunColor.copy(SUN_HIGH).lerp(SUN_LOW, warmth);
    this.sun.color.copy(this.sunColor);

    // Himmel: nachts dunkel, in der Dämmerung warm, tagsüber hell bedeckt
    if (this.daylight < 0.5) {
      this.sky.copy(SKY_NIGHT).lerp(SKY_DAWN, this.daylight * 2);
    } else {
      this.sky.copy(SKY_DAWN).lerp(SKY_DAY, (this.daylight - 0.5) * 2);
    }
    (this.scene.background as THREE.Color).copy(this.sky);
    if (this.scene.fog) (this.scene.fog as THREE.Fog).color.copy(this.sky);

    // Grundhelligkeit: nachts bleibt genug, um sich zu orientieren
    this.hemi.intensity = 0.1 + this.daylight * 0.8;
  }
}

/**
 * Höhe der Umrandung, in der ein Mast steckt — drei Lagen à 0,6 m (yard.ts).
 */
const MAUER_H = 1.8;
/** Kantenlänge des Betonsockels um den Mast (SW): etwas dicker als die Mauer. */
const SOCKEL = 0.72;

/**
 * Einen Standort auf die nächstgelegene Platzmauer legen — „eingemauert".
 *
 * Befund 14.09.2026 (Patrick, auf dem Gerät): „Die Scheinwerfer müssen nicht
 * unbedingt auf dem Platz stehen. Die können auch quasi eingemauert sein mit
 * dem Legostein. Das heißt, die gucken einfach aus den Legosteinen heraus und
 * wandern damit an die Außengrenzen."
 *
 * Die Liste der Standorte kommt weiterhin aus `main.ts`; sie nennt nur noch
 * die ungefähre Stelle. Auf welcher Mauer der Mast landet, rechnet diese
 * Funktion aus — dieselbe Regel für alle sechs, statt sechs Zahlenpaare, die
 * beim nächsten Platzumbau einzeln nachgezogen werden müssten.
 *
 * Die Einfahrtslücke bleibt frei: Ein Mast mitten im Tor stünde dort, wo der
 * LKW hereinfährt.
 */
export function einmauern(x: number, z: number): [number, number] {
  const hz = YARD_D / 2;
  const abstaende: Array<[number, [number, number]]> = [
    [Math.abs(x - YARD_MIN_X), [YARD_MIN_X, z]],
    [Math.abs(x - YARD_MAX_X), [YARD_MAX_X, z]],
    [Math.abs(z + hz), [x, -hz]],
    [Math.abs(z - hz), [x, hz]],
  ];
  abstaende.sort((a, b) => a[0] - b[0]);
  const [mx, mz] = abstaende[0]![1];
  // Nicht ins Tor: notfalls an dessen Rand ausweichen.
  if (Math.abs(mz - hz) < 0.01 && Math.abs(mx - GATE_X) < TOR_HALB + SOCKEL) {
    const seite = mx < GATE_X ? -1 : 1;
    return [GATE_X + seite * (TOR_HALB + SOCKEL), mz];
  }
  return [mx, mz];
}

/**
 * Flutlichtmasten in der Platzmauer, alle nach innen auf die Arbeitsflächen
 * gerichtet. Sie stecken in der Betonlego-Umrandung und schauen oben heraus,
 * damit auf dem Platz selbst nichts im Weg steht. Zuschalten passiert bei
 * Dämmerung von allein.
 */
export class Floodlights {
  private lights: THREE.SpotLight[] = [];
  private lamps: THREE.Mesh[] = [];
  private lampOn = new THREE.MeshStandardMaterial({
    color: 0xfff0c8,
    emissive: 0xffe9b0,
    emissiveIntensity: 1.4,
  });
  private lampOff = new THREE.MeshStandardMaterial({ color: 0x6e7276, roughness: 0.7 });

  constructor(scene: THREE.Scene, positions: Array<[number, number]>) {
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x5d666c, roughness: 0.8 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x3d4347, roughness: 0.7 });
    const MAST_H = 12;

    // Beton wie die Umrandung, damit der Sockel als Teil der Mauer liest
    const betonMat = new THREE.MeshStandardMaterial({ color: 0x9b9b94, roughness: 0.95 });

    for (const [roh_x, roh_z] of positions) {
      const [x, z] = einmauern(roh_x, roh_z);
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      /*
       * Kein Fundament auf dem Platz mehr, sondern ein Betonklotz IN der
       * Mauerflucht: so breit wie die Steine daneben, ein paar Zentimeter
       * dicker, und genau so hoch wie die Umrandung. Der Mast wächst
       * mittendurch und schaut oben heraus (Ansage 14.09.2026).
       */
      const sockel = new THREE.Mesh(
        new THREE.BoxGeometry(SOCKEL, MAUER_H, SOCKEL),
        betonMat
      );
      sockel.position.y = MAUER_H / 2;
      sockel.castShadow = true;
      sockel.receiveShadow = true;
      group.add(sockel);
      // Kragen aus Stahl, wo der Mast aus dem Beton kommt — daran sieht man,
      // dass er eingelassen und nicht davorgestellt ist.
      const kragen = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.34, 0.22, 8),
        headMat
      );
      kragen.position.y = MAUER_H;
      group.add(kragen);
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.24, MAST_H, 8),
        mastMat
      );
      mast.position.y = MAST_H / 2;
      mast.castShadow = true;
      group.add(mast);

      // Der Kopf neigt sich zur Platzmitte
      const toCenter = Math.atan2(-x, -z);
      const head = new THREE.Group();
      head.position.y = MAST_H;
      head.rotation.y = toCenter;
      group.add(head);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 0.3), headMat);
      bar.position.y = 0.2;
      head.add(bar);

      // Vier Strahler nebeneinander, alle nach innen und unten
      for (const off of [-0.95, -0.32, 0.32, 0.95]) {
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.42, 0.28), this.lampOff);
        lamp.position.set(off, 0.02, 0.16);
        lamp.rotation.x = 0.5;
        head.add(lamp);
        this.lamps.push(lamp);
      }

      // Ein Scheinwerfer je Mast reicht für die Beleuchtung — vier echte
      // Lichtquellen je Mast wären für Mobilgeräte zu teuer
      const spot = new THREE.SpotLight(0xfff2d0, 0, 130, Math.PI / 5.2, 0.45, 1.35);
      spot.position.set(x, MAST_H, z);
      spot.target.position.set(x * 0.12, 0, z * 0.12); // zur Platzmitte hin
      scene.add(spot.target);
      this.lights.push(spot);
      scene.add(spot);
      scene.add(group);
    }
  }

  /** @param daylight 0..1 — unter 0,45 wird zugeschaltet */
  update(daylight: number): void {
    const an = THREE.MathUtils.clamp((0.45 - daylight) / 0.3, 0, 1);
    /*
     * Genug, um zu arbeiten, ohne den Platz auszubrennen — Nacht soll Nacht
     * bleiben.
     *
     * 400 statt 380 seit 14.09.2026: Die Masten stehen seit dem Einmauern
     * 1,5 bis 3,0 m weiter außen. Nachgerechnet über vierzehn Arbeitspunkte
     * (Bagger, Mulden, Halden, Presse, Abkippzone, Verladeplatz) fiel die
     * Helligkeit dadurch auf 95 % — mit 400 sind es wieder 100 %, und kein
     * Punkt wird heller als vorher. Messung: docs/messungen/
     * 2026-09-14_flutlicht.md.
     */
    for (const l of this.lights) l.intensity = an * 400;
    const mat = an > 0.15 ? this.lampOn : this.lampOff;
    for (const lamp of this.lamps) lamp.material = mat;
  }
}
