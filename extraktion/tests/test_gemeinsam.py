"""Label, Wert, Block, Tabelle — auf synthetischen Seiten aus Wörtern mit Koordinaten.

Die Seiten werden hier aus Text gebaut: ein Wort ist 6 pt pro Zeichen breit,
ein Leerzeichen 3 pt, eine Zeile 12 pt hoch. Damit lässt sich die Lücken- und
Spaltenlogik prüfen, ohne ein PDF zu rendern.
"""

from zollpilot_extraktion.felder.gemeinsam import block_nach_label, lies_tabelle, wert_nach_label
from zollpilot_extraktion.lesen import Beleg, Seite, Wort, gruppiere_zeilen

ZEICHEN_PT = 6.0
LEER_PT = 3.0
ZEILE_PT = 12.0


def seite_aus(zeilen: list[list[tuple[float, str]]], konfidenz: float = 0.99) -> Seite:
    """zeilen: je Zeile Liste von (x-Start, Text); der Text wird an Leerzeichen in Wörter zerlegt."""
    woerter = []
    for nr, teile in enumerate(zeilen):
        top = 20 + nr * ZEILE_PT
        for x, text in teile:
            for wort in text.split(" "):
                if wort:
                    woerter.append(Wort(wort, x, top, x + len(wort) * ZEICHEN_PT, top + 10, konfidenz))
                x += len(wort) * ZEICHEN_PT + LEER_PT
    return Seite(1, 595, 842, "textlayer", woerter, gruppiere_zeilen(woerter))


def beleg_aus(zeilen) -> Beleg:
    return Beleg("test.pdf", "0" * 64, [seite_aus(zeilen)])


def test_wert_auf_derselben_zeile_endet_an_der_luecke():
    beleg = beleg_aus([[(40, "Container No.: MSKU1234565"), (320, "Seal No.: ML-SG-44821")]])
    assert wert_nach_label(beleg, r"container(?:\s*(?:no|number))?").text == "MSKU1234565"
    assert wert_nach_label(beleg, r"seal(?:\s*(?:no|number))?").text == "ML-SG-44821"


def test_wert_in_der_naechsten_zeile():
    beleg = beleg_aus([[(40, "Invoice No.")], [(40, "INV-2026-0417")]])
    assert wert_nach_label(beleg, r"invoice\s*no").text == "INV-2026-0417"


def test_label_ohne_wert_ist_none():
    beleg = beleg_aus([[(40, "Invoice No.")]])
    assert wert_nach_label(beleg, r"invoice\s*no") is None


def test_label_nicht_in_wort():
    # "date" darf nicht mitten in "update" treffen.
    beleg = beleg_aus([[(40, "Last update: gestern")], [(40, "Date: 2026-09-08")]])
    assert wert_nach_label(beleg, r"date").text == "2026-09-08"


def test_block_zwei_spalten():
    beleg = beleg_aus([
        [(40, "Seller"), (320, "Buyer")],
        [(40, "Nordlicht Maschinenbau GmbH"), (320, "Aurora Trading Pte. Ltd.")],
        [(40, "Hafenstraße 12"), (320, "8 Marina View")],
        [(40, "Germany"), (320, "Singapore")],
    ])
    links = [f.text for f in block_nach_label(beleg, r"seller")]
    rechts = [f.text for f in block_nach_label(beleg, r"buyer")]
    assert links == ["Nordlicht Maschinenbau GmbH", "Hafenstraße 12", "Germany"]
    assert rechts == ["Aurora Trading Pte. Ltd.", "8 Marina View", "Singapore"]


def test_block_endet_an_grosser_luecke():
    zeilen = [[(40, "Seller")], [(40, "Nordlicht GmbH")], [(40, "Germany")]]
    beleg = beleg_aus(zeilen)
    # Eine weit entfernte Zeile darf nicht mehr zum Block gehören.
    seite = beleg.seiten[0]
    fern = Wort("Invoice", 40, 200, 80, 210, 0.99)
    seite.woerter.append(fern)
    seite.zeilen = gruppiere_zeilen(seite.woerter)
    assert [f.text for f in block_nach_label(beleg, r"seller")] == ["Nordlicht GmbH", "Germany"]


def test_tabelle_mit_fortsetzungszeile_und_ende():
    beleg = beleg_aus([
        [(40, "Pos"), (70, "Description"), (250, "HS code"), (330, "Qty"), (400, "Amount")],
        [(40, "1"), (70, "Hydraulikpumpe Typ"), (250, "8413.30"), (330, "12"), (400, "17.400,00")],
        [(70, "HP-40 Ausführung B")],
        [(40, "2"), (70, "Dichtungssatz"), (250, "8484.20"), (330, "12"), (400, "1.020,00")],
        [(40, "Subtotal:"), (400, "18.420,00")],
        [(40, "3"), (70, "nicht mehr Teil der Tabelle")],
    ])
    zeilen = lies_tabelle(
        beleg,
        {"nr": r"\bpos\b", "beschreibung": r"description", "hs6": r"hs\s*code", "menge": r"qty", "netto": r"amount"},
        ende=r"^\s*subtotal",
        erste_spalte="nr",
    )
    assert len(zeilen) == 2
    assert zeilen[0]["beschreibung"].text == "Hydraulikpumpe Typ HP-40 Ausführung B"
    assert zeilen[0]["netto"].text == "17.400,00"
    assert zeilen[1]["hs6"].text == "8484.20"
    assert zeilen[0]["nr"].woerter[0].konfidenz == 0.99


def test_tabelle_ohne_kopf_ist_leer():
    beleg = beleg_aus([[(40, "Nur Text ohne Tabelle")]])
    assert lies_tabelle(beleg, {"a": r"pos", "b": r"qty", "c": r"amount"}, ende=r"total", erste_spalte="a") == []


def test_konfidenz_ist_minimum_der_woerter():
    seite = seite_aus([[(40, "Container No.: MSKU1234565")]], konfidenz=0.55)
    beleg = Beleg("t.pdf", "0" * 64, [seite])
    fund = wert_nach_label(beleg, r"container\s*no")
    assert min(w.konfidenz for w in fund.woerter) == 0.55
