// CUS-05 Das Ausfuhrbegleitdokument beschreibt dieselbe Sendung wie Rechnung
// und Packliste.
//
// Das ABD ist die lesbare Fassung der überlassenen Ausfuhranmeldung; was
// dort steht, ist angemeldet. Weicht die Warennummer von der Rechnung ab oder
// der Container von der Packliste, ist ein anderer Zollvorgang angemeldet als
// verladen wird. Verglichen werden die ersten `parameters.digits` Stellen der
// Warennummer (die Rechnung trägt HS-6, das ABD die achtstellige KN) und die
// normalisierte Containernummer.
//
// Beide Werte kommen aus der Extraktion; deshalb der Konfidenzpfad
// (CLAUDE.md, harte Grenze 3): Eine unsicher gelesene Warennummer ist zuerst
// ein Lesefehler. Die MRN selbst wird hier nicht geprüft; ihre Struktur
// sichert die Normalisierung, ihr Vorhandensein die Pflichtmatrix (PFL-07).

import { fakt } from '../akte/aufbau.mjs';
import { kuerzeWarencode } from '../normalisierung.mjs';
import { normalisiereContainerId } from '../validatoren/container.mjs';
import { ok, nichtPruefbar, verletztWennSicher } from './befund.mjs';

export const REGEL_CUS_05 = 'CUS-05';

export function pruefeCUS05(akte, regel, defaults) {
  const stellen = regel.parameters.digits;
  const abdPositionen = fakt(akte, 'abd.positionen');
  const abdContainer = fakt(akte, 'abd.container_id');
  if (!abdPositionen && !abdContainer) {
    return nichtPruefbar({}, ['abd.positionen', 'abd.container_id'], 'Kein Ausfuhrbegleitdokument in der Akte');
  }
  const rechnung = fakt(akte, 'rechnung.positionen');
  if (!rechnung) return nichtPruefbar({}, ['rechnung.positionen'], 'Rechnungspositionen fehlen');

  const packContainer = fakt(akte, 'packliste.container_id');
  const eingaben = { stellen, positionen_abd: (abdPositionen ?? []).length, positionen_rechnung: rechnung.length };
  const abweichungen = [];
  const beteiligt = [];

  (abdPositionen ?? []).forEach((p, i) => {
    const angemeldet = kuerzeWarencode(p.warennummer, stellen);
    const rechnungIndex = rechnung.findIndex((q) => q.nr === p.nr);
    const gegenstueck = rechnung[rechnungIndex];
    if (!gegenstueck) {
      abweichungen.push(`Position ${p.nr} nur im ABD`);
      beteiligt.push(`abd.positionen.${i}.nr`);
      return;
    }
    const berechnet = kuerzeWarencode(gegenstueck.hs6, stellen);
    if (!angemeldet) {
      abweichungen.push(`Position ${p.nr}: Warennummer auf dem ABD fehlt oder ist unlesbar`);
      beteiligt.push(`abd.positionen.${i}.warennummer`);
      return;
    }
    if (berechnet && angemeldet !== berechnet) {
      abweichungen.push(`Position ${p.nr}: Rechnung ${berechnet}, ABD ${angemeldet}`);
      beteiligt.push(`abd.positionen.${i}.warennummer`, `rechnung.positionen.${rechnungIndex}.hs6`);
    }
  });
  rechnung.forEach((q, i) => {
    if (!(abdPositionen ?? []).some((p) => p.nr === q.nr)) {
      abweichungen.push(`Position ${q.nr} nur auf der Rechnung`);
      beteiligt.push(`rechnung.positionen.${i}.nr`);
    }
  });

  let containerText = 'Container nicht vergleichbar, Packliste oder ABD nennt keinen';
  if (abdContainer && packContainer) {
    const abd = normalisiereContainerId(abdContainer);
    const pack = normalisiereContainerId(packContainer);
    if (abd === pack) {
      containerText = `Container ${abd} auf ABD und Packliste`;
    } else {
      abweichungen.push(`Container: ABD ${abd}, Packliste ${pack}`);
      beteiligt.push('abd.container_id', 'packliste.container_id');
    }
  }

  if (abweichungen.length === 0) {
    return ok(eingaben, `${rechnung.length} Positionen auf HS-${stellen} angemeldet wie berechnet; ${containerText}`);
  }
  return verletztWennSicher(akte, beteiligt, defaults, eingaben, abweichungen.join('; '));
}
