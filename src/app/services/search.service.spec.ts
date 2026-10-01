import { TestBed } from '@angular/core/testing';

import { SearchService } from './search.service';
import { ConfigService } from './config.service';
import { provideToastr } from 'ngx-toastr';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [],
      providers: [ConfigService, provideHttpClient(),
        provideHttpClientTesting(),
        provideToastr()]
    });
    service = TestBed.inject(SearchService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
