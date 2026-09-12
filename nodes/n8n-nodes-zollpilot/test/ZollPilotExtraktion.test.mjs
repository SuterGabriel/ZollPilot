// Der Node läuft hier ohne n8n: `this` ist ein Nachbau der Ausführungsfunktionen,
// der die HTTP-Anfrage mitschreibt statt sie zu schicken. Geprüft wird das,
// was der Node verspricht: den Rumpf richtig bauen, die Adresse aus der
// Credential nehmen, den Token nur schicken, wenn es einen gibt, und bei
// Fehlern nichts erfinden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const NODE_DATEI = join(wurzel, 'dist/nodes/ZollPilotExtraktion/ZollPilotExtraktion.node.js');
const CRED_DATEI = join(wurzel, 'dist/credentials/ZollPilotExtraktionApi.credentials.js');
const { ZollPilotExtraktion, ausJson, liesPfad } = require(NODE_DATEI);
const { ZollPilotExtraktionApi } = require(CRED_DATEI);

const PDF = Buffer.from('%PDF-1.4 synthetisch').toString('base64');

function nachbau({ items, params = {}, zugang, antwort = { akte_id: 'ZP-1', dokumente: [], assertions: [] }, fehler, weiterBeiFehler = false }) {
  const anfragen = [];
  const ctx = {
    getInputData: () => items,
    getNodeParameter: (name) => ({ quelle: 'json', zeitlimit: 120000, akteFeld: 'akte', ...params })[name],
    getCredentials: async () => zugang ?? { basisUrl: 'http://extraktion:8080', token: '' },
    continueOnFail: () => weiterBeiFehler,
    getNode: () => ({ name: 'Belege extrahieren' }),
    helpers: {
      httpRequest: async (optionen) => {
        anfragen.push(optionen);
        if (fehler) throw fehler;
        return antwort;
      },
      getBinaryDataBuffer: async (i, schluessel) => Buffer.from(items[i].binary[schluessel].data, 'base64'),
    },
  };
  return { ctx, anfragen };
}

const laufe = (n) => new ZollPilotExtraktion().execute.call(n.ctx);

test('Beschreibung: Transport-Node ohne Fachparameter, Credential ist Pflicht', () => {
  const d = new ZollPilotExtraktion().description;
  assert.equal(d.name, 'zollPilotExtraktion');
  assert.equal(d.defaults.name, 'Belege extrahieren');
  assert.deepEqual(d.credentials, [{ name: 'zollPilotExtraktionApi', required: true }]);
  const namen = d.properties.map((p) => p.name);
  assert.deepEqual(namen, ['quelle', 'akteFeld', 'zeitlimit']);
  for (const verboten of ['belegtyp', 'konfidenz', 'schwelle']) {
    assert.ok(!JSON.stringify(d).toLowerCase().includes(verboten), `Fachparameter ${verboten} gehört nicht in den Node`);
  }
});

test('JSON-Quelle: Rumpf {akte, dateien} geht unverändert an /extraktion/akte', async () => {
  const items = [{ json: { akte: { akte_id: 'ZP-1' }, dateien: [{ name: 'rechnung.pdf', inhalt_base64: PDF }] } }];
  const n = nachbau({ items });
  const [ausgabe] = await laufe(n);
  assert.equal(n.anfragen.length, 1);
  assert.equal(n.anfragen[0].method, 'POST');
  assert.equal(n.anfragen[0].url, 'http://extraktion:8080/extraktion/akte');
  assert.deepEqual(n.anfragen[0].body, items[0].json);
  assert.equal(n.anfragen[0].timeout, 120000);
  assert.deepEqual(n.anfragen[0].headers, {});
  assert.equal(ausgabe[0].json.akte_id, 'ZP-1');
  assert.deepEqual(ausgabe[0].pairedItem, { item: 0 });
});

test('JSON-Quelle: Webhook-Rumpf unter body und Stammdaten als String werden gelesen', () => {
  const rumpf = ausJson({ body: { akte: '{"akte_id":"ZP-2"}', dateien: [{ name: 'a.pdf', inhalt_base64: PDF }] } });
  assert.deepEqual(rumpf.akte, { akte_id: 'ZP-2' });
  assert.equal(rumpf.dateien.length, 1);
});

test('JSON-Quelle: ohne dateien[] oder mit kaputtem Eintrag ist es ein Fehler, keine leere Akte', () => {
  assert.throws(() => ausJson({ akte: {} }), /dateien\[\]/);
  assert.throws(() => ausJson({ akte: {}, dateien: [] }), /dateien\[\]/);
  assert.throws(() => ausJson({ akte: {}, dateien: [{ name: 'a.pdf' }] }), /inhalt_base64/);
});

