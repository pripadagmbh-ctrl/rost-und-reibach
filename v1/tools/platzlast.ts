/**
 * Physik-Budget des gebauten Platzes: Wie viele Koerper, wie lange ein
 * Rechenschritt, und kommt der Haufen zur Ruhe?
 *
 * Gebaut am 14.09.2026 zum Platzumbau (E-010). Der Platz ist auf dem Dev-PC
 * (Intel HD 5500) mit 30 Bildern je Sekunde und ruhigem Haufen gelaufen; was
 * dazukommt, muss gemessen werden. Ein Haufen, der nicht mehr einschlaeft, ist
 * ein Blocker — dann rechnet die Physik in jedem Bild weiter, auch wenn sich
 * nichts bewegt.
 *
 * Gemessen wird ohne Bild: Rapier rechnet hier genauso wie im Spiel, nur der
 * Renderer fehlt. Die Millisekunden sind deshalb PHYSIK-Zeit, nicht Bildzeit.
 *
 * Aufruf: npx vite-node tools/platzlast.ts
 *
 * SPIEL=1 (E-135): wie `main.ts` — erst `items.settle()`, dann in jedem
 * Schritt `clampSpeeds` und das gemeinsame Einschlafen (`settleSleep`). Ohne
 * das misst das Werkzeug nur Rapiers eigenen Schlaf, und den gibt es im Spiel
 * so nicht. LAEUFE=n wiederholt den ganzen Aufbau n-mal (der Haufen wird jedes
 * Mal neu gewuerfelt) und zaehlt, wie oft er zur Ruhe kommt.
 */
import * as THREE from "three";
/*
 * Eigene Leinwand-Attrappe statt `leinwand-attrappe.ts`.
 *
 * Die dortige verwirft jeden Zeichenbefehl und liefert `undefined` zurueck.
 * Der Platzboden braucht aber ein Rueckgabeobjekt: Er legt einen
 * Farbverlauf an und ruft darauf `addColorStop`. Diese hier gibt deshalb fuer
 * jeden Aufruf wieder eine Attrappe zurueck. Sie steht hier und nicht dort,
 * weil die gemeinsame Attrappe am Bagger haengt und dieses Werkzeug nicht in
 * ihren Vertrag hineinregieren soll.
 */
function leinwandAttrappe(): void {
  if (typeof (globalThis as Record<string, unknown>).document !== "undefined") return;
  const attrappe = (): unknown =>
    new Proxy(
      {},
      {
        get: (ziel: Record<string, unknown>, feld: string) =>
          feld in ziel ? ziel[feld] : attrappe,
        set: (ziel: Record<string, unknown>, feld: string, wert: unknown) => {
          ziel[feld] = wert;
          return true;
        },
      }
    );
  const ctx = attrappe() as Record<string, unknown>;
  ctx.measureText = (): { width: number } => ({ width: 0 });
  // Das Storchennest flattert im Bildtakt; ohne Bild gibt es keinen.
  (globalThis as Record<string, unknown>).requestAnimationFrame = (): number => 0;
  (globalThis as Record<string, unknown>).document = {
    createElement: (): unknown => ({
      width: 0,
      height: 0,
      getContext: () => ctx,
      toDataURL: () => "",
      style: {},
    }),
  };
}
import { initPhysics, PhysicsWorld } from "../src/physics/physicsWorld";
import { Yard } from "../src/world/yard";
import { ContainerManager } from "../src/world/containers";
import { ItemManager, randomCargo } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { WRACKDATEN } from "../src/dismantle/carDef";
import { PressManager } from "../src/world/press";
import { OfficeBuilding } from "../src/world/office";
import { START_HAUFEN, START_AUTOS, START_STREU, START_LKW } from "../src/world/startplatz";
import { EventBus } from "../src/core/events";

async function main(): Promise<void> {
  leinwandAttrappe();
  await initPhysics();
  const laeufe = Number(process.env.LAEUFE ?? 1);
  let ruhig = 0;
  for (let l = 0; l < laeufe; l++) if (await lauf()) ruhig++;
  if (laeufe > 1) console.log(`ZUSAMMEN: ${ruhig} von ${laeufe} Laeufen kommen zur Ruhe.`);
}

