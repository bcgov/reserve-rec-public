import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { CartService } from '../services/cart.service';
@Injectable({
  providedIn: 'root',
})

// Prevents direct access to the reserve page
export class CheckoutGuard implements CanActivate {
  constructor(private router: Router, private cartService: CartService) { }

    async canActivate(): Promise<boolean> {
    // Allow access if cart has items
    const hasCartItems = this.cartService.items().length > 0;
    
    if (hasCartItems) {
      return true;
    }
    
    // If no cart items, redirect to home
    console.log('No cart items found, redirecting to home');
    this.router.navigate(['/']);
    return false;
  }
}