/**
 * Aufbau der Schale — aus der Zeichnung `zahngreifer` vom 13.09.2026.
 *
 * Bis dahin war jede Fassung aus Fotos geraten. Die Zeichnung liefert die
 * Bauweise mit Massen, und zwei davon korrigieren mich:
 *
 *   Der Zahn VERJUENGT sich stark — 110 x 75 mm an der Basis auf 22 x 14 mm
 *   an der Spitze. Meine letzte Fassung hatte ihn konstant.
 *
 *   Die Seitenwangen stehen AUSSEN, auf der konvexen Seite, nicht im Trog.
 *   Innen bleibt das Blech glatt; dort laeuft das Material.
 *
 * Querschnitt C-C der Zeichnung: Schalenblech 200 mm breit und 15 mm dick,
 * Wange 20 mm, Verstaerkung 110 x 25. Ein Schalenende von 200 mm traegt also
 * genau einen Zahn von 110 mm.
 */
/**
 * Blechstaerke — 45 mm, nicht 15.
 *
 * Die Herstellerzeichnung nennt 15 mm, aber fuer eine Schale von 500 mm
 * Bogenlaenge. Unsere misst 1380 mm; auf sie umgelegt waere das ein Blatt.
 * Ansage dazu: „die Masstaebe muessen nicht richtig sein, es sollte nur das
 * Grundprinzip darstellen" und, zur Skizze, „dick gegossenes Eisen".
 *
 * Vorher kam die ganze Tiefe des Zinkens aus der Strebe. Wo man die von der
 * Seite sieht, blieb nur das duenne Blech uebrig — der Zinken las sich dort
 * als Blatt statt als Guss.
 */
const BLECH = 0.045;
/**
 * Verjuengung — EIN Faktor fuer alles.
 *
 * Handskizze vom 13.09.2026 („Zinken / Zahn"), abgewickelt gezeichnet: Der
 * ganze Zinken ist ein Stueck, laeuft vom Kopf mit der Bohrung durchgehend
 * schmaler zu und endet in einer schmalen, runden Spitze. Blech und
 * Verstaerkung verjuengen sich dabei MIT — „Kruemmung dazu und dann sollte die
 * Sichelform durchgaengig proportional sein".
 *
 * Deshalb hat alles denselben Faktor: Blechbreite, Strebenbreite,
 * Strebenhoehe. Vorher lief die Breite auf 200 mm aus und darauf sass ein
 * eigener, breiter Zahn — das war ein Ende, keine Spitze.
 *
 * Der Endwert ist nicht gewaehlt, er ist der ZAHN: Die Positionsliste nennt
 * fuer die Greiferspitze 120 mm Breite, und der Zahn sitzt buendig auf dem
 * Schalenende (`baueGreiferspitze` nimmt seine Basis aus `schalenHalbbreite`).
 * 0,30 mal 400 mm sind genau diese 120 mm.
 *
 * Vorher stand hier 0,21 — 84 mm. Die Zahl kam aus der Sektorgrenze, und zwar
 * aus ihr an der falschen Stelle: gemessen wurde sie im GESCHLOSSENEN Zustand,
 * wo die Bahn an der Spitze nur 6,8 cm von der Drehachse steht. Dort laufen
 * fuenf Spitzen ohnehin ineinander — genau die Zone, die der Sektortest der
 * gespielten Sichelkralle ausnimmt (`SEKTOR_AB`). Gemessen ergab das einen
 * Zahn von 72 mm Breite: eine Nadel statt des kurzen breiten Keils, den das
 * Vorbild angeschraubt hat. Ansage 14.09.2026: „die Zacken sind spitzer als
 * beim Original".
 */
function verjuengung(k: number): number {
  return 1 - 0.7 * (Math.max(0, Math.min(SCHALEN_ABSCHNITTE, k)) / SCHALEN_ABSCHNITTE) ** 1.3;
}

/**
 * Die Verjüngung der BREITE — seit 16.09.2026 (E-090) eine eigene Kurve.
 *
 * `verjuengung` führt zwei Dinge auf einmal: die Breite der Schale UND die
 * Höhe der Strebe (`STREBE_H_OBEN · verjuengung`). Solange beide dieselbe Kurve
 * hatten, machte jede Verbreiterung den Zinken mitdicker: Im ersten Anlauf zu
 * diesem Umbau wuchs die Strebe am Saum von 39 auf 78 mm, der Zahn wurde
 * doppelt so hoch, die Grabtiefe sprang um 5,7 cm und sechs festgehaltene
 * Zahlen rissen ohne Not. Gewünscht ist ein breiter SAUM, kein dickerer Zinken.
 *
 * Also zwei Kurven. Die Höhe bleibt bei 0,30 (39 mm am Saum, unverändert), die
 * Breite endet bei 0,60 — 240 mm statt 120 mm.
 *
 * WARUM 0,60. Der alte Endwert war nicht gewählt, er WAR der Zahn: 0,30 · 400
 * = 120 mm, genau die Zahnbreite der Positionsliste. Die Schale lief damit in
 * eine Nadel aus. Am Vorbild ist es umgekehrt — der Saum ist breit, und der
 * Zahn sitzt als schmales Verschleißteil mittig darauf, mit sichtbarem Absatz
 * links und rechts (Kinshofer Profil H, Bateman „Semi-Closed", Sennebogen
 * MG4.1). `zahnBasis` hängt deshalb jetzt an `MASS.spitze.breite` statt am
 * Schalenende; sonst wüchse der Zahn mit und der Absatz wäre wieder weg.
 *
 * Der Exponent 1,3 bleibt in beiden: Er bestimmt, WO auf der Länge die Breite
 * verloren geht, nicht wie viel.
 */
function breitenverjuengung(k: number): number {
  return 1 - 0.4 * (Math.max(0, Math.min(SCHALEN_ABSCHNITTE, k)) / SCHALEN_ABSCHNITTE) ** 1.3;
}

/**
 * Die Verstaerkung — der Streifen unter dem Zahn.
 *
 * Erklaerung dazu (13.09.2026): „Sie hat zwei Aufgaben. Erstens verteilt sie
 * die Punktlast: der Zahn drueckt mit der gesamten Baggerkraft auf eine
 * Flaeche von wenigen Quadratzentimetern, und ein 15-mm-Blech wuerde dort
 * einfach einreissen. Zweitens ist sie das Opferteil — der Zahn wird
 * abgeschraubt und ersetzt, wenn er runter ist, die Verstaerkung wird
 * irgendwann abgebrannt und neu aufgeschweisst. Das Schalenblech selbst soll
 * nie angefasst werden muessen."
 */
/**
 * Die Strebe — der zweite Koerper des Gussteils.
 *
 * Ansage 13.09.2026: „nur musst du dir zwei Koerper vorstellen, die als eins
 * gegossen wurden sind. Die Schalen, welche mit ihrer Form und Kruemmung fein
 * sind und die Innenflaeche der Spinne darstellen, und eine zentrierte Strebe,
 * die mittig auf der Schale liegt und die Aussenkanten der Schale nicht
 * erreicht. Nur ist diese gegossene Strebe oben von Form/Dicke gut, nur sie
 * flacht zu schnell ab, was diese duenne Form in der Mitte ergibt. Sie wird in
 * der Tat schmaeler, aber von oben nach unten durchgaengig und wird auch unten
 * nie ganz duenn, dennoch unten schmaler als oben und gleichmaessig schmaler
 * werdend."
 *
 * Mein Fehler war die LAENGE: Die Verstaerkung lief nur ueber die letzten
 * 300 mm, also knapp ein Fuenftel der Schale. Dazwischen blieb nur das
 * 15-mm-Blech — genau die duenne Mitte, die im Bild zu sehen war.
 *
 * Jetzt laeuft sie durch, von Station 0 bis zur Spitze, und verjuengt sich
 * gleichmaessig. Ihr unteres Ende hat den Querschnitt der Zahnbasis
 * (110 x 75 mm), damit der Zahn buendig darauf sitzt — das ist die
 * „Verstaerkung" der Zeichnung, nur als Ende eines durchgehenden Koerpers
 * statt als eigenes Stueck.
 */
const STREBE_B_OBEN = 0.22;
const STREBE_H_OBEN = 0.13;
/**
 * Hoehe der Strebe an der Spitze — nur noch fuer den Sektordeckel gebraucht.
 *
 * Als Funktion, nicht als Konstante: Sie haengt an `verjuengung`, und die
 * braucht `SCHALEN_ABSCHNITTE`, das erst weiter unten steht. Als Konstante
 * gelesen waere das ein Zugriff vor der Deklaration.
 */
function verstVorn(): number {
  return STREBE_H_OBEN * verjuengung(SCHALEN_ABSCHNITTE);
}

/**
 * Einzelteile nach der Explosionszeichnung „5-Schalen-Mehrschalengreifer,
 * 1.200 Liter" (Vorlage 13.09.2026).
 *
 * Diese Datei baut NUR Teile, keinen Greifer — so war der Auftrag: „erst mal
 * die Einzelteile und so originalgetreu wie möglich … die versuchen wir später
 * zusammenzusetzen."
 *
 * Neu gegenüber dem ersten Anlauf ist, dass die Zeichnung jetzt eine Maßtabelle
 * hat. Damit ist nichts mehr geschätzt, und drei Dinge stellten sich als falsch
 * heraus:
 *
 *   - Die **Mitteltraverse misst Ø 700 mm**, nicht Ø 1514 mm. Der Bolzenkreis
 *     ist damit weniger als halb so groß wie im bisherigen Modell.
 *   - Die **Schale ist 400 mm breit**, nicht 740. Damit hatte die schmale
 *     Sichelkralle vom 12.09. mittags an dieser Stelle recht — was sie zur
 *     Schale macht, ist nicht die Breite, sondern die Tiefe von 300 mm.
 *   - Zwei Positionen fehlten ganz: **Zylinderschutzblech** und
 *     **Schalenverstärkung**, beide fünfmal.
 *
 * Hauptmaße aus der Tabelle, in Metern:
 *
 * Nachtrag 14.09.2026: Zwei Zeilen der Tabelle standen im Code anders als hier
 * in der Liste. Die Traverse ist jetzt wirklich Ø 0,70 × 0,45 (sie stand mit
 * 0,75 × 0,55 × 0,40 im `MASS`), und der Stempel ist auf Ø 0,46 × 0,26
 * gekürzt — nicht nach Liste, sondern nach Messung: Er stand mit 0,26 m² im
 * Schlund des Greifers. Die Greiferspitze ist auf ihr Listenmaß gebracht
 * (120 × 250 × 80 statt gemessener 72 × 249 × 71 mm).
 *
 *   1  Aufhängung / Adapter    1x   0,45 × 0,35 × 0,40
 *   2  Rotator (Drehwerk)      1x   0,40 × 0,40 × 0,30
 *   3  Drehwerksgehäuse        1x   0,45 × 0,35 × 0,25
 *   4  Mitteltraverse          1x   Ø 0,70 × 0,45
 *   5  Hydraulikzylinder       5x   0,70 × 0,20 × 0,12
 *   6  Greiferschale (HO)      5x   1,20 × 0,40 × 0,30
 *   7  Greiferspitze           5x   0,25 × 0,12 × 0,08
 *   8  Zylinderschutzblech     5x   0,50 × 0,18 × 0,10
 *   9  Hydraulikleitungen      1 Satz
 *   10 Schalenverstärkung      5x   0,40 × 0,15 × 0,08
 *
 *   Gesamt geschlossen: 1,85 m hoch, 1,60 m breit, 1.200 l Schüttgut
 *
 * Nachtrag 15.09.2026 (E-039): Position 4 steht hier weiter mit Ø 0,70 — so
 * nennt die Positionsliste sie, und das bleibt stehen. GEBAUT ist sie seit
 * E-039 mit Ø 0,95. Die Liste beschreibt ein Gerät, dessen Zylinder 38,9° quer
 * über dem Kopf stehen und dessen Hebelarm beim Zubeißen auf 0,092 m fällt;
 * beides ist gemessen und beides war der Grund für das Traversenblatt vom
 * 15.09.2026. Warum die Traverse dafür wachsen MUSS, steht bei `MASS.traverse`.
 *
 * Zwei Dinge macht die Datei anders als das Spielmodell:
 *
 *   - **Hülsengelenke sind echte Hülsen.** Ein Auge ist ein Rohr mit Bohrung,
 *     kein voller Zapfen. Daran steckt später der Bolzen wirklich.
 *   - **Schweißnähte sind sichtbar.** Wo ein Blech an ein anderes gesetzt ist,
 *     liegt eine Kehlnaht — der Unterschied zwischen Gussteil und
 *     Schweißkonstruktion.
 */
import * as THREE from "three";

/* ------------------------------------------------------------- Hauptmaße */

/** Die Maßtabelle der Zeichnung, in Metern. Einzige Quelle für alles unten. */
export const MASS = {
  aufhaengung: { breite: 0.45, tiefe: 0.35, hoehe: 0.4 },
  rotator: { breite: 0.4, tiefe: 0.4, hoehe: 0.3 },
  drehwerksgehaeuse: { breite: 0.5, tiefe: 0.45, hoehe: 0.3 },
  /*
   * Ø 0,95 × 0,45 — Variante B des Traversenblattes (E-039, 15.09.2026).
   *
   * Bis dahin Ø 0,70 nach Positionsliste. Die Traverse traegt die fuenf
   * Zylinderaufnahmen; ihr Radius IST `ZYLINDER_AUFNAHME.r` plus dem Rand von
   * 0,01 m. Damit ist sie die Tuer zu den beiden Kennwerten, die E-009 offen
   * gelassen hat — Zylinderneigung und Hebelarm. Gerechnet in
   * `tools/fuenfschalen/traverse-rechnen.ts`, gemessen am gebauten Modell in
   * `traverse-messen.ts`, entschieden am Blatt
   * `docs/f5-traverse-2026-09-15.svg`:
   *
   *   Ø 0,70 (bis E-039)   Neigung groesste 38,9°   Hebelarm offen 0,092 m
   *   Ø 0,95 (E-039)       Neigung groesste 24,4°   Hebelarm offen 0,118 m
   *
   * Ø 0,95 ist der kleinste Durchmesser, dessen flachster Arbeitspunkt noch
   * denselben Hebelarm traegt wie die Ø-1,10-Loesung (0,1179 m gegen 0,1179 m);
   * Ø 0,90 kommt dort nur auf 0,1003 m. Der Preis steht in der Muendung: von
   * oben zugebaut 52 % → 61 % (gemessen, `traverse-korb.ts`).
   *
   * Warum „tiefe" dasselbe Mass ist wie „breite": Die Positionsliste nennt
   * einen RUNDEN Koerper, `baueMitteltraverse` liest nur `breite`. Und der Rand
   * des Grundkoerpers (r 0,475) muss AUSSERHALB der Zylinderaufnahme (r 0,465)
   * liegen — sonst steckt die Gabel im eigenen Koerper statt auf seinem Rand.
   *
   * Die 0,45 sind die Bauhoehe der ganzen Traverse mit ihren Zylindergabeln,
   * nicht die des Grundkoerpers; sie ergeben sich aus `TRAVERSE_Y` (gemessen
   * 14.09.2026: 0,45 m ueber alles) und bleiben es, weil Aufnahme und Traverse
   * um denselben Betrag gestiegen sind.
   */
  traverse: { breite: 0.95, tiefe: 0.95, hoehe: 0.4 },
  zylinder: { laenge: 0.7, breite: 0.2, durchmesser: 0.12 },
  schale: { laenge: 1.2, breite: 0.4, tiefe: 0.3 },
  spitze: { laenge: 0.25, breite: 0.12, dicke: 0.08 },
  /*
   * Gekuerzt von 0,60 × 0,50 × 0,35 auf Ø 0,46 × 0,26.
   *
   * Ansage 14.09.2026: die Mittelsaeule „nimmt das Volumen des Greifers fuer
   * das Material". Gemessen stimmt das nicht fuer den KORB — dorthin ragen
   * nur Ausleger und Gabeln, und die machten 26 l von 1.615 l aus. Es stimmt
   * fuer den SCHLUND: In der Ebene 5 cm ueber den Bolzen versperrte die Saeule
   * 0,46 m² von 2,49 m², also fast ein Fuenftel dessen, was oben hineinfaellt.
   * Der Grundkoerper allein war davon 0,26 m².
   *
   * Weiter herunter geht es nicht, ohne die Anlenkung anzufassen: Der Koerper
   * muss die Saeule (Ø 0,26 am Fuss) tragen und fuenf Ausleger aufnehmen, und
   * die Ausleger muessen bis auf `STEMPEL_AUGE.r` hinaus. Was danach noch im
   * Schlund steht, sind die Ausleger selbst.
   */
  stempel: { breite: 0.46, tiefe: 0.46, hoehe: 0.26 },
  gesamt: { hoehe: 2.4, breite: 2.3, volumen: 1.2 },
  schalen: 5,
} as const;

