// QTY-03 Gewichtslogik: brutto ≥ netto > 0 je Packstück und gesamt.
// Reine Logikregel. Vertauschte Spalten sind die häufigste Ursache (docs/01)
// — und ein unscharf gelesenes Gewicht die zweithäufigste. Deshalb der
// Konfidenzpfad (CLAUDE.md, harte Grenze 3).

import { fakt } from '../akte/aufbau.mjs';
import { ok, nichtPruefbar, verletztWennSicher } from './befund.mjs';

export const REGEL_QTY_03 = 'QTY-03';

export function pruefeQTY03(akte, regel, defaults) {
  const packstuecke = fakt(akte, 'packliste.packstuecke');
  if (!packstuecke) return nichtPruefbar({}, ['packliste.packstuecke'], 'Packstücke fehlen');

  const fehler = [];
  const beteiligt = [];
  packstuecke.forEach((p, i) => {
    if (!(p.netto_kg > 0)) {
      fehler.push(`${p.id}: netto ${p.netto_kg} nicht > 0`);
      beteiligt.push(`packliste.packstuecke.${i}.netto_kg`);
    } else if (!(p.brutto_kg >= p.netto_kg)) {
      fehler.push(`${p.id}: brutto ${p.brutto_kg} < netto ${p.netto_kg}`);
      beteiligt.push(`packliste.packstuecke.${i}.brutto_kg`, `packliste.packstuecke.${i}.netto_kg`);
    }
  });
  const bruttoSumme = packstuecke.reduce((s, p) => s + (p.brutto_kg ?? 0), 0);
  const bruttoGesamt = fakt(akte, 'packliste.brutto_gesamt_kg');
  if (bruttoGesamt !== undefined && bruttoSumme > bruttoGesamt) {
    fehler.push(`Summe der Packstücke ${bruttoSumme} kg > Bruttogesamt ${bruttoGesamt} kg`);
    beteiligt.push('packliste.brutto_gesamt_kg', ...packstuecke.map((_, i) => `packliste.packstuecke.${i}.brutto_kg`));
  }
  const eingaben = { packstuecke: packstuecke.length, brutto_summe_kg: bruttoSumme, 'packliste.brutto_gesamt_kg': bruttoGesamt };
  if (fehler.length === 0) return ok(eingaben, 'brutto ≥ netto > 0 für alle Packstücke');
  return verletztWennSicher(akte, beteiligt, defaults, eingaben, fehler.join('; '));
}
