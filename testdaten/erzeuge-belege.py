#!/usr/bin/env python
"""Erzeugt die synthetischen Belege (PDF) aus den Testakten.

Quelle der Wahrheit bleibt testdaten/akten/*.json (erzeugt von
erzeuge-akten.mjs). Dieses Skript entfaltet die Assertions jeder Akte zu den
Belegen, die sie behaupten, und rendert daraus je Akte drei PDFs:

    handelsrechnung.pdf    mit Ursprungserklärung, wenn die Akte eine hat
    packliste.pdf          digital — oder als verschlechterter Scan
    bill-of-lading.pdf     als Entwurf, wenn die Akte das sagt

Dazu je Ordner `akte.json` (Stammdaten und erwartete Entscheidung — die
Extraktion bekommt keine Belegaussagen mit) und `erwartet.json` (welche
Assertions die PDFs tragen, für die Bewertung). Alle Firmen, Nummern und
Werte sind erfunden (docs/DATENSCHUTZ.md).

Der Lauf ist reproduzierbar: reportlab mit `invariant`, Rauschen mit festem
Startwert, Schrift aus Pillow statt aus dem System. Die CI erzeugt die
Belege neu und verlangt, dass sich nichts ändert.

    uv run --project extraktion python testdaten/erzeuge-belege.py
"""

from __future__ import annotations

import io
import json
import random
import sys
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader, simpleSplit
from reportlab.pdfgen import canvas

WURZEL = Path(__file__).resolve().parents[1]
AKTEN = WURZEL / "testdaten" / "akten"
BELEGE = WURZEL / "testdaten" / "belege"

BREITE, HOEHE = A4
RAND = 40
SCHRIFT = "Helvetica"
FETT = "Helvetica-Bold"

# Der schlechte Scan. In der JSON-Akte steht ein per OCR falsch gelesener
# Container mit Konfidenz 0,55 — eine Behauptung über die Extraktion. Hier
# liest eine echte OCR einen echten schlechten Scan; die Packliste trägt
# deshalb die richtige Nummer, und was Tesseract daraus macht, misst die
# Bewertung. Die Erwartung dazu steht in SONDERFAELLE.
SCAN_AKTE = "schlechter-scan"
SCAN_DPI = 200
SCAN_DREHUNG_GRAD = 1.4
# Körnung wie ein Fax oder ein Foto vom Papier: sichtbar, aber kein Teppich.
# Beim ersten Versuch (34 %) las Tesseract das Rauschen als 2 700 Wörter mit
# Konfidenz 0 — ein Scan, den auch ein Mensch nicht liest, prüft nichts.
SCAN_RAUSCHEN_ANTEIL = 0.14
SCAN_UNSCHAERFE = 1.0
SCAN_KONTRAST = 0.8
SCAN_STARTWERT = 20260912
SCAN_SCHRIFTGROESSE = 34

# Abweichungen der PDF-Akten von den JSON-Akten, mit Grund.
SONDERFAELLE: dict[str, dict[str, Any]] = {
    SCAN_AKTE: {
        "ueberschreibe": {("PL-1", "packliste.container_id"): "MSKU1234565"},
        "erwartung": {
            "freigabe": "freigabereif",
            "regeln": [],
            "hinweis": "Tesseract liest den verschlechterten Scan; Konfidenzen stehen in den Assertions. "
            "Ob eine Regel den Konfidenzpfad nimmt, hängt davon ab, was falsch gelesen wird — "
            "der Lauf der Bewertung sagt es (docs/EXTRAKTION.md).",
        },
    }
}

LAENDERNAMEN = {"DE": "Germany", "SG": "Singapore", "CN": "China"}
URSPRUNGSADJEKTIV = {"DE": "German", "SG": "Singaporean", "CN": "Chinese"}
ADRESSEN = {
    "Nordlicht Maschinenbau GmbH": ["Hafenstraße 12", "20457 Hamburg"],
    "Aurora Trading Pte. Ltd.": ["8 Marina View", "Singapore 018960"],
}


def betrag(wert: float | int) -> str:
    """Deutsche Schreibweise mit Tausenderpunkt: 17400 → 17.400,00."""
    ganz, rest = divmod(round(float(wert) * 100), 100)
    return f"{ganz:,}".replace(",", ".") + f",{rest:02d}"


