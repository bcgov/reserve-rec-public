import { TestBed } from '@angular/core/testing';

import { ProductDateService } from './product-date.service';
import { ConfigService } from './config.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('ProductDateService', () => {
  let service: ProductDateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ConfigService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(ProductDateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
