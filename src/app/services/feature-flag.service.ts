import { Injectable, signal } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';

declare global {
  interface Window { __featureFlags: Record<string, boolean>; }
}

@Injectable({ providedIn: 'root' })
export class FeatureFlagService {
  private _flags = signal<Record<string, boolean>>({});
  private _initialized = signal<boolean>(false);
  
  // Public readonly signals
  public flags = this._flags.asReadonly();
  public initialized = this._initialized.asReadonly();

  // Default flags (used as fallback)
  private readonly defaultFlags: Record<string, boolean> = {
    enablePayments: true
  };

  constructor(
    private apiService: ApiService,
    private loggerService: LoggerService
  ) {}

  /**
   * Initialize feature flags - called during app bootstrap
   * Fetches from public GET /featureFlags endpoint (no auth required)
   */
  async init(): Promise<void> {
    try {
      this.loggerService.debug('Initializing feature flags...');
      const response: any = await lastValueFrom(this.apiService.get('featureFlags'));
      const flags = response?.data || this.defaultFlags;
      this._flags.set(flags);
      this._initialized.set(true);
      
      // Expose flags on window for easy debugging (similar to window.__env)
      (window as any).__featureFlags = flags;
      
      this.loggerService.debug(`Feature flags initialized: ${JSON.stringify(this._flags())}`);
    } catch (error) {
      this.loggerService.error(`Failed to load feature flags, using defaults: ${error}`);
      this._flags.set(this.defaultFlags);
      this._initialized.set(true);
      
      // Expose defaults on window
      (window as any).__featureFlags = this.defaultFlags;
    }
  }

  /**
   * Check if a feature flag is enabled
   */
  isEnabled(flagKey: string): boolean {
    const flags = this._flags();
    return flags[flagKey] ?? this.defaultFlags[flagKey] ?? false;
  }
}
