import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { CartItem, CartService } from './cart.service';
import { AuthService } from './auth.service';
import { BookingService } from './booking.service';

// Bookings are held on the API from the moment an item enters the cart, so
// replacing an item must cancel its booking — otherwise the API blocks
// re-booking the same pass/date. (Ref bcgov/reserve-rec-public#650.)
describe('CartService booking release', () => {
  let service: CartService;
  let bookingServiceSpy: jasmine.SpyObj<BookingService>;

  const makeItem = (bookingId?: string): CartItem => ({
    id: '',
    geozoneName: 'Zone',
    activityId: 'a1',
    activityName: 'Activity',
    collectionId: 'c1',
    activityType: 'dayuse',
    dateRange: ['2026-08-27', '2026-08-27'],
    startDate: '2026-08-27',
    endDate: '2026-08-27',
    namedOccupant: { firstName: 'Local', lastName: 'Tester' },
    occupants: { totalAdult: 1, totalSenior: 0, totalYouth: 0, totalChild: 0 },
    vehicleInformation: [{ licensePlate: '', licensePlateRegistrationRegion: '' }],
    feeInformation: { registrationFees: 0, transactionFees: 0, tax: 0, total: 0 },
    detailsStepCompleted: false,
    visitorDetailsStepCompleted: false,
    equipmentStepCompleted: false,
    paymentStepCompleted: false,
    areAllStepsCompleted: false,
    bookingId,
  });

  beforeEach(() => {
    localStorage.clear();
    bookingServiceSpy = jasmine.createSpyObj('BookingService', ['cancelBooking']);
    bookingServiceSpy.cancelBooking.and.resolveTo({});

    TestBed.configureTestingModule({
      providers: [
        CartService,
        { provide: AuthService, useValue: { user: signal(null) } },
        { provide: BookingService, useValue: bookingServiceSpy },
      ],
    });
    service = TestBed.inject(CartService);
  });

  it('cancels the booking of a released item', async () => {
    await service.releaseCartItem(makeItem('booking-1'));
    expect(bookingServiceSpy.cancelBooking).toHaveBeenCalledWith('booking-1');
  });

  it('does not call the API for an item with no booking', async () => {
    await service.releaseCartItem(makeItem(undefined));
    expect(bookingServiceSpy.cancelBooking).not.toHaveBeenCalled();
  });

  it('swallows a failed cancel so the replacement booking still proceeds', async () => {
    bookingServiceSpy.cancelBooking.and.returnValue(Promise.reject(new Error('boom')));
    await expectAsync(service.releaseCartItem(makeItem('booking-1'))).toBeResolved();
  });
});
