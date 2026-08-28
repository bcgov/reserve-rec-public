import { ChangeDetectorRef, Component, DestroyRef, EventEmitter, inject, OnDestroy, OnInit, Output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { lastValueFrom } from 'rxjs';
import { DateTime } from 'luxon';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';
import { NgdsFormsModule } from '@digitalspace/ngds-forms';
import { ProductService } from '../services/product.service';
import { ProductDateService } from '../services/product-date.service';
import { Constants } from '../constants';
import { CartService, CartItem } from '../services/cart.service';
import { ToastService, ToastTypes } from '../services/toast.service';
import { AuthService } from '../services/auth.service';
import { WaitingRoomService } from '../services/waiting-room.service';
import { ApiService } from '../services/api.service';
import { BreadcrumbComponent } from '../shared/breadcrumb/breadcrumb.component';
import { BsModalService } from 'ngx-bootstrap/modal';
import { ConfirmationModalComponent } from '../shared/components/confirmation-modal/confirmation-modal.component';
import { BookingService } from '../services/booking.service';
import { AccountVerificationComponent } from '../shared/components/account-verification/account-verification.component';

@Component({
  selector: 'app-facility-details',
  host: { class: 'h-100' },
  imports: [CommonModule, ReactiveFormsModule, FormsModule, NgdsFormsModule, BreadcrumbComponent, RouterLink, AccountVerificationComponent],
  providers: [BsModalService],
  templateUrl: './facility-details.component.html',
  styleUrls: ['./facility-details.component.scss']
})
export class FacilityDetailsComponent implements OnInit, OnDestroy {
  @Output() formValue: EventEmitter<any> = new EventEmitter<any>();
  public emailVerified = false;
  public emailVerificationLoaded = false;
  
  public form: UntypedFormGroup;
  public facilityOpen = true;
  public isLoggedIn = false;
  public passesAvailable = false;
  public loadingProducts = false;
  public loadingDates = false;
  public loadingPasses = false;
  
  public facility;
  public geozone;
  
  public relatedActivities: any[] = [];
  public availableActivities: any = [];
  
  public availableProducts: any = [];

  public availableDates: any = {};
  // Distinguishes "the availability lookup failed" from "there genuinely are no passes" —
  // the two rendered identically, so an API outage looked like a sold-out facility.
  public datesLoadFailed = false;
  public startDate = DateTime.now().startOf('day');
  public endDate = this.startDate.plus({ days: 2 });

  public availableVisitorsAllowed: any[] = [];

  private selectedCollectionId: string;
  private selectedActivityType: string;
  private selectedActivityId: string;
  private selectedActivitySubType: string | null = null;
  private selectedActivityName: string;
  private selectedDateStr: string;
  private waitingRoomActive = false;

  private destroyRef = inject(DestroyRef);
  private cartService = inject(CartService);
  private toastService = inject(ToastService);
  private waitingRoomService = inject(WaitingRoomService);
  private apiService = inject(ApiService);
  private modalService = inject(BsModalService);
  private bookingService = inject(BookingService);

  constructor(
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private productService: ProductService,
    private productDateService: ProductDateService,
    private authService: AuthService,
  ) {
    this.facility = this.route.snapshot.data['facility'];
    this.geozone = this.facility.geozones[0];
    if (!this.facility?.isOpen) this.facilityOpen = false;

    // If this facility has activities, add them to relatedActivities. The activity
    // is no longer user-selectable (#705) — it is resolved from the facility and
    // drives the product lookup below.
    this.relatedActivities = this.facility?.activities || []

    this.availableActivities = this.relatedActivities.map(activity => {
      return {
        display: activity?.displayName,
        value: `${activity?.pk}#${activity?.sk}`,
        meta: activity
      }
    });

  }

  async ngOnInit() {
    // Initialize the form first so the template can bind immediately
    this.initializeForm();

    // Track auth state separately from facilityOpen so the template can show
    // a "log in to book" prompt instead of the misleading "facility is closed"
    // alert (issue #465).
    this.isLoggedIn = !!this.authService.getCurrentUser();
    if (this.isLoggedIn) {
      await this.checkUserEmailVerification();
    }


    // Returning from the waiting room admits the user back to this page with their
    // prior selections in the query params (#259) — restore those instead of the
    // activity auto-select below.
    const qp = this.route.snapshot.queryParamMap;
    if (qp.get('activity')) {
      await this.restoreSelectionsFromQueryParams(qp);
      return;
    }

    // The Activity picker was removed (#705) — a facility-level day-use pass has
    // no meaningful choice to offer, so resolve the activity here and pre-load its
    // products. Falls back to the first activity if a facility ever carries more
    // than one, so the rest of the flow still has an activity to book against.
    if (this.availableActivities.length) {
      const activity = this.availableActivities[0].value;
      // Set the control value without emitting so the valueChanges subscription doesn't fire a duplicate call
      this.form.get('selectedActivity').setValue(activity, { emitEvent: false });
      await this.setFormProduct(activity);
    }
  }

  private async restoreSelectionsFromQueryParams(qp: ParamMap) {
    const activity = qp.get('activity');
    this.form.get('selectedActivity').setValue(activity, { emitEvent: false });
    await this.setFormProduct(activity);

    const product = qp.get('product');
    if (!product) return;
    this.form.get('selectedProduct').setValue(product, { emitEvent: false });
    await this.loadProductDates(product);

    const date = qp.get('date');
    if (!date) return;
    this.form.get('selectedDate').setValue(date, { emitEvent: false });
    await this.loadPassesAvailable(date);

    // Inventory can move while the user waits, so only restore a count the
    // recomputed availability still offers — otherwise fail it here, not at booking.
    const visitors = qp.get('visitors');
    if (visitors && this.availableVisitorsAllowed.some(v => v.value === visitors)) {
      this.form.get('selectedVisitors').setValue(visitors, { emitEvent: false });
    }
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

    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.formValue.emit(this.form);
      this.cdr.detectChanges();
    });

    // When the user chooses/changes the activity, we need to retrieve the products related
    this.form.get('selectedActivity').valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(async (activity) => {
      this.setFormProduct(activity);
    });
    
    // When the user chooses their product, we need to then retrieve the productDates
    this.setFormProductDates();

    // When the user selects their date, then we can provide the passes available
    this.setFormPassesAvailable();
  }

  async setFormProduct(activity) {
    // When the user chooses/changes the activity, we need to retrieve the products related
    if (!activity) return;
    
    const pk = activity.split('#')[0];
    const sk = activity.split('#')[1];
    const collectionId = pk.split('::')[1];
    const activityType = sk.split('::')[0];
    const activityId = sk.split('::')[1];

    this.selectedCollectionId = collectionId;
    this.selectedActivityType = activityType;
    this.selectedActivityId = activityId;
    const selectedActivity = this.availableActivities.find(a => a.value === activity);
    this.selectedActivityName = selectedActivity?.display || '';
    this.selectedActivitySubType = selectedActivity?.meta?.activitySubType ?? null;

    this.loadingProducts = true;
    this.availableProducts = [];

    // The related product pk/sk is made up from the selected activity's pk/sk
    const relatedProducts = (await this.productService.getProductsByActivity(collectionId, activityType, activityId))?.items || [];
    this.loadingProducts = false;

    // Populate the "Pass type" dropdown with each product
    this.availableProducts = relatedProducts
        .filter(product => product?.productId !== undefined && product?.productId !== null)
        .map(product => {
          return {
            display: product?.displayName,
            value: `${product?.pk}#${product?.productId}`
          }
        });
  }

  setFormProductDates() {
    this.form.get('selectedProduct').valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((product) => {
      if (!product) return;
      this.loadProductDates(product);
    });
  }

  private async loadProductDates(product: string) {
    const pk = product.split('#')[0];
    const selectedProductId = product.split('#')[1];
    const collectionId = pk.split('::')[1];
    const activityType = pk.split('::')[2];
    const activityId = pk.split('::')[3];
    const productId = selectedProductId || null;

    this.loadingDates = true;

    // The productDates are found using the product's pk/sk and providing the available dates
    // which is between now and two days in the future
    const productDatesResult = await this.productDateService.getProductDates(
      collectionId,
      activityType,
      activityId,
      productId,
      DateTime.now().toISODate(),
      DateTime.now().plus({ days: 2 }).toISODate()
    );
    this.loadingDates = false;

    // The service returns null only when the request itself failed. Bail out here rather
    // than falling through to the empty-array path, which would report a sold-out facility.
    if (productDatesResult === null) {
      this.datesLoadFailed = true;
      this.passesAvailable = false;
      this.availableDates = {};
      return;
    }
    this.datesLoadFailed = false;

    // API returns a plain array of ProductDates; fall back to `.items` for any legacy wrapped shape
    const dates = Array.isArray(productDatesResult) ? productDatesResult : (productDatesResult?.items || []);

    if (dates.length === 0) {
      this.passesAvailable = false;
    }

    // Convert this.availableDates to an object with sk: {availableDate}
    const availableDatesMap = {}
    for (const date of dates) {
      availableDatesMap[date.sk] = date;
    }

    this.availableDates = availableDatesMap;
  }

  setFormPassesAvailable() {
    this.form.get('selectedDate').valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((date) => {
      if (!date) return;
      this.loadPassesAvailable(date);
    });
  }

  private async loadPassesAvailable(date: any) {
      this.selectedDateStr = typeof date === 'string' ? date : (date?.['toISODate'] ? date['toISODate']() : String(date));
      this.waitingRoomActive = false;

      // Check Mode 1 waiting room status for the selected date
      if (this.selectedCollectionId && this.selectedActivityType && this.selectedActivityId) {
        try {
          const res = await lastValueFrom(this.apiService.get(
            `activities/${this.selectedCollectionId}`,
            { activityType: this.selectedActivityType, activityId: this.selectedActivityId, startDate: this.selectedDateStr }
          ));
          this.waitingRoomActive = res?.['data']?.waitingRoomActive === true;
        } catch {
          // Fail open — booking API enforces server-side
        }
      }

      const selectedDate = this.availableDates[date];
      const resContext = selectedDate?.reservationContext;
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

      // Provide the number of passes allowed using minimum count up to maximum.
      // Vehicle parking day-use passes are one pass per booking (one vehicle),
      // so cap the selectable count at 1 regardless of maxDailyInventory (#566).
      const isParking = this.selectedActivitySubType === 'vehicleParking';
      const effectiveMin = isParking ? 1 : minInv;
      const effectiveMax = isParking ? 1 : maxInv;
      const allowedVisitors = [];
      for (let i = effectiveMin; i <= effectiveMax; i++) {
        allowedVisitors.push({
          display: i.toString(),
          value: i.toString()
        });
      }
      this.availableVisitorsAllowed = allowedVisitors;
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

  public onCalendarDisplayChange() {
    this.cdr.detectChanges();
  }


  // Get the correct icon for the activity type using Constants.activityTypes
  getIcon(activityType, activitySubType) {
    return Constants.activityTypes[activityType]?.subTypes[activitySubType]?.iconClass || 'fa-solid fa-person-hiking';
  }

  // Waiting room admission returns the user to this page fresh (#259) — carry the
  // in-progress selections as query params so ngOnInit can restore them.
  private buildReturnUrlWithSelections(): string {
    const params = new URLSearchParams();
    const activity = this.form.get('selectedActivity').value;
    const product = this.form.get('selectedProduct').value;
    const date = this.selectedDateStr || this.form.get('selectedDate').value;
    const visitors = this.form.get('selectedVisitors').value;
    if (activity) params.set('activity', activity);
    if (product) params.set('product', product);
    if (date) params.set('date', date);
    if (visitors) params.set('visitors', visitors);

    const query = params.toString();
    // router.url excludes <base href>, and the waiting room assigns this value to
    // window.location.href verbatim — resolve it so it survives the /dayuse/ mount.
    const basePath = this.router.url.split('?')[0].replace(/^\//, '');
    return new URL(query ? `${basePath}?${query}` : basePath, document.baseURI).toString();
  }

  async submit(): Promise<void> {
    // Gate the booking action when Mode 2 is active and user lacks admission
    if (this.waitingRoomService.mode2Active() &&
        !this.waitingRoomService.hasValidAdmission('MODE2#global#1', '')) {
      const today = new Date().toISOString().slice(0, 10);
      window.location.href = this.waitingRoomService.buildWaitingRoomUrl(
        'MODE2', 'global', '1', today, this.buildReturnUrlWithSelections()
      );
      return;
    }

    const date = this.selectedDateStr || this.form.get('selectedDate').value;

    // Check Mode 1 (facility-specific) waiting room — status cached when date was selected
    if (this.waitingRoomActive && this.selectedCollectionId && this.selectedActivityType && this.selectedActivityId && date) {
      const facilityKey = `${this.selectedCollectionId}#${this.selectedActivityType}#${this.selectedActivityId}`;
      if (!this.waitingRoomService.hasValidAdmission(facilityKey, date)) {
        window.location.href = this.waitingRoomService.buildWaitingRoomUrl(
          this.selectedCollectionId,
          this.selectedActivityType,
          this.selectedActivityId,
          date,
          this.buildReturnUrlWithSelections(),
          this.facility?.displayName || ''
        );
        return;
      }
    }
    const visitors = Number(this.form.get('selectedVisitors').value);
    const selectedProductValue = this.form.get('selectedProduct').value;
    const selectedProductName = this.availableProducts.find(product => product.value === selectedProductValue)?.display || '';
    
    // Extract productId from the selected product (format: "product::collectionId::activityType::activityId#productId")
    let productId = null;
    if (selectedProductValue) {
      const selectedProductId = selectedProductValue.split('#')[1];
      productId = selectedProductId || null;
    }

    if (!productId) {
      this.toastService.addMessage('Please select a pass type', 'Error', ToastTypes.ERROR);
      return;
    }

    const existingCartItem = this.cartService.items()[0];
    if (existingCartItem) {
      const proceed = await this.confirmReplaceCart(existingCartItem);
      if (!proceed) return;
      // Release the old hold before creating the new booking — otherwise the
      // API rejects a re-book of the same pass/date. (Ref #650.)
      await this.cartService.releaseCartItem(existingCartItem);
    }
    

    // Create booking immediately to reserve the inventory
    try {
      const bookingData = {
        startDate: date,
        endDate: date,
        productId: productId,
        quantity: visitors,
        collectionId: this.selectedCollectionId || '',
        activityId: this.selectedActivityId || '',
        activityType: this.selectedActivityType || '',
        facilityDisplayName: this.facility?.displayName || '',
        geozoneDisplayName: this.geozone?.displayName || '',
      };

      const booking = await this.bookingService.createBooking(
        bookingData,
        this.selectedCollectionId || '',
        this.selectedActivityType || '',
        this.selectedActivityId || '',
        date
      );

      const bookingId = booking?.bookingId || booking?.globalId || booking?.booking?.[0]?.data?.globalId || null;
      const sessionId = booking?.sessionId || booking?.booking?.[0]?.data?.sessionId || null;

      if (!bookingId || !sessionId) {
        throw new Error('Booking creation failed, no booking ID or session ID returned.');
      }

      // Add to cart with booking details for inventory reservation
      const selectedProductDate = this.availableDates[date];

      const cartItem: CartItem = {
        id: '',
        collectionId: this.selectedCollectionId || '',
        activityType: this.selectedActivityType || '',
        activitySubType: this.selectedActivitySubType || '',
        activityId: this.selectedActivityId || '',
        productId: productId,
        quantity: visitors,
        activityName: this.selectedActivityName || this.facility?.displayName || '',
        productName: selectedProductName,
        geozoneName: this.facility?.displayName || '',
        dateRange: [date, date],
        startDate: date,
        endDate: date,
        namedOccupant: {
          firstName: '',
          lastName: ''
        },
        occupants: { totalAdult: visitors, totalSenior: 0, totalYouth: 0, totalChild: 0 },
        feeInformation: { registrationFees: 0, transactionFees: 0, tax: 0, total: 0 },
        detailsStepCompleted: false,
        visitorDetailsStepCompleted: false,
        equipmentStepCompleted: false,
        paymentStepCompleted: false,
        areAllStepsCompleted: false,
        checkInAnchor: selectedProductDate?.reservationContext?.checkInAnchor ?? selectedProductDate?.reservationContext?.temporalAnchors?.checkInTime,
        checkOutAnchor: selectedProductDate?.reservationContext?.checkOutAnchor ?? selectedProductDate?.reservationContext?.temporalAnchors?.checkOutTime,
        bookingId: bookingId,
        sessionId: sessionId,
        sessionInitTime: booking?.sessionInitTime,
        sessionExpiry: booking?.sessionExpiry,
        vehicleInformation: [
          {
            licensePlate: '',
            licensePlateRegistrationRegion: '',
          }
        ],
      };

      this.cartService.addToCart(cartItem);
      this.toastService.addMessage('Item added to cart', 'Success', ToastTypes.SUCCESS);
      this.cdr.detectChanges();
      
      // Redirect to cart on success
      await this.router.navigate(['/cart']);
    } catch (error: any) {
      console.error('Error creating booking:', error);
      // API returns error text under `msg`; walk the usual shapes before
      // falling back to a generic message.
      const errorMessage =
        error?.error?.msg ||
        error?.error?.error ||
        error?.error?.Message ||
        error?.error?.message ||
        error?.message ||
        'Failed to create booking. Please try again.';
      this.toastService.addMessage(errorMessage, 'Error', ToastTypes.ERROR);
    }
  }

  // Prompt the user before replacing an existing cart item. Resolves true if they
  // confirm, false if they cancel or dismiss. Single-item cart semantics — see
  // CartService.addToCart.
  private confirmReplaceCart(existing: CartItem): Promise<boolean> {
    return new Promise(resolve => {
      const description = existing.productName
        ? `${existing.productName} (${existing.startDate})`
        : `your pending booking on ${existing.startDate}`;
      const modalRef = this.modalService.show(ConfirmationModalComponent, {
        initialState: {
          title: 'Replace pending booking?',
          body: `Your cart already has ${description}. Adding this booking will replace it.`,
          confirmText: 'Replace',
          cancelText: 'Cancel',
          confirmClass: 'btn btn-primary',
          cancelClass: 'btn btn-outline-secondary',
        },
      });
      let settled = false;
      const settle = (value: boolean) => {
        if (settled) return;
        settled = true;
        modalRef.hide();
        resolve(value);
      };
      modalRef.content?.confirmButton.subscribe(() => settle(true));
      modalRef.content?.cancelButton.subscribe(() => settle(false));
      modalRef.onHide?.subscribe(() => settle(false));
    });
  }

  // Method to check if the user's email is verified
  async checkUserEmailVerification() {
    this.emailVerificationLoaded = false;
    this.emailVerified = await this.authService.checkEmailVerification();
    this.emailVerificationLoaded = true;
    this.cdr.detectChanges();
  }

  onEmailVerified() {
    this.emailVerified = true;
    this.cdr.detectChanges();
  }

  ngOnDestroy(): void {
    this.cdr.detectChanges()
  }
}
