"""Zusammenbau: aus Dateien wird die Akte, die src/regelwerk.mjs versteht.

Eingang: Stammdaten der Akte (akte_id, stichtag, sachverhalt, anmeldung —
keine Belegaussagen, siehe src/akte/aufbau.mjs) und Dateien. Ausgang:
dieselben Stammdaten plus `dokumente[]` und `assertions[]`.

Zwei Zusagen:
  1. Nichts wird verworfen. Ein unlesbares oder unbekanntes PDF hängt als
     `unclassified` an der Akte, mit Hinweis, und wird gemeldet.
  2. Kein Fakt wird gesetzt. Es entstehen nur Assertions; die Akte baut
     src/akte/aufbau.mjs, und nur aus finalen Belegen.
"""

from __future__ import annotations

from typing import Any

from . import VERSION
from .felder import EXTRAKTOREN, extrahiere_ursprungserklaerung
from .felder.bill_of_lading import aussteller_bill_of_lading
from .felder.handelsrechnung import extrahiere_handelsrechnung  # noqa: F401 - Register vollständig halten
from .felder.packliste import aussteller_packliste
from .klassifikation import STATUS_FINAL, TYP_UNCLASSIFIED, klassifiziere
from .lesen import Beleg, KeinLesbaresPdf, OcrNichtVerfuegbar, lies_pdf, ocr_version

PRAEFIX = {
    "handelsrechnung": "INV",
    "proformarechnung": "PRO",
    "packliste": "PL",
    "bill_of_lading": "BL",
    "sea_waybill": "SWB",
    "eur1": "EUR1",
    "eur_med": "EURMED",
    "atr": "ATR",
    "origin_declaration": "UE",
    TYP_UNCLASSIFIED: "UNK",
}

STAMMDATEN_AUSGESCHLOSSEN = {"dokumente", "assertions"}


def _aussteller(typ: str, beleg: Beleg, assertions: list) -> str | None:
    if typ == "handelsrechnung":
        for a in assertions:
            if a.pfad == "rechnung.verkaeufer.name":
                return a.wert
    if typ == "packliste":
        return aussteller_packliste(beleg)
    if typ == "bill_of_lading":
        return aussteller_bill_of_lading(beleg)
    return None


class Zaehler:
    def __init__(self) -> None:
        self.stand: dict[str, int] = {}

    def naechste(self, typ: str) -> str:
        praefix = PRAEFIX.get(typ, "DOC")
        self.stand[praefix] = self.stand.get(praefix, 0) + 1
        return f"{praefix}-{self.stand[praefix]}"


def extrahiere_akte(stammdaten: dict[str, Any], dateien: list[tuple[str, bytes]], ocr: bool = True) -> dict[str, Any]:
    zaehler = Zaehler()
    dokumente: list[dict[str, Any]] = []
    assertions: list[dict[str, Any]] = []
    hinweise: list[str] = []

    for name, daten in dateien:
        try:
            beleg = lies_pdf(daten, name, ocr=ocr)
        except OcrNichtVerfuegbar as e:
            dokument_id = zaehler.naechste(TYP_UNCLASSIFIED)
            dokumente.append(_unclassified(dokument_id, name, daten, f"OCR nötig, aber nicht verfügbar: {e}"))
            hinweise.append(f"{name}: OCR nicht verfügbar")
            continue
        except KeinLesbaresPdf as e:
            dokument_id = zaehler.naechste(TYP_UNCLASSIFIED)
            dokumente.append(_unclassified(dokument_id, name, daten, f"kein lesbares PDF: {e}"))
            hinweise.append(f"{name}: kein lesbares PDF")
            continue

        leer = [s.nummer for s in beleg.seiten if not s.woerter]
        klasse = klassifiziere(beleg.text)
        dokument_id = zaehler.naechste(klasse.typ)
        dokument: dict[str, Any] = {
            "id": dokument_id,
            "typ": klasse.typ,
            "status": klasse.status,
            "version": 1,
            "aussteller": None,
            "hash": f"sha256:{beleg.hash_sha256}",
            "datei": name,
            "seiten": len(beleg.seiten),
            "methoden": beleg.methoden,
            "klassifikation": {"konfidenz": klasse.konfidenz, "merkmale": klasse.merkmale},
        }
        eigene_hinweise: list[str] = []
        if leer:
            eigene_hinweise.append(f"Seite(n) {', '.join(map(str, leer))} ohne lesbaren Text (OCR abgeschaltet oder leer)")
        if klasse.typ == TYP_UNCLASSIFIED:
            eigene_hinweise.append("Belegtyp nicht erkannt; bleibt an der Akte und wird gemeldet")
            hinweise.append(f"{name}: Belegtyp nicht erkannt")
        if eigene_hinweise:
            dokument["hinweis"] = "; ".join(eigene_hinweise)
        if klasse.typ == TYP_UNCLASSIFIED:
            dokumente.append(dokument)
            continue

        extraktor = EXTRAKTOREN.get(klasse.typ)
        eigene = extraktor(beleg, dokument_id) if extraktor else []
        if not extraktor:
            dokument["hinweis"] = f"Belegtyp {klasse.typ} erkannt, aber kein Extraktor vorhanden"
        dokument["aussteller"] = _aussteller(klasse.typ, beleg, eigene)
        dokumente.append(dokument)
        assertions.extend(a.als_dict() for a in eigene)

        # Die Ursprungserklärung auf der Rechnung ist ein eigener logischer
        # Beleg mit Träger (ADR-001). Sie erbt den Status der Rechnung: Eine
        # Erklärung auf einem Entwurf ist selbst ein Entwurf.
        if klasse.typ in ("handelsrechnung", "proformarechnung"):
            ue_id = f"UE-{zaehler.stand.get('INV', 0) + zaehler.stand.get('PRO', 0)}"
            erklaerung = extrahiere_ursprungserklaerung(beleg, ue_id, eigene)
            if erklaerung:
                dokumente.append(
                    {
                        "id": ue_id,
                        "typ": "origin_declaration",
                        "status": klasse.status,
                        "version": 1,
                        "aussteller": dokument["aussteller"],
                        "hash": dokument["hash"],
                        "datei": name,
                        "traeger": dokument_id,
                        "hinweis": "Ursprungserklärung auf der Rechnung, als eigener Belegtyp klassifiziert",
                    }
                )
                assertions.extend(a.als_dict() for a in erklaerung)

    akte = {k: v for k, v in stammdaten.items() if k not in STAMMDATEN_AUSGESCHLOSSEN}
    akte["dokumente"] = dokumente
    akte["assertions"] = assertions
    akte["extraktion"] = {
        "version": VERSION,
        "ocr": ocr_version() if ocr else None,
        "belege": len(dateien),
        "hinweise": hinweise,
    }
    return akte


def _unclassified(dokument_id: str, name: str, daten: bytes, hinweis: str) -> dict[str, Any]:
    import hashlib

    return {
        "id": dokument_id,
        "typ": TYP_UNCLASSIFIED,
        "status": STATUS_FINAL,
        "version": 1,
        "aussteller": None,
        "hash": f"sha256:{hashlib.sha256(daten).hexdigest()}",
        "datei": name,
        "hinweis": hinweis,
    }
