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

  remaining = this.getRemainingSeconds();

  private tickInterval;

  constructor(private cartService: CartService) {}

  ngOnInit(): void {
    this.tick();
    this.tickInterval = setInterval(() => this.tick(), 1000);
  }

  tick(): void {
    this.remaining = this.getRemainingSeconds();

    if (!this.cartService.getCartTimerIsActive()) {
      clearInterval(this.tickInterval);
    }

    // Show minutes and seconds remaining as 00:00 - also don't show negative timer
    const mins = Math.max(0, Math.floor(this.remaining / 60));
    const secs = Math.max(0, this.remaining % 60);
    this.displayTimer.set(`${mins}:${secs.toString().padStart(2, '0')}`);
    this.isWarning.set(this.remaining < 120);
  }

  getRemainingSeconds() {
    const expiryTime = Math.floor(Number(this.cartService.items()[0]?.['sessionExpiry']) / 1000);
    const currentTime = Math.floor(Date.now() / 1000);
    return expiryTime - currentTime;
  }

  ngOnDestroy(): void {
    clearInterval(this.tickInterval);
  }
}
