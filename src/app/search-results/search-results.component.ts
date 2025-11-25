import { Component, effect, inject, OnInit, Signal, signal } from '@angular/core';
import { DataService } from '../services/data.service';
import { Constants } from '../constants';
import { CommonModule } from '@angular/common';
import { LoadingService } from '../services/loading.service';
import { ActivatedRoute } from '@angular/router';
import { SearchMapComponent } from "../search-map/search-map.component";
import { SearchService } from '../services/search.service';
import { FormsModule } from '@angular/forms';
import { SearchResultSectionComponent } from './search-results-section/search-result-section.component';
import { SearchResultItemComponent } from './search-results-section/search-result-item/search-result-item.component';

@Component({
  selector: 'app-search',
  templateUrl: './search-results.component.html',
  styleUrls: ['./search-results.component.scss'],
  imports: [CommonModule, FormsModule, SearchMapComponent, SearchResultSectionComponent, SearchResultItemComponent],
})
export class SearchResultsComponent implements OnInit {
  public _dataSignal: Signal<any[]> = signal([]);
  private searchService = inject(SearchService);
  public searchTerm = '';
  public data = null;
  public loading = false;
  public searchBox = '';
  public categories = [
    { id: 'Parks', title: 'Parks', schema: 'protectedArea', navigation: '/protected-area' },
    { id: 'Facility', title: 'Facility', schema: 'facility', navigation: '/facility' },
    { id: 'Activity', title: 'Activity', schema: 'activity', navigation: '/activity' }
  ];
  public categorizedData = {};

  constructor(
    private dataService: DataService,
    private loadingService: LoadingService,
    private route: ActivatedRoute

  ) {
    this._dataSignal = this.dataService.watchItem(Constants.dataIds.SEARCH_RESULTS);
    effect(() => {
      this.data = this._dataSignal();
      // Categorize data as soon as it comes back from OpenSearch
      this.categorizeData();
    });

    effect(() => {
      this.loading = this.loadingService.isLoading();
    });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const query = params['search'];
      if (query) {
        this.dataService.setItemValue('search-query', query);
        this.searchTerm = query;
        this.searchBox = query;

        // Search by the query params provided in URL
        this.searchService.searchByQuery(query);
      }
    });
  }

  get isEmpty(): boolean {
    return this.isCategorizedDataEmpty(this.categorizedData);
  }

  // Look to categorize the data based each item's schema provided from OpenSearch
  categorizeData(): void {
    if (!Array.isArray(this.data)) {
      this.categorizedData = {};
      return;
    }
    const result = {};

    // Initialize all categories with empty arrays
    for (const category of this.categories) {
      result[category.id] = [];
    }

    this.data.forEach(item => {
      // Ensure _source exists before accessing it
      if (!item._source) {
        return;
      }

      switch(item._source?.schema) {
        case 'protectedArea':
          item._source.navigation = `/protected-area/${item._source.orcs}`;
          break;
        case 'facility':
          item._source.navigation = `/facility/${item._source.collectionId}/${item._source.facilityType}/${item._source.facilityId}`;
          break;
        case 'activity':
          item._source.navigation = `/activity/${item._source.collectionId}/${item._source.activityType}/${item._source.activityId}`;
          break;
        default:
          item._source.navigation = `/search/text=${item._source.displayName}`;
          break;
      }
    });

    for (const category of this.categories) {
      result[category.id] = this.data.filter(item => item._source?.schema === category.schema);
    }

    this.categorizedData = result;
  }

  isCategorizedDataEmpty(data: Record<string, any[]>): boolean {
    return Object.values(data).every(arr => !arr || arr.length === 0);
  }

  scrollToAnchor(elementId: string): void {
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

}

