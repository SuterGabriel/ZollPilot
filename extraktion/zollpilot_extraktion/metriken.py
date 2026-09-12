"""Metriken des Extraktionsdienstes, im Prometheus-Format unter GET /metrics.

Was hier gezählt wird, beantwortet Fragen, die n8n nicht beantworten kann:
Wie oft musste Tesseract ran statt des Textlayers? Wie sicher liest der
Dienst? Wie lange dauert eine Akte? Die Entscheidung je Akte zählt der
SQL-Exporter aus der Prüftabelle (deploy/sql-exporter/); hier steht nur, was
die Extraktion selbst weiß.

Kein Belegtext, kein Aktenwert: Labels sind Belegtyp und Lesemethode, mehr
nicht (docs/DATENSCHUTZ.md).
"""

from __future__ import annotations

from typing import Any

from prometheus_client import Counter, Gauge, Histogram

PRAEFIX = "zollpilot_extraktion"

ANFRAGEN = Counter(
    f"{PRAEFIX}_anfragen_total",
    "Anfragen an den Extraktionsdienst, nach Ergebnis.",
    ["ergebnis"],  # ok | abgelehnt | fehler
)

DAUER = Histogram(
    f"{PRAEFIX}_dauer_sekunden",
    "Dauer einer Anfrage (alle Dateien einer Akte), in Sekunden.",
    buckets=(0.5, 1, 2, 5, 10, 20, 30, 60, 120),
)

DOKUMENTE = Counter(
    f"{PRAEFIX}_dokumente_total",
    "Verarbeitete Belege nach Typ und Lesemethode. unclassified ist kein Fehler, sondern ein gemeldeter Beleg.",
    ["typ", "methode"],  # methode: textlayer | ocr | keine
)

KONFIDENZ = Histogram(
    f"{PRAEFIX}_assertion_konfidenz",
    "Konfidenz je Assertion, nach Lesemethode. Die Schwelle des Regelwerks liegt in rules.yaml.",
    ["methode"],
    buckets=(0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99, 1.0),
)

OCR_VERFUEGBAR = Gauge(
    f"{PRAEFIX}_ocr_verfuegbar",
    "1, wenn Tesseract im Container erreichbar ist, sonst 0.",
)

METHODE_KEINE = "keine"
METHODE_ABGELEITET = "abgeleitet"


def setze_ocr(verfuegbar: bool) -> None:
    OCR_VERFUEGBAR.set(1 if verfuegbar else 0)


def _methode_je_dokument(akte: dict[str, Any]) -> dict[str, str]:
    """Die Lesemethode eines Belegs ist die seiner Assertions; abgeleitete
    Werte (Summen, Ursprung aus Positionen) zählen nicht als Lesung."""
    methoden: dict[str, str] = {}
    for a in akte.get("assertions", []):
        methode = a.get("methode")
        if not methode or methode == METHODE_ABGELEITET:
            continue
        methoden.setdefault(a.get("dokument", ""), methode)
    return methoden


def zaehle_akte(akte: dict[str, Any], dauer_sekunden: float) -> None:
    ANFRAGEN.labels(ergebnis="ok").inc()
    DAUER.observe(dauer_sekunden)
    methoden = _methode_je_dokument(akte)
    for d in akte.get("dokumente", []):
        DOKUMENTE.labels(typ=d.get("typ", "unbekannt"), methode=methoden.get(d.get("id", ""), METHODE_KEINE)).inc()
    for a in akte.get("assertions", []):
        methode = a.get("methode")
        konfidenz = a.get("konfidenz")
        if not methode or methode == METHODE_ABGELEITET or konfidenz is None:
            continue
        KONFIDENZ.labels(methode=methode).observe(float(konfidenz))


def zaehle_abgelehnt() -> None:
    ANFRAGEN.labels(ergebnis="abgelehnt").inc()


def zaehle_fehler() -> None:
    ANFRAGEN.labels(ergebnis="fehler").inc()
