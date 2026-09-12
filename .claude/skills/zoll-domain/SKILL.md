---
name: zoll-domain
description: Fachwissen und Konstruktionsregeln für Zoll- und Versanddokumente in ZollPilot - Belegtypen, Pflichtmatrix, Regelkatalog, Prüfziffern, Rechtsverweise mit Vorbehalt. Nutze diesen Skill immer, wenn eine Regel angelegt oder geändert wird, wenn ein Belegtyp, eine Schwelle, ein Incoterm oder eine Rechtsgrundlage vorkommt, beim Command /regel, und bevor irgendeine fachliche Zahl in den Code geschrieben wird.
---

# Zoll-Domäne

## Die eine Regel, die vor allen anderen gilt

**Keine fachliche Zahl ohne Katalogzeile.** Schwellen, Toleranzen, Stellenzahlen,
Fristen stehen in `rules.yaml` unter `parameters` oder `tolerance`, mit
`legal_basis`, `legal_source` und `valid_from`. Der Code liest sie aus der
Regel. `scripts/regel-check.mjs` lässt keine nackte Zahl außer 0, 1 und 2 in
`src/regeln/` durch.

Wenn du eine Zahl brauchst, die nicht im Katalog steht: **nicht raten.** Die
Recherche in `docs/` nachschlagen; steht sie dort, in den Katalog übernehmen
mit `legal_source: secondary`. Steht sie nirgends, `TODO-verify` in
`legal_basis` und die Zahl als Parameter, den der Zollverantwortliche freigibt.

Niemals eine Artikelnummer erfinden. Alle Verweise in `docs/` stammen aus
Sekundärrecherche (`docs/08-known-unknowns.md`). Keine Regel trägt heute
`legal_source: verified`, und das ist eine Aussage, kein Mangel.

## Wo was steht

| Frage | Datei |
|---|---|
| Was ist ein B/L, eine LLE, ein A.TR, und welche Fehler kommen vor? | `docs/01-dokumententypologie.md` |
| Welcher Nachweis wann, welche Schwellen, was bedeutet EXW für den Ausführer? | `docs/02-pflichtmatrix.md` |
| Alle Regeln, auch die nicht gebauten, mit Härte und Konsequenz | `docs/03-regelwerk-vollstaendig.md` |
| Regex, Prüfziffernalgorithmen, was offline prüfbar ist | `docs/04-stammdaten-formate.md` |
| Wer liefert was nach, Eskalation, Kostenfolgen | `docs/05-prozess-nachforderung.md` |
| ATLAS, ICS2, eFTI, eBL, CBAM bis 2028 | `docs/06-regulatorik.md` |
| Was wir nicht wissen | `docs/08-known-unknowns.md` |

Lies gezielt. Für eine Validierungsfunktion reicht `docs/04`; für eine neue
Regel `docs/03` und `rules.yaml`.

## Die häufigsten fachlichen Denkfehler

Diese fünf kommen in fast jedem Gespräch mit Nicht-Zöllnern vor; das System
kennt sie als Regeln:

- **A.TR ist kein Ursprungsnachweis** (ORG-03). Sie belegt den Freiverkehr in
  der Zollunion EU–Türkei.
- **Das ABD ist nicht der Ausgangsvermerk** (CUS-02, nicht im MVP). Wer das
  ABD archiviert, hat keinen Umsatzsteuernachweis.
- **Die 6.000-EUR-Grenze gilt für den Wert der Ursprungserzeugnisse**, nicht
  für den Rechnungsgesamtwert (ORG-06).
- **Bei EXW ist der Drittlandskäufer nicht ausführerfähig** (PTY-06, nicht im
  MVP). Art. 170 Abs. 2 UZK, `TODO-verify`.
- **Incoterms sind keine Zollwertformel.** Sie regeln Kosten und Risiko;
  der Zollwert folgt Art. 70 bis 72 UZK.

## Belegtypen im Datenmodell

`dokumente[].typ` kennt: `handelsrechnung`, `proformarechnung`, `packliste`,
`bill_of_lading`, `sea_waybill`, `origin_declaration`, `eur1`, `eur_med`,
`atr`, `abd`, `anmeldung`, `unclassified`. Neue Typen: erst in
`pflichtmatrix.yaml` als `required_evidence` einordnen, dann verwenden.

Das ABD (Ausfuhrbegleitdokument, Pfade `abd.*`) ist die lesbare Fassung der
überlassenen Ausfuhranmeldung mit der MRN. Es ist nicht der Ausgangsvermerk
(CUS-02). Die MRN wird nur der Struktur nach normalisiert; ob sie da ist,
prüft PFL-07, ob das ABD zur Sendung passt, CUS-05.

Die Ursprungserklärung auf der Rechnung ist ein **eigener logischer Beleg**
vom Typ `origin_declaration` mit `traeger: <Rechnungs-ID>` (ADR-001).

`dokumente[].status` ist `draft` oder `final`. Nur `final` speist Fakten.

## Faktenpfade

Assertions und Regeln sprechen über Punktpfade: `rechnung.gesamt`,
`rechnung.positionen.0.hs6`, `packliste.container_id`,
`bill_of_lading.brutto_kg`, `praeferenznachweis.ursprung`. Das erste Segment
ist der Bereich und bestimmt den Dateninhaber in `zustaendigkeiten.yaml`.
Neue Pfade dort eintragen, sonst landet die Nachforderung bei der
Sachbearbeitung.

## Prüfziffern

Offline vollständig prüfbar: Container (ISO 6346, Mod 11), AWB (Mod 7),
USt-IdNr. DE (MOD 11,10). Alles andere ist Formatprüfung; Vergabe braucht
einen Online-Lookup, der nie blockieren darf. Die MRN-Prüfziffer ist bewusst
nicht implementiert.

Referenzwerte für Tests kommen aus dem Standard oder einer externen Quelle,
**nie aus dem eigenen Code**. Der Entwicklungslog vom 12.09.2026 sagt, warum.

## Eine Regel anlegen

Der Command `/regel` führt durch die Schritte. Kurz: Katalogzeile in
`rules.yaml` → `[MVP]` in `docs/03` → `src/regeln/<ID>.mjs` mit
`(akte, regel, defaults, katalog)` → `tests/regeln/<ID>.test.mjs` mit
Grenzfällen, **die vor der Implementierung aufgeschrieben werden** →
Register in `src/regeln/index.mjs` → Bündlerliste in `scripts/n8n-bundle.mjs`
→ `npm run bundle`.

Jede Regel gibt `ok`, `verletzt`, `nicht_pruefbar` oder
`re_extraction_required` zurück (`src/regeln/befund.mjs`). Fehlende Eingabe
ist `nicht_pruefbar`, nie `verletzt`. Prüfziffern- und Summenfehler bei
Konfidenz unter `defaults.low_confidence_below` sind `re_extraction_required`.
