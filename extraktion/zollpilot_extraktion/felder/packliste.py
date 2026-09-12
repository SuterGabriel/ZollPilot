"""Packliste: Nummer, Container, Positionen, Packstücke, Bruttogesamt.

Pfade: packliste.nummer, packliste.container_id, packliste.positionen.N.*,
packliste.packstuecke.N.*, packliste.brutto_gesamt_kg. Die häufigste
Fehlerquelle laut docs/01 — brutto und netto vertauscht — prüft QTY-03; hier
wird nur gelesen.
"""

from __future__ import annotations

from ..assertion import Assertion, aus_woertern
from ..lesen import Beleg
from ..normalisierung import als_betrag, als_containernummer, als_ganzzahl, als_text, als_warencode
from .gemeinsam import lies_tabelle, wert_nach_label

# Auch Spalten, die nicht gelesen werden (Unit, Packed in), stehen hier: Der
# Tabellenleser braucht sie, um die Spaltengrenzen zu ziehen. Ohne sie
# schluckt die letzte bekannte Spalte alles rechts von ihr.
SPALTEN_POSITIONEN = {
    "nr": r"\bpos\.?\b|\bitem\b",
    "hs6": r"\bhs\s*code\b|\bhs\b",
    "menge": r"\bqty\b|\bquantity\b|\bmenge\b",
    "einheit": r"\bunit\b|\beinheit\b",
    "verpackt_in": r"\bpacked\s+in\b|\bpackage\b|\bpackst[üu]ck\b",
}
ENDE_POSITIONEN = r"^\s*(packages|package\s+id|packst[üu]cke|total)"

SPALTEN_PACKSTUECKE = {
    "id": r"\bpackage\s*id\b|\bpackst[üu]ck\b|\bid\b",
    "art": r"\btype\b|\bart\b",
    "brutto_kg": r"\bgross\b",
    "netto_kg": r"\bnet\b",
}
ENDE_PACKSTUECKE = r"^\s*total"


def extrahiere_packliste(beleg: Beleg, dokument: str) -> list[Assertion]:
    ergebnis: list[Assertion] = []

    fund = wert_nach_label(beleg, r"packing\s+list\s*(?:no|number|nr)|packlisten?\s*(?:nr|nummer)")
    if fund and als_text(fund.text):
        ergebnis.append(aus_woertern(dokument, "packliste.nummer", als_text(fund.text), fund.woerter, fund.seite))

    fund = wert_nach_label(beleg, r"container(?:\s*(?:no|number|nr))?")
    if fund and als_containernummer(fund.text):
        ergebnis.append(aus_woertern(dokument, "packliste.container_id", als_containernummer(fund.text), fund.woerter, fund.seite))

    for index, zelle in enumerate(lies_tabelle(beleg, SPALTEN_POSITIONEN, ENDE_POSITIONEN, erste_spalte="nr")):
        basis = f"packliste.positionen.{index}"
        for feld, wandle in [("nr", als_ganzzahl), ("menge", als_betrag), ("hs6", als_warencode)]:
            f = zelle.get(feld)
            if f and wandle(f.text) is not None:
                ergebnis.append(aus_woertern(dokument, f"{basis}.{feld}", wandle(f.text), f.woerter, f.seite))

    for index, zelle in enumerate(lies_tabelle(beleg, SPALTEN_PACKSTUECKE, ENDE_PACKSTUECKE, erste_spalte="id")):
        basis = f"packliste.packstuecke.{index}"
        for feld, wandle in [("id", als_text), ("art", als_text), ("brutto_kg", als_betrag), ("netto_kg", als_betrag)]:
            f = zelle.get(feld)
            if f and wandle(f.text) is not None:
                ergebnis.append(aus_woertern(dokument, f"{basis}.{feld}", wandle(f.text), f.woerter, f.seite))

    fund = wert_nach_label(beleg, r"total\s+gross\s+weight|gesamt\s*brutto|bruttogesamt")
    if fund and als_betrag(fund.text) is not None:
        ergebnis.append(aus_woertern(dokument, "packliste.brutto_gesamt_kg", als_betrag(fund.text), fund.woerter, fund.seite))

    return ergebnis


def aussteller_packliste(beleg: Beleg) -> str | None:
    fund = wert_nach_label(beleg, r"issued\s+by|shipper|exporter|aussteller")
    return als_text(fund.text) if fund else None
