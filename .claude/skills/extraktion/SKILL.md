---
name: extraktion
description: Hausstil für die Extraktion in ZollPilot (Python, extraktion/) - die Schichten Lesen, Klassifikation, Felder, Akte; die Form einer Assertion; was die Extraktion nie tut; wie ein Belegtyp dazukommt; wie Tests, OCR und Bewertung laufen. Nutze diesen Skill immer, wenn unter extraktion/ oder testdaten/erzeuge-belege.py etwas geändert wird, wenn ein Belegtyp oder Feld extrahiert werden soll, wenn Konfidenz, OCR, Tesseract, PDF oder Golden Set vorkommen, und bei jeder Frage, ob etwas in die Extraktion oder ins Regelwerk gehört.
---

# Extraktion

## Die Grenze

**Die Extraktion behauptet, das Regelwerk entscheidet** (ADR-003, ADR-005).
`extraktion/` liefert Assertions: Dokument, Pfad, Wert, Rohwert, Konfidenz,
Seite, Bounding Box, Methode. Es setzt keinen Fakt, kennt keinen Katalog,
keine Schwelle, keine Regel. Die Probe: *Könnte diese Zeile eine Akte
freigeben oder blockieren?* Wenn ja, gehört sie nach `src/`.

Was hier nicht fehlen darf: `nicht_pruefbar` entsteht, weil ein Feld fehlt —
nie, weil ein Feld erraten wurde. Lieber None als ein plausibler Wert.

## Die Schichten

| Datei | Tut | Ersetzt man für |
|---|---|---|
| `lesen.py` | PDF → Seiten mit Wörtern (Text, Koordinaten, Konfidenz). Textlayer, sonst Tesseract. | einen anderen OCR-Anbieter |
| `klassifikation.py` | Text → Belegtyp, Draft/Final. Unbekanntes bleibt `unclassified`. | ein Klassifikationsmodell |
| `felder/<typ>.py` | Wörter → Assertions je Belegtyp, labelgetrieben, Tabellen über Spaltenpositionen | einen trainierten Extraktor |
| `normalisierung.py` | Beträge, Daten, Länder, Codes — Gegenstück zu `src/normalisierung.mjs` | — |
| `akte.py` | Dateien → `dokumente[]` + `assertions[]`, IDs `INV-1`, `PL-1`, `BL-1`, `UE-1` | — |
| `dienst.py` | HTTP für n8n (`/extraktion/akte`, JSON mit Base64) und Menschen (`/multipart`) | — |
| `bewertung.py` | Field Exact Match je Belegtyp und Entscheidung je Akte gegen `basislinie.json` | — |

Alle Feldextraktoren arbeiten auf Wörtern mit Koordinaten (`felder/gemeinsam.py`),
nie auf reinem Text. Deshalb läuft derselbe Code auf Textlayer und OCR.

## Die Assertion

```json
{"dokument": "PL-1", "pfad": "packliste.container_id", "wert": "MSKU1234565",
 "roh": "MSKU1234565", "konfidenz": 0.99, "seite": 1, "bbox": [x0, top, x1, bottom],
 "methode": "textlayer"}
```

- `konfidenz` ist das **Minimum über die Wörter** des Feldes. Textlayer: 0,99
  (Konstante, mit Grund in `lesen.py`). OCR: Tesseract-Wortkonfidenz. Nie 1,0.
- `methode` ist `textlayer`, `ocr` oder `abgeleitet`. Eine Ableitung (Summe,
  Warenkreis) trägt `herleitung` und die Konfidenz ihrer Quellen.
- Pfade sind die aus dem Skill `zoll-domain`. Ein neuer Pfad braucht einen
  Eintrag in `zustaendigkeiten.yaml`, sonst landet die Nachforderung falsch.

## Ein Belegtyp kommt dazu

1. Typ in `pflichtmatrix.yaml` als `required_evidence` einordnen (Skill `zoll-domain`).
2. Merkmale in `klassifikation.py`, Präfix in `akte.py` (`PRAEFIX`).
3. `felder/<typ>.py` mit `extrahiere_<typ>(beleg, dokument_id)`; ins Register `felder/__init__.py`.
4. Rendern in `testdaten/erzeuge-belege.py`, damit ein Golden-Set-Beleg entsteht — Firmen und Nummern erfunden (`docs/DATENSCHUTZ.md`).
5. Grenzfälle **vor** der Implementierung in `tests/` aufschreiben; dann `uv run pytest`.
6. Bewertung laufen lassen; steigt die Quote, Basislinie bewusst neu schreiben (`--basislinie-schreiben`), im Commit sagen, warum.

## Laufen lassen

```bash
cd extraktion && uv sync                           # einmalig
uv run pytest                                      # ohne Tesseract: OCR-Tests werden übersprungen, nicht grün
uv run python ../testdaten/erzeuge-belege.py       # PDFs aus dem Golden Set, byteidentisch
uv run python -m zollpilot_extraktion --ordner ../testdaten/belege/happy-path
uv run python -m zollpilot_extraktion.bewertung    # gegen basislinie.json
```

OCR auf Windows: `docker build --target test -t zollpilot-extraktion:test -f extraktion/Dockerfile .`
führt pytest mit Tesseract aus. Der Dienst im Stack: `docker compose up -d --wait`,
dann `bash scripts/rauchtest.sh` (Runde 2 schickt die PDFs).

## Was die Extraktion nie tut

- **Ein Modell rufen.** Kein OpenAI, kein Anthropic, kein Vision-Aufruf. Wenn
  das kommt, dann als eigene Stufe hinter einer Pseudonymisierung, mit
  eigener ADR (`docs/DATENSCHUTZ.md`).
- **Belegtext protokollieren.** `dienst.py` loggt Akten-ID, Zahlen, Dauer.
- **Stillschweigend verwerfen.** Unlesbar, unbekannt, OCR fehlt: alles hängt
  als `unclassified` mit `hinweis` an der Akte und steht in `extraktion.hinweise`.
- **Zahlen raten.** `als_betrag("12 PCE PAL-1")` ist None, nicht 121.
