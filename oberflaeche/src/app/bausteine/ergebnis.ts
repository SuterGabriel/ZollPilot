// Die Antwort des Prüf-Workflows, lesbar gemacht.
//
// Diese Komponente bewertet nichts. Jeder Satz, den sie zeigt, steht so im
// Ergebnis: die Entscheidung, die Begründung je Regel, die Rechtsgrundlage
// mit ihrem Verifikationsstand, der Adressat jeder Nachforderung. Was hier
// fehlt, fehlt im Regelwerk — nicht in der Darstellung (ADR-006).

import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { Store } from '@ngrx/store';

import { AkteAktionen } from '../akte/akte.aktionen';
import {
  BEFUND_TEXT,
  FREIGABE_TEXT,
  PFLICHT_TEXT,
  RECHTSQUELLE_TEXT,
  type Befundstatus,
  type Dokument,
  type Freigabe,
  type Pflichtbefund,
  type Rechtsquelle,
} from '../akte/akte.modell';
import {
  selectErgebnis,
  selectFehler,
  selectStand,
  waehleDokumente,
  waehleExtraktionshinweise,
  waehleNachforderungen,
  waehleOffeneBefunde,
  waehleOffenePflicht,
} from '../akte/akte.reducer';

@Component({
  selector: 'app-ergebnis',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ergebnis.html',
  styleUrl: './ergebnis.css',
})
export class Ergebnis {
  readonly #store = inject(Store);

  readonly stand = this.#store.selectSignal(selectStand);
  readonly ergebnis = this.#store.selectSignal(selectErgebnis);
  readonly fehler = this.#store.selectSignal(selectFehler);
  readonly offeneBefunde = this.#store.selectSignal(waehleOffeneBefunde);
  readonly offenePflicht = this.#store.selectSignal(waehleOffenePflicht);
  readonly nachforderungen = this.#store.selectSignal(waehleNachforderungen);
  readonly dokumente = this.#store.selectSignal(waehleDokumente);
  readonly extraktionshinweise = this.#store.selectSignal(waehleExtraktionshinweise);

  readonly ueberschrift = viewChild<ElementRef<HTMLElement>>('ueberschrift');

  constructor() {
    // Nach dem Absenden wandert der Fokus auf die Überschrift des
    // Ergebnisses. Ohne das bleibt er auf der Schaltfläche, und wer mit der
    // Tastatur oder einem Bildschirmleser arbeitet, erfährt nicht, dass
    // unten etwas Neues steht.
    effect(() => {
      const stand = this.stand();
      const ziel = this.ueberschrift();
      if (ziel && (stand === 'fertig' || stand === 'fehler')) ziel.nativeElement.focus();
    });
  }

  freigabeText(freigabe: Freigabe): string {
    return FREIGABE_TEXT[freigabe];
  }

  befundText(status: Befundstatus): string {
    return BEFUND_TEXT[status];
  }

  pflichtText(status: Pflichtbefund['status']): string {
    return PFLICHT_TEXT[status];
  }

  rechtsquelleText(status: Rechtsquelle): string {
    return RECHTSQUELLE_TEXT[status];
  }

  /** Wie der Beleg gelesen wurde. Ein Gedankenstrich, wenn gar nicht. */
  methodenText(dokument: Dokument): string {
    return dokument.methoden?.length ? dokument.methoden.join(', ') : '—';
  }

  neuBeginnen(): void {
    this.#store.dispatch(AkteAktionen.neuBegonnen());
  }
}
