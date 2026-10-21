import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join, relative } from "node:path";

/*
 * E-191 (Patrick, 21.10.2026): „Schere wird Presse heißen."
 *
 * Waechter: Kein SICHTBARER Text sagt mehr „Schere"/„Shear". Gesucht wird in
 * Zeichenketten der Quelltexte (Kommentare duerfen die Geschichte erzaehlen),
 * in der Seite ohne HTML-Kommentare und in den Store-Texten.
 */

const wurzel = resolve(__dirname, "..");
const VERBOTEN = /schere|shear/i;

function tsDateien(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) tsDateien(p, out);
    else if (e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

/** Nur die Zeichenketten eines Quelltexts — Kommentare fallen heraus. */
export function zeichenketten(text: string): string[] {
  const re = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g;
  return [...text.matchAll(re)].map((m) => m[0]).filter((t) => !t.startsWith("//") && !t.startsWith("/*"));
}

describe("Die Presse heisst Presse (E-191)", () => {
  it("keine Zeichenkette in src/ sagt Schere oder Shear", () => {
    const funde: string[] = [];
    for (const p of tsDateien(resolve(wurzel, "src"))) {
      for (const s of zeichenketten(readFileSync(p, "utf8"))) {
        if (VERBOTEN.test(s)) funde.push(`${relative(wurzel, p)}: ${s.slice(0, 80)}`);
      }
    }
    expect(funde).toEqual([]);
  });

  it("die Seite und die Store-Texte auch nicht", () => {
    const seite = readFileSync(resolve(wurzel, "index.html"), "utf8").replace(/<!--[\s\S]*?-->/g, "");
    expect(seite.split("\n").filter((z) => VERBOTEN.test(z))).toEqual([]);
    const store = resolve(wurzel, "docs/store");
    for (const f of readdirSync(store).filter((n) => n.endsWith(".md"))) {
      const zeilen = readFileSync(join(store, f), "utf8").split("\n");
      expect(zeilen.filter((z) => VERBOTEN.test(z)), f).toEqual([]);
    }
  });

  it("GEGENPROBE: eine Zeichenkette wird gefunden, ein Kommentar nicht", () => {
    const probe = '// die Schere\nconst a = "Schere: los"; /* Shear */';
    expect(zeichenketten(probe).filter((s) => VERBOTEN.test(s))).toEqual(['"Schere: los"']);
  });
});
