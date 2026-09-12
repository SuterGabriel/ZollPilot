"""Der Anbieter-Leser: dieselbe Form wie lesen.py, ohne Netz, ohne Erfindung.

Die Antwort unten ist ein von Hand geschriebenes Beispiel in der Form von
Azure `prebuilt-read`, kein Mitschnitt. Es prüft die Übersetzung (Einheiten,
Konfidenz, Zeilen, Fehlerfälle), nicht die Lesequalität des Anbieters. Die
Lesequalität misst die Bewertung, sobald Aufzeichnungen vorliegen
(`python -m zollpilot_extraktion.anbieter stand`).
"""

from __future__ import annotations

import io
import json

import pytest
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from zollpilot_extraktion.akte import extrahiere_akte
from zollpilot_extraktion.anbieter import (
    METHODE_AZURE,
    METHODE_GOOGLE,
    AnbieterAntwortUnbrauchbar,
    AnbieterNichtVerfuegbar,
    fixture_pfad,
    lies_pdf_azure,
    lies_pdf_google,
    sha256,
    uebersetze_azure,
    uebersetze_google,
)
from zollpilot_extraktion.lesen import PUNKTE_PRO_ZOLL, LesungNichtMoeglich, Wort

BREITE_PT, HOEHE_PT = A4


def leeres_pdf(seiten: int = 1) -> bytes:
    puffer = io.BytesIO()
    c = canvas.Canvas(puffer, pagesize=A4, invariant=1)
    for _ in range(seiten):
        c.drawString(40, 800, "Beispiel")
        c.showPage()
    c.save()
    return puffer.getvalue()


def wort(text: str, x: float, y: float, breite: float, hoehe: float, konfidenz: float, versatz: int) -> dict:
    return {
        "content": text,
        "polygon": [x, y, x + breite, y, x + breite, y + hoehe, x, y + hoehe],
        "confidence": konfidenz,
        "span": {"offset": versatz, "length": len(text)},
    }


def antwort_in_zoll() -> dict:
    """Zwei Zeilen, Koordinaten in Zoll, wie Azure sie fuer PDF liefert."""
    inhalt = "Container no.: MSKU1234565\nGross weight: 1.040,00 kg"
    return {
        "status": "succeeded",
        "analyzeResult": {
            "content": inhalt,
            "pages": [
                {
                    "pageNumber": 1,
                    "unit": "inch",
                    "width": BREITE_PT / PUNKTE_PRO_ZOLL,
                    "height": HOEHE_PT / PUNKTE_PRO_ZOLL,
                    "words": [
                        wort("Container", 0.5, 1.0, 0.7, 0.15, 0.99, 0),
                        wort("no.:", 1.25, 1.0, 0.3, 0.15, 0.98, 10),
                        wort("MSKU1234565", 1.6, 1.0, 1.1, 0.15, 0.71, 15),
                        wort("Gross", 0.5, 1.3, 0.4, 0.15, 0.97, 27),
                        wort("weight:", 0.95, 1.3, 0.5, 0.15, 0.96, 33),
                        wort("1.040,00", 1.5, 1.3, 0.6, 0.15, 0.88, 41),
                        wort("kg", 2.15, 1.3, 0.2, 0.15, 0.95, 50),
                    ],
                    "lines": [
                        {"content": "Container no.: MSKU1234565", "spans": [{"offset": 0, "length": 26}]},
                        {"content": "Gross weight: 1.040,00 kg", "spans": [{"offset": 27, "length": 25}]},
                    ],
                }
            ],
        },
    }


def test_uebersetzung_liefert_punkte_und_konfidenz_je_wort():
    daten = leeres_pdf()
    beleg = uebersetze_azure(antwort_in_zoll(), daten, "beispiel.pdf")

    assert len(beleg.seiten) == 1
    seite = beleg.seiten[0]
    assert seite.methode == METHODE_AZURE
    assert (seite.breite, seite.hoehe) == (pytest.approx(BREITE_PT), pytest.approx(HOEHE_PT))
    assert [z.text for z in seite.zeilen] == ["Container no.: MSKU1234565", "Gross weight: 1.040,00 kg"]

    container = next(w for w in seite.woerter if w.text == "MSKU1234565")
    # 1,6 Zoll von links sind 115,2 Punkte; die Konfidenz ist die des Anbieters.
    assert container.x0 == pytest.approx(1.6 * PUNKTE_PRO_ZOLL, abs=0.01)
    assert container.konfidenz == pytest.approx(0.71)
    assert beleg.hash_sha256 and beleg.methoden == [METHODE_AZURE]


