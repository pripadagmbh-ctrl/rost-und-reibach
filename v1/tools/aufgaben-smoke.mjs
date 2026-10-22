/**
 * AUFGABEN-SMOKE (Auftrag Q1, 19.10.2026) — Aufgabe 1 im echten Browser.
 *
 * Startet den Dev-Server (Port 5199) und ein Chromium aus dem Playwright-
 * Vorrat (kein Playwright-Paket), redet per CDP (Node-24-WebSocket) mit ihm:
 *   1. Erststart mit leerem Speicher: Screenshots iPhone mini / iPad (Touch)
 *   2. Ladezeiten kalt/warm/gedrosselt, Erststart und Rueckfall-Neustart
 *   3. ↻ ohne Neuladen, 5x: Dauer, Koerper, Netze, Heap
 *   4. Zeichenrufe/Physik-ms (F3-Overlay) Aufgabe vs. Sandkasten
 *   5. Durchlauf Aufgabe 1 per Tasten + `__game.step`, Abschlusstafel, Menue
 *
 * Aufruf (in v1/):  node tools/aufgaben-smoke.mjs <Ausgabeordner>
 * Schalter (Umgebung): SMOKE_PORT (Vorgabe 5199), LAEUFE (3), SMOKE_NUR=durchlauf
 * (nur iPad-Bild + Durchlauf + Menue), SMOKE_NUR=aufgaben (Q2: je Aufgabe aus SMOKE_AUFGABE=id,id …,
 * Vorgabe 2-6, auf mini und iPad: Erstbild, Projektion der Marken, F3, ↻ Bus + Finger, Geisterdaumen-Probe; ~10 min), SMOKE_ANGLE (d3d11 | swiftshader), SMOKE_SPUR=1 (CDP-Aufrufe zeigen).
 * SMOKE_NUR=lehrgang (Q4, E-197): der EINE Lehrgang (9 Schritte) per Touch, SMOKE_GERAET=mini|ipad|mini1:
 * Erststart ohne Menue, je Schritt Vorfuehrung beobachten (Startlage), sichtbaren Text gegen die Mittelzone
 * pruefen, nachmachen (aus der Spur abgeleitet, NACHAHMUNG), Erfolgsbild; nach Schritt 5 neu laden
 * (Wiedereinstieg), Tafel, ZUR PRUEFUNG 1; dann frischer Speicher: ⏭ → ✕, ⏭ → ✓, Menue.
 * Je Geraet einen eigenen Aufruf: Im selben Browser bekam das zweite Geraet keinen WebGL-Kontext mehr.
 * Dauer: rund 12 min (Ladezeiten 12 Seiten, Durchlauf ~1 min).
 * Ergebnis: <Ausgabeordner>/aufgaben-smoke.json + PNGs. Liest nur, schreibt nichts im Spiel.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const V1 = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AUS = resolve(process.argv[2] ?? join(tmpdir(), "aufgaben-smoke"));
mkdirSync(AUS, { recursive: true });
// 5199 laut Auftrag; belegt (fremder Dev-Server auf ::1) -> SMOKE_PORT setzen
const PORT = Number(process.env.SMOKE_PORT ?? 5199);
const BASIS = `http://127.0.0.1:${PORT}/`;
const LAEUFE = Number(process.env.LAEUFE ?? 3); // Auftrag: 3 Laeufe je Bedingung
/** 41-Q: Ergebnisdatei je Lauf (mehrere Geraete in einen Ordner) */
const ERGEBNIS_DATEI = process.env.SMOKE_JSON ?? "aufgaben-smoke.json";
const GERAETE = {
  mini: { width: 812, height: 375, deviceScaleFactor: 3, mobile: true },
  ipad: { width: 1180, height: 820, deviceScaleFactor: 2, mobile: true },
  // Q3: iPhone-mini-Format mit DPR 1 — nur um headless mehr Bilder je Sekunde zu bekommen (Vorfuehrung vs. Bildrate)
  mini1: { width: 812, height: 375, deviceScaleFactor: 1, mobile: true },
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const ergebnis = { datum: new Date().toISOString() };
const log = (...a) => console.log(...a);

/** Chromium aus dem Playwright-Vorrat — wie `tools/tonwerk/tonwerk.mjs`. */
function findeChromium() {
  const vorrat = join(homedir(), "AppData/Local/ms-playwright");
  const kandidaten = existsSync(vorrat)
    ? readdirSync(vorrat).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()
    : [];
  for (const d of kandidaten) {
    for (const unter of ["chrome-win64", "chrome-win"]) {
      const p = join(vorrat, d, unter, "chrome.exe");
      if (existsSync(p)) return p;
    }
  }
  throw new Error("Kein Chromium gefunden (ms-playwright).");
}

function toete(proc) {
  if (!proc?.pid) return;
  spawnSync("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
}

async function warteHttp(url, ms) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try {
      const r = await fetch(url);
      if (r.ok) return r;
    } catch {
      /* noch nicht da */
    }
    await pause(200);
  }
  throw new Error(`keine Antwort von ${url}`);
}

/* ---------------- CDP ---------------- */
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.offen = new Map();
    this.hoerer = [];
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id && this.offen.has(d.id)) {
        const { ok, nein } = this.offen.get(d.id);
        this.offen.delete(d.id);
        if (d.error) nein(new Error(`${d.error.message} ${d.error.data ?? ""}`));
        else ok(d.result);
      } else if (d.method) for (const h of this.hoerer) h(d);
    };
    // Verbindung weg: alle offenen Anfragen scheitern lassen, sonst haengt der Ablauf still
    ws.onclose = () => {
      for (const { nein } of this.offen.values()) nein(new Error("CDP-Verbindung geschlossen"));
      this.offen.clear();
    };
  }
  static verbinde(url) {
    return new Promise((ok, nein) => {
      const ws = new WebSocket(url);
      ws.onopen = () => ok(new Cdp(ws));
      ws.onerror = (e) => nein(e);
    });
  }
  send(method, params = {}, sessionId, fristMs = 300000) {
    if (process.env.SMOKE_SPUR) console.log("CDP", method);
    const id = ++this.id;
    if (this.ws.readyState !== 1) return Promise.reject(new Error("CDP-Verbindung geschlossen"));
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    // Jede Anfrage hat eine Frist (SW: 5 min, der Durchlauf ist die laengste) — nie still haengen
    return new Promise((ok, nein) => {
      const frist = setTimeout(() => {
        this.offen.delete(id);
        nein(new Error(`CDP-Frist: ${method}`));
      }, fristMs);
      this.offen.set(id, { ok: (v) => (clearTimeout(frist), ok(v)), nein: (e) => (clearTimeout(frist), nein(e)) });
    });
  }
}

/** Was in jede Seite vor ihrem ersten Skript kommt: Zeitmarken und Bus-Mitschrift. */
const VORSKRIPT = `(() => {
  const S = (window.__smoke = { log: [], karteMs: null, gameMs: null, fehler: [] });
  window.addEventListener("error", (e) => S.fehler.push(String(e.message)));
  window.addEventListener("unhandledrejection", (e) => S.fehler.push(String(e.reason)));
  // 41-Q: WebGL-Kontext verloren? (Shaderfehler mit leerem Log deuten darauf)
  S.kontext = []; window.addEventListener("webglcontextlost", () => S.kontext.push({ verloren: performance.now(), phase: S.phase }), true); window.addEventListener("webglcontextrestored", () => S.kontext.push({ zurueck: performance.now() }), true);
  const pruefe = () => {
    // 41-Q: In Pruefungen steht oben die Zielzeile (#zielzeile), die Karte #tutorial nur noch im Betrieb
    const k = document.getElementById("tutorial"), z = document.getElementById("zielzeile");
    if (S.karteMs === null && ((k && k.classList.contains("open")) || (z && !z.hidden))) {
      S.karteMs = -1;
      S.karteOffenMs = performance.now();
      requestAnimationFrame(() => requestAnimationFrame(() => { S.karteMs = performance.now(); }));
    }
    const m = document.getElementById("hauptmenue");
    if (!S.menueMs && m && m.classList.contains("open")) S.menueMs = performance.now();
  };
  const beobachte = () => {
    new MutationObserver(pruefe).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
    pruefe();
  };
  if (document.body) beobachte(); else document.addEventListener("DOMContentLoaded", beobachte);
  // 41-Q: Kamera (Flug) und laufende Pruefung abhoeren — nur das Prototyp-Objekt, das Verhalten bleibt gleich
  S.fluege = []; S.flugSpur = []; S.flugHalt = S.flugHalt ?? null; S.taktImFlug = 0; S.taktZahl = 0;
  import("/src/excavator/orbitCamera.ts").then((m) => {
    const P = m.OrbitCamera.prototype, u = P.update, ft = P.flugTakt, sf = P.starteFlug;
    P.update = function (...a) { window.__orbit = this; if (this.flug && !S.flugGesehen) S.flugGesehen = { t: performance.now(), blick: { ...this.blick } }; return u.apply(this, a); };
    P.starteFlug = function (...a) { window.__orbit = this; S.fluege.push({ t: performance.now(), teil: { ...a[0] }, ziel: { ...a[1] }, blick: { ...this.blick } }); return sf.apply(this, a); };
    // Bilder bei festen Flugzeiten: ab S.flugHalt steht die Flugzeit (dt 0), bis der Rauchtest weiterschaltet
    P.flugTakt = function (dt, gt) {
      if (S.flugHalt !== null && this.flug && this.flug.t >= S.flugHalt - 1e-9) dt = 0;
      const vor = this.flug ? this.flug.t : null, r = ft.call(this, dt, gt), c = this.camera.position, d = this.camera.getWorldDirection(c.clone());
      S.flugSpur.push({ w: performance.now(), n: S.n, dt, vor, nach: this.flug ? this.flug.t : null, pos: [c.x, c.y, c.z], dir: [d.x, d.y, d.z] });
      if (S.flugSpur.length > 400) S.flugSpur.shift();
      return r;
    };
  });
  import("/src/challenges/challenge.ts").then((m) => {
    const P = m.ChallengeLauf.prototype, t = P.takt;
    P.takt = function (...a) { S.lauf = this; S.taktZahl++; if (window.__orbit && window.__orbit.fliegt) S.taktImFlug++; return t.apply(this, a); };
  });
  const warte = setInterval(() => {
    const g = window.__game;
    if (!g) return;
    clearInterval(warte);
    S.gameMs = performance.now();
    for (const n of ["challenge:start", "challenge:schritt", "challenge:geschafft", "challenge:neustart", "challenge:vorschau", "challenge:pressen", "spiel:pause"])
      g.bus.on(n, (e) => S.log.push({ n, t: performance.now(), nr: e && e.nr, sterne: e && e.sterne }));
  }, 2);
})();`;

/** Zaehlung im Spiel — Koerper, Teile, Netze, Karte. */
const ZAEHLE = `(() => {
  const g = window.__game;
  let sc = g.excavator.root; while (sc.parent) sc = sc.parent;
  let netze = 0; sc.traverse((o) => { if (o.isMesh || o.isInstancedMesh) netze++; });
  const boiler = g.items.items.filter((i) => i.shape && i.shape.name === "Kupfer-Boiler");
  const w = g.physics.world;
  const c = g.physics.counts();
  return {
    items: g.items.items.length, boiler: boiler.length,
    boilerPos: boiler.map((b) => { const p = b.body.translation(); return [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)]; }),
    boilerBox: boiler.map((b) => b.containerId),
    koerper: c.bodies, wach: c.awake, beweglich: c.dynamic, kollider: w.colliders.len(), gelenke: w.impulseJoints.len(),
    wracks: g.composites.cars.length, netze, szeneKinder: sc.children.length,
    schritt: (window.__smoke.log.filter((e) => e.n === "challenge:schritt").at(-1) || {}).nr ?? null,
    uhr: document.getElementById("zz-uhr")?.textContent,
    titel: document.getElementById("zz-satz")?.textContent,
    karteOffen: !document.getElementById("zielzeile")?.hidden,
    gegriffen: g.grip.grippedCount,
    gierGrad: +(g.excavator.cabinBaseYaw * 180 / Math.PI).toFixed(1),
    heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
  };
})()`;

/** Rechtecke der Bedienelemente (CSS-px) fuer die Verdeckungsfrage. */
const LAGE = `(() => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), sichtbar: s.display !== "none" && s.visibility !== "hidden" && b.width > 0 }; };
  const geister = [...document.querySelectorAll("#geisterdaumen .geist")].map((e) => ({ klasse: e.className, pfeil: e.dataset.pfeil, ...r(e) }));
  return {
    bodyTouch: document.body.classList.contains("touch"),
    fenster: [innerWidth, innerHeight, devicePixelRatio],
    karte: r(document.getElementById("zielzeile")),
    karteText: document.getElementById("zielzeile")?.innerText,
    neuKnopf: r(document.getElementById("zz-neu")),
    geister,
    stickLinks: r(document.getElementById("zone-left")), stickRechts: r(document.getElementById("zone-right")),
    webgl: (() => { try { const c = document.createElement("canvas").getContext("webgl2"); const x = c.getExtension("WEBGL_debug_renderer_info"); return x ? c.getParameter(x.UNMASKED_RENDERER_WEBGL) : "?"; } catch (e) { return String(e); } })(),
  };
})()`;

/** Q2: Zustand fuer ↻-Vergleich — Koerper, Karte, Uhr, Greifer, Pratzen, Magnet. */
const ZUSTAND = `(() => {
  const g = window.__game, x = g.excavator, c = g.physics.counts();
  return { koerper: c.bodies, wach: c.awake, kollider: g.physics.world.colliders.len(), gelenke: g.physics.world.impulseJoints.len(),
    items: g.items.items.length, wracks: g.composites.cars.length,
    schritt: (window.__smoke.log.filter((e) => e.n === "challenge:schritt").at(-1) || {}).nr ?? null, uhr: document.getElementById("zz-uhr")?.textContent,
    karteText: document.getElementById("zielzeile")?.innerText.replace(/\\n+/g, " | "),
    greifer: x.form && (x.form.id ?? x.form.name), magnetForm: !!(x.form && x.form.magnet), magnetAn: x.magnetAn,
    schliessung: +x.closure.toFixed(3), gierGrad: +(x.cabinBaseYaw * 180 / Math.PI).toFixed(2),
    abgestuetzt: x.abgestuetzt, pratzeUnten: +x.outriggerDown.toFixed(2), pratzeSoll: x.outriggerTarget, gegriffen: g.grip.grippedCount,
    heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
    nan: [x.position.x, x.position.y, x.position.z, x.cabinBaseYaw, x.closure].some((v) => !Number.isFinite(v)) };
})()`;

