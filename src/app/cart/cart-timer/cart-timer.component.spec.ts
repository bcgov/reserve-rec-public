import { TestBed } from '@angular/core/testing';
import { BsModalService } from 'ngx-bootstrap/modal';

import { CartTimerComponent } from './cart-timer.component';
import { CartService } from '../../services/cart.service';

describe('CartTimerComponent', () => {
  it('releases the expired item through the cart service', async () => {
    const item = { id: 'item-1', bookingId: 'booking-1' };
    const cartService = jasmine.createSpyObj('CartService', ['items', 'releaseCartItem']);
    cartService.items.and.returnValue([item]);
    cartService.releaseCartItem.and.resolveTo();
    TestBed.configureTestingModule({ providers: [{ provide: BsModalService, useValue: {} }] });
    const component = TestBed.runInInjectionContext(() => new CartTimerComponent(cartService as CartService));
    const removed: string[] = [];
    component.removeItem.subscribe(id => removed.push(id));

    await component.onRemoveClick();

    expect(removed).toEqual(['item-1']);
    expect(cartService.releaseCartItem).toHaveBeenCalledOnceWith(item);
  });
});
