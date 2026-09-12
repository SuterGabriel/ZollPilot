"""Ende zu Ende auf den synthetischen Belegen: PDF → Akte → Field Exact Match → Entscheidung.

Die digitalen Belege laufen ohne OCR und müssen das Golden Set vollständig
treffen. Der schlechte Scan braucht Tesseract; ohne Tesseract wird er
übersprungen, nicht still grün. Die Entscheidung prüft src/cli.mjs, wenn
Node vorhanden ist.
"""

from __future__ import annotations

import json
import shutil

import pytest

from zollpilot_extraktion.akte import extrahiere_akte
from zollpilot_extraktion.bewertung import entscheidung, vergleiche

from conftest import BELEGE, OHNE_OCR, lade

DIGITAL = ["happy-path", "praeferenznachweis-fehlt", "ursprungswiderspruch", "container-abweichung", "draft-bl", "kostenlose-position"]


def _befunde(felder: dict) -> list[str]:
    return [t for z in felder.values() for t in z["fehlend"] + z["abweichend"]]


@pytest.mark.parametrize("name", DIGITAL)
def test_digitale_belege_treffen_das_golden_set(belege, name):
    stammdaten, dateien, erwartet = lade(BELEGE / name)
    akte = extrahiere_akte(stammdaten, dateien, ocr=False)
    assert {d["typ"] for d in akte["dokumente"]} >= {"handelsrechnung", "packliste", "bill_of_lading"}
    assert all(d["methoden"] == ["textlayer"] for d in akte["dokumente"] if "methoden" in d)
    felder = vergleiche(erwartet, akte)
    assert _befunde(felder) == []


def test_draft_bl_wird_als_entwurf_gelesen(belege):
    stammdaten, dateien, _ = lade(BELEGE / "draft-bl")
    akte = extrahiere_akte(stammdaten, dateien, ocr=False)
    bl = next(d for d in akte["dokumente"] if d["typ"] == "bill_of_lading")
    assert bl["status"] == "draft"
    # Gelesen wird der Entwurf trotzdem: REF-03 soll sagen können, was er getragen hätte.
    assert any(a["dokument"] == bl["id"] and a["pfad"] == "bill_of_lading.container_id" for a in akte["assertions"])


def test_ursprungserklaerung_ist_eigener_beleg_mit_traeger(belege):
    stammdaten, dateien, _ = lade(BELEGE / "happy-path")
    akte = extrahiere_akte(stammdaten, dateien, ocr=False)
    ue = next(d for d in akte["dokumente"] if d["typ"] == "origin_declaration")
    inv = next(d for d in akte["dokumente"] if d["typ"] == "handelsrechnung")
    assert ue["traeger"] == inv["id"]
    wert = next(a for a in akte["assertions"] if a["pfad"] == "praeferenznachweis.ursprungswert")
    assert wert["methode"] == "abgeleitet"
    assert wert["herleitung"]
    assert wert["wert"] == 18420


def test_ohne_praeferenznachweis_kein_ue_dokument(belege):
    stammdaten, dateien, _ = lade(BELEGE / "praeferenznachweis-fehlt")
    akte = extrahiere_akte(stammdaten, dateien, ocr=False)
    assert not any(d["typ"] == "origin_declaration" for d in akte["dokumente"])


def test_jede_assertion_traegt_fundstelle(belege):
    stammdaten, dateien, _ = lade(BELEGE / "happy-path")
    akte = extrahiere_akte(stammdaten, dateien, ocr=False)
    for a in akte["assertions"]:
        assert 0 < a["konfidenz"] <= 1
        assert a["methode"] in ("textlayer", "ocr", "abgeleitet")
        if a["methode"] != "abgeleitet":
            assert a["seite"] >= 1 and len(a["bbox"]) == 4 and a["roh"]


def test_stammdaten_werden_durchgereicht_belegaussagen_nicht(belege):
    stammdaten, dateien, _ = lade(BELEGE / "happy-path")
    akte = extrahiere_akte(stammdaten, dateien, ocr=False)
    assert akte["akte_id"] == stammdaten["akte_id"]
    assert akte["sachverhalt"] == stammdaten["sachverhalt"]
    assert "extraktion" in akte and akte["extraktion"]["belege"] == 3


@pytest.mark.skipif(shutil.which("node") is None, reason="Node fehlt")
@pytest.mark.parametrize("name", DIGITAL)
def test_entscheidung_wie_erwartet(belege, name):
    stammdaten, dateien, _ = lade(BELEGE / name)
    akte = extrahiere_akte(stammdaten, dateien, ocr=False)
    ergebnis = entscheidung(akte)
    erwartung = stammdaten["erwartung"]
    assert ergebnis["freigabe"] == erwartung["freigabe"], json.dumps(ergebnis, ensure_ascii=False)
    assert ergebnis["regeln"] == sorted(erwartung.get("regeln", []))
    assert ergebnis["pflicht"] == sorted(erwartung.get("pflicht", []))


def test_scan_ohne_ocr_meldet_leere_seite(belege):
    stammdaten, dateien, _ = lade(BELEGE / "schlechter-scan")
    akte = extrahiere_akte(stammdaten, dateien, ocr=False)
    pl = [d for d in akte["dokumente"] if d["datei"] == "packliste.pdf"]
    assert len(pl) == 1
    assert pl[0]["typ"] == "unclassified"
    assert "ohne lesbaren Text" in pl[0]["hinweis"]
    assert akte["extraktion"]["hinweise"]


@OHNE_OCR
def test_scan_wird_per_ocr_gelesen_mit_konfidenz(belege):
    stammdaten, dateien, erwartet = lade(BELEGE / "schlechter-scan")
    akte = extrahiere_akte(stammdaten, dateien, ocr=True)
    pl = next(d for d in akte["dokumente"] if d["datei"] == "packliste.pdf")
    assert pl["typ"] == "packliste"
    assert pl["methoden"] == ["ocr"]
    ocr = [a for a in akte["assertions"] if a["methode"] == "ocr"]
    assert ocr, "OCR-Seite ohne Assertions"
    # Echte Konfidenzen, keine Konstante.
    assert len({a["konfidenz"] for a in ocr}) > 1
    assert all(0 < a["konfidenz"] < 1 for a in ocr)
