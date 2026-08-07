import { TestBed } from '@angular/core/testing';
import { Router, RouterStateSnapshot, ActivatedRouteSnapshot } from '@angular/router';

import { WaitingRoomGuard } from './waiting-room.guard';
import { AuthService } from '../services/auth.service';
import { CartService } from '../services/cart.service';
import { WaitingRoomService } from '../services/waiting-room.service';

describe('WaitingRoomGuard', () => {
  let guard: WaitingRoomGuard;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let waitingRoomServiceSpy: jasmine.SpyObj<WaitingRoomService>;
  let cartServiceSpy: { items: jasmine.Spy };
  let redirectSpy: jasmine.Spy;

  const route = {} as ActivatedRouteSnapshot;
  const state = { url: '/checkout' } as RouterStateSnapshot;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['getCurrentUser']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    waitingRoomServiceSpy = jasmine.createSpyObj('WaitingRoomService',
      ['hasValidAdmission', 'buildWaitingRoomUrl'],
      { mode2Active: () => true });
    cartServiceSpy = { items: jasmine.createSpy('items').and.returnValue([]) };

    // Mode 2 gate is checked first in the guard, so drive tests through it —
    // it exercises the same isAuthenticatedOrRedirected() branch as Mode 1 without needing
    // cart fixtures.
    waitingRoomServiceSpy.hasValidAdmission.and.returnValue(false);
    waitingRoomServiceSpy.buildWaitingRoomUrl.and.returnValue('/waitingroom.html?collectionId=MODE2');

    sessionStorage.removeItem('wr_bypass_guard');
    sessionStorage.removeItem('returnUrl');

    TestBed.configureTestingModule({
      providers: [
        WaitingRoomGuard,
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: CartService, useValue: cartServiceSpy },
        { provide: WaitingRoomService, useValue: waitingRoomServiceSpy },
      ],
    });

    guard = TestBed.inject(WaitingRoomGuard);

    // window.location.href is a non-configurable property in real Chrome —
    // it can't be spied on or swapped out, and assigning it for real would
    // navigate the test runner away from the test page. The guard's redirect
    // call is isolated behind the private redirectTo() method for exactly
    // this reason; spy on that instead of touching window.location.
    redirectSpy = spyOn<any>(guard, 'redirectTo').and.stub();
  });

  it('unauthenticated: returns false, stashes returnUrl, navigates to /login', () => {
    authServiceSpy.getCurrentUser.and.returnValue(null);

    const result = guard.canActivate(route, state);

    expect(result).toBeFalse();
    expect(sessionStorage.getItem('returnUrl')).toBe('/checkout');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reason: 'waiting-room' } });
    expect(redirectSpy).not.toHaveBeenCalled();
  });

  it('authenticated: falls through to the waiting-room redirect', () => {
    authServiceSpy.getCurrentUser.and.returnValue({ username: 'test-user' });

    const result = guard.canActivate(route, state);

    expect(result).toBeFalse();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
    expect(waitingRoomServiceSpy.buildWaitingRoomUrl).toHaveBeenCalled();
    expect(redirectSpy).toHaveBeenCalledWith('/waitingroom.html?collectionId=MODE2');
  });
});
