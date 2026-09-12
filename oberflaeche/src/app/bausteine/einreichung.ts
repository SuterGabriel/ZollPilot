// Das Einreichungsformular: Stammdaten der Akte, Belege, absenden.
//
// Die Stammdaten sind kein Zustand im Store, sondern ein Formular in dieser
// Komponente — ein Formular ist bereits eine Zustandsverwaltung, und zwei
// davon übereinander bringen nur Abgleichaufwand. In den Store geht erst,
// was die Einreichung ausmacht (ADR-006).
//
// Die Felder sind fast immer vorbelegt und werden selten angefasst. Deshalb
// steht sichtbar nur eine Zusammenfassung; die Eingabefelder liegen hinter
// „Ändern" (Entwurf, Struktur 1a: die Akte ist Kontext, nicht Aufgabe).
//
// Die Vorbelegung ist die Testakte aus testdaten/belege/happy-path, damit
// eine Vorführung ohne Abtippen möglich ist. Sie ist erfunden
// (docs/DATENSCHUTZ.md).

import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';

import { AkteAktionen } from '../akte/akte.aktionen';
import type { Stammdaten } from '../akte/akte.modell';
import { selectBelege, waehleEinreichbar, waehleLaeuft } from '../akte/akte.reducer';
import { BelegAblage } from './beleg-ablage';

/** Die elf Klauseln der Incoterms 2020 (docs/04-stammdaten-formate.md). */
export const INCOTERMS = ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF'] as const;

export const RICHTUNGEN = [
  { wert: 'export_third_country', text: 'Ausfuhr in ein Drittland' },
  { wert: 'import', text: 'Einfuhr (vom Regelkatalog nicht abgedeckt)' },
] as const;

export const VERKEHRSTRAEGER = [
  { wert: 'sea', text: 'Seefracht' },
  { wert: 'air', text: 'Luftfracht (vom Regelkatalog nicht abgedeckt)' },
  { wert: 'road', text: 'Straße (vom Regelkatalog nicht abgedeckt)' },
] as const;

const INCOTERM_EDITION = 2020;

@Component({
  selector: 'app-einreichung',
  imports: [ReactiveFormsModule, BelegAblage],
  templateUrl: './einreichung.html',
  styleUrl: './einreichung.css',
})
export class Einreichung {
  readonly #store = inject(Store);
  readonly #bauer = inject(FormBuilder);

  readonly incoterms = INCOTERMS;
  readonly richtungen = RICHTUNGEN;
  readonly verkehrstraeger = VERKEHRSTRAEGER;

  readonly einreichbar = this.#store.selectSignal(waehleEinreichbar);
  readonly laeuft = this.#store.selectSignal(waehleLaeuft);
  readonly belege = this.#store.selectSignal(selectBelege);

  readonly formular = this.#bauer.nonNullable.group({
    akte_id: ['ZP-2026-0001', [Validators.required, Validators.maxLength(64)]],
    stichtag: ['2026-09-12', Validators.required],
    richtung: ['export_third_country', Validators.required],
    verkehrstraeger: ['sea', Validators.required],
    praeferenz_beansprucht: [true],
    incoterm_code: ['FOB', Validators.required],
    incoterm_ort: ['Hamburg', Validators.required],
    incoterm_unlocode: ['DEHAM'],
    pol: ['DEHAM'],
    pod: ['SGSIN'],
    warennummern: ['84133080, 84842000'],
  });

  /** Die Formularwerte als Signal, damit die Zusammenfassung mitläuft. */
  readonly werte = toSignal(this.formular.valueChanges, { initialValue: this.formular.getRawValue() });

  /** Was in der eingeklappten Ansicht steht — Bezeichnung und Wert. */
  readonly zusammenfassung = computed(() => {
    const w = this.formular.getRawValue();
    // Auf `werte()` zugreifen, damit das Signal die Neuberechnung auslöst;
    // gelesen wird der Rohwert, weil `valueChanges` gesperrte Felder auslässt.
    this.werte();
    const richtung = RICHTUNGEN.find((r) => r.wert === w.richtung)?.text ?? w.richtung;
    const traeger = VERKEHRSTRAEGER.find((v) => v.wert === w.verkehrstraeger)?.text ?? w.verkehrstraeger;
    return [
      { name: 'Akten-Nummer', wert: w.akte_id, fest: true },
      { name: 'Stichtag', wert: w.stichtag, fest: false },
      { name: 'Richtung', wert: richtung, fest: false },
      { name: 'Verkehrsträger', wert: traeger, fest: false },
      { name: 'Präferenz', wert: w.praeferenz_beansprucht ? 'wird beansprucht' : 'nicht beansprucht', fest: false },
      { name: 'Klausel', wert: `${w.incoterm_code} · ${w.incoterm_ort}`, fest: false },
      { name: 'UN/LOCODE', wert: w.incoterm_unlocode || '—', fest: true },
      { name: 'Häfen', wert: `${w.pol || '—'} → ${w.pod || '—'}`, fest: true },
      { name: 'Warennummern', wert: w.warennummern || '—', fest: true },
    ];
  });

  /** Baut aus dem Formular den Datensatz, den der Webhook erwartet. */
  stammdaten(): Stammdaten {
    const werte = this.formular.getRawValue();
    return {
      akte_id: werte.akte_id.trim(),
      stichtag: werte.stichtag,
      sachverhalt: {
        richtung: werte.richtung,
        verkehrstraeger: werte.verkehrstraeger,
        praeferenz_beansprucht: werte.praeferenz_beansprucht,
        incoterm: {
          code: werte.incoterm_code,
          named_place: werte.incoterm_ort.trim(),
          named_place_unlocode: werte.incoterm_unlocode.trim().toUpperCase() || null,
          edition: INCOTERM_EDITION,
        },
        route: {
          pol: werte.pol.trim().toUpperCase() || null,
          pod: werte.pod.trim().toUpperCase() || null,
        },
      },
      anmeldung: {
        richtung: werte.richtung === 'export_third_country' ? 'export' : werte.richtung,
        warennummern: werte.warennummern
          .split(',')
          .map((nummer) => nummer.trim())
          .filter((nummer) => nummer.length > 0),
      },
    };
  }

  absenden(): void {
    if (!this.einreichbar() || this.formular.invalid) {
      this.formular.markAllAsTouched();
      return;
    }
    this.#store.dispatch(AkteAktionen.eingereicht({ stammdaten: this.stammdaten() }));
  }

  /** Warum das Absenden gesperrt ist — als Text, nicht nur als grauer Knopf. */
  sperrgrund(): string | null {
    if (this.laeuft()) return 'Die Akte wird gerade geprüft.';
    if (this.belege().length === 0) return 'Mindestens ein Beleg wird gebraucht.';
    return null;
  }

  fehlerhaft(feld: string): boolean {
    const steuerung = this.formular.get(feld);
    return Boolean(steuerung && steuerung.invalid && steuerung.touched);
  }
}
