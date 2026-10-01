import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';
import { ConfigService } from './config.service';
import { LoggerService } from './logger.service';
import { ToastService, ToastTypes } from './toast.service';
import { HttpClient, HttpHandler } from '@angular/common/http';
import { provideToastr } from 'ngx-toastr';
import { Hub } from 'aws-amplify/utils';

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
});
