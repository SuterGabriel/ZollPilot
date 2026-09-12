"""Gemeinsame Fixtures: Pfade, Golden Set, Belege.

Die Belege unter testdaten/belege/ entstehen aus testdaten/erzeuge-belege.py.
Fehlen sie, erzeugt die Fixture sie — damit ein frischer Klon `pytest`
ausführen kann, ohne die Reihenfolge zu kennen.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from zollpilot_extraktion.lesen import ocr_version

WURZEL = Path(__file__).resolve().parents[2]
AKTEN = WURZEL / "testdaten" / "akten"
BELEGE = WURZEL / "testdaten" / "belege"
GENERATOR = WURZEL / "testdaten" / "erzeuge-belege.py"

OHNE_OCR = pytest.mark.skipif(ocr_version() is None, reason="Tesseract nicht installiert")


@pytest.fixture(scope="session")
def belege() -> Path:
    if not BELEGE.exists() or not any(BELEGE.iterdir()):
        subprocess.run([sys.executable, str(GENERATOR)], check=True, cwd=WURZEL)
    return BELEGE


@pytest.fixture(scope="session")
def golden() -> dict[str, dict]:
    return {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in sorted(AKTEN.glob("*.json"))}


def lade(ordner: Path) -> tuple[dict, list[tuple[str, bytes]], list[dict]]:
    stammdaten = json.loads((ordner / "akte.json").read_text(encoding="utf-8"))
    dateien = [(p.name, p.read_bytes()) for p in sorted(ordner.glob("*.pdf"))]
    erwartet = json.loads((ordner / "erwartet.json").read_text(encoding="utf-8"))
    return stammdaten, dateien, erwartet
