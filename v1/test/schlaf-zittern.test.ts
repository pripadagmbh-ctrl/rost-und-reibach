/**
 * E-215 — WER IM KONTAKT ZITTERT, ABER NICHT VOM FLECK KOMMT, IST STILL.
 *
 * Befund (Freitag Saat 5, nach E-210): elf Kabelteile im KABEL-LAGER blieben
 * nach der Ruheprobe 80 s lang wach. Ein Kabelring (18 kg) auf einem Kabelbund
 * meldete in jedem Schritt 0,3 m/s nach unten, stand aber auf derselben Höhe;
 * die gemeinsame Schlafregel (E-012, Mehrheit 92 %) zählte ihn nie als still.
 *
 * Geprüft wird die Regel selbst, ohne Physikschritt: Lage fest, gemeldetes
 * Tempo hoch → schläft (gemeinsam); dasselbe Tempo, aber der Körper wandert
 * wirklich → bleibt wach (Gegenprobe).
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { ItemManager, type ScrapItem } from "../src/world/scrapItems";

beforeAll(async () => {
  await initPhysics();
});

function haeufchen(): { items: ItemManager; teile: ScrapItem[] } {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const items = new ItemManager(new THREE.Scene(), world);
  const teile: ScrapItem[] = [];
  for (let i = 0; i < 4; i++) {
    teile.push(
      items.spawnScrap("cable", 50, { kind: "box", dims: [0.4, 0.3, 0.4], color: 0x885533 }, new THREE.Vector3(i * 2, 0.15, 0), new THREE.Quaternion())
    );
  }
  return { items, teile };
}

/** Zwei Sekunden Schlafprüfung; `zittern` setzt vor jedem Takt Tempo und Lage. */
function pruefe(items: ItemManager, zittern: (t: number) => void): void {
  for (let i = 0; i < 120; i++) {
    zittern(i / 60);
    items.settleSleep(1 / 60);
  }
}

describe("E-215 — gemittelte Bewegung statt Augenblicks-Tempo", () => {
  it("zwei Teile melden 0,3 m/s, bleiben aber am Fleck → alle vier schlafen gemeinsam", () => {
    const { items, teile } = haeufchen();
    pruefe(items, () => {
      for (const it of teile.slice(0, 2)) if (!it.body.isSleeping()) it.body.setLinvel({ x: 0, y: -0.3, z: 0 }, false);
    });
    expect(teile.map((t) => t.body.isSleeping())).toEqual([true, true, true, true]);
  });

  it("Gegenprobe: dieselben zwei wandern wirklich mit 0,3 m/s → niemand schläft", () => {
    const { items, teile } = haeufchen();
    pruefe(items, (t) => {
      for (const [k, it] of teile.slice(0, 2).entries()) {
        it.body.setTranslation({ x: k * 2 + 0.3 * t, y: 0.15, z: 0 }, false);
        it.body.setLinvel({ x: 0.3, y: 0, z: 0 }, false);
      }
    });
    expect(teile.some((t) => t.body.isSleeping())).toBe(false);
  });
});
