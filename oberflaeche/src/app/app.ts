import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Einreichung } from './bausteine/einreichung';
import { Ergebnis } from './bausteine/ergebnis';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Einreichung, Ergebnis],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
