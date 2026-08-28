import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConfigService } from '../services/config.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MyBookingsComponent } from './my-bookings.component';
import { provideToastr } from 'ngx-toastr';
import { DateTime } from 'luxon';
import { DataService } from '../services/data.service';
import { Constants } from '../constants';

describe('MyBookingsComponent', () => {
  let component: MyBookingsComponent;
  let fixture: ComponentFixture<MyBookingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyBookingsComponent],
      providers: [
        ConfigService,
        provideRouter([{ path: 'my-bookings/:bookingId', component: MyBookingsComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideToastr()
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MyBookingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('splits bookings into active (happening now), upcoming, past and cancelled', () => {
    const today = DateTime.now().setZone('America/Vancouver');
    const booking = (bookingId: string, start: DateTime, end: DateTime, status = 'confirmed') => ({
      schema: 'booking',
      bookingId,
      status,
      activityType: 'dayuse',
      activitySubType: 'trailUse',
      geozoneImageUrl: 'https://example.com/park.jpg',
      startDate: start.toISODate(),
      endDate: end.toISODate()
    });

    TestBed.inject(DataService).setItemValue(Constants.dataIds.MY_BOOKINGS_RESULT, {
      items: [
        booking('now', today.minus({ days: 1 }), today.plus({ days: 1 })),
        booking('later', today.plus({ days: 5 }), today.plus({ days: 6 })),
        booking('done', today.minus({ days: 10 }), today.minus({ days: 9 })),
        booking('gone', today.plus({ days: 5 }), today.plus({ days: 6 }), 'cancelled'),
        booking('pending', today.plus({ days: 5 }), today.plus({ days: 6 }), 'in progress')
      ]
    });

    component.processBookings();

    expect(component.activeBookings.map(b => b.bookingId)).toEqual(['now']);
    expect(component.upcomingBookings.map(b => b.bookingId)).toEqual(['later']);
    expect(component.pastBookings.map(b => b.bookingId)).toEqual(['done']);
    expect(component.cancelledBookings.map(b => b.bookingId)).toEqual(['gone']);
    // An unfinished checkout is not a booking the visitor holds - it must stay
    // out of Active and Upcoming.
    expect(component.otherBookings.map(b => b.bookingId)).toEqual(['pending']);
    expect(component.activeBookings[0].passType).toBe('Trail pass');
    expect(component.activeBookings[0].imageUrl).toBe('https://example.com/park.jpg');
  });
});
