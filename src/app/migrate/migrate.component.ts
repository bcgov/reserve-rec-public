import { Component } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { ApiService } from '../services/api.service';
import { LoadingService } from '../services/loading.service';
import { lastValueFrom } from 'rxjs';
import { Constants } from '../constants';
import { ToastService, ToastTypes } from '../services/toast.service';
import { LoggerService } from '../services/logger.service';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-migrate',
  imports: [],
  templateUrl: './migrate.component.html',
})
export class MigrateComponent {
  readonly migrateId: string | null;
  isConfirming = false;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private loadingService: LoadingService,
    private loggerService: LoggerService,
    private toastService: ToastService,
    private router: Router,
  ) {
    const state = this.router.currentNavigation()?.extras.state || window.history.state;
    const migrateId = state?.['migrateId'];
    this.migrateId = typeof migrateId === 'string'
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(migrateId)
      ? migrateId
      : null;
  }

  onCancel() {
    this.router.navigate(['/login']);
  }

  async onConfirmMigrate() {
    if (!this.migrateId || this.isConfirming) return;

    this.isConfirming = true;
    this.loadingService.addToFetchList(Constants.dataIds.MIGRATE_UPDATE);
    try {
      await lastValueFrom(this.apiService.put(`migrate/${this.migrateId}`, {}));
      this.toastService.addMessage(
        'Migration confirmed',
        '',
        ToastTypes.SUCCESS
      );
      this.authService.loginWithProvider('bcsc');
    } catch (error) {
      this.loggerService.error(error);
      this.toastService.addMessage(
        this.errorMessage(error),
        `Migration failed`,
        ToastTypes.ERROR
      );
    } finally {
      this.isConfirming = false;
      this.loadingService.removeFromFetchList(Constants.dataIds.MIGRATE_UPDATE);
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.error && typeof error.error === 'object') {
      const response = error.error as Record<string, unknown>;
      for (const key of ['msg', 'message', 'error', 'Message']) {
        if (typeof response[key] === 'string') return response[key];
      }
    }
    if (error instanceof Error && error.message) return error.message;
    return 'An unexpected error occurred. Please try again.';
  }
}
