import { describe, expect, it } from "vitest";
import { CURRENT_SCHEMA, migrate, type SaveData } from "../src/core/save";
import { STANDARD_SENDER } from "../src/audio/songs";

/** M3-Abnahme: Spielstand mit Schema-Version + Migrationspfad von Anfang an. */

const valid: SaveData = {
  schemaVersion: 2,
  radio: { songId: "bluesrock" },
  savedAt: "2026-08-27T12:00:00Z",
  moneyEur: 5150,
  items: [
    {
      materialId: "steel",
      massKg: 60,
      shape: { kind: "box", dims: [0.15, 0.15, 1.3], color: 0x6e5a4e },
      pos: [1, 0.1, 2],
      rot: [0, 0, 0, 1],
    },
  ],
  cars: [
    { pos: [7, 0.1, -1], rot: [0, 0, 0, 1], crushStage: 1, torn: ["engine"], brokenWindows: ["front"] },
  ],
  fencesBroken: [true, false, false, false, false, false],
};

/** Ein Stand aus der Zeit vor dem Radio: Schema 1, ohne Senderfeld. */
const altV1 = (): Record<string, unknown> => {
  const d = JSON.parse(JSON.stringify(valid)) as Record<string, unknown>;
  d.schemaVersion = 1;
  delete d.radio;
  return d;
};

describe("Spielstand-Migration", () => {
  it("gültiger v2-Stand läuft durch", () => {
    expect(migrate(JSON.parse(JSON.stringify(valid)))).toEqual(valid);
  });
  it("unbekannte/zukünftige Schema-Version wird abgelehnt", () => {
    expect(migrate({ ...valid, schemaVersion: 99 })).toBeNull();
    expect(migrate({ ...valid, schemaVersion: 0 })).toBeNull();
  });
  it("kaputte Daten werden abgelehnt (kein Absturz)", () => {
    expect(migrate(null)).toBeNull();
    expect(migrate("quatsch")).toBeNull();
    expect(migrate({ schemaVersion: 1 })).toBeNull();
    expect(migrate({ ...valid, items: "nope" })).toBeNull();
  });
});

describe("Migration v1 → v2: Radiosender", () => {
  it("alter Stand bekommt den Standardsender und die neue Schema-Nummer", () => {
    const d = migrate(altV1());
    expect(d).not.toBeNull();
    expect(d!.schemaVersion).toBe(CURRENT_SCHEMA);
    expect(d!.radio).toEqual({ songId: STANDARD_SENDER });
  });
  it("alter Stand verliert dabei nichts anderes", () => {
    const d = migrate(altV1())!;
    expect(d.moneyEur).toBe(valid.moneyEur);
    expect(d.items).toEqual(valid.items);
    expect(d.cars).toEqual(valid.cars);
    expect(d.fencesBroken).toEqual(valid.fencesBroken);
  });
  it("gewählter Sender bleibt beim Durchlauf erhalten", () => {
    expect(migrate(JSON.parse(JSON.stringify(valid)))!.radio!.songId).toBe("bluesrock");
  });
  it("beschädigtes Senderfeld fällt auf den Standard zurück, nicht auf null", () => {
    for (const kaputt of [null, 42, {}, { songId: 7 }, "bluesrock"]) {
      const d = migrate({ ...JSON.parse(JSON.stringify(valid)), radio: kaputt });
      expect(d).not.toBeNull();
      expect(d!.radio).toEqual({ songId: STANDARD_SENDER });
    }
  });
});

describe("E-191: Maschendraht verschwindet auch aus alten Ständen", () => {
  it("Besen und Ballen fliegen beim Laden raus, alles andere bleibt", () => {
    const d = JSON.parse(JSON.stringify(valid)) as SaveData;
    const teil = d.items[0]!;
    d.items.push(
      { ...teil, materialId: "mixed", shape: { ...teil.shape, name: "Maschendraht-Besen", inventar: "besen" } },
      { ...teil, shape: { ...teil.shape, inventar: "besen" } },
      { ...teil, shape: { ...teil.shape, kind: "wire", name: "Maschendraht-Ballen" } }
    );
    const m = migrate(d);
    expect(m).not.toBeNull();
    expect(m!.items).toEqual(valid.items);
  });
});
