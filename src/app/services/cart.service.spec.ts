import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { CartItem, CartService, holdReleaseNotes } from './cart.service';
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
    bookingServiceSpy = jasmine.createSpyObj('BookingService', ['removeBooking', 'fetchBooking', 'notifyAlreadyConfirmed']);
    bookingServiceSpy.removeBooking.and.resolveTo({});
    bookingServiceSpy.fetchBooking.and.resolveTo({ status: 'in progress' });

    TestBed.configureTestingModule({
      providers: [
        CartService,
        { provide: AuthService, useValue: { user: signal(null) } },
        { provide: BookingService, useValue: bookingServiceSpy },
      ],
    });
    service = TestBed.inject(CartService);
  });

  it('removes the booking held by a released item from cart', async () => {
    await service.releaseCartItem(makeItem('booking-1'));
    expect(bookingServiceSpy.removeBooking).toHaveBeenCalledWith('booking-1', { quiet: true });
  });

  it('still removes the item when the status check fails', async () => {
    bookingServiceSpy.fetchBooking.and.resolveTo(null);
    await service.releaseCartItem(makeItem('booking-1'));
    expect(bookingServiceSpy.removeBooking).toHaveBeenCalledWith('booking-1', { quiet: true });
  });

  it('drops a confirmed item without removing it and tells the user', async () => {
    bookingServiceSpy.fetchBooking.and.resolveTo({ status: 'confirmed' });
    await service.releaseCartItem(makeItem('booking-1'));
    expect(bookingServiceSpy.removeBooking).not.toHaveBeenCalled();
    expect(bookingServiceSpy.notifyAlreadyConfirmed).toHaveBeenCalled();
  });

  it('drops an already-cancelled item without removing it', async () => {
    bookingServiceSpy.fetchBooking.and.resolveTo({ status: 'cancelled' });
    await service.releaseCartItem(makeItem('booking-1'));
    expect(bookingServiceSpy.removeBooking).not.toHaveBeenCalled();
    expect(bookingServiceSpy.notifyAlreadyConfirmed).not.toHaveBeenCalled();
  });

  it('does not call the API for an item with no booking', async () => {
    await service.releaseCartItem(makeItem(undefined));
    expect(bookingServiceSpy.removeBooking).not.toHaveBeenCalled();
  });

  it('swallows a failed remove so the replacement booking still proceeds', async () => {
    bookingServiceSpy.removeBooking.and.returnValue(Promise.reject(new Error('boom')));
    await expectAsync(service.releaseCartItem(makeItem('booking-1'))).toBeResolved();
  });
});

describe('CartService cross-tab sync', () => {
  const STORAGE_KEY = 'bcparks-cart::anon';
  let service: CartService;

  const storeFromOtherTab = (items: unknown[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
  };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 'item-1', bookingId: 'booking-1' }]));
    TestBed.configureTestingModule({
      providers: [
        CartService,
        { provide: AuthService, useValue: { user: signal(null) } },
        { provide: BookingService, useValue: {} },
      ],
    });
    service = TestBed.inject(CartService);
    TestBed.tick();
  });

  afterEach(() => localStorage.clear());

  it('empties the cart when another tab clears it', () => {
    expect(service.items().length).toBe(1);
    storeFromOtherTab([]);
    expect(service.items()).toEqual([]);
  });

  it('picks up an item added in another tab', () => {
    storeFromOtherTab([{ id: 'item-2', bookingId: 'booking-2' }]);
    expect(service.items().map(item => item.id)).toEqual(['item-2']);
  });

  it('reloads when another tab clears all storage', () => {
    localStorage.clear();
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    expect(service.items()).toEqual([]);
  });

  it('ignores changes to other keys', () => {
    localStorage.setItem(STORAGE_KEY, '[]');
    window.dispatchEvent(new StorageEvent('storage', { key: 'bcparks-cart::someone-else' }));
    expect(service.items().length).toBe(1);
  });
});

describe('holdReleaseNotes', () => {
  const item = (holdLimits?: { freeRemovalsLeft: number }) =>
    ({ id: 'item-1', bookingId: 'booking-1', startDate: '2026-10-03', holdLimits } as CartItem);
  const takenNote = 'Someone else may book these passes after they leave your cart.';

  it('warns about the wait and the passes when no free removals are left', () => {
    expect(holdReleaseNotes(item({ freeRemovalsLeft: 0 }))).toEqual([
      'You will have to wait before you can book this pass for October 3 again.',
      takenNote,
    ]);
  });

  it('only mentions the passes when removals are left or no limit applies', () => {
    expect(holdReleaseNotes(item({ freeRemovalsLeft: 1 }))).toEqual([takenNote]);
    expect(holdReleaseNotes(item())).toEqual([takenNote]);
  });

  it('adds nothing for an item with no hold', () => {
    expect(holdReleaseNotes({ ...item({ freeRemovalsLeft: 0 }), bookingId: undefined })).toEqual([]);
    expect(holdReleaseNotes(undefined)).toEqual([]);
  });
});
