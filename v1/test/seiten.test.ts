/**
 * Datenschutz, Lizenzen, Support (E-171): Die Seiten liegen im App-Paket,
 * gehen offline, sind zweisprachig, und nichts öffnet einen Browser im Spiel.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const wurzel = resolve(__dirname, "..");
const lies = (p: string): string => readFileSync(resolve(wurzel, p), "utf8");
const SEITEN = ["datenschutz.html", "lizenzen.html", "support.html"];

describe("die drei Seiten in public/ (landen in dist/ und im App-Paket)", () => {
  for (const s of SEITEN) {
    it(`${s}: da, zweisprachig, Stil vorhanden`, () => {
      const html = lies(`public/${s}`);
      expect(html).toContain('id="de"');
      expect(html).toContain('id="en"');
      expect(html).toContain('href="seiten.css"');
      expect(existsSync(resolve(wurzel, "public/seiten.css"))).toBe(true);
      expect(html).toContain('name="viewport"');
    });
    it(`${s}: fremde Adressen öffnen außerhalb (Safari), eigene sind relativ`, () => {
      const html = lies(`public/${s}`);
      for (const m of html.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>/g)) {
        const [tag, ziel] = m;
        if (/^https?:/.test(ziel)) expect(tag, `${s}: ${ziel} ohne target="_blank"`).toContain('target="_blank"');
        else if (!ziel.startsWith("mailto:") && !ziel.startsWith("#")) {
          expect(ziel.startsWith("/"), `${s}: ${ziel} ist absolut`).toBe(false);
          expect(existsSync(resolve(wurzel, "public", ziel.split("#")[0])), `${s}: ${ziel} fehlt`).toBe(true);
        }
      }
    });
  }

  // E-194: Anbieter ist eine Privatperson; Name, Anschrift, E-Mail, Telefon trägt Patrick ein
  const ANBIETER = ["[Vor- und Nachname]", "[Anschrift]", "[E-Mail]", "[Telefon]"].map((t) => `<span class="platz">${t}</span>`);

  it("Datenschutz: Verantwortlicher ist die Privatperson, Angaben noch Platzhalter", () => {
    const html = lies("public/datenschutz.html");
    expect(html).toContain("„Rost &amp; Reibach“");
    expect(html).toContain("“Rost &amp; Reibach”");
    for (const p of ANBIETER) expect(html, p).toContain(p);
  });

  it("Support: Impressum auf der Seite selbst (DE+EN), mit Copyright", () => {
    const html = lies("public/support.html");
    expect(html).toContain('href="#impressum"');
    expect(html).toContain('id="impressum"');
    expect(html).toContain('id="legal"');
    for (const p of ANBIETER) expect(html, p).toContain(p);
    expect(html).toContain('© 2026 <span class="platz">[Vor- und Nachname]</span>');
    expect(lies("public/lizenzen.html")).toContain('© 2026 <span class="platz">[Vor- und Nachname]</span>');
  });

  it("Lizenzen: three.js, Rapier, Capacitor samt Lizenztext, und jede Tonquelle", () => {
    const html = lies("public/lizenzen.html");
    for (const w of ["three.js", "MIT License", "Rapier", "Apache License", "Capacitor", "Pixabay Content License", "CC0"]) {
      expect(html, w).toContain(w);
    }
    const quellen = lies("public/ton/QUELLEN.md");
    const roh = quellen.slice(quellen.indexOf("## Rohquellen"), quellen.indexOf("## Ausschnitte"));
    const adressen = [...roh.matchAll(/https:\/\/[^\s|)]+/g)].map((m) => m[0]);
    expect(adressen.length).toBeGreaterThan(10);
    for (const a of adressen) expect(html, `Tonquelle fehlt: ${a}`).toContain(a);
  });
});

describe("im Spiel: Pausenmenü und Rahmen", () => {
  const seite = lies("index.html");
  it("je ein Knopf mit data-seite, der auf eine vorhandene Seite zeigt", () => {
    for (const s of SEITEN) expect(seite, s).toMatch(new RegExp(`<button id="pause-\\w+" data-seite="${s}">`));
  });
  it("Rahmen und Zurück-Knopf stehen auf der Seite, ui/seiten.ts verdrahtet sie", () => {
    for (const id of ["seite", "seite-rahmen", "seite-zu"]) expect(seite).toContain(`id="${id}"`);
    const ts = lies("src/ui/seiten.ts");
    expect(ts).toContain("[data-seite]");
    expect(ts).toContain('getElementById("seite-zu")');
  });
  it("Pages-Deploy liefert dist/ unter /v1/ aus (Workflow nur geprüft, nicht geändert)", () => {
    const wf = readFileSync(resolve(wurzel, "../.github/workflows/deploy.yml"), "utf8");
    expect(wf).toContain("cp -r v1/dist/. site/v1/");
    expect(lies("vite.config.ts")).toContain('base: "./"');
  });
});
