// Testhilfen: ein Prüfergebnis und ein Beleg, wie sie wirklich aussehen.
//
// Die Werte sind aus einer echten Antwort des Webhooks auf
// testdaten/belege/container-abweichung abgeschrieben und gekürzt, nicht von
// dieser Oberfläche erzeugt. Ein Prüfstück, das der Prüfling selbst herstellt,
// prüft nichts (docs/ENTWICKLUNGSLOG.md, 12.09.2026).

import type { Pruefergebnis, Stammdaten } from './akte.modell';

export const STAMMDATEN: Stammdaten = {
  akte_id: 'ZP-2026-0004',
  stichtag: '2026-09-12',
  sachverhalt: {
    richtung: 'export_third_country',
    verkehrstraeger: 'sea',
    praeferenz_beansprucht: true,
    incoterm: { code: 'FOB', named_place: 'Hamburg', named_place_unlocode: 'DEHAM', edition: 2020 },
    route: { pol: 'DEHAM', pod: 'SGSIN' },
  },
  anmeldung: { richtung: 'export', warennummern: ['84133080', '84842000'] },
};

export const ERGEBNIS_BLOCKIERT: Pruefergebnis = {
  akte_id: 'ZP-2026-0004',
  stichtag: '2026-09-12',
  katalog_version: '0.1.0',
  freigabe: 'blockiert',
  freigabe_nach_override: 'blockiert',
  uebersteuerungen: { angewandt: [], verbraucht: [] },
  pflichtmatrix: { anwendbar: true, befunde: [] },
  befunde: [
    {
      regel: 'TRN-01',
      name: 'Containernummer konsistent',
      status: 'verletzt',
      haerte: 'hard',
      haerte_effektiv: 'hard',
      risiko: 'operational',
      begruendung: 'B/L nennt HLXU8765430, Packliste MSKU1234565',
      rechtsgrundlage: 'Gestellung, Verschlusssicherheit',
      rechtsquelle_status: 'practice',
      konsequenz: 'Bezeichnet ggf. eine andere physische Sendung, Beschau',
      regelversion: '0.1.0@2026-09-12',
    },
  ],
  regeln_ohne_implementierung: [],
  dokumente: [
    {
      id: 'INV-1',
      typ: 'handelsrechnung',
      status: 'final',
      version: 1,
      aussteller: 'Nordlicht Maschinenbau GmbH',
      hash: 'sha256:abc',
      datei: 'handelsrechnung.pdf',
      seiten: 1,
      methoden: ['textlayer'],
    },
    {
      id: 'UNK-1',
      typ: 'unclassified',
      status: 'final',
      version: 1,
      aussteller: null,
      hash: 'sha256:def',
      datei: 'lieferschein.pdf',
      hinweis: 'Belegtyp nicht erkannt; bleibt an der Akte und wird gemeldet',
    },
  ],
  extraktion: { version: '0.1.0', ocr: '5.5.0', belege: 4, hinweise: ['lieferschein.pdf: Belegtyp nicht erkannt'] },
  unbekannte_dokumente: [],
  nicht_klassifiziert: ['UNK-1'],
  referenzen: { rechnung: 'INV-2026-0417', bill_of_lading: 'MAEU-HH-778812', container: 'HLXU8765430' },
  ausfuehrung: '65',
  nachforderungen: [
    {
      grund: 'TRN-01',
      feld: 'bill_of_lading.container_id',
      adressat: { primaer: 'Seefrachtspediteur/Carrier', sekundaer: 'Shipper', ausloeser: 'SI-Cut-off / On-board' },
      anforderung: 'Containernummer konsistent',
      widerspruch: 'B/L nennt HLXU8765430, Packliste MSKU1234565',
      akzeptierte_nachweise: ['bill_of_lading.container_id', 'packliste.container_id'],
      folge: 'Keine Freigabe: Bezeichnet ggf. eine andere physische Sendung, Beschau',
      stufe: 'erinnerung_0',
      betreff: 'ACTION REQUIRED – Containernummer konsistent – Shipment ZP-2026-0004',
      text: 'Betreff: ACTION REQUIRED\n\nAn: Seefrachtspediteur/Carrier',
    },
  ],
};

/**
 * Dieselbe Akte, nachdem ein Mensch TRN-01 verantwortet hat (ADR-007).
 *
 * Ebenfalls abgeschrieben, nicht gebaut: Der Befund ist unverändert
 * `verletzt`, `freigabe` bleibt `blockiert`, und nur
 * `freigabe_nach_override` dreht. Genau das soll die Oberfläche zeigen.
 */
export const ERGEBNIS_UEBERSTEUERT: Pruefergebnis = {
  ...ERGEBNIS_BLOCKIERT,
  freigabe_nach_override: 'freigabereif',
  uebersteuerungen: {
    angewandt: [
      {
        kennung: 'TRN-01',
        benutzer: 'G. Suter',
        begruendung: 'Reederei hat den Umlad schriftlich bestaetigt, Beleg folgt',
      },
    ],
    verbraucht: [],
  },
  befunde: ERGEBNIS_BLOCKIERT.befunde.map((befund) => ({
    ...befund,
    uebersteuert_von: 'G. Suter',
    uebersteuert_am: '2026-09-12T10:00:00Z',
    uebersteuerungsgrund: 'Reederei hat den Umlad schriftlich bestaetigt, Beleg folgt',
  })),
};

export const ERGEBNIS_FREI: Pruefergebnis = {
  ...ERGEBNIS_BLOCKIERT,
  akte_id: 'ZP-2026-0001',
  freigabe: 'freigabereif',
  freigabe_nach_override: 'freigabereif',
  befunde: [],
  nachforderungen: [],
  nicht_klassifiziert: [],
  extraktion: { version: '0.1.0', ocr: '5.5.0', belege: 3, hinweise: [] },
};

/** Eine Datei, ohne echtes PDF auf der Platte. */
export function datei(name: string, typ = 'application/pdf'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: typ });
}
