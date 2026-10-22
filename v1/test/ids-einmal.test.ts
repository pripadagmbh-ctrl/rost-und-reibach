/**
 * KEINE ID ZWEIMAL IN index.html (Auftrag 43a-N).
 *
 * Der neue ⏸ hiess zuerst wie der Kranz-Eintrag PAUSE (`btn-pause`). Er stand
 * davor, `getElementById` fand ihn statt des Eintrags: Ein Tipp auf ⏸ oeffnete
 * zusaetzlich das Menue, der Kranz-Eintrag verlor seine Bindung. Der Wächter
 * gilt fuer ALLE Ids, nicht nur diese.
 */
import { describe, it, expect } from "vitest";
import { seite } from "./cssmass";

/** Ids im Markup — ohne HTML-Kommentare (dort stehen Beispiele). */
function ids(html: string): string[] {
  const ohne = html.replace(/<!--[\s\S]*?-->/g, "");
  return [...ohne.matchAll(/\sid\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]);
}

function doppelte(html: string): string[] {
  const n = new Map<string, number>();
  for (const id of ids(html)) n.set(id, (n.get(id) ?? 0) + 1);
  return [...n].filter(([, k]) => k > 1).map(([id]) => id);
}

describe("index.html: jede Id nur einmal", () => {
  it("keine doppelte Id", () => {
    expect(ids(seite).length).toBeGreaterThan(50);
    expect(doppelte(seite)).toEqual([]);
  });

  it("⏸ und Kranz-Eintrag PAUSE haben verschiedene Ids", () => {
    expect(ids(seite)).toContain("btn-halt");
    expect(ids(seite)).toContain("btn-pause");
  });

  it("GEGENPROBE: der alte Fehler faellt auf", () => {
    expect(doppelte(`<div id="btn-pause"></div><!-- id="x" --><span id='btn-pause'>PAUSE</span><b id="x"></b>`)).toEqual(["btn-pause"]);
  });
});