/** Abschnitte, in die die Schale unterteilt ist. */
export const SCHALEN_ABSCHNITTE = 6;
/**
 * Länge eines Abschnitts und Krümmung je Abschnitt.
 *
 * Beides folgt aus dem Hauptmaß der Schale — und zwar erst, seit klar ist, wie
 * die 1.200 × 300 mm gemeint sind: als **Hüllmaß entlang der eigenen Sehne**,
 * so wie man ein gebogenes Blech misst, nicht als Bogenlänge.
 *
 * Als Bogenlänge gelesen ging die Rechnung nicht auf: Eine 1,20-m-Schale auf
 * einer Ø-700-Traverse müsste die Achse um 42 cm überfahren, um sich zu
 * schließen. Als Hüllmaß bleibt genau eine Lösung übrig, und sie trifft die
 * Tabelle auf den Millimeter:
 *
 *   6 Abschnitte à 230 mm = 1,38 m Bogen, 17,5° Krümmung je Abschnitt
 *   Hüllmaß daraus: 1,199 × 0,296 m   (Soll 1,20 × 0,30)
 */
export const ABSCHNITT = 0.23;
export const SCHALEN_BOGEN = (17.5 * Math.PI) / 180;

/* ------------------------------------------------------------- Kinematik */

/**
 * Die Kinematik — und der Befund, der sie umgeworfen hat.
 *
 * Die zweite Fassung der Zeichnung hat zwei Positionen, die vorher fehlten:
 *
 *   9  Zentrale untere Gelenk-/Führungseinheit (Stempel)   1x, 600×500×350
 *   10 Untere Schalenanbindung                             5x, Gelenkpunkt am Stempel
 *
 * Damit hängen die Schalen NICHT an der Mitteltraverse, wie ich es gebaut
 * hatte. Das Verbindungsprinzip der Zeichnung sagt es Punkt für Punkt: oberer
 * Zylinderanschluss an der Mitteltraverse, obere Schalenanbindung am Zylinder,
 * untere Schalenanbindung an der zentralen Gelenkeinheit. Jede Schale hat also
 * genau einen Drehpunkt — unten in der Mitte, am Stempel — und wird oben vom
 * Zylinder geschoben. Ein Winkelhebel, keine hängende Schale.
 *
 * Genau das ist auch der Grund, warum der Greifer geschlossen wie eine Birne
 * aussieht: Der Drehpunkt sitzt tief und mittig, die Schale wickelt sich um
 * ihn herum, und unten schaut der Stempel heraus.
 *
 * Abgetastet ergibt sich — und diesmal mit einer Probe, die aufgeht:
 *
 * Der Bogen aus dem Hüllmaß 1,20 × 0,30 m hebt über seine sechs Abschnitte
 * 0,8295 m nach außen und 0,8665 m nach unten. Legt man den Drehpunkt an das
 * OBERE Ende der Schale, liegt geschlossen genau dieser Bogen zwischen dem
 * Äquator und der Spitze auf der Achse.
 *
 * Hier stand: „die Schalen bilden eine Halbkugel von 0,83 m Radius, Inhalt
 * 1.195 Liter, die Positionsliste nennt 1.200." Nachgemessen (14.09.2026)
 * stimmt das nicht. Der Korb ist keine Halbkugel: Am Äquator steht die Bahn
 * auf r 0,890 (nicht 0,83 — die 0,8295 sind der Hub NACH AUSSEN, dazu kommt
 * der Radius der Spitze), und der Kreisbogen wölbt sich nach außen über die
 * Kugel hinaus. Als Rotationskörper der geschlossenen Mittellinie unter der
 * Bolzenebene gerechnet, in 4.000 Scheiben: **1.615 Liter**.
 *
 * Diese 1.615 l sind der SEHNENZUG über die sieben groben Stationen — dieselbe
 * Kette, an der auch Hüllmaß und Kinematik hängen. Das Netz sitzt auf dem
 * Kreisbogen durch diese Stationen (`feineStationen`), und der wölbt sich
 * zwischen ihnen nach außen: als Rotationskörper dieses Bogens gerechnet sind
 * es 1.646 l, also 31 l oder 1,9 % mehr (QA-Gegenrechnung 14.09.2026, siehe
 * `docs/messungen/2026-09-14_fuenfschalen-vorschau.md`). Beide Zahlen sind
 * richtig; hier steht die konservative.
 *
 * Die 1.200 l der Positionsliste sind davon nicht weit weg, wenn man
 * dazunimmt, dass fünf Schalen von 400 mm Breite am Äquator nur gut ein
 * Drittel des Umfangs abdecken — der Rest ist offen, und Schüttgut, das
 * dazwischen passt, bleibt nicht liegen. Als Hüllvolumen 1.615 l, als
 * Nenninhalt 1.200 l; beides sind verschiedene Dinge und keines ist falsch.
 *
 * Damit ist die Form nicht mehr geraten, sondern erzwungen:
 *
 *   Drehpunkt   an Station 0 — dem OBEREN Ende —, 0,30 m nach innen versetzt
 *   Stempelauge r 0,59 m, y −1,5335 m
 *   Anschläge   0° geschlossen, 96,25° offen — Spitzen senkrecht
 *   geschlossen 1,78 m breit, Loch Ø 0,12 m, 2,40 m hoch  (Liste: 2,40 m)
 *   offen       3,02 m Spitzenweite
 *
 * Die 2,30 m der Liste sind die SPITZENWEITE, nicht der Hüllkreis. Zuerst hatte
 * ich sie als Hüllmaß gelesen und kam auf 51° Öffnung; die Spitzen standen dann
 * nur 1,86 m auseinander. Im Spiel fielen damit zwei Schrottsorten durch — das
 * Waggon-Drehgestell und das LKW-Fahrerhaus, beide 1,90 m in der mittleren
 * Kante. Ein Datenblatt nennt bei einem Greifer die Öffnungsweite von Spitze zu
 * Spitze; so hat es auch das Vorgängermodell gelesen. Mit 65° trifft sie auf den
 * Zentimeter, und die Gesamthöhe bleibt bei 2,40 m, weil die vom geschlossenen
 * Zustand kommt.
 *   Zylinder    0,98 m geschlossen, 0,54 m offen — fährt zum SCHLIESSEN aus
 *   Moment      Schließen 2,7-mal Öffnen
 *
 * Der Drehpunkt saß vorher an Station 1, also 0,30 m UNTER dem oberen Ende.
 * Das war der Fehler hinter drei Beanstandungen auf einmal: Die Schale ragte
 * über ihren Drehpunkt hinaus, schwenkte offen bis auf 0,20 m an die Achse
 * heran und musste dort schmal gedeckelt werden — die Breite war oben klein,
 * wuchs nach unten an und fiel erst danach. Und geschlossen wuchs auch der
 * Radius der Mittellinie die ersten beiden Abschnitte nach unten noch an: ein
 * Fass, keine Birne. Beides verschwindet, sobald der Bolzen dort sitzt, wo er
 * beim Vorbild sitzt — am Äquator, am breitesten Punkt.
 */
/** Station der Schale, an der ihr Drehpunkt sitzt, und dessen Versatz nach innen. */
export const DREHPUNKT = { station: 0, versatz: 0.3 };
/** Lage des Stempelauges im Frame des Greifers (m). */
export const STEMPEL_AUGE = { r: 0.59, y: -1.5335 };
/**
 * Anschläge der Schalen (rad): 0° geschlossen, 51° offen.
 *
 * Geschlossen steht der oberste Abschnitt senkrecht. Das ist kein gerundeter
 * Wert, sondern die Bedingung für die Birnenform: Der Radius der Mittellinie
 * fällt von Station zu Station um `Abschnitt · sin(θ − Schwenk)`, und das ist
 * genau dann nirgends positiv, wenn der Schwenk den Anstellwinkel der obersten
 * Station nicht übersteigt. Bei den vorherigen 20° liefen die ersten beiden
 * Abschnitte nach außen, bevor die Schale einzog.
 */
export const ZU = 0;
/**
 * Offen stehen die SPITZEN SENKRECHT.
 *
 * Ansage 13.09.2026: „wenn die Spinne offen ist, sollten die Schalen weiter
 * offen gehen, sodass die Spitzen senkrecht stehen."
 *
 * Das ist keine gewaehlte Zahl: Die Tangente am Schalenende liegt bei
 * `SCHALEN_ABSCHNITTE · BOGEN − BOGEN/2` = 96,25° (eine Sehne zeigt in
 * Richtung der Tangente in ihrer Mitte, das Ende liegt also eine halbe Sehne
 * hinter 105°). Schwenkt die Schale um genau diesen Betrag, steht ihr Ende
 * senkrecht.
 *
 * Der Preis steht in den Huellmassen: Die Spitzenweite waechst von 2,30 auf
 * 3,02 m, die Positionsliste nennt 2,30. Die Ansage dazu lautete „die
 * Masstaebe muessen nicht richtig sein, es sollte nur das Grundprinzip
 * darstellen" — das Grundprinzip ist hier, dass die Schalen senkrecht in den
 * Schrott einstechen koennen.
 */
export const OFFEN = SCHALEN_ABSCHNITTE * SCHALEN_BOGEN - SCHALEN_BOGEN / 2;
/**
 * Obere Schalenanbindung — wo der Zylinder angreift, im Frame des Drehpunkts.
 *
 * Von (0 / 0,31) auf (−0,08 / 0,245) gerueckt (E-039, 15.09.2026). Das Auge
 * allein zu versetzen bringt nichts und die Traverse allein zu vergroessern
 * macht es schlechter — beides zusammen ist die Loesung. Das Auge wandert
 * dabei 8 cm die Schale hinunter und 6,5 cm auf den Bolzen zu.
 *
 * Woher: `tools/fuenfschalen/traverse-rechnen.ts` rastert je Durchmesser alle
 * Anlenkungen ab, die den Vertrag aus `anlenkung.ts` halten, und waehlt den
 * flachsten Zylinder unter denen mit Hebelarm ueber dem E-009-Ziel 0,10 m.
 */
export const OBERE_ANBINDUNG = { y: -0.08, z: 0.245 };
/**
 * Oberer Zylinderanschluss an der Mitteltraverse, im Frame des Greifers.
 *
 * Von (0,34 / −0,73) auf (0,465 / −0,635) gerueckt (E-039, 15.09.2026). Der
 * Radius folgt dem Traversendurchmesser Ø 0,95 (`MASS.traverse`), die Hoehe
 * der Anlenkungsrechnung. `TRAVERSE_Y` steigt um denselben Betrag mit — sonst
 * schweben die fuenf Gabeln neben dem Koerper, an dem sie sitzen.
 */
export const ZYLINDER_AUFNAHME = { r: 0.465, y: -0.635 };
/**
 * Höhe der Mitteltraverse im Frame des Greifers (m).
 *
 * Steht hier und nicht im Zusammenbau, weil die Zylinderaufnahme an der
 * Traverse sitzt: Ihre Gabel muss genau auf `ZYLINDER_AUFNAHME.y` liegen, und
 * das kann das Bauteil nur wissen, wenn es seine eigene Einbauhöhe kennt.
 * Vorher war der Anschluss mit −0,80 m gerechnet und die Gabel bei −1,14 m
 * gezeichnet — der Zylinder hing 34 cm neben seinem Auge.
 *
 * Von −1,00 auf −0,96 gerueckt (14.09.2026). Die Zylindergabel haengt
 * 0,1425 m unter ihrem Auge und steht 0,07 m darueber; der Grundkoerper reicht
 * 0,15 m unter die Traversenmitte. Mit −1,00 endete er 6,6 cm UNTER dem
 * Gabelfuss — die fuenf Gabeln schwebten frei neben dem Bauteil, an dem sie
 * angeschweisst sein sollen. Mit −0,96 griff der Gabelfuss um 9 cm in den
 * Flansch, und die Bauhoehe der ganzen Traverse war
 *   (−0,73 − TRAVERSE_Y) + 0,07 + 0,15 = 0,45 m
 * — genau das Mass der Positionsliste.
 *
 * Von −0,96 auf −0,865 gerueckt (E-039, 15.09.2026). Das ist kein neuer
 * Gedanke, sondern dieselbe Regel: Die Aufnahme ist mit `ZYLINDER_AUFNAHME.y`
 * von −0,73 auf −0,635 gestiegen, also steigt die Traverse um dieselben
 * 0,095 m. Der Abstand Aufnahme−Traverse bleibt damit 0,23 m, der Gabelfuss
 * greift weiter 9 cm in den Flansch und die Bauhoehe bleibt 0,45 m. Die
 * Traverse rueckt dadurch 10 cm hoch, unter das Drehwerksgehaeuse — das ist
 * Teil der Loesung und auf dem Blatt gezeichnet.
 */
export const TRAVERSE_Y = -0.865;

/** Schwenkwinkel zu einem Öffnungsgrad 0 (zu) … 1 (offen). */
export function schwenkFuer(oeffnung: number): number {
  const t = Math.min(1, Math.max(0, oeffnung));
  return ZU + (OFFEN - ZU) * t;
}

/**
 * Stützstellen der Schale im Frame ihres Drehpunkts.
 *
 * Station 0 ist das obere Ende, `SCHALEN_ABSCHNITTE` die Spitze. Der Ursprung
 * liegt am unteren Gelenk — dort, wo die Schale am Stempel hängt.
 */
export function schalenStationen(): Array<{ y: number; z: number; th: number }> {
  const roh: Array<{ y: number; z: number; th: number }> = [];
  let y = 0;
  let z = 0;
  for (let i = 0; i <= SCHALEN_ABSCHNITTE; i++) {
    roh.push({ y, z, th: i * SCHALEN_BOGEN });
    y -= ABSCHNITT * Math.cos(i * SCHALEN_BOGEN);
    z -= ABSCHNITT * Math.sin(i * SCHALEN_BOGEN);
  }
  const st = roh[DREHPUNKT.station]!;
  const px = st.y - DREHPUNKT.versatz * Math.sin(st.th);
  const pz = st.z - DREHPUNKT.versatz * Math.cos(st.th);
  return roh.map((r) => ({ y: r.y - px, z: r.z - pz, th: r.th }));
}

/**
 * Dieselbe Schalenbahn, nur feiner aufgelöst — ausschließlich fürs Netz.
 *
 * Die sieben Stationen sind der Vertrag: An ihnen hängen Hüllmaß, Kinematik,
 * Drehpunkt und Volumen, und nur mit ihrer groben Teilung trifft der Bogen die
 * Positionsliste auf den Millimeter (1,199 × 0,296 gegen 1,200 × 0,300; mit
 * zwölf Abschnitten wären es 1,227 × 0,271).
 *
 * Fürs Auge sind sechs Abschnitte über 87,5° aber zu wenig: Jeder Knick misst
 * 17,5°, und in der Seitenansicht liest sich die Schale dadurch als gerader
 * Schaft mit einem Knie darin statt als Sichel (Ansage 13.09.2026: „schau dir
 * doch einfach mal die Formgebung an … bei der Spinnenansicht, also montiert,
 * da siehst du es doch von der Seite").
 *
 * Deshalb wird hier eine Catmull-Rom-Kurve DURCH die sieben Stationen gelegt.
 * Sie geht exakt durch sie hindurch — an den Stützstellen ändert sich nichts,
 * dazwischen wird sie rund. Der Vertrag bleibt unangetastet, nur die Facetten
 * verschwinden.
 */
