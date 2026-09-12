#!/usr/bin/env bash
# Richtet die Git-Hooks aus .githooks/ ein.
#
# Git sucht Hooks standardmäßig in .git/hooks/, und dieses Verzeichnis liegt
# außerhalb der Versionierung. Ein Hook, der dort liegt, existiert für niemanden
# sonst. core.hooksPath verlegt die Suche in ein Verzeichnis, das mitcheckt.
#
# Der Preis: ein Schritt nach dem Klonen. Ohne Paketmanager gibt es hier kein
# npm install, das ihn nebenbei erledigt. Dass dieser Schritt nötig ist, steht
# in docs/PIPELINE.md.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

git config core.hooksPath .githooks
chmod +x .githooks/* 2>/dev/null || true

echo "core.hooksPath zeigt jetzt auf .githooks/"
echo
echo "Prüfung, ob der Hook greift:"
if [[ -x .githooks/pre-commit ]] || [[ -f .githooks/pre-commit ]]; then
  echo "  ok    .githooks/pre-commit liegt bereit"
else
  echo "  FEHLT .githooks/pre-commit"
  exit 1
fi
echo
echo "Umgehen im Einzelfall: git commit --no-verify"
