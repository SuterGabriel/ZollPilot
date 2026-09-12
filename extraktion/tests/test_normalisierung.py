"""Normalisierung: Grenzfälle, vor der Implementierung aufgeschrieben.

Die Vergleichswerte sind Schreibweisen von Belegen, nicht Ausgaben des
geprüften Codes (Entwicklungslog 2026-09-12: Fixtures aus dem eigenen Code
prüfen nichts).
"""

import pytest

from zollpilot_extraktion.normalisierung import (
    als_betrag,
    als_containernummer,
    als_datum,
    als_ganzzahl,
    als_land,
    als_unlocode,
    als_warencode,
)


@pytest.mark.parametrize(
    ("text", "erwartet"),
    [
        ("17.400,00", 17400), ("17,400.00", 17400), ("17400", 17400), ("1.450,00", 1450),
        ("EUR 18.420,00", 18420), ("0,00", 0), ("1.046,00 kg", 1046), ("12", 12),
        ("980,5", 980.5), ("1,250.75", 1250.75), ("-3,00", -3), ("no charge", None), ("", None), (None, None),
        ("12 PCE PAL-1", None), ("PAL-1", None),
    ],
)
def test_betrag(text, erwartet):
    assert als_betrag(text) == erwartet


def test_betrag_ganze_zahl_bleibt_int():
    assert isinstance(als_betrag("17.400,00"), int)
    assert isinstance(als_betrag("980,5"), float)


@pytest.mark.parametrize(("text", "erwartet"), [("12", 12), ("12,00", 12), ("12,5", None), ("x", None)])
def test_ganzzahl(text, erwartet):
    assert als_ganzzahl(text) == erwartet


@pytest.mark.parametrize(
    ("text", "erwartet"),
    [
        ("2026-09-08", "2026-09-08"), ("08.09.2026", "2026-09-08"), ("8.9.2026", "2026-09-08"),
        ("08/09/2026", "2026-09-08"), ("8 September 2026", "2026-09-08"), ("8. September 2026", "2026-09-08"),
        ("Hamburg, 2026-09-08", "2026-09-08"), ("kein Datum", None), ("", None),
    ],
)
def test_datum(text, erwartet):
    assert als_datum(text) == erwartet


@pytest.mark.parametrize(
    ("text", "erwartet"),
    [
        ("DE", "DE"), ("Germany", "DE"), ("German", "DE"), ("Deutschland", "DE"), ("20457 Hamburg, Germany", "DE"),
        ("Singapore", "SG"), ("Singapore 018960", "SG"), ("People's Republic of China", "CN"),
        ("Germany (DE)", "DE"), ("20457 Hamburg", None), ("Atlantis", None), ("", None),
    ],
)
def test_land(text, erwartet):
    assert als_land(text) == erwartet


def test_eu_bleibt_eu():
    # "EU" ist kein Land (docs/01), aber ein Code, der auf Belegen steht. Er wird
    # durchgereicht wie in src/normalisierung.mjs; ORG-02 meldet den
    # Widerspruch zum Positionsursprung, statt dass er hier verschwindet.
    assert als_land("EU") == "EU"


@pytest.mark.parametrize(("text", "erwartet"), [("Hamburg (DEHAM)", "DEHAM"), ("DEHAM", "DEHAM"), ("Singapore (SGSIN)", "SGSIN"), ("Hamburg", None)])
def test_unlocode(text, erwartet):
    assert als_unlocode(text) == erwartet


@pytest.mark.parametrize(("text", "erwartet"), [("8413.30", "841330"), ("841330", "841330"), ("8413 30 80", "84133080"), ("HP-40", None)])
def test_warencode(text, erwartet):
    assert als_warencode(text) == erwartet


@pytest.mark.parametrize(("text", "erwartet"), [("MSKU 123456-5", "MSKU1234565"), ("msku1234565", "MSKU1234565"), ("MSKU1234565 / ML-SG", "MSKU1234565")])
def test_containernummer(text, erwartet):
    assert als_containernummer(text) == erwartet
