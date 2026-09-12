# Prompt: Wireframe

Zum Kopieren in ein Entwurfswerkzeug. Ergebnis ist ein **Wireframe**:
Struktur, Hierarchie, Zustände — keine Farben, keine Schriftwahl, kein
Feinschliff. Der Mockup-Prompt (`02-mockup-prompt.md`) baut darauf auf.

Was dieses Dokument absichtlich **nicht** tut: den bestehenden Bildschirm
beschreiben. Der Funktionsumfang unten ist die Grundlage; das Layout soll
neu gedacht werden.

---

## Der Prompt

Entwirf ein Wireframe für einen Arbeitsbildschirm. Sprache der Oberfläche:
Deutsch. Liefere Kästen, Beschriftungen und Anordnung — keine Farben, keine
Schriftarten, keine Schatten.

### Wer damit arbeitet

**Sachbearbeitung Export** in einem Industrieunternehmen oder bei einem
Spediteur. Die Situation, die das Layout bestimmt:

- Pro Sendung kommen fünf bis zehn Belege von drei verschiedenen Absendern,
  verteilt über zwei Wochen, in beliebiger Reihenfolge, teils als Entwurf.
- Es gibt einen **Cut-off**. Vor ihm muss feststehen, ob die Sendung
  freigegeben werden kann — und wenn nicht, **wen man um was bitten muss**.
- Heute läuft das über Excel, Postfach und Erfahrung.
- Die Person macht das den ganzen Tag. Sie braucht Dichte und Tempo, keine
  Einführung. Sie kennt die Fachbegriffe.

Zweite, seltenere Nutzung: eine **zollverantwortliche Person**, die Monate
später nachvollziehen will, welche Regel galt und welche Werte vorlagen.

### Was das System tut

Es prüft keine Dokumente einzeln, sondern führt pro Sendung eine **Akte**.
Belege sind Behauptungen; die Akte hält den geprüften Zustand. Der Mensch
liefert Belege, eine Extraktion liest sie, ein deterministisches Regelwerk
entscheidet. **Die Oberfläche entscheidet nichts** — sie zeigt, was das
Regelwerk geliefert hat, und muss das auch sichtbar machen.

### Die Aufgabe auf diesem Bildschirm

1. Stammdaten der Sendung angeben.
2. Belege (PDF) beilegen.
3. Prüfung auslösen.
4. Das Ergebnis lesen und daraus handeln.

Schritt 4 ist der eigentliche Zweck. Die Schritte 1 bis 3 sind der Preis
dafür und sollen klein bleiben.

### Welche Daten vorkommen

**Stammdaten, die der Mensch angibt** (elf Felder, alle vorbelegbar):
Akten-Nummer, Stichtag, Richtung (Ausfuhr Drittland / Einfuhr),
Verkehrsträger (See / Luft / Straße), Präferenz beansprucht (ja/nein),
Incoterm-Klausel (elf Werte), benannter Ort, UN/LOCODE, Verladehafen,
Löschhafen, Warennummern (kommagetrennte Liste).

**Belege**: Dateiname, Größe, Entfernen. Null bis etwa zehn Stück.

**Das Ergebnis** — fünf Blöcke, alle können leer sein:

*Die Entscheidung.* Genau einer von vier Zuständen:
`freigabereif`, `freigabe_mit_warnungen`, `nachextraktion_erforderlich`,
`blockiert`. Dazu Akten-Nummer, Katalogversion, Stichtag.

