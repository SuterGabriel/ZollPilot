// Register der implementierten Regeln. Der Katalog (rules.yaml) bestimmt, was
// gilt; dieses Register sagt, was prüfbar ist. scripts/regel-check.mjs stellt
// sicher, dass beide Listen deckungsgleich sind.

import { pruefeVAL01 } from './VAL-01.mjs';
import { pruefeVAL03 } from './VAL-03.mjs';
import { pruefeORG02 } from './ORG-02.mjs';
import { pruefeORG03 } from './ORG-03.mjs';
import { pruefeORG06 } from './ORG-06.mjs';
import { pruefeCLS01 } from './CLS-01.mjs';
import { pruefeCLS02 } from './CLS-02.mjs';
import { pruefeQTY01 } from './QTY-01.mjs';
import { pruefeQTY02 } from './QTY-02.mjs';
import { pruefeQTY03 } from './QTY-03.mjs';
import { pruefeTRN01 } from './TRN-01.mjs';
import { pruefeTRN02 } from './TRN-02.mjs';
import { pruefeREF03 } from './REF-03.mjs';
import { pruefeCUS05 } from './CUS-05.mjs';

export const REGELN = Object.freeze({
  'VAL-01': pruefeVAL01,
  'VAL-03': pruefeVAL03,
  'ORG-02': pruefeORG02,
  'ORG-03': pruefeORG03,
  'ORG-06': pruefeORG06,
  'CLS-01': pruefeCLS01,
  'CLS-02': pruefeCLS02,
  'QTY-01': pruefeQTY01,
  'QTY-02': pruefeQTY02,
  'QTY-03': pruefeQTY03,
  'TRN-01': pruefeTRN01,
  'TRN-02': pruefeTRN02,
  'REF-03': pruefeREF03,
  'CUS-05': pruefeCUS05,
});
