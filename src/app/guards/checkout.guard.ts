import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})

// Prevents direct access to the reserve page
export class CheckoutGuard implements CanActivate {
  constructor(private router: Router) { }

  async canActivate(): Promise<boolean> {
    // If direct navigation OR the first segment of the URL is not 'activity' (coming from activity select page), redirect to home
    const firstSegment = this.router.url.split('/')[1];
    if (this.router.url === '/' || firstSegment !== 'activity') {
      this.router.navigate(['/']);
      return false;
    }
    return true; // Allow access to the reserve page if not directly accessed

  }
}