import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CartItem } from '../../services/cart.service';
import { Constants } from '../../constants';
import { FeatureFlagService } from '../../services/feature-flag.service';
import { BookingService } from '../../services/booking.service';
import { BsModalService } from 'ngx-bootstrap/modal';
import { ConfirmationModalComponent } from '../../shared/components/confirmation-modal/confirmation-modal.component';

@Component({
  selector: 'app-cart-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cart-item.component.html',
  styleUrl: './cart-item.component.scss'
})
export class CartItemComponent implements OnInit {
  @Input() item!: CartItem;
  @Input() removeBool: boolean;
  @Output() removeItem = new EventEmitter<string>();

  private modalService = inject(BsModalService)
  
  public paymentsEnabled;
  public hideBookingCostsBool = false;

  constructor(private featureFlagService: FeatureFlagService, private bookingService: BookingService) { }

  async ngOnInit() {
    try {
      // Check if payments are enabled
      this.paymentsEnabled = this.featureFlagService.isEnabled('enablePayments');
    } catch (error) {
      console.error('Failed to fetch feature flags:', error);
    }
  }

  getActivityDisplayName(): string {
    const activityType = this.item?.activityType;
    return Constants.activityTypes[activityType]?.display || this.item?.productName || 'Activity';
  }

  getTotalOccupants(occupants: any) {
    return occupants.totalAdult + occupants.totalSenior +
      occupants.totalYouth + occupants.totalChild;
  }

  getTotalPasses() {
    const occupants = this.item?.occupants || { totalAdult: 0, totalSenior: 0, totalYouth: 0, totalChild: 0 };
    return this.getTotalOccupants(occupants);
  }

  getDisplayDate(timestamp) {
    const date = this.getDateFromTimestamp(timestamp);
    if (!date) {
      return 'N/A';
    }
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  getDisplayTime(timestamp) {
    const date = this.getDateFromTimestamp(timestamp);
    if (!date) {
      return 'N/A';
    }

    const hour = date.getHours();
    const minute = date.getMinutes();
    const isPm = hour >= 12;
    const normalizedHour = hour % 12 || 12;

    if (minute === 0) {
      return `${normalizedHour} ${isPm ? 'pm' : 'am'}`;
    }

    return `${normalizedHour}:${String(minute).padStart(2, '0')} ${isPm ? 'pm' : 'am'}`;
  }

  getDateFromTimestamp(timestamp) {
    if (!timestamp) {
      return null;
    }

    const numericValue = Number(timestamp);
    if (!Number.isFinite(numericValue)) {
      return null;
    }

    const milliseconds = numericValue > 1_000_000_000_000 ? numericValue : numericValue * 1000;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  calculateNights(): number {
    const startDate = new Date(this.item.startDate);
    const endDate = new Date(this.item.endDate);
    const timeDiff = endDate.getTime() - startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  }

  async onRemoveClick() {
    await this.confirmRemoveItem()
  }

  calculateAdultCost(): number {
    const adultRate = 0; // GET THIS FROM FEE REG
    return this.calculateNights() * this.item.occupants.totalAdult * adultRate;
  }

  calculateSeniorCost(): number {
    const seniorRate = 0; // GET THIS FROM FEE REG
    return this.calculateNights() * this.item.occupants.totalSenior * seniorRate;
  }

  calculateYouthCost(): number {
    const youthRate = 0; // GET THIS FROM FEE REG
    return this.calculateNights() * this.item.occupants.totalYouth * youthRate;
  }

  calculateChildCost(): number {
    const childRate = 0; // GET THIS FROM FEE REG
    return this.calculateNights() * this.item.occupants.totalChild * childRate;
  }

  calculateSubtotal(): number {
    return this.calculateAdultCost() + this.calculateSeniorCost() +
      this.calculateYouthCost() + this.calculateChildCost();
  }

  onEditClick(): void {
    console.log('No one has determined how edit will function. Edit clicked for item:', this.item.id);
  }

  onHideBookingCosts() {
    this.hideBookingCostsBool = !this.hideBookingCostsBool;
  }

  private confirmRemoveItem() {
    return new Promise(resolve => {
      const modalRef = this.modalService.show(ConfirmationModalComponent, {
        initialState: {
          title: 'Remove booking',
          body: `Confirm remove this booking from your cart?`,
          confirmText: 'Remove',
          cancelText: 'Cancel',
          confirmClass: 'btn btn-danger',
          cancelClass: 'btn btn-outline-secondary',
        },
      });
      let settled = false;
      const settle = (value: boolean) => {
        if (settled) return;
        // Don't do anything!
        settled = true;
        modalRef.hide();
        resolve(value);
      };
      modalRef.content?.confirmButton.subscribe(() => {
        settle(true);
        this.removeItem.emit(this.item.id);
        this.bookingService.cancelBooking(this.item.bookingId)
        modalRef.hide();
      });
      modalRef.content?.cancelButton.subscribe(() => {
        settle(true);
        modalRef.hide();
      });
      modalRef.onHide?.subscribe(() => settle(true));
    });
  }

}
