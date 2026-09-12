"""Normalisierung der Belegwerte, bevor sie Assertion werden.

Gegenstück zu src/normalisierung.mjs: Beträge in beiden Schreibweisen,
Daten in ISO 8601, Länder als ISO 3166-1 alpha-2, Warencodes ohne Punkte.
Die Regeln vergleichen ausschließlich normalisierte Werte (CLAUDE.md, harte
Grenze 2); was hier nicht normalisiert werden kann, bleibt None — und die
Regel sagt `nicht_pruefbar`, nie `verletzt`.
"""

from __future__ import annotations

import re

# Ländernamen und Adjektive, wie sie auf Belegen stehen. Bewusst klein:
# Was nicht hier steht, liefert None und damit einen offenen Befund statt
# einer falschen Zuordnung. Erweiterung ist Stammdatenpflege, kein Code.
LAENDER = {
    "germany": "DE", "deutschland": "DE", "german": "DE", "deutsch": "DE", "federal republic of germany": "DE",
    "singapore": "SG", "singapur": "SG", "singaporean": "SG", "republic of singapore": "SG",
    "china": "CN", "chinese": "CN", "people's republic of china": "CN", "prc": "CN",
    "united states": "US", "united states of america": "US", "usa": "US", "american": "US",
    "united kingdom": "GB", "great britain": "GB", "uk": "GB", "british": "GB",
    "france": "FR", "french": "FR", "netherlands": "NL", "the netherlands": "NL", "dutch": "NL",
    "switzerland": "CH", "schweiz": "CH", "swiss": "CH", "austria": "AT", "österreich": "AT", "austrian": "AT",
    "italy": "IT", "italian": "IT", "spain": "ES", "spanish": "ES", "poland": "PL", "polish": "PL",
    "turkey": "TR", "türkiye": "TR", "turkish": "TR", "japan": "JP", "japanese": "JP",
    "korea": "KR", "south korea": "KR", "republic of korea": "KR", "korean": "KR",
    "india": "IN", "indian": "IN", "vietnam": "VN", "viet nam": "VN", "vietnamese": "VN",
}

MONATE = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6, "july": 7,
    "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
    "januar": 1, "februar": 2, "märz": 3, "mai": 5, "juni": 6, "juli": 7, "oktober": 10, "dezember": 12,
}

ISO_LAND = re.compile(r"^[A-Z]{2}$")
LAND_IN_KLAMMERN = re.compile(r"\(([A-Z]{2})\)")
UNLOCODE = re.compile(r"\b([A-Z]{2}[A-Z2-9]{3})\b")
ISO_DATUM = re.compile(r"(\d{4})-(\d{2})-(\d{2})")
DE_DATUM = re.compile(r"(\d{1,2})\.(\d{1,2})\.(\d{4})")
SCHRAEG_DATUM = re.compile(r"(\d{1,2})/(\d{1,2})/(\d{4})")
WORT_DATUM = re.compile(r"(\d{1,2})\.?\s+([A-Za-zäÄ]+)\s+(\d{4})")


def als_text(text: str | None) -> str | None:
    if text is None:
        return None
    t = " ".join(text.split()).strip(" :")
    return t or None


ZAHL_TOKEN = re.compile(r"\d[\d.,]*")
# Was um eine Zahl herum stehen darf: Währung, Einheit, Prozent, Leerraum.
# "12 PCE PAL-1" ist kein Betrag — zwei Zahlen und ein Bindestrich.
BEIWERK = re.compile(r"^[A-Za-zÄÖÜäöüß€$£%\s]*$")


