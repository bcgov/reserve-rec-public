import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';

import { FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { StepperService } from '../../../services/stepper.service';
import { CartItem } from '../../../../services/cart.service';
import { Utils } from '../../../../utils/utils';
import { Router } from '@angular/router';

@Component({
  selector: 'app-visitor-details-step',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule
],
  templateUrl: './visitor-details-step.component.html',
  styleUrl: './visitor-details-step.component.scss'
})
export class VisitorDetailsStepComponent implements OnInit {
  @Input() form: FormGroup | null = null;
  @Input() cartItem: CartItem | null = null;
  @Input() bookingSummary: any = null;
  @Input() user: any = null;
  
  @Output() stepCompleted = new EventEmitter<boolean>();
  @Output() stepValidated = new EventEmitter<boolean>();
  
  public utils = Utils;
  public smsOptIn = false;

  constructor(private stepperService: StepperService, private router: Router) {}

  ngOnInit(): void {
    this.smsOptIn = Boolean(this.form?.get('smsOptIn')?.value);

    // SMS reminders require a mobile phone on the account. If there isn't one,
    // force the opt-in off so a stale 'true' from elsewhere can't sneak through.
    if (!this.hasMobilePhone()) {
      this.smsOptIn = false;
      this.form?.patchValue({ smsOptIn: false }, { emitEvent: false });
    }

    // Step is always valid since this screen is informational.
    // Completion is handled by the parent flow when Continue is clicked.
    this.stepperService.markStepValid(1, true);
    this.stepValidated.emit(true);
  }

  hasMobilePhone(): boolean {
    const mobile = this.user?.['custom:mobilePhone'];
    return typeof mobile === 'string' && mobile.trim().length > 0;
  }
  
  formatAddress() {
    let address = {};

    // Parse the BCSC address JSON string into an object
    if (typeof this.user?.address ==='string') {
      try {
        address = JSON.parse(this.user.address);
      } catch (e) {
        console.warn('Failed to parse this.user address JSON:', e);
      }
    } else if (typeof this.user?.address === 'object' && this.user.address !== null) {
      address = this.user.address;
    }

    // Don't shorten CANADA to CA when it comes from BCSC
    if (address?.['country'] === 'CA') {
      address['country'] = 'CANADA'
    } else {
      address['country'] = '';
    }

    // Convert the Cognito customAttributes or BCSC address items to an object
    const parts = {
      streetAddress: '',
      city: '',
      province: '',
      postalCode: '',
      country: '',
    };

    if (this.user?.streetAddress) { 
      parts.streetAddress = this.user.streetAddress;
    } else if (address?.['street_address']) {
      parts.streetAddress = address?.['street_address'];
    }

    if (this.user?.city) {
      parts.city = this.user.city;
    } else if (address?.['locality']) {
      parts.city = address?.['locality'];
    }

    if (this.user?.province) {
      parts.province = this.user.province;
    } else if (address?.['region']) {
      parts.province = address?.['region'];
    }

    if (this.user?.postalCode) {
      parts.postalCode = this.user.postalCode;
    } else if (address?.['postal_code']) {
      parts.postalCode = address?.['postal_code'];
    }

    if (this.user?.country) {
      parts.country = this.user.country;
    } else if (address?.['country']) {
      parts.country = address?.['country'];
    }

    return parts
  }
  
  onSmsOptInChange(): void {
    // Store the SMS opt-in preference
    if (this.form) {
      this.form.patchValue({ smsOptIn: this.smsOptIn });
    }
  }
  
  goToNext(): void {
    // Mark step as completed and proceed to next
    this.stepCompleted.emit(true);
    if (this.cartItem) {
      this.cartItem.visitorDetailsStepCompleted = true;
    }
    this.stepperService.goNext();
  }
  
  goToPrevious(): void {
    this.stepperService.goPrevious();
  }

  onAddPhoneNumber(): void {
    this.router.navigate(['/account-details'], { fragment: 'editContact' });
  }
}
