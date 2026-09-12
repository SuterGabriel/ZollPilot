"""Handelsrechnung: Kopf, Parteien, Positionen, Summen.

Pfade wie in testdaten/akten/ und in den Regeln: rechnung.nummer,
rechnung.positionen.N.hs6, rechnung.gesamt. Felder und Fehlerquellen aus
docs/01-dokumententypologie.md.
"""

from __future__ import annotations

import re

from ..assertion import Assertion, aus_woertern
from ..lesen import Beleg
from ..normalisierung import als_betrag, als_datum, als_ganzzahl, als_land, als_text, als_warencode
from .gemeinsam import Fund, block_nach_label, lies_tabelle, wert_nach_label

EORI = re.compile(r"EORI\s*[:.]?\s*([A-Z]{2}[A-Z0-9]{1,15})", re.IGNORECASE)
WAEHRUNG = re.compile(r"\b([A-Z]{3})\b")
KEIN_PREIS = re.compile(r"no\s*charge|free\s+of\s+charge|kostenlos|n/c", re.IGNORECASE)

SPALTEN_POSITIONEN = {
    "nr": r"\bpos\.?\b|\bitem\b|\bno\.?\b",
    "beschreibung": r"\bdescription\b|\bbezeichnung\b",
    "hs6": r"\bhs\s*code\b|\btariff\b|\bhs\b",
    "ursprung": r"\borigin\b|\bursprung\b",
    "menge": r"\bqty\b|\bquantity\b|\bmenge\b",
    "einheit": r"\bunit\b(?!\s+price)",
    "einzelpreis": r"\bunit\s+price\b|\beinzelpreis\b",
    "netto": r"\bamount\b|\bbetrag\b",
}
ENDE_POSITIONEN = r"^\s*(sub\s*-?\s*total|total|surcharge|freight|discount|zwischensumme|summe)"


def _partei(beleg: Beleg, dokument: str, praefix: str, label: str, mit_eori: bool) -> list[Assertion]:
    block = block_nach_label(beleg, label)
    if not block:
        return []
    ergebnis: list[Assertion] = []
    name = block[0]
    ergebnis.append(aus_woertern(dokument, f"{praefix}.name", als_text(name.text), name.woerter, name.seite))

    land: Fund | None = None
    for fund in reversed(block):
        if EORI.search(fund.text):
            continue
        if als_land(fund.text):
            land = fund
            break
    if land:
        ergebnis.append(aus_woertern(dokument, f"{praefix}.land", als_land(land.text), land.woerter, land.seite))

    if mit_eori:
        for fund in block:
            m = EORI.search(fund.text)
            if m:
                ergebnis.append(aus_woertern(dokument, f"{praefix}.eori", m.group(1).upper(), fund.woerter, fund.seite, roh=fund.text))
                break
    return ergebnis


def _kopf(beleg: Beleg, dokument: str, pfad: str, label: str, wandle) -> Assertion | None:
    fund = wert_nach_label(beleg, label)
    if not fund:
        return None
    wert = wandle(fund.text)
    if wert is None:
        return None
    return aus_woertern(dokument, pfad, wert, fund.woerter, fund.seite)


def _waehrung(text: str) -> str | None:
    m = WAEHRUNG.search(text.upper())
    return m.group(1) if m else None


def extrahiere_handelsrechnung(beleg: Beleg, dokument: str) -> list[Assertion]:
    ergebnis: list[Assertion] = []

    for pfad, label, wandle in [
        ("rechnung.nummer", r"invoice\s*(?:no|number|nr)|rechnungsnummer|rechnung\s*nr", als_text),
        ("rechnung.datum", r"(?:invoice\s+)?date|rechnungsdatum|datum", als_datum),
        ("rechnung.waehrung", r"currency|währung", _waehrung),
    ]:
        a = _kopf(beleg, dokument, pfad, label, wandle)
        if a:
            ergebnis.append(a)

    ergebnis.extend(_partei(beleg, dokument, "rechnung.verkaeufer", r"seller|exporter|verkäufer|ausführer", mit_eori=True))
    ergebnis.extend(_partei(beleg, dokument, "rechnung.kaeufer", r"buyer|käufer|sold\s+to", mit_eori=False))

    zeilen = lies_tabelle(beleg, SPALTEN_POSITIONEN, ENDE_POSITIONEN, erste_spalte="nr")
    for index, zelle in enumerate(zeilen):
        basis = f"rechnung.positionen.{index}"
        for feld, wandle in [
            ("nr", als_ganzzahl),
            ("beschreibung", als_text),
            ("hs6", als_warencode),
            ("ursprung", als_land),
            ("menge", als_betrag),
            ("einheit", lambda t: als_text(t).upper() if als_text(t) else None),
        ]:
            fund = zelle.get(feld)
            if not fund:
                continue
            wert = wandle(fund.text)
            if wert is not None:
                ergebnis.append(aus_woertern(dokument, f"{basis}.{feld}", wert, fund.woerter, fund.seite))
        for feld in ("einzelpreis", "netto"):
            fund = zelle.get(feld)
            if not fund:
                continue
            # "no charge" ist ein Preis von 0, kein fehlender Preis. Den Zollwert
            # setzt das nicht — das prüft VAL-03.
            wert = 0 if KEIN_PREIS.search(fund.text) else als_betrag(fund.text)
            if wert is not None:
                ergebnis.append(aus_woertern(dokument, f"{basis}.{feld}", wert, fund.woerter, fund.seite))

    for pfad, label in [
        ("rechnung.zuschlaege", r"surcharges?|freight\s+charges?|zuschl[äa]ge"),
        ("rechnung.rabatte", r"discounts?|rabatte?"),
        ("rechnung.gesamt", r"total\s+amount|grand\s+total|gesamtbetrag|endbetrag|(?<!sub)(?<!sub )total(?!\s+gross)"),
    ]:
        a = _kopf(beleg, dokument, pfad, label, als_betrag)
        if a:
            ergebnis.append(a)

    return ergebnis
