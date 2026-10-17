/**
 * Die Federung der Anlieferfahrzeuge — zwei Achsen, eine Feder-Dämpfer-Rechnung.
 *
 * Ansage Patrick, 15.09.2026: „Ich hätte gerne, dass LKWs federn, wenn ich
 * ablade. Also sollen nicht hundertprozentig starr sein, die Ladeflächen."
 * Und als Notiz am 14.09.: „federnde LKW beim Abladen, je nach
 * Kraftübertragung durch Bagger/Körper."
 *
 * DER ZWEITE HALBSATZ IST DER GANZE AUFTRAG. Die Feder antwortet auf Kraft.
 * Sie hat keinen eigenen Takt, keine Sinuskurve, kein Grundrauschen: Ändert
 * sich nichts auf der Ladefläche und fährt der Wagen gleichmäßig, dann steht
 * die Feder in ihrer Ruhelage und rührt sich nicht. Ein Wagen, der leer wippt,
 * wäre kein Detail, sondern ein Fehler.
 *
 * WAS SIE ANTREIBT — drei Dinge, alle mit Ursache:
 *
 *   1. Die Last selbst. Jede Masse auf der Fläche drückt die Federn um
 *      F/k herunter. Nimmt der Greifer ein Teil heraus, liegt die neue
 *      Ruhelage höher, und der Wagen schwingt von selbst dorthin. Genau
 *      deshalb braucht es keinen Sonderfall „Teil entnommen".
 *   2. Der Aufschlag. Ein Teil, das mit 2 m/s aufsetzt, überträgt einen
 *      Stoß m·v — das ist die „Kraftübertragung durch Bagger/Körper". Wer
 *      sanft absetzt, bekommt nur die Laständerung; wer fallen lässt, sieht
 *      den Wagen einknicken.
 *   3. Anfahren und Bremsen. Die Längsbeschleunigung verlagert Gewicht
 *      zwischen den Achsen (m·a·h/L): beim Anfahren setzt sich das Heck,
 *      beim Bremsen taucht die Nase. Dort sieht man die Feder am ehesten,
 *      weil sich der ganze Wagen bewegt.
 *
 * WARUM ZWEI ACHSEN UND NICHT EINE FEDER. „Am Heck gibt es mehr nach als über
 * der Achse" ist der Unterschied zwischen „es federt" und „es ist ein LKW".
 * Mit zwei Federn fällt das von selbst heraus: Eine Last verteilt sich nach
 * dem Hebelgesetz auf Vorder- und Hinterachse, und was HINTER der Hinterachse
 * liegt — der Überhang, also gerade das Heck — bekommt einen Hebelanteil über
 * 100 % und hebt die Vorderachse sogar ein Stück an. Die Einfederung an einer
 * beliebigen Längsstelle ist dann nur noch die Gerade durch die beiden
 * Achspunkte, über die Achsen hinaus verlängert.
 *
 * WER SICH BEWEGT. Die gefederte Masse ist alles über den Achsen: Rahmen,
 * Fahrerhaus, Ladefläche und Ladung. Also senkt und neigt sich der ganze
 * Wagen, und die Räder bleiben auf dem Boden stehen (der Aufrufer schiebt sie
 * um genau die Einfederung gegen). Die Ladefläche allein zu bewegen wäre
 * falsch herum gedacht und würde sie außerdem in die Kotflügel drücken — die
 * liegen im Modell nur 9 cm unter dem Flächenboden.
 *
 * Kopflos rechenbar: Diese Datei kennt weder three.js noch Rapier.
 */

/** Erdbeschleunigung (m/s²) — dieselbe wie in der Physikwelt. */
const G = 9.81;

/**
 * Eigenfrequenz der LEEREN Federung in Hz.
 *
 * SW, aber nicht gegriffen: Ein blattgefederter Kipper liegt leer bei 2,5 bis
 * 3 Hz — deshalb ist er leer so hart und beladen so ruhig. Luftgefederte
 * Fernverkehrszüge liegen bei 1,2 bis 1,6 Hz; die kommen hier nicht vor.
 *
 * Die Zahl legt zugleich den FEDERWEG fest, denn die statische Einfederung
 * einer linearen Feder ist g/ω² und hängt nur an der Frequenz:
 *   2,6 Hz → ω = 16,34 1/s → 3,7 cm im Leerzustand.
 * Beladen wächst sie im Verhältnis der Massen. Höher gewählt wippte der Wagen
 * wie ein Gummiball, niedriger sänke die Ladefläche sichtbar in die Kotflügel.
 */
const F_LEER_HZ = 2.6;

