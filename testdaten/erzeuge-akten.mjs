#!/usr/bin/env node
// Erzeugt die synthetischen Testakten unter testdaten/akten/.
//
// Alle Firmen, Nummern und Werte sind erfunden (docs/DATENSCHUTZ.md). Die
// Containernummern sind nach ISO 6346 gültig, damit die Prüfziffernregel nur
// dort anschlägt, wo es gewollt ist. Jede Akte ist eine Variante desselben
// Grundfalls; der Fehlerpfad ist der eigentliche Demo-Inhalt (PROJECT.md, 8).
//
//   node testdaten/erzeuge-akten.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ziel = join(dirname(fileURLToPath(import.meta.url)), 'akten');
mkdirSync(ziel, { recursive: true });

const CONTAINER_A = 'MSKU1234565'; // Prüfziffer 5, gültig
const CONTAINER_B = 'HLXU8765430'; // Prüfziffer 0, gültig (Rest 10 → 0)

function dokument(id, typ, extra = {}) {
  return { id, typ, status: 'final', version: 1, aussteller: null, hash: `sha256:synthetisch-${id.toLowerCase()}`, ...extra };
}

function assertion(dokument, pfad, wert, extra = {}) {
  return { dokument, pfad, wert, roh: String(wert), konfidenz: 0.99, seite: 1, methode: 'textlayer', ...extra };
}

/** Flacht ein Objekt zu Assertions ab: { rechnung: { positionen: [{ menge: 12 }] } } → rechnung.positionen.0.menge */
function assertionsAus(dokumentId, praefix, objekt, konfidenzen = {}) {
  const liste = [];
  const lauf = (wert, pfad) => {
    if (Array.isArray(wert)) wert.forEach((v, i) => lauf(v, `${pfad}.${i}`));
    else if (wert !== null && typeof wert === 'object') Object.entries(wert).forEach(([k, v]) => lauf(v, `${pfad}.${k}`));
    else liste.push(assertion(dokumentId, pfad, wert, konfidenzen[pfad] !== undefined ? { konfidenz: konfidenzen[pfad], methode: 'ocr' } : {}));
  };
  lauf(objekt, praefix);
  return liste;
}

