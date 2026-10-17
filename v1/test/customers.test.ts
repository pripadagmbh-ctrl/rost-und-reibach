import { describe, it, expect } from "vitest";
import {
  FAMILIES,
  TRADES,
  rollCustomer,
  vehicleForCustomer,
  MINDEST_FUHRE_KG,
  type CustomerProfile,
} from "../src/delivery/customers";
import { NUTZLAST } from "../src/delivery/fuellgrad";
import { Reputation, REP_MAX } from "../src/economy/reputation";
import { getMaterial } from "../src/materials/catalog";

/** Viele Ziehungen, damit auch seltene Fälle vorkommen. */
function ziehe(n: number): CustomerProfile[] {
  return Array.from({ length: n }, () => rollCustomer());
}

describe("Kundschaft", () => {
  it("liefert alle drei Gruppen", () => {
    const gruppen = new Set(ziehe(400).map((c) => c.group));
    expect(gruppen).toContain("privat");
    expect(gruppen).toContain("haendler");
    expect(gruppen).toContain("gewerbe");
  });

  it("hält die Mengen je Gruppe auseinander", () => {
    for (const c of ziehe(500)) {
      if (c.group === "privat") {
        /*
         * Bis zum 15.09.2026 stand hier `toBeLessThan(800)` mit der Begründung
         * „Privat bringt Kofferraummengen", und darunter `>= 50`. Beides ist
         * überstimmt: Patrick am Gerät — „eigentlich kommen Händler erst, wenn
         * ihre LKWs randvoll sind … mindestens mal über 600, 700 Kilo Minimum".
         *
         * Was von der alten Prüfung gilt: Der Privatmann bleibt das untere Ende
         * der Spanne — das prüft die Zeile weiter unten gegen die 1000 kg der
         * gewerblichen Gruppen. Was nicht mehr gilt: dass er mit einem
         * Kofferraum voll vorfährt. Für eine Fuhre von 50 kg fährt niemand los.
         *
         * Die Untergrenze selbst bewacht `test/lademenge.test.ts` über alle
         * Gruppen zugleich.
         *
         * NACHTRAG 15.09.2026 nachmittags (E-033): Seit die Masse aus dem
         * Füllgrad folgt (Masse = Füllgrad × Laderaum × Schüttdichte), ist die
         * 600-kg-Grenze für den Privatmann keine Regel mehr. Sein Anhänger
         * fasst 2,40 m³; ein Viertel davon voll Holz und Kunststoff wiegt rund
         * 300 kg, und der Füllgrad gewinnt. Was bleibt: Er fährt nicht mit
         * einer Handvoll Blech vor, und er wird nie zum Händler.
         */
        expect(c.massKg, "Privat lohnt die Fahrt").toBeGreaterThanOrEqual(MINDEST_FUHRE_KG);
        expect(c.massKg, "Privat bleibt unter einer Händlerfuhre").toBeLessThan(2000);
      } else {
        /*
         * Wer einen LKW bewegt, bringt eine Fuhre. Die Obergrenze ist keine
         * gewürfelte Zahl mehr, sondern die Nutzlast seines Wagens — ein
         * Kipper trägt 9,5 t, eine Pritsche 8,5 t, und ein Händler, der ein
         * Wrack abschleppt, bringt dessen 950 kg.
         */
        expect(c.massKg, `${c.group} bringt Fuhren`).toBeGreaterThanOrEqual(600);
        expect(c.massKg, `${c.group} passt auf seinen Wagen`).toBeLessThanOrEqual(
          NUTZLAST[c.vehicle]
        );
      }
    }
  });

  it("lässt nur Gewerbe zuverlässig sortenrein liefern", () => {
    const proben = ziehe(600);
    const gewerbe = proben.filter((c) => c.group === "gewerbe");
    const privat = proben.filter((c) => c.group === "privat");
    expect(gewerbe.every((c) => c.sortedMaterial !== null), "Gewerbe trennt im Betrieb").toBe(true);
    expect(privat.every((c) => c.sortedMaterial === null), "Haushalt ist gemischt").toBe(true);
  });

  it("gibt Privatleuten den höchsten Störstoffanteil", () => {
    const proben = ziehe(600);
    const mittel = (g: string): number => {
      const l = proben.filter((c) => c.group === g);
      return l.reduce((s, c) => s + c.contaminantShare, 0) / l.length;
    };
    expect(mittel("privat")).toBeGreaterThan(mittel("haendler"));
  });

  it("macht Händler zu den härtesten Verhandlern", () => {
    const proben = ziehe(600);
    const maxHaerte = (g: string): number =>
      Math.max(...proben.filter((c) => c.group === g).map((c) => c.hardness));
    expect(maxHaerte("haendler")).toBeGreaterThan(maxHaerte("privat"));
    expect(maxHaerte("haendler")).toBeGreaterThan(maxHaerte("gewerbe"));
  });

  it("schickt jede Gruppe im passenden Fahrzeug", () => {
    for (const c of ziehe(400)) {
      const v = vehicleForCustomer(c);
      expect(["kipper", "pritsche", "wrack", "pkw", "absetzer"]).toContain(v);
      if (c.group === "privat") {
        // Privat kommt mit dem eigenen Wagen, nie mit einem LKW
        expect(["pkw", "wrack"], `${c.name}`).toContain(v);
      } else {
        expect(v, `${c.group} fährt keinen PKW`).not.toBe("pkw");
      }
    }
  });

  it("sagt es, statt zu würfeln, wenn im Profil kein Fahrzeug steht", () => {
    /*
     * BEFUND 15.09.2026 (E-044). Hier stand `c.vehicle ?? rollFahrzeug(...)`.
     * Ein Prüfstand, der von Hand ein Profil baut und „Kipper" meint, bekam
     * damit gelegentlich eine Pritsche untergeschoben — und der Wächter blieb
     * grün. Ein stiller Rückfall auf den Zufall ist schlimmer als ein
     * Absturz: Er macht aus einem kaputten Profil ein anderes, plausibles.
     *
     * Ein Profil ohne Fahrzeug ist außerdem widersprüchlich, nicht nur
     * unvollständig: Seine Kilogramm sind aus einem Laderaum gerechnet, den
     * es angeblich nicht gibt.
     */
    const halb = { ...ziehe(1)[0]!, vehicle: undefined } as unknown as CustomerProfile;
    expect(() => vehicleForCustomer(halb)).toThrow(/ohne Fahrzeug/);
  });

  it("und jedes gewürfelte Profil bringt sein Fahrzeug selbst mit", () => {
    for (const c of ziehe(200)) {
      expect(c.vehicle, `${c.name} kommt ohne Fahrzeug`).toBeTruthy();
      expect(vehicleForCustomer(c)).toBe(c.vehicle);
    }
  });

  it("gibt jedem Kunden einen Namen und ein Wort", () => {
    for (const c of ziehe(200)) {
      expect(c.name.length).toBeGreaterThan(2);
      expect(c.subtitle.length).toBeGreaterThan(2);
      expect(c.greeting.length).toBeGreaterThan(4);
    }
  });
});

