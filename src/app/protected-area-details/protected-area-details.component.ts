import { Component, effect, OnInit, Signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProtectedAreaService } from '../services/protected-area.service';
import { DataService } from '../services/data.service';
import { Constants } from '../constants';
import { CommonModule } from '@angular/common';
import { SearchResultSectionComponent } from '../search-results/search-results-section/search-result-section.component';
import { SearchResultItemComponent } from '../search-results/search-results-section/search-result-item/search-result-item.component';
import { SearchMapComponent } from '../search-map/search-map.component';

@Component({
  selector: 'app-protected-area-details',
  host: { class: 'results-container' },
  imports: [CommonModule, SearchResultSectionComponent, SearchResultItemComponent, SearchMapComponent],
  templateUrl: './protected-area-details.component.html',
  styleUrl: './protected-area-details.component.scss'
})
export class ProtectedAreaDetailsComponent implements OnInit {
  public orcs;
  public _data: Signal<any[]>;
  public _facilities: Signal<any[]>;

  public data;
  public facilities;

  constructor(
    private route: ActivatedRoute,
    private protectedAreaService: ProtectedAreaService,
    private dataService: DataService,
    private router: Router
  ) {
    this._data = this.dataService.watchItem('protectedAreaDetails');
    this._facilities = this.dataService.watchItem(Constants.dataIds.FACILITY_DETAILS_RESULT);
    effect(() => {
      this.data = this._data();
      this.facilities = this._facilities();
      this.formatFacilities();
    });
  }

  formatFacilities() {
    if (this.facilities?.items) {
      for (const facility of this.facilities.items) {
        facility['navigation'] = "/facility/" + facility.collectionId + "/" + facility.facilityType + "/" + facility.identifier;
      }
    }
  }

  navBack() {
    const searchQuery = this.dataService.getItemValue('search-query');
    if (searchQuery) {
      this.router.navigate(['/results'], { queryParams: { search: searchQuery } });
    } else {
      this.router.navigate(['/search']);
    }
  }

  ngOnInit(): void {
    const params = this.route.snapshot.paramMap;
    this.orcs = params.get('orcs');

    this.protectedAreaService.getProtectedArea(this.orcs, true);
  }

}

