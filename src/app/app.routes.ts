import { Routes } from '@angular/router';
import { UserGuard } from './guards/user.guard';
import { UserResolver } from './resolvers/user.resolver';
import { CheckoutGuard } from './guards/checkout.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./home/home.component').then(mod => mod.HomeComponent) },
  { path: 'login', loadComponent: () => import('./login/login.component').then(mod => mod.LoginComponent) },
  { path: 'results', loadComponent: () => import('./search-results/search-results.component').then(mod => mod.SearchResultsComponent) },
  { path: 'search', loadComponent: () => import('./search-page/search-page.component').then(mod => mod.SearchPageComponent) },
  { path: 'protected-area/:orcs', loadComponent: () => import('./protected-area-details/protected-area-details.component').then(mod => mod.ProtectedAreaDetailsComponent) },
  { path: 'facility/:collectionId/:facilityType/:identifier', loadComponent: () => import('./facility-details/facility-details.component').then(mod => mod.FacilityDetailsComponent) },
  { path: 'activity/:collectionId/:activityType/:identifier', loadComponent: () => import('./activity-details/activity-details.component').then(mod => mod.ActivityDetailsComponent) },
  { path: 'account', loadComponent: () => import('./account/account.component').then(mod => mod.AccountComponent), canActivate: [UserGuard] },
  { path: 'account-details', loadComponent: () => import('./account-details/account-details.component').then(mod => mod.AccountDetailsComponent), canActivate: [UserGuard] },
  { path: 'my-bookings', loadComponent: () => import('./my-bookings/my-bookings.component').then(mod => mod.MyBookingsComponent), canActivate: [UserGuard], resolve: {user: UserResolver} },
  { path: 'account/bookings/:id', loadComponent: () => import('./my-bookings/booking-details/booking-details.component').then(m => m.BookingDetailsComponent)
},
  { path: 'checkout', loadComponent: () => import('./reservation-flow/reservation-flow.component').then(mod => mod.ReservationFlowComponent), canActivate: [CheckoutGuard] },
  { path: 'transaction-status', loadComponent: () => import('./transaction-status/transaction-status.component').then(mod => mod.TransactionStatusComponent)},
  { path: 'cart', loadComponent: () => import('./cart/cart.component').then(mod => mod.CartComponent) },
  { path: 'reservation-flow', loadComponent: () => import('./reservation-flow/reservation-flow.component').then(mod => mod.ReservationFlowComponent), canActivate: [CheckoutGuard] },
];