def test_pixel_werden_auf_die_seitengroesse_skaliert():
    daten = leeres_pdf()
    antwort = antwort_in_zoll()
    seite = antwort["analyzeResult"]["pages"][0]
    # Dieselbe Seite als Bild mit 200 dpi: Breite in Pixeln, Wörter in Pixeln.
    seite["unit"] = "pixel"
    seite["width"], seite["height"] = round(seite["width"] * 200), round(seite["height"] * 200)
    for w in seite["words"]:
        w["polygon"] = [v * 200 for v in w["polygon"]]
    beleg = uebersetze_azure(antwort, daten, "scan.pdf")
    container = next(w for w in beleg.seiten[0].woerter if w.text == "MSKU1234565")
    assert container.x0 == pytest.approx(1.6 * PUNKTE_PRO_ZOLL, abs=0.5)


def test_zeilen_entstehen_aus_der_geometrie_nicht_aus_azures_zellen():
    """Azure liefert je Tabellenzelle eine `line`; eine Tabellenzeile ist bei uns eine Zeile."""
    antwort = antwort_in_zoll()
    seite = antwort["analyzeResult"]["pages"][0]
    seite["lines"] = [{"content": w["content"], "spans": [w["span"]]} for w in seite["words"]]
    beleg = uebersetze_azure(antwort, leeres_pdf(), "beispiel.pdf")
    assert [z.text for z in beleg.seiten[0].zeilen] == ["Container no.: MSKU1234565", "Gross weight: 1.040,00 kg"]
    assert sum(len(z.woerter) for z in beleg.seiten[0].zeilen) == 7


def test_abgetrennte_satzzeichen_kleben_wieder_am_wort():
    """Azure liest `Invoice No.:` als `Invoice`, `No`, `.:`; der Extraktor sucht das Label `No.:`."""
    antwort = antwort_in_zoll()
    seite = antwort["analyzeResult"]["pages"][0]
    seite["words"] = [
        wort("Invoice", 0.5, 2.0, 0.5, 0.15, 0.99, 60),
        wort("No", 1.05, 2.0, 0.2, 0.15, 0.98, 68),
        wort(".:", 1.25, 2.0, 0.1, 0.15, 0.90, 70),
        wort("INV-1", 1.45, 2.0, 0.4, 0.15, 0.97, 73),
        # Ein Satzzeichen eine halbe Spalte weiter rechts bleibt ein eigenes Wort.
        wort("(", 2.2, 2.0, 0.05, 0.15, 0.95, 79),
    ]
    beleg = uebersetze_azure(antwort, leeres_pdf(), "beispiel.pdf")
    woerter = beleg.seiten[0].woerter
    assert [w.text for w in woerter] == ["Invoice", "No.:", "INV-1", "("]
    geklebt = woerter[1]
    assert geklebt.konfidenz == pytest.approx(0.90)
    assert geklebt.x1 == pytest.approx(1.35 * PUNKTE_PRO_ZOLL, abs=0.01)


def test_schiefer_scan_ergibt_trotzdem_eine_zeile_je_tabellenzeile():
    """Über eine Zeile hinweg wandert die Oberkante um mehr als die Toleranz, zwischen Nachbarn nicht."""
    antwort = antwort_in_zoll()
    seite = antwort["analyzeResult"]["pages"][0]
    # Zwei Tabellenzeilen, Zeilenabstand 0,2 Zoll; die Oberkante steigt je Zelle um 0,04 Zoll
    # (2,9 Punkte), über fünf Zellen also um 11,5 Punkte, mehr als der halbe Zeilenabstand.
    zellen = ["1", "Hydraulikpumpe", "8413.30", "12", "PCE"]
    woerter, versatz = [], 0
    for zeile_nr, y in enumerate((3.0, 3.2)):
        for spalte, text in enumerate(zellen):
            woerter.append(wort(text, 0.5 + spalte * 0.9, y + spalte * 0.04, 0.6, 0.12, 0.9, versatz))
            versatz += len(text) + 1
    seite["words"] = woerter
    beleg = uebersetze_azure(antwort, leeres_pdf(), "scan.pdf")
    assert [z.text for z in beleg.seiten[0].zeilen] == [" ".join(zellen), " ".join(zellen)]


