// Das Ergebnis: Jeder Befund muss mit Begründung und Rechtsgrundlage
// ankommen, und der Fokus muss nach dem Absenden dorthin wandern.

import { TestBed } from '@angular/core/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { describe, expect, it } from 'vitest';

import { akteFeature, anfangszustand, type AkteZustand } from '../akte/akte.reducer';
import { ERGEBNIS_BLOCKIERT, ERGEBNIS_FREI } from '../akte/testhilfen';
import { Ergebnis } from './ergebnis';

function baue(zustand: Partial<AkteZustand>) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [Ergebnis],
    providers: [provideMockStore({ initialState: { [akteFeature.name]: { ...anfangszustand, ...zustand } } })],
  });
  const fixture = TestBed.createComponent(Ergebnis);
  fixture.detectChanges();
  return fixture;
}

describe('Ergebnis', () => {
  it('zeigt vor dem Absenden nichts', () => {
    expect((baue({}).nativeElement as HTMLElement).textContent?.trim()).toBe('');
  });

  it('nennt die Entscheidung als Text, nicht nur als Farbe', () => {
    const text = (baue({ stand: 'fertig', ergebnis: ERGEBNIS_BLOCKIERT }).nativeElement as HTMLElement).textContent;
    expect(text).toContain('Blockiert');
    expect(text).toContain('Katalog 0.1.0');
  });

  it('zeigt jeden offenen Befund mit Begründung, Konsequenz und Verifikationsstand', () => {
    const text = (baue({ stand: 'fertig', ergebnis: ERGEBNIS_BLOCKIERT }).nativeElement as HTMLElement).textContent;
    expect(text).toContain('TRN-01');
    expect(text).toContain('B/L nennt HLXU8765430, Packliste MSKU1234565');
    expect(text).toContain('Bezeichnet ggf. eine andere physische Sendung');
    // Keine Regel trägt heute `verified` — das muss sichtbar sein.
    expect(text).toContain('Praxisannahme');
    expect(text).toContain('0.1.0@2026-09-12');
  });

  it('nennt Adressat und Folge jeder Nachforderung', () => {
    const text = (baue({ stand: 'fertig', ergebnis: ERGEBNIS_BLOCKIERT }).nativeElement as HTMLElement).textContent;
    expect(text).toContain('Seefrachtspediteur/Carrier');
    expect(text).toContain('bill_of_lading.container_id');
    expect(text).toContain('Keine Freigabe');
  });

  it('meldet einen nicht erkannten Beleg, statt ihn zu verschweigen', () => {
    const text = (baue({ stand: 'fertig', ergebnis: ERGEBNIS_BLOCKIERT }).nativeElement as HTMLElement).textContent;
    expect(text).toContain('UNK-1');
    expect(text).toContain('unclassified');
    expect(text).toContain('lieferschein.pdf: Belegtyp nicht erkannt');
  });

  it('sagt bei einer freigabereifen Akte, dass nichts offen ist', () => {
    const text = (baue({ stand: 'fertig', ergebnis: ERGEBNIS_FREI }).nativeElement as HTMLElement).textContent;
    expect(text).toContain('Freigabereif');
    expect(text).toContain('Keine Regel ist verletzt');
    expect(text).toContain('Nichts nachzufordern');
  });

  it('zeigt einen Transportfehler als Fehler, nicht als Ergebnis', () => {
    const element = baue({ stand: 'fehler', fehler: 'Keine Verbindung zum Prüf-Workflow.' })
      .nativeElement as HTMLElement;
    expect(element.textContent).toContain('Einreichung gescheitert');
    expect(element.querySelector('[role=alert]')?.textContent).toContain('Keine Verbindung');
  });

  it('setzt den Fokus auf die Überschrift, sobald ein Ergebnis da ist', () => {
    const fixture = baue({ stand: 'fertig', ergebnis: ERGEBNIS_FREI });
    const ueberschrift = (fixture.nativeElement as HTMLElement).querySelector('h2');
    expect(ueberschrift?.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(ueberschrift);
  });
});