/** Ein Aufbau samt Messung; true = der Platz ist eingeschlafen. */
async function lauf(): Promise<boolean> {
  const scene = new THREE.Scene();
  /*
   * Die Welt des Spiels, nicht eine eigene: Die Kontaktwerte stehen in
   * `PhysicsWorld` (Messung 10.09.2026), und mit Rapier-Standardwerten misst
   * man eine andere Physik als die, die auf dem iPad laeuft.
   */
  const phys = new PhysicsWorld();
  const world = phys.world;

  const t0 = Date.now();
  new Yard(scene, world);
  new OfficeBuilding(scene, world);
  const items = new ItemManager(scene, world);
  const bus = new EventBus();
  // EventBus als viertes Argument — fehlte bis 15.09.2026 (E-038).
  const composites = new CompositeManager(scene, world, items, bus);
  new ContainerManager(scene, world, bus);
  new PressManager(scene, world, items, composites);
  const bauzeit = Date.now() - t0;

  const statisch = world.colliders.len();
  console.log(`Aufbau: ${bauzeit} ms, ${statisch} Kollider, ${world.bodies.len()} Koerper`);

  /*
   * Der Starthaufen, wie ihn `main.ts` setzt.
   *
   * Mit `ALT=1` liegt er stattdessen auf der Stelle von gestern (6,2 | −19,0),
   * auf freier Flaeche ohne Wand ringsum. Das ist die Vergleichsmessung: Ohne
   * sie weiss man nicht, ob ein unruhiger Haufen an der neuen Ausbuchtung
   * liegt oder ob 85 fallengelassene Teile sich immer so verhalten.
   */
  const alt = process.env.ALT === "1";
  const mitte = alt
    ? { x: 6.2, z: -19.0, streuung: 2.9 }
    : {
        x: Number(process.env.HX ?? START_HAUFEN.x),
        z: Number(process.env.HZ ?? START_HAUFEN.z),
        streuung: Number(process.env.HS ?? START_HAUFEN.streuung),
      };
  console.log(
    alt ? "Vergleich: Haufen auf der alten Stelle (6,2 | -19,0)" : "Haufen auf der neuen Stelle"
  );
  items.spawnPile(
    new THREE.Vector3(mitte.x, 0, mitte.z),
    START_HAUFEN.teile,
    mitte.streuung
  );
  /* Im Vergleichslauf auch die Wracks von gestern, sonst vergleicht man Aepfel mit Birnen. */
  const autos = alt ? [{ x: 3.6, z: -18.0 }, { x: 8.8, z: -19.0 }] : START_AUTOS;
  /*
   * Seit E-116 gibt es vier Karosserieformen (`WRACKFORM=a|b|c`). Die Physik
   * darf sich davon nicht ruehren: Der Kollider ist in allen Fassungen derselbe
   * Quader, und ein Wrack bleibt ein Koerper. Genau das wird hier nachgemessen,
   * statt es zu behaupten.
   */
  const form = process.env.WRACKFORM;
  if (form === "a" || form === "b" || form === "c") composites.zeigeForm(form);
  console.log(`Karosserieform: ${form ?? "bestand"}`);
  if (process.env.OHNEAUTOS !== "1")
    for (const a of autos) composites.spawnCar(new THREE.Vector3(a.x, 0.5, a.z));
  // E-135: das LKW-Wrack wie in `main.ts` (OHNELKW=1 laesst es weg)
  if (!alt && process.env.OHNELKW !== "1")
    composites.spawnCar(new THREE.Vector3(START_LKW.x, 0.5, START_LKW.z), "lkw", START_LKW.gier);
  randomCargo(START_STREU.teile).forEach((sp, i) => {
    const w = (i / START_STREU.teile) * Math.PI * 2;
    items.spawnScrap(
      sp.materialId,
      sp.massKg,
      sp.shape,
      new THREE.Vector3(
        mitte.x + Math.cos(w) * mitte.streuung,
        1.2,
        mitte.z + Math.sin(w) * mitte.streuung
      )
    );
  });
  console.log(`Nach dem Starthaufen: ${world.bodies.len()} Koerper, ${items.items.length} Teile`);
  const spiel = process.env.SPIEL === "1";
  if (spiel) items.settle(world);
  /*
   * WECKEN=1: nach dem Setzen alles wecken — so, wie es die Spinne tut, wenn
   * sie in den Haufen greift. `settle` legt am Ende alles schlafen; ob der
   * Haufen von SELBST wieder einschlaeft, zeigt erst das.
   */
  if (process.env.WECKEN === "1") world.bodies.forEach((b) => b.isDynamic() && b.wakeUp());
  /*
   * AUSWEIDEN=1 (E-185): der schlimmste Fall fuer die Zerlegung — an jedem
   * Wrack auf dem Platz geht ALLES ab, was abgehen kann (Pkw: Haube,
   * Batterie, Kuehler, Motor, Raeder; LKW und Wohnwagen ihre Teile), mit
   * demselben kleinen Stoss wie beim Biss (40 N·s quer, 40 hoch). Danach
   * zaehlt, ob der Platz mit allen losen Teilen wieder einschlaeft.
   */
  if (process.env.AUSWEIDEN === "1") {
    let ab = 0;
    for (const car of composites.cars) {
      for (const p of WRACKDATEN[car.art].parts) {
        const b = car.tearPart(p.id);
        if (!b) continue;
        ab++;
        const t = b.translation();
        const c = car.body.translation();
        const r = Math.hypot(t.x - c.x, t.z - c.z) || 1;
        b.applyImpulse({ x: ((t.x - c.x) / r) * 40, y: 40, z: ((t.z - c.z) / r) * 40 }, true);
      }
    }
    console.log(`Ausgeweidet: ${ab} Teile abgerissen, jetzt ${world.bodies.len()} Koerper`);
  }

  const dt = 1 / 60;
  let ruheAb = -1;
  let summe = 0;
  let gezaehlt = 0;
  let spitze = 0;
  const SCHRITTE = Number(process.env.SCHRITTE ?? 1800); // 30 Sekunden Spielzeit
  /*
   * Die ersten sechzig Schritte zaehlen nicht mit. Der allererste kostet ueber
   * 140 ms — das ist die WASM-Aufwaermrunde und nicht die Last des Platzes.
   * Wer sie mittelt, misst den Start und nicht den Betrieb.
   */
  const AUFWAERMEN = 60;
  for (let i = 0; i < SCHRITTE; i++) {
    const a = Date.now();
    items.clampSpeeds(dt);
    phys.step();
    if (spiel) {
      items.settleSleep(dt);
      composites.update();
    }
    const ms = Date.now() - a;
    if (i >= AUFWAERMEN) {
      summe += ms;
      gezaehlt++;
      spitze = Math.max(spitze, ms);
    }
    const { dynAwake: wach } = phys.counts();
    if (wach === 0 && ruheAb < 0) ruheAb = i;
    if (i % 150 === 0 || i === SCHRITTE - 1) {
      const c = phys.counts();
      console.log(
        `  Schritt ${String(i).padStart(3)}: ${c.dynAwake} von ${c.dynamic} dynamischen wach ` +
          `(${c.bodies} Koerper), ${ms} ms`
      );
    }
  }
  console.log(
    `Physik je Schritt (ohne die ersten ${AUFWAERMEN}): ` +
      `${(summe / gezaehlt).toFixed(2)} ms im Mittel, ${spitze} ms Spitze`
  );
  console.log(
    ruheAb >= 0
      ? `Der Haufen liegt ruhig ab Schritt ${ruheAb} (${(ruheAb / 60).toFixed(1)} s).`
      : `ACHTUNG: Der Haufen kommt in ${SCHRITTE} Schritten nicht zur Ruhe.`
  );
  /*
   * Wer wach bleibt, wird beim Namen genannt. Ein Haufen schlaeft nicht ein,
   * wenn ein einziger Koerper in einer Wand steckt und dagegendrueckt — und
   * den findet man nur ueber seinen Ort.
   */
  if (ruheAb < 0) {
    const wach: Array<{ x: number; y: number; z: number; v: number }> = [];
    world.bodies.forEach((b) => {
      if (!b.isDynamic() || b.isSleeping()) return;
      const p = b.translation();
      const lv = b.linvel();
      wach.push({ x: p.x, y: p.y, z: p.z, v: Math.hypot(lv.x, lv.y, lv.z) });
    });
    wach.sort((a, b) => b.v - a.v);
    console.log("  Wach geblieben (die zehn schnellsten):");
    for (const w of wach.slice(0, 10)) {
      console.log(
        `    (${w.x.toFixed(1)} | ${w.y.toFixed(2)} | ${w.z.toFixed(1)})  ` +
          `${w.v.toFixed(3)} m/s`
      );
    }
  }
  world.free();
  return ruheAb >= 0;
}

void main();
