"""HTTP-Dienst für n8n: Belege rein, Akte raus.

    GET  /healthz                     ok, plus ob OCR verfügbar ist
    GET  /metrics                     Prometheus-Format (metriken.py)
    POST /extraktion/akte             JSON: {akte: {...}, dateien: [{name, inhalt_base64}]}
    POST /extraktion/akte/multipart   Formular: akte (JSON-Text) + dateien (PDFs)

Der JSON-Weg ist der des Workflows (der Code-Node verpackt die Binärdateien
aus dem Webhook); der Multipart-Weg ist für Menschen mit curl.

Protokolliert werden Akten-ID, Anzahl und Größe der Dateien, Dauer —
nie Belegtext (docs/DATENSCHUTZ.md).
"""

from __future__ import annotations

import base64
import binascii
import json
import logging
import time
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, Response, UploadFile
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from pydantic import BaseModel, Field

from . import VERSION, metriken
from .akte import extrahiere_akte
from .lesen import ocr_version

log = logging.getLogger("zollpilot.extraktion")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

app = FastAPI(title="ZollPilot Extraktion", version=VERSION)
metriken.setze_ocr(ocr_version() is not None)

MAX_DATEIEN = 50


@app.get("/metrics")
def metrics() -> Response:
    """Prometheus-Format. Eine feste Route statt einer eingehängten App, damit
    /metrics ohne Umleitung auf /metrics/ antwortet; Prometheus folgt zwar
    Umleitungen, ein curl im Rauchtest nicht."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


class Datei(BaseModel):
    name: str
    inhalt_base64: str


class Anfrage(BaseModel):
    akte: dict[str, Any] = Field(default_factory=dict)
    dateien: list[Datei]


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    version = ocr_version()
    return {"status": "ok", "version": VERSION, "ocr": {"verfuegbar": version is not None, "version": version}}


def _verarbeite(stammdaten: dict[str, Any], dateien: list[tuple[str, bytes]]) -> dict[str, Any]:
    if not dateien:
        metriken.zaehle_abgelehnt()
        raise HTTPException(status_code=422, detail="keine Dateien")
    if len(dateien) > MAX_DATEIEN:
        metriken.zaehle_abgelehnt()
        raise HTTPException(status_code=422, detail=f"mehr als {MAX_DATEIEN} Dateien")
    start = time.perf_counter()
    try:
        akte = extrahiere_akte(stammdaten, dateien)
    except Exception:
        metriken.zaehle_fehler()
        raise
    metriken.zaehle_akte(akte, time.perf_counter() - start)
    log.info(
        "akte=%s dateien=%d bytes=%d dokumente=%d assertions=%d hinweise=%d dauer_ms=%d",
        akte.get("akte_id"),
        len(dateien),
        sum(len(d) for _, d in dateien),
        len(akte["dokumente"]),
        len(akte["assertions"]),
        len(akte["extraktion"]["hinweise"]),
        int((time.perf_counter() - start) * 1000),
    )
    return akte


@app.post("/extraktion/akte")
def extraktion_json(anfrage: Anfrage) -> dict[str, Any]:
    dateien: list[tuple[str, bytes]] = []
    for d in anfrage.dateien:
        try:
            dateien.append((d.name, base64.b64decode(d.inhalt_base64, validate=True)))
        except (binascii.Error, ValueError) as e:
            raise HTTPException(status_code=422, detail=f"{d.name}: kein gültiges Base64") from e
    return _verarbeite(anfrage.akte, dateien)


@app.post("/extraktion/akte/multipart")
async def extraktion_multipart(akte: str = Form("{}"), dateien: list[UploadFile] = File(...)) -> dict[str, Any]:
    try:
        stammdaten = json.loads(akte) if akte else {}
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=422, detail=f"Feld akte ist kein JSON: {e}") from e
    inhalte = [(d.filename or f"datei-{i + 1}.pdf", await d.read()) for i, d in enumerate(dateien)]
    return _verarbeite(stammdaten, inhalte)
