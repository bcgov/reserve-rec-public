import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { BsModalService } from 'ngx-bootstrap/modal';
import { CartService } from './cart.service';
import { ConfirmationModalComponent } from '../shared/components/confirmation-modal/confirmation-modal.component';

@Injectable({
  providedIn: 'root'
})
export class CartExpiryService implements OnDestroy {
  private intervalId?: ReturnType<typeof setInterval>;

  constructor(
    private cartService: CartService,
    private modalService: BsModalService,
    private router: Router
  ) {}

  start(): void {
    if (this.intervalId) return;
    this.tick();
    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  tick(): void {
    // Check if a cart timer is currently active in the cart
    if (!this.cartService.getCartTimerIsActive()) return;

    // Get the first (only for now) item in the cart
    const cartItem = this.cartService.items()[0];
    if (!cartItem || cartItem.sessionExpiry === undefined || cartItem.sessionExpiry === null) return;

    // Get expiry time epoch
    const expiryTime = Math.floor(Number(cartItem.sessionExpiry) / 1000);
    if (!Number.isFinite(expiryTime)) return;

    // Current time epoch
    const currentTime = Math.floor(Date.now() / 1000);

    // Also give the user a couple seconds on 0:00 to submit
    if (expiryTime - currentTime >= -2) return;

    this.cartService.removeFromCart(cartItem.id);
    this.cartService.releaseCartItem(cartItem);
    // Send the user back to /cart wherever they may be in reservation flow or checkout
    if (this.router.url.includes('/reservation-flow') || this.router.url.includes('/checkout')) {
      this.router.navigate(['/cart']);
    }

    // Confirmation pop-up to tell user the booking has been returned
    const modalRef = this.modalService.show(ConfirmationModalComponent, {
      initialState: {
        title: 'Booking timer expired',
        body: 'This booking has expired. The booking item has been returned.',
        confirmText: 'Ok',
        cancelText: '', // No cancel text, it just has to happen 
        confirmClass: 'btn btn-primary',
        cancelClass: 'btn btn-outline-secondary',
      },
    });
    modalRef.content?.confirmButton.subscribe(() => modalRef.hide());
  }

  ngOnDestroy() {
    clearInterval(this.intervalId);
  }
}
