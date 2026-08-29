import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConfigService } from '../services/config.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MyBookingsComponent } from './my-bookings.component';
import { provideToastr } from 'ngx-toastr';
import { DateTime } from 'luxon';
import { of } from 'rxjs';
import { ApiService } from '../services/api.service';
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
    // An unfinished checkout is not a booking the visitor holds - it is not
    // rendered anywhere on this page.
    const shown = [...component.activeBookings, ...component.upcomingBookings,
                   ...component.pastBookings, ...component.cancelledBookings];
    expect(shown.map(b => b.bookingId)).not.toContain('pending');
    expect(component.activeBookings[0].passType).toBe('Trail pass');
    expect(component.activeBookings[0].imageUrl).toBe('https://example.com/park.jpg');
  });

  // The bookings endpoint returns neither the park image nor the pass sub-type,
  // so both are looked up from the facility/activity endpoints.
  it('fills in the park image and pass sub-type the bookings endpoint omits', async () => {
    const today = DateTime.now().setZone('America/Vancouver');
    spyOn(TestBed.inject(ApiService), 'get').and.callFake((path: string, params?: any) => {
      if (path.startsWith('activities')) {
        return of({ data: { items: [{ activityId: 1, activitySubType: 'vehicleParking' }] } });
      }
      if (params?.fetchGeozones) {
        return of({ data: { geozones: [{ imageUrl: 'https://example.com/geozone.jpg' }] } });
      }
      return of({ data: { items: [{ facilityType: 'structure', facilityId: 1 }] } });
    });

    const items = [{
      schema: 'booking',
      bookingId: 'sparse',
      status: 'confirmed',
      collectionId: 'bcparks_8',
      activityType: 'dayuse',
      activityId: 1,
      startDate: today.plus({ days: 5 }).toISODate(),
      endDate: today.plus({ days: 6 }).toISODate()
    }];
    TestBed.inject(DataService).setItemValue(Constants.dataIds.MY_BOOKINGS_RESULT, { items });

    component.processBookings();
    expect(component.upcomingBookings[0].imageUrl).toBe('');

    await component.enrichBookings(items);

    expect(component.upcomingBookings[0].imageUrl).toBe('https://example.com/geozone.jpg');
    expect(component.upcomingBookings[0].passType).toBe('Parking pass');
  });
});
