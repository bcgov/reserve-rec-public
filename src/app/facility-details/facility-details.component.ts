import { Component, effect, OnInit, signal, Signal, WritableSignal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Constants } from '../constants';
import { DataService } from '../services/data.service';
import { FacilityService } from '../services/facility.service';
import { CommonModule } from '@angular/common';
import { SearchResultSectionComponent } from '../search-results/search-results-section/search-result-section.component';
import { SearchResultItemComponent } from '../search-results/search-results-section/search-result-item/search-result-item.component';
import { SearchMapComponent } from '../search-map/search-map.component';

@Component({
  selector: 'app-facility-details',
  host: { class: 'h-100' },
  imports: [CommonModule, SearchResultSectionComponent, SearchResultItemComponent, SearchMapComponent],
  templateUrl: './facility-details.component.html',
  styleUrl: './facility-details.component.scss'
})
export class FacilityDetailsComponent implements OnInit {

  public _dataSignal: Signal<any[]> = signal([]);
  public _activitiesSignal: WritableSignal<any[]> = signal([]);

  public fcCollectionId;
  public facilityType;
  public identifier;
  public data;
  public activities;

  constructor(private route: ActivatedRoute, private router: Router, private facilityService: FacilityService, private dataService: DataService) {
    this._dataSignal = this.dataService.watchItem(Constants.dataIds.FACILITY_DETAILS_RESULT);
    effect(() => {
      this.data = this._dataSignal();
      if (this.data?.activities?.length > 0) {
        this._activitiesSignal.set(this.data.activities);
        this.activities = this._activitiesSignal();
        this.formatActivities();
      }
    });
  }

  ngOnInit(): void {
    const params = this.route.snapshot.paramMap;
    this.fcCollectionId = params.get('fcCollectionId');
    this.facilityType = params.get('facilityType');
    this.identifier = params.get('identifier');

    this.facilityService.getFacility(this.fcCollectionId, this.facilityType, this.identifier, true);
  }

  formatActivities() {
    for (const activity of this.activities) {
      activity['navigation'] = "/activity/" + activity.acCollectionId + "/" + activity.activityType + "/" + activity.identifier;
    }
  }

  navigate(acCollectionId, activityType, identifier) {
    this.router.navigate(['/activity', acCollectionId, activityType, identifier]);
  }

  navToProtectedArea() {
    if (this.data?.orcs) {
      this.router.navigate(['/protected-area', this.data.orcs]);
    } else {
      console.warn('Protected Area ORCS not found in facility data.');
    }
  }
}