/** Q2: Aufgabenobjekte (Teile, Wracks, Marken, Zielmarke) auf den Bildschirm rechnen — Kamera ueber onBeforeRender abgegriffen. */
const PROJEKTION = (id) => `(async () => {
  const g = window.__game, T = g.THREE;
  let sc = g.excavator.root; while (sc.parent) sc = sc.parent;
  let netz = null; g.excavator.root.traverse((o) => { if (!netz && o.isMesh && o.visible) netz = o; });
  const alt = netz.onBeforeRender; let cam = null;
  netz.onBeforeRender = function (r, s, c) { cam = c; return alt.apply(this, arguments); };
  for (let k = 0; k < 3 && !cam; k++) await new Promise((r) => requestAnimationFrame(r));
  netz.onBeforeRender = alt;
  if (!cam) return { fehler: "keine Kamera" };
  const { challengeNach } = await import("/src/challenges/katalog.ts");
  const d = challengeNach(${JSON.stringify(id)});
  const marken = await new Promise((ok) => { const ab = g.bus.on("challenge:stand", (e) => { ok(e.marken.map((m) => ({ ...m }))); if (typeof ab === "function") ab(); }); setTimeout(() => ok(null), 1500); });
  const auf = (x, y, z) => { const v = new T.Vector3(x, y, z).project(cam); return { x: Math.round((v.x + 1) / 2 * innerWidth), y: Math.round((1 - v.y) / 2 * innerHeight), vorKamera: v.z < 1 && v.z > -1 }; };
  const namen = (d.aufbau.teile ?? []).map((t) => t.name);
  const teile = g.items.items.slice(-namen.length).map((i) => { const p = i.body.translation(); return { name: i.shape && i.shape.name, ...auf(p.x, p.y, p.z) }; });
  const wracks = g.composites.cars.map((c) => { const p = c.body.translation(); return { art: c.def && c.def.id, ...auf(p.x, p.y, p.z) }; });
  const k = document.getElementById("zielzeile").getBoundingClientRect();
  const unterKarte = (q) => q.x >= k.left && q.x <= k.right && q.y >= k.top && q.y <= k.bottom;
  const alle = [...teile.map((q) => ({ was: "teil " + q.name, ...q })), ...wracks.map((q) => ({ was: "wrack", ...q })),
    ...(marken ?? []).map((m) => ({ was: "marke " + m.art, ...auf(m.x, m.y, m.z) })),
    ...(d.zielMarke ? [{ was: "zielMarke", ...auf(d.zielMarke.x, d.zielMarke.y, d.zielMarke.z) }] : []),
    ...(d.ablageziel ? [{ was: "ablageziel", ...auf(d.ablageziel.x, 0, d.ablageziel.z) }] : [])];
  return { karte: { links: Math.round(k.left), oben: Math.round(k.top), rechts: Math.round(k.right), unten: Math.round(k.bottom) },
    punkte: alle.map((q) => ({ ...q, imBild: q.vorKamera && q.x >= 0 && q.x <= innerWidth && q.y >= 0 && q.y <= innerHeight, unterKarte: unterKarte(q) })),
    namenSoll: namen };
})()`;

/** F3 an, 3 s warten, Overlay lesen. */
const F3_LESEN = `(async () => {
  const d = document.getElementById("debug");
  if (d.style.display !== "block") { window.dispatchEvent(new KeyboardEvent("keydown", { code: "F3" })); await new Promise((r) => requestAnimationFrame(r)); window.dispatchEvent(new KeyboardEvent("keyup", { code: "F3" })); }
  await new Promise((r) => setTimeout(r, 3000));
  return d.innerText;
})()`;

/** Aufgabe 1 fahren wie `test/aufgabe1.test.ts` (Abschnitt 3), Schritte per `__game.step`. */
const DURCHLAUF = `(async () => {
  const g = window.__game, S = window.__smoke, GRAD = 180 / Math.PI, PRO_BILD = 4;
  const raf = () => new Promise((r) => requestAnimationFrame(r));
  const unten = new Set();
  const tasten = (ks) => {
    for (const k of [...unten]) if (!ks.includes(k)) { window.dispatchEvent(new KeyboardEvent("keyup", { code: k })); unten.delete(k); }
    for (const k of ks) if (!unten.has(k)) { window.dispatchEvent(new KeyboardEvent("keydown", { code: k })); unten.add(k); }
  };
  // 41-Q: Die Zielzeile zeigt keine Schrittnummer mehr — sie kommt vom Bus (challenge:schritt)
  const nr = () => (S.log.filter((e) => e.n === "challenge:schritt").at(-1) || {}).nr || 0;
  // Zwei Aufrufe: A = Schritte 1-5 per Tasten, B = Oeffnen (der Finger auf dem Stick kommt per CDP dazwischen)
  const B = !!window.__dl;
  const dl = (window.__dl ??= { t0: performance.now(), schritte: 0, spur: [], gesehen: [] });
  const t0 = dl.t0;
  const fertig = () => S.log.some((e) => e.n === "challenge:geschafft" && e.t >= t0);
  let i = 0;
  const eins = async () => { g.step(1); dl.schritte++; if (++i % PRO_BILD === 0) await raf(); };
  const lauf = async (max, bed = () => false) => { for (let k = 0; k < max && !bed(); k++) await eins(); };
  const fehler = (soll) => { let d = (soll - g.excavator.cabinBaseYaw) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; };
  const dreheAuf = async (soll, halten = []) => {
    let alt = g.excavator.cabinBaseYaw;
    for (let k = 0; k < 900; k++) {
      const d = fehler(soll), dreht = Math.abs(g.excavator.cabinBaseYaw - alt) > 0.0002;
      alt = g.excavator.cabinBaseYaw;
      const ks = [...halten];
      if (Math.abs(d) > 1.5 / GRAD) ks.push(d > 0 ? "KeyQ" : "KeyE"); else if (!dreht) break;
      tasten(ks); await eins();
    }
    tasten(halten);
  };
  const p = g.excavator.position;
  const teil = g.items.items.filter((x) => x.shape && x.shape.name === "Kupfer-Boiler").at(-1);
  const tp = teil.body.translation();
  const box = g.containers.ortVon("r_bunt");
  const gesehen = dl.gesehen;
  const lage = () => { const t = teil.body.translation(); const sp = g.excavator.getSensorPosition(new g.THREE.Vector3());
    return { nr: nr(), teil: [+t.x.toFixed(2), +t.y.toFixed(2), +t.z.toFixed(2)], spinne: [+sp.x.toFixed(2), +sp.y.toFixed(2), +sp.z.toFixed(2)],
      gegriffen: g.grip.grippedCount, gierGrad: +(g.excavator.cabinBaseYaw * GRAD).toFixed(1), box: teil.containerId,
      touch: { grapple: +g.touch.axes.grapple.toFixed(2), grab: g.touch.axes.grab, padRechtsZu: document.getElementById("touch-right")?.hidden } }; };
  const spur = dl.spur;
  g.autoStep(false);
  try {
    if (B) { spur.push(lage()); await lauf(900, fertig); for (let k = 0; k < 10; k++) await raf(); spur.push(lage()); } else {
    await dreheAuf(Math.atan2(tp.x - p.x, tp.z - p.z)); await lauf(60); await raf(); gesehen.push(nr()); spur.push(lage());
    tasten(["KeyF"]); await lauf(600, () => nr() >= 3); await lauf(40); tasten([]); gesehen.push(nr()); spur.push(lage());
    tasten(["Space"]); await lauf(300, () => nr() >= 4); gesehen.push(nr()); spur.push(lage());
    tasten(["Space", "KeyR"]); await lauf(600, () => nr() >= 5); await lauf(20); tasten(["Space"]); gesehen.push(nr()); spur.push(lage());
    await dreheAuf(Math.atan2(box.x - p.x, box.z - p.z), ["Space"]); await lauf(60); await raf(); gesehen.push(nr()); spur.push(lage());
    // Auf Touch haelt „Taste los" die Spinne (Stick neutral = Position halten, excavator.ts) — geoeffnet wird in B
    tasten([]); }
  } finally { tasten([]); g.autoStep(true); }
  const ende = S.log.filter((e) => e.n === "challenge:geschafft" && e.t >= t0).at(-1);
  return { phase: B ? "B" : "A", schliessung: +g.excavator.closure.toFixed(2), spur, boxOrt: box, gesehen, geschafft: !!ende, sterne: ende ? ende.sterne : null, physikSchritte: dl.schritte, spielzeitS: +(dl.schritte / 60).toFixed(1),
    wandMs: Math.round(performance.now() - t0), teilIn: teil.containerId, teilGueltig: teil.body.isValid() };
})()`;

/* ---------------- Q3: Lehrgang (E-196) ---------------- */

/**
 * Vor dem ersten Skript: Bus und Kamera abhoeren, ohne `src/` anzufassen.
 * Gleiche Modul-URL wie main.ts -> dieselbe Instanz; gepatcht wird nur das
 * Prototyp-Objekt (Mitschrift), das Verhalten bleibt gleich.
 */
const LEHRGANG_HAKEN = `(() => {
  const S = window.__smoke;
  const snap = () => { const g = window.__game, o = window.__orbit; if (!g) return null; const x = g.excavator;
    return { cab: x.cabYaw, boom: x.boomAngle, stick: x.stickAngle, x: x.position.x, z: x.position.z, heading: x.heading,
      kam: o ? { ...o.blick } : null }; };
  S.snap = snap;
  // Bildrate: Abstand der letzten 60 Bilder (ms) — headless ist sie niedriger als auf dem Geraet
  S.bilder = []; const raf = (t) => { S.bilder.push(t); if (S.bilder.length > 61) S.bilder.shift(); requestAnimationFrame(raf); }; requestAnimationFrame(raf);
  S.fps = () => { const b = S.bilder; return b.length > 1 ? +((1000 * (b.length - 1)) / (b[b.length - 1] - b[0])).toFixed(1) : null; };
  // Q4: Physikschritte zaehlen (1/60 s) — die Nachahmung haelt Zwischenabschnitte so lange wie die Spur, in Spielzeit
  S.n = 0;
  addEventListener("touchend", () => { S.ende = performance.now(); }, { capture: true, passive: true });
  /** Warten in der Seite, je Bild geprueft — ohne CDP-Rundreisen (sonst ~0,7 s Verzug beim Loslassen) */
  S.warte = (f, ms) => new Promise((ok) => { const t0 = performance.now(); const g = () => { const v = f(); if (v || performance.now() - t0 > ms) { S.aufgeloest = performance.now(); ok(!!v); } else requestAnimationFrame(g); }; g(); });
  const zaehl = setInterval(() => { const g = window.__game; if (!g) return; clearInterval(zaehl); const x = g.excavator, u = x.update;
    x.update = function (...a) { S.n++; return u.apply(this, a); }; }, 5);
  import("/src/excavator/orbitCamera.ts").then((m) => {
    const P = m.OrbitCamera.prototype, u = P.update, d = Object.getOwnPropertyDescriptor(P, "blick");
    P.update = function (...a) { window.__orbit = this; return u.apply(this, a); };
    if (d && d.get) Object.defineProperty(P, "blick", { configurable: true, get() { window.__orbit = this; return d.get.call(this); } });
  });
  // Q4: Erfolgsbild — beim Haekchen (nur wenn angefordert) die Lehrgangsuhr anhalten und nach 200 ms die CSS-Animationen
  // einfrieren; das Bild (PNG DPR 3 ~1,6 s) faellt sonst hinter das 0,8-s-Leuchten. Nur Testseite, kein Spielcode.
  import("/src/challenges/lektion.ts").then((m) => { const P = m.LektionLauf.prototype, t = P.takt; P.takt = function (...a) { if (S.halt) return; return t.apply(this, a); }; });
  S.taue = () => { (S.angehalten || []).forEach((x) => x.play()); S.angehalten = null; S.halt = false; S.haltBeiHaken = false; S.eingefroren = null; return true; };
  import("/src/core/events.ts").then((m) => {
    const P = m.EventBus.prototype, em = P.emit;
    S.hakenDa = true;
    P.emit = function (n, e) {
      if (n === "lehrgang:haekchen" && S.haltBeiHaken) { S.halt = true; setTimeout(() => { S.angehalten = document.getAnimations().filter((x) => x.playState === "running"); S.angehalten.forEach((x) => x.pause()); S.eingefroren = performance.now(); }, 200); }
      if (n.startsWith("lehrgang:") || (n.startsWith("challenge:") && n !== "challenge:stand"))
        S.log.push({ n, t: performance.now(), id: e && e.id, nr: e && e.nr, phase: e && e.phase, abgebrochen: e && e.abgebrochen,
          marke: e && e.marke ? { ...e.marke } : undefined, zeitS: e && e.zeitS, zust: snap(),
          karte: document.getElementById("tutorial") ? document.getElementById("tutorial").innerText.replace(/\\n+/g, " | ") : null });
      return em.call(this, n, e);
    };
  });
})();`;

const GEIST_LESEN = `(() => ({ t: performance.now(), geister: [...document.querySelectorAll("#geisterdaumen .geist.an")].map((e) => { const b = e.getBoundingClientRect();
  return { seite: e.classList.contains("links") ? "links" : "rechts", folgt: e.classList.contains("folgt"), dx: +(e.style.getPropertyValue("--dx") || 0), dy: +(e.style.getPropertyValue("--dy") || 0),
    pfeil: e.dataset.pfeil ?? null, x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }; }),
  kamgeist: document.querySelector("#geisterdaumen .kamgeist.an")?.dataset.geste ?? null,
  schild: document.querySelector("#geisterdaumen .tastengeist.an")?.textContent ?? null,
  pedaleLeuchten: !!document.querySelector("#pedals.geist-zeigt"),
  karte: document.getElementById("tutorial")?.innerText.replace(/\\n+/g, " | ") }))()`;

const ZONEN = `(() => { const r = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
  const k = document.getElementById("tutorial").getBoundingClientRect();
  return { mitte: r("zone-mitte"), links: r("zone-left"), rechts: r("zone-right"), W: innerWidth, H: innerHeight, karteUnten: k.bottom, karteRechts: k.right, karteLinks: k.left }; })()`;

const MENUE_LESEN = `(() => { const el = document.getElementById("hauptmenue");
  const kn = [...el.querySelectorAll("button")].filter((b) => b.offsetParent !== null && b.getBoundingClientRect().width > 0).map((b) => { const q = b.getBoundingClientRect();
    return { id: b.id, text: b.innerText.replace(/\\n/g, " / "), aria: b.getAttribute("aria-label"), x: Math.round(q.x), y: Math.round(q.y), w: Math.round(q.width), h: Math.round(q.height),
      drin: q.top >= -0.5 && q.bottom <= innerHeight + 0.5 && q.left >= -0.5 && q.right <= innerWidth + 0.5, gesperrt: b.disabled }; });
  const ueber = []; for (let i = 0; i < kn.length; i++) for (let j = i + 1; j < kn.length; j++) { const a = kn[i], b = kn[j];
    if (a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5) ueber.push([a.text, b.text]); }
  const roll = [el, ...el.querySelectorAll("*")].filter((e) => e.scrollHeight > e.clientHeight + 1 && !["visible"].includes(getComputedStyle(e).overflowY)).map((e) => e.id || e.className);
  return { offen: el.classList.contains("open"), liste: !document.getElementById("hm-liste").hidden, titel: document.getElementById("hm-listentitel")?.textContent,
    knoepfe: kn, ueberlappen: ueber, rollbar: roll, seiteRollt: document.documentElement.scrollHeight > innerHeight + 1, fenster: [innerWidth, innerHeight] }; })()`;

/** Q4 (E-197): sichtbarer Text im Bild. Mittelzone wie `test/lehrgangsleiste.test.ts`: zwischen den Innenkanten der
 *  Geisterdaumen-Ringe, 25–85 % der Hoehe von oben. Ringe aus dem DOM, sonst die Zahlen des Tests (mini 168..644, iPad 249..775). */
const TEXT_SICHT = `(() => {
  const W = innerWidth, H = innerHeight;
  const ring = (s) => { const e = document.querySelector("#geisterdaumen .geist." + s); const b = e && e.getBoundingClientRect(); return b && b.width ? b : null; };
  const L = ring("links"), Rr = ring("rechts"), fest = W > 1000 ? [249, 775] : [168, 644];
  const zone = { x0: Math.round(L ? L.right : fest[0]), x1: Math.round(Rr ? Rr.left : fest[1]), y0: Math.round(0.25 * H), y1: Math.round(0.85 * H), quelle: L && Rr ? "dom" : "test" };
  const texte = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode()); ) {
    const t = n.textContent.replace(/\\s+/g, " ").trim(); if (!t) continue;
    const el = n.parentElement; if (!el || ["SCRIPT", "STYLE", "TITLE"].includes(el.tagName)) continue;
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    const b = [...r.getClientRects()].find((q) => q.width >= 1 && q.height >= 1 && q.right > 0 && q.left < W && q.bottom > 0 && q.top < H);
    if (!b) continue;
    let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity;
    if (op < 0.05) continue;
    texte.push({ text: t.slice(0, 80), el: el.id || (el.className && String(el.className).slice(0, 40)) || el.tagName, x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), deckkraft: +op.toFixed(2),
      inZone: b.left < zone.x1 && b.right > zone.x0 && b.top < zone.y1 && b.bottom > zone.y0, worte: t.split(" ").length });
  }
  return { zone, texte, inZone: texte.filter((t) => t.inZone), saetze: texte.filter((t) => t.worte > 2) };
})()`;

