// Der Name kommt aus dem Antwortkopf, nicht aus dem Rumpf. Ohne Proxy gibt es
// keinen, und das ist ein Zustand, kein Fehler.

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { AnmeldungDienst, KOPF_BENUTZER, PFAD_WER } from './anmeldung.dienst';

describe('AnmeldungDienst', () => {
  let dienst: AnmeldungDienst;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    dienst = TestBed.inject(AnmeldungDienst);
    http = TestBed.inject(HttpTestingController);
  });

  it('liest den Namen aus dem Antwortkopf X-Benutzer', () => {
    dienst.laden();
    http.expectOne(PFAD_WER).flush(new Blob(), { headers: { [KOPF_BENUTZER]: 'sachbearbeitung' } });
    expect(dienst.benutzer()).toBe('sachbearbeitung');
    expect(dienst.geprueft()).toBe(true);
  });

  it('ohne Kopf ist niemand angemeldet, aber die Frage ist beantwortet', () => {
    dienst.laden();
    http.expectOne(PFAD_WER).flush(new Blob());
    expect(dienst.benutzer()).toBeNull();
    expect(dienst.geprueft()).toBe(true);
  });

  it('ein Fehler (kein Proxy) heißt nicht angemeldet, nicht kaputt', () => {
    dienst.laden();
    http.expectOne(PFAD_WER).flush(new Blob(), { status: 404, statusText: 'Not Found' });
    expect(dienst.benutzer()).toBeNull();
    expect(dienst.geprueft()).toBe(true);
  });
});
