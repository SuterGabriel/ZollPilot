// QTY-01 Menge Rechnung gegen Packliste.
// Je Position: Rechnungsmenge = Packlistenmenge − dokumentierte Backorders.
// Stückware kennt keine Toleranz (docs/03, Toleranzprofil).
//
// Eine abweichende Menge kann ein Lesefehler sein — auf einem Scan sogar
// häufiger als ein echter Mengenfehler. Deshalb der Konfidenzpfad
// (CLAUDE.md, harte Grenze 3).

import { fakt } from '../akte/aufbau.mjs';
import { ok, nichtPruefbar, verletztWennSicher } from './befund.mjs';

export const REGEL_QTY_01 = 'QTY-01';

export function pruefeQTY01(akte, regel, defaults) {
  const rechnung = fakt(akte, 'rechnung.positionen');
  const packliste = fakt(akte, 'packliste.positionen');
  const eingaben = { 'rechnung.positionen': rechnung, 'packliste.positionen': packliste };
  const offen = [!rechnung && 'rechnung.positionen', !packliste && 'packliste.positionen'].filter(Boolean);
  if (offen.length > 0) return nichtPruefbar(eingaben, offen, 'Rechnungs- oder Packlistenpositionen fehlen');

  const backorders = fakt(akte, 'packliste.backorders') ?? [];
  const abweichungen = [];
  const beteiligt = [];
  rechnung.forEach((p, i) => {
    const packIndex = packliste.findIndex((q) => q.nr === p.nr);
    const pack = packliste[packIndex];
    if (!pack) {
      abweichungen.push(`Position ${i + 1} fehlt in der Packliste`);
      return;
    }
    const backorder = backorders.find((b) => b.nr === p.nr)?.menge ?? 0;
    const erwartet = pack.menge - backorder;
    if (p.menge !== erwartet) {
      abweichungen.push(`Position ${i + 1}: Rechnung ${p.menge} ≠ Packliste ${pack.menge}${backorder ? ` − Backorder ${backorder}` : ''}`);
      beteiligt.push(`rechnung.positionen.${i}.menge`, `packliste.positionen.${packIndex}.menge`);
    }
  });

  if (abweichungen.length === 0) return ok(eingaben, 'Mengen je Position identisch');
  return verletztWennSicher(akte, beteiligt, defaults, eingaben, abweichungen.join('; '));
}
