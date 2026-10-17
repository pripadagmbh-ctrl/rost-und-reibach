/**
 * TONWERK (E-130, 16.10.2026) — schneidet die Rohaufnahmen zu Spiel-Ausschnitten.
 *
 *     node tools/tonwerk/tonwerk.mjs schneiden          → public/ton/*.wav + QUELLEN.md
 *     node tools/tonwerk/tonwerk.mjs analyse <ordner>   → Spektrogramme und Kennzahlen
 *
 * Warum ein Browser und kein ffmpeg: Auf dem Arbeitsrechner gibt es kein
 * ffmpeg (Stand 16.10.2026, nichts installiert). Es gibt aber den Chromium,
 * den Playwright fuer die Bildschirmfotos mitgebracht hat — und der kann Ogg
 * Vorbis und MP3 dekodieren, schneiden, filtern und neu abtasten
 * (OfflineAudioContext). Dieser Knoten-Diener liefert ihm die Rohdateien aus
 * `ton-roh/` und die Rezepte aus `rezepte.mjs`, nimmt die fertigen WAV-Dateien
 * per POST zurueck und schreibt sie ab. Nur lokal, nur 127.0.0.1.
 *
 * Steht ffmpeg spaeter bereit, bleiben die Rezepte gueltig; nur das Ausgabe-
 * format (WAV) koennte dann kleiner werden.
 */
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { REZEPTE, QUELLEN, ABTASTRATE } from "./rezepte.mjs";

const HIER = dirname(fileURLToPath(import.meta.url));
const V1 = resolve(HIER, "../..");
const ROH = resolve(V1, "ton-roh");
const modus = process.argv[2] ?? "schneiden";
const ziel = resolve(modus === "schneiden" ? resolve(V1, "public/ton") : process.argv[3] ?? ".");
mkdirSync(ziel, { recursive: true });

/** Chromium aus dem Playwright-Vorrat — der neueste, der da ist. */
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

/** Analyse: alle Rohdateien, die als Argumente kommen (relativ zu ton-roh). */
const analyseListe = process.argv.slice(4);

const auftrag = { modus, abtastrate: ABTASTRATE, rezepte: REZEPTE, analyse: analyseListe };

let browser = null;
const fertig = (code) => {
  try {
    browser?.kill();
  } catch {
    /* schon weg */
  }
  server.close();
  process.exitCode = code;
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  if (req.method === "GET" && url === "/") {
    res.setHeader("content-type", "text/html");
    res.end('<!doctype html><meta charset="utf-8"><script type="module" src="/seite.js"></script>');
    return;
  }
  if (req.method === "GET" && url === "/seite.js") {
    res.setHeader("content-type", "text/javascript");
    res.end(readFileSync(join(HIER, "seite.js")));
    return;
  }
  if (req.method === "GET" && url === "/auftrag.json") {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(auftrag));
    return;
  }
  if (req.method === "GET" && (url.startsWith("/roh/") || url.startsWith("/ton/"))) {
    // Nur innerhalb von ton-roh/ bzw. public/ton/ — kein Weg nach draussen
    const basis = url.startsWith("/roh/") ? ROH : resolve(V1, "public/ton");
    const p = normalize(join(basis, url.slice(5)));
    if (!p.startsWith(basis + sep) || !existsSync(p)) {
      res.statusCode = 404;
      res.end();
      return;
    }
    res.end(readFileSync(p));
    return;
  }
  if (req.method === "POST") {
    const teile = [];
    req.on("data", (c) => teile.push(c));
    req.on("end", () => {
      const body = Buffer.concat(teile);
      if (url === "/log") console.log(body.toString("utf8"));
      else if (url === "/fehler") {
        console.error("FEHLER: " + body.toString("utf8"));
        fertig(1);
      } else if (url === "/fertig") {
        if (modus === "schneiden") schreibeQuellen(JSON.parse(body.toString("utf8")));
        console.log("fertig.");
        fertig(0);
      } else if (url.startsWith("/out/")) {
        const name = url.slice(5).replace(/[^A-Za-z0-9._-]/g, "");
        writeFileSync(join(ziel, name), body);
      }
      res.end("ok");
    });
    return;
  }
  res.statusCode = 404;
  res.end();
});

