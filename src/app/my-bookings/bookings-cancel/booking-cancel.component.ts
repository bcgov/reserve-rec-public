import { Component, OnDestroy, OnInit } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { BreadcrumbComponent } from '../../shared/breadcrumb/breadcrumb.component';
import { CancelService } from '../../services/cancel.service';
import { ToastService, ToastTypes } from '../../services/toast.service';
import { FeatureFlagService } from '../../services/feature-flag.service';
import { BookingUtils } from '../../utils/booking-utils';
import { Constants } from '../../constants';

@Component({
  selector: 'app-booking-cancel',
  templateUrl: './booking-cancel.component.html',
  styleUrls: ['./booking-cancel.component.scss'],
  imports: [CommonModule, RouterModule, BreadcrumbComponent]
})
export class BookingCancelComponent implements OnInit, OnDestroy {
  booking: any = null;
  transaction: any = null;
  mapObj: any = null;
  userId: any = null;
  startDate = '';
  endDate = '';
  bookedDate = '';
  viewMap = true;
  zoomValue = 12;
  loading = true;
  cancelling = false;
  paymentsEnabled = false;
  acknowledgeCancel = false;
  public adultRate = 2;
  public youthRate = 0;
  public gstRate = 0.05;
  private readonly hideFooterClass = 'booking-cancel-action-mode';

  
constructor(
  private apiService: ApiService,
  private route: ActivatedRoute,
  private authService: AuthService,
  private cancelService: CancelService,
  private toastService: ToastService,
  private featureFlagService: FeatureFlagService,
  private router: Router
) {}

  async ngOnInit() {
    try {
      // Check if payments are enabled
      this.paymentsEnabled = this.featureFlagService.isEnabled('enablePayments');

      this.userId = this.authService.getCurrentUser();
      await this.loadBooking();
    } catch (error) {
      console.error('Failed to fetch booking cancel:', error);
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    this.updateFooterVisibility(false);
  }

  private async loadBooking(): Promise<void> {
    const bookingId = this.route.snapshot.paramMap.get('id');
    const res: any = await lastValueFrom(this.apiService.get(`bookings/${bookingId}`));

    this.booking = res.data;
    this.booking.nights = this.calculateTotalNights();
    this.booking.totalParty = BookingUtils.formatParty(this.booking.partyContext || {});
    this.acknowledgeCancel = false;
    this.loading = false;
    this.updateFooterVisibility(this.showActionBar());
  }

  private updateFooterVisibility(hideFooter: boolean): void {
    if (hideFooter) {
      document.body.classList.add(this.hideFooterClass);
      return;
    }
    document.body.classList.remove(this.hideFooterClass);
  }

  isBookingCancelled(): boolean {
    return BookingUtils.isCancelled(this.booking);
  }

  isExpired(): boolean {
    return BookingUtils.isExpired(this.booking);
  }

  showActionBar(): boolean {
    return !this.loading && !!this.booking && !this.isBookingCancelled() && !this.isExpired();
  }

  getGeozoneName(): string {
    return BookingUtils.getGeozoneName(this.booking);
  }

  getFacilityName(): string {
    return BookingUtils.getFacilityName(this.booking);
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

  getBookingNumber(): string {
    return BookingUtils.getBookingNumber(this.booking);
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

  getActivityType(): string {
    return Constants.activityTypes?.[BookingUtils.getActivityType(this.booking)]?.display || ''
  }

  getAdultOccupants(): number {
    return BookingUtils.getAdultOccupants(this.booking);
  }

  getYouthOccupants(): number {
    return BookingUtils.getYouthOccupants(this.booking);
  }

  getNightlyAdultCost(): number {
    const totalAdults = this.getAdultOccupants();
    return totalAdults * this.adultRate;
  }

  getNightlyYouthCost(): number {
    const totalYouth = this.getYouthOccupants();
    return totalYouth * this.youthRate;
  }

  getTotalCost(): number {
    const totalNights = this.calculateTotalNights();
    const nightlyAdultCost = this.getNightlyAdultCost();
    const nightlyYouthCost = this.getNightlyYouthCost();
    const totalAdultCost = nightlyAdultCost * totalNights;
    const totalYouthCost = nightlyYouthCost * totalNights;
    return totalAdultCost + totalYouthCost;
  }

  calculateInclusiveGST(): number {
    const totalCost = this.getTotalCost();
    const gstAmount = totalCost * (1 - 1 / (1 + this.gstRate));
    return parseFloat(gstAmount.toFixed(2));
  }

  calculateTotalNights(): number {
    return BookingUtils.getNights(this.booking);
  }

  async onConfirmRefund() {
    if (!this.acknowledgeCancel || this.isBookingCancelled() || this.isExpired()) {
      return;
    }

    try {
      this.cancelling = true;
      await this.cancelService.cancelBooking(this.booking.bookingId, {
        reason: 'Cancelled by user via self-serve'
      });
      this.toastService.addMessage('Booking cancelled successfully', 'Success', ToastTypes.SUCCESS);
      await this.loadBooking();
    } catch (error) {
      console.error('Failed to cancel booking:', error);
      this.toastService.addMessage('Failed to cancel booking. Please try again.', 'Error', ToastTypes.ERROR);
    } finally {
      this.cancelling = false;
    }
  }

  goBack(): void {
    this.router.navigate(['/my-bookings'])
  }
}
