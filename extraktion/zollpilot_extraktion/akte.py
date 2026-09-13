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

import os
from typing import Any

from . import VERSION
from .felder import EXTRAKTOREN, extrahiere_ursprungserklaerung
from .felder.bill_of_lading import aussteller_bill_of_lading
from .felder.handelsrechnung import extrahiere_handelsrechnung  # noqa: F401 - Register vollständig halten
from .felder.packliste import aussteller_packliste
from .cii import KONFIDENZ_STRUKTURIERT, METHODE_STRUKTURIERT, CiiUngueltig, assertions_aus, ist_cii, lies_cii
from .klassifikation import STATUS_FINAL, TYP_UNCLASSIFIED, klassifiziere
from .lesen import Beleg, KeinLesbaresPdf, LesungNichtMoeglich, lies_pdf, ocr_version

# Der Leser ist austauschbar (ADR-005): eine Funktion (daten, name) → Beleg.
# Vorgabe ist lesen.py mit Textlayer und Tesseract; der Vergleichslauf setzt
# anbieter.py ein. Alles hinter dem Leser bleibt gleich.
LESER_TESSERACT = "tesseract"

# Nur gesetzt ruft der Klassifikationsfallback das Modell wirklich (ADR-011).
UMGEBUNG_AUFZEICHNEN = "ZOLLPILOT_MODELL_AUFZEICHNEN"

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
    "abd": "ABD",
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
    if typ == "abd":
        # Aussteller im Sinne der Akte ist der Ausführer, nicht die Zollstelle:
        # Er hat angemeldet, und ihn trifft die Berichtigungspflicht.
        for a in assertions:
            if a.pfad == "abd.ausfuehrer.name":
                return a.wert
    return None


class Zaehler:
    def __init__(self) -> None:
        self.stand: dict[str, int] = {}

    def naechste(self, typ: str) -> str:
        praefix = PRAEFIX.get(typ, "DOC")
        self.stand[praefix] = self.stand.get(praefix, 0) + 1
        return f"{praefix}-{self.stand[praefix]}"


def _vorschlag_zum_typ(text: str, erlaubt: bool):
    """Ein Modellvorschlag, wenn er erlaubt und verfügbar ist; sonst nichts.

    Der Fallback darf die Extraktion nie zum Scheitern bringen: Ohne
    Aufzeichnung und ohne Zugang bleibt der Beleg `unclassified`, wie zuvor
    (ADR-011). Gerufen wird das Modell nur, wenn `ZOLLPILOT_MODELL_AUFZEICHNEN`
    gesetzt ist; sonst liest der Fallback ausschließlich Aufzeichnungen und
    kostet weder Netz noch Geld.
    """
    if not erlaubt:
        return None
    from .modell import ModellAntwortUnbrauchbar, ModellNichtVerfuegbar, schlage_typ_vor

    aufzeichnen = bool(os.environ.get(UMGEBUNG_AUFZEICHNEN, "").strip())
    try:
        vorschlag = schlage_typ_vor(text, aufzeichnen=aufzeichnen)
    except (ModellNichtVerfuegbar, ModellAntwortUnbrauchbar):
        return None
    return vorschlag if vorschlag.typ != TYP_UNCLASSIFIED else None


def extrahiere_akte(
    stammdaten: dict[str, Any],
    dateien: list[tuple[str, bytes]],
    ocr: bool = True,
    leser=None,
    leser_name: str = LESER_TESSERACT,
    modell_fallback: bool = True,
) -> dict[str, Any]:
    zaehler = Zaehler()
    dokumente: list[dict[str, Any]] = []
    assertions: list[dict[str, Any]] = []
    hinweise: list[str] = []
    lies = leser or (lambda daten, name: lies_pdf(daten, name, ocr=ocr))

    for name, daten in dateien:
        # Eine Rechnung als Datensatz (CII, ADR-008) nimmt denselben Eingang
        # wie ein PDF und landet als derselbe Belegtyp in der Akte, nur ohne
        # Leseunsicherheit. Was das Schema nicht besteht, wird nicht gelesen,
        # sondern gemeldet.
        if ist_cii(daten):
            try:
                strukturiert = lies_cii(daten, name)
            except CiiUngueltig as e:
                dokument_id = zaehler.naechste(TYP_UNCLASSIFIED)
                dokumente.append(_unclassified(dokument_id, name, daten, f"CII besteht das Schema nicht: {e}"))
                hinweise.append(f"{name}: CII besteht das Schema nicht")
                continue
            dokument_id = zaehler.naechste(strukturiert.typ)
            eigene = assertions_aus(strukturiert, dokument_id)
            dokument = {
                "id": dokument_id,
                "typ": strukturiert.typ,
                "status": STATUS_FINAL,
                "version": 1,
                "aussteller": _aussteller(strukturiert.typ, None, eigene),
                "hash": f"sha256:{strukturiert.hash_sha256}",
                "datei": name,
                "seiten": None,
                "methoden": [METHODE_STRUKTURIERT],
                "klassifikation": {"konfidenz": KONFIDENZ_STRUKTURIERT, "merkmale": ["CrossIndustryInvoice"]},
            }
            if strukturiert.hinweis:
                dokument["hinweis"] = strukturiert.hinweis
            dokumente.append(dokument)
            assertions.extend(a.als_dict() for a in eigene)
            continue

        try:
            beleg = lies(daten, name)
        except LesungNichtMoeglich as e:
            dokument_id = zaehler.naechste(TYP_UNCLASSIFIED)
            if leser_name == LESER_TESSERACT:
                dokumente.append(_unclassified(dokument_id, name, daten, f"OCR nötig, aber nicht verfügbar: {e}"))
                hinweise.append(f"{name}: OCR nicht verfügbar")
            else:
                dokumente.append(_unclassified(dokument_id, name, daten, f"Leser {leser_name} nicht verfügbar: {e}"))
                hinweise.append(f"{name}: Leser {leser_name} nicht verfügbar")
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
            # Schweigen die Regeln, darf ein Modell einen Vorschlag machen
            # (ADR-011). Er hängt neben dem Beleg, er ersetzt ihn nicht: Der
            # Typ bleibt `unclassified`, bis ein Mensch den Vorschlag annimmt.
            vorschlag = _vorschlag_zum_typ(beleg.text, modell_fallback)
            if vorschlag:
                dokument["klassifikation"]["vorschlag"] = vorschlag.als_dict()
                eigene_hinweise.append(
                    f"Modellvorschlag: {vorschlag.typ} (Konfidenz {vorschlag.konfidenz}, {vorschlag.modell})"
                )
                hinweise.append(f"{name}: Modell schlägt {vorschlag.typ} vor")
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
        "leser": leser_name,
        "ocr": ocr_version() if (ocr and leser_name == LESER_TESSERACT) else None,
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
