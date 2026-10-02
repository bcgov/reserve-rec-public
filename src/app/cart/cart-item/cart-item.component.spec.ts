import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { BsModalService } from 'ngx-bootstrap/modal';

import { CartItemComponent } from './cart-item.component';
import { CartItem, CartService } from '../../services/cart.service';
import { FeatureFlagService } from '../../services/feature-flag.service';

describe('CartItemComponent', () => {
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
});