test('Binär-Quelle: jede Binärdatei wird ein Beleg, Stammdaten aus dem benannten Feld', async () => {
  const items = [{
    json: { body: { akte: '{"akte_id":"ZP-3"}' } },
    binary: {
      dateien0: { fileName: 'rechnung.pdf', data: PDF },
      dateien1: { data: PDF },
    },
  }];
  const n = nachbau({ items, params: { quelle: 'binaer', akteFeld: 'body.akte' } });
  await laufe(n);
  const { body } = n.anfragen[0];
  assert.deepEqual(body.akte, { akte_id: 'ZP-3' });
  assert.deepEqual(body.dateien.map((d) => d.name), ['rechnung.pdf', 'dateien1.pdf']);
  assert.equal(body.dateien[0].inhalt_base64, PDF);
});

test('Token wird nur geschickt, wenn die Credential einen hat; Basis-URL ohne Schrägstrich am Ende', async () => {
  const items = [{ json: { akte: {}, dateien: [{ name: 'a.pdf', inhalt_base64: PDF }] } }];
  const n = nachbau({ items, zugang: { basisUrl: 'https://idp.example.test/', token: 'geheim' } });
  await laufe(n);
  assert.equal(n.anfragen[0].url, 'https://idp.example.test/extraktion/akte');
  assert.deepEqual(n.anfragen[0].headers, { Authorization: 'Bearer geheim' });
});

test('Ohne Basis-URL läuft nichts los', async () => {
  const n = nachbau({ items: [{ json: {} }], zugang: { basisUrl: '' } });
  await assert.rejects(() => laufe(n), /Basis-URL/);
  assert.equal(n.anfragen.length, 0);
});

test('Dienst nicht erreichbar: ohne continueOnFail wirft der Node, mit ihm liefert er ein Item mit error', async () => {
  const items = [{ json: { akte: {}, dateien: [{ name: 'a.pdf', inhalt_base64: PDF }] } }];
  const hart = nachbau({ items, fehler: new Error('getaddrinfo ENOTFOUND extraktion') });
  await assert.rejects(() => laufe(hart), /ENOTFOUND/);

  const weich = nachbau({ items, fehler: new Error('getaddrinfo ENOTFOUND extraktion'), weiterBeiFehler: true });
  const [ausgabe] = await laufe(weich);
  assert.equal(ausgabe.length, 1);
  assert.match(ausgabe[0].json.error, /ENOTFOUND/);
  assert.equal(Object.keys(ausgabe[0].json).length, 1, 'kein erfundenes Ergebnis neben dem Fehler');
});

test('Mehrere Items: jedes bekommt seine eigene Anfrage und sein pairedItem', async () => {
  const beleg = { akte: {}, dateien: [{ name: 'a.pdf', inhalt_base64: PDF }] };
  const n = nachbau({ items: [{ json: beleg }, { json: beleg }, { json: beleg }] });
  const [ausgabe] = await laufe(n);
  assert.equal(n.anfragen.length, 3);
  assert.deepEqual(ausgabe.map((a) => a.pairedItem.item), [0, 1, 2]);
});

test('liesPfad folgt Punkten, liefert undefined statt zu werfen, und bei leerem Pfad das Objekt selbst', () => {
  assert.equal(liesPfad({ a: { b: 1 } }, 'a.b'), 1);
  assert.equal(liesPfad({ a: null }, 'a.b'), undefined);
  assert.equal(liesPfad({ a: 1 }, 'x.y'), undefined);
  const json = { akte_id: 'ZP-4' };
  assert.equal(liesPfad(json, ''), json, 'leeres Feld heißt: das ganze JSON sind die Stammdaten');
});

test('Credential: Name, Felder, Test gegen /healthz', () => {
  const c = new ZollPilotExtraktionApi();
  assert.equal(c.name, 'zollPilotExtraktionApi');
  assert.deepEqual(c.properties.map((p) => p.name), ['basisUrl', 'token']);
  assert.equal(c.properties[1].typeOptions.password, true);
  assert.equal(c.test.request.url, '/healthz');
});

test('dist/ importiert n8n-workflow nicht zur Laufzeit: im Erweiterungsverzeichnis löst es nicht auf', () => {
  for (const datei of [NODE_DATEI, CRED_DATEI]) {
    const quelle = readFileSync(datei, 'utf8');
    assert.ok(!/require\(["']n8n-workflow["']\)/.test(quelle), `${datei} verlangt n8n-workflow`);
  }
});
