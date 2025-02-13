import { TestBed } from '@angular/core/testing';

import { PermitService } from './permit.service';
import { ConfigService } from './config.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('PermitService', () => {
  let service: PermitService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ConfigService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(PermitService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
