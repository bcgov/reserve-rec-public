import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule, FormControl } from '@angular/forms';
import { NgdsFormsModule } from '@digitalspace/ngds-forms';
import { StepperService } from '../../../services/stepper.service';
import { CartItem } from '../../../../services/cart.service';

@Component({
  selector: 'app-equipment-step-4',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgdsFormsModule],
  templateUrl: './equipment-step-4.component.html',
  styleUrl: './equipment-step-4.component.scss'
})
export class EquipmentStep4Component implements OnInit {
  @Input() form: FormGroup | null = null;
  @Input() cartItem: CartItem | null = null;
  @Input() bookingSummary: any = null;
  
  @Output() stepCompleted = new EventEmitter<boolean>();
  @Output() stepValidated = new EventEmitter<boolean>();
  
  constructor(private stepperService: StepperService) {}
  
  ngOnInit(): void {
    this.initializeEquipmentFormControls();
    
    if (this.form) {
      this.form.valueChanges.subscribe(() => {
        this.validateStep();
      });
    }
    
    this.validateStep();
  }
  
  private initializeEquipmentFormControls(): void {
    if (!this.form) return;
    
    if (!this.form.get('equipmentInfo')) {
      this.form.addControl('equipmentInfo', new FormGroup({
        licensePlate: new FormControl(''),
        registeredProvince: new FormControl('')
      }));
    }
    
    if (!this.form.get('equipmentDetails')) {
      this.form.addControl('equipmentDetails', new FormControl(''));
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
  
  isStepValid(): boolean {
    return !!this.form;
  }
  
  validateStep(): void {
    const isValid = this.isStepValid();
    this.stepperService.markStepValid(3, isValid);
    this.stepValidated.emit(isValid);
  }
  
  goToNext(): void {
    if (this.isStepValid()) {
      this.cartItem.step4Completed = true;
      this.stepCompleted.emit(true);
      this.stepperService.goNext();
    }
  }
  
  goToPrevious(): void {
    this.stepperService.goPrevious();
  }
}