describe("Stammfiguren", () => {
  it("hat alle acht Händlerfamilien mit Sprüchen", () => {
    expect(FAMILIES).toHaveLength(8);
    for (const f of FAMILIES) {
      expect(f.family.length, "Familienname").toBeGreaterThan(3);
      expect(f.firstName.length, `${f.family} braucht einen Vornamen`).toBeGreaterThan(2);
      expect(f.hardness).toBeGreaterThanOrEqual(1);
      expect(f.hardness).toBeLessThanOrEqual(5);
      expect(f.greetings.length, `${f.family} braucht Sprüche`).toBeGreaterThanOrEqual(2);
      if (f.typical) expect(() => getMaterial(f.typical!)).not.toThrow();
    }
  });

  it("nennt für jede Branche ein bekanntes Material", () => {
    expect(TRADES.length).toBeGreaterThanOrEqual(6);
    for (const t of TRADES) {
      expect(() => getMaterial(t.material), `${t.name}`).not.toThrow();
      expect(t.beifang).toBeGreaterThanOrEqual(0);
      expect(t.beifang, `${t.name} soll nicht überwiegend Beifang liefern`).toBeLessThan(0.5);
    }
  });

  it("hat für jede Familie einen eigenen Namen", () => {
    const namen = FAMILIES.map((f) => f.family);
    expect(new Set(namen).size).toBe(namen.length);
  });
});

describe("Ruf", () => {
  it("beginnt neutral", () => {
    const r = new Reputation();
    expect(r.get("privat")).toBe(0);
    expect(r.label("haendler")).toBe("neutral");
  });

  it("trifft Privatleute am härtesten, wenn man drückt", () => {
    const r = new Reputation();
    r.note("hartGedrueckt", "privat");
    const privat = r.get("privat");
    const r2 = new Reputation();
    r2.note("hartGedrueckt", "haendler");
    expect(privat).toBeLessThan(r2.get("haendler"));
  });

  it("lässt Gewerbe nur die Zuverlässigkeit zählen", () => {
    const preis = new Reputation();
    preis.note("hartGedrueckt", "gewerbe");
    expect(preis.get("gewerbe"), "Preis ist Gewerbe gleich").toBe(0);

    const zeit = new Reputation();
    zeit.note("langeWartenLassen", "gewerbe");
    expect(zeit.get("gewerbe"), "Wartezeit nicht").toBeLessThan(0);
  });

  it("lässt Händler am langsamsten vergessen", () => {
    const r = new Reputation();
    r.note("hartGedrueckt", "haendler");
    r.note("hartGedrueckt", "privat");
    const vorherH = r.get("haendler");
    const vorherP = r.get("privat");
    r.decay(1);
    // Wie viel Prozent des Grolls ist geblieben?
    expect(r.get("haendler") / vorherH).toBeGreaterThan(r.get("privat") / vorherP);
  });

  it("bleibt in den Grenzen", () => {
    const r = new Reputation();
    for (let i = 0; i < 100; i++) r.note("fairBezahlt", "privat");
    expect(r.get("privat")).toBeLessThanOrEqual(REP_MAX);
    for (let i = 0; i < 300; i++) r.note("hartGedrueckt", "privat");
    expect(r.get("privat")).toBeGreaterThanOrEqual(-100);
  });

  it("bringt bei gutem Ruf mehr Fuhren, bei schlechtem nie null", () => {
    const gut = new Reputation();
    for (let i = 0; i < 50; i++) gut.note("fairBezahlt", "privat");
    const schlecht = new Reputation();
    for (let i = 0; i < 50; i++) schlecht.note("hartGedrueckt", "privat");
    expect(gut.frequencyFactor("privat")).toBeGreaterThan(1);
    expect(schlecht.frequencyFactor("privat")).toBeLessThan(1);
    expect(schlecht.frequencyFactor("privat"), "nie ganz versiegen").toBeGreaterThan(0.2);
  });

  it("überlebt Speichern und Laden", () => {
    const r = new Reputation();
    r.note("fairBezahlt", "privat");
    r.note("langeWartenLassen", "gewerbe");
    const b = new Reputation();
    b.load(r.toJSON());
    expect(b.get("privat")).toBe(r.get("privat"));
    expect(b.get("gewerbe")).toBe(r.get("gewerbe"));
  });
});
