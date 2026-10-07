import { CartTimerComponent } from './cart-timer.component';
import { CartService } from '../../services/cart.service';

describe('CartTimerComponent', () => {
  it('displays the remaining time without owning expiry handling', () => {
    const now = 1_800_000_000_000;
    spyOn(Date, 'now').and.returnValue(now);
    const cartService = {
      items: () => [{ sessionExpiry: now + 90_000 }], // 1m30s in the future
      getCartTimerIsActive: () => true,
    };
    const component = new CartTimerComponent(cartService as CartService);

    component.ngOnInit();

    expect(component.displayTimer()).toBe('1:30'); //
    component.ngOnDestroy();
  });
});
