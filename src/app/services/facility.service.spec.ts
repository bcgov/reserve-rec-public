import { TestBed } from '@angular/core/testing';

import { FacilityService } from './facility.service';
import { ConfigService } from './config.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('FacilityService', () => {
  let service: FacilityService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ConfigService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(FacilityService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
