import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideEffects } from '@ngrx/effects';
import { provideStore } from '@ngrx/store';

import { akteEffekte } from './akte/akte.effekte';
import { akteFeature } from './akte/akte.reducer';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideStore(
      { [akteFeature.name]: akteFeature.reducer },
      {
        // Die Regeln, die ADR-006 über den Store aufstellt, werden hier
        // durchgesetzt statt behauptet. `strictStateSerializability` bricht,
        // sobald jemand ein `File` in den Store legt. Genau deshalb gibt es
        // den BelegSpeicher.
        runtimeChecks: {
          strictStateImmutability: true,
          strictActionImmutability: true,
          strictStateSerializability: true,
          strictActionSerializability: true,
        },
      },
    ),
    provideEffects(akteEffekte),
  ],
};
