import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideToastr } from 'ngx-toastr';
import { DateTime } from 'luxon';
import { Observable, of, throwError } from 'rxjs';
import { BookingCancelComponent } from './booking-cancel.component';
import { ApiService } from '../../services/api.service';
import { ConfigService } from '../../services/config.service';

describe('BookingCancelComponent', () => {
  let fixture: ComponentFixture<BookingCancelComponent>;
  const today = DateTime.now().setZone('America/Vancouver');

  // The email's "Cancel your reservation" link lands here for any booking, so
  // the page has to cope with past and unreadable bookings too (#871).
  async function render(response: Observable<any>) {
    await TestBed.configureTestingModule({
      imports: [BookingCancelComponent],
      providers: [
        ConfigService,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideToastr(),
        { provide: ApiService, useValue: { get: () => response } },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BookingCancelComponent);
    await fixture.componentInstance.ngOnInit();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const booking = (date: DateTime, status = 'confirmed') =>
    of({ data: { bookingId: 'b1', status, startDate: date.toISODate(), endDate: date.toISODate() } });

  function expectNotAvailablePage(el: HTMLElement) {
    expect(el.querySelector('h1')?.textContent).toContain('Cancellation is not available');
    const links = Array.from(el.querySelectorAll('a')).map(a => [a.textContent?.trim(), a.getAttribute('href')]);
    expect(links).toContain(['View my bookings', '/my-bookings']);
    expect(links).toContain(['Return to home', '/']);
    expect(el.querySelector('.booking-card')).toBeNull();
    expect(el.querySelector('#acknowledgeCancel')).toBeNull();
    expect(el.textContent).not.toContain('Failed to load');
  }

  it('shows "Cancellation is not available" for a past booking', async () => {
    expectNotAvailablePage(await render(booking(today.minus({ days: 1 }))));
  });

  it('shows "Cancellation is not available" when the booking cannot be loaded', async () => {
    expectNotAvailablePage(await render(throwError(() => ({ status: 403 }))));
  });

  it('still offers cancellation for an upcoming booking', async () => {
    const el = await render(booking(today.plus({ days: 1 })));
    expect(el.querySelector('h1')?.textContent).toContain('Cancel entire booking');
    expect(el.querySelector('#acknowledgeCancel')).not.toBeNull();
  });

  it('still shows the cancelled confirmation for a cancelled booking', async () => {
    const el = await render(booking(today.plus({ days: 1 }), 'cancelled'));
    expect(el.textContent).toContain('Your booking is cancelled.');
    expect(el.textContent).not.toContain('Cancellation is not available');
  });

  it('still shows the cancelled confirmation for a past cancelled booking', async () => {
    const el = await render(booking(today.minus({ days: 3 }), 'cancelled'));
    expect(el.textContent).toContain('Your booking is cancelled.');
    expect(el.textContent).not.toContain('Cancellation is not available');
  });
});
