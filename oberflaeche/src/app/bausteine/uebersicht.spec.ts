// Die Übersicht zeigt, was geladen wurde, wörtlich; sie rechnet nicht.

import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { describe, expect, it } from 'vitest';

import { UEBERSICHT, UEBERSICHT_LEER } from '../uebersicht/testhilfen';
import { UebersichtAktionen } from '../uebersicht/uebersicht.aktionen';
import { uebersichtAnfang, uebersichtFeature, type UebersichtZustand } from '../uebersicht/uebersicht.reducer';
import { Uebersicht } from './uebersicht';

function baue(zustand: Partial<UebersichtZustand>) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [Uebersicht],
    providers: [provideMockStore({ initialState: { [uebersichtFeature.name]: { ...uebersichtAnfang, ...zustand } } })],
  });
  const fixture = TestBed.createComponent(Uebersicht);
  fixture.detectChanges();
  return fixture;
}

const text = (fixture: ReturnType<typeof baue>) => (fixture.nativeElement as HTMLElement).textContent ?? '';

describe('Übersicht', () => {
  it('fordert beim Erscheinen das Laden an', () => {
    const fixture = baue({});
    const store = TestBed.inject(MockStore);
    const gesendet: unknown[] = [];
    store.scannedActions$.subscribe((a) => gesendet.push(a));
    fixture.componentInstance.laden();
    expect(gesendet).toContainEqual(UebersichtAktionen.ladenAngefordert());
  });

  it('zeigt Bilanz, Akten und unzugeordnete Post so, wie sie geliefert wurden', () => {
    const inhalt = text(baue({ stand: 'fertig', daten: UEBERSICHT, geladenAm: '2026-09-12T16:00:00.000Z' }));
    expect(inhalt).toContain('ZP-2026-0002');
    expect(inhalt).toContain('Blockiert');
    expect(inhalt).toContain('erinnerung_1');
    expect(inhalt).toContain('Frage ohne Aktennummer');
    expect(inhalt).toContain('keine Aktennummer in Betreff oder Text');
    expect(inhalt).toContain('Stand ');
  });

  it('nennt die Entscheidung als Wort des Regelwerks, mit Klasse als Zugabe', () => {
    const fixture = baue({ stand: 'fertig', daten: UEBERSICHT, geladenAm: '2026-09-12T16:00:00.000Z' });
    const staende = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('td .stand')).map((e) => e.className);
    expect(staende).toEqual(['stand stand-blockiert', 'stand stand-freigabereif']);
  });

  it('leer heißt: noch keine Akte, keine Post; ein Fehler heißt: nicht bekannt', () => {
    const leer = text(baue({ stand: 'fertig', daten: UEBERSICHT_LEER, geladenAm: '2026-09-12T16:00:00.000Z' }));
    expect(leer).toContain('Noch keine Akte geprüft.');
    expect(leer).toContain('Keine Post ohne Akte.');
    const fehler = baue({ stand: 'fehler', fehler: 'Keine Verbindung zum Workflow.' });
    expect((fehler.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toContain('Keine Verbindung');
    expect(text(fehler)).toContain('Nicht bekannt, weil das Laden gescheitert ist.');
  });

  it('während des Ladens ist die Schaltfläche gesperrt', () => {
    const fixture = baue({ stand: 'laeuft' });
    const knopf = (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement;
    expect(knopf.disabled).toBe(true);
    expect(text(fixture)).toContain('Lädt');
  });
});
