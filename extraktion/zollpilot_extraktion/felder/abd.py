"""Ausfuhrbegleitdokument (ABD): MRN, Ausführer, Bestimmungsland, Container, Positionen.

Pfade: abd.mrn, abd.ausfuehrer.name, abd.ausfuehrer.eori, abd.bestimmungsland,
abd.container_id, abd.positionen.N.{nr, warennummer, menge}. Die Warennummer
ist die achtstellige KN der Anmeldung, nicht HS-6; ob sie zur Rechnung passt,
prüft CUS-05. Die MRN wird nur auf ihre Struktur normalisiert (docs/04); die
Prüfziffer bleibt offen (docs/08). Was das ABD nicht ist, steht in docs/01:
kein Ausgangsvermerk.
"""

from __future__ import annotations

from ..assertion import Assertion, aus_woertern
from ..lesen import Beleg
from ..normalisierung import als_betrag, als_containernummer, als_ganzzahl, als_land, als_mrn, als_text, als_warencode
from .gemeinsam import block_nach_label, lies_tabelle, wert_nach_label
from .handelsrechnung import EORI

SPALTEN_POSITIONEN = {
    "nr": r"\bpos\.?\b|\bitem\b",
    "warennummer": r"warennummer|commodity\s+code|\bkn\b|\btaric\b",
    "beschreibung": r"warenbezeichnung|description",
    "menge": r"\bmenge\b|\bqty\b|\bquantity\b",
    "einheit": r"\beinheit\b|\bunit\b",
}
ENDE_POSITIONEN = r"^\s*(dieses\s+dokument|gesamt|total|unterschrift|dienststempel)"


def extrahiere_abd(beleg: Beleg, dokument: str) -> list[Assertion]:
    ergebnis: list[Assertion] = []

    for pfad, label, wandle in [
        ("abd.mrn", r"mrn", als_mrn),
        ("abd.bestimmungsland", r"bestimmungsland|country\s+of\s+destination", als_land),
        ("abd.container_id", r"container(?:\s*(?:no|nr|nummer))?", als_containernummer),
    ]:
        fund = wert_nach_label(beleg, label)
        if not fund:
            continue
        wert = wandle(fund.text)
        if wert is not None:
            ergebnis.append(aus_woertern(dokument, pfad, wert, fund.woerter, fund.seite))

    block = block_nach_label(beleg, r"ausf[üu]hrer(?:\s*/\s*versender)?|exporter(?:\s*/\s*consignor)?")
    if block:
        name = block[0]
        if als_text(name.text):
            ergebnis.append(aus_woertern(dokument, "abd.ausfuehrer.name", als_text(name.text), name.woerter, name.seite))
        for fund in block:
            m = EORI.search(fund.text)
            if m:
                ergebnis.append(aus_woertern(dokument, "abd.ausfuehrer.eori", m.group(1).upper(), fund.woerter, fund.seite, roh=fund.text))
                break

    for index, zelle in enumerate(lies_tabelle(beleg, SPALTEN_POSITIONEN, ENDE_POSITIONEN, erste_spalte="nr")):
        basis = f"abd.positionen.{index}"
        for feld, wandle in [("nr", als_ganzzahl), ("warennummer", als_warencode), ("menge", als_betrag)]:
            fund = zelle.get(feld)
            if fund and wandle(fund.text) is not None:
                ergebnis.append(aus_woertern(dokument, f"{basis}.{feld}", wandle(fund.text), fund.woerter, fund.seite))

    return ergebnis
