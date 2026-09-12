"""Die Assertion: was ein Beleg sagt, mit Fundstelle und Konfidenz.

Gegenstück zu `document_field_assertion` in deploy/postgres/init.sql und zu
den Einträgen unter `assertions[]` in testdaten/akten/. Eine Assertion wird
nie verändert; der Aktenwert ist eine Ableitung daraus (ADR-001).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .lesen import Seite, Wort

# Konfidenz wird auf drei Nachkommastellen gerundet, passend zu numeric(4,3)
# in der Datenbank.
NACHKOMMASTELLEN_KONFIDENZ = 3

METHODE_ABGELEITET = "abgeleitet"


@dataclass
class Assertion:
    dokument: str
    pfad: str
    wert: Any
    roh: str | None
    konfidenz: float
    seite: int | None
    bbox: list[float] | None
    methode: str
    herleitung: str | None = field(default=None)

    def als_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "dokument": self.dokument,
            "pfad": self.pfad,
            "wert": self.wert,
            "roh": self.roh,
            "konfidenz": round(self.konfidenz, NACHKOMMASTELLEN_KONFIDENZ),
            "seite": self.seite,
            "bbox": self.bbox,
            "methode": self.methode,
        }
        if self.herleitung:
            d["herleitung"] = self.herleitung
        return d


def aus_woertern(
    dokument: str,
    pfad: str,
    wert: Any,
    woerter: list[Wort],
    seite: Seite,
    roh: str | None = None,
) -> Assertion:
    """Assertion aus den Wörtern, die den Wert tragen.

    Konfidenz ist das Minimum über die Wörter: Ein Feld ist so sicher wie sein
    unsicherstes Zeichen. Die Bounding Box ist die Hülle aller Wörter.
    """
    if not woerter:
        raise ValueError(f"{pfad}: Assertion ohne Wörter")
    return Assertion(
        dokument=dokument,
        pfad=pfad,
        wert=wert,
        roh=roh if roh is not None else " ".join(w.text for w in woerter),
        konfidenz=min(w.konfidenz for w in woerter),
        seite=seite.nummer,
        bbox=[
            round(min(w.x0 for w in woerter), 1),
            round(min(w.top for w in woerter), 1),
            round(max(w.x1 for w in woerter), 1),
            round(max(w.bottom for w in woerter), 1),
        ],
        methode=seite.methode,
    )


def abgeleitet(
    dokument: str,
    pfad: str,
    wert: Any,
    quellen: list[Assertion],
    herleitung: str,
) -> Assertion:
    """Assertion, die aus anderen Assertionen desselben Belegs folgt.

    Beispiel: der Wert der Ursprungserzeugnisse einer Ursprungserklärung auf
    der Rechnung ist die Summe der erklärten Positionen. Die Konfidenz ist das
    Minimum der Quellen, die Methode `abgeleitet`, und die Herleitung steht
    dabei, damit ein Prüfer sie nachvollziehen kann.
    """
    if not quellen:
        raise ValueError(f"{pfad}: Ableitung ohne Quellen")
    return Assertion(
        dokument=dokument,
        pfad=pfad,
        wert=wert,
        roh=None,
        konfidenz=min(q.konfidenz for q in quellen),
        seite=quellen[0].seite,
        bbox=None,
        methode=METHODE_ABGELEITET,
        herleitung=herleitung,
    )