def hs_mit_punkt(code: str) -> str:
    return f"{code[:4]}.{code[4:]}" if len(code) > 4 else code


def setze(ziel: Any, pfad: str, wert: Any) -> None:
    teile = pfad.split(".")
    aktuell = ziel
    for i, teil in enumerate(teile[:-1]):
        naechster_index = teile[i + 1].isdigit()
        if isinstance(aktuell, list):
            index = int(teil)
            while len(aktuell) <= index:
                aktuell.append(None)
            if aktuell[index] is None:
                aktuell[index] = [] if naechster_index else {}
            aktuell = aktuell[index]
        else:
            if teil not in aktuell:
                aktuell[teil] = [] if naechster_index else {}
            aktuell = aktuell[teil]
    letzter = teile[-1]
    if isinstance(aktuell, list):
        index = int(letzter)
        while len(aktuell) <= index:
            aktuell.append(None)
        aktuell[index] = wert
    else:
        aktuell[letzter] = wert


def entfalte(akte: dict[str, Any], ueberschreibe: dict[tuple[str, str], Any]) -> dict[str, dict[str, Any]]:
    """Assertions je Dokument zu verschachtelten Belegen; Wurzelpräfix (rechnung, packliste, …) wird abgestreift."""
    belege: dict[str, dict[str, Any]] = {}
    for a in akte["assertions"]:
        wert = ueberschreibe.get((a["dokument"], a["pfad"]), a["wert"])
        bereich, rest = a["pfad"].split(".", 1)
        setze(belege.setdefault(a["dokument"], {}), rest, wert)
    return belege


class Blatt:
    """Ein A4-Blatt mit Cursor von oben; Koordinaten wie auf Papier."""

    def __init__(self, pfad: Path) -> None:
        self.c = canvas.Canvas(str(pfad), pagesize=A4, invariant=1, pageCompression=0)
        self.y = HOEHE - RAND - 10

    def text(self, x: float, s: str, groesse: float = 10, fett: bool = False, y: float | None = None) -> None:
        self.c.setFont(FETT if fett else SCHRIFT, groesse)
        self.c.drawString(x, self.y if y is None else y, s)

    def rechts(self, x_rechts: float, s: str, groesse: float = 10, fett: bool = False, y: float | None = None) -> None:
        self.c.setFont(FETT if fett else SCHRIFT, groesse)
        self.c.drawRightString(x_rechts, self.y if y is None else y, s)

    def zeile(self, hoehe: float = 14) -> None:
        self.y -= hoehe

    def titel(self, s: str) -> None:
        self.text(RAND, s, 16, fett=True)
        self.zeile(28)

    def linie(self) -> None:
        self.c.setLineWidth(0.5)
        self.c.line(RAND, self.y + 4, BREITE - RAND, self.y + 4)

    def tabelle(self, spalten: list[tuple[str, float, str]], zeilen: list[list[str]]) -> None:
        """spalten: (Titel, x, 'l'|'r'); bei 'r' ist x die rechte Kante."""
        for titel, x, lage in spalten:
            (self.rechts if lage == "r" else self.text)(x, titel, 9, fett=True)
        self.zeile(4)
        self.linie()
        self.zeile(12)
        for werte in zeilen:
            for (_, x, lage), wert in zip(spalten, werte):
                (self.rechts if lage == "r" else self.text)(x, wert, 9)
            self.zeile(15)

    def absatz(self, x: float, s: str, breite: float, groesse: float = 9) -> None:
        for teil in simpleSplit(s, SCHRIFT, groesse, breite):
            self.text(x, teil, groesse)
            self.zeile(12)

    def speichere(self) -> None:
        self.c.showPage()
        self.c.save()


def partei(blatt: Blatt, x: float, label: str, name: str, land: str, eori: str | None, y: float) -> float:
    blatt.text(x, label, 10, fett=True, y=y)
    y -= 14
    zeilen = [name, *ADRESSEN.get(name, ["Industrieweg 1", "00000 Musterstadt"]), LAENDERNAMEN.get(land, land)]
    if eori:
        zeilen.append(f"EORI: {eori}")
    for z in zeilen:
        blatt.text(x, z, 10, y=y)
        y -= 13
    return y


