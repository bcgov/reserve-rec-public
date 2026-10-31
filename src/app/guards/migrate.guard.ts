import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const migrateGuard: CanActivateFn = () => {
  const router = inject(Router);

  // Check router navigation state first, fallback to history state
  const navState = router.currentNavigation()?.extras?.state || window.history.state;
  const migrateId = navState?.['migrateId'];

  const isValid = typeof migrateId === 'string' && UUID_REGEX.test(migrateId);

  if (isValid) {
    return true;
  }

  // Redirect back to home and block route activation
  return router.createUrlTree(['/']);
};
