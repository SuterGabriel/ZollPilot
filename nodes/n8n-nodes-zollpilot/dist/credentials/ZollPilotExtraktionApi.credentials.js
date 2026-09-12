"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZollPilotExtraktionApi = void 0;
class ZollPilotExtraktionApi {
    name = 'zollPilotExtraktionApi';
    displayName = 'ZollPilot Extraktion';
    documentationUrl = 'https://github.com/SuterGabriel/ZollPilot/blob/main/docs/EXTRAKTION.md';
    properties = [
        {
            displayName: 'Basis-URL',
            name: 'basisUrl',
            type: 'string',
            default: 'http://extraktion:8080',
            placeholder: 'http://extraktion:8080',
            description: 'Adresse des Extraktionsdienstes ohne Pfad. Im Compose-Netz ist das der Dienstname.',
        },
        {
            displayName: 'Token',
            name: 'token',
            type: 'string',
            typeOptions: { password: true },
            default: '',
            description: 'Wird als Bearer-Token mitgeschickt. Der Dienst im Repo prüft ihn nicht (docs/OFFENE-PUNKTE.md: ohne Authentifizierung); ein Dienst hinter einem Gateway schon.',
        },
    ];
    // „Credential testen“ in n8n: GET /healthz muss ok antworten.
    test = {
        request: {
            baseURL: '={{ $credentials.basisUrl }}',
            url: '/healthz',
        },
    };
}
exports.ZollPilotExtraktionApi = ZollPilotExtraktionApi;
