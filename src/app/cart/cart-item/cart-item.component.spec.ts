import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { BsModalService } from 'ngx-bootstrap/modal';

import { CartItemComponent } from './cart-item.component';
import { CartItem, CartService } from '../../services/cart.service';
import { FeatureFlagService } from '../../services/feature-flag.service';

describe('CartItemComponent', () => {
  it('renders a zero tax amount when fee information is missing', async () => {
    await TestBed.configureTestingModule({
      imports: [CartItemComponent],
      providers: [
        { provide: FeatureFlagService, useValue: { isEnabled: () => true } },
        { provide: CartService, useValue: {} },
        { provide: BsModalService, useValue: { show: jasmine.createSpy('show') } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(CartItemComponent);
    fixture.componentInstance.item = {
      id: 'item-1',
      geozoneName: 'Test Park',
      activityName: 'Test Activity',
      activityType: 'dayuse',
      startDate: '2026-11-06',
      endDate: '2026-11-06',
      occupants: { totalAdult: 1, totalSenior: 0, totalYouth: 0, totalChild: 0 },
      namedOccupant: { firstName: '', lastName: '' },
      feeInformation: undefined
    } as unknown as CartItem;
    fixture.componentInstance.removeBool = true;

    expect(() => fixture.detectChanges()).not.toThrow();
    expect(fixture.nativeElement.textContent).toContain('$0');
  });

  it('releases the removed item through the cart service', async () => {
    const confirmButton = new Subject<void>();
    const modalRef = {
      content: { confirmButton, cancelButton: new Subject<void>() },
      hide: jasmine.createSpy('hide'),
      onHide: new Subject<void>(),
    };
    const cartService = jasmine.createSpyObj('CartService', ['releaseCartItem']);
    cartService.releaseCartItem.and.resolveTo();
    TestBed.configureTestingModule({
      providers: [{ provide: BsModalService, useValue: { show: () => modalRef } }],
    });
    const component = TestBed.runInInjectionContext(
      () => new CartItemComponent({} as FeatureFlagService, cartService as CartService)
    );
    component.item = { id: 'item-1', bookingId: 'booking-1' } as CartItem;
    const removed: string[] = [];
    component.removeItem.subscribe(id => removed.push(id));

    const done = component.onRemoveClick();
    confirmButton.next();
    await done;

    expect(removed).toEqual(['item-1']);
    expect(cartService.releaseCartItem).toHaveBeenCalledOnceWith(component.item);
  });

  it('warns in the remove dialog when no free removals are left', () => {
    const show = jasmine.createSpy('show').and.returnValue({
      content: { confirmButton: new Subject<void>(), cancelButton: new Subject<void>() },
      hide: () => undefined,
      onHide: new Subject<void>(),
    });
    TestBed.configureTestingModule({ providers: [{ provide: BsModalService, useValue: { show } }] });
    const component = TestBed.runInInjectionContext(
      () => new CartItemComponent({} as FeatureFlagService, {} as CartService)
    );
    component.item = { id: 'item-1', bookingId: 'booking-1', startDate: '2026-10-03', holdLimits: { freeRemovalsLeft: 0 } } as CartItem;

    component.onRemoveClick();

    const notes = show.calls.mostRecent().args[1].initialState.notes;
    expect(notes.length).toBe(2);
    expect(notes[0]).toContain('wait before you can book');
  });

  it('shows arrival and departure in park time', () => {
    const component = TestBed.runInInjectionContext(
      () => new CartItemComponent({} as FeatureFlagService, {} as CartService)
    );
    // 2026-07-16 06:30 UTC = July 15, 11:30 pm Pacific.
    const millis = Date.UTC(2026, 6, 16, 6, 30);

    expect(component.getDisplayTime(millis)).toBe('11:30 pm');
    expect(component.getDisplayDate(millis)).toBe('Wednesday, July 15, 2026');
    expect(component.getDisplayTime(undefined)).toBe('N/A');
  });
});