/**
 * Dämpfungsgrad im Leerzustand.
 *
 * SW. Die Dämpferkonstante c ist danach FEST — sie hängt nicht an der
 * Beladung, so wie ein echter Stoßdämpfer auch. Daraus folgt von selbst, was
 * jeder kennt: Leer ist der Wagen straff (ζ = 0,55, ein Nicken und Schluss),
 * beladen weicher und länger schwingend (ζ fällt auf rund 0,35, zwei bis drei
 * Schwingungen). „Ein voll beladener Wagen federt weicher als ein leerer" ist
 * damit keine Sonderregel, sondern das Ergebnis.
 */
const ZETA_LEER = 0.55;

/**
 * Anschlag der Federung (m) — so weit und nicht weiter.
 *
 * SW. Darüber setzt ein LKW auf den Gummipuffern auf. Gebraucht wird der
 * Anschlag gegen den Einzelfall, in dem eine Karosse aus drei Metern auf das
 * Heck fällt: Ohne ihn zöge der Stoß die Ladefläche durch den Rahmen.
 */
const FEDERWEG_MAX = 0.11;

/**
 * Höhe des Schwerpunkts über der Achsmitte (m).
 *
 * SW, aus dem Modell abgelesen: Der Flächenboden liegt auf 1,05 m, die Ladung
 * darüber, die Achsen auf 0,48 m. Ein gemeinsamer Schwerpunkt von Rahmen,
 * Haus und Fuhre bei rund 1,15 m über der Achse ist damit knapp gerechnet.
 * Er bestimmt allein, wie stark Anfahren und Bremsen den Wagen nicken lassen.
 */
const SCHWERPUNKT_HOEHE = 1.15;

/**
 * Wie träge das Tempo dem Sollwert folgt (s).
 *
 * Die Fahrzeuge fahren kinematisch: Beim Phasenwechsel springt ihr Tempo in
 * EINEM Bild von 0 auf 4,8 m/s. Genommen, wie es dasteht, wäre das eine
 * Beschleunigung von 288 m/s² — die Feder schlüge sofort an den Anschlag.
 * Deshalb läuft das Tempo durch einen Tiefpass, bevor daraus eine
 * Beschleunigung wird: 0,45 s ist die Zeit, in der ein beladener LKW
 * tatsächlich auf Schritttempo kommt (SW).
 */
const ANFAHR_TAU = 0.45;

/** Deckel auf die Längsbeschleunigung (m/s²) — SW, mehr bringt kein LKW auf. */
const A_MAX = 6;

/**
 * Deckel auf die Aufprallgeschwindigkeit (m/s).
 *
 * SW. Ein Teil, das aus der Spinne fällt, hat nach einem Meter 4,4 m/s. Der
 * Deckel begrenzt nicht das Erlebnis, sondern den Ausreißer: Ein Stück, das
 * die Physik zufällig einmal mit 20 m/s ausspuckt, soll den Wagen nicht in
 * den Anschlag treiben.
 */
const AUFPRALL_MAX = 3.5;

/**
 * Kleinste Achslast, mit der gerechnet wird (Anteil der Gesamtmasse).
 *
 * Liegt die Last weit hinter der Hinterachse, rechnet das Hebelgesetz der
 * Vorderachse eine NEGATIVE Last zu — physikalisch richtig (sie wird
 * entlastet), als träge Masse in ÿ = F/m aber unbrauchbar. Die Kraft bleibt
 * negativ, nur die Masse bekommt einen Boden.
 */
const MIN_ACHSLAST = 0.15;

/** Alles, was die Federung über ihr Fahrzeug wissen muss. */
export interface FederungsDaten {
  /** Gefederte Leermasse (Rahmen, Haus, Aufbau) in kg */
  leerKg: number;
  /** Längslage ihres Schwerpunkts in Fahrzeugachsen (m, +z = Fahrerhaus) */
  leerZ: number;
  /** Längslage der Vorderachse */
  achseVornZ: number;
  /** Längslage der (bei Zwillingsachsen gemittelten) Hinterachse */
  achseHintenZ: number;
}

/** Eine endliche Zahl oder der Ersatzwert — Eingaben werden nie geglaubt. */
function zahl(x: number, ersatz = 0): number {
  return Number.isFinite(x) ? x : ersatz;
}

/**
 * Zwei Achsfedern, ein Wagen.
 *
 * Zustand ist je Achse die Einfederung y (m, positiv = eingefedert) und ihre
 * Geschwindigkeit. Alles Sichtbare wird daraus abgeleitet.
 */
