import { NgClass } from '@angular/common';
import { Component, OnInit, OnDestroy, signal, inject, Output, EventEmitter } from '@angular/core';
import { CartService } from '../../services/cart.service';
import { ConfirmationModalComponent } from '../../shared/components/confirmation-modal/confirmation-modal.component';
import { BsModalService } from 'ngx-bootstrap/modal';

@Component({
  selector: 'app-cart-timer',
  standalone: true,
  imports: [NgClass],
  templateUrl: './cart-timer.component.html',
  styleUrl: './cart-timer.component.scss'
})
export class CartTimerComponent implements OnInit, OnDestroy {
  @Output() removeItem = new EventEmitter<string>();

  displayTimer = signal('');
  visible = signal(true);
  isWarning = signal(false);
  continueCountdown: boolean;

  remaining = this.getRemainingSeconds();

  private tickInterval: any;
  private modalService = inject(BsModalService)

  constructor(private cartService: CartService) {}

  async ngOnInit() {
    // Give the user a couple seconds on 0:00 to submit (also works nicely with async tick())
    if (this.remaining < -2) {
      this.displayTimer.set('');
      this.visible.set(false);
      clearInterval(this.tickInterval);
      this.confirmDeletedCart();
    } else {
      this.tick();
      this.tickInterval = setInterval(() => this.tick(), 1000);
    }
  }

  async tick() {
    this.remaining = this.getRemainingSeconds();
    this.continueCountdown = this.cartService.getCartTimerIsActive();

    if (!this.continueCountdown) {
      clearInterval(this.tickInterval);
    }

    // Only continue the countdown if time is remaining, the counter is visible
    // and if the counter isn't stopped by Step progression.
    // Also give the user a couple seconds on 0:00 to submit (also works nicely with async tick())
    if (this.remaining < -2 && this.visible()) {
      this.displayTimer.set('');
      clearInterval(this.tickInterval);
      this.confirmDeletedCart();
    }
    
    // Show minutes and seconds remaining as 00:00 - also don't show negative timer
    const mins = Math.max(0, Math.floor(this.remaining / 60));
    const secs = Math.max(0, this.remaining % 60);
    this.displayTimer.set(`${mins}:${secs.toString().padStart(2, '0')}`);
    this.isWarning.set(this.remaining < 120);
  }

  private confirmDeletedCart() {
      return new Promise(resolve => {
        const modalRef = this.modalService.show(ConfirmationModalComponent, {
          initialState: {
            title: 'Booking timer expired',
            body: `This booking has expired. The booking item has been returned.`,
            confirmText: 'Ok',
            cancelText: '', // No cancel option
            confirmClass: 'btn btn-primary',
            cancelClass: 'btn btn-outline-secondary',
          },
        });
        let settled = false;
        const settle = (value: boolean) => {
          if (settled) return;
          this.onRemoveClick()
          settled = true;
          modalRef.hide();
          resolve(value);
        };
        modalRef.content?.confirmButton.subscribe(() => {
          settle(true);
          this.onRemoveClick();
        });
        modalRef.onHide?.subscribe(() => settle(true));
      });
    }

  getRemainingSeconds() {
    const expiryTime = Math.floor(Number(this.cartService.items()[0]?.['sessionExpiry']) / 1000);
    const currentTime = Math.floor(Date.now() / 1000);
    return expiryTime - currentTime;
  }

  onRemoveClick(): void {
    this.removeItem.emit(this.cartService.items()[0]?.id);
  }

  ngOnDestroy(): void {
    clearInterval(this.tickInterval);
  }
}
