import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { BsModalService } from 'ngx-bootstrap/modal';
import { CartExpiryService } from './cart-expiry.service';
import { CartItem, CartService } from './cart.service';
import { ConfirmationModalComponent } from '../shared/components/confirmation-modal/confirmation-modal.component';

describe('CartExpiryService', () => {
  let service: CartExpiryService;
  let items: ReturnType<typeof signal<CartItem[]>>;
  let removeFromCart: jasmine.Spy;
  let releaseCartItem: jasmine.Spy;
  let modalShow: jasmine.Spy;
  let router: { url: string; navigate: jasmine.Spy };
  let timerActive: boolean;

  beforeEach(() => {
    const item = { id: 'item-1', sessionExpiry: Date.now() - 10_000 } as CartItem;
    items = signal<CartItem[]>([item]);
    removeFromCart = jasmine.createSpy('removeFromCart').and.callFake((id: string) => {
      items.update(currentItems => currentItems.filter(cartItem => cartItem.id !== id));
    });
    releaseCartItem = jasmine.createSpy('releaseCartItem').and.resolveTo();
    timerActive = true;
    modalShow = jasmine.createSpy('show').and.returnValue({
      content: { confirmButton: { subscribe: jasmine.createSpy('subscribe') } },
      hide: jasmine.createSpy('hide'),
    });
    router = { url: '/', navigate: jasmine.createSpy('navigate').and.resolveTo(true) };

    TestBed.configureTestingModule({
      providers: [
        CartExpiryService,
        {
          provide: CartService,
          useValue: {
            items: items.asReadonly(),
            getCartTimerIsActive: () => timerActive,
            removeFromCart,
            releaseCartItem,
          },
        },
        { provide: BsModalService, useValue: { show: modalShow } },
        { provide: Router, useValue: router },
      ],
    });
    service = TestBed.inject(CartExpiryService);
  });

  afterEach(() => service.ngOnDestroy());

  it('removes and releases an expired item and notifies the user', () => {
    const item = items()[0];

    service.tick();

    expect(removeFromCart).toHaveBeenCalledOnceWith(item.id);
    expect(releaseCartItem).toHaveBeenCalledOnceWith(item);
    expect(modalShow).toHaveBeenCalledOnceWith(ConfirmationModalComponent, jasmine.objectContaining({
      initialState: jasmine.objectContaining({ title: 'Booking timer expired' }),
    }));
  });

  for (const checkoutRoute of ['/reservation-flow', '/checkout']) {
    it(`returns to the cart if the item expires at ${checkoutRoute}`, () => {
      router.url = checkoutRoute;

      service.tick();

      expect(router.navigate).toHaveBeenCalledOnceWith(['/cart']);
    });
  }

  it('does not leave a non-checkout route when an item expires', () => {
    router.url = '/search';

    service.tick();

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not remove an item before its expiry', () => {
    items.set([{ id: 'item-1', sessionExpiry: Date.now() + 60_000 } as CartItem]);

    service.tick();

    expect(removeFromCart).not.toHaveBeenCalled();
    expect(releaseCartItem).not.toHaveBeenCalled();
    expect(modalShow).not.toHaveBeenCalled();
  });
});
