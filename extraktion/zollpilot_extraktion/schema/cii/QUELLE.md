# UN/CEFACT Cross Industry Invoice, Schemaversion D16B

Vier Dateien, unverändert übernommen. Das Hauptschema
`CrossIndustryInvoice_100pD16B.xsd` importiert die drei Datentyp-Schemata
aus demselben Ordner; Codelisten sind nicht eingebunden, deshalb genügen
diese vier Dateien zur Validierung mit `lxml`.

Herausgeber: UN/CEFACT, Standard Cross Industry Invoice (CII), Release D16B,
Namensraum `urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100`.

Bezogen am 2026-09-12 aus zwei öffentlichen Spiegeln, die byteidentisch sind:

- https://github.com/ConnectingEurope/eInvoicing-EN16931, Pfad
  `cii/schema/D16B SCRDM (Subset)/uncoupled clm/CII/uncefact/data/standard/`
- https://github.com/phax/ph-cii, Pfad
  `ph-cii-d16b/src/main/resources/external/schemas/d16b/data/standard/`

SHA-256 der Dateien, wie sie hier liegen:

| Datei | SHA-256 |
|---|---|
| `CrossIndustryInvoice_100pD16B.xsd` | `b9798aafcba039d0630f0015ffae5092a1758bf924d19d97b6bf0bf9d95f22a0` |
| `CrossIndustryInvoice_QualifiedDataType_100pD16B.xsd` | `a39e0662c31fbdca22237118d6b6bbfa16f69efbd1ee5b23787366349c5b924d` |
| `CrossIndustryInvoice_ReusableAggregateBusinessInformationEntity_100pD16B.xsd` | `cc682d67791ffe16c45320619ff089a1c8f3ad22691fc426e4056f2e67909fe0` |
| `CrossIndustryInvoice_UnqualifiedDataType_100pD16B.xsd` | `5d4ce8a6445caa4b7691f6fba6ad08e312e6a853cd3a422666d121ee2d13ef8c` |

Wer die Dateien austauscht, ändert die Hashes hier mit; `tests/test_cii.py`
validiert jede geschriebene und jede gelesene Rechnung gegen dieses Schema.