function grundfall({ id, beschreibung, aenderung = {} }) {
  const rechnung = {
    nummer: 'INV-2026-0417',
    datum: '2026-09-08',
    waehrung: 'EUR',
    verkaeufer: { name: 'Nordlicht Maschinenbau GmbH', land: 'DE', eori: 'DE123456789012345' },
    kaeufer: { name: 'Aurora Trading Pte. Ltd.', land: 'SG' },
    positionen: [
      { nr: 1, beschreibung: 'Hydraulikpumpe Typ HP-40', menge: 12, einheit: 'PCE', einzelpreis: 1450, netto: 17400, hs6: '841330', ursprung: 'DE' },
      { nr: 2, beschreibung: 'Dichtungssatz HP-40', menge: 12, einheit: 'PCE', einzelpreis: 85, netto: 1020, hs6: '848420', ursprung: 'DE' },
    ],
    zuschlaege: 0,
    rabatte: 0,
    gesamt: 18420,
    ...aenderung.rechnung,
  };
  const packliste = {
    nummer: 'PL-2026-0417',
    container_id: CONTAINER_A,
    positionen: [
      { nr: 1, menge: 12, hs6: '841330' },
      { nr: 2, menge: 12, hs6: '848420' },
    ],
    packstuecke: [
      { id: 'PAL-1', art: 'Palette', brutto_kg: 980, netto_kg: 900 },
      { id: 'KAR-1', art: 'Karton', brutto_kg: 60, netto_kg: 48 },
    ],
    brutto_gesamt_kg: 1040,
    ...aenderung.packliste,
  };
  const bl = {
    nummer: 'MAEU-HH-778812',
    container_id: CONTAINER_A,
    seal: 'ML-SG-44821',
    pol: 'DEHAM',
    pod: 'SGSIN',
    brutto_kg: 1046,
    on_board: '2026-09-11',
    ...aenderung.bill_of_lading,
  };
  const nachweis = {
    typ: 'origin_declaration',
    ursprung: 'DE',
    rex_nummer: 'DEREX12345678',
    ursprungswert: 18420,
    warenkreis: [
      { pos: 1, hs6: '841330' },
      { pos: 2, hs6: '848420' },
    ],
    ...aenderung.praeferenznachweis,
  };

  // Das Ausfuhrbegleitdokument: die lesbare Fassung der überlassenen
  // Anmeldung. Die MRN ist erfunden, aber strukturgültig (docs/04: 18 Zeichen,
  // Jahr, Land, Kennung); eine Prüfziffer wird bewusst nicht berechnet
  // (docs/08). Die Warennummern sind die achtstelligen aus `anmeldung`.
  const abd = {
    mrn: '26DE5100001234567A',
    ausfuehrer: { name: 'Nordlicht Maschinenbau GmbH', eori: 'DE123456789012345' },
    bestimmungsland: 'SG',
    container_id: CONTAINER_A,
    positionen: [
      { nr: 1, warennummer: '84133080', menge: 12 },
      { nr: 2, warennummer: '84842000', menge: 12 },
    ],
    ...aenderung.abd,
  };

  const dokumente = [
    dokument('INV-1', 'handelsrechnung', { aussteller: 'Nordlicht Maschinenbau GmbH' }),
    dokument('PL-1', 'packliste', { aussteller: 'Nordlicht Maschinenbau GmbH' }),
    dokument('BL-1', 'bill_of_lading', { aussteller: 'Maersk Line (synthetisch)', ...aenderung.bl_dokument }),
    dokument('ABD-1', 'abd', { aussteller: 'Nordlicht Maschinenbau GmbH' }),
  ];
  if (!aenderung.ohne_praeferenznachweis) {
    dokumente.push(dokument('UE-1', nachweis.typ, { aussteller: 'Nordlicht Maschinenbau GmbH', traeger: 'INV-1', hinweis: 'Ursprungserklärung auf der Rechnung, als eigener Belegtyp klassifiziert' }));
  }
  if (aenderung.zusatzdokumente) dokumente.push(...aenderung.zusatzdokumente);

  const assertions = [
    ...assertionsAus('INV-1', 'rechnung', rechnung, aenderung.konfidenzen),
    ...assertionsAus('PL-1', 'packliste', packliste, aenderung.konfidenzen),
    ...assertionsAus('BL-1', 'bill_of_lading', bl, aenderung.konfidenzen),
    ...(aenderung.ohne_praeferenznachweis ? [] : assertionsAus('UE-1', 'praeferenznachweis', nachweis, aenderung.konfidenzen)),
    ...assertionsAus('ABD-1', 'abd', abd, aenderung.konfidenzen),
  ];

  return {
    akte_id: id,
    beschreibung,
    erwartung: aenderung.erwartung,
    stichtag: '2026-09-12',
    sachverhalt: {
      richtung: 'export_third_country',
      verkehrstraeger: 'sea',
      praeferenz_beansprucht: true,
      incoterm: { code: 'FOB', named_place: 'Hamburg', named_place_unlocode: 'DEHAM', edition: 2020 },
      route: { pol: 'DEHAM', pod: 'SGSIN' },
    },
    anmeldung: { richtung: 'export', warennummern: ['84133080', '84842000'], ...aenderung.anmeldung },
    dokumente,
    assertions,
  };
}

