// Das Formular: Was der Nutzer einträgt, muss genau der Datensatz werden, den
// die Extraktion erwartet — und jede Eingabe braucht eine Beschriftung.

import { TestBed } from '@angular/core/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { anfangszustand } from '../akte/akte.reducer';
import { akteFeature } from '../akte/akte.reducer';
import { Einreichung } from './einreichung';

function baue(zustand = anfangszustand) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [Einreichung],
    providers: [provideMockStore({ initialState: { [akteFeature.name]: zustand } })],
  });
  const fixture = TestBed.createComponent(Einreichung);
  fixture.detectChanges();
  return fixture;
}

describe('Einreichung', () => {
  let fixture: ReturnType<typeof baue>;

  beforeEach(() => {
    fixture = baue();
  });

  it('baut aus dem Formular den Datensatz für den Webhook', () => {
    const komponente = fixture.componentInstance;
    komponente.formular.patchValue({
      akte_id: '  ZP-2026-0099  ',
      incoterm_unlocode: 'deham',
      pol: 'deham',
      pod: '',
      warennummern: '84133080 , , 84842000',
    });

    const stammdaten = komponente.stammdaten();
    expect(stammdaten.akte_id).toBe('ZP-2026-0099');
    expect(stammdaten.sachverhalt.incoterm.named_place_unlocode).toBe('DEHAM');
    expect(stammdaten.sachverhalt.route.pol).toBe('DEHAM');
    // Ein leeres Feld wird null, nicht der leere String: Das Regelwerk
    // unterscheidet "nicht angegeben" von "angegeben als nichts".
    expect(stammdaten.sachverhalt.route.pod).toBeNull();
    expect(stammdaten.anmeldung.warennummern).toEqual(['84133080', '84842000']);
    expect(stammdaten.sachverhalt.incoterm.edition).toBe(2020);
  });

  it('leitet die Anmelderichtung aus der Sendungsrichtung ab', () => {
    const komponente = fixture.componentInstance;
    expect(komponente.stammdaten().anmeldung.richtung).toBe('export');
    komponente.formular.patchValue({ richtung: 'import' });
    expect(komponente.stammdaten().anmeldung.richtung).toBe('import');
  });

  it('sperrt das Absenden ohne Beleg und sagt warum', () => {
    const knopf = fixture.nativeElement.querySelector('button[type=submit]') as HTMLButtonElement;
    expect(knopf.disabled).toBe(true);
    expect(fixture.componentInstance.sperrgrund()).toContain('Beleg');
  });

  it('gibt das Absenden frei, sobald ein Beleg vorliegt', () => {
    const mitBeleg = baue({ ...anfangszustand, belege: [{ id: 'a', name: 'a.pdf', groesse: 1 }] });
    const knopf = mitBeleg.nativeElement.querySelector('button[type=submit]') as HTMLButtonElement;
    expect(knopf.disabled).toBe(false);
    expect(mitBeleg.componentInstance.sperrgrund()).toBeNull();
  });

  it('sperrt erneut, solange eine Prüfung läuft', () => {
    const laeuft = baue({ ...anfangszustand, belege: [{ id: 'a', name: 'a.pdf', groesse: 1 }], stand: 'laeuft' });
    expect((laeuft.nativeElement.querySelector('button[type=submit]') as HTMLButtonElement).disabled).toBe(true);
    expect(laeuft.componentInstance.sperrgrund()).toContain('geprüft');
  });

  it('gibt jeder Eingabe eine Beschriftung', () => {
    const element = fixture.nativeElement as HTMLElement;
    const eingaben = [...element.querySelectorAll('input, select')] as HTMLElement[];
    expect(eingaben.length).toBeGreaterThan(5);
    for (const eingabe of eingaben) {
      const id = eingabe.getAttribute('id');
      expect(id, `Eingabe ohne id: ${eingabe.outerHTML}`).toBeTruthy();
      expect(element.querySelector(`label[for="${id}"]`), `keine Beschriftung für ${id}`).toBeTruthy();
    }
  });

  it('meldet ein leeres Pflichtfeld erst nach der Berührung, dann als Fehler', () => {
    const komponente = fixture.componentInstance;
    komponente.formular.controls.akte_id.setValue('');
    expect(komponente.fehlerhaft('akte_id')).toBe(false);

    komponente.absenden();
    fixture.detectChanges();
    expect(komponente.fehlerhaft('akte_id')).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('[role=alert]')?.textContent).toContain(
      'Akten-Nummer',
    );
  });
});
