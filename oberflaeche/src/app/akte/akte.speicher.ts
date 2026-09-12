// Der Ablageort der Dateien.
//
// `File` ist nicht serialisierbar und gehört deshalb nicht in den Store
// (app.config.ts schaltet `strictStateSerializability` ein, damit diese Regel
// bricht statt zu verblassen). Der Store hält die Angaben zum Beleg, dieser
// Dienst die Datei dazu — verbunden über dieselbe Kennung.

import { Service } from '@angular/core';

import type { Beleg } from './akte.modell';

export const ERLAUBTER_TYP = 'application/pdf';
const ENDUNG = '.pdf';

@Service()
export class BelegSpeicher {
  readonly #dateien = new Map<string, File>();

  /**
   * Nimmt Dateien an und liefert die Angaben dazu. Was kein PDF ist, wird
   * abgelehnt und gemeldet — nicht stillschweigend übergangen.
   */
  annehmen(dateien: readonly File[]): { belege: Beleg[]; abgelehnt: string[] } {
    const belege: Beleg[] = [];
    const abgelehnt: string[] = [];
    for (const datei of dateien) {
      if (datei.type !== ERLAUBTER_TYP && !datei.name.toLowerCase().endsWith(ENDUNG)) {
        abgelehnt.push(datei.name);
        continue;
      }
      const id = crypto.randomUUID();
      this.#dateien.set(id, datei);
      belege.push({ id, name: datei.name, groesse: datei.size });
    }
    return { belege, abgelehnt };
  }

  entfernen(id: string): void {
    this.#dateien.delete(id);
  }

  leeren(): void {
    this.#dateien.clear();
  }

  /** Die Dateien zu einer Liste von Kennungen, in genau dieser Reihenfolge. */
  dateien(ids: readonly string[]): File[] {
    return ids.map((id) => this.#dateien.get(id)).filter((datei): datei is File => datei !== undefined);
  }
}
