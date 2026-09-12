# Produkt: die Sendungsakte aus Nutzersicht

Nicht Bildschirme, sondern Abläufe. Wer arbeitet mit dem System, was passiert
in welcher Reihenfolge, und was wird bewusst nicht gebaut.

## Wer

**Sachbearbeitung Export** in einem Industrieunternehmen oder bei einem
Spediteur. Bekommt pro Sendung fünf bis zehn Belege von drei Absendern in zwei
Wochen, in beliebiger Reihenfolge, teils als Entwurf. Muss vor dem Cut-off
wissen, ob die Akte freigabereif ist, und wenn nicht, wen sie um was bitten
muss. Heute: Excel, Postfach, Erfahrung.

**Zollverantwortliche Person.** Trägt die Verantwortung für Einreihung,
Ursprung und Zollwert. Will Regeln freigeben, nicht Akten. Braucht bei einer
Prüfung nach drei Jahren die Antwort auf: Welche Regel galt, welche Werte
lagen vor, wer hat übersteuert und warum.

**Lieferant, Spediteur, Carrier.** Bekommen Nachforderungen. Antworten auf
„Feld X auf Position 3 fehlt, akzeptiert wird A oder B, Frist ist Y“. Ignorieren
„bitte senden Sie alle Zollunterlagen“.

**Betrieb und Support.** Müssen den Stack starten, eine Ausführung finden, einen
Fehler zuordnen und einen Workflow neu importieren, ohne das Regelwerk zu
verstehen. `docs/BETRIEB.md`.

## Was zuerst kommt

Der Prototyp deckt einen Sachverhalt: **Ausfuhr in ein Drittland, Seefracht
FCL, Präferenz beansprucht.** Vier Belegtypen: Handelsrechnung, Packliste,
B/L, Präferenznachweis. Dreizehn Regeln, sechs Pflichteinträge, eine
Eskalationskette. Warum so eng: Ein Flow, der einen Sachverhalt vollständig
kann — inklusive Fehlerpfad, Konfidenzpfad, Nachforderung — ist
überzeugender als vierzig halbfertige Checks. Der Katalog ist ohne Deployment
erweiterbar; der Sachverhalt wird nicht heimlich breiter.

## Der Ablauf

1. **Eingang.** Eine Akte kommt als Datensatz an: Dokumente mit Status und
   Hash, Assertions mit Wert, Konfidenz und Fundstelle. Heute über den
   Webhook `POST /webhook/akte`; die Extraktion, die diesen Datensatz aus
   PDFs erzeugt, ist Stufe 3.

2. **Akte aufbauen.** Nur finale Belege werden zu Fakten. Ein Draft-B/L trägt
   nichts bei — und die Akte sagt das. Unbekannte Belegtypen bleiben an der
   Akte und werden gemeldet, nie verworfen.

3. **Pflichtmatrix.** Für den Sachverhalt: Welche Daten müssen nachgewiesen
   sein, durch welche Belege? Ein fehlender Präferenznachweis ist ein Befund
   mit akzeptierten Alternativen (EUR.1 oder Ursprungserklärung), nicht ein
   fehlendes PDF.

4. **Regeln, hart vor weich.** Dreizehn Regeln auf normalisierten Werten.
   Jede liefert Status, Eingaben, Begründung, Regelversion und den
   Verifikationsstand ihrer Rechtsgrundlage. Prüfziffern- und Summenfehler
   bei niedriger Konfidenz sind zuerst Lesefehler.

5. **Entscheidung.** `freigabereif`, `freigabe_mit_warnungen`,
   `nachextraktion_erforderlich` oder `blockiert`. Ein Override ist eine
   Entscheidung mit Namen und Begründung — nicht gebaut, aber als Tabelle
   vorgesehen.

6. **Nachforderung.** Je Befund ein Fall: welches Feld, welche Position,
   welcher Widerspruch, welche Nachweise akzeptiert, welche Folge bei
   Fristüberschreitung, an wen. Der Adressat kommt aus der
   Zuständigkeitstabelle, nicht aus dem Bauchgefühl.

7. **Ablage.** Jede Prüfung liegt in Postgres mit vollständigem Ergebnis. Die
   Sicht `rule_result` macht Befunde je Regel auswertbar: False-Positive-Rate,
   Alter offener Nachforderungen, Straight-through-Rate.

## Was die Testakten zeigen

Sieben synthetische Akten in `testdaten/akten/`, jede eine Variante desselben
Grundfalls. Der Fehlerpfad ist der Demo-Inhalt:

| Akte | Was passiert | Entscheidung |
|---|---|---|
| `happy-path` | alles stimmt, Gewicht 6 kg daneben, innerhalb der Toleranz | freigabereif |
| `praeferenznachweis-fehlt` | PFL-05 fehlt, ORG-02 nicht prüfbar | blockiert, Nachforderung an Exporteur |
| `ursprungswiderspruch` | Position 2 auf der Rechnung CN, Erklärung sagt DE | blockiert |
| `container-abweichung` | B/L und Packliste nennen verschiedene, je gültige Container | blockiert, Nachforderung an Carrier |
| `draft-bl` | einziges B/L ist ein Entwurf | blockiert, REF-03 und PFL-04 |
| `schlechter-scan` | Container per OCR mit Konfidenz 0,55, Prüfziffer falsch | Nachextraktion, keine Blockade |
| `kostenlose-position` | Position 3 „no charge“ ohne Zollwert | blockiert, VAL-03 |

Aufruf: `node src/cli.mjs testdaten/akten/*.json`.

## Was bewusst nicht gebaut wird

- **Keine Oberfläche.** Die Akte ist ein Datensatz, das Ergebnis ist ein
  Datensatz. Die n8n-Ausführungsliste und Postgres sind die Sicht des
  Prototyps. Eine Oberfläche käme, wenn klar ist, wer die Akte führt (PO,
  Rechnung, Container oder MRN — offene Frage 2 in `PROJECT.md`).
- **Keine Anmeldung.** Das System sagt, ob die Akte freigabereif ist; es
  erzeugt keine ATLAS-Nachricht. Offene Frage 1.
- **Kein Import, keine Luft- und Straßenfracht, kein CBAM, kein Dual-Use.**
  Im Datenmodell und im Regelkatalog vorgesehen, nicht implementiert.
- **Keine automatische Korrektur.** Kein Fakt wird vom System gesetzt, der
  nicht aus einer Assertion stammt. Welche Felder ein Mensch korrigieren darf
  und welche Vier-Augen brauchen, ist offene Frage 7.
