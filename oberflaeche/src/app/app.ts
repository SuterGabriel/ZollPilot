import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { AnmeldungDienst } from './anmeldung/anmeldung.dienst';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  /** Wer angemeldet ist, sagt der Proxy (ADR-009); die Oberfläche fragt nur nach. */
  readonly anmeldung = inject(AnmeldungDienst);
  readonly #router = inject(Router);

  /** Die Sprungmarke zum Ergebnis gibt es nur dort, wo es ein Ergebnis gibt. */
  readonly aufPruefakte = toSignal(
    this.#router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.#router.url.split(/[?#]/)[0] === '/'),
    ),
    { initialValue: true },
  );

  constructor() {
    this.anmeldung.laden();
  }
}
