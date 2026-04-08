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
  
  smsOptIn: boolean = false;
  
  constructor(private stepperService: StepperService) {}
  
  ngOnInit(): void {
    this.smsOptIn = Boolean(this.form?.get('smsOptIn')?.value);

    // Mark step as always valid since we're just displaying info
    this.stepperService.markStepValid(1, true);
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
