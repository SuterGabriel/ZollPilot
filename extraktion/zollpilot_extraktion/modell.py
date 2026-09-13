"""Schicht 2b: ein Modell schlägt einen Belegtyp vor, wenn die Regeln schweigen.

Der Vorschlag ist eine Behauptung, kein Fakt (ADR-011). Der Belegtyp der Akte
bleibt `unclassified`; der Vorschlag hängt daneben, mit Modellname, Konfidenz
und Begründung, und ein Mensch entscheidet. Damit bleibt die vierte Regel
unangetastet: Kein Modell in der Entscheidungsschicht.

Vor dem Aufruf geht der Text durch `pseudonymisierung.py`. Was hinausgeht,
ist die Gestalt eines Belegs ohne seine Beteiligten.

Wie bei den IDP-Anbietern (`anbieter.py`) liegt jede Antwort als Aufzeichnung
im Repo. Tests und Bewertung lesen nur diese Aufzeichnungen: kein Netz, keine
Kosten, dasselbe Ergebnis auf jeder Maschine. Gerufen wird das Modell nur auf
ausdrücklichen Auftrag und mit Schlüssel in der Umgebung.
"""

from __future__ import annotations

import hashlib
import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

WURZEL = Path(__file__).resolve().parents[2]
FIXTURES = WURZEL / "extraktion" / "tests" / "fixtures" / "modell"

UMGEBUNG_SCHLUESSEL = "ZOLLPILOT_ANTHROPIC_KEY"
UMGEBUNG_MODELL = "ZOLLPILOT_MODELL"

DIENST = "https://api.anthropic.com/v1/messages"
API_FASSUNG = "2023-06-01"
MODELL_VORGABE = "claude-haiku-4-5-20251001"
ANTWORT_MAX_TOKEN = 300
ZEITLIMIT_S = 60

# Wieviel Text das Modell sieht. Der Belegtyp steht im Kopf des Dokuments;
# mehr Text kostet nur und bringt für diese Frage nichts.
TEXT_MAX_ZEICHEN = 3000

TYP_UNCLASSIFIED = "unclassified"

# Die Auswahl ist geschlossen: Der Vorschlag muss einer der Typen sein, die
# das Projekt kennt (`pflichtmatrix.yaml`, `docs/01-dokumententypologie.md`),
# oder das Eingeständnis `unclassified`. Ein freier Text wäre ein Belegtyp,
# den niemand einordnen kann.
TYPEN: tuple[str, ...] = (
    "handelsrechnung",
    "proformarechnung",
    "packliste",
    "bill_of_lading",
    "sea_waybill",
    "cmr",
    "eur1",
    "eur_med",
    "atr",
    "origin_declaration",
    "abd",
    "aes_nachricht",
    "anmeldung",
    "kaufvertrag",
)


def auftrag(typen: tuple[str, ...] = TYPEN) -> str:
    """Was das Modell tun soll. Eine Frage nach der Gestalt, keine nach dem Inhalt."""
    return (
        "Du ordnest Außenhandelsbelege einem Typ zu. Der Text kommt aus einer "
        "Texterkennung und kann Lesefehler enthalten; Parteien sind durch "
        "Platzhalter wie [PARTEI-1] ersetzt.\n\n"
        "Antworte ausschließlich mit einem JSON-Objekt, ohne Text davor oder "
        'danach, in der Form {"typ": "...", "konfidenz": 0.0, "begruendung": "..."}.\n\n'
        f"Erlaubte Werte für typ: {', '.join(typen)}, {TYP_UNCLASSIFIED}.\n"
        "Wähle unclassified, wenn kein Typ passt oder der Text zu dünn ist. "
        "konfidenz ist eine Zahl zwischen 0 und 1. Die Begründung nennt in "
        "einem Satz die Merkmale im Text, die den Ausschlag geben, und erfindet "
        "nichts, was nicht dasteht."
    )


class ModellNichtVerfuegbar(RuntimeError):
    """Keine Aufzeichnung für diesen Text und kein Zugang in der Umgebung."""


class ModellAntwortUnbrauchbar(ValueError):
    """Die Antwort ist kein JSON in der vereinbarten Form."""


@dataclass(frozen=True)
class Vorschlag:
    """Was das Modell behauptet. Nie ein Fakt, immer mit Herkunft."""

    typ: str
    konfidenz: float
    begruendung: str
    modell: str
    methode: str = "modell"

    def als_dict(self) -> dict[str, Any]:
        return {
            "typ": self.typ,
            "konfidenz": self.konfidenz,
            "begruendung": self.begruendung,
            "modell": self.modell,
            "methode": self.methode,
        }


def modellname() -> str:
    return os.environ.get(UMGEBUNG_MODELL, "").strip() or MODELL_VORGABE


def schluessel() -> str | None:
    return os.environ.get(UMGEBUNG_SCHLUESSEL, "").strip() or None


def anfrage(text: str, modell: str | None = None) -> dict[str, Any]:
    """Der Rumpf des Aufrufs. Rein, damit die Aufzeichnung ihn adressieren kann."""
    return {
        "model": modell or modellname(),
        "max_tokens": ANTWORT_MAX_TOKEN,
        "temperature": 0,
        "system": auftrag(),
        "messages": [{"role": "user", "content": text[:TEXT_MAX_ZEICHEN]}],
    }


