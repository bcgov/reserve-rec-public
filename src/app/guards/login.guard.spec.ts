import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { LoginGuard } from './login.guard';
import { AuthService } from '../services/auth.service';

describe('LoginGuard', () => {
  // A session started in another tab is in Amplify's storage, but this tab's
  // user signal is still empty until it asks Amplify again (#796).
  function setup(signedInElsewhere: boolean, signal: any = null) {
    let checks = 0;
    let refreshes = 0;
    const user = { value: signal };
    const authService = {
      user: () => user.value,
      checkIfSignedIn: async () => {
        checks++;
        user.value = signedInElsewhere ? { sub: 'sub-1' } : null;
      },
      setRefresh: async () => { refreshes++; },
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: authService }],
    });
    return { guard: TestBed.inject(LoginGuard), router: TestBed.inject(Router), checks: () => checks, refreshes: () => refreshes };
  }

  it('sends a user signed in from another tab to the landing page', async () => {
    const { guard, router, refreshes } = setup(true);

    const result = await guard.canActivate();

    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/');
    // Without this the API gets the identity-pool token, not the access token.
    expect(refreshes()).toBe(1);
  });

  it('shows the login page when there is no session', async () => {
    const { guard, refreshes } = setup(false);

    expect(await guard.canActivate()).toBe(true);
    expect(refreshes()).toBe(0);
  });

  it('skips the session lookup when this tab already knows the user', async () => {
    const { guard, router, checks } = setup(true, { sub: 'sub-1' });

    const result = await guard.canActivate();

    expect(router.serializeUrl(result as UrlTree)).toBe('/');
    expect(checks()).toBe(0);
  });

  // A plain Log in link saves nothing, so sign-in landed on home (#989).
  describe('return to the page the user left', () => {
    beforeEach(() => sessionStorage.removeItem('returnUrl'));
    afterEach(() => sessionStorage.removeItem('returnUrl'));

    it('remembers the page the Log in link was clicked on', async () => {
      const { guard, router } = setup(false);
      spyOnProperty(router, 'url').and.returnValue('/facility/bcparks_7/structure/1');

      await guard.canActivate();

      expect(sessionStorage.getItem('returnUrl')).toBe('/facility/bcparks_7/structure/1');
    });

    it('keeps the page a protected route already saved', async () => {
      const { guard, router } = setup(false);
      sessionStorage.setItem('returnUrl', '/checkout');
      spyOnProperty(router, 'url').and.returnValue('/facility/bcparks_7/structure/1');
      spyOn(router, 'getCurrentNavigation').and.returnValue({ extras: { state: { keepReturnUrl: true } } } as any);

      await guard.canActivate();

      expect(sessionStorage.getItem('returnUrl')).toBe('/checkout');
    });

    it('replaces the page an abandoned Log in click saved', async () => {
      const { guard, router } = setup(false);
      sessionStorage.setItem('returnUrl', '/facility/bcparks_7/structure/1');
      spyOnProperty(router, 'url').and.returnValue('/facility/bcparks_8/structure/2');

      await guard.canActivate();

      expect(sessionStorage.getItem('returnUrl')).toBe('/facility/bcparks_8/structure/2');
    });

    it('clears an old page when Log in is clicked from home', async () => {
      const { guard } = setup(false);
      sessionStorage.setItem('returnUrl', '/facility/bcparks_7/structure/1');

      await guard.canActivate();

      expect(sessionStorage.getItem('returnUrl')).toBeNull();
    });

    it('saves nothing when the user is already signed in', async () => {
      const { guard, router } = setup(true);
      spyOnProperty(router, 'url').and.returnValue('/facility/bcparks_7/structure/1');

      await guard.canActivate();

      expect(sessionStorage.getItem('returnUrl')).toBeNull();
    });
  });
});
