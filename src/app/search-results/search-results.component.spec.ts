import { DataService } from '../services/data.service';
import { LoadingService } from '../services/loading.service';
import { SearchResultsComponent } from './search-results.component';
import { SearchService } from '../services/search.service';

import { ActivatedRoute } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, BehaviorSubject } from 'rxjs';

describe('SearchResultsComponent', () => {
  let component: SearchResultsComponent;
  let fixture: ComponentFixture<SearchResultsComponent>;

  const mockQueryParams = of({ search: 'camping' });
  const mockSearchService = { searchByQuery: jasmine.createSpy('searchByQuery') };

  const mockLoadingService = {
    isLoading: jasmine.createSpy('isLoading').and.returnValue(false)
  };

  const mockData = new BehaviorSubject<any[]>([
    { _source: { schema: 'protectedArea' } },
    { _source: { schema: 'activity' } }
  ]);
  const mockDataService = {
    watchItem: () => () => mockData.value,
    // Can't even have an empty arrow function in TS anymore, what is this world coming to?
    setItemValue: () => null
  };


  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchResultsComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { queryParams: mockQueryParams } },
        { provide: SearchService, useValue: mockSearchService },
        { provide: DataService, useValue: mockDataService },
        { provide: LoadingService, useValue: mockLoadingService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SearchResultsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should set loading from loadingService', () => {
    expect(component.loading).toBe(false);
    expect(mockLoadingService.isLoading).toHaveBeenCalled();
  });

  it('should set searchTerm and call searchByQuery on init', () => {
    expect(component.searchTerm).toBe('camping');
    expect(component.searchBox).toBe('camping');
    expect(mockSearchService.searchByQuery).toHaveBeenCalledWith('camping');
  });

  it('should categorize data from dataService', () => {
    component.categorizeData();

    expect(Object.keys(component.categorizedData)).toContain('Parks');
    expect(component.categorizedData['Parks'].length).toBe(1);
    expect(component.categorizedData['Activity'].length).toBe(1);
  });
});
