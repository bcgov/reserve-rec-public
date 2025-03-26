import { Component, effect, inject } from '@angular/core';
import { DataService } from '../services/data.service';
import { Constants } from '../constants';
import { CommonModule } from '@angular/common';
import { LoadingService } from '../services/loading.service';
import { Router } from '@angular/router';
import { SearchMapComponent } from "../search-map/search-map.component";
import { SearchService } from '../services/search.service';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-search',
    templateUrl: './search-results.component.html',
    styleUrls: ['./search-results.component.scss'],
    imports: [CommonModule, FormsModule, SearchMapComponent]
})
export class SearchResultsComponent {
  public data = null;
  public loading = false;
  private searchService = inject(SearchService);
  searchBox = '';

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

  search(): void {
    console.log("Searching for: ", this.searchBox);
    // Get search results and put into data service
    if (this.searchBox !== '') {
      this.searchService.searchByQuery(this.searchBox);
    }

    // Then navigate to search page
    this.router.navigate(['/results']);
  }
}

