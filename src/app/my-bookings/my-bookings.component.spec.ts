import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { BookingService } from '../services/booking.service';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Constants } from '../constants';
import { DataService } from '../services/data.service';
import { DateTime } from 'luxon';
import { LoadingService } from '../services/loading.service';
import { MyBookingsComponent } from './my-bookings.component';

describe('MyBookingsComponent', () => {
  let component: MyBookingsComponent;
  let fixture: ComponentFixture<MyBookingsComponent>;

  const mockUser = { user: { sub: 'abc-123-abc-123' } };

  const mockLoadingService = {
    isLoading: jasmine.createSpy('isLoading').and.returnValue(false)
  };

  const mockBooking = new BehaviorSubject<any[]>([
    {
      "parkName": "Test Park - Active",
      "startDate": "2025-05-29",
      "endDate": "2025-05-31",
      "displayName": "Cape Scott Provincial Park",
      "bookingHash": "123456789ABC123",
      "coordinates": [
        [-128.4506242429, 50.8821710236],
        [-127.839509741, 50.645034061]
      ],
      "partyInformation": {
        "totalYouth": 2,
        "totalAdults": 3,
        "totalChild": 0,
        "totalSeniors": 0
      },
      "bookingId": 123,
      "location": {
        "coordinates": [-128.33719901723597, 50.731435377971636],
        "type": "point"
      },
      "entryPoint": "Test Entry Point",
    },
    {
      "parkName": "Test Park - Upcoming",
      "startDate": "2025-06-09",
      "endDate": "2025-06-14",
      "displayName": "Cape Scott Provincial Park",
      "bookingHash": "987654321CBA321",
      "coordinates": [
        [-128.4506242429, 50.8821710236],
        [-127.839509741, 50.645034061]
      ],
      "partyInformation": {
        "totalYouth": 2,
        "totalAdults": 0,
        "totalChild": 0,
        "totalSeniors": 0
      },
      "bookingId": 127,
      "location": {
        "coordinates": [-128.33719901723597, 50.731435377971636],
        "type": "point"
      },
      "entryPoint": "Test Entry Point",
    }
  ]);


  const mockBookingService = {
    getBookings: () => () => mockBooking
  };

  const mockDataService = {
    watchItem: jasmine.createSpy().and.returnValue(() => mockBooking.getValue())
  };


  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyBookingsComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { data: mockUser } } },
        { provide: BookingService, useValue: mockBookingService },
        { provide: LoadingService, useValue: mockLoadingService },
        { provide: DataService, useValue: mockDataService },

      ]
    }).compileComponents();

    spyOn(DateTime, 'now').and.returnValue(
      DateTime.fromISO('2025-05-30T12:00:00', { zone: 'America/Vancouver' })
    );

    fixture = TestBed.createComponent(MyBookingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should set loading from loadingService', () => {
    expect(component.loading).toBe(false);
    expect(mockLoadingService.isLoading).toHaveBeenCalled();
  });

  it('should set the User with their sub ID on init', () => {
    expect(component.user.sub).toBe('abc-123-abc-123');
  });

  it('should correctly categorize active and upcoming bookings', () => {
    component.processBookings();

    expect(mockDataService.watchItem).toHaveBeenCalledWith(Constants.dataIds.MY_BOOKINGS_RESULT);
    expect(component.upcomingBookings.length).toBe(1);
    expect(component.currentBookings.length).toBe(1);

    const activeBooking = component.currentBookings[0];
    expect(activeBooking.bookingId).toBe(123);
    expect(activeBooking.nights).toBe(2);
    expect(activeBooking.partyTotal).toBe(5);
    expect(activeBooking.parkName).toBe('Test Park - Active');

    const upcomingBooking = component.upcomingBookings[0];
    expect(upcomingBooking.bookingId).toBe(127);
    expect(upcomingBooking.nights).toBe(5);
    expect(upcomingBooking.partyTotal).toBe(2);
    expect(upcomingBooking.parkName).toBe('Test Park - Upcoming');
  });
});
