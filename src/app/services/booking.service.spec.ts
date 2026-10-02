import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideToastr } from 'ngx-toastr';
import { of, throwError } from 'rxjs';

import { BookingService } from './booking.service';
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

  it('treats a 409 for an already timed-out hold as a successful removal', async () => {
    spyOn(TestBed.inject(ApiService), 'post').and.callFake(() => throwError(() => ({
      status: 409,
      error: { msg: 'Booking has status "TIMED_OUT" and cannot be cancelled' }
    })));
    const toastSpy = spyOn(TestBed.inject(ToastService), 'addMessage');

    const result = await service.cancelBooking('booking-1');

    expect(result).toBeNull();
    expect(toastSpy).toHaveBeenCalledOnceWith('Successfully removed from cart', '', 0);
  });

  it('treats a 409 for an already-cancelled hold as a successful removal', async () => {
    spyOn(TestBed.inject(ApiService), 'post').and.callFake(() => throwError(() => ({
      status: 409,
      error: { msg: 'Booking has status "cancelled" and cannot be cancelled' }
    })));
    const toastSpy = spyOn(TestBed.inject(ToastService), 'addMessage');

    const result = await service.cancelBooking('booking-1');

    expect(result).toBeNull();
    expect(toastSpy).toHaveBeenCalledOnceWith('Successfully removed from cart', '', 0);
  });

  it('shows the error toast for any other cancel failure', async () => {
    spyOn(TestBed.inject(ApiService), 'post').and.callFake(() => throwError(() => ({
      status: 500,
      error: { msg: 'Something went wrong' }
    })));
    const toastSpy = spyOn(TestBed.inject(ToastService), 'addMessage');

    const result = await service.cancelBooking('booking-1');

    expect(result).toBeNull();
    expect(toastSpy).toHaveBeenCalledOnceWith('', 'Error removing item from cart', 3);
  });

  it('sends the cart-removal intent only when asked', async () => {
    const postSpy = spyOn(TestBed.inject(ApiService), 'post').and.returnValue(of({ data: {} }));
    spyOn(TestBed.inject(ToastService), 'addMessage');

    await service.cancelBooking('booking-1', { cartRemoval: true });
    await service.cancelBooking('booking-2');

    expect(postSpy.calls.argsFor(0)).toEqual(['bookings/booking-1/cancel', { cartRemoval: true }, {}]);
    expect(postSpy.calls.argsFor(1)).toEqual(['bookings/booking-2/cancel', {}, {}]);
  });

  it('tells the user a refused cart removal is already confirmed', async () => {
    spyOn(TestBed.inject(ApiService), 'post').and.callFake(() => throwError(() => ({
      status: 409,
      error: { msg: 'This booking is already confirmed. Manage it from My bookings.', data: { status: 'confirmed', refusal: 'state' } }
    })));
    const toastSpy = spyOn(TestBed.inject(ToastService), 'addMessage');

    const result = await service.cancelBooking('booking-1', { cartRemoval: true });

    expect(result).toBeNull();
    expect(toastSpy).toHaveBeenCalledOnceWith(
      'This booking is already confirmed. You can manage it from My bookings.',
      'Removed from cart',
      2
    );
  });

  it('returns the booking from fetchBooking, or null when the lookup fails', async () => {
    const getSpy = spyOn(TestBed.inject(ApiService), 'get').and.returnValue(of({ data: { status: 'confirmed' } }));
    expect(await service.fetchBooking('booking-1')).toEqual({ status: 'confirmed' });
    expect(getSpy).toHaveBeenCalledWith('bookings/booking-1');

    getSpy.and.callFake(() => throwError(() => ({ status: 500 })));
    expect(await service.fetchBooking('booking-1')).toBeNull();
  });
});
