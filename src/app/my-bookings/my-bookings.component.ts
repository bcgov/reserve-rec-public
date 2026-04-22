import { ActivatedRoute } from '@angular/router';
import { BookingMainCardComponent } from './bookings-main-card/bookings-main-card.component'
import { BreadcrumbComponent } from '../shared/breadcrumb/breadcrumb.component';
import { Component, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DateTime } from 'luxon'

import { BookingService } from '../services/booking.service';
import { BookingUtils } from '../utils/booking-utils';
import { Constants } from '../constants';
import { DataService } from '../services/data.service';
import { LoadingService } from '../services/loading.service';

@Component({
  selector: 'app-my-bookings',
  imports: [CommonModule, BookingMainCardComponent, BreadcrumbComponent],
  templateUrl: './my-bookings.component.html',
  styleUrls: ['./my-bookings.component.scss']
})
export class MyBookingsComponent implements OnInit {

  public activeBookings: any[] = [];
  public pastBookings: any[] = [];
  public cancelledBookings: any[] = [];
  public otherBookings: any[] = [];

  public data: any[] = [];
  public loading = true;
  public today: DateTime = this.getPSTDateTime();
  public user: { sub: string };
  
  constructor(
    private route: ActivatedRoute,
    private loadingService: LoadingService,
    private bookingService: BookingService,
    private dataService: DataService,
  ) {
    effect(() => {
      this.loading = this.loadingService.isLoading();
      this.processBookings();
    });
  }

  ngOnInit(): void {
    this.clearBookings();
    this.dataService.clearItemValue(Constants.dataIds.MY_BOOKINGS_RESULT);

    this.user = this.route.snapshot.data['user'] || {};
    this.bookingService.getBookings(this.user.sub);
  }

  clearBookings(): void {
    this.data = [];
    this.activeBookings = [];
    this.pastBookings = [];
    this.cancelledBookings = [];
    this.otherBookings = [];
  }

  // Get today's date e.g. 2025-05-30T16:24:48.872-08:00
  getPSTDateTime() {
    return DateTime.now().setZone('America/Vancouver');
  }

  hasData(obj: any): boolean {
    return obj && Object.keys(obj).length !== 0;
  }

  // Check if there are any bookings to show
  hasAnyBookings(): boolean {
    return this.activeBookings.length > 0 || this.pastBookings.length > 0 || this.cancelledBookings.length > 0 || this.otherBookings.length > 0;
  }

  // Format the date e.g. Fri, May 30, 2025
  formatDate(dateString: string): string {
    const dt = DateTime.fromISO(dateString);
    const day = dt.day;
    return `${dt.toFormat('EEE, MMM')} ${day}, ${dt.toFormat('yyyy')}`;
  }

  // Take all bookings and calculate which are active (future, not cancelled), past (past, not cancelled), cancelled (any cancelled), or other (catch-all)
  processBookings(): void {
    this.activeBookings = [];
    this.pastBookings = [];
    this.cancelledBookings = [];
    this.otherBookings = [];

    const result = this.dataService.watchItem(Constants.dataIds.MY_BOOKINGS_RESULT)();
    
    // Extract the items array from the result object
    if (result && result.items && Array.isArray(result.items)) {
      this.data = result.items;
    } else if (Array.isArray(result)) {
      this.data = result;
    } else {
      this.data = [];
      return;
    }

    // Filter to only process booking schema items (not bookingDate aggregates)
    const bookings = this.data.filter(item => item.schema === 'booking');

    bookings.forEach(item => {
      const rangeEnd = DateTime.fromISO(item.endDate).endOf('day');
      const isCancelled = item.status === 'cancelled' || item.bookingStatus === 'cancelled';
      const hasEnded = this.today > rangeEnd;

      const booking = {
        bookingId: item.bookingId || item.globalId,
        geozoneName: BookingUtils.getGeozoneName(item),
        facilityName: BookingUtils.getFacilityName(item),
        productName: BookingUtils.getProductDisplayName(item),
        startDate: item.startDate,
        endDate: item.endDate,
        formattedDate: this.formatDateRange(item.startDate, item.endDate),
        isCancelled: isCancelled,
        status: item.status || item.bookingStatus
      };

      // Categorize bookings:
      // 1. Cancelled - any cancelled booking
      // 2. Active - not cancelled and in the future
      // 3. Past - not cancelled and in the past
      // 4. Other - catch-all for debugging
      if (isCancelled) {
        this.cancelledBookings.push(booking);
      } else if (!hasEnded) {
        this.activeBookings.push(booking);
      } else if (hasEnded) {
        this.pastBookings.push(booking);
      } else {
        // Catch-all for any edge cases
        this.otherBookings.push(booking);
      }

      this.loading = false;
    });
  }

  // Format date range with time of day info
  formatDateRange(startDate: string, endDate: string): string {
    const start = DateTime.fromISO(startDate);
    const end = DateTime.fromISO(endDate);
    
    if (start.hasSame(end, 'day')) {
      // Same day pass
      const formattedDate = start.toFormat('MMMM d, yyyy');
      return `${formattedDate} (All day)`;
    } else {
      // Multi-day pass
      return `${start.toFormat('MMM d, yyyy')} - ${end.toFormat('MMM d, yyyy')}`;
    }
  }
}
