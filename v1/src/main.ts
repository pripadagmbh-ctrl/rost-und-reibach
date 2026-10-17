import * as THREE from "three";
import { Input } from "./core/input";
import { TouchControls } from "./core/touch";
import { DebugOverlay } from "./core/debugOverlay";
import { AimRing } from "./excavator/aimRing";
import { EventBus } from "./core/events";
import { initPhysics, PhysicsWorld } from "./physics/physicsWorld";
import { GripSystem } from "./physics/gripSystem";
import { Excavator } from "./excavator/excavator";
import {
  formZu,
  knopfstand,
  setzeGreifer,
  wechsleGreifer,
  STANDARD_GREIFER,
} from "./excavator/greiferwahl";
import { SICHELKRALLE } from "./excavator/greiferform";
import { OrbitCamera } from "./excavator/orbitCamera";
import { Yard } from "./world/yard";
import { ItemManager, type ScrapItem } from "./world/scrapItems";
import { ContainerManager, type AmpelState } from "./world/containers";
import { ContainerAbholung } from "./delivery/platzinventarAbholung";
import { AudioManager } from "./audio/audioManager";
import { Hud, type Zahlungslage } from "./ui/hud";
import { Particles } from "./world/particles";
import { CompositeManager, type WrackArt } from "./dismantle/composites";
import { FenceManager } from "./world/fence";
import { VehicleManager } from "./delivery/vehicles";
import { PressManager } from "./world/press";
import { randomCargo } from "./world/scrapItems";
import { Shift } from "./economy/shift";
import { installAbrechnung } from "./ui/abrechnung";
import { Tutorial } from "./ui/tutorial";
import { installRadio, radioWeiter } from "./ui/radio";
import { installTonregler } from "./ui/tonregler";
import { Funkzentrale } from "./ui/funk";
import { Reputation } from "./economy/reputation";
import { UPGRADES, UpgradeState, type UpgradeId } from "./economy/upgrades";
import { haggle, leavesOnRefusal, hint, OFFER_FACTOR, OFFER_LABEL, type Offer } from "./economy/haggle";
import { LaneWatch } from "./delivery/laneWatch";
import { Daylight, Floodlights } from "./world/daylight";
import { hitsObstacle, setBuildingObstacles } from "./world/obstacles";
import { START_HAUFEN, START_AUTOS, START_STREU, START_LKW } from "./world/startplatz";
import { lastAufschlagWucht } from "./audio/klangregeln";
import { findeBox } from "./world/boxen";
import { OfficeBuilding, BUERO_TUER } from "./world/office";
import { Police } from "./world/police";
import {
  type AxisId,
  type ControlFunction,
  FUNCTION_LABELS,
  defaultConfig,
  saveConfig,
} from "./core/controlConfig";
import { Account, PURCHASE_PRICE_PER_KG } from "./economy/account";
import { getMaterial, ABFALL } from "./materials/catalog";
import { StaffManager } from "./world/people";
import { WEIGH_X, WEIGH_Z, KAFFEE_POS } from "./world/yard";
import { setBaggerOrt, ANSTEH_START_ANZAHL } from "./delivery/routes";
import { clearSave, merkeChallenge, readSave, speichereGreifer, storeSave, type SaveData } from "./core/save";
import { Zwischenbild } from "./core/zwischenbild";
import { BETRIEB, NUR_IM_BETRIEB, NUR_IM_SANDKASTEN, NUR_IM_SIMULATOR } from "./core/spielart";
import { waehleSpielart, type Spielwahl } from "./ui/hauptmenue";
import { challengeNach } from "./challenges/katalog";
import { ChallengeLauf } from "./challenges/challenge";
import { installChallengeKarte } from "./ui/challengekarte";
import { Fahrkunst } from "./skills/fahrkunst";
import { NACHSCHUB_FOLGE, nachschubMeldung, profilFuer } from "./delivery/nachschub";

const FIXED_DT = 1 / 60;
const MAX_STEPS_PER_FRAME = 5; // Spiral-of-death-Schutz
/** Platzhalter, solange das F3-Overlay aus ist und niemand die Zahlen liest. */
const LEERE_ZAEHLUNG = { bodies: 0, awake: 0, dynamic: 0, dynAwake: 0 } as const;
/**
 * So oft je Sekunde wird die Ladung des wartenden Abholers durchgerechnet.
 *
 * Befund 14.09.2026: Der Durchlauf lief in jedem Bild ueber alle Teile des
 * Platzes und baute dabei jedes Mal eine neue Tabelle auf — fuer eine Anzeige,
 * die sich nur aendert, wenn der Spieler etwas in den Container fallen laesst.
 * Viermal je Sekunde ist schneller, als man ablaed.
 */
const LADUNG_TAKT_S = 0.25;
const RECOUNT_INTERVAL = 10; // Container-Zählung alle 10 Steps

