// Wer angemeldet ist, weiß der Proxy, nicht die Oberfläche (ADR-009).
//
// nginx verlangt die Anmeldung und liefert unter `/wer` den geprüften
// Benutzernamen im Antwortkopf `X-Benutzer`. Die Oberfläche zeigt ihn und
// setzt ihn beim Übersteuern als Vorgabe; ersetzt wird der getippte Name
// ohnehin vom Proxy, bevor n8n ihn sieht. Ohne Proxy (Entwicklung, Tests)
// antwortet niemand, und das ist dann kein Fehler, sondern der Zustand
// „nicht angemeldet“.

import { HttpClient } from '@angular/common/http';
import { Service, inject, signal } from '@angular/core';

export const PFAD_WER = '/wer';
export const KOPF_BENUTZER = 'X-Benutzer';

@Service()
export class AnmeldungDienst {
  readonly #http = inject(HttpClient);

  /** Der geprüfte Name, oder `null`, wenn keiner da ist. */
  readonly benutzer = signal<string | null>(null);
  /** Ob die Frage gestellt und beantwortet wurde, so oder so. */
  readonly geprueft = signal(false);

  laden(): void {
    this.#http.get(PFAD_WER, { observe: 'response', responseType: 'blob' }).subscribe({
      next: (antwort) => {
        const name = antwort.headers.get(KOPF_BENUTZER)?.trim() ?? '';
        this.benutzer.set(name.length > 0 ? name : null);
        this.geprueft.set(true);
      },
      error: () => {
        this.benutzer.set(null);
        this.geprueft.set(true);
      },
    });
  }
}
