import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/*
 * Die Zeile, ohne die das Platzinventar nicht wiederkommt.
 *
 * E-031 hat drei Stuecke gebaut, die zusammengehoeren: die Gattung
 * `ScrapShape.inventar` samt `inventarNachtragen()` in `scrapItems.ts`, den
 * Tageszaehler `neuerTag` in `daylight.ts` — und die Verdrahtung in `main.ts`,
 * die beide verbindet. Die ersten beiden hat der Agent geliefert; die dritte
 * lag ausserhalb seines Bereichs und wurde beim Zusammenfuehren nachgetragen.
 *
 * Genau so etwas geht verloren. Zwei fertige Haelften und eine fehlende Zeile
 * sehen im Quelltext aus wie fertige Arbeit — und auf dem Geraet merkt man es
 * erst, wenn der Besen nach dem ersten Missgeschick nie wiederkommt, also
 * fruehestens am naechsten Spieltag.
 *
 * Deshalb wird hier der Zusammenhang bewacht, nicht die Funktion: Gibt es die
 * beiden Haelften, muss es auch die Verdrahtung geben.
 */

const wurzel = resolve(__dirname, "..");
const lies = (p: string) => readFileSync(resolve(wurzel, p), "utf8");

const main = lies("src/main.ts");
const daylight = lies("src/world/daylight.ts");
const scrapItems = lies("src/world/scrapItems.ts");
const vehicles = lies("src/delivery/vehicles.ts");

