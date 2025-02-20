import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { ConfigService } from './services/config.service';
import { HttpClient, provideHttpClient } from '@angular/common/http';
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
    {
      provide: APP_INITIALIZER,
      useFactory: initConfig,
      deps: [ConfigService, ApiService, AuthService, HttpClient],
      multi: true
    },
    provideAnimations(),
    provideToastr(), // Toastr providers
    ConfigService
  ]
};
