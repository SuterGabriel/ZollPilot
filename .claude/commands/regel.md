---
description: Legt eine neue Regel aus docs/03 vollständig an - Katalog, Markierung, Code, Test, Register, Bundle
---

Lege die Regel $ARGUMENTS aus `docs/03-regelwerk-vollstaendig.md` an. Lies
vorher den Skill `zoll-domain`.

Reihenfolge, und zwar genau diese:

1. **Grenzfälle zuerst.** Schreibe `tests/regeln/<ID>.test.mjs` mit den
   Grenzfällen, bevor eine Zeile Implementierung existiert: genau auf der
   Schwelle, knapp darüber, fehlende Eingabe (muss `nicht_pruefbar` sein),
   und wenn die Regel Konfidenz kennt, der Lesefehlerfall. Nutze
   `tests/hilfen.mjs`.
2. **Katalogzeile** in `rules.yaml` mit allen Pflichtfeldern: `id`, `name`,
   `hardness`, `risk`, `inputs`, `assertion`, `legal_basis`, `legal_source`,
   `consequence`, `valid_from`. Jede fachliche Zahl unter `parameters` oder
   `tolerance`. Rechtsgrundlage aus `docs/03` übernehmen, `legal_source:
   secondary`; steht dort keine, `TODO-verify` und `legal_source: practice`.
3. **`[MVP]`-Markierung** in `docs/03` an der Regelzeile. Der Regel-Check
   prüft beide Richtungen.
4. **Implementierung** `src/regeln/<ID>.mjs`: `export function
   pruefe<ID ohne Bindestrich>(akte, regel, defaults, katalog)`, liest Fakten
   über `fakt(akte, pfad)`, gibt `ok`, `verletzt`, `nichtPruefbar` oder
   `reExtraction` aus `befund.mjs` zurück. Keine nackte Zahl außer 0, 1, 2.
   Global eindeutige Namen (Skill `n8n-code-nodes`).
5. **Register** in `src/regeln/index.mjs` und **Bündlerliste** in
   `scripts/n8n-bundle.mjs`.
6. `npm test`, `node scripts/regel-check.mjs`, `npm run bundle`.
7. Wenn die Regel einen neuen Faktenpfad einführt: Dateninhaber in
   `zustaendigkeiten.yaml`. Wenn sie eine Testakte verdient (Fehlerpfad):
   Variante in `testdaten/erzeuge-akten.mjs` mit `erwartung`, Generator
   laufen lassen.

Berichte am Ende: die Grenzfälle, die du geschrieben hast, und welche Zahl
aus welcher Katalogzeile kommt. Wenn du eine Zahl nicht belegen konntest,
sag das zuerst.
