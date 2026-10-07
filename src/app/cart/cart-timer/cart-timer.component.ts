import { NgClass } from '@angular/common';
import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-cart-timer',
  standalone: true,
  imports: [NgClass],
  templateUrl: './cart-timer.component.html',
  styleUrl: './cart-timer.component.scss'
})
export class CartTimerComponent implements OnInit, OnDestroy {
  displayTimer = signal('');
  isWarning = signal(false);
  visible = signal(false);

  remaining = 0;

  private tickInterval;

  constructor(private cartService: CartService) {}

  ngOnInit(): void {
    this.tick();
    if (this.visible()) {
      this.tickInterval = setInterval(() => this.tick(), 1000);
    }
  }

  tick(): void {
    const remaining = this.getRemainingSeconds();
    if (remaining === null) {
      this.visible.set(false);
      this.displayTimer.set('');
      clearInterval(this.tickInterval);
      return;
    }

    if (!this.cartService.getCartTimerIsActive()) {
      clearInterval(this.tickInterval);
    }

    this.remaining = remaining;
    this.visible.set(true);

    // Show minutes and seconds remaining as 00:00 - also don't show negative timer
    const mins = Math.max(0, Math.floor(this.remaining / 60));
    const secs = Math.max(0, this.remaining % 60);
    this.displayTimer.set(`${mins}:${secs.toString().padStart(2, '0')}`);
    this.isWarning.set(this.remaining < 120);
  }

  getRemainingSeconds() {
    // Get session expiry or set sessionExpiry as null (skip setting timer)
    const sessionExpiry = this.cartService.items()[0]?.sessionExpiry;
    if (sessionExpiry === undefined || sessionExpiry === null) return null;

    const expiryTime = Math.floor(Number(sessionExpiry) / 1000);
    if (!Number.isFinite(expiryTime)) return null;

    const currentTime = Math.floor(Date.now() / 1000);
    return expiryTime - currentTime;
  }

  ngOnDestroy(): void {
    clearInterval(this.tickInterval);
  }
}