describe("Platzinventar kommt am naechsten Tag wieder", () => {
  it("beide Haelften sind da: der Tageszaehler und das Nachlegen", () => {
    expect(daylight, "daylight.ts kennt keinen Tageswechsel").toContain("neuerTag");
    expect(scrapItems, "scrapItems.ts kann nichts nachlegen").toContain("inventarNachtragen");
  });

  it("und main.ts verbindet sie — sonst ist beides wirkungslos", () => {
    expect(main, "main.ts fragt `neuerTag` nie ab").toContain("daylight.neuerTag");
    expect(main, "main.ts legt nie nach").toContain("items.inventarNachtragen()");
  });

  it("der Zaehler wird zurueckgesetzt, sonst legt jedes Bild nach", () => {
    /*
     * `neuerTag` ist ein Merker, kein Ereignis: Wer ihn abfragt, muss ihn
     * loeschen. Bliebe er stehen, liefe `inventarNachtragen()` in jedem Bild
     * — es ist zwar idempotent, aber es waere eine Schleife ueber alle Teile
     * des Platzes, 48-mal je Sekunde, bis zum naechsten Mitternacht.
     */
    const block = main.slice(main.indexOf("if (daylight.neuerTag)"));
    const ende = block.indexOf("}");
    expect(block.slice(0, ende), "der Merker wird nicht geloescht").toContain(
      "daylight.neuerTag = false"
    );
  });

  it("und der Abholer bringt Platzinventar zurueck, statt es mitzunehmen", () => {
    /*
     * Dieselbe Klasse Fehler, ein Paket spaeter: `ContainerAbholung` in
     * `delivery/` und `leereBehaelter` in `world/containers.ts` waren beide
     * gebaut und haben sich nicht gekannt. Ohne die Zeile in `main.ts` faehrt
     * der Muellcontainer mit dem Abholer davon und ist weg — gemerkt haette man
     * es erst, wenn er fehlt.
     */
    expect(main, "main.ts kennt ContainerAbholung nicht").toContain("ContainerAbholung");
    expect(main, "vehicles.platzinventar wird nie gesetzt").toMatch(
      /vehicles\.platzinventar\s*=\s*new ContainerAbholung\(/
    );
  });

  it("und der Abholer-Funkspruch kommt im HUD an", () => {
    /*
     * Dieselbe Klasse zum dritten Mal: `onPickupFunk` ist in `vehicles.ts`
     * gebaut und feuert, wenn der Abholer steht — aber ohne die Zeile in
     * `main.ts` hoert es niemand. Zwei fertige Haelften, eine fehlende Zeile.
     *
     * Und hier faellt es besonders spaet auf: Der Funkspruch ist seit E-056
     * der EINZIGE Weg, auf dem der Spieler erfaehrt, wo der Abholer haelt.
     * Ohne ihn sucht er den halben Platz ab und haelt es fuer einen Fehler
     * der Wegfindung.
     */
    expect(main, "onPickupFunk wird nie verdrahtet").toMatch(
      /vehicles\.onPickupFunk\s*=/
    );
    const block = main.slice(main.indexOf("vehicles.onPickupFunk"));
    expect(block.slice(0, 200), "der Spruch landet nirgends").toContain("hud.toast");
  });

  it("und beide Wiegungen des Abholers kommen im HUD an", () => {
    /*
     * Dieselbe Klasse zum vierten Mal (E-064). `vehicles.ts` wiegt den
     * Abholer jetzt leer herein und voll hinaus und meldet beides ueber
     * `onAbholerTara` / `onAbholerBrutto`. Fehlt eine der beiden Zeilen in
     * `main.ts`, faellt genau die halbe Wiegung aus — und zwar stumm: Der
     * Wagen haelt trotzdem auf der Bruecke, es sagt nur niemand etwas dazu.
     *
     * Geprueft wird mit einer Funktion, damit es dieselbe Pruefung ist, die
     * gleich darunter die Gegenprobe bekommt.
     */
    const verdrahtet = (quelle: string, name: string): boolean => {
      const stelle = quelle.search(new RegExp(`vehicles\\.${name}\\s*=`));
      if (stelle < 0) return false;
      return quelle.slice(stelle, stelle + 300).includes("hud.toast");
    };
    for (const name of ["onAbholerTara", "onAbholerBrutto"]) {
      expect(verdrahtet(main, name), `${name} landet nicht im HUD`).toBe(true);
      expect(vehicles, `vehicles.ts kennt ${name} nicht`).toContain(name);
    }

    /*
     * GEGENPROBE mit dem kaputten Eingang: Wer die Zeile herausnimmt, muss
     * gemeldet werden — sonst prueft die Schleife oben nur, dass es die Datei
     * gibt.
     */
    const ohne = main.replace(/vehicles\.onAbholerBrutto\s*=/, "const weg =");
    expect(ohne, "die Gegenprobe hat gar nichts veraendert").not.toBe(main);
    expect(verdrahtet(ohne, "onAbholerBrutto"), "die Gegenprobe meldet nichts").toBe(false);
    // Und eine Verdrahtung, die ins Leere laeuft, gilt auch nicht.
    const stumm = main.replace(/vehicles\.onAbholerTara = \(tara\) =>[\s\S]{0,200}?;/, "");
    expect(verdrahtet(stumm, "onAbholerTara"), "eine stumme Meldung gilt als verdrahtet").toBe(
      false
    );
  });

  it("und die Wiegung des Abholers ruehrt das Konto nicht an", () => {
    /*
     * Patrick, mehrfach: „Kreislaufsachen noch nicht." Die Wiegung ist eine
     * Meldung — kein Geld, kein Konto, keine Preisaenderung. Bezahlt wird die
     * Fuhre weiterhin beim Losfahren vom Verladeplatz (`onPickupDepart`).
     */
    const stelle = main.search(/vehicles\.onAbholerTara\s*=/);
    expect(stelle, "onAbholerTara fehlt ganz").toBeGreaterThan(0);
    const block = main.slice(stelle, main.indexOf("vehicles.onCustomerArrived", stelle));
    expect(block.length, "der Block ist leer — so prueft das hier nichts").toBeGreaterThan(50);
    for (const verboten of ["account.", "preisFaktor", "shift."]) {
      expect(block, `die Wiegung fasst ${verboten} an`).not.toContain(verboten);
    }
  });

  it("der Spieler erfaehrt davon", () => {
    /*
     * Ein Werkzeug, das ueber Nacht zurueckkommt, ohne dass es jemand sagt,
     * sucht man am naechsten Morgen an der falschen Stelle.
     */
    // P4b (Auftrag 41f): statt Textbox ein Pfeil ueber jedem Stueck (ui/ortszeichen.ts)
    const block = main.slice(main.indexOf("if (daylight.neuerTag)"));
    expect(block.slice(0, block.indexOf("}") + 400)).toContain('bus.emit("inventar:zurueck"');
  });

  it("und die Abrechnung der Abholung haengt am HUD — in BEIDEN Zweigen", () => {
    /*
     * Dieselbe Klasse zum fuenften Mal, und diesmal an der teuersten Stelle
     * (E-086). `onPickupDepart` ist der einzige Weg, auf dem eine Abholung zu
     * Geld wird. Fehlte die Zeile in `main.ts`, faehre jeder Abholer umsonst
     * und niemand saehe, warum.
     *
     * Geprueft werden BEIDE Zweige. Patrick hat am 16.09.2026 genau daran
     * gemerkt, dass etwas nicht stimmt — nicht am Kontostand, sondern daran,
     * dass GAR KEINE Meldung kam. Eine Abrechnung, die bei null Kilo still
     * bleibt, sieht fuer den Spieler aus wie ein kaputtes Spiel.
     */
    const stelle = main.search(/vehicles\.onPickupDepart\s*=/);
    expect(stelle, "onPickupDepart wird in main.ts nie verdrahtet").toBeGreaterThan(0);
    // Der Block reicht bis zum Ende der Zuweisung — grosszuegig, aber begrenzt.
    const block = main.slice(stelle, stelle + 900);
    expect(block, "die Abrechnung fragt nie, was auf der Flaeche liegt").toContain(
      "containedItems"
    );
    expect(block, "es wird nie verkauft").toContain("sellContainer");
    expect(block, "der Umschlagszaehler waechst nie").toContain("noteTurnover");
    // Zwei Meldungen, eine je Ausgang: voll und leer.
    expect(block, "die volle Fuhre wird nicht gemeldet").toContain("Verkauft:");
    expect(block, "die leere Fuhre wird nicht gemeldet").toContain("Container war leer");

    /*
     * GEGENPROBE mit dem kaputten Eingang: Wer den Leer-Zweig herausnimmt, muss
     * auffallen — sonst prueft die Liste oben nur, dass es die Datei gibt.
     */
    const ohne = main.replace(/hud\.toast\("Container war leer[^;]*;/, "");
    expect(ohne, "die Gegenprobe hat gar nichts veraendert").not.toBe(main);
    const ohneBlock = ohne.slice(ohne.search(/vehicles\.onPickupDepart\s*=/), stelle + 900);
    expect(ohneBlock.includes("Container war leer"), "die Gegenprobe meldet nichts").toBe(false);
  });

  it("und jeder Ausgang des Abholers geht durch dieselbe Abrechnung (E-086)", () => {
    /*
     * DIE ZWEITE HAELFTE DESSELBEN FEHLERS, und sie liegt in `vehicles.ts`.
     *
     * Bis zum 16.09.2026 gab es ZWEI Ausgaenge fuer ein Ereignis: Der Fall
     * „waitLoad" (Taste V, Standzeit) setzte `justDeparted` und meldete den
     * Funkspruch — `sendAway()` (Taste J, „zur Waage schicken") setzte nur die
     * Phase. Ueber den zweiten Weg fuhr die Ladung bezahlungslos vom Hof.
     *
     * Geprueft wird der Zusammenhang, nicht die Zahl: Beide Ausgaenge muessen
     * dieselbe Stelle rufen, und `justDeparted` darf NUR dort gesetzt werden.
     * Wer spaeter einen dritten Ausgang baut und ihn hier vorbeifuehrt, faellt
     * auf. Was dabei herauskommt, misst `test/abfahrtswege.test.ts`.
     */
    expect(vehicles, "die eine Abrechnungsstelle fehlt").toContain("abholerFaehrtRaus");
    // Genau eine Stelle setzt den Merker — und das ist die Methode selbst.
    const setzt = vehicles.match(/this\.justDeparted\s*=\s*true/g) ?? [];
    expect(setzt.length, "justDeparted wird an mehr als einer Stelle gesetzt").toBe(1);
    // Und beide Ausgaenge rufen sie.
    const rufe = vehicles.match(/this\.abholerFaehrtRaus\(\)/g) ?? [];
    expect(rufe.length, "nicht beide Ausgaenge gehen durch die Abrechnung").toBeGreaterThanOrEqual(
      2
    );
    // `sendAway()` ist einer davon — das war der Weg, der Patrick gekostet hat.
    const ab = vehicles.indexOf("sendAway(): boolean {");
    expect(ab, "sendAway gibt es gar nicht mehr").toBeGreaterThan(0);
    expect(
      vehicles.slice(ab, ab + 400),
      "sendAway faehrt wieder an der Abrechnung vorbei"
    ).toContain("abholerFaehrtRaus()");

    /*
     * GEGENPROBE: Nimmt man den Aufruf aus `sendAway()` heraus, muss die
     * Pruefung oben anschlagen. Ohne sie waere sie gruen, solange das Wort
     * irgendwo in der Datei steht.
     */
    const kaputt = vehicles.replace(/this\.abholerFaehrtRaus\(\);\r?\n(\s*)\/\/ Was noch oben/, "$1// Was noch oben");
    expect(kaputt, "die Gegenprobe hat gar nichts veraendert").not.toBe(vehicles);
    const abK = kaputt.indexOf("sendAway(): boolean {");
    expect(
      kaputt.slice(abK, abK + 400).includes("abholerFaehrtRaus()"),
      "die Gegenprobe meldet nichts"
    ).toBe(false);
  });

  it("und `zurWaage` schickt auch den Abholer — sonst ist der Befund ein anderer", () => {
    /*
     * Der Weg, den Patrick genommen hat. `zurWaage()` schliesst den Abholer
     * ABSICHTLICH nicht aus (anders als `VehicleManager.sendAway()`, das nur
     * Anlieferer wegschickt): „Zur Waage" heisst beim Abholer „fahr raus, ich
     * bin fertig". Stuende hier ein Ausschluss, waere der Fehler von E-086
     * anders behoben — dann duerfte diese Datei das sagen, und der Waechter
     * darueber muesste angepasst werden.
     */
    const stelle = vehicles.indexOf("zurWaage():");
    expect(stelle, "zurWaage gibt es nicht mehr").toBeGreaterThan(0);
    const block = vehicles.slice(stelle, stelle + 260);
    expect(block, "zurWaage schickt niemanden mehr weg").toContain("sendAway()");
    expect(block, 'zurWaage schliesst den Abholer aus — dann gilt E-086 nicht mehr').not.toContain(
      '"abholer"'
    );
  });
});
