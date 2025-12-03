import { Routes } from '@angular/router';
import { UserGuard } from './guards/user.guard';
import { UserResolver } from './resolvers/user.resolver';
import { CheckoutGuard } from './guards/checkout.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./home/home.component').then(mod => mod.HomeComponent) },
  { path: 'account', loadComponent: () => import('./account/account.component').then(mod => mod.AccountComponent) },
  { path: 'account/bookings/:id', loadComponent: () => import('./my-bookings/booking-details/booking-details.component').then(m => m.BookingDetailsComponent)},
  { path: 'account/bookings/cancel/:id', loadComponent: () => import('./my-bookings/bookings-cancel/booking-cancel.component').then(m => m.BookingCancelComponent)},
  { path: 'account-details', loadComponent: () => import('./account-details/account-details.component').then(mod => mod.AccountDetailsComponent) },
  { path: 'activity/:collectionId/:activityType/:identifier', loadComponent: () => import('./activity-details/activity-details.component').then(mod => mod.ActivityDetailsComponent) },
  { path: 'booking-confirmation/:bookingId', loadComponent: () => import('./booking-confirmation/booking-confirmation.component').then(mod => mod.BookingConfirmationComponent) }, 
  { path: 'booking/:id', loadComponent: () => import('./my-bookings/booking-details/booking-details.component').then(mod => mod.BookingDetailsComponent) },
  { path: 'cart', loadComponent: () => import('./cart/cart.component').then(mod => mod.CartComponent) },
  { path: 'checkout', loadComponent: () => import('./reservation-flow/reservation-flow.component').then(mod => mod.ReservationFlowComponent), canActivate: [CheckoutGuard] },
  { path: 'facility/:collectionId/:facilityType/:identifier', loadComponent: () => import('./facility-details/facility-details.component').then(mod => mod.FacilityDetailsComponent) },
  { path: 'find-booking', loadComponent: () => import('./find-booking/find-booking.component').then(mod => mod.FindBookingComponent) },
  { path: 'login', loadComponent: () => import('./login/login.component').then(mod => mod.LoginComponent) },
  { path: 'my-bookings', loadComponent: () => import('./my-bookings/my-bookings.component').then(mod => mod.MyBookingsComponent), canActivate: [UserGuard], resolve: { user: UserResolver } },
  { path: 'protected-area/:orcs', loadComponent: () => import('./protected-area-details/protected-area-details.component').then(mod => mod.ProtectedAreaDetailsComponent) },
  { path: 'reservation-flow', loadComponent: () => import('./reservation-flow/reservation-flow.component').then(mod => mod.ReservationFlowComponent), canActivate: [CheckoutGuard] },
  { path: 'results', loadComponent: () => import('./search-results/search-results.component').then(mod => mod.SearchResultsComponent) },
  { path: 'search', loadComponent: () => import('./search-page/search-page.component').then(mod => mod.SearchPageComponent) },
  { path: 'transaction-status', loadComponent: () => import('./transaction-status/transaction-status.component').then(mod => mod.TransactionStatusComponent)},
];
