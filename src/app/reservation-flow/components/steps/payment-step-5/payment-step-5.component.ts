import { Component, Input, Output, EventEmitter, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgdsFormsModule } from '@digitalspace/ngds-forms';
import { StepperService } from '../../../services/stepper.service';
import { CartItem } from '../../../../services/cart.service';
import { BookingService } from '../../../../services/booking.service';
import { Router } from '@angular/router';
import { ApiService } from '../../../../services/api.service';
import { DataService } from '../../../../services/data.service';
import { LoadingService } from '../../../../services/loading.service';
import { Constants } from '../../../../constants';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-payment-step-5',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgdsFormsModule],
  templateUrl: './payment-step-5.component.html',
  styleUrl: './payment-step-5.component.scss'
})
export class PaymentStep5Component implements OnInit {
  @Input() form: FormGroup | null = null;
  @Input() cartItem: CartItem | null = null; // Added: cart-based input
  @Input() bookingSummary: any = null; // Added: booking summary
  @Input() user: any = null; // Added: user information
  
  @Output() stepCompleted = new EventEmitter<boolean>();
  @Output() stepValidated = new EventEmitter<boolean>();
  @Output() paymentProcessed = new EventEmitter<any>(); // Added: payment processing event

  isProcessingPayment = false;

  public transactionUrl;
  public _transactionUrlSignal = signal(null);
  
  constructor(
    private stepperService: StepperService,
    private bookingService: BookingService,
    private router: Router,
    private apiService: ApiService,
    private dataService: DataService,
    private loadingService: LoadingService
  ) {}
  
  ngOnInit(): void {

    if (this.form) {
      this.form.valueChanges.subscribe(() => {
        this.validateStep();
      });
    }
    
    this.validateStep();
  }
  
  isStepValid(): boolean {
    return !!(this.form && this.cartItem && this.bookingSummary);
  }
  
  validateStep(): void {
    const isValid = this.isStepValid();
    this.stepperService.markStepValid(4, isValid); // Step 4 (0-indexed)
    this.stepValidated.emit(isValid);
  }
  
  async processPayment(): Promise<void> {
  if (!this.isStepValid() || this.isProcessingPayment) return;
  
  this.isProcessingPayment = true;

  try {
    const submissionValue = this.formatFormForSubmission();
    
    const booking = await this.bookingService.createBooking(
      submissionValue, 
      this.cartItem.collectionId, 
      this.cartItem.activityType, 
      this.cartItem.activityId, 
      submissionValue.startDate
    );
    
    const bookingId = booking?.booking?.[0]?.data?.globalId || null;
    const sessionId = booking?.booking?.[0]?.data?.sessionId || null;
    
    if (bookingId && sessionId) {
      // This will redirect the user to the payment gateway
      await this.initiateTransaction(bookingId, sessionId, this.form.get('primaryOccupant.email').value || this.user?.email || '');
    } else {
      throw new Error('Booking creation failed, no booking ID returned.');
    }

  } catch (error) {
    console.error('Error creating booking:', error);
    alert(`There was an error creating your booking. Please try again later.`);
    this.isProcessingPayment = false;
  }
}

  formatFormForSubmission() {
    const formValue = this.form.value;

    const bookedAt = new Date().toISOString();
    const formattedValue = {
      startDate: formValue.dateRange[0],
      endDate: formValue.dateRange[1],
      entryPoint: this.getFormattedAccessPointKey(formValue?.entryPoint),
      exitPoint: this.getFormattedAccessPointKey(formValue?.exitPoint),
      displayName: this.cartItem?.activityName || '',
      timezone: 'America/Vancouver', // Todo - update to reflect activity timezone
      bookedAt: bookedAt,
      collectionId: this.cartItem?.collectionId || '',
      activityId: this.cartItem?.activityId || '',
      activityType: this.cartItem?.activityType || '',
      feeInformation: {
        registrationFees: 0, // Todo - update to reflect registration fees
        transactionFees: 0, // Todo - update to reflect transaction fees
        tax: this.getTaxes() || 0, // Todo - update to reflect tax calculation
        total: this.getTotalCost(),
      },
      userId: this.user?.sub ? this.user.sub : 'guest',
      partyInformation: {
        adult: parseInt(formValue.occupants.totalAdult) || 0,
        senior: parseInt(formValue.occupants.totalSenior) || 0,
        youth: parseInt(formValue.occupants.totalYouth) || 0,
        child: parseInt(formValue.occupants.totalChild) || 0,
      },
      rateClass: 'standard', // Todo - update to reflect activity rate class
      namedOccupant: this.getNamedOccupantInformation(),
      vehicleInformation: formValue?.vehicleInfo || [],
      equipmentInformation: formValue?.additionalEquipment || '',
      bookingStatus: 'confirmed',
      location: formValue?.entryPoint?.location ? formValue.entryPoint?.location : { type: "point", coordinates: [-127.86704491749371, 50.85383286629616] } // Todo - update to reflect actual location
    };

    console.log('Formatted Submission Value:', formattedValue);

    if (!formattedValue.userId) {
      delete formattedValue.userId; // Remove user if not logged in
    }

    return formattedValue;
  }

  getFormattedAccessPointKey(accessPoint){
    if (!accessPoint) return null;

    const mockData = [
      { pk: 'facility::bcparks_9398', sk: 'accessPoint::1', value: 'Main Trailhead' },
      { pk: 'facility::bcparks_9398', sk: 'accessPoint::2', value: 'North Access Point' },
      { pk: 'facility::bcparks_9398', sk: 'accessPoint::3', value: 'South Access Point' }
    ];

    const entryPointKey = mockData.find(item => item.value === accessPoint);

    return entryPointKey ? { pk: entryPointKey.pk, sk: entryPointKey.sk } : null;
  }

