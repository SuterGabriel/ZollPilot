// tsc kopiert keine SVG-Dateien. n8n löst `icon: 'file:zollpilot.svg'` relativ
// zur kompilierten Node-Datei auf, also muss das Bild neben ihr in dist/ liegen.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const quelle = join(wurzel, 'nodes', 'ZollPilotExtraktion', 'zollpilot.svg');
const ziel = join(wurzel, 'dist', 'nodes', 'ZollPilotExtraktion', 'zollpilot.svg');
mkdirSync(dirname(ziel), { recursive: true });
copyFileSync(quelle, ziel);
console.log('Icon kopiert:', ziel);
