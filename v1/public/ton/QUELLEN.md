# Tonquellen (E-130)

Alle Dateien in diesem Ordner sind **Ausschnitte** aus den unten genannten Aufnahmen,
geschnitten, gefiltert und gemischt mit `tools/tonwerk/` (Rezepte: `tools/tonwerk/rezepte.mjs`).
Format: WAV, 16 bit, mono, 24000 Hz (wo in der Tabelle nicht anders angegeben). Die Rohdateien liegen nicht im Repository (`v1/ton-roh/`, siehe .gitignore).

## Rohquellen

| Kürzel | Aufnahme | Adresse | Lizenz |
|---|---|---|---|
| A | Kenney, Impact Sounds (1.0) | https://kenney.nl/assets/impact-sounds | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| I | OpenGameArt, 100 CC0 metal and wood SFX | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| B | BigSoundBank #2148 Excavator, use | https://bigsoundbank.com/excavator-use-s2148.html | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| C | BigSoundBank #2147 Excavator, engine | https://bigsoundbank.com/excavator-engine-s2147.html | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| D | BigSoundBank #0914 Excavator (Cranes of site) | https://bigsoundbank.com/cranes-of-site-s0914.html | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| E | BigSoundBank #1771, #1776, #0235 (Stahlstangen fallen) | https://bigsoundbank.com/falling-sheet-steel-bar-1-s1771.html · https://bigsoundbank.com/fall-2-sheet-steel-bars-1-s1776.html · https://bigsoundbank.com/iron-bar-falls-2-s0235.html | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| F | BigSoundBank #0118, #0148, #0771 (Dose zerdrückt, Glas birst, Scherben) | https://bigsoundbank.com/can-that-are-crushed-s0118.html · https://bigsoundbank.com/glass-burst-s0148.html · https://bigsoundbank.com/broken-glass-s0771.html | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| H | Pixabay „Grua recicladora“ (Schrottplatz-Greifkran), Datei freesound_community-grua-recicladora-48744.mp3, von Patrick am 16.10.2026 selbst geladen. Original auf Freesound als CC0: Fhmediahmo #191965 | https://pixabay.com/sound-effects/film-special-effects-grua-recicladora-48744/ | [Pixabay Content License — Einbau ins Spiel erlaubt, Weitergabe der Datei für sich allein nicht](https://pixabay.com/service/license-summary/) |

## Ausschnitte

