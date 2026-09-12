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
