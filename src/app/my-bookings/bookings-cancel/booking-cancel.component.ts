import { Component, OnInit } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ConfirmationModalComponent, ModalRowSpec } from '../../shared/components/confirmation-modal/confirmation-modal.component';
import { BsModalService } from 'ngx-bootstrap/modal';
import { CancelService } from '../../services/cancel.service';
import { ToastService, ToastTypes } from '../../services/toast.service';
import { FeatureFlagService } from '../../services/feature-flag.service';
import { BookingUtils } from '../../utils/booking-utils';

@Component({
  selector: 'app-booking-cancel',
  templateUrl: './booking-cancel.component.html',
  styleUrls: ['./booking-cancel.component.scss'],
  imports: [CommonModule, RouterModule],
  providers: [BsModalService]
})
export class BookingCancelComponent implements OnInit {
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
  public adultRate = 2;
  public youthRate = 0;
  public gstRate = 0.05;

  
constructor(
  private apiService: ApiService,
  private route: ActivatedRoute,
  private authService: AuthService,
  private cancelService: CancelService,
  private router: Router,
  private modalService: BsModalService,
  private toastService: ToastService,
  private featureFlagService: FeatureFlagService
) {}
  async ngOnInit() {
    try {
      // Check if payments are enabled
      this.paymentsEnabled = this.featureFlagService.isEnabled('enablePayments');
      
      const bookingId = this.route.snapshot.paramMap.get('id');
      const res: any = await lastValueFrom(this.apiService.get(`bookings/${bookingId}`));
      
      this.booking = res.data;
      this.booking.nights = this.calculateTotalNights();
      this.booking.totalParty = BookingUtils.formatParty(this.booking.partyContext || {});
      this.userId = this.authService.getCurrentUser();

      this.loading = false;
    } catch (error) {
      console.error('Failed to fetch booking cancel:', error);
    }
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
    const startDate = this.booking.startDate || null;
    const endDate = this.booking.endDate || null;
    if (!startDate || !endDate) {
      return 0;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const totalNights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return totalNights;
  }

  onConfirmRefund() {
    const bookingNumber = this.booking?.bookingId;
    const displayName = this.booking?.geozoneDisplayName || this.booking?.collectionId || 'Unknown';
    const startDate = this.booking?.startDate;
    const endDate = this.booking?.endDate;

    this.displayConfirmationModal(bookingNumber, displayName, startDate, endDate);
  }

  // This sends the submitted form data object to the modal for confirmation, where
  // it constructs a confirmation modal with the details of the protected area and its status.
  displayConfirmationModal(bookingNumber: string, displayName: string, startDate: string, endDate: string): void {
    const details: ModalRowSpec[] = [
      { label: 'Booking number', value: bookingNumber },
      { label: 'Transaction number', value: this.booking.clientTransactionId },
      { label: 'Park name', value: displayName},
      { label: 'Start date', value: startDate },
      { label: 'End date', value: endDate }
    ];

    // Add refund information only if payments are enabled
    if (this.paymentsEnabled) {
      details.push({ label: 'Refunded total', value: `$${this.getTotalCost().toFixed(2)}` });
    }

    // Show the modal with the confirmation details.
    const modalRef = this.modalService.show(ConfirmationModalComponent, {
      initialState: {
        title: this.paymentsEnabled ? 'Confirm cancel and refund' : 'Confirm cancellation',
        details,
        confirmText: this.paymentsEnabled ? 'Cancel & refund' : 'Cancel booking',
        cancelText: 'Back',
        confirmClass: 'btn btn-danger',
        cancelClass: 'btn btn-outline-secondary'
      }
    });

    // Listen for confirmation and cancellation events from the modal.
    const modalContent = modalRef.content as ConfirmationModalComponent;
    modalContent.confirmButton.subscribe(async () => {
      try {
        this.cancelling = true;
        await this.cancelService.cancelBooking(this.booking.bookingId, {
          reason: 'Cancelled by user via self-serve'
        });
        modalRef.hide();
        this.toastService.addMessage('Booking cancelled successfully', 'Success', ToastTypes.SUCCESS);
        this.router.navigate([`/account/bookings/${this.booking.bookingId}`]);
      } catch (error) {
        console.error('Failed to cancel booking:', error);
        this.toastService.addMessage('Failed to cancel booking. Please try again.', 'Error', ToastTypes.ERROR);
        this.cancelling = false;
        modalRef.hide();
      }
    });
    modalContent.cancelButton.subscribe(() => {
      modalRef.hide();
    });
  }
}
