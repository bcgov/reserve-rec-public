import { AfterContentChecked, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { NgdsFormsModule } from '@digitalspace/ngds-forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { CartService, CartItem } from '../services/cart.service';
import { StepperService } from './services/stepper.service';
import { ProgressIndicatorComponent } from './components/progress-indicator/progress-indicator.component';
import { ConfirmDetailsStep1Component } from './components/steps/confirm-details-step-1/confirm-details-step-1.component';
import { PolicyReviewStep2Component } from './components/steps/policy-review-step-2/policy-review-step-2.component';
import { CampingPartyStep3Component } from './components/steps/camping-party-step-3/camping-party-step-3.component';
import { EquipmentStep4Component } from './components/steps/equipment-step-4/equipment-step-4.component';
import { PaymentStep5Component } from './components/steps/payment-step-5/payment-step-5.component';

@Component({
  selector: 'app-reservation-flow',
  imports: [
    CommonModule, 
    NgdsFormsModule, 
    ProgressIndicatorComponent,
    ConfirmDetailsStep1Component,
    PolicyReviewStep2Component,
    CampingPartyStep3Component,
    EquipmentStep4Component,
    PaymentStep5Component,
    RouterModule
  ],
  templateUrl: './reservation-flow.component.html',
  styleUrl: './reservation-flow.component.scss'
})
export class ReservationFlowComponent implements OnInit, AfterContentChecked, OnDestroy {

  cartItems: CartItem[] = []; 
  currentCartItemIndex = 0; 
  completedItemsData: any[] = []; 
  public user: any = null;
  public form: UntypedFormGroup;

  public accessPointsSelectionList: any[] = [];

  get cartItem(): CartItem | null {
    return this.cartItems[this.currentCartItemIndex] || null;
  }
  
  get isLastCartItem(): boolean {
    return this.currentCartItemIndex === this.cartItems.length - 1;
  }
  
  get totalCartItems(): number {
    return this.cartItems.length;
  }



  // Booking summary for stepper components
  public bookingSummary: any = {
    parkName: '',
    activityName: '',
    checkInDate: new Date(),
    checkOutDate: new Date(),
    numberOfNights: 0,
    numberOfOccupants: 0,
    basePrice: 0,
    equipmentTotal: 0,
    taxes: 0,
    total: 0
  };

  constructor(
    private changeDetectorRef: ChangeDetectorRef,
    public router: Router,
    public stepperService: StepperService,
    private cartService: CartService,
    private authService: AuthService
  ) {
    this.user = this.authService.getCurrentUser();
  }

  ngOnInit(): void {
    this.loadCartItems();
    this.initializeForCurrentItem();
  }


  private loadCartItems(): void {
    // Load all the items from the cart service
    this.cartItems = this.cartService.items();
    
    if (this.cartItems.length === 0) {
      this.router.navigate(['/']);
      return;
    }
  }

  private initializeForCurrentItem(): void {
    if (!this.cartItem) return;
    this.initializeFromCart(this.cartItem);
    this.loadAccessPointsForCurrentItem();
    this.updateBookingSummary();
    if (this.currentCartItemIndex > 0) {
      this.stepperService.goToStep(0);
    }
  }

  private async loadAccessPointsForCurrentItem(): Promise<void> {
    if (!this.cartItem) return;
    
    try {
      
      // TODO: Replace with actual service call
     
      // Mock data for now
      this.accessPointsSelectionList = [
        { value: { pk: 'facility::bcparks_9398', sk: 'accessPoint::1' }, text: 'Main Trailhead', displayName: 'Main Trailhead', },
        { value: { pk: 'facility::bcparks_9398', sk: 'accessPoint::2' }, text: 'North Access Point', displayName: 'North Access Point', },
        { value: { pk: 'facility::bcparks_9398', sk: 'accessPoint::3' }, text: 'South Access Point', displayName: 'South Access Point',  }
      ];
    } catch (error) {
      console.log(error);
      this.accessPointsSelectionList = [];
    }
  }

  private initializeFromCart(cartItem: CartItem): void {
    // Create form from cart data

    this.form = new UntypedFormGroup({
      entryPoint: new UntypedFormControl(null),
      exitPoint: new UntypedFormControl(null),
      acknowledgePolicies: new UntypedFormControl(false, [Validators.requiredTrue]),
      
      dateRange: new UntypedFormControl([cartItem.startDate, cartItem.endDate], { nonNullable: true }),
      occupants: new UntypedFormGroup({
        totalAdult: new UntypedFormControl(cartItem.occupants.totalAdult || 0, { nonNullable: true }),
        totalSenior: new UntypedFormControl(cartItem.occupants.totalSenior || 0, { nonNullable: true }),
        totalYouth: new UntypedFormControl(cartItem.occupants.totalYouth || 0, { nonNullable: true }),
        totalChild: new UntypedFormControl(cartItem.occupants.totalChild || 0, { nonNullable: true }),
      }),
      
      // User info (step 3 will add more fields as needed)
      userIsPrimaryOccupant: new UntypedFormControl(this.user && !this.user.sub.startsWith('guest') ? true : false, { nonNullable: true })
    });

  }

  private updateBookingSummary(): void {
    if (this.cartItem && this.form) {
      const startDate = new Date(this.cartItem.startDate);
      const endDate = new Date(this.cartItem.endDate);
      const numberOfNights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const totalOccupants = this.cartItem.occupants.totalAdult + this.cartItem.occupants.totalSenior + 
                            this.cartItem.occupants.totalYouth + this.cartItem.occupants.totalChild;
      
      this.bookingSummary = {
        parkName: this.cartItem.geoZoneName || 'Unknown Park',
        activityName: this.cartItem.activityName || 'Unknown Activity',
        checkInDate: startDate.toISOString(),
        checkOutDate: endDate.toISOString(),
        numberOfNights: numberOfNights,
        numberOfOccupants: totalOccupants,
        basePrice: this.cartItem.feeInformation?.total || 0,
        equipmentTotal: 0,
        taxes: 0, 
        total: this.cartItem.feeInformation?.total || 0
      };
    }
  }

 private checkAllStepsCompleted(): void {
  if (!this.cartItem) return;

  const item = this.cartItems[this.currentCartItemIndex];
  const allStepsCompleted = item.step1Completed && 
                          item.step2Completed && 
                          item.step3Completed && 
                          item.step4Completed;


  this.cartService.updateCartItem(item.id, {
    ...item,
    areAllStepsCompleted: allStepsCompleted
  });

  
}

onStepCompleted(completed: boolean): void {
  if (!completed) return;
  
  const currentStep = this.stepperService.currentStepIndex();
  
  if (this.cartItem?.id) {
    this.saveCurrentFormState(this.cartItem.id);
  }
  
  this.checkAllStepsCompleted();


    if (currentStep === 3) {
      if (this.isLastCartItem) {
        this.stepperService.goNext();
      } else {
        this.moveToNextCartItem();
      }
    this.changeDetectorRef.detectChanges();
  }
}
private saveCurrentItemData(): void {
    const itemData = {
      cartItemIndex: this.currentCartItemIndex,
      cartItem: this.cartItem,
      formData: this.form?.value,
      completedAt: new Date().toISOString()
    };
    
    this.completedItemsData[this.currentCartItemIndex] = itemData;
    
  }

  private moveToNextCartItem(): void {
    this.currentCartItemIndex++;
    this.initializeForCurrentItem();
  }

  onStepValidated(isValid: boolean): void {
    if(isValid) {
      this.changeDetectorRef.detectChanges();
    }
  }

  processPayment(): void {
 //payment later direct to bambora
  }

  completeReservation(): void {
    this.cartService.clearCart();
    this.router.navigate(['/']);
  }

  // Navigation
  navigate(): void {
    this.router.navigate(['/']);
  }

  ngAfterContentChecked(): void {
    this.changeDetectorRef.detectChanges();
  }

  ngOnDestroy(): void {
    this.stepperService.reset();
    this.changeDetectorRef.detach();
  }


onItemSwitched(newIndex: number): void {
  if (newIndex < 0 || newIndex >= this.cartItems.length) {
    return;
  }
  
  if (newIndex === this.currentCartItemIndex) {
    return;
  }

  if (this.form && this.cartItem?.id) {
    this.saveCurrentFormState(this.cartItem.id);
    this.saveCurrentItemData(); 
  }
  this.currentCartItemIndex = newIndex;
  this.initializeForCurrentItem();

  if (this.cartItem?.id) {
    const savedState = this.loadFormStateForItem(this.cartItem.id);
    if (savedState) {
      this.form.patchValue(savedState);
    }
  }

  // Force change detection because without it everything sucks
  this.changeDetectorRef.detectChanges();
}

private formStates = new Map<string | number, any>();

private saveCurrentFormState(itemId?: string | number): void {
  if (!itemId || !this.form) return;

  const formState = this.form.getRawValue(); // Get all form values including disabled controls
  this.formStates.set(itemId, formState);
}

private loadFormStateForItem(itemId: string | number): any {
  const savedState = this.formStates.get(itemId);
  return savedState;
}
}
