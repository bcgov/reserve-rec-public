import { Component, OnInit } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { BreadcrumbComponent } from '../../shared/breadcrumb/breadcrumb.component';
import { BookingUtils } from '../../utils/booking-utils';

@Component({
  selector: 'app-booking-details',
  templateUrl: './booking-details.component.html',
  styleUrls: ['./booking-details.component.scss'],
  imports: [CommonModule, RouterModule, BreadcrumbComponent],
})
export class BookingDetailsComponent implements OnInit {
  booking: any = null;
  user: any = null;
  loading = true;
  error: string | null = null;
  qrCodeDataUrl: string | null = null;
  payment: any = null;

  constructor(
    private apiService: ApiService,
    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router
  ) {}

  async ngOnInit() {
    try {
      const bookingId = this.route.snapshot.paramMap.get('id');

      // Bookings GET now requires auth and returns the caller's booking
      // exclusively. The server enforces booking.userId === claims.sub
      // (Ref bcgov/reserve-rec-public#503), so no email param is needed and
      // no client-side ownership check is required — the API would have
      // returned 403/401 if we were not the owner.
      const res: any = await lastValueFrom(this.apiService.get(`bookings/${bookingId}`));
      this.booking = res.data;

      // Extract QR code if available
      if (this.booking?.qrCode?.dataUrl) {
        this.qrCodeDataUrl = this.booking.qrCode.dataUrl;
      }

      this.user = this.authService.getCurrentUser();
      this.loading = false;

      if (this.booking?.clientTransactionId) {
        this.loadPayment(this.booking.clientTransactionId);
      }
    } catch (error) {
      console.error('Failed to fetch booking details:', error);
      this.error = 'Failed to load booking details';
      this.loading = false;
    }
  }

  // Payment card is optional: if the lookup fails, the rest of the page still shows.
  async loadPayment(clientTransactionId: string) {
    try {
      const res: any = await lastValueFrom(this.apiService.get('transactions', { clientTransactionId }));
      this.payment = res?.data || null;
    } catch (error) {
      console.error('Failed to fetch payment details:', error);
    }
  }

  // The transaction doesn't store the payer's name; the signed-in user is the payer.
  getPayerName(): string {
    return [this.user?.given_name, this.user?.family_name].filter(Boolean).join(' ');
  }

  getCardLabel(): string {
    const cardTypes: Record<string, string> = { MC: 'Mastercard', VI: 'Visa', AM: 'American Express' };
    return cardTypes[this.payment?.cardType] || this.payment?.cardType || 'Card';
  }

  isBackcountry(): boolean {
    return this.booking?.activityType === 'backcountryCamp';
  }

  isAMPass(): boolean {
    return BookingUtils.isAMPass(this.booking);
  }

  getBookingNumber(): string {
    return BookingUtils.getBookingNumber(this.booking);
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

  getFacilityName(): string {
    return BookingUtils.getFacilityName(this.booking);
  }

  getGeozoneName(): string {
    return BookingUtils.getGeozoneName(this.booking);
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

  getPartySize(): number {
    return BookingUtils.getPartySize(this.booking);
  }

  getNamedOccupant(): string {
    return BookingUtils.getNamedOccupant(this.booking);
  }

  getLicensePlate(): string {
    return BookingUtils.getLicensePlate(this.booking);
  }

  getLicensePlateRegistrationRegion(): string {
    return BookingUtils.getLicensePlateRegistrationRegion(this.booking);
  }

  getStatus(): string {
    return this.booking?.status || 'confirmed';
  }

  isCancelled(): boolean {
    return BookingUtils.isCancelled(this.booking);
  }


  isExpired(): boolean {
    return BookingUtils.isExpired(this.booking);
  }

  downloadQRCode(): void {
    if (!this.qrCodeDataUrl) {
      console.warn('No QR code available to download');
      return;
    }

    if (!this.qrCodeDataUrl.startsWith('data:image/png;base64,')) {
      console.error('Invalid QR code data URL format');
      return;
    }

    const link = document.createElement('a');
    link.href = this.qrCodeDataUrl;
    const safeBookingId = (this.getBookingNumber() || 'unknown').replace(/[^a-zA-Z0-9-]/g, '');
    link.download = `booking-qr-${safeBookingId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  cancelBooking(): void {
    // Expired passes can't be cancelled — the button is hidden, but guard the
    // handler too in case it's reached another way (#538).
    if (this.isExpired()) {
      return;
    }
    const bookingId = this.route.snapshot.paramMap.get('id');
    if (bookingId) {
      this.router.navigate(['/account/bookings/cancel', bookingId]);
    }
  }
  
  goBack(): void {
    this.router.navigate(['/my-bookings']);
  }
  
}
