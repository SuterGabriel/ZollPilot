"""Zweites Lesemodul: die Antwort eines IDP-Anbieters in dieselbe Form wie `lesen.py`.

Der Vergleichslauf aus ADR-005: Wer Document AI, ABBYY oder Azure einsetzt,
ersetzt genau die Schicht Lesen. Angeschlossen sind zwei Anbieter, weil eine
Nahtstelle erst mit dem zweiten Anbieter bewiesen ist:

  - **Azure Document Intelligence**, Modell `prebuilt-read`. Ein Schlüssel im
    Kopfzeilenfeld genügt, die Stufe F0 ist kostenlos. Der Aufruf ist
    zweistufig: anstoßen, dann abholen.
  - **Google Document AI**, Prozessortyp `Document OCR`. Der Aufruf ist
    einstufig, der Zugang dafür aufwendiger: ein Dienstkonto, dessen privater
    Schlüssel ein JWT signiert, das gegen ein Zugriffstoken getauscht wird.

Beide liefern Wörter mit Umriss und Konfidenz, mehr braucht die Schicht Lesen
nicht. Layout-, Rechnungs- oder trainierte Feldmodelle würden Feldwerte
liefern und damit die Schicht `felder/` ersetzen, nicht diese; sie sind
deshalb bewusst nicht gewählt.

Drei Zusagen:

  1. Der Zugang kommt nur aus der Umgebung, nie aus dem Code. Bei Azure sind
     das Endpunkt und Schlüssel, bei Google der Pfad zur Schlüsseldatei des
     Dienstkontos samt Projekt, Region und Prozessor.
  2. Antworten werden einmal aufgezeichnet und liegen als JSON unter
     `tests/fixtures/anbieter/<anbieter>/<sha256>.json`. Tests und Bewertung
     lesen die Aufzeichnung; sie brauchen keinen Zugang. Fehlt eine
     Aufzeichnung und fehlt der Zugang, sagt der Leser das, statt etwas zu
     erfinden.
  3. Nur synthetische Belege gehen an einen Anbieter (docs/DATENSCHUTZ.md).
     Für echte Belege bräuchte ein Anbieteraufruf die Pseudonymisierung, die
     es nicht gibt; dieser Leser ist ein Vergleichswerkzeug, kein Betriebsweg.

Koordinaten: Azure liefert für PDF Zoll (`unit: inch`), für Bilder Pixel;
Google liefert Anteile der Seitenkante zwischen 0 und 1. Alles wird in
PDF-Punkte umgerechnet, gemessen an der Seitengröße aus dem PDF selbst, damit
Fundstellen mit `lesen.py` vergleichbar bleiben. Die Konfidenz je Wort ist die
des Anbieters, 0 bis 1.

Zwei Eigenheiten gleicht die Übersetzung aus, damit dieselben Feldextraktoren
laufen (an den ersten Vergleichsläufen gelernt, 2026-09-12 und 2026-09-13):

  - **Zeilen sind bei beiden Anbietern Zellen.** In einer Tabelle steht jede
    Spalte für sich. Die Zeilen entstehen deshalb aus den Wortkoordinaten,
    Nachbar an Nachbar, damit auch ein schiefer Scan eine Tabellenzeile als
    eine Zeile ergibt (`_zeilen_entlang_der_nachbarn`).
  - **Beide trennen feiner als ein Wort** (`No` `.:` statt `No.:`, `MAEU` `-`
    `HH` statt `MAEU-HH`). Wo ein Wort endet, sagt Google selbst
    (`detectedBreak`, `_google_woerter`). Azure sagt es nicht: Sein Gesamttext
    setzt vor das abgetrennte Zeichen selbst ein Leerzeichen, also bleibt nur
    die Lücke im Bild als Anhalt (`_klebe_satzzeichen`). Derselbe Zweck, zwei
    Wege, weil die Anbieter unterschiedlich viel über sich verraten.

    python -m zollpilot_extraktion.anbieter stand                     # was aufgezeichnet ist
    python -m zollpilot_extraktion.anbieter aufzeichnen               # alle Testbelege, Azure
    python -m zollpilot_extraktion.anbieter aufzeichnen --anbieter google
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pdfplumber

from .lesen import PUNKTE_PRO_ZOLL, Beleg, KeinLesbaresPdf, LesungNichtMoeglich, Seite, Wort, Zeile

ANBIETER_AZURE = "azure"
ANBIETER_GOOGLE = "google"
METHODE_AZURE = ANBIETER_AZURE
METHODE_GOOGLE = ANBIETER_GOOGLE

UMGEBUNG_ENDPUNKT = "ZOLLPILOT_AZURE_DI_ENDPOINT"
UMGEBUNG_SCHLUESSEL = "ZOLLPILOT_AZURE_DI_KEY"
UMGEBUNG_GOOGLE_KONTO = "ZOLLPILOT_GOOGLE_DI_KONTO"
UMGEBUNG_GOOGLE_PROJEKT = "ZOLLPILOT_GOOGLE_DI_PROJEKT"
UMGEBUNG_GOOGLE_REGION = "ZOLLPILOT_GOOGLE_DI_REGION"
UMGEBUNG_GOOGLE_PROZESSOR = "ZOLLPILOT_GOOGLE_DI_PROZESSOR"

# Die REST-Schnittstellen, Stand der jeweiligen GA-Version.
API_VERSION = "2024-11-30"
MODELL = "prebuilt-read"
GOOGLE_API = "v1"
GOOGLE_BEREICH = "https://www.googleapis.com/auth/cloud-platform"
GOOGLE_TOKEN_GUELTIG_S = 3600

ABFRAGE_INTERVALL_S = 1.5
ABFRAGE_MAX_S = 120
ANTWORT_MAX_S = 120
# Ratenlimit (HTTP 429): so oft warten und erneut senden; die Stufe F0 erlaubt
# 20 Aufrufe pro Minute, eine Aufzeichnung aller Testbelege reißt das sonst.
RATENLIMIT_VERSUCHE = 5
RATENLIMIT_WARTEZEIT_S = 15.0

# Zeilenbildung, zwischen Nachbarn: Die Umrisse der Anbieter umschließen die
# Glyphen eng, deshalb liegt die Oberkante einer Ziffer bis zu drei Punkte
# unter der eines Großbuchstabens derselben Zeile. Die Toleranz ist darum
# weiter als beim Textlayer, aber deutlich unter einem Zeilenabstand
# (mindestens zwölf Punkte im Golden Set).
ZEILEN_TOLERANZ_PT = 4.5
# Ein Scan steht schief, und dann wandert die Oberkante mit dem waagerechten
# Abstand: Auf dem schlechten Scan des Golden Sets sind es 1,3 Grad, also über
# die Blattbreite mehr als zehn Punkte. Die Toleranz wächst deshalb mit dem
# Abstand zum linken Nachbarn. Die Steigung entspricht zwei Grad; das lässt
# Luft über den gemessenen Scan hinaus und bleibt bei jedem Spaltenabstand
# des Golden Sets unter einem Zeilenabstand.
ZEILEN_SCHRAEGE = 0.035
# Ein Wort nur aus diesen Zeichen ist ein abgetrenntes Satzzeichen und gehört
# zum Wort links davon, wenn die Lücke kleiner ist als jeder Spaltenabstand
# (im Golden Set mindestens fünfzehn Punkte) und nicht viel größer als ein
# Leerzeichen (bei neun Punkt Schrift etwa zweieinhalb).
KLEBE_LUECKE_PT = 6.0
SATZZEICHEN = set(".:,;!?)]}%'\"")

WURZEL = Path(__file__).resolve().parents[2]
FIXTURES_WURZEL = WURZEL / "extraktion" / "tests" / "fixtures" / "anbieter"
BELEGE = WURZEL / "testdaten" / "belege"


def fixtures_fuer(anbieter: str) -> Path:
    return FIXTURES_WURZEL / anbieter


FIXTURES = fixtures_fuer(ANBIETER_AZURE)
FIXTURES_GOOGLE = fixtures_fuer(ANBIETER_GOOGLE)


class AnbieterNichtVerfuegbar(LesungNichtMoeglich):
    """Keine Aufzeichnung für diesen Beleg und kein Zugang in der Umgebung."""


class AnbieterAntwortUnbrauchbar(ValueError):
    """Die Antwort hat nicht die Form, die die Übersetzung erwartet."""


def sha256(daten: bytes) -> str:
    return hashlib.sha256(daten).hexdigest()


def fixture_pfad(daten: bytes, ordner: Path = FIXTURES) -> Path:
    return ordner / f"{sha256(daten)}.json"


def _kurz(pfad: Path) -> str:
    """Pfad relativ zur Repo-Wurzel, wenn er darin liegt; sonst absolut (Tests nutzen Temp-Ordner)."""
    try:
        return str(pfad.relative_to(WURZEL))
    except ValueError:
        return str(pfad)


def _seitengroessen(daten: bytes, dateiname: str) -> list[tuple[float, float]]:
    """Breite und Höhe je Seite in Punkten, aus dem PDF selbst."""
    try:
        with pdfplumber.open(io.BytesIO(daten)) as pdf:
            return [(float(s.width), float(s.height)) for s in pdf.pages]
    except Exception as e:  # noqa: BLE001 - pdfminer wirft verschiedene Typen
        raise KeinLesbaresPdf(f"{dateiname}: {e.__class__.__name__}: {e}") from e


def _seitengroesse(groessen: list[tuple[float, float]], nummer: int) -> tuple[float, float]:
    if nummer - 1 >= len(groessen):
        raise AnbieterAntwortUnbrauchbar(f"Antwort nennt Seite {nummer}, das PDF hat {len(groessen)}")
    return groessen[nummer - 1]


def _klebe_satzzeichen(woerter: list[Wort], luecke: float = KLEBE_LUECKE_PT) -> list[Wort]:
    """Anbieter trennen Satzzeichen als eigene Wörter ab; Textlayer und Tesseract tun das nicht.

    Ein Wort nur aus Satzzeichen, das in derselben Zeile rechts neben dem
    vorigen Wort steht, gehört zu ihm. Ob dazwischen ein Leerzeichen war,
    lässt sich nicht ablesen: Der Gesamttext der Antwort enthält vor dem
    abgetrennten Zeichen selbst eines (`No .:`), und die Umrisse umschließen
    die Glyphen so eng, dass die Lücke vor einem echten Leerzeichen kleiner
    sein kann als die vor einem Punkt. Deshalb zählt nur, dass das Zeichen
    näher steht als eine Spalte. Konfidenz: Minimum beider; Box: verlängert.
    """
    ergebnis: list[Wort] = []
    for wort in woerter:
        voriges = ergebnis[-1] if ergebnis else None
        if (
            voriges is not None
            and set(wort.text) <= SATZZEICHEN
            and -1.0 <= wort.x0 - voriges.x1 <= luecke
            and abs(wort.top - voriges.top) <= ZEILEN_TOLERANZ_PT
        ):
            ergebnis[-1] = Wort(
                text=voriges.text + wort.text,
                x0=voriges.x0,
                top=min(voriges.top, wort.top),
                x1=max(voriges.x1, wort.x1),
                bottom=max(voriges.bottom, wort.bottom),
                konfidenz=min(voriges.konfidenz, wort.konfidenz),
            )
        else:
            ergebnis.append(wort)
    return ergebnis


def _zeilen_entlang_der_nachbarn(woerter: list[Wort], toleranz: float = ZEILEN_TOLERANZ_PT) -> list[Zeile]:
    """Zeilen bilden, indem jedes Wort an die Zeile anschließt, deren rechtes Ende ihm am nächsten liegt.

    `lesen.py` gruppiert nach der Oberkante des ersten Wortes einer Zeile. Das
    reicht für Textlayer, weil dort nichts schief steht. Ein Scan steht
    schief, und ein Anbieter gibt die Wörter so zurück, wie sie im Bild
    liegen: Über eine Tabellenzeile hinweg wandert die Oberkante um mehr als
    die Toleranz. Tesseract löst das mit eigener Zeilenerkennung, die Anbieter
    liefern nur Zellen. Deshalb hier: Von links nach rechts schließt ein Wort
    an die Zeile an, deren letztes Wort links von ihm steht und in der
    Oberkante höchstens um die Toleranz abweicht; die Abweichung zwischen
    Nachbarn bleibt bei einem schiefen Scan klein, auch wenn sie über die
    Zeile groß wird. Passt keine Zeile, beginnt eine neue.
    """
    zeilen: list[list[Wort]] = []
    for wort in sorted(woerter, key=lambda w: (w.x0, w.top)):
        beste: list[Wort] | None = None
        for zeile in zeilen:
            letztes = zeile[-1]
            # Verglichen werden die linken Kanten, nicht Kante gegen Kante:
            # Die Umrisse der Anbieter überlappen gelegentlich, weil ein Wort
            # mitsamt dem folgenden Leerzeichen umschlossen wird.
            erlaubt = toleranz + ZEILEN_SCHRAEGE * (wort.x0 - letztes.x0)
            if wort.x0 <= letztes.x0 or abs(letztes.top - wort.top) > erlaubt:
                continue
            if beste is None or abs(zeile[-1].top - wort.top) < abs(beste[-1].top - wort.top):
                beste = zeile
        if beste is None:
            zeilen.append([wort])
        else:
            beste.append(wort)
    return sorted((Zeile(z) for z in zeilen), key=lambda z: (z.top, z.x0))


def _seite_aus(nummer: int, breite: float, hoehe: float, methode: str, woerter: list[Wort]) -> Seite:
    """Der gemeinsame letzte Schritt beider Anbieter: Zeilen bilden, Seite bauen."""
    return Seite(
        nummer=nummer,
        breite=breite,
        hoehe=hoehe,
        methode=methode,
        woerter=woerter,
        zeilen=_zeilen_entlang_der_nachbarn(woerter),
    )


# --- Azure Document Intelligence ------------------------------------------------


def _faktor(seite: dict[str, Any], breite_pt: float, hoehe_pt: float) -> tuple[float, float]:
    """Umrechnung der Anbieterkoordinaten in Punkte, getrennt je Achse."""
    einheit = seite.get("unit")
    if einheit == "inch":
        return PUNKTE_PRO_ZOLL, PUNKTE_PRO_ZOLL
    if einheit == "pixel":
        breite_px = float(seite.get("width") or 0)
        hoehe_px = float(seite.get("height") or 0)
        if breite_px <= 0 or hoehe_px <= 0:
            raise AnbieterAntwortUnbrauchbar("Seite in Pixeln ohne Breite oder Höhe")
        return breite_pt / breite_px, hoehe_pt / hoehe_px
    raise AnbieterAntwortUnbrauchbar(f"unbekannte Einheit {einheit!r}")


def _wort_aus(eintrag: dict[str, Any], fx: float, fy: float) -> Wort:
    polygon = eintrag.get("polygon") or []
    if len(polygon) < 8:
        raise AnbieterAntwortUnbrauchbar(f"Wort {eintrag.get('content')!r} ohne Polygon")
    xs = [float(v) * fx for v in polygon[0::2]]
    ys = [float(v) * fy for v in polygon[1::2]]
    konfidenz = float(eintrag.get("confidence", 0.0))
    return Wort(
        text=str(eintrag.get("content", "")).strip(),
        x0=round(min(xs), 2),
        top=round(min(ys), 2),
        x1=round(max(xs), 2),
        bottom=round(max(ys), 2),
        konfidenz=max(0.0, min(1.0, konfidenz)),
    )


def uebersetze_azure(antwort: dict[str, Any], daten: bytes, dateiname: str) -> Beleg:
    """Die Antwort von `prebuilt-read` in Seiten mit Wörtern und Zeilen."""
    ergebnis = antwort.get("analyzeResult", antwort)
    seiten_roh = ergebnis.get("pages")
    if not isinstance(seiten_roh, list):
        raise AnbieterAntwortUnbrauchbar("keine Seiten in der Antwort")
    groessen = _seitengroessen(daten, dateiname)

    seiten: list[Seite] = []
    for index, seite in enumerate(seiten_roh):
        nummer = int(seite.get("pageNumber", index + 1))
        breite_pt, hoehe_pt = _seitengroesse(groessen, nummer)
        fx, fy = _faktor(seite, breite_pt, hoehe_pt)
        # Azure nennt die Wörter in Lesereihenfolge; das Kleben braucht Nachbarn.
        roh = [_wort_aus(eintrag, fx, fy) for eintrag in seite.get("words") or []]
        woerter = _klebe_satzzeichen([w for w in roh if w.text])
        seiten.append(_seite_aus(nummer, breite_pt, hoehe_pt, METHODE_AZURE, woerter))
    return Beleg(dateiname=dateiname, hash_sha256=sha256(daten), seiten=seiten)


def _zugang() -> tuple[str, str] | None:
    endpunkt = os.environ.get(UMGEBUNG_ENDPUNKT, "").strip().rstrip("/")
    schluessel = os.environ.get(UMGEBUNG_SCHLUESSEL, "").strip()
    if endpunkt and schluessel:
        return endpunkt, schluessel
    return None


def _mit_geduld(anfrage: urllib.request.Request, ernte: Callable[[Any], Any]) -> Any:
    """Senden; bei 429 nach Retry-After (oder fester Wartezeit) erneut.

    Die kostenlosen Stufen beider Anbieter begrenzen die Aufrufe pro Minute.
    Ein Ratenlimit ist keine Aussage über den Beleg, also wird gewartet und
    nicht aufgegeben.
    """
    for versuch in range(1, RATENLIMIT_VERSUCHE + 1):
        try:
            with urllib.request.urlopen(anfrage, timeout=ANTWORT_MAX_S) as antwort:
                return ernte(antwort)
        except urllib.error.HTTPError as e:
            if e.code != 429 or versuch == RATENLIMIT_VERSUCHE:
                raise
            kopf = e.headers.get("Retry-After") if e.headers else None
            wartezeit = float(kopf) if kopf and kopf.isdigit() else RATENLIMIT_WARTEZEIT_S
            print(f"       Ratenlimit, warte {wartezeit:.0f} s (Versuch {versuch} von {RATENLIMIT_VERSUCHE})", flush=True)
            time.sleep(wartezeit)
    return None


def _sende_mit_geduld(anfrage: urllib.request.Request) -> str | None:
    """Azure: Analyse anstoßen, der Ort des Ergebnisses steht im Antwortkopf."""
    return _mit_geduld(anfrage, lambda antwort: antwort.headers.get("Operation-Location"))


def _hole_mit_geduld(anfrage: urllib.request.Request) -> dict[str, Any]:
    """Google: Die Antwort ist das Ergebnis, der Aufruf ist einstufig."""
    roh = _mit_geduld(anfrage, lambda antwort: antwort.read())
    return json.loads(roh.decode("utf-8"))


def rufe_azure(daten: bytes, endpunkt: str, schluessel: str) -> dict[str, Any]:
    """Ein Aufruf: Analyse anstoßen, Ergebnis abholen. Gibt die vollständige Antwort zurück."""
    url = f"{endpunkt}/documentintelligence/documentModels/{MODELL}:analyze?api-version={API_VERSION}"
    rumpf = json.dumps({"base64Source": base64.b64encode(daten).decode("ascii")}).encode("utf-8")
    anfrage = urllib.request.Request(
        url,
        data=rumpf,
        method="POST",
        headers={"Content-Type": "application/json", "Ocp-Apim-Subscription-Key": schluessel},
    )
    ort = _sende_mit_geduld(anfrage)
    if not ort:
        raise AnbieterAntwortUnbrauchbar("Azure nennt keinen Operation-Location")

    beginn = time.monotonic()
    while True:
        abfrage = urllib.request.Request(ort, headers={"Ocp-Apim-Subscription-Key": schluessel})
        with urllib.request.urlopen(abfrage, timeout=ANTWORT_MAX_S) as antwort:
            stand = json.loads(antwort.read().decode("utf-8"))
        status = stand.get("status")
        if status == "succeeded":
            return stand
        if status in ("failed", "canceled"):
            raise AnbieterAntwortUnbrauchbar(f"Azure meldet {status}: {stand.get('error')}")
        if time.monotonic() - beginn > ABFRAGE_MAX_S:
            raise AnbieterAntwortUnbrauchbar(f"Azure antwortet nach {ABFRAGE_MAX_S} s noch nicht")
        time.sleep(ABFRAGE_INTERVALL_S)


def lies_pdf_azure(daten: bytes, dateiname: str, fixtures: Path = FIXTURES, aufzeichnen: bool = False) -> Beleg:
    """Beleg über die Aufzeichnung lesen; ohne Aufzeichnung nur mit Schlüssel, und dann aufzeichnen.

    `aufzeichnen=False` (Vorgabe) ruft den Anbieter nie: Tests und Bewertung
    dürfen keinen Netzzugang brauchen und keine Kosten auslösen. Wer eine
    Aufzeichnung will, sagt es (Kommandozeile unten).
    """
    return _lies_aufgezeichnet(
        daten,
        dateiname,
        fixtures,
        aufzeichnen,
        zugang=_zugang,
        rufe=rufe_azure,
        uebersetze=uebersetze_azure,
        fehlt=UMGEBUNG_SCHLUESSEL,
    )


# --- Google Document AI ---------------------------------------------------------


def _google_text(anker: dict[str, Any], text: str) -> str:
    """Google nennt keinen Wortlaut, sondern Abschnitte im Gesamttext der Antwort."""
    stuecke = []
    for abschnitt in anker.get("textSegments") or []:
        von = int(abschnitt.get("startIndex", 0))
        bis = int(abschnitt.get("endIndex", 0))
        stuecke.append(text[von:bis])
    return "".join(stuecke)


def _google_marke(marke: dict[str, Any], text: str, breite_pt: float, hoehe_pt: float) -> tuple[Wort | None, bool]:
    """Eine Marke (`token`) als Wortteil, dazu die Aussage, ob nach ihr ein Wort endet.

    Google trennt feiner als ein Wort: `MAEU`, `-`, `HH`, `-`, `778812` sind
    fünf Marken. Wo ein Wort endet, sagt Google aber selbst, nämlich mit
    `detectedBreak`; fehlt das Feld, klebt die nächste Marke an dieser. Damit
    braucht dieser Anbieter keine Heuristik über Lücken, wie Azure sie nötig
    macht (`_klebe_satzzeichen`).
    """
    lage = marke.get("layout") or {}
    inhalt = _google_text(lage.get("textAnchor") or {}, text).strip()
    endet = bool(marke.get("detectedBreak"))
    if not inhalt:
        return None, endet
    umriss = lage.get("boundingPoly") or {}
    # Anteile der Seitenkante: unabhängig davon, mit welcher Auflösung Google
    # das PDF gerendert hat. Die Kante selbst kommt aus dem PDF.
    ecken = umriss.get("normalizedVertices") or []
    if not ecken:
        raise AnbieterAntwortUnbrauchbar(f"Wort {inhalt!r} ohne Umriss in Anteilen")
    xs = [float(e.get("x", 0.0)) * breite_pt for e in ecken]
    ys = [float(e.get("y", 0.0)) * hoehe_pt for e in ecken]
    konfidenz = float(lage.get("confidence", 0.0))
    teil = Wort(
        text=inhalt,
        x0=round(min(xs), 2),
        top=round(min(ys), 2),
        x1=round(max(xs), 2),
        bottom=round(max(ys), 2),
        konfidenz=max(0.0, min(1.0, konfidenz)),
    )
    return teil, endet


def _google_zusammen(teile: list[Wort]) -> Wort:
    """Mehrere Marken zu einem Wort: Text aneinander, Box umfassend, Konfidenz die kleinste."""
    return Wort(
        text="".join(t.text for t in teile),
        x0=min(t.x0 for t in teile),
        top=min(t.top for t in teile),
        x1=max(t.x1 for t in teile),
        bottom=max(t.bottom for t in teile),
        konfidenz=min(t.konfidenz for t in teile),
    )


def _google_woerter(marken: list[dict[str, Any]], text: str, breite_pt: float, hoehe_pt: float) -> list[Wort]:
    woerter: list[Wort] = []
    teile: list[Wort] = []
    for marke in marken:
        teil, endet = _google_marke(marke, text, breite_pt, hoehe_pt)
        if teil is not None:
            teile.append(teil)
        if endet and teile:
            woerter.append(_google_zusammen(teile))
            teile = []
    if teile:
        woerter.append(_google_zusammen(teile))
    return woerter


def uebersetze_google(antwort: dict[str, Any], daten: bytes, dateiname: str) -> Beleg:
    """Die Antwort von `Document OCR` in Seiten mit Wörtern und Zeilen."""
    dokument = antwort.get("document", antwort)
    text = dokument.get("text")
    if not isinstance(text, str):
        raise AnbieterAntwortUnbrauchbar("keine Textgrundlage in der Antwort")
    seiten_roh = dokument.get("pages")
    if not isinstance(seiten_roh, list):
        raise AnbieterAntwortUnbrauchbar("keine Seiten in der Antwort")
    groessen = _seitengroessen(daten, dateiname)

    seiten: list[Seite] = []
    for index, seite in enumerate(seiten_roh):
        nummer = int(seite.get("pageNumber", index + 1))
        breite_pt, hoehe_pt = _seitengroesse(groessen, nummer)
        woerter = _google_woerter(seite.get("tokens") or [], text, breite_pt, hoehe_pt)
        seiten.append(_seite_aus(nummer, breite_pt, hoehe_pt, METHODE_GOOGLE, woerter))
    return Beleg(dateiname=dateiname, hash_sha256=sha256(daten), seiten=seiten)


def _zugang_google() -> tuple[dict[str, Any], str, str, str] | None:
    """Dienstkonto, Projekt, Region, Prozessor. Die Schlüsseldatei bleibt außerhalb des Repos."""
    pfad = os.environ.get(UMGEBUNG_GOOGLE_KONTO, "").strip()
    projekt = os.environ.get(UMGEBUNG_GOOGLE_PROJEKT, "").strip()
    region = os.environ.get(UMGEBUNG_GOOGLE_REGION, "eu").strip()
    prozessor = os.environ.get(UMGEBUNG_GOOGLE_PROZESSOR, "").strip()
    if not (pfad and projekt and prozessor) or not Path(pfad).is_file():
        return None
    konto = json.loads(Path(pfad).read_text(encoding="utf-8"))
    if not konto.get("client_email") or not konto.get("private_key"):
        raise AnbieterAntwortUnbrauchbar(f"{pfad}: keine Schlüsseldatei eines Dienstkontos")
    return konto, projekt, region, prozessor


def _b64u(roh: bytes) -> str:
    """Base64 für JWT: URL-Alphabet, ohne Auffüllzeichen."""
    return base64.urlsafe_b64encode(roh).rstrip(b"=").decode("ascii")


def _google_zugriffstoken(konto: dict[str, Any]) -> str:
    """Ein selbst signiertes JWT gegen ein Zugriffstoken tauschen (OAuth 2.0, RFC 7523).

    Google bietet für Document AI keinen einfachen Schlüssel im Kopfzeilenfeld
    wie Azure. Der dokumentierte Weg für Dienstkonten steht hier ausgeschrieben
    statt in einer SDK-Kette: ein JWT mit dem privaten Schlüssel des
    Dienstkontos signieren, es bei `token_uri` gegen ein Token für eine Stunde
    tauschen. Signiert wird mit `cryptography`; das Paket liegt über
    pdfplumber ohnehin im Baum und ist deshalb ausdrücklich eingetragen.
    """
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    ziel = konto.get("token_uri") or "https://oauth2.googleapis.com/token"
    jetzt = int(time.time())
    kopf = {"alg": "RS256", "typ": "JWT"}
    nutzlast = {
        "iss": konto["client_email"],
        "scope": GOOGLE_BEREICH,
        "aud": ziel,
        "iat": jetzt,
        "exp": jetzt + GOOGLE_TOKEN_GUELTIG_S,
    }
    vorne = ".".join(_b64u(json.dumps(teil, separators=(",", ":")).encode("utf-8")) for teil in (kopf, nutzlast))
    schluessel = serialization.load_pem_private_key(konto["private_key"].encode("utf-8"), password=None)
    signatur = schluessel.sign(vorne.encode("ascii"), padding.PKCS1v15(), hashes.SHA256())
    behauptung = f"{vorne}.{_b64u(signatur)}"

    rumpf = urllib.parse.urlencode(
        {"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": behauptung}
    ).encode("ascii")
    anfrage = urllib.request.Request(
        ziel, data=rumpf, method="POST", headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    antwort = _hole_mit_geduld(anfrage)
    token = antwort.get("access_token")
    if not token:
        raise AnbieterAntwortUnbrauchbar(f"Google gibt kein Zugriffstoken: {antwort}")
    return str(token)


def _google_ohne_bild(antwort: dict[str, Any]) -> dict[str, Any]:
    """Das gerenderte Seitenbild aus der Antwort nehmen, bevor sie aufgezeichnet wird.

    Google legt jeder Seite das Bild bei, mit dem es gearbeitet hat: rund
    260 KB Base64, eine Kopie des Belegs, den das Repo schon hat. Die
    Übersetzung braucht es nicht, und dreizehn Kopien im Git wären nichts als
    Gewicht. Alles andere bleibt, wie es kam, auch was hier niemand liest
    (`blocks`, `paragraphs`, `lines`): Wer die Aufzeichnung öffnet, soll die
    Antwort sehen und nicht meine Auswahl daraus.
    """
    for seite in (antwort.get("document") or {}).get("pages") or []:
        seite.pop("image", None)
    return antwort


def rufe_google(daten: bytes, konto: dict[str, Any], projekt: str, region: str, prozessor: str) -> dict[str, Any]:
    """Ein Aufruf, einstufig: Das Dokument geht hin, die Antwort ist das Ergebnis."""
    token = _google_zugriffstoken(konto)
    url = (
        f"https://{region}-documentai.googleapis.com/{GOOGLE_API}"
        f"/projects/{projekt}/locations/{region}/processors/{prozessor}:process"
    )
    rumpf = json.dumps(
        {
            "skipHumanReview": True,
            "rawDocument": {"mimeType": "application/pdf", "content": base64.b64encode(daten).decode("ascii")},
        }
    ).encode("utf-8")
    anfrage = urllib.request.Request(
        url,
        data=rumpf,
        method="POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json; charset=utf-8"},
    )
    antwort = _hole_mit_geduld(anfrage)
    if "document" not in antwort:
        raise AnbieterAntwortUnbrauchbar(f"Google gibt kein Dokument zurück: {sorted(antwort)}")
    return _google_ohne_bild(antwort)


def lies_pdf_google(daten: bytes, dateiname: str, fixtures: Path = FIXTURES_GOOGLE, aufzeichnen: bool = False) -> Beleg:
    """Wie `lies_pdf_azure`, nur mit dem anderen Anbieter."""
    return _lies_aufgezeichnet(
        daten,
        dateiname,
        fixtures,
        aufzeichnen,
        zugang=_zugang_google,
        rufe=rufe_google,
        uebersetze=uebersetze_google,
        fehlt=UMGEBUNG_GOOGLE_KONTO,
    )


# --- Gemeinsam ------------------------------------------------------------------


def _lies_aufgezeichnet(
    daten: bytes,
    dateiname: str,
    fixtures: Path,
    aufzeichnen: bool,
    *,
    zugang: Callable[[], Any],
    rufe: Callable[..., dict[str, Any]],
    uebersetze: Callable[[dict[str, Any], bytes, str], Beleg],
    fehlt: str,
) -> Beleg:
    """Aufzeichnung lesen; nur auf Auftrag und mit Zugang den Anbieter rufen und aufzeichnen.

    `aufzeichnen=False` (Vorgabe) ruft den Anbieter nie: Tests und Bewertung
    dürfen keinen Netzzugang brauchen und keine Kosten auslösen.
    """
    pfad = fixture_pfad(daten, fixtures)
    if pfad.exists():
        return uebersetze(json.loads(pfad.read_text(encoding="utf-8")), daten, dateiname)
    offen = zugang() if aufzeichnen else None
    if not offen:
        raise AnbieterNichtVerfuegbar(
            f"{dateiname}: keine Aufzeichnung unter {_kurz(pfad)} "
            f"und {'kein Zugang in ' + fehlt if aufzeichnen else 'Aufzeichnen nicht angefordert'}"
        )
    antwort = rufe(daten, *offen)
    pfad.parent.mkdir(parents=True, exist_ok=True)
    pfad.write_text(json.dumps(antwort, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    return uebersetze(antwort, daten, dateiname)


@dataclass(frozen=True)
class Anschluss:
    """Ein angeschlossener Anbieter: wo seine Aufzeichnungen liegen, wie er liest, was ihm fehlt."""

    name: str
    fixtures: Path
    lies: Callable[..., Beleg]
    zugang: Callable[[], Any]
    fehlt: str


ANSCHLUESSE: dict[str, Anschluss] = {
    ANBIETER_AZURE: Anschluss(
        name=ANBIETER_AZURE,
        fixtures=FIXTURES,
        lies=lies_pdf_azure,
        zugang=_zugang,
        fehlt=f"{UMGEBUNG_ENDPUNKT} und {UMGEBUNG_SCHLUESSEL}",
    ),
    ANBIETER_GOOGLE: Anschluss(
        name=ANBIETER_GOOGLE,
        fixtures=FIXTURES_GOOGLE,
        lies=lies_pdf_google,
        zugang=_zugang_google,
        fehlt=f"{UMGEBUNG_GOOGLE_KONTO}, {UMGEBUNG_GOOGLE_PROJEKT} und {UMGEBUNG_GOOGLE_PROZESSOR}",
    ),
}

LESER = {name: anschluss.lies for name, anschluss in ANSCHLUESSE.items()}


def testbelege() -> list[Path]:
    return sorted(p for p in BELEGE.glob("*/*.pdf")) if BELEGE.exists() else []


def stand(anbieter: str = ANBIETER_AZURE) -> list[tuple[Path, bool]]:
    fixtures = ANSCHLUESSE[anbieter].fixtures
    return [(pdf, fixture_pfad(pdf.read_bytes(), fixtures).exists()) for pdf in testbelege()]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="zollpilot_extraktion.anbieter")
    parser.add_argument("befehl", choices=["aufzeichnen", "stand"])
    parser.add_argument("--anbieter", default=ANBIETER_AZURE, choices=sorted(ANSCHLUESSE))
    args = parser.parse_args(argv)
    anschluss = ANSCHLUESSE[args.anbieter]

    if args.befehl == "stand":
        eintraege = stand(args.anbieter)
        for pdf, da in eintraege:
            print(f"  {'ok ' if da else '-- '}  {pdf.relative_to(WURZEL)}")
        vorhanden = sum(1 for _, da in eintraege if da)
        print(f"{vorhanden} von {len(eintraege)} Testbelegen aufgezeichnet ({args.anbieter}).")
        return 0 if vorhanden == len(eintraege) else 1

    if not anschluss.zugang():
        print(f"KEIN ZUGANG: {anschluss.fehlt} setzen. Es wird nichts erfunden.")
        return 1
    fehler = 0
    for pdf in testbelege():
        daten = pdf.read_bytes()
        if fixture_pfad(daten, anschluss.fixtures).exists():
            print(f"  ok   {pdf.relative_to(WURZEL)} (schon aufgezeichnet)")
            continue
        try:
            beleg = anschluss.lies(daten, pdf.name, aufzeichnen=True)
            print(f"  neu  {pdf.relative_to(WURZEL)}: {sum(len(s.woerter) for s in beleg.seiten)} Wörter")
        except (urllib.error.URLError, AnbieterAntwortUnbrauchbar, AnbieterNichtVerfuegbar) as e:
            fehler += 1
            print(f"  ROT  {pdf.relative_to(WURZEL)}: {e}")
    return 1 if fehler else 0


if __name__ == "__main__":
    sys.exit(main())
