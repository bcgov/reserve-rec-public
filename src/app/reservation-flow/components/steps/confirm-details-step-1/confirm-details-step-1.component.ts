import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgdsFormsModule } from '@digitalspace/ngds-forms';
import { StepperService } from '../../../services/stepper.service';
import { CartItem } from '../../../../services/cart.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-confirm-details-step-1',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgdsFormsModule],
  templateUrl: './confirm-details-step-1.component.html',
  styleUrl: './confirm-details-step-1.component.scss',
})
export class ConfirmDetailsStep1Component implements OnInit, OnChanges, OnDestroy {
  @Input() form: FormGroup | null = null;
  @Input() cartItem: CartItem | null = null;
  @Input() bookingSummary: any = null;
  
  @Output() stepCompleted = new EventEmitter<boolean>();
  @Output() stepValidated = new EventEmitter<boolean>();
  
  accessPointsSelectionList: any[] = [];
  private formSubscription: Subscription | null = null;
  
  constructor(private router: Router, private stepperService: StepperService) {}
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['cartItem']) {
      this.loadAccessPoints();
      this.validateStep();
    }
    if (changes['form'] && !changes['form'].firstChange) {
      this.setupFormValidation();
    }
  }
  
  ngOnInit(): void { 
    this.loadAccessPoints();
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
  
  private loadAccessPoints(): void {
    // Mock access points - replace with actual service call
    this.accessPointsSelectionList = [
      { value: 'entry1', text: 'Main Trailhead' },
      { value: 'entry2', text: 'North Access Point' },
      { value: 'entry3', text: 'South Access Point' }
    ];
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
    if (!this.form || !this.cartItem) {
      this.stepperService.markStepValid(0, false);
      this.stepValidated.emit(false);
      this.cartItem.step1Completed = false;
      return;
    }
      
    const entryPoint = this.form.get('entryPoint')?.value;
    const exitPoint = this.form.get('exitPoint')?.value;
      
    const isValid = !!(entryPoint && exitPoint);
      
    this.cartItem.step1Completed = isValid;
    this.stepperService.markStepValid(0, isValid);
    this.stepValidated.emit(isValid);
  }
  
  goToNext(): void {
    if (this.cartItem?.step1Completed) {
      this.stepCompleted.emit(true);
      this.stepperService.goNext();
    }
  }
  
  goToCart(): void {
    this.router.navigate(['/cart']);
  }
}