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

  constructor(
    private apiService: ApiService,
    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router
  ) {}

  async ngOnInit() {
    try {
      const bookingId = this.route.snapshot.paramMap.get('id');
      const email = this.route.snapshot.queryParamMap.get('email');
      const queryParams: any = {};
      if (email) {
        queryParams.email = email;
      }
      
      const res: any = await lastValueFrom(this.apiService.get(`bookings/${bookingId}`, queryParams));
      this.booking = res.data;

      // Extract QR code if available
      if (this.booking?.qrCode?.dataUrl) {
        this.qrCodeDataUrl = this.booking.qrCode.dataUrl;
      }
      
      this.user = this.authService.getCurrentUser();

      if(this.user.sub != this.booking.userId && !this.user.sub.startsWith('guest')) {
        console.error('User does not match booking userId');
        this.router.navigate(['/']); 
        return;
      }
      this.loading = false;
    } catch (error) {
      console.error('Failed to fetch booking details:', error);
      this.error = 'Failed to load booking details';
      this.loading = false;
    }
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

  getFacilityName(): string {
    return BookingUtils.getFacilityName(this.booking);
  }

  getGeozoneName(): string {
    return BookingUtils.getGeozoneName(this.booking);
  }

  getBookingType(): string {
    return BookingUtils.getBookingType(this.booking);
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
    return this.getStatus() === 'cancelled';
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
    const bookingId = this.route.snapshot.paramMap.get('id');
    if (bookingId) {
      this.router.navigate(['/account/bookings/cancel', bookingId]);
    }
  }
}