const akten = [
  grundfall({
    id: 'ZP-2026-0001',
    beschreibung: 'Happy Path: vollständige, widerspruchsfreie Akte. Gewichtsabweichung 6 kg liegt innerhalb der Toleranz.',
    aenderung: { erwartung: { freigabe: 'freigabereif', regeln: [] } },
  }),
  grundfall({
    id: 'ZP-2026-0002',
    beschreibung: 'Präferenznachweis fehlt. Pflichtmatrix PFL-05 meldet den fehlenden Nachweis, ORG-02 ist nicht prüfbar.',
    aenderung: { ohne_praeferenznachweis: true, erwartung: { freigabe: 'blockiert', regeln: ['ORG-02'], pflicht: ['PFL-05'] } },
  }),
  grundfall({
    id: 'ZP-2026-0003',
    beschreibung: 'Ursprungswiderspruch: Position 2 hat auf der Rechnung Ursprung CN, die Ursprungserklärung erklärt DE.',
    aenderung: {
      rechnung: {
        positionen: [
          { nr: 1, beschreibung: 'Hydraulikpumpe Typ HP-40', menge: 12, einheit: 'PCE', einzelpreis: 1450, netto: 17400, hs6: '841330', ursprung: 'DE' },
          { nr: 2, beschreibung: 'Dichtungssatz HP-40', menge: 12, einheit: 'PCE', einzelpreis: 85, netto: 1020, hs6: '848420', ursprung: 'CN' },
        ],
      },
      erwartung: { freigabe: 'blockiert', regeln: ['ORG-02'] },
    },
  }),
  grundfall({
    id: 'ZP-2026-0004',
    beschreibung: 'Abweichende Containernummer: B/L nennt einen anderen (gültigen) Container als die Packliste.',
    aenderung: { bill_of_lading: { container_id: CONTAINER_B }, erwartung: { freigabe: 'blockiert', regeln: ['TRN-01'] } },
  }),
  grundfall({
    id: 'ZP-2026-0005',
    beschreibung: 'Draft-B/L: Das einzige B/L ist ein Entwurf. Seine Werte werden keine Fakten; REF-03 meldet es, PFL-04 fehlt.',
    aenderung: {
      bl_dokument: { status: 'draft', version: 0 },
      erwartung: { freigabe: 'blockiert', regeln: ['REF-03', 'TRN-01', 'QTY-02'], pflicht: ['PFL-04'] },
    },
  }),
  grundfall({
    id: 'ZP-2026-0006',
    beschreibung: 'Schlechter Scan: Containernummer der Packliste per OCR mit Konfidenz 0,55 gelesen, Prüfziffer falsch. Zuerst Lesefehler, nicht Fachfehler.',
    aenderung: {
      packliste: { container_id: 'MSKU1234568' },
      konfidenzen: { 'packliste.container_id': 0.55 },
      // Dieselbe unsichere Lesung erreicht drei Regeln: Prüfziffer (TRN-02),
      // Vergleich mit dem B/L (TRN-01) und Vergleich mit dem ABD (CUS-05).
      // Alle drei sagen nachlesen, keine sagt Fachfehler.
      erwartung: { freigabe: 'nachextraktion_erforderlich', regeln: ['TRN-01', 'TRN-02', 'CUS-05'] },
    },
  }),
  grundfall({
    id: 'ZP-2026-0007',
    beschreibung: 'Kostenlose Position ohne Zollwert: Position 3 "no charge" ohne Zollwert und ohne Bewertungsmethode.',
    aenderung: {
      rechnung: {
        positionen: [
          { nr: 1, beschreibung: 'Hydraulikpumpe Typ HP-40', menge: 12, einheit: 'PCE', einzelpreis: 1450, netto: 17400, hs6: '841330', ursprung: 'DE' },
          { nr: 2, beschreibung: 'Dichtungssatz HP-40', menge: 12, einheit: 'PCE', einzelpreis: 85, netto: 1020, hs6: '848420', ursprung: 'DE' },
          { nr: 3, beschreibung: 'Ersatzdichtung, kostenlos', menge: 2, einheit: 'PCE', einzelpreis: 0, netto: 0, hs6: '848420', ursprung: 'DE', zollwert: null, bewertungsmethode: null },
        ],
      },
      packliste: {
        positionen: [
          { nr: 1, menge: 12, hs6: '841330' },
          { nr: 2, menge: 12, hs6: '848420' },
          { nr: 3, menge: 2, hs6: '848420' },
        ],
      },
      praeferenznachweis: {
        warenkreis: [
          { pos: 1, hs6: '841330' },
          { pos: 2, hs6: '848420' },
          { pos: 3, hs6: '848420' },
        ],
      },
      abd: {
        positionen: [
          { nr: 1, warennummer: '84133080', menge: 12 },
          { nr: 2, warennummer: '84842000', menge: 12 },
          { nr: 3, warennummer: '84842000', menge: 2 },
        ],
      },
      erwartung: { freigabe: 'blockiert', regeln: ['VAL-03'] },
    },
  }),
  grundfall({
    id: 'ZP-2026-0008',
    beschreibung: 'ABD-Abweichung: Die Ausfuhranmeldung nennt einen anderen (gültigen) Container als Packliste und B/L. Angemeldet ist ein anderer Vorgang als verladen wird.',
    aenderung: { abd: { container_id: CONTAINER_B }, erwartung: { freigabe: 'blockiert', regeln: ['CUS-05'] } },
  }),
];

const namen = {
  'ZP-2026-0001': 'happy-path',
  'ZP-2026-0002': 'praeferenznachweis-fehlt',
  'ZP-2026-0003': 'ursprungswiderspruch',
  'ZP-2026-0004': 'container-abweichung',
  'ZP-2026-0005': 'draft-bl',
  'ZP-2026-0006': 'schlechter-scan',
  'ZP-2026-0007': 'kostenlose-position',
  'ZP-2026-0008': 'abd-abweichung',
};

for (const akte of akten) {
  const datei = join(ziel, `${namen[akte.akte_id]}.json`);
  writeFileSync(datei, `${JSON.stringify(akte, null, 2)}\n`);
  console.log(`  ${namen[akte.akte_id]}.json  (${akte.assertions.length} Assertions)`);
}
