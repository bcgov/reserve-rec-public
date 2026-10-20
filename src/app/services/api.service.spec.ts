import { TestBed } from '@angular/core/testing';
import { HttpHeaders, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideToastr } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';

import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { ConfigService } from './config.service';

describe('ApiService', () => {
  let service: ApiService;
  let auth: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ConfigService, provideToastr()]
    });
    service = TestBed.inject(ApiService);
    auth = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    service.apiPath = '/api';
    service.networkStatus = true;
    (service as any).headers = new HttpHeaders({ 'Content-Type': 'application/json' });
  });

  afterEach(() => httpMock.verify());

  async function flushGet() {
    const result = firstValueFrom(service.get('x'));
    await new Promise(r => setTimeout(r));
    const req = httpMock.expectOne('/api/x?');
    req.flush({});
    await result;
    return req.request;
  }

  it('should refresh before the request when the token is near expiry', async () => {
    const getFresh = spyOn(auth, 'getFreshToken').and.resolveTo('renewed');

    const request = await flushGet();

    expect(getFresh).toHaveBeenCalled();
    expect(request.headers.get('Authorization')).toBe('Bearer renewed');
  });

  it('should send the stored token without refreshing when it is fresh', async () => {
    auth.jwtToken = 'current';
    auth.session.set({ tokens: { accessToken: { payload: { exp: Date.now() / 1000 + 600 } } } } as any);
    const refresh = spyOn(auth, 'setRefresh').and.resolveTo();

    const request = await flushGet();

    expect(refresh).not.toHaveBeenCalled();
    expect(request.headers.get('Authorization')).toBe('Bearer current');
  });

  it('should refresh with force when the stored token is near expiry', async () => {
    auth.jwtToken = 'stale';
    auth.session.set({ tokens: { accessToken: { payload: { exp: Date.now() / 1000 + 10 } } } } as any);
    const refresh = spyOn(auth, 'setRefresh').and.callFake(async () => {
      auth.jwtToken = 'renewed';
    });

    const request = await flushGet();

    expect(refresh).toHaveBeenCalledOnceWith(true);
    expect(request.headers.get('Authorization')).toBe('Bearer renewed');
  });

  it('should send no Authorization header when signed out', async () => {
    (service as any).headers = (service as any).headers.set('Authorization', 'Bearer old');
    auth.jwtToken = null;

    const request = await flushGet();

    expect(request.headers.has('Authorization')).toBeFalse();
  });
});
