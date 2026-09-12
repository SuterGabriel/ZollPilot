"""Das Ausfuhrbegleitdokument: erkannt, gelesen, mit Fundstelle, und die MRN nur der Struktur nach."""

from __future__ import annotations

import pytest

from zollpilot_extraktion.akte import extrahiere_akte
from zollpilot_extraktion.normalisierung import als_mrn

from conftest import BELEGE, lade


def _abd_akte(belege, name: str = "happy-path") -> tuple[dict, dict]:
    stammdaten, dateien, _ = lade(BELEGE / name)
    nur_abd = [(n, d) for n, d in dateien if n == "ausfuhrbegleitdokument.pdf"]
    assert nur_abd, "Golden Set ohne ABD: testdaten/erzeuge-belege.py laufen lassen"
    akte = extrahiere_akte(stammdaten, nur_abd, ocr=False)
    return akte, {a["pfad"]: a for a in akte["assertions"]}


def test_abd_wird_erkannt_und_bekommt_eigene_kennung(belege):
    akte, _ = _abd_akte(belege)
    (dokument,) = akte["dokumente"]
    assert dokument["typ"] == "abd"
    assert dokument["id"] == "ABD-1"
    assert dokument["status"] == "final"
    assert dokument["aussteller"] == "Nordlicht Maschinenbau GmbH"
    assert dokument["methoden"] == ["textlayer"]


def test_abd_felder_mit_fundstelle(belege):
    _, pfade = _abd_akte(belege)
    assert pfade["abd.mrn"]["wert"] == "26DE5100001234567A"
    assert pfade["abd.ausfuehrer.name"]["wert"] == "Nordlicht Maschinenbau GmbH"
    assert pfade["abd.ausfuehrer.eori"]["wert"] == "DE123456789012345"
    assert pfade["abd.bestimmungsland"]["wert"] == "SG"
    assert pfade["abd.container_id"]["wert"] == "MSKU1234565"
    # Achtstellige KN, nicht auf HS-6 gekürzt: Kürzen ist Sache der Regel.
    assert pfade["abd.positionen.0.warennummer"]["wert"] == "84133080"
    assert pfade["abd.positionen.1.warennummer"]["wert"] == "84842000"
    assert pfade["abd.positionen.0.menge"]["wert"] == 12
    for a in pfade.values():
        assert a["seite"] == 1 and len(a["bbox"]) == 4 and a["konfidenz"] > 0


def test_abd_abweichung_traegt_den_anderen_container(belege):
    _, pfade = _abd_akte(belege, "abd-abweichung")
    assert pfade["abd.container_id"]["wert"] == "HLXU8765430"


def test_abd_mit_drei_positionen(belege):
    _, pfade = _abd_akte(belege, "kostenlose-position")
    assert pfade["abd.positionen.2.warennummer"]["wert"] == "84842000"
    assert pfade["abd.positionen.2.menge"]["wert"] == 2


@pytest.mark.parametrize(
    "roh, erwartet",
    [
        ("26DE5100001234567A", "26DE5100001234567A"),
        ("MRN 26DE 5100 0012 3456 7A", "26DE5100001234567A"),
        ("26de5100001234567a", "26DE5100001234567A"),
        ("26DE510000123456", None),  # 16 Zeichen: zu kurz
        ("DE26510000123456789", None),  # Jahr und Land vertauscht
        ("", None),
        (None, None),
    ],
)
def test_als_mrn_prueft_nur_die_struktur(roh, erwartet):
    assert als_mrn(roh) == erwartet
