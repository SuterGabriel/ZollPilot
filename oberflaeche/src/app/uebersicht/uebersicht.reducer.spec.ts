import { describe, expect, it } from 'vitest';

import { UEBERSICHT } from './testhilfen';
import { UebersichtAktionen } from './uebersicht.aktionen';
import { uebersichtAnfang, uebersichtFeature, waehleAkten, waehleUebersichtLaeuft, waehleZusammenfassung } from './uebersicht.reducer';

const reducer = uebersichtFeature.reducer;
const ZEIT = '2026-09-12T16:00:00.000Z';

describe('Übersicht, Zustand', () => {
  it('läuft nach der Anforderung und ist fertig mit Daten und Zeitpunkt', () => {
    const laeuft = reducer(uebersichtAnfang, UebersichtAktionen.ladenAngefordert());
    expect(laeuft.stand).toBe('laeuft');
    const fertig = reducer(laeuft, UebersichtAktionen.geladen({ daten: UEBERSICHT, zeitpunkt: ZEIT }));
    expect(fertig.stand).toBe('fertig');
    expect(fertig.daten).toEqual(UEBERSICHT);
    expect(fertig.geladenAm).toBe(ZEIT);
  });

  it('ein Fehler behält die alten Daten und nennt die Meldung', () => {
    const fertig = reducer(uebersichtAnfang, UebersichtAktionen.geladen({ daten: UEBERSICHT, zeitpunkt: ZEIT }));
    const fehler = reducer(
      reducer(fertig, UebersichtAktionen.ladenAngefordert()),
      UebersichtAktionen.ladenFehlgeschlagen({ meldung: 'Keine Verbindung' }),
    );
    expect(fehler.stand).toBe('fehler');
    expect(fehler.fehler).toBe('Keine Verbindung');
    expect(fehler.daten).toEqual(UEBERSICHT);
    expect(fehler.geladenAm).toBe(ZEIT);
  });

  it('die Selektoren lesen aus dem Feature, mit leeren Vorgaben, wenn nichts da ist', () => {
    const leer = { [uebersichtFeature.name]: uebersichtAnfang };
    expect(waehleAkten(leer)).toEqual([]);
    expect(waehleZusammenfassung(leer)).toBeNull();
    expect(waehleUebersichtLaeuft(leer)).toBe(false);
    const voll = { [uebersichtFeature.name]: reducer(uebersichtAnfang, UebersichtAktionen.geladen({ daten: UEBERSICHT, zeitpunkt: ZEIT })) };
    expect(waehleAkten(voll)).toHaveLength(2);
    expect(waehleZusammenfassung(voll)?.blockiert).toBe(1);
  });
});
