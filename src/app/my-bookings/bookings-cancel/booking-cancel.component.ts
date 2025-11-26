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
  public adultRate = 2;
  public youthRate = 0;
  public gstRate = 0.05;

  
constructor(
  private apiService: ApiService,
  private route: ActivatedRoute,
  private authService: AuthService,
  private cancelService: CancelService,
  private router: Router,
  private modalService: BsModalService
) {}
  async ngOnInit() {
    try {
      const bookingId = this.route.snapshot.paramMap.get('id');
      const res: any = await lastValueFrom(this.apiService.get(`bookings/${bookingId}`));
      
      this.booking = res.data;
      console.log('this.booking', this.booking);
      
      const transRes: any = await lastValueFrom(this.apiService.get(`transactions/${this.booking.clientTransactionId}`));
      console.log('transRes >>>', transRes);

      this.booking.nights = this.calculateNights(this.booking.startDate, this.booking.endDate);
      this.booking.totalParty = this.formatParty(this.booking.partyInformation);
      // this.mapObj = this.formatMapCoords(this.booking);
      this.userId = this.authService.getCurrentUser();

      // if(this.user.sub != this.booking.user){
      //   console.error('User does not match booking user');
      //   this.router.navigate(['/']); 
      //   return;
      // }
      this.loading = false;
    } catch (error) {
      console.error('Failed to fetch booking cancel:', error);
    }
  }

  formatParty(partyInfo: Record<string, number>) {
    const partyKeys = Object.keys(partyInfo)
    let totalParty = 0;
    for (const partyKey of partyKeys) {
      totalParty += partyInfo[partyKey];
    }
    return totalParty;
  }

  calculateNights(start: string, end: string): number {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  getAdultOccupants(): number {
    return parseInt(this.booking.partyInformation.adult || 0) + parseInt(this.booking.partyInformation.senior || 0);
  }

  getYouthOccupants(): number {
    return parseInt(this.booking.partyInformation.youth || 0) + parseInt(this.booking.partyInformation.children || 0);
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
    const displayName = this.booking?.displayName;
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
      { label: 'End date', value: endDate },
      { label: 'Refunded total', value: `$${this.getTotalCost().toFixed(2)}` }
    ];

    // Show the modal with the confirmation details.
    const modalRef = this.modalService.show(ConfirmationModalComponent, {
      initialState: {
        title: 'Confirm cancel and refund',
        details,
        confirmText: 'Cancel & refund',
        cancelText: 'Back',
        confirmClass: 'btn btn-danger',
        cancelClass: 'btn btn-outline-secondary'
      }
    });

    // Listen for confirmation and cancellation events from the modal.
    const modalContent = modalRef.content as ConfirmationModalComponent;
    modalContent.confirmButton.subscribe(() => {
      this.cancelService.cancelBooking(this.booking.bookingId, {
        reason: 'Cancelled by user via self-serve'
      });
      modalRef.hide();
      this.router.navigate([`/account/bookings/${this.booking.bookingId}`]);
    });
    modalContent.cancelButton.subscribe(() => {
      modalRef.hide();
    });
  }
}