export function feineStationen(
  je = 3
): Array<{ y: number; z: number; th: number; k: number }> {
  /*
   * Die sieben Stationen liegen auf einem EXAKTEN KREIS — gleiche Sehnen,
   * gleicher Knick. Also braucht es keine Spline, sondern nur diesen Kreis.
   *
   * Der erste Versuch nahm eine Catmull-Rom-Kurve. Die traf die Stuetzstellen
   * zwar, lief zwischen ihnen aber ungleichmaessig: gemessen 2,84° bis 8,75°
   * Anstellungsaenderung je Teilschritt, wo 5,83° gleichmaessig sein muessten.
   * Dieser wandernde Fehler ist genau die Verwindung, die im Bild zu sehen war
   * — „stell dir 'n Blatt vor und das obere Ende wuerdest du mit dem
   * Uhrzeigersinn und das untere gegen den Uhrzeigersinn drehen".
   *
   * Auf dem Kreis ist der Knick je Teilschritt konstant, und die Stuetzstellen
   * werden exakt getroffen. Der Radius folgt aus Sehne und Knick:
   * R = Sehne / (2 · sin(Knick/2)).
   *
   * `th` ist die WIRKLICHE Tangente. Sie liegt an Station j bei (j − ½)·Knick,
   * denn eine Sehne zeigt in Richtung der Tangente in ihrer Mitte.
   */
  const R = ABSCHNITT / (2 * Math.sin(SCHALEN_BOGEN / 2));
  const phi0 = -SCHALEN_BOGEN / 2;
  // Nullpunkt der Schale im Frame ihres Drehpunkts — den bringt `schalenStationen` mit
  const start = schalenStationen()[0]!;
  const n = SCHALEN_ABSCHNITTE * je;
  const aus: Array<{ y: number; z: number; th: number; k: number }> = [];
  for (let i = 0; i <= n; i++) {
    const k = (i / n) * SCHALEN_ABSCHNITTE;
    const phi = phi0 + k * SCHALEN_BOGEN;
    aus.push({
      y: start.y - R * (Math.sin(phi) - Math.sin(phi0)),
      z: start.z + R * (Math.cos(phi) - Math.cos(phi0)),
      th: phi,
      k,
    });
  }
  return aus;
}

/**
 * Die FERSE — die Stützstellen zwischen Lagerhülse und Station 0.
 *
 * Befund 14.09.2026, in Patricks Worten: „Was aber wahrscheinlich der Fall ist:
 * dass direkt an der Traverse eine Hülse ist, wo der Zahn als solches
 * festgemacht ist. Das heißt, der Zinken und dieser Metallblock, wo auch der
 * Hubzylinder angeht, das ist eigentlich EIN Gusselement. Das sind nicht zwei
 * Elemente."
 *
 * Bis dahin lag zwischen Bolzen und Schalenanfang ein Kasten (`06_UNTERE_
 * ANBINDUNG`, 0,43 × 0,20 m) und darauf eine zweite Kiste für das Zylinderauge
 * (`06_OBERE_ANBINDUNG`). Zwei Quader an einer Sichel — in der Seitenansicht
 * genau die Trennung, die das Vorbild (SENNEBOGEN MG4.1, Schalenform HO) nicht
 * hat: Dort ist die Schale EIN Gussstück, Lagerhülse am Drehpunkt, Auge für den
 * Zylinder am selben Körper, von dort durchgehende Krümmung bis in den Zahn.
 *
 * Diese Kurve ist das fehlende Stück. Sie läuft vom Bolzen (0,0) nach außen bis
 * an Station 0 (0, `versatz`) und dreht dabei ihre Tangente von −90° — am
 * Bolzen zeigt der Körper radial nach außen — auf `−SCHALEN_BOGEN/2`, die
 * Tangente, mit der die Schale anfängt. Damit gibt es an der Naht keinen Knick:
 * Ferse und Schale sind ein Zug.
 *
 * Kubische Bézier, weil ein Kreisbogen es nicht kann: Punkt und Tangente an
 * beiden Enden sind vier Bedingungen, ein Kreis hat drei Freiheiten. Die
 * Griffweite 0,55 · `versatz` ist ein Startwert (SW) — kleiner macht die Ferse
 * eckig, größer lässt sie über dem Bolzen aufbauchen.
 */
export function fersenStationen(
  je = 6,
  versatz = DREHPUNKT.versatz
): Array<{ y: number; z: number; th: number; t: number }> {
  const th0 = -Math.PI / 2;
  const th1 = -SCHALEN_BOGEN / 2;
  const griff = versatz * 0.55; // SW 14.09.2026, siehe oben
  // Laufrichtung an einer Station ist (−cos th, −sin th) — dieselbe Regel wie in
  // `schalenStationen`. Die Stützpunkte liegen also auf diesen Richtungen.
  const P = [
    { y: 0, z: 0 },
    { y: -griff * Math.cos(th0), z: -griff * Math.sin(th0) },
    { y: griff * Math.cos(th1), z: versatz + griff * Math.sin(th1) },
    { y: 0, z: versatz },
  ];
  const aus: Array<{ y: number; z: number; th: number; t: number }> = [];
  /*
   * Zwei Stationen HINTER dem Bolzen, damit die Bohrung rundherum im Werkstoff
   * liegt. Ohne sie endete der Körper genau in der Bolzenmitte und die Hülse
   * stand zur Hälfte frei — im Bild ein abgeschnittenes Auge. 90 mm sind der
   * Außenradius der Hülse (85 mm) plus 5 mm Rand (SW 14.09.2026).
   */
  const UEBER = 0.09;
  /*
   * Negatives `t` heißt „hinter dem Bolzen". Der Bauteil-Code zieht den
   * Querschnitt dort mit `sqrt(1 − t²)` zusammen, damit die Nabe rund ausläuft
   * statt als Quader abzubrechen.
   */
  for (const t of [-0.95, -0.7, -0.4]) aus.push({ y: 0, z: t * UEBER, th: th0, t });
  for (let i = 0; i <= je; i++) {
    const t = i / je;
    const u = 1 - t;
    const b = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    const d = [-3 * u * u, 3 * u * (1 - 3 * t), 3 * t * (2 - 3 * t), 3 * t * t];
    let y = 0;
    let z = 0;
    let dy = 0;
    let dz = 0;
    for (let j = 0; j < 4; j++) {
      y += b[j]! * P[j]!.y;
      z += b[j]! * P[j]!.z;
      dy += d[j]! * P[j]!.y;
      dz += d[j]! * P[j]!.z;
    }
    aus.push({ y, z, th: Math.atan2(-dz, -dy), t });
  }
  return aus;
}

/**
 * Aussenradius beider Naben am Zinken (m) — Lagerhuelse wie Zylinderauge.
 *
 * Dass es dieselbe Zahl ist, ist keine Bequemlichkeit: Der Steg zwischen den
 * beiden (`06_AUGENKONSOLE`) ist genau so hoch wie sie und laeuft damit
 * buendig von Nabe zu Nabe, ohne Absatz an beiden Enden.
 */
export const AUGE_R = 0.085;

/**
 * Das Schalenende, wie es die gebaute Schale wirklich hat.
 *
 * Nicht dasselbe wie `schalenStationen()[6]`: Deren `th` ist die Richtung der
 * ABGEHENDEN Sehne, die wirkliche Tangente der Schale liegt eine halbe Sehne
 * dahinter. Der Meissel sass damit um 8,75° verkantet am Ende.
 */
export function schalenEnde(): { y: number; z: number; th: number } {
  const f = feineStationen();
  return f[f.length - 1]!;
}

/** Halbe Schalenbreite an einer Zwischenstation; zwischen den Stützstellen linear. */
export function halbbreiteBei(k: number): number {
  const a = Math.floor(k);
  const b = Math.min(SCHALEN_ABSCHNITTE, a + 1);
  const t = k - a;
  return schalenHalbbreite(a) * (1 - t) + schalenHalbbreite(b) * t;
}

/** Mittellinie einer Schale im Frame des Greifers, bei gegebenem Schwenk. */
export function mittellinie(schwenk: number): Array<{ r: number; y: number }> {
  const c = Math.cos(-schwenk);
  const sn = Math.sin(-schwenk);
  return schalenStationen().map((p) => ({
    r: STEMPEL_AUGE.r + (p.y * sn + p.z * c),
    y: STEMPEL_AUGE.y + (p.y * c - p.z * sn),
  }));
}

/* ------------------------------------------------------------------ Stoffe */

export interface Stoffe {
  guss: THREE.MeshStandardMaterial;
  blech: THREE.MeshStandardMaterial;
  naht: THREE.MeshStandardMaterial;
  bolzen: THREE.MeshStandardMaterial;
  gruen: THREE.MeshStandardMaterial;
  chrom: THREE.MeshStandardMaterial;
  gummi: THREE.MeshStandardMaterial;
}

export function stoffe(): Stoffe {
  const m = (n: string, c: number, r: number, me: number): THREE.MeshStandardMaterial => {
    const mat = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: me });
    mat.name = n;
    return mat;
  };
  return {
    guss: m("Stahlguss", 0x41474c, 0.55, 0.5),
    blech: m("Hardox_Blech", 0x2f3438, 0.45, 0.68),
    naht: m("Schweissnaht", 0x6a7076, 0.72, 0.55),
    bolzen: m("Bolzen_blank", 0xb9c0c6, 0.24, 0.92),
    gruen: m("Lack_gruen", 0x5ec23f, 0.4, 0.35),
    chrom: m("Kolbenstange_chrom", 0xc6ccd2, 0.16, 0.9),
    gummi: m("Hydraulikschlauch", 0x15181a, 0.86, 0.05),
  };
}

/* -------------------------------------------------------------- Bausteine */

/**
 * Hohlzylinder — die Grundform jedes Hülsengelenks.
 *
 * Ein Auge mit Bohrung, nicht ein voller Zapfen. Genau daran erkennt man auf
 * der Zeichnung ein Gelenk: Man sieht durch. Die Achse liegt auf x, weil alle
 * Gelenke dieses Greifers quer stehen.
 */
export function rohr(
  rAussen: number,
  rBohrung: number,
  laenge: number,
  seiten = 14
): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const p = (x: number, y: number, z: number, u: number, v: number): number => {
    const i = pos.length / 3;
    pos.push(x, y, z);
    uv.push(u, v);
    return i;
  };
  const quad = (a: number, b: number, c: number, d: number): void => {
    idx.push(a, b, c, a, c, d);
  };
  const h = laenge / 2;
  for (let s = 0; s < seiten; s++) {
    const w0 = (s / seiten) * Math.PI * 2;
    const w1 = ((s + 1) / seiten) * Math.PI * 2;
    const u0 = s / seiten;
    const u1 = (s + 1) / seiten;
    for (const [r, aussen] of [
      [rAussen, 1],
      [rBohrung, 0],
    ] as Array<[number, number]>) {
      const a = p(-h, Math.sin(w0) * r, Math.cos(w0) * r, u0, 0);
      const b = p(-h, Math.sin(w1) * r, Math.cos(w1) * r, u1, 0);
      const c = p(h, Math.sin(w1) * r, Math.cos(w1) * r, u1, 1);
      const d = p(h, Math.sin(w0) * r, Math.cos(w0) * r, u0, 1);
      if (aussen) quad(a, b, c, d);
      else quad(d, c, b, a);
    }
    for (const x of [-h, h]) {
      const a = p(x, Math.sin(w0) * rAussen, Math.cos(w0) * rAussen, u0, 0);
      const b = p(x, Math.sin(w1) * rAussen, Math.cos(w1) * rAussen, u1, 0);
      const c = p(x, Math.sin(w1) * rBohrung, Math.cos(w1) * rBohrung, u1, 1);
      const d = p(x, Math.sin(w0) * rBohrung, Math.cos(w0) * rBohrung, u0, 1);
      if (x > 0) quad(a, b, c, d);
      else quad(d, c, b, a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

let NAHT_STOFF: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial();
/** Muss einmal gesetzt werden, bevor `naht` benutzt wird. */
export function nahtStoff(st: Stoffe): void {
  NAHT_STOFF = st.naht;
}

/**
 * Kehlnaht als schmale Dreikantleiste.
 *
 * Eine Schweißnaht ist kein Rohr, sondern eine Kehle: dreieckig im Schnitt,
 * die beiden Schenkel an den Blechen. Neun Dreiecke je Naht — billiger als
 * jedes Detail, das man dafür weglassen müsste.
 */
export function naht(laenge: number, dicke = 0.022): THREE.Mesh {
  const g = new THREE.CylinderGeometry(dicke, dicke, laenge, 3);
  g.rotateY(Math.PI / 6);
  const m = new THREE.Mesh(g, NAHT_STOFF);
  m.name = "SCHWEISSNAHT";
  return m;
}

/**
 * Gabelaufnahme: zwei Laschen mit fluchtenden Augen, dazwischen der Spalt für
 * das Gegenstück.
 *
 * Die Standardaufnahme dieses Greifers — sie kommt an der Mitteltraverse für
 * Zylinder und Schalen vor und oben am Adapter.
 */
export function gabel(
  st: Stoffe,
  spalt: number,
  augeR: number,
  bohrung: number,
  hoehe: number,
  dicke = 0.05
): THREE.Group {
  const g = new THREE.Group();
  for (const seite of [-1, 1]) {
    const x = seite * (spalt / 2 + dicke / 2);
    const platte = new THREE.Mesh(new THREE.BoxGeometry(dicke, hoehe, augeR * 1.8), st.blech);
    platte.position.set(x, -hoehe / 2 + augeR * 0.25, 0);
    g.add(platte);
    const auge = new THREE.Mesh(rohr(augeR, bohrung, dicke), st.guss);
    auge.position.set(x, 0, 0);
    g.add(auge);
    const n = naht(augeR * 1.7);
    n.rotation.z = Math.PI / 2;
    n.position.set(x - seite * (dicke / 2 + 0.016), -hoehe + augeR * 0.25, 0);
    g.add(n);
  }
  return g;
}

/**
 * Strang mit Rechteckquerschnitt entlang einer Stationsfolge.
 *
 * Fuer alles, was der Schalenkruemmung folgt: Seitenwangen, Verstaerkungen.
 * `versatz` misst von der Mittellinie nach aussen.
 */
export type ProStation = number | number[];

/** Wert einer `ProStation`-Angabe an Station k. */
function je(v: ProStation, k: number): number {
  return typeof v === "number" ? v : (v[k] ?? v[v.length - 1] ?? 0);
}

/**
 * Fase an den vier Längskanten, als Anteil der kleineren Querschnittsseite.
 *
 * Vorlage 14.09.2026: „die Flächen lesen sich als gekantetes bzw. gegossenes
 * Blech mit Kanten." Ein gegossener Träger hat gebrochene Kanten, und genau die
 * machen ihn als Guss lesbar: Man sieht einen schmalen Streifen, der anders im
 * Licht steht als Rücken und Flanke. Ohne sie bleibt ein Vierkantprofil, und
 * bei weicher Schattierung wird daraus im Bild ein Schlauch.
 *
 * SW 14.09.2026 — 16 % der kleineren Seite, also 21 mm am Bolzen (130 mm hoch)
 * und 6 mm am Zahnfuss (39 mm). Die Fase ändert die SEITENANSICHT nicht: Sie
 * schneidet die Ecken in der Breitenrichtung weg, und dort blickt die
 * Silhouette hindurch.
 */
const FASE = 0.16;

export function strang(
  stationen: Array<{ y: number; z: number; th: number }>,
  x: ProStation,
  breite: ProStation,
  dicke: ProStation,
  versatz: ProStation = 0
): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const p = (px: number, py: number, pz: number, u: number, v: number): number => {
    const i = pos.length / 3;
    pos.push(px, py, pz);
    uv.push(u, v);
    return i;
  };
  /** Querschnitt an Station k: acht Ecken, die vier Längskanten gefast. */
  const schnitt = (k: number): Array<[number, number]> => {
    const bk = je(breite, k);
    const dk = je(dicke, k);
    const vk = je(versatz, k);
    const c = FASE * Math.min(bk, dk);
    const hb = bk / 2;
    return [
      [-hb + c, vk],
      [hb - c, vk],
      [hb, vk + c],
      [hb, vk + dk - c],
      [hb - c, vk + dk],
      [-hb + c, vk + dk],
      [-hb, vk + dk - c],
      [-hb, vk + c],
    ];
  };
  /** Ein Querschnittspunkt in Weltlage des Strangs. */
  const punkt = (k: number, dx: number, dn: number): [number, number, number] => {
    const s0 = stationen[k]!;
    /*
     * Die Aussennormale des Bogens ist (-sin th, cos th), NICHT (sin th, cos th).
     *
     * Die Stationen liegen auf einem Kreis um (Cy, Cz) mit
     * y = Cy - R sin th und z = Cz + R cos th; der Fahrstrahl vom Mittelpunkt
     * zur Station ist damit (-R sin th, +R cos th). Mit dem falschen Vorzeichen
     * stimmt die Richtung nur bei th = 0 und kippt danach um 2 th weg: bei
     * Station 3 (th = 43,8°) stand sie fast parallel zur Bahn, bei der Spitze
     * (th = 80,2°) lief sie rueckwaerts. Die Strebe lag dadurch nicht AUF dem
     * Blech, sondern laengs daneben — in der Seitenansicht die Einschnuerung
     * in der Mitte („die Mitte ist zu duenn", 13.09.2026).
     */
    return [
      je(x, k) + dx,
      s0.y + dn * -Math.sin(s0.th),
      s0.z + dn * Math.cos(s0.th),
    ];
  };
  const N = 8;
  /*
   * JEDE FLÄCHE BEKOMMT EIGENE ECKPUNKTE.
   *
   * Vorher teilten sich die anliegenden Flächen ihre Punkte, und
   * `computeVertexNormals` hat dort gemittelt: Aus acht scharfen Längskanten
   * wurde eine weiche Rundung, aus dem Gussträger im Betrachter ein Schlauch.
   * Mit eigenen Punkten je Fläche bleibt die Kante quer scharf — und längs,
   * über die Stationen hinweg, wird weiter gemittelt, die Sichel also glatt.
   * Das ist derselbe Unterschied wie zwischen einem gefalteten Blech und einem
   * gerollten Rohr.
   */
  for (let e = 0; e < N; e++) {
    const f = (e + 1) % N;
    let vor: [number, number] | null = null;
    for (let k = 0; k < stationen.length; k++) {
      const s = schnitt(k);
      const v = k / (stationen.length - 1);
      const a = p(...punkt(k, s[e]![0], s[e]![1]), e / N, v);
      const b = p(...punkt(k, s[f]![0], s[f]![1]), (e + 1) / N, v);
      if (vor) idx.push(vor[0], vor[1], b, vor[0], b, a);
      vor = [a, b];
    }
  }
  /* Stirnflächen als Fächer — sie brauchen ihre eigenen Punkte ebenfalls. */
  for (const k of [0, stationen.length - 1]) {
    const s = schnitt(k);
    const ring = s.map(([dx, dn], j) => p(...punkt(k, dx, dn), j / N, k === 0 ? 0 : 1));
    for (let j = 1; j + 1 < N; j++) {
      if (k === 0) idx.push(ring[0]!, ring[j + 1]!, ring[j]!);
      else idx.push(ring[0]!, ring[j]!, ring[j + 1]!);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------- 01 Aufhängung / Adapter */

/**
 * Aufhängung / Adapter — 0,45 × 0,35 × 0,40 m.
 *
 * Auf der Zeichnung eine geschweißte Konstruktion mit zwei hochstehenden
 * Laschen und großen Augen, dazwischen der Bolzen zum Stiel, unten die
 * Anschraubplatte zum Rotator. Die Knotenbleche zwischen Laschen und Platte
 * sind das Erkennungszeichen — ohne sie sieht die Gabel aus wie angeklebt.
 */
export function baueAufhaengung(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "01_AUFHAENGUNG";
  const M = MASS.aufhaengung;
  const platte = new THREE.Mesh(new THREE.BoxGeometry(M.breite, 0.05, M.tiefe), st.guss);
  platte.name = "01_ANSCHRAUBPLATTE";
  platte.position.y = -M.hoehe / 2;
  g.add(platte);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const sitz = new THREE.Mesh(rohr(0.026, 0.014, 0.055), st.blech);
    sitz.rotation.z = Math.PI / 2;
    sitz.position.set(Math.sin(a) * 0.16, -M.hoehe / 2, Math.cos(a) * 0.12);
    g.add(sitz);
  }
  const ohren = gabel(st, 0.14, 0.095, 0.05, 0.26, 0.055);
  ohren.name = "01_GABEL";
  ohren.position.y = M.hoehe / 2 - 0.1;
  g.add(ohren);
  const bolzen = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.32, 14), st.bolzen);
  bolzen.name = "01_BOLZEN";
  bolzen.rotation.z = Math.PI / 2;
  bolzen.position.y = M.hoehe / 2 - 0.1;
  g.add(bolzen);
  for (const sz of [-1, 1]) {
    const knoten = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.04), st.blech);
    knoten.position.set(0, -0.06, sz * 0.1);
    knoten.rotation.x = sz * 0.55;
    g.add(knoten);
  }
  return g;
}

