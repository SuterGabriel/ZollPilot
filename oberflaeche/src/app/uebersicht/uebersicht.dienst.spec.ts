import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { UEBERSICHT } from './testhilfen';
import { UebersichtDienst, WEBHOOK_AKTEN, uebersichtFehlermeldung } from './uebersicht.dienst';

describe('UebersichtDienst', () => {
  let dienst: UebersichtDienst;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    dienst = TestBed.inject(UebersichtDienst);
    http = TestBed.inject(HttpTestingController);
  });

  it('holt die Übersicht mit GET von derselben Herkunft', () => {
    let erhalten: unknown;
    dienst.laden().subscribe((daten) => (erhalten = daten));
    const anfrage = http.expectOne(WEBHOOK_AKTEN);
    expect(anfrage.request.method).toBe('GET');
    anfrage.flush(UEBERSICHT);
    expect(erhalten).toEqual(UEBERSICHT);
  });

  it('macht aus Statuszahlen Sätze mit einem Handgriff', () => {
    let meldung = '';
    dienst.laden().subscribe({ error: (f: unknown) => (meldung = uebersichtFehlermeldung(f)) });
    http.expectOne(WEBHOOK_AKTEN).flush('', { status: 404, statusText: 'Not Found' });
    expect(meldung).toContain('Workflow');
    expect(meldung).toContain('404');
  });
});
