import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReservationFlowComponent } from './reservation-flow.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ConfigService } from '../services/config.service';

describe('ReservationFlowComponent', () => {
  let component: ReservationFlowComponent;
  let fixture: ComponentFixture<ReservationFlowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReservationFlowComponent],
      providers: [
        ConfigService,
        provideRouter([{path: 'checkout', component: ReservationFlowComponent}]),
        provideHttpClient(),
        provideHttpClientTesting() // Uncomment if you need to mock HTTP requests in tests
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReservationFlowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