/** Q4: Wie der Spieler einen Schritt nachmacht — abgeleitet aus Ziel und Spur des Schritts (waechst mit `lehrgang.ts`).
 *  „hin" = die aktiven Abschnitte bis zur ersten Pause; Stickausschlaege ueber `stickAusschlag` mit der echten Belegung. */
const NACHAHMUNG = (nr) => `(async () => {
  const { LEKTIONEN } = await import("/src/challenges/lehrgang.ts");
  const { stickAusschlag } = await import("/src/ui/geisterdaumen.ts");
  const s = LEKTIONEN[0].schritte[${nr} - 1], c = __game.touch.config, ACH = ["cab", "boom", "stick", "grapple", "rotator", "drive", "steer"];
  const spur = s.vorfuehrung ?? [];
  const aktiv = (a) => !!((a.tasten && a.tasten.length) || a.kamera || (a.achsen && Object.values(a.achsen).some((v) => Math.abs(v) > 0.02)));
  const hin = []; for (const a of spur) { if (!aktiv(a)) { if (hin.length) break; continue; } hin.push(a); }
  return { von: LEKTIONEN[0].schritte.length, symbol: s.symbol ?? null, ziel: s.ziel, fahrt: spur.some((a) => a.achsen && a.achsen.drive),
    hin: hin.map((a) => ({ dauerS: a.dauerS, tasten: a.tasten ?? null, kamera: a.kamera ?? null,
      sticks: a.achsen ? stickAusschlag(Object.fromEntries(ACH.map((k) => [k, (a.achsen && a.achsen[k]) || 0])), c) : null })) };
})()`;

const ERFOLG_LESEN = `(() => ({ t: performance.now(), leisteHaken: !!document.querySelector("#lehrgangsleiste.haken"),
  erfolg: [...document.querySelectorAll(".erfolg")].map((e) => e.id || String(e.className)),
  striche: [...document.querySelectorAll("#lehrgangsleiste .punkte i")].map((i) => i.className || "-").join(" ") }))()`;

const LEISTE_LESEN = `(() => { const l = document.getElementById("lehrgangsleiste"); if (!l) return null; const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  return { sichtbar: !l.hidden, klasse: l.className, phase: l.dataset.phase, aria: l.getAttribute("aria-label"), kasten: r(l), skip: r(document.getElementById("lg-skip")), ja: r(document.getElementById("lg-ja")), nein: r(document.getElementById("lg-nein")),
    karteOffen: !!document.querySelector("#tutorial.open") }; })()`;

