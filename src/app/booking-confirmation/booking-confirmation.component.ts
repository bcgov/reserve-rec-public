import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BookingService } from '../services/booking.service';
import { LoadingService } from '../services/loading.service';
import { Constants } from '../constants';

@Component({
  selector: 'app-booking-confirmation',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './booking-confirmation.component.html',
  styleUrl: './booking-confirmation.component.scss'
})
export class BookingConfirmationComponent implements OnInit {
  bookingId: string | null = null;
  booking: any = null;
  queryParams: any = {};
  loading = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private bookingService: BookingService,
    protected loadingService: LoadingService
  ) {}

  async ngOnInit(): Promise<void> {
    // Get bookingId from route parameter
    this.bookingId = this.route.snapshot.paramMap.get('bookingId');
    
    // Get all query parameters from URL
    this.queryParams = this.route.snapshot.queryParams;
    
    // Extract ref1 (bookingId) from query params if not in route
    const ref1BookingId = this.queryParams['ref1'];
    if (ref1BookingId && !this.bookingId) {
      this.bookingId = ref1BookingId;
    }

    console.log('Booking ID:', this.bookingId);
    console.log('Query Params:', this.queryParams);

    if (this.bookingId) {
      await this.loadBooking();
    } else {
      this.error = 'No booking ID provided';
      this.loading = false;
    }
  }

  async loadBooking(): Promise<void> {
    try {
      this.loadingService.addToFetchList(Constants.dataIds.BOOKING_DETAILS_RESULT);
      // Fetch booking from API
      const bookingData = await this.bookingService.getBookingByGlobalId(this.bookingId!, true);
      this.booking = bookingData;
      console.log('Booking data:', this.booking);
    } catch (error) {
      console.error('Error loading booking:', error);
      this.error = 'Failed to load booking details';
    } finally {
      this.loading = false;
      this.loadingService.removeFromFetchList(Constants.dataIds.BOOKING_DETAILS_RESULT);
    }
  }

  getBookingNumber(): string {
    return this.booking?.bookingId || this.queryParams['ref1'] || 'N/A';
  }
  
  getEmail(): string {
    return this.booking?.data?.namedOccupant?.contactInfo?.email || this.queryParams['ref3'] || 'N/A';
  }

  getArrivalDate(): string {
    return this.booking?.data?.startDate || 'N/A';
  }

  getDepartureDate(): string {
    return this.booking?.data?.endDate || 'N/A';
  }

  getAreaName(): string {
    return this.booking?.data?.displayName || 'N/A';
  }

  getCampsite(): string {
    return 'First-come, first-served';
  }

  getPartySize(): number {
    if (!this.booking?.data?.partyInformation) return 0;
    const party = this.booking.data.partyInformation;
    return (party.adult || 0) + (party.senior || 0) + (party.youth || 0) + (party.child || 0);
  }

  getNights(): number {
    if (!this.booking?.data?.startDate || !this.booking?.data?.endDate) return 0;
    const start = new Date(this.booking.data.startDate);
    const end = new Date(this.booking.data.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getEntryPoint(): string {
    // Try to get text from entryPoint object or just return the value
    if (this.booking?.data?.entryPoint) {
      if (typeof this.booking.data.entryPoint === 'object') {
        return this.booking.data.entryPoint.text || this.booking.data.entryPoint.sk || 'Not specified';
      }
      return this.booking.data.entryPoint;
    }
    return 'Not specified';
  }

  getExitPoint(): string {
    // Try to get text from exitPoint object or just return the value
    if (this.booking?.data?.exitPoint) {
      if (typeof this.booking.data.exitPoint === 'object') {
        return this.booking.data.exitPoint.text || this.booking.data.exitPoint.sk || 'Not specified';
      }
      return this.booking.data.exitPoint;
    }
    return 'Not specified';
  }

  getBookingType(): string {
    return 'Backcountry';
  }

  viewConfirmationLetter(): void {
    // TODO: Implement confirmation letter generation
    console.log('View confirmation letter');
  }

  viewBooking(): void {
    // Navigate to booking details
    if (this.bookingId) {
      this.router.navigate(['/my-bookings']);
    }
  }

  returnToParks(): void {
    this.router.navigate(['/']);
  }

  viewMyBookings(): void {
    this.router.navigate(['/my-bookings']);
  }

  viewReceipt(): void {
    // TODO: Implement receipt view
    console.log('View receipt');
  }
}
