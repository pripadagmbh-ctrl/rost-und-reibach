/**
 * Wächter für das Abkippen.
 *
 * ANLASS, ZWEIMAL DERSELBE (13.09. und 15.09.2026, Patrick):
 *   „die Kipper heben das Material nicht an, sondern es bleibt auf dem Chassis
 *    und taucht unter der Ladefläche"
 *   „Teile fallen immer noch beim Kippen durch die Ladefläche"
 *   „beim Kippen sind Teile ganz woanders auf dem Platz gelandet, nicht mal in
 *    der Nähe vom LKW"
 *
 * WAS ES WAR (E-071, Bild für Bild gemessen): In dem Augenblick, in dem die
 * Mulde zu kippen anfing, verlor Rapier die Paarung zwischen Muldenkollider
 * und Ladung, und die ganze Fuhre fiel im freien Fall — exakt 9,81 m/s² —
 * durch den 0,60 m dicken Muldenboden hindurch. Was dabei wieder aufgefangen
 * wurde, drückte der Löser mit einem einzigen Stoß heraus: gemessen 65,7 m/s
 * an einem Stück, das 0,37 m tief im Kollider steckte. Der „Katapult" war also
 * nie das Kippen, sondern die Entdurchdringung.
 *
 * DIE ENERGIERECHNUNG, die das ohne Physik-Kenntnisse entscheidet: Die Brücke
 * braucht 4,2 s für 58°. Ihre Oberfläche bewegt sich dabei mit höchstens
 * 1,45 m/s, und ganz aufgerichtet liegt ihr höchster Punkt 6,14 m über dem
 * Boden. Mehr als √(2 · 9,81 · 6,14) + 1,45 = 12,4 m/s (45 km/h) kann ein
 * Stück aus diesem Vorgang nicht mitnehmen — das sind 60 Joule je Kilogramm.
 * Gemessen wurden 585 km/h, das sind 13.200 Joule je Kilogramm. Faktor 220.
 * Wo eine Bewegung das Zweihundertfache ihres eigenen Energieinhalts abgibt,
 * ist nicht die Form schuld, sondern der Löser.
 *
 * SEIT E-149 (65°, oben acht Mal um 4° abgerüttelt) dieselbe Rechnung: Die
 * Vorderkante steht 1,05 + 6,00 · sin 65° = 6,49 m hoch; beim Heben bewegt
 * sich die Fläche wie bisher mit 1,45 m/s (gleiches Tempo, 13,8°/s), beim
 * Rütteln mit höchstens 4° · π · 1,5 Hz · 6,00 m = 1,97 m/s. Also
 * √(2 · 9,81 · 6,49) + 1,97 = 13,3 m/s (48 km/h, 88 J/kg). Die Schranke
 * MEDIAN_MAX = 40 km/h liegt weiter darunter: Ein Stück, das von oben
 * herunterkollert, darf schnell sein — eine ganze Fuhre, die es tut, nicht.
 *
 * DIESER WÄCHTER PRÜFT VIER EIGENSCHAFTEN, nicht den Weg dorthin:
 *   1. Die Fuhre fällt nicht durch die Brücke.
 *   2. Sie wird nicht geschleudert.
 *   3. Sie landet in der Nähe des LKW und nicht irgendwo auf dem Platz.
 *   4. Die Brücke wird wieder frei.
 *
 * ER FÄHRT DIE FUHRE, DIE DAS SPIEL WÜRFELT (`spielFuhre`, `rollCustomer`),
 * nicht mehr die milde feste Prüfladung. Bis E-071 hielt er 155/500 km/h an
 * 5.000 kg bei Füllgrad 0,60, während derselbe Apparat mit der Händlerfuhre
 * 159/585 maß — über der eigenen Schranke. Der Wächter war grün und das Spiel
 * kaputt. Er ist dadurch langsamer geworden; das ist der Preis dafür, dass er
 * misst, was der Spieler erlebt (offener Punkt 12, jetzt erledigt).
 *
 * JEDE SCHRANKE HAT EINE GEGENPROBE: derselbe Prüfcode auf einen absichtlich
 * kaputten Eingang. Eine Schranke, die nie rot wird, prüft nichts.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { initPhysics } from "../src/physics/physicsWorld";
import { pruefKunde, spielFuhre } from "./pruefkunde";
import { SAATEN, SAATEN_LANG, reihe, reiheMitLuft, type Reihe } from "./kipperlauf";

/*
 * DER GEMESSENE STAND vom 15.09.2026, gewürfelte Händlerfuhre, 24 Saaten,
 * ganzer Zyklus, nur dynamische Körper:
 *
 *                              Mittel  Median  Höchst   durch  liegt  Endabstand
 *   vor E-071 (Quader 0,60)     147     123     430     86 %    4 %   2,7 / 27,0 m
 *   gebaut (E-071)               29      19     106      0 %   31 %   3,1 /  5,8 m
 *
 * ================================================================
 * WORÜBER DIESER WÄCHTER SEIT E-109 (21.09.2026) NICHT MEHR URTEILT
 * ================================================================
 *
 * Bis dahin urteilte er nach Mittel, Median UND Höchstwert. Das war der Grund,
 * warum er zufällig rot wurde: Jedes `THREE.Object3D` zieht beim Anlegen vier
 * Zufallszahlen (`MathUtils.generateUUID`) aus demselben Strom, aus dem die
 * Ladung gewürfelt wird. Ein Netz mehr am Lkw — ein Leiterrahmen statt eines
 * Quaders, E-108 — verschiebt den Strom und würfelt 24 ANDERE Fuhren. Der
 * Wächter misst dann eine andere Stichprobe derselben Sache und nennt das eine
 * Verschlechterung.
 *
 * GEMESSEN (`tools/kipper-streuung.ts`, 144 frische Saaten, daraus 20.000
 * Gruppen je Grösse; 21.09.2026). Wie oft reisst eine Schranke, OHNE dass sich
 * am Spiel etwas geändert hat:
 *
 *                    24 Saaten   48 Saaten   96 Saaten
 *   Mittel  >= 55      13,99 %      7,00 %      2,04 %
 *   Median  >= 40       3,54 %      0,36 %      0,00 %
 *   Höchst  >= 280     28,89 %     48,63 %     73,91 %   <-- WIRD SCHLIMMER
 *   Endabstand >= 12    0,00 %      0,00 %      0,00 %
 *
 * DIE DRITTE ZEILE IST DIE ANTWORT auf die Frage „mehr Saaten oder raus aus
 * dem Urteil": Beim Höchstwert hilft Messen nicht. Er ist das Maximum einer
 * langschwänzigen Verteilung (144 Einzelläufe: Median 21, Mittel 43, p90 98,
 * p99 322, höchster 336 km/h) und wächst mit jeder weiteren Saat, die man
 * zieht. Eine Schranke auf das Maximum ist eine Schranke auf „habe ich den
 * Ausreisser diesmal erwischt". Genau darum ist sie am 17.09. von 200 auf 280
 * gegangen, und genau darum hätte sie beim nächsten Mal 400 gebraucht.
 *
 * Das MITTEL ist dasselbe eine Stufe schwächer: Es wird vom Schwanz gezogen
 * (Mittel 43 bei Median 21). Bei 24 Saaten reisst es in 14 % der Fälle — das
 * ist der Fehlalarm vom 21.09.2026, „Mittel 56 gegen Schranke 55", ausgelöst
 * von E-108 und nicht vom Kipper.
 *
 * GEURTEILT WIRD DESHALB NACH:
 *   - dem MEDIAN des Tempos über 48 Saaten (0,36 % Fehlalarm)
 *   - dem DURCHFALL, dem LIEGENBLEIBEN und dem ENDABSTAND — den drei Zahlen,
 *     die Patrick tatsächlich sieht, und den stabilsten der Reihe
 *     (Endabstand p05 5,3 … höchster 6,3 m über alle Gruppen)
 *
 * BERICHTET, ABER NICHT GEURTEILT werden Mittel und Höchstwert. Sie stehen in
 * jeder Fehlermeldung mit drin; wer sie wandern sieht, hat einen Hinweis, kein
 * Urteil.
 *
 * FLIEGT DANN NOCH ETWAS AUF? Ja — über den Endabstand, und das ist die
 * ehrlichere Prüfung. Ein Stück mit 585 km/h ist 162 m/s schnell und liegt am
 * Ende nicht mehr neben dem Lkw; vor E-071 waren es 27,0 m. Ein Tempowert, der
 * im nächsten Bild von `items.clampSpeeds` wieder eingesammelt wird, bewegt
 * dagegen kein einziges Stück vom Fleck — den sieht niemand ausser dem
 * Messgerät. Die Gegenprobe unten fährt genau diesen Fall.
 */
