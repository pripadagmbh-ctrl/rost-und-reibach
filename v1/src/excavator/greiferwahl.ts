import type { GripSystem } from "../physics/gripSystem";
import type { Excavator } from "./excavator";
import { SICHELKRALLE, type Greiferform, type GreiferId } from "./greiferform";
import { FUENFSCHALEN } from "./greiferFuenfschalen";
import { MAGNET } from "./magnet";

/**
 * Die Greiferwahl im Pausenmenue (E-059, 15.09.2026).
 *
 * Patricks Entscheidung: „Beide Greifer bleiben, umgeschaltet wird im
 * Pausenmenue. Zurueck soll ein Knopf sein, kein Paket."
 *
 * Hier steht, was dabei zu tun ist — ohne DOM, damit es kopflos zu pruefen
 * ist (`test/greiferwechsel.test.ts`). `main.ts` haengt nur den Knopf daran
 * und meldet das Ergebnis auf dem Ereignisbus.
 */

/**
 * Alle Greifer, die es gibt — in der Reihenfolge des Durchschaltens. Der
 * Lasthebemagnet ist der dritte (E-146); der Knopf im Pausenmenue schaltet
 * reihum.
 */
export const GREIFERFORMEN: Greiferform[] = [SICHELKRALLE, FUENFSCHALEN, MAGNET];

/**
 * Womit eine NEUE Runde anfaengt (Ansage Patrick, 17.09.2026: „ansonsten
 * fünfschalengreifer als default").
 *
 * Bis dahin war es die Sichelkralle, und der Fuenfschalengreifer musste im
 * Pausenmenue gewaehlt werden (E-059). Jetzt andersherum.
 *
 * DAS IST DIE VORGABE DES SPIELS, nicht der Grundzustand der Maschine.
 * `Excavator` selbst haengt sich weiterhin die Sichelkralle an — an ihr
 * haengen die Planungszahlen des Platzes (`hoechsteKrallenspitze`) und rund
 * hundert Waechter, die eine Maschine bauen und sofort messen. Wer die
 * Vorgabe aendern will, aendert diese eine Zeile; wer den Grundzustand
 * aendert, verschiebt den Platz.
 */
export const STANDARD_GREIFER: Greiferform = FUENFSCHALEN;

/**
 * Form zu einer Kennung. Nimmt absichtlich einen beliebigen Text: Die Kennung
 * kommt aus dem Spielstand und kann aus einer neueren Fassung stammen oder von
 * Hand verdreht sein. Was unbekannt ist, wird zur Vorgabe — dieselbe Vorsicht
 * wie beim Radiosender (`save.ts`).
 */
export function formZu(id: string): Greiferform {
  return GREIFERFORMEN.find((f) => f.id === id) ?? STANDARD_GREIFER;
}

/** Der naechste Greifer in der Reihe — nach dem letzten kommt wieder der erste. */
export function naechsteForm(id: GreiferId): Greiferform {
  const i = GREIFERFORMEN.findIndex((f) => f.id === id);
  return GREIFERFORMEN[(i + 1) % GREIFERFORMEN.length]!;
}

/**
 * Was am Knopf steht — und ob er greift.
 *
 * `grund` ist leer, solange gewechselt werden darf; sonst die Zeile, die
 * darunter steht. „erst ablegen" ist genau der Satz aus E-048: Die Fixed
 * Joints ueberleben den Wechsel technisch, aber das gefasste Teil haengt
 * danach sichtbar frei in der Luft, weil die Schalen woanders stehen.
 */
export interface Knopfstand {
  /**
   * Aufschrift, etwa „Greifer → Fünfschalengreifer".
   *
   * Der Pfeil steht da, damit der Knopf nicht als Anzeige gelesen wird: „Greifer:
   * Fuenfschalengreifer" liesse offen, ob der gerade haengt oder ob er kommt.
   * Genannt wird der, der NACH dem Druecken haengt.
   */
  text: string;
  /** Hinweiszeile darunter — leer, wenn der Wechsel moeglich ist */
  grund: string;
  moeglich: boolean;
}

export function knopfstand(bagger: Excavator): Knopfstand {
  const naechste = naechsteForm(bagger.greiferform.id);
  const moeglich = bagger.greiferWechselBereit;
  return {
    text: `Greifer → ${naechste.name}`,
    grund: moeglich ? "" : "erst ablegen",
    moeglich,
  };
}

/**
 * Eine bestimmte Form anhaengen — Modell, Kollider und Sensorkugel in einem
 * Zug. Wird auch beim Laden eines Spielstands gerufen.
 *
 * Liefert die Form, die danach haengt. Ist sie nicht die gewuenschte, hat der
 * Wechsel nicht stattgefunden (etwas haengt noch in der Spinne).
 */
export function setzeGreifer(
  bagger: Excavator,
  grip: GripSystem,
  form: Greiferform
): Greiferform {
  /*
   * E-145: Der Bagger braucht die Posen der gehaltenen Teile fuer die
   * Wandsperre. Hier treffen sich Bagger und Greifsystem ohnehin (main ruft
   * diese Funktion beim Start), also wird hier verbunden — kein Haken in
   * main.ts noetig.
   */
  bagger.greifsystem = grip;
  if (!bagger.setGreifer(form)) return bagger.greiferform;
  /*
   * Die Sensorkugel gehoert dem Greifsystem und wird neu angelegt: Eine
   * `RAPIER.Ball` laesst ihren Radius nicht nachtraeglich aendern. Ohne diese
   * Zeile taste der Fuenfschalengreifer mit der Kugel der Sichelkralle
   * (1,555 statt 1,229 m) — also 33 cm zu weit in alle Richtungen.
   */
  grip.setForm(form);
  return form;
}

/** Auf den naechsten Greifer umschalten (der Knopf im Pausenmenue). */
export function wechsleGreifer(bagger: Excavator, grip: GripSystem): Greiferform {
  return setzeGreifer(bagger, grip, naechsteForm(bagger.greiferform.id));
}
