// Die Form dessen, was der Webhook liefert und was er entgegennimmt.
//
// Diese Typen sind eine Abschrift, keine Quelle: Gebaut wird das Ergebnis in
// src/regelwerk.mjs, die Stammdaten nimmt die Extraktion in
// extraktion/zollpilot_extraktion/akte.py entgegen. Weicht etwas ab, hat das
// Repo recht und diese Datei unrecht.
//
// Bewusst keine Fachlogik hier: keine Schwelle, keine Regel, keine Bewertung
// eines Befundes (ADR-006). Die Oberfläche zeigt, was entschieden wurde.

/** Die vier Ausgänge aus src/regelwerk.mjs, FREIGABE. */
export type Freigabe =
  | 'freigabereif'
  | 'freigabe_mit_warnungen'
  | 'nachextraktion_erforderlich'
  | 'blockiert';

/** Die vier Ausgänge einer Regel aus src/regeln/befund.mjs, STATUS. */
export type Befundstatus = 'ok' | 'verletzt' | 'nicht_pruefbar' | 're_extraction_required';

export type Haerte = 'hard' | 'soft';

/** Stand der Verifikation einer Rechtsgrundlage; keine Regel trägt heute `verified`. */
export type Rechtsquelle = 'verified' | 'secondary' | 'practice';

export interface Incoterm {
  code: string;
  named_place: string;
  named_place_unlocode: string | null;
  edition: number;
}

export interface Sachverhalt {
  richtung: string;
  verkehrstraeger: string;
  praeferenz_beansprucht: boolean;
  incoterm: Incoterm;
  route: { pol: string | null; pod: string | null };
}

export interface Stammdaten {
  akte_id: string;
  stichtag: string;
  sachverhalt: Sachverhalt;
  anmeldung: { richtung: string; warennummern: string[] };
}

/**
 * Ein eingereichter Beleg — nur die Angaben, nicht die Datei.
 *
 * Die `File`-Objekte liegen im BelegSpeicher, nicht im Store: Der Store hält
 * ausschließlich Serialisierbares, und `strictStateSerializability` in
 * app.config.ts setzt das durch, statt es zu behaupten.
 */
export interface Beleg {
  id: string;
  name: string;
  groesse: number;
}

export interface Adressat {
  primaer: string;
  sekundaer: string | null;
  ausloeser: string | null;
}

export interface Befund {
  regel: string;
  name: string;
  status: Befundstatus;
  haerte: Haerte;
  haerte_effektiv: Haerte;
  risiko: string;
  begruendung: string;
  rechtsgrundlage: string;
  rechtsquelle_status: Rechtsquelle;
  konsequenz: string;
  regelversion: string;
  eingaben?: Record<string, unknown>;
  fehlende_pfade?: string[];
  nachzulesende_pfade?: string[];
}

export interface Pflichtbefund {
  id: string;
  required_data: string;
  label: string;
  haerte: Haerte;
  status: 'ok' | 'fehlt' | 'falscher_nachweis';
  begruendung: string;
  akzeptierte_nachweise: string[];
  rechtsgrundlage: string;
  quelle?: string;
}

export interface Nachforderung {
  grund: string;
  feld: string;
  adressat: Adressat;
  anforderung: string;
  widerspruch: string;
  akzeptierte_nachweise: string[];
  folge: string;
  stufe: string;
  betreff: string;
  text: string;
}

/** Ein Beleg der Akte, wie ihn die Extraktion klassifiziert hat. */
export interface Dokument {
  id: string;
  typ: string;
  status: 'draft' | 'final';
  version: number;
  aussteller: string | null;
  hash: string;
  datei?: string;
  seiten?: number;
  methoden?: string[];
  klassifikation?: { konfidenz: number; merkmale: string[] };
  hinweis?: string;
  traeger?: string;
}

export interface Extraktionsstand {
  version: string;
  ocr: string | null;
  belege: number;
  hinweise: string[];
}

export interface Pruefergebnis {
  akte_id: string;
  stichtag: string;
  katalog_version: string;
  freigabe: Freigabe;
  pflichtmatrix: { anwendbar: boolean; befunde: Pflichtbefund[]; grund?: string };
  befunde: Befund[];
  regeln_ohne_implementierung: string[];
  dokumente: Dokument[];
  extraktion: Extraktionsstand | null;
  unbekannte_dokumente: unknown[];
  nicht_klassifiziert: string[];
  referenzen: { rechnung: string | null; bill_of_lading: string | null; container: string | null };
  nachforderungen: Nachforderung[];
  /**
   * Die Ausführungs-ID von n8n. Sie gehört nicht zur Entscheidung, sondern
   * an sie: Damit findet der Betrieb die Ausführung mit Eingabe und Ausgabe
   * je Node wieder. Fehlt bei einer Akte, die nicht über den Workflow kam.
   */
  ausfuehrung?: string | null;
}

/** Beschriftung und Farbe je Entscheidung. Farbe ist nie der alleinige Träger. */
export const FREIGABE_TEXT: Record<Freigabe, string> = {
  freigabereif: 'Freigabereif',
  freigabe_mit_warnungen: 'Freigabe mit Warnungen',
  nachextraktion_erforderlich: 'Nachextraktion erforderlich',
  blockiert: 'Blockiert',
};

export const BEFUND_TEXT: Record<Befundstatus, string> = {
  ok: 'erfüllt',
  verletzt: 'verletzt',
  nicht_pruefbar: 'nicht prüfbar',
  re_extraction_required: 'nachlesen',
};

export const PFLICHT_TEXT: Record<Pflichtbefund['status'], string> = {
  ok: 'nachgewiesen',
  fehlt: 'fehlt',
  falscher_nachweis: 'falscher Nachweis',
};

export const RECHTSQUELLE_TEXT: Record<Rechtsquelle, string> = {
  verified: 'geprüft',
  secondary: 'Sekundärrecherche',
  practice: 'Praxisannahme',
};
