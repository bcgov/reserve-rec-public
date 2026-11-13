import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';
import { ConfigService } from './config.service';
import { LoggerService } from './logger.service';
import { HttpClient, HttpHandler } from '@angular/common/http';
import { provideToastr } from 'ngx-toastr';
import { Hub } from 'aws-amplify/utils';
import { Amplify } from 'aws-amplify';
import { Router } from '@angular/router';
import { LoadingService } from './loading.service';
import { Constants } from '../constants';
import { FeatureFlagService } from './feature-flag.service';
import { ToastService, ToastTypes } from './toast.service';

describe('AuthService', () => {
  let service: AuthService;
  let loggerService: LoggerService;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HttpClient, HttpHandler, ConfigService, provideToastr()]
    });
    service = TestBed.inject(AuthService);
    loggerService = TestBed.inject(LoggerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('formats Cognito PreSignUp refusal messages and normalizes trailing periods', () => {
    expect(service.refusalMessage(
      'OAuthSignInException: PreSignUp failed with error Duplicate account...'
    )).toBe('Duplicate account.');
    expect(service.refusalMessage('A different error')).toBe('');
  });

  it('routes migration prompts using navigation state without exposing the ID in the URL or logs', async () => {
    let authListener: (capsule: any) => Promise<void>;
    spyOn(Hub, 'listen').and.callFake(((_channel: string, listener: any) => {
      authListener = listener;
      return () => undefined;
    }) as any);
    const logError = spyOn(loggerService, 'error');
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const addToast = spyOn(TestBed.inject(ToastService), 'addMessage');
    spyOn(TestBed.inject(FeatureFlagService), 'isEnabled').and.returnValue(true);

    await (service as any).listenToAuthEvents();
    const migrateId = '4e707c5a-68f1-4728-b09e-2b5b691b86e6';
    await authListener({
      payload: {
        event: 'signInWithRedirect_failure',
        data: {
          error: Object.assign(new Error(`PreSignUp failed with error A BC Parks account with this email address already exists.$${migrateId}.`), {
            name: 'OAuthSignInException'
          })
        }
      }
    });

    expect(navigate).toHaveBeenCalledWith(['/migrate'], { state: { migrateId } });
    expect(addToast).toHaveBeenCalledWith(
      'A BC Parks account with this email address already exists.',
      'Login failed',
      ToastTypes.WARNING,
    );
    expect(logError).toHaveBeenCalledWith(jasmine.any(String));
    expect(JSON.stringify(logError.calls.allArgs())).not.toContain(migrateId);
  });

  it('routes the explicit migration refusal code without relying on the human-readable message', async () => {
    let authListener: (capsule: any) => Promise<void>;
    spyOn(Hub, 'listen').and.callFake(((_channel: string, listener: any) => {
      authListener = listener;
      return () => undefined;
    }) as any);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const addToast = spyOn(TestBed.inject(ToastService), 'addMessage');
    spyOn(TestBed.inject(FeatureFlagService), 'isEnabled').and.returnValue(true);

    await (service as any).listenToAuthEvents();
    const migrateId = '4e707c5a-68f1-4728-b09e-2b5b691b86e6';
    await authListener({
      payload: {
        event: 'signInWithRedirect_failure',
        data: {
          error: `PreSignUp failed with error $BCPARKS_MIGRATION_REQUIRED:${migrateId}.`,
        },
      },
    });

    expect(navigate).toHaveBeenCalledWith(['/migrate'], { state: { migrateId } });
    expect(addToast).toHaveBeenCalledWith('', 'Login failed', ToastTypes.WARNING);
  });

  it('shows a warning toast for a duplicate account without a migration ID', async () => {
    let authListener: (capsule: any) => Promise<void>;
    spyOn(Hub, 'listen').and.callFake(((_channel: string, listener: any) => {
      authListener = listener;
      return () => undefined;
    }) as any);
    const addToast = spyOn(TestBed.inject(ToastService), 'addMessage');
    spyOn(TestBed.inject(FeatureFlagService), 'isEnabled').and.returnValue(true);

    await (service as any).listenToAuthEvents();
    await authListener({
      payload: {
        event: 'signInWithRedirect_failure',
        data: {
          error: Object.assign(new Error(
            'PreSignUp failed with error A BC Parks account with this email address already exists.'
          ), { name: 'OAuthSignInException' }),
        },
      },
    });

    expect(addToast).toHaveBeenCalledWith(
      'A BC Parks account with this email address already exists.',
      'Login failed',
      ToastTypes.WARNING,
    );
  });

  it('shows an error toast when the migration fails after signup', async () => {
    let authListener: (capsule: any) => Promise<void>;
    spyOn(Hub, 'listen').and.callFake(((_channel: string, listener: any) => {
      authListener = listener;
      return () => undefined;
    }) as any);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const addToast = spyOn(TestBed.inject(ToastService), 'addMessage');
    spyOn(TestBed.inject(FeatureFlagService), 'isEnabled').and.returnValue(true);

    await (service as any).listenToAuthEvents();
    await authListener({
      payload: {
        event: 'signInWithRedirect_failure',
        data: { error: 'OAuthSignInException: PostConfirmation failed with error migration failed' },
      },
    });

    expect(addToast).toHaveBeenCalledWith(
      'We could not complete your account migration. Please try signing in again.',
      'Login failed',
      ToastTypes.ERROR,
    );
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  // Without this the login page sat empty with no way forward (#989).
  it('should log out, explain, and drop the overlay when finishing sign-in fails', async () => {
    let authListener: (capsule: any) => Promise<void>;
    spyOn(Hub, 'listen').and.callFake(((_channel: string, listener: any) => {
      authListener = listener;
      return () => undefined;
    }) as any);
    const addMessage = spyOn(TestBed.inject(ToastService), 'addMessage');
    const logError = spyOn(loggerService, 'error');
    const logout = spyOn(service, 'logout').and.resolveTo();
    const loading = TestBed.inject(LoadingService);

    await (service as any).listenToAuthEvents();
    // Amplify isn't configured in tests, so fetchUserAttributes rejects.
    await authListener({ payload: { event: 'signedIn' } });

    expect(logError).toHaveBeenCalled();
    expect(addMessage).toHaveBeenCalledWith(Constants.loginIncompleteMessage, 'Login failed', ToastTypes.ERROR);
    expect(logout).toHaveBeenCalled();
    expect(loading.isLoading()).toBeFalse();
  });

  it('should finish init when a redirect sign-in fails while the first sign-in check hangs', async () => {
    const listeners: ((capsule: any) => void)[] = [];
    spyOn(Hub, 'listen').and.callFake(((_channel: string, listener: any) => {
      listeners.push(listener);
      return () => undefined;
    }) as any);
    spyOn(Amplify, 'configure');
    const check = spyOn(service, 'checkIfSignedIn').and.returnValues(new Promise<void>(() => undefined), Promise.resolve());

    const init = service.init();
    listeners.forEach((listener) => listener({ payload: { event: 'signInWithRedirect_failure', data: {} } }));
    await init;

    expect(check).toHaveBeenCalledTimes(2);
  });

  it('should log out when the session has no tokens left', async () => {
    const logout = spyOn(service, 'logout').and.resolveTo();
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    await service.setRefresh(true);

    expect(logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  describe('getFreshToken', () => {
    const sessionWithExp = (secondsLeft: number) => ({
      tokens: { accessToken: { payload: { exp: Date.now() / 1000 + secondsLeft } } }
    });

    it('should return null without refreshing when signed out', async () => {
      const refresh = spyOn(service, 'setRefresh').and.resolveTo();

      expect(await service.getFreshToken()).toBeNull();
      expect(refresh).not.toHaveBeenCalled();
    });

    it('should return the stored token when it has plenty of life left', async () => {
      service.jwtToken = 'current';
      service.session.set(sessionWithExp(600) as any);
      const refresh = spyOn(service, 'setRefresh').and.resolveTo();

      expect(await service.getFreshToken()).toBe('current');
      expect(refresh).not.toHaveBeenCalled();
    });

    it('should force a refresh and return the new token when the token is near expiry', async () => {
      service.jwtToken = 'stale';
      service.session.set(sessionWithExp(30) as any);
      const refresh = spyOn(service, 'setRefresh').and.callFake(async () => {
        service.jwtToken = 'renewed';
      });

      expect(await service.getFreshToken()).toBe('renewed');
      expect(refresh).toHaveBeenCalledOnceWith(true);
    });

    it('should return null when the refresh logs the user out', async () => {
      service.jwtToken = 'stale';
      service.session.set(sessionWithExp(-5) as any);
      spyOn(service, 'setRefresh').and.callFake(async () => {
        service.jwtToken = null;
      });

      expect(await service.getFreshToken()).toBeNull();
    });

    it('should share one refresh between concurrent callers', async () => {
      service.jwtToken = 'stale';
      service.session.set(sessionWithExp(0) as any);
      const refresh = spyOn(service, 'setRefresh').and.callFake(async () => {
        service.jwtToken = 'renewed';
      });

      await Promise.all([service.getFreshToken(), service.getFreshToken()]);

      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });
});
