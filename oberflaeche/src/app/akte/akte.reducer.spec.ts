// Der Zustand ohne Angular: reine Funktionen, reine Prüfungen.

import { describe, expect, it } from 'vitest';

import { AkteAktionen } from './akte.aktionen';
import type { Beleg } from './akte.modell';
import {
  akteReducer,
  anfangszustand,
  waehleBelegIds,
  waehleEinreichbar,
  waehleEntwertet,
  waehleErfuelltePflicht,
  waehleExtraktionshinweise,
  waehleGueltigesErgebnis,
  waehleLaeuft,
  waehleMehrereAdressaten,
  waehleNachforderungenNachAdressat,
  waehleOffeneBefunde,
  waehlePflichtBilanz,
  waehleRegelBilanz,
  waehleFreigabeUnterschied,
  waehleLetzterBenutzer,
  waehleUebersteuerteBefunde,
} from './akte.reducer';
import { ERGEBNIS_BLOCKIERT, ERGEBNIS_FREI, ERGEBNIS_UEBERSTEUERT, STAMMDATEN } from './testhilfen';

const beleg = (id: string): Beleg => ({ id, name: `${id}.pdf`, groesse: 1024 });
const ZEIT = '2026-09-12T14:22:00.000Z';

/** Ein Zustand mit gültigem Ergebnis, wie nach einer erfolgreichen Prüfung. */
function mitErgebnis(ergebnis = ERGEBNIS_BLOCKIERT) {
  const mitBeleg = akteReducer(anfangszustand, AkteAktionen.belegeHinzugefuegt({ belege: [beleg('a')] }));
  return akteReducer(mitBeleg, AkteAktionen.einreichungBeantwortet({ ergebnis, zeitpunkt: ZEIT }));
}

