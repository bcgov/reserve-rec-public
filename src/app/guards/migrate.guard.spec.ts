import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Navigation,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { migrateGuard } from './migrate.guard';

describe('migrateGuard', () => {
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('Router', ['currentNavigation', 'createUrlTree']);
    router.currentNavigation.and.returnValue(null);
    router.createUrlTree.and.returnValue({} as UrlTree);
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: router }],
    });
  });

  it('allows a valid migration ID from navigation state', () => {
    const urlTree = {} as UrlTree;
    router.currentNavigation.and.returnValue({
      id: 1,
      initialUrl: urlTree,
      extractedUrl: urlTree,
      trigger: 'imperative',
      extras: { state: { migrateId: '4e707c5a-68f1-4728-b09e-2b5b691b86e6' } },
      previousNavigation: null,
      abort: () => undefined,
    } satisfies Navigation);

    const result = TestBed.runInInjectionContext(() => migrateGuard(
      {} as ActivatedRouteSnapshot,
      {} as RouterStateSnapshot,
    ));

    expect(result).toBe(true);
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });

  it('allows a valid migration ID from browser history state', () => {
    window.history.replaceState(
      { migrateId: '4e707c5a-68f1-4728-b09e-2b5b691b86e6' },
      '',
      '/',
    );

    const result = TestBed.runInInjectionContext(() => migrateGuard(
      {} as ActivatedRouteSnapshot,
      {} as RouterStateSnapshot,
    ));

    expect(result).toBe(true);
  });

  it('redirects when the migration ID is missing or malformed', () => {
    window.history.replaceState({ migrateId: 'not-a-uuid' }, '', '/');
    const redirect = {} as UrlTree;
    router.createUrlTree.and.returnValue(redirect);

    const result = TestBed.runInInjectionContext(() => migrateGuard(
      {} as ActivatedRouteSnapshot,
      {} as RouterStateSnapshot,
    ));

    expect(result).toBe(redirect);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/']);
  });
});