/* ------------------------------------------------------------ 02 Rotator */

/**
 * Rotator (Drehwerk) — 0,40 × 0,40 × 0,30 m.
 *
 * Der Drehantrieb: ein gedrungener Block mit Flansch oben und unten, dem
 * Hydraulikmotor an der Seite und der Drehdurchführung. Nicht zu verwechseln
 * mit Position 3, dem Gehäuse darum herum.
 */
export function baueRotator(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "02_ROTATOR";
  const M = MASS.rotator;
  const koerper = new THREE.Mesh(
    new THREE.CylinderGeometry(M.breite / 2, M.breite / 2, M.hoehe * 0.62, 8),
    st.blech
  );
  koerper.name = "02_GEHAEUSE";
  koerper.rotation.y = Math.PI / 8;
  g.add(koerper);
  for (const [y, r] of [
    [M.hoehe / 2 - 0.02, M.breite / 2 - 0.03],
    [-M.hoehe / 2 + 0.02, M.breite / 2 + 0.01],
  ] as Array<[number, number]>) {
    const flansch = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.04, 16), st.guss);
    flansch.position.y = y;
    g.add(flansch);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const schraube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.06, 6),
        st.bolzen
      );
      schraube.position.set(Math.sin(a) * (r - 0.035), y, Math.cos(a) * (r - 0.035));
      g.add(schraube);
    }
  }
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.16, 10), st.guss);
  motor.name = "02_MOTOR";
  motor.rotation.z = Math.PI / 2;
  motor.position.set(M.breite / 2 + 0.04, 0.02, 0);
  g.add(motor);
  for (const z of [-0.05, 0.05]) {
    const stutzen = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 6), st.bolzen);
    stutzen.rotation.z = Math.PI / 2;
    stutzen.position.set(-M.breite / 2 - 0.02, -0.03, z);
    g.add(stutzen);
  }
  return g;
}

/* --------------------------------------------------- 03 Drehwerksgehäuse */

/**
 * Drehwerksgehäuse — 0,45 × 0,35 × 0,25 m.
 *
 * Die Schutzabdeckung um das Drehwerk. Auf der Zeichnung ist es der gerippte
 * Ring zwischen Rotator und Mitteltraverse; die senkrechten Rippen sind das,
 * woran man es erkennt — sie halten den Schrott von der Dichtung fern.
 */
export function baueDrehwerksgehaeuse(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "03_DREHWERKSGEHAEUSE";
  const M = MASS.drehwerksgehaeuse;
  const mantel = new THREE.Mesh(
    new THREE.CylinderGeometry(M.breite / 2, M.tiefe / 2, M.hoehe, 12),
    st.guss
  );
  mantel.name = "03_MANTEL";
  g.add(mantel);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rippe = new THREE.Mesh(new THREE.BoxGeometry(0.035, M.hoehe * 0.86, 0.05), st.blech);
    rippe.position.set(Math.sin(a) * (M.breite / 2 - 0.005), 0, Math.cos(a) * (M.breite / 2 - 0.005));
    rippe.rotation.y = a;
    g.add(rippe);
  }
  const rand = new THREE.Mesh(
    new THREE.CylinderGeometry(M.breite / 2 + 0.02, M.breite / 2 + 0.02, 0.03, 12),
    st.blech
  );
  rand.position.y = M.hoehe / 2;
  g.add(rand);
  return g;
}

/* ------------------------------------------------------ 04 Mitteltraverse */

/**
 * Mitteltraverse — Ø 0,95 × 0,45 m, die zentrale Baugruppe.
 *
 * Oben der Flansch zum Drehwerk, rundum fünf Gabeln für die oberen
 * Zylinderanschlüsse. Die Schalen hängen NICHT hier — das war mein Fehler bis
 * zur zweiten Fassung der Zeichnung. Sie hängen am Stempel (Position 9); die
 * Traverse trägt nur die Zylinder und den Stempel selbst.
 *
 * Hier stand „0,75 × 0,55 × 0,40 m" — schon vor E-039 falsch: `MASS.traverse`
 * nannte seit dem 14.09.2026 Ø 0,70, und die 0,55 hat nie jemand gelesen.
 * Seit E-039 sind es Ø 0,95 und 0,45 m über alles; die Maße stehen bei
 * `MASS.traverse`, hier steht nur, woraus das Bauteil besteht.
 */
export function baueMitteltraverse(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "04_MITTELTRAVERSE";
  const M = MASS.traverse;
  const R = M.breite / 2;
  const koerper = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R * 0.86, M.hoehe * 0.75, 10),
    st.guss
  );
  koerper.name = "04_GRUNDKOERPER";
  koerper.rotation.y = Math.PI / 10;
  g.add(koerper);
  const flansch = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.62, R * 0.62, 0.05, 16), st.guss);
  flansch.name = "04_OBERFLANSCH";
  flansch.position.y = M.hoehe * 0.38;
  g.add(flansch);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const sitz = new THREE.Mesh(rohr(0.024, 0.013, 0.06), st.blech);
    sitz.rotation.z = Math.PI / 2;
    sitz.position.set(Math.sin(a) * R * 0.5, M.hoehe * 0.38, Math.cos(a) * R * 0.5);
    g.add(sitz);
  }
  // Fuenf Gabeln fuer die oberen Zylinderanschluesse
  for (let i = 0; i < MASS.schalen; i++) {
    const a = (i / MASS.schalen) * Math.PI * 2;
    const nr = String(i + 1).padStart(2, "0");
    const gabelTeil = gabel(st, 0.1, 0.07, 0.036, 0.16, 0.04);
    gabelTeil.name = `04_ZYLINDERAUFNAHME_${nr}`;
    gabelTeil.position.set(
      Math.sin(a) * ZYLINDER_AUFNAHME.r,
      ZYLINDER_AUFNAHME.y - TRAVERSE_Y,
      Math.cos(a) * ZYLINDER_AUFNAHME.r
    );
    gabelTeil.rotation.y = a;
    g.add(gabelTeil);
  }
  return g;
}

/* ------------------------------------------- 08 Zylinderschutz-Verkleidung */

/**
 * Wie weit die Verkleidung an ihrem Knie noch hinausdarf (m).
 *
 * GEMESSEN, nicht gewählt: Die fünf Schalen schwenken beim Öffnen mit ihrem
 * oberen Ende nach innen und kommen dabei auf **r 0,349 m** heran (kleinster
 * Radius aller Schalen- und Zylindereckpunkte über 21 Stellungen des
 * Schließwegs, 1-cm-Bänder, gemessen am gebauten Netz am 15.09.2026, y −1,15).
 * 0,30 lässt dort knapp 5 cm. Der Wächter in `test/verkleidung.test.ts` misst
 * den wirklichen Freigang am fertigen Teil nach und meldet unter 3 cm.
 */
const VERKLEIDUNG_KNIE_R = 0.3;
/** Wie weit unter ihrem oberen Rand das Knie sitzt (m). SW 15.09.2026 — am Riss gewählt. */
const VERKLEIDUNG_KNIE_TIEF = 0.055;
/** Blechstärke (m). SW 15.09.2026: 12 mm, eine Abdeckung, kein tragendes Teil. */
const VERKLEIDUNG_BLECH = 0.012;

/**
 * Der Zylinderschutz — das Blech über der Mittelsäule. TRÄGT NICHTS.
 *
 * Patrick, 15.09.2026, vor sieben Vorbildaufnahmen: „Der Kopf ist zu schlank."
 * Und, zur Deutung der Bilder: „Das, was du als Guss … verortet hast, das ist
 * im Grunde genommen nur eine Abblendung. Das ist ein Zylinderschutz. Also es
 * ist kein Gusskörper."
 *
 * WAS DIESES TEIL IST: ein gekantetes Blech, das die nackte Säule zwischen
 * Mitteltraverse und Stempel verkleidet und die Kontur des Kopfes bis zur Nabe
 * durchzieht. Zehn Flächen wie die Traverse, in derselben Phase, damit die
 * Kanten durchlaufen.
 *
 * WAS ES NICHT IST: kein Kollider, kein Körper, keine Masse, kein Teil der
 * Kinematik. Es hängt im Starrkörper des Kopfes (`GRAPPLE_HEAD`) und wird mit
 * ihm zusammengelegt (E-025); weil die Traverse schon Blech trägt (die zehn
 * Sitzringe), kommt dabei KEIN NETZ dazu, nur Eckpunkte. `test/verkleidung.test.ts`
 * hält beides fest — mit einer Gegenprobe, die meldet, wenn doch einmal ein
 * Kollider daran hängt. Genau dieser Fehler ist am 15.09. in der Presse
 * gefunden worden (E-071: unsichtbare Klappe, Kollider in voller Größe).
 *
 * WARUM SIE NICHT WEITER HINAUFREICHT. Am Vorbild deckt das Blech auch die
 * Zylinder ab. Hier geht das nicht: Zwischen Traversenrand (r 0,475) und dem
 * inneren Rand der fünf Zylinder liegen auf Höhe der Aufnahme nur 3,2 cm, und
 * weiter oben laufen die Zylinderköpfe durch den Bereich, den ein Blech
 * bräuchte. Wer dort verkleiden will, muss die Zylinderaufnahme nach außen
 * setzen — und das ist die Anlenkung (E-075/E-076). Gebaut ist deshalb genau
 * das Stück, für das Platz ist: die Säule.
 *
 * ALLE MASSE SIND ABGELEITET, KEINES IST GESETZT: oben der untere Rand des
 * Traversenkörpers, unten der obere Rand des Stempels. Wer eines der beiden
 * Bauteile ändert, zieht die Verkleidung mit.
 */
export function baueVerkleidung(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "08_ZYLINDERSCHUTZ";
  const R = MASS.traverse.breite / 2;
  /* Genau der untere Rand des Traversenkörpers — dieselbe Rechnung wie dort. */
  const rOben = R * 0.86;
  const yOben = -(MASS.traverse.hoehe * 0.75) / 2;
  /* Genau der obere Rand des Stempels, im Frame der Traverse. */
  const yUnten = STEMPEL_AUGE.y + MASS.stempel.hoehe - TRAVERSE_Y;
  const rUnten = MASS.stempel.breite / 2 + 0.01;
  const yKnie = yOben - VERKLEIDUNG_KNIE_TIEF;
  const d = VERKLEIDUNG_BLECH;
  /*
   * Ein geschlossenes Profil: außen hinunter, innen wieder herauf. `LatheGeometry`
   * macht daraus eine Haut mit Außen- UND Innenseite — eine einseitige Fläche
   * wäre von unten, also genau aus der Arbeitsrichtung, unsichtbar.
   */
  const profil = [
    new THREE.Vector2(rOben, yOben),
    new THREE.Vector2(VERKLEIDUNG_KNIE_R, yKnie),
    new THREE.Vector2(rUnten, yUnten),
    new THREE.Vector2(rUnten - d, yUnten),
    new THREE.Vector2(VERKLEIDUNG_KNIE_R - d, yKnie),
    new THREE.Vector2(rOben - d, yOben),
    new THREE.Vector2(rOben, yOben),
  ];
  const blech = new THREE.Mesh(new THREE.LatheGeometry(profil, 10), st.blech);
  blech.name = "08_VERKLEIDUNG";
  /* Dieselbe Phase wie der Traversenkörper, damit die Kanten durchlaufen. */
  blech.rotation.y = Math.PI / 10;
  g.add(blech);
  return g;
}

/* ------------------------------------- 09 Zentrale untere Gelenkeinheit */

