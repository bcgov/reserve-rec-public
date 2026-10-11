import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeaderComponent } from './header.component';
import { ConfigService } from '../services/config.service';
import { AuthService } from '../services/auth.service';
import { CartService } from '../services/cart.service';
import { provideRouter } from '@angular/router';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let cartService: jasmine.SpyObj<CartService>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj('AuthService', ['getCurrentUser']);
    cartService = jasmine.createSpyObj('CartService', ['itemCount']);
    authService.getCurrentUser.and.returnValue(null);
    cartService.itemCount.and.returnValue(0);
    await TestBed.configureTestingModule({
      imports: [
        HeaderComponent
      ],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: CartService, useValue: cartService },
        { provide: ConfigService, useValue: { config: { ENVIRONMENT: 'local' } } },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  for (const count of [0, 3]) {
    it(`should label both cart links when the cart contains ${count} items`, () => {
      authService.getCurrentUser.and.returnValue({ given_name: 'Test', family_name: 'User' });
      cartService.itemCount.and.returnValue(count);
      fixture.detectChanges();

      const links: HTMLAnchorElement[] = Array.from(fixture.nativeElement.querySelectorAll('a[href="/cart"]'));
      expect(links.length).toBe(2);
      for (const link of links) {
        expect(link.getAttribute('aria-label')).toBe('Cart');
        expect(link.querySelector('.badge')?.textContent?.trim() ?? '').toBe(count ? String(count) : '');
      }
    });
  }

  it('should hide the cart links when signed out', () => {
    expect(fixture.nativeElement.querySelectorAll('a[href="/cart"]').length).toBe(0);
  });
});
