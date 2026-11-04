import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MigrateComponent } from './migrate.component';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { LoadingService } from '../services/loading.service';
import { LoggerService } from '../services/logger.service';
import { ToastService } from '../services/toast.service';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';

describe('MigrateComponent', () => {
  let component: MigrateComponent;
  let fixture: ComponentFixture<MigrateComponent>;
  const apiService = jasmine.createSpyObj<ApiService>('ApiService', ['put']);
  const authService = jasmine.createSpyObj<AuthService>('AuthService', ['loginWithProvider']);
  const loadingService = jasmine.createSpyObj<LoadingService>('LoadingService', ['addToFetchList', 'removeFromFetchList']);
  const loggerService = jasmine.createSpyObj<LoggerService>('LoggerService', ['error']);
  const toastService = jasmine.createSpyObj<ToastService>('ToastService', ['addMessage']);
  const router = jasmine.createSpyObj<Router>('Router', ['currentNavigation', 'navigate']);

  beforeEach(async () => {
    apiService.put.calls.reset();
    authService.loginWithProvider.calls.reset();
    loadingService.addToFetchList.calls.reset();
    loadingService.removeFromFetchList.calls.reset();
    loggerService.error.calls.reset();
    toastService.addMessage.calls.reset();
    router.navigate.calls.reset();
    apiService.put.and.returnValue(of({}));
    router.currentNavigation.and.returnValue(null);
    window.history.replaceState(
      { migrateId: '4e707c5a-68f1-4728-b09e-2b5b691b86e6' },
      '',
      '/',
    );
    await TestBed.configureTestingModule({
      imports: [MigrateComponent],
      providers: [
        { provide: ApiService, useValue: apiService },
        { provide: AuthService, useValue: authService },
        { provide: LoadingService, useValue: loadingService },
        { provide: LoggerService, useValue: loggerService },
        { provide: ToastService, useValue: toastService },
        { provide: Router, useValue: router },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(MigrateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.migrateId).toBe('4e707c5a-68f1-4728-b09e-2b5b691b86e6');
  });

  it('confirms using the in-memory navigation state and starts BCSC login', async () => {
    await component.onConfirmMigrate();

    expect(apiService.put).toHaveBeenCalledWith(
      'migrate/4e707c5a-68f1-4728-b09e-2b5b691b86e6',
      {},
    );
    expect(authService.loginWithProvider).toHaveBeenCalledWith('bcsc');
    expect(loadingService.removeFromFetchList).toHaveBeenCalled();
  });

  it('cancels without confirming a migration', () => {
    component.onCancel();

    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(apiService.put).not.toHaveBeenCalled();
  });

  it('shows API errors and resets the loading state when confirmation fails', async () => {
    apiService.put.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 409,
      error: { msg: 'This migration can no longer be confirmed.' },
    })));

    await component.onConfirmMigrate();

    expect(loggerService.error).toHaveBeenCalled();
    expect(toastService.addMessage).toHaveBeenCalledWith(
      'This migration can no longer be confirmed.',
      'Migration failed',
      jasmine.anything(),
    );
    expect(authService.loginWithProvider).not.toHaveBeenCalled();
    expect(component.isConfirming).toBe(false);
    expect(loadingService.removeFromFetchList).toHaveBeenCalledWith('migrateUpdate');
  });

  it('does not send duplicate confirmations while a request is active', async () => {
    component.isConfirming = true;

    await component.onConfirmMigrate();

    expect(apiService.put).not.toHaveBeenCalled();
    expect(loadingService.addToFetchList).not.toHaveBeenCalled();
  });

  it('rejects invalid migration IDs and skips confirmation', async () => {
    window.history.replaceState({ migrateId: 'not-a-uuid' }, '', '/');
    const componentWithInvalidId = new MigrateComponent(
      apiService,
      authService,
      loadingService,
      loggerService,
      toastService,
      router,
    );

    expect(componentWithInvalidId.migrateId).toBeNull();
    await componentWithInvalidId.onConfirmMigrate();
    expect(apiService.put).not.toHaveBeenCalled();
  });
});
