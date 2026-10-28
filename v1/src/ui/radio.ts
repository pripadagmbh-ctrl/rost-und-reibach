/**
 * Senderwahl fuers Kabinenradio.
 *
 * Bedienung wie beim Platzausbau: ein eigenes Feld, aus dem Pausenmenue
 * geoeffnet, ganzflaechige Knoepfe untereinander. Das ist der Weg, den es hier
 * schon gibt — ein Ausklappmenue oder eine Liste im Ausbaufeld waere ein
 * zweites Muster fuer dieselbe Sache, und auf dem iPad trifft der Daumen einen
 * breiten Knopf sicherer als eine Zeile in einer Liste.
 *
 * Farbe ist nie der einzige Kanal: Der laufende Sender traegt ein Zeichen und
 * das Wort dazu, nicht nur einen anderen Hintergrund.
 */
import { SENDER, findeSender, type Song } from "../audio/songs";
import { speichereRadio } from "../core/save";

/** Ein Eintrag der Senderliste, fertig zum Anzeigen. */
export interface SenderEintrag {
  id: string;
  /** Zeichen vorn: laufender Sender, gewaehlter Sender, sonst nichts */
  marke: string;
  /** Sendername und Frequenz */
  titel: string;
  /** Rechts: was dieser Sender gerade ist */
  stand: string;
  /** Kleingedruckt: wie er klingt */
  beschreibung: string;
  /** Der gewaehlte Sender ist im Menue hervorgehoben */
  gewaehlt: boolean;
}

/**
 * Die Liste, wie sie im Menue steht — ohne DOM, damit sie pruefbar bleibt.
 *
 * `an` ist der vorhandene Ein/Aus-Schalter. Er bleibt unangetastet: Ist das
 * Radio aus, laesst sich ein Sender trotzdem waehlen, er bleibt nur still.
 */
export function senderListe(aktivId: string, an: boolean): SenderEintrag[] {
  const aktiv = findeSender(aktivId).id;
  return SENDER.map((s) => {
    const gewaehlt = s.id === aktiv;
    return {
      id: s.id,
      marke: gewaehlt ? (an ? "▶" : "✓") : "·",
      titel: `${s.sender} ${s.frequenz}`,
      stand: gewaehlt ? (an ? "läuft" : "gewählt · Radio aus") : "wählen",
      beschreibung: s.beschreibung,
      gewaehlt,
    };
  });
}

/** Ansage nach einem Senderwechsel — kurz, neutral, ohne Ausrufezeichen. */
export function senderAnsage(s: Song, an: boolean): string {
  return an
    ? `${s.sender} ${s.frequenz} — ${s.beschreibung}`
    : `${s.sender} gewählt. Radio ist aus.`;
}

/**
 * Was ein Druck auf MUSIK aus dem Fuehrerhaus macht (E-094).
 *
 * Die Taste hiess seit jeher „an/aus". Mit fuenf Sendern ist das der falsche
 * Schalter: Wer im Fuehrerhaus sitzt, will umschalten, nicht abschalten — und
 * ein zweiter Knopf nur fuer die Senderwahl waere ein Kranzplatz, ueber den
 * Patrick entscheidet und nicht dieses Paket.
 *
 * Deshalb ist die Taste ein Knebelschalter mit sechs Stellungen: die fuenf
 * Sender der Reihe nach, dann aus, dann wieder von vorn. Genau so, wie man
 * frueher am Autoradio durchgedreht hat.
 *
 * Wichtig fuer das Gefuehl: Beim Ausschalten springt die Wahl auf den
 * Standardsender zurueck. Sonst waere die Stellung „aus" eine Sackgasse —
 * zweimal tippen schaltete zwischen „aus" und dem LETZTEN Sender hin und her,
 * und man kaeme nie wieder an den Anfang der Reihe.
 */
export interface Weiterschaltung {
  /** Welcher Sender danach gewaehlt ist */
  songId: string;
  /** Laeuft das Radio danach? */
  an: boolean;
  /** Was im HUD steht */
  ansage: string;
}

export function naechsterSender(aktivId: string, an: boolean): Weiterschaltung {
  const aktiv = findeSender(aktivId);
  // Aus dem Stillstand heraus: erst einschalten, und zwar mit dem Sender, der
  // gewaehlt ist. Ein Tipp soll Musik machen, nicht umschalten.
  if (!an) return { songId: aktiv.id, an: true, ansage: senderAnsage(aktiv, true) };
  const i = SENDER.findIndex((s) => s.id === aktiv.id);
  const naechster = SENDER[i + 1];
  if (naechster) return { songId: naechster.id, an: true, ansage: senderAnsage(naechster, true) };
  return { songId: SENDER[0]!.id, an: false, ansage: "Radio aus." };
}

