# Prompt: Mockup

Zum Kopieren in ein Entwurfswerkzeug. Setzt das Wireframe aus
`01-wireframe-prompt.md` voraus — **das Wireframe geht als Bild mit in den
Auftrag.** Ergebnis ist ein Mockup in Endqualität: Farbe, Schrift, Abstände,
echte Inhalte.

---

## Der Prompt

Bau aus dem beiliegenden Wireframe ein Mockup in Endqualität. Übernimm
Struktur und Anordnung; entscheide Farbe, Typografie, Abstände, Zustände und
Detailtiefe. Sprache: Deutsch.

### Was das für ein Werkzeug ist

Ein Prüfbildschirm für Zoll- und Versandunterlagen. Wer damit arbeitet,
verantwortet Entscheidungen, die drei Jahre später nachgeprüft werden können
— eine übersehene fehlende Ursprungserklärung kostet Nacherhebung, eine
überflüssige Rückfrage kostet eine E-Mail. Die Asymmetrie soll man dem
Bildschirm ansehen.

Der Ton: **sachlich, dicht, verlässlich.** Ein Werkzeug für jemanden, der es
den ganzen Tag benutzt und die Fachbegriffe kennt. Keine Illustrationen,
keine Maskottchen, keine aufmunternden Sätze, keine abgerundeten
Freundlichkeiten. Näher an einem Bankterminal oder einem Flugdienstplan als
an einer Verbraucher-App. Aber nicht kalt oder billig: Ruhe und Präzision,
nicht Härte.

Was es **nicht** sein soll: ein Dashboard. Es gibt keine Kennzahlen, keine
Diagramme, keine Trends. Jeder Kreis, jeder Balken und jede große Zahl ohne
Aussage wäre hier eine Lüge.

### Harte Anforderungen an die Gestaltung

Diese sind nicht verhandelbar und werden maschinell geprüft:

- **Kontrast.** Fließtext mindestens 4,5:1 gegen seinen Grund, besser 7:1.
  Große Schrift und die Abgrenzung von Bedienelementen mindestens 3:1.
  Nenne für **jedes** Farbpaar, das du verwendest, das gerechnete Verhältnis.
- **Farbe trägt nie allein.** Die vier Entscheidungszustände müssen sich
  auch ohne Farbwahrnehmung unterscheiden — durch Wort, Form, Position oder
  Gewicht.
- **Sichtbarer Fokus.** Entwirf den Fokusring ausdrücklich, für hellen wie
  für farbigen Grund. Der Standardring des Browsers reicht auf farbigen
  Flächen nicht.
- **Klickflächen mindestens 44 × 44 px.**
- **Ein Thema, hell.** Kein dunkles Gegenstück.
- **Keine Schrift unter 12 px**, und Fließtext nicht unter 14 px.

### Die vier Entscheidungszustände

Sie sind das Wichtigste auf dem Bildschirm. Gib jedem eine eigene Farbe
**und** eine zweite, nicht farbige Spur:

| Zustand | Bedeutung | Häufigkeit |
|---|---|---|
| `freigabereif` | Nichts offen, die Akte kann freigegeben werden | selten |
| `freigabe_mit_warnungen` | Weiche Regel verletzt, ein Mensch bestätigt | gelegentlich |
| `nachextraktion_erforderlich` | Ein Wert wurde unsicher gelesen — **weder Freigabe noch Ablehnung**, sondern eine Aufforderung nachzulesen | gelegentlich |
| `blockiert` | Harte Regel verletzt oder Nachweis fehlt | häufig |

`nachextraktion_erforderlich` ist der interessanteste: Er darf nicht wie ein
Fehler aussehen, denn es ist keiner — das System sagt „ich habe schlecht
gelesen, nicht das Dokument ist falsch".

### Echte Inhalte, kein Blindtext

Verwende exakt diese Zeichenketten. Sie stammen aus dem laufenden System.

**Kopf der Entscheidung:**
`Blockiert` · `Akte ZP-2026-0002 · Katalog 0.1.0 · Stichtag 2026-09-12`

**Erkannte Belege** (Spalten: Kennung, Typ, Status, Datei, Gelesen):

| INV-1 | handelsrechnung | final | handelsrechnung.pdf | textlayer, 1 S. |
| UE-1 | origin_declaration *auf INV-1* | final | handelsrechnung.pdf | — *Ursprungserklärung auf der Rechnung, als eigener Belegtyp klassifiziert* |
| PL-1 | packliste | final | packliste.pdf | ocr, 1 S. |
| BL-1 | bill_of_lading | **Entwurf** | bill-of-lading.pdf | textlayer, 1 S. |
| UNK-1 | unclassified | final | lieferschein.pdf | — *Belegtyp nicht erkannt; bleibt an der Akte und wird gemeldet* |

**Hinweis der Extraktion:** `lieferschein.pdf: Belegtyp nicht erkannt`