async function main(): Promise<void> {
  const physikBereit = initPhysics();
  /*
   * Hauptmenue (E-118). Im Simulator wird erst gewaehlt, dann gebaut — so kann
   * eine Challenge (Etappe 3) ihren eigenen Platz bekommen. Die Physik laedt
   * derweil schon. Im Betrieb gibt es kein Menue, es geht direkt los wie bis
   * E-117.
   *
   * Seit E-125 kann die Wahl eine Challenge sein — und beim allerersten Start
   * faellt sie ohne Menue auf die erste. Eine Challenge ist keine dritte
   * Spielart, sondern eine Wahl im Simulator (Begruendung in core/spielart.ts).
   */
  const wahl: Spielwahl = BETRIEB ? { art: "sandkasten" } : await waehleSpielart();
  const challengeDaten = wahl.art === "challenge" ? challengeNach(wahl.id) : null;
  await physikBereit;
  document.getElementById("loading")!.remove();

  // --- Renderer & Szene ---
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById("app")!.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb8c4cc); // leicht bewölkter Spätvormittag (Kap. 16)
  scene.fog = new THREE.Fog(0xb8c4cc, 60, 140);

  const hemi = new THREE.HemisphereLight(0xdde6ec, 0x6b6257, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
  sun.position.set(18, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -35;
  sun.shadow.camera.right = 35;
  sun.shadow.camera.top = 35;
  sun.shadow.camera.bottom = -35;
  sun.shadow.camera.far = 80;
  scene.add(sun);

  // Tageslauf und Flutlicht: vier Masten in den Ecken der Arbeitsfläche,
  // alle nach innen gerichtet, schalten bei Dämmerung selbst zu
  const daylight = new Daylight(scene, hemi, sun);
  // Masten stehen dicht an der Umrandung, damit die Arbeitsflächen frei
  // bleiben — der Platz misst 80 x 58 m
  /*
   * Der Mast auf (0 | −26) ist weg (Ansage 12.09.2026: „der eine Strahler
   * muss da jetzt weg, weil der ein bisschen im Weg steht") — seit der
   * Betrieb an der hinteren Grenze sitzt, stand er mitten in der Muldenreihe.
   * Die beiden auf x 37 lagen ohnehin weit ausserhalb der Mauer, seit die
   * Ostgrenze auf 10,5 gerueckt ist; sie stehen jetzt innen.
   */
  const floodlights = new Floodlights(scene, [
    [-37, 26],
    [-37, -26],
    [-37, 2],
    [9, 26],
    [9, 8],
    [0, 26],
  ]);

  // --- Spielobjekte ---
  const bus = new EventBus();
  const physics = new PhysicsWorld();
  const input = new Input(renderer.domElement);
  /*
   * Was nur zur anderen Spielart gehoert, kommt aus dem Bild (E-118, Liste in
   * core/spielart.ts). VOR dem Touch-Aufbau: Der Kranz liest seine Eintraege
   * einmal beim Start, darum werden Kranz-Spans entfernt. Alles andere wird
   * nur verborgen — HUD und Pausenmenue greifen es fest.
   */
  /*
   * In einer Challenge (E-125) kommt dazu, was nur ins freie Spiel gehoert
   * (`NUR_IM_SANDKASTEN`). Die Lernkarte `#tutorial` bleibt dort im Bild: Sie
   * zeigt die Schritte der Challenge (`ui/challengekarte.ts`).
   */
  const ausblenden = BETRIEB
    ? NUR_IM_SIMULATOR
    : challengeDaten
      ? [...NUR_IM_BETRIEB.filter((id) => id !== "tutorial"), ...NUR_IM_SANDKASTEN]
      : NUR_IM_BETRIEB;
  for (const id of new Set(ausblenden)) {
    const el = document.getElementById(id)!;
    if (el.closest(".hidden-actions")) el.remove();
    else el.style.setProperty("display", "none", "important");
  }
  const touch = new TouchControls(renderer.domElement, input);
  // Der Platz baut sich selbst; ein Handle brauchen wir nicht mehr, seit die
  // Schrottberge nur noch Kulisse ausserhalb der Mauer sind.
  new Yard(scene, physics.world);
  /*
   * Keine Wegweiser mehr (Ansage 13.09.2026: „wir koennen auch alle Schilder
   * zur Benennung wegmachen. Die einzigen Schilder sind diese kleinen
   * Containerschilder, dass man sieht, die dann auch aufleuchten, wenn ich
   * ueber dem richtigen Container bin.").
   *
   * Uebrig bleibt genau das: die Behaelterschilder aus containers.ts, die
   * beim richtigen Behaelter aufleuchten. Taste M schaltet sie weiter um.
   */
  const items = new ItemManager(scene, physics.world);
  const containers = new ContainerManager(scene, physics.world, bus);
  const composites = new CompositeManager(scene, physics.world, items, bus);
  const account = new Account();

  // Boot: vorhandener Spielstand → Welt aus dem Save; sonst Neues Spiel.
  // Eine Challenge baut ihren eigenen Platz und liest keinen Stand (E-125) —
  // nur die Senderwahl kommt mit, sie gehoert dem Spieler, nicht dem Platz.
  const gespeichert = readSave();
  const save = challengeDaten ? null : gespeichert;
  let fence: FenceManager;
  if (save) {
    account.moneyEur = save.moneyEur;
    fence = new FenceManager(scene, physics.world, items, bus, save.fencesBroken);
    for (const it of save.items) {
      items.spawnScrap(
        it.materialId,
        it.massKg,
        it.shape,
        new THREE.Vector3(it.pos[0], it.pos[1], it.pos[2]),
        new THREE.Quaternion(it.rot[0], it.rot[1], it.rot[2], it.rot[3])
      );
    }
    for (const c of save.cars) {
      const car = composites.spawnCar(
        new THREE.Vector3(c.pos[0], c.pos[1], c.pos[2]),
        (c as { art?: WrackArt }).art ?? "pkw"
      );
      car.body.setRotation({ x: c.rot[0], y: c.rot[1], z: c.rot[2], w: c.rot[3] }, true);
      car.restoreState(c);
    }
  } else if (challengeDaten) {
    /*
     * DER PLATZ EINER CHALLENGE (E-125): aufgeraeumt — kein Haufen, kein
     * Streuschrott, keine Startautos. Nur, was die Challenge aufbaut.
     */
    fence = new FenceManager(scene, physics.world, items, bus);
    for (const w of challengeDaten.aufbau.wracks) composites.spawnCar(new THREE.Vector3(w.x, 0.5, w.z));
    items.settle(physics.world);
  } else {
    fence = new FenceManager(scene, physics.world, items, bus);
    /*
     * Grosser Berg in der Mischschrottbox. Die Annahmeflaeche bleibt frei,
     * dort laden die Pritschen ab. Der Haufen ist am Anfang unsortiert — dass
     * er als Verunreinigung zaehlt, ist gewollt: Aufraeumen ist die Aufgabe.
     *
     * NICHT in die Presskammer. Er lag bei (6,0 | −24,0) mit 2,9 m Streuung,
     * also von z −26,9 bis −21,1 — und die Kammer geht von −28,2 bis −23,8.
     * Gut die Haelfte des Haufens lag damit in der Presse, und eines der
     * beiden Altfahrzeuge stand mit (8,0 | −26,0) genau darin (Ansage
     * 13.09.2026: „achtet darauf, dass kein Schrott am Anfang in der Presse
     * liegt"). `test/startplatz.test.ts` haelt den Abstand fest.
     */
    items.spawnPile(
      new THREE.Vector3(START_HAUFEN.x, 0, START_HAUFEN.z),
      START_HAUFEN.teile,
      START_HAUFEN.streuung
    );
    // Altfahrzeuge am Rand des Haufens, beide in der Mischschrottbox
    for (const a of START_AUTOS) composites.spawnCar(new THREE.Vector3(a.x, 0.5, a.z));
    // LKW-Wrack an der Ostmauer (E-135)
    composites.spawnCar(new THREE.Vector3(START_LKW.x, 0.5, START_LKW.z), "lkw", START_LKW.gier);
    // Etwas Streuschrott neben dem Stahlhaufen — er lag frueher an den
    // Schrottbergen, und die stehen jetzt ausserhalb der Mauer. Auf dem Platz
    // soll alles, was nach Material aussieht, auch aufzunehmen sein.
    randomCargo(START_STREU.teile).forEach((sp, i) => {
      const a = (i / START_STREU.teile) * Math.PI * 2;
      items.spawnScrap(
        sp.materialId,
        sp.massKg,
        sp.shape,
        // An den Mischschrott statt an den alten Platz (Ansage 12.09.2026:
        // „es fallen immer noch am alten Platz Schrottteile runter").
        new THREE.Vector3(
          START_STREU.x + Math.cos(a) * START_STREU.radius,
          0.8 + (i % 3) * 0.7,
          START_STREU.z + Math.sin(a) * START_STREU.radius
        )
      );
    });
    // Erst jetzt setzen lassen, wenn alles Anfaengliche steht — Haufen, Autos
    // und Streuschrott. Frueher waere sinnlos: die spaeter gespawnten Teile
    // fallen in den Haufen und wecken ihn sofort wieder. So beginnt das erste
    // Bild mit einem Platz, der bereits liegt.
    items.settle(physics.world);
  }
  const vehicles = new VehicleManager(scene, physics.world, items, composites);
  /*
   * Der Abholer bringt Platzinventar zurueck (E-034/E-044).
   *
   * Laedt der Spieler den Muellcontainer versehentlich in den Abhol-Container,
   * faehrt er nicht mit: Vor der Abfahrt wandert sein INHALT ins ABFALL-Silo,
   * und die leere Huelle wird am Abladeplatz abgesetzt. Ansage Patrick
   * 15.09.2026: „Wenn ein Abholer den Muellcontainer mitnimmt, dann bringt er
   * ihn auch wieder und kippt ihn einfach bei mir ab" — „mit ohne Muell in dem
   * Fall. Und der Muell landet natuerlich bei uns im Silo."
   *
   * Beide Seiten waren gebaut und haben sich nicht gekannt: `ContainerAbholung`
   * in `delivery/`, `leereBehaelter` in `world/containers.ts`. Ohne diese Zeile
   * faehrt der Container mit und ist weg — und gemerkt haette man es erst,
   * wenn er fehlt. Dieselbe Klasse wie beim Besen, der ohne eine Zeile in
   * dieser Datei nie wiedergekommen waere.
   */
  vehicles.platzinventar = new ContainerAbholung(containers, items, physics.world);
  const press = new PressManager(scene, physics.world, items, composites);
  const staff = new StaffManager(
    scene,
    items,
    new THREE.Vector3(WEIGH_X, 0, WEIGH_Z),
    KAFFEE_POS,
    BUERO_TUER
  );
  // Mario kommt aus dem Buero, sobald ein LKW zur Kontrolle auf der Waage steht
  staff.getWeighTruck = () => vehicles.wiegeKontrolle();
  // Weder Bagger noch Radlader fahren durch einen stehenden LKW hindurch
  staff.getVehicleBoxes = () => alleFahrzeugBoxen();
  staff.getExcavatorPos = () => excavator.position;
  const carPos: THREE.Vector3[] = [];
  staff.getObstaclePositions = () => {
    carPos.length = 0;
    for (const c of composites.cars) {
      const p = c.body.translation();
      carPos.push(new THREE.Vector3(p.x, 0, p.z));
    }
    return carPos;
  };

  const buildSaveData = (): SaveData => ({
    schemaVersion: 2,
    savedAt: new Date().toISOString(),
    moneyEur: account.moneyEur,
    shift: shift.toJSON(),
    reputation: ruf.toJSON(),
    tutorial: tutorial.toJSON(),
    upgrades: ausbau.toJSON(),
    timeOfDay: daylight.time,
    radio: { songId: audio.songId },
    greifer: excavator.greiferform.id,
    items: items.items
      .filter((i) => i.shape)
      .map((i) => {
        const p = i.body.translation();
        const r = i.body.rotation();
        return {
          materialId: i.materialId,
          massKg: i.massKg,
          shape: i.shape!,
          pos: [p.x, p.y, p.z],
          rot: [r.x, r.y, r.z, r.w],
        };
      }),
    cars: composites.cars.map((c) => c.saveState),
    fencesBroken: fence.brokenFlags,
  });
  const excavator = new Excavator(scene, physics.world);
  /*
   * Streifenwagen: kommt zwischendurch zur Kontrolle, ohne Folgen. Seine
   * Standflaeche kommt zu den LKW dazu — auch durch ein Polizeiauto faehrt
   * der Bagger nicht hindurch.
   */
  const polizei = new Police(scene, physics.world);
  polizei.getExcavatorPos = () => excavator.position;
  polizei.onFunk = (text) => hud.toast(text);
  const alleFahrzeugBoxen = (): ReturnType<typeof vehicles.fahrzeugBoxen> => {
    const boxen = vehicles.fahrzeugBoxen();
    polizei.boxen(boxen);
    return boxen;
  };
  excavator.getVehicleBoxes = alleFahrzeugBoxen;
  const grip = new GripSystem(physics.world, excavator.grappleBody);
  /*
   * Die Fahrkunst-Messung (E-119): Praezision, Ruhe, Tempo, Wurf, Gefuehl —
   * gemessen aus dem, was Bagger und Physik ohnehin wissen, ohne etwas daran
   * zu aendern. Sie meldet je gezaehltem Zyklus ueber den Bus; wer zuhoert,
   * entscheidet die Anzeige (Etappe 3).
   */
  const fahrkunst = new Fahrkunst(grip, excavator);
  fahrkunst.onZyklus = (e) => bus.emit("fahrkunst:zyklus", e);
  /*
   * Welcher Greifer haengt (E-059, geaendert durch E-105).
   *
   * NEUE RUNDE → `STANDARD_GREIFER`, also der Fuenfschalengreifer (Ansage
   * Patrick, 17.09.2026).
   *
   * VORHANDENER STAND → was darin steht. Und ein Stand OHNE das Feld — also
   * einer aus der Zeit vor E-059 — behaelt die Sichelkralle: Damit wurde er
   * gespielt. Ihm beim Laden einen anderen Greifer in die Hand zu druecken
   * waere keine Vorgabe, sondern eine Ueberraschung. Genau deshalb steht hier
   * `SICHELKRALLE.id` und nicht der Standard.
   */
  setzeGreifer(
    excavator,
    grip,
    save ? formZu(save.greifer ?? SICHELKRALLE.id) : STANDARD_GREIFER
  );
  const orbit = new OrbitCamera(window.innerWidth / window.innerHeight);
  const debug = new DebugOverlay();
  const aimRing = new AimRing(scene);
  const audio = new AudioManager(bus);
  const hud = new Hud();
  const particles = new Particles(scene);

  /*
   * DIE CHALLENGE (E-125). Sie beobachtet nur: was in der Spinne haengt, ob
   * das Wrack ueber der Kammer steht oder darin liegt (die Pruefung der Presse
   * selbst), und die Fahrkunst-Zyklen fuer Ruhe und Praezision. Karte und
   * Abschlussbild haengen am Bus.
   */
  let challenge: ChallengeLauf | null = null;
  if (challengeDaten) {
    const wrack = composites.cars[0] ?? null;
    const lauf = new ChallengeLauf(
      challengeDaten,
      {
        wrack: () => (wrack?.body.isValid() ? wrack.body : null),
        gegriffen: () => grip.grippedBodies,
        ueberKammer: (p) => press.ueberKammer(p),
        inKammer: (p) => press.inChamber(p),
      },
      bus
    );
    challenge = lauf;
    // Die beiden Stellschrauben, die E-119 fuer die Challenge vorgesehen hat
    fahrkunst.ziel = challengeDaten.ablageziel;
    fahrkunst.neuBeginnen();
    bus.on("fahrkunst:zyklus", (e) => lauf.zyklusGemessen(e));
    bus.on("challenge:geschafft", (e) => merkeChallenge(e.id, e.sterne));
    // Begonnen ist begonnen: Der naechste Start zeigt das Menue
    merkeChallenge(challengeDaten.id, 0);
    installChallengeKarte({ bus, steuerung: () => touch.config, audio });
    vehicles.acceptDeliveries = false;
  }

  // --- Pausenmenü ---
  // Tagesablauf: Annahme → Sortieren → Annahme (Briefing Kap. 21)
  // Fahrspuren überwachen: liegt Schrott im Weg, steht der Betrieb
  const lanes = new LaneWatch(items);
  /*
   * Die Anlieferung richtet sich nach der Maschine (Ansage 12.09.2026): Der
   * LKW faehrt so nah an den Bagger heran, wie der Vorplatz es zulaesst.
   * Deshalb muessen die Routen wissen, wo er steht.
   */
  setBaggerOrt(() => excavator.position);
  let stoerfallGemeldet = false;
  // Geführter Einstieg — zeigt den Kreislauf einmal und hält sich dann raus
  const tutorial = new Tutorial();
  tutorial.load(save?.tutorial);
  const tutEl = document.getElementById("tutorial")!;
  let tutSortiertKg = 0;
  let tutGepresst = false;
  let tutAbholer = false;
  let tutPreis = false;
  const zeigeTutorial = (): void => {
    const st = tutorial.step;
    if (!st) {
      tutEl.classList.remove("open");
      return;
    }
    document.getElementById("tut-schritt")!.textContent = tutorial.progress;
    document.getElementById("tut-titel")!.textContent = st.title;
    document.getElementById("tut-text")!.textContent = st.text;
    // Angehalten schrumpft die Karte auf ihren Kopf — aus dem Weg, aber nicht
    // weg. Der Knopf sagt, was der naechste Tipp tut, nicht was gerade gilt.
    tutEl.classList.toggle("pausiert", tutorial.paused);
    document.getElementById("tut-pause")!.textContent = tutorial.paused ? "weiter" : "Pause";
    tutEl.classList.add("open");
  };
  // In einer Challenge gehoert die Karte der Challenge (E-125)
  if (!challenge) {
    document.getElementById("tut-skip")!.addEventListener("click", () => {
      tutorial.skip();
      zeigeTutorial();
    });
    document.getElementById("tut-pause")!.addEventListener("click", () => {
      tutorial.togglePause();
      zeigeTutorial();
    });
    zeigeTutorial();
  }

  const shift = new Shift();
  shift.load(save?.shift);
  // Kontostand am Morgen - Bezugspunkt fuer den Tagesgewinn (E-113).
  // Ueberschreibt nichts: Ein Stand von mittags bringt seinen Morgen mit.
  shift.starte(account.moneyEur);
  if (typeof save?.timeOfDay === "number") daylight.time = save.timeOfDay;
  let looseKg = 0;
  let looseTimer = 0;
  let verdichtungsTimer = 0;
  /**
   * Lose auf dem Platz liegender Schrott. Alles, was nicht in einer Box liegt
   * und am Boden ist, zählt — das ist die Arbeit, die noch vor dem Spieler
   * liegt. Die Summe ändert sich träge, daher reicht viermal pro Sekunde.
   */
  const measureLoose = (): number => {
    let kg = 0;
    for (const it of items.items) {
      if (it.containerId) continue;
      if (!it.body.isValid() || !it.body.isDynamic()) continue;
      if (it.body.translation().y > 2.5) continue; // noch auf einer Ladefläche
      kg += it.massKg;
    }
    return kg;
  };

  const pauseEl = document.getElementById("pause")!;
  let paused = false;
  const setPaused = (v: boolean): void => {
    paused = v;
    pauseEl.classList.toggle("open", v);
    if (v) zeigeGreiferwahl();
    if (!v) {
      pauseEl.classList.remove("settings");
      document.getElementById("controls-menu")!.classList.remove("open");
    }
  };
  /*
   * Greiferwahl (E-059). Der Knopf steht im Pausenmenue, weil er nichts ist,
   * was man im Betrieb macht: Er wechselt das Werkzeug an der Maschine.
   *
   * Gesperrt, solange etwas in der Spinne haengt oder sie nicht offen ist —
   * die Begruendung steht in `Excavator.greiferWechselBereit`.
   */
  const greiferKnopf = document.getElementById("pause-greifer") as HTMLButtonElement;
  const greiferGrund = document.getElementById("pause-greifer-grund")!;
  const zeigeGreiferwahl = (): void => {
    const st = knopfstand(excavator);
    greiferKnopf.textContent = st.text;
    greiferKnopf.disabled = !st.moeglich;
    greiferGrund.textContent = st.grund;
  };
  greiferKnopf.addEventListener("click", () => {
    const form = wechsleGreifer(excavator, grip);
    zeigeGreiferwahl();
    bus.emit("greifer:gewechselt", { greifer: form.id, name: form.name });
  });
  bus.on("greifer:gewechselt", (e) => {
    hud.toast(`${e.name} angebaut.`);
    speichereGreifer(e.greifer);
  });
  document.getElementById("pause-resume")!.addEventListener("click", () => setPaused(false));
  document.getElementById("pause-save")!.addEventListener("click", () => {
    hud.toast(storeSave(buildSaveData()) ? "Gespeichert." : "Speichern fehlgeschlagen!");
    setPaused(false);
  });
  // In der Challenge fuehrt derselbe Knopf ins Menue — neu geladen wird ohnehin
  if (challenge) document.getElementById("pause-load")!.textContent = "Zum Hauptmenü";
  document.getElementById("pause-load")!.addEventListener("click", () => location.reload());
  document.getElementById("pause-new")!.addEventListener("click", () => {
    clearSave();
    location.reload();
  });

  // --- Steuerungsmenü: die vier Stickachsen frei belegen ---
  const AXIS_IDS: AxisId[] = ["leftY", "leftX", "rightY", "rightX"];
  const warnEl = document.getElementById("ctrl-warn")!;
  const renderControls = (): void => {
    for (const id of AXIS_IDS) {
      const sel = document.getElementById(`ax-${id}`) as HTMLSelectElement;
      const b = touch.config[id];
      if (sel.options.length === 0) {
        for (const [fn, label] of Object.entries(FUNCTION_LABELS)) {
          sel.add(new Option(label, fn));
        }
      }
      sel.value = b.fn;
      document.getElementById(`inv-${id}`)!.classList.toggle("on", b.invert);
    }
    // Doppelt belegte Funktionen sind erlaubt, aber selten gewollt — Hinweis
    const used = AXIS_IDS.map((i) => touch.config[i].fn).filter((f) => f !== "none");
    const doppelt = used.filter((f, i) => used.indexOf(f) !== i);
    warnEl.textContent = doppelt.length
      ? `Mehrfach belegt: ${[...new Set(doppelt)].map((f) => FUNCTION_LABELS[f]).join(", ")}`
      : "";
  };
  for (const id of AXIS_IDS) {
    document.getElementById(`ax-${id}`)!.addEventListener("change", (e) => {
      touch.config[id].fn = (e.target as HTMLSelectElement).value as ControlFunction;
      saveConfig(touch.config);
      renderControls();
    });
    document.getElementById(`inv-${id}`)!.addEventListener("click", () => {
      touch.config[id].invert = !touch.config[id].invert;
      saveConfig(touch.config);
      renderControls();
    });
  }
  const showControls = (v: boolean): void => {
    pauseEl.classList.toggle("settings", v);
    document.getElementById("controls-menu")!.classList.toggle("open", v);
    if (v) renderControls();
  };
  const ctrlBtn = document.getElementById("pause-controls")!;
  if (!touch.active) ctrlBtn.style.display = "none";
  ctrlBtn.addEventListener("click", () => showControls(true));
  document.getElementById("ctrl-back")!.addEventListener("click", () => showControls(false));
  document.getElementById("ctrl-reset")!.addEventListener("click", () => {
    touch.config = defaultConfig();
    saveConfig(touch.config);
    renderControls();
  });

  // --- Abholung bestellen: Fraktion wählen, dann kommt der LKW ---
  const pickupEl = document.getElementById("pickup")!;
  const pickupListEl = document.getElementById("pickup-list")!;
  const showPickup = (v: boolean): void => {
    pickupEl.classList.toggle("open", v);
    if (!v) return;
    // Nur anbieten, was auch dasteht — mit der Menge, die bereitliegt
    const kg = new Map<string, number>();
    for (const it of items.items) {
      if (!it.body.isValid() || !it.body.isDynamic()) continue;
      for (const c of it.composition ?? [{ materialId: it.materialId, massKg: it.massKg }]) {
        kg.set(c.materialId, (kg.get(c.materialId) ?? 0) + c.massKg);
      }
    }
    pickupListEl.innerHTML = "";
    const bestellen = (order: string | null, label: string): void => {
      const b = document.createElement("button");
      const menge = order ? kg.get(order) ?? 0 : [...kg.values()].reduce((a, c) => a + c, 0);
      b.innerHTML = `${label}<span class="kg">${Math.round(menge)} kg</span>`;
      b.addEventListener("click", () => {
        showPickup(false);
        const r = vehicles.requestPickup(order);
        tutAbholer = true;
        const was = order ? `für ${getMaterial(order).name}` : "für gemischte Ladung";
        hud.toast(
          r === "vorgemerkt"
            ? `Abholung ${was} vorgemerkt — sie fährt als nächstes vor.`
            : order
              ? `Abholung ${was} bestellt — sortenrein laden!`
              : `Abholung ${was} bestellt.`
        );
      });
      pickupListEl.appendChild(b);
    };
    for (const id of [...kg.keys()].sort((a, b) => (kg.get(b) ?? 0) - (kg.get(a) ?? 0))) {
      if (ABFALL.has(id)) continue; // Abfall bestellt kein Abnehmer
      bestellen(id, getMaterial(id).name);
    }
    bestellen(null, "Gemischt (schlechter Preis)");
  };
  document.getElementById("pickup-cancel")!.addEventListener("click", () => showPickup(false));

  touch.onWheelTick = () => audio.playTick();
  // Auf iOS gibt es keine Vibration — der Klick ist dort die einzige Bestaetigung
  touch.onTap = () => audio.playTick();
  // Fahren hat seit dem 14.09.2026 eine eigene Fläche und keinen Zustand mehr,
  // den man ansagen müsste — deshalb hier auch keine Meldung.

  const helpEl = document.getElementById("help")!;
  if (touch.active) helpEl.style.display = "none"; // auf Touchgeräten stört die Tastenliste
  const sensorPos = new THREE.Vector3();

  // --- Event-Verdrahtung (Kap. 17: Querverbindungen nur über Events) ---
  grip.onGrabbed = (bodies) => {
    // Klang nach dem, was tatsaechlich in der Schale liegt
    const erstes = bodies.length > 0 ? items.itemByBody(bodies[0]) : null;
    audio.playGrab(erstes?.materialId);
    for (const b of bodies) {
      fence.notifyGrabbed(b); // verankertes Zaunfeld? → losreißen
      /*
       * Was die Spinne fasst, verliert seine Scheiben. Fuenf Zaehne mit
       * hundertsechzig Kilonewton nehmen darauf keine Ruecksicht — und ein
       * Wrack, das nach dem Greifen noch alle Fenster hat, sieht falsch aus.
       */
      const it = items.itemByBody(b);
      if (it) items.zerbrichGlas(it);
    }
  };
  grip.onTear = () => audio.playTear();
  grip.onReleased = (count) => bus.emit("released", { count }); // E-121: Ton beim Loslassen
  /*
   * Aufschlaege: Der wichtigste Klang auf dem Platz. Ob es metallisch
   * wummert oder dumpf auf Beton klatscht, haengt daran, ob das Teil auf
   * einer Ladeflaeche landet — dafuer dienen dieselben Standflaechen, die
   * auch Bagger und Radlader vom Durchfahren abhalten.
   */
  items.onGlasBruch = (x, y, z) => bus.emit("glassShattered", { x, y, z });
  /*
   * Lambert am Werkzeug: Er flext die Alufelge vom Reifen. Das Trennen selbst
   * macht der ItemManager — der Platzwart meldet nur, dass die Arbeit getan
   * ist, und kennt darum weder Fraktionen noch Preise.
   */
  staff.getMuldenOrt = (id) => containers.ortVon(id);
  staff.onFunken = (x, y, z) => {
    particles.spawn(evPos.set(x, y, z), 5, 0xffc46b, 3.0, 0.5, 0.35);
  };
  staff.onTrennen = (it) => {
    const name = it.shape?.name ?? getMaterial(it.materialId).name;
    const teile = items.zerlege(it);
    if (!teile) return;
    audio.playTear();
    const namen = teile.map((x) => getMaterial(x.materialId).name).join(" + ");
    hud.toast(`Lambert hat ${name} getrennt: ${namen}`);
  };
  /*
   * Worauf ein Teil oder die Spinne trifft (E-121). Stahl: Ladeflaechen und
   * Mulden (Absetz-, Abroll-, Grosscontainer). Betonboxen und Halden haben
   * Betonboden. Der Ton haengt am Ereignis, nicht an diesem Aufruf (Regel 10).
   */
  const STAHLBODEN = new Set(["box", "rolloff", "grosscontainer"]);
  const stahlGrund = (x: number, y: number, z: number): boolean =>
    findeBox(x, z, alleFahrzeugBoxen(), 0.4) !== null ||
    containers.containers.some((c) => STAHLBODEN.has(c.cfg.kind) && c.containsPoint({ x, y, z }));
  items.onAufprall = (item, wucht) => {
    const p = item.body.translation();
    bus.emit("schrott:aufprall", {
      materialId: item.materialId,
      massKg: item.massKg,
      wucht,
      blech: items.isCrushable(item),
      // ponytail: "auf Schrott" nach Hoehe der Teilmitte (ueber 0,7 m); Strahl nach unten, falls es falsch klingt
      untergrund: stahlGrund(p.x, p.y, p.z) ? "stahl" : p.y > 0.7 ? "schrott" : "beton",
      x: p.x,
      y: p.y,
      z: p.z,
    });
  };
  // Zaehne treffen aufeinander — hoerbar, auch wenn nichts drin ist
  excavator.onClawSnap = (haerte) => audio.playClawSnap(haerte);
  // Gehaltener Schrott schlaegt auf (E-134): das schwerste gegriffene Teil klingt
  excavator.onAufschlag = (tempo, aufSchrott) => {
    let it: ReturnType<typeof items.itemByBody>;
    for (const b of grip.grippedBodies) {
      const x = items.itemByBody(b);
      if (x && (!it || x.massKg > it.massKg)) it = x;
    }
    if (!it) return;
    const p = it.body.translation();
    bus.emit("schrott:aufprall", {
      materialId: it.materialId,
      massKg: grip.totalMassKg,
      wucht: lastAufschlagWucht(tempo),
      blech: items.isCrushable(it),
      untergrund: aufSchrott ? "schrott" : stahlGrund(p.x, p.y, p.z) ? "stahl" : "beton",
      x: p.x,
      y: p.y,
      z: p.z,
    });
  };
  /*
   * Zudruecken richtet Schaden an (E-112 baut die Kraft, E-114 die Wirkung).
   * Der Bagger kennt keinen Bus, deshalb ein Haken wie `onClawSnap`; wer
   * zuhoert, steht in `dismantle/composites.ts` und in `audio`.
   */
  excavator.onClawBite = (e) => bus.emit("greifer:zugedrueckt", e);
  grip.partResolver = (pos) => composites.findPartNear(pos);
  // Gewalt beim Herausreißen: Rotator-Drehung zählt am stärksten, dazu die
  // Achsbewegung. Wer die Spinne am Motor verdreht, bekommt ihn schneller los.
  grip.getViolence = () => excavator.tearViolence;
  grip.insideGrapple = (pos) => excavator.isInsideGrapple(pos);
  grip.krallenKontakte = (body) => excavator.krallenKontakte(body);
  // Nach dem Loslassen bleiben die Krallen-Kollider kurz aus, sonst quetschen
  // sie das eben abgeworfene Teil gegen den Boden.
  grip.onReleaseGrace = () => excavator.startClawGrace();
  // Woran die Zaehne stehen bleiben. Was sich quetschen laesst — Blech, Kabel,
  // Faesser, Buntmetall, Draht — gibt nach: Der Greifer drueckt es platt oder
  // schiebt es beiseite, genau wie in Wirklichkeit. Stehen bleibt er an
  // massivem Stahl und an allem, was kein Schrottteil ist (Wracks).
  excavator.clawBlockedBy = (body) => {
    const it = items.itemByBody(body);
    if (!it) return true; // Karosse, Presspaket, Unbekanntes: haelt
    return !items.isCrushable(it);
  };
  // Aufgespiesst: Der Zahn geht durch nachgiebiges Material hindurch — dann
  // soll man dem Teil hinterher ansehen, was passiert ist. Sonst steckt es
  // unversehrt auf der Zacke und nichts erklaert, warum es dort haengt.
  // flattenItem greift je Teil nur einmal, es bleibt also bei einem Knirschen.
  excavator.onClawPierce = (body) => {
    const it = items.itemByBody(body);
    if (!it || !items.isCrushable(it) || !items.flattenItem(it)) return;
    const p = body.translation();
    audio.playDrop(it.materialId);
    particles.spawn(new THREE.Vector3(p.x, p.y, p.z), 4, 0xb0b6bb, 1.4, 1.0, 0.45);
  };
  excavator.getStaffPos = () => staff.lambertPosition();
  staff.getBlockingItem = () => {
    const b = lanes.nearest(staff.lambertPosition());
    return b ? b.item : null;
  };
  staff.getGrapplePos = () => {
    excavator.getSensorPosition(sensorPos);
    return sensorPos;
  };
  // Zudrücken: was nachgibt, wird in der Spinne plattgequetscht
  grip.crusher = (body) => {
    const it = items.items.find((i) => i.body.handle === body.handle);
    /*
     * Trennen geht vor Quetschen. Ein Rad ist nach der Dichteregel nicht
     * quetschbar — es ist ja voll —, aber sehr wohl zu sprengen. Stuende die
     * Pruefung zuerst, kaeme das Zerlegen nie dran.
     */
    if (it && items.brauchtWerkzeug(it)) {
      // Im Simulator gibt es keinen Lambert (E-118) — dann bleibt es beim Befund
      hud.toast(`${it.shape?.name ?? "Das Teil"} braucht Werkzeug${BETRIEB ? " — Arbeit für Lambert" : ""}.`);
      return false;
    }
    if (!it || (!items.isCrushable(it) && !items.istTrennbar(it))) return false;
    const p = body.translation();
    const ort = new THREE.Vector3(p.x, p.y, p.z);
    /*
     * Manches faellt beim Zerquetschen auseinander, statt nur flach zu werden:
     * Bei einer Kabeltrommel zerbricht das Holz, bevor das Kabel nachgibt, und
     * danach liegt beides getrennt da (Wunsch 12.09.2026). Aus einem
     * Mischschrott-Teil werden so sortenreine — das ist der Lohn fuer die
     * Arbeit mit der Spinne.
     */
    const teile = items.zerlege(it);
    if (teile) {
      audio.playCrash(0.8);
      particles.spawn(ort, 12, 0x9a8b74, 2.0, 1.4, 0.6);
      const namen = teile.map((x) => getMaterial(x.materialId).name).join(" + ");
      hud.toast(`Zerlegt: ${namen}`);
      return true;
    }
    if (!items.flattenItem(it)) return false;
    audio.playDrop(it.materialId);
    particles.spawn(ort, 6, 0xb0b6bb, 1.6, 1.2, 0.5);
    hud.toast(`${getMaterial(it.materialId).name} zusammengedrückt`);
    return true;
  };
  bus.on("itemEntered", (e) => {
    audio.playDrop(e.materialId);
    if (e.correct) {
      audio.playCorrect();
      const it = items.items.find((i) => i.id === e.itemId);
      if (it) {
        account.noteSorted(it.massKg); // Geld gibt es erst bei der Abholung
        tutSortiertKg += it.massKg;
      }
    } else {
      audio.playWrong();
    }
  });
  const evPos = new THREE.Vector3();
  bus.on("glassShattered", (e) => {
    audio.playGlass();
    particles.spawn(evPos.set(e.x, e.y, e.z), 14, 0xcfe8f2, 2.4, 1.6, 0.5);
  });
  bus.on("crushed", (e) => {
    audio.playCrash(1);
    particles.spawn(evPos.set(e.x, e.y + 0.4, e.z), 12, 0x9a8b74, 2.2, 1.6, 0.7);
    particles.spawn(evPos.set(e.x, e.y + 0.3, e.z), 6, 0xffc060, 4, 2, 0.4);
  });
  bus.on("fenceBroken", (e) => {
    audio.playRattle();
    particles.spawn(evPos.set(e.x, 0.3, e.z), 8, 0x9a8b74, 1.5, 1.2, 0.6);
  });
  press.onStart = () => {
    // Was eben losgelassen wurde, liegt jetzt — gleich schiebt der Stempel (E-125)
    fahrkunst.jetztLiegtSie();
    audio.playGrab(); // Hydraulik läuft an
    hud.toast("Schere: Klappen schließen …");
  };
  press.onLidsClosed = () => audio.playCrash(0.6); // Eisenplatten schlagen auf
  press.onStamp = (count, pos) => {
    if (count > 0) tutGepresst = true;
    challenge?.presseHatGestempelt();
    audio.playCrash(1);
    audio.playTear();
    particles.spawn(pos, 16, 0x9a8b74, 2.5, 1.8, 0.7);
    particles.spawn(pos, 8, 0xffc060, 4, 2, 0.4);
    hud.toast(count > 0 ? `Schere: ${count} Teil${count > 1 ? "e" : ""} zum Paket gepresst` : "Schere: Mulde war leer");
  };
  // Fahrer fahren weder durch den Bagger noch über liegenden Schrott (Kap. 13)
  vehicles.getExcavatorPos = () => excavator.position;
  vehicles.onHonk = () => {
    audio.playWrong();
    hud.toast("Der Fahrer hupt — Fahrspur ist blockiert!");
  };
  // Brückenwaage: voll rein, leer raus → Kunde bekommt sein Geld
  // --- Platz ausbauen: verdientes Geld bekommt eine Verwendung ---
  const ausbau = new UpgradeState();
  ausbau.load(save?.upgrades);
  /*
   * Testmodus (11.09.2026): Alles ist von Anfang an da — Radlader, Bulldozer,
   * Stapler, Magnet, Baggerausbau, grosse Presse, Buero und Halle. Gespielt
   * wird gerade nicht die Wirtschaft, sondern die Maschinen; was man erst
   * kaufen muss, kann man nicht pruefen.
   *
   * Stufen, Level und Freischaltungen kommen zurueck, sobald sie dran sind:
   * Dann hier auf false stellen — die Kaufwege selbst sind unveraendert.
   */
  const ALLES_FREI = true;
  if (ALLES_FREI) for (const u of UPGRADES) ausbau.buy(u.id);
  // Betriebsgebäude: Büro und Halle stehen von Anfang an; sein Grundriss
  // liegt fest in der Hindernisliste (world/obstacles.ts).
  new OfficeBuilding(scene, physics.world);
  const shopEl = document.getElementById("shop")!;
  /** Wirkung eines gekauften Ausbaus sofort anwenden. */
  const wendeAn = (id: UpgradeId): void => {
    if (id === "loader") staff.setLoader(true);
    // "office" und "hall" richten das vorhandene Gebäude ein — sie wirken
    // über Abfragen (Marktkenntnis, Maschinenkauf), nicht über die Kulisse
    if (id === "magnet") account.hasMagnet = true;
    // dozer, forklift, boom und press wirken über Abfragen an anderer
    // Stelle — hier ist nichts einzuschalten
  };
  for (const u of UPGRADES) if (ausbau.has(u.id)) wendeAn(u.id);
  // Baggerausbau und größere Presse wirken über diese Abfragen
  excavator.getSpeedBonus = () => (ausbau.has("boom") ? 1.35 : 1);
  grip.getCapacityBonus = () => (ausbau.has("boom") ? 1.5 : 1);
  press.getBaleBonus = () => (ausbau.has("press") ? 1.6 : 1);
  // Bulldozer und Stapler tun Verschiedenes: der eine macht Lambert schneller,
  // der andere lässt ihn schwerer heben. Wer beide hat, merkt beides.
  staff.getSpeedBonus = () => (ausbau.has("dozer") ? 1.4 : 1);
  staff.getLiftBonus = () => (ausbau.has("forklift") ? 2.5 : 1);
  account.hasMagnet = ausbau.has("magnet");

  const zeigeAusbau = (): void => {
    const liste = document.getElementById("shop-list")!;
    document.getElementById("shop-info")!.textContent =
      `Konto ${Math.round(account.moneyEur)} € · ` +
      `${(shift.turnoverKg / 1000).toFixed(1)} t umgeschlagen`;
    liste.innerHTML = "";
    for (const u of UPGRADES) {
      const b = document.createElement("button");
      const gekauft = ausbau.has(u.id);
      const frei = ausbau.available(u.id, shift.turnoverKg);
      const zahlbar = ausbau.affordable(u.id, shift.turnoverKg, account.moneyEur);
      b.disabled = gekauft || !zahlbar;
      const status = gekauft
        ? "vorhanden"
        : !frei
          ? `ab ${(u.requiresTurnoverKg / 1000).toFixed(0)} t Umschlag`
          : `${u.priceEur.toLocaleString("de-DE")} €`;
      b.innerHTML = `${u.name}<span class="preis">${status}</span><small>${u.effect}</small>`;
      if (!b.disabled) {
        b.addEventListener("click", () => {
          account.moneyEur -= u.priceEur;
          ausbau.buy(u.id);
          wendeAn(u.id);
          audio.playSale();
          hud.toast(`${u.name} gekauft — ${u.effect}`);
          zeigeAusbau(); // Liste auffrischen
        });
      }
      liste.appendChild(b);
    }
    shopEl.classList.add("open");
  };
  document.getElementById("shop-close")!.addEventListener("click", () =>
    shopEl.classList.remove("open")
  );
  // Ausbau und Musik liegen nicht mehr auf dem Joystickkopf, sondern im Menue:
  // Es sind keine Maschinenfunktionen, und der Kranz bleibt so weit gefaechert.
  document.getElementById("pause-shop")!.addEventListener("click", () => {
    setPaused(false);
    zeigeAusbau();
  });
  document.getElementById("pause-music")!.addEventListener("click", () => {
    hud.toast(audio.toggleMusic() ? "Musik an." : "Musik aus.");
  });
  // Senderwahl fuers Kabinenradio. Der Ein/Aus-Schalter darueber bleibt, wie
  // er war — hier wird nur gewaehlt, was liefe.
  installRadio({
    audio,
    toast: (t) => hud.toast(t),
    verlassePause: () => setPaused(false),
    gewaehlt: gespeichert?.radio?.songId,
  });
  // Lautstaerke je Gruppe im Pausenmenue (E-139)
  installTonregler({ audio, verlassePause: () => setPaused(false) });

  /*
   * Das Funkgeraet (E-100). Mario, Janine und Lambert melden sich ueber
   * denselben Kanal wie Achim und die Anlieferer — eine Meldezeile, nicht
   * zwei. Ohne diese Verdrahtung ist der Funk stumm, und genau das haelt
   * `test/funk-verdrahtung.test.ts` fest.
   */
  const funk = new Funkzentrale();
  funk.onSpruch = (spruch) => hud.toast(`${spruch.wer}: „${spruch.text}"`);

  // --- Verhandeln an der Waage ---
  const ruf = new Reputation();
  /*
   * Feierabend und Abrechnung (E-113). Das Feld haengt nur am Bus; die Uhr
   * kommt aus `daylight`, die Zahlen aus `shift`, der Ruf aus `ruf`.
   */
  const abrechnung = installAbrechnung({
    bus,
    shift,
    hud,
    audio,
    funk,
    konto: () => account.moneyEur,
    ruf,
    daylight,
  });

  ruf.load(save?.reputation);
  let preisFaktor = 1;
  let zahlungsUnfaehig = false;
  /**
   * Fester Kurs für Gewerbekunden. Etwas über Markt: Sie liefern sortenrein
   * und verlässlich, das ist den Aufschlag wert.
   */
  const GEWERBE_KURS = 1.06;
  const haggleEl = document.getElementById("haggle")!;
  const zeigeVerhandlung = (
    kunde: import("./delivery/customers").CustomerProfile,
    kg: number,
    rein: string | null
  ): void => {
    preisFaktor = 1;
    const marktEur = kg * PURCHASE_PRICE_PER_KG;
    // Sortenrein heißt: klarer Marktwert, wenig zu behaupten
    const reinheit = rein ? 1 : 0.45;
    document.getElementById("haggle-who")!.textContent =
      kunde.group === "haendler" ? `${kunde.name} ${kunde.subtitle}` : kunde.name;
    // Mit Büro sieht man einer gemischten Ladung an, was drinsteckt — das
    // ist die Marktkenntnis, die der Kaufeintrag verspricht.
    const mix = ausbau.has("office") && !rein ? vehicles.activeCargoMix : [];
    const zusammensetzung =
      mix.length > 0
        ? " · " +
          mix
            .slice(0, 3)
            .map((m) => `${Math.round(m.share * 100)} % ${getMaterial(m.materialId).name}`)
            .join(", ")
        : "";
    document.getElementById("haggle-info")!.textContent =
      `${Math.round(kg)} kg ${rein ? getMaterial(rein).name : "Mischschrott"}${zusammensetzung} · ` +
      `Marktpreis ${marktEur.toFixed(0)} € · ${hint(kunde)}`;
    const liste = document.getElementById("haggle-list")!;
    liste.innerHTML = "";
    for (const offer of ["markt", "leicht", "hart"] as Offer[]) {
      const b = document.createElement("button");
      b.innerHTML =
        `${OFFER_LABEL[offer]}<span class="eur">${(marktEur * OFFER_FACTOR[offer]).toFixed(0)} €</span>`;
      b.addEventListener("click", () => {
        haggleEl.classList.remove("open");
        vehicles.dealPending = false;
        tutPreis = true;
        const r = haggle(
          kunde,
          offer,
          reinheit,
          ruf.get(kunde.group) / 100,
          ausbau.has("office") // Büro: begründetes Angebot wird eher akzeptiert
        );
        preisFaktor = r.factor;
        hud.toast(`${kunde.name}: „${r.reply}"`);
        if (r.offense > 0.05) ruf.note("hartGedrueckt", kunde.group);
        else if (offer === "markt") ruf.note("fairBezahlt", kunde.group);
        // Händler nehmen ihre Ware wieder mit, wenn der Preis nicht stimmt
        if (!r.accepted && leavesOnRefusal(kunde)) vehicles.sendAway();
      });
      liste.appendChild(b);
    }
    haggleEl.classList.add("open");
  };

  // Kundschaft meldet sich bei der Ankunft — Name, Herkunft und ein Wort
  /*
   * Der Abholer funkt durch, wo er steht (E-056b).
   *
   * Ansage Patrick 15.09.2026, auf die Frage, wie man ihn findet, wenn er
   * nicht mehr immer an derselben Stelle haelt: „Er funkt es an, wie ein
   * Fahrer." Verworfen hat er einen Zeiger am Bildrand (dauerhaft im Bild)
   * und gar nichts (man dreht sich beim ersten Mal im Kreis).
   *
   * Es laeuft ueber denselben Kanal wie die Begruessung eines Haendlers —
   * eine Einblendung, einmal je Fuhre, zum Ueberhoeren. Kein neues Ereignis,
   * kein Kasten, der stehen bleibt: Wer nicht hinhoert, sucht halt.
   *
   * Der Ort im Spruch kommt aus dem Schild des Behaelters, nicht aus einer
   * zweiten Liste — ein neues Silo bekommt seinen Spruch damit von selbst
   * richtig.
   */
  vehicles.onPickupFunk = (wer, spruch) => hud.toast(`${wer}: „${spruch}"`);
  /*
   * Lambert haengt an DEMSELBEN Kanal (Auftrag 17.09.2026: „Kein zweiter
   * Kanal"). Er meldet sich, wenn er von sich aus anfaengt aufzuraeumen, wenn
   * er durch ist und wenn die Abfallmulde nichts mehr nimmt — gleiche Zeile,
   * gleiche Form wie beim Abholer.
   */
  staff.onFunk = (wer, spruch) => hud.toast(`${wer}: „${spruch}"`);

  /*
   * DER LIEFERSCHEIN DES ABHOLERS (E-064).
   *
   * Ansage Patrick, 15.09.2026: „ausserdem muss auch abholer leer wiegen."
   * Er haelt jetzt bei der Einfahrt auf der Bruecke wie jeder andere — leer,
   * also Tara — und beim Hinausfahren voll. Die Differenz ist, was vom Hof
   * geht.
   *
   * Zwei Zeilen, sonst nichts: kein Geld, kein Konto, keine Preisaenderung.
   * Bezahlt wird die Fuhre weiterhin beim Losfahren vom Verladeplatz
   * (`onPickupDepart`) — der Kreislauf bleibt unberuehrt.
   */
  vehicles.onAbholerTara = (tara) =>
    hud.toast(`Waage: ${tara.toFixed(0)} kg Tara — leerer Container, weiter auf den Platz.`);
  vehicles.onAbholerBrutto = (tara, brutto) =>
    hud.toast(
      `Waage: ${brutto.toFixed(0)} kg brutto − ${tara.toFixed(0)} kg Tara = ` +
        `${Math.max(brutto - tara, 0).toFixed(0)} kg abgeholt.`
    );

  vehicles.onCustomerArrived = (c) => {
    const wer =
      c.group === "haendler"
        ? `${c.name} ${c.subtitle}`
        : c.group === "gewerbe"
          ? c.name
          : `${c.name} ${c.subtitle}`;
    hud.toast(`${wer}: „${c.greeting}"`);
    funk.kundeDa({ name: c.name, subtitle: c.subtitle, group: c.group });
  };
  vehicles.onWeighIn = (kg) => {
    const rein = vehicles.activeSortedMaterial;
    hud.toast(
      rein
        ? `Waage: ${kg.toFixed(0)} kg brutto — sortenrein ${getMaterial(rein).name}.`
        : `Waage: ${kg.toFixed(0)} kg brutto — bitte abladen.`
    );
    funk.wiegung({
      kg,
      sortenrein: rein,
      mix: vehicles.activeCargoMix,
      kunde: vehicles.activeCustomer?.name,
    });
    const kunde = vehicles.activeCustomer;
    if (!kunde) return;
    if (kunde.group === "gewerbe") {
      // Betriebe verhandeln nicht. Sie liefern zuverlässig ab und bekommen
      // dafür einen guten Kurs — das ist ihr Teil der Abmachung.
      preisFaktor = GEWERBE_KURS;
      ruf.note("sauberVerwogen", "gewerbe");
      hud.toast(`${kunde.name}: „${kunde.greeting}" — fester Kurs, keine Diskussion.`);
      return;
    }
    vehicles.dealPending = true; // der Fahrer wartet, bis der Preis steht
    vehicles.onDealTimeout = () => {
      haggleEl.classList.remove("open");
      preisFaktor = 1;
      hud.toast(`${kunde.name} wartet nicht länger — es gilt der Marktpreis.`);
    };
    zeigeVerhandlung(kunde, kg, rein);
  };
  vehicles.onWeighOut = (netKg) => {
    // Der beim Wiegen ausgehandelte Faktor gilt für diese Fuhre
    const paid = account.payDelivery(netKg, preisFaktor);
    shift.deliveries++;
    audio.playSale();
    hud.toast(
      preisFaktor < 1
        ? `Waage: ${netKg.toFixed(0)} kg netto · ${paid.toFixed(0)} € (${Math.round(preisFaktor * 100)} %)`
        : `Waage: ${netKg.toFixed(0)} kg netto · Kunde erhält ${paid.toFixed(0)} €`
    );
    preisFaktor = 1;
  };
  // Abhol-LKW fährt los → Container abrechnen (sortenrein zahlt sich aus)
  vehicles.onPickupDepart = (truck) => {
    const loaded = truck.containedItems(items);
    const sale = account.sellContainer(loaded, items, composites, vehicles.pickupOrder);
    if (sale.massKg > 0) {
      shift.noteTurnover(sale.massKg, sale.purity);
      audio.playSale();
      hud.toast(
        `Verkauft: ${sale.massKg.toFixed(0)} kg ${getMaterial(sale.dominant).name} · ` +
          `${(sale.purity * 100).toFixed(0)} % sortenrein · +${sale.eur.toFixed(0)} €`
      );
    } else {
      hud.toast("Container war leer — der LKW fährt umsonst.");
    }
  };

  /*
   * SIMULATOR: ABHAENGEN (E-118, Patrick 06.10.2026: „Abschalten, im Code
   * lassen").
   *
   * Oben ist alles verdrahtet wie im Betrieb — und bleibt es, damit der
   * Rueckweg ein Wort in core/spielart.ts ist. Hier wird im Simulator wieder
   * abgehaengt, was Geld, Kundschaft und Belegschaft ins Bild bringt. Die
   * Fahrzeuge selbst fahren weiter: ueber die Waage, aber ohne Wiegung, ohne
   * Verhandeln, ohne Bezahlung. Fuhren kommen seit E-122 wieder von selbst
   * (Takt nach losem Schrott), NACHSCHUB holt eine sofort.
   *
   * Was die Bildschleife je Bild rechnet (Tagesablauf, Feierabend, Funk,
   * Tutorial, Kasse), steht dort unter `if (BETRIEB)`.
   */
  if (!BETRIEB) {
    const stumm = [
      "onWeighIn", // Wiegemeldung und Verhandeln an der Waage
      "onWeighOut", // Bezahlung der Fuhre
      "onCustomerArrived", // Begruessung der Kundschaft
      "onPickupFunk", // Funk der Fahrer
      "onAbholerTara", // Wiegungen des Abholers
      "onAbholerBrutto",
      "onPickupDepart", // Verkauf beim Abholer
    ] as const;
    for (const k of stumm) vehicles[k] = null;
    staff.ausblenden(); // Mario, Janine, Lambert, Radlader
    excavator.getStaffPos = null; // ein unsichtbarer Lambert ist kein Hindernis
    hud.preiseZeigen = false; // Griff-Info ohne €/t
    containers.preiseZeigen = false; // Muldenschild ohne Erloes
    // E-120: Der Abholer faehrt voll von selbst, und nichts verschwindet auf
    // einen Schlag — der Muellcontainer leert sich nachts nicht mehr.
    vehicles.vollFaehrtLos = true;
    containers.nachtschichtAktiv = false;
    // E-131: Zum Start stehen schon Fuhren an, die erste rollt gleich los
    if (!challenge) vehicles.stelleAnstehendeAuf(ANSTEH_START_ANZAHL);
  }
  // Ein Abholer faehrt nie los, solange die Spinne etwas ueber ihm haelt (E-120)
  vehicles.gegriffen = () => grip.grippedBodies;
  /*
   * NACHSCHUB (E-118): Kipper, Pritsche, Wrack reihum, ohne Waage und ohne
   * Geld. Steht noch eine Fuhre auf dem Platz, wartet der Knopf — eine
   * zweite im Anflug haette keinen Abladeplatz.
   */
  let nachschubNr = 0;
  const holeNachschub = (): void => {
    if (challenge) return; // keine Fuhre mitten in die Aufgabe (E-125)
    if (vehicles.activeKind !== null) {
      hud.toast("Noch eine Fuhre auf dem Platz — Nachschub erst, wenn sie weg ist.");
      return;
    }
    const profil = profilFuer(NACHSCHUB_FOLGE[nachschubNr++ % NACHSCHUB_FOLGE.length]);
    vehicles.spawnNow(profil.vehicle, profil);
    // E-126: Die Meldung kennt das Grossteil, nicht nur das Fahrzeug —
    // sonst hiesse ein einzelner Minibagger "Eine Pritsche ist unterwegs".
    hud.toast(nachschubMeldung(profil));
  };

  // --- Fester Physik-Step, von Loop und Test-Handle gemeinsam genutzt ---
  let stepCount = 0;
  /** Bildschleife rechnet selbst? Beim Messen von aussen abschaltbar. */
  let autoStep = true;
  /**
   * Laeuft gerade ein Schritt? Die Messhilfe `__game.step()` und die
   * Bildschleife duerfen sich nicht ueberlappen: Rapier bricht dann mit
   * "recursive use of an object" ab, weil ein Kollider zweimal gleichzeitig
   * angefasst wird (beim Messen am 11.09.2026 passiert).
   */
  let imSchritt = false;

  function stepOnce(): void {
    if (imSchritt) return;
    imSchritt = true;
    try {
      schrittInhalt();
    } finally {
      imSchritt = false;
    }
  }

  function schrittInhalt(): void {
    excavator.update(FIXED_DT, input);
    excavator.getSensorPosition(sensorPos);
    grip.update(excavator.closure, excavator.closing, sensorPos, FIXED_DT);
    // Direkt nach dem Greifen und VOR dem Physikschritt: Nur hier ist linvel()
    // noch die Abwurfgeschwindigkeit, die releaseAll eben gesetzt hat (E-119).
    fahrkunst.update(FIXED_DT);
    excavator.carriedMassKg = grip.totalMassKg;
    excavator.carriedCount = grip.grippedCount;
    // Was in der Spinne hängt, darf sie nicht selbst blockieren
    excavator.grippedHandles.clear();
    for (const b of grip.grippedBodies) excavator.grippedHandles.add(b.handle);
    vehicles.obstacleHandles(excavator.obstacleBodies);
    // Karossen sind ebenfalls feste Störer: der Arm soll nicht hindurchfahren.
    // Die Spinne selbst bleibt frei — sonst käme man nicht mehr zum Greifen ran.
    for (const car of composites.cars) {
      if (car.body.isValid()) excavator.obstacleBodies.add(car.body.handle);
    }
    physics.step();
    // Behaelter sind schwere Koerper, die eine kinematische Spinne anstoesst —
    // sie brauchen dieselbe Traegheitsbremse wie der Schrott, und zwar in
    // jedem Schritt.
    containers.bremseAlle();
    items.clampSpeeds(FIXED_DT);
    // Haufen zur Ruhe bringen: Ohne die Schlafhilfe bleiben rund drei Viertel
    // der Teile dauerhaft wach und kosten jeden Frame Rechenzeit (gemessen:
    // 89 von 118 nach 30 s). Teile am Greifer bleiben ausgenommen.
    items.settleSleep(FIXED_DT, excavator.grappleBody.translation());
    composites.update();
    fence.update();
    vehicles.update(FIXED_DT);
    press.update(FIXED_DT);
    // Belegschaft und Streifenwagen gibt es nur im Betrieb (E-118)
    if (BETRIEB) {
      staff.update(FIXED_DT, vehicles.maneuveringTruck());
      polizei.update(FIXED_DT);
    }
    stepCount++;
    if (stepCount % RECOUNT_INTERVAL === 0) {
      const grippedHandles = new Set(grip.grippedBodies.map((b) => b.handle));
      containers.recount(items, grippedHandles);
    }
  }

  // Debug-Handle für automatisierte Smoke-Tests (nur Dev-Server, nicht im Build)
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__game = {
      excavator,
      grip,
      physics,
      input,
      THREE,
      items,
      containers,
      composites,
      fahrkunst,
      challenge,
      fence,
      vehicles,
      account,
      press,
      bus,
      saveNow: () => storeSave(buildSaveData()),
      touch,
      hitsObstacle,
      daylight,
      floodlights,
      staff,
      polizei,
      lanes,
      audio,
      togglePause: () => setPaused(!paused),
      isPaused: () => paused,
      /**
       * Schritte von aussen ausloesen (Messungen). `autoStep(false)` haelt
       * vorher die Bildschleife an, sonst laufen zwei Schrittquellen
       * gegeneinander.
       */
      step: (n: number) => {
        for (let i = 0; i < n; i++) stepOnce();
        items.syncMeshes();
      },
      autoStep: (an: boolean) => {
        autoStep = an;
      },
    };
  }

  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    orbit.resize(window.innerWidth / window.innerHeight);
  });

  // --- Hauptschleife ---
  let accumulator = 0;
  let msPhysik = 0;
  let msBild = 0;
  let msMisch = 0;
  let msLogik = 0;
  let msVor = 0;
  /*
   * Bildinterpolation (siehe core/zwischenbild.ts). Der Bagger wird fest
   * angemeldet: Sein Wurzelknoten steht still, waehrend Ausleger und Oberwagen
   * arbeiten — die Selbsterkennung wuerde ihn erst beim Losfahren bemerken.
   * Alles andere, was sich bewegt (LKW, Radlader, Figuren, angestossene
   * Behaelter), meldet sich beim ersten Meter selbst an.
   */
  const zwischenbild = new Zwischenbild();
  for (const w of excavator.bildwurzeln()) zwischenbild.wurzel(w);
  zwischenbild.beobachte(scene);
  /** Netze des gegriffenen Schrotts — Puffer, damit je Schritt nichts anfaellt */
  const gegriffeneNetze: THREE.Object3D[] = [];
  let lastTime = performance.now();
  let frameCount = 0;
  // E-121: Weg der Spinne und der Schalen je Bild, fuer Kehren und Greifen
  const kehrVorher = excavator.getSensorPosition(new THREE.Vector3());
  const kehrJetzt = new THREE.Vector3();
  let schalenVorher = excavator.closure;
  /* Restzeit bis zur naechsten Ladungs-Durchrechnung, siehe LADUNG_TAKT_S. */
  let ladungTakt = 0;
  /* --- Zonenmarkierungen: Taste M und Menueknopf, ein Weg (E-093) ---------
   * Lag bis zum 16.09.2026 im Funktionskranz. Patrick am Geraet: „Nimm Schild
   * (Markierungen) aus dem Menue raus, das kann ueber Hauptmenue geloest
   * werden." Es ist eine Anzeigeeinstellung, keine Maschinenfunktion.
   * Verdrahtet wie `pause-shop` und `pause-music`: versteckter Span in
   * `#menu-actions` traegt den Tastencode, der echte Knopf steht im
   * Pausenfeld. Die Taste bleibt, `touch.consumePress("KeyM")` auch — so
   * bleibt es EIN Schalter, egal woher der Druck kommt.
   */
  let labelsOn = true; // Zonen-Schilder sichtbar
  const markKnopf = document.getElementById("pause-markierungen")!;
  /** Zustand setzen — und ihn am Menueknopf stehen lassen (gelber Balken). */
  const zeigeMarkierungen = (an: boolean): void => {
    labelsOn = an;
    containers.setLabelsVisible(an);
    markKnopf.classList.toggle("an", an);
  };
  /** Umschalten samt Meldung. Beide Bedienwege rufen genau diese Zeile. */
  const schalteMarkierungen = (): void => {
    zeigeMarkierungen(!labelsOn);
    hud.toast(labelsOn ? "Markierungen an" : "Markierungen aus");
  };
  // Anfangszustand steht am Knopf, bevor jemand ihn zum ersten Mal sieht
  zeigeMarkierungen(labelsOn);
  markKnopf.addEventListener("click", schalteMarkierungen);

  function frame(): void {
    const now = performance.now();
    const frameDt = Math.min((now - lastTime) / 1000, 0.25);
    lastTime = now;

    touch.update(frameDt);
    if (input.wasPressed("Escape") || input.wasPressed("KeyP") || touch.consumePress("Escape")) {
      setPaused(!paused);
    }
    if (paused || abrechnung.offen) {
      // In der Pause ruht die Simulation; nur Rendern und Eingaben laufen weiter
      renderer.render(scene, orbit.camera);
      input.endFrame();
      requestAnimationFrame(frame);
      return;
    }
    excavator.touch = touch.active ? touch.axes : null;
    if (touch.consumePress("KeyC")) orbit.touchViewPress = true;
    if (touch.consumePress("KeyX")) excavator.toggleCabLift();
    if (touch.consumePress("KeyO")) excavator.toggleOutriggers();
    // I und J: liegen auf deutscher wie englischer Tastatur an derselben Stelle
    if (input.wasPressed("KeyI") || touch.consumePress("KeyI")) {
      hud.toast(excavator.toggleBlade() ? "Schild abgesenkt — schieben." : "Schild angehoben.");
    }
    // `touch.consumePress("KeyM")` bleibt stehen wie bei KeyZ und KeyU: Der
    // Span in `#menu-actions` traegt den Code, falls der Eintrag je wieder
    // gedrueckt wird. Der Menueknopf geht ueber seinen eigenen Klick.
    if (input.wasPressed("KeyM") || touch.consumePress("KeyM")) schalteMarkierungen();
    if (input.wasPressed("F3") || touch.consumePress("F3")) debug.toggle();
    if (input.wasPressed("KeyH")) {
      helpEl.style.display = helpEl.style.display === "none" ? "block" : "none";
    }
    // Abholung: steht ein beladener Container bereit, fährt er ab —
    // sonst öffnet die Bestellung, in der die Fraktion gewählt wird
    if (!BETRIEB && (input.wasPressed("Digit1") || touch.consumePress("Digit1"))) holeNachschub();
    // Lambert und Ausbau gibt es nur im Betrieb (E-118); die Abholung seit
    // E-120 auch im Sandkasten — dort ohne Fraktionswahl, es gibt kein Geld.
    if (!challenge && (input.wasPressed("KeyV") || touch.consumePress("KeyV"))) {
      if (vehicles.pickupTruck?.waitingForLoad) {
        vehicles.requestPickup();
        hud.toast("Container geht raus …");
      } else if (vehicles.abholungVorgemerkt) {
        hud.toast("Die Abholung ist schon vorgemerkt und fährt als nächstes vor.");
      } else if (BETRIEB) {
        // Auch bei belegtem Platz bestellbar: Die Abholung hat Vorrang und
        // wird vorgemerkt, statt an einem laufenden Anlieferer zu scheitern.
        showPickup(true);
      } else {
        hud.toast(
          vehicles.requestPickup(null) === "vorgemerkt"
            ? "Abholer vorgemerkt — er kommt, sobald die Fuhre weg ist."
            : "Abholer kommt leer — voll fährt er von selbst los."
        );
      }
    }
    /*
     * Lambert rufen (Ansage 13.09.2026: „ich rufe Lambert, wenn voll, er
     * kippt hinten in Silos"). Er kommt von der Ostseite, raeumt die
     * Sortierboxen leer und faehrt das Material zu der Mulde seiner Fraktion
     * an der Ostwand. Von sich aus kommt er nicht mehr.
     */
    if (BETRIEB && (input.wasPressed("KeyY") || touch.consumePress("KeyY"))) {
      const antwort = staff.rufeLambert();
      hud.toast(
        antwort === "kommt"
          ? "Lambert kommt und räumt die Boxen leer."
          : antwort === "schon unterwegs"
            ? "Lambert ist schon dabei."
            : "Lambert winkt ab — in den Boxen liegt nichts für ihn."
      );
    }
    // Zur Waage schicken: Reste auf der Flaeche zaehlen dort als Tara
    if (input.wasPressed("KeyJ") || touch.consumePress("KeyJ")) {
      const r = vehicles.zurWaage();
      if (r === "geschickt") hud.toast("Der Fahrer faehrt zur Waage.");
      else hud.toast("Gerade ist kein Fahrzeug auf dem Platz.");
    }
    if (BETRIEB && (input.wasPressed("KeyZ") || touch.consumePress("KeyZ"))) zeigeAusbau();
    if (input.wasPressed("KeyU") || touch.consumePress("KeyU")) {
      hud.toast(radioWeiter(audio));
    }
    if (!challenge && input.wasPressed("KeyK")) {
      hud.toast(storeSave(buildSaveData()) ? "Gespeichert." : "Speichern fehlgeschlagen!");
    }
    if (input.wasPressed("KeyB") || touch.consumePress("KeyB")) {
      // Challenge: erst pressen, wenn das Wrack losgelassen in der Kammer ist (E-125)
      if (challenge && !challenge.pressenErlaubt()) {
        hud.toast("Erst das Wrack in die Kammer legen und loslassen — dann SCHERE.");
      } else if (!press.start()) hud.toast("Presse läuft bereits …");
    }
    if (input.wasPressed("KeyL")) {
      location.reload(); // Boot lädt den letzten Stand
    }
    if (!challenge && input.wasPressed("KeyN")) {
      clearSave();
      location.reload();
    }
    excavator.handleDiscreteInput(input); // Mausrad-Rotator, einmal pro Frame

    accumulator += frameDt;
    let steps = 0;
    let mischImSchritt = 0;
    // Reine Arbeitszeit messen, nicht den Bildabstand: Safari synchronisiert auf
    // 60 Hz und faellt auf glatte 30 zurueck, sobald 16,7 ms nicht reichen.
    // frameDt zeigt dann 34,0 ms, egal ob die Arbeit 18 oder 33 ms dauert —
    // jede Verbesserung bliebe unsichtbar, bis sie die Schwelle unterbietet.
    const tPhysik = performance.now();
    // Alles vor dem ersten Schritt: Eingaben, Tastenbefehle, Menues
    msVor = tPhysik - now;
    while (autoStep && accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      stepOnce();
      accumulator -= FIXED_DT;
      /*
       * Schrottlage ins Bild schreiben — bewusst IM Schritt, nicht danach.
       * Das Zwischenbild erfasst hier den Stand; laege syncMeshes hinter der
       * Schleife, waere der erfasste Stand der Teile einen Schritt aelter als
       * der der Maschine, und die Ladung haenge sichtbar hinter den Krallen
       * her. Bei 0 Schritten bewegt sich nichts, dann faellt auch nichts aus.
       */
      items.syncMeshes();
      // Was in der Spinne haengt, muss mitgemischt werden — loser Schrott nicht
      gegriffeneNetze.length = 0;
      for (const b of grip.grippedBodies) {
        const it = items.itemByBody(b);
        if (it) gegriffeneNetze.push(it.mesh);
      }
      zwischenbild.zeitweise(gegriffeneNetze);
      // Nach jedem Schritt erfassen, nicht nur am Frame-Ende: Faellt ein
      // Doppelschritt an, ist der Vorzustand der vorletzte Schritt — sonst
      // waere die Mischstrecke doppelt so lang wie das Zeitfenster.
      const tErfasse = performance.now();
      zwischenbild.erfasse();
      mischImSchritt += performance.now() - tErfasse;
      steps++;
    }
    // Das Erfassen gehoert zur Bildinterpolation, nicht zur Physik — sonst
    // waere die Physikzeile im Overlay nicht mehr mit frueheren Messungen
    // vergleichbar.
    msPhysik = performance.now() - tPhysik - mischImSchritt;
    if (steps === MAX_STEPS_PER_FRAME) accumulator = 0;

    excavator.setFirstPerson(orbit.mode === "cabin"); // Ego-Sicht: nur die eigenen Unterarme
    /*
     * Zwischenbild: Der Rest im Akkumulator sagt, wie weit das Bild zwischen
     * den beiden letzten Physikschritten steht. Ohne das Mischen rueckt bei
     * 48 Hz jedes vierte Bild die doppelte Strecke vor (Muster 2,1,1,1) —
     * Patricks "zwei schnelle Bilder hintereinander" vom 14.09.2026.
     *
     * Reihenfolge: erst mischen, dann die Weltmatrizen frisch rechnen (die
     * Kabinenkamera haengt am gezeichneten Augpunkt), dann die Kamera, dann
     * zeichnen, dann alles auf den gerechneten Stand zurueck.
     */
    const tMisch = performance.now();
    msMisch = mischImSchritt;
    zwischenbild.zeichne(accumulator / FIXED_DT);
    /*
     * Nur in der Kabinenansicht: Der Augpunkt des Fahrers steckt in den
     * Weltmatrizen des Baggers, also muessen die vor der Kamera frisch sein.
     * Die Aussenansichten zielen auf `root.position` und brauchen das nicht —
     * das spart einen Matrix-Durchlauf (gemessen 47 us je Durchlauf ueber die
     * 336 Knoten der Maschine, 14.09.2026).
     */
    if (orbit.mode === "cabin") excavator.root.updateMatrixWorld(true);
    msMisch += performance.now() - tMisch;
    orbit.update(
      frameDt,
      input,
      (out) => excavator.getCameraTarget(out),
      (out) => {
        excavator.getCabinEye(out);
        return excavator.cabinBaseYaw;
      }
    );
    const tBild = performance.now();
    renderer.render(scene, orbit.camera);
    msBild = performance.now() - tBild;
    const tZurueck = performance.now();
    zwischenbild.zurueck();
    zwischenbild.weltmatrizen();
    msMisch += performance.now() - tZurueck;
    const tLogik = performance.now();

    // --- HUD, Highlight, Ampel, Audio (pro Render-Frame) ---
    excavator.getSensorPosition(sensorPos);
    // Der Bodenring bekommt dasselbe Urteil wie die Griff-Info: die Ampel der
    // Mulde darunter, sonst die Fraktionsfarbe des anvisierten Teils.
    let ringAmpel: AmpelState | null = null;
    let ringItem: ScrapItem | null = null;
    if (grip.grippedCount > 0) {
      items.setHighlight(null);
      const carried = grip.grippedBodies
        .map((b) => items.itemByBody(b))
        .filter((i): i is NonNullable<typeof i> => !!i);
      const hover = containers.updateHover(
        sensorPos.x,
        sensorPos.z,
        carried.map((i) => i.materialId)
      );
      ringAmpel = hover?.ampel ?? null;
      hud.showCarry(carried, hover);
    } else {
      containers.updateHover(sensorPos.x, sensorPos.z, []);
      const tearing = grip.tearing;
      if (tearing) {
        items.setHighlight(null);
        hud.showTearing(tearing.name, tearing.progress01);
      } else if (excavator.closure < 0.3) {
        const part = composites.findPartNear(sensorPos);
        if (part) {
          items.setHighlight(null);
          hud.showPartHint(part.name);
        } else {
          const target = items.findNearest(sensorPos, 1.2);
          items.setHighlight(target);
          ringItem = target;
          hud.showTarget(target);
        }
      } else {
        items.setHighlight(null);
        hud.showClosedEmpty();
      }
    }
    aimRing.update({
      world: physics.world,
      sensorPos,
      splay: excavator.splay,
      selfHandles: excavator.selfHandles,
      grippedHandles: excavator.grippedHandles,
      hoverItem: ringItem,
      ampel: ringAmpel,
      dt: frameDt,
    });

    looseTimer += frameDt;
    if (looseTimer > 0.25) {
      looseKg = measureLoose();
      looseTimer = 0;
    }
    daylight.update(frameDt);
    /*
     * Platzinventar kommt am naechsten Tag wieder (E-031, Ansage Patrick
     * 15.09.2026: „wie auch der Besen ist es ein fester Bestandteil des
     * Platzes und erscheint am naechsten Tag wieder").
     *
     * Die Gattung, das Nachlegen und der Tageszaehler sind in `scrapItems.ts`
     * und `daylight.ts` gebaut; hier haengen sie zusammen. Ohne diese drei
     * Zeilen kommt nichts zurueck — der Besen waere nach dem ersten
     * Missgeschick fuer immer weg.
     *
     * Einen anderen sauberen Tagesanfang gibt es nicht: `Shift` kennt kein
     * Tageskonzept, der einzige echte Wechsel ist der Umlauf der Uhr um
     * Mitternacht. Solange der Wirtschaftskreislauf zurueckgestellt ist
     * (Ansage 15.09.), bleibt es dabei.
     */
    if (daylight.neuerTag) {
      daylight.neuerTag = false;
      const nachgelegt = items.inventarNachtragen();
      if (nachgelegt.length) hud.toast(`${nachgelegt.join(", ")} liegt wieder auf dem Platz`);
    }
    floodlights.update(daylight.daylight);
    // Kleinkram zusammenfassen, bevor die Teilezahl die Bildrate drückt
    verdichtungsTimer += frameDt;
    if (verdichtungsTimer > 4) {
      verdichtungsTimer = 0;
      const gespart = items.consolidate();
      if (gespart > 0) hud.toast(`${gespart} Kleinteile zu Bündeln zusammengefasst`);
    }
    lanes.update(frameDt);
    /*
     * Tagesablauf, Feierabend, Funk, Tutorial, Kasse und Fahrspur-Meldung
     * gibt es nur im Betrieb (E-118). Im Simulator laeuft keine Uhr ab; die
     * Fuhren kommen nach dem Takt im else-Zweig unten (E-122).
     */
    if (BETRIEB) {
      // Störfall nur beim Wechsel melden, nicht in Dauerschleife
      if (lanes.blocked !== stoerfallGemeldet) {
        stoerfallGemeldet = lanes.blocked;
        hud.toast(lanes.blocked ? lanes.message + " — freiräumen!" : "Fahrspur wieder frei.");
      }
      /*
       * Hier wird zugestellt — auch fuer Mario und Janine. Ihre Sprueche warten
       * 3,5 s auf ihren Anlass, damit sie die Maschinenmeldung nicht
       * ueberschreiben; ohne diesen Aufruf kaeme keiner davon je an.
       */
      funk.platzlage({
        loseKg: looseKg,
        spurBlockiert: lanes.blocked,
        lambertArbeitet: staff.lambertArbeitet,
      });
      if (
        tutorial.update(frameDt, {
          verhandeltGerade: haggleEl.classList.contains("open"),
          preisVereinbart: tutPreis,
          looseKg,
          sortiertKg: tutSortiertKg,
          gepresst: tutGepresst,
          abholerBestellt: tutAbholer,
          turnoverKg: shift.turnoverKg,
        })
      ) {
        zeigeTutorial();
      }
      shift.update(frameDt, looseKg, daylight.time);
      abrechnung.takt();
      // Zahlungsdruck: Wer die Ware nicht bezahlen kann, bekommt keine mehr.
      // Erst wenn wieder Geld hereinkommt, liefern die Händler weiter.
      vehicles.acceptDeliveries = shift.acceptsDeliveries && account.canBuy;
      if (!account.canBuy !== zahlungsUnfaehig) {
        zahlungsUnfaehig = !account.canBuy;
        if (zahlungsUnfaehig) {
          hud.toast("Konto leer — es liefert niemand mehr. Erst verkaufen, dann ankaufen!");
        } else {
          hud.toast("Wieder zahlungsfähig — die Händler kommen zurück.");
        }
      }
      vehicles.intervalFactor = shift.intervalFactor(looseKg);
      /*
       * Und dieselbe Lage noch einmal als STEHENDE Zeile (E-081).
       *
       * Der Toast oben meldet den Wechsel und ist nach 2,6 s weg — der Zustand
       * bleibt. „Platz dicht" steht seit jeher im Tagesablauf; die Zahlungslage
       * steht ab hier daneben, in derselben Zeile und mit denselben Mitteln.
       * Entschieden wird sie hier, aus denselben zwei Fragen, die auch die
       * Einfahrt oben aufmachen oder zumachen — das HUD bekommt nur das Wort.
       */
      const kassenlage: Zahlungslage = !account.canBuy
        ? "leer"
        : account.lowOnCash
          ? "knapp"
          : "ok";
      hud.updateShift(
        `${daylight.clock} · ${shift.statusText(looseKg)}`,
        shift.jammed,
        kassenlage
      );
    } else if (challenge) {
      // Challenge (E-125): keine Anlieferer, die Uhr der Aufgabe laeuft
      challenge.takt(frameDt);
    } else {
      /*
       * SANDKASTEN: DIE ANLIEFERER KOMMEN WIEDER VON SELBST (E-122, Patrick
       * 06.10.2026: "LKWs kommen automatisch"). Derselbe Takt wie im Betrieb:
       * Wartezeit nach losem Schrott (`shift.intervalFactor`), Einfahrt zu ab
       * `JAM_KG` bis unter `JAM_CLEAR_KG`. OHNE Tageszeit — sonst schloesse
       * um 17:00 das Tor, und im Sandkasten macht kein Feierabend es wieder
       * auf. Ohne Kasse — es gibt kein Geld, also kein "Konto leer".
       */
      shift.update(frameDt, looseKg);
      vehicles.acceptDeliveries = !shift.jammed;
      vehicles.intervalFactor = shift.intervalFactor(looseKg);
    }
    excavator.updateInstruments(frameDt);
    containers.updateLabels(orbit.camera.position);
    // Bewegliche Behaelter sind Hindernisse wie jedes Bauwerk — nur wandern
    // sie, also melden sie sich jedes Bild neu.
    setBuildingObstacles(containers.hindernisse());

    // Wartet ein Abholer, zählt nur eins: wie sortenrein ist die Ladung?
    // Daran hängt der Erlös, also gehört es laufend ins Bild.
    const abholer = vehicles.pickupTruck;
    if (abholer?.waitingForLoad) {
      ladungTakt -= frameDt;
      if (ladungTakt <= 0) {
        ladungTakt = LADUNG_TAKT_S;
        const geladen = abholer.containedItems(items);
        const nachMaterial = new Map<string, number>();
        let gesamt = 0;
        for (const it of geladen) {
          for (const c of it.composition ?? [{ materialId: it.materialId, massKg: it.massKg }]) {
            nachMaterial.set(c.materialId, (nachMaterial.get(c.materialId) ?? 0) + c.massKg);
            gesamt += c.massKg;
          }
        }
        const bestellt = vehicles.pickupOrder;
        const passend = bestellt
          ? nachMaterial.get(bestellt) ?? 0
          : Math.max(0, ...nachMaterial.values());
        hud.updateLoad(gesamt, gesamt > 0 ? passend / gesamt : 1, bestellt);
      }
    } else {
      // Faehrt gerade keiner vor, rechnet niemand — und der naechste Abholer
      // soll sofort eine Zahl sehen, nicht erst nach einer Viertelsekunde.
      ladungTakt = 0;
      hud.updateLoad(null, 1, null);
    }
    if (BETRIEB) {
      hud.updateMoney(account.moneyEur, containers.totalValue());
    }
    audio.updateEngine(excavator.activity, Math.min(grip.totalMassKg / 2000, 1));
    // Platzkulisse: Wind, ferne Schlaege, Flex, Kraehen — und der
    // Rueckfahrwarner, solange ein LKW rangiert.
    audio.tickUmgebung(frameDt);
    audio.setRueckfahrwarner(vehicles.maneuveringTruck() !== null);

    // Bodenkontakt: Kratzen + Staub, bei hoher Intensität Funken (Kap. 6.1)
    frameCount++;
    particles.update(frameDt);
    const gc = excavator.groundContact;
    if (gc.active && gc.intensity > 0.03) {
      if (frameCount % 3 === 0) particles.spawn(gc.point, 2, 0x9a8b74, 0.9, 0.9, 0.6);
      if (gc.intensity > 0.45 && frameCount % 4 === 0) {
        particles.spawn(gc.point, 3, 0xffc060, 3.5, 1.8, 0.4);
      }
    }
    /*
     * Kehren (E-121): Das Tempo kommt aus dem Weg der Spinne je Bild — so
     * zaehlt auch das Ziehen mit dem Stiel, nicht nur Drehen und Fahren.
     * Ueber Schrott schleift sie, wenn sie keinen tragenden Grund hat, aber
     * leer durch lose Teile gezogen wird.
     */
    excavator.getSensorPosition(kehrJetzt);
    const dtSicher = Math.max(frameDt, 1e-3);
    // SW: 1,5 m/s Spinnenweg = volles Schleifen
    const kehrTempo = Math.min(1, Math.hypot(kehrJetzt.x - kehrVorher.x, kehrJetzt.z - kehrVorher.z) / dtSicher / 1.5);
    kehrVorher.copy(kehrJetzt);
    if (gc.active && Math.max(gc.intensity, kehrTempo) > 0.03) {
      audio.setScrape(Math.max(gc.intensity, kehrTempo), stahlGrund(gc.point.x, gc.point.y, gc.point.z) ? "stahl" : "beton");
    } else if (
      !gc.active &&
      kehrTempo > 0.03 &&
      grip.grippedCount === 0 &&
      // ponytail: Naehe der Teilmitte (0,8 m) statt echter Kontakt; Kontaktabfrage, falls es in der Luft klappert
      items.items.some((i) => {
        const p = i.body.translation();
        return Math.abs(p.x - kehrJetzt.x) < 0.8 && Math.abs(p.z - kehrJetzt.z) < 0.8 && Math.abs(p.y - kehrJetzt.y) < 0.8;
      })
    ) {
      audio.setScrape(kehrTempo, "schrott");
    } else {
      audio.setScrape(0);
    }
    // Greifen (E-121): Schalenfahrt (0,4 s = voller Weg) und Schliesskraft
    const schalenTempo = Math.min(1, (Math.abs(excavator.closure - schalenVorher) / dtSicher) * 0.4);
    schalenVorher = excavator.closure;
    audio.setGreifer(schalenTempo, excavator.schliesskraftKN / Excavator.MAX_SCHLIESSKRAFT_KN);

    /*
     * Messpunkt fuer das offene Raetsel vom 14.09.2026: Frame 21,0 ms, davon
     * nur 6,4 ms Arbeit. Hier endet alles, was diese Schleife selbst tut —
     * was im Frame darueber hinaus vergeht, liegt zwischen den Bildern
     * (Bildsynchronisation, Browser, Verbund der Grafikschicht).
     */
    /*
     * Zaehlen nur, wenn das Overlay auch hinschaut (Befund 14.09.2026):
     * `physics.counts()` laeuft ueber alle Koerper der Welt, und zwar bisher in
     * jedem Bild — obwohl die Zahlen ausschliesslich im F3-Overlay stehen, das
     * viermal je Sekunde schreibt und im Spiel fast immer aus ist.
     */
    const counts = debug.visible ? physics.counts() : LEERE_ZAEHLUNG;
    msLogik = performance.now() - tLogik;
    debug.update(frameDt, {
      bodies: counts.bodies,
      awake: counts.awake,
      dynamic: counts.dynamic,
      dynAwake: counts.dynAwake,
      gripped: grip.grippedCount,
      grippedKg: grip.totalMassKg,
      calls: renderer.info.render.calls,
      tris: renderer.info.render.triangles,
      audio: audio.diagnostics,
      lambert: {
        taetigkeit: staff.taetigkeit,
        geweckteProMinute: staff.geweckteProMinute,
      },
      msPhysik,
      msBild,
      msMisch,
      msVor,
      msLogik,
    });

    input.endFrame();
    requestAnimationFrame(frame);
  }
  challenge?.start();
  if (!BETRIEB && !challenge) hud.toast("Sandkasten: Der Platz gehört dir. Die Laster kommen von selbst — NACHSCHUB holt sofort einen.");
  requestAnimationFrame(frame);
}

main().catch((err) => {
  console.error("Startfehler:", err);
  const el = document.getElementById("loading");
  if (el) el.textContent = "Fehler beim Start — Konsole prüfen.";
});
