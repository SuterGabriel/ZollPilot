"""Bill of Lading: Nummer, Container, Seal, Häfen, Bruttogewicht, On-board-Datum.

Pfade: bill_of_lading.nummer, .container_id, .seal, .pol, .pod, .brutto_kg,
.on_board. Ob es ein Entwurf ist, entscheidet die Klassifikation; ein Draft
setzt keine Fakten (REF-03), wird aber vollständig gelesen, damit REF-03
sagen kann, was er getragen hätte.
"""

from __future__ import annotations

from ..assertion import Assertion, aus_woertern
from ..lesen import Beleg
from ..normalisierung import als_betrag, als_containernummer, als_datum, als_text, als_unlocode
from .gemeinsam import wert_nach_label


def extrahiere_bill_of_lading(beleg: Beleg, dokument: str) -> list[Assertion]:
    ergebnis: list[Assertion] = []
    for pfad, label, wandle in [
        ("bill_of_lading.nummer", r"b/l\s*(?:no|number|nr)|bill\s+of\s+lading\s*(?:no|number|nr)", als_text),
        ("bill_of_lading.container_id", r"container(?:\s*(?:no|number|nr))?", als_containernummer),
        ("bill_of_lading.seal", r"seal(?:\s*(?:no|number|nr))?", als_text),
        ("bill_of_lading.pol", r"port\s+of\s+loading", als_unlocode),
        ("bill_of_lading.pod", r"port\s+of\s+discharge", als_unlocode),
        ("bill_of_lading.brutto_kg", r"gross\s+weight", als_betrag),
        ("bill_of_lading.on_board", r"shipped\s+on\s+board(?:\s+date)?|on\s+board\s+date", als_datum),
    ]:
        fund = wert_nach_label(beleg, label)
        if not fund:
            continue
        wert = wandle(fund.text)
        if wert is not None:
            ergebnis.append(aus_woertern(dokument, pfad, wert, fund.woerter, fund.seite))
    return ergebnis


def aussteller_bill_of_lading(beleg: Beleg) -> str | None:
    fund = wert_nach_label(beleg, r"carrier|issued\s+by")
    return als_text(fund.text) if fund else None