/**
 * Stempel — die zentrale untere Gelenk- und Führungseinheit, Ø 0,46 × 0,26 m.
 *
 * Position 9 der Zeichnung, und das Bauteil, das mir gefehlt hat. An ihm hängen
 * alle fünf Schalen: Jede hat unten ihre eigene Gabel („untere Schalenanbindung",
 * Position 10). Nach unten endet er FLACH, mit einem kurzen Fuß — nicht in einer
 * Spitze. Die halbe Abrissbirne, die geschlossen unten herausschaut, bilden die
 * Schalen selbst, nicht der Stempel.
 *
 * Der Stempel hängt über eine Säule an der Mitteltraverse; die Säule ist das,
 * was auf der Zeichnung zwischen Traverse und Gelenkeinheit zu sehen ist.
 */
export function baueStempel(st: Stoffe, bolzenR = STEMPEL_AUGE.r): THREE.Group {
  const g = new THREE.Group();
  g.name = "09_STEMPEL";
  const M = MASS.stempel;
  const R = M.breite / 2;
  /*
   * Der Stempel endet an der Bolzenebene — darunter kommt NICHTS mehr.
   *
   * Ansage 13.09.2026: „Ansonsten gibt es unten keinen Zapfen von der
   * Traverse/Stempel. Zähne sind ganz unten angesiedelt, sodass der
   * geschlossene Korb am unteren Ende des Stempels anfängt."
   *
   * Vorher sass der Körper mittig auf dem Auge und darunter noch ein Fuss; der
   * Stempel ragte damit 355 mm in den geschlossenen Korb hinein. Jetzt steht
   * er vollständig ÜBER der Bolzenebene, und der Korb beginnt genau dort, wo
   * er aufhört.
   */
  const koerper = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.94, M.hoehe, 10), st.guss);
  koerper.name = "09_KOERPER";
  koerper.rotation.y = Math.PI / 10;
  koerper.position.y = M.hoehe * 0.5;
  g.add(koerper);
  /*
   * Die Saeule wird gerechnet, nicht gesetzt: vom Kopf des Stempels bis in die
   * Mitte der Traverse. Vorher stand hier eine feste Laenge von 0,34 m. Die
   * passte zur alten Stempelhoehe; mit dem gekuerzten Stempel haette die
   * Saeule 6 cm unter der Traverse aufgehoert.
   */
  const saeuleL = TRAVERSE_Y - STEMPEL_AUGE.y - M.hoehe;
  const saeule = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, saeuleL, 8), st.guss);
  saeule.name = "09_SAEULE";
  saeule.position.y = M.hoehe + saeuleL / 2;
  g.add(saeule);
  for (let i = 0; i < MASS.schalen; i++) {
    const a = (i / MASS.schalen) * Math.PI * 2;
    const nr = String(i + 1).padStart(2, "0");
    /*
     * Die Gabel sitzt auf `STEMPEL_AUGE.r` — dort, wo die Schale dreht, nicht
     * am Rand des Blocks. Der Ausleger dazwischen ist das, was Position 10 von
     * einem blossen Auge unterscheidet: ein angeschweisster Arm, der den
     * Bolzen nach aussen an den Äquator der Kugel traegt.
     */
    /*
     * 100 x 120 mm statt 120 x 140 (14.09.2026). Der Ausleger ist das, was vom
     * Stempel wirklich IN den Korb ragt: Er sitzt mittig auf der Bolzenebene,
     * haengt also mit seiner halben Hoehe darunter. 20 mm weniger Hoehe sind
     * 10 mm weniger Korb, und ueber fuenf Ausleger und ihre Laenge macht das
     * mehr aus als der ganze Grundkoerper.
     */
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.12, Math.max(bolzenR - R * 0.7, 0.05)),
      st.guss
    );
    arm.name = `10_AUSLEGER_${nr}`;
    arm.position.set(
      Math.sin(a) * (R * 0.7 + bolzenR) * 0.5,
      0,
      Math.cos(a) * (R * 0.7 + bolzenR) * 0.5
    );
    arm.rotation.y = a;
    g.add(arm);
    const wurzelNaht = naht(0.12);
    wurzelNaht.rotation.z = Math.PI / 2;
    wurzelNaht.position.set(Math.sin(a) * R * 0.78, -0.07, Math.cos(a) * R * 0.78);
    wurzelNaht.rotation.y = a;
    g.add(wurzelNaht);
    /*
     * Gabelhoehe 0,12 statt 0,18. Die Laschen haengen unter ihrem Auge, und das
     * Auge liegt auf der Bolzenebene — jeder Zentimeter Lasche steht im Korb.
     * 0,12 reicht: Die Lasche muss das Auge (r 0,095) fassen und auf dem
     * Ausleger (0,12 hoch) aufsitzen, mehr traegt sie nicht.
     */
    const anbindung = gabel(st, 0.3, 0.095, 0.045, 0.12, 0.045);
    anbindung.name = `10_SCHALENANBINDUNG_${nr}`;
    anbindung.position.set(Math.sin(a) * bolzenR, 0, Math.cos(a) * bolzenR);
    anbindung.rotation.y = a;
    g.add(anbindung);
  }
  return g;
}

/* --------------------------------------------------- 05 Hydraulikzylinder */

/**
 * Hydraulikzylinder — 0,70 × 0,20 × Ø 0,12 m, fünfmal radial.
 *
 * Gehäuse und Kolbenstange sind getrennte Objekte, beide mit Auge. Kolben und
 * Dichtungen stecken darin und sind nicht gebaut — in einer Spielkamera sieht
 * man sie nie.
 */
export function baueZylinder(st: Stoffe): {
  gruppe: THREE.Group;
  gehaeuse: THREE.Group;
  stange: THREE.Group;
  stab: THREE.Mesh;
  auge: THREE.Mesh;
  rohrLaenge: number;
  auszug: number;
} {
  const gruppe = new THREE.Group();
  gruppe.name = "05_HYDRAULIKZYLINDER";
  const M = MASS.zylinder;
  const rR = M.durchmesser / 2;
  const rohrLaenge = M.laenge * 0.6;

  const gehaeuse = new THREE.Group();
  gehaeuse.name = "05_ZYLINDERGEHAEUSE";
  const koerper = new THREE.Mesh(
    new THREE.CylinderGeometry(rR, rR, rohrLaenge, 14),
    st.gruen
  );
  koerper.position.y = -rohrLaenge / 2;
  gehaeuse.add(koerper);
  const boden = new THREE.Mesh(new THREE.CylinderGeometry(rR * 1.12, rR * 1.12, 0.05, 14), st.gruen);
  gehaeuse.add(boden);
  const kopf = new THREE.Mesh(new THREE.CylinderGeometry(rR * 1.08, rR * 1.08, 0.055, 14), st.blech);
  kopf.position.y = -rohrLaenge;
  gehaeuse.add(kopf);
  /*
   * Das obere Auge liegt IM Gelenkpunkt, nicht 7 cm darüber. Sonst stimmt der
   * Abstand zwischen den beiden Augen nicht mit der gerechneten Zylinderlänge
   * überein, und der Zylinder steht neben seiner Gabel.
   */
  const augeOben = new THREE.Mesh(rohr(rR * 0.95, rR * 0.42, M.breite * 0.45), st.guss);
  augeOben.position.y = 0;
  gehaeuse.add(augeOben);
  const n = naht(M.breite * 0.5);
  n.rotation.z = Math.PI / 2;
  n.position.y = 0.026;
  gehaeuse.add(n);
  for (const y of [-0.08, -rohrLaenge + 0.1]) {
    const anschluss = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.07, 6), st.bolzen);
    anschluss.rotation.z = Math.PI / 2;
    anschluss.position.set(rR + 0.02, y, 0);
    gehaeuse.add(anschluss);
  }
  gruppe.add(gehaeuse);

  const stange = new THREE.Group();
  stange.name = "05_KOLBENSTANGE";
  const auszug = M.laenge - rohrLaenge - 0.12;
  const stab = new THREE.Mesh(new THREE.CylinderGeometry(rR * 0.5, rR * 0.5, auszug, 12), st.chrom);
  stab.position.y = -auszug / 2;
  stange.add(stab);
  const augeUnten = new THREE.Mesh(rohr(rR * 0.85, rR * 0.38, M.breite * 0.4), st.guss);
  augeUnten.position.y = -auszug - 0.04;
  stange.add(augeUnten);
  stange.position.y = -rohrLaenge;
  gruppe.add(stange);

  return { gruppe, gehaeuse, stange, stab, auge: augeUnten, rohrLaenge, auszug };
}

/* ------------------------------------------------ 06 Greiferschale (HO) */

/**
 * Greiferschale, halboffene Bauform — 1,20 × 0,40 × 0,30 m, fünfmal.
 *
 * Ein geschweißter Trog: gewölbte Haut zwischen zwei Seitenwangen, oben der
 * Lagerkasten mit den beiden Augen, hinten die Konsole mit dem Anlenkauge für
 * die Kolbenstange. Dazwischen Kehlnähte.
 *
 * 400 mm Breite — nicht 740, wie im ersten Anlauf geschätzt. Was die Schale von
 * einem Zinken unterscheidet, ist damit nicht die Breite, sondern die Tiefe:
 * 300 mm, verteilt auf 120 mm Wölbung der Haut und 180 mm hohe Wangen.
 */
const HALB = MASS.schale.breite / 2;
/**
 * Querradius der Schalenhaut (m).
 *
 * Die Woelbung darf NICHT konstant sein. Sie war es: 120 mm ueber die ganze
 * Laenge, waehrend die Breite von 400 auf 130 mm faellt. Oben ergibt das einen
 * flachen Bogen, unten ein spitzes V, und der Trogrand wandert dabei diagonal
 * ueber die Schale — im Bild nicht von einer Verwindung zu unterscheiden.
 *
 * Ein gewalztes oder gegossenes Blech hat stattdessen einen festen Querradius.
 * Der folgt aus dem Hauptmass: Pfeilhoehe 120 mm bei 400 mm Breite ergibt
 * R = (b/2)^2 / (2 * Pfeilhoehe) = 0,167 m. Damit faellt die Woelbung mit dem
 * Quadrat der Breite — an der Spitze bleiben von 120 mm noch 13 mm.
 */
/**
 * Querkrümmung der Haut — die der geschlossenen Kugel, nicht eine eigene.
 *
 * Ansage 13.09.2026: „die Wölbung ist immer noch nicht richtig." Sie war es
 * zweimal nicht. Erst stand sie fest auf 120 mm über die ganze Länge, während
 * die Breite von 400 auf 130 mm fiel — oben ein flacher Bogen, unten ein
 * spitzes V, und der Trogrand wanderte diagonal über die Schale. Dann lief sie
 * über einen festen Querradius von 0,167 m, was an der Spitze fast flach wurde.
 *
 * Beides ging am Wesentlichen vorbei: Fünf Schalen schließen zu einer KUGEL.
 * Damit ist jede Schale ein Stück dieser Kugeloberfläche, und ihre
 * Querkrümmung ist die der Kugel an dieser Station — der Radius, den die
 * geschlossene Mittellinie dort hat. Gerechnet sind das rund 22 mm Wölbung auf
 * 400 mm Breite, nicht 120. Die Schale ist also eine SANFT gewölbte Platte,
 * keine tiefe Rinne; die Tiefe der Positionsliste steckt im Holm.
 */
function querRadius(k: number): number {
  /*
   * Zwischen den Stuetzstellen LINEAR, nicht gerundet.
   *
   * Mit `Math.round` sprang der Radius bei jeder halben Station auf den der
   * naechsten — und weil die Woelbung mit 1/r geht, sprang sie dort nach oben:
   * 17,6 / 17,5 / 16,0 / 14,3 / 15,2 / 13,4 / 11,5 / 13,4 mm. Ein Saegezahn
   * ueber die ganze Laenge, den man der Haut als Wellen ansieht.
   */
  const bahn = mittellinie(ZU);
  const kk = Math.max(0, Math.min(SCHALEN_ABSCHNITTE, k));
  const a = Math.floor(kk);
  const b = Math.min(SCHALEN_ABSCHNITTE, a + 1);
  const t = kk - a;
  const r = (bahn[a]?.r ?? 0.1) * (1 - t) + (bahn[b]?.r ?? 0.1) * t;
  return Math.max(r, 0.12);
}
/** Wölbung der Haut bei halber Breite `halb` an Station k. */
function woelbungBei(halb: number, k: number): number {
  return (halb * halb) / (2 * querRadius(k));
}

/**
 * Ab welchem Anteil der halben Breite die Haut aufsteht, und wie hoch —
 * als Anteil der VOLLEN Breite an der jeweiligen Stelle.
 *
 * 0,30 heißt: an der Wurzel (400 mm breit) steht der Rand 120 mm auf, am Saum
 * (240 mm breit) 72 mm. Der Anteil ist über die Länge konstant, damit das
 * Verhältnis stimmt und der Trog zur Spitze hin flacher wird, ohne dass er
 * verschwindet. SW 16.09.2026, E-090 — Verschleißschalen aus Hardox liegen in
 * dieser Gegend; eine Zahl aus einer Quelle gibt es nicht, die Hersteller
 * nennen Bauformen, keine Maße.
 */
const WANGE_AB = 0.5;
const WANGE_ANTEIL = 0.3;
/**
 * Über wie viele Stationen der Rand aus der Ferse heraus aufsteht.
 *
 * NICHT kosmetisch — ohne ihn steckt der Rand IM Fersenguss. Gemessen: Steht
 * er schon an Station 0 voll da, springt der Schattenriss der Ferse zwischen
 * 33 % und 54 % ihrer Länge von 275 auf 464 mm. Der Rand faltet sich dort
 * 120 mm nach innen, und dort sitzt der Guss. Das ist keine Schranke, die
 * zickt, das ist Werkstoff im Werkstoff.
 *
 * Am Vorbild beginnt die Kante des Blechs auch nicht am Lagerauge, sondern
 * dort, wo die Ferse aufhört und die Schale anfängt. Über eine Station
 * aufzustehen ist genau das. SW 16.09.2026, E-090.
 */
const WANGE_RAMPE = 1;

/**
 * Der Querschnitt der Schalenhaut: Boden plus aufgestellter Rand.
 *
 * VORHER war es nur der Bogen `(halb² − x²)/(2r)` — an der Wurzel gemessene
 * 22 mm Wölbung auf 400 mm Breite. Von vorn war die Schale damit ein Strich,
 * und deshalb hat jede Änderung im Seitenriss nach nichts ausgesehen (E-083:
 * zweimal 98,5 % bzw. 70,7 % deckungsgleich). Patrick: „der Kopf ist zu
 * schlank."
 *
 * JETZT steht die Haut zum Rand hin auf. Wichtig, und der Grund für DIESE
 * Bauweise statt angesetzter Bleche: Es ist DIESELBE Haut, nur geformt — kein
 * aufgeschweißtes Blech, das nach oben steht. Patrick am 13.09.2026: „ein
 * Guss, keine nach oben stehenden Bleche … nur Stahlbleche, die das innere
 * Material zusammenhalten sollen." Ein gekantetes Blech hält das innere
 * Material und steht trotzdem nicht als eigenes Teil ab; die Schenkel im
 * Querschnitt SIND das gebogene Blech. Genau so ist auch die MG4.1 gebaut
 * („Greifer-Schalen in Hardox Schweißkonstruktion").
 *
 * Der Rand steht nach INNEN (negatives w, gegen die Außennormale): in den Trog
 * hinein, zur Ladung hin. Die Außenhülle der Schale wird dadurch nicht größer —
 * Bodenanschlag, Grabtiefe und Hüllkreis sehen dieselbe Silhouette wie vorher.
 */
function trogprofil(x: number, halb: number, k: number): number {
  const bogen = (halb * halb - x * x) / (2 * querRadius(k));
  const u = Math.min(1, Math.abs(x) / Math.max(halb, 1e-6));
  const auf = Math.max(0, (u - WANGE_AB) / (1 - WANGE_AB)) ** 2;
  const rampe = Math.min(1, Math.max(0, k) / WANGE_RAMPE);
  return bogen - auf * rampe * WANGE_ANTEIL * 2 * halb;
}

/**
 * Höhe des aufgestellten Randes an Station k (m) — Boden bis Randoberkante.
 * Der Wächter in `test/schalenform.test.ts` misst damit, ob der Trog noch einer
 * ist; ohne diese Zahl wäre „der Querschnitt ist wieder flach" nicht prüfbar.
 */