  getNamedOccupantInformation() {
    const userIsOccupant = this.form.get('userIsPrimaryOccupant').value;
    const obj = {
      firstName: userIsOccupant ? this.user?.given_name || '' : this.form.get('primaryOccupant.firstName').value,
      lastName: userIsOccupant ? this.user?.family_name || '' : this.form.get('primaryOccupant.lastName').value,
      contactInfo: {
        email: userIsOccupant ? this.user?.email || '' : this.form.get('primaryOccupant.email').value,
        mobilePhone: userIsOccupant ? this.user?.phone_number || '' : this.form.get('primaryOccupant.phoneNumber').value,
        streetAddress: userIsOccupant ? this.user?.address?.streetAddress || '' : this.form.get('addressInfo.streetAddress').value,
        unitNumber: userIsOccupant ? this.user?.address?.unitNumber || '' : this.form.get('addressInfo.unitNumber').value,
        postalCode: userIsOccupant ? this.user?.address?.postalCode || '' : this.form.get('addressInfo.postalCode').value,
        city: userIsOccupant ? this.user?.address?.city || '' : this.form.get('addressInfo.city').value,
        province: userIsOccupant ? this.user?.address?.province || '' : this.form.get('addressInfo.province').value,
        country: userIsOccupant ? this.user?.address?.country || '' : this.form.get('addressInfo.country').value,
      }
    };

    for (const key in obj.contactInfo) {
      if (obj.contactInfo[key] === '') {
        delete obj.contactInfo[key];
      }
    }
    return obj;
  }

  getTotalCost(): number {
    const totalNights = this.calculateTotalNights();
    const nightlyAdultCost = this.getNightlyAdultCost();
    const nightlyYouthCost = this.getNightlyYouthCost();
    const totalAdultCost = nightlyAdultCost * totalNights;
    const totalYouthCost = nightlyYouthCost * totalNights;
    return totalAdultCost + totalYouthCost;
  }

  // TODO: GST calculation needs to be fixed based on correct tax rates
  // calculateInclusiveGST(): number {
  //   const totalCost = this.getTotalCost();
  //   const gstAmount = totalCost * (1 - 1 / (1 + this.cartItem?.total));
  //   return parseFloat(gstAmount.toFixed(2));
  // }

  getNightlyAdultCost(): number {
    const totalAdults = this.getAdultOccupants();
    return totalAdults * this.cartItem.occupants?.totalAdult;
  }

  getNightlyYouthCost(): number {
    const totalYouth = this.getYouthOccupants();
    return totalYouth * this.cartItem.occupants?.totalYouth;
  }

  getAdultOccupants(): number {
    return parseInt(this.form.get('occupants.totalAdult').value || 0) + parseInt(this.form.get('occupants.totalSenior').value || 0);
  }

  getYouthOccupants(): number {
    return parseInt(this.form.get('occupants.totalYouth').value || 0) + parseInt(this.form.get('occupants.totalChild').value || 0);
  }

  async initiateTransaction(bookingId: string, sessionId: string, email: string) {
    const totalCost = this.getTotalCost();
    const body = {
      trnAmount: totalCost,
      bookingId: bookingId,
      sessionId: sessionId,
      email: email,
    };

    try {
      this.loadingService.addToFetchList(Constants.dataIds.TRANSACTION_POST_RESULTS);
      const res: any = await lastValueFrom(this.apiService.post(`transactions`, body, {}));

      const transactionUrl = res?.data?.response?.transaction?.data?.transactionUrl;

      if (transactionUrl) {
        this.dataService.setItemValue(Constants.dataIds.TRANSACTION_POST_RESULTS, res);
        this.loadingService.removeFromFetchList(Constants.dataIds.TRANSACTION_POST_RESULTS);

        // Redirect to payment gateway
        window.location.href = transactionUrl;
      } else {
        throw new Error('No transaction URL returned');
      }
    } catch (error) {
      console.error('Failed to create transaction:', error);
      this.loadingService.removeFromFetchList(Constants.dataIds.TRANSACTION_POST_RESULTS);
      alert('Failed to initiate payment. Please try again.');
    }
  }
  
  goToPrevious(): void {
    this.stepperService.goPrevious();
  }

  // Helper methods for template
  getParkName(): string {
    return this.cartItem?.geoZoneName || 'Unknown Park';
  }
  
  getActivityName(): string {
    return this.cartItem?.activityName || 'Unknown Activity';
  }
  
  calculateTotalOccupants(): number {
    if (!this.cartItem?.occupants) return 0;
    
    const occupants = this.cartItem.occupants;
    return (occupants.totalAdult || 0) + 
           (occupants.totalSenior || 0) + 
           (occupants.totalYouth || 0) + 
           (occupants.totalChild || 0);
  }
  
  calculateTotalNights(): number {
    if (!this.cartItem) return 0;
    
    const startDate = new Date(this.cartItem.startDate);
    const endDate = new Date(this.cartItem.endDate);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const totalNights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return totalNights;
  }
  
  // Booking summary helpers
  getSubtotal(): number {
    return this.bookingSummary?.basePrice || this.cartItem?.feeInformation?.total || 0;
  }
  
  getEquipmentTotal(): number {
    return this.bookingSummary?.equipmentTotal || 0;
  }
  
  getTaxes(): number {
    return this.bookingSummary?.taxes || 0;
  }
  
  getGrandTotal(): number {
    return this.getSubtotal() + this.getEquipmentTotal() + this.getTaxes();
  }
}
