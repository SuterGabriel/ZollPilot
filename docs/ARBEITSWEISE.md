# Beleg statt Behauptung

Wie ein Projekt so dokumentiert und geprüft wird, dass keine Aussage über die
eigene Arbeitsweise unüberprüft stehen bleibt. Kein Prozessmodell — eine
Reihenfolge, elf Dokumente und acht Prüfebenen, die sich gegenseitig halten.

> Jede Behauptung über die eigene Arbeitsweise wird in eine **Zusage übersetzt,
> die kaputtgehen kann.**

Abgeleitet aus dem Vorgängerprojekt Aptum (Terminplanung für
Therapiepraxen, Java und Angular): 58 Commits vom 9. bis 12. September 2026,
11 Dokumente, 9 ADRs, 42 Logeinträge, 11 CI-Jobs, 8 Prüfebenen. Die Zahlen
in diesem Dokument beziehen sich auf jenes Projekt.

Dieses Dokument ist als Bauplan für ein *weiteres* Projekt geschrieben — und
ZollPilot ist dieses weitere Projekt. Wo Werkzeuge austauschbar sind, stehen
sie bewusst als Rolle da — „Oberfläche" statt Angular, „Framework" statt
Spring —, damit der Plan auch für einen anderen Stack trägt. Für ZollPilot
heißt das: „Domänentests" sind die Regeltests in `tests/regeln/`,
„Integrationstests gegen echte Infrastruktur" ist der Rauchtest gegen den
Compose-Stack, und die Fachregel-Prüfung ist `scripts/regel-check.mjs` gegen
`rules.yaml`. Was ZollPilot davon umgesetzt hat und was nicht, steht in
[PIPELINE.md](PIPELINE.md).

---

## Der tragende Gedanke

Jedes Repository behauptet etwas über sich: dass Entscheidungen dokumentiert
sind, dass Fachregeln belegt sind, dass die Oberfläche barrierefrei ist. Die
Behauptungen stimmen am Tag, an dem sie geschrieben werden, und danach nie
wieder — weil nichts sie nachhält.

Der Ausweg ist keine strengere Disziplin, sondern eine Übersetzung: Jede
Aussage im Dokument bekommt ein Skript, das rot wird, wenn sie nicht mehr
stimmt.

- Aus „die Kontraste erfüllen WCAG" wird ein Job, der 31 Farbpaare nachrechnet.
- Aus „Entscheidungen sind dokumentiert" wird eine Prüfung auf die
  Pflichtabschnitte jeder ADR.
- Aus „die Fristen sind belegt" wird ein Gate, das jede Zahl im Code gegen ihre
  Fundstelle hält.

Was dabei entsteht, ist nicht nur Qualitätssicherung. Es ist ein Geländer für
agentische Arbeit: Ein Agent, der gegen eine Projektregel verstößt, bekommt ein
rotes Ergebnis statt eines Review-Kommentars, den niemand schreibt.

---

## Teil 1 — Dokumentation

### Elf Dokumente, jedes mit einem Zeitpunkt

Entscheidend ist nicht die Liste, sondern die Spalte daneben: *wann* das
Dokument entsteht. Jedes einzelne wird vor dem geschrieben, was es beschreibt —
das ist der ganze Unterschied zu einer Dokumentation, die am Projektende
nachgereicht wird.

| Dokument | Entsteht | Hält fest | Wird geprüft durch |
|---|---|---|---|
| `ANFORDERUNGEN.md` | vor der ersten Zeile Code | jede Anforderung wörtlich, mit Status und Beleg im Repo | jeder Belegpfad muss existieren — außer die Zeile trägt `offen` |
| `CLAUDE.md` | Tag 1 | die vier Regeln, die überall gelten; Verweise auf Skills | höchstens 60 Zeilen — alles Längere gehört in einen Skill |
| `DECISIONS.md` + `docs/adr/` | im Moment der Entscheidung | Kontext, Optionen, Entscheidung, Konsequenzen, „Wann wir anders entscheiden würden" | jede ADR muss diese Abschnitte tragen |
| `ENTWICKLUNGSLOG.md` | am selben Tag | was delegiert wurde, was *nicht* funktionierte, was die Tests abgefangen haben | Existenz; die Ehrlichkeit trägt die Vorlage |
| `PRODUKT.md` | vor der ersten Oberfläche | Nutzersicht und Abläufe, nicht Bildschirme | als Beleg mehrfach referenziert |
| `PIPELINE.md` | sobald das erste Gate steht | wie geprüft wird — und ein Abschnitt, was *nicht* geprüft wird | Existenz; der Ehrlichkeitsabschnitt ist Pflicht |
| `DATENSCHUTZ.md` | vor dem ersten LLM-Aufruf | Testdatenregel, Pseudonymisierung vor jedem Aufruf | Prüfung, dass keine realistischen Personendaten liegen |
| `OFFENE-PUNKTE.md` | laufend | was ungeklärt ist, inklusive der unbequemen Punkte | als Beleg für „zu klären"-Zeilen referenziert |
| `BETRIEB.md` | mit der Betriebsstufe | was ein echter Betrieb über das Gebaute hinaus bräuchte | — |
| `AI-PIPELINE.md` | mit dem AI-Layer | Prompt, Pseudonymisierung, Provider, Messverfahren | Eval-Lauf bei jeder Prompt-Änderung |
| `.claude/skills/` | vor der ersten Fachänderung | Domänenwissen und Hausstil — versioniert im Repo, nicht global | jeder benannte Skill muss eine `SKILL.md` haben |