describe('akteReducer', () => {
  it('beginnt leer und nicht einreichbar', () => {
    expect(anfangszustand.belege).toEqual([]);
    expect(anfangszustand.stand).toBe('bereit');
    expect(anfangszustand.veraltet).toBe(false);
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

  it('merkt sich den Zeitpunkt der Prüfung, statt eine Uhr im Reducer zu brauchen', () => {
    expect(mitErgebnis().gepruefetAm).toBe(ZEIT);
  });

  it('entwertet ein Ergebnis, wenn sich die Belege ändern — statt es zu löschen', () => {
    const fertig = mitErgebnis();
    const nachHinzufuegen = akteReducer(fertig, AkteAktionen.belegeHinzugefuegt({ belege: [beleg('c')] }));

    // Das Ergebnis bleibt im Zustand: Es gab eine Entscheidung, und das soll
    // sichtbar bleiben. Aber es gilt nicht mehr.
    expect(nachHinzufuegen.ergebnis).not.toBeNull();
    expect(nachHinzufuegen.veraltet).toBe(true);
    expect(nachHinzufuegen.stand).toBe('bereit');
    expect(waehleGueltigesErgebnis.projector(nachHinzufuegen.ergebnis, nachHinzufuegen.stand, nachHinzufuegen.veraltet)).toBeNull();

    const entwertet = waehleEntwertet.projector(nachHinzufuegen.ergebnis, nachHinzufuegen.veraltet, nachHinzufuegen.gepruefetAm);
    expect(entwertet).toEqual({ freigabe: 'blockiert', zeitpunkt: ZEIT });
  });

  it('entwertet auch beim Entfernen eines Belegs', () => {
    const danach = akteReducer(mitErgebnis(), AkteAktionen.belegEntfernt({ id: 'a' }));
    expect(danach.veraltet).toBe(true);
    expect(danach.ergebnis).not.toBeNull();
  });

  it('entwertet nichts, wenn es gar kein Ergebnis gab', () => {
    const zustand = akteReducer(anfangszustand, AkteAktionen.belegeHinzugefuegt({ belege: [beleg('a')] }));
    expect(zustand.veraltet).toBe(false);
    expect(waehleEntwertet.projector(zustand.ergebnis, zustand.veraltet, zustand.gepruefetAm)).toBeNull();
  });

  it('läuft während der Einreichung und sperrt ein zweites Absenden', () => {
    const mitBeleg = akteReducer(anfangszustand, AkteAktionen.belegeHinzugefuegt({ belege: [beleg('a')] }));
    const laeuft = akteReducer(mitBeleg, AkteAktionen.eingereicht({ stammdaten: {} as never }));
    expect(laeuft.stand).toBe('laeuft');
    expect(waehleLaeuft.projector(laeuft.stand)).toBe(true);
    expect(waehleEinreichbar.projector(laeuft.belege, laeuft.stand)).toBe(false);
  });

  it('nimmt ein blockiertes Ergebnis als Ergebnis an, nicht als Fehler', () => {
    const zustand = mitErgebnis();
    expect(zustand.stand).toBe('fertig');
    expect(zustand.fehler).toBeNull();
    expect(zustand.ergebnis?.freigabe).toBe('blockiert');
  });

  it('lässt bei einem Transportfehler kein altes Ergebnis stehen', () => {
    const danach = akteReducer(mitErgebnis(), AkteAktionen.einreichungFehlgeschlagen({ meldung: 'Keine Verbindung' }));
    expect(danach.stand).toBe('fehler');
    // Ein Transportfehler ist kein Prüfergebnis; ein alter Befund daneben
    // wäre irreführend.
    expect(danach.ergebnis).toBeNull();
    expect(danach.veraltet).toBe(false);
    expect(danach.fehler).toBe('Keine Verbindung');
  });

  it('merkt sich abgelehnte Dateien und vergisst sie beim nächsten Zugang', () => {
    const abgelehnt = akteReducer(anfangszustand, AkteAktionen.belegeAbgelehnt({ namen: ['notiz.txt'] }));
    expect(abgelehnt.abgelehnt).toEqual(['notiz.txt']);
    const danach = akteReducer(abgelehnt, AkteAktionen.belegeHinzugefuegt({ belege: [beleg('a')] }));
    expect(danach.abgelehnt).toEqual([]);
  });

  it('setzt mit Neu begonnen alles zurück', () => {
    expect(akteReducer(mitErgebnis(), AkteAktionen.neuBegonnen())).toEqual(anfangszustand);
  });
});

describe('Selektoren', () => {
  it('zeigen nur Befunde, die nicht erfüllt sind', () => {
    expect(waehleOffeneBefunde.projector(ERGEBNIS_BLOCKIERT).map((b) => b.regel)).toEqual(['TRN-01']);
    expect(waehleOffeneBefunde.projector(ERGEBNIS_FREI)).toEqual([]);
    expect(waehleOffeneBefunde.projector(null)).toEqual([]);
  });

  it('liefern die Bilanz: wie viele geprüft, wie viele offen', () => {
    // Die Zahl der geprüften Regeln steht im Ergebnis und darf nicht
    // verlorengehen — „12 von 13 ohne Befund" ist die Aussage, nicht „nichts".
    expect(waehleRegelBilanz.projector(ERGEBNIS_BLOCKIERT)).toEqual({ gesamt: 1, offen: 1, ohneBefund: 0 });
    expect(waehleRegelBilanz.projector(ERGEBNIS_FREI)).toEqual({ gesamt: 0, offen: 0, ohneBefund: 0 });
    expect(waehleRegelBilanz.projector(null)).toEqual({ gesamt: 0, offen: 0, ohneBefund: 0 });
    expect(waehlePflichtBilanz.projector(ERGEBNIS_BLOCKIERT)).toEqual({ gesamt: 0, offen: 0, erfuellt: 0 });
  });

  it('reichen die Hinweise der Extraktion durch, damit nichts still verschwindet', () => {
    expect(waehleExtraktionshinweise.projector(ERGEBNIS_BLOCKIERT)).toEqual([
      'lieferschein.pdf: Belegtyp nicht erkannt',
    ]);
    expect(waehleExtraktionshinweise.projector(null)).toEqual([]);
  });

  it('gruppieren Nachforderungen nach Adressat', () => {
    const eine = waehleNachforderungenNachAdressat.projector(ERGEBNIS_BLOCKIERT.nachforderungen);
    expect(eine).toHaveLength(1);
    expect(eine[0].primaer).toBe('Seefrachtspediteur/Carrier');
    expect(eine[0].sekundaer).toBe('Shipper');
    // Bei einem Adressaten wäre eine Überschrift eine leere Hülle.
    expect(waehleMehrereAdressaten.projector(eine)).toBe(false);

    const zwei = waehleNachforderungenNachAdressat.projector([
      ERGEBNIS_BLOCKIERT.nachforderungen[0],
      { ...ERGEBNIS_BLOCKIERT.nachforderungen[0], grund: 'PFL-05', adressat: { primaer: 'Exporteur/Lieferant', sekundaer: null, ausloeser: null } },
    ]);
    expect(zwei.map((g) => g.primaer)).toEqual(['Seefrachtspediteur/Carrier', 'Exporteur/Lieferant']);
    expect(waehleMehrereAdressaten.projector(zwei)).toBe(true);
  });

  it('liefern die erfüllten Pflichten mit dem Beleg, der sie erfüllt', () => {
    const ergebnis = {
      ...ERGEBNIS_BLOCKIERT,
      pflichtmatrix: {
        anwendbar: true,
        befunde: [
          { id: 'PFL-01', required_data: 'rechnung.gesamt', label: 'Rechnungsbetrag', haerte: 'hard' as const, status: 'ok' as const, begruendung: 'nachgewiesen', akzeptierte_nachweise: ['handelsrechnung'], rechtsgrundlage: 'Art. 163 UZK', fassung: '0.1.0@2026-09-12', quelle: 'INV-1' },
        ],
      },
    };
    const erfuellt = waehleErfuelltePflicht.projector(ergebnis);
    expect(erfuellt).toHaveLength(1);
    expect(erfuellt[0].quelle).toBe('INV-1');
  });
});

describe('Übersteuerungen', () => {
  const uebersteuerung = (regel: string, begruendung = 'Reederei hat bestätigt') => ({
    regel,
    fassung: '0.1.0@2026-09-12',
    benutzer: 'G. Suter',
    begruendung,
    erzeugt_am: ZEIT,
  });

  it('nimmt eine Übersteuerung auf und setzt den Stand auf laeuft', () => {
    const zustand = akteReducer(
      anfangszustand,
      AkteAktionen.befundUebersteuert({ uebersteuerung: uebersteuerung('TRN-01') }),
    );
    expect(zustand.uebersteuerungen).toEqual([uebersteuerung('TRN-01')]);
    expect(zustand.stand).toBe('laeuft');
  });

  it('ersetzt die vorherige Entscheidung zur selben Kennung, statt sie zu verdoppeln', () => {
    const erste = akteReducer(
      anfangszustand,
      AkteAktionen.befundUebersteuert({ uebersteuerung: uebersteuerung('TRN-01', 'erster Grund hier') }),
    );
    const zweite = akteReducer(
      erste,
      AkteAktionen.befundUebersteuert({ uebersteuerung: uebersteuerung('TRN-01', 'zweiter Grund hier') }),
    );
    expect(zweite.uebersteuerungen).toHaveLength(1);
    expect(zweite.uebersteuerungen[0].begruendung).toBe('zweiter Grund hier');
  });

  it('lässt Entscheidungen zu anderen Kennungen unberührt', () => {
    const erste = akteReducer(anfangszustand, AkteAktionen.befundUebersteuert({ uebersteuerung: uebersteuerung('TRN-01') }));
    const zweite = akteReducer(erste, AkteAktionen.befundUebersteuert({ uebersteuerung: uebersteuerung('PFL-02') }));
    const zurueck = akteReducer(zweite, AkteAktionen.uebersteuerungZurueckgenommen({ regel: 'TRN-01' }));
    expect(zurueck.uebersteuerungen.map((u) => u.regel)).toEqual(['PFL-02']);
  });

  it('merkt sich die Stammdaten der Einreichung, damit erneut geprüft werden kann', () => {
    const zustand = akteReducer(anfangszustand, AkteAktionen.eingereicht({ stammdaten: STAMMDATEN }));
    expect(zustand.stammdaten).toBe(STAMMDATEN);
  });

  it('meldet den Unterschied der beiden Entscheidungen nur, wenn es einen gibt', () => {
    expect(waehleFreigabeUnterschied.projector(ERGEBNIS_BLOCKIERT)).toBeNull();
    expect(waehleFreigabeUnterschied.projector(ERGEBNIS_UEBERSTEUERT)).toEqual({
      ohne: 'blockiert',
      mit: 'freigabereif',
    });
  });

  it('führt übersteuerte Befunde weiterhin als offen — sie verschwinden nicht', () => {
    expect(waehleUebersteuerteBefunde.projector(ERGEBNIS_UEBERSTEUERT).map((b) => b.regel)).toEqual(['TRN-01']);
    // Und derselbe Befund steht unverändert in der Liste der offenen.
    const offen = waehleOffeneBefunde.projector(ERGEBNIS_UEBERSTEUERT);
    expect(offen.map((b) => b.regel)).toEqual(['TRN-01']);
    expect(offen[0].status).toBe('verletzt');
  });

  it('belegt den Namen aus der zuletzt getroffenen Entscheidung vor', () => {
    expect(waehleLetzterBenutzer.projector([])).toBe('');
    expect(waehleLetzterBenutzer.projector([uebersteuerung('TRN-01')])).toBe('G. Suter');
  });
});
