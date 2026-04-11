import { ChangeDetectorRef, Component, EventEmitter, inject, OnDestroy, Output } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { DateTime } from 'luxon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, UntypedFormGroup } from '@angular/forms';
import { NgdsFormsModule } from '@digitalspace/ngds-forms';
import { ProductService } from '../services/product.service';
import { ProductDateService } from '../services/product-date.service';
import { BookingService } from '../services/booking.service';
import { Constants } from '../constants';
import { CartService, CartItem } from '../services/cart.service';
import { ToastService, ToastTypes } from '../services/toast.service';
import { AuthService } from '../services/auth.service';
import { WaitingRoomService } from '../services/waiting-room.service';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-facility-details',
  host: { class: 'h-100' },
  imports: [CommonModule, FormsModule, RouterLink, NgdsFormsModule],
  templateUrl: './facility-details.component.html',
  styleUrl: './facility-details.component.scss'
})
export class FacilityDetailsComponent implements OnDestroy {
  @Output() formValue: EventEmitter<any> = new EventEmitter<any>();

  public emailVerified = false;
  public emailVerificationLoaded = false;
  
  public form: UntypedFormGroup;
  public facilityOpen = true;
  public passesAvailable = true;
  public loadingProducts = false;
  public loadingDates = false;
  
  public facility;
  
  public relatedActivities: any[] = [];
  public availableActivities: any = [];
  
  public availableProducts: any = [];

  public availableDates: any = {};
  public startDate = DateTime.now().startOf('day');
  public endDate = this.startDate.plus({ days: 2 });

  public availableVisitorsAllowed: any[] = [];

  private selectedCollectionId: string;
  private selectedActivityType: string;
  private selectedActivityId: string;
  private selectedActivityName: string;

  private cartService = inject(CartService);
  private toastService = inject(ToastService);
  private bookingService = inject(BookingService);
  private waitingRoomService = inject(WaitingRoomService);
  private apiService = inject(ApiService);

  constructor(
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private productService: ProductService,
    private productDateService: ProductDateService,
    private authService: AuthService
  ) {
    this.facility = this.route.snapshot.data['facility'];
    this.relatedActivities = this.facility?.activities || []

    if (!this.facility?.isOpen) this.facilityOpen = false;

    this.availableActivities = this.relatedActivities.map(activity => {
      return {
        display: activity?.displayName,
        value: `${activity?.pk}#${activity?.sk}`,
        meta: activity
      }
    });

    this.initializeForm();
  }

  async ngOnInit() {
      await this.checkUserEmailVerification();
  }

  private initializeForm() {
    this.form = this.fb.group({
      selectedActivity: [null, {
        updateOn: 'blur'
      }],
      selectedProduct: [null, {
        updateOn: 'blur'
      }],
      selectedDate: [null, {
        updateOn: 'blur'
      }],
      selectedVisitors: [null, {
        updateOn: 'blur'
      }]
    }, {
      validators: [
        // this.coordinatesWithinBoundsValidator,
        // this.displayNameValidator
      ]
    });

    this.form.valueChanges.subscribe(() => {
      this.formValue.emit(this.form);
      this.cdr.detectChanges();
    });

    this.form.get('selectedActivity').valueChanges.subscribe(async (activity) => {
      if (!activity) return;
      
      const pk = activity.split('#')[0];
      const sk = activity.split('#')[1];
      const collectionId = pk.split('::')[1];
      const activityType = sk.split('::')[0];
      const activityId = sk.split('::')[1];

      this.selectedCollectionId = collectionId;
      this.selectedActivityType = activityType;
      this.selectedActivityId = activityId;
      this.selectedActivityName = this.availableActivities.find(a => a.value === activity)?.display || '';

      this.loadingProducts = true;
      this.availableProducts = [];
      const relatedProducts = (await this.productService.getProductsByActivity(collectionId, activityType, activityId))?.items || [];
      this.loadingProducts = false;

      this.availableProducts = relatedProducts.map(product => {
            return {
              display: product?.displayName,
              value: `${product?.pk}#${product?.sk}`
            }
          });
      
    });
    
    this.form.get('selectedProduct').valueChanges.subscribe(async (product) => {
      if (!product) return;
      
      const pk = product.split('#')[0];
      const sk = product.split('#')[1];
      const collectionId = pk.split('::')[1];
      const activityType = pk.split('::')[2];
      const activityId = pk.split('::')[3];
      const productId = sk.split('::')[0];

      this.loadingDates = true;
      const dates = (await this.productDateService.getProductDates(
        collectionId,
        activityType,
        activityId,
        productId,
        DateTime.now().toISODate(),
        DateTime.now().plus({ days: 2 }).toISODate()
      ))?.items || [];
      this.loadingDates = false;

      if (dates.length === 0) {
        this.passesAvailable = false;
      }

      // Convert this.availableDates to an object with sk: {availableDate}
      const availableDatesMap = {}
      for (const date of dates) {
        availableDatesMap[date.sk] = date;
      }

      this.availableDates = availableDatesMap;
    });

    this.form.get('selectedDate').valueChanges.subscribe(async (date) => {
      if (!date) return;

      const selectedDate = this.availableDates[date];
      const resContext = selectedDate.reservationContext;
      const isReservable = resContext?.isReservable;
      const minInv = resContext?.minDailyInventory;
      const maxInv = resContext?.maxDailyInventory;
      const reservationWindow = resContext?.temporalWindows?.reservationWindow;
      const reservationWindowOpen = this.parseDateTimeValue(reservationWindow?.open);
      const reservationWindowClose = this.parseDateTimeValue(reservationWindow?.close);
      const currentDateTime = DateTime.now();

      // Not reservable, show no passes available right away
      if (!isReservable) {
        this.passesAvailable = false;
        this.availableVisitorsAllowed = [{display: 'Unavailable', value: '0' }];
        return;
      } else {
        // Check if today is within the reservation window
        if (reservationWindowOpen?.isValid && reservationWindowClose?.isValid && currentDateTime >= reservationWindowOpen && currentDateTime <= reservationWindowClose) {
          this.passesAvailable = true;
        } else {
          this.passesAvailable = false;
        }
      }

      // Provide the number of passes allowed using minimum count up to maximum
      const allowedVisitors = [];
      for (let i = minInv; i <= maxInv; i++) {
        allowedVisitors.push({
          display: i.toString(),
          value: i.toString()
        });
      }
      this.availableVisitorsAllowed = allowedVisitors;


    });

  }

