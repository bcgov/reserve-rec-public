import { Component, OnInit } from '@angular/core';

import { Router } from '@angular/router';
import { CartService } from '../services/cart.service';
import { CartItemComponent } from './cart-item/cart-item.component'; // Add import
import { FeatureFlagService } from '../services/feature-flag.service';
import { BreadcrumbComponent } from "../shared/breadcrumb/breadcrumb.component";

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CartItemComponent, BreadcrumbComponent], 
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss'
})
export class CartComponent implements OnInit {
  public paymentsEnabled;

  constructor(
    public cartService: CartService,
    public featureFlagService: FeatureFlagService,
    private router: Router
  ) {}

  async ngOnInit() {
    try {
      // Check if payments are enabled
      this.paymentsEnabled = this.featureFlagService.isEnabled('enablePayments');
    } catch (error) {
      console.error('Failed to fetch feature flags:', error);
    }
  }

  trackByItemId(index: number, item: any): string {
    return item.id;
  }
  
  removeItem(itemId: string): void {
    this.cartService.removeFromCart(itemId);
  }
  
  proceedToCheckout(): void {
    this.router.navigate(['/reservation-flow']);
  }
}