const MEDIAN_MAX = 40; // km/h — gemessen 19, nach E-105 20
/** Nur berichtet, nicht geurteilt (E-109): gemessen 29, nach E-105 40. */
const MITTEL_BERICHT = 55;
/** Nur berichtet, nicht geurteilt (E-109): gemessen 106, nach E-105 222. */
const HOECHST_BERICHT = 280;
/** Höchster Anteil, der beim Kippen unter die Brücke geraten darf. */
const DURCH_MAX = 0.1; // gemessen 0,00 (E-071), nach E-106 0,01 ueber 48 Saaten; Fehlalarm 0,00 %
/**
 * Höchster Anteil, der am Ende noch auf der Brücke liegt.
 *
 * 31 % SIND VIEL, UND DAS IST KEIN ZUFALL: Schrott hat in `scrapItems.ts`
 * Reibung 2,2 (Regel MAX, „Schrott verhakt sich"), der Kipper hebt auf 58°,
 * und tan 58° = 1,60 < 2,2. Eine ruhende Fuhre RUTSCHT auf dieser Neigung
 * rechnerisch überhaupt nicht — was herunterkommt, kommt durch Kollern,
 * Nachrutschen und das gekippte Anziehen (`tipCreep`) herunter. Vor E-071 war
 * die Zahl 4 %, aber nur, weil 86 % gar nicht erst liegen blieben, sondern
 * durch die Brücke fielen. Der Vergleich der beiden Zahlen ist also kein
 * Rückschritt, sondern der Unterschied zwischen „weg" und „durchgefallen".
 * Steilerer Winkel oder weniger Reibung ist ein eigenes Paket und eine
 * Gestaltungsfrage (`docs/offene-punkte.md`).
 *
 * ACHTUNG, DIESE SCHRANKE IST DIE NÄCHSTE, DIE ZUFÄLLIG REISST (E-109).
 *
 * Gemessen am 21.09.2026 mit `tools/kipper-streuung.ts` über 144 frische
 * Saaten: Der Anteil, der am Ende noch auf der Brücke liegt, hat sich seit
 * E-105/E-106 von 31 % auf einen Median von 45,7 % verschoben (p05 40,8 %,
 * p99 52,7 %). Die Schranke steht bei 45 %. Über zufällige Sätze von 48 Saaten
 * reisst sie in **59,4 %** der Fälle; der Wächter hält sie heute nur, weil
 * SEIN Saatensatz mit 42 % günstig liegt.
 *
 * SIE WIRD HIER NICHT HOCHGESETZT. Eine Schranke hochzusetzen, damit sie nicht
 * mehr reisst, war schon beim Höchstwert die falsche Antwort. Die Ursache
 * steht unten und ist bekannt: Reibung 2,2 gegen tan 58° = 1,60, eine ruhende
 * Fuhre rutscht auf dieser Neigung rechnerisch nicht. Seit die Fuhre nach
 * E-106 dichter liegt (14,1 statt 11,0 Stücke), kollert auch weniger nach.
 * Das ist eine Gestaltungsfrage — steilerer Winkel, weniger Reibung oder ein
 * Rüttler —, und sie steht in `docs/offene-punkte.md`. Wer diesen Wächter rot
 * sieht, hat also wahrscheinlich nicht seinen eigenen Umbau vor sich.
 *
 * ERLEDIGT MIT E-149 (17.10.2026), und zwar am Spiel, nicht an der Schranke:
 * Der Kipper hebt auf 65° statt 58° und rüttelt die Brücke oben acht Mal um
 * 4° ab (`routes.KIPP_ABLAUF`). Gemessen gepaart über 96 frische Saaten
 * (`tools/kipper-leeren.ts`): siehe LIEGT_MAX unten und Log E-149.
 */
