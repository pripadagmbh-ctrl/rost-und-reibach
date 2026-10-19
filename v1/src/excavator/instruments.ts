import * as THREE from "three";
import { t } from "../ui/sprache"; // E-170: Anzeige in der Spielsprache

/**
 * Bordinstrument in der Fahrerkabine.
 *
 * Ein kleines Display rechts neben dem Fahrer, gezeichnet auf eine Leinwand
 * und als unbeleuchtete Textur aufgezogen — ein Display leuchtet selbst und
 * soll im Schatten nicht abdunkeln. Es zeigt Achsstellungen, Hydraulikdruck,
 * Greiferzustand und Öltemperatur.
 */

/** Was das Display anzeigt — der Bagger reicht seinen Zustand herein. */
export interface InstrumentReadout {
  boomAngle: number;
  stickAngle: number;
  cabYaw: number;
  closure: number;
  carriedMassKg: number;
  carriedCount: number;
  /** 0 = eingefahren, 1 = abgestützt */
  outriggerDown: number;
  /** Achsaktivität 0..1 — treibt Druck und Temperatur */
  activity: number;
}

/** Auffrischrate: viermal je Sekunde reicht, Zeichnen kostet sonst unnötig */
const REFRESH_S = 0.25;

/**
 * Lage des Bordinstruments in der Kabine — relativ zur Kabinenmitte (cx, cz).
 *
 * Sie steht hier und nicht mehr nur im Quelltext des Halters, weil seit dem
 * 15.09.2026 ZWEI Stellen sie brauchen: die Leinwand hier und das Gehäuse im
 * Stahl-Netz der Kabine (`kabinenParts.ts`). Zwei Kopien derselben Zahl wären
 * genau die Art Fehler, die erst auffällt, wenn der Rahmen neben dem Bild
 * hängt.
 *
 * Werte unverändert seit dem Prototyp.
 */
export const DISPLAY_LAGE = {
  /** Versatz gegen die Kabinenmitte in x (m) — rechts neben dem Fahrer. */
  dx: -0.42,
  /** Höhe in der Kabine (m). */
  y: 1.16,
  /** Versatz gegen die Kabinenmitte in z (m) — vorn im Blickfeld. */
  dz: 0.46,
  /** Drehung um die Hochachse (rad) — Bildfläche zum Fahrer. */
  ry: 2.55,
  /** Neigung nach hinten (rad) — wie im Armaturenbrett. */
  rx: -0.3,
};

export class InstrumentPanel {
  private canvas: HTMLCanvasElement;
  private texture: THREE.CanvasTexture;
  private t = 0;

  /**
   * @param parent Kabinenhub-Gruppe — das Display fährt mit der Kabine hoch
   * @param cx X-Mitte der Kabine
   * @param cz Z-Mitte der Kabine
   */
  constructor(parent: THREE.Object3D, cx: number, cz: number) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 320;
    this.canvas.height = 224;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;

