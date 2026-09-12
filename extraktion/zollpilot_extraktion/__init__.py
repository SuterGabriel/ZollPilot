"""ZollPilot, Stufe 3: Extraktion.

Aus Belegen (PDF) werden Assertions mit Wert, Rohwert, Konfidenz, Seite,
Bounding Box und Methode. Die Schichten folgen docs/07-idp-ocr.md:

    lesen            Textlayer mit Koordinaten, sonst OCR mit Wortkonfidenzen
    klassifikation   Belegtyp, Draft/Final, Ursprungserklärung als eigener Beleg
    felder/          Feldwerte je Belegtyp, labelgetrieben, Tabellen über Spalten
    normalisierung   Beträge, Daten, Länder, Warencodes
    akte             Zusammenbau zur Akte, die src/regelwerk.mjs versteht

Dieses Paket entscheidet nichts (ADR-003). Es setzt keinen Fakt; es liefert
Behauptungen mit Fundstelle. Die Entscheidung liegt in src/ und im
Code-Node des Workflows (ADR-004, ADR-005).
"""

VERSION = "0.1.0"