@pytest.mark.parametrize(
    "kaputt, grund",
    [
        (lambda a: a["analyzeResult"].pop("pages"), "keine Seiten"),
        (lambda a: a["analyzeResult"]["pages"][0].update(unit="cm"), "unbekannte Einheit"),
        (lambda a: a["analyzeResult"]["pages"][0].update(pageNumber=7), "das PDF hat 1"),
        (lambda a: a["analyzeResult"]["pages"][0]["words"][0].pop("polygon"), "ohne Polygon"),
    ],
)
def test_unbrauchbare_antwort_wird_benannt(kaputt, grund):
    antwort = antwort_in_zoll()
    kaputt(antwort)
    with pytest.raises(AnbieterAntwortUnbrauchbar, match=grund):
        uebersetze_azure(antwort, leeres_pdf(), "beispiel.pdf")


def test_ohne_aufzeichnung_und_ohne_schluessel_wird_nichts_erfunden(tmp_path, monkeypatch):
    monkeypatch.delenv("ZOLLPILOT_AZURE_DI_KEY", raising=False)
    monkeypatch.delenv("ZOLLPILOT_AZURE_DI_ENDPOINT", raising=False)
    with pytest.raises(AnbieterNichtVerfuegbar, match="keine Aufzeichnung"):
        lies_pdf_azure(leeres_pdf(), "beispiel.pdf", fixtures=tmp_path, aufzeichnen=True)
    # Ohne Aufzeichnungsauftrag wird auch mit Schlüssel nicht gerufen.
    monkeypatch.setenv("ZOLLPILOT_AZURE_DI_KEY", "x")
    monkeypatch.setenv("ZOLLPILOT_AZURE_DI_ENDPOINT", "https://beispiel.invalid")
    with pytest.raises(AnbieterNichtVerfuegbar, match="nicht angefordert"):
        lies_pdf_azure(leeres_pdf(), "beispiel.pdf", fixtures=tmp_path, aufzeichnen=False)


def test_aufzeichnung_wird_gelesen_und_ist_an_den_hash_gebunden(tmp_path):
    daten = leeres_pdf()
    pfad = fixture_pfad(daten, tmp_path)
    pfad.parent.mkdir(parents=True, exist_ok=True)
    pfad.write_text(json.dumps(antwort_in_zoll()), encoding="utf-8")

    beleg = lies_pdf_azure(daten, "beispiel.pdf", fixtures=tmp_path)
    assert [z.text for z in beleg.seiten[0].zeilen][0] == "Container no.: MSKU1234565"

    # Ein anderes PDF hat einen anderen Hash und damit keine Aufzeichnung.
    with pytest.raises(AnbieterNichtVerfuegbar):
        lies_pdf_azure(leeres_pdf(seiten=2), "anderes.pdf", fixtures=tmp_path)


def test_akte_mit_anbieter_leser_haengt_unlesbares_an_und_nennt_den_leser(tmp_path):
    daten = leeres_pdf()

    def leser(d: bytes, name: str):
        return lies_pdf_azure(d, name, fixtures=tmp_path)

    akte = extrahiere_akte({"akte_id": "T-A"}, [("beispiel.pdf", daten)], leser=leser, leser_name="azure")
    assert akte["extraktion"]["leser"] == "azure"
    assert akte["extraktion"]["ocr"] is None
    assert akte["dokumente"][0]["typ"] == "unclassified"
    assert "Leser azure nicht verfügbar" in akte["dokumente"][0]["hinweis"]
    assert akte["extraktion"]["hinweise"] == ["beispiel.pdf: Leser azure nicht verfügbar"]
    assert issubclass(AnbieterNichtVerfuegbar, LesungNichtMoeglich)


