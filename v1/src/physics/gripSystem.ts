import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { TearTarget } from "../dismantle/composites";
import { SICHELKRALLE, type Greiferform } from "../excavator/greiferform";

/**
 * Greifsystem nach Briefing Kap. 6.2:
 * - Beim Schließen (Schwelle 70 %) einmalige Sensorabfrage (Kugel am Greifer-Palm).
 * - Für jedes getroffene dynamische Objekt: Fixed Joint an den kinematischen Greiferkörper.
 * - Limits: max. 5 Objekte, max. 2000 kg gesamt (Startwerte).
 * - Öffnen löst alle Joints, Objekte fallen mit aktueller Geschwindigkeit weiter.
 * Abrutschen (8 %/s unter Last) kommt in M1 — M0 hält, was gegriffen ist.
 */

/*
 * KEINE Stueckzahlgrenze (E-052, 15.09.2026).
 *
 * Hier stand `MAX_ITEMS`: erst 5, dann kurz 24. Ansage Patrick: „Deckel ganz
 * weg." Was gehalten wird, kommt mit — die einzige Grenze ist die Traglast
 * (`MAX_TOTAL_KG`), und die ist Tragfaehigkeit, keine Auswahl.
 *
 * Der Grund, warum vorher noch ein Notnagel von 24 dastand, war nicht das
 * Spiel, sondern die Sorge vor einem kuenftigen Fehler: Wenn die Greifbedingung
 * einmal kaputtgeht — etwa weil die Sensorkugel zu gross geraet —, haengt die
 * Maschine sonst den halben Platz an. Der Einwand bleibt richtig, die Antwort
 * war falsch: Ein Deckel VERDECKT so einen Fehler (die Maschine nimmt dann 24
 * statt 200 Teile und niemand merkt etwas). Die Antwort ist ein Waechter, der
 * rot wird — `test/greifhaufen.test.ts`, „ein Griff in den gewuerfelten
 * Starthaufen nimmt eine Handvoll": gemessen 2 bis 4 Teile je Griff, 160 bis
 * 250 kg, aus 105 bis 123 echten Teilen. Wenn dort je deutlich mehr haengen,
 * faellt der Test auf und sagt, dass die Bedingung kaputt ist.
 */
const MAX_TOTAL_KG = 3500; // (SW) — eine ganze Karosse muss hochgehen
// Greif-Fenster: solange die Spinne schließt und noch nicht ganz zu ist, wird
// kontinuierlich zugepackt — so lassen sich fallende Objekte auffangen.
const GRAB_WINDOW_START = 0.6;
const GRAB_WINDOW_END = 0.98;
/**
 * Abstand vom Ursprung der Spinne bis zur Sensormitte (m) — der der
 * SICHELKRALLE.
 *
 * Die Zahl kommt seit E-057 von der Form und nicht mehr aus diesem Modul; der
 * Bagger setzt die Kugel aus derselben Quelle. `test/greiffenster.test.ts`
 * misst sie am echten Bagger nach (`getSensorPosition` gegen die
 * Spinnenmitte). Der Export bleibt, weil die Waechter ihn benutzen — er
 * bezeichnet ausdruecklich die Sichelkralle, nicht den gerade angehaengten
 * Greifer.
 */
export const SENSOR_UNTER_SPINNE = SICHELKRALLE.sensorSitz;
/**
 * Radius der Sensorkugel (m) — GERECHNET, nicht gewaehlt.
 *
 * Die Kugel ist nur der Vorfilter: Sie sammelt ein, was danach genau geprueft
 * wird (`insideGrapple`, Krallenkontakte). Sie darf deshalb nichts entscheiden
 * — und genau das tat sie.
 *
 * Befund 15.09.2026 (Messlauf in der echten Rapier-Welt, Bagger kopflos
 * gebaut): Die Kugel hing mit 1,05 m Radius 1,50 m unter der Spinne, reichte
 * also bis 2,55 m Tiefe. Die geschlossenen Schalen reichen aber 2,83 m tief,
 * mit der Luft von `isInsideGrapple` sogar 3,05 m. Die untersten 46 cm des
 * Korbs — genau der Boden, auf dem das Material liegt — waren blind.
 *
 * Dazu kommt die Bewegung: Beim Schliessen haengt die Spinne tiefer als offen
 * (2,44 m offen, bis 3,00 m auf halbem Weg), und der Bodenanschlag hebt den
 * Arm entsprechend an. Gemessen steigt die Spinne beim Zupacken um 0,548 m.
 * Die Unterkante der alten Kugel stand damit im ganzen Greiffenster
 * (Schliessgrad 0,6 bis 0,98) 0,459 m ueber dem Beton. Alles, was flacher als
 * 46 cm auf dem Platz lag, war fuer den Sensor nicht vorhanden — auch dann
 * nicht, wenn alle fuenf Schalen daran anlagen (gemessen: 5 Krallenkontakte
 * bei null Sensortreffern).
 *
 * Die Regel lautet jetzt: Die Kugel reicht so tief, wie die Schalen in
 * IRGENDEINER Stellung reichen. In der Breite bleibt sie Vorfilter wie bisher.
 * Ergibt 2,875 + 0,18 − 1,50 = 1,555 m.
 *
 * Seit E-057 steht die RECHNUNG in `greiferform.ts` (`sensorRadiusVon`) und
 * wird je Form ausgefuehrt — die Regel ist dieselbe geblieben, sie gilt jetzt
 * nur fuer zwei Greifer. Dieser Export ist der Wert der Sichelkralle und
 * bleibt fuer die Waechter stehen; die Spinne selbst liest ihn nicht mehr von
 * hier, sondern von ihrer Form (`GripSystem.form`).
 */
