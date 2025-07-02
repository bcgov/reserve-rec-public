import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BookingConfirmationComponent } from './booking-confirmation.component';
import { ConfigService } from '../../services/config.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

describe('BookingConfirmationComponent', () => {
  let component: BookingConfirmationComponent;
  let fixture: ComponentFixture<BookingConfirmationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookingConfirmationComponent
      ],
      providers: [
        ConfigService,
        provideRouter([
          {
            path: 'booking-confirmation/:bookingId',
            component: BookingConfirmationComponent,
          }
        ]),
        provideHttpClient(),
        provideHttpClientTesting() // Uncomment if you need to mock HTTP requests in tests
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BookingConfirmationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
