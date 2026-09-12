"""Der Anbieter-Leser: dieselbe Form wie lesen.py, ohne Netz, ohne Erfindung.

Die Antwort unten ist ein von Hand geschriebenes Beispiel in der Form von
Azure `prebuilt-read`, kein Mitschnitt. Es prüft die Übersetzung (Einheiten,
Konfidenz, Zeilen, Fehlerfälle), nicht die Lesequalität des Anbieters. Die
Lesequalität misst die Bewertung, sobald Aufzeichnungen vorliegen
(`python -m zollpilot_extraktion.anbieter stand`).
"""

from __future__ import annotations

import io
import json

import pytest
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from zollpilot_extraktion.akte import extrahiere_akte
from zollpilot_extraktion.anbieter import (
    METHODE_AZURE,
    AnbieterAntwortUnbrauchbar,
    AnbieterNichtVerfuegbar,
    fixture_pfad,
    lies_pdf_azure,
    uebersetze_azure,
)
from zollpilot_extraktion.lesen import PUNKTE_PRO_ZOLL, LesungNichtMoeglich

BREITE_PT, HOEHE_PT = A4


def leeres_pdf(seiten: int = 1) -> bytes:
    puffer = io.BytesIO()
    c = canvas.Canvas(puffer, pagesize=A4, invariant=1)
    for _ in range(seiten):
        c.drawString(40, 800, "Beispiel")
        c.showPage()
    c.save()
    return puffer.getvalue()


def wort(text: str, x: float, y: float, breite: float, hoehe: float, konfidenz: float, versatz: int) -> dict:
    return {
        "content": text,
        "polygon": [x, y, x + breite, y, x + breite, y + hoehe, x, y + hoehe],
        "confidence": konfidenz,
        "span": {"offset": versatz, "length": len(text)},
    }


def antwort_in_zoll() -> dict:
    """Zwei Zeilen, Koordinaten in Zoll, wie Azure sie fuer PDF liefert."""
    inhalt = "Container no.: MSKU1234565\nGross weight: 1.040,00 kg"
    return {
        "status": "succeeded",
        "analyzeResult": {
            "content": inhalt,
            "pages": [
                {
                    "pageNumber": 1,
                    "unit": "inch",
                    "width": BREITE_PT / PUNKTE_PRO_ZOLL,
                    "height": HOEHE_PT / PUNKTE_PRO_ZOLL,
                    "words": [
                        wort("Container", 0.5, 1.0, 0.7, 0.15, 0.99, 0),
                        wort("no.:", 1.25, 1.0, 0.3, 0.15, 0.98, 10),
                        wort("MSKU1234565", 1.6, 1.0, 1.1, 0.15, 0.71, 15),
                        wort("Gross", 0.5, 1.3, 0.4, 0.15, 0.97, 27),
                        wort("weight:", 0.95, 1.3, 0.5, 0.15, 0.96, 33),
                        wort("1.040,00", 1.5, 1.3, 0.6, 0.15, 0.88, 41),
                        wort("kg", 2.15, 1.3, 0.2, 0.15, 0.95, 50),
                    ],
                    "lines": [
                        {"content": "Container no.: MSKU1234565", "spans": [{"offset": 0, "length": 26}]},
                        {"content": "Gross weight: 1.040,00 kg", "spans": [{"offset": 27, "length": 25}]},
                    ],
                }
            ],
        },
    }


def test_uebersetzung_liefert_punkte_und_konfidenz_je_wort():
    daten = leeres_pdf()
    beleg = uebersetze_azure(antwort_in_zoll(), daten, "beispiel.pdf")

    assert len(beleg.seiten) == 1
    seite = beleg.seiten[0]
    assert seite.methode == METHODE_AZURE
    assert (seite.breite, seite.hoehe) == (pytest.approx(BREITE_PT), pytest.approx(HOEHE_PT))
    assert [z.text for z in seite.zeilen] == ["Container no.: MSKU1234565", "Gross weight: 1.040,00 kg"]

    container = next(w for w in seite.woerter if w.text == "MSKU1234565")
    # 1,6 Zoll von links sind 115,2 Punkte; die Konfidenz ist die des Anbieters.
    assert container.x0 == pytest.approx(1.6 * PUNKTE_PRO_ZOLL, abs=0.01)
    assert container.konfidenz == pytest.approx(0.71)
    assert beleg.hash_sha256 and beleg.methoden == [METHODE_AZURE]


