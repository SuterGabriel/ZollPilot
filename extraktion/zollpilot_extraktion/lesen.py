"""Schicht 1: aus Pixeln oder Textlayer werden Wörter mit Koordinaten.

Zwei Wege je Seite (docs/07-idp-ocr.md, Vorverarbeitung):

  textlayer  Das PDF trägt Text mit Koordinaten (digital erzeugt). Kein OCR
             nötig; das zu erkennen spart Kosten und Fehler.
  ocr        Die Seite ist ein Bild. Sie wird gerendert und Tesseract liest
             sie; jedes Wort bekommt die Konfidenz, die Tesseract meldet.

Beide Wege liefern dieselbe Form: Seiten mit Wörtern (Text, x0, top, x1,
bottom, Konfidenz) und daraus gruppierten Zeilen. Alles Weitere arbeitet nur
auf dieser Form — ein anderer OCR-Anbieter ersetzt genau diese Datei.

Koordinaten sind PDF-Punkte (1/72 Zoll), Ursprung oben links, wie bei
pdfplumber. OCR-Pixel werden umgerechnet, damit Fundstellen vergleichbar sind.
"""

from __future__ import annotations

import hashlib
import io
import os
from dataclasses import dataclass, field

import pdfplumber

METHODE_TEXTLAYER = "textlayer"
METHODE_OCR = "ocr"

# Ein Textlayer gilt als brauchbar, wenn die Seite mindestens so viele Wörter
# trägt. Darunter ist es meist ein Scan mit Restzeichen oder eine leere Seite.
MIN_WOERTER_TEXTLAYER = 8

# Ein Textlayer ist keine OCR-Lesung, aber auch keine Gewissheit: Er kann aus
# einer fremden OCR stammen oder Sonderzeichen verlieren. 0,99 statt 1,0 hält
# das im Datensatz sichtbar und entspricht den Testakten.
KONFIDENZ_TEXTLAYER = 0.99

# Rendern für OCR. 300 dpi ist die übliche Empfehlung von Tesseract.
OCR_DPI = 300
PUNKTE_PRO_ZOLL = 72.0

# Zeilenbildung: Wörter, deren Oberkante höchstens so weit auseinanderliegt,
# stehen in derselben Zeile.
ZEILEN_TOLERANZ_PT = 3.0

OCR_SPRACHEN = os.environ.get("EXTRAKTION_OCR_SPRACHEN", "deu+eng")
# psm 6: eine gleichmäßige Textfläche. Für Formulare und Listen zuverlässiger
# als die vollautomatische Segmentierung, die Spalten gern vertauscht.
OCR_KONFIGURATION = os.environ.get("EXTRAKTION_OCR_KONFIGURATION", "--psm 6")

TESSERACT_WORTEBENE = 5
TESSERACT_KONFIDENZ_MAXIMUM = 100.0


class LesungNichtMoeglich(RuntimeError):
    """Der Leser kann diesen Beleg nicht lesen; die Akte meldet das, verwirft aber nichts.

    Gemeinsame Wurzel für Tesseract ohne Installation und für einen Anbieter
    ohne Aufzeichnung (`anbieter.py`): `akte.py` behandelt beide gleich.
    """


class OcrNichtVerfuegbar(LesungNichtMoeglich):
    """Eine Seite braucht OCR, aber Tesseract ist nicht installiert."""


class KeinLesbaresPdf(ValueError):
    """Die Datei ist kein PDF, das sich öffnen lässt."""


@dataclass(frozen=True)
class Wort:
    text: str
    x0: float
    top: float
    x1: float
    bottom: float
    konfidenz: float

    @property
    def mitte_x(self) -> float:
        return (self.x0 + self.x1) / 2


@dataclass
class Zeile:
    woerter: list[Wort]

    @property
    def text(self) -> str:
        return " ".join(w.text for w in self.woerter)

    @property
    def top(self) -> float:
        return min(w.top for w in self.woerter)

    @property
    def bottom(self) -> float:
        return max(w.bottom for w in self.woerter)

    @property
    def x0(self) -> float:
        return min(w.x0 for w in self.woerter)

    @property
    def hoehe(self) -> float:
        return self.bottom - self.top


@dataclass
class Seite:
    nummer: int
    breite: float
    hoehe: float
    methode: str
    woerter: list[Wort]
    zeilen: list[Zeile] = field(default_factory=list)


@dataclass
class Beleg:
    dateiname: str
    hash_sha256: str
    seiten: list[Seite]

    @property
    def text(self) -> str:
        return "\n".join(z.text for s in self.seiten for z in s.zeilen)

    @property
    def methoden(self) -> list[str]:
        return sorted({s.methode for s in self.seiten})


def gruppiere_zeilen(woerter: list[Wort], toleranz: float = ZEILEN_TOLERANZ_PT) -> list[Zeile]:
    """Wörter nach Oberkante zu Zeilen gruppieren, innerhalb der Zeile von links nach rechts."""
    zeilen: list[Zeile] = []
    for wort in sorted(woerter, key=lambda w: (w.top, w.x0)):
        if zeilen and abs(zeilen[-1].woerter[0].top - wort.top) <= toleranz:
            zeilen[-1].woerter.append(wort)
        else:
            zeilen.append(Zeile([wort]))
    for zeile in zeilen:
        zeile.woerter.sort(key=lambda w: w.x0)
    return zeilen


