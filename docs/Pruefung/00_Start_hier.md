# Prüfmappe Schrottplatz-App

**Für einen Agenten, der kalt startet und alles nachprüfen soll.**
Angelegt am 02.09.2026 von Claude (Opus 5) im Auftrag von Patrick.

Diese Mappe ist absichtlich misstrauisch aufgebaut: Sie behauptet nichts, was
nicht mit einem Befehl nachzurechnen wäre. Wo eine Zahl aus einer früheren
Sitzung stammt und ich sie **nicht** neu gemessen habe, steht das ausdrücklich
dabei. Nimm nichts davon auf Treu und Glauben.

---

## Was das Projekt ist

Ein Einzelspieler-Simulationsspiel: Schrottplatz mit Umschlagbagger. Der
Spieler nimmt Anlieferungen an, handelt den Preis aus, sortiert den Schrott
sortenrein in Mulden, presst Mischschrott und lässt abholen. Verdient wird
über **Sortenreinheit**, nicht über Menge — das ist der Kern.

Ziel ist eine Premium-Veröffentlichung im Google Play Store (einmalig ~4,99 €,
keine Werbung, keine In-App-Käufe). Entwickelt wird im Desktop-Browser, das
Handy kommt später.

**Technik:** TypeScript · Vite · Three.js r169 · Rapier3D (WASM, compat-Build).
Fester 60-Hz-Physikschritt. Kein Framework, kein Zustandsspeicher, keine
Netzwerkanbindung. Alles läuft lokal im Browser.

---

## In fünf Minuten lauffähig

```bash
cd prototype && npm install && npm run dev
```

Der Browser zeigt den Platz. Steuerung: zwei Sticks (Maus/Touch), `B` presst,
`V` ruft den Abholer, `G` öffnet den Ausbau, `H` blendet das HUD um.

**Debug-Zugang:** `window.__game` in der Browserkonsole. Wichtig ist
`__game.step(n)` — damit taktest du die Physik von Hand, ohne auf Echtzeit zu
warten. Das ist der Hebel für jede Messung.

```js
window.__game.step(60)          // eine Sekunde Spielzeit
window.__game.physics.world     // die Rapier-Welt
window.__game.vehicles.spawnNow('pkw')   // Fahrzeug erzwingen
```

---

## Die drei Prüfbefehle

```bash
cd prototype && npm test
```
Muss **97 grüne Tests in 8 Dateien** ergeben. Aufteilung siehe
`01_Behauptungen.md`.

```bash
cd prototype && npm run build
```
Läuft `tsc --noEmit` **und** den Vite-Build. Muss ohne Fehler durchlaufen und
ein Bündel von rund 2,74 MB erzeugen.

```bash
git -C . log --oneline -20
```
Die Historie ist der ehrlichste Bericht. Jede Commit-Nachricht beschreibt, was
geprüft wurde und wie.

---

## Was in dieser Mappe liegt

| Datei | Inhalt |
| --- | --- |
| `00_Start_hier.md` | dieses Dokument |
| `01_Behauptungen.md` | **jede Behauptung mit Prüfbefehl** — der eigentliche Prüfauftrag |
| `02_Schwachstellen.md` | wo ich selbst Zweifel habe, ungeschönt |
| `03_Messanleitung.md` | wie die Laufzeitwerte zustande kamen, zum Nachmessen |
| `Werkstattbericht.html` | der Bericht, den Patrick liest (im Browser öffnen) |

**Außerhalb dieser Mappe, aber zugehörig:**

| Datei | Inhalt |
| --- | --- |
| `../02_Briefing.md` | das Pflichtenheft, 1 020 Zeilen. **Kap. 27 ist der Umsetzungsstand** |
| `../10_Store_Veroeffentlichung.md` | Weg in den Play Store |
| `../01_Briefing-Prompt.md` | wie das Briefing entstanden ist |

---

## Verbindliche Leitplanke (nicht verhandelbar)

Aus dem Briefing, Kap. 26.6, wörtlich vom Auftraggeber:

> Das Milieu entsteht aus **Beruf, Familien und Geschäft** — nie aus Herkunft
> oder Ethnie. Keine Gruppe wird als kriminell markiert. Das hält den Ton
> glaubwürdig und jede Store-Prüfung sauber.

**Das ist der wichtigste Prüfpunkt der ganzen Mappe.** Das Spiel handelt vom
Schrotthandel und enthält Händlerfamilien, harte Verhandlungen und (geplant)
Ware mit unklarer Herkunft. Wenn irgendwo im Code, in Texten oder in Namen ein
Milieu an Herkunft statt an Beruf geknüpft wird, ist das ein Fehler mit
Vorrang vor allem Technischen. Prüfe besonders:

- `prototype/src/delivery/customers.ts` — Familiennamen, Ortsnamen, Sprüche
- alle Zeichenketten, die dem Spieler angezeigt werden

Die Ortsnamen für Privatleute sind echte Mönchengladbacher Stadtteile
(Eicken, Rheydt, Hardt …) — das verankert den Platz geografisch, ohne jemanden
zu markieren. Die Familiennamen sind erfunden.

---

## Wo ich mir am unsichersten bin

Kurzfassung, ausführlich in `02_Schwachstellen.md`:

1. **Physiklast auf dem Handy.** 2,78 ms pro Schritt im Desktop-Browser. Ein
   Mittelklassegerät rechnet drei- bis viermal langsamer. Nie auf echter
   Hardware gemessen. Das kann das ganze Vorhaben kippen.
2. **Nichts vom Spielgefühl ist getestet.** 97 Tests decken Rechenlogik ab.
   Ob sich der Bagger gut anfühlt, ob Lambert nützlich wirkt, ob die
   Verhandlung Spaß macht — dazu sagen die Tests nichts.
3. **`world/` ist mit 4 021 Zeilen in 12 Dateien der am wenigsten geprüfte
   Bereich.** Dort liegt der meiste Code und die wenigste Testabdeckung.
4. **Ich habe meine eigene Arbeit geprüft.** Alle Messungen unten stammen von
   mir. Eine unabhängige Gegenprobe hat es nie gegeben — deshalb diese Mappe.
