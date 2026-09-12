// Lädt den Katalog aus den YAML-Dateien an der Repo-Wurzel. Nicht Teil des
// n8n-Bundles: Dort wird derselbe Inhalt als JSON eingebettet
// (scripts/n8n-bundle.mjs), weil ein Code-Node kein Dateisystem hat.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';

export const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');

export function ladeKatalog(wurzel = WURZEL) {
  const lies = (name) => parse(readFileSync(join(wurzel, name), 'utf8'));
  return {
    regeln: lies('rules.yaml'),
    pflichtmatrix: lies('pflichtmatrix.yaml'),
    zustaendigkeiten: lies('zustaendigkeiten.yaml'),
  };
}
