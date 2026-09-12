// Ein Prüfstück der Übersicht, so wie GET /webhook/akten es liefert.
// Synthetische Werte, wie überall (docs/DATENSCHUTZ.md).

import type { Uebersicht } from './uebersicht.modell';

export const UEBERSICHT: Uebersicht = {
  akten: [
    {
      akte_id: 'ZP-2026-0002',
      status: 'blockiert',
      zuletzt_geprueft_am: '2026-09-12T14:22:00.000Z',
      richtung: 'export_third_country',
      verkehrstraeger: 'sea',
      belege: 5,
      nachforderungen_offen: 2,
      letzte_stufe: 'erinnerung_1',
      letzter_versand_am: '2026-09-13T14:30:00.000Z',
      customs_cutoff: '2026-09-15T14:00:00.000Z',
    },
    {
      akte_id: 'ZP-2026-0001',
      status: 'freigabereif',
      zuletzt_geprueft_am: '2026-09-12T14:20:00.000Z',
      richtung: 'export_third_country',
      verkehrstraeger: 'sea',
      belege: 5,
      nachforderungen_offen: 0,
      letzte_stufe: null,
      letzter_versand_am: null,
      customs_cutoff: '2026-09-15T14:00:00.000Z',
    },
  ],
  unzugeordnet: [
    {
      id: 3,
      von: 'Unbekannt <jemand@example.test>',
      betreff: 'Frage ohne Aktennummer',
      grund: 'keine Aktennummer in Betreff oder Text',
      anhaenge: 0,
      empfangen_am: '2026-09-12T15:01:00.000Z',
    },
  ],
  zusammenfassung: { akten: 2, blockiert: 1, freigabereif: 1, nachforderungen_offen: 2, unzugeordnet: 1 },
};

export const UEBERSICHT_LEER: Uebersicht = {
  akten: [],
  unzugeordnet: [],
  zusammenfassung: { akten: 0, blockiert: 0, freigabereif: 0, nachforderungen_offen: 0, unzugeordnet: 0 },
};
