import { AfterContentChecked, ChangeDetectorRef, Component, effect, OnDestroy, OnInit, signal, Signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ActivityService } from '../services/activity.service';
import { DataService } from '../services/data.service';
import { Constants } from '../constants';
import { UntypedFormArray, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { FacilityService } from '../services/facility.service';
import { NgdsFormsModule } from '@digitalspace/ngds-forms';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { PartyDetailsComponent } from '../party-details/party-details.component';
import { countries, states, provinces } from './countries';
import { AuthService } from '../services/auth.service';
import { BookingService } from '../services/booking.service';
import { LoadingService } from '../services/loading.service';
import { PolicyAccordionsComponent } from './policy-accordions/policy-accordions.component';
import { lastValueFrom } from 'rxjs';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-reservation-flow',
  imports: [CommonModule, NgdsFormsModule, DatePipe, CurrencyPipe, PartyDetailsComponent, PolicyAccordionsComponent],
  templateUrl: './reservation-flow.component.html',
  styleUrl: './reservation-flow.component.scss'
})
export class ReservationFlowComponent implements OnInit, AfterContentChecked, OnDestroy {

  public _activitySignal: Signal<any> = signal(null);
  public _accessPointsSignal: Signal<any[]> = signal([]);

  public acCollectionId: string | null = null;
  public activityType: string | null = null;
  public activityId: string | null = null;
  public startDate;
  public endDate;
  public occupants: any = {};
  public activityData;
  public geozoneData;
  public accessPointsData;
  public accessPointsSelectionList;
  public provinceStateSelectionList;
  public countrySelectionList = countries;
  public maxVehicles = 2;
  public currentVehicleCount = 1; // Start with one vehicle by default
  public registrationProvinceStateSelectionList;
  public adultRate = 10;
  public youthRate = 5;
  public gstRate = 0.05;
  public user;

  public form;
  public transactionUrl;
  public _transactionUrlSignal = signal(null);

  constructor(
    private route: ActivatedRoute,
    private activityService: ActivityService,
    private dataService: DataService,
    private facilityService: FacilityService,
    private changeDetectorRef: ChangeDetectorRef,
    private router: Router,
    private authService: AuthService,
    private bookingService: BookingService,
    private apiService: ApiService,
    protected loadingService: LoadingService
  ) {
    this.user = this.authService.getCurrentUser();
    this._activitySignal = this.dataService.watchItem(Constants.dataIds.ACTIVITY_DETAILS_RESULT);
    this._accessPointsSignal = this.dataService.watchItem(Constants.dataIds.ACTIVITY_ACCESS_POINTS);
    effect(() => {
      this.activityData = this._activitySignal();
      this.accessPointsData = this._accessPointsSignal();
      this.buildAccessPointsSelectionList()

      this.transactionUrl = this._transactionUrlSignal();
      if (this.transactionUrl) {
        window.location.href = this.transactionUrl;
      }
    });
  }

  ngAfterContentChecked(): void {
    this.changeDetectorRef.detectChanges();
  }

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    this.acCollectionId = params['acCollectionId'] || null;
    this.activityType = params['activityType'] || null;
    this.activityId = params['activityId'] || null;
    this.startDate = params['startDate'] || null;
    this.endDate = params['endDate'] || null;
    this.form = new UntypedFormGroup({
      entryPoint: new UntypedFormControl(null),
      exitPoint: new UntypedFormControl(null),
      acknowledgePolicies: new UntypedFormControl(false, [Validators.requiredTrue]),
      dateRange: new UntypedFormControl([params['startDate'], params['endDate']], { nonNullable: true }),
      occupants: new UntypedFormGroup({
        totalAdult: new UntypedFormControl(parseInt(params['totalAdult']) || 0, { nonNullable: true }),
        totalSenior: new UntypedFormControl(parseInt(params['totalSenior']) || 0, { nonNullable: true }),
        totalYouth: new UntypedFormControl(parseInt(params['totalYouth']) || 0, { nonNullable: true }),
        totalChild: new UntypedFormControl(parseInt(params['totalChild']) || 0, { nonNullable: true }),
      }),
      userIsPrimaryOccupant: new UntypedFormControl(false, { nonNullable: true }),
      contactInfo: new UntypedFormGroup({
        firstName: new UntypedFormControl(''),
        lastName: new UntypedFormControl(''),
        mobilePhone: new UntypedFormControl(''),
        email: new UntypedFormControl('', [Validators.email]),
        homePhone: new UntypedFormControl(''),
      }),
      addressInfo: new UntypedFormGroup({
        streetAddress: new UntypedFormControl(''),
        unitNumber: new UntypedFormControl(''),
        postalCode: new UntypedFormControl(''),
        city: new UntypedFormControl(''),
        province: new UntypedFormControl(''),
        country: new UntypedFormControl('', { nonNullable: true }),
      }),
      equipmentInfo: new UntypedFormArray([
        new UntypedFormGroup({
          licensePlate: new UntypedFormControl(''),
          registeredProvince: new UntypedFormControl('')
        })
      ]),
      additionalEquipment: new UntypedFormControl(''),
    });

