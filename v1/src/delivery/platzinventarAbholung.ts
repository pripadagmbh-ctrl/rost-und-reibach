/**
 * Der Abholer und das Platzinventar — was mitfährt und was zurückkommt.
 *
 * Ansage Patrick, 15.09.2026: „Wenn ein Abholer den Müllcontainer mitnimmt,
 * dann bringt er ihn auch wieder und kippt ihn einfach bei mir ab." Und dazu:
 * „Mit ohne Müll in dem Fall. Und der Müll landet natürlich bei uns im Silo."
 *
 * ZWEI SÄTZE, DREI REGELN:
 *
 *   1. Der Container ist Platzinventar, kein Handelsgut. Er wird NIE
 *      abgerechnet — weder leer noch voll, weder hier noch anderswo. Es gibt
 *      in dieser Datei keine Zahl mit einem Eurozeichen, und das ist Absicht.
 *   2. Sein Inhalt ist nicht seine Sache. Er nimmt denselben Weg wie bei der
 *      Nachtschicht: ins ABFALL-Silo, Stück für Stück, über
 *      `ContainerManager.leereBehaelter`. Ein Kilogramm darf dabei nicht
 *      verschwinden — was im Container lag, liegt danach im Silo oder (wenn
 *      das Silo voll ist) weiter im Container.
 *   3. Die leere Hülle steht danach am Abladeplatz. Nicht weg, nicht im
 *      Nichts, nicht am nächsten Morgen: sofort und sichtbar dort, wo der
 *      Wagen gerade stand.
 *
 * WARUM HIER EINE SCHNITTSTELLE UND NICHT DER DIREKTE AUFRUF. `vehicles.ts`
 * kennt weder Behälter noch Silos, und das soll so bleiben: Die
 * Zustandsmaschine des Wagens fragt nach „steht Platzinventar auf meiner
 * Fläche?" und sagt „leeren und absetzen" — mehr braucht sie nicht zu wissen.
 * Kopflos prüfbar wird es damit obendrein.
 */
import RAPIER from "@dimforge/rapier3d-compat";
import { CONFIGS, type ContainerManager, type Wanne } from "../world/containers";
import { istPlatzinventar } from "../world/platzinventar";
import type { ItemManager } from "../world/scrapItems";

/** Wo ein versetzbarer Behälter gerade steht. */
export interface BehaelterStellung {
  id: string;
  x: number;
  y: number;
  z: number;
}

/** Was nach dem Ausräumen im Lager angekommen ist. */
export interface LeerBericht {
  kg: number;
  stueck: number;
  rest: number;
}

/** Was der Abholer vom Platzinventar braucht — und sonst nichts. */
export interface PlatzinventarPort {
  /** Aktuelle Stellung allen versetzbaren Platzinventars. */
  stellungen(): BehaelterStellung[];
  /** Inhalt ins Lagersilo tragen. Kein Verkauf, kein Euro. */
  leeren(id: string): LeerBericht;
  /** Die leere Hülle an dieser Stelle auf den Boden setzen. */
  absetzen(id: string, x: number, z: number): void;
  /*
   * DER MÜLL-ABROLLER (E-190) — optional, damit Prüfstände ohne Platz weiter
   * mit drei Methoden auskommen.
   */
  /** Der Müll-Container: seine Wanne, Mitte der Grundfläche, Gier (Richtung des Hakenbügels). */
  muellWanne?(): { wanne: Wanne; x: number; z: number; gier: number } | null;
  /** Eine leere Müll-Wanne bauen (an dieser Stelle). */
  baueLeereMuellWanne?(x: number, z: number): Wanne | null;
  /** Hat der Platz einen Müll-Container — aufgestellt oder nicht (E-192)? */
  muellPlatz?(): boolean;
  /** Der Abroller nimmt die Müll-Wanne mit (E-192). */
  gibMuellWanneAb?(): Wanne | null;
  /** Die leere wird der Müll-Container des Platzes; zurück kommt die alte. */
  tauscheMuell?(neu: Wanne): Wanne | null;
}

