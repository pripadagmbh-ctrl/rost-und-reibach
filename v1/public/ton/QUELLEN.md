# Tonquellen (E-130)

Alle Dateien in diesem Ordner sind **Ausschnitte** aus den unten genannten Aufnahmen,
geschnitten, gefiltert und gemischt mit `tools/tonwerk/` (Rezepte: `tools/tonwerk/rezepte.mjs`).
Format (E-159): Einzelklänge AAC in M4A, 64 kbit/s, mono; Schleifen WAV, 16 bit, mono. Abtastrate 24000 Hz, wo in der Tabelle nicht anders angegeben. Die Rohdateien liegen nicht im Repository (`v1/ton-roh/`, siehe .gitignore).

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
| S | BigSoundBank #2358, #2359, #2360 (Metal barrier: Closure #1–#3, grosse Metallschranke schlaegt zu) und #1774 (Falling sheet steel bar #4) | https://bigsoundbank.com/grinding-metal-barrier-closure-1-s2358.html · https://bigsoundbank.com/grinding-metal-barrier-closure-2-s2359.html · https://bigsoundbank.com/grinding-metal-barrier-closure-3-s2360.html · https://bigsoundbank.com/falling-sheet-steel-bar-4-s1774.html | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| T | BigSoundBank #0971 Car door #1 (Peugeot 107, mehrere Schlaege) und #1524 Car door 3 | https://bigsoundbank.com/car-door-1-s0971.html · https://bigsoundbank.com/car-door-3-s1524.html | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| U | OpenGameArt, rubberduck: 75 CC0 breaking / falling / hit sfx | https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| J | BigSoundBank #2721 Truck Horn (LKW-Drucklufthupe) | https://bigsoundbank.com/truck-horn-s2721.html | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| K | BigSoundBank #1269 Industrial Doorbell #1 (elektrische Werksklingel) | https://bigsoundbank.com/industrial-doorbell-s1269.html | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| L | BigSoundBank #3260 National alert signal, end (Sirene, Entwarnung) | https://bigsoundbank.com/national-alert-signal-end-s3260.html | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

## Ausschnitte

