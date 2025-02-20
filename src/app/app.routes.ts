import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./home/home.component').then(mod => mod.HomeComponent) },
  { path: 'login', loadComponent: () => import('./login/login.component').then(mod => mod.LoginComponent) },
  { path: 'search', loadComponent: () => import('./search/search.component').then(mod => mod.SearchComponent) },
  { path: 'facility/:orcs/:facilityType/:identifier', loadComponent: () => import('./facility-details/facility-details.component').then(mod => mod.FacilityDetailsComponent) },
  { path: 'activity/:orcs/:activityType/:identifier', loadComponent: () => import('./activity-details/activity-details.component').then(mod => mod.ActivityDetailsComponent) }
];