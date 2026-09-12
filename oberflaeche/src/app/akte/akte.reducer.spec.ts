// Der Zustand ohne Angular: reine Funktionen, reine Prüfungen.

import { describe, expect, it } from 'vitest';

import { AkteAktionen } from './akte.aktionen';
import type { Beleg } from './akte.modell';
import {
  akteReducer,
  anfangszustand,
  waehleBelegIds,
  waehleEinreichbar,
  waehleExtraktionshinweise,
  waehleLaeuft,
  waehleOffeneBefunde,
} from './akte.reducer';
import { ERGEBNIS_BLOCKIERT, ERGEBNIS_FREI } from './testhilfen';

const beleg = (id: string): Beleg => ({ id, name: `${id}.pdf`, groesse: 1024 });

describe('akteReducer', () => {
  it('beginnt leer und nicht einreichbar', () => {
    expect(anfangszustand.belege).toEqual([]);
    expect(anfangszustand.stand).toBe('bereit');
    expect(waehleEinreichbar.projector([], 'bereit')).toBe(false);
  });

  it('nimmt Belege auf und macht die Akte einreichbar', () => {
    const zustand = akteReducer(anfangszustand, AkteAktionen.belegeHinzugefuegt({ belege: [beleg('a'), beleg('b')] }));
    expect(zustand.belege).toHaveLength(2);
    expect(waehleEinreichbar.projector(zustand.belege, zustand.stand)).toBe(true);
    expect(waehleBelegIds.projector(zustand.belege)).toEqual(['a', 'b']);
  });

  it('entfernt genau einen Beleg', () => {
    const mitZwei = akteReducer(anfangszustand, AkteAktionen.belegeHinzugefuegt({ belege: [beleg('a'), beleg('b')] }));
    const danach = akteReducer(mitZwei, AkteAktionen.belegEntfernt({ id: 'a' }));
    expect(danach.belege.map((b) => b.id)).toEqual(['b']);
  });

  it('verwirft ein altes Ergebnis, sobald sich die Belege ändern', () => {
    const fertig = akteReducer(anfangszustand, AkteAktionen.einreichungBeantwortet({ ergebnis: ERGEBNIS_FREI }));
    expect(fertig.stand).toBe('fertig');

    const nachHinzufuegen = akteReducer(fertig, AkteAktionen.belegeHinzugefuegt({ belege: [beleg('c')] }));
    expect(nachHinzufuegen.ergebnis).toBeNull();
    expect(nachHinzufuegen.stand).toBe('bereit');

    const nachEntfernen = akteReducer(fertig, AkteAktionen.belegEntfernt({ id: 'x' }));
    expect(nachEntfernen.ergebnis).toBeNull();
  });

  it('läuft während der Einreichung und sperrt ein zweites Absenden', () => {
    const mitBeleg = akteReducer(anfangszustand, AkteAktionen.belegeHinzugefuegt({ belege: [beleg('a')] }));
    const laeuft = akteReducer(mitBeleg, AkteAktionen.eingereicht({ stammdaten: {} as never }));
    expect(laeuft.stand).toBe('laeuft');
    expect(waehleLaeuft.projector(laeuft.stand)).toBe(true);
    expect(waehleEinreichbar.projector(laeuft.belege, laeuft.stand)).toBe(false);
  });

  it('nimmt ein blockiertes Ergebnis als Ergebnis an, nicht als Fehler', () => {
    const zustand = akteReducer(anfangszustand, AkteAktionen.einreichungBeantwortet({ ergebnis: ERGEBNIS_BLOCKIERT }));
    expect(zustand.stand).toBe('fertig');
    expect(zustand.fehler).toBeNull();
    expect(zustand.ergebnis?.freigabe).toBe('blockiert');
  });

  it('trennt einen Transportfehler vom Ergebnis', () => {
    const zustand = akteReducer(anfangszustand, AkteAktionen.einreichungFehlgeschlagen({ meldung: 'Keine Verbindung' }));
    expect(zustand.stand).toBe('fehler');
    expect(zustand.ergebnis).toBeNull();
    expect(zustand.fehler).toBe('Keine Verbindung');
  });

  it('merkt sich abgelehnte Dateien und vergisst sie beim nächsten Zugang', () => {
    const abgelehnt = akteReducer(anfangszustand, AkteAktionen.belegeAbgelehnt({ namen: ['notiz.txt'] }));
    expect(abgelehnt.abgelehnt).toEqual(['notiz.txt']);
    const danach = akteReducer(abgelehnt, AkteAktionen.belegeHinzugefuegt({ belege: [beleg('a')] }));
    expect(danach.abgelehnt).toEqual([]);
  });

  it('setzt mit Neu begonnen alles zurück', () => {
    const voll = akteReducer(
      akteReducer(anfangszustand, AkteAktionen.belegeHinzugefuegt({ belege: [beleg('a')] })),
      AkteAktionen.einreichungBeantwortet({ ergebnis: ERGEBNIS_BLOCKIERT }),
    );
    expect(akteReducer(voll, AkteAktionen.neuBegonnen())).toEqual(anfangszustand);
  });
});

describe('Selektoren', () => {
  it('zeigen nur Befunde, die nicht erfüllt sind', () => {
    expect(waehleOffeneBefunde.projector(ERGEBNIS_BLOCKIERT).map((b) => b.regel)).toEqual(['TRN-01']);
    expect(waehleOffeneBefunde.projector(ERGEBNIS_FREI)).toEqual([]);
    expect(waehleOffeneBefunde.projector(null)).toEqual([]);
  });

  it('reichen die Hinweise der Extraktion durch, damit nichts still verschwindet', () => {
    expect(waehleExtraktionshinweise.projector(ERGEBNIS_BLOCKIERT)).toEqual([
      'lieferschein.pdf: Belegtyp nicht erkannt',
    ]);
    expect(waehleExtraktionshinweise.projector(null)).toEqual([]);
  });
});