/**
 * Die Ausführung mit dem echten `ContainerManager`.
 *
 * `leereBehaelter` und `ortVon` stehen dort schon bereit. Was fehlt, ist das
 * Absetzen: Der `ContainerManager` hält den Körper eines Absetzcontainers
 * unter Verschluss und bietet keinen Weg, ihn zu versetzen. Solange es den
 * nicht gibt, sucht diese Datei den Körper selbst — an der Stelle, die der
 * `ContainerManager` für ihn nennt.
 *
 * DIE SUCHE IST EINDEUTIG, NICHT GERATEN: `ortVon(id)` liefert genau die
 * Koordinate, die `syncBeweglich()` aus diesem Körper gelesen hat. Gesucht
 * wird deshalb der dynamische Körper, der dort auf fünf Zentimeter genau
 * steht, kein Schrottstück ist und am schwersten wiegt — eine leere Wanne
 * bringt 1781 kg auf die Waage, das schwerste Schrottstück des Spiels bleibt
 * weit darunter.
 *
 * Sobald `world/containers.ts` ein `setzeAb(id, x, z)` bekommt, fällt diese
 * Suche ersatzlos weg; der Rest der Datei bleibt, wie er ist.
 */
export class ContainerAbholung implements PlatzinventarPort {
  private readonly ids: string[];

  constructor(
    private containers: ContainerManager,
    private items: ItemManager,
    private world: RAPIER.World
  ) {
    this.ids = CONFIGS.filter((c) => istPlatzinventar(c)).map((c) => c.id);
  }

  stellungen(): BehaelterStellung[] {
    const out: BehaelterStellung[] = [];
    for (const id of this.ids) {
      const koerper = this.koerperVon(id);
      if (!koerper) continue;
      const t = koerper.translation();
      if (!Number.isFinite(t.x) || !Number.isFinite(t.y) || !Number.isFinite(t.z)) continue;
      out.push({ id, x: t.x, y: t.y, z: t.z });
    }
    return out;
  }

  muellWanne(): { wanne: Wanne; x: number; z: number; gier: number } | null {
    const m = this.containers.muell();
    const w = m?.wanne;
    if (!m || !w) return null;
    const r = w.body.rotation();
    return { wanne: w, x: m.ort.x, z: m.ort.z, gier: Math.atan2(2 * (r.w * r.y), 1 - 2 * r.y * r.y) };
  }

  gibMuellWanneAb(): Wanne | null {
    this.gemerkt.clear();
    return this.containers.gibMuellWanneAb();
  }

  muellPlatz(): boolean {
    return this.containers.muell() !== null;
  }

  baueLeereMuellWanne(x: number, z: number): Wanne | null {
    return this.containers.baueLeereMuellWanne(x, z);
  }

  tauscheMuell(neu: Wanne): Wanne | null {
    this.gemerkt.clear(); // die gemerkte Wanne ist ab jetzt die des Abrollers
    return this.containers.tauscheMuell(neu);
  }

  leeren(id: string): LeerBericht {
    return this.containers.leereBehaelter(id, this.items);
  }

  absetzen(id: string, x: number, z: number): void {
    const koerper = this.koerperVon(id);
    if (!koerper || !Number.isFinite(x) || !Number.isFinite(z)) return;
    // Auf den Boden, aufrecht und ohne Schwung — abgesetzt, nicht abgeworfen.
    koerper.setTranslation({ x, y: 0, z }, true);
    koerper.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    koerper.setLinvel({ x: 0, y: 0, z: 0 }, true);
    koerper.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  /**
   * Der Körper hinter einer Behälter-Kennung, oder null.
   *
   * EINMAL SUCHEN, DANN MERKEN. Die Suche geht über den Ort, den der
   * `ContainerManager` nennt — und der stammt aus der letzten Zählung. Wer den
   * Körper gerade selbst versetzt hat, fände ihn dort nicht mehr; außerdem
   * liefe sonst bei jedem Blick eine Schleife über alle Körper des Platzes.
   * Der Körper eines Behälters wechselt nie, also genügt ein Nachschlagen.
   */
  private readonly gemerkt = new Map<string, RAPIER.RigidBody>();

  private koerperVon(id: string): RAPIER.RigidBody | null {
    const schon = this.gemerkt.get(id);
    if (schon && schon.isValid() && schon.isDynamic()) return schon;
    const ort = this.containers.ortVon(id);
    if (!ort) return null;
    const eigene = new Set<number>();
    for (const it of this.items.items) {
      if (it.body.isValid()) eigene.add(it.body.handle);
    }
    let treffer: RAPIER.RigidBody | null = null;
    let schwerste = 0;
    this.world.forEachRigidBody((b) => {
      if (!b.isDynamic() || eigene.has(b.handle)) return;
      const t = b.translation();
      if (Math.abs(t.x - ort.x) > 0.05 || Math.abs(t.z - ort.z) > 0.05) return;
      const m = b.mass();
      if (m > schwerste) {
        schwerste = m;
        treffer = b;
      }
    });
    if (treffer) this.gemerkt.set(id, treffer);
    return treffer;
  }
}
