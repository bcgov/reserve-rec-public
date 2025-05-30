import { ApplicationConfig, provideZoneChangeDetection, inject, provideAppInitializer, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { ConfigService } from './services/config.service';
import { provideHttpClient } from '@angular/common/http';
import { ApiService } from './services/api.service';
import { AuthService } from './services/auth.service';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideToastr } from 'ngx-toastr';

export function initConfig(configService: ConfigService, apiService: ApiService, authService: AuthService) {
  return async () => {
    await configService.init();
    await authService.init();
    apiService.init();
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAppInitializer(() => {
      const initializerFn = (initConfig)(inject(ConfigService), inject(ApiService), inject(AuthService));
      return initializerFn();
    }),
    provideAnimations(),
    provideToastr(), // Toastr providers
    ConfigService,
  ]
};
