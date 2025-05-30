import { AfterContentChecked, ChangeDetectorRef, Component, effect, OnDestroy, OnInit, signal, Signal, WritableSignal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Constants } from '../constants';
import { DataService } from '../services/data.service';
import { ActivityService } from '../services/activity.service';
import { CommonModule } from '@angular/common';
import { SearchMapComponent } from '../search-map/search-map.component';
import { UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { NgdsFormsModule } from '@digitalspace/ngds-forms';

@Component({
  selector: 'app-activity-details',
  imports: [CommonModule, SearchMapComponent, NgdsFormsModule],
  templateUrl: './activity-details.component.html',
  styleUrl: './activity-details.component.scss'
})
export class ActivityDetailsComponent implements OnInit, AfterContentChecked, OnDestroy {

  public _dataSignal: Signal<any[]> = signal([]);
  public _searchTermSignal: Signal<string> = signal('');
  public _geozoneSignal: WritableSignal<any> = signal(null);

  public acCollectionId;
  public activityType;
  public identifier;
  public data = null;
  public searchTerm = '';

  public form = new UntypedFormGroup({
    dateRange: new UntypedFormControl(null),
    occupants: new UntypedFormGroup({
      totalAdult: new UntypedFormControl(0, { nonNullable: true }),
      totalSenior: new UntypedFormControl(0, { nonNullable: true }),
      totalYouth: new UntypedFormControl(0, { nonNullable: true }),
      totalChild: new UntypedFormControl(0, { nonNullable: true }),
    })
  });

  constructor(private route: ActivatedRoute, private activityService: ActivityService, private dataService: DataService, private changeDetectorRef: ChangeDetectorRef) {
    this._dataSignal = this.dataService.watchItem(Constants.dataIds.ACTIVITY_DETAILS_RESULT);
    this._searchTermSignal = this.dataService.watchItem('search-query');
    effect(() => {
      this.data = this._dataSignal();
      if (this.data?.geozone?.envelope) {
        this._geozoneSignal.set([this.data.geozone]);
      }
      this.searchTerm = this._searchTermSignal();
    });
  }

  ngAfterContentChecked(): void {
    this.changeDetectorRef.detectChanges();
  }

  ngOnInit(): void {
    const params = this.route.snapshot.paramMap;
    this.acCollectionId = params.get('acCollectionId');
    this.activityType = params.get('activityType');
    this.identifier = params.get('identifier');

    this.activityService.getActivity(this.acCollectionId, this.activityType, this.identifier, true);
  }

  navBack() {
    window.history.back();
  }

  isSubmitDisabled() {
    const total = this.getTotalOccupants();
    if (!this.form?.controls?.['dateRange']?.value || total === 0 || total > 10) {
      return true;
    }
    return false;
  }

  submit() {
    console.log('this.form.value:', this.form.value);
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
