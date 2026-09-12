// Ein Mensch verantwortet einen Befund (ADR-007).
//
// Diese Komponente entscheidet nichts. Sie nimmt einen Namen und eine
// Begründung entgegen, gibt beides dem Regelwerk und zeigt danach, was
// zurückkam. Der Befund daneben behält seinen Status: Ein übersteuerter
// Befund verschwindet nicht, er bekommt eine Unterschrift.
//
// Das Namensfeld ist keine Anmeldung. Es steht so in ADR-007, und es steht
// auch auf dem Bildschirm: Wer einen fremden Namen einträgt, wird dabei von
// nichts gehindert. Das zu verschweigen wäre schlimmer als die Schwäche.

import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';

import { AkteAktionen } from '../akte/akte.aktionen';
import { MINDESTLAENGE_BEGRUENDUNG, type Uebersteuert } from '../akte/akte.modell';
import { waehleLaeuft, waehleLetzterBenutzer } from '../akte/akte.reducer';
import { AnmeldungDienst } from '../anmeldung/anmeldung.dienst';

const ZEITFORM: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

@Component({
  selector: 'app-uebersteuerung',
  imports: [FormsModule],
  templateUrl: './uebersteuerung.html',
  styleUrl: './uebersteuerung.css',
})
export class Uebersteuerung {
  readonly #store = inject(Store);

  /** Regel- oder Pflichtmatrix-Kennung, an die die Entscheidung haftet. */
  readonly kennung = input.required<string>();
  /** Die Fassung, gegen die entschieden wird. Ändert sie sich, ist die Entscheidung verbraucht. */
  readonly fassung = input.required<string>();
  /** Was am Befund bereits steht, wenn ihn jemand verantwortet hat. */
  readonly befund = input.required<Uebersteuert>();

  readonly mindestlaenge = MINDESTLAENGE_BEGRUENDUNG;
  readonly laeuft = this.#store.selectSignal(waehleLaeuft);

  readonly offen = signal(false);
  readonly benutzer = signal('');
  readonly begruendung = signal('');

  readonly #letzterBenutzer = this.#store.selectSignal(waehleLetzterBenutzer);
  readonly #anmeldung = inject(AnmeldungDienst);

  /** Der geprüfte Name vom Proxy (ADR-009), wenn es einen gibt. */
  readonly angemeldet = this.#anmeldung.benutzer;

  readonly verantwortet = computed(() => this.befund().uebersteuert_von ?? null);
  readonly verbraucht = computed(() => this.befund().uebersteuerung_verbraucht ?? []);

  /**
   * Warum das Absenden gesperrt ist, oder `null`, wenn es nicht gesperrt
   * ist. Ein Grund statt einer stummen Sperre: Sonst sitzt jemand vor einer
   * toten Schaltfläche.
   */
  readonly grundDerSperre = computed(() => {
    if (this.laeuft()) return 'Die Prüfung läuft noch.';
    if (!this.benutzer().trim()) return 'Ohne Namen keine Übersteuerung.';
    if (this.begruendung().trim().length < this.mindestlaenge) {
      return `Die Begründung braucht mindestens ${this.mindestlaenge} Zeichen.`;
    }
    return null;
  });

  oeffnen(): void {
    // Vorgabe ist der geprüfte Name, sonst der zuletzt getippte. Hinter dem
    // Proxy ersetzt der geprüfte Name das Feld ohnehin; die Vorgabe zeigt es.
    this.benutzer.set(this.#anmeldung.benutzer() ?? this.#letzterBenutzer());
    this.begruendung.set('');
    this.offen.set(true);
  }

  schliessen(): void {
    this.offen.set(false);
  }

  uebersteuern(): void {
    if (this.grundDerSperre()) return;
    this.#store.dispatch(
      AkteAktionen.befundUebersteuert({
        uebersteuerung: {
          regel: this.kennung(),
          fassung: this.fassung(),
          benutzer: this.benutzer().trim(),
          begruendung: this.begruendung().trim(),
          erzeugt_am: new Date().toISOString(),
        },
      }),
    );
    this.offen.set(false);
  }

  zuruecknehmen(): void {
    this.#store.dispatch(AkteAktionen.uebersteuerungZurueckgenommen({ regel: this.kennung() }));
  }

  zeitText(iso: string | null | undefined): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('de-DE', ZEITFORM);
  }
}
