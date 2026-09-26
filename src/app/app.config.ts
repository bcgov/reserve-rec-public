import { ApplicationConfig, provideZoneChangeDetection, inject, provideAppInitializer } from '@angular/core';
import { provideRouter, TitleStrategy, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { ConfigService } from './services/config.service';
import { provideHttpClient } from '@angular/common/http';
import { ApiService } from './services/api.service';
import { AuthService } from './services/auth.service';
import { FeatureFlagService } from './services/feature-flag.service';
import { WaitingRoomService } from './services/waiting-room.service';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideToastr } from 'ngx-toastr';
import { PageTitleStrategy } from './page-title.strategy';

export function initConfig(configService: ConfigService, apiService: ApiService, authService: AuthService, featureFlagService: FeatureFlagService, waitingRoomService: WaitingRoomService) {
  return async () => {
    await configService.init();
    await authService.init();
    apiService.init();
    await featureFlagService.init();
    await waitingRoomService.loadMode2Status();
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withInMemoryScrolling({
      scrollPositionRestoration: 'enabled',  // top on forward nav, restore on back
      anchorScrolling: 'enabled',
    })),
    { provide: TitleStrategy, useClass: PageTitleStrategy },
    provideAppInitializer(() => {
      const initializerFn = (initConfig)(inject(ConfigService), inject(ApiService), inject(AuthService), inject(FeatureFlagService), inject(WaitingRoomService));
      return initializerFn();
    }),
    provideAnimations(),
    provideToastr(), // Toastr providers
    ConfigService,
  ]
};
