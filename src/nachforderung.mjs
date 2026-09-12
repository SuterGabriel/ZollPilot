// Nachforderung: aus Befunden werden konkrete Anforderungen an den
// Dateninhaber. Nie "bitte alle Zollunterlagen" — immer Feld, Position, Grund,
// akzeptierte Nachweise und Folge bei Fristüberschreitung (docs/05).

import { liesPfad } from './akte/aufbau.mjs';

function zustaendig(pfad, zustaendigkeiten) {
  const praefix = String(pfad).split('.')[0];
  return zustaendigkeiten.owners[praefix] ?? { primaer: 'Sachbearbeitung Export', sekundaer: null, ausloeser: null };
}

export function formuliereNachforderungen(ergebnis, zustaendigkeiten) {
  const faelle = [];

  for (const befund of ergebnis.pflichtmatrix.befunde) {
    if (befund.status === 'ok') continue;
    faelle.push({
      grund: befund.id,
      feld: befund.required_data,
      adressat: zustaendig(befund.required_data, zustaendigkeiten),
      anforderung: befund.label,
      widerspruch: befund.begruendung,
      akzeptierte_nachweise: befund.akzeptierte_nachweise,
      folge: befund.haerte === 'hard' ? 'Keine Freigabe der Akte' : 'Freigabe mit Vermerk',
    });
  }

  for (const befund of ergebnis.befunde) {
    if (befund.status === 'ok') continue;
    const pfade = befund.fehlende_pfade ?? befund.nachzulesende_pfade ?? Object.keys(befund.eingaben ?? {}).filter((k) => k.includes('.'));
    const feld = pfade[0] ?? befund.regel;
    faelle.push({
      grund: befund.regel,
      feld,
      adressat: befund.status === 're_extraction_required'
        ? { primaer: 'Extraktion (Nachlesen)', sekundaer: 'Sachbearbeitung Export', ausloeser: 'sofort' }
        : zustaendig(feld, zustaendigkeiten),
      anforderung: befund.name,
      widerspruch: befund.begruendung,
      akzeptierte_nachweise: befund.inputs,
      folge: befund.haerte_effektiv === 'hard' ? `Keine Freigabe: ${befund.konsequenz}` : `Warnung: ${befund.konsequenz}`,
    });
  }

  const eskalation = zustaendigkeiten.escalation?.[0] ?? null;
  return faelle.map((fall) => {
    const mitBetreff = {
      ...fall,
      stufe: eskalation?.stufe ?? 'erinnerung_0',
      betreff: `ACTION REQUIRED – ${fall.anforderung} – Shipment ${ergebnis.akte_id}`,
    };
    return { ...mitBetreff, text: nachforderungstext(mitBetreff, ergebnis) };
  });
}

export function nachforderungstext(fall, ergebnis) {
  const referenzen = [
    ['Invoice', liesPfad(ergebnis.referenzen, 'rechnung')],
    ['B/L', liesPfad(ergebnis.referenzen, 'bill_of_lading')],
    ['Container', liesPfad(ergebnis.referenzen, 'container')],
  ].filter(([, wert]) => wert).map(([name, wert]) => `${name} ${wert}`).join(' / ');

  return [
    `Betreff: ${fall.betreff}`,
    '',
    `An: ${fall.adressat.primaer}${fall.adressat.sekundaer ? ` (Kopie: ${fall.adressat.sekundaer})` : ''}`,
    '',
    'Benötigt:',
    `- Dokument/Feld: ${fall.feld}`,
    `- Grund der Anforderung: ${fall.anforderung} (${fall.grund})`,
    `- Gefundener Widerspruch: ${fall.widerspruch}`,
    `- Akzeptierte Nachweise: ${(fall.akzeptierte_nachweise ?? []).join(', ') || 'siehe Regel'}`,
    `- Folge bei Fristüberschreitung: ${fall.folge}`,
    '',
    `Referenzen: ${referenzen || ergebnis.akte_id}`,
  ].join('\n');
}