    /*
     * NUR DIE LEINWAND steht hier. Das GEHÄUSE (`06_DISPLAY_RAHMEN`) ist am
     * 15.09.2026 in das Stahl-Netz der Kabine gewandert (`kabinenParts.ts`,
     * Funktion `kabineStahl`): Es bewegt sich nicht gegen die Kabine und
     * kostete als eigenes Mesh zwei Zeichenrufe (E-025, Budgetregel).
     *
     * Die Leinwand kann NICHT mitverschmelzen — sie trägt eine eigene Textur,
     * die viermal je Sekunde neu gezeichnet wird, und ein `MeshBasicMaterial`,
     * damit die Anzeige unabhängig vom Licht lesbar bleibt.
     */
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.33, 0.23),
      new THREE.MeshBasicMaterial({ map: this.texture })
    );
    screen.position.z = 0.012;
    // Namen nach dem Muster der Baggerteile (siehe excavator.ts, Baugruppe 06)
    screen.name = "06_DISPLAY_BILD";
    const holder = new THREE.Group();
    holder.name = "06_DISPLAY";
    holder.add(screen);
    // Rechts neben dem Fahrer: er blickt in +Z, seine rechte Seite ist −X.
    // Tief genug, dass das Display nicht in die Arbeitssicht ragt.
    holder.position.set(cx + DISPLAY_LAGE.dx, DISPLAY_LAGE.y, cz + DISPLAY_LAGE.dz);
    holder.rotation.y = DISPLAY_LAGE.ry; // Bildfläche zum Fahrer gedreht
    holder.rotation.x = DISPLAY_LAGE.rx; // leicht nach hinten gekippt
    parent.add(holder);
  }

  /** Aus der Hauptschleife aufrufen; zeichnet nur viermal je Sekunde neu. */
  update(dt: number, r: InstrumentReadout): void {
    this.t += dt;
    if (this.t < REFRESH_S) return;
    this.t = 0;
    this.draw(r);
  }

  /** Einmal zeichnen, unabhängig von der Drosselung (für den Aufbau). */
  draw(r: InstrumentReadout): void {
    const x = this.canvas.getContext("2d");
    if (!x) return;
    const W = this.canvas.width;
    const H = this.canvas.height;
    x.fillStyle = "#0f1417";
    x.fillRect(0, 0, W, H);

    // Kopfzeile
    x.fillStyle = "#1b2429";
    x.fillRect(0, 0, W, 30);
    x.fillStyle = "#7ec96a";
    x.font = "bold 17px Consolas, monospace";
    x.fillText("PRIPADA", 10, 21);
    x.fillStyle = "#8d979d";
    x.font = "13px Consolas, monospace";
    x.fillText(t(r.outriggerDown > 0.85 ? "ABGESTÜTZT" : "FAHRBETRIEB"), 108, 21);

    const deg = (rad: number): number => Math.round(THREE.MathUtils.radToDeg(rad));
    const rows: Array<[string, string]> = [
      [t("Oberwagen"), `${Math.abs(deg(r.cabYaw) % 360)}°`],
      [t("Hauptarm"), `${deg(r.boomAngle)}°`],
      [t("Ausleger"), `${deg(r.stickAngle)}°`],
    ];
    x.font = "14px Consolas, monospace";
    rows.forEach(([label, value], i) => {
      const y = 54 + i * 26;
      x.fillStyle = "#8d979d";
      x.fillText(label, 10, y);
      x.fillStyle = "#e8e8e4";
      x.fillText(value, 130, y);
    });

    // Hydraulikdruck steigt mit Last und Achsbewegung
    const bar = Math.round(90 + r.activity * 120 + Math.min(r.carriedMassKg / 40, 90));
    x.fillStyle = "#8d979d";
    x.fillText(t("Hydraulik"), 10, 132);
    x.fillStyle = bar > 260 ? "#e0864a" : "#e8e8e4";
    x.fillText(`${bar} bar`, 130, 132);
    x.fillStyle = "#232c31";
    x.fillRect(10, 140, 180, 8);
    x.fillStyle = bar > 260 ? "#e0864a" : "#7ec96a";
    x.fillRect(10, 140, Math.min(180, (bar / 320) * 180), 8);

    // Greiferstatus
    x.fillStyle = "#8d979d";
    x.fillText(t("Spinne"), 10, 172);
    const zu = r.closure > 0.85;
    x.fillStyle = zu ? "#e0c14a" : "#7ec96a";
    x.fillText(
      r.carriedCount > 0
        ? `${t("beladen")} · ${Math.round(r.carriedMassKg)} kg`
        : zu
          ? t("geschlossen")
          : r.closure < 0.15
            ? t("offen")
            : `${Math.round(r.closure * 100)} %`,
      130,
      172
    );

    // Öltemperatur — steigt langsam mit der Arbeit
    x.fillStyle = "#8d979d";
    x.fillText(t("Öltemperatur"), 10, 200);
    x.fillStyle = "#e8e8e4";
    x.fillText(`${Math.round(44 + r.activity * 14)} °C`, 130, 200);

    this.texture.needsUpdate = true;
  }
}
