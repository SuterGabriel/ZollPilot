// Der zweite Bildschirm: was offen ist (docs/entwurf/04-uebersicht.md).
//
// Diese Komponente bewertet nichts. Die Entscheidung je Akte ist das Wort,
// das der Prüf-Workflow abgelegt hat; die Stufe ist die, die der
// Nachforderungs-Workflow zuletzt versandt hat; der Grund einer
// unzugeordneten Mail kommt wörtlich aus dem Posteingang. Sie zählt nicht
// einmal selbst: Die Bilanz kommt aus der Abfrage.

import { Component, computed, inject } from '@angular/core';
import { Store } from '@ngrx/store';

import { FREIGABE_TEXT, type Freigabe } from '../akte/akte.modell';
import { UebersichtAktionen } from '../uebersicht/uebersicht.aktionen';
import {
  selectUebersichtFehler,
  selectUebersichtGeladenAm,
  selectUebersichtStand,
  waehleAkten,
  waehleUebersichtLaeuft,
  waehleUnzugeordnet,
  waehleZusammenfassung,
} from '../uebersicht/uebersicht.reducer';

const ZEITFORM: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

@Component({
  selector: 'app-uebersicht',
  templateUrl: './uebersicht.html',
  styleUrl: './uebersicht.css',
})
export class Uebersicht {
  readonly #store = inject(Store);

  readonly stand = this.#store.selectSignal(selectUebersichtStand);
  readonly laeuft = this.#store.selectSignal(waehleUebersichtLaeuft);
  readonly fehler = this.#store.selectSignal(selectUebersichtFehler);
  readonly geladenAm = this.#store.selectSignal(selectUebersichtGeladenAm);
  readonly akten = this.#store.selectSignal(waehleAkten);
  readonly unzugeordnet = this.#store.selectSignal(waehleUnzugeordnet);
  readonly zusammenfassung = this.#store.selectSignal(waehleZusammenfassung);

  /** Was neben der Schaltfläche steht: lädt, geladen um, oder nichts. */
  readonly standText = computed(() => {
    if (this.laeuft()) return 'Lädt …';
    const wann = this.geladenAm();
    return wann ? `Stand ${this.zeitText(wann)}` : '';
  });

  constructor() {
    this.laden();
  }

  laden(): void {
    this.#store.dispatch(UebersichtAktionen.ladenAngefordert());
  }

  /** Das Wort des Regelwerks; ein unbekannter Stand bleibt, wie er ist. */
  freigabeText(status: string): string {
    return FREIGABE_TEXT[status as Freigabe] ?? status;
  }

  stufeText(stufe: string | null): string {
    return stufe ?? 'noch nichts versandt';
  }

  zeitText(iso: string | null): string {
    if (!iso) return '';
    const datum = new Date(iso);
    return Number.isNaN(datum.getTime()) ? iso : datum.toLocaleString('de-CH', ZEITFORM);
  }
}
