// Der Transport, mit dem Fall, der niemandem auffällt, bis er wehtut:
// Der Workflow antwortet 422, wenn die Akte nicht freigabereif ist. Für den
// HttpClient ist das ein Fehler — fachlich ist es das Ergebnis. Wer das
// verwechselt, verliert genau die Befunde, um die es geht.

import { HttpErrorResponse } from '@angular/common/http';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AkteDienst, WEBHOOK_BELEGE, fehlermeldung, istPruefergebnis } from './akte.dienst';
import { ERGEBNIS_BLOCKIERT, ERGEBNIS_FREI, STAMMDATEN, datei } from './testhilfen';

describe('AkteDienst', () => {
  let dienst: AkteDienst;
  let anfragen: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    dienst = TestBed.inject(AkteDienst);
    anfragen = TestBed.inject(HttpTestingController);
  });

  afterEach(() => anfragen.verify());

  it('schickt die Stammdaten als JSON-Feld und jede Datei unter demselben Feldnamen', () => {
    dienst.einreichen(STAMMDATEN, [datei('rechnung.pdf'), datei('packliste.pdf')]).subscribe();

    const anfrage = anfragen.expectOne(WEBHOOK_BELEGE);
    expect(anfrage.request.method).toBe('POST');
    const koerper = anfrage.request.body as FormData;
    expect(JSON.parse(koerper.get('akte') as string).akte_id).toBe('ZP-2026-0004');
    expect(koerper.getAll('dateien')).toHaveLength(2);
    // Kein Content-Type von Hand: Den setzt der Browser mit der Grenzmarke.
    expect(anfrage.request.headers.get('Content-Type')).toBeNull();
    anfrage.flush(ERGEBNIS_FREI);
  });

  it('liefert bei 200 das Ergebnis', async () => {
    const versprechen = new Promise<unknown>((loesen) => dienst.einreichen(STAMMDATEN, []).subscribe(loesen));
    anfragen.expectOne(WEBHOOK_BELEGE).flush(ERGEBNIS_FREI);
    await expect(versprechen).resolves.toMatchObject({ freigabe: 'freigabereif' });
  });

  it('behandelt 422 als Ergebnis, nicht als Fehler', async () => {
    const versprechen = new Promise<unknown>((loesen, ablehnen) =>
      dienst.einreichen(STAMMDATEN, []).subscribe({ next: loesen, error: ablehnen }),
    );
    anfragen
      .expectOne(WEBHOOK_BELEGE)
      .flush(ERGEBNIS_BLOCKIERT, { status: 422, statusText: 'Unprocessable Entity' });
    await expect(versprechen).resolves.toMatchObject({ freigabe: 'blockiert' });
  });

  it('behandelt 422 ohne verwertbaren Körper weiterhin als Fehler', async () => {
    const versprechen = new Promise<unknown>((loesen, ablehnen) =>
      dienst.einreichen(STAMMDATEN, []).subscribe({ next: loesen, error: ablehnen }),
    );
    anfragen.expectOne(WEBHOOK_BELEGE).flush({ message: 'keine Dateien' }, { status: 422, statusText: 'x' });
    await expect(versprechen).rejects.toBeInstanceOf(HttpErrorResponse);
  });

  it('reicht einen echten Serverfehler durch', async () => {
    const versprechen = new Promise<unknown>((loesen, ablehnen) =>
      dienst.einreichen(STAMMDATEN, []).subscribe({ next: loesen, error: ablehnen }),
    );
    anfragen.expectOne(WEBHOOK_BELEGE).flush('kaputt', { status: 500, statusText: 'Server Error' });
    await expect(versprechen).rejects.toBeInstanceOf(HttpErrorResponse);
  });
});

describe('istPruefergebnis', () => {
  it('trennt ein Ergebnis von allem anderen', () => {
    expect(istPruefergebnis(ERGEBNIS_BLOCKIERT)).toBe(true);
    expect(istPruefergebnis({ message: 'keine Dateien' })).toBe(false);
    expect(istPruefergebnis({ freigabe: 'blockiert' })).toBe(false);
    expect(istPruefergebnis(null)).toBe(false);
    expect(istPruefergebnis('blockiert')).toBe(false);
  });
});

describe('fehlermeldung', () => {
  const antwort = (status: number) => new HttpErrorResponse({ status, statusText: 'x' });

  it('sagt bei jedem Fall, was zu tun ist', () => {
    expect(fehlermeldung(antwort(0))).toContain('docker compose');
    expect(fehlermeldung(antwort(404))).toContain('aktiv');
    expect(fehlermeldung(antwort(500))).toContain('workflow_fehler');
    expect(fehlermeldung(antwort(418))).toContain('418');
    expect(fehlermeldung(new Error('irgendwas'))).toContain('Unerwarteter Fehler');
  });

  it('nennt bei 500 die Ausführung, damit der Betrieb den Lauf wiederfindet', () => {
    // Genau der Rumpf, den der Fehlerzweig des Workflows liefert.
    const gescheitert = new HttpErrorResponse({
      status: 500,
      statusText: 'Internal Server Error',
      error: { fehler: true, meldung: 'Der Pruef-Workflow ist gescheitert.', ausfuehrung: '138' },
    });
    const meldung = fehlermeldung(gescheitert);
    expect(meldung).toContain('Ausführung 138');
    expect(meldung).toContain('nicht geprüft');
  });

  it('kommt ohne Ausführungs-ID aus, statt "undefined" zu zeigen', () => {
    // Der Satz nennt weiterhin die Ausführung in n8n als Fundstelle — aber
    // keine Nummer, die es nicht gibt.
    expect(fehlermeldung(antwort(502))).not.toMatch(/Ausführung \S+\./);
    expect(fehlermeldung(antwort(502))).toContain('workflow_fehler');
  });
});
