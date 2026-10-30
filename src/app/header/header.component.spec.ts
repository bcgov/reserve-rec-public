import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeaderComponent } from './header.component';
import { LoggerService } from '../services/logger.service';
import { ConfigService } from '../services/config.service';
import { SearchService } from '../services/search.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { provideToastr } from 'ngx-toastr';
import { AuthService } from '../services/auth.service';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HeaderComponent
      ],
      providers: [
        LoggerService,
        ConfigService,
        SearchService,
        provideHttpClient(),
        provideToastr(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => '',
              },
            },
          },
        },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should label the account button with the user name for screen readers', () => {
    spyOn(TestBed.inject(AuthService), 'getCurrentUser').and.returnValue({ given_name: 'Jane', family_name: 'Doe' });
    fixture.detectChanges();
    const button: HTMLElement = fixture.nativeElement.querySelector('#accountDropdown');
    expect(button.getAttribute('aria-label')).toBe('Account menu for Jane Doe');
    expect(button.querySelector('.account-avatar')?.getAttribute('aria-hidden')).toBe('true');
  });

  describe('cart link', () => {
    const cartLinks = () => fixture.nativeElement.querySelectorAll('a[href="/cart"]') as NodeListOf<HTMLAnchorElement>;
    let count: number;

    beforeEach(() => {
      spyOnProperty(component, 'user').and.returnValue({ given_name: 'A', family_name: 'B' });
      spyOnProperty(component, 'cartItemCount').and.callFake(() => count);
    });

    it('is labelled "Cart" when the cart is empty', () => {
      count = 0;
      fixture.detectChanges();
      expect(cartLinks().length).toBe(2);
      cartLinks().forEach(a => expect(a.getAttribute('aria-label')).toBe('Cart'));
    });

    it('includes the item count in the label', () => {
      count = 1;
      fixture.detectChanges();
      cartLinks().forEach(a => expect(a.getAttribute('aria-label')).toBe('Cart, 1 item'));
      count = 3;
      fixture.detectChanges();
      cartLinks().forEach(a => expect(a.getAttribute('aria-label')).toBe('Cart, 3 items'));
    });

    it('hides the decorative icon from screen readers', () => {
      count = 0;
      fixture.detectChanges();
      cartLinks().forEach(a => expect(a.querySelector('i')?.getAttribute('aria-hidden')).toBe('true'));
    });
  });
});
