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
});
