"""Werkzeuge für alle Extraktoren: Label finden, Wert dahinter, Block darunter, Tabelle.

Alles arbeitet auf Wörtern mit Koordinaten, nie auf reinem Text. Deshalb
funktioniert derselbe Code auf dem Textlayer und auf OCR-Ergebnissen, und
jede Fundstelle bleibt erhalten.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from ..lesen import Beleg, Seite, Wort, Zeile

# Horizontaler Abstand, ab dem ein Wert auf derselben Zeile endet: Bei
# "Container No.: MSKU1234565     Seal No.: ML-SG-44821" trennt die Lücke
# die beiden Felder. Gemessen in Punkten; etwa drei Leerzeichen bei 10 pt.
WERT_LUECKE_PT = 14.0

# Ein Block unter einem Label (Adresse) endet, wenn der Zeilenabstand größer
# wird als dieses Vielfache der Zeilenhöhe.
BLOCK_ABSTAND_FAKTOR = 1.8
BLOCK_SPALTEN_TOLERANZ_PT = 6.0
BLOCK_MAX_ZEILEN = 8

# Tabellenzeilen enden, wenn eine Lücke größer als dieses Vielfache der
# Zeilenhöhe folgt oder das Ende-Muster greift.
TABELLE_ABSTAND_FAKTOR = 2.5


@dataclass
class Fund:
    text: str
    woerter: list[Wort]
    seite: Seite


def _positionen(zeile: Zeile) -> list[tuple[int, int, Wort]]:
    """Zeichenbereich jedes Worts im Zeilentext (Wörter mit einem Leerzeichen verbunden)."""
    ergebnis = []
    start = 0
    for wort in zeile.woerter:
        ende = start + len(wort.text)
        ergebnis.append((start, ende, wort))
        start = ende + 1
    return ergebnis


def _woerter_im_bereich(zeile: Zeile, von: int, bis: int) -> list[Wort]:
    return [w for s, e, w in _positionen(zeile) if s < bis and e > von]


def _bis_zur_luecke(woerter: list[Wort], luecke: float = WERT_LUECKE_PT) -> list[Wort]:
    if not woerter:
        return []
    ergebnis = [woerter[0]]
    for vorher, wort in zip(woerter, woerter[1:]):
        if wort.x0 - vorher.x1 > luecke:
            break
        ergebnis.append(wort)
    return ergebnis


def finde_zeilen(beleg: Beleg, muster: str) -> list[tuple[Seite, Zeile]]:
    regex = re.compile(muster, re.IGNORECASE)
    return [(s, z) for s in beleg.seiten for z in s.zeilen if regex.search(z.text)]


def wert_nach_label(beleg: Beleg, label: str, naechste_zeile: bool = True) -> Fund | None:
    """Der Wert hinter einem Label: auf derselben Zeile bis zur nächsten Lücke, sonst die Zeile darunter.

    `label` ist ein regulärer Ausdruck ohne Anker; ein optionaler Doppelpunkt
    oder Punkt dahinter gehört zum Label.
    """
    regex = re.compile(r"(?<![A-Za-z])" + label + r"\s*[:.]?\s*", re.IGNORECASE)
    for seite in beleg.seiten:
        for index, zeile in enumerate(seite.zeilen):
            m = regex.search(zeile.text)
            if not m:
                continue
            label_woerter = _woerter_im_bereich(zeile, m.start(), max(m.end() - 1, m.start() + 1))
            rest = [w for s, e, w in _positionen(zeile) if s >= m.end() and w.text not in (":", ".")]
            wert = _bis_zur_luecke(rest)
            if wert:
                return Fund(" ".join(w.text for w in wert), wert, seite)
            if naechste_zeile and index + 1 < len(seite.zeilen) and label_woerter:
                x_label = min(w.x0 for w in label_woerter)
                unten = [w for w in seite.zeilen[index + 1].woerter if w.x0 >= x_label - BLOCK_SPALTEN_TOLERANZ_PT]
                unten = _bis_zur_luecke(unten)
                if unten:
                    return Fund(" ".join(w.text for w in unten), unten, seite)
            return None
    return None


def block_nach_label(beleg: Beleg, label: str) -> list[Fund]:
    """Die Zeilen unter einem Label in derselben Spalte, bis der Abstand zu groß wird.

    Für Adressblöcke: "Seller" links, "Buyer" rechts auf derselben Zeile; jede
    Spalte wird nur aus den Wörtern gebildet, die unter ihrem Label stehen und
    vor dem nächsten Label derselben Zeile enden.
    """
    regex = re.compile(r"(?<![A-Za-z])" + label + r"\s*[:.]?", re.IGNORECASE)
    for seite in beleg.seiten:
        for index, zeile in enumerate(seite.zeilen):
            m = regex.search(zeile.text)
            if not m:
                continue
            label_woerter = _woerter_im_bereich(zeile, m.start(), m.end())
            if not label_woerter:
                continue
            x_von = min(w.x0 for w in label_woerter) - BLOCK_SPALTEN_TOLERANZ_PT
            x_label_ende = max(w.x1 for w in label_woerter)
            rechts = [w.x0 for w in zeile.woerter if w.x0 > x_label_ende + WERT_LUECKE_PT]
            x_bis = min(rechts) - BLOCK_SPALTEN_TOLERANZ_PT if rechts else seite.breite

            funde: list[Fund] = []
            rest = [w for s, e, w in _positionen(zeile) if s >= m.end() and x_von <= w.x0 < x_bis]
            if rest:
                funde.append(Fund(" ".join(w.text for w in rest), rest, seite))
            vorherige = zeile
            for folge in seite.zeilen[index + 1 : index + 1 + BLOCK_MAX_ZEILEN]:
                if folge.top - vorherige.bottom > BLOCK_ABSTAND_FAKTOR * max(vorherige.hoehe, 1.0):
                    break
                woerter = [w for w in folge.woerter if x_von <= w.x0 < x_bis]
                if not woerter:
                    break
                funde.append(Fund(" ".join(w.text for w in woerter), woerter, seite))
                vorherige = folge
            return funde
    return []


def lies_tabelle(beleg: Beleg, spalten: dict[str, str], ende: str, erste_spalte: str) -> list[dict[str, Fund]]:
    """Tabelle über die Spaltenpositionen der Kopfzeile lesen.

    `spalten` bildet Feldnamen auf Muster für die Kopfzeile ab. Die Kopfzeile
    ist die erste Zeile, in der mindestens zwei Drittel der Muster treffen.
    Jedes folgende Wort wird der Spalte zugeordnet, deren Bereich seine Mitte
    enthält. Zeilen ohne Wert in `erste_spalte` setzen die vorige Zeile fort
    (mehrzeilige Beschreibungen). Die Tabelle endet am `ende`-Muster oder an
    einer großen Lücke.
    """
    muster = {name: re.compile(m, re.IGNORECASE) for name, m in spalten.items()}
    ende_regex = re.compile(ende, re.IGNORECASE)
    noetig = max(2, (2 * len(spalten) + 2) // 3)

    for seite in beleg.seiten:
        for index, zeile in enumerate(seite.zeilen):
            treffer: dict[str, tuple[float, float]] = {}
            for name, regex in muster.items():
                m = regex.search(zeile.text)
                if not m:
                    continue
                woerter = _woerter_im_bereich(zeile, m.start(), m.end())
                if woerter:
                    treffer[name] = (min(w.x0 for w in woerter), max(w.x1 for w in woerter))
            if len(treffer) < noetig:
                continue

            geordnet = sorted(treffer.items(), key=lambda kv: kv[1][0])
            grenzen: list[tuple[str, float, float]] = []
            for i, (name, (x0, x1)) in enumerate(geordnet):
                links = 0.0 if i == 0 else (geordnet[i - 1][1][1] + x0) / 2
                rechts = seite.breite if i == len(geordnet) - 1 else (x1 + geordnet[i + 1][1][0]) / 2
                grenzen.append((name, links, rechts))

            zeilen_ergebnis: list[dict[str, list[Wort]]] = []
            vorherige = zeile
            for folge in seite.zeilen[index + 1 :]:
                if ende_regex.search(folge.text):
                    break
                if folge.top - vorherige.bottom > TABELLE_ABSTAND_FAKTOR * max(vorherige.hoehe, 1.0):
                    break
                zellen: dict[str, list[Wort]] = {}
                for wort in folge.woerter:
                    for name, links, rechts in grenzen:
                        if links <= wort.mitte_x < rechts:
                            zellen.setdefault(name, []).append(wort)
                            break
                if erste_spalte in zellen or not zeilen_ergebnis:
                    zeilen_ergebnis.append(zellen)
                else:
                    for name, woerter in zellen.items():
                        zeilen_ergebnis[-1].setdefault(name, []).extend(woerter)
                vorherige = folge

            return [
                {name: Fund(" ".join(w.text for w in ws), ws, seite) for name, ws in zeile_.items()}
                for zeile_ in zeilen_ergebnis
                if zeile_
            ]
    return []
