import { Routes } from '@angular/router';
import { UserGuard } from './guards/user.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./home/home.component').then(mod => mod.HomeComponent) },
  { path: 'login', loadComponent: () => import('./login/login.component').then(mod => mod.LoginComponent) },
  { path: 'results', loadComponent: () => import('./search-results/search-results.component').then(mod => mod.SearchResultsComponent) },
  { path: 'search', loadComponent: () => import('./search-page/search-page.component').then(mod => mod.SearchPageComponent) },
  { path: 'facility/:orcs/:facilityType/:identifier', loadComponent: () => import('./facility-details/facility-details.component').then(mod => mod.FacilityDetailsComponent) },
  { path: 'activity/:orcs/:activityType/:identifier', loadComponent: () => import('./activity-details/activity-details.component').then(mod => mod.ActivityDetailsComponent) },
  { path: 'account', loadComponent: () => import('./account/account.component').then(mod => mod.AccountComponent), canActivate: [UserGuard] },
  { path: 'account-details', loadComponent: () => import('./account-details/account-details.component').then(mod => mod.AccountDetailsComponent), canActivate: [UserGuard] },
  { path: 'my-bookings', loadComponent: () => import('./my-bookings/my-bookings.component').then(mod => mod.MyBookingsComponent), canActivate: [UserGuard] },
];
