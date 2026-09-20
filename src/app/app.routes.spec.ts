import { Route } from '@angular/router';
import { routes } from './app.routes';
import { UserGuard } from './guards/user.guard';

// Booking workflow pages must never be reachable while signed out.
// (Ref bcgov/reserve-rec-public#829.)
describe('app routes', () => {
  const guardedPaths = [
    'cart',
    'checkout',
    'reservation-flow',
    'booking/:id',
    'booking-confirmation/:bookingId',
  ];

  guardedPaths.forEach(path => {
    it(`protects /${path} with UserGuard`, () => {
      const route = routes.find((r: Route) => r.path === path);
      expect(route).withContext(`route ${path} is missing`).toBeDefined();
      expect(route?.canActivate).toContain(UserGuard);
    });
  });
});
