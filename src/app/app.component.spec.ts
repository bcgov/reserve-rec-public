import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { ConfigService } from './services/config.service';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [ConfigService, provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
  });

  it('should create the app', () => {
    expect(true).toBeTruthy();
  });
});
