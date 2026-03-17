import { TestBed } from '@angular/core/testing';

import { ProductDateService } from './product-date.service';
import { ConfigService } from './config.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideToastr } from 'ngx-toastr';

describe('ProductDateService', () => {
  let service: ProductDateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ConfigService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideToastr()
      ]
    });
    service = TestBed.inject(ProductDateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
