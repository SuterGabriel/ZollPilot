---
description: Gleicht docs/ANFORDERUNGEN.md mit dem tatsächlichen Stand des Repos ab
---

Gleiche `docs/ANFORDERUNGEN.md` mit dem tatsächlichen Stand des Repos ab.

Diese Tabelle ist das Dokument, das ein Recruiter tatsächlich liest. Sie
aktuell zu halten ist wichtiger als jede Zeile Produktivcode.

Gehe Zeile für Zeile durch Must-have, Nice-to-have und Ergebnisse:

1. **Prüfe jeden Beleg.** Existiert die genannte Datei oder der Ordner?
   Enthält er tatsächlich, was die Zeile behauptet? Ein leerer Ordner belegt
   nichts. Eine Architekturbeschreibung belegt keine Implementierung.
2. **Aktualisiere den Status** auf offen, in Arbeit, belegt, teilweise
   belegbar, nicht belegbar oder zu klären.
3. **Präzisiere die Belegspalte** auf die konkrete Datei, wenn inzwischen eine
   existiert. `src/` ist ein schwächerer Beleg als die Regeldatei mit ihrem
   Test.

**Die wichtigste Regel dieses Commands:** Stufe niemals etwas auf „belegt“
hoch, was du nicht im Repo gesehen hast. Besonders M2 (IDP/OCR): Solange
keine Engine aus einem PDF eine Assertion macht, bleibt es „in Arbeit“, egal
wie gut die Architektur dokumentiert ist. Lieber eine Zeile zu vorsichtig als
eine Behauptung, die im Gespräch auffliegt.

Berichte am Ende drei Listen:

- Zeilen, die du hochgestuft hast, mit dem Beleg
- Zeilen, die du herabgestuft hast, weil der Beleg nicht trägt
- Belege im Repo, die zu keiner Anforderung gehören — entweder fehlt eine
  Zeile, oder es ist Arbeit, die niemand angefordert hat

Danach `bash scripts/beleg-check.sh`.
