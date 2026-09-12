# Entwurf: die Übersicht

Der zweite Bildschirm. Der erste (Struktur 1a, `03-abgleich.md`) ist eine
Akte: einreichen, Ergebnis lesen, übersteuern. Seit die Akte lebt (ADR-009,
ADR-010), entstehen Vorgänge ohne Menschen am Bildschirm: Nachforderungen
werden versandt, Antworten kommen per Mail, Akten werden erneut geprüft.
Dafür braucht die Sachbearbeitung eine Stelle, an der sie sieht, was
offen ist. Das ist dieser Bildschirm, und nur das.

Er wird hier beschrieben, nicht gezeichnet: Struktur, Zustände, Daten, und
was er nicht zeigt. Wireframe und Mockup des ersten Bildschirms gelten
für Töne, Maße und Schrift weiter.

## Wer und wozu

Dieselbe Sachbearbeitung Export wie beim ersten Bildschirm. Die Frage am
Morgen: *Welche Akten sind blockiert, wo wartet eine Nachforderung, und
ist Post gekommen, die niemand zuordnen konnte?* Der Bildschirm
beantwortet die Frage in einer Bildschirmhöhe; alles Weitere ist die
Akte selbst.

Zweite Nutzung: die zollverantwortliche Person, die wissen will, wie viele
Akten heute unter menschlicher Verantwortung freigegeben sind. Die Zahl
steht in der Bilanz; die Begründung je Fall steht in Postgres, nicht hier.

## Struktur

Eine Spalte, volle Breite, in dieser Reihenfolge:

1. **Kopfzeile** (gemeinsam mit dem ersten Bildschirm): Marke, Navigation
   „Prüfakte“ / „Übersicht“, rechts der angemeldete Name aus `/wer`. Ohne
   Anmeldung steht dort, dass der Name beim Übersteuern als Angabe gilt.
2. **Titel und ein Satz**, was die Zahlen sind und woher sie kommen: aus
   Postgres, entschieden wird hier nichts.
3. **Bilanz**: fünf Zahlen in einer Zeile. Akten, blockiert, freigabereif,
   offene Nachforderungen, unzugeordnete Post. Eine Zahl je Feld, kein
   Diagramm.
4. **Akten**: eine Tabelle, jüngste Prüfung zuerst. Spalten: Akte,
   Entscheidung (Wort, Farbe als Zugabe), zuletzt geprüft, Belege, offene
   Nachforderungen, letzte Stufe, Zoll-Cut-off. Die Entscheidung ist das
   Wort aus dem Regelwerk, nicht eine Deutung.
5. **Unzugeordnete Post**: eine Tabelle. Absender, Betreff, Grund, Eingang.
   Der Grund kommt aus dem Posteingang-Workflow, wörtlich.
6. **Neu laden** als Schaltfläche neben dem Titel, mit dem Zeitpunkt des
   letzten Ladens. Kein automatisches Nachladen: Wer liest, will nicht,
   dass die Tabelle unter ihm springt.

Unter 1024 px bleiben es Tabellen, in einem waagerecht scrollenden
Behälter; die Seite selbst scrollt nie waagerecht.

## Zustände

| Zustand | Was zu sehen ist |
|---|---|
| lädt | Titel, Schaltfläche gesperrt, „Lädt …“ daneben, Platzhalter an den Stellen der Blöcke |
| leer | Bilanz mit Nullen, „Noch keine Akte geprüft.“ statt der Tabelle |
| gefüllt | wie oben |
| Fehler | eine Meldung mit dem, was zu tun ist (läuft der Stack, ist der Workflow aktiv), keine leere Tabelle: Eine leere Tabelle hieße „nichts offen“, und das ist dann nicht bekannt |

## Daten

Ein Aufruf: `GET /webhook/akten`, über denselben Proxy wie alles. Antwort:

```json
{
  "akten": [{ "akte_id": "ZP-2026-0002", "status": "blockiert", "zuletzt_geprueft_am": "…", "belege": 5, "nachforderungen_offen": 2, "letzte_stufe": "erinnerung_1", "letzter_versand_am": "…", "customs_cutoff": "…" }],
  "unzugeordnet": [{ "id": 3, "von": "…", "betreff": "…", "grund": "keine Aktennummer in Betreff oder Text", "anhaenge": 0, "empfangen_am": "…" }],
  "zusammenfassung": { "akten": 8, "blockiert": 5, "freigabereif": 3, "nachforderungen_offen": 2, "unzugeordnet": 1 }
}
```

Der Workflow `zollpilot-lesen` liest das mit einer Abfrage aus `shipment`,
`document`, `request_case` und `mail_eingang`. Er zählt und sortiert; er
bewertet nicht.

## Was der Bildschirm nicht tut

- **Nicht zuordnen.** Eine unzugeordnete Mail lässt sich hier nicht einer
  Akte zuweisen. Das wäre eine Zuordnungsregel oder eine Handlung mit
  Folgen, und beides braucht mehr als eine Tabelle
  (`docs/OFFENE-PUNKTE.md`).
- **Nicht öffnen.** Es gibt keinen Weg von der Zeile zur Akte, weil der
  erste Bildschirm keine gespeicherte Akte laden kann; er prüft, was ihm
  gegeben wird. Der Weg „Zeile anklicken, Akte sehen“ ist der nächste
  Schritt und braucht das Laden einer abgelegten Akte in den Zustand.
- **Nicht versenden, nicht mahnen.** Das tut der Nachforderungs-Workflow
  nach seinem Zeitplan; der Bildschirm zeigt nur, wo er steht.
