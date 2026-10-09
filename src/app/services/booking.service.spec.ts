import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideToastr } from 'ngx-toastr';
import { of, throwError } from 'rxjs';

import { BookingService, parseHoldRetryAt } from './booking.service';
import { ApiService } from './api.service';
import { ConfigService } from './config.service';
import { ToastService } from './toast.service';

describe('BookingService', () => {
  let service: BookingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ConfigService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideToastr()
      ]
    });
    service = TestBed.inject(BookingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('shows the removed toast on a successful remove', async () => {
    const postSpy = spyOn(TestBed.inject(ApiService), 'post').and.returnValue(of({ data: {} }));
    const toastSpy = spyOn(TestBed.inject(ToastService), 'addMessage');

    await service.removeBooking('booking-1');

    expect(postSpy).toHaveBeenCalledWith('bookings/booking-1/remove', {});
    expect(toastSpy).toHaveBeenCalledOnceWith('Item removed from cart', 'Success', 0);
  });

  it('treats a 409 for an already timed-out booking as a successful removal', async () => {
    spyOn(TestBed.inject(ApiService), 'post').and.callFake(() => throwError(() => ({
      status: 409,
      error: { msg: 'Booking has status "TIMED_OUT" and cannot be removed' }
    })));
    const toastSpy = spyOn(TestBed.inject(ToastService), 'addMessage');

    const result = await service.removeBooking('booking-1');

    expect(result).toBeNull();
    expect(toastSpy).toHaveBeenCalledOnceWith('Item removed from cart', 'Success', 0);
  });

  it('treats a booking that no longer exists as removed', async () => {
    spyOn(TestBed.inject(ApiService), 'post').and.callFake(() => throwError(() => ({
      status: 400,
      error: { msg: 'Booking not found (BookingID: booking-1)', data: { refusal: 'not_found' } }
    })));
    const toastSpy = spyOn(TestBed.inject(ToastService), 'addMessage');

    expect(await service.removeBooking('booking-1')).toBeNull();
    expect(toastSpy).toHaveBeenCalledOnceWith('Item removed from cart', 'Success', 0);
  });

  it('tells the user a refused remove is already confirmed', async () => {
    spyOn(TestBed.inject(ApiService), 'post').and.callFake(() => throwError(() => ({
      status: 409,
      error: { msg: 'This booking is already confirmed. Manage it from My bookings.', data: { status: 'confirmed', refusal: 'state' } }
    })));
    const toastSpy = spyOn(TestBed.inject(ToastService), 'addMessage');

    const result = await service.removeBooking('booking-1');

    expect(result).toBeNull();
    expect(toastSpy).toHaveBeenCalledOnceWith(
      'This booking is already confirmed. You can manage it from My bookings.',
      'Already confirmed',
      2
    );
  });

  it('sends a cancellation reason when provided', async () => {
    const postSpy = spyOn(TestBed.inject(ApiService), 'post').and.returnValue(of({ data: {} }));

    await service.cancelBooking('booking-1', { reason: 'Cancelled by user' });

    expect(postSpy).toHaveBeenCalledWith('bookings/booking-1/cancel', { reason: 'Cancelled by user' }, {});
  });

  it('shows the error toast for any other cancel failure', async () => {
    spyOn(TestBed.inject(ApiService), 'post').and.callFake(() => throwError(() => ({
      status: 500,
      error: { msg: 'Something went wrong' }
    })));
    const toastSpy = spyOn(TestBed.inject(ToastService), 'addMessage');

    const result = await service.cancelBooking('booking-1', { reason: 'Cancelled by user' });

    expect(result).toBeNull();
    expect(toastSpy).toHaveBeenCalledOnceWith('Error', 'Error cancelling booking', 3);
  });

  it('returns the booking from fetchBooking, or null when the lookup fails', async () => {
    const getSpy = spyOn(TestBed.inject(ApiService), 'get').and.returnValue(of({ data: { status: 'confirmed' } }));
    expect(await service.fetchBooking('booking-1')).toEqual({ status: 'confirmed' });
    expect(getSpy).toHaveBeenCalledWith('bookings/booking-1');

    getSpy.and.callFake(() => throwError(() => ({ status: 500 })));
    expect(await service.fetchBooking('booking-1')).toBeNull();
  });

  describe('hold limits on create', () => {
    const create = (body: any) => {
      spyOn(TestBed.inject(ApiService), 'post').and.returnValue(of(body));
      return service.createBooking({ productId: 'p1', quantity: 1 }, 'c1', 'dayuse', 'a1', '2026-10-03');
    };

    it('keeps holdLimits returned in data', async () => {
      const res = await create({ data: { bookingId: 'b1', holdLimits: { freeRemovalsLeft: 2 } } });
      expect(res.holdLimits).toEqual({ freeRemovalsLeft: 2 });
    });

    it('reads holdLimits from the body root', async () => {
      const res = await create({ data: { bookingId: 'b1' }, holdLimits: { freeRemovalsLeft: 0 } });
      expect(res.holdLimits).toEqual({ freeRemovalsLeft: 0 });
    });

    it('leaves holdLimits unset when absent or malformed', async () => {
      const res = await create({ data: { bookingId: 'b1', holdLimits: { freeRemovalsLeft: 'x' } } });
      expect(res.holdLimits).toBeUndefined();
    });
  });
});

describe('parseHoldRetryAt', () => {
  const retryAt = '2026-10-02T14:15:00.000Z';

  it('reads code and retryAt from the body root', () => {
    const parsed = parseHoldRetryAt({ status: 429, error: { msg: 'x', code: 'HOLD_COOLDOWN', retryAt } });
    expect(parsed?.toMillis()).toBe(Date.parse(retryAt));
  });

  it('reads code and retryAt from data', () => {
    const parsed = parseHoldRetryAt({ status: 429, error: { code: 429, data: { code: 'HOLD_CAP', retryAt } } });
    expect(parsed?.toMillis()).toBe(Date.parse(retryAt));
  });

  it('ignores other statuses, other codes and a bad retryAt', () => {
    expect(parseHoldRetryAt({ status: 409, error: { code: 'HOLD_COOLDOWN', retryAt } })).toBeNull();
    expect(parseHoldRetryAt({ status: 429, error: { code: 'THROTTLED', retryAt } })).toBeNull();
    expect(parseHoldRetryAt({ status: 429, error: { code: 'HOLD_COOLDOWN', retryAt: 'soon' } })).toBeNull();
    expect(parseHoldRetryAt({ status: 429, error: { message: 'Too Many Requests' } })).toBeNull();
  });
});