def als_betrag(text: str | None) -> float | int | None:
    """"1.250,00", "1,250.00", "1250", "EUR 18.420,00", "1.046,00 kg" werden zur Zahl. Ganze Zahlen ohne Nachkommateil.

    Genau eine Zahl, sonst nur Währung oder Einheit drumherum — alles andere
    ist kein Betrag und liefert None, damit die Regel `nicht_pruefbar` sagt.
    """
    if text is None:
        return None
    if isinstance(text, (int, float)):
        return text
    roh = str(text).strip()
    negativ = roh.startswith("-")
    if negativ:
        roh = roh[1:]
    tokens = ZAHL_TOKEN.findall(roh)
    if len(tokens) != 1 or not BEIWERK.match(ZAHL_TOKEN.sub("", roh, count=1)):
        return None
    t = tokens[0]
    letztes_komma = t.rfind(",")
    letzter_punkt = t.rfind(".")
    if letztes_komma > letzter_punkt:
        t = t.replace(".", "").replace(",", ".")
    else:
        t = t.replace(",", "")
    try:
        zahl = float(t)
    except ValueError:
        return None
    if negativ:
        zahl = -zahl
    return int(zahl) if zahl.is_integer() else zahl


def als_ganzzahl(text: str | None) -> int | None:
    zahl = als_betrag(text)
    if zahl is None:
        return None
    return int(zahl) if float(zahl).is_integer() else None


def als_datum(text: str | None) -> str | None:
    """Datum in ISO 8601. Bei Schrägstrich-Daten gilt Tag/Monat/Jahr (europäisch)."""
    if not text:
        return None
    t = text.strip()
    if m := ISO_DATUM.search(t):
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    if m := DE_DATUM.search(t):
        return f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"
    if m := SCHRAEG_DATUM.search(t):
        return f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"
    if m := WORT_DATUM.search(t):
        monat = MONATE.get(m.group(2).lower())
        if monat:
            return f"{m.group(3)}-{monat:02d}-{int(m.group(1)):02d}"
    return None


def als_land(text: str | None) -> str | None:
    """ISO 3166-1 alpha-2 aus Code, Klammerzusatz, Namen oder Adjektiv. "EU" ist kein Land (docs/01)."""
    if not text:
        return None
    t = text.strip()
    if ISO_LAND.match(t):
        return t
    if m := LAND_IN_KLAMMERN.search(t):
        return m.group(1)
    schluessel = re.sub(r"[^a-z' ]", " ", t.lower())
    schluessel = " ".join(schluessel.split())
    if schluessel in LAENDER:
        return LAENDER[schluessel]
    # Letztes Wort, für Adressen wie "20457 Hamburg, Germany".
    teile = schluessel.split()
    for laenge in (3, 2, 1):
        if len(teile) >= laenge:
            kandidat = " ".join(teile[-laenge:])
            if kandidat in LAENDER:
                return LAENDER[kandidat]
    return None


def als_unlocode(text: str | None) -> str | None:
    """UN/LOCODE aus "Hamburg (DEHAM)" oder "DEHAM". Nur Format, keine Vergabe (docs/04)."""
    if not text:
        return None
    treffer = UNLOCODE.findall(text.upper())
    return treffer[-1] if treffer else None


def als_warencode(text: str | None) -> str | None:
    """HS/KN/TARIC ohne Punkte und Leerzeichen; nur Ziffern, sonst None."""
    if not text:
        return None
    code = re.sub(r"[\s.]", "", str(text))
    return code if code.isdigit() else None


# MRN: 18 Zeichen, Jahr, Land, Kennung (docs/04). Nur die Struktur; die
# Prüfziffer an Stelle 18 bleibt bewusst ungeprüft, weil das Verfahren in
# den Quellen widersprüchlich beschrieben ist (docs/08). Was nicht passt,
# liefert None, damit die Pflichtmatrix den Nachweis als fehlend meldet.
MRN = re.compile(r"[0-9]{2}[A-Z]{2}[A-Z0-9]{14}")


def als_mrn(text: str | None) -> str | None:
    if not text:
        return None
    t = re.sub(r"[\s\-]", "", str(text)).upper()
    m = MRN.search(t)
    return m.group(0) if m else None


def als_containernummer(text: str | None) -> str | None:
    """Leerzeichen und Bindestriche entfernen, Großschreibung. Prüfziffer prüft src/validatoren/container.mjs."""
    if not text:
        return None
    t = re.sub(r"[\s\-]", "", str(text)).upper()
    m = re.search(r"[A-Z]{3}[UJZ][0-9]{7}", t)
    return m.group(0) if m else t or None