def test_ratenlimit_wartet_und_sendet_erneut(monkeypatch):
    """HTTP 429 ist kein Fehler des Belegs: Nach Retry-After noch einmal, dann erst aufgeben."""
    import email.message
    import urllib.error
    import urllib.request

    from zollpilot_extraktion import anbieter

    kopf = email.message.Message()
    kopf["Retry-After"] = "0"
    versuche: list[int] = []
    gewartet: list[float] = []

    class Antwort:
        headers = {"Operation-Location": "https://beispiel.invalid/op/1"}

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    def urlopen(anfrage, timeout=0):
        versuche.append(1)
        if len(versuche) < 3:
            raise urllib.error.HTTPError(anfrage.full_url, 429, "Too Many Requests", kopf, io.BytesIO(b""))
        return Antwort()

    monkeypatch.setattr(urllib.request, "urlopen", urlopen)
    monkeypatch.setattr(anbieter.time, "sleep", gewartet.append)
    anfrage = urllib.request.Request("https://beispiel.invalid/analyze", data=b"{}", method="POST")
    assert anbieter._sende_mit_geduld(anfrage) == "https://beispiel.invalid/op/1"
    assert len(versuche) == 3
    assert gewartet == [0.0, 0.0]

    versuche.clear()
    monkeypatch.setattr(anbieter, "RATENLIMIT_VERSUCHE", 2)
    with pytest.raises(urllib.error.HTTPError):
        anbieter._sende_mit_geduld(anfrage)
    assert len(versuche) == 2


# --- Google Document AI ---------------------------------------------------------

# Der Gesamttext einer Google-Antwort; die Marken zeigen mit Abschnitten darauf
# und tragen ihren eigenen Zwischenraum am Ende.
GOOGLE_TEXT = "Container no.: MSKU-123\nGross weight: 1.040,00 kg\n"


def marke(wort: str, von: int, x0: float, top: float, breite: float, konfidenz: float, bruch: str | None) -> dict:
    """Eine Marke, wie Google sie liefert: Umriss in Anteilen der Seitenkante, Text als Abschnitt.

    `bruch` ist Googles Aussage darüber, ob nach dieser Marke ein Wort endet.
    Ohne Bruch klebt die nächste Marke an dieser.
    """
    hoehe = 10.8
    ecken = [(x0, top), (x0 + breite, top), (x0 + breite, top + hoehe), (x0, top + hoehe)]
    marke_ = {
        "layout": {
            "textAnchor": {"textSegments": [{"startIndex": str(von), "endIndex": str(von + len(wort))}]},
            "boundingPoly": {"normalizedVertices": [{"x": x / BREITE_PT, "y": y / HOEHE_PT} for x, y in ecken]},
            "confidence": konfidenz,
            "orientation": "PAGE_UP",
        }
    }
    if bruch:
        marke_["detectedBreak"] = {"type": bruch}
    return marke_


def antwort_google() -> dict:
    """Von Hand nach der Schemabeschreibung gebaut, keine Aufzeichnung.

    Die echten Antworten liegen unter `tests/fixtures/anbieter/google/`. Dieses
    Beispiel prüft die Übersetzung an den Stellen, die sich beschreiben lassen:
    Anteile werden zu Punkten, Marken ohne Bruch werden ein Wort, die Konfidenz
    ist die kleinste der beteiligten Marken.
    """
    return {
        "document": {
            "text": GOOGLE_TEXT,
            "pages": [
                {
                    "pageNumber": 1,
                    "dimension": {"width": 612.0, "height": 792.0, "unit": "points"},
                    "tokens": [
                        # Die Marke trägt ihr Leerzeichen am Ende, deshalb reicht der Abschnitt darüber.
                        marke("Container ", 0, 36.0, 72.0, 50.4, 0.99, "SPACE"),
                        marke("no", 10, 90.0, 72.0, 14.4, 0.98, None),
                        marke(".: ", 12, 105.0, 72.0, 7.2, 0.97, "SPACE"),
                        # Ein Bindestrich mitten im Wort ist bei Google eine eigene Marke.
                        marke("MSKU", 15, 115.2, 72.0, 28.8, 0.71, None),
                        marke("-", 19, 144.3, 72.0, 3.6, 0.93, None),
                        marke("123\n", 20, 148.2, 72.0, 18.0, 0.90, "WIDE_SPACE"),
                        marke("Gross ", 24, 36.0, 93.6, 32.4, 0.97, "SPACE"),
                        marke("weight", 30, 68.4, 93.6, 32.4, 0.96, None),
                        marke(": ", 36, 101.0, 93.6, 3.6, 0.96, "SPACE"),
                        marke("1.040,00 ", 38, 108.0, 93.6, 46.8, 0.88, "SPACE"),
                        marke("kg\n", 47, 154.8, 93.6, 14.4, 0.95, "WIDE_SPACE"),
                    ],
                }
            ],
        }
    }


