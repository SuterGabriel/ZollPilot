---
name: oberflaeche
description: Hausstil für die Angular-Oberfläche in ZollPilot (oberflaeche/) - was sie darf und was nicht, ngrx statt Komponentenzustand, der BelegSpeicher für Dateien, die 422-Antwort des Workflows, Gestaltungstoken mit geprüftem Kontrast, Barrierefreiheit als Bedingung. Nutze diesen Skill immer, wenn unter oberflaeche/ oder deploy/nginx/ etwas geändert wird, wenn eine Farbe, eine Komponente, ein Formularfeld oder ein Zustand dazukommt, und bei jeder Frage, ob etwas in die Oberfläche oder ins Regelwerk gehört.
---

# Die Oberfläche

## Die Grenze

**Die Oberfläche zeigt, sie entscheidet nicht** (ADR-006). Sie kennt keine
Schwelle, keine Regel, keinen Katalog. Jeder Satz, den sie anzeigt, steht so
im Ergebnis des Webhooks: die Entscheidung, die Begründung je Regel, die
Rechtsgrundlage mit ihrem Verifikationsstand, der Adressat jeder
Nachforderung.

Die Probe: *Stünde dieser Satz auch dann da, wenn das Regelwerk ihn nicht
geliefert hätte?* Wenn ja, ist er falsch am Platz.

Die einzige Bedingung im Browser ist, ob das Formular abgeschickt werden
darf — Pflichtfeldlogik, keine Fachregel. `scripts/beleg-check.sh` prüft,
dass `oberflaeche/src/` weder `rules.yaml` noch `low_confidence_below`
erwähnt.

## Angular 22, nicht das Angular von gestern

Fünf Vorgaben, die sich gegenüber älteren Fassungen geändert haben. Der
Angular-MCP (`ng mcp`, Werkzeug `get_best_practices`) liefert sie
versionsgenau; nachgeprüft wurde jede in den ausgelieferten Typdefinitionen
oder über `search_documentation`, denn der MCP ist ein Dokument und kein
Compiler:

- **`changeDetection: OnPush` nicht angeben.** Seit v22 ist `OnPush` die
  Vorgabe. Die ausdrückliche Angabe ist Rauschen.
- **`@Service()` statt `@Injectable({ providedIn: 'root' })`** für neue
  Singleton-Dienste.
- **`standalone: true` nicht setzen** — seit v20 die Vorgabe.
- **Kein `@HostBinding` und `@HostListener`** — Host-Bindungen gehören ins
  `host`-Objekt des Decorators.
- **Signal Forms (`@angular/forms/signals`)** sind seit v22 stabil und laut
  offizieller Empfehlung die erste Wahl für neue Formulare. Dieses Projekt
  nutzt bewusst Reactive Forms (ADR-006); wer das ändert, ändert eine
  Entscheidung und braucht eine ADR.

## Die Gestalt folgt dem Entwurf

`docs/entwurf/` hält Wireframe und Mockup; `03-abgleich.md` sagt, was
übernommen wurde und was der Entwurf zeigt, das es nicht gibt. Wer das
Aussehen ändert, ändert entweder den Entwurf mit oder begründet die
Abweichung. Drei Festlegungen daraus, die nicht aus Geschmack entstanden:

- **Zwei Spalten.** Die Akte ist Kontext und bleibt links stehen, das
  Ergebnis bekommt die Restbreite. Unter 1024 px stapeln sie.
- **Ergebnisblöcke nach Handlungsnähe:** Nachforderungen, Regeln,
  Nachweispflichten, erkannte Belege. Nicht nach Erzeugungsreihenfolge.
- **Ein leerer Block ist eine Zeile mit Zahl**, nie ein Kasten in
  Fehlerform: „12 von 13 ohne Befund", nicht „nichts gefunden". Die Zahl der
  geprüften Regeln steht im Ergebnis und darf nicht verlorengehen.

## Zustand

| Wo | Was |
|---|---|
| ngrx Store (`src/app/akte/`) | Belege (nur Angaben), Stand, Ergebnis, Zeitpunkt, Entwertung, Fehler |
| Reactive Form (`einreichung.ts`) | die Stammdaten. Ein Formular ist schon eine Zustandsverwaltung; zwei übereinander bringen nur Abgleich |
| `BelegSpeicher` | die `File`-Objekte, verbunden über dieselbe Kennung |
| Signals | reine Sichtsachen (ist gerade etwas über der Ablage?) |