### Die vier Regeln, die dieses Set zusammenhalten

1. **Das Dokument entsteht vor dem, was es beschreibt.** Die Anforderung vor dem
   Code, die ADR im Moment der Entscheidung, der Logeintrag am selben Tag.
   Rückwirkend geschriebene Beobachtungen sind Erinnerungen, und Erinnerungen
   bevorzugen die Fälle, die gut ausgingen.

2. **Jede Behauptung nennt ihren Beleg, und ein Skript prüft ihn.** Ein Pfad in
   der Belegspalte, der ins Leere zeigt, ist der häufigste Zerfall — von Hand
   fällt er nie auf, weil niemand eine Tabelle gegen den Verzeichnisbaum liest.

3. **Was noch nicht existiert, steht als Ziel mit Status da.** Nicht
   weggelassen, nicht behauptet. Die Prüfung unterscheidet deshalb zwischen
   unbedingter Behauptung und Zeile mit Status — sonst erzieht sie dazu, Ziele
   aus dem Dokument zu streichen, und macht das Repo ärmer statt ehrlicher.

4. **Alles Agentenbezogene liegt im Repo.** Skills, Commands, Subagents, Hooks —
   versioniert, nicht in der globalen Konfiguration. Sie sind Teil des
   Ergebnisses, nicht nur das Werkzeug.

### Der Logeintrag: eine Vorlage, fünf Felder

Das Entwicklungslog ist das einzige Dokument, das ohne Vorlage sofort verkommt.
Diese fünf Felder halten es ehrlich:

- **Was delegiert wurde** — der Auftrag, nicht das Ergebnis
- **Was gut lief** — kurz
- **Was nicht funktionierte** — Pflichtfeld, auch wenn es peinlich ist
- **Was die Testsuite abgefangen hat** — der wertvollste Abschnitt: er belegt,
  dass die CI tatsächlich als Geländer wirkt und nicht nur so genannt wird
- **Zeitschätzung** — delegiert gegen von Hand geschätzt

---

## Teil 2 — Prüfverfahren

### Drei Durchsetzungspunkte

Dieselbe Prüfung greift an drei Stellen, und zwar absichtlich mehrfach.

| Punkt | Wann | Was |
|---|---|---|
| **Git-Hook** | vor dem Commit | Prüft nur die vorgemerkten Dateien. Schnell, mit `--no-verify` umgehbar — und genau deshalb nicht die einzige Stufe. |
| **Agenten-Hook** | direkt nach dem Schreiben | Ein `PostToolUse`-Hook prüft die Datei, die der Agent gerade geschrieben hat. Rückmeldung, bevor der nächste Schritt darauf aufbaut. |
| **CI** | bei jedem Push | Dieselben Prüfungen über den ganzen Baum. Nicht umgehbar, und die einzige Stufe, deren Ergebnis sichtbar bleibt. |

### Die acht Prüfebenen, von schnell nach langsam

Die Reihenfolge ist keine Rangfolge, sondern die Laufzeit. Eine Ebene, die drei
Sekunden braucht, darf bei jedem Tastendruck laufen; eine, die einen Cluster
hochfährt, läuft einmal pro Push.

**1. Skript-Gates** — eigene Skripte, Node und Bash
Prüfen die Behauptungen des Repos über sich selbst: Belegpfade, Verweise,
Prosa-Konventionen, Farbkontraste, Fundstellen der Fachregeln.
*Umfang hier: 5 Gates, Laufzeit unter 2 Sekunden.*

**2. Domänentests** — parametrisiert
Jede Fachregel ist eine benannte Klasse, nie ein `if` im Service. Jede bekommt
parametrisierte Tests für ihre Grenzfälle — und die Grenzfallliste entsteht
*vor* der Implementierung.
*Umfang hier: 12 Regelklassen, 26 Testklassen.*

**3. Architekturtests** — ArchUnit
Prüfen die Modulgrenze als Test, nicht als Vereinbarung: kein
Framework-Import im Domänenmodul, Ports innen, Adapter außen.
*Läuft bei jedem Backend-Build.*

