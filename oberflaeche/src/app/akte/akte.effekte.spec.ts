// Der Effect: Er liest die Belege aus dem Zustand, gibt sie dem Dienst und
// macht aus der Antwort genau eine Aktion — nie eine Entscheidung.

import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AkteAktionen } from './akte.aktionen';
import { AkteDienst } from './akte.dienst';
import { einreichen, nachUebersteuerungPruefen } from './akte.effekte';
import { akteFeature, anfangszustand, type AkteZustand } from './akte.reducer';
import { BelegSpeicher } from './akte.speicher';
import { ERGEBNIS_BLOCKIERT, STAMMDATEN, datei } from './testhilfen';

function baueUmgebung(
  aktionen$: Observable<unknown>,
  dienstAntwort: Observable<unknown>,
  zustand: Partial<AkteZustand> = {},
) {
  const einreichenSpion = vi.fn().mockReturnValue(dienstAntwort);
  const speicher = new BelegSpeicher();
  const angenommen = speicher.annehmen([datei('rechnung.pdf'), datei('packliste.pdf')]);

  TestBed.configureTestingModule({
    providers: [
      provideMockActions(() => aktionen$ as Observable<never>),
      provideMockStore({
        initialState: {
          [akteFeature.name]: {
            ...anfangszustand,
            belege: angenommen.belege,
            stand: 'laeuft',
            ...zustand,
          },
        },
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

    const aktion = (await new Promise<unknown>((loesen) =>
      TestBed.runInInjectionContext(() => einreichen()).subscribe(loesen),
    )) as ReturnType<typeof AkteAktionen.einreichungBeantwortet>;
    expect(aktion.type).toBe(AkteAktionen.einreichungBeantwortet.type);
    expect(aktion.ergebnis).toBe(ERGEBNIS_BLOCKIERT);
    // Der Zeitpunkt entsteht im Effect, nicht im Reducer — geprüft wird die
    // Form, nicht der Wert.
    expect(new Date(aktion.zeitpunkt).getTime()).not.toBeNaN();
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

const UEBERSTEUERUNG = {
  regel: 'TRN-01',
  fassung: '0.1.0@2026-09-12',
  benutzer: 'G. Suter',
  begruendung: 'Reederei hat den Umlad bestätigt',
  erzeugt_am: '2026-09-12T10:00:00Z',
};

describe('nachUebersteuerungPruefen', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('prüft mit denselben Stammdaten und Belegen erneut, jetzt mit der Übersteuerung', async () => {
    const aktionen$ = of(AkteAktionen.befundUebersteuert({ uebersteuerung: UEBERSTEUERUNG }));
    const { einreichenSpion } = baueUmgebung(aktionen$, of(ERGEBNIS_BLOCKIERT), {
      stammdaten: STAMMDATEN,
      uebersteuerungen: [UEBERSTEUERUNG],
    });

    await new Promise<void>((fertig) =>
      TestBed.runInInjectionContext(() => nachUebersteuerungPruefen()).subscribe(() => fertig()),
    );

    const [stammdaten, dateien, uebersteuerungen] = einreichenSpion.mock.calls[0];
    expect(stammdaten).toBe(STAMMDATEN);
    expect((dateien as File[]).map((d) => d.name)).toEqual(['rechnung.pdf', 'packliste.pdf']);
    expect(uebersteuerungen).toEqual([UEBERSTEUERUNG]);
  });

  it('prüft auch nach dem Zurücknehmen erneut — dann ohne die Übersteuerung', async () => {
    const aktionen$ = of(AkteAktionen.uebersteuerungZurueckgenommen({ regel: 'TRN-01' }));
    const { einreichenSpion } = baueUmgebung(aktionen$, of(ERGEBNIS_BLOCKIERT), {
      stammdaten: STAMMDATEN,
      uebersteuerungen: [],
    });

    await new Promise<void>((fertig) =>
      TestBed.runInInjectionContext(() => nachUebersteuerungPruefen()).subscribe(() => fertig()),
    );

    expect(einreichenSpion.mock.calls[0][2]).toEqual([]);
  });

  it('scheitert benannt, wenn es gar keine eingereichte Akte gibt', async () => {
    const aktionen$ = of(AkteAktionen.befundUebersteuert({ uebersteuerung: UEBERSTEUERUNG }));
    const { einreichenSpion } = baueUmgebung(aktionen$, of(ERGEBNIS_BLOCKIERT), { stammdaten: null });

    const aktion = (await new Promise<unknown>((loesen) =>
      TestBed.runInInjectionContext(() => nachUebersteuerungPruefen()).subscribe(loesen),
    )) as ReturnType<typeof AkteAktionen.einreichungFehlgeschlagen>;

    expect(einreichenSpion).not.toHaveBeenCalled();
    expect(aktion.type).toBe(AkteAktionen.einreichungFehlgeschlagen.type);
    expect(aktion.meldung).toContain('Keine eingereichte Akte');
  });
});
