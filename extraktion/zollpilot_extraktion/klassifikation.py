"""Schicht 2: welcher Belegtyp, und ist es ein Entwurf.

Regelbasiert über Schlüsselmerkmale im Text (PROJECT.md, Abschnitt 3:
"regelbasiert mit LLM-Fallback bei niedriger Konfidenz"). Der Fallback ist
nicht gebaut; ein Beleg ohne klares Merkmal wird `unclassified` und bleibt
an der Akte (CLAUDE.md, harte Grenze 2: nichts stillschweigend verwerfen).

Die Belegtypen sind die aus `dokumente[].typ` (Skill zoll-domain). Neue Typen
zuerst in pflichtmatrix.yaml einordnen, dann hier.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

TYP_UNCLASSIFIED = "unclassified"
STATUS_FINAL = "final"
STATUS_DRAFT = "draft"

# Merkmal und Gewicht je Typ. Ein starkes Merkmal (3) ist die Überschrift des
# Belegs; schwache Merkmale (1) sind Feldnamen, die auch anderswo vorkommen.
MERKMALE: dict[str, list[tuple[str, float]]] = {
    "handelsrechnung": [
        (r"commercial\s+invoice", 3), (r"handelsrechnung", 3),
        (r"\binvoice\s*(?:no|number|nr|date)\b", 2), (r"\binvoice\b", 1),
    ],
    "proformarechnung": [(r"pro\s*-?\s*forma", 3)],
    "packliste": [
        (r"packing\s+list", 3), (r"packliste", 3),
        (r"gross\s+weight", 0.5), (r"net\s+weight", 0.5), (r"package\s+id", 0.5),
    ],
    "bill_of_lading": [
        (r"bill\s+of\s+lading", 3), (r"\bb/l\b", 2),
        (r"port\s+of\s+loading", 1), (r"port\s+of\s+discharge", 1), (r"shipped\s+on\s+board", 1),
    ],
    "sea_waybill": [(r"sea\s+waybill", 3)],
    "eur1": [(r"\beur\.?\s*1\b", 2), (r"movement\s+certificate", 2), (r"warenverkehrsbescheinigung", 2)],
    "atr": [(r"\ba\.?\s?tr\b", 2)],
}

# Unter dieser Punktzahl ist kein Typ sicher genug.
MIN_PUNKTE = 2.0

# Ein Entwurf darf keine Fakten setzen (REF-03). Diese Marken sind die
# üblichen; "non-negotiable" allein reicht nicht, weil ein Sea Waybill
# das legitim trägt.
DRAFT_MARKEN = [r"\bdraft\b", r"\bentwurf\b", r"non-?\s?negotiable\s+copy", r"\bcopy\s+only\b", r"\bverify\s+copy\b", r"\bpro\s*forma\s+b/l\b"]


@dataclass
class Klassifikation:
    typ: str
    konfidenz: float
    status: str
    merkmale: list[str]


def klassifiziere(text: str) -> Klassifikation:
    t = " ".join(text.lower().split())
    punkte: dict[str, float] = {}
    gefunden: dict[str, list[str]] = {}
    for typ, merkmale in MERKMALE.items():
        for muster, gewicht in merkmale:
            if re.search(muster, t):
                punkte[typ] = punkte.get(typ, 0.0) + gewicht
                gefunden.setdefault(typ, []).append(muster)

    status = STATUS_DRAFT if any(re.search(m, t) for m in DRAFT_MARKEN) else STATUS_FINAL

    if not punkte:
        return Klassifikation(TYP_UNCLASSIFIED, 0.0, status, [])

    # Eine Proformarechnung ist auch eine Rechnung; das Merkmal "pro forma"
    # entscheidet, nicht die Summe der Rechnungsmerkmale.
    if punkte.get("proformarechnung", 0) >= MIN_PUNKTE:
        punkte.pop("handelsrechnung", None)

    rang = sorted(punkte.items(), key=lambda kv: kv[1], reverse=True)
    bester, beste_punkte = rang[0]
    zweite_punkte = rang[1][1] if len(rang) > 1 else 0.0
    if beste_punkte < MIN_PUNKTE:
        return Klassifikation(TYP_UNCLASSIFIED, 0.0, status, gefunden.get(bester, []))

    konfidenz = beste_punkte / (beste_punkte + zweite_punkte)
    return Klassifikation(bester, round(konfidenz, 3), status, gefunden[bester])
