# ZollPilot

Vollständigkeits- und Konsistenzprüfung von Zoll- und Versanddokumenten.
Das System verarbeitet keine Dokumente, sondern führt pro Sendung eine **Akte**:
Belege sind Behauptungen, die Akte hält den geprüften Zustand. n8n orchestriert,
deterministischer Code in `src/` entscheidet. Portfolio-Projekt; alles
Agentenbezogene liegt versioniert im Repo.

## Die vier Regeln

1. **Nachweis statt Dokument.** Geprüft wird "ist Datum Y nachgewiesen", nie
   "liegt Beleg X vor". `pflichtmatrix.yaml` trennt `required_data`,
   `required_evidence`, `required_document_form`.
2. **Rohwert und Aktenwert getrennt.** Assertions (was ein Beleg sagt, mit
   Fundstelle und Konfidenz) werden nie überschrieben; Fakten sind Ableitungen
   aus finalen Dokumenten. `src/akte/aufbau.mjs`.
3. **Regeln sind Daten.** Schwellen, Toleranzen, Rechtsverweise stehen in
   `rules.yaml` mit `valid_from`. Keine nackte Zahl in `src/regeln/` —
   `scripts/regel-check.mjs` prüft das.
4. **Kein Modell in der Entscheidungsschicht.** Modelle extrahieren,
   klassifizieren, normalisieren. Freigabe läuft ausschließlich deterministisch
   auf normalisierten Werten.

## Harte Grenzen

- Prüfziffern- und Summenfehler bei niedriger Konfidenz sind zuerst Lesefehler:
  `re_extraction_required`, nicht fachliche Ablehnung.
- Nichts stillschweigend verwerfen. Unbekannte Belege hängen als `unclassified`
  an der Akte und werden gemeldet.
- Keine Testdaten aus echten Sendungen. `docs/DATENSCHUTZ.md`.
- Rechtsverweise stammen aus Sekundärrecherche. Nie eine Artikelnummer raten;
  im Zweifel `TODO-verify`. Vorbehalt in `docs/08-known-unknowns.md`.

## Entscheidungen

ADRs entstehen im Moment der Entscheidung. Skill `adr`, Command `/adr`,
Übersicht in `DECISIONS.md`.

## Skills

| Skill | Wofür |
|---|---|
| `zoll-domain` | Fachregeln, Belegtypen, Fundstellen. **Vor jeder Regeländerung lesen.** |
| `n8n-code-nodes` | Transport im Workflow, Entscheidung in `src/`, Bundle, Hausstil |
| `extraktion` | Python-Dienst: PDF → Assertions mit Konfidenz. Behauptet, entscheidet nie |
| `adr` | Format und Ablauf für Entscheidungen |

## Commands

`/regel` · `/adr` · `/akte-pruefen` · `/anforderungs-mapping`

## Was jede Änderung erfüllen muss

`npm test` grün · `npm run check` grün (Belege, Prosa, Verweise, Regeln) ·
bei Änderung an `src/` oder Katalog `npm run bundle` · bei Änderung unter
`extraktion/` `uv run pytest` und die Bewertung gegen die Basislinie ·
Commit erklärt die Entscheidung, nicht die Zeilen, deutsch, imperativ, eine Zeile.
