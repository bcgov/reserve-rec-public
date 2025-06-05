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

@Component({
  selector: 'app-reservation-flow',
  imports: [CommonModule, NgdsFormsModule, DatePipe, CurrencyPipe, PartyDetailsComponent],
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

  constructor(
    private route: ActivatedRoute,
    private activityService: ActivityService,
    private dataService: DataService,
    private facilityService: FacilityService,
    private changeDetectorRef: ChangeDetectorRef,
    private router: Router,
    private authService: AuthService
  ) {
    this.user = this.authService.getCurrentUser();
    this._activitySignal = this.dataService.watchItem(Constants.dataIds.ACTIVITY_DETAILS_RESULT);
    this._accessPointsSignal = this.dataService.watchItem(Constants.dataIds.ACTIVITY_ACCESS_POINTS);
    effect(() => {
      this.activityData = this._activitySignal();
      this.accessPointsData = this._accessPointsSignal();
      this.buildAccessPointsSelectionList();
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

  showFormValue() {
    console.log('this.form.value:', this.form.value);
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
    return gstAmount;
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

  ngOnDestroy(): void {
    this.changeDetectorRef.detectChanges();
    this.changeDetectorRef.detach();
  }


}

