import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { UserGuard } from './user.guard';
import { AuthService } from '../services/auth.service';

describe('UserGuard', () => {
  function setup(user: any) {
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { getCurrentUser: async () => user } },
        { provide: Router, useValue: router },
      ],
    });
    return { guard: TestBed.inject(UserGuard), router };
  }
  const state = { url: '/account' } as RouterStateSnapshot;

  afterEach(() => sessionStorage.removeItem('returnUrl'));

  it('lets a signed-in user through', async () => {
    const { guard, router } = setup({ sub: 'sub-1' });

    expect(await guard.canActivate({} as ActivatedRouteSnapshot, state)).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  // The login guard only keeps a saved page when told to (#989).
  it('saves the page and tells login to keep it', async () => {
    const { guard, router } = setup(null);

    expect(await guard.canActivate({} as ActivatedRouteSnapshot, state)).toBeFalse();
    expect(sessionStorage.getItem('returnUrl')).toBe('/account');
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { state: { keepReturnUrl: true } });
  });
});