def test_google_uebersetzung_liefert_punkte_und_konfidenz_je_wort():
    daten = leeres_pdf()
    beleg = uebersetze_google(antwort_google(), daten, "beispiel.pdf")

    seite = beleg.seiten[0]
    assert seite.methode == METHODE_GOOGLE
    # Die Seitengröße kommt aus dem PDF, nicht aus der Antwort: Google nennt
    # oben 612 mal 792 Punkte, das Blatt ist aber A4.
    assert (seite.breite, seite.hoehe) == (pytest.approx(BREITE_PT), pytest.approx(HOEHE_PT))
    assert [z.text for z in seite.zeilen] == ["Container no.: MSKU-123", "Gross weight: 1.040,00 kg"]

    container = next(w for w in seite.woerter if w.text == "MSKU-123")
    assert container.x0 == pytest.approx(115.2, abs=0.01)
    assert container.top == pytest.approx(72.0, abs=0.01)
    # Die Box umfasst alle drei Marken, die Konfidenz ist die schlechteste davon.
    assert container.x1 == pytest.approx(166.2, abs=0.01)
    assert container.konfidenz == pytest.approx(0.71)
    assert beleg.hash_sha256 == sha256(daten)
    assert beleg.methoden == [METHODE_GOOGLE]


def test_google_marken_ohne_bruch_werden_ein_wort():
    """Elf Marken, sieben Wörter: `no` `.:` und `MSKU` `-` `123` gehören je zusammen."""
    beleg = uebersetze_google(antwort_google(), leeres_pdf(), "beispiel.pdf")
    assert [w.text for w in beleg.seiten[0].woerter] == [
        "Container",
        "no.:",
        "MSKU-123",
        "Gross",
        "weight:",
        "1.040,00",
        "kg",
    ]


def test_zeilentoleranz_waechst_mit_dem_abstand_weil_ein_scan_schief_steht():
    """Eine feste Toleranz reicht auf dem schlechten Scan nicht über die Blattbreite.

    Die Zahlen sind gemessen, nicht erfunden: In der Kopfzeile der
    Packstücktabelle steht `Type` bei x 174,6 mit Oberkante 259,9 und das
    nächste Wort `Gross` bei x 301,4 mit 254,9. Fünf Punkte Unterschied, mehr
    als die viereinhalb Punkte für nahe Nachbarn, und trotzdem dieselbe
    Tabellenzeile. Das Blatt steht um 1,3 Grad schief.
    """
    from zollpilot_extraktion.anbieter import _zeilen_entlang_der_nachbarn

    def wo(text: str, x0: float, top: float) -> Wort:
        return Wort(text=text, x0=x0, top=top, x1=x0 + 20.0, bottom=top + 10.0, konfidenz=0.9)

    kopf = [wo("Package", 38.6, 262.0), wo("Type", 174.6, 259.9), wo("Gross", 301.4, 254.9), wo("Net", 445.1, 251.4)]
    zeile = [wo("PAL-1", 39.3, 282.2), wo("Palette", 174.9, 278.6), wo("980,00", 299.9, 276.1), wo("900,00", 444.1, 272.2)]

    gebildet = _zeilen_entlang_der_nachbarn(kopf + zeile)
    assert [z.text for z in gebildet] == ["Package Type Gross Net", "PAL-1 Palette 980,00 900,00"]


