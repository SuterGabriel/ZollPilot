// Das Ergebnis: Jeder Befund muss mit Begründung und Rechtsgrundlage
// ankommen, die Reihenfolge muss der Handlungsnähe folgen, und der Fokus
// muss nach dem Absenden dorthin wandern.

import { TestBed } from '@angular/core/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { describe, expect, it } from 'vitest';

import { akteFeature, anfangszustand, type AkteZustand } from '../akte/akte.reducer';
import { ERGEBNIS_BLOCKIERT, ERGEBNIS_FREI } from '../akte/testhilfen';
import { Ergebnis } from './ergebnis';

const ZEIT = '2026-09-12T14:22:00.000Z';

function baue(zustand: Partial<AkteZustand>) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [Ergebnis],
    providers: [provideMockStore({ initialState: { [akteFeature.name]: { ...anfangszustand, ...zustand } } })],
  });
  const fixture = TestBed.createComponent(Ergebnis);
  fixture.detectChanges();
  return fixture;
}

const fertig = (ergebnis = ERGEBNIS_BLOCKIERT) => baue({ stand: 'fertig', ergebnis, gepruefetAm: ZEIT });
const text = (fixture: ReturnType<typeof baue>) => (fixture.nativeElement as HTMLElement).textContent ?? '';

describe('Ergebnis', () => {
  it('zeigt vor dem Absenden einen Platzhalter, keinen leeren Bereich', () => {
    // Die Ergebnisspalte bleibt vorhanden und erklärt sich — sonst springt
    // der Bildschirm nach dem Absenden.
    const inhalt = text(baue({}));
    expect(inhalt).toContain('Noch keine Prüfung');
    expect(inhalt).toContain('Nachweispflichten');
  });

  it('zeigt während der Prüfung Platzhalter an den Stellen der späteren Blöcke', () => {
    const inhalt = text(baue({ stand: 'laeuft' }));
    expect(inhalt).toContain('Prüfung läuft');
    expect(inhalt).toContain('damit nach dem Laden nichts wandert');
  });

  it('nennt die Entscheidung als Text, nicht nur als Farbe', () => {
    const inhalt = text(fertig());
    expect(inhalt).toContain('Blockiert');
    expect(inhalt).toContain('Katalog 0.1.0');
  });

  it('ordnet die Blöcke nach Handlungsnähe: zuerst, was zu tun ist', () => {
    const element = fertig().nativeElement as HTMLElement;
    const rubriken = [...element.querySelectorAll('section.block h3')].map((h) =>
      (h.textContent ?? '').trim().split(/\s+/)[0],
    );
    expect(rubriken).toEqual(['Nachforderungen', 'Regeln', 'Nachweispflichten', 'Erkannte']);
  });

  it('zeigt jeden offenen Befund mit Begründung, Konsequenz und Verifikationsstand', () => {
    const inhalt = text(fertig());
    expect(inhalt).toContain('TRN-01');
    expect(inhalt).toContain('B/L nennt HLXU8765430, Packliste MSKU1234565');
    expect(inhalt).toContain('Bezeichnet ggf. eine andere physische Sendung');
    // Keine Regel trägt heute `verified` — das muss sichtbar sein.
    expect(inhalt).toContain('Praxisannahme');
    expect(inhalt).toContain('0.1.0@2026-09-12');
  });

  it('nennt Adressat und Folge jeder Nachforderung samt Anschreiben', () => {
    const fixture = fertig();
    const inhalt = text(fixture);
    expect(inhalt).toContain('Seefrachtspediteur/Carrier');
    expect(inhalt).toContain('bill_of_lading.container_id');
    expect(inhalt).toContain('Keine Freigabe');

    const mail = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('a[href^="mailto:"]');
    expect(mail).toBeTruthy();
    // Ohne Empfänger: Der Adressat ist eine Rolle, kein Postfach.
    expect(mail?.getAttribute('href')).toMatch(/^mailto:\?subject=/);
    expect(decodeURIComponent(mail?.getAttribute('href') ?? '')).toContain('ACTION REQUIRED');
  });

  it('meldet einen nicht erkannten Beleg, statt ihn zu verschweigen', () => {
    const inhalt = text(fertig());
    expect(inhalt).toContain('UNK-1');
    expect(inhalt).toContain('unclassified');
    expect(inhalt).toContain('lieferschein.pdf: Belegtyp nicht erkannt');
  });

  it('zeigt bei einer freigabereifen Akte eine Bilanz, keinen leeren Bildschirm', () => {
    const inhalt = text(fertig(ERGEBNIS_FREI));
    expect(inhalt).toContain('Freigabereif');
    expect(inhalt).toContain('Keine Regel ist verletzt');
    expect(inhalt).toContain('Nichts nachzufordern');
  });

  it('zeigt, welcher Beleg eine erfüllte Pflicht erfüllt', () => {
    const mitErfuellter = {
      ...ERGEBNIS_BLOCKIERT,
      pflichtmatrix: {
        anwendbar: true,
        befunde: [
          {
            id: 'PFL-05',
            required_data: 'praeferenznachweis.ursprung',
            label: 'Präferenzursprung',
            haerte: 'hard' as const,
            status: 'ok' as const,
            begruendung: 'nachgewiesen',
            akzeptierte_nachweise: ['origin_declaration'],
            rechtsgrundlage: 'Art. 64 UZK',
            quelle: 'UE-1',
          },
        ],
      },
    };
    const inhalt = text(fertig(mitErfuellter));
    expect(inhalt).toContain('1 erfüllt');
    expect(inhalt).toContain('UE-1');
  });

  it('entwertet ein Ergebnis, wenn sich die Belege geändert haben', () => {
    const fixture = baue({ stand: 'bereit', ergebnis: ERGEBNIS_BLOCKIERT, veraltet: true, gepruefetAm: ZEIT });
    const inhalt = text(fixture);
    expect(inhalt).toContain('Vorheriges Ergebnis gilt nicht mehr');
    expect(inhalt).toContain('Blockiert');
    // Die Befunde selbst dürfen nicht mehr dastehen.
    expect(inhalt).not.toContain('TRN-01');
  });

  it('zeigt einen Transportfehler ohne jeden Ergebnisblock', () => {
    const fixture = baue({ stand: 'fehler', fehler: 'Keine Verbindung zum Prüf-Workflow.' });
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Prüfung nicht durchgeführt');
    expect(element.querySelector('[role=alert]')?.textContent).toContain('Keine Verbindung');
    // Ein leerer Block hieße „nichts offen", und das ist hier nicht bekannt.
    expect(element.querySelectorAll('section.block')).toHaveLength(0);
  });

  it('setzt den Fokus auf die Überschrift, sobald ein Ergebnis da ist', () => {
    const fixture = fertig(ERGEBNIS_FREI);
    const ueberschrift = (fixture.nativeElement as HTMLElement).querySelector('h2');
    expect(ueberschrift?.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(ueberschrift);
  });

  it('hält die Marke von Hilfsmitteln fern — sie sagt dasselbe wie das Wort', () => {
    const marke = (fertig().nativeElement as HTMLElement).querySelector('.marke');
    expect(marke?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Rückverfolgbarkeit', () => {
  it('nennt die Ausführungs-ID, damit der Betrieb die Ausführung wiederfindet', () => {
    expect(text(fertig())).toContain('Ausführung');
    expect(text(fertig())).toContain('65');
  });

  it('lässt sie weg, wenn die Akte nicht über den Workflow kam', () => {
    const ohne = { ...ERGEBNIS_BLOCKIERT, ausfuehrung: null };
    expect(text(fertig(ohne))).not.toContain('Ausführung');
  });
});
