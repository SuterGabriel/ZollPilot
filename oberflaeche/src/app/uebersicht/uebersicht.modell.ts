// Die Form dessen, was GET /webhook/akten liefert (docs/entwurf/04-uebersicht.md).
//
// Eine Abschrift der Abfrage in workflows/zollpilot-lesen.json, keine
// Quelle. Bewusst keine Fachlogik: `status` ist das Wort, das der
// Prüf-Workflow abgelegt hat, und wird so gezeigt.

export interface AkteZeile {
  akte_id: string;
  status: string;
  zuletzt_geprueft_am: string | null;
  richtung: string;
  verkehrstraeger: string;
  belege: number;
  nachforderungen_offen: number;
  letzte_stufe: string | null;
  letzter_versand_am: string | null;
  customs_cutoff: string | null;
}

export interface UnzugeordnetePost {
  id: number;
  von: string | null;
  betreff: string | null;
  grund: string | null;
  anhaenge: number;
  empfangen_am: string;
}

export interface Zusammenfassung {
  akten: number;
  blockiert: number;
  freigabereif: number;
  nachforderungen_offen: number;
  unzugeordnet: number;
}

export interface Uebersicht {
  akten: AkteZeile[];
  unzugeordnet: UnzugeordnetePost[];
  zusammenfassung: Zusammenfassung;
}