| Datei | Dauer | Wofür | Herausgeschnitten aus |
|---|---|---|---|
| hyd_fahrt.wav | 2.50 s, 16 kHz | Schalen und Arm fahren: Öl strömt (Schleife) | D/0914.ogg ab 63.00 s, 3.00 s |
| hyd_druck.wav | 2.50 s, 16 kHz | Zudrücken: Greifkran-Hydraulik unter Last, höher mit der Kraft (Schleife) | H/freesound_community-grua-recicladora-48744.mp3 ab 13.00 s, 3.00 s |
| ventil.wav | 1.50 s | Druckbegrenzungsventil und Loslassen: Zischen (Schleife) | D/0914.ogg ab 58.50 s, 2.00 s |
| zupacken.m4a | 0.75 s | Spinne packt zu: der Greifkran fasst Schrott | H/freesound_community-grua-recicladora-48744.mp3 ab 26.95 s, 0.75 s |
| anschlag_1.m4a | 0.37 s | Zähne treffen leer aufeinander: Stahl auf Stahl | H/freesound_community-grua-recicladora-48744.mp3 ab 25.98 s, 0.37 s; I/metal_hit_01.ogg ab 0.00 s, ganz |
| anschlag_2.m4a | 0.42 s | Zähne treffen leer aufeinander (zweite Fassung) | H/freesound_community-grua-recicladora-48744.mp3 ab 33.98 s, 0.42 s; I/metal_hit_04.ogg ab 0.00 s, ganz |
| biss_1.m4a | 0.45 s | Zudrücken beißt ins Material: Knirschen | H/freesound_community-grua-recicladora-48744.mp3 ab 141.60 s, 0.45 s; U/x/bfh1_metal_hit_04.ogg ab 0.00 s, ganz |
| biss_2.m4a | 0.42 s | Zudrücken beißt ins Material (zweite Fassung) | H/freesound_community-grua-recicladora-48744.mp3 ab 142.70 s, 0.42 s; U/x/bfh1_metal_hit_05.ogg ab 0.00 s, ganz |
| biss_3.m4a | 0.49 s | Zudrücken beißt ins Material (dritte Fassung) | H/freesound_community-grua-recicladora-48744.mp3 ab 143.80 s, 0.45 s; U/x/bfh1_metal_hit_02.ogg ab 0.00 s, ganz |
| knautsch_1.m4a | 2.19 s | Blech wird zerdrückt (Presse, Auto fällt, Quetschen): Karosserie + Schranke + Blech + Knirschen | T/0971.ogg ab 0.27 s, 0.70 s; S/2360.ogg ab 0.08 s, 2.20 s; I/metal_sheet_03.ogg ab 0.00 s, ganz; I/metal_sheet_05.ogg ab 0.00 s, ganz; H/freesound_community-grua-recicladora-48744.mp3 ab 141.50 s, 2.00 s |
| knautsch_2.m4a | 1.74 s | Blech wird zerdrückt (zweite Fassung) | T/0971.ogg ab 4.37 s, 0.70 s; S/2359.ogg ab 0.93 s, 1.90 s; I/metal_sheet_06.ogg ab 0.00 s, ganz; H/freesound_community-grua-recicladora-48744.mp3 ab 143.00 s, 1.60 s |
| glas_1.m4a | 1.60 s | Scheibe birst | F/0148.ogg ab 0.00 s, 1.60 s |
| glas_2.m4a | 0.80 s | Scheibe birst (Scherben) | F/0771.ogg ab 1.70 s, 0.90 s |
| stahl_1.m4a | 0.63 s | Aufprall massiver Stahl | E/1771.ogg ab 0.00 s, ganz; A/impactPlate_heavy_000.ogg ab 0.00 s, ganz |
| stahl_2.m4a | 0.28 s | Aufprall massiver Stahl (2): schwerer Schlag | U/x/bfh1_metal_hit_04.ogg ab 0.00 s, ganz; U/x/bfh1_metal_hit_05.ogg ab 0.00 s, ganz |
| stahl_3.m4a | 0.86 s | Aufprall massiver Stahl (3) | E/1776.ogg ab 0.00 s, 0.90 s; A/impactMetal_heavy_000.ogg ab 0.00 s, ganz |
| stahl_4.m4a | 0.78 s | Aufprall massiver Stahl (4): Stahlstange | S/1774.ogg ab 0.00 s, 0.80 s |
| kleineisen_1.m4a | 0.86 s | Aufprall kleines Eisenteil | U/x/bfh1_metal_falling_01.ogg ab 0.00 s, ganz |
| kleineisen_2.m4a | 0.66 s | Aufprall kleines Eisenteil (2) | U/x/bfh1_metal_falling_02.ogg ab 0.00 s, ganz |
| kleineisen_3.m4a | 0.28 s | Aufprall kleines Eisenteil (3) | U/x/bfh1_metal_hit_06.ogg ab 0.00 s, ganz |
| blech_1.m4a | 0.37 s | Aufprall Blech, scheppert | I/metal_sheet_01.ogg ab 0.00 s, ganz |
| blech_2.m4a | 0.41 s | Aufprall Blech (2) | I/metal_sheet_02.ogg ab 0.00 s, ganz |
| blech_3.m4a | 0.60 s | Aufprall Blech (3) | I/metal_sheet_06.ogg ab 0.00 s, ganz |
| blech_4.m4a | 0.54 s | Aufprall Blech (4) | I/metal_sheet_03.ogg ab 0.00 s, ganz |
| va_1.m4a | 1.38 s | Aufprall Edelstahl, klingt lang | E/1776.ogg ab 0.00 s, 1.40 s |
| va_2.m4a | 1.12 s | Aufprall Edelstahl (2) | E/0235.ogg ab 0.00 s, ganz |
| alu_1.m4a | 0.27 s | Aufprall Alu, hell und trocken | U/x/bfh1_metal_falling_04.ogg ab 0.00 s, ganz |
| alu_2.m4a | 0.33 s | Aufprall Alu (2) | U/x/bfh1_metal_falling_05.ogg ab 0.00 s, ganz |
| alu_3.m4a | 0.17 s | Aufprall Alu (3) | U/x/bfh1_metal_hit_01.ogg ab 0.00 s, ganz |
| kupfer_1.m4a | 0.27 s | Aufprall Kupfer/Messing/Zink, warm | A/impactMetal_medium_000.ogg ab 0.00 s, ganz |
| kupfer_2.m4a | 0.25 s | Aufprall Kupfer (2) | A/impactMetal_medium_003.ogg ab 0.00 s, ganz |
| kabel_1.m4a | 0.56 s | Aufprall Kabelbund: dumpf, raschelt | A/impactSoft_heavy_001.ogg ab 0.00 s, ganz; A/footstep_snow_001.ogg ab 0.00 s, ganz; A/impactGeneric_light_000.ogg ab 0.00 s, ganz |
| klotz_1.m4a | 0.36 s | Aufprall Akku: Klotz ohne Klang | A/impactPunch_medium_002.ogg ab 0.00 s, ganz; A/impactWood_light_000.ogg ab 0.00 s, ganz |
| holz_1.m4a | 0.31 s | Aufprall Holz | A/impactWood_heavy_000.ogg ab 0.00 s, ganz; I/wood_hit_03.ogg ab 0.00 s, ganz |
| holz_2.m4a | 0.49 s | Aufprall Holz (2) | A/impactPlank_medium_001.ogg ab 0.00 s, ganz; A/impactWood_light_002.ogg ab 0.00 s, ganz |
| reifen_1.m4a | 0.57 s | Aufprall Reifen: weicher Plumps | A/impactSoft_heavy_002.ogg ab 0.00 s, ganz; A/impactGeneric_light_002.ogg ab 0.00 s, ganz |
| kunststoff_1.m4a | 0.14 s | Aufprall Kunststoff: hohles Klacken | A/impactGeneric_light_000.ogg ab 0.00 s, ganz |
| kunststoff_2.m4a | 0.26 s | Aufprall Kunststoff (2) | A/impactWood_light_004.ogg ab 0.00 s, ganz |
| geroell_1.m4a | 0.81 s | Aufprall Bauschutt | A/impactMining_000.ogg ab 0.00 s, ganz; A/footstep_concrete_000.ogg ab 0.00 s, ganz |
| geroell_2.m4a | 0.79 s | Aufprall Bauschutt (2) | A/impactMining_002.ogg ab 0.00 s, ganz; A/footstep_concrete_003.ogg ab 0.00 s, ganz |
| koerper_blech_1.m4a | 0.58 s | Schwerer Blechkörper schlägt auf (Auto, Tank) (1) | T/0971.ogg ab 0.27 s, 0.75 s |
| koerper_blech_2.m4a | 0.63 s | Schwerer Blechkörper schlägt auf (Auto, Tank) (2) | T/0971.ogg ab 4.37 s, 0.75 s |
| koerper_blech_3.m4a | 0.63 s | Schwerer Blechkörper schlägt auf (Auto, Tank) (3) | T/0971.ogg ab 8.40 s, 0.75 s |
| koerper_blech_4.m4a | 0.60 s | Schwerer Blechkörper schlägt auf (Auto, Tank) (4) | T/0971.ogg ab 12.63 s, 0.75 s |
| koerper_stahl_1.m4a | 2.01 s | Schweres Metall auf Stahl: dröhnt nach | S/2360.ogg ab 0.08 s, 2.20 s |
| koerper_stahl_2.m4a | 1.64 s | Schweres Metall auf Stahl (2) | S/2358.ogg ab 1.68 s, 2.00 s |
| koerper_stahl_3.m4a | 1.64 s | Schweres Metall auf Stahl (3) | S/2359.ogg ab 0.93 s, 1.90 s |
| grund_beton.m4a | 0.31 s | Untergrund Beton: trockener Klatsch | A/impactPunch_medium_000.ogg ab 0.00 s, ganz; A/footstep_concrete_001.ogg ab 0.00 s, ganz |
| grund_stahl_1.m4a | 0.48 s | Untergrund Ladefläche/Mulde: wummert | A/impactPlate_heavy_000.ogg ab 0.00 s, ganz |
| grund_stahl_2.m4a | 0.56 s | Untergrund Ladefläche/Mulde (2) | A/impactPlate_heavy_004.ogg ab 0.00 s, ganz |
| grund_schrott_1.m4a | 0.15 s | Untergrund Schrott: klappert | A/impactTin_medium_000.ogg ab 0.00 s, ganz |
| grund_schrott_2.m4a | 0.21 s | Untergrund Schrott (2) | A/impactTin_medium_003.ogg ab 0.00 s, ganz |
| kehr_beton.wav | 2.00 s | Spinne schleift über Beton: raues Schaben (Schleife) | Streuung aus A/footstep_concrete_000.ogg, A/footstep_concrete_001.ogg, A/footstep_concrete_002.ogg, A/footstep_concrete_003.ogg, A/footstep_concrete_004.ogg (95 Schläge) |
| kehr_stahl.wav | 2.00 s | Spinne schleift über Ladefläche/Mulde: Kreischen (Schleife) | D/0914.ogg ab 9.60 s, 2.50 s |
| rassel.wav | 2.00 s | Schrott rutscht und klappert; Spinne über Schrott (Schleife) | H/freesound_community-grua-recicladora-48744.mp3 ab 141.50 s, 2.50 s |
| hupe.m4a | 1.23 s, 16 kHz | LKW-Drucklufthupe: der Fahrer hupt (im Spiel einmal oder doppelt) | J/2721.ogg ab 0.00 s, 1.30 s |
| klingel.m4a | 2.08 s, 16 kHz | Elektrische Werksklingel: Feierabend (Alternative zur Sirene) | K/1269.ogg ab 0.00 s, 2.20 s |
| sirene.m4a | 4.90 s, 12 kHz | Werkssirene: Feierabend — läuft hoch, steht kurz, läuft aus | L/3260.ogg ab 0.00 s, 3.20 s; L/3260.ogg ab 33.90 s, 2.00 s |
| motor.wav | 3.00 s, 12 kHz | Dieselmotor im Stand (Schleife), Tempo folgt der Bedienung | C/2147.ogg ab 12.00 s, 3.50 s |

Kürzel in der Spalte „Herausgeschnitten aus“: `A/…` Kenney Impact Sounds, `I/…` OpenGameArt 100 CC0 metal and wood SFX, `B/`–`F/`, `J/`–`L/`, `S/`, `T/` BigSoundBank (Nummer = Dateiname), `U/…` OpenGameArt rubberduck, `H/…` Pixabay-Greifkran (Pixabay Content License: Einbau ins Spiel erlaubt, die Datei für sich allein darf nicht weitergegeben werden — deshalb liegen hier nur Ausschnitte, gemischt mit anderen Klängen).