export function randhoehe(k: number): number {
  const halb = halbbreiteBei(k);
  return trogprofil(0, halb, k) - trogprofil(halb, halb, k);
}

const sektorHalb = Math.PI / MASS.schalen;
/**
 * Ab welchem Abstand von der Drehachse die Sektorgrenze ueberhaupt gilt (m).
 *
 * Naeher an der Achse laufen die fuenf Spitzen im geschlossenen Zustand
 * ineinander. Bei fuenf Zinken endlicher Breite geht das gar nicht anders —
 * der Sektortest der gespielten Sichelkralle nimmt genau diese Zone aus
 * (`test/greifer.test.ts`, „bleibt in jeder Stellung im eigenen Sektor":
 * `if (r < 0.3) continue`, mit der Begruendung „am Geraet schieben sie sich
 * dort aneinander vorbei"). Hier gilt dieselbe Grenze und derselbe Grund.
 *
 * Vorher war der Deckel bis auf 6,8 cm an die Achse durchgezogen. Das ist der
 * ganze Unterschied zwischen einem 72-mm-Zahn und einem 120-mm-Zahn.
 */
const SEKTOR_AB = 0.3;
/**
 * Sicherheitsabschlag auf die Sektorbreite.
 *
 * Der Deckel rechnet mit der EXAKTEN Beziehung: Ein Punkt, der `r` von der
 * Achse und `b` quer zur Schalenmitte steht, nutzt `atan(b/r)` des Sektors —
 * halbe Breite = `r · tan(36°)`. Vorher stand dort `sin(0,9 · 36°)`, also
 * 0,536 statt 0,727: ein Viertel zu wenig, und die Verwechslung von Sinus und
 * Tangens ist der zweite Grund, warum der Zahn zu schmal war.
 */
const SEKTOR_SICHER = 0.9;
/*
 * `WANGE_DICK` (35 mm) ist am 14.09.2026 weggefallen. Es war das letzte
 * Überbleibsel der Seitenwangen: Die Breite des Lagerkastens wurde als
 * „Schalenbreite minus zweimal Wange" gerechnet, obwohl es seit dem 13.09.
 * keine Wangen mehr gibt. Der Gusskörper nimmt jetzt die Breite des
 * Schalenendes direkt.
 */
/**
 * Der Holm ist ein VIERKANTROHR, laengs gebogen — und er ist der Zahn.
 *
 * Ansage 13.09.2026, woertlich: „Stell dir 'n Zahn genauso vor: 'n Vierkantrohr.
 * 'N einfaches, breites Vierkantrohr, laengs nach innen gebogen. Das ist im
 * Grunde genommen der Zahn … Und quasi aussen auf einer Seite des
 * Vierkantrohres sind die Schalen gegossen, eben mit der einen Bodenflaeche,
 * also der breiteren Flaeche des Vierkants … Der Holmen, der das Vierkantrohr
 * ist, ist in der Dicke ueberall gleich, ueberall. Und darum ist auch der Zahn
 * ueberall gleich."
 *
 * Damit faellt mein Grundmodell: Ich hatte die Schale als gebogenes Blech mit
 * einer Rinne gebaut und den Zahn als Keil daran. Richtig ist das Umgekehrte —
 * ein durchgehendes Profil traegt alles, und die Platten sind nur aussen
 * daraufgesetzt.
 *
 * Der Querschnitt steht in der Positionsliste: Die Greiferspitze misst
 * 120 x 80 mm, also breiter als tief. Genau das ist das Rohr.
 */

/**
 * Wie tief die Seitenwange an Station k in den Trog hineinragt (m).
 *
 * Oben so tief, dass sie den Drehbolzen erreicht. Der sitzt `DREHPUNKT.versatz`
 * hinter der Haut — mit den durchgehenden 180 mm der Positionsliste hörte die
 * Wange 120 mm vor ihm auf, und die Schale hing sichtbar neben ihrem eigenen
 * Lager. Beim Vorbild sind das die großen Backen am oberen Ende, die den Bolzen
 * tragen; nach unten laufen sie auf das Normalmaß zu.
 */
export function schalenHalbbreite(k: number): number {
  let halb = Infinity;
  for (let i = 0; i <= k; i++) {
    let innen = Infinity;
    for (let j = 0; j <= 12; j++) {
      const schwenk = ZU + ((OFFEN - ZU) * j) / 12;
      const bahn = mittellinie(schwenk);
      const th = i * SCHALEN_BOGEN - schwenk;
      innen = Math.min(innen, (bahn[i]?.r ?? 0) - verstVorn() * Math.cos(th));
    }
    halb = Math.min(
      halb,
      HALB * breitenverjuengung(i),
      Math.max(innen, SEKTOR_AB) * Math.tan(sektorHalb) * SEKTOR_SICHER
    );
  }
  return halb;
}

/**
 * Querschnitt des Gusskörpers am Bolzen — Breite und Höhe (m).
 *
 * Breite wie das Schalenende an Station 0 (2 · `schalenHalbbreite(0)` = 400 mm),
 * damit die Lagerhülse ihre volle Länge im Werkstoff hat. Höhe 280 mm: Die
 * Hülse misst Ø 170 mm, es bleiben 55 mm Wand oben und unten. Das ist die
 * dickste Stelle des Zinkens, von hier nimmt er bis zum Zahn nur noch ab.
 * SW 14.09.2026 — Maß aus der Hülse abgeleitet, nicht aus der Positionsliste.
 */
const FERSE_H_BOLZEN = 0.28;

