"""Was vor dem Modellaufruf verschwinden muss, und was bleiben muss.

Die Probe ist zweiseitig: Keine Partei darf durchkommen, und kein Merkmal
darf verschwinden, an dem ein Modell den Belegtyp erkennt (ADR-011).
"""

from __future__ import annotations

import re

from zollpilot_extraktion.klassifikation import klassifiziere
from zollpilot_extraktion.pseudonymisierung import pseudonymisiere

BELEG = """COMMERCIAL INVOICE

Shipper: Nordlicht Maschinenbau GmbH
Sonnenallee 14
20095 Hamburg
EORI: DE1234567890123
USt-IdNr.: DE812345678
Contact: Anke Vogt, +49 40 123456-78, anke.vogt@nordlicht-maschinenbau.test

Consignee: Pacific Trading Pte Ltd
Invoice No. INV-2026-0417
Port of Loading: Hamburg
Gross weight: 1040 kg
Total: 18420 EUR
"""


def test_keine_partei_bleibt_im_text() -> None:
    ergebnis = pseudonymisiere(BELEG)
    for verboten in (
        "Nordlicht",
        "Pacific Trading",
        "Sonnenallee",
        "Anke Vogt",
        "anke.vogt@nordlicht-maschinenbau.test",
        "DE1234567890123",
        "DE812345678",
        "+49 40 123456-78",
    ):
        assert verboten not in ergebnis.text, verboten


def test_die_gestalt_des_belegs_bleibt_lesbar() -> None:
    ergebnis = pseudonymisiere(BELEG)
    for erhalten in ("COMMERCIAL INVOICE", "Port of Loading", "Gross weight", "Invoice No. INV-2026-0417"):
        assert erhalten in ergebnis.text, erhalten
    # Die Feldnamen selbst bleiben stehen, nur ihr Inhalt geht.
    assert "Shipper:" in ergebnis.text
    assert "EORI:" in ergebnis.text


def test_die_klassifikation_ueberlebt_die_pseudonymisierung() -> None:
    vorher = klassifiziere(BELEG)
    nachher = klassifiziere(pseudonymisiere(BELEG).text)
    assert vorher.typ == "handelsrechnung"
    assert nachher.typ == vorher.typ
    assert nachher.konfidenz == vorher.konfidenz


def test_derselbe_wert_bekommt_denselben_platzhalter() -> None:
    text = "Shipper: Nordlicht Maschinenbau GmbH\nRechnung von Nordlicht Maschinenbau GmbH an Dritte"
    ergebnis = pseudonymisiere(text)
    platzhalter = re.findall(r"\[PARTEI-\d+\]", ergebnis.text)
    assert len(platzhalter) == 2
    assert platzhalter[0] == platzhalter[1]


def test_die_zuordnung_bleibt_lokal_und_fuehrt_zurueck() -> None:
    ergebnis = pseudonymisiere(BELEG)
    assert ergebnis.ersetzungen > 0
    assert all(wert not in ergebnis.text for wert in ergebnis.zuordnung.values())
    # Aus dem Platzhalter kommt das Original zurück, aber nur hier.
    assert "Sonnenallee 14" in ergebnis.zurueck(ergebnis.text)


def test_ohne_partei_bleibt_der_text_unveraendert() -> None:
    text = "PACKING LIST\nPackage ID: PAL-1\nNet weight: 980 kg\n"
    ergebnis = pseudonymisiere(text)
    assert ergebnis.text == text
    assert ergebnis.zuordnung == {}


def test_zweimal_pseudonymisieren_aendert_nichts_mehr() -> None:
    einmal = pseudonymisiere(BELEG)
    zweimal = pseudonymisiere(einmal.text)
    assert zweimal.text == einmal.text


def test_ein_betrag_ist_keine_anschrift() -> None:
    """`18420 EUR` sieht aus wie Postleitzahl und Ort, ist aber keine."""
    ergebnis = pseudonymisiere("Total: 18420 EUR\nSumme: 1040 KG\n")
    assert ergebnis.text == "Total: 18420 EUR\nSumme: 1040 KG\n"
