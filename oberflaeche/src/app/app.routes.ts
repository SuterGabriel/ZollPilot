// Zwei Ansichten, zwei Pfade. Die Prüfakte ist der Einstieg; die Übersicht
// zeigt, was ohne Menschen am Bildschirm passiert ist (ADR-009, ADR-010,
// `docs/entwurf/04-uebersicht.md`). nginx liefert für jeden Pfad index.html
// aus (deploy/nginx/zollpilot.conf), deshalb funktionieren tiefe Links.

import type { Routes } from '@angular/router';

import { Pruefakte } from './bausteine/pruefakte';
import { Uebersicht } from './bausteine/uebersicht';

export const routes: Routes = [
  { path: '', component: Pruefakte, title: 'Akte einreichen · ZollPilot' },
  { path: 'uebersicht', component: Uebersicht, title: 'Übersicht · ZollPilot' },
  { path: '**', redirectTo: '' },
];
