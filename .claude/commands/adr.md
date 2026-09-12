---
description: Schreibt eine ADR im Moment der Entscheidung, mit den fünf Pflichtabschnitten
---

Schreibe eine ADR für: $ARGUMENTS

Folge dem Skill `adr`. Nächste freie Nummer in `docs/adr/`, Datei
`docs/adr/ADR-NNN-kurzer-titel.md`, dann die Zeile in `DECISIONS.md`.

Mindestens zwei Optionen, jede mit ihrem echten Vorteil. Der negative Teil
der Konsequenzen ist der wichtigere. „Wann wir anders entscheiden würden“ ist
nie leer.

Wenn die Entscheidung eine der vier Regeln in `CLAUDE.md` berührt, sag das
im Kontext ausdrücklich. Wenn sie eine bestehende ADR ablöst, setze deren
Status auf „abgelöst durch ADR-NNN“.

Danach `bash scripts/beleg-check.sh` — er prüft die Pflichtabschnitte und den
Link in `DECISIONS.md`.
