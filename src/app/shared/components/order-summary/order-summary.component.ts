import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { CartItem } from '../../../services/cart.service';

@Component({
  selector: 'app-order-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-summary.component.html',
  styleUrl: './order-summary.component.scss',
})
export class OrderSummaryComponent {
  @Input() cartItem: CartItem | null = null;
  @Input() orderNumber: string | null = null;

  get subtotal(): number {
    const total = Number(this.cartItem?.feeInformation?.total ?? 0);
    const tax = Number(this.cartItem?.feeInformation?.tax ?? 0);
    return Number.isFinite(total) && Number.isFinite(tax)
      ? Math.max(total - tax, 0)
      : 0;
  }

  get tax(): number {
    const tax = Number(this.cartItem?.feeInformation?.tax ?? 0);
    return Number.isFinite(tax) ? tax : 0;
  }

  get total(): number {
    const total = Number(this.cartItem?.feeInformation?.total ?? 0);
    return Number.isFinite(total) ? total : 0;
  }
}