def test_pixel_werden_auf_die_seitengroesse_skaliert():
    daten = leeres_pdf()
    antwort = antwort_in_zoll()
    seite = antwort["analyzeResult"]["pages"][0]
    # Dieselbe Seite als Bild mit 200 dpi: Breite in Pixeln, Wörter in Pixeln.
    seite["unit"] = "pixel"
    seite["width"], seite["height"] = round(seite["width"] * 200), round(seite["height"] * 200)
    for w in seite["words"]:
        w["polygon"] = [v * 200 for v in w["polygon"]]
    beleg = uebersetze_azure(antwort, daten, "scan.pdf")
    container = next(w for w in beleg.seiten[0].woerter if w.text == "MSKU1234565")
    assert container.x0 == pytest.approx(1.6 * PUNKTE_PRO_ZOLL, abs=0.5)


def test_woerter_ohne_zeile_werden_nicht_verworfen():
    antwort = antwort_in_zoll()
    antwort["analyzeResult"]["pages"][0]["lines"] = []
    beleg = uebersetze_azure(antwort, leeres_pdf(), "beispiel.pdf")
    assert sum(len(z.woerter) for z in beleg.seiten[0].zeilen) == 7


@pytest.mark.parametrize(
    "kaputt, grund",
    [
        (lambda a: a["analyzeResult"].pop("pages"), "keine Seiten"),
        (lambda a: a["analyzeResult"]["pages"][0].update(unit="cm"), "unbekannte Einheit"),
        (lambda a: a["analyzeResult"]["pages"][0].update(pageNumber=7), "das PDF hat 1"),
        (lambda a: a["analyzeResult"]["pages"][0]["words"][0].pop("polygon"), "ohne Polygon"),
    ],
)
def test_unbrauchbare_antwort_wird_benannt(kaputt, grund):
    antwort = antwort_in_zoll()
    kaputt(antwort)
    with pytest.raises(AnbieterAntwortUnbrauchbar, match=grund):
        uebersetze_azure(antwort, leeres_pdf(), "beispiel.pdf")


def test_ohne_aufzeichnung_und_ohne_schluessel_wird_nichts_erfunden(tmp_path, monkeypatch):
    monkeypatch.delenv("ZOLLPILOT_AZURE_DI_KEY", raising=False)
    monkeypatch.delenv("ZOLLPILOT_AZURE_DI_ENDPOINT", raising=False)
    with pytest.raises(AnbieterNichtVerfuegbar, match="keine Aufzeichnung"):
        lies_pdf_azure(leeres_pdf(), "beispiel.pdf", fixtures=tmp_path, aufzeichnen=True)
    # Ohne Aufzeichnungsauftrag wird auch mit Schlüssel nicht gerufen.
    monkeypatch.setenv("ZOLLPILOT_AZURE_DI_KEY", "x")
    monkeypatch.setenv("ZOLLPILOT_AZURE_DI_ENDPOINT", "https://beispiel.invalid")
    with pytest.raises(AnbieterNichtVerfuegbar, match="nicht angefordert"):
        lies_pdf_azure(leeres_pdf(), "beispiel.pdf", fixtures=tmp_path, aufzeichnen=False)


def test_aufzeichnung_wird_gelesen_und_ist_an_den_hash_gebunden(tmp_path):
    daten = leeres_pdf()
    pfad = fixture_pfad(daten, tmp_path)
    pfad.parent.mkdir(parents=True, exist_ok=True)
    pfad.write_text(json.dumps(antwort_in_zoll()), encoding="utf-8")

    beleg = lies_pdf_azure(daten, "beispiel.pdf", fixtures=tmp_path)
    assert [z.text for z in beleg.seiten[0].zeilen][0] == "Container no.: MSKU1234565"

    # Ein anderes PDF hat einen anderen Hash und damit keine Aufzeichnung.
    with pytest.raises(AnbieterNichtVerfuegbar):
        lies_pdf_azure(leeres_pdf(seiten=2), "anderes.pdf", fixtures=tmp_path)


def test_akte_mit_anbieter_leser_haengt_unlesbares_an_und_nennt_den_leser(tmp_path):
    daten = leeres_pdf()

    def leser(d: bytes, name: str):
        return lies_pdf_azure(d, name, fixtures=tmp_path)

    akte = extrahiere_akte({"akte_id": "T-A"}, [("beispiel.pdf", daten)], leser=leser, leser_name="azure")
    assert akte["extraktion"]["leser"] == "azure"
    assert akte["extraktion"]["ocr"] is None
    assert akte["dokumente"][0]["typ"] == "unclassified"
    assert "Leser azure nicht verfügbar" in akte["dokumente"][0]["hinweis"]
    assert akte["extraktion"]["hinweise"] == ["beispiel.pdf: Leser azure nicht verfügbar"]
    assert issubclass(AnbieterNichtVerfuegbar, LesungNichtMoeglich)
