import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalisiereFirmenname, normalisiereBetrag, kuerzeWarencode, normalisiereLand, gleichBisAuf } from '../src/normalisierung.mjs';

test('Firmenname: Rechtsform, Groß-/Kleinschreibung und Satzzeichen fallen weg', () => {
  assert.equal(normalisiereFirmenname('Nordlicht Maschinenbau GmbH'), 'nordlicht maschinenbau');
  assert.equal(normalisiereFirmenname('NORDLICHT  Maschinenbau, GmbH & Co. KG'), 'nordlicht maschinenbau');
  assert.equal(normalisiereFirmenname('Aurora Trading Pte. Ltd.'), 'aurora trading pte');
  assert.equal(normalisiereFirmenname(''), '');
});

test('Betrag: deutsche und englische Schreibweise ergeben dieselbe Zahl', () => {
  assert.equal(normalisiereBetrag('1.250,00'), 1250);
  assert.equal(normalisiereBetrag('1,250.00'), 1250);
  assert.equal(normalisiereBetrag('EUR 18.420,50'), 18420.5);
  assert.equal(normalisiereBetrag('1250'), 1250);
  assert.equal(normalisiereBetrag(1250), 1250);
  assert.equal(normalisiereBetrag(''), null);
  assert.equal(normalisiereBetrag('abc'), null);
});

test('Warencode: auf gemeinsame Stellenzahl kürzen', () => {
  assert.equal(kuerzeWarencode('8413.30.80', 6), '841330');
  assert.equal(kuerzeWarencode('84133080', 8), '84133080');
  assert.equal(kuerzeWarencode('8413 30', 6), '841330');
  assert.equal(kuerzeWarencode('HS-8413', 6), null);
});

test('Land: ISO alpha-2, "EU" ist formal zwei Buchstaben, aber kein Mitgliedstaat', () => {
  assert.equal(normalisiereLand(' de '), 'DE');
  assert.equal(normalisiereLand('Deutschland'), null);
  // Bewusst: die Normalisierung kennt keine Länderliste. Dass "EU" kein
  // Ursprungsland ist, prüft eine Regel, nicht die Normalisierung.
  assert.equal(normalisiereLand('EU'), 'EU');
});

test('gleichBisAuf: Toleranz inklusiv, null nie gleich', () => {
  assert.equal(gleichBisAuf(100, 100.01, 0.01), true);
  assert.equal(gleichBisAuf(100, 100.02, 0.01), false);
  assert.equal(gleichBisAuf(null, 0, 1), false);
});
