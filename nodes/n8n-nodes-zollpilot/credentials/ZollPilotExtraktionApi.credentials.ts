// Credential-Typ für den Extraktionsdienst. Nur Typen aus n8n-workflow:
// Im Erweiterungsverzeichnis von n8n (N8N_CUSTOM_EXTENSIONS) löst `require`
// das Paket nicht auf, also darf zur Laufzeit nichts daraus importiert werden.
import type { ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

export class ZollPilotExtraktionApi implements ICredentialType {
  name = 'zollPilotExtraktionApi';

  displayName = 'ZollPilot Extraktion';

  documentationUrl = 'https://github.com/SuterGabriel/ZollPilot/blob/main/docs/EXTRAKTION.md';

  properties: INodeProperties[] = [
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
      description:
        'Wird als Bearer-Token mitgeschickt. Der Dienst im Repo prüft ihn nicht (docs/OFFENE-PUNKTE.md: ohne Authentifizierung); ein Dienst hinter einem Gateway schon.',
    },
  ];

  // „Credential testen“ in n8n: GET /healthz muss ok antworten.
  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{ $credentials.basisUrl }}',
      url: '/healthz',
    },
  };
}