export const SENSOR_RADIUS: number = SICHELKRALLE.sensorRadius;
/** So lange muss die Spinne ganz zu gehalten werden, bis das Teil nachgibt */
const CRUSH_TIME = 1.1;
/**
 * Kein Zusammensaugen (Auftrag 11.09.2026, Phase 1.4).
 *
 * Ein gefasstes Teil wanderte bisher nach dem Zupacken seitlich in den Korb —
 * bis zu 0,35 m. Das sah aus, als sauge die Spinne es an, und genau das soll
 * sie nicht. Es bleibt jetzt dort, wo es gefasst wurde, und faehrt nur mit.
 *
 * Dass trotzdem nichts neben der Spinne haengt, leistet die Pruefung beim
 * Zupacken: Gefasst wird nur, was wirklich zwischen den Schalen liegt
 * (`insideGrapple`). Wer dort nicht hineinragt, wird gar nicht erst gegriffen.
 */
/** Wie viele Schritte in die Loslass-Geschwindigkeit gemittelt werden */
const RELEASE_AVG_STEPS = 3;
/** Zusaetzlicher Abwaertsimpuls beim Loslassen (m/s) */
const RELEASE_DOWN = 0.2;
/**
 * Hoechstens so viele Schalen muessen anliegen, wenn das Teil nicht mittig im
 * Korb sitzt. Wie viele es wirklich sein muessen, haengt an der Groesse des
 * Teils — siehe `noetigeKrallen`.
 */
const MIN_KRALLEN = 2;
/**
 * Abstand zweier benachbarter Schalen bei geschlossener Spinne (m) — GERECHNET.
 *
 * Fuenf Schalen stehen im Kreis; an der Station, die `krallenKontakte`
 * abtastet (60 % der Schalenlaenge), liegen zwei Nachbarn 0,629 m
 * auseinander. Die Zahl kommt aus der Geometrie, nicht aus einer Schaetzung,
 * und wandert mit, wenn jemand die Krallenform aendert.
 *
 * Gerechnet wird sie seit E-057 in `greiferform.ts` (`schalenlueckeVon`), je
 * Form. Dieser Export ist der Wert der Sichelkralle — fuer die Waechter.
 *
 * Wofuer sie gebraucht wird, steht bei `noetigeKrallen`.
 */
export const SCHALENLUECKE: number = SICHELKRALLE.schalenluecke;
/**
 * Wie viele Schalen an einem Teil dieser Groesse anliegen muessen, damit es
 * als gefasst gilt — die Regel als reine Rechnung, damit sie ohne Welt
 * nachzuprüfen ist (`test/greifhaufen.test.ts`). Begruendung bei
 * `GripSystem.noetigeKrallen`.
 */
export function noetigeKrallenFuer(groesseM: number, luecke = SCHALENLUECKE): number {
  return Math.min(MIN_KRALLEN, Math.floor(groesseM / luecke));
}
/** Richtungen, in denen die Groesse eines Teils abgetastet wird */
const TASTRICHTUNGEN: ReadonlyArray<[number, number, number]> = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
/** So weit ausserhalb wird getastet — jedes Schrottteil ist kleiner als das */
const TASTWEITE = 50;

/**
 * Eine Greifstelle: welcher Koerper, wo die Schale ihn fasst und mit welcher
 * Kraft. Das ist die Schnittstelle, an der das Schadensmodell andockt
 * (Auftrag 11.09.2026, Phase 1.6).
 */
export interface GreifKontakt {
  body: RAPIER.RigidBody;
  /** Weltpunkt auf der Oberflaeche des Teils */
  punkt: THREE.Vector3;
  /** Betrag der Greifkraft in Newton */
  kraftN: number;
}

interface GrippedItem {
  body: RAPIER.RigidBody;
  massKg: number;
  /** Pose beim Zupacken, relativ zur Spinne — sie bleibt, siehe oben */
  vonPos: THREE.Vector3;
  vonQuat: THREE.Quaternion;
  /** Wo die Schale das Teil fasst — relativ zur Spinne, also mitfahrend */
  kontaktRel: THREE.Vector3;
}

