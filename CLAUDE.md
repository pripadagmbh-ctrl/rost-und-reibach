# Rust'n'Reibach (Schrottplatz-App) — Projektregeln

Schrottplatz-Simulation mit Fuchsbagger und Greifspinne. Web-Stack: TypeScript, Vite, Three.js r169, Rapier 3D (rapier3d-compat 0.14), Vitest. Auftraggeber: Patrick — testet auf iPad und iPhone mini, programmiert nicht selbst, entscheidet alles Gestalterische.

## Ordner und was dort gilt (Stand 14.09.2026)

| Ordner | Status | Regel |
|---|---|---|
| `v1/` | **Arbeitsordner** | Hier wird gebaut. Nachfolger des Prototyps, aus `prototype/` kopiert. |
| `prototype/` | Referenz, eingefroren | **Nie ändern.** Nachschauen, wie etwas gemeint war und wie es sich anfühlte. |
| `v2/` | Archiv, eingefroren | **Nie ändern, nie darauf aufbauen.** Nur nachschlagen: `v2/docs/entscheidungen.md` enthält Rapier- und Safari-Lehren, die weiter gelten (siehe unten). |
| `docs/` | Design-Grundlage | `02_Briefing.md` (24 Kapitel) ist das GDD des Prototyps und bleibt Maßstab für Spielinhalt, Wirtschaft, Materialien. |
| `v1/docs/` | Log und Messungen | `entscheidungen.md` = **Register** (eine Zeile je Entscheidung, neueste oben, plus „Offen für Patrick“); Volltexte in `log/E-xxx_bis_E-yyy.md` (20 je Datei); `messungen/` je Gerätetest. |

Hintergrund: v2 war ein Neuaufbau in Schichten; Patrick fand den Prototyp besser gelungen (Spinne, Greifen) und arbeitet ab 14.09. in `v1/` weiter.

## Regeln

1. **`prototype/` und `v2/` werden nie angefasst.** Kopieren statt verweisen.
2. **Spielgefühl des Prototyps ist der Maßstab.** Spinne, Greifen, Pendel, Kamera bleiben, wie sie im Prototyp sind; Änderungen daran nur auf ausdrücklichen Wunsch und in kleinen, einzeln auf dem iPad abgenommenen Schritten. Kein „Saugen" gegriffener Teile in die Korbmitte (v2-Fehler).
3. **Jede Zahl hat eine Herkunft.** Neue Balancing-Werte mit Kommentar (`// SW: …` = Startwert zum Austesten, oder Verweis auf Briefing-Kapitel/Messung).
4. **Entscheidungen ins Log — zweiteilig (seit 25.09.2026):** Der **Volltext** (Nummer, Datum, Entscheidung, Begründung, verworfene Alternative, Abnahmekriterium, „Auf dem Gerät zu prüfen“) kommt **unten** an die aktuelle Archivdatei `v1/docs/log/E-xxx_bis_E-yyy.md`; dazu eine **Registerzeile oben** in `v1/docs/entscheidungen.md` (Nr. · Datum · Titel ≤ 12 Wörter · Status · Link) und die Gerätetest-Fragen in den Abschnitt „Offen für Patrick“. Vor der Arbeit wird das **Register** gelesen und nur die Volltexte, die der Auftrag nennt — nicht mehr „die letzten drei Einträge“. Nichts wird zweimal diskutiert.
5. **Kein Meilenstein ist fertig ohne Gerätetest durch Patrick.** Jede Übergabe endet mit „Auf dem Gerät zu prüfen: …".
6. **Lieber nachfragen als raten** — mit Erklärung für einen technisch interessierten Laien, mit Vergleichen. Patrick will dazulernen.
7. **Ton-Leitplanke:** Milieu aus Beruf, Familie, Geschäft — nie aus Herkunft. Keine Gruppe wird als kriminell markiert.
8. **Prüfkette vor jeder Übergabe:** `npm run build` (tsc + vite) und `npm test` (Vitest) in `v1/` grün.
9. **Windows/PowerShell:** Skripte ohne `&&`-Ketten; Node-Skripte statt Shell-Ketten.
10. **Module reden über den EventBus** (`core/events.ts`). Audio und HUD hängen nur an Events, nie direkt an Spiellogik.

## Lehren aus v2, die weiter gelten (technisch, unabhängig vom Aufbau)

- Kinematische Körper an der Startpose erzeugen, nie am Ursprung anlegen und dann versetzen (v2 E-058).
- Treffer aus Rapier-Abfragen (`intersectionsWithShape` u. ä.) erst sammeln, dann anwenden — nie im Callback schreiben (v2 E-044).
- Schub per Impuls statt `setLinvel`, mit Deckel aufs Gesamttempo (v2 E-045).
- Lose Körper nur gemeinsam schlafen legen, nie einzeln (v2 E-012); Rollkörper als Achtkant statt Zylinder (E-011); Spawn ohne Überlappung (E-010).
- Touch/Safari: `touch-action: none` überall, Kamera-Gesten nur im Mittelstreifen, Geister-Zeiger-Sicherung (kein Finger auf dem Glas → alle Sticks loslassen), Audio-Unlock auf erster Geste, `AudioContext.resume()` bei `visibilitychange`.
- Greifen auf Touch über den rechten Stick (rechts = schließen, links = öffnen mit mehr Toleranz) fand Patrick „perfekt" — als Vorbild, falls Touch in v1 kommt.

## Agenten

Unter `.claude/agents/`: `orchestrator` (Bauleiter), `bagger` (excavator/, physics/), `welt` (world/, delivery/, dismantle/, economy/), `ui` (ui/, audio/, core/ Eingabe), `qa` (test/, Doku). Alles, was mehr als einen Bereich berührt, läuft über den Orchestrator.

## Veröffentlichen

GitHub Pages, ein Workflow, drei Ziele: Root-URL = `prototype/` (unverändert), `/v2/` = Archiv, **`/v1/` = Arbeitsstand**. Live-URL für Gerätetests: `pripadagmbh-ctrl.github.io/rost-und-reibach/v1/`. Push auf `main` nur nach Patricks Freigabe.

## Starten

```
cd v1
npm install
npm run dev -- --host     # iPad/iPhone im WLAN: http://<PC-IP>:5173
npm test
npm run build
```
