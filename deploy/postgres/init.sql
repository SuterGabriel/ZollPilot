-- Aktenspeicher von ZollPilot. Läuft einmal beim ersten Start des
-- Postgres-Containers (docker-entrypoint-initdb.d). n8n bekommt seine eigene
-- Datenbank (n8n); die Akte liegt getrennt in zollpilot, damit ein
-- n8n-Upgrade nie das Fachschema anfasst.
--
-- Das Schema folgt PROJECT.md, Abschnitt 4. Die Trennung von
-- document_field_assertion (was ein Beleg sagt) und canonical_fact (was die
-- Akte für wahr hält) ist Prinzip 2 aus CLAUDE.md und wird hier zur Tabelle.

CREATE DATABASE zollpilot;
\connect zollpilot

CREATE TABLE shipment (
  akte_id           text PRIMARY KEY,
  richtung          text NOT NULL,
  verkehrstraeger   text NOT NULL,
  incoterm_code     text,
  incoterm_ort      text,
  praeferenz        boolean NOT NULL DEFAULT false,
  status            text NOT NULL DEFAULT 'offen',
  angelegt_am       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE document (
  id                text PRIMARY KEY,
  akte_id           text NOT NULL REFERENCES shipment(akte_id),
  typ               text NOT NULL,          -- handelsrechnung, packliste, bill_of_lading, origin_declaration, unclassified, ...
  status            text NOT NULL,          -- draft | final
  version           integer NOT NULL DEFAULT 1,
  aussteller        text,
  hash_sha256       text NOT NULL,
  quelle            text,                   -- Mail-Thread, Upload, API
  eingegangen_am    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (akte_id, hash_sha256)             -- Duplikat über Hash
);

-- Was ein Beleg sagt. Wird nie überschrieben, nur ergänzt.
CREATE TABLE document_field_assertion (
  id                bigserial PRIMARY KEY,
  dokument_id       text NOT NULL REFERENCES document(id),
  pfad              text NOT NULL,          -- z. B. rechnung.positionen.0.hs6
  rohwert           text,
  wert              jsonb,
  konfidenz         numeric(4,3),
  seite             integer,
  bbox              jsonb,
  methode           text,                   -- textlayer | ocr | vision_llm | manuell
  modellversion     text,
  erzeugt_am        timestamptz NOT NULL DEFAULT now()
);

-- Was die Akte für wahr hält, mit Herkunft. Eine Korrektur ist eine neue
-- Version, keine Änderung.
CREATE TABLE canonical_fact (
  id                bigserial PRIMARY KEY,
  akte_id           text NOT NULL REFERENCES shipment(akte_id),
  pfad              text NOT NULL,
  wert              jsonb,
  version           integer NOT NULL DEFAULT 1,
  quelle_assertion  bigint REFERENCES document_field_assertion(id),
  freigegeben_von   text,
  begruendung       text,
  erzeugt_am        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (akte_id, pfad, version)
);

-- Ergebnis eines Regellaufs, so wie der Code-Node es liefert.
CREATE TABLE pruefung (
  id                bigserial PRIMARY KEY,
  akte_id           text NOT NULL,
  stichtag          date,
  katalog_version   text,
  freigabe          text NOT NULL,
  -- Dieselbe Prüfung, gelesen mit den Übersteuerungen als verantwortet
  -- (ADR-007). Ohne Übersteuerung stehen hier beide gleich. Zwei Spalten
  -- statt einer, weil die Auswertung sonst nicht mehr sagen könnte, wie oft
  -- das Regelwerk blockiert hat und wie oft ein Mensch darüber hinweg ist.
  freigabe_nach_override text,
  befunde_verletzt  integer,
  nachforderungen   integer,
  ergebnis          jsonb NOT NULL,
  geprueft_am       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pruefung_akte_idx ON pruefung (akte_id, geprueft_am DESC);

-- Einzelbefund je Regel, für Auswertungen (False-Positive-Rate, Alter offener
-- Befunde). Wird aus `pruefung.ergebnis` abgeleitet.
CREATE VIEW rule_result AS
SELECT p.id AS pruefung_id, p.akte_id, p.geprueft_am,
       b->>'regel' AS regel, b->>'status' AS status,
       b->>'haerte_effektiv' AS haerte, b->>'risiko' AS risiko,
       b->>'regelversion' AS regelversion, b->>'begruendung' AS begruendung
FROM pruefung p, jsonb_array_elements(p.ergebnis->'befunde') b;

CREATE TABLE request_case (
  id                bigserial PRIMARY KEY,
  akte_id           text NOT NULL,
  grund             text NOT NULL,          -- Regel- oder Pflichtmatrix-ID
  feld              text NOT NULL,
  adressat          text NOT NULL,
  stufe             text NOT NULL DEFAULT 'erinnerung_0',
  gesendet_am       timestamptz,
  beantwortet_am    timestamptz,
  status            text NOT NULL DEFAULT 'offen'
);

-- Fehler aus dem Error-Workflow. Keine Nutzdaten der Akte.
CREATE TABLE workflow_fehler (
  id                bigserial PRIMARY KEY,
  workflow_name     text,
  workflow_id       text,
  execution_id      text,
  node_name         text,
  meldung           text,
  aufgetreten_am    timestamptz NOT NULL DEFAULT now(),
  ausfuehrung_url   text
);

-- Ein gescheiterter Lauf, der sich wiederholen lässt. Der Fehlerzweig des
-- Prüf-Workflows legt hier ab, was erneut hinein müsste; der Workflow
-- zollpilot-wiederholen liest es und schickt es noch einmal an denselben
-- Eingang. Im Unterschied zu workflow_fehler trägt `nutzlast` Aktendaten:
-- Das ist der Zweck der Tabelle, und deshalb gilt für sie dieselbe
-- Aufbewahrung wie für Ausführungen (docs/DATENSCHUTZ.md).
CREATE TABLE wiedervorlage (
  id                        bigserial PRIMARY KEY,
  execution_id              text NOT NULL,
  eingang                   text NOT NULL,       -- akte | belege
  akte_id                   text,
  nutzlast                  jsonb,
  status                    text NOT NULL DEFAULT 'offen',  -- offen | erledigt | erneut_gescheitert | nicht_wiederholbar
  angelegt_am               timestamptz NOT NULL DEFAULT now(),
  wiederholt_am             timestamptz,
  wiederholung_execution_id text,
  ergebnis_freigabe         text
);
CREATE INDEX wiedervorlage_offen_idx ON wiedervorlage (status, angelegt_am);

-- Alarme aus Prometheus, über den Alertmanager an n8n geliefert
-- (deploy/alertmanager/alertmanager.yml, workflows/zollpilot-alarm.json).
-- Ein Alarm ist damit eine Zeile mit Beginn und Ende, nicht eine Mail.
CREATE TABLE alarm (
  id                bigserial PRIMARY KEY,
  fingerprint       text,
  name              text NOT NULL,
  schwere           text,
  zustand           text NOT NULL,             -- firing | resolved
  zusammenfassung   text,
  beschreibung      text,
  begonnen_am       timestamptz,
  beendet_am        timestamptz,
  labels            jsonb,
  empfangen_am      timestamptz NOT NULL DEFAULT now()
);

-- Overrides sind Entscheidungen mit Namen. Ohne Begründung kein Override
-- (PROJECT.md, Abschnitt 6).
--
-- `regel` hält eine Regel- oder eine Pflichtmatrix-Kennung; beides lässt sich
-- übersteuern. `fassung` ist die Katalogversion, gegen die entschieden wurde:
-- Ändert sich der Katalog, ist der Override verbraucht, weil die Person eine
-- andere Regel verantwortet hat als die jetzt geltende (ADR-007). Verbrauchte
-- Overrides bleiben stehen — sie sind der Nachweis, dass einmal jemand
-- entschieden hat.
CREATE TABLE override (
  id                bigserial PRIMARY KEY,
  akte_id           text NOT NULL,
  regel             text NOT NULL,
  fassung           text NOT NULL,
  benutzer          text NOT NULL,
  begruendung       text NOT NULL CHECK (length(begruendung) > 10),
  erzeugt_am        timestamptz NOT NULL DEFAULT now(),
  -- Eine Kennung, eine Fassung, eine Entscheidung. Wer es anders sieht,
  -- schreibt eine neue Fassung, nicht einen zweiten Override.
  UNIQUE (akte_id, regel, fassung)
);

-- Wer hat was verantwortet, und galt es noch. Beantwortet die Frage, die
-- eine Zollprüfung stellt, mit einer Abfrage statt einer Rekonstruktion.
CREATE VIEW override_wirkung AS
SELECT p.id AS pruefung_id, p.akte_id, p.geprueft_am, p.katalog_version,
       u->>'kennung' AS kennung, u->>'benutzer' AS benutzer,
       u->>'begruendung' AS begruendung, true AS gewirkt
FROM pruefung p, jsonb_array_elements(p.ergebnis->'uebersteuerungen'->'angewandt') u
UNION ALL
SELECT p.id, p.akte_id, p.geprueft_am, p.katalog_version,
       v->>'kennung', v->>'benutzer', NULL, false
FROM pruefung p, jsonb_array_elements(p.ergebnis->'uebersteuerungen'->'verbraucht') v;
