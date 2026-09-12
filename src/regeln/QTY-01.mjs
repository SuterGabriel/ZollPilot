// QTY-01 Menge Rechnung gegen Packliste.
// Je Position: Rechnungsmenge = Packlistenmenge − dokumentierte Backorders.
// Stückware kennt keine Toleranz (docs/03, Toleranzprofil).

import { fakt } from '../akte/aufbau.mjs';
import { ok, verletzt, nichtPruefbar } from './befund.mjs';

export const REGEL_QTY_01 = 'QTY-01';

export function pruefeQTY01(akte) {
  const rechnung = fakt(akte, 'rechnung.positionen');
  const packliste = fakt(akte, 'packliste.positionen');
  const eingaben = { 'rechnung.positionen': rechnung, 'packliste.positionen': packliste };
  const offen = [!rechnung && 'rechnung.positionen', !packliste && 'packliste.positionen'].filter(Boolean);
  if (offen.length > 0) return nichtPruefbar(eingaben, offen, 'Rechnungs- oder Packlistenpositionen fehlen');

  const backorders = fakt(akte, 'packliste.backorders') ?? [];
  const abweichungen = [];
  rechnung.forEach((p, i) => {
    const pack = packliste.find((q) => q.nr === p.nr);
    if (!pack) {
      abweichungen.push(`Position ${i + 1} fehlt in der Packliste`);
      return;
    }
    const backorder = backorders.find((b) => b.nr === p.nr)?.menge ?? 0;
    const erwartet = pack.menge - backorder;
    if (p.menge !== erwartet) {
      abweichungen.push(`Position ${i + 1}: Rechnung ${p.menge} ≠ Packliste ${pack.menge}${backorder ? ` − Backorder ${backorder}` : ''}`);
    }
  });

  if (abweichungen.length === 0) return ok(eingaben, 'Mengen je Position identisch');
  return verletzt(eingaben, abweichungen.join('; '));
}
