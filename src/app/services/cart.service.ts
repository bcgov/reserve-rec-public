import { Injectable, signal, computed } from '@angular/core';

export interface CartItem {
  id: string;
  geoZoneName: string;
  activityId: string;
  activityName: string;
  collectionId: string;
  activityType: string;
  productId?: string;
  quantity?: number;
  dateRange: [string, string];
  startDate: string;
  endDate: string;
  occupants: {
    totalAdult: number;
    totalSenior: number;
    totalYouth: number;
    totalChild: number;
  };
  feeInformation: {
    registrationFees: number;
    transactionFees: number;
    tax: number;
    total: number;
  };
  detailsStepCompleted: boolean;
  visitorDetailsStepCompleted: boolean;
  equipmentStepCompleted: boolean;
  paymentStepCompleted: boolean;
  areAllStepsCompleted: boolean;
  entryPoint?: { pk: string; sk: string };
  exitPoint?: { pk: string; sk: string };
  waitingRoomActive?: boolean;
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
      // Drop any stale waiting-room-locked items before adding the new one.
      // This enforces the single-item-per-waiting-room rule and prevents stale
      // waitingRoomActive:true entries from triggering the guard on future visits.
      const filtered = items.filter(i => !i.waitingRoomActive);
      const newItems = [...filtered, itemWithId];
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
      const stored = localStorage.getItem(this.CART_STORAGE_KEY);
      if (!stored) return [];
      const items: CartItem[] = JSON.parse(stored);
      // Clear stale waitingRoomActive flags on load unless there is a matching
      // active admission in sessionStorage. This prevents the WaitingRoomGuard
      // from misfiring on items left over from a previous session.
      const admission = this.getStoredAdmission();
      return items.map(item => {
        if (!item.waitingRoomActive) return item;
        const facilityKey = `${item.collectionId}#${item.activityType}#${item.activityId}`;
        const now = Math.floor(Date.now() / 1000);
        if (
          admission &&
          admission.facilityKey === facilityKey &&
          admission.dateKey === item.startDate &&
          admission.tokenExpiry > now
        ) {
          return item; // valid admission — keep the flag
        }
        return { ...item, waitingRoomActive: false }; // stale — clear it
      });
    } catch (error) {
      console.log(error);
      return [];
    }
  }

  private getStoredAdmission(): { facilityKey: string; dateKey: string; tokenExpiry: number } | null {
    try {
      const stored = sessionStorage.getItem('wr_admission');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  private saveCartToStorage(items: CartItem[]): void {
    try {
      localStorage.setItem(this.CART_STORAGE_KEY, JSON.stringify(items));
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
