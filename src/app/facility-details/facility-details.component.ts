import { Component, effect, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Constants } from '../constants';
import { DataService } from '../services/data.service';
import { FacilityService } from '../services/facility.service';
import { FacilityMapComponent } from '../facility-map/facility-map.component';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-permit-details',
    imports: [FacilityMapComponent, CommonModule],
    templateUrl: './facility-details.component.html',
    styleUrl: './facility-details.component.scss'
})
export class FacilityDetailsComponent implements OnInit {
  public fcCollectionId;
  public facilityType;
  public identifier;
  public data = null;

  constructor(private route: ActivatedRoute, private router: Router, private facilityService: FacilityService, private dataService: DataService) {
    effect(() => {
      this.data = this.dataService.watchItem(Constants.dataIds.FACILITY_DETAILS_RESULT)();
      console.log(this.data)
    });
  }

  ngOnInit(): void {
    const params = this.route.snapshot.paramMap;
    this.fcCollectionId = params.get('fcCollectionId');
    this.facilityType = params.get('facilityType');
    this.identifier = params.get('identifier');

    this.facilityService.getFacility(this.fcCollectionId, this.facilityType, this.identifier);
  }

  navigate(orcs, activityType, identifier) {
    this.router.navigate(['/activity', orcs, activityType, identifier]);
  }
}