/*
 * SEIT E-149: 30 % statt 45 % — enger, nicht weiter. Gemessen über 144
 * frische Saaten (`tools/kipper-leeren.ts`, 20.000 Gruppen zu 48): Das
 * Mittel einer 48er-Gruppe liegt bei 17,5 % (p99 25,1 %, höchste 30,7 %); über
 * 30 % reisst es zufällig in 0,01 % der Ziehungen. Der Stand VOR E-149 läge
 * mit p01 37,6 % in 100 % der Ziehungen darüber — ein Rückfall fällt also
 * sicher auf. 25 % wäre zu knapp (1,1 % Fehlalarm, E-109).
 */
const LIEGT_MAX = 0.3; // gemessen 0,31 (E-071), nach E-106 0,42, vor E-149 0,44; seit E-149 0,18 (Mittel, 144 Saaten)
/** Wie weit ein Stück am Ende höchstens vom LKW liegen darf (m). */
const ABSTAND_MAX = 12; // gemessen 5,8 (E-071), nach E-106 7,2; vor E-071 27,0. Fehlalarm 0,00 %

let gemessen: Reihe;

beforeAll(async () => {
  await initPhysics();
  gemessen = await reiheMitLuft(
    { name: "gewuerfelte Haendlerfuhre", kunde: spielFuhre },
    SAATEN_LANG
  );
  /*
   * DER STAND WIRD IMMER GEDRUCKT, nicht nur im Fehlerfall (E-109). Seit
   * Mittel und Höchstwert nicht mehr urteilen, wären sie sonst unsichtbar —
   * und eine Zahl, die niemand mehr sieht, wandert unbemerkt.
   */
  console.log(
    `[Kipper ${SAATEN_LANG.length} Saaten] Median ${gemessen.median.toFixed(0)}  ` +
      `Mittel ${gemessen.mittel.toFixed(0)}  Hoechst ${gemessen.hoechst.toFixed(0)} km/h  |  ` +
      `durch ${(gemessen.durch * 100).toFixed(0)} %  liegt ${(gemessen.rest * 100).toFixed(0)} %  ` +
      `Endabstand ${gemessen.abstandMittel.toFixed(1)}/${gemessen.abstandMax.toFixed(1)} m  |  ` +
      `${gemessen.teile.toFixed(1)} Stk  ${gemessen.masseKg.toFixed(0)} kg`
  );
}, 900000);

