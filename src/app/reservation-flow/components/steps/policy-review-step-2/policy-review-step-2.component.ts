import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgdsFormsModule } from '@digitalspace/ngds-forms';
import { StepperService } from '../../../services/stepper.service';
import { CartItem } from '../../../../services/cart.service';

@Component({
  selector: 'app-policy-review-step-2',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgdsFormsModule],
  templateUrl: './policy-review-step-2.component.html',
  styleUrl: './policy-review-step-2.component.scss'
})
export class PolicyReviewStep2Component implements OnInit {
  @Input() form: FormGroup | null = null;
  @Input() cartItem: CartItem | null = null;
  @Input() bookingSummary: any = null;
  
  @Output() stepCompleted = new EventEmitter<boolean>();
  @Output() stepValidated = new EventEmitter<boolean>();
  
  constructor(private stepperService: StepperService) {}
  
  ngOnInit(): void {
    if (this.form) {
      this.form.valueChanges.subscribe(() => {
        const isAcknowledged = !!this.form?.get('acknowledgePolicies')?.value;
        this.stepperService.markStepValid(1, isAcknowledged);
        this.stepValidated.emit(isAcknowledged);

        if (this.cartItem) {
          this.cartItem.step2Completed = isAcknowledged;
        }
      });
    }
  }

  goToNext(): void {
    if (this.cartItem?.step2Completed) {
      this.stepCompleted.emit(true);
      this.stepperService.goNext();
    }
  }

  goToPrevious(): void {
    this.stepperService.goPrevious();
  }
}