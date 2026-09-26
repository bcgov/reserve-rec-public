import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideToastr } from 'ngx-toastr';
import { throwError } from 'rxjs';

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
});