export class Federung {
  private readonly leerKg: number;
  private readonly leerZ: number;
  readonly achseVornZ: number;
  readonly achseHintenZ: number;
  /** Federrate je Achse (N/m) */
  readonly k: number;
  /** Dämpferkonstante je Achse (N·s/m), lastunabhängig wie ein echter Dämpfer */
  readonly c: number;
  /** Einfederung im Leerstand (m) — der Nullpunkt alles Sichtbaren */
  readonly ruhe: number;

  private yV = 0;
  private yH = 0;
  private vV = 0;
  private vH = 0;

  private lastKg = 0;
  private lastZ = 0;
  /** geglättetes Längstempo (m/s) und die daraus gerechnete Beschleunigung */
  private tempoGlatt = 0;
  private laengsA = 0;

  constructor(d: FederungsDaten) {
    this.leerKg = Math.max(1, zahl(d.leerKg, 1000));
    this.achseVornZ = zahl(d.achseVornZ, 2);
    this.achseHintenZ = zahl(d.achseHintenZ, -2);
    // Eine Achse braucht Abstand zur anderen, sonst gibt es keinen Hebel
    if (Math.abs(this.achseVornZ - this.achseHintenZ) < 0.5) {
      this.achseVornZ = this.achseHintenZ + 2;
    }
    this.leerZ = zahl(d.leerZ, (this.achseVornZ + this.achseHintenZ) / 2);
    const omega = 2 * Math.PI * F_LEER_HZ;
    const mAchseLeer = this.leerKg / 2;
    this.k = mAchseLeer * omega * omega;
    this.c = 2 * ZETA_LEER * Math.sqrt(this.k * mAchseLeer);
    this.ruhe = G / (omega * omega);
    this.setzeRuhe();
  }

  /** Radstand (m) — der Hebelarm zwischen den beiden Federn. */
  get radstand(): number {
    return this.achseVornZ - this.achseHintenZ;
  }

  /** Hebelanteil der HINTERACHSE an einer Last bei Längslage z (kann > 1 sein). */
  anteilHinten(z: number): number {
    return (this.achseVornZ - zahl(z, 0)) / this.radstand;
  }

  /**
   * Last auf der Ladefläche setzen: Gewicht und Längsschwerpunkt.
   *
   * Das ist der Normalfall — kein Ereignis, sondern ein Zustand. Jede
   * Änderung verschiebt die Ruhelage, und die Feder läuft ihr nach.
   */
  setzeLast(kg: number, z: number): void {
    this.lastKg = Math.max(0, zahl(kg, 0));
    this.lastZ = zahl(z, this.leerZ);
  }

  /** Was gerade als Last gerechnet wird — für Anzeige und Prüfung. */
  get last(): { kg: number; z: number } {
    return { kg: this.lastKg, z: this.lastZ };
  }

  /**
   * Ein Stoß: Masse kg trifft mit vAb (m/s, positiv = abwärts) bei Längslage z auf.
   *
   * Der Impuls m·v verteilt sich nach demselben Hebel wie eine Last und wird
   * durch die jeweilige Achsmasse zur Geschwindigkeitsänderung. Ein sanft
   * abgesetztes Teil (vAb ≈ 0) gibt nichts — dann bleibt nur die Laständerung.
   */
  stoss(kg: number, vAb: number, z: number): void {
    const m = Math.max(0, zahl(kg, 0));
    const v = Math.min(Math.max(0, zahl(vAb, 0)), AUFPRALL_MAX);
    if (m <= 0 || v <= 0) return;
    const wH = this.anteilHinten(z);
    const wV = 1 - wH;
    const j = m * v;
    this.vH += (j * wH) / this.masseHinten();
    this.vV += (j * wV) / this.masseVorn();
  }

  /**
   * Längstempo melden (m/s, positiv = in Richtung Fahrerhaus).
   *
   * Daraus wird über den Tiefpass die Beschleunigung. Der Aufrufer braucht
   * nichts zu glätten — und soll es auch nicht, sonst glätten zwei.
   */
  meldeTempo(tempo: number, dt: number): void {
    const t = zahl(tempo, 0);
    const d = Math.max(1e-4, zahl(dt, 1 / 60));
    const alt = this.tempoGlatt;
    this.tempoGlatt += (t - alt) * Math.min(1, d / ANFAHR_TAU);
    const a = (this.tempoGlatt - alt) / d;
    this.laengsA = Math.min(Math.max(a, -A_MAX), A_MAX);
  }

  /** Masse über der Hinterachse (kg), mit Boden gegen negative Hebelanteile. */
  private masseHinten(): number {
    const ges = this.leerKg + this.lastKg;
    const roh =
      this.leerKg * this.anteilHinten(this.leerZ) + this.lastKg * this.anteilHinten(this.lastZ);
    return Math.max(ges * MIN_ACHSLAST, roh);
  }