| Datei | Dauer | Wofür | Herausgeschnitten aus |
|---|---|---|---|
| hyd_fahrt.wav | 2.50 s, 16 kHz | Schalen und Arm fahren: Öl strömt (Schleife) | D/0914.ogg ab 63.00 s, 3.00 s |
| hyd_druck.wav | 2.50 s, 16 kHz | Zudrücken: Greifkran-Hydraulik unter Last, höher mit der Kraft (Schleife) | H/freesound_community-grua-recicladora-48744.mp3 ab 13.00 s, 3.00 s |
| ventil.wav | 1.50 s | Druckbegrenzungsventil und Loslassen: Zischen (Schleife) | D/0914.ogg ab 58.50 s, 2.00 s |
| zupacken.wav | 0.75 s | Spinne packt zu: der Greifkran fasst Schrott | H/freesound_community-grua-recicladora-48744.mp3 ab 26.95 s, 0.75 s |
| anschlag_1.wav | 0.37 s | Zähne treffen leer aufeinander: Stahl auf Stahl | H/freesound_community-grua-recicladora-48744.mp3 ab 25.98 s, 0.37 s; I/metal_hit_01.ogg ab 0.00 s, ganz |
| anschlag_2.wav | 0.42 s | Zähne treffen leer aufeinander (zweite Fassung) | H/freesound_community-grua-recicladora-48744.mp3 ab 33.98 s, 0.42 s; I/metal_hit_04.ogg ab 0.00 s, ganz |
| biss_1.wav | 0.76 s | Zudrücken beißt ins Material: Knirschen | F/0118.ogg ab 0.38 s, 0.57 s, Tempo ×0.75; A/impactMetal_heavy_002.ogg ab 0.00 s, ganz |
| biss_2.wav | 0.66 s | Zudrücken beißt ins Material (zweite Fassung) | F/0118.ogg ab 2.50 s, 0.50 s, Tempo ×0.75; A/impactMetal_heavy_004.ogg ab 0.00 s, ganz |
| biss_3.wav | 0.73 s | Zudrücken beißt ins Material (dritte Fassung) | F/0118.ogg ab 6.35 s, 0.55 s, Tempo ×0.75; A/impactMetal_heavy_000.ogg ab 0.00 s, ganz |
| knautsch_1.wav | 3.00 s | Blech wird zerdrückt (Presse, Quetschen, Knautschen): Dose tief + Metallschläge + Metall stöhnt | F/0118.ogg ab 0.30 s, 2.70 s, Tempo ×0.6; A/impactPlate_heavy_001.ogg ab 0.00 s, ganz; A/impactMetal_heavy_001.ogg ab 0.00 s, ganz; A/impactMetal_heavy_003.ogg ab 0.00 s, ganz; H/freesound_community-grua-recicladora-48744.mp3 ab 61.30 s, 1.60 s, Tempo ×0.85 |
| knautsch_2.wav | 2.40 s | Blech wird zerdrückt (zweite Fassung) | F/0118.ogg ab 5.15 s, 1.85 s, Tempo ×0.65; A/impactPlate_heavy_004.ogg ab 0.00 s, ganz; A/impactMetal_heavy_003.ogg ab 0.00 s, ganz |
| glas_1.wav | 1.60 s | Scheibe birst | F/0148.ogg ab 0.00 s, 1.60 s |
| glas_2.wav | 0.80 s | Scheibe birst (Scherben) | F/0771.ogg ab 1.70 s, 0.90 s |
| stahl_1.wav | 0.63 s | Aufprall massiver Stahl | E/1771.ogg ab 0.00 s, ganz; A/impactPlate_heavy_000.ogg ab 0.00 s, ganz |
| stahl_2.wav | 0.49 s | Aufprall massiver Stahl (2) | A/impactMetal_heavy_003.ogg ab 0.00 s, ganz; A/impactPlate_heavy_002.ogg ab 0.00 s, ganz |
| stahl_3.wav | 1.12 s | Aufprall massiver Stahl (3) | E/1776.ogg ab 0.00 s, 0.90 s, Tempo ×0.8; A/impactMetal_heavy_000.ogg ab 0.00 s, ganz |
| blech_1.wav | 0.37 s | Aufprall Blech, scheppert | I/metal_sheet_01.ogg ab 0.00 s, ganz |
| blech_2.wav | 0.41 s | Aufprall Blech (2) | I/metal_sheet_02.ogg ab 0.00 s, ganz |
| blech_3.wav | 0.60 s | Aufprall Blech (3) | I/metal_sheet_06.ogg ab 0.00 s, ganz |
| va_1.wav | 1.38 s | Aufprall Edelstahl, klingt lang | E/1776.ogg ab 0.00 s, 1.40 s |
| va_2.wav | 1.12 s | Aufprall Edelstahl (2) | E/0235.ogg ab 0.00 s, ganz |
| alu_1.wav | 0.34 s | Aufprall Alu, hell und kurz | A/impactMetal_light_000.ogg ab 0.00 s, ganz |
| alu_2.wav | 0.23 s | Aufprall Alu (2) | A/impactMetal_light_002.ogg ab 0.00 s, ganz |
| kupfer_1.wav | 0.30 s | Aufprall Kupfer/Messing/Zink, warm | A/impactMetal_medium_000.ogg ab 0.00 s, ganz, Tempo ×0.9 |
| kupfer_2.wav | 0.28 s | Aufprall Kupfer (2) | A/impactMetal_medium_003.ogg ab 0.00 s, ganz, Tempo ×0.9 |
| kabel_1.wav | 0.56 s | Aufprall Kabelbund: dumpf, raschelt | A/impactSoft_heavy_001.ogg ab 0.00 s, ganz; A/footstep_snow_001.ogg ab 0.00 s, ganz; A/impactGeneric_light_000.ogg ab 0.00 s, ganz |
| klotz_1.wav | 0.36 s | Aufprall Akku: Klotz ohne Klang | A/impactPunch_medium_002.ogg ab 0.00 s, ganz; A/impactWood_light_000.ogg ab 0.00 s, ganz |
| holz_1.wav | 0.31 s | Aufprall Holz | A/impactWood_heavy_000.ogg ab 0.00 s, ganz; I/wood_hit_03.ogg ab 0.00 s, ganz |
| holz_2.wav | 0.49 s | Aufprall Holz (2) | A/impactPlank_medium_001.ogg ab 0.00 s, ganz; A/impactWood_light_002.ogg ab 0.00 s, ganz |
| reifen_1.wav | 0.57 s | Aufprall Reifen: weicher Plumps | A/impactSoft_heavy_002.ogg ab 0.00 s, ganz; A/impactGeneric_light_002.ogg ab 0.00 s, ganz |
| kunststoff_1.wav | 0.14 s | Aufprall Kunststoff: hohles Klacken | A/impactGeneric_light_000.ogg ab 0.00 s, ganz |
| kunststoff_2.wav | 0.20 s | Aufprall Kunststoff (2) | A/impactWood_light_004.ogg ab 0.00 s, ganz, Tempo ×1.3 |
| geroell_1.wav | 0.81 s | Aufprall Bauschutt | A/impactMining_000.ogg ab 0.00 s, ganz; A/footstep_concrete_000.ogg ab 0.00 s, ganz |
| geroell_2.wav | 0.79 s | Aufprall Bauschutt (2) | A/impactMining_002.ogg ab 0.00 s, ganz; A/footstep_concrete_003.ogg ab 0.00 s, ganz |
| grund_beton.wav | 0.31 s | Untergrund Beton: trockener Klatsch | A/impactPunch_medium_000.ogg ab 0.00 s, ganz; A/footstep_concrete_001.ogg ab 0.00 s, ganz |
| grund_stahl_1.wav | 0.48 s | Untergrund Ladefläche/Mulde: wummert | A/impactPlate_heavy_000.ogg ab 0.00 s, ganz |
| grund_stahl_2.wav | 0.56 s | Untergrund Ladefläche/Mulde (2) | A/impactPlate_heavy_004.ogg ab 0.00 s, ganz |
| grund_schrott_1.wav | 0.15 s | Untergrund Schrott: klappert | A/impactTin_medium_000.ogg ab 0.00 s, ganz |
| grund_schrott_2.wav | 0.21 s | Untergrund Schrott (2) | A/impactTin_medium_003.ogg ab 0.00 s, ganz |
| kehr_beton.wav | 2.00 s | Spinne schleift über Beton: raues Schaben (Schleife) | Streuung aus A/footstep_concrete_000.ogg, A/footstep_concrete_001.ogg, A/footstep_concrete_002.ogg, A/footstep_concrete_003.ogg, A/footstep_concrete_004.ogg (95 Schläge) |
| kehr_stahl.wav | 2.00 s | Spinne schleift über Ladefläche/Mulde: Kreischen (Schleife) | D/0914.ogg ab 9.60 s, 2.50 s; Streuung aus A/impactMetal_light_000.ogg, A/impactMetal_light_001.ogg, A/impactMetal_light_002.ogg, A/impactMetal_light_004.ogg (14 Schläge) |
| rassel.wav | 2.00 s | Schrott rutscht und klappert; Spinne über Schrott (Schleife) | Streuung aus A/impactTin_medium_000.ogg, A/impactTin_medium_001.ogg, A/impactTin_medium_002.ogg, A/impactTin_medium_003.ogg, A/impactTin_medium_004.ogg, A/impactMetal_light_000.ogg, A/impactMetal_light_001.ogg, A/impactMetal_light_004.ogg, A/impactPlate_light_000.ogg, A/impactPlate_light_002.ogg (48 Schläge) |
| motor.wav | 3.00 s, 12 kHz | Dieselmotor im Stand (Schleife), Tempo folgt der Bedienung | C/2147.ogg ab 12.00 s, 3.50 s |

Kürzel in der Spalte „Herausgeschnitten aus“: `A/…` Kenney Impact Sounds, `I/…` OpenGameArt 100 CC0 metal and wood SFX, `B/`–`F/` BigSoundBank (Nummer = Dateiname), `H/…` Pixabay-Greifkran (Pixabay Content License: Einbau ins Spiel erlaubt, die Datei für sich allein darf nicht weitergegeben werden — deshalb liegen hier nur Ausschnitte, gemischt mit anderen Klängen).