@pytest.mark.parametrize(
    "kaputt, grund",
    [
        (lambda a: a["document"].pop("text"), "keine Textgrundlage"),
        (lambda a: a["document"].pop("pages"), "keine Seiten"),
        (lambda a: a["document"]["pages"][0].update(pageNumber=7), "das PDF hat 1"),
        (
            lambda a: a["document"]["pages"][0]["tokens"][0]["layout"]["boundingPoly"].pop("normalizedVertices"),
            "ohne Umriss",
        ),
    ],
)
def test_google_unbrauchbare_antwort_wird_benannt(kaputt, grund):
    antwort = antwort_google()
    kaputt(antwort)
    with pytest.raises(AnbieterAntwortUnbrauchbar, match=grund):
        uebersetze_google(antwort, leeres_pdf(), "beispiel.pdf")


def test_google_ohne_aufzeichnung_und_ohne_konto_wird_nichts_erfunden(tmp_path, monkeypatch):
    for name in ("ZOLLPILOT_GOOGLE_DI_KONTO", "ZOLLPILOT_GOOGLE_DI_PROJEKT", "ZOLLPILOT_GOOGLE_DI_PROZESSOR"):
        monkeypatch.delenv(name, raising=False)
    with pytest.raises(AnbieterNichtVerfuegbar, match="keine Aufzeichnung"):
        lies_pdf_google(leeres_pdf(), "beispiel.pdf", fixtures=tmp_path, aufzeichnen=True)

    daten = leeres_pdf()
    pfad = fixture_pfad(daten, tmp_path)
    pfad.parent.mkdir(parents=True, exist_ok=True)
    pfad.write_text(json.dumps(antwort_google()), encoding="utf-8")
    beleg = lies_pdf_google(daten, "beispiel.pdf", fixtures=tmp_path)
    assert [z.text for z in beleg.seiten[0].zeilen][0] == "Container no.: MSKU-123"


def test_google_zugriffstoken_ist_ein_selbst_signiertes_jwt(monkeypatch):
    """Der Zugang zu Google ist von Hand gebaut, also wird er von Hand geprüft.

    Google nimmt kein Kennwort im Kopfzeilenfeld. Der Ablauf ist: ein JWT mit
    dem privaten Schlüssel des Dienstkontos signieren und gegen ein Token
    tauschen. Dieser Test erzeugt ein eigenes Schlüsselpaar, fängt die
    Anfrage ab und prüft die Signatur so, wie Google sie prüfen würde.
    """
    import base64 as b64
    import urllib.parse
    import urllib.request

    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding, rsa

    from zollpilot_extraktion import anbieter

    def entpacke(teil: str) -> bytes:
        return b64.urlsafe_b64decode(teil + "=" * (-len(teil) % 4))

    paar = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    konto = {
        "client_email": "zollpilot-leser@beispiel.iam.gserviceaccount.com",
        "private_key": paar.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        ).decode("ascii"),
        "token_uri": "https://oauth2.beispiel.invalid/token",
    }

    gesehen: dict[str, str] = {}

    class Antwort:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self):
            return json.dumps({"access_token": "tok-1", "expires_in": 3600}).encode("utf-8")

    def urlopen(anfrage, timeout=0):
        gesehen["url"] = anfrage.full_url
        gesehen["rumpf"] = anfrage.data.decode("ascii")
        return Antwort()

    monkeypatch.setattr(urllib.request, "urlopen", urlopen)
    assert anbieter._google_zugriffstoken(konto) == "tok-1"

    assert gesehen["url"] == konto["token_uri"]
    felder = dict(urllib.parse.parse_qsl(gesehen["rumpf"]))
    assert felder["grant_type"] == "urn:ietf:params:oauth:grant-type:jwt-bearer"

    kopf, nutzlast, signatur = felder["assertion"].split(".")
    assert json.loads(entpacke(kopf)) == {"alg": "RS256", "typ": "JWT"}
    inhalt = json.loads(entpacke(nutzlast))
    assert inhalt["iss"] == konto["client_email"]
    assert inhalt["aud"] == konto["token_uri"]
    assert inhalt["scope"] == "https://www.googleapis.com/auth/cloud-platform"
    assert inhalt["exp"] - inhalt["iat"] == 3600
    # Ohne gültige Signatur weist Google den Tausch ab; das ist die eigentliche Probe.
    paar.public_key().verify(
        entpacke(signatur), f"{kopf}.{nutzlast}".encode("ascii"), padding.PKCS1v15(), hashes.SHA256()
    )
