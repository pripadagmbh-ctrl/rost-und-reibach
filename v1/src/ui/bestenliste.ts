/**
 * DIE ANSICHT BESTENLISTE (E-195) — aus dem Hauptmenü und dem Pausenmenü.
 *
 * Deckt das Spiel ganz ab wie das Pausenmenü, „Zurück" oben links (44 px).
 * Zwei Stufen, damit nichts scrollen muss (iPhone mini quer, 375 px):
 *  - Übersicht: je Aufgabe eine Karte mit dem besten Lauf, darunter die
 *    Sandkasten-Rekorde.
 *  - Tipp auf eine Karte: die besten 5 dieser Aufgabe mit Messwerten und Datum.
 *    „Zurück" führt zur Übersicht, dort schließt es.
 *
 * Schreibt selbst in der gewählten Sprache (`translate="no"`), liest nur die
 * Ablage (`core/bestenliste.ts`), rechnet nichts.
 */
import { CHALLENGES } from "../challenges/katalog";
import { sprache, waehle, type Sprache } from "../challenges/texte";
import { leseBestenliste, REKORD_IDS, type Ablage, type Lauf, type Messwert, type RekordId } from "../core/bestenliste";
import { QUOTE_AB_KG } from "../core/rekorde";
import { KRITERIEN, MESSGROESSEN, uhr, uhrGenau, wort, type Wort } from "./aufgabentexte";
import { SCHICHTSTUFEN, type Schichtstufe } from "../economy/kasse";
import { euro, schichtWort, stufenName, tonnenZahl } from "./schichttexte";

const sterne = (n: number): string => "★".repeat(n) + "☆".repeat(3 - n);

/** Datum lokal, in der gewählten Sprache. */
export function datumText(iso: string, s: Sprache): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "–" : d.toLocaleDateString(s === "de" ? "de-DE" : "en-GB");
}

/** „★★★ 1:23,45" — die Kurzform eines Laufs. */
export function laufKurz(l: Lauf | undefined, s: Sprache): string {
  return l ? `${sterne(l.sterne)} ${uhrGenau(l.zeitHs, s)}` : wort("keinLauf", s);
}

/** Die Messgrößen, nach denen eine Aufgabe wertet (ohne Zeit) — die Spalten der Tabelle. */
export function spalten(id: string): Messwert[] {
  const c = CHALLENGES.find((x) => x.id === id);
  if (!c) return [];
  const w = { ...c.wertung.zwei, ...c.wertung.drei };
  return MESSGROESSEN.filter((k): k is Messwert => k !== "zeitS" && w[k] !== undefined);
}

/** Tabelle einer Aufgabe: Kopf und je Lauf eine Zeile Text — ohne DOM, prüfbar. */
export function detailTabelle(id: string, d: Ablage, s: Sprache): { kopf: string[]; zeilen: string[][] } {
  const sp = spalten(id);
  const kopf = [wort("spaltePlatz", s), wort("spalteSterne", s), waehle(KRITERIEN.zeitS.name, s), ...sp.map((k) => waehle(KRITERIEN[k].name, s)), wort("spalteDatum", s)];
  const zeilen = (d.aufgaben[id] ?? []).map((l, i) => [
    `${i + 1}.`,
    sterne(l.sterne),
    uhrGenau(l.zeitHs, s),
    ...sp.map((k) => {
      const v = l.werte[k];
      return v === null || v === undefined ? "–" : KRITERIEN[k].zahl(v);
    }),
    datumText(l.datum, s),
  ]);
  return { kopf, zeilen };
}

/** E-205: Kalendertag „JJJJ-MM-TT" (Ortszeit, `schichtLauf`) — ohne `new Date(…)`, das UTC lesen würde. */
export function tagText(tag: string, s: Sprache): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tag);
  if (!m) return "–";
  return s === "de" ? `${m[3]}.${m[2]}.${m[1]}` : `${m[3]}/${m[2]}/${m[1]}`;
}

/** E-205: Karte einer Schichtstufe in der Übersicht — eine Zeile: „MONTAG 5.240 €". */
export function schichtKarte(st: Schichtstufe, d: Ablage, s: Sprache): string {
  const best = d.schichten[st]?.[0];
  return `${stufenName(st, s).toUpperCase()} ${best ? euro(best.verdienstEur, s) : "–"}`;
}

/** E-205: die besten 5 einer Schichtstufe — Kopf und Zeilen als Text, ohne DOM. */
export function schichtTabelle(st: Schichtstufe, d: Ablage, s: Sprache): { kopf: string[]; zeilen: string[][] } {
  const kopf = [
    wort("spaltePlatz", s),
    wort("spalteSterne", s),
    schichtWort("spalteVerdienst", s),
    schichtWort("spalteTonnen", s),
    schichtWort("spalteQuote", s),
    schichtWort("spalteWarte", s),
    wort("spalteDatum", s),
  ];
  const zeilen = (d.schichten[st] ?? []).map((l, i) => [
    `${i + 1}.`,
    sterne(l.sterne),
    euro(l.verdienstEur, s),
    `${tonnenZahl(l.tonnen, s)} t`,
    `${Math.round(l.quoteBp / 100)} %`,
    uhr(l.warteS),
    tagText(l.datum, s),
  ]);
  return { kopf, zeilen };
}

const REKORD_WORT: Record<RekordId, Wort> = { sortiertKg: "rekordSortiert", quoteBp: "rekordQuote", ausweidenHs: "rekordWrack" };