export class GripSystem {
  private items: GrippedItem[] = [];
  /**
   * Die angehaengte Greiferform (E-057). Von ihr kommen Sensorradius und
   * Schalenluecke; alles andere am Greifsystem ist formunabhaengig.
   *
   * Vorgabe ist die Sichelkralle. Wer den Greifer wechselt, setzt sie ueber
   * `setForm` — die Sensorkugel wird dabei neu angelegt, denn eine
   * `RAPIER.Ball` laesst ihren Radius nicht nachtraeglich aendern.
   */
  private form: Greiferform = SICHELKRALLE;
  private sensorShape = new RAPIER.Ball(SICHELKRALLE.sensorRadius);

  /** Greiferform wechseln — Sensorkugel und Schalenluecke wandern mit. */
  setForm(form: Greiferform): void {
    this.form = form;
    this.sensorShape = new RAPIER.Ball(form.sensorRadius);
  }

  /** Welche Form gerade haengt. */
  get greiferform(): Greiferform {
    return this.form;
  }
  /**
   * Wie viel Gewalt gerade auf die gefasste Baugruppe wirkt: 0 = ruhig
   * halten, 1 = kräftig drehen und reißen. Von main aus Rotator- und
   * Achsbewegung gebildet.
   */
  getViolence: (() => number) | null = null;

  /** Traglast-Faktor aus dem Baggerausbau — von main gesetzt */
  getCapacityBonus: (() => number) | null = null;

  /** Hooks für Events (Audio/HUD) — von main verdrahtet, kein Modul-Import nötig */
  onGrabbed: ((bodies: RAPIER.RigidBody[]) => void) | null = null;
  onReleased: ((count: number) => void) | null = null;
  onTear: ((name: string) => void) | null = null;
  /** liefert eine abreißbare Baugruppe nahe des Sensors (Verbundobjekte, Kap. 8) */
  partResolver: ((pos: THREE.Vector3) => TearTarget | null) | null = null;
  /**
   * Prüft, ob ein Weltpunkt im Schalenkorb der Spinne liegt. Ohne diese Prüfung
   * würde alles im Sensorradius angehoben, auch was neben dem Greifer liegt.
   */
  insideGrapple: ((worldPos: THREE.Vector3) => boolean) | null = null;
  /**
   * Wie viele Schalen liegen an diesem Koerper an? Gefasst wird nur, was
   * wirklich in der Spinne liegt — entweder mit mehreren Schalen daran oder
   * mit dem Schwerpunkt mitten im Korb (Auftrag 11.09.2026, Phase 1.4).
   */
  krallenKontakte: ((body: RAPIER.RigidBody) => number) | null = null;
  private probe = new THREE.Vector3();
  /** Letzte Weltpositionen der Spinne — daraus die Loslass-Geschwindigkeit */
  private spinneSpur: THREE.Vector3[] = [];
  /** Letzte Weltdrehungen der Spinne — daraus die Winkelgeschwindigkeit */
  private spinneDreh: THREE.Quaternion[] = [];
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();
  private tmpQ2 = new THREE.Quaternion();
  private tmpQ3 = new THREE.Quaternion();
  private tmpOm = new THREE.Vector3();
  /**
   * Schonfrist nach dem Loslassen melden. Der Bagger schaltet dann seine
   * Krallen-Kollider kurz ab — beim Oeffnen sind sie noch fast zu und die
   * Spinne sinkt noch, sonst quetschen sie das Teil gegen den Boden und es
   * schiesst weg (v2 E-018: "Teile fliegen umher").
   */
  onReleaseGrace: (() => void) | null = null;
  private tearState: { id: string; name: string; seconds: number; progress: number } | null = null;

  constructor(
    private world: RAPIER.World,
    private grappleBody: RAPIER.RigidBody
  ) {}

  get grippedCount(): number {
    return this.items.length;
  }

  get totalMassKg(): number {
    return this.items.reduce((s, i) => s + i.massKg, 0);
  }

  get grippedBodies(): RAPIER.RigidBody[] {
    return this.items.map((i) => i.body);
  }

  /**
   * Die gehaltenen Teile mit ihrer Pose relativ zur Spinne (E-145). Daraus
   * rechnet der Bagger, wo ein Teil nach seiner Bewegung stuende, und nimmt
   * die Bewegung zurueck, wenn es dort tiefer in einer Wand steckte. Nur
   * lesen — die Pose bleibt, wie sie beim Zupacken war.
   */
  get gehalten(): ReadonlyArray<Readonly<Pick<GrippedItem, "body" | "vonPos" | "vonQuat">>> {
    return this.items;
  }

  /**
   * Pro Physik-Step aufrufen.
   * @param closure aktueller Schließgrad 0..1
   * @param closing true solange der Spieler die Greif-Taste hält
   * @param sensorPos Weltposition des Sensor-Zentrums (zwischen den Fingern)
   */
  /** Aktueller Reiß-Fortschritt (fürs HUD), null wenn nicht am Reißen. */
  get tearing(): { name: string; progress01: number } | null {
    if (!this.tearState) return null;
    return {
      name: this.tearState.name,
      progress01: Math.min(this.tearState.progress / this.tearState.seconds, 1),
    };
  }

