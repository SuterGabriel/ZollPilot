"""HTTP-Dienst für n8n: Belege rein, Akte raus.

    GET  /healthz                     ok, plus ob OCR verfügbar ist
    POST /extraktion/akte             JSON: {akte: {...}, dateien: [{name, inhalt_base64}]}
    POST /extraktion/akte/multipart   Formular: akte (JSON-Text) + dateien (PDFs oder CII-XML)
    POST /extraktion/akte/cii         JSON: {rechnung: {...}} → die Rechnung als Cross Industry Invoice

Der JSON-Weg ist der des Workflows (der Code-Node verpackt die Binärdateien
aus dem Webhook); der Multipart-Weg ist für Menschen mit curl. Eine Rechnung
als CII-XML geht über dieselben Eingänge wie ein PDF (ADR-008).

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
from pydantic import BaseModel, Field

from . import VERSION
from .akte import extrahiere_akte
from .cii import CiiUngueltig, schreibe_cii
from .lesen import ocr_version

log = logging.getLogger("zollpilot.extraktion")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

app = FastAPI(title="ZollPilot Extraktion", version=VERSION)

MAX_DATEIEN = 50


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
        raise HTTPException(status_code=422, detail="keine Dateien")
    if len(dateien) > MAX_DATEIEN:
        raise HTTPException(status_code=422, detail=f"mehr als {MAX_DATEIEN} Dateien")
    start = time.perf_counter()
    akte = extrahiere_akte(stammdaten, dateien)
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


class CiiAnfrage(BaseModel):
    rechnung: dict[str, Any]
    typ: str = "handelsrechnung"
    incoterm: dict[str, Any] | None = None


@app.post("/extraktion/akte/cii")
def rechnung_als_cii(anfrage: CiiAnfrage) -> Response:
    """Die Rechnungsfakten einer Akte als Cross Industry Invoice (ADR-008).

    Der umgekehrte Weg, eine CII-Rechnung lesen, braucht keine eigene Route:
    Beide Eingänge oben nehmen die XML-Datei wie ein PDF entgegen.
    """
    if not anfrage.rechnung.get("nummer") or not anfrage.rechnung.get("datum"):
        raise HTTPException(status_code=422, detail="rechnung braucht mindestens nummer und datum")
    try:
        daten = schreibe_cii(anfrage.rechnung, typ=anfrage.typ, incoterm=anfrage.incoterm)
    except CiiUngueltig as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    log.info("cii akte=%s bytes=%d", anfrage.rechnung.get("nummer"), len(daten))
    return Response(content=daten, media_type="application/xml")