**Nachweispflicht, offen:**
> PFL-05 · fehlt · Präferenzursprung, weil Präferenz beansprucht wird
> Präferenzursprung, weil Präferenz beansprucht wird: kein Nachweis in der Akte
> Akzeptiert wird: eur1 oder eur_med oder origin_declaration · Ursprungsprotokoll des jeweiligen Abkommens; Art. 64 UZK

**Regelbefund, nicht prüfbar:**
> ORG-02 · nicht prüfbar · Präferenzursprung deckt Ware
> Präferenznachweis oder Rechnungspositionen fehlen
> Präferenzverlust, Nacherhebung bis 3 Jahre (Art. 103 UZK) · Ursprungsprotokoll des jeweiligen Abkommens; Art. 64 UZK *(Sekundärrecherche)* · Regelversion 0.1.0@2026-09-12

**Regelbefund, verletzt:**
> TRN-01 · verletzt · Containernummer konsistent
> B/L nennt HLXU8765430, Packliste MSKU1234565
> Bezeichnet ggf. eine andere physische Sendung, Beschau · Gestellung, Verschlusssicherheit *(Praxisannahme)* · Regelversion 0.1.0@2026-09-12

**Nachforderung** mit aufklappbarem Anschreiben:
> PFL-05 · an Exporteur/Lieferant · Kopie: Ursprungsstelle
> `praeferenznachweis.ursprung` — Präferenzursprung, weil Präferenz beansprucht wird: kein Nachweis in der Akte
> Keine Freigabe der Akte

```
Betreff: ACTION REQUIRED – Präferenzursprung, weil Präferenz beansprucht wird – Shipment ZP-2026-0002

An: Exporteur/Lieferant (Kopie: Ursprungsstelle)

Benötigt:
- Dokument/Feld: praeferenznachweis.ursprung
- Grund der Anforderung: Präferenzursprung, weil Präferenz beansprucht wird (PFL-05)
- Gefundener Widerspruch: Präferenzursprung, weil Präferenz beansprucht wird: kein Nachweis in der Akte
- Akzeptierte Nachweise: eur1, eur_med, origin_declaration
- Folge bei Fristüberschreitung: Keine Freigabe der Akte

Referenzen: Invoice INV-2026-0417 / B/L MAEU-HH-778812 / Container MSKU1234565
```

**Stammdatenfelder, vorbelegt:** Akten-Nummer `ZP-2026-0002` · Stichtag
`12.09.2026` · Richtung `Ausfuhr in ein Drittland` · Verkehrsträger
`Seefracht` · Präferenz wird beansprucht ☑ · Klausel `FOB` · Benannter Ort
`Hamburg` · UN/LOCODE `DEHAM` · Verladehafen `DEHAM` · Löschhafen `SGSIN` ·
Warennummern `84133080, 84842000`

**Belegliste:** `handelsrechnung.pdf` 6 kB · `packliste.pdf` 4 kB ·
`bill-of-lading.pdf` 3 kB

**Gesperrtes Absenden:** `Akte einreichen` mit dem Hinweis
`Mindestens ein Beleg wird gebraucht.`

**Transportfehler:** `Keine Verbindung zum Prüf-Workflow. Läuft der Stack
(docker compose up -d --wait)?`

### Typografische Aufgabe

Drei Arten von Text stoßen hier aufeinander, und der Entwurf muss sie
trennen:

1. **Prosa** — Begründungen, Konsequenzen. Wird gelesen.
2. **Kennungen** — `PFL-05`, `ORG-02`, `INV-1`, `0.1.0@2026-09-12`,
   `praeferenznachweis.ursprung`, `HLXU8765430`. Werden verglichen und
   abgetippt. Verwechslungsgefahr bei 0/O und 1/l/I.
3. **Rechtsverweise mit Verifikationsstand** — `Art. 64 UZK
   (Sekundärrecherche)`. Müssen lesbar sein, dürfen aber die Begründung
   nicht überlagern. Der Vorbehalt darf nicht verschwinden und nicht
   dominieren.

Wähle höchstens zwei Schriftfamilien und begründe die Wahl.

### Was du liefern sollst

1. **Vier Mockups**: leeres Formular · Belege liegen bereit · Ergebnis
   `blockiert` (mit allen Inhalten oben) · Ergebnis `freigabereif`.
2. **Ein Zustandsblatt**: die vier Entscheidungszustände nebeneinander, in
   Farbe und in Graustufen — der Graustufen-Abzug ist der Beweis, dass Farbe
   nicht allein trägt.
3. **Die Gestaltungstoken als Liste**: jede Farbe mit Hex-Wert, Verwendung
   und dem gerechneten Kontrastverhältnis gegen ihren Grund. Dazu Abstände,
   Radien, Schriftgrößen.
4. **Den Fokuszustand** an mindestens drei verschiedenen Bedienelementen.
5. Eine kurze Notiz, was du gegenüber dem Wireframe geändert hast und warum.

### Was nicht dazugehört

Kein Logo-Entwurf, keine Illustration, keine Animation, keine Marketingseite,
kein Login, kein dunkles Thema, keine Mobilansicht.
