import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgdsFormsModule } from '@digitalspace/ngds-forms';
import { StepperService } from '../../../services/stepper.service';
import { CartItem } from '../../../../services/cart.service';

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
  
  constructor(
    private stepperService: StepperService 
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
      
      // TODO: Implement actual payment processing send data to bambora from cart
  
      this.stepCompleted.emit(true);
      
    } catch (error) {
      console.log(error);
    } finally {
      this.isProcessingPayment = false;
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
    return this.bookingSummary?.basePrice || this.cartItem?.totalPrice || 0;
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