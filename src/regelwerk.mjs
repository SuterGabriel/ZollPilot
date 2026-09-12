// Das Regelwerk: der einzige Ort, an dem über Freigabe entschieden wird.
// Deterministisch, auf normalisierten Fakten, ohne Modell (CLAUDE.md, harte
// Grenze 1). Reihenfolge: Akte aufbauen → Pflichtmatrix → harte Regeln →
// weiche Regeln → Freigabe → Nachforderungen.
//
// Der Katalog wird übergeben, nicht geladen: In Tests und im CLI kommt er aus
// rules.yaml (src/katalog.mjs), im n8n-Code-Node aus dem gebündelten JSON
// (scripts/n8n-bundle.mjs). Dieselbe Funktion, dieselben Regeln.

import { baueAkte, fakt } from './akte/aufbau.mjs';
import { pruefePflichtmatrix } from './pflichtmatrix.mjs';
import { formuliereNachforderungen } from './nachforderung.mjs';
import { STATUS } from './regeln/befund.mjs';

export const FREIGABE = Object.freeze({
  FREIGABEREIF: 'freigabereif',
  MIT_WARNUNGEN: 'freigabe_mit_warnungen',
  NACHEXTRAKTION: 'nachextraktion_erforderlich',
  BLOCKIERT: 'blockiert',
});

/** Regel gilt am Stichtag, wenn valid_from ≤ Stichtag < valid_to (valid_to optional). */
export function regelGiltAm(regel, stichtag) {
  if (regel.valid_from && stichtag < regel.valid_from) return false;
  if (regel.valid_to && stichtag >= regel.valid_to) return false;
  return true;
}

function katalogZugriff(katalog) {
  const index = new Map(katalog.regeln.rules.map((r) => [r.id, r]));
  return { ...katalog, regel: (id) => index.get(id) };
}

export function pruefeAkte(eingang, katalog, register) {
  const akte = baueAkte(eingang);
  const stichtag = eingang.stichtag ?? new Date().toISOString().slice(0, 10);
  const zugriff = katalogZugriff(katalog);
  const defaults = katalog.regeln.defaults;

  const pflichtmatrix = pruefePflichtmatrix(akte, katalog.pflichtmatrix);

  // Harte Regeln zuerst, danach weiche. Innerhalb der Gruppe Katalogreihenfolge.
  const geltend = katalog.regeln.rules.filter((r) => regelGiltAm(r, stichtag));
  const sortiert = [...geltend.filter((r) => r.hardness === 'hard'), ...geltend.filter((r) => r.hardness !== 'hard')];

  const befunde = [];
  const nichtImplementiert = [];
  for (const regel of sortiert) {
    const pruefer = register[regel.id];
    if (!pruefer) {
      nichtImplementiert.push(regel.id);
      continue;
    }
    const ergebnis = pruefer(akte, regel, defaults, zugriff);
    befunde.push({
      regel: regel.id,
      name: regel.name,
      haerte: regel.hardness,
      haerte_effektiv: ergebnis.haerte_effektiv ?? regel.hardness,
      risiko: regel.risk,
      inputs: regel.inputs,
      rechtsgrundlage: regel.legal_basis,
      rechtsquelle_status: regel.legal_source ?? 'secondary',
      konsequenz: regel.consequence,
      regelversion: `${katalog.regeln.catalog.version}@${regel.valid_from}`,
      ...ergebnis,
    });
  }

  const freigabe = entscheideFreigabe(befunde, pflichtmatrix);
  const ergebnis = {
    akte_id: eingang.akte_id,
    stichtag,
    katalog_version: katalog.regeln.catalog.version,
    freigabe,
    pflichtmatrix,
    befunde,
    regeln_ohne_implementierung: nichtImplementiert,
    // Welche Belege die Akte trägt, mit Status und — wenn sie aus der
    // Extraktion kommen — Seitenzahl, Lesemethode und Hinweis. Ohne das
    // könnte ein Aufrufer nur sehen, was fehlt, nie was erkannt wurde; und
    // ein `unclassified` wäre eine Kennung ohne Grund (CLAUDE.md, harte
    // Grenze 2: nichts stillschweigend verwerfen).
    dokumente: akte.dokumente ?? [],
    extraktion: eingang.extraktion ?? null,
    unbekannte_dokumente: akte.unbekannte_dokumente,
    nicht_klassifiziert: (akte.dokumente ?? []).filter((d) => d.typ === 'unclassified').map((d) => d.id),
    referenzen: {
      rechnung: fakt(akte, 'rechnung.nummer') ?? null,
      bill_of_lading: fakt(akte, 'bill_of_lading.nummer') ?? null,
      container: fakt(akte, 'bill_of_lading.container_id') ?? fakt(akte, 'packliste.container_id') ?? null,
    },
  };
  ergebnis.nachforderungen = formuliereNachforderungen(ergebnis, katalog.zustaendigkeiten);
  return ergebnis;
}

export function entscheideFreigabe(befunde, pflichtmatrix) {
  const pflichtHart = pflichtmatrix.befunde.some((b) => b.status !== 'ok' && b.haerte === 'hard');
  const hartVerletzt = befunde.some((b) => b.haerte_effektiv === 'hard' && (b.status === STATUS.VERLETZT || b.status === STATUS.NICHT_PRUEFBAR));
  if (pflichtHart || hartVerletzt) return FREIGABE.BLOCKIERT;
  if (befunde.some((b) => b.status === STATUS.RE_EXTRACTION)) return FREIGABE.NACHEXTRAKTION;
  const warnung = befunde.some((b) => b.status !== STATUS.OK) || pflichtmatrix.befunde.some((b) => b.status !== 'ok');
  return warnung ? FREIGABE.MIT_WARNUNGEN : FREIGABE.FREIGABEREIF;
}
