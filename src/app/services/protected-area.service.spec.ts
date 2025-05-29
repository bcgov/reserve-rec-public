import { TestBed } from '@angular/core/testing';

import { ProtectedAreaService } from './protected-area.service';
import { ConfigService } from './config.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('ProtectedAreaService', () => {
  let service: ProtectedAreaService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ConfigService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(ProtectedAreaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
