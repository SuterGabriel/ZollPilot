"""Die strukturierte Rechnung: UN/CEFACT Cross Industry Invoice (CII, D16B) lesen und schreiben.

Eine Rechnung, die als Datensatz kommt, ist ein Beleg wie jeder andere
(ADR-008). Sie bekommt dieselben Pfade wie die gelesene Rechnung
(`rechnung.nummer`, `rechnung.positionen.N.hs6`, `rechnung.gesamt`), aber
keine Leseunsicherheit: Methode `strukturiert`, Konfidenz 1, keine Seite,
keine Bounding Box. Was das Regelwerk daraus macht, ändert sich nicht.

Zwei Richtungen:

  lies_cii       XML → Felder. Erst gegen das Schema validiert (`schema/cii/`,
                 Quelle in QUELLE.md); was das Schema nicht besteht, wird nicht
                 gelesen, sondern als `unclassified` mit Hinweis an die Akte
                 gehängt (nichts stillschweigend verwerfen).
  schreibe_cii   Rechnungsfakten der Akte → XML. Für Systeme, die die Rechnung
                 als Datensatz erwarten. Jede geschriebene Rechnung validiert
                 gegen dasselbe Schema.

Abgebildet ist der Kern: Kopf, Verkäufer und Käufer mit Land und EORI,
Positionen mit Warennummer, Ursprung, Menge, Preis und Betrag, Zuschläge,
Rabatte, Endbetrag. Was nicht in der Akte steht (Steuer, Zahlung, Lieferung),
wird nicht erfunden; die Ursprungserklärung auf der Rechnung hat in CII
keinen eigenen Platz und bleibt beim PDF.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from lxml import etree

from .assertion import Assertion
from .normalisierung import als_betrag, als_datum, als_land, als_text, als_warencode

METHODE_STRUKTURIERT = "strukturiert"
KONFIDENZ_STRUKTURIERT = 1.0

NS = {
    "rsm": "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100",
    "ram": "urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100",
    "udt": "urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100",
    "qdt": "urn:un:unece:uncefact:data:standard:QualifiedDataType:100",
}
SCHEMA = Path(__file__).resolve().parent / "schema" / "cii" / "CrossIndustryInvoice_100pD16B.xsd"

# UN/CEFACT 1001: 380 Handelsrechnung, 325 Proformarechnung. Andere Codes
# werden als Rechnung gelesen und im Hinweis genannt, nicht verworfen.
TYPCODE = {"380": "handelsrechnung", "325": "proformarechnung"}
TYPCODE_UMGEKEHRT = {v: k for k, v in TYPCODE.items()}
DATUMSFORMAT_JJJJMMTT = "102"
SCHEMA_ID_EORI = "EORI"
LISTE_HS = "HS"
# UN/ECE Empfehlung 20: C62 ist das Stück. Die Akte nennt es PCE, wie die
# Belege; hin und zurück verlustfrei.
EINHEIT_CODE = {"PCE": "C62"}
EINHEIT_TEXT = {v: k for k, v in EINHEIT_CODE.items()}

_schema: etree.XMLSchema | None = None


def schema() -> etree.XMLSchema:
    global _schema
    if _schema is None:
        _schema = etree.XMLSchema(etree.parse(str(SCHEMA)))
    return _schema


def ist_cii(daten: bytes) -> bool:
    """Grober Blick: XML, und der Wurzelname ist CrossIndustryInvoice."""
    kopf = daten.lstrip(b"\xef\xbb\xbf \t\r\n")[:512]
    return kopf.startswith(b"<") and b"CrossIndustryInvoice" in daten[:4096]


class CiiUngueltig(ValueError):
    """Das XML besteht das Schema nicht oder ist kein XML."""


@dataclass
class CiiRechnung:
    typ: str
    hash_sha256: str
    felder: list[tuple[str, Any, str]]
    hinweis: str | None = None


def _q(praefix: str, name: str) -> str:
    return f"{{{NS[praefix]}}}{name}"


def _text(knoten, pfad: str) -> str | None:
    gefunden = knoten.find(pfad, NS)
    return gefunden.text if gefunden is not None and gefunden.text is not None else None


def pruefe_cii(daten: bytes) -> list[str]:
    """Schemafehler als Text; leer, wenn das XML gültig ist."""
    try:
        baum = etree.fromstring(daten)
    except etree.XMLSyntaxError as e:
        return [f"kein XML: {e}"]
    s = schema()
    if s.validate(baum):
        return []
    return [f"Zeile {f.line}: {f.message}" for f in s.error_log]


def lies_cii(daten: bytes, dateiname: str) -> CiiRechnung:
    fehler = pruefe_cii(daten)
    if fehler:
        raise CiiUngueltig(f"{dateiname}: {fehler[0]}" + (f" (und {len(fehler) - 1} weitere)" if len(fehler) > 1 else ""))
    wurzel = etree.fromstring(daten)
    felder: list[tuple[str, Any, str]] = []

    def setze(pfad: str, roh: str | None, wandle) -> None:
        if roh is None:
            return
        wert = wandle(roh)
        if wert is not None:
            felder.append((pfad, wert, roh))

    dokument = wurzel.find("rsm:ExchangedDocument", NS)
    typcode = _text(dokument, "ram:TypeCode") if dokument is not None else None
    typ = TYPCODE.get(typcode or "", "handelsrechnung")
    hinweis = None if typcode in TYPCODE else f"TypeCode {typcode!r} unbekannt, als Handelsrechnung gelesen"
    if dokument is not None:
        setze("rechnung.nummer", _text(dokument, "ram:ID"), als_text)
        setze("rechnung.datum", _text(dokument, "ram:IssueDateTime/udt:DateTimeString"), _datum_aus_102)

    transaktion = wurzel.find("rsm:SupplyChainTradeTransaction", NS)
    if transaktion is None:
        return CiiRechnung(typ, hashlib.sha256(daten).hexdigest(), felder, hinweis)

    vereinbarung = transaktion.find("ram:ApplicableHeaderTradeAgreement", NS)
    if vereinbarung is not None:
        for praefix, name in (("rechnung.verkaeufer", "ram:SellerTradeParty"), ("rechnung.kaeufer", "ram:BuyerTradeParty")):
            partei = vereinbarung.find(name, NS)
            if partei is None:
                continue
            setze(f"{praefix}.name", _text(partei, "ram:Name"), als_text)
            setze(f"{praefix}.land", _text(partei, "ram:PostalTradeAddress/ram:CountryID"), als_land)
            for kennung in partei.findall("ram:ID", NS):
                if kennung.get("schemeID") == SCHEMA_ID_EORI:
                    setze(f"{praefix}.eori", kennung.text, lambda t: als_text(t).upper() if als_text(t) else None)

    for index, position in enumerate(transaktion.findall("ram:IncludedSupplyChainTradeLineItem", NS)):
        basis = f"rechnung.positionen.{index}"
        setze(f"{basis}.nr", _text(position, "ram:AssociatedDocumentLineDocument/ram:LineID"), _ganzzahl)
        produkt = position.find("ram:SpecifiedTradeProduct", NS)
        if produkt is not None:
            setze(f"{basis}.beschreibung", _text(produkt, "ram:Name"), als_text)
            for klasse in produkt.findall("ram:DesignatedProductClassification/ram:ClassCode", NS):
                if klasse.get("listID") == LISTE_HS:
                    setze(f"{basis}.hs6", klasse.text, als_warencode)
            setze(f"{basis}.ursprung", _text(produkt, "ram:OriginTradeCountry/ram:ID"), als_land)
        setze(f"{basis}.einzelpreis", _text(position, "ram:SpecifiedLineTradeAgreement/ram:NetPriceProductTradePrice/ram:ChargeAmount"), als_betrag)
        menge = position.find("ram:SpecifiedLineTradeDelivery/ram:BilledQuantity", NS)
        if menge is not None:
            setze(f"{basis}.menge", menge.text, als_betrag)
            einheit = menge.get("unitCode")
            if einheit:
                felder.append((f"{basis}.einheit", EINHEIT_TEXT.get(einheit, einheit), einheit))
        setze(f"{basis}.netto", _text(position, "ram:SpecifiedLineTradeSettlement/ram:SpecifiedTradeSettlementLineMonetarySummation/ram:LineTotalAmount"), als_betrag)

    abrechnung = transaktion.find("ram:ApplicableHeaderTradeSettlement", NS)
    if abrechnung is not None:
        setze("rechnung.waehrung", _text(abrechnung, "ram:InvoiceCurrencyCode"), als_text)
        summen = abrechnung.find("ram:SpecifiedTradeSettlementHeaderMonetarySummation", NS)
        if summen is not None:
            setze("rechnung.zuschlaege", _text(summen, "ram:ChargeTotalAmount"), als_betrag)
            setze("rechnung.rabatte", _text(summen, "ram:AllowanceTotalAmount"), als_betrag)
            setze("rechnung.gesamt", _text(summen, "ram:GrandTotalAmount"), als_betrag)

    return CiiRechnung(typ, hashlib.sha256(daten).hexdigest(), felder, hinweis)


def assertions_aus(rechnung: CiiRechnung, dokument_id: str) -> list[Assertion]:
    return [
        Assertion(
            dokument=dokument_id,
            pfad=pfad,
            wert=wert,
            roh=roh,
            konfidenz=KONFIDENZ_STRUKTURIERT,
            seite=None,
            bbox=None,
            methode=METHODE_STRUKTURIERT,
        )
        for pfad, wert, roh in rechnung.felder
    ]


def _ganzzahl(text: str) -> int | None:
    wert = als_betrag(text)
    return int(wert) if isinstance(wert, (int, float)) and float(wert).is_integer() else None


def _datum_aus_102(text: str) -> str | None:
    t = text.strip()
    if len(t) == 8 and t.isdigit():
        return f"{t[:4]}-{t[4:6]}-{t[6:]}"
    return als_datum(t)


def _betrag(wert: Any) -> str:
    return f"{float(wert):.2f}"


def _menge(wert: Any) -> str:
    zahl = float(wert)
    return str(int(zahl)) if zahl.is_integer() else f"{zahl}"


def schreibe_cii(rechnung: dict[str, Any], typ: str = "handelsrechnung", incoterm: dict[str, Any] | None = None) -> bytes:
    """Die Rechnungsfakten der Akte als Cross Industry Invoice. Validiert vor der Rückgabe."""
    E = etree.Element
    S = etree.SubElement

    wurzel = E(_q("rsm", "CrossIndustryInvoice"), nsmap={k: v for k, v in NS.items()})
    kontext = S(wurzel, _q("rsm", "ExchangedDocumentContext"))
    richtlinie = S(kontext, _q("ram", "GuidelineSpecifiedDocumentContextParameter"))
    S(richtlinie, _q("ram", "ID")).text = "urn:zollpilot:cii:kern"

    dokument = S(wurzel, _q("rsm", "ExchangedDocument"))
    S(dokument, _q("ram", "ID")).text = str(rechnung["nummer"])
    S(dokument, _q("ram", "TypeCode")).text = TYPCODE_UMGEKEHRT.get(typ, "380")
    datum = S(S(dokument, _q("ram", "IssueDateTime")), _q("udt", "DateTimeString"))
    datum.set("format", DATUMSFORMAT_JJJJMMTT)
    datum.text = str(rechnung["datum"]).replace("-", "")

    transaktion = S(wurzel, _q("rsm", "SupplyChainTradeTransaction"))
    for p in rechnung.get("positionen") or []:
        position = S(transaktion, _q("ram", "IncludedSupplyChainTradeLineItem"))
        S(S(position, _q("ram", "AssociatedDocumentLineDocument")), _q("ram", "LineID")).text = str(p["nr"])
        produkt = S(position, _q("ram", "SpecifiedTradeProduct"))
        if p.get("beschreibung"):
            S(produkt, _q("ram", "Name")).text = str(p["beschreibung"])
        if p.get("hs6"):
            klasse = S(S(produkt, _q("ram", "DesignatedProductClassification")), _q("ram", "ClassCode"))
            klasse.set("listID", LISTE_HS)
            klasse.text = str(p["hs6"])
        if p.get("ursprung"):
            S(S(produkt, _q("ram", "OriginTradeCountry")), _q("ram", "ID")).text = str(p["ursprung"])
        vereinbarung = S(position, _q("ram", "SpecifiedLineTradeAgreement"))
        if p.get("einzelpreis") is not None:
            S(S(vereinbarung, _q("ram", "NetPriceProductTradePrice")), _q("ram", "ChargeAmount")).text = _betrag(p["einzelpreis"])
        lieferung = S(position, _q("ram", "SpecifiedLineTradeDelivery"))
        if p.get("menge") is not None:
            menge = S(lieferung, _q("ram", "BilledQuantity"))
            menge.text = _menge(p["menge"])
            if p.get("einheit"):
                menge.set("unitCode", EINHEIT_CODE.get(str(p["einheit"]), str(p["einheit"])))
        abrechnung_zeile = S(position, _q("ram", "SpecifiedLineTradeSettlement"))
        if p.get("netto") is not None:
            S(S(abrechnung_zeile, _q("ram", "SpecifiedTradeSettlementLineMonetarySummation")), _q("ram", "LineTotalAmount")).text = _betrag(p["netto"])

    vereinbarung = S(transaktion, _q("ram", "ApplicableHeaderTradeAgreement"))
    for name, partei in (("SellerTradeParty", rechnung.get("verkaeufer") or {}), ("BuyerTradeParty", rechnung.get("kaeufer") or {})):
        knoten = S(vereinbarung, _q("ram", name))
        if partei.get("eori"):
            kennung = S(knoten, _q("ram", "ID"))
            kennung.set("schemeID", SCHEMA_ID_EORI)
            kennung.text = str(partei["eori"])
        if partei.get("name"):
            S(knoten, _q("ram", "Name")).text = str(partei["name"])
        if partei.get("land"):
            S(S(knoten, _q("ram", "PostalTradeAddress")), _q("ram", "CountryID")).text = str(partei["land"])
    if incoterm and incoterm.get("code"):
        bedingungen = S(vereinbarung, _q("ram", "ApplicableTradeDeliveryTerms"))
        S(bedingungen, _q("ram", "DeliveryTypeCode")).text = str(incoterm["code"])
        if incoterm.get("named_place"):
            S(S(bedingungen, _q("ram", "RelevantTradeLocation")), _q("ram", "Name")).text = str(incoterm["named_place"])

    S(transaktion, _q("ram", "ApplicableHeaderTradeDelivery"))

    abrechnung = S(transaktion, _q("ram", "ApplicableHeaderTradeSettlement"))
    if rechnung.get("waehrung"):
        S(abrechnung, _q("ram", "InvoiceCurrencyCode")).text = str(rechnung["waehrung"])
    zuschlaege = float(rechnung.get("zuschlaege") or 0)
    rabatte = float(rechnung.get("rabatte") or 0)
    for betrag, ist_zuschlag in ((zuschlaege, True), (rabatte, False)):
        if betrag <= 0:
            continue
        posten = S(abrechnung, _q("ram", "SpecifiedTradeAllowanceCharge"))
        S(S(posten, _q("ram", "ChargeIndicator")), _q("udt", "Indicator")).text = "true" if ist_zuschlag else "false"
        S(posten, _q("ram", "ActualAmount")).text = _betrag(betrag)
    summen = S(abrechnung, _q("ram", "SpecifiedTradeSettlementHeaderMonetarySummation"))
    zeilen = sum(float(p.get("netto") or 0) for p in rechnung.get("positionen") or [])
    S(summen, _q("ram", "LineTotalAmount")).text = _betrag(zeilen)
    S(summen, _q("ram", "ChargeTotalAmount")).text = _betrag(zuschlaege)
    S(summen, _q("ram", "AllowanceTotalAmount")).text = _betrag(rabatte)
    S(summen, _q("ram", "TaxBasisTotalAmount")).text = _betrag(zeilen + zuschlaege - rabatte)
    gesamt = rechnung.get("gesamt")
    S(summen, _q("ram", "GrandTotalAmount")).text = _betrag(gesamt if gesamt is not None else zeilen + zuschlaege - rabatte)
    S(summen, _q("ram", "DuePayableAmount")).text = _betrag(gesamt if gesamt is not None else zeilen + zuschlaege - rabatte)

    daten = etree.tostring(wurzel, xml_declaration=True, encoding="UTF-8", pretty_print=True)
    fehler = pruefe_cii(daten)
    if fehler:
        raise CiiUngueltig("geschriebene Rechnung besteht das Schema nicht: " + "; ".join(fehler[:3]))
    return daten
