// Was ein Mensch hier tut, muss nachvollziehbar sein und darf den Befund
// nicht verändern (ADR-007). Die Tests prüfen beides: was auf dem Schirm
// steht und welche Aktion den Store erreicht.

import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { describe, expect, it, vi } from 'vitest';

import { AkteAktionen } from '../akte/akte.aktionen';
import { MINDESTLAENGE_BEGRUENDUNG, type Uebersteuert } from '../akte/akte.modell';
import { akteFeature, anfangszustand, type AkteZustand } from '../akte/akte.reducer';
import { Uebersteuerung } from './uebersteuerung';

function baue(befund: Uebersteuert, zustand: Partial<AkteZustand> = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [Uebersteuerung],
    providers: [
      provideMockStore({ initialState: { [akteFeature.name]: { ...anfangszustand, ...zustand } } }),
      provideHttpClient(),
      provideHttpClientTesting(),
    ],
  });
  const fixture = TestBed.createComponent(Uebersteuerung);
  fixture.componentRef.setInput('kennung', 'TRN-01');
  fixture.componentRef.setInput('fassung', '0.1.0@2026-09-12');
  fixture.componentRef.setInput('befund', befund);
  fixture.detectChanges();
  return fixture;
}

const text = (fixture: ReturnType<typeof baue>) => (fixture.nativeElement as HTMLElement).textContent ?? '';

describe('Uebersteuerung', () => {
  /** Der Store bleibt echt; nur das Versenden wird beobachtet. */
  function spion() {
    return vi.spyOn(TestBed.inject(MockStore), 'dispatch');
  }

  it('bietet ohne vorhandene Entscheidung nur das Übersteuern an', () => {
    const inhalt = text(baue({}));
    expect(inhalt).toContain('Übersteuern');
    expect(inhalt).not.toContain('Verantwortet von');
  });

  it('nennt das Namensfeld als das, was es ist: keine Anmeldung', () => {
    const fixture = baue({});
    fixture.componentInstance.oeffnen();
    fixture.detectChanges();
    expect(text(fixture)).toContain('keine Anmeldung');
  });

  it('sperrt das Absenden mit Grund, solange Name oder Begründung fehlen', () => {
    const fixture = baue({});
    const komponente = fixture.componentInstance;
    komponente.oeffnen();
    fixture.detectChanges();
    expect(komponente.grundDerSperre()).toContain('Ohne Namen');

    komponente.benutzer.set('G. Suter');
    expect(komponente.grundDerSperre()).toContain(String(MINDESTLAENGE_BEGRUENDUNG));

    komponente.begruendung.set('x'.repeat(MINDESTLAENGE_BEGRUENDUNG));
    expect(komponente.grundDerSperre()).toBeNull();
  });

  it('sendet nichts, solange die Sperre steht', () => {
    const fixture = baue({});
    const versandt = spion();
    fixture.componentInstance.oeffnen();
    fixture.componentInstance.uebersteuern();
    expect(versandt).not.toHaveBeenCalled();
  });

  it('schickt Kennung, Fassung, Name und Begründung an den Store', () => {
    const fixture = baue({});
    const versandt = spion();
    const komponente = fixture.componentInstance;
    komponente.oeffnen();
    komponente.benutzer.set('  G. Suter  ');
    komponente.begruendung.set('  Reederei hat den Umlad bestätigt  ');
    komponente.uebersteuern();

    expect(versandt).toHaveBeenCalledTimes(1);
    const aktion = versandt.mock.calls[0][0] as unknown as ReturnType<typeof AkteAktionen.befundUebersteuert>;
    expect(aktion.type).toBe(AkteAktionen.befundUebersteuert.type);
    expect(aktion.uebersteuerung.regel).toBe('TRN-01');
    expect(aktion.uebersteuerung.fassung).toBe('0.1.0@2026-09-12');
    expect(aktion.uebersteuerung.benutzer).toBe('G. Suter');
    expect(aktion.uebersteuerung.begruendung).toBe('Reederei hat den Umlad bestätigt');
    expect(komponente.offen()).toBe(false);
  });

  it('zeigt eine vorhandene Entscheidung mit Name, Zeit und Begründung', () => {
    const inhalt = text(
      baue({
        uebersteuert_von: 'G. Suter',
        uebersteuert_am: '2026-09-12T10:00:00Z',
        uebersteuerungsgrund: 'Reederei hat den Umlad bestätigt',
      }),
    );
    expect(inhalt).toContain('Verantwortet von G. Suter');
    expect(inhalt).toContain('Reederei hat den Umlad bestätigt');
    // Der Satz, der die ganze ADR trägt.
    expect(inhalt).toContain('Der Befund bleibt bestehen');
  });

  it('lässt eine Entscheidung zurücknehmen', () => {
    const fixture = baue({ uebersteuert_von: 'G. Suter', uebersteuerungsgrund: 'Grund genug hier' });
    const versandt = spion();
    fixture.componentInstance.zuruecknehmen();
    expect(versandt).toHaveBeenCalledWith(AkteAktionen.uebersteuerungZurueckgenommen({ regel: 'TRN-01' }));
  });

  it('meldet eine verbrauchte Entscheidung, statt sie zu verschweigen', () => {
    const inhalt = text(
      baue({
        uebersteuerung_verbraucht: [
          { benutzer: 'G. Suter', fassung: '0.0.9@2026-01-01', erzeugt_am: '2026-01-02T08:00:00Z' },
        ],
      }),
    );
    expect(inhalt).toContain('Verbraucht');
    expect(inhalt).toContain('0.0.9@2026-01-01');
    // Und die Möglichkeit, neu zu entscheiden, bleibt bestehen.
    expect(inhalt).toContain('Übersteuern');
  });

  it('belegt den Namen mit dem zuletzt verwendeten vor', () => {
    const fixture = baue(
      {},
      {
        uebersteuerungen: [
          {
            regel: 'VAL-01',
            fassung: '0.1.0@2026-09-12',
            benutzer: 'G. Suter',
            begruendung: 'Beleg liegt der Zollstelle vor',
            erzeugt_am: '2026-09-12T09:00:00Z',
          },
        ],
      },
    );
    fixture.componentInstance.oeffnen();
    expect(fixture.componentInstance.benutzer()).toBe('G. Suter');
    // Die Begründung wird nicht übernommen: Sie gehört zu genau einem Befund.
    expect(fixture.componentInstance.begruendung()).toBe('');
  });
});
