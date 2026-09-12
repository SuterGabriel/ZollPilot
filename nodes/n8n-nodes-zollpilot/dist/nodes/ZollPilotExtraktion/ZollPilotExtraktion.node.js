"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZollPilotExtraktion = void 0;
exports.ausJson = ausJson;
exports.liesPfad = liesPfad;
const QUELLE_JSON = 'json';
const QUELLE_BINAER = 'binaer';
const PFAD_AKTE = '/extraktion/akte';
class ZollPilotExtraktion {
    description = {
        displayName: 'ZollPilot Extraktion',
        name: 'zollPilotExtraktion',
        icon: 'file:zollpilot.svg',
        group: ['transform'],
        version: 1,
        subtitle: '={{ $parameter["quelle"] === "binaer" ? "Binärdateien des Items" : "JSON: dateien[]" }}',
        description: 'Schickt Belege (PDF) an den ZollPilot-Extraktionsdienst und liefert die Akte mit Dokumenten und Assertions zurück. Transport, keine Entscheidung.',
        defaults: { name: 'Belege extrahieren' },
        inputs: ['main'],
        outputs: ['main'],
        credentials: [{ name: 'zollPilotExtraktionApi', required: true }],
        properties: [
            {
                displayName: 'Quelle der Belege',
                name: 'quelle',
                type: 'options',
                options: [
                    {
                        name: 'JSON-Feld dateien[]',
                        value: QUELLE_JSON,
                        description: 'Das Item trägt {akte, dateien: [{name, inhalt_base64}]}, zum Beispiel aus „Belege verpacken“ oder aus einer Wiedervorlage',
                    },
                    {
                        name: 'Binärdateien des Items',
                        value: QUELLE_BINAER,
                        description: 'Jede Binärdatei des Items wird ein Beleg; die Stammdaten kommen aus dem Feld unten',
                    },
                ],
                default: QUELLE_JSON,
            },
            {
                displayName: 'Feld mit den Stammdaten',
                name: 'akteFeld',
                type: 'string',
                default: 'akte',
                displayOptions: { show: { quelle: [QUELLE_BINAER] } },
                description: 'Pfad im JSON des Items (Punkte erlaubt). Ein String wird als JSON gelesen.',
            },
            {
                displayName: 'Zeitlimit (ms)',
                name: 'zeitlimit',
                type: 'number',
                default: 120000,
                description: 'Ein Scan durch Tesseract dauert. Der Proxy der Oberfläche bricht bei 180 s ab.',
            },
        ],
    };
    async execute() {
        const items = this.getInputData();
        const ausgabe = [];
        const zugang = (await this.getCredentials('zollPilotExtraktionApi'));
        const basis = String(zugang.basisUrl ?? '').replace(/\/+$/, '');
        if (!basis)
            throw new Error('Die Credential „ZollPilot Extraktion“ nennt keine Basis-URL.');
        for (let i = 0; i < items.length; i += 1) {
            try {
                const quelle = this.getNodeParameter('quelle', i);
                const zeitlimit = this.getNodeParameter('zeitlimit', i);
                const rumpf = quelle === QUELLE_BINAER
                    ? await ausBinaer(this, i, this.getNodeParameter('akteFeld', i))
                    : ausJson(items[i].json);
                const anfrage = {
                    method: 'POST',
                    url: `${basis}${PFAD_AKTE}`,
                    body: rumpf,
                    json: true,
                    timeout: zeitlimit,
                    headers: zugang.token ? { Authorization: `Bearer ${zugang.token}` } : {},
                };
                const akte = (await this.helpers.httpRequest(anfrage));
                ausgabe.push({ json: akte, pairedItem: { item: i } });
            }
            catch (fehler) {
                // Mit continueErrorOutput leitet n8n Items mit `error` auf den
                // Fehlerausgang; der Prüf-Workflow schreibt sie nach workflow_fehler
                // und in die Wiedervorlage.
                if (this.continueOnFail()) {
                    ausgabe.push({ json: { error: meldung(fehler) }, pairedItem: { item: i } });
                    continue;
                }
                throw fehler;
            }
        }
        return [ausgabe];
    }
}
exports.ZollPilotExtraktion = ZollPilotExtraktion;
/** Das Item trägt den Rumpf schon, direkt oder unter `body` (Webhook). */
function ausJson(json) {
    const body = json.body ?? json;
    const dateien = body.dateien;
    if (!Array.isArray(dateien) || dateien.length === 0) {
        throw new Error('Kein Feld dateien[] im Item. Erwartet: {akte, dateien: [{name, inhalt_base64}]}.');
    }
    for (const d of dateien) {
        if (typeof d?.name !== 'string' || typeof d?.inhalt_base64 !== 'string') {
            throw new Error('Jeder Eintrag in dateien[] braucht name und inhalt_base64.');
        }
    }
    return { akte: liesAkte(body.akte), dateien: dateien };
}
/** Die Binärdateien des Items werden Belege; die Stammdaten stehen im JSON. */
async function ausBinaer(ctx, i, akteFeld) {
    const item = ctx.getInputData()[i];
    const dateien = [];
    for (const [schluessel, binaer] of Object.entries(item.binary ?? {})) {
        const puffer = await ctx.helpers.getBinaryDataBuffer(i, schluessel);
        dateien.push({ name: binaer.fileName ?? `${schluessel}.pdf`, inhalt_base64: puffer.toString('base64') });
    }
    if (dateien.length === 0)
        throw new Error('Das Item trägt keine Binärdateien.');
    return { akte: liesAkte(liesPfad(item.json, akteFeld)), dateien };
}
function liesAkte(roh) {
    if (typeof roh === 'string')
        return JSON.parse(roh);
    if (roh && typeof roh === 'object')
        return roh;
    return {};
}
function liesPfad(quelle, pfad) {
    return pfad
        .split('.')
        .filter(Boolean)
        .reduce((akt, teil) => (akt && typeof akt === 'object' ? akt[teil] : undefined), quelle);
}
function meldung(fehler) {
    return fehler instanceof Error ? fehler.message : String(fehler);
}
