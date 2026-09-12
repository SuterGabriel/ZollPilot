"""Ursprungserklärung auf der Rechnung: ein eigener logischer Beleg.

ADR-001 modelliert die Erklärung als Dokument vom Typ `origin_declaration`
mit `traeger: <Rechnungs-ID>`. Der Klassifikator trennt sie hier aus der
Rechnung heraus; ob das auf echten Belegen zuverlässig ist, entscheidet sich
erst mit einem Korpus (docs/OFFENE-PUNKTE.md).

Der Wortlaut ist abkommensabhängig (ORG-07, nicht im MVP). Erkannt wird
das gemeinsame Gerüst: "exporter of the products covered by this document"
und "preferential origin".
"""

from __future__ import annotations

import re

from ..assertion import Assertion, abgeleitet, aus_woertern
from ..lesen import Beleg, Wort, Seite
from ..normalisierung import als_land

ANFANG = re.compile(r"exporter\s+of\s+the\s+products\s+covered\s+by\s+this\s+document", re.IGNORECASE)
ENDE = re.compile(r"preferential\s+origin", re.IGNORECASE)
URSPRUNG = re.compile(r"are\s+of\s+(?P<land>[A-Za-zÄÖÜäöü' ]+?)\s+preferential\s+origin", re.IGNORECASE)
REX = re.compile(r"authori[sz]ation\s+No\.?\s*(?P<rex>[A-Z]{2}REX[A-Z0-9]+)", re.IGNORECASE)
ERMAECHTIGTER = re.compile(r"approved\s+exporter|ermächtigter\s+ausführer", re.IGNORECASE)

MAX_ZEILEN_ERKLAERUNG = 8
TYP = "origin_declaration"


def erkenne_ursprungserklaerung(beleg: Beleg) -> tuple[Seite, list[Wort], str] | None:
    """Seite, Wörter und Text der Erklärung, oder None."""
    for seite in beleg.seiten:
        for index, zeile in enumerate(seite.zeilen):
            if not ANFANG.search(zeile.text):
                continue
            woerter: list[Wort] = []
            texte: list[str] = []
            for folge in seite.zeilen[index : index + MAX_ZEILEN_ERKLAERUNG]:
                woerter.extend(folge.woerter)
                texte.append(folge.text)
                if ENDE.search(folge.text):
                    return seite, woerter, " ".join(texte)
            # Anfang ohne Ende: kein vollständiger Wortlaut, keine Erklärung.
            return None
    return None


def extrahiere_ursprungserklaerung(
    beleg: Beleg, dokument: str, rechnung: list[Assertion]
) -> list[Assertion] | None:
    fund = erkenne_ursprungserklaerung(beleg)
    if not fund:
        return None
    seite, woerter, text = fund
    ergebnis: list[Assertion] = [aus_woertern(dokument, "praeferenznachweis.typ", TYP, woerter, seite, roh=TYP)]

    m = URSPRUNG.search(text)
    if m:
        # Ein nicht erkennbares Land ("EU") bleibt als Rohwert mit Wert None
        # stehen: ORG-02 wird dann nicht prüfbar — und sagt, warum.
        ergebnis.append(aus_woertern(dokument, "praeferenznachweis.ursprung", als_land(m.group("land")), woerter, seite, roh=m.group("land").strip()))

    m = REX.search(text)
    if m:
        ergebnis.append(aus_woertern(dokument, "praeferenznachweis.rex_nummer", m.group("rex").upper(), woerter, seite, roh=m.group("rex")))
    if ERMAECHTIGTER.search(text):
        ergebnis.append(aus_woertern(dokument, "praeferenznachweis.ermaechtigter_ausfuehrer", True, woerter, seite))

    # Die Erklärung deckt "the products covered by this document": alle
    # Positionen der Trägerrechnung. Wert der Ursprungserzeugnisse und
    # Warenkreis sind Ableitungen daraus, keine eigene Belegaussage.
    positionen: dict[int, dict[str, Assertion]] = {}
    for a in rechnung:
        m = re.match(r"rechnung\.positionen\.(\d+)\.(nr|hs6|netto)$", a.pfad)
        if m:
            positionen.setdefault(int(m.group(1)), {})[m.group(2)] = a
    nettos = [p["netto"] for p in positionen.values() if "netto" in p]
    if nettos:
        summe = sum(a.wert for a in nettos)
        ergebnis.append(
            abgeleitet(
                dokument,
                "praeferenznachweis.ursprungswert",
                int(summe) if float(summe).is_integer() else summe,
                nettos,
                "Summe der Positionsnetto der Trägerrechnung; die Erklärung deckt alle Positionen des Belegs",
            )
        )
    for index in sorted(positionen):
        p = positionen[index]
        if "nr" in p and "hs6" in p:
            ergebnis.append(abgeleitet(dokument, f"praeferenznachweis.warenkreis.{index}.pos", p["nr"].wert, [p["nr"]], "Position der Trägerrechnung"))
            ergebnis.append(abgeleitet(dokument, f"praeferenznachweis.warenkreis.{index}.hs6", p["hs6"].wert, [p["hs6"]], "HS-Code der Position auf der Trägerrechnung"))
    return ergebnis
