"""Der HTTP-Dienst: beide Eingänge liefern dieselbe Akte wie die Funktion."""

from __future__ import annotations

import base64

from fastapi.testclient import TestClient

from zollpilot_extraktion.dienst import app

from conftest import BELEGE, lade

client = TestClient(app)


def test_healthz():
    antwort = client.get("/healthz")
    assert antwort.status_code == 200
    daten = antwort.json()
    assert daten["status"] == "ok"
    assert "ocr" in daten and "verfuegbar" in daten["ocr"]


def test_json_eingang(belege):
    stammdaten, dateien, erwartet = lade(BELEGE / "happy-path")
    antwort = client.post(
        "/extraktion/akte",
        json={"akte": stammdaten, "dateien": [{"name": n, "inhalt_base64": base64.b64encode(d).decode()} for n, d in dateien]},
    )
    assert antwort.status_code == 200, antwort.text
    akte = antwort.json()
    assert akte["akte_id"] == stammdaten["akte_id"]
    # Rechnung, Ursprungserklärung darauf, Packliste, B/L, ABD.
    assert len(akte["dokumente"]) == 5
    assert len(akte["assertions"]) >= len(erwartet) - 2


def test_multipart_eingang(belege):
    stammdaten, dateien, _ = lade(BELEGE / "happy-path")
    antwort = client.post(
        "/extraktion/akte/multipart",
        data={"akte": __import__("json").dumps(stammdaten)},
        files=[("dateien", (n, d, "application/pdf")) for n, d in dateien],
    )
    assert antwort.status_code == 200, antwort.text
    assert len(antwort.json()["dokumente"]) == 5


def test_ohne_dateien_ist_422():
    assert client.post("/extraktion/akte", json={"akte": {}, "dateien": []}).status_code == 422


def test_kaputtes_base64_ist_422():
    antwort = client.post("/extraktion/akte", json={"akte": {}, "dateien": [{"name": "x.pdf", "inhalt_base64": "%%%"}]})
    assert antwort.status_code == 422
    assert "x.pdf" in antwort.json()["detail"]


def test_metriken_zaehlen_belege_nach_typ_und_methode(belege):
    """Der Metrik-Endpunkt liefert nach einer Anfrage Zähler je Belegtyp und
    Lesemethode, die Dauer und die Konfidenzverteilung. Kein Belegtext."""
    stammdaten, dateien, _ = lade(BELEGE / "happy-path")
    client.post(
        "/extraktion/akte",
        json={"akte": stammdaten, "dateien": [{"name": n, "inhalt_base64": base64.b64encode(d).decode()} for n, d in dateien]},
    )
    antwort = client.get("/metrics")
    assert antwort.status_code == 200
    text = antwort.text
    assert 'zollpilot_extraktion_anfragen_total{ergebnis="ok"}' in text
    assert 'zollpilot_extraktion_dokumente_total{methode="textlayer",typ="handelsrechnung"}' in text
    assert 'zollpilot_extraktion_dokumente_total{methode="textlayer",typ="bill_of_lading"}' in text
    assert "zollpilot_extraktion_dauer_sekunden_bucket" in text
    assert 'zollpilot_extraktion_assertion_konfidenz_bucket{le="0.8",methode="textlayer"}' in text
    assert "zollpilot_extraktion_ocr_verfuegbar" in text
    # Was nie in einer Metrik stehen darf: ein Wert aus einem Beleg.
    assert "MSKU" not in text
    assert "Nordlicht" not in text


def test_metriken_zaehlen_abgelehnte_anfragen():
    vorher = client.get("/metrics").text
    client.post("/extraktion/akte", json={"akte": {}, "dateien": []})
    nachher = client.get("/metrics").text

    def wert(text: str) -> float:
        for zeile in text.splitlines():
            if zeile.startswith('zollpilot_extraktion_anfragen_total{ergebnis="abgelehnt"}'):
                return float(zeile.split()[-1])
        return 0.0

    assert wert(nachher) == wert(vorher) + 1
