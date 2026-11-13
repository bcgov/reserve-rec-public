import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_REGEX = /^[A-Za-z0-9_-]{43}$/;

@Component({
  selector: 'app-migration-confirm',
  imports: [],
  templateUrl: './migration-confirm.component.html',
})
export class MigrationConfirmComponent implements OnInit {
  isConfirming = false;
  confirmed = false;
  status = '';
  message = '';
  errorMessage = '';
  private migrateId = '';
  private token = '';

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService,
    private authService: AuthService,
  ) {}

  ngOnInit() {
    const fragment = new URLSearchParams(this.route.snapshot.fragment || '');
    this.migrateId = fragment.get('migrateId') || '';
    this.token = fragment.get('token') || '';
    if (!UUID_REGEX.test(this.migrateId) || !TOKEN_REGEX.test(this.token)) {
      this.errorMessage = 'This migration confirmation link is invalid.';
      return;
    }
    void this.confirmMigration();
  }

  async confirmMigration() {
    if (this.isConfirming || !UUID_REGEX.test(this.migrateId) || !TOKEN_REGEX.test(this.token)) return;
    this.isConfirming = true;
    this.errorMessage = '';
    try {
      const confirmation = await lastValueFrom(this.apiService.post('migrate/confirm', {
        migrateId: this.migrateId,
        token: this.token,
      }));
      this.message = confirmation.msg;
      this.status = confirmation.data?.status || '';
      this.confirmed = true;
      await this.authService.migrateLogout();
    } catch (error) {
      this.errorMessage = this.readError(error);
    } finally {
      this.isConfirming = false;
    }
  }

  async onConfirmMigrate() {
    this.authService.loginWithProvider('bcsc');
  }

  private readError(error: unknown): string {
    const response = (error as { error?: Record<string, unknown> })?.error;
    for (const key of ['msg', 'message', 'error', 'Message']) {
      const message = response?.[key];
      if (typeof message === 'string') return message;
    }
    if (error instanceof Error && error.message) return error.message;
    return 'We could not confirm this migration. Please try again or request a new email.';
  }
}