def rechnung_pdf(pfad: Path, akte: dict[str, Any], r: dict[str, Any], nachweis: dict[str, Any] | None) -> None:
    b = Blatt(pfad)
    b.titel("COMMERCIAL INVOICE")
    y_links = partei(b, RAND, "Seller", r["verkaeufer"]["name"], r["verkaeufer"]["land"], r["verkaeufer"].get("eori"), b.y)
    y_rechts = partei(b, 320, "Buyer", r["kaeufer"]["name"], r["kaeufer"]["land"], None, b.y)
    b.y = min(y_links, y_rechts) - 10

    inco = akte["sachverhalt"]["incoterm"]
    b.text(RAND, f"Invoice No.: {r['nummer']}")
    b.text(320, f"Invoice date: {r['datum']}")
    b.zeile()
    b.text(RAND, f"Currency: {r['waehrung']}")
    b.text(320, f"Incoterms: {inco['code']} {inco['named_place']} (Incoterms {inco['edition']})")
    b.zeile(26)

    spalten = [("Pos", RAND, "l"), ("Description", 70, "l"), ("HS code", 250, "l"), ("Origin", 310, "l"),
               ("Qty", 375, "r"), ("Unit", 385, "l"), ("Unit price", 480, "r"), ("Amount", BREITE - RAND, "r")]
    zeilen = []
    for p in r["positionen"]:
        kostenlos = p.get("einzelpreis") == 0
        zeilen.append([
            str(p["nr"]), p["beschreibung"], hs_mit_punkt(p["hs6"]), p["ursprung"], str(p["menge"]), p["einheit"],
            betrag(p["einzelpreis"]), "no charge" if kostenlos else betrag(p["netto"]),
        ])
    b.tabelle(spalten, zeilen)
    b.zeile(6)
    for label, wert in [("Subtotal", sum(p["netto"] for p in r["positionen"])), ("Surcharges", r["zuschlaege"]), ("Discount", r["rabatte"]), ("Total amount", r["gesamt"])]:
        b.text(380, f"{label}:", 10, fett=label == "Total amount")
        b.rechts(BREITE - RAND, f"{r['waehrung']} {betrag(wert)}", 10, fett=label == "Total amount")
        b.zeile()

    if nachweis:
        b.zeile(16)
        b.text(RAND, "Declaration of origin", 10, fett=True)
        b.zeile(14)
        b.absatz(
            RAND,
            f"The exporter of the products covered by this document (customs authorization No {nachweis['rex_nummer']}) "
            f"declares that, except where otherwise clearly indicated, these products are of "
            f"{URSPRUNGSADJEKTIV.get(nachweis['ursprung'], nachweis['ursprung'])} preferential origin.",
            BREITE - 2 * RAND,
        )
        b.zeile(6)
        b.text(RAND, f"Hamburg, {r['datum']}    {r['verkaeufer']['name']}    (signature)", 9)
        b.zeile()

    b.zeile(20)
    b.text(RAND, "Payment terms: 30 days net. Bank details on request. All company names in this document are fictitious.", 8)
    b.speichere()


def packliste_pdf(pfad: Path, r: dict[str, Any], p: dict[str, Any], aussteller: str) -> None:
    b = Blatt(pfad)
    b.titel("PACKING LIST")
    b.text(RAND, f"Packing list no.: {p['nummer']}")
    b.text(320, f"Invoice ref.: {r['nummer']}")
    b.zeile()
    b.text(RAND, f"Issued by: {aussteller}")
    b.zeile()
    b.text(RAND, f"Container no.: {p['container_id']}")
    b.zeile(26)

    packstueck_je_position = {1: "PAL-1", 2: "KAR-1", 3: "KAR-1"}
    b.tabelle(
        [("Pos", RAND, "l"), ("HS code", 100, "l"), ("Quantity", 240, "r"), ("Unit", 260, "l"), ("Packed in", 340, "l")],
        [[str(q["nr"]), hs_mit_punkt(q["hs6"]), str(q["menge"]), "PCE", packstueck_je_position.get(q["nr"], "KAR-1")] for q in p["positionen"]],
    )
    b.zeile(10)
    b.text(RAND, "Packages", 10, fett=True)
    b.zeile(16)
    b.tabelle(
        [("Package ID", RAND, "l"), ("Type", 140, "l"), ("Gross weight kg", 330, "r"), ("Net weight kg", 450, "r")],
        [[s["id"], s["art"], betrag(s["brutto_kg"]), betrag(s["netto_kg"])] for s in p["packstuecke"]],
    )
    b.zeile(6)
    b.text(RAND, f"Total gross weight: {betrag(p['brutto_gesamt_kg'])} kg", 10, fett=True)
    b.speichere()