  /** Masse über der Vorderachse (kg). */
  private masseVorn(): number {
    const ges = this.leerKg + this.lastKg;
    const roh =
      this.leerKg * (1 - this.anteilHinten(this.leerZ)) +
      this.lastKg * (1 - this.anteilHinten(this.lastZ));
    return Math.max(ges * MIN_ACHSLAST, roh);
  }

  /**
   * Einen Zeitschritt rechnen.
   *
   * Halbimplizites Euler mit Unterschritten: Bei ω bis 16 1/s wäre ein Bild
   * von 1/30 s schon grenzwertig, und auf dem Telefon kommen auch längere
   * Bilder vor. 8 ms je Unterschritt hält das Verfahren sicher stabil und
   * kostet zwei Multiplikationen mehr.
   */
  schritt(dt: number): void {
    const gesamt = Math.min(Math.max(0, zahl(dt, 0)), 0.25);
    if (gesamt <= 0) return;
    const n = Math.max(1, Math.ceil(gesamt / 0.008));
    const h = gesamt / n;
    const ges = this.leerKg + this.lastKg;
    const wHLeer = this.anteilHinten(this.leerZ);
    const wHLast = this.anteilHinten(this.lastZ);
    // Achslasten in Newton — aus dem Hebelgesetz, ungekappt (vorn darf entlasten)
    const lastH = G * (this.leerKg * wHLeer + this.lastKg * wHLast);
    const lastV = G * (this.leerKg * (1 - wHLeer) + this.lastKg * (1 - wHLast));
    // Dynamische Achslastverlagerung beim Anfahren/Bremsen
    const umlagerung = (ges * this.laengsA * SCHWERPUNKT_HOEHE) / this.radstand;
    const fH = lastH + umlagerung;
    const fV = lastV - umlagerung;
    const mH = this.masseHinten();
    const mV = this.masseVorn();
    for (let i = 0; i < n; i++) {
      const aH = (fH - this.k * this.yH - this.c * this.vH) / mH;
      const aV = (fV - this.k * this.yV - this.c * this.vV) / mV;
      this.vH += aH * h;
      this.vV += aV * h;
      this.yH += this.vH * h;
      this.yV += this.vV * h;
      // Anschläge: dort steht die Feder, die Geschwindigkeit geht verloren
      const gH = this.begrenze(this.yH);
      if (gH !== this.yH) {
        this.yH = gH;
        this.vH = 0;
      }
      const gV = this.begrenze(this.yV);
      if (gV !== this.yV) {
        this.yV = gV;
        this.vV = 0;
      }
    }
    if (!Number.isFinite(this.yH + this.yV + this.vH + this.vV)) this.setzeRuhe();
  }

  private begrenze(y: number): number {
    return Math.min(Math.max(y, this.ruhe - FEDERWEG_MAX), this.ruhe + FEDERWEG_MAX);
  }

  /**
   * In die Ruhelage der aktuellen Last springen, ohne Einschwingen.
   *
   * Gebraucht, wenn ein Wagen ERSCHEINT: Eine volle Fuhre soll am Tor stehen,
   * als wäre sie schon eine Weile geladen, und nicht erst einmal durchsacken.
   */
  setzeRuhe(): void {
    const wHLeer = this.anteilHinten(this.leerZ);
    const wHLast = this.anteilHinten(this.lastZ);
    this.yH = this.begrenze(
      (G * (this.leerKg * wHLeer + this.lastKg * wHLast)) / this.k
    );
    this.yV = this.begrenze(
      (G * (this.leerKg * (1 - wHLeer) + this.lastKg * (1 - wHLast))) / this.k
    );
    this.vH = 0;
    this.vV = 0;
    this.tempoGlatt = 0;
    this.laengsA = 0;
  }

  /**
   * SICHTBARE Einfederung an der Längsstelle z (m, positiv = der Wagen liegt
   * dort tiefer als im Leerstand).
   *
   * Die Gerade durch die beiden Achspunkte, über die Achsen hinaus
   * verlängert — deshalb gibt das Heck mehr nach als die Achse darunter.
   */
  einfederung(z: number): number {
    const t = (zahl(z, 0) - this.achseHintenZ) / this.radstand;
    return this.yH + (this.yV - this.yH) * t - this.ruhe;
  }

