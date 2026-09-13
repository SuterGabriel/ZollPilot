"""Der Klassifikationsfallback: was er verschickt, was er annimmt, was er wird.

Zwei Ebenen. Die Mechanik läuft immer: Was geht hinaus, welche Antwort wird
angenommen, welche zurückgewiesen, und ruft der Fallback ungefragt. Die Probe
am echten Beleg läuft nur, wenn die Aufzeichnung im Repo liegt; ohne sie wird
sie übersprungen und nicht grün behauptet.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from zollpilot_extraktion.akte import extrahiere_akte
from zollpilot_extraktion.klassifikation import TYP_UNCLASSIFIED, klassifiziere
from zollpilot_extraktion.modell import (
    FIXTURES,
    ModellAntwortUnbrauchbar,
    ModellNichtVerfuegbar,
    anfrage,
    fixture_pfad,
    lies_vorschlag,
    schlage_typ_vor,
)

# Ein Frachtbrief, den die Regeln nicht kennen: `klassifikation.py` hat kein
# Merkmal für CMR (`docs/01-dokumententypologie.md` beschreibt den Typ, die
# Merkmalsliste kennt ihn nicht). Genau dafür ist der Fallback da.
CMR_TEXT = (Path(__file__).parent / "fixtures" / "cmr-frachtbrief.txt").read_text(encoding="utf-8")


def antwort_mit(typ: str, konfidenz: float = 0.92, begruendung: str = "Ueberschrift CMR") -> dict:
    """Eine Antwort in der Form, die der Dienst liefert."""
    text = json.dumps({"typ": typ, "konfidenz": konfidenz, "begruendung": begruendung}, ensure_ascii=False)
    return {"model": "claude-haiku-4-5-20251001", "content": [{"type": "text", "text": text}]}


def test_die_regeln_kennen_den_frachtbrief_nicht() -> None:
    """Die Voraussetzung des Fallbacks, als Test festgehalten."""
    assert klassifiziere(CMR_TEXT).typ == TYP_UNCLASSIFIED


def test_was_hinausgeht_traegt_keine_partei() -> None:
    from zollpilot_extraktion.pseudonymisierung import pseudonymisiere

    rumpf = anfrage(pseudonymisiere(CMR_TEXT).text)
    hinaus = json.dumps(rumpf, ensure_ascii=False)
    for verboten in ("Nordlicht", "Pacific Trading", "Sonnenallee", "Elbe Spedition"):
        assert verboten not in hinaus, verboten
    # Die Gestalt bleibt: Daran erkennt das Modell den Typ.
    assert "CMR" in hinaus
    assert "FRACHTBRIEF" in hinaus


def test_derselbe_text_findet_dieselbe_aufzeichnung() -> None:
    eins = fixture_pfad(anfrage("COMMERCIAL INVOICE"))
    zwei = fixture_pfad(anfrage("COMMERCIAL INVOICE"))
    drei = fixture_pfad(anfrage("PACKING LIST"))
    assert eins == zwei
    assert eins != drei


def test_ein_anderes_modell_ist_eine_andere_aufzeichnung() -> None:
    a = fixture_pfad(anfrage("COMMERCIAL INVOICE", modell="modell-a"))
    b = fixture_pfad(anfrage("COMMERCIAL INVOICE", modell="modell-b"))
    assert a != b


def test_die_antwort_wird_gelesen_und_begrenzt() -> None:
    vorschlag = lies_vorschlag(antwort_mit("cmr", konfidenz=1.7), "modell-x")
    assert vorschlag.typ == "cmr"
    assert vorschlag.konfidenz == 1.0
    assert vorschlag.methode == "modell"
    assert vorschlag.modell == "claude-haiku-4-5-20251001"


def test_ein_erfundener_typ_wird_zurueckgewiesen() -> None:
    with pytest.raises(ModellAntwortUnbrauchbar):
        lies_vorschlag(antwort_mit("lieferschein_neu"), "modell-x")


def test_text_ohne_json_wird_zurueckgewiesen() -> None:
    with pytest.raises(ModellAntwortUnbrauchbar):
        lies_vorschlag({"content": [{"type": "text", "text": "Das ist wohl ein Frachtbrief."}]}, "modell-x")


def test_ohne_aufzeichnung_und_ohne_auftrag_wird_nicht_gerufen(tmp_path) -> None:
    with pytest.raises(ModellNichtVerfuegbar):
        schlage_typ_vor(CMR_TEXT, fixtures=tmp_path)


def test_die_aufzeichnung_wird_gelesen(tmp_path) -> None:
    from zollpilot_extraktion.pseudonymisierung import pseudonymisiere

    rumpf = anfrage(pseudonymisiere(CMR_TEXT).text)
    pfad = fixture_pfad(rumpf, tmp_path)
    pfad.write_text(json.dumps(antwort_mit("cmr")), encoding="utf-8")

    vorschlag = schlage_typ_vor(CMR_TEXT, fixtures=tmp_path)
    assert vorschlag.typ == "cmr"
    assert vorschlag.konfidenz == 0.92


def test_der_vorschlag_ersetzt_den_belegtyp_nicht(tmp_path, monkeypatch) -> None:
    """Die Grenze aus ADR-011, am zusammengebauten Dokument geprüft."""
    from zollpilot_extraktion import modell as modul

    monkeypatch.setattr(modul, "FIXTURES", tmp_path)
    rumpf = anfrage(__import__("zollpilot_extraktion.pseudonymisierung", fromlist=["x"]).pseudonymisiere(CMR_TEXT).text)
    fixture_pfad(rumpf, tmp_path).write_text(json.dumps(antwort_mit("cmr")), encoding="utf-8")

    beleg = type("Beleg", (), {})()
    beleg.text = CMR_TEXT
    beleg.seiten = []
    beleg.methoden = ["textlayer"]
    beleg.hash_sha256 = "0" * 64

    akte = extrahiere_akte({"akte_id": "ZP-TEST"}, [("cmr.pdf", b"%PDF-1.4")], leser=lambda daten, name: beleg)
    dokument = akte["dokumente"][0]
    assert dokument["typ"] == TYP_UNCLASSIFIED
    assert dokument["klassifikation"]["vorschlag"]["typ"] == "cmr"
    assert dokument["klassifikation"]["vorschlag"]["methode"] == "modell"
    assert "Modellvorschlag: cmr" in dokument["hinweis"]
    assert any("Modell" in h for h in akte["extraktion"]["hinweise"])


def test_ohne_fallback_bleibt_alles_wie_vorher(tmp_path) -> None:
    beleg = type("Beleg", (), {})()
    beleg.text = CMR_TEXT
    beleg.seiten = []
    beleg.methoden = ["textlayer"]
    beleg.hash_sha256 = "0" * 64

    akte = extrahiere_akte(
        {"akte_id": "ZP-TEST"},
        [("cmr.pdf", b"%PDF-1.4")],
        leser=lambda daten, name: beleg,
        modell_fallback=False,
    )
    dokument = akte["dokumente"][0]
    assert dokument["typ"] == TYP_UNCLASSIFIED
    assert "vorschlag" not in dokument["klassifikation"]


@pytest.mark.skipif(
    not FIXTURES.exists() or not any(FIXTURES.glob("*.json")),
    reason="keine Modell-Aufzeichnung im Repo; siehe docs/EXTRAKTION.md, Abschnitt Klassifikationsfallback",
)
def test_der_aufgezeichnete_lauf_schlaegt_cmr_vor() -> None:
    """Die einzige Stelle, die eine echte Modellantwort prüft."""
    vorschlag = schlage_typ_vor(CMR_TEXT)
    assert vorschlag.typ == "cmr"
    assert vorschlag.konfidenz >= 0.5
    assert vorschlag.begruendung
