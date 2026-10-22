import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';
import { ConfigService } from './config.service';
import { LoggerService } from './logger.service';
import { ToastService, ToastTypes } from './toast.service';
import { HttpClient, HttpHandler } from '@angular/common/http';
import { provideToastr } from 'ngx-toastr';
import { Hub } from 'aws-amplify/utils';
import { Amplify } from 'aws-amplify';
import { Router } from '@angular/router';

describe('AuthService', () => {
  let service: AuthService;
  let toastService: ToastService;
  let loggerService: LoggerService;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HttpClient, HttpHandler, ConfigService, provideToastr()]
    });
    service = TestBed.inject(AuthService);
    toastService = TestBed.inject(ToastService);
    loggerService = TestBed.inject(LoggerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should show an error toast and log the error when the redirect sign-in fails', async () => {
    let authListener: (capsule: any) => Promise<void>;
    spyOn(Hub, 'listen').and.callFake(((_channel: string, listener: any) => {
      authListener = listener;
      return () => undefined;
    }) as any);
    const addMessage = spyOn(toastService, 'addMessage');
    const logError = spyOn(loggerService, 'error');

    await (service as any).listenToAuthEvents();
    await authListener({
      payload: { event: 'signInWithRedirect_failure', data: { error: new Error('access_denied') } }
    });

    expect(addMessage).toHaveBeenCalledWith(
      'Your BC Services Card login did not finish. Please try again.',
      'Login failed',
      ToastTypes.ERROR
    );
    expect(logError).toHaveBeenCalledWith(jasmine.stringContaining('access_denied'));
  });

  it('should finish init when a redirect sign-in fails while the first sign-in check hangs', async () => {
    const listeners: ((capsule: any) => void)[] = [];
    spyOn(Hub, 'listen').and.callFake(((_channel: string, listener: any) => {
      listeners.push(listener);
      return () => undefined;
    }) as any);
    spyOn(Amplify, 'configure');
    spyOn(toastService, 'addMessage');
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
