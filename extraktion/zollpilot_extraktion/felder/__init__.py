"""Schicht 3: Feldwerte je Belegtyp.

Jeder Extraktor bekommt einen gelesenen Beleg und eine Dokument-ID und gibt
Assertions zurück. Er sucht Labels und Tabellenköpfe — labelgetrieben, eine
Layoutfamilie (ADR-005, Konsequenzen). Was er nicht findet, lässt er weg;
die Regel meldet dann `nicht_pruefbar`.
"""

from .abd import extrahiere_abd
from .bill_of_lading import extrahiere_bill_of_lading
from .handelsrechnung import extrahiere_handelsrechnung
from .packliste import extrahiere_packliste
from .ursprungserklaerung import erkenne_ursprungserklaerung, extrahiere_ursprungserklaerung

EXTRAKTOREN = {
    "handelsrechnung": extrahiere_handelsrechnung,
    "packliste": extrahiere_packliste,
    "bill_of_lading": extrahiere_bill_of_lading,
    "abd": extrahiere_abd,
}

__all__ = [
    "EXTRAKTOREN",
    "erkenne_ursprungserklaerung",
    "extrahiere_ursprungserklaerung",
]
