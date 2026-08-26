import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { BookingService } from '../services/booking.service';
import { CartService } from '../services/cart.service';
import { LoadingService } from '../services/loading.service';
import { QrPrintService } from '../services/qr-print.service';
import { Constants } from '../constants';
import { BreadcrumbComponent } from '../shared/breadcrumb/breadcrumb.component';
import { BookingUtils } from '../utils/booking-utils';
import { CartItemComponent } from '../cart/cart-item/cart-item.component';

@Component({
  selector: 'app-booking-confirmation',
  standalone: true,
  imports: [CommonModule, BreadcrumbComponent, CartItemComponent],
  templateUrl: './booking-confirmation.component.html',
  styleUrls: ['./booking-confirmation.component.scss']
})
export class BookingConfirmationComponent implements OnInit {
  bookingId: string | null = null;
  booking: any = null;
  queryParams: any = {};
  loading = true;
  error: string | null = null;
  qrCodeDataUrl: string | null = null;
  isPrinting = false;
  printError: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private bookingService: BookingService,
    private qrPrintService: QrPrintService,
    public cartService: CartService,
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
    
    if (this.bookingId) {
      // Reaching this page with a bookingId means checkout succeeded — the
      // single-item cart's job is done regardless of whether the detail
      // fetch below succeeds.
      this.cartService.clearCart();
      await this.loadBooking();
    } else {
      this.error = 'No booking ID provided';
      this.loading = false;
    }
  }

  async loadBooking(): Promise<void> {
    try {
      this.loadingService.addToFetchList(Constants.dataIds.BOOKING_DETAILS_RESULT);
      // Fetch booking from API (don't fetch access points since they're optional)
      const bookingData: any = await this.bookingService.getBookingByGlobalId(this.bookingId!, false);
      this.booking = this.formatBooking(bookingData);

      // Extract QR code if available
      if (this.booking?.qrCode?.dataUrl) {
        this.qrCodeDataUrl = this.booking.qrCode.dataUrl;
      }
    } catch (error) {
      console.error('Error loading booking:', error);
      this.error = 'Failed to load booking details';
    } finally {
      this.loading = false;
      this.loadingService.removeFromFetchList(Constants.dataIds.BOOKING_DETAILS_RESULT);
    }
  }

  // Format booking so it can be rendered using app-cart-item component
  formatBooking(booking: any) {
    return {
      collectionId: booking.collectionId,
      activityType: booking.activityType,
      activitySubType: booking.activitySubType,
      activityId: booking.activityId,
      productId: booking.productId,
      quantity: booking.quantity,
      activityName: booking.activityName,
      productName: BookingUtils.getProductDisplayName(booking),
      geozoneName: BookingUtils.getGeozoneName(booking),
      dateRange: [
        booking.startDate,
        booking.endDate
      ],
      startDate: booking.startDate,
      endDate: booking.endDate,
      namedOccupant: {
        firstName: booking.namedOccupant.firstName,
        lastName: booking.namedOccupant.lastName,
      },
      occupants: {
        totalAdult: booking.quantity,
        totalSenior: 0,
        totalYouth: 0,
        totalChild: 0,
      },
      checkInAnchor: booking.reservationContext.checkInTime,
      checkOutAnchor: booking.reservationContext.checkOutTime,
      bookingId: booking.bookingId,
      sessionId: booking.sessionId,
      qrCode: {
        dataUrl: booking.qrCode?.dataUrl,
        verificationUrl: booking.qrCode?.verificationUrl
      },
      vehicleInformation: [
        {
          licensePlate: booking.vehicleInformation[0]?.licensePlate,
          licensePlateRegistrationRegion: booking.vehicleInformation[0]?.licensePlateRegistrationRegion
        }
      ]
    }
  }

  getBookingNumber(): string {
    if (this.booking) {
      return BookingUtils.getBookingNumber(this.booking);
    }
    return this.queryParams['ref1'] || 'N/A';
  }

  getEmail(): string {
    if (this.booking) {
      return BookingUtils.getEmail(this.booking);
    }
    return this.queryParams['ref3'] || 'N/A';
  }

  getArrivalDate(): string {
    return BookingUtils.getArrivalDate(this.booking);
  }

  getDepartureDate(): string {
    return BookingUtils.getDepartureDate(this.booking);
  }

  getArrivalTime(): string {
    return BookingUtils.getArrivalTime(this.booking);
  }

  getDepartureTime(): string {
    return BookingUtils.getDepartureTime(this.booking);
  }

  getAreaName(): string {
    return BookingUtils.getFacilityName(this.booking);
  }

  getCampsite(): string {
    return 'First-come, first-served';
  }

  getPartySize(): number {
    return BookingUtils.getPartySize(this.booking);
  }

  getNights(): number {
    return BookingUtils.getNights(this.booking);
  }

  getEntryPoint(): string {
    return BookingUtils.getEntryPoint(this.booking);
  }

  getExitPoint(): string {
    return BookingUtils.getExitPoint(this.booking);
  }

  getActivityType(): string {
    return BookingUtils.getActivityType(this.booking);
  }

  getProductDisplayName(): string {
    return BookingUtils.getProductDisplayName(this.booking);
  }

  getPassCount(): number {
    return BookingUtils.getPassCount(this.booking);
  }

  getNamedOccupant(): string {
    return BookingUtils.getNamedOccupant(this.booking);
  }
  
  getGeozoneName(): string {
    return BookingUtils.getGeozoneName(this.booking);
  }

  getLicensePlate(): string {
    return BookingUtils.getLicensePlate(this.booking);
  }

  getLicensePlateRegistrationRegion(): string {
    return BookingUtils.getLicensePlateRegistrationRegion(this.booking);
  }
  viewConfirmationLetter(): void {
    // TODO: Implement confirmation letter generation
  }

  downloadQRCode(): void {
    if (!this.qrCodeDataUrl) {
      console.warn('No QR code available to download');
      return;
    }

    // Validate that qrCodeDataUrl is actually a data URL
    if (!this.qrCodeDataUrl.startsWith('data:image/png;base64,')) {
      console.error('Invalid QR code data URL format');
      return;
    }

    // Create a download link
    const link = document.createElement('a');
    link.href = this.qrCodeDataUrl;
    // Sanitize bookingId for filename
    const safeBookingId = (this.bookingId || 'unknown').replace(/[^a-zA-Z0-9-]/g, '');
    link.download = `booking-qr-${safeBookingId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async printQRCode(): Promise<void> {
    if (!this.qrCodeDataUrl) {
      console.warn('No QR code available to print');
      this.printError = 'QR code is not available for printing';
      return;
    }

    // Clear any previous print errors
    this.printError = null;
    this.isPrinting = true;

    try {
      await this.qrPrintService.printQRCode(this.qrCodeDataUrl, {
        bookingNumber: this.getBookingNumber(),
        areaName: this.getAreaName(),
        arrivalDate: this.getArrivalDate()
      });
    } catch (error) {
      console.error('Failed to print QR code:', error);
      this.printError = 'Failed to open print dialog. Please try again or download the QR code instead.';
    } finally {
      this.isPrinting = false;
    }
  }

  viewBooking(): void {
    // Navigate to booking details
    if (this.bookingId) {
      this.router.navigate(['/booking', this.bookingId]);
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
  }

  trackByItemId(index: number, item: any): string {
    return item.id;
  }
  
  removeItem(itemId: string): void {
    this.cartService.removeFromCart(itemId);
  }
}