def ocr_version() -> str | None:
    """Versionsstring von Tesseract oder None, wenn es fehlt."""
    try:
        import pytesseract

        return str(pytesseract.get_tesseract_version())
    except Exception:  # noqa: BLE001 - jede Ursache heißt: kein OCR
        return None


def _woerter_aus_textlayer(seite) -> list[Wort]:
    roh = seite.extract_words(x_tolerance=1.5, y_tolerance=ZEILEN_TOLERANZ_PT, keep_blank_chars=False)
    return [
        Wort(
            text=w["text"],
            x0=float(w["x0"]),
            top=float(w["top"]),
            x1=float(w["x1"]),
            bottom=float(w["bottom"]),
            konfidenz=KONFIDENZ_TEXTLAYER,
        )
        for w in roh
        if w["text"].strip()
    ]


# Deterministische Vorverarbeitung (docs/07, Schritt 1): Kontrast spreizen,
# Körnung mit einem Medianfilter glätten. Kein Deskew — Tesseract kommt mit
# wenigen Grad Schieflage zurecht, und ein falsch erkannter Winkel schadet
# mehr als er nützt. Wer mehr braucht, ersetzt diese Funktion.
MEDIAN_FENSTER = 3
AUTOKONTRAST_ABSCHNITT_PROZENT = 1


def vorverarbeite(bild):
    from PIL import ImageFilter, ImageOps

    bild = ImageOps.autocontrast(bild, cutoff=AUTOKONTRAST_ABSCHNITT_PROZENT)
    return bild.filter(ImageFilter.MedianFilter(MEDIAN_FENSTER))


def _woerter_per_ocr(daten: bytes, seitenindex: int, dateiname: str) -> tuple[list[Wort], list[Zeile]]:
    if ocr_version() is None:
        raise OcrNichtVerfuegbar(f"{dateiname}, Seite {seitenindex + 1}: Tesseract nicht verfügbar")

    import pypdfium2 as pdfium
    import pytesseract

    pdf = pdfium.PdfDocument(daten)
    try:
        bild = pdf[seitenindex].render(scale=OCR_DPI / PUNKTE_PRO_ZOLL).to_pil().convert("L")
    finally:
        pdf.close()
    bild = vorverarbeite(bild)

    daten_ocr = pytesseract.image_to_data(
        bild, lang=OCR_SPRACHEN, config=OCR_KONFIGURATION, output_type=pytesseract.Output.DICT
    )
    faktor = PUNKTE_PRO_ZOLL / OCR_DPI
    zeilen_map: dict[tuple[int, int, int], list[Wort]] = {}
    woerter: list[Wort] = []
    for i, text in enumerate(daten_ocr["text"]):
        if int(daten_ocr["level"][i]) != TESSERACT_WORTEBENE or not str(text).strip():
            continue
        konf = float(daten_ocr["conf"][i])
        if konf < 0:
            continue
        x0 = daten_ocr["left"][i] * faktor
        top = daten_ocr["top"][i] * faktor
        wort = Wort(
            text=str(text).strip(),
            x0=x0,
            top=top,
            x1=x0 + daten_ocr["width"][i] * faktor,
            bottom=top + daten_ocr["height"][i] * faktor,
            konfidenz=konf / TESSERACT_KONFIDENZ_MAXIMUM,
        )
        woerter.append(wort)
        schluessel = (int(daten_ocr["block_num"][i]), int(daten_ocr["par_num"][i]), int(daten_ocr["line_num"][i]))
        zeilen_map.setdefault(schluessel, []).append(wort)

    # Tesseract kennt seine Zeilen selbst; das ist bei schiefen Scans besser
    # als eine Gruppierung nach Oberkante.
    zeilen = [Zeile(sorted(ws, key=lambda w: w.x0)) for _, ws in sorted(zeilen_map.items(), key=lambda kv: min(w.top for w in kv[1]))]
    return woerter, zeilen


def lies_pdf(daten: bytes, dateiname: str, ocr: bool = True) -> Beleg:
    """Ein PDF in Seiten mit Wörtern und Zeilen zerlegen.

    `ocr=False` lässt Bildseiten leer statt Tesseract zu rufen — für Tests
    und Umgebungen ohne OCR. Eine Seite ohne Textlayer erscheint dann mit
    Methode `ocr` und ohne Wörter; die Akte meldet das als Hinweis.
    """
    hash_hex = hashlib.sha256(daten).hexdigest()
    try:
        pdf = pdfplumber.open(io.BytesIO(daten))
    except Exception as e:  # noqa: BLE001 - pdfminer wirft verschiedene Typen
        raise KeinLesbaresPdf(f"{dateiname}: {e.__class__.__name__}: {e}") from e

    seiten: list[Seite] = []
    with pdf:
        for index, seite in enumerate(pdf.pages):
            woerter = _woerter_aus_textlayer(seite)
            if len(woerter) >= MIN_WOERTER_TEXTLAYER:
                seiten.append(
                    Seite(index + 1, float(seite.width), float(seite.height), METHODE_TEXTLAYER, woerter, gruppiere_zeilen(woerter))
                )
                continue
            if not ocr:
                seiten.append(Seite(index + 1, float(seite.width), float(seite.height), METHODE_OCR, [], []))
                continue
            woerter, zeilen = _woerter_per_ocr(daten, index, dateiname)
            seiten.append(Seite(index + 1, float(seite.width), float(seite.height), METHODE_OCR, woerter, zeilen))
    return Beleg(dateiname=dateiname, hash_sha256=hash_hex, seiten=seiten)
