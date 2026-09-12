// Die Ablage für Belege: Dateiauswahl und Ablegen per Zeigegerät.
//
// Das Ablegen ist die bequeme Zugabe, nie der einzige Weg: Darunter liegt ein
// echtes `input[type=file]` mit Beschriftung, das mit der Tastatur bedienbar
// ist. Was kein PDF ist, wird abgelehnt und genannt.

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Store } from '@ngrx/store';

import { AkteAktionen } from '../akte/akte.aktionen';
import { selectAbgelehnt, selectBelege } from '../akte/akte.reducer';
import { BelegSpeicher } from '../akte/akte.speicher';

const BYTE_JE_KILOBYTE = 1024;

@Component({
  selector: 'app-beleg-ablage',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './beleg-ablage.html',
  styleUrl: './beleg-ablage.css',
})
export class BelegAblage {
  readonly #store = inject(Store);
  readonly #speicher = inject(BelegSpeicher);

  readonly belege = this.#store.selectSignal(selectBelege);
  readonly abgelehnt = this.#store.selectSignal(selectAbgelehnt);
  readonly ueberAblage = signal(false);
  readonly anzahl = computed(() => this.belege().length);

  aufnehmen(dateien: FileList | null): void {
    if (!dateien || dateien.length === 0) return;
    const { belege, abgelehnt } = this.#speicher.annehmen([...dateien]);
    if (belege.length > 0) this.#store.dispatch(AkteAktionen.belegeHinzugefuegt({ belege }));
    if (abgelehnt.length > 0) this.#store.dispatch(AkteAktionen.belegeAbgelehnt({ namen: abgelehnt }));
  }

  ausDateifeld(ereignis: Event): void {
    const feld = ereignis.target as HTMLInputElement;
    this.aufnehmen(feld.files);
    // Zurücksetzen, damit dieselbe Datei erneut gewählt werden kann.
    feld.value = '';
  }

  abgelegt(ereignis: DragEvent): void {
    ereignis.preventDefault();
    this.ueberAblage.set(false);
    this.aufnehmen(ereignis.dataTransfer?.files ?? null);
  }

  darueber(ereignis: DragEvent, darueber: boolean): void {
    ereignis.preventDefault();
    this.ueberAblage.set(darueber);
  }

  entfernen(id: string): void {
    this.#speicher.entfernen(id);
    this.#store.dispatch(AkteAktionen.belegEntfernt({ id }));
  }

  kilobyte(groesse: number): string {
    return `${Math.max(1, Math.round(groesse / BYTE_JE_KILOBYTE))} kB`;
  }
}