  /**
   * Zusammendrücken: Hält der Spieler die Spinne ganz zu, quetscht sie, was
   * sie gefasst hat. Der Aufrufer entscheidet über `crusher`, welche Teile
   * nachgeben — Stahlträger tun das nicht.
   */
  crusher: ((body: RAPIER.RigidBody) => boolean) | null = null;
  private crushT = 0;

  private updateCrush(closure: number, dt: number): void {
    if (!this.crusher || this.items.length === 0 || closure < 0.93) {
      this.crushT = 0;
      return;
    }
    this.crushT += dt;
    if (this.crushT < CRUSH_TIME) return;
    this.crushT = 0;
    for (const it of this.items) {
      if (it.body.isValid()) this.crusher(it.body);
    }
  }

  update(closure: number, closing: boolean, sensorPos: THREE.Vector3, dt: number): void {
    this.closureJetzt = closure;
    this.trackGrapple(dt);
    this.carryHeld();
    this.updateCrush(closure, dt);
    if (!closing) {
      // Loslassen wirft sofort ab — und die Spinne ist direkt wieder scharf
      // (schnelles Auf/Zu zum Auffangen und Umsortieren im Fallen).
      if (this.items.length > 0) this.releaseAll();
      this.tearState = null;
      return;
    }

    // Reiß-Mechanik: Baugruppe nahe des Sensors? Dann Part statt Rumpf fassen.
    if (closure >= GRAB_WINDOW_START && this.items.length === 0) {
      const target = this.partResolver?.(sensorPos) ?? null;
      if (target) {
        if (!this.tearState || this.tearState.id !== target.id) {
          this.tearState = {
            id: target.id,
            name: target.name,
            seconds: target.tearSeconds,
            progress: 0,
          };
        }
        const d = sensorPos.distanceTo(target.anchorWorld);
        if (d < 2.5) {
          // Gefasst halten löst die Baugruppe. Wer dabei Gewalt anwendet —
          // die Spinne dreht oder mit dem Arm reißt —, ist deutlich
          // schneller: So reißt man einen Motor in Wirklichkeit heraus,
          // nicht durch geduldiges Ziehen (Wunsch 02.09.2026).
          const gewalt = this.getViolence?.() ?? 0;
          this.tearState.progress += dt * (1 + gewalt * 2.5);
          if (this.tearState.progress >= this.tearState.seconds) {
            const body = target.tear();
            this.attachBody(body);
            this.onTear?.(target.name);
            this.tearState = null;
          }
          return; // solange die Part gefasst ist, nicht zusätzlich den Rumpf greifen
        }
        this.tearState = null;
      } else {
        this.tearState = null;
      }
    }

    if (closure >= GRAB_WINDOW_START && closure <= GRAB_WINDOW_END) {
      this.tryGrab(sensorPos);
    }
  }

  /**
   * Wie viele Koerper beim letzten Zupacken die Bedingung erfuellt haben —
   * unabhaengig davon, wie viele davon Platz fanden.
   *
   * Steht hier, weil die Frage „ist der Deckel der Engpass?" sonst nur zu
   * schaetzen waere: Ein Waechter kann die Zahl abfragen, statt die Bedingung
   * im Test nachzubauen (Auftrag 15.09.2026).
   */
  private letzteKandidatenZahl = 0;
  get letzteKandidaten(): number {
    return this.letzteKandidatenZahl;
  }

