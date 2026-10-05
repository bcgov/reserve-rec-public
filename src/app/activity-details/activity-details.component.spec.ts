import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, Input, Signal } from '@angular/core';

import { ActivityDetailsComponent } from './activity-details.component';
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
import { provideRouter } from '@angular/router';
import { ConfigService } from '../services/config.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideToastr } from 'ngx-toastr';
import { BsModalService } from 'ngx-bootstrap/modal';
import { of } from 'rxjs';
import { CartService, CartItem } from '../services/cart.service';

describe('ActivityDetailsComponent', () => {
  let component: ActivityDetailsComponent;
  let fixture: ComponentFixture<ActivityDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActivityDetailsComponent],
      providers: [
        ConfigService,
        provideRouter([{ path: 'activity/:orcs/:activityType/:identifier', component: ActivityDetailsComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideToastr(),
        { provide: BsModalService, useValue: { show: () => ({}) } }
      ]
    })
      .overrideComponent(ActivityDetailsComponent, {
        remove: { imports: [SearchMapComponent] },
        add: { imports: [MockSearchMapComponent] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(ActivityDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => TestBed.inject(CartService).clearCart());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('releases a replaced cart item quietly so only the added toast shows', async () => {
    const cartService = TestBed.inject(CartService);
    cartService.addToCart({ bookingId: 'old-booking', startDate: '2026-10-05' } as CartItem);
    spyOn(TestBed.inject(BsModalService), 'show').and.returnValue({
      content: { confirmButton: of(undefined), cancelButton: of() },
      hide: () => undefined,
      onHide: of(),
    } as any);
    spyOnProperty(component.form, 'valid').and.returnValue(true);
    const release = spyOn(cartService, 'releaseCartItem').and.resolveTo();

    await component.submit();

    expect(release).toHaveBeenCalledWith(jasmine.objectContaining({ bookingId: 'old-booking' }), { quiet: true });
  });
});
