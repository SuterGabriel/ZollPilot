"""Die strukturierte Rechnung (CII): hin und zurück, gegen das Schema, ohne Leseunsicherheit.

Die Rundreise nimmt die Rechnungsfakten der Golden-Set-Akte, schreibt sie
als Cross Industry Invoice, validiert gegen das XSD, liest die Datei über
denselben Weg wie ein PDF (`extrahiere_akte`) und vergleicht mit
`erwartet.json` derselben Akte. Damit ist die Rechnung als Datensatz an
derselben Messlatte wie die Rechnung als PDF.
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient
from lxml import etree

from zollpilot_extraktion.akte import extrahiere_akte
from zollpilot_extraktion.bewertung import vergleiche
from zollpilot_extraktion.cii import (
    KONFIDENZ_STRUKTURIERT,
    METHODE_STRUKTURIERT,
    NS,
    CiiUngueltig,
    ist_cii,
    lies_cii,
    pruefe_cii,
    schreibe_cii,
)
from zollpilot_extraktion.dienst import app

from conftest import AKTEN, BELEGE, lade


def rechnungsfakten(name: str) -> dict:
    """Die Rechnung (INV-1) aus der JSON-Akte, verschachtelt statt als Assertions."""
    akte = json.loads((AKTEN / f"{name}.json").read_text(encoding="utf-8"))
    rechnung: dict = {}
    for a in akte["assertions"]:
        if a["dokument"] != "INV-1":
            continue
        teile = a["pfad"].split(".")[1:]
        ziel = rechnung
        for i, teil in enumerate(teile[:-1]):
            naechster_index = teile[i + 1].isdigit()
            if isinstance(ziel, list):
                while len(ziel) <= int(teil):
                    ziel.append([] if naechster_index else {})
                ziel = ziel[int(teil)]
            else:
                ziel = ziel.setdefault(teil, [] if naechster_index else {})
        letzter = teile[-1]
        if isinstance(ziel, list):
            while len(ziel) <= int(letzter):
                ziel.append(None)
            ziel[int(letzter)] = a["wert"]
        else:
            ziel[letzter] = a["wert"]
    return rechnung


def erwartet_rechnung(name: str) -> list[dict]:
    _, _, erwartet = lade(BELEGE / name)
    return [e for e in erwartet if e["dokument"] == "INV-1"]


def test_geschriebene_rechnung_besteht_das_schema():
    daten = schreibe_cii(rechnungsfakten("happy-path"), incoterm={"code": "FOB", "named_place": "Hamburg"})
    assert pruefe_cii(daten) == []
    wurzel = etree.fromstring(daten)
    assert wurzel.tag == f"{{{NS['rsm']}}}CrossIndustryInvoice"
    assert wurzel.find("rsm:ExchangedDocument/ram:TypeCode", NS).text == "380"
    assert wurzel.find("rsm:ExchangedDocument/ram:IssueDateTime/udt:DateTimeString", NS).text == "20260908"


@pytest.mark.parametrize("name", ["happy-path", "ursprungswiderspruch", "kostenlose-position"])
def test_rundreise_trifft_die_erwartung_der_pdf_rechnung(belege, name):
    daten = schreibe_cii(rechnungsfakten(name))
    stammdaten, _, _ = lade(BELEGE / name)
    akte = extrahiere_akte(stammdaten, [("rechnung.xml", daten)], ocr=False)

    (dokument,) = akte["dokumente"]
    assert dokument["typ"] == "handelsrechnung"
    assert dokument["id"] == "INV-1"
    assert dokument["methoden"] == [METHODE_STRUKTURIERT]
    assert dokument["aussteller"] == "Nordlicht Maschinenbau GmbH"

    felder = vergleiche(erwartet_rechnung(name), akte)
    befunde = [t for z in felder.values() for t in z["fehlend"] + z["abweichend"]]
    assert befunde == []


def test_strukturiert_heisst_konfidenz_eins_und_keine_fundstelle(belege):
    stammdaten, _, _ = lade(BELEGE / "happy-path")
    akte = extrahiere_akte(stammdaten, [("rechnung.xml", schreibe_cii(rechnungsfakten("happy-path")))], ocr=False)
    assert akte["assertions"]
    for a in akte["assertions"]:
        assert a["methode"] == METHODE_STRUKTURIERT
        assert a["konfidenz"] == KONFIDENZ_STRUKTURIERT
        assert a["seite"] is None and a["bbox"] is None
        assert a["roh"] is not None


def test_proformarechnung_ueber_den_typcode():
    daten = schreibe_cii(rechnungsfakten("happy-path"), typ="proformarechnung")
    assert lies_cii(daten, "pro.xml").typ == "proformarechnung"


def test_ungueltiges_xml_haengt_als_unclassified_an_der_akte():
    kaputt = b'<?xml version="1.0"?><rsm:CrossIndustryInvoice xmlns:rsm="' + NS["rsm"].encode() + b'"><rsm:Falsch/></rsm:CrossIndustryInvoice>'
    assert ist_cii(kaputt)
    with pytest.raises(CiiUngueltig, match="Falsch"):
        lies_cii(kaputt, "kaputt.xml")
    akte = extrahiere_akte({"akte_id": "T-CII"}, [("kaputt.xml", kaputt)], ocr=False)
    (dokument,) = akte["dokumente"]
    assert dokument["typ"] == "unclassified"
    assert "CII" in dokument["hinweis"]
    assert akte["extraktion"]["hinweise"] == ["kaputt.xml: CII besteht das Schema nicht"]


def test_kein_xml_ist_kein_cii():
    assert not ist_cii(b"%PDF-1.4 ...")
    assert not ist_cii(b"<html><body>CrossIndustryInvoice</body></html>"[:0])


def test_dienst_schreibt_die_rechnung_der_akte_als_cii():
    client = TestClient(app)
    antwort = client.post("/extraktion/akte/cii", json={"rechnung": rechnungsfakten("happy-path"), "incoterm": {"code": "FOB", "named_place": "Hamburg"}})
    assert antwort.status_code == 200, antwort.text
    assert antwort.headers["content-type"].startswith("application/xml")
    assert pruefe_cii(antwort.content) == []
    assert client.post("/extraktion/akte/cii", json={"rechnung": {}}).status_code == 422