  private tryGrab(sensorPos: THREE.Vector3): void {
    // Liegt eine abreißbare Baugruppe im Greifbereich, hat sie Vorrang: Wer
    // einen Motor herausreißen will, soll nicht stattdessen das Blech davor
    // fassen, das dann alles Weitere blockiert (Design-Fix 02.09.2026).
    if (this.partResolver?.(sensorPos)) return;
    /**
     * Kandidat mit Haltwert: wie sicher die Spinne ihn hat.
     *
     * 2 = der Schwerpunkt liegt im Korb, das Teil liegt also wirklich drin.
     * 1 = es ist zwischen den Schalen gefasst oder verkantet, haengt aber mit
     * der Masse ausserhalb. Feinunterschied: wie weit der naechste Punkt
     * seiner Oberflaeche von der Sensormitte entfernt ist.
     *
     * Beides faellt im Durchlauf unten ohnehin an — die Ordnung kostet keine
     * einzige zusaetzliche Abfrage.
     */
    const candidates: Array<{ body: RAPIER.RigidBody; halt: number }> = [];
    this.world.intersectionsWithShape(
      { x: sensorPos.x, y: sensorPos.y, z: sensorPos.z },
      { x: 0, y: 0, z: 0, w: 1 },
      this.sensorShape,
      (collider) => {
        const body = collider.parent();
        if (body && body.isDynamic() && !candidates.some((k) => k.body.handle === body.handle)) {
          /** Abstand des naechsten Oberflaechenpunkts zur Sensormitte (m) */
          let abstand = this.form.sensorRadius;
          // Nur fassen, was wirklich zwischen den Schalen liegt. Geprüft wird
          // der nächstgelegene Punkt der Oberfläche, nicht der Schwerpunkt:
          // bei einem Auto liegt der in der Fahrzeugmitte und damit nie im
          // Schalenkorb — Karossen waren deshalb kaum zu fassen.
          if (this.insideGrapple) {
            const proj = collider.projectPoint(
              { x: sensorPos.x, y: sensorPos.y, z: sensorPos.z },
              true
            );
            if (!proj) return true;
            this.probe.set(proj.point.x, proj.point.y, proj.point.z);
            if (!this.insideGrapple(this.probe)) return true;
            abstand = this.probe.distanceTo(sensorPos);
          }
          /** wie sicher die Spinne das Teil hat — siehe oben */
          let halt = 1 - Math.min(abstand / this.form.sensorRadius, 1) * 0.5;
          /*
           * Kontaktbedingung: Eine Kiste, die mit einer Ecke in den Korb
           * ragt, bestand die Pruefung oben — und hing dann halb neben der
           * Spinne in der Luft. Es braucht deshalb entweder anliegende
           * Schalen oder den Schwerpunkt mitten im Korb.
           *
           * Wie viele Schalen, haengt an der Groesse des Teils
           * (`noetigeKrallen`) — feste zwei waren fuer Kleinteile
           * unerfuellbar.
           */
          if (this.krallenKontakte) {
            const mitte = body.translation();
            const mittig =
              this.insideGrapple?.(this.probe.set(mitte.x, mitte.y, mitte.z)) ?? false;
            const noetig = mittig ? 0 : this.noetigeKrallen(body);
            if (noetig > 0 && this.krallenKontakte(body) < noetig) return true;
            if (mittig) halt += 1;
          }
          candidates.push({ body, halt });
        }
        return true; // weitersuchen
      }
    );

    /*
     * NICHT nach Gewicht (E-045, Ansage Patrick 15.09.2026: „Worauf du zielst,
     * das bekommst du … Nicht nach Gewicht gehen.").
     *
     * Hier stand `candidates.sort((a, b) => b.mass() - a.mass())` mit der
     * Begruendung „wer in einen Haufen greift, bekommt das grosse Teil
     * sicher". Zusammen mit dem Deckel von fuenf Stueck hiess das: Das
     * anvisierte Kleinteil lag im Korb, erfuellte die Bedingung — und wurde
     * von schwereren Nachbarn verdraengt (gemessen 0 von 5).
     *
     * Sortiert wird jetzt danach, wie sicher das Teil gehalten wird. Das
     * entscheidet nichts mehr darueber, WAS mitkommt (es kommt alles mit),
     * sondern nur noch, wen die Traglastgrenze abschneidet, wenn sie greift:
     * Dann bleibt liegen, was ohnehin am lockersten sass.
     */
    candidates.sort((a, b) => b.halt - a.halt);

    this.letzteKandidatenZahl = candidates.length;
    let added = 0;
    for (const { body } of candidates) {
      if (this.attachBody(body)) added++;
    }
    if (added > 0) this.onGrabbed?.(this.grippedBodies);
  }

  /**
   * Groesster Durchmesser eines Teils (m).
   *
   * Rapier gibt keine Huellbox her, also wird sie getastet: Ein Punkt weit
   * ausserhalb, auf jede der sechs Achsenrichtungen gelegt, und dann gefragt,
   * welcher Punkt der Oberflaeche ihm am naechsten liegt — das ist der
   * aeusserste Punkt in dieser Richtung. Mehrteilige Kollider (Formen mit
   * Taille) zaehlen alle mit, sonst waere ein zweiteiliges Teil nur halb so
   * gross.
   *
   * Im Zweifel zu gross statt zu klein: Gemessen wird vom Schwerpunkt aus und
   * verdoppelt. Das ist Absicht — die Groesse lockert unten eine Pruefung, und
   * eine Lockerung soll eher zu selten als zu oft greifen.
   */
  private groesseVon(body: RAPIER.RigidBody): number {
    const c = body.translation();
    let gross = 0;
    for (let i = 0; i < body.numColliders(); i++) {
      const col = body.collider(i);
      if (!col) continue;
      for (const [dx, dy, dz] of TASTRICHTUNGEN) {
        const pr = col.projectPoint(
          {
            x: c.x + dx * TASTWEITE,
            y: c.y + dy * TASTWEITE,
            z: c.z + dz * TASTWEITE,
          },
          true
        );
        if (!pr) continue;
        gross = Math.max(
          gross,
          2 * Math.hypot(pr.point.x - c.x, pr.point.y - c.y, pr.point.z - c.z)
        );
      }
    }
    return gross;
  }

