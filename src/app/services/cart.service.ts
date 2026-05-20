import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { AuthService } from './auth.service';

export interface CartItem {
  id: string;
  geoZoneName: string;
  activityId: string;
  activityName: string;
  productName?: string;
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
  checkInAnchor?: string | number;
  checkOutAnchor?: string | number;
  waitingRoomActive?: boolean;
  bookingId?: string; // Booking created immediately when user clicks "book"
  sessionId?: string; // Session ID from initial booking creation
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  // The cart is keyed by Cognito sub in localStorage so two accounts sharing
  // a browser session never see each other's items. Anonymous users get a
  // synthetic 'anon' slot. (Ref bcgov/reserve-rec-public#503.)
  private static readonly STORAGE_KEY_PREFIX = 'bcparks-cart::';
  private static readonly LEGACY_STORAGE_KEY = 'bcparks-cart';

  private authService = inject(AuthService);
  private cartItems = signal<CartItem[]>([]);
  // `undefined` sentinel so the first effect run is not mistaken for "no
  // change" when the auth user signal starts at null. After the first run
  // this holds the actual sub (or null for anon) and subsequent same-user
  // ticks short-circuit normally.
  private currentSub: string | null | undefined = undefined;

  // Public readonly signals
  readonly items = this.cartItems.asReadonly();
  readonly itemCount = computed(() => this.cartItems().length);

  constructor() {
    // Initial load + react to user changes (sign-in, sign-out, refresh).
    // The effect runs once with whatever the user signal currently holds,
    // then again whenever it changes.
    effect(() => {
      const sub = this.authService.user()?.sub ?? null;
      if (sub === this.currentSub) {
        return;
      }
      this.currentSub = sub;
      this.cartItems.set(this.loadCartFromStorage());
    });
  }

  // The cart is single-item: a new add replaces whatever was there. The reservation
  // flow only ever consumes cartItems[0], and there's no UI to pick from a list of
  // pending bookings. Callers that want to warn the user before clobbering an existing
  // item should call confirmReplaceIfNeeded() first.
  addToCart(item: CartItem): void {
    const itemWithId = { ...item, id: this.generateId() };
    const newItems = [itemWithId];
    this.cartItems.set(newItems);
    this.saveCartToStorage(newItems);
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

  private storageKey(): string {
    const sub = this.authService.user()?.sub;
    return `${CartService.STORAGE_KEY_PREFIX}${sub ?? 'anon'}`;
  }

  private loadCartFromStorage(): CartItem[] {
    try {
      let stored = localStorage.getItem(this.storageKey());
      if (!stored) {
        // One-time migration: if a legacy unscoped cart exists and this is
        // the first sub-scoped load, adopt it for the current user. Then
        // remove the legacy key so future users on this browser don't
        // inherit it. Without this, the user's existing cart silently
        // disappears on first deploy.
        const legacy = localStorage.getItem(CartService.LEGACY_STORAGE_KEY);
        if (legacy) {
          localStorage.removeItem(CartService.LEGACY_STORAGE_KEY);
          localStorage.setItem(this.storageKey(), legacy);
          stored = legacy;
        }
      }
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
      localStorage.setItem(this.storageKey(), JSON.stringify(items));
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