/** Name, Wert und Datum je Sandkasten-Rekord. */
export function rekordZeilen(d: Ablage, s: Sprache): Array<{ name: string; wert: string; datum: string }> {
  const komma = (x: string): string => (s === "de" ? x.replace(".", ",") : x);
  return REKORD_IDS.map((id) => {
    const r = d.sandkasten[id];
    const name = wort(REKORD_WORT[id], s).replace("{t}", komma(String(QUOTE_AB_KG / 1000)));
    if (!r) return { name, wert: "–", datum: "" };
    const wert =
      id === "sortiertKg" ? `${komma((r.wert / 1000).toFixed(1))} t` : id === "quoteBp" ? `${komma((r.wert / 100).toFixed(1))} %` : uhrGenau(r.wert, s);
    return { name, wert, datum: datumText(r.datum, s) };
  });
}

/* ------------------------------------------------------------------------ */

const el = (tag: string, klasse?: string, text?: string): HTMLElement => {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text !== undefined) e.textContent = text;
  return e;
};

let offenAufgabe: string | null = null;
/** E-205: offene Schichtstufe (Detail), sonst null */
let offenSchicht: Schichtstufe | null = null;

function tabelle(t: { kopf: string[]; zeilen: string[][] }): HTMLElement {
  const tab = el("table");
  const kopf = el("tr");
  for (const k of t.kopf) kopf.append(el("th", undefined, k));
  tab.append(kopf);
  for (const z of t.zeilen) {
    const tr = el("tr");
    for (const c of z) tr.append(el("td", undefined, c));
    tab.append(tr);
  }
  return tab;
}

function zeichne(): void {
  const s = sprache();
  const d = leseBestenliste();
  const inhalt = document.getElementById("bl-inhalt")!;
  const titel = document.getElementById("bl-titel")!;
  document.getElementById("bl-zurueck")!.textContent = `← ${wort("zurueck", s)}`;
  inhalt.replaceChildren();
  if (offenSchicht) {
    titel.textContent = `${schichtWort("schicht", s)} · ${stufenName(offenSchicht, s).toUpperCase()}`;
    const t = schichtTabelle(offenSchicht, d, s);
    inhalt.append(t.zeilen.length ? tabelle(t) : el("p", "bl-leer", wort("keinLauf", s)));
    return;
  }
  if (offenAufgabe) {
    const i = CHALLENGES.findIndex((c) => c.id === offenAufgabe);
    titel.textContent = `${wort("aufgabe", s)} ${i + 1} · ${waehle(CHALLENGES[i]!.name, s)}`;
    const t = detailTabelle(offenAufgabe, d, s);
    if (t.zeilen.length === 0) {
      inhalt.append(el("p", "bl-leer", wort("keinLauf", s)));
      return;
    }
    const tab = el("table");
    const kopf = el("tr");
    for (const k of t.kopf) kopf.append(el("th", undefined, k));
    tab.append(kopf);
    for (const z of t.zeilen) {
      const tr = el("tr");
      for (const c of z) tr.append(el("td", undefined, c));
      tab.append(tr);
    }
    inhalt.append(tab);
    return;
  }
  titel.textContent = wort("bestenliste", s);
  const karten = el("div", "bl-karten");
  CHALLENGES.forEach((c, i) => {
    const b = el("button", "bl-karte", `${i + 1} · ${waehle(c.name, s)}`);
    b.append(el("small", undefined, laufKurz(d.aufgaben[c.id]?.[0], s)));
    b.addEventListener("click", () => {
      offenAufgabe = c.id;
      zeichne();
    });
    karten.append(b);
  });
  const rekorde = el("div", "bl-rekorde");
  for (const r of rekordZeilen(d, s)) {
    const k = el("div", "bl-rekord");
    k.append(el("span", "name", r.name)); // E-205: eigener Kasten, damit Wert und Datum auf dem Telefon quer in eine Zeile dürfen
    k.append(el("b", undefined, r.wert), el("small", undefined, r.datum));
    rekorde.append(k);
  }
  // E-205: SCHICHTEN — eine Reihe, die Überschrift steht als erste Zelle darin (kein Scrollen auf dem iPhone mini quer)
  const schichten = el("div", "bl-schichten");
  schichten.append(el("h3", undefined, schichtWort("schichten", s)));
  for (const st of SCHICHTSTUFEN) {
    const b = el("button", "bl-karte", schichtKarte(st, d, s));
    b.addEventListener("click", () => {
      offenSchicht = st;
      zeichne();
    });
    schichten.append(b);
  }
  inhalt.append(karten, schichten, el("h3", undefined, wort("sandkastenRekorde", s)), rekorde);
}

export function oeffneBestenliste(): void {
  offenAufgabe = null;
  offenSchicht = null;
  zeichne();
  document.getElementById("bestenliste")?.classList.add("open");
}

function zurueck(): void {
  if (offenAufgabe || offenSchicht) {
    offenAufgabe = null;
    offenSchicht = null;
    zeichne();
  } else document.getElementById("bestenliste")?.classList.remove("open");
}

let installiert = false;
/** Knöpfe in Haupt- und Pausenmenü anschließen. Mehrfach rufbar. */
export function installBestenliste(): void {
  if (installiert || typeof document === "undefined") return;
  installiert = true;
  document.getElementById("bl-zurueck")?.addEventListener("click", zurueck);
  for (const id of ["pause-bestenliste", "hm-bestenliste"]) {
    document.getElementById(id)?.addEventListener("click", oeffneBestenliste);
  }
  // ESC schließt auch das Pausenmenü (main.ts) — dann geht beides zu, nichts bleibt verdeckt
  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape") document.getElementById("bestenliste")?.classList.remove("open");
  });
}
