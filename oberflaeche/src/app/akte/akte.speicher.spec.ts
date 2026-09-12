import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { BelegSpeicher } from './akte.speicher';
import { datei } from './testhilfen';

describe('BelegSpeicher', () => {
  let speicher: BelegSpeicher;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    speicher = TestBed.inject(BelegSpeicher);
  });

  it('nimmt PDFs an und gibt Angaben mit eindeutiger Kennung zurück', () => {
    const { belege, abgelehnt } = speicher.annehmen([datei('a.pdf'), datei('b.pdf')]);
    expect(abgelehnt).toEqual([]);
    expect(belege.map((b) => b.name)).toEqual(['a.pdf', 'b.pdf']);
    expect(new Set(belege.map((b) => b.id)).size).toBe(2);
  });

  it('lehnt ab, was kein PDF ist, und nennt es beim Namen', () => {
    const { belege, abgelehnt } = speicher.annehmen([datei('gut.pdf'), datei('notiz.txt', 'text/plain')]);
    expect(belege.map((b) => b.name)).toEqual(['gut.pdf']);
    expect(abgelehnt).toEqual(['notiz.txt']);
  });

  it('nimmt eine Datei mit Endung .pdf auch ohne Typangabe an', () => {
    // Manche Systeme liefern beim Ablegen keinen MIME-Typ.
    const { belege, abgelehnt } = speicher.annehmen([datei('Scan.PDF', '')]);
    expect(belege).toHaveLength(1);
    expect(abgelehnt).toEqual([]);
  });

  it('liefert die Dateien in der Reihenfolge der Kennungen', () => {
    const { belege } = speicher.annehmen([datei('eins.pdf'), datei('zwei.pdf')]);
    const ids = belege.map((b) => b.id);
    expect(speicher.dateien([ids[1], ids[0]]).map((d) => d.name)).toEqual(['zwei.pdf', 'eins.pdf']);
  });

  it('überspringt unbekannte Kennungen, statt undefined zu liefern', () => {
    const { belege } = speicher.annehmen([datei('eins.pdf')]);
    expect(speicher.dateien([belege[0].id, 'gibt-es-nicht'])).toHaveLength(1);
  });

  it('entfernt und leert', () => {
    const { belege } = speicher.annehmen([datei('eins.pdf'), datei('zwei.pdf')]);
    speicher.entfernen(belege[0].id);
    expect(speicher.dateien(belege.map((b) => b.id))).toHaveLength(1);
    speicher.leeren();
    expect(speicher.dateien(belege.map((b) => b.id))).toHaveLength(0);
  });
});