  /**
   * Wie viele Schalen an einem Teil anliegen muessen, damit es als gefasst
   * gilt — abhaengig von seiner Groesse (Befund 15.09.2026).
   *
   * Warum ueberhaupt abhaengig: Fuenf Schalen stehen im Kreis. Zwischen zwei
   * benachbarten ist selbst bei geschlossener Spinne eine Luecke von
   * `SCHALENLUECKE` = 0,63 m, und im Greiffenster (Schliessgrad 0,6 bis 0,98)
   * sind es bis zu 1,30 m. Ein Teil, das kleiner ist als diese Luecke, kann
   * zwei Schalen gar nicht beruehren — von ihm zwei Kontakte zu verlangen ist
   * eine Bedingung, die es nie erfuellen kann.
   *
   * Nachgemessen im Haufen (15.09.2026, 63 Griffe, drei Zufallssaaten): Ueber
   * das ganze Greiffenster meldet `krallenKontakte` fuer Teile bis 0,40 m
   * hoechstens 0, 1 oder 2 Kontakte — meist 0. Das Abtasten aller neun
   * Stationen statt zweier aendert daran nichts (gemessen: dieselben Zahlen,
   * nur der Betonblock steigt von 3 auf 5); die Schalen liegen in diesem
   * Moment schlicht noch nicht an. Die Bedingung fiel deshalb in der Praxis
   * immer auf die Ausnahme „Schwerpunkt mittig" zurueck, und wo die nicht
   * griff — am Korbrand —, blieb das Teil liegen, obwohl es nachweislich
   * zwischen den Schalen lag (gemessen: 61 Bilder „im Korb und trotzdem
   * abgelehnt").
   *
   * Die Regel: je angefangener Schalenluecke, die das Teil ueberspannt, eine
   * Schale mehr, gedeckelt auf `MIN_KRALLEN`. Unter 0,63 m also keine — dann
   * entscheidet allein, ob das Teil im Korb liegt (`insideGrapple`). Ab
   * 1,26 m bleibt es bei zwei, und damit bleibt die Kiste, die nur mit einer
   * Ecke hineinragt, draussen — der Fehler vom 11.09.2026, den diese
   * Bedingung repariert hat.
   */
  private noetigeKrallen(body: RAPIER.RigidBody): number {
    return noetigeKrallenFuer(this.groesseVon(body), this.form.schalenluecke);
  }

  /*
   * --- Schnittstelle fuers Schadensmodell (Auftrag 11.09.2026, Phase 1.6) ---
   *
   * Die Spinne meldet, WO sie zupackt und WIE FEST. Mehr braucht ein
   * Schadensmodell nicht, um an derselben Stelle eine Beule einzudruecken,
   * an der die Schale sitzt — und nicht irgendwo in der Mitte des Teils.
   *
   * Die Kraft ist keine gemessene Kontaktkraft (die liefert Rapier fuer
   * kinematische Koerper nicht brauchbar), sondern ein Modell aus drei
   * Groessen, die im Spiel sichtbar sind: Schliessdruck der Schalen, Gewicht
   * am Haken und Gewalt beim Drehen und Reissen. Die Zahl ist damit
   * nachvollziehbar und stabil — und sie steigt genau dann, wenn es im Bild
   * auch ruppig zugeht.
   */
  /** Greifkraft der Schalen bei voll geschlossener Spinne (N) */
  private static readonly SCHLIESSKRAFT_N = 160_000;
  /** Anteil, den das Gewicht der Last beitraegt */
  private static readonly LASTANTEIL = 1.6;
  /** Zuschlag bei voller Gewalt (Drehen, Reissen) */
  private static readonly GEWALT_ZUSCHLAG = 0.8;

  /** Wird beim Zupacken gerufen: einmal je gefasstem Koerper. */
  onKontakt: ((k: GreifKontakt) => void) | null = null;

  /** Aktueller Schliessgrad, von update() gesetzt — geht in die Kraft ein. */
  private closureJetzt = 0;

  /**
   * Greifstellen mit Kraft, je Schritt aktuell. Das Schadensmodell liest sie
   * einfach aus; wer lieber auf das Ereignis hoert, nimmt `onKontakt`.
   */
  get kontakte(): GreifKontakt[] {
    const gewalt = this.getViolence?.() ?? 0;
    const anteil = this.items.length > 0 ? 1 / this.items.length : 1;
    const gPos = this.grappleBody.translation();
    const gRot = this.grappleBody.rotation();
    const gQuat = new THREE.Quaternion(gRot.x, gRot.y, gRot.z, gRot.w);
    const out: GreifKontakt[] = [];
    for (const it of this.items) {
      if (!it.body.isValid()) continue;
      const punkt = it.kontaktRel
        .clone()
        .applyQuaternion(gQuat)
        .add(new THREE.Vector3(gPos.x, gPos.y, gPos.z));
      out.push({
        body: it.body,
        punkt,
        kraftN: this.kraftFuer(it.massKg, gewalt, anteil),
      });
    }
    return out;
  }

  private kraftFuer(massKg: number, gewalt: number, anteil: number): number {
    const schalen = GripSystem.SCHLIESSKRAFT_N * this.closureJetzt * anteil;
    const last = massKg * 9.81 * GripSystem.LASTANTEIL;
    return (schalen + last) * (1 + gewalt * GripSystem.GEWALT_ZUSCHLAG);
  }

  private meldeKontakt(body: RAPIER.RigidBody, punkt: THREE.Vector3): void {
    if (!this.onKontakt) return;
    const gewalt = this.getViolence?.() ?? 0;
    this.onKontakt({
      body,
      punkt: punkt.clone(),
      kraftN: this.kraftFuer(body.mass(), gewalt, 1),
    });
  }

