"""Zweites Lesemodul: die Antwort eines IDP-Anbieters in dieselbe Form wie `lesen.py`.

Der Vergleichslauf aus ADR-005: Wer Document AI, ABBYY oder Azure einsetzt,
ersetzt genau die Schicht Lesen. Dieses Modul zeigt das an einem Anbieter,
Azure Document Intelligence (Modell `prebuilt-read`). Gewählt, weil ein
Schlüssel im Kopfzeilenfeld genügt und keine OAuth-Bibliothek nötig ist; das
Kontingent F0 ist kostenlos. Ein zweiter Anbieter bekäme eine zweite
Übersetzungsfunktion, nichts sonst.

Drei Zusagen:

  1. Der Schlüssel kommt nur aus der Umgebung (`ZOLLPILOT_AZURE_DI_KEY`,
     dazu `ZOLLPILOT_AZURE_DI_ENDPOINT`). Nie aus einer Datei, nie aus dem Code.
  2. Antworten werden einmal aufgezeichnet und liegen als JSON unter
     `tests/fixtures/anbieter/azure/<sha256>.json`. Tests und Bewertung lesen
     die Aufzeichnung; sie brauchen keinen Zugang. Fehlt eine Aufzeichnung und
     fehlt der Schlüssel, sagt der Leser das, statt etwas zu erfinden.
  3. Nur synthetische Belege gehen an den Anbieter (docs/DATENSCHUTZ.md).
     Für echte Belege bräuchte ein Anbieteraufruf die Pseudonymisierung, die
     es nicht gibt; dieser Leser ist ein Vergleichswerkzeug, kein Betriebsweg.

Koordinaten: Azure liefert für PDF Zoll (`unit: inch`), für Bilder Pixel. Beide
werden in PDF-Punkte umgerechnet, damit Fundstellen mit `lesen.py`
vergleichbar bleiben. Die Konfidenz je Wort ist die des Anbieters, 0 bis 1.

Zwei Eigenheiten, die die Übersetzung ausgleicht, damit dieselben
Feldextraktoren laufen (am ersten Vergleichslauf gelernt, 2026-09-12):

  - Azures `lines` sind Zellen, nicht Zeilen: In einer Tabelle steht jede
    Spalte für sich. Die Zeilen entstehen deshalb aus den Wortkoordinaten,
    Nachbar an Nachbar, damit auch ein schiefer Scan eine Tabellenzeile als
    eine Zeile ergibt (`_zeilen_entlang_der_nachbarn`).
  - Azure trennt Satzzeichen ab (`No` `.:` statt `No.:`). Ein Wort, das nur
    aus Satzzeichen besteht und dicht rechts neben dem vorigen steht, wird
    wieder angehängt (`_klebe_satzzeichen`).

    python -m zollpilot_extraktion.anbieter aufzeichnen      # alle Testbelege
    python -m zollpilot_extraktion.anbieter stand            # was aufgezeichnet ist
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
import urllib.request
from pathlib import Path
from typing import Any

import pdfplumber

from .lesen import PUNKTE_PRO_ZOLL, Beleg, KeinLesbaresPdf, LesungNichtMoeglich, Seite, Wort, Zeile

METHODE_AZURE = "azure"
ANBIETER_AZURE = "azure"

UMGEBUNG_ENDPUNKT = "ZOLLPILOT_AZURE_DI_ENDPOINT"
UMGEBUNG_SCHLUESSEL = "ZOLLPILOT_AZURE_DI_KEY"

# Die REST-Schnittstelle, Stand der GA-Version. Modell `prebuilt-read`
# liefert Wörter mit Polygon und Konfidenz, mehr braucht die Schicht Lesen
# nicht; Layout- oder Rechnungsmodelle würden Feldwerte liefern und damit
# die Schicht `felder/` ersetzen, nicht diese.
API_VERSION = "2024-11-30"
MODELL = "prebuilt-read"
ABFRAGE_INTERVALL_S = 1.5
# Ratenlimit (HTTP 429): so oft warten und erneut senden; die Stufe F0 erlaubt
# 20 Aufrufe pro Minute, eine Aufzeichnung aller Testbelege reißt das sonst.
RATENLIMIT_VERSUCHE = 5
RATENLIMIT_WARTEZEIT_S = 15.0
ABFRAGE_MAX_S = 120

# Zeilenbildung, zwischen Nachbarn: Azures Polygone umschließen die Glyphen
# eng, deshalb liegt die Oberkante einer Ziffer bis zu drei Punkte unter der
# eines Großbuchstabens derselben Zeile. Die Toleranz ist darum weiter als beim
# Textlayer, aber deutlich unter einem Zeilenabstand (mindestens zwölf Punkte
# im Golden Set).
ZEILEN_TOLERANZ_PT = 4.5
# Ein Wort nur aus diesen Zeichen ist ein abgetrenntes Satzzeichen und gehört
# zum Wort links davon, wenn die Lücke kleiner ist als jeder Spaltenabstand
# (im Golden Set mindestens fünfzehn Punkte) und nicht viel größer als ein
# Leerzeichen (bei neun Punkt Schrift etwa zweieinhalb).
KLEBE_LUECKE_PT = 6.0
SATZZEICHEN = set(".:,;!?)]}%'\"")

WURZEL = Path(__file__).resolve().parents[2]
FIXTURES = WURZEL / "extraktion" / "tests" / "fixtures" / "anbieter" / ANBIETER_AZURE
BELEGE = WURZEL / "testdaten" / "belege"


class AnbieterNichtVerfuegbar(LesungNichtMoeglich):
    """Keine Aufzeichnung für diesen Beleg und kein Schlüssel in der Umgebung."""


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


def _klebe_satzzeichen(woerter: list[Wort], luecke: float = KLEBE_LUECKE_PT) -> list[Wort]:
    """Azure trennt Satzzeichen als eigene Wörter ab; Textlayer und Tesseract tun das nicht.

    Ein Wort nur aus Satzzeichen, das in derselben Zeile rechts neben dem
    vorigen Wort steht, gehört zu ihm. Ob dazwischen ein Leerzeichen war,
    lässt sich nicht ablesen: Der Gesamttext der Antwort enthält vor dem
    abgetrennten Zeichen selbst eines (`No .:`), und die Polygone umschließen
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
    schief, und Azure gibt die Wörter so zurück, wie sie im Bild liegen:
    Über eine Tabellenzeile hinweg wandert die Oberkante um mehr als die
    Toleranz. Tesseract löst das mit eigener Zeilenerkennung, Azure liefert
    nur Zellen. Deshalb hier: Von links nach rechts schließt ein Wort an die
    Zeile an, deren letztes Wort links von ihm steht und in der Oberkante
    höchstens um die Toleranz abweicht; die Abweichung zwischen Nachbarn
    bleibt bei einem schiefen Scan klein, auch wenn sie über die Zeile groß
    wird. Passt keine Zeile, beginnt eine neue.
    """
    zeilen: list[list[Wort]] = []
    for wort in sorted(woerter, key=lambda w: (w.x0, w.top)):
        beste: list[Wort] | None = None
        for zeile in zeilen:
            letztes = zeile[-1]
            if wort.x0 < letztes.x1 - 1.0 or abs(letztes.top - wort.top) > toleranz:
                continue
            if beste is None or abs(zeile[-1].top - wort.top) < abs(beste[-1].top - wort.top):
                beste = zeile
        if beste is None:
            zeilen.append([wort])
        else:
            beste.append(wort)
    return sorted((Zeile(z) for z in zeilen), key=lambda z: (z.top, z.x0))


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
        if nummer - 1 >= len(groessen):
            raise AnbieterAntwortUnbrauchbar(f"Antwort nennt Seite {nummer}, das PDF hat {len(groessen)}")
        breite_pt, hoehe_pt = groessen[nummer - 1]
        fx, fy = _faktor(seite, breite_pt, hoehe_pt)
        roh = [_wort_aus(eintrag, fx, fy) for eintrag in seite.get("words") or []]
        # Azure nennt die Wörter in Lesereihenfolge; das Kleben braucht Nachbarn.
        woerter = _klebe_satzzeichen([w for w in roh if w.text])
        seiten.append(
            Seite(
                nummer=nummer,
                breite=breite_pt,
                hoehe=hoehe_pt,
                methode=METHODE_AZURE,
                woerter=woerter,
                zeilen=_zeilen_entlang_der_nachbarn(woerter),
            )
        )
    return Beleg(dateiname=dateiname, hash_sha256=sha256(daten), seiten=seiten)


def _zugang() -> tuple[str, str] | None:
    endpunkt = os.environ.get(UMGEBUNG_ENDPUNKT, "").strip().rstrip("/")
    schluessel = os.environ.get(UMGEBUNG_SCHLUESSEL, "").strip()
    if endpunkt and schluessel:
        return endpunkt, schluessel
    return None


def _sende_mit_geduld(anfrage: urllib.request.Request) -> str | None:
    """Analyse anstoßen; bei 429 nach Retry-After (oder fester Wartezeit) erneut."""
    for versuch in range(1, RATENLIMIT_VERSUCHE + 1):
        try:
            with urllib.request.urlopen(anfrage, timeout=60) as antwort:
                return antwort.headers.get("Operation-Location")
        except urllib.error.HTTPError as e:
            if e.code != 429 or versuch == RATENLIMIT_VERSUCHE:
                raise
            kopf = e.headers.get("Retry-After") if e.headers else None
            wartezeit = float(kopf) if kopf and kopf.isdigit() else RATENLIMIT_WARTEZEIT_S
            print(f"       Ratenlimit, warte {wartezeit:.0f} s (Versuch {versuch} von {RATENLIMIT_VERSUCHE})", flush=True)
            time.sleep(wartezeit)
    return None


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
        with urllib.request.urlopen(abfrage, timeout=60) as antwort:
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
    pfad = fixture_pfad(daten, fixtures)
    if pfad.exists():
        antwort = json.loads(pfad.read_text(encoding="utf-8"))
        return uebersetze_azure(antwort, daten, dateiname)
    zugang = _zugang() if aufzeichnen else None
    if not zugang:
        raise AnbieterNichtVerfuegbar(
            f"{dateiname}: keine Aufzeichnung unter {_kurz(pfad)} "
            f"und {'kein Schlüssel in ' + UMGEBUNG_SCHLUESSEL if aufzeichnen else 'Aufzeichnen nicht angefordert'}"
        )
    antwort = rufe_azure(daten, *zugang)
    pfad.parent.mkdir(parents=True, exist_ok=True)
    pfad.write_text(json.dumps(antwort, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    return uebersetze_azure(antwort, daten, dateiname)


LESER = {ANBIETER_AZURE: lies_pdf_azure}


def testbelege() -> list[Path]:
    return sorted(p for p in BELEGE.glob("*/*.pdf")) if BELEGE.exists() else []


def stand(fixtures: Path = FIXTURES) -> list[tuple[Path, bool]]:
    return [(pdf, fixture_pfad(pdf.read_bytes(), fixtures).exists()) for pdf in testbelege()]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="zollpilot_extraktion.anbieter")
    parser.add_argument("befehl", choices=["aufzeichnen", "stand"])
    args = parser.parse_args(argv)

    if args.befehl == "stand":
        eintraege = stand()
        for pdf, da in eintraege:
            print(f"  {'ok ' if da else '-- '}  {pdf.relative_to(WURZEL)}")
        vorhanden = sum(1 for _, da in eintraege if da)
        print(f"{vorhanden} von {len(eintraege)} Testbelegen aufgezeichnet ({ANBIETER_AZURE}).")
        return 0 if vorhanden == len(eintraege) else 1

    if not _zugang():
        print(f"KEIN ZUGANG: {UMGEBUNG_ENDPUNKT} und {UMGEBUNG_SCHLUESSEL} setzen. Es wird nichts erfunden.")
        return 1
    fehler = 0
    for pdf in testbelege():
        daten = pdf.read_bytes()
        if fixture_pfad(daten).exists():
            print(f"  ok   {pdf.relative_to(WURZEL)} (schon aufgezeichnet)")
            continue
        try:
            beleg = lies_pdf_azure(daten, pdf.name, aufzeichnen=True)
            print(f"  neu  {pdf.relative_to(WURZEL)}: {sum(len(s.woerter) for s in beleg.seiten)} Wörter")
        except (urllib.error.URLError, AnbieterAntwortUnbrauchbar, AnbieterNichtVerfuegbar) as e:
            fehler += 1
            print(f"  ROT  {pdf.relative_to(WURZEL)}: {e}")
    return 1 if fehler else 0


if __name__ == "__main__":
    sys.exit(main())