/** Q4: der eine Lehrgang (9 Schritte, E-197) je Geraet per Touch — Erststart, Bilder, Erfolg, Wiedereinstieg nach Schritt 5, Tafel, Pruefung 1, Ueberspringen. */
async function lehrgangSmoke(cdp, neueSeite) {
  ergebnis.lehrgang = {};
  const geraete = (process.env.SMOKE_GERAET ?? "mini").split(",");
  const BILDSCHRITTE = new Set([1, 5, 9]); // Auftrag: Kamera, Fahren, Marke
  const F3_SCHRITT = 7;
  const WIEDER_NACH = 5; // Auftrag: nach Schritt 5 neu laden
  for (const geraet of geraete) {
    const R = (ergebnis.lehrgang[geraet] = { schritte: [] });
    const p = await neueSeite(geraet);
    const konsole = [];
    const hoer = (d) => {
      if (d.sessionId !== p.sid) return;
      if (d.method === "Runtime.consoleAPICalled" && ["error", "warning", "warn", "assert"].includes(d.params.type))
        konsole.push(`${d.params.type}: ${d.params.args.map((a) => a.value ?? a.description ?? "").join(" ")}`.slice(0, 300));
      if (d.method === "Runtime.exceptionThrown") konsole.push(`exception: ${d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text}`.slice(0, 300));
    };
    cdp.hoerer.push(hoer);
    R.konsole = konsole;
    await p.s("Page.addScriptToEvaluateOnNewDocument", { source: LEHRGANG_HAKEN });
    // Patricks Geraete sind deutsch; Chromium headless meldet sonst en-US (ui/sprache.ts ermittleSprache)
    const ua = (await cdp.send("Browser.getVersion")).userAgent;
    await p.s("Network.setUserAgentOverride", { userAgent: ua, acceptLanguage: "de-DE,de" });
    await p.s("Emulation.setLocaleOverride", { locale: "de-DE" }).catch(() => null);

    const T = (type, pts) => p.s("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, force: 0.5 })) });
    const warteEv = (ab, bed, ms = 20000) =>
      p.warte(`(() => { const L = __smoke.log; for (let k = ${ab}; k < L.length; k++) { const e = L[k]; if (${bed}) return { ...e, k }; } return null; })()`, ms);
    const hatEv = (ab, bed) => p.werte(`(() => { const L = __smoke.log; for (let k = ${ab}; k < L.length; k++) { const e = L[k]; if (${bed}) return true; } return false; })()`);
    /** Finger aufsetzen, ziehen (Versatz je Finger), halten bis `bis()` oder `maxMs`, loslassen. */
    const zieh = async (finger, { haltMs = 0, bis = null, bisSeite = null, maxMs = 12000, schritte = 6 } = {}) => {
      const pts = [];
      const laeuft = [];
      for (const f of finger) {
        pts.push([f.x, f.y, f.id]);
        laeuft.push(T("touchStart", pts.map((q) => [...q])));
      }
      // erster Zug ohne Warten: sonst klappt rechts der Funktionskranz auf (RADIAL_HOLD_S, siehe Q2)
      for (let k = 1; k <= schritte; k++) {
        const z = T("touchMove", finger.map((f) => [f.x + (f.dx * k) / schritte, f.y + (f.dy * k) / schritte, f.id]));
        if (k === 1) await Promise.all(laeuft);
        await z;
        if (schritte > 1) await pause(30);
      }
      const t0 = Date.now();
      let erreicht = false;
      if (bisSeite) erreicht = await p.werte(bisSeite);
      else if (bis) while (Date.now() - t0 < maxMs) { if (await bis()) { erreicht = true; break; } await pause(20); }
      else await pause(haltMs);
      await T("touchEnd", []);
      const verzugMs = bisSeite ? await p.werte("Math.round(__smoke.ende - __smoke.aufgeloest)") : null;
      return { erreicht, haltMs: Date.now() - t0, verzugMs };
    };
    const tipp = async (x, y, ms = 60) => {
      await T("touchStart", [[x, y, 9]]);
      await pause(ms);
      await T("touchEnd", []);
    };
    // Doppeltipp ohne auf die Quittung zu warten (DOUBLE_TAP_MS 320, touch.ts) — headless kaemen die Tipps sonst zu spaet
    const doppel = async (x, y) => {
      const a = [T("touchStart", [[x, y, 9]])];
      await pause(50);
      a.push(T("touchEnd", []));
      await pause(110);
      a.push(T("touchStart", [[x, y, 9]]));
      await pause(50);
      a.push(T("touchEnd", []));
      await Promise.all(a);
    };
    const freierPunkt = async (zone, kandidaten) => {
      for (const [fx, fy] of kandidaten) {
        const pkt = await p.werte(`(() => { const b = document.getElementById(${JSON.stringify(zone)}).getBoundingClientRect(); const x = b.x + b.width * ${fx}, y = b.y + b.height * ${fy};
          const e = document.elementFromPoint(x, y); return e && e.id === ${JSON.stringify(zone)} ? [Math.round(x), Math.round(y)] : null; })()`);
        if (pkt) return pkt;
      }
      throw new Error(`kein freier Punkt in ${zone}`);
    };
    const mitte = async () => {
      const [x, y] = await freierPunkt("zone-mitte", [[0.5, 0.6], [0.5, 0.75], [0.5, 0.45]]);
      return { x, y };
    };

    const runde = (z) => z && { cabGrad: +((z.cab * 180) / Math.PI).toFixed(2), boomGrad: +((z.boom * 180) / Math.PI).toFixed(2), stickGrad: +((z.stick * 180) / Math.PI).toFixed(2),
      x: +z.x.toFixed(3), z: +z.z.toFixed(3), headingGrad: +((z.heading * 180) / Math.PI).toFixed(2),
      kam: z.kam && { modus: z.kam.modus, gierGrad: +((z.kam.gier * 180) / Math.PI).toFixed(2), nickGrad: +((z.kam.nick * 180) / Math.PI).toFixed(2), abstand: +z.kam.abstand.toFixed(3) } };
    const diff = (a, b) => {
      if (!a || !b) return null;
      const d = { cabGrad: b.cabGrad - a.cabGrad, boomGrad: b.boomGrad - a.boomGrad, stickGrad: b.stickGrad - a.stickGrad, wegM: Math.hypot(b.x - a.x, b.z - a.z), headingGrad: b.headingGrad - a.headingGrad };
      if (a.kam && b.kam) Object.assign(d, { kamModusGleich: a.kam.modus === b.kam.modus, gierGrad: b.kam.gierGrad - a.kam.gierGrad, nickGrad: b.kam.nickGrad - a.kam.nickGrad, abstandRel: b.kam.abstand / a.kam.abstand - 1 });
      for (const k of Object.keys(d)) if (typeof d[k] === "number") d[k] = +d[k].toFixed(3);
      return d;
    };
    /** Startlage gilt als erreicht: Winkel < 0,5°, Weg < 2 cm, Kamera < 0,5° / 1 % (SW, wie lektion.ts START_TOL) */
    const inStartlage = (d) => !!d && Math.abs(d.cabGrad) < 0.5 && Math.abs(d.boomGrad) < 0.5 && Math.abs(d.stickGrad) < 0.5 && d.wegM < 0.02 && Math.abs(d.headingGrad) < 0.5 &&
      (d.gierGrad === undefined || (d.kamModusGleich && Math.abs(d.gierGrad) < 0.5 && Math.abs(d.nickGrad) < 0.5 && Math.abs(d.abstandRel) < 0.01));

    /** Den Schritt nachmachen wie ein Spieler — aus der Spur abgeleitet (NACHAHMUNG). */
    const nachmachen = async (nr, ab, marke = null) => {
      const hakenBed = `__smoke.log.some((e, k) => k >= ${ab} && e.n === "lehrgang:haekchen" && e.nr === ${nr})`;
      const haken = () => p.werte(hakenBed);
      const hakenSeite = `__smoke.warte(() => ${hakenBed}, 8000)`;
      const info = await p.werte(NACHAHMUNG(nr));
      const z = info.ziel;
      if (z.art === "ansicht") {
        const [x, y] = await freierPunkt("zone-right", [[0.5, 0.4], [0.4, 0.3], [0.6, 0.5]]);
        let n = 0;
        for (; n < 8 && !(await haken()); n++) { await doppel(x, y); await pause(700); }
        return { art: "doppeltipp rechts", doppeltipps: n };
      }
      const kam = info.hin.find((a) => a.kamera);
      if (kam) {
        const k = kam.kamera, m = await mitte();
        if (k.zoomProS && Math.abs(k.zoomProS - 1) > 1e-3) {
          const auf = k.zoomProS < 1 ? 1 : -1; // Faktor < 1 = naeher = Finger auseinander (geisterdaumen.ts kameraGeste)
          const r = await zieh([{ x: m.x, y: m.y - 25, dx: 0, dy: -60 * auf, id: 33 }, { x: m.x, y: m.y + 25, dx: 0, dy: 60 * auf, id: 34 }], { bisSeite: hakenSeite });
          return { art: auf > 0 ? "spreizen" : "kneifen", ...r };
        }
        const dx = Math.sign(k.gierProS ?? 0) * 120, dy = Math.sign(k.nickProS ?? 0) * 120;
        return { art: "ein Finger ziehen", dx, dy, ...(await zieh([{ ...m, dx, dy, id: 31 }], { bisSeite: hakenSeite })) };
      }
      if (!info.hin.length) throw new Error(`Schritt ${nr}: keine Spur zum Nachmachen`);
      // Fahrbetrieb wie die Spur: mit Fahr-Achse an, sonst aus (Pedal antippen)
      const fahrenVor = await p.werte(`document.getElementById("touch").classList.contains("fahren")`);
      let pedal = false, naiv = null;
      const punkt0 = { links: await freierPunkt("zone-left", [[0.5, 0.55], [0.6, 0.45], [0.4, 0.4]]), rechts: await freierPunkt("zone-right", [[0.5, 0.55], [0.4, 0.45], [0.6, 0.4]]) };
      if (fahrenVor && !info.fahrt && info.hin[0]?.sticks) {
        // Wie ein Spieler, der nur dem Geist folgt: Fahren ist noch an, er drueckt trotzdem 1,5 s in Pfeilrichtung
        const a = info.hin[0], vor = await p.werte("__smoke.snap()");
        const fi = ["links", "rechts"].filter((sd) => a.sticks[sd]).map((sd, i) => ({ x: punkt0[sd][0], y: punkt0[sd][1], dx: a.sticks[sd].dx * 62, dy: a.sticks[sd].dy * 62, id: 51 + i }));
        const r = await zieh(fi, { schritte: 1, bisSeite: `__smoke.warte(() => ${hakenBed}, 1500)` });
        await pause(400);
        const nach = await p.werte("__smoke.snap()");
        naiv = { haekchen: r.erreicht, cabGrad: +(((nach.cab - vor.cab) * 180) / Math.PI).toFixed(1), headingGrad: +(((nach.heading - vor.heading) * 180) / Math.PI).toFixed(1), wegM: +Math.hypot(nach.x - vor.x, nach.z - vor.z).toFixed(2) };
      }
      if (!!info.fahrt !== fahrenVor && !(await haken())) { await p.tippe("#pedal-l"); await pause(300); pedal = true; }
      const fahrenNach = await p.werte(`document.getElementById("touch").classList.contains("fahren")`);
      const punkt = { links: await freierPunkt("zone-left", [[0.5, 0.55], [0.6, 0.45], [0.4, 0.4]]), rechts: await freierPunkt("zone-right", [[0.5, 0.55], [0.4, 0.45], [0.6, 0.4]]) };
      const abschnitte = [];
      if (z.art === "marke" && marke && info.hin.length >= 2) {
        /*
         * Wie ein Spieler mit Blick auf die Marke: erst schwenken (erster Abschnitt der Spur), dann heranholen
         * (zweiter), jeweils mit Vorhalt loslassen und nachkorrigieren. Reines Nachzeitmessen traf headless nicht:
         * Zwischen „genug" in der Seite und dem Loslassen per CDP liegen 0,1–1,3 s (Q4-Messung).
         */
        const lage = `(() => { const g = __game, x = g.excavator, sp = x.getSensorPosition(new g.THREE.Vector3()), p = x.position, m = ${JSON.stringify({ x: marke.x, z: marke.z })};
          const b = (X, Z) => Math.atan2(X - p.x, Z - p.z); let e = ((b(m.x, m.z) - b(sp.x, sp.z)) * 180) / Math.PI; e = ((e + 540) % 360) - 180;
          // Schwenkfehler ueber den Drehkranz, nicht ueber die pendelnde Spinne: Peilung bei Beginn minus bisher geschwenkt
          if (window.__m0 === undefined) window.__m0 = { e, cab: x.cabYaw };
          e = window.__m0.e - ((x.cabYaw - window.__m0.cab) * 180) / Math.PI;
          return { e, r: Math.hypot(sp.x - p.x, sp.z - p.z) - Math.hypot(m.x - p.x, m.z - p.z), d: Math.hypot(sp.x - m.x, sp.z - m.z) }; })()`;
        const [schwenk, heran] = info.hin;
        await p.werte("delete window.__m0; true");
        const l0 = await p.werte(lage);
        const vz = { e: Math.sign(l0.e) || 1, r: Math.sign(l0.r) || 1 };
        const finger = (a, sign, k) => ["links", "rechts"].filter((sd) => a.sticks?.[sd]).map((sd, i) => ({ x: punkt[sd][0], y: punkt[sd][1], dx: a.sticks[sd].dx * 62 * sign * k, dy: a.sticks[sd].dy * 62 * sign * k, id: 61 + i, seite: sd }));
        for (let runde = 0; runde < 10 && !(await haken()); runde++) {
          const l = await p.werte(lage);
          let r;
          if (Math.abs(l.e) > 3) { // SW: 3° bei ~6,5 m Ausladung = 0,34 m, Marke hat 0,5 m
            const gross = Math.abs(l.e) > 8, sign = Math.sign(l.e) === vz.e ? 1 : -1, s0 = Math.sign(l.e);
            const halt = gross ? 7 : 1.5; // SW: Vorhalt in Grad fuer Auslauf + Verzug (gemessen 0,1–0,6 s)
            r = await zieh(finger(schwenk, sign, gross ? 1 : 0.3), { schritte: 1, bisSeite: `__smoke.warte(() => { const l = ${lage}; return Math.abs(l.e) < ${halt} || Math.sign(l.e) !== ${s0}; }, 6000)` });
            abschnitte.push({ was: "schwenken", vorGrad: +l.e.toFixed(1), sign, gross, ...r });
          } else {
            const gross = Math.abs(l.r) > 0.8, sign = Math.sign(l.r) === vz.r ? 1 : -1, s0 = Math.sign(l.r);
            const halt = gross ? 0.5 : 0.15; // SW: Vorhalt in m
            r = await zieh(finger(heran, sign, gross ? 1 : 0.5), { schritte: 1, bisSeite: `__smoke.warte(() => { const l = ${lage}; return ${hakenBed} || Math.abs(l.r) < ${halt} || Math.sign(l.r) !== ${s0}; }, 6000)` });
            abschnitte.push({ was: "heranholen", vorM: +l.r.toFixed(2), sign, gross, ...r });
          }
          await pause(500); // Auslauf abwarten, dann neu schauen
        }
        abschnitte.push({ ende: await p.werte(lage) });
        return { art: "Marke (Schwenken, Heranholen, nachkorrigiert)", pedal, naiv, abschnitte };
      }
      for (let i = 0; i < info.hin.length; i++) {
        const a = info.hin[i], letzter = i === info.hin.length - 1;
        const finger = [];
        let id = 41 + 2 * i;
        for (const seite of ["links", "rechts"]) {
          const s = a.sticks?.[seite];
          if (s) finger.push({ x: punkt[seite][0], y: punkt[seite][1], dx: s.dx * 62, dy: s.dy * 62, id: id++, seite }); // 62 px = Vollausschlag (touch.ts RADIUS)
        }
        if (!finger.length) continue;
        // Zwischenabschnitte so lange wie in der Spur, gemessen in Physikschritten (1/60 s, wie die Wiedergabe); der letzte bis zum Haekchen
        const soll = Math.round(a.dauerS * 60);
        await p.werte("window.__n0 = null; true");
        // Zaehler startet, sobald der Finger liegt (erste Abfrage nach dem Ziehen)
        const r = await zieh(finger, { schritte: 1, bisSeite: letzter ? `(window.__n0 = __smoke.n, ${hakenSeite})` : `(window.__n0 = __smoke.n, __smoke.warte(() => __smoke.n - window.__n0 >= ${soll}, 8000))` });
        abschnitte.push({ finger: finger.map((f) => `${f.seite} ${f.dx.toFixed(0)},${f.dy.toFixed(0)}`).join(" + "), sollSchritte: letzter ? "bis Haekchen" : soll, physikSchritte: await p.werte("__smoke.n - window.__n0"), ...r });
      }
      return { art: "Sticks", pedal, naiv, fahrenVor, fahrenNach, abschnitte };
    };

    /** Schritte `von`..`bis` fahren; `ab` = Logstelle von `lehrgang:start`. */
    const fahreSchritte = async (von, bis, ab, liste = R.schritte, bilder = true) => {
      for (let nr = von; nr <= bis; nr++) {
        const bildHier = bilder && BILDSCHRITTE.has(nr);
        const ev = await warteEv(ab, `(e.n === "lehrgang:schritt" && e.nr === ${nr}) || e.n === "lehrgang:geschafft"`, 30000);
        if (ev.n === "lehrgang:geschafft") throw new Error(`geschafft vor Schritt ${nr}`);
        const S = { nr, phase1: ev.phase, von: null, marke: ev.marke ?? null };
        liste.push(S);
        ab = ev.k;
        const tBeginn = Date.now();
        if (ev.phase === "zeigen") {
          const vf = await warteEv(ab, `e.n === "lehrgang:vorfuehren"`, 5000);
          S.vorher = runde(vf.zust);
          let gelesen = false;
          const proben = [];
          for (;;) {
            proben.push(await p.werte(GEIST_LESEN));
            if (!gelesen && Date.now() - tBeginn > 600) {
              S.textZeigen = await p.werte(TEXT_SICHT);
              S.leisteZeigen = await p.werte(LEISTE_LESEN);
              S.geistZeigen = await p.werte(GEIST_LESEN);
              if (bildHier) S.bildZeigen = await p.bild(`${geraet}_s${nr}_1_zeigen`);
              gelesen = true;
            }
            if (await hatEv(ab, `e.n === "lehrgang:vorfuehrungEnde"`)) break;
            if (Date.now() - tBeginn > 30000) throw new Error(`Vorfuehrung ${nr} endet nicht`);
            await pause(80);
          }
          const ende = await warteEv(ab, `e.n === "lehrgang:vorfuehrungEnde"`, 1000);
          S.vorfuehrungSeiteMs = Math.round(ende.t - vf.t);
          S.zeigenProben = { n: proben.length, links: proben.some((q) => q.geister.some((g) => g.seite === "links")), rechts: proben.some((q) => q.geister.some((g) => g.seite === "rechts")),
            pedale: proben.filter((q) => q.pedaleLeuchten).length, kamGesten: [...new Set(proben.map((q) => q.kamgeist).filter(Boolean))], schilder: [...new Set(proben.map((q) => q.schild).filter(Boolean))] };
          S.abgebrochen = ende.abgebrochen;
          S.nachher = runde(ende.zust);
          S.delta = diff(S.vorher, S.nachher);
          S.inStartlage = inStartlage(S.delta);
          if (!gelesen) S.textZeigen = await p.werte(TEXT_SICHT);
        }
        const du = await warteEv(ab, `e.n === "lehrgang:schritt" && e.nr === ${nr} && e.phase === "du"`, 5000);
        ab = du.k;
        await pause(400); // Leiste „Jetzt du" steht
        S.textDu = await p.werte(TEXT_SICHT);
        S.leisteDu = await p.werte(LEISTE_LESEN);
        S.geistDu = await p.werte(GEIST_LESEN);
        if (bildHier) S.bildDu = await p.bild(`${geraet}_s${nr}_2_du`);
        if (bilder && nr === F3_SCHRITT) {
          S.f3 = await p.werte(F3_LESEN);
          S.f3Zahl = await p.werte(`(() => { const c = __game.physics.counts(); return { koerper: c.bodies, wach: c.awake, kollider: __game.physics.world.colliders.len(), heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, fps: __smoke.fps() }; })()`);
          S.f3Bild = await p.bild(`${geraet}_s${nr}_f3`);
          await p.werte(`(() => { window.dispatchEvent(new KeyboardEvent("keydown", { code: "F3" })); window.dispatchEvent(new KeyboardEvent("keyup", { code: "F3" })); return true; })()`);
        }
        S.fpsDu = await p.werte("__smoke.fps()");
        if (bildHier) await p.werte("__smoke.haltBeiHaken = true");
        S.aktion = await nachmachen(nr, ab, S.marke);
        // Erfolgsbild sofort nach dem Loslassen — schnelles JPEG, das PNG (DPR 3) braucht ~1,6 s, das Leuchten steht 0,8 s
        if (bildHier) {
          S.eingefroren = await p.warte("__smoke.eingefroren", 15000).catch(() => null);
          S.erfolg = await p.werte(ERFOLG_LESEN);
          S.bildErfolg = await p.bild(`${geraet}_s${nr}_3_erfolg`);
          S.erfolgNachBild = await p.werte(ERFOLG_LESEN);
          S.textErfolg = await p.werte(TEXT_SICHT);
          await p.werte("__smoke.taue()");
        } else S.erfolg = await p.werte(ERFOLG_LESEN);
        const hk = await warteEv(ab, `e.n === "lehrgang:haekchen" && e.nr === ${nr}`, 15000).catch(() => null);
        S.haekchen = !!hk;
        if (!hk) {
          S.bildFehlt = await p.bild(`${geraet}_s${nr}_KEIN-HAKEN`);
          S.stand = await p.werte(`__smoke.snap()`);
          throw new Error(`kein Haekchen ${nr}`);
        }
        S.duSeiteMs = Math.round(hk.t - du.t);
        S.losgelassenNachHakenMs = bildHier ? null : Math.round(S.erfolg.t - hk.t); // obere Grenze: Lesen nach dem Loslassen
        S.wandMs = Date.now() - tBeginn;
        S.nachHaken = runde(hk.zust);
        ab = hk.k;
        log(geraet, "Schritt", nr, "zeigen:", S.vorfuehrungSeiteMs ?? "-", "ms Startlage:", S.inStartlage ?? "-", "Haken:", S.haekchen, S.duSeiteMs, "ms, Text in Zone:",
          [S.textZeigen, S.textDu].map((t) => (t ? t.inZone.length : "-")).join("/"), JSON.stringify(S.aktion).slice(0, 160));
        writeFileSync(join(AUS, ERGEBNIS_DATEI), JSON.stringify(ergebnis, null, 2));
      }
      return ab;
    };

    // 1.–3. Erststart, leerer Speicher: der ganze Lehrgang am Stueck (1..9), Tafel, ZUR PRUEFUNG 1
    const t0 = Date.now();
    await p.s("Page.navigate", { url: BASIS });
    R.erststart = { hakenDa: await p.warte("window.__smoke && window.__smoke.hakenDa", 30000) };
    const st = await warteEv(0, `e.n === "lehrgang:start"`, 90000);
    R.erststart.menueOffen = await p.werte(`document.getElementById("hauptmenue").classList.contains("open")`);
    R.erststart.adresse = await p.werte("location.hash");
    R.erststart.ladeBisStartMs = Date.now() - t0;
    const tLauf = Date.now();
    const ab9 = await fahreSchritte(1, 9, st.k);
    const gs = await warteEv(ab9, `e.n === "lehrgang:geschafft"`, 5000);
    R.erststart.menueNieOffen = await p.werte("!__smoke.menueMs");
    R.durchlauf = { wandS: +((Date.now() - tLauf) / 1000).toFixed(1), spielzeitS: +gs.zeitS.toFixed(1), mehrSchritte: await hatEv(ab9, `e.n === "lehrgang:schritt"`) };
    await p.warte("document.getElementById('abrechnung').classList.contains('open')", 10000);
    await pause(1500);
    R.tafel = await p.werte(`(() => { const t = (id) => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); return { text: e.innerText, versteckt: e.hidden, drin: b.bottom <= innerHeight && b.top >= 0 }; };
      return { kopf: t("abr-kopf"), sterne: t("abr-sterne"), zahlen: t("abr-zahlen"), weiter: t("abr-weiter"), naechste: t("abr-naechste"), menue: t("abr-menue"), lehrgang: localStorage.getItem("schrottplatz_lehrgang") }; })()`);
    R.tafelBild = await p.bild(`${geraet}_5_tafel`);
    log(geraet, "Tafel", JSON.stringify([R.tafel.kopf?.text, R.tafel.weiter?.text, R.tafel.menue?.text]), "Speicher", R.tafel.lehrgang, "Durchlauf", JSON.stringify(R.durchlauf));
    await p.tippe("#abr-weiter");
    const cs = await warteEv(0, `e.n === "challenge:start"`, 90000);
    await pause(2500);
    R.pruefung = { id: cs.id, adresse: await p.werte("location.hash"), bild: await p.bild(`${geraet}_6_pruefung1`) };
    R.pruefung.f3 = await p.werte(F3_LESEN);
    R.konsoleNachDurchlauf = konsole.length;
    R.seitenfehlerDurchlauf = await p.werte("__smoke.fehler");

    // 4. Wiedereinstieg: frischer Speicher, Schritte 1..5 (ohne Bilder), neu laden, Menue, LEHRGANG
    const W = (R.wiedereinstieg = { schritte: [] });
    await p.s("Storage.clearDataForOrigin", { origin: BASIS.slice(0, -1), storageTypes: "local_storage" });
    await p.s("Page.navigate", { url: BASIS });
    const sw = await warteEv(0, `e.n === "lehrgang:start"`, 90000);
    await fahreSchritte(1, WIEDER_NACH, sw.k, W.schritte, false);
    await pause(300);
    W.speicherVor = await p.werte(`localStorage.getItem("schrottplatz_lehrgang")`);
    await p.s("Page.navigate", { url: BASIS });
    await p.warte("document.getElementById('hauptmenue')?.classList.contains('open')", 60000);
    await pause(500);
    W.menue = await p.werte(MENUE_LESEN);
    W.knopf = await p.werte(`document.getElementById("hm-lehrgang")?.innerText.replace(/\\n/g, " / ")`);
    W.lehrgangStartOhneMenue = await hatEv(0, `e.n === "lehrgang:start"`);
    W.bild = await p.bild(`${geraet}_4_wiedereinstieg_menue`);
    await p.tippe("#hm-lehrgang");
    const st2 = await warteEv(0, `e.n === "lehrgang:start"`, 90000);
    const erster = await warteEv(st2.k, `e.n === "lehrgang:schritt"`, 30000);
    W.ersterSchrittNr = erster.nr;
    W.ersterSchrittPhase = erster.phase;
    await pause(800);
    W.leiste = await p.werte(LEISTE_LESEN);
    W.leisteStriche = (await p.werte(ERFOLG_LESEN)).striche;
    W.bildSchritt = await p.bild(`${geraet}_4b_wiedereinstieg_schritt`);
    log(geraet, "Wiedereinstieg", W.knopf, "-> Schritt", erster.nr, "Speicher", W.speicherVor, "Striche", W.leisteStriche);

    // 5. Ueberspringen — frischer Speicher
    const U = (R.ueberspringen = {});
    await p.s("Storage.clearDataForOrigin", { origin: BASIS.slice(0, -1), storageTypes: "local_storage" });
    await p.s("Page.navigate", { url: BASIS });
    const su = await warteEv(0, `e.n === "lehrgang:start"`, 90000);
    const z1 = await warteEv(su.k, `e.n === "lehrgang:schritt" && e.nr === 1 && e.phase === "zeigen"`, 10000);
    await pause(600);
    await p.tippe("#lg-skip");
    await pause(400);
    U.frage = { leiste: await p.werte(LEISTE_LESEN), text: await p.werte(TEXT_SICHT), bild: await p.bild(`${geraet}_7_rueckfrage`) };
    U.vorfuehrungAbgebrochenDurchSkip = await hatEv(z1.k, `e.n === "lehrgang:vorfuehrungEnde" && e.abgebrochen`);
    await p.tippe("#lg-nein");
    await pause(300);
    U.nachNein = await p.werte(LEISTE_LESEN);
    // laeuft weiter? Schritt 1 nachmachen und das Haekchen sehen
    const du1 = await warteEv(z1.k, `e.n === "lehrgang:schritt" && e.nr === 1 && e.phase === "du"`, 10000);
    await pause(300);
    await nachmachen(1, du1.k);
    U.haekchenNachNein = !!(await warteEv(du1.k, `e.n === "lehrgang:haekchen" && e.nr === 1`, 8000).catch(() => null));
    await warteEv(du1.k, `e.n === "lehrgang:schritt" && e.nr === 2`, 8000);
    await pause(300);
    await p.werte("window.__marke = 'vor Skip'; true");
    await p.tippe("#lg-skip");
    await pause(300);
    await p.tippe("#lg-ja");
    await p.warte("window.__marke !== 'vor Skip' && document.getElementById('hauptmenue')?.classList.contains('open')", 60000);
    await pause(500);
    U.speicher = await p.werte(`localStorage.getItem("schrottplatz_lehrgang")`);
    U.menue = await p.werte(MENUE_LESEN);
    U.menueBild = await p.bild(`${geraet}_8_menue_nach_skip`);
    await p.tippe("#hm-pruefungen");
    await pause(400);
    U.pruefungen = await p.werte(MENUE_LESEN);
    U.pruefungenBild = await p.bild(`${geraet}_9_pruefungen_nach_skip`);
    await p.s("Page.navigate", { url: BASIS });
    await p.warte("document.getElementById('hauptmenue')?.classList.contains('open')", 60000);
    await pause(1500);
    U.naechsterStart = { menueOffen: await p.werte(`document.getElementById("hauptmenue").classList.contains("open")`), lehrgangGestartet: await hatEv(0, `e.n === "lehrgang:start"`) };
    log(geraet, "Ueberspringen", JSON.stringify({ abgebrochen: U.vorfuehrungAbgebrochenDurchSkip, haken: U.haekchenNachNein, speicher: U.speicher, naechster: U.naechsterStart }));

    R.seitenfehler = await p.werte("__smoke.fehler");
    cdp.hoerer.splice(cdp.hoerer.indexOf(hoer), 1);
    writeFileSync(join(AUS, ERGEBNIS_DATEI), JSON.stringify(ergebnis, null, 2));
    await p.zu();
  }
}

/* ---------------- 41-Q: die sechs Pruefungen mit Zielzeile und Kameraflug ---------------- */

const PRUEF_IDS = ["erster-griff", "verladen", "sortieren", "platt-machen", "magnet", "schwere-last"];
/** Auftrag 41-Q: Flugbilder und Tipp im Flug — Pruefung 1, 2, 3, 6 auf dem mini, Pruefung 1 auch auf dem iPad */
const FLUG_PRUEFUNGEN = { mini: ["erster-griff", "verladen", "sortieren", "schwere-last"], ipad: ["erster-griff"], mini1: [] };
/** Flugzeiten fuer die Bilder (s Flugzeit, nicht Wanduhr); 3,0 = Ende = normale Lage */
const FLUG_HALTE = [0.5, 1.0, 2.0];

/** Vor dem ersten Skript (nach VORSKRIPT): Physikschritte zaehlen — ruht die Simulation im Flug? */
const PRUEF_HAKEN = `(() => {
  const S = window.__smoke; S.n = 0;
  const z = setInterval(() => { const g = window.__game; if (!g) return; clearInterval(z); const x = g.excavator, u = x.update;
    x.update = function (...a) { S.n++; return u.apply(this, a); }; }, 5);
})();`;

const KAMERA = `(() => { const o = window.__orbit; if (!o) return null; const c = o.camera, d = c.getWorldDirection(c.position.clone());
  return { modus: o.mode, blick: { ...o.blick }, pos: [c.position.x, c.position.y, c.position.z], dir: [d.x, d.y, d.z], fliegt: o.fliegt, flugT: o.flug ? o.flug.t : null }; })()`;

const BAGGER = `(() => { const x = __game.excavator, S = __smoke;
  return { cab: x.cabYaw, base: x.cabinBaseYaw, boom: x.boomAngle, stick: x.stickAngle, closure: x.closure, x: x.position.x, z: x.position.z, heading: x.heading,
    schritte: S.n, takte: S.taktZahl, taktImFlug: S.taktImFlug, zeitS: S.lauf ? S.lauf.zeitS : null, pausiert: __game.isPaused(),
    kranz: !!document.querySelector("#radial.open, .radial.open"), seite: performance.getEntriesByType("navigation")[0]?.type }; })()`;

/** Zielzeile im DOM: was steht, was ist sichtbar, wo */
const ZZ_LESEN = `(() => { const z = document.getElementById("zielzeile"); if (!z) return null;
  const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height),
    sichtbar: !!(e.checkVisibility ? e.checkVisibility({ visibilityProperty: true, opacityProperty: true }) : e.offsetParent) && b.width > 0 }; };
  const satz = document.getElementById("zz-satz"), t = (satz.textContent || "").trim();
  const knoepfe = {}; for (const id of ["zz-ziel", "zz-pressen", "zz-tipp", "zz-pause", "zz-neu"]) { const e = document.getElementById(id); knoepfe[id] = { ...r(e), aria: e.getAttribute("aria-label") }; }
  return { sichtbar: !z.hidden, zu: z.classList.contains("zu"), uhr: document.getElementById("zz-uhr").textContent,
    sterne: document.querySelectorAll("#zz-sterne .stern:not(.aus)").length, mess: document.getElementById("zz-mess").innerText.trim(), messSichtbar: !document.getElementById("zz-mess").hidden,
    satz: t, satzSichtbar: r(satz).sichtbar, worte: t ? t.split(/\\s+/).length : 0, aria: z.getAttribute("aria-label"), kasten: r(z), knoepfe,
    tutorialOffen: !!document.querySelector("#tutorial.open"), alteKarte: ["tut-neu", "tut-schritt"].filter((id) => { const e = document.getElementById(id); return e && e.offsetParent; }) }; })()`;

/** 41-Q (5): Sortenfarben — Leuchten/Weg am Teil (Materialfarbe aus der Szene) gegen das Schild seiner Zielmulde (Leinwand-Pixel) */
const SORTEN_PROBE = `(async () => {
  const g = __game, T = g.THREE, S = __smoke; const { SORTEN } = await import("/src/materials/sorten.ts");
  const marken = await new Promise((ok) => { let da = false; g.bus.on("challenge:stand", (e) => { if (!da) { da = true; ok(e.marken.map((m) => ({ ...m, nach: m.nach ? { ...m.nach } : null }))); } }); setTimeout(() => ok(null), 3000); });
  let sc = g.excavator.root; while (sc.parent) sc = sc.parent;
  const inst = []; sc.traverse((o) => { if (o.isInstancedMesh && o.instanceColor) inst.push(o); });
  const hof = inst.find((o) => o.geometry.type === "RingGeometry"), weg = inst.find((o) => o.geometry.type === "PlaneGeometry");
  const hex = (h) => (h == null ? null : "#" + h.toString(16).padStart(6, "0"));
  const farbeBei = (n, x, z, ab = 0) => { if (!n) return null; let best = null, bd = 1e9; const m = new T.Matrix4(), p = new T.Vector3(), c = new T.Color();
    for (let i = 0; i < n.count; i++) { n.getMatrixAt(i, m); p.setFromMatrixPosition(m); const d = Math.hypot(p.x - x, p.z - z); if (d >= ab && d < bd) { bd = d; n.getColorAt(i, c); best = { hex: hex(c.getHex()), d: +d.toFixed(2) }; } } return best; };
  // Striche AUF der Strecke Teil → nach (quer < 5 cm): ihre Farben — der naechste Strich am Teil kann zu einem anderen Weg gehoeren
  const wegAuf = (mk) => { if (!weg || !mk.nach) return null; const dx = mk.nach.x - mk.x, dz = mk.nach.z - mk.z, L = Math.hypot(dx, dz), m = new T.Matrix4(), p = new T.Vector3(), c = new T.Color(), farben = {};
    let n = 0; for (let i = 0; i < weg.count; i++) { weg.getMatrixAt(i, m); p.setFromMatrixPosition(m); const ax = p.x - mk.x, az = p.z - mk.z, entlang = (ax * dx + az * dz) / L, quer = Math.abs(ax * dz - az * dx) / L;
      if (quer < 0.05 && entlang >= 1.1 && entlang <= L + 0.1) { n++; weg.getColorAt(i, c); const h = hex(c.getHex()); farben[h] = (farben[h] || 0) + 1; } }
    return { laengeM: +L.toFixed(2), striche: n, farben }; };
  const lauf = S.lauf, wegZiel = lauf.wegZiel, teile = lauf.objekte.teile;
  const zeilen = [];
  for (const mk of (marken || []).filter((m) => m.art === "teil")) {
    let t = null, td = 1e9; for (const q of teile) { const p = q.body.translation(); const d = Math.hypot(p.x - mk.x, p.z - mk.z); if (d < td) { td = d; t = q; } }
    const zielId = t ? wegZiel.get(t.id) ?? null : null, c = zielId ? g.containers.byId(zielId) : null, lab = c && c.label;
    let px = null; if (lab && lab.canvas) { const d = lab.canvas.getContext("2d").getImageData(20, 20, 1, 1).data; px = (d[0] << 16) | (d[1] << 8) | d[2]; }
    zeilen.push({ teil: t && t.shape && t.shape.name, abstandMarkeTeilM: +td.toFixed(2), sorte: mk.sorte ?? null, sorteFarbe: hex(mk.sorte ? SORTEN[mk.sorte].farbe : null), ziel: zielId,
      schildSorte: lab ? lab.sorte : null, schildPixel: hex(px), hof: farbeBei(hof, mk.x, mk.z), naechsterFremdstrich: farbeBei(weg, mk.x, mk.z, 1.2), eigenerWeg: wegAuf(mk),
      nachZurMuldeM: mk.nach && c ? +Math.hypot(mk.nach.x - c.ort.x, mk.nach.z - c.ort.z).toFixed(2) : null });
  }
  return { marken: marken ? marken.length : null, hofGefunden: !!hof, wegGefunden: !!weg, zeilen,
    zielMarken: (marken || []).filter((m) => m.art === "ziel").map((m) => ({ sorte: m.sorte ?? null, x: +m.x.toFixed(2), z: +m.z.toFixed(2) })) };
})()`;

/** 41-Q (4): deutsche Woerter, die in der englischen Fassung nicht vorkommen (Katalog + Bedienwoerter) */
const DEUTSCH_WOERTER = (id) => `(async () => {
  const { challengeNach } = await import("/src/challenges/katalog.ts"); const { WORTE } = await import("/src/ui/aufgabentexte.ts");
  const d = challengeNach(${JSON.stringify(id)});
  const teile = (s) => s.toLowerCase().split(/[^a-z\\u00e4\\u00f6\\u00fc\\u00df0-9]+/).filter((w) => w.length >= 3);
  const de = [], en = [];
  for (const q of [d.kurz, d.ziel, d.name, ...Object.values(WORTE)]) { if (!q || typeof q.de !== "string") continue; de.push(...teile(q.de)); en.push(...teile(q.en ?? "")); }
  const enS = new Set(en); return [...new Set(de.filter((w) => !enS.has(w)))];
})()`;

async function pruefungenSmoke(cdp, neueSeite) {
  const geraet = process.env.SMOKE_GERAET ?? "mini";
  const ids = (process.env.SMOKE_PRUEFUNG ?? PRUEF_IDS.join(",")).split(",");
  const teilAus = new Set((process.env.SMOKE_TEIL ?? "haupt,tipp,tippkurz,englisch,andere,pausebild").split(","));
  const R = (ergebnis.pruefungen = ergebnis.pruefungen ?? {});
  const G = (R[geraet] = { haupt: {}, tipp: {}, englisch: {}, andere: {} });
  const nrVon = (id) => PRUEF_IDS.indexOf(id) + 1;
  const sichere = () => writeFileSync(join(AUS, ERGEBNIS_DATEI), JSON.stringify(ergebnis, null, 2));

  /** Seite mit Konsole, deutsch (oder englisch), Touch */
  const seite = async (sprache = "de", vorab = "") => {
    const p = await neueSeite(geraet);
    const konsole = [];
    const st = { phase: "laden" }; // in welchem Abschnitt eine Meldung kam
    const hoer = (d) => {
      if (d.sessionId !== p.sid) return;
      if (d.method === "Runtime.consoleAPICalled" && ["error", "warning", "warn", "assert"].includes(d.params.type))
        konsole.push(`[${st.phase}] ${d.params.type}: ${d.params.args.map((a) => a.value ?? a.description ?? "").join(" ")}`.slice(0, 300));
      if (d.method === "Runtime.exceptionThrown") konsole.push(`[${st.phase}] exception: ${d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text}`.slice(0, 300));
    };
    cdp.hoerer.push(hoer);
    await p.s("Page.addScriptToEvaluateOnNewDocument", { source: PRUEF_HAKEN });
    if (vorab) await p.s("Page.addScriptToEvaluateOnNewDocument", { source: vorab });
    // Patricks Geraete sind deutsch; Chromium headless meldet sonst en-US (ui/sprache.ts ermittleSprache)
    const ua = (await cdp.send("Browser.getVersion")).userAgent;
    const de = sprache === "de";
    await p.s("Network.setUserAgentOverride", { userAgent: ua, acceptLanguage: de ? "de-DE,de" : "en-GB,en" });
    await p.s("Emulation.setLocaleOverride", { locale: de ? "de-DE" : "en-GB" }).catch(() => null);
    const zu = async () => {
      cdp.hoerer.splice(cdp.hoerer.indexOf(hoer), 1);
      await p.zu();
    };
    const T = (type, pts) => p.s("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, force: 0.5 })) });
    const punkt = async (zone, fx = 0.5, fy = 0.55) =>
      p.werte(`(() => { const b = document.getElementById(${JSON.stringify(zone)}).getBoundingClientRect(); return [Math.round(b.x + b.width * ${fx}), Math.round(b.y + b.height * ${fy})]; })()`);
    const phase = async (ph) => {
      st.phase = ph;
      await p.werte(`(__smoke.phase = ${JSON.stringify(ph)}, true)`).catch(() => null);
    };
    return { ...p, konsole, zu, T, punkt, st, phase };
  };
  // Der erste challenge:start kommt, bevor __game steht (main.ts) — er fehlt in der Mitschrift; geladen = Zielzeile da
  const warteGeladen = (p, ms = 90000) => p.warte("window.__game && document.getElementById('zielzeile') && !document.getElementById('zielzeile').hidden", ms);
  const warteStart = (p, ab = 0, ms = 90000) => p.warte(`__smoke.log.slice(${ab}).find((e) => e.n === "challenge:start") || null`, ms);
  const rad = (v) => +((v * 180) / Math.PI).toFixed(3);
  const abst = (a, b) => +Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]).toFixed(4);
  const winkel = (a, b) => +((Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180) / Math.PI).toFixed(3);
  const baggerDelta = (a, b) => ({
    cabGrad: rad(b.cab - a.cab), boomGrad: rad(b.boom - a.boom), stickGrad: rad(b.stick - a.stick), schliessung: +(b.closure - a.closure).toFixed(4),
    wegM: +Math.hypot(b.x - a.x, b.z - a.z).toFixed(4), headingGrad: rad(b.heading - a.heading), schritte: b.schritte - a.schritte,
  });
  /*
   * Server-Erstlauf: Vite wandelt beim ersten Abruf um und laedt die Seite dabei
   * u. U. neu — die Adresse #challenge= ist dann schon geloescht, und es kaeme
   * das Menue. Darum einmal vorab laden, samt Fahrer-Modul (nicht gemessen).
   */
  {
    const p = await neueSeite(geraet);
    await p.s("Page.navigate", { url: `${BASIS}#challenge=erster-griff` });
    await p.warte("window.__game", 120000).catch(() => null);
    await p.werte(`import("/tools/pruefungsfahrer.ts").then(() => true)`, 120000).catch((e) => log("Erstlauf Fahrer:", String(e)));
    await pause(3000);
    await p.zu();
  }
  const zoneText = async (p) => {
    const t = await p.werte(TEXT_SICHT);
    return { zone: t.zone, inZone: t.inZone, saetze: t.saetze.map((x) => x.text), alle: t.texte.map((x) => x.text) };
  };

  /* ---- A: Hauptlauf je Pruefung — Flug (Bilder), Zielzeile, F3, ↻, Durchfahren, Tafel */
  if (teilAus.has("haupt"))
    for (const id of ids) {
      const nr = nrVon(id),
        mitBildern = FLUG_PRUEFUNGEN[geraet]?.includes(id);
      const A = (G.haupt[id] = { nr });
      const p = await seite("de", mitBildern ? `window.__smoke.flugHalt = ${FLUG_HALTE[0]};` : "");
      try {
        const t0 = Date.now();
        await p.s("Page.navigate", { url: `${BASIS}#challenge=${id}` });
        await warteGeladen(p);
        A.ladeBisStartMs = Date.now() - t0;
        // Flug: kommt er? (ohne Flug liefe der Lauf — dann sind nach 30 Takten keiner mehr zu erwarten)
        A.flug = { gesehen: (await p.warte("__smoke.flugGesehen ? 'ja' : (__smoke.taktZahl > 30 ? 'kein' : null)", 30000).catch(() => "kein")) === "ja" };
        A.flug.start = await p.werte("__smoke.fluege[0] || null");
        
        A.flug.blickVor = await p.werte("__smoke.flugGesehen ? __smoke.flugGesehen.blick : null");
        A.flug.bagger0 = await p.werte(BAGGER);
        if (A.flug.start) {
          const t = A.flug.start.teil,
            z = A.flug.start.ziel;
          A.flug.teilZielM = +Math.hypot(z.x - t.x, z.y - t.y, z.z - t.z).toFixed(2);
        }
        A.flug.bilder = [];
        await p.phase("flug");
        if (A.flug.gesehen && mitBildern) {
          for (let i = 0; i < FLUG_HALTE.length; i++) {
            const h = FLUG_HALTE[i];
            await p.warte(`window.__orbit && window.__orbit.flug && window.__orbit.flug.t >= ${h} - 1e-9`, 60000);
            await p.werte("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))");
            const b = { soll: h, kamera: await p.werte(KAMERA), bagger: await p.werte(BAGGER), zz: await p.werte(ZZ_LESEN), text: await zoneText(p) };
            b.bild = await p.bild(`Q_flug_P${nr}_${geraet}_t${String(h).replace(".", "")}`);
            A.flug.bilder.push(b);
            await p.werte(`(__smoke.flugHalt = ${FLUG_HALTE[i + 1] ?? "null"}, true)`);
          }
        }
        const tFlug = Date.now();
        await p.warte("window.__orbit && !window.__orbit.fliegt", 120000);
        A.flug.wandBisEndeMs = Date.now() - tFlug;
        A.flug.spur = await p.werte(
          `__smoke.flugSpur.map((s) => ({ w: Math.round(s.w), n: s.n, dt: +s.dt.toFixed(3), vor: s.vor === null ? null : +s.vor.toFixed(3), nach: s.nach === null ? null : +s.nach.toFixed(3), pos: s.pos.map((v) => +v.toFixed(3)), dir: s.dir.map((v) => +v.toFixed(4)) }))`
        );
        A.flug.nachEnde = await p.werte(KAMERA);
        A.flug.baggerEnde = await p.werte(BAGGER);
        A.flug.zzEnde = await p.werte(ZZ_LESEN);
        await pause(1000);
        A.flug.nach1s = await p.werte(KAMERA);
        A.flug.bagger1s = await p.werte(BAGGER);
        A.flug.ersteUhrNachFlug = await p.werte("__smoke.lauf ? +__smoke.lauf.zeitS.toFixed(2) : null");
        if (mitBildern) A.flug.bildEnde = await p.bild(`Q_flug_P${nr}_${geraet}_t30`);
        // Sprung am Ende: letztes Flugbild gegen erstes normales Bild
        const sp = A.flug.spur;
        const k = sp.findIndex((s) => s.vor !== null && s.nach === null);
        A.flug.sprungAmEnde = k >= 0 && sp[k - 1] ? { posM: abst(sp[k - 1].pos, sp[k].pos), blickGrad: winkel(sp[k - 1].dir, sp[k].dir) } : null;
        const schrittweiten = [];
        for (let i = 1; i < sp.length; i++) if (sp[i].vor !== null) schrittweiten.push(abst(sp[i - 1].pos, sp[i].pos));
        A.flug.groessterSchrittM = schrittweiten.length ? Math.max(...schrittweiten) : null;
        A.flug.flugbilder = sp.filter((s) => s.vor !== null).length;
        A.flug.ruheImFlug = baggerDelta(A.flug.bagger0, A.flug.baggerEnde);
        // Physikschritte zwischen erstem und letztem Flugbild (S.n zaehlt excavator.update)
        const imFlug = sp.filter((x) => x.vor !== null);
        A.flug.schritteImFlug = imFlug.length ? imFlug.at(-1).n - imFlug[0].n : null;
        A.flug.flugWandMs = imFlug.length ? imFlug.at(-1).w - imFlug[0].w : null;
        A.flug.blickGleich = A.flug.blickVor ? ["modus", "gier", "nick", "abstand"].every((x) => A.flug.blickVor[x] === A.flug.nachEnde.blick[x]) : null;
        A.flug.driftNach1s = { posM: abst(A.flug.nachEnde.pos, A.flug.nach1s.pos), blickGrad: winkel(A.flug.nachEnde.dir, A.flug.nach1s.dir) };
        log(geraet, `P${nr}`, "Flug", JSON.stringify({ gesehen: A.flug.gesehen, wandMs: A.flug.wandBisEndeMs, bilder: A.flug.flugbilder, taktImFlug: A.flug.baggerEnde.taktImFlug, ruhe: A.flug.ruheImFlug, sprung: A.flug.sprungAmEnde, gross: A.flug.groessterSchrittM, blickGleich: A.flug.blickGleich, uhr: A.flug.ersteUhrNachFlug }));

        await p.phase("zielzeile");
        // Zielzeile: Woerter, nach 4 s Aufgabenzeit nur Bilder (Uhr = Pruefungsuhr)
        const Z = (A.zielzeile = {});
        Z.anfang = await p.werte(ZZ_LESEN);
        Z.anfangText = await zoneText(p);
        if (nr === 1 || nr === 2) Z.bildWoerter = await p.bild(`Q_zz_P${nr}_${geraet}_woerter`);
        await p.warte("__smoke.lauf && __smoke.lauf.zeitS >= 4.3", 60000);
        await pause(200);
        Z.nach4s = await p.werte(ZZ_LESEN);
        Z.nach4sText = await zoneText(p);
        Z.nach4sZeit = await p.werte("+__smoke.lauf.zeitS.toFixed(2)");
        await p.phase("zz-bildzu");
        if (nr === 1 || nr === 2) Z.bildZu = await p.bild(`Q_zz_P${nr}_${geraet}_zu`);
        if (nr === 1) {
          // Antippen holt die Woerter zurueck, nach 4 s wieder weg
          await p.phase("zz-antippen");
          await p.tippe("#zz-ziel");
          await pause(300);
          Z.angetippt = await p.werte(ZZ_LESEN);
          Z.angetipptText = await zoneText(p);
          const z0 = await p.werte("__smoke.lauf.zeitS");
          await p.warte(`__smoke.lauf.zeitS >= ${z0} + 4.3`, 60000);
          await pause(200);
          Z.angetippt4s = await p.werte(ZZ_LESEN);
        }
        await p.phase("f3");
        // F3, Koerper
        A.f3 = await p.werte(F3_LESEN);
        A.zahl = await p.werte(
          `(() => { const c = __game.physics.counts(); return { koerper: c.bodies, wach: c.awake, beweglich: c.dynamic, kollider: __game.physics.world.colliders.len(), heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null }; })()`
        );
        if (nr === 1) A.f3Bild = await p.bild(`Q_f3_P${nr}_${geraet}`);
        await p.werte(`(() => { window.dispatchEvent(new KeyboardEvent("keydown", { code: "F3" })); window.dispatchEvent(new KeyboardEvent("keyup", { code: "F3" })); return true; })()`);
        if (id === "sortieren" || id === "magnet") {
          A.sorten = await p.werte(SORTEN_PROBE, 30000);
          A.sortenBild = await p.bild(`Q_sorten_P${nr}_${geraet}`);
        }
        await p.phase("neustart");
        // ↻ per Finger auf #zz-neu: neuer Start ohne Neuladen, kein zweiter Flug, Woerter wieder da
        const N = (A.neustart = {});
        await p.werte("window.__marke = 'gleiche Seite'; true");
        const ab = await p.werte("__smoke.log.length");
        const fluegeVor = await p.werte("__smoke.fluege.length");
        await p.tippe("#zz-neu");
        N.start = !!(await warteStart(p, ab, 8000).catch(() => null));
        await pause(1500);
        N.gleicheSeite = await p.werte("window.__marke === 'gleiche Seite'").catch(() => false);
        N.neuerFlug = (await p.werte("__smoke.fluege.length")) > fluegeVor || (await p.werte("!!(window.__orbit && window.__orbit.fliegt)"));
        N.zz = await p.werte(ZZ_LESEN);
        N.text = await zoneText(p);
        N.uhrAb = await p.werte("+__smoke.lauf.zeitS.toFixed(2)");
        // SMOKE_OHNE_FAHRT=1: nur Flug, Zielzeile, F3, Sortenprobe, ↻ (kurzer Lauf)
        if (process.env.SMOKE_OHNE_FAHRT) throw new Error("ohne Fahrt (SMOKE_OHNE_FAHRT)");
        await p.phase("fahrt");
        // Durchfahren
        await p.werte(`import("/tools/pruefungsfahrer.ts").then((m) => { window.__fahrer = m; return true; })`, 60000);
        await p.warte("__smoke.lauf && __smoke.lauf.zeitS > 0.5", 20000);
        A.uhrBeiFahrtbeginn = await p.werte("+__smoke.lauf.zeitS.toFixed(2)");
        let fahrt = await p.werte(`__fahrer.fahre(${JSON.stringify(id)})`, 900000);
        if (fahrt.wartetAufPressen) {
          A.pressen = { zz: await p.werte(ZZ_LESEN) };
          A.pressen.bild = await p.bild(`Q_zz_P${nr}_${geraet}_pressen`);
          await p.tippe("#zz-pressen");
          await pause(300);
          A.pressen.busPressen = await p.werte(`__smoke.log.some((e) => e.n === "challenge:pressen")`);
          A.pressen.laeuft = await p.werte("__game.press.running");
          A.phase1 = fahrt;
          fahrt = await p.werte(`__fahrer.weiter()`, 900000);
        }
        A.fahrt = fahrt;
        await p.phase("tafel");
        const offen = await p.warte("document.getElementById('abrechnung').classList.contains('open')", 15000).catch(() => false);
        await pause(1500);
        A.tafel = offen
          ? await p.werte(`(() => { const t = (id) => { const e = document.getElementById(id); return e ? e.innerText.replace(/\\n+/g, " | ") : null; };
            return { kopf: t("abr-kopf"), sterneText: t("abr-sterne"), zahlen: t("abr-zahlen") }; })()`)
          : null;
        A.tafelBild = await p.bild(`Q_tafel_P${nr}_${geraet}`);
        A.zzNachGeschafft = await p.werte(ZZ_LESEN);
        A.seitenfehler = await p.werte("__smoke.fehler");
        A.kontext = await p.werte("__smoke.kontext");
      } catch (e) {
        A.abbruch = String(e?.stack ?? e);
        A.abbruchBild = await p.bild(`Q_ABBRUCH_P${nr}_${geraet}`).catch(() => null);
        console.error(e);
      }
      A.konsole = p.konsole;
      log(geraet, `P${nr}`, id, "geschafft", A.fahrt?.geschafft, "Sterne", A.fahrt?.sterne, "Zeit", A.fahrt?.zeitS, "Schritt-ms", JSON.stringify(A.fahrt?.schrittMs), "Koerper", A.zahl?.koerper,
        "F3", (A.f3 ?? "").replace(/\n/g, " | ").slice(0, 200), "Konsole", A.konsole.length, A.abbruch ? "ABBRUCH " + A.abbruch.slice(0, 300) : "");
      sichere();
      await p.zu();
    }

  /* ---- B: Tipp mitten im Flug — sofort Normallage, Ansicht bleibt, Bagger ruht */
  if (teilAus.has("tipp"))
    for (const id of FLUG_PRUEFUNGEN[geraet] ?? []) {
      if (!ids.includes(id)) continue;
      const nr = nrVon(id);
      const B = (G.tipp[id] = { nr });
      const p = await seite("de");
      try {
        await p.s("Page.navigate", { url: `${BASIS}#challenge=${id}` });
        await warteGeladen(p);
        await p.warte("window.__orbit && window.__orbit.flug && window.__orbit.flug.t >= 1.0", 60000);
        B.zone = id === "verladen" ? "zone-mitte" : "zone-right"; // wo der Daumen liegt: rechter Stick; einmal der Mittelstreifen
        const [x, y] = await p.punkt(B.zone);
        B.punkt = [x, y];
        B.vor = { kamera: await p.werte(KAMERA), bagger: await p.werte(BAGGER) };
        const n0 = await p.werte("__smoke.flugSpur.length");
        const t0 = Date.now();
        await p.T("touchStart", [[x, y, 21]]);
        // Halten, bis die Seite den Abbruch sieht (headless 6–12 Bilder/s; ein echter Tipp ist 50–100 ms)
        B.abgebrochen = !!(await p.warte("window.__orbit && !window.__orbit.fliegt", 3000).catch(() => false));
        B.gehaltenMs = Date.now() - t0;
        await p.T("touchEnd", []);
        B.direkt = { kamera: await p.werte(KAMERA), bagger: await p.werte(BAGGER) };
        B.bildDirekt = await p.bild(`Q_tipp_P${nr}_${geraet}_direkt`);
        B.flugbilderBisAbbruch = await p.werte(`__smoke.flugSpur.slice(${n0}).filter((s) => s.vor !== null).length`);
        await pause(1500);
        B.nach15s = { kamera: await p.werte(KAMERA), bagger: await p.werte(BAGGER), zz: await p.werte(ZZ_LESEN) };
        B.bild = await p.bild(`Q_tipp_P${nr}_${geraet}_nach15s`);
        B.ansichtGleich = B.vor.kamera.modus === B.nach15s.kamera.modus;
        B.baggerRuht = baggerDelta(B.vor.bagger, B.nach15s.bagger);
        B.kameraDirektZuNach15s = { posM: abst(B.direkt.kamera.pos, B.nach15s.kamera.pos), blickGrad: winkel(B.direkt.kamera.dir, B.nach15s.kamera.dir) };
        const A = G.haupt[id];
        if (A?.flug?.nach1s) B.gegenVollenFlug = { posM: abst(A.flug.nach1s.pos, B.nach15s.kamera.pos), blickGrad: winkel(A.flug.nach1s.dir, B.nach15s.kamera.dir) };
        B.uhrBeimAbbruch = B.direkt.bagger.zeitS;
        log(geraet, `P${nr}`, "Tipp im Flug", JSON.stringify({ abgebrochen: B.abgebrochen, gehaltenMs: B.gehaltenMs, ansicht: B.ansichtGleich, ruht: B.baggerRuht, kam: B.kameraDirektZuNach15s, gegen: B.gegenVollenFlug, uhr: B.uhrBeimAbbruch, kranz: B.nach15s.bagger.kranz }));
      } catch (e) {
        B.abbruch = String(e?.stack ?? e);
        console.error(e);
      }
      B.konsole = p.konsole;
      sichere();
      await p.zu();
    }

  /* ---- B2: ein kurzer Tipp (80 ms, wie ein Finger auf dem Glas) mitten im Flug — Pruefung 1 */
  if (teilAus.has("tippkurz")) {
    const K = (G.tippKurz = {});
    const p = await seite("de");
    try {
      await p.s("Page.navigate", { url: `${BASIS}#challenge=erster-griff` });
      await warteGeladen(p);
      await p.warte("window.__orbit && window.__orbit.flug && window.__orbit.flug.t >= 1.0", 60000);
      K.fps = await p.werte("new Promise((r) => { const t0 = performance.now(); let n = 0; const f = () => (++n < 10 ? requestAnimationFrame(f) : r(+(9000 / (performance.now() - t0)).toFixed(1))); requestAnimationFrame(f); })");
      const [x, y] = await p.punkt("zone-right");
      K.flugTVor = await p.werte("window.__orbit.flug ? window.__orbit.flug.t : null");
      await p.T("touchStart", [[x, y, 22]]);
      await pause(80);
      await p.T("touchEnd", []);
      await pause(800);
      K.fliegtNoch = await p.werte("!!window.__orbit.fliegt");
      K.flugTNach = await p.werte("window.__orbit.flug ? window.__orbit.flug.t : null");
      K.bagger = await p.werte(BAGGER);
    } catch (e) {
      K.abbruch = String(e?.stack ?? e);
    }
    K.konsole = p.konsole;
    log(geraet, "P1 kurzer Tipp im Flug", JSON.stringify(K));
    sichere();
    await p.zu();
  }

  /* ---- C: Englisch — keine deutschen Woerter in Zielzeile und Bild */
  if (teilAus.has("englisch"))
    for (const id of ids) {
      const nr = nrVon(id);
      const E = (G.englisch[id] = { nr });
      const p = await seite("en", `try { localStorage.setItem("sprache", "en"); } catch (e) {}`);
      try {
        await p.s("Page.navigate", { url: `${BASIS}#challenge=${id}` });
        await warteGeladen(p);
        await p.warte("__smoke.flugGesehen || __smoke.taktZahl > 30", 30000);
        await pause(800);
        const deutsch = await p.werte(DEUTSCH_WOERTER(id));
        E.deutscheWoerterGeprueft = deutsch.length;
        const lies = async () => {
          const t = await zoneText(p),
            zz = await p.werte(ZZ_LESEN);
          const texte = [...t.alle, zz.aria ?? "", zz.satz, ...Object.values(zz.knoepfe).map((k) => k.aria ?? "")];
          const treffer = texte.filter((s) => /[äöüß]/i.test(s) || s.toLowerCase().split(/[^a-zäöüß0-9]+/).some((w) => deutsch.includes(w)));
          return { satz: zz.satz, aria: zz.aria, knoepfe: Object.fromEntries(Object.entries(zz.knoepfe).map(([k, v]) => [k, v.aria])), sichtbar: t.alle, treffer, inZone: t.inZone.map((x) => x.text) };
        };
        E.imFlug = await lies();
        if (nr === 1 || nr === 3) E.bild = await p.bild(`Q_en_P${nr}_${geraet}`);
        await p.warte("window.__orbit && !window.__orbit.fliegt", 120000);
        await pause(500);
        E.nachFlug = await lies();
        log(geraet, `P${nr}`, "EN", JSON.stringify({ satz: E.nachFlug.satz, treffer: [...E.imFlug.treffer, ...E.nachFlug.treffer] }));
      } catch (e) {
        E.abbruch = String(e?.stack ?? e);
        console.error(e);
      }
      E.konsole = p.konsole;
      sichere();
      await p.zu();
    }

  /* ---- D: Lehrgang, Sandkasten, Schicht — kein Flug, keine Fehler, Lehrgangsleiste da */
  if (teilAus.has("andere"))
    for (const art of ["lehrgang", "sandkasten", "schicht"]) {
      const D = (G.andere[art] = {});
      const p = await seite("de");
      try {
        if (art === "lehrgang") {
          await p.s("Page.navigate", { url: BASIS });
          await p.warte("window.__game && document.getElementById('lehrgangsleiste') && !document.getElementById('lehrgangsleiste').hidden", 90000);
        } else if (art === "sandkasten") {
          // Das Menue erscheint erst, wenn schon etwas begonnen wurde: einmal Pruefung 1, dann ohne Adresse
          await p.s("Page.navigate", { url: `${BASIS}#challenge=erster-griff` });
          await warteGeladen(p);
          await p.s("Page.navigate", { url: BASIS });
          await p.warte("document.getElementById('hauptmenue')?.classList.contains('open')", 60000);
          await pause(500);
          await p.tippe("#hm-sandkasten");
          await p.warte("window.__game && window.__smoke.gameMs", 60000);
        } else {
          await p.s("Page.navigate", { url: `${BASIS}#schicht=montag` });
          await p.warte("window.__game && window.__smoke.gameMs", 90000);
        }
        await pause(5000);
        D.fluege = await p.werte("__smoke.fluege.length");
        D.fliegt = await p.werte("!!(window.__orbit && window.__orbit.fliegt)");
        D.flugGesehen = await p.werte("!!__smoke.flugGesehen");
        D.zielzeileSichtbar = await p.werte(`!document.getElementById("zielzeile").hidden`);
        D.leiste = await p.werte(LEISTE_LESEN);
        D.text = await zoneText(p);
        D.seitenfehler = await p.werte("__smoke.fehler");
        D.bild = await p.bild(`Q_${art}_${geraet}`);
        D.f3 = await p.werte(F3_LESEN);
        log(geraet, art, JSON.stringify({ fluege: D.fluege, fliegt: D.fliegt, zz: D.zielzeileSichtbar, leiste: D.leiste && { sichtbar: D.leiste.sichtbar, kasten: D.leiste.kasten, phase: D.leiste.phase }, fehler: D.seitenfehler }));
      } catch (e) {
        D.abbruch = String(e?.stack ?? e);
        console.error(e);
      }
      D.konsole = p.konsole;
      sichere();
      await p.zu();
    }

  /*
   * ---- E (zuletzt): Pause. Headless verlor Chromium bei offenem Pausenmenue den WebGL-Kontext — auf dem mini beim
   * PNG des Menues, auf dem iPad schon beim Oeffnen ueber Escape (alter Weg ☰) — und sperrte WebGL danach fuer die
   * naechste Seite („Web page caused context loss and was blocked"). Darum steht die Pause allein am Ende.
   */
  if (teilAus.has("pausebild")) {
    const p = await seite("de");
    const P = (G.pause = {});
    try {
      await p.s("Page.navigate", { url: `${BASIS}#challenge=erster-griff` });
      await warteGeladen(p);
      await p.warte("window.__orbit && !window.__orbit.fliegt", 120000);
      await pause(1000);
      // ⏸ oeffnet das Pausenmenue (Bus spiel:pause), die Pruefungsuhr steht
      await p.phase("zz-pause");
      await p.tippe("#zz-pause");
      await pause(500);
      const u0 = await p.werte("__smoke.lauf.zeitS");
      await pause(1500);
      P.zz = {
        pausiert: await p.werte("__game.isPaused()"),
        menueOffen: await p.werte(`document.getElementById("pause").classList.contains("open")`),
        uhrSteht: (await p.werte("__smoke.lauf.zeitS")) === u0,
        busPause: await p.werte(`__smoke.log.some((e) => e.n === "spiel:pause")`),
        kontextVorBild: await p.werte("__smoke.kontext.length"),
      };
      await p.phase("zz-pausebild");
      P.bild = await p.bild(`Q_zz_P1_${geraet}_pause`, true);
      await p.phase("zz-weiter");
      await p.tippe("#pause-resume");
      await pause(800);
      P.zz.weiter = !(await p.werte("__game.isPaused()"));
      // Gegenprobe ueber den alten Weg (Escape wie ☰)
      await p.phase("esc-pause");
      const esc = `(() => { window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape" })); setTimeout(() => window.dispatchEvent(new KeyboardEvent("keyup", { code: "Escape" })), 50); return true; })()`;
      await p.werte(esc);
      await pause(2000);
      P.esc = { pausiert: await p.werte("__game.isPaused()") };
      await p.werte(esc);
      await pause(1500);
      P.esc.weiter = !(await p.werte("__game.isPaused()"));
      P.kontext = await p.werte("__smoke.kontext");
    } catch (e) {
      P.abbruch = String(e?.stack ?? e);
    }
    P.konsole = p.konsole;
    log(geraet, "Pause", JSON.stringify({ ...P, konsole: P.konsole.length }));
    sichere();
    await p.zu();
  }
}

