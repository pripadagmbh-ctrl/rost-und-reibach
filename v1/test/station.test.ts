/**
 * LEHRGANG TEIL 2 (L8): DIE STATION — eine Pruefung, stumm gefahren.
 *
 *  1. Der gefilterte Bus: Nur `challenge:stand` geht hinaus (Zielmarke,
 *     Lotse); `challenge:start`, `challenge:vorschau`, `challenge:schritt`
 *     und `challenge:geschafft` werden geschluckt. Zuhoeren geht an den
 *     echten Bus (ein Fahrkunst-Zyklus kommt an).
 *  2. `gesehen(b)`: erst, wenn die Pruefung an `b` vorbei ist — auch spaeter
 *     im Ablauf; was in ihren Schritten nicht vorkommt, nie.
 *  3. Durchreichen: Presse (Freigabe, Stempel), beenden.
 *
 * Attrappen wie `test/challenge.test.ts`. Dass die Teile jeder Station vom
 * Startplatz aus erreichbar sind, fahren die Pruefungs-Tests mit dem echten
 * Bagger ab (`test/aufgabe1.test.ts` … `aufgabe6.test.ts`, `starteAufgabe`
 * aus der Startpose) — die Station baut denselben Aufbau.
 */
import { describe, expect, it } from "vitest";
import { EventBus, type GameEvents } from "../src/core/events";
import { CHALLENGES, challengeNach } from "../src/challenges/katalog";
import type { ChallengeQuellen } from "../src/challenges/challenge";
import { StationLauf } from "../src/challenges/station";
import { BAGGER_STAND } from "../src/world/baggerstand";

const VERLADEN = challengeNach("verladen")!;

function attrappe() {
  const stand = { gegriffen: false, ueber: false, drin: false };
  const koerper = { handle: 7, translation: () => ({ x: 0, y: 0, z: 0 }), isValid: () => true };
  const q: ChallengeQuellen = {
    gegriffen: () => (stand.gegriffen ? [koerper] : []),
    spinne: () => ({ x: 0, y: 5, z: 0 }),
    drehmitte: () => BAGGER_STAND,
    blickRad: () => 0,
    behaelter: () => null,
    ueberBehaelter: () => false,
    behaelterVon: () => null,
    ueberKammer: () => stand.ueber || stand.drin,
    inKammer: () => stand.drin,
  };
  const bus = new EventBus();
  const log: string[] = [];
  for (const e of ["challenge:start", "challenge:vorschau", "challenge:schritt", "challenge:geschafft", "challenge:stand"] as const) {
    bus.on(e, () => log.push(e));
  }
  const s = new StationLauf(VERLADEN, q, bus, { teile: [], wracks: [{ body: koerper }] });
  return { s, q, stand, bus, log };
}

describe("StationLauf: der gefilterte Bus", () => {
  it("schluckt Start, Vorschau, Schritt und Geschafft — nur der Stand geht hinaus, je Bild", () => {
    const { s, stand, log } = attrappe();
    s.start();
    expect(log, "Start oder Schritt durchgelassen").toEqual([]);
    s.takt(1);
    expect(log).toEqual(["challenge:stand"]);
    stand.gegriffen = true;
    stand.ueber = true;
    s.takt(1);
    stand.drin = true;
    stand.gegriffen = false;
    s.takt(1);
    expect(s.pressenErlaubt()).toBe(true);
    s.presseHatGestempelt();
    s.takt(1);
    expect(s.geschafft).toBe(true);
    expect(log.every((e) => e === "challenge:stand"), log.join(", ")).toBe(true);
    expect(log.length).toBe(4);
  });

  it("die Stand-Meldung traegt die Marken der Pruefung (Wrack als Teil-Marke)", () => {
    const { s, bus } = attrappe();
    const staende: GameEvents["challenge:stand"][] = [];
    bus.on("challenge:stand", (e) => staende.push(e));
    s.start();
    s.takt(1 / 60);
    expect(staende[0]!.id).toBe("verladen");
    expect(staende[0]!.marken.map((m) => m.art)).toEqual(["teil"]);
  });

  it("hoert am echten Bus: ein Fahrkunst-Zyklus ueber der Kammer kommt in der Messung an", () => {
    const { s, stand, bus } = attrappe();
    s.start();
    stand.ueber = true;
    bus.emit("fahrkunst:zyklus", { praezisionCm: 25, ruheGrad: 2, tempoProMin: null, wurfMS: 0.4, wurfweiteM: 0.1, kraftKN: 9, gefuehlKN: null, x: 0, z: 0 });
    expect(s.lauf.messung().praezisionCm).toBe(25);
  });

  it("beendet = stumm: kein Stand mehr", () => {
    const { s, log } = attrappe();
    s.start();
    s.takt(1);
    s.beenden();
    s.takt(1);
    expect(s.beendet).toBe(true);
    expect(log).toEqual(["challenge:stand"]);
  });
});

describe("StationLauf.gesehen", () => {
  it("erst, wenn die Pruefung daran vorbei ist; spaetere Schritte nehmen fruehere mit", () => {
    const { s, stand } = attrappe();
    s.start();
    s.takt(1);
    for (const b of ["wrack_gefasst", "wrack_ueber_kammer", "wrack_in_kammer", "wrack_gepresst"] as const) expect(s.gesehen(b), b).toBe(false);
    // gleich ueber der Kammer gefasst: „Zur Presse" ist mitgenommen
    stand.gegriffen = true;
    stand.ueber = true;
    s.takt(1);
    expect(s.gesehen("wrack_gefasst")).toBe(true);
    expect(s.gesehen("wrack_ueber_kammer")).toBe(true);
    expect(s.gesehen("wrack_in_kammer")).toBe(false);
    // Geht es wieder weg, bleibt gesehen gesehen
    stand.ueber = false;
    s.takt(1);
    expect(s.gesehen("wrack_gefasst")).toBe(true);
    stand.drin = true;
    stand.gegriffen = false;
    s.takt(1);
    expect(s.gesehen("wrack_in_kammer")).toBe(true);
    expect(s.gesehen("wrack_gepresst")).toBe(false);
    s.pressenErlaubt();
    s.presseHatGestempelt();
    s.takt(1);
    expect(s.gesehen("wrack_gepresst"), "geschafft = alles gesehen").toBe(true);
  });

  it("GEGENPROBE: eine Beobachtung, die die Pruefung nicht hat, ist nie gesehen — auch nicht nach Geschafft", () => {
    const { s, stand } = attrappe();
    s.start();
    stand.gegriffen = true;
    stand.ueber = true;
    s.takt(1);
    stand.drin = true;
    stand.gegriffen = false;
    s.takt(1);
    s.pressenErlaubt();
    s.presseHatGestempelt();
    s.takt(1);
    expect(s.geschafft).toBe(true);
    expect(s.gesehen("teil_gefasst")).toBe(false);
    expect(s.gesehen("wrack_gehoben")).toBe(false);
  });

  it("GEGENPROBE: ein Stempel ohne Freigabe presst nichts", () => {
    const { s } = attrappe();
    s.start();
    s.presseHatGestempelt();
    s.takt(1);
    expect(s.gesehen("wrack_gepresst")).toBe(false);
  });

  it("jede Pruefung laesst sich als Station bauen", () => {
    const { q } = attrappe();
    for (const c of CHALLENGES) {
      const s = new StationLauf(c, q, new EventBus(), { teile: [], wracks: [] });
      expect(s.id).toBe(c.id);
    }
  });
});
