import { Component, effect } from '@angular/core';
import { DataService } from '../services/data.service';
import { Constants } from '../constants';
import { CommonModule } from '@angular/common';
import { LoadingService } from '../services/loading.service';
import { Router } from '@angular/router';
import { SearchMapComponent } from "../search-map/search-map.component";

@Component({
    selector: 'app-search',
    templateUrl: './search.component.html',
    styleUrls: ['./search.component.scss'],
    imports: [CommonModule, SearchMapComponent]
})
export class SearchComponent {
  public data = null;
  public loading = false;


  constructor(private dataService: DataService, private loadingService: LoadingService, private router: Router) {
    effect(() => {
      this.data = this.dataService.watchItem(Constants.dataIds.SEARCH_RESULTS)();
      console.log(this.data);
    });

    effect(() => {
      this.loading = this.loadingService.isLoading();
    });
  }

  navigate(orcs: string, facilityType: string, facilityId: string) {
    console.log(orcs, facilityType, facilityId);
    this.router.navigate(['/facility', orcs, facilityType, facilityId]);
  }
}