/* ---------------- Ablauf ---------------- */
let vite = null;
let chrome = null;
let profil = null;
try {
  log("Dev-Server starten …");
  vite = spawn(process.execPath, [join(V1, "node_modules/vite/bin/vite.js"), "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"], {
    cwd: V1,
    stdio: "ignore",
  });
  await warteHttp(BASIS, 30000);

  profil = mkdtempSync(join(tmpdir(), "aufgaben-smoke-profil-"));
  chrome = spawn(
    findeChromium(),
    [
      "--headless=new",
      // Port 0: Chromium waehlt selbst (feste Ports kollidierten mit sterbenden Vorgaengern)
      "--remote-debugging-port=0",
      `--user-data-dir=${profil}`,
      "--no-first-run",
      "--no-default-browser-check",
      // Echte Grafikkarte (D3D11). SwiftShader (SMOKE_ANGLE=swiftshader) brauchte hier ~11 s je Bild auf dem iPad-Format
      `--use-angle=${process.env.SMOKE_ANGLE ?? "d3d11"}`,
      "--enable-unsafe-swiftshader",
      "--enable-gpu",
      // Ohne: GPU-Prozess endet mit 0xC0000022 (Zugriff verweigert), Chromium beendet sich ("GPU process isn't usable")
      "--disable-gpu-sandbox",
      "--no-sandbox", // dito fuer den Renderer: Page.enable kam sonst nie zurueck
      "--ignore-gpu-blocklist",
      "--autoplay-policy=no-user-gesture-required",
      "--enable-precise-memory-info",
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  const portDatei = join(profil, "DevToolsActivePort");
  for (let k = 0; k < 200 && !existsSync(portDatei); k++) await pause(100);
  const cdpPort = readFileSync(portDatei, "utf8").split("\n")[0].trim();
  const version = await (await warteHttp(`http://127.0.0.1:${cdpPort}/json/version`, 20000)).json();
  const cdp = await Cdp.verbinde(version.webSocketDebuggerUrl);
  ergebnis.browser = version.Browser;

  /** Neue Seite in eigenem Kontext (= leerer Speicher, leerer Cache). */
  const neueSeite = async (geraet, drossel = 1) => {
    const { browserContextId } = await cdp.send("Target.createBrowserContext", { disposeOnDetach: true });
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank", browserContextId });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const s = (m, p, frist) => cdp.send(m, p, sessionId, frist);
    await s("Page.enable");
    await s("Runtime.enable");
    await s("Network.enable");
    await s("Emulation.setDeviceMetricsOverride", GERAETE[geraet]);
    await s("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await s("Emulation.setCPUThrottlingRate", { rate: drossel });
    await s("Page.addScriptToEvaluateOnNewDocument", { source: VORSKRIPT });
    const werte = async (expr, frist) => {
      const r = await s("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }, frist);
      if (r.exceptionDetails) throw new Error(`Seite: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
      return r.result.value;
    };
    const warte = async (expr, ms = 120000) => {
      const ende = Date.now() + ms;
      while (Date.now() < ende) {
        try {
          const v = await werte(expr);
          if (v) return v;
        } catch {
          /* Seite laedt gerade */
        }
        await pause(50);
      }
      throw new Error(`Zeitueberschreitung: ${expr}`);
    };
    const bild = async (name, schnell = false) => {
      // 41-Q: Im Pausenmenue scheiterte das PNG headless einmal („Unable to capture screenshot") — dann einmal als JPEG
      const r = await s("Page.captureScreenshot", schnell ? { format: "jpeg", quality: 85, optimizeForSpeed: true } : { format: "png" }).catch(async () => {
        await pause(300);
        schnell = true;
        return s("Page.captureScreenshot", { format: "jpeg", quality: 90 });
      });
      const { data } = r;
      const pfad = join(AUS, `${name}.${schnell ? "jpg" : "png"}`);
      writeFileSync(pfad, Buffer.from(data, "base64"));
      return pfad;
    };
    /** Echter Finger: touchStart/touchEnd auf die Mitte eines Elements. */
    const tippe = async (sel) => {
      const r = await werte(`(() => { const b = document.querySelector(${JSON.stringify(sel)})?.getBoundingClientRect(); return b && b.width ? [b.x + b.width / 2, b.y + b.height / 2] : null; })()`);
      if (!r) throw new Error(`nicht tippbar: ${sel}`);
      const punkt = [{ x: r[0], y: r[1], id: 1, force: 0.5 }]; // force 1 (CDP-Vorgabe) waere „Druckgriff" (touch.ts checkPressure)
      await s("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: punkt });
      await pause(60);
      await s("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    const zu = () => cdp.send("Target.disposeBrowserContext", { browserContextId }).catch(() => null);
    return { s, sid: sessionId, werte, warte, bild, tippe, zu };
  };
  /** Bis die Karte offen ist und zwei Bilder gezeichnet sind (ms ab Navigationsstart). */
  // 41-Q: bereit = Zielzeile da UND Kameraflug vorbei (waehrend des Flugs ruht die Simulation)
  const karteBereit = (p) => p.warte("window.__smoke && window.__smoke.karteMs > 0 && window.__game && !(window.__orbit && window.__orbit.fliegt) && window.__smoke.karteMs");
  const ladeMs = async (p) => {
    await karteBereit(p);
    return p.werte("({ karteMs: Math.round(__smoke.karteMs), karteOffenMs: Math.round(__smoke.karteOffenMs), dclMs: Math.round(performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd ?? -1), anfragen: performance.getEntriesByType('resource').length, gameMs: Math.round(__smoke.gameMs), fehler: __smoke.fehler })");
  };

  const NUR = process.env.SMOKE_NUR ?? "";
  ablauf: {
  if (NUR === "aufgaben") {
    // Q2: Aufgaben 2-6 je Geraet — Erstbild, Lage, F3, ↻, Geisterdaumen-Probe
    const ids = (process.env.SMOKE_AUFGABE ?? "verladen,sortieren,platt-machen,magnet,schwere-last").split(",");
    ergebnis.aufgaben = {};
    for (const id of ids) {
      for (const geraet of ["mini", "ipad"]) {
        const p = await neueSeite(geraet);
        const konsole = [];
        const hoer = (d) => {
          if (d.sessionId !== p.sid) return;
          if (d.method === "Runtime.consoleAPICalled" && ["error", "warning", "warn", "assert"].includes(d.params.type))
            konsole.push(`${d.params.type}: ${d.params.args.map((a) => a.value ?? a.description ?? "").join(" ")}`.slice(0, 300));
          if (d.method === "Runtime.exceptionThrown") konsole.push(`exception: ${d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text}`.slice(0, 300));
        };
        cdp.hoerer.push(hoer);
        await p.s("Page.navigate", { url: `${BASIS}#challenge=${id}` });
        await karteBereit(p);
        const r = { erstes: await p.bild(`${id}_${geraet}_1_erstes-bild`), lage1: await p.werte(LAGE), proj1: await p.werte(PROJEKTION(id)) };
        await pause(3000);
        r.nach3 = await p.bild(`${id}_${geraet}_2_nach-3s`);
        r.lage2 = await p.werte(LAGE);
        r.proj2 = await p.werte(PROJEKTION(id));
        r.f3 = await p.werte(F3_LESEN);
        await p.s("HeapProfiler.collectGarbage");
        r.vorher = await p.werte(ZUSTAND);
        if (id === "schwere-last") {
          // Pratzen ab (Taste O), warten bis ganz unten — ↻ muss sie einfahren (main.ts starteAufgabe)
          await p.werte(`(() => { window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyO" })); setTimeout(() => window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyO" })), 100); return true; })()`);
          await p.warte("__game.excavator.abgestuetzt", 15000).catch(() => null);
          r.pratzenVorNeustart = await p.werte(ZUSTAND);
        }
        await p.werte(`__game.bus.emit("challenge:neustart", {}); true`);
        await pause(2000);
        await p.s("HeapProfiler.collectGarbage");
        r.nachBus = await p.werte(ZUSTAND);
        r.nachBusBild = await p.bild(`${id}_${geraet}_3_nach-neustart`);
        // Geisterdaumen: dort aufsetzen, in Pfeilrichtung ziehen, ~1 s halten — bewegt sich die Funktion des Schritts richtig?
        r.geist = await p.werte(`(() => { const e = document.querySelector("#geisterdaumen .geist.an"); if (!e) return null; const b = e.getBoundingClientRect();
          return { seite: e.classList.contains("links") ? "links" : "rechts", pfeil: e.dataset.pfeil, x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
        if (r.geist && ["links", "rechts", "hoch", "runter"].includes(r.geist.pfeil)) {
          const { x, y, pfeil } = r.geist;
          const weg = { links: [-1, 0], rechts: [1, 0], hoch: [0, -1], runter: [0, 1] }[pfeil];
          const vor = await p.werte(ZUSTAND);
          // Start und erster Zug ohne Warten dazwischen: bei 6-12 fps (headless) waeren sonst zwei Bilder
          // "still" = 0,5 s >= RADIAL_HOLD_S, und rechts klappt der Funktionskranz auf (touch.ts update)
          const anf = p.s("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 7, force: 0.5 }] });
          await p.s("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + weg[0] * 14, y: y + weg[1] * 14, id: 7, force: 0.5 }] });
          await anf;
          for (let k = 2; k <= 6; k++) {
            await pause(30);
            await p.s("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + weg[0] * 14 * k, y: y + weg[1] * 14 * k, id: 7, force: 0.5 }] });
          }
          await pause(1200);
          const nach = await p.werte(ZUSTAND);
          await p.s("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
          const los = await p.werte(ZUSTAND);
          await pause(1500);
          const spaeter = await p.werte(ZUSTAND);
          r.geistBild = await p.bild(`${id}_${geraet}_4_geist-gezogen`);
          r.geistProbe = { gierVor: vor.gierGrad, gierNach: nach.gierGrad, gierLos: los.gierGrad, gierLos15: spaeter.gierGrad, zuVor: vor.schliessung, zuNach: nach.schliessung, zuLos15: spaeter.schliessung,
            magnetVor: vor.magnetAn, magnetNach: nach.magnetAn, magnetLos15: spaeter.magnetAn, pratzeSollNach: spaeter.pratzeSoll, kranz: await p.werte("!!document.querySelector(\".radial.open, #radial.open\")").catch(() => null) };
        }
        await pause(500);
        // ↻ per Finger auf den Knopf (nach Drehen/Schliessen — kein Fahren, also ohne Neuladen)
        await p.werte("window.__marke = 'gleiche Seite'; true");
        await p.tippe("#zz-neu");
        await pause(2000);
        await p.s("HeapProfiler.collectGarbage");
        r.nachFinger = await p.werte(ZUSTAND);
        r.nachFinger.gleicheSeite = await p.werte("window.__marke === 'gleiche Seite'").catch(() => false);
        r.seitenfehler = await p.werte("__smoke.fehler");
        r.konsole = konsole;
        cdp.hoerer.splice(cdp.hoerer.indexOf(hoer), 1);
        ergebnis.aufgaben[`${id}/${geraet}`] = r;
        log(id, geraet, "Karte", JSON.stringify(r.lage1.karte), "Koerper", r.vorher.koerper, r.nachBus.koerper, r.nachFinger.koerper, "Geist", JSON.stringify(r.geist), JSON.stringify(r.geistProbe ?? null), "Konsole", konsole.length);
        writeFileSync(join(AUS, ERGEBNIS_DATEI), JSON.stringify(ergebnis, null, 2));
        await p.zu();
      }
    }
    break ablauf;
  }
  if (NUR === "pruefungen") {
    await pruefungenSmoke(cdp, neueSeite);
    break ablauf;
  }
  if (NUR === "lehrgang") {
    await lehrgangSmoke(cdp, neueSeite);
    break ablauf;
  }
  if (!NUR) {
  /* --- 0: Server-Erstlauf (Vite wandelt beim allerersten Abruf um; nicht Teil der Tabelle) */
  {
    const p = await neueSeite("mini");
    await p.s("Page.navigate", { url: BASIS });
    ergebnis.serverErstlauf = await ladeMs(p);
    await p.zu();
    log("Server-Erstlauf", ergebnis.serverErstlauf);
  }

  /* --- 1: Ladezeiten, Erststart und Rueckfall-Neustart */
  ergebnis.ladezeiten = [];
  for (const drossel of [1, 4]) {
    for (let lauf = 1; lauf <= LAEUFE; lauf++) {
      const p = await neueSeite("mini", drossel);
      // kalt: frischer Kontext, leerer Cache und Speicher
      await p.s("Page.navigate", { url: BASIS });
      const kalt = await ladeMs(p);
      // warm: Cache bleibt, Speicher geleert -> wieder Erststart
      await p.werte("window.__smoke.karteMs = 0");
      await p.s("Storage.clearDataForOrigin", { origin: BASIS.slice(0, -1), storageTypes: "local_storage" });
      await p.s("Page.navigate", { url: BASIS });
      const warm = await ladeMs(p);
      // Rueckfall-Neustart warm: genau das, was `nochmal(id)` tut
      await p.werte(`window.__smoke.karteMs = 0; location.hash = "challenge=erster-griff"; location.reload(); true`).catch(() => null);
      await pause(100);
      const rueckWarm = await ladeMs(p);
      // Rueckfall-Neustart kalt: Cache vorher geleert
      await p.s("Network.clearBrowserCache");
      await p.werte(`window.__smoke.karteMs = 0; location.hash = "challenge=erster-griff"; location.reload(); true`).catch(() => null);
      await pause(100);
      const rueckKalt = await ladeMs(p);
      const zeile = { drossel, lauf, kalt, warm, rueckWarm, rueckKalt };
      ergebnis.ladezeiten.push(zeile);
      log("Ladezeit", drossel, lauf, kalt.karteMs, warm.karteMs, rueckWarm.karteMs, rueckKalt.karteMs);
      await p.zu();
    }
  }

  } // Ende !NUR
  /* --- 2: Erststart-Bilder auf beiden Geraeten */
  ergebnis.bilder = {};
  for (const geraet of NUR ? ["ipad"] : ["mini", "ipad"]) {
    const p = await neueSeite(geraet);
    await p.s("Page.navigate", { url: BASIS });
    await karteBereit(p);
    const erstes = await p.bild(`${geraet}_1_erstes-bild`);
    const lage1 = await p.werte(LAGE);
    await pause(3000);
    const nach3 = await p.bild(`${geraet}_2_nach-3s`);
    const lage2 = await p.werte(LAGE);
    const zahl = await p.werte(ZAEHLE);
    ergebnis.bilder[geraet] = { erstes, nach3, lage1, lage2, zahl };
    if (geraet === "mini") await p.zu();
    else ergebnis.ipadSeite = p; // weiter unten benutzt
  }

  /* --- 3..6 auf dem iPad */
  const p = ergebnis.ipadSeite;
  delete ergebnis.ipadSeite;
  ergebnis.aufgabeF3 = await p.werte(F3_LESEN);
  ergebnis.aufgabeZahl = await p.werte(ZAEHLE);
  await p.bild("ipad_3_f3-aufgabe");

  // ↻ ohne Neuladen, 5x ueber den Bus, dann 1x per Finger auf den Knopf
  ergebnis.neustart = [];
  await p.s("HeapProfiler.collectGarbage");
  ergebnis.neustartVorher = await p.werte(ZAEHLE);
  await p.werte("window.__marke = 'gleiche Seite'; true");
  for (let n = 1; n <= (NUR ? 0 : 6); n++) {
    const weg = n <= 5 ? "bus" : "finger";
    let dauer;
    if (weg === "bus") {
      dauer = await p.werte(`(async () => {
        const g = __game;
        if (!g.items.__gemessen) { const alt = g.items.settle; g.items.settle = function (...a) { const t = performance.now(); const r = alt.apply(this, a); window.__settleMs = performance.now() - t; return r; }; g.items.__gemessen = true; }
        const t0 = performance.now(); const vor = __smoke.log.length;
        __game.bus.emit("challenge:neustart", {});
        const tStart = (__smoke.log.slice(vor).find((e) => e.n === "challenge:start") || {}).t;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return { bisStartMs: tStart ? +(tStart - t0).toFixed(1) : null, settleMs: +(window.__settleMs ?? -1).toFixed(1), bisBildMs: +(performance.now() - t0).toFixed(1) };
      })()`);
    } else {
      const vor = await p.werte("__smoke.log.length");
      const t0 = Date.now();
      await p.tippe("#zz-neu");
      await p.warte(`__smoke.log.slice(${vor}).some((e) => e.n === "challenge:start")`, 5000);
      dauer = { finger: true, wandMs: Date.now() - t0 };
    }
    await pause(1500); // ein paar Bilder laufen lassen (Uhr, Ruhe)
    await p.s("HeapProfiler.collectGarbage");
    const z = await p.werte(ZAEHLE);
    z.gleicheSeite = await p.werte("window.__marke === 'gleiche Seite'");
    ergebnis.neustart.push({ n, weg, dauer, ...z });
    log("Neustart", n, weg, JSON.stringify(dauer), z.koerper, z.items, z.boiler, z.netze, z.schritt, z.uhr, z.heapMB);
  }
  await p.bild("ipad_4_nach-neustart");

  // Durchlauf Aufgabe 1
  ergebnis.durchlaufA = await p.werte(DURCHLAUF);
  log("Durchlauf A", JSON.stringify(ergebnis.durchlaufA));
  // Schritt 6 wie ein Mensch: dem Geisterdaumen folgen — aufsetzen, wo er steht, in Pfeilrichtung ziehen
  ergebnis.geistSchritt6 = await p.werte(`(() => { const e = document.querySelector("#geisterdaumen .geist.an"); if (!e) return null; const b = e.getBoundingClientRect();
    return { seite: e.classList.contains("links") ? "links" : "rechts", pfeil: e.dataset.pfeil, x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  await p.bild("ipad_4b_schritt6-geist");
  if (ergebnis.geistSchritt6) {
    const { x, y, pfeil } = ergebnis.geistSchritt6;
    const weg = { links: [-1, 0], rechts: [1, 0], hoch: [0, -1], runter: [0, 1] }[pfeil] ?? [0, 0];
    await p.s("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 7, force: 0.5 }] });
    for (let k = 1; k <= 6; k++) {
      await pause(30);
      await p.s("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + weg[0] * 14 * k, y: y + weg[1] * 14 * k, id: 7, force: 0.5 }] });
    }
  }
  ergebnis.durchlauf = await p.werte(DURCHLAUF);
  await p.s("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  log("Durchlauf", JSON.stringify(ergebnis.durchlauf));
  if (ergebnis.durchlauf.geschafft) {
    await p.warte("document.getElementById('abrechnung').classList.contains('open')", 10000);
    await pause(1500); // Sterne-Animation
    ergebnis.tafel = await p.werte(`(() => { const t = (id) => { const e = document.getElementById(id); return e ? { text: e.innerText, versteckt: e.hidden } : null; };
      return { kopf: t("abr-kopf"), sterne: t("abr-sterne"), zahlen: t("abr-zahlen"), nochmal: t("abr-weiter"), naechste: t("abr-naechste"), menue: t("abr-menue"),
        ablage: localStorage.getItem("schrottplatz_challenges") }; })()`);
    ergebnis.tafelBild = await p.bild("ipad_5_abschlusstafel");
    // NOCHMAL: der Bagger ist nur gedreht, nicht gefahren -> Neuaufbau ohne Neuladen
    const vor = await p.werte("__smoke.log.length");
    await p.tippe("#abr-weiter");
    await p.warte(`__smoke.log.slice(${vor}).some((e) => e.n === "challenge:start")`, 5000).catch(() => null);
    await pause(1500);
    ergebnis.nachNochmal = await p.werte(ZAEHLE);
    ergebnis.nachNochmal.gleicheSeite = await p.werte("window.__marke === 'gleiche Seite'");
    await p.bild("ipad_6_nach-nochmal");
  }

  // Rueckfall: Bagger > 1 m fahren, dann ↻ -> neu laden
  await p.werte(`(async () => { const g = __game; g.autoStep(false); window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
    const s0 = g.excavator.position.clone(); window.__s0 = s0;
    for (let k = 0; k < 600 && g.excavator.position.distanceTo(s0) < 1.6; k++) { g.step(1); if (k % 4 === 3) await new Promise((r) => requestAnimationFrame(r)); }
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW" })); g.autoStep(true); return true; })()`);
  ergebnis.rueckfallFahrweg = await p.werte("+__game.excavator.position.distanceTo(window.__s0).toFixed(2)");
  await p.werte("window.__smoke.karteMs = 0");
  await p.tippe("#zz-neu");
  await pause(300);
  ergebnis.rueckfall = await ladeMs(p);
  ergebnis.rueckfall.neueSeite = await p.werte("window.__marke !== 'gleiche Seite'");
  ergebnis.rueckfall.zahl = await p.werte(ZAEHLE);
  log("Rueckfall", JSON.stringify(ergebnis.rueckfall));

  // Menue: ohne Adresse neu laden (Ablage ist gesetzt)
  await p.s("Page.navigate", { url: BASIS });
  await p.warte("document.getElementById('hauptmenue')?.classList.contains('open')", 60000);
  await pause(500);
  ergebnis.menue = await p.werte(`[...document.querySelectorAll("#hauptmenue button")].map((b) => ({ id: b.id, text: b.innerText.replace(/\\n/g, " / "), gesperrt: b.disabled }))`);
  ergebnis.menueBild = await p.bild("ipad_7_menue");
  await p.tippe("#hm-sandkasten");
  await p.warte("window.__game && window.__smoke.gameMs", 60000);
  await pause(4000); // Platz zur Ruhe kommen lassen
  ergebnis.sandkastenF3 = await p.werte(F3_LESEN);
  ergebnis.sandkastenZahl = await p.werte(ZAEHLE);
  await p.bild("ipad_8_f3-sandkasten");
  ergebnis.seitenfehler = await p.werte("__smoke.fehler");
  await p.zu();
  } // Ende ablauf
} catch (e) {
  ergebnis.abbruch = String(e?.stack ?? e);
  console.error(e);
} finally {
  writeFileSync(join(AUS, ERGEBNIS_DATEI), JSON.stringify(ergebnis, null, 2));
  toete(chrome);
  toete(vite);
  try {
    if (profil) rmSync(profil, { recursive: true, force: true, maxRetries: 5 });
  } catch {
    /* Chromium haelt das Profil noch — liegt im Temp-Ordner */
  }
  log(`Ergebnis: ${join(AUS, ERGEBNIS_DATEI)}`);
}