/**
 * Weiterschalten und die Wahl im Spielstand nachtragen. Liefert die Ansage
 * fuers HUD — hier wird nichts angezeigt, das macht der Aufrufer.
 */
export function radioWeiter(ton: RadioTon): string {
  const s = naechsterSender(ton.songId, ton.musicOn);
  if (!s.an) {
    // Erst still, dann umstellen: ein Senderwechsel im laufenden Betrieb
    // blendet ueber, und das waere hier ein halber Takt Musik vor der Stille.
    if (ton.musicOn) ton.toggleMusic();
    if (s.songId !== ton.songId) ton.setSong(s.songId);
  } else {
    if (s.songId !== ton.songId) ton.setSong(s.songId);
    if (!ton.musicOn) ton.toggleMusic();
  }
  speichereRadio({ songId: s.songId });
  return s.ansage;
}

/** Was das Menue vom Ton braucht — mehr nicht. */
export interface RadioTon {
  readonly musicOn: boolean;
  readonly songId: string;
  toggleMusic(): boolean;
  setSong(id: string): boolean;
}

export interface RadioMenue {
  audio: RadioTon;
  /**
   * P4b (Auftrag 41f: keine Textboxen): wird nicht mehr gelesen — die Liste
   * markiert den laufenden Sender, der Schalter zeigt seinen Zustand.
   * Entfaellt, sobald main.ts es nicht mehr uebergibt.
   */
  toast?: (text: string) => void;
  /** Pause verlassen, bevor das Feld aufgeht — wie beim Platzausbau */
  verlassePause: () => void;
  /** Sender aus dem Spielstand; fehlt er, bleibt es beim Standard */
  gewaehlt?: string;
}

/**
 * Menue anhaengen. Liefert die Oeffnen-Funktion, falls sie noch woanders
 * gebraucht wird (Taste, Funktionskranz).
 */
export function installRadio(m: RadioMenue): () => void {
  if (m.gewaehlt) m.audio.setSong(m.gewaehlt);

  const feld = document.getElementById("radio");
  const liste = document.getElementById("radio-list");
  const info = document.getElementById("radio-info");
  const schalter = document.getElementById("radio-power");
  const zurueck = document.getElementById("radio-close");
  const knopf = document.getElementById("pause-radio");
  // Ohne Markup passiert nichts — das Spiel laeuft weiter, nur ohne Senderwahl
  if (!feld || !liste || !info || !schalter || !zurueck) return () => {};

  const zeichne = (): void => {
    const an = m.audio.musicOn;
    // Die Zahl kommt aus der Liste, nicht aus dem Text: Ein neuer Sender soll
    // nicht an zwei Stellen nachgetragen werden muessen.
    info.textContent = an
      ? `${SENDER.length} Sender, alle selbst gespielt. MUSIK schaltet weiter.`
      : "Radio ist aus — der gewählte Sender bleibt still.";
    schalter.textContent = an ? "Radio ausschalten" : "Radio einschalten";
    liste.innerHTML = "";
    for (const e of senderListe(m.audio.songId, an)) {
      const b = document.createElement("button");
      b.className = e.gewaehlt ? "laeuft" : "";
      b.innerHTML =
        `${e.marke} ${e.titel}<span class="stand">${e.stand}</span>` +
        `<small>${e.beschreibung}</small>`;
      b.addEventListener("click", () => {
        if (m.audio.setSong(e.id)) {
          // Sofort in den vorhandenen Stand nachtragen, damit die Wahl auch
          // ohne ausdrueckliches Speichern einen Neustart uebersteht
          speichereRadio({ songId: e.id });
        }
        zeichne();
      });
      liste.appendChild(b);
    }
  };

  schalter.addEventListener("click", () => {
    m.audio.toggleMusic();
    zeichne();
  });
  zurueck.addEventListener("click", () => feld.classList.remove("open"));

  const oeffne = (): void => {
    zeichne();
    feld.classList.add("open");
  };
  knopf?.addEventListener("click", () => {
    m.verlassePause();
    oeffne();
  });
  return oeffne;
}