/** QUELLEN.md aus den Rezepten: je Ausschnitt Herkunft, Lizenz, Schnitt. */
function schreibeQuellen(bericht) {
  const z = [];
  z.push("# Tonquellen (E-130)");
  z.push("");
  z.push("Alle Dateien in diesem Ordner sind **Ausschnitte** aus den unten genannten Aufnahmen,");
  z.push(`geschnitten, gefiltert und gemischt mit \`tools/tonwerk/\` (Rezepte: \`tools/tonwerk/rezepte.mjs\`).`);
  z.push(`Format: WAV, 16 bit, mono, ${ABTASTRATE} Hz (wo in der Tabelle nicht anders angegeben). Die Rohdateien liegen nicht im Repository (\`v1/ton-roh/\`, siehe .gitignore).`);
  z.push("");
  z.push("## Rohquellen");
  z.push("");
  z.push("| Kürzel | Aufnahme | Adresse | Lizenz |");
  z.push("|---|---|---|---|");
  for (const [k, q] of Object.entries(QUELLEN)) z.push(`| ${k} | ${q.name} | ${q.url} | [${q.lizenz}](${q.lizenzUrl}) |`);
  z.push("");
  z.push("## Ausschnitte");
  z.push("");
  z.push("| Datei | Dauer | Wofür | Herausgeschnitten aus |");
  z.push("|---|---|---|---|");
  for (const r of REZEPTE) {
    const b = bericht[r.name];
    const herkunft = (r.schichten ?? [])
      .map((s) => `${s.q.replace("A/x/Audio/", "A/").replace("I/x/", "I/")} ab ${(s.von ?? 0).toFixed(2)} s, ${s.dauer != null ? s.dauer.toFixed(2) + " s" : "ganz"}${s.rate && s.rate !== 1 ? `, Tempo ×${s.rate}` : ""}`)
      .concat(r.streu ? [`Streuung aus ${r.streu.quellen.map((s) => s.q.replace("A/x/Audio/", "A/")).join(", ")} (${r.streu.anzahl} Schläge)`] : [])
      .join("; ");
    z.push(`| ${r.name}.wav | ${b ? b.dauer.toFixed(2) + " s" + (b.rate !== ABTASTRATE ? `, ${b.rate / 1000} kHz` : "") : "?"} | ${r.wofuer} | ${herkunft} |`);
  }
  z.push("");
  z.push("Kürzel in der Spalte „Herausgeschnitten aus“: `A/…` Kenney Impact Sounds, `I/…` OpenGameArt 100 CC0 metal and wood SFX, `B/`–`F/` und `J/`–`L/` BigSoundBank (Nummer = Dateiname), `H/…` Pixabay-Greifkran (Pixabay Content License: Einbau ins Spiel erlaubt, die Datei für sich allein darf nicht weitergegeben werden — deshalb liegen hier nur Ausschnitte, gemischt mit anderen Klängen).");
  z.push("");
  writeFileSync(join(ziel, "QUELLEN.md"), z.join("\n"));
}

server.listen(0, "127.0.0.1", () => {
  const port = server.address().port;
  const profil = resolve(process.env.TEMP ?? homedir(), "tonwerk-profil");
  // --no-sandbox: Der Playwright-Chromium darf unter Windows ohne Playwright
  // seine eigene Datei nicht lesen ("Sandbox cannot access executable") —
  // Playwright startet ihn genauso. Geladen werden nur die eigenen Rohdateien.
  browser = spawn(
    findeChromium(),
    ["--headless=new", "--disable-gpu", "--no-first-run", "--no-sandbox", `--user-data-dir=${profil}`, `http://127.0.0.1:${port}/`],
    { stdio: "ignore" }
  );
  console.log(`Tonwerk auf Port ${port}, Modus ${modus}, Ziel ${ziel}`);
});
// Sicherung: nach 5 min ist etwas haengen geblieben
setTimeout(() => {
  console.error("Zeitueberschreitung");
  fertig(2);
}, 300_000).unref();
