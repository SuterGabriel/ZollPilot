"""Extraktion von der Kommandozeile. Dieselbe Funktion wie im Dienst.

    python -m zollpilot_extraktion --ordner testdaten/belege/happy-path
    python -m zollpilot_extraktion --akte stammdaten.json rechnung.pdf packliste.pdf

Gibt die Akte als JSON aus. Mit --ohne-ocr bleiben Bildseiten leer (für
Umgebungen ohne Tesseract); die Akte meldet das im Dokument als Hinweis.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .akte import extrahiere_akte


def lade_ordner(ordner: Path) -> tuple[dict, list[tuple[str, bytes]]]:
    stammdaten = json.loads((ordner / "akte.json").read_text(encoding="utf-8"))
    dateien = [(p.name, p.read_bytes()) for p in sorted(ordner.glob("*.pdf"))]
    return stammdaten, dateien


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="zollpilot_extraktion")
    parser.add_argument("pdfs", nargs="*", help="PDF-Dateien der Akte")
    parser.add_argument("--akte", help="JSON mit den Stammdaten der Akte (akte_id, stichtag, sachverhalt, anmeldung)")
    parser.add_argument("--ordner", help="Ordner mit akte.json und PDFs, wie testdaten/belege/<name>/")
    parser.add_argument("--ohne-ocr", action="store_true", help="Bildseiten nicht per Tesseract lesen")
    args = parser.parse_args(argv)

    if args.ordner:
        stammdaten, dateien = lade_ordner(Path(args.ordner))
    else:
        if not args.pdfs:
            parser.error("PDF-Dateien oder --ordner angeben")
        stammdaten = json.loads(Path(args.akte).read_text(encoding="utf-8")) if args.akte else {}
        dateien = [(Path(p).name, Path(p).read_bytes()) for p in args.pdfs]

    akte = extrahiere_akte(stammdaten, dateien, ocr=not args.ohne_ocr)
    json.dump(akte, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
