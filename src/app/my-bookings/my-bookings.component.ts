import { ActivatedRoute } from '@angular/router';
import { BookingMainCardComponent } from './bookings-main-card/bookings-main-card.component'
import { Component, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DateTime } from 'luxon'

import { BookingService } from '../services/booking.service';
import { Constants } from '../constants';
import { DataService } from '../services/data.service';
import { LoadingService } from '../services/loading.service';

@Component({
  selector: 'app-my-bookings',
  imports: [CommonModule, BookingMainCardComponent],
  templateUrl: './my-bookings.component.html',
  styleUrls: ['./my-bookings.component.scss']
})
export class MyBookingsComponent implements OnInit {
  public activeBookings: any[] = [];
  public activeSection = '';
  public data: any[] = [];
  public loading = true;
  public today: string = this.getPSTDateTime();
  public upcomingBookings: any[] = [];
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
    this.user = this.route.snapshot.data['user'];
    console.log('the user: ', this.user)
    this.bookingService.getBookings(this.user.sub);
  }

  // Get today's date e.g. 2025-05-30T16:24:48.872-08:00
  getPSTDateTime() {
    return DateTime.now().setZone('America/Vancouver');
  }

  hasData(obj: any): boolean {
    return obj && Object.keys(obj).length !== 0;
  }

  // Format the date e.g. Fri, May 30, 2025
  formatDate(dateString: string): string {
    const dt = DateTime.fromISO(dateString);
    const day = dt.day;
    return `${dt.toFormat('EEE, MMM')} ${day}, ${dt.toFormat('yyyy')}`;
  }

  // Create a mapObj from the details of the booking
  formatMapCoords(item: { sk: any; entryPoint: any; coordinates: any; location: { type: any; }; }) {
    return {
      _id: item.sk,
      displayName: item.entryPoint,
      imageUrl: "", // TODO
      coordinates: item.coordinates,
      type: item.location.type,
      location: item.location
    }
  }

  // Calculate the number of nights total for booking
  formatNights(startDate: string, endDate: string): number {
    const start = DateTime.fromISO(startDate);
    const end = DateTime.fromISO(endDate);

    const nights = end.diff(start, 'days').days;

    return Math.max(0, Math.floor(nights));
  }

  // Calculate the number of people in the party
  formatParty(partyInfo: Record<string, number>) {
    const partyKeys = Object.keys(partyInfo)
    let totalParty = 0;
    for (const partyKey of partyKeys) {
      totalParty += partyInfo[partyKey];
    }

    return totalParty;
  }

  // Take all bookings and calculate which are active, upcoming, and TODO: past, and cancelled
  processBookings(): void {
    this.upcomingBookings = [];
    this.activeBookings = [];

    this.data = this.dataService.watchItem(Constants.dataIds.MY_BOOKINGS_RESULT)();
    console.log("booking data: ", this.data)

    this.data?.forEach(item => {
      const rangeStart = DateTime.fromISO(item.startDate);
      const rangeEnd = DateTime.fromISO(item.endDate);

      const isActive = this.today >= rangeStart && this.today <= rangeEnd;
      const isUpcoming = this.today <= rangeStart && this.today <= rangeEnd;

      const booking = {
        bookingId: item.bookingId,
        bookingNumber: item.bookingHash,
        endDate: this.formatDate(item.endDate),
        entryPoint: item.entryPoint,
        mapObj: this.formatMapCoords(item),
        nights: this.formatNights(item.startDate, item.endDate),
        parkName: item.parkName,
        partyTotal: this.formatParty(item.partyInformation),
        startDate: this.formatDate(item.startDate),
      };

      if (isActive) {
        this.activeBookings.push(booking);
      } else if (isUpcoming) {
        this.upcomingBookings.push(booking);
      }

      this.loading = false;
    });
  }

  scrollToAnchor(elementId: string): void {
    this.activeSection = elementId;
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'smooth' });
    }
  }
}
