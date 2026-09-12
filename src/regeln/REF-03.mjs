// REF-03 Nur finale Dokumentversionen speisen kanonische Fakten.
// Der Aktenaufbau (src/akte/aufbau.mjs) lässt Assertions aus Drafts nie zu
// Fakten werden. Diese Regel macht das sichtbar: Ein Draft, der Werte trägt,
// für die kein finales Dokument desselben Typs existiert, ist ein Befund —
// die Akte stützt sich sonst stillschweigend auf nichts.

import { dokumenteVomTyp } from '../akte/aufbau.mjs';
import { ok, verletzt } from './befund.mjs';

export const REGEL_REF_03 = 'REF-03';

export function pruefeREF03(akte) {
  const nichtFinal = akte.nicht_final ?? [];
  const typenOhneFinal = new Set();
  for (const assertion of nichtFinal) {
    const finale = dokumenteVomTyp(akte, assertion.dokument_typ, true);
    if (finale.length === 0) typenOhneFinal.add(`${assertion.dokument_typ} (${assertion.dokument}, Status ${assertion.dokument_status})`);
  }
  const eingaben = { assertions_nicht_final: nichtFinal.length, typen_ohne_finale_fassung: [...typenOhneFinal] };
  if (typenOhneFinal.size === 0) {
    return ok(eingaben, nichtFinal.length > 0
      ? `${nichtFinal.length} Assertions aus Drafts ignoriert, finale Fassungen liegen vor`
      : 'Alle Fakten stammen aus finalen Dokumenten');
  }
  return verletzt(eingaben, `Nur Entwurf vorhanden für: ${[...typenOhneFinal].join(', ')} — Draft darf keine Anmeldegrundlage sein`);
}
