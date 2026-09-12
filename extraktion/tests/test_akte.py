"""Aktenaufbau: nichts wird verworfen."""

from __future__ import annotations

import io

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from zollpilot_extraktion.akte import extrahiere_akte


def pdf_mit_text(zeilen: list[str]) -> bytes:
    puffer = io.BytesIO()
    c = canvas.Canvas(puffer, pagesize=A4, invariant=1)
    y = 800
    for z in zeilen:
        c.drawString(40, y, z)
        y -= 14
    c.showPage()
    c.save()
    return puffer.getvalue()


def test_unbekannter_beleg_haengt_an_der_akte():
    daten = pdf_mit_text(["Lieferschein", "Wir bestätigen den Eingang Ihrer Bestellung vom 1. September.", "Mit freundlichen Grüßen", "Nordlicht Maschinenbau GmbH", "Versandabteilung", "Hamburg", "Seite 1 von 1", "Ende"])
    akte = extrahiere_akte({"akte_id": "T-1"}, [("lieferschein.pdf", daten)], ocr=False)
    assert len(akte["dokumente"]) == 1
    d = akte["dokumente"][0]
    assert d["typ"] == "unclassified"
    assert d["id"] == "UNK-1"
    assert d["hash"].startswith("sha256:")
    assert "nicht erkannt" in d["hinweis"]
    assert akte["extraktion"]["hinweise"] == ["lieferschein.pdf: Belegtyp nicht erkannt"]
    assert akte["assertions"] == []


def test_kaputte_datei_haengt_an_der_akte():
    akte = extrahiere_akte({"akte_id": "T-2"}, [("kaputt.pdf", b"das ist kein PDF")], ocr=False)
    d = akte["dokumente"][0]
    assert d["typ"] == "unclassified"
    assert "kein lesbares PDF" in d["hinweis"]


def test_ids_zaehlen_je_typ():
    inv = pdf_mit_text(["COMMERCIAL INVOICE", "Invoice No.: A-1", "Invoice date: 2026-09-08", "Currency: EUR", "Seller", "Firma A GmbH", "Germany", "Buyer", "Firma B", "Singapore", "Total amount: EUR 10,00"])
    akte = extrahiere_akte({"akte_id": "T-3"}, [("a.pdf", inv), ("b.pdf", inv)], ocr=False)
    assert [d["id"] for d in akte["dokumente"]] == ["INV-1", "INV-2"]


def test_keine_belegaussagen_aus_stammdaten():
    # Wer `assertions` in die Stammdaten schmuggelt, bekommt sie nicht zurück.
    akte = extrahiere_akte({"akte_id": "T-4", "assertions": [{"pfad": "x"}], "dokumente": [{"id": "X"}]}, [("kaputt.pdf", b"nein")], ocr=False)
    assert akte["assertions"] == []
    assert [d["id"] for d in akte["dokumente"]] == ["UNK-1"]
