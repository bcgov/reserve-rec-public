import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CartService } from '../services/cart.service';
import { CartItemComponent } from './cart-item/cart-item.component'; // Add import

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, CartItemComponent], 
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss'
})
export class CartComponent {
  constructor(
    public cartService: CartService,
    private router: Router
  ) {}

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