export function baueGreiferschale(
  st: Stoffe,
  versatz = DREHPUNKT.versatz
): THREE.Group {
  const g = new THREE.Group();
  g.name = "06_GREIFERSCHALE";
  const HAUT = BLECH;
  /*
   * Rückt der Drehpunkt weiter nach innen, wandert die ganze Schale mit — ihre
   * Form bleibt dieselbe, nur die Ferse wird länger. Mit dem Vorgabewert ist
   * `schub` null und es ändert sich nichts.
   */
  const schub = versatz - DREHPUNKT.versatz;

  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const p = (x: number, y: number, z: number, u: number, v: number): number => {
    const i = pos.length / 3;
    pos.push(x, y, z);
    uv.push(u, v);
    return i;
  };
  const quad = (a: number, b: number, c: number, d: number): void => {
    idx.push(a, b, c, a, c, d);
  };
  /*
   * ACHT FELDER QUER STATT VIER (E-090).
   *
   * Mit vier Feldern lag zwischen Mitte und Rand genau EIN Punkt — daran kann
   * man keinen aufgestellten Rand zeigen, er wuerde zur schraegen Ebene
   * verschliffen. Acht Felder geben drei Punkte je Seite und damit einen
   * erkennbaren Uebergang von Boden auf Rand. Kostet 1.520 Dreiecke am ganzen
   * Greifer und KEIN einziges Netz.
   */
  const QUER = 8;

  /*
   * Gebaut wird auf den FEINEN Stuetzstellen — dieselbe Bahn, nur rund statt
   * facettiert. Die groben sieben bleiben der Vertrag fuer Mass und Kinematik.
   */
  const fein = feineStationen(3).map((f) => ({ ...f, z: f.z + schub }));
  const ENDE = fein.length - 1;
  const lagen: number[][][] = [];
  for (const seite of [0, 1]) {
    const reihen: number[][] = [];
    for (let k = 0; k <= ENDE; k++) {
      const s0 = fein[k]!;
      const halb = halbbreiteBei(s0.k);
      const reihe: number[] = [];
      for (let j = 0; j <= QUER; j++) {
        const t = j / QUER;
        const x = -halb + t * 2 * halb;
        const w = trogprofil(x, halb, s0.k) + seite * HAUT;
        reihe.push(
          // Aussennormale (-sin th, cos th) — siehe `strang`
          p(x, s0.y - w * Math.sin(s0.th), s0.z + w * Math.cos(s0.th), t, k / ENDE)
        );
      }
      reihen.push(reihe);
    }
    lagen.push(reihen);
  }
  const [aussen, innen] = lagen as [number[][], number[][]];
  for (let k = 0; k < ENDE; k++) {
    for (let j = 0; j < QUER; j++) {
      quad(aussen[k]![j]!, aussen[k]![j + 1]!, aussen[k + 1]![j + 1]!, aussen[k + 1]![j]!);
      quad(innen[k]![j + 1]!, innen[k]![j]!, innen[k + 1]![j]!, innen[k + 1]![j + 1]!);
    }
    quad(aussen[k]![0]!, innen[k]![0]!, innen[k + 1]![0]!, aussen[k + 1]![0]!);
    quad(innen[k]![QUER]!, aussen[k]![QUER]!, aussen[k + 1]![QUER]!, innen[k + 1]![QUER]!);
  }
  const e = ENDE;
  for (let j = 0; j < QUER; j++) {
    quad(innen[0]![j]!, innen[0]![j + 1]!, aussen[0]![j + 1]!, aussen[0]![j]!);
    quad(aussen[e]![j]!, aussen[e]![j + 1]!, innen[e]![j + 1]!, innen[e]![j]!);
  }
  const haut = new THREE.BufferGeometry();
  haut.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  haut.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  haut.setIndex(idx);
  haut.computeVertexNormals();
  const hautMesh = new THREE.Mesh(haut, st.blech);
  hautMesh.name = "06_HAUT";
  g.add(hautMesh);

  /*
   * Seitenwangen: der Versatz ist NEGATIV, die Wange steht also in den Trog
   * hinein. Andersherum verschwindet sie hinter der Haut, und die Schale liest
   * sich als flaches Blech — genau so sah sie im ersten Anlauf aus.
   */
  /*
   * EIN GUSS — nichts steht ab.
   *
   * Ansage 13.09.2026: „eben, das ist alles falsch … ein Guss, keine nach oben
   * stehenden Bleche", und davor: „es gibt keine Bleche nach oben, nur
   * Stahlbleche, die das innere Material zusammenhalten sollen."
   *
   * Die Seitenansicht der Zeichnung zeigt genau drei Dinge und sonst nichts:
   * das Blech (15 mm), die Verstärkung darauf (25 mm, nach vorn dicker) und
   * den Zahn, der sie fortsetzt. Keine Seitenwangen, keine Mittelrippe. Das
   * Blech selbst ist das Stahlblech, das die Ladung hält — seine Wölbung tut
   * das, nicht angesetzte Wände.
   *
   * Damit fallen alle Aufbauten weg, die ich nacheinander gebaut hatte:
   * tiefe Randwangen, Holm, Vierkantrohr, Mittelrippe.
   */
  /*
   * Zwei Koerper, als einer gegossen.
   *
   * Erstens das Blech — Form und Kruemmung stellen die Innenflaeche der Spinne
   * dar. Zweitens eine zentrierte Strebe, die mittig darauf liegt und die
   * Aussenkanten der Schale nicht erreicht.
   *
   * Angesetzte Seitenwaende gibt es nicht: Im Querschnitt C-C tragen nur diese
   * beiden Teile eine Bemassung, und die Schenkel, die dort nach unten laufen,
   * sind das gebogene Blech selbst im Schnitt.
   */
  /*
   * Die Strebe liegt AUSSEN auf dem Blech, mittig, und laeuft durch — von
   * Station 0 bis zur Spitze. Ihre Breite endet deutlich vor den Aussenkanten
   * der Schale, ihre Hoehe faellt gleichmaessig von 130 auf 75 mm. Unten ist
   * sie damit schmaler als oben, aber nie duenn.
   */
  /*
   * EIN Gusskörper — von der Lagerhülse bis unter den Zahn, ohne Fuge.
   *
   * Vorher standen hier zwei Sachen nebeneinander: 18 Strebenstücke auf dem
   * Blech und, davor, zwei Quader (`06_UNTERE_ANBINDUNG` als Brücke zum Bolzen,
   * `06_OBERE_ANBINDUNG` als Konsole für das Zylinderauge). In der
   * Seitenansicht las sich das als Metallblock, an dem ein Zinken hängt —
   * Patricks Befund vom 14.09.2026. Beim Vorbild (MG4.1, Schalenform HO) gibt
   * es diese Trennung nicht.
   *
   * Jetzt ist es ein Zug: `fersenStationen` legt die Kurve vom Bolzen an
   * Station 0, `feineStationen` führt sie bis zur Spitze weiter, und ein
   * einziger `strang` läuft über beide. Der Querschnitt wandert dabei
   * durchgehend — 400 × 280 mm am Bolzen, 220 × 130 mm an Station 0, von dort
   * mit `verjuengung` auf die Zahnbasis. Dick am Drehpunkt, schlank zur Spitze.
   *
   * Die 18 Einzelstücke sind mitverschwunden: Sie waren nur nötig, solange
   * jeder Abschnitt seine eigenen Normalen brauchte. Ein durchgehender Strang
   * schattiert sich am Stück — und spart 17 Meshes.
   */
  const ferse = fersenStationen(10, versatz);
  const anschlussB = STREBE_B_OBEN;
  const anschlussH = STREBE_H_OBEN;
  const anschlussV = woelbungBei(halbbreiteBei(0), 0) + BLECH;
  const bahn: Array<{ y: number; z: number; th: number }> = [];
  const breiten: number[] = [];
  const hoehen: number[] = [];
  const versaetze: number[] = [];
  /* Ohne die letzte Fersenstation — die ist Station 0 und kommt aus `fein`. */
  for (const f of ferse.slice(0, -1)) {
    /*
     * Die SCHULTER — hier geht der Arm in die Schale über, und man sieht es.
     *
     * Vorher lief eine einzige weiche Blende über die ganze Ferse: Der Arm
     * wurde von der ersten Station an gleichmässig dünner und war irgendwann
     * die Schale. Auf der Herstellerzeichnung vom 14.09.2026 ist das anders —
     * dort ist „eine sichtbare Schulter, wo der Arm in die Schale übergeht".
     *
     * Jetzt sind es zwei Abschnitte: Über die ersten `SCHULTER_AB` der Ferse
     * nimmt der Arm nur um `SCHULTER_VOR` seines Weges ab, bleibt also satt;
     * danach fällt er über ein Drittel der Ferse auf den Schalenquerschnitt.
     * In der Seitenansicht ist das ein Knick in der Rückenlinie statt einer
     * durchgehenden Rundung.
     *
     * Die drei Zahlen sind Startwerte (SW 14.09.2026), nach Augenmass an der
     * Zeichnung: knapp die halbe Ferse trägt den Arm, der Absatz sitzt im
     * zweiten Drittel. Sie ändern nichts an Bolzen- und Schalenquerschnitt —
     * nur daran, WO dazwischen die Dicke verloren geht.
     *
     * AM 15.09.2026 PROBEWEISE AUSGELAUFEN UND WIEDER ZURÜCKGENOMMEN (E-069).
     * Patricks Vorbildfoto (`docs/f5-vorbild-aufnahme-patrick-2026-09-15.jpg`)
     * zeigt an genau dieser Stelle — sein gelber Kringel liegt darauf — einen
     * durchgehenden Schwung ohne Absatz. Gemessen ist der Absatz hier auch
     * deutlich: Im stärksten Zehntel verliert der Arm das **3,8-fache** seines
     * mittleren Dickenabfalls (`tools/fuenfschalen/kontur.ts`).
     *
     * Eine einzige Glättung über die ganze Ferse (`w = t²·(3−2t)`) bringt das
     * auf **1,7** — und kostet dem **Zylinderauge seinen Sitz im Guss**: Es
     * steht danach **60 statt 26 mm** vor dem `06_ZINKEN` (gemessen mit
     * `traverse-messen.miss`). Genau diese Eigenschaft hat E-013 erkämpft, als
     * die Konsole abgeschafft wurde. Die Schulter bleibt deshalb stehen, bis
     * die Anlenkung mitgeplant wird — mit beiden Zahlen im Log.
     */
    const SCHULTER_AB = 0.42;
    const SCHULTER_BIS = 0.74;
    const SCHULTER_VOR = 0.22;
    const knie = Math.max(0, Math.min(1, (f.t - SCHULTER_AB) / (SCHULTER_BIS - SCHULTER_AB)));
    const w =
      f.t <= 0
        ? 0
        : SCHULTER_VOR * f.t + (1 - SCHULTER_VOR) * knie * knie * (3 - 2 * knie);
    /* Hinter dem Bolzen läuft die Nabe rund aus — Ellipse statt Stirnfläche. */
    const nase = f.t < 0 ? Math.sqrt(1 - f.t * f.t) : 1;
    /*
     * Innen- und Aussenflaeche werden EINZELN ueberblendet, nicht Dicke und
     * Versatz. Mit der Dicke gerechnet hob sich die Innenflaeche ab t = 0,67
     * von der Mittellinie ab — bis zu 50 mm Luft zwischen Kurve und Werkstoff,
     * eine Kerbe auf der Trogseite der Schulter. Der Wächter
     * `test/schalenform.test.ts` hat sie gefunden; in der Seitenansicht sah man
     * sie als Absatz zwischen Ferse und Blech.
     *
     * Innen läuft der Körper deshalb genau auf die Mittellinie zu — dort setzt
     * das Blech an. Aussen läuft er auf die Oberkante von Blech plus Strebe zu.
     */
    const innen = (-FERSE_H_BOLZEN / 2) * (1 - w) + 0 * w;
    const aussen = (FERSE_H_BOLZEN / 2) * (1 - w) + (anschlussV + anschlussH) * w;
    bahn.push({ y: f.y, z: f.z, th: f.th });
    breiten.push((2 * schalenHalbbreite(0) * (1 - w) + anschlussB * w) * nase);
    hoehen.push((aussen - innen) * nase);
    versaetze.push(innen * nase);
  }
  for (const f of fein) {
    /* Aussenflaeche der Haut — darauf sitzt die Strebe ueber die ganze Laenge. */
    const auf = woelbungBei(halbbreiteBei(f.k), f.k) + BLECH;
    /*
     * An der Schulter reicht der Guss bis auf die Trogflaeche durch.
     *
     * Ab Station 1 sitzt die Strebe auf dem Blech, so wie bisher. Über den
     * ersten Abschnitt läuft ihre Innenfläche aber auf die Mittellinie zu —
     * sonst klafft zwischen Ferse (Innenfläche auf der Mittellinie) und Strebe
     * (Innenfläche 67 mm darüber) ein Keil, und genau den hat der Wächter an
     * der Schulter gemeldet. Die AUSSENfläche bleibt unverändert; die
     * Seitenansicht ändert sich dadurch nicht.
     */
    const innen = auf * Math.min(1, f.k);
    bahn.push({ y: f.y, z: f.z, th: f.th });
    /* Alles mit demselben Faktor — das ist die „durchgaengig proportionale" Form. */
    breiten.push(STREBE_B_OBEN * verjuengung(f.k));
    hoehen.push(auf + STREBE_H_OBEN * verjuengung(f.k) - innen);
    versaetze.push(innen);
  }
  const zinken = new THREE.Mesh(strang(bahn, 0, breiten, hoehen, versaetze), st.guss);
  zinken.name = "06_ZINKEN";
  g.add(zinken);

  /*
   * Die Lagerhülse am Drehpunkt — die Hülse, von der Patrick spricht.
   *
   * Sie steckt IM Gusskörper und steht 50 mm auf jeder Seite über ihn hinaus.
   * Genau daran erkennt man auf einem Bild ein Lager: Man sieht die Bohrung von
   * der Seite, und sie sitzt nicht auf einem Kasten, sondern in Material, das
   * von dort ohne Fuge in den Zinken läuft.
   */
  const hueltLaenge = 2 * schalenHalbbreite(0) + 0.1;
  const lagerauge = new THREE.Mesh(rohr(0.085, 0.042, hueltLaenge), st.guss);
  lagerauge.name = "06_LAGERAUGE";
  g.add(lagerauge);
  /*
   * Das Zylinderauge — am SELBEN Körper, keine Konsole mehr.
   *
   * Vorher war es ein Rohr Ø 110 mm in einem Quader von 0,33 × 0,18 × 0,16 m.
   * Jetzt ist es ein Nabenauge mit 150 mm Außendurchmesser: Es reicht mit
   * seinem Rand (Normalabstand 0,085 m) bis in den Rücken des Gusskörpers
   * (beginnt bei 0,0675 m) und nach innen bis in das Blech — der Werkstoff ist
   * durchgehend, es steht nichts mehr davor. `OBERE_ANBINDUNG` selbst bleibt
   * unverändert; daran hängt die ganze Zylinderkinematik.
   */
  const zylinderauge = new THREE.Mesh(rohr(AUGE_R, 0.032, STREBE_B_OBEN + 0.06), st.guss);
  zylinderauge.name = "06_ZYLINDERAUGE";
  zylinderauge.position.set(0, OBERE_ANBINDUNG.y, OBERE_ANBINDUNG.z + schub);
  g.add(zylinderauge);
  /*
   * DER HALS ZWISCHEN NABE UND KERN — die Konsole, so klein wie sie sein darf.
   *
   * Mit E-039 rueckt das Auge von (0 / 0,31) auf (−0,08 / 0,245). Gemessen
   * (`tools/fuenfschalen/augensonde.ts`) steht der Bohrungsmittelpunkt danach
   * 26 mm vor dem Gusskoerper; 28 von 72 Punkten des Nabenrandes stecken noch
   * darin, die uebrigen haengen frei. Ohne Werkstoff dazwischen schwebte die
   * Nabe unter der Ferse — schlimmer als jede Konsole.
   *
   * E-013 hat genau so ein Teil abgeschafft („der Zinken ist ein Gussstueck,
   * ein Element, kein Stempel guckt heraus"). Drei Dinge halten den Rueckschritt
   * so klein wie moeglich:
   *
   *   1. DERSELBE WERKSTOFF, KEINE NAHT. `st.guss`, keine Kehlnaht, gefaste
   *      Laengskanten wie am Zinken — der Hals liest sich als Teil des
   *      Gussstuecks, nicht als angeschweisster Sockel.
   *   2. NIE BREITER ALS DIE NABE. Quer zur Bahn misst er 2 · `AUGE_R`, also
   *      genau den Aussendurchmesser des Auges. In der Seitenansicht — der
   *      Ansicht, in der Patrick die Form liest — verschwindet er damit hinter
   *      der Nabe: Die Silhouette zeigt den Nabenkreis und sonst nichts.
   *      Ein Stempel ist etwas, das ueber seinen Anschluss hinaussteht; das
   *      kann dieser Koerper nicht.
   *   3. ER LAEUFT VON NABE ZU NABE, NICHT VON DER HAUT ZUM AUGE. Sein Fuss
   *      sitzt auf der LAGERHUELSE — dem Bolzen, Ursprung dieses Frames —, und
   *      beide Naben haben denselben Aussenradius `AUGE_R`. Damit ist er der
   *      Steg zwischen zwei gleich hohen Naben, so wie ihn jedes Gussstueck
   *      hat, das zwei Bohrungen verbindet. Von seiner Laenge liegen die
   *      ersten rund vier Fuenftel im Werkstoff der Ferse; frei steht nur der Rest.
   *      Sass das Auge im Guss (so war es bis E-039), liegt er bis auf einen
   *      Rest darin — nachgestellt mit der Anlenkung A verdeckt er noch
   *      0,015 m² mehr vom Schlund, sonst nichts. Deshalb gibt es keine
   *      Fallunterscheidung, die man vergessen koennte.
   *
   * WAS ER KOSTET, gemessen: 6 l Korb von 1.615 l. Das ist genau der Rest,
   * der frei steht — 26 mm bei einem Querschnitt von 170 x 280 mm, fuenfmal.
   * Die 1.529 l auf dem Blatt vom 15.09.2026 sind ohne ihn gerechnet, weil es
   * ihn da noch nicht gab; mit ihm sind es 1.523 l, und der Stand bis E-039
   * kommt, gleich gemessen, auf 1.520 l.
   *
   * Nicht genommen: den Fuss auf die naechste Stelle der Fersenkurve zu legen.
   * Die liegt bei Station 0, also schraeg nach AUSSEN — der Steg haette dann
   * quer unter der Schalenhaut gelegen statt laengs zum Bolzen, und genau das
   * liest sich als angesetzte Rippe.
   */
  const halsY = OBERE_ANBINDUNG.y;
  const halsZ = OBERE_ANBINDUNG.z + schub;
  const halsL = Math.hypot(halsY, halsZ);
  /*
   * BEIDE BOHRUNGEN BLEIBEN FREI — der Steg endet 60 mm vor jeder Nabenmitte.
   *
   * Von Mitte zu Mitte gezogen legte er sich ueber beide Bohrungen und
   * schloss jede zur Haelfte; im Umriss stand statt eines Loches ein
   * halbmondfoermiger Schlitz. Ein Lagerauge, durch das kein Bolzen passt, ist
   * im Bild sofort als Fehler zu erkennen — und es war einer.
   *
   * 60 mm liegen noch innerhalb des Nabenrandes (`AUGE_R` = 85 mm): Der Steg
   * steckt also an beiden Enden im vollen Werkstoff der Nabe und laesst die
   * Bohrungen (Ø 84 bzw. 64 mm) frei.
   */
  const halsAb = 0.06 / halsL;
  /*
   * Die Bahn ist eine Strecke; `strang` traegt den Querschnitt laengs der
   * Normalen (−sin th, cos th) ab, und die Laufrichtung einer Station ist bei
   * allen Bahnen dieser Datei (−cos th, −sin th) — so legen es
   * `schalenStationen` und `fersenStationen` an. Also `atan2(−dz, −dy)`, nicht
   * `atan2(dz, dy)`.
   *
   * Mit dem falschen Vorzeichen laeuft die Bahn der Regel entgegen, und
   * `strang` dreht dabei die Flaechen nach innen: Der Koerper ist dann ein
   * LOCH statt eines Klotzes. Gemessen hat die Sonde das sofort gemeldet — mit
   * Konsole steckten noch 9 von 72 Punkten des Nabenrandes im Werkstoff statt
   * 28 ohne sie. Ein Koerper, der Werkstoff wegnimmt, ist keine Konsole.
   */
  const halsTh = Math.atan2(-halsZ, -halsY);
  const halsBahn = [0, 1 / 3, 2 / 3, 1].map((s) => {
    const t = halsAb + (1 - 2 * halsAb) * s;
    return { y: halsY * t, z: halsZ * t, th: halsTh };
  });
  /*
   * Quer misst er ueberall 2 · `AUGE_R`, laengs der Bolzenachse ueberall so
   * viel wie die Nabe (`STREBE_B_OBEN` + 0,06). Ein Steg mit konstantem
   * Querschnitt, nicht ein Keil, der irgendwo breiter wird als seine Naben.
   */
  const hals = new THREE.Mesh(
    strang(halsBahn, 0, STREBE_B_OBEN + 0.06, 2 * AUGE_R, -AUGE_R),
    st.guss
  );
  hals.name = "06_AUGENKONSOLE";
  g.add(hals);
  /*
   * Keine Kehlnähte mehr an der Schale. Drei waren hier: zwei längs der Nabe,
   * eine unter der Konsole. Eine Schweißnaht ist die Ansage „hier sind zwei
   * Teile zusammengesetzt" — und genau das soll die Schale nicht mehr sagen.
   * Auch der Hals bekommt keine: Er ist mitgegossen, nicht angesetzt.
   */

  return g;
}

/* ------------------------------------------------------ 07 Greiferspitze */

/** Biegeradius des Zahns (m) — aus der Zeichnung `zahngreifer` vom 13.09.2026. */
const ZAHN_R = 0.7;
/**
 * Stationen des Zahns: Abstand vom Sitz (m), Breite und Höhe als Faktor der Basis.
 *
 * Vier Stationen statt sechs, und das Ende bleibt stumpf. Ansage 13.09.2026:
 * „Kantenschutz braucht nicht so viel Detailtiefe und sind eher stumpfe
 * Elemente." Die Zeichnung läuft auf 22 × 14 mm aus; hier endet der Zahn bei
 * 74 × 20 mm. Das ist Kantenschutz, keine Schneide.
 *
 * Die Verjüngung lief einmal auf 0,34 der Basisbreite aus (41 mm bei 120 mm
 * Basis) — eine Nadel. Ansage 14.09.2026: „die Zacken sind spitzer als beim
 * Original"; beim Vorbild sind es kurze, breite, angeschraubte Keile. Die Höhe
 * darf dabei nicht mitwachsen, sonst meldet `schalenform.test.ts` zu Recht,
 * dass das Ende dicker ist als die Mitte.
 *
 * Steht seit dem 14.09.2026 hier oben statt im Bauteil, weil `zahnEigenwinkel`
 * dieselben Zahlen braucht: Die Anstellung des Zahns folgt aus seiner eigenen
 * Biegung, und die steckt in diesen Zeilen.
 *
 * E-137 (17.10.2026), Patrick: „die Zacken bei dem greifer sind zu spitz.
 * entweder aufweichen oder entfernen." Aufgeweicht, nicht entfernt: Die BREITE
 * bleibt bis kurz vor dem Ende fast voll (0,97 / 0,92 / 0,84 statt 0,90 /
 * 0,76) und rundet erst auf den letzten 25 mm auf das alte Ende ab — von vorn
 * eine stumpfe, runde Nase statt eines Keils. Die DICKE und das Ende
 * (0,62 × 0,52) bleiben Ziffer fuer Ziffer, die Zwischenstation bei 0,225 m
 * liegt auf der alten Linie (0,577). Darum wandern Grabtiefe (2,7439 m),
 * Bodenanschlag (20,44 cm), Sensorkugel und Eigenwinkel (12,15°) nicht: Sie
 * haengen an der Unterkante und an den Stirnflaechen, nicht an der Breite
 * (gemessen, `greiferF5`, `greiferachse`, `zahnkontur`). SW: die drei Breiten.
 */
export const ZAHN_STATIONEN: Array<[number, number, number]> = [
  [0, 1, 1],
  [0.09, 0.97, 0.86],
  [0.18, 0.92, 0.68],
  [0.225, 0.84, 0.577], // 0,577 = alte Dicke auf dieser Hoehe (0,68 → 0,52 linear)
  [0.25, 0.62, 0.52],
];

/** Breite und Höhe des Zahns an seinem Sitz (m) — der Querschnitt des Schalenendes. */
function zahnBasis(): { b: number; h: number } {
  return {
    /*
     * 16.09.2026 (E-090): aus der POSITIONSLISTE, nicht mehr vom Schalenende.
     *
     * Solange die Zahnbreite am Schalenende hing, wuchs der Zahn mit jeder
     * Verbreiterung der Schale mit — und der Absatz an seinem Sitz, den man am
     * Vorbild sieht, konnte gar nicht entstehen. Jetzt ist der Saum 240 mm
     * breit und der Zahn 120 mm: 60 mm Schulter je Seite. Patrick am
     * 16.09.2026, gefragt, ob der Absatz bleiben soll: „Absatz ist richtig,
     * wie auf dem Foto."
     */
    b: MASS.spitze.breite,
    /*
     * Die Basis ist genau die Strebenhöhe am Schalenende — NICHT plus Blech.
     * Die flache Seite des Zahns liegt schon auf der Aussenfläche des Blechs;
     * das Blech noch einmal zur Höhe zu addieren zählt es doppelt. Gemessen
     * sprang die Dicke dadurch am Übergang von 88 auf 120 mm.
     */
    h: STREBE_H_OBEN * verjuengung(SCHALEN_ABSCHNITTE),
  };
}

/**
 * Ein Querschnitt des Zahns, gebogen, im Zahnrahmen — ohne Anstellung, ohne `z0`.
 *
 * Das Profil ist ein Fünfeck: flache Innenseite, zwei abgeschrägte Schultern,
 * First in der Mitte. Gebogen wird wie in der Vorlage — die Länge entlang der
 * Achse bleibt erhalten, sie wird nur zum Bogen; Punkte weiter aussen liegen
 * auf grösserem Radius.
 *
 * Die Höhe läuft nach +z, die Länge nach −y. Eine Drehung um x um `th` bildet
 * lokales (0,0,1) auf (0, −sin th, cos th) ab — und genau das IST die
 * Aussennormale des Bogens; (0,−1,0) wird zur Tangente. Der Zahn steht damit
 * auf dem Blech und setzt die Sichel fort.
 */