**Keine `File` im Store.** `app.config.ts` schaltet
`strictStateSerializability` ein — die Regel bricht, statt zu verblassen.

**Komponenten lesen nur über Selektoren.** Das hält die Tür zu Signals offen
(ADR-006, "Wann wir anders entscheiden würden") und macht den Zustand ohne
Browser prüfbar.

**Aktionen sind Ereignisse, keine Befehle:** `Belege hinzugefuegt`, nicht
`Belege hinzufuegen`.

**Keine Uhr im Reducer.** Der Zeitpunkt der Prüfung kommt mit der Aktion
herein. Ein Reducer, der `new Date()` ruft, ist nicht ohne Vorkehrung
prüfbar — und die offizielle Angular-Empfehlung sagt dasselbe.

**Ein Ergebnis wird entwertet, nicht gelöscht.** Ändern sich die Belege,
bleibt es im Zustand und `veraltet` wird gesetzt; die Oberfläche zeigt, dass
es eine frühere Entscheidung gab und wann.

## Die 422-Falle

Der Workflow antwortet **200 bei freigabereif und 422 bei allem anderen** —
in beiden Fällen mit dem vollständigen Ergebnis. Für den HttpClient ist 422
ein Fehler. `akte.dienst.ts` fängt das ab: 422 mit verwertbarem Körper ist
das Ergebnis, alles andere ein Fehler. Wer das verwechselt, verliert genau
die Befunde, um die es geht. Getestet in `akte.dienst.spec.ts`.

## Farben und Barrierefreiheit

Die Gestaltungstoken in `src/styles.css` erklären ihre Ansprüche selbst:

```css
/* @kontrast --ton-text auf --ton-grund mindestens 7 */
```

`scripts/kontrast-check.mjs` liest diese Anweisungen, rechnet nach WCAG 2.1
nach und ist rot, wenn eine nicht hält — in Hook und CI. Eine neue Farbe
ohne Anweisung ist eine Farbe ohne Zusage.

Dazu, ohne Ausnahme:

- **Farbe trägt nie allein.** Jede Entscheidung steht auch als Text da.
- **Jede Eingabe hat ein `<label for>`**, jede Gruppe ein `fieldset` mit
  `legend`. Ein Test in `einreichung.spec.ts` geht alle Eingaben durch.
- **Der Fokus wandert** nach dem Absenden auf die Überschrift des
  Ergebnisses (`tabindex="-1"`), sonst erfährt niemand, dass unten etwas
  Neues steht.
- **Das Ablegen per Zeigegerät ist die Zugabe**, nie der einzige Weg:
  Darunter liegt ein echtes `input[type=file]`.
- **`npm run e2e`** lässt axe über jede Ansicht laufen — leeres Formular,
  mit Belegen, Ergebnis, Fehlerfall. Das ist die Merge-Bedingung
  (`docs/ARBEITSWEISE.md`, Stufe 2), nicht eine Absicht.

## Prosa im Code

`scripts/prosa-check.mjs` prüft Kommentarzeilen in `.ts`, `.html` und
`.css`. Umlaute gehören als Umlaute geschrieben; ein Bezeichner oder ein
Zustandsname im Kommentar gehört in Backticks (`` `laeuft` ``). Der
Verzeichnisname `oberflaeche` ist als Pfad ausgenommen — die Prosa daneben
schreibt weiterhin "Oberfläche".

## Laufen lassen

```bash
cd oberflaeche && npm ci
npm start                 # Entwicklung; /webhook/ ist dabei nicht erreichbar
npm test                  # Zustand, Dienst, Komponenten
npm run e2e               # axe und Tastatur (braucht einmal npm run e2e:install)
npm run build
```

Im Stack: `docker compose up -d --build --wait`, dann
`http://localhost:8088`. Dort liefert nginx die gebauten Dateien aus und
reicht `/webhook/` an n8n weiter — gleiche Herkunft, deshalb kein CORS
(`deploy/nginx/zollpilot.conf`).

## Wenn ein Feld dazukommt

1. Steuerung in `einreichung.ts` anlegen, mit `Validators`, wenn sie Pflicht ist.
2. In `stammdaten()` abbilden — leere Zeichenkette wird `null`, nicht `''`:
   Das Regelwerk unterscheidet "nicht angegeben" von "angegeben als nichts".
3. Im Formular mit `<label for>` und, wenn nötig, `aria-describedby`.
4. Test in `einreichung.spec.ts` für die Abbildung, nicht für das Aussehen.
5. `npm test && npm run e2e && node scripts/kontrast-check.mjs`.
