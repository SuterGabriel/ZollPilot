// Die Antwort des Prüf-Workflows, lesbar gemacht.
//
// Diese Komponente bewertet nichts. Jeder Satz, den sie zeigt, steht so im
// Ergebnis: die Entscheidung, die Begründung je Regel, die Rechtsgrundlage
// mit ihrem Verifikationsstand, der Adressat jeder Nachforderung. Was hier
// fehlt, fehlt im Regelwerk — nicht in der Darstellung (ADR-006).
//
// Die Anordnung folgt dem Entwurf (docs/entwurf/, Struktur 1a): nach
// Handlungsnähe, nicht nach Erzeugungsreihenfolge. Zuerst, was zu tun ist.

import { Component, type ElementRef, effect, inject, signal, viewChild } from '@angular/core';
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
  type Nachforderung,
  type Pflichtbefund,
  type Rechtsquelle,
} from '../akte/akte.modell';
import {
  selectFehler,
  selectStand,
  waehleDokumente,
  waehleEntwertet,
  waehleErfuelltePflicht,
  waehleExtraktionshinweise,
  selectGepruefetAm,
  waehleGueltigesErgebnis,
  waehleMehrereAdressaten,
  waehleNachforderungen,
  waehleNachforderungenNachAdressat,
  waehleOffeneBefunde,
  waehleOffenePflicht,
  waehlePflichtBilanz,
  waehleRegelBilanz,
  waehleFreigabeUnterschied,
  waehleUebersteuerteBefunde,
  waehleVerbrauchteUebersteuerungen,
} from '../akte/akte.reducer';
import { Uebersteuerung } from './uebersteuerung';

const ZEITFORM: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

/** Wie lange die Rückmeldung nach dem Kopieren stehen bleibt. */
const KOPIERT_MS = 4000;

@Component({
  selector: 'app-ergebnis',
  imports: [Uebersteuerung],
  templateUrl: './ergebnis.html',
  styleUrl: './ergebnis.css',
})
export class Ergebnis {
  readonly #store = inject(Store);

  readonly stand = this.#store.selectSignal(selectStand);
  readonly ergebnis = this.#store.selectSignal(waehleGueltigesErgebnis);
  readonly entwertet = this.#store.selectSignal(waehleEntwertet);
  readonly gepruefetAm = this.#store.selectSignal(selectGepruefetAm);
  readonly fehler = this.#store.selectSignal(selectFehler);

  readonly offeneBefunde = this.#store.selectSignal(waehleOffeneBefunde);
  readonly offenePflicht = this.#store.selectSignal(waehleOffenePflicht);
  readonly erfuelltePflicht = this.#store.selectSignal(waehleErfuelltePflicht);
  readonly regelBilanz = this.#store.selectSignal(waehleRegelBilanz);
  readonly pflichtBilanz = this.#store.selectSignal(waehlePflichtBilanz);
  readonly nachforderungen = this.#store.selectSignal(waehleNachforderungen);
  readonly gruppen = this.#store.selectSignal(waehleNachforderungenNachAdressat);
  readonly mehrereAdressaten = this.#store.selectSignal(waehleMehrereAdressaten);
  readonly dokumente = this.#store.selectSignal(waehleDokumente);
  readonly extraktionshinweise = this.#store.selectSignal(waehleExtraktionshinweise);
  readonly freigabeUnterschied = this.#store.selectSignal(waehleFreigabeUnterschied);
  readonly uebersteuerteBefunde = this.#store.selectSignal(waehleUebersteuerteBefunde);
  readonly verbrauchteUebersteuerungen = this.#store.selectSignal(waehleVerbrauchteUebersteuerungen);

  /** Kennung der zuletzt kopierten Nachforderung, für die Rückmeldung. */
  readonly kopiert = signal<string | null>(null);

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

  zeitText(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('de-DE', ZEITFORM);
  }

  /** Eine stabile Kennung je Nachforderung — Anlass und Feld zusammen. */
  kennung(fall: Nachforderung): string {
    return `${fall.grund}:${fall.feld}`;
  }

  async kopieren(fall: Nachforderung): Promise<void> {
    try {
      await navigator.clipboard.writeText(fall.text);
      this.kopiert.set(this.kennung(fall));
      setTimeout(() => this.kopiert.set(null), KOPIERT_MS);
    } catch {
      // Kein Zugriff auf die Zwischenablage (kein sicherer Kontext, keine
      // Erlaubnis). Der Text steht ohnehin sichtbar da und lässt sich von
      // Hand markieren — deshalb kein Fehlerzustand, nur keine Rückmeldung.
      this.kopiert.set(null);
    }
  }

  /**
   * Öffnet den Mailclient mit Betreff und Text.
   *
   * Ohne Empfänger: Der Adressat ist eine Rolle („Exporteur/Lieferant"),
   * kein Postfach. Rolle zu Verteiler ist Stammdatenpflege, die es nicht
   * gibt (docs/BETRIEB.md) — deshalb steht die Rolle im Text, und die
   * Adresse setzt ein Mensch.
   */
  mailto(fall: Nachforderung): string {
    return `mailto:?subject=${encodeURIComponent(fall.betreff)}&body=${encodeURIComponent(fall.text)}`;
  }

  neuBeginnen(): void {
    this.#store.dispatch(AkteAktionen.neuBegonnen());
  }
}