  private parseDateTimeValue(value: unknown): DateTime {
    if (typeof value === 'number') {
      return DateTime.fromMillis(value);
    }

    if (typeof value === 'string') {
      if (/^\d+$/.test(value)) {
        return DateTime.fromMillis(Number(value));
      }

      return DateTime.fromISO(value);
    }

    return DateTime.invalid('Invalid temporal window value');
  }


  // Get the correct icon for the activity type using Constants.activityTypes
  getIcon(activityType, activitySubType) {
    return Constants.activityTypes[activityType]?.subTypes[activitySubType]?.iconClass || 'fa-solid fa-person-hiking';
  }

  // Send the user to the bcparks find-a-park using their query url?
  facilityUrl() {
    // const baseUrl = 'https://bcparks.ca/find-a-park/?q=';
    // const query = encodeURIComponent(this.facility?.displayName || '');
    // return `${baseUrl}${query}`;
    return 'https://bcparks.ca/find-a-park/';
  }

  async submit(): Promise<void> {
    // Gate the booking action when Mode 2 is active and user lacks admission
    if (this.waitingRoomService.mode2Active() &&
        !this.waitingRoomService.hasValidAdmission('MODE2#global#1', '')) {
      const today = new Date().toISOString().slice(0, 10);
      window.location.href = this.waitingRoomService.buildWaitingRoomUrl(
        'MODE2', 'global', '1', today, this.router.url
      );
      return;
    }

    const date = this.form.get('selectedDate').value;

    // Check Mode 1 (facility-specific) waiting room for the selected date
    if (this.selectedCollectionId && this.selectedActivityType && this.selectedActivityId && date) {
      try {
        const facilityKey = `${this.selectedCollectionId}#${this.selectedActivityType}#${this.selectedActivityId}`;
        if (!this.waitingRoomService.hasValidAdmission(facilityKey, date)) {
          const res = await lastValueFrom(this.apiService.get(
            `activities/${this.selectedCollectionId}`,
            { activityType: this.selectedActivityType, activityId: this.selectedActivityId, startDate: date }
          ));
          if (res?.['data']?.waitingRoomActive) {
            window.location.href = this.waitingRoomService.buildWaitingRoomUrl(
              this.selectedCollectionId,
              this.selectedActivityType,
              this.selectedActivityId,
              date,
              this.router.url,
              this.facility?.displayName || ''
            );
            return;
          }
        }
      } catch {
        // Fail open — let the booking API enforce if the check fails
      }
    }
    const visitors = Number(this.form.get('selectedVisitors').value);
    const selectedProductValue = this.form.get('selectedProduct').value;
    
    // Extract productId from the selected product (format: "product::collectionId::activityType::activityId#productId")
    let productId = null;
    if (selectedProductValue) {
      const sk = selectedProductValue.split('#')[1];
      productId = sk || null;
    }

    if (!productId) {
      this.toastService.addMessage('Please select a pass type', 'Error', ToastTypes.ERROR);
      return;
    }

    // Add to cart - validation will happen when booking is created
    const cartItem: CartItem = {
      id: '',
      collectionId: this.selectedCollectionId || '',
      activityType: this.selectedActivityType || '',
      activityId: this.selectedActivityId || '',
      productId: productId,
      quantity: visitors,
      activityName: this.selectedActivityName || this.facility?.displayName || '',
      geoZoneName: this.facility?.displayName || '',
      dateRange: [date, date],
      startDate: date,
      endDate: date,
      occupants: { totalAdult: visitors, totalSenior: 0, totalYouth: 0, totalChild: 0 },
      feeInformation: { registrationFees: 0, transactionFees: 0, tax: 0, total: 0 },
      detailsStepCompleted: false,
      visitorDetailsStepCompleted: false,
      equipmentStepCompleted: false,
      paymentStepCompleted: false,
      areAllStepsCompleted: false,
    };

    this.cartService.addToCart(cartItem);
    this.toastService.addMessage('Item added to cart', 'Success', ToastTypes.SUCCESS);

    this.router.navigate(['/reservation-flow']).then(() => {
      window.scrollTo(0, 0);
      this.cdr.detectChanges();
    });
  }

  // Method to navigate back to the previous page
  goBack() {
    this.router.navigate(['/']).then(() => {
      this.cdr.detectChanges();
    });
  }

  // Method to check if the user's email is verified
  async checkUserEmailVerification() {
    this.emailVerificationLoaded = false;
    this.emailVerified = await this.authService.checkEmailVerification();
    this.emailVerificationLoaded = true;
    this.cdr.detectChanges();
  }

  // Method to resend the verification code to the user's email
  resendVerification() {
    this.authService.handleResendAttributeCodeToEmail();
    this.toastService.addMessage('Verification code resent. Please check your email.', 'Verification Sent', ToastTypes.SUCCESS);
  }

  ngOnDestroy() {
    this.cdr.detectChanges();
  }
}
