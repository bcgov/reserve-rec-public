import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { StepperService } from '../../../services/stepper.service';
import { CartItem } from '../../../../services/cart.service';

@Component({
  selector: 'app-visitor-details-step',
  standalone: true,
  imports: [
    CommonModule, 
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
  
  smsOptIn = false;

  constructor(private stepperService: StepperService) {}

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
  
  formatAddress(): string {
    const parts = [];
    if (this.user?.streetAddress) parts.push(this.user.streetAddress);
    if (this.user?.city) parts.push(this.user.city);
    if (this.user?.province) parts.push(this.user.province);
    if (this.user?.postalCode) parts.push(this.user.postalCode);
    return parts.length > 0 ? parts.join(', ') : 'N/A';
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
}