/* ------------------------------------------------------------------ *
 *  Die Urteile als reine Funktionen — damit die Gegenprobe DENSELBEN
 *  Prüfcode auf einen kaputten Eingang werfen kann und nicht eine
 *  zweite, ähnlich aussehende Abschrift davon.
 * ------------------------------------------------------------------ */
export const urteile = {
  faelltNichtDurch: (r: Reihe): boolean => r.durch <= DURCH_MAX,
  /*
   * NUR NOCH DER MEDIAN (E-109). Mittel und Höchstwert sind Ausreisserzahlen;
   * die Begründung mit den gemessenen Fehlalarmquoten steht im Kopf der Datei.
   */
  schleudertNicht: (r: Reihe): boolean => r.median < MEDIAN_MAX,
  bleibtInDerNaehe: (r: Reihe): boolean => r.abstandMax < ABSTAND_MAX,
  brueckeWirdFrei: (r: Reihe): boolean => r.rest <= LIEGT_MAX,
};

/** Alle vier zusammen — das Gesamturteil über eine Reihe. */
export const allesInOrdnung = (r: Reihe): boolean =>
  urteile.faelltNichtDurch(r) &&
  urteile.schleudertNicht(r) &&
  urteile.bleibtInDerNaehe(r) &&
  urteile.brueckeWirdFrei(r);

/** Eine Reihe von Hand, um die Urteile gegen einen kaputten Eingang zu halten. */
function erfundeneReihe(x: Partial<Reihe>): Reihe {
  return {
    name: "erfunden",
    mittel: 29,
    hoechst: 106,
    median: 19,
    werte: [29],
    teile: 11,
    masseKg: 8479,
    fuellgrad: 0.7,
    rest: 0.18, // seit E-149 (vorher 0,31 aus E-071)
    durch: 0,
    durchFrueh: 0,
    abstandMax: 5.8,
    abstandMittel: 3.1,
    inDerMulde: 0,
    ...x,
  };
}

