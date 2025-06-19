import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})

// Prevents direct access to the reserve page
export class BookingConfirmationGuard implements CanActivate {
  constructor(private router: Router) { }

  async canActivate(): Promise<boolean> {
    // If direct navigation OR the first segment of the URL is not 'checkout' (coming from checkout page), redirect to home
    const firstSegment = this.router.url.split('/')[1].split('?')[0]; // Split to handle query parameters if present
    if (this.router.url === '/' || firstSegment !== 'checkout') {
      this.router.navigate(['/']);
      return false;
    }
    return true; // Allow access to the reserve page if not directly accessed

  }
}