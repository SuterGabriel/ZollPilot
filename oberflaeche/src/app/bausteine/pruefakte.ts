// Der erste Bildschirm: eine Akte einreichen, das Ergebnis lesen,
// übersteuern. Zwei Spalten nach dem Entwurf (docs/entwurf/, Struktur 1a):
// Die Akte ist Kontext und bleibt links stehen, das Ergebnis bekommt die
// Restbreite. Unter 1024 px stapeln sie.
//
// Der Baustein selbst tut nichts; er ordnet die zwei Bausteine an, die
// etwas tun.

import { Component } from '@angular/core';

import { Einreichung } from './einreichung';
import { Ergebnis } from './ergebnis';

@Component({
  selector: 'app-pruefakte',
  imports: [Einreichung, Ergebnis],
  templateUrl: './pruefakte.html',
  styleUrl: './pruefakte.css',
})
export class Pruefakte {}
