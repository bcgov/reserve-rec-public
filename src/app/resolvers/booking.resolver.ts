import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve } from '@angular/router';
import { BookingService } from '../services/booking.service';

@Injectable({ providedIn: 'root' })
export class BookingResolver implements Resolve<any> {
  constructor(private bookingService: BookingService) {}

  resolve(route: ActivatedRouteSnapshot) {
    const globalId = route.paramMap.get('bookingId');
    const booking = this.bookingService.getBookingByGlobalId(globalId, true); // Replace with actual global ID
    return booking; // Assuming getBookingByGlobalId returns an observable
  }
}