def bl_pdf(pfad: Path, r: dict[str, Any], bl: dict[str, Any], aussteller: str, draft: bool) -> None:
    b = Blatt(pfad)
    if draft:
        # Wasserzeichen aufrecht, damit es im Textlayer ein Wort bleibt.
        b.c.saveState()
        b.c.setFillGray(0.88)
        b.c.setFont(FETT, 72)
        b.c.drawCentredString(BREITE / 2, HOEHE / 2, "DRAFT")
        b.c.restoreState()
    b.titel("BILL OF LADING" + (" – DRAFT" if draft else ""))
    if draft:
        b.text(RAND, "Status: DRAFT – for verification only, not negotiable, not an original.", 10, fett=True)
        b.zeile(18)
    for links, rechts in [
        (f"B/L No.: {bl['nummer']}", f"Carrier: {aussteller}"),
        (f"Shipper: {r['verkaeufer']['name']}, Hamburg, Germany", ""),
        (f"Consignee: {r['kaeufer']['name']}, Singapore", ""),
        ("Notify party: same as consignee", ""),
        ("Vessel / Voyage: NORDLICHT EXPRESS (fictitious) / 2637W", ""),
        (f"Port of loading: Hamburg ({bl['pol']})", f"Port of discharge: Singapore ({bl['pod']})"),
        (f"Container No.: {bl['container_id']}", f"Seal No.: {bl['seal']}"),
        ("Packages: 2 (1 pallet, 1 carton), said to contain", ""),
        ("Description of goods: Hydraulic pumps and seal kits", ""),
        (f"Gross weight: {betrag(bl['brutto_kg'])} kg", "Freight: prepaid"),
        (f"Shipped on board: {bl['on_board']}", "Number of originals: 3"),
    ]:
        b.text(RAND, links)
        if rechts:
            b.text(320, rechts)
        b.zeile(16)
    b.zeile(10)
    b.text(RAND, "Received in apparent good order and condition. Shipper's load, stow and count.", 8)
    b.speichere()


def scan_packliste_pdf(pfad: Path, r: dict[str, Any], p: dict[str, Any], aussteller: str) -> None:
    """Die Packliste als schlechter Scan: mit Pillow gezeichnet, gedreht, verrauscht, unscharf — nur ein Bild im PDF."""
    breite_px = int(BREITE / 72 * SCAN_DPI)
    hoehe_px = int(HOEHE / 72 * SCAN_DPI)
    bild = Image.new("L", (breite_px, hoehe_px), 255)
    zeichne = ImageDraw.Draw(bild)
    schrift = ImageFont.load_default(size=SCAN_SCHRIFTGROESSE)
    gross = ImageFont.load_default(size=SCAN_SCHRIFTGROESSE + 14)
    x0, y, schritt = 120, 140, 54

    def zeile(teile: list[tuple[int, str]], font=schrift) -> None:
        nonlocal y
        for x, s in teile:
            zeichne.text((x, y), s, fill=0, font=font)
        y += schritt

    zeile([(x0, "PACKING LIST")], gross)
    y += 20
    zeile([(x0, f"Packing list no.: {p['nummer']}")])
    zeile([(x0, f"Invoice ref.: {r['nummer']}")])
    zeile([(x0, f"Issued by: {aussteller}")])
    zeile([(x0, f"Container no.: {p['container_id']}")])
    y += 30
    zeile([(x0, "Pos"), (300, "HS code"), (620, "Quantity"), (900, "Unit"), (1100, "Packed in")])
    packstueck_je_position = {1: "PAL-1", 2: "KAR-1", 3: "KAR-1"}
    for q in p["positionen"]:
        zeile([(x0, str(q["nr"])), (300, hs_mit_punkt(q["hs6"])), (620, str(q["menge"])), (900, "PCE"), (1100, packstueck_je_position.get(q["nr"], "KAR-1"))])
    y += 30
    zeile([(x0, "Packages")])
    zeile([(x0, "Package ID"), (500, "Type"), (850, "Gross weight kg"), (1250, "Net weight kg")])
    for s in p["packstuecke"]:
        zeile([(x0, s["id"]), (500, s["art"]), (850, betrag(s["brutto_kg"])), (1250, betrag(s["netto_kg"]))])
    y += 30
    zeile([(x0, f"Total gross weight: {betrag(p['brutto_gesamt_kg'])} kg")])

    # Verschlechtern, reproduzierbar.
    bild = bild.rotate(SCAN_DREHUNG_GRAD, resample=Image.Resampling.BICUBIC, fillcolor=255)
    bild = bild.filter(ImageFilter.GaussianBlur(SCAN_UNSCHAERFE))
    zufall = random.Random(SCAN_STARTWERT)
    kachel = Image.frombytes("L", (256, 256), bytes(zufall.randrange(256) for _ in range(256 * 256)))
    rauschen = Image.new("L", bild.size)
    for yy in range(0, bild.height, 256):
        for xx in range(0, bild.width, 256):
            rauschen.paste(kachel, (xx, yy))
    bild = Image.blend(bild, rauschen, SCAN_RAUSCHEN_ANTEIL)
    bild = ImageEnhance.Contrast(bild).enhance(SCAN_KONTRAST)

    puffer = io.BytesIO()
    bild.save(puffer, format="PNG", compress_level=6)
    puffer.seek(0)
    c = canvas.Canvas(str(pfad), pagesize=A4, invariant=1, pageCompression=0)
    c.drawImage(ImageReader(puffer), 0, 0, width=BREITE, height=HOEHE)
    c.showPage()
    c.save()


