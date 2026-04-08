import { AfterContentChecked, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { NgdsFormsModule } from '@digitalspace/ngds-forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { CartService, CartItem } from '../services/cart.service';
import { BookingService } from '../services/booking.service';
import { StepperService } from './services/stepper.service';
import { ProgressIndicatorComponent } from './components/progress-indicator/progress-indicator.component';
import { ConfirmDetailsStepComponent } from './components/steps/confirm-details-step/confirm-details-step.component';
import { VisitorDetailsStepComponent } from './components/steps/visitor-details-step/visitor-details-step.component';
import { EquipmentStepComponent } from './components/steps/equipment-step/equipment-step.component';
import { PaymentStepComponent } from './components/steps/payment-step/payment-step.component';
import { AdmissionCountdownComponent } from '../components/admission-countdown/admission-countdown.component';
import { FeatureFlagService } from '../services/feature-flag.service';

@Component({
  selector: 'app-reservation-flow',
  imports: [
    CommonModule,
    NgdsFormsModule,
    ProgressIndicatorComponent,
    ConfirmDetailsStepComponent,
    VisitorDetailsStepComponent,
    EquipmentStepComponent,
    PaymentStepComponent,
    AdmissionCountdownComponent,
    RouterModule
  ],
  templateUrl: './reservation-flow.component.html',
  styleUrl: './reservation-flow.component.scss'
})
export class ReservationFlowComponent implements OnInit, AfterContentChecked, OnDestroy {

  cartItems: CartItem[] = [];
  public user: any = null;
  public form: UntypedFormGroup;
  public accessPointsSelectionList: any[] = [];
  public currentBookingId: string | null = null;
  public currentSessionId: string | null = null;

  get cartItem(): CartItem | null {
    return this.cartItems[0] || null;
  }

  // Booking summary for stepper components
  public bookingSummary: any = {
    parkName: '',
    activityName: '',
    checkInDate: new Date(),
    checkOutDate: new Date(),
    numberOfNights: 0,
    numberOfOccupants: 0,
    basePrice: 0,
    equipmentTotal: 0,
    taxes: 0,
    total: 0
  };

  constructor(
    private changeDetectorRef: ChangeDetectorRef,
    public router: Router,
    public stepperService: StepperService,
    private cartService: CartService,
    private authService: AuthService,
    private bookingService: BookingService,
    private featureFlagService: FeatureFlagService
  ) {
    this.user = this.authService.getCurrentUser();
  }

  ngOnInit(): void {
    this.loadCartItems();
    this.initializeForCurrentItem();
  }

  private loadCartItems(): void {
    this.cartItems = this.cartService.items();

    if (this.cartItems.length === 0) {
      this.router.navigate(['/']);
      return;
    }

    // Reset completion status for all cart items when entering the flow
    this.cartItems.forEach(item => {
      item.detailsStepCompleted = false;
      item.visitorDetailsStepCompleted = false;
      item.equipmentStepCompleted = false;
      item.paymentStepCompleted = false;
      item.areAllStepsCompleted = false;
    });
  }

  private initializeForCurrentItem(): void {
    if (!this.cartItem) return;
    this.initializeFromCart(this.cartItem);
    this.loadAccessPointsForCurrentItem();
    this.updateBookingSummary();
    // Always start at step 0 for single-item flow
    this.stepperService.goToStep(0);
  }

  private async loadAccessPointsForCurrentItem(): Promise<void> {
    if (!this.cartItem) return;
    
    try {
      
      // TODO: Replace with actual service call
     
      // Mock data for now
      this.accessPointsSelectionList = [
        { value: { pk: 'facility::bcparks_9398', sk: 'accessPoint::1' }, text: 'Main Trailhead', displayName: 'Main Trailhead', },
        { value: { pk: 'facility::bcparks_9398', sk: 'accessPoint::2' }, text: 'North Access Point', displayName: 'North Access Point', },
        { value: { pk: 'facility::bcparks_9398', sk: 'accessPoint::3' }, text: 'South Access Point', displayName: 'South Access Point',  }
      ];
    } catch (error) {
      console.log(error);
      this.accessPointsSelectionList = [];
    }
  }

  private initializeFromCart(cartItem: CartItem): void {
    // Create form from cart data

    this.form = new UntypedFormGroup({
      acknowledgeDetails: new UntypedFormControl(false, [Validators.requiredTrue]),
      entryPoint: new UntypedFormControl(null),
      exitPoint: new UntypedFormControl(null),
      acknowledgePolicies: new UntypedFormControl(false, [Validators.requiredTrue]),
      smsOptIn: new UntypedFormControl(false, { nonNullable: true }),
      
      dateRange: new UntypedFormControl([cartItem.startDate, cartItem.endDate], { nonNullable: true }),
      occupants: new UntypedFormGroup({
        totalAdult: new UntypedFormControl(cartItem.occupants.totalAdult || 0, { nonNullable: true }),
        totalSenior: new UntypedFormControl(cartItem.occupants.totalSenior || 0, { nonNullable: true }),
        totalYouth: new UntypedFormControl(cartItem.occupants.totalYouth || 0, { nonNullable: true }),
        totalChild: new UntypedFormControl(cartItem.occupants.totalChild || 0, { nonNullable: true }),
      }),
      
      // User info (step 3 will add more fields as needed)
      userIsPrimaryOccupant: new UntypedFormControl(this.user && !this.user.sub.startsWith('guest') ? true : false, { nonNullable: true })
    });

  }

  private updateBookingSummary(): void {
    if (this.cartItem && this.form) {
      const startDate = new Date(this.cartItem.startDate);
      const endDate = new Date(this.cartItem.endDate);
      const numberOfNights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const totalOccupants = this.cartItem.occupants.totalAdult + this.cartItem.occupants.totalSenior + 
                            this.cartItem.occupants.totalYouth + this.cartItem.occupants.totalChild;
      
      this.bookingSummary = {
        parkName: this.cartItem.geoZoneName || 'Unknown Park',
        activityName: this.cartItem.activityName || 'Unknown Activity',
        checkInDate: startDate.toISOString(),
        checkOutDate: endDate.toISOString(),
        numberOfNights: numberOfNights,
        numberOfOccupants: totalOccupants,
        basePrice: this.cartItem.feeInformation?.total || 0,
        equipmentTotal: 0,
        taxes: 0, 
        total: this.cartItem.feeInformation?.total || 0
      };
    }
  }

 private checkAllStepsCompleted(): void {
  if (!this.cartItem) return;

  const item = this.cartItems[0];
  
  // Check base steps (Details, Visitor Details, Equipment)
  let allStepsCompleted = item.detailsStepCompleted && 
                          item.visitorDetailsStepCompleted && 
                          item.equipmentStepCompleted;
  
  // If payment is enabled, also check payment step completion
  if (this.featureFlagService.isEnabled('enablePayments')) {
    allStepsCompleted = allStepsCompleted && item.paymentStepCompleted;
  }


  this.cartService.updateCartItem(item.id, {
    ...item,
    areAllStepsCompleted: allStepsCompleted
  });

  
}

async onStepCompleted(completed: boolean): Promise<void> {
  if (!completed) return;
  const formValue = this.form?.value || {};
  
  const currentStep = this.stepperService.currentStepIndex();
  const isOnFinalStep = !this.stepperService.canGoNext();
  const paymentsEnabled = this.featureFlagService.isEnabled('enablePayments');
  
  
  if (this.cartItem?.id) {
    this.saveCurrentFormState(this.cartItem.id);
  }
  
  this.checkAllStepsCompleted();

  // Special handling for equipment step (step 2, 0-indexed)
  // This is where we create the booking for both payment enabled/disabled scenarios
  if (currentStep === 2 && this.cartItem) { 
    try {
      // Create booking for the cart item
      const bookingResponse = await this.createBookingForItem(this.cartItem);
      
      const bookingId = bookingResponse?.bookingId || bookingResponse?.globalId || bookingResponse?.booking?.[0]?.data?.globalId;
      const sessionId = bookingResponse?.sessionId || bookingResponse?.booking?.[0]?.data?.sessionId;

      if (bookingId && sessionId) {
        
        this.currentBookingId = bookingId;
        this.currentSessionId = sessionId;
        
        console.log('✅ Booking created successfully:', {
          bookingId,
          sessionId
        });
      } else {
        throw new Error('Booking creation failed - no booking data returned');
      }
      
      const totalDue = Number(this.cartItem?.feeInformation?.total ?? 0);

      // If payments are disabled (or nothing is owed), navigate directly to confirmation
      if (!paymentsEnabled || totalDue <= 0) {
        console.log('💰 Payments disabled - finalizing booking before confirmation');
        if (!this.currentBookingId || !this.currentSessionId) {
          throw new Error('Missing booking/session IDs for completion');
        }
        const completionPayload = this.getCompletionPayload(formValue, this.currentSessionId);
        await this.bookingService.completeBooking(this.currentBookingId, completionPayload);
        if (this.currentBookingId) {
          window.location.assign(`/booking-confirmation/${this.currentBookingId}`);
        }
        return;
      }
      
      // If payments are enabled, the stepper will advance to payment step
      // The payment step will use this.currentBookingId and this.currentSessionId
      const movedToPayment = this.stepperService.goNext();
      if (!movedToPayment) {
        // Fallback to target payment step index if current validation state blocks goNext.
        this.stepperService.goToStep(3);
      }
      this.changeDetectorRef.detectChanges();
      
    } catch (error: any) {
      console.error('❌ Booking creation failed:', error);
      console.error('❌ Error details:', {
        status: error?.status,
        statusText: error?.statusText,
        message: error?.error?.message,
        error: error?.error,
        fullError: error
      });
      
      // Handle waiting room redirect
      if (error?.waitingRoom && this.cartItem) {
        const params = new URLSearchParams({
          collectionId: this.cartItem.collectionId,
          activityType: this.cartItem.activityType,
          activityId: this.cartItem.activityId,
          startDate: this.cartItem.startDate,
          returnUrl: '/checkout',
        });
        window.location.href = `/waitingroom.html?${params.toString()}`;
        return;
      }
      
      // Handle validation errors
      if (error?.status === 400) {
        const errorMessage = error?.error?.message || 'Your booking request could not be completed. Please check the booking details and try again.';
        alert(`Booking Error: ${errorMessage}`);
        return;
      }
      
      alert('There was an error creating your booking. Please try again later.');
      return;
    }
  }

  // If we're on the final step (payment step when payments enabled)
  if (isOnFinalStep && paymentsEnabled) {
    console.log('📍 On payment step (final step). Payment should redirect to gateway.');
    // The payment step handles its own redirect to payment gateway
    // After payment returns, transaction-status component handles navigation to confirmation
    this.changeDetectorRef.detectChanges();
  }
}

  onStepValidated(isValid: boolean): void {
    if(isValid) {
      this.changeDetectorRef.detectChanges();
    }
  }
  async createBookingForItem(item: CartItem): Promise<any> {
    const formValue = this.form?.value;
    if (!formValue) {
      throw new Error('Form data not available');
    }

    const bookingData = {
      startDate: item.startDate,
      endDate: item.endDate,
      productId: item.productId || null,
      quantity: item.quantity || 1,
      entryPoint: formValue.entryPoint || null,
      exitPoint: formValue.exitPoint || null,
      displayName: item.activityName,
      timezone: 'America/Vancouver',
      bookedAt: new Date().toISOString(),
      collectionId: item.collectionId,
      activityId: item.activityId,
      activityType: item.activityType,
      feeInformation: item.feeInformation,
      userId: this.user?.sub || 'guest',
      partyInformation: {
        adult: item.occupants.totalAdult,
        senior: item.occupants.totalSenior,
        youth: item.occupants.totalYouth,
        child: item.occupants.totalChild,
      },
      rateClass: 'standard',
      namedOccupant: this.getNamedOccupantInfo(formValue),
      smsOptIn: Boolean(formValue?.smsOptIn),
      vehicleInformation: this.getVehicleInformation(formValue),
      equipmentInformation: formValue?.equipmentDetails || formValue?.additionalEquipment || '',
      bookingStatus: 'confirmed',
      location: { type: 'point', coordinates: [-127.86704491749371, 50.85383286629616] }
    };

    console.log('Creating booking:', bookingData);

    return await this.bookingService.createBooking(
      bookingData,
      item.collectionId,
      item.activityType,
      item.activityId,
      item.startDate
    );
  }

  private getNamedOccupantInfo(formValue: any): any {
    const userIsOccupant = formValue.userIsPrimaryOccupant;
    const accountMobilePhone = this.user?.['custom:mobilePhone'] || this.user?.phone_number || '';
    return {
      firstName: userIsOccupant ? this.user?.given_name || '' : formValue.primaryOccupant?.firstName || '',
      lastName: userIsOccupant ? this.user?.family_name || '' : formValue.primaryOccupant?.lastName || '',
      contactInfo: {
        email: userIsOccupant ? this.user?.email || '' : formValue.primaryOccupant?.email || '',
        mobilePhone: userIsOccupant ? accountMobilePhone : formValue.primaryOccupant?.phoneNumber || '',
        streetAddress: formValue.addressInfo?.streetAddress || '',
        city: formValue.addressInfo?.city || '',
        postalCode: formValue.addressInfo?.postalCode || '',
        province: formValue.addressInfo?.province || '',
        country: formValue.addressInfo?.country || ''
      }
    };
  }

  private getVehicleInformation(formValue: any): any[] {
    const equipmentInfo = formValue?.equipmentInfo || {};
    const licensePlate = (equipmentInfo?.licensePlate || '').trim();
    const registeredProvince = (equipmentInfo?.registeredProvince || '').trim();

    if (!licensePlate && !registeredProvince) {
      return [];
    }

    return [
      {
        licensePlate,
        licensePlateRegistrationRegion: registeredProvince
      }
    ];
  }

  private getCompletionPayload(formValue: any, sessionId: string | null): any {
    return {
      sessionId: sessionId,
      namedOccupant: this.getNamedOccupantInfo(formValue),
      vehicleInformation: this.getVehicleInformation(formValue),
      equipmentInformation: formValue?.equipmentDetails || formValue?.additionalEquipment || ''
    };
  }

  completeReservation(): void {
    this.cartService.clearCart();
    this.router.navigate(['/']);
  }

  // Navigation
  navigate(): void {
    this.router.navigate(['/']);
  }

  ngAfterContentChecked(): void {
    this.changeDetectorRef.detectChanges();
  }

  ngOnDestroy(): void {
    this.stepperService.reset();
    this.changeDetectorRef.detach();
    }

private formStates = new Map<string | number, any>();

private saveCurrentFormState(itemId?: string | number): void {
  if (!itemId || !this.form) return;

  const formState = this.form.getRawValue(); // Get all form values including disabled controls
  this.formStates.set(itemId, formState);
}

private loadFormStateForItem(itemId: string | number): any {
  const savedState = this.formStates.get(itemId);
  return savedState;
}
}
