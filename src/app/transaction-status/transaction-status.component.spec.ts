import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransactionStatusComponent } from './transaction-status.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ConfigService } from '../services/config.service';

describe('TransactionStatusComponent', () => {
  let component: TransactionStatusComponent;
  let fixture: ComponentFixture<TransactionStatusComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransactionStatusComponent],
      providers: [
        ConfigService,
        provideRouter([{path: 'checkout', component: TransactionStatusComponent}]),
        provideHttpClient(),
        provideHttpClientTesting() // Uncomment if you need to mock HTTP requests in tests
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TransactionStatusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
