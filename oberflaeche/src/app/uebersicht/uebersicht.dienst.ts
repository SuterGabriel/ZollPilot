// Der Transport für die Übersicht: ein GET, kein Zustand, keine Entscheidung.
// Dieselbe Herkunft wie alles (ADR-006): nginx reicht /webhook/ an n8n.

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type { Uebersicht } from './uebersicht.modell';

export const WEBHOOK_AKTEN = '/webhook/akten';

@Service()
export class UebersichtDienst {
  readonly #http = inject(HttpClient);

  laden(): Observable<Uebersicht> {
    return this.#http.get<Uebersicht>(WEBHOOK_AKTEN);
  }
}

/** Eine Meldung, die sagt, was zu tun ist; keine Statuszahl ohne Satz. */
export function uebersichtFehlermeldung(fehler: unknown): string {
  if (!(fehler instanceof HttpErrorResponse)) return 'Unerwarteter Fehler beim Laden der Übersicht.';
  if (fehler.status === 0) return 'Keine Verbindung zum Workflow. Läuft der Stack (docker compose up -d --wait)?';
  if (fehler.status === 404) return 'Der Webhook /webhook/akten antwortet nicht (404). Ist der Workflow „Übersicht lesen“ in n8n aktiv?';
  if (fehler.status === 401) return 'Nicht angemeldet. Die Übersicht liegt hinter der Anmeldung des Proxys.';
  return `Die Übersicht konnte nicht geladen werden (${fehler.status}).`;
}