**4. Integrationstests** — Testcontainers mit echter Datenbank
Sicherheitsmechanismen werden gegen die echte Infrastruktur geprüft, nicht
gegen ein Mock. Der Mandantentest fragt: Sieht A wirklich nichts von B?
*Umfang hier: Row Level Security als Isolationstest.*

**5. Frontend-Unit**
Dazu ein Gate, das die erzeugten API-Typen gegen das Schnittstellendokument
hält, und ein Bundle-Budget beim Build.
*Umfang hier: 9 Specs, Lint mit Barrierefreiheitsregeln.*

**6. Ende-zu-Ende mit axe** — Playwright
Gegen echtes Backend und echtes Frontend, mit axe über jede Seite. Das ist die
Merge-Bedingung für jede Änderung an der Oberfläche — Barrierefreiheit wird
geprüft, nicht behauptet.
*Umfang hier: 4 Spezifikationen, jede Seite.*

**7. Evals** — eigener Runner, Basislinie im Repo
LLM-Qualität wird feldweise gemessen, nicht als Gesamtnote. Jeder Fall trägt
eine Begründung im Feld `warum`. Bei jeder Prompt-Änderung läuft die Suite
gegen die letzte Basislinie.
*Umfang hier: 55 Fälle, 53 grün, 2 begründet rot.*

**8. Fremdes Werkzeug** — statische Analyse von außen
Der wichtigste Befund am ersten Tag: Alle 45 Funde lagen in der Pipeline und in
den eigenen Gate-Skripten, keiner im Anwendungscode. Die selbstgebauten Prüfer
waren der schwächste Teil.
*Umfang hier: Quality Gate grün, Abdeckung 85,5 Prozent.*

### Die Fachregel-Prüfung — der Teil, den die meisten Projekte nicht haben

Der wichtigste Befund aus der Fundamentstufe lautet: *Falscher Code fällt im
Test auf, falsche Fachlogik nicht.* Ein Test über eine erfundene Frist ist grün.

Die Antwort darauf ist eine Regeltabelle, in der jede fachliche Zahl vier Dinge
trägt — Kennung, Wert, Fundstelle und Beleg-Status —, und ein Gate, das jede
Konstante im Domänencode gegen diese Tabelle hält.

Drei Status reichen aus, und der dritte ist der interessante:

| Status | Bedeutung |
|---|---|
| `BELEGT` | Wert und Fundstelle geprüft, darf in den Code |
| `UNSICHER` | Widerspruch oder Zweifel — darf *nicht* in den Code |
| `BELEGT als Nichtfund` | Regel gesucht und **nicht** gefunden — ein Rechercheergebnis, keine Leerstelle |

Ohne die dritte Kategorie füllt ein Agent die Lücke plausibel auf. Das ist der
teuerste Fehler, den ein KI-gestütztes Fachprojekt machen kann.

---

## Teil 3 — Reihenfolge

Die Stufen sind keine Sprints, sondern Abhängigkeiten: Jede setzt voraus, dass
die vorige einen prüfbaren Zustand erreicht hat. Stufe 0 kostet einen Tag und
trägt alles Weitere.

### Stufe 0 — Fundament

**Regeln, Anforderungen, das erste Gate.** Anforderungen wörtlich erfassen. Die
vier Projektregeln auf eine Bildschirmseite. Skills für Fachdomäne und Hausstil
anlegen. Das erste Beleg-Gate schreiben — und es einmal absichtlich rot machen.

> **Ergebnis:** Ein Repo, das seine eigenen Behauptungen prüft, bevor die erste
> Fachzeile existiert.

### Stufe 1 — Kern

**Domäne ohne Framework, dann erst das Framework.** Fachregeln als benannte
Klassen mit parametrisierten Grenzfalltests. Erst wenn der Kern steht:
Framework, Persistenz, Mandantentrennung gegen echte Infrastruktur, REST mit
erzeugtem Schnittstellendokument.

> **Ergebnis:** Ein Kern, der ohne Framework testbar ist — und ein
> Architekturtest, der das festhält.

### Stufe 2 — Oberfläche

**Gegen das erzeugte Schnittstellendokument, nicht gegen eine Vermutung.**
Gestaltungstoken zuerst, mit den Kontrastanforderungen als Kommentar neben der
Farbe. Dann die Komponenten, mit Tastaturnavigation und Fokusverwaltung von
Anfang an. Ende-zu-Ende-Tests mit axe als Merge-Bedingung.

> **Ergebnis:** Barrierefreiheit als Job in der Pipeline statt als
> Absichtserklärung.

### Stufe 3 — KI-Schicht

