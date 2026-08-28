import { Component, HostBinding, Input } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-bookings-main-card',
  templateUrl: './bookings-main-card.component.html',
  styleUrls: ['./bookings-main-card.component.scss'],
  imports: [RouterLink]
})
export class BookingMainCardComponent {
  @Input() bookingId!: string;
  @Input() geozoneName!: string;
  @Input() facilityName!: string;
  @Input() productName!: string;
  @Input() activityType!: string;
  @Input() passType = '';
  @Input() imageUrl = '';
  @Input() formattedDate!: string;
  @Input() isCancelled = false;
  // Compact = the horizontal thumbnail row used on the Previous bookings page.
  @Input() compact = false;

  // Add aria label to component
  @HostBinding('attr.aria-label') @Input() ariaLabel: string;
}