    // watch for country change
    this.provinceStateSelectionList = provinces;
    this.form?.get('addressInfo.country').valueChanges.subscribe((country) => {
      if (country === 'Canada') {
        this.provinceStateSelectionList = provinces;
      } else if (country === 'United States of America') {
        this.provinceStateSelectionList = states;
      } else {
        this.provinceStateSelectionList = ['N/A'];
      }
    });

    this.form.get('addressInfo.country').setValue('Canada'); // Default to Canada
    if (this.user) {
      this.form.get('userIsPrimaryOccupant').setValue(true);
    }

    this.registrationProvinceStateSelectionList = provinces.concat(states).concat(['Other']);

    this.activityService.getActivity(this.acCollectionId, this.activityType, this.activityId, true);
    this.facilityService.getAccessPoints(this.acCollectionId);
    this.form.updateValueAndValidity();
  }

  buildAccessPointsSelectionList() {
    if (!this.accessPointsData || this.accessPointsData.length === 0) {
      this.accessPointsSelectionList = [];
      return;
    }
    this.accessPointsSelectionList = this.accessPointsData.map((point) => ({
      display: point?.displayName,
      value: point
    }));
  }

  setUserAsPrimaryOccupant(userIsOccupant = true) {
    this.form.get('userIsPrimaryOccupant').setValue(userIsOccupant);
    this.form.updateValueAndValidity();
    this.changeDetectorRef.detectChanges();
  }

  calculateTotalNights(): number {
    const startDate = this.form.get('dateRange')?.value[0] || null;
    const endDate = this.form.get('dateRange')?.value[1] || null;
    if (!startDate || !endDate) {
      return 0;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const totalNights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return totalNights;
  }

  async submit() {
    const submissionValue = this.formatFormForSubmission();
    try {
      const booking = await this.bookingService.createBooking(this.formatFormForSubmission(), this.acCollectionId, this.activityType, this.activityId, submissionValue.startDate);
      const bookingId = booking?.booking?.[0]?.data?.globalId || null;
      const sessionId = booking?.booking?.[0]?.data?.sessionId || null;
      if (bookingId && sessionId) {
        await this.initiateTransaction(bookingId, sessionId);
      } else {
        throw new Error('Booking creation failed, no booking ID returned.');
      }

    } catch (error) {
      console.error('Error creating booking:', error);
      // Handle the error appropriately, e.g., show a notification to the user
      alert(`There was an error creating your booking. Please try again later.`);
      this.router.navigate(['/']);
    }
  }

  formatFormForSubmission() {
    const formValue = this.form.value;
    const bookedAt = new Date().toISOString();
    const formattedValue = {
      startDate: formValue.dateRange[0],
      endDate: formValue.dateRange[1],
      entryPoint: this.getFormattedAccessPointKey(formValue?.entryPoint),
      exitPoint: this.getFormattedAccessPointKey(formValue?.exitPoint),
      displayName: this.activityData?.displayName || '',
      timezone: 'America/Vancouver', // Todo - update to reflect activity timezone
      bookedAt: bookedAt,
      user: this.user?.sub ? this.user.sub : '',
      partyInformation: {
        adult: parseInt(formValue.occupants.totalAdult) || 0,
        senior: parseInt(formValue.occupants.totalSenior) || 0,
        youth: parseInt(formValue.occupants.totalYouth) || 0,
        child: parseInt(formValue.occupants.totalChild) || 0,
      },
      rateClass: 'standard', // Todo - update to reflect activity rate class
      namedOccupant: this.getNamedOccupantInformation(),
      feeInformation: {
        registrationFees: this.getTotalCost(),
        transactionFees: 0, // Todo - update to reflect transaction fees
        tax: this.calculateInclusiveGST(),
        total: this.getTotalCost()
      },
      vehicleInformation: formValue.equipmentInfo?.map((vehicle) => ({
        licensePlate: vehicle.licensePlate || '',
        licensePlateRegistrationRegion: vehicle.registeredProvince || ''
      })),
      equipmentInformation: formValue?.additionalEquipment || '',
      bookingStatus: 'confirmed',
      location: formValue?.entryPoint?.location ? formValue.entryPoint?.location : null
    };

    if (!formattedValue.user) {
      delete formattedValue.user; // Remove user if not logged in
    }

    return formattedValue;
  }

  getNamedOccupantInformation() {
    const userIsOccupant = this.form.get('userIsPrimaryOccupant').value;
    const obj = {
      firstName: userIsOccupant ? this.user?.given_name || '' : this.form.get('contactInfo.firstName').value,
      lastName: userIsOccupant ? this.user?.family_name || '' : this.form.get('contactInfo.lastName').value,
      contactInfo: {
        email: userIsOccupant ? this.user?.email || '' : this.form.get('contactInfo.email').value,
        mobilePhone: userIsOccupant ? this.user?.phone_number || '' : this.form.get('contactInfo.mobilePhone').value,
        homePhone: userIsOccupant ? this.user?.phone_number || '' : this.form.get('contactInfo.homePhone').value,
        streetAddress: userIsOccupant ? this.user?.address?.streetAddress || '' : this.form.get('addressInfo.streetAddress').value,
        unitNumber: userIsOccupant ? this.user?.address?.unitNumber || '' : this.form.get('addressInfo.unitNumber').value,
        postalCode: userIsOccupant ? this.user?.address?.postalCode || '' : this.form.get('addressInfo.postalCode').value,
        city: userIsOccupant ? this.user?.address?.city || '' : this.form.get('addressInfo.city').value,
        province: userIsOccupant ? this.user?.address?.province || '' : this.form.get('addressInfo.province').value,
        country: userIsOccupant ? this.user?.address?.country || '' : this.form.get('addressInfo.country').value,
      }
    }
    for (const key in obj.contactInfo) {
      if (obj.contactInfo[key] === '') {
        delete obj.contactInfo[key];
      }
    }
    return obj;
  }

  getFormattedAccessPointKey(accessPoint){
    return {
      pk: accessPoint?.pk || null,
      sk: accessPoint?.sk || null,
    }
  }

  updateVehicleCount(count: number, increment = false): void {
    let nextVehicleCount = 0;
    if (increment) {
      nextVehicleCount = this.currentVehicleCount + count;
    } else {
      nextVehicleCount = count;
    }
    if (nextVehicleCount >= 0 && nextVehicleCount <= this.maxVehicles) {
      this.currentVehicleCount = nextVehicleCount;
      for (let i = 0; i < this.currentVehicleCount; i++) {
        if (!this.form.get('equipmentInfo').controls[i]) {
          this.form.get('equipmentInfo').push(new UntypedFormGroup({
            licensePlate: new UntypedFormControl(''),
            registeredProvince: new UntypedFormControl('')
          }));
        }
      }
    }
  }

  calculateTotalOccupants(): number {
    return (parseInt(this.form.get('occupants.totalAdult').value) || 0) +
      (parseInt(this.form.get('occupants.totalSenior').value) || 0) +
      (parseInt(this.form.get('occupants.totalYouth').value) || 0) +
      (parseInt(this.form.get('occupants.totalChild').value) || 0);
  }

  getAdultOccupants(): number {
    return parseInt(this.form.get('occupants.totalAdult').value || 0) + parseInt(this.form.get('occupants.totalSenior').value || 0);
  }

  getYouthOccupants(): number {
    return parseInt(this.form.get('occupants.totalYouth').value || 0) + parseInt(this.form.get('occupants.totalChild').value || 0);
  }

  getNightlyAdultCost(): number {
    const totalAdults = this.getAdultOccupants();
    return totalAdults * this.adultRate;
  }

  getNightlyYouthCost(): number {
    const totalYouth = this.getYouthOccupants();
    return totalYouth * this.youthRate;
  }

  getTotalCost(): number {
    const totalNights = this.calculateTotalNights();
    const nightlyAdultCost = this.getNightlyAdultCost();
    const nightlyYouthCost = this.getNightlyYouthCost();
    const totalAdultCost = nightlyAdultCost * totalNights;
    const totalYouthCost = nightlyYouthCost * totalNights;
    return totalAdultCost + totalYouthCost;
  }

  calculateInclusiveGST(): number {
    const totalCost = this.getTotalCost();
    const gstAmount = totalCost * (1 - 1 / (1 + this.gstRate));
    return parseFloat(gstAmount.toFixed(2));
  }

  navigate() {
    this.router.navigate(['/']);
  }

  isFormInvalid() {
    // If the form is invalid
    if (!this.form.valid) {
      return true;
    }
    // If party size is less than 1 or greater than 10
    const partySize = this.getAdultOccupants() + this.getYouthOccupants();
    if (partySize < 1 || partySize > 10) {
      return true;
    }
    // If the date range is invalid or the start date is equal to or after the end date
    if (this.form.get('dateRange').value[0] >= this.form.get('dateRange').value[1]) {
      return true;
    }
    // If the acknowledgePolicies checkbox is not checked
    if (this.form.get('acknowledgePolicies').value !== true) {
      return true;
    }
    // If the entryPoint or exitPoint is not selected
    if (!this.form.get('entryPoint').value || !this.form.get('exitPoint').value) {
      return true;
    }
    // If the user is not a primary occupant and the contact info is incomplete
    if (this.form.get('userIsPrimaryOccupant').value === false) {
      // if firstName, lastName, or mobilePhone is empty
      if (this.form.get('contactInfo.firstName').value === '' ||
        this.form.get('contactInfo.lastName').value === '' ||
        this.form.get('contactInfo.mobilePhone').value === '') {
        return true;
      }
      // if streetAddress, city, postalCode, country, or province is empty
      if (this.form.get('addressInfo.streetAddress').value === '' ||
        this.form.get('addressInfo.city').value === '' ||
        this.form.get('addressInfo.postalCode').value === '' ||
        this.form.get('addressInfo.country').value === '' ||
        this.form.get('addressInfo.province').value === '') {
        return true;
      }
    }
    return false;
  }

  async initiateTransaction(bookingId: string, sessionId: string) {
    const totalCost = this.getTotalCost();
    const body = {
      trnAmount: totalCost,
      bookingId: bookingId,
      sessionId: sessionId
    };

    try {
      this.loadingService.addToFetchList(Constants.dataIds.TRANSACTION_POST_RESULTS);
      const res: any = await lastValueFrom(this.apiService.post(`transactions`, body, {}));
      this._transactionUrlSignal.set(res?.data?.response?.transaction?.data?.transactionUrl)
      this.dataService.setItemValue(Constants.dataIds.TRANSACTION_POST_RESULTS, res);
      this.loadingService.removeFromFetchList(Constants.dataIds.TRANSACTION_POST_RESULTS);
    } catch (error) {
      console.error('Failed to create transaction:', error);
    }
    
    // In case there's a slight delay, add a loading overlay on the page
    this.transactionUrl = true;
  }

  ngOnDestroy(): void {
    this.changeDetectorRef.detectChanges();
    this.changeDetectorRef.detach();
  }
}
