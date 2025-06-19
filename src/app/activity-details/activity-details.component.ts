import { AfterContentChecked, ChangeDetectorRef, Component, effect, OnDestroy, OnInit, signal, Signal, WritableSignal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Constants } from '../constants';
import { DataService } from '../services/data.service';
import { ActivityService } from '../services/activity.service';
import { CommonModule } from '@angular/common';
import { SearchMapComponent } from '../search-map/search-map.component';
import { UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { NgdsFormsModule } from '@digitalspace/ngds-forms';
import { PartyDetailsComponent } from '../party-details/party-details.component';
import { DateTime } from 'luxon';

@Component({
  selector: 'app-activity-details',
  imports: [CommonModule, SearchMapComponent, NgdsFormsModule, PartyDetailsComponent],
  templateUrl: './activity-details.component.html',
  styleUrl: './activity-details.component.scss'
})
export class ActivityDetailsComponent implements OnInit, AfterContentChecked, OnDestroy {

  public _dataSignal: Signal<any[]> = signal([]);
  public _geozoneSignal: WritableSignal<any> = signal(null);

  public acCollectionId;
  public activityType;
  public activityId;
  public data = null;
  public searchTerm = '';
  public today = DateTime.now().setZone('America/Vancouver');

  public form = new UntypedFormGroup({
    dateRange: new UntypedFormControl(null),
    occupants: new UntypedFormGroup({
      totalAdult: new UntypedFormControl(0, { nonNullable: true, validators: [Validators.min(0), Validators.max(10)] }),
      totalSenior: new UntypedFormControl(0, { nonNullable: true, validators: [Validators.min(0), Validators.max(10)]  }),
      totalYouth: new UntypedFormControl(0, { nonNullable: true, validators: [Validators.min(0), Validators.max(10)]  }),
      totalChild: new UntypedFormControl(0, { nonNullable: true, validators: [Validators.min(0), Validators.max(10)]  }),
    })
  });

  constructor(private route: ActivatedRoute, private activityService: ActivityService, private dataService: DataService, private changeDetectorRef: ChangeDetectorRef, private router: Router) {
    this._dataSignal = this.dataService.watchItem(Constants.dataIds.ACTIVITY_DETAILS_RESULT);
    this.searchTerm= this.dataService.getItemValue('search-query');
    effect(() => {
      this.data = this._dataSignal();
      if (this.data?.geozone?.envelope) {
        this._geozoneSignal.set([this.data.geozone]);
      }
    });
  }

  ngAfterContentChecked(): void {
    this.changeDetectorRef.detectChanges();
  }

  ngOnInit(): void {
    const params = this.route.snapshot.paramMap;
    this.acCollectionId = params.get('acCollectionId');
    this.activityType = params.get('activityType');
    this.activityId = params.get('identifier');

    this.activityService.getActivity(this.acCollectionId, this.activityType, this.activityId, true);
  }

  navBack() {
    window.history.back();
  }

  isSubmitDisabled() {
    const total = this.getTotalOccupants();
    if (!this.form?.controls?.['dateRange']?.value || total === 0 || total > 10) {
      return true;
    }
    if (this.form?.controls?.['dateRange']?.[0]?.value >= this.form?.controls?.['dateRange']?.[1]?.value) {
      return true;
    }
    return false;
  }

  submit() {
    console.log('this.form.value:', this.form.value);
    this.router.navigate(['/checkout'], {
      queryParams: {
        acCollectionId: this.acCollectionId,
        activityType: this.activityType,
        activityId: this.activityId,
        startDate: this.getStartDate(),
        endDate: this.getEndDate(),
        totalAdult: this.form.get('occupants')?.get('totalAdult')?.value,
        totalSenior: this.form.get('occupants')?.get('totalSenior')?.value,
        totalYouth: this.form.get('occupants')?.get('totalYouth')?.value,
        totalChild: this.form.get('occupants')?.get('totalChild')?.value,
      }
    });
  }

  getStartDate() {
    return this.form.get('dateRange')?.value ? this.form.get('dateRange')?.value[0] : null;
  }

  getEndDate() {
    return this.form.get('dateRange')?.value ? this.form.get('dateRange')?.value[1] : null;
  }

  getTotalOccupants() {
    let total = 0;
    for (const control in this.form?.get('occupants')?.['controls']) {
      if (this.form?.get('occupants')?.['controls'][control]?.value) {
        total += this.form?.get('occupants')?.['controls'][control]?.value;
      }
    }
    return total;
  }

  increment(field, value) {
    const currentValue = this.form.get('occupants')?.get(field)?.value;
    const totalOccupants = this.getTotalOccupants();
    if (currentValue + value >= 0 && totalOccupants + value <= 10) {
      this.form.get('occupants')?.get(field)?.setValue(currentValue + value);
    }
  }

  ngOnDestroy(): void {
    this.changeDetectorRef.detectChanges();
    this.changeDetectorRef.detach();
  }

}
