import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';

import { FormGroup, ReactiveFormsModule, FormControl } from '@angular/forms';
import { NgdsFormsModule } from '@digitalspace/ngds-forms';
import { TypeaheadModule } from 'ngx-bootstrap/typeahead';
import { StepperService } from '../../../services/stepper.service';
import { CartItem } from '../../../../services/cart.service';
import { CA_PROVINCES, US_STATES } from '../../../../data/geographical.data';

@Component({
  selector: 'app-equipment-step',
  standalone: true,
  imports: [ReactiveFormsModule, NgdsFormsModule, TypeaheadModule],
  templateUrl: './equipment-step.component.html',
  styleUrl: './equipment-step.component.scss'
})
export class EquipmentStepComponent implements OnInit {
  @Input() form: FormGroup | null = null;
  @Input() cartItem: CartItem | null = null;
  @Input() bookingSummary: any = null;
  @Input() user: any;
  
  @Output() stepCompleted = new EventEmitter<boolean>();
  @Output() stepValidated = new EventEmitter<boolean>();
  
  provincesStates: string[] = [...CA_PROVINCES, ...US_STATES, 'Other'];
  
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

    //const validators = this.isParkingPass ? [Validators.required] : []; add this back after we are enforcing for parking passes 

    if (!this.form.get('equipmentInfo')) {
      this.form.addControl('equipmentInfo', new FormGroup({
        licensePlate: new FormControl(this.user?.['custom:licensePlate'] || ''),
        registeredProvince: new FormControl(this.user?.['custom:vehicleRegLocale'] || '')
      }));
    }

    if (!this.form.get('equipmentDetails')) {
      this.form.addControl('equipmentDetails', new FormControl(''));
    }
  }

  get isParkingPass(): boolean {
    return this.cartItem?.activitySubType === 'vehicleParking';
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
    if (!this.form) return false;
    // if (this.isParkingPass) {
    //   return !!this.form.get('equipmentInfo')?.valid;
    // } undo when we go back to validating equipment 
    return true;
  }
  
  validateStep(): void {
    const isValid = this.isStepValid();
    this.stepperService.markStepValid(2, isValid);

    this.stepValidated.emit(isValid);
  }
  
  goToNext(): void {
    
    if (this.isStepValid()) {
      this.cartItem.equipmentStepCompleted = true;
      this.stepCompleted.emit(true);
    }
  }
  
  goToPrevious(): void {
    this.stepperService.goPrevious();
  }
}