def erzeuge(akte_datei: Path) -> None:
    akte = json.loads(akte_datei.read_text(encoding="utf-8"))
    name = akte_datei.stem
    sonder = SONDERFAELLE.get(name, {})
    belege = entfalte(akte, sonder.get("ueberschreibe", {}))
    dokumente = {d["id"]: d for d in akte["dokumente"]}
    ordner = BELEGE / name
    ordner.mkdir(parents=True, exist_ok=True)
    for alt in ordner.glob("*.pdf"):
        alt.unlink()

    r = belege["INV-1"]
    nachweis = belege.get("UE-1")
    rechnung_pdf(ordner / "handelsrechnung.pdf", akte, r, nachweis)
    aussteller = r["verkaeufer"]["name"]
    if name == SCAN_AKTE:
        scan_packliste_pdf(ordner / "packliste.pdf", r, belege["PL-1"], aussteller)
    else:
        packliste_pdf(ordner / "packliste.pdf", r, belege["PL-1"], aussteller)
    bl_pdf(ordner / "bill-of-lading.pdf", r, belege["BL-1"], dokumente["BL-1"]["aussteller"], dokumente["BL-1"]["status"] == "draft")

    erwartung = dict(akte["erwartung"])
    if "erwartung" in sonder:
        erwartung = sonder["erwartung"]
    stammdaten = {
        "akte_id": akte["akte_id"],
        "beschreibung": akte["beschreibung"],
        "stichtag": akte["stichtag"],
        "sachverhalt": akte["sachverhalt"],
        "anmeldung": akte["anmeldung"],
        "erwartung": erwartung,
        "quelle": f"testdaten/akten/{akte_datei.name}",
        "synthetisch": True,
    }
    (ordner / "akte.json").write_text(json.dumps(stammdaten, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    erwartet = []
    for a in akte["assertions"]:
        wert = sonder.get("ueberschreibe", {}).get((a["dokument"], a["pfad"]), a["wert"])
        erwartet.append({"dokument": a["dokument"], "typ": dokumente[a["dokument"]]["typ"], "pfad": a["pfad"], "wert": wert})
    (ordner / "erwartet.json").write_text(json.dumps(erwartet, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"  {name:<28} {len(list(ordner.glob('*.pdf')))} PDFs, {len(erwartet)} erwartete Assertions")


def main() -> int:
    BELEGE.mkdir(parents=True, exist_ok=True)
    for datei in sorted(AKTEN.glob("*.json")):
        erzeuge(datei)
    return 0


if __name__ == "__main__":
    sys.exit(main())
