// Der Effect: Er liest die Belege aus dem Zustand, gibt sie dem Dienst und
// macht aus der Antwort genau eine Aktion — nie eine Entscheidung.

import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AkteAktionen } from './akte.aktionen';
import { AkteDienst } from './akte.dienst';
import { einreichen } from './akte.effekte';
import { akteFeature } from './akte.reducer';
import { BelegSpeicher } from './akte.speicher';
import { ERGEBNIS_BLOCKIERT, STAMMDATEN, datei } from './testhilfen';

function baueUmgebung(aktionen$: Observable<unknown>, dienstAntwort: Observable<unknown>) {
  const einreichenSpion = vi.fn().mockReturnValue(dienstAntwort);
  const speicher = new BelegSpeicher();
  const angenommen = speicher.annehmen([datei('rechnung.pdf'), datei('packliste.pdf')]);

  TestBed.configureTestingModule({
    providers: [
      provideMockActions(() => aktionen$ as Observable<never>),
      provideMockStore({
        initialState: { [akteFeature.name]: { belege: angenommen.belege, abgelehnt: [], stand: 'laeuft', ergebnis: null, fehler: null } },
      }),
      { provide: AkteDienst, useValue: { einreichen: einreichenSpion } },
      { provide: BelegSpeicher, useValue: speicher },
    ],
  });

  return { einreichenSpion, ids: angenommen.belege.map((b) => b.id) };
}

describe('einreichen', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('gibt dem Dienst die Stammdaten und die Dateien aus dem Speicher', async () => {
    const aktionen$ = of(AkteAktionen.eingereicht({ stammdaten: STAMMDATEN }));
    const { einreichenSpion } = baueUmgebung(aktionen$, of(ERGEBNIS_BLOCKIERT));

    await new Promise<void>((fertig) =>
      TestBed.runInInjectionContext(() => einreichen()).subscribe(() => fertig()),
    );

    expect(einreichenSpion).toHaveBeenCalledOnce();
    const [stammdaten, dateien] = einreichenSpion.mock.calls[0];
    expect(stammdaten).toBe(STAMMDATEN);
    expect((dateien as File[]).map((d) => d.name)).toEqual(['rechnung.pdf', 'packliste.pdf']);
  });

  it('macht aus der Antwort die Aktion "beantwortet" — auch bei blockiert', async () => {
    const aktionen$ = of(AkteAktionen.eingereicht({ stammdaten: STAMMDATEN }));
    baueUmgebung(aktionen$, of(ERGEBNIS_BLOCKIERT));

    const aktion = await new Promise<unknown>((loesen) =>
      TestBed.runInInjectionContext(() => einreichen()).subscribe(loesen),
    );
    expect(aktion).toEqual(AkteAktionen.einreichungBeantwortet({ ergebnis: ERGEBNIS_BLOCKIERT }));
  });

  it('macht aus einem Transportfehler eine Aktion, nicht einen Absturz', async () => {
    const aktionen$ = of(AkteAktionen.eingereicht({ stammdaten: STAMMDATEN }));
    baueUmgebung(aktionen$, throwError(() => new Error('Netz weg')));

    const aktion = (await new Promise<unknown>((loesen) =>
      TestBed.runInInjectionContext(() => einreichen()).subscribe(loesen),
    )) as ReturnType<typeof AkteAktionen.einreichungFehlgeschlagen>;
    expect(aktion.type).toBe(AkteAktionen.einreichungFehlgeschlagen.type);
    expect(aktion.meldung).toContain('Unerwarteter Fehler');
  });

  it('bleibt nach einem Fehler am Leben und verarbeitet die nächste Einreichung', async () => {
    // Ein Effect, der nach dem ersten Fehler den Datenstrom beendet, ist ein
    // Fehler, der erst beim zweiten Versuch auffällt.
    const aktionen$ = new Observable<unknown>((beobachter) => {
      beobachter.next(AkteAktionen.eingereicht({ stammdaten: STAMMDATEN }));
      beobachter.next(AkteAktionen.eingereicht({ stammdaten: STAMMDATEN }));
      beobachter.complete();
    });
    let ruf = 0;
    const { einreichenSpion } = baueUmgebung(aktionen$, of(ERGEBNIS_BLOCKIERT));
    einreichenSpion.mockImplementation(() => {
      ruf += 1;
      return ruf === 1 ? throwError(() => new Error('erster Versuch scheitert')) : of(ERGEBNIS_BLOCKIERT);
    });

    const aktionen: { type: string }[] = [];
    await new Promise<void>((fertig) =>
      TestBed.runInInjectionContext(() => einreichen()).subscribe({
        next: (aktion) => aktionen.push(aktion as { type: string }),
        complete: () => fertig(),
      }),
    );

    expect(aktionen.map((a) => a.type)).toEqual([
      AkteAktionen.einreichungFehlgeschlagen.type,
      AkteAktionen.einreichungBeantwortet.type,
    ]);
  });
});
