"""Klassifikation: Typ, Draft, Unbekanntes."""

from zollpilot_extraktion.klassifikation import STATUS_DRAFT, STATUS_FINAL, TYP_UNCLASSIFIED, klassifiziere


def test_rechnung():
    k = klassifiziere("COMMERCIAL INVOICE\nInvoice No.: INV-1\nSeller ...")
    assert k.typ == "handelsrechnung"
    assert k.status == STATUS_FINAL
    assert k.konfidenz > 0.9


def test_proforma_schlaegt_rechnung():
    k = klassifiziere("PRO FORMA INVOICE\nInvoice No.: PF-1\nvalue for customs purposes only")
    assert k.typ == "proformarechnung"


def test_packliste_und_bl():
    assert klassifiziere("PACKING LIST\nPackage ID Type Gross weight kg").typ == "packliste"
    assert klassifiziere("BILL OF LADING\nPort of loading: Hamburg\nShipped on board").typ == "bill_of_lading"


def test_draft_setzt_status():
    k = klassifiziere("BILL OF LADING – DRAFT\nStatus: DRAFT – for verification only")
    assert k.typ == "bill_of_lading"
    assert k.status == STATUS_DRAFT


def test_non_negotiable_allein_ist_kein_draft():
    # Ein Sea Waybill trägt "non-negotiable" legitim.
    k = klassifiziere("SEA WAYBILL\nnon-negotiable\nPort of loading: Hamburg")
    assert k.typ == "sea_waybill"
    assert k.status == STATUS_FINAL


def test_abd_deutsch_und_englisch():
    assert klassifiziere("AUSFUHRBEGLEITDOKUMENT\nMRN: 26DE5100001234567A\nAusfuhrzollstelle: DE002210").typ == "abd"
    assert klassifiziere("EXPORT ACCOMPANYING DOCUMENT\nMRN 26DE5100001234567A").typ == "abd"


def test_mrn_allein_macht_kein_abd():
    # Eine Statusnachricht oder ein Anschreiben nennt die MRN auch.
    k = klassifiziere("Sehr geehrte Damen und Herren, die Sendung mit MRN 26DE5100001234567A ist ausgegangen.")
    assert k.typ == TYP_UNCLASSIFIED


def test_unbekannt_bleibt_unbekannt():
    k = klassifiziere("Lieferschein\nWir bestätigen den Eingang Ihrer Bestellung.")
    assert k.typ == TYP_UNCLASSIFIED
    assert k.konfidenz == 0.0


def test_schwaches_merkmal_reicht_nicht():
    # "invoice" allein (Gewicht 1) liegt unter der Mindestpunktzahl.
    assert klassifiziere("Please find attached the invoice.").typ == TYP_UNCLASSIFIED


def test_atr_ist_erkennbar():
    assert klassifiziere("A.TR Warenverkehrsbescheinigung EU-Türkei").typ in ("atr", "eur1")
