import { AfterViewInit, Component, Input, Output, EventEmitter, OnInit, signal, OnDestroy, inject, DestroyRef, ChangeDetectorRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgdsFormsModule } from '@digitalspace/ngds-forms';
import { StepperService } from '../../../services/stepper.service';
import { CartItem } from '../../../../services/cart.service';
import { ApiService } from '../../../../services/api.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OrderSummaryComponent } from '../../../../shared/components/order-summary/order-summary.component';
import { RouterLink } from '@angular/router';
import { AccountInfo, AccountInfoComponent } from '../../../../shared/components/account-info/account-info.component';
import { toWorldlineBillingLocation } from '../../../../data/worldline-billing-location';
import { getBookingCompletionDetails } from '../../../../utils/reservation-form.utils';

// Used for Worldline custom checkout form
declare let customcheckout: any;

type BillingAddressOption = 'account' | 'different';

interface BillingDetails {
  firstName: string;
  lastName: string;
  email: string;
  address1: string;
  address2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  phoneNumber: string;
}

@Component({
  selector: 'app-payment-step',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgdsFormsModule, OrderSummaryComponent, RouterLink, AccountInfoComponent],
  templateUrl: './payment-step.component.html',
  styleUrl: './payment-step.component.scss'
})
export class PaymentStepComponent implements OnInit, AfterViewInit, AfterViewChecked, OnDestroy {
  @Input() form: FormGroup | null = null;
  @Input() cartItem: CartItem | null = null;
  @Input() bookingSummary: any = null;
  @Input() user: any = null;
  @Input() bookingId: string | null = null;
  @Input() sessionId: string | null = null;
  
  @Output() stepCompleted = new EventEmitter<boolean>();
  @Output() stepValidated = new EventEmitter<boolean>();
  @Output() paymentProcessed = new EventEmitter<any>();
  @Output() processingChange = new EventEmitter<boolean>();

  isProcessingPayment = false;

  cardholderName = '';
  billingAddressOption: BillingAddressOption = 'account';
  alternateBillingDetails: BillingDetails = this.emptyBillingDetails();

  private checkoutInstance: any;
  private cardNumberField: any;
  private cardExpiryField: any;
  private cardCVVField: any;
  private destroyRef = inject(DestroyRef);

  cardNumberError = signal<string | null>(null);
  cardExpiryError = signal<string | null>(null);
  cardCVVError = signal<string | null>(null);

  cardNumberComplete = signal(false);
  cardExpiryComplete = signal(false);
  cardCVVComplete = signal(false);

  isProcessing = signal(false);
  paymentError = signal<string | null>(null);
  paymentSucceeded = signal(false);

  // Validate the form and card details to determine if the step is valid
  isFormValid(): boolean {
    return this.isCardDetailsValid() &&
      this.isBillingDetailsValid() &&
      !this.cardNumberError() &&
      !this.cardExpiryError() &&
      !this.cardCVVError();
  }

  // Validate card details based on the custom checkout fields
  private isCardDetailsValid(): boolean {
    return this.cardholderName.trim().length > 0 &&
      this.cardNumberComplete() &&
      this.cardExpiryComplete() &&
      this.cardCVVComplete();
  }