def fixture_pfad(rumpf: dict[str, Any], ordner: Path = FIXTURES) -> Path:
    """Die Aufzeichnung heißt nach dem Aufruf, nicht nach dem Beleg.

    Damit ändert ein anderer Auftrag, ein anderes Modell oder ein anderer
    Text die Adresse, und niemand liest versehentlich die Antwort auf eine
    Frage, die so nicht mehr gestellt wird.
    """
    fest = json.dumps(rumpf, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return ordner / f"{hashlib.sha256(fest.encode('utf-8')).hexdigest()}.json"


def _rufe(rumpf: dict[str, Any], zugang: str) -> dict[str, Any]:
    anfrage_http = urllib.request.Request(
        DIENST,
        data=json.dumps(rumpf, ensure_ascii=False).encode("utf-8"),
        headers={
            "content-type": "application/json",
            "x-api-key": zugang,
            "anthropic-version": API_FASSUNG,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(anfrage_http, timeout=ZEITLIMIT_S) as antwort:
            return json.loads(antwort.read().decode("utf-8"))
    except urllib.error.HTTPError as e:  # pragma: no cover - braucht Netz
        raise ModellNichtVerfuegbar(f"HTTP {e.code} von {DIENST}: {e.reason}") from e


def lies_vorschlag(antwort: dict[str, Any], modell: str) -> Vorschlag:
    """Aus der Antwort des Dienstes ein geprüfter Vorschlag, oder ein Fehler."""
    blocke = antwort.get("content") or []
    roh = "".join(b.get("text", "") for b in blocke if isinstance(b, dict))
    anfang, ende = roh.find("{"), roh.rfind("}")
    if anfang < 0 or ende <= anfang:
        raise ModellAntwortUnbrauchbar(f"kein JSON in der Antwort: {roh[:120]!r}")
    try:
        geladen = json.loads(roh[anfang : ende + 1])
    except json.JSONDecodeError as e:
        raise ModellAntwortUnbrauchbar(f"Antwort ist kein gültiges JSON: {e}") from e

    typ = str(geladen.get("typ", "")).strip()
    if typ not in TYPEN and typ != TYP_UNCLASSIFIED:
        raise ModellAntwortUnbrauchbar(f"Typ {typ!r} steht nicht zur Auswahl")
    try:
        konfidenz = float(geladen.get("konfidenz", 0.0))
    except (TypeError, ValueError) as e:
        raise ModellAntwortUnbrauchbar(f"Konfidenz ist keine Zahl: {geladen.get('konfidenz')!r}") from e
    konfidenz = min(max(konfidenz, 0.0), 1.0)
    begruendung = str(geladen.get("begruendung", "")).strip()
    return Vorschlag(typ, round(konfidenz, 3), begruendung, antwort.get("model") or modell)


def schlage_typ_vor(
    text: str,
    *,
    aufzeichnen: bool = False,
    fixtures: Path | None = None,
    modell: str | None = None,
) -> Vorschlag:
    """Pseudonymisieren, Aufzeichnung lesen, nur auf Auftrag den Dienst rufen.

    `aufzeichnen=False` (Vorgabe) ruft nie: Tests und Bewertung dürfen keinen
    Netzzugang brauchen und keine Kosten auslösen.
    """
    from .pseudonymisierung import pseudonymisiere

    ohne_parteien = pseudonymisiere(text).text
    rumpf = anfrage(ohne_parteien, modell)
    pfad = fixture_pfad(rumpf, fixtures or FIXTURES)
    if pfad.exists():
        return lies_vorschlag(json.loads(pfad.read_text(encoding="utf-8")), rumpf["model"])

    zugang = schluessel() if aufzeichnen else None
    if not zugang:
        raise ModellNichtVerfuegbar(
            f"keine Aufzeichnung unter {pfad.name} und "
            f"{'kein ' + UMGEBUNG_SCHLUESSEL + ' in der Umgebung' if aufzeichnen else 'Aufzeichnen nicht angefordert'}"
        )
    antwort = _rufe(rumpf, zugang)
    pfad.parent.mkdir(parents=True, exist_ok=True)
    pfad.write_text(json.dumps(antwort, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    return lies_vorschlag(antwort, rumpf["model"])


def _kommandozeile(argumente: list[str]) -> int:
    """Eine Antwort aufzeichnen, damit sie danach ohne Schlüssel gilt.

    Aufruf mit dem Pfad einer Textdatei, zum Beispiel dem Frachtbrief aus
    `extraktion/tests/fixtures/cmr-frachtbrief.txt`. Ohne
    `ZOLLPILOT_ANTHROPIC_KEY` in der Umgebung passiert nichts.
    """
    if not argumente:
        print("Aufruf: python -m zollpilot_extraktion.modell <textdatei>")
        return 2
    text = Path(argumente[0]).read_text(encoding="utf-8")
    try:
        vorschlag = schlage_typ_vor(text, aufzeichnen=True)
    except (ModellNichtVerfuegbar, ModellAntwortUnbrauchbar) as e:
        print(f"kein Vorschlag: {e}")
        return 1
    print(f"Vorschlag: {vorschlag.typ} (Konfidenz {vorschlag.konfidenz}, {vorschlag.modell})")
    print(f"Begründung: {vorschlag.begruendung}")
    return 0


if __name__ == "__main__":  # pragma: no cover - Einstieg von Hand
    import sys

    raise SystemExit(_kommandozeile(sys.argv[1:]))