function zahnRing(si: number): Array<[number, number, number]> {
  const [x, fb, fh] = ZAHN_STATIONEN[si]!;
  const { b, h } = zahnBasis();
  const hb = (b * fb) / 2;
  const hh = h * fh;
  const w = x / ZAHN_R;
  return (
    [
      [-hb, 0],
      [hb, 0],
      [hb * 0.84, hh * 0.65],
      [0, hh],
      [-hb * 0.84, hh * 0.65],
    ] as Array<[number, number]>
  ).map(([pz, py]) => {
    const r = ZAHN_R + py;
    return [pz, -(r * Math.sin(w)), -ZAHN_R + r * Math.cos(w)] as [number, number, number];
  });
}

/** Schwerpunkt eines Zahnquerschnitts im Zahnrahmen. */
function zahnMitte(si: number): { y: number; z: number } {
  const r = zahnRing(si);
  return {
    y: r.reduce((s, q) => s + q[1], 0) / r.length,
    z: r.reduce((s, q) => s + q[2], 0) / r.length,
  };
}

/**
 * Wie schief steht der Zahn in sich selbst? (rad)
 *
 * Zurückgegeben wird die Drehung um x, die seine ACHSE senkrecht stellt, wenn
 * sein Rahmen nicht gedreht ist. Die Achse ist die Verbindung der beiden
 * Stirnflächen-Schwerpunkte, nicht die Tangente am Sitz: Der Zahn ist über
 * seine 250 mm mit R 0,70 gebogen, seine Achse liegt also rund eine halbe
 * Biegung hinter der Sitztangente. Gemessen 12,15°.
 *
 * Genau daran ist der Anschlag `OFFEN` vorbeigegangen. Er ist so gewählt, dass
 * die TANGENTE des Schalenendes offen senkrecht steht (Ansage 13.09.2026: „die
 * Spitzen senkrecht"). Der Zahn steht danach noch um seine eigene Biegung
 * schräg — auf der Herstellerzeichnung vom 14.09.2026 tut er das nicht.
 */
export function zahnEigenwinkel(): number {
  const a = zahnMitte(0);
  const e = zahnMitte(ZAHN_STATIONEN.length - 1);
  const dy = e.y - a.y;
  const dz = e.z - a.z;
  /* Gesucht ist θ mit dy·sin θ + dz·cos θ = 0, also θ = atan2(dz, −dy). */
  return Math.atan2(dz, -dy);
}

/**
 * Anstellwinkel des Zahns GEGEN DIE SCHALE (rad) — eine feste Zahl, keine
 * Animation.
 *
 * Mit dem gebauten Anschlag ist sie **null**: Der Zahn sitzt TANGENTIAL auf
 * dem Schalenende, seine Sitzfläche setzt die Krümmung der Schale fort, und am
 * Übergang gibt es keinen Richtungssprung.
 *
 * DAS IST EINE ENTSCHEIDUNG GEGEN EINE FRÜHERE, UND SIE IST SO GEWOLLT.
 * Bitte nicht „reparieren".
 *
 *   13.09.2026, Patrick: „wenn die Spinne offen ist, sollten die Schalen
 *   weiter offen gehen, sodass die Spitzen senkrecht stehen."
 *
 * Daraus wurde am 14.09.2026 ein Term `+ zahnEigenwinkel()`: Der Zahn ist über
 * seine 250 mm mit R 0,70 gebogen, seine ACHSE liegt also 12,15° hinter seiner
 * Sitztangente, und um genau diese 12,15° wurde er gegendreht, damit die Achse
 * offen lotrecht steht. Die Gegendrehung IST der sichtbare Knick.
 *
 *   15.09.2026, Patrick vor dem Bild und einem Vorbildfoto: „dieser harte
 *   Knick im Zahn, den gibt es nicht. Das ist nicht so."
 *
 * Am Blatt `docs/f5-zahnknick-2026-09-15.svg` standen drei Formen; Patrick hat
 * **B** gewählt (E-069). Der Term fällt weg. Der Preis steht im Log und ist
 * gemessen: Der Zahn hängt bei voll geöffnetem Greifer **12,15° nach innen**
 * statt lotrecht. Die Alternative C hätte die Achse lotrecht gehalten, dafür
 * aber den Hebelarm des Zylinders ganz offen von 118 auf 47 mm fallen lassen —
 * genau die Zahl, für die E-039 die Traverse umgebaut hat.
 *
 * Die Formel bleibt als Formel stehen, weil die Weltdrehung des Zahns
 * `−Schwenk + schalenEnde().th + Anstellung` ist: Wer über den `Formsatz` in
 * `rig.ts` einen anderen Anschlag setzt, bekommt damit die SITZTANGENTE offen
 * lotrecht gestellt — dieselbe Regel wie für die Schale, nur auf den Zahn
 * durchgezogen. Beim gebauten Anschlag ist das Ergebnis null.
 */
export function zahnAnstellung(offen = OFFEN): number {
  return offen - schalenEnde().th;
}

/** Wie hoch der Zahnsitz über der Mittellinie der Schale liegt (m). */
function zahnZ0(): number {
  return woelbungBei(schalenHalbbreite(SCHALEN_ABSCHNITTE), SCHALEN_ABSCHNITTE) + BLECH;
}

/**
 * Der Sitz — Anstellung und Einsitztiefe in einem.
 *
 * `dreh` dreht einen Punkt des Zahnrahmens um den Schwerpunkt der Sitzfläche,
 * also um den Punkt, in dem die Zahnachse die Schale verlässt: Die Spitze
 * wandert, der Sitz nicht. `tief` schiebt den Zahn anschliessend so weit in die
 * Schale hinein, dass die angeschrägte Sitzfläche nirgends von ihrem
 * Schalenende abhebt — ohne sie klafft dort ein Keil von knapp 4 mm.
 */
function zahnSitz(offen = OFFEN): {
  dreh: (py: number, pz: number) => [number, number];
  tief: number;
} {
  const w = zahnAnstellung(offen);
  const c = Math.cos(w);
  const s = Math.sin(w);
  const nabe = zahnMitte(0);
  const dreh = (py: number, pz: number): [number, number] => [
    nabe.y + (py - nabe.y) * c - (pz - nabe.z) * s,
    nabe.z + (py - nabe.y) * s + (pz - nabe.z) * c,
  ];
  let tief = 0;
  for (const q of zahnRing(0)) tief = Math.min(tief, dreh(q[1], q[2])[0]);
  return { dreh, tief };
}

/**
 * Die Achse des gebauten Zahns, im Rahmen der Greiferspitze.
 *
 * Dasselbe für den Zahn, was `feineStationen` für die Sichel ist: Punkt und
 * Tangente, mit der Aussennormalen (−sin th, cos th). Der Formwächter braucht
 * sie, seit der Zahn nicht mehr auf dem Kreis der Schale weiterläuft — ein
 * Strahl längs der SCHALENnormalen schneidet ihn jetzt schräg und meldet
 * Dicken, die es nicht gibt.
 */
export function zahnBahn(je = 4, offen = OFFEN): Array<{ y: number; z: number; th: number; k: number }> {
  const { dreh, tief } = zahnSitz(offen);
  const w0 = zahnAnstellung(offen);
  const z0 = zahnZ0();
  const letzte = ZAHN_STATIONEN.length - 1;
  const aus: Array<{ y: number; z: number; th: number; k: number }> = [];
  for (let i = 0; i <= letzte * je; i++) {
    const k = i / je;
    const a = Math.min(letzte - 1, Math.floor(k));
    const t = k - a;
    const mA = zahnMitte(a);
    const mB = zahnMitte(a + 1);
    const [py, pz] = dreh(mA.y + (mB.y - mA.y) * t, mA.z + (mB.z - mA.z) * t);
    const x = ZAHN_STATIONEN[a]![0] + (ZAHN_STATIONEN[a + 1]![0] - ZAHN_STATIONEN[a]![0]) * t;
    aus.push({ y: py - tief, z: z0 + pz, th: w0 + x / ZAHN_R, k });
  }
  return aus;
}

/**
 * Greiferspitze — geschmiedet, austauschbar, fünfmal.
 *
 * Sie darf die Seitenansicht der Schale nicht verändern. Vorher tat sie das:
 * Der Kragen war mit 138 mm breiter als die Schale an ihrem Ende (110 mm), und
 * der Kegel setzte mit 120 mm ebenfalls darüber auf. In der Seitenansicht sah
 * die Schale damit aus, als würde sie ganz unten noch einmal ausstellen — ein
 * Fuß, wo eine Spitze hingehört.
 *
 * Deshalb kommt die Breite jetzt nicht mehr aus der Positionsliste, sondern
 * aus `schalenHalbbreite` an der letzten Station: Der Schuh ist genau so breit
 * wie das Schalenende, keinen Millimeter mehr. Was darunter heraussteht, sind
 * nur noch die beiden Zacken — gleich groß, schmal, auf einen Punkt zulaufend.
 */
export function baueGreiferspitze(st: Stoffe, offen = OFFEN): THREE.Group {
  const g = new THREE.Group();
  g.name = "07_GREIFERSPITZE";
  /*
   * Zahn nach der Zeichnung `zahngreifer` — Stationen und Querschnitt
   * uebernommen, nicht geschaetzt.
   *
   * Abgewickelt 320 mm lang, von 110 x 75 mm an der Basis auf 22 x 14 mm an
   * der Spitze. Der Querschnitt ist ein Fuenfeck: flache Innenseite, zwei
   * abgeschraegte Schultern, First in der Mitte. Gebogen wird mit demselben
   * Radius wie das Blech, damit der Zahn dessen Kurve fortsetzt — genau das
   * macht das Schliessen sauber.
   *
   * Meine letzte Fassung hatte ihn mit konstantem Querschnitt gebaut. Die
   * Zeichnung zeigt das Gegenteil: Er verjuengt sich auf ein Fuenftel.
   */
  /*
   * Vier Stationen statt sechs, und das Ende bleibt stumpf.
   *
   * Ansage 13.09.2026: „Kantenschutz braucht nicht so viel Detailtiefe und
   * sind eher stumpfe Elemente." Die Zeichnung laeuft auf 22 x 14 mm aus; hier
   * endet der Zahn bei 74 x 20 mm (gemessen 14.09.2026). Das ist Kantenschutz,
   * keine Schneide, und spart Dreiecke, die in der Spielkamera niemand sieht.
   */
  /*
   * Die Spitze setzt den Zinken fort — in seinen Proportionen.
   *
   * Handskizze 13.09.2026: Der Zinken laeuft durchgehend schmaler zu und endet
   * rund, nicht in einem angesetzten breiten Zahn. Die Basis hier ist deshalb
   * genau der Querschnitt, den Blech und Strebe am Schalenende haben; von dort
   * laeuft sie auf eine stumpfe, gerundete Spitze aus.
   */
  /*
   * Kurzer breiter Keil, keine Nadel — Stationen und Querschnitt stehen jetzt
   * oben bei `ZAHN_STATIONEN`, weil auch `zahnEigenwinkel` sie braucht.
   */
  /* Die flache Seite liegt auf der Verstaerkung, also aussen auf dem Blech. */
  const z0 = zahnZ0();
  /* Anstellung und Einsitz — der Zahn sitzt SCHRAEG auf dem Schalenende. */
  const { dreh, tief } = zahnSitz(offen);

  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const p = (x: number, y: number, z: number, tu: number, tv: number): number => {
    const i = pos.length / 3;
    pos.push(x, y, z);
    uv.push(tu, tv);
    return i;
  };
  /* Eckpunkte, wie sie die Stationen ergeben — für die Stirnkappen gebraucht. */
  const ecken = ZAHN_STATIONEN.map((_s, si) =>
    zahnRing(si).map((q) => {
      const [py, pz] = dreh(q[1], q[2]);
      return [q[0], py - tief, z0 + pz] as [number, number, number];
    })
  );
  /*
   * Fünf Flächen, fünf eigene Punktreihen — dieselbe Regel wie im `strang`.
   *
   * Der Querschnitt ist ein Fünfeck mit First: flache Innenseite, zwei
   * abgeschrägte Schultern, Rücken. Teilen sich die Flächen ihre Punkte, mittelt
   * `computeVertexNormals` den First weg, und der Zahn liest sich als runder
   * Dorn statt als gegossener Keil.
   */
  const N = ecken[0]!.length;
  /*
   * ZUERST die beiden Stirnflächen, in der Reihenfolge des Querschnitts.
   *
   * Nicht aus Bauzwang, sondern als Vertrag: Die ersten N Punkte des Netzes
   * sind der Sitzquerschnitt, die nächsten N die Spitze. Daran messen die
   * Wächter Länge und Achse des Zahns (`test/fuenfschalen.test.ts`) und daran
   * misst `tools/fuenfschalen/abcde.ts`. Vorher lagen die Ringe der Reihe nach
   * im Puffer; seit jede Fläche eigene Punkte hat, tun sie das nicht mehr.
   */
  const kappe = (si: number, gedreht: boolean): void => {
    const ring = ecken[si]!.map((q, j) => p(...q, j / N, gedreht ? 0 : 1));
    for (let k = 1; k < ring.length - 1; k++) {
      if (gedreht) idx.push(ring[0]!, ring[k + 1]!, ring[k]!);
      else idx.push(ring[0]!, ring[k]!, ring[k + 1]!);
    }
  };
  kappe(0, true);
  kappe(ecken.length - 1, false);
  for (let e = 0; e < N; e++) {
    const f = (e + 1) % N;
    let vor: [number, number] | null = null;
    for (let si = 0; si < ecken.length; si++) {
      const v = si / (ecken.length - 1);
      const a = p(...ecken[si]![e]!, e / N, v);
      const b = p(...ecken[si]![f]!, (e + 1) / N, v);
      if (vor) idx.push(vor[0], b, vor[1], vor[0], a, b);
      vor = [a, b];
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  /*
   * Dasselbe Gusseisen wie die Schale, nicht das helle Bolzenmaterial.
   *
   * Ansage 13.09.2026: „wie kann es sein, dass das Ende dicker ist als die
   * Mitte?" Gemessen war es das nicht — die Spitze laeuft von 72 auf 25 mm zu
   * und schliesst buendig an das Schalenende an. Es war die FARBE: In Hellgrau
   * las sie sich als aufgesetzter Schuh. Die Skizze zeigt ein Stueck aus
   * dickem gegossenem Eisen.
   */
  const zahn = new THREE.Mesh(geo, st.guss);
  zahn.name = "07_ZAHN";
  g.add(zahn);
  /*
   * Keine Schrauben an der Spitze. Die Bohrung sitzt laut Skizze OBEN am Kopf
   * des Zinkens, wo er am Stempel haengt — nicht unten. Und mit 90 mm Laenge
   * standen die Huelsen 9 mm ueber die Schale hinaus, die dort nur noch 72 mm
   * breit ist.
   */
  return g;
}

/*
 * Weggelassen, auf Ansage vom 13.09.2026:
 *
 *   - Hydraulikleitungen und Verbindungsschläuche („kannst weglassen").
 *   - Zylinderschutzbleche. Sie liegen ZWISCHEN den Zylindern, nicht davor —
 *     und weil ich sie zweimal falsch herum gebaut habe, bleiben sie erst mal
 *     draußen („im Zweifel weglassen").
 *   - Schalenverstärkung. Sie steht in der zweiten Fassung der Zeichnung nicht
 *     mehr in der Positionsliste.
 */

/* ------------------------------------------------------------- Übersicht */

/** Alle Einzelteile, in der Reihenfolge der Positionsliste. */
export function einzelteile(st: Stoffe = stoffe()): Array<{
  name: string;
  anzahl: number;
  teil: THREE.Object3D;
}> {
  nahtStoff(st);
  return [
    { name: "01  Aufhaengung / Adapter", anzahl: 1, teil: baueAufhaengung(st) },
    { name: "02  Rotator / Drehwerk", anzahl: 1, teil: baueRotator(st) },
    { name: "03  Drehwerksgehaeuse", anzahl: 1, teil: baueDrehwerksgehaeuse(st) },
    { name: "04  Mitteltraverse", anzahl: 1, teil: baueMitteltraverse(st) },
    { name: "05  Hydraulikzylinder", anzahl: 5, teil: baueZylinder(st).gruppe },
    { name: "06  Greiferschale (HO)", anzahl: 5, teil: baueGreiferschale(st) },
    { name: "07  Greiferspitze", anzahl: 5, teil: baueGreiferspitze(st) },
    { name: "09  Zentrale untere Einheit", anzahl: 1, teil: baueStempel(st) },
  ];
}
