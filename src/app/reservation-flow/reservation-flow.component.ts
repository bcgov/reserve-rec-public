import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { NgdsFormsModule } from '@digitalspace/ngds-forms';

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
import { BreadcrumbComponent } from '../shared/breadcrumb/breadcrumb.component';
import { ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { CartTimerComponent } from '../cart/cart-timer/cart-timer.component';
import { getBookingCompletionDetails } from '../utils/reservation-form.utils';

@Component({
  selector: 'app-reservation-flow',
  imports: [
    NgdsFormsModule,
    ProgressIndicatorComponent,
    ConfirmDetailsStepComponent,
    VisitorDetailsStepComponent,
    EquipmentStepComponent,
    PaymentStepComponent,
    AdmissionCountdownComponent,
    RouterModule,
    BreadcrumbComponent,
    CartTimerComponent
  ],
  templateUrl: './reservation-flow.component.html',
  styleUrl: './reservation-flow.component.scss'
})
export class ReservationFlowComponent implements OnInit, OnDestroy {

  cartItems: CartItem[] = [];
  currentStep = 0;
  private stepSub?: Subscription;
  public user: any = null;
  public form: UntypedFormGroup;
  public accessPointsSelectionList: any[] = [];
  public currentBookingId: string | null = null;
  public currentSessionId: string | null = null;
  @ViewChild(PaymentStepComponent) private paymentStepComponent?: PaymentStepComponent;
  // True while the booking is being created/completed, to disable the Finish
  // button and block double-submission (#541).
  public isSubmitting = false;
  public isPaymentProcessing = false;

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

  public titlesBackButtonMap = {
    'cart': 'cart',
    'details': 'agreements',
    'occupant details': 'camping party',
    'equipment': 'equipment',
  };

  constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private elementRef: ElementRef,
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
    this.stepperService.reset();
    this.stepSub = this.stepperService.currentStep$.subscribe(() => {
      this.currentStep = this.stepperService.currentStepIndex();
    });
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
    // Initialize booking IDs from cart item (created when user clicked "book")
    this.currentBookingId = this.cartItem?.bookingId || null;
    this.currentSessionId = this.cartItem?.sessionId || null;
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
        { value: { pk: 'facility::bcparks_9398', sk: 'accessPoint::3' }, text: 'South Access Point', displayName: 'South Access Point', }
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


      // TODO: wil need adjusting when we create fee policy
      this.bookingSummary = {
        parkName: this.cartItem.geozoneName || 'Unknown Park',
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
    if (this.isPaymentRequired()) {
      allStepsCompleted = allStepsCompleted && item.paymentStepCompleted;
    }


    this.cartService.updateCartItem(item.id, {
      ...item,
      areAllStepsCompleted: allStepsCompleted
    });


  }

  async onStepCompleted(completed: boolean): Promise<void> {
    if (!completed) return;
    if (!this.cartItem) return;

    const currentStep = this.stepperService.currentStepIndex();
    switch (currentStep) {
      case 0:
        this.cartItem.detailsStepCompleted = true;
        break;
      case 1:
        this.cartItem.visitorDetailsStepCompleted = true;
        break;
      case 2:
        this.cartItem.equipmentStepCompleted = true;
        break;
      case 3:
        this.cartItem.paymentStepCompleted = true;
        break;
      default:
        return;
    }
    this.checkAllStepsCompleted();

    if (currentStep === 2) {
      if (this.isPaymentRequired()) {
        this.stepperService.goNext();
        this.changeDetectorRef.detectChanges();
        return;
      }

      // Call the completeBooking method (different than payment completion flow)
      await this.finalizeBooking();
      return;
    }

    if (currentStep === 3) {
      const bookingId = this.currentBookingId || this.cartItem.bookingId;
      if (!bookingId) {
        console.error('Payment succeeded, but the booking ID is unavailable.');
        alert('Your payment was received, but we could not open the booking confirmation. Please contact support.');
        return;
      }

      // The token transaction API records payment and completes the booking.
      // Do not call completeBooking here, transaction endpoint will complete the booking process
      // within the processTokenTransaction method.
      // Redirect after payment success.
      this.isSubmitting = true;
      this.cartService.cartTimerIsActive.set(false);
      this.changeDetectorRef.detectChanges();
      this.redirectToConfirmation(bookingId);
      return;
    }

    if (this.stepperService.canGoNext()) {
      this.stepperService.goNext();
    }
  }

  private isPaymentRequired(): boolean {
    const totalDue = Number(this.cartItem?.feeInformation?.total ?? 0);
    return this.featureFlagService.isEnabled('enablePayments') &&
      Number.isFinite(totalDue) &&
      totalDue > 0;
  }

  private async finalizeBooking(): Promise<void> {
    // Guard against double-submission: while the create/complete request is in
    // flight the Finish button is disabled, but block re-entry too (#541).
    if (!this.cartItem || this.isSubmitting) return;

    // Get a queryTime immediately, for eventual submitting form - used on backed to check expiry time.
    // Give the user about 7 seconds buffer for final submission and processing. Because we're nice.
    const bufferWindowInMs = 7000;
    const queryTime = Date.now() - bufferWindowInMs;
    let submissionSucceeded = false;
    this.isSubmitting = true;

    // Turn off cart timer when submitting to avoid pop up
    this.cartService.cartTimerIsActive.set(false);
    this.changeDetectorRef.detectChanges();

    try {
      // Create booking for the cart item
      const bookingResponse = await this.createBookingForItem(this.cartItem);

      // Extract bookingId and sessionId from the response structure
      // Response structure: { code, data: { bookingId, sessionId, ... }, msg, error, context }
      const bookingId = bookingResponse?.data?.bookingId ||
                        bookingResponse?.bookingId ||
                        bookingResponse?.globalId ||
                        bookingResponse?.booking?.[0]?.data?.globalId;

      const sessionId = bookingResponse?.data?.sessionId ||
                        bookingResponse?.sessionId ||
                        bookingResponse?.booking?.[0]?.data?.sessionId;

      if (!bookingId || !sessionId) {
        throw new Error('Booking completion failed - missing booking or session ID');
      }

      this.currentBookingId = bookingId;
      this.currentSessionId = sessionId;
      const completionPayload = this.getCompletionPayload(
        this.form?.value || {},
        sessionId,
        queryTime
      );
      await this.bookingService.completeBooking(bookingId, completionPayload);

      submissionSucceeded = true;
      this.redirectToConfirmation(bookingId);
    } catch (error: any) {
      console.error('Booking creation failed:', error);
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
        window.location.href = new URL(`waitingroom.html?${params.toString()}`, document.baseURI).toString();
        return;
      }
      // Busy, not failed: the hold is kept, so an immediate retry is the right advice.
      if (error?.status === 503) {
        alert(error?.error?.msg || 'The service is busy. Please try again in a moment.');
        return;
      }
      // Handle validation errors
      if (error?.status === 400) {
        // The API puts its reason in `msg`; `message` is kept for older responses.
        const errorMessage = error?.error?.msg ||
                             error?.error?.message ||
                             'Your booking request could not be completed. Please check the booking details and try again.';
        alert(`Booking Error: ${errorMessage}`);
        return;
      }

      alert('There was an error completing your booking. Please try again later.');
    } finally {
      // Re-enable the button on any exit (error/retry, or advancing to the
      // payment step). On the navigate-away success path the page unloads.
      this.isSubmitting = false;
      // Reactivate the cart timer on a failed submission, so expired item can be
      // removed and released
      if (!submissionSucceeded) {
        this.cartService.cartTimerIsActive.set(true);
      }
      this.changeDetectorRef.detectChanges();
    }
  }

  onStepValidated(isValid: boolean): void {
    if (isValid) {
      this.changeDetectorRef.detectChanges();
    }
  }

  onPaymentProcessingChange(isProcessing: boolean): void {
    this.isPaymentProcessing = isProcessing;
    this.changeDetectorRef.detectChanges();
  }

  async createBookingForItem(item: CartItem): Promise<any> {
    // Booking already created upfront when user clicked "book" button
    // Just return the existing booking reference
    if (!item.bookingId || !item.sessionId) {
      throw new Error('Booking must be created upfront - missing bookingId or sessionId');
    }

    console.log('Booking created:', {
      bookingId: item.bookingId,
      sessionId: item.sessionId
    });

    return {
      bookingId: item.bookingId,
      sessionId: item.sessionId,
      globalId: item.bookingId
    };
  }

  private normalizeProductId(productId?: string): string | null {
    if (!productId) {
      return null;
    }

    return productId.split('::')[0] || null;
  }

  private getCompletionPayload(formValue: any, sessionId: string | null, queryTime: number): any {
    return {
      sessionId: sessionId,
      queryTime: queryTime,
      ...getBookingCompletionDetails(formValue)
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

  goBack(): void {
    this.stepperService.goPrevious();
  }

  showBackButton(): boolean {
    return this.stepperService.currentStepIndex() > 0;
  }

  getBackButtonLabel(): string {
    const idx = this.stepperService.currentStepIndex();
    if (idx <= 0) return 'Back';
    const previousTitle = this.stepperService.getSteps()[idx - 1]?.title;
    return previousTitle ? `Back to ${this.titlesBackButtonMap[previousTitle.toLowerCase()]}` : 'Back';
  }

  canProceed(): boolean {
    // Check that the cart has items, and current step is valid too
    // If the current step is the payment step, also check that payment
    // has not already been completed for this cart item.
    return this.cartService.items().length > 0 &&
      !(this.stepperService.currentStepIndex() === 3 && this.cartItem?.paymentStepCompleted) &&
      this.stepperService.getCurrentStep().isValid;
  }

  proceedToNext(): void {
    // If cart items are empty, send back to /cart
    if (this.cartService.items().length === 0) {
      this.router.navigate(['/cart']);
      return;
    }
    if (!this.canProceed()) return;
    if (this.isSubmitting || this.isPaymentProcessing) return;

    const currentStep = this.stepperService.currentStepIndex();

    // Step 0 just advances the stepper
    if (currentStep === 0) {
      if (this.cartItem) {
        this.cartItem.detailsStepCompleted = true;
      }
      this.stepperService.goNext();
      return;
    }

    // Step 1 (Visitor Details) - mark completed and advance
    if (currentStep === 1) {
      if (this.cartItem) {
        this.cartItem.visitorDetailsStepCompleted = true;
      }
      this.stepperService.goNext();
      return;
    }

    if (currentStep === 2) {
      void this.onStepCompleted(true);
      return;
    }

    if (currentStep === 3) {
      if (!this.paymentStepComponent) {
        console.error('Payment step is not available to submit.');
        alert('The payment form could not be submitted. Please refresh and try again.');
        return;
      }
      this.paymentStepComponent.onSubmit();
      return;
    }
  }

  getNextButtonLabel(): string {
    const currentStep = this.stepperService.currentStepIndex();

    const lastStepIndex = this.isPaymentRequired() ? 3 : 2;

    if (currentStep === lastStepIndex) {
      return this.isPaymentRequired() ? 'Finish and pay' : 'Finish';
    }

    return 'Continue';
  }

  ngOnDestroy(): void {
    this.stepSub?.unsubscribe();
    this.cartService.cartTimerIsActive.set(true);
    this.elementRef.nativeElement.remove();
  }

  @ViewChild('cancelBookingModal', { static: false }) cancelBookingModal?: ElementRef;
  private cancelModalInstance: any;

  backToCart() {
    this.router.navigate(['/cart'])
  }

  // Resolve against <base href> so full-page navigations work both at the
  // domain root and path-mounted behind the front door (/dayuse/), where the
  // deploy rewrites <base href> to the prefix. A leading-slash path would
  // escape the mount and land on a route that does not exist there
  // (bcgov/reserve-rec-public#704). An empty path resolves to the base itself.
  private absoluteUrl(path: string): string {
    return new URL(path, document.baseURI).toString();
  }

  private redirectToConfirmation(bookingId: string): void {
    window.location.assign(this.absoluteUrl(`booking-confirmation/${bookingId}`));
  }
}