*Die erkannten Belege.* Je Beleg: Kennung (INV-1, PL-1, BL-1, UE-1),
Belegtyp, Status final oder Entwurf, Dateiname, wie gelesen (Textlayer oder
OCR), Seitenzahl, optional ein Hinweis. Ein Sonderfall: Die
Ursprungserklärung ist ein eigener Beleg, der auf einem anderen **liegt**
(„UE-1 auf INV-1"). Ein nicht erkannter Beleg erscheint als `unclassified`
mit Begründung — er wird nie verschwiegen.

*Nachweispflichten.* Je offener Eintrag: Kennung, Bezeichnung, Status
(fehlt / falscher Nachweis), Begründung, welche Nachweise akzeptiert werden,
Rechtsgrundlage. Echtes Beispiel:

> **PFL-05** — fehlt — Präferenzursprung, weil Präferenz beansprucht wird
> Präferenzursprung, weil Präferenz beansprucht wird: kein Nachweis in der Akte
> Akzeptiert wird: eur1 oder eur_med oder origin_declaration ·
> Ursprungsprotokoll des jeweiligen Abkommens; Art. 64 UZK

*Regeln.* Je offener Befund: Regelkennung, Name, Status (verletzt / nicht
prüfbar / nachlesen), Begründung mit konkreten Werten, Konsequenz,
Rechtsgrundlage **mit Verifikationsstand**, Regelversion. Echtes Beispiel:

> **ORG-02** — nicht prüfbar — Präferenzursprung deckt Ware
> Präferenznachweis oder Rechnungspositionen fehlen
> Präferenzverlust, Nacherhebung bis 3 Jahre (Art. 103 UZK) ·
> Ursprungsprotokoll des jeweiligen Abkommens; Art. 64 UZK *(Sekundärrecherche)* ·
> Regelversion 0.1.0@2026-09-12

Der Verifikationsstand ist kein Beiwerk: Keine Regel ist bisher gegen die
Primärquelle geprüft. Das muss lesbar sein, ohne den Befund zu entwerten.

*Nachforderungen.* Das Handlungsergebnis. Je Fall: Anlass, **Adressat**
(Rolle, plus Kopie-Empfänger), welches Feld fehlt, welcher Widerspruch
gefunden wurde, Folge bei Fristüberschreitung — und ein fertiges Anschreiben
von rund zwölf Zeilen, das versendet werden soll. Echtes Beispiel:

> **PFL-05** — an Exporteur/Lieferant (Kopie: Ursprungsstelle)
> `praeferenznachweis.ursprung` — kein Nachweis in der Akte
> Keine Freigabe der Akte
> *(darunter das vollständige Anschreiben, aufklappbar oder kopierbar)*

Typische Mengen: null bis vier offene Regelbefunde, null bis zwei
Pflichtbefunde, null bis sechs Nachforderungen. Bei einer sauberen Akte ist
alles leer — auch dieser Fall braucht eine gute Antwort.

### Zustände, die alle einen Entwurf brauchen

1. **Leer** — noch kein Beleg gewählt, Absenden gesperrt, der Grund steht sichtbar dabei.
2. **Belege liegen bereit** — Liste gefüllt, Absenden möglich.
3. **Eine Datei wurde abgelehnt**, weil sie kein PDF ist — mit Namen.
4. **Prüfung läuft** — dauert bei gescannten Belegen bis zu einer Minute.
5. **Freigabereif** — nichts offen. Zeig, dass das ein Ergebnis ist, kein leerer Bildschirm.
6. **Blockiert** — mehrere Befunde und Nachforderungen.
7. **Nachextraktion erforderlich** — ein Wert wurde unsicher gelesen; das ist weder Freigabe noch Ablehnung.
8. **Der Sachverhalt wird vom Katalog nicht gedeckt** (etwa Einfuhr) — dann werden nur Regeln geprüft, keine Nachweispflichten. Das System sagt das; die Oberfläche muss es zeigen können.
9. **Transportfehler** — der Prüfdienst antwortet nicht. Unterscheidbar von „blockiert".
10. **Etwas wurde eingereicht, dann ein Beleg nachgelegt** — das alte Ergebnis gilt nicht mehr.

### Was du entscheiden sollst

Genau das ist der Auftrag — leg dich fest und begründe kurz:

- **Ein Bildschirm oder mehrere?** Formular und Ergebnis nebeneinander, nacheinander, in Schritten, oder anders.
- **Wo landet der Blick nach dem Absenden?** Das Ergebnis ist das Ziel; der Weg dahin ist Nebensache.
- **Wie verdichtest du fünf Ergebnisblöcke**, ohne dass etwas untergeht — und ohne dass die häufigen Fälle (leer) wie Fehler aussehen?
- **Wie kommt jemand vom Befund zur Handlung?** Die Nachforderung mit Adressat und Anschreiben ist das, was die Person tatsächlich tun muss.
- **Wie zeigst du die elf Stammdatenfelder**, ohne dass sie den Bildschirm beherrschen — sie sind fast immer vorbelegt und werden selten angefasst.

### Randbedingungen

- **Tastaturbedienbar von Anfang bis Ende.** Ablegen per Zeigegerät darf es
  geben, aber nie als einzigen Weg.
- **Bildschirmbreiten von 1024 px aufwärts.** Kein Mobilentwurf nötig; die
  Arbeit passiert am Schreibtisch.
- **Farbe darf nie allein tragen.** Jeder Zustand braucht auch Text oder
  Form.
- **Deutsch**, Fachbegriffe bleiben (Incoterm, B/L, Präferenznachweis,
  UN/LOCODE).

### Was ausdrücklich nicht dazugehört

Anmeldung, Mandanten, Einstellungen, eine Liste früherer Prüfungen, eine
Suche. Und: **kein Korrigieren oder Übersteuern von Befunden** — das ist ein
eigener Arbeitsbildschirm für später. Entwirf so, dass ein zweiter
Bildschirm daneben Platz hätte, aber entwirf ihn nicht.

### Nicht als Vorlage nehmen

Es existiert bereits eine Umsetzung: eine einzelne, lange scrollende Seite —
Formular, darunter Belege, darunter das angehängte Ergebnis. Sie funktioniert
und ist die Messlatte für den Funktionsumfang, **nicht für das Layout**. Der
Sinn dieses Auftrags ist eine bessere Struktur; wenn dein Entwurf wieder eine
lange Seite ist, soll das eine Entscheidung sein, die du begründest, kein
Rückfall.

### Liefere

1. Wireframes für die Zustände 1, 2, 4, 5, 6 und 9 — in einer Auflösung, in
   der jede Beschriftung lesbar ist.
2. Eine kurze Notiz je Bildschirm: welche Entscheidung du getroffen hast und
   warum.
3. Die Tabulatorreihenfolge, als Nummern im Wireframe oder als Liste.