**Der Vorschlag durchläuft dieselbe Prüfung wie eine Eingabe von Hand.**
Pseudonymisierung vor jedem Aufruf. Eigener Dienst, austauschbarer Anbieter.
Die Eval-Suite entsteht *mit* dem ersten Prompt, nicht danach — jeder Fall mit
Begründung, Messung feldweise, Basislinie im Repo.

> **Ergebnis:** Kein Modellvorschlag wird gebucht, ohne die deterministische
> Regelprüfung zu durchlaufen.

### Stufe 4 — Betrieb

**Angewendet, nicht als Beispiel abgelegt.** Ein Befehl fährt alles hoch. Das
Chart wird in einem Wegwerf-Cluster in der Pipeline tatsächlich ausgerollt und
mit einem Rauchtest geprüft. Protokolle als JSON mit Mandanten-Kennung, ohne
Personenbezug.

> **Ergebnis:** Infrastrukturdateien, von denen bewiesen ist, dass sie laufen.

### Stufe 5 — Abgleich

**Das Mapping gegen das Repo, das README als Fremder.** Jede Anforderungszeile
gegen den tatsächlichen Stand prüfen. Das README einmal so lesen, als käme man
von außen: Zweck zuerst, Stand ohne Widerspruch. Und aufschreiben, was das
Projekt *nicht* belegen kann.

> **Ergebnis:** Ein Dokumentenstand, in dem keine Zeile mehr etwas anderes sagt
> als das Repo.

---

## Teil 4 — Die Fallen

### Das stumme Gate

Ein Gate, das nichts meldet, sieht aus wie ein Gate, das zufrieden ist. Dreimal
in vier Tagen meldete ein selbstgebauter Prüfer grün, weil ihm die Grundlage
fehlte — jedes Mal in anderem Gewand, jedes Mal erst durch eine Gegenprobe von
Hand aufgefallen.

**Falle 1: Der Prüfer prüft die falsche Ebene.**
Das Beleg-Gate prüfte, ob die Mapping-Datei existiert — nicht, ob die Pfade
*in* ihr auf etwas zeigen. Drei Belege verwiesen auf eine Datei, die es nie gab.
→ *Nicht die Hülle prüfen, sondern den Inhalt, auf den sie zeigt.*

**Falle 2: Nichts gefunden, also grün.**
Das Regel-Gate fand keine Regelklassen, hatte damit nichts zu prüfen und meldete
Erfolg. Später borgte sich eine Konstante die Fundstelle ihres Nachbarn — auch
das blieb stumm.
→ *Ein Prüfer, der keine Grundlage findet, meldet den Stand — nie Erfolg. Und er
bekommt eine eigene Testsuite mit den geschlossenen Lücken als Fixtures.*

**Falle 3: Die Vergleichsgrundlage liegt nicht im Repo.**
Ein `.gitignore`-Eintrag aus der Fundamentstufe hielt die Eval-Basislinie
draußen. Die Pipeline verglich gegen nichts und sagte kein Wort — während im
Commit stand, die Basislinie liege im Repo.
→ *Was im Commit behauptet wird, einmal mit `git ls-files` nachsehen. Und der
Runner schreibt „KEINE BASISLINIE" in die erste Zeile, wenn ihm der Vergleich
fehlt.*

### Die Gegenprobe als feste Regel

Jedes Gate wird einmal absichtlich rot gemacht und danach wieder grün: Datei
weg, Exit-Code prüfen, Meldung lesen, Datei zurück. Das kostet zwei Minuten je
Gate und ist der einzige Beweis, dass der Prüfer tut, was sein Name sagt.

Ein Guardrail, von dem niemand gesehen hat, wie er ausschlägt, ist eine
Behauptung wie jede andere.

### Und ein Abschnitt, der aufschreibt, was durchrutscht

Am Ende der Pipeline-Dokumentation steht die Liste dessen, was die Prüfung
*nicht* abfängt — etwa dass der Wertabgleich grob ist und eine Zeile mit
mehreren Zahlen beide deckt, oder dass fachliche Nullen und Einsen
durchrutschen, weil sie in jedem Code vorkommen.

Dieser Abschnitt ist der glaubwürdigste Teil der ganzen Dokumentation, weil er
der einzige ist, den niemand schreiben müsste.

---

## Herkunft

Zahlen und Verfahren stammen aus dem Repository Aptum, dessen Fassung dieses
Dokuments am 12.09.2026 übernommen wurde. Die Entsprechungen in ZollPilot:
[PIPELINE.md](PIPELINE.md), [ENTWICKLUNGSLOG.md](ENTWICKLUNGSLOG.md),
[ANFORDERUNGEN.md](ANFORDERUNGEN.md) und die sechs Jobs in
[ci.yml](../.github/workflows/ci.yml).
