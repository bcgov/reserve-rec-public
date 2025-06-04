import { Component, HostBinding, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BookingMapComponent } from '../../booking-map/booking-map.component';

@Component({
  selector: 'app-bookings-main-card',
  templateUrl: './bookings-main-card.component.html',
  styleUrls: ['./bookings-main-card.component.scss'],
  imports: [CommonModule, BookingMapComponent]
})
export class BookingMainCardComponent {
  @Input() bookingId!: string;
  @Input() bookingNumber!: string;
  @Input() endDate!: string;
  @Input() entryPoint!: string;
  @Input() mapObj!: any;
  @Input() nights!: string;
  @Input() parkName!: string;
  @Input() partyTotal!: string;
  @Input() startDate!: string;

  // Add aria label to component
  @HostBinding('attr.aria-label') @Input() ariaLabel: string;

  constructor(private router: Router) {}
  
  navigate(bookingId: string, mapObj: any): void {
    this.router.navigate(
      ['/account/bookings', bookingId],
      { state: { mapObj } }
    );
  }
}
