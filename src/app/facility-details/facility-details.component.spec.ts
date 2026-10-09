import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { Component, Input, Signal } from '@angular/core';

import { FacilityDetailsComponent } from './facility-details.component';
import { SearchMapComponent } from '../search-map/search-map.component';

@Component({
  selector: 'app-search-map',
  template: '',
  standalone: true
})
class MockSearchMapComponent {
  @Input() _dataSignal: Signal<any[]>;
  @Input() displayGeozones = false;
}
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ConfigService } from '../services/config.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideToastr } from 'ngx-toastr';
import { BsModalService } from 'ngx-bootstrap/modal';
import { Title } from '@angular/platform-browser';
import { ServerTimeService } from '../services/server-time.service';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { DateTime } from 'luxon';
import { BookingService } from '../services/booking.service';
import { CartItem, CartService } from '../services/cart.service';
import { ToastService } from '../services/toast.service';
import { ProductDateService } from '../services/product-date.service';

describe('FacilityDetailsComponent', () => {
  let component: FacilityDetailsComponent;
  let fixture: ComponentFixture<FacilityDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FacilityDetailsComponent],
      providers: [
        ConfigService,
        provideRouter([{ path: 'facility/:orcs/:facilityType/:identifier', component: FacilityDetailsComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideToastr(),
        { provide: BsModalService, useValue: { show: () => ({}) } },
        {
          provide: ActivatedRoute,
          useValue: {
            root: {
              children: []
            },
            snapshot: {
              queryParamMap: convertToParamMap({}),
              data: {
                facility: {
                  displayName: 'Joffre Lakes Park',
                  geozones: [],
                  isOpen: true,
                  activities: []
                }
              }
            }
          }
        }
      ]
    })
      .overrideComponent(FacilityDetailsComponent, {
        remove: { imports: [SearchMapComponent] },
        add: { imports: [MockSearchMapComponent] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(FacilityDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Scrolled to the bottom, the trailing sections can never reach the 15% line,
  // so the "On this page" list used to stay stuck on an earlier section.
  it('highlights the last section once the page is scrolled to the bottom', () => {
    const scrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');
    Object.defineProperty(window, 'scrollY', { value: 1e6, configurable: true });

    const last = document.createElement('div');
    last.id = 'last-section';
    last.className = 'scroll-anchor';
    document.body.appendChild(last);

    component.ngAfterViewInit();

    expect(component.activeSection).toBe('last-section');

    component.ngOnDestroy();
    last.remove();
    if (scrollY) Object.defineProperty(window, 'scrollY', scrollY);
  });

  // A page too short to scroll is "at the bottom" at rest; that must not
  // highlight the last section before the visitor has scrolled at all.
  it('does not highlight the last section on a page too short to scroll', () => {
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: window.innerHeight, configurable: true });

    const last = document.createElement('div');
    last.id = 'last-section';
    last.className = 'scroll-anchor';
    last.style.cssText = 'position: fixed; top: 50vh;';
    document.body.appendChild(last);

    component.ngAfterViewInit();

    expect(component.activeSection).not.toBe('last-section');

    component.ngOnDestroy();
    last.remove();
    delete (document.documentElement as any).scrollHeight;
  });

  it('sets the browser title to the facility name', () => {
    expect(TestBed.inject(Title).getTitle()).toBe('Joffre Lakes Park | BC Parks');
  });

  // The API answers a missing facility with 200 and a null body. The constructor
  // used to dereference it unguarded, which threw and left Angular rendering an
  // entirely blank page instead of anything the user could act on.
  it('does not throw when the resolver supplies no facility', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [FacilityDetailsComponent],
      providers: [
        ConfigService,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideToastr(),
        { provide: BsModalService, useValue: { show: () => ({}) } },
        {
          provide: ActivatedRoute,
          useValue: { root: { children: [] }, snapshot: { data: { facility: null } } }
        }
      ]
    }).overrideComponent(FacilityDetailsComponent, {
      remove: { imports: [SearchMapComponent] },
      add: { imports: [MockSearchMapComponent] }
    });

    const nullFixture = TestBed.createComponent(FacilityDetailsComponent);

    expect(nullFixture.componentInstance.facilityLoadFailed).toBeTrue();
    expect(nullFixture.componentInstance.facility).toBeNull();
    expect(nullFixture.componentInstance.geozone).toBeNull();
    expect(nullFixture.componentInstance.relatedActivities).toEqual([]);
  });

  it('renders an error state rather than an empty page', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [FacilityDetailsComponent],
      providers: [
        ConfigService,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideToastr(),
        { provide: BsModalService, useValue: { show: () => ({}) } },
        {
          provide: ActivatedRoute,
          useValue: { root: { children: [] }, snapshot: { data: { facility: null } } }
        }
      ]
    }).overrideComponent(FacilityDetailsComponent, {
      remove: { imports: [SearchMapComponent] },
      add: { imports: [MockSearchMapComponent] }
    });

    const nullFixture = TestBed.createComponent(FacilityDetailsComponent);
    nullFixture.detectChanges();
    const el: HTMLElement = nullFixture.nativeElement;

    expect(el.querySelector('[role="alert"]')?.textContent)
      .toContain('could not load this day-use area');
    // The booking form must not be offered for a facility that never loaded.
    expect(el.querySelector('form')).toBeNull();
  });

  describe('reservation window', () => {
    const date = '2026-09-27';

    function selectDateWithWindow(open: number, close: number) {
      component.availableDates = {
        [date]: {
          reservationContext: { minDailyInventory: 1, maxDailyInventory: 4, temporalWindows: { reservationWindow: { open, close } } },
          inventoryPool: { isOpen: true, available: 10 }
        }
      };
      component.form.get('selectedDate').setValue(date, { emitEvent: false });
      return (component as any).loadPassesAvailable(date);
    }

    afterEach(() => fixture.destroy());

    it('gates on server time when the device clock runs fast', async () => {
      const open = Date.now() - 60 * 1000;
      TestBed.inject(ServerTimeService).record({ serverTime: open - 60 * 1000 });

      await selectDateWithWindow(open, open + 86400000);

      expect(component.passesAvailable).toBeFalse();
      expect(component.passStatus).toBe('not-open-yet');
    });

    it('shows the opening time in park time', async () => {
      const open = Date.now() + 3600000;

      await selectDateWithWindow(open, open + 86400000);

      expect(component.reservationOpensAt?.zoneName).toBe('America/Vancouver');
      expect(component.reservationOpensAt?.toMillis()).toBe(open);
    });

    it('offers passes inside the window', async () => {
      await selectDateWithWindow(Date.now() - 1000, Date.now() + 86400000);

      expect(component.passesAvailable).toBeTrue();
      expect(component.passStatus).toBe('available');
      expect(component.reservationOpensAt).toBeNull();
    });

    it('opens a page left waiting when the window opens', fakeAsync(() => {
      const open = Date.now() + 5 * 60 * 1000;
      selectDateWithWindow(open, open + 86400000);
      flushMicrotasks();
      expect(component.passStatus).toBe('not-open-yet');

      tick(5 * 60 * 1000 - 1000);
      flushMicrotasks();
      expect(component.passStatus).toBe('not-open-yet');

      tick(2000);
      flushMicrotasks();
      expect(component.passStatus).toBe('available');
      expect(component.passesAvailable).toBeTrue();
    }));
  });

  describe('pass validity', () => {
    const product = 'product::c1::dayuse::a1#1';
    const at = (date: string, hour: number) => DateTime.fromISO(`${date}T${String(hour).padStart(2, '0')}:00`, { zone: 'America/Vancouver' }).toMillis();
    const productDate = (date: string, checkIn?: number, checkOut?: number) => ({
      sk: date,
      reservationContext: {
        minDailyInventory: 1,
        maxDailyInventory: 4,
        temporalAnchors: { checkInTime: checkIn, checkOutTime: checkOut },
      },
      inventoryPool: { isOpen: true, available: 10 },
    });
    const hint = () => (fixture.nativeElement as HTMLElement).querySelector('#pass-validity')?.textContent?.trim() ?? null;
    let getProductDates: jasmine.Spy;

    beforeEach(() => {
      component.isLoggedIn = true;
      getProductDates = spyOn(TestBed.inject(ProductDateService), 'getProductDates');
      fixture.detectChanges();
    });

    afterEach(() => fixture.destroy());

    it('shows the validity window once a pass type is loaded', async () => {
      getProductDates.and.resolveTo([productDate('2026-07-15', at('2026-07-15', 7), at('2026-07-15', 13))]);

      await (component as any).loadProductDates(product);
      fixture.detectChanges();

      expect(hint()).toBe('Valid 7 am – 1 pm');
    });

    it('follows the selected date', async () => {
      getProductDates.and.resolveTo([
        productDate('2026-07-15', at('2026-07-15', 7), at('2026-07-15', 13)),
        productDate('2026-07-16', at('2026-07-16', 13), at('2026-07-16', 19)),
      ]);
      await (component as any).loadProductDates(product);

      await (component as any).loadPassesAvailable('2026-07-16');
      fixture.detectChanges();

      expect(hint()).toBe('Valid 1 pm – 7 pm');
    });

    it('is hidden when an anchor is missing', async () => {
      getProductDates.and.resolveTo([productDate('2026-07-15', at('2026-07-15', 7))]);

      await (component as any).loadProductDates(product);
      fixture.detectChanges();

      expect(component.passValidity).toBeNull();
      expect(hint()).toBeNull();
    });

    it('clears when the pass type changes', async () => {
      getProductDates.and.resolveTo([productDate('2026-07-15', at('2026-07-15', 7), at('2026-07-15', 13))]);
      await (component as any).loadProductDates(product);

      getProductDates.and.returnValue(new Promise(() => undefined));
      (component as any).loadProductDates('product::c1::dayuse::a1#2');
      fixture.detectChanges();

      expect(component.passValidity).toBeNull();
      expect(hint()).toBeNull();
    });
  });

  describe('hold retry', () => {
    const date = '2026-10-03';
    let bookingService: BookingService;
    let cartService: CartService;
    let toastSpy: jasmine.Spy;

    const retryError = (retryAt: DateTime) => ({
      status: 429,
      error: { msg: 'Try later', code: 'HOLD_COOLDOWN', retryAt: retryAt.toUTC().toISO() },
    });
    const el = (): HTMLElement => fixture.nativeElement;
    const notice = () => el().querySelector('#hold-retry-notice')?.textContent?.trim() ?? '';
    const bookButton = () => Array.from(el().querySelectorAll('button')).find(b => b.textContent?.includes('Book day-use pass'));

    beforeEach(() => {
      localStorage.clear();
      bookingService = TestBed.inject(BookingService);
      cartService = TestBed.inject(CartService);
      toastSpy = spyOn(TestBed.inject(ToastService), 'addMessage');
      spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      spyOn(component as any, 'loadProductDates').and.resolveTo();
      spyOn(component as any, 'loadPassesAvailable').and.resolveTo();

      component.isLoggedIn = true;
      component.passStatus = 'available';
      component.passesAvailable = true;
      component.availableProducts = [{ display: 'Trail pass', value: 'product::c1::dayuse::a1#p1' }];
      component.form.get('selectedProduct').setValue('product::c1::dayuse::a1#p1', { emitEvent: false });
      component.form.get('selectedDate').setValue(date, { emitEvent: false });
      component.form.get('selectedVisitors').setValue('2', { emitEvent: false });
      (component as any).selectedDateStr = date;
      fixture.detectChanges();
    });

    afterEach(() => {
      fixture.destroy();
      localStorage.clear();
    });

    it('shows the try-again notice and holds the Book button on a 429', async () => {
      spyOn(bookingService, 'createBooking').and.rejectWith(retryError(DateTime.now().plus({ minutes: 10 })));

      await component.submit();
      fixture.detectChanges();

      expect(notice()).toContain("You've changed this booking several times. You can try again at");
      expect(bookButton()?.getAttribute('aria-disabled')).toBe('true');
      expect(bookButton()?.getAttribute('aria-describedby')).toBe('hold-retry-notice');
      expect(toastSpy).not.toHaveBeenCalled();
    });

    it('does not try another hold while waiting', async () => {
      const create = spyOn(bookingService, 'createBooking').and.rejectWith(retryError(DateTime.now().plus({ minutes: 10 })));

      await component.submit();
      await component.submit();

      expect(create).toHaveBeenCalledTimes(1);
    });

    it('applies the wait only to the date it was returned for', async () => {
      spyOn(bookingService, 'createBooking').and.rejectWith(retryError(DateTime.now().plus({ minutes: 10 })));
      await component.submit();

      (component as any).selectedDateStr = '2026-10-04';

      expect(component.holdRetryAt).toBeNull();
    });

    it('re-enables the Book button when the wait ends', async () => {
      spyOn(bookingService, 'createBooking').and.rejectWith(retryError(DateTime.now().plus({ minutes: 10 })));
      await component.submit();

      component.onHoldRetryElapsed();

      expect(component.holdRetryAt).toBeNull();
      expect(bookButton()?.hasAttribute('aria-disabled')).toBeFalse();
      expect(notice()).toBe('');
    });

    it('shows sold out instead of the notice', async () => {
      spyOn(bookingService, 'createBooking').and.rejectWith(retryError(DateTime.now().plus({ minutes: 10 })));
      await component.submit();

      component.passStatus = 'sold-out';
      fixture.detectChanges();

      expect(el().querySelector('#hold-retry-notice')).toBeNull();
      expect(el().textContent).toContain('have been fully reserved');
    });

    it('falls back to the error toast for a 429 without a retry time', async () => {
      spyOn(bookingService, 'createBooking').and.rejectWith({ status: 429, error: { msg: 'Too Many Requests' } });

      await component.submit();

      expect(component.holdRetryAt).toBeNull();
      expect(toastSpy).toHaveBeenCalledWith('Too Many Requests', 'Error', jasmine.anything());
    });

    it('leaves the cart empty when the replacement hold is refused', async () => {
      cartService.addToCart({ bookingId: 'old-booking', startDate: date } as CartItem);
      spyOn(TestBed.inject(BsModalService), 'show').and.returnValue({
        content: { confirmButton: of(undefined), cancelButton: of() },
        hide: () => undefined,
        onHide: of(),
      } as any);
      const release = spyOn(cartService, 'releaseCartItem').and.resolveTo();
      spyOn(bookingService, 'createBooking').and.rejectWith(retryError(DateTime.now().plus({ minutes: 10 })));

      await component.submit();

      expect(release).toHaveBeenCalledWith(jasmine.objectContaining({ bookingId: 'old-booking' }));
      expect(cartService.items()).toEqual([]);
      expect(component.holdRetryAt).not.toBeNull();
    });

    it('stores holdLimits with the new cart item', async () => {
      spyOn(bookingService, 'createBooking').and.resolveTo({
        bookingId: 'b1', sessionId: 's1', holdLimits: { freeRemovalsLeft: 1 },
      });

      await component.submit();

      expect(cartService.items()[0]?.holdLimits).toEqual({ freeRemovalsLeft: 1 });
    });
  });
});