  // Validate billing details based on the selected option (account or different)
  private isBillingDetailsValid(): boolean {
    const details = this.billingAddressOption === 'account'
      ? this.accountBillingDetails
      : this.alternateBillingDetails;
    return Boolean(
      details.firstName.trim() &&
      details.lastName.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email.trim()) &&
      details.address1.trim() &&
      details.city.trim() &&
      details.province.trim() &&
      details.postalCode.trim() &&
      details.country.trim() &&
      details.phoneNumber.trim()
    );
  }

  // Extract billing details from the user object, handling both stringified and object formats for the address
  get accountBillingDetails(): BillingDetails {
    const user = this.user || {};
    let address: Record<string, string> = {};

    // Handle the case where the address is a stringified JSON object
    if (typeof user.address === 'string') {
      try {
        const parsedAddress = JSON.parse(user.address);
        if (parsedAddress && typeof parsedAddress === 'object' && !Array.isArray(parsedAddress)) {
          address = parsedAddress;
        }
      } catch {
        address = {};
      }

    // Handle the case where the address is already an object
    } else if (user.address && typeof user.address === 'object' && !Array.isArray(user.address)) {
      address = user.address;
    }

    // Helper function to get the first non-empty string from a list of values
    const value = (...values: unknown[]): string =>
      values.find((candidate): candidate is string =>
        typeof candidate === 'string' && candidate.trim().length > 0
      )?.trim() || '';
    const country = value(user['custom:country'], address['country']);

    return {
      firstName: value(user.given_name),
      lastName: value(user.family_name),
      email: value(user.email),
      address1: value(user['custom:streetAddress'], user.streetAddress, address['street_address']),
      address2: value(user['custom:unitNumber'], user.unitNumber),
      city: value(user['custom:city'], user.city, address['locality']),
      province: value(user['custom:province'], user.province, address['region']),
      postalCode: value(user['custom:postalCode'], user.postalCode, address['postal_code']),
      country: country === 'CA' ? 'Canada' : country,
      phoneNumber: value(user['custom:mobilePhone'], user.phone_number),
    };
  }

  // Construct an AccountInfo object for display in the account info component
  get accountInfo(): AccountInfo {
    const details = this.accountBillingDetails;
    const cityLine = [details.city, details.province].filter(Boolean)
      .join(details.city && details.province ? ', ' : '') +
      (details.postalCode ? ` ${details.postalCode}` : '');
    const fullName = `${details.firstName} ${details.lastName}`.trim() || 'Not provided';

    return {
      fullName,
      email: details.email || 'Not provided',
      addressLines: [
        details.address1 || 'Not provided',
        ...(details.address2 ? [details.address2] : []),
        cityLine,
        details.country
      ],
      phoneHeading: 'Mobile phone',
      phones: [{ value: details.phoneNumber || 'Not provided' }]
    };
  }
  
  constructor(
    private stepperService: StepperService,
    private apiService: ApiService,
    private cdr: ChangeDetectorRef
  ) {}
  
  ngOnInit(): void {
    this.form?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.validateStep();
    });
    this.validateStep();
  }

  ngAfterViewInit(): void {
    this.initializeCustomCheckout();
  }

  ngAfterViewChecked(): void {
    // Prevent stacking issues
    this.cdr.detectChanges();
  }

  isStepValid(): boolean {
    // Enable stepper validation based on whether the form and card details are complete/valid
    return this.isFormValid();
  }
  
  validateStep(): void {
    const isValid = this.isStepValid();
    this.stepperService.markStepValid(3, isValid); // Step 3 (0-indexed) - payment is 4th step
    this.stepValidated.emit(isValid);
  }
  
  // Initialize and set the checkout fields and style
  private initializeCustomCheckout(): void {
    if (typeof customcheckout !== 'function') {
      this.paymentError.set('Secure checkout could not be loaded. Please refresh and try again.');
      return;
    }

    try {
      this.checkoutInstance = customcheckout();

      // Style the custom checkout when it's loaded in
      const style = {
        base: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          fontSize: '16px',
          fontWeight: '400',
          color: '#212529',
        },
        error: {
          color: '#dc3545',
          ':focus': {
            fontStyle: 'normal',
          },
        },
      };

      this.cardNumberField = this.checkoutInstance.create('card-number', {
        // placeholder: 'Card Number',
        style: style,
      });
      this.cardNumberField.mount('#card-number');

      this.cardExpiryField = this.checkoutInstance.create('expiry', {
        placeholder: 'MM / YY',
        style: style,
      });
      this.cardExpiryField.mount('#card-expiry');

      this.cardCVVField = this.checkoutInstance.create('cvv', {
        // placeholder: 'CVV',
        style: style,
      });
      this.cardCVVField.mount('#card-cvv');

      // Listeners for errors and completions
      this.checkoutInstance.on('error', (event: any) => {
        this.handleFieldError(event);
      });

      this.checkoutInstance.on('complete', (event: any) => {
        this.handleFieldComplete(event);
      });

    } catch (err: any) {
      console.error('Failed to initialize Custom Checkout:', err);
      this.paymentError.set('Failed to load secure checkout fields. Please try again.');
    }
  }

  private handleFieldError(event: any): void {
    switch (event.field) {
      case 'card-number':
        this.cardNumberComplete.set(false);
        this.cardNumberError.set(event.message);
        break;
      case 'expiry':
        this.cardExpiryComplete.set(false);
        this.cardExpiryError.set(event.message);
        break;
      case 'cvv':
        this.cardCVVComplete.set(false);
        this.cardCVVError.set(event.message);
        break;
    }
    this.validateStep();
  }

  private handleFieldComplete(event: any): void {
    switch (event.field) {
      case 'card-number':
        this.cardNumberComplete.set(true);
        this.cardNumberError.set(null);
        break;
      case 'expiry':
        this.cardExpiryComplete.set(true);
        this.cardExpiryError.set(null);
        break;
      case 'cvv':
        this.cardCVVComplete.set(true);
        this.cardCVVError.set(null);
        break;
    }
    this.validateStep();
  }

  // Called in the reservation-flow component
  onSubmit(event?: Event): void {
    event?.preventDefault();

    if (this.isProcessing() || this.paymentSucceeded()) {
      return;
    }

    if (!this.isCardDetailsValid() || this.cardNumberError() || this.cardExpiryError() || this.cardCVVError()) {
      this.paymentError.set('Enter your name and complete all card fields before continuing.');
      return;
    }

    if (!this.isBillingDetailsValid()) {
      this.paymentError.set('Complete all required billing information with a valid email address.');
      return;
    }

    if (!this.checkoutInstance) {
      this.paymentError.set('Secure checkout is unavailable. Please refresh and try again.');
      return;
    }

    const trnAmount = Number(this.cartItem?.feeInformation?.total);
    if (!Number.isFinite(trnAmount) || trnAmount <= 0) {
      this.paymentError.set('There is no payment amount available for this booking.');
      return;
    }

    if (!this.bookingId || !this.sessionId || !this.user?.sub) {
      this.paymentError.set('Booking information is missing. Please return to the previous step and try again.');
      return;
    }

    this.isProcessing.set(true);
    this.processingChange.emit(true);
    this.paymentError.set(null);

    try {
      this.checkoutInstance.createToken((result: any) => {
        if (result?.error) {
          this.isProcessing.set(false);
          this.processingChange.emit(false);
          this.paymentError.set(result.error.message || 'Card tokenization failed. Please check the card details.');
          return;
        }

        if (!result?.token) {
          this.isProcessing.set(false);
          this.processingChange.emit(false);
          this.paymentError.set('Secure checkout did not return a payment token. Please try again.');
          return;
        }

        const billingDetails = this.billingAddressOption === 'account'
          ? this.accountBillingDetails
          : this.alternateBillingDetails;

        const worldlineLocation = toWorldlineBillingLocation(
          billingDetails.province,
          billingDetails.country
        );

        const formValue = this.form?.value || {};
        const bookingDetails = getBookingCompletionDetails(formValue);

        const paymentPayload = {
          bookingId: this.bookingId,
          sessionId: this.sessionId,
          trnAmount,
          token: result.token,
          userId: this.user?.sub,
          namedOccupant: bookingDetails.namedOccupant,
          vehicleInformation: bookingDetails.vehicleInformation,
          equipmentInformation: bookingDetails.equipmentInformation,
          smsOptIn: bookingDetails.smsOptIn,
          cardholderName: this.cardholderName.trim(),
          billingName: `${billingDetails.firstName} ${billingDetails.lastName}`,
          email: billingDetails.email,
          address1: billingDetails.address1,
          address2: billingDetails.address2,
          city: billingDetails.city,
          province: worldlineLocation.province,
          country: worldlineLocation.country,
          postalCode: billingDetails.postalCode,
          phoneNumber: billingDetails.phoneNumber,
        };

        this.apiService.post('transactions', paymentPayload).subscribe({
          next: (response: any) => {
            console.log('Transaction response:', response);
            if (response?.data?.response?.success || response?.success) {
              this.paymentSucceeded.set(true);
              this.isProcessing.set(false);
              this.processingChange.emit(false);
              this.stepCompleted.emit(true);
            } else {
              this.isProcessing.set(false);
              this.processingChange.emit(false);
              this.paymentError.set(response?.response?.message || 'Payment was declined by processor.');
            }
          },
          error: (error: any) => {
            this.isProcessing.set(false);
            this.processingChange.emit(false);
            console.error('POST to /transactions failed:', error);
            this.paymentError.set(error?.error?.message || error?.error?.msg || 'Failed to submit transaction to backend.');
          }
        });
      });
    } catch (error) {
      this.isProcessing.set(false);
      this.processingChange.emit(false);
      console.error('Worldline tokenization failed:', error);
      this.paymentError.set('Card tokenization failed. Please try again.');
    }
  }

  ngOnDestroy(): void {
    // Clean up custom checkout references and elements safely
    try {
      if (this.cardNumberField?.destroy) this.cardNumberField.destroy();
      if (this.cardExpiryField?.destroy) this.cardExpiryField.destroy();
      if (this.cardCVVField?.destroy) this.cardCVVField.destroy();
    } catch (e) {
      console.error('Error destroying secure fields:', e);
    }

    this.cardNumberField = null;
    this.cardExpiryField = null;
    this.cardCVVField = null;
    this.checkoutInstance = null;
  }

  getBillingFullName(): string {
    const first = this.accountBillingDetails?.firstName?.trim() || '';
    const last = this.accountBillingDetails?.lastName?.trim() || '';
    const fullName = `${first} ${last}`.trim();
    return fullName || 'Not provided';
  }

  private emptyBillingDetails(): BillingDetails {
    return {
      firstName: '',
      lastName: '',
      email: '',
      address1: '',
      address2: '',
      city: '',
      province: '',
      postalCode: '',
      country: '',
      phoneNumber: '',
    };
  }
}