  /** Körper per Fixed Joint an den Greifer koppeln (auch von der Reiß-Mechanik genutzt). */
  attachBody(body: RAPIER.RigidBody): boolean {
    // Keine Stueckzahlgrenze mehr (E-052). Was gehalten wird, kommt mit; die
    // einzige Grenze ist die Traglast.
    if (this.items.some((it) => it.body.handle === body.handle)) return false; // schon gegriffen
    if (this.totalMassKg + body.mass() > MAX_TOTAL_KG * (this.getCapacityBonus?.() ?? 1))
      return false;

    const gPos = this.grappleBody.translation();
    const gRot = this.grappleBody.rotation();
    const gQuat = new THREE.Quaternion(gRot.x, gRot.y, gRot.z, gRot.w);
    const gQuatInv = gQuat.clone().invert();

    // Pose des Teils relativ zur Spinne im Moment des Zupackens
    const p = body.translation();
    const r = body.rotation();
    const vonPos = new THREE.Vector3(p.x - gPos.x, p.y - gPos.y, p.z - gPos.z).applyQuaternion(
      gQuatInv
    );
    const vonQuat = gQuatInv.clone().multiply(new THREE.Quaternion(r.x, r.y, r.z, r.w));

    // Kinematisch statt per Gelenk (Vorbild v2, Entscheidung M2-1). Gelenke
    // zappeln unter Last, explodieren bei Kollisionen und lassen sich nicht in
    // eine Pose fuehren.
    body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, false);
    body.setAngvel({ x: 0, y: 0, z: 0 }, false);
    body.wakeUp();
    // Greifstelle: der Punkt der Oberflaeche, der der Spinnenmitte am
    // naechsten liegt. Den meldet die Schnittstelle ans Schadensmodell
    // weiter (Phase 1.6) — dort wird die Beule eingedrueckt, nicht
    // irgendwo in der Mitte des Teils.
    const kontakt = new THREE.Vector3(gPos.x, gPos.y, gPos.z);
    const col = body.collider(0);
    if (col) {
      const proj = col.projectPoint({ x: gPos.x, y: gPos.y, z: gPos.z }, true);
      if (proj) kontakt.set(proj.point.x, proj.point.y, proj.point.z);
    }
    // relativ zur Spinne merken, damit die Greifstelle mitfaehrt
    const kontaktRel = kontakt
      .clone()
      .sub(new THREE.Vector3(gPos.x, gPos.y, gPos.z))
      .applyQuaternion(gQuatInv);
    this.items.push({ body, massKg: body.mass(), vonPos, vonQuat, kontaktRel });
    this.meldeKontakt(body, kontakt);
    return true;
  }

  /**
   * Gefasste Teile der Spinne nachfuehren. Je Schritt aufrufen, nachdem die
   * Spinne ihre neue Pose hat.
   */
  private carryHeld(): void {
    if (this.items.length === 0) return;
    const gPos = this.grappleBody.translation();
    const gRot = this.grappleBody.rotation();
    this.tmpQ.set(gRot.x, gRot.y, gRot.z, gRot.w);
    for (const it of this.items) {
      if (!it.body.isValid()) continue;
      // Pose halten, nicht verschieben: Das Teil haengt da, wo es gefasst wurde
      this.tmpA.copy(it.vonPos);
      this.tmpQ2.copy(it.vonQuat);
      this.tmpA.applyQuaternion(this.tmpQ);
      it.body.setNextKinematicTranslation({
        x: gPos.x + this.tmpA.x,
        y: gPos.y + this.tmpA.y,
        z: gPos.z + this.tmpA.z,
      });
      this.tmpQ2.premultiply(this.tmpQ);
      it.body.setNextKinematicRotation({
        x: this.tmpQ2.x,
        y: this.tmpQ2.y,
        z: this.tmpQ2.z,
        w: this.tmpQ2.w,
      });
    }
  }

  /** Spur der Spinne mitschreiben — daraus kommt die Loslass-Geschwindigkeit. */
  private trackGrapple(dt: number): void {
    const t = this.grappleBody.translation();
    this.spinneSpur.push(new THREE.Vector3(t.x, t.y, t.z));
    const r = this.grappleBody.rotation();
    this.spinneDreh.push(new THREE.Quaternion(r.x, r.y, r.z, r.w));
    if (this.spinneSpur.length > RELEASE_AVG_STEPS + 1) {
      this.spinneSpur.shift();
      this.spinneDreh.shift();
    }
    this.spinneDt = dt;
  }

  private spinneDt = 1 / 60;

  /**
   * Mittlere Geschwindigkeit der Spinne ueber die letzten Schritte. Ein
   * einzelner Schritt schwankt zu stark — wer schwungvoll abwirft, soll den
   * Schwung mitgeben, aber kein Zittern.
   */
  private grappleVelocity(out: THREE.Vector3): THREE.Vector3 {
    const n = this.spinneSpur.length;
    if (n < 2 || this.spinneDt <= 0) return out.set(0, 0, 0);
    return out
      .copy(this.spinneSpur[n - 1]!)
      .sub(this.spinneSpur[0]!)
      .divideScalar((n - 1) * this.spinneDt);
  }

  /**
   * Winkelgeschwindigkeit der Spinne, aus derselben Spur wie `grappleVelocity`
   * und mit derselben Fensterbreite.
   *
   * Sie enthaelt ALLES, was den Korb dreht: den Oberwagenschwenk, den Rotator
   * und das Pendel. Darum braucht es keine drei Rechnungen — die Drehung des
   * Greiferkoerpers ist die Summe.
   */
  private grappleAngvel(out: THREE.Vector3): THREE.Vector3 {
    const n = this.spinneDreh.length;
    if (n < 2 || this.spinneDt <= 0) return out.set(0, 0, 0);
    // Restdrehung vom aeltesten zum neuesten Bild
    const q = this.tmpQ3.copy(this.spinneDreh[0]!).invert().premultiply(this.spinneDreh[n - 1]!);
    // kuerzester Weg: q und -q sind dieselbe Drehung
    if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
    const sin = Math.sqrt(Math.max(0, 1 - q.w * q.w));
    if (sin < 1e-7) return out.set(0, 0, 0);
    const rate = (2 * Math.acos(THREE.MathUtils.clamp(q.w, -1, 1))) / ((n - 1) * this.spinneDt);
    return out.set(q.x / sin, q.y / sin, q.z / sin).multiplyScalar(rate);
  }

  releaseAll(): void {
    const count = this.items.length;
    const v = this.grappleVelocity(this.tmpB);
    const om = this.grappleAngvel(this.tmpOm);
    const g = this.grappleBody.translation();
    for (const item of this.items) {
      if (!item.body.isValid()) continue;
      const p = item.body.translation();
      /*
       * JEDES TEIL BEKOMMT SEINE EIGENE GESCHWINDIGKEIT (E-115, 22.09.2026).
       *
       * Vorher bekamen alle Teile die Bahngeschwindigkeit des KARDANGELENKS.
       * Das ist der falsche Punkt und fuer alle derselbe: Der Korb haengt
       * 1,5 m tiefer und im Ausschlag weiter aussen, und was aussen im Korb
       * liegt, laeuft auf einem groesseren Radius als was innen liegt.
       * Gemessen (`tools/wurf.ts`, 22.09.2026): im Dauerschwenk fehlten dem
       * Korb 2,3 %, im Rueckschwung des Pendels 18 %; drei radial versetzte
       * Teile flogen mit exakt derselben Zahl los.
       *
       * Richtig ist der Starrkoerpersatz:  v = v_Gelenk + ω × r.
       * `r` ist der Hebel vom Gelenk zum jeweiligen Teil. Damit fliegt, was
       * aussen liegt, schneller — und das ist das "durch Schwung
       * geschleudert", das hier gebaut werden sollte.
       *
       * Eine Obergrenze steht hier NICHT: Beide Groessen kommen aus der
       * gemessenen Bewegung der Maschine, mehr als ihre eigene
       * Umfangsgeschwindigkeit kann dabei nicht herauskommen
       * (`test/wurfweite.test.ts` bewacht das). Das Netz gegen Zahlenunfaelle
       * bleibt `clampSpeeds` (28 m/s).
       */
      const rx = p.x - g.x;
      const ry = p.y - g.y;
      const rz = p.z - g.z;
      const vx = v.x + (om.y * rz - om.z * ry);
      const vy = v.y + (om.z * rx - om.x * rz);
      const vz = v.z + (om.x * ry - om.y * rx);
      item.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      /*
       * WURF ODER ABSETZEN — zwei Faelle, nicht eine Zahl.
       *
       * `RELEASE_DOWN` gab es, damit ein abgesetztes Teil nicht in der Luft
       * stehen bleibt. Beim Wurf richtet derselbe Zuschlag Schaden an: Er
       * zieht das Teil nach unten, statt es seitlich fliegen zu lassen, und
       * `setAngvel(0)` nimmt ihm auch noch den Drall — ein geschleudertes
       * Teil hoert dann mitten im Flug auf zu rotieren.
       *
       * Die Schwelle ist `RELEASE_DOWN` selbst: Wer sich langsamer bewegt als
       * der Zuschlag gross ist, setzt ab; wer schneller ist, wirft. Damit
       * kommt keine neue Zahl ins Spiel.
       */
      if (Math.hypot(vx, vz) > RELEASE_DOWN) {
        item.body.setLinvel({ x: vx, y: vy, z: vz }, true);
        item.body.setAngvel({ x: om.x, y: om.y, z: om.z }, true);
      } else {
        item.body.setLinvel({ x: vx, y: vy - RELEASE_DOWN, z: vz }, true);
        item.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
      item.body.wakeUp();
    }
    this.items = [];
    if (count > 0) {
      this.onReleased?.(count);
      this.onReleaseGrace?.();
    }
  }
}
