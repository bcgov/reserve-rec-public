import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgdsFormsModule } from '@digitalspace/ngds-forms';
import { StepperService } from '../../../services/stepper.service';
import { CartItem } from '../../../../services/cart.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-confirm-details-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgdsFormsModule],
  templateUrl: './confirm-details-step.component.html',
  styleUrl: './confirm-details-step.component.scss',
})
export class ConfirmDetailsStepComponent implements OnInit, OnChanges, OnDestroy {
  @Input() form: FormGroup | null = null;
  @Input() cartItem: CartItem | null = null;
  @Input() bookingSummary: any = null;
  
  @Output() stepCompleted = new EventEmitter<boolean>();
  @Output() stepValidated = new EventEmitter<boolean>();
  
  private formSubscription: Subscription | null = null;
  
  constructor(private router: Router, private stepperService: StepperService) {}
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['cartItem']) {
      this.validateStep();
    }
    if (changes['form'] && !changes['form'].firstChange) {
      this.setupFormValidation();
    }
  }
  
  ngOnInit(): void { 
    this.validateStep();
    this.setupFormValidation();
  }
  
  ngOnDestroy(): void {
    this.unsubscribeFromForm();
  }
  
  private setupFormValidation(): void {
    if (this.form) {
      this.unsubscribeFromForm();
      this.formSubscription = this.form.valueChanges.subscribe(() => {
        this.validateStep();
      });
      this.validateStep();
    }
  }
  
  private unsubscribeFromForm(): void {
    if (this.formSubscription) {
      this.formSubscription.unsubscribe();
      this.formSubscription = null;
    }
  }

  get totalOccupants(): number {
    if (!this.cartItem?.occupants) return 0;
    const { totalAdult = 0, totalSenior = 0, totalYouth = 0, totalChild = 0 } = this.cartItem.occupants;
    return totalAdult + totalSenior + totalYouth + totalChild;
  }
  
  get totalNights(): number {
    if (!this.cartItem) return 0;
    const startDate = new Date(this.cartItem.startDate);
    const endDate = new Date(this.cartItem.endDate);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  
  validateStep(): void {
    if (!this.cartItem) {
      this.stepperService.markStepValid(0, false);
      this.stepValidated.emit(false);
      if (this.cartItem) {
        this.cartItem.detailsStepCompleted = false;
      }
      return;
    }
      
    // Check if user has acknowledged the booking details
    const acknowledgeDetails = this.form?.get('acknowledgeDetails')?.value;
    const isValid = !!acknowledgeDetails;
      
    this.cartItem.detailsStepCompleted = isValid;
    this.stepperService.markStepValid(0, isValid);
    this.stepValidated.emit(isValid);
  }
  
  goToNext(): void {
    if (this.cartItem?.detailsStepCompleted) {
      this.stepCompleted.emit(true);
      this.stepperService.goNext();
    }
  }
  
  goToCart(): void {
    this.router.navigate(['/cart']);
  }
}
