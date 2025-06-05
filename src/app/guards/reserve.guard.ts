import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})

// Prevents direct access to the reserve page
export class ReserveGuard implements CanActivate {
  constructor(private router: Router) { }

  async canActivate(): Promise<boolean> {
    if (this.router.url === '/') {
      this.router.navigate(['/']);
      return false;
    }
    return true; // Allow access to the reserve page if not directly accessed

  }
}