import { Injectable, signal, computed } from '@angular/core';

export interface CartItem {
  id: string;
  geoZoneName: string;
  activityId: string;
  activityName: string;
  acCollectionId: string;
  activityType: string;
  dateRange: [string, string];
  startDate: string;
  endDate: string;
  occupants: {
    totalAdult: number;
    totalSenior: number;
    totalYouth: number;
    totalChild: number;
  };
  totalPrice: number;
  step1Completed: boolean;
  step2Completed: boolean;
  step3Completed: boolean;
  step4Completed: boolean;
  areAllStepsCompleted: boolean;

}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private readonly CART_STORAGE_KEY = 'bcparks-cart';
  private cartItems = signal<CartItem[]>(this.loadCartFromStorage());
  
  // Public readonly signals
  readonly items = this.cartItems.asReadonly();
  readonly itemCount = computed(() => this.cartItems().length);
  
  addToCart(item: CartItem): void {
    const itemWithId = { ...item, id: this.generateId() };
    this.cartItems.update(items => {
      const newItems = [...items, itemWithId];
      this.saveCartToStorage(newItems);
      return newItems;
    });
  }
  
  removeFromCart(itemId: string): void {
    this.cartItems.update(items => {
      const newItems = items.filter(item => item.id !== itemId);
      this.saveCartToStorage(newItems);
      return newItems;
    });
  }
  
  clearCart(): void {
    this.cartItems.set([]);
    this.saveCartToStorage([]);
  }
  
  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }
  
  private loadCartFromStorage(): CartItem[] {
    try {
      const stored = sessionStorage.getItem(this.CART_STORAGE_KEY); // Changed to sessionStorage
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      return [];
    }
  }
  
  private saveCartToStorage(items: CartItem[]): void {
    try {
      sessionStorage.setItem(this.CART_STORAGE_KEY, JSON.stringify(items)); // Changed to sessionStorage
    } catch (error) {
      console.warn('Failed to save cart to storage:', error);
    }
  }

   updateCartItem(itemId: string, updatedItem: CartItem): void {
    this.cartItems.update(items => {
      const newItems = items.map(item => 
        item.id === itemId ? { ...item, ...updatedItem } : item
      );
      this.saveCartToStorage(newItems);
      return newItems;
    });
  }
}