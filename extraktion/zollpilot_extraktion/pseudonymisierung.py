"""Vor jedem Modellaufruf: Parteien raus, Form bleibt (ADR-011).

`docs/DATENSCHUTZ.md` verlangt es seit dem ersten Tag: Bevor ein Ausschnitt
an einen externen Sprachdienst geht, werden Parteien durch Platzhalter
ersetzt, und die Zuordnung bleibt hier. Der Klassifikationsfallback braucht
die Gestalt eines Belegs, nicht seine Beteiligten: "Commercial Invoice",
"Port of Loading", "MRN" bleiben stehen; wer liefert, wohin und unter welcher
Nummer, geht nicht mit.

Ersetzt werden Firmen, Anschriften, Ansprechpartner, E-Mail, Telefon, IBAN,
EORI, USt-IdNr. und REX. Derselbe Wert bekommt denselben Platzhalter,
nummeriert nach dem ersten Vorkommen; damit bleibt lesbar, dass zwei Stellen
dieselbe Partei nennen, ohne zu verraten, welche.

Diese Datei behauptet nichts über eine Akte und entscheidet nichts. Sie ist
eine Textverwandlung mit einer lokalen Zuordnungstabelle.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# Rechtsformen, an denen ein Firmenname endet. Die Liste ist bewusst kurz und
# auf das beschränkt, was im Außenhandel vorkommt; ein unbekannter Name ohne
# Rechtsform fällt hier nicht auf, wohl aber über seine Anschrift.
RECHTSFORMEN = (
    r"GmbH\s*&\s*Co\.?\s*KG|GmbH|mbH|AG|KGaA|KG|OHG|SE|UG|e\.\s?K\.|"
    r"Ltd\.?|Limited|PLC|Inc\.?|LLC|Corp\.?|Co\.\s?Ltd\.?|Pte\.?\s?Ltd\.?|"
    r"S\.A\.S\.?|S\.A\.|SARL|SAS|B\.V\.|N\.V\.|S\.p\.A\.|SpA|A/S|ApS|AB|Oy"
)

# Feldnamen, hinter denen eine Partei steht. Der Name bleibt stehen, der Wert
# dahinter geht; sonst verschwände die Pseudonymisierung genau das Merkmal,
# an dem ein Modell den Belegtyp erkennt.
PARTEIFELDER = (
    r"shipper|consignee|notify(?:\s+party)?|exporteur|importeur|empfänger|"
    r"absender|verkäufer|käufer|buyer|seller|carrier|frachtführer|"
    r"ansprechpartner|contact|attn|kunde|lieferant|versender|anmelder|"
    r"declarant|vertreter"
)

# Kategorie, Muster, Platzhalterstamm. Die Reihenfolge ist die Anwendung:
# Erst das Enge (eine IBAN, eine EORI), dann das Weite (eine Anschrift),
# sonst frisst das weite Muster die Nummer, die eigenes Gewicht hätte.
REGELN: tuple[tuple[str, re.Pattern[str], int], ...] = (
    ("MAIL", re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"), 0),
    ("IBAN", re.compile(r"\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}\b"), 0),
    ("EORI", re.compile(r"\bEORI[-\s:]*([A-Z]{2}[A-Z0-9]{8,15})\b", re.I), 1),
    ("REX", re.compile(r"\bREX[-\s:]*([A-Z]{2}[A-Z0-9/]{4,20})\b", re.I), 1),
    (
        "USTID",
        re.compile(r"\b(?:USt[-\s]?IdNr\.?|VAT(?:\s+No\.?)?|Steuernummer)[-\s:]*([A-Z]{2}[A-Z0-9]{6,14})\b", re.I),
        1,
    ),
    ("TELEFON", re.compile(r"(?:\+|00)\d[\d\s()/-]{7,20}\d"), 0),
    ("PARTEI", re.compile(rf"(?im)^([ \t]*(?:{PARTEIFELDER})[ \t]*[:\-][ \t]*)(\S.*?)[ \t]*$"), 2),
    ("PARTEI", re.compile(rf"\b(?:[A-ZÄÖÜ][\w&.'’äöüß-]+[ ]){{1,4}}(?:{RECHTSFORMEN})(?![\w])"), 0),
    (
        "ANSCHRIFT",
        re.compile(
            r"\b[A-ZÄÖÜ][\wäöüß.-]*"
            r"(?:straße|strasse|str\.|weg|allee|platz|gasse|ring|damm|ufer)[ ]?\d+[a-z]?\b",
            re.I,
        ),
        0,
    ),
    (
        "ANSCHRIFT",
        re.compile(r"\b\d{4,5}[ ](?![A-Z]{2,4}\b)[A-ZÄÖÜ][\wäöüß-]{2,}(?:[ ][A-ZÄÖÜ][\wäöüß-]{2,})?"),
        0,
    ),
)


@dataclass
class Pseudonymisierung:
    """Der Text ohne Parteien und die Zuordnung, die hier bleibt."""

    text: str
    zuordnung: dict[str, str] = field(default_factory=dict)

    @property
    def ersetzungen(self) -> int:
        return len(self.zuordnung)

    def zurueck(self, text: str) -> str:
        """Platzhalter wieder durch das Original ersetzen, für Anzeige und Test."""
        for platzhalter, original in self.zuordnung.items():
            text = text.replace(platzhalter, original)
        return text


def pseudonymisiere(text: str) -> Pseudonymisierung:
    """Text ohne Parteien, mit stabiler Zuordnung je Kategorie."""
    zuordnung: dict[str, str] = {}
    vergeben: dict[tuple[str, str], str] = {}

    def platzhalter(kategorie: str, original: str) -> str:
        schluessel = (kategorie, original.strip())
        vorhanden = vergeben.get(schluessel)
        if vorhanden:
            return vorhanden
        nummer = sum(1 for k, _ in vergeben if k == kategorie) + 1
        neu = f"[{kategorie}-{nummer}]"
        vergeben[schluessel] = neu
        zuordnung[neu] = original.strip()
        return neu

    ergebnis = text
    for kategorie, muster, gruppe in REGELN:

        def ersetze(treffer: re.Match[str], kategorie: str = kategorie, gruppe: int = gruppe) -> str:
            if gruppe == 0:
                return platzhalter(kategorie, treffer.group(0))
            if gruppe == 1:
                # Der Feldname bleibt stehen, nur die Nummer dahinter geht.
                return treffer.group(0).replace(treffer.group(1), platzhalter(kategorie, treffer.group(1)))
            return treffer.group(1) + platzhalter(kategorie, treffer.group(2))

        ergebnis = muster.sub(ersetze, ergebnis)

    return Pseudonymisierung(ergebnis, zuordnung)
