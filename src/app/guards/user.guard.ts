import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root',
})
export class UserGuard implements CanActivate {
    constructor(private authService: AuthService, private router: Router) {}
  
    async canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean> {
      const user = await this.authService.getCurrentUser();
      if (user) {
        return true; // Allow access if user exists
      } else {
        // Store the return URL in sessionStorage for post-login redirect
        sessionStorage.setItem('returnUrl', state.url);
        this.router.navigate(['/login']);
        return false;
      }
    }
  }