describe("Kipper", () => {
  it("laesst die Fuhre nicht durch die Bruecke fallen", () => {
    expect(gemessen.teile, "keine Ladung auf der Flaeche").toBeGreaterThanOrEqual(5);
    expect(
      urteile.faelltNichtDurch(gemessen),
      `${(gemessen.durch * 100).toFixed(0)} % der Fuhre geraten beim Kippen unter die Bruecke ` +
        `(erlaubt ${(DURCH_MAX * 100).toFixed(0)} %)`
    ).toBe(true);
  });

  it("GEGENPROBE: koerperlose Bruecke wird gemeldet", () => {
    /*
     * Nicht erfunden, sondern gefahren: Dieselben Fuhren, aber die Kollider
     * der Mulde werden beim Halt abgeschaltet. Dann MUSS die Fuhre unten
     * durch — und der Prüfcode muss das sagen. Drei Saaten reichen; der
     * Unterschied ist kein Randfall, sondern 0 gegen rund 90 %.
     */
    const kaputt = reihe(
      { name: "Bruecke koerperlos", kunde: spielFuhre, brueckeAbschalten: true },
      SAATEN.slice(0, 3)
    );
    expect(kaputt.durch, "die abgeschaltete Bruecke haelt die Fuhre trotzdem?").toBeGreaterThan(0.5);
    expect(urteile.faelltNichtDurch(kaputt), "Pruefcode meldet den Durchfall nicht").toBe(false);
  }, 300000);

  it("schleudert die Ladung nicht davon", () => {
    const liste = gemessen.werte.map((w) => w.toFixed(0)).join(" ");
    expect(
      urteile.schleudertNicht(gemessen),
      `Median ${gemessen.median.toFixed(0)} km/h ueber ${SAATEN_LANG.length} Ladungen ` +
        `(erlaubt ${MEDIAN_MAX}). Nur zur Kenntnis, NICHT geurteilt: Mittel ` +
        `${gemessen.mittel.toFixed(0)} (Marke ${MITTEL_BERICHT}), Hoechst ` +
        `${gemessen.hoechst.toFixed(0)} (Marke ${HOECHST_BERICHT}) — beide sind ` +
        `Ausreisserzahlen, siehe Kopf der Datei. Reihe: ${liste}`
    ).toBe(true);
  });

  it("GEGENPROBE: zu schnelle Reihen werden gemeldet", () => {
    expect(urteile.schleudertNicht(erfundeneReihe({ median: MEDIAN_MAX + 1 }))).toBe(false);
    // und der gemessene Stand darf davon NICHT getroffen werden
    expect(urteile.schleudertNicht(erfundeneReihe({}))).toBe(true);
  });

  it("GEGENPROBE: ein einzelnes Stueck, das wegfliegt, faellt trotzdem auf", () => {
    /*
     * DIE FRAGE ZU E-109: Wenn der Höchstwert aus dem Urteil fliegt — merkt
     * dann noch jemand, dass ein Kühler im Kabellager liegt?
     *
     * Ja, und zwar an der Zahl, die Patrick sieht. Eine Reihe, in der EIN
     * Stück wegfliegt, sieht so aus wie der Stand vor E-071: Median und Mittel
     * unauffällig, ein Tempowert von 585 km/h, und das Stück liegt am Ende
     * 27,0 m vom Lkw. Das Gesamturteil muss rot werden.
     */
    const eineFliegt = erfundeneReihe({
      werte: [19, 18, 21, 585],
      hoechst: 585,
      abstandMax: 27.0,
    });
    expect(allesInOrdnung(eineFliegt), "wegfliegendes Stueck durchgewinkt").toBe(false);
    expect(urteile.bleibtInDerNaehe(eineFliegt), "der Endabstand meldet es nicht").toBe(false);
    /*
     * GEGENPROBE ZUR GEGENPROBE: Derselbe Tempo-Ausreisser OHNE Ortswechsel —
     * das ist der gemessene Fall aus E-105 („Rad mit Alufelge", ein Bild lang
     * schnell, im nächsten von `clampSpeeds` wieder eingesammelt). Der darf
     * NICHT rot werden, sonst ist der alte Zufallswächter nur umbenannt.
     */
    expect(allesInOrdnung(erfundeneReihe({ hoechst: 585 }))).toBe(true);
  });

  it("laesst die Fuhre in der Naehe des LKW liegen", () => {
    /*
     * Die Zahl, die Patrick tatsächlich erlebt. Er sieht keine km/h — er
     * findet einen Kühler im Kabellager. 430 km/h sind 119 m/s; der Platz ist
     * rund 70 m lang, ein Stück ist damit in einer halben Sekunde am anderen
     * Ende. Vor E-071 lagen 8 von 265 Stücken über 10 m vom LKW entfernt, das
     * weiteste 27,0 m. Jetzt keines.
     */
    expect(
      urteile.bleibtInDerNaehe(gemessen),
      `weitestes Stueck ${gemessen.abstandMax.toFixed(1)} m vom LKW ` +
        `(Mittel ${gemessen.abstandMittel.toFixed(1)} m, erlaubt ${ABSTAND_MAX} m)`
    ).toBe(true);
  });

  it("GEGENPROBE: weit verstreute Fuhren werden gemeldet", () => {
    expect(urteile.bleibtInDerNaehe(erfundeneReihe({ abstandMax: 27 })), "27 m durchgewinkt").toBe(
      false
    );
    expect(urteile.bleibtInDerNaehe(erfundeneReihe({}))).toBe(true);
  });

  it("hat die Bruecke am Ende des Zyklus weitgehend frei", () => {
    expect(
      urteile.brueckeWirdFrei(gemessen),
      `${(gemessen.rest * 100).toFixed(0)} % liegen am Ende noch auf der Bruecke ` +
        `(erlaubt ${(LIEGT_MAX * 100).toFixed(0)} %)`
    ).toBe(true);
  });

  it("GEGENPROBE: eine volle Bruecke wird gemeldet", () => {
    expect(urteile.brueckeWirdFrei(erfundeneReihe({ rest: 0.6 })), "60 % durchgewinkt").toBe(false);
    // Der Stand vor E-149 — fast die halbe Fuhre fuhr wieder vom Hof
    expect(urteile.brueckeWirdFrei(erfundeneReihe({ rest: 0.44 })), "Stand vor E-149 durchgewinkt").toBe(false);
    expect(urteile.brueckeWirdFrei(erfundeneReihe({}))).toBe(true);
  });

  it("kippt sortenrein in die Mulde an der Ostwand statt vor dem Bagger", () => {
    /*
     * Ansage 13.09.2026: „sortenreine Kipper sollen direkt in den Mulden auf
     * der Ostseite rechts kippen, nicht bei mir."
     *
     * Geprueft wird das Ergebnis, nicht der Weg: Der Grossteil der Fuhre muss
     * in der Mulde liegen. Daran haengt die Tiefe der Mulden — mit den alten
     * 4,4 m landete gemessen nur ein Drittel darin, der Rest davor.
     *
     * Feste Pruefladung statt gewuerfelter: Hier geht es um die ROUTE, und die
     * haengt an der Fraktion. Der Fuellgrad 0,85 ist der, mit dem ein Haendler
     * am haeufigsten kommt; 5.000 kg Alu wuerden gar nicht auf den Wagen
     * passen (E-062).
     */
    const r = reihe(
      {
        name: "sortenrein Alu",
        kunde: () =>
          pruefKunde({ fuellgrad: 0.85, sortenrein: "alu", vehicle: "kipper", aufbau: "flach" }),
        /*
         * MIT DEM SILO, nicht nur mit seinem Grundriss (E-149). Ohne Wände
         * zählte, was noch auf der gekippten Brücke über dem Silo lag, als
         * „in der Mulde" — gemessen bis zu 63 % einer Fuhre. Wurde die
         * Brücke frei, rutschte die Fuhre durch den Raum, in dem die
         * Rückwand steht, und lag dahinter (43 %). Dieselbe Lehre wie bei
         * Lambert (E-109): „in die Mulde" prüft man mit einer Mulde.
         */
        mitMulden: true,
      },
      SAATEN.slice(0, 4)
    );
    expect(r.teile, "keine Ladung").toBeGreaterThan(6);
    expect(
      r.inDerMulde,
      `nur ${(r.inDerMulde * 100).toFixed(0)} % liegen in der Mulde`
    ).toBeGreaterThan(0.6);
  }, 300000);
});
