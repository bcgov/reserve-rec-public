import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { NgdsFormsModule } from '@digitalspace/ngds-forms';
import { StepperService } from '../../../services/stepper.service';
import { CartItem } from '../../../../services/cart.service';
import { PartyDetailsComponent } from '../../../../party-details/party-details.component';

@Component({
  selector: 'app-camping-party-step-3',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    NgdsFormsModule,
    PartyDetailsComponent
  ],
  templateUrl: './camping-party-step-3.component.html',
  styleUrl: './camping-party-step-3.component.scss'
})
export class CampingPartyStep3Component implements OnInit {
  @Input() form: FormGroup | null = null;
  @Input() cartItem: CartItem | null = null;
  @Input() bookingSummary: any = null;
  @Input() user: any = null;
  
  @Output() stepCompleted = new EventEmitter<boolean>();
  @Output() stepValidated = new EventEmitter<boolean>();
  
  constructor(private stepperService: StepperService) {}
  
  ngOnInit(): void {
    this.initializeFormControls();
    
    if (this.form) {
      this.form.valueChanges.subscribe(() => {
        this.validateStep();
      });
      this.validateStep();
    }
  }
  
  private initializeFormControls(): void {
    if (!this.form) return;
    
    if (!this.form.get('primaryOccupant')) {
      this.form.addControl('primaryOccupant', new FormGroup({
        firstName: new FormControl('', [Validators.required]),
        lastName: new FormControl('', [Validators.required]),
        email: new FormControl(''),
        phoneNumber: new FormControl('', [Validators.required])
      }));
    }
    
    if (!this.form.get('addressInfo')) {
      this.form.addControl('addressInfo', new FormGroup({
        streetAddress: new FormControl('', [Validators.required]),
        unitNumber: new FormControl(''),
        city: new FormControl('', [Validators.required]),
        province: new FormControl('', [Validators.required]),
        postalCode: new FormControl('', [Validators.required]),
        country: new FormControl('CA', [Validators.required])
      }));
    }
  }
  
  setUserAsPrimaryOccupant(isUser: boolean): void {
    if (!this.form) return;
    
    this.form.get('userIsPrimaryOccupant')?.setValue(isUser);
    
    if (isUser && this.user) {
      const primaryOccupant = this.form.get('primaryOccupant');
      if (primaryOccupant) {
        primaryOccupant.patchValue({
          firstName: this.user.firstName || '',
          lastName: this.user.lastName || '',
          email: this.user.email || '',
          phoneNumber: this.user.phoneNumber || ''
        });
      }
    }
    
    this.validateStep();
  }
  
  get totalOccupants(): number {
    if (!this.cartItem?.occupants) return 0;
    const { totalAdult = 0, totalSenior = 0, totalYouth = 0, totalChild = 0 } = this.cartItem.occupants;
    return totalAdult + totalSenior + totalYouth + totalChild;
  }
  
  isStepValid(): boolean {
    if (!this.form) return false;
    
    const userIsPrimary = this.form.get('userIsPrimaryOccupant')?.value;
    
    if (userIsPrimary === null || userIsPrimary === undefined) {
      return false;
    }
    
    if (!userIsPrimary) {
      const primaryOccupant = this.form.get('primaryOccupant');
      const addressInfo = this.form.get('addressInfo');
      return !!(primaryOccupant?.valid && addressInfo?.valid);
    }
    
    return true;
  }
  
  validateStep(): void {
    const isValid = this.isStepValid();
    this.stepperService.markStepValid(2, isValid);
    this.stepValidated.emit(isValid);
  }
  
  goToNext(): void {
    if (this.isStepValid()) {
      this.stepCompleted.emit(true);
      this.cartItem!.step3Completed = true;
      this.stepperService.goNext();
    }
  }
  
  goToPrevious(): void {
    this.stepperService.goPrevious();
  }
}
