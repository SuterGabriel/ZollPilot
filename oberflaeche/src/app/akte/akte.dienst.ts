// Der Transport zum Webhook. Kein Zustand, keine Entscheidung.
//
// Die Adresse ist relativ: Die Oberfläche und `/webhook/` kommen aus
// derselben Herkunft, weil nginx beides ausliefert (ADR-006). Damit gibt es
// kein CORS, und der Browser erfährt die Adresse von n8n nie.

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { type Observable, catchError, of, throwError } from 'rxjs';

import type { Pruefergebnis, Stammdaten, Uebersteuerung } from './akte.modell';

export const WEBHOOK_BELEGE = '/webhook/belege';

/** Der Workflow antwortet 422, wenn die Akte nicht freigabereif ist. */
const NICHT_FREIGABEREIF = 422;

const FELD_AKTE = 'akte';
const FELD_DATEIEN = 'dateien';

@Service()
export class AkteDienst {
  readonly #http = inject(HttpClient);

  /**
   * Die Übersteuerungen reisen im Formularfeld `akte` mit, nicht in einem
   * eigenen.
   * Der Extraktionsdienst reicht alles durch, was er nicht selbst setzt, und
   * das Regelwerk liest sie als Eingabe (ADR-007).
   */
  einreichen(
    stammdaten: Stammdaten,
    dateien: readonly File[],
    uebersteuerungen: readonly Uebersteuerung[] = [],
  ): Observable<Pruefergebnis> {
    const formular = new FormData();
    formular.append(FELD_AKTE, JSON.stringify({ ...stammdaten, overrides: uebersteuerungen }));
    for (const datei of dateien) formular.append(FELD_DATEIEN, datei, datei.name);

    return this.#http.post<Pruefergebnis>(WEBHOOK_BELEGE, formular).pipe(
      catchError((fehler: HttpErrorResponse) => {
        // 422 ist kein Fehler, sondern die Antwort "nicht freigabereif":
        // Der Workflow liefert in beiden Fällen das vollständige Ergebnis
        // (Node-Konventionen im Skill n8n-code-nodes). Wer das als Fehler
        // behandelt, verliert genau die Befunde, um die es geht.
        if (fehler.status === NICHT_FREIGABEREIF && istPruefergebnis(fehler.error)) {
          return of(fehler.error);
        }
        return throwError(() => fehler);
      }),
    );
  }
}

/** Grobe Formprüfung: Genug, um 422-mit-Ergebnis von 422-mit-Fehlertext zu trennen. */
export function istPruefergebnis(wert: unknown): wert is Pruefergebnis {
  if (wert === null || typeof wert !== 'object') return false;
  const kandidat = wert as Partial<Pruefergebnis>;
  return typeof kandidat.freigabe === 'string' && Array.isArray(kandidat.befunde);
}

/** Die Ausführungs-ID aus dem Rumpf einer 500-Antwort, wenn einer da ist. */
function ausfuehrungAus(rumpf: unknown): string | null {
  if (rumpf === null || typeof rumpf !== 'object') return null;
  const wert = (rumpf as { ausfuehrung?: unknown }).ausfuehrung;
  return typeof wert === 'string' || typeof wert === 'number' ? String(wert) : null;
}

/** Eine Meldung, die einem Menschen sagt, was zu tun ist. */
export function fehlermeldung(fehler: unknown): string {
  if (!(fehler instanceof HttpErrorResponse)) {
    return 'Unerwarteter Fehler beim Einreichen.';
  }
  if (fehler.status === 0) {
    return 'Keine Verbindung zum Prüf-Workflow. Läuft der Stack (docker compose up -d --wait)?';
  }
  if (fehler.status === 404) {
    return 'Der Webhook antwortet nicht (404). Ist der Workflow in n8n aktiv?';
  }
  if (fehler.status >= 500) {
    // Der Fehlerzweig des Workflows nennt die Ausführung. Mit ihr findet der
    // Betrieb den Lauf in n8n und die Zeile in `workflow_fehler` — ohne sie
    // bleibt „gescheitert" eine Auskunft, mit der niemand etwas anfangen kann.
    const ausfuehrung = ausfuehrungAus(fehler.error);
    const fundstelle = ausfuehrung ? ` Ausführung ${ausfuehrung}.` : '';
    return `Der Workflow ist gescheitert (${fehler.status}). Die Akte wurde nicht geprüft.${fundstelle} Die Ursache steht in der Tabelle workflow_fehler und in der Ausführung in n8n.`;
  }
  return `Die Einreichung wurde abgelehnt (${fehler.status}).`;
}
