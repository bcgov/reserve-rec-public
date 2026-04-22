import { Routes } from '@angular/router';
import { UserGuard } from './guards/user.guard';
import { UserResolver } from './resolvers/user.resolver';
import { CheckoutGuard } from './guards/checkout.guard';
import { WaitingRoomGuard } from './guards/waiting-room.guard';
import { FacilityResolver } from './resolvers/facility.resolver';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./home/home.component')
      .then(mod => mod.HomeComponent)
  },
  {
    path: 'account',
    loadComponent: () => import('./account/account.component')
      .then(mod => mod.AccountComponent)
  },
  {
    path: 'account/bookings/:id',
    loadComponent: () => import('./my-bookings/booking-details/booking-details.component')
      .then(m => m.BookingDetailsComponent),
    data: { 
      breadcrumb: 'Booking Details',
      parentBreadcrumb: { label: 'My Bookings', url: '/my-bookings' }
    }
  },
  {
    path: 'account/bookings/cancel/:id',
    loadComponent: () => import('./my-bookings/bookings-cancel/booking-cancel.component')
      .then(m => m.BookingCancelComponent)
  },
  {
    path: 'account-details',
    loadComponent: () => import('./account-details/account-details.component')
      .then(mod => mod.AccountDetailsComponent)
  },
  // {
  //   path: 'activity/:collectionId/:activityType/:identifier',
  //   loadComponent: () => import('./activity-details/activity-details.component')
  //     .then(mod => mod.ActivityDetailsComponent)
  // },
  {
    path: 'booking-confirmation/:bookingId',
    loadComponent: () => import('./booking-confirmation/booking-confirmation.component')
      .then(mod => mod.BookingConfirmationComponent),
    data: { breadcrumb: 'Booking Confirmation' }
  },
  {
    path: 'booking/:id',
    loadComponent: () => import('./my-bookings/booking-details/booking-details.component')
      .then(mod => mod.BookingDetailsComponent)
  },
  {
    path: 'cart',
    loadComponent: () => import('./cart/cart.component')
      .then(mod => mod.CartComponent),
    canActivate: [WaitingRoomGuard],
    data: { skipBreadcrumb: true }
  },
  {
    path: 'checkout',
    loadComponent: () => import('./reservation-flow/reservation-flow.component')
      .then(mod => mod.ReservationFlowComponent),
    canActivate: [CheckoutGuard, WaitingRoomGuard],
    data: { breadcrumb: 'Checkout' }
  },
  {
    path: 'facility/:collectionId/:facilityType/:facilityId',
    loadComponent: () => import('./facility-details/facility-details.component')
      .then(mod => mod.FacilityDetailsComponent),
    resolve: { facility: FacilityResolver },
    runGuardsAndResolvers: 'always',
    canActivate: [WaitingRoomGuard],
    data: { breadcrumb: 'Facility Details' }
  },
  {
    path: 'find-booking',
    loadComponent: () => import('./find-booking/find-booking.component')
      .then(mod => mod.FindBookingComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./login/login.component')
      .then(mod => mod.LoginComponent)
  },
  {
    path: 'my-bookings',
    loadComponent: () => import('./my-bookings/my-bookings.component')
      .then(mod => mod.MyBookingsComponent),
    canActivate: [UserGuard],
    resolve: { user: UserResolver },
    data: { breadcrumb: 'My Bookings' }
  },
  {
    path: 'payment-retry',
    loadComponent: () => import('./payment-retry/payment-retry.component')
      .then(mod => mod.PaymentRetryComponent)
  },
  {
    path: 'reservation-flow',
    loadComponent: () => import('./reservation-flow/reservation-flow.component')
      .then(mod => mod.ReservationFlowComponent),
    canActivate: [CheckoutGuard, WaitingRoomGuard],
    data: { breadcrumb: 'Checkout' }
  },
  {
    path: 'results',
    loadComponent: () => import('./search-results/search-results.component')
      .then(mod => mod.SearchResultsComponent)
  },
  {
    path: 'search',
    loadComponent: () => import('./search-page/search-page.component')
      .then(mod => mod.SearchPageComponent)
  },
  {
    path: 'transaction-status',
    loadComponent: () => import('./transaction-status/transaction-status.component')
      .then(mod => mod.TransactionStatusComponent),
    canActivate: [UserGuard]
  },
  { 
    path: '**',
    redirectTo: '/',
    pathMatch: 'full'
  }
];