  /**
   * Nickwinkel (rad): positiv = Nase tiefer als Heck.
   *
   * Als Steigung gerechnet und nicht als Winkel — bei höchstens 2 Grad ist
   * der Unterschied kleiner als ein Zehntel Millimeter am Wagenende.
   */
  get neigung(): number {
    return (this.yV - this.yH) / this.radstand;
  }

  /** Federgeschwindigkeit am Heck (m/s) — für Prüfungen auf „steht still". */
  get tempoHinten(): number {
    return this.vH;
  }

  /** Steht die Feder? (Schwelle: 1 mm/s, SW — darunter sieht man nichts.) */
  get ruhig(): boolean {
    return Math.abs(this.vH) < 1e-3 && Math.abs(this.vV) < 1e-3;
  }
}

/**
 * Leergewicht der Fahrzeuge, in Kilogramm — was sie wiegen, bevor etwas
 * draufliegt.
 *
 * NICHT aus der Nutzlast gerechnet. Die Nutzlasten im Spiel sind absichtlich
 * kleiner als in Wirklichkeit (`fuellgrad.NUTZLAST`, weil Patrick die
 * Anlieferungen auf 1 bis 10 t festgelegt hat) — der WAGEN wiegt aber, was ein
 * Wagen wiegt. Aus der Nutzlast gerechnet käme ein Dreiachser auf sieben
 * Tonnen leer, und damit federte er unter einer vollen Fuhre bis an den
 * Anschlag.
 *
 *   Dreiachs-Kipper        12,0 t   die schwerste Bauart, die hier vorfährt
 *   Zweiachs-Pritsche       8,0 t
 *   Absetzkipper (Abholer)  9,0 t   Rahmen plus Abrollvorrichtung
 *   Abschleppwagen          7,5 t
 *   PKW-Anhänger            0,9 t   steht schon in `fuellgrad.NUTZLAST` als
 *                                   „rund 0,9 t Leergewicht"
 */
const LEERGEWICHT_KG: Record<string, number> = {
  kipper: 12000,
  pritsche: 8000,
  abholer: 9000,
  wrack: 7500,
  pkw: 900,
  // SW: Dreiachser mit Absetzanlage, ohne Mulde (die leere 7-m³-Mulde wiegt
  // rund 750 kg und liegt auf der Flaeche wie Ladung)
  absetzer: 10500,
};

/**
 * Anteil des Leergewichts, der an den Federn hängt.
 *
 * Achsen, Räder, Bremsen und die halben Federn tragen sich selbst — sie sind
 * UNGEFEDERTE Masse und federn nicht mit. Bei einem LKW sind das rund 20 %
 * des Leergewichts; die Zahl ist Stand der Technik und keine Setzung.
 */
const GEFEDERTER_ANTEIL = 0.8;

/**
 * Gefederte Leermasse und Achslage eines Fahrzeugs.
 *
 * ACHSLAGE. Nicht geschätzt, sondern aus dem Modell abgeschrieben
 * (`vehicleModel.ts`, Feld `achsen`): Vorderachse auf bedLen/2 + 1,1, hinten
 * ein Zwillingspaar auf 0,1 und −bedLen/2 + 0,8, gemittelt auf deren Mitte.
 * Beim PKW-Anhänger ist die „Vorderachse" die Kupplung — sie hält das
 * Deichselgewicht und ist der zweite Auflagepunkt.
 */
export function federungsDatenFuer(kind: string, bedLen: number): FederungsDaten {
  const l = Number.isFinite(bedLen) && bedLen > 0.5 ? bedLen : 5.4;
  const leerKg = GEFEDERTER_ANTEIL * (LEERGEWICHT_KG[kind] ?? LEERGEWICHT_KG.pritsche!);
  if (kind === "pkw") {
    // Anhängerkoordinaten: Kupplung auf z = 0, Ladefläche dahinter (−z).
    // `vehicles.updateTrailer` rechnet mit bedLen/2 + 1,05 von der Kupplung
    // bis zur Achse — dieselbe Zahl steht hier.
    const achse = -(l / 2 + 1.05);
    return { leerKg, leerZ: achse + 0.35, achseVornZ: 0, achseHintenZ: achse };
  }
  const achseVornZ = l / 2 + 1.1;
  const achseHintenZ = (0.1 + (-l / 2 + 0.8)) / 2;
  return {
    leerKg,
    /*
     * Leerschwerpunkt genau zwischen die Achsen: Der Rahmen und die leere
     * Fläche liegen hinten, Motor und Haus vorn. Beides gegeneinander gerechnet
     * ergibt die halbe Last je Achse — so steht ein leerer LKW auch da.
     */
    leerZ: (achseVornZ + achseHintenZ) / 2,
    achseVornZ,
    achseHintenZ,
  };
}
