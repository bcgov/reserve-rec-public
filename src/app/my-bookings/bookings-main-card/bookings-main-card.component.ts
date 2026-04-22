import { Component, HostBinding, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-bookings-main-card',
  templateUrl: './bookings-main-card.component.html',
  styleUrls: ['./bookings-main-card.component.scss'],
  imports: [CommonModule, RouterLink]
})
export class BookingMainCardComponent {
  @Input() bookingId!: string;
  @Input() geozoneName!: string;
  @Input() facilityName!: string;
  @Input() productName!: string;
  @Input() formattedDate!: string;
  @Input() isCancelled = false;

  // Add aria label to component
  @HostBinding('attr.aria-label') @Input() ariaLabel: string;
}
