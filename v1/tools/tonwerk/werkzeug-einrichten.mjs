/**
 * Einmal ausfuehren, bevor das Tonwerk schneidet (E-159): legt ffmpeg fuer die
 * AAC-Kodierung nach tools/tonwerk/werkzeug/ — ausserhalb von package.json,
 * damit weder `npm ci` im Deploy noch das Spiel davon etwas mitbekommt.
 * ffmpeg-static bringt ein fertiges ffmpeg (GPL) mit; es wird nur hier als
 * Werkzeug benutzt und nie ausgeliefert.
 *
 *     npm run ton:werkzeug
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ORT = join(dirname(fileURLToPath(import.meta.url)), "werkzeug");
mkdirSync(ORT, { recursive: true });
writeFileSync(join(ORT, ".gitignore"), "*\n");
if (!existsSync(join(ORT, "package.json"))) writeFileSync(join(ORT, "package.json"), '{ "private": true }\n');
execSync("npm install --no-save ffmpeg-static@5.3.0", { cwd: ORT, stdio: "inherit" });
// npm fuehrt das Ladeskript nicht immer aus (allow-scripts) — dann von Hand
execSync("node node_modules/ffmpeg-static/install.js", { cwd: ORT, stdio: "inherit" });
console.log("ffmpeg bereit.");
