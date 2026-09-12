---
description: Prüft eine Akte über CLI und, wenn der Stack läuft, über den Webhook - und erklärt jeden Befund
---

Prüfe die Akte $ARGUMENTS (Pfad zu einer JSON-Datei, Standard: alle unter
`testdaten/akten/`).

1. `node src/cli.mjs <datei>` ausführen und die Ausgabe lesen.
2. Wenn `docker compose ps` einen gesunden n8n zeigt: dieselbe Akte per
   `curl -X POST http://localhost:5678/webhook/akte` schicken und die
   Entscheidung vergleichen. Weicht sie ab, ist das Bundle veraltet
   (`npm run bundle:check`) oder der Import alt — sag, welches.
3. Erkläre jeden Befund, der nicht `ok` ist, in zwei Sätzen: welche Regel,
   welche Eingabewerte, warum die Konsequenz aus `rules.yaml` gilt. Nenne
   den Verifikationsstand der Rechtsgrundlage (`rechtsquelle_status`).
4. Für jede Nachforderung: Passt der Adressat aus `zustaendigkeiten.yaml` zum
   fehlenden Feld? Wenn nicht, ist das ein Befund über die Tabelle, nicht
   über die Akte.

Nichts korrigieren. Das ist eine Lesung, kein Eingriff. Wenn die Akte einen
Fall zeigt, den keine Regel und kein Pflichteintrag fängt, sag das zuerst —
das ist der wertvollste